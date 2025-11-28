/**
 * Cloud Storage Service for Videos
 * 
 * Uploads downloaded videos to Google Cloud Storage
 * Required for Gemini File API
 */

import { Storage } from '@google-cloud/storage'
import fs from 'fs/promises'
import path from 'path'

export interface StorageOptions {
  projectId?: string
  bucketName?: string
  credentialsPath?: string
}

export interface UploadResult {
  success: boolean
  publicUrl?: string
  gsUrl?: string // gs://bucket/file format for Gemini
  error?: string
}

export class VideoStorageService {
  private storage?: Storage
  private bucketName: string
  private bucket?: any
  private useGCS: boolean

  constructor(options: StorageOptions = {}) {
    const projectId = options.projectId || process.env.GOOGLE_CLOUD_PROJECT_ID
    const credentialsPath = options.credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS
    this.bucketName = options.bucketName || process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'hagen-video-analysis'

    // Only initialize GCS if credentials are provided
    this.useGCS = !!projectId
    
    if (this.useGCS) {
      const storageConfig: any = { projectId }
      
      if (credentialsPath) {
        storageConfig.keyFilename = credentialsPath
      }

      this.storage = new Storage(storageConfig)
      this.bucket = this.storage.bucket(this.bucketName)
    }
  }

  /**
   * Upload video file to Google Cloud Storage
   */
  async uploadVideo(localFilePath: string, videoId: string): Promise<UploadResult> {
    if (!this.useGCS || !this.bucket) {
      return {
        success: false,
        error: 'Google Cloud Storage not configured. Use uploadToGeminiFileAPI instead.'
      }
    }

    try {
      console.log(`☁️ Uploading to GCS: ${localFilePath}`)

      // Generate unique filename
      const ext = path.extname(localFilePath)
      const filename = `videos/${videoId}${ext}`

      // Upload file
      await this.bucket.upload(localFilePath, {
        destination: filename,
        metadata: {
          contentType: 'video/mp4',
          metadata: {
            videoId,
            uploadedAt: new Date().toISOString()
          }
        }
      })

      // Get URLs
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filename}`
      const gsUrl = `gs://${this.bucketName}/${filename}`

      console.log(`✅ Uploaded to GCS: ${gsUrl}`)

      return {
        success: true,
        publicUrl,
        gsUrl
      }

    } catch (error) {
      console.error('❌ Upload to GCS failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Upload to Gemini File API (alternative approach)
   * This uploads directly to Gemini's temporary storage
   */
  async uploadToGeminiFileAPI(localFilePath: string, mimeType: string = 'video/mp4'): Promise<UploadResult> {
    try {
      const { GoogleAIFileManager, FileState } = await import('@google/generative-ai/server')
      
      const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!)
      
      console.log(`☁️ Uploading to Gemini File API: ${localFilePath}`)
      
      // Upload file
      const uploadResult = await fileManager.uploadFile(localFilePath, {
        mimeType,
        displayName: path.basename(localFilePath),
      })

      console.log(`⏳ File uploaded, waiting for processing: ${uploadResult.file.name}`)

      // Wait for file to be ready (ACTIVE state)
      let file = uploadResult.file
      while (file.state === FileState.PROCESSING) {
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
        file = await fileManager.getFile(file.name)
        console.log(`   File state: ${file.state}`)
      }

      if (file.state !== FileState.ACTIVE) {
        throw new Error(`File processing failed. Final state: ${file.state}`)
      }

      console.log(`✅ File ready for analysis: ${file.uri}`)

      return {
        success: true,
        gsUrl: file.uri // Returns URI like "https://generativelanguage.googleapis.com/v1beta/files/..."
      }

    } catch (error) {
      console.error('❌ Upload to Gemini File API failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Delete video from storage
   */
  async deleteVideo(gsUrl: string): Promise<void> {
    try {
      // Extract filename from gs:// URL
      const filename = gsUrl.replace(`gs://${this.bucketName}/`, '')
      await this.bucket.file(filename).delete()
      console.log(`🗑️ Deleted from GCS: ${filename}`)
    } catch (error) {
      console.error('Delete from GCS failed:', error)
    }
  }

  /**
   * Check if bucket exists and is accessible
   */
  async verifyBucket(): Promise<boolean> {
    try {
      const [exists] = await this.bucket.exists()
      if (!exists) {
        console.log(`📦 Creating bucket: ${this.bucketName}`)
        await this.storage.createBucket(this.bucketName, {
          location: 'US',
          storageClass: 'STANDARD'
        })
      }
      return true
    } catch (error) {
      console.error('Bucket verification failed:', error)
      return false
    }
  }
}

export function createVideoStorageService(options?: StorageOptions): VideoStorageService {
  return new VideoStorageService(options)
}
