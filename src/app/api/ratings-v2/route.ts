/**
 * Ratings V2 API - Limitless Schema
 * 
 * Simplified rating: just overall score + notes
 * AI extracts criteria, generates embeddings, discovers patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractCriteria } from '@/lib/services/extraction/criteria';
import { generateRatingEmbedding } from '@/lib/services/embeddings/ratings';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * POST /api/ratings-v2
 * 
 * Submit a rating with just score + notes
 * System extracts criteria and generates embedding
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      video_id, 
      overall_score, 
      notes,
      tags = [],
      ai_prediction = null,
      rater_id = 'primary',
      skip_extraction = false,  // For quick saves, extract later
    } = body;

    // Validate required fields
    if (!video_id) {
      return NextResponse.json({ error: 'video_id is required' }, { status: 400 });
    }
    
    if (!notes || notes.trim().length < 10) {
      return NextResponse.json(
        { error: 'notes is required and must be at least 10 characters' },
        { status: 400 }
      );
    }
    
    if (overall_score !== null && (overall_score < 0 || overall_score > 1)) {
      return NextResponse.json(
        { error: 'overall_score must be between 0 and 1' },
        { status: 400 }
      );
    }

    // Extract criteria from notes (async)
    let extractedCriteria = {};
    let extractionModel = null;
    let extractionConfidence = null;
    
    if (!skip_extraction) {
      try {
        const extraction = await extractCriteria(notes, overall_score);
        extractedCriteria = extraction.criteria;
        extractionModel = extraction.model_used;
        extractionConfidence = extraction.confidence;
        
        console.log(`✅ Extracted ${Object.keys(extractedCriteria).length} criteria from notes`);
      } catch (err) {
        console.error('Criteria extraction failed, continuing without:', err);
      }
    }

    // Generate embedding for similarity search
    let embeddingVector = null;
    
    if (!skip_extraction) {
      try {
        const embedding = await generateRatingEmbedding({
          notes,
          extractedCriteria,
          overallScore: overall_score,
          tags,
        });
        embeddingVector = embedding.embedding;
        
        console.log(`✅ Generated embedding (${embedding.dimensions} dims)`);
      } catch (err) {
        console.error('Embedding generation failed, continuing without:', err);
      }
    }

    // Save to database
    const { data, error } = await supabase
      .from('ratings_v2')
      .upsert({
        video_id,
        overall_score,
        notes,
        tags,
        extracted_criteria: extractedCriteria,
        extraction_model: extractionModel,
        extraction_confidence: extractionConfidence,
        reasoning_embedding: embeddingVector,
        ai_prediction,
        rated_at: new Date().toISOString(),
        rater_id,
      }, {
        onConflict: 'video_id,rater_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Rating save error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update criteria statistics (fire and forget)
    updateCriteriaStatistics(extractedCriteria, overall_score).catch(console.error);

    // Log extraction for review
    if (!skip_extraction && data?.id) {
      supabase
        .from('extraction_log')
        .insert({
          rating_id: data.id,
          notes_text: notes,
          extracted_criteria: extractedCriteria,
          model_used: extractionModel || 'none',
          confidence: extractionConfidence,
        });
      // Fire and forget - errors logged but don't block response
    }

    console.log(`✅ Rating saved for video ${video_id}`);

    return NextResponse.json({
      success: true,
      rating: data,
      extraction: {
        criteria: extractedCriteria,
        confidence: extractionConfidence,
        model: extractionModel,
      },
      has_embedding: !!embeddingVector,
    });

  } catch (error) {
    console.error('Rating API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save rating' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ratings-v2
 * 
 * Fetch ratings with various filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unrated = searchParams.get('unrated') === 'true';
    const withCriteria = searchParams.get('with_criteria') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const raterId = searchParams.get('rater_id') || 'primary';

    if (unrated) {
      // Get videos that don't have a v2 rating
      const { data: ratedIds } = await supabase
        .from('ratings_v2')
        .select('video_id')
        .eq('rater_id', raterId);

      const ratedVideoIds = (ratedIds || []).map(r => r.video_id);

      let query = supabase
        .from('analyzed_videos')
        .select('id, video_url, platform, metadata, gcs_uri, visual_analysis, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (ratedVideoIds.length > 0) {
        query = query.not('id', 'in', `(${ratedVideoIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Transform for UI
      const videos = (data || []).map(v => ({
        id: v.id,
        source_url: v.video_url,
        platform: v.platform,
        title: v.metadata?.title,
        thumbnail_url: v.metadata?.thumbnail,
        gcs_uri: v.gcs_uri,
        visual_analysis: v.visual_analysis,
      }));

      return NextResponse.json(videos);
    }

    // Get all ratings
    let query = supabase
      .from('ratings_v2')
      .select(`
        *,
        analyzed_videos!inner (
          video_url,
          platform,
          metadata
        )
      `)
      .eq('rater_id', raterId)
      .order('rated_at', { ascending: false })
      .limit(limit);

    if (withCriteria) {
      query = query.not('extracted_criteria', 'is', null);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ratings: data || [],
      count: data?.length || 0,
    });

  } catch (error) {
    console.error('Ratings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ratings' },
      { status: 500 }
    );
  }
}

/**
 * Update discovered_criteria statistics
 */
async function updateCriteriaStatistics(
  criteria: Record<string, unknown>,
  score: number | null
) {
  for (const [key, value] of Object.entries(criteria)) {
    if (value === null || value === undefined) continue;

    // Upsert criterion
    const { data: existing } = await supabase
      .from('discovered_criteria')
      .select('frequency, avg_value')
      .eq('criterion_name', key)
      .single();

    if (existing) {
      // Update with running average
      const newFreq = existing.frequency + 1;
      const newAvg = typeof value === 'number'
        ? ((existing.avg_value || 0) * existing.frequency + value) / newFreq
        : existing.avg_value;

      await supabase
        .from('discovered_criteria')
        .update({
          frequency: newFreq,
          avg_value: newAvg,
          last_seen_at: new Date().toISOString(),
        })
        .eq('criterion_name', key);
    } else {
      // Insert new criterion
      await supabase
        .from('discovered_criteria')
        .insert({
          criterion_name: key,
          frequency: 1,
          avg_value: typeof value === 'number' ? value : null,
          value_type: typeof value === 'number' ? 'numeric' :
                     typeof value === 'boolean' ? 'boolean' : 'categorical',
          last_seen_at: new Date().toISOString(),
        });
    }
  }
}
