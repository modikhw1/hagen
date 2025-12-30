'use client';

import { useState } from 'react';

export default function FineTuningLab() {
  const [url, setUrl] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'concise' | 'detailed'>('concise');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [modelId, setModelId] = useState('');

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
      setUrl('');
      setDraft('');
    } catch (e: any) {
      setStatus(`Error saving: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <header className="mb-8 border-b pb-4 flex justify-between items-end">
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
        </div>
      </header>

      <div className="grid gap-8">
        {/* Input Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <label className="block text-sm font-medium mb-2">TikTok URL</label>
          <div className="flex gap-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@user/video/..."
              className="flex-1 p-2 border rounded font-mono text-sm"
            />
            {url && (
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
              className="border rounded px-4 py-2 bg-white"
            >
              <option value="concise">Short & Sharp</option>
              <option value="detailed">Detailed Analysis</option>
            </select>            <button
              onClick={handleGenerate}
              disabled={loading || !url}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Working...' : 'Generate Draft'}
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
            <button
              onClick={handleRewrite}
              disabled={loading || !draft}
              className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-gray-700 border"
            >
              ✨ Neutralize Tone
            </button>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="w-full p-4 border rounded font-mono text-sm bg-gray-50 focus:bg-white transition-colors"
            placeholder="Generated analysis will appear here..."
          />
          
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Session progress: {savedCount} videos saved
            </div>
            <button
              onClick={handleSave}
              disabled={loading || !draft}
              className="bg-green-600 text-white px-8 py-2 rounded hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              Save to Dataset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
