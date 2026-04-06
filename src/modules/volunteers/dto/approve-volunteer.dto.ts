import { IsEnum, IsNotEmpty } from 'class-validator';
import { VolunteerGroup } from '../../../common/constants/enums.js';

export class ApproveVolunteerDto {
  @IsNotEmpty()
  @IsEnum(VolunteerGroup)
  volunteerGroup!: VolunteerGroup;
}
