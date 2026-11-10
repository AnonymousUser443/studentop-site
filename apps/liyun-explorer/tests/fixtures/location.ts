import { campusLandmarks } from '../../src/location/campus';
import { mapPosition, type LocationState } from '../../src/location/geolocation';

export function locationAt(id: string, northMeters = 0, accuracy = 5, receivedAt = performance.now(), deviceTimestamp = 10_000): LocationState {
  const target=campusLandmarks.find(place=>place.id===id)!;
  const position={timestamp:deviceTimestamp,coords:{latitude:target.latitude+northMeters/6378137*180/Math.PI,longitude:target.longitude,accuracy}} as GeolocationPosition;
  return {status:'tracking',running:true,reading:mapPosition(position,receivedAt),message:''};
}
