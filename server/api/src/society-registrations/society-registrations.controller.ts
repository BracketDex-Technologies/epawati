import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateSocietyRegistrationDto } from './dto/create-society-registration.dto';
import { SocietyRegistrationsService } from './society-registrations.service';

@ApiTags('society registrations')
@Controller('society-registrations')
export class SocietyRegistrationsController {
  constructor(private readonly societyRegistrationsService: SocietyRegistrationsService) {}

  @Post()
  create(@Body() dto: CreateSocietyRegistrationDto) {
    return this.societyRegistrationsService.create(dto);
  }
}
