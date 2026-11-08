import React from 'react';
import { Footprints } from 'lucide-react';
import { ExpeditionState } from '../types/game';

interface AfkModalProps {
  expedition: ExpeditionState;
  onClose: () => void;
}

export const AfkModal: React.FC<AfkModalProps> = ({ expedition, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121a14] border border-[#2b5936] rounded-lg max-w-sm w-full p-5 text-xs shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#223526] pb-2 mb-3">
          <span className="font-bold text-slate-100 flex items-center gap-1.5">
            <Footprints className="w-4 h-4 text-emerald-400" /> Диспетчер маршу
          </span>
          <button onClick={onClose} className="text-[#6d8573] hover:text-white">✕</button>
        </div>

        <div className="space-y-2 mb-4 text-[#8ea392]">
          <div>
            Ціль марш-кидка: [
            {(expedition as any).targetCoords
              ? `${(expedition as any).targetCoords.lat.toFixed(5)}° N, ${(expedition as any).targetCoords.lng.toFixed(5)}° E`
              : `${expedition.targetX}, ${expedition.targetY}`}
            ]
          </div>
          <div>Залишилось часу: <b className="text-emerald-400 font-mono text-sm">{expedition.remaining} сек</b></div>
          <div>Заплановані витрати ситості: <b className="text-amber-400">-{expedition.hungerCost}%</b></div>
        </div>

        <div className="bg-[#0b100d] h-2 rounded-full overflow-hidden border border-[#223526] mb-4">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${((expedition.totalDuration - expedition.remaining) / expedition.totalDuration) * 100}%` }}
          />
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-[#1e3825] hover:bg-[#2b5135] text-emerald-200 font-bold rounded border border-[#3b6e47] transition"
        >
          Згорнути у фоновий режим (AFK)
        </button>
      </div>
    </div>
  );
};