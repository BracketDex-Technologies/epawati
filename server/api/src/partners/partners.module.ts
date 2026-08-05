import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';

@Module({
  controllers: [PartnersController],
  imports: [AuthModule],
  providers: [PartnersService],
})
export class PartnersModule {}
