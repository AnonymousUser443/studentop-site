import { regionsForLandmark, cleanRegionIds } from '../content/regions';
import { explore } from '../state';
import type { LocationState } from '../location/geolocation';
import type { ExplorationState } from '../types';

/** Content can unlock a region independently; real check-in validation remains in explore(). */
export function commitDiscovery(before: ExplorationState, id: string, location: LocationState, now = Date.now()): ExplorationState {
  const next = explore(before, id, location, now);
  if (next === before) return before;
  return { ...next, unlockedRegionIds: cleanRegionIds([...next.unlockedRegionIds, ...regionsForLandmark(id).map(region => region.id)]) };
}
