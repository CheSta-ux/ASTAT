export type PlayerCondition = 'comfort' | 'radiation' | 'bleeding' | 'zombified' | 'unconscious';

export type Specialization = 'scout' | 'medic' | 'engineer' | 'soldier';

export interface Coordinates {
  x: number;
  y: number;
  lat: number;
  lng: number;
}

export interface AggressorDetail {
  country: string;
  status: string;
  role: string;
}

// ЄДИНЕ ОГОЛОШЕННЯ PlayerStats
export interface PlayerStats {
  name: string;
  callsign: string;
  citizenship: string; // Назва обраної країни
  specialization: Specialization;
  hp: number;
  maxHp: number;
  hunger: number;
  maxHunger: number;
  astatCoins: number;
  searchesLeft: number;
  conditions: PlayerCondition[];
  exploredCount: number;
  aggressorReason?: string; // Причина дебафу "Зомбований"
}

export interface SectorDefinition {
  id: string;
  name: string;
  shortName?: string;
  icon: string;
  radHazard: number;
  desc: string;
  isCamp?: boolean;
  rarityScore?: number;
  biomeType?: 'city' | 'water' | 'ocean' | 'nature' | 'industrial' | 'anomaly';
  isWaterBlocked?: boolean; // Блокує піший перехід
}

export interface VisibleSector {
  x: number;
  y: number;
  data: SectorDefinition;
  isCurrent: boolean;
  distance: number;
}

export interface ExpeditionState {
  targetX: number;
  targetY: number;
  targetCoords?: Coordinates;
  targetSectorData?: SectorDefinition;
  totalDuration: number;
  remaining: number;
  endsAt?: number; // Точний час завершення маршу в мс (Date.now())
  hungerCost: number;
  isMinimized: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'food' | 'medical_bleed' | 'medical_rad' | 'material' | 'rare' | 'junk' | 'quest';
  count: number;
  value: number;
  desc: string;
}

export interface RadioMessage {
  id: number;
  sender: string;
  time: string;
  text: string;
  type: 'local' | 'frequency';
  target: string;
  createdAt?: number; // Мілісекунди створення для розрахунку 1-хвилинного TTL
}

export interface NotificationState {
  id: number;
  msg: string;
  type: 'info' | 'warn' | 'danger' | 'success';
}

export interface SectorStash {
  id: string;
  ownerId: string;
  ownerCallsign: string;
  lat: number;
  lng: number;
  items: InventoryItem[];
  coins: number;
  createdAt?: string;
  isLooted?: boolean;
}

export interface OtherPlayerCamp {
  ownerId: string;
  ownerCallsign: string;
  lat: number;
  lng: number;
}

export type TabType = 'map' | 'inventory' | 'radio' | 'profile' | 'architecture';

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export type WeatherCategory = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export interface WorldEnvironment {
  temperature: number;       // °C
  windSpeed: number;         // км/год
  weatherCode: number;       // WMO weather code
  weatherCategory: WeatherCategory;
  weatherLabel: string;      // Напр. "Ясно", "Туман", "Дощ"
  isDay: boolean;
  dayPhase: DayPhase;
  dayPhaseLabel: string;     // "Світанок", "День", "Сутінки", "Ніч"
  localTimeStr: string;      // Локальний час у секторі, напр. "01:45"
  sunriseStr: string;        // Час сходу сонця
  sunsetStr: string;         // Час заходу сонця
  isFreezing: boolean;       // temperature < 0
  radarRadiusMeters: number; // Динамічний радіус огляду (базово 165 м)
  speedMultiplier: number;   // Множник швидкості маршу
  hungerMultiplier: number;  // Множник витрати ситості
}