import React from 'react';
import { Compass, Backpack, Radio, Crosshair, Lock } from 'lucide-react';
import type { TabType } from '../types/game';
import type { NotifyFn } from '../hooks/useNotifications';

interface NavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isUnconscious: boolean;
  notify: NotifyFn;
}

export const DesktopTabs: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  isUnconscious,
  notify
}) => {
  return (
    <div className="hidden md:flex items-center gap-1.5 border-b border-[#243328] pb-2 overflow-x-auto no-scrollbar text-xs">
      <button
        onClick={() => {
          if (isUnconscious) {
            notify('Ви без свідомості! Карта та пересування недоступні.', 'danger');
            return;
          }
          setActiveTab('map');
        }}
        disabled={isUnconscious}
        className={`flex items-center gap-2 px-3 py-2 rounded font-semibold whitespace-nowrap shrink-0 transition ${
          isUnconscious
            ? 'opacity-40 bg-[#121713] text-[#55695b] cursor-not-allowed border border-[#1f2b21]'
            : activeTab === 'map'
            ? 'bg-[#1b2b20] text-emerald-300 border border-[#3b6645]'
            : 'text-[#7d9984] hover:text-[#c4d6c7]'
        }`}
      >
        {isUnconscious ? <Lock className="w-4 h-4 text-rose-500" /> : <Compass className="w-4 h-4 shrink-0" />}
        <span>{isUnconscious ? 'Карта (Блоковано)' : 'Карта та сектор'}</span>
      </button>

      <button
        onClick={() => setActiveTab('inventory')}
        className={`flex items-center gap-2 px-3 py-2 rounded font-semibold whitespace-nowrap shrink-0 transition ${
          activeTab === 'inventory' ? 'bg-[#1b2b20] text-emerald-300 border border-[#3b6645]' : 'text-[#7d9984] hover:text-[#c4d6c7]'
        }`}
      >
        <Backpack className="w-4 h-4 shrink-0" /> Рюкзак та Крафт
      </button>

      <button
        onClick={() => setActiveTab('radio')}
        className={`flex items-center gap-2 px-3 py-2 rounded font-semibold whitespace-nowrap shrink-0 transition ${
          activeTab === 'radio' ? 'bg-[#1b2b20] text-emerald-300 border border-[#3b6645]' : 'text-[#7d9984] hover:text-[#c4d6c7]'
        }`}
      >
        <Radio className="w-4 h-4 shrink-0" /> Радіоефір
      </button>

      <button
        onClick={() => setActiveTab('profile')}
        className={`flex items-center gap-2 px-3 py-2 rounded font-semibold whitespace-nowrap shrink-0 transition ${
          activeTab === 'profile' ? 'bg-[#1b2b20] text-emerald-300 border border-[#3b6645]' : 'text-[#7d9984] hover:text-[#c4d6c7]'
        }`}
      >
        <Crosshair className="w-4 h-4 shrink-0" /> Особиста справа
      </button>
    </div>
  );
};

export const MobileBottomNav: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  isUnconscious,
  notify
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070e0a]/95 backdrop-blur-lg border-t border-[#1e3825] px-2 py-1.5 flex items-center justify-around shadow-[0_-8px_20px_rgba(0,0,0,0.8)]">
      <button
        onClick={() => {
          if (isUnconscious) {
            notify('Ви без свідомості! Карта та пересування недоступні.', 'danger');
            return;
          }
          setActiveTab('map');
        }}
        disabled={isUnconscious}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition ${
          isUnconscious
            ? 'opacity-40 text-[#45574a] cursor-not-allowed'
            : activeTab === 'map'
            ? 'text-emerald-300 bg-[#14261a]'
            : 'text-[#6b8572] hover:text-[#a1bda7]'
        }`}
      >
        {isUnconscious ? <Lock className="w-5 h-5 mb-0.5 text-rose-500" /> : <Compass className="w-5 h-5 mb-0.5" />}
        <span className="text-[9px] font-bold tracking-tight">{isUnconscious ? 'Блок' : 'Карта'}</span>
      </button>

      <button
        onClick={() => setActiveTab('inventory')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition ${
          activeTab === 'inventory' ? 'text-emerald-300 bg-[#14261a]' : 'text-[#6b8572] hover:text-[#a1bda7]'
        }`}
      >
        <Backpack className="w-5 h-5 mb-0.5" />
        <span className="text-[9px] font-bold tracking-tight">Рюкзак</span>
      </button>

      <button
        onClick={() => setActiveTab('radio')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition ${
          activeTab === 'radio' ? 'text-emerald-300 bg-[#14261a]' : 'text-[#6b8572] hover:text-[#a1bda7]'
        }`}
      >
        <Radio className="w-5 h-5 mb-0.5" />
        <span className="text-[9px] font-bold tracking-tight">Радіо</span>
      </button>

      <button
        onClick={() => setActiveTab('profile')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition ${
          activeTab === 'profile' ? 'text-emerald-300 bg-[#14261a]' : 'text-[#6b8572] hover:text-[#a1bda7]'
        }`}
      >
        <Crosshair className="w-5 h-5 mb-0.5" />
        <span className="text-[9px] font-bold tracking-tight">Профіль</span>
      </button>
    </nav>
  );
};