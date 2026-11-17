import React from 'react';
import { Backpack, Radio, Skull } from 'lucide-react';

interface UnconsciousBannerProps {
  sosCooldown: number;
  onOpenInventory: () => void;
  onCallForHelp: () => void;
  onSurrender: () => void;
}

export const UnconsciousBanner: React.FC<UnconsciousBannerProps> = ({
  sosCooldown,
  onOpenInventory,
  onCallForHelp,
  onSurrender
}) => {
  return (
    <div className="max-w-7xl mx-auto w-full px-3 md:px-5 pt-3 z-30">
      <div className="bg-[#260909]/95 border-2 border-red-600 rounded-lg p-3.5 md:p-4 shadow-[0_0_25px_rgba(220,38,38,0.35)]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3.5 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="p-2.5 rounded-full bg-red-950 border border-red-500 shrink-0 shadow-lg">
              <Skull className="w-6 h-6 text-red-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-red-200 uppercase tracking-wider font-mono">
                КРИТИЧНИЙ СТАН // БЕЗ СВІДОМОСТІ (0 HP)
              </h3>
              <p className="text-xs text-red-200/90 mt-1 leading-relaxed font-mono">
                Ви впали без свідомості, все що в вас лишається це гукати на допомогу або спробувати підлікуватись самостійно.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:flex items-center gap-2 shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={onOpenInventory}
              className="px-3 py-2.5 bg-[#1b3821] hover:bg-[#285732] border border-emerald-500 text-emerald-100 text-xs font-bold leading-tight rounded flex items-center justify-center gap-1.5 transition shadow active:scale-95"
            >
              <Backpack className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Інвентар (лікуватись)</span>
            </button>

            <button
              type="button"
              onClick={onCallForHelp}
              disabled={sosCooldown > 0}
              className={`px-3 py-2.5 border text-xs font-bold leading-tight rounded flex items-center justify-center gap-1.5 transition shadow active:scale-95 ${
                sosCooldown > 0
                  ? 'bg-[#18130e] border-[#453020] text-[#9c7a5e] cursor-not-allowed'
                  : 'bg-[#2c1d12] hover:bg-[#422917] border-amber-500 text-amber-200'
              }`}
            >
              <Radio className={`w-4 h-4 shrink-0 ${sosCooldown > 0 ? 'text-[#9c7a5e]' : 'text-amber-400 animate-pulse'}`} />
              <span>{sosCooldown > 0 ? `Кулдаун (${sosCooldown}с)` : 'Гукати допомогу (SOS)'}</span>
            </button>

            <button
              type="button"
              onClick={onSurrender}
              className="col-span-2 md:col-span-1 px-3.5 py-2.5 bg-red-900/90 hover:bg-red-800 border border-red-500 text-white text-xs font-bold leading-tight rounded flex items-center justify-center gap-1.5 transition shadow active:scale-95"
            >
              <Skull className="w-4 h-4 text-red-200 shrink-0" />
              <span>Здатись (загинути)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};