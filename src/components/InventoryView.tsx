import React, { useState, useMemo } from 'react';
import { Package, Utensils, Heart, ShieldAlert, Sparkles, Box, Trash2, Key, Cpu } from 'lucide-react';
import type { InventoryItem } from '../types/game';

interface InventoryViewProps {
  inventory: InventoryItem[];
  coins: number;
  onUseItem: (item: InventoryItem) => void;
}

type FilterCategory = 'all' | 'medical' | 'food' | 'material' | 'junk';

export const InventoryView: React.FC<InventoryViewProps> = ({ inventory, coins, onUseItem }) => {
  const [filter, setFilter] = useState<FilterCategory>('all');
  const activeItems = useMemo(() => inventory.filter((item) => item.count > 0), [inventory]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return activeItems;
    if (filter === 'medical') return activeItems.filter((i) => i.type.startsWith('medical'));
    if (filter === 'food') return activeItems.filter((i) => i.type === 'food');
    if (filter === 'material') return activeItems.filter((i) => i.type === 'material' || i.type === 'rare' || i.type === 'quest');
    if (filter === 'junk') return activeItems.filter((i) => i.type === 'junk');
    return activeItems;
  }, [activeItems, filter]);

  const getItemIcon = (item: InventoryItem) => {
    if (item.id === 'microchip') {
      return <Cpu className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />;
    }
    switch (item.type) {
      case 'food':
        return <Utensils className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'medical_bleed':
        return <Heart className="w-4 h-4 text-red-400 shrink-0" />;
      case 'medical_rad':
        return <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0" />;
      case 'material':
        return <Package className="w-4 h-4 text-slate-300 shrink-0" />;
      case 'rare':
        return <Sparkles className="w-4 h-4 text-purple-400 animate-pulse shrink-0" />;
      case 'junk':
        return <Trash2 className="w-4 h-4 text-stone-400 shrink-0" />;
      case 'quest':
        return <Key className="w-4 h-4 text-amber-500 shrink-0" />;
      default:
        return <Box className="w-4 h-4 text-slate-400 shrink-0" />;
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

  const filterButtons: { id: FilterCategory; label: string }[] = [
    { id: 'all', label: `Усі (${activeItems.length})` },
    { id: 'medical', label: 'Медицина' },
    { id: 'food', label: 'Їжа' },
    { id: 'material', label: 'Ресурси' },
    { id: 'junk', label: 'Мотлох' }
  ];

  return (
    <div className="bg-[#101712] border border-[#233327] rounded-lg p-3.5 sm:p-5 shadow-2xl flex-1 flex flex-col justify-between">
      <div>
        {/* Адаптивна шапка без переносу тексту в бейджі */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#233327] pb-3.5 mb-3.5">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Експедиційний рюкзак</span>
            </h2>
            <p className="text-xs text-[#94ad9b] mt-1 leading-relaxed">
              Використовуйте запаси для зняття негативних статусів та відновлення сил
            </p>
          </div>

          <div className="px-3 py-2 rounded-lg bg-[#17231a] border border-[#2f4d37] text-xs font-mono font-bold flex items-center gap-2 shadow-inner whitespace-nowrap shrink-0 self-start sm:self-auto">
            <span className="text-[#96ba9f]">Мікросхеми:</span>
            <span className="text-emerald-400 font-bold text-sm flex items-center gap-1">
              <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{coins} шт.</span>
            </span>
          </div>
        </div>

        {/* Швидкі фільтри категорій */}
        {activeItems.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 no-scrollbar">
            {filterButtons.map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setFilter(btn.id)}
                className={`px-2.5 py-1.5 rounded text-[11px] font-bold whitespace-nowrap transition shrink-0 ${
                  filter === btn.id
                    ? 'bg-[#1f3b27] text-emerald-200 border border-emerald-500/80 shadow'
                    : 'bg-[#141d16] text-[#8da894] border border-[#223326] hover:text-slate-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {activeItems.length === 0 ? (
          <div className="py-14 text-center text-[#87a18e] font-mono text-xs border border-dashed border-[#243628] rounded-lg px-4">
            <Box className="w-8 h-8 mx-auto mb-2.5 opacity-60 text-emerald-500" />
            Рюкзак порожній. Обстежуйте сектори карти для пошуку припасів та мікросхем.
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-10 text-center text-[#87a18e] font-mono text-xs border border-dashed border-[#243628] rounded-lg px-4">
            У цій категорії предметів немає.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredItems.map((item) => {
              const isUsable = item.type === 'food' || item.type === 'medical_bleed' || item.type === 'medical_rad';
              const isJunk = item.type === 'junk';
              const isChip = item.id === 'microchip';

              return (
                <div
                  key={item.id}
                  className={`rounded-lg p-3.5 flex flex-col justify-between transition shadow-md ${
                    isChip
                      ? 'bg-[#112419] border-2 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : isJunk
                      ? 'bg-[#141d16] border border-[#332f2a]'
                      : 'bg-[#141d16] border border-[#273d2d] hover:border-[#3d6346]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className={`flex items-center gap-2 font-bold text-xs sm:text-[13px] leading-snug ${isChip ? 'text-emerald-300' : isJunk ? 'text-stone-300' : 'text-slate-100'}`}>
                        {getItemIcon(item)}
                        <span>{item.name}</span>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${
                        isChip
                          ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                          : isJunk
                          ? 'bg-[#1d261f] border-[#453f38] text-stone-300'
                          : 'bg-[#1b2b1f] border-[#32523a] text-emerald-300'
                      }`}>
                        x{item.count}
                      </span>
                    </div>
                    <p className={`text-xs ${isChip ? 'text-[#b5d6be]' : isJunk ? 'text-[#969087]' : 'text-[#a3b8a8]'} mt-2 leading-relaxed`}>
                      {item.desc}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#1e2e23] flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-mono uppercase tracking-wide ${isChip ? 'text-emerald-400 font-bold' : isJunk ? 'text-stone-400' : 'text-[#7fa088]'}`}>
                      {getItemCategoryLabel(item)}
                    </span>
                    {isUsable ? (
                      <button
                        type="button"
                        onClick={() => onUseItem(item)}
                        className="px-3 py-1.5 bg-[#1e3d26] hover:bg-[#2a5435] active:scale-95 border border-emerald-500/70 text-emerald-100 text-xs font-bold rounded transition shadow"
                      >
                        Застосувати
                      </button>
                    ) : isChip ? (
                      <span className="text-[11px] text-emerald-300 font-mono font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700">
                        Валюта
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#7c9482] italic font-mono">
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

      <div className="mt-4 pt-3 border-t border-[#1d2720] text-[11px] text-[#7e9684] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 font-mono">
        <span>* Мікросхеми є універсальним розрахунковим засобом та компонентом крафту</span>
        <span className="shrink-0">Заповнено слотів: {activeItems.length}</span>
      </div>
    </div>
  );
};