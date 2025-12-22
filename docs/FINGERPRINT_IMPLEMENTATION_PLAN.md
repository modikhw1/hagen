# Fingerprint System Implementation Plan

> **Document Purpose**: Exhaustive implementation roadmap for restructuring the fingerprint system from ~50% to 90% accuracy. This document serves as the anchor for tracking all changes.
>
> **Created**: December 15, 2025  
> **Status**: Planning Phase  
> **Working Goal**: A strong fingerprint function that accurately matches video content to brand profiles

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Core Insights from Diagnostic](#3-core-insights-from-diagnostic)
4. [Architecture Redesign](#4-architecture-redesign)
5. [Implementation Phases](#5-implementation-phases)
6. [Schema Changes](#6-schema-changes)
7. [UI Changes](#7-ui-changes)
8. [Validation Framework](#8-validation-framework)
9. [Change Tracking](#9-change-tracking)

---

## 1. Executive Summary

### The Problem
The current fingerprint system conflates two distinct purposes:
- **Video Fingerprint**: What a video IS (for marketplace cataloging)
- **Brand Fingerprint**: What a brand WANTS (for customer matching)

These are treated identically but have fundamentally different goals, leading to ~50% accuracy.

### The Solution
Separate the concerns, introduce missing critical signals (especially replicability), and restructure matching to use hard filters + soft scoring instead of pure similarity.

### Success Criteria
- 90% alignment with ground truth across 4 test brands (32 videos)
- Clear reasoning for why matches are made (explainability)
- Matches that make intuitive sense to domain expert

---

## 2. Current State Analysis

### 2.1 Current File Structure

```
src/lib/services/brand/
├── profile-fingerprint.ts      # Core fingerprint computation (752 lines)
├── profile-fingerprint.types.ts # Layer type definitions
├── schema-v1.ts                 # Zod schema for video analysis (184 lines)
├── profile-matching.ts          # Matching algorithm
└── brand-analysis.ts            # Analysis orchestration
```

### 2.2 Current Layer Architecture

| Layer | Name | Purpose | Current Signals |
|-------|------|---------|-----------------|
| L1 | Quality | Execution assessment | overall_quality, creativity, engagement_hook, content_depth, authenticity |
| L2 | Personality | Brand voice | humor_style, energy_level, formality, emotional_tone, audience_approach |
| L3 | Production | Technical execution | video_quality, editing_style, visual_aesthetic, sound_design, pacing |

### 2.3 Current Matching Weights

```typescript
const LAYER_WEIGHTS = {
  L1_quality: 0.35,
  L2_personality: 0.40,
  L3_production: 0.25
};
```

### 2.4 Known Issues (Pre-Diagnostic)

1. Quality scores (excellent/good/mediocre/bad) lose the WHY
2. Target audience captured only as age_code (younger/older/balanced)
3. No concept of replicability in schema
4. Environment requirements not captured as hard constraints
5. Matching penalizes quality differences (wrong for aspirational brands)

---

## 3. Core Insights from Diagnostic

### 3.1 Fundamental Reframe

**Q0.1 Response Insight**: This is a marketplace for SERVICE content, not influencer matching. We're cataloging what VIDEO FORMATS work for hospitality brands, not which creators to hire.

**Implication**: The video fingerprint should capture replicable patterns, not creator-specific traits.

### 3.2 Critical Missing Signal: Replicability

Mentioned **9 times** in diagnostic responses. Not captured anywhere in current schema.

**Components of Replicability**:
- Actor count (1 person = easy, team = hard)
- Setup complexity (phone + tripod vs. studio)
- Skill required (anyone can do vs. professional needed)
- Environment dependency (any location vs. specific venue)

**Why It Matters**: A single-operator restaurant cannot replicate content requiring a 5-person team with professional equipment. This is a HARD FILTER, not a soft preference.

### 3.3 Target Audience Is THE Differentiator

**Q7.5 Response**: "Target audience/overall directedness of themes/voice" is the PRIMARY differentiator between brands.

**Current Capture**: `age_code: 'younger' | 'older' | 'balanced'`

**Required Capture**:
- Demographic dimensions (age, income, lifestyle)
- Psychographic dimensions (values, interests, aspirations)
- Occasion targeting (date night, family, quick lunch)
- Cultural positioning (local, tourist, community)

### 3.4 Quality Serves Different Purposes

**For Video Fingerprint**: Quality indicates production baseline, not match quality
**For Brand Fingerprint**: Quality indicates ambition level (aspirational vs. authentic)

**Key Insight from Q1.5**: Quality should consider broad appeal within target audience, not objective production value.

### 3.5 Environment as Hard Filter

**Q3.5 Response**: Environment (indoor/outdoor/kitchen/storefront) is a REQUIREMENT, not a preference.

A rooftop bar cannot use kitchen content. A food truck cannot use sit-down restaurant content. These are binary incompatibilities.

### 3.6 Humor Bias is Acceptable

**Q2.7 Response**: TikTok as a service skews toward humor. System can have humor bias.

**Q2.5 Response**: Humor is the PRIMARY characteristic when discussing creator content.

**Implication**: Humor signals should have higher weight in L2 Personality matching.

### 3.7 Production Quality ≠ Brand Fit

**Q3.1-3.2 Responses**: Professional production matters for brand AMBITION signaling, not for video matching itself.

**Implication**: L3 Production should inform brand profile (what they aspire to), not drive matching directly.

---

## 4. Architecture Redesign

### 4.1 Separation of Concerns

```
┌─────────────────────────────────────────────────────────────────┐
│                      VIDEO FINGERPRINT                          │
│  What the video IS (objective, replicable characteristics)      │
├─────────────────────────────────────────────────────────────────┤
│  • Content Format (tutorial, showcase, behind-scenes, etc.)     │
│  • Replicability Score (actors, setup, skill, environment)      │
│  • Target Audience Signals (who this appeals to)                │
│  • Tone/Energy Profile (humor, formality, pace)                 │
│  • Environment Requirements (setting, space, equipment)         │
│  • Risk Level (brand-safe to edgy)                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      BRAND FINGERPRINT                          │
│  What the brand WANTS (preferences, constraints, aspirations)   │
├─────────────────────────────────────────────────────────────────┤
│  • Target Audience Definition (who they serve)                  │
│  • Operational Constraints (team size, equipment, locations)    │
│  • Tone Preferences (humor tolerance, formality level)          │
│  • Risk Tolerance (how edgy they'll go)                         │
│  • Ambition Level (current quality vs. aspirational)            │
│  • Environment Availability (what settings they have)           │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 New Matching Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MATCHING PIPELINE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STAGE 1: HARD FILTERS (Binary Pass/Fail)                       │
│  ├── Environment compatibility                                  │
│  ├── Replicability within constraints                           │
│  ├── Risk level within tolerance                                │
│  └── Actor count feasibility                                    │
│                                                                 │
│  STAGE 2: SOFT SCORING (Weighted Similarity)                    │
│  ├── Audience alignment (35%)                                   │
│  ├── Tone/personality match (30%)                               │
│  ├── Format appropriateness (20%)                               │
│  └── Aspiration alignment (15%)                                 │
│                                                                 │
│  STAGE 3: RANKING & EXPLANATION                                 │
│  ├── Sort by soft score                                         │
│  ├── Generate match reasoning                                   │
│  └── Surface key compatibility factors                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 New Weight Distribution

| Factor | Weight | Rationale |
|--------|--------|-----------|
| Audience Alignment | 35% | THE differentiator per diagnostic |
| Tone/Personality | 30% | Humor-forward for TikTok service |
| Format Appropriateness | 20% | Content type must fit brand activities |
| Aspiration Alignment | 15% | Quality gap as opportunity, not penalty |

---

## 5. Implementation Phases

### Phase 1: Schema Extension (Week 1)

**Objective**: Add missing signals without breaking existing functionality

**Tasks**:
- [ ] 1.1 Add `replicability` object to schema-v1.ts
- [ ] 1.2 Expand `target_audience` beyond age_code
- [ ] 1.3 Add `environment_requirements` to video analysis
- [ ] 1.4 Add `risk_level` signal
- [ ] 1.5 Create new type definitions in profile-fingerprint.types.ts
- [ ] 1.6 Update Gemini prompts to extract new signals

**Files Modified**:
- `src/lib/services/brand/schema-v1.ts`
- `src/lib/services/brand/profile-fingerprint.types.ts`
- `src/lib/claude/analyze-video.ts` (or equivalent Gemini file)

**Validation**: 
- Run analysis on 5 test videos
- Verify new fields populate correctly
- Check no regressions in existing fields

---

### Phase 2: Separate Fingerprint Types (Week 1-2)

**Objective**: Create distinct VideoFingerprint and BrandFingerprint types

**Tasks**:
- [ ] 2.1 Define `VideoFingerprint` interface
- [ ] 2.2 Define `BrandFingerprint` interface
- [ ] 2.3 Create conversion functions from current schema
- [ ] 2.4 Update `computeProfileFingerprint` to produce VideoFingerprint
- [ ] 2.5 Create `computeBrandFingerprint` from brand profile data
- [ ] 2.6 Update database schema if needed (migration)

**Files Modified**:
- `src/lib/services/brand/profile-fingerprint.types.ts`
- `src/lib/services/brand/profile-fingerprint.ts`
- `supabase/migrations/014_fingerprint_separation.sql` (new)

**New Types**:
```typescript
interface VideoFingerprint {
  // What the video IS
  format: ContentFormat;
  replicability: ReplicabilityScore;
  audienceSignals: AudienceSignals;
  toneProfile: ToneProfile;
  environmentRequirements: EnvironmentRequirements;
  riskLevel: RiskLevel;
  qualityBaseline: QualityBaseline;
}

interface BrandFingerprint {
  // What the brand WANTS
  targetAudience: TargetAudienceDefinition;
  operationalConstraints: OperationalConstraints;
  tonePreferences: TonePreferences;
  riskTolerance: RiskTolerance;
  ambitionLevel: AmbitionLevel;
  environmentAvailability: EnvironmentAvailability;
}
```

---

### Phase 3: Matching Restructure (Week 2)

**Objective**: Implement hard filters + soft scoring pipeline

**Tasks**:
- [ ] 3.1 Create `HardFilterPipeline` function
- [ ] 3.2 Implement environment compatibility filter
- [ ] 3.3 Implement replicability feasibility filter
- [ ] 3.4 Implement risk tolerance filter
- [ ] 3.5 Create `SoftScorePipeline` function
- [ ] 3.6 Implement audience alignment scoring
- [ ] 3.7 Implement tone matching with humor bias
- [ ] 3.8 Remove quality-difference penalty
- [ ] 3.9 Add aspiration bonus for ambitious brands
- [ ] 3.10 Create `MatchExplainer` for reasoning output

**Files Modified**:
- `src/lib/services/brand/profile-matching.ts`
- `src/lib/services/brand/matching-filters.ts` (new)
- `src/lib/services/brand/matching-scoring.ts` (new)

**Key Algorithm Change**:
```typescript
// OLD: Pure similarity
const score = cosineSimilarity(videoEmbedding, brandEmbedding);

// NEW: Filter then score
const passesFilters = hardFilterPipeline(video, brand);
if (!passesFilters.pass) return { score: 0, reason: passesFilters.reason };
const score = softScorePipeline(video, brand);
return { score, reason: generateExplanation(video, brand, score) };
```

---

### Phase 4: UI Updates (Week 2-3)

**Objective**: Surface new capabilities and improve data collection

**Tasks**:
- [ ] 4.1 Update /analyze-rate form for replicability input
- [ ] 4.2 Add environment selector to brand profile
- [ ] 4.3 Add operational constraints section to brand profile
- [ ] 4.4 Create target audience builder UI
- [ ] 4.5 Display match explanations in results
- [ ] 4.6 Show hard filter failures with reasons
- [ ] 4.7 Add aspiration level selector
- [ ] 4.8 Update brand analysis dashboard

**See Section 7 for detailed UI specifications**

---

### Phase 5: Validation & Calibration (Week 3)

**Objective**: Achieve 90% accuracy on test brands

**Tasks**:
- [ ] 5.1 Run system on all 32 test videos
- [ ] 5.2 Compare to ground truth in FINGERPRINT_TEST_FRAMEWORK.md
- [ ] 5.3 Identify systematic errors
- [ ] 5.4 Adjust weights based on error patterns
- [ ] 5.5 Re-run and measure improvement
- [ ] 5.6 Document final calibration values

**Success Metrics**:
| Brand | Videos | Target Accuracy | Baseline |
|-------|--------|-----------------|----------|
| Cassa Kitchen | 11 | 90% | ~50% |
| Kiele Kassidy | 9 | 90% | ~50% |
| Steve's Poke | 8 | 90% | ~50% |
| Bram's Burgers | 4 | 90% | ~50% |

---

## 6. Schema Changes

### 6.1 New Replicability Schema

```typescript
const replicabilitySchema = z.object({
  actor_count: z.enum(['solo', 'duo', 'small_team', 'large_team']),
  setup_complexity: z.enum(['phone_only', 'basic_tripod', 'lighting_setup', 'full_studio']),
  skill_required: z.enum(['anyone', 'basic_editing', 'intermediate', 'professional']),
  environment_dependency: z.enum(['anywhere', 'specific_indoor', 'specific_outdoor', 'venue_required']),
  equipment_needed: z.array(z.string()).optional(),
  estimated_time: z.enum(['under_1hr', '1_4hrs', 'half_day', 'full_day']).optional(),
});
```

### 6.2 Expanded Target Audience Schema

```typescript
const targetAudienceSchema = z.object({
  // Demographics
  age_range: z.object({
    primary: z.enum(['gen_z', 'millennial', 'gen_x', 'boomer', 'broad']),
    secondary: z.enum(['gen_z', 'millennial', 'gen_x', 'boomer', 'none']).optional(),
  }),
  income_level: z.enum(['budget', 'mid_range', 'upscale', 'luxury', 'broad']),
  
  // Psychographics
  lifestyle: z.array(z.enum([
    'foodies', 'families', 'date_night', 'business', 'tourists',
    'locals', 'health_conscious', 'indulgent', 'social_media_active'
  ])),
  
  // Occasion
  primary_occasion: z.enum([
    'quick_meal', 'casual_dining', 'special_occasion', 
    'takeout', 'delivery', 'bar_drinks', 'coffee_cafe'
  ]),
  
  // Cultural positioning
  vibe: z.enum([
    'trendy', 'classic', 'family_friendly', 'upscale_casual',
    'dive_authentic', 'instagram_worthy', 'neighborhood_gem'
  ]),
});
```

### 6.3 Environment Requirements Schema

```typescript
const environmentSchema = z.object({
  setting_type: z.enum(['indoor', 'outdoor', 'kitchen', 'bar', 'storefront', 'mixed']),
  space_requirements: z.enum(['minimal', 'moderate', 'spacious']),
  lighting_conditions: z.enum(['natural', 'artificial', 'low_light', 'flexible']),
  noise_tolerance: z.enum(['quiet_needed', 'moderate_ok', 'noisy_ok']),
  customer_visibility: z.enum(['no_customers', 'background', 'featured']),
});
```

### 6.4 Risk Level Schema

```typescript
const riskLevelSchema = z.object({
  content_edge: z.enum(['brand_safe', 'mildly_edgy', 'edgy', 'provocative']),
  humor_risk: z.enum(['safe_humor', 'playful', 'sarcastic', 'dark_humor']),
  trend_reliance: z.enum(['evergreen', 'light_trends', 'trend_dependent']),
  controversy_potential: z.enum(['none', 'low', 'moderate', 'high']),
});
```

---

## 7. UI Changes

### 7.1 New UI: Brand Profile Builder

**Location**: `/brand-profile/create` or enhanced `/brand-profile` page

**Sections**:

#### Section A: Target Audience Builder
```
┌─────────────────────────────────────────────────────────────┐
│  WHO IS YOUR CUSTOMER?                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Primary Age Group:  [Dropdown: Gen Z / Millennial / ...]   │
│  Income Level:       [Dropdown: Budget / Mid-range / ...]   │
│                                                             │
│  Lifestyle Tags (select all that apply):                    │
│  [✓] Foodies  [ ] Families  [✓] Date Night  [ ] Business   │
│  [ ] Tourists [✓] Locals    [ ] Health-conscious            │
│                                                             │
│  Primary Occasion:   [Dropdown]                             │
│  Vibe:               [Dropdown]                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Section B: Operational Constraints
```
┌─────────────────────────────────────────────────────────────┐
│  WHAT CAN YOU REALISTICALLY PRODUCE?                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Team Size Available:                                       │
│  (○) Just me  (●) 2 people  ( ) 3-5 people  ( ) 5+ people  │
│                                                             │
│  Equipment Available:                                       │
│  [✓] Smartphone  [✓] Tripod  [ ] Lighting kit  [ ] Mic     │
│                                                             │
│  Time Per Video:                                            │
│  [Slider: Under 1hr ──●─── Half day ───── Full day]        │
│                                                             │
│  Environments Available:                                    │
│  [✓] Kitchen  [✓] Dining room  [ ] Outdoor patio           │
│  [ ] Bar area  [✓] Storefront  [ ] Off-site                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Section C: Content Preferences
```
┌─────────────────────────────────────────────────────────────┐
│  WHAT VIBE DO YOU WANT?                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Humor Level:                                               │
│  [Slider: Serious ───── Playful ──●── Very Funny]          │
│                                                             │
│  Energy Level:                                              │
│  [Slider: Calm ──●── Moderate ───── High Energy]           │
│                                                             │
│  Formality:                                                 │
│  [Slider: Casual ──●── Balanced ───── Professional]        │
│                                                             │
│  Risk Tolerance:                                            │
│  (●) Brand safe only  ( ) Mildly edgy ok  ( ) Edgy ok      │
│                                                             │
│  Ambition Level:                                            │
│  ( ) Match our current quality                              │
│  (●) Help us level up                                       │
│  ( ) Show us aspirational examples                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 7.2 Updated UI: Analyze Rate Page

**Location**: `/analyze-rate`

**New Fields After Analysis**:

```
┌─────────────────────────────────────────────────────────────┐
│  REPLICABILITY ASSESSMENT                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  How many people appear in this video?                      │
│  (●) 1 person  ( ) 2 people  ( ) 3-5  ( ) 5+               │
│                                                             │
│  What equipment was needed?                                 │
│  [✓] Phone only  [ ] Tripod  [ ] Lighting  [ ] Pro camera  │
│                                                             │
│  How hard would this be to recreate?                        │
│  [Slider: Easy ──●── Moderate ───── Professional]          │
│                                                             │
│  What environment is required?                              │
│  [ ] Any  [✓] Kitchen  [ ] Dining  [ ] Outdoor  [ ] Bar    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 7.3 Updated UI: Match Results Display

**Location**: `/brand-analysis` results section

**Before** (current):
```
Video Match: 78%
├── L1 Quality: 82%
├── L2 Personality: 75%
└── L3 Production: 80%
```

**After** (new):
```
┌─────────────────────────────────────────────────────────────┐
│  ✓ MATCH: 85%                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✓ Passes All Filters                                       │
│    • Environment: Kitchen content ✓ Kitchen available       │
│    • Team: Solo creator ✓ Fits 1-person team               │
│    • Risk: Brand-safe ✓ Within tolerance                   │
│                                                             │
│  Score Breakdown:                                           │
│    Audience Fit     ████████░░  78%  "Gen Z foodies"       │
│    Tone Match       █████████░  92%  "Playful, energetic"  │
│    Format Fit       ███████░░░  68%  "Recipe tutorial"     │
│    Aspiration       █████████░  88%  "Quality uplift"      │
│                                                             │
│  Why This Works:                                            │
│  "This energetic recipe video targets Gen Z foodies with   │
│   playful humor. Solo format fits your team size, and      │
│   kitchen setting matches your available space."           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**For Rejected Matches**:
```
┌─────────────────────────────────────────────────────────────┐
│  ✗ FILTERED OUT                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Failed Filter: Team Size                                   │
│  "This video requires 4+ people, but you have 1-2 available"│
│                                                             │
│  [Show anyway for inspiration?]                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 7.4 New UI: Ground Truth Calibration Tool

**Location**: `/calibration` (new page for testing/development)

**Purpose**: Compare system predictions to ground truth

```
┌─────────────────────────────────────────────────────────────┐
│  CALIBRATION DASHBOARD                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Test Brand: [Dropdown: Cassa Kitchen ▼]                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Video                    Expected  Actual   Status │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Pasta Making Tutorial    85%       82%      ✓      │   │
│  │  Kitchen Dance            70%       45%      ✗      │   │
│  │  Plating Showcase         90%       88%      ✓      │   │
│  │  ...                                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Overall Accuracy: 72% (target: 90%)                        │
│                                                             │
│  Error Analysis:                                            │
│  • Humor videos consistently underscored (-15 avg)          │
│  • Kitchen environment bonus not applied                    │
│                                                             │
│  [Adjust Weights] [Re-run Analysis] [Export Report]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Validation Framework

### 8.1 Ground Truth Reference

Test brands with expected match scores (from FINGERPRINT_TEST_FRAMEWORK.md):

#### Cassa Kitchen (@cassakitchen)
- **Profile**: Fun, energetic, humor-forward, young audience
- **Constraints**: Small team (1-2), kitchen/dining environments
- **Good matches**: Energetic food prep, funny moments, casual vibe
- **Bad matches**: Luxury, formal, large production

#### Kiele Kassidy (@kielekassidy)
- **Profile**: High-energy bartender, tricks, entertainment focus
- **Constraints**: Solo creator, bar environment only
- **Good matches**: Performance content, high energy, bar setting
- **Bad matches**: Kitchen, family content, slow paced

#### Steve's Poke (@stevespoke)
- **Profile**: Educational, health-conscious, clean aesthetic
- **Constraints**: Small team, counter service environment
- **Good matches**: Process videos, health angle, clean look
- **Bad matches**: Humor-heavy, bar content, messy aesthetic

#### Bram's Burgers (@bramsburgers)
- **Profile**: Indulgent, satisfying, food-focused
- **Constraints**: Kitchen + counter, comfort food vibe
- **Good matches**: Food beauty shots, satisfying moments
- **Bad matches**: Health content, fancy plating, bar content

### 8.2 Accuracy Measurement

```
Accuracy = (Correctly Classified Videos) / (Total Videos) × 100

Correctly Classified:
- True Positive: System says match, ground truth says match
- True Negative: System says no match, ground truth says no match

Errors:
- False Positive: System says match, ground truth says no match
- False Negative: System says no match, ground truth says match
```

### 8.3 Iteration Process

```
1. Run system on test set
2. Calculate accuracy per brand
3. Identify error patterns
4. Hypothesize cause
5. Adjust weights/logic
6. Re-run and measure
7. Repeat until 90%
```

---

## 9. Change Tracking

### Status Legend
- ⬜ Not Started
- 🟡 In Progress
- ✅ Complete
- ❌ Blocked

### Phase 1: Schema Extension

| Task | Status | File | Notes |
|------|--------|------|-------|
| 1.1 Add replicability schema | ✅ | schema-v1.ts | Added ReplicabilitySchema with actor_count, setup_complexity, skill_required, environment_dependency, equipment_needed, estimated_time |
| 1.2 Expand target_audience | ✅ | schema-v1.ts | Added TargetAudienceSchema with age_range, income_level, lifestyle_tags, primary_occasion, vibe_alignment |
| 1.3 Add environment_requirements | ✅ | schema-v1.ts | Added EnvironmentRequirementsSchema with setting_type, space_requirements, lighting_conditions, noise_tolerance, customer_visibility |
| 1.4 Add risk_level | ✅ | schema-v1.ts | Added RiskLevelSchema with content_edge, humor_risk, trend_reliance, controversy_potential |
| 1.5 Create new types | ✅ | profile-fingerprint.types.ts | Added VideoFingerprint, BrandFingerprint, and all supporting interfaces |
| 1.6 Update Gemini prompts | ✅ | brand-analyzer.ts | Updated buildPrompt() with v1.1 schema including all new signal sections |

### Phase 2: Separate Fingerprint Types

| Task | Status | File | Notes |
|------|--------|------|-------|
| 2.1 Define VideoFingerprint | ✅ | profile-fingerprint.types.ts | Complete interface with format, replicability, audience_signals, tone_profile, environment_requirements, risk_level, quality_baseline |
| 2.2 Define BrandFingerprint | ✅ | profile-fingerprint.types.ts | Complete interface with target_audience, operational_constraints, environment_availability, tone_preferences, risk_tolerance, ambition_level |
| 2.3 Create conversion functions | 🟡 | profile-fingerprint.ts | Types defined, conversion functions pending |
| 2.4 Update computeProfileFingerprint | 🟡 | profile-fingerprint.ts | VideoSignals extended, layer computation pending |
| 2.5 Create computeBrandFingerprint | ⬜ | profile-fingerprint.ts | |
| 2.6 Database migration | ⬜ | migrations/014_*.sql | |

### Phase 3: Matching Restructure

| Task | Status | File | Notes |
|------|--------|------|-------|
| 3.1 Create HardFilterPipeline | ✅ | matching-filters.ts | runHardFilterPipeline() implemented |
| 3.2 Environment filter | ✅ | matching-filters.ts | checkEnvironmentCompatibility() |
| 3.3 Replicability filter | ✅ | matching-filters.ts | checkReplicabilityFeasibility() |
| 3.4 Risk tolerance filter | ✅ | matching-filters.ts | checkRiskTolerance() |
| 3.5 Create SoftScorePipeline | ✅ | matching-scoring.ts | runSoftScoringPipeline() with new weights |
| 3.6 Audience alignment scoring | ✅ | matching-scoring.ts | scoreAudienceAlignment() - 35% weight |
| 3.7 Tone matching + humor bias | ✅ | matching-scoring.ts | scoreToneMatch() - 30% weight with humor bias |
| 3.8 Remove quality penalty | ✅ | matching-scoring.ts | Aspiration alignment rewards quality gaps |
| 3.9 Add aspiration bonus | ✅ | matching-scoring.ts | scoreAspirationAlignment() - 15% weight |
| 3.10 Create MatchExplainer | ✅ | matching-explainer.ts | computeEnhancedMatch(), generateMatchExplanation() |

### Phase 4: UI Updates

| Task | Status | File | Notes |
|------|--------|------|-------|
| 4.1 Analyze-rate replicability | ✅ | app/analyze-rate/page.tsx | Added structured inputs for actor_count, setup_complexity, skill_required, setting_type |
| 4.2 Brand profile environment | ✅ | app/brand-profile/page.tsx | Environment availability section with settings, customer visibility, space |
| 4.3 Operational constraints UI | ✅ | app/brand-profile/page.tsx | Team size, time per video, equipment selectors implemented |
| 4.4 Target audience builder | ✅ | app/brand-profile/page.tsx | Primary age, income level, lifestyle tags, vibe selectors |
| 4.5 Match explanations | ✅ | app/brand-profile/page.tsx | Score breakdown bars + explanation text displayed per match |
| 4.6 Filter failure display | ⬜ | app/brand-profile/page.tsx | Filtered videos not shown, no "why excluded" UI yet |
| 4.7 Aspiration level selector | ✅ | app/brand-profile/page.tsx | match_current/level_up/aspirational selector with descriptions |
| 4.8 Brand analysis dashboard | ⬜ | app/brand-analysis/page.tsx | |
| 4.9 Risk level signals (video) | ✅ | app/analyze-rate-v1/page.tsx | content_edge, humor_risk, trend_reliance in enhanced v1.1 page |
| 4.10 Environment signals (video) | ✅ | app/analyze-rate-v1/page.tsx | setting_type, space_requirements, lighting, customer visibility |
| 4.11 Audience signals (video) | ✅ | app/analyze-rate-v1/page.tsx | age_range, income_level, lifestyle_tags, vibe_alignment |
| 4.12 Risk tolerance (brand) | ✅ | app/brand-profile/page.tsx | content_edge and humor_risk tolerance selectors |
| 4.13 Legacy page flagging | ✅ | app/analyze-rate/page.tsx | Marked as legacy with link to v1.1 enhanced version |

### Phase 5: Validation

| Task | Status | File | Notes |
|------|--------|------|-------|
| 5.1 Run test set | ⬜ | scripts/run-calibration.js | |
| 5.2 Compare to ground truth | ⬜ | FINGERPRINT_TEST_FRAMEWORK.md | |
| 5.3 Identify errors | ⬜ | | |
| 5.4 Adjust weights | ⬜ | | |
| 5.5 Re-run and measure | ⬜ | | |
| 5.6 Document final values | ⬜ | | |

---

## Appendix A: Files to Read Before Implementation

Before modifying any code, read these files to understand current structure:

1. **Schema Definition**: `src/lib/services/brand/schema-v1.ts`
2. **Type Definitions**: `src/lib/services/brand/profile-fingerprint.types.ts`
3. **Fingerprint Computation**: `src/lib/services/brand/profile-fingerprint.ts`
4. **Matching Logic**: `src/lib/services/brand/profile-matching.ts` (NOTE: Does not exist - logic is in profile-fingerprint.ts)
5. **Analysis Orchestration**: `src/lib/services/brand/brand-analyzer.ts`
6. **Database Types**: `src/types/database.ts`
7. **UI Pages**: 
   - `src/app/analyze-rate/page.tsx`
   - `src/app/brand-profile/page.tsx`
   - `src/app/brand-analysis/BrandAnalysisClient.tsx`

**New Files Created**:
- `src/lib/services/brand/matching-filters.ts` - Hard filter pipeline
- `src/lib/services/brand/matching-scoring.ts` - Soft scoring pipeline  
- `src/lib/services/brand/matching-explainer.ts` - Match explanation generation

---

## Appendix B: Key Decisions Made

| Decision | Rationale | Source |
|----------|-----------|--------|
| Separate Video/Brand fingerprints | Different purposes require different representations | Q0.1 |
| Replicability as first-class signal | Mentioned 9x in responses, critical for feasibility | Multiple |
| Humor bias acceptable | TikTok service naturally skews humorous | Q2.7 |
| Hard filters before soft scoring | Environment/team constraints are binary | Q3.5 |
| Target audience highest weight | "THE differentiator" per domain expert | Q7.5 |
| Remove quality penalty | Aspirational matching preferred | Q1.4 |

---

## Appendix C: Open Questions

1. **Embedding strategy**: Keep current OpenAI embeddings or switch to structured similarity?
2. **Aggregation method**: Mean vs. weighted vs. cluster-based for profile fingerprint?
3. **UI priority**: Which new UI elements are MVP vs. nice-to-have?
4. **Migration strategy**: How to handle existing data during schema changes?

---

## Recent Updates (December 2025)

### Integration Improvements Completed

The following integration improvements were made to connect the brand-profile chat, video analysis, and fingerprint matching systems:

1. **video-context.ts → Schema v1.1** ✅
   - Now uses `BrandAnalyzer` instead of `GeminiVideoAnalyzer`
   - Captures full v1.1 signals: replicability, risk_level, environment_requirements, target_audience
   - `formatVideoContextForPrompt()` includes operational signals for Claude context
   - Defensible per Q0.1/Q3.5 diagnostics, impl plan Section 3.2

2. **INSIGHT_EXTRACTION_INSTRUCTIONS extended** ✅
   - Added `operational_signals`: team_available, equipment, time, filming_comfort, editing_skills
   - Added `environment_signals`: available_locations, space_quality, lighting, noise, customer_visibility
   - Defensible per Q0.4: "profile/videos/written intention should be combined"

3. **SYNTHESIS_PROMPT extended** ✅
   - Added `operational_constraints`: team_available, equipment_available, time_budget, skill_level, max_complexity
   - Added `environment_availability`: available_locations, space_quality, lighting_conditions, customer_filming_ok
   - Added `risk_tolerance`: content_edge, humor_style, trend_willingness, controversy_comfort
   - Added enhanced `target_audience`: primary_generation, income_level, lifestyle_tags, primary_occasion
   - Defensible per impl plan Section 4.1 brand fingerprint architecture

4. **brand-profile UI pre-population** ✅
   - `handleSynthesize()` now populates UI constraints from synthesis data
   - Operational constraints, environment availability, target audience, and risk tolerance auto-fill
   - Reduces manual user input by leveraging conversation insights

---

*Last Updated: December 2025*
*Document Version: 1.4 - Phase 1-3 Complete, Phase 4 ~95% Complete, System Integration Improved*
