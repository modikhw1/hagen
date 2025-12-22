# Fingerprint Accuracy Test Framework

> **Purpose**: Define ground truth for test brands, then measure how closely the system matches expectations.

---

## Test Brands Registry

### Brand 1: Cassa Kitchen Catering (@cassa_kitchen_catering)

**Video URLs**:
```
https://www.tiktok.com/@cassa_kitchen_catering/video/7538935846481710349
https://www.tiktok.com/@cassa_kitchen_catering/video/7537813559582018871
https://www.tiktok.com/@cassa_kitchen_catering/video/7526654004638584095
https://www.tiktok.com/@cassa_kitchen_catering/video/7517044206066486559
https://www.tiktok.com/@cassa_kitchen_catering/video/7561934367984078111
https://www.tiktok.com/@cassa_kitchen_catering/video/7560783237551770894
https://www.tiktok.com/@cassa_kitchen_catering/video/7536676071320603934
https://www.tiktok.com/@cassa_kitchen_catering/video/7523673362565041422
https://www.tiktok.com/@cassa_kitchen_catering/video/7521456253541862686
https://www.tiktok.com/@cassa_kitchen_catering/video/7519211981794970911
https://www.tiktok.com/@cassa_kitchen_catering/video/7512574096618589486
https://www.tiktok.com/@cassa_kitchen_catering/video/7511086018200718623
```

**Ground Truth** (fill in after watching videos):

| Dimension | Expected Value | Confidence | Notes |
|-----------|---------------|------------|-------|
| business_type | | | |
| price_tier | | | |
| accessibility | | | |
| energy (1-10) | | | |
| warmth (1-10) | | | |
| formality (1-10) | | | |
| humor_present | | | |
| humor_types | | | |
| primary_intent | | | |
| production_investment (1-10) | | | |
| format_consistency | | | |
| overall_quality_tier | | | |

**Brand Essence** (2-3 sentences):
> 

---

### Brand 2: Kiele Kassidy (@kielekassidy)

**Video URLs**:
```
https://www.tiktok.com/@kielekassidy/video/7420234007113108779
https://www.tiktok.com/@kielekassidy/video/7528207541990378783
https://www.tiktok.com/@kielekassidy/video/7502225032957955371
https://www.tiktok.com/@kielekassidy/video/7533293284672769311
https://www.tiktok.com/@kielekassidy/video/7539270967978216735
https://www.tiktok.com/@kielekassidy/video/7263245062883085611
https://www.tiktok.com/@kielekassidy/video/7379420206117948714
```

**Ground Truth** (fill in after watching videos):

| Dimension | Expected Value | Confidence | Notes |
|-----------|---------------|------------|-------|
| business_type | | | |
| price_tier | | | |
| accessibility | | | |
| energy (1-10) | | | |
| warmth (1-10) | | | |
| formality (1-10) | | | |
| humor_present | | | |
| humor_types | | | |
| primary_intent | | | |
| production_investment (1-10) | | | |
| format_consistency | | | |
| overall_quality_tier | | | |

**Brand Essence** (2-3 sentences):
> 

---

### Brand 3: Steve's Poke Bar (@stevespokebar)

**Video URLs**:
```
https://www.tiktok.com/@stevespokebar/video/7573625628885486856
https://www.tiktok.com/@stevespokebar/video/7564445430445051154
https://www.tiktok.com/@stevespokebar/video/7563463942442388743
https://www.tiktok.com/@stevespokebar/video/7557953433295211784
https://www.tiktok.com/@stevespokebar/video/7551066253436128520
https://www.tiktok.com/@stevespokebar/video/7537899692592549126
https://www.tiktok.com/@stevespokebar/video/7203793686197554438
https://www.tiktok.com/@stevespokebar/video/7568941995247275282
https://www.tiktok.com/@stevespokebar/video/7570974220386192647
```

**Ground Truth** (fill in after watching videos):

| Dimension | Expected Value | Confidence | Notes |
|-----------|---------------|------------|-------|
| business_type | | | |
| price_tier | | | |
| accessibility | | | |
| energy (1-10) | | | |
| warmth (1-10) | | | |
| formality (1-10) | | | |
| humor_present | | | |
| humor_types | | | |
| primary_intent | | | |
| production_investment (1-10) | | | |
| format_consistency | | | |
| overall_quality_tier | | | |

**Brand Essence** (2-3 sentences):
> 

---

### Brand 4: Bram's Burgers (@bramsburgers)

**Video URLs**:
```
https://www.tiktok.com/@bramsburgers/video/7516199850724166934
https://www.tiktok.com/@bramsburgers/video/7568444318940220704
https://www.tiktok.com/@bramsburgers/video/7430065675558817057
https://www.tiktok.com/@bramsburgers/video/7573678474099952928
```

**Ground Truth** (fill in after watching videos):

| Dimension | Expected Value | Confidence | Notes |
|-----------|---------------|------------|-------|
| business_type | | | |
| price_tier | | | |
| accessibility | | | |
| energy (1-10) | | | |
| warmth (1-10) | | | |
| formality (1-10) | | | |
| humor_present | | | |
| humor_types | | | |
| primary_intent | | | |
| production_investment (1-10) | | | |
| format_consistency | | | |
| overall_quality_tier | | | |

**Brand Essence** (2-3 sentences):
> 

---

## Expected Similarity Matrix

Fill in expected similarity scores (0-100%):

|  | Cassa Kitchen | Kiele Kassidy | Steve's Poke | Bram's Burgers |
|--|---------------|---------------|--------------|----------------|
| **Cassa Kitchen** | 100% | | | |
| **Kiele Kassidy** | | 100% | | |
| **Steve's Poke** | | | 100% | |
| **Bram's Burgers** | | | | 100% |

**Explanation of relationships**:
- Cassa ↔ Kiele: 
- Cassa ↔ Steve's: 
- Cassa ↔ Bram's: 
- Kiele ↔ Steve's: 
- Kiele ↔ Bram's: 
- Steve's ↔ Bram's: 

---

## Accuracy Test Cases

### Test Type 1: Dimension Accuracy

For each brand, compare system output to ground truth:

```
Accuracy = 1 - |system_value - expected_value| / max_possible_difference
```

**Scoring rubric**:
- Categorical match (exact): 100%
- Categorical near-miss (adjacent tier): 50%
- Categorical wrong: 0%
- Numeric within 1 point: 90%
- Numeric within 2 points: 70%
- Numeric off by 3+: 50% penalty per point

### Test Type 2: Similarity Ranking

Given the 4 brands, does the system rank similarities correctly?

**Pass criteria**: 
- Correct ordering of most-similar to least-similar
- No "very different" brands rated above "somewhat similar"

### Test Type 3: Video Classification

Given a new video URL, can the system correctly identify which of the 4 brands it most resembles?

**Test videos** (add URLs of videos from accounts NOT in the test set):
```
# Video that should match Cassa Kitchen:


# Video that should match Kiele Kassidy:


# Video that should match Steve's Poke:


# Video that should match Bram's Burgers:


# Video that should match NONE (control):

```

### Test Type 4: Consistency

Run fingerprint computation 3 times for same brand. Results should be identical (deterministic) or within 5% variance (if stochastic elements exist).

---

## Accuracy Scoring

### Current Baseline (before optimization)

| Brand | Dimension Accuracy | Similarity Accuracy | Overall |
|-------|-------------------|---------------------|---------|
| Cassa Kitchen | —% | —% | —% |
| Kiele Kassidy | —% | —% | —% |
| Steve's Poke | —% | —% | —% |
| Bram's Burgers | —% | —% | —% |
| **AVERAGE** | **—%** | **—%** | **—%** |

### Target

| Metric | Current | Target |
|--------|---------|--------|
| Dimension Accuracy | ~50% | 90% |
| Similarity Ranking | unknown | 100% correct ordering |
| Video Classification | unknown | 85%+ correct |

---

## Error Analysis Template

When system gets something wrong, document:

| Brand | Dimension | Expected | System Output | Error Type | Root Cause Hypothesis |
|-------|-----------|----------|---------------|------------|----------------------|
| | | | | | |

**Error Types**:
- `AI_MISREAD`: Gemini incorrectly interpreted video
- `AGGREGATION_FLAW`: Individual videos correct but aggregation wrong
- `MISSING_SIGNAL`: System doesn't capture this dimension
- `WRONG_WEIGHT`: Signal captured but underweighted in output
- `EMBEDDING_CONFUSION`: Semantic similarity off
- `GROUND_TRUTH_AMBIGUOUS`: Annotator wasn't sure either

---

## Iteration Log

### Iteration 1: Baseline
- **Date**: 
- **Changes**: None (baseline measurement)
- **Results**: 

### Iteration 2: [TBD]
- **Date**: 
- **Changes**: 
- **Results**: 

---

*Framework created: December 13, 2025*
