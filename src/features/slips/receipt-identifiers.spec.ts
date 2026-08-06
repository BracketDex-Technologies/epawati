import {
  editableIndianMobileNumber,
  nationalIndianMobileNumber,
  normalizeIndianPhone,
  printableSlipSequence,
} from './receipt-identifiers';

describe('receipt identifiers', () => {
  it('keeps a million-scale printed sequence unique', () => {
    expect(printableSlipSequence('DM-GAN-2026-000001')).toBe('1');
    expect(printableSlipSequence('DM-GAN-2026-1000001')).toBe('1000001');
    expect(printableSlipSequence('DM-GAN-2026-1000002')).toBe('1000002');
  });

  it('normalizes the same phone consistently for storage and WhatsApp', () => {
    expect(nationalIndianMobileNumber('+91 98765 43210')).toBe('9876543210');
    expect(normalizeIndianPhone('09876543210')).toBe('919876543210');
  });

  it('keeps partial mobile typing editable while cleaning pasted values', () => {
    expect(editableIndianMobileNumber('9')).toBe('9');
    expect(editableIndianMobileNumber('98765')).toBe('98765');
    expect(editableIndianMobileNumber('+91 98765 43210')).toBe('9876543210');
    expect(editableIndianMobileNumber('987654321099')).toBe('9876543210');
  });

  it('does not silently truncate invalid input', () => {
    expect(nationalIndianMobileNumber('987654321099')).toBe('');
  });
});
