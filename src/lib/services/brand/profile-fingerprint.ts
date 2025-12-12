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
  embedding: number[] | null
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
 * Fetch video records by URL, creating them if they don't exist.
 */
export async function fetchOrCreateVideos(videoUrls: string[]): Promise<VideoRecord[]> {
  const { data: existing, error } = await supabase
    .from('analyzed_videos')
    .select('id, video_url, platform, embedding, visual_analysis, metadata')
    .in('video_url', videoUrls)

  if (error) throw error

  const existingUrls = new Set((existing || []).map((v) => v.video_url))
  const missing = videoUrls.filter((url) => !existingUrls.has(url))

  // For missing videos, we just return what we have. Caller should analyze missing ones first.
  if (missing.length > 0) {
    console.warn(`[fingerprint] ${missing.length} videos not in DB:`, missing)
  }

  return (existing || []) as VideoRecord[]
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
  energy: number | null
  warmth: number | null
  formality: number | null
  humor_types: string[]
  age_code: string | null
  vibe: string[]
  price_tier: string | null
  primary_intent: string | null
  production_investment: number | null
  effortlessness: number | null
  intentionality: number | null
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
    energy: null,
    warmth: null,
    formality: null,
    humor_types: [],
    age_code: null,
    vibe: [],
    price_tier: null,
    primary_intent: null,
    production_investment: null,
    effortlessness: null,
    intentionality: null
  }

  // From video_ratings (quality)
  if (rating?.overall_score != null) {
    signals.quality_score = rating.overall_score
  }

  // From brand_ratings (Schema v1)
  const ai = brandRating?.ai_analysis
  if (ai?.kind === 'schema_v1_review' && ai.model_analysis) {
    const m = ai.model_analysis
    const s = m.signals as Record<string, unknown> | undefined
    const sc = m.scores as Record<string, unknown> | undefined

    if (sc) {
      signals.execution_coherence = (sc.execution_coherence_0_1 as number) ?? null
      signals.distinctiveness = (sc.distinctiveness_0_1 as number) ?? null
    }

    if (s) {
      const p = s.personality as Record<string, unknown> | undefined
      if (p) {
        signals.energy = (p.energy_1_10 as number) ?? null
        signals.warmth = (p.warmth_1_10 as number) ?? null
        signals.formality = (p.formality_1_10 as number) ?? null
      }

      const h = s.humor as Record<string, unknown> | undefined
      if (h) {
        signals.humor_types = (h.humor_types as string[]) ?? []
        signals.age_code = (h.age_code as string) ?? null
      }

      const hosp = s.hospitality as Record<string, unknown> | undefined
      if (hosp) {
        signals.vibe = (hosp.vibe as string[]) ?? []
        signals.price_tier = (hosp.price_tier as string) ?? null
      }

      const st = s.statement as Record<string, unknown> | undefined
      if (st) {
        signals.primary_intent = (st.primary_intent as string) ?? null
      }

      const ex = s.execution as Record<string, unknown> | undefined
      if (ex) {
        signals.production_investment = (ex.production_investment_1_10 as number) ?? null
        signals.effortlessness = (ex.effortlessness_1_10 as number) ?? null
        signals.intentionality = (ex.intentionality_1_10 as number) ?? null
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
// Fingerprint computation
// -----------------------------------------------------------------------------

export async function computeFingerprint(input: FingerprintInput): Promise<ProfileFingerprint> {
  const videos = await fetchOrCreateVideos(input.video_urls)

  if (videos.length === 0) {
    throw new Error('No videos found for fingerprint computation')
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
  const videosWithEmbeddings = videoSignals.filter((v) => v.video.embedding && v.video.embedding.length === 1536)

  let centroid: number[] = new Array(1536).fill(0)
  let totalWeight = 0

  for (const { video, weight } of videosWithEmbeddings) {
    centroid = addVectors(centroid, scaleVector(video.embedding!, weight))
    totalWeight += weight
  }

  if (totalWeight > 0) {
    centroid = scaleVector(centroid, 1 / totalWeight)
  }

  // Compute layer averages
  const allSignals = videoSignals.map((v) => v.signals)

  const l1Quality: L1QualityLayer = {
    avg_quality_score: average(allSignals.map((s) => s.quality_score).filter((x): x is number => x != null)),
    avg_execution_coherence: average(
      allSignals.map((s) => s.execution_coherence).filter((x): x is number => x != null)
    ),
    avg_distinctiveness: average(allSignals.map((s) => s.distinctiveness).filter((x): x is number => x != null))
  }

  const allHumorTypes = allSignals.flatMap((s) => s.humor_types)
  const allVibes = allSignals.flatMap((s) => s.vibe)
  const ageCodes = allSignals.map((s) => s.age_code).filter((x): x is string => x != null)
  const priceTiers = allSignals.map((s) => s.price_tier).filter((x): x is string => x != null)
  const intents = allSignals.map((s) => s.primary_intent).filter((x): x is string => x != null)

  const l2Likeness: L2LikenessLayer = {
    dominant_humor_types: topN(allHumorTypes, 3),
    avg_energy: average(allSignals.map((s) => s.energy).filter((x): x is number => x != null)),
    avg_warmth: average(allSignals.map((s) => s.warmth).filter((x): x is number => x != null)),
    avg_formality: average(allSignals.map((s) => s.formality).filter((x): x is number => x != null)),
    dominant_age_code: (mode(ageCodes) as L2LikenessLayer['dominant_age_code']) ?? 'mixed',
    dominant_vibe: topN(allVibes, 3),
    dominant_price_tier: (mode(priceTiers) as L2LikenessLayer['dominant_price_tier']) ?? 'mixed',
    dominant_intent: mode(intents)
  }

  const l3Visual: L3VisualLayer = {
    avg_production_investment: average(
      allSignals.map((s) => s.production_investment).filter((x): x is number => x != null)
    ),
    avg_effortlessness: average(allSignals.map((s) => s.effortlessness).filter((x): x is number => x != null)),
    avg_intentionality: average(allSignals.map((s) => s.intentionality).filter((x): x is number => x != null))
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
  if (hasEmbedding < 1) missingDataNotes.push(`${videos.length - videosWithEmbeddings.length} videos missing embeddings`)
  if (hasQuality < 1) missingDataNotes.push(`${allSignals.filter((s) => s.quality_score == null).length} videos missing quality scores`)
  if (hasBrandSignals < 1)
    missingDataNotes.push(`${allSignals.filter((s) => s.execution_coherence == null).length} videos missing Schema v1 analysis`)

  const profileId = input.profile_id ?? `profile_${Date.now()}`

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
    missing_data_notes: missingDataNotes
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
    .select('id, video_url, embedding')
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
  const candidateEmbedding = candidateVideo.embedding as number[] | null
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
      .select('id, embedding')
      .in('id', fingerprint.video_ids)

    for (const pv of profileVideos || []) {
      if (pv.embedding && (pv.embedding as number[]).length === 1536) {
        const sim = cosineSimilarity(candidateEmbedding, pv.embedding as number[])
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
