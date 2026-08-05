import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty({ example: 'Darshan Choudhari' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'darshan@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+918605589062' })
  @IsPhoneNumber('IN')
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Pune, Maharashtra' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}
