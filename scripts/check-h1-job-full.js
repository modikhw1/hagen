#!/usr/bin/env node
/**
 * Check full H1 job status from Vertex AI API
 */

require('dotenv').config({ path: '.env.local' });
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-central1'
};

async function main() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });

  const client = await auth.getClient();
  const { token } = await client.getAccessToken();

  const apiEndpoint = `https://${CONFIG.location}-aiplatform.googleapis.com/v1`;

  // Load job info
  const jobPath = path.join(__dirname, '../datasets/fine-tuning/h1_older_comparison_job.json');
  const jobInfo = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));

  console.log('=== Checking Job Status ===\n');
  console.log('Job name:', jobInfo.name);

  // Get full job status
  const jobResponse = await fetch(`${apiEndpoint}/${jobInfo.name}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const jobResult = await jobResponse.json();
  console.log('\n--- Full Job Status ---');
  console.log(JSON.stringify(jobResult, null, 2));

  // If model exists, check model details
  if (jobResult.tunedModel?.model) {
    console.log('\n--- Checking Model Details ---');
    const modelPath = jobResult.tunedModel.model;

    const modelResponse = await fetch(`${apiEndpoint}/${modelPath}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const modelResult = await modelResponse.json();
    console.log('\nModel details:');
    console.log(JSON.stringify(modelResult, null, 2));

    // Check if it has deployedModels
    if (modelResult.deployedModels) {
      console.log('\nDeployed models:');
      for (const deployed of modelResult.deployedModels) {
        console.log(`  Endpoint: ${deployed.endpoint}`);
        console.log(`  Deployed Model ID: ${deployed.deployedModelId}`);
      }
    }
  }

  // List endpoints to find where model might be deployed
  console.log('\n--- Listing All Endpoints ---');
  const endpointsResponse = await fetch(
    `${apiEndpoint}/projects/${CONFIG.projectId}/locations/${CONFIG.location}/endpoints`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  const endpointsResult = await endpointsResponse.json();
  if (endpointsResult.endpoints) {
    for (const ep of endpointsResult.endpoints) {
      console.log(`\nEndpoint: ${ep.name}`);
      console.log(`  Display Name: ${ep.displayName}`);
      if (ep.deployedModels) {
        for (const dm of ep.deployedModels) {
          console.log(`  - Model: ${dm.model}`);
          console.log(`    ID: ${dm.id}`);
        }
      }
    }
  } else {
    console.log('No endpoints found');
    console.log(JSON.stringify(endpointsResult, null, 2));
  }
}

main().catch(console.error);
