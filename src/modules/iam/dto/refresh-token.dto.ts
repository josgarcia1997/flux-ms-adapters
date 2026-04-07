import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Tenant ID del usuario', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  tenant_id: string;

  @ApiPropertyOptional({ description: 'Refresh token (también acepta refresh_token en snake_case)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ description: 'Refresh token en snake_case' })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
