# Fingerprint System Diagnostic Questions

> **Purpose**: Identify gaps, validate assumptions, and calibrate the fingerprint system toward 90% accuracy.
> 
> **How to use**: Answer each question with your actual expectations. Use ✅ (valid), ❌ (wrong assumption), or 🔶 (partially correct, needs refinement). Add comments in the `→ Your response:` sections.

---

## Meta-Layer 0: The Purpose & Scope

Before diving into technical layers, we need to align on *what problem we're actually solving*.

### Q0.1: What is a "good match"?
When the fingerprint system says "85% match," what should that mean in practice?

- **A)** The candidate video could be posted on the brand's account and feel native
- **B)** The candidate video creator could be hired to make content for the brand
- **C)** The candidate video's *style* aligns, even if the topic/product differs
- **D)** Something else entirely?

→ Your response:

---

### Q0.2: Who is the end user of a fingerprint?
- A sales team comparing prospects to successful accounts?
- A content strategist planning what videos to make?
- An AI system auto-matching influencers to brands?
- You personally, evaluating potential collaborations?

→ Your response:

---

### Q0.3: What's the cost of a false positive vs. false negative?
- **False positive**: System says "good match" but it's actually not
- **False negative**: System says "poor match" but it would've been great

Which is worse? This determines how conservative or aggressive we should be.

→ Your response:

---

### Q0.4: Should the system differentiate between "this brand SHOULD be like X" vs "this brand IS like X"?
Currently we only measure what a brand *is doing*. But maybe they're doing it poorly and the fingerprint shouldn't perpetuate that?

→ Your response:

---

### Q0.5: What distinguishes a brand's fingerprint from a single video's analysis?
If I have 10 videos, what emerges at the profile level that doesn't exist at the video level? Currently we average—but should we look for consistency? Range? Evolution over time?

→ Your response:

---

## Layer 1: Quality & Service Fit

The first layer assesses whether content is "good" from two angles: (a) useful for your service, and (b) well-executed objectively.

### Q1.1: What makes a video "excellent" vs "good" vs "mediocre"?
Current mapping: excellent=0.9, good=0.7, mediocre=0.5, bad=0.3

Can you articulate the criteria you use when rating? Is it:
- Virality potential?
- Production polish?
- Message clarity?
- Authenticity?
- Something hospitality-specific?

→ Your response:

---

### Q1.2: Are you rating the *video* or the *brand behind it*?
A great brand can make a mediocre video. A nobody can go viral once. Which matters more for fingerprinting?

→ Your response:

---

### Q1.3: Should quality be relative to category or absolute?
A "high-production" TikTok from a small café is different from a hotel chain's polished ad. Do we grade on a curve, or is there a universal standard?

→ Your response:

---

### Q1.4: The current L1 split (Service Fit vs Execution Quality) assumes they're separate.
**Service Fit**: "Is this style useful for our clients?"
**Execution Quality**: "Is this well-made regardless of style?"

Is this distinction valuable? Can a video have high execution but low service fit, or vice versa?

→ Your response:

---

### Q1.5: Execution Quality is computed from 4 signals:
- `execution_coherence` (35%) – message clarity
- `distinctiveness` (35%) – stands out from generic content
- `confidence` (15%) – presenter confidence
- `message_alignment` (15%) – personality matches message

Are these the right signals? Wrong weights? Missing anything?

→ Your response:

---

### Q1.6: Quality currently has no engagement data (views, likes, shares).
Is "proven virality" a signal we should include? Or is it noise (luck, timing, algorithm)?

→ Your response:

---

### Q1.7: How stable should quality be across a brand's videos?
If a brand has 3 excellent videos and 2 mediocre ones, should the fingerprint:
- Average them (current approach)?
- Weight toward the best (aspirational)?
- Flag the inconsistency as a risk?

→ Your response:

---

## Layer 2: Personality & Likeness

This layer captures *who the brand is* if it were a person—tone, humor, positioning.

### Q2.1: The "personality as a person" metaphor—is it useful?
We describe brands as having energy, warmth, formality, etc. But does a restaurant have a personality, or does the *owner/content creator* have one?

→ Your response:

---

### Q2.2: How many dimensions actually differentiate brands?
L2 currently has 20+ fields. In practice, how many matter for matching? Could we reduce to 5-7 "core" differentiators?

→ Your response:

---

### Q2.3: The tone metrics (energy/warmth/formality) are 1-10 scales.
What's a meaningful difference? Is 6 vs 7 energy distinguishable, or is it noise?

→ Your response:

---

### Q2.4: Humor is heavily weighted but optional.
Not all hospitality brands use humor. Is the system biased toward funny content? How should we treat brands with no humor presence?

→ Your response:

---

### Q2.5: `age_code` (younger/older/balanced) is a proxy for audience.
Is this the right signal? What about urban/suburban, income level, cultural background?

→ Your response:

---

### Q2.6: `accessibility` (everyman/aspirational/exclusive/elite) seems crucial.
How well is the AI detecting this? A fancy restaurant trying to seem approachable—how should that tension be captured?

→ Your response:

---

### Q2.7: `edginess` might be the most subjective signal.
"Safe" vs "provocative"—these judgments vary by culture, generation, context. How do we calibrate?

→ Your response:

---

### Q2.8: `traits_observed` is a freeform array (e.g., ["friendly", "quirky", "confident"]).
The AI generates these, but they're not standardized. Should we have a controlled vocabulary?

→ Your response:

---

### Q2.9: How do we handle brand evolution?
A brand's personality can shift. Are we fingerprinting "current state" or "core identity"? Should older videos be downweighted?

→ Your response:

---

### Q2.10: What's the relationship between personality and performance?
If a brand is warm but their warm content underperforms vs. their edgy content—which defines them?

→ Your response:

---

## Layer 3: Production DNA

This layer captures visual/audio execution style—production investment, effort, format consistency.

### Q3.1: Is production style actually differentiating?
Many TikToks share similar iPhone-shot, natural-light, talking-head formats. Does L3 add signal or just noise?

→ Your response:

---

### Q3.2: "Effortlessness" is a style choice, not a quality measure.
High-effort content made to look effortless is different from actually-low-effort content. Can the AI distinguish?

→ Your response:

---

### Q3.3: `has_repeatable_format` flags consistency.
Is format consistency a positive signal (brand recognition) or a negative one (boring/predictable)?

→ Your response:

---

### Q3.4: `social_permission` (how shareable is this content).
What makes content shareable vs. private? Is this about topic or presentation?

→ Your response:

---

### Q3.5: Should L3 capture platform-specific conventions?
TikTok vs Instagram vs YouTube styles differ. Is a "good TikTok" approach applicable to Instagram?

→ Your response:

---

### Q3.6: Audio is minimally captured (music/voice tone).
For hospitality content, does audio matter? Background music, ASMR food sounds, voiceover style?

→ Your response:

---

### Q3.7: We don't capture visual branding (colors, logos, graphics).
Some brands have strong visual identity. Others are just raw footage. Should we track this?

→ Your response:

---

## Aggregation & Computation

How signals combine across videos into a fingerprint.

### Q4.1: Simple averaging loses information.
If brand has 50% "witty" humor and 50% "wholesome"—we report both as dominant. But are they alternating, experimenting, or inconsistent?

→ Your response:

---

### Q4.2: Mode selection for categories can be fragile.
With 10 videos and 4 "entertain", 3 "inform", 3 "inspire" intents—we pick "entertain." But is 40% really "dominant"?

→ Your response:

---

### Q4.3: Video weights (quality × coherence) bias toward "good" content.
Should exceptional outliers be weighted higher, or does this bias the fingerprint away from the brand's typical output?

→ Your response:

---

### Q4.4: The embedding centroid is a single 1536-dim vector.
This compresses all semantic nuance into one point. Two very different videos could average to a centroid that resembles neither. Is this a problem?

→ Your response:

---

### Q4.5: Confidence score is just data completeness, not accuracy.
Having 100% of videos rated doesn't mean ratings are accurate. How should we differentiate "lots of data" from "reliable data"?

→ Your response:

---

### Q4.6: How many videos are actually needed?
Documentation says 5-10. But some brands are consistent (3 might suffice), others are varied (might need 20). How do we know?

→ Your response:

---

## Matching & Comparison

How we use fingerprints to find similar content or evaluate fit.

### Q5.1: Current match weights: L2 (35%) > Embedding (30%) > L1 (25%) > L3 (10%)
Do these reflect importance correctly? Why is L3 so low if production style matters?

→ Your response:

---

### Q5.2: L1 match penalizes quality differences.
If a 0.9-quality brand matches against a 0.7-quality candidate, they're penalized. But maybe the style matches perfectly?

→ Your response:

---

### Q5.3: L2 match uses humor overlap heavily (30%).
Non-humorous brands get a 0 here, hurting their match scores. Is this fair?

→ Your response:

---

### Q5.4: Embedding similarity is cosine on the centroid.
This treats all 1536 dimensions equally. Some might be noise. Should we reduce dimensionality or weight dimensions?

→ Your response:

---

### Q5.5: What's the minimum threshold for a "useful" match?
Currently 0.85 is "good." But is 0.70 still valuable? At what point is a match misleading?

→ Your response:

---

### Q5.6: Should we match fingerprint-to-fingerprint, or fingerprint-to-video?
A brand fingerprint compared to a single video is asymmetric. How should we handle this?

→ Your response:

---

## Data Sources & Ground Truth

The fundamental inputs that everything depends on.

### Q6.1: Human ratings are sparse.
How many of your 4 test brands' videos have been manually rated? Is the system flying blind?

→ Your response:

---

### Q6.2: Schema v1 requires GCS upload for video analysis.
Is every video being analyzed, or are some missing? How reliable is the AI analysis without corrections?

→ Your response:

---

### Q6.3: Corrections/overrides are rarely populated.
The system has a `human_patch` mechanism but it seems unused. Is the AI output being trusted blindly?

→ Your response:

---

### Q6.4: There's no feedback loop on matches.
We can't currently record "this match was good/bad" to tune the system. How critical is this?

→ Your response:

---

### Q6.5: Embeddings are generated by OpenAI's model.
These aren't hospitality-specific. A "cozy café" might be similar to "cozy living room" in embedding space. Is this a problem?

→ Your response:

---

## Test Case Calibration

For your 4 test brands (Cassa Kitchen, Kiele Kassidy, Steve's Poke, Bram's Burgers):

### Q7.1: What should the ideal fingerprint capture for each?
In 2-3 sentences, describe what makes each brand distinctive. This is your ground truth.

**Cassa Kitchen**: 
→ Your response:

**Kiele Kassidy**: 
→ Your response:

**Steve's Poke**: 
→ Your response:

**Bram's Burgers**: 
→ Your response:

---

### Q7.2: Which pairs should be "similar" and which should be "different"?
Draw the expected similarity matrix:

|  | Cassa | Kiele | Steve's | Bram's |
|--|-------|-------|---------|--------|
| Cassa | - | ? | ? | ? |
| Kiele | ? | - | ? | ? |
| Steve's | ? | ? | - | ? |
| Bram's | ? | ? | ? | - |

→ Your response:

---

### Q7.3: What would a "false positive" look like for each brand?
What kind of content would the system incorrectly flag as a match?

→ Your response:

---

### Q7.4: What would a "false negative" look like?
What content fits the brand perfectly but the system might miss?

→ Your response:

---

### Q7.5: If you had to pick ONE signal that best differentiates these 4 brands, what would it be?
(This helps prioritize what the system must get right)

→ Your response:

---

## Next Steps

After you complete this questionnaire:

1. **I will analyze patterns in your answers** to identify which layers need refinement
2. **We'll create ground truth annotations** for the test videos
3. **Build an accuracy test harness** that compares system output to your expectations
4. **Iterate on weights/signals** until we hit 90% alignment

---

*Document created: December 13, 2025*
*Last updated: —*
