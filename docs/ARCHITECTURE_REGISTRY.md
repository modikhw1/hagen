# Architecture Registry

> **Purpose**: Single source of truth for component dependencies. Update this file BEFORE modifying any component.

## Quick Reference: What To Update When...

| If you change... | You MUST also update... |
|------------------|-------------------------|
| Signal extraction logic | `SignalExtractor`, migration script if schema changes |
| Signal schema/types | `types.ts`, `video_signals` table, migration script |
| Embedding model | Re-run embeddings for all `video_signals` |
| Fingerprint algorithm | Re-compute all fingerprints, update `profile-fingerprint.ts` |
| Rating UI fields | Nothing else (decoupled by design) |

---

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER A: IMMUTABLE DATA                       │
│  Source: Gemini API raw output, YouTube metadata                 │
│  Tables: analyzed_videos.visual_analysis, video_insights         │
│  Rule: NEVER modify after creation                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 LAYER B: EXTRACTED SIGNALS                       │
│  Source: Parsed from Layer A via SignalExtractor                 │
│  Table: video_signals (schema_version, extracted, human_overrides)│
│  Rule: Versioned, re-extractable, human overrides preserved      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LAYER C: COMPUTED VALUES                        │
│  Source: Computed from Layer B                                   │
│  Fields: video_signals.embedding, video_signals.fingerprint      │
│  Tables: brand_fingerprints (aggregated from user's videos)      │
│  Rule: Always re-computable, never manually edited               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Registry

### 1. Signal Extractor (`src/lib/services/signals/extractor.ts`)

**Purpose**: Parse raw Gemini output into structured signals

**Inputs**:
- `analyzed_videos.visual_analysis` (raw Gemini JSON)
- Schema version to extract

**Outputs**:
- `VideoSignals` object (typed, validated)

**Dependencies**: None (pure transformation)

**Dependents**:
- `/api/analyze-rate/route.ts` - calls after analysis
- `migrate-to-video-signals.ts` - backfill script

---

### 2. Video Signals Table (`video_signals`)

**Purpose**: Store extracted signals with versioning

**Schema**:
```sql
video_signals (
  id uuid PRIMARY KEY,
  video_id uuid REFERENCES analyzed_videos(id),
  schema_version text NOT NULL,  -- 'v1.0', 'v1.1', etc.
  extracted jsonb NOT NULL,       -- SignalExtractor output
  human_overrides jsonb,          -- User corrections
  embedding vector(1536),         -- For similarity search
  fingerprint jsonb,              -- Computed fingerprint
  created_at, updated_at
)
```

**Rule**: One row per video per schema version

---

### 3. Embedding Generator (`src/lib/openai/embeddings.ts`)

**Purpose**: Generate embeddings from signal text

**Inputs**:
- `video_signals.extracted` - structured signals

**Outputs**:
- 1536-dimensional vector

**Model**: `text-embedding-3-small`

**Trigger**: Called when signals are saved/updated

---

### 4. Fingerprint Computer (`src/lib/services/brand/profile-fingerprint.ts`)

**Purpose**: Compute fingerprint from signals

**Inputs**:
- `video_signals.extracted` - structured signals
- `video_signals.human_overrides` - if any

**Outputs**:
- Fingerprint object with normalized scores

**Dependents**:
- Brand matching algorithm
- `/api/brand-analysis/profile/prepare-profile/route.ts`

---

### 5. Brand Fingerprint Aggregator

**Purpose**: Aggregate video fingerprints into brand profile

**Inputs**:
- Multiple `video_signals.fingerprint` for a brand

**Outputs**:
- `brand_fingerprints` row (aggregated fingerprint)

**Trigger**: When user clicks "Compute Fingerprint" in UI

---

## Data Flow Diagrams

### Flow 1: New Video Analysis

```
User uploads video
       │
       ▼
┌─────────────────┐
│ Gemini Analysis │ → analyzed_videos.visual_analysis (Layer A)
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ SignalExtractor │ → video_signals.extracted (Layer B)
└─────────────────┘
       │
       ├──────────────────┐
       ▼                  ▼
┌─────────────┐    ┌─────────────────┐
│ Embeddings  │    │ Fingerprint     │
└─────────────┘    └─────────────────┘
       │                  │
       ▼                  ▼
video_signals.embedding   video_signals.fingerprint (Layer C)
```

### Flow 2: User Rating/Correction

```
User adjusts signal values in UI
              │
              ▼
┌─────────────────────────┐
│ Save to human_overrides │ → video_signals.human_overrides
└─────────────────────────┘
              │
              ▼
┌─────────────────────────┐
│ Recompute fingerprint   │ → video_signals.fingerprint (updated)
└─────────────────────────┘
              │
              ▼
┌─────────────────────────┐
│ Recompute embedding     │ → video_signals.embedding (updated)
└─────────────────────────┘
```

### Flow 3: Brand Profile Matching

```
User requests brand profile
              │
              ▼
┌─────────────────────────────────┐
│ Fetch user's video_signals rows │
└─────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ Aggregate fingerprints          │ → brand_fingerprints
└─────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ Vector similarity search        │ → matching videos
└─────────────────────────────────┘
```

---

## Migration Path

### Phase 1: Create New Tables (Non-Breaking)
1. Create `video_signals` table
2. Create `video_insights` table (optional, for rich metadata)
3. Both coexist with legacy tables

### Phase 2: Backfill Data
1. Run `scripts/migrate-to-video-signals.ts --dry-run`
2. Review output
3. Run `scripts/migrate-to-video-signals.ts`

### Phase 3: Update API Routes
1. `/api/analyze-rate` writes to `video_signals`
2. `/api/brand-analysis/profile` reads from `video_signals`
3. Keep legacy tables as backup

### Phase 4: Deprecate Legacy (Optional)
1. Stop writing to `video_ratings`, `video_brand_ratings`
2. Archive old data
3. Drop legacy tables (only after confirming all data migrated)

---

## Schema Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2024-11 | Initial: basic signals (pacing, humor, teaching_style) |
| v1.1 | 2024-12 | Added: content_density_signals, production_quality_signals, replicability_signals, audience_signals |

---

## Environment Variables

| Variable | Purpose | Required For |
|----------|---------|--------------|
| `GEMINI_API_KEY` | Gemini File API video analysis | SignalExtractor input |
| `OPENAI_API_KEY` | Embedding generation | Layer C embeddings |
| `NEXT_PUBLIC_SUPABASE_URL` | Database connection | All layers |
| `SUPABASE_SERVICE_ROLE_KEY` | Database writes | Signal storage |

---

## Troubleshooting

### "Signals not pre-populating"
1. Check `analyzed_videos.visual_analysis` exists for video
2. Check `SignalExtractor` can parse the raw output
3. Check schema version matches expected format

### "Fingerprint matching returns no results"
1. Check `video_signals.embedding` is populated
2. Check `video_signals.fingerprint` is computed
3. Check brand has enough rated videos

### "Migration script fails"
1. Check source table has data
2. Check schema version is recognized
3. Run with `--dry-run` first

---

## File Locations

```
src/
  lib/
    services/
      signals/
        types.ts          # Signal type definitions
        extractor.ts      # SignalExtractor service
        index.ts          # Exports
      brand/
        profile-fingerprint.ts  # Fingerprint computation
    openai/
      embeddings.ts       # Embedding generation

scripts/
  migrate-to-video-signals.ts  # Data migration

supabase/
  migrations/
    016_video_signals_table.sql  # New tables
```
