import { IsNotEmpty, IsString } from 'class-validator';

export class RejectVolunteerDto {
  @IsNotEmpty()
  @IsString()
  reason!: string;
}
