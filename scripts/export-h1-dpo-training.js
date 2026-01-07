/**
 * Export H1 Training Pairs to DPO JSONL format for Vertex AI
 *
 * FULL VERSION - Includes ALL variables from:
 * - analyze-rate-v1 (content, humor, script, scenes)
 * - replicability-lab (10 fields + full notes)
 * - fine-tuning-lab v7.b (quality_signals, execution_signals, overall_assessment)
 * - content_classification, culturalContext
 *
 * Usage:
 *   node scripts/export-h1-dpo-training.js --h1=quality_ranking
 *   node scripts/export-h1-dpo-training.js --h1=older_comparison
 *   node scripts/export-h1-dpo-training.js --all
 *
 * Output: datasets/fine-tuning/h1_<name>_dpo.jsonl
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const args = process.argv.slice(2);
  const h1NameArg = args.find(a => a.startsWith('--h1='));
  const exportAll = args.includes('--all');
  const minQuality = args.find(a => a.startsWith('--min-quality='))?.split('=')[1] || 'draft';

  console.log('=== H1 → DPO Export (FULL VARIABLES) ===\n');

  // Get H1 definitions
  const { data: definitions, error: defError } = await supabase
    .from('h1_definitions')
    .select('*')
    .neq('status', 'archived');

  if (defError) {
    console.error('Failed to fetch H1 definitions:', defError);
    process.exit(1);
  }

  console.log(`Found ${definitions.length} active H1 definitions`);

  // Filter to requested H1
  let targetDefs = definitions;
  if (h1NameArg && !exportAll) {
    const h1Name = h1NameArg.split('=')[1];
    targetDefs = definitions.filter(d => d.name === h1Name || d.id === h1Name);
    if (targetDefs.length === 0) {
      console.error(`No H1 definition found matching: ${h1Name}`);
      console.log('Available:', definitions.map(d => d.name).join(', '));
      process.exit(1);
    }
  }

  // Process each H1 definition
  for (const def of targetDefs) {
    console.log(`\n--- Processing: ${def.name} ---`);
    await exportH1ToDPO(def, minQuality);
  }
}

async function exportH1ToDPO(definition, minQuality) {
  // Quality filter
  const qualityOrder = { draft: 0, silver: 1, gold: 2 };
  const minQualityLevel = qualityOrder[minQuality] || 0;

  // Fetch annotations for this H1
  const { data: annotations, error: annError } = await supabase
    .from('h1_training_pairs')
    .select('*')
    .eq('h1_definition_id', definition.id);

  if (annError) {
    console.error(`Failed to fetch annotations for ${definition.name}:`, annError);
    return;
  }

  // Filter by quality
  const filtered = annotations.filter(a =>
    qualityOrder[a.annotation_quality] >= minQualityLevel
  );

  console.log(`  Annotations: ${annotations.length} total, ${filtered.length} >= ${minQuality}`);

  if (filtered.length === 0) {
    console.log(`  Skipping - no qualifying annotations`);
    return;
  }

  // Get all unique clip IDs
  const clipIds = new Set();
  filtered.forEach(a => {
    clipIds.add(a.clip_a_id);
    if (a.clip_b_id) clipIds.add(a.clip_b_id);
  });

  // Fetch visual_analysis for all clips
  const { data: clips, error: clipError } = await supabase
    .from('analyzed_videos')
    .select('id, video_id, video_url, platform, visual_analysis')
    .in('id', Array.from(clipIds));

  if (clipError) {
    console.error(`Failed to fetch clip data:`, clipError);
    return;
  }

  console.log(`  Loaded ${clips.length} clips with visual_analysis`);

  // Build clip lookup
  const clipMap = new Map(clips.map(c => [c.id, c]));

  // Generate DPO records
  const dpoRecords = [];
  let totalTokenEstimate = 0;

  for (const ann of filtered) {
    const clipA = clipMap.get(ann.clip_a_id);
    const clipB = ann.clip_b_id ? clipMap.get(ann.clip_b_id) : null;

    if (!clipA || (ann.clip_b_id && !clipB)) {
      console.log(`  Warning: Missing clip data for annotation ${ann.id}`);
      continue;
    }

    const dpoRecord = createDPORecord(definition, ann, clipA, clipB);
    if (dpoRecord) {
      dpoRecords.push(dpoRecord);
      // Rough token estimate (4 chars per token)
      totalTokenEstimate += Math.ceil(dpoRecord.prompt.length / 4);
    }
  }

  console.log(`  Generated ${dpoRecords.length} DPO training examples`);
  console.log(`  Estimated tokens per prompt: ~${Math.round(totalTokenEstimate / dpoRecords.length)}`);

  // Write to JSONL
  const outputPath = `./datasets/fine-tuning/h1_${definition.name}_dpo.jsonl`;
  const content = dpoRecords.map(r => JSON.stringify(r)).join('\n');
  fs.writeFileSync(outputPath, content);

  const fileSizeKB = Math.round(fs.statSync(outputPath).size / 1024);
  console.log(`  Saved to: ${outputPath} (${fileSizeKB}KB)`);

  // Stats
  const byWinner = { clip_a: 0, clip_b: 0, equal: 0, neither: 0 };
  filtered.forEach(a => {
    byWinner[a.winner || 'neither']++;
  });
  console.log(`  Distribution: A=${byWinner.clip_a}, B=${byWinner.clip_b}, Equal=${byWinner.equal}, Neither=${byWinner.neither}`);
}

/**
 * Create a DPO training record from an annotation
 */
function createDPORecord(definition, annotation, clipA, clipB) {
  // Format clip data for prompt - FULL DEPTH
  const clipAData = formatClipForPromptFull(clipA);
  const clipBData = clipB ? formatClipForPromptFull(clipB) : '';

  // Build the prompt
  const prompt = `You are comparing two TikTok clips to assess: ${definition.question}

CLIP A:
${clipAData}
${clipB ? `
CLIP B:
${clipBData}
` : ''}
HUMAN ANNOTATION:
${annotation.human_note}

Based on this annotation, which clip better answers the question "${definition.question}"?`;

  // Determine chosen/rejected based on winner
  const winner = annotation.winner;
  const confidence = annotation.confidence || 0.7;

  let chosen, rejected;

  if (winner === 'clip_a') {
    chosen = createChosenResponse('A', 'B', annotation, confidence);
    rejected = createRejectedResponse('B', 'A', annotation);
  } else if (winner === 'clip_b') {
    chosen = createChosenResponse('B', 'A', annotation, confidence);
    rejected = createRejectedResponse('A', 'B', annotation);
  } else if (winner === 'equal') {
    chosen = createEqualResponse(annotation, confidence);
    rejected = createFalseDistinctionResponse(annotation);
  } else {
    // Neither - still create a training example
    chosen = createNeitherResponse(annotation, confidence);
    rejected = createFalsePositiveResponse(annotation);
  }

  return { prompt, chosen, rejected };
}

/**
 * Format clip visual_analysis for prompt - FULL DEPTH
 *
 * Includes ALL data from:
 * - analyze-rate-v1 (content, humor, script, scenes)
 * - replicability-lab (all 10 fields + full notes)
 * - fine-tuning-lab v7.b (quality_signals, execution_signals, overall_assessment)
 * - content_classification, culturalContext
 */
function formatClipForPromptFull(clip) {
  const va = clip.visual_analysis || {};
  const sections = [];

  // === HEADER ===
  sections.push(`video_id: ${clip.video_id || 'unknown'}`);
  sections.push(`platform: ${clip.platform}`);
  if (va.schema_version) sections.push(`schema: ${va.schema_version}`);

  // === ANALYZE-RATE-V1: Content ===
  if (va.content) {
    const c = va.content;
    sections.push(`\n[CONTENT]`);
    if (c.format) sections.push(`format: ${c.format}`);
    if (c.conceptCore) sections.push(`concept_core: ${c.conceptCore}`);
    if (c.keyMessage) sections.push(`key_message: ${c.keyMessage}`);
    if (c.emotionalTone) sections.push(`emotional_tone: ${c.emotionalTone}`);
    if (c.style) sections.push(`style: ${c.style}`);
    if (c.targetAudience) sections.push(`target_audience: ${c.targetAudience}`);
  }

  // === ANALYZE-RATE-V1: Humor (FULL) ===
  const humor = va.humor || va.script?.humor;
  if (humor) {
    sections.push(`\n[HUMOR ANALYSIS]`);
    if (humor.humorType) sections.push(`humor_type: ${humor.humorType}`);
    if (humor.humorMechanism) sections.push(`humor_mechanism: ${humor.humorMechanism}`);
    if (humor.whyFunny) sections.push(`why_funny: ${humor.whyFunny}`);
    if (humor.comedyTiming) sections.push(`comedy_timing: ${humor.comedyTiming}`);
    if (humor.punchlineDelivery) sections.push(`punchline_delivery: ${humor.punchlineDelivery}`);
    if (humor.handling) sections.push(`handling: ${humor.handling}`);
  }

  // === ANALYZE-RATE-V1: Script & Transcript ===
  if (va.script) {
    sections.push(`\n[SCRIPT]`);
    if (va.script.transcript) {
      sections.push(`transcript: ${va.script.transcript}`);
    }
  }

  // === ANALYZE-RATE-V1: Scenes (FULL breakdown) ===
  if (va.scenes && va.scenes.length > 0) {
    sections.push(`\n[SCENE BREAKDOWN]`);
    for (const scene of va.scenes) {
      sections.push(`Scene ${scene.number} (${scene.timing}):`);
      if (scene.description) sections.push(`  description: ${scene.description}`);
      if (scene.dialogue) sections.push(`  dialogue: ${scene.dialogue}`);
    }
  }

  // === CULTURAL CONTEXT ===
  if (va.culturalContext) {
    sections.push(`\n[CULTURAL CONTEXT]`);
    sections.push(va.culturalContext);
  }

  // === CONTENT CLASSIFICATION ===
  if (va.content_classification) {
    const cc = va.content_classification;
    sections.push(`\n[CONTENT CLASSIFICATION]`);
    if (cc.primary_type) sections.push(`primary_type: ${cc.primary_type}`);
    if (cc.secondary_types) sections.push(`secondary_types: ${cc.secondary_types.join(', ')}`);
    if (cc.service_relevance) sections.push(`service_relevance: ${cc.service_relevance}`);
    if (cc.confidence) sections.push(`confidence: ${cc.confidence}`);
    if (cc.classification_notes) sections.push(`classification_notes: ${cc.classification_notes}`);
  }

  // === REPLICABILITY-LAB (FULL - all 10 fields + notes) ===
  if (va.replicability) {
    const rep = va.replicability;
    sections.push(`\n[REPLICABILITY ANALYSIS]`);
    sections.push(`overall_replicability_score: ${rep.overall_replicability_score}`);
    sections.push(`concept_difficulty: ${rep.concept_difficulty}`);
    sections.push(`talent_requirement: ${rep.talent_requirement}`);
    sections.push(`execution_skill: ${rep.execution_skill}`);
    sections.push(`timing_complexity: ${rep.timing_complexity}`);
    sections.push(`equipment_needs: ${rep.equipment_needs}`);
    sections.push(`location_dependency: ${rep.location_dependency}`);
    sections.push(`brand_equity_needed: ${rep.brand_equity_needed}`);
    sections.push(`post_production_level: ${rep.post_production_level}`);
    // FULL replicability notes - no truncation
    if (rep.replicability_notes) {
      sections.push(`replicability_notes: ${rep.replicability_notes}`);
    }
  }

  // === FINE-TUNING-LAB V7.B: Quality Signals (FULL) ===
  if (va.quality_signals) {
    const qs = va.quality_signals;
    sections.push(`\n[QUALITY SIGNALS]`);
    sections.push(`hook_strength: ${qs.hook_strength}`);
    sections.push(`attention_retention: ${qs.attention_retention}`);
    sections.push(`visual_clarity: ${qs.visual_clarity}`);
    sections.push(`audio_quality: ${qs.audio_quality}`);
    sections.push(`cuts_per_minute: ${qs.cuts_per_minute}`);
    sections.push(`pacing_appropriate: ${qs.pacing_appropriate}`);

    // Hook Analysis (FULL)
    if (qs.hook_analysis) {
      const ha = qs.hook_analysis;
      sections.push(`\n[HOOK ANALYSIS]`);
      sections.push(`has_hook: ${ha.has_hook}`);
      sections.push(`hook_type: ${ha.hook_type}`);
      sections.push(`effectiveness_rating: ${ha.effectiveness_rating}`);
      if (ha.desperation_signals && ha.desperation_signals.length > 0) {
        sections.push(`desperation_signals: ${ha.desperation_signals.join(', ')}`);
      }
    }

    // Payoff Analysis (FULL)
    if (qs.payoff_analysis) {
      const pa = qs.payoff_analysis;
      sections.push(`\n[PAYOFF ANALYSIS]`);
      sections.push(`has_payoff: ${pa.has_payoff}`);
      sections.push(`payoff_type: ${pa.payoff_type}`);
      sections.push(`matches_hook: ${pa.matches_hook}`);
      sections.push(`earned_vs_cheap: ${pa.earned_vs_cheap}`);
    }
  }

  // === FINE-TUNING-LAB V7.B: Execution Signals (FULL) ===
  if (va.execution_signals) {
    const es = va.execution_signals;

    // Narrative Flow
    if (es.narrative_flow) {
      sections.push(`\n[NARRATIVE FLOW]`);
      sections.push(`clarity: ${es.narrative_flow.clarity}`);
      sections.push(`pacing_feel: ${es.narrative_flow.pacing_feel}`);
      sections.push(`emotional_arc: ${es.narrative_flow.emotional_arc}`);
    }

    // Performer Execution
    if (es.performer_execution) {
      const pe = es.performer_execution;
      sections.push(`\n[PERFORMER EXECUTION]`);
      sections.push(`presence_score: ${pe.presence_score}`);
      sections.push(`delivery_timing: ${pe.delivery_timing}`);
      sections.push(`authenticity_score: ${pe.authenticity_score}`);
      sections.push(`social_risk_level: ${pe.social_risk_level}`);
    }

    // Production Polish
    if (es.production_polish) {
      const pp = es.production_polish;
      sections.push(`\n[PRODUCTION POLISH]`);
      sections.push(`sound_design: ${pp.sound_design}`);
      sections.push(`color_grading: ${pp.color_grading}`);
      sections.push(`transition_quality: ${pp.transition_quality}`);
    }
  }

  // === FINE-TUNING-LAB V7.B: Overall Assessment (FULL - this is the rich analysis) ===
  if (va.overall_assessment) {
    const oa = va.overall_assessment;
    sections.push(`\n[OVERALL ASSESSMENT]`);

    if (oa.sigma_taste_score !== undefined) {
      sections.push(`sigma_taste_score: ${oa.sigma_taste_score}`);
    }

    if (oa.strengths && oa.strengths.length > 0) {
      sections.push(`strengths: ${oa.strengths.join(', ')}`);
    }

    if (oa.weaknesses && oa.weaknesses.length > 0) {
      sections.push(`weaknesses: ${oa.weaknesses.join(', ')}`);
    }

    // FULL score reasoning - this is the rich trained analysis
    if (oa.score_reasoning) {
      sections.push(`score_reasoning: ${oa.score_reasoning}`);
    }

    if (oa.standout_moment) {
      sections.push(`standout_moment: ${oa.standout_moment}`);
    }

    // FULL comparison notes - rich contextual analysis
    if (oa.comparison_notes) {
      sections.push(`comparison_notes: ${oa.comparison_notes}`);
    }

    if (oa.improvement_suggestions && oa.improvement_suggestions.length > 0) {
      sections.push(`improvement_suggestions: ${oa.improvement_suggestions.join('; ')}`);
    }
  }

  return sections.join('\n');
}

function createChosenResponse(winner, loser, annotation, confidence) {
  return `CLIP ${winner} ranks higher for this dimension.

Reasoning: ${annotation.human_note}

${annotation.winner_reasoning ? `Additional context: ${annotation.winner_reasoning}` : ''}

Confidence: ${confidence.toFixed(2)}`;
}

function createRejectedResponse(wrongWinner, actualWinner, annotation) {
  return `CLIP ${wrongWinner} ranks higher for this dimension.

Reasoning: This clip seems adequate without considering the deeper quality signals.

Confidence: 0.35`;
}

function createEqualResponse(annotation, confidence) {
  return `These clips are roughly EQUAL on this dimension.

Reasoning: ${annotation.human_note}

Confidence: ${confidence.toFixed(2)}`;
}

function createFalseDistinctionResponse(annotation) {
  return `CLIP A ranks significantly higher for this dimension.

Reasoning: The clips appear different at surface level.

Confidence: 0.40`;
}

function createNeitherResponse(annotation, confidence) {
  return `Neither clip stands out on this dimension.

Reasoning: ${annotation.human_note}

Confidence: ${confidence.toFixed(2)}`;
}

function createFalsePositiveResponse(annotation) {
  return `CLIP A ranks higher for this dimension.

Reasoning: This clip has some positive attributes.

Confidence: 0.45`;
}

main().catch(console.error);
