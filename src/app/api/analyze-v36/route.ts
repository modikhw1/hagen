/**
 * V3.6 RAG-Enhanced Humor Analysis API
 * 
 * Downloads video, finds similar rated videos, includes human notes in prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// V3.6 Base Teaching Prompt
const V36_BASE_PROMPT = `# V3.6 HUMOR ANALYSIS (RAG-Enhanced)

You are an expert analyst of short-form comedy videos, specifically TikTok skits made by or for small businesses. Your task is to:

1. **WATCH the video carefully** - every frame matters
2. **IDENTIFY the humor mechanism** - WHY is this supposed to be funny?
3. **DESCRIBE the joke structure** - setup, twist, payoff
4. **RATE engagement potential** - would viewers watch again, share, relate?

**CRITICAL**: The humor often comes from VISUALS, not dialogue. If talking stops before the payoff, the punchline is likely VISUAL.

---

## HUMOR TAXONOMY (10 Types)

1. **WORDPLAY / PUNS**: Joke relies on a word having two meanings.
2. **VISUAL PUNCHLINE**: Payoff is SHOWN, not spoken.
3. **SUBVERSION / MISDIRECTION**: Setup creates expectation, payoff delivers opposite.
4. **EXAGGERATED REACTION**: Someone responds far more intensely than situation warrants.
5. **ABSURDIST / SURREAL**: Things that couldn't happen in reality.
6. **RELATABLE EXAGGERATION**: Common experience amplified to extreme.
7. **CONTRAST / JUXTAPOSITION**: Unexpected pairings of emotion, behavior, or context.
8. **DEADPAN / UNDERSTATED**: Flat, emotionless delivery of something absurd.
9. **ESCALATION / PATTERN BREAK**: Something repeats 2-3 times → 4th time is different.
10. **GENERATIONAL / CULTURAL REFERENCE**: Humor depends on understanding specific cultural meaning.

---

## DETECTION RULES

1. Silence Before Payoff = Visual Joke
2. Word Emphasis = Check for Pun
3. Exaggerated Response = Reaction IS the Joke
4. Abrupt Cuts = Edit-Based Humor
5. Service Industry Context = Look for Subtext
6. Pattern of 2-3 = Expect Break on 4th
7. Cultural Markers = Different Meanings
8. Find the Tension between expectation and reality`;

const V36_OUTPUT_FORMAT = `
---

## YOUR TASK

Watch this video and provide analysis in JSON format:

{
  "joke_structure": {
    "setup": "What establishes the premise (first 1-3 seconds)",
    "mechanism": "The specific technique creating humor",
    "twist": "What changes or is revealed",
    "payoff": "The punchline - is it VISUAL, VERBAL, or EDIT-BASED?",
    "payoff_type": "visual-reveal | verbal | edit-cut | reaction | contrast"
  },
  "humor_analysis": {
    "primary_type": "One of the 10 taxonomy types",
    "secondary_type": "If applicable, or null",
    "why_funny": "2-3 sentences explaining the MECHANISM",
    "what_could_be_missed": "Potential misinterpretation to avoid"
  },
  "scores": {
    "hook": 0.0-1.0,
    "pacing": 0.0-1.0,
    "originality": 0.0-1.0,
    "payoff": 0.0-1.0,
    "rewatchable": 0.0-1.0,
    "overall": 0.0-1.0
  },
  "reasoning": "Specific description of THIS video and why you gave these scores",
  "similar_to": "Which reference video (if any) this is most similar to"
}

IMPORTANT: Respond with ONLY valid JSON (no markdown code blocks)`;

/**
 * Download video using yt-dlp
 */
async function downloadVideo(url: string): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  const outputDir = '/tmp/hagen-v36';
  await fs.mkdir(outputDir, { recursive: true });

  const filename = `video_${Date.now()}.mp4`;
  const outputPath = path.join(outputDir, filename);

  console.log(`📥 Downloading: ${url}`);

  const command = [
    'python3', '-m', 'yt_dlp',
    '--no-playlist',
    '--format', 'best[ext=mp4]/best',
    '--max-filesize', '50M',
    '--output', outputPath,
    '--no-warnings',
    '--quiet',
    url
  ].join(' ');

  await execAsync(command, { timeout: 60000 });

  const stats = await fs.stat(outputPath);
  console.log(`✅ Downloaded: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  return {
    filePath: outputPath,
    cleanup: async () => {
      try { await fs.unlink(outputPath); } catch (e) {}
    }
  };
}

/**
 * Upload to Gemini File API
 */
async function uploadToGemini(filePath: string): Promise<string> {
  const fileManager = new GoogleAIFileManager(GEMINI_API_KEY);

  console.log('📤 Uploading to Gemini...');

  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType: 'video/mp4',
    displayName: `v36-analysis-${Date.now()}`
  });

  let file = uploadResult.file;

  while (file.state === FileState.PROCESSING) {
    console.log('⏳ Processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const getResult = await fileManager.getFile(file.name);
    file = getResult;
  }

  if (file.state === FileState.FAILED) {
    throw new Error('Gemini file processing failed');
  }

  console.log(`✅ File ready: ${file.uri}`);
  return file.uri;
}

/**
 * Get quick description from Gemini for embedding
 */
async function getQuickDescription(fileUri: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const result = await model.generateContent([
    { fileData: { mimeType: 'video/mp4', fileUri } },
    { text: 'Describe this video in 2-3 sentences. What happens? What is the joke or main content?' }
  ]);

  return result.response.text();
}

/**
 * Find similar videos using embeddings
 */
async function findSimilarVideos(description: string, limit: number = 5): Promise<any[]> {
  try {
    // Generate embedding for the description
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: description,
      encoding_format: 'float'
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search using Supabase RPC (find_similar_videos function)
    // Note: threshold is cosine DISTANCE, so 0.8 allows up to 80% distance (fairly permissive)
    const { data: similarVideos, error } = await supabase.rpc('find_similar_videos', {
      query_embedding: queryEmbedding,
      match_threshold: 0.8,  // Allow fairly distant matches
      match_count: limit
    });

    if (error) {
      console.error('Similarity search error:', error);
      return [];
    }

    // Get ratings for similar videos
    if (similarVideos && similarVideos.length > 0) {
      const videoIds = similarVideos.map((v: any) => v.id);
      const { data: ratings } = await supabase
        .from('video_ratings')
        .select('video_id, overall_score, notes, humor_type, scores')
        .in('video_id', videoIds);

      const ratingsMap: Record<string, any> = {};
      ratings?.forEach((r: any) => {
        ratingsMap[r.video_id] = r;
      });

      // Merge ratings into videos
      return similarVideos.map((v: any) => ({
        ...v,
        rating: ratingsMap[v.id] || null
      }));
    }

    return [];
  } catch (err) {
    console.error('Error finding similar videos:', err);
    return [];
  }
}

/**
 * Build RAG context from similar videos
 */
function buildRAGContext(similarVideos: any[]): string {
  if (!similarVideos || similarVideos.length === 0) {
    return '';
  }

  const examples = similarVideos
    .filter(v => v.rating?.notes)
    .slice(0, 5)
    .map((v, i) => {
      const title = v.metadata?.title || 'Untitled';
      const score = v.rating?.overall_score || 'N/A';
      const notes = v.rating?.notes || 'No notes';
      const humorType = v.rating?.humor_type || 'Unknown';
      const similarity = ((v.similarity || 0) * 100).toFixed(0);

      return `### Reference ${i + 1}: "${title}" (${similarity}% similar)
**Score**: ${score}/10
**Humor Type**: ${humorType}
**Expert Notes**: ${notes}`;
    })
    .join('\n\n');

  if (!examples) return '';

  return `
---

## REFERENCE VIDEOS (Similar to what you're analyzing)

These are videos an expert has already rated. Use their notes to guide your analysis:

${examples}

---

**IMPORTANT**: Use these reference videos to calibrate your analysis. If the current video uses similar humor mechanics, apply similar scoring logic.`;
}

/**
 * Analyze with Gemini using v3.6 RAG-enhanced prompt
 */
async function analyzeWithGemini(fileUri: string, ragContext: string): Promise<any> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const fullPrompt = V36_BASE_PROMPT + ragContext + V36_OUTPUT_FORMAT;

  console.log('🎬 Running v3.6 RAG analysis...');
  console.log(`📝 Prompt size: ~${(fullPrompt.length / 4).toFixed(0)} tokens`);

  const result = await model.generateContent([
    { fileData: { mimeType: 'video/mp4', fileUri } },
    { text: fullPrompt }
  ]);

  const responseText = result.response.text();

  try {
    const cleaned = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return { raw_response: responseText, parse_error: true };
  }
}

export async function POST(request: NextRequest) {
  let cleanup: (() => Promise<void>) | null = null;

  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    const validDomains = ['tiktok.com', 'youtube.com', 'youtu.be', 'instagram.com'];
    const urlObj = new URL(url);
    const isValid = validDomains.some(d => urlObj.hostname.includes(d));

    if (!isValid) {
      return NextResponse.json(
        { error: 'Only TikTok, YouTube, and Instagram URLs are supported' },
        { status: 400 }
      );
    }

    // Step 1: Download video
    const download = await downloadVideo(url);
    cleanup = download.cleanup;

    // Step 2: Upload to Gemini
    const fileUri = await uploadToGemini(download.filePath);

    // Step 3: Get quick description for similarity search
    console.log('🔍 Getting video description for RAG...');
    const description = await getQuickDescription(fileUri);

    // Step 4: Find similar rated videos
    console.log('🔎 Searching for similar rated videos...');
    const similarVideos = await findSimilarVideos(description, 5);
    console.log(`📊 Found ${similarVideos.length} similar videos`);

    // Step 5: Build RAG context
    const ragContext = buildRAGContext(similarVideos);

    // Step 6: Analyze with v3.6 prompt
    const analysis = await analyzeWithGemini(fileUri, ragContext);

    // Cleanup
    await cleanup();

    return NextResponse.json({
      success: true,
      url,
      analysis,
      rag_context: {
        similar_count: similarVideos.length,
        references: similarVideos.map(v => ({
          title: v.metadata?.title,
          score: v.rating?.overall_score,
          similarity: v.similarity,
          notes_preview: v.rating?.notes?.substring(0, 100)
        }))
      },
      model: 'gemini-2.0-flash-exp',
      prompt_version: 'v3.6'
    });

  } catch (err) {
    console.error('V3.6 Analysis error:', err);
    if (cleanup) { try { await cleanup(); } catch (e) {} }

    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Analysis failed'
    }, { status: 500 });
  }
}
