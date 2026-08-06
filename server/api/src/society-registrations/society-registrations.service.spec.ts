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
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new SocietyRegistrationsService(prisma as never);

    await expect(service.create({
      chairmanMobile: '9876543210',
      chairmanName: 'Amit Patil',
      email: 'chairman@example.com',
      numberOfFlats: 72,
      secretaryMobile: '9876543211',
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
    expect(prisma.societyRegistration.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.any(Array) }),
    }));
  });

  it('requires a template upload when template is marked available', async () => {
    const service = new SocietyRegistrationsService({ societyRegistration: { create: jest.fn(), findFirst: jest.fn() } } as never);

    await expect(service.create({
      chairmanMobile: '9876543210',
      numberOfFlats: 72,
      societyAddress: 'Main Road, Pune',
      societyName: 'Sai Residency',
      templateAvailable: true,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects society mobile numbers that are not exactly 10 digits', async () => {
    const service = new SocietyRegistrationsService({ societyRegistration: { create: jest.fn(), findFirst: jest.fn() } } as never);

    await expect(service.create({
      chairmanMobile: '+919876543210',
      numberOfFlats: 72,
      societyAddress: 'Main Road, Pune',
      societyName: 'Sai Residency',
      templateAvailable: false,
    })).rejects.toThrow('Chairman mobile number must be exactly 10 digits.');

    await expect(service.create({
      chairmanMobile: '9876543210',
      numberOfFlats: 72,
      secretaryMobile: '12345',
      societyAddress: 'Main Road, Pune',
      societyName: 'Sai Residency',
      templateAvailable: false,
    })).rejects.toThrow('Secretary mobile number must be exactly 10 digits.');
  });

  it('rejects duplicate society registrations by building name or mobile number', async () => {
    const prisma = {
      societyRegistration: {
        create: jest.fn(),
        findFirst: jest.fn()
          .mockResolvedValueOnce({ chairmanMobile: '+919876543210', secretaryMobile: null, societyName: 'Sai Residency' })
          .mockResolvedValueOnce({ chairmanMobile: '+919876543210', secretaryMobile: null, societyName: 'Other Residency' }),
      },
    };
    const service = new SocietyRegistrationsService(prisma as never);

    await expect(service.create({
      chairmanMobile: '9876543210',
      numberOfFlats: 72,
      societyAddress: 'Main Road, Pune',
      societyName: 'sai residency',
      templateAvailable: false,
    })).rejects.toThrow('This society/building is already registered.');

    await expect(service.create({
      chairmanMobile: '9876543210',
      numberOfFlats: 72,
      societyAddress: 'Main Road, Pune',
      societyName: 'New Residency',
      templateAvailable: false,
    })).rejects.toThrow('This mobile number is already registered with another society.');
    expect(prisma.societyRegistration.create).not.toHaveBeenCalled();
  });

  it('rejects using the same mobile number for chairman and secretary', async () => {
    const service = new SocietyRegistrationsService({ societyRegistration: { create: jest.fn(), findFirst: jest.fn() } } as never);

    await expect(service.create({
      chairmanMobile: '9876543210',
      numberOfFlats: 72,
      secretaryMobile: '9876543210',
      societyAddress: 'Main Road, Pune',
      societyName: 'Sai Residency',
      templateAvailable: false,
    })).rejects.toThrow('Chairman and secretary mobile numbers must be different.');
  });
});
