'use client'

import { useState, useEffect } from 'react'

interface ClipData {
  id: string
  video_id: string
  video_url: string
  platform: string
  summary: {
    concept: string | null
    humor_type: string | null
    target_audience: string | null
    replicability_score: number | null
    style: string | null
  }
  visual_analysis: Record<string, any> | null
}

interface Stats {
  total: number
  by_h1: Record<string, { total: number; gold: number; silver: number; draft: number }>
}

const SUGGESTIONS = [
  'Would the same audience enjoy both?',
  'Which is higher quality overall?',
  'How similar are these in humor style?',
  'Which is easier to replicate?',
  'Do these feel like they belong together?',
]

export default function H1Lab() {
  const [clipA, setClipA] = useState<ClipData | null>(null)
  const [clipB, setClipB] = useState<ClipData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form
  const [h1Question, setH1Question] = useState('')
  const [selection, setSelection] = useState<'clip_a' | 'clip_b' | 'equal' | null>(null)
  const [note, setNote] = useState('')
  const [strength, setStrength] = useState(0.5)

  // Stats
  const [stats, setStats] = useState<Stats | null>(null)
  const [message, setMessage] = useState('')

  const loadRandomPair = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/h1/annotations?action=random_pair')
      const data = await res.json()
      if (data.clip_a && data.clip_b) {
        setClipA(data.clip_a)
        setClipB(data.clip_b)
        setSelection(null)
        setNote('')
        setStrength(0.5)
      } else {
        setMessage(data.message || 'No clips available')
      }
    } catch {
      setMessage('Failed to load clips')
    }
    setLoading(false)
  }

  const loadStats = async () => {
    try {
      const res = await fetch('/api/h1/annotations?action=stats')
      const data = await res.json()
      setStats(data)
    } catch {
      // ignore
    }
  }

  const saveAnnotation = async () => {
    if (!clipA || !clipB || !h1Question || note.length < 5) {
      setMessage('Need: H1 question and note (min 5 chars)')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const res = await fetch('/api/h1/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          h1_question: h1Question,
          clip_a_id: clipA.id,
          clip_b_id: clipB.id,
          human_note: note,
          selection: selection,
          strength: strength,
          annotation_quality: 'draft'
        })
      })

      const data = await res.json()

      if (data.success) {
        setMessage('Saved')
        loadStats()
        loadRandomPair()
      } else {
        setMessage(data.message || 'Save failed')
      }
    } catch {
      setMessage('Save failed')
    }

    setSaving(false)
  }

  useEffect(() => {
    loadStats()
  }, [])

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>H1 Lab</h1>
        {stats && (
          <span style={{ color: '#888', fontSize: '14px' }}>{stats.total} annotations</span>
        )}
      </div>

      {/* H1 Question */}
      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          value={h1Question}
          onChange={(e) => setH1Question(e.target.value)}
          placeholder="What relationship are you exploring?"
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '15px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            boxSizing: 'border-box',
            outline: 'none'
          }}
        />
        <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {SUGGESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => setH1Question(q)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                border: 'none',
                borderRadius: '12px',
                background: h1Question === q ? '#333' : '#f0f0f0',
                color: h1Question === q ? '#fff' : '#666',
                cursor: 'pointer'
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Load Button */}
      {!clipA && (
        <button
          onClick={loadRandomPair}
          disabled={loading}
          style={{
            padding: '12px 24px',
            fontSize: '14px',
            border: 'none',
            borderRadius: '8px',
            background: '#333',
            color: '#fff',
            cursor: loading ? 'wait' : 'pointer'
          }}
        >
          {loading ? 'Loading...' : 'Load Clips'}
        </button>
      )}

      {/* Clips */}
      {clipA && clipB && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <ClipCard
              clip={clipA}
              label="A"
              selected={selection === 'clip_a'}
              onSelect={() => setSelection(selection === 'clip_a' ? null : 'clip_a')}
            />
            <ClipCard
              clip={clipB}
              label="B"
              selected={selection === 'clip_b'}
              onSelect={() => setSelection(selection === 'clip_b' ? null : 'clip_b')}
            />
          </div>

          {/* Selection */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <Chip active={selection === 'clip_a'} onClick={() => setSelection(selection === 'clip_a' ? null : 'clip_a')}>A</Chip>
              <Chip active={selection === 'clip_b'} onClick={() => setSelection(selection === 'clip_b' ? null : 'clip_b')}>B</Chip>
              <Chip active={selection === 'equal'} onClick={() => setSelection(selection === 'equal' ? null : 'equal')}>Equal</Chip>
              <span style={{ color: '#888', fontSize: '12px', alignSelf: 'center', marginLeft: '8px' }}>
                (optional)
              </span>
            </div>
          </div>

          {/* Strength */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', marginBottom: '4px' }}>
              <span>Weak / Different</span>
              <span>{strength.toFixed(2)}</span>
              <span>Strong / Similar</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Note */}
          <div style={{ marginBottom: '24px' }}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Your observation about the relationship..."
              rows={3}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxSizing: 'border-box',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={saveAnnotation}
              disabled={saving || !h1Question || note.length < 5}
              style={{
                padding: '12px 32px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '8px',
                background: saving || !h1Question || note.length < 5 ? '#ccc' : '#2563eb',
                color: '#fff',
                cursor: saving || !h1Question || note.length < 5 ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={loadRandomPair}
              disabled={loading}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              Skip
            </button>
            {message && (
              <span style={{ color: message === 'Saved' ? '#22c55e' : '#888', fontSize: '14px' }}>
                {message}
              </span>
            )}
          </div>
        </>
      )}

      {/* Stats */}
      {stats && Object.keys(stats.by_h1).length > 0 && (
        <div style={{ marginTop: '48px', padding: '16px', background: '#f9f9f9', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>By H1</div>
          {Object.entries(stats.by_h1).map(([h1, counts]) => (
            <div key={h1} style={{ fontSize: '13px', marginBottom: '4px', color: '#666' }}>
              {h1}: {counts.total}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClipCard({ clip, label, selected, onSelect }: {
  clip: ClipData
  label: string
  selected: boolean
  onSelect: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      onClick={onSelect}
      style={{
        border: selected ? '2px solid #2563eb' : '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '16px',
        background: selected ? '#f0f7ff' : '#fff',
        cursor: 'pointer'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>{label}</span>
        {selected && <span style={{ color: '#2563eb', fontSize: '12px' }}>Selected</span>}
      </div>

      <a
        href={clip.video_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ color: '#2563eb', fontSize: '13px', display: 'block', marginBottom: '12px' }}
      >
        {clip.video_id}
      </a>

      <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.6 }}>
        {clip.summary.concept && <div><b>Concept:</b> {clip.summary.concept}</div>}
        {clip.summary.humor_type && <div><b>Humor:</b> {clip.summary.humor_type}</div>}
        {clip.summary.style && <div><b>Style:</b> {clip.summary.style}</div>}
        {clip.summary.target_audience && (
          <div><b>Audience:</b> {Array.isArray(clip.summary.target_audience) ? clip.summary.target_audience.join(', ') : clip.summary.target_audience}</div>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
        style={{
          marginTop: '12px',
          padding: '4px 8px',
          fontSize: '11px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          background: '#fff',
          cursor: 'pointer'
        }}
      >
        {expanded ? 'Hide' : 'Full Data'}
      </button>

      {expanded && clip.visual_analysis && (
        <pre style={{
          marginTop: '12px',
          padding: '8px',
          background: '#f5f5f5',
          borderRadius: '4px',
          fontSize: '10px',
          overflow: 'auto',
          maxHeight: '200px'
        }}>
          {JSON.stringify(clip.visual_analysis, null, 2)}
        </pre>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px',
        fontSize: '13px',
        border: active ? '2px solid #2563eb' : '1px solid #ddd',
        borderRadius: '20px',
        background: active ? '#2563eb' : '#fff',
        color: active ? '#fff' : '#333',
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  )
}
