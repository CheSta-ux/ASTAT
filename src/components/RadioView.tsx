import React, { useState, useEffect, useMemo } from 'react';
import { Radio, Mic, MapPin, Send, AlertTriangle, Cpu, Lock, Clock } from 'lucide-react';
import type { PlayerStats, RadioMessage, Coordinates, InventoryItem } from '../types/game';

interface RadioViewProps {
  messages: RadioMessage[];
  player: PlayerStats;
  currentCoords: Coordinates;
  inventory: InventoryItem[];
  onSendMessage: (text: string, type: 'local' | 'frequency', target: string) => void;
}

export const RadioView: React.FC<RadioViewProps> = ({ messages, player, currentCoords, inventory, onSendMessage }) => {
  const [inputText, setInputText] = useState('');
  const [frequency, setFrequency] = useState('104.2');
  const [activeTab, setActiveTab] = useState<'frequency' | 'local'>('local');

  // Секундний тікер для автовидалення та оновлення таймера ефіру
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hasRadio = inventory.some((i) => i.id === 'radio_station' && i.count > 0);
  const currentSectorKey = `${currentCoords.lat.toFixed(3)}-${currentCoords.lng.toFixed(3)}`;

  // Фільтрація + автовидалення через 1 хвилину (60 000 мс) + сортування НОВИХ ВГОРУ
  const visibleMessages = useMemo(() => {
    return messages
      .filter((msg) => {
        // 1. Повідомлення живе рівно 60 секунд
        const msgTime = msg.createdAt || msg.id;
        const isAlive = now - msgTime < 60000;
        if (!isAlive) return false;

        // 2. Фільтр за контекстом (сектор або частота)
        if (activeTab === 'local') {
          return msg.type === 'local' && msg.target === currentSectorKey;
        }
        if (activeTab === 'frequency') {
          return msg.type === 'frequency' && msg.target === frequency;
        }
        return false;
      })
      // 3. Найновіші повідомлення завжди відображаються зверху
      .sort((a, b) => (b.createdAt || b.id) - (a.createdAt || a.id));
  }, [messages, activeTab, frequency, currentSectorKey, now]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (activeTab === 'frequency' && !hasRadio) return;

    onSendMessage(
      inputText.trim(),
      activeTab,
      activeTab === 'local' ? currentSectorKey : frequency
    );
    setInputText('');
  };

  return (
    <div className="bg-[#101712] border border-[#233327] rounded-lg p-3 sm:p-5 shadow-2xl flex flex-col h-[calc(100vh-210px)] min-h-[460px] max-h-[720px] overflow-hidden">
      
      {/* 1. ШАПКА РАДІОЕФІРУ (фіксована) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#233327] pb-3 mb-3 shrink-0">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
            <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" /> Термінал зв'язку
          </h2>
          <p className="text-[10px] sm:text-xs text-[#718a78] mt-0.5">
            Сигнал розсіюється через 60 секунд після виходу в ефір
          </p>
        </div>

        {/* Перемикач режимів зв'язку */}
        <div className="flex bg-[#0a110c] border border-[#1d2d21] p-1 rounded-lg shrink-0">
          <button
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition text-xs font-bold ${
              activeTab === 'local' ? 'bg-[#1b2b20] text-emerald-300 shadow' : 'text-[#617d68] hover:text-[#9bb8a3]'
            }`}
          >
            <Mic className="w-3.5 h-3.5" /> Локально (Крик)
          </button>
          <button
            onClick={() => setActiveTab('frequency')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition text-xs font-bold ${
              activeTab === 'frequency' ? 'bg-[#1b2b20] text-emerald-300 shadow' : 'text-[#617d68] hover:text-[#9bb8a3]'
            } ${!hasRadio ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!hasRadio}
            title={!hasRadio ? 'Потрібна Радіостанція Р-159' : ''}
          >
            <Radio className="w-3.5 h-3.5" /> FM Частота
            {!hasRadio && <Lock className="w-3 h-3 ml-1 text-[#465c4c]" />}
          </button>
        </div>
      </div>

      {/* 2. ПАНЕЛЬ НАЛАШТУВАННЯ ЧАСТОТИ (якщо є рація) */}
      {activeTab === 'frequency' && hasRadio && (
        <div className="mb-3 bg-[#0a120c] border border-[#1d2d21] p-2.5 rounded-lg flex items-center gap-3 shrink-0 animate-in fade-in">
          <div className="w-8 h-8 rounded bg-[#132418] border border-[#2d5939] flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1 flex items-center justify-between flex-wrap gap-2">
            <div className="text-[10px] text-[#63876d] font-bold uppercase tracking-wider">
              Військова радіостанція Р-159
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-300">Хвиля:</span>
              <input
                type="number"
                step="0.1"
                min="88.0"
                max="108.0"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-16 bg-[#16261a] border border-[#3b6d47] text-emerald-300 px-2 py-0.5 rounded text-xs outline-none font-mono font-bold"
              />
              <span className="text-[10px] text-[#718a78] font-mono">FM</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. ВІДСУТНІСТЬ РАДІОСТАНЦІЇ */}
      {activeTab === 'frequency' && !hasRadio && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-6 bg-[#0a110c]/50 rounded-lg border border-dashed border-[#1f2d22]">
          <AlertTriangle className="w-8 h-8 text-amber-500/50 mb-2" />
          <h3 className="text-sm font-bold text-[#8ba793] mb-1">Немає обладнання для виходу в ефір</h3>
          <p className="text-xs text-[#617d68] max-w-sm leading-relaxed">
            Без радіостанції Р-159 ви можете лише залишати повідомлення голосом у поточному секторі.
          </p>
        </div>
      )}

      {/* 4. ВІКНО ПОВІДОМЛЕНЬ */}
      {(activeTab === 'local' || hasRadio) && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-2 bg-[#090d0a] border border-[#1b261e] rounded-lg p-3 mb-3 space-y-2.5 radio-tactical-scroll">
          {/* Локальні стилі для тактичного скролбара */}
          <style>{`
            .radio-tactical-scroll::-webkit-scrollbar {
              width: 5px;
            }
            .radio-tactical-scroll::-webkit-scrollbar-track {
              background: #090d0a;
              border-radius: 4px;
            }
            .radio-tactical-scroll::-webkit-scrollbar-thumb {
              background: #1e3825;
              border-radius: 4px;
              border: 1px solid #132217;
            }
            .radio-tactical-scroll::-webkit-scrollbar-thumb:hover {
              background: #34633f;
            }
            .radio-tactical-scroll {
              scrollbar-width: thin;
              scrollbar-color: #1e3825 #090d0a;
            }
          `}</style>

          {visibleMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[11px] text-[#465c4c] font-mono italic">
              {activeTab === 'local'
                ? 'На цій локації тихо. Всі попередні крики розвіялися вітром...'
                : 'На цій частоті суцільний білий шум...'}
            </div>
          ) : (
            visibleMessages.map((msg) => {
              const msgTime = msg.createdAt || msg.id;
              const remainingSec = Math.max(1, Math.round((60000 - (now - msgTime)) / 1000));

              return (
                <div key={msg.id} className="animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-1 max-w-[92%] sm:max-w-[80%]">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-bold ${msg.sender === (player.callsign || player.name) ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {msg.sender}
                      </span>
                      <span className="text-[9px] text-[#567a5f] font-mono">{msg.time}</span>
                      {activeTab === 'local' && (
                        <span className="text-[8px] text-[#4d6352] px-1 rounded border border-[#253328] bg-[#0c140e]">
                          {msg.target}
                        </span>
                      )}
                    </div>

                    {/* Таймер згасання повідомлення */}
                    <span className="text-[8.5px] font-mono text-[#577a61] flex items-center gap-0.5" title="Час до зникнення сигналу">
                      <Clock className="w-2.5 h-2.5 text-emerald-400" /> {remainingSec}с
                    </span>
                  </div>

                  <div className="text-[11.5px] text-[#91a896] leading-relaxed break-words bg-[#131c15] p-2.5 rounded-lg border border-[#1d2d21] inline-block max-w-[92%] sm:max-w-[80%] shadow-sm">
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. ФОРМА ВІДПРАВКИ (жорстко зафіксована знизу) */}
      {(activeTab === 'local' || hasRadio) && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a6350]" />
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={activeTab === 'local' ? "Крикнути в поточному секторі (чутно 60с)..." : `Передати в ефір на ${frequency} FM...`}
              className="w-full bg-[#131c15] border border-[#2b4432] focus:border-emerald-500 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none font-mono placeholder:text-[#526b58]"
            />
          </div>
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="bg-[#1e3825] hover:bg-[#2b5135] disabled:bg-[#142117] disabled:text-[#465c4c] text-emerald-100 border border-[#3b6d47] px-3.5 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Передати</span>
          </button>
        </form>
      )}
    </div>
  );
};