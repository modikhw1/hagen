# Quick Start: Iterating on Joke Understanding

## 🎯 Your Workflow

You want to improve Gemini's joke understanding through iterative prompt engineering. Here's your streamlined process:

---

## Day 1: Establish Your Baseline

### Step 1: Check Current Performance
```bash
# See how well AI currently understands your corrections
node scripts/compute-understanding-scores.js --stats
```

**What you'll see:**
```
Average understanding: 67.3%
Distribution:
  < 50%: 3 (poor)
  50-65%: 8 (below average)
  65-75%: 6 (average)
  75-85%: 2 (good)
  > 85%: 1 (excellent)
```

**Your baseline:** ~67% understanding

### Step 2: Create First Progress Snapshot
```bash
# This will benchmark on 20 examples and save results
node scripts/track-progress.js
```

This creates a snapshot you can compare against later.

---

## Day 2-7: Analyze Videos & Identify Patterns

### Daily Loop

1. **Analyze 3-5 videos** via `/analyze-rate-v1`
2. **Add your corrections** when AI gets it wrong
3. **Look for patterns** in what AI misses

### What to Look For

**Pattern Recognition:**
- ✗ Does AI keep missing visual comedy?
- ✗ Does AI call everything "subversion" without explaining what was subverted?
- ✗ Does AI miss mean/dark humor (doesn't name the cruelty)?
- ✗ Does AI miss when the joke IS just a relatable observation (not actually funny)?
- ✗ Does AI miss format subversion (person breaks the expected pattern)?

**Example:**

Video: "Beauty discount? Sorry, you don't qualify"
- ❌ AI says: "Subversion of expectations"
- ✅ You say: "Mean humor - the joke IS the rejection. She asks for a beauty discount and is told she's not attractive. That's the entire joke. It's casual cruelty delivered deadpan."

**Action:** Save this as a correction in analyze-rate-v1

---

## Week 2: Make Your First Prompt Improvement

### Step 1: Identify Top Pattern

Look at your corrections. What's the #1 thing AI consistently gets wrong?

Let's say: **"AI doesn't recognize mean humor - it calls rejection/embarrassment 'subversion' instead of naming the social dynamic"**

### Step 2: Update the Prompt

Open `src/lib/services/video/deep-reasoning.ts`

Find **STEP 6: SOCIAL DYNAMICS & CRUELTY** and enhance it:

```typescript
│ STEP 6: SOCIAL DYNAMICS & CRUELTY
│ 
│ Ask: "Is someone being embarrassed, rejected, or put down? Is that the joke?"
│
│ NEW TEACHING:
│ If the humor comes from someone being rejected or humiliated, NAME IT:
│   
│   ❌ WRONG: "Subversion - she doesn't get the discount"
│   ✅ RIGHT: "Mean humor - she's told she's not attractive enough for a 'beauty discount'.
│              The joke IS the rejection. It's casual cruelty delivered deadpan."
│
│   ❌ WRONG: "Contrast between expectation and reality"
│   ✅ RIGHT: "Embarrassment comedy - he misunderstands 'shake' (handshake) as 'dance',
│              looks foolish, realizes mistake. The humor is his embarrassment."
│
│ Don't soften it. Don't intellectualize it. If someone's being put down, SAY SO.
│
└─────────────────────────────────────────────────────────────────────────────
```

### Step 3: Test the Change

```bash
# Test on 5 recent corrections that had this pattern
node scripts/quick-iterate.js --count=5
```

**What you'll see:**
```
[1/5] Beauty discount rejection...
  🤖 Analyzing with current prompt...
  ⚖️  Evaluating with LLM-as-Judge...
  GOOD (78%)
  ✓ Got right: AI now identifies this as mean humor and names the rejection
  ✗ Missed: Could be more specific about deadpan delivery
  → Significant improvement over "subversion" label

Average Score: 76.4%
```

**Decision:**
- If average improved by +3% or more → Good! Continue to Step 4
- If no improvement or regression → Revert your change, try different approach

### Step 4: Full Benchmark

If quick test showed improvement, run full benchmark:

```bash
# Test on 30 examples
node scripts/reanalyze-with-deep-reasoning.js --limit=30

# Check results
cat datasets/deep_reasoning_comparison.json | jq '.summary'
```

**Success looks like:**
```json
{
  "average_old_score": 67.3,
  "average_new_score": 73.8,
  "average_improvement": +6.5,
  "improved_count": 22
}
```

### Step 5: Create New Snapshot

```bash
# Save this as a new progress point
node scripts/track-progress.js
```

### Step 6: Commit Your Improvement

```bash
git add src/lib/services/video/deep-reasoning.ts
git commit -m "prompt: Improve recognition of mean humor and social dynamics

- Enhanced Step 6 (Social Dynamics) with specific teaching examples
- Added anti-patterns: don't say 'subversion' when joke is rejection/embarrassment
- Baseline: 67.3% → New: 73.8% (+6.5% improvement)
- Tested on 30 examples, 22 showed improvement"
```

---

## Week 3+: Continue Iterating

### Weekly Cycle

**Monday: Analyze & Collect**
- Analyze 5-10 videos
- Add corrections
- Note patterns

**Wednesday: Update & Test**
- Make one focused prompt improvement
- Test with `quick-iterate.js`
- If good, run full benchmark

**Friday: Review Progress**
```bash
# See your progress over time
node scripts/track-progress.js --show
```

---

## 🎨 Example Improvement Patterns

### Pattern: AI Misses Visual Comedy

**Where to Fix:** Add new step in deep reasoning chain

```typescript
┌─────────────────────────────────────────────────────────────────────────────
│ STEP 3.5: VISUAL PUNCHLINES
├─────────────────────────────────────────────────────────────────────────────
│ Ask: "Is the humor in what you SEE, not what is SAID?"
│
│ Visual comedy signals:
│ • Facial expression change (confident → horrified, smiling → deadpan)
│ • Physical gag (exaggerated reaction, clumsy movement)
│ • Visual reveal (camera pans to show unexpected element)
│ • Expression contradiction (saying "I'm fine" with dead eyes)
│
│ If the punchline is VISUAL, don't just describe dialogue.
│ Describe WHAT YOU SEE and WHY it's funny.
│
│ OUTPUT: Note in format_participation or editing_contribution
└─────────────────────────────────────────────────────────────────────────────
```

### Pattern: AI Gives High Scores to "Relatable" Non-Jokes

**Where to Fix:** Enhance quality assessment step

```typescript
│ STEP 7: CONTENT QUALITY ASSESSMENT
│
│ CRITICAL: Is there an actual JOKE here, or just relatable content?
│
│ Ask: "If I explained this to someone, would they laugh or just nod?"
│
│   Relatable (not a joke):
│   - "Customer service is exhausting" 
│   - "This is me every morning"
│   → Just recognition, no humor mechanism
│
│   Actual joke:
│   - Setup + unexpected payoff
│   - Tension + release
│   - Absurdity or violation that creates humor
│   → Clear humor mechanism present
│
│ Be willing to say: "This is relatable content without a humor payoff"
│
└─────────────────────────────────────────────────────────────────────────────
```

### Pattern: AI Misses Format Subversion

**Where to Fix:** Expand Step 3 with concrete examples

```typescript
│ STEP 3: FORMAT PARTICIPATION
│
│ Common format subversions to recognize:
│
│ 1. INTERVIEW FORMAT BREAK
│    Setup: Person being interviewed in expected Q&A format
│    Subversion: Person refuses to play along, breaks the format
│    Example: "How many lamb chops?" → Chef: "I'm making them, you all stfu"
│
│ 2. POV MISDIRECTION
│    Setup: First-person voice makes us think we're in one person's head
│    Subversion: Reveal that voice is someone else speaking out loud
│    Example: Tipping anxiety voice → revealed to be cashier
│
│ 3. PATTERN → BREAK
│    Setup: Same action repeated 2-3 times (pattern established)
│    Subversion: Final iteration breaks the pattern
│    Example: Different staff estimate 600, 100, 1000 → Chef refuses to answer
│
│ If you see these, name them specifically. Don't just say "format participates."
│
└─────────────────────────────────────────────────────────────────────────────
```

---

## 🚀 Advanced: Add Teaching Examples

When you find a great correction that captures a pattern, add it as a seed example:

```bash
# Interactive helper
node scripts/add-teaching-example.js

# Or from specific video correction
node scripts/add-teaching-example.js --video-id=abc123
```

This generates code you can add to `SEED_DEEP_REASONING_EXAMPLES` in `deep-reasoning.ts`.

---

## 📊 Tracking Your Progress

### View Progress Chart
```bash
node scripts/track-progress.js --show
```

```
Date       | Avg Score | Δ    | Distribution (E/G/A/P)
────────────────────────────────────────────────────────────
2025-12-15 |  67.3%   |   -   | 1/2/6/11
2025-12-18 |  73.8%   | +6.5  | 3/8/7/2
2025-12-22 |  79.1%   | +5.3  | 8/9/3/0

OVERALL PROGRESS:
  Start: 67.3%
  Current: 79.1%
  Total Improvement: +11.8%
  
  🎉 Significant improvement! Your prompt iterations are working.
```

### Quick Compare
```bash
# Compare current prompt against last snapshot (fast)
node scripts/track-progress.js --compare
```

---

## 🎯 Success Metrics

### Short Term (2 weeks)
- [ ] Baseline established
- [ ] 10+ video corrections added
- [ ] First pattern identified
- [ ] First prompt improvement: +5% on that pattern

### Medium Term (1 month)
- [ ] Average understanding > 75%
- [ ] < 30% of analyses need correction
- [ ] 3+ prompt improvements committed
- [ ] Clear upward trend in progress chart

### Long Term (3 months)
- [ ] Average understanding > 85%
- [ ] AI captures YOUR key insights consistently
- [ ] Only nitpick corrections needed (not major misunderstandings)
- [ ] New video analyses rarely surprise you with how wrong they are

---

## 💡 Pro Tips

1. **One pattern at a time**: Don't try to fix everything at once. Pick the #1 issue, fix it, test, commit.

2. **Test before committing**: Always run `quick-iterate.js` first. If no improvement, don't commit.

3. **Be specific**: "Subversion" is vague. "POV misdirection revealing power dynamic" is specific.

4. **Use your corrections as examples**: Your best teaching examples come from videos you've analyzed yourself.

5. **Track everything**: Use progress snapshots. You'll forget where you started.

6. **Celebrate wins**: +5% improvement is significant. +10% is huge.

---

## 🆘 Troubleshooting

**Q: My prompt change made things worse**
- Revert the change (`git checkout src/lib/services/video/deep-reasoning.ts`)
- Your change was probably too specific or broke existing understanding
- Try a more targeted change

**Q: I'm not seeing improvement**
- Check if you have enough corrections (need 10+ with the pattern you're addressing)
- Make sure your prompt change is in the right step
- Try adding a concrete teaching example instead of just instructions

**Q: AI improved on one pattern but regressed on others**
- Your change was too narrow
- Add qualifiers: "If X, then Y. Otherwise, check Z."
- Balance specificity with generality

---

## ✅ Next Steps

1. **Right now**: Run `node scripts/compute-understanding-scores.js --stats` to see your baseline
2. **Today**: Analyze 3 videos via `/analyze-rate-v1`, add corrections
3. **This week**: Identify your top pattern, make first prompt improvement
4. **This month**: Achieve +10% improvement on your baseline

You have all the tools. Now iterate! 🚀

