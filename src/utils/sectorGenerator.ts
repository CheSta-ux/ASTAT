import type { SectorDefinition } from '../types/game';
import type { DetectedBiome } from './waterDetectorService';

// 1. ЗАБУДОВА / СПОРУДИ / РУЇНИ
const URBAN_SECTORS: SectorDefinition[] = [
  { id: 'city_ruins', name: 'Бетонні руїни', shortName: 'РУЇНИ', icon: 'building', radHazard: 0.1, desc: 'Уламки перекриттів, арматура та розбиті стіни.', biomeType: 'city' },
  { id: 'admin_facility', name: 'Покинута споруда', shortName: 'БУДІВЛЯ', icon: 'building', radHazard: 0.1, desc: 'Капітальна будівля, порожні кабінети та службові зали.', biomeType: 'city' },
  { id: 'industrial', name: 'Промзона комплексу', shortName: 'ПРОМЗОНА', icon: 'factory', radHazard: 0.25, desc: 'Заіржавілі ангари, колони та труби комунікацій.', biomeType: 'industrial' },
  { id: 'highway', name: 'Підʼїзне шосе', shortName: 'ШОСЕ', icon: 'highway', radHazard: 0.05, desc: 'Тріщини в асфальті, смуги покинутого технічного автотранспорту.', biomeType: 'city' },
  { id: 'warehouse', name: 'Складський термінал', shortName: 'АНГАР', icon: 'factory', radHazard: 0.15, desc: 'Закриті логістичні бокси та розвантажувальні майданчики.', biomeType: 'industrial' }
];

// 2. ВІДКРИТІ ПОЛЯ / ЛУКИ / ПУСТИРІ
const FIELD_SECTORS: SectorDefinition[] = [
  { id: 'open_field', name: 'Відкрите поле', shortName: 'ПОЛЕ', icon: 'field', radHazard: 0.05, desc: 'Широкий відкритий простір з сухими травами під вітром.', biomeType: 'nature' },
  { id: 'dry_grass', name: 'Сухі луки', shortName: 'ЛУКИ', icon: 'field', radHazard: 0.05, desc: 'Поросла диким різнотравʼям рівнина без жодних природних укриттів.', biomeType: 'nature' },
  { id: 'wasteland', name: 'Зарослий пустир', shortName: 'ПУСТИР', icon: 'field', radHazard: 0.1, desc: 'Випалена земля, іржавий колючий дріт та будівельне сміття.', biomeType: 'nature' }
];

// 3. ЛІС / ХАЩІ
const FOREST_SECTORS: SectorDefinition[] = [
  { id: 'pine_forest', name: 'Хвойний ліс', shortName: 'ЛІС', icon: 'forest', radHazard: 0.1, desc: 'Густі високі сосни, товстий шар хвої та надійне укриття.', biomeType: 'nature' },
  { id: 'dense_thicket', name: 'Густі хащі', shortName: 'ХАЩІ', icon: 'forest', radHazard: 0.15, desc: 'Непрохідний вітролом, повалені стовбури та густий чагарник.', biomeType: 'nature' },
  { id: 'windbreak', name: 'Лісопосадка', shortName: 'ПОСАДКА', icon: 'forest', radHazard: 0.05, desc: 'Смуга старих дерев уздовж колишніх польових доріг.', biomeType: 'nature' }
];

// 4. ГОРИ / СКЕЛІ (Лише у гірській місцевості)
const MOUNTAIN_SECTORS: SectorDefinition[] = [
  { id: 'rocky_hills', name: 'Скелястий кряж', shortName: 'СКЕЛІ', icon: 'mountain', radHazard: 0.15, desc: 'Камʼянисті урвища та осипи з гарним оглядом горизонту.', biomeType: 'nature' },
  { id: 'mountain_slope', name: 'Гірський схил', shortName: 'СХИЛ', icon: 'mountain', radHazard: 0.1, desc: 'Крутий підйом серед масивних брил валунів та ущелин.', biomeType: 'nature' },
  { id: 'mountain_pass', name: 'Гірський перевал', shortName: 'ПЕРЕВАЛ', icon: 'mountain', radHazard: 0.15, desc: 'Вітряна камʼяна сідловина між вершинами.', biomeType: 'nature' }
];

// 5. ГЛИБОКА ВОДА
const WATER_SECTORS: SectorDefinition[] = [
  { id: 'deep_water', name: 'Глибока акваторія', shortName: 'АКВАТОРІЯ', icon: 'waves', radHazard: 0.0, desc: 'Глибока водна товща. Рух пішки заблоковано без плавзасобу.', biomeType: 'ocean', isWaterBlocked: true }
];

// 6. БЕРЕГОВА СМУГА
const COASTAL_SECTORS: SectorDefinition[] = [
  { id: 'embankment', name: 'Затоплена набережна', shortName: 'НАБЕРЕЖНА', icon: 'anchor', radHazard: 0.1, desc: 'Бетонні плити берегоукріплення та парапети затону.', biomeType: 'water', isWaterBlocked: false },
  { id: 'river_shallows', name: 'Прибережна мілина', shortName: 'МІЛИНА', icon: 'shallows', radHazard: 0.05, desc: 'Мулисте мілководдя з очеретом. Прохідне вбрід.', biomeType: 'water', isWaterBlocked: false },
  { id: 'port_pier', name: 'Покинутий причал', shortName: 'ПРИЧАЛ', icon: 'pier', desc: 'Іржаві швартові понтони та залишки причальної стінки.', radHazard: 0.15, biomeType: 'water', isWaterBlocked: false }
];

export const createSectorData = (
  lat: number,
  lng: number,
  isWater: boolean,
  isCoast: boolean,
  isCamp: boolean,
  biome: DetectedBiome = 'urban'
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

  // 1. Вода
  if (isWater || biome === 'water') {
    return { ...WATER_SECTORS[0], isCamp: false, isWaterBlocked: true };
  }

  // 2. Берегова смуга
  if (isCoast || biome === 'coast') {
    const seed = Math.sin(lat * 153.1 + lng * 277.7) * 43758.5453;
    const rand = Math.abs(seed - Math.floor(seed));
    const chosen = COASTAL_SECTORS[Math.floor(rand * COASTAL_SECTORS.length)];
    return { ...chosen, isCamp: false, isWaterBlocked: false };
  }

  // Детермінований вибір у межах підтвердженого типу
  const seed = Math.sin(lat * 127.1 + lng * 311.7) * 43758.5453;
  const rand = Math.abs(seed - Math.floor(seed));

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