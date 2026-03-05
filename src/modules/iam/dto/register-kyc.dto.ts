import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterKycDto {
  @ApiPropertyOptional({ maxLength: 60 })
  @IsString()
  @IsOptional()
  @MaxLength(60)
  kycResult?: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName: string;

  @ApiProperty({ example: '1990-01-15' })
  @IsDateString()
  dateBirth: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  nationality?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateIssue?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  country?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  department?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  municipality?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  neighborhood?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  addressLine?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  extras?: string;
}
