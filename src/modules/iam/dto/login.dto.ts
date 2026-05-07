import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Tenant ID del usuario', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  tenant_id: string;

  @ApiProperty({ example: '+573001234567', description: 'Número celular en formato E.164' })
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phone_number must be in E.164 format (e.g. +573001234567)' })
  @IsNotEmpty()
  phone_number: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;
}
