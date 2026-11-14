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

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hasRadio = inventory.some((i) => i.id === 'radio_station' && i.count > 0);
  const currentSectorKey = `${currentCoords.lat.toFixed(3)}-${currentCoords.lng.toFixed(3)}`;

  const visibleMessages = useMemo(() => {
    return messages
      .filter((msg) => {
        const msgTime = msg.createdAt || msg.id;
        const isAlive = now - msgTime < 60000;
        if (!isAlive) return false;

        if (activeTab === 'local') {
          return msg.type === 'local' && msg.target === currentSectorKey;
        }
        if (activeTab === 'frequency') {
          return msg.type === 'frequency' && msg.target === frequency;
        }
        return false;
      })
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
    <div className="bg-[#101712] border border-[#233327] rounded-lg p-3.5 sm:p-5 shadow-2xl flex flex-col h-[calc(100dvh-185px)] md:h-[calc(100vh-210px)] min-h-[380px] max-h-[720px] overflow-hidden">
      
      {/* Шапка радіоефіру */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#233327] pb-3 mb-3 shrink-0">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
            <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            <span>Термінал зв'язку</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-[#91ab98] mt-0.5">
            Сигнал розсіюється через 60 секунд після виходу в ефір
          </p>
        </div>

        {/* Перемикач режимів зв'язку */}
        <div className="grid grid-cols-2 sm:flex bg-[#0a110c] border border-[#1d2d21] p-1 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-bold ${
              activeTab === 'local' ? 'bg-[#1b2b20] text-emerald-300 shadow' : 'text-[#7c9c84] hover:text-[#b4cfb9]'
            }`}
          >
            <Mic className="w-3.5 h-3.5 shrink-0" />
            <span>Локально (Крик)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('frequency')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition text-xs font-bold ${
              activeTab === 'frequency' ? 'bg-[#1b2b20] text-emerald-300 shadow' : 'text-[#7c9c84] hover:text-[#b4cfb9]'
            } ${!hasRadio ? 'opacity-55 cursor-not-allowed' : ''}`}
            disabled={!hasRadio}
            title={!hasRadio ? 'Потрібна Радіостанція Р-159' : ''}
          >
            <Radio className="w-3.5 h-3.5 shrink-0" />
            <span>FM Частота</span>
            {!hasRadio && <Lock className="w-3 h-3 ml-0.5 text-[#75917d] shrink-0" />}
          </button>
        </div>
      </div>

      {/* Панель налаштування частоти */}
      {activeTab === 'frequency' && hasRadio && (
        <div className="mb-3 bg-[#0a120c] border border-[#1d2d21] p-2.5 rounded-lg flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded bg-[#132418] border border-[#2d5939] flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1 flex items-center justify-between flex-wrap gap-2">
            <div className="text-[11px] text-[#83ad8e] font-bold uppercase tracking-wider">
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
              <span className="text-[11px] text-[#8ba692] font-mono">FM</span>
            </div>
          </div>
        </div>
      )}

      {/* Відсутність радіостанції */}
      {activeTab === 'frequency' && !hasRadio && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-6 bg-[#0a110c]/50 rounded-lg border border-dashed border-[#243628]">
          <AlertTriangle className="w-8 h-8 text-amber-500/70 mb-2" />
          <h3 className="text-sm font-bold text-[#a3bfaa] mb-1">Немає обладнання для виходу в ефір</h3>
          <p className="text-xs text-[#83a18b] max-w-sm leading-relaxed">
            Без радіостанції Р-159 ви можете лише залишати повідомлення голосом у поточному секторі.
          </p>
        </div>
      )}

      {/* Вікно повідомлень */}
      {(activeTab === 'local' || hasRadio) && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 bg-[#090d0a] border border-[#1d2b21] rounded-lg p-3 mb-3 space-y-3 radio-tactical-scroll">
          <style>{`
            .radio-tactical-scroll::-webkit-scrollbar {
              width: 5px;
            }
            .radio-tactical-scroll::-webkit-scrollbar-track {
              background: #090d0a;
              border-radius: 4px;
            }
            .radio-tactical-scroll::-webkit-scrollbar-thumb {
              background: #23422c;
              border-radius: 4px;
              border: 1px solid #132217;
            }
            .radio-tactical-scroll::-webkit-scrollbar-thumb:hover {
              background: #34633f;
            }
            .radio-tactical-scroll {
              scrollbar-width: thin;
              scrollbar-color: #23422c #090d0a;
            }
          `}</style>

          {visibleMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#73917b] font-mono italic text-center px-3">
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
                  <div className="flex items-center justify-between gap-2 mb-1 max-w-full sm:max-w-[85%]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-xs font-bold ${msg.sender === (player.callsign || player.name) ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {msg.sender}
                      </span>
                      <span className="text-[11px] text-[#7fa689] font-mono">{msg.time}</span>
                      {activeTab === 'local' && (
                        <span className="text-[10px] text-[#83a18a] px-1.5 py-0.2 rounded border border-[#2a3b2e] bg-[#0e1711]">
                          {msg.target}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-[#7fa689] flex items-center gap-1 shrink-0" title="Час до зникнення сигналу">
                      <Clock className="w-3 h-3 text-emerald-400" /> {remainingSec}с
                    </span>
                  </div>

                  <div className="text-xs text-[#b5cab9] leading-relaxed break-words bg-[#131c15] p-2.5 rounded-lg border border-[#223627] inline-block max-w-full sm:max-w-[85%] shadow-sm">
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Форма відправки */}
      {(activeTab === 'local' || hasRadio) && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-0">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6d9176]" />
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={activeTab === 'local' ? "Крикнути в секторі (чутно 60с)..." : `Передати на ${frequency} FM...`}
              className="w-full bg-[#131c15] border border-[#2f4d37] focus:border-emerald-500 text-slate-100 text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none font-mono placeholder:text-[#6f8c77]"
            />
          </div>
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="bg-[#1e3825] hover:bg-[#2b5135] disabled:bg-[#142117] disabled:text-[#637d6a] text-emerald-100 border border-[#3b6d47] px-3.5 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Передати</span>
          </button>
        </form>
      )}
    </div>
  );
};