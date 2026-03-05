import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class RegisterProfileDto {
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

  @ApiProperty({ description: 'UUID from core.countries' })
  @IsUUID()
  countryId: string;

  @ApiProperty({ description: 'UUID from core.identification_types' })
  @IsUUID()
  identificationTypeId: string;

  @ApiProperty({ maxLength: 60 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  documentNumber: string;

  @ApiProperty({ example: 'COP', minLength: 3, maxLength: 3 })
  @IsString()
  @Length(3, 3, { message: 'Currency must be 3 characters (e.g. COP, USD)' })
  currencyCode: string;

  @ApiProperty()
  @IsBoolean()
  termsAccepted: boolean;

  @ApiProperty({ description: '4-digit PIN', example: '1234', minLength: 4, maxLength: 4 })
  @IsString()
  @Length(4, 4, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}
