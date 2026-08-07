import { PartialType } from '@nestjs/swagger';
import { CreateItemDonationDto } from './create-item-donation.dto';

export class UpdateItemDonationDto extends PartialType(CreateItemDonationDto) {}
