const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function nationalIndianMobileNumber(value?: string | null): string {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 14 && digits.startsWith('0091')) digits = digits.slice(4);
  if (digits.length === 13 && digits.startsWith('091')) digits = digits.slice(3);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return INDIAN_MOBILE.test(digits) ? digits : '';
}

export function normalizeIndianPhone(value?: string | null): string {
  const national = nationalIndianMobileNumber(value);
  return national ? `91${national}` : '';
}

export function normalizeOptionalIndianPhone(value: string): string {
  const national = nationalIndianMobileNumber(value);
  return national ? `+91${national}` : '';
}

export function printableSlipSequence(slipNumber: string): string {
  const sequence = slipNumber.split('-').at(-1) || slipNumber;
  return sequence.replace(/^0+(?=\d)/, '') || sequence;
}
