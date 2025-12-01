/**
 * Pattern Discovery Service
 * 
 * Analyzes ratings to discover patterns in user preferences
 * Combines:
 * - Explicit criteria (extracted from user notes)
 * - Implicit features (from Gemini visual_analysis)
 * - Metadata (duration, platform, etc.)
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Numeric features to extract from visual_analysis
const GEMINI_NUMERIC_FEATURES = [
  // Visual
  'visual.hookStrength',
  'visual.overallQuality',
  'visual.colorDiversity',
  'visual.compositionQuality',
  'visual.peopleCount',           // Solo vs duo vs group
  // Audio
  'audio.quality',
  'audio.audioEnergy',
  'audio.audioVisualSync',
  'audio.voiceoverQuality',       // Voiceover production quality
  // Content
  'content.duration',
  // Technical
  'technical.pacing',
  'technical.cutsPerMinute',
  // Engagement
  'engagement.attentionRetention',
  'engagement.shareability',
  'engagement.replayValue',
  'engagement.scrollStopPower',
  // Trends
  'trends.trendAlignment',
  'trends.timelessness',
  // Script - Core Quality
  'script.scriptQuality',                    // Overall script quality
  // Script - Humor Analysis
  'script.humor.comedyTiming',               // Timing effectiveness
  'script.humor.absurdismLevel',             // Logic violation level
  'script.humor.surrealismLevel',            // Reality distortion level
  // Script - Structure
  'script.structure.payoffStrength',         // How satisfying is conclusion
  // Script - Emotional
  'script.emotional.emotionalIntensity',     // Strength of emotional impact
  'script.emotional.relatability',           // How relatable to average viewer
  // Script - Replicability (CRITICAL for user's use case)
  'script.replicability.score',              // How easy to recreate
  'script.replicability.contextDependency',  // How context-specific (inverse = more universal)
  // Script - Originality
  'script.originality.score',                // Novelty of concept
  
  // === V2 ADDITIONS: Casting, Production, Flexibility, etc. ===
  
  // Casting - Who can perform this?
  'casting.minimumPeople',                   // Number of people required
  'casting.attractivenessDependency',        // Does this only work with attractive people?
  'casting.personalityDependency',           // Does this need a specific persona?
  'casting.actingSkillRequired',             // Level of acting ability needed
  
  // Production - What's needed to make this?
  'production.shotComplexity',               // Camera setups required
  'production.editingDependency',            // How much does editing matter?
  
  // Flexibility - How adaptable is this concept?
  'flexibility.industryLock',                // Is this locked to specific business type?
  'flexibility.propDependency',              // Does this need specific props?
  
  // Trends - Dependency on current culture
  'trends.insideJokeDependency',             // Creator-specific humor?
  'trends.culturalSpecificity',              // Region/culture-specific?
  
  // Brand - Risk assessment
  'brand.riskLevel',                         // How risky for conservative brands?
  
  // Standalone - Does this work without context?
  'standalone.worksWithoutContext',          // Works for new viewers?
  
  // Execution - How hard to pull off?
  'execution.physicalComedyLevel',           // Physical vs dialogue-driven
  'execution.timingCriticality',             // How important is perfect timing?
  'execution.improvisationRoom',             // Room to riff vs exact script?
] as const;

// Categorical features to extract
const GEMINI_CATEGORICAL_FEATURES = [
  // Audio
  'audio.energyLevel',            // low/medium/high
  'audio.hasVoiceover',           // boolean
  'audio.musicType',              // none, background, featured
  'audio.musicGenre',             // pop, electronic, etc.
  // Content
  'content.style',                // Entertaining, Educational, etc.
  'content.format',               // Skit, Talking head, Montage, etc.
  'content.emotionalTone',        // Humorous, inspiring, dramatic, etc.
  'content.targetAudience',       // Who this appeals to
  // Visual
  'visual.settingType',           // indoor/outdoor/mixed/animated
  // Technical
  'technical.editingStyle',       // Fast-paced, slow, cinematic, etc.
  // Script - Humor (IMPORTANT)
  'script.humor.isHumorous',      // boolean
  'script.humor.humorType',       // subversion, absurdist, observational, etc.
  // Script - Structure
  'script.hasScript',             // boolean
  'script.structure.hookType',    // question, statement, action, mystery, etc.
  'script.structure.hasCallback', // boolean
  'script.structure.hasTwist',    // boolean
  // Script - Emotional
  'script.emotional.primaryEmotion',  // humor, awe, curiosity, etc.
  // Script - Replicability
  'script.replicability.resourceRequirements',  // low/medium/high
  
  // === V2 ADDITIONS: Casting, Production, Flexibility, etc. ===
  
  // Casting
  'casting.requiresCustomer',     // boolean - needs stranger participation?
  
  // Production
  'production.timeToRecreate',    // 15min, 30min, 1hr, 2hr, half-day, full-day
  
  // Flexibility
  'flexibility.swappableCore',    // boolean - can central element be swapped?
  
  // Trends
  'trends.memeDependent',         // boolean - relies on current meme?
  'trends.trendLifespan',         // dead-meme, dying, current, evergreen-trope, not-trend-dependent
  
  // Brand
  'brand.adultThemes',            // boolean - contains adult content?
  
  // Standalone
  'standalone.worksWithoutProduct',  // boolean - works without featuring product?
  'standalone.requiresSetup',        // boolean - needs external context?
] as const;

export interface DiscoveredPattern {
  type: 'correlation' | 'threshold' | 'combination' | 'insight' | 'implicit';
  description: string;
  rule?: {
    if: Record<string, string>;
    then: Record<string, string>;
  };
  confidence: number;
  supportingVideos: string[];
  counterExamples: string[];
  source?: 'explicit' | 'implicit' | 'gemini';  // Where this pattern came from
}

export interface CriteriaCorrelation {
  criterion: string;
  correlation: number;  // -1 to 1
  predictivePower: number;  // 0 to 1
  sampleSize: number;
  interpretation: string;
  source: 'explicit' | 'implicit' | 'gemini';  // Where this criterion came from
}

/**
 * Extract a nested value from an object using dot notation
 * e.g., getNestedValue(obj, 'visual.hookStrength')
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
  }, obj as unknown);
}

/**
 * Extract numeric features from Gemini visual_analysis
 */
export function extractGeminiFeatures(
  visualAnalysis: Record<string, unknown> | null
): Record<string, number> {
  if (!visualAnalysis) return {};

  const features: Record<string, number> = {};

  for (const featurePath of GEMINI_NUMERIC_FEATURES) {
    const value = getNestedValue(visualAnalysis, featurePath);
    if (typeof value === 'number' && !isNaN(value)) {
      // Normalize 1-10 scales to 0-1
      const normalized = value > 1 ? value / 10 : value;
      features[`gemini_${featurePath.replace('.', '_')}`] = normalized;
    }
  }

  // Extract duration from metadata if available in visual_analysis
  const duration = getNestedValue(visualAnalysis, 'content.duration');
  if (typeof duration === 'number') {
    features['gemini_duration_seconds'] = duration;
    // Create bucketed duration feature (normalized)
    if (duration <= 15) features['gemini_duration_short'] = 1;
    else if (duration <= 30) features['gemini_duration_medium'] = 1;
    else if (duration <= 60) features['gemini_duration_long'] = 1;
    else features['gemini_duration_very_long'] = 1;
  }

  // Extract categorical features as binary
  for (const featurePath of GEMINI_CATEGORICAL_FEATURES) {
    const value = getNestedValue(visualAnalysis, featurePath);
    if (value === true) {
      features[`gemini_${featurePath.replace('.', '_')}`] = 1;
    } else if (value === false) {
      features[`gemini_${featurePath.replace('.', '_')}`] = 0;
    } else if (typeof value === 'string') {
      // Create binary features for each category value
      features[`gemini_${featurePath.replace('.', '_')}_${value.toLowerCase().replace(/\s+/g, '_')}`] = 1;
    }
  }

  // Extract array lengths (e.g., number of text overlays, transitions)
  const textOverlays = getNestedValue(visualAnalysis, 'visual.textOverlays');
  if (Array.isArray(textOverlays)) {
    features['gemini_has_text_overlays'] = textOverlays.length > 0 ? 1 : 0;
    features['gemini_text_overlay_count'] = Math.min(textOverlays.length / 5, 1); // Normalize
  }

  const transitions = getNestedValue(visualAnalysis, 'visual.transitions');
  if (Array.isArray(transitions)) {
    features['gemini_transition_count'] = Math.min(transitions.length / 10, 1); // Normalize
  }

  const soundEffects = getNestedValue(visualAnalysis, 'audio.soundEffects');
  if (Array.isArray(soundEffects)) {
    features['gemini_has_sound_effects'] = soundEffects.length > 0 ? 1 : 0;
    features['gemini_sound_effects_count'] = Math.min(soundEffects.length / 5, 1);
  }

  // NEW: Color palette analysis
  const colorPalette = getNestedValue(visualAnalysis, 'visual.colorPalette');
  if (Array.isArray(colorPalette)) {
    features['gemini_color_count'] = Math.min(colorPalette.length / 6, 1);
    // Detect warm vs cool palette
    const warmColors = ['red', 'orange', 'yellow', 'brown', 'pink', 'gold'];
    const coolColors = ['blue', 'green', 'purple', 'teal', 'cyan', 'gray', 'grey'];
    const warmCount = colorPalette.filter(c => warmColors.some(w => c.toLowerCase().includes(w))).length;
    const coolCount = colorPalette.filter(c => coolColors.some(w => c.toLowerCase().includes(w))).length;
    if (colorPalette.length > 0) {
      features['gemini_warm_color_ratio'] = warmCount / colorPalette.length;
      features['gemini_cool_color_ratio'] = coolCount / colorPalette.length;
    }
  }

  // NEW: Main elements analysis
  const mainElements = getNestedValue(visualAnalysis, 'visual.mainElements');
  if (Array.isArray(mainElements)) {
    features['gemini_element_count'] = Math.min(mainElements.length / 10, 1);
    // Detect common element categories
    const peopleTerms = ['person', 'people', 'man', 'woman', 'guy', 'girl', 'face', 'hands'];
    const foodTerms = ['food', 'drink', 'eating', 'cooking', 'meal', 'restaurant'];
    const outdoorTerms = ['nature', 'outdoor', 'sky', 'beach', 'mountain', 'park', 'street'];
    
    const hasPeople = mainElements.some(e => peopleTerms.some(t => e.toLowerCase().includes(t)));
    const hasFood = mainElements.some(e => foodTerms.some(t => e.toLowerCase().includes(t)));
    const hasOutdoor = mainElements.some(e => outdoorTerms.some(t => e.toLowerCase().includes(t)));
    
    features['gemini_has_people_elements'] = hasPeople ? 1 : 0;
    features['gemini_has_food_elements'] = hasFood ? 1 : 0;
    features['gemini_has_outdoor_elements'] = hasOutdoor ? 1 : 0;
  }

  return features;
}

/**
 * Extract metadata features (likes, views, duration from platform)
 */
export function extractMetadataFeatures(
  metadata: Record<string, unknown> | null
): Record<string, number> {
  if (!metadata) return {};

  const features: Record<string, number> = {};

  // Duration
  const duration = getNestedValue(metadata, 'media.duration') || metadata.duration;
  if (typeof duration === 'number') {
    features['meta_duration_seconds'] = duration;
  }

  // Engagement stats (log-normalized)
  const stats = metadata.stats as Record<string, number> | undefined;
  if (stats) {
    if (typeof stats.views === 'number' && stats.views > 0) {
      features['meta_views_log'] = Math.log10(stats.views) / 8; // Normalize (10^8 = 100M max)
    }
    if (typeof stats.likes === 'number' && stats.likes > 0) {
      features['meta_likes_log'] = Math.log10(stats.likes) / 7; // Normalize
    }
    if (typeof stats.comments === 'number' && stats.comments > 0) {
      features['meta_comments_log'] = Math.log10(stats.comments) / 5; // Normalize
    }
    // Engagement rate
    if (stats.views && stats.likes) {
      features['meta_engagement_rate'] = Math.min((stats.likes / stats.views) * 100, 1);
    }
  }

  return features;
}

/**
 * Calculate correlation between a criterion and overall score
 */
export function calculateCorrelation(
  ratings: Array<{ criteria: Record<string, number>; score: number }>,
  criterionName: string
): CriteriaCorrelation | null {
  // Filter ratings that have this criterion
  const validRatings = ratings.filter(
    r => r.criteria[criterionName] !== undefined && r.criteria[criterionName] !== null
  );

  if (validRatings.length < 3) {
    return null;  // Not enough data
  }

  const criterionValues = validRatings.map(r => r.criteria[criterionName]);
  const scores = validRatings.map(r => r.score);

  // Calculate Pearson correlation
  const n = validRatings.length;
  const sumX = criterionValues.reduce((a, b) => a + b, 0);
  const sumY = scores.reduce((a, b) => a + b, 0);
  const sumXY = criterionValues.reduce((sum, x, i) => sum + x * scores[i], 0);
  const sumX2 = criterionValues.reduce((sum, x) => sum + x * x, 0);
  const sumY2 = scores.reduce((sum, y) => sum + y * y, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) return null;

  const correlation = numerator / denominator;

  // Predictive power (R²)
  const predictivePower = correlation * correlation;

  // Interpretation
  let interpretation = '';
  if (correlation > 0.5) {
    interpretation = `High ${criterionName} strongly predicts higher scores`;
  } else if (correlation > 0.2) {
    interpretation = `High ${criterionName} somewhat predicts higher scores`;
  } else if (correlation > -0.2) {
    interpretation = `${criterionName} has little effect on scores`;
  } else if (correlation > -0.5) {
    interpretation = `High ${criterionName} somewhat predicts lower scores`;
  } else {
    interpretation = `High ${criterionName} strongly predicts lower scores`;
  }

  return {
    criterion: criterionName,
    correlation,
    predictivePower,
    sampleSize: n,
    interpretation,
    source: 'explicit' as const,  // Default, can be overwritten by caller
  };
}

/**
 * Discover threshold patterns (e.g., "when X > 0.7, score < 0.5")
 */
export function discoverThresholds(
  ratings: Array<{ id: string; criteria: Record<string, number>; score: number }>,
  criterionName: string
): DiscoveredPattern | null {
  const validRatings = ratings.filter(
    r => r.criteria[criterionName] !== undefined
  );

  if (validRatings.length < 5) return null;

  // Try different thresholds
  const thresholds = [0.3, 0.5, 0.7];
  let bestPattern: DiscoveredPattern | null = null;
  let bestConfidence = 0;

  for (const threshold of thresholds) {
    const high = validRatings.filter(r => r.criteria[criterionName] >= threshold);
    const low = validRatings.filter(r => r.criteria[criterionName] < threshold);

    if (high.length < 2 || low.length < 2) continue;

    const highAvgScore = high.reduce((sum, r) => sum + r.score, 0) / high.length;
    const lowAvgScore = low.reduce((sum, r) => sum + r.score, 0) / low.length;

    const scoreDiff = Math.abs(highAvgScore - lowAvgScore);
    const confidence = scoreDiff * Math.min(high.length, low.length) / validRatings.length;

    if (confidence > bestConfidence && scoreDiff > 0.15) {
      bestConfidence = confidence;

      const direction = highAvgScore < lowAvgScore ? 'lowers' : 'raises';
      const avgScoreWhenHigh = highAvgScore.toFixed(2);
      const avgScoreWhenLow = lowAvgScore.toFixed(2);

      bestPattern = {
        type: 'threshold',
        description: `When ${criterionName} ≥ ${threshold}, score tends to be ${direction === 'lowers' ? 'lower' : 'higher'} (avg ${avgScoreWhenHigh} vs ${avgScoreWhenLow})`,
        rule: {
          if: { [criterionName]: `>= ${threshold}` },
          then: { score: direction === 'lowers' ? `< ${avgScoreWhenLow}` : `> ${avgScoreWhenLow}` },
        },
        confidence,
        supportingVideos: high.map(r => r.id),
        counterExamples: [],
      };
    }
  }

  return bestPattern;
}

/**
 * Use LLM to discover high-level insights from ratings
 */
export async function discoverInsights(
  ratings: Array<{ 
    notes: string; 
    score: number; 
    criteria: Record<string, unknown>;
  }>
): Promise<DiscoveredPattern[]> {
  if (ratings.length < 5) return [];

  const highRated = ratings.filter(r => r.score >= 0.7);
  const lowRated = ratings.filter(r => r.score <= 0.5);

  const prompt = `Analyze these video ratings and discover patterns in what the user values.

HIGH-RATED VIDEOS (score ≥ 0.7):
${highRated.slice(0, 5).map(r => `- Score ${r.score}: "${r.notes.slice(0, 200)}..."`).join('\n')}

LOW-RATED VIDEOS (score ≤ 0.5):
${lowRated.slice(0, 5).map(r => `- Score ${r.score}: "${r.notes.slice(0, 200)}..."`).join('\n')}

What patterns do you notice? What does the user consistently value or penalize?

Respond with JSON:
{
  "patterns": [
    {
      "description": "Clear, actionable insight about user preferences",
      "confidence": 0.0-1.0,
      "evidence": "Brief explanation of supporting evidence"
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing user preferences and discovering patterns in evaluation criteria.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    
    return (parsed.patterns || []).map((p: { description: string; confidence: number }) => ({
      type: 'insight' as const,
      description: p.description,
      confidence: p.confidence || 0.5,
      supportingVideos: [],
      counterExamples: [],
    }));

  } catch (error) {
    console.error('Insight discovery failed:', error);
    return [];
  }
}

/**
 * Run full pattern discovery on all ratings
 * Combines explicit criteria (from notes) with implicit features (from Gemini analysis)
 */
export async function runPatternDiscovery(
  supabase: ReturnType<typeof createClient>
): Promise<{
  correlations: CriteriaCorrelation[];
  thresholds: DiscoveredPattern[];
  insights: DiscoveredPattern[];
  implicitPatterns: DiscoveredPattern[];
}> {
  // Fetch ratings with video analysis data (JOIN to get visual_analysis)
  const { data: ratingsWithVideos, error } = await supabase
    .from('ratings_v2')
    .select(`
      id, 
      overall_score, 
      notes, 
      extracted_criteria,
      video_id,
      analyzed_videos!inner (
        id,
        visual_analysis,
        metadata
      )
    `)
    .not('overall_score', 'is', null);

  // Fallback: try old ratings table if v2 is empty
  let ratings = ratingsWithVideos;
  if (!ratings || ratings.length === 0) {
    const { data: oldRatings } = await supabase
      .from('video_ratings')
      .select(`
        id,
        overall_score,
        notes,
        dimensions,
        video_id,
        analyzed_videos!inner (
          id,
          visual_analysis,
          metadata
        )
      `)
      .not('overall_score', 'is', null);
    
    ratings = oldRatings;
  }

  if (error || !ratings || ratings.length === 0) {
    console.warn('No ratings found for pattern discovery');
    return { correlations: [], thresholds: [], insights: [], implicitPatterns: [] };
  }

  console.log(`📊 Analyzing ${ratings.length} ratings for patterns...`);

  // Transform ratings, combining explicit criteria with Gemini features
  const transformed = ratings.map((r: Record<string, unknown>) => {
    const video = r.analyzed_videos as Record<string, unknown> | null;
    const visualAnalysis = video?.visual_analysis as Record<string, unknown> | null;
    const metadata = video?.metadata as Record<string, unknown> | null;

    // Get explicit criteria from extraction (or old dimensions)
    const explicitCriteria = (r.extracted_criteria || r.dimensions || {}) as Record<string, number>;

    // Extract implicit features from Gemini analysis
    const geminiFeatures = extractGeminiFeatures(visualAnalysis);
    
    // Extract metadata features
    const metaFeatures = extractMetadataFeatures(metadata);

    // Combine all features
    const allFeatures = {
      ...explicitCriteria,
      ...geminiFeatures,
      ...metaFeatures,
    };

    return {
      id: r.id as string,
      videoId: r.video_id as string,
      score: r.overall_score as number,
      notes: r.notes as string | null,
      explicitCriteria,
      geminiFeatures,
      metaFeatures,
      allFeatures,
    };
  });

  // ============================================
  // EXPLICIT CRITERIA CORRELATIONS (from notes)
  // ============================================
  const allExplicitCriteria = new Set<string>();
  transformed.forEach(r => {
    Object.keys(r.explicitCriteria).forEach(k => allExplicitCriteria.add(k));
  });

  const explicitCorrelations: CriteriaCorrelation[] = [];
  for (const criterion of allExplicitCriteria) {
    const corr = calculateCorrelation(
      transformed.map(r => ({ criteria: r.explicitCriteria, score: r.score })),
      criterion
    );
    if (corr) {
      explicitCorrelations.push({ ...corr, source: 'explicit' });
    }
  }

  // ============================================
  // IMPLICIT CORRELATIONS (from Gemini features)
  // ============================================
  const allGeminiFeatures = new Set<string>();
  transformed.forEach(r => {
    Object.keys(r.geminiFeatures).forEach(k => allGeminiFeatures.add(k));
  });

  const implicitCorrelations: CriteriaCorrelation[] = [];
  for (const feature of allGeminiFeatures) {
    const corr = calculateCorrelation(
      transformed.map(r => ({ criteria: r.geminiFeatures, score: r.score })),
      feature
    );
    if (corr) {
      implicitCorrelations.push({ ...corr, source: 'gemini' });
    }
  }

  // Combine and sort all correlations
  const correlations = [...explicitCorrelations, ...implicitCorrelations]
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  // ============================================
  // THRESHOLD PATTERNS (both explicit and implicit)
  // ============================================
  const thresholds: DiscoveredPattern[] = [];
  
  // Explicit thresholds
  for (const criterion of allExplicitCriteria) {
    const pattern = discoverThresholds(
      transformed.map(r => ({ id: r.id, criteria: r.explicitCriteria, score: r.score })),
      criterion
    );
    if (pattern) {
      thresholds.push({ ...pattern, source: 'explicit' });
    }
  }

  // Gemini feature thresholds
  for (const feature of allGeminiFeatures) {
    const pattern = discoverThresholds(
      transformed.map(r => ({ id: r.id, criteria: r.geminiFeatures, score: r.score })),
      feature
    );
    if (pattern) {
      thresholds.push({ ...pattern, source: 'gemini' });
    }
  }

  // ============================================
  // LLM INSIGHTS (from notes)
  // ============================================
  const insightData = transformed
    .filter(r => r.notes !== null)
    .map(r => ({ notes: r.notes!, score: r.score, criteria: r.explicitCriteria }));
  
  const insights = insightData.length >= 5
    ? await discoverInsights(insightData)
    : [];

  // ============================================
  // IMPLICIT PATTERN DISCOVERY (what you never said)
  // ============================================
  const implicitPatterns = await discoverImplicitPatterns(transformed);

  // Log discovered patterns
  console.log(`✅ Pattern discovery complete:`);
  console.log(`   - ${explicitCorrelations.length} explicit correlations`);
  console.log(`   - ${implicitCorrelations.length} implicit (Gemini) correlations`);
  console.log(`   - ${thresholds.length} threshold patterns`);
  console.log(`   - ${insights.length} insights`);
  console.log(`   - ${implicitPatterns.length} implicit patterns`);

  // Top implicit correlations (things you never mentioned)
  const topImplicit = implicitCorrelations
    .filter(c => Math.abs(c.correlation) > 0.3)
    .slice(0, 5);
  
  if (topImplicit.length > 0) {
    console.log(`\n🔍 Top implicit preferences (you never mentioned these):`);
    topImplicit.forEach(c => {
      console.log(`   ${c.criterion}: ${c.correlation > 0 ? '📈' : '📉'} ${c.interpretation}`);
    });
  }

  return { correlations, thresholds, insights, implicitPatterns };
}

/**
 * Discover implicit patterns - preferences you never explicitly stated
 */
async function discoverImplicitPatterns(
  ratings: Array<{
    id: string;
    score: number;
    notes: string | null;
    geminiFeatures: Record<string, number>;
    explicitCriteria: Record<string, number>;
  }>
): Promise<DiscoveredPattern[]> {
  if (ratings.length < 5) return [];

  const patterns: DiscoveredPattern[] = [];

  // Find Gemini features that strongly correlate with score
  // but weren't mentioned in notes
  const allGeminiFeatures = new Set<string>();
  ratings.forEach(r => {
    Object.keys(r.geminiFeatures).forEach(k => allGeminiFeatures.add(k));
  });

  for (const feature of allGeminiFeatures) {
    const corr = calculateCorrelation(
      ratings.map(r => ({ criteria: r.geminiFeatures, score: r.score })),
      feature
    );

    if (corr && Math.abs(corr.correlation) > 0.4) {
      // Strong correlation found - create implicit pattern
      const featureName = feature
        .replace('gemini_', '')
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .trim();

      const direction = corr.correlation > 0 ? 'higher' : 'lower';
      const avgHigh = ratings
        .filter(r => r.geminiFeatures[feature] > 0.5)
        .reduce((sum, r) => sum + r.score, 0) / 
        ratings.filter(r => r.geminiFeatures[feature] > 0.5).length;

      patterns.push({
        type: 'implicit',
        description: `Videos with high ${featureName} tend to get ${direction} scores (you may prefer ${direction === 'higher' ? 'more' : 'less'} of this)`,
        rule: {
          if: { [feature]: '> 0.5' },
          then: { score: direction === 'higher' ? `~${avgHigh.toFixed(2)}` : `< ${avgHigh.toFixed(2)}` },
        },
        confidence: Math.abs(corr.correlation),
        supportingVideos: ratings.filter(r => r.geminiFeatures[feature] > 0.5).map(r => r.id),
        counterExamples: [],
        source: 'gemini',
      });
    }
  }

  return patterns;
}
