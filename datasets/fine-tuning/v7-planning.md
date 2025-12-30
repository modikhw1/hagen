# v7 Training Plan

## Prompt Change (v6 - Active Now)

Added third analysis mode "Balanced" between Short & Sharp and Detailed.

**Balanced prompt:**
```
Analysera videon. Hitta den faktiska poängen - inte bara beskriv scenen.

Format:
**Observation:** [Vad i videon stödjer din tolkning? Specifika visuella/auditiva detaljer.]
**Handling:** [Vad händer och varför det är poängen. Längden ska matcha innehållet - kort om det är enkelt, längre om detaljer är relevanta för förståelsen.]
**Mekanism:** [Vilken humormekanism används]
**Varför:** [Varför det fungerar. Om det finns nyanser värda att förklara, ta med dem.]
**Målgrupp:** [Vem uppskattar detta]

Fokusera på att fånga rätt tolkning. Om ordlek eller flertydighet finns, kontrollera visuella ledtrådar för att avgöra vilken tolkning som gäller.
```

**Key differences from concise:**
- Adds Observation field (cite evidence before committing)
- Allows variable length ("längden ska matcha innehållet")
- Explicit instruction to check visual cues for ambiguity
- No "extremt kort" constraint

---

## Output Length = Content Complexity

The model should produce shorter output for simple content, longer for complex. Not through post-processing, but learned from training examples.

**Signals that content is simple (→ short output):**
- Common format (POV, "when X happens") - audience knows the structure
- Single obvious mechanism - self-evident, no need to over-explain
- No ambiguity in interpretation - no justification needed
- Visual = text (what you see is the whole joke)

**Signals that content is complex (→ longer output):**
- Multiple layered mechanisms
- Ambiguous wordplay requiring visual disambiguation
- Background/foreground contrast
- Non-obvious "varför" that needs explanation

**Example - simple clip (engelska-panik):**
```
**Handling:** Anställda flyr och spelar döda när engelsktalande kund kommer.
**Mekanism:** Överdrift, igenkänning.
**Varför:** Förstorar relaterbar språkångest till absurd nivå.
**Målgrupp:** Servicepersonal.
```
4 lines. Nothing more to say. Don't pad simple content.

**Training approach:** Include examples that demonstrate this calibration - simple clips with short analysis, complex clips with longer analysis. The model learns the correlation.

---

## TikTok Background Sounds / Trends

TikTok sounds sometimes carry meaning, sometimes don't. The model must recognize the difference.

**Sound WITH meaning:**
- Sound is part of the joke structure (setup/punchline in audio)
- Lyrics relate to the visual content
- Known trend format where sound defines the template
- Sound creates ironic contrast with visuals

**Sound WITHOUT meaning (decorative):**
- Generic trending audio slapped on for reach
- Music that sets mood but doesn't add to humor
- Sound doesn't interact with the content

**Rule:** Only mention TikTok sound in analysis if it contributes to the humor mechanism. If it's just background music, ignore it. Don't write "ljudet ger videon charm" - that's filler.

**Training approach:** Include examples where sound IS the joke vs examples where sound is irrelevant. Teach the model to recognize when audio matters.

---

## Core Principle
**Output length = relevant information density. Not arbitrary, not padded, not compressed.**

---

## New Training Data Created

### 1. Multi-Interpretation Examples
**File:** `multi-interpretation-examples.jsonl`
**Count:** 15 examples

**Purpose:** Teach model to disambiguate when wordplay has multiple possible meanings.

**Format:**
```json
{
  "wordplay_analysis": {
    "phrase": "högre upp",
    "possible_meanings": [
      {"interpretation": "...", "visual_evidence": "...", "fit": "weak/strong"}
    ],
    "selected": "...",
    "selection_reasoning": "..."
  },
  "analysis": "..."
}
```

**Key lesson:** Check visual evidence before committing to interpretation.

---

### 2. Meta-Observation Examples
**File:** `meta-observation-examples.jsonl`
**Count:** 8 examples

**Purpose:** Teach model WHEN to look deeper (background gags, audio contrast, environmental text, etc.)

**Patterns covered:**
- background_contrast
- environmental_text
- audio_contrast
- missed_signal
- escalating_signs
- creation_as_expression
- object_reveal
- subtitle_commentary

---

### 3. Observation-Enhanced Format
**File:** `observation-enhanced-examples.jsonl`
**Count:** 8 examples

**Purpose:** Add checkpoint before interpretation to reduce first-guess errors.

**Format change:**
```
**Observation:** [specific visual evidence]
**Handling:** [interpretation based on observation]
**Mekanism:** ...
**Varför:** ...
**Målgrupp:** ...
```

The observation field forces model to cite evidence before committing.

---

## Problem Being Solved

v6 issue: Same video can produce different quality outputs. Short outputs sometimes miss the point (just describe scene). Longer outputs tend to be more accurate (80-90%).

**Root cause:** Model generates token-by-token. Short format = commits early, no revision. Long format = more "thinking" happens mid-generation.

**Solution:** Observation field creates a "pause and check" moment. Model must ground interpretation in visual evidence before writing analysis.

---

## Length Principle

NOT: "complex = long, simple = short"

INSTEAD: "relevant information determines length"

- All relevant details included
- No irrelevant padding
- No compression that loses meaning

The training examples should demonstrate this naturally - the model learns from seeing appropriate lengths for different content types.

---

## Files to Merge for v7

1. `gold_standard.jsonl` (existing ~200 examples)
2. `simpsons_training.jsonl` (existing ~400 examples)
3. `multi-interpretation-examples.jsonl` (15 new)
4. `meta-observation-examples.jsonl` (8 new)
5. `observation-enhanced-examples.jsonl` (8 new)

**Decision needed:** Convert all examples to observation-enhanced format, or mix formats?

---

## Open Questions

1. Should observation field be required in all outputs, or only when disambiguation needed?
2. How to validate that model learned "relevant length" vs "arbitrary length"?
3. Should multi-interpretation reasoning be visible in output or internal only?

---

## Next Steps

- [ ] Decide on format unification
- [ ] Merge training files
- [ ] Run v7 fine-tuning
- [ ] Test on same clips that v6 got wrong (högre upp, etc.)
