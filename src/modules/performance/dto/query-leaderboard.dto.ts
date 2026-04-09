import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { VolunteerGroup } from '../../../common/constants/enums.js';

export class QueryLeaderboardDto {
  @IsOptional()
  @IsIn(['hours', 'campaigns', 'places', 'consistency', 'achievement'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: string;

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
