import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  @Length(4, 4, { message: 'OTP code must be exactly 4 digits' })
  code!: string;
}
