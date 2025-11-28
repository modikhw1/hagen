'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface VideoLibraryItem {
  id: string;
  video_url: string;
  platform: string;
  metadata: {
    title?: string;
    author?: {
      uniqueId?: string;
      nickname?: string;
    };
  };
  rated_at: string;
  user_ratings?: {
    overall_rating?: number;
  };
}

export default function LibraryPage() {
  const [videos, setVideos] = useState<VideoLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/videos/library');
      if (response.ok) {
        const data = await response.json();
        setVideos(data.videos || []);
      }
    } catch (error) {
      console.error('Failed to fetch library:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getVideoTitle = (video: VideoLibraryItem) => {
    if (video.metadata?.title) {
      return video.metadata.title;
    }
    const author = video.metadata?.author?.uniqueId || video.metadata?.author?.nickname;
    return author ? `Video by @${author}` : 'Untitled Video';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Video Library</h1>
          <Link 
            href="/feedback"
            className="text-blue-600 hover:text-blue-800 transition-colors"
          >
            ← Back to Feedback
          </Link>
        </div>

        {videos.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No rated videos yet</p>
              <Link 
                href="/feedback"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Rate your first video
              </Link>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-gray-100">
              {videos.map((video) => (
                <div 
                  key={video.id}
                  className="py-4 px-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <a
                        href={video.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-800 hover:text-blue-600 transition-colors font-medium truncate block"
                      >
                        {getVideoTitle(video)}
                      </a>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">
                          {formatDate(video.rated_at)}
                        </span>
                        {video.user_ratings?.overall_rating && (
                          <span className="text-xs text-gray-400">
                            ★ {video.user_ratings.overall_rating}/10
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {video.platform}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="mt-4 text-sm text-gray-600 text-center">
          {videos.length} {videos.length === 1 ? 'video' : 'videos'} in library
        </div>
      </div>
    </div>
  );
}
