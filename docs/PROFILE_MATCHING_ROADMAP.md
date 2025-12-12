# Profile Fingerprint Matching — Roadmap & Context

> **Purpose**: Match candidate videos to a brand's "fingerprint" derived from their existing content, prioritizing quality, likeness, then production value.

---

## Core Abstraction

A **profile fingerprint** is a multi-layer representation of a brand's content identity:

| Layer | Weight | What It Captures | Source |
|-------|--------|------------------|--------|
| **L1: Quality/Virality** | Highest | Sketch quality, proven engagement, concept strength | `/analyze-rate` scores, engagement metrics |
| **L2: Likeness/Personality** | High | Tone, energy, humor type, cultural fit | Schema v1 signals, brand profile |
| **L3: Visual/Production** | Lower | Production value, editing style, visual aesthetic | Gemini visual analysis |

### Why Layered?

The end user's priority order:
1. **Quality of purchase** — "This is clearly a winner sketch with proven virality"
2. **Likeness to self-perception** — "This fits our makeup and would just work"
3. **Visual closeness** — "Similar production value, but concept matters more"

---

## Current State (Dec 2024)

### What Exists
- OpenAI embeddings (1536-dim) stored per video in `analyzed_videos.embedding`
- Brand embeddings in `video_brand_ratings.brand_embedding`
- Similarity search via `find_similar_videos()` RPC (cosine distance)
- Schema v1 extraction: personality, humor, hospitality, execution signals
- `/analyze-rate` quality tiers + dimension scores

### What's Missing
- Profile-level aggregation (currently video-by-video only)
- Layered fingerprint computation (current embeddings are flat)
- Engagement/quality weighting in similarity
- Profile scraping automation (manual URL paste for now)

---

## Implementation Plan

### Phase 1: Manual Profile Fingerprint (This Session)

1. **Profile endpoint** `/api/brand-analysis/profile`
   - Accept: array of video URLs (5-10)
   - Fetch/create `analyzed_videos` records
   - Compute fingerprint from their embeddings + signals

2. **Fingerprint computation** `src/lib/services/brand/profile-fingerprint.ts`
   - Weighted centroid of video embeddings
   - Weight = f(quality_score, engagement_proxy, schema_v1_scores)
   - Output: `ProfileFingerprint` with layer breakdowns

3. **Match endpoint** `/api/brand-analysis/match`
   - Accept: candidate video ID + profile fingerprint
   - Return: overall match %, layer breakdown, closest/furthest videos

4. **UI integration** in `/brand-analysis-v1`
   - Textarea to paste profile video URLs
   - "Compute Fingerprint" button
   - Match scores displayed per video in library

### Phase 2: Automated Scraping (Future)

- TikTok profile scraping via alternative to Supadata (RapidAPI, Apify, or direct)
- Auto-fetch recent N videos from profile URL
- Periodic refresh of fingerprints

### Phase 3: Learning Loop (Future)

- Human feedback: "This was a good match" / "This didn't fit"
- Adjust layer weights based on feedback
- A/B test matching strategies

---

## Schema v1 Signals Relevant to Matching

### L2 (Likeness) Signals
| Signal Path | Why It Matters |
|-------------|----------------|
| `signals.personality.energy_1_10` | Matching energy levels between brands |
| `signals.personality.warmth_1_10` | Tone alignment |
| `signals.humor.humor_types[]` | Same humor style = natural fit |
| `signals.humor.age_code` | Audience age alignment |
| `signals.hospitality.vibe[]` | Venue vibe compatibility |
| `signals.hospitality.price_tier` | Class/positioning alignment |
| `signals.statement.primary_intent` | Content purpose alignment |

### L1 (Quality) Signals
| Signal Path | Why It Matters |
|-------------|----------------|
| `scores.execution_coherence_0_1` | Well-made content |
| `scores.distinctiveness_0_1` | Original, not derivative |
| Rating from `/analyze-rate` | Human quality judgment |
| Engagement metrics (if available) | Proven performance |

### L3 (Visual) Signals
| Signal Path | Why It Matters |
|-------------|----------------|
| `signals.execution.production_investment_1_10` | Budget/effort similarity |
| `signals.execution.effortlessness_1_10` | Polish level |
| Gemini `visual_analysis` | Aesthetic descriptors |

---

## Fingerprint Algorithm (v1)

```typescript
interface ProfileFingerprint {
  profile_id: string;
  video_ids: string[];
  computed_at: string;
  
  // Weighted centroid embedding
  embedding: number[];  // 1536-dim
  
  // Layer averages for interpretability
  layers: {
    l1_quality: {
      avg_quality_score: number;      // 0-1
      avg_execution_coherence: number; // 0-1
    };
    l2_likeness: {
      dominant_humor_types: string[];
      avg_energy: number;             // 1-10
      avg_warmth: number;             // 1-10
      dominant_age_code: string;
      dominant_vibe: string[];
    };
    l3_visual: {
      avg_production_investment: number; // 1-10
      avg_effortlessness: number;        // 1-10
    };
  };
}
```

### Weight Calculation
```typescript
function computeVideoWeight(video: AnalyzedVideo): number {
  const qualityWeight = (video.rating?.overall_score ?? 0.5);
  const coherenceWeight = (video.brand_signals?.scores?.execution_coherence_0_1 ?? 0.5);
  
  // Quality matters most
  return (qualityWeight * 0.6) + (coherenceWeight * 0.4);
}
```

---

## Match Score Breakdown

When comparing a candidate video to a profile fingerprint:

```typescript
interface MatchResult {
  overall_match: number;  // 0-1, target ≥ 0.85
  
  layer_scores: {
    l1_quality_compatible: number;   // Does quality level fit?
    l2_likeness_match: number;       // Personality/tone alignment
    l3_visual_proximity: number;     // Production value similarity
  };
  
  // Interpretability
  closest_video_in_profile: string;
  closest_similarity: number;
  explanation: string;  // "High energy match, similar sketch humor, slightly higher production value"
}
```

---

## Key Decisions

1. **Embedding source**: Use existing OpenAI embeddings (already computed for most videos)
2. **Weight formula**: Quality 60%, Coherence 40% for v1; tune based on feedback
3. **Match threshold**: 85% (0.85 cosine similarity) as starting target
4. **Profile size**: 5-10 videos sufficient for stable fingerprint

---

## Next Steps After This Session

1. [ ] Add engagement metrics to video records (public like/view counts)
2. [ ] Build profile scraping automation (TikTok profile → video list)
3. [ ] Add "Match Feedback" UI: thumbs up/down on recommendations
4. [ ] Tune layer weights based on accumulated feedback
5. [ ] Consider separate embeddings per layer (not just weighted centroid)
6. [ ] Profile comparison view: brand A vs brand B fingerprint overlap

---

## Files Created/Modified

| File | Purpose |
|------|---------|
| `docs/PROFILE_MATCHING_ROADMAP.md` | This document |
| `src/lib/services/brand/profile-fingerprint.ts` | Fingerprint computation |
| `src/lib/services/brand/profile-fingerprint.types.ts` | Type definitions |
| `src/app/api/brand-analysis/profile/route.ts` | Profile endpoint |
| `src/app/api/brand-analysis/match/route.ts` | Match endpoint |
| `src/app/brand-analysis/BrandAnalysisClient.tsx` | UI additions |
