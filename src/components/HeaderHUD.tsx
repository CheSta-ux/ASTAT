import React, { useState } from 'react';
import { 
  Heart, Flame, Shield, Sparkles, Coins, Copy, Check, 
  Activity, AlertTriangle, Bed, Utensils, Crosshair, X 
} from 'lucide-react';
import type { PlayerStats } from '../types/game';
import { TOKEN_CONFIG } from '../constants/token';

interface HeaderHUDProps {
  player: PlayerStats;
  tokenBalance?: number;
}

export const HeaderHUD: React.FC<HeaderHUDProps> = ({ player, tokenBalance = 0 }) => {
  const [activePopup, setActivePopup] = useState<'token' | 'hp' | 'hunger' | null>(null);
  const [copied, setCopied] = useState(false);

  const isComfort = player.conditions.includes('comfort');
  const isBleeding = player.conditions.includes('bleeding');
  const isRadiation = player.conditions.includes('radiation');
  const isZombified = player.conditions.includes('zombified');

  const handleCopyTicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(TOKEN_CONFIG.symbol);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hpPercent = Math.round((player.hp / player.maxHp) * 100);

  return (
    <>
      <header className="bg-[#0b120d]/95 border-b border-[#1f3325] px-2.5 sm:px-4 md:px-6 py-2 backdrop-blur-md sticky top-0 z-40 select-none shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
          
          {/* Верхній ряд для мобільних: Логотип + Статуси */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-[#132418] border border-[#2d5939] flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <div className="text-[8px] sm:text-[9px] uppercase tracking-widest text-[#5ca36f] font-mono leading-none">
                  SURVIVAL V1.0
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-slate-100 tracking-wider flex items-center gap-1.5 leading-tight">
                  ASTAT
                  <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-emerald-950 border border-emerald-600 text-emerald-300">
                    TESTnet
                  </span>
                </div>
              </div>
            </div>

            {/* Статуси гравця */}
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-mono">
              {isComfort && (
                <span className="bg-[#122417] text-emerald-300 border border-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-400" /> Затишок
                </span>
              )}
              {isBleeding && (
                <span className="bg-red-950/80 text-red-300 border border-red-700 px-1.5 py-0.5 rounded animate-pulse">
                  Кровотеча
                </span>
              )}
              {isRadiation && (
                <span className="bg-amber-950/80 text-amber-300 border border-amber-700 px-1.5 py-0.5 rounded animate-pulse">
                  Радіація
                </span>
              )}
              {isZombified && (
                <span className="bg-red-900/90 text-red-100 border border-red-500 px-1.5 py-0.5 rounded font-bold">
                  Зомбований
                </span>
              )}
            </div>
          </div>

          {/* Індикатори показників: рівномірний розподіл на мобільних */}
          <div className="grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-2.5 font-mono">
            {/* 1. ЗДОРОВ'Я */}
            <div
              onClick={() => setActivePopup('hp')}
              className="flex items-center justify-center sm:justify-start gap-1.5 bg-[#121c15] hover:bg-[#1a2b20] active:scale-95 border border-[#243729] px-2 py-1 rounded cursor-pointer transition"
            >
              <Heart className={`w-3.5 h-3.5 shrink-0 ${isBleeding ? 'text-red-500 animate-ping' : 'text-red-400'}`} />
              <div className="text-[9px] text-[#718a78] leading-tight text-left">
                <span className="hidden sm:inline">ЗДОРОВ'Я</span>
                <span className="sm:hidden">HP</span>
                <div className="text-[11px] sm:text-xs font-bold text-slate-100">
                  {player.hp}<span className="text-[9px] text-[#556e5a]">/{player.maxHp}</span>
                </div>
              </div>
            </div>

            {/* 2. СИТІСТЬ */}
            <div
              onClick={() => setActivePopup('hunger')}
              className="flex items-center justify-center sm:justify-start gap-1.5 bg-[#121c15] hover:bg-[#1a2b20] active:scale-95 border border-[#243729] px-2 py-1 rounded cursor-pointer transition"
            >
              <Flame className={`w-3.5 h-3.5 shrink-0 ${player.hunger < 20 ? 'text-amber-500 animate-bounce' : 'text-amber-400'}`} />
              <div className="text-[9px] text-[#718a78] leading-tight text-left">
                <span className="hidden sm:inline">СИТІСТЬ</span>
                <span className="sm:hidden">ЇЖА</span>
                <div className="text-[11px] sm:text-xs font-bold text-slate-100">
                  {player.hunger}%
                </div>
              </div>
            </div>

            {/* 3. ТОКЕНИ ($AST211) */}
            <div
              onClick={() => setActivePopup('token')}
              className="flex items-center justify-center sm:justify-start gap-1.5 bg-[#172318] hover:bg-[#1f3323] active:scale-95 border border-[#3b6d47] px-2 py-1 rounded cursor-pointer transition"
            >
              <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="text-[9px] text-[#86a890] leading-tight text-left">
                <div className="text-[7.5px] sm:text-[9px] font-bold text-amber-300">
                  {TOKEN_CONFIG.status}
                </div>
                <div className="text-[11px] sm:text-xs font-bold text-emerald-300">
                  {tokenBalance.toFixed(0)} <span className="text-[8px] text-[#558261]">{TOKEN_CONFIG.symbol}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* ================= ЦЕНТРАЛЬНЕ МОДАЛЬНЕ ВІКНО ПІДКАЗОК З ЗАТЕМНЕННЯМ ================= */}
      {activePopup && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200"
          onClick={() => setActivePopup(null)}
        >
          <div 
            className="bg-[#0e1611] border border-[#2b5936] rounded-xl p-4 sm:p-5 max-w-sm w-full shadow-2xl relative font-mono text-xs animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Кнопка закриття */}
            <button
              onClick={() => setActivePopup(null)}
              className="absolute top-3 right-3 text-[#587a63] hover:text-white p-1 rounded hover:bg-[#16271c] transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* ВМІСТ 1: ЗДОРОВ'Я */}
            {activePopup === 'hp' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#1f3826] pb-2 pr-6">
                  <Activity className="w-5 h-5 text-red-400" />
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">Біометричний стан (HP)</h3>
                    <div className="text-[10px] text-[#718f79]">Життєздатність організму</div>
                  </div>
                </div>

                <div className="space-y-2 bg-[#09100b] p-3 rounded border border-[#1d2d21] text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[#64846c]">Поточний рівень:</span>
                    <b className="text-slate-100">{player.hp} з {player.maxHp} HP ({hpPercent}%)</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64846c]">Критична межа:</span>
                    <span className="text-red-400 font-bold">&lt; 20 HP (небезпека втрати свідомості)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64846c]">Бонус класу:</span>
                    <span className="text-emerald-400">{player.specialization === 'soldier' ? '+20% макс. HP' : 'Базовий'}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] pt-1 text-[#8ba391]">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <Bed className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span><b>Сон у таборі:</b> повне відновлення здоров'я.</span>
                  </div>
                  <div className="flex items-center gap-2 text-amber-300">
                    <Crosshair className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span><b>Гемостатичний бинт:</b> зупиняє кровотечу (+20 HP).</span>
                  </div>
                </div>
              </div>
            )}

            {/* ВМІСТ 2: СИТІСТЬ */}
            {activePopup === 'hunger' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#2b2417] pb-2 pr-6">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">Метаболізм та Енергія</h3>
                    <div className="text-[10px] text-[#718f79]">Запас калорій оператора</div>
                  </div>
                </div>

                <div className="space-y-2 bg-[#09100b] p-3 rounded border border-[#1d2d21] text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[#64846c]">Поточний рівень:</span>
                    <b className="text-amber-300">{player.hunger}% з {player.maxHunger}%</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64846c]">Витрата на огляд:</span>
                    <span className="text-amber-400 font-bold">-4% за кожний пошук</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64846c]">Витрата на марш:</span>
                    <span className="text-slate-200">~1–2% за 100 метрів шляху</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] pt-1 text-[#8ba391]">
                  <div className="flex items-center gap-2 text-amber-300">
                    <Utensils className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span><b>Харчування:</b> армійський сухпай (+35%), тушонка (+25%).</span>
                  </div>
                  <div className="flex items-center gap-2 text-red-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span><b>Виснаження:</b> при 0% голоду починає падати HP.</span>
                  </div>
                </div>
              </div>
            )}

            {/* ВМІСТ 3: ТОКЕНИ */}
            {activePopup === 'token' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#1e3827] pb-2 pr-6">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="font-bold text-emerald-300 text-sm">{TOKEN_CONFIG.name}</h3>
                      <div className="text-[10px] text-[#718f79]">Нативний крипто-актив</div>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyTicker}
                    className="text-[10px] text-[#71997d] hover:text-white flex items-center gap-1 bg-[#132418] px-2 py-1 rounded border border-[#2b5936]"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'OK' : 'Тікер'}
                  </button>
                </div>

                <p className="text-[11px] text-[#91a896] leading-relaxed">
                  {TOKEN_CONFIG.desc}
                </p>

                <div className="space-y-1.5 bg-[#09100b] p-3 rounded border border-[#1d2d21] text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[#64846c]">Статус випуску:</span>
                    <span className="text-amber-400 font-bold">Очікує TGE / Airdrop</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64846c]">Поточний баланс:</span>
                    <b className="text-emerald-300">{tokenBalance.toFixed(TOKEN_CONFIG.decimals)} {TOKEN_CONFIG.symbol}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64846c]">Мережа:</span>
                    <span className="text-slate-200">SPL / ERC-20 (Dev)</span>
                  </div>
                </div>

                <div className="text-[10px] text-[#5f7a67] text-center italic pt-1">
                  * Накопичення токенів почнеться після підключення Web3-контракту.
                </div>
              </div>
            )}

            <button
              onClick={() => setActivePopup(null)}
              className="w-full mt-3 py-2 bg-[#172b1d] hover:bg-[#223d2b] border border-[#2c5236] text-emerald-300 text-xs font-bold rounded transition"
            >
              Закрити
            </button>
          </div>
        </div>
      )}
    </>
  );
};