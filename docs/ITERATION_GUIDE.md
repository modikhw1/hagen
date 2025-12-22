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

## Current State (Updated 2025-01-09)

### Prompt Location
`src/lib/services/video/deep-reasoning.ts` - DEEP_REASONING_CHAIN + SEED_DEEP_REASONING_EXAMPLES

### What's Been Added
- STEP 3: Format Participation - **POV misdirection pattern** (voice ≠ POV character thoughts)
- STEP 4.5: Visual Punchline Detection
- STEP 4.6: Tone & Delivery Analysis
- STEP 5.5: Wordplay & Misunderstanding
- STEP 6: Social Dynamics - **Sarcasm as response to obvious questions** pattern
- STEP 6.5: Cultural Context & Tropes
- STEP 7: Content Type & Intent (distinguishes Comedy/Wholesome/Relatable)
- STEP 8: Quality Assessment calibration
- **9 seed examples** covering all major gap patterns

### Benchmark Results (75 videos, with rich notes prioritized)
- **Baseline: 41% → Current: 65.4% (+24%)**
- 95%+ of videos showed improvement
- 19 videos (25%) scoring 70%+
- 7 videos (10%) scoring 75%+
- Uses embedding similarity to human notes (see limitations below)

### Identified Patterns That Needed Enhancement
1. **POV Misdirection**: Voice-over assumed to be POV character's thoughts, revealed to be someone else
2. **Sarcasm as Social Correction**: Exaggerated sarcastic responses to obviously-answered questions
3. **Self-Perception Gaps**: Character thinks THEY are normal while audience knows they're wrong
4. **Mean/Implied Humor**: Cruelty through what's NOT said (implication vs statement)

### Embedding Similarity Limitation
Embedding similarity penalizes semantically equivalent but differently-worded explanations.
- AI: "unexpected rejection" vs Human: "mean in an unnecessary way" = LOW similarity despite same meaning
- **Solution**: Created focused evaluation with specific questions (see docs/FOCUSED_EVALUATION.md)

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
- Social Dynamics Missed: 28 ✅ (enhanced with bill-paying, fold, sarcasm)
- Visual Reveal Not Captured: 21 ✅ (added)
- Wordplay/Misunderstanding: ✅ (NEW step added)
- Tone/Delivery: ✅ (NEW step added)
- Format Subversion Missed: 3 ✅ (examples added)

---

## Iteration Scripts

### 1. Generate Gap Analysis
```bash
node scripts/generate-question-battery.js --categorize --hypotheses
```
Outputs: `datasets/question_battery.md` with categorized gaps

### 2. Benchmark Prompt Changes
```bash
# Quick test (10 random videos with rich notes)
node scripts/reanalyze-with-deep-reasoning.js --rich --random

# Specific limit with rich notes
node scripts/reanalyze-with-deep-reasoning.js --rich --limit=20 --random

# Skip already processed videos
node scripts/reanalyze-with-deep-reasoning.js --rich --limit=10 --skip-processed --random

# Use gemini-2.5-pro (slower but potentially more nuanced)
node scripts/reanalyze-with-deep-reasoning.js --pro --limit=5

# All 143 videos (takes ~30 mins)
node scripts/reanalyze-with-deep-reasoning.js --all
```
Outputs: `datasets/deep_reasoning_comparison.json`

### 3. Focused Evaluation (10 Edge Cases)
See `docs/FOCUSED_EVALUATION.md` for manual evaluation with specific questions.
```bash
# Analyze specific video by ID
node scripts/check-video-context.js <video-id>
```

### 4. Compute Baseline Scores
```bash
node scripts/compute-understanding-scores.js
```

---

## Key Files
```
src/lib/services/video/deep-reasoning.ts    # THE PROMPT (edit this - changes are permanent)
scripts/reanalyze-with-deep-reasoning.js    # Benchmark script (--rich, --random, --pro, --limit, --skip-processed)
scripts/generate-question-battery.js        # Gap analysis
scripts/check-video-context.js              # Inspect single video
datasets/deep_reasoning_comparison.json     # Benchmark results (75 videos analyzed)
datasets/question_battery.md                # Gap categories
docs/FOCUSED_EVALUATION.md                  # 10 edge cases for manual evaluation
```

---

## Next Steps for Agent Continuation

### Current Status: 65.4% Average (Target: 85%)

### Completed ✅
1. ~~Expand the prompt~~ - Added comprehensive reasoning steps
2. ~~Add more reasoning steps~~ - Social Dynamics, Format Subversion, Wordplay, Tone all covered
3. ~~Consider few-shot examples~~ - Added 9 examples covering all major gap types
4. ~~Run on larger sample~~ - 75 videos benchmarked
5. ~~Identify remaining patterns~~ - POV misdirection, sarcasm, self-perception documented
6. ~~Create focused evaluation~~ - 10 edge cases with specific questions

### To Push Higher (65% → 85%)
1. **Use focused evaluation** - Run AI on 10 edge cases in `docs/FOCUSED_EVALUATION.md`, manually evaluate with Core/Nuance/Quality questions
2. **Add more seed examples** - For patterns that still fail focused evaluation, add examples to SEED_DEEP_REASONING_EXAMPLES in deep-reasoning.ts
3. **Try gemini-2.5-pro** - Use `--pro` flag; it's slower but may capture more nuance
4. **Multi-pass analysis** - First pass identifies content type, second analyzes based on type
5. **Improve quality calibration** - Many videos are "[MEDIOCRE]" or "relatable not funny" - AI needs better Comedy vs Relatable distinction

### The 65% → 85% Gap Is Likely:
- **Quality judgment** (is it actually funny or just relatable?)
- **Self-perception gaps** (audience knows something character doesn't)
- **Tone/delivery nuance** (the WAY something is said matters as much as what's said)

### Quick Start for New Agent
```bash
# 1. Read the focused evaluation
cat docs/FOCUSED_EVALUATION.md

# 2. Check current benchmark results
cat datasets/deep_reasoning_comparison.json | jq '.summary'

# 3. Run focused eval on case 1 (POV misdirection)
node scripts/check-video-context.js c43d3e95-b01a-4e29-af3f-dc542be870a4

# 4. If prompt changes needed, edit:
code src/lib/services/video/deep-reasoning.ts
```

---

## Notes Philosophy
Human notes = GUIDES toward deeper understanding, not ground truth format.
AI should give structured analysis that captures ESSENCE.
Notes point to what's important, AI should articulate it clearly.

---

## Quick Commands
```bash
# Edit the prompt (all changes here are PERMANENT)
code src/lib/services/video/deep-reasoning.ts

# Run benchmark (20 random rich-notes videos, skip already processed)
node scripts/reanalyze-with-deep-reasoning.js --rich --limit=20 --random --skip-processed

# Run with gemini-2.5-pro (slower, more nuanced)
node scripts/reanalyze-with-deep-reasoning.js --pro --limit=5

# Generate gap analysis
node scripts/generate-question-battery.js --categorize --hypotheses

# Check a specific video's context
node scripts/check-video-context.js <video-id>

# View benchmark summary
cat datasets/deep_reasoning_comparison.json | jq '.summary'

# View focused evaluation
cat docs/FOCUSED_EVALUATION.md
```

---

## Session History (for context)

### 2025-01-09 Session
- Started at 61% (10 samples), expanded to 75 videos
- Added POV misdirection pattern to STEP 3
- Added sarcasm-as-social-correction pattern to STEP 6
- Added 2 new seed examples (beauty discount, "do you work here")
- Created focused evaluation with 10 edge cases
- **Final: 65.4% average on 75 videos**

### Remaining Challenge
The embedding similarity approach has inherent limitations. The focused evaluation (docs/FOCUSED_EVALUATION.md) provides a more rigorous test of understanding through specific questions.
