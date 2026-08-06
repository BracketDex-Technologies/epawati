import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const ALLOWED_TEMPLATE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
] as const;

export class CreateSocietyRegistrationDto {
  @IsString()
  @MaxLength(180)
  societyName!: string;

  @IsString()
  @MaxLength(800)
  societyAddress!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  chairmanName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  secretaryName?: string;

  @IsPhoneNumber('IN')
  chairmanMobile!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber('IN')
  secretaryMobile?: string;

  @IsInt()
  @Min(1)
  @Max(5000)
  numberOfFlats!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(240)
  email?: string;

  @IsBoolean()
  templateAvailable!: boolean;

  @ValidateIf((dto: CreateSocietyRegistrationDto) => dto.templateAvailable)
  @IsString()
  @MaxLength(220)
  templateFileName?: string;

  @ValidateIf((dto: CreateSocietyRegistrationDto) => dto.templateAvailable)
  @IsIn(ALLOWED_TEMPLATE_MIME_TYPES)
  templateMimeType?: typeof ALLOWED_TEMPLATE_MIME_TYPES[number];

  @ValidateIf((dto: CreateSocietyRegistrationDto) => dto.templateAvailable)
  @IsString()
  templateDataUrl?: string;
}
