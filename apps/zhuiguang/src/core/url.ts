import images from '../content/delivery-images.json' with { type: 'json' };

export const appBase = import.meta.env?.BASE_URL || '/';
const deliveryImages: Record<string, string> = images;
export function appUrl(path: string) {
  return appBase + (deliveryImages[path] ?? path).replace(/^\//, '');
}

const params = new URLSearchParams(globalThis.location?.search || '');
export const reducedMotion = params.get('motion') === 'off';
export function validShowId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[0-9]{6}$/.test(value);
}
const requestedShowId = params.get('show');
export const showId = validShowId(requestedShowId) ? requestedShowId : null;

export function roleUrl(role: string, rehearsal = false, room: string | null = showId) {
  const query = new URLSearchParams({ role });
  if (room && !rehearsal) query.set('show', room);
  if (rehearsal) query.set('rehearsal', '1');
  const motion = params.get('motion');
  if (role === 'display' && (motion === 'on' || motion === 'off')) query.set('motion', motion);
  return appBase + '?' + query;
}

export function roomManagerUrl(archive?: string) {
  const query = new URLSearchParams({ role: 'presenter', manage: '1' });
  if (archive) query.set('archive', archive);
  return appBase + '?' + query;
}

export function roomApiPath(room: string, suffix = '') {
  return '/api/rooms/' + encodeURIComponent(room) + suffix;
}
