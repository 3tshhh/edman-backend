import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { VolunteerGroup } from '../../../common/constants/enums.js';

export class CreateCampaignDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsUUID()
  placeId!: string;

  @IsNotEmpty()
  @IsEnum(VolunteerGroup)
  volunteerGroup!: VolunteerGroup;

  @IsNotEmpty()
  @IsDateString()
  scheduledDate!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxVolunteers?: number;
}
