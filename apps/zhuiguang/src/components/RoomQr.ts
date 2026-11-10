import { useEffect, useState } from 'react';
import { appUrl, roleUrl } from '../core/url';

export function useAudienceQr(room: string | null) {
  const [generated, setGenerated] = useState<{ room: string; src: string } | null>(null);
  const [failedRoom, setFailedRoom] = useState<string | null>(null);
  const url = new URL(roleUrl('audience', false, room), location.origin).href;
  useEffect(() => {
    if (!room) return;
    let active = true;
    setFailedRoom(null);
    void import('qrcode').then(({ toDataURL }) => toDataURL(url, {
      margin: 4, width: 720, errorCorrectionLevel: 'M',
      color: { dark: '#142f27', light: '#ffffff' },
    })).then(src => {
      if (active) setGenerated({ room, src });
    }).catch(() => { if (active) setFailedRoom(room); });
    return () => { active = false; };
  }, [room, url]);
  return {
    url,
    src: room ? generated?.room === room ? generated.src : null : appUrl('/assets/img/supplement/audience-qr.png'),
    failed: Boolean(room && failedRoom === room),
  };
}
