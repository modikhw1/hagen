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
// Includes SCRIPT analysis for humor, meaning, and replicability
// V2: Added casting, production, flexibility, trends, brand, standalone, execution sections
// Based on user's rating notes and calibration feedback
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
    "emotionalTone": "dominant emotion conveyed"
  },
  "script": {
    "conceptCore": "one-sentence description of the replicable concept/format that could be copied by another creator",
    "hasScript": <boolean, does this video follow a scripted narrative vs spontaneous content>,
    "scriptQuality": <1-10, how well-written/structured is the script (null if unscripted)>,
    "transcript": "approximate transcript or description of what is said/shown",
    "humor": {
      "isHumorous": <boolean>,
      "humorType": "subversion|absurdist|observational|physical|wordplay|callback|contrast|deadpan|escalation|satire|parody|none",
      "humorMechanism": "detailed explanation of HOW the humor works - what expectation is set up and how it's subverted or resolved",
      "comedyTiming": <1-10, effectiveness of timing and beats>,
      "absurdismLevel": <1-10, how much does this violate normal logic or expectations>,
      "surrealismLevel": <1-10, how much does this distort reality or use dream-like elements>
    },
    "structure": {
      "hookType": "question|statement|action|mystery|pattern-interrupt|relatable-situation|visual-shock",
      "hook": "what happens in first 1-3 seconds to grab attention",
      "setup": "what expectation, context, or premise is established",
      "development": "how does the middle section build on the setup",
      "payoff": "how is the expectation resolved, subverted, or paid off",
      "payoffStrength": <1-10, how satisfying is the conclusion>,
      "hasCallback": <boolean, does it reference earlier elements>,
      "hasTwist": <boolean, is there an unexpected turn>
    },
    "emotional": {
      "primaryEmotion": "the main emotion being engineered (humor, awe, curiosity, FOMO, nostalgia, satisfaction, shock, warmth, etc)",
      "emotionalArc": "how emotion changes through the video",
      "emotionalIntensity": <1-10, strength of emotional impact>,
      "relatability": <1-10, how much can average viewer relate to this>
    },
    "replicability": {
      "score": <1-10, how easy is this concept to recreate with different content>,
      "template": "describe the templatable format in one sentence that another business could follow",
      "requiredElements": ["list elements ESSENTIAL to make this concept work"],
      "variableElements": ["list elements that can be swapped for different contexts"],
      "resourceRequirements": "low|medium|high - what's needed to recreate this",
      "contextDependency": <1-10, how much does this rely on specific context/brand/person (1=universal, 10=only works for this creator)>
    },
    "originality": {
      "score": <1-10, how fresh/novel is this concept>,
      "similarFormats": ["list any known formats this resembles"],
      "novelElements": ["what makes this different from similar content"]
    }
  },
  "casting": {
    "minimumPeople": <integer, minimum number of people required to execute this concept>,
    "requiresCustomer": <boolean, does this need a customer/stranger to participate?>,
    "attractivenessDependency": <1-10, how much does this video rely on physical attractiveness of the subject? 1=works with anyone, 10=only works because subject is attractive>,
    "personalityDependency": <1-10, does this require a specific 'larger than life' or charismatic personality? 1=neutral delivery works, 10=requires specific persona>,
    "actingSkillRequired": <1-10, level of acting/improv ability needed to pull this off. 1=just stand there, 10=method acting required>,
    "castingNotes": "explanation of who could realistically perform this"
  },
  "production": {
    "shotComplexity": <1-10, number of unique camera setups/angles required. 1=single static shot, 10=complex multi-camera>,
    "editingDependency": <1-10, how much does this concept rely on editing to work? 1=works in single take, 10=editing IS the joke>,
    "timeToRecreate": "15min|30min|1hr|2hr|half-day|full-day - estimated time to shoot and edit a replica",
    "equipmentNeeded": ["list equipment beyond a smartphone that would be needed"],
    "productionNotes": "explanation of production complexity"
  },
  "flexibility": {
    "industryLock": <1-10, is this concept locked to a specific industry/business type? 1=works anywhere, 10=only works for this exact business type>,
    "industryExamples": ["list 3-5 business types that could use this exact concept"],
    "propDependency": <1-10, does this require specific props that others won't have? 1=no props, 10=requires specific branded/custom items>,
    "swappableCore": <boolean, can the central object/topic be easily replaced?>,
    "swapExamples": "examples of what could be swapped (e.g., 'snus→any craving, taco→any food')",
    "flexibilityNotes": "explanation of how adaptable this concept is"
  },
  "trends": {
    "memeDependent": <boolean, does this rely on a current meme/trend to land?>,
    "trendName": "name of the meme/trend if applicable, or null",
    "trendLifespan": "dead-meme|dying|current|evergreen-trope|not-trend-dependent",
    "insideJokeDependency": <1-10, does this rely on creator's recurring jokes/persona? 1=standalone, 10=only makes sense to their audience>,
    "culturalSpecificity": <1-10, how culture/region-specific is this? 1=universal, 10=only works in specific culture>,
    "trendNotes": "explanation of trend/cultural dependencies"
  },
  "brand": {
    "riskLevel": <1-10, how risky is this for a conservative brand? 1=safe/corporate-friendly, 10=edgy/could backfire>,
    "toneMatch": ["corporate", "playful", "edgy", "youthful", "wholesome", "irreverent"] - select all that apply,
    "adultThemes": <boolean, contains adult/suggestive content?>,
    "brandExclusions": ["list brand types that should NOT use this concept"],
    "brandNotes": "explanation of brand fit considerations"
  },
  "standalone": {
    "worksWithoutContext": <1-10, does this work for someone who has never seen this creator? 1=needs backstory, 10=completely self-contained>,
    "worksWithoutProduct": <boolean, can this work without featuring a specific product?>,
    "requiresSetup": <boolean, does this need external context like a previous video or trend knowledge?>,
    "standaloneNotes": "explanation of how self-contained this concept is"
  },
  "execution": {
    "physicalComedyLevel": <1-10, how much does this rely on physical comedy/expressions? 1=dialogue-driven, 10=all physical/visual gags>,
    "timingCriticality": <1-10, how much does success depend on perfect timing in delivery? 1=forgiving, 10=one beat off and it fails>,
    "improvisationRoom": <1-10, how much can the performer improvise vs follow exact script? 1=must be exact, 10=lots of room to riff>,
    "executionNotes": "explanation of execution requirements"
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

IMPORTANT CONTEXT: This analysis is for a service that helps businesses replicate viral video concepts. The key question is: "Can another business recreate this concept successfully?" 

Focus especially on:
1. CASTING: Does success depend on the specific person's looks, personality, or acting ability?
2. PRODUCTION: How much equipment/editing/time is needed?
3. FLEXIBILITY: Can this work for different business types, or is it locked to one industry?
4. STANDALONE: Does this work without knowing the creator or trend context?

For the "script" section, analyze the CONCEPT and STRUCTURE as intellectual property that could be extracted and reused. Be specific about humor mechanics - don't just say "it's funny", explain WHY and HOW it creates humor.

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
