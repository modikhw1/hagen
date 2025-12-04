/**
 * V3.5 Humor Analysis API
 * 
 * Downloads a TikTok video and runs it through the v3.5 teaching prompt
 * for humor structure recognition
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

// V3.5 Teaching Prompt - Humor Analysis
const V35_PROMPT = `# V3.5 HUMOR ANALYSIS

You are an expert analyst of short-form comedy videos, specifically TikTok skits made by or for small businesses (restaurants, cafés, bars). Your task is to:

1. **WATCH the video carefully** - every frame matters
2. **IDENTIFY the humor mechanism** - WHY is this supposed to be funny?
3. **DESCRIBE the joke structure** - setup, twist, payoff
4. **RATE engagement potential** - would viewers watch again, share, relate?

**CRITICAL**: The humor often comes from VISUALS, not dialogue. If talking stops before the payoff, the punchline is likely VISUAL. Describe what you SEE, not just what you hear.

---

## HUMOR TAXONOMY (10 Types)

1. **WORDPLAY / PUNS**: Joke relies on a word having two meanings. Example: "Short-staffed" → Staff are literally short physically.

2. **VISUAL PUNCHLINE**: Payoff is SHOWN, not spoken. If talking stops and camera shows something unexpected → that's THE joke.

3. **SUBVERSION / MISDIRECTION**: Setup creates expectation, payoff delivers opposite. Ask "What did I expect?" vs "What happened?"

4. **EXAGGERATED REACTION**: Someone responds far more intensely than situation warrants. Small trigger → huge response. The reaction IS the joke.

5. **ABSURDIST / SURREAL**: Things that couldn't happen in reality, logical impossibilities.

6. **RELATABLE EXAGGERATION**: Common experience amplified to extreme. "I've felt this, but not THIS much."

7. **CONTRAST / JUXTAPOSITION**: Unexpected pairings of emotion, behavior, or context.

8. **DEADPAN / UNDERSTATED**: Flat, emotionless delivery of something absurd. The LACK of reaction is the joke.

9. **ESCALATION / PATTERN BREAK**: Something repeats 2-3 times → 4th time is different. The break IS the joke.

10. **GENERATIONAL / CULTURAL REFERENCE**: Humor depends on understanding specific cultural meaning.

---

## DETECTION RULES

1. **Silence Before Payoff = Visual Joke**: If dialogue stops and camera shows something, that visual IS the punchline.

2. **Word Emphasis = Check for Pun**: If a word is emphasized or in text overlay, check for double meanings.

3. **Exaggerated Response = Reaction IS the Joke**: Don't focus on trigger, focus on the performance.

4. **Abrupt Cuts = Edit-Based Humor**: Hard cuts with music stops are often THE punchline.

5. **Service Industry Context = Look for Subtext**: Fake smiles, overly polite responses = the joke is the gap between performance and reality.

6. **Pattern of 2-3 = Expect Break on 4th**: The break IS the joke.

7. **Cultural Markers = Different Meanings**: Gestures, slang may have different meanings to different groups.

8. **Find the Tension**: The gap between what would NORMALLY happen and what actually happens = where the humor lives.

---

## ANNOTATED EXAMPLES

**Example 1: "Short-Staffed"**
Video: Cashier says "we're short-staffed today" → Cut to coworker struggling to reach high shelf
WRONG: "Shows the challenges of being understaffed"
CORRECT: "Visual pun - 'short-staffed' literally means the staff are physically short. This is WORDPLAY with a VISUAL PUNCHLINE."

**Example 2: "Peace Sign Confusion"**
Video: Chef holds up two fingers → young servers respond with peace signs and poses
WRONG: "Shows Gen Z dancing and having fun at work"
CORRECT: "Generational misunderstanding - ✌️ means '2' (table number) to older chef, but 'kawaii peace sign' to Gen Z servers."

**Example 3: "Server Smile Drop"**
Video: Server approaches smiling → Smile drops instantly → Walks to different table
WRONG: "Waiter bringing food to customers"
CORRECT: "Visual punchline through deadpan - the INSTANT the smile disappears is the joke. The timing IS the comedy."

**Example 4: "Old Timey Jokes"**
Video: Customer makes dad jokes → Server gives increasingly exaggerated fake laughs
WRONG: "Customer making jokes, server responds"
CORRECT: "The humor is the server's RESISTANCE through obviously fake laughs. It's passive-aggressive customer service."

---

## YOUR TASK

Watch this video and provide analysis in JSON format:

{
  "joke_structure": {
    "setup": "What establishes the premise (first 1-3 seconds)",
    "mechanism": "The specific technique creating humor (from taxonomy above)",
    "twist": "What changes or is revealed",
    "payoff": "The punchline - is it VISUAL, VERBAL, or EDIT-BASED?",
    "payoff_type": "visual-reveal | verbal | edit-cut | reaction | contrast"
  },
  "humor_analysis": {
    "primary_type": "One of the 10 taxonomy types",
    "secondary_type": "If applicable, or null",
    "why_funny": "2-3 sentences explaining the MECHANISM, not just describing what happens",
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
  "reasoning": "Specific description of THIS video and why you gave these scores. Be detailed about what you see."
}

IMPORTANT: 
- Respond with ONLY valid JSON (no markdown code blocks)
- Be SPECIFIC about what happens in THIS video
- Identify the humor MECHANISM, not just describe events
- If there's a pun or wordplay, EXPLAIN IT`;

/**
 * Download video using yt-dlp
 */
async function downloadVideo(url: string): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  const outputDir = '/tmp/hagen-v35';
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
      try {
        await fs.unlink(outputPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  };
}

/**
 * Upload to Gemini File API and wait for processing
 */
async function uploadToGemini(filePath: string): Promise<string> {
  const fileManager = new GoogleAIFileManager(GEMINI_API_KEY);

  console.log('📤 Uploading to Gemini File API...');

  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType: 'video/mp4',
    displayName: `v35-analysis-${Date.now()}`
  });

  let file = uploadResult.file;
  console.log(`📁 File uploaded: ${file.name}, state: ${file.state}`);

  // Wait for processing
  while (file.state === FileState.PROCESSING) {
    console.log('⏳ Processing video...');
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
 * Analyze with Gemini using v3.5 prompt
 */
async function analyzeWithGemini(fileUri: string): Promise<any> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  console.log('🎬 Running v3.5 analysis...');

  const result = await model.generateContent([
    {
      fileData: {
        mimeType: 'video/mp4',
        fileUri: fileUri
      }
    },
    { text: V35_PROMPT }
  ]);

  const responseText = result.response.text();
  
  // Try to parse JSON from response
  try {
    // Remove markdown code blocks if present
    const cleaned = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
    return JSON.parse(cleaned);
  } catch (e) {
    // Return raw text if parsing fails
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

    // Validate URL (TikTok, YouTube, etc.)
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

    // Step 3: Analyze with v3.5 prompt
    const analysis = await analyzeWithGemini(fileUri);

    // Cleanup downloaded file
    await cleanup();

    return NextResponse.json({
      success: true,
      url,
      analysis,
      model: 'gemini-2.0-flash-exp',
      prompt_version: 'v3.5'
    });

  } catch (err) {
    console.error('V3.5 Analysis error:', err);
    
    // Cleanup on error
    if (cleanup) {
      try { await cleanup(); } catch (e) {}
    }

    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Analysis failed',
      details: err instanceof Error ? err.stack : undefined
    }, { status: 500 });
  }
}
