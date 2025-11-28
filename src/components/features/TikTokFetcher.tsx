'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface TikTokData {
  platform: string
  type: string
  id: string
  url: string
  title: string | null
  description: string | null
  author: {
    username: string
    displayName: string
    avatarUrl: string
    verified: boolean
  }
  stats: {
    views: number | null
    likes: number | null
    comments: number | null
    shares: number | null
  }
  media: {
    type: string
    duration?: number
    thumbnailUrl?: string
  }
  tags: string[]
  createdAt: string
  transcript?: string
  additionalData?: any
}

export function TikTokFetcher() {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState<string>('')
  const [result, setResult] = useState<TikTokData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFetch = async () => {
    if (!url.trim()) return

    setIsLoading(true)
    setLoadingStatus('Fetching video metadata...')
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/tiktok', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url,
          include_transcript: true 
        }),
      })

      const data = await response.json()
      
      console.log('API Response:', data)
      console.log('Transcript value:', data.data?.transcript)
      console.log('Transcript type:', typeof data.data?.transcript)

      if (data.success) {
        setLoadingStatus('Processing transcript...')
        console.log('Setting result with data:', data.data)
        setResult(data.data)
      } else {
        setError(data.error || 'Failed to fetch TikTok data')
      }
    } catch (err) {
      setError('Failed to fetch TikTok data')
      console.error(err)
    } finally {
      setIsLoading(false)
      setLoadingStatus('')
    }
  }

  return (
    <div className="space-y-6">
      <Card title="TikTok Video Fetcher">
        <div className="space-y-4">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@username/video/1234567890"
            label="TikTok Video URL"
          />
          <Button
            onClick={handleFetch}
            isLoading={isLoading}
            disabled={!url.trim()}
          >
            Fetch Video Data
          </Button>
        </div>
      </Card>

      {isLoading && (
        <Card>
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <LoadingSpinner />
            <div className="text-center">
              <p className="text-gray-900 font-medium">{loadingStatus}</p>
              <p className="text-sm text-gray-500 mt-1">This may take 10-30 seconds</p>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <Card>
          <div className="text-red-600">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        </Card>
      )}

      {result && (
        <Card title="Video Data">
          <div className="space-y-4">
            {result.title && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Title</h4>
                <p className="text-gray-600">{result.title}</p>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Author</h4>
              <div className="flex items-center gap-2">
                {result.author.avatarUrl && (
                  <img 
                    src={result.author.avatarUrl} 
                    alt={result.author.displayName}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium text-gray-900">
                    {result.author.displayName}
                    {result.author.verified && (
                      <span className="ml-1 text-blue-500">✓</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">@{result.author.username}</p>
                </div>
              </div>
            </div>

            {result.description && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Description</h4>
                <p className="text-gray-600">{result.description}</p>
              </div>
            )}

            {result.tags && result.tags.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {result.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Statistics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {result.stats.views !== null && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Views</p>
                    <p className="text-xl font-bold text-gray-900">
                      {result.stats.views.toLocaleString()}
                    </p>
                  </div>
                )}
                {result.stats.likes !== null && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Likes</p>
                    <p className="text-xl font-bold text-gray-900">
                      {result.stats.likes.toLocaleString()}
                    </p>
                  </div>
                )}
                {result.stats.comments !== null && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Comments</p>
                    <p className="text-xl font-bold text-gray-900">
                      {result.stats.comments.toLocaleString()}
                    </p>
                  </div>
                )}
                {result.stats.shares !== null && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Shares</p>
                    <p className="text-xl font-bold text-gray-900">
                      {result.stats.shares.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {result.additionalData?.music && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Music</h4>
                <p className="text-gray-600">
                  {result.additionalData.music.title} - {result.additionalData.music.author}
                </p>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Transcript</h4>
              {result.transcript ? (
                <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {result.transcript}
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-blue-800 text-sm">
                    ℹ️ No transcript could be generated for this video. This may happen if the video has no audio, is too long, or the platform doesn't allow access.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
