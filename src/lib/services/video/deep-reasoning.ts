/**
 * Deep Humor Reasoning Module
 * 
 * Enhances Gemini's analysis by forcing generative reasoning before taxonomic labeling.
 * This module adds a "reasoning chain" section to prompts that requires the model to
 * answer "why" questions before outputting humor types.
 * 
 * KEY INSIGHT: The difference between shallow and deep analysis is asking
 * "what explains this pattern?" rather than "what label fits this?"
 */

// =============================================================================
// REASONING CHAIN PROMPT SECTION
// =============================================================================

/**
 * The Deep Reasoning Chain - injected into prompts before humor analysis.
 * Forces the model to reason through dynamics before labeling.
 */
export const DEEP_REASONING_CHAIN = `
═══════════════════════════════════════════════════════════════════════════════
DEEP HUMOR REASONING CHAIN (Complete BEFORE labeling humor type)
═══════════════════════════════════════════════════════════════════════════════

For EVERY video with humor, answer these questions IN ORDER before assigning labels:

┌─────────────────────────────────────────────────────────────────────────────
│ STEP 1: CHARACTER DYNAMICS
├─────────────────────────────────────────────────────────────────────────────
│ Don't describe what characters DO. Describe their RELATIONSHIP and MOTIVATIONS.
│
│ Ask: "What dynamic exists between these characters?"
│ 
│ Common dynamics in service industry content:
│ • Worker who must maintain professionalism vs. customer who doesn't deserve it
│ • Workers who want less work vs. managers who want more output
│ • Someone who thinks they're clever vs. someone who sees through it
│ • Public performance of service vs. private reality (dead inside)
│ • The person doing the work vs. the person benefiting from it
│
│ OUTPUT: character_dynamic field
└─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────
│ STEP 2: UNDERLYING TENSION
├─────────────────────────────────────────────────────────────────────────────
│ Every joke has tension. Find it. The humor lives in the GAP between opposites.
│
│ Ask: "What tension does this create?"
│
│ Common tensions:
│ • Professionalism vs. genuine emotion
│ • What you say vs. what you mean
│ • Customer expectations vs. reality
│ • Performance (fake smile) vs. authenticity (frustration)
│ • What SHOULD happen vs. what DOES happen
│
│ OUTPUT: underlying_tension field
└─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────
│ STEP 3: FORMAT PARTICIPATION
├─────────────────────────────────────────────────────────────────────────────
│ The STRUCTURE of the video can be part of the joke.
│
│ Ask: "Does the format/structure participate in the humor?"
│
│ Format elements that become jokes:
│ • Pattern established → then broken (person refuses to play the game)
│ • POV misdirection (you think you know whose perspective, then discover otherwise)
│ • Escalation structure (each beat raises stakes until break)
│ • Mid-word/mid-action cut (implies without stating)
│ • Interview format subverted (interviewee or interviewer breaks role)
│
│ OUTPUT: format_participation field
└─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────
│ STEP 4: EDITING AS COMEDY
├─────────────────────────────────────────────────────────────────────────────
│ Editing choices are often part of the joke. Analyze them.
│
│ Ask: "Did an editing choice add to the humor?"
│
│ Editing techniques:
│ • Mid-word cut: Implies profanity/action without showing it (feels authentic)
│ • Hard cut to black: Maximum impact ending, no resolution
│ • Held beat: Forces viewer to sit in awkwardness
│ • Pattern-pattern-break: Same rhythm then different on the break
│ • Reveal cut: Cut shows something that recontextualizes previous content
│
│ OUTPUT: editing_contribution field
└─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────
│ STEP 4.5: VISUAL PUNCHLINE DETECTION
├─────────────────────────────────────────────────────────────────────────────
│ Many video jokes have punchlines that are VISUAL, not spoken.
│
│ Ask: "Is the punchline shown rather than said?"
│
│ Visual punchline types:
│ • Reveal: Camera shows something unexpected (text on screen, object, person)
│ • Expression: Someone's face is the joke (disgust, dead inside, cringe)
│ • Action without words: Someone walks away, hangs up, or does something
│ • Text on screen: The words ARE the joke (no dialogue needed)
│ • Absence of people: Video is just images/text (no performance, just concept)
│ • Physical comedy: Something happens visually that words can't capture
│
│ CRITICAL: If the video works WITHOUT dialogue, the punchline is visual.
│ If you remove the images and just read the script, would it still be funny?
│ If NO - the visual IS the humor. Document what you SEE, not what is said.
│
│ Common visual-only formats:
│ • Questions posed to camera with no answer (engagement bait)
│ • Reaction faces that carry the whole joke
│ • Text overlays that are funnier than the audio
│ • Before/after reveals
│ • Object reveals (uniform, price tag, empty plate)
│
│ OUTPUT: visual_punchline field (describe what visual element delivers the joke, or 'none')
└─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────
│ STEP 5: AUDIENCE SURROGATE
├─────────────────────────────────────────────────────────────────────────────
│ Often one character represents what the audience feels.
│
│ Ask: "Is there a character the audience identifies with?"
│
│ The Rebel Worker Archetype:
│ • A worker who breaks professional composure
│ • Often the one "actually doing the work" (chef, server, kitchen staff)
│ • Expresses what viewers wish they could say
│ • Breaking from expected behavior is cathartic
│
│ OUTPUT: audience_surrogate field
└─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────
│ STEP 6: SOCIAL DYNAMICS & CRUELTY
├─────────────────────────────────────────────────────────────────────────────
│ Many jokes involve social power, embarrassment, or casual cruelty.
│
│ Ask: "Is someone being embarrassed, rejected, or put down? Is that the joke?"
│
│ Types of social dynamics in humor:
│ • Mean humor: Casual cruelty delivered deadpan (beauty discount = rejection)
│ • Embarrassment comedy: Someone misunderstands and looks foolish
│ • Status reversal: Low-status person gains power, high-status person humbled
│ • Escalation: Small disagreement builds to absurd proportions
│ • Misunderstanding comedy: Literal vs intended interpretation (shake = dance)
│
│ Key insight: If someone is embarrassed or rejected, NAME IT. 
│ "The joke is that she's told she's not attractive" is clearer than "subversion."
│
│ OUTPUT: social_dynamic field
└─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────
│ STEP 6.5: CULTURAL CONTEXT & TROPES
├─────────────────────────────────────────────────────────────────────────────
│ Humor often relies on shared cultural knowledge that may not be stated.
│
│ Ask: "What cultural context, tropes, or shared experiences does this require?"
│
│ Common service industry tropes:
│ • The "clueless young worker" - forgetful, unfocused, but endearing
│ • The "demanding kitchen staff" - everyone jumps when the chef speaks
│ • The "generosity game" - social ritual of insisting to pay the bill
│ • The "dead inside" service worker - professional smile hiding exhaustion
│ • The "entitled customer" - unreasonable demands treated as normal
│
│ Generational humor codes:
│ • Gen Z irony: Deadpan, understated, nihilistic undertones
│ • Millennial relatability: "Adulting is hard" shared exhaustion
│ • Parent/child dynamics: Authority vs. naive worldview
│
│ Social rituals that drive humor:
│ • Tipping anxiety (US-specific cultural tension)
│ • Bill-paying dance (who offers, who insists, who caves)
│ • Interview politeness (masks vs. true feelings)
│ • Customer-is-always-right (vs. worker revenge fantasies)
│
│ Ask yourself: "What does the audience need to ALREADY KNOW to find this funny?"
│ If you can't articulate the shared context, you may be missing the joke.
│
│ OUTPUT: cultural_context field (or 'none' if culturally neutral)
└─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────
│ STEP 7: CONTENT QUALITY ASSESSMENT (BE BRUTALLY HONEST)
├─────────────────────────────────────────────────────────────────────────────
│ Not all content works. Be honest - many videos are not actually funny.
│
│ Ask: "Is this GENUINELY funny, or just recognizable/relatable?"
│
│ DISTINGUISH BETWEEN:
│ • Humor: Makes you laugh or smile
│ • Relatability: You recognize the situation (but it's not funny)
│ • Engagement bait: Designed to get comments, not laughs
│ • Clever: Smart concept but not actually funny
│ • Cute/Charming: Pleasant but not comedic
│
│ BE CRITICAL - Don't inflate quality. Many videos are:
│ • "Premise is obvious, execution is average"
│ • "Relatable but not actually funny"
│ • "Trying too hard / overexplained"
│ • "Format is tired / seen this 100 times"
│ • "The idea is better than the execution"
│
│ QUALITY TIERS:
│ • Exceptional: Genuinely clever, surprising, well-executed. Would share.
│ • Good: Solid humor with good execution. Worth watching.
│ • Average: Does what it sets out to do, nothing special. Forgettable.
│ • Weak: Relatable but not funny, or poorly executed good idea.
│ • Poor: Doesn't work. Concept is broken or humor doesn't land.
│
│ Common mistakes:
│ ❌ Calling something "funny" because you understand what they're going for
│ ❌ Rating based on effort rather than outcome
│ ❌ Assuming observational = funny (observing something isn't inherently humor)
│ 
│ OUTPUT: quality_assessment field (tier + honest 1-sentence assessment)
└─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────
│ STEP 8: THE EXPLANATION TEST
├─────────────────────────────────────────────────────────────────────────────
│ Before finalizing your humor analysis, check your explanation.
│
│ ❌ WRONG: "The humor comes from the contrast between the characters"
│    (This labels but doesn't explain)
│
│ ✅ RIGHT: "The humor comes from each answer revealing self-interest based on 
│    job role - those who profit want more, those who labor want less. The chef 
│    breaks the format entirely by refusing to give a number, expressing the 
│    frustration of being the one 'actually doing the work'."
│    (This explains the MECHANISM)
│
│ Rule: If your explanation could apply to multiple videos, it's too shallow.
└─────────────────────────────────────────────────────────────────────────────

NOW output your deep reasoning analysis in this format:

"deep_reasoning": {
  "character_dynamic": "<one sentence describing the relationship/tension between characters>",
  "underlying_tension": "<what gap or conflict creates the humor>",
  "format_participation": "<how does structure/format participate in the joke, or 'none'>",
  "editing_contribution": "<what editing choices add to humor, or 'none'>",
  "visual_punchline": "<if punchline is visual: describe what visual element delivers the joke, or 'none'>",
  "audience_surrogate": "<which character represents viewer feelings, and what experience this taps into, or 'none'>",
  "social_dynamic": "<if relevant: who is embarrassed/rejected/put down and how, or 'none'>",
  "cultural_context": "<what cultural knowledge, tropes, or shared experiences does this joke require, or 'none'>",
  "quality_assessment": "<tier (Exceptional/Good/Average/Weak/Poor) + honest 1-sentence assessment>",
  "why_this_is_funny": "<2-3 sentences explaining the MECHANISM, not just describing what happens>",
  "what_makes_it_work": "<the core insight that makes this joke land>"
}
`

// =============================================================================
// ENHANCED HUMOR OUTPUT SCHEMA
// =============================================================================

/**
 * Enhanced humor analysis schema that requires deep reasoning
 */
export interface DeepHumorAnalysis {
  // Required deep reasoning (must be completed BEFORE labeling)
  deep_reasoning: {
    character_dynamic: string
    underlying_tension: string
    format_participation: string
    editing_contribution: string
    visual_punchline: string  // NEW: What visual element delivers the punchline?
    audience_surrogate: string
    social_dynamic: string
    cultural_context: string  // What shared knowledge does this joke require?
    quality_assessment: string
    why_this_is_funny: string
    what_makes_it_work: string
  }
  
  // Traditional humor fields (now DERIVED from reasoning)
  humor_type_primary: string
  humor_type_secondary?: string
  humor_mechanism: string
  
  // Replicability insight (derived from understanding)
  replicability_insight: {
    core_template: string  // The abstract pattern that could be adapted
    what_would_change: string[]  // Elements that vary in adaptation
    what_must_stay: string[]  // Elements essential to the joke
  }
}

// =============================================================================
// LEARNING EXAMPLE ENHANCEMENT
// =============================================================================

/**
 * When saving learning examples, structure them to model deep reasoning.
 * This teaches the model HOW to think, not just WHAT to output.
 */
export interface DeepReasoningExample {
  // The video context
  video_summary: string
  
  // What the model originally said (shallow analysis)
  original_analysis: string
  
  // The deep reasoning chain (models the thinking process)
  deep_reasoning: {
    character_dynamic: string
    underlying_tension: string
    format_participation: string
    editing_contribution: string
    audience_surrogate: string
  }
  
  // The complete interpretation (result of deep reasoning)
  correct_interpretation: string
  
  // What the model should learn from this
  key_teaching: string
  
  // Tags for retrieval
  tags: string[]
  humor_types: string[]
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

/**
 * Build enhanced humor prompt section with deep reasoning chain
 */
export function buildDeepHumorPromptSection(): string {
  return `
${DEEP_REASONING_CHAIN}

Then complete the standard humor analysis, but ensure your "humorMechanism" 
reflects the deep reasoning above, not just a surface label.
`
}

/**
 * Build few-shot examples that MODEL the deep reasoning process
 */
export function buildDeepReasoningExamples(examples: DeepReasoningExample[]): string {
  if (examples.length === 0) return ''
  
  let prompt = `
═══════════════════════════════════════════════════════════════════════════════
DEEP REASONING EXAMPLES: Study HOW to think about humor
═══════════════════════════════════════════════════════════════════════════════

These examples show the REASONING PROCESS, not just correct answers.
Follow the same thinking pattern for new videos.

`
  
  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i]
    
    prompt += `┌─────────────────────────────────────────────────────────────────────────────
│ EXAMPLE ${i + 1}: ${ex.video_summary.slice(0, 60)}...
├─────────────────────────────────────────────────────────────────────────────
│ ❌ SHALLOW ANALYSIS (what you might say):
│    ${ex.original_analysis}
│
│ ✅ DEEP REASONING CHAIN:
│    Character Dynamic: ${ex.deep_reasoning.character_dynamic}
│    Underlying Tension: ${ex.deep_reasoning.underlying_tension}
│    Format Participation: ${ex.deep_reasoning.format_participation}
│    Editing Contribution: ${ex.deep_reasoning.editing_contribution}
│    Audience Surrogate: ${ex.deep_reasoning.audience_surrogate}
│
│ ✅ RESULTING INTERPRETATION:
│    ${ex.correct_interpretation.split('\n').slice(0, 3).join('\n│    ')}
│
│ 🎓 KEY TEACHING:
│    ${ex.key_teaching}
└─────────────────────────────────────────────────────────────────────────────

`
  }
  
  return prompt
}

// =============================================================================
// EXAMPLE DEEP REASONING ENTRIES (seed data)
// =============================================================================

export const SEED_DEEP_REASONING_EXAMPLES: DeepReasoningExample[] = [
  {
    video_summary: "Restaurant skit where different staff members estimate how many lamb chops they'll make. Floor manager (600), waitress (100), owner (1000), chef refuses and says 'I think you should all stfu' (cut mid-word).",
    original_analysis: "Script Humor: contrast - Different people give different estimates showing different perspectives.",
    deep_reasoning: {
      character_dynamic: "Workers who labor (waitress, chef) vs. those who profit (owner, manager) - each person's answer reveals their incentive structure",
      underlying_tension: "Self-interest based on job role: profit-motivated want high numbers, labor-motivated want low numbers",
      format_participation: "The chef BREAKS the established format (role + estimate) by refusing to give a number and opting out entirely",
      editing_contribution: "Mid-word cut on profanity ('stfu') implies without stating, feels authentic and abrupt, matches chef's frustration",
      audience_surrogate: "The chef is the audience surrogate - anyone who's worked service knows the frustration of being the one 'actually doing the work' while others make demands"
    },
    correct_interpretation: "Format subversion + incentive revelation. Each answer exposes self-interest based on job role (profit vs. labor). The chef refuses to participate, breaking the format entirely. The mid-word cut on profanity adds authenticity and creates an abrupt, satisfying ending that matches the character's frustration.",
    key_teaching: "When analyzing humor, don't stop at 'what type' (contrast). Ask: 'What dynamic between characters creates the tension?' and 'Does the format itself become part of the joke?'",
    tags: ['incentive-conflict', 'format-subversion', 'workplace-dynamic', 'rebel-worker', 'mid-word-cut'],
    humor_types: ['format-subversion', 'character-reveal', 'editing-as-punchline']
  },
  {
    video_summary: "POV customer at register, internal voice debates tip amount ('5%... no 10%... maybe 30%'). Reveal: it was the CASHIER speaking out loud. Customer: 'Can you shut up?'",
    original_analysis: "Subversion humor - The voice wasn't the customer's internal monologue.",
    deep_reasoning: {
      character_dynamic: "Power inversion - customer's private decision (tipping) is being influenced by the person who would benefit",
      underlying_tension: "The gap between internal thought (private) and spoken manipulation (public intrusion)",
      format_participation: "POV misdirection - we assume first-person voice = POV character, reveal breaks this assumption and reframes everything",
      editing_contribution: "The held POV shot maintains the illusion until the reveal",
      audience_surrogate: "The customer - everyone has felt the awkwardness of tipping decisions"
    },
    correct_interpretation: "POV misdirection revealing a power dynamic. We think we're in the customer's head (relatable tipping anxiety), but discover the cashier has been speaking out loud, trying to influence the tip. The payoff ('Can you shut up?') is casual boundary-setting that resolves the tension.",
    key_teaching: "Don't just identify 'subversion' - explain WHAT was subverted. Here it's the assumption that POV = whose thoughts we hear.",
    tags: ['pov-misdirection', 'power-dynamic', 'tipping-anxiety', 'boundary-setting'],
    humor_types: ['subversion', 'reveal', 'relatable']
  },
  {
    video_summary: "Manager says 'use your heads' to staff. Cut to workers literally using their physical heads to clean windows, sweep floors, etc.",
    original_analysis: "Wordplay humor - Literal interpretation of the phrase 'use your head'.",
    deep_reasoning: {
      character_dynamic: "Authority (manager using clichés) vs. Malicious compliance (workers deliberately misunderstanding)",
      underlying_tension: "Empty management-speak vs. workers treating meaningless phrases as meaningless",
      format_participation: "Each scene escalates the absurdity of literal interpretation",
      editing_contribution: "Quick cuts between different absurd applications build the joke through repetition with variation",
      audience_surrogate: "The workers - anyone who's been told platitudes by management understands the impulse to mock them"
    },
    correct_interpretation: "Malicious compliance comedy. Workers deliberately misinterpret a management cliché as literal instruction. Each scene escalates the absurdity. The subtext is workplace resistance - reflecting back the meaninglessness of empty management-speak.",
    key_teaching: "Look for subtext. This isn't just wordplay - it's worker solidarity disguised as compliance.",
    tags: ['malicious-compliance', 'workplace-resistance', 'escalation', 'management-cliches'],
    humor_types: ['wordplay', 'absurdist', 'escalation', 'subversive']
  }
]
