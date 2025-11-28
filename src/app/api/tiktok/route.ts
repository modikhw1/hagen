import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const SUPADATA_API_URL = 'https://api.supadata.ai'

const tiktokVideoSchema = z.object({
  url: z.string().url('Invalid TikTok URL'),
  include_transcript: z.boolean().optional().default(false),
})

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
    const validation = tiktokVideoSchema.safeParse(body)

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
    const encodedUrl = encodeURIComponent(url)

    // Fetch metadata
    const metadataResponse = await fetch(`${SUPADATA_API_URL}/v1/metadata?url=${encodedUrl}`, {
      method: 'GET',
      headers: { 'x-api-key': apiKey },
    })

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text()
      console.error('Metadata error:', metadataResponse.status, errorText)
      throw new Error(`Failed to fetch metadata: ${errorText}`)
    }

    const metadata = await metadataResponse.json()

    // Transcript fetching disabled - logic preserved below for future use
    const transcript = null

    /* TRANSCRIPT LOGIC (DISABLED)
    // Add delay to avoid rate limiting
    if (include_transcript) {
      await new Promise(resolve => setTimeout(resolve, 3000))
    }

    const transcriptResponse = include_transcript
      ? await fetch(`${SUPADATA_API_URL}/v1/transcript?url=${encodedUrl}&text=true&mode=auto`, {
          method: 'GET',
          headers: { 'x-api-key': apiKey },
        })
      : null

    let transcript = null
    if (transcriptResponse?.ok) {
      const data = await transcriptResponse.json()
      if (data.jobId) {
        transcript = `[Transcript generating. Job ID: ${data.jobId}]`
      } else if (data.content) {
        transcript = typeof data.content === 'string' 
          ? data.content 
          : data.content.map((c: any) => c.text || c).join(' ')
      }
    }
    */

    return NextResponse.json({
      success: true,
      data: {
        ...metadata,
        transcript,
      },
    })
  } catch (error) {
    console.error('TikTok fetch error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch TikTok data',
      },
      { status: 500 }
    )
  }
}
