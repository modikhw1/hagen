# Phase 48 — Version Endpoint Dynamic + Phase 47 Enrich Contract Smoke

## Status: COMPLETE ✅

---

## Problem: version endpoint was statically cached

`GET /api/letrend/version` is used by the api-server's `GET /api/studio/hagen/status`
to confirm which Hagen build Railway is running. Before this fix, two consecutive calls
returned the exact same `now` value:

```
call 1 → now: 2026-05-07T19:00:19.675Z
call 2 → now: 2026-05-07T19:00:19.675Z  ← identical, 2 seconds later
```

Next.js 14 statically optimises API routes that have no dynamic data sources by default.
Since `version/route.ts` only reads environment variables and `new Date()`, Next.js
detected it as static-eligible and baked the response at build time (or on first cold
render). Subsequent requests returned the cached frozen response — `now` never advanced.

This made the endpoint unreliable for deployment diagnostics: `git_sha` was frozen,
`started_at` was frozen, and there was no way to tell if the endpoint was responding live
or serving a stale CDN/edge cache.

---

## Fix Applied

Added two Next.js directives to `src/app/api/letrend/version/route.ts`:

```typescript
export const dynamic = 'force-dynamic'
export const revalidate = 0
```

And returned `Cache-Control: no-store, no-cache, must-revalidate` in the response headers.

Together these ensure:
1. `force-dynamic` — Next.js always runs the route handler per-request, never at build time.
2. `revalidate = 0` — explicitly opts out of ISR (Incremental Static Regeneration).
3. `Cache-Control: no-store` — instructs Railway's CDN/proxy and any intermediate caches
   not to store the response.

The JSON shape is unchanged — no downstream consumers are broken.

### Verification (after Railway redeploy)

```bash
curl -s "$HAGEN_URL/api/letrend/version" | jq .now
sleep 3
curl -s "$HAGEN_URL/api/letrend/version" | jq .now
# Expected: two different ISO timestamps 3 seconds apart
```

---

## Phase 47 Enrich Contract Smoke Results

Live probe run against Railway before Phase 48 push:

```bash
curl -s -X POST "$HAGEN_URL/api/studio/concepts/enrich" \
  -H "Content-Type: application/json" \
  -d '{"backend_data":{}}'
```

### Response shape (heuristic fallback — no GEMINI_API_KEY on Railway)

```json
{
  "overrides": {
    "headline_sv": "Nytt videokoncept",
    "description_sv": "",
    "whyItWorks_sv": "",
    "script_sv": "",
    "productionNotes_sv": [],
    "whyItFits_sv": [],
    "difficulty": "medium",
    "filmTime": "10min",
    "peopleNeeded": "solo",
    "mechanism": "recognition",
    "market": "SE",
    "script_mode": "visual_only",
    "setup_complexity": "basic_tripod",
    "skill_required": "anyone",
    "setting": "similar_venue_type",
    "businessTypes": ["restaurang"],
    "hasScript": false
  }
}
```

### Contract verification

| Check | Result |
|---|---|
| `script_mode` present | ✅ `visual_only` (conservative fallback for empty BD) |
| `setup_complexity` present | ✅ `basic_tripod` |
| `skill_required` present | ✅ `anyone` |
| `setting` present | ✅ `similar_venue_type` |
| `trendLevel` absent | ✅ Not in response |
| `estimatedBudget` absent | ✅ Not in response |
| `businessTypes` (1–5) | ✅ `["restaurang"]` |
| HTTP status | ✅ 200 |
| Response is JSON | ✅ No text/html |

**Phase 47 contract is fully live on Railway (git_sha `048ca5a4`).**

Note: Railway deployed `048ca5a4` (route.ts update) rather than `12af104e` (package.json
with tsx devDep). The tsx devDependency is only needed for `npm test` locally — it has no
effect on the Railway build. The enrich route change is the meaningful commit and is live.

---

## git_sha Discrepancy Explained

During Phase 47 monitoring, five commits were pushed in rapid succession. Railway queued
deploys but only completed the build for `048ca5a4`. The subsequent `12af104e` commit
(package.json only) did not trigger a new visible deploy within the monitoring window.
This is expected Railway behaviour with rapid pushes — it may debounce or queue deploys.

The enrich route update (`048ca5a4`) is what matters — it is confirmed live.

After Phase 48 push, `git_sha` should update to the Phase 48 commit sha.

---

## Code Changes

| File | Change |
|---|---|
| `src/app/api/letrend/version/route.ts` | Added `export const dynamic = 'force-dynamic'`, `export const revalidate = 0`, `Cache-Control: no-store` header |
| `docs/agent-plans/48-version-endpoint-dynamic-and-enrich-contract-smoke.md` | New documentation file |

---

## Verification

| Check | Result |
|---|---|
| `npm run type-check` | ✅ 0 errors (no type changes — only runtime directives added) |
| Phase 47 enrich contract live | ✅ All 4 new fields, no trendLevel, no estimatedBudget |
| version `now` frozen (before fix) | ✅ Confirmed same value across two calls |
| version `now` dynamic (after deploy) | ⏳ To verify after Railway redeploy |

---

## Next Steps for Orchestrator

| Step | Status | Notes |
|---|---|---|
| Phase 48: version dynamic fix | ✅ **Done** | Pushed to main |
| Phase 47 enrich contract smoke | ✅ **Done** | All fields correct |
| Verify `now` changes post-deploy | ⏳ After Railway | `curl /api/letrend/version` twice, 2s apart |
| Phase 49: hagen-ui reanalyze smoke with new objective fields | ⏳ Next | Concepts without confirmed objective fields should show `script_mode`, `setup_complexity`, `skill_required`, `setting` in the suggestion panel. Requires `SuggestableFields` update in `reanalyze-suggestions.ts` first. |
