/**
 * Service Layer Types
 * 
 * These interfaces define contracts that any implementation must follow.
 * This allows us to swap out providers (Gemini→Claude, Supadata→Different API)
 * without changing application code.
 */

// Video Analysis Provider Interface
export interface VideoAnalysisProvider {
  name: string
  analyzeVideo(url: string, options?: VideoAnalysisOptions): Promise<VideoAnalysis>
}

export interface VideoAnalysisOptions {
  includeAudio?: boolean
  includeVisual?: boolean
  includeText?: boolean
  detailLevel?: 'basic' | 'detailed' | 'comprehensive'
}

export interface VideoAnalysis {
  provider: string
  analyzedAt: string
  
  visual?: {
    scenes: Scene[]
    colorPalette: string[]
    lighting: string
    composition: string
    aestheticStyle: string
    overallQuality: number // 0-1
  }
  
  audio?: {
    musicGenre?: string
    musicEnergy?: number // 0-1
    voiceTone?: string
    soundEffects?: string[]
    audioQuality: number // 0-1
  }
  
  content?: {
    pacing: string
    emotions: string[]
    themes: string[]
    hooks: Hook[]
    callToAction?: string
  }
  
  technical?: {
    duration: number
    resolution?: string
    fps?: number
    editingStyle: string
    cutFrequency: number // cuts per minute
  }
  
  // Raw response from provider (for debugging/re-processing)
  rawResponse?: unknown
}

export interface Scene {
  timestamp: number
  duration: number
  description: string
  objects?: string[]
  actions?: string[]
  emotions?: string[]
}

export interface Hook {
  type: 'visual' | 'verbal' | 'text' | 'action'
  timestamp: number
  description: string
  strength: number // 0-1
}

// Metadata Provider Interface
export interface MetadataProvider {
  name: string
  fetchMetadata(url: string): Promise<VideoMetadata>
}

export interface VideoMetadata {
  provider: string
  platform: string
  videoId: string
  url: string
  
  title?: string
  description?: string
  
  author: {
    username: string
    displayName: string
    avatarUrl?: string
    verified?: boolean
    followerCount?: number
  }
  
  stats: {
    views?: number
    likes?: number
    comments?: number
    shares?: number
    saves?: number
  }
  
  media: {
    type: 'video' | 'image' | 'carousel'
    duration?: number
    thumbnailUrl?: string
  }
  
  tags?: string[]
  createdAt: string
  
  // Platform-specific data
  additionalData?: Record<string, unknown>
  
  // Raw response from provider
  rawResponse?: unknown
}

// Embedding Provider Interface
export interface EmbeddingProvider {
  name: string
  model: string
  dimensions: number
  generateEmbedding(text: string): Promise<number[]>
  generateEmbeddings(texts: string[]): Promise<number[][]>
  prepareTextForEmbedding(data: {
    metadata?: any
    analysis?: any
    userRatings?: Record<string, any>
    userTags?: string[]
    computedMetrics?: Record<string, number>
  }): string
}

// Pattern Discovery Interface
export interface PatternDiscoveryProvider {
  name: string
  discoverPatterns(videos: RatedVideo[]): Promise<DiscoveredPattern[]>
}

export interface RatedVideo {
  id: string
  metadata: VideoMetadata
  analysis: VideoAnalysis
  userRatings: Record<string, number | string | boolean>
  userTags: string[]
  computedMetrics?: Record<string, number>
}

export interface DiscoveredPattern {
  type: 'correlation' | 'suggestion' | 'insight'
  confidence: number
  description: string
  data: {
    field?: string
    suggestedField?: string
    correlation?: number
    examples?: string[] // video IDs
    [key: string]: unknown
  }
}

// Metrics Calculator Interface
export interface MetricsCalculator {
  name: string
  calculateMetrics(video: {
    metadata: VideoMetadata
    analysis?: VideoAnalysis
  }): Record<string, number>
}
