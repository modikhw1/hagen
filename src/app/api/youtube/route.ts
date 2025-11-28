import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const SUPADATA_API_URL = 'https://api.supadata.ai'

const youtubeVideoSchema = z.object({
  url: z.string().url('Invalid YouTube URL'),
  include_transcript: z.boolean().optional().default(true),
})

/**
 * Fetch YouTube video metadata and transcript
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.SUPADATA_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Supadata API key not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const validation = youtubeVideoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { url, include_transcript } = validation.data

    // Encode URL for query parameter
    const encodedUrl = encodeURIComponent(url)

    // Fetch metadata and transcript in parallel for better performance
    const metadataPromise = fetch(`${SUPADATA_API_URL}/v1/metadata?url=${encodedUrl}`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    })

    const transcriptPromise = include_transcript
      ? fetch(`${SUPADATA_API_URL}/v1/transcript?url=${encodedUrl}&text=true&mode=auto`, {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
          },
        })
      : null

    // Wait for both requests to complete
    const [metadataResponse, transcriptResponse] = await Promise.all([
      metadataPromise,
      transcriptPromise,
    ])

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text()
      console.error('Supadata metadata error:', metadataResponse.status, errorText)
      throw new Error(`Failed to fetch metadata: ${errorText}`)
    }

    const metadata = await metadataResponse.json()

    // Process transcript if available
    let transcript = null
    if (transcriptResponse && transcriptResponse.ok) {
      const transcriptData = await transcriptResponse.json()
      console.log('Transcript data:', JSON.stringify(transcriptData, null, 2))
      
      // Handle both immediate response and job response
      if (transcriptData.jobId) {
        // Job created - would need polling, for now return info
        transcript = `[Transcript is being generated. Job ID: ${transcriptData.jobId}]`
      } else if (transcriptData.content) {
        // Content can be a string or array of chunks
        if (typeof transcriptData.content === 'string') {
          transcript = transcriptData.content
        } else if (Array.isArray(transcriptData.content)) {
          transcript = transcriptData.content.map((c: any) => c.text || c).join(' ')
        }
      }
      
      console.log('Final transcript value:', transcript)
    }

    return NextResponse.json({
      success: true,
      data: {
        ...metadata,
        transcript,
      },
    })
  } catch (error) {
    console.error('YouTube fetch error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch YouTube data',
      },
      { status: 500 }
    )
  }
}
