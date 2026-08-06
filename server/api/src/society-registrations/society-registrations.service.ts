import { BadRequestException, Injectable } from '@nestjs/common';
import { normalizeIndianMobile } from '../common/security/indian-phone';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSocietyRegistrationDto } from './dto/create-society-registration.dto';
import { ListSocietyRegistrationsQueryDto } from './dto/list-society-registrations-query.dto';

const MAX_TEMPLATE_BYTES = 6 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:([^;]+);base64,([a-zA-Z0-9+/=\r\n]+)$/u;
const TEN_DIGIT_INDIAN_MOBILE = /^[6-9]\d{9}$/;

@Injectable()
export class SocietyRegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListSocietyRegistrationsQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const search = query.search?.trim();
    const where = search
      ? {
          OR: [
            { societyName: { contains: search, mode: 'insensitive' as const } },
            { societyAddress: { contains: search, mode: 'insensitive' as const } },
            { chairmanName: { contains: search, mode: 'insensitive' as const } },
            { secretaryName: { contains: search, mode: 'insensitive' as const } },
            { chairmanMobile: { contains: search } },
            { secretaryMobile: { contains: search } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.societyRegistration.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
        where,
      }),
      this.prisma.societyRegistration.count({ where }),
    ]);

    return {
      items,
      meta: {
        limit: query.limit,
        page: query.page,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async create(dto: CreateSocietyRegistrationDto) {
    const template = this.validateTemplate(dto);
    const societyName = cleanRequiredText(dto.societyName, 'Society name is required.');
    const societyAddress = cleanRequiredText(dto.societyAddress, 'Society address is required.');
    const chairmanMobile = normalizeSocietyMobile(dto.chairmanMobile, 'Chairman mobile number must be exactly 10 digits.');
    if (!chairmanMobile) {
      throw new BadRequestException('Chairman mobile number must be a valid Indian mobile number.');
    }
    const secretaryMobileText = cleanOptionalText(dto.secretaryMobile);
    const secretaryMobile = secretaryMobileText ? normalizeSocietyMobile(secretaryMobileText, 'Secretary mobile number must be exactly 10 digits.') : undefined;
    if (secretaryMobileText && !secretaryMobile) {
      throw new BadRequestException('Secretary mobile number must be a valid Indian mobile number.');
    }
    if (secretaryMobile && secretaryMobile === chairmanMobile) {
      throw new BadRequestException('Chairman and secretary mobile numbers must be different.');
    }

    const existing = await this.prisma.societyRegistration.findFirst({
      where: {
        OR: [
          { societyName: { equals: societyName, mode: 'insensitive' } },
          { chairmanMobile: { in: compact([chairmanMobile, secretaryMobile]) } },
          { secretaryMobile: { in: compact([chairmanMobile, secretaryMobile]) } },
        ],
      },
    });
    if (existing) {
      if (existing.societyName.toLowerCase() === societyName.toLowerCase()) {
        throw new BadRequestException('This society/building is already registered.');
      }
      throw new BadRequestException('This mobile number is already registered with another society.');
    }

    const registration = await this.prisma.societyRegistration.create({
      data: {
        chairmanMobile,
        chairmanName: cleanOptionalText(dto.chairmanName),
        email: cleanOptionalText(dto.email),
        numberOfFlats: dto.numberOfFlats,
        secretaryMobile,
        secretaryName: cleanOptionalText(dto.secretaryName),
        societyAddress,
        societyName,
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

function cleanRequiredText(value: string | undefined, message: string): string {
  const text = value?.trim();
  if (!text) throw new BadRequestException(message);
  return text;
}

function normalizeSocietyMobile(value: string | undefined, message: string): string {
  const text = value?.trim();
  if (!text || !TEN_DIGIT_INDIAN_MOBILE.test(text)) {
    throw new BadRequestException(message);
  }
  const normalized = normalizeIndianMobile(text);
  if (!normalized) throw new BadRequestException(message);
  return normalized;
}

function compact<T>(values: Array<T | undefined>): T[] {
  return values.filter((value): value is T => value !== undefined);
}
