/**
 * Analysis Corrections API
 * 
 * Stores corrections to Gemini's analysis for learning
 * Now wired to the RAG-based video analysis learning system
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { saveVideoAnalysisExample } from '@/lib/services/video/learning';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/corrections
 * 
 * Save a correction to Gemini's analysis AND create a learning example for RAG
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

    // Save the correction to analysis_corrections table (legacy)
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

    // Get the video ID if it exists
    const { data: existingVideo } = await supabase
      .from('analyzed_videos')
      .select('id, metadata, visual_analysis')
      .eq('video_url', videoUrl)
      .single();

    // === NEW: Save to video_analysis_examples for RAG learning ===
    const videoSummary = originalAnalysis?.content?.keyMessage ||
                         originalAnalysis?.visual?.summary ||
                         originalAnalysis?.script?.conceptCore ||
                         'Video analysis';
    
    const geminiInterpretation = originalAnalysis?.script?.humor?.humorType ||
                                  originalAnalysis?.script?.humor?.humorMechanism ||
                                  'Gemini interpretation';

    // Determine example type based on correction
    let exampleType: 'humor_interpretation' | 'cultural_context' | 'visual_punchline' | 'misdirection' | 'replicability' = 'humor_interpretation';
    const notesLower = (notes || '').toLowerCase();
    if (notesLower.includes('cultural') || notesLower.includes('generation') || notesLower.includes('gen z') || notesLower.includes('millennial')) {
      exampleType = 'cultural_context';
    } else if (notesLower.includes('visual') || notesLower.includes('cut') || notesLower.includes('edit') || notesLower.includes('reveal')) {
      exampleType = 'visual_punchline';
    } else if (notesLower.includes('misdirect') || notesLower.includes('subvert') || notesLower.includes('expect')) {
      exampleType = 'misdirection';
    }

    // Extract humor types from the correction
    const humorTypes: string[] = [];
    if (correction.humor_type) {
      // Try to extract humor type keywords
      const humorKeywords = ['wordplay', 'visual-reveal', 'subversion', 'absurdist', 'observational', 
                             'physical', 'callback', 'contrast', 'deadpan', 'escalation', 'satire', 
                             'parody', 'edit-punchline', 'exaggeration', 'self-deprecating'];
      const correctionLower = correction.humor_type.toLowerCase();
      for (const keyword of humorKeywords) {
        if (correctionLower.includes(keyword)) {
          humorTypes.push(keyword);
        }
      }
    }

    const learningResult = await saveVideoAnalysisExample({
      videoId: existingVideo?.id,
      videoUrl,
      exampleType,
      videoSummary,
      geminiInterpretation,
      correctInterpretation: notes || correction.humor_type || correction.joke_structure || 'Corrected',
      explanation: notes || 'Human correction of Gemini analysis',
      humorTypeCorrection: correction.humor_type ? {
        original: originalAnalysis?.script?.humor?.humorType || 'unknown',
        correct: correction.humor_type,
        why: notes || 'User correction'
      } : undefined,
      humorTypes,
      industry: 'restaurant', // Default for hospitality focus
      qualityScore: 0.9  // Human corrections are high quality
    });

    if (learningResult.success) {
      console.log(`✅ Created learning example: ${learningResult.id}`);
    } else {
      console.warn('⚠️ Failed to create learning example:', learningResult.error);
    }

    // If this video exists, update its embedding with the correction
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
      embeddingUpdated: !!existingVideo,
      learningExampleCreated: learningResult.success,
      learningExampleId: learningResult.id
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
