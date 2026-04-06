import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { VolunteerGroup } from '../../../common/constants/enums.js';

export class CreateCenterDto {
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
  @MaxLength(500)
  address?: string;
}
