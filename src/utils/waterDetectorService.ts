export type DetectedBiome = 'water' | 'coast' | 'mountain' | 'forest' | 'field' | 'urban';

export interface SectorTerrainData {
  isWater: boolean;
  isCoast: boolean;
  biome: DetectedBiome;
  elevation: number | null;
}

export type WaterClassification = SectorTerrainData;

const radarCache = new Map<string, SectorTerrainData>();

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

// Аналіз підкладки: визначення води, лісу, полів та забудови
async function sampleTerrainMap(
  centerLat: number,
  centerLng: number,
  sectors: { lat: number; lng: number; key: string }[],
  zoom = 16
): Promise<Record<string, { waterVotes: number; forestVotes: number; fieldVotes: number; urbanVotes: number; total: number }>> {
  const results: Record<string, { waterVotes: number; forestVotes: number; fieldVotes: number; urbanVotes: number; total: number }> = {};

  const centerTileX = Math.floor(lon2tileFrac(centerLng, zoom));
  const centerTileY = Math.floor(lat2tileFrac(centerLat, zoom));
  const minTileX = centerTileX - 1;
  const minTileY = centerTileY - 1;

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 768;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return results;

  const loadTasks: Promise<{ img: HTMLImageElement | null; dx: number; dy: number }>[] = [];
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
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

  // Вибірка 25 точок всередині кожного сектора 100х100м
  for (const s of sectors) {
    const tileFracX = lon2tileFrac(s.lng, zoom);
    const tileFracY = lat2tileFrac(s.lat, zoom);

    const localX = (tileFracX - minTileX) * 256;
    const localY = (tileFracY - minTileY) * 256;

    let waterVotes = 0;
    let forestVotes = 0;
    let fieldVotes = 0;
    let urbanVotes = 0;
    let total = 0;

    const radius = 10;
    const step = 5;

    for (let oy = -radius; oy <= radius; oy += step) {
      for (let ox = -radius; ox <= radius; ox += step) {
        const px = Math.min(767, Math.max(0, Math.round(localX + ox)));
        const py = Math.min(767, Math.max(0, Math.round(localY + oy)));

        try {
          const p = ctx.getImageData(px, py, 1, 1).data;
          const r = p[0];
          const g = p[1];
          const b = p[2];
          const a = p[3];

          if (a < 100) continue;

          // 1. Водойми (синій тон OSM)
          if (b >= 190 && (b - r) >= 18 && g >= 165) {
            waterVotes++;
          }
          // 2. Ліс / Хащі (яскраво виражений зелений рослинний покрив)
          else if (g > r + 15 && g > b + 15 && g >= 130) {
            forestVotes++;
          }
          // 3. Відкриті поля / луки / пустирі (світлі пасовища та відкриті ділянки)
          else if (
            (g >= r && g > b + 10 && r > 180 && g > 190) ||
            (r > 215 && g > 215 && b > 175 && r >= b + 15)
          ) {
            fieldVotes++;
          }
          // 4. Забудова / Будівлі / Асфальт / Промзона
          else {
            urbanVotes++;
          }
          total++;
        } catch {
          // Захист меж
        }
      }
    }

    results[s.key] = { waterVotes, forestVotes, fieldVotes, urbanVotes, total };
  }

  return results;
}

// Запит висот рельєфу
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

// Головний тактичний аналізатор біомів
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

  const midIdx = Math.floor(sectors.length / 2);
  const centerLat = sectors[midIdx]?.lat || sectors[0].lat;
  const centerLng = sectors[midIdx]?.lng || sectors[0].lng;

  const [elevations, sampledMap] = await Promise.all([
    fetchElevations(needed),
    sampleTerrainMap(centerLat, centerLng, needed)
  ]);

  // Перепад висот місцевості для виявлення гірського рельєфу
  const validElevs = elevations.filter((e): e is number => typeof e === 'number');
  const elevDiff = validElevs.length > 0 ? Math.max(...validElevs) - Math.min(...validElevs) : 0;

  needed.forEach((sec, idx) => {
    const elev = elevations[idx];
    const votes = sampledMap[sec.key] || { waterVotes: 0, forestVotes: 0, fieldVotes: 0, urbanVotes: 0, total: 0 };
    const total = votes.total || 1;

    const waterRatio = votes.waterVotes / total;

    // Рівень 1: Вода (якщо висота невідома — покладаємося лише на тайли мапи, без хибного блокування суходолу)
    const isSeaLevelWater = typeof elev === 'number' && elev <= 0.5;
    const isWater = isSeaLevelWater || waterRatio >= 0.65;
    const isCoast = !isWater && (waterRatio >= 0.20 || (typeof elev === 'number' && elev > 0.5 && elev <= 3.5));

    let biome: DetectedBiome = 'urban';

    if (isWater) {
      biome = 'water';
    } else if (isCoast) {
      biome = 'coast';
    }
    // Рівень 2: Гори
    else if (elev !== null && (elev >= 600 || (elevDiff > 70 && elev > 300))) {
      biome = 'mountain';
    }
    // Рівень 3: Порівняння лісу, поля та забудови за реальними пікселями
    else if (votes.forestVotes >= votes.fieldVotes && votes.forestVotes >= votes.urbanVotes && votes.forestVotes > 2) {
      biome = 'forest';
    } else if (votes.fieldVotes >= votes.forestVotes && votes.fieldVotes >= votes.urbanVotes && votes.fieldVotes > 2) {
      biome = 'field';
    } else {
      biome = 'urban';
    }

    const item: SectorTerrainData = { isWater, isCoast, biome, elevation: elev };
    radarCache.set(sec.key, item);
    result[sec.key] = item;
  });

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