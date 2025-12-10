'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Types
interface Video {
  id: string;
  video_url: string;
  video_id: string;
  platform: string;
  metadata: {
    title?: string;
    author?: {
      username?: string;
      displayName?: string;
    } | string;
    thumbnail_url?: string;
  } | null;
  visual_analysis: Record<string, unknown> | null;
  rating: {
    overall_score: number;
    notes: string | null;
    rated_at: string;
  } | null;
}

interface BrandRating {
  id: string;
  video_id: string;
  personality_notes: string;
  statement_notes: string;
  corrections?: string;
  extracted_signals?: Record<string, unknown>;
  created_at: string;
}

interface SimilarVideo {
  video_id: string;
  video_url: string;
  personality_notes: string;
  statement_notes: string;
  similarity: number;
}

// Custom Slider Component
function Slider({ 
  value, 
  onChange, 
  min = 1, 
  max = 10,
  labels 
}: { 
  value: number; 
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  labels?: { left: string; right: string };
}) {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="space-y-2">
      {labels && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>{labels.left}</span>
          <span>{labels.right}</span>
        </div>
      )}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #374151 ${percentage}%, #374151 100%)`
          }}
        />
        <div className="flex justify-between mt-1">
          {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
            <span 
              key={n} 
              className={`text-xs ${value === n ? 'text-blue-400 font-bold' : 'text-gray-600'}`}
            >
              {n}
            </span>
          ))}
        </div>
      </div>
      <div className="text-center">
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className="text-gray-400 text-sm ml-1">/ {max}</span>
      </div>
    </div>
  );
}

// Age Range Slider Component
function AgeRangeSlider({
  minAge,
  maxAge,
  onChange
}: {
  minAge: number;
  maxAge: number;
  onChange: (min: number, max: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null);
  
  const ageMin = 12;
  const ageMax = 65;
  
  const getPercentage = (age: number) => ((age - ageMin) / (ageMax - ageMin)) * 100;
  
  const handleMouseDown = (handle: 'min' | 'max') => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(handle);
  };
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !trackRef.current) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const age = Math.round(ageMin + (percentage / 100) * (ageMax - ageMin));
    
    if (dragging === 'min') {
      onChange(Math.min(age, maxAge - 1), maxAge);
    } else {
      onChange(minAge, Math.max(age, minAge + 1));
    }
  }, [dragging, minAge, maxAge, onChange]);
  
  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);
  
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);
  
  const ageMarkers = [12, 18, 25, 35, 45, 55, 65];
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Youth (12)</span>
        <span>Senior (65)</span>
      </div>
      
      <div 
        ref={trackRef}
        className="relative h-2 bg-gray-700 rounded-full cursor-pointer"
      >
        {/* Selected range */}
        <div 
          className="absolute h-full bg-blue-500 rounded-full"
          style={{
            left: `${getPercentage(minAge)}%`,
            width: `${getPercentage(maxAge) - getPercentage(minAge)}%`
          }}
        />
        
        {/* Min handle */}
        <div
          className={`absolute w-5 h-5 bg-white rounded-full shadow-lg cursor-grab transform -translate-x-1/2 -translate-y-1/2 top-1/2 border-2 border-blue-500 ${dragging === 'min' ? 'cursor-grabbing scale-110' : 'hover:scale-110'} transition-transform`}
          style={{ left: `${getPercentage(minAge)}%` }}
          onMouseDown={handleMouseDown('min')}
        />
        
        {/* Max handle */}
        <div
          className={`absolute w-5 h-5 bg-white rounded-full shadow-lg cursor-grab transform -translate-x-1/2 -translate-y-1/2 top-1/2 border-2 border-blue-500 ${dragging === 'max' ? 'cursor-grabbing scale-110' : 'hover:scale-110'} transition-transform`}
          style={{ left: `${getPercentage(maxAge)}%` }}
          onMouseDown={handleMouseDown('max')}
        />
      </div>
      
      {/* Age markers */}
      <div className="flex justify-between">
        {ageMarkers.map((age) => (
          <span 
            key={age}
            className={`text-xs ${age >= minAge && age <= maxAge ? 'text-blue-400' : 'text-gray-600'}`}
          >
            {age}
          </span>
        ))}
      </div>
      
      {/* Display selected range */}
      <div className="text-center">
        <span className="text-2xl font-bold text-white">{minAge} - {maxAge}</span>
        <span className="text-gray-400 text-sm ml-2">years old</span>
      </div>
    </div>
  );
}

export default function BrandAnalysisPage() {
  // Video list state
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  
  // Selection state
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  
  // NEW: Analysis state
  const [survivalScore, setSurvivalScore] = useState(5);
  const [survivalNotes, setSurvivalNotes] = useState('');
  
  const [coolnessScore, setCoolnessScore] = useState(5);
  const [coolnessNotes, setCoolnessNotes] = useState('');
  
  const [targetAgeMin, setTargetAgeMin] = useState(18);
  const [targetAgeMax, setTargetAgeMax] = useState(35);
  const [audienceNotes, setAudienceNotes] = useState('');
  
  // LEGACY: Brand rating state (still supported)
  const [personalityNotes, setPersonalityNotes] = useState('');
  const [statementNotes, setStatementNotes] = useState('');
  const [corrections, setCorrections] = useState('');
  const [existingRating, setExistingRating] = useState<BrandRating | null>(null);
  
  // Similar videos
  const [similarVideos, setSimilarVideos] = useState<SimilarVideo[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  
  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'signals' | 'brand'>('signals');

  // Fetch rated videos from library
  const fetchVideos = useCallback(async () => {
    setLoadingVideos(true);
    try {
      const res = await fetch('/api/ratings?limit=100');
      if (!res.ok) throw new Error('Failed to fetch videos');
      const data = await res.json();
      
      const transformedVideos: Video[] = data.map((r: any) => ({
        id: r.video?.id || r.video_id,
        video_url: r.video?.video_url || '',
        video_id: r.video?.video_id || '',
        platform: r.video?.platform || 'unknown',
        metadata: r.video?.metadata || null,
        visual_analysis: r.video?.visual_analysis || null,
        rating: {
          overall_score: r.overall_score,
          notes: r.notes,
          rated_at: r.rated_at,
        },
      }));
      
      setVideos(transformedVideos);
      setVideoError(null);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoadingVideos(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Reset form
  const resetForm = useCallback(() => {
    setExistingRating(null);
    setPersonalityNotes('');
    setStatementNotes('');
    setCorrections('');
    setSurvivalScore(5);
    setSurvivalNotes('');
    setCoolnessScore(5);
    setCoolnessNotes('');
    setTargetAgeMin(18);
    setTargetAgeMax(35);
    setAudienceNotes('');
  }, []);

  // Load existing rating when video is selected
  const loadExistingRating = useCallback(async (videoId: string) => {
    try {
      const res = await fetch(`/api/brand-analysis?video_id=${videoId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.rating) {
          setExistingRating(data.rating);
          setPersonalityNotes(data.rating.personality_notes || '');
          setStatementNotes(data.rating.statement_notes || '');
          setCorrections(data.rating.corrections || '');
          
          // Load signal data if exists
          if (data.rating.extracted_signals) {
            const signals = data.rating.extracted_signals;
            if (signals.survival_score) setSurvivalScore(signals.survival_score);
            if (signals.survival_notes) setSurvivalNotes(signals.survival_notes);
            if (signals.coolness_score) setCoolnessScore(signals.coolness_score);
            if (signals.coolness_notes) setCoolnessNotes(signals.coolness_notes);
            if (signals.target_age_min) setTargetAgeMin(signals.target_age_min);
            if (signals.target_age_max) setTargetAgeMax(signals.target_age_max);
            if (signals.audience_notes) setAudienceNotes(signals.audience_notes);
          }
        } else {
          resetForm();
        }
      }
    } catch (e) {
      console.error('Failed to load existing rating:', e);
    }
  }, [resetForm]);

  // Load similar videos
  const loadSimilarVideos = useCallback(async (videoId: string) => {
    setLoadingSimilar(true);
    try {
      const res = await fetch(`/api/brand-analysis/similar?video_id=${videoId}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setSimilarVideos(data.videos || []);
      }
    } catch (e) {
      console.error('Failed to load similar videos:', e);
    } finally {
      setLoadingSimilar(false);
    }
  }, []);

  // Handle video selection
  const handleSelectVideo = (video: Video) => {
    setSelectedVideoId(video.id);
    setSelectedVideo(video);
    setSubmitted(false);
    setSubmitError(null);
    loadExistingRating(video.id);
    loadSimilarVideos(video.id);
  };

  // Handle submission
  const handleSubmit = async () => {
    if (!selectedVideo) return;
    
    setSubmitting(true);
    setSubmitError(null);
    
    try {
      const res = await fetch('/api/brand-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: selectedVideo.id,
          video_url: selectedVideo.video_url,
          personality_notes: personalityNotes,
          statement_notes: statementNotes,
          corrections: corrections || null,
          ai_analysis: null,
          extracted_signals: {
            // New signal fields
            survival_score: survivalScore,
            survival_notes: survivalNotes,
            coolness_score: coolnessScore,
            coolness_notes: coolnessNotes,
            target_age_min: targetAgeMin,
            target_age_max: targetAgeMax,
            audience_notes: audienceNotes
          }
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      
      setSubmitted(true);
      loadSimilarVideos(selectedVideo.id);
      
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save rating');
    } finally {
      setSubmitting(false);
    }
  };

  // Get quality tier color
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-blue-400';
    if (score >= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Safely get author name from metadata
  const getAuthorName = (metadata: Video['metadata']): string => {
    if (!metadata?.author) return 'Unknown';
    if (typeof metadata.author === 'string') return metadata.author;
    return metadata.author.displayName || metadata.author.username || 'Unknown';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Custom slider styles */}
      <style jsx global>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #3b82f6;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #3b82f6;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
      `}</style>

      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">Brand Analysis</h1>
          <p className="text-gray-400 text-sm mt-1">
            Analyze survival instinct, social positioning, and target audience signals
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Panel: Video List */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-semibold">Rated Videos</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {videos.length} videos available
                </p>
              </div>
              
              {loadingVideos ? (
                <div className="p-4 text-gray-400">Loading...</div>
              ) : videoError ? (
                <div className="p-4 text-red-400">{videoError}</div>
              ) : (
                <div className="max-h-[700px] overflow-y-auto">
                  {videos.map((video) => (
                    <button
                      key={video.id}
                      onClick={() => handleSelectVideo(video)}
                      className={`w-full p-4 text-left border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                        selectedVideoId === video.id ? 'bg-gray-800' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 bg-gray-700 rounded flex-shrink-0 flex items-center justify-center">
                          <span className="text-2xl">🎬</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {video.metadata?.title || video.video_id}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {video.platform} • {getAuthorName(video.metadata)}
                          </p>
                          {video.rating && (
                            <p className={`text-xs mt-1 ${getScoreColor(video.rating.overall_score)}`}>
                              Score: {Math.round(video.rating.overall_score * 100)}%
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Center + Right: Analysis Form */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedVideo ? (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
                <div className="text-6xl mb-4">👈</div>
                <h3 className="text-lg font-medium text-gray-300">Select a Video</h3>
                <p className="text-gray-500 mt-2">
                  Choose a rated video from the list to analyze its brand signals
                </p>
              </div>
            ) : (
              <>
                {/* Selected Video Info */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 bg-gray-700 rounded flex-shrink-0 flex items-center justify-center">
                      <span className="text-4xl">🎬</span>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold">
                        {selectedVideo.metadata?.title || selectedVideo.video_id}
                      </h2>
                      <p className="text-sm text-gray-400 mt-1">
                        {selectedVideo.platform} • {getAuthorName(selectedVideo.metadata)}
                      </p>
                      <a
                        href={selectedVideo.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block"
                      >
                        Open Video ↗
                      </a>
                      {existingRating && (
                        <p className="text-xs text-green-400 mt-2">
                          ✓ Previously rated on {new Date(existingRating.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('signals')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      activeTab === 'signals' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    📊 Signals Analysis
                  </button>
                  <button
                    onClick={() => setActiveTab('brand')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      activeTab === 'brand' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    🎭 Brand Identity
                  </button>
                </div>

                {activeTab === 'signals' ? (
                  <>
                    {/* Section 1: Survival Instinct */}
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl">🎯</span>
                        <div>
                          <h3 className="font-semibold text-lg">Survival Instinct</h3>
                          <p className="text-sm text-gray-400">
                            Business mentality: Abundance vs. Scarcity mindset
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                        <Slider
                          value={survivalScore}
                          onChange={setSurvivalScore}
                          min={1}
                          max={10}
                          labels={{ 
                            left: '😌 Low Survival (Abundance)', 
                            right: '🔥 High Survival (Scarcity)' 
                          }}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                        <div className="bg-gray-800/30 rounded-lg p-3">
                          <p className="text-gray-400 font-medium mb-2">Low Survival Signals:</p>
                          <ul className="text-gray-500 space-y-1">
                            <li>• Security buffer / inherited position</li>
                            <li>• Diffused accountability</li>
                            <li>• &quot;What feels right?&quot; mentality</li>
                            <li>• Inconsistent posting</li>
                            <li>• Status game over results</li>
                          </ul>
                        </div>
                        <div className="bg-gray-800/30 rounded-lg p-3">
                          <p className="text-gray-400 font-medium mb-2">High Survival Signals:</p>
                          <ul className="text-gray-500 space-y-1">
                            <li>• Resource scarcity encoding</li>
                            <li>• Outcome obsession</li>
                            <li>• &quot;What converts?&quot; mentality</li>
                            <li>• Ruthless prioritization</li>
                            <li>• Metrics-driven decisions</li>
                          </ul>
                        </div>
                      </div>
                      
                      <textarea
                        value={survivalNotes}
                        onChange={(e) => setSurvivalNotes(e.target.value)}
                        placeholder="Notes: Video quality, cohesiveness, mindful structure, 'upwards' set posture..."
                        className="w-full h-24 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                      />
                    </div>

                    {/* Section 2: Social Centerfold (Coolness) */}
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl">😎</span>
                        <div>
                          <h3 className="font-semibold text-lg">Social Centerfold (Coolness)</h3>
                          <p className="text-sm text-gray-400">
                            Social arena positioning: Frame control and outcome independence
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                        <Slider
                          value={coolnessScore}
                          onChange={setCoolnessScore}
                          min={1}
                          max={10}
                          labels={{ 
                            left: '👤 Uncool (Following)', 
                            right: '🌟 Cool (Leading)' 
                          }}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                        <div className="bg-gray-800/30 rounded-lg p-3">
                          <p className="text-gray-400 font-medium mb-2">&quot;Loser&quot; (Uncool) Signals:</p>
                          <ul className="text-gray-500 space-y-1">
                            <li>• Following rather than leading</li>
                            <li>• Social timidness/risk aversion</li>
                            <li>• Neutral dominance symbols</li>
                            <li>• Family-oriented / safety priority</li>
                            <li>• Silent effort that may not work</li>
                          </ul>
                        </div>
                        <div className="bg-gray-800/30 rounded-lg p-3">
                          <p className="text-gray-400 font-medium mb-2">&quot;Winner&quot; (Cool) Signals:</p>
                          <ul className="text-gray-500 space-y-1">
                            <li>• Frame control - sets parameters</li>
                            <li>• Outcome independence</li>
                            <li>• Effortless presentation</li>
                            <li>• Energy generation</li>
                            <li>• Reframes the game itself</li>
                          </ul>
                        </div>
                      </div>
                      
                      <textarea
                        value={coolnessNotes}
                        onChange={(e) => setCoolnessNotes(e.target.value)}
                        placeholder="Notes: Frame dynamics, status signals, energy, social positioning observed..."
                        className="w-full h-24 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                      />
                    </div>

                    {/* Section 3: Target Audience */}
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl">👥</span>
                        <div>
                          <h3 className="font-semibold text-lg">Target Audience</h3>
                          <p className="text-sm text-gray-400">
                            Age demographic range this content appeals to
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                        <AgeRangeSlider
                          minAge={targetAgeMin}
                          maxAge={targetAgeMax}
                          onChange={(min, max) => {
                            setTargetAgeMin(min);
                            setTargetAgeMax(max);
                          }}
                        />
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
                        <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                          <p className="text-gray-400 font-medium">12-17</p>
                          <p className="text-gray-500">Teen</p>
                        </div>
                        <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                          <p className="text-gray-400 font-medium">18-24</p>
                          <p className="text-gray-500">Young Adult</p>
                        </div>
                        <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                          <p className="text-gray-400 font-medium">25-44</p>
                          <p className="text-gray-500">Adult</p>
                        </div>
                        <div className="bg-gray-800/30 rounded-lg p-2 text-center">
                          <p className="text-gray-400 font-medium">45-65</p>
                          <p className="text-gray-500">Mature</p>
                        </div>
                      </div>
                      
                      <textarea
                        value={audienceNotes}
                        onChange={(e) => setAudienceNotes(e.target.value)}
                        placeholder="Notes: Why this target audience? Humor type, references, cultural markers, language style..."
                        className="w-full h-24 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Brand Identity Tab (Original) */}
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
                      <h2 className="text-lg font-semibold">Brand Identity</h2>
                      
                      {/* Personality Notes */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Person / Personality
                          <span className="text-gray-500 font-normal ml-2">
                            (Who is this brand if it were a person?)
                          </span>
                        </label>
                        <textarea
                          value={personalityNotes}
                          onChange={(e) => setPersonalityNotes(e.target.value)}
                          placeholder="Describe the brand as a person: age, gender energy, life stage, social class, priorities, values, character traits..."
                          className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>

                      {/* Statement Notes */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Statement / Message
                          <span className="text-gray-500 font-normal ml-2">
                            (What is the brand saying? What&apos;s the subtext?)
                          </span>
                        </label>
                        <textarea
                          value={statementNotes}
                          onChange={(e) => setStatementNotes(e.target.value)}
                          placeholder="What is being communicated between the lines? Mission? Target audience? Self-seriousness? Opinion stance? Humor style?..."
                          className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>

                      {/* Corrections */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Notes / Corrections
                          <span className="text-gray-500 font-normal ml-2">(Optional)</span>
                        </label>
                        <textarea
                          value={corrections}
                          onChange={(e) => setCorrections(e.target.value)}
                          placeholder="Any additional observations..."
                          className="w-full h-20 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Submit */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                  {submitError && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
                      {submitError}
                    </div>
                  )}
                  
                  {submitted ? (
                    <div className="p-4 bg-green-900/30 border border-green-800 rounded-lg">
                      <p className="text-green-300 font-medium">✓ Analysis saved!</p>
                      <p className="text-gray-400 text-sm mt-1">
                        This data will be used for RAG and model training.
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                    >
                      {submitting ? 'Saving...' : existingRating ? 'Update Analysis' : 'Save Analysis'}
                    </button>
                  )}
                </div>

                {/* Similar Videos */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                  <h3 className="font-semibold mb-4">
                    Similar Videos
                    <span className="text-gray-400 font-normal ml-2 text-sm">(RAG context)</span>
                  </h3>
                  
                  {loadingSimilar ? (
                    <div className="text-gray-400">Loading...</div>
                  ) : similarVideos.length === 0 ? (
                    <div className="text-gray-500 text-sm">
                      No similar videos found yet. Rate more videos to build context.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {similarVideos.map((sv) => (
                        <div
                          key={sv.video_id}
                          className="p-3 bg-gray-800/50 rounded-lg border border-gray-700"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <a
                              href={sv.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 text-sm"
                            >
                              View Video ↗
                            </a>
                            <span className="text-xs text-gray-400">
                              {Math.round(sv.similarity * 100)}% similar
                            </span>
                          </div>
                          {sv.personality_notes && (
                            <p className="text-xs text-gray-400 line-clamp-2">
                              {sv.personality_notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
