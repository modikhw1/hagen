# Deep Video Analysis Setup Guide

## Overview
To get Gemini (or similar AI) to analyze your TikTok videos deeply, you need:
1. **Download the video file** from TikTok
2. **Upload to cloud storage** (Google Cloud Storage for Gemini)
3. **Analyze with Gemini** using the cloud file URI
4. **Combine with your subjective ratings** for rich embeddings

## Architecture

```
TikTok URL
    ↓
[Supadata] → Metadata (views, likes, description, etc.)
    ↓
[Download Service] → Video file (.mp4)
    ↓
[Cloud Storage] → Permanent URI (gs://bucket/video.mp4)
    ↓
[Gemini 2.0] → Deep Analysis
    • Visual: Hook strength, pacing, scene changes, colors
    • Audio: Music type, voiceover, energy level
    • Content: Key moments, emotional tone, editing style
    • Engagement: Predicted virality factors
    ↓
[Combined Data] → Embedding
    • Metadata (what happened externally)
    • AI Analysis (what the content is objectively)
    • Your Ratings (your subjective opinion)
    ↓
[Vector Database] → Similarity search
```

## Required Services

### 1. Video Download Service
**Options:**
- **yt-dlp** (recommended): Works with TikTok, YouTube, Instagram
  ```bash
  npm install @distube/ytdl-core  # or use yt-dlp CLI
  ```
- **Supadata Download API** (if they offer it - check docs)
- **Custom TikTok scraper** (fragile, breaks often)

### 2. Cloud Storage
**For Gemini:**
- **Google Cloud Storage** (required for Gemini File API)
  - Create GCS bucket: `gs://hagen-video-analysis`
  - Service account with Storage Admin role
  - Generate JSON key

**Cost estimate:** 
- Storage: ~$0.02/GB/month (Standard class)
- For 100 videos at ~10MB each = 1GB = **$0.02/month**

**Alternative for local testing:**
- Local file system (for development)
- Gemini can't access local files directly
- Need to use Gemini's File API to upload first

### 3. Gemini API Setup
```bash
# Get API key from: https://makersuite.google.com/app/apikey
export GEMINI_API_KEY="your-key-here"
```

**Models available:**
- `gemini-2.0-flash-exp` - Fast, good for video (current default)
- `gemini-1.5-pro` - More capable, slower
- `gemini-1.5-flash` - Balance of speed/quality

**Cost estimate:**
- Video analysis: ~$0.00025 per second of video
- 15-second TikTok: ~$0.004 per video
- 100 videos: **~$0.40**

## Implementation Steps

### Step 1: Environment Variables
Add to `.env.local`:
```bash
# Existing
SUPADATA_API_KEY=sd_df5b2d402e7c262e614fb62d219b61ea
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# New for Deep Analysis
GEMINI_API_KEY=AIza...
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_STORAGE_BUCKET=hagen-video-analysis
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Optional: Video storage location
VIDEO_STORAGE_PATH=/tmp/hagen-videos  # Local temp storage
```

### Step 2: Install Dependencies
```bash
npm install @google-cloud/storage  # GCS client
npm install @distube/ytdl-core      # Video downloader
npm install @google/generative-ai   # Already installed
```

### Step 3: Code Implementation
See `/src/lib/services/video/` for:
- `downloader.ts` - Download videos from TikTok/YouTube
- `storage.ts` - Upload to Google Cloud Storage
- `gemini.ts` - Already exists, needs integration

### Step 4: Update Workflow
Modified `/feedback` page flow:
1. User enters TikTok URL
2. Fetch metadata (Supadata) - **instant**
3. **[NEW]** Download video - **5-10 seconds**
4. **[NEW]** Upload to GCS - **2-5 seconds**
5. **[NEW]** Analyze with Gemini - **10-20 seconds**
6. User rates video with your subjective opinion
7. Generate embedding combining ALL data:
   - Supadata metadata
   - Gemini visual/audio analysis
   - Your ratings
   - Computed metrics

## Data Structure After Deep Analysis

```typescript
{
  metadata: {
    platform: "tiktok",
    views: 1200000,
    likes: 45000,
    author: "@shelbyscanada",
    // ... from Supadata
  },
  
  visual_analysis: {
    // From Gemini
    visual: {
      hookStrength: 8,
      pacing: "fast",
      sceneChanges: 12,
      colorPalette: ["#FF5722", "#FFC107"],
      dominantElements: ["food", "text overlay", "person"],
      cameraWork: "handheld",
      editingStyle: "quick cuts"
    },
    audio: {
      musicType: "upbeat pop",
      hasVoiceover: true,
      energyLevel: 9,
      audioQuality: 8
    },
    content: {
      mainTopic: "food review",
      emotionalTone: "humorous",
      keyMoments: [
        { timestamp: 0, description: "Hook with question" },
        { timestamp: 3, description: "Product reveal" },
        { timestamp: 8, description: "Reaction shot" }
      ]
    },
    predictions: {
      viralPotential: 7.5,
      targetAudience: ["food lovers", "millennials"],
      engagementFactors: ["humor", "relatability", "quick pacing"]
    }
  },
  
  user_ratings: {
    // Your subjective opinion
    overall_rating: 7,
    hook_strength: 8,
    would_replicate: true,
    // ... evolving schema
  },
  
  content_embedding: [...1536 dimensions...],
  // Embedding combines ALL above data
}
```

## Simplified Alternative: Skip Download

If you want to start **without** video download/storage:

### Option A: Use Gemini with uploaded files
```typescript
// User manually uploads video file via browser
const uploadedFile = await uploadToGemini(file)
// Analyze it
const analysis = await gemini.analyzeVideo(uploadedFile.uri)
```

### Option B: Use OpenAI Vision on thumbnails
```typescript
// Analyze just the thumbnail image (much simpler)
const analysis = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Analyze this video thumbnail..." },
      { type: "image_url", image_url: { url: thumbnailUrl }}
    ]
  }]
})
```
**Limitation:** Only sees single frame, not full video content

### Option C: Use transcript-based analysis (current)
```typescript
// Already implemented!
// Supadata provides AI-generated transcripts
const transcript = await supadata.fetchTranscript(url)
const analysis = await openai.analyze(transcript + metadata)
```
**Limitation:** No visual/audio analysis, only what was said

## Recommended Approach

**For MVP (current):**
1. ✅ Use Supadata metadata + transcripts
2. ✅ Your subjective ratings
3. ✅ Generate embeddings
4. ✅ Find similar videos
5. Skip video download for now

**For Full System (when you have 50+ rated videos):**
1. Set up Google Cloud Storage
2. Implement video download service
3. Integrate Gemini deep analysis
4. Re-analyze your existing videos
5. Regenerate embeddings with richer data
6. Much better similarity matching

## Cost Comparison

| Approach | Setup Effort | Monthly Cost | Data Richness |
|----------|-------------|--------------|---------------|
| Current (metadata only) | ✅ Done | $0 | ⭐⭐ |
| + Transcripts | ✅ Done | $0 | ⭐⭐⭐ |
| + Thumbnail analysis | 1 hour | ~$1 | ⭐⭐⭐ |
| + Full video (Gemini) | 4-6 hours | ~$5 | ⭐⭐⭐⭐⭐ |

## Next Steps

**Immediate (no setup needed):**
1. ✅ Keep using current system
2. Rate 20-30 more videos to build dataset
3. Test pattern discovery with existing data

**When ready for deep analysis:**
1. Create Google Cloud project
2. Set up Cloud Storage bucket
3. Get Gemini API key
4. Run the video pipeline setup script
5. Test on 5-10 videos
6. Batch re-analyze your library

Would you like me to implement the full video download + Gemini pipeline now, or continue with the current approach and add it later?
