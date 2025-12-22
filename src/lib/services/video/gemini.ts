import { GoogleGenerativeAI } from '@google/generative-ai'
import type { 
  VideoAnalysisProvider, 
  VideoAnalysisOptions, 
  VideoAnalysis 
} from '../types'
import { getLearningContext } from './learning'
import { evaluateAnalysisQuality, type QualityScore } from './quality-judge'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

export class GeminiVideoAnalyzer implements VideoAnalysisProvider {
  name = 'gemini'
  private client: GoogleGenerativeAI
  private model: string

  constructor(apiKey: string = GEMINI_API_KEY, model: string = 'gemini-2.0-flash-exp') {
    this.client = new GoogleGenerativeAI(apiKey)
    this.model = model
  }

  /**
   * Quick concept extraction for learning context matching
   * Gets joke structure/mechanism for better semantic matching with learning examples
   */
  private async extractQuickTranscript(videoUrl: string): Promise<string> {
    try {
      const model = this.client.getGenerativeModel({ model: this.model })
      
      const result = await model.generateContent([
        {
          fileData: {
            mimeType: 'video/mp4',
            fileUri: videoUrl
          }
        },
        { text: `Analyze this video and extract the humor concept. Format your response as:

JOKE_CONCEPT: [One sentence describing what the joke/concept is about - e.g., "Restaurant employee offers attractiveness discount but price stays the same"]
HUMOR_MECHANISM: [How the humor works - e.g., "Subverts expectation by offering discount that provides no benefit"]  
HUMOR_TYPE: [Category: observational, physical, deadpan, absurdist, sarcastic, subversion, wordplay, or none]
SETUP: [What expectation is created]
PUNCHLINE: [What happens that's unexpected]
TRANSCRIPT: [Key dialogue, abbreviated]` }
      ])
      
      return result.response.text()
    } catch (error) {
      console.error('⚠️ Quick concept extraction failed:', error)
      return ''
    }
  }

  async analyzeVideo(
    videoUrl: string,
    options: VideoAnalysisOptions = {}
  ): Promise<VideoAnalysis> {
    const detailLevel = options.detailLevel || 'comprehensive'
    const useLearning = options.useLearning !== false  // Default to true
    
    console.log(`🎬 Analyzing video with Gemini (${detailLevel} detail)`)
    
    try {
      const model = this.client.getGenerativeModel({ model: this.model })

      // Get learning context from RAG if enabled
      let learningContext = options.learningContext || ''
      if (useLearning && !learningContext) {
        // Check if we have enough metadata for learning context
        const existingAnalysis = options.videoMetadata?.existingAnalysis as { script?: { transcript?: string } } | undefined
        const hasContext = options.videoMetadata?.transcript || 
                          options.videoMetadata?.title || 
                          options.videoMetadata?.description ||
                          existingAnalysis?.script?.transcript
        
        if (!hasContext) {
          // No existing context - extract quick transcript first (two-pass approach)
          console.log('📚 No existing context - extracting quick transcript for learning...')
          const quickTranscript = await this.extractQuickTranscript(videoUrl)
          
          if (quickTranscript) {
            console.log('📚 Got quick transcript, fetching learning context...')
            learningContext = await getLearningContext({
              ...options.videoMetadata,
              transcript: quickTranscript
            })
          }
        } else if (options.videoMetadata) {
          console.log('📚 Fetching learning context from existing metadata...')
          learningContext = await getLearningContext(options.videoMetadata)
        }
        
        if (learningContext) {
          console.log('✅ Found relevant learning examples')
        }
      }

      // Generate detailed analysis prompt based on detail level
      const basePrompt = this.buildAnalysisPrompt(detailLevel)
      
      // Inject learning context if available
      const prompt = learningContext 
        ? `${learningContext}\n\n${basePrompt}`
        : basePrompt

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

      // Optionally evaluate quality against human baseline
      if (options.evaluateQuality && options.humanBaseline) {
        console.log('📊 Evaluating analysis quality...')
        try {
          const qualityScore = await evaluateAnalysisQuality(
            analysis,
            options.humanBaseline
          )
          analysis.qualityScore = {
            ...qualityScore,
            evaluated_at: new Date().toISOString()
          }
          console.log(`📊 Quality score: ${qualityScore.overall}% overall`)
        } catch (error) {
          console.error('⚠️ Quality evaluation failed:', error)
        }
      }

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
  "scenes": {
    "description": "CRITICAL: Analyze the video scene-by-scene, mapping visual edits to narrative/comedic beats. Each scene change or cut may carry meaning.",
    "sceneBreakdown": [
      {
        "sceneNumber": <1, 2, 3...>,
        "timestamp": "approximate start time",
        "duration": "approximate length",
        "visualContent": "what is shown visually in this scene",
        "audioContent": "what is said/heard in this scene (dialogue, sound, music)",
        "narrativeFunction": "hook|setup|development|misdirection|reveal|payoff|callback|tag",
        "editSignificance": "why this cut/transition matters - does the edit itself convey information or comedy?",
        "impliedMeaning": "what does this scene communicate that isn't explicitly stated?",
        "viewerAssumption": "what assumption does the viewer make during this scene?"
      }
    ],
    "editAsPunchline": <boolean, does a cut/edit itself serve as a reveal or punchline?>,
    "editPunchlineExplanation": "if true, explain how the edit delivers the joke (e.g., 'cut reveals person was talking to nobody')",
    "visualNarrativeSync": <1-10, how tightly are visuals and story/joke synchronized>,
    "misdirectionTechnique": "how does the video set up false expectations visually before the reveal?"
  },
  "script": {
    "conceptCore": "one-sentence description of the replicable concept/format that could be copied",
    "hasScript": <boolean, does this video follow a scripted narrative vs spontaneous content>,
    "scriptQuality": <1-10, how well-written/structured is the script (null if unscripted)>,
    "transcript": "approximate transcript or description of what is said/shown",
    "visualTranscript": "scene-by-scene description integrating BOTH what is shown AND what is said, in sequence",
    "deep_reasoning": {
      "character_dynamic": "REQUIRED: What relationship/tension exists between characters? (e.g., 'Workers who labor vs. those who profit - each answer reveals incentive structure')",
      "underlying_tension": "REQUIRED: What gap or conflict creates the humor? (e.g., 'Self-interest based on job role: profit-motivated want high numbers, labor-motivated want low')",
      "format_participation": "Does the structure/format participate in the joke? (e.g., 'Chef breaks established format by refusing to give a number')",
      "editing_contribution": "What editing choices add to humor? (e.g., 'Mid-word cut on profanity implies without stating')",
      "audience_surrogate": "Which character represents viewer feelings? (e.g., 'The chef - anyone who has worked service knows this frustration')",
      "why_this_is_funny": "REQUIRED: 2-3 sentences explaining the MECHANISM, not just describing what happens",
      "what_makes_it_work": "The core insight that makes this joke land"
    },
    "humor": {
      "isHumorous": <boolean>,
      "humorType": "subversion|absurdist|observational|physical|wordplay|callback|contrast|deadpan|escalation|satire|parody|visual-reveal|edit-punchline|format-subversion|incentive-reveal|rebel-worker|malicious-compliance|none",
      "humorMechanism": "MUST REFLECT deep_reasoning above - detailed explanation of HOW the humor works, not just a label",
      "visualComedyElement": "describe any visual element essential to the joke (reveal shots, reaction cuts, visual contradictions)",
      "comedyTiming": <1-10, effectiveness of timing and beats>,
      "absurdismLevel": <1-10, how much does this violate normal logic or expectations>,
      "surrealismLevel": <1-10, how much does this distort reality or use dream-like elements>
    },
    "structure": {
      "hookType": "question|statement|action|mystery|pattern-interrupt|relatable-situation|visual-shock",
      "hook": "what happens in first 1-3 seconds to grab attention",
      "setup": "what expectation, context, or premise is established - include VISUAL setup",
      "development": "how does the middle section build on the setup",
      "payoff": "how is the expectation resolved, subverted, or paid off - CRITICAL: note if payoff is VISUAL (a cut, reveal, or shown element) vs VERBAL",
      "payoffType": "verbal|visual|visual-reveal|edit-cut|combination",
      "payoffStrength": <1-10, how satisfying is the conclusion>,
      "hasCallback": <boolean, does it reference earlier elements>,
      "hasTwist": <boolean, is there an unexpected turn>,
      "twistDelivery": "verbal|visual|edit - how is the twist delivered?"
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

IMPORTANT: 
1. DEEP REASONING FIRST: Complete the "deep_reasoning" object BEFORE filling out humor labels. Ask yourself:
   - What dynamic exists between these characters? (power, incentive, performance vs reality)
   - What tension creates the humor? (the GAP between two things)
   - Does the format/structure participate in the joke?
   - Did editing choices add to the humor?
   
2. YOUR humorMechanism MUST REFLECT YOUR deep_reasoning:
   ❌ WRONG: "The humor is contrast between different perspectives"
   ✅ RIGHT: "Each answer reveals self-interest based on job role - profit-motivated want high, labor-motivated want low. The chef breaks the format entirely, expressing the frustration of being the one actually doing the work."

3. SCENE-BY-SCENE ANALYSIS IS CRITICAL: Break down the video into individual scenes/shots. For each scene, note what is SHOWN and what is SAID. Many jokes rely on VISUAL reveals, not just dialogue.

4. EDITS CAN BE PUNCHLINES: A cut or scene change can itself deliver the joke. Mid-word cuts on profanity imply without stating. Hard cuts create abruptness matching character emotion.

5. THE EXPLANATION TEST: If your humor explanation could apply to multiple videos, it's too shallow. Be specific about THIS video's mechanism.

6. For the "script" section, focus on analyzing the CONCEPT and STRUCTURE as intellectual property that could be extracted and reused. Think about what makes this format work and how another creator could adapt it.

Provide detailed, actionable analysis. Rate everything on 1-10 scales. Be specific about what works and what doesn't.`
  }

  private parseAnalysisResponse(text: string, detailLevel: string): VideoAnalysis {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text]
      let jsonText = jsonMatch[1].trim()
      
      // Sanitize common LLM JSON issues
      // 1. Extract just the JSON object
      const firstBrace = jsonText.indexOf('{')
      const lastBrace = jsonText.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonText = jsonText.slice(firstBrace, lastBrace + 1)
      }
      // 2. Remove trailing commas before } or ]
      jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1')
      
      const parsed = JSON.parse(jsonText)

      // Normalize to comprehensive format
      return {
        provider: this.name,
        analyzedAt: new Date().toISOString(),
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
          visualTranscript: parsed.script?.visualTranscript || '',
          humor: {
            isHumorous: parsed.script?.humor?.isHumorous ?? false,
            humorType: parsed.script?.humor?.humorType || 'none',
            humorMechanism: parsed.script?.humor?.humorMechanism || '',
            visualComedyElement: parsed.script?.humor?.visualComedyElement || '',
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
            payoffType: parsed.script?.structure?.payoffType || 'verbal',
            payoffStrength: parsed.script?.structure?.payoffStrength || 5,
            hasCallback: parsed.script?.structure?.hasCallback ?? false,
            hasTwist: parsed.script?.structure?.hasTwist ?? false,
            twistDelivery: parsed.script?.structure?.twistDelivery || ''
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
        } : undefined,
        scenes: parsed.scenes ? {
          sceneBreakdown: parsed.scenes.sceneBreakdown || [],
          editAsPunchline: parsed.scenes.editAsPunchline ?? false,
          editPunchlineExplanation: parsed.scenes.editPunchlineExplanation || '',
          visualNarrativeSync: parsed.scenes.visualNarrativeSync || 5,
          misdirectionTechnique: parsed.scenes.misdirectionTechnique || ''
        } : undefined
      }

    } catch (error) {
      console.error('Failed to parse Gemini response:', error)
      console.error('Raw response (first 500 chars):', text.substring(0, 500))
      throw new Error('Failed to parse video analysis response')
    }
  }
}

// Factory function for service registry
export function createGeminiAnalyzer(): VideoAnalysisProvider {
  return new GeminiVideoAnalyzer()
}
