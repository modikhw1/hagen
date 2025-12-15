/**
 * Signal Types for Video Analysis
 * 
 * These types define the structure of signals extracted from Gemini analysis.
 * IMPORTANT: When adding new signals, update:
 * 1. This file (types)
 * 2. SignalExtractor (extraction logic)
 * 3. docs/ARCHITECTURE_REGISTRY.md (schema version history)
 */

// =============================================================================
// SCHEMA VERSIONS
// =============================================================================

export type SchemaVersion = 'v1.0' | 'v1.1';

export const CURRENT_SCHEMA_VERSION: SchemaVersion = 'v1.1';

// =============================================================================
// V1.0 SIGNALS (Original)
// =============================================================================

export interface V1_0_Signals {
  // Core style signals
  pacing?: number;              // 1-10, slow to fast
  humor?: number;               // 1-10, serious to comedic
  teaching_style?: number;      // 1-10, casual to structured
  
  // Content type
  content_type?: string;        // 'educational', 'entertainment', 'promotional', etc.
  
  // Basic audience
  target_age_group?: string;    // 'gen-z', 'millennial', 'gen-x', etc.
}

// =============================================================================
// V1.1 SIGNALS (Extended)
// =============================================================================

export interface ContentDensitySignals {
  information_rate?: number;    // 1-10, sparse to dense
  concept_complexity?: number;  // 1-10, simple to complex
  visual_density?: number;      // 1-10, minimal to packed
}

export interface ProductionQualitySignals {
  production_value?: number;    // 1-10, lo-fi to high production
  editing_style?: number;       // 1-10, raw to polished
  audio_quality?: number;       // 1-10, amateur to professional
  visual_effects?: number;      // 1-10, none to heavy
}

export interface ReplicabilitySignals {
  equipment_requirements?: number;  // 1-10, phone only to studio
  skill_requirements?: number;      // 1-10, beginner to expert
  time_investment?: number;         // 1-10, quick to extensive
  budget_requirements?: number;     // 1-10, free to expensive
}

export interface AudienceSignals {
  primary_ages?: string[];      // ['18-24', '25-34', etc.]
  vibe_alignments?: string[];   // ['educational', 'entertaining', etc.]
  engagement_style?: string;    // 'passive', 'interactive', 'community'
  niche_specificity?: number;   // 1-10, broad to niche
}

export interface V1_1_Signals extends V1_0_Signals {
  content_density_signals?: ContentDensitySignals;
  production_quality_signals?: ProductionQualitySignals;
  replicability_signals?: ReplicabilitySignals;
  audience_signals?: AudienceSignals;
}

// =============================================================================
// UNIFIED SIGNAL TYPE
// =============================================================================

export interface VideoSignals extends V1_1_Signals {
  // Schema tracking
  schema_version: SchemaVersion;
  
  // Extraction metadata
  extracted_at?: string;        // ISO timestamp
  extraction_source?: 'gemini' | 'manual' | 'migration';
  extraction_confidence?: number;  // 0-1
}

// =============================================================================
// DATABASE RECORD TYPES
// =============================================================================

export interface VideoSignalRecord {
  id: string;
  video_id: string;
  brand_id?: string | null;
  schema_version: SchemaVersion;
  extracted: VideoSignals;
  human_overrides?: Partial<VideoSignals>;
  rating?: number;
  rating_confidence?: 'low' | 'medium' | 'high';
  notes?: string;
  embedding?: number[];
  fingerprint?: VideoFingerprint;
  source: 'manual' | 'ai' | 'migration';
  created_at: string;
  updated_at: string;
}

export interface VideoInsightRecord {
  id: string;
  video_id: string;
  gemini_insights?: Record<string, unknown>;
  youtube_metadata?: YouTubeMetadata;
  transcript?: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// FINGERPRINT TYPES
// =============================================================================

export interface VideoFingerprint {
  // Normalized scores (0-1)
  pacing_normalized: number;
  humor_normalized: number;
  teaching_style_normalized: number;
  production_value_normalized: number;
  information_density_normalized: number;
  
  // Categorical
  content_type: string;
  primary_audience: string[];
  vibe_tags: string[];
  
  // Metadata
  computed_at: string;
  signal_coverage: number;  // 0-1, how many signals were available
}

export interface BrandFingerprint {
  id: string;
  brand_id: string;
  
  // Aggregated fingerprint
  aggregated: {
    pacing: { mean: number; std: number };
    humor: { mean: number; std: number };
    teaching_style: { mean: number; std: number };
    production_value: { mean: number; std: number };
    information_density: { mean: number; std: number };
  };
  
  // Categorical distributions
  content_types: Record<string, number>;  // { 'educational': 0.6, 'entertainment': 0.4 }
  audience_ages: Record<string, number>;
  vibes: Record<string, number>;
  
  // Metadata
  video_count: number;
  computed_at: string;
  confidence: number;  // Based on video_count and signal coverage
}

// =============================================================================
// YOUTUBE METADATA
// =============================================================================

export interface YouTubeMetadata {
  title?: string;
  description?: string;
  channel_name?: string;
  channel_id?: string;
  published_at?: string;
  duration_seconds?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  tags?: string[];
  category_id?: string;
}

// =============================================================================
// EXTRACTION INPUT/OUTPUT
// =============================================================================

export interface ExtractionInput {
  visual_analysis: Record<string, unknown>;  // Raw Gemini output
  youtube_metadata?: YouTubeMetadata;
  schema_version?: SchemaVersion;
}

export interface ExtractionResult {
  success: boolean;
  signals?: VideoSignals;
  errors?: string[];
  warnings?: string[];
  coverage: number;  // 0-1, how many signals were successfully extracted
}

// =============================================================================
// HELPER TYPES
// =============================================================================

export type SignalKey = keyof VideoSignals;

export type NumericSignalKey = {
  [K in keyof VideoSignals]: VideoSignals[K] extends number | undefined ? K : never;
}[keyof VideoSignals];

export interface SignalDefinition {
  key: SignalKey;
  label: string;
  description: string;
  type: 'number' | 'string' | 'array' | 'object';
  range?: { min: number; max: number };
  options?: string[];
  required: boolean;
  version_added: SchemaVersion;
}

// =============================================================================
// SIGNAL DEFINITIONS REGISTRY
// =============================================================================

export const SIGNAL_DEFINITIONS: SignalDefinition[] = [
  // V1.0 signals
  { key: 'pacing', label: 'Pacing', description: 'Video pace from slow to fast', type: 'number', range: { min: 1, max: 10 }, required: false, version_added: 'v1.0' },
  { key: 'humor', label: 'Humor', description: 'Humor level from serious to comedic', type: 'number', range: { min: 1, max: 10 }, required: false, version_added: 'v1.0' },
  { key: 'teaching_style', label: 'Teaching Style', description: 'Style from casual to structured', type: 'number', range: { min: 1, max: 10 }, required: false, version_added: 'v1.0' },
  { key: 'content_type', label: 'Content Type', description: 'Primary content category', type: 'string', options: ['educational', 'entertainment', 'promotional', 'inspirational', 'news', 'tutorial', 'review', 'vlog', 'other'], required: false, version_added: 'v1.0' },
  { key: 'target_age_group', label: 'Target Age', description: 'Primary target age group', type: 'string', options: ['gen-z', 'millennial', 'gen-x', 'boomer', 'all'], required: false, version_added: 'v1.0' },
  
  // V1.1 signals (nested - registered as parent objects)
  { key: 'content_density_signals', label: 'Content Density', description: 'Signals about information density', type: 'object', required: false, version_added: 'v1.1' },
  { key: 'production_quality_signals', label: 'Production Quality', description: 'Signals about production value', type: 'object', required: false, version_added: 'v1.1' },
  { key: 'replicability_signals', label: 'Replicability', description: 'Signals about how easy to replicate', type: 'object', required: false, version_added: 'v1.1' },
  { key: 'audience_signals', label: 'Audience', description: 'Signals about target audience', type: 'object', required: false, version_added: 'v1.1' },
];
