import { useCallback, useEffect, useRef, useState } from 'react';
import { CampusLocationSession, initialLocationState } from './geolocation';
import { DeviceHeadingSession, initialHeadingState, type HeadingPlatform } from './deviceHeading';

export function useCampusLocation() {
  const [state, setState] = useState(initialLocationState);
  const session = useRef<CampusLocationSession | null>(null);
  const [heading, setHeading] = useState(initialHeadingState);
  const headingSession = useRef<DeviceHeadingSession | null>(null);
  useEffect(() => {
    const compass = new DeviceHeadingSession(window as unknown as HeadingPlatform, setHeading);
    headingSession.current = compass;
    const current = new CampusLocationSession(navigator.geolocation, next => {
      setState(next);
      if (!next.running && (next.status === 'denied' || next.status === 'error')) compass.stop();
    }, window.isSecureContext);
    session.current = current;
    const pause = () => { if (current.state.running) current.stop(true);compass.stop(true); };
    const visibility = () => { if (document.hidden) pause(); };
    const pagehide = pause;
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    return () => {
      current.dispose(); session.current = null;
      compass.dispose();headingSession.current = null;
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
    };
  }, []);
  const start = useCallback(() => {
    // Must stay in the button's synchronous call stack, ahead of GPS and awaits.
    if (window.isSecureContext && navigator.geolocation) void headingSession.current?.start();
    if (session.current?.state.status !== 'tracking') session.current?.start();
  }, []);
  const stop = useCallback(() => { session.current?.stop();headingSession.current?.stop(); }, []);
  return { state, heading, start, stop };
}
