import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, Eye, Bed, Tent, Footprints, AlertCircle, Waves, 
  Building2, Factory, Route, Anchor, 
  Compass, Ship, Zap, Mountain, Crosshair, Wheat, TreePine, 
  Clock, Lock, CheckCircle2, Radio
} from 'lucide-react';
import type { Coordinates, ExpeditionState, PlayerStats, SectorDefinition } from '../types/game';
import { calculateHaversineDistanceMeters, offsetGeoBySectors, calculateRealisticTravelTime } from '../utils/coordinates';
import { createSectorData } from '../utils/sectorGenerator';
import type { SectorSearchRecord } from '../utils/sectorCooldownManager';
import { getSectorSearchStatus, formatCooldownTimer } from '../utils/sectorCooldownManager';
import { detectGridWater, SectorTerrainData } from '../utils/waterDetectorService';

interface TargetSelection {
  lat: number;
  lng: number;
  data: SectorDefinition;
  dist: number;
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
  onOpenAfkModal?: () => void;
}

const SectorTacticalIcon: React.FC<{ icon: string; className?: string }> = ({ icon, className = 'w-4 h-4' }) => {
  switch (icon) {
    case 'camp':
      return <Tent className={`${className} text-emerald-400`} />;
    case 'building':
      return <Building2 className={`${className} text-slate-300`} />;
    case 'factory':
      return <Factory className={`${className} text-amber-400`} />;
    case 'highway':
      return <Route className={`${className} text-slate-400`} />;
    case 'waves':
      return <Waves className={`${className} text-cyan-400`} />;
    case 'anchor':
      return <Anchor className={`${className} text-teal-400`} />;
    case 'shallows':
      return <Compass className={`${className} text-teal-300`} />;
    case 'pier':
      return <Ship className={`${className} text-teal-400`} />;
    case 'forest':
      return <TreePine className={`${className} text-emerald-400`} />;
    case 'field':
      return <Wheat className={`${className} text-yellow-400`} />;
    case 'anomaly':
      return <Zap className={`${className} text-rose-400 animate-pulse`} />;
    case 'mountain':
      return <Mountain className={`${className} text-stone-300`} />;
    default:
      return <MapPin className={`${className} text-slate-400`} />;
  }
};

const lon2tile = (lon: number, zoom: number) => Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
const lat2tile = (lat: number, zoom: number) =>
  Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );

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
  onOpenAfkModal
}) => {
  const gridRadius = 2;
  const zoom = 16;
  const [radarMap, setRadarMap] = useState<Record<string, SectorTerrainData>>({});

  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const centerTileX = lon2tile(coords.lng, zoom);
  const centerTileY = lat2tile(coords.lat, zoom);

  const n = Math.pow(2, zoom);
  const exactTileX = ((coords.lng + 180) / 360) * n;
  const latRad = (coords.lat * Math.PI) / 180;
  const exactTileY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const shiftPercentX = (centerTileX + 0.5 - exactTileX) * 100;
  const shiftPercentY = (centerTileY + 0.5 - exactTileY) * 100;

  const tiles = useMemo(() => {
    const list = [];
    for (let ty = -1; ty <= 1; ty++) {
      for (let tx = -1; tx <= 1; tx++) {
        list.push({
          x: centerTileX + tx,
          y: centerTileY + ty,
          key: `${centerTileX + tx}-${centerTileY + ty}`
        });
      }
    }
    return list;
  }, [centerTileX, centerTileY]);

  const sectorList = useMemo(() => {
    const list = [];
    for (let dy = gridRadius; dy >= -gridRadius; dy--) {
      for (let dx = -gridRadius; dx <= gridRadius; dx++) {
        const geo = offsetGeoBySectors(coords.lat, coords.lng, dx, dy);
        list.push({
          dx,
          dy,
          lat: geo.lat,
          lng: geo.lng,
          key: `${geo.lat.toFixed(5)}-${geo.lng.toFixed(5)}`
        });
      }
    }
    return list;
  }, [coords.lat, coords.lng]);

  useEffect(() => {
    let isMounted = true;
    detectGridWater(sectorList).then((results: Record<string, SectorTerrainData>) => {
      if (isMounted) {
        setRadarMap(results);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [coords.lat, coords.lng, sectorList]);

  // Координати цілі активного маршу
  const expeditionTargetCoords = useMemo(() => {
    if (!expedition) return null;
    return (expedition as any).targetCoords || {
      lat: (expedition as any).targetY / 1000,
      lng: (expedition as any).targetX / 1000
    };
  }, [expedition]);

  const visibleSectors = useMemo(() => {
    return sectorList.map((sec) => {
      const distMeters = calculateHaversineDistanceMeters(coords.lat, coords.lng, sec.lat, sec.lng);
      const distFromCamp = calculateHaversineDistanceMeters(sec.lat, sec.lng, campCoords.lat, campCoords.lng);
      const isCampSector = distFromCamp < 50;

      const classification = radarMap[sec.key] || {
        isWater: false,
        isCoast: false,
        biome: 'urban',
        elevation: null
      };

      const searchState = getSectorSearchStatus(sec.lat, sec.lng, sectorSearches, currentTime);

      // Чи є сектор ціллю активного маршу
      const isExpeditionDestination = Boolean(
        expeditionTargetCoords &&
        calculateHaversineDistanceMeters(sec.lat, sec.lng, expeditionTargetCoords.lat, expeditionTargetCoords.lng) < 50
      );

      return {
        ...sec,
        data: createSectorData(
          sec.lat,
          sec.lng,
          classification.isWater,
          classification.isCoast,
          isCampSector,
          classification.biome
        ),
        classification,
        searchState,
        isExpeditionDestination,
        isCurrent: sec.dx === 0 && sec.dy === 0,
        distanceMeters: distMeters
      };
    });
  }, [sectorList, coords, campCoords, radarMap, sectorSearches, currentTime, expeditionTargetCoords]);

  const currentSectorKey = `${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}`;
  const currentClassification = radarMap[currentSectorKey] || {
    isWater: false,
    isCoast: false,
    biome: 'urban',
    elevation: null
  };
  const distanceToCampMeters = calculateHaversineDistanceMeters(coords.lat, coords.lng, campCoords.lat, campCoords.lng);
  const isAtCamp = distanceToCampMeters < 50;

  const currentSectorInfo = useMemo(() => {
    return createSectorData(
      coords.lat,
      coords.lng,
      currentClassification.isWater,
      currentClassification.isCoast,
      isAtCamp,
      currentClassification.biome
    );
  }, [coords, currentClassification, isAtCamp]);

  const currentSearchStatus = useMemo(() => {
    return getSectorSearchStatus(coords.lat, coords.lng, sectorSearches, currentTime);
  }, [coords.lat, coords.lng, sectorSearches, currentTime]);

  const isSelectedCurrent = useMemo(() => {
    if (!selectedTarget) return false;
    return calculateHaversineDistanceMeters(coords.lat, coords.lng, selectedTarget.lat, selectedTarget.lng) < 50;
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
      player.specialization
    );
  }, [selectedTarget, isSelectedCurrent, coords, player]);

  // Розрахунки для активного маршу
  const transitProgress = useMemo(() => {
    if (!expedition || !expeditionTargetCoords) return null;

    const totalMeters = calculateHaversineDistanceMeters(coords.lat, coords.lng, expeditionTargetCoords.lat, expeditionTargetCoords.lng);
    const duration = expedition.totalDuration || 1;
    const progressRatio = Math.min(1, Math.max(0, (duration - expedition.remaining) / duration));
    const percent = Math.round(progressRatio * 100);
    const remainingMeters = Math.max(0, Math.round(totalMeters * (1 - progressRatio)));
    const coveredMeters = Math.max(0, totalMeters - remainingMeters);

    const destKey = `${expeditionTargetCoords.lat.toFixed(5)}-${expeditionTargetCoords.lng.toFixed(5)}`;
    const destClassification = radarMap[destKey] || { isWater: false, isCoast: false, biome: 'urban', elevation: null };
    const destData = createSectorData(
      expeditionTargetCoords.lat,
      expeditionTargetCoords.lng,
      destClassification.isWater,
      destClassification.isCoast,
      false,
      destClassification.biome
    );

    return {
      destData,
      totalMeters,
      coveredMeters,
      remainingMeters,
      percent,
      remainingSec: expedition.remaining
    };
  }, [expedition, expeditionTargetCoords, coords, radarMap]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
      <div className="lg:col-span-2 bg-[#060a08] border border-[#233327] rounded-lg p-3 md:p-4 flex flex-col justify-between shadow-2xl relative">
        {/* Адаптивна панель GPS: у 2 рядки на вузьких екранах, в 1 рядок на ширших */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2 text-xs z-10">
          <div className="flex items-center gap-1.5 text-emerald-300 font-bold bg-[#08100b]/90 px-2 py-1 rounded border border-[#203a27] backdrop-blur-md shadow-md text-[10px] sm:text-xs">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 
            <span>GPS: {coords.lat.toFixed(4)}°, {coords.lng.toFixed(4)}°</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#8ba793] bg-[#08100b]/90 px-2 py-1 rounded border border-[#203a27] backdrop-blur-md shadow-md text-[10px] sm:text-xs">
            <Tent className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 
            <span>База: {campCoords.lat.toFixed(4)}° ({distanceToCampMeters}м)</span>
          </div>
        </div>

        {/* СИНХРОНІЗОВАНИЙ В'ЮПОРТ ДЛЯ МАПИ ТА СІТКИ */}
        <div className="relative w-full max-w-[620px] aspect-square mx-auto my-auto rounded-lg overflow-hidden border border-[#233327] bg-[#070d09] shadow-inner">
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-80">
            <div
              className="grid grid-cols-3 shrink-0"
              style={{
                width: '300%',
                height: '300%',
                transform: `translate(${shiftPercentX / 3}%, ${shiftPercentY / 3}%)`
              }}
            >
              {tiles.map((t) => (
                <img
                  key={t.key}
                  src={`https://tile.opentopomap.org/${zoom}/${t.x}/${t.y}.png`}
                  alt="topo"
                  className="w-full h-full object-cover filter invert hue-rotate-180 brightness-80 contrast-125"
                  loading="eager"
                />
              ))}
            </div>
          </div>

          <div className="absolute inset-0 bg-radial from-transparent via-[#060a07]/20 to-[#040605]/80 pointer-events-none z-0" />

          {/* ТАКТИЧНА СІТКА 5x5 */}
          <div className="absolute inset-0 grid grid-cols-5 p-1.5 gap-1.5 select-none z-10">
            {visibleSectors.map((sector, idx) => {
              const isCampSector = calculateHaversineDistanceMeters(sector.lat, sector.lng, campCoords.lat, campCoords.lng) < 50;
              const isSelected = selectedTarget?.lat === sector.lat && selectedTarget?.lng === sector.lng;
              const isBlockedWater = Boolean(sector.data.isWaterBlocked);
              const isCoastSector = !isBlockedWater && sector.data.biomeType === 'water';
              const biome = sector.classification.biome;

              const isDepleted = sector.searchState.isDepleted;
              const searchesLeft = sector.searchState.searchesLeft;
              const isPartiallySearched = searchesLeft < 4 && !isDepleted;
              const isTargetOfMarch = sector.isExpeditionDestination;

              return (
                <div
                  key={idx}
                  onClick={() =>
                    !expedition &&
                    setSelectedTarget({
                      lat: sector.lat,
                      lng: sector.lng,
                      data: sector.data,
                      dist: sector.distanceMeters
                    })
                  }
                  className={`rounded border transition-all flex flex-col items-center justify-between p-1 relative cursor-pointer overflow-hidden group ${
                    sector.isCurrent
                      ? 'bg-emerald-950/50 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)] ring-2 ring-emerald-400 backdrop-blur-[1px]'
                      : isTargetOfMarch
                      ? 'bg-amber-950/60 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.75)] ring-2 ring-amber-400 animate-pulse'
                      : isSelected
                      ? 'bg-amber-950/50 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.6)] ring-1 ring-yellow-400'
                      : isCampSector
                      ? 'bg-blue-950/45 border-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]'
                      : isBlockedWater
                      ? 'bg-cyan-950/70 border-cyan-500/80 hover:bg-cyan-900/80 hover:border-cyan-300'
                      : isCoastSector
                      ? 'bg-teal-950/50 border-teal-500/80 hover:bg-teal-900/60 hover:border-teal-300'
                      : isDepleted
                      ? 'bg-rose-950/30 border-rose-900/70 hover:border-rose-500/90'
                      : biome === 'forest'
                      ? 'bg-[#08170c]/70 border-[#254d30]/70 hover:border-emerald-400/90'
                      : biome === 'field'
                      ? 'bg-[#171609]/70 border-[#474320]/70 hover:border-yellow-400/90'
                      : biome === 'mountain'
                      ? 'bg-[#141212]/70 border-[#4a423f]/70 hover:border-stone-300'
                      : 'bg-black/45 border-[#2f4935]/70 hover:bg-black/65 hover:border-emerald-400/90'
                  }`}
                >
                  <div className="w-full flex items-center justify-between leading-none">
                    <div>
                      {isTargetOfMarch ? (
                        <span className="text-[6px] text-amber-300 font-mono font-bold px-0.5 py-0.2 rounded bg-amber-950/95 border border-amber-500 flex items-center gap-0.5 animate-pulse">
                          МАРШ
                        </span>
                      ) : isDepleted ? (
                        <span className="text-[6px] text-rose-300 font-mono font-bold px-0.5 py-0.2 rounded bg-rose-950/95 border border-rose-600 flex items-center gap-0.5 shadow-sm">
                          <Lock className="w-2 h-2 text-rose-400" /> ЗАЧИЩЕНО
                        </span>
                      ) : isPartiallySearched ? (
                        <span className="text-[6px] text-amber-300 font-mono font-bold px-0.5 py-0.2 rounded bg-amber-950/90 border border-amber-600">
                          {searchesLeft}/4
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-0.5">
                      {isBlockedWater && (
                        <span className="text-[6px] text-cyan-300 font-mono font-bold px-0.5 rounded bg-[#061118]/90 border border-cyan-700">
                          ВОДА
                        </span>
                      )}
                      {isCoastSector && (
                        <span className="text-[6px] text-teal-300 font-mono font-bold px-0.5 rounded bg-[#071714]/90 border border-teal-700">
                          БЕРЕГ
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="my-auto flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    {sector.isCurrent ? (
                      <Crosshair className="w-4 h-4 md:w-5 md:h-5 text-emerald-300 animate-spin-slow" />
                    ) : isTargetOfMarch ? (
                      <Footprints className="w-4 h-4 md:w-5 md:h-5 text-amber-300 animate-bounce" />
                    ) : isCampSector ? (
                      <Tent className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
                    ) : (
                      <SectorTacticalIcon icon={sector.data.icon} className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                  </div>

                  <div className="w-full text-center mt-auto">
                    <div className="text-[8px] md:text-[9.5px] font-bold font-mono text-slate-100 uppercase tracking-tight truncate px-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                      {sector.isCurrent ? 'ВИ ТУТ' : isCampSector ? 'ТАБІР' : (sector.data.shortName || sector.data.name)}
                    </div>

                    <div className="text-[7px] md:text-[8px] font-mono leading-none flex items-center justify-center gap-1 drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
                      <span className={isTargetOfMarch ? 'text-amber-400 font-bold' : isDepleted ? 'text-rose-400' : 'text-emerald-400'}>
                        {sector.distanceMeters > 0 ? `${sector.distanceMeters}м` : `0м`}
                      </span>
                      {isDepleted && <span className="text-rose-400">🔒</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-[#1a291f] flex items-center justify-between text-[11px] text-[#718a78] z-10 bg-[#08100b]/90 px-2 py-1 rounded backdrop-blur-md">
          <span>* Тактичний георадар: облік виснаження секторів (24 години)</span>
          <span>Огляд: 500×500 м</span>
        </div>
      </div>

      {/* Права панель деталей */}
      <div className="bg-[#101712] border border-[#233327] rounded-lg p-4 flex flex-col justify-between shadow-xl">
        {/* ================= РЕЖИМ 1: ТАКТИЧНИЙ МАРШ У РОЗПАЛІ ================= */}
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

              {/* Таймер та прогрес */}
              <div className="mt-3.5 p-3 rounded-lg bg-[#0a120c] border border-[#1e3827] shadow-inner space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8ba793] flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
                    Залишилось часу:
                  </span>
                  <b className="text-amber-300 font-mono text-sm tracking-wider">
                    {transitProgress.remainingSec >= 60
                      ? `${Math.floor(transitProgress.remainingSec / 60)} хв ${transitProgress.remainingSec % 60} с`
                      : `${transitProgress.remainingSec} с`}
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

              {/* Характеристики переходу */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded bg-[#121c15] border border-[#223828]">
                  <span className="text-[#6d8a74] block text-[9.5px]">ВИТРАТА СИТОСТІ:</span>
                  <b className="text-amber-400 mt-0.5 block">~{expedition.hungerCost}%</b>
                </div>
                <div className="p-2 rounded bg-[#121c15] border border-[#223828]">
                  <span className="text-[#6d8a74] block text-[9.5px]">ШВИДКІСТЬ ХОДУ:</span>
                  <b className="text-emerald-400 mt-0.5 block">
                    {player.specialization === 'scout' ? '5.6 км/год' : '4.5 км/год'}
                  </b>
                </div>
              </div>

              {/* Статус-лог маршу */}
              <div className="mt-3 p-2.5 rounded bg-[#0b140e] border border-[#1b2f21] text-[10px] font-mono text-[#789680] space-y-1">
                <div className="text-[9px] text-[#4d6b54] font-bold uppercase tracking-wider">СТАТУС МАРШРУТУ:</div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Footprints className="w-3 h-3 text-amber-400 animate-bounce" />
                  <span>Виживанець здійснює марш-кидок через сектори.</span>
                </div>
                <div className="text-[#62806a]">
                  • Точка виходу: <span className="text-slate-300">{currentSectorInfo.name}</span>
                </div>
                <div className="text-[#62806a]">
                  • Фоновий стан спорядження: стабільний.
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
          /* ================= РЕЖИМ 2: СТАНДАРТНИЙ СТАН СЕКТОРА ================= */
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#567a5f] font-bold">ПОТОЧНИЙ СЕКТОР</div>
            <h3 className="text-base md:text-lg font-bold text-slate-100 mt-1 flex items-center gap-2">
              <SectorTacticalIcon icon={isAtCamp ? 'camp' : currentSectorInfo.icon} className="w-5 h-5" />
              <span>{isAtCamp ? 'Укріплений базовий табір' : currentSectorInfo.name}</span>
            </h3>
            <p className="text-xs text-[#8ea393] mt-2 italic border-l-2 border-[#2b4432] pl-2.5">
              {isAtCamp ? 'Ваш безпечний притулок. Вогнище тліє, периметр заміновано.' : currentSectorInfo.desc}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {isAtCamp ? (
                <span className="bg-emerald-950/40 px-2 py-1 rounded border border-emerald-700/60 text-emerald-300">
                  Безпечна зона
                </span>
              ) : currentSearchStatus.isDepleted ? (
                <span className="bg-rose-950/60 px-2 py-1 rounded border border-rose-600/80 text-rose-300 flex items-center gap-1 font-mono font-bold animate-pulse">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  Виснажено (Кулдаун: {formatCooldownTimer(currentSearchStatus.cooldownRemainingMs)})
                </span>
              ) : (
                <span className="bg-[#17231a] px-2 py-1 rounded border border-[#263b2c] text-[#a4baa8]">
                  Пошуків залишилось: <b className="text-emerald-400">{currentSearchStatus.searchesLeft}/4</b>
                </span>
              )}

              {currentSectorInfo.radHazard > 0.25 && !isAtCamp && (
                <span className="bg-amber-950/40 px-2 py-1 rounded border border-amber-800/60 text-amber-300">
                  Радіація: {Math.round(currentSectorInfo.radHazard * 100)}%
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <button
                onClick={onSearch}
                disabled={Boolean(expedition) || isAtCamp || currentSearchStatus.isDepleted}
                className="w-full py-2.5 px-3 bg-[#1e3825] hover:bg-[#2b5135] disabled:bg-[#17221a] disabled:text-[#55695a] border border-[#3b6e47] disabled:border-[#223126] text-emerald-100 font-bold text-xs rounded transition flex items-center justify-center gap-2 shadow"
              >
                <Eye className="w-4 h-4" />
                {isAtCamp
                  ? 'У таборі немає луту'
                  : currentSearchStatus.isDepleted
                  ? `Виснажено (кулдаун: ${formatCooldownTimer(currentSearchStatus.cooldownRemainingMs)})`
                  : 'Оглянути місцевість (-4% ситості)'}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onRest}
                  disabled={Boolean(expedition) || !isAtCamp}
                  className="py-2 px-2 bg-[#17261d] hover:bg-[#22382b] disabled:bg-[#131c15] disabled:text-[#425246] border border-[#284732] disabled:border-[#1d2920] text-xs font-semibold rounded text-slate-200 transition flex items-center justify-center gap-1.5"
                >
                  <Bed className="w-3.5 h-3.5" /> Відпочити
                </button>

                <button
                onClick={onRelocateCamp}
                disabled={Boolean(expedition) || isAtCamp}
                className="py-2 px-2 bg-[#17261d] hover:bg-[#22382b] disabled:bg-[#131c15] disabled:text-[#425246] border border-[#284732] disabled:border-[#1d2920] text-xs font-semibold rounded text-emerald-300 transition flex items-center justify-center gap-1.5"
              >
                <Tent className="w-3.5 h-3.5" /> Перенести (100 плат)
              </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= НИЖНЯ КАРТКА ПРОРАХУНКУ (Тільки коли марш не йде) ================= */}
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
              <div className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">ПРОРАХУНОК МАРШУ (4.5 КМ/ГОД)</div>
              <div className="text-xs font-bold text-slate-100 mt-0.5 flex items-center justify-between">
                <span>{selectedTarget.data.name}</span>
                {selectedTarget.data.isWaterBlocked && (
                  <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                    <Waves className="w-3.5 h-3.5" /> Глибока вода
                  </span>
                )}
              </div>

              <div className="text-[10px] text-[#7b9683] font-mono">
                GPS: {selectedTarget.lat.toFixed(5)}° N, {selectedTarget.lng.toFixed(5)}° E
              </div>

              <div className="text-[11px] text-[#869b8b] mt-1 space-y-0.5">
                <div>Дистанція: <b className="text-slate-200">{routeEstimates.meters} м</b></div>
                <div>Витрата ситості: ~<b className="text-amber-400">-{routeEstimates.hungerCost}%</b></div>
                <div>
                  Час маршу: ~
                  <b className="text-emerald-400 font-mono">
                    {routeEstimates.seconds >= 60
                      ? `${Math.floor(routeEstimates.seconds / 60)} хв ${routeEstimates.seconds % 60} с`
                      : `${routeEstimates.seconds} с`}
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
                  onClick={() =>
                    onStartExpedition({
                      x: selectedTarget.lat,
                      y: selectedTarget.lng,
                      lat: selectedTarget.lat,
                      lng: selectedTarget.lng
                    })
                  }
                  className="w-full mt-2.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs rounded transition flex items-center justify-center gap-2"
                >
                  <Footprints className="w-4 h-4" /> Почати марш
                </button>
              )}
            </div>
          ) : null
        ) : !expedition ? (
          <div className="mt-4 pt-3 border-t border-[#233327] text-center text-xs text-[#5f7564]">
            Оберіть клітинку сітки на мапі для прорахунку маршу
          </div>
        ) : null}
      </div>
    </div>
  );
};