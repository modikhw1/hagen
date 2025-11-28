import { NextRequest, NextResponse } from 'next/server'
import { analyzeText } from '@/lib/openai/client'
import { z } from 'zod'

const requestSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  prompt: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, prompt } = requestSchema.parse(body)

    const analysis = await analyzeText(text, prompt)

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

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze text',
      },
      { status: 500 }
    )
  }
}
