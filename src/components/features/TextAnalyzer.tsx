'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import type { AnalysisResult } from '@/lib/openai/client'

export function TextAnalyzer() {
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (!text.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.data)
      } else {
        setError(data.error || 'Analysis failed')
      }
    } catch (err) {
      setError('Failed to analyze text')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Text Analysis">
        <div className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to analyze..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[150px]"
          />
          <Button
            onClick={handleAnalyze}
            isLoading={isLoading}
            disabled={!text.trim()}
          >
            Analyze Text
          </Button>
        </div>
      </Card>

      {error && (
        <Card>
          <div className="text-red-600">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        </Card>
      )}

      {result && (
        <Card title="Analysis Results">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Summary</h4>
              <p className="text-gray-600">{result.summary}</p>
            </div>

            {result.sentiment && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Sentiment</h4>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    result.sentiment === 'positive'
                      ? 'bg-green-100 text-green-800'
                      : result.sentiment === 'negative'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {result.sentiment}
                </span>
              </div>
            )}

            {result.insights && result.insights.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Insights</h4>
                <ul className="list-disc list-inside space-y-1">
                  {result.insights.map((insight, index) => (
                    <li key={index} className="text-gray-600">
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
