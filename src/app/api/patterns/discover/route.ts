/**
 * Pattern Discovery API (V2 - Limitless Schema)
 * 
 * POST /api/patterns/discover - Run pattern discovery on ratings_v2
 * GET /api/patterns/discover - Get discovered patterns and criteria
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runPatternDiscovery } from '@/lib/services/patterns/discovery';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * POST /api/patterns/discover
 * 
 * Trigger pattern discovery on all v2 ratings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { useV2 = true } = body;

    console.log('🔍 Starting pattern discovery...');
    
    if (useV2) {
      // Use new limitless pattern discovery
      const results = await runPatternDiscovery(supabase);
      
      console.log(`✅ Pattern discovery complete:`);
      console.log(`   - ${results.correlations.length} correlations (explicit + implicit)`);
      console.log(`   - ${results.thresholds.length} thresholds`);
      console.log(`   - ${results.insights.length} insights`);
      console.log(`   - ${results.implicitPatterns.length} implicit patterns (from Gemini)`);
      
      // Separate explicit vs implicit correlations for the response
      const explicitCorrelations = results.correlations.filter(c => c.source === 'explicit');
      const implicitCorrelations = results.correlations.filter(c => c.source === 'gemini');
      
      return NextResponse.json({
        success: true,
        version: 2,
        correlations: results.correlations,
        explicitCorrelations,
        implicitCorrelations,
        thresholds: results.thresholds,
        insights: results.insights,
        implicitPatterns: results.implicitPatterns,
        summary: {
          totalCorrelations: results.correlations.length,
          explicitCount: explicitCorrelations.length,
          implicitCount: implicitCorrelations.length,
          strongCorrelations: results.correlations.filter(c => Math.abs(c.correlation) > 0.4).length,
          topImplicit: implicitCorrelations
            .filter(c => Math.abs(c.correlation) > 0.3)
            .slice(0, 5)
            .map(c => ({ feature: c.criterion, correlation: c.correlation, interpretation: c.interpretation })),
        },
      });
    }

    // Legacy V1 discovery (keeping for backwards compatibility)
    return await legacyPatternDiscovery(request);
    
  } catch (error) {
    console.error('Pattern discovery failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Discovery failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/patterns/discover
 * 
 * Get discovered patterns and criteria correlations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');  // 'correlations', 'patterns', 'criteria'
    
    if (type === 'correlations' || type === 'criteria') {
      const { data: criteria, error } = await supabase
        .from('discovered_criteria')
        .select('*')
        .order('frequency', { ascending: false });
      
      if (error) {
        // Table might not exist yet
        console.error('Failed to fetch criteria:', error);
        return NextResponse.json({ criteria: [], count: 0 });
      }
      
      // Sort by absolute correlation for correlations view
      const sorted = type === 'correlations'
        ? (criteria || []).sort((a, b) => 
            Math.abs(b.correlation_with_score || 0) - Math.abs(a.correlation_with_score || 0)
          )
        : criteria;
      
      return NextResponse.json({
        criteria: sorted,
        count: criteria?.length || 0,
      });
    }
    
    if (type === 'patterns') {
      const { data: patterns, error } = await supabase
        .from('learned_patterns')
        .select('*')
        .order('confidence', { ascending: false });
      
      if (error) {
        console.error('Failed to fetch patterns:', error);
        return NextResponse.json({ patterns: [], count: 0 });
      }
      
      return NextResponse.json({
        patterns: patterns || [],
        count: patterns?.length || 0,
      });
    }
    
    // Return everything
    const [criteriaRes, patternsRes] = await Promise.all([
      supabase
        .from('discovered_criteria')
        .select('*')
        .order('frequency', { ascending: false }),
      supabase
        .from('learned_patterns')
        .select('*')
        .order('confidence', { ascending: false }),
    ]);
    
    return NextResponse.json({
      criteria: criteriaRes.data || [],
      patterns: patternsRes.data || [],
    });
    
  } catch (error) {
    console.error('Failed to fetch patterns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch patterns' },
      { status: 500 }
    );
  }
}

/**
 * Legacy V1 pattern discovery (for backwards compatibility)
 */
import { z } from 'zod';
import { serviceRegistry } from '@/lib/services/registry';

const discoverRequestSchema = z.object({
  minRatings: z.number().min(3).default(5),
  includeAllRatedVideos: z.boolean().default(true),
  focusOnRecent: z.boolean().default(false),
  recentDays: z.number().default(30)
});

async function legacyPatternDiscovery(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const legacySupabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const body = await request.json().catch(() => ({}));
    const { minRatings, includeAllRatedVideos, focusOnRecent, recentDays } = discoverRequestSchema.parse(body);

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

// Note: Legacy GET function removed - using the V2 GET above

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
