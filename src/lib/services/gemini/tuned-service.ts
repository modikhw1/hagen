/**
 * Tuned Gemini Service
 * 
 * Service for using the fine-tuned Gemini model for humor analysis.
 * Replaces the 850-line prompt approach with direct model inference.
 */

import { GoogleAuth } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

export interface HumorAnalysis {
  summary: string;
  mechanism: string;
  why_it_works: string;
  audience: string;
  category: 'comedy' | 'wholesome' | 'relatable' | 'clever' | 'chaotic';
  quality: 'weak' | 'average' | 'good' | 'exceptional';
  replicable: boolean;
  raw_response?: string;
}

export interface TunedModelConfig {
  modelEndpoint?: string;
  projectId?: string;
  location?: string;
}

// Analysis prompt - matches what the model was trained on
const ANALYSIS_PROMPT = `Analysera denna video. Förklara vad som händer och varför det är roligt eller effektivt.

Fokusera på:
1. Vad händer i videon? (Konkret beskrivning)
2. Vad är humormekanismen? (Subversion, timing, kontrast, etc.)
3. Varför fungerar det? (Psykologisk/social förklaring)
4. Vem uppskattar detta? (Målgrupp)

Var specifik och undvik generiska beskrivningar.`;

export class TunedGeminiService {
  private projectId: string;
  private location: string;
  private modelEndpoint: string | null;
  private auth: GoogleAuth;
  private apiEndpoint: string;

  constructor(config?: TunedModelConfig) {
    this.projectId = config?.projectId || process.env.GOOGLE_CLOUD_PROJECT_ID!;
    this.location = config?.location || process.env.VERTEX_LOCATION || 'us-central1';
    this.modelEndpoint = config?.modelEndpoint || this.loadTunedModelEndpoint();
    
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    
    this.apiEndpoint = `https://${this.location}-aiplatform.googleapis.com/v1`;
  }

  /**
   * Load tuned model endpoint from the fine-tuning output
   */
  private loadTunedModelEndpoint(): string | null {
    try {
      const modelPath = path.join(process.cwd(), 'datasets/fine-tuning/tuned_model.json');
      if (fs.existsSync(modelPath)) {
        const data = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
        return data.endpoint;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  /**
   * Check if a tuned model is available
   */
  hasTunedModel(): boolean {
    return this.modelEndpoint !== null;
  }

  /**
   * Get access token for API calls
   */
  private async getAccessToken(): Promise<string> {
    const client = await this.auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token!;
  }

  /**
   * Analyze a video using the fine-tuned model
   */
  async analyzeVideo(gcsUri: string): Promise<HumorAnalysis> {
    if (!this.modelEndpoint) {
      throw new Error(
        'No tuned model available. Run fine-tuning first: npx ts-node scripts/fine-tune-gemini.ts run'
      );
    }

    const token = await this.getAccessToken();

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: ANALYSIS_PROMPT },
            {
              fileData: {
                mimeType: "video/mp4",
                fileUri: gcsUri
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        mediaResolution: "MEDIA_RESOLUTION_LOW"
      }
    };

    const response = await fetch(`${this.modelEndpoint}:generateContent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Tuned model generation failed: ${error}`);
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return this.parseResponse(rawText);
  }

  /**
   * Analyze using the base model (fallback if no tuned model)
   */
  async analyzeVideoBase(gcsUri: string): Promise<HumorAnalysis> {
    const model = 'gemini-2.0-flash-001';
    const endpoint = `${this.apiEndpoint}/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${model}:generateContent`;

    const token = await this.getAccessToken();

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: ANALYSIS_PROMPT },
            {
              fileData: {
                mimeType: "video/mp4",
                fileUri: gcsUri
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Base model generation failed: ${error}`);
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return this.parseResponse(rawText);
  }

  /**
   * Smart analyze - uses tuned model if available, otherwise base model
   */
  async analyze(gcsUri: string): Promise<HumorAnalysis & { usedTunedModel: boolean }> {
    if (this.hasTunedModel()) {
      const result = await this.analyzeVideo(gcsUri);
      return { ...result, usedTunedModel: true };
    } else {
      const result = await this.analyzeVideoBase(gcsUri);
      return { ...result, usedTunedModel: false };
    }
  }

  /**
   * Parse the model response into structured HumorAnalysis
   */
  private parseResponse(rawText: string): HumorAnalysis {
    // Try to extract structured data from the response
    // The tuned model should produce responses similar to the training data
    
    // Default values
    let analysis: HumorAnalysis = {
      summary: '',
      mechanism: '',
      why_it_works: '',
      audience: '',
      category: 'comedy',
      quality: 'average',
      replicable: false,
      raw_response: rawText
    };

    // Check if response is JSON
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || parsed.what_happens || '',
          mechanism: parsed.mechanism || parsed.humor_mechanism || '',
          why_it_works: parsed.why_it_works || parsed.explanation || '',
          audience: parsed.audience || parsed.target_audience || '',
          category: this.inferCategory(rawText),
          quality: this.inferQuality(rawText),
          replicable: parsed.replicable ?? this.inferReplicable(rawText),
          raw_response: rawText
        };
      } catch {
        // Not valid JSON, continue with text parsing
      }
    }

    // Text-based extraction
    const lines = rawText.split('\n').filter(l => l.trim());
    
    // Extract summary (usually first meaningful content)
    const summaryPatterns = [
      /vad händer[:\s]*(.+)/i,
      /^[1]\.\s*(.+)/,
      /videon visar\s*(.+)/i
    ];
    
    for (const pattern of summaryPatterns) {
      const match = rawText.match(pattern);
      if (match) {
        analysis.summary = match[1].trim();
        break;
      }
    }
    
    // If no pattern matched, use first sentence
    if (!analysis.summary && lines.length > 0) {
      analysis.summary = lines[0].slice(0, 200);
    }

    // Extract mechanism
    const mechanismPatterns = [
      /humormekanismen?[:\s]*(.+)/i,
      /[2]\.\s*(.+)/,
      /det roliga är\s*(.+)/i,
      /humor[:\s]*(.+)/i
    ];
    
    for (const pattern of mechanismPatterns) {
      const match = rawText.match(pattern);
      if (match) {
        analysis.mechanism = match[1].trim().slice(0, 100);
        break;
      }
    }

    // Extract why it works
    const whyPatterns = [
      /varför det fungerar[:\s]*(.+)/i,
      /fungerar för att\s*(.+)/i,
      /[3]\.\s*(.+)/
    ];
    
    for (const pattern of whyPatterns) {
      const match = rawText.match(pattern);
      if (match) {
        analysis.why_it_works = match[1].trim();
        break;
      }
    }

    // Extract audience
    const audiencePatterns = [
      /målgrupp[:\s]*(.+)/i,
      /vem uppskattar[:\s]*(.+)/i,
      /[4]\.\s*(.+)/
    ];
    
    for (const pattern of audiencePatterns) {
      const match = rawText.match(pattern);
      if (match) {
        analysis.audience = match[1].trim();
        break;
      }
    }

    // Infer category
    analysis.category = this.inferCategory(rawText);
    analysis.quality = this.inferQuality(rawText);
    analysis.replicable = this.inferReplicable(rawText);

    return analysis;
  }

  private inferCategory(text: string): HumorAnalysis['category'] {
    const lower = text.toLowerCase();
    
    if (lower.includes('kaotisk') || lower.includes('chaotic') || lower.includes('absurd')) {
      return 'chaotic';
    }
    if (lower.includes('wholesome') || lower.includes('hjärtvärmande') || lower.includes('cute')) {
      return 'wholesome';
    }
    if (lower.includes('relatable') || lower.includes('relaterbar') || lower.includes('igenkänning')) {
      return 'relatable';
    }
    if (lower.includes('clever') || lower.includes('smart') || lower.includes('intelligent')) {
      return 'clever';
    }
    
    return 'comedy';
  }

  private inferQuality(text: string): HumorAnalysis['quality'] {
    const lower = text.toLowerCase();
    
    if (lower.includes('exceptional') || lower.includes('fantastisk') || lower.includes('outstanding')) {
      return 'exceptional';
    }
    if (lower.includes('good') || lower.includes('bra') || lower.includes('effektiv')) {
      return 'good';
    }
    if (lower.includes('weak') || lower.includes('svag') || lower.includes('poor')) {
      return 'weak';
    }
    
    return 'average';
  }

  private inferReplicable(text: string): boolean {
    const lower = text.toLowerCase();
    return lower.includes('replikerbar') || 
           lower.includes('replicable') || 
           lower.includes('kan upprepas') ||
           lower.includes('format') ||
           lower.includes('mall');
  }
}

// Factory function
export function createTunedGeminiService(config?: TunedModelConfig): TunedGeminiService {
  return new TunedGeminiService(config);
}

// Export singleton for convenience
let defaultService: TunedGeminiService | null = null;

export function getTunedGeminiService(): TunedGeminiService {
  if (!defaultService) {
    defaultService = new TunedGeminiService();
  }
  return defaultService;
}
