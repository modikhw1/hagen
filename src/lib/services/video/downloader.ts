/**
 * Video Download Service
 * 
 * Downloads videos from TikTok, YouTube, etc. for deep analysis
 * Requires external tools since direct TikTok downloading is complex
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export interface DownloadOptions {
  outputDir?: string
  maxFileSize?: number // MB
  quality?: 'high' | 'medium' | 'low'
}

export interface DownloadResult {
  success: boolean
  filePath?: string
  fileSize?: number // bytes
  duration?: number // seconds
  error?: string
}

export class VideoDownloader {
  private outputDir: string
  private maxFileSize: number
  
  constructor(options: DownloadOptions = {}) {
    this.outputDir = options.outputDir || process.env.VIDEO_STORAGE_PATH || '/tmp/hagen-videos'
    this.maxFileSize = (options.maxFileSize || 100) * 1024 * 1024 // Convert MB to bytes
  }

  /**
   * Main download method - tries best available strategy
   */
  async download(url: string, options?: { outputDir?: string }): Promise<DownloadResult> {
    // Update output dir if provided
    if (options?.outputDir) {
      this.outputDir = options.outputDir
    }

    // Default to yt-dlp as it's the most robust for TikTok
    return this.downloadWithYtDlp(url)
  }

  /**
   * Download video using yt-dlp (most reliable for TikTok)
   * 
   * Installation required:
   *   Ubuntu/Debian: sudo apt install yt-dlp
   *   Mac: brew install yt-dlp
   *   Or: pip install yt-dlp (recommended - handles SSL better)
   */
  async downloadWithYtDlp(url: string): Promise<DownloadResult> {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputDir, { recursive: true })

      const filename = `video_${Date.now()}.mp4`
      const outputPath = path.join(this.outputDir, filename)

      console.log(`📥 Downloading video: ${url}`)

      // Use Python's yt-dlp (handles SSL/certificates better than system yt-dlp)
      // Try multiple Python commands (python3, python, or full path on Windows)
      const pythonCmd = process.platform === 'win32' 
        ? `"${process.env.LOCALAPPDATA}\\Programs\\Python\\Python314\\python.exe"`
        : 'python3'
      
      const command = [
        pythonCmd,
        '-m',
        'yt_dlp',
        '--no-cache-dir',
        '--no-playlist',
        '--format', 'best[ext=mp4]/best', // Prefer mp4
        '--max-filesize', `${this.maxFileSize}`,
        '--output', outputPath,
        '--no-warnings',
        '--quiet',
        `"${url}"`
      ].join(' ')

      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000 // 60 second timeout
      })

      // Check if file exists
      try {
        const stats = await fs.stat(outputPath)
        
        console.log(`✅ Downloaded: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)

        return {
          success: true,
          filePath: outputPath,
          fileSize: stats.size
        }
      } catch (err) {
        throw new Error('Download completed but file not found')
      }

    } catch (error) {
      console.error('❌ Download failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Alternative: Use Supadata's download API (if available)
   * Check Supadata docs for download endpoint
   */
  async downloadWithSupadata(url: string, apiKey: string): Promise<DownloadResult> {
    try {
      const supadataUrl = `https://api.supadata.ai/v1/download?url=${encodeURIComponent(url)}`
      
      const response = await fetch(supadataUrl, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Supadata download failed: ${response.status}`)
      }

      // Check if response has download URL or direct binary
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        // Response is JSON with download URL
        const data = await response.json()
        if (data.downloadUrl) {
          return this.downloadFromUrl(data.downloadUrl)
        }
        throw new Error('No download URL in response')
      } else {
        // Direct binary download
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        await fs.mkdir(this.outputDir, { recursive: true })
        const filename = `video_${Date.now()}.mp4`
        const outputPath = path.join(this.outputDir, filename)
        
        await fs.writeFile(outputPath, buffer)
        
        return {
          success: true,
          filePath: outputPath,
          fileSize: buffer.length
        }
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Download from direct URL
   */
  private async downloadFromUrl(url: string): Promise<DownloadResult> {
    try {
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      await fs.mkdir(this.outputDir, { recursive: true })
      const filename = `video_${Date.now()}.mp4`
      const outputPath = path.join(this.outputDir, filename)

      await fs.writeFile(outputPath, buffer)

      console.log(`✅ Downloaded from URL: ${outputPath}`)

      return {
        success: true,
        filePath: outputPath,
        fileSize: buffer.length
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Clean up downloaded files
   */
  async cleanup(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
      console.log(`🗑️ Cleaned up: ${filePath}`)
    } catch (error) {
      console.error('Cleanup failed:', error)
    }
  }

  /**
   * Clean up old files (older than specified hours)
   */
  async cleanupOldFiles(olderThanHours: number = 24): Promise<void> {
    try {
      const files = await fs.readdir(this.outputDir)
      const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000)

      for (const file of files) {
        const filePath = path.join(this.outputDir, file)
        const stats = await fs.stat(filePath)
        
        if (stats.mtimeMs < cutoffTime) {
          await fs.unlink(filePath)
          console.log(`🗑️ Cleaned up old file: ${file}`)
        }
      }
    } catch (error) {
      console.error('Bulk cleanup failed:', error)
    }
  }
}

export function createVideoDownloader(options?: DownloadOptions): VideoDownloader {
  return new VideoDownloader(options)
}
