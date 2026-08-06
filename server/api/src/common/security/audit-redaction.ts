const SENSITIVE_KEY = /(password|secret|token|authorization|cookie)/i;
const PHONE_KEY = /(phone|mobile|whatsapp)/i;

export function sanitizeAuditPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditPayload);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (SENSITIVE_KEY.test(key)) return [key, '[REDACTED]'];
      if (PHONE_KEY.test(key) && typeof item === 'string') return [key, maskPhone(item)];
      return [key, sanitizeAuditPayload(item)];
    }),
  );
}

export function maskPhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `******${digits.slice(-4)}`;
}
