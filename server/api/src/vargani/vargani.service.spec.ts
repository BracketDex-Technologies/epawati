import { ConfigService } from '@nestjs/config';
import { PaymentMode, RenderStatus, SlipStatus, UserRole } from '@prisma/client';
import type { AppConfig } from '../config/app-config';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { VarganiService } from './vargani.service';
import { WhatsAppReceiptService } from './whatsapp-receipt.service';

describe('VarganiService deleteSlip', () => {
  it('permanently deletes the tenant slip and records the deletion atomically', async () => {
    const slip = {
      collectedByUserId: '11111111-1111-1111-1111-111111111111',
      contributorName: 'Test contributor',
      id: '33333333-3333-3333-3333-333333333333',
      mandalId: '22222222-2222-2222-2222-222222222222',
      slipNumber: 'DM-TEST-000001',
    };
    const transactionClient = {
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
      varganiSlip: { delete: jest.fn().mockResolvedValue(slip) },
    };
    const prisma = {
      $transaction: jest.fn(async (operation: (client: typeof transactionClient) => Promise<unknown>) => operation(transactionClient)),
      varganiSlip: { findFirst: jest.fn().mockResolvedValue(slip) },
    } as unknown as PrismaService;
    const service = new VarganiService(
      prisma,
      {} as ConfigService<AppConfig, true>,
      {} as WhatsAppReceiptService,
      {} as StorageService,
      {} as JobsService,
    );

    await expect(service.deleteSlip({
      mandalId: slip.mandalId,
      role: UserRole.MANDAL_ADMIN,
      userId: slip.collectedByUserId,
    }, slip.id)).resolves.toEqual({ deleted: true, id: slip.id });

    expect(transactionClient.varganiSlip.delete).toHaveBeenCalledWith({ where: { id: slip.id } });
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'deleted',
        before: slip,
        entityId: slip.id,
        entityType: 'vargani_slip',
        mandalId: slip.mandalId,
      }),
    });
  });
});

describe('VarganiService receipt auto-share', () => {
  it('keeps receipt image upload successful when automatic WhatsApp sharing fails', async () => {
    const slip = {
      amount: 101,
      collectedByUserId: '11111111-1111-1111-1111-111111111111',
      contributorAddress: '',
      contributorName: 'Test contributor',
      contributorPhone: '8605589062',
      createdAt: new Date('2026-08-06T10:00:00.000Z'),
      customData: {},
      festivalId: '44444444-4444-4444-4444-444444444444',
      group: null,
      groupId: null,
      id: '33333333-3333-3333-3333-333333333333',
      mandal: {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Test Mandal',
        nameMr: null,
        whatsappMode: 'AUTOMATED',
        whatsappTemplateVariableCount: 3,
        whatsappTemplateWid: null,
      },
      mandalId: '22222222-2222-2222-2222-222222222222',
      paymentMode: PaymentMode.UPI,
      receiptImageUrl: null,
      renderStatus: RenderStatus.PENDING,
      shopName: '',
      slipNumber: 'DM-TEST-000001',
      status: SlipStatus.ACTIVE,
      templateVersion: null,
      templateVersionId: null,
    };
    const prisma = {
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
      varganiSlip: {
        update: jest.fn().mockResolvedValue({ ...slip, receiptImageUrl: 'receipts/test.jpg' }),
      },
    } as unknown as PrismaService;
    const storage = {
      resolveUrl: jest.fn().mockResolvedValue('https://cdn.example.com/receipts/test.jpg'),
      uploadBuffer: jest.fn().mockResolvedValue({ storage: 'supabase', url: 'receipts/test.jpg' }),
    } as unknown as StorageService;
    const service = new VarganiService(
      prisma,
      {} as ConfigService<AppConfig, true>,
      {} as WhatsAppReceiptService,
      storage,
      {} as JobsService,
    );
    jest.spyOn(service, 'getSlip').mockResolvedValue(slip as Awaited<ReturnType<VarganiService['getSlip']>>);
    jest.spyOn(service, 'recordShare').mockRejectedValue(new Error('provider unavailable'));

    await expect(service.uploadReceiptImageFile({
      mandalId: slip.mandalId,
      role: UserRole.MANDAL_ADMIN,
      userId: slip.collectedByUserId,
    }, slip.id, {
      buffer: Buffer.from('fake-jpeg'),
      mimetype: 'image/jpeg',
      originalname: 'test.jpg',
    }, true)).resolves.toEqual(expect.objectContaining({
      ok: true,
      receiptImageUrl: 'https://cdn.example.com/receipts/test.jpg',
      share: expect.objectContaining({
        whatsapp: expect.objectContaining({
          reason: 'auto_share_failed',
          status: 'failed',
        }),
      }),
    }));
  });
});
