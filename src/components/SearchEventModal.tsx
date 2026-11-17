import React from 'react';
import {
  Compass,
  Shield,
  Wrench,
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  Package,
  Skull,
  Sparkles,
  Eye,
  Archive
} from 'lucide-react';
import type { InventoryItem, Specialization } from '../types/game';
import type { SearchEventChoice, SearchEventScenario } from '../constants/searchEvents';

export interface ActiveSearchEventState {
  scenario: SearchEventScenario;
  sectorName: string;
  sectorBiome: string;
  resolved?: {
    outcome: 'loot' | 'trap' | 'empty';
    narrative: string;
    foundItem?: InventoryItem;
    chipsFound?: number;
    damageTaken?: number;
    gotBleeding?: boolean;
    gotRadiation?: boolean;
    healedHp?: number;
    foreignStashLoot?: {
      ownerCallsign: string;
      takenItem?: InventoryItem;
      takenCoins: number;
    };
  };
}

interface SearchEventModalProps {
  eventState: ActiveSearchEventState;
  specialization: Specialization;
  onSelectChoice: (choice: SearchEventChoice) => void;
  onClose: () => void;
  embedded?: boolean;
}

const SPEC_LABELS: Record<Specialization, { label: string; icon: React.ReactNode }> = {
  scout: { label: 'НАВИЧКА РОЗВІДНИКА', icon: <Compass className="w-3.5 h-3.5 text-emerald-400" /> },
  soldier: { label: 'НАВИЧКА ШТУРМОВИКА', icon: <Shield className="w-3.5 h-3.5 text-amber-400" /> },
  engineer: { label: 'НАВИЧКА ТЕХНІКА', icon: <Wrench className="w-3.5 h-3.5 text-cyan-400" /> },
  medic: { label: 'НАВИЧКА МЕДИКА', icon: <HeartPulse className="w-3.5 h-3.5 text-rose-400" /> }
};

export const SearchEventModal: React.FC<SearchEventModalProps> = ({
  eventState,
  specialization,
  onSelectChoice,
  onClose,
  embedded = false
}) => {
  const { scenario, sectorName, resolved } = eventState;
  const specMeta = SPEC_LABELS[specialization];

  return (
    <div
      className={`${
        embedded ? 'absolute inset-0' : 'fixed inset-0'
      } z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-mono animate-in fade-in duration-200`}
    >
      <div className="bg-[#0d1510] border-2 border-[#2e5739] rounded-xl max-w-lg w-full p-4 sm:p-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] space-y-4 max-h-[90dvh] overflow-y-auto">
        {/* Заголовок події */}
        <div className="border-b border-[#1f3626] pb-3">
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span>РОЗВІДКА СЕКТОРА // {sectorName}</span>
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-100 mt-1">
            {scenario.title}
          </h3>
        </div>

        {/* Опис ситуації */}
        <div className="bg-[#121d16] border-l-2 border-emerald-500 p-3 rounded-r-lg text-xs sm:text-[13px] text-[#bfd1c3] leading-relaxed">
          {scenario.situation}
        </div>

        {/* Етап 1: Вибір тактики дій */}
        {!resolved ? (
          <div className="space-y-2.5">
            <div className="text-[11px] uppercase tracking-wider text-[#7fa188] font-bold">
              Оберіть тактику обшуку:
            </div>

            {scenario.choices.map((choice) => {
              const isClassChoice = choice.riskLevel === 'class';
              const isHighRisk = choice.riskLevel === 'high';

              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => onSelectChoice(choice)}
                  className={`w-full text-left p-3 rounded-lg border transition active:scale-[0.99] flex flex-col gap-1.5 shadow ${
                    isClassChoice
                      ? 'bg-[#11261b] hover:bg-[#173626] border-emerald-500/80 text-emerald-100'
                      : isHighRisk
                      ? 'bg-[#1c1611] hover:bg-[#291f17] border-amber-600/70 text-amber-100'
                      : 'bg-[#141e17] hover:bg-[#1c2b21] border-[#2b4532] text-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs sm:text-sm leading-snug">
                      {choice.label}
                    </span>
                    {isClassChoice ? (
                      <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 flex items-center gap-1 shrink-0">
                        {specMeta.icon}
                        <span>{specMeta.label}</span>
                      </span>
                    ) : isHighRisk ? (
                      <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-amber-950 border border-amber-600 text-amber-300 shrink-0">
                        РИЗИК / ЦІННИЙ ЛУТ
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-[#18261c] border border-[#2f4d37] text-[#97b89f] shrink-0">
                        ОБЕРЕЖНО
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-[#92ad99]">
                    {choice.sublabel}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Етап 2: Результат обраної дії */
          <div className="space-y-3 animate-in fade-in duration-200">
            <div
              className={`p-3.5 rounded-lg border space-y-2.5 ${
                resolved.outcome === 'trap'
                  ? 'bg-[#261010] border-red-500/80 text-red-100'
                  : resolved.outcome === 'loot'
                  ? 'bg-[#112619] border-emerald-500/80 text-emerald-100'
                  : 'bg-[#151e18] border-[#2d4534] text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                {resolved.outcome === 'trap' ? (
                  <>
                    <Skull className="w-5 h-5 text-red-400 shrink-0" />
                    <span className="text-red-300">НЕБЕЗПЕКА // ПАСТКА СПРАЦЮВАЛА</span>
                  </>
                ) : resolved.outcome === 'loot' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300">ОБШУК ЗАВЕРШЕНО // ЗНАХІДКА</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <span className="text-amber-200">ОБШУК ЗАВЕРШЕНО // ПОРОЖНЬО</span>
                  </>
                )}
              </div>

              <p className="text-xs leading-relaxed opacity-95">
                {resolved.narrative}
              </p>

              {/* Деталі нагороди або шкоди */}
              <div className="pt-2 border-t border-white/10 space-y-1.5 text-xs">
                {resolved.foundItem && (
                  <div className="flex items-center gap-2 text-emerald-300 font-bold">
                    <Package className="w-4 h-4 shrink-0" />
                    <span>
                      Отримано: {resolved.foundItem.name} (+{resolved.foundItem.count || 1})
                    </span>
                  </div>
                )}

                {resolved.chipsFound && resolved.chipsFound > 0 && (
                  <div className="flex items-center gap-2 text-amber-300 font-bold">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>Додатково знайдено мікросхем: +{resolved.chipsFound} шт.</span>
                  </div>
                )}

                {resolved.foreignStashLoot && (
                  <div className="p-2 rounded bg-amber-950/60 border border-amber-500/70 text-amber-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <Archive className="w-4 h-4 shrink-0" />
                      <span>
                        Виявлено прихований схрон виживанця «{resolved.foreignStashLoot.ownerCallsign}»!
                      </span>
                    </div>
                    {resolved.foreignStashLoot.takenItem && (
                      <div className="text-[11px] pl-5">
                        • Забрано зі схрону: <b>{resolved.foreignStashLoot.takenItem.name}</b> (+
                        {resolved.foreignStashLoot.takenItem.count})
                      </div>
                    )}
                    {resolved.foreignStashLoot.takenCoins > 0 && (
                      <div className="text-[11px] pl-5">
                        • Знайдено мікросхем у підсумку: <b>+{resolved.foreignStashLoot.takenCoins} шт.</b>
                      </div>
                    )}
                  </div>
                )}

                {resolved.healedHp && resolved.healedHp > 0 && (
                  <div className="flex items-center gap-2 text-emerald-300 font-bold">
                    <HeartPulse className="w-4 h-4 shrink-0" />
                    <span>Польова обробка: +{resolved.healedHp} HP</span>
                  </div>
                )}

                {resolved.damageTaken && resolved.damageTaken > 0 && (
                  <div className="text-red-300 font-bold">
                    🩸 Отримано шкоди: -{resolved.damageTaken} HP
                    {resolved.gotBleeding ? ' та глибоку кровотечу!' : ''}
                  </div>
                )}

                {resolved.gotRadiation && (
                  <div className="text-amber-300 font-bold">
                    ☣️ Зафіксовано променеве опромінення!
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs sm:text-sm rounded-lg transition shadow-lg active:scale-95"
            >
              Продовжити
            </button>
          </div>
        )}
      </div>
    </div>
  );
};