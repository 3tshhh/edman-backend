import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import {
  Area,
  EducationalLevel,
  Governorate,
} from '../../../common/constants/enums.js';

export class ApplyVolunteerDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  fullName!: string;

  @IsNotEmpty()
  @IsString()
  @Length(14, 14)
  nationalId!: string;

  @IsOptional()
  @IsString()
  nationalIdPhotoKey?: string;

  @IsEnum(Governorate)
  governorate!: Governorate;

  @IsEnum(Area)
  area!: Area;

  @IsEnum(EducationalLevel)
  educationalLevel!: EducationalLevel;

  @IsOptional()
  @IsBoolean()
  hasCar?: boolean;
}
