/**
 * Video Context for Brand Conversations
 * 
 * Detects video links in user messages and analyzes them for brand discovery.
 * Creates minimal DB records (no Supadata metadata fetch) then uses the 
 * download → Gemini pipeline for deep analysis.
 */

import { createClient } from '@supabase/supabase-js'
import { createVideoDownloader } from '../video/downloader'
import { createVideoStorageService } from '../video/storage'
import { GeminiVideoAnalyzer } from '../video/gemini'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Patterns to detect video URLs
const VIDEO_URL_PATTERNS = [
  /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/gi,
  /https?:\/\/(?:vm\.)?tiktok\.com\/[\w]+/gi,
  /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/gi,
  /https?:\/\/youtu\.be\/[\w-]+/gi,
  /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+/gi,
]

export interface VideoAnalysisContext {
  url: string
  platform: 'tiktok' | 'youtube' | 'instagram' | 'unknown'
  videoId?: string
  analysis: {
    summary: string
    humorType?: string
    whyFunny?: string
    tone: string
    style: string
    targetAudience?: string
    conceptCore?: string
    brandRelevance: string
  }
  fromCache: boolean
}

/**
 * Extract video URLs from a message
 */
export function extractVideoUrls(message: string): string[] {
  const urls: string[] = []
  
  for (const pattern of VIDEO_URL_PATTERNS) {
    const matches = message.match(pattern)
    if (matches) {
      urls.push(...matches)
    }
  }
  
  // Deduplicate
  return [...new Set(urls)]
}

/**
 * Detect platform from URL
 */
function detectPlatform(url: string): 'tiktok' | 'youtube' | 'instagram' | 'unknown' {
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('instagram.com')) return 'instagram'
  return 'unknown'
}

/**
 * Safely get nested property from any object
 */
function getDeep(obj: any, ...keys: string[]): any {
  let current = obj
  for (const key of keys) {
    if (current === null || current === undefined) return undefined
    current = current[key]
  }
  return current
}

/**
 * Extract platform video ID from URL
 */
function extractPlatformVideoId(url: string): string {
  const tiktokMatch = url.match(/video\/(\d+)/)
  if (tiktokMatch) return tiktokMatch[1]
  
  const ytMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (ytMatch) return ytMatch[1]
  
  const igMatch = url.match(/(?:reel|p)\/([a-zA-Z0-9_-]+)/)
  if (igMatch) return igMatch[1]
  
  return `vid_${Date.now()}`
}

/**
 * Analyze a video using the full pipeline:
 * 1. Check if already analyzed in DB
 * 2. If not: download → upload to Gemini File API → analyze → save
 * 3. Extract brand-relevant context from analysis
 */
export async function analyzeVideoForBrandContext(
  url: string,
  conversationContext?: string
): Promise<VideoAnalysisContext | null> {
  try {
    console.log(`🎬 Analyzing video for brand context: ${url}`)
    
    const platform = detectPlatform(url)
    
    // Step 1: Check if video is already analyzed
    const { data: existingVideo } = await supabase
      .from('analyzed_videos')
      .select('id, visual_analysis')
      .eq('video_url', url)
      .single()
    
    if (existingVideo?.visual_analysis) {
      console.log(`✅ Found cached analysis for ${url}`)
      return buildContextFromAnalysis(
        url, 
        platform, 
        existingVideo.visual_analysis, 
        existingVideo.id,
        true,
        conversationContext
      )
    }
    
    // Step 2: Check if GEMINI_API_KEY is available
    if (!process.env.GEMINI_API_KEY) {
      console.log('⚠️ GEMINI_API_KEY not set - cannot analyze new videos')
      return {
        url,
        platform,
        fromCache: false,
        analysis: {
          summary: 'Video could not be analyzed (Gemini not configured)',
          tone: 'unknown',
          style: 'unknown',
          brandRelevance: 'User shared this as an example - ask them about it'
        }
      }
    }
    
    // Step 3: Create minimal video record (directly in DB, no metadata fetch)
    console.log('📝 Creating video record...')
    const platformVideoId = extractPlatformVideoId(url)
    
    const { data: newVideo, error: createError } = await supabase
      .from('analyzed_videos')
      .insert({
        video_url: url,
        video_id: platformVideoId,
        platform,
        metadata: {
          url,
          platform,
          videoId: platformVideoId,
          provider: 'minimal'
        },
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()
    
    if (createError) {
      console.error('❌ Failed to create video record:', createError)
      throw new Error(`Database insert failed: ${createError.message}`)
    }
    
    const videoId = newVideo.id
    
    // Step 4: Run deep analysis (download → upload → Gemini → save)
    // Use the existing downloader and analyzer infrastructure
    console.log('📥 Downloading video...')
    const downloader = createVideoDownloader()
    const downloadResult = await downloader.downloadWithYtDlp(url)
    
    if (!downloadResult.success) {
      console.error('❌ Download failed:', downloadResult.error)
      return {
        url,
        platform,
        fromCache: false,
        analysis: {
          summary: `Video could not be downloaded: ${downloadResult.error}`,
          tone: 'unknown',
          style: 'unknown',
          brandRelevance: 'User shared this as an example - ask them what they like about it'
        }
      }
    }
    
    let analysis: any
    try {
      // Upload to Gemini File API
      console.log('☁️ Uploading to Gemini File API...')
      const storage = createVideoStorageService()
      const uploadResult = await storage.uploadToGeminiFileAPI(downloadResult.filePath!)
      
      if (!uploadResult.success || !uploadResult.gsUrl) {
        throw new Error(`Gemini upload failed: ${uploadResult.error}`)
      }
      
      console.log('🤖 Analyzing with Gemini...')
      const analyzer = new GeminiVideoAnalyzer()
      analysis = await analyzer.analyzeVideo(uploadResult.gsUrl, {
        detailLevel: 'comprehensive'
      })
      
      // Save analysis to DB
      await supabase
        .from('analyzed_videos')
        .update({
          visual_analysis: analysis,
          analyzed_at: new Date().toISOString()
        })
        .eq('id', videoId)
      
    } finally {
      // Cleanup downloaded file
      try {
        await downloader.cleanup(downloadResult.filePath!)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Step 5: Build context from analysis
    const context = buildContextFromAnalysis(
      url, 
      platform, 
      analysis, 
      videoId,
      false,
      conversationContext
    )
    
    console.log(`✅ Video context extracted: ${context.analysis.tone} tone, ${context.analysis.style} style`)
    return context
    
  } catch (error) {
    console.error(`❌ Failed to analyze video: ${error}`)
    return {
      url,
      platform: detectPlatform(url),
      fromCache: false,
      analysis: {
        summary: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        tone: 'unknown',
        style: 'unknown',
        brandRelevance: 'User shared this as an example - ask them what they like about it'
      }
    }
  }
}

/**
 * Build VideoAnalysisContext from stored/computed analysis
 */
function buildContextFromAnalysis(
  url: string,
  platform: 'tiktok' | 'youtube' | 'instagram' | 'unknown',
  analysis: any,
  videoId: string | undefined,
  fromCache: boolean,
  conversationContext?: string
): VideoAnalysisContext {
  const raw = analysis.rawResponse || analysis
  
  return {
    url,
    platform,
    videoId,
    fromCache,
    analysis: {
      summary: getDeep(raw, 'content', 'summary') || 
               getDeep(raw, 'visual', 'summary') || 
               getDeep(analysis, 'content', 'themes')?.join(', ') ||
               'Video analyzed',
      humorType: getDeep(raw, 'humor_analysis', 'primary_type') || 
                 getDeep(raw, 'humor', 'primaryType'),
      whyFunny: getDeep(raw, 'humor_analysis', 'why_funny') ||
                getDeep(raw, 'humor', 'whyFunny'),
      tone: extractTone(raw, analysis),
      style: getDeep(raw, 'content', 'format') || 
             getDeep(raw, 'content', 'style') ||
             analysis.technical?.editingStyle ||
             'standard',
      targetAudience: getDeep(raw, 'content', 'targetAudience') ||
                      getDeep(raw, 'content', 'target_audience'),
      conceptCore: getDeep(raw, 'script', 'conceptCore') ||
                   getDeep(raw, 'script', 'concept_core'),
      brandRelevance: generateBrandRelevance(raw, analysis, conversationContext)
    }
  }
}

/**
 * Extract tone descriptors from analysis
 */
function extractTone(raw: any, analysis: any): string {
  const toneIndicators: string[] = []
  
  // From raw response
  if (getDeep(raw, 'content', 'emotionalTone')) {
    toneIndicators.push(raw.content.emotionalTone)
  }
  if (getDeep(raw, 'audio', 'voiceoverTone')) {
    toneIndicators.push(raw.audio.voiceoverTone)
  }
  if (getDeep(raw, 'humor_analysis', 'primary_type')) {
    toneIndicators.push(`${raw.humor_analysis.primary_type} humor`)
  }
  if (getDeep(raw, 'audio', 'energyLevel')) {
    toneIndicators.push(`${raw.audio.energyLevel} energy`)
  }
  
  // From typed analysis
  if (analysis.content?.emotions?.length) {
    toneIndicators.push(...analysis.content.emotions.slice(0, 2))
  }
  if (analysis.audio?.voiceTone) {
    toneIndicators.push(analysis.audio.voiceTone)
  }
  
  return toneIndicators.length > 0 
    ? toneIndicators.join(', ') 
    : 'neutral'
}

/**
 * Generate a brand-relevance summary for Claude
 */
function generateBrandRelevance(raw: any, analysis: any, context?: string): string {
  const parts: string[] = []
  
  // Production style
  const quality = getDeep(raw, 'visual', 'overallQuality') || analysis.visual?.overallQuality
  if (quality) {
    if (quality >= 8 || quality >= 0.8) parts.push('high production value')
    else if (quality >= 5 || quality >= 0.5) parts.push('moderate production quality')
    else parts.push('raw/unpolished aesthetic')
  }
  
  // Content approach
  const concept = getDeep(raw, 'script', 'conceptCore') || getDeep(raw, 'script', 'concept_core')
  if (concept) {
    parts.push(`concept: ${concept}`)
  }
  
  // Humor/tone
  const whyFunny = getDeep(raw, 'humor_analysis', 'why_funny') || getDeep(raw, 'humor', 'whyFunny')
  if (whyFunny) {
    parts.push(`humor works because: ${whyFunny}`)
  }
  
  // Audience fit
  const audience = getDeep(raw, 'content', 'targetAudience') || getDeep(raw, 'content', 'target_audience')
  if (audience) {
    parts.push(`appeals to: ${audience}`)
  }
  
  // Themes
  if (analysis.content?.themes?.length) {
    parts.push(`themes: ${analysis.content.themes.slice(0, 3).join(', ')}`)
  }
  
  return parts.length > 0 
    ? parts.join('; ')
    : 'General video reference'
}

/**
 * Format video analysis for injection into Claude conversation
 */
export function formatVideoContextForPrompt(contexts: VideoAnalysisContext[]): string {
  if (contexts.length === 0) return ''
  
  const formatted = contexts.map((ctx, i) => {
    const lines = [
      `[VIDEO ${i + 1}: ${ctx.platform.toUpperCase()}]`,
      `URL: ${ctx.url}`,
      `Tone: ${ctx.analysis.tone}`,
      `Style: ${ctx.analysis.style}`,
    ]
    
    if (ctx.analysis.humorType) {
      lines.push(`Humor: ${ctx.analysis.humorType}`)
    }
    if (ctx.analysis.whyFunny) {
      lines.push(`Why it works: ${ctx.analysis.whyFunny}`)
    }
    if (ctx.analysis.conceptCore) {
      lines.push(`Replicable concept: ${ctx.analysis.conceptCore}`)
    }
    if (ctx.analysis.targetAudience) {
      lines.push(`Target audience: ${ctx.analysis.targetAudience}`)
    }
    lines.push(`Brand relevance: ${ctx.analysis.brandRelevance}`)
    
    return lines.join('\n')
  }).join('\n\n')
  
  return `
=== VIDEO REFERENCES SHARED BY USER ===
The user shared these videos as examples of content they like or relate to.
Use this to understand their brand preferences concretely.

${formatted}

Connect these examples to your understanding of their brand. 
Ask clarifying questions like "Is this the energy level you're going for?" or
"This video uses [technique] - is that something you'd want for your brand?"
===
`
}
