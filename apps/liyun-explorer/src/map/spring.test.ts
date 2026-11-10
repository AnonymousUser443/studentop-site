import {describe,it,expect} from 'vitest';
import {springStep} from './spring';
describe('wheel zoom spring',()=>{
 it('approaches a target gradually and settles without drift',()=>{let x=1,v=0;const first=springStep(x,v,2,1/60);expect(first.value).toBeGreaterThan(1);expect(first.value).toBeLessThan(2);for(let i=0;i<240;i++){const next=springStep(x,v,2,1/60);x=next.value;v=next.velocity;}expect(x).toBeCloseTo(2,5);expect(v).toBeCloseTo(0,5);});
 it('stays finite after a delayed frame and responds to direction changes',()=>{let x=1,v=0;for(const target of [4,.3,2,.5])for(let i=0;i<20;i++){const next=springStep(x,v,target,i===0?8:1/60);x=next.value;v=next.velocity;expect(Number.isFinite(x)).toBe(true);}for(let i=0;i<240;i++){const n=springStep(x,v,.5,1/60);x=n.value;v=n.velocity;}expect(x).toBeCloseTo(.5,5);});
});
