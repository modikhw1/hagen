'use client';

import { useState } from 'react';

interface AnalysisResult {
  joke_structure: {
    setup: string;
    mechanism: string;
    twist: string;
    payoff: string;
    payoff_type: string;
  };
  humor_analysis: {
    primary_type: string;
    secondary_type: string | null;
    why_funny: string;
    what_could_be_missed: string;
  };
  scores: {
    hook: number;
    pacing: number;
    originality: number;
    payoff: number;
    rewatchable: number;
    overall: number;
  };
  reasoning: string;
}

interface RAGReference {
  title: string;
  score: number;
  similarity: number;
}

interface ApiResponse {
  success: boolean;
  url: string;
  analysis: AnalysisResult;
  rag_context: {
    similar_count: number;
    references: RAGReference[];
  };
}

type QualityTier = 'excellent' | 'good' | 'mediocre' | 'bad';

export default function AnalyzeRatePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  
  // Rating state
  const [qualityTier, setQualityTier] = useState<QualityTier | null>(null);
  const [notes, setNotes] = useState('');
  const [replicabilityNotes, setReplicabilityNotes] = useState('');
  const [brandToneNotes, setBrandToneNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setStatus('Downloading video...');
    setQualityTier(null);
    setNotes('');
    setReplicabilityNotes('');
    setBrandToneNotes('');
    setSubmitted(false);

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
          brand_tone_notes: brandToneNotes,
          gemini_analysis: result.analysis,
          similar_videos: result.rag_context?.references || []
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
    setReplicabilityNotes('');
    setBrandToneNotes('');
    setSubmitted(false);
    setError(null);
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

  const tierColors: Record<QualityTier, string> = {
    excellent: 'bg-green-600 hover:bg-green-700',
    good: 'bg-blue-600 hover:bg-blue-700',
    mediocre: 'bg-yellow-600 hover:bg-yellow-700',
    bad: 'bg-red-600 hover:bg-red-700'
  };

  const tierLabels: Record<QualityTier, string> = {
    excellent: 'Excellent',
    good: 'Good',
    mediocre: 'Mediocre',
    bad: 'Bad'
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">Analyze + Rate</h1>
          <p className="text-gray-400 text-sm mt-1">
            Analyze video, then rate with your interpretation
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
              <h2 className="text-lg font-semibold mb-4">Gemini Analysis</h2>
              
              {/* Scores */}
              <div className="space-y-3 mb-6">
                <ScoreBar label="Hook" value={result.analysis.scores?.hook || 0} />
                <ScoreBar label="Pacing" value={result.analysis.scores?.pacing || 0} />
                <ScoreBar label="Originality" value={result.analysis.scores?.originality || 0} />
                <ScoreBar label="Payoff" value={result.analysis.scores?.payoff || 0} />
                <ScoreBar label="Rewatchable" value={result.analysis.scores?.rewatchable || 0} />
                <div className="pt-2 border-t border-gray-700">
                  <ScoreBar label="Overall" value={result.analysis.scores?.overall || 0} />
                </div>
              </div>

              {/* Humor Analysis */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <span className="text-sm text-gray-400">Humor Type</span>
                  <p className="text-white">{result.analysis.humor_analysis?.primary_type || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Mechanism</span>
                  <p className="text-white">{result.analysis.joke_structure?.mechanism || 'Unknown'}</p>
                </div>
              </div>

              {/* Why Funny */}
              <div className="mb-4">
                <span className="text-sm text-gray-400">Why It Works</span>
                <p className="text-white text-sm mt-1">{result.analysis.humor_analysis?.why_funny || 'N/A'}</p>
              </div>

              {/* What Could Be Missed */}
              {result.analysis.humor_analysis?.what_could_be_missed && (
                <div>
                  <span className="text-sm text-gray-400">What Could Be Missed</span>
                  <p className="text-white text-sm mt-1">{result.analysis.humor_analysis.what_could_be_missed}</p>
                </div>
              )}
            </div>

            {/* Rating Section */}
            {!submitted ? (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h2 className="text-lg font-semibold mb-4">Your Rating</h2>
                
                {/* Quality Tier */}
                <div className="mb-6">
                  <label className="block text-sm text-gray-400 mb-2">Quality Tier</label>
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
                        {tierLabels[tier]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2">
                    Your Interpretation / Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Why did you rate it this way? What makes it work or not work?"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                  />
                </div>

                {/* Replicability */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2">
                    Replicability Notes
                  </label>
                  <textarea
                    value={replicabilityNotes}
                    onChange={(e) => setReplicabilityNotes(e.target.value)}
                    placeholder="Solo performer? Props needed? Editing complexity? Location requirements?"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                  />
                </div>

                {/* Brand/Tone */}
                <div className="mb-6">
                  <label className="block text-sm text-gray-400 mb-2">
                    Brand / Tone / Audience Notes
                  </label>
                  <textarea
                    value={brandToneNotes}
                    onChange={(e) => setBrandToneNotes(e.target.value)}
                    placeholder="What type of business could use this? Any risks? Gen Z specific? Broad appeal?"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmitRating}
                  disabled={!qualityTier || submitting}
                  className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {submitting ? 'Saving...' : 'Save Rating'}
                </button>
              </div>
            ) : (
              <div className="bg-green-900/30 rounded-xl p-6 border border-green-800">
                <h2 className="text-lg font-semibold text-green-300 mb-2">Rating Saved</h2>
                <p className="text-gray-300 mb-4">This video has been added to your training data.</p>
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
