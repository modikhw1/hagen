#!/usr/bin/env node
/**
 * Evaluate H1 Model - Batch evaluation of trained H1 relational model
 *
 * Usage:
 *   node scripts/evaluate-h1-model.js --h1=older_comparison
 *   node scripts/evaluate-h1-model.js --h1=older_comparison --pairs=10
 *   node scripts/evaluate-h1-model.js --h1=older_comparison --runs=3
 *
 * This script:
 * 1. Loads holdout pairs from training data
 * 2. Runs the model on each pair (multiple times for consistency check)
 * 3. Compares model judgment to human annotation
 * 4. Outputs agreement and consistency metrics
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

class H1ModelEvaluator {
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
   * Load training data and extract pairs with human judgments
   */
  loadTrainingPairs(h1Name) {
    const dpoPath = path.join(CONFIG.outputPath, `h1_${h1Name}_dpo.jsonl`);
    if (!fs.existsSync(dpoPath)) {
      throw new Error(`Training data not found: ${dpoPath}`);
    }

    const lines = fs.readFileSync(dpoPath, 'utf-8').trim().split('\n');
    const pairs = [];

    for (const line of lines) {
      const ex = JSON.parse(line);
      const humanJudgment = this.parseHumanJudgment(ex.chosen);
      const confidence = this.parseConfidence(ex.chosen);

      // Extract video IDs from prompt
      const clipAMatch = ex.prompt.match(/CLIP A:\nvideo_id: ([^\n]+)/);
      const clipBMatch = ex.prompt.match(/CLIP B:\nvideo_id: ([^\n]+)/);

      pairs.push({
        prompt: ex.prompt,
        humanJudgment,
        humanConfidence: confidence,
        clipAId: clipAMatch ? clipAMatch[1] : 'unknown',
        clipBId: clipBMatch ? clipBMatch[1] : 'unknown',
        chosenResponse: ex.chosen
      });
    }

    return pairs;
  }

  /**
   * Parse human judgment from chosen response
   */
  parseHumanJudgment(chosen) {
    if (chosen.includes('roughly EQUAL')) return 'EQUAL';
    if (chosen.includes('CLIP A ranks higher')) return 'CLIP_A_BETTER';
    if (chosen.includes('CLIP B ranks higher')) return 'CLIP_B_BETTER';
    return 'UNKNOWN';
  }

  /**
   * Parse confidence from chosen response
   */
  parseConfidence(chosen) {
    const match = chosen.match(/Confidence:\s*([\d.]+)/i);
    return match ? parseFloat(match[1]) : 0.5;
  }

  /**
   * Parse model judgment from response (handles both old and new formats)
   */
  parseModelJudgment(response) {
    if (!response) return { judgment: 'PARSE_ERROR', confidence: 0, reasoning: '' };

    // Check for repetition loop (strong signal of failure)
    if ((response.match(/CLIP A/g) || []).length > 3 || (response.match(/CLIP B/g) || []).length > 3) {
      return { judgment: 'PARSE_ERROR', confidence: 0, reasoning: 'Repetition loop detected' };
    }

    // NEW FORMAT: JUDGMENT: XXX
    const newFormatMatch = response.match(/JUDGMENT:\s*(CLIP_A_BETTER|CLIP_B_BETTER|EQUAL)/i);
    if (newFormatMatch) {
      const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i);
      const reasoningMatch = response.match(/REASONING:\s*(.+)/is);
      return {
        judgment: newFormatMatch[1].toUpperCase(),
        confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
        reasoning: reasoningMatch ? reasoningMatch[1].trim().substring(0, 200) : ''
      };
    }

    // OLD FORMAT: "CLIP A ranks higher" or "These clips are roughly EQUAL"
    const clipARanksMatch = response.match(/CLIP\s*A\s*ranks?\s*higher/i);
    const clipBRanksMatch = response.match(/CLIP\s*B\s*ranks?\s*higher/i);
    const equalMatch = response.match(/roughly\s*EQUAL|clips\s*are\s*equal|EQUAL\s*on\s*this/i);

    // Parse confidence from old format
    const confidenceMatch = response.match(/Confidence:\s*([\d.]+)/i);
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;

    // Extract reasoning (everything after first line until Confidence)
    const reasoningMatch = response.match(/Reasoning:\s*([^]*?)(?=Confidence:|$)/i);
    const reasoning = reasoningMatch ? reasoningMatch[1].trim().substring(0, 200) : response.substring(0, 200);

    if (equalMatch) {
      return { judgment: 'EQUAL', confidence, reasoning };
    }
    if (clipARanksMatch) {
      return { judgment: 'CLIP_A_BETTER', confidence, reasoning };
    }
    if (clipBRanksMatch) {
      return { judgment: 'CLIP_B_BETTER', confidence, reasoning };
    }

    return { judgment: 'PARSE_ERROR', confidence: 0, reasoning: response.substring(0, 200) };
  }

  /**
   * Call trained H1 model
   */
  async callH1Model(h1Name, prompt, checkpointId = null) {
    const jobPath = path.join(CONFIG.outputPath, `h1_${h1Name}_job.json`);
    if (!fs.existsSync(jobPath)) {
      throw new Error(`No job found for ${h1Name}. Train the model first.`);
    }

    const jobInfo = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));
    const token = await this.getAccessToken();

    // Get endpoint - use checkpoint if specified, otherwise final model
    let endpointPath;
    if (checkpointId && jobInfo.tunedModel?.checkpoints) {
      const checkpoint = jobInfo.tunedModel.checkpoints.find(c => c.checkpointId === checkpointId);
      if (checkpoint) {
        endpointPath = checkpoint.endpoint;
      }
    }
    if (!endpointPath) {
      endpointPath = jobInfo.tunedModel?.endpoint;
    }
    if (!endpointPath) {
      throw new Error('Model endpoint not found in job info');
    }

    // Modify prompt to use new format instruction
    const formattedPrompt = prompt.replace(
      /Compare these clips and determine which one ranks higher.*$/s,
      `Based on the analysis data above, compare these clips and determine which one ranks higher.

RESPOND IN THIS EXACT FORMAT:
JUDGMENT: [CLIP_A_BETTER | CLIP_B_BETTER | EQUAL]
CONFIDENCE: [0.0-1.0]
REASONING: [2-3 sentences citing specific variables from the data that support your judgment]`
    );

    const url = `${this.apiEndpoint}/${endpointPath}:generateContent`;
    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: formattedPrompt }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 300,
        stopSequences: ['CLIP A:', 'CLIP B:', '\n\n\n', '---']
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

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Run evaluation
   */
  async runEvaluation(h1Name, numPairs = 15, runsPerPair = 3, checkpointId = null) {
    console.log(`\n🔬 H1 Model Evaluation: ${h1Name}${checkpointId ? ` (checkpoint ${checkpointId})` : ''}\n`);
    console.log('═'.repeat(60));

    // Load training pairs
    const allPairs = this.loadTrainingPairs(h1Name);
    console.log(`Loaded ${allPairs.length} training pairs`);

    // Select holdout set (last N pairs or random)
    const holdoutPairs = allPairs.slice(-numPairs);
    console.log(`Using ${holdoutPairs.length} pairs for evaluation\n`);

    const results = [];
    let agreementCount = 0;
    let consistencyCount = 0;
    let parseErrorCount = 0;

    for (let i = 0; i < holdoutPairs.length; i++) {
      const pair = holdoutPairs[i];
      console.log(`\nPair ${i + 1}/${holdoutPairs.length}: ${pair.clipAId} vs ${pair.clipBId}`);
      console.log(`  Human: ${pair.humanJudgment} (${pair.humanConfidence})`);

      // Run model multiple times
      const modelRuns = [];
      for (let run = 0; run < runsPerPair; run++) {
        try {
          const response = await this.callH1Model(h1Name, pair.prompt, checkpointId);
          const parsed = this.parseModelJudgment(response);
          modelRuns.push(parsed);

          // Small delay between runs to avoid rate limits
          await new Promise(r => setTimeout(r, 500));
        } catch (error) {
          console.log(`    Run ${run + 1}: ERROR - ${error.message}`);
          modelRuns.push({ judgment: 'ERROR', confidence: 0, reasoning: error.message });
        }
      }

      // Check consistency (all runs same judgment)
      const judgments = modelRuns.map(r => r.judgment);
      const isConsistent = judgments.every(j => j === judgments[0]);
      const majorityJudgment = this.getMajorityJudgment(judgments);

      // Check agreement with human
      const agrees = majorityJudgment === pair.humanJudgment;

      // Count parse errors
      const hasParseError = judgments.some(j => j === 'PARSE_ERROR' || j === 'ERROR');

      if (isConsistent) consistencyCount++;
      if (agrees) agreementCount++;
      if (hasParseError) parseErrorCount++;

      // Display result
      const icon = agrees ? '✅' : '❌';
      const consistIcon = isConsistent ? '🔄' : '⚠️';
      console.log(`  Model: ${majorityJudgment} ${icon} ${consistIcon}`);
      console.log(`  Runs: ${judgments.join(', ')}`);
      if (modelRuns[0]?.reasoning) {
        console.log(`  Reasoning: ${modelRuns[0].reasoning.substring(0, 100)}...`);
      }

      results.push({
        pair,
        modelRuns,
        majorityJudgment,
        isConsistent,
        agrees
      });
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 EVALUATION SUMMARY\n');
    console.log(`Pairs tested: ${holdoutPairs.length}`);
    console.log(`Agreement with human: ${agreementCount}/${holdoutPairs.length} (${(agreementCount/holdoutPairs.length*100).toFixed(1)}%)`);
    console.log(`Consistency (${runsPerPair}x runs): ${consistencyCount}/${holdoutPairs.length} (${(consistencyCount/holdoutPairs.length*100).toFixed(1)}%)`);
    console.log(`Parse errors: ${parseErrorCount}/${holdoutPairs.length}`);

    // Judgment distribution
    const humanDist = this.getDistribution(holdoutPairs.map(p => p.humanJudgment));
    const modelDist = this.getDistribution(results.map(r => r.majorityJudgment));

    console.log('\nJudgment Distribution:');
    console.log(`  Human: A_BETTER=${humanDist.CLIP_A_BETTER || 0}, B_BETTER=${humanDist.CLIP_B_BETTER || 0}, EQUAL=${humanDist.EQUAL || 0}`);
    console.log(`  Model: A_BETTER=${modelDist.CLIP_A_BETTER || 0}, B_BETTER=${modelDist.CLIP_B_BETTER || 0}, EQUAL=${modelDist.EQUAL || 0}`);

    // Success/Failure determination
    console.log('\n' + '═'.repeat(60));
    const agreementRate = agreementCount / holdoutPairs.length;
    const consistencyRate = consistencyCount / holdoutPairs.length;

    if (agreementRate >= 0.7 && consistencyRate >= 0.8) {
      console.log('🟢 EVALUATION: PROMISING');
      console.log('Model shows good agreement and consistency.');
      console.log('Recommend: Continue with more training data and additional H1 dimensions.');
    } else if (agreementRate >= 0.5 || consistencyRate >= 0.6) {
      console.log('🟡 EVALUATION: NEEDS IMPROVEMENT');
      console.log('Model shows some learning but needs refinement.');
      console.log('Recommend: Review training data quality, consider more examples.');
    } else {
      console.log('🔴 EVALUATION: INSUFFICIENT');
      console.log('Model not reliably replicating human judgment.');
      console.log('Recommend: Revisit training approach or data format.');
    }

    // Save results
    const resultsPath = path.join(CONFIG.outputPath, `h1_${h1Name}_eval_results.json`);
    fs.writeFileSync(resultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      h1Name,
      numPairs: holdoutPairs.length,
      runsPerPair,
      agreementRate,
      consistencyRate,
      parseErrorRate: parseErrorCount / holdoutPairs.length,
      results
    }, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);

    return { agreementRate, consistencyRate, results };
  }

  /**
   * Get majority judgment from multiple runs
   */
  getMajorityJudgment(judgments) {
    const counts = {};
    for (const j of judgments) {
      counts[j] = (counts[j] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Get distribution of judgments
   */
  getDistribution(judgments) {
    const dist = {};
    for (const j of judgments) {
      dist[j] = (dist[j] || 0) + 1;
    }
    return dist;
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  const h1Arg = args.find(a => a.startsWith('--h1='));
  const h1Name = h1Arg ? h1Arg.split('=')[1] : 'older_comparison';

  const pairsArg = args.find(a => a.startsWith('--pairs='));
  const numPairs = pairsArg ? parseInt(pairsArg.split('=')[1]) : 15;

  const runsArg = args.find(a => a.startsWith('--runs='));
  const runsPerPair = runsArg ? parseInt(runsArg.split('=')[1]) : 3;

  const checkpointArg = args.find(a => a.startsWith('--checkpoint='));
  const checkpointId = checkpointArg ? checkpointArg.split('=')[1] : null;

  const evaluator = new H1ModelEvaluator();
  await evaluator.runEvaluation(h1Name, numPairs, runsPerPair, checkpointId);
}

main().catch(console.error);
