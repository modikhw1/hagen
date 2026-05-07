/**
 * POST /api/studio/concepts/enrich
 *
 * Studio ingest step 2 — given the raw backend analysis object produced by
 * /api/studio/concepts/analyze, call Gemini with function-calling to generate
 * Swedish-language concept metadata for LeTrend's concept library.
 *
 * Contract (ingest metadata v1, Phase 47):
 * - Returns objective fields: script_mode, setup_complexity, skill_required, setting
 * - Does NOT return trendLevel (AI trend scores are not surfaced to CMs)
 * - Does NOT return estimatedBudget (out of scope for AI classification)
 * - businessTypes: 1–5 items
 *
 * Request body: { backend_data: Record<string, unknown> }
 * Response:     { overrides: EnrichedConcept }
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  GoogleGenerativeAI,
  SchemaType,
  type Tool,
  type FunctionDeclaration,
} from '@google/generative-ai'
import {
  DIFFICULTY_VALUES,
  FILM_TIME_VALUES,
  PEOPLE_VALUES,
  MECHANISM_VALUES,
  MARKET_VALUES,
  SCRIPT_MODE_VALUES,
  SETUP_COMPLEXITY_VALUES,
  SKILL_REQUIRED_VALUES,
  SETTING_VALUES,
  BUSINESS_TYPE_VALUES,
  buildFallback,
  mergeToolCall,
} from '@/lib/enrich-helpers'

export const maxDuration = 45

// ── System prompt ─────────────────────────────────────────────────────────────

const ENRICH_CONCEPT_SYSTEM_PROMPT = `Du är en innehållsstrateg specialiserad på svenska restauranger, barer, caféer och hotell.

Du får råanalysdata för ett TikTok/Instagram-videokoncept och ska returnera strukturerad metadata för LeTrends konceptbibliotek. Dina svar är FÖRSLAG — en Content Manager (CM) granskar och bekräftar alla objektiva fält innan de sparas.

SCRIPT-NOTATION — markera varje rad i script_sv med rätt prefix:
- [Dialog]: tal/replik som sägs av en person
- [Textoverlay]: text som visas på skärmen (text card, caption, overlay)
- [Visuell]: rent visuell scen utan tal eller textoverlay
Kombinera typer när de förekommer i samma video.

REGLER FÖR TEXTFÄLT:
- All text ska vara på svenska.
- headline_sv: max 60 tecken, konkret och säljbar, inte generisk.
- description_sv: 1-2 meningar om vad kunden faktiskt ska filma.
- whyItWorks_sv: 2-3 meningar om varför formatet engagerar och varför det passar hospitality.
- script_sv: använd befintligt transkript om det finns, annars skriv ett föreslaget manus med rätt notation.
- productionNotes_sv: 3-5 tydliga steg som går att följa i produktion.
- whyItFits_sv: 2-3 korta argument som hjälper en CM att motivera konceptet till kund.

OBJEKTIVA KLASSIFICERINGSFÄLT (CM granskar dessa):
- difficulty: easy (enkel, ingen erfarenhet krävs), medium (viss erfarenhet), advanced (kräver planering och rutin).
- filmTime: uppskattad total produktionstid inklusive setup — 5min, 10min, 15min, 20min, 30min, 1hr eller 1hr_plus.
- peopleNeeded: solo (en person), duo (två), small_team (3-5), team (6+).
- mechanism: det komiska/dramaturgiska greppet — subversion, contrast, recognition, dark, escalation, deadpan eller absurdism. Välj recognition om humor saknas.
- market: primär marknad — SE, US eller UK.
- businessTypes: välj 1-5 av [bar, restaurang, cafe, bistro, hotell, foodtruck, nattklubb, bageri]. Var specifik — välj de typer konceptet faktiskt passar bäst för.
- hasScript: true om konceptet kräver tydliga repliker eller manus.

SCRIPT MODE — hur mycket scripted content kräver konceptet?
- none: inget manus eller text behövs (bakgrundsmusik, ambient, ren visuell stämning)
- text_overlay: konceptet bärs primärt av text på skärmen (POV-captions, text cards, textoverlay)
- short_dialogue: korta repliker, snabba utbyten, kort voiceover (under 30 sekunder script)
- long_dialogue: längre monolog, dialog med manus, utförlig voiceover
- visual_only: bärs helt visuellt — ingen röst, inga textoverlay, stämning och bild berättar

SETUP COMPLEXITY — hur mycket produktionssetup krävs?
- point_and_shoot: ta upp telefonen och filma direkt, noll setup
- basic_tripod: stabil kameraposition och enkel inramning räcker
- multi_location: flera platser eller setups inom ett och samma pass
- elaborate_staging: komplex scensättning, belysning eller avancerad execution

SKILL REQUIRED — vilken lägsta kompetens krävs?
- anyone: ingen speciell färdighet
- comfortable_on_camera: personen behöver vara bekväm att filmas
- acting_required: kräver att man spelar en roll eller levererar repliker övertygande
- professional: professionell kompetens eller erfarenhet krävs

SETTING — hur platsspecifikt är konceptet?
- any_venue: fungerar i vilken hospitality-lokal som helst
- similar_venue_type: kräver liknande typ av lokal (t.ex. vilken bar som helst, vilket café som helst)
- specific_setting_needed: kräver en specifik miljö (t.ex. rooftop, öppet kök, vinkällare)

VIKTIGT:
- Returnera INTE budget-uppskattningar eller trendscore — dessa hanteras inte av AI.
- Fokusera på hospitality-nischen: restaurang, bar, café, hotell är primärmarknaden.
- Var konservativ med script_mode — välj lägre komplexitetsnivå om signalen är oklar.`

// ── Tool definition ───────────────────────────────────────────────────────────

const enrichFunctionDeclaration: FunctionDeclaration = {
  name: 'enrich_concept',
  description: 'Return structured concept metadata for the LeTrend concept library',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      headline_sv:        { type: SchemaType.STRING },
      description_sv:     { type: SchemaType.STRING },
      whyItWorks_sv:      { type: SchemaType.STRING },
      script_sv:          { type: SchemaType.STRING },
      productionNotes_sv: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      whyItFits_sv:       { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      difficulty:         { type: SchemaType.STRING, enum: [...DIFFICULTY_VALUES] },
      filmTime:           { type: SchemaType.STRING, enum: [...FILM_TIME_VALUES] },
      peopleNeeded:       { type: SchemaType.STRING, enum: [...PEOPLE_VALUES] },
      mechanism:          { type: SchemaType.STRING, enum: [...MECHANISM_VALUES] },
      market:             { type: SchemaType.STRING, enum: [...MARKET_VALUES] },
      script_mode:        { type: SchemaType.STRING, enum: [...SCRIPT_MODE_VALUES] },
      setup_complexity:   { type: SchemaType.STRING, enum: [...SETUP_COMPLEXITY_VALUES] },
      skill_required:     { type: SchemaType.STRING, enum: [...SKILL_REQUIRED_VALUES] },
      setting:            { type: SchemaType.STRING, enum: [...SETTING_VALUES] },
      businessTypes:      { type: SchemaType.ARRAY, items: { type: SchemaType.STRING, enum: [...BUSINESS_TYPE_VALUES] } },
      hasScript:          { type: SchemaType.BOOLEAN },
    },
    required: [
      'headline_sv', 'description_sv', 'whyItWorks_sv', 'script_sv',
      'productionNotes_sv', 'whyItFits_sv', 'difficulty', 'filmTime',
      'peopleNeeded', 'mechanism', 'market',
      'script_mode', 'setup_complexity', 'skill_required', 'setting',
      'businessTypes', 'hasScript',
    ],
  } as unknown as FunctionDeclaration['parameters'],
}

const ENRICH_TOOL: Tool = { functionDeclarations: [enrichFunctionDeclaration] }

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rawBody = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const backendData = rawBody['backend_data']

    if (!backendData || typeof backendData !== 'object' || Array.isArray(backendData)) {
      return NextResponse.json(
        { error: 'validation_error', message: 'backend_data is required and must be an object' },
        { status: 400 },
      )
    }

    const data = backendData as Record<string, unknown>
    const fallback = buildFallback(data)

    if (!process.env.GEMINI_API_KEY) {
      console.warn('[studio/enrich] GEMINI_API_KEY not set — returning heuristic fallback')
      return NextResponse.json({ overrides: fallback })
    }

    // ── Build user prompt ─────────────────────────────────────────────────────
    const getStr = (obj: unknown, key: string): string => {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const v = (obj as Record<string, unknown>)[key]
        return typeof v === 'string' ? v : ''
      }
      return ''
    }
    const getObj2 = (obj: unknown, key: string): Record<string, unknown> => {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const v = (obj as Record<string, unknown>)[key]
        return v && typeof v === 'object' && !Array.isArray(v)
          ? (v as Record<string, unknown>)
          : {}
      }
      return {}
    }

    const script       = getObj2(data, 'script')
    const content      = getObj2(data, 'content')
    const audio        = getObj2(data, 'audio')
    const visual       = getObj2(data, 'visual')
    const technical    = getObj2(data, 'technical')
    const replicability = getObj2(script, 'replicability')
    const humor        = getObj2(script, 'humor')
    const structureObj = getObj2(script, 'structure')

    const reqElements = Array.isArray(replicability['requiredElements'])
      ? (replicability['requiredElements'] as unknown[])
          .filter((x): x is string => typeof x === 'string')
          .join(', ')
      : ''

    const textOverlays = Array.isArray(visual['textOverlays'])
      ? (visual['textOverlays'] as unknown[])
          .filter((x): x is string => typeof x === 'string')
          .join(', ')
      : '(inga)'

    const humorInfo = humor['isHumorous'] === true
      ? `Ja – ${getStr(humor, 'humorType')}, ${getStr(humor, 'humorMechanism')}`
      : 'Nej'

    const userPrompt = [
      'Analysdata:',
      '',
      `Konceptkärna: ${getStr(script, 'conceptCore') || getStr(content, 'keyMessage') || '(saknas)'}`,
      `Nyckelbudskap: ${getStr(content, 'keyMessage')}`,
      `Format: ${getStr(content, 'format')}`,
      `Målgrupp: ${getStr(content, 'targetAudience')}`,
      `Humor: ${humorInfo}`,
      `Transkript: ${getStr(script, 'transcript').slice(0, 600) || '(saknas)'}`,
      `Replikbarhet: ${getStr(replicability, 'template')} (score ${replicability['score'] ?? '?'}/10)`,
      `Nödvändiga element: ${reqElements}`,
      `Röst/voiceover: ${audio['hasVoiceover'] === true ? 'Ja' : 'Nej'}`,
      `Textoverlay på skärm: ${textOverlays}`,
      `Tempo/pacing: ${technical['pacing'] ?? ''}/10`,
      `Hook: ${getStr(structureObj, 'hook')}`,
      `Setup: ${getStr(structureObj, 'setup')}`,
      `Payoff: ${getStr(structureObj, 'payoff')}`,
    ].join('\n')

    // ── Call Gemini ───────────────────────────────────────────────────────────
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-001',
      systemInstruction: ENRICH_CONCEPT_SYSTEM_PROMPT,
      tools: [ENRICH_TOOL],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    })

    const result = await model.generateContent(userPrompt)
    const calls  = result.response.functionCalls()
    const call   = calls?.find((c) => c.name === 'enrich_concept')

    const overrides = call?.args
      ? mergeToolCall(call.args as Record<string, unknown>, fallback)
      : (() => {
          console.warn('[studio/enrich] No function call returned — using heuristic fallback')
          return fallback
        })()

    return NextResponse.json({ overrides })
  } catch (err) {
    console.error('[studio/enrich] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'enrich_failed', message }, { status: 500 })
  }
}
