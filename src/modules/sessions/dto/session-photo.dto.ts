import { IsNotEmpty, IsString } from 'class-validator';

export class SessionPhotoDto {
  @IsNotEmpty()
  @IsString()
  photoKey!: string;
}
