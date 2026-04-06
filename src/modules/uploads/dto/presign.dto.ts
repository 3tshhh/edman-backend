import { IsNotEmpty, IsString } from 'class-validator';

export class PresignDto {
  @IsNotEmpty()
  @IsString()
  filename!: string;

  @IsNotEmpty()
  @IsString()
  contentType!: string;
}
