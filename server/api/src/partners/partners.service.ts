import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { ListPartnersQueryDto } from './dto/list-partners-query.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePartnerDto) {
    await this.ensureUniqueContact(dto.email, dto.phone);
    return this.prisma.partner.create({
      data: {
        address: dto.address?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        status: AccountStatus.ACTIVE,
      },
      include: partnerInclude,
    });
  }

  async list(query: ListPartnersQueryDto) {
    const where: Prisma.PartnerWhereInput = {
      status: query.status ?? AccountStatus.ACTIVE,
    };

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.partner.findMany({
      include: partnerInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      where,
    });
  }

  async update(id: string, dto: UpdatePartnerDto) {
    const before = await this.ensurePartner(id);
    await this.ensureUniqueContact(dto.email, dto.phone, id);

    return this.prisma.partner.update({
      data: {
        address: dto.address === undefined ? undefined : dto.address?.trim() || null,
        email: dto.email === undefined ? undefined : dto.email?.trim().toLowerCase() || null,
        name: dto.name?.trim(),
        phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
        status: before.status === AccountStatus.ARCHIVED ? AccountStatus.ACTIVE : undefined,
      },
      include: partnerInclude,
      where: { id },
    });
  }

  async archive(id: string) {
    await this.ensurePartner(id);
    return this.prisma.partner.update({
      data: { status: AccountStatus.ARCHIVED },
      include: partnerInclude,
      where: { id },
    });
  }

  private async ensurePartner(id: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id } });
    if (!partner || partner.status === AccountStatus.ARCHIVED) {
      throw new NotFoundException('Partner not found.');
    }
    return partner;
  }

  private async ensureUniqueContact(email?: string | null, phone?: string | null, excludeId?: string) {
    const checks = [
      email?.trim() ? { email: email.trim().toLowerCase() } : null,
      phone?.trim() ? { phone: phone.trim() } : null,
    ].filter(Boolean) as Array<{ email?: string; phone?: string }>;

    if (!checks.length) return;

    const existing = await this.prisma.partner.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        OR: checks,
      },
    });

    if (existing) {
      throw new ConflictException('Partner email or phone is already used.');
    }
  }
}

const partnerInclude = {
  _count: {
    select: {
      mandals: { where: { status: AccountStatus.ACTIVE } },
    },
  },
  mandals: {
    orderBy: { createdAt: 'desc' },
    select: {
      city: true,
      contactPhone: true,
      id: true,
      locality: true,
      name: true,
      plan: true,
      slug: true,
      status: true,
    },
    where: { status: AccountStatus.ACTIVE },
  },
} satisfies Prisma.PartnerInclude;
