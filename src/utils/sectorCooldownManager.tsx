const STORAGE_KEY = 'astat_sector_searches_v1';
export const SECTOR_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 години

export interface SectorSearchRecord {
  searchesLeft: number;
  lastSearchedAt: number;
  lat?: number;
  lng?: number;
}

export const getSectorKey = (lat: number, lng: number): string => {
  return `${lat.toFixed(5)}-${lng.toFixed(5)}`;
};

export const loadSectorSearchHistory = (): Record<string, SectorSearchRecord> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

export const saveSectorSearchHistory = (data: Record<string, SectorSearchRecord>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // захист пам'яті
  }
};

// Відстань у метрах між двома координатами
const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const getSectorSearchStatus = (
  lat: number,
  lng: number,
  history: Record<string, SectorSearchRecord>,
  now = Date.now()
): { searchesLeft: number; cooldownRemainingMs: number; isDepleted: boolean } => {
  const directKey = getSectorKey(lat, lng);
  let record = history[directKey];

  // Якщо точний ключ не знайдено через мікропохибку округлення — шукаємо найближчий запис у радіусі 45м
  if (!record) {
    for (const [key, val] of Object.entries(history)) {
      const [kLat, kLng] = key.split('-').map(Number);
      if (!isNaN(kLat) && !isNaN(kLng)) {
        if (getDistanceMeters(lat, lng, kLat, kLng) < 45) {
          record = val;
          break;
        }
      }
    }
  }

  if (!record) {
    return { searchesLeft: 4, cooldownRemainingMs: 0, isDepleted: false };
  }

  const elapsed = now - record.lastSearchedAt;

  // Якщо минуло 24 години — ресурси оновлено
  if (elapsed >= SECTOR_COOLDOWN_MS) {
    return { searchesLeft: 4, cooldownRemainingMs: 0, isDepleted: false };
  }

  const cooldownRemainingMs = SECTOR_COOLDOWN_MS - elapsed;
  const isDepleted = record.searchesLeft <= 0;

  return {
    searchesLeft: record.searchesLeft,
    cooldownRemainingMs,
    isDepleted
  };
};

export const recordSectorSearch = (
  lat: number,
  lng: number,
  history: Record<string, SectorSearchRecord>,
  now = Date.now()
): {
  updatedMap: Record<string, SectorSearchRecord>;
  newStatus: { searchesLeft: number; cooldownRemainingMs: number; isDepleted: boolean };
} => {
  let targetKey = getSectorKey(lat, lng);

  if (!history[targetKey]) {
    for (const key of Object.keys(history)) {
      const [kLat, kLng] = key.split('-').map(Number);
      if (!isNaN(kLat) && !isNaN(kLng) && getDistanceMeters(lat, lng, kLat, kLng) < 45) {
        targetKey = key;
        break;
      }
    }
  }

  const currentStatus = getSectorSearchStatus(lat, lng, history, now);
  const nextSearchesLeft = Math.max(0, currentStatus.searchesLeft - 1);

  const updatedMap: Record<string, SectorSearchRecord> = {
    ...history,
    [targetKey]: {
      searchesLeft: nextSearchesLeft,
      lastSearchedAt: now,
      lat,
      lng
    }
  };

  saveSectorSearchHistory(updatedMap);

  return {
    updatedMap,
    newStatus: {
      searchesLeft: nextSearchesLeft,
      cooldownRemainingMs: SECTOR_COOLDOWN_MS,
      isDepleted: nextSearchesLeft <= 0
    }
  };
};

export const formatCooldownTimer = (ms: number): string => {
  if (ms <= 0) return '0с';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hours > 0) return `${hours}г ${mins}хв`;
  if (mins > 0) return `${mins}хв ${secs}с`;
  return `${secs}с`;
};