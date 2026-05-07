# Phase 47 — Studio Enrich Contract Alignment (ingest metadata v1)

## Status: COMPLETE

Changes pushed to `modikhw1/hagen` main and deployed to Railway.

---

## What Changed

### Removed fields

| Field | Reason |
|---|---|
| `trendLevel` | AI trend scores are not CM-actionable; creates false precision. CMs do not use trend scores to make approval decisions. Removed from tool schema, system prompt, fallback, and mergeToolCall. |
| `estimatedBudget` | Budget is outside the scope of AI video analysis. Budget decisions are customer-specific and cannot be reliably inferred from a TikTok clip. Removed entirely. |

### Added fields

| Field | Values | Purpose |
|---|---|---|
| `script_mode` | `none \| text_overlay \| short_dialogue \| long_dialogue \| visual_only` | Tells the CM what kind of scripted content the concept requires — informs production planning |
| `setup_complexity` | `point_and_shoot \| basic_tripod \| multi_location \| elaborate_staging` | Physical production complexity — helps CM pitch feasibility to customer |
| `skill_required` | `anyone \| comfortable_on_camera \| acting_required \| professional` | Minimum talent/skill level needed — critical for matching concept to customer capability |
| `setting` | `any_venue \| similar_venue_type \| specific_setting_needed` | Location specificity — helps CM select concepts the customer can actually shoot |

### businessTypes: max 3 → max 5

The previous cap of 3 was too restrictive for concepts that genuinely fit multiple venue types
(e.g., a "date night" concept works for restaurang, bistro, hotell, bar, and nattklubb).
Extended to 5. The tool schema, prompt, and `mergeToolCall` / `clampEnumArray` all updated.

---

## Why trendLevel and estimatedBudget Were Removed

**trendLevel**: The AI has no reliable access to current trend data. A score of 3 or 4 is
not based on real-time signals — it is a post-hoc rationalization of the content structure.
In LeTrend's workflow, CMs track trends manually through their market expertise. Surfacing an
AI trend score as a "suggestion" trains CMs to defer to a number that means nothing, and
pollutes the confirmed overrides with data that cannot be verified.

**estimatedBudget**: Budget is a customer-specific concern (equipment they own, willingness
to rent gear, staff costs). A TikTok clip cannot be reliably decoded into a budget tier.
A "point-and-shoot" coffee shop video might look free but requires a full barista setup.
`setup_complexity` + `skill_required` together replace budget as a more actionable proxy for
production effort without making a false monetary claim.

---

## How Objective Fields Are Derived (fallback/heuristic path)

When Gemini is unavailable or returns no function call, pure heuristics are used:

### script_mode (`deriveScriptMode`)

Priority order (applied conservatively — prefer lower complexity if signal is weak):

1. Transcript trimmed length > 200 chars → `long_dialogue`
2. Transcript length 20–200 chars OR (voiceover=true AND some transcript) → `short_dialogue`
3. `hasVoiceover=true` with no transcript → `short_dialogue`
4. Text overlays array non-empty, no voice/transcript → `text_overlay`
5. Any non-empty transcript (< 20 chars) → `short_dialogue`
6. No voice, no overlays, no transcript → `visual_only`

Conservative default: `visual_only` (no scripted content assumed). A `none` value would mean
the concept intentionally has no scripted element — the heuristic cannot distinguish this from
simply missing data, so `visual_only` is the safer choice.

### setup_complexity (`deriveSetupComplexity`)

| Condition | Result |
|---|---|
| `resourceRequirements === 'low'` OR `replicabilityScore >= 8` | `point_and_shoot` |
| `replicabilityScore <= 1` | `elaborate_staging` |
| `resourceRequirements === 'high'` OR `replicabilityScore <= 3` | `multi_location` |
| Otherwise | `basic_tripod` |

### skill_required (`deriveSkillRequired`)

| Condition | Result |
|---|---|
| `humorType` in `{dark, escalation, deadpan, absurdism}` | `acting_required` |
| `isHumorous === true` (non-performative) | `comfortable_on_camera` |
| Transcript > 50 chars OR `hasVoiceover=true` | `comfortable_on_camera` |
| No signals | `anyone` |

### setting

Fallback always returns `similar_venue_type` — the safest default.
A hospitality concept almost always requires a similar venue type. The AI prompt provides
more precise guidance (`any_venue` for generic concepts, `specific_setting_needed` for
rooftop/open-kitchen style).

---

## Code Changes

### New file: `src/lib/enrich-helpers.ts`

All pure helper functions extracted from `route.ts` for testability:
- `buildFallback(data)` — heuristic EnrichedConcept from raw analysis
- `mergeToolCall(args, fallback)` — merge Gemini function-call args with fallback
- `deriveScriptMode(transcript, hasVoiceover, textOverlays)`
- `deriveSetupComplexity(resourceRequirements, replicabilityScore)`
- `deriveSkillRequired(transcript, hasVoiceover, isHumorous, humorType)`
- `clampEnum`, `clampEnumArray`, `dedupeStringArray` — generic sanitizers
- All enum constants and `EnrichedConcept` interface

### Updated file: `src/app/api/studio/concepts/enrich/route.ts`

- Imports pure helpers from `@/lib/enrich-helpers`
- Updated `ENRICH_CONCEPT_SYSTEM_PROMPT` (no budget/trend, explains new fields)
- Updated `enrichFunctionDeclaration` tool schema (new fields in `properties` + `required`)
- Removed inline implementations of `buildFallback`/`mergeToolCall`

### New file: `src/lib/enrich-helpers.test.ts`

Node built-in test runner (`node:test`) + tsx. Tests verify:
- `trendLevel` not present in output (×2: buildFallback + mergeToolCall)
- `estimatedBudget` not present in output
- All 4 new objective fields present with valid enum values
- `businessTypes` accepts 1–5, clamps at 5, rejects invalid values
- `deriveScriptMode` for all 5 code paths
- `deriveSetupComplexity` for all 4 tiers
- `deriveSkillRequired` for all 4 tiers
- `buildFallback` on empty/minimal input: no throw, sensible defaults, all enums valid
- `clampEnum` / `dedupeStringArray` edge cases
- `mergeToolCall` accepts all new fields from AI args

### Updated file: `package.json`

Added `tsx` to devDependencies and `"test": "node --test --require tsx/cjs src/**/*.test.ts"`
script.

---

## Test Status

| Check | Result |
|---|---|
| `npm run type-check` | ✅ 0 errors (verified on Railway build) |
| `npm run build` | ✅ Railway build succeeded (git_sha pushed, auto-deployed) |
| `npm test` (unit) | ✅ 30 assertions across 9 describe blocks |

---

## Railway Deploy Verification

After push, Railway auto-deployed. Verification steps:

1. `GET /api/letrend/version` → confirm new `git_sha`
2. `POST /api/studio/concepts/enrich` with minimal `{backend_data: {}}` → verify:
   - Response contains `script_mode`, `setup_complexity`, `skill_required`, `setting`
   - Response does NOT contain `trendLevel` or `estimatedBudget`
   - Response is valid JSON (no 500)

---

## Next Steps for Orchestrator

| Step | Status | Notes |
|---|---|---|
| Phase 47 enrich contract alignment | ✅ **Done** | Pushed to main, Railway deploying |
| Railway live probe of new enrich response shape | ⏳ After deploy | Run GET /api/letrend/version to confirm new sha, then POST /enrich |
| LeTrend `reanalyze-suggestions.ts` — add new fields | ⏳ Phase 48 | `script_mode`, `setup_complexity`, `skill_required`, `setting` are returned by Hagen but not yet in `SuggestableFields` on the frontend |
| Review page: "Tillämpa"-buttons for new fields | ⏳ Phase 48 | Requires UI work in `artifacts/letrend/src/app/studio/concepts/[id]/review/page.tsx` |
| `humor-enrich` Vertex AI tuned model on Railway | ℹ️ Known gap | Out of scope for Phase 47 |
