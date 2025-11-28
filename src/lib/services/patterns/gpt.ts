import OpenAI from 'openai'
import type { 
  PatternDiscoveryProvider, 
  PatternDiscoveryInput,
  DiscoveredPattern,
  RatingFieldSuggestion
} from '../types'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

export class GPTPatternDiscovery implements PatternDiscoveryProvider {
  private client: OpenAI
  private model: string

  constructor(apiKey: string = OPENAI_API_KEY, model: string = 'gpt-4o') {
    this.client = new OpenAI({ apiKey })
    this.model = model
  }

  async discoverPatterns(input: PatternDiscoveryInput): Promise<DiscoveredPattern[]> {
    const { ratedVideos } = input
    
    console.log(`🔬 Analyzing ${ratedVideos.length} rated videos for patterns`)

    try {
      // Prepare data summary for GPT
      const dataPrep = this.prepareDataForAnalysis(ratedVideos)

      const systemPrompt = `You are an expert data analyst specializing in social media content analysis. 
Your task is to identify patterns in how a user rates videos. Look for:

1. **Correlations**: Which video attributes correlate with higher/lower ratings?
2. **Preferences**: What types of content, styles, or techniques does the user prefer?
3. **Surprises**: Any unexpected patterns or counter-intuitive relationships?
4. **Actionable Insights**: Recommendations for what to look for in future videos
5. **New Rating Criteria**: Suggest new rating fields based on what seems to matter

Provide concrete, specific patterns with strong evidence.`

      const userPrompt = `Analyze these ${ratedVideos.length} rated videos and discover patterns:

${dataPrep.summary}

**Rated Videos Data:**
${JSON.stringify(dataPrep.videos, null, 2)}

Return a JSON array of discovered patterns. Each pattern should have:
{
  "name": "short_identifier",
  "description": "detailed explanation of the pattern",
  "confidence": <0-1, how confident you are in this pattern>,
  "evidence": ["specific example 1", "specific example 2"],
  "category": "correlation|preference|technical|content|engagement",
  "suggestedCriteria": [
    {
      "name": "field_name",
      "type": "number|string|boolean|select",
      "label": "Human Readable Label",
      "description": "Why this field would be useful",
      "options": ["option1", "option2"] // only for select type
    }
  ] // optional: new rating fields to add
}

Focus on actionable insights. Be specific about numbers and examples.`

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })

      const responseText = completion.choices[0].message.content || '{}'
      const parsed = JSON.parse(responseText)

      // Extract patterns array (handle different response structures)
      const patterns = Array.isArray(parsed) ? parsed : (parsed.patterns || [])

      console.log(`✅ Discovered ${patterns.length} patterns`)

      return patterns.map(p => ({
        name: p.name,
        description: p.description,
        confidence: p.confidence,
        evidence: p.evidence || [],
        category: p.category,
        suggestedCriteria: p.suggestedCriteria || []
      }))

    } catch (error) {
      console.error('❌ Pattern discovery failed:', error)
      throw new Error(
        `Pattern discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private prepareDataForAnalysis(ratedVideos: any[]) {
    // Extract all rating fields used
    const allRatingFields = new Set<string>()
    ratedVideos.forEach(v => {
      if (v.userRatings) {
        Object.keys(v.userRatings).forEach(key => {
          if (key !== 'rated_at') allRatingFields.add(key)
        })
      }
    })

    // Calculate statistics
    const stats = {
      totalVideos: ratedVideos.length,
      platforms: {} as Record<string, number>,
      ratingFields: Array.from(allRatingFields),
      avgMetrics: {} as Record<string, number>
    }

    ratedVideos.forEach(v => {
      const platform = v.metadata?.platform || 'unknown'
      stats.platforms[platform] = (stats.platforms[platform] || 0) + 1
    })

    // Prepare simplified video data
    const videos = ratedVideos.map(v => ({
      id: v.id,
      platform: v.metadata?.platform,
      ratings: v.userRatings,
      metadata: {
        views: v.metadata?.stats?.viewCount,
        likes: v.metadata?.stats?.likeCount,
        comments: v.metadata?.stats?.commentCount,
        duration: v.metadata?.duration,
        title: v.metadata?.title?.substring(0, 100) // truncate for token limits
      },
      analysis: v.analysis ? {
        hookStrength: v.analysis.visual?.hookStrength,
        overallQuality: v.analysis.visual?.overallQuality,
        audioQuality: v.analysis.audio?.quality,
        pacing: v.analysis.technical?.pacing,
        engagement: v.analysis.engagement
      } : null,
      metrics: {
        engagementRate: v.computedMetrics?.engagement_rate,
        viralCoefficient: v.computedMetrics?.viral_coefficient,
        viralPotential: v.computedMetrics?.viral_potential
      }
    }))

    return {
      summary: `
Total Videos: ${stats.totalVideos}
Platforms: ${Object.entries(stats.platforms).map(([p, c]) => `${p} (${c})`).join(', ')}
Rating Fields Used: ${stats.ratingFields.join(', ')}
      `.trim(),
      videos
    }
  }

  async suggestRatingFields(
    existingFields: string[],
    context: { ratedVideos?: any[], patterns?: DiscoveredPattern[] }
  ): Promise<RatingFieldSuggestion[]> {
    console.log('💡 Suggesting new rating fields')

    const systemPrompt = `You are an expert at designing rating systems for social media content.
Based on existing rating fields and discovered patterns, suggest new fields that would provide valuable insights.`

    const userPrompt = `
Current rating fields: ${existingFields.join(', ')}

${context.patterns ? `Discovered patterns:\n${context.patterns.map(p => `- ${p.description}`).join('\n')}` : ''}

Suggest 3-5 new rating fields that would be valuable to track. Return JSON array:
[
  {
    "name": "field_name",
    "type": "number|string|boolean|select",
    "label": "Human Readable Label",
    "description": "Why this field would be useful to track",
    "options": ["option1", "option2"], // only for select type
    "reasoning": "Why this field is recommended based on patterns"
  }
]`

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })

      const responseText = completion.choices[0].message.content || '{}'
      const parsed = JSON.parse(responseText)
      
      const suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || [])

      console.log(`✅ Generated ${suggestions.length} field suggestions`)

      return suggestions

    } catch (error) {
      console.error('❌ Field suggestion failed:', error)
      throw new Error('Failed to generate field suggestions')
    }
  }
}

// Factory function for service registry
export function createGPTPatternDiscovery(): PatternDiscoveryProvider {
  return new GPTPatternDiscovery()
}
