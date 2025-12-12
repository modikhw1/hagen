import { z } from 'zod'

// =============================================================================
// Schema v1: Hospitality Character + Brand Completeness
// =============================================================================

const Score0to1 = z.number().min(0).max(1)
const OneToTen = z.number().min(1).max(10)

export const VideoBrandEvidenceV1Schema = z
  .object({
    type: z.enum(['quote', 'ocr', 'visual', 'audio', 'caption', 'thumbnail', 'bio', 'other']),
    start_s: z.number().min(0).nullable().optional(),
    end_s: z.number().min(0).nullable().optional(),
    text: z.string(),
    supports: z.array(z.string()).default([])
  })
  .strict()

export const VideoBrandObservationV1Schema = z
  .object({
    schema_version: z.literal(1),
    video: z
      .object({
        video_id: z.string(),
        platform: z.string(),
        video_url: z.string().optional(),
        gcs_uri: z.string().optional(),
        detected_language: z.string().optional()
      })
      .strict(),

    signals: z
      .object({
        personality: z
          .object({
            energy_1_10: OneToTen.nullable().optional(),
            formality_1_10: OneToTen.nullable().optional(),
            warmth_1_10: OneToTen.nullable().optional(),
            confidence_1_10: OneToTen.nullable().optional(),
            traits_observed: z.array(z.string()).optional(),
            social_positioning: z
              .object({
                accessibility: z.enum(['everyman', 'aspirational', 'exclusive', 'elite']).nullable().optional(),
                authority_claims: z.boolean().nullable().optional(),
                peer_relationship: z.boolean().nullable().optional()
              })
              .strict()
              .optional()
          })
          .strict()
          .optional(),

        statement: z
          .object({
            primary_intent: z
              .enum(['inspire', 'entertain', 'inform', 'challenge', 'comfort', 'provoke', 'connect', 'sell'])
              .nullable()
              .optional(),
            subtext: z.array(z.string()).optional(),
            apparent_audience: z.string().nullable().optional(),
            self_seriousness_1_10: OneToTen.nullable().optional(),
            opinion_stance: z
              .object({
                makes_opinions: z.boolean().nullable().optional(),
                edginess: z.enum(['safe', 'mild', 'moderate', 'edgy', 'provocative']).nullable().optional(),
                defended: z.boolean().nullable().optional()
              })
              .strict()
              .optional()
          })
          .strict()
          .optional(),

        execution: z
          .object({
            intentionality_1_10: OneToTen.nullable().optional(),
            production_investment_1_10: OneToTen.nullable().optional(),
            effortlessness_1_10: OneToTen.nullable().optional(),
            social_permission_1_10: OneToTen.nullable().optional(),
            has_repeatable_format: z.boolean().nullable().optional(),
            format_name_if_any: z.string().nullable().optional()
          })
          .strict()
          .optional(),

        hospitality: z
          .object({
            business_type: z.enum(['restaurant', 'cafe', 'bar', 'hotel', 'other']).nullable().optional(),
            vibe: z.array(z.string()).optional(),
            occasion: z.array(z.string()).optional(),
            price_tier: z.enum(['budget', 'mid', 'premium', 'luxury', 'unknown']).nullable().optional(),
            service_ethos: z.array(z.string()).optional(),
            signature_items_or_offers: z.array(z.string()).optional(),
            locality_markers: z.array(z.string()).optional(),
            tourist_orientation: z.enum(['locals', 'tourists', 'mixed', 'unknown']).nullable().optional()
          })
          .strict()
          .optional(),

        humor: z
          .object({
            present: z.boolean().nullable().optional(),
            humor_types: z.array(z.string()).optional(),
            target: z
              .enum([
                'self',
                'customer',
                'employee',
                'industry',
                'competitor',
                'situation',
                'product',
                'none'
              ])
              .nullable()
              .optional(),
            age_code: z.enum(['younger', 'older', 'balanced', 'unknown']).nullable().optional(),
            meanness_risk: z.enum(['low', 'medium', 'high', 'unknown']).nullable().optional()
          })
          .strict()
          .optional(),

        conversion: z
          .object({
            cta_types: z
              .array(
                z.enum([
                  'follow_for_series',
                  'comment_prompt',
                  'visit_in_store',
                  'book_now',
                  'order_online',
                  'link_in_bio',
                  'dm_us',
                  'other'
                ])
              )
              .optional(),
            visit_intent_strength_0_1: Score0to1.nullable().optional()
          })
          .strict()
          .optional(),

        coherence: z
          .object({
            personality_message_alignment_0_1: Score0to1.nullable().optional(),
            contradictions: z.array(z.string()).optional()
          })
          .strict()
          .optional()
      })
      .strict(),

    scores: z
      .object({
        brand_intent_signal_0_1: Score0to1.nullable().optional(),
        execution_coherence_0_1: Score0to1.nullable().optional(),
        distinctiveness_0_1: Score0to1.nullable().optional(),
        trust_signals_0_1: Score0to1.nullable().optional()
      })
      .strict()
      .optional(),

    evidence: z.array(VideoBrandEvidenceV1Schema).default([]),

    confidence: z
      .object({
        overall_0_1: Score0to1.nullable().optional(),
        notes: z.string().optional()
      })
      .strict()
      .optional(),

    uncertainties: z.array(z.string()).default([])
  })
  .strict()

export type VideoBrandObservationV1 = z.infer<typeof VideoBrandObservationV1Schema>

export function parseVideoBrandObservationV1(input: unknown): VideoBrandObservationV1 {
  return VideoBrandObservationV1Schema.parse(input)
}
