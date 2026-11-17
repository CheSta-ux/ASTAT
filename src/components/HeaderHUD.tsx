import React, { useState, useEffect } from 'react';
import { 
  Heart, Flame, Shield, Sparkles, Coins, Copy, Check, 
  Activity, AlertTriangle, Bed, Utensils, Crosshair, X,
  Maximize2, Minimize2
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
  const [isAppFullscreen, setIsAppFullscreen] = useState(false);

  const isComfort = player.conditions.includes('comfort');
  const isBleeding = player.conditions.includes('bleeding');
  const isRadiation = player.conditions.includes('radiation');
  const isZombified = player.conditions.includes('zombified');

  useEffect(() => {
    const syncFullscreenState = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsAppFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
    };
  }, []);

  const toggleAppFullscreen = () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const rootEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    const isCurrentlyFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);

    try {
      if (!isCurrentlyFs) {
        if (rootEl.requestFullscreen) {
          rootEl.requestFullscreen().catch(() => {});
        } else if (rootEl.webkitRequestFullscreen) {
          rootEl.webkitRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        }
      }
    } catch {
      // Браузер не підтримує програмний Fullscreen API
    }
  };

  const handleCopyTicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(TOKEN_CONFIG.symbol);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hpPercent = Math.round((player.hp / player.maxHp) * 100);

  return (
    <>
      <header className="bg-[#0b120d]/95 border-b border-[#233a2a] px-3 sm:px-4 md:px-6 py-2.5 backdrop-blur-md sticky top-0 z-40 select-none shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
          
          {/* Верхній ряд: Логотип + Активні статуси + Повний екран застосунку */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded bg-[#132418] border border-[#2d5939] flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[#76b888] font-mono leading-none">
                  SURVIVAL V1.0
                </div>
                <div className="text-sm font-extrabold text-slate-100 tracking-wider flex items-center gap-1.5 leading-tight mt-0.5">
                  ASTAT
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-300">
                    TESTnet
                  </span>
                </div>
              </div>
            </div>

            {/* Статуси гравця та кнопка повноекранного режиму */}
            <div className="flex flex-wrap items-center justify-end gap-1 text-[10px] sm:text-[11px] font-mono">
              {isComfort && (
                <span className="bg-[#122417] text-emerald-300 border border-emerald-700/80 px-2 py-0.5 rounded flex items-center gap-1 whitespace-nowrap">
                  <Shield className="w-3 h-3 text-emerald-400 shrink-0" /> Затишок
                </span>
              )}
              {isBleeding && (
                <span className="bg-red-950/90 text-red-200 border border-red-600 px-2 py-0.5 rounded font-semibold animate-pulse whitespace-nowrap">
                  🩸 Кровотеча
                </span>
              )}
              {isRadiation && (
                <span className="bg-amber-950/90 text-amber-200 border border-amber-600 px-2 py-0.5 rounded font-semibold animate-pulse whitespace-nowrap">
                  ☣️ Радіація
                </span>
              )}
              {isZombified && (
                <span className="bg-red-900/95 text-red-100 border border-red-500 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                  Зомбований
                </span>
              )}

              <button
                type="button"
                onClick={toggleAppFullscreen}
                title={isAppFullscreen ? 'Вийти з повноекранного режиму' : 'Розгорнути застосунок на весь екран'}
                aria-label={isAppFullscreen ? 'Вийти з повноекранного режиму' : 'Розгорнути застосунок на весь екран'}
                className="bg-[#132619] hover:bg-[#1d3b27] active:scale-95 text-emerald-300 border border-emerald-600/80 px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap transition shadow-sm cursor-pointer ml-0.5"
              >
                {isAppFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="hidden md:inline text-[10px] font-bold">Згорнути</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="hidden md:inline text-[10px] font-bold">Весь екран</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Індикатори показників */}
          <div className="grid grid-cols-3 sm:flex items-center gap-2 sm:gap-2.5 font-mono">
            {/* 1. ЗДОРОВ'Я */}
            <div
              onClick={() => setActivePopup('hp')}
              className="flex items-center justify-center sm:justify-start gap-2 bg-[#121c15] hover:bg-[#1a2b20] active:scale-95 border border-[#294030] px-2.5 py-1.5 rounded cursor-pointer transition"
            >
              <Heart className={`w-4 h-4 shrink-0 ${isBleeding ? 'text-red-500 animate-pulse' : 'text-red-400'}`} />
              <div className="text-[10px] text-[#8fa896] leading-tight text-left">
                <span className="hidden sm:inline">ЗДОРОВ'Я</span>
                <span className="sm:hidden">HP</span>
                <div className="text-xs font-bold text-slate-100 whitespace-nowrap">
                  {player.hp}<span className="text-[10px] text-[#7a9481]">/{player.maxHp}</span>
                </div>
              </div>
            </div>

            {/* 2. СИТІСТЬ */}
            <div
              onClick={() => setActivePopup('hunger')}
              className="flex items-center justify-center sm:justify-start gap-2 bg-[#121c15] hover:bg-[#1a2b20] active:scale-95 border border-[#294030] px-2.5 py-1.5 rounded cursor-pointer transition"
            >
              <Flame className={`w-4 h-4 shrink-0 ${player.hunger < 20 ? 'text-amber-500 animate-bounce' : 'text-amber-400'}`} />
              <div className="text-[10px] text-[#8fa896] leading-tight text-left">
                <span className="hidden sm:inline">СИТІСТЬ</span>
                <span className="sm:hidden">ЇЖА</span>
                <div className="text-xs font-bold text-slate-100 whitespace-nowrap">
                  {player.hunger}%
                </div>
              </div>
            </div>

            {/* 3. ТОКЕНИ ($AST211) */}
            <div
              onClick={() => setActivePopup('token')}
              className="flex items-center justify-center sm:justify-start gap-2 bg-[#172318] hover:bg-[#1f3323] active:scale-95 border border-[#3b6d47] px-2.5 py-1.5 rounded cursor-pointer transition"
            >
              <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-[10px] text-[#9ebda6] leading-tight text-left">
                <div className="text-[9px] font-bold text-amber-300 leading-none mb-0.5">
                  {TOKEN_CONFIG.status}
                </div>
                <div className="text-xs font-bold text-emerald-300 whitespace-nowrap">
                  {tokenBalance.toFixed(0)} <span className="text-[10px] text-[#79ab87]">{TOKEN_CONFIG.symbol}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* Модальне вікно підказок */}
      {activePopup && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200"
          onClick={() => setActivePopup(null)}
        >
          <div 
            className="bg-[#0e1611] border border-[#2b5936] rounded-xl p-4 sm:p-5 max-w-sm w-full shadow-2xl relative font-mono text-xs animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActivePopup(null)}
              aria-label="Закрити"
              className="absolute top-3 right-3 text-[#7a9e85] hover:text-white p-1.5 rounded hover:bg-[#16271c] transition"
            >
              <X className="w-4 h-4" />
            </button>

            {activePopup === 'hp' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#1f3826] pb-2.5 pr-6">
                  <Activity className="w-5 h-5 text-red-400 shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">Біометричний стан (HP)</h3>
                    <div className="text-[11px] text-[#8ba893]">Життєздатність організму</div>
                  </div>
                </div>

                <div className="space-y-2 bg-[#09100b] p-3 rounded border border-[#1d2d21] text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#87a68f]">Поточний рівень:</span>
                    <b className="text-slate-100">{player.hp} з {player.maxHp} HP ({hpPercent}%)</b>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#87a68f]">Критична межа:</span>
                    <span className="text-red-400 font-bold text-right">&lt; 20 HP (ризик непритомності)</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#87a68f]">Бонус класу:</span>
                    <span className="text-emerald-400">{player.specialization === 'soldier' ? '+20% макс. HP' : 'Базовий'}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs pt-1 text-[#a3b8a8]">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <Bed className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><b>Сон у таборі:</b> повне відновлення здоров'я.</span>
                  </div>
                  <div className="flex items-center gap-2 text-amber-300">
                    <Crosshair className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><b>Гемостатичний бинт:</b> зупиняє кровотечу (+20 HP).</span>
                  </div>
                </div>
              </div>
            )}

            {activePopup === 'hunger' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#2b2417] pb-2.5 pr-6">
                  <Flame className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">Метаболізм та Енергія</h3>
                    <div className="text-[11px] text-[#8ba893]">Запас калорій оператора</div>
                  </div>
                </div>

                <div className="space-y-2 bg-[#09100b] p-3 rounded border border-[#1d2d21] text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#87a68f]">Поточний рівень:</span>
                    <b className="text-amber-300">{player.hunger}% з {player.maxHunger}%</b>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#87a68f]">Витрата на огляд:</span>
                    <span className="text-amber-400 font-bold">-4% за кожний пошук</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#87a68f]">Витрата на марш:</span>
                    <span className="text-slate-200">~1–2% за 100 метрів шляху</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs pt-1 text-[#a3b8a8]">
                  <div className="flex items-center gap-2 text-amber-300">
                    <Utensils className="w-4 h-4 text-amber-400 shrink-0" />
                    <span><b>Харчування:</b> армійський сухпай (+35%), гриби (+18%).</span>
                  </div>
                  <div className="flex items-center gap-2 text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span><b>Виснаження:</b> при 0% голоду починає падати HP.</span>
                  </div>
                </div>
              </div>
            )}

            {activePopup === 'token' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#1e3827] pb-2.5 pr-6">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <h3 className="font-bold text-emerald-300 text-sm">{TOKEN_CONFIG.name}</h3>
                      <div className="text-[11px] text-[#8ba893]">Нативний крипто-актив</div>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyTicker}
                    className="text-[11px] text-[#8eb89b] hover:text-white flex items-center gap-1 bg-[#132418] px-2.5 py-1 rounded border border-[#2b5936] shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'OK' : 'Тікер'}
                  </button>
                </div>

                <p className="text-xs text-[#a3b8a8] leading-relaxed">
                  {TOKEN_CONFIG.desc}
                </p>

                <div className="space-y-2 bg-[#09100b] p-3 rounded border border-[#1d2d21] text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#87a68f]">Статус випуску:</span>
                    <span className="text-amber-400 font-bold">Очікує TGE / Airdrop</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#87a68f]">Поточний баланс:</span>
                    <b className="text-emerald-300">{tokenBalance.toFixed(TOKEN_CONFIG.decimals)} {TOKEN_CONFIG.symbol}</b>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#87a68f]">Мережа:</span>
                    <span className="text-slate-200">SPL / ERC-20 (Dev)</span>
                  </div>
                </div>

                <div className="text-[11px] text-[#7c9984] text-center italic pt-1">
                  * Накопичення токенів почнеться після підключення Web3-контракту.
                </div>
              </div>
            )}

            <button
              onClick={() => setActivePopup(null)}
              className="w-full mt-3.5 py-2.5 bg-[#172b1d] hover:bg-[#223d2b] border border-[#2c5236] text-emerald-300 text-xs font-bold rounded transition"
            >
              Закрити
            </button>
          </div>
        </div>
      )}
    </>
  );
};