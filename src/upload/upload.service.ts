import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { EnvConfig } from '../config/env.config';

export interface UploadedFile {
  originalName: string;
  filename: string;
  path: string;
  url: string;
  size: number;
  mimetype: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir: string;
  private readonly maxFileSize: number;
  private readonly allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];
  private readonly allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
  private readonly allowedAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
  private readonly allowedDocumentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
  ];

  constructor(private configService: ConfigService) {
    this.uploadDir =
      this.configService.get<string>(EnvConfig.UPLOAD_DIR) || './uploads';
    this.maxFileSize =
      this.configService.get<number>(EnvConfig.MAX_FILE_SIZE) ||
      10 * 1024 * 1024;

    // Ensure upload directory exists
    this.ensureUploadDir().catch((error) => {
      this.logger.error('Failed to ensure upload directory', error);
    });
  }

  private async ensureUploadDir() {
    if (!existsSync(this.uploadDir)) {
      await mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadDir}`);
    }
  }

  /**
   * Upload a single image
   */
  async uploadImage(file: Express.Multer.File): Promise<UploadedFile> {
    this.validateFile(file, this.allowedImageTypes, 'image');
    return this.saveFile(file, 'images');
  }

  /**
   * Upload multiple images
   */
  async uploadImages(files: Express.Multer.File[]): Promise<UploadedFile[]> {
    return Promise.all(files.map((file) => this.uploadImage(file)));
  }

  /**
   * Upload a single video
   */
  async uploadVideo(file: Express.Multer.File): Promise<UploadedFile> {
    this.validateFile(file, this.allowedVideoTypes, 'video');
    return this.saveFile(file, 'videos');
  }

  /**
   * Upload multiple videos
   */
  async uploadVideos(files: Express.Multer.File[]): Promise<UploadedFile[]> {
    return Promise.all(files.map((file) => this.uploadVideo(file)));
  }

  /**
   * Upload a single audio file
   */
  async uploadAudio(file: Express.Multer.File): Promise<UploadedFile> {
    this.validateFile(file, this.allowedAudioTypes, 'audio');
    return this.saveFile(file, 'audio');
  }

  /**
   * Upload multiple audio files
   */
  async uploadAudios(files: Express.Multer.File[]): Promise<UploadedFile[]> {
    return Promise.all(files.map((file) => this.uploadAudio(file)));
  }

  /**
   * Upload a single document
   */
  async uploadDocument(file: Express.Multer.File): Promise<UploadedFile> {
    this.validateFile(file, this.allowedDocumentTypes, 'document');
    return this.saveFile(file, 'documents');
  }

  /**
   * Upload multiple documents
   */
  async uploadDocuments(files: Express.Multer.File[]): Promise<UploadedFile[]> {
    return Promise.all(files.map((file) => this.uploadDocument(file)));
  }

  /**
   * Validate file
   */
  private validateFile(
    file: Express.Multer.File,
    allowedTypes: string[],
    fileType: string,
  ): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / (1024 * 1024)}MB`,
      );
    }

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid ${fileType} type. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }
  }

  /**
   * Save file to disk
   */
  private async saveFile(
    file: Express.Multer.File,
    subfolder: string,
  ): Promise<UploadedFile> {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const randomString = randomBytes(8).toString('hex');
      const extension = file.originalname.split('.').pop();
      const filename = `${timestamp}-${randomString}.${extension}`;

      // Create subfolder if it doesn't exist
      const subfolderPath = join(this.uploadDir, subfolder);
      if (!existsSync(subfolderPath)) {
        await mkdir(subfolderPath, { recursive: true });
      }

      // Save file
      const filepath = join(subfolderPath, filename);
      await writeFile(filepath, file.buffer);

      // Generate URL
      const port = this.configService.get<number>(EnvConfig.PORT) || 5000;
      const baseUrl =
        this.configService.get<string>(EnvConfig.BASE_URL) ||
        `http://localhost:${port}`;
      const url = `${baseUrl}/uploads/${subfolder}/${filename}`;

      this.logger.log(`File uploaded: ${filename}`);

      return {
        originalName: file.originalname,
        filename,
        path: filepath,
        url,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      this.logger.error('Failed to save file', error);
      throw new BadRequestException('Failed to upload file');
    }
  }

  /**
   * Get file type from mimetype
   */
  getFileType(
    mimetype: string,
  ): 'image' | 'video' | 'audio' | 'document' | 'unknown' {
    if (this.allowedImageTypes.includes(mimetype)) return 'image';
    if (this.allowedVideoTypes.includes(mimetype)) return 'video';
    if (this.allowedAudioTypes.includes(mimetype)) return 'audio';
    if (this.allowedDocumentTypes.includes(mimetype)) return 'document';
    return 'unknown';
  }
}
