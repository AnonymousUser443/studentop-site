import { useId } from 'react';
const angles=[0,-2.5,1.8,-1.2,3,-3.4,1.5,-.8,2.2];
export function Seal({text,chapter=1,size=128,opacity=1,className=''}:{text:string;chapter?:number;size?:number;opacity?:number;className?:string}){
 const id=useId().replace(/:/g,'');
 return <svg className={`seal ${className}`} width={size} height={size} viewBox="0 0 240 240" style={{transform:`rotate(${angles[chapter]||0}deg)`,opacity}} aria-label={`${text}印`}><defs><filter id={id}><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="3" seed="8" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6"/></filter><mask id={`${id}m`}><rect width="240" height="240" fill="white"/>{Array.from({length:24},(_,i)=><path key={i} d={`M${(i*73)%230} ${(i*41)%240}l${3+i%8} ${2+i%4}`} stroke="black" strokeWidth="1.5"/>)}</mask></defs><g filter={`url(#${id})`} mask={`url(#${id}m)`} fill="none" stroke="currentColor"><path d="M13 11H228V228H12Z" strokeWidth="8"/><path d="M23 23H216V216H24Z" strokeWidth="2"/></g><text x="120" y="161" fontSize="88" letterSpacing="-5" textAnchor="middle" fill="currentColor" style={{fontFamily:'var(--font-kai)'}}>{text}</text></svg>
}
