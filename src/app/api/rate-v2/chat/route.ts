import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const requestSchema = z.object({
  videoId: z.string().uuid(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).default([]),
});

/**
 * Simple conversational chat API for video rating
 * Works like a normal LLM chat - send messages, get responses
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, messages } = requestSchema.parse(body);

    // Try to fetch video analysis for context (optional - still works without it)
    let videoContext = '';
    try {
      const { data: video } = await supabase
        .from('analyzed_videos')
        .select('metadata, visual_analysis')
        .eq('id', videoId)
        .single();

      if (video?.visual_analysis) {
        const analysis = video.visual_analysis;
        const contextParts: string[] = [];
        
        if (analysis.script?.transcriptSummary) {
          contextParts.push(`Script: ${analysis.script.transcriptSummary}`);
        }
        if (analysis.script?.hookLine) {
          contextParts.push(`Hook: "${analysis.script.hookLine}"`);
        }
        if (analysis.content?.comedyTiming) {
          contextParts.push(`Comedy timing: ${analysis.content.comedyTiming}/10`);
        }
        if (analysis.production?.shotComplexity) {
          contextParts.push(`Shot complexity: ${analysis.production.shotComplexity}/10`);
        }
        if (analysis.casting?.minimumPeople) {
          contextParts.push(`Minimum people needed: ${analysis.casting.minimumPeople}`);
        }
        
        if (contextParts.length > 0) {
          videoContext = `\n\nVideo analysis available:\n${contextParts.join('\n')}`;
        }
      }
    } catch (e) {
      // Video not found or no analysis - that's fine, continue without context
    }

    // Build system prompt
    const systemPrompt = `You are a helpful assistant having a conversation about a short-form video (TikTok/YouTube Short) that the user is rating.

Your role is to:
1. Acknowledge what the user shares about the video
2. Ask natural follow-up questions about aspects they haven't mentioned
3. Help them think through their rating

Topics you might explore (only if relevant and not already discussed):
- How replicable is this concept for a small business?
- Does it rely on the person being attractive or having special skills?
- Is the humor/appeal accessible or does it require internet culture knowledge?
- Would this be risky for a typical brand to recreate?
- What makes the hook/payoff work (or not work)?

Be conversational and natural - don't interrogate them. If they seem done sharing thoughts, that's fine.
Keep responses concise (2-3 sentences typically).${videoContext}`;

    // Build messages for OpenAI
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    ];

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 300,
    });

    const assistantMessage = response.choices[0].message.content || "I'd love to hear more about your thoughts on this video.";

    return NextResponse.json({
      message: assistantMessage,
    });

  } catch (error) {
    console.error('Chat error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process chat', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Return video analysis if available
 */
export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('videoId');
  
  if (!videoId) {
    return NextResponse.json({ analysis: null });
  }

  try {
    const { data: video } = await supabase
      .from('analyzed_videos')
      .select('id, video_url, platform, metadata, visual_analysis')
      .eq('id', videoId)
      .single();

    return NextResponse.json({
      analysis: video?.visual_analysis || null,
      metadata: video?.metadata || null,
    });
  } catch (e) {
    return NextResponse.json({ analysis: null, metadata: null });
  }
}
