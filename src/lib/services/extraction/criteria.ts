/**
 * Criteria Extraction Service
 * 
 * Uses LLM to extract structured criteria from natural language notes
 * Learns user's vocabulary and evaluation patterns over time
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExtractedCriteria {
  // Practical utility dimensions
  replicability?: number;          // 0-1: Can others copy this concept?
  production_barrier?: number;     // 0-1: High = needs expensive production
  acting_barrier?: number;         // 0-1: High = needs skilled actors
  transferability?: number;        // 0-1: Works for different businesses?
  context_dependency?: number;     // 0-1: High = relies on memes/trends/persona
  
  // Content quality dimensions
  emotional_resonance?: number;    // 0-1: Charming, amusing, engaging
  humor_style?: string;            // absurdist, situational, physical, wordplay, etc.
  concept_clarity?: number;        // 0-1: How clear is the joke/concept?
  
  // Visual/execution
  visual_appeal?: number;          // 0-1: Aesthetic quality, attractive subjects
  pacing_quality?: number;         // 0-1: Timing, momentum
  
  // Dynamic: any other criteria the model extracts
  [key: string]: number | string | boolean | undefined;
}

export interface ExtractionResult {
  criteria: ExtractedCriteria;
  confidence: number;
  key_insights: string[];
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
  model_used: string;
  extraction_time_ms: number;
}

// Known criteria with descriptions (grows over time)
const KNOWN_CRITERIA = {
  replicability: 'How easily can other restaurateurs/businesses copy this concept? Low = hard to replicate, High = easy to copy',
  production_barrier: 'Does it require high production value (editing, multiple cameras, special effects)? High = expensive/complex',
  acting_barrier: 'Does it require skilled acting or performance? High = needs talent, Low = anyone can do it',
  transferability: 'Does the concept work for different food types, business types? High = universal, Low = specific',
  context_dependency: 'Does it rely on trends, memes, inside jokes, or specific persona? High = context-dependent',
  emotional_resonance: 'Does it feel charming, amusing, endearing, engaging? High = emotionally impactful',
  humor_style: 'Type of humor: absurdist, situational, physical, wordplay, satire, observational, etc.',
  concept_clarity: 'How clear and understandable is the joke/concept? High = immediately gets it',
  visual_appeal: 'Aesthetic quality, attractive subjects, visual interest',
  pacing_quality: 'Timing, momentum, no dead air, good rhythm',
};

/**
 * Extract structured criteria from natural language notes
 */
export async function extractCriteria(
  notes: string,
  overallScore?: number,
  additionalContext?: string
): Promise<ExtractionResult> {
  const startTime = Date.now();
  
  const systemPrompt = `You are an expert at analyzing video content evaluations. 
Your job is to extract structured criteria from a user's natural language notes about a video.

The user is evaluating short-form videos (TikTok/YouTube) for their PRACTICAL UTILITY - 
specifically whether they can recommend these videos to other restaurateurs as templates to copy.

KNOWN CRITERIA (extract these when mentioned):
${Object.entries(KNOWN_CRITERIA).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

IMPORTANT:
1. Extract ONLY criteria that are actually mentioned or clearly implied in the notes
2. Use 0-1 scale for numeric values (0 = low/none, 1 = high/strong)
3. If a criterion is mentioned negatively, score it appropriately (e.g., "hard to replicate" = replicability: 0.2-0.3)
4. Extract any NEW criteria not in the known list if the user mentions something novel
5. Identify the overall sentiment and key insights

Respond with valid JSON only.`;

  const userPrompt = `Analyze these notes and extract structured criteria:

NOTES: "${notes}"
${overallScore !== undefined ? `\nUSER'S OVERALL SCORE: ${overallScore}` : ''}
${additionalContext ? `\nADDITIONAL CONTEXT: ${additionalContext}` : ''}

Return JSON in this format:
{
  "criteria": {
    "replicability": <0-1 or null if not mentioned>,
    "production_barrier": <0-1 or null>,
    "acting_barrier": <0-1 or null>,
    "transferability": <0-1 or null>,
    "context_dependency": <0-1 or null>,
    "emotional_resonance": <0-1 or null>,
    "humor_style": "<string or null>",
    "concept_clarity": <0-1 or null>,
    "visual_appeal": <0-1 or null>,
    "pacing_quality": <0-1 or null>,
    // Add any other criteria you detect...
  },
  "confidence": <0-1 overall confidence in extraction>,
  "key_insights": ["insight1", "insight2"],
  "sentiment": "positive" | "negative" | "mixed" | "neutral"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,  // Lower temperature for consistent extraction
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from model');
    }

    const parsed = JSON.parse(content);
    
    // Clean up null values
    const cleanedCriteria: ExtractedCriteria = {};
    for (const [key, value] of Object.entries(parsed.criteria || {})) {
      if (value !== null && value !== undefined) {
        cleanedCriteria[key] = value as number | string | boolean;
      }
    }

    return {
      criteria: cleanedCriteria,
      confidence: parsed.confidence || 0.7,
      key_insights: parsed.key_insights || [],
      sentiment: parsed.sentiment || 'neutral',
      model_used: 'gpt-4o',
      extraction_time_ms: Date.now() - startTime,
    };
    
  } catch (error) {
    console.error('Criteria extraction failed:', error);
    
    // Fallback: basic keyword extraction
    return fallbackExtraction(notes, startTime);
  }
}

/**
 * Fallback extraction using keyword matching
 */
function fallbackExtraction(notes: string, startTime: number): ExtractionResult {
  const lower = notes.toLowerCase();
  const criteria: ExtractedCriteria = {};
  
  // Simple keyword matching
  if (lower.includes('replicate') || lower.includes('copy')) {
    criteria.replicability = lower.includes('hard') || lower.includes('difficult') ? 0.3 : 0.7;
  }
  if (lower.includes('production') || lower.includes('budget') || lower.includes('editing')) {
    criteria.production_barrier = lower.includes('high') || lower.includes('expensive') ? 0.8 : 0.4;
  }
  if (lower.includes('acting') || lower.includes('actor') || lower.includes('performance')) {
    criteria.acting_barrier = lower.includes('require') || lower.includes('need') ? 0.7 : 0.4;
  }
  if (lower.includes('absurdist') || lower.includes('absurd')) {
    criteria.humor_style = 'absurdist';
  }
  if (lower.includes('charming') || lower.includes('amusing') || lower.includes('engaging')) {
    criteria.emotional_resonance = 0.7;
  }
  if (lower.includes('meme') || lower.includes('trend') || lower.includes('inside joke')) {
    criteria.context_dependency = 0.7;
  }
  
  return {
    criteria,
    confidence: 0.4,  // Low confidence for fallback
    key_insights: ['Extracted using keyword fallback'],
    sentiment: 'neutral',
    model_used: 'keyword-fallback',
    extraction_time_ms: Date.now() - startTime,
  };
}

/**
 * Batch extract criteria for multiple ratings (for backfill)
 */
export async function batchExtractCriteria(
  ratings: Array<{ id: string; notes: string; overall_score?: number }>
): Promise<Map<string, ExtractionResult>> {
  const results = new Map<string, ExtractionResult>();
  
  // Process in parallel with rate limiting
  const batchSize = 5;
  for (let i = 0; i < ratings.length; i += batchSize) {
    const batch = ratings.slice(i, i + batchSize);
    const promises = batch.map(async (rating) => {
      const result = await extractCriteria(rating.notes, rating.overall_score);
      return { id: rating.id, result };
    });
    
    const batchResults = await Promise.all(promises);
    for (const { id, result } of batchResults) {
      results.set(id, result);
    }
    
    // Rate limiting delay
    if (i + batchSize < ratings.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return results;
}

/**
 * Get extraction prompt for a specific domain (customizable)
 */
export function getExtractionPromptForDomain(domain: string): string {
  const domainPrompts: Record<string, string> = {
    restaurant: `The user evaluates videos for restaurateurs who want to create similar content. 
Key concerns: Can it be copied? What's the execution barrier? Does it require special skills or budget?`,
    
    general: `The user evaluates short-form videos for general content quality and engagement potential.`,
    
    marketing: `The user evaluates videos for marketing effectiveness, brand alignment, and conversion potential.`,
  };
  
  return domainPrompts[domain] || domainPrompts.general;
}
