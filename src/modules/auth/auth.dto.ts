import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum OtpPurpose {
  LOGIN = 'login',
  CHANGE_PHONE = 'change_phone',
}

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  phone!: string;
}

export class SendOtpDto {
  @IsNotEmpty()
  @IsString()
  phone!: string;

  @IsOptional()
  @IsEnum(OtpPurpose)
  purpose?: OtpPurpose;
}
