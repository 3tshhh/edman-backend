import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { VolunteerGroup } from '../../../common/constants/enums.js';

export class CreateSubAdminDto {
  @IsNotEmpty()
  @IsString()
  phone!: string;

  @IsNotEmpty()
  @IsEnum(VolunteerGroup)
  assignedGroup!: VolunteerGroup;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;
}
