import type { SectorDefinition } from '../types/game';
import type { DetectedBiome } from './waterDetectorService';
import { SECTOR_TYPES } from '../constants/sectors';

// Аномальні сектори з каталогу (підготовлені для майбутньої випадкової генерації, поки не спавняться)
export const ANOMALY_SECTORS: SectorDefinition[] = SECTOR_TYPES.filter(
  (s) => s.icon === 'anomaly'
).map((s) => ({
  ...s,
  shortName: 'АНОМАЛІЯ',
  biomeType: 'anomaly',
  isWaterBlocked: false
}));

// 1. ЗАБУДОВА / СПОРУДИ / РУЇНИ / ПРОМЗОНА
const URBAN_SECTORS: SectorDefinition[] = [
  ...SECTOR_TYPES.filter((s) => ['building', 'factory', 'highway'].includes(s.icon)).map((s) => ({
    ...s,
    biomeType: (s.icon === 'factory' ? 'industrial' : 'city') as SectorDefinition['biomeType']
  })),
  { id: 'city_ruins', name: 'Бетонні руїни', shortName: 'РУЇНИ', icon: 'building', radHazard: 0.1, desc: 'Уламки перекриттів, арматура та розбиті стіни.', biomeType: 'city' },
  { id: 'admin_facility', name: 'Покинута споруда', shortName: 'БУДІВЛЯ', icon: 'building', radHazard: 0.1, desc: 'Капітальна будівля, порожні кабінети та службові зали.', biomeType: 'city' },
  { id: 'industrial', name: 'Промзона комплексу', shortName: 'ПРОМЗОНА', icon: 'factory', radHazard: 0.25, desc: 'Заіржавілі ангари, колони та труби комунікацій.', biomeType: 'industrial' },
  { id: 'warehouse', name: 'Складський термінал', shortName: 'АНГАР', icon: 'factory', radHazard: 0.15, desc: 'Закриті логістичні бокси та розвантажувальні майданчики.', biomeType: 'industrial' }
];

// 2. ВІДКРИТІ ПОЛЯ / ЛУКИ / ПУСТИРІ
const FIELD_SECTORS: SectorDefinition[] = [
  ...SECTOR_TYPES.filter((s) => s.icon === 'field').map((s) => ({
    ...s,
    shortName: 'ПОЛЕ',
    biomeType: 'nature' as const
  })),
  { id: 'open_field', name: 'Відкрите поле', shortName: 'ПОЛЕ', icon: 'field', radHazard: 0.05, desc: 'Широкий відкритий простір з сухими травами під вітром.', biomeType: 'nature' },
  { id: 'dry_grass', name: 'Сухі луки', shortName: 'ЛУКИ', icon: 'field', radHazard: 0.05, desc: 'Поросла диким різнотравʼям рівнина без жодних природних укриттів.', biomeType: 'nature' },
  { id: 'wasteland', name: 'Зарослий пустир', shortName: 'ПУСТИР', icon: 'field', radHazard: 0.1, desc: 'Випалена земля, іржавий колючий дріт та будівельне сміття.', biomeType: 'nature' }
];

// 3. ЛІС / ХАЩІ / ПОСАДКИ
const FOREST_SECTORS: SectorDefinition[] = [
  ...SECTOR_TYPES.filter((s) => s.icon === 'forest').map((s) => ({
    ...s,
    shortName: 'ЛІС',
    biomeType: 'nature' as const
  })),
  { id: 'pine_forest', name: 'Хвойний ліс', shortName: 'ЛІС', icon: 'forest', radHazard: 0.1, desc: 'Густі високі сосни, товстий шар хвої та надійне укриття.', biomeType: 'nature' },
  { id: 'windbreak', name: 'Лісопосадка', shortName: 'ПОСАДКА', icon: 'forest', radHazard: 0.05, desc: 'Смуга старих дерев уздовж колишніх польових доріг.', biomeType: 'nature' }
];

// 4. ГОРИ / СКЕЛІ / КАР'ЄРИ
const MOUNTAIN_SECTORS: SectorDefinition[] = [
  ...SECTOR_TYPES.filter((s) => s.icon === 'mountain').map((s) => ({
    ...s,
    shortName: 'СКЕЛІ',
    biomeType: 'nature' as const
  })),
  { id: 'rocky_hills', name: 'Скелястий кряж', shortName: 'СКЕЛІ', icon: 'mountain', radHazard: 0.15, desc: 'Камʼянисті урвища та осипи з гарним оглядом горизонту.', biomeType: 'nature' },
  { id: 'mountain_slope', name: 'Гірський схил', shortName: 'СХИЛ', icon: 'mountain', radHazard: 0.1, desc: 'Крутий підйом серед масивних брил валунів та ущелин.', biomeType: 'nature' },
  { id: 'mountain_pass', name: 'Гірський перевал', shortName: 'ПЕРЕВАЛ', icon: 'mountain', radHazard: 0.15, desc: 'Вітряна камʼяна сідловина між вершинами.', biomeType: 'nature' }
];

// 5. ГЛИБОКА ВОДА
const WATER_SECTORS: SectorDefinition[] = [
  { id: 'deep_water', name: 'Глибока акваторія', shortName: 'АКВАТОРІЯ', icon: 'waves', radHazard: 0.0, desc: 'Глибока водна товща. Рух пішки заблоковано без плавзасобу.', biomeType: 'ocean', isWaterBlocked: true }
];

// 6. БЕРЕГОВА СМУГА / ДРАГОВИНИ / ОЧЕРЕТИ
const COASTAL_SECTORS: SectorDefinition[] = [
  ...SECTOR_TYPES.filter((s) => s.icon === 'waves').map((s) => ({
    ...s,
    shortName: 'БЕРЕГ',
    biomeType: 'water' as const,
    isWaterBlocked: false
  })),
  { id: 'embankment', name: 'Затоплена набережна', shortName: 'НАБЕРЕЖНА', icon: 'anchor', radHazard: 0.1, desc: 'Бетонні плити берегоукріплення та парапети затону.', biomeType: 'water', isWaterBlocked: false },
  { id: 'river_shallows', name: 'Прибережна мілина', shortName: 'МІЛИНА', icon: 'shallows', radHazard: 0.05, desc: 'Мулисте мілководдя з очеретом. Прохідне вбрід.', biomeType: 'water', isWaterBlocked: false },
  { id: 'port_pier', name: 'Покинутий причал', shortName: 'ПРИЧАЛ', icon: 'pier', desc: 'Іржаві швартові понтони та залишки причальної стінки.', radHazard: 0.15, biomeType: 'water', isWaterBlocked: false }
];

// Заготовка для майбутньої випадкової генерації аномалій
export const createRandomAnomalySector = (lat: number, lng: number): SectorDefinition => {
  const normLat = Number(lat.toFixed(5));
  const normLng = Number(lng.toFixed(5));
  const seed = Math.sin(normLat * 191.3 + normLng * 337.9) * 43758.5453;
  const rand = Math.abs(seed - Math.floor(seed));
  const chosen = ANOMALY_SECTORS[Math.floor(rand * ANOMALY_SECTORS.length)] || ANOMALY_SECTORS[0];
  return { ...chosen, isCamp: false, isWaterBlocked: false };
};

export const createSectorData = (
  lat: number,
  lng: number,
  isWater: boolean,
  isCoast: boolean,
  isCamp: boolean,
  biome: DetectedBiome = 'urban',
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

  // Нормалізація координат до 5 знаків для 100% збігу між мапою та пошуком луту
  const normLat = Number(lat.toFixed(5));
  const normLng = Number(lng.toFixed(5));

  // 1. Вода
  if (isWater || biome === 'water') {
    return { ...WATER_SECTORS[0], isCamp: false, isWaterBlocked: true };
  }

  // 2. Берегова смуга
  if (isCoast || biome === 'coast') {
    const seed = Math.sin(normLat * 153.1 + normLng * 277.7) * 43758.5453;
    const rand = Math.abs(seed - Math.floor(seed));
    const chosen = COASTAL_SECTORS[Math.floor(rand * COASTAL_SECTORS.length)];
    return { ...chosen, isCamp: false, isWaterBlocked: false };
  }

  const seed = Math.sin(normLat * 127.1 + normLng * 311.7) * 43758.5453;
  const rand = Math.abs(seed - Math.floor(seed));

  // Зарезервований хук під майбутню випадкову генерацію аномалій (вимкнено за замовчуванням)
  if (options?.allowAnomalies) {
    const chance = options.anomalyChance ?? 0.08;
    const anomalySeed = Math.sin(normLat * 419.7 + normLng * 521.3) * 43758.5453;
    const anomalyRoll = Math.abs(anomalySeed - Math.floor(anomalySeed));
    if (anomalyRoll < chance && ANOMALY_SECTORS.length > 0) {
      return createRandomAnomalySector(normLat, normLng);
    }
  }

  // 3. Гори
  if (biome === 'mountain') {
    const chosen = MOUNTAIN_SECTORS[Math.floor(rand * MOUNTAIN_SECTORS.length)];
    return { ...chosen, isCamp: false, isWaterBlocked: false };
  }

  // 4. Ліс
  if (biome === 'forest') {
    const chosen = FOREST_SECTORS[Math.floor(rand * FOREST_SECTORS.length)];
    return { ...chosen, isCamp: false, isWaterBlocked: false };
  }

  // 5. Поле
  if (biome === 'field') {
    const chosen = FIELD_SECTORS[Math.floor(rand * FIELD_SECTORS.length)];
    return { ...chosen, isCamp: false, isWaterBlocked: false };
  }

  // 6. Забудова / Споруди / Руїни
  const chosen = URBAN_SECTORS[Math.floor(rand * URBAN_SECTORS.length)];
  return { ...chosen, isCamp: false, isWaterBlocked: false };
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