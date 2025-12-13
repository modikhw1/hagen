/**
 * Profile Fingerprint Service
 *
 * Computes a multi-layer fingerprint from a set of video embeddings and signals.
 * Layer weights: Quality (L1) > Likeness (L2) > Visual (L3)
 */

import { createClient } from '@supabase/supabase-js'
import type {
  ProfileFingerprint,
  FingerprintInput,
  MatchResult,
  L1QualityLayer,
  L2LikenessLayer,
  L3VisualLayer
} from './profile-fingerprint.types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// -----------------------------------------------------------------------------
// Video data fetching
// -----------------------------------------------------------------------------

interface VideoRecord {
  id: string
  video_url: string
  platform: string
  content_embedding: number[] | null
  visual_analysis: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

interface RatingRecord {
  video_id: string
  overall_score: number | null
  dimensions: Record<string, unknown> | null
}

interface BrandRatingRecord {
  video_id: string
  ai_analysis: {
    kind?: string
    model_analysis?: {
      signals?: Record<string, unknown>
      scores?: Record<string, unknown>
    }
  } | null
  extracted_signals: Record<string, unknown> | null
}

/**
 * Fetch video records by URL. Returns found videos and lists missing URLs.
 */
export async function fetchOrCreateVideos(videoUrls: string[]): Promise<{
  videos: VideoRecord[];
  found: string[];
  missing: string[];
}> {
  const { data: existing, error } = await supabase
    .from('analyzed_videos')
    .select('id, video_url, platform, content_embedding, visual_analysis, metadata')
    .in('video_url', videoUrls)

  if (error) throw error

  const existingUrls = new Set((existing || []).map((v) => v.video_url))
  const missing = videoUrls.filter((url) => !existingUrls.has(url))
  const found = videoUrls.filter((url) => existingUrls.has(url))

  if (missing.length > 0) {
    console.warn(`[fingerprint] ${missing.length} videos not in DB:`, missing)
  }

  return {
    videos: (existing || []) as VideoRecord[],
    found,
    missing
  }
}

/**
 * Fetch ratings for a set of video IDs.
 */
async function fetchRatings(videoIds: string[]): Promise<Map<string, RatingRecord>> {
  const { data, error } = await supabase
    .from('video_ratings')
    .select('video_id, overall_score, dimensions')
    .in('video_id', videoIds)

  if (error) throw error

  const map = new Map<string, RatingRecord>()
  for (const r of data || []) {
    map.set(r.video_id, r as RatingRecord)
  }
  return map
}

/**
 * Fetch brand ratings (Schema v1) for a set of video IDs.
 */
async function fetchBrandRatings(videoIds: string[]): Promise<Map<string, BrandRatingRecord>> {
  const { data, error } = await supabase
    .from('video_brand_ratings')
    .select('video_id, ai_analysis, extracted_signals')
    .in('video_id', videoIds)

  if (error) throw error

  const map = new Map<string, BrandRatingRecord>()
  for (const r of data || []) {
    map.set(r.video_id, r as BrandRatingRecord)
  }
  return map
}

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

function average(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function mode<T>(items: T[]): T | null {
  if (items.length === 0) return null
  const counts = new Map<T, number>()
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1)
  }
  let maxCount = 0
  let maxItem: T | null = null
  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count
      maxItem = item
    }
  }
  return maxItem
}

function topN<T>(items: T[], n: number): T[] {
  const counts = new Map<T, number>()
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([item]) => item)
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0,
    normA = 0,
    normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function addVectors(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i])
}

function scaleVector(v: number[], s: number): number[] {
  return v.map((x) => x * s)
}

// -----------------------------------------------------------------------------
// Layer extraction
// -----------------------------------------------------------------------------

interface VideoSignals {
  quality_score: number | null
  execution_coherence: number | null
  distinctiveness: number | null
  confidence: number | null
  message_alignment: number | null
  energy: number | null
  warmth: number | null
  formality: number | null
  self_seriousness: number | null
  humor_types: string[]
  age_code: string | null
  humor_target: string | null
  meanness_risk: string | null
  accessibility: string | null
  price_tier: string | null
  edginess: string | null
  vibe: string[]
  occasions: string[]
  primary_intent: string | null
  cta_types: string[]
  subtext: string[]
  audiences: string[]
  traits: string[]
  service_ethos: string[]
  production_investment: number | null
  effortlessness: number | null
  intentionality: number | null
  social_permission: number | null
  has_repeatable_format: boolean
  format_name: string | null
}

function extractSignals(
  video: VideoRecord,
  rating: RatingRecord | undefined,
  brandRating: BrandRatingRecord | undefined
): VideoSignals {
  const signals: VideoSignals = {
    quality_score: null,
    execution_coherence: null,
    distinctiveness: null,
    confidence: null,
    message_alignment: null,
    energy: null,
    warmth: null,
    formality: null,
    self_seriousness: null,
    humor_types: [],
    age_code: null,
    humor_target: null,
    meanness_risk: null,
    accessibility: null,
    price_tier: null,
    edginess: null,
    vibe: [],
    occasions: [],
    primary_intent: null,
    cta_types: [],
    subtext: [],
    audiences: [],
    traits: [],
    service_ethos: [],
    production_investment: null,
    effortlessness: null,
    intentionality: null,
    social_permission: null,
    has_repeatable_format: false,
    format_name: null
  }

  // From video_ratings (quality)
  if (rating?.overall_score != null) {
    signals.quality_score = rating.overall_score
  }

  // From brand_ratings (Schema v1)
  // The data may be in two locations:
  // 1. model_analysis.signals (flattened format: personality_signals.energy)
  // 2. model_analysis.raw_output.signals (original format: personality.energy_1_10)
  const ai = brandRating?.ai_analysis
  if (ai?.kind === 'schema_v1_review' && ai.model_analysis) {
    const m = ai.model_analysis as Record<string, unknown>
    
    // Try raw_output first (original schema v1 format), then fallback to flattened
    const rawOutput = m.raw_output as Record<string, unknown> | undefined
    const rawSignals = rawOutput?.signals as Record<string, unknown> | undefined
    const rawScores = rawOutput?.scores as Record<string, unknown> | undefined
    
    // Flattened format (processed)
    const flatSignals = m.signals as Record<string, unknown> | undefined
    
    // Extract scores - try raw_output first
    if (rawScores) {
      signals.execution_coherence = (rawScores.execution_coherence_0_1 as number) ?? null
      signals.distinctiveness = (rawScores.distinctiveness_0_1 as number) ?? null
    }

    // Use raw_output.signals if available (original schema format)
    const s = rawSignals || flatSignals
    
    if (s) {
      // Personality - handle both formats
      const p = (s.personality || s.personality_signals) as Record<string, unknown> | undefined
      if (p) {
        // Original format: energy_1_10, flattened format: energy
        signals.energy = (p.energy_1_10 as number) ?? (p.energy as number) ?? null
        signals.warmth = (p.warmth_1_10 as number) ?? (p.warmth as number) ?? null
        signals.formality = (p.formality_1_10 as number) ?? (p.formality as number) ?? null
        signals.self_seriousness = (p.self_seriousness_1_10 as number) ?? (p.self_seriousness as number) ?? null
        signals.confidence = (p.confidence_1_10 as number) ?? (p.confidence as number) ?? null
        signals.traits = (p.traits_observed as string[]) ?? []
      }

      // Humor - handle both formats
      const h = (s.humor || s.humor_mix) as Record<string, unknown> | undefined
      if (h) {
        signals.humor_types = (h.humor_types as string[]) ?? []
        signals.age_code = (h.age_code as string) ?? null
        signals.humor_target = (h.humor_target as string) ?? null
        signals.meanness_risk = (h.meanness_risk as string) ?? null
      }

      // Hospitality - handle both formats  
      const hosp = (s.hospitality || s.hospitality_signals) as Record<string, unknown> | undefined
      if (hosp) {
        signals.vibe = (hosp.vibe as string[]) ?? []
        signals.price_tier = (hosp.price_tier as string) ?? null
        signals.accessibility = (hosp.accessibility as string) ?? null
        signals.edginess = (hosp.edginess as string) ?? null
        signals.occasions = (hosp.occasions as string[]) ?? []
        signals.service_ethos = (hosp.service_ethos as string[]) ?? []
      }

      // Statement - handle both formats
      const st = (s.statement || s.statement_signals) as Record<string, unknown> | undefined
      if (st) {
        signals.primary_intent = (st.primary_intent as string) ?? (st.content_intent as string) ?? null
        signals.cta_types = (st.cta_types as string[]) ?? []
        signals.subtext = (st.subtext as string[]) ?? []
        signals.audiences = (st.apparent_audience as string[]) ?? []
      }

      // Execution - handle both formats
      const ex = (s.execution || s.execution_signals) as Record<string, unknown> | undefined
      if (ex) {
        // Original format: production_investment_1_10, flattened: production_investment
        signals.production_investment = (ex.production_investment_1_10 as number) ?? (ex.production_investment as number) ?? null
        signals.effortlessness = (ex.effortlessness_1_10 as number) ?? (ex.effortlessness as number) ?? null
        signals.intentionality = (ex.intentionality_1_10 as number) ?? (ex.intentionality as number) ?? null
        signals.social_permission = (ex.social_permission_1_10 as number) ?? (ex.social_permission as number) ?? null
        signals.has_repeatable_format = (ex.has_repeatable_format as boolean) ?? false
        signals.format_name = (ex.format_name as string) ?? null
      }
      
      // Coherence - handle both formats
      const coh = (s.coherence || s.coherence_signals) as Record<string, unknown> | undefined
      if (coh) {
        signals.message_alignment = (coh.personality_message_alignment_0_1 as number) ?? (coh.message_alignment as number) ?? null
      }
    }
  }

  return signals
}

// -----------------------------------------------------------------------------
// Weight computation
// -----------------------------------------------------------------------------

/**
 * Compute weight for a video based on quality and coherence.
 * Higher weight = more influence on fingerprint.
 */
function computeVideoWeight(signals: VideoSignals): number {
  const quality = signals.quality_score ?? 0.5
  const coherence = signals.execution_coherence ?? 0.5
  // Quality 60%, coherence 40%
  return quality * 0.6 + coherence * 0.4
}

// -----------------------------------------------------------------------------
// Personality summary generation
// -----------------------------------------------------------------------------

/**
 * Generate a human-readable personality summary from fingerprint layers.
 * This provides interpretable text that can guide content recommendations.
 */
function generatePersonalitySummary(
  l1: L1QualityLayer,
  l2: L2LikenessLayer,
  l3: L3VisualLayer,
  videoCount: number
): string {
  const parts: string[] = []

  // Quality assessment
  const qualityPct = Math.round((l1.avg_quality_score || 0) * 100)
  if (qualityPct >= 80) {
    parts.push('High-quality content creator')
  } else if (qualityPct >= 60) {
    parts.push('Solid content quality')
  } else if (qualityPct >= 40) {
    parts.push('Mixed content quality')
  } else {
    parts.push('Emerging content quality')
  }

  // Energy/warmth personality
  const energy = l2.avg_energy || 5
  const warmth = l2.avg_warmth || 5
  if (energy >= 7 && warmth >= 7) {
    parts.push('with an energetic and warm personality')
  } else if (energy >= 7) {
    parts.push('with high-energy, dynamic presence')
  } else if (warmth >= 7) {
    parts.push('with a warm, approachable tone')
  } else if (energy <= 3 && warmth <= 3) {
    parts.push('with a reserved, professional demeanor')
  } else if (energy <= 3) {
    parts.push('with a calm, measured approach')
  }

  // Humor style
  if (l2.dominant_humor_types.length > 0) {
    const humorStr = l2.dominant_humor_types.slice(0, 2).join(' and ')
    parts.push(`using ${humorStr} humor`)
  }

  // Vibe
  if (l2.dominant_vibe.length > 0) {
    const vibeStr = l2.dominant_vibe.slice(0, 2).join(', ')
    parts.push(`projecting a ${vibeStr} vibe`)
  }

  // Age targeting
  if (l2.dominant_age_code && l2.dominant_age_code !== 'mixed') {
    if (l2.dominant_age_code === 'younger') {
      parts.push('targeting a younger demographic')
    } else if (l2.dominant_age_code === 'older') {
      parts.push('appealing to a mature audience')
    } else if (l2.dominant_age_code === 'balanced') {
      parts.push('with broad age appeal')
    }
  }

  // Production style
  const production = l3.avg_production_investment || 5
  const effortlessness = l3.avg_effortlessness || 5
  if (production >= 7 && effortlessness >= 7) {
    parts.push('with polished yet natural-looking production')
  } else if (production >= 7) {
    parts.push('with high production value')
  } else if (effortlessness >= 7) {
    parts.push('with an effortless, authentic aesthetic')
  } else if (production <= 3) {
    parts.push('with lo-fi, raw production style')
  }

  // Price tier context
  if (l2.dominant_price_tier && l2.dominant_price_tier !== 'mixed') {
    if (l2.dominant_price_tier === 'luxury' || l2.dominant_price_tier === 'premium') {
      parts.push(`positioning in the ${l2.dominant_price_tier} segment`)
    }
  }

  // Combine into readable summary
  let summary = parts.join(', ') + '.'

  // Add reliability note
  if (videoCount < 5) {
    summary += ` (Based on ${videoCount} video${videoCount === 1 ? '' : 's'} — add more for better accuracy.)`
  }

  return summary
}

// -----------------------------------------------------------------------------
// Fingerprint computation
// -----------------------------------------------------------------------------

export async function computeFingerprint(input: FingerprintInput): Promise<ProfileFingerprint> {
  const { videos, found: urlsFound, missing: urlsNotFound } = await fetchOrCreateVideos(input.video_urls)

  if (videos.length === 0) {
    throw new Error('No videos found for fingerprint computation. Make sure videos are analyzed via /analyze-rate first.')
  }

  const videoIds = videos.map((v) => v.id)
  const [ratings, brandRatings] = await Promise.all([fetchRatings(videoIds), fetchBrandRatings(videoIds)])

  // Extract signals per video
  const videoSignals: Array<{ video: VideoRecord; signals: VideoSignals; weight: number }> = []

  for (const video of videos) {
    const rating = ratings.get(video.id)
    const brandRating = brandRatings.get(video.id)
    const signals = extractSignals(video, rating, brandRating)
    const weight = computeVideoWeight(signals)
    videoSignals.push({ video, signals, weight })
  }

  // Compute weighted centroid embedding
  const videosWithEmbeddings = videoSignals.filter((v) => v.video.content_embedding && v.video.content_embedding.length === 1536)

  let centroid: number[] = new Array(1536).fill(0)
  let totalWeight = 0

  for (const { video, weight } of videosWithEmbeddings) {
    centroid = addVectors(centroid, scaleVector(video.content_embedding!, weight))
    totalWeight += weight
  }

  if (totalWeight > 0) {
    centroid = scaleVector(centroid, 1 / totalWeight)
  }

  // Compute layer averages
  const allSignals = videoSignals.map((v) => v.signals)

  const l1Quality: L1QualityLayer = {
    avg_service_fit: average(allSignals.map((s) => s.quality_score).filter((x): x is number => x != null)),
    avg_execution_quality: average(allSignals.map((s) => s.execution_coherence).filter((x): x is number => x != null)),
    avg_execution_coherence: average(
      allSignals.map((s) => s.execution_coherence).filter((x): x is number => x != null)
    ),
    avg_distinctiveness: average(allSignals.map((s) => s.distinctiveness).filter((x): x is number => x != null)),
    avg_confidence: average(allSignals.map((s) => s.confidence).filter((x): x is number => x != null)),
    avg_message_alignment: average(allSignals.map((s) => s.message_alignment).filter((x): x is number => x != null)),
    avg_quality_score: average(allSignals.map((s) => s.quality_score).filter((x): x is number => x != null))
  }

  const allHumorTypes = allSignals.flatMap((s) => s.humor_types)
  const allVibes = allSignals.flatMap((s) => s.vibe)
  const allOccasions = allSignals.flatMap((s) => s.occasions || [])
  const allCTATypes = allSignals.flatMap((s) => s.cta_types || [])
  const allSubtext = allSignals.flatMap((s) => s.subtext || [])
  const allAudiences = allSignals.flatMap((s) => s.audiences || [])
  const allTraits = allSignals.flatMap((s) => s.traits || [])
  const allServiceEthos = allSignals.flatMap((s) => s.service_ethos || [])
  const ageCodes = allSignals.map((s) => s.age_code).filter((x): x is string => x != null)
  const priceTiers = allSignals.map((s) => s.price_tier).filter((x): x is string => x != null)
  const intents = allSignals.map((s) => s.primary_intent).filter((x): x is string => x != null)
  const humorTargets = allSignals.map((s) => s.humor_target).filter((x): x is string => x != null)
  const meannessRisks = allSignals.map((s) => s.meanness_risk).filter((x): x is string => x != null)
  const accessibilities = allSignals.map((s) => s.accessibility).filter((x): x is string => x != null)
  const edginesses = allSignals.map((s) => s.edginess).filter((x): x is string => x != null)

  const l2Likeness: L2LikenessLayer = {
    avg_energy: average(allSignals.map((s) => s.energy).filter((x): x is number => x != null)),
    avg_warmth: average(allSignals.map((s) => s.warmth).filter((x): x is number => x != null)),
    avg_formality: average(allSignals.map((s) => s.formality).filter((x): x is number => x != null)),
    avg_self_seriousness: average(allSignals.map((s) => s.self_seriousness).filter((x): x is number => x != null)),
    avg_confidence: average(allSignals.map((s) => s.confidence).filter((x): x is number => x != null)),
    dominant_humor_types: topN(allHumorTypes, 3),
    dominant_age_code: (mode(ageCodes) as L2LikenessLayer['dominant_age_code']) ?? 'mixed',
    dominant_humor_target: mode(humorTargets) || null,
    dominant_meanness_risk: (mode(meannessRisks) as L2LikenessLayer['dominant_meanness_risk']) || null,
    dominant_accessibility: (mode(accessibilities) as L2LikenessLayer['dominant_accessibility']) || null,
    dominant_price_tier: (mode(priceTiers) as L2LikenessLayer['dominant_price_tier']) ?? 'mixed',
    dominant_edginess: (mode(edginesses) as L2LikenessLayer['dominant_edginess']) || null,
    dominant_vibe: topN(allVibes, 3),
    dominant_occasion: topN(allOccasions, 3),
    dominant_intent: mode(intents),
    dominant_cta_types: topN(allCTATypes, 3),
    collected_subtext: [...new Set(allSubtext)],
    collected_audiences: [...new Set(allAudiences)],
    dominant_traits: topN(allTraits, 5),
    dominant_service_ethos: topN(allServiceEthos, 3)
  }

  const l3Visual: L3VisualLayer = {
    avg_production_investment: average(
      allSignals.map((s) => s.production_investment).filter((x): x is number => x != null)
    ),
    avg_effortlessness: average(allSignals.map((s) => s.effortlessness).filter((x): x is number => x != null)),
    avg_intentionality: average(allSignals.map((s) => s.intentionality).filter((x): x is number => x != null)),
    avg_social_permission: average(allSignals.map((s) => s.social_permission).filter((x): x is number => x != null)),
    has_repeatable_format_pct: allSignals.filter((s) => s.has_repeatable_format).length / allSignals.length,
    collected_format_names: [...new Set(allSignals.flatMap((s) => s.format_name ? [s.format_name] : []))]
  }

  // Build video weights map
  const videoWeights: Record<string, number> = {}
  for (const { video, weight } of videoSignals) {
    videoWeights[video.id] = weight
  }

  // Compute confidence based on data completeness
  const hasEmbedding = videosWithEmbeddings.length / videos.length
  const hasQuality =
    allSignals.filter((s) => s.quality_score != null).length / allSignals.length
  const hasBrandSignals =
    allSignals.filter((s) => s.execution_coherence != null).length / allSignals.length
  const confidence = (hasEmbedding + hasQuality + hasBrandSignals) / 3

  const missingDataNotes: string[] = []
  if (urlsNotFound.length > 0) missingDataNotes.push(`${urlsNotFound.length} URLs not found in database`)
  if (hasEmbedding < 1) missingDataNotes.push(`${videos.length - videosWithEmbeddings.length} videos missing embeddings`)
  if (hasQuality < 1) missingDataNotes.push(`${allSignals.filter((s) => s.quality_score == null).length} videos missing quality scores`)
  if (hasBrandSignals < 1)
    missingDataNotes.push(`${allSignals.filter((s) => s.execution_coherence == null).length} videos missing Schema v1 analysis`)

  const profileId = input.profile_id ?? `profile_${Date.now()}`

  // Generate personality summary from layer data
  const personalitySummary = generatePersonalitySummary(l1Quality, l2Likeness, l3Visual, videos.length)

  return {
    profile_id: profileId,
    profile_name: input.profile_name,
    video_ids: videoIds,
    video_count: videos.length,
    computed_at: new Date().toISOString(),
    embedding: centroid,
    video_weights: videoWeights,
    layers: {
      l1_quality: l1Quality,
      l2_likeness: l2Likeness,
      l3_visual: l3Visual
    },
    confidence,
    missing_data_notes: missingDataNotes,
    urls_not_found: urlsNotFound,
    urls_found: urlsFound,
    personality_summary: personalitySummary
  }
}

// -----------------------------------------------------------------------------
// Match computation
// -----------------------------------------------------------------------------

export async function computeMatch(
  candidateVideoId: string,
  fingerprint: ProfileFingerprint
): Promise<MatchResult> {
  // Fetch candidate video
  const { data: candidateVideo, error: videoError } = await supabase
    .from('analyzed_videos')
    .select('id, video_url, content_embedding')
    .eq('id', candidateVideoId)
    .single()

  if (videoError || !candidateVideo) {
    throw new Error(`Candidate video not found: ${candidateVideoId}`)
  }

  // Fetch candidate ratings and brand ratings
  const [ratings, brandRatings] = await Promise.all([
    fetchRatings([candidateVideoId]),
    fetchBrandRatings([candidateVideoId])
  ])

  const candidateSignals = extractSignals(
    candidateVideo as VideoRecord,
    ratings.get(candidateVideoId),
    brandRatings.get(candidateVideoId)
  )

  // Embedding similarity (raw cosine)
  const candidateEmbedding = candidateVideo.content_embedding as number[] | null
  let embeddingSimilarity = 0
  if (candidateEmbedding && candidateEmbedding.length === 1536 && fingerprint.embedding.length === 1536) {
    embeddingSimilarity = cosineSimilarity(candidateEmbedding, fingerprint.embedding)
  }

  // L1: Quality compatibility (is the candidate at similar quality level?)
  const candidateQuality = candidateSignals.quality_score ?? 0.5
  const fingerprintQuality = fingerprint.layers.l1_quality.avg_quality_score || 0.5
  // Quality compatibility: 1 if same level, lower if candidate is much lower quality
  const qualityDiff = Math.abs(candidateQuality - fingerprintQuality)
  const l1QualityCompatible = Math.max(0, 1 - qualityDiff * 2) // Penalize large gaps

  // L2: Likeness match (personality/tone alignment)
  const energyDiff = Math.abs(
    (candidateSignals.energy ?? 5) - (fingerprint.layers.l2_likeness.avg_energy || 5)
  ) / 10
  const warmthDiff = Math.abs(
    (candidateSignals.warmth ?? 5) - (fingerprint.layers.l2_likeness.avg_warmth || 5)
  ) / 10
  const humorOverlap = candidateSignals.humor_types.filter((h) =>
    fingerprint.layers.l2_likeness.dominant_humor_types.includes(h)
  ).length / Math.max(1, candidateSignals.humor_types.length, fingerprint.layers.l2_likeness.dominant_humor_types.length)
  const ageMatch = candidateSignals.age_code === fingerprint.layers.l2_likeness.dominant_age_code ? 1 : 0.5

  const l2LikenessMatch = (
    (1 - energyDiff) * 0.25 +
    (1 - warmthDiff) * 0.25 +
    humorOverlap * 0.3 +
    ageMatch * 0.2
  )

  // L3: Visual proximity (production value similarity)
  const prodDiff = Math.abs(
    (candidateSignals.production_investment ?? 5) - (fingerprint.layers.l3_visual.avg_production_investment || 5)
  ) / 10
  const effortDiff = Math.abs(
    (candidateSignals.effortlessness ?? 5) - (fingerprint.layers.l3_visual.avg_effortlessness || 5)
  ) / 10

  const l3VisualProximity = 1 - (prodDiff + effortDiff) / 2

  // Find closest and furthest videos in profile
  let closestVideoId: string | null = null
  let closestSimilarity = 0
  let furthestVideoId: string | null = null
  let furthestSimilarity = 1

  if (candidateEmbedding && candidateEmbedding.length === 1536) {
    const { data: profileVideos } = await supabase
      .from('analyzed_videos')
      .select('id, content_embedding')
      .in('id', fingerprint.video_ids)

    for (const pv of profileVideos || []) {
      if (pv.content_embedding && (pv.content_embedding as number[]).length === 1536) {
        const sim = cosineSimilarity(candidateEmbedding, pv.content_embedding as number[])
        if (sim > closestSimilarity) {
          closestSimilarity = sim
          closestVideoId = pv.id
        }
        if (sim < furthestSimilarity) {
          furthestSimilarity = sim
          furthestVideoId = pv.id
        }
      }
    }
  }

  // Overall match: weighted combination
  // L1 (quality) and L2 (likeness) matter most, L3 (visual) less, embedding is baseline
  const overallMatch =
    l1QualityCompatible * 0.25 +
    l2LikenessMatch * 0.35 +
    l3VisualProximity * 0.10 +
    embeddingSimilarity * 0.30

  // Generate explanation
  const explanationParts: string[] = []
  if (l2LikenessMatch > 0.7) explanationParts.push('Strong personality match')
  else if (l2LikenessMatch > 0.5) explanationParts.push('Moderate personality alignment')
  else explanationParts.push('Personality differs')

  if (humorOverlap > 0.5) explanationParts.push('similar humor style')
  if (l1QualityCompatible > 0.8) explanationParts.push('matching quality level')
  else if (candidateQuality > fingerprintQuality) explanationParts.push('higher quality than profile average')
  else if (candidateQuality < fingerprintQuality - 0.2) explanationParts.push('lower quality than profile standard')

  if (l3VisualProximity < 0.5) explanationParts.push('different production style')

  return {
    candidate_video_id: candidateVideoId,
    profile_id: fingerprint.profile_id,
    overall_match: Math.round(overallMatch * 100) / 100,
    layer_scores: {
      l1_quality_compatible: Math.round(l1QualityCompatible * 100) / 100,
      l2_likeness_match: Math.round(l2LikenessMatch * 100) / 100,
      l3_visual_proximity: Math.round(l3VisualProximity * 100) / 100,
      embedding_similarity: Math.round(embeddingSimilarity * 100) / 100
    },
    closest_video_id: closestVideoId,
    closest_similarity: Math.round(closestSimilarity * 100) / 100,
    furthest_video_id: furthestVideoId,
    furthest_similarity: Math.round(furthestSimilarity * 100) / 100,
    explanation: explanationParts.join(', ')
  }
}
