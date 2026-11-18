import React from 'react';
import {
  Eye,
  Bed,
  Tent,
  Footprints,
  AlertCircle,
  Waves,
  Clock,
  Lock,
  CheckCircle2,
  Archive,
  ShieldAlert
} from 'lucide-react';
import type {
  Coordinates,
  ExpeditionState,
  OtherPlayerCamp,
  SectorDefinition,
  SectorStash
} from '../../types/game';
import { formatCooldownTimer } from '../../utils/sectorCooldownManager';
import { SectorTacticalIcon, formatTravelDuration, type TargetSelection } from './mapHelpers';

interface SearchStatusInfo {
  searchesLeft: number;
  cooldownRemainingMs: number;
  isDepleted: boolean;
}

interface RouteEstimatesInfo {
  seconds: number;
  meters: number;
  hungerCost: number;
}

interface TransitProgressInfo {
  destData: SectorDefinition;
  totalMeters: number;
  coveredMeters: number;
  remainingMeters: number;
  percent: number;
  remainingSec: number;
}

interface MobileQuickActionsProps {
  expedition: ExpeditionState | null;
  selectedTarget: TargetSelection | null;
  isSelectedCurrent: boolean;
  routeEstimates: RouteEstimatesInfo | null;
  selectedTargetSearchStatus: SearchStatusInfo | null;
  isAtCamp: boolean;
  currentSearchStatus: SearchStatusInfo;
  currentOwnStash?: SectorStash | null;
  currentForeignCamp?: OtherPlayerCamp | null;
  onStartExpedition: (targetCoords: Coordinates) => void;
  onSearch: () => void;
  onRest: () => void;
  onClaimOwnStash?: (stash: SectorStash) => void;
}

export const MobileQuickActions: React.FC<MobileQuickActionsProps> = ({
  expedition,
  selectedTarget,
  isSelectedCurrent,
  routeEstimates,
  selectedTargetSearchStatus,
  isAtCamp,
  currentSearchStatus,
  currentOwnStash,
  currentForeignCamp,
  onStartExpedition,
  onSearch,
  onRest,
  onClaimOwnStash
}) => {
  return (
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
  );
};

interface SectorDetailsSidebarProps {
  expedition: ExpeditionState | null;
  transitProgress: TransitProgressInfo | null;
  expeditionTargetCoords: { lat: number; lng: number } | null;
  effectiveSpeedKmh: string;
  isAtCamp: boolean;
  currentSectorInfo: SectorDefinition;
  currentSearchStatus: SearchStatusInfo;
  currentForeignCamp?: OtherPlayerCamp | null;
  currentOwnStash?: SectorStash | null;
  relocateCampCost: number;
  selectedTarget: TargetSelection | null;
  isSelectedCurrent: boolean;
  routeEstimates: RouteEstimatesInfo | null;
  selectedTargetSearchStatus: SearchStatusInfo | null;
  onStartExpedition: (targetCoords: Coordinates) => void;
  onSearch: () => void;
  onRest: () => void;
  onRelocateCamp: () => void;
  onClaimOwnStash?: (stash: SectorStash) => void;
  onOpenAfkModal?: () => void;
}

export const SectorDetailsSidebar: React.FC<SectorDetailsSidebarProps> = ({
  expedition,
  transitProgress,
  expeditionTargetCoords,
  effectiveSpeedKmh,
  isAtCamp,
  currentSectorInfo,
  currentSearchStatus,
  currentForeignCamp,
  currentOwnStash,
  relocateCampCost,
  selectedTarget,
  isSelectedCurrent,
  routeEstimates,
  selectedTargetSearchStatus,
  onStartExpedition,
  onSearch,
  onRest,
  onRelocateCamp,
  onClaimOwnStash,
  onOpenAfkModal
}) => {
  return (
    <div className="bg-[#101712] border border-[#233327] rounded-lg p-4 flex flex-col justify-between shadow-xl">
      {expedition && transitProgress && expeditionTargetCoords ? (
        <div className="space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <SectorTacticalIcon icon={transitProgress.destData.icon} className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-slate-100 truncate">
                {transitProgress.destData.name}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono font-bold text-amber-300">
                {formatTravelDuration(transitProgress.remainingSec)}
              </span>
              {onOpenAfkModal && (
                <button
                  type="button"
                  onClick={onOpenAfkModal}
                  className="px-2.5 py-1 bg-[#1a3321] hover:bg-[#25462f] border border-[#3b6b46] rounded text-[11px] font-bold text-emerald-200 transition active:scale-95"
                >
                  Деталі
                </button>
              )}
            </div>
          </div>

          <div className="w-full bg-[#0a120c] h-2 rounded-full overflow-hidden border border-[#223d29]">
            <div
              className="bg-amber-500 h-full transition-all duration-300"
              style={{ width: `${transitProgress.percent}%` }}
            />
          </div>
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

      {/* Деталі обраної цілі */}
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
              <span>
                <b>Ви вже тут.</b> Це ваш поточний сектор розташування.
              </span>
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
              <div>
                Дистанція: <b className="text-slate-200">{routeEstimates.meters} м</b>
              </div>
              <div>
                Витрата ситості: ~<b className="text-amber-400">-{routeEstimates.hungerCost}%</b>
              </div>
              <div>
                Час маршу: ~
                <b className="text-emerald-400 font-mono">{formatTravelDuration(routeEstimates.seconds)}</b>
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
                <span>
                  <b>Перехід заблоковано!</b> Для руху відкритою водою потрібен плавзасіб.
                </span>
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
  );
};