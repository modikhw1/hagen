import { GoogleGenerativeAI } from '@google/generative-ai'
import type { 
  VideoAnalysisProvider, 
  VideoAnalysisOptions, 
  VideoAnalysis 
} from '../types'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

export class GeminiVideoAnalyzer implements VideoAnalysisProvider {
  private client: GoogleGenerativeAI
  private model: string

  constructor(apiKey: string = GEMINI_API_KEY, model: string = 'gemini-2.0-flash-exp') {
    this.client = new GoogleGenerativeAI(apiKey)
    this.model = model
  }

  async analyzeVideo(
    videoUrl: string,
    options: VideoAnalysisOptions = {}
  ): Promise<VideoAnalysis> {
    const detailLevel = options.detailLevel || 'comprehensive'
    
    console.log(`🎬 Analyzing video with Gemini (${detailLevel} detail)`)
    
    try {
      const model = this.client.getGenerativeModel({ model: this.model })

      // Generate detailed analysis prompt based on detail level
      const prompt = this.buildAnalysisPrompt(detailLevel)

      const result = await model.generateContent([
        {
          fileData: {
            mimeType: 'video/mp4',
            fileUri: videoUrl
          }
        },
        { text: prompt }
      ])

      const response = result.response
      const analysisText = response.text()

      // Parse structured analysis from response
      const analysis = this.parseAnalysisResponse(analysisText, detailLevel)

      console.log('✅ Gemini analysis complete')

      return analysis

    } catch (error) {
      console.error('❌ Gemini analysis failed:', error)
      throw new Error(
        `Video analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private buildAnalysisPrompt(detailLevel: string): string {
    const basePrompt = `Analyze this video comprehensively and provide a structured JSON response with the following sections:`

    if (detailLevel === 'basic') {
      return `${basePrompt}

{
  "visual": {
    "hookStrength": <1-10>,
    "overallQuality": <1-10>,
    "mainElements": ["element1", "element2"],
    "colorPalette": ["color1", "color2"],
    "summary": "brief visual description"
  },
  "audio": {
    "quality": <1-10>,
    "musicType": "type",
    "hasVoiceover": <boolean>,
    "energyLevel": "low/medium/high"
  },
  "content": {
    "topic": "main topic",
    "style": "content style",
    "duration": <seconds>,
    "keyMessage": "main message"
  }
}`
    }

    if (detailLevel === 'detailed') {
      return `${basePrompt}

{
  "visual": {
    "hookStrength": <1-10>,
    "hookDescription": "what makes the first 3 seconds compelling",
    "overallQuality": <1-10>,
    "mainElements": ["element1", "element2"],
    "colorPalette": ["color1", "color2"],
    "colorDiversity": <1-10>,
    "transitions": ["type1", "type2"],
    "textOverlays": ["text1", "text2"],
    "summary": "detailed visual description"
  },
  "audio": {
    "quality": <1-10>,
    "musicType": "type",
    "musicGenre": "genre",
    "hasVoiceover": <boolean>,
    "voiceoverQuality": <1-10 or null>,
    "energyLevel": "low/medium/high",
    "audioEnergy": <1-10>,
    "soundEffects": ["effect1", "effect2"]
  },
  "content": {
    "topic": "main topic",
    "style": "content style",
    "format": "video format",
    "duration": <seconds>,
    "keyMessage": "main message",
    "narrativeStructure": "how story unfolds",
    "callsToAction": ["cta1", "cta2"],
    "targetAudience": "who this appeals to"
  },
  "technical": {
    "pacing": <1-10>,
    "editingStyle": "style description",
    "cameraWork": "camera technique",
    "lighting": "lighting quality"
  }
}`
    }

    // Comprehensive analysis (default)
    return `${basePrompt}

{
  "visual": {
    "hookStrength": <1-10, rate how compelling the first 3 seconds are>,
    "hookDescription": "detailed explanation of what makes the opening work or not work",
    "overallQuality": <1-10, production value and visual polish>,
    "mainElements": ["list all key visual elements"],
    "colorPalette": ["dominant colors used"],
    "colorDiversity": <1-10, variety and impact of colors>,
    "transitions": ["types of transitions between shots"],
    "textOverlays": ["any text that appears on screen"],
    "visualHierarchy": "what draws the eye and when",
    "compositionQuality": <1-10>,
    "brandingElements": ["logos, watermarks, etc"],
    "summary": "comprehensive visual analysis covering all aspects"
  },
  "audio": {
    "quality": <1-10, audio production quality>,
    "musicType": "background music category",
    "musicGenre": "specific genre",
    "hasVoiceover": <boolean>,
    "voiceoverQuality": <1-10 or null if no voiceover>,
    "voiceoverTone": "tone and delivery style",
    "energyLevel": "low/medium/high",
    "audioEnergy": <1-10, intensity and engagement>,
    "soundEffects": ["list all sound effects used"],
    "audioVisualSync": <1-10, how well audio matches visuals>,
    "audioMix": "balance between music, voice, and effects"
  },
  "content": {
    "topic": "precise topic/subject matter",
    "style": "content style (educational, entertaining, inspirational, etc)",
    "format": "video format (talking head, montage, tutorial, etc)",
    "duration": <exact duration in seconds>,
    "keyMessage": "core message or takeaway",
    "narrativeStructure": "how the story/content unfolds (hook, body, close)",
    "callsToAction": ["list all CTAs"],
    "targetAudience": "detailed audience profile",
    "emotionalTone": "dominant emotion conveyed",
    "valueProposition": "what value this provides to viewers",
    "uniquenessFactors": ["what makes this stand out"]
  },
  "script": {
    "conceptCore": "one-sentence description of the replicable concept/format that could be copied",
    "hasScript": <boolean, does this video follow a scripted narrative vs spontaneous content>,
    "scriptQuality": <1-10, how well-written/structured is the script (null if unscripted)>,
    "transcript": "approximate transcript or description of what is said/shown",
    "humor": {
      "isHumorous": <boolean>,
      "humorType": "subversion|absurdist|observational|physical|wordplay|callback|contrast|deadpan|escalation|satire|parody|none",
      "humorMechanism": "detailed explanation of HOW the humor works - what expectation is set up and how it's subverted",
      "comedyTiming": <1-10, effectiveness of timing and beats>,
      "absurdismLevel": <1-10, how much does this violate normal logic or expectations>,
      "surrealismLevel": <1-10, how much does this distort reality or use dream-like elements>
    },
    "structure": {
      "hookType": "question|statement|action|mystery|pattern-interrupt|relatable-situation|visual-shock",
      "hook": "what happens in first 1-3 seconds to grab attention",
      "setup": "what expectation, context, or premise is established",
      "development": "how does the middle section build on the setup",
      "payoff": "how is the expectation resolved, subverted, or paid off",
      "payoffStrength": <1-10, how satisfying is the conclusion>,
      "hasCallback": <boolean, does it reference earlier elements>,
      "hasTwist": <boolean, is there an unexpected turn>
    },
    "emotional": {
      "primaryEmotion": "the main emotion being engineered (humor, awe, curiosity, FOMO, nostalgia, satisfaction, shock, warmth, etc)",
      "emotionalArc": "how emotion changes through the video",
      "emotionalIntensity": <1-10, strength of emotional impact>,
      "relatability": <1-10, how much can average viewer relate to this>
    },
    "replicability": {
      "score": <1-10, how easy is this concept to recreate with different content>,
      "template": "describe the templatable format in one sentence that another business could follow",
      "requiredElements": ["list elements ESSENTIAL to make this concept work"],
      "variableElements": ["list elements that can be swapped for different contexts"],
      "resourceRequirements": "low|medium|high - what's needed to recreate this (actors, props, locations, skills)",
      "contextDependency": <1-10, how much does this rely on specific context/brand/person (1=universal, 10=only works for this creator)>
    },
    "originality": {
      "score": <1-10, how fresh/novel is this concept>,
      "similarFormats": ["list any known formats this resembles"],
      "novelElements": ["what makes this different from similar content"]
    }
  },
  "technical": {
    "pacing": <1-10, how well the video maintains momentum>,
    "pacingDescription": "specific pacing patterns and effectiveness",
    "editingStyle": "detailed editing approach",
    "cutsPerMinute": <approximate number>,
    "cameraWork": "camera techniques and movement",
    "lighting": "lighting setup and quality",
    "aspectRatio": "video dimensions",
    "resolution": "visual clarity",
    "specialEffects": ["any VFX or filters used"]
  },
  "engagement": {
    "attentionRetention": <1-10, predicted ability to hold attention>,
    "shareability": <1-10, likelihood of being shared>,
    "replayValue": <1-10, desire to watch multiple times>,
    "scrollStopPower": <1-10, ability to stop scrolling>,
    "engagementFactors": ["specific elements that drive engagement"]
  },
  "trends": {
    "trendingElements": ["current trends used"],
    "trendAlignment": <1-10, how well it fits current trends>,
    "timelessness": <1-10, lasting appeal beyond trends>
  }
}

IMPORTANT: For the "script" section, focus on analyzing the CONCEPT and STRUCTURE as intellectual property that could be extracted and reused. Think about what makes this format work and how another creator could adapt it. Be specific about humor mechanics - don't just say "it's funny", explain WHY and HOW it creates humor.

Provide detailed, actionable analysis. Rate everything on 1-10 scales. Be specific about what works and what doesn't.`
  }

  private parseAnalysisResponse(text: string, detailLevel: string): VideoAnalysis {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text]
      const jsonText = jsonMatch[1].trim()
      
      const parsed = JSON.parse(jsonText)

      // Normalize to comprehensive format
      return {
        visual: {
          hookStrength: parsed.visual?.hookStrength || 5,
          hookDescription: parsed.visual?.hookDescription || '',
          overallQuality: parsed.visual?.overallQuality || 5,
          mainElements: parsed.visual?.mainElements || [],
          colorPalette: parsed.visual?.colorPalette || [],
          colorDiversity: parsed.visual?.colorDiversity || 5,
          transitions: parsed.visual?.transitions || [],
          textOverlays: parsed.visual?.textOverlays || [],
          visualHierarchy: parsed.visual?.visualHierarchy || '',
          compositionQuality: parsed.visual?.compositionQuality || 5,
          brandingElements: parsed.visual?.brandingElements || [],
          summary: parsed.visual?.summary || ''
        },
        audio: {
          quality: parsed.audio?.quality || 5,
          musicType: parsed.audio?.musicType || 'unknown',
          musicGenre: parsed.audio?.musicGenre || 'unknown',
          hasVoiceover: parsed.audio?.hasVoiceover || false,
          voiceoverQuality: parsed.audio?.voiceoverQuality || null,
          voiceoverTone: parsed.audio?.voiceoverTone || '',
          energyLevel: parsed.audio?.energyLevel || 'medium',
          audioEnergy: parsed.audio?.audioEnergy || 5,
          soundEffects: parsed.audio?.soundEffects || [],
          audioVisualSync: parsed.audio?.audioVisualSync || 5,
          audioMix: parsed.audio?.audioMix || ''
        },
        content: {
          topic: parsed.content?.topic || 'unknown',
          style: parsed.content?.style || 'unknown',
          format: parsed.content?.format || 'unknown',
          duration: parsed.content?.duration || 0,
          keyMessage: parsed.content?.keyMessage || '',
          narrativeStructure: parsed.content?.narrativeStructure || '',
          callsToAction: parsed.content?.callsToAction || [],
          targetAudience: parsed.content?.targetAudience || '',
          emotionalTone: parsed.content?.emotionalTone || '',
          valueProposition: parsed.content?.valueProposition || '',
          uniquenessFactors: parsed.content?.uniquenessFactors || []
        },
        script: {
          conceptCore: parsed.script?.conceptCore || '',
          hasScript: parsed.script?.hasScript ?? true,
          scriptQuality: parsed.script?.scriptQuality || null,
          transcript: parsed.script?.transcript || '',
          humor: {
            isHumorous: parsed.script?.humor?.isHumorous ?? false,
            humorType: parsed.script?.humor?.humorType || 'none',
            humorMechanism: parsed.script?.humor?.humorMechanism || '',
            comedyTiming: parsed.script?.humor?.comedyTiming || null,
            absurdismLevel: parsed.script?.humor?.absurdismLevel || 1,
            surrealismLevel: parsed.script?.humor?.surrealismLevel || 1
          },
          structure: {
            hookType: parsed.script?.structure?.hookType || 'statement',
            hook: parsed.script?.structure?.hook || '',
            setup: parsed.script?.structure?.setup || '',
            development: parsed.script?.structure?.development || '',
            payoff: parsed.script?.structure?.payoff || '',
            payoffStrength: parsed.script?.structure?.payoffStrength || 5,
            hasCallback: parsed.script?.structure?.hasCallback ?? false,
            hasTwist: parsed.script?.structure?.hasTwist ?? false
          },
          emotional: {
            primaryEmotion: parsed.script?.emotional?.primaryEmotion || 'neutral',
            emotionalArc: parsed.script?.emotional?.emotionalArc || '',
            emotionalIntensity: parsed.script?.emotional?.emotionalIntensity || 5,
            relatability: parsed.script?.emotional?.relatability || 5
          },
          replicability: {
            score: parsed.script?.replicability?.score || 5,
            template: parsed.script?.replicability?.template || '',
            requiredElements: parsed.script?.replicability?.requiredElements || [],
            variableElements: parsed.script?.replicability?.variableElements || [],
            resourceRequirements: parsed.script?.replicability?.resourceRequirements || 'medium',
            contextDependency: parsed.script?.replicability?.contextDependency || 5
          },
          originality: {
            score: parsed.script?.originality?.score || 5,
            similarFormats: parsed.script?.originality?.similarFormats || [],
            novelElements: parsed.script?.originality?.novelElements || []
          }
        },
        technical: {
          pacing: parsed.technical?.pacing || 5,
          pacingDescription: parsed.technical?.pacingDescription || '',
          editingStyle: parsed.technical?.editingStyle || '',
          cutsPerMinute: parsed.technical?.cutsPerMinute || 0,
          cameraWork: parsed.technical?.cameraWork || '',
          lighting: parsed.technical?.lighting || '',
          aspectRatio: parsed.technical?.aspectRatio || '',
          resolution: parsed.technical?.resolution || '',
          specialEffects: parsed.technical?.specialEffects || []
        },
        engagement: parsed.engagement ? {
          attentionRetention: parsed.engagement.attentionRetention || 5,
          shareability: parsed.engagement.shareability || 5,
          replayValue: parsed.engagement.replayValue || 5,
          scrollStopPower: parsed.engagement.scrollStopPower || 5,
          engagementFactors: parsed.engagement.engagementFactors || []
        } : undefined,
        trends: parsed.trends ? {
          trendingElements: parsed.trends.trendingElements || [],
          trendAlignment: parsed.trends.trendAlignment || 5,
          timelessness: parsed.trends.timelessness || 5
        } : undefined
      }

    } catch (error) {
      console.error('Failed to parse Gemini response:', error)
      throw new Error('Failed to parse video analysis response')
    }
  }
}

// Factory function for service registry
export function createGeminiAnalyzer(): VideoAnalysisProvider {
  return new GeminiVideoAnalyzer()
}
