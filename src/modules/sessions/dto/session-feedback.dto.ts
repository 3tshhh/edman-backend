import { IsNotEmpty, IsString } from 'class-validator';

export class SessionFeedbackDto {
  @IsNotEmpty()
  @IsString()
  text!: string;
}
