import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ScaleContext } from '../ti/lib/scale';

export function Stage({children, className = ''}: {children: ReactNode; className?: string}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const frame = ref.current!;
    const measure = () => {
      const { clientWidth: width, clientHeight: height } = frame;
      setScale(Math.min(width / 1920, height / 1080));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`stage-viewport ${className}`}>
    <div className="stage-frame" style={{transform: `translate(-50%,-50%) scale(${scale})`}}>
      <ScaleContext.Provider value={scale}>{children}</ScaleContext.Provider>
    </div>
  </div>;
}
