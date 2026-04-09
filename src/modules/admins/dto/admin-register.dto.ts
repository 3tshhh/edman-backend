import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AdminRegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(14)
  nationalId!: string;
}
