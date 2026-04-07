import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

export class RegisterConfirmDto {
  @ApiProperty({ description: 'Tenant ID del proceso de registro', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  tenant_id: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: '6-digit OTP from email', example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'The OTP code must be 6 digits' })
  otp: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  password: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  username: string;
}
