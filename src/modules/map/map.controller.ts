import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MapService } from './map.service.js';
import { Auth } from '../../common/decorators/index.js';
import { UserRole } from '../../common/constants/enums.js';

@ApiTags('map')
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('context')
  @Auth(UserRole.ADMIN)
  getContext() {
    return this.mapService.getContext();
  }
}
