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
  raw_response?: string;
  parse_error?: boolean;
}

interface ApiResponse {
  success: boolean;
  url: string;
  analysis: AnalysisResult;
  model: string;
  prompt_version: string;
  error?: string;
}

export default function AnalyzeV35Page() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setStatus('Downloading video...');

    try {
      const response = await fetch('/api/analyze-v35', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });

      setStatus('Processing with Gemini...');

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

  const ScoreBar = ({ label, value }: { label: string; value: number }) => (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm text-gray-400">{label}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
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
          <h1 className="text-2xl font-bold">
            <span className="text-purple-400">V3.5</span> Humor Analysis
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Analyze TikTok skit humor structure with the v3.5 teaching prompt
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
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
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
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
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
            {/* Parse Error Warning */}
            {result.analysis.parse_error && (
              <div className="p-4 bg-yellow-900/30 border border-yellow-800 rounded-lg">
                <p className="text-yellow-300 text-sm">
                  ⚠️ Could not parse structured response. Raw output shown below.
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
                    <span className="text-2xl">{getScoreEmoji(result.analysis.scores?.overall || 0)}</span>
                    Scores
                    <span className="ml-auto text-3xl font-bold text-purple-400">
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
                  <h2 className="text-lg font-semibold mb-4">🎭 Joke Structure</h2>
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
                      <span className="inline-block px-3 py-1 bg-purple-900/50 text-purple-300 text-sm rounded-full">
                        {result.analysis.joke_structure?.payoff_type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Humor Analysis */}
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                  <h2 className="text-lg font-semibold mb-4">🔍 Humor Analysis</h2>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-3 py-1 bg-pink-900/50 text-pink-300 text-sm rounded-full">
                      {result.analysis.humor_analysis?.primary_type}
                    </span>
                    {result.analysis.humor_analysis?.secondary_type && (
                      <span className="px-3 py-1 bg-blue-900/50 text-blue-300 text-sm rounded-full">
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
                  <h2 className="text-lg font-semibold mb-4">💭 Reasoning</h2>
                  <p className="text-gray-300 leading-relaxed">{result.analysis.reasoning}</p>
                </div>

                {/* Meta Info */}
                <div className="text-center text-xs text-gray-500 pt-4">
                  Model: {result.model} • Prompt: {result.prompt_version}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getScoreEmoji(score: number): string {
  if (score >= 0.8) return '🔥';
  if (score >= 0.6) return '✨';
  if (score >= 0.4) return '👍';
  if (score >= 0.2) return '😐';
  return '👎';
}
