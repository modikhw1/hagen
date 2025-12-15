import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      video_url,
      quality_tier,
      notes,
      replicability_notes,
      brand_tone_notes,
      analysis_notes,
      gemini_analysis,
      similar_videos,
      // v1.1: Complete structured signals
      structured_replicability,
      risk_level_signals,
      environment_signals,
      target_audience_signals
    } = body;

    if (!video_url || !quality_tier) {
      return NextResponse.json(
        { error: 'video_url and quality_tier are required' },
        { status: 400 }
      );
    }

    // Step 1: Find or create the video in analyzed_videos
    let videoId: string;
    
    // Extract platform video ID from URL
    const extractPlatformVideoId = (url: string): string => {
      // TikTok: /video/1234567890
      const tiktokMatch = url.match(/video\/(\d+)/);
      if (tiktokMatch) return tiktokMatch[1];
      
      // YouTube: v=xxxxx or youtu.be/xxxxx
      const ytMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (ytMatch) return ytMatch[1];
      
      // Instagram: /reel/xxxxx or /p/xxxxx
      const igMatch = url.match(/(?:reel|p)\/([a-zA-Z0-9_-]+)/);
      if (igMatch) return igMatch[1];
      
      // Fallback: hash the URL
      return video_url.replace(/[^a-zA-Z0-9]/g, '').slice(-20);
    };
    
    const platformVideoId = extractPlatformVideoId(video_url);
    
    // Check if video already exists
    const { data: existingVideo } = await supabase
      .from('analyzed_videos')
      .select('id')
      .eq('video_url', video_url)
      .single();
    
    if (existingVideo) {
      videoId = existingVideo.id;
    } else {
      // Create new video entry
      const { data: newVideo, error: createError } = await supabase
        .from('analyzed_videos')
        .insert({
          video_url,
          video_id: platformVideoId,
          platform: video_url.includes('tiktok') ? 'tiktok' : 
                   video_url.includes('youtube') ? 'youtube' : 
                   video_url.includes('instagram') ? 'instagram' : 'unknown',
          visual_analysis: gemini_analysis
        })
        .select('id')
        .single();
      
      if (createError) {
        console.error('Error creating video:', createError);
        return NextResponse.json(
          { error: 'Failed to create video entry', details: createError.message },
          { status: 500 }
        );
      }
      videoId = newVideo.id;
    }

    // Step 2: Build embedding text from all notes
    const embeddingParts: string[] = [];
    
    embeddingParts.push(`Quality: ${quality_tier}`);
    
    if (notes) {
      embeddingParts.push(`Notes: ${notes}`);
    }
    
    if (replicability_notes) {
      embeddingParts.push(`Replicability: ${replicability_notes}`);
    }
    
    if (brand_tone_notes) {
      embeddingParts.push(`Brand/Tone: ${brand_tone_notes}`);
    }
    
    // Include user's corrections to the AI analysis
    if (analysis_notes) {
      embeddingParts.push(`Analysis corrections: ${analysis_notes}`);
    }
    
    // Include Gemini's interpretation for context (using correct structure)
    if (gemini_analysis?.script?.humor?.humorType) {
      embeddingParts.push(`Gemini saw: ${gemini_analysis.script.humor.humorType}`);
    }
    if (gemini_analysis?.script?.humor?.humorMechanism) {
      embeddingParts.push(`Mechanism: ${gemini_analysis.script.humor.humorMechanism}`);
    }
    if (gemini_analysis?.visual?.summary) {
      embeddingParts.push(`Visual: ${gemini_analysis.visual.summary}`);
    }

    const embeddingText = embeddingParts.join('\n');

    // Step 3: Convert quality tier to numeric score
    const tierToScore: Record<string, number> = {
      'excellent': 0.9,
      'good': 0.7,
      'mediocre': 0.5,
      'bad': 0.3
    };
    const overallScore = tierToScore[quality_tier] || 0.5;

    // Step 4: Build dimensions from Gemini scores (using correct structure)
    const dimensions = {
      hook: (gemini_analysis?.visual?.hookStrength || 0) / 10 || overallScore,
      pacing: (gemini_analysis?.technical?.pacing || 0) / 10 || overallScore,
      originality: (gemini_analysis?.script?.originality?.score || 0) / 10 || overallScore,
      payoff: (gemini_analysis?.script?.structure?.payoffStrength || 0) / 10 || overallScore,
      rewatchable: (gemini_analysis?.engagement?.replayValue || 0) / 10 || overallScore
    };

    // Step 5: Build combined notes
    const combinedNotes = [
      `[${quality_tier.toUpperCase()}]`,
      notes,
      replicability_notes ? `Replicability: ${replicability_notes}` : null,
      brand_tone_notes ? `Brand/Tone: ${brand_tone_notes}` : null,
      analysis_notes ? `Analysis Notes: ${analysis_notes}` : null
    ].filter(Boolean).join('\n\n');

    // Step 6: Upsert into video_brand_ratings (the main table for v1.1 signals)
    // This table has the JSONB columns for fingerprint signals
    const brandRatingData = {
      video_id: videoId,
      rater_id: 'primary', // Default rater for general video ratings
      personality_notes: combinedNotes, // Store combined notes in personality_notes field
      // v1.1 JSONB signal columns
      replicability_signals: structured_replicability ? {
        actor_count: structured_replicability.actor_count,
        setup_complexity: structured_replicability.setup_complexity,
        skill_required: structured_replicability.skill_required,
        environment_dependency: structured_replicability.environment_dependency || null,
        equipment_needed: structured_replicability.equipment_needed || [],
        estimated_time: structured_replicability.estimated_time
      } : null,
      risk_level_signals: risk_level_signals ? {
        content_edge: risk_level_signals.content_edge,
        humor_risk: risk_level_signals.humor_risk,
        trend_reliance: risk_level_signals.trend_reliance,
        controversy_potential: risk_level_signals.controversy_potential
      } : null,
      environment_signals: environment_signals ? {
        setting_type: environment_signals.setting_type,
        space_requirements: environment_signals.space_requirements,
        lighting_conditions: environment_signals.lighting_conditions,
        noise_tolerance: environment_signals.noise_tolerance,
        customer_visibility: environment_signals.customer_visibility
      } : null,
      audience_signals: target_audience_signals ? {
        age_range: target_audience_signals.age_range,
        income_level: target_audience_signals.income_level,
        lifestyle_tags: target_audience_signals.lifestyle_tags || [],
        primary_occasion: target_audience_signals.primary_occasion,
        vibe_alignment: target_audience_signals.vibe_alignment
      } : null
    };

    // Upsert into video_brand_ratings
    const { error: brandRatingError } = await supabase
      .from('video_brand_ratings')
      .upsert(brandRatingData, { onConflict: 'video_id,rater_id' });

    if (brandRatingError) {
      console.error('Error saving to video_brand_ratings:', brandRatingError);
      // Continue - don't fail the whole request
    }

    // Step 7: Also upsert into video_ratings (legacy table for compatibility)
    const ratingData = {
      video_id: videoId,
      overall_score: overallScore,
      dimensions,
      notes: combinedNotes,
      tags: [quality_tier, gemini_analysis?.script?.humor?.humorType].filter(Boolean),
      ai_prediction: gemini_analysis,
      replicability_notes: replicability_notes || null,
      brand_context: brand_tone_notes || null,
      humor_type: gemini_analysis?.script?.humor?.humorType || null
    };

    // Check if rating exists
    const { data: existingRating } = await supabase
      .from('video_ratings')
      .select('id')
      .eq('video_id', videoId)
      .eq('rater_id', 'primary')
      .single();

    let data;
    let error;

    if (existingRating) {
      // Update existing rating
      const result = await supabase
        .from('video_ratings')
        .update(ratingData)
        .eq('id', existingRating.id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Insert new rating
      const result = await supabase
        .from('video_ratings')
        .insert({ ...ratingData, rater_id: 'primary' })
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to save rating', details: error.message },
        { status: 500 }
      );
    }

    // Step 7: Update analyzed_videos with embedding
    await supabase
      .from('analyzed_videos')
      .update({ 
        content_embedding: await generateEmbedding(embeddingText),
        rated_at: new Date().toISOString()
      })
      .eq('id', videoId);

    return NextResponse.json({
      success: true,
      id: data.id,
      video_id: videoId,
      quality_tier,
      message: 'Rating saved and embedded for future learning'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return response.data[0].embedding;
}
