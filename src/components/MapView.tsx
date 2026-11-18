import React from 'react';
import {
  MapPin,
  Tent,
  Footprints,
  Crosshair,
  Lock,
  Radio,
  HelpCircle,
  LocateFixed,
  Archive,
  ShieldAlert
} from 'lucide-react';
import type {
  Coordinates,
  ExpeditionState,
  NotificationState,
  OtherPlayerCamp,
  PlayerStats,
  SectorStash,
  WorldEnvironment
} from '../types/game';
import { calculateHaversineDistanceMeters } from '../utils/coordinates';
import type { SectorSearchRecord } from '../utils/sectorCooldownManager';
import type { ActiveSearchEventState } from './SearchEventModal';
import type { SearchEventChoice } from '../constants/searchEvents';
import {
  SectorTacticalIcon,
  latLngToWorldPixel,
  type TargetSelection
} from './map/mapHelpers';
import { MapAtmosphereAndFog } from './map/MapAtmosphereAndFog';
import { MobileQuickActions, SectorDetailsSidebar } from './map/SectorDetailsPanel';
import { useMapGridAndCamera } from '../hooks/useMapGridAndCamera';

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

  const {
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
    isPanned,
    centerOnPlayer,
    centerOnCamp,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    resolveClickTarget
  } = useMapGridAndCamera({
    coords,
    campCoords,
    player,
    expedition,
    selectedTarget,
    sectorSearches,
    exploredSectors,
    environment,
    zoom
  });

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hasMovedRef.current || expedition) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const target = resolveClickTarget(e.clientX - rect.left, e.clientY - rect.top);
    if (target) {
      setSelectedTarget(target);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
      <div className="lg:col-span-2 bg-[#060a08] border border-[#233327] rounded-lg p-2.5 sm:p-4 flex flex-col justify-between shadow-2xl relative h-[74dvh] min-h-[460px] sm:h-[600px] lg:h-auto lg:min-h-[660px]">
        {/* Верхня панель карти */}
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
                onClick={centerOnPlayer}
                className="flex items-center gap-1 bg-[#1a2e20] hover:bg-[#25462f] border border-[#376943] text-emerald-300 px-2 py-1 rounded text-[10px] font-bold transition active:scale-95 shadow-md"
              >
                <LocateFixed className="w-3 h-3 text-emerald-400" />
                <span>Мене</span>
              </button>
            )}

            <button
              type="button"
              onClick={centerOnCamp}
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
          {/* 1. Підкладка OpenTopoMap */}
          <div className="absolute inset-0 pointer-events-none">
            {visibleTiles.map((t) => (
              <img
                key={t.key}
                src={`https://tile.opentopomap.org/${zoom}/${t.x}/${t.y}.png`}
                alt="topo"
                className="absolute w-[256px] h-[256px] object-cover filter invert hue-rotate-180 brightness-85 contrast-125 pointer-events-none"
                style={{ left: t.left, top: t.top }}
                loading="eager"
                draggable={false}
              />
            ))}
          </div>

          {/* 2. Атмосферні ефекти та туман війни */}
          <MapAtmosphereAndFog
            environment={environment}
            containerSize={containerSize}
            cameraWorld={cameraWorld}
            campScreen={campScreen}
            playerScreen={playerScreen}
            exploredSectors={exploredSectors}
            liveRadarRadius={liveRadarRadius}
            zoom={zoom}
          />

          {/* 3. Тактичні маркери */}
          <div className="absolute inset-0 pointer-events-none z-20">
            {/* Гравець */}
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

            {/* Базовий табір */}
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

            {/* Власні схрони на місці загибелі */}
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

            {/* Табори інших гравців у радіусі радара */}
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

            {/* Сектори світу */}
            {visibleSectors.map((sector) => {
              if (sector.isCurrent || (sector.isCampSector && !isAtCamp)) return null;

              const isOnScreen =
                sector.screenX > -50 &&
                sector.screenX < containerSize.width + 50 &&
                sector.screenY > -50 &&
                sector.screenY < containerSize.height + 50;
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
                      <div
                        className={`w-10 h-10 rounded-full border-2 ${
                          sector.isExpeditionDestination
                            ? 'border-amber-400 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-ping'
                            : 'border-yellow-400 bg-yellow-400/15 shadow-[0_0_15px_rgba(250,204,21,0.7)] animate-pulse'
                        } flex items-center justify-center`}
                      >
                        {sector.isExpeditionDestination ? (
                          <Footprints className="w-5 h-5 text-amber-300 animate-bounce" />
                        ) : (
                          <HelpCircle className="w-5 h-5 text-yellow-300" />
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[9.5px] font-mono font-bold mt-0.5 leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,1)] ${
                        sector.isExpeditionDestination ? 'text-amber-300' : 'text-yellow-300'
                      }`}
                    >
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

                  <span
                    className={`text-[8px] font-mono font-bold mt-0.5 leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,1)] ${
                      isTargetOfMarch
                        ? 'text-amber-300'
                        : isSelected
                        ? 'text-yellow-300 font-bold'
                        : isDepleted
                        ? 'text-rose-400'
                        : 'text-emerald-400/80'
                    }`}
                  >
                    {sector.distanceMeters}м
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Мобільна панель швидкої дії */}
        <MobileQuickActions
          expedition={expedition}
          selectedTarget={selectedTarget}
          isSelectedCurrent={isSelectedCurrent}
          routeEstimates={routeEstimates}
          selectedTargetSearchStatus={selectedTargetSearchStatus}
          isAtCamp={isAtCamp}
          currentSearchStatus={currentSearchStatus}
          currentOwnStash={currentOwnStash}
          currentForeignCamp={currentForeignCamp}
          onStartExpedition={onStartExpedition}
          onSearch={onSearch}
          onRest={onRest}
          onClaimOwnStash={onClaimOwnStash}
        />

        <div className="mt-1.5 pt-1.5 border-t border-[#1a291f] flex items-center justify-between text-[10px] text-[#7c9683] z-30 bg-[#08100b]/90 px-2 py-1 rounded backdrop-blur-md">
          <span className="truncate">* Тягніть мапу • Клікайте на туман</span>
          <span className="shrink-0 ml-2">
            Радар: {liveRadarRadius}м{environment ? ` • ${environment.dayPhaseLabel}` : ''}
          </span>
        </div>
      </div>

      {/* Права панель деталей */}
      <SectorDetailsSidebar
        expedition={expedition}
        transitProgress={transitProgress}
        expeditionTargetCoords={expeditionTargetCoords}
        effectiveSpeedKmh={effectiveSpeedKmh}
        isAtCamp={isAtCamp}
        currentSectorInfo={currentSectorInfo}
        currentSearchStatus={currentSearchStatus}
        currentForeignCamp={currentForeignCamp}
        currentOwnStash={currentOwnStash}
        relocateCampCost={relocateCampCost}
        selectedTarget={selectedTarget}
        isSelectedCurrent={isSelectedCurrent}
        routeEstimates={routeEstimates}
        selectedTargetSearchStatus={selectedTargetSearchStatus}
        onStartExpedition={onStartExpedition}
        onSearch={onSearch}
        onRest={onRest}
        onRelocateCamp={onRelocateCamp}
        onClaimOwnStash={onClaimOwnStash}
        onOpenAfkModal={onOpenAfkModal}
      />
    </div>
  );
};