'use client';

import { useState, useEffect, useCallback } from 'react';

// Batch queue item type
interface QueueItem {
  url: string;
  status: 'pending' | 'processing' | 'generated' | 'approved' | 'skipped' | 'error';
  analysis?: string;
  error?: string;
}

export default function FineTuningLab() {
  const [url, setUrl] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'concise' | 'detailed'>('concise');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [modelId, setModelId] = useState('');

  // New state for batch mode
  const [batchMode, setBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);

  // New state for quick approval mode
  const [quickApprovalMode, setQuickApprovalMode] = useState(true);

  // Dataset statistics
  const [datasetStats, setDatasetStats] = useState<{ total: number; byMechanism: Record<string, number> } | null>(null);

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('fine-tuning-draft');
    const savedUrl = localStorage.getItem('fine-tuning-url');
    if (savedDraft) setDraft(savedDraft);
    if (savedUrl) setUrl(savedUrl);
  }, []);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (draft) {
      localStorage.setItem('fine-tuning-draft', draft);
    }
    if (url) {
      localStorage.setItem('fine-tuning-url', url);
    }
  }, [draft, url]);

  // Clear localStorage after successful save
  const clearLocalStorage = () => {
    localStorage.removeItem('fine-tuning-draft');
    localStorage.removeItem('fine-tuning-url');
  };

  const handleGenerate = async () => {
    if (!url) return;
    setLoading(true);
    setDraft(''); // Clear previous draft to avoid confusion
    setStatus(`Analyzing: ${url}...`);
    
    try {
      const res = await fetch('/api/fine-tuning/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode: analysisMode })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');
      
      setDraft(data.analysis);
      if (data.model) setModelId(data.model);
      setStatus('Draft generated. Please review and edit.');
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRewrite = async () => {
    if (!draft) return;
    setLoading(true);
    setStatus('Neutralizing tone...');
    
    try {
      const res = await fetch('/api/fine-tuning/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draft })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rewrite');
      
      setDraft(data.rewritten);
      setStatus('Tone neutralized. Review before saving.');
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setLoading(true);
    setStatus('Saving to dataset...');

    try {
      const res = await fetch('/api/fine-tuning/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, analysis: draft })
      });

      if (!res.ok) throw new Error('Failed to save');

      setStatus('Saved successfully! Ready for next video.');
      setSavedCount(prev => prev + 1);
      clearLocalStorage();
      setUrl('');
      setDraft('');

      // If in batch mode, move to next
      if (batchMode && queue.length > 0) {
        handleNextInQueue();
      }
    } catch (e: any) {
      setStatus(`Error saving: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Quick approval - save without editing
  const handleQuickApprove = async () => {
    await handleSave();
  };

  // Skip current video
  const handleSkip = () => {
    if (batchMode && queue.length > 0) {
      setQueue(prev => prev.map((item, i) =>
        i === currentQueueIndex ? { ...item, status: 'skipped' } : item
      ));
      handleNextInQueue();
    } else {
      setUrl('');
      setDraft('');
      clearLocalStorage();
      setStatus('Skipped. Enter next URL.');
    }
  };

  // Clear and start fresh
  const handleClearNext = () => {
    setUrl('');
    setDraft('');
    clearLocalStorage();
    setStatus('Ready for next video.');
  };

  // Batch mode: parse URLs and start queue
  const handleStartBatch = () => {
    const urls = batchUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.startsWith('http'));

    if (urls.length === 0) {
      setStatus('No valid URLs found. Paste TikTok URLs, one per line.');
      return;
    }

    const newQueue: QueueItem[] = urls.map(u => ({ url: u, status: 'pending' }));
    setQueue(newQueue);
    setCurrentQueueIndex(0);
    setBatchMode(true);
    setBatchUrls('');

    // Load first URL
    setUrl(newQueue[0].url);
    setStatus(`Batch mode: ${urls.length} videos queued. Starting with #1.`);
  };

  // Move to next item in queue
  const handleNextInQueue = () => {
    const nextIndex = currentQueueIndex + 1;
    if (nextIndex < queue.length) {
      setCurrentQueueIndex(nextIndex);
      setUrl(queue[nextIndex].url);
      setDraft('');
      setStatus(`Batch mode: Video ${nextIndex + 1} of ${queue.length}`);
    } else {
      // Queue complete
      const approved = queue.filter(q => q.status === 'approved').length;
      const skipped = queue.filter(q => q.status === 'skipped').length;
      setStatus(`Batch complete! ${approved} approved, ${skipped} skipped.`);
      setBatchMode(false);
      setQueue([]);
      setUrl('');
      setDraft('');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in textarea or input
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'enter':
            e.preventDefault();
            if (!loading && url) handleGenerate();
            break;
          case 's':
            e.preventDefault();
            if (!loading && draft) handleSave();
            break;
          case 'n':
            e.preventDefault();
            handleClearNext();
            break;
          case 'r':
            e.preventDefault();
            if (!loading && draft) handleRewrite();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, url, draft]);

  return (
    <div className="max-w-5xl mx-auto p-8">
      <header className="mb-6 border-b pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fine-Tuning Lab 🧪</h1>
          <p className="text-gray-600">
            Active Learning Interface: Generate drafts, refine them, and build the Gold Standard dataset.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono text-gray-400">Current Model</div>
          <div className="text-sm font-medium text-green-600">
            {modelId ? `v4 (${modelId.slice(-4)})` : 'Ready'}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Session: {savedCount} saved
          </div>
        </div>
      </header>

      {/* Keyboard Shortcuts Help */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border text-xs text-gray-600 flex gap-6">
        <span><kbd className="px-1.5 py-0.5 bg-white border rounded text-gray-700">Ctrl+Enter</kbd> Generate</span>
        <span><kbd className="px-1.5 py-0.5 bg-white border rounded text-gray-700">Ctrl+S</kbd> Save</span>
        <span><kbd className="px-1.5 py-0.5 bg-white border rounded text-gray-700">Ctrl+N</kbd> Clear/Next</span>
        <span><kbd className="px-1.5 py-0.5 bg-white border rounded text-gray-700">Ctrl+R</kbd> Rewrite</span>
      </div>

      {/* Batch Mode Queue Progress */}
      {batchMode && queue.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-blue-800">
              Batch Progress: {currentQueueIndex + 1} of {queue.length}
            </span>
            <button
              onClick={() => { setBatchMode(false); setQueue([]); }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Exit Batch Mode
            </button>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${((currentQueueIndex + 1) / queue.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {/* Batch Import Section */}
        {!batchMode && (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">Batch Import (paste multiple URLs)</label>
              <button
                onClick={handleStartBatch}
                disabled={!batchUrls.trim()}
                className="text-sm bg-purple-600 text-white px-4 py-1.5 rounded hover:bg-purple-700 disabled:opacity-50"
              >
                Start Batch
              </button>
            </div>
            <textarea
              value={batchUrls}
              onChange={(e) => setBatchUrls(e.target.value)}
              placeholder="Paste TikTok URLs here, one per line..."
              rows={3}
              className="w-full p-2 border rounded font-mono text-xs bg-white"
            />
          </div>
        )}

        {/* Input Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <label className="block text-sm font-medium mb-2">TikTok URL</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@user/video/..."
              className="flex-1 p-2 border rounded font-mono text-sm"
              disabled={batchMode}
            />
            {url && !batchMode && (
              <button
                onClick={() => setUrl('')}
                className="px-3 text-gray-400 hover:text-gray-600 border rounded"
                title="Clear URL"
              >
                ✕
              </button>
            )}
            <select
              value={analysisMode}
              onChange={(e) => setAnalysisMode(e.target.value as 'concise' | 'detailed')}
              className="border rounded px-3 py-2 bg-white text-sm"
            >
              <option value="concise">Short & Sharp</option>
              <option value="detailed">Detailed Analysis</option>
            </select>
            <button
              onClick={handleGenerate}
              disabled={loading || !url}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Working...' : 'Generate'}
            </button>
          </div>
          {status && (
            <div className={`mt-4 p-3 rounded text-sm ${status.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
              {status}
            </div>
          )}
        </div>

        {/* Editor Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium">
              Analysis Editor (Gold Standard)
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleRewrite}
                disabled={loading || !draft}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-gray-700 border"
              >
                ✨ Neutralize Tone
              </button>
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={quickApprovalMode}
                  onChange={(e) => setQuickApprovalMode(e.target.checked)}
                  className="rounded"
                />
                Quick Approval Mode
              </label>
            </div>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="w-full p-4 border rounded font-mono text-sm bg-gray-50 focus:bg-white transition-colors"
            placeholder="Generated analysis will appear here..."
          />

          {/* Quick Approval Buttons */}
          {quickApprovalMode && draft && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm text-green-800 mb-3">
                Quick Approval: Is this analysis good enough to save as-is?
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleQuickApprove}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-lg"
                >
                  ✓ Approve & Save
                </button>
                <button
                  onClick={() => setQuickApprovalMode(false)}
                  disabled={loading}
                  className="flex-1 bg-yellow-500 text-white py-3 rounded-lg hover:bg-yellow-600 disabled:opacity-50 font-medium"
                >
                  ✎ Edit First
                </button>
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="flex-1 bg-gray-400 text-white py-3 rounded-lg hover:bg-gray-500 disabled:opacity-50 font-medium"
                >
                  ⏭ Skip
                </button>
              </div>
            </div>
          )}

          {/* Standard Save Button (when not in quick approval) */}
          {(!quickApprovalMode || !draft) && (
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {draft && <span className="text-green-600">● Draft auto-saved</span>}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Skip
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading || !draft}
                  className="bg-green-600 text-white px-8 py-2 rounded hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  Save to Dataset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
