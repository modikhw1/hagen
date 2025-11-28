import { NextRequest, NextResponse } from 'next/server'
import { analyzeText } from '@/lib/openai/client'
import { z } from 'zod'

const requestSchema = z.object({
  text: z.string().min(1, 'Text is required').max(10000, 'Text too long'),
  prompt: z.string().max(500, 'Prompt too long').optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const { text, prompt } = requestSchema.parse(body)

    // Sanitize input - remove any potential script tags
    const sanitizedText = text.replace(/<script[^>]*>.*?<\/script>/gi, '')

    const analysis = await analyzeText(sanitizedText, prompt)

    return NextResponse.json({
      success: true,
      data: analysis,
    })
  } catch (error) {
    console.error('Analysis API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    // Don't expose internal error details
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze text',
      },
      { status: 500 }
    )
  }
}
