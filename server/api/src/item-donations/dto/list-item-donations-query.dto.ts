import { ApiPropertyOptional } from '@nestjs/swagger';
import { ItemDonationCategory } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListItemDonationsQueryDto {
  @ApiPropertyOptional({ enum: ItemDonationCategory })
  @IsOptional()
  @IsEnum(ItemDonationCategory)
  category?: ItemDonationCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
