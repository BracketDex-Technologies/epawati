import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SocietyRegistrationsController } from './society-registrations.controller';
import { SocietyRegistrationsService } from './society-registrations.service';

@Module({
  controllers: [SocietyRegistrationsController],
  imports: [PrismaModule],
  providers: [SocietyRegistrationsService],
})
export class SocietyRegistrationsModule {}
