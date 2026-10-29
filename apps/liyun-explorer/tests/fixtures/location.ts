import { campusLandmarks } from '../../src/location/campus';
import { mapPosition, type LocationState } from '../../src/location/geolocation';

export function locationAt(id: string, northMeters = 0, accuracy = 5, timestamp = Date.now()): LocationState {
  const target=campusLandmarks.find(place=>place.id===id)!;
  const position={timestamp,coords:{latitude:target.latitude+northMeters/6378137*180/Math.PI,longitude:target.longitude,accuracy}} as GeolocationPosition;
  return {status:'tracking',running:true,reading:mapPosition(position,timestamp),message:''};
}
