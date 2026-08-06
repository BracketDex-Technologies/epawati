import { BadRequestException, Injectable } from '@nestjs/common';
import { normalizeIndianMobile } from '../common/security/indian-phone';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSocietyRegistrationDto } from './dto/create-society-registration.dto';

const MAX_TEMPLATE_BYTES = 6 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:([^;]+);base64,([a-zA-Z0-9+/=\r\n]+)$/u;

@Injectable()
export class SocietyRegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSocietyRegistrationDto) {
    const template = this.validateTemplate(dto);
    const chairmanMobile = normalizeIndianMobile(dto.chairmanMobile);
    if (!chairmanMobile) {
      throw new BadRequestException('Chairman mobile number must be a valid Indian mobile number.');
    }
    const secretaryMobileText = cleanOptionalText(dto.secretaryMobile);
    const secretaryMobile = secretaryMobileText ? normalizeIndianMobile(secretaryMobileText) : undefined;
    if (secretaryMobileText && !secretaryMobile) {
      throw new BadRequestException('Secretary mobile number must be a valid Indian mobile number.');
    }
    const registration = await this.prisma.societyRegistration.create({
      data: {
        chairmanMobile,
        chairmanName: cleanOptionalText(dto.chairmanName),
        email: cleanOptionalText(dto.email),
        numberOfFlats: dto.numberOfFlats,
        secretaryMobile,
        secretaryName: cleanOptionalText(dto.secretaryName),
        societyAddress: dto.societyAddress.trim(),
        societyName: dto.societyName.trim(),
        templateAvailable: dto.templateAvailable,
        templateDataUrl: template?.dataUrl,
        templateFileName: template?.fileName,
        templateMimeType: template?.mimeType,
      },
    });

    return {
      createdAt: registration.createdAt,
      id: registration.id,
      ok: true,
      societyName: registration.societyName,
    };
  }

  private validateTemplate(dto: CreateSocietyRegistrationDto) {
    if (!dto.templateAvailable) return undefined;
    if (!dto.templateDataUrl || !dto.templateFileName || !dto.templateMimeType) {
      throw new BadRequestException('Upload the template file or choose No template available.');
    }

    const match = DATA_URL_PATTERN.exec(dto.templateDataUrl);
    if (!match) {
      throw new BadRequestException('Template upload must be a valid data URL.');
    }

    const [, mimeType, base64] = match;
    if (mimeType !== dto.templateMimeType) {
      throw new BadRequestException('Template file type does not match uploaded data.');
    }

    const sizeBytes = Buffer.byteLength(base64.replace(/\s/g, ''), 'base64');
    if (sizeBytes > MAX_TEMPLATE_BYTES) {
      throw new BadRequestException('Template file must be 6 MB or smaller.');
    }

    return {
      dataUrl: dto.templateDataUrl,
      fileName: dto.templateFileName.trim(),
      mimeType: dto.templateMimeType,
    };
  }
}

function cleanOptionalText(value?: string | null): string | undefined {
  const text = value?.trim();
  return text || undefined;
}
