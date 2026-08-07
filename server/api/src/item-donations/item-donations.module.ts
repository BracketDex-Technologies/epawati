import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ItemDonationsController } from './item-donations.controller';
import { ItemDonationsService } from './item-donations.service';

@Module({
  controllers: [ItemDonationsController],
  imports: [AuthModule],
  providers: [ItemDonationsService],
})
export class ItemDonationsModule {}
