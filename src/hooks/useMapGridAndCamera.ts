import { useState, useEffect, useMemo, useRef } from 'react';
import type {
  Coordinates,
  ExpeditionState,
  PlayerStats,
  WorldEnvironment
} from '../types/game';
import {
  calculateHaversineDistanceMeters,
  offsetGeoBySectors,
  calculateRealisticTravelTime
} from '../utils/coordinates';
import { createSectorData } from '../utils/sectorGenerator';
import {
  getSectorSearchStatus,
  type SectorSearchRecord
} from '../utils/sectorCooldownManager';
import {
  detectGridWater,
  getCachedSectorTerrain,
  type SectorTerrainData
} from '../utils/waterDetectorService';
import {
  latLngToWorldPixel,
  worldPixelToLatLng,
  type TargetSelection
} from '../components/map/mapHelpers';

interface UseMapGridAndCameraProps {
  coords: Coordinates;
  campCoords: Coordinates;
  player: PlayerStats;
  expedition: ExpeditionState | null;
  selectedTarget: TargetSelection | null;
  sectorSearches: Record<string, SectorSearchRecord>;
  exploredSectors: string[];
  environment?: WorldEnvironment;
  zoom?: number;
}

export function useMapGridAndCamera({
  coords,
  campCoords,
  player,
  expedition,
  selectedTarget,
  sectorSearches,
  exploredSectors,
  environment,
  zoom = 16
}: UseMapGridAndCameraProps) {
  const [radarMap, setRadarMap] = useState<Record<string, SectorTerrainData>>({});
  const terrainCacheRef = useRef<Record<string, SectorTerrainData>>({});
  const [panPx, setPanPx] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panPxRef = useRef(panPx);
  panPxRef.current = panPx;

  const containerRef = useRef<HTMLDivElement>(null);
  const prevCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const cancelArrivalAnimRef = useRef<(() => void) | null>(null);
  const [arrivalPulse, setArrivalPulse] = useState(false);

  // Плавне наведення камери та імпульс прибуття до нової локації
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
  }, [coords.lat, coords.lng, zoom]);

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

  const playerWorld = useMemo(() => latLngToWorldPixel(coords.lat, coords.lng, zoom), [coords.lat, coords.lng, zoom]);
  const campWorld = useMemo(() => latLngToWorldPixel(campCoords.lat, campCoords.lng, zoom), [campCoords.lat, campCoords.lng, zoom]);

  const cameraWorld = useMemo(
    () => ({
      x: playerWorld.x - panPx.x,
      y: playerWorld.y - panPx.y
    }),
    [playerWorld.x, playerWorld.y, panPx.x, panPx.y]
  );

  const cameraLatLng = useMemo(
    () => worldPixelToLatLng(cameraWorld.x, cameraWorld.y, zoom),
    [cameraWorld.x, cameraWorld.y, zoom]
  );

  const playerScreen = useMemo(
    () => ({
      x: playerWorld.x - cameraWorld.x + containerSize.width / 2,
      y: playerWorld.y - cameraWorld.y + containerSize.height / 2
    }),
    [playerWorld.x, playerWorld.y, cameraWorld.x, cameraWorld.y, containerSize.width, containerSize.height]
  );

  const campScreen = useMemo(
    () => ({
      x: campWorld.x - cameraWorld.x + containerSize.width / 2,
      y: campWorld.y - cameraWorld.y + containerSize.height / 2
    }),
    [campWorld.x, campWorld.y, cameraWorld.x, cameraWorld.y, containerSize.width, containerSize.height]
  );

  const distanceToCampMeters = useMemo(
    () => Math.round(calculateHaversineDistanceMeters(coords.lat, coords.lng, campCoords.lat, campCoords.lng)),
    [coords.lat, coords.lng, campCoords.lat, campCoords.lng]
  );

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

  const visibleTiles = useMemo(() => {
    const halfW = containerSize.width / 2;
    const halfH = containerSize.height / 2;

    const minTileX = Math.floor((cameraWorld.x - halfW - 300) / 256);
    const maxTileX = Math.floor((cameraWorld.x + halfW + 300) / 256);
    const minTileY = Math.floor((cameraWorld.y - halfH - 300) / 256);
    const maxTileY = Math.floor((cameraWorld.y + halfH + 300) / 256);

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
  }, [cameraWorld.x, cameraWorld.y, containerSize.width, containerSize.height, zoom]);

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
    return (
      expedition.targetCoords || {
        lat: expedition.targetY / 1000,
        lng: expedition.targetX / 1000
      }
    );
  }, [expedition]);

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
      detectGridWater(missing)
        .then((results: Record<string, SectorTerrainData>) => {
          if (isMounted && results && Object.keys(results).length > 0) {
            terrainCacheRef.current = { ...terrainCacheRef.current, ...results };
            setRadarMap((prev) => ({ ...prev, ...results }));
          }
        })
        .catch(() => {});
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
  }, [
    sectorList,
    coords,
    campCoords,
    exploredSet,
    radarMap,
    sectorSearches,
    currentTime,
    expeditionTargetCoords,
    cameraWorld.x,
    cameraWorld.y,
    containerSize.width,
    containerSize.height,
    liveRadarRadius,
    zoom
  ]);

  const currentSectorInfo = useMemo(() => {
    const curSec = visibleSectors.find((s) => s.isCurrent);
    if (curSec && !isAtCamp) return curSec.data;
    const currentSectorKey = `${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}`;
    const curClass = terrainCacheRef.current[currentSectorKey] || radarMap[currentSectorKey];
    return createSectorData(coords.lat, coords.lng, false, false, isAtCamp, curClass?.biome);
  }, [coords, isAtCamp, visibleSectors, radarMap]);

  const currentSearchStatus = useMemo(
    () => getSectorSearchStatus(coords.lat, coords.lng, sectorSearches, currentTime),
    [coords.lat, coords.lng, sectorSearches, currentTime]
  );

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

  const transitProgress = useMemo(() => {
    if (!expedition || !expeditionTargetCoords) return null;

    const totalMeters = calculateHaversineDistanceMeters(
      coords.lat,
      coords.lng,
      expeditionTargetCoords.lat,
      expeditionTargetCoords.lng
    );
    const duration = expedition.totalDuration || 1;
    const progressRatio = Math.min(1, Math.max(0, (duration - expedition.remaining) / duration));
    const percent = Math.round(progressRatio * 100);
    const remainingMeters = Math.max(0, Math.round(totalMeters * (1 - progressRatio)));
    const coveredMeters = Math.max(0, totalMeters - remainingMeters);

    const destSectorInMap = visibleSectors.find(
      (s) => calculateHaversineDistanceMeters(s.lat, s.lng, expeditionTargetCoords.lat, expeditionTargetCoords.lng) < 45
    );

    const destData =
      expedition.targetSectorData ||
      (destSectorInMap ? destSectorInMap.data : null) ||
      (selectedTarget &&
      calculateHaversineDistanceMeters(selectedTarget.lat, selectedTarget.lng, expeditionTargetCoords.lat, expeditionTargetCoords.lng) < 45
        ? selectedTarget.data
        : null) ||
      createSectorData(expeditionTargetCoords.lat, expeditionTargetCoords.lng, false, false, false);

    return {
      destData,
      totalMeters,
      coveredMeters,
      remainingMeters,
      percent,
      remainingSec: expedition.remaining
    };
  }, [expedition, expeditionTargetCoords, coords, visibleSectors, selectedTarget]);

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

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    setPanPx((prev) => ({
      x: prev.x - e.deltaX * 0.8,
      y: prev.y - e.deltaY * 0.8
    }));
  };

  const resolveClickTarget = (clickScreenX: number, clickScreenY: number): TargetSelection | null => {
    if (Math.hypot(playerScreen.x - clickScreenX, playerScreen.y - clickScreenY) < 32) {
      return {
        lat: coords.lat,
        lng: coords.lng,
        data: currentSectorInfo,
        dist: 0,
        isFog: false
      };
    }

    if (Math.hypot(campScreen.x - clickScreenX, campScreen.y - clickScreenY) < 32) {
      return {
        lat: campCoords.lat,
        lng: campCoords.lng,
        data: createSectorData(campCoords.lat, campCoords.lng, false, false, true),
        dist: distanceToCampMeters,
        isFog: false
      };
    }

    const nearest = visibleSectors.find(
      (s) => Math.hypot(s.screenX - clickScreenX, s.screenY - clickScreenY) < 48
    );

    if (nearest) {
      return {
        lat: nearest.lat,
        lng: nearest.lng,
        data: nearest.data,
        dist: nearest.distanceMeters,
        isFog: nearest.isFog
      };
    }

    if (!gridStep.dLat || !gridStep.dLng) return null;

    const clickWorldX = cameraWorld.x - containerSize.width / 2 + clickScreenX;
    const clickWorldY = cameraWorld.y - containerSize.height / 2 + clickScreenY;
    const clickGeo = worldPixelToLatLng(clickWorldX, clickWorldY, zoom);

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

    return {
      lat: sLat,
      lng: sLng,
      data: createSectorData(sLat, sLng, false, false, isCamp, rawClass?.biome),
      dist,
      isFog
    };
  };

  return {
    containerRef,
    containerSize,
    arrivalPulse,
    hasMovedRef,
    cameraWorld,
    cameraLatLng,
    playerScreen,
    campScreen,
    distanceToCampMeters,
    isAtCamp,
    liveRadarRadius,
    effectiveSpeedKmh,
    relocateCampCost,
    visibleTiles,
    visibleSectors,
    currentSectorInfo,
    currentSearchStatus,
    isSelectedCurrent,
    selectedTargetSearchStatus,
    routeEstimates,
    transitProgress,
    expeditionTargetCoords,
    isPanned: Math.hypot(panPx.x, panPx.y) > 20,
    centerOnPlayer: () => setPanPx({ x: 0, y: 0 }),
    centerOnCamp: () =>
      setPanPx({
        x: playerWorld.x - campWorld.x,
        y: playerWorld.y - campWorld.y
      }),
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    resolveClickTarget
  };
}