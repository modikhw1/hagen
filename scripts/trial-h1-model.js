#!/usr/bin/env node
/**
 * Trial H1 Model - Test the trained H1 relational model
 *
 * Usage:
 *   node scripts/trial-h1-model.js --h1=older_comparison
 *   node scripts/trial-h1-model.js --h1=older_comparison --clip-a=<id> --clip-b=<id>
 *   node scripts/trial-h1-model.js --h1=older_comparison --random
 *
 * This script:
 * 1. Loads two clips from the database (random or specified)
 * 2. Formats them with full visual_analysis
 * 3. Calls the trained H1 model
 * 4. Displays the comparison result
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONFIG = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-central1',
  outputPath: path.join(__dirname, '../datasets/fine-tuning')
};

class H1ModelTrial {
  constructor() {
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
   * Get random clip pair
   */
  async getRandomClipPair() {
    const { data: clips, error } = await supabase
      .from('analyzed_videos')
      .select('id, video_id, video_url, platform, visual_analysis')
      .not('visual_analysis', 'is', null)
      .eq('platform', 'tiktok')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !clips || clips.length < 2) {
      throw new Error('Not enough clips with analysis');
    }

    // Pick two random
    const shuffled = clips.sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
  }

  /**
   * Get specific clips by ID
   */
  async getClipsById(clipAId, clipBId) {
    const { data: clips, error } = await supabase
      .from('analyzed_videos')
      .select('id, video_id, video_url, platform, visual_analysis')
      .in('id', [clipAId, clipBId]);

    if (error || !clips || clips.length < 2) {
      throw new Error('Could not find both clips');
    }

    const clipA = clips.find(c => c.id === clipAId);
    const clipB = clips.find(c => c.id === clipBId);
    return [clipA, clipB];
  }

  /**
   * Format clip for prompt (same as export script)
   */
  formatClipForPrompt(clip) {
    const va = clip.visual_analysis || {};
    const lines = [];

    lines.push(`video_id: ${clip.video_id || 'unknown'}`);
    lines.push(`platform: ${clip.platform}`);

    // Content
    if (va.content) {
      lines.push(`\n[Content]`);
      if (va.content.format) lines.push(`format: ${va.content.format}`);
      if (va.content.conceptCore) lines.push(`concept_core: ${va.content.conceptCore}`);
      if (va.content.keyMessage) lines.push(`key_message: ${va.content.keyMessage}`);
      if (va.content.emotionalTone) lines.push(`emotional_tone: ${va.content.emotionalTone}`);
    }

    // Humor
    const humor = va.humor || va.script?.humor;
    if (humor) {
      lines.push(`\n[Humor]`);
      if (humor.humorType) lines.push(`humor_type: ${humor.humorType}`);
      if (humor.humorMechanism) lines.push(`humor_mechanism: ${humor.humorMechanism}`);
      if (humor.whyFunny) lines.push(`why_funny: ${humor.whyFunny}`);
    }

    // Replicability
    if (va.replicability) {
      const rep = va.replicability;
      lines.push(`\n[Replicability]`);
      lines.push(`overall_score: ${rep.overall_replicability_score}`);
      lines.push(`concept_difficulty: ${rep.concept_difficulty}`);
      lines.push(`talent_requirement: ${rep.talent_requirement}`);
    }

    // Quality Signals
    if (va.quality_signals) {
      const qs = va.quality_signals;
      lines.push(`\n[Quality Signals]`);
      lines.push(`hook_strength: ${qs.hook_strength}`);
      lines.push(`attention_retention: ${qs.attention_retention}`);
      if (qs.hook_analysis?.hook_type) lines.push(`hook_type: ${qs.hook_analysis.hook_type}`);
      if (qs.payoff_analysis?.payoff_type) lines.push(`payoff_type: ${qs.payoff_analysis.payoff_type}`);
    }

    // Execution
    if (va.execution_signals) {
      const es = va.execution_signals;
      lines.push(`\n[Execution]`);
      if (es.narrative_flow?.pacing_feel) lines.push(`pacing: ${es.narrative_flow.pacing_feel}`);
      if (es.performer_execution?.presence_score) lines.push(`performer_presence: ${es.performer_execution.presence_score}`);
    }

    // Assessment
    if (va.overall_assessment) {
      lines.push(`\n[Assessment]`);
      if (va.overall_assessment.strengths) {
        lines.push(`strengths: ${va.overall_assessment.strengths.join(', ')}`);
      }
      if (va.overall_assessment.weaknesses) {
        lines.push(`weaknesses: ${va.overall_assessment.weaknesses.join(', ')}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Build comparison prompt with explicit format instructions
   */
  buildPrompt(clipA, clipB, h1Question) {
    const clipAData = this.formatClipForPrompt(clipA);
    const clipBData = this.formatClipForPrompt(clipB);

    return `You are comparing two TikTok clips to assess: ${h1Question}

CLIP A:
${clipAData}

CLIP B:
${clipBData}

Based on the analysis data above, compare these clips and determine which one ranks higher for "${h1Question}".

RESPOND IN THIS EXACT FORMAT:
JUDGMENT: [CLIP_A_BETTER | CLIP_B_BETTER | EQUAL]
CONFIDENCE: [0.0-1.0]
REASONING: [2-3 sentences citing specific variables from the data that support your judgment]`;
  }

  /**
   * Call trained H1 model
   */
  async callH1Model(h1Name, prompt) {
    // Load job info to get model
    const jobPath = path.join(CONFIG.outputPath, `h1_${h1Name}_job.json`);
    if (!fs.existsSync(jobPath)) {
      throw new Error(`No job found for ${h1Name}. Train the model first.`);
    }

    const jobInfo = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));

    // Check job state first
    const token = await this.getAccessToken();
    const statusResponse = await fetch(`${this.apiEndpoint}/${jobInfo.name}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const statusResult = await statusResponse.json();

    if (statusResult.state === 'JOB_STATE_RUNNING') {
      console.log('Job is still training...');
      console.log(`State: ${statusResult.state}`);
      console.log(`Started: ${statusResult.startTime}`);
      console.log(`Updated: ${statusResult.updateTime}`);
      throw new Error('Model is still training. Please wait and try again.');
    }

    if (statusResult.state !== 'JOB_STATE_SUCCEEDED') {
      console.log(`Job state: ${statusResult.state}`);
      if (statusResult.error) {
        console.log(`Error: ${statusResult.error.message}`);
      }
      throw new Error(`Training job not successful. State: ${statusResult.state}`);
    }

    // Check if model is ready
    if (!statusResult.tunedModel?.model) {
      throw new Error('Model path not found in completed job');
    }

    // Update local job file if needed
    if (!jobInfo.tunedModel?.model || jobInfo.state !== statusResult.state) {
      jobInfo.tunedModel = statusResult.tunedModel;
      jobInfo.state = statusResult.state;
      jobInfo.completedAt = new Date().toISOString();
      fs.writeFileSync(jobPath, JSON.stringify(jobInfo, null, 2));
      console.log('Updated local job file with completion info');
    }

    const modelPath = statusResult.tunedModel.model;
    const endpointPath = statusResult.tunedModel.endpoint;
    console.log(`Using tuned model: ${modelPath}`);
    console.log(`Using endpoint: ${endpointPath}\n`);

    // For tuned Gemini models, use the ENDPOINT with generateContent (not the model path)
    const url = `${this.apiEndpoint}/${endpointPath}:generateContent`;

    console.log(`API URL: ${url}`);

    // Use generateContent format with strict output controls
    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.2,      // Lower for consistency
        maxOutputTokens: 300,  // Limit verbosity
        stopSequences: ['CLIP A:', 'CLIP B:', '\n\n\n', '---']  // Prevent loops
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // Read response as text first to handle errors
    const responseText = await response.text();
    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      console.error('API Error Response:', responseText);
      throw new Error(`API call failed: ${response.status} - ${responseText.substring(0, 500)}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse JSON:', responseText.substring(0, 500));
      throw new Error('Invalid JSON response');
    }

    return result;
  }

  /**
   * Run trial comparison
   */
  async runTrial(h1Name, clipAId, clipBId, useRandom) {
    console.log(`\n🧪 H1 Model Trial: ${h1Name}\n`);
    console.log('='.repeat(60));

    // Get clips
    let clipA, clipB;
    if (useRandom || (!clipAId && !clipBId)) {
      console.log('Selecting random clip pair...');
      [clipA, clipB] = await this.getRandomClipPair();
    } else {
      [clipA, clipB] = await this.getClipsById(clipAId, clipBId);
    }

    console.log(`\nCLIP A: ${clipA.video_url}`);
    console.log(`CLIP B: ${clipB.video_url}`);

    // Get H1 question
    const h1Question = 'Do these belong together? (quality level)';

    // Build prompt
    const prompt = this.buildPrompt(clipA, clipB, h1Question);

    console.log('\n' + '-'.repeat(60));
    console.log('PROMPT (truncated):');
    console.log(prompt.substring(0, 500) + '...\n');
    console.log('-'.repeat(60));

    // Call model
    console.log('\nCalling H1 model...\n');

    try {
      const result = await this.callH1Model(h1Name, prompt);

      // Handle both predict and generateContent response formats
      const response = result.predictions?.[0]?.content ||
                       result.predictions?.[0] ||
                       result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (response) {
        console.log('='.repeat(60));
        console.log('H1 MODEL RESPONSE:');
        console.log('='.repeat(60));
        console.log(typeof response === 'string' ? response : JSON.stringify(response, null, 2));
        console.log('='.repeat(60));
      } else {
        console.log('Full response:', JSON.stringify(result, null, 2));
      }

      return { clipA, clipB, response, prompt };
    } catch (error) {
      console.error('Error:', error.message);

      // If model not ready, suggest checking status
      if (error.message.includes('still training')) {
        console.log('\nTo check training status:');
        console.log(`  node scripts/fine-tune-h1-dpo.js status --h1=${h1Name}`);
      }

      throw error;
    }
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  const h1Arg = args.find(a => a.startsWith('--h1='));
  const h1Name = h1Arg ? h1Arg.split('=')[1] : 'older_comparison';

  const clipAArg = args.find(a => a.startsWith('--clip-a='));
  const clipBArg = args.find(a => a.startsWith('--clip-b='));
  const clipAId = clipAArg ? clipAArg.split('=')[1] : null;
  const clipBId = clipBArg ? clipBArg.split('=')[1] : null;

  const useRandom = args.includes('--random');

  const trial = new H1ModelTrial();
  await trial.runTrial(h1Name, clipAId, clipBId, useRandom);
}

main().catch(console.error);
