import { appUrl, roomApiPath } from './url';

export interface ShowSession {
  id: string;
  name: string;
  createdAt: number;
  endedAt: number | null;
}

export class ShowApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'ShowApiError';
  }
}

export async function showRequest<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(appUrl(path), {
    method: body ? 'POST' : 'GET',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    credentials: 'same-origin',
    cache: 'no-store',
    signal: signal ?? AbortSignal.timeout(8000),
  });
  const reply = await response.json().catch(() => null);
  if (!response.ok || reply?.ok !== true) {
    throw new ShowApiError(reply?.error || '场次服务暂不可用，请稍后重试。', response.status, reply?.code);
  }
  return reply as T;
}

export function getShow(room: string) {
  return showRequest<{ show: ShowSession }>(roomApiPath(room));
}

export function authorizeHost(pin: string) {
  return showRequest('/api/host', { pin });
}
