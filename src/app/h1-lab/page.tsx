'use client'

import { useState, useEffect } from 'react'

// ============================================================================
// TYPES
// ============================================================================

interface H1Definition {
  id: string
  name: string
  question: string
  description: string | null
  mode: 'clip' | 'brand'
  brand_id: string | null
  brand_name: string | null
  dimension: string | null
  status: string
  annotation_count: number
  created_at: string
}

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
  visual_analysis: Record<string, unknown> | null
}

interface Brand {
  id: string
  name: string
  business_type: string | null
}

type BelongingSelection = 'match' | 'meh' | 'clash' | null
type ViewMode = 'list' | 'create' | 'annotate'

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function H1Lab() {
  const [view, setView] = useState<ViewMode>('list')
  const [definitions, setDefinitions] = useState<H1Definition[]>([])
  const [selectedH1, setSelectedH1] = useState<H1Definition | null>(null)
  const [loading, setLoading] = useState(true)

  // Load H1 definitions on mount
  useEffect(() => {
    loadDefinitions()
  }, [])

  const loadDefinitions = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/h1/definitions')
      const data = await res.json()
      setDefinitions(data.definitions || [])
    } catch {
      console.error('Failed to load H1 definitions')
    }
    setLoading(false)
  }

  const handleSelectH1 = (h1: H1Definition) => {
    setSelectedH1(h1)
    setView('annotate')
  }

  const handleExitSession = () => {
    setSelectedH1(null)
    setView('list')
    loadDefinitions() // Refresh counts
  }

  const handleH1Created = (newH1: H1Definition) => {
    setDefinitions([newH1, ...definitions])
    setSelectedH1(newH1)
    setView('annotate')
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  if (view === 'create') {
    return (
      <CreateH1View
        onBack={() => setView('list')}
        onCreated={handleH1Created}
      />
    )
  }

  if (view === 'annotate' && selectedH1) {
    return (
      <AnnotateView
        h1={selectedH1}
        onExit={handleExitSession}
        onAnnotationSaved={() => {
          // Update local count
          setDefinitions(defs =>
            defs.map(d =>
              d.id === selectedH1.id
                ? { ...d, annotation_count: d.annotation_count + 1 }
                : d
            )
          )
        }}
      />
    )
  }

  // Default: List view
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>H1 Lab</h1>
        <p style={{ margin: '8px 0 0', color: '#666', fontSize: '14px' }}>
          Build and train H1 models by collecting annotations
        </p>
      </div>

      {/* Create New Button */}
      <button
        onClick={() => setView('create')}
        style={{
          width: '100%',
          padding: '16px',
          fontSize: '14px',
          fontWeight: 500,
          border: '2px dashed #ddd',
          borderRadius: '12px',
          background: '#fafafa',
          color: '#666',
          cursor: 'pointer',
          marginBottom: '24px',
          transition: 'all 0.15s'
        }}
        onMouseOver={e => {
          e.currentTarget.style.borderColor = '#2563eb'
          e.currentTarget.style.color = '#2563eb'
        }}
        onMouseOut={e => {
          e.currentTarget.style.borderColor = '#ddd'
          e.currentTarget.style.color = '#666'
        }}
      >
        + Create New H1 Model
      </button>

      {/* H1 List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#888' }}>
          Loading...
        </div>
      ) : definitions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#888' }}>
          No H1 models yet. Create one to start collecting annotations.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {definitions.map(h1 => (
            <H1Card
              key={h1.id}
              h1={h1}
              onSelect={() => handleSelectH1(h1)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// H1 CARD COMPONENT
// ============================================================================

function H1Card({ h1, onSelect }: { h1: H1Definition; onSelect: () => void }) {
  const modeLabel = h1.mode === 'brand' ? `Brand: ${h1.brand_name}` : 'Clip → Clip'
  const countLabel = h1.annotation_count === 1 ? '1 pair' : `${h1.annotation_count} pairs`

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '16px 20px',
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        background: '#fff',
        cursor: 'pointer',
        transition: 'all 0.15s'
      }}
      onMouseOver={e => {
        e.currentTarget.style.borderColor = '#2563eb'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.1)'
      }}
      onMouseOut={e => {
        e.currentTarget.style.borderColor = '#e0e0e0'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>{h1.name}</span>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '10px',
              background: h1.mode === 'brand' ? '#f3e8ff' : '#e0f2fe',
              color: h1.mode === 'brand' ? '#7c3aed' : '#0284c7'
            }}>
              {modeLabel}
            </span>
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
            {h1.question}
          </div>
          {h1.description && (
            <div style={{ fontSize: '12px', color: '#999' }}>
              {h1.description}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', marginLeft: '16px' }}>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#333' }}>
            {h1.annotation_count}
          </div>
          <div style={{ fontSize: '11px', color: '#888' }}>{countLabel}</div>
        </div>
      </div>
      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '12px', color: '#888' }}>
          {h1.dimension && <span style={{ marginRight: '8px' }}>📊 {h1.dimension}</span>}
        </span>
        <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: 500 }}>
          Continue →
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// CREATE H1 VIEW
// ============================================================================

function CreateH1View({
  onBack,
  onCreated
}: {
  onBack: () => void
  onCreated: (h1: H1Definition) => void
}) {
  const [name, setName] = useState('')
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<'clip' | 'brand'>('clip')
  const [dimension, setDimension] = useState<string>('')
  const [brandId, setBrandId] = useState<string>('')
  const [brands, setBrands] = useState<Brand[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load brands for brand mode
  useEffect(() => {
    fetch('/api/brands')
      .then(res => res.json())
      .then(data => setBrands(data.brands || []))
      .catch(() => {})
  }, [])

  const DIMENSION_OPTIONS = [
    { value: 'humor', label: 'Humor Style' },
    { value: 'audience', label: 'Target Audience' },
    { value: 'quality', label: 'Quality Level' },
    { value: 'style', label: 'Visual Style' },
    { value: 'replicability', label: 'Replicability' },
    { value: 'brand_fit', label: 'Brand Fit' },
    { value: 'custom', label: 'Custom' }
  ]

  const QUESTION_TEMPLATES = [
    'Do these belong together? (humor style)',
    'Do these belong together? (target audience)',
    'Do these belong together? (quality level)',
    'Do these belong together? (overall vibe)',
    'Does this clip belong with this brand?'
  ]

  const handleCreate = async () => {
    if (!name || !question) {
      setError('Name and question are required')
      return
    }

    if (mode === 'brand' && !brandId) {
      setError('Select a brand for brand mode')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/h1/definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.toLowerCase().replace(/\s+/g, '_'),
          question,
          description: description || undefined,
          mode,
          brand_id: mode === 'brand' ? brandId : undefined,
          dimension: dimension || undefined
        })
      })

      const data = await res.json()

      if (data.success) {
        onCreated({
          ...data.definition,
          annotation_count: 0,
          brand_name: mode === 'brand' ? brands.find(b => b.id === brandId)?.name : null
        })
      } else {
        setError(data.message || 'Failed to create H1')
      }
    } catch {
      setError('Failed to create H1')
    }

    setSaving(false)
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <button
          onClick={onBack}
          style={{
            padding: '8px 0',
            fontSize: '14px',
            border: 'none',
            background: 'transparent',
            color: '#666',
            cursor: 'pointer',
            marginBottom: '8px'
          }}
        >
          ← Back to H1 List
        </button>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Create New H1 Model</h1>
        <p style={{ margin: '8px 0 0', color: '#666', fontSize: '14px' }}>
          Define a question to train the model on
        </p>
      </div>

      {/* Mode Toggle */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
          Mode
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setMode('clip')}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '14px',
              border: mode === 'clip' ? '2px solid #2563eb' : '1px solid #ddd',
              borderRadius: '8px',
              background: mode === 'clip' ? '#eff6ff' : '#fff',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontWeight: 500 }}>Clip A → Clip B</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Compare two clips
            </div>
          </button>
          <button
            onClick={() => setMode('brand')}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '14px',
              border: mode === 'brand' ? '2px solid #7c3aed' : '1px solid #ddd',
              borderRadius: '8px',
              background: mode === 'brand' ? '#f5f3ff' : '#fff',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontWeight: 500 }}>Brand → Clip</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Match clips to a brand
            </div>
          </button>
        </div>
      </div>

      {/* Brand Selector (brand mode) */}
      {mode === 'brand' && (
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
            Select Brand (Anchor)
          </label>
          <select
            value={brandId}
            onChange={e => setBrandId(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              background: '#fff'
            }}
          >
            <option value="">Choose a brand...</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Name */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
          Name (identifier)
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
          placeholder="e.g., humor_similarity, steve_poke_fit"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxSizing: 'border-box'
          }}
        />
        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
          Lowercase letters, numbers, and underscores only
        </div>
      </div>

      {/* Question */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
          Question (shown during annotation)
        </label>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Do these belong together? (in terms of...)"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxSizing: 'border-box'
          }}
        />
        <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {QUESTION_TEMPLATES.map(q => (
            <button
              key={q}
              onClick={() => setQuestion(q)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                border: 'none',
                borderRadius: '12px',
                background: question === q ? '#333' : '#f0f0f0',
                color: question === q ? '#fff' : '#666',
                cursor: 'pointer'
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Dimension */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
          Dimension (optional)
        </label>
        <select
          value={dimension}
          onChange={e => setDimension(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            background: '#fff'
          }}
        >
          <option value="">Select dimension...</option>
          {DIMENSION_OPTIONS.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Add notes about what this H1 should capture..."
          rows={2}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxSizing: 'border-box',
            resize: 'vertical'
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px',
          marginBottom: '24px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={handleCreate}
          disabled={saving || !name || !question}
          style={{
            flex: 1,
            padding: '14px',
            fontSize: '14px',
            fontWeight: 500,
            border: 'none',
            borderRadius: '8px',
            background: saving || !name || !question ? '#ccc' : '#2563eb',
            color: '#fff',
            cursor: saving || !name || !question ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Creating...' : 'Create & Start Annotating'}
        </button>
        <button
          onClick={onBack}
          style={{
            padding: '14px 24px',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            background: '#fff',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// ANNOTATE VIEW
// ============================================================================

function AnnotateView({
  h1,
  onExit,
  onAnnotationSaved
}: {
  h1: H1Definition
  onExit: () => void
  onAnnotationSaved: () => void
}) {
  const [clipA, setClipA] = useState<ClipData | null>(null)
  const [clipB, setClipB] = useState<ClipData | null>(null)
  const [selection, setSelection] = useState<BelongingSelection>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [sessionCount, setSessionCount] = useState(0)

  const loadClips = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/h1/annotations?action=random_pair')
      const data = await res.json()

      if (h1.mode === 'clip') {
        if (data.clip_a && data.clip_b) {
          setClipA(data.clip_a)
          setClipB(data.clip_b)
          setSelection(null)
          setNote('')
        } else {
          setMessage(data.message || 'No clips available')
        }
      } else {
        // Brand mode - just need one clip
        if (data.clip_a) {
          setClipA(data.clip_a)
          setClipB(null)
          setSelection(null)
          setNote('')
        } else {
          setMessage(data.message || 'No clips available')
        }
      }
    } catch {
      setMessage('Failed to load clips')
    }
    setLoading(false)
  }

  const saveAnnotation = async () => {
    if (!clipA || note.length < 5) {
      setMessage('Note required (min 5 chars)')
      return
    }

    setSaving(true)
    setMessage('')

    // Map selection to API format
    const apiSelection = selection === 'match' ? 'clip_a'
      : selection === 'meh' ? 'equal'
      : selection === 'clash' ? 'clip_b'
      : null

    const strength = selection === 'match' ? 1.0
      : selection === 'meh' ? 0.5
      : selection === 'clash' ? 0.0
      : null

    try {
      const payload: Record<string, unknown> = {
        h1_definition_id: h1.id,
        h1_question: h1.question,
        clip_a_id: clipA.id,
        human_note: note,
        selection: apiSelection,
        strength,
        annotation_quality: 'draft'
      }

      if (h1.mode === 'clip' && clipB) {
        payload.clip_b_id = clipB.id
      } else if (h1.mode === 'brand' && h1.brand_id) {
        payload.brand_id = h1.brand_id
      }

      const res = await fetch('/api/h1/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (data.success) {
        setMessage('Saved!')
        setSessionCount(c => c + 1)
        onAnnotationSaved()
        // Auto-load next pair
        setTimeout(() => loadClips(), 500)
      } else {
        setMessage(data.message || 'Save failed')
      }
    } catch {
      setMessage('Save failed')
    }

    setSaving(false)
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
            Annotating
          </div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>{h1.name}</h1>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
            {h1.annotation_count + sessionCount} pairs collected
            {sessionCount > 0 && (
              <span style={{ color: '#22c55e', marginLeft: '8px' }}>
                (+{sessionCount} this session)
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onExit}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            background: '#fff',
            cursor: 'pointer'
          }}
        >
          ← Exit Session
        </button>
      </div>

      {/* Fixed Question */}
      <div style={{
        padding: '16px',
        background: '#f8fafc',
        borderRadius: '8px',
        marginBottom: '24px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>QUESTION</div>
        <div style={{ fontSize: '16px', fontWeight: 500 }}>{h1.question}</div>
      </div>

      {/* Load Button or Clips */}
      {!clipA ? (
        <button
          onClick={loadClips}
          disabled={loading}
          style={{
            width: '100%',
            padding: '20px',
            fontSize: '15px',
            border: 'none',
            borderRadius: '8px',
            background: loading ? '#ccc' : '#2563eb',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Loading...' : 'Load Clips'}
        </button>
      ) : (
        <>
          {/* Clips Display */}
          {h1.mode === 'clip' && clipB ? (
            <>
              <div style={{ marginBottom: '8px', fontSize: '13px', color: '#666', textAlign: 'center' }}>
                <strong>Anchor (A)</strong> — Does <strong>B</strong> belong in A&apos;s world?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <ClipCard clip={clipA} label="A (Anchor)" isAnchor={true} />
                <ClipCard clip={clipB} label="B (Compare)" />
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '8px', fontSize: '13px', color: '#666', textAlign: 'center' }}>
                <strong>Brand: {h1.brand_name}</strong> — Does this clip belong?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{
                  border: '2px solid #8b5cf6',
                  borderRadius: '12px',
                  padding: '16px',
                  background: '#f8f5ff'
                }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#8b5cf6', marginBottom: '8px' }}>
                    Brand (Anchor)
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 500 }}>{h1.brand_name}</div>
                </div>
                <ClipCard clip={clipA} label="Clip (Evaluate)" />
              </div>
            </>
          )}

          {/* Selection */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px', textAlign: 'center' }}>
              {h1.mode === 'clip' ? 'Does B belong with A?' : `Does this clip belong with ${h1.brand_name}?`}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <SelectionChip
                active={selection === 'match'}
                onClick={() => setSelection(selection === 'match' ? null : 'match')}
                color="#22c55e"
              >
                Clear match
              </SelectionChip>
              <SelectionChip
                active={selection === 'meh'}
                onClick={() => setSelection(selection === 'meh' ? null : 'meh')}
                color="#888"
              >
                Meh / Unclear
              </SelectionChip>
              <SelectionChip
                active={selection === 'clash'}
                onClick={() => setSelection(selection === 'clash' ? null : 'clash')}
                color="#ef4444"
              >
                Clear clash
              </SelectionChip>
            </div>
          </div>

          {/* Note */}
          <div style={{ marginBottom: '24px' }}>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Why do they belong together (or not)? What makes this clear or unclear?"
              rows={3}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={saveAnnotation}
              disabled={saving || note.length < 5}
              style={{
                padding: '12px 32px',
                fontSize: '14px',
                fontWeight: 500,
                border: 'none',
                borderRadius: '8px',
                background: saving || note.length < 5 ? '#ccc' : '#2563eb',
                color: '#fff',
                cursor: saving || note.length < 5 ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Saving...' : 'Save & Next'}
            </button>
            <button
              onClick={loadClips}
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
              <span style={{
                color: message === 'Saved!' ? '#22c55e' : '#888',
                fontSize: '14px'
              }}>
                {message}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function ClipCard({ clip, label, isAnchor }: {
  clip: ClipData
  label: string
  isAnchor?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      border: isAnchor ? '2px solid #8b5cf6' : '1px solid #e0e0e0',
      borderRadius: '12px',
      padding: '16px',
      background: isAnchor ? '#f8f5ff' : '#fff'
    }}>
      <div style={{ marginBottom: '12px' }}>
        <span style={{
          fontWeight: 600,
          fontSize: '14px',
          color: isAnchor ? '#8b5cf6' : 'inherit'
        }}>
          {label}
        </span>
      </div>

      <a
        href={clip.video_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#2563eb', fontSize: '13px', display: 'block', marginBottom: '12px' }}
      >
        {clip.video_id}
      </a>

      <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.6 }}>
        {clip.summary.concept && <div><b>Concept:</b> {clip.summary.concept}</div>}
        {clip.summary.humor_type && <div><b>Humor:</b> {clip.summary.humor_type}</div>}
        {clip.summary.style && <div><b>Style:</b> {clip.summary.style}</div>}
        {clip.summary.target_audience && (
          <div>
            <b>Audience:</b>{' '}
            {Array.isArray(clip.summary.target_audience)
              ? clip.summary.target_audience.join(', ')
              : clip.summary.target_audience}
          </div>
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
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

function SelectionChip({ active, onClick, color, children }: {
  active: boolean
  onClick: () => void
  color: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px',
        fontSize: '14px',
        fontWeight: 500,
        border: active ? `2px solid ${color}` : '1px solid #ddd',
        borderRadius: '24px',
        background: active ? color : '#fff',
        color: active ? '#fff' : '#333',
        cursor: 'pointer',
        transition: 'all 0.15s ease'
      }}
    >
      {children}
    </button>
  )
}
