import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all rated videos, ordered by most recent first
    const { data: videos, error } = await supabase
      .from('analyzed_videos')
      .select('id, video_url, platform, metadata, rated_at, user_ratings')
      .not('user_ratings', 'is', null)
      .order('rated_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch library:', error);
      return NextResponse.json(
        { error: 'Failed to fetch video library' },
        { status: 500 }
      );
    }

    return NextResponse.json({ videos: videos || [] });
  } catch (error) {
    console.error('Library API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
