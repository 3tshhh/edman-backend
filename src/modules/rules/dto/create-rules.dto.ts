import { IsNotEmpty, IsString } from 'class-validator';

export class CreateRulesDto {
  @IsNotEmpty()
  @IsString()
  content!: string;
}
