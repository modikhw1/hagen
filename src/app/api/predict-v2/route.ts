/**
 * RAG-Enhanced Prediction API
 * 
 * Uses similar rated videos as context for predictions
 * Learns from user's past ratings and reasoning
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createVertexTuningService } from '@/lib/services/vertex/training';
import { generateQueryEmbedding } from '@/lib/services/embeddings/ratings';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface RagPrediction {
  overall: number;
  reasoning: string;
  confidence: number;
  similar_ratings: Array<{
    video_id: string;
    score: number;
    notes_excerpt: string;
    criteria: Record<string, unknown>;
    similarity: number;
  }>;
  criteria_predictions: Record<string, number | string>;
  model_used: 'rag' | 'base' | 'tuned';
}

/**
 * POST /api/predict-v2
 * 
 * RAG-enhanced prediction that uses similar rated videos as context
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, useRag = true, minSimilarRatings = 3 } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 }
      );
    }

    // Get video details
    const { data: video, error: videoError } = await supabase
      .from('analyzed_videos')
      .select('id, video_url, gcs_uri, metadata, visual_analysis')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check if we have enough ratings for RAG
    const { count: ratingCount } = await supabase
      .from('ratings_v2')
      .select('*', { count: 'exact', head: true });

    const hasEnoughRatings = (ratingCount || 0) >= minSimilarRatings;

    let prediction: RagPrediction;

    if (useRag && hasEnoughRatings && video.visual_analysis) {
      // RAG-enhanced prediction
      prediction = await predictWithRag(video, minSimilarRatings);
    } else {
      // Fallback to base model
      prediction = await predictWithBaseModel(video);
    }

    // Save prediction to video
    await supabase
      .from('analyzed_videos')
      .update({
        visual_analysis: {
          ...video.visual_analysis,
          ai_prediction_v2: prediction,
          predicted_at: new Date().toISOString(),
        },
      })
      .eq('id', videoId);

    return NextResponse.json({
      success: true,
      prediction,
      video: {
        id: video.id,
        url: video.video_url,
        title: video.metadata?.title,
      },
    });

  } catch (error) {
    console.error('Prediction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Prediction failed' },
      { status: 500 }
    );
  }
}

/**
 * RAG prediction using similar rated videos
 */
async function predictWithRag(
  video: { id: string; gcs_uri?: string; visual_analysis?: Record<string, unknown> },
  minSimilar: number
): Promise<RagPrediction> {
  // Generate embedding for this video's analysis
  const analysisText = JSON.stringify(video.visual_analysis || {});
  const queryEmbedding = await generateQueryEmbedding(analysisText);

  // Find similar rated videos
  const { data: similarRatings, error } = await supabase.rpc('find_similar_ratings', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_threshold: 0.3,
    match_count: 5,
    exclude_video_id: video.id,
  });

  if (error || !similarRatings || similarRatings.length < minSimilar) {
    // Not enough similar ratings, fall back to base
    console.log(`RAG: Only found ${similarRatings?.length || 0} similar ratings, falling back to base`);
    return predictWithBaseModel(video);
  }

  // Build context from similar ratings
  const contextExamples = similarRatings.map((r: {
    overall_score: number;
    notes: string;
    extracted_criteria: Record<string, unknown>;
    similarity: number;
    video_id: string;
  }) => ({
    score: r.overall_score,
    notes: r.notes.slice(0, 300),
    criteria: r.extracted_criteria,
    similarity: r.similarity,
  }));

  // Calculate weighted prediction
  const totalSimilarity = contextExamples.reduce((sum: number, e: { similarity: number }) => sum + e.similarity, 0);
  const weightedScore = contextExamples.reduce((sum: number, e: { score: number; similarity: number }) => 
    sum + (e.score * e.similarity), 0
  ) / totalSimilarity;

  // Aggregate criteria predictions
  const criteriaAggregation: Record<string, number[]> = {};
  for (const example of contextExamples) {
    for (const [key, value] of Object.entries(example.criteria || {})) {
      if (typeof value === 'number') {
        if (!criteriaAggregation[key]) criteriaAggregation[key] = [];
        criteriaAggregation[key].push(value);
      }
    }
  }

  const criteriaPredictions: Record<string, number> = {};
  for (const [key, values] of Object.entries(criteriaAggregation)) {
    criteriaPredictions[key] = values.reduce((a, b) => a + b, 0) / values.length;
  }

  // Generate reasoning
  const reasoning = generateRagReasoning(contextExamples, weightedScore);

  return {
    overall: Math.round(weightedScore * 100) / 100,
    reasoning,
    confidence: Math.min(0.9, 0.5 + contextExamples.length * 0.1),
    similar_ratings: similarRatings.map((r: {
      video_id: string;
      overall_score: number;
      notes: string;
      extracted_criteria: Record<string, unknown>;
      similarity: number;
    }) => ({
      video_id: r.video_id,
      score: r.overall_score,
      notes_excerpt: r.notes.slice(0, 100) + '...',
      criteria: r.extracted_criteria,
      similarity: r.similarity,
    })),
    criteria_predictions: criteriaPredictions,
    model_used: 'rag',
  };
}

/**
 * Generate reasoning from similar ratings
 */
function generateRagReasoning(
  examples: Array<{ score: number; notes: string; similarity: number }>,
  predictedScore: number
): string {
  const highScored = examples.filter(e => e.score >= 0.7);
  const lowScored = examples.filter(e => e.score <= 0.5);

  let reasoning = `Based on ${examples.length} similar videos you've rated:\n`;

  if (highScored.length > 0) {
    reasoning += `\nHigh-rated similar: "${highScored[0].notes.slice(0, 100)}..."`;
  }

  if (lowScored.length > 0) {
    reasoning += `\nLow-rated similar: "${lowScored[0].notes.slice(0, 100)}..."`;
  }

  reasoning += `\n\nPredicted score: ${predictedScore.toFixed(2)} (weighted by similarity)`;

  return reasoning;
}

/**
 * Base model prediction (fallback)
 */
async function predictWithBaseModel(
  video: { id: string; gcs_uri?: string }
): Promise<RagPrediction> {
  if (!video.gcs_uri) {
    return {
      overall: 0.5,
      reasoning: 'Video not uploaded to cloud storage yet',
      confidence: 0.1,
      similar_ratings: [],
      criteria_predictions: {},
      model_used: 'base',
    };
  }

  const vertexService = createVertexTuningService();

  const prompt = `Analyze this video for a content curator evaluating restaurant/food marketing videos.

Consider:
1. REPLICABILITY: Can other businesses copy this concept easily?
2. PRODUCTION BARRIER: Does it need high production value?
3. ACTING REQUIREMENTS: Does it need skilled performers?
4. TRANSFERABILITY: Does the concept work for different businesses?
5. EMOTIONAL RESONANCE: Is it charming, amusing, engaging?
6. CONTEXT DEPENDENCY: Does it rely on trends/memes/persona?

Respond with JSON:
{
  "overall": <0-1 recommendation score>,
  "criteria": {
    "replicability": <0-1>,
    "production_barrier": <0-1>,
    "acting_barrier": <0-1>,
    "transferability": <0-1>,
    "emotional_resonance": <0-1>,
    "context_dependency": <0-1>
  },
  "reasoning": "<2-3 sentences explaining your analysis>"
}`;

  try {
    const result = await vertexService.analyzeVideoWithGemini(video.gcs_uri, prompt);

    return {
      overall: result.overall || 0.5,
      reasoning: result.reasoning || '',
      confidence: 0.5,
      similar_ratings: [],
      criteria_predictions: result.dimensions || {},
      model_used: 'base',
    };
  } catch (error) {
    console.error('Base model prediction failed:', error);
    return {
      overall: 0.5,
      reasoning: 'Prediction failed',
      confidence: 0.1,
      similar_ratings: [],
      criteria_predictions: {},
      model_used: 'base',
    };
  }
}
