/**
 * Signal Extractor
 * 
 * Extracts structured signals from raw Gemini analysis output.
 * This is a PURE TRANSFORMATION - no side effects, no database calls.
 * 
 * ARCHITECTURE LAYER: Transforms Layer A (raw) → Layer B (structured)
 */

import {
  VideoSignals,
  ContentDensitySignals,
  ProductionQualitySignals,
  ReplicabilitySignals,
  AudienceSignals,
  ExtractionInput,
  ExtractionResult,
  SchemaVersion,
  CURRENT_SCHEMA_VERSION,
} from './types';

// =============================================================================
// MAIN EXTRACTOR CLASS
// =============================================================================

export class SignalExtractor {
  private version: SchemaVersion;
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor(version: SchemaVersion = CURRENT_SCHEMA_VERSION) {
    this.version = version;
  }

  /**
   * Main extraction method
   */
  extract(input: ExtractionInput): ExtractionResult {
    this.errors = [];
    this.warnings = [];

    const analysis = input.visual_analysis;
    
    if (!analysis || typeof analysis !== 'object') {
      return {
        success: false,
        errors: ['No visual_analysis data provided'],
        warnings: [],
        coverage: 0,
      };
    }

    try {
      const signals = this.extractSignals(analysis);
      const coverage = this.calculateCoverage(signals);

      return {
        success: true,
        signals,
        errors: this.errors,
        warnings: this.warnings,
        coverage,
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: this.warnings,
        coverage: 0,
      };
    }
  }

  /**
   * Extract all signals from Gemini output
   */
  private extractSignals(analysis: Record<string, unknown>): VideoSignals {
    const signals: VideoSignals = {
      schema_version: this.version,
      extracted_at: new Date().toISOString(),
      extraction_source: 'gemini',
    };

    // Try multiple paths for each signal (Gemini output structure varies)
    
    // Core V1.0 signals
    signals.pacing = this.extractNumeric(analysis, ['pacing', 'pace', 'video_pace', 'pacing_score']);
    signals.humor = this.extractNumeric(analysis, ['humor', 'humor_level', 'humor_score', 'comedic_level']);
    signals.teaching_style = this.extractNumeric(analysis, ['teaching_style', 'teachingStyle', 'teaching_approach', 'structure_level']);
    signals.content_type = this.extractString(analysis, ['content_type', 'contentType', 'primary_content_type', 'video_type']);
    signals.target_age_group = this.extractString(analysis, ['target_age_group', 'targetAgeGroup', 'primary_age_group', 'target_demographic']);

    // V1.1 signals
    if (this.version === 'v1.1') {
      signals.content_density_signals = this.extractContentDensity(analysis);
      signals.production_quality_signals = this.extractProductionQuality(analysis);
      signals.replicability_signals = this.extractReplicability(analysis);
      signals.audience_signals = this.extractAudience(analysis);
    }

    // Clean undefined values
    return this.cleanSignals(signals);
  }

  // =============================================================================
  // NESTED SIGNAL EXTRACTORS
  // =============================================================================

  private extractContentDensity(analysis: Record<string, unknown>): ContentDensitySignals | undefined {
    const nested = this.findNested(analysis, ['content_density_signals', 'contentDensity', 'content_density', 'density']);
    
    const signals: ContentDensitySignals = {
      information_rate: this.extractNumeric(nested || analysis, ['information_rate', 'informationRate', 'info_density', 'information_density']),
      concept_complexity: this.extractNumeric(nested || analysis, ['concept_complexity', 'conceptComplexity', 'complexity', 'complexity_level']),
      visual_density: this.extractNumeric(nested || analysis, ['visual_density', 'visualDensity', 'visual_complexity']),
    };

    return this.hasAnyValue(signals as unknown as Record<string, unknown>) ? signals : undefined;
  }

  private extractProductionQuality(analysis: Record<string, unknown>): ProductionQualitySignals | undefined {
    const nested = this.findNested(analysis, ['production_quality_signals', 'productionQuality', 'production_quality', 'production']);
    
    const signals: ProductionQualitySignals = {
      production_value: this.extractNumeric(nested || analysis, ['production_value', 'productionValue', 'production_level', 'quality_level']),
      editing_style: this.extractNumeric(nested || analysis, ['editing_style', 'editingStyle', 'editing_level', 'edit_polish']),
      audio_quality: this.extractNumeric(nested || analysis, ['audio_quality', 'audioQuality', 'sound_quality']),
      visual_effects: this.extractNumeric(nested || analysis, ['visual_effects', 'visualEffects', 'effects_level', 'vfx_usage']),
    };

    return this.hasAnyValue(signals as unknown as Record<string, unknown>) ? signals : undefined;
  }

  private extractReplicability(analysis: Record<string, unknown>): ReplicabilitySignals | undefined {
    const nested = this.findNested(analysis, ['replicability_signals', 'replicability', 'replication', 'reproducibility']);
    
    const signals: ReplicabilitySignals = {
      equipment_requirements: this.extractNumeric(nested || analysis, ['equipment_requirements', 'equipmentRequirements', 'equipment_level', 'gear_requirements']),
      skill_requirements: this.extractNumeric(nested || analysis, ['skill_requirements', 'skillRequirements', 'skill_level', 'expertise_needed']),
      time_investment: this.extractNumeric(nested || analysis, ['time_investment', 'timeInvestment', 'time_required', 'production_time']),
      budget_requirements: this.extractNumeric(nested || analysis, ['budget_requirements', 'budgetRequirements', 'budget_level', 'cost_level']),
    };

    return this.hasAnyValue(signals as unknown as Record<string, unknown>) ? signals : undefined;
  }

  private extractAudience(analysis: Record<string, unknown>): AudienceSignals | undefined {
    const nested = this.findNested(analysis, ['audience_signals', 'audience', 'target_audience', 'audienceSignals']);
    
    const signals: AudienceSignals = {
      primary_ages: this.extractStringArray(nested || analysis, ['primary_ages', 'primaryAges', 'age_groups', 'target_ages']),
      vibe_alignments: this.extractStringArray(nested || analysis, ['vibe_alignments', 'vibeAlignments', 'vibes', 'content_vibes']),
      engagement_style: this.extractString(nested || analysis, ['engagement_style', 'engagementStyle', 'engagement_type']),
      niche_specificity: this.extractNumeric(nested || analysis, ['niche_specificity', 'nicheSpecificity', 'niche_level', 'specificity']),
    };

    return this.hasAnyValue(signals as unknown as Record<string, unknown>) ? signals : undefined;
  }

  // =============================================================================
  // VALUE EXTRACTION HELPERS
  // =============================================================================

  private extractNumeric(obj: Record<string, unknown> | undefined, paths: string[]): number | undefined {
    if (!obj) return undefined;

    for (const path of paths) {
      const value = this.getNestedValue(obj, path);
      if (value !== undefined && value !== null) {
        const num = typeof value === 'number' ? value : parseFloat(String(value));
        if (!isNaN(num) && num >= 1 && num <= 10) {
          return Math.round(num * 10) / 10; // Round to 1 decimal
        }
      }
    }
    return undefined;
  }

  private extractString(obj: Record<string, unknown> | undefined, paths: string[]): string | undefined {
    if (!obj) return undefined;

    for (const path of paths) {
      const value = this.getNestedValue(obj, path);
      if (value !== undefined && value !== null && typeof value === 'string' && value.trim()) {
        return value.trim().toLowerCase();
      }
    }
    return undefined;
  }

  private extractStringArray(obj: Record<string, unknown> | undefined, paths: string[]): string[] | undefined {
    if (!obj) return undefined;

    for (const path of paths) {
      const value = this.getNestedValue(obj, path);
      if (Array.isArray(value) && value.length > 0) {
        const strings = value
          .filter((v): v is string => typeof v === 'string')
          .map(s => s.trim().toLowerCase())
          .filter(s => s.length > 0);
        if (strings.length > 0) return strings;
      }
      // Handle comma-separated string
      if (typeof value === 'string' && value.includes(',')) {
        const strings = value.split(',')
          .map(s => s.trim().toLowerCase())
          .filter(s => s.length > 0);
        if (strings.length > 0) return strings;
      }
    }
    return undefined;
  }

  private findNested(obj: Record<string, unknown>, paths: string[]): Record<string, unknown> | undefined {
    for (const path of paths) {
      const value = this.getNestedValue(obj, path);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    }
    return undefined;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    // Handle dot notation
    const parts = path.split('.');
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    
    return current;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private hasAnyValue(obj: Record<string, unknown>): boolean {
    return Object.values(obj).some(v => v !== undefined && v !== null);
  }

  private cleanSignals(signals: VideoSignals): VideoSignals {
    const cleaned: Partial<VideoSignals> = {};
    
    for (const [key, value] of Object.entries(signals)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          const cleanedNested = this.cleanObject(value as Record<string, unknown>);
          if (Object.keys(cleanedNested).length > 0) {
            (cleaned as Record<string, unknown>)[key] = cleanedNested;
          }
        } else {
          (cleaned as Record<string, unknown>)[key] = value;
        }
      }
    }
    
    // Ensure schema_version is always present
    cleaned.schema_version = signals.schema_version || this.version;
    return cleaned as VideoSignals;
  }

  private cleanObject(obj: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  private calculateCoverage(signals: VideoSignals): number {
    const v1_0_keys = ['pacing', 'humor', 'teaching_style', 'content_type', 'target_age_group'];
    const v1_1_keys = ['content_density_signals', 'production_quality_signals', 'replicability_signals', 'audience_signals'];
    
    const allKeys = this.version === 'v1.1' ? [...v1_0_keys, ...v1_1_keys] : v1_0_keys;
    const signalsObj = signals as unknown as Record<string, unknown>;
    
    let found = 0;
    for (const key of allKeys) {
      if (signalsObj[key] !== undefined) {
        found++;
      }
    }
    
    return found / allKeys.length;
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Extract signals from raw Gemini output
 */
export function extractSignals(visualAnalysis: Record<string, unknown>, version: SchemaVersion = CURRENT_SCHEMA_VERSION): ExtractionResult {
  const extractor = new SignalExtractor(version);
  return extractor.extract({ visual_analysis: visualAnalysis });
}

/**
 * Merge extracted signals with human overrides
 */
export function mergeSignals(extracted: VideoSignals, overrides?: Partial<VideoSignals>): VideoSignals {
  if (!overrides || Object.keys(overrides).length === 0) {
    return extracted;
  }
  
  // Deep merge with overrides taking precedence
  const merged: VideoSignals = { ...extracted };
  const mergedObj = merged as unknown as Record<string, unknown>;
  
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && value !== null) {
      const existingValue = mergedObj[key];
      if (typeof value === 'object' && !Array.isArray(value) && existingValue) {
        // Merge nested objects
        mergedObj[key] = {
          ...(existingValue as Record<string, unknown>),
          ...(value as Record<string, unknown>),
        };
      } else {
        mergedObj[key] = value;
      }
    }
  }
  
  return merged;
}

/**
 * Validate signals against schema
 */
export function validateSignals(signals: VideoSignals): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check schema version
  if (!signals.schema_version) {
    errors.push('Missing schema_version');
  }
  
  // Validate numeric ranges
  const numericFields = ['pacing', 'humor', 'teaching_style'] as const;
  for (const field of numericFields) {
    const value = signals[field];
    if (value !== undefined && (value < 1 || value > 10)) {
      errors.push(`${field} must be between 1 and 10, got ${value}`);
    }
  }
  
  // Validate nested numeric fields
  if (signals.content_density_signals) {
    for (const [key, value] of Object.entries(signals.content_density_signals)) {
      if (typeof value === 'number' && (value < 1 || value > 10)) {
        errors.push(`content_density_signals.${key} must be between 1 and 10`);
      }
    }
  }
  
  if (signals.production_quality_signals) {
    for (const [key, value] of Object.entries(signals.production_quality_signals)) {
      if (typeof value === 'number' && (value < 1 || value > 10)) {
        errors.push(`production_quality_signals.${key} must be between 1 and 10`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}
