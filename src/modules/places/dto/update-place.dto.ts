import { PartialType } from '@nestjs/swagger';
import { CreatePlaceDto } from './create-place.dto.js';

export class UpdatePlaceDto extends PartialType(CreatePlaceDto) {}
