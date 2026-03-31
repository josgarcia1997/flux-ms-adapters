import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyPinDto {
  @ApiProperty({ description: 'PIN de 4 dígitos', example: '1234' })
  @IsString()
  @Length(4, 4, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}