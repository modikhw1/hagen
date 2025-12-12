/**
 * Profile Fingerprint Types
 *
 * A profile fingerprint is a multi-layer representation of a brand's content identity.
 * Layer weights prioritize: Quality > Likeness > Visual
 */

/** Layer 1: Quality/Virality signals */
export interface L1QualityLayer {
  avg_quality_score: number;        // 0-1, from /analyze-rate
  avg_execution_coherence: number;  // 0-1, from Schema v1
  avg_distinctiveness: number;      // 0-1, from Schema v1
}

/** Layer 2: Likeness/Personality signals */
export interface L2LikenessLayer {
  dominant_humor_types: string[];   // Most common humor types
  avg_energy: number;               // 1-10
  avg_warmth: number;               // 1-10
  avg_formality: number;            // 1-10
  dominant_age_code: 'younger' | 'older' | 'balanced' | 'mixed';
  dominant_vibe: string[];          // Most common vibes
  dominant_price_tier: 'budget' | 'mid' | 'premium' | 'luxury' | 'mixed';
  dominant_intent: string | null;   // Most common primary_intent
}

/** Layer 3: Visual/Production signals */
export interface L3VisualLayer {
  avg_production_investment: number; // 1-10
  avg_effortlessness: number;        // 1-10
  avg_intentionality: number;        // 1-10
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
