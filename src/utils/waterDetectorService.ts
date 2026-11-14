export type DetectedBiome = 'water' | 'coast' | 'mountain' | 'forest' | 'field' | 'road' | 'urban';

export interface SectorTerrainData {
  isWater: boolean;
  isCoast: boolean;
  biome: DetectedBiome;
  elevation: number | null;
}

export type WaterClassification = SectorTerrainData;

const TERRAIN_STORAGE_KEY = 'astat_terrain_cache_v3';
const radarCache = new Map<string, SectorTerrainData>();

try {
  const saved = localStorage.getItem(TERRAIN_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved) as Record<string, SectorTerrainData>;
    for (const [k, v] of Object.entries(parsed)) {
      if (v && v.biome) {
        radarCache.set(k, v);
      }
    }
  }
} catch {
  // ігноруємо помилки сховища
}

const persistRadarCache = () => {
  try {
    const entries = Array.from(radarCache.entries()).slice(-2000);
    localStorage.setItem(TERRAIN_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // ігноруємо квоту сховища
  }
};

export function getCachedSectorTerrain(lat: number, lng: number): SectorTerrainData | undefined {
  const key = `${lat.toFixed(5)}-${lng.toFixed(5)}`;
  return radarCache.get(key);
}

const lon2tileFrac = (lon: number, zoom: number) => ((lon + 180) / 360) * Math.pow(2, zoom);
const lat2tileFrac = (lat: number, zoom: number) => {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom);
};

const loadCorsTileImage = (x: number, y: number, z: number): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => resolve(null), 2500);

    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };

    img.onerror = () => {
      const fallback = new Image();
      fallback.crossOrigin = 'anonymous';
      fallback.onload = () => {
        clearTimeout(timer);
        resolve(fallback);
      };
      fallback.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      fallback.src = `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
    };

    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  });
};

interface PixelVotes {
  waterVotes: number;
  forestVotes: number;
  fieldVotes: number;
  roadVotes: number;
  urbanVotes: number;
  total: number;
}

// Аналіз пікселів мапи з виділенням води, лісу, полів, доріг та забудови
async function sampleTerrainMap(
  sectors: { lat: number; lng: number; key: string }[],
  zoom = 16
): Promise<Record<string, PixelVotes>> {
  const results: Record<string, PixelVotes> = {};
  if (sectors.length === 0) return results;

  const tileXs = sectors.map((s) => Math.floor(lon2tileFrac(s.lng, zoom)));
  const tileYs = sectors.map((s) => Math.floor(lat2tileFrac(s.lat, zoom)));

  const midIdx = Math.floor(sectors.length / 2);
  const centerTileX = Math.floor(lon2tileFrac(sectors[midIdx].lng, zoom));
  const centerTileY = Math.floor(lat2tileFrac(sectors[midIdx].lat, zoom));

  const minTileX = Math.max(centerTileX - 3, Math.min(...tileXs));
  const maxTileX = Math.min(centerTileX + 3, Math.max(...tileXs));
  const minTileY = Math.max(centerTileY - 3, Math.min(...tileYs));
  const maxTileY = Math.min(centerTileY + 3, Math.max(...tileYs));

  const tilesW = maxTileX - minTileX + 1;
  const tilesH = maxTileY - minTileY + 1;

  const canvas = document.createElement('canvas');
  canvas.width = tilesW * 256;
  canvas.height = tilesH * 256;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return results;

  const loadTasks: Promise<{ img: HTMLImageElement | null; dx: number; dy: number }>[] = [];
  for (let dy = 0; dy < tilesH; dy++) {
    for (let dx = 0; dx < tilesW; dx++) {
      const tx = minTileX + dx;
      const ty = minTileY + dy;
      loadTasks.push(loadCorsTileImage(tx, ty, zoom).then((img) => ({ img, dx, dy })));
    }
  }

  const loadedTiles = await Promise.all(loadTasks);
  let validTileCount = 0;
  for (const { img, dx, dy } of loadedTiles) {
    if (img) {
      ctx.drawImage(img, dx * 256, dy * 256, 256, 256);
      validTileCount++;
    }
  }

  if (validTileCount === 0) return results;

  for (const s of sectors) {
    const tileFracX = lon2tileFrac(s.lng, zoom);
    const tileFracY = lat2tileFrac(s.lat, zoom);

    const localX = (tileFracX - minTileX) * 256;
    const localY = (tileFracY - minTileY) * 256;

    if (localX < 0 || localX >= canvas.width || localY < 0 || localY >= canvas.height) {
      continue;
    }

    let waterVotes = 0;
    let forestVotes = 0;
    let fieldVotes = 0;
    let roadVotes = 0;
    let urbanVotes = 0;
    let total = 0;

    const radius = 12;
    const step = 4;

    for (let oy = -radius; oy <= radius; oy += step) {
      for (let ox = -radius; ox <= radius; ox += step) {
        const px = Math.min(canvas.width - 1, Math.max(0, Math.round(localX + ox)));
        const py = Math.min(canvas.height - 1, Math.max(0, Math.round(localY + oy)));

        try {
          const p = ctx.getImageData(px, py, 1, 1).data;
          const r = p[0];
          const g = p[1];
          const b = p[2];
          const a = p[3];

          if (a < 100) continue;

          // 1. Водойми (синій тон)
          if (b >= 180 && (b - r) >= 16 && g >= 155) {
            waterVotes++;
          }
          // 2. Ліс / Хащі / Парки / Посадки
          else if (g > r + 7 && g > b + 10 && g >= 120) {
            forestVotes++;
          }
          // 3. Відкриті поля / луки / рілля
          else if (g >= r - 2 && g > b + 8 && r >= 165 && g >= 175) {
            fieldVotes++;
          }
          // 4. Автошляхи, траси та путівці (білі/жовтогарячі лінії на OSM)
          else if ((r >= 235 && g >= 235 && b >= 235) || (r >= 215 && g >= 160 && (r - b) >= 32)) {
            roadVotes++;
          }
          // 5. Капітальна забудова / споруди / промзони
          else {
            urbanVotes++;
          }
          total++;
        } catch {
          // Захист меж
        }
      }
    }

    results[s.key] = { waterVotes, forestVotes, fieldVotes, roadVotes, urbanVotes, total };
  }

  return results;
}

async function fetchElevations(points: { lat: number; lng: number }[]): Promise<(number | null)[]> {
  try {
    const lats = points.map((p) => p.lat.toFixed(5)).join(',');
    const lngs = points.map((p) => p.lng.toFixed(5)).join(',');

    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`);
    if (!res.ok) return points.map(() => null);

    const data = await res.json();
    return Array.isArray(data.elevation) ? data.elevation : points.map(() => null);
  } catch (err) {
    console.warn('[ASTAT Radar] DEM offline:', err);
    return points.map(() => null);
  }
}

export async function detectGridWater(
  sectors: { lat: number; lng: number; key: string }[]
): Promise<Record<string, SectorTerrainData>> {
  const result: Record<string, SectorTerrainData> = {};
  const needed: { lat: number; lng: number; key: string }[] = [];

  for (const s of sectors) {
    if (radarCache.has(s.key)) {
      result[s.key] = radarCache.get(s.key)!;
    } else {
      needed.push(s);
    }
  }

  if (needed.length === 0) return result;

  const batch = needed.slice(0, 60);

  const [elevations, sampledMap] = await Promise.all([
    fetchElevations(batch),
    sampleTerrainMap(batch)
  ]);

  const validElevs = elevations.filter((e): e is number => typeof e === 'number');
  const elevDiff = validElevs.length > 0 ? Math.max(...validElevs) - Math.min(...validElevs) : 0;

  let cacheUpdated = false;

  batch.forEach((sec, idx) => {
    const elev = elevations[idx];
    const votes = sampledMap[sec.key];
    if (!votes || votes.total === 0) {
      return;
    }

    const total = votes.total;
    const waterRatio = votes.waterVotes / total;

    const isSeaLevelWater = typeof elev === 'number' && elev <= 0.5;
    const isWater = isSeaLevelWater || waterRatio >= 0.65;
    const isCoast = !isWater && (waterRatio >= 0.20 || (typeof elev === 'number' && elev > 0.5 && elev <= 3.5));

    let biome: DetectedBiome = 'forest';

    if (isWater) {
      biome = 'water';
    } else if (isCoast) {
      biome = 'coast';
    } else if (elev !== null && (elev >= 600 || (elevDiff > 70 && elev > 300))) {
      biome = 'mountain';
    } else if (votes.roadVotes >= 4 && votes.urbanVotes < votes.roadVotes * 2) {
      // Дорога або путівець, що проходить крізь ліс, поле чи околицю
      biome = 'road';
    } else if (votes.forestVotes >= votes.fieldVotes && votes.forestVotes >= 3) {
      biome = 'forest';
    } else if (votes.fieldVotes > votes.forestVotes && votes.fieldVotes >= 3) {
      biome = 'field';
    } else if (votes.urbanVotes > votes.forestVotes + votes.fieldVotes) {
      biome = 'urban';
    } else if (votes.roadVotes >= 2) {
      biome = 'road';
    } else {
      biome = 'forest';
    }

    const item: SectorTerrainData = { isWater, isCoast, biome, elevation: elev };
    radarCache.set(sec.key, item);
    result[sec.key] = item;
    cacheUpdated = true;
  });

  if (cacheUpdated) {
    persistRadarCache();
  }

  return result;
}

export async function checkCoordinateIsWater(
  lat: number,
  lng: number
): Promise<{ isWater: boolean; elevation: number | null }> {
  try {
    const single = [{ lat, lng, key: `${lat.toFixed(5)}-${lng.toFixed(5)}` }];
    const res = await detectGridWater(single);
    const classification = res[single[0].key];

    const elevRes = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(5)}&longitude=${lng.toFixed(5)}`
    );
    const data = elevRes.ok ? await elevRes.json() : {};
    const elev = Array.isArray(data.elevation) ? data.elevation[0] : null;

    return {
      isWater: classification ? classification.isWater : false,
      elevation: elev
    };
  } catch {
    return { isWater: false, elevation: null };
  }
}