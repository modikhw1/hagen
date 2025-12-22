'use client';

import { useState, useEffect } from 'react';

// Matches actual Gemini visual_analysis output structure
interface GeminiAnalysis {
  script?: {
    structure?: {
      hook?: string;
      setup?: string;
      payoff?: string;
      payoffType?: string;
      payoffStrength?: number;
    };
    humor?: {
      humorType?: string;
      humorMechanism?: string;
      isHumorous?: boolean;
      comedyTiming?: number;
    };
    originality?: {
      score?: number;
      novelElements?: string[];
    };
    replicability?: {
      score?: number;
      template?: string;
      requiredElements?: string[];
    };
  };
  visual?: {
    hookStrength?: number;
    overallQuality?: number;
    summary?: string;
  };
  technical?: {
    pacing?: number;
  };
  engagement?: {
    replayValue?: number;
    shareability?: number;
    attentionRetention?: number;
  };
  content?: {
    keyMessage?: string;
    emotionalTone?: string;
  };
  [key: string]: unknown;
}

interface RAGReference {
  title: string;
  score: number;
  similarity: number;
}

interface ApiResponse {
  success: boolean;
  url: string;
  analysis: GeminiAnalysis;
  rag_context: {
    similar_count: number;
    references: RAGReference[];
  };
}

type QualityTier = 'excellent' | 'good' | 'mediocre' | 'bad';

// v1.1 signal types
type ActorCount = 'solo' | 'duo' | 'small_team' | 'large_team';
type SetupComplexity = 'phone_only' | 'basic_tripod' | 'lighting_setup' | 'full_studio';
type SkillRequired = 'anyone' | 'basic_editing' | 'intermediate' | 'professional';
type SettingType = 'indoor' | 'outdoor' | 'kitchen' | 'bar' | 'storefront' | 'dining_room' | 'mixed';
type SpaceRequirements = 'minimal' | 'moderate' | 'spacious';
type LightingConditions = 'natural' | 'artificial' | 'low_light' | 'flexible';
type ContentEdge = 'brand_safe' | 'mildly_edgy' | 'edgy' | 'provocative';
type HumorRisk = 'safe_humor' | 'playful' | 'sarcastic' | 'dark_humor';
type AgeRange = 'gen_z' | 'millennial' | 'gen_x' | 'boomer' | 'broad';
type IncomeLevel = 'budget' | 'mid_range' | 'upscale' | 'luxury' | 'broad';
type LifestyleTag = 'foodies' | 'families' | 'date_night' | 'business' | 'tourists' | 'locals' | 'health_conscious' | 'indulgent' | 'social_media_active' | 'adventurous' | 'comfort_seeking' | 'trend_followers';
type VibeAlignment = 'trendy' | 'classic' | 'family_friendly' | 'upscale_casual' | 'dive_authentic' | 'instagram_worthy' | 'neighborhood_gem' | 'hidden_gem';

export default function AnalyzeRateV1Page() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  
  // Rating state
  const [qualityTier, setQualityTier] = useState<QualityTier | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // v1.1: Replicability signals
  const [actorCount, setActorCount] = useState<ActorCount | null>(null);
  const [setupComplexity, setSetupComplexity] = useState<SetupComplexity | null>(null);
  const [skillRequired, setSkillRequired] = useState<SkillRequired | null>(null);
  const [equipmentNeeded, setEquipmentNeeded] = useState<string[]>([]);
  const [replicabilityNotes, setReplicabilityNotes] = useState('');
  
  // v1.1: Environment signals
  const [settingType, setSettingType] = useState<SettingType | null>(null);
  const [spaceRequirements, setSpaceRequirements] = useState<SpaceRequirements | null>(null);
  const [lightingConditions, setLightingConditions] = useState<LightingConditions | null>(null);
  const [customerVisibility, setCustomerVisibility] = useState<string | null>(null);
  
  // v1.1: Risk level signals
  const [contentEdge, setContentEdge] = useState<ContentEdge | null>(null);
  const [humorRisk, setHumorRisk] = useState<HumorRisk | null>(null);
  const [trendReliance, setTrendReliance] = useState<string | null>(null);
  
  // v1.1: Target audience signals
  const [primaryAges, setPrimaryAges] = useState<AgeRange[]>([]); // Changed to multi-select
  const [incomeLevel, setIncomeLevel] = useState<IncomeLevel | null>(null);
  const [lifestyleTags, setLifestyleTags] = useState<LifestyleTag[]>([]);
  const [vibeAlignments, setVibeAlignments] = useState<VibeAlignment[]>([]); // Changed to multi-select
  
  // Analysis notes/corrections state
  const [analysisNotes, setAnalysisNotes] = useState('');
  const [editingAnalysis, setEditingAnalysis] = useState(false);
  
  // UI section expansion state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['replicability', 'environment', 'risk', 'audience']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setQualityTier(null);
    setNotes('');
    setSubmitted(false);
    resetSignals();

    try {
      setStatus('Creating video record...');
      const createRes = await fetch('/api/videos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });

      if (!createRes.ok) {
        const error = await createRes.json();
        throw new Error(error.message || 'Failed to create video record');
      }

      const createData = await createRes.json();
      const videoId = createData.id;

      if (createData.hasAnalysis) {
        setStatus('Found existing analysis, checking format...');
        
        const fullRes = await fetch(`/api/videos/analyze?id=${videoId}`);
        if (fullRes.ok) {
          const fullData = await fullRes.json();
          const cachedAnalysis = fullData.visual_analysis;
          
          // Check if cached analysis has legacy display fields (from GeminiVideoAnalyzer)
          // If it only has Schema v1.1 format (from BrandAnalyzer), we need to re-analyze
          const hasLegacyFields = cachedAnalysis?.visual?.hookStrength !== undefined 
            || cachedAnalysis?.script?.humor?.humorType !== undefined
            || cachedAnalysis?.visual?.summary !== undefined;
          
          if (hasLegacyFields) {
            setStatus('Using cached analysis, fetching similar videos...');
            const ragContext = await fetchSimilarVideos(videoId);
            
            setResult({
              success: true,
              url: fullData.video_url,
              analysis: cachedAnalysis,
              rag_context: ragContext
            });
            setStatus('');
            setLoading(false);
            return;
          } else {
            // Cached analysis is Schema v1.1 only format - need to re-analyze with legacy analyzer
            setStatus('Cached analysis missing display fields, re-analyzing...');
            // Fall through to deep analysis
          }
        }
      }

      setStatus('Downloading and analyzing with Gemini (this may take 30-60s)...');
      const deepRes = await fetch('/api/videos/analyze/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          videoId,
          useSchemaV1: true  // Enable Schema v1.1 for replicability, risk, environment, audience pre-population
        })
      });

      const deepData = await deepRes.json();

      if (!deepRes.ok) {
        throw new Error(deepData.message || deepData.error || 'Deep analysis failed');
      }

      setStatus('Finding similar videos...');
      const ragContext = await fetchSimilarVideos(videoId);

      setResult({
        success: true,
        url: url.trim(),
        analysis: deepData.analysis,
        rag_context: ragContext
      });
      setStatus('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const fetchSimilarVideos = async (videoId: string) => {
    try {
      const res = await fetch(`/api/videos/similar?videoId=${videoId}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        return {
          similar_count: data.videos?.length || 0,
          references: data.videos || []
        };
      }
    } catch (e) {
      console.error('Failed to fetch similar videos:', e);
    }
    return { similar_count: 0, references: [] };
  };

  const resetSignals = () => {
    setActorCount(null);
    setSetupComplexity(null);
    setSkillRequired(null);
    setEquipmentNeeded([]);
    setReplicabilityNotes('');
    setSettingType(null);
    setSpaceRequirements(null);
    setLightingConditions(null);
    setCustomerVisibility(null);
    setContentEdge(null);
    setHumorRisk(null);
    setTrendReliance(null);
    setPrimaryAges([]);
    setIncomeLevel(null);
    setLifestyleTags([]);
    setVibeAlignments([]);
    setAnalysisNotes('');
    setEditingAnalysis(false);
  };

  // Pre-populate signals from Gemini analysis when available
  // This enables "AI suggests, human confirms" workflow
  useEffect(() => {
    if (!result?.analysis) return;
    
    const analysis = result.analysis;
    
    // Debug: Log what we received to help diagnose pre-population issues
    console.log('🔍 Pre-population check:', {
      hasSchemaV1Signals: !!(analysis as any).schema_v1_signals,
      hasRawOutputSignals: !!(analysis as any).raw_output?.signals,
      hasSignals: !!(analysis as any).signals,
      hasLegacyReplicability: !!analysis.script?.replicability,
      analysisKeys: Object.keys(analysis)
    });
    
    // Check for Schema v1.1 signals in multiple possible locations:
    // 1. analysis.schema_v1_signals (merged by deep API)
    // 2. analysis.raw_output.signals (direct BrandAnalyzer output)
    // 3. analysis.signals (older format)
    const signals = (analysis as any).schema_v1_signals 
      || (analysis as any).raw_output?.signals 
      || (analysis as any).signals;
    
    if (signals) {
      console.log('📊 Found Schema v1.1 signals:', {
        replicability: signals.replicability,
        risk_level: signals.risk_level,
        environment_requirements: signals.environment_requirements,
        target_audience: signals.target_audience
      });
    }
    
    // Pre-populate from Schema v1.1 signals
    if (signals?.replicability) {
      const rep = signals.replicability;
      if (rep.actor_count) setActorCount(rep.actor_count as ActorCount);
      if (rep.setup_complexity) setSetupComplexity(rep.setup_complexity as SetupComplexity);
      if (rep.skill_required) setSkillRequired(rep.skill_required as SkillRequired);
      if (rep.equipment_needed?.length) setEquipmentNeeded(rep.equipment_needed);
    }
    
    if (signals?.environment_requirements) {
      const env = signals.environment_requirements;
      if (env.setting_type) setSettingType(env.setting_type as SettingType);
      if (env.space_requirements) setSpaceRequirements(env.space_requirements as SpaceRequirements);
      if (env.lighting_conditions) setLightingConditions(env.lighting_conditions as LightingConditions);
    }
    
    if (signals?.risk_level) {
      const risk = signals.risk_level;
      if (risk.content_edge) setContentEdge(risk.content_edge as ContentEdge);
      if (risk.humor_risk) setHumorRisk(risk.humor_risk as HumorRisk);
    }
    
    if (signals?.target_audience) {
      const audience = signals.target_audience;
      // Support both single value (from AI) and arrays (from human)
      if (audience.age_range?.primary) {
        const primary = audience.age_range.primary as AgeRange;
        const secondary = audience.age_range?.secondary as string | undefined;
        const ages: AgeRange[] = [primary];
        if (secondary && secondary !== 'none' && ['gen_z', 'millennial', 'gen_x', 'boomer', 'broad'].includes(secondary)) {
          ages.push(secondary as AgeRange);
        }
        setPrimaryAges(ages);
      }
      if (audience.income_level) setIncomeLevel(audience.income_level as IncomeLevel);
      if (audience.lifestyle_tags?.length) {
        const validTags = audience.lifestyle_tags.filter((t: string) => 
          ['foodies', 'families', 'date_night', 'business', 'tourists', 'locals', 
           'health_conscious', 'indulgent', 'social_media_active', 'adventurous', 
           'comfort_seeking', 'trend_followers'].includes(t)
        ) as LifestyleTag[];
        if (validTags.length) setLifestyleTags(validTags);
      }
      if (audience.vibe_alignment) {
        // Support both single value and array
        const vibes = Array.isArray(audience.vibe_alignment) 
          ? audience.vibe_alignment as VibeAlignment[]
          : [audience.vibe_alignment as VibeAlignment];
        setVibeAlignments(vibes);
      }
    }
    
    // Fallback: Pre-populate from legacy Gemini script.replicability if present
    // (Only if Schema v1.1 didn't provide values)
    const legacyRep = analysis.script?.replicability;
    if (legacyRep) {
      console.log('📜 Found legacy replicability:', legacyRep);
      
      // Infer actor count from template text
      if (!signals?.replicability?.actor_count) {
        if (legacyRep.requiredElements?.some((e: string) => e.toLowerCase().includes('solo')) 
            || legacyRep.template?.toLowerCase().includes('solo')
            || legacyRep.template?.toLowerCase().includes('one person')) {
          setActorCount('solo');
        } else if (legacyRep.template?.toLowerCase().includes('team') 
            || legacyRep.template?.toLowerCase().includes('group')) {
          setActorCount('small_team');
        }
      }
      
      // Infer complexity from replicability score
      if (!signals?.replicability?.setup_complexity && legacyRep.score) {
        if (legacyRep.score >= 8) {
          setSkillRequired('anyone');
          setSetupComplexity('phone_only');
        } else if (legacyRep.score >= 6) {
          setSkillRequired('basic_editing');
          setSetupComplexity('basic_tripod');
        } else if (legacyRep.score >= 4) {
          setSkillRequired('intermediate');
          setSetupComplexity('lighting_setup');
        } else {
          setSkillRequired('professional');
          setSetupComplexity('full_studio');
        }
      }
    }
  }, [result?.analysis]); // Only run when analysis changes

  const handleSubmitRating = async () => {
    if (!result || !qualityTier) return;
    
    setSubmitting(true);
    try {
      const response = await fetch('/api/analyze-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: result.url,
          quality_tier: qualityTier,
          notes,
          replicability_notes: replicabilityNotes,
          analysis_notes: analysisNotes,
          gemini_analysis: result.analysis,
          similar_videos: result.rag_context?.references || [],
          // v1.1: Complete structured signals
          structured_replicability: {
            actor_count: actorCount,
            setup_complexity: setupComplexity,
            skill_required: skillRequired,
            equipment_needed: equipmentNeeded,
            estimated_time: null // Could add UI for this
          },
          risk_level_signals: {
            content_edge: contentEdge,
            humor_risk: humorRisk,
            trend_reliance: trendReliance,
            controversy_potential: null // Could derive from content_edge
          },
          environment_signals: {
            setting_type: settingType,
            space_requirements: spaceRequirements,
            lighting_conditions: lightingConditions,
            customer_visibility: customerVisibility,
            noise_tolerance: null // Could add UI for this
          },
          target_audience_signals: {
            age_range: primaryAges.length > 0 ? { 
              primary: primaryAges[0], 
              secondary: primaryAges[1] || null 
            } : null,
            income_level: incomeLevel,
            lifestyle_tags: lifestyleTags,
            primary_occasion: null, // Could add UI for this
            vibe_alignment: vibeAlignments.length > 0 ? vibeAlignments : null
          }
        })
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save rating');
      }
    } catch (err) {
      setError('Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setUrl('');
    setResult(null);
    setQualityTier(null);
    setNotes('');
    setSubmitted(false);
    setError(null);
    resetSignals();
  };

  const ScoreBar = ({ label, value }: { label: string; value: number }) => {
    const normalizedValue = Math.min(value * 10, 100);
    return (
      <div className="flex items-center gap-3">
        <span className="w-28 text-sm text-gray-400">{label}</span>
        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
            style={{ width: `${normalizedValue}%` }}
          />
        </div>
        <span className="w-12 text-right text-sm font-mono text-white">
          {value}/10
        </span>
      </div>
    );
  };

  const tierColors: Record<QualityTier, string> = {
    excellent: 'bg-green-600 hover:bg-green-700',
    good: 'bg-blue-600 hover:bg-blue-700',
    mediocre: 'bg-yellow-600 hover:bg-yellow-700',
    bad: 'bg-red-600 hover:bg-red-700'
  };

  const SectionHeader = ({ title, section, color }: { title: string; section: string; color: string }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between py-2"
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <h3 className="text-md font-semibold text-white">{title}</h3>
      </div>
      <svg 
        className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.has(section) ? 'rotate-180' : ''}`}
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  const ButtonGroup = <T extends string>({ 
    options, 
    value, 
    onChange,
    color = 'blue'
  }: { 
    options: { value: T; label: string }[];
    value: T | null;
    onChange: (v: T) => void;
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'pink';
  }) => {
    const colorClasses = {
      blue: 'bg-blue-600 text-white',
      green: 'bg-green-600 text-white',
      purple: 'bg-purple-600 text-white',
      orange: 'bg-orange-600 text-white',
      pink: 'bg-pink-600 text-white'
    };
    
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
              value === opt.value
                ? colorClasses[color]
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  };

  const MultiSelectGroup = <T extends string>({
    options,
    values,
    onChange,
    color = 'blue'
  }: {
    options: { value: T; label: string }[];
    values: T[];
    onChange: (v: T[]) => void;
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'pink';
  }) => {
    const colorClasses = {
      blue: 'bg-blue-600 text-white',
      green: 'bg-green-600 text-white',
      purple: 'bg-purple-600 text-white',
      orange: 'bg-orange-600 text-white',
      pink: 'bg-pink-600 text-white'
    };

    const toggle = (value: T) => {
      if (values.includes(value)) {
        onChange(values.filter(v => v !== value));
      } else {
        onChange([...values, value]);
      }
    };

    return (
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
              values.includes(opt.value)
                ? colorClasses[color]
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Analyze + Rate
                <span className="text-xs font-normal px-2 py-0.5 bg-purple-600 rounded-full">v1.1</span>
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Enhanced data collection with complete fingerprint signals
              </p>
            </div>
            <a 
              href="/analyze-rate" 
              className="text-sm text-gray-500 hover:text-gray-400 flex items-center gap-1"
            >
              <span>Legacy version</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Input Section */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Video URL
          </label>
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@user/video/123..."
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading || submitted}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || submitted}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>

        {/* Status */}
        {status && (
          <div className="mt-6 flex items-center gap-3 text-gray-400">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            {status}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Results */}
        {result && result.analysis && (
          <div className="mt-8 space-y-6">
            {/* Gemini Analysis */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Gemini Analysis</h2>
                <button
                  onClick={() => setEditingAnalysis(!editingAnalysis)}
                  className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {editingAnalysis ? 'Done' : 'Add Notes'}
                </button>
              </div>
              
              <div className="space-y-3 mb-6">
                <ScoreBar label="Hook" value={result.analysis.visual?.hookStrength || 0} />
                <ScoreBar label="Pacing" value={result.analysis.technical?.pacing || 0} />
                <ScoreBar label="Originality" value={result.analysis.script?.originality?.score || 0} />
                <ScoreBar label="Payoff" value={result.analysis.script?.structure?.payoffStrength || 0} />
                <ScoreBar label="Rewatchable" value={result.analysis.engagement?.replayValue || 0} />
                <div className="pt-2 border-t border-gray-700">
                  <ScoreBar label="Quality" value={result.analysis.visual?.overallQuality || 0} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <span className="text-sm text-gray-400">Humor Type</span>
                  <p className="text-white">{result.analysis.script?.humor?.humorType || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Comedy Timing</span>
                  <p className="text-white">{result.analysis.script?.humor?.comedyTiming || 0}/10</p>
                </div>
                {result.analysis.script?.humor?.humorMechanism && (
                  <div className="col-span-2">
                    <span className="text-sm text-gray-400">Humor Mechanism</span>
                    <p className="text-white text-sm">{result.analysis.script.humor.humorMechanism}</p>
                  </div>
                )}
              </div>

              {result.analysis.visual?.summary && (
                <div className="mb-4">
                  <span className="text-sm text-gray-400">Visual Summary</span>
                  <p className="text-white text-sm mt-1">{result.analysis.visual.summary}</p>
                </div>
              )}
              
              {result.analysis.script?.replicability?.template && (
                <div className="mb-4">
                  <span className="text-sm text-gray-400">Replicability Template</span>
                  <p className="text-white text-sm mt-1">{result.analysis.script.replicability.template}</p>
                  {result.analysis.script.replicability.score && (
                    <span className="text-xs text-gray-500 mt-1">
                      Replicability Score: {result.analysis.script.replicability.score}/10
                    </span>
                  )}
                </div>
              )}

              {editingAnalysis && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <label className="block text-sm text-gray-400 mb-2">
                    Correct Gemini&apos;s Analysis
                    <span className="text-gray-500 ml-2">(corrections help improve future analysis)</span>
                  </label>
                  <textarea
                    value={analysisNotes}
                    onChange={(e) => setAnalysisNotes(e.target.value)}
                    placeholder="e.g., 'The humor is actually self-deprecating, not contrast-based' or 'The hook works because of the unexpected reveal'..."
                    className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  {analysisNotes && (
                    <button
                      onClick={async () => {
                        try {
                          await fetch('/api/corrections', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              videoUrl: result.url,
                              originalAnalysis: result.analysis,
                              correction: {
                                humor_type: analysisNotes.includes('humor') ? analysisNotes : undefined,
                                joke_structure: analysisNotes.includes('structure') || analysisNotes.includes('setup') || analysisNotes.includes('payoff') || analysisNotes.includes('hook') ? analysisNotes : undefined
                              },
                              correctionType: 'humor_analysis',
                              notes: analysisNotes
                            })
                          });
                          setEditingAnalysis(false);
                          // Show brief success feedback
                          setStatus('✅ Correction saved for model learning');
                          setTimeout(() => setStatus(''), 2000);
                        } catch (e) {
                          console.error('Failed to save correction:', e);
                          setError('Failed to save correction');
                        }
                      }}
                      className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                    >
                      Save Correction for Learning
                    </button>
                  )}
                </div>
              )}
              
              {/* Show saved notes even when not editing */}
              {!editingAnalysis && analysisNotes && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <span className="text-sm text-gray-400">Your Corrections</span>
                  <p className="text-white text-sm mt-1 bg-gray-800 p-3 rounded-lg">{analysisNotes}</p>
                </div>
              )}
            </div>

            {/* Rating Section */}
            {!submitted ? (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-6">
                <h2 className="text-lg font-semibold">Complete Signal Assessment</h2>
                
                {/* Quality Tier */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Quality Tier *</label>
                  <div className="flex gap-3">
                    {(['excellent', 'good', 'mediocre', 'bad'] as QualityTier[]).map((tier) => (
                      <button
                        key={tier}
                        onClick={() => setQualityTier(tier)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          qualityTier === tier
                            ? tierColors[tier] + ' ring-2 ring-white'
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        {tier.charAt(0).toUpperCase() + tier.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* General Notes */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Your Interpretation</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Why did you rate it this way? What makes it work or not work?"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                  />
                </div>

                {/* =================================================================== */}
                {/* REPLICABILITY SIGNALS */}
                {/* =================================================================== */}
                <div className="border-t border-gray-700 pt-4">
                  <SectionHeader title="Replicability Signals" section="replicability" color="bg-blue-500" />
                  
                  {expandedSections.has('replicability') && (
                    <div className="mt-4 space-y-4 pl-4 border-l-2 border-blue-500/30">
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">How many people appear?</span>
                        <ButtonGroup
                          options={[
                            { value: 'solo', label: '1 Person' },
                            { value: 'duo', label: '2 People' },
                            { value: 'small_team', label: '3-5' },
                            { value: 'large_team', label: '5+' }
                          ]}
                          value={actorCount}
                          onChange={setActorCount}
                          color="blue"
                        />
                      </div>

                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Setup Complexity</span>
                        <ButtonGroup
                          options={[
                            { value: 'phone_only', label: 'Phone Only' },
                            { value: 'basic_tripod', label: 'Tripod' },
                            { value: 'lighting_setup', label: 'Lighting' },
                            { value: 'full_studio', label: 'Studio' }
                          ]}
                          value={setupComplexity}
                          onChange={setSetupComplexity}
                          color="blue"
                        />
                      </div>

                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Skill Required to Recreate</span>
                        <ButtonGroup
                          options={[
                            { value: 'anyone', label: 'Anyone' },
                            { value: 'basic_editing', label: 'Basic Editing' },
                            { value: 'intermediate', label: 'Intermediate' },
                            { value: 'professional', label: 'Professional' }
                          ]}
                          value={skillRequired}
                          onChange={setSkillRequired}
                          color="blue"
                        />
                      </div>

                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Equipment Visible/Required</span>
                        <MultiSelectGroup
                          options={[
                            { value: 'smartphone', label: 'Smartphone' },
                            { value: 'tripod', label: 'Tripod' },
                            { value: 'ring_light', label: 'Ring Light' },
                            { value: 'microphone', label: 'Microphone' },
                            { value: 'camera', label: 'Camera' },
                            { value: 'gimbal', label: 'Gimbal' }
                          ]}
                          values={equipmentNeeded}
                          onChange={setEquipmentNeeded}
                          color="blue"
                        />
                      </div>

                      <div>
                        <textarea
                          value={replicabilityNotes}
                          onChange={(e) => setReplicabilityNotes(e.target.value)}
                          placeholder="Additional replicability notes..."
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm resize-none"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* =================================================================== */}
                {/* ENVIRONMENT SIGNALS */}
                {/* =================================================================== */}
                <div className="border-t border-gray-700 pt-4">
                  <SectionHeader title="Environment Signals" section="environment" color="bg-green-500" />
                  
                  {expandedSections.has('environment') && (
                    <div className="mt-4 space-y-4 pl-4 border-l-2 border-green-500/30">
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Setting Type</span>
                        <ButtonGroup
                          options={[
                            { value: 'kitchen', label: 'Kitchen' },
                            { value: 'dining_room', label: 'Dining Room' },
                            { value: 'bar', label: 'Bar' },
                            { value: 'storefront', label: 'Storefront' },
                            { value: 'outdoor', label: 'Outdoor' },
                            { value: 'mixed', label: 'Mixed' }
                          ]}
                          value={settingType}
                          onChange={setSettingType}
                          color="green"
                        />
                      </div>

                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Space Requirements</span>
                        <ButtonGroup
                          options={[
                            { value: 'minimal', label: 'Minimal/Tight' },
                            { value: 'moderate', label: 'Moderate' },
                            { value: 'spacious', label: 'Spacious' }
                          ]}
                          value={spaceRequirements}
                          onChange={setSpaceRequirements}
                          color="green"
                        />
                      </div>

                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Lighting Conditions</span>
                        <ButtonGroup
                          options={[
                            { value: 'natural', label: 'Natural' },
                            { value: 'artificial', label: 'Artificial' },
                            { value: 'low_light', label: 'Low Light/Moody' },
                            { value: 'flexible', label: 'Flexible' }
                          ]}
                          value={lightingConditions}
                          onChange={setLightingConditions}
                          color="green"
                        />
                      </div>

                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Customer Visibility</span>
                        <ButtonGroup
                          options={[
                            { value: 'no_customers', label: 'No Customers' },
                            { value: 'background', label: 'In Background' },
                            { value: 'featured', label: 'Featured' }
                          ]}
                          value={customerVisibility}
                          onChange={setCustomerVisibility}
                          color="green"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* =================================================================== */}
                {/* RISK LEVEL SIGNALS */}
                {/* =================================================================== */}
                <div className="border-t border-gray-700 pt-4">
                  <SectionHeader title="Risk Level Signals" section="risk" color="bg-orange-500" />
                  
                  {expandedSections.has('risk') && (
                    <div className="mt-4 space-y-4 pl-4 border-l-2 border-orange-500/30">
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Content Edge</span>
                        <ButtonGroup
                          options={[
                            { value: 'brand_safe', label: 'Brand Safe' },
                            { value: 'mildly_edgy', label: 'Mildly Edgy' },
                            { value: 'edgy', label: 'Edgy' },
                            { value: 'provocative', label: 'Provocative' }
                          ]}
                          value={contentEdge}
                          onChange={setContentEdge}
                          color="orange"
                        />
                      </div>

                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Humor Risk</span>
                        <ButtonGroup
                          options={[
                            { value: 'safe_humor', label: 'Safe/Clean' },
                            { value: 'playful', label: 'Playful' },
                            { value: 'sarcastic', label: 'Sarcastic' },
                            { value: 'dark_humor', label: 'Dark Humor' }
                          ]}
                          value={humorRisk}
                          onChange={setHumorRisk}
                          color="orange"
                        />
                      </div>

                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Trend Reliance</span>
                        <ButtonGroup
                          options={[
                            { value: 'evergreen', label: 'Evergreen' },
                            { value: 'light_trends', label: 'Light Trends' },
                            { value: 'trend_dependent', label: 'Trend Dependent' }
                          ]}
                          value={trendReliance}
                          onChange={setTrendReliance}
                          color="orange"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* =================================================================== */}
                {/* TARGET AUDIENCE SIGNALS */}
                {/* =================================================================== */}
                <div className="border-t border-gray-700 pt-4">
                  <SectionHeader title="Target Audience Signals" section="audience" color="bg-pink-500" />
                  
                  {expandedSections.has('audience') && (
                    <div className="mt-4 space-y-4 pl-4 border-l-2 border-pink-500/30">
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Primary Age Groups (select all that apply)</span>
                        <MultiSelectGroup
                          options={[
                            { value: 'gen_z', label: 'Gen Z (18-25)' },
                            { value: 'millennial', label: 'Millennial (26-40)' },
                            { value: 'gen_x', label: 'Gen X (41-56)' },
                            { value: 'boomer', label: 'Boomer (57+)' },
                            { value: 'broad', label: 'Broad Appeal' }
                          ]}
                          values={primaryAges}
                          onChange={setPrimaryAges}
                          color="pink"
                        />
                      </div>

                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Income Level Appeal</span>
                        <ButtonGroup
                          options={[
                            { value: 'budget', label: 'Budget' },
                            { value: 'mid_range', label: 'Mid-Range' },
                            { value: 'upscale', label: 'Upscale' },
                            { value: 'luxury', label: 'Luxury' },
                            { value: 'broad', label: 'Broad' }
                          ]}
                          value={incomeLevel}
                          onChange={setIncomeLevel}
                          color="pink"
                        />
                      </div>

                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Lifestyle Tags (select all that apply)</span>
                        <MultiSelectGroup
                          options={[
                            { value: 'foodies', label: 'Foodies' },
                            { value: 'families', label: 'Families' },
                            { value: 'date_night', label: 'Date Night' },
                            { value: 'business', label: 'Business' },
                            { value: 'tourists', label: 'Tourists' },
                            { value: 'locals', label: 'Locals' },
                            { value: 'health_conscious', label: 'Health Conscious' },
                            { value: 'indulgent', label: 'Indulgent' },
                            { value: 'social_media_active', label: 'Social Media' },
                            { value: 'adventurous', label: 'Adventurous' },
                            { value: 'comfort_seeking', label: 'Comfort Seeking' },
                            { value: 'trend_followers', label: 'Trend Followers' }
                          ]}
                          values={lifestyleTags}
                          onChange={setLifestyleTags}
                          color="pink"
                        />
                      </div>

                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Vibe Alignment (select all that apply)</span>
                        <MultiSelectGroup
                          options={[
                            { value: 'trendy', label: 'Trendy' },
                            { value: 'classic', label: 'Classic' },
                            { value: 'family_friendly', label: 'Family Friendly' },
                            { value: 'upscale_casual', label: 'Upscale Casual' },
                            { value: 'dive_authentic', label: 'Dive/Authentic' },
                            { value: 'instagram_worthy', label: 'Instagram Worthy' },
                            { value: 'neighborhood_gem', label: 'Neighborhood Gem' },
                            { value: 'hidden_gem', label: 'Hidden Gem' }
                          ]}
                          values={vibeAlignments}
                          onChange={setVibeAlignments}
                          color="pink"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Signal completion indicator */}
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Signal Completion</span>
                    <div className="flex items-center gap-4">
                      <span className={actorCount && setupComplexity && skillRequired ? 'text-blue-400' : 'text-gray-600'}>
                        ● Replicability
                      </span>
                      <span className={settingType && spaceRequirements ? 'text-green-400' : 'text-gray-600'}>
                        ● Environment
                      </span>
                      <span className={contentEdge && humorRisk ? 'text-orange-400' : 'text-gray-600'}>
                        ● Risk
                      </span>
                      <span className={primaryAges.length > 0 && incomeLevel ? 'text-pink-400' : 'text-gray-600'}>
                        ● Audience
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmitRating}
                  disabled={!qualityTier || submitting}
                  className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {submitting ? 'Saving...' : 'Save Complete Rating'}
                </button>
              </div>
            ) : (
              <div className="bg-green-900/30 rounded-xl p-6 border border-green-800">
                <h2 className="text-lg font-semibold text-green-300 mb-2">Rating Saved</h2>
                <p className="text-gray-300 mb-4">
                  This video has been added with complete fingerprint signals.
                </p>
                <button
                  onClick={handleReset}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  Rate Another Video
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
