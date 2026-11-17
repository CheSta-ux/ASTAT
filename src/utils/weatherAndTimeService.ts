import type { DayPhase, Specialization, WeatherCategory, WorldEnvironment } from '../types/game';

interface CachedWeatherRaw {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  utcOffsetSeconds: number;
  sunriseIso?: string;
  sunsetIso?: string;
  fetchedAt: number;
}

const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000; // Кеш погоди на 15 хвилин
const weatherCache = new Map<string, CachedWeatherRaw>();

const mapWmoToCategory = (code: number): { category: WeatherCategory; label: string } => {
  if (code === 0 || code === 1) return { category: 'clear', label: 'Ясно' };
  if (code === 2 || code === 3) return { category: 'cloudy', label: 'Хмарно' };
  if (code === 45 || code === 48) return { category: 'fog', label: 'Туман' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { category: 'rain', label: code >= 63 || code >= 81 ? 'Злива' : 'Дощ' };
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return { category: 'snow', label: 'Снігопад' };
  }
  if (code >= 95) return { category: 'storm', label: 'Гроза' };
  return { category: 'cloudy', label: 'Мінливо' };
};

// Автономний астрономічний розрахунок часу доби за координатами (резерв, якщо API недоступний)
const computeFallbackSolarState = (lat: number, lng: number, nowMs = Date.now()) => {
  const approxOffsetSec = Math.round(lng / 15) * 3600;
  const localDate = new Date(nowMs + approxOffsetSec * 1000);
  const hours = localDate.getUTCHours();
  const minutes = localDate.getUTCMinutes();
  const hourFloat = hours + minutes / 60;

  const startOfYear = Date.UTC(localDate.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((nowMs - startOfYear) / 86400000);
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));
  const latClamp = Math.max(-60, Math.min(60, lat));
  const cosH = -Math.tan((latClamp * Math.PI) / 180) * Math.tan((decl * Math.PI) / 180);
  const halfDayHours = (Math.acos(Math.max(-0.9, Math.min(0.9, cosH))) * 180) / Math.PI / 15;

  const sunriseHour = Math.max(4, Math.min(9.5, 12 - halfDayHours));
  const sunsetHour = Math.max(15, Math.min(21.5, 12 + halfDayHours));

  const formatH = (h: number) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60) % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  let dayPhase: DayPhase = 'day';
  if (Math.abs(hourFloat - sunriseHour) <= 0.65) {
    dayPhase = 'dawn';
  } else if (Math.abs(hourFloat - sunsetHour) <= 0.65) {
    dayPhase = 'dusk';
  } else if (hourFloat < sunriseHour || hourFloat > sunsetHour) {
    dayPhase = 'night';
  }

  return {
    localTimeStr: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    sunriseStr: formatH(sunriseHour),
    sunsetStr: formatH(sunsetHour),
    dayPhase,
    isDay: dayPhase === 'day' || dayPhase === 'dawn'
  };
};

const computePhaseFromIso = (
  nowMs: number,
  utcOffsetSeconds: number,
  sunriseIso?: string,
  sunsetIso?: string,
  apiIsDay?: boolean
): { dayPhase: DayPhase; isDay: boolean; localTimeStr: string; sunriseStr: string; sunsetStr: string } | null => {
  if (!sunriseIso || !sunsetIso) return null;

  const localNow = new Date(nowMs + utcOffsetSeconds * 1000);
  const localTimeStr = `${String(localNow.getUTCHours()).padStart(2, '0')}:${String(
    localNow.getUTCMinutes()
  ).padStart(2, '0')}`;

  const parseLocalIsoToShiftedMs = (iso: string) => {
    const [datePart, timePart] = iso.split('T');
    if (!datePart || !timePart) return NaN;
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    return Date.UTC(y, m - 1, d, hh, mm, 0);
  };

  const shiftedNowMs = localNow.getTime();
  const sunriseMs = parseLocalIsoToShiftedMs(sunriseIso);
  const sunsetMs = parseLocalIsoToShiftedMs(sunsetIso);

  if (isNaN(sunriseMs) || isNaN(sunsetMs)) return null;

  const sunriseStr = sunriseIso.split('T')[1]?.slice(0, 5) || '06:30';
  const sunsetStr = sunsetIso.split('T')[1]?.slice(0, 5) || '18:30';
  const twilightWindowMs = 40 * 60 * 1000; // 40 хвилин світанку та сутінків

  let dayPhase: DayPhase = apiIsDay ? 'day' : 'night';
  if (Math.abs(shiftedNowMs - sunriseMs) <= twilightWindowMs) {
    dayPhase = 'dawn';
  } else if (Math.abs(shiftedNowMs - sunsetMs) <= twilightWindowMs) {
    dayPhase = 'dusk';
  } else if (shiftedNowMs > sunriseMs && shiftedNowMs < sunsetMs) {
    dayPhase = 'day';
  } else {
    dayPhase = 'night';
  }

  return {
    dayPhase,
    isDay: dayPhase === 'day' || dayPhase === 'dawn',
    localTimeStr,
    sunriseStr,
    sunsetStr
  };
};

const PHASE_LABELS: Record<DayPhase, string> = {
  dawn: 'Світанок',
  day: 'День',
  dusk: 'Сутінки',
  night: 'Ніч'
};

export const buildEnvironmentFromRaw = (
  lat: number,
  lng: number,
  spec: Specialization,
  raw?: CachedWeatherRaw | null,
  nowMs = Date.now()
): WorldEnvironment => {
  const temperature = raw ? Math.round(raw.temperature) : 9;
  const windSpeed = raw ? Math.round(raw.windSpeed) : 8;
  const weatherCode = raw ? raw.weatherCode : 2;
  const { category: weatherCategory, label: weatherLabel } = mapWmoToCategory(weatherCode);

  const solarFromApi = raw
    ? computePhaseFromIso(nowMs, raw.utcOffsetSeconds, raw.sunriseIso, raw.sunsetIso, raw.isDay)
    : null;
  const solar = solarFromApi || computeFallbackSolarState(lat, lng, nowMs);

  const isFreezing = temperature < 0;

  // 1. Динамічний радіус живого огляду радара (базово 165 м)
  let radarRadiusMeters = 165;
  if (solar.dayPhase === 'night') {
    radarRadiusMeters -= spec === 'scout' ? 30 : 50; // вночі 115 м (135 м для Розвідника)
  } else if (solar.dayPhase === 'dusk' || solar.dayPhase === 'dawn') {
    radarRadiusMeters -= 20;
  }

  if (weatherCategory === 'fog') radarRadiusMeters -= 35;
  else if (weatherCategory === 'storm') radarRadiusMeters -= 30;
  else if (weatherCategory === 'snow') radarRadiusMeters -= 25;
  else if (weatherCategory === 'rain') radarRadiusMeters -= 15;

  radarRadiusMeters = Math.max(85, Math.min(180, radarRadiusMeters));

  // 2. Множник швидкості маршу
  let speedMultiplier = 1.0;
  if (weatherCategory === 'rain') speedMultiplier *= 0.85;
  else if (weatherCategory === 'snow') speedMultiplier *= 0.8;
  else if (weatherCategory === 'storm') speedMultiplier *= 0.8;
  else if (weatherCategory === 'fog') speedMultiplier *= 0.92;

  if (solar.dayPhase === 'night' && spec !== 'scout') {
    speedMultiplier *= 0.92;
  }

  // 3. Множник витрати ситості
  let hungerMultiplier = 1.0;
  if (isFreezing) hungerMultiplier += 0.2;
  if (weatherCategory === 'rain' || weatherCategory === 'storm') hungerMultiplier += 0.15;
  if (weatherCategory === 'snow') hungerMultiplier += 0.25;
  if (solar.dayPhase === 'night') hungerMultiplier += 0.15;

  return {
    temperature,
    windSpeed,
    weatherCode,
    weatherCategory,
    weatherLabel,
    isDay: solar.isDay,
    dayPhase: solar.dayPhase,
    dayPhaseLabel: PHASE_LABELS[solar.dayPhase],
    localTimeStr: solar.localTimeStr,
    sunriseStr: solar.sunriseStr,
    sunsetStr: solar.sunsetStr,
    isFreezing,
    radarRadiusMeters,
    speedMultiplier: Number(speedMultiplier.toFixed(2)),
    hungerMultiplier: Number(hungerMultiplier.toFixed(2))
  };
};

export async function fetchWorldEnvironment(
  lat: number,
  lng: number,
  spec: Specialization
): Promise<WorldEnvironment> {
  const cellKey = `${lat.toFixed(2)}-${lng.toFixed(2)}`;
  const cached = weatherCache.get(cellKey);

  if (cached && Date.now() - cached.fetchedAt < WEATHER_CACHE_TTL_MS) {
    return buildEnvironmentFromRaw(lat, lng, spec, cached);
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(
      4
    )}&current=temperature_2m,weather_code,wind_speed_10m,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const raw: CachedWeatherRaw = {
      temperature: data?.current?.temperature_2m ?? 9,
      windSpeed: data?.current?.wind_speed_10m ?? 8,
      weatherCode: data?.current?.weather_code ?? 2,
      isDay: Boolean(data?.current?.is_day ?? 1),
      utcOffsetSeconds: Number(data?.utc_offset_seconds ?? 0),
      sunriseIso: Array.isArray(data?.daily?.sunrise) ? data.daily.sunrise[0] : undefined,
      sunsetIso: Array.isArray(data?.daily?.sunset) ? data.daily.sunset[0] : undefined,
      fetchedAt: Date.now()
    };

    weatherCache.set(cellKey, raw);
    return buildEnvironmentFromRaw(lat, lng, spec, raw);
  } catch (err) {
    console.warn('[ASTAT Meteo] Використовується автономний розрахунок часу доби:', err);
    return buildEnvironmentFromRaw(lat, lng, spec, cached || null);
  }
}