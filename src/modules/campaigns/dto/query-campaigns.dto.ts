import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { VolunteerGroup } from '../../../common/constants/enums.js';

export class QueryCampaignsDto {
  /** Accepts a single status or comma-separated statuses, e.g. "open,in_progress" */
  @IsOptional()
  @IsString()
  status?: string;

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
