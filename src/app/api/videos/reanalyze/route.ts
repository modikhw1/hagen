/**
 * Batch Re-analyze Videos API
 * 
 * POST /api/videos/reanalyze
 * Re-run Gemini analysis on existing videos to restore rich visual_analysis
 * Uses Vertex AI REST API which supports GCS URIs directly
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createVertexTuningService } from '@/lib/services/vertex/training';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Comprehensive analysis prompt for Gemini via Vertex AI
const COMPREHENSIVE_ANALYSIS_PROMPT = `Analyze this video comprehensively and provide a structured JSON response with the following sections:

{
  "visual": {
    "hookStrength": <1-10, rate how compelling the first 3 seconds are>,
    "hookDescription": "detailed explanation of what makes the opening work or not work",
    "overallQuality": <1-10, production value and visual polish>,
    "mainElements": ["list all key visual elements"],
    "colorPalette": ["dominant colors used"],
    "colorDiversity": <1-10, variety and impact of colors>,
    "transitions": ["types of transitions between shots"],
    "textOverlays": ["any text that appears on screen"],
    "visualHierarchy": "what draws the eye and when",
    "compositionQuality": <1-10>,
    "peopleCount": <number of people visible, 0 if none>,
    "settingType": "indoor/outdoor/mixed/animated",
    "summary": "comprehensive visual analysis"
  },
  "audio": {
    "quality": <1-10, audio production quality>,
    "musicType": "background music category or none",
    "musicGenre": "specific genre if applicable",
    "hasVoiceover": <boolean>,
    "voiceoverQuality": <1-10 or null if no voiceover>,
    "voiceoverTone": "tone and delivery style",
    "energyLevel": "low/medium/high",
    "audioEnergy": <1-10, intensity and engagement>,
    "soundEffects": ["list all sound effects used"],
    "audioVisualSync": <1-10, how well audio matches visuals>
  },
  "content": {
    "topic": "precise topic/subject matter",
    "style": "content style (educational, entertaining, inspirational, etc)",
    "format": "video format (talking head, montage, tutorial, skit, etc)",
    "duration": <exact duration in seconds>,
    "keyMessage": "core message or takeaway",
    "narrativeStructure": "how the story/content unfolds",
    "targetAudience": "who this appeals to",
    "emotionalTone": "dominant emotion conveyed",
    "humorStyle": "type of humor if present (absurdist, observational, physical, none)",
    "actingRequired": <1-10, how much acting skill would be needed to replicate>,
    "productionBarrier": <1-10, how hard would this be to produce (equipment, editing, etc)>,
    "replicability": <1-10, how easy to replicate with basic resources>
  },
  "technical": {
    "pacing": <1-10, how well the video maintains momentum>,
    "editingStyle": "editing approach description",
    "cutsPerMinute": <approximate number>,
    "cameraWork": "camera techniques used",
    "lighting": "lighting quality description"
  },
  "engagement": {
    "attentionRetention": <1-10, predicted ability to hold attention>,
    "shareability": <1-10, likelihood of being shared>,
    "replayValue": <1-10, desire to watch multiple times>,
    "scrollStopPower": <1-10, ability to stop scrolling>
  }
}

Be specific and detailed. Rate everything on 1-10 scales. Return valid JSON only.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { videoIds, limit = 3 } = body;

    // Get videos to re-analyze
    let query = supabase
      .from('analyzed_videos')
      .select('id, gcs_uri, video_url, visual_analysis')
      .not('gcs_uri', 'is', null);

    if (videoIds && videoIds.length > 0) {
      query = query.in('id', videoIds);
    }

    const { data: videos, error } = await query.limit(limit);

    if (error || !videos) {
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
    }

    console.log(`🔄 Re-analyzing ${videos.length} videos with Vertex AI Gemini...`);

    const vertexService = createVertexTuningService();
    const results: Array<{ id: string; success: boolean; error?: string; features?: number }> = [];

    for (const video of videos) {
      try {
        console.log(`  📹 Analyzing ${video.id}...`);
        
        // Use Vertex AI REST API (supports GCS URIs)
        // analyzeVideoWithGemini returns parsed JSON directly from Gemini
        const analysis = await vertexService.analyzeVideoWithGemini(
          video.gcs_uri,
          COMPREHENSIVE_ANALYSIS_PROMPT
        );

        // The result is already parsed JSON with our structure
        // analyzeVideoWithGemini does: return JSON.parse(jsonMatch[0])
        // So 'analysis' already contains { visual, audio, content, ... }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let parsedAnalysis: any = analysis;
        
        // If it has 'reasoning' but no 'visual', it failed to parse properly
        if ('reasoning' in analysis && !('visual' in analysis)) {
          console.log('  ⚠️ Got unstructured response, attempting to parse...');
          try {
            const text = analysis.reasoning as string;
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedAnalysis = JSON.parse(jsonMatch[0]);
            } else {
              parsedAnalysis = { 
                visual: { summary: text },
                rawResponse: analysis 
              };
            }
          } catch {
            parsedAnalysis = { 
              visual: { summary: analysis.reasoning },
              rawResponse: analysis 
            };
          }
        }
        
        console.log('  📊 Analysis structure:', Object.keys(parsedAnalysis));

        // Preserve any existing ai_prediction
        const existingPrediction = video.visual_analysis?.ai_prediction;

        // Count features extracted
        const featureCount = countFeatures(parsedAnalysis);

        // Save the rich analysis
        const { error: updateError } = await supabase
          .from('analyzed_videos')
          .update({
            visual_analysis: {
              ...parsedAnalysis,
              ai_prediction: existingPrediction || null,
              analyzed_at: new Date().toISOString(),
              analysis_model: 'gemini-2.0-flash-vertex',
              feature_count: featureCount,
            },
            analyzed_at: new Date().toISOString(),
          })
          .eq('id', video.id);

        if (updateError) {
          results.push({ id: video.id, success: false, error: updateError.message });
        } else {
          results.push({ id: video.id, success: true, features: featureCount });
          console.log(`  ✅ ${video.id} - ${featureCount} features extracted`);
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ id: video.id, success: false, error: errorMsg });
        console.error(`  ❌ ${video.id} - ${errorMsg}`);
      }

      // Delay between videos to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalFeatures = results.reduce((sum, r) => sum + (r.features || 0), 0);

    console.log(`\n✅ Re-analysis complete: ${successful} succeeded, ${failed} failed, ${totalFeatures} total features`);

    return NextResponse.json({
      success: true,
      summary: {
        total: videos.length,
        successful,
        failed,
        totalFeatures,
      },
      results,
    });

  } catch (error) {
    console.error('Re-analysis failed:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Re-analysis failed',
    }, { status: 500 });
  }
}

/**
 * Count the number of features extracted from analysis
 */
function countFeatures(analysis: Record<string, unknown>): number {
  let count = 0;
  
  function countRecursive(obj: unknown): void {
    if (obj === null || obj === undefined) return;
    if (typeof obj !== 'object') {
      count++;
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach(item => countRecursive(item));
      return;
    }
    Object.values(obj as Record<string, unknown>).forEach(val => countRecursive(val));
  }
  
  countRecursive(analysis);
  return count;
}

/**
 * GET /api/videos/reanalyze
 * Check which videos need re-analysis (missing rich visual_analysis)
 */
export async function GET() {
  try {
    // Get videos with GCS URIs
    const { data: videos, error } = await supabase
      .from('analyzed_videos')
      .select('id, gcs_uri, visual_analysis')
      .not('gcs_uri', 'is', null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check which have rich analysis vs just prediction
    const needsAnalysis = videos?.filter(v => {
      const analysis = v.visual_analysis;
      // If no analysis, or only has ai_prediction (no visual/audio/content sections)
      return !analysis || 
        (!analysis.visual && !analysis.audio && !analysis.content);
    }) || [];

    const hasRichAnalysis = videos?.filter(v => {
      const analysis = v.visual_analysis;
      return analysis?.visual && analysis?.audio && analysis?.content;
    }) || [];

    return NextResponse.json({
      total: videos?.length || 0,
      needsReanalysis: needsAnalysis.length,
      hasRichAnalysis: hasRichAnalysis.length,
      videoIds: needsAnalysis.map(v => v.id),
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to check videos',
    }, { status: 500 });
  }
}
