import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VolunteerGroup } from '../../../common/constants/enums.js';

export class CreatePlaceDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  latitude!: number;

  @IsNotEmpty()
  @IsNumber()
  longitude!: number;

  @IsNotEmpty()
  @IsEnum(VolunteerGroup)
  volunteerGroup!: VolunteerGroup;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  placeType?: string;

  @IsOptional()
  @IsString()
  photoKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(5000)
  proximityThresholdMeters?: number;
}
