import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateItemDonationDto } from './dto/create-item-donation.dto';
import { ListItemDonationsQueryDto } from './dto/list-item-donations-query.dto';
import { UpdateItemDonationDto } from './dto/update-item-donation.dto';
import { ItemDonationsService } from './item-donations.service';

@ApiTags('item-donations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('mandals/:mandalId/festivals/:festivalId/item-donations')
export class ItemDonationsController {
  constructor(private readonly itemDonationsService: ItemDonationsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANDAL_ADMIN, UserRole.KHAJINDAR)
  createItemDonation(
    @AuthUser() ctx: AuthContext,
    @Param('mandalId') mandalId: string,
    @Param('festivalId') festivalId: string,
    @Body() dto: CreateItemDonationDto,
  ) {
    return this.itemDonationsService.createItemDonation(ctx, mandalId, festivalId, dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANDAL_ADMIN, UserRole.KHAJINDAR)
  listItemDonations(
    @AuthUser() ctx: AuthContext,
    @Param('mandalId') mandalId: string,
    @Param('festivalId') festivalId: string,
    @Query() query: ListItemDonationsQueryDto,
  ) {
    return this.itemDonationsService.listItemDonations(ctx, mandalId, festivalId, query);
  }

  @Get('report.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="item-donation-report.pdf"')
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANDAL_ADMIN, UserRole.KHAJINDAR)
  async exportReportPdf(
    @AuthUser() ctx: AuthContext,
    @Param('mandalId') mandalId: string,
    @Param('festivalId') festivalId: string,
    @Query() query: ListItemDonationsQueryDto,
  ) {
    const file = await this.itemDonationsService.exportReportPdf(ctx, mandalId, festivalId, query);
    return new StreamableFile(file);
  }

  @Get(':donationId/receipt.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="item-donation-receipt.pdf"')
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANDAL_ADMIN, UserRole.KHAJINDAR)
  async exportReceiptPdf(
    @AuthUser() ctx: AuthContext,
    @Param('mandalId') mandalId: string,
    @Param('festivalId') festivalId: string,
    @Param('donationId') donationId: string,
  ) {
    const file = await this.itemDonationsService.exportReceiptPdf(ctx, mandalId, festivalId, donationId);
    return new StreamableFile(file);
  }

  @Patch(':donationId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANDAL_ADMIN, UserRole.KHAJINDAR)
  updateItemDonation(
    @AuthUser() ctx: AuthContext,
    @Param('mandalId') mandalId: string,
    @Param('festivalId') festivalId: string,
    @Param('donationId') donationId: string,
    @Body() dto: UpdateItemDonationDto,
  ) {
    return this.itemDonationsService.updateItemDonation(ctx, mandalId, festivalId, donationId, dto);
  }

  @Delete(':donationId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.MANDAL_ADMIN, UserRole.KHAJINDAR)
  deleteItemDonation(
    @AuthUser() ctx: AuthContext,
    @Param('mandalId') mandalId: string,
    @Param('festivalId') festivalId: string,
    @Param('donationId') donationId: string,
  ) {
    return this.itemDonationsService.deleteItemDonation(ctx, mandalId, festivalId, donationId);
  }
}
