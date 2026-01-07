#!/usr/bin/env node
/**
 * H1 Model Fine-Tuning Pipeline
 *
 * Trains H1 relational models on clip pair preferences using Vertex AI.
 *
 * Usage:
 *   node scripts/fine-tune-h1-dpo.js prepare --h1=older_comparison
 *   node scripts/fine-tune-h1-dpo.js train --h1=older_comparison
 *   node scripts/fine-tune-h1-dpo.js status
 *   node scripts/fine-tune-h1-dpo.js test --model=<endpoint>
 */

const { Storage } = require('@google-cloud/storage');
const { GoogleAuth } = require('google-auth-library');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-central1',
  bucketName: process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'hagen-video-analysis',
  baseModel: 'gemini-2.0-flash-001', // Use latest flash for text-based tuning

  // Hyperparameters for H1 models (smaller dataset = more epochs)
  epochs: 6,
  learningRateMultiplier: 1.0,

  // Data split
  trainSplit: 0.85,

  // Paths
  trainingPath: 'fine-tuning/h1-models',
  outputPath: path.join(__dirname, '../datasets/fine-tuning')
};

class H1Finetuner {
  constructor() {
    this.storage = new Storage({ projectId: CONFIG.projectId });
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    this.apiEndpoint = `https://${CONFIG.location}-aiplatform.googleapis.com/v1`;
  }

  async getAccessToken() {
    const client = await this.auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token;
  }

  /**
   * STEP 1: Prepare H1 DPO data for Vertex AI SFT format
   *
   * Converts DPO format (prompt/chosen/rejected) to SFT format (contents)
   * by using prompt as user message and chosen as model response.
   */
  async prepareTrainingData(h1Name) {
    console.log(`📊 Preparing H1 training data for: ${h1Name}\n`);

    // Load DPO JSONL file
    const dpoPath = path.join(CONFIG.outputPath, `h1_${h1Name}_dpo.jsonl`);
    if (!fs.existsSync(dpoPath)) {
      throw new Error(`DPO file not found: ${dpoPath}\nRun export-h1-dpo-training.js first.`);
    }

    const lines = fs.readFileSync(dpoPath, 'utf-8').trim().split('\n');
    const dpoExamples = lines.map(line => JSON.parse(line));

    console.log(`Loaded ${dpoExamples.length} DPO examples`);

    // Convert DPO to SFT format
    const sftExamples = dpoExamples.map(dpo => this.dpoToSft(dpo));

    // Shuffle
    const shuffled = [...sftExamples].sort(() => Math.random() - 0.5);

    // Split
    const splitIdx = Math.floor(shuffled.length * CONFIG.trainSplit);
    const trainExamples = shuffled.slice(0, splitIdx);
    const validationExamples = shuffled.slice(splitIdx);

    console.log(`   Train: ${trainExamples.length}`);
    console.log(`   Validation: ${validationExamples.length}`);

    // Convert to JSONL
    const trainJsonl = trainExamples.map(ex => JSON.stringify(ex)).join('\n');
    const validationJsonl = validationExamples.map(ex => JSON.stringify(ex)).join('\n');

    // Save locally
    const timestamp = new Date().toISOString().split('T')[0];
    const trainLocalPath = path.join(CONFIG.outputPath, `h1_${h1Name}_train_${timestamp}.jsonl`);
    const valLocalPath = path.join(CONFIG.outputPath, `h1_${h1Name}_val_${timestamp}.jsonl`);

    fs.writeFileSync(trainLocalPath, trainJsonl);
    fs.writeFileSync(valLocalPath, validationJsonl);

    console.log(`\n💾 Local copies saved:`);
    console.log(`   ${trainLocalPath}`);
    console.log(`   ${valLocalPath}`);

    // Upload to GCS
    const bucket = this.storage.bucket(CONFIG.bucketName);
    const trainGcsPath = `${CONFIG.trainingPath}/${h1Name}/train_${timestamp}.jsonl`;
    const valGcsPath = `${CONFIG.trainingPath}/${h1Name}/validation_${timestamp}.jsonl`;

    await bucket.file(trainGcsPath).save(trainJsonl, {
      contentType: 'application/jsonl',
      metadata: {
        h1Model: h1Name,
        recordCount: trainExamples.length.toString(),
        createdAt: new Date().toISOString()
      }
    });

    await bucket.file(valGcsPath).save(validationJsonl, {
      contentType: 'application/jsonl',
      metadata: {
        h1Model: h1Name,
        recordCount: validationExamples.length.toString(),
        createdAt: new Date().toISOString()
      }
    });

    const trainUri = `gs://${CONFIG.bucketName}/${trainGcsPath}`;
    const validationUri = `gs://${CONFIG.bucketName}/${valGcsPath}`;

    console.log(`\n☁️  Uploaded to GCS:`);
    console.log(`   Train: ${trainUri}`);
    console.log(`   Validation: ${validationUri}`);

    // Save URIs for training step
    const urisPath = path.join(CONFIG.outputPath, `h1_${h1Name}_uris.json`);
    fs.writeFileSync(urisPath, JSON.stringify({
      h1Name,
      trainUri,
      validationUri,
      timestamp,
      stats: {
        total: dpoExamples.length,
        train: trainExamples.length,
        validation: validationExamples.length
      }
    }, null, 2));

    return { trainUri, validationUri };
  }

  /**
   * Convert DPO format to SFT format for Vertex AI
   */
  dpoToSft(dpo) {
    return {
      contents: [
        {
          role: 'user',
          parts: [{ text: dpo.prompt }]
        },
        {
          role: 'model',
          parts: [{ text: dpo.chosen }]
        }
      ]
    };
  }

  /**
   * STEP 2: Submit fine-tuning job
   */
  async submitTuningJob(h1Name) {
    console.log(`🚀 Submitting H1 fine-tuning job for: ${h1Name}\n`);

    // Load URIs
    const urisPath = path.join(CONFIG.outputPath, `h1_${h1Name}_uris.json`);
    if (!fs.existsSync(urisPath)) {
      throw new Error(`No training data found. Run "prepare --h1=${h1Name}" first.`);
    }

    const uris = JSON.parse(fs.readFileSync(urisPath, 'utf-8'));
    console.log('Training data:', uris.trainUri);
    console.log('Validation data:', uris.validationUri);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const displayName = `h1-${h1Name}-v1-${timestamp}`;

    const endpoint = `${this.apiEndpoint}/projects/${CONFIG.projectId}/locations/${CONFIG.location}/tuningJobs`;

    const requestBody = {
      baseModel: CONFIG.baseModel,
      supervisedTuningSpec: {
        trainingDatasetUri: uris.trainUri,
        validationDatasetUri: uris.validationUri,
        hyperParameters: {
          epochCount: CONFIG.epochs,
          learningRateMultiplier: CONFIG.learningRateMultiplier
        }
      },
      tunedModelDisplayName: displayName
    };

    console.log('\nRequest body:');
    console.log(JSON.stringify(requestBody, null, 2));

    const token = await this.getAccessToken();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('\n❌ Failed to submit tuning job:');
      console.error(JSON.stringify(result, null, 2));
      throw new Error(result.error?.message || 'Unknown error');
    }

    console.log('\n✅ Tuning job submitted successfully!');
    console.log('Job name:', result.name);
    console.log('State:', result.state);

    // Save job info
    const jobInfoPath = path.join(CONFIG.outputPath, `h1_${h1Name}_job.json`);
    fs.writeFileSync(jobInfoPath, JSON.stringify({
      ...result,
      h1Name,
      submittedAt: new Date().toISOString()
    }, null, 2));

    console.log(`\nJob info saved to: ${jobInfoPath}`);
    console.log('\nMonitor progress with:');
    console.log(`  node scripts/fine-tune-h1-dpo.js status --h1=${h1Name}`);

    return result;
  }

  /**
   * Check job status
   */
  async checkStatus(h1Name) {
    console.log(`📊 Checking status for H1: ${h1Name || 'all'}\n`);

    // Find job files
    const files = fs.readdirSync(CONFIG.outputPath)
      .filter(f => f.match(/^h1_.*_job\.json$/));

    if (h1Name) {
      const jobPath = path.join(CONFIG.outputPath, `h1_${h1Name}_job.json`);
      if (fs.existsSync(jobPath)) {
        await this.checkSingleJob(jobPath);
      } else {
        console.log(`No job found for ${h1Name}`);
      }
    } else {
      for (const file of files) {
        await this.checkSingleJob(path.join(CONFIG.outputPath, file));
        console.log('---');
      }
    }
  }

  async checkSingleJob(jobPath) {
    const jobInfo = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));
    const jobName = jobInfo.name;

    console.log(`Job: ${jobInfo.tunedModelDisplayName || jobInfo.h1Name}`);
    console.log(`Submitted: ${jobInfo.submittedAt}`);

    const token = await this.getAccessToken();
    const response = await fetch(`${this.apiEndpoint}/${jobName}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await response.json();

    console.log(`State: ${result.state}`);

    if (result.tunedModel) {
      console.log(`✅ Model ready: ${result.tunedModel.model}`);
      console.log(`   Endpoint: ${result.tunedModel.endpoint}`);

      // Update job file with endpoint
      jobInfo.tunedModel = result.tunedModel;
      jobInfo.completedAt = new Date().toISOString();
      fs.writeFileSync(jobPath, JSON.stringify(jobInfo, null, 2));
    }

    if (result.error) {
      console.log(`❌ Error: ${result.error.message}`);
    }

    return result;
  }

  /**
   * Test trained model
   */
  async testModel(h1Name, testPrompt) {
    const jobPath = path.join(CONFIG.outputPath, `h1_${h1Name}_job.json`);
    if (!fs.existsSync(jobPath)) {
      throw new Error(`No job found for ${h1Name}`);
    }

    const jobInfo = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));
    if (!jobInfo.tunedModel?.endpoint) {
      throw new Error('Model not ready yet. Check status first.');
    }

    const endpoint = jobInfo.tunedModel.endpoint;
    console.log(`Testing model: ${endpoint}\n`);

    // Default test prompt if none provided
    if (!testPrompt) {
      testPrompt = `You are comparing two TikTok clips to assess: Do these belong together? (quality level)

CLIP A:
video_id: test_clip_a
platform: tiktok
humor_type: subversion
replicability_score: 4.0

CLIP B:
video_id: test_clip_b
platform: tiktok
humor_type: observational
replicability_score: 3.5

HUMAN ANNOTATION:
Both clips are well-produced but use different humor styles. Clip A has a clever twist while Clip B relies on relatable situations.

Based on this annotation, which clip better answers the question?`;
    }

    const token = await this.getAccessToken();
    const response = await fetch(`${this.apiEndpoint}/${endpoint}:predict`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instances: [{ content: testPrompt }]
      })
    });

    const result = await response.json();
    console.log('Response:');
    console.log(JSON.stringify(result, null, 2));

    return result;
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const h1Arg = args.find(a => a.startsWith('--h1='));
  const h1Name = h1Arg ? h1Arg.split('=')[1] : null;

  const finetuner = new H1Finetuner();

  switch (command) {
    case 'prepare':
      if (!h1Name) {
        console.error('Usage: node scripts/fine-tune-h1-dpo.js prepare --h1=<name>');
        process.exit(1);
      }
      await finetuner.prepareTrainingData(h1Name);
      break;

    case 'train':
      if (!h1Name) {
        console.error('Usage: node scripts/fine-tune-h1-dpo.js train --h1=<name>');
        process.exit(1);
      }
      await finetuner.submitTuningJob(h1Name);
      break;

    case 'status':
      await finetuner.checkStatus(h1Name);
      break;

    case 'test':
      if (!h1Name) {
        console.error('Usage: node scripts/fine-tune-h1-dpo.js test --h1=<name>');
        process.exit(1);
      }
      await finetuner.testModel(h1Name);
      break;

    default:
      console.log(`
H1 Model Fine-Tuning Pipeline

Usage:
  node scripts/fine-tune-h1-dpo.js <command> [options]

Commands:
  prepare --h1=<name>    Prepare training data from DPO JSONL
  train --h1=<name>      Submit fine-tuning job to Vertex AI
  status [--h1=<name>]   Check job status (all or specific)
  test --h1=<name>       Test trained model

Example:
  node scripts/fine-tune-h1-dpo.js prepare --h1=older_comparison
  node scripts/fine-tune-h1-dpo.js train --h1=older_comparison
  node scripts/fine-tune-h1-dpo.js status --h1=older_comparison
`);
  }
}

main().catch(console.error);
