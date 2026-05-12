import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/studio-v2/customers/:customerId/hagen-clips
 *
 * Returns TikTok clips from the Hagen library in a shape suitable for hagen-ui history sync.
 *
 * Response shape:
 * {
 *   clips: Array<{
 *     tiktok_url: string;
 *     source_username?: string | null;
 *     description?: string | null;
 *     tiktok_thumbnail_url?: string | null;
 *     tiktok_views?: number | null;
 *     tiktok_likes?: number | null;
 *     tiktok_comments?: number | null;
 *     published_at?: string | null;
 *   }>
 * }
 *
 * The customerId is currently unused — Hagen does not track LeTrend customer IDs.
 * All TikTok clips in the library are returned. The caller (hagen-ui) filters by handle.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all TikTok videos from analyzed_videos
    // Use all=true semantics: include unrated videos
    const { data: videos, error } = await supabase
      .from('analyzed_videos')
      .select('id, video_url, platform, metadata, created_at')
      .eq('platform', 'tiktok')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch TikTok library:', error);
      return NextResponse.json(
        { error: 'Failed to fetch TikTok library', message: error.message },
        { status: 500 }
      );
    }

    // Transform to HagenClip shape expected by hagen-ui
    const clips = (videos || []).map((video) => {
      const metadata = video.metadata as any;

      // Extract TikTok stats from metadata
      const stats = metadata?.statistics || metadata?.stats || {};
      const author = metadata?.author || {};

      // Extract description/title
      const description = metadata?.description || metadata?.desc || metadata?.title || null;

      // Extract thumbnail
      const thumbnail = metadata?.video?.cover || metadata?.video?.dynamicCover || metadata?.cover || null;

      // Extract username - normalize by removing @ prefix if present
      let sourceUsername: string | null = null;
      if (author?.uniqueId) {
        sourceUsername = author.uniqueId;
      } else if (author?.username) {
        sourceUsername = author.username;
      } else if (metadata?.username) {
        sourceUsername = metadata.username;
      } else {
        // Fallback: parse username from TikTok URL
        try {
          const url = new URL(video.video_url);
          if (url.hostname === 'www.tiktok.com' || url.hostname === 'tiktok.com') {
            const match = url.pathname.match(/^\/@([^/]+)/);
            if (match) {
              sourceUsername = match[1];
            }
          }
        } catch {
          // Invalid URL, leave sourceUsername as null
        }
      }
      // Normalize: ensure no @ prefix
      if (sourceUsername && sourceUsername.startsWith('@')) {
        sourceUsername = sourceUsername.slice(1);
      }

      // Extract published date
      const publishedAt = metadata?.createTime
        ? new Date(metadata.createTime * 1000).toISOString()
        : metadata?.created_at || video.created_at || null;

      return {
        tiktok_url: video.video_url,
        source_username: sourceUsername,
        description: description,
        tiktok_thumbnail_url: thumbnail,
        tiktok_views: typeof stats.playCount === 'number' ? stats.playCount : null,
        tiktok_likes: typeof stats.diggCount === 'number' ? stats.diggCount : null,
        tiktok_comments: typeof stats.commentCount === 'number' ? stats.commentCount : null,
        published_at: publishedAt,
      };
    });

    return NextResponse.json({ clips });
  } catch (error) {
    console.error('Hagen clips API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
