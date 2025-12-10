/**
 * Brand Analysis Types
 * 
 * Types for analyzing the "Brand" dimensions of videos:
 * - Self-Perception (Person/Personality) - Who is the brand?
 * - Statement (Message) - What is the brand saying?
 * 
 * This system allows:
 * 1. Analyzing individual videos for brand signals
 * 2. Aggregating across videos to build a creator/brand profile
 * 3. Training a model to detect these signals automatically
 */

import { Brand, SelfPerception, Statement } from './brand'

// =============================================================================
// VIDEO-LEVEL BRAND ANALYSIS
// =============================================================================

/**
 * Brand signals extracted from a single video
 * These are the observations that feed into the Brand object
 */
export interface VideoBrandSignals {
  /**
   * Personality signals observed in this video
   */
  personality_signals?: {
    /**
     * Energy level demonstrated (1-10)
     */
    energy?: number
    
    /**
     * Formality level (1-10, 1=very casual, 10=very formal)
     */
    formality?: number
    
    /**
     * Warmth/approachability (1-10)
     */
    warmth?: number
    
    /**
     * Confidence level displayed (1-10)
     */
    confidence?: number
    
    /**
     * Key personality traits observed
     */
    traits_observed?: string[]
    
    /**
     * Social positioning signals
     */
    social_signals?: {
      accessibility?: 'everyman' | 'aspirational' | 'exclusive'
      authority_claims?: boolean
      peer_relationship?: boolean
    }
  }
  
  /**
   * Statement/message signals observed in this video
   */
  statement_signals?: {
    /**
     * What is being communicated between the lines?
     */
    subtext?: string[]
    
    /**
     * Primary intent of this content
     */
    content_intent?: 'inspire' | 'entertain' | 'inform' | 'challenge' | 'comfort' | 'provoke' | 'connect' | 'sell'
    
    /**
     * Who appears to be the target audience?
     */
    apparent_audience?: string
    
    /**
     * Self-seriousness level (1-10)
     */
    self_seriousness?: number
    
    /**
     * Does the creator seem to respect their own content/brand?
     */
    self_respect_signals?: boolean
    
    /**
     * Opinion-making behavior
     */
    opinion_stance?: {
      makes_opinions?: boolean
      edginess?: 'safe' | 'mild' | 'moderate' | 'edgy' | 'provocative'
      defended?: boolean
    }
    
    /**
     * Humor characteristics if present
     */
    humor_signals?: {
      present?: boolean
      type?: string[]
      targets?: string[]
      self_deprecating?: boolean
    }
  }
  
  /**
   * Overall coherence observations
   */
  coherence_signals?: {
    /**
     * Does the personality match the message?
     */
    personality_message_alignment?: number // 0-1
    
    /**
     * Any tensions or contradictions observed?
     */
    tensions?: string[]
  }
}

/**
 * Human interpretation of brand signals in a video
 * This is what gets stored when a user rates a video for brand
 */
export interface VideoBrandRating {
  id: string
  video_id: string
  
  /**
   * Free-form interpretation of the personality/person
   * "Who is this brand if it were a person?"
   */
  personality_notes: string
  
  /**
   * Free-form interpretation of the statement/message
   * "What is the brand really saying? What's the subtext?"
   */
  statement_notes: string
  
  /**
   * Optional: Structured signals extracted (can be AI-assisted)
   */
  extracted_signals?: VideoBrandSignals
  
  /**
   * AI analysis of this video (Gemini, etc.)
   */
  ai_analysis?: VideoBrandAnalysis
  
  /**
   * For learning: Corrections to AI analysis
   */
  corrections?: string
  
  /**
   * Reference to similar videos (RAG)
   */
  similar_videos?: {
    video_id: string
    similarity: number
  }[]
  
  /**
   * Embedding for RAG search
   */
  embedding?: number[]
  
  rater_id: string
  created_at: string
  updated_at: string
}

/**
 * AI-generated brand analysis (from Gemini Vertex)
 * Currently a placeholder - to be developed through iteration
 */
export interface VideoBrandAnalysis {
  /**
   * Model used for analysis
   */
  model: string
  
  /**
   * When analysis was performed
   */
  analyzed_at: string
  
  /**
   * Version of the analysis schema
   */
  schema_version: number
  
  /**
   * Placeholder: Raw analysis output
   * Structure will evolve through training
   */
  raw_output?: Record<string, unknown>
  
  /**
   * Extracted signals (once model is trained)
   */
  signals?: VideoBrandSignals
  
  /**
   * Confidence scores
   */
  confidence?: {
    overall: number
    personality: number
    statement: number
  }
}

// =============================================================================
// PROFILE-LEVEL BRAND ANALYSIS (Future)
// =============================================================================

/**
 * Aggregated brand profile from multiple videos
 * Future: Analyze entire creator profile
 */
export interface CreatorBrandProfile {
  /**
   * Creator/profile identifier
   */
  creator_id: string
  
  /**
   * Platform (TikTok, YouTube, Instagram)
   */
  platform: string
  
  /**
   * Handle/username
   */
  handle: string
  
  /**
   * The synthesized Brand object
   */
  brand: Brand
  
  /**
   * Videos analyzed to build this profile
   */
  analyzed_videos: {
    video_id: string
    weight: number // How much this video contributed to the profile
  }[]
  
  /**
   * Consistency metrics
   */
  consistency?: {
    personality_stability: number // 0-1
    message_stability: number // 0-1
    evolution_notes?: string
  }
  
  /**
   * Sample/summary of the statement across all content
   */
  aggregate_statement?: {
    common_themes: string[]
    recurring_subtext: string[]
    audience_relationship: string
  }
  
  created_at: string
  updated_at: string
}

// =============================================================================
// TRAINING DATA EXPORT
// =============================================================================

/**
 * Format for exporting training data
 */
export interface BrandTrainingExample {
  /**
   * Video URL
   */
  video_url: string
  
  /**
   * Human-provided interpretation
   */
  human_interpretation: {
    personality_notes: string
    statement_notes: string
  }
  
  /**
   * AI analysis (if available)
   */
  ai_analysis?: VideoBrandAnalysis
  
  /**
   * Corrections to AI analysis
   */
  corrections?: string
  
  /**
   * Structured signals for training
   */
  target_signals?: VideoBrandSignals
}

// =============================================================================
// API TYPES
// =============================================================================

/**
 * Request to analyze a video for brand signals
 */
export interface BrandAnalyzeRequest {
  video_url?: string
  video_id?: string
}

/**
 * Response from brand analysis
 */
export interface BrandAnalyzeResponse {
  success: boolean
  video_id: string
  video_url: string
  
  /**
   * AI analysis (placeholder for now)
   */
  ai_analysis?: VideoBrandAnalysis
  
  /**
   * Similar videos for context
   */
  similar_videos?: {
    video_id: string
    video_url: string
    similarity: number
    personality_notes?: string
    statement_notes?: string
  }[]
  
  /**
   * Any existing rating for this video
   */
  existing_rating?: VideoBrandRating
}

/**
 * Request to save a brand rating
 */
export interface BrandRatingSaveRequest {
  video_id: string
  video_url: string
  personality_notes: string
  statement_notes: string
  corrections?: string
  ai_analysis?: VideoBrandAnalysis
}

/**
 * Response from saving a brand rating
 */
export interface BrandRatingSaveResponse {
  success: boolean
  id: string
  video_id: string
  message: string
}
