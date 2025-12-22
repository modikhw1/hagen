# Profile Fingerprint Layers — Technical Documentation

> **Purpose**: Document how each fingerprint layer is computed, what data feeds it, and how to interpret the results.

---

## Overview

A **Profile Fingerprint** aggregates signals from multiple videos to create a multi-dimensional representation of a brand's content identity. The fingerprint has three primary layers plus an embedding-based similarity measure.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROFILE FINGERPRINT                          │
├─────────────────────────────────────────────────────────────────┤
│  L1: Quality        │  Service Fit + Execution Quality          │
│  L2: Personality    │  Tone, Humor, Positioning, Intent         │
│  L3: Production     │  Visual/Production DNA                    │
│  Embedding          │  1536-dim semantic centroid                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Quality

**Purpose**: Assess content quality from two perspectives—utility for the service and objective execution quality.

### L1a: Service Fit (0-1)

**What it measures**: How useful is this content style for our service's target clients?

**Data source**: `video_ratings.overall_score` from `/analyze-rate`

**Interpretation**:
- **0.9 (Excellent)**: Strong standalone concept, highly replicable, ideal for most service businesses
- **0.7 (Good)**: Solid content with clear value, minor limitations
- **0.5 (Mediocre)**: Functional but not distinctive, limited replicability
- **0.3 (Low)**: Content style not aligned with service offering (e.g., Gen Z meme format)

**Important**: A low Service Fit score does NOT mean bad content—it means the style isn't what we'd typically recommend to clients. A skilled meme creator might score 0.3 here but 0.8 on Execution Quality.

### L1b: Execution Quality (0-1)

**What it measures**: How well-executed is the content, regardless of style?

**Data sources** (from Schema v1):
| Signal | Weight | Description |
|--------|--------|-------------|
| `scores.execution_coherence_0_1` | 35% | Message-delivery alignment |
| `scores.distinctiveness_0_1` | 35% | Originality, not derivative |
| `personality.confidence_1_10` | 15% | Delivery confidence (normalized) |
| `coherence.personality_message_alignment_0_1` | 15% | Internal consistency |

**Formula**:
```
execution_quality = (
  execution_coherence * 0.35 +
  distinctiveness * 0.35 +
  (confidence / 10) * 0.15 +
  personality_message_alignment * 0.15
)
```

### Combined L1 Display

| Service Fit | Execution Quality | Interpretation |
|-------------|-------------------|----------------|
| High | High | Ideal match for service |
| High | Low | Good concept, poor execution |
| Low | High | Skilled creator, different style |
| Low | Low | Not a fit |

---

## Layer 2: Personality

**Purpose**: Capture the brand's character, communication style, and positioning.

### Sub-dimensions

#### 2a: Tone (numeric averages, 1-10 scale)

| Signal | Source | Description |
|--------|--------|-------------|
| `energy` | `personality.energy_1_10` | Calm (1) ↔ High-energy (10) |
| `warmth` | `personality.warmth_1_10` | Distant (1) ↔ Warm/friendly (10) |
| `formality` | `personality.formality_1_10` | Casual (1) ↔ Formal (10) |
| `self_seriousness` | `statement.self_seriousness_1_10` | Playful (1) ↔ Serious (10) |
| `confidence` | `personality.confidence_1_10` | Tentative (1) ↔ Confident (10) |

**Aggregation**: Simple average across all videos with valid data.

#### 2b: Humor Profile

| Signal | Source | Aggregation |
|--------|--------|-------------|
| `humor_types` | `humor.humor_types[]` | Top 3 by frequency |
| `age_code` | `humor.age_code` | Mode (younger/older/balanced) |
| `humor_target` | `humor.target` | Mode (self/customer/situation/etc) |
| `meanness_risk` | `humor.meanness_risk` | Mode (low/medium/high) |

**Common humor types**: situational, observational, self-deprecating, absurd, irony, exaggeration, deadpan, teasing, wordplay, physical

#### 2c: Positioning

| Signal | Source | Aggregation |
|--------|--------|-------------|
| `accessibility` | `personality.social_positioning.accessibility` | Mode |
| `price_tier` | `hospitality.price_tier` | Mode |
| `edginess` | `statement.opinion_stance.edginess` | Mode |
| `vibe` | `hospitality.vibe[]` | Top 3 by frequency |
| `occasion` | `hospitality.occasion[]` | Top 3 by frequency |

**Accessibility values**: everyman, aspirational, exclusive, elite
**Edginess values**: safe, mild, moderate, edgy, provocative

#### 2d: Intent & Messaging

| Signal | Source | Aggregation |
|--------|--------|-------------|
| `primary_intent` | `statement.primary_intent` | Mode |
| `cta_types` | `conversion.cta_types[]` | Top 3 by frequency |
| `subtext_themes` | `statement.subtext[]` | Top 5 by frequency |
| `apparent_audience` | `statement.apparent_audience` | Collected as list |

**Intent values**: inspire, entertain, inform, challenge, comfort, provoke, connect, sell

#### 2e: Character Traits

| Signal | Source | Aggregation |
|--------|--------|-------------|
| `traits_observed` | `personality.traits_observed[]` | Top 5 by frequency |
| `service_ethos` | `hospitality.service_ethos[]` | Top 3 by frequency |

---

## Layer 3: Production DNA

**Purpose**: Capture visual style, production investment, and format consistency.

### Signals

| Signal | Source | Scale | Description |
|--------|--------|-------|-------------|
| `production_investment` | `execution.production_investment_1_10` | 1-10 | Lo-fi (1) ↔ High production (10) |
| `effortlessness` | `execution.effortlessness_1_10` | 1-10 | Labored (1) ↔ Effortless (10) |
| `intentionality` | `execution.intentionality_1_10` | 1-10 | Spontaneous (1) ↔ Planned (10) |
| `social_permission` | `execution.social_permission_1_10` | 1-10 | Private (1) ↔ Shareable (10) |
| `has_repeatable_format` | `execution.has_repeatable_format` | boolean | Uses consistent format? |
| `format_names` | `execution.format_name_if_any` | string[] | Collected format identifiers |

### Production Style Archetypes

| Production | Effortlessness | Intentionality | Archetype |
|------------|----------------|----------------|-----------|
| High (8+) | High (8+) | High (8+) | "Polished Professional" |
| High (8+) | Low (3-) | High (8+) | "Overproduced" |
| Low (3-) | High (8+) | Low (3-) | "Authentic Casual" |
| Low (3-) | Low (3-) | Low (3-) | "Rough Amateur" |
| Mid (4-7) | High (8+) | Mid (4-7) | "Effortless Cool" |

---

## Embedding Layer

**Purpose**: Semantic similarity via vector space.

### Computation

1. Each video has a 1536-dim OpenAI embedding (`analyzed_videos.content_embedding`)
2. Embeddings are weighted by video quality: `weight = service_fit * 0.6 + execution_quality * 0.4`
3. Weighted centroid computed: `centroid = Σ(embedding * weight) / Σ(weight)`

### Usage in Matching

| Component | Weight | Description |
|-----------|--------|-------------|
| L1 Quality Compatible | 25% | Candidate quality vs profile quality |
| L2 Likeness Match | 35% | Personality signal alignment |
| L3 Visual Proximity | 10% | Production style similarity |
| Embedding Similarity | 30% | Cosine similarity to centroid |

---

## Confidence Score

**Purpose**: Indicate data completeness for the fingerprint.

**Formula**:
```
confidence = (
  videos_with_embeddings / total_videos +
  videos_with_quality_scores / total_videos +
  videos_with_schema_v1 / total_videos
) / 3
```

**Thresholds**:
- **≥80%**: High confidence, reliable fingerprint
- **60-79%**: Moderate confidence, some gaps
- **<60%**: Low confidence, add more analyzed videos

---

## Personality Summary Generation

**Purpose**: Generate human-readable description of the brand's content identity.

**Method**: LLM (Claude) synthesis of all layer signals.

**Input**: Structured JSON of L1, L2, L3 signals plus video count.

**Output goals**:
- Sound like a creative brief, not a data dump
- Highlight what makes them distinctive
- Describe their content philosophy/values
- Note who they appeal to
- Be specific and memorable (avoid generic phrases)

**Anti-patterns to avoid**:
- "Using situational humor" → Instead: "Their comedy comes from real customer moments, not scripted bits"
- "Casual vibe" → Instead: "They talk to the camera like you're already friends"
- "Mixed content quality" → Instead: "Some videos land perfectly, others feel rushed"

---

## Data Flow

```
┌──────────────────┐     ┌──────────────────┐
│  /analyze-rate   │     │ /brand-analysis  │
│  (quality tier)  │     │ (Schema v1)      │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐
│  video_ratings   │     │video_brand_ratings│
│  overall_score   │     │  ai_analysis      │
│  dimensions      │     │  (Schema v1 JSON) │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         └──────────┬─────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │  extractSignals()│
         │  (per video)     │
         └────────┬─────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌───────┐   ┌───────┐     ┌───────┐
│  L1   │   │  L2   │     │  L3   │
│Quality│   │Person.│     │Produc.│
└───┬───┘   └───┬───┘     └───┬───┘
    │           │             │
    └───────────┼─────────────┘
                │
                ▼
      ┌──────────────────┐
      │generatePersonality│
      │  (Claude LLM)     │
      └────────┬─────────┘
               │
               ▼
      ┌──────────────────┐
      │ProfileFingerprint│
      │  (final output)  │
      └──────────────────┘
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/lib/services/brand/profile-fingerprint.ts` | Core fingerprint computation |
| `src/lib/services/brand/profile-fingerprint.types.ts` | TypeScript interfaces |
| `src/lib/services/brand/schema-v1.ts` | Schema v1 Zod definitions |
| `src/app/api/brand-profile/fingerprint/route.ts` | API endpoint |
| `src/app/brand-profile/page.tsx` | UI for fingerprint tool |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2024 | Initial L1/L2/L3 implementation |
| 2.0 | Dec 2025 | Split L1 (Service Fit + Execution Quality), expanded L2 sub-dimensions, added LLM personality summary |
