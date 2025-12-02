import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UploadService } from './upload.service';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a single image' })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadImage(file);
  }

  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple images (max 10)' })
  @ApiResponse({ status: 201, description: 'Images uploaded successfully' })
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    return this.uploadService.uploadImages(files);
  }

  @Post('video')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a single video' })
  @ApiResponse({ status: 201, description: 'Video uploaded successfully' })
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadVideo(file);
  }

  @Post('videos')
  @UseInterceptors(FilesInterceptor('files', 5))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple videos (max 5)' })
  @ApiResponse({ status: 201, description: 'Videos uploaded successfully' })
  async uploadVideos(@UploadedFiles() files: Express.Multer.File[]) {
    return this.uploadService.uploadVideos(files);
  }

  @Post('audio')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a single audio file' })
  @ApiResponse({ status: 201, description: 'Audio uploaded successfully' })
  async uploadAudio(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadAudio(file);
  }

  @Post('audios')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple audio files (max 10)' })
  @ApiResponse({
    status: 201,
    description: 'Audio files uploaded successfully',
  })
  async uploadAudios(@UploadedFiles() files: Express.Multer.File[]) {
    return this.uploadService.uploadAudios(files);
  }
}
