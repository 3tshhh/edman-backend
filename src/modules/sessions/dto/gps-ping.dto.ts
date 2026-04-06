import { IsNotEmpty, IsNumber } from 'class-validator';

export class GpsPingDto {
  @IsNotEmpty()
  @IsNumber()
  lat!: number;

  @IsNotEmpty()
  @IsNumber()
  lng!: number;
}
