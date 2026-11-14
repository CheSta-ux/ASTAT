import React from 'react';
import type { Coordinates, PlayerStats, Specialization } from '../types/game';

interface ProfileViewProps {
  player: PlayerStats;
  campCoords: Coordinates;
}

const SPEC_SKILLS: Record<
  Specialization,
  {
    primaryTitle: string;
    primaryDesc: string;
    secondaryTitle: string;
    secondaryDesc: string;
  }
> = {
  scout: {
    primaryTitle: 'Легка хода (Розвідник)',
    primaryDesc: 'Збільшує швидкість маршу на +25% (до 5.6 км/год) та скорочує час переходів.',
    secondaryTitle: 'Орієнтування на місцевості',
    secondaryDesc: 'Швидше пересування пересіченою місцевістю Полісся.'
  },
  soldier: {
    primaryTitle: 'Загартований боєць (Штурмовик)',
    primaryDesc: 'Максимальний запас здоровʼя збільшено на +20% (120 HP).',
    secondaryTitle: 'Бойова пильність',
    secondaryDesc: 'Зменшує шкоду від пасток і засідок на 33% (12 HP замість 18 HP).'
  },
  medic: {
    primaryTitle: 'Польова хірургія (Медик)',
    primaryDesc: 'Бинти та турнікети відновлюють на +50% більше здоровʼя.',
    secondaryTitle: 'Детоксикація',
    secondaryDesc: 'Застосування «Астат-Блоку» додатково відновлює +15 HP.'
  },
  engineer: {
    primaryTitle: 'Польова фортифікація (Технік)',
    primaryDesc: 'Перенесення базового табору коштує на 50% дешевше (50 мікросхем замість 100).',
    secondaryTitle: 'Інженерний розрахунок',
    secondaryDesc: 'Оптимізація витрат ресурсів на облаштування позицій.'
  }
};

export const ProfileView: React.FC<ProfileViewProps> = ({ player, campCoords }) => {
  const skills = SPEC_SKILLS[player.specialization] || SPEC_SKILLS.scout;

  return (
    <div className="bg-[#101712] border border-[#233327] rounded-lg p-5 shadow-xl flex-1 flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-1/3 bg-[#131c15] border border-[#233527] rounded p-4 flex flex-col items-center text-center">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full border-2 border-emerald-500/60 bg-[#122417] flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)] mb-3">
            <span className="text-3xl">🪖</span>
          </div>

          <h2 className="text-lg font-bold text-slate-100 tracking-wide font-mono">
            {player.callsign || player.name}
          </h2>
          <div className="text-[11px] text-[#558261] font-mono mt-0.5">
            ПОЗИВНИЙ В ЕФІРІ
          </div>

          <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider mt-1.5">
            КЛАС:{' '}
            {player.specialization === 'scout'
              ? 'РОЗВІДНИК ПУСТОШІВ'
              : player.specialization === 'soldier'
              ? 'ШТУРМОВИК'
              : player.specialization === 'medic'
              ? 'ПОЛЬОВИЙ МЕДИК'
              : 'ТЕХНІК-ІНЖЕНЕР'}
          </div>
        </div>

        <div className="w-full mt-4 pt-3 border-t border-[#202f23] text-left text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-[#6d8574]">Громадянство:</span>
            <span className="font-semibold text-slate-200">{player.citizenship}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6d8574]">Макс. здоровʼя:</span>
            <span className="font-semibold text-emerald-400">{player.maxHp} HP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6d8574]">Досліджено секторів:</span>
            <span className="font-semibold text-slate-200">{player.exploredCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6d8574]">Залишок пошуків:</span>
            <span className="font-semibold text-emerald-400">{player.searchesLeft}/4</span>
          </div>
          <div className="flex flex-col pt-1 border-t border-[#1c291f]">
            <span className="text-[#6d8574]">GPS-координати Бази:</span>
            <span className="font-mono text-emerald-300 font-semibold text-[11px]">
              {campCoords.lat.toFixed(5)}° N, {campCoords.lng.toFixed(5)}° E
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider border-b border-[#233527] pb-2">
            Пасивні навички та спеціалізація
          </h3>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#131d16] p-3 rounded border border-[#223326]">
              <div className="font-bold text-emerald-300">{skills.primaryTitle}</div>
              <div className="text-[#7d9984] mt-1">{skills.primaryDesc}</div>
            </div>
            <div className="bg-[#131d16] p-3 rounded border border-[#223326]">
              <div className="font-bold text-yellow-300">{skills.secondaryTitle}</div>
              <div className="text-[#7d9984] mt-1">{skills.secondaryDesc}</div>
            </div>
          </div>

          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider border-b border-[#233527] pb-2 mt-6">
            Діючі стани виживання
          </h3>
          <div className="mt-3 space-y-2 text-xs">
            {player.conditions.length === 0 && (
              <div className="text-[#657d6b] italic">Немає активних статусних ефектів. Стан стабільний.</div>
            )}
            {player.conditions.includes('comfort') && (
              <div className="bg-[#132619] border border-emerald-600/50 p-2.5 rounded text-emerald-200">
                <b>🏠 Домашній затишок:</b> Відновлення сил у Базовому Таборі. Захищає від виснаження.
              </div>
            )}
            {player.conditions.includes('bleeding') && (
              <div className="bg-[#291111] border border-red-600/50 p-2.5 rounded text-red-200">
                <b>🩸 Глибока кровотеча:</b> Кожні 15 секунд знімає 2 HP та збільшує час будь-якого переходу вдвічі. Зупиняється бинтом.
              </div>
            )}
            {player.conditions.includes('radiation') && (
              <div className="bg-[#2b210e] border border-amber-600/50 p-2.5 rounded text-amber-200">
                <b>☣️ Променеве отруєння:</b> Викликає завади в радіоефірі та спотворює повідомлення. Потрібен «Астат-Блок».
              </div>
            )}
            {player.conditions.includes('zombified') && (
              <div className="bg-[#2d0f0f] border-2 border-red-600/80 p-3 rounded text-red-200 shadow-[0_0_15px_rgba(220,38,38,0.3)] space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-red-400">
                  💀 Зомбований (Країна походження: {player.citizenship})
                </div>
                <div className="text-[11px] text-red-300 leading-relaxed">
                  {player.aggressorReason || 'Держава визнана агресором або військовим пособником агресії проти України.'}
                </div>
                <div className="text-[10px] text-red-400 font-semibold pt-1 border-t border-red-900/60">
                  Незмивне клеймо. Штраф -80% до знайдених мікросхем. Лікуванню не підлягає.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};