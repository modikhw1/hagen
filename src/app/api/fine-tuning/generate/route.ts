import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import { createVideoDownloader } from '@/lib/services/video/downloader';
import { createVideoStorageService } from '@/lib/services/video/storage';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configuration
const DATASET_DIR = path.join(process.cwd(), 'datasets/fine-tuning');
const TUNED_MODEL_FILE = path.join(DATASET_DIR, 'tuned_model.json');

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;
  let gcsUri: string | null = null;

  try {
    const { url, mode = 'concise' } = await req.json();
    if (!url) return NextResponse.json({ error: 'Missing URL' }, { status: 400 });

    // 1. Get Tuned Model ID
    if (!fs.existsSync(TUNED_MODEL_FILE)) {
      return NextResponse.json({ 
        error: 'Tuned model not found. Please wait for training to complete.' 
      }, { status: 503 });
    }
    const modelInfo = JSON.parse(fs.readFileSync(TUNED_MODEL_FILE, 'utf-8'));
    // Use endpoint if available, otherwise fallback to model
    const resourceName = modelInfo.endpoint || modelInfo.model; 

    console.log(`🧪 Using Vertex AI resource: ${resourceName}`);

    // 2. Download Video
    const downloader = createVideoDownloader();
    const tempDir = os.tmpdir();
    console.log(`⬇️ Downloading video from ${url}...`);
    
    const downloadResult = await downloader.download(url, { outputDir: tempDir });
    
    if (!downloadResult.success) {
      console.error('Download failed details:', downloadResult.error);
      // Clean up error message for UI
      const errorMessage = downloadResult.error?.includes('100004') 
        ? 'TikTok blocked the download (Region/Bot protection). Try another video.' 
        : downloadResult.error || 'Failed to download video';
      throw new Error(errorMessage);
    }

    tempFilePath = downloadResult.filePath ?? null;
    
    if (!tempFilePath || !fs.existsSync(tempFilePath)) {
      throw new Error('Download appeared successful but file is missing');
    }

    // 3. Upload to GCS
    const storage = createVideoStorageService();
    const filename = `fine-tuning/lab/lab_${Date.now()}_${path.basename(tempFilePath)}`;
    console.log(`☁️ Uploading to GCS: ${filename}...`);
    
    gcsUri = await storage.upload(tempFilePath, filename);
    console.log(`✅ Uploaded to: ${gcsUri}`);

    // 4. Call Tuned Model (via Vertex AI REST API)
    console.log('🤖 Generating analysis via Vertex AI...');
    
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/${resourceName}:generateContent`;
    
    const PROMPT_DETAILED = `Analysera denna video. Förklara vad som händer och varför det är roligt eller effektivt.

Fokusera på:
1. Vad händer i videon? (Konkret beskrivning)
2. Vad är humormekanismen? (Subversion, timing, kontrast, etc.)
3. Varför fungerar det? (Psykologisk/social förklaring)
4. Vem uppskattar detta? (Målgrupp)`;

    const PROMPT_CONCISE = `Analysera videon kort och koncist.

Format:
**Handling:** [En mening om vad som sker]
**Mekanism:** [Nyckelord: t.ex. Subversion, Igenkänning]
**Varför:** [En mening om poängen]
**Målgrupp:** [Specifik demografi/intresse]

Håll det extremt kort. Inget fluff.`;

    const prompt = mode === 'detailed' ? PROMPT_DETAILED : PROMPT_CONCISE;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { fileData: { mimeType: 'video/mp4', fileUri: gcsUri } },
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('🏁 Finish Reason:', result.candidates?.[0]?.finishReason);
    
    // Extract text from Vertex AI response structure
    // Usually: candidates[0].content.parts[0].text
    const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis generated';

    // 5. Cleanup
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    return NextResponse.json({ 
      analysis, 
      gcsUri,
      model: resourceName.split('/').pop()?.split('@')[0] || 'unknown'
    });

  } catch (error: any) {
    console.error('Generation error:', error);
    
    // Cleanup on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }

    return NextResponse.json({ 
      error: error.message || 'Internal Server Error',
      details: error.toString()
    }, { status: 500 });
  }
}
