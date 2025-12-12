/**
 * Profile Fingerprint Types
 *
 * A profile fingerprint is a multi-layer representation of a brand's content identity.
 * Layer weights prioritize: Quality > Personality > Production
 * 
 * v2.0 - Dec 2025: Split L1 into Service Fit + Execution Quality, expanded L2 sub-dimensions
 */

/** Layer 1: Quality - Split into Service Fit and Execution Quality */
export interface L1QualityLayer {
  // L1a: Service Fit - How useful is this style for our service?
  avg_service_fit: number;           // 0-1, from /analyze-rate overall_score
  
  // L1b: Execution Quality - How well-executed, regardless of style?
  avg_execution_quality: number;     // 0-1, computed from execution signals
  avg_execution_coherence: number;   // 0-1, from Schema v1
  avg_distinctiveness: number;       // 0-1, from Schema v1
  avg_confidence: number;            // 0-1, normalized from personality.confidence_1_10
  avg_message_alignment: number;     // 0-1, from coherence.personality_message_alignment
  
  // Legacy field for backwards compatibility
  avg_quality_score: number;         // 0-1, alias for avg_service_fit
}

/** Layer 2: Personality - Expanded with sub-dimensions */
export interface L2LikenessLayer {
  // 2a: Tone (numeric averages, 1-10)
  avg_energy: number;
  avg_warmth: number;
  avg_formality: number;
  avg_self_seriousness: number;      // NEW: playful vs serious
  avg_confidence: number;            // NEW: delivery confidence
  
  // 2b: Humor Profile
  dominant_humor_types: string[];
  dominant_age_code: 'younger' | 'older' | 'balanced' | 'mixed';
  dominant_humor_target: string | null;    // NEW: self/customer/situation/etc
  dominant_meanness_risk: 'low' | 'medium' | 'high' | 'unknown' | null;  // NEW
  
  // 2c: Positioning
  dominant_accessibility: 'everyman' | 'aspirational' | 'exclusive' | 'elite' | 'mixed' | null;  // NEW
  dominant_price_tier: 'budget' | 'mid' | 'premium' | 'luxury' | 'mixed';
  dominant_edginess: 'safe' | 'mild' | 'moderate' | 'edgy' | 'provocative' | 'mixed' | null;  // NEW
  dominant_vibe: string[];
  dominant_occasion: string[];       // NEW: date night, casual, etc
  
  // 2d: Intent & Messaging
  dominant_intent: string | null;
  dominant_cta_types: string[];      // NEW: follow_for_series, visit_in_store, etc
  collected_subtext: string[];       // NEW: underlying themes
  collected_audiences: string[];     // NEW: apparent_audience values
  
  // 2e: Character Traits
  dominant_traits: string[];         // NEW: from traits_observed
  dominant_service_ethos: string[];  // NEW: hospitality service philosophy
}

/** Layer 3: Production DNA - Expanded */
export interface L3VisualLayer {
  avg_production_investment: number; // 1-10
  avg_effortlessness: number;        // 1-10
  avg_intentionality: number;        // 1-10
  avg_social_permission: number;     // NEW: 1-10, shareability
  
  // Format consistency
  has_repeatable_format_pct: number; // NEW: 0-1, % of videos with repeatable format
  collected_format_names: string[];  // NEW: format identifiers found
}

/** Complete profile fingerprint */
export interface ProfileFingerprint {
  profile_id: string;
  profile_name?: string;
  video_ids: string[];
  video_count: number;
  computed_at: string;

  /** Weighted centroid embedding (1536-dim OpenAI) */
  embedding: number[];

  /** Per-video weights used in centroid computation */
  video_weights: Record<string, number>;

  /** Layer breakdowns for interpretability */
  layers: {
    l1_quality: L1QualityLayer;
    l2_likeness: L2LikenessLayer;
    l3_visual: L3VisualLayer;
  };

  /** Confidence based on data completeness */
  confidence: number; // 0-1
  missing_data_notes: string[];

  /** URLs that were requested but not found in the database */
  urls_not_found: string[];

  /** URLs that were found */
  urls_found: string[];

  /** Generated text summary of the profile personality (optional) */
  personality_summary?: string;
}

/** Input for fingerprint computation */
export interface FingerprintInput {
  profile_id?: string;
  profile_name?: string;
  video_urls: string[];
}

/** Match result when comparing a video to a profile fingerprint */
export interface MatchResult {
  candidate_video_id: string;
  profile_id: string;

  /** Overall match score (target ≥ 0.85) */
  overall_match: number; // 0-1

  /** Per-layer breakdown */
  layer_scores: {
    l1_quality_compatible: number;  // 0-1, is quality level appropriate?
    l2_likeness_match: number;      // 0-1, personality/tone alignment
    l3_visual_proximity: number;    // 0-1, production value similarity
    embedding_similarity: number;   // 0-1, raw cosine similarity
  };

  /** Closest video in profile to this candidate */
  closest_video_id: string | null;
  closest_similarity: number;

  /** Furthest video in profile (sanity check) */
  furthest_video_id: string | null;
  furthest_similarity: number;

  /** Human-readable explanation */
  explanation: string;
}

/** Stored profile with fingerprint */
export interface StoredProfile {
  id: string;
  name: string;
  fingerprint: ProfileFingerprint;
  created_at: string;
  updated_at: string;
}
