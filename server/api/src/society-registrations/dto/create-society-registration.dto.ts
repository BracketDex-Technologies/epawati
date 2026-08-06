import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
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

const TEN_DIGIT_INDIAN_MOBILE = /^[6-9]\d{9}$/;
const TEN_DIGIT_INDIAN_MOBILE_MESSAGE = 'Enter a valid 10-digit Indian mobile number.';

export class CreateSocietyRegistrationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  societyName!: string;

  @IsString()
  @IsNotEmpty()
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

  @Matches(TEN_DIGIT_INDIAN_MOBILE, { message: TEN_DIGIT_INDIAN_MOBILE_MESSAGE })
  chairmanMobile!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TEN_DIGIT_INDIAN_MOBILE, { message: TEN_DIGIT_INDIAN_MOBILE_MESSAGE })
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
