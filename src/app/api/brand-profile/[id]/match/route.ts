/**
 * Brand Profile Match API
 * 
 * POST /api/brand-profile/[id]/match
 * 
 * Find videos that match a brand profile based on embedding similarity
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/services/embeddings/openai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { 
      limit = 20, 
      threshold = 0.6,
      regenerateEmbedding = false 
    } = body

    console.log(`🎯 Finding video matches for brand profile: ${id}`)

    // Get brand profile
    const { data: profile, error: profileError } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Brand profile not found' },
        { status: 404 }
      )
    }

    // Check if we need to generate/regenerate embedding
    let embedding = profile.embedding

    if (!embedding || regenerateEmbedding) {
      console.log('📊 Generating brand profile embedding...')

      // Build embedding text from profile data
      const embeddingText = buildEmbeddingText(profile)

      embedding = await generateEmbedding(embeddingText)

      // Store the embedding
      await supabase
        .from('brand_profiles')
        .update({ embedding })
        .eq('id', id)

      console.log('✅ Embedding generated and stored')
    }

    // Find matching videos using the existing function
    const { data: matches, error: matchError } = await supabase
      .rpc('find_videos_for_brand', {
        brand_profile_uuid: id,
        match_threshold: threshold,
        match_count: limit
      })

    if (matchError) {
      // If the RPC fails (embedding might not be stored yet), try direct query
      console.warn('RPC failed, trying direct similarity search:', matchError)
      
      const { data: videos, error: videoError } = await supabase
        .from('analyzed_videos')
        .select(`
          id,
          video_url,
          platform,
          metadata,
          embedding
        `)
        .not('embedding', 'is', null)
        .limit(100) // Get a batch to filter

      if (videoError || !videos) {
        throw new Error('Failed to fetch videos for matching')
      }

      // Calculate similarity manually
      const matches = videos
        .map(video => {
          const similarity = cosineSimilarity(embedding, video.embedding)
          return {
            id: video.id,
            video_url: video.video_url,
            platform: video.platform,
            title: video.metadata?.title || null,
            similarity
          }
        })
        .filter(m => m.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)

      return NextResponse.json({
        profileId: id,
        profileName: profile.name,
        matches,
        matchCount: matches.length,
        embeddingGenerated: !profile.embedding || regenerateEmbedding
      })
    }

    console.log(`✅ Found ${matches?.length || 0} matching videos`)

    return NextResponse.json({
      profileId: id,
      profileName: profile.name,
      matches: matches || [],
      matchCount: matches?.length || 0,
      embeddingGenerated: !profile.embedding || regenerateEmbedding
    })
  } catch (error) {
    console.error('Brand match error:', error)
    return NextResponse.json(
      { error: 'Failed to find matching videos' },
      { status: 500 }
    )
  }
}

/**
 * Build text for embedding from brand profile
 * Uses vocabulary aligned with video brand_tone_notes for better matching
 */
function buildEmbeddingText(profile: any): string {
  const parts: string[] = []

  // Business context
  if (profile.business_type) {
    parts.push(`Business type: ${profile.business_type}`)
  }

  // Characteristics
  if (profile.characteristics) {
    const chars = profile.characteristics
    if (chars.team_size) parts.push(`Team size: ${chars.team_size}`)
    if (chars.business_age) parts.push(`Business maturity: ${chars.business_age}`)
    if (chars.brand_personality_inferred?.length) {
      parts.push(`Brand personality: ${chars.brand_personality_inferred.join(', ')}`)
    }
  }

  // Tone - this is crucial for matching
  if (profile.tone) {
    const tone = profile.tone
    if (tone.primary) parts.push(`Primary tone: ${tone.primary}`)
    if (tone.secondary?.length) parts.push(`Secondary tones: ${tone.secondary.join(', ')}`)
    if (tone.energy_level) parts.push(`Energy level: ${tone.energy_level}/10`)
    if (tone.humor_tolerance) parts.push(`Humor tolerance: ${tone.humor_tolerance}/10`)
    if (tone.formality) parts.push(`Formality: ${tone.formality}/10`)
    if (tone.avoid?.length) parts.push(`Avoid: ${tone.avoid.join(', ')}`)
  }

  // Goals - content aspirations are important for matching
  if (profile.goals) {
    const goals = profile.goals
    if (goals.content_aspirations?.length) {
      parts.push(`Content style aspirations: ${goals.content_aspirations.join(', ')}`)
    }
    if (goals.social_media_goals?.length) {
      parts.push(`Goals: ${goals.social_media_goals.join(', ')}`)
    }
  }

  // Target audience
  if (profile.target_audience) {
    const audience = profile.target_audience
    if (audience.description) parts.push(`Target audience: ${audience.description}`)
    if (audience.psychographics?.length) {
      parts.push(`Audience characteristics: ${audience.psychographics.join(', ')}`)
    }
  }

  // Key insights
  if (profile.key_insights?.length) {
    parts.push(`Key brand insights: ${profile.key_insights.join('. ')}`)
  }

  // Synthesis text is ideal if available
  if (profile.conversation_synthesis) {
    parts.push(`Brand summary: ${profile.conversation_synthesis}`)
  }

  return parts.join('\n')
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
