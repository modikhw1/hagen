#!/usr/bin/env node
/**
 * Test H1 Model with different checkpoints
 *
 * Compares behavior across training checkpoints to find most stable version.
 */

require('dotenv').config({ path: '.env.local' });
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-central1',
  outputPath: path.join(__dirname, '../datasets/fine-tuning')
};

const TEST_PROMPT = `You are comparing two TikTok clips to assess: Do these belong together? (quality level)

CLIP A:
video_id: test_a
platform: tiktok
[HUMOR ANALYSIS]
humor_type: subversion
why_funny: Sets up expectation, delivers twist
[QUALITY SIGNALS]
hook_strength: 7
attention_retention: 8
[OVERALL ASSESSMENT]
sigma_taste_score: 0.7

CLIP B:
video_id: test_b
platform: tiktok
[HUMOR ANALYSIS]
humor_type: relatable
why_funny: Common experience, amusing observation
[QUALITY SIGNALS]
hook_strength: 5
attention_retention: 6
[OVERALL ASSESSMENT]
sigma_taste_score: 0.55

Based on the analysis data above, compare these clips and determine which one ranks higher.

RESPOND IN THIS EXACT FORMAT:
JUDGMENT: [CLIP_A_BETTER | CLIP_B_BETTER | EQUAL]
CONFIDENCE: [0.0-1.0]
REASONING: [2-3 sentences citing specific variables from the data]`;

async function main() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });

  const client = await auth.getClient();
  const { token } = await client.getAccessToken();

  const apiEndpoint = `https://${CONFIG.location}-aiplatform.googleapis.com/v1`;

  // Load job info
  const jobPath = path.join(CONFIG.outputPath, 'h1_older_comparison_job.json');
  const jobInfo = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));

  console.log('=== Testing H1 Model Checkpoints ===\n');

  const checkpoints = jobInfo.tunedModel.checkpoints;

  for (const checkpoint of checkpoints) {
    console.log(`\n--- Checkpoint ${checkpoint.checkpointId} (epoch ${checkpoint.epoch}, step ${checkpoint.step}) ---`);
    console.log(`Endpoint: ${checkpoint.endpoint}`);

    try {
      const url = `${apiEndpoint}/${checkpoint.endpoint}:generateContent`;

      const requestBody = {
        contents: [{
          role: 'user',
          parts: [{ text: TEST_PROMPT }]
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
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Check for repetition loop
      const clipACount = (text.match(/CLIP A/g) || []).length;
      const clipBCount = (text.match(/CLIP B/g) || []).length;
      const hasLoop = clipACount > 3 || clipBCount > 3;

      // Parse judgment
      const judgmentMatch = text.match(/JUDGMENT:\s*(CLIP_A_BETTER|CLIP_B_BETTER|EQUAL)/i);
      const oldFormatA = text.match(/CLIP\s*A\s*ranks?\s*higher/i);
      const oldFormatB = text.match(/CLIP\s*B\s*ranks?\s*higher/i);
      const oldFormatEqual = text.match(/roughly\s*EQUAL|clips\s*are\s*equal/i);

      let judgment = 'UNKNOWN';
      if (judgmentMatch) judgment = judgmentMatch[1].toUpperCase();
      else if (oldFormatA) judgment = 'CLIP_A_BETTER';
      else if (oldFormatB) judgment = 'CLIP_B_BETTER';
      else if (oldFormatEqual) judgment = 'EQUAL';

      console.log(`Status: ${hasLoop ? '❌ Repetition loop' : '✅ Valid response'}`);
      console.log(`Judgment: ${judgment}`);
      console.log(`Response preview: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);

    } catch (error) {
      console.log(`Error: ${error.message}`);
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }
}

main().catch(console.error);
