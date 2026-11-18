import React, { useMemo } from 'react';
import { Footprints, Clock, X, Navigation } from 'lucide-react';
import type { Coordinates, ExpeditionState, PlayerStats, WorldEnvironment } from '../types/game';
import { calculateHaversineDistanceMeters } from '../utils/coordinates';
import { createSectorData } from '../utils/sectorGenerator';
import { SectorTacticalIcon, formatTravelDuration } from './map/mapHelpers';

interface AfkModalProps {
  expedition: ExpeditionState;
  coords?: Coordinates;
  player?: PlayerStats;
  environment?: WorldEnvironment;
  onClose: () => void;
}

export const AfkModal: React.FC<AfkModalProps> = ({
  expedition,
  coords,
  player,
  environment,
  onClose
}) => {
  const details = useMemo(() => {
    const targetCoords = expedition.targetCoords || {
      lat: expedition.targetY / 1000,
      lng: expedition.targetX / 1000
    };

    const destData =
      expedition.targetSectorData ||
      createSectorData(targetCoords.lat, targetCoords.lng, false, false, false);

    const duration = expedition.totalDuration || 1;
    const progressRatio = Math.min(1, Math.max(0, (duration - expedition.remaining) / duration));
    const percent = Math.round(progressRatio * 100);

    const totalMeters = coords
      ? calculateHaversineDistanceMeters(coords.lat, coords.lng, targetCoords.lat, targetCoords.lng)
      : 0;
    const remainingMeters = Math.max(0, Math.round(totalMeters * (1 - progressRatio)));
    const coveredMeters = Math.max(0, totalMeters - remainingMeters);

    let speed = 4.5;
    if (player?.specialization === 'scout') speed *= 1.25;
    if (player?.conditions.includes('bleeding')) speed *= 0.5;
    if (environment?.speedMultiplier) speed *= environment.speedMultiplier;

    return {
      targetCoords,
      destData,
      percent,
      totalMeters,
      coveredMeters,
      remainingMeters,
      speedKmh: speed.toFixed(1)
    };
  }, [expedition, coords, player, environment]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-mono animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#0e1611] border border-[#2b5936] rounded-xl max-w-md w-full p-4 sm:p-5 text-xs shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between border-b border-[#1f3325] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            <span className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">
              ТАКТИЧНИЙ МАРШ // У ДОРОЗІ
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/70 text-amber-300">
              {details.percent}%
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрити"
              className="text-[#7a9e85] hover:text-white p-1 rounded hover:bg-[#16271c] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Напрямок руху */}
        <div>
          <div className="text-[10px] text-[#71917a] uppercase">НАПРЯМОК РУХУ:</div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mt-0.5">
            <SectorTacticalIcon icon={details.destData.icon} className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="truncate">{details.destData.name}</span>
          </h3>
          <div className="text-[10px] text-amber-300/80 mt-0.5 flex items-center gap-1">
            <Navigation className="w-3 h-3 shrink-0" />
            <span>
              GPS: {details.targetCoords.lat.toFixed(5)}° N, {details.targetCoords.lng.toFixed(5)}° E
            </span>
          </div>
        </div>

        {/* Таймер та прогрес */}
        <div className="p-3 rounded-lg bg-[#0a120c] border border-[#1e3827] shadow-inner space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8ba793] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
              Залишилось часу:
            </span>
            <b className="text-amber-300 text-sm tracking-wider">
              {formatTravelDuration(expedition.remaining)}
            </b>
          </div>

          <div className="w-full bg-[#142318] h-2.5 rounded-full overflow-hidden border border-[#2b5936] p-0.5">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
              style={{ width: `${details.percent}%` }}
            />
          </div>

          {details.totalMeters > 0 && (
            <div className="flex items-center justify-between text-[10px] text-[#6b8573]">
              <span>
                Пройдено: <b className="text-slate-200">{details.coveredMeters} м</b>
              </span>
              <span>
                Залишилось: <b className="text-amber-300">{details.remainingMeters} м</b>
              </span>
            </div>
          )}
        </div>

        {/* Показники витрат та швидкості */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2.5 rounded bg-[#121c15] border border-[#223828]">
            <span className="text-[#6d8a74] block text-[9.5px]">ВИТРАТА СИТОСТІ:</span>
            <b className="text-amber-400 mt-0.5 block">~{expedition.hungerCost}%</b>
          </div>
          <div className="p-2.5 rounded bg-[#121c15] border border-[#223828]">
            <span className="text-[#6d8a74] block text-[9.5px]">ШВИДКІСТЬ ХОДУ:</span>
            <b className="text-emerald-400 mt-0.5 block">{details.speedKmh} км/год</b>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-[#1e3825] hover:bg-[#2b5135] text-emerald-200 font-bold rounded-lg border border-[#3b6e47] transition flex items-center justify-center gap-1.5"
        >
          <Footprints className="w-3.5 h-3.5 text-emerald-400" />
          <span>Згорнути (марш триває)</span>
        </button>
      </div>
    </div>
  );
};