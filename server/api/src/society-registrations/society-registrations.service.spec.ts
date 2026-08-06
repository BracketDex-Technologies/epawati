import { BadRequestException } from '@nestjs/common';
import { SocietyRegistrationsService } from './society-registrations.service';

describe('SocietyRegistrationsService', () => {
  it('lists submitted society registration data for admin review', async () => {
    const prisma = {
      $transaction: jest.fn().mockResolvedValue([
        [{
          chairmanMobile: '+919876543210',
          createdAt: new Date('2026-08-06T12:00:00.000Z'),
          id: 'registration-1',
          numberOfFlats: 72,
          societyAddress: 'Main Road, Pune',
          societyName: 'Sai Residency',
          templateAvailable: false,
        }],
        1,
      ]),
      societyRegistration: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const service = new SocietyRegistrationsService(prisma as never);

    await expect(service.list({ limit: 100, page: 1, search: 'Sai' })).resolves.toEqual({
      items: [expect.objectContaining({ societyName: 'Sai Residency' })],
      meta: { limit: 100, page: 1, total: 1, totalPages: 1 },
    });
    expect(prisma.societyRegistration.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: 'desc' },
      take: 100,
    }));
  });

  it('stores society registration data in the separate society table', async () => {
    const prisma = {
      societyRegistration: {
        create: jest.fn().mockResolvedValue({
          createdAt: new Date('2026-08-06T12:00:00.000Z'),
          id: 'registration-1',
          societyName: 'Sai Residency',
        }),
      },
    };
    const service = new SocietyRegistrationsService(prisma as never);

    await expect(service.create({
      chairmanMobile: '+919876543210',
      chairmanName: 'Amit Patil',
      email: 'chairman@example.com',
      numberOfFlats: 72,
      secretaryName: 'Neha Shah',
      societyAddress: 'Main Road, Pune',
      societyName: 'Sai Residency',
      templateAvailable: false,
    })).resolves.toEqual(expect.objectContaining({
      id: 'registration-1',
      ok: true,
      societyName: 'Sai Residency',
    }));
    expect(prisma.societyRegistration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chairmanMobile: '+919876543210',
        numberOfFlats: 72,
        societyName: 'Sai Residency',
        templateAvailable: false,
      }),
    });
  });

  it('requires a template upload when template is marked available', async () => {
    const service = new SocietyRegistrationsService({ societyRegistration: { create: jest.fn() } } as never);

    await expect(service.create({
      chairmanMobile: '+919876543210',
      numberOfFlats: 72,
      societyAddress: 'Main Road, Pune',
      societyName: 'Sai Residency',
      templateAvailable: true,
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
