import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Cpu } from 'lucide-react';
import type { Coordinates, Specialization } from '../types/game';

interface TerminalBootScreenProps {
  callsign: string;
  coords: Coordinates;
  specialization: Specialization;
  onBootComplete: () => void;
}

interface BootLogStep {
  text: string;
  delay: number;
  highlight?: boolean;
  isError?: boolean;
}

export const TerminalBootScreen: React.FC<TerminalBootScreenProps> = ({
  callsign,
  coords,
  specialization,
  onBootComplete
}) => {
  const [displayedLogs, setDisplayedLogs] = useState<BootLogStep[]>([]);
  const [progress, setProgress] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const roleTitleMap: Record<Specialization, string> = {
    scout: 'РОЗВІДНИК (+25% ШВИДКІСТЬ)',
    soldier: 'ШТУРМОВИК (+20% HP)',
    medic: 'ПОЛЬОВИЙ МЕДИК (АНТИРАД/ГЕМОСТАТ)',
    engineer: 'ТЕХНІК (-50% ВИТРАТИ)'
  };

  // Розширений список кроків із комфортними таймінгами для читання
  const bootSteps: BootLogStep[] = [
    { text: 'ASTAT-BIOS v2.8 (C) 2026 TACTICAL SYSTEMS CORP.', delay: 250 },
    { text: 'ПЕРЕВІРКА ЦІЛІСНОСТІ СЕГМЕНТІВ ПАМʼЯТІ: 64MB ROM... [OK]', delay: 1100 },
    { text: 'ІНІЦІАЛІЗАЦІЯ ШИНИ ДАНИХ КРЕМНІЄВИХ ПЛАТ ЛОГІКИ... [АКТИВНО]', delay: 2000 },
    { text: `ІДЕНТИФІКАЦІЯ ОПЕРАТОРА: "${callsign.toUpperCase()}" [ПРОФІЛЬ ПІДТВЕРДЖЕНО]`, delay: 3000, highlight: true },
    { text: `КЛАС СПЕЦІАЛІЗАЦІЇ: ${roleTitleMap[specialization]}`, delay: 4100 },

    // --- ФАЗА СУПУТНИКОВОГО ЗВ'ЯЗКУ (3 СПРОБИ З РЕАЛІСТИЧНИМИ ЗАТРИМКАМИ) ---
    { text: 'ЗАПИТ СУПУТНИКОВОГО КАНАЛУ [СПРОБА 1/3: ОРБІТАЛЬНИЙ KU-BAND]...', delay: 5400 },
    { text: 'ПОМИЛКА: ТАЙМАУТ ПАКЕТІВ SAT-LINK. ВІДПОВІДЬ ВІДСУТНЯ... [ERR 408]', delay: 7100, isError: true },
    { text: 'ЗАПИТ СУПУТНИКОВОГО КАНАЛУ [СПРОБА 2/3: РЕЗЕРВНИЙ ВІЙСЬКОВИЙ ШЛЮЗ]...', delay: 8500 },
    { text: 'ПОМИЛКА: ЩІЛЬНА АТМОСФЕРНА ІОНІЗАЦІЯ. СИГНАЛ ЗГАСУВ... [NO CARRIER]', delay: 10300, isError: true },
    { text: 'ЗАПИТ СУПУТНИКОВОГО КАНАЛУ [СПРОБА 3/3: АВАРІЙНИЙ МАЯК "ОРІОН"]...', delay: 11800 },
    { text: 'КРИТИЧНО: СУПУТНИКОВИЙ ЗВʼЯЗОК ВТРАЧЕНО. АКТИВАЦІЯ АВТОНОМНОГО РЕЖИМУ...', delay: 13700, isError: true, highlight: true },

    // --- НАЗЕМНЕ РОЗГОРТАННЯ КАРТИ ТА ДАТЧИКІВ ---
    { text: `ЗАХВАТ ГЕО-КООРДИНАТ: ${coords.lat.toFixed(5)}° N, ${coords.lng.toFixed(5)}° E... [ЗАФІКСОВАНО]`, delay: 15300, highlight: true },
    { text: 'КАЛІБРУВАННЯ РАДАРУ ТА ШАРУ ВИСОТ COPERNICUS DEM... [ГОТОВО]', delay: 16700 },
    { text: 'РОЗГОРТАННЯ ТАКТИЧНОЇ СІТКИ 5x5 (25 СЕКТОРІВ)... [100%]', delay: 18100 },
    { text: 'СИСТЕМИ СТАБІЛЬНІ. ЗАПУСК ОСНОВНОГО ТЕРМІНАЛА КАРТИ...', delay: 19500, highlight: true }
  ];

  // Автоскрол списку логів донизу з появою кожного нового рядка
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedLogs]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    bootSteps.forEach((step, index) => {
      const timeout = setTimeout(() => {
        setDisplayedLogs((prev) => [...prev, step]);
        setProgress(Math.round(((index + 1) / bootSteps.length) * 100));
      }, step.delay);
      timeouts.push(timeout);
    });

    // Завершення бутлоадера через 1.5 секунди після останнього рядка
    const finishTimeout = setTimeout(() => {
      setIsFinishing(true);
      setTimeout(() => {
        onBootComplete();
      }, 500);
    }, 21000);

    timeouts.push(finishTimeout);

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#050806] text-[#6fe38b] font-mono select-none flex flex-col justify-between p-4 md:p-8 transition-opacity duration-500 ${
        isFinishing ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
    >
      {/* Ефект CRT-сканування та сітки */}
      <div className="pointer-events-none fixed inset-0 z-10 opacity-30 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1)_0%,transparent_100%)]" />
      <div
        className="pointer-events-none fixed inset-0 z-10 opacity-15"
        style={{
          backgroundImage: 'linear-gradient(rgba(16, 255, 60, 0) 50%, rgba(0, 0, 0, 0.8) 50%)',
          backgroundSize: '100% 4px'
        }}
      />

      {/* Верхня службова плашка */}
      <div className="flex items-center justify-between border-b border-[#1f3a27] pb-3 text-xs z-20">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="tracking-widest uppercase font-bold text-slate-200">
            ASTAT_TERMINAL_BOOT_LOADER // 0x211A
          </span>
        </div>
        <button
          onClick={onBootComplete}
          className="text-[10px] text-[#52775c] hover:text-emerald-300 transition uppercase underline decoration-dashed"
        >
          [ПРОПУСТИТИ ІНІЦІАЛІЗАЦІЮ]
        </button>
      </div>

      {/* Центральний блок: лог термінала з автоскролом */}
      <div className="max-w-3xl w-full mx-auto my-auto space-y-2 text-xs md:text-sm z-20 overflow-hidden">
        <div className="p-4 md:p-6 bg-[#070e09]/95 border border-[#1b3824] rounded-lg shadow-2xl space-y-2.5 h-[380px] max-h-[55vh] overflow-y-auto flex flex-col justify-start no-scrollbar">
          {displayedLogs.map((log, idx) => {
            const isLast = idx === displayedLogs.length - 1;
            const isError = log.isError || log.text.includes('ПОМИЛКА') || log.text.includes('КРИТИЧНО');
            const isHighlight = log.highlight;

            return (
              <div
                key={idx}
                className={`flex items-start gap-2 leading-relaxed tracking-wide transition-colors duration-200 ${
                  isError
                    ? 'text-red-400 font-bold drop-shadow-[0_0_8px_rgba(248,113,113,0.45)]'
                    : isHighlight
                    ? 'text-emerald-300 font-bold'
                    : 'text-[#87aa90]'
                }`}
              >
                <span className={`select-none ${isError ? 'text-red-500 font-bold' : 'text-[#3b6645]'}`}>&gt;</span>
                <span>{log.text}</span>
                {isLast && (
                  <span
                    className={`inline-block w-2 h-4 animate-pulse ml-1 shrink-0 ${
                      isError ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]' : 'bg-emerald-400'
                    }`}
                  />
                )}
              </div>
            );
          })}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Нижній прогрес-бар калібрування */}
      <div className="max-w-3xl w-full mx-auto z-20 space-y-2">
        <div className="flex items-center justify-between text-xs text-[#628f6d]">
          <span className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            СИНХРОНІЗАЦІЯ ОБЧИСЛЮВАЛЬНИХ МОДУЛІВ...
          </span>
          <b className="text-emerald-300 text-sm font-bold">{progress}%</b>
        </div>

        <div className="w-full bg-[#0a140d] h-2 rounded-full overflow-hidden border border-[#21472c] p-0.5">
          <div
            className="bg-emerald-400 h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.9)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-[#4d6d56] pt-1">
          <span>МОДУЛЬ: TACTICAL_GRID_ENGINE</span>
          <span>РЕЖИМ: SECURE_LOCAL_BUS</span>
        </div>
      </div>
    </div>
  );
};