import { describe, expect, it } from 'vitest';
import { pointInPolygon, pointOnSegment, polygonInPolygon, validatePolygon } from './geometry.mjs';
const p=(u:number,v:number)=>({u,v});
const square=[p(.1,.1),p(.9,.1),p(.9,.9),p(.1,.9)];
const concave=[p(0,0),p(1,0),p(1,1),p(.7,1),p(.7,.3),p(.3,.3),p(.3,1),p(0,1)];

describe('general UV geometry',()=>{
  it('contains either winding and includes exact edge and vertex points',()=>{
    for(const polygon of [square,[...square].reverse()]){
      expect(pointInPolygon(p(.4,.4),polygon)).toBe(true);
      expect(pointInPolygon(p(.1,.6),polygon)).toBe(true);
      expect(pointInPolygon(p(.1,.1),polygon)).toBe(true);
      expect(pointInPolygon(p(.09999,.6),polygon)).toBe(false);
    }
  });
  it('handles concavity and excludes its notch without a convex-hull shortcut',()=>{
    expect(validatePolygon(concave)).toEqual([]);
    expect(pointInPolygon(p(.15,.8),concave)).toBe(true);
    expect(pointInPolygon(p(.85,.8),concave)).toBe(true);
    expect(pointInPolygon(p(.5,.15),concave)).toBe(true);
    expect(pointInPolygon(p(.5,.8),concave)).toBe(false);
    expect(pointInPolygon(p(.3,.7),concave)).toBe(true);
  });
  it('rejects a child edge bridging a concave parent even if all vertices are inside',()=>{
    const bridge=[p(.2,.7),p(.8,.7),p(.5,.1)];
    expect(bridge.every(point=>pointInPolygon(point,concave))).toBe(true);
    expect(polygonInPolygon(bridge,concave)).toBe(false);
    expect(polygonInPolygon([p(.05,.05),p(.2,.05),p(.2,.9),p(.05,.9)],concave)).toBe(true);
  });
  it('accepts shared boundary edges and valid intermediate collinear vertices',()=>{
    expect(polygonInPolygon(square,square)).toBe(true);
    expect(validatePolygon([p(.1,.1),p(.5,.1),p(.9,.1),p(.9,.9),p(.1,.9)])).toEqual([]);
  });
  it('rejects bowties, nonadjacent contact and adjacent backtracking',()=>{
    expect(validatePolygon([p(.1,.1),p(.9,.9),p(.1,.9),p(.9,.1)]).some(error=>error.code==='self-intersection')).toBe(true);
    expect(validatePolygon([p(.1,.1),p(.9,.1),p(.5,.1),p(.5,.9),p(.1,.9)]).some(error=>error.code==='overlapping-edge')).toBe(true);
    expect(validatePolygon([p(.1,.1),p(.9,.1),p(.9,.9),p(.1,.1),p(.1,.9)]).some(error=>error.code==='self-intersection')).toBe(true);
  });
  it('rejects invalid UVs, zero edges, implicit-closure duplication and degeneracy',()=>{
    expect(validatePolygon([p(-.1,.1),p(.9,.1),p(.9,.9)])[0].code).toBe('uv-range');
    expect(validatePolygon([p(NaN,.1),p(.9,.1),p(.9,.9)])[0].code).toBe('uv-range');
    expect(validatePolygon([...square,square[0]]).some(error=>error.code==='duplicate-vertex')).toBe(true);
    expect(validatePolygon([p(.1,.1),p(.2,.2),p(.3,.3)]).some(error=>error.code==='zero-area')).toBe(true);
    expect(validatePolygon([p(.1,.1),p(.2,.2)])[0].code).toBe('vertex-count');
    expect(pointInPolygon(p(.5,.5),[])).toBe(false);
    expect(pointOnSegment(p(.5,.5),p(.1,.1),p(.9,.9))).toBe(true);
  });
});
