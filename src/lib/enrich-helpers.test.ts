/**
 * Tests for enrich-helpers.ts (Phase 47 — ingest metadata v1 contract)
 *
 * Run with: npm test
 * Requires: tsx (added to devDependencies in Phase 47)
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFallback,
  mergeToolCall,
  deriveScriptMode,
  deriveSetupComplexity,
  deriveSkillRequired,
  clampEnum,
  clampEnumArray,
  dedupeStringArray,
  DIFFICULTY_VALUES,
  BUSINESS_TYPE_VALUES,
  SCRIPT_MODE_VALUES,
  SETUP_COMPLEXITY_VALUES,
  SKILL_REQUIRED_VALUES,
  SETTING_VALUES,
} from './enrich-helpers.js'

// ── Contract: removed fields ──────────────────────────────────────────────────

describe('contract: removed fields', () => {
  it('buildFallback does NOT return trendLevel', () => {
    const result = buildFallback({})
    assert.ok(!('trendLevel' in result), 'trendLevel must not be present')
  })

  it('buildFallback does NOT return estimatedBudget', () => {
    const result = buildFallback({})
    assert.ok(!('estimatedBudget' in result), 'estimatedBudget must not be present')
  })

  it('mergeToolCall does NOT return trendLevel', () => {
    const fallback = buildFallback({})
    const result = mergeToolCall({ trendLevel: 5, estimatedBudget: 'high' }, fallback)
    assert.ok(!('trendLevel' in result), 'trendLevel must not be present after merge')
    assert.ok(!('estimatedBudget' in result), 'estimatedBudget must not be present after merge')
  })
})

// ── Contract: new objective fields ───────────────────────────────────────────

describe('contract: new objective fields present', () => {
  it('buildFallback returns script_mode', () => {
    const result = buildFallback({})
    assert.ok('script_mode' in result)
    assert.ok((SCRIPT_MODE_VALUES as readonly string[]).includes(result.script_mode),
      `script_mode "${result.script_mode}" not in allowed values`)
  })

  it('buildFallback returns setup_complexity', () => {
    const result = buildFallback({})
    assert.ok('setup_complexity' in result)
    assert.ok((SETUP_COMPLEXITY_VALUES as readonly string[]).includes(result.setup_complexity))
  })

  it('buildFallback returns skill_required', () => {
    const result = buildFallback({})
    assert.ok('skill_required' in result)
    assert.ok((SKILL_REQUIRED_VALUES as readonly string[]).includes(result.skill_required))
  })

  it('buildFallback returns setting', () => {
    const result = buildFallback({})
    assert.ok('setting' in result)
    assert.ok((SETTING_VALUES as readonly string[]).includes(result.setting))
  })
})

// ── Contract: businessTypes max 5 ────────────────────────────────────────────

describe('businessTypes: 1–5 items', () => {
  it('mergeToolCall accepts up to 5 businessTypes', () => {
    const fallback = buildFallback({})
    const result = mergeToolCall({
      businessTypes: ['bar', 'restaurang', 'cafe', 'bistro', 'hotell'],
    }, fallback)
    assert.equal(result.businessTypes.length, 5)
  })

  it('mergeToolCall clamps at 5 businessTypes', () => {
    const fallback = buildFallback({})
    const result = mergeToolCall({
      businessTypes: ['bar', 'restaurang', 'cafe', 'bistro', 'hotell', 'nattklubb', 'bageri'],
    }, fallback)
    assert.equal(result.businessTypes.length, 5)
  })

  it('mergeToolCall rejects invalid businessType values', () => {
    const fallback = buildFallback({})
    const result = mergeToolCall({
      businessTypes: ['bar', 'pizzeria', 'restaurang'],
    }, fallback)
    assert.deepEqual(result.businessTypes, ['bar', 'restaurang'])
  })
})

// ── deriveScriptMode ──────────────────────────────────────────────────────────

describe('deriveScriptMode', () => {
  it('long transcript → long_dialogue', () => {
    const transcript = 'A'.repeat(201)
    assert.equal(deriveScriptMode(transcript, false, []), 'long_dialogue')
  })

  it('short transcript → short_dialogue', () => {
    assert.equal(deriveScriptMode('Välkommen hit!', false, []), 'short_dialogue')
  })

  it('voiceover with no transcript → short_dialogue', () => {
    assert.equal(deriveScriptMode('', true, []), 'short_dialogue')
  })

  it('text overlays, no transcript, no voice → text_overlay', () => {
    assert.equal(deriveScriptMode('', false, ['POV: dag 1', 'dag 2']), 'text_overlay')
  })

  it('no signals at all → visual_only', () => {
    assert.equal(deriveScriptMode('', false, []), 'visual_only')
  })
})

// ── deriveSetupComplexity ─────────────────────────────────────────────────────

describe('deriveSetupComplexity', () => {
  it('low resource, high score → point_and_shoot', () => {
    assert.equal(deriveSetupComplexity('low', 9), 'point_and_shoot')
  })

  it('high score (≥8) → point_and_shoot regardless of resource', () => {
    assert.equal(deriveSetupComplexity('medium', 8), 'point_and_shoot')
  })

  it('medium resource, mid score → basic_tripod', () => {
    assert.equal(deriveSetupComplexity('medium', 5), 'basic_tripod')
  })

  it('high resource → multi_location', () => {
    assert.equal(deriveSetupComplexity('high', 5), 'multi_location')
  })

  it('very low score (≤1) → elaborate_staging', () => {
    assert.equal(deriveSetupComplexity('medium', 1), 'elaborate_staging')
  })
})

// ── deriveSkillRequired ───────────────────────────────────────────────────────

describe('deriveSkillRequired', () => {
  it('performative humor (deadpan) → acting_required', () => {
    assert.equal(deriveSkillRequired('', false, true, 'deadpan'), 'acting_required')
  })

  it('general humor, no transcript → comfortable_on_camera', () => {
    assert.equal(deriveSkillRequired('', false, true, 'contrast'), 'comfortable_on_camera')
  })

  it('long transcript, no humor → comfortable_on_camera', () => {
    assert.equal(deriveSkillRequired('Det här är ett manus med tillräckligt innehåll', false, false, ''), 'comfortable_on_camera')
  })

  it('no signals → anyone', () => {
    assert.equal(deriveSkillRequired('', false, false, ''), 'anyone')
  })
})

// ── buildFallback: empty/minimal input ───────────────────────────────────────

describe('buildFallback: minimal/empty input', () => {
  it('returns valid JSON without throwing on empty object', () => {
    assert.doesNotThrow(() => buildFallback({}))
  })

  it('headline_sv has sensible default when no data', () => {
    const result = buildFallback({})
    assert.ok(typeof result.headline_sv === 'string')
    assert.ok(result.headline_sv.length > 0)
  })

  it('businessTypes defaults to ["restaurang"]', () => {
    const result = buildFallback({})
    assert.deepEqual(result.businessTypes, ['restaurang'])
  })

  it('market defaults to SE', () => {
    const result = buildFallback({})
    assert.equal(result.market, 'SE')
  })

  it('all enum fields are valid', () => {
    const result = buildFallback({})
    assert.ok((DIFFICULTY_VALUES as readonly string[]).includes(result.difficulty))
    assert.ok((SCRIPT_MODE_VALUES as readonly string[]).includes(result.script_mode))
    assert.ok((SETUP_COMPLEXITY_VALUES as readonly string[]).includes(result.setup_complexity))
    assert.ok((SKILL_REQUIRED_VALUES as readonly string[]).includes(result.skill_required))
    assert.ok((SETTING_VALUES as readonly string[]).includes(result.setting))
  })
})

// ── clampEnum / dedupeStringArray ────────────────────────────────────────────

describe('clampEnum', () => {
  it('accepts valid value', () => {
    assert.equal(clampEnum('easy', DIFFICULTY_VALUES, 'medium'), 'easy')
  })

  it('falls back for invalid value', () => {
    assert.equal(clampEnum('impossible', DIFFICULTY_VALUES, 'medium'), 'medium')
  })

  it('falls back for non-string', () => {
    assert.equal(clampEnum(42, DIFFICULTY_VALUES, 'easy'), 'easy')
  })
})

describe('dedupeStringArray', () => {
  it('deduplicates case-insensitively', () => {
    const result = dedupeStringArray(['Foo', 'foo', 'bar'], 10)
    assert.deepEqual(result, ['Foo', 'bar'])
  })

  it('respects maxLen', () => {
    const result = dedupeStringArray(['a', 'b', 'c', 'd'], 2)
    assert.equal(result.length, 2)
  })

  it('returns empty array for non-array input', () => {
    assert.deepEqual(dedupeStringArray(null, 5), [])
    assert.deepEqual(dedupeStringArray('string', 5), [])
  })
})

// ── mergeToolCall: all new fields ────────────────────────────────────────────

describe('mergeToolCall: new objective fields', () => {
  it('accepts valid script_mode from AI', () => {
    const fallback = buildFallback({})
    const result = mergeToolCall({ script_mode: 'text_overlay' }, fallback)
    assert.equal(result.script_mode, 'text_overlay')
  })

  it('falls back for invalid script_mode', () => {
    const fallback = buildFallback({})
    fallback.script_mode = 'none'
    const result = mergeToolCall({ script_mode: 'unknown_mode' }, fallback)
    assert.equal(result.script_mode, 'none')
  })

  it('accepts valid setup_complexity from AI', () => {
    const fallback = buildFallback({})
    const result = mergeToolCall({ setup_complexity: 'elaborate_staging' }, fallback)
    assert.equal(result.setup_complexity, 'elaborate_staging')
  })

  it('accepts valid skill_required from AI', () => {
    const fallback = buildFallback({})
    const result = mergeToolCall({ skill_required: 'acting_required' }, fallback)
    assert.equal(result.skill_required, 'acting_required')
  })

  it('accepts valid setting from AI', () => {
    const fallback = buildFallback({})
    const result = mergeToolCall({ setting: 'specific_setting_needed' }, fallback)
    assert.equal(result.setting, 'specific_setting_needed')
  })
})
