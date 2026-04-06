import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { VolunteerGroup } from '../../../common/constants/enums.js';

export class QueryFeedDto {
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
