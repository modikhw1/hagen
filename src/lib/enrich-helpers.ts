/**
 * Pure helper functions for /api/studio/concepts/enrich.
 *
 * Extracted here so they can be unit-tested without Next.js dependencies.
 *
 * Contract (ingest metadata v1, Phase 47):
 * - NO trendLevel  — AI trend scores are not surfaced to CMs.
 * - NO estimatedBudget — budget is out of scope for AI classification.
 * - NEW objective fields: script_mode, setup_complexity, skill_required, setting.
 * - businessTypes: 1–5 items (was max 3).
 */

// ── Enumerations ─────────────────────────────────────────────────────────────

export const DIFFICULTY_VALUES = ['easy', 'medium', 'advanced'] as const
export const FILM_TIME_VALUES = [
  '5min', '10min', '15min', '20min', '30min', '1hr', '1hr_plus',
] as const
export const PEOPLE_VALUES = ['solo', 'duo', 'small_team', 'team'] as const
export const MECHANISM_VALUES = [
  'subversion', 'contrast', 'recognition', 'dark', 'escalation', 'deadpan', 'absurdism',
] as const
export const MARKET_VALUES = ['SE', 'US', 'UK'] as const
export const BUSINESS_TYPE_VALUES = [
  'bar', 'restaurang', 'cafe', 'bistro', 'hotell', 'foodtruck', 'nattklubb', 'bageri',
] as const

/**
 * script_mode — what kind of scripted content does the concept require?
 *
 * none            No scripted content needed (ambient, background music)
 * text_overlay    Primarily on-screen text/captions/POV text cards
 * short_dialogue  Short spoken lines, quick exchanges, brief voiceover
 * long_dialogue   Longer monologue, extended dialogue, full script
 * visual_only     Purely visual — no voice, no text overlays
 */
export const SCRIPT_MODE_VALUES = [
  'none', 'text_overlay', 'short_dialogue', 'long_dialogue', 'visual_only',
] as const

/**
 * setup_complexity — how much production setup is required?
 *
 * point_and_shoot   Grab phone and film — no setup needed
 * basic_tripod      Stable camera position, basic framing
 * multi_location    Multiple locations or setups within one shoot
 * elaborate_staging Complex staging, lighting, or advanced execution
 */
export const SETUP_COMPLEXITY_VALUES = [
  'point_and_shoot', 'basic_tripod', 'multi_location', 'elaborate_staging',
] as const

/**
 * skill_required — minimum skill level of the person on camera or producing.
 *
 * anyone               No special skill required
 * comfortable_on_camera Must be okay being filmed, natural presence
 * acting_required      Needs to perform a role or deliver lines convincingly
 * professional         Professional-level skill or experience required
 */
export const SKILL_REQUIRED_VALUES = [
  'anyone', 'comfortable_on_camera', 'acting_required', 'professional',
] as const

/**
 * setting — how venue-specific is the required location?
 *
 * any_venue              Works in any hospitality venue
 * similar_venue_type     Needs a similar type of venue (e.g., any bar, any café)
 * specific_setting_needed Requires a specific setting (e.g., rooftop, open kitchen)
 */
export const SETTING_VALUES = [
  'any_venue', 'similar_venue_type', 'specific_setting_needed',
] as const

// ── Types ────────────────────────────────────────────────────────────────────

export type DifficultyValue     = typeof DIFFICULTY_VALUES[number]
export type FilmTimeValue        = typeof FILM_TIME_VALUES[number]
export type PeopleValue          = typeof PEOPLE_VALUES[number]
export type MechanismValue       = typeof MECHANISM_VALUES[number]
export type MarketValue          = typeof MARKET_VALUES[number]
export type BusinessTypeValue    = typeof BUSINESS_TYPE_VALUES[number]
export type ScriptModeValue      = typeof SCRIPT_MODE_VALUES[number]
export type SetupComplexityValue = typeof SETUP_COMPLEXITY_VALUES[number]
export type SkillRequiredValue   = typeof SKILL_REQUIRED_VALUES[number]
export type SettingValue         = typeof SETTING_VALUES[number]

export interface EnrichedConcept {
  // Subjective / draft fields — AI suggestions, CM edits freely
  headline_sv:       string
  description_sv:    string
  whyItWorks_sv:     string
  script_sv:         string
  productionNotes_sv: string[]
  whyItFits_sv:      string[]

  // Objective classification fields — CM confirms or overrides
  difficulty:        DifficultyValue
  filmTime:          FilmTimeValue
  peopleNeeded:      PeopleValue
  mechanism:         MechanismValue
  market:            MarketValue
  script_mode:       ScriptModeValue
  setup_complexity:  SetupComplexityValue
  skill_required:    SkillRequiredValue
  setting:           SettingValue
  businessTypes:     BusinessTypeValue[]
  hasScript:         boolean
}

// ── Generic helpers ──────────────────────────────────────────────────────────

export function clampEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T[number]
  }
  return fallback
}

export function dedupeStringArray(value: unknown, maxLen: number): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const t = item.trim()
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    result.push(t)
    if (result.length >= maxLen) break
  }
  return result
}

export function clampEnumArray<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  maxLen: number,
): Array<T[number]> {
  if (!Array.isArray(value)) return []
  const result: Array<T[number]> = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const t = item.trim()
    if (!t || seen.has(t) || !(allowed as readonly string[]).includes(t)) continue
    seen.add(t)
    result.push(t as T[number])
    if (result.length >= maxLen) break
  }
  return result
}

function getObj(obj: unknown, key: string): Record<string, unknown> {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const v = (obj as Record<string, unknown>)[key]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return v as Record<string, unknown>
    }
  }
  return {}
}

// ── script_mode derivation ───────────────────────────────────────────────────

/**
 * Derive script_mode conservatively from raw analysis signals.
 *
 * Priority order (most evidence → most conservative):
 *  1. Long transcript (>200 chars trimmed) → long_dialogue
 *  2. Short transcript (20–200 chars) or voiceover without transcript → short_dialogue
 *  3. Text overlays present, no transcript/voice → text_overlay
 *  4. No voice, no overlays, but video clearly exists → visual_only
 *  5. No signal at all → none (most conservative default)
 */
export function deriveScriptMode(
  transcript: string,
  hasVoiceover: boolean,
  textOverlays: string[],
): ScriptModeValue {
  const trimmed = transcript.trim()
  if (trimmed.length > 200) return 'long_dialogue'
  if (trimmed.length >= 20 || (hasVoiceover && trimmed.length > 0)) return 'short_dialogue'
  if (hasVoiceover) return 'short_dialogue'
  if (textOverlays.length > 0) return 'text_overlay'
  // No voice, no overlays — if we have any transcript at all (even brief) it's short_dialogue
  if (trimmed.length > 0) return 'short_dialogue'
  // Truly no scripted signal
  return 'visual_only'
}

// ── setup_complexity derivation ──────────────────────────────────────────────

export function deriveSetupComplexity(
  resourceRequirements: string,
  replicabilityScore: number,
): SetupComplexityValue {
  if (resourceRequirements === 'low' || replicabilityScore >= 8) return 'point_and_shoot'
  if (resourceRequirements === 'high' || replicabilityScore <= 3) return 'multi_location'
  // replicabilityScore < 2 or resource 'very_high' → elaborate_staging
  if (replicabilityScore <= 1) return 'elaborate_staging'
  return 'basic_tripod'
}

// ── skill_required derivation ────────────────────────────────────────────────

export function deriveSkillRequired(
  transcript: string,
  hasVoiceover: boolean,
  isHumorous: boolean,
  humorType: string,
): SkillRequiredValue {
  const performativeHumor = new Set(['dark', 'escalation', 'deadpan', 'absurdism'])
  if (performativeHumor.has(humorType)) return 'acting_required'
  if (isHumorous) return 'comfortable_on_camera'
  if (transcript.trim().length > 50 || hasVoiceover) return 'comfortable_on_camera'
  return 'anyone'
}

// ── buildFallback ────────────────────────────────────────────────────────────

export function buildFallback(data: Record<string, unknown>): EnrichedConcept {
  const script       = getObj(data, 'script')
  const content      = getObj(data, 'content')
  const audio        = getObj(data, 'audio')
  const technical    = getObj(data, 'technical')
  const visual       = getObj(data, 'visual')
  const replicability = getObj(script, 'replicability')
  const humorObj     = getObj(script, 'humor')

  const conceptCore   = typeof script['conceptCore'] === 'string' ? script['conceptCore'] : ''
  const keyMessage    = typeof content['keyMessage'] === 'string' ? content['keyMessage'] : ''
  const transcript    = typeof script['transcript'] === 'string' ? script['transcript'] : ''
  const hasVoiceover  = audio['hasVoiceover'] === true
  const isHumorous    = humorObj['isHumorous'] === true
  const humorType     = typeof humorObj['humorType'] === 'string' ? humorObj['humorType'] : ''

  const textOverlays: string[] = Array.isArray(visual['textOverlays'])
    ? (visual['textOverlays'] as unknown[]).filter((x): x is string => typeof x === 'string')
    : []

  // difficulty ← resourceRequirements
  const resourceReq = typeof replicability['resourceRequirements'] === 'string'
    ? replicability['resourceRequirements'] : 'medium'
  const difficultyMap: Record<string, DifficultyValue> = {
    low: 'easy', medium: 'medium', high: 'advanced',
  }
  const difficulty: DifficultyValue = difficultyMap[resourceReq] ?? 'medium'

  // filmTime ← pacing
  const pacing = typeof technical['pacing'] === 'number' ? technical['pacing'] : 5
  const filmTime: FilmTimeValue = pacing >= 8 ? '5min' : pacing >= 5 ? '10min' : '15min'

  // mechanism ← humor
  const mechMap: Record<string, MechanismValue> = {
    subversion: 'subversion', contrast: 'contrast', recognition: 'recognition',
    dark: 'dark', escalation: 'escalation', deadpan: 'deadpan', absurdism: 'absurdism',
  }
  const mechanism: MechanismValue = mechMap[humorType] ?? (isHumorous ? 'contrast' : 'recognition')

  // peopleNeeded ← actor_count signal
  const actorRaw = getObj(getObj(data, 'schema_v1_signals'), 'replicability')['actor_count']
  const actorMap: Record<string, PeopleValue> = {
    solo: 'solo', duo: 'duo', small_team: 'small_team', large_team: 'team',
  }
  const peopleNeeded: PeopleValue =
    typeof actorRaw === 'string' && actorMap[actorRaw] ? actorMap[actorRaw] : 'solo'

  // New objective fields
  const replicabilityScore = typeof replicability['score'] === 'number'
    ? (replicability['score'] as number) : 5

  const script_mode      = deriveScriptMode(transcript, hasVoiceover, textOverlays)
  const setup_complexity = deriveSetupComplexity(resourceReq, replicabilityScore)
  const skill_required   = deriveSkillRequired(transcript, hasVoiceover, isHumorous, humorType)

  // setting: default similar_venue_type (safest — assumes hospitality venue needed)
  const setting: SettingValue = 'similar_venue_type'

  return {
    headline_sv:        (conceptCore || keyMessage).slice(0, 60) || 'Nytt videokoncept',
    description_sv:     keyMessage.slice(0, 400),
    whyItWorks_sv:      '',
    script_sv:          transcript.slice(0, 4000),
    productionNotes_sv: dedupeStringArray(replicability['requiredElements'], 5),
    whyItFits_sv:       [],
    difficulty,
    filmTime,
    peopleNeeded,
    mechanism,
    market:             'SE',
    script_mode,
    setup_complexity,
    skill_required,
    setting,
    businessTypes:      ['restaurang'],
    hasScript: typeof script['hasScript'] === 'boolean'
      ? (script['hasScript'] as boolean)
      : (hasVoiceover || transcript.trim().length > 20),
  }
}

// ── mergeToolCall ────────────────────────────────────────────────────────────

export function mergeToolCall(
  args: Record<string, unknown>,
  fallback: EnrichedConcept,
): EnrichedConcept {
  const str = (key: string, maxLen: number, fb: string): string => {
    const v = args[key]
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, maxLen) : fb
  }

  const productionNotes = dedupeStringArray(args['productionNotes_sv'], 5)
  const whyItFits       = dedupeStringArray(args['whyItFits_sv'], 4)
  const businessTypes   = clampEnumArray(args['businessTypes'], BUSINESS_TYPE_VALUES, 5)

  return {
    headline_sv:        str('headline_sv', 120, fallback.headline_sv),
    description_sv:     str('description_sv', 400, fallback.description_sv),
    whyItWorks_sv:      str('whyItWorks_sv', 500, fallback.whyItWorks_sv),
    script_sv:          str('script_sv', 4000, fallback.script_sv),
    productionNotes_sv: productionNotes.length ? productionNotes : fallback.productionNotes_sv,
    whyItFits_sv:       whyItFits.length ? whyItFits : fallback.whyItFits_sv,
    difficulty:         clampEnum(args['difficulty'],        DIFFICULTY_VALUES,        fallback.difficulty),
    filmTime:           clampEnum(args['filmTime'],          FILM_TIME_VALUES,         fallback.filmTime),
    peopleNeeded:       clampEnum(args['peopleNeeded'],      PEOPLE_VALUES,            fallback.peopleNeeded),
    mechanism:          clampEnum(args['mechanism'],         MECHANISM_VALUES,         fallback.mechanism),
    market:             clampEnum(args['market'],            MARKET_VALUES,            'SE'),
    script_mode:        clampEnum(args['script_mode'],       SCRIPT_MODE_VALUES,       fallback.script_mode),
    setup_complexity:   clampEnum(args['setup_complexity'],  SETUP_COMPLEXITY_VALUES,  fallback.setup_complexity),
    skill_required:     clampEnum(args['skill_required'],    SKILL_REQUIRED_VALUES,    fallback.skill_required),
    setting:            clampEnum(args['setting'],           SETTING_VALUES,           fallback.setting),
    businessTypes:      businessTypes.length ? businessTypes : fallback.businessTypes,
    hasScript: typeof args['hasScript'] === 'boolean'
      ? (args['hasScript'] as boolean)
      : fallback.hasScript,
  }
}
