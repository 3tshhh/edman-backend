import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MapService } from './map.service.js';
import { AdminAuth } from '../../common/decorators/index.js';

@ApiTags('map')
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('context')
  @AdminAuth()
  getContext() {
    return this.mapService.getContext();
  }
}
