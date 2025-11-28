'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { VideoRating } from '@/components/features/VideoRating'
import { SimilarVideos } from '@/components/features/SimilarVideos'

interface VideoAnalysis {
  id: string
  url: string
  metadata: any
  computedMetrics: any
  alreadyExists?: boolean
}

export default function FeedbackPage() {
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyzedVideo, setAnalyzedVideo] = useState<VideoAnalysis | null>(null)
  const [showRating, setShowRating] = useState(false)
  const [refreshSimilar, setRefreshSimilar] = useState(0)

  const handleAnalyze = async () => {
    if (!videoUrl.trim()) {
      setError('Please enter a video URL')
      return
    }

    setLoading(true)
    setError(null)
    setAnalyzedVideo(null)
    setShowRating(false)

    try {
      const response = await fetch('/api/videos/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl, skipIfExists: true })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Analysis failed')
      }

      setAnalyzedVideo(data)
      setShowRating(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const handleRatingComplete = () => {
    // Refresh similar videos after rating
    setRefreshSimilar(prev => prev + 1)
  }

  const handleReset = () => {
    setVideoUrl('')
    setAnalyzedVideo(null)
    setShowRating(false)
    setError(null)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Video Feedback & Learning</h1>
            <p className="text-gray-600">
              Analyze videos, provide feedback, and build your personalized AI learning system
            </p>
          </div>
          <Link 
            href="/library"
            className="text-blue-600 hover:text-blue-800 transition-colors font-medium whitespace-nowrap"
          >
            View Library →
          </Link>
        </div>
      </div>

      {/* Step 1: Analyze Video */}
      <Card className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Step 1: Analyze Video</h2>
        <div className="flex gap-4">
          <Input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@user/video/... or YouTube URL"
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
            disabled={loading || !!analyzedVideo}
            className="flex-1"
          />
          {analyzedVideo ? (
            <Button onClick={handleReset} variant="secondary">
              Analyze Another
            </Button>
          ) : (
            <Button onClick={handleAnalyze} disabled={loading || !videoUrl.trim()}>
              {loading ? <LoadingSpinner size="sm" /> : 'Analyze'}
            </Button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </Card>

      {loading && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <LoadingSpinner size="lg" />
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900">Analyzing video...</p>
              <p className="text-sm text-gray-500 mt-1">
                Fetching metadata and computing metrics
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Video Metadata */}
      {analyzedVideo && (
        <>
          {analyzedVideo.alreadyExists && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
              ℹ️ This video was already analyzed. You can still rate it or update your rating.
            </div>
          )}

          <Card className="mb-6">
            <h2 className="text-2xl font-bold mb-4">Video Metadata</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Platform</div>
                <div className="text-lg font-semibold capitalize">
                  {analyzedVideo.metadata?.platform || 'Unknown'}
                </div>
              </div>
              {analyzedVideo.metadata?.author && (
                <div>
                  <div className="text-sm text-gray-600">Author</div>
                  <div className="text-lg font-semibold">
                    @{analyzedVideo.metadata.author.username || analyzedVideo.metadata.author}
                  </div>
                </div>
              )}
              {analyzedVideo.metadata?.stats?.views !== null && (
                <div>
                  <div className="text-sm text-gray-600">Views</div>
                  <div className="text-lg font-semibold">
                    {analyzedVideo.metadata.stats.views?.toLocaleString() || 'N/A'}
                  </div>
                </div>
              )}
              {analyzedVideo.metadata?.stats?.likes !== null && (
                <div>
                  <div className="text-sm text-gray-600">Likes</div>
                  <div className="text-lg font-semibold">
                    {analyzedVideo.metadata.stats.likes?.toLocaleString() || 'N/A'}
                  </div>
                </div>
              )}
            </div>

            {analyzedVideo.metadata?.description && (
              <div className="mt-4">
                <div className="text-sm text-gray-600 mb-1">Description</div>
                <p className="text-gray-800">{analyzedVideo.metadata.description}</p>
              </div>
            )}

            {analyzedVideo.computedMetrics && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm font-medium text-gray-700 mb-2">Computed Metrics</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(analyzedVideo.computedMetrics).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-500 capitalize">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {typeof value === 'number' ? value.toFixed(2) : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Step 2: Rate Video */}
          {showRating && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-4">Step 2: Provide Your Feedback</h2>
              <VideoRating
                videoId={analyzedVideo.id}
                videoUrl={analyzedVideo.url}
                onRatingComplete={handleRatingComplete}
              />
            </div>
          )}

          {/* Step 3: Similar Videos */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Step 3: Discover Similar Videos</h2>
            <SimilarVideos videoId={analyzedVideo.id} refreshTrigger={refreshSimilar} />
          </div>
        </>
      )}

      {!analyzedVideo && !loading && (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-2">
              👆 Enter a video URL above to get started
            </p>
            <p className="text-sm text-gray-400">
              The system will analyze the video, let you rate it, and show similar videos from your database
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
