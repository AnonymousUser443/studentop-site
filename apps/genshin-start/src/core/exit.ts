/** The production destination is deliberately unchanged. Local browsing is fail-closed. */
export const DEFAULT_EXIT_URL = 'https://liyun.studentop.cn:14355/';
export const DEVELOPMENT_EXIT_URL = 'http://127.0.0.1:5174/';
export const EXIT_LABEL = '理韵寻踪';

declare global { interface Window { __EXIT_URL__?: string } }

export function isLoopbackHost(hostname: string): boolean {
  return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname.toLowerCase());
}

/** Reject credentials, non-http protocols, malformed and non-loopback local test targets. */
export function validateExitOverride(value: unknown, localOnly: boolean): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (localOnly && !isLoopbackHost(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

export function exitUrl(): string {
  const localPage = typeof window !== 'undefined' && isLoopbackHost(window.location.hostname);
  const localOnly = import.meta.env.DEV || localPage;
  const fallback = localOnly ? DEVELOPMENT_EXIT_URL : DEFAULT_EXIT_URL;
  return validateExitOverride(typeof window !== 'undefined' ? window.__EXIT_URL__ : undefined, localOnly) || fallback;
}

let leaving = false;
export function goExit(reason = 'door'): void {
  if (leaving) return;
  leaving = true;
  if (import.meta.env.DEV) console.info('[campus exit]', reason, exitUrl());
  window.location.assign(exitUrl());
}
// Back-forward cache must not retain the navigation guard from an earlier departure.
if (typeof window !== 'undefined') window.addEventListener('pageshow', () => { leaving = false; });
