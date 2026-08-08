import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ItemDonation, ItemDonationCategory, ItemDonationWeightUnit, Prisma } from '@prisma/client';
import { PassThrough } from 'node:stream';
import type { AuthContext } from '../auth/auth-context';
import { assertFestivalInMandal, assertSameMandal } from '../auth/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDonationDto } from './dto/create-item-donation.dto';
import { ListItemDonationsQueryDto } from './dto/list-item-donations-query.dto';
import { UpdateItemDonationDto } from './dto/update-item-donation.dto';
import {
  createItemDonationReceiptPdf,
  createItemDonationReportPdf,
  ItemDonationPdfRow,
} from './item-donations-pdf';

type JsonWriteValue = never;

const donationInclude = {
  creator: { select: { id: true, name: true } },
  updater: { select: { id: true, name: true } },
} satisfies Prisma.ItemDonationInclude;

@Injectable()
export class ItemDonationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createItemDonation(
    ctx: AuthContext,
    mandalId: string,
    festivalId: string,
    dto: CreateItemDonationDto,
  ) {
    assertSameMandal(ctx, mandalId);
    await assertFestivalInMandal(this.prisma, mandalId, festivalId);
    this.validateWeight(dto.category, dto.weight, dto.weightUnit);

    return this.prisma.$transaction(async (tx) => {
      const count = await tx.itemDonation.count({ where: { festivalId, mandalId } });
      const receiptNumber = `ID-${new Date(dto.donationDate).getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      const donation = await tx.itemDonation.create({
        data: {
          category: dto.category,
          createdBy: ctx.userId,
          donationDate: new Date(dto.donationDate),
          donorAddress: cleanNullable(dto.donorAddress),
          donorName: dto.donorName.trim(),
          donorPhone: cleanNullable(dto.donorPhone),
          festivalId,
          itemName: dto.itemName.trim(),
          mandalId,
          notes: cleanNullable(dto.notes),
          purity: cleanNullable(dto.purity),
          quantity: dto.quantity ?? 1,
          receiptNumber,
          storageLocation: cleanNullable(dto.storageLocation),
          weight: dto.weight ?? null,
          weightUnit: dto.weightUnit ?? null,
        },
        include: donationInclude,
      });

      await tx.auditEvent.create({
        data: {
          action: 'item_donation_created',
          actorUserId: ctx.userId,
          after: this.toJson(donation),
          entityId: donation.id,
          entityType: 'item_donation',
          mandalId,
        },
      });

      return donation;
    });
  }

  async listItemDonations(
    ctx: AuthContext,
    mandalId: string,
    festivalId: string,
    query: ListItemDonationsQueryDto,
  ) {
    assertSameMandal(ctx, mandalId);
    await assertFestivalInMandal(this.prisma, mandalId, festivalId);

    return this.prisma.itemDonation.findMany({
      include: donationInclude,
      orderBy: [{ donationDate: 'desc' }, { createdAt: 'desc' }],
      where: this.buildWhere(mandalId, festivalId, query),
    });
  }

  async updateItemDonation(
    ctx: AuthContext,
    mandalId: string,
    festivalId: string,
    donationId: string,
    dto: UpdateItemDonationDto,
  ) {
    assertSameMandal(ctx, mandalId);
    await assertFestivalInMandal(this.prisma, mandalId, festivalId);

    const before = await this.prisma.itemDonation.findFirst({
      where: { festivalId, id: donationId, mandalId },
    });
    if (!before) throw new NotFoundException('Item donation not found.');

    const nextCategory = dto.category ?? before.category;
    const nextWeight = dto.weight === undefined ? (before.weight ? Number(before.weight) : null) : dto.weight;
    const nextWeightUnit = dto.weightUnit === undefined ? before.weightUnit : dto.weightUnit;
    this.validateWeight(nextCategory, nextWeight, nextWeightUnit);

    const updated = await this.prisma.itemDonation.update({
      data: {
        category: dto.category,
        donationDate: dto.donationDate ? new Date(dto.donationDate) : undefined,
        donorAddress: cleanOptionalNullable(dto.donorAddress),
        donorName: dto.donorName?.trim(),
        donorPhone: cleanOptionalNullable(dto.donorPhone),
        itemName: dto.itemName?.trim(),
        notes: cleanOptionalNullable(dto.notes),
        purity: cleanOptionalNullable(dto.purity),
        quantity: dto.quantity,
        storageLocation: cleanOptionalNullable(dto.storageLocation),
        updatedBy: ctx.userId,
        weight: dto.weight === undefined ? undefined : dto.weight,
        weightUnit: dto.weightUnit === undefined ? undefined : dto.weightUnit,
      },
      include: donationInclude,
      where: { id: donationId },
    });

    await this.audit(ctx, mandalId, donationId, 'item_donation_updated', before, updated);
    return updated;
  }

  async deleteItemDonation(ctx: AuthContext, mandalId: string, festivalId: string, donationId: string) {
    assertSameMandal(ctx, mandalId);
    await assertFestivalInMandal(this.prisma, mandalId, festivalId);

    const before = await this.prisma.itemDonation.findFirst({
      where: { festivalId, id: donationId, mandalId },
    });
    if (!before) throw new NotFoundException('Item donation not found.');

    await this.prisma.itemDonation.delete({ where: { id: donationId } });
    await this.audit(ctx, mandalId, donationId, 'item_donation_deleted', before, null);
    return { deleted: true, id: donationId };
  }

  async exportReceiptPdf(
    ctx: AuthContext,
    mandalId: string,
    festivalId: string,
    donationId: string,
  ): Promise<PassThrough> {
    assertSameMandal(ctx, mandalId);
    await assertFestivalInMandal(this.prisma, mandalId, festivalId);

    const [mandal, festival, donation] = await Promise.all([
      this.prisma.mandal.findUnique({ select: { address: true, name: true }, where: { id: mandalId } }),
      this.prisma.festival.findUnique({ select: { name: true }, where: { id: festivalId } }),
      this.prisma.itemDonation.findFirst({
        include: donationInclude,
        where: { festivalId, id: donationId, mandalId },
      }),
    ]);
    if (!donation) throw new NotFoundException('Item donation not found.');

    return createItemDonationReceiptPdf(
      {
        festivalName: festival?.name ?? 'Festival',
        generatedAt: new Date(),
        mandalAddress: mandal?.address,
        mandalName: mandal?.name ?? 'Mandal',
      },
      this.toPdfRow(donation),
    );
  }

  async exportReportPdf(
    ctx: AuthContext,
    mandalId: string,
    festivalId: string,
    query: ListItemDonationsQueryDto,
  ): Promise<PassThrough> {
    assertSameMandal(ctx, mandalId);
    await assertFestivalInMandal(this.prisma, mandalId, festivalId);

    const [mandal, festival, donations] = await Promise.all([
      this.prisma.mandal.findUnique({ select: { address: true, name: true }, where: { id: mandalId } }),
      this.prisma.festival.findUnique({
        select: { endDate: true, name: true, startDate: true },
        where: { id: festivalId },
      }),
      this.prisma.itemDonation.findMany({
        include: donationInclude,
        orderBy: [{ donationDate: 'desc' }, { createdAt: 'desc' }],
        where: this.buildWhere(mandalId, festivalId, query),
      }),
    ]);

    return createItemDonationReportPdf(
      {
        festivalName: festival?.name ?? 'Festival',
        filters: describeFilters(query),
        generatedAt: new Date(),
        mandalAddress: mandal?.address,
        mandalName: mandal?.name ?? 'Mandal',
        reportPeriod: describePeriod(query, festival?.startDate, festival?.endDate),
      },
      donations.map((donation) => this.toPdfRow(donation)),
    );
  }

  private buildWhere(mandalId: string, festivalId: string, query: ListItemDonationsQueryDto): Prisma.ItemDonationWhereInput {
    const donationDate =
      query.dateFrom || query.dateTo
        ? {
            gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
            lte: query.dateTo ? reportEndDate(query.dateTo) : undefined,
          }
        : undefined;
    const search = query.search?.trim();

    return {
      category: query.category,
      donationDate,
      festivalId,
      mandalId,
      OR: search
        ? [
            { donorName: { contains: search, mode: 'insensitive' } },
            { itemName: { contains: search, mode: 'insensitive' } },
            { receiptNumber: { contains: search, mode: 'insensitive' } },
            { storageLocation: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
  }

  private validateWeight(
    category: ItemDonationCategory,
    weight?: number | null,
    weightUnit?: ItemDonationWeightUnit | null,
  ) {
    if (weight && !weightUnit) {
      throw new BadRequestException('Select weight unit when weight is entered.');
    }
    if (!weight && weightUnit) {
      throw new BadRequestException('Enter weight when weight unit is selected.');
    }
    if (category === ItemDonationCategory.OTHER && (weight || weightUnit)) {
      throw new BadRequestException('Weight is only for gold, silver, or jewellery donations.');
    }
  }

  private toPdfRow(
    donation: ItemDonation & { creator: { name: string }; updater?: { name: string } | null },
  ): ItemDonationPdfRow {
    return {
      category: donation.category,
      createdBy: donation.creator.name,
      donationDate: donation.donationDate,
      donorAddress: donation.donorAddress,
      donorName: donation.donorName,
      donorPhone: donation.donorPhone,
      itemName: donation.itemName,
      notes: donation.notes,
      purity: donation.purity,
      quantity: donation.quantity,
      receiptNumber: donation.receiptNumber,
      storageLocation: donation.storageLocation,
      weight: donation.weight ? Number(donation.weight) : null,
      weightUnit: donation.weightUnit,
    };
  }

  private async audit(
    ctx: AuthContext,
    mandalId: string,
    entityId: string,
    action: string,
    before: unknown,
    after: unknown,
  ) {
    await this.prisma.auditEvent.create({
      data: {
        action,
        actorUserId: ctx.userId,
        after: after ? this.toJson(after) : undefined,
        before: before ? this.toJson(before) : undefined,
        entityId,
        entityType: 'item_donation',
        mandalId,
      },
    });
  }

  private toJson(value: unknown): JsonWriteValue {
    return value as JsonWriteValue;
  }
}

function cleanNullable(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function cleanOptionalNullable(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  return cleanNullable(value);
}

function describeFilters(query: ListItemDonationsQueryDto): string[] {
  return [
    query.category ? `Category: ${formatEnumLabel(query.category)}` : '',
    query.search ? `Search: ${query.search}` : '',
  ].filter(Boolean);
}

function describePeriod(query: ListItemDonationsQueryDto, festivalStart?: Date, festivalEnd?: Date): string {
  const start = query.dateFrom ? new Date(query.dateFrom) : festivalStart;
  const end = query.dateTo ? new Date(query.dateTo) : festivalEnd;
  if (!start && !end) return 'All available dates';
  if (start && end) return `${formatDate(start)} to ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  return `Through ${formatDate(end as Date)}`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(value);
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function reportEndDate(value: string): Date {
  const date = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
  return date;
}
