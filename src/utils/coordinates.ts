import type { Specialization, PlayerCondition, Coordinates } from '../types/game';

export const SECTOR_METERS = 100;
const EARTH_RADIUS_METERS = 6371000;

// Зсув координат на X (схід/захід) та Y (північ/південь)
export const offsetGeoBySectors = (
  originLat: number,
  originLng: number,
  dxSectors: number,
  dySectors: number
): { lat: number; lng: number } => {
  // dy > 0 — це ПІВНІЧ (збільшення lat)
  const dLat = (dySectors * SECTOR_METERS) / EARTH_RADIUS_METERS;
  
  // dx > 0 — це СХІД (збільшення lng з урахуванням звуження меридіанів до полюсів)
  const latRad = (originLat * Math.PI) / 180;
  const dLng = (dxSectors * SECTOR_METERS) / (EARTH_RADIUS_METERS * Math.cos(latRad));

  return {
    lat: originLat + (dLat * 180) / Math.PI,
    lng: originLng + (dLng * 180) / Math.PI
  };
};

export const calculateHaversineDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
};

export const calculateRealisticTravelTime = (
  origin: Coordinates,
  target: Coordinates,
  conditions: PlayerCondition[],
  spec: Specialization
): { seconds: number; meters: number; hungerCost: number } => {
  const meters = calculateHaversineDistanceMeters(origin.lat, origin.lng, target.lat, target.lng);
  let speedMps = 1.25; // 4.5 км/год

  if (spec === 'scout') speedMps *= 1.25;
  if (conditions.includes('bleeding')) speedMps *= 0.5;

  const seconds = Math.max(1, Math.round(meters / speedMps));
  const hungerCost = Math.max(1, Math.round((meters / SECTOR_METERS) * 1.2));

  return { seconds, meters, hungerCost };
};