'use client';

import { useState, useEffect, useCallback } from 'react';

interface Video {
  id: string;
  source_url: string;
  title?: string;
  platform: string;
  thumbnail_url?: string;
  gcs_uri?: string;
}

interface ExtractedCriterion {
  name: string;
  value: number;
  confidence: number;
  evidence: string;
}

interface SimilarVideo {
  id: string;
  title?: string;
  overall_score: number;
  similarity: number;
  notes?: string;
}

interface Prediction {
  overall: number;
  confidence: number;
  reasoning: string;
  similarVideos: SimilarVideo[];
  suggestedCriteria: ExtractedCriterion[];
}

type ViewMode = 'rate' | 'import' | 'criteria';

export default function RateV2Page() {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('rate');
  
  // Video queue state
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Rating state - SIMPLIFIED: just overall + notes
  const [overall, setOverall] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isNotRelevant, setIsNotRelevant] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Extracted criteria (populated after submission or on-the-fly)
  const [extractedCriteria, setExtractedCriteria] = useState<ExtractedCriterion[]>([]);
  const [extracting, setExtracting] = useState(false);
  
  // RAG Prediction
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predicting, setPredicting] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({ total: 0, today: 0, criteriaCount: 0 });
  
  // Import state
  const [importUrls, setImportUrls] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  
  // Known criteria (discovered so far)
  const [knownCriteria, setKnownCriteria] = useState<string[]>([]);

  useEffect(() => {
    fetchVideos();
    fetchStats();
    fetchKnownCriteria();
  }, []);

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/ratings?unrated=true');
      const data = await res.json();
      setVideos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Get rating count
      const res = await fetch('/api/ratings/export', { method: 'POST' });
      const data = await res.json();
      
      // Get discovered criteria count
      const criteriaRes = await fetch('/api/extract-criteria');
      const criteriaData = await criteriaRes.json();
      
      setStats({ 
        total: data.total_ratings || 0, 
        today: 0,
        criteriaCount: criteriaData.criteria?.length || 0
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchKnownCriteria = async () => {
    try {
      const res = await fetch('/api/extract-criteria');
      const data = await res.json();
      setKnownCriteria(data.criteria?.map((c: { name: string }) => c.name) || []);
    } catch (err) {
      console.error('Failed to fetch criteria:', err);
    }
  };

  // Extract criteria from notes (can be called live as user types)
  const extractCriteriaFromNotes = async () => {
    if (!notes.trim() || notes.length < 20) return;
    
    setExtracting(true);
    try {
      const res = await fetch('/api/extract-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, knownCriteria })
      });
      const data = await res.json();
      if (data.criteria) {
        setExtractedCriteria(data.criteria);
      }
    } catch (err) {
      console.error('Failed to extract criteria:', err);
    } finally {
      setExtracting(false);
    }
  };

  // Debounced extraction as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      if (notes.length > 50) {
        extractCriteriaFromNotes();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [notes]);

  // Get RAG-based prediction
  const getPrediction = async () => {
    if (!videos[0]) return;
    
    setPredicting(true);
    try {
      const res = await fetch('/api/predict-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: videos[0].id })
      });
      const data = await res.json();
      if (data.prediction) {
        setPrediction(data.prediction);
      }
    } catch (err) {
      console.error('Failed to get prediction:', err);
    } finally {
      setPredicting(false);
    }
  };

  const submitRating = useCallback(async () => {
    if (!videos[0] || submitting) return;
    if (!isNotRelevant && overall === null) return;
    
    const ratedVideoId = videos[0].id;
    setSubmitting(true);
    
    try {
      // Use new V2 ratings endpoint
      await fetch('/api/ratings-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: ratedVideoId,
          overall_score: isNotRelevant ? null : overall,
          notes: notes || null,
          is_not_relevant: isNotRelevant,
          // Include extracted criteria and prediction for reference
          extracted_criteria: extractedCriteria,
          ai_prediction: prediction
        })
      });
      
      setStats(s => ({ ...s, total: s.total + 1, today: s.today + 1 }));
      
      // Remove rated video and reset
      setVideos(prev => prev.filter(v => v.id !== ratedVideoId));
      resetForm();
      
      // Refresh criteria list (might have discovered new ones)
      fetchKnownCriteria();
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setSubmitting(false);
    }
  }, [videos, overall, notes, submitting, isNotRelevant, extractedCriteria, prediction]);

  const resetForm = () => {
    setOverall(null);
    setNotes('');
    setIsNotRelevant(false);
    setExtractedCriteria([]);
    setPrediction(null);
  };

  const skipVideo = () => {
    if (!videos[0]) return;
    setVideos(prev => [...prev.slice(1), prev[0]]); // Move to end
    resetForm();
  };

  // Bulk import
  const handleBulkImport = async () => {
    const urls = importUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0 && (u.includes('tiktok.com') || u.includes('youtube.com') || u.includes('youtu.be')));

    if (urls.length === 0) {
      alert('No valid TikTok or YouTube URLs found');
      return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: urls.length });

    const results = { success: 0, failed: 0 };

    for (const url of urls) {
      try {
        const platform = url.includes('tiktok.com') ? 'tiktok' : 'youtube';
        const endpoint = platform === 'tiktok' ? '/api/tiktok' : '/api/youtube';
        
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        if (res.ok) results.success++;
        else results.failed++;
      } catch {
        results.failed++;
      }
      
      setImportProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }

    setImporting(false);
    setImportUrls('');
    alert(`Import complete: ${results.success} succeeded, ${results.failed} failed`);
    fetchVideos();
    fetchStats();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
      
      if (viewMode !== 'rate') return;
      
      // Number keys for overall score (when not typing)
      if (!isTyping && e.key >= '1' && e.key <= '9' && !e.metaKey && !e.ctrlKey) {
        setOverall(parseInt(e.key) / 10);
        setIsNotRelevant(false);
      }
      if (!isTyping && e.key === '0' && !e.metaKey && !e.ctrlKey) {
        setOverall(1.0);
        setIsNotRelevant(false);
      }
      
      // Submit with Cmd/Ctrl + Enter
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submitRating();
      }
      
      // Skip with S (when not typing)
      if (!isTyping && e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        skipVideo();
      }
      
      // Toggle not relevant with N
      if (!isTyping && e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsNotRelevant(r => !r);
        if (!isNotRelevant) setOverall(null);
      }
      
      // Get prediction with P
      if (!isTyping && e.key === 'p' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        getPrediction();
      }
      
      // Focus notes with Tab
      if (!isTyping && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('notes-input')?.focus();
      }
    };
    
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [submitRating, viewMode, isNotRelevant]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading videos...</div>
      </div>
    );
  }

  const currentVideo = videos[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-gray-800">Rate Videos</h1>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                V2 - Limitless
              </span>
            </div>
            <div className="flex gap-1">
              {(['rate', 'import', 'criteria'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    viewMode === mode
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {mode === 'rate' && `Rate (${videos.length})`}
                  {mode === 'import' && 'Import'}
                  {mode === 'criteria' && `Criteria (${stats.criteriaCount})`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-2 flex justify-between text-sm text-gray-500">
          <span>{stats.total} rated • {stats.criteriaCount} criteria discovered</span>
          <span>{videos.length} remaining</span>
        </div>
      </div>

      {/* Import View */}
      {viewMode === 'import' && (
        <div className="max-w-3xl mx-auto p-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Import Videos</h2>
            <p className="text-sm text-gray-500 mb-4">
              Paste TikTok or YouTube URLs, one per line.
            </p>
            <textarea
              value={importUrls}
              onChange={e => setImportUrls(e.target.value)}
              placeholder={`https://www.tiktok.com/@user/video/123\nhttps://www.youtube.com/watch?v=abc`}
              className="w-full border rounded-lg p-3 text-sm h-64 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={importing}
            />
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-gray-500">
                {importUrls.split('\n').filter(u => u.trim()).length} URLs
              </span>
              <button
                onClick={handleBulkImport}
                disabled={importing || !importUrls.trim()}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
              >
                {importing ? `Importing ${importProgress.current}/${importProgress.total}...` : 'Import'}
              </button>
            </div>
            {importing && (
              <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Criteria View */}
      {viewMode === 'criteria' && (
        <div className="max-w-3xl mx-auto p-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Discovered Criteria</h2>
            <p className="text-sm text-gray-500 mb-4">
              These criteria have been extracted from your rating notes. The system learns what you care about.
            </p>
            {knownCriteria.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No criteria discovered yet. Start rating videos with detailed notes!
              </div>
            ) : (
              <div className="space-y-2">
                {knownCriteria.map(criteria => (
                  <div key={criteria} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">{criteria}</span>
                    <span className="text-xs text-gray-400">Discovered</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rate View */}
      {viewMode === 'rate' && (
        <>
          {!currentVideo ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-5xl mb-4">🎉</div>
              <div className="text-xl text-gray-700 mb-2">All caught up!</div>
              <div className="text-gray-500 mb-6">Import more videos to continue</div>
              <button
                onClick={() => setViewMode('import')}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Import Videos
              </button>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto p-4">
              {/* Keyboard hints */}
              <div className="text-xs text-gray-400 mb-3 flex flex-wrap gap-3">
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">1-9</kbd> score</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">0</kbd> perfect</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">⌘↵</kbd> submit</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">s</kbd> skip</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">n</kbd> not relevant</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">p</kbd> predict</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Tab</kbd> notes</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Video embed - takes 2 columns */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="aspect-video bg-gray-100">
                      {currentVideo.platform === 'tiktok' ? (
                        <iframe 
                          src={`https://www.tiktok.com/embed/v2/${extractTikTokId(currentVideo.source_url)}`}
                          className="w-full h-full"
                          allowFullScreen
                        />
                      ) : currentVideo.platform === 'youtube' ? (
                        <iframe
                          src={`https://www.youtube.com/embed/${extractYouTubeId(currentVideo.source_url)}?autoplay=1`}
                          className="w-full h-full"
                          allowFullScreen
                          allow="autoplay"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <a 
                            href={currentVideo.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            Open video →
                          </a>
                        </div>
                      )}
                    </div>
                    {currentVideo.title && (
                      <div className="p-3 border-t text-sm text-gray-600 truncate">
                        {currentVideo.title}
                      </div>
                    )}
                  </div>

                  {/* AI Prediction Panel */}
                  {prediction && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4 mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-blue-800">AI Prediction (RAG)</span>
                        <button
                          onClick={() => {
                            setOverall(prediction.overall);
                            setNotes(prediction.reasoning);
                          }}
                          className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Apply
                        </button>
                      </div>
                      <div className="flex items-center gap-4 mb-3">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600">{prediction.overall.toFixed(2)}</div>
                          <div className="text-xs text-blue-500">Predicted</div>
                        </div>
                        <div className="flex-1 text-sm text-gray-700">
                          {prediction.reasoning}
                        </div>
                      </div>
                      {prediction.similarVideos.length > 0 && (
                        <div className="border-t border-blue-200 pt-3 mt-3">
                          <div className="text-xs text-blue-600 mb-2">Similar rated videos:</div>
                          <div className="space-y-1">
                            {prediction.similarVideos.slice(0, 3).map(v => (
                              <div key={v.id} className="text-xs text-gray-600 flex justify-between">
                                <span className="truncate flex-1">{v.title || v.id}</span>
                                <span className="text-blue-600 font-medium ml-2">{v.overall_score.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!prediction && (
                    <button
                      onClick={getPrediction}
                      disabled={predicting}
                      className="w-full mt-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
                    >
                      {predicting ? 'Getting prediction...' : '🔮 Get AI Prediction (P)'}
                    </button>
                  )}
                </div>

                {/* Rating Panel - Right column */}
                <div className="space-y-4">
                  {/* Not Relevant Toggle */}
                  <div className="bg-white rounded-xl shadow-sm border p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isNotRelevant}
                        onChange={e => {
                          setIsNotRelevant(e.target.checked);
                          if (e.target.checked) setOverall(null);
                        }}
                        className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <div>
                        <span className="font-medium text-gray-700">Not relevant</span>
                        <p className="text-xs text-gray-400">Skip training on this</p>
                      </div>
                    </label>
                  </div>

                  {/* Overall Score - Big and simple */}
                  {!isNotRelevant && (
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                      <div className="text-center">
                        <div className="text-6xl font-bold text-gray-800 tabular-nums mb-2">
                          {overall !== null ? overall.toFixed(1) : '—'}
                        </div>
                        <div className="text-gray-400 text-sm mb-4">Overall Score</div>
                        
                        {/* Quick score buttons */}
                        <div className="grid grid-cols-3 gap-2">
                          {[0.3, 0.5, 0.6, 0.7, 0.8, 0.9].map(score => (
                            <button
                              key={score}
                              onClick={() => setOverall(score)}
                              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                                overall === score 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {score.toFixed(1)}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setOverall(1.0)}
                          className={`w-full mt-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                            overall === 1.0 
                              ? 'bg-green-500 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          🌟 1.0 Perfect
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Notes - The Key Input! */}
                  <div className="bg-white rounded-xl shadow-sm border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        Notes <span className="text-gray-400 font-normal">(AI extracts criteria)</span>
                      </label>
                      {extracting && (
                        <span className="text-xs text-blue-500 animate-pulse">Extracting...</span>
                      )}
                    </div>
                    <textarea
                      id="notes-input"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder={isNotRelevant 
                        ? "Why not relevant?" 
                        : "What makes this good/bad? Be specific about what you notice...\n\ne.g., \"Great hook - immediately shows the transformation. Could replicate this with basic equipment. The acting feels natural, not forced.\""}
                      className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={6}
                    />
                    <div className="text-xs text-gray-400 mt-2">
                      The more detail you provide, the better the AI learns your preferences
                    </div>
                  </div>

                  {/* Extracted Criteria Preview */}
                  {extractedCriteria.length > 0 && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4">
                      <div className="text-xs font-medium text-green-700 mb-2">
                        ✨ Extracted from your notes:
                      </div>
                      <div className="space-y-1">
                        {extractedCriteria.map(c => (
                          <div key={c.name} className="flex justify-between text-sm">
                            <span className="text-gray-700">{c.name}</span>
                            <span className={`font-medium ${
                              c.value > 0.7 ? 'text-green-600' : c.value < 0.4 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {c.value.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-2">
                    <button
                      onClick={submitRating}
                      disabled={(overall === null && !isNotRelevant) || submitting}
                      className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors"
                    >
                      {submitting ? 'Saving...' : isNotRelevant ? 'Mark Not Relevant' : 'Submit (⌘+Enter)'}
                    </button>
                    <button
                      onClick={skipVideo}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl transition-colors"
                    >
                      Skip (S)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function extractTikTokId(url: string): string {
  const match = url.match(/video\/(\d+)/);
  return match?.[1] || '';
}

function extractYouTubeId(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/|\/shorts\/)([^&?]+)/);
  return match?.[1] || '';
}
