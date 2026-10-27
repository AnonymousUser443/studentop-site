import { describe, expect, it } from 'vitest';
import { cameraLimits, clampCamera, initialCamera, screenToUV, uvToScreen, zoomAt } from './geometry';

describe('full-frame map coordinate contract', () => {
  it('round-trips geographic UV through every target viewport and a panned camera', () => {
    for (const [width, height] of [[1920,1080],[1366,768],[2560,1080],[844,390],[667,375]]) {
      const camera = { ...initialCamera({ width, height }), x: -200, y: -310 };
      for (const uv of [{u:0,v:0},{u:.535,v:.471},{u:1,v:1}]) {
        const p = uvToScreen(uv,camera);
        const restored = screenToUV(p.x,p.y,camera);
        expect(restored.u).toBeCloseTo(uv.u,12);
        expect(restored.v).toBeCloseTo(uv.v,12);
      }
    }
  });
  it('keeps the world point under a wheel/pinch anchor unchanged', () => {
    const camera = { scale:.5,x:-120,y:-300 };
    const before = screenToUV(750,440,camera);
    const after = screenToUV(750,440,zoomAt(camera,1.6,750,440,.2,1.5));
    expect(after.u).toBeCloseTo(before.u,12);
    expect(after.v).toBeCloseTo(before.v,12);
  });
  it('uses the actual clamped ratio at zoom limits', () => {
    const camera = { scale:.5,x:-120,y:-300 };
    const before=screenToUV(500,200,camera);
    const next=zoomAt(camera,10,500,200,.2,.8);
    expect(next.scale).toBe(.8);
    expect(screenToUV(500,200,next)).toEqual(before);
  });
  it('keeps extreme pans within the complete map canvas', () => {
    const view={width:1920,height:1080};
    const limits=cameraLimits(view);
    const result=clampCamera({scale:100,x:1e9,y:-1e9},view);
    expect(result.scale).toBe(limits.max);
    expect(result.x).toBe(0);
    expect(result.y).toBeCloseTo(view.height-4958*limits.max);
  });
  it('shows Wencui as the desktop visual anchor with meaningful map scale', () => {
    const view={width:1920,height:1080};
    const camera=initialCamera(view);
    const p=uvToScreen({u:535/1000.56,v:584/1240.28003},camera);
    expect(p.x).toBeCloseTo(view.width*.61);
    expect(p.y).toBeCloseTo(view.height*.58);
    expect(camera.scale).toBeGreaterThan(.5);
  });
});
