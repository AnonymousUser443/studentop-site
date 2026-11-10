/** Damped spring with bounded substeps, stable after a delayed frame. */
export function springStep(value:number,velocity:number,target:number,seconds:number){
 const duration=Math.min(Math.max(seconds,0),.064),count=Math.max(1,Math.ceil(duration/.008)),dt=duration/count;
 for(let i=0;i<count;i++){velocity+=((target-value)*190-velocity*23)*dt;value+=velocity*dt;}
 return {value,velocity};
}
