import type { SectorDefinition } from '../types/game';
import type { DetectedBiome } from './waterDetectorService';
import { SECTOR_TYPES } from '../constants/sectors';
import { SECTOR_METERS } from './coordinates';

const EARTH_RADIUS_METERS = 6371000;

// Детермінований 2D-хеш без періодичних повторів на регулярній сітці
const hash2D = (ix: number, iy: number, salt = 0): number => {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(salt, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
};

// Переведення GPS у дискретні індекси сітки 100х100м
const geoToGridCell = (lat: number, lng: number): { gx: number; gy: number } => {
  const dLatStep = (SECTOR_METERS / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const cosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const dLngStep = dLatStep / cosLat;
  return {
    gx: Math.round(lng / dLngStep),
    gy: Math.round(lat / dLatStep)
  };
};

// Гарантує відсутність однакових назв у всіх 8 сусідніх клітинках (по вертикалі, горизонталі та діагоналі)
const pickDistinctNeighborIndex = (gx: number, gy: number, poolLen: number, salt = 1): number => {
  if (poolLen <= 1) return 0;
  if (poolLen >= 4) {
    const bucket = (((gx % 2) + 2) % 2) * 2 + (((gy % 2) + 2) % 2);
    const candidates: number[] = [];
    for (let i = 0; i < poolLen; i++) {
      if (i % 4 === bucket) candidates.push(i);
    }
    if (candidates.length > 0) {
      const idx = Math.floor(hash2D(gx, gy, salt) * candidates.length) % candidates.length;
      return candidates[idx];
    }
  }
  return Math.floor(hash2D(gx, gy, salt) * poolLen) % poolLen;
};

// Аномальні сектори (підготовлені для майбутньої випадкової генерації, поки не спавняться)
export const ANOMALY_SECTORS: SectorDefinition[] = SECTOR_TYPES.filter(
  (s) => s.icon === 'anomaly'
).map((s) => ({
  ...s,
  shortName: 'АНОМАЛІЯ',
  biomeType: 'anomaly',
  isWaterBlocked: false
}));

const FOREST_SECTORS: SectorDefinition[] = SECTOR_TYPES.filter((s) => s.icon === 'forest').map((s) => ({
  ...s,
  shortName: 'ЛІС',
  biomeType: 'nature'
}));

const FIELD_SECTORS: SectorDefinition[] = SECTOR_TYPES.filter((s) => s.icon === 'field').map((s) => ({
  ...s,
  shortName: 'ПОЛЕ',
  biomeType: 'nature'
}));

const ROAD_SECTORS: SectorDefinition[] = SECTOR_TYPES.filter((s) => s.icon === 'highway').map((s) => ({
  ...s,
  shortName: 'ШЛЯХ',
  biomeType: 'city'
}));

const URBAN_SECTORS: SectorDefinition[] = SECTOR_TYPES.filter((s) => ['building', 'factory'].includes(s.icon)).map((s) => ({
  ...s,
  shortName: s.icon === 'factory' ? 'ПРОМЗОНА' : 'СПОРУДА',
  biomeType: s.icon === 'factory' ? 'industrial' : 'city'
}));

const MOUNTAIN_SECTORS: SectorDefinition[] = SECTOR_TYPES.filter((s) => s.icon === 'mountain').map((s) => ({
  ...s,
  shortName: 'ВИСОЧИНА',
  biomeType: 'nature'
}));

const COASTAL_SECTORS: SectorDefinition[] = SECTOR_TYPES.filter((s) =>
  ['waves', 'anchor', 'shallows', 'pier'].includes(s.icon)
).map((s) => ({
  ...s,
  shortName: 'БЕРЕГ',
  biomeType: 'water',
  isWaterBlocked: false
}));

const WATER_SECTORS: SectorDefinition[] = [
  {
    id: 'deep_water',
    name: 'Глибока акваторія',
    shortName: 'АКВАТОРІЯ',
    icon: 'waves',
    radHazard: 0.0,
    desc: 'Глибока водна товща. Рух пішки заблоковано без плавзасобу.',
    biomeType: 'ocean',
    isWaterBlocked: true
  }
];

export const createRandomAnomalySector = (lat: number, lng: number): SectorDefinition => {
  const { gx, gy } = geoToGridCell(lat, lng);
  const idx = pickDistinctNeighborIndex(gx, gy, ANOMALY_SECTORS.length, 99);
  const chosen = ANOMALY_SECTORS[idx] || ANOMALY_SECTORS[0];
  return { ...chosen, isCamp: false, isWaterBlocked: false };
};

export const createSectorData = (
  lat: number,
  lng: number,
  isWater: boolean,
  isCoast: boolean,
  isCamp: boolean,
  biome: DetectedBiome = 'forest',
  options?: { allowAnomalies?: boolean; anomalyChance?: number }
): SectorDefinition => {
  if (isCamp) {
    return {
      id: 'camp',
      name: 'Укріплений базовий табір',
      shortName: 'ТАБІР',
      icon: 'camp',
      radHazard: 0,
      desc: 'Ваш безпечний притулок. Вогнище тліє, периметр заміновано.',
      isCamp: true,
      isWaterBlocked: false
    };
  }

  const normLat = Number(lat.toFixed(5));
  const normLng = Number(lng.toFixed(5));
  const { gx, gy } = geoToGridCell(normLat, normLng);

  // 1. Глибока вода
  if (isWater || biome === 'water') {
    return { ...WATER_SECTORS[0], isCamp: false, isWaterBlocked: true };
  }

  // 2. Берегова смуга / низина біля води
  if (isCoast || biome === 'coast') {
    const idx = pickDistinctNeighborIndex(gx, gy, COASTAL_SECTORS.length, 17);
    return { ...COASTAL_SECTORS[idx], isCamp: false, isWaterBlocked: false };
  }

  // Зарезервований перемикач під майбутню генерацію аномалій (вимкнено за замовчуванням)
  if (options?.allowAnomalies) {
    const chance = options.anomalyChance ?? 0.08;
    if (hash2D(gx, gy, 77) < chance && ANOMALY_SECTORS.length > 0) {
      return createRandomAnomalySector(normLat, normLng);
    }
  }

  // 3. Височини / кар'єри / схили
  if (biome === 'mountain') {
    const idx = pickDistinctNeighborIndex(gx, gy, MOUNTAIN_SECTORS.length, 23);
    return { ...MOUNTAIN_SECTORS[idx], isCamp: false, isWaterBlocked: false };
  }

  // 4. Дороги, колії та путівці
  if (biome === 'road') {
    const idx = pickDistinctNeighborIndex(gx, gy, ROAD_SECTORS.length, 31);
    return { ...ROAD_SECTORS[idx], isCamp: false, isWaterBlocked: false };
  }

  // 5. Лісові масиви
  if (biome === 'forest') {
    const idx = pickDistinctNeighborIndex(gx, gy, FOREST_SECTORS.length, 41);
    return { ...FOREST_SECTORS[idx], isCamp: false, isWaterBlocked: false };
  }

  // 6. Поля та луки
  if (biome === 'field') {
    const idx = pickDistinctNeighborIndex(gx, gy, FIELD_SECTORS.length, 53);
    return { ...FIELD_SECTORS[idx], isCamp: false, isWaterBlocked: false };
  }

  // 7. Забудова / садиби / споруди
  const idx = pickDistinctNeighborIndex(gx, gy, URBAN_SECTORS.length, 61);
  return { ...URBAN_SECTORS[idx], isCamp: false, isWaterBlocked: false };
};

export const getSectorData = (
  x: number,
  y: number,
  campPos: { x: number; y: number },
  realGeo?: { lat: number; lng: number }
) => {
  const lat = realGeo ? realGeo.lat : y / 1000;
  const lng = realGeo ? realGeo.lng : x / 1000;
  return createSectorData(lat, lng, false, false, x === campPos.x && y === campPos.y);
};