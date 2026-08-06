const SENSITIVE_KEY = /(password|secret|token|authorization|cookie)/i;
const PHONE_KEY = /(phone|mobile|whatsapp)/i;

export function sanitizeAuditPayload(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(sanitizeAuditPayload).filter((item) => item !== undefined);
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (isDecimalLike(value)) return value.toString();

  const entries: Array<[string, unknown]> = [];
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      entries.push([key, '[REDACTED]']);
      continue;
    }
    if (PHONE_KEY.test(key) && typeof item === 'string') {
      entries.push([key, maskPhone(item)]);
      continue;
    }
    const sanitized = sanitizeAuditPayload(item);
    if (sanitized !== undefined) entries.push([key, sanitized]);
  }

  return Object.fromEntries(entries);
}

export function maskPhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `******${digits.slice(-4)}`;
}

function isDecimalLike(value: object): value is { toString: () => string } {
  const candidate = value as { d?: unknown; e?: unknown; s?: unknown; toString?: unknown };
  return Array.isArray(candidate.d) &&
    typeof candidate.e === 'number' &&
    typeof candidate.s === 'number' &&
    typeof candidate.toString === 'function';
}
