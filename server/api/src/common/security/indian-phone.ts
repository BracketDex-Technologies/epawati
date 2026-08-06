import { BadRequestException } from '@nestjs/common';

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function normalizeIndianMobile(value?: string | null): string | null {
  if (!value?.trim()) return null;

  let digits = value.replace(/\D/g, '');
  if (digits.length === 14 && digits.startsWith('0091')) digits = digits.slice(4);
  if (digits.length === 13 && digits.startsWith('091')) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  if (!INDIAN_MOBILE.test(digits)) {
    throw new BadRequestException('Enter a valid 10-digit Indian mobile number.');
  }

  return `+91${digits}`;
}

export function indianMobileForWhatsApp(value?: string | null): string | null {
  const normalized = normalizeIndianMobile(value);
  return normalized ? normalized.slice(1) : null;
}
