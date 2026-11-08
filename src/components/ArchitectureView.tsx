import React from 'react';
import { Database, Terminal } from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  return (
    <div className="bg-[#101712] border border-[#233327] rounded-lg p-4 md:p-6 shadow-xl flex-1 flex flex-col overflow-y-auto">
      <div className="border-b border-[#243328] pb-3 mb-4">
        <h2 className="text-base font-bold text-yellow-300 flex items-center gap-2">
          <Database className="w-5 h-5 text-yellow-400" /> Архітектура проекту та Supabase DDL
        </h2>
        <p className="text-xs text-[#829987] mt-1">
          Повний план розгортання в Next.js (App Router), структура папок та SQL-міграція для збереження стану виживанців.
        </p>
      </div>

      <div className="mb-6">
        <div className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Terminal className="w-4 h-4 text-emerald-400" /> Модульна структура Next.js
        </div>
        <pre className="bg-[#0b100d] p-3 rounded border border-[#1e2c21] text-[11px] text-[#a1b8a5] overflow-x-auto leading-relaxed">
{`/app
  ├── /api
  │   ├── /expeditions/route.ts       # Валідація часу AFK-походу на сервері
  │   └── /chat/route.ts              # Публікація в глобальну шину Supabase
  ├── /components
  │   ├── MapGrid.tsx                 # 2D віртуальна Чебишовська координатна сітка
  │   ├── TravelOverlay.tsx           # AFK HUD та таймер подорожі
  │   ├── InventoryModal.tsx          # Рюкзак та лікування
  │   └── RadioChat.tsx               # Трансивер із шифруванням шуму
  ├── /hooks
  │   ├── useGameLoop.ts              # Тіки виживання (голод, кровотеча)
  │   └── useSupabaseSync.ts          # Realtime синхронізація через Supabase Client
  ├── /types
  │   └── game.ts                     # TypeScript інтерфейси гравця та секторів
  └── page.tsx                        # Головний екран гри ASTAT`}
        </pre>
      </div>

      <div>
        <div className="text-xs font-bold text-yellow-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Database className="w-4 h-4 text-yellow-400" /> SQL-міграція для Supabase (PostgreSQL)
        </div>
        <pre className="bg-[#0b100d] p-3 rounded border border-[#1e2c21] text-[11px] text-[#d6b772] overflow-x-auto leading-relaxed">
{`-- Таблиця профілю виживанця
CREATE TABLE public.players (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    callsign TEXT NOT NULL,
    specialization TEXT DEFAULT 'scout',
    hp INT DEFAULT 100 CHECK (hp >= 0 AND hp <= 100),
    hunger INT DEFAULT 100 CHECK (hunger >= 0 AND hunger <= 100),
    astat_coins INT DEFAULT 150,
    current_x INT DEFAULT 0,
    current_y INT DEFAULT 0,
    camp_x INT DEFAULT 0,
    camp_y INT DEFAULT 0,
    conditions TEXT[] DEFAULT ARRAY['comfort']::TEXT[],
    searches_left INT DEFAULT 4,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблиця інвентарю виживанця
CREATE TABLE public.player_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    count INT NOT NULL DEFAULT 1,
    UNIQUE(player_id, item_id)
);

-- Таблиця активних AFK-експедицій
CREATE TABLE public.active_expeditions (
    player_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
    start_x INT NOT NULL,
    start_y INT NOT NULL,
    target_x INT NOT NULL,
    target_y INT NOT NULL,
    hunger_cost INT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finishes_at TIMESTAMPTZ NOT NULL
);

-- Таблиця локального радіоефіру з Realtime
CREATE TABLE public.radio_transmissions (
    id BIGSERIAL PRIMARY KEY,
    sender_callsign TEXT NOT NULL,
    sector_x INT NOT NULL,
    sector_y INT NOT NULL,
    frequency TEXT DEFAULT '104.2 FM',
    message TEXT NOT NULL,
    is_corrupted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Увімкнення Realtime для радіочастот
ALTER PUBLICATION supabase_realtime ADD TABLE public.radio_transmissions;`}
        </pre>
      </div>
    </div>
  );
};