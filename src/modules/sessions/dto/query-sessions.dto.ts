import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  SessionStatus,
  VolunteerGroup,
} from '../../../common/constants/enums.js';

export class QuerySessionsDto {
  @IsOptional()
  @IsUUID()
  volunteerId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsEnum(VolunteerGroup)
  group?: VolunteerGroup;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
