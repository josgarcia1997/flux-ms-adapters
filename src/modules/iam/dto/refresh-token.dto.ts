import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Refresh token (también acepta refresh_token en snake_case)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ description: 'Refresh token en snake_case' })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
