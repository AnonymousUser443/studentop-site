// Same portable model and inverse as fitted_runtime.py. No external SDK or network needed.
const RADIUS = 6378137;
function linear(coefficients, row) {
  return [0, 1].map(axis => row.reduce((sum, value, i) => sum + value * coefficients[i][axis], 0));
}
function supportXY(polygon, point, transition) {
  const crosses = [], distances = [];
  polygon.forEach((a,i) => {
    const b = polygon[(i+1)%polygon.length], edge = [b[0]-a[0],b[1]-a[1]], vector = [point[0]-a[0],point[1]-a[1]];
    crosses.push(edge[0]*vector[1]-edge[1]*vector[0]);
    const t = Math.max(0,Math.min(1,(vector[0]*edge[0]+vector[1]*edge[1])/Math.max(1e-20,edge[0]**2+edge[1]**2)));
    distances.push(Math.hypot(vector[0]-t*edge[0],vector[1]-t*edge[1]));
  });
  const inside = crosses.every(c=>c>=-1e-8)||crosses.every(c=>c<=1e-8);
  const distance = inside ? 0 : Math.min(...distances), t = Math.max(0,Math.min(1,distance/transition));
  const weight = 1-3*t*t+2*t*t*t;
  return {mode:inside?'calibrated':weight>0?'transition':'extrapolated',inside_control_hull:inside,
    distance_outside_m:distance,local_weight:weight,independent_accuracy_verified:false};
}
export function evaluateTransform(transform,u,v) {
  if(transform.kind==='hybrid') {
    const baseline=evaluateTransform(transform.global_model,u,v);
    const weight=supportXY(transform.support_polygon_xy,baseline,transform.transition_distance_m).local_weight;
    if(weight<=0) return baseline;
    const local=evaluateTransform(transform.local_model,u,v);
    return baseline.map((a,i)=>a+weight*(local[i]-a));
  }
  const [x,y]=[u,v].map((value,i)=>(value-transform.input_center[i])/transform.input_scale[i]);
  if(transform.kind==='projective') {
    const p=transform.homography.map(row=>row.reduce((sum,a,i)=>sum+a*[x,y,1][i],0));
    if(Math.abs(p[2])<1e-8) throw new Error('坐标接近模型奇异区域');
    return [p[0]/p[2],p[1]/p[2]];
  }
  if(transform.kind==='tps') {
    const result=linear(transform.polynomial_coefficients,[x,y,1]);
    transform.centers.forEach((center,i)=>{
      const squared=(x-center[0])**2+(y-center[1])**2;
      const kernel=.5*squared*Math.log(Math.max(squared,1e-300));
      result[0]+=kernel*transform.radial_coefficients[i][0];result[1]+=kernel*transform.radial_coefficients[i][1];
    });
    return result;
  }
  return linear(transform.coefficients,transform.kind==='quadratic'?[x,y,1,x*x,x*y,y*y]:[x,y,1]);
}
export function modelSupport(model,u,v) {
  const t=model.transform;
  if(!t || t.kind!=='hybrid') return {mode:'baseline',independent_accuracy_verified:false};
  return supportXY(t.support_polygon_xy,evaluateTransform(t.global_model,u,v),t.transition_distance_m);
}
export function mapToGeo(model,u,v) {
  let origin, east, north;
  if(model.transform) {origin=model.transform.origin;[east,north]=evaluateTransform(model.transform,u,v);}
  else {
    origin=model.origin;
    const vector=[u-model.center_uv[0],v-model.center_uv[1],1];
    [east,north]=model.coefficients.map(row=>row.reduce((sum,a,i)=>sum+a*vector[i],0));
  }
  return {latitude:origin[0]+north/RADIUS*180/Math.PI,
    longitude:origin[1]+east/(RADIUS*Math.cos(origin[0]*Math.PI/180))*180/Math.PI,support:modelSupport(model,u,v)};
}
function affineSeed(model,latitude,longitude) {
  const [a,b]=model.coefficients;
  const east=RADIUS*(longitude-model.origin[1])*Math.PI/180*Math.cos(model.origin[0]*Math.PI/180)-a[2];
  const north=RADIUS*(latitude-model.origin[0])*Math.PI/180-b[2];
  return {u:(east*b[1]-north*a[1])/model.determinant+model.center_uv[0],
    v:(north*a[0]-east*b[0])/model.determinant+model.center_uv[1]};
}
export function geoToMap(model,latitude,longitude) {
  const initial=affineSeed(model,latitude,longitude), transform=model.transform;
  if(!transform) return initial;
  const target=[RADIUS*(longitude-transform.origin[1])*Math.PI/180*Math.cos(transform.origin[0]*Math.PI/180),
    RADIUS*(latitude-transform.origin[0])*Math.PI/180];
  let {u,v}=initial;
  for(let iteration=0;iteration<24;iteration++) {
    const actual=evaluateTransform(transform,u,v), residual=actual.map((a,i)=>a-target[i]), error=Math.hypot(...residual);
    if(error<1e-5) return {u,v,inverse_residual_m:error,support:modelSupport(model,u,v)};
    const h=1e-5, xp=evaluateTransform(transform,u+h,v),xm=evaluateTransform(transform,u-h,v),
      yp=evaluateTransform(transform,u,v+h),ym=evaluateTransform(transform,u,v-h);
    const [a,c]=xp.map((p,i)=>(p-xm[i])/(2*h)),[b,d]=yp.map((p,i)=>(p-ym[i])/(2*h));
    const determinant=a*d-b*c;if(Math.abs(determinant)<1e-6) break;
    let du=(d*residual[0]-b*residual[1])/determinant,dv=(-c*residual[0]+a*residual[1])/determinant;
    const limit=Math.max(1,Math.hypot(du,dv)/.1);du/=limit;dv/=limit;
    let improved=false;
    for(const factor of [1,.5,.25,.125,.0625]) {
      const trial=evaluateTransform(transform,u-factor*du,v-factor*dv);
      if(Math.hypot(trial[0]-target[0],trial[1]-target[1])<error) {u-=factor*du;v-=factor*dv;improved=true;break;}
    }
    if(!improved) break;
  }
  throw new Error('非线性逆映射未收敛');
}
