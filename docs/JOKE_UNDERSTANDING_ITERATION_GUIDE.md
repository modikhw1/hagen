# Joke Understanding Iteration Guide

## 🎯 Goal
Iteratively improve Gemini's ability to capture joke structure and humor understanding through systematic prompt engineering and benchmarking.

**Target: 85%+ understanding** on focused evaluation questions.

---

## 📈 Current Status (Updated 2025-01-09)

| Metric | Baseline | Current | Target |
|--------|----------|---------|--------|
| Embedding Similarity | 41% | 65.4% | N/A |
| Focused Eval (manual) | - | TBD | 85%+ |
| Videos Benchmarked | 10 | 75 | 143 |

**Key Achievement:** +24% improvement through prompt engineering.

**Limitation Discovered:** Embedding similarity penalizes semantically-equivalent explanations. Use focused evaluation for better assessment.

**Next Focus:** See `docs/FOCUSED_EVALUATION.md` for 10 edge cases with specific questions.

---

## 📊 Current System Architecture

### Components
1. **Deep Reasoning Chain** (`src/lib/services/video/deep-reasoning.ts`)
   - Forces structured thinking before labeling
   - 8-step analysis: character dynamics → tension → format → editing → social dynamics → quality → mechanism

2. **RAG Learning System** (`src/lib/services/video/learning.ts`)
   - Retrieves similar human-corrected examples
   - Injects as few-shot learning into prompts
   - Tracks effectiveness with usage metrics

3. **LLM-as-Judge** (`src/lib/services/video/quality-judge.ts`)
   - Evaluates analysis quality vs. human baseline
   - 4 metrics: mechanism match, insight captured, error avoided, depth
   - Overall score (0-100)

4. **Primary Interface** (`/analyze-rate-v1`)
   - Analyze video → Compare to your notes → Save corrections
   - Corrections feed into RAG system for future improvement

---

## 🔄 Iteration Workflow

### Phase 1: Establish Baseline
**Goal:** Understand current performance

```bash
# 1. Compute understanding scores for all existing corrections
node scripts/compute-understanding-scores.js --stats

# 2. Run LLM-as-judge comparison on recent examples
node scripts/llm-judge-comparison.js --limit=20

# Expected outputs:
#   - datasets/understanding_scores.json
#   - datasets/llm_judge_comparison.json
```

**What to look for:**
- Average understanding score (baseline: ~65-75%)
- Common failure patterns (check low-scoring videos)
- Which humor types get misunderstood most

---

### Phase 2: Identify Gaps
**Goal:** Find specific patterns where AI struggles

1. **Review Low-Scoring Examples:**
   ```bash
   # Run with stats to see distribution
   node scripts/compute-understanding-scores.js --stats
   ```
   - Look at < 50% scores: these are major misunderstandings
   - Look at 50-65%: partially correct but missing key insights

2. **Analyze Failure Patterns:**
   - Open `datasets/understanding_scores.json`
   - Find common themes in low scores:
     - Missing visual punchlines?
     - Not recognizing mean/dark humor?
     - Confusing relatable with funny?
     - Missing format subversion?
     - Weak quality assessment?

3. **Check Your Corrections Database:**
   ```sql
   -- Run in Supabase SQL editor
   SELECT 
     video_summary,
     gemini_interpretation,
     correct_interpretation,
     humor_type_correction->'understanding_score' as score
   FROM video_analysis_examples
   WHERE (humor_type_correction->>'understanding_score')::int < 60
   ORDER BY created_at DESC
   LIMIT 10;
   ```

---

### Phase 3: Update Prompts
**Goal:** Add teaching examples and instructions for identified gaps

#### Option A: Add to Deep Reasoning Chain
Edit `src/lib/services/video/deep-reasoning.ts`:

```typescript
// Add new step or expand existing steps
export const DEEP_REASONING_CHAIN = `
...
│ STEP 6: SOCIAL DYNAMICS & CRUELTY
│ 
│ NEW TEACHING: [Your specific insight here]
│ Example: "If someone says 'you're not pretty enough', the joke IS the rejection.
│           Don't say 'subversion' - say 'mean humor: direct rejection delivered deadpan'"
│
└─────────────────────────────────────────────────────────────────────────────
`
```

#### Option B: Add Teaching Examples
Edit `src/lib/services/video/deep-reasoning.ts` → `SEED_DEEP_REASONING_EXAMPLES[]`:

```typescript
{
  video_summary: "[New example from your corrections]",
  original_analysis: "[What Gemini said - shallow]",
  deep_reasoning: {
    character_dynamic: "[Your insight]",
    underlying_tension: "[Your insight]",
    // ... fill in your understanding
  },
  correct_interpretation: "[Your full explanation]",
  key_teaching: "[What to learn from this]",
  tags: ['relevant', 'tags'],
  humor_types: ['joke_type']
}
```

#### Option C: Update Main Prompt
Edit `prompts/v4.0_humor_deep_reasoning.md`:
- Add anti-patterns you've observed
- Expand teaching examples
- Clarify confusing sections

---

### Phase 4: Test Changes
**Goal:** Measure if prompt changes improve understanding

```bash
# 1. Re-analyze existing examples with NEW prompt
node scripts/reanalyze-with-deep-reasoning.js --limit=20

# 2. Compare old vs new scores
cat datasets/deep_reasoning_comparison.json | jq '.summary'

# Expected output:
# {
#   "average_old_score": 67.3,
#   "average_new_score": 73.8,
#   "average_improvement": +6.5
# }
```

**Success Criteria:**
- ✅ Average improvement > +5%
- ✅ Low-scoring examples improve significantly
- ✅ High-scoring examples don't regress

**If Regression:**
- Your change was too specific or broke existing understanding
- Revert and try a more targeted change

---

### Phase 5: Validate with New Videos
**Goal:** Ensure improvements generalize

1. **Analyze 5-10 new videos** via `/analyze-rate-v1`
2. **Add your corrections** for any misunderstandings
3. **Check if AI made the same old mistakes** or learned

**Quick validation:**
```bash
# Run LLM judge on most recent examples
node scripts/llm-judge-comparison.js --limit=10

# Look for:
# - mechanism_match > 80% (good understanding)
# - key_insight_captured > 75% (captures your view)
# - error_avoided > 80% (learned from past mistakes)
```

---

### Phase 6: Deploy & Monitor
**Goal:** Track long-term improvement

1. **Commit prompt changes** with descriptive message:
   ```bash
   git add src/lib/services/video/deep-reasoning.ts
   git add prompts/v4.0_humor_deep_reasoning.md
   git commit -m "prompt: Improve recognition of [specific pattern]
   
   - Added teaching example for [gap]
   - Clarified [concept] in reasoning chain
   - Baseline: 67% → Target: 73%"
   ```

2. **Update RAG system** with new corrections:
   ```bash
   # Backfill recent Gemini analyses into learning system
   node scripts/backfill-learning-with-gemini-analysis.js
   ```

3. **Monitor effectiveness:**
   - Check `video_analysis_examples.times_used` for which examples get retrieved most
   - Run periodic benchmarks (weekly):
     ```bash
     node scripts/llm-judge-comparison.js --limit=50 > reports/week_$(date +%Y%m%d).txt
     ```

---

## 🎮 Quick Iteration Commands

### Daily Workflow
```bash
# 1. Analyze videos, add corrections via /analyze-rate-v1
# 2. Check if corrections improved understanding
node scripts/compute-understanding-scores.js

# 3. If you notice a pattern, update prompts
# 4. Test changes
node scripts/reanalyze-with-deep-reasoning.js --limit=10

# 5. If improvement > +3%, commit the change
```

### Weekly Review
```bash
# Full benchmark
node scripts/llm-judge-comparison.js --limit=50
node scripts/compute-understanding-scores.js --stats

# Analyze trends
cat datasets/llm_judge_comparison.json | jq '.statistics'
```

---

## 📈 Metrics to Track

### Primary Metrics (LLM-as-Judge)
- **Mechanism Match**: Does AI identify correct humor mechanism? (Target: > 85%)
- **Key Insight Captured**: Does AI capture YOUR main insight? (Target: > 80%)
- **Error Avoided**: Does AI avoid previous mistakes? (Target: > 85%)
- **Depth of Analysis**: How nuanced is the explanation? (Target: > 75%)

### Secondary Metrics
- **Understanding Score** (embedding similarity): 0-100 (Target: > 75%)
- **RAG Retrieval Effectiveness**: Are retrieved examples relevant?
- **Human Correction Rate**: % of analyses that need correction (Target: < 30%)

---

## 🎯 Common Improvement Patterns

### Pattern 1: AI Misses Visual Comedy
**Symptom:** Focuses on dialogue, ignores facial expressions/physical gags

**Fix:** Add to deep reasoning chain:
```
STEP 8.5: VISUAL PUNCHLINES
If humor comes from what you SEE (not what is said):
- Facial expression changes (deadpan → disgust)
- Physical comedy (exaggerated movements)
- Visual reveals (camera pans to show something unexpected)
→ Don't just transcribe what was said. Describe what was SHOWN.
```

### Pattern 2: AI Calls Everything "Subversion"
**Symptom:** Uses "subversion of expectations" as catch-all

**Fix:** Add anti-pattern in v4.0 prompt:
```
❌ WRONG: "Subversion of expectations"
✅ RIGHT: "Subversion of [SPECIFIC EXPECTATION]. 
          The setup leads us to expect [X], but instead [Y], which reveals [Z]"
```

### Pattern 3: AI Doesn't Recognize Mean Humor
**Symptom:** Misses when the joke IS the rejection/embarrassment

**Fix:** Expand Step 6 (Social Dynamics):
```
If someone is:
- Rejected: "you're not attractive" → The joke IS the cruelty
- Embarrassed: misunderstands and looks foolish → Name it specifically
- Put down: casual insult delivered deadpan → Mean humor, not "playful"
→ Don't soften it. The social dynamic IS the humor mechanism.
```

### Pattern 4: AI Confuses Relatable with Funny
**Symptom:** High scores for content that's just "oh yeah, I've been there"

**Fix:** Add to quality assessment step:
```
Ask: "Is there an actual JOKE here, or just a relatable observation?"
- Relatable: "Customer service is hard" (no humor)
- Joke: "Customer asks 'are you open?' while standing inside the open store" (absurdity)
→ Be willing to say: "This is relatable content, not comedy"
```

---

## 🔬 Question Battery System

For systematic gap identification and hypothesis testing:

### Generate the Question Battery

```bash
# Basic: Generate list of all gaps
node scripts/generate-question-battery.js

# Categorize gaps by type (cultural, visual, social, etc.)
node scripts/generate-question-battery.js --categorize

# Generate hypotheses for prompt improvement
node scripts/generate-question-battery.js --categorize --hypotheses

# Focus on low-scoring examples only
node scripts/generate-question-battery.js --low-only --categorize
```

**Output files:**
- `datasets/question_battery.json` - Structured data
- `datasets/question_battery.md` - Readable document with video links

### Gap Categories Identified

| Category | What it means |
|----------|---------------|
| `CULTURAL_CONTEXT` | AI missed cultural references, tropes, generational humor |
| `VISUAL_REVEAL` | Punchline was visual, AI focused on words |
| `SOCIAL_DYNAMICS` | Mean humor, embarrassment, rejection not named |
| `QUALITY_MISJUDGED` | AI said funny when human said weak/relatable |
| `MECHANISM_WRONG` | AI identified completely different type of humor |
| `SUBTLE_ELEMENTS` | Between-the-lines meaning, tone, delivery missed |
| `FORMAT_SUBVERSION` | Video structure/format was part of the joke |

### Test a Hypothesis

After identifying a gap category, test if a prompt change helps:

```bash
# Test prompt changes on SOCIAL_DYNAMICS gaps
node scripts/test-hypothesis.js --gap=SOCIAL_DYNAMICS

# Test on VISUAL_REVEAL gaps with verbose output
node scripts/test-hypothesis.js --gap=VISUAL_REVEAL --verbose

# Test with a custom prompt variant
node scripts/test-hypothesis.js --gap=SOCIAL_DYNAMICS --prompt=v4.1_social_dynamics.md

# Test specific videos by ID
node scripts/test-hypothesis.js --ids=abc123,def456
```

**Success criteria:**
- ✅ Average improvement > +5% → Hypothesis supported
- 🟡 Improvement 0-5% → Marginal, may need refinement
- ❌ Regression → Hypothesis rejected, revert changes

---

## 🔄 Complete Iteration Workflow

```
1. BASELINE
   node scripts/compute-understanding-scores.js --stats
   → Know your starting point (e.g., 57% average)

2. IDENTIFY GAPS
   node scripts/generate-question-battery.js --categorize --hypotheses
   → Creates question_battery.md with gap analysis

3. FORM HYPOTHESIS
   "Adding examples for SOCIAL_DYNAMICS gaps will improve those videos by 10%"

4. MODIFY PROMPT
   Edit src/lib/services/video/deep-reasoning.ts
   (or create a variant in prompts/)

5. TEST HYPOTHESIS
   node scripts/test-hypothesis.js --gap=SOCIAL_DYNAMICS --verbose
   → See if scores improve

6. IF SUCCESSFUL: VALIDATE
   node scripts/quick-iterate.js --count=20
   → Ensure no regression on other types

7. TRACK PROGRESS
   node scripts/track-progress.js
   → Create new benchmark snapshot
```

---

## 🔬 Advanced: A/B Testing Prompts

For major changes, test side-by-side:

```bash
# 1. Create prompt variant
cp prompts/v4.0_humor_deep_reasoning.md prompts/v4.1_experimental.md
# ... make your changes ...

# 2. Test on a specific gap
node scripts/test-hypothesis.js --prompt=v4.1_experimental.md --limit=15

# 3. Compare results
cat datasets/hypothesis_test_results.json | jq '.summary'
```

---

## 📚 Resources

- **Deep Reasoning Documentation**: `prompts/v4.0_humor_deep_reasoning.md`
- **Teaching Prompt**: `prompts/v3.5_humor_teaching.md`
- **Learning System**: `src/lib/services/video/learning.ts`
- **Quality Judge**: `src/lib/services/video/quality-judge.ts`

---

## 🎓 Philosophy

**The Goal:** Not to make AI "funny" but to make AI **understand what makes things funny**

- Focus on **mechanisms** not labels
- Focus on **dynamics** not actions
- Focus on **why** not what

**Success looks like:**
- AI explains jokes the way YOU would explain them
- AI catches nuances (mean humor, weak premises, visual punchlines)
- AI's analysis teaches YOU something about the joke

When AI can articulate WHY something is funny in a way that makes you say "yes, exactly that" - you've succeeded.

