/**
 * Video Analysis Learning Service
 * 
 * RAG-based learning system that retrieves relevant annotated examples
 * to inject into Gemini prompts for improved video analysis.
 * 
 * ARCHITECTURE:
 * 1. When a new video is analyzed, we generate an embedding from its metadata/transcript
 * 2. We retrieve similar annotated videos with human corrections
 * 3. We inject these as few-shot examples into the Gemini prompt
 * 4. Gemini learns from YOUR interpretations of similar content
 */

import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/openai/client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// =============================================================================
// TYPES
// =============================================================================

export interface VideoAnalysisExample {
  id: string
  exampleType: 'humor_interpretation' | 'cultural_context' | 'visual_punchline' | 'misdirection' | 'replicability' | 'bad_interpretation'
  videoSummary: string
  geminiInterpretation: string | null
  correctInterpretation: string
  explanation: string
  humorTypeCorrection: {
    original: string
    correct: string
    why: string
  } | null
  culturalContext: string | null
  visualElements: string[]
  tags: string[]
  humorTypes: string[]
  qualityScore: number
  similarity: number
}

export interface SaveExampleInput {
  videoId?: string
  videoUrl?: string
  exampleType: VideoAnalysisExample['exampleType']
  videoSummary: string
  geminiInterpretation?: string
  correctInterpretation: string
  explanation: string
  humorTypeCorrection?: VideoAnalysisExample['humorTypeCorrection']
  culturalContext?: string
  visualElements?: string[]
  tags?: string[]
  humorTypes?: string[]
  industry?: string
  contentFormat?: string
  qualityScore?: number
}

export interface RetrievalOptions {
  exampleTypes?: string[]
  humorTypes?: string[]
  industry?: string
  contentFormat?: string
  limit?: number
  threshold?: number
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Find relevant video analysis examples for RAG injection
 * 
 * @param context - Text describing the video (transcript, summary, metadata)
 * @param options - Filtering options for more targeted retrieval
 * @returns Array of relevant examples ordered by relevance
 */
export async function findRelevantVideoExamples(
  context: string,
  options: RetrievalOptions = {}
): Promise<VideoAnalysisExample[]> {
  const {
    exampleTypes,
    humorTypes,
    industry,
    contentFormat,
    limit = 5,
    threshold = 0.5
  } = options

  try {
    // Generate embedding for the context
    const embedding = await generateEmbedding(context)

    // Call the database function for RAG retrieval
    const { data, error } = await supabase.rpc('find_video_analysis_examples', {
      query_embedding: embedding,
      target_example_types: exampleTypes || null,
      target_humor_types: humorTypes || null,
      target_industry: industry || null,
      target_format: contentFormat || null,
      match_threshold: threshold,
      match_count: limit
    })

    if (error) {
      console.error('Failed to find video analysis examples:', error)
      return []
    }

    // Record usage for retrieved examples (async, don't wait)
    for (const example of data || []) {
      Promise.resolve(supabase.rpc('record_video_example_usage', { example_uuid: example.id }))
        .catch(() => {})
    }

    return (data || []).map((e: any) => ({
      id: e.id,
      exampleType: e.example_type,
      videoSummary: e.video_summary,
      geminiInterpretation: e.gemini_interpretation,
      correctInterpretation: e.correct_interpretation,
      explanation: e.explanation,
      humorTypeCorrection: e.humor_type_correction,
      culturalContext: e.cultural_context,
      visualElements: e.visual_elements || [],
      tags: e.tags || [],
      humorTypes: e.humor_types || [],
      qualityScore: e.quality_score,
      similarity: e.similarity
    }))

  } catch (error) {
    console.error('Error in findRelevantVideoExamples:', error)
    return []
  }
}

/**
 * Build the few-shot learning prompt section from retrieved examples
 * This gets injected into the Gemini prompt to provide context
 */
export function buildFewShotPrompt(examples: VideoAnalysisExample[]): string {
  if (examples.length === 0) {
    return ''
  }

  let prompt = `
---
LEARNING FROM PAST CORRECTIONS:
The following are examples of videos similar to what you're analyzing, with human-verified corrections to guide your interpretation:

`

  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i]
    prompt += `### Example ${i + 1}: ${ex.exampleType.replace(/_/g, ' ').toUpperCase()}
**Video:** ${ex.videoSummary}
`

    if (ex.geminiInterpretation) {
      prompt += `**AI Initially Said:** ${ex.geminiInterpretation}
`
    }

    prompt += `**Correct Interpretation:** ${ex.correctInterpretation}
**Why:** ${ex.explanation}
`

    if (ex.humorTypeCorrection) {
      prompt += `**Humor Correction:** "${ex.humorTypeCorrection.original}" → "${ex.humorTypeCorrection.correct}" because ${ex.humorTypeCorrection.why}
`
    }

    if (ex.culturalContext) {
      prompt += `**Cultural Context Needed:** ${ex.culturalContext}
`
    }

    if (ex.visualElements.length > 0) {
      prompt += `**Visual Elements Missed:** ${ex.visualElements.join(', ')}
`
    }

    prompt += '\n'
  }

  prompt += `---
APPLY THESE LEARNINGS: Use the patterns above to better interpret this video. Pay attention to:
- Visual punchlines that happen in the edit/cut, not just dialogue
- Cultural/generational references that may not be obvious
- Misdirection setups where the viewer's assumption is subverted
- The ACTUAL humor mechanism, not surface-level description
---

`

  return prompt
}

/**
 * Save a new video analysis example for future learning
 * Automatically generates embedding for RAG retrieval
 */
export async function saveVideoAnalysisExample(
  input: SaveExampleInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Build text for embedding from the key teaching content
    const embeddingText = [
      input.videoSummary,
      input.correctInterpretation,
      input.explanation,
      input.culturalContext,
      ...(input.visualElements || []),
      ...(input.tags || []),
      ...(input.humorTypes || [])
    ].filter(Boolean).join(' ')

    // Generate embedding
    const embedding = await generateEmbedding(embeddingText)

    // Insert into database
    const { data, error } = await supabase
      .from('video_analysis_examples')
      .insert({
        video_id: input.videoId || null,
        video_url: input.videoUrl || null,
        example_type: input.exampleType,
        video_summary: input.videoSummary,
        gemini_interpretation: input.geminiInterpretation || null,
        correct_interpretation: input.correctInterpretation,
        explanation: input.explanation,
        humor_type_correction: input.humorTypeCorrection || null,
        cultural_context: input.culturalContext || null,
        visual_elements: input.visualElements || [],
        tags: input.tags || [],
        humor_types: input.humorTypes || [],
        industry: input.industry || null,
        content_format: input.contentFormat || null,
        quality_score: input.qualityScore || 0.8,
        embedding
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to save video analysis example:', error)
      return { success: false, error: error.message }
    }

    console.log(`✅ Saved video analysis example: ${data.id}`)
    return { success: true, id: data.id }

  } catch (error) {
    console.error('Error saving video analysis example:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Save a correction note for a video and automatically create a learning example
 * This is the main entry point for adding feedback that improves the model
 */
export async function saveVideoCorrection(
  videoId: string,
  correction: {
    field: string           // e.g., 'humorType', 'humorMechanism', 'conceptCore'
    originalValue: string   // What Gemini said
    correctedValue: string  // What it should be
    explanation: string     // Why this is wrong/right
    culturalContext?: string
    visualElements?: string[]
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // First, get the video details
    const { data: video, error: videoError } = await supabase
      .from('analyzed_videos')
      .select('video_url, visual_analysis')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      return { success: false, error: 'Video not found' }
    }

    // Determine example type based on field
    let exampleType: SaveExampleInput['exampleType'] = 'humor_interpretation'
    if (correction.field.includes('cultural') || correction.culturalContext) {
      exampleType = 'cultural_context'
    } else if (correction.field.includes('visual') || correction.visualElements?.length) {
      exampleType = 'visual_punchline'
    } else if (correction.field.includes('replicab')) {
      exampleType = 'replicability'
    }

    // Extract video summary from analysis
    const analysis = video.visual_analysis as any
    const videoSummary = analysis?.content?.keyMessage || 
                         analysis?.visual?.summary ||
                         analysis?.script?.conceptCore ||
                         'Video content'

    // Determine humor types from the correction or existing analysis
    const humorTypes: string[] = []
    if (correction.field === 'humorType') {
      humorTypes.push(correction.correctedValue)
    } else if (analysis?.script?.humor?.humorType) {
      humorTypes.push(analysis.script.humor.humorType)
    }

    // Save the learning example
    const result = await saveVideoAnalysisExample({
      videoId,
      videoUrl: video.video_url,
      exampleType,
      videoSummary,
      geminiInterpretation: correction.originalValue,
      correctInterpretation: correction.correctedValue,
      explanation: correction.explanation,
      humorTypeCorrection: correction.field === 'humorType' ? {
        original: correction.originalValue,
        correct: correction.correctedValue,
        why: correction.explanation
      } : undefined,
      culturalContext: correction.culturalContext,
      visualElements: correction.visualElements,
      humorTypes,
      qualityScore: 0.9  // Human corrections are high quality
    })

    if (!result.success) {
      return { success: false, error: result.error }
    }

    // Also append to the video's gemini_corrections for reference
    const existingCorrections = (video.visual_analysis as any)?.gemini_corrections || []
    await supabase
      .from('analyzed_videos')
      .update({
        gemini_corrections: [
          ...existingCorrections,
          {
            timestamp: new Date().toISOString(),
            field: correction.field,
            originalValue: correction.originalValue,
            correctedValue: correction.correctedValue,
            note: correction.explanation,
            learningExampleId: result.id
          }
        ]
      })
      .eq('id', videoId)

    console.log(`✅ Saved correction for video ${videoId}, created learning example ${result.id}`)
    return { success: true }

  } catch (error) {
    console.error('Error saving video correction:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get learning context for a video before analysis
 * Call this before Gemini analysis to get relevant examples
 */
export async function getLearningContext(
  videoMetadata: {
    transcript?: string
    title?: string
    description?: string
    hashtags?: string[]
    industry?: string
    contentFormat?: string
  }
): Promise<string> {
  // Build context string from metadata
  const contextParts = [
    videoMetadata.title,
    videoMetadata.description,
    videoMetadata.transcript,
    ...(videoMetadata.hashtags || [])
  ].filter(Boolean)

  if (contextParts.length === 0) {
    return ''
  }

  const context = contextParts.join(' ')

  // Find relevant examples
  const examples = await findRelevantVideoExamples(context, {
    industry: videoMetadata.industry,
    contentFormat: videoMetadata.contentFormat,
    limit: 3,
    threshold: 0.4
  })

  // Build few-shot prompt
  return buildFewShotPrompt(examples)
}

/**
 * Get statistics on learning examples
 */
export async function getLearningStats(): Promise<{
  totalExamples: number
  byType: Record<string, number>
  mostUsed: Array<{ id: string; videoSummary: string; timesUsed: number }>
}> {
  const { data: examples, error } = await supabase
    .from('video_analysis_examples')
    .select('id, example_type, video_summary, times_used')
    .order('times_used', { ascending: false })

  if (error || !examples) {
    return { totalExamples: 0, byType: {}, mostUsed: [] }
  }

  const byType: Record<string, number> = {}
  for (const ex of examples) {
    byType[ex.example_type] = (byType[ex.example_type] || 0) + 1
  }

  return {
    totalExamples: examples.length,
    byType,
    mostUsed: examples.slice(0, 5).map(ex => ({
      id: ex.id,
      videoSummary: ex.video_summary,
      timesUsed: ex.times_used
    }))
  }
}
