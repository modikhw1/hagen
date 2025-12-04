'use client';

import { useState } from 'react';

interface JokeStructure {
  setup: string;
  mechanism: string;
  twist: string;
  payoff: string;
  payoff_type: string;
}

interface HumorAnalysis {
  primary_type: string;
  secondary_type: string | null;
  why_funny: string;
  what_could_be_missed: string;
}

interface Scores {
  hook: number;
  pacing: number;
  originality: number;
  payoff: number;
  rewatchable: number;
  overall: number;
}

interface AnalysisResult {
  joke_structure: JokeStructure;
  humor_analysis: HumorAnalysis;
  scores: Scores;
  reasoning: string;
  similar_to?: string;
  raw_response?: string;
  parse_error?: boolean;
}

interface RAGReference {
  title: string;
  score: number;
  similarity: number;
  notes_preview: string;
}

interface ApiResponse {
  success: boolean;
  url: string;
  analysis: AnalysisResult;
  rag_context: {
    similar_count: number;
    references: RAGReference[];
  };
  model: string;
  prompt_version: string;
  error?: string;
}

export default function AnalyzeV36Page() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  
  // Correction state
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctedHumorType, setCorrectedHumorType] = useState('');
  const [correctedJokeStructure, setCorrectedJokeStructure] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState(false);

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setStatus('Downloading video...');
    setShowCorrection(false);
    setCorrectionSuccess(false);

    try {
      const response = await fetch('/api/analyze-v36', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });

      setStatus('Processing with Gemini + RAG...');

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResult(data);
      setStatus('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCorrection = async () => {
    if (!result) return;
    if (!correctedHumorType && !correctedJokeStructure && !correctionNotes) return;
    
    setSubmittingCorrection(true);
    try {
      const response = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: result.url,
          originalAnalysis: result.analysis,
          correction: {
            humor_type: correctedHumorType || null,
            joke_structure: correctedJokeStructure || null,
            original_humor_type: result.analysis.humor_analysis?.primary_type,
            original_mechanism: result.analysis.joke_structure?.mechanism
          },
          correctionType: correctedJokeStructure ? 'joke_structure' : 'humor_type',
          notes: correctionNotes
        })
      });

      if (response.ok) {
        setCorrectionSuccess(true);
        setShowCorrection(false);
        setCorrectedHumorType('');
        setCorrectedJokeStructure('');
        setCorrectionNotes('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save correction');
      }
    } catch (err) {
      setError('Failed to submit correction');
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const ScoreBar = ({ label, value }: { label: string; value: number }) => (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm text-gray-400">{label}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className="w-12 text-right text-sm font-mono text-white">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              <span className="text-blue-400">V3.6</span> Humor Analysis
            </h1>
            <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded-full">
              RAG Enhanced
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Analyze with context from your rated videos
          </p>
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
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Supports TikTok, YouTube, and Instagram URLs
          </p>
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
            {/* RAG References */}
            {result.rag_context && result.rag_context.references?.length > 0 && (
              <div className="bg-blue-900/20 rounded-xl p-6 border border-blue-800/50">
                <h2 className="text-lg font-semibold mb-3">
                  Reference Videos Used
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    ({result.rag_context.similar_count} similar found)
                  </span>
                </h2>
                <div className="space-y-2">
                  {result.rag_context.references.slice(0, 3).map((ref, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-blue-400">{((ref.similarity || 0) * 100).toFixed(0)}%</span>
                      <span className="text-white truncate flex-1">{ref.title || 'Untitled'}</span>
                      <span className="text-yellow-400">{ref.score}/10</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parse Error Warning */}
            {result.analysis.parse_error && (
              <div className="p-4 bg-yellow-900/30 border border-yellow-800 rounded-lg">
                <p className="text-yellow-300 text-sm">
                  Could not parse structured response. Raw output shown below.
                </p>
                <pre className="mt-3 text-xs text-gray-300 whitespace-pre-wrap overflow-auto max-h-96">
                  {result.analysis.raw_response}
                </pre>
              </div>
            )}

            {/* Structured Results */}
            {!result.analysis.parse_error && (
              <>
                {/* Scores */}
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    Scores
                    <span className="ml-auto text-3xl font-bold text-blue-400">
                      {((result.analysis.scores?.overall || 0) * 100).toFixed(0)}%
                    </span>
                  </h2>
                  <div className="space-y-3">
                    <ScoreBar label="Hook" value={result.analysis.scores?.hook || 0} />
                    <ScoreBar label="Pacing" value={result.analysis.scores?.pacing || 0} />
                    <ScoreBar label="Originality" value={result.analysis.scores?.originality || 0} />
                    <ScoreBar label="Payoff" value={result.analysis.scores?.payoff || 0} />
                    <ScoreBar label="Rewatchable" value={result.analysis.scores?.rewatchable || 0} />
                  </div>
                </div>

                {/* Joke Structure */}
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                  <h2 className="text-lg font-semibold mb-4">Joke Structure</h2>
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm text-gray-400">Setup</span>
                      <p className="text-white mt-1">{result.analysis.joke_structure?.setup}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400">Mechanism</span>
                      <p className="text-white mt-1">{result.analysis.joke_structure?.mechanism}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400">Twist</span>
                      <p className="text-white mt-1">{result.analysis.joke_structure?.twist}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400">Payoff</span>
                      <p className="text-white mt-1">{result.analysis.joke_structure?.payoff}</p>
                    </div>
                    <div className="pt-2">
                      <span className="inline-block px-3 py-1 bg-blue-900/50 text-blue-300 text-sm rounded-full">
                        {result.analysis.joke_structure?.payoff_type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Humor Analysis */}
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                  <h2 className="text-lg font-semibold mb-4">Humor Analysis</h2>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-3 py-1 bg-cyan-900/50 text-cyan-300 text-sm rounded-full">
                      {result.analysis.humor_analysis?.primary_type}
                    </span>
                    {result.analysis.humor_analysis?.secondary_type && (
                      <span className="px-3 py-1 bg-teal-900/50 text-teal-300 text-sm rounded-full">
                        {result.analysis.humor_analysis.secondary_type}
                      </span>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm text-gray-400">Why It's Funny</span>
                      <p className="text-white mt-1">{result.analysis.humor_analysis?.why_funny}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400">What Could Be Missed</span>
                      <p className="text-gray-300 mt-1">{result.analysis.humor_analysis?.what_could_be_missed}</p>
                    </div>
                  </div>
                </div>

                {/* Reasoning */}
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                  <h2 className="text-lg font-semibold mb-4">Reasoning</h2>
                  <p className="text-gray-300 leading-relaxed">{result.analysis.reasoning}</p>
                  {result.analysis.similar_to && (
                    <p className="mt-4 text-sm text-blue-400">
                      Similar to: {result.analysis.similar_to}
                    </p>
                  )}
                </div>

                {/* Correction Section */}
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                  {correctionSuccess ? (
                    <div className="text-green-400 text-sm">
                      Correction saved. This will improve future analyses.
                    </div>
                  ) : !showCorrection ? (
                    <button
                      onClick={() => setShowCorrection(true)}
                      className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      Correct this analysis
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-gray-300">Provide Corrections</h3>
                      
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Correct humor type / interpretation
                        </label>
                        <textarea
                          value={correctedHumorType}
                          onChange={(e) => setCorrectedHumorType(e.target.value)}
                          placeholder="e.g., 'This is a visual punchline, not subversion. The joke is the abrupt smile drop, not a twist ending.'"
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                          rows={2}
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Correct joke structure / mechanism
                        </label>
                        <textarea
                          value={correctedJokeStructure}
                          onChange={(e) => setCorrectedJokeStructure(e.target.value)}
                          placeholder="e.g., 'The setup is the phrase short-staffed, the punchline is the visual reveal that staff are physically short. It's a pun.'"
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                          rows={2}
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Additional notes
                        </label>
                        <textarea
                          value={correctionNotes}
                          onChange={(e) => setCorrectionNotes(e.target.value)}
                          placeholder="Any other context about what was missed..."
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                          rows={2}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={handleSubmitCorrection}
                          disabled={(!correctedHumorType && !correctedJokeStructure && !correctionNotes) || submittingCorrection}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                        >
                          {submittingCorrection ? 'Saving...' : 'Save Correction'}
                        </button>
                        <button
                          onClick={() => {
                            setShowCorrection(false);
                            setCorrectedHumorType('');
                            setCorrectedJokeStructure('');
                            setCorrectionNotes('');
                          }}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Meta Info */}
                <div className="text-center text-xs text-gray-500 pt-4">
                  Model: {result.model} | Prompt: {result.prompt_version} | 
                  References: {result.rag_context?.similar_count || 0}
                </div>
              </>
            )}
          </div>
        )}

        {/* Version Comparison Link */}
        <div className="mt-12 text-center">
          <a 
            href="/analyze-v35" 
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Compare with v3.5 (no RAG)
          </a>
        </div>
      </div>
    </div>
  );
}
