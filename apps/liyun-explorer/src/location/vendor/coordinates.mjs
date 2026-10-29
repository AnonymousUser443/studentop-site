import { mapToGeo, geoToMap } from './model-transform.mjs';

export function createCampusMap(metadata, artifact) {
  if (metadata.map_id !== artifact.map_id) throw Error('Model and map versions differ.');
  const model = artifact.model;
  const finite = (...values) => { if (!values.every(value => typeof value === 'number' && Number.isFinite(value))) throw Error('Coordinates must be finite numbers.'); };
  const uvToGeo = (u, v) => { finite(u, v); return {...mapToGeo(model,u,v), inside_image:u>=0&&u<=1&&v>=0&&v<=1}; };
  return {
    metadata, model, uvToGeo,
    pixelToGeo(x, y, width=metadata.image.width, height=metadata.image.height) {
      finite(x,y,width,height);if(width<=0||height<=0)throw Error('Image dimensions must be positive.');
      return uvToGeo(x/width,y/height);
    },
    svgToGeo(x,y) {finite(x,y);const [x0,y0,w,h]=metadata.view_box;return uvToGeo((x-x0)/w,(y-y0)/h);},
    gpsToMap(latitude,longitude) {
      finite(latitude,longitude);if(Math.abs(latitude)>85||Math.abs(longitude)>180)throw Error('Expected WGS84 coordinates.');
      const result=geoToMap(model,latitude,longitude),{u,v}=result,[x0,y0,w,h]=metadata.view_box;
      return {...result,pixel_x:u*metadata.image.width,pixel_y:v*metadata.image.height,
        svg_x:x0+u*w,svg_y:y0+v*h,inside_image:u>=0&&u<=1&&v>=0&&v<=1};
    }
  };
}
