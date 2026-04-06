import { IsNotEmpty, IsString } from 'class-validator';

export class LeaveSessionDto {
  @IsNotEmpty()
  @IsString()
  reason!: string;
}
