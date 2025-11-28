import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { serviceRegistry } from '@/lib/services/registry'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

const discoverRequestSchema = z.object({
  minRatings: z.number().min(3).default(5),
  includeAllRatedVideos: z.boolean().default(true),
  focusOnRecent: z.boolean().default(false),
  recentDays: z.number().default(30)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { minRatings, includeAllRatedVideos, focusOnRecent, recentDays } = discoverRequestSchema.parse(body)

    console.log(`🔬 Discovering patterns from user ratings (min: ${minRatings})`)

    // Fetch rated videos
    let query = supabase
      .from('analyzed_videos')
      .select('*, video_metrics(*)')
      .not('user_ratings', 'is', null)

    if (focusOnRecent) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - recentDays)
      query = query.gte('created_at', cutoffDate.toISOString())
    }

    const { data: ratedVideos, error: fetchError } = await query

    if (fetchError) {
      throw new Error(`Failed to fetch rated videos: ${fetchError.message}`)
    }

    if (!ratedVideos || ratedVideos.length < minRatings) {
      return NextResponse.json({
        patterns: [],
        message: `Not enough rated videos. Need at least ${minRatings}, found ${ratedVideos?.length || 0}`,
        suggestion: 'Rate more videos to discover patterns'
      })
    }

    console.log(`📊 Analyzing ${ratedVideos.length} rated videos`)

    // Use pattern discovery service
    const patternDiscovery = serviceRegistry.getPatternDiscoveryProvider()
    const patterns = await patternDiscovery.discoverPatterns({
      ratedVideos: ratedVideos.map(v => ({
        id: v.id,
        metadata: v.metadata,
        analysis: v.visual_analysis,
        userRatings: v.user_ratings,
        computedMetrics: v.video_metrics?.[0] || {}
      }))
    })

    // Save discovered patterns
    console.log(`💾 Saving ${patterns.length} patterns`)

    for (const pattern of patterns) {
      await supabase
        .from('discovered_patterns')
        .upsert({
          pattern_name: pattern.name,
          description: pattern.description,
          confidence_score: pattern.confidence,
          supporting_evidence: pattern.evidence,
          suggested_rating_criteria: pattern.suggestedCriteria || [],
          discovered_at: new Date().toISOString()
        }, {
          onConflict: 'pattern_name',
          ignoreDuplicates: false
        })
    }

    console.log('✅ Pattern discovery complete')

    return NextResponse.json({
      patterns,
      totalVideosAnalyzed: ratedVideos.length,
      message: `Discovered ${patterns.length} patterns from ${ratedVideos.length} rated videos`
    })

  } catch (error) {
    console.error('❌ Pattern discovery failed:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'validation-error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'discovery-failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET - Retrieve discovered patterns
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0.5')
    const limit = parseInt(searchParams.get('limit') || '20')
    const includeApplied = searchParams.get('includeApplied') !== 'false'

    let query = supabase
      .from('discovered_patterns')
      .select('*')
      .gte('confidence_score', minConfidence)
      .order('confidence_score', { ascending: false })
      .limit(limit)

    if (!includeApplied) {
      query = query.is('applied_at', null)
    }

    const { data: patterns, error } = await query

    if (error) {
      throw new Error(`Failed to fetch patterns: ${error.message}`)
    }

    return NextResponse.json({
      patterns: patterns || [],
      count: patterns?.length || 0
    })

  } catch (error) {
    console.error('❌ Fetch patterns failed:', error)
    return NextResponse.json(
      { error: 'fetch-failed', message: 'Failed to retrieve patterns' },
      { status: 500 }
    )
  }
}

// PATCH - Mark pattern as applied
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { patternName, applied } = z.object({
      patternName: z.string(),
      applied: z.boolean()
    }).parse(body)

    const updateData = applied
      ? { applied_at: new Date().toISOString() }
      : { applied_at: null }

    const { error } = await supabase
      .from('discovered_patterns')
      .update(updateData)
      .eq('pattern_name', patternName)

    if (error) {
      throw new Error(`Failed to update pattern: ${error.message}`)
    }

    return NextResponse.json({
      patternName,
      applied,
      message: `Pattern ${applied ? 'marked as applied' : 'unmarked'}`
    })

  } catch (error) {
    console.error('❌ Update pattern failed:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'validation-error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'update-failed', message: 'Failed to update pattern' },
      { status: 500 }
    )
  }
}
