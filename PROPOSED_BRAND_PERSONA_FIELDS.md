# Proposed Brand Persona Fields

> **Status**: PROPOSED - Not yet implemented  
> **Created**: December 3, 2025  
> **Purpose**: Capture brand voice positioning of standalone video content to enable filtering by business type suitability

---

## Context

Many videos found during research are produced by workers for their personal brands (service worker solidarity content) rather than as brand-appropriate marketing material. 

Businesses exist on a spectrum from solo creators to national chains, each with different:
- Risk tolerance
- Tone expectations  
- Production polish requirements
- Audience targeting

These fields would enable filtering: *"Show me concepts suitable for a `local-establishment` with `low` risk that feel `planned-authentic` and target `broad-family`"*

---

## 1. OPERATIONAL SCALE

**Field**: `brandPersona.operationalScale`  
**Type**: enum

| Value | Description |
|-------|-------------|
| `solo-creator` | Individual worker posting for personal brand, happens to be at work |
| `mom-and-pop` | Small family/owner-operated, authentic chaos, personal touch |
| `tight-crew` | Small team energy, inside jokes, "us vs customers" vibe |
| `local-establishment` | Professional but warm, community-focused, some polish |
| `regional-chain` | Balancing personality with consistency, some corporate guardrails |
| `national-brand` | High polish, safe humor, broad appeal, minimal risk |

---

## 2. VOICE OWNERSHIP

**Field**: `brandPersona.voiceOwnership`  
**Type**: enum

| Value | Description |
|-------|-------------|
| `employee-personal` | Worker's personal TikTok, restaurant is backdrop |
| `employee-representing` | Worker posting on behalf of business |
| `business-authentic` | Business account, feels like real people |
| `business-produced` | Business account, feels planned/marketed |
| `agency-produced` | Clearly external production, polished |

---

## 3. CONTENT INTIMACY LEVEL

**Field**: `brandPersona.intimacyLevel`  
**Type**: 1-10 scale

| Range | Description |
|-------|-------------|
| 1-3 | Corporate, universal, could be any business |
| 4-6 | Shows some workplace specifics, relatable but professional |
| 7-10 | Deep insider perspective, "you had to be there" energy, service worker solidarity |

---

## 4. RISK PROFILE

**Field**: `brandPersona.riskProfile`  
**Type**: object

| Sub-field | Type | Description |
|-----------|------|-------------|
| `customerAsButt` | boolean | Is customer mocked/frustrated with? |
| `managementCritique` | boolean | Jokes about bosses/corporate? |
| `workplaceComplaint` | boolean | Venting about job conditions? |
| `profanityLevel` | 0-3 | 0=none, 1=mild, 2=moderate, 3=explicit |
| `controversyPotential` | 1-10 | Could this backfire for a brand? |

---

## 5. AUDIENCE TARGET

**Field**: `brandPersona.audienceTarget`  
**Type**: enum

| Value | Description |
|-------|-------------|
| `service-workers` | Fellow industry people, solidarity content |
| `gen-z-customers` | Young consumers, trend-aware |
| `broad-family` | Safe for all ages, mass appeal |
| `local-community` | Regulars, neighborhood vibe |
| `foodies-niche` | Food enthusiasts, quality-focused |

---

## 6. PRODUCTION FEEL

**Field**: `brandPersona.productionFeel`  
**Type**: enum

| Value | Description |
|-------|-------------|
| `caught-on-shift` | Looks spontaneous, phone in pocket energy |
| `break-room-content` | Slightly more intentional but still raw |
| `planned-authentic` | Scripted but maintains casual feel |
| `produced-casual` | Professional but trying to feel organic |
| `produced-polished` | Clearly marketing, high production |

---

## 7. SUITABLE FOR (Brand Types)

**Field**: `brandPersona.suitableFor`  
**Type**: string[] (array of operationalScale values)

Which business types could actually USE this content style?

Examples:
- `["solo-creator", "mom-and-pop"]` - Only works for very small/personal brands
- `["mom-and-pop", "tight-crew", "local-establishment"]` - Small to medium businesses
- `["regional-chain", "national-brand"]` - Safe enough for larger brands
- `["any"]` - Universal concept

---

## 8. VOICE CONSISTENCY REQUIRED

**Field**: `brandPersona.voiceConsistency`  
**Type**: 1-10 scale

| Range | Description |
|-------|-------------|
| 1-3 | One-off, doesn't establish brand voice |
| 4-6 | Could be part of a series, some personality |
| 7-10 | Strong POV that would need to be maintained across content |

---

## Full Schema (JSON)

```json
{
  "brandPersona": {
    "operationalScale": "local-establishment",
    "voiceOwnership": "business-authentic",
    "intimacyLevel": 5,
    "riskProfile": {
      "customerAsButt": false,
      "managementCritique": false,
      "workplaceComplaint": false,
      "profanityLevel": 0,
      "controversyPotential": 2
    },
    "audienceTarget": "broad-family",
    "productionFeel": "planned-authentic",
    "suitableFor": ["mom-and-pop", "tight-crew", "local-establishment"],
    "voiceConsistency": 6
  }
}
```

---

## Implementation Notes

1. **Where to add**: Extend the Gemini analysis prompt in `/src/app/api/videos/reanalyze/route.ts`

2. **When to implement**: After validating that current deep analysis fields correlate with human ratings

3. **Alternative**: Could be a separate human annotation step rather than AI-inferred

4. **Use case**: Filter video library before rating to focus on brand-appropriate concepts

---

## Example Queries (Future)

```sql
-- Find concepts for a local restaurant
SELECT * FROM analyzed_videos 
WHERE visual_analysis->'brandPersona'->>'operationalScale' IN ('mom-and-pop', 'tight-crew', 'local-establishment')
  AND (visual_analysis->'brandPersona'->'riskProfile'->>'controversyPotential')::int <= 4
  AND visual_analysis->'brandPersona'->>'productionFeel' IN ('planned-authentic', 'break-room-content');

-- Find concepts safe for national chains
SELECT * FROM analyzed_videos
WHERE 'national-brand' = ANY(
  SELECT jsonb_array_elements_text(visual_analysis->'brandPersona'->'suitableFor')
);
```

---

*This document is for future reference. No changes have been made to the codebase.*
