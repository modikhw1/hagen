# Brand Analysis System - Implementation Guide

## Overview

This document describes the Brand Analysis system - a parallel to the existing `/analyze-rate` system but focused on brand signals rather than humor/quality analysis.

### Core Concept: The Brand Object

A Brand is composed of two equally weighted pillars:

1. **Self-Perception (Person/Personality)** - Who is the brand if it were a person?
2. **Statement (Message)** - What is the brand saying? Including subtext and subcommunications.

## Current Implementation (Phase 1) ✅

### What's Been Built

1. **Brand Type Definitions** (`src/lib/services/brand/brand.ts`)
   - Complete `Brand` interface with two pillars
   - `SelfPerception` with persona, focus, self-relationship
   - `Statement` with context, audience, personality, content
   - Helper functions for narrative generation

2. **Brand Analysis Types** (`src/lib/services/brand/brand-analysis.types.ts`)
   - `VideoBrandSignals` - structured signals from a video
   - `VideoBrandRating` - human interpretation storage
   - `VideoBrandAnalysis` - AI analysis placeholder
   - `CreatorBrandProfile` - future profile-level analysis

3. **Database Schema** (`supabase/migrations/012_brand_analysis.sql`)
   - `video_brand_ratings` table with embeddings
   - `creator_brand_profiles` table (future)
   - Vector similarity search function
   - Proper indexes and triggers

4. **API Routes**
   - `POST/GET /api/brand-analysis` - Save/retrieve brand ratings
   - `GET /api/brand-analysis/similar` - RAG similarity search

5. **UI Page** (`src/app/brand-analysis/page.tsx`)
   - Video list from rated library
   - Two text fields: Personality + Statement
   - Similar videos panel (RAG context)
   - Corrections field for model training

6. **Placeholder Analyzer** (`src/lib/services/brand/brand-analyzer.ts`)
   - Empty analysis function (returns placeholder)
   - Ready for Gemini Vertex integration

### How to Use (Current)

1. Run the database migration:
   ```bash
   supabase db push
   # or apply migration manually
   ```

2. Navigate to `/brand-analysis`

   > Note: The UI now lives at `/brand-analysis-v1` (and `/brand-analysis` redirects there).

3. Select a rated video from the library

4. Write your interpretation:
   - **Personality**: Who is this brand as a person?
   - **Statement**: What are they really saying?

5. Save the rating (creates embedding for RAG)

---

## Phase 2: Signal Extraction (Next)

---

## Schema v1 (Hospitality): Character + Brand Completeness

> **Target domain (current)**: Restaurants, cafés, bars, hotels (service SMBs)
>
> **Goal**: Make mass analysis reliable by enforcing a strict schema that separates:
> 1) **Observed signals** (what is actually in the video/assets)
> 2) **Inferred meaning** (what those signals imply about the brand/person)
> 3) **Evidence** (timestamps / asset references)

### Why this schema exists

When you analyze at scale, the failure mode is “vibes” — inconsistent interpretations and no audit trail. This schema forces:
- **Evidence-backed extraction** (quotes, OCR, timestamps)
- **Comparability across profiles** (same keys everywhere)
- **A clean bridge** between:
   - the *brand-as-person* abstraction (Self-Perception + Statement)
   - and the *hospitality-specific reality* (vibe, occasion, service cues, menu cues)

### Objects (what we store)

There are three distinct objects in the system:

1) **Business Self-Perception (Desired Identity)**
- Comes from the AI conversation in the brand profile flow.
- Stored in `brand_profiles` (NOT `creator_brand_profiles`).

2) **Observed Public Persona (Expressed Identity)**
- Comes from video/profile analysis.
- Stored in `video_brand_ratings.ai_analysis` (per-video) and eventually `creator_brand_profiles` (aggregate).

3) **Recommendation Fingerprint (What content matches)**
- Used for retrieval/ranking (embeddings + filters).
- Should separate **brand-fit** from **entertainment-fit**.

---

## A) Per-video schema: `VideoBrandObservationV1`

Minimum contract: return valid JSON matching this shape.

```json
{
   "schema_version": 1,
   "video": {
      "video_id": "uuid-or-platform-id",
      "platform": "tiktok",
      "video_url": "https://...",
      "gcs_uri": "gs://...",
      "detected_language": "en"
   },
   "signals": {
      "personality": {
         "energy_1_10": 7,
         "formality_1_10": 3,
         "warmth_1_10": 8,
         "confidence_1_10": 7,
         "traits_observed": ["direct", "playful", "helpful"],
         "social_positioning": {
            "accessibility": "everyman",
            "authority_claims": false,
            "peer_relationship": true
         }
      },
      "statement": {
         "primary_intent": "entertain",
         "subtext": ["we get it", "we’re competent"],
         "apparent_audience": "locals who like casual brunch",
         "self_seriousness_1_10": 4,
         "opinion_stance": {
            "makes_opinions": true,
            "edginess": "mild",
            "defended": false
         }
      },
      "execution": {
         "intentionality_1_10": 7,
         "production_investment_1_10": 5,
         "effortlessness_1_10": 6,
         "social_permission_1_10": 5,
         "has_repeatable_format": true,
         "format_name_if_any": "POV: customer order skit"
      },
      "hospitality": {
         "business_type": "cafe",
         "vibe": ["cozy", "friendly"],
         "occasion": ["quick coffee", "study"],
         "price_tier": "mid",
         "service_ethos": ["fast", "welcoming"],
         "signature_items_or_offers": ["cinnamon bun", "matcha"],
         "locality_markers": ["neighborhood", "city name"],
         "tourist_orientation": "mixed"
      },
      "humor": {
         "present": true,
         "humor_types": ["sketch", "observational"],
         "target": "situation",
         "age_code": "balanced",
         "meanness_risk": "low"
      },
      "conversion": {
         "cta_types": ["follow_for_series", "visit_in_store"],
         "visit_intent_strength_0_1": 0.4
      },
      "coherence": {
         "personality_message_alignment_0_1": 0.8,
         "contradictions": []
      }
   },
   "scores": {
      "brand_intent_signal_0_1": 0.72,
      "execution_coherence_0_1": 0.70,
      "distinctiveness_0_1": 0.55,
      "trust_signals_0_1": 0.62
   },
   "evidence": [
      {
         "type": "quote",
         "start_s": 1.2,
         "end_s": 4.0,
         "text": "Follow for part 2 — barista edition",
         "supports": ["execution.has_repeatable_format", "conversion.cta_types"]
      },
      {
         "type": "ocr",
         "start_s": 0.0,
         "end_s": 2.0,
         "text": "POV: when someone orders...",
         "supports": ["execution.format_name_if_any", "humor.humor_types"]
      }
   ],
   "confidence": {
      "overall_0_1": 0.74,
      "notes": "Lower confidence if transcript/OCR is missing"
   },
   "uncertainties": ["Cannot verify objective claims (e.g., ‘best in town’)" ]
}
```

### Notes on the *observable* axes (from real ratings)

These map directly to the recurring patterns in `SELF_PERCEPTION_FRAMEWORK_v1.0.md`:
- `execution.production_investment_1_10`
- `execution.intentionality_1_10`
- `execution.social_permission_1_10` (risk allowance / frame control)
- `execution.effortlessness_1_10` (does it *feel* native vs forced?)

---

## B) Profile asset schema: `ProfileAssetsV1`

Use this when analyzing a handle/feed. This is intentionally “dumb but consistent”.

```json
{
   "schema_version": 1,
   "profile": {
      "platform": "tiktok",
      "handle": "@example",
      "display_name": "Example Café",
      "bio": "...",
      "links": ["https://..."],
      "profile_image_description": "...",
      "pinned_video_ids": ["..."],
      "thumbnail_style_notes": "Consistent white text overlays; latte art closeups"
   },
   "signals": {
      "positioning_claims": ["specialty coffee", "neighborhood spot"],
      "tone_claims": ["funny", "cozy"],
      "target_audience_claims": ["locals", "students"],
      "conversion_setup": {
         "has_menu_link": true,
         "has_booking_link": false,
         "has_location_marker": true
      }
   },
   "confidence": { "overall_0_1": 0.7 }
}
```

---

## C) Profile aggregation schema: `ProfileBrandAssessmentV1`

This is the profile-level output used for comparisons and recommendations.

```json
{
   "schema_version": 1,
   "profile": {
      "platform": "tiktok",
      "handle": "@example"
   },
   "brand": {
      "self_perception": {
         "persona": {
            "age_range": "young-adult",
            "values": ["quality", "friendliness"],
            "social_positioning": { "accessibility": "everyman", "cultural_capital": "mainstream" }
         },
         "focus": { "focus_type": "focused" }
      },
      "statement": {
         "context": { "subtext": ["we’re the easy choice", "we respect your time"] }
      }
   },
   "content_system": {
      "pillars": [
         { "name": "customer interaction skits", "weight_0_1": 0.45 },
         { "name": "product visuals", "weight_0_1": 0.35 },
         { "name": "local/community", "weight_0_1": 0.20 }
      ],
      "signature_formats": ["POV hook", "what we say vs what we mean"],
      "voice_rules_inferred": ["short hook", "friendly teasing", "never mean to customers" ]
   },
   "scorecard": {
      "positioning_clarity_0_1": 0.78,
      "promise_consistency_0_1": 0.74,
      "visual_identity_consistency_0_1": 0.62,
      "message_coherence_0_1": 0.76,
      "distinctiveness_0_1": 0.55,
      "trust_signals_0_1": 0.60,
      "conversion_intent_0_1": 0.58,
      "overall_brand_completeness_0_1": 0.66
   },
   "recommendation_fingerprint": {
      "brand_fit_keywords": ["cozy", "friendly", "specialty coffee", "locals"],
      "entertainment_fit_keywords": ["observational", "service skit", "low meanness"],
      "constraints": {
         "risk_tolerance": "moderate",
         "acting_complexity_ceiling": 6,
         "production_complexity_ceiling": 5
      }
   },
   "evidence_map": {
      "videos_used": ["..."],
      "profile_assets_used": true
   },
   "confidence": { "overall_0_1": 0.72 }
}
```

---

## Vertex prompt contract (must-have for mass reliability)

When you run Gemini/Vertex, enforce these rules:

1. **Return JSON only** (no markdown, no prose)
2. **Conform to schema keys exactly** (unknown fields are forbidden)
3. **Evidence is mandatory**
    - At least 2 evidence items
    - Each evidence item must support specific keys
4. **Observed vs inferred separation**
    - If a value cannot be observed, set it to `null` and explain in `uncertainties`
5. **Language matters**
    - Return `detected_language`
    - If translation is needed, include that in `uncertainties`

---

## Sampling strategy (profile-level)

Don’t start by analyzing everything. Start with a consistent sample for comparability:

- Pinned videos (if any)
- Top performers (by views/likes, if available)
- Most recent (last 10)
- Small random sample (5)

This yields a reliable first-pass fingerprint without blowing up compute.

---

## Recommendation logic (two-fit model)

To recommend videos that “match the brand”, separate:

1) **Brand-fit** (identity compatibility)
- Persona/values/vibe/positioning alignment

2) **Entertainment-fit** (execution compatibility)
- Humor type, cleverness, age-code, meanness risk
- Production/acting complexity vs the business’s capacity

This prevents recommending “the right vibe” videos that the business cannot realistically execute.

### Goal
Develop structured signal extraction from free-form notes.

### Tasks

1. **Pattern Recognition**
   - Analyze existing ratings for common patterns
   - Identify key dimensions that emerge naturally
   - Build a codebook of personality/statement signals

2. **UI Enhancement**
   - Add optional structured fields alongside free-form
   - Energy slider (1-10)
   - Formality slider (1-10)
   - Self-seriousness slider (1-10)
   - Checkboxes for common traits

3. **Signal Extraction Service**
   ```typescript
   // Extract signals from notes using Claude/GPT
   async function extractSignalsFromNotes(
     personalityNotes: string,
     statementNotes: string
   ): Promise<VideoBrandSignals>
   ```

4. **Database Updates**
   - Add structured signal columns
   - Update embedding to include signals

---

## Phase 3: Gemini Vertex Integration

### Goal
Train Gemini to analyze videos for brand signals.

### Development Process

1. **Collect Training Data**
   - Export 20-50 videos with human interpretations
   - Format for Gemini fine-tuning or prompt engineering

2. **Develop Analysis Prompt**
   ```
   Analyze this video for brand signals:
   
   PERSONALITY:
   - Energy level (1-10)
   - Formality (1-10)
   - Warmth (1-10)
   - Key traits observed
   - Social positioning
   
   STATEMENT:
   - Subtext / between the lines
   - Primary intent
   - Target audience
   - Self-seriousness
   - Opinion stance
   ```

3. **Iterative Refinement**
   - Run analysis on rated videos
   - Compare with human ratings
   - Collect corrections via UI
   - Refine prompt based on corrections

4. **Integrate with Existing Analysis**
   - Add brand signals to `/api/videos/analyze/deep`
   - Cross-reference with humor analysis
   - Store in existing `visual_analysis` field

### Brand Analyzer Implementation

```typescript
// src/lib/services/brand/brand-analyzer.ts
export class BrandAnalyzer {
  async analyzeWithGemini(videoUri: string): Promise<VideoBrandAnalysis> {
    // Similar to existing GeminiVideoAnalyzer
    // But with brand-focused prompt
  }
}
```

---

## Phase 4: Cross-Reference with Humor Analysis

### Goal
Understand how brand signals correlate with content choices.

### Implementation

1. **Correlation Analysis**
   ```typescript
   interface BrandHumorCorrelation {
     brand_energy: number
     humor_type: string
     correlation_strength: number
   }
   ```

2. **Insights Dashboard**
   - High-energy brands tend to use X humor type
   - Self-deprecating humor correlates with Y personality
   - Statement formality affects content choices

3. **Recommendation Engine**
   - Given a brand profile, suggest appropriate humor types
   - Flag content that doesn't match brand

---

## Phase 5: Profile-Level Analysis

### Goal
Analyze entire creator profiles, not just individual videos.

### Implementation

1. **Profile Fetching**
   - API to fetch all videos from a creator
   - Handle TikTok, YouTube, Instagram profiles

2. **Video Sampling**
   - Sample N representative videos
   - Weight by views/engagement

3. **Signal Aggregation**
   ```typescript
   function aggregateBrandSignals(
     videos: VideoWithBrandRating[]
   ): Brand {
     // Aggregate personality signals
     // Aggregate statement signals
     // Calculate consistency metrics
     // Generate synthesis narrative
   }
   ```

4. **Consistency Metrics**
   - Personality stability over time
   - Message stability over time
   - Evolution tracking

5. **UI for Profile Analysis**
   - Input: Profile URL
   - Output: Brand synthesis
   - Visualization of signal distribution

---

## Database Schema Summary

### video_brand_ratings
```sql
id UUID PRIMARY KEY
video_id UUID REFERENCES analyzed_videos
personality_notes TEXT
statement_notes TEXT
ai_analysis JSONB
corrections TEXT
extracted_signals JSONB
brand_embedding vector(1536)
similar_videos JSONB
training_exported BOOLEAN
rater_id TEXT
created_at, updated_at TIMESTAMPTZ
```

### creator_brand_profiles (Future)
```sql
id UUID PRIMARY KEY
platform TEXT
handle TEXT
brand JSONB
self_perception_summary TEXT
statement_summary TEXT
analyzed_videos JSONB
consistency_scores JSONB
created_at, updated_at TIMESTAMPTZ
```

---

## API Reference

### POST /api/brand-analysis
Save a brand rating for a video.

Request:
```json
{
  "video_id": "uuid",
  "video_url": "https://...",
  "personality_notes": "This brand is...",
  "statement_notes": "They communicate by...",
  "corrections": "AI got X wrong...",
  "ai_analysis": { ... }
}
```

Response:
```json
{
  "success": true,
  "id": "uuid",
  "video_id": "uuid",
  "message": "Brand rating saved"
}
```

### GET /api/brand-analysis?video_id=xxx
Get existing brand rating for a video.

### GET /api/brand-analysis/similar?video_id=xxx&limit=5
Find similar videos by brand signals.

---

## Files Structure

```
src/
  lib/services/brand/
    brand.ts                 # Core Brand type definitions
    brand-analysis.types.ts  # Video-level analysis types
    brand-analyzer.ts        # Gemini analyzer (placeholder)
    types.ts                 # Existing brand profile types
    conversation.ts          # Existing conversation service
    prompts.ts              # Existing prompts
    index.ts                # Exports
  
  app/
    brand-analysis/
      page.tsx              # Main UI
    api/
      brand-analysis/
        route.ts            # Save/get ratings
        similar/
          route.ts          # RAG similar search

supabase/migrations/
  012_brand_analysis.sql    # Schema
```

---

## Next Steps

1. **Run Migration**
   ```bash
   supabase db push
   ```

2. **Test UI**
   - Navigate to `/brand-analysis`
   - Rate 5-10 videos to build RAG context

3. **Iterate on Fields**
   - See what patterns emerge from free-form notes
   - Decide on structured fields to add

4. **Develop Gemini Prompt**
   - Start with basic signal extraction
   - Refine based on human feedback

---

## Open Questions

1. **Signal Taxonomy**: What are the definitive dimensions?
   - Current: energy, formality, warmth, self-seriousness
   - To discover: What else emerges from data?

2. **Profile Analysis**: How to handle multi-personality brands?
   - Some brands have consistent voice
   - Others have multiple content types

3. **Training Data Format**: Gemini fine-tuning vs prompting?
   - Depends on data volume
   - Start with prompting, move to fine-tuning

4. **Cross-Platform Consistency**: Same brand, different platforms?
   - TikTok vs YouTube voice differences
   - Should they be unified or separate?
