/**
 * Analysis Corrections API
 * 
 * Stores corrections to Gemini's analysis for learning
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/corrections
 * 
 * Save a correction to Gemini's analysis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      videoUrl, 
      originalAnalysis, 
      correction, 
      correctionType,
      notes 
    } = body;

    if (!videoUrl || !originalAnalysis || !correction || !correctionType) {
      return NextResponse.json(
        { error: 'videoUrl, originalAnalysis, correction, and correctionType are required' },
        { status: 400 }
      );
    }

    // Save the correction
    const { data, error } = await supabase
      .from('analysis_corrections')
      .insert({
        video_url: videoUrl,
        original_analysis: originalAnalysis,
        correction: correction,
        correction_type: correctionType,
        notes: notes || null
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save correction:', error);
      return NextResponse.json({ error: 'Failed to save correction' }, { status: 500 });
    }

    // If this video exists in analyzed_videos, update its embedding with the correction
    const { data: existingVideo } = await supabase
      .from('analyzed_videos')
      .select('id, metadata')
      .eq('video_url', videoUrl)
      .single();

    if (existingVideo) {
      // Build new embedding text with correction context
      const embeddingText = buildCorrectionEmbeddingText(
        existingVideo.metadata,
        originalAnalysis,
        correction,
        notes
      );

      // Generate new embedding
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: embeddingText,
        encoding_format: 'float'
      });

      // Update the video's embedding
      await supabase
        .from('analyzed_videos')
        .update({ content_embedding: embeddingResponse.data[0].embedding })
        .eq('id', existingVideo.id);

      console.log(`✅ Updated embedding for corrected video: ${existingVideo.id}`);
    }

    return NextResponse.json({
      success: true,
      correction: data,
      embeddingUpdated: !!existingVideo
    });

  } catch (err) {
    console.error('Correction error:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Failed to save correction'
    }, { status: 500 });
  }
}

/**
 * GET /api/corrections
 * 
 * Get corrections for learning/review
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('analysis_corrections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq('correction_type', type);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch corrections' }, { status: 500 });
    }

    return NextResponse.json({ corrections: data });

  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Failed to fetch corrections'
    }, { status: 500 });
  }
}

function buildCorrectionEmbeddingText(
  metadata: any,
  originalAnalysis: any,
  correction: any,
  notes?: string
): string {
  const parts: string[] = [];

  if (metadata?.title) {
    parts.push(`Title: ${metadata.title}`);
  }

  // Include the CORRECT interpretation (now free-text)
  if (correction.humor_type) {
    parts.push(`Correct Humor Interpretation: ${correction.humor_type}`);
  }
  if (correction.joke_structure) {
    parts.push(`Correct Joke Structure: ${correction.joke_structure}`);
  }

  // Include correction notes
  if (notes) {
    parts.push(`Expert Correction: ${notes}`);
  }

  // Include what was WRONG to help avoid similar mistakes
  if (correction.original_humor_type) {
    parts.push(`Gemini said: ${correction.original_humor_type} (incorrect)`);
  }
  if (correction.original_mechanism) {
    parts.push(`Gemini mechanism: ${correction.original_mechanism} (incorrect)`);
  }

  return parts.join('\n');
}
