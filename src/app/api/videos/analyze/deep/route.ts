/**
 * Deep Video Analysis API
 * 
 * Full pipeline: Download → Upload to Cloud → Analyze with Gemini → Save results
 * 
 * POST /api/videos/analyze/deep
 * Body: { videoId: string }
 * 
 * Prerequisite: Video must already exist in analyzed_videos table
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createVideoDownloader } from '@/lib/services/video/downloader'
import { createVideoStorageService } from '@/lib/services/video/storage'
import { GeminiVideoAnalyzer } from '@/lib/services/video/gemini'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const deepAnalysisSchema = z.object({
  videoId: z.string().uuid('Invalid video ID'),
  detailLevel: z.enum(['basic', 'detailed', 'comprehensive']).default('comprehensive'),
  skipDownload: z.boolean().default(false), // If you already have the file
  cleanupAfter: z.boolean().default(true)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoId, detailLevel, skipDownload, cleanupAfter } = deepAnalysisSchema.parse(body)

    console.log(`🎬 Starting deep analysis for video: ${videoId}`)

    // Step 1: Get video data from database
    const { data: video, error: fetchError } = await supabase
      .from('analyzed_videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (fetchError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      )
    }

    // Check prerequisites
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { 
          error: 'gemini-not-configured',
          message: 'GEMINI_API_KEY environment variable not set',
          setupGuide: '/DEEP_ANALYSIS_SETUP.md'
        },
        { status: 503 }
      )
    }

    let localFilePath: string | undefined
    let cloudUrl: string | undefined

    try {
      // Step 2: Download video (if not skipped)
      if (!skipDownload) {
        console.log('📥 Downloading video...')
        const downloader = createVideoDownloader()
        
        // Try yt-dlp first
        const downloadResult = await downloader.downloadWithYtDlp(video.video_url)
        
        if (!downloadResult.success) {
          // Fallback to Supadata if available
          const supadataResult = await downloader.downloadWithSupadata(
            video.video_url,
            process.env.SUPADATA_API_KEY!
          )
          
          if (!supadataResult.success) {
            throw new Error(`Download failed: ${downloadResult.error}`)
          }
          
          localFilePath = supadataResult.filePath
        } else {
          localFilePath = downloadResult.filePath
        }

        console.log(`✅ Downloaded: ${localFilePath}`)
      }

      // Step 3: Upload to cloud storage (required for Gemini)
      if (localFilePath) {
        console.log('☁️ Uploading to cloud storage...')
        
        // Check if GCS is configured
        if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_STORAGE_BUCKET) {
          const storage = createVideoStorageService()
          const uploadResult = await storage.uploadVideo(localFilePath, videoId)
          
          if (!uploadResult.success) {
            throw new Error(`Cloud upload failed: ${uploadResult.error}`)
          }
          
          cloudUrl = uploadResult.gsUrl
          console.log(`✅ Uploaded: ${cloudUrl}`)
        } else {
          // Fallback: Use Gemini File API for temporary upload
          console.log('☁️ Using Gemini File API (temporary storage)...')
          const storage = createVideoStorageService()
          const uploadResult = await storage.uploadToGeminiFileAPI(localFilePath)
          
          if (!uploadResult.success) {
            throw new Error(`Gemini upload failed: ${uploadResult.error}`)
          }
          
          cloudUrl = uploadResult.gsUrl
        }
      }

      // Step 4: Analyze with Gemini
      if (!cloudUrl) {
        throw new Error('No cloud URL available for analysis')
      }

      console.log('🤖 Analyzing with Gemini...')
      const analyzer = new GeminiVideoAnalyzer()
      const analysis = await analyzer.analyzeVideo(cloudUrl, {
        detailLevel,
        includeTimestamps: true
      })

      // Step 5: Save analysis to database
      console.log('💾 Saving analysis results...')
      const { error: updateError } = await supabase
        .from('analyzed_videos')
        .update({
          visual_analysis: analysis,
          analyzed_at: new Date().toISOString()
        })
        .eq('id', videoId)

      if (updateError) {
        console.error('Failed to save analysis:', updateError)
        // Continue anyway - we have the analysis
      }

      // Step 6: Regenerate embedding with new data
      console.log('🔄 Regenerating embedding with analysis data...')
      
      // Get embedding provider
      const { serviceRegistry } = await import('@/lib/services/registry')
      const embeddingProvider = serviceRegistry.getEmbeddingProvider()
      
      // Prepare comprehensive text for embedding
      const embeddingText = embeddingProvider.prepareTextForEmbedding({
        metadata: video.metadata,
        analysis,
        userRatings: video.user_ratings,
        userTags: video.user_tags,
        computedMetrics: {} // Could recalculate with new data
      })
      
      const embedding = await embeddingProvider.generateEmbedding(embeddingText)
      
      // Update embedding
      await supabase
        .from('analyzed_videos')
        .update({ content_embedding: embedding })
        .eq('id', videoId)

      console.log('✅ Deep analysis complete!')

      // Step 7: Cleanup
      if (cleanupAfter && localFilePath) {
        const downloader = createVideoDownloader()
        await downloader.cleanup(localFilePath)
      }

      return NextResponse.json({
        success: true,
        videoId,
        analysis,
        message: 'Deep analysis completed successfully'
      })

    } catch (analysisError) {
      // Cleanup on error
      if (localFilePath && cleanupAfter) {
        try {
          const downloader = createVideoDownloader()
          await downloader.cleanup(localFilePath)
        } catch (cleanupError) {
          console.error('Cleanup failed:', cleanupError)
        }
      }

      throw analysisError
    }

  } catch (error) {
    console.error('❌ Deep analysis failed:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'validation-error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'deep-analysis-failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        setupGuide: 'See /DEEP_ANALYSIS_SETUP.md for configuration help'
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Check if deep analysis is configured and available
 */
export async function GET(request: NextRequest) {
  const checks = {
    geminiApiKey: !!process.env.GEMINI_API_KEY,
    supadataApiKey: !!process.env.SUPADATA_API_KEY,
    googleCloudProject: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
    googleCloudBucket: !!process.env.GOOGLE_CLOUD_STORAGE_BUCKET,
    googleCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS
  }

  const isFullyConfigured = checks.geminiApiKey
  const hasCloudStorage = checks.googleCloudProject && checks.googleCloudBucket

  return NextResponse.json({
    available: isFullyConfigured,
    configuration: checks,
    mode: hasCloudStorage ? 'cloud-storage' : 'gemini-file-api',
    recommendations: [
      !checks.geminiApiKey && 'Set GEMINI_API_KEY in .env.local',
      !checks.googleCloudProject && 'Optional: Set up Google Cloud Storage for permanent video storage',
      !checks.supadataApiKey && 'Warning: No fallback download method available'
    ].filter(Boolean),
    setupGuide: '/DEEP_ANALYSIS_SETUP.md'
  })
}
