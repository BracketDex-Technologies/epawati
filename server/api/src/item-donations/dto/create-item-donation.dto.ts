import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ItemDonationCategory, ItemDonationWeightUnit } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateItemDonationDto {
  @ApiProperty({ example: 'Shri Sanket Patil' })
  @IsString()
  @MaxLength(180)
  donorName!: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  donorPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  donorAddress?: string | null;

  @ApiProperty({ example: '2026-08-26' })
  @IsISO8601()
  donationDate!: string;

  @ApiProperty({ enum: ItemDonationCategory })
  @IsEnum(ItemDonationCategory)
  category!: ItemDonationCategory;

  @ApiProperty({ example: 'Mukut' })
  @IsString()
  @MaxLength(180)
  itemName!: string;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  weight?: number | null;

  @ApiPropertyOptional({ enum: ItemDonationWeightUnit })
  @IsOptional()
  @IsEnum(ItemDonationWeightUnit)
  weightUnit?: ItemDonationWeightUnit | null;

  @ApiPropertyOptional({ example: '22K' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  purity?: string | null;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ example: 'Mandal locker' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  storageLocation?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
