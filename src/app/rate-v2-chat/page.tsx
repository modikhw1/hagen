'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Video {
  id: string;
  source_url: string;
  title?: string;
  platform: string;
  thumbnail_url?: string;
  gcs_uri?: string;
}

interface VideoAnalysis {
  script?: {
    transcriptSummary?: string;
    hookLine?: string;
    payoffLine?: string;
    callToAction?: string;
    wordCount?: number;
  };
  content?: {
    primaryMessage?: string;
    comedyTiming?: number;
    emotionalIntensity?: number;
    absurdismLevel?: number;
    payoffStrength?: number;
  };
  casting?: {
    minimumPeople?: number;
    attractivenessDependency?: number;
    actingSkillRequired?: number;
  };
  production?: {
    shotComplexity?: number;
    equipmentLevel?: string;
    editingDependency?: number;
    timeToRecreate?: string;
  };
  flexibility?: {
    industryLock?: number;
    swappableCore?: string;
    propDependency?: number;
  };
  visual?: {
    format?: string;
    shotTypes?: string[];
  };
  brand?: {
    riskLevel?: number;
    toneMatch?: string;
  };
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type ViewMode = 'rate' | 'import';

export default function RateV2ChatPage() {
  const router = useRouter();
  
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('rate');
  
  // Video queue state
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Current video analysis from Gemini
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  
  // Rating state
  const [overall, setOverall] = useState<number | null>(null);
  const [isNotRelevant, setIsNotRelevant] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Conversational notes state
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [capturedFactors, setCapturedFactors] = useState<Record<string, number | boolean | null>>({});
  const [hasStartedConversation, setHasStartedConversation] = useState(false);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Stats
  const [stats, setStats] = useState({ total: 0, criteriaCount: 0 });
  
  // Import state
  const [importUrls, setImportUrls] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    fetchVideos();
    fetchStats();
  }, []);

  // Auto-scroll conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Load analysis when video changes
  useEffect(() => {
    if (videos[0]) {
      loadVideoAnalysis(videos[0].id);
    }
  }, [videos[0]?.id]);

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
      const res = await fetch('/api/ratings/export', { method: 'POST' });
      const data = await res.json();
      setStats({ 
        total: data.total_ratings || 0, 
        criteriaCount: Object.keys(capturedFactors).length
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const loadVideoAnalysis = async (videoId: string) => {
    setLoadingAnalysis(true);
    setAnalysis(null);
    resetConversation();
    
    try {
      const res = await fetch(`/api/rate-v2/chat?videoId=${videoId}`);
      const data = await res.json();
      
      if (data.analysis) {
        setAnalysis(data.analysis);
      }
    } catch (err) {
      console.error('Failed to load analysis:', err);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const resetConversation = () => {
    setConversation([]);
    setCapturedFactors({});
    setHasStartedConversation(false);
    setUserInput('');
  };

  // Main function: user submits their thoughts, AI responds with follow-up
  const submitUserThoughts = async () => {
    if (!userInput.trim() || !videos[0] || isThinking) return;
    
    const userMessage = userInput.trim();
    setUserInput('');
    
    // Add user message to conversation
    const newConversation: ConversationMessage[] = [
      ...conversation,
      { role: 'user', content: userMessage, timestamp: new Date() }
    ];
    setConversation(newConversation);
    setHasStartedConversation(true);
    
    setIsThinking(true);
    try {
      // Send conversation to chat API (simple format: just messages array)
      const res = await fetch('/api/rate-v2/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: videos[0].id,
          messages: newConversation.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      
      const data = await res.json();
      
      // Add AI response to conversation
      if (data.message) {
        setConversation(prev => [
          ...prev,
          { role: 'assistant', content: data.message, timestamp: new Date() }
        ]);
      } else if (data.error) {
        console.error('Chat API error:', data.error);
        setConversation(prev => [
          ...prev,
          { role: 'assistant', content: "I had trouble responding. Feel free to continue sharing your thoughts.", timestamp: new Date() }
        ]);
      }
    } catch (err) {
      console.error('Failed to get AI response:', err);
      setConversation(prev => [
        ...prev,
        { role: 'assistant', content: "I had trouble processing that. Feel free to continue with your thoughts or submit your rating.", timestamp: new Date() }
      ]);
    } finally {
      setIsThinking(false);
      inputRef.current?.focus();
    }
  };

  // Get all notes from conversation for saving
  const getConversationNotes = () => {
    return conversation
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n\n');
  };

  const submitRating = useCallback(async () => {
    if (!videos[0] || submitting) return;
    if (!isNotRelevant && overall === null) return;
    
    const ratedVideoId = videos[0].id;
    setSubmitting(true);
    
    try {
      await fetch('/api/ratings-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: ratedVideoId,
          overall_score: isNotRelevant ? null : overall,
          notes: getConversationNotes() || '',
          is_not_relevant: isNotRelevant,
          captured_factors: capturedFactors,
          conversation_log: conversation.map(m => ({ role: m.role, content: m.content })),
        })
      });
      
      setStats(s => ({ ...s, total: s.total + 1 }));
      
      // Remove rated video and reset
      setVideos(prev => prev.filter(v => v.id !== ratedVideoId));
      resetForm();
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setSubmitting(false);
    }
  }, [videos, overall, submitting, isNotRelevant, capturedFactors, conversation]);

  const resetForm = () => {
    setOverall(null);
    setIsNotRelevant(false);
    setAnalysis(null);
    resetConversation();
  };

  const skipVideo = () => {
    if (!videos[0]) return;
    setVideos(prev => [...prev.slice(1), prev[0]]);
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
      
      // Submit rating with Cmd/Ctrl + Enter
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submitRating();
      }
      
      // Send message with Enter (when in textarea, no modifier)
      if (isTyping && target.id === 'conversation-input' && e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        submitUserThoughts();
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
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-gray-800">Rate Videos</h1>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                Conversational
              </span>
              <select
                value="v2-chat"
                onChange={(e) => {
                  if (e.target.value === 'v1') router.push('/rate');
                  if (e.target.value === 'v2') router.push('/rate-v2');
                }}
                className="text-sm border rounded-lg px-2 py-1 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="v1">Classic (Dimensions)</option>
                <option value="v2">Limitless (Notes)</option>
                <option value="v2-chat">Conversational</option>
              </select>
            </div>
            <div className="flex gap-1">
              {(['rate', 'import'] as ViewMode[]).map(mode => (
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
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-2 flex justify-between text-sm text-gray-500">
          <span>{stats.total} rated • {Object.keys(capturedFactors).length} factors captured this video</span>
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
            <div className="max-w-6xl mx-auto p-4">
              {/* Keyboard hints */}
              <div className="text-xs text-gray-400 mb-3 flex flex-wrap gap-3">
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">1-9</kbd> score</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">0</kbd> perfect</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">⌘↵</kbd> submit rating</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">↵</kbd> send message</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">s</kbd> skip</span>
                <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">n</kbd> not relevant</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Video + Analysis */}
                <div className="space-y-4">
                  {/* Video embed */}
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

                  {/* Gemini Analysis Summary */}
                  {analysis && (
                    <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
                      <div className="text-sm font-medium text-gray-700">Video Analysis</div>
                      
                      {analysis.script?.transcriptSummary && (
                        <div className="text-sm">
                          <span className="text-gray-500">Script:</span>{' '}
                          <span className="text-gray-700">{analysis.script.transcriptSummary}</span>
                        </div>
                      )}
                      
                      {analysis.script?.hookLine && (
                        <div className="text-sm">
                          <span className="text-gray-500">Hook:</span>{' '}
                          <span className="text-gray-700 italic">"{analysis.script.hookLine}"</span>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2">
                        {analysis.content?.comedyTiming && analysis.content.comedyTiming > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            Comedy: {analysis.content.comedyTiming}/10
                          </span>
                        )}
                        {analysis.production?.shotComplexity && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            Complexity: {analysis.production.shotComplexity}/10
                          </span>
                        )}
                        {analysis.casting?.minimumPeople && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                            People: {analysis.casting.minimumPeople}+
                          </span>
                        )}
                        {analysis.flexibility?.industryLock && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                            Industry lock: {analysis.flexibility.industryLock}/10
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {loadingAnalysis && (
                    <div className="bg-white rounded-xl shadow-sm border p-4 text-sm text-gray-500 animate-pulse">
                      Loading video analysis...
                    </div>
                  )}

                  {/* Captured Factors */}
                  {Object.keys(capturedFactors).length > 0 && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4">
                      <div className="text-sm font-medium text-green-800 mb-2">
                        Captured from conversation:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(capturedFactors).map(([key, value]) => (
                          <span 
                            key={key}
                            className={`text-xs px-2 py-1 rounded ${
                              value === null 
                                ? 'bg-gray-200 text-gray-600' 
                                : typeof value === 'boolean'
                                ? value ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                                : 'bg-blue-200 text-blue-800'
                            }`}
                          >
                            {key}: {value === null ? 'N/A' : typeof value === 'boolean' ? (value ? '✓' : '✗') : (value as number).toFixed(1)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Conversational Notes + Rating */}
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
                        <span className="font-medium text-gray-700">Not relevant for training</span>
                        <p className="text-xs text-gray-400">Skip this video</p>
                      </div>
                    </label>
                  </div>

                  {/* Conversational Notes Area */}
                  {!isNotRelevant && (
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col" style={{ height: '400px' }}>
                      <div className="p-3 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
                        <div className="text-sm font-medium text-purple-800">
                          {hasStartedConversation ? 'Conversation' : 'Share your thoughts'}
                        </div>
                        <div className="text-xs text-purple-600">
                          {hasStartedConversation 
                            ? "I'll ask follow-up questions about aspects you haven't mentioned yet"
                            : "What do you notice about this video? I'll follow up with questions."}
                        </div>
                      </div>
                      
                      {/* Conversation history */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {conversation.length === 0 && !hasStartedConversation && (
                          <div className="text-center text-gray-400 text-sm py-8">
                            Start by sharing your initial thoughts about this video...
                          </div>
                        )}
                        {conversation.map((msg, i) => (
                          <div 
                            key={i} 
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div 
                              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                                msg.role === 'user' 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        ))}
                        {isThinking && (
                          <div className="flex justify-start">
                            <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-400">
                              <span className="animate-pulse">Thinking...</span>
                            </div>
                          </div>
                        )}
                        <div ref={conversationEndRef} />
                      </div>
                      
                      {/* Input area */}
                      <div className="p-3 border-t bg-gray-50">
                        <div className="flex gap-2">
                          <textarea
                            ref={inputRef}
                            id="conversation-input"
                            value={userInput}
                            onChange={e => setUserInput(e.target.value)}
                            placeholder={hasStartedConversation 
                              ? "Continue the conversation..." 
                              : "What do you think about this video?"}
                            disabled={isThinking}
                            className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                            rows={2}
                          />
                          <button
                            onClick={submitUserThoughts}
                            disabled={isThinking || !userInput.trim()}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 text-sm self-end"
                          >
                            Send
                          </button>
                        </div>
                        {hasStartedConversation && (
                          <div className="mt-2 text-xs text-gray-400">
                            Press Enter to send • Ready to submit? Set a score below
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Overall Score */}
                  {!isNotRelevant && (
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">Overall Score</span>
                        <span className="text-3xl font-bold text-gray-800 tabular-nums">
                          {overall !== null ? overall.toFixed(1) : '—'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2">
                        {[0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(score => (
                          <button
                            key={score}
                            onClick={() => setOverall(score)}
                            className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                              overall === score 
                                ? score === 1.0 ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {score === 1.0 ? '🌟 1.0' : score.toFixed(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-2">
                    <button
                      onClick={submitRating}
                      disabled={(overall === null && !isNotRelevant) || submitting || (!isNotRelevant && conversation.length === 0)}
                      className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors"
                    >
                      {submitting 
                        ? 'Saving...' 
                        : isNotRelevant 
                        ? 'Mark Not Relevant' 
                        : conversation.length === 0
                        ? 'Share your thoughts first'
                        : `Submit Rating (⌘+Enter)`}
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
