import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UploadsService } from './uploads.service.js';
import { PresignDto } from './dto/presign.dto.js';
import { Auth } from '../../common/decorators/index.js';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presign')
  @Auth()
  presign(@Body() dto: PresignDto) {
    return this.uploadsService.generatePresignedUrl(
      dto.filename,
      dto.contentType,
    );
  }
}
