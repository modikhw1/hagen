'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Card, Input, LoadingSpinner } from '@/components/ui'
import { VideoInterpretationCard, type VideoInterpretation } from '@/components/features'

interface Message {
  role: 'user' | 'assistant'
  content: string
  id: string
  dbMessageId?: string  // ID from database for persisting notes
  trainingNote?: string
  videoInterpretations?: VideoInterpretation[]  // Associated video analyses
}

interface ConversationInfo {
  conversationId: string
  profileId: string
  brandName: string
  currentPhase: string
}

interface ConversationNotes {
  masterNote: string
}

// Helper to generate unique message IDs
const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

interface BrandSynthesis {
  narrative_summary: string
  characteristics: Record<string, any>
  tone: Record<string, any>
  current_state: Record<string, any>
  goals: Record<string, any>
  target_audience: Record<string, any>
  key_insights: string[]
  content_recommendations: {
    formats_likely_to_fit: string[]
    formats_to_avoid: string[]
    topics_to_explore: string[]
    production_level: string
  }
}

interface VideoMatch {
  id: string
  video_url: string
  platform: string
  title?: string
  similarity: number
  quality_tier?: string
  brand_tone_notes?: string
}

const PHASE_LABELS: Record<string, string> = {
  introduction: 'Getting to Know You',
  business_goals: 'Business Goals',
  social_goals: 'Social Media Goals',
  tone_discovery: 'Finding Your Voice',
  audience: 'Your Audience',
  references: 'Inspiration',
  synthesis: 'Profile Summary'
}

export default function BrandProfilePage() {
  const [brandName, setBrandName] = useState('')
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [synthesis, setSynthesis] = useState<BrandSynthesis | null>(null)
  const [matchedVideos, setMatchedVideos] = useState<VideoMatch[]>([])
  const [isFindingMatches, setIsFindingMatches] = useState(false)
  const [referenceUrl, setReferenceUrl] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteInputValue, setNoteInputValue] = useState('')
  const [conversationNotes, setConversationNotes] = useState<ConversationNotes>({
    masterNote: ''
  })
  const [showMasterNotes, setShowMasterNotes] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const startConversation = async () => {
    if (!brandName.trim()) return

    setIsStarting(true)
    setMessages([])
    setSynthesis(null)
    setMatchedVideos([])

    try {
      const response = await fetch('/api/brand-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start conversation')
      }

      const data = await response.json()

      setConversationInfo({
        conversationId: data.conversationId,
        profileId: data.profileId,
        brandName,
        currentPhase: data.currentPhase
      })

      setMessages([{
        id: generateMessageId(),
        role: 'assistant',
        content: data.openingMessage
      }])

    } catch (error) {
      console.error('Start conversation error:', error)
      setMessages([{
        id: generateMessageId(),
        role: 'assistant',
        content: `Sorry, I couldn't start the conversation. ${error instanceof Error ? error.message : 'Please try again.'}`
      }])
    } finally {
      setIsStarting(false)
    }
  }

  const sendMessage = async (message?: string) => {
    const messageToSend = message || inputValue.trim()
    if (!messageToSend || !conversationInfo) return

    setInputValue('')
    setIsLoading(true)

    const userMsgId = generateMessageId()
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: messageToSend }])

    try {
      const response = await fetch('/api/brand-profile/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationInfo.conversationId,
          message: messageToSend
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }

      const data = await response.json()

      // Update phase if changed
      if (data.nextPhase) {
        setConversationInfo(prev => prev ? {
          ...prev,
          currentPhase: data.nextPhase
        } : null)
      }

      // Convert video analyses to VideoInterpretation format
      const videoInterpretations: VideoInterpretation[] | undefined = data.videoAnalyses?.map((v: any) => ({
        url: v.url,
        platform: v.platform,
        videoId: v.videoId,
        analyzedVideoId: v.videoId, // The DB ID for corrections
        analysis: v.analysis,
        fromCache: v.fromCache
      }))

      // Update user message with database ID, video interpretations, and add assistant message
      setMessages(prev => {
        const updated = prev.map(msg => 
          msg.id === userMsgId 
            ? { 
                ...msg, 
                dbMessageId: data.userMessageId,
                videoInterpretations 
              }
            : msg
        )
        return [...updated, {
          id: generateMessageId(),
          dbMessageId: data.assistantMessageId,
          role: 'assistant' as const,
          content: data.message
        }]
      })

    } catch (error) {
      console.error('Send message error:', error)
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: `Sorry, something went wrong. ${error instanceof Error ? error.message : ''}`
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleTransition = async () => {
    if (!conversationInfo) return

    setIsLoading(true)

    try {
      const response = await fetch('/api/brand-profile/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationInfo.conversationId,
          action: 'transition'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to transition')
      }

      const data = await response.json()

      setConversationInfo(prev => prev ? {
        ...prev,
        currentPhase: data.newPhase
      } : null)

      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: data.message
      }])

    } catch (error) {
      console.error('Transition error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSynthesize = async () => {
    if (!conversationInfo) return

    setIsLoading(true)
    setMessages(prev => [...prev, {
      id: generateMessageId(),
      role: 'user',
      content: '[Generating brand profile...]'
    }])

    try {
      const response = await fetch('/api/brand-profile/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationInfo.conversationId,
          action: 'synthesize'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate profile')
      }

      const data = await response.json()
      setSynthesis(data.synthesis)

      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: `I've created your brand profile! Here's what I learned about ${conversationInfo.brandName}:\n\n${data.synthesis.narrative_summary}`
      }])

      setConversationInfo(prev => prev ? {
        ...prev,
        currentPhase: 'synthesis'
      } : null)

    } catch (error) {
      console.error('Synthesis error:', error)
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: `Sorry, I couldn't generate the brand profile. ${error instanceof Error ? error.message : ''}`
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFindMatches = async () => {
    if (!conversationInfo) return

    setIsFindingMatches(true)

    try {
      const response = await fetch(`/api/brand-profile/${conversationInfo.profileId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: 10,
          threshold: 0.5,
          regenerateEmbedding: true
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to find matches')
      }

      const data = await response.json()
      setMatchedVideos(data.matches || [])

    } catch (error) {
      console.error('Match error:', error)
    } finally {
      setIsFindingMatches(false)
    }
  }

  const handleAddReferenceVideo = async () => {
    if (!referenceUrl.trim() || !conversationInfo) return

    try {
      const response = await fetch(`/api/brand-profile/${conversationInfo.profileId}/reference-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: referenceUrl,
          reason: 'Added during conversation'
        })
      })

      if (response.ok) {
        setReferenceUrl('')
        setMessages(prev => [...prev, {
          id: generateMessageId(),
          role: 'assistant',
          content: `Great, I've saved that video as a reference! It helps me understand what you're going for. Let's continue - what is it about that video that resonates with you?`
        }])
      }
    } catch (error) {
      console.error('Add reference error:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Handle corrections to Gemini interpretations
  const handleVideoCorrection = async (
    videoId: string, 
    corrections: Record<string, string>, 
    note: string
  ) => {
    try {
      const response = await fetch('/api/brand-profile/video-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analyzedVideoId: videoId,
          corrections,
          correctionNote: note,
          conversationId: conversationInfo?.conversationId
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save correction')
      }

      console.log('Correction saved to Gemini training data')
    } catch (error) {
      console.error('Correction error:', error)
      throw error
    }
  }

  // Handle saving a note for a specific message
  const handleSaveNote = (messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, trainingNote: noteInputValue }
        : msg
    ))
    setEditingNoteId(null)
    setNoteInputValue('')
  }

  // Handle starting to edit a note
  const handleEditNote = (messageId: string, existingNote?: string) => {
    setEditingNoteId(messageId)
    setNoteInputValue(existingNote || '')
  }

  // Handle canceling note edit
  const handleCancelNote = () => {
    setEditingNoteId(null)
    setNoteInputValue('')
  }

  // Auto-save notes to database (debounced)
  const saveNotesToDatabase = useCallback(async () => {
    if (!conversationInfo) return

    setIsSavingNotes(true)
    setNotesSaved(false)

    try {
      // Collect message notes that have dbMessageId (from database)
      const messageNotes = messages
        .filter(m => m.dbMessageId && m.trainingNote)
        .map(m => ({
          messageId: m.dbMessageId!,
          note: m.trainingNote!
        }))

      await fetch('/api/brand-profile/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationInfo.conversationId,
          messageNotes,
          sessionNotes: conversationNotes.masterNote
        })
      })

      setNotesSaved(true)
      // Clear saved indicator after 2 seconds
      setTimeout(() => setNotesSaved(false), 2000)
    } catch (error) {
      console.error('Failed to save notes:', error)
    } finally {
      setIsSavingNotes(false)
    }
  }, [conversationInfo, messages, conversationNotes.masterNote])

  // Debounced auto-save when notes change
  useEffect(() => {
    if (!conversationInfo) return
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for 2 seconds after last change
    saveTimeoutRef.current = setTimeout(() => {
      const hasNotes = messages.some(m => m.trainingNote) || conversationNotes.masterNote
      if (hasNotes) {
        saveNotesToDatabase()
      }
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [messages, conversationNotes.masterNote, conversationInfo, saveNotesToDatabase])

  const currentPhaseLabel = conversationInfo 
    ? PHASE_LABELS[conversationInfo.currentPhase] || conversationInfo.currentPhase
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Brand Discovery
          </h1>
          <p className="text-gray-400">
            Let&apos;s understand your brand&apos;s unique voice and find content that fits
          </p>
        </div>

        {/* Start Conversation */}
        {!conversationInfo && (
          <Card className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              Start Your Brand Profile
            </h2>
            <p className="text-gray-400 mb-4">
              I&apos;ll ask you some questions to understand your business, your voice, and what content would resonate with your brand.
            </p>
            <div className="flex gap-4">
              <Input
                placeholder="What's your business or brand name?"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="flex-1"
                disabled={isStarting}
              />
              <Button
                onClick={startConversation}
                disabled={!brandName.trim() || isStarting}
              >
                {isStarting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Starting...</span>
                  </>
                ) : (
                  'Begin'
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Session Info */}
        {conversationInfo && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 rounded-full bg-purple-600/30 text-purple-300 text-sm font-medium">
                {conversationInfo.brandName}
              </span>
              <span className="text-gray-400 text-sm">
                {currentPhaseLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowMasterNotes(!showMasterNotes)}
                className={showMasterNotes ? 'bg-yellow-600/20 text-yellow-400' : ''}
              >
                📋 {showMasterNotes ? 'Hide Notes' : 'Session Notes'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setConversationInfo(null)
                  setMessages([])
                  setSynthesis(null)
                  setMatchedVideos([])
                  setBrandName('')
                  setConversationNotes({ masterNote: '' })
                  setShowMasterNotes(false)
                }}
              >
                Start Over
              </Button>
            </div>
          </div>
        )}

        {/* Master Notes Panel */}
        {conversationInfo && showMasterNotes && (
          <Card className="mb-4 bg-yellow-900/10 border border-yellow-600/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-yellow-400">📋 Session Notes</h3>
              <div className="flex items-center gap-2">
                {isSavingNotes && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <LoadingSpinner size="sm" /> Saving...
                  </span>
                )}
                {notesSaved && !isSavingNotes && (
                  <span className="text-xs text-green-400">✓ Saved</span>
                )}
                {!isSavingNotes && !notesSaved && (
                  <span className="text-xs text-gray-500">Auto-saves after changes</span>
                )}
              </div>
            </div>
            <textarea
              value={conversationNotes.masterNote}
              onChange={(e) => setConversationNotes(prev => ({ ...prev, masterNote: e.target.value }))}
              placeholder="Overall thoughts on this conversation...&#10;&#10;What worked well? What felt unnatural? What questions should be asked differently? What data would be useful to capture? Any patterns or insights about the conversation flow?"
              className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500 resize-y min-h-[120px]"
              rows={5}
            />
          </Card>
        )}

        {/* Chat Messages */}
        {messages.length > 0 && (
          <Card className="mb-4 max-h-[450px] overflow-y-auto">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-100'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>

                  {/* Video Interpretation Cards (shown under user messages that contain links) */}
                  {msg.role === 'user' && msg.videoInterpretations && msg.videoInterpretations.length > 0 && (
                    <div className="mt-2 w-full max-w-[85%] ml-auto space-y-2">
                      {msg.videoInterpretations.map((interpretation, idx) => (
                        <VideoInterpretationCard
                          key={`${msg.id}-video-${idx}`}
                          interpretation={interpretation}
                          onCorrection={handleVideoCorrection}
                          compact={true}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Note button and display */}
                  <div className={`mt-1 w-full max-w-[85%] ${msg.role === 'user' ? 'ml-auto' : ''}`}>
                    {editingNoteId === msg.id ? (
                      <div className="bg-gray-800 rounded-lg p-3 mt-1 border border-yellow-600/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-yellow-400">
                            {msg.role === 'assistant' ? 'Claude Feedback' : 'Training Note'}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveNote(msg.id)}
                              className="text-green-400 hover:text-green-300 text-xs px-2 py-1 bg-green-900/30 rounded"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelNote}
                              className="text-red-400 hover:text-red-300 text-xs px-2 py-1 bg-red-900/30 rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={noteInputValue}
                          onChange={(e) => setNoteInputValue(e.target.value)}
                          placeholder={msg.role === 'assistant' 
                            ? "Feedback for Claude's response: Was this helpful? What was wrong? How should it respond instead?"
                            : "Note about this message or the video link shared"
                          }
                          className="w-full bg-gray-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500 resize-y min-h-[80px]"
                          rows={4}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              handleCancelNote()
                            }
                          }}
                        />
                        {msg.role === 'assistant' && (
                          <p className="text-xs text-gray-500 mt-2">
                            Tip: This feedback trains Claude&apos;s conversation style. For video interpretation corrections, use the &quot;Correct Gemini&quot; button on the video card above.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <button
                          onClick={() => handleEditNote(msg.id, msg.trainingNote)}
                          className={`text-xs px-2 py-1 rounded transition-colors flex-shrink-0 ${
                            msg.trainingNote 
                              ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30' 
                              : 'text-gray-500 hover:text-gray-400 hover:bg-gray-700/50'
                          }`}
                          title={msg.trainingNote ? 'Edit note' : 'Add training note'}
                        >
                          {msg.trainingNote ? 'Note' : '+'}
                        </button>
                        {msg.trainingNote && (
                          <div 
                            className="text-xs text-yellow-400/80 italic bg-yellow-900/10 px-2 py-1 rounded cursor-pointer hover:bg-yellow-900/20"
                            onClick={() => handleEditNote(msg.id, msg.trainingNote)}
                          >
                            {msg.trainingNote}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-700 rounded-lg px-4 py-3">
                    <LoadingSpinner size="sm" />
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </Card>
        )}

        {/* Reference Video Input (shown during references phase) */}
        {conversationInfo?.currentPhase === 'references' && !synthesis && (
          <Card className="mb-4 bg-gray-800/50">
            <h3 className="text-sm font-medium text-gray-300 mb-2">
              📎 Add a video you admire
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder="Paste TikTok, YouTube, or Instagram URL..."
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleAddReferenceVideo}
                disabled={!referenceUrl.trim()}
              >
                Add
              </Button>
            </div>
          </Card>
        )}

        {/* Input Area */}
        {conversationInfo && !synthesis && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Share your thoughts..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!inputValue.trim() || isLoading}
              >
                Send
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTransition}
                disabled={isLoading}
              >
                Next Topic →
              </Button>
              {messages.length >= 6 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSynthesize}
                  disabled={isLoading}
                >
                  Generate Profile
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Synthesis Display */}
        {synthesis && (
          <div className="space-y-6">
            {/* Tone Profile */}
            <Card>
              <h3 className="text-lg font-semibold text-white mb-4">Tone Profile</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {synthesis.tone.primary && (
                  <div className="text-center">
                    <div className="text-2xl mb-1">●</div>
                    <div className="text-sm text-gray-400">Primary</div>
                    <div className="text-white font-medium capitalize">{synthesis.tone.primary}</div>
                  </div>
                )}
                {synthesis.tone.energy_level && (
                  <div className="text-center">
                    <div className="text-2xl mb-1">◆</div>
                    <div className="text-sm text-gray-400">Energy</div>
                    <div className="text-white font-medium">{synthesis.tone.energy_level}/10</div>
                  </div>
                )}
                {synthesis.tone.humor_tolerance && (
                  <div className="text-center">
                    <div className="text-2xl mb-1">😄</div>
                    <div className="text-sm text-gray-400">Humor</div>
                    <div className="text-white font-medium">{synthesis.tone.humor_tolerance}/10</div>
                  </div>
                )}
                {synthesis.tone.formality && (
                  <div className="text-center">
                    <div className="text-2xl mb-1">👔</div>
                    <div className="text-sm text-gray-400">Formality</div>
                    <div className="text-white font-medium">{synthesis.tone.formality}/10</div>
                  </div>
                )}
              </div>
              {synthesis.tone.avoid && synthesis.tone.avoid.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <span className="text-sm text-gray-400">Avoid: </span>
                  <span className="text-red-400">{synthesis.tone.avoid.join(', ')}</span>
                </div>
              )}
            </Card>

            {/* Key Insights */}
            <Card>
              <h3 className="text-lg font-semibold text-white mb-4">Key Insights</h3>
              <ul className="space-y-2">
                {synthesis.key_insights?.map((insight, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-300">
                    <span className="text-purple-400">•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </Card>

            {/* Content Recommendations */}
            <Card>
              <h3 className="text-lg font-semibold text-white mb-4">Content Recommendations</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Formats that would work</h4>
                  <div className="flex flex-wrap gap-2">
                    {synthesis.content_recommendations?.formats_likely_to_fit?.map((format, idx) => (
                      <span key={idx} className="px-2 py-1 bg-green-600/20 text-green-300 rounded text-sm">
                        {format}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Topics to explore</h4>
                  <div className="flex flex-wrap gap-2">
                    {synthesis.content_recommendations?.topics_to_explore?.map((topic, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-sm">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Find Matching Videos */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Videos That Match Your Brand</h3>
                <Button
                  onClick={handleFindMatches}
                  disabled={isFindingMatches}
                  size="sm"
                >
                  {isFindingMatches ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Finding...</span>
                    </>
                  ) : matchedVideos.length > 0 ? (
                    'Refresh'
                  ) : (
                    'Find Matches'
                  )}
                </Button>
              </div>

              {matchedVideos.length > 0 ? (
                <div className="space-y-3">
                  {matchedVideos.map((video, idx) => (
                    <div 
                      key={video.id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-sm">#{idx + 1}</span>
                        <div>
                          <div className="text-white font-medium">
                            {video.title || 'Untitled Video'}
                          </div>
                          <div className="text-sm text-gray-400">
                            {video.platform} • {video.quality_tier || 'Unrated'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-purple-400">
                          {Math.round(video.similarity * 100)}% match
                        </span>
                        <a
                          href={video.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          View →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8">
                  Click &quot;Find Matches&quot; to discover videos that fit your brand tone
                </p>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
