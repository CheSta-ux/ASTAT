import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MapPin, Eye, Bed, Tent, Footprints, AlertCircle, Waves, 
  Building2, Factory, Route, Anchor, 
  Compass, Ship, Zap, Mountain, Crosshair, Wheat, TreePine, 
  Clock, Lock, CheckCircle2, Radio, HelpCircle, LocateFixed,
  Archive, ShieldAlert
} from 'lucide-react';
import type {
  Coordinates,
  ExpeditionState,
  NotificationState,
  OtherPlayerCamp,
  PlayerStats,
  SectorDefinition,
  SectorStash,
  WorldEnvironment
} from '../types/game';
import { calculateHaversineDistanceMeters, offsetGeoBySectors, calculateRealisticTravelTime } from '../utils/coordinates';
import { createSectorData } from '../utils/sectorGenerator';
import type { SectorSearchRecord } from '../utils/sectorCooldownManager';
import { getSectorSearchStatus, formatCooldownTimer } from '../utils/sectorCooldownManager';
import { detectGridWater, getCachedSectorTerrain, SectorTerrainData } from '../utils/waterDetectorService';
import type { ActiveSearchEventState } from './SearchEventModal';
import type { SearchEventChoice } from '../constants/searchEvents';

interface TargetSelection {
  lat: number;
  lng: number;
  data: SectorDefinition;
  dist: number;
  isFog?: boolean;
}

interface MapViewProps {
  coords: Coordinates;
  campCoords: Coordinates;
  player: PlayerStats;
  expedition: ExpeditionState | null;
  selectedTarget: TargetSelection | null;
  setSelectedTarget: (val: TargetSelection | null) => void;
  onStartExpedition: (targetCoords: Coordinates) => void;
  onSearch: () => void;
  onRest: () => void;
  onRelocateCamp: () => void;
  sectorSearches: Record<string, SectorSearchRecord>;
  exploredSectors: string[];
  notifications?: NotificationState[];
  onOpenAfkModal?: () => void;
  activeSearchEvent?: ActiveSearchEventState | null;
  onSelectSearchChoice?: (choice: SearchEventChoice) => void;
  onCloseSearchEvent?: () => void;
  ownStashes?: SectorStash[];
  foreignCamps?: OtherPlayerCamp[];
  currentOwnStash?: SectorStash | null;
  currentForeignCamp?: OtherPlayerCamp | null;
  onClaimOwnStash?: (stash: SectorStash) => void;
  environment?: WorldEnvironment;
}

const SectorTacticalIcon: React.FC<{ icon: string; className?: string }> = ({ icon, className = 'w-5 h-5' }) => {
  switch (icon) {
    case 'camp': return <Tent className={`${className} text-emerald-400`} />;
    case 'building': return <Building2 className={`${className} text-slate-300`} />;
    case 'factory': return <Factory className={`${className} text-amber-400`} />;
    case 'highway': return <Route className={`${className} text-slate-400`} />;
    case 'waves': return <Waves className={`${className} text-cyan-400`} />;
    case 'anchor': return <Anchor className={`${className} text-teal-400`} />;
    case 'shallows': return <Compass className={`${className} text-teal-300`} />;
    case 'pier': return <Ship className={`${className} text-teal-400`} />;
    case 'forest': return <TreePine className={`${className} text-emerald-400`} />;
    case 'field': return <Wheat className={`${className} text-yellow-400`} />;
    case 'anomaly': return <Zap className={`${className} text-rose-400 animate-pulse`} />;
    case 'mountain': return <Mountain className={`${className} text-stone-300`} />;
    default: return <MapPin className={`${className} text-slate-400`} />;
  }
};

const latLngToWorldPixel = (lat: number, lng: number, zoom: number) => {
  const n = 256 * Math.pow(2, zoom);
  const x = ((lng + 180.0) / 360.0) * n;
  const latRad = (lat * Math.PI) / 180.0;
  const y = ((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0) * n;
  return { x, y };
};

const worldPixelToLatLng = (x: number, y: number, zoom: number) => {
  const n = 256 * Math.pow(2, zoom);
  const lng = (x / n) * 360.0 - 180.0;
  const latRad = Math.atan(Math.sinh(Math.PI * (1.0 - (2.0 * y) / n)));
  const lat = (latRad * 180.0) / Math.PI;
  return { lat, lng };
};

const FOG_OVERFLOW = 48;

const formatTravelDuration = (totalSeconds: number): string => {
  if (totalSeconds < 60) return `${totalSeconds} с`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins} хв ${secs} с`;
};

export const MapView: React.FC<MapViewProps> = ({
  coords,
  campCoords,
  player,
  expedition,
  selectedTarget,
  setSelectedTarget,
  onStartExpedition,
  onSearch,
  onRest,
  onRelocateCamp,
  sectorSearches,
  exploredSectors = [],
  onOpenAfkModal,
  ownStashes = [],
  foreignCamps = [],
  currentOwnStash,
  currentForeignCamp,
  onClaimOwnStash,
  environment
}) => {
  const zoom = 16;
  const [radarMap, setRadarMap] = useState<Record<string, SectorTerrainData>>({});
  const terrainCacheRef = useRef<Record<string, SectorTerrainData>>({});
  const [panPx, setPanPx] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panPxRef = useRef(panPx);
  panPxRef.current = panPx;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const prevCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const cancelArrivalAnimRef = useRef<(() => void) | null>(null);
  const [arrivalPulse, setArrivalPulse] = useState(false);

  // Плавне наведення камери та імпульс прибуття до нової відкритої локації
  useEffect(() => {
    const prev = prevCoordsRef.current;
    prevCoordsRef.current = { lat: coords.lat, lng: coords.lng };
    if (!prev) return;

    const movedMeters = calculateHaversineDistanceMeters(prev.lat, prev.lng, coords.lat, coords.lng);
    if (movedMeters < 20) return;

    if (movedMeters > 5000) {
      setPanPx({ x: 0, y: 0 });
      return;
    }

    const prevWorld = latLngToWorldPixel(prev.lat, prev.lng, zoom);
    const nextWorld = latLngToWorldPixel(coords.lat, coords.lng, zoom);
    const curPan = panPxRef.current;

    const startPanX = curPan.x + (nextWorld.x - prevWorld.x);
    const startPanY = curPan.y + (nextWorld.y - prevWorld.y);

    setPanPx({ x: Math.round(startPanX), y: Math.round(startPanY) });
    setArrivalPulse(true);

    const durationMs = 480;
    const startTime = performance.now();
    let rafId = 0;
    let cancelled = false;

    const animateCamera = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - startTime) / durationMs);
      const easeOut = 1 - Math.pow(1 - t, 3);
      setPanPx({
        x: Math.round(startPanX * (1 - easeOut)),
        y: Math.round(startPanY * (1 - easeOut))
      });
      if (t < 1) {
        rafId = requestAnimationFrame(animateCamera);
      }
    };

    rafId = requestAnimationFrame(animateCamera);
    const pulseTimer = setTimeout(() => setArrivalPulse(false), 1400);

    const cancel = () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
    cancelArrivalAnimRef.current = cancel;

    return () => {
      cancel();
      clearTimeout(pulseTimer);
    };
  }, [coords.lat, coords.lng]);

  const [containerSize, setContainerSize] = useState({ width: 700, height: 600 });
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startPanRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth || 700,
          height: containerRef.current.clientHeight || 600
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const playerWorld = useMemo(() => latLngToWorldPixel(coords.lat, coords.lng, zoom), [coords.lat, coords.lng]);
  const campWorld = useMemo(() => latLngToWorldPixel(campCoords.lat, campCoords.lng, zoom), [campCoords.lat, campCoords.lng]);

  const cameraWorld = useMemo(() => ({
    x: playerWorld.x - panPx.x,
    y: playerWorld.y - panPx.y
  }), [playerWorld.x, playerWorld.y, panPx.x, panPx.y]);

  const cameraLatLng = useMemo(() => 
    worldPixelToLatLng(cameraWorld.x, cameraWorld.y, zoom),
    [cameraWorld.x, cameraWorld.y]
  );

  const playerScreen = useMemo(() => ({
    x: playerWorld.x - cameraWorld.x + containerSize.width / 2,
    y: playerWorld.y - cameraWorld.y + containerSize.height / 2
  }), [playerWorld.x, playerWorld.y, cameraWorld.x, cameraWorld.y, containerSize.width, containerSize.height]);

  const campScreen = useMemo(() => ({
    x: campWorld.x - cameraWorld.x + containerSize.width / 2,
    y: campWorld.y - cameraWorld.y + containerSize.height / 2
  }), [campWorld.x, campWorld.y, cameraWorld.x, cameraWorld.y, containerSize.width, containerSize.height]);

  const distanceToCampMeters = useMemo(() => {
    return Math.round(calculateHaversineDistanceMeters(coords.lat, coords.lng, campCoords.lat, campCoords.lng));
  }, [coords.lat, coords.lng, campCoords.lat, campCoords.lng]);

  const isAtCamp = distanceToCampMeters < 50;

  const liveRadarRadius = environment?.radarRadiusMeters ?? 165;

  const effectiveSpeedKmh = useMemo(() => {
    let speed = 4.5;
    if (player.specialization === 'scout') speed *= 1.25;
    if (player.conditions.includes('bleeding')) speed *= 0.5;
    if (environment?.speedMultiplier) speed *= environment.speedMultiplier;
    return speed.toFixed(1);
  }, [player.specialization, player.conditions, environment?.speedMultiplier]);

  const relocateCampCost = player.specialization === 'engineer' ? 50 : 100;

  // Динамічний буфер тайлів OpenTopoMap
  const visibleTiles = useMemo(() => {
    const halfW = containerSize.width / 2;
    const halfH = containerSize.height / 2;

    const minX = cameraWorld.x - halfW - 300;
    const maxX = cameraWorld.x + halfW + 300;
    const minY = cameraWorld.y - halfH - 300;
    const maxY = cameraWorld.y + halfH + 300;

    const minTileX = Math.floor(minX / 256);
    const maxTileX = Math.floor(maxX / 256);
    const minTileY = Math.floor(minY / 256);
    const maxTileY = Math.floor(maxY / 256);

    const tiles = [];
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        tiles.push({
          x: tx,
          y: ty,
          left: tx * 256 - cameraWorld.x + halfW,
          top: ty * 256 - cameraWorld.y + halfH,
          key: `${zoom}-${tx}-${ty}`
        });
      }
    }
    return tiles;
  }, [cameraWorld.x, cameraWorld.y, containerSize.width, containerSize.height]);

  const gridStep = useMemo(() => {
    const stepN = offsetGeoBySectors(campCoords.lat, campCoords.lng, 0, 1);
    const stepE = offsetGeoBySectors(campCoords.lat, campCoords.lng, 1, 0);
    return {
      dLat: stepN.lat - campCoords.lat,
      dLng: stepE.lng - campCoords.lng
    };
  }, [campCoords.lat, campCoords.lng]);

  const cameraGridCenter = useMemo(() => {
    if (!gridStep.dLat || !gridStep.dLng) return { gx: 0, gy: 0 };
    return {
      gx: Math.round((cameraLatLng.lng - campCoords.lng) / gridStep.dLng),
      gy: Math.round((cameraLatLng.lat - campCoords.lat) / gridStep.dLat)
    };
  }, [cameraLatLng.lat, cameraLatLng.lng, campCoords.lat, campCoords.lng, gridStep]);

  const expeditionTargetCoords = useMemo(() => {
    if (!expedition) return null;
    return (expedition as any).targetCoords || {
      lat: (expedition as any).targetY / 1000,
      lng: (expedition as any).targetX / 1000
    };
  }, [expedition]);

  // Глобальна сітка секторів
  const sectorList = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number; key: string }>();

    const radX = 7;
    const radY = 6;
    for (let dy = cameraGridCenter.gy + radY; dy >= cameraGridCenter.gy - radY; dy--) {
      for (let dx = cameraGridCenter.gx - radX; dx <= cameraGridCenter.gx + radX; dx++) {
        const geo = offsetGeoBySectors(campCoords.lat, campCoords.lng, dx, dy);
        const sLat = Number(geo.lat.toFixed(5));
        const sLng = Number(geo.lng.toFixed(5));
        const key = `${sLat.toFixed(5)}-${sLng.toFixed(5)}`;
        map.set(key, { lat: sLat, lng: sLng, key });
      }
    }

    exploredSectors.forEach((key) => {
      if (map.has(key)) return;
      const parts = key.split('-');
      if (parts.length >= 2) {
        const sLat = parseFloat(parts[0]);
        const sLng = parseFloat(parts[1]);
        if (!isNaN(sLat) && !isNaN(sLng)) {
          map.set(key, { lat: sLat, lng: sLng, key });
        }
      }
    });

    if (selectedTarget) {
      const stKey = `${selectedTarget.lat.toFixed(5)}-${selectedTarget.lng.toFixed(5)}`;
      if (!map.has(stKey)) {
        map.set(stKey, { lat: selectedTarget.lat, lng: selectedTarget.lng, key: stKey });
      }
    }

    if (expeditionTargetCoords) {
      const expKey = `${expeditionTargetCoords.lat.toFixed(5)}-${expeditionTargetCoords.lng.toFixed(5)}`;
      if (!map.has(expKey)) {
        map.set(expKey, { lat: expeditionTargetCoords.lat, lng: expeditionTargetCoords.lng, key: expKey });
      }
    }

    const pKey = `${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}`;
    if (!map.has(pKey)) map.set(pKey, { lat: Number(coords.lat.toFixed(5)), lng: Number(coords.lng.toFixed(5)), key: pKey });
    const cKey = `${campCoords.lat.toFixed(5)}-${campCoords.lng.toFixed(5)}`;
    if (!map.has(cKey)) map.set(cKey, { lat: Number(campCoords.lat.toFixed(5)), lng: Number(campCoords.lng.toFixed(5)), key: cKey });

    return Array.from(map.values());
  }, [
    cameraGridCenter.gx, 
    cameraGridCenter.gy, 
    campCoords.lat, 
    campCoords.lng, 
    exploredSectors, 
    coords.lat, 
    coords.lng, 
    selectedTarget?.lat, 
    selectedTarget?.lng, 
    expeditionTargetCoords?.lat, 
    expeditionTargetCoords?.lng
  ]);

  const exploredSet = useMemo(() => new Set(exploredSectors), [exploredSectors]);

  // Фонова класифікація рельєфу для видимих та розвіданих секторів
  useEffect(() => {
    let isMounted = true;
    const missing = sectorList.filter((s) => {
      if (terrainCacheRef.current[s.key] || radarMap[s.key]) return false;
      const cached = getCachedSectorTerrain(s.lat, s.lng);
      if (cached) {
        terrainCacheRef.current[s.key] = cached;
        return false;
      }
      const dist = calculateHaversineDistanceMeters(coords.lat, coords.lng, s.lat, s.lng);
      return dist <= 350 || exploredSet.has(s.key);
    });

    if (missing.length === 0) return;

    const timer = setTimeout(() => {
      detectGridWater(missing).then((results: Record<string, SectorTerrainData>) => {
        if (isMounted && results && Object.keys(results).length > 0) {
          terrainCacheRef.current = { ...terrainCacheRef.current, ...results };
          setRadarMap((prev) => ({ ...prev, ...results }));
        }
      }).catch(() => {});
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [sectorList, radarMap, coords.lat, coords.lng, exploredSet]);

  const visibleSectors = useMemo(() => {
    return sectorList.map((sec) => {
      const distFromPlayer = calculateHaversineDistanceMeters(coords.lat, coords.lng, sec.lat, sec.lng);
      const distFromCamp = calculateHaversineDistanceMeters(sec.lat, sec.lng, campCoords.lat, campCoords.lng);
      const isCampSector = distFromCamp < 45;
      const isCurrentPlayerPos = distFromPlayer < 45;

      const isLiveRadar = distFromPlayer <= liveRadarRadius;
      const isEverExplored = exploredSet.has(sec.key) || isCurrentPlayerPos || isCampSector;
      const isFog = !isLiveRadar && !isEverExplored;

      const rawClass = terrainCacheRef.current[sec.key] || radarMap[sec.key] || getCachedSectorTerrain(sec.lat, sec.lng);
      const isActuallyDeepWater = Boolean(rawClass?.isWater && rawClass?.biome === 'water' && !rawClass?.isCoast);
      const isBlockedWater = isActuallyDeepWater && !isCurrentPlayerPos && !isCampSector && distFromPlayer > 200;
      
      const searchState = getSectorSearchStatus(sec.lat, sec.lng, sectorSearches, currentTime);

      const isExpeditionDestination = Boolean(
        expeditionTargetCoords &&
        calculateHaversineDistanceMeters(sec.lat, sec.lng, expeditionTargetCoords.lat, expeditionTargetCoords.lng) < 45
      );

      const secWorld = latLngToWorldPixel(sec.lat, sec.lng, zoom);
      const screenX = secWorld.x - cameraWorld.x + containerSize.width / 2;
      const screenY = secWorld.y - cameraWorld.y + containerSize.height / 2;

      const sectorData = createSectorData(
        sec.lat, 
        sec.lng, 
        isBlockedWater, 
        false, 
        isCampSector, 
        isBlockedWater ? 'water' : rawClass?.biome
      );

      return {
        ...sec,
        data: sectorData,
        isBlockedWater,
        isScanning: !rawClass,
        searchState,
        isLiveRadar,
        isEverExplored,
        isFog,
        isExpeditionDestination,
        isCurrent: isCurrentPlayerPos,
        isCampSector,
        distanceMeters: Math.round(distFromPlayer),
        screenX,
        screenY
      };
    });
  }, [sectorList, coords, campCoords, exploredSet, radarMap, sectorSearches, currentTime, expeditionTargetCoords, cameraWorld.x, cameraWorld.y, containerSize.width, containerSize.height, liveRadarRadius]);

  // Шар туману Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = containerSize.width + FOG_OVERFLOW * 2;
    const h = containerSize.height + FOG_OVERFLOW * 2;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#030704';
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'destination-out';

    exploredSectors.forEach((key) => {
      const parts = key.split('-');
      if (parts.length >= 2) {
        const sLat = parseFloat(parts[0]);
        const sLng = parseFloat(parts[1]);
        if (!isNaN(sLat) && !isNaN(sLng)) {
          const wPos = latLngToWorldPixel(sLat, sLng, zoom);
          const sx = wPos.x - cameraWorld.x + containerSize.width / 2 + FOG_OVERFLOW;
          const sy = wPos.y - cameraWorld.y + containerSize.height / 2 + FOG_OVERFLOW;

          if (sx > -100 && sx < w + 100 && sy > -100 && sy < h + 100) {
            const grad = ctx.createRadialGradient(sx, sy, 10, sx, sy, 75);
            grad.addColorStop(0, 'rgba(0,0,0,0.7)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, 75, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    });

    const campSx = campScreen.x + FOG_OVERFLOW;
    const campSy = campScreen.y + FOG_OVERFLOW;
    const campGrad = ctx.createRadialGradient(campSx, campSy, 15, campSx, campSy, 100);
    campGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
    campGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = campGrad;
    ctx.beginPath();
    ctx.arc(campSx, campSy, 100, 0, Math.PI * 2);
    ctx.fill();

    const pSx = playerScreen.x + FOG_OVERFLOW;
    const pSy = playerScreen.y + FOG_OVERFLOW;
    const innerRadius = Math.round(liveRadarRadius * 0.28);
    const liveGrad = ctx.createRadialGradient(pSx, pSy, innerRadius, pSx, pSy, liveRadarRadius);
    liveGrad.addColorStop(0, 'rgba(0,0,0,1)');
    liveGrad.addColorStop(0.7, 'rgba(0,0,0,0.95)');
    liveGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = liveGrad;
    ctx.beginPath();
    ctx.arc(pSx, pSy, liveRadarRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
  }, [containerSize.width, containerSize.height, cameraWorld.x, cameraWorld.y, campScreen.x, campScreen.y, playerScreen.x, playerScreen.y, exploredSectors, liveRadarRadius]);

  // Інформація про поточний сектор
  const currentSectorInfo = useMemo(() => {
    const curSec = visibleSectors.find((s) => s.isCurrent);
    if (curSec && !isAtCamp) return curSec.data;
    const currentSectorKey = `${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}`;
    const curClass = terrainCacheRef.current[currentSectorKey] || radarMap[currentSectorKey];
    return createSectorData(
      coords.lat,
      coords.lng,
      false,
      false,
      isAtCamp,
      curClass?.biome
    );
  }, [coords, isAtCamp, visibleSectors, radarMap]);

  const currentSearchStatus = useMemo(() => {
    return getSectorSearchStatus(coords.lat, coords.lng, sectorSearches, currentTime);
  }, [coords.lat, coords.lng, sectorSearches, currentTime]);

  const isSelectedCurrent = useMemo(() => {
    if (!selectedTarget) return false;
    return calculateHaversineDistanceMeters(coords.lat, coords.lng, selectedTarget.lat, selectedTarget.lng) < 45;
  }, [selectedTarget, coords]);

  const selectedTargetSearchStatus = useMemo(() => {
    if (!selectedTarget) return null;
    return getSectorSearchStatus(selectedTarget.lat, selectedTarget.lng, sectorSearches, currentTime);
  }, [selectedTarget, sectorSearches, currentTime]);

  const routeEstimates = useMemo(() => {
    if (!selectedTarget || isSelectedCurrent) return null;
    return calculateRealisticTravelTime(
      coords,
      { x: 0, y: 0, lat: selectedTarget.lat, lng: selectedTarget.lng },
      player.conditions,
      player.specialization,
      environment
    );
  }, [selectedTarget, isSelectedCurrent, coords, player, environment]);

  // Інформація про марш
  const transitProgress = useMemo(() => {
    if (!expedition || !expeditionTargetCoords) return null;

    const totalMeters = calculateHaversineDistanceMeters(coords.lat, coords.lng, expeditionTargetCoords.lat, expeditionTargetCoords.lng);
    const duration = expedition.totalDuration || 1;
    const progressRatio = Math.min(1, Math.max(0, (duration - expedition.remaining) / duration));
    const percent = Math.round(progressRatio * 100);
    const remainingMeters = Math.max(0, Math.round(totalMeters * (1 - progressRatio)));
    const coveredMeters = Math.max(0, totalMeters - remainingMeters);

    const destSectorInMap = visibleSectors.find(
      (s) => calculateHaversineDistanceMeters(s.lat, s.lng, expeditionTargetCoords.lat, expeditionTargetCoords.lng) < 45
    );

    const destData = (expedition as any).targetSectorData ||
                     (destSectorInMap ? destSectorInMap.data : null) ||
                     (selectedTarget && calculateHaversineDistanceMeters(selectedTarget.lat, selectedTarget.lng, expeditionTargetCoords.lat, expeditionTargetCoords.lng) < 45 ? selectedTarget.data : null) ||
                     createSectorData(
                       expeditionTargetCoords.lat,
                       expeditionTargetCoords.lng,
                       false,
                       false,
                       false
                     );

    return {
      destData,
      totalMeters,
      coveredMeters,
      remainingMeters,
      percent,
      remainingSec: expedition.remaining
    };
  }, [expedition, expeditionTargetCoords, coords, visibleSectors, selectedTarget]);

  // Драг карти
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelArrivalAnimRef.current?.();
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startPanRef.current = { ...panPx };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;

    if (!hasMovedRef.current && Math.hypot(deltaX, deltaY) > 5) {
      hasMovedRef.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    if (!hasMovedRef.current) return;

    setPanPx({
      x: startPanRef.current.x + deltaX,
      y: startPanRef.current.y + deltaY
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    if (hasMovedRef.current) {
      setTimeout(() => {
        hasMovedRef.current = false;
      }, 150);
    }
  };

  // Клік на мапу
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hasMovedRef.current || expedition) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickScreenX = e.clientX - rect.left;
    const clickScreenY = e.clientY - rect.top;

    if (Math.hypot(playerScreen.x - clickScreenX, playerScreen.y - clickScreenY) < 32) {
      setSelectedTarget({
        lat: coords.lat,
        lng: coords.lng,
        data: currentSectorInfo,
        dist: 0,
        isFog: false
      });
      return;
    }

    if (Math.hypot(campScreen.x - clickScreenX, campScreen.y - clickScreenY) < 32) {
      setSelectedTarget({
        lat: campCoords.lat,
        lng: campCoords.lng,
        data: createSectorData(campCoords.lat, campCoords.lng, false, false, true),
        dist: distanceToCampMeters,
        isFog: false
      });
      return;
    }

    const nearest = visibleSectors.find(
      (s) => Math.hypot(s.screenX - clickScreenX, s.screenY - clickScreenY) < 48
    );

    if (nearest) {
      setSelectedTarget({
        lat: nearest.lat,
        lng: nearest.lng,
        data: nearest.data,
        dist: nearest.distanceMeters,
        isFog: nearest.isFog
      });
      return;
    }

    const clickWorldX = cameraWorld.x - containerSize.width / 2 + clickScreenX;
    const clickWorldY = cameraWorld.y - containerSize.height / 2 + clickScreenY;
    const clickGeo = worldPixelToLatLng(clickWorldX, clickWorldY, zoom);

    if (!gridStep.dLat || !gridStep.dLng) return;
    const targetGy = Math.round((clickGeo.lat - campCoords.lat) / gridStep.dLat);
    const targetGx = Math.round((clickGeo.lng - campCoords.lng) / gridStep.dLng);

    const snappedGeo = offsetGeoBySectors(campCoords.lat, campCoords.lng, targetGx, targetGy);
    const sLat = Number(snappedGeo.lat.toFixed(5));
    const sLng = Number(snappedGeo.lng.toFixed(5));
    const sKey = `${sLat.toFixed(5)}-${sLng.toFixed(5)}`;

    const dist = Math.round(calculateHaversineDistanceMeters(coords.lat, coords.lng, sLat, sLng));
    const isCamp = calculateHaversineDistanceMeters(sLat, sLng, campCoords.lat, campCoords.lng) < 45;
    const isFog = !exploredSet.has(sKey) && dist > liveRadarRadius && !isCamp;
    const rawClass = terrainCacheRef.current[sKey] || radarMap[sKey];

    setSelectedTarget({
      lat: sLat,
      lng: sLng,
      data: createSectorData(sLat, sLng, false, false, isCamp, rawClass?.biome),
      dist,
      isFog
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    setPanPx((prev) => ({
      x: prev.x - e.deltaX * 0.8,
      y: prev.y - e.deltaY * 0.8
    }));
  };

  const isPanned = Math.hypot(panPx.x, panPx.y) > 20;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
      <div className="lg:col-span-2 bg-[#060a08] border border-[#233327] rounded-lg p-2.5 sm:p-4 flex flex-col justify-between shadow-2xl relative h-[74dvh] min-h-[460px] sm:h-[600px] lg:h-auto lg:min-h-[660px]">
        {/* Верхня панель */}
        <div className="flex items-center justify-between gap-1.5 mb-2 text-xs z-30">
          <div className="flex items-center gap-1.5 text-emerald-300 font-bold bg-[#08100b]/90 px-2 py-1 rounded border border-[#203a27] backdrop-blur-md shadow-md text-[10px] sm:text-xs min-w-0 truncate">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 
            <span className="truncate">
              {coords.lat.toFixed(4)}°, {coords.lng.toFixed(4)}°
            </span>
            {isPanned && (
              <span className="hidden sm:inline text-amber-400 ml-1 text-[9px] font-mono">
                (Огляд: {cameraLatLng.lat.toFixed(4)}°)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isPanned && (
              <button
                type="button"
                onClick={() => setPanPx({ x: 0, y: 0 })}
                className="flex items-center gap-1 bg-[#1a2e20] hover:bg-[#25462f] border border-[#376943] text-emerald-300 px-2 py-1 rounded text-[10px] font-bold transition active:scale-95 shadow-md"
              >
                <LocateFixed className="w-3 h-3 text-emerald-400" />
                <span>Мене</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setPanPx({
                  x: playerWorld.x - campWorld.x,
                  y: playerWorld.y - campWorld.y
                });
              }}
              title="Перейти камерою до Табору"
              className="flex items-center gap-1 text-[#9cb8a4] hover:text-emerald-300 bg-[#08100b]/90 hover:bg-[#122216] px-2 py-1 rounded border border-[#203a27] hover:border-emerald-500/80 backdrop-blur-md shadow-md text-[10px] sm:text-xs transition active:scale-95 cursor-pointer"
            >
              <Tent className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 
              <span className="hidden sm:inline">База: {campCoords.lat.toFixed(4)}°</span>
              <span>({distanceToCampMeters}м)</span>
            </button>
          </div>
        </div>

        {/* Контейнер карти */}
        <div 
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleMapClick}
          onWheel={handleWheel}
          className="relative w-full flex-1 rounded-lg overflow-hidden border border-[#1b2b20] bg-[#030604] shadow-inner select-none touch-none cursor-grab active:cursor-grabbing"
        >
          {/* 1. Шар підкладки OpenTopoMap */}
          <div className="absolute inset-0 pointer-events-none">
            {visibleTiles.map((t) => (
              <img
                key={t.key}
                src={`https://tile.opentopomap.org/${zoom}/${t.x}/${t.y}.png`}
                alt="topo"
                className="absolute w-[256px] h-[256px] object-cover filter invert hue-rotate-180 brightness-85 contrast-125 pointer-events-none"
                style={{
                  left: t.left,
                  top: t.top
                }}
                loading="eager"
                draggable={false}
              />
            ))}
          </div>

          {/* 1.5 Атмосферний шар часу доби та опадів */}
          {environment && (
            <div className="absolute inset-0 pointer-events-none z-[5] overflow-hidden">
              {environment.dayPhase === 'night' && (
                <div className="absolute inset-0 bg-[#030b14]/45 mix-blend-multiply" />
              )}
              {(environment.dayPhase === 'dawn' || environment.dayPhase === 'dusk') && (
                <div className="absolute inset-0 bg-amber-950/20" />
              )}
              {environment.weatherCategory === 'fog' && (
                <div className="absolute inset-0 bg-slate-300/10" />
              )}
              {(environment.weatherCategory === 'rain' || environment.weatherCategory === 'storm') && (
                <div
                  className="absolute inset-0 opacity-35 animate-pulse"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(108deg, transparent 0px, transparent 14px, rgba(125, 211, 252, 0.35) 15px, transparent 16px)'
                  }}
                />
              )}
              {environment.weatherCategory === 'snow' && (
                <div
                  className="absolute inset-0 opacity-40 animate-pulse"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, rgba(240, 249, 255, 0.75) 1px, transparent 1.5px)',
                    backgroundSize: '28px 28px'
                  }}
                />
              )}
            </div>
          )}

          {/* 2. Шар туману війни */}
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              left: -FOG_OVERFLOW,
              top: -FOG_OVERFLOW,
              width: containerSize.width + FOG_OVERFLOW * 2,
              height: containerSize.height + FOG_OVERFLOW * 2
            }}
            className="pointer-events-none z-10 opacity-95"
          />

          {/* 3. Шар тактичних маркерів */}
          <div className="absolute inset-0 pointer-events-none z-20">
            
            {/* А) МАРКЕР ВИЖИВАНЦЯ */}
            <div
              style={{
                position: 'absolute',
                left: playerScreen.x,
                top: playerScreen.y,
                transform: 'translate(-50%, -50%)',
                zIndex: 35
              }}
              className="pointer-events-none flex flex-col items-center justify-center"
            >
              <div className="relative flex items-center justify-center">
                {arrivalPulse && (
                  <div className="absolute w-16 h-16 rounded-full border-2 border-emerald-300 bg-emerald-400/25 animate-ping" />
                )}
                <div className="absolute w-12 h-12 rounded-full border border-emerald-400 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.7)] animate-pulse" />
                <div
                  className={`relative z-10 p-2 rounded-full bg-[#08150d] border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.9)] transition-transform duration-300 ${
                    arrivalPulse ? 'scale-110' : 'scale-100'
                  }`}
                >
                  {isAtCamp ? (
                    <Tent className="w-5 h-5 text-emerald-300" />
                  ) : (
                    <Crosshair className="w-5 h-5 text-emerald-300 animate-spin-slow" />
                  )}
                </div>
              </div>
              <span className="text-[9.5px] font-mono font-bold text-emerald-300 bg-[#06120a]/90 px-1.5 py-0.5 rounded border border-emerald-700/80 mt-1 shadow drop-shadow whitespace-nowrap">
                {isAtCamp ? 'ТАБІР (ВИ ТУТ)' : 'ВИ ТУТ'}
              </span>
            </div>

            {/* Б) МАРКЕР БАЗОВОГО ТАБОРУ */}
            {!isAtCamp && (
              <div
                style={{
                  position: 'absolute',
                  left: campScreen.x,
                  top: campScreen.y,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 30
                }}
                className="pointer-events-none flex flex-col items-center justify-center"
              >
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-12 h-12 rounded-full border border-emerald-400/90 bg-emerald-500/20 shadow-[0_0_20px_rgba(52,211,153,0.7)] animate-pulse" />
                  <div className="relative z-10 p-2 rounded-full bg-[#08150d] border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]">
                    <Tent className="w-5 h-5 text-emerald-300" />
                  </div>
                </div>
                <span className="text-[8px] font-mono font-bold text-emerald-300 bg-[#06120a]/90 px-1.5 py-0.5 rounded border border-emerald-700/80 mt-1 shadow drop-shadow whitespace-nowrap">
                  ТАБІР ({distanceToCampMeters}м)
                </span>
              </div>
            )}

            {/* В1) ВЛАСНІ СХРОНИ НА МІСЦІ ЗАГИБЕЛІ (ВИДИМІ НАВІТЬ КРІЗЬ ТУМАН) */}
            {ownStashes.map((stash) => {
              const sWorld = latLngToWorldPixel(stash.lat, stash.lng, zoom);
              const sx = sWorld.x - cameraWorld.x + containerSize.width / 2;
              const sy = sWorld.y - cameraWorld.y + containerSize.height / 2;
              const dist = Math.round(calculateHaversineDistanceMeters(coords.lat, coords.lng, stash.lat, stash.lng));
              const totalCount = stash.items.reduce((acc, i) => acc + i.count, 0);

              if (sx < -60 || sx > containerSize.width + 60 || sy < -60 || sy > containerSize.height + 60) {
                return null;
              }

              return (
                <div
                  key={stash.id}
                  style={{
                    position: 'absolute',
                    left: sx,
                    top: sy,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 32
                  }}
                  className="pointer-events-none flex flex-col items-center justify-center"
                >
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-11 h-11 rounded-full border-2 border-amber-400 bg-amber-500/20 shadow-[0_0_18px_rgba(245,158,11,0.85)] animate-ping" />
                    <div className="relative z-10 p-2 rounded-full bg-[#1f1207] border-2 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.95)]">
                      <Archive className="w-4 h-4 text-amber-300" />
                    </div>
                  </div>
                  <span className="text-[8.5px] font-mono font-bold text-amber-200 bg-[#1a1007]/95 px-1.5 py-0.5 rounded border border-amber-500/90 mt-1 shadow whitespace-nowrap">
                    СХРОН ({totalCount} шт • {dist}м)
                  </span>
                </div>
              );
            })}

            {/* В2) ТАБОРИ ІНШИХ ВИЖИВАНЦІВ У РАДІУСІ РАДАРА */}
            {foreignCamps.map((fc) => {
              const dist = Math.round(calculateHaversineDistanceMeters(coords.lat, coords.lng, fc.lat, fc.lng));
              if (dist > liveRadarRadius) return null;

              const fWorld = latLngToWorldPixel(fc.lat, fc.lng, zoom);
              const fx = fWorld.x - cameraWorld.x + containerSize.width / 2;
              const fy = fWorld.y - cameraWorld.y + containerSize.height / 2;

              if (fx < -60 || fx > containerSize.width + 60 || fy < -60 || fy > containerSize.height + 60) {
                return null;
              }

              return (
                <div
                  key={`camp-${fc.ownerId}`}
                  style={{
                    position: 'absolute',
                    left: fx,
                    top: fy,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 28
                  }}
                  className="pointer-events-none flex flex-col items-center justify-center"
                >
                  <div className="relative flex items-center justify-center">
                    <div className="p-2 rounded-full bg-[#1a1410]/95 border border-orange-500/80 shadow-[0_0_10px_rgba(249,115,22,0.5)]">
                      <ShieldAlert className="w-4 h-4 text-orange-400" />
                    </div>
                  </div>
                  <span className="text-[8px] font-mono font-bold text-orange-200 bg-[#17100a]/90 px-1.5 py-0.5 rounded border border-orange-700/80 mt-1 shadow whitespace-nowrap">
                    БАЗА: {fc.ownerCallsign}
                  </span>
                </div>
              );
            })}

            {/* Г) СЕКТОРИ СВІТУ */}
            {visibleSectors.map((sector) => {
              if (sector.isCurrent || (sector.isCampSector && !isAtCamp)) return null;

              const isOnScreen = sector.screenX > -50 && sector.screenX < containerSize.width + 50 &&
                                 sector.screenY > -50 && sector.screenY < containerSize.height + 50;
              if (!isOnScreen) return null;

              const isSelected = Boolean(
                selectedTarget &&
                calculateHaversineDistanceMeters(sector.lat, sector.lng, selectedTarget.lat, selectedTarget.lng) < 25
              );

              if (sector.isFog) {
                if (!isSelected && !sector.isExpeditionDestination) return null;
                return (
                  <div
                    key={sector.key}
                    style={{
                      position: 'absolute',
                      left: sector.screenX,
                      top: sector.screenY,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 25
                    }}
                    className="pointer-events-none flex flex-col items-center justify-center"
                  >
                    <div className="relative flex items-center justify-center">
                      <div className={`w-10 h-10 rounded-full border-2 ${
                        sector.isExpeditionDestination
                          ? 'border-amber-400 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-ping'
                          : 'border-yellow-400 bg-yellow-400/15 shadow-[0_0_15px_rgba(250,204,21,0.7)] animate-pulse'
                      } flex items-center justify-center`}>
                        {sector.isExpeditionDestination ? (
                          <Footprints className="w-5 h-5 text-amber-300 animate-bounce" />
                        ) : (
                          <HelpCircle className="w-5 h-5 text-yellow-300" />
                        )}
                      </div>
                    </div>
                    <span className={`text-[9.5px] font-mono font-bold mt-0.5 leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,1)] ${
                      sector.isExpeditionDestination ? 'text-amber-300' : 'text-yellow-300'
                    }`}>
                      {sector.distanceMeters}м
                    </span>
                  </div>
                );
              }

              const isDepleted = sector.searchState.isDepleted;
              const searchesLeft = sector.searchState.searchesLeft;
              const isPartiallySearched = searchesLeft < 4 && !isDepleted;
              const isTargetOfMarch = sector.isExpeditionDestination;
              const isDimmedMemory = !sector.isLiveRadar && sector.isEverExplored;

              return (
                <div
                  key={sector.key}
                  style={{
                    position: 'absolute',
                    left: sector.screenX,
                    top: sector.screenY,
                    transform: 'translate(-50%, -50%)'
                  }}
                  className={`pointer-events-none flex flex-col items-center justify-center ${
                    isDimmedMemory ? 'opacity-65 filter saturate-60' : ''
                  }`}
                >
                  <div className="relative flex items-center justify-center">
                    {isSelected && (
                      <div className="absolute w-10 h-10 rounded-full border-2 border-yellow-400 bg-yellow-400/15 shadow-[0_0_15px_rgba(250,204,21,0.7)] animate-pulse" />
                    )}

                    {isTargetOfMarch && (
                      <div className="absolute w-10 h-10 rounded-full border border-amber-400 bg-amber-500/20 animate-ping" />
                    )}

                    <div className="relative z-10 flex items-center justify-center p-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                      {isTargetOfMarch ? (
                        <Footprints className="w-5 h-5 text-amber-300 animate-bounce" />
                      ) : sector.isScanning ? (
                        <Radio className="w-4 h-4 text-emerald-500/50 animate-pulse" />
                      ) : (
                        <SectorTacticalIcon icon={sector.data.icon} className="w-5 h-5" />
                      )}
                    </div>

                    {isDepleted && (
                      <span className="absolute -top-1 -right-1 text-rose-400 bg-black/90 rounded-full p-0.5 shadow">
                        <Lock className="w-2.5 h-2.5" />
                      </span>
                    )}
                    {isPartiallySearched && (
                      <span className="absolute -top-1.5 -left-1 text-[7px] text-amber-300 font-mono font-bold px-1 rounded-full bg-black/90 border border-amber-600/80">
                        {searchesLeft}
                      </span>
                    )}
                    {sector.isBlockedWater && <span className="absolute -bottom-1 -left-1 text-[8px]">🌊</span>}
                  </div>

                  <span className={`text-[8px] font-mono font-bold mt-0.5 leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,1)] ${
                    isTargetOfMarch
                      ? 'text-amber-300'
                      : isSelected
                      ? 'text-yellow-300 font-bold'
                      : isDepleted
                      ? 'text-rose-400'
                      : 'text-emerald-400/80'
                  }`}>
                    {sector.distanceMeters}м
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Мобільний віджет швидкої дії */}
        <div className="lg:hidden mt-2 z-30">
          {!expedition && selectedTarget && !isSelectedCurrent && routeEstimates && (
            <div className="p-2.5 bg-[#121c15] border border-amber-500/80 rounded-lg shadow-2xl flex items-center justify-between gap-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-amber-400 font-bold text-xs truncate">
                    {selectedTarget.isFog ? 'Розвідка невідомого сектора' : selectedTarget.data.name}
                  </span>
                  <span className="text-[10px] text-[#8ea894] font-mono shrink-0">({routeEstimates.meters}м)</span>
                </div>
                <div className="text-[10px] text-[#718d78] font-mono mt-0.5">
                  Час: <b className="text-emerald-300">{formatTravelDuration(routeEstimates.seconds)}</b> • Ситість:{' '}
                  <b className="text-amber-400">-{routeEstimates.hungerCost}%</b>
                </div>
              </div>

              {selectedTarget.data.isWaterBlocked ? (
                <span className="text-[10px] text-cyan-400 font-bold px-2 py-1 bg-cyan-950 border border-cyan-700 rounded">
                  Вода 🌊
                </span>
              ) : selectedTargetSearchStatus?.isDepleted ? (
                <span className="text-[10px] text-rose-400 font-bold px-2 py-1 bg-rose-950 border border-rose-800 rounded">
                  Зачищено 🔒
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onStartExpedition({
                      x: selectedTarget.lat,
                      y: selectedTarget.lng,
                      lat: selectedTarget.lat,
                      lng: selectedTarget.lng,
                      targetSectorData: selectedTarget.data
                    } as any)
                  }
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-md shadow-lg flex items-center gap-1.5 shrink-0 active:scale-95 transition"
                >
                  <Footprints className="w-3.5 h-3.5 shrink-0" />
                  <span>{selectedTarget.isFog ? 'Розвідка' : 'Марш'}</span>
                </button>
              )}
            </div>
          )}

          {!expedition && (!selectedTarget || isSelectedCurrent) && (
            <div className="space-y-2">
              {currentOwnStash && onClaimOwnStash && (
                <button
                  type="button"
                  onClick={() => onClaimOwnStash(currentOwnStash)}
                  className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-lg active:scale-95 transition animate-pulse"
                >
                  <Archive className="w-4 h-4 shrink-0" />
                  <span>
                    Забрати свій схрон ({currentOwnStash.items.reduce((s, i) => s + i.count, 0)} речей
                    {currentOwnStash.coins > 0 ? ` + ${currentOwnStash.coins} плат` : ''})
                  </span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onSearch}
                  disabled={isAtCamp || Boolean(currentForeignCamp) || currentSearchStatus.isDepleted}
                  className="py-2 px-2 bg-[#1b3321] hover:bg-[#25462e] disabled:bg-[#121c15] disabled:text-[#455749] border border-[#376342] disabled:border-[#1d2a1f] text-emerald-100 font-bold text-xs rounded flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
                >
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isAtCamp
                      ? 'У таборі'
                      : currentForeignCamp
                      ? 'Чужий табір'
                      : currentSearchStatus.isDepleted
                      ? 'Виснажено'
                      : 'Огляд (-4%)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onRest}
                  disabled={!isAtCamp}
                  className="py-2 px-2 bg-[#16271c] hover:bg-[#203828] disabled:bg-[#121c15] disabled:text-[#455749] border border-[#2a4732] disabled:border-[#1d2920] text-slate-200 font-semibold text-xs rounded flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <Bed className="w-3.5 h-3.5 shrink-0" />
                  <span>Відпочити</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-1.5 pt-1.5 border-t border-[#1a291f] flex items-center justify-between text-[10px] text-[#7c9683] z-30 bg-[#08100b]/90 px-2 py-1 rounded backdrop-blur-md">
          <span className="truncate">* Тягніть мапу • Клікайте на туман</span>
          <span className="shrink-0 ml-2">
            Радар: {liveRadarRadius}м{environment ? ` • ${environment.dayPhaseLabel}` : ''}
          </span>
        </div>
      </div>

      {/* Права панель деталей */}
      <div className="bg-[#101712] border border-[#233327] rounded-lg p-4 flex flex-col justify-between shadow-xl">
        {expedition && transitProgress ? (
          <div className="flex flex-col justify-between h-full space-y-4 animate-in fade-in duration-300">
            <div>
              <div className="flex items-center justify-between border-b border-[#1f3325] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-amber-300 font-bold font-mono">
                    ТАКТИЧНИЙ МАРШ // У ДОРОЗІ
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/70 text-amber-300">
                  {transitProgress.percent}%
                </span>
              </div>

              <div className="mt-3">
                <div className="text-[10px] text-[#71917a] uppercase font-mono">НАПРЯМОК РУХУ:</div>
                <h3 className="text-base md:text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
                  <SectorTacticalIcon icon={transitProgress.destData.icon} className="w-5 h-5 text-amber-400" />
                  <span>{transitProgress.destData.name}</span>
                </h3>
                <div className="text-[10px] text-amber-300/80 font-mono mt-0.5">
                  GPS: {expeditionTargetCoords.lat.toFixed(5)}° N, {expeditionTargetCoords.lng.toFixed(5)}° E
                </div>
              </div>

              <div className="mt-3.5 p-3 rounded-lg bg-[#0a120c] border border-[#1e3827] shadow-inner space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8ba793] flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
                    Залишилось часу:
                  </span>
                  <b className="text-amber-300 font-mono text-sm tracking-wider">
                    {formatTravelDuration(transitProgress.remainingSec)}
                  </b>
                </div>

                <div className="w-full bg-[#142318] h-2.5 rounded-full overflow-hidden border border-[#2b5936] p-0.5">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                    style={{ width: `${transitProgress.percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#6b8573] font-mono">
                  <span>Пройдено: <b className="text-slate-200">{transitProgress.coveredMeters} м</b></span>
                  <span>Залишилось: <b className="text-amber-300">{transitProgress.remainingMeters} м</b></span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded bg-[#121c15] border border-[#223828]">
                  <span className="text-[#6d8a74] block text-[9.5px]">ВИТРАТА СИТОСТІ:</span>
                  <b className="text-amber-400 mt-0.5 block">~{expedition.hungerCost}%</b>
                </div>
                <div className="p-2 rounded bg-[#121c15] border border-[#223828]">
                  <span className="text-[#6d8a74] block text-[9.5px]">ШВИДКІСТЬ ХОДУ:</span>
                  <b className="text-emerald-400 mt-0.5 block">
                    {effectiveSpeedKmh} км/год
                  </b>
                </div>
              </div>
            </div>

            {onOpenAfkModal && (
              <div className="pt-2 border-t border-[#1e3324]">
                <button
                  type="button"
                  onClick={onOpenAfkModal}
                  className="w-full py-2 bg-[#172b1d] hover:bg-[#223d2b] border border-[#31573b] text-emerald-300 text-xs font-bold rounded transition flex items-center justify-center gap-2"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Відкрити диспетчер переходу
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#567a5f] font-bold">ПОТОЧНИЙ СЕКТОР</div>
            <h3 className="text-base md:text-lg font-bold text-slate-100 mt-1 flex items-center gap-2">
              <SectorTacticalIcon icon={isAtCamp ? 'camp' : currentSectorInfo.icon} className="w-5 h-5" />
              <span>{isAtCamp ? 'Укріплений базовий табір' : currentSectorInfo.name}</span>
            </h3>
            <p className="text-xs text-[#8ea393] mt-2 italic border-l-2 border-[#2b4432] pl-2.5">
              {isAtCamp ? 'Ваш безпечний притулок. Вогнище тліє, периметр під контролем.' : currentSectorInfo.desc}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {isAtCamp ? (
                <span className="bg-emerald-950/40 px-2 py-1 rounded border border-emerald-700/60 text-emerald-300">
                  <span>Безпечна зона</span>
                </span>
              ) : currentSearchStatus.isDepleted ? (
                <span className="bg-rose-950/60 px-2 py-1 rounded border border-rose-600/80 text-rose-300 flex items-center gap-1 font-mono font-bold animate-pulse">
                  <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Виснажено (Кулдаун: {formatCooldownTimer(currentSearchStatus.cooldownRemainingMs)})</span>
                </span>
              ) : (
                <span className="bg-[#17231a] px-2 py-1 rounded border border-[#263b2c] text-[#a4baa8] flex items-center gap-1">
                  <span>Пошуків залишилось:</span>
                  <b className="text-emerald-400">{currentSearchStatus.searchesLeft}/4</b>
                </span>
              )}

              {currentSectorInfo.radHazard > 0.25 && !isAtCamp && (
                <span className="bg-amber-950/40 px-2 py-1 rounded border border-amber-800/60 text-amber-300">
                  <span>Радіація: {Math.round(currentSectorInfo.radHazard * 100)}%</span>
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {currentForeignCamp && !isAtCamp && (
                <div className="p-2.5 rounded bg-orange-950/60 border border-orange-600/80 text-orange-200 text-[11px] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>
                    Укріплений табір виживанця <b>«{currentForeignCamp.ownerCallsign}»</b>. Пошук предметів на території чужої бази заблоковано.
                  </span>
                </div>
              )}

              {currentOwnStash && onClaimOwnStash && (
                <button
                  type="button"
                  onClick={() => onClaimOwnStash(currentOwnStash)}
                  className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded transition flex items-center justify-center gap-2 shadow-lg animate-pulse"
                >
                  <Archive className="w-4 h-4 shrink-0" />
                  <span>
                    Забрати свій схрон ({currentOwnStash.items.reduce((s, i) => s + i.count, 0)} речей
                    {currentOwnStash.coins > 0 ? ` + ${currentOwnStash.coins} плат` : ''})
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={onSearch}
                disabled={Boolean(expedition) || isAtCamp || Boolean(currentForeignCamp) || currentSearchStatus.isDepleted}
                className="w-full py-2.5 px-3 bg-[#1e3825] hover:bg-[#2b5135] disabled:bg-[#17221a] disabled:text-[#55695a] border border-[#3b6e47] disabled:border-[#223126] text-emerald-100 font-bold text-xs rounded transition flex items-center justify-center gap-2 shadow"
              >
                <Eye className="w-4 h-4 shrink-0" />
                <span>
                  {isAtCamp
                    ? 'У таборі немає луту'
                    : currentForeignCamp
                    ? 'Чужий табір (пошук заблоковано)'
                    : currentSearchStatus.isDepleted
                    ? `Виснажено (кулдаун: ${formatCooldownTimer(currentSearchStatus.cooldownRemainingMs)})`
                    : 'Оглянути місцевість (-4% ситості)'}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onRest}
                  disabled={Boolean(expedition) || !isAtCamp}
                  className="py-2 px-2 bg-[#17261d] hover:bg-[#22382b] disabled:bg-[#131c15] disabled:text-[#425246] border border-[#284732] disabled:border-[#1d2920] text-xs font-semibold rounded text-slate-200 transition flex items-center justify-center gap-1.5"
                >
                  <Bed className="w-3.5 h-3.5 shrink-0" />
                  <span>Відпочити</span>
                </button>

                <button
                  type="button"
                  onClick={onRelocateCamp}
                  disabled={Boolean(expedition) || isAtCamp}
                  className="py-2 px-2 bg-[#17261d] hover:bg-[#22382b] disabled:bg-[#131c15] disabled:text-[#425246] border border-[#284732] disabled:border-[#1d2920] text-xs font-semibold rounded text-emerald-300 transition flex items-center justify-center gap-1.5"
                >
                  <Tent className="w-3.5 h-3.5 shrink-0" />
                  <span>Перенести ({relocateCampCost} плат)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Деталі цілі */}
        {!expedition && selectedTarget ? (
          isSelectedCurrent ? (
            <div className="mt-4 pt-3 border-t border-[#233327] bg-[#141d16] p-3 rounded border border-[#2c4232]">
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">ОБРАНИЙ СЕКТОР</div>
              <div className="text-xs font-bold text-slate-100 mt-0.5">{selectedTarget.data.name}</div>
              <div className="text-[10px] text-[#7b9683] font-mono">
                GPS: {selectedTarget.lat.toFixed(5)}° N, {selectedTarget.lng.toFixed(5)}° E
              </div>
              <div className="mt-2.5 p-2 bg-emerald-950/40 border border-emerald-600/60 rounded text-emerald-300 text-[11px] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span><b>Ви вже тут.</b> Це ваш поточний сектор розташування.</span>
              </div>
            </div>
          ) : routeEstimates ? (
            <div className="mt-4 pt-3 border-t border-[#233327] bg-[#141d16] p-3 rounded border border-[#2c4232]">
              <div className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">
                {selectedTarget.isFog ? 'РОЗВІДКА НЕВІДОМОЇ ЗОНИ' : `ПРОРАХУНОК МАРШУ (${effectiveSpeedKmh} КМ/ГОД)`}
              </div>
              <div className="text-xs font-bold text-slate-100 mt-0.5 flex items-center justify-between">
                <span>{selectedTarget.isFog ? 'Нерозвіданий сектор' : selectedTarget.data.name}</span>
                {selectedTarget.data.isWaterBlocked && (
                  <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                    <Waves className="w-3.5 h-3.5" /> Глибока вода
                  </span>
                )}
              </div>

              <div className="text-[10px] text-[#7b9683] font-mono">
                GPS: {selectedTarget.lat.toFixed(5)}° N, {selectedTarget.lng.toFixed(5)}° E
              </div>

              <div className="text-[11px] text-[#a6bdab] mt-1 space-y-0.5">
                <div>Дистанція: <b className="text-slate-200">{routeEstimates.meters} м</b></div>
                <div>Витрата ситості: ~<b className="text-amber-400">-{routeEstimates.hungerCost}%</b></div>
                <div>
                  Час маршу: ~
                  <b className="text-emerald-400 font-mono">
                    {formatTravelDuration(routeEstimates.seconds)}
                  </b>
                </div>
              </div>

              {selectedTargetSearchStatus?.isDepleted && (
                <div className="mt-2 p-1.5 bg-rose-950/70 border border-rose-600 rounded text-rose-200 text-[10px] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                  <span>
                    <b>Сектор зачищено!</b> Відновлення через:{' '}
                    <b className="text-rose-300 font-mono">
                      {formatCooldownTimer(selectedTargetSearchStatus.cooldownRemainingMs)}
                    </b>
                  </span>
                </div>
              )}

              {selectedTarget.data.isWaterBlocked ? (
                <div className="mt-2.5 p-2 bg-cyan-950/70 border border-cyan-600 rounded text-cyan-200 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-cyan-400" />
                  <span><b>Перехід заблоковано!</b> Для руху відкритою водою потрібен плавзасіб.</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onStartExpedition({
                      x: selectedTarget.lat,
                      y: selectedTarget.lng,
                      lat: selectedTarget.lat,
                      lng: selectedTarget.lng,
                      targetSectorData: selectedTarget.data
                    } as any)
                  }
                  className="w-full mt-2.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs rounded transition flex items-center justify-center gap-2 shadow-lg active:scale-98"
                >
                  <Footprints className="w-4 h-4 shrink-0" /> 
                  <span>{selectedTarget.isFog ? 'Розпочати розвідку' : 'Почати марш'}</span>
                </button>
              )}
            </div>
          ) : null
        ) : !expedition ? (
          <div className="mt-4 pt-3 border-t border-[#233327] text-center text-xs text-[#5f7564]">
            Оберіть точку або ділянку туману на мапі для маршу
          </div>
        ) : null}
      </div>
    </div>
  );
};