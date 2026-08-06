import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { maskPhone, sanitizeAuditPayload } from './audit-redaction';
import { indianMobileForWhatsApp, normalizeIndianMobile } from './indian-phone';

describe('security utilities', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['0091-9876543210', '+919876543210'],
  ])('normalizes %s without changing identity', (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it('rejects malformed or non-mobile numbers', () => {
    expect(() => normalizeIndianMobile('12345')).toThrow(BadRequestException);
    expect(() => normalizeIndianMobile('5123456789')).toThrow(BadRequestException);
  });

  it('returns the WhatsApp E.164 digits without a plus sign', () => {
    expect(indianMobileForWhatsApp('+919876543210')).toBe('919876543210');
  });

  it('redacts secrets and masks phones recursively in audit payloads', () => {
    expect(sanitizeAuditPayload({
      contributorPhone: '+919876543210',
      nested: { refreshToken: 'secret-value' },
      slipNumber: 'DM-GAN-2026-1000001',
    })).toEqual({
      contributorPhone: '******3210',
      nested: { refreshToken: '[REDACTED]' },
      slipNumber: 'DM-GAN-2026-1000001',
    });
    expect(maskPhone('+919876543210')).toBe('******3210');
  });

  it('converts audit snapshots to JSON-safe scalar values', () => {
    expect(sanitizeAuditPayload({
      amount: new Prisma.Decimal('100.00'),
      createdAt: new Date('2026-08-06T10:00:00.000Z'),
      ignored: () => 'not-json',
      sequence: 18n,
    })).toEqual({
      amount: '100',
      createdAt: '2026-08-06T10:00:00.000Z',
      sequence: '18',
    });
  });
});
