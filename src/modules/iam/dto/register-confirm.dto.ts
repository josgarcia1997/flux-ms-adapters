import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsUUID, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterConfirmDto {
  @ApiProperty({ description: 'Tenant ID del proceso de registro', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  tenant_id: string;

  @ApiProperty({ example: '+573001234567', description: 'Número celular en formato E.164' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phone_number must be in E.164 format (e.g. +573001234567)' })
  phone_number: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: '6-digit OTP from SMS/WhatsApp', example: '123456' })
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
