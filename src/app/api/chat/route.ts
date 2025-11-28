import { NextRequest, NextResponse } from 'next/server'
import { chat, ChatMessage } from '@/lib/openai/client'
import { z } from 'zod'

const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string().max(5000, 'Message too long'),
    })
  ).max(20, 'Too many messages'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages } = requestSchema.parse(body)

    // Sanitize message content
    const sanitizedMessages = messages.map(msg => ({
      ...msg,
      content: msg.content.replace(/<script[^>]*>.*?<\/script>/gi, '')
    }))

    const response = await chat(sanitizedMessages as ChatMessage[])

    return NextResponse.json({
      success: true,
      data: {
        message: response,
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)

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
        error: 'Failed to generate chat response',
      },
      { status: 500 }
    )
  }
}
