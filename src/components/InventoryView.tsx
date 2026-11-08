import React from 'react';
import { Package, Utensils, Heart, ShieldAlert, Sparkles, Box, Trash2, Key, Cpu } from 'lucide-react';
import type { InventoryItem } from '../types/game';

interface InventoryViewProps {
  inventory: InventoryItem[];
  coins: number; // Кількість мікросхем
  onUseItem: (item: InventoryItem) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ inventory, coins, onUseItem }) => {
  const activeItems = inventory.filter((item) => item.count > 0);

  const getItemIcon = (item: InventoryItem) => {
    if (item.id === 'microchip') {
      return <Cpu className="w-4 h-4 text-emerald-400 animate-pulse" />;
    }
    switch (item.type) {
      case 'food':
        return <Utensils className="w-4 h-4 text-amber-400" />;
      case 'medical_bleed':
        return <Heart className="w-4 h-4 text-red-400" />;
      case 'medical_rad':
        return <ShieldAlert className="w-4 h-4 text-cyan-400" />;
      case 'material':
        return <Package className="w-4 h-4 text-slate-300" />;
      case 'rare':
        return <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />;
      case 'junk':
        return <Trash2 className="w-4 h-4 text-stone-400" />;
      case 'quest':
        return <Key className="w-4 h-4 text-amber-500" />;
      default:
        return <Box className="w-4 h-4 text-slate-400" />;
    }
  };

  const getItemCategoryLabel = (item: InventoryItem) => {
    if (item.id === 'microchip') return 'Валюта / Плата';
    if (item.type === 'food') return 'Харчування';
    if (item.type.startsWith('medical')) return 'Медицина';
    if (item.type === 'material') return 'Матеріал';
    if (item.type === 'rare') return 'Рідкісне';
    if (item.type === 'junk') return 'Мотлох';
    if (item.type === 'quest') return 'Квестове';
    return 'Інше';
  };

  return (
    <div className="bg-[#101712] border border-[#233327] rounded-lg p-4 md:p-5 shadow-2xl flex-1 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-[#233327] pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" /> Експедиційний рюкзак
            </h2>
            <p className="text-xs text-[#718a78] mt-0.5">
              Використовуйте запаси для зняття негативних статусів та відновлення сил
            </p>
          </div>

          {/* Платіжний баланс мікросхем */}
          <div className="px-3 py-1.5 rounded bg-[#17231a] border border-[#2c4432] text-xs font-mono font-bold flex items-center gap-2 shadow-inner">
            <span className="text-[#7ea388]">Мікросхеми:</span>
            <span className="text-emerald-400 font-bold text-sm flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" /> {coins} шт.
            </span>
          </div>
        </div>

        {activeItems.length === 0 ? (
          <div className="py-16 text-center text-[#556b5b] font-mono text-xs border border-dashed border-[#1f2d22] rounded-lg">
            <Box className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-600" />
            Рюкзак порожній. Обстежуйте сектори карти для пошуку припасів та мікросхем.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeItems.map((item) => {
              const isUsable = item.type === 'food' || item.type === 'medical_bleed' || item.type === 'medical_rad';
              const isJunk = item.type === 'junk';
              const isChip = item.id === 'microchip';

              return (
                <div
                  key={item.id}
                  className={`rounded-lg p-3 flex flex-col justify-between transition shadow-md ${
                    isChip
                      ? 'bg-[#112419] border-2 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : isJunk
                      ? 'bg-[#141d16] border border-[#2a2723]'
                      : 'bg-[#141d16] border border-[#243729] hover:border-[#385c40]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-2 font-bold text-xs ${isChip ? 'text-emerald-300' : isJunk ? 'text-stone-400' : 'text-slate-100'}`}>
                        {getItemIcon(item)}
                        <span>{item.name}</span>
                      </div>
                      <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border ${
                        isChip
                          ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                          : isJunk
                          ? 'bg-[#1b2b1f] border-[#3a352f] text-stone-400'
                          : 'bg-[#1b2b1f] border-[#2c4733] text-emerald-300'
                      }`}>
                        x{item.count}
                      </span>
                    </div>
                    <p className={`text-[11px] ${isChip ? 'text-[#a1c4ab]' : isJunk ? 'text-[#68635c]' : 'text-[#869b8b]'} mt-1.5 leading-relaxed`}>
                      {item.desc}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#1b291f] flex items-center justify-between">
                    <span className={`text-[10px] font-mono uppercase ${isChip ? 'text-emerald-400 font-bold' : 'text-[#556e5c]'}`}>
                      {getItemCategoryLabel(item)}
                    </span>
                    {isUsable ? (
                      <button
                        onClick={() => onUseItem(item)}
                        className="px-2.5 py-1 bg-[#1e3825] hover:bg-[#2b5135] border border-[#386443] text-emerald-100 text-[10px] font-bold rounded transition shadow"
                      >
                        Застосувати
                      </button>
                    ) : isChip ? (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700">
                        Валюта
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#4d6352] italic font-mono">
                        {isJunk ? 'Безкорисне' : 'Ресурс'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#1d2720] text-[10px] text-[#556b5b] flex items-center justify-between font-mono">
        <span>* Мікросхеми є універсальним розрахунковим засобом та компонентом крафту</span>
        <span>Заповнено слотів: {activeItems.length}</span>
      </div>
    </div>
  );
};