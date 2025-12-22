# Joke Understanding Iteration Guide

## Goal
Find a Gemini prompt that captures **85-90% of important aspects** of premise/concept understanding. This is NOT about good/bad quality ratings - it's about **clarity and understanding of what makes the joke work**.

---

## Data Structure

### Source Tables
- `analyzed_videos.visual_analysis` - Original Gemini analysis (scenes, script, humor)
- `video_analysis_examples` - 143 videos with human correction notes

### Key Fields in video_analysis_examples
```
gemini_interpretation     # What AI originally said
correct_interpretation    # Human notes explaining the joke (THE GUIDE)
humor_type_correction     # Structured feedback: {why, correct, deep_reasoning}
```

### The 3 Humor Values (analyze-rate-v1)
These are what the notes comment on:
1. `humorType` - Category label
2. `humorMechanism` - How the joke works
3. `fullAnalysis` - Complete interpretation

---

## Current State

### Prompt Location
`src/lib/services/video/deep-reasoning.ts` - DEEP_REASONING_CHAIN

### What's Been Added
- STEP 4.5: Visual Punchline Detection
- STEP 6.5: Cultural Context & Tropes
- Enhanced STEP 7: Quality Assessment calibration

### Benchmark Results (10 samples)
- Baseline: 41.1% → New: 58.5% (+17.4%)
- 90% of videos improved
- Uses embedding similarity to human notes

---

## The Real Problem

The prompt may not be **wide enough** to SEE what the notes describe. If the prompt doesn't ask about something, it can't capture it. The iteration is:

1. Run analysis with current prompt
2. Compare output to human notes
3. Find what's MISSING (gap categories)
4. Expand prompt to ask about missing aspects
5. Repeat

---

## Gap Categories Identified
From `datasets/question_battery.md`:
- Cultural Context Missing: 57 occurrences ✅ (added)
- Quality Assessment Wrong: 31 ✅ (enhanced)
- Social Dynamics Missed: 28
- Visual Reveal Not Captured: 21 ✅ (added)
- Format Subversion Missed: 3

---

## Iteration Scripts

### 1. Generate Gap Analysis
```bash
node scripts/generate-question-battery.js --categorize --hypotheses
```
Outputs: `datasets/question_battery.md` with categorized gaps

### 2. Benchmark Prompt Changes
```bash
node scripts/reanalyze-with-deep-reasoning.js          # 10 samples
node scripts/reanalyze-with-deep-reasoning.js --all    # All 143
```
Outputs: `datasets/deep_reasoning_comparison.json`

### 3. Compute Baseline Scores
```bash
node scripts/compute-understanding-scores.js
```

---

## Key Files
```
src/lib/services/video/deep-reasoning.ts    # THE PROMPT (edit this)
scripts/reanalyze-with-deep-reasoning.js    # Benchmark script
scripts/generate-question-battery.js        # Gap analysis
datasets/deep_reasoning_comparison.json     # Results
datasets/question_battery.md                # Gap categories
```

---

## Next Steps

1. **Expand the prompt** - Gemini has 1M tokens. Current prompt is ~10K. Make it exhaustive.
2. **Add more reasoning steps** for remaining gaps (Social Dynamics, Format Subversion)
3. **Consider few-shot examples** - Include 2-3 corrected examples IN the prompt
4. **Redefine the output schema** - Current model may not capture real understanding

---

## Notes Philosophy
Human notes = GUIDES toward deeper understanding, not ground truth format.
AI should give structured analysis that captures ESSENCE.
Notes point to what's important, AI should articulate it clearly.

---

## Quick Commands
```bash
# Edit the prompt
code src/lib/services/video/deep-reasoning.ts

# Run quick benchmark (10 videos)
node scripts/reanalyze-with-deep-reasoning.js

# Generate gap analysis
node scripts/generate-question-battery.js --categorize --hypotheses

# Check a specific video's context
node scripts/check-video-context.js <video-id>
```
