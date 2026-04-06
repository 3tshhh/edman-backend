import { PartialType } from '@nestjs/swagger';
import { CreateCenterDto } from './create-center.dto.js';

export class UpdateCenterDto extends PartialType(CreateCenterDto) {}
