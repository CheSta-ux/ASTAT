import { useState, useEffect } from 'react';
import type { Coordinates, Specialization, WorldEnvironment } from '../types/game';
import { buildEnvironmentFromRaw, fetchWorldEnvironment } from '../utils/weatherAndTimeService';

export function useWorldEnvironment(coords: Coordinates, specialization: Specialization): WorldEnvironment {
  const [environment, setEnvironment] = useState<WorldEnvironment>(() =>
    buildEnvironmentFromRaw(coords.lat, coords.lng, specialization, null)
  );

  const geoCellLat = Number(coords.lat.toFixed(2));
  const geoCellLng = Number(coords.lng.toFixed(2));

  useEffect(() => {
    let isMounted = true;

    const refreshEnv = () => {
      fetchWorldEnvironment(geoCellLat, geoCellLng, specialization).then((env) => {
        if (isMounted) {
          setEnvironment(env);
        }
      });
    };

    refreshEnv();
    const timer = setInterval(refreshEnv, 60000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [geoCellLat, geoCellLng, specialization]);

  return environment;
}