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
      gemini_analysis,
      similar_videos
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
    
    // Include Gemini's interpretation for context
    if (gemini_analysis?.humor_analysis?.primary_type) {
      embeddingParts.push(`Gemini saw: ${gemini_analysis.humor_analysis.primary_type}`);
    }
    if (gemini_analysis?.joke_structure?.mechanism) {
      embeddingParts.push(`Mechanism: ${gemini_analysis.joke_structure.mechanism}`);
    }
    if (gemini_analysis?.humor_analysis?.why_funny) {
      embeddingParts.push(`Why funny: ${gemini_analysis.humor_analysis.why_funny}`);
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

    // Step 4: Build dimensions from Gemini scores
    const dimensions = gemini_analysis?.scores ? {
      hook: gemini_analysis.scores.hook || overallScore,
      pacing: gemini_analysis.scores.pacing || overallScore,
      originality: gemini_analysis.scores.originality || overallScore,
      payoff: gemini_analysis.scores.payoff || overallScore,
      rewatchable: gemini_analysis.scores.rewatchable || overallScore
    } : {
      hook: overallScore,
      pacing: overallScore,
      originality: overallScore,
      payoff: overallScore,
      rewatchable: overallScore
    };

    // Step 5: Build combined notes
    const combinedNotes = [
      `[${quality_tier.toUpperCase()}]`,
      notes,
      replicability_notes ? `Replicability: ${replicability_notes}` : null,
      brand_tone_notes ? `Brand/Tone: ${brand_tone_notes}` : null
    ].filter(Boolean).join('\n\n');

    // Step 6: Insert into video_ratings
    const { data, error } = await supabase
      .from('video_ratings')
      .insert({
        video_id: videoId,
        overall_score: overallScore,
        dimensions,
        notes: combinedNotes,
        tags: [quality_tier, gemini_analysis?.humor_analysis?.primary_type].filter(Boolean),
        ai_prediction: gemini_analysis,
        replicability_notes: replicability_notes || null,
        brand_context: brand_tone_notes || null,
        humor_type: gemini_analysis?.humor_analysis?.primary_type || null
      })
      .select()
      .single();

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
