# Focused Evaluation: 10 Edge Cases for Humor Understanding

## Purpose

This document defines a **focused evaluation set** of 10 carefully selected videos that test different aspects of humor understanding. Unlike embedding similarity scores (which penalize semantically equivalent but differently-worded explanations), this evaluation asks specific questions where human judgment can verify if the AI "gets it."

The goal: Define what **85%+ understanding** actually means through concrete examples.

---

## Evaluation Philosophy

### The Problem with Embedding Similarity
- AI says "the humor comes from the unexpected rejection" 
- Human notes say "it's mean in an unexpected and unnecessary way"
- These mean the **same thing** but get low embedding similarity

### The Solution: Specific Questions
For each video, we ask:
1. **Core Question**: What is the ONE thing you must understand about this video?
2. **Nuance Question**: What subtle detail separates a good explanation from a shallow one?
3. **Quality Question**: Is this actually funny, or just relatable/clever/cute?

If the AI answers all 3 correctly → 85%+ understanding for that video.

---

## The 10 Edge Cases

### Case 1: POV Misdirection
**ID**: `c43d3e95-b01a-4e29-af3f-dc542be870a4`
**Summary**: POV customer at register, internal voice debates tip amount. Reveal: it was the CASHIER speaking out loud.

**Human Notes**: 
> The specific subversion is of POV conventions (voice = POV character thoughts). The humor comes from realizing someone was trying to manipulate a private decision.

**Core Question**: Whose voice is speaking, and why does that matter?
- ❌ Wrong: "It's about tipping anxiety"
- ✅ Right: "The voice we assumed was the customer's thoughts was actually the cashier speaking out loud, trying to influence the tip"

**Nuance Question**: What makes the "Can you shut up?" response funny?
- ❌ Wrong: "It's rude"
- ✅ Right: "It's casual boundary-setting that acknowledges the absurdity of what just happened"

**Quality**: Comedy (genuine subversion with payoff)

---

### Case 2: Mean Humor / Implied Rejection
**ID**: `dcf549d0-8144-4ffe-b31a-421739c0b257`
**Summary**: "Beautiful people get a discount." Customer looks hopeful. "That'll be $15." (Same price)

**Human Notes**:
> The deadpan delivery of "no, the price is the same" is a disappointing reveal for the girl, getting the realization that the man in the register does not actually find her attractive. It's mean in an unexpected and unnecessary way.

**Core Question**: Why doesn't the customer get a discount?
- ❌ Wrong: "It's a subversion of expectations"
- ✅ Right: "The cashier implies she's not attractive enough to qualify, which is a casual rejection disguised as a transaction"

**Nuance Question**: What makes this "mean humor"?
- ❌ Wrong: "The discount didn't apply"
- ✅ Right: "The cruelty is in what's NOT said - no direct insult, just the implication through inaction"

**Quality**: Comedy (mean humor, well-executed)

---

### Case 3: Sarcasm as Social Correction
**ID**: `5908a069-616a-4e82-a85d-10630c15998d`
**Summary**: Customer asks "Do you work here?" to person in full uniform, holding branded box. Person removes uniform, says "No."

**Human Notes**:
> The humor comes from... taking it off and saying "no", which is something of an annoyed way of saying "isn't it obvious?", but meeting it with sarcasm.

**Core Question**: Is the worker lying when they say "No"?
- ❌ Wrong: "Yes, they're denying they work there"
- ✅ Right: "No, it's exaggerated sarcasm meaning 'your question was so obviously answered by visual cues that I'm mocking you'"

**Nuance Question**: Why does removing the uniform make it funnier?
- ❌ Wrong: "It emphasizes the denial"
- ✅ Right: "The commitment to the bit (physical action) elevates simple sarcasm into absurdist comedy"

**Quality**: Comedy (sarcasm + absurd commitment)

---

### Case 4: Malicious Compliance
**ID**: `00112449-bf90-497a-82ab-bd9dd3d38e5f`
**Summary**: Manager says "use your heads". Workers literally use physical heads to clean, sweep, etc.

**Human Notes**:
> The wordplay is just the vehicle. The real humor is workplace resistance through deliberate misunderstanding.

**Core Question**: Are the workers confused or deliberately misunderstanding?
- ❌ Wrong: "They're taking the phrase literally by mistake"
- ✅ Right: "They're deliberately misinterpreting as a form of workplace resistance/mockery"

**Nuance Question**: What's the subtext about management?
- ❌ Wrong: "Managers give unclear instructions"
- ✅ Right: "Management clichés are meaningless platitudes, and workers are reflecting that meaninglessness back"

**Quality**: Comedy (subversive, escalation)

---

### Case 5: Caustic Worker Tone
**ID**: `4b5b4312-7d14-4a41-98c4-96f4e9424bfe`
**Summary**: Customer asks for box for single slice. Worker's reaction shows frustration. Dialogue has "fed up" tone.

**Human Notes**:
> A lot of the funny aspect comes from the worker's communication, a little bit caustic but still trying to be respectful. It's a slightly absurdist dynamic.

**Core Question**: What makes the worker's reaction funny?
- ❌ Wrong: "The customer's request is unreasonable"
- ✅ Right: "The worker's tone is caustic but restrained - clearly fed up but maintaining surface professionalism"

**Nuance Question**: What small jokes are injected throughout?
- ❌ Wrong: "The customer eating at the bar"
- ✅ Right: "Multiple: wanting a box for one slice, the worker's escalating frustration, the absurd contradiction of saying 'driving' while eating there"

**Quality**: Comedy (character-driven, workplace frustration)

---

### Case 6: Quality Judgment - [MEDIOCRE]
**ID**: `5d78ca54-d068-4651-92aa-640f0bebe440`
**Summary**: Restaurant 10th anniversary - employee not normally tasked with social media duties fumbles through recording.

**Human Notes**:
> [MEDIOCRE] The premise is somewhat amusing to begin with, showing how an employee not normally tasked to performing social media duties...

**Core Question**: Is this video funny or just charming?
- ❌ Wrong: "It's funny because of the awkwardness"
- ✅ Right: "It's more CHARMING/ENDEARING than funny - the appeal is the personality, not a joke structure"

**Nuance Question**: What limits this video's comedic impact?
- ❌ Wrong: "The execution"
- ✅ Right: "There's no real joke mechanism - it's relatable content (anyone can relate to being awkward on camera) without a comedic payoff"

**Quality**: Charming/Endearing (not primarily comedy)

---

### Case 7: Quality Judgment - [GOOD]
**ID**: `5bddfd86-2986-40d7-86e8-4ffbe2306d9a`
**Summary**: Unrealistic expectations of restaurant work humorously portrayed.

**Human Notes**:
> [GOOD] Well produced and with a fun premise. The video is a bit long, and relies on visual gags.

**Core Question**: What makes this video work where others fail?
- ❌ Wrong: "It's relatable"
- ✅ Right: "It combines relatable premise + visual gags + production quality = multiple layers working together"

**Nuance Question**: What would be needed to replicate this style?
- ❌ Wrong: "A restaurant setting"
- ✅ Right: "Specific visual gag techniques that show absurd contrasts between expectation and reality"

**Quality**: Comedy (well-produced, visual)

---

### Case 8: Cultural Context Required
**ID**: `d85b913c-b104-4b4c-afe1-9300cc8a34cc`
**Summary**: Exaggerated joy when food finally arrives at the table.

**Human Notes**:
> A short and simple concept centered around a customer waiting for food. It does not have any dialogue, and uses a single shot...

**Core Question**: Is there an actual joke here?
- ❌ Wrong: "Yes, the exaggerated reaction is funny"
- ✅ Right: "It's RELATABLE content, not comedy - 'anyone who's been hungry understands' without an actual joke mechanism"

**Nuance Question**: What's missing that would make it comedic?
- ❌ Wrong: "Better acting"
- ✅ Right: "A subversion, twist, or unexpected element - this just depicts a relatable feeling without comedic payoff"

**Quality**: Relatable (not primarily comedy)

---

### Case 9: Worker/Manager Dynamic
**ID**: `ad5c340f-1a45-4fbe-9e1a-d66c8978d211`
**Summary**: Worker makes mistakes while being watched by boss.

**Human Notes**:
> A simple concept that centers around a dynamic between a manager and a worker. The worker is seen to be nervous around her manager...

**Core Question**: What's the universal experience being depicted?
- ❌ Wrong: "Making mistakes at work"
- ✅ Right: "Becoming MORE incompetent specifically BECAUSE you're being watched - performance anxiety making you worse"

**Nuance Question**: What makes this relatable rather than funny?
- ❌ Wrong: "The mistakes aren't exaggerated enough"
- ✅ Right: "It depicts a feeling everyone knows but doesn't subvert or escalate - it's recognition humor without comedic mechanism"

**Quality**: Relatable (recognition > comedy)

---

### Case 10: Misunderstanding Comedy (Self-Perception Gap)
**ID**: `cc514ce1-a67b-4041-b282-bc45c2b0ad2d`
**Summary**: Bubble tea shop sign says "shake it". Customer starts dancing with confused face.

**Human Notes**:
> The customer reads "shake it" as "shake your body" (dance) rather than shake the drink. Her facial expression implies SHE thinks the worker is strange - but WE know she's the one who misread.

**Core Question**: Who looks foolish - the worker or the customer?
- ❌ Wrong: "Both are confused"
- ✅ Right: "The CUSTOMER looks foolish, but her facial expression shows she thinks the WORKER is strange - the gap between her self-perception and reality IS the joke"

**Nuance Question**: Why does her confident confusion make it funnier?
- ❌ Wrong: "It adds to the misunderstanding"
- ✅ Right: "The audience knows something she doesn't - we see she's wrong while she's confidently judging the worker as strange"

**Quality**: Comedy (misunderstanding + self-perception gap)

---

## How to Use This Evaluation

### Manual Evaluation Process
1. Run the AI analysis on each video
2. Read the Core Question - does the AI answer capture this?
3. Read the Nuance Question - does the AI identify this subtle element?
4. Check Quality - does the AI correctly identify the content type?

### Scoring
- **All 3 correct**: 100% (AI "gets it")
- **Core + Quality correct**: 75% (understands the joke, misses nuance)
- **Only Core correct**: 50% (shallow understanding)
- **Core wrong**: 0% (fundamental misunderstanding)

### Target
- **85%+ means**: AI gets Core + at least one of (Nuance, Quality) on 8/10 videos

---

## Running the Focused Evaluation

```bash
# Analyze specific video
node scripts/check-video-context.js <video-id>

# Re-analyze with deep reasoning
node scripts/reanalyze-with-deep-reasoning.js --id=<video-id>

# Run on all 10 edge cases
node scripts/focused-evaluation.js
```

---

## What This Tells Us

If the AI consistently:
- **Misses Core Questions**: Prompt needs fundamental improvement
- **Misses Nuance Questions**: Needs more examples/teaching for that pattern
- **Misses Quality Judgments**: Needs better Comedy vs Relatable vs Charming distinction

The 10 cases cover:
- POV misdirection
- Mean/implied humor
- Sarcasm patterns
- Workplace resistance
- Tone/delivery humor
- Quality calibration (distinguishing good from mediocre)
- Relatable vs Funny distinction
- Self-perception gaps

This is a more rigorous test than embedding similarity because it tests **specific understanding** rather than **semantic overlap**.
