import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateSocietyRegistrationDto } from './dto/create-society-registration.dto';
import { ListSocietyRegistrationsQueryDto } from './dto/list-society-registrations-query.dto';
import { SocietyRegistrationsService } from './society-registrations.service';

@ApiTags('society registrations')
@Controller('society-registrations')
export class SocietyRegistrationsController {
  constructor(private readonly societyRegistrationsService: SocietyRegistrationsService) {}

  @Post()
  create(@Body() dto: CreateSocietyRegistrationDto) {
    return this.societyRegistrationsService.create(dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  list(@Query() query: ListSocietyRegistrationsQueryDto) {
    return this.societyRegistrationsService.list(query);
  }
}
