# Deep Analysis Setup - Quick Start

## ✅ Completed Steps

### 1. Dependencies Installed
- ✅ **yt-dlp** (2024.04.09) - For downloading TikTok/YouTube videos
- ✅ **@google-cloud/storage** - For uploading to Google Cloud Storage
- ✅ **@google/generative-ai** - Already installed for Gemini API

### 2. Code Created
- ✅ Video downloader service (`/src/lib/services/video/downloader.ts`)
- ✅ Cloud storage service (`/src/lib/services/video/storage.ts`)
- ✅ Deep analysis API (`/src/app/api/videos/analyze/deep/route.ts`)
- ✅ UI component (`/src/components/features/DeepAnalysisButton.tsx`)

## 🔑 Next: Get API Keys

### Step 1: Get Gemini API Key (Required)

1. Go to: https://makersuite.google.com/app/apikey
2. Click "Get API Key"
3. Create a new API key or use existing project
4. Copy the key (starts with `AIza...`)

### Step 2: Add to Environment Variables

Add to `.env.local`:
\`\`\`bash
# Deep Video Analysis
GEMINI_API_KEY=AIzaSy...your_key_here

# Optional: For permanent video storage (can skip for now)
# GOOGLE_CLOUD_PROJECT_ID=your-project-id
# GOOGLE_CLOUD_STORAGE_BUCKET=hagen-video-analysis
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
\`\`\`

### Step 3: Restart Development Server

\`\`\`bash
# Kill existing server
pkill -f next

# Start fresh
npm run dev
\`\`\`

### Step 4: Test the Setup

Visit http://localhost:3000/api/videos/analyze/deep to check configuration:

\`\`\`bash
curl http://localhost:3000/api/videos/analyze/deep | jq
\`\`\`

Expected response:
\`\`\`json
{
  "available": true,
  "configuration": {
    "geminiApiKey": true,
    "supadataApiKey": true,
    "googleCloudProject": false,
    "googleCloudBucket": false,
    "googleCredentials": false
  },
  "mode": "gemini-file-api",
  "recommendations": [
    "Optional: Set up Google Cloud Storage for permanent video storage"
  ]
}
\`\`\`

## 🚀 Usage

### Option A: Add Button to Feedback Page

Edit `/src/app/feedback/page.tsx`:

\`\`\`tsx
import { DeepAnalysisButton } from '@/components/features'

// After VideoRating component
{showRating && (
  <>
    <VideoRating 
      videoId={analyzedVideo.id}
      metadata={analyzedVideo.metadata}
      onRatingComplete={handleRatingComplete}
    />
    
    {/* Add this */}
    <Card className="mt-6">
      <DeepAnalysisButton 
        videoId={analyzedVideo.id}
        onComplete={(analysis) => {
          console.log('Deep analysis complete!', analysis)
          // Optionally refresh the page or update state
        }}
      />
    </Card>
  </>
)}
\`\`\`

### Option B: Use API Directly

\`\`\`bash
# Get a video ID from your library
VIDEO_ID="2c8f0777-3fed-4ebc-a608-733613136bc1"

# Run deep analysis
curl -X POST http://localhost:3000/api/videos/analyze/deep \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"videoId\\": \\"$VIDEO_ID\\",
    \\"detailLevel\\": \\"comprehensive\\",
    \\"cleanupAfter\\": true
  }"
\`\`\`

### What Happens:

1. **Download** (5-10s): yt-dlp downloads the video to `/tmp/hagen-videos/`
2. **Upload** (2-5s): Uploads to Gemini File API (temporary storage)
3. **Analyze** (10-20s): Gemini analyzes the video
4. **Save** (1s): Results saved to database
5. **Embedding** (2s): Regenerates embedding with ALL data
6. **Cleanup**: Deletes local file

## 📊 What You'll Get

The `visual_analysis` field will contain:

\`\`\`json
{
  "visual": {
    "hookStrength": 8,
    "overallQuality": 7,
    "mainElements": ["food", "text overlay", "person"],
    "colorPalette": ["#FF5722", "#FFC107"],
    "summary": "Fast-paced food review...",
    "pacing": "fast",
    "sceneChanges": 12,
    "cameraWork": "handheld"
  },
  "audio": {
    "quality": 8,
    "musicType": "upbeat pop",
    "hasVoiceover": true,
    "energyLevel": 9
  },
  "content": {
    "mainTopic": "food review",
    "emotionalTone": "humorous",
    "keyMoments": [
      {"timestamp": 0, "description": "Hook with question"},
      {"timestamp": 3, "description": "Product reveal"}
    ]
  },
  "predictions": {
    "viralPotential": 7.5,
    "targetAudience": ["food lovers", "millennials"],
    "engagementFactors": ["humor", "relatability"]
  }
}
\`\`\`

## 💡 Tips

**Start Small:**
- Test on 2-3 videos first
- Check the analysis quality
- Verify embeddings are regenerating

**Batch Processing:**
- Can run deep analysis on existing rated videos
- Use the library page to get video IDs
- Process 5-10 at a time

**Cost Management:**
- Gemini 2.0 Flash: ~$0.004 per video
- 100 videos = ~$0.40
- Videos cached for 48 hours in Gemini

**Storage Options:**
- **Current**: Gemini File API (temporary, 48hr cache)
- **Upgrade**: Google Cloud Storage (permanent, better for re-analysis)

## 🐛 Troubleshooting

**"yt-dlp: command not found"**
\`\`\`bash
sudo apt install yt-dlp
\`\`\`

**"GEMINI_API_KEY not found"**
- Make sure it's in `.env.local`
- Restart the dev server after adding

**"Download failed"**
- TikTok may be rate limiting
- Try a different video
- Check yt-dlp version: \`yt-dlp --version\`

**"Analysis taking too long"**
- Normal for first request (cold start)
- 15-second videos: ~20-30 seconds total
- 60-second videos: ~60-90 seconds total

## 📈 Next Steps

Once you have 5-10 videos with deep analysis:
1. Compare similarity results (should be more accurate)
2. Check pattern discovery (richer insights)
3. Decide if you want permanent storage (Google Cloud)

---

**Current Status:** Ready to use with Gemini File API (temporary storage)
**To Upgrade:** Set up Google Cloud Storage for permanent video storage
