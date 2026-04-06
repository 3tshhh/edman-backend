import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { VolunteerGroup } from '../../../common/constants/enums.js';

export class CreateAnnouncementDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsNotEmpty()
  @IsString()
  body!: string;

  @IsOptional()
  @IsEnum(VolunteerGroup)
  targetGroup?: VolunteerGroup | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsString()
  priority?: string;
}
