export interface ApiAuthSession {
  accessToken: string;
  refreshToken?: string;
  user?: unknown;
}

export const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
const SESSION_KEY = 'digital-vargani-admin-session';
const SESSION_EXPIRED_EVENT = 'digital-vargani-session-expired';
const REQUEST_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 180_000;
let refreshInFlight: Promise<boolean> | null = null;

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class ApiTimeoutError extends Error {
  constructor() {
    super('The request took too long. Please check your connection and try again.');
    this.name = 'ApiTimeoutError';
  }
}

export class ApiNetworkError extends Error {
  constructor() {
    super('Could not reach the server. Check your connection and try again.');
    this.name = 'ApiNetworkError';
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
  session?: ApiAuthSession | null,
): Promise<T> {
  const response = await fetchWithAuth(path, options, session);

  if (response.status === 401 && session && path !== '/auth/refresh') {
    // A page can issue several API calls at once. If the access token expires,
    // refresh it once and let every failed request reuse the same result.
    const refreshed = await refreshSessionOnce(session);
    if (refreshed) {
      const retryResponse = await fetchWithAuth(path, options, session);
      if (!retryResponse.ok) {
        throw new ApiError(readErrorMessage(await retryResponse.text(), retryResponse.status), retryResponse.status);
      }

      return readResponse<T>(retryResponse);
    }
  }

  if (!response.ok) {
    throw new ApiError(readErrorMessage(await response.text(), response.status), response.status);
  }

  return readResponse<T>(response);
}

export async function apiDownload(
  path: string,
  session?: ApiAuthSession | null,
): Promise<{ blob: Blob; fileName?: string }> {
  if (session && !session.accessToken) {
    await refreshSessionOnce(session);
  }

  const downloadOptions = {
    headers: { Accept: 'application/octet-stream' },
    timeoutMs: DOWNLOAD_TIMEOUT_MS,
  };
  let response = await fetchWithAuth(path, downloadOptions, session);

  if (response.status === 401 && session) {
    const refreshed = await refreshSessionOnce(session);
    if (refreshed) {
      response = await fetchWithAuth(path, downloadOptions, session);
    }
  }

  if (!response.ok) {
    throw new ApiError(readErrorMessage(await response.text(), response.status), response.status);
  }

  return {
    blob: await response.blob(),
    fileName: readAttachmentFileName(response.headers.get('Content-Disposition')),
  };
}

async function fetchWithAuth(path: string, options: ApiRequestOptions, session?: ApiAuthSession | null) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (!headers.has('x-request-id')) headers.set('x-request-id', createRequestId());
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);

  try {
    const { timeoutMs: _timeoutMs, ...requestOptions } = options;
    return await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      credentials: 'include',
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) {
      throw new ApiTimeoutError();
    }
    if (error instanceof TypeError) {
      throw new ApiNetworkError();
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

function createRequestId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.text();
  if (!body) return undefined as T;
  return JSON.parse(body) as T;
}

function refreshSessionOnce(session: ApiAuthSession) {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession(session).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function refreshSession(session: ApiAuthSession) {
  try {
    const response = await fetchWithAuth('/auth/refresh', {
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      method: 'POST',
    });

    if (!response.ok) {
      expireStoredSession();
      return false;
    }

    const nextSession = await readResponse<ApiAuthSession>(response);
    session.accessToken = nextSession.accessToken;
    session.refreshToken = undefined;
    session.user = nextSession.user;
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionForStorage(nextSession)));
    return true;
  } catch {
    expireStoredSession();
    return false;
  }
}

export function sessionForStorage<T extends ApiAuthSession>(session: T): T {
  return {
    ...session,
    accessToken: '',
    refreshToken: undefined,
  };
}

function expireStoredSession() {
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export function normalizeApiBaseUrl(value?: string) {
  const baseUrl = (value || '/api/v1').replace(/\/$/, '');
  if (baseUrl.startsWith('/')) {
    if (/\/api\/v\d+$/.test(baseUrl)) return baseUrl;
    if (baseUrl.endsWith('/api')) return `${baseUrl}/v1`;
    return `${baseUrl}/api/v1`;
  }
  if (/\/api\/v\d+$/.test(baseUrl)) return baseUrl;
  if (baseUrl.endsWith('/api')) return `${baseUrl}/v1`;
  return `${baseUrl}/api/v1`;
}

function readErrorMessage(body: string, status: number) {
  try {
    const parsed = JSON.parse(body) as { error?: string; message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    return parsed.message || parsed.error || `Request failed with ${status}`;
  } catch {
    return `Request failed with ${status}`;
  }
}

function readAttachmentFileName(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1];
}
