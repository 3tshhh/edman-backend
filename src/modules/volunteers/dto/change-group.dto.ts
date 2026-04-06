import { IsEnum, IsNotEmpty } from 'class-validator';
import { VolunteerGroup } from '../../../common/constants/enums.js';

export class ChangeGroupDto {
  @IsNotEmpty()
  @IsEnum(VolunteerGroup)
  volunteerGroup!: VolunteerGroup;
}
