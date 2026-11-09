import './App.css';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Compass, Backpack, Radio, Crosshair, Footprints, AlertTriangle } from 'lucide-react';

import type { Coordinates, ExpeditionState, InventoryItem, PlayerStats, RadioMessage, TabType } from './types/game';
import { calculateRealisticTravelTime, calculateHaversineDistanceMeters } from './utils/coordinates';
import { createSectorData } from './utils/sectorGenerator';
import { useGameLoop } from './hooks/useGameLoop';
import { 
  loadSectorSearchHistory, 
  saveSectorSearchHistory, 
  getSectorSearchStatus, 
  getSectorKey, 
  formatCooldownTimer,
  SectorSearchRecord 
} from './utils/sectorCooldownManager';
import { TerminalBootScreen } from './components/TerminalBootScreen';
import { getRandomLoot, INITIAL_AWAKENING_INVENTORY } from './constants/lootDictionary';

import { HeaderHUD } from './components/HeaderHUD';
import { MapView } from './components/MapView';
import { InventoryView } from './components/InventoryView';
import { RadioView } from './components/RadioView';
import { ProfileView } from './components/ProfileView';
import { AfkModal } from './components/AfkModal';
import { OnboardingModal } from './components/OnboardingModal';
import { supabase } from './lib/supabase';

const DEFAULT_COORDS: Coordinates = {
  x: 0,
  y: 0,
  lat: 51.4082,
  lng: 30.0631
};

interface GameToast {
  id: number;
  msg: string;
  type: 'info' | 'warn' | 'danger' | 'success';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const [showAfkModal, setShowAfkModal] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isBooting, setIsBooting] = useState(false);

  // Стек Push-сповіщень
  const [notifications, setNotifications] = useState<GameToast[]>([]);

  const [sectorSearches, setSectorSearches] = useState<Record<string, SectorSearchRecord>>(loadSectorSearchHistory);

  // Гравець
  const [player, setPlayer] = useState<PlayerStats>({
    name: 'Виживший-33',
    callsign: 'Привид Полісся',
    citizenship: 'Україна 🇺🇦',
    specialization: 'scout',
    hp: 85,
    maxHp: 100,
    hunger: 72,
    maxHunger: 100,
    astatCoins: 0,
    searchesLeft: 4,
    conditions: ['comfort'],
    exploredCount: 0
  });

  const [coords, setCoords] = useState<Coordinates>(DEFAULT_COORDS);
  const [campCoords, setCampCoords] = useState<Coordinates>(DEFAULT_COORDS);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [expedition, setExpedition] = useState<ExpeditionState | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_AWAKENING_INVENTORY);

  const [radioMessages, setRadioMessages] = useState<RadioMessage[]>([
    { id: 1, createdAt: Date.now(), sender: 'Маяк-База', time: '11:42', text: 'Усім групам: викид стабілізувався, вихід на сектори Півночі дозволено.', type: 'frequency', target: '104.2' },
    { id: 2, createdAt: Date.now(), sender: 'Штаб Оборони', time: '12:05', text: 'Увага! У зоні радіусом 5 км фіксуються аномальні сплески сполук Астату.', type: 'frequency', target: '104.2' },
    { id: 3, createdAt: Date.now(), sender: 'Бродяга_99', time: '11:58', text: 'Хто біля закинутого порту? Залишив схрон під іржавим краном.', type: 'local', target: '51.408-30.063' }
  ]);

  // Захисний реф від дублювання однакових сповіщень
  const lastNotificationRef = useRef<{ msg: string; time: number }>({ msg: '', time: 0 });

  const notify = useCallback((msg: string, type: 'info' | 'warn' | 'danger' | 'success' = 'info') => {
    const now = Date.now();
    if (lastNotificationRef.current.msg === msg && now - lastNotificationRef.current.time < 1500) {
      return;
    }
    lastNotificationRef.current = { msg, time: now };

    const id = now + Math.random();
    setNotifications((prev) => [...prev.slice(-2), { id, msg, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4500);
  }, []);

  // --- СИНХРОНІЗАЦІЯ СТАНУ З SUPABASE ---
  const syncGameState = useCallback(async (
    overridePlayer?: PlayerStats,
    overrideInventory?: InventoryItem[],
    overrideCoords?: Coordinates,
    overrideCamp?: Coordinates
  ) => {
    const localPlayerId = localStorage.getItem('astat_player_id');
    if (!localPlayerId) return;

    const curPlayer = overridePlayer || player;
    const curInv = overrideInventory || inventory;
    const curCoords = overrideCoords || coords;
    const curCamp = overrideCamp || campCoords;

    const payload: any = {
      id: localPlayerId,
      callsign: curPlayer.callsign || curPlayer.name,
      citizenship: curPlayer.citizenship,
      specialization: curPlayer.specialization,
      hp: curPlayer.hp,
      hunger: curPlayer.hunger,
      microchips: curPlayer.astatCoins,
      lat: curCoords.lat,
      lng: curCoords.lng,
      camp_lat: curCamp.lat,
      camp_lng: curCamp.lng,
      conditions: curPlayer.conditions,
      inventory: curInv,
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('players').upsert(payload);
      if (error) {
        // Якщо колонки inventory ще немає у схемі Supabase, зберігаємо без неї
        if (error.message?.includes('inventory') || error.code === 'PGRST204') {
          delete payload.inventory;
          await supabase.from('players').upsert(payload);
        } else {
          console.warn('Supabase sync warning:', error.message);
        }
      }
    } catch (err) {
      console.warn('Network sync error:', err);
    }
  }, [player, inventory, coords, campCoords]);

  // --- ВІДНОВЛЕННЯ ДАНИХ ПРИ ЗАПУСКУ / F5 ---
  useEffect(() => {
    const localPlayerId = localStorage.getItem('astat_player_id');
    if (!localPlayerId) return;

    supabase
      .from('players')
      .select('*')
      .eq('id', localPlayerId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
          setPlayer((prev) => ({
            ...prev,
            name: data.callsign || 'Виживший',
            callsign: data.callsign || 'Виживший',
            citizenship: data.citizenship || 'Україна 🇺🇦',
            specialization: data.specialization || 'scout',
            hp: data.hp ?? 100,
            maxHp: 100,
            hunger: data.hunger ?? 100,
            maxHunger: 100,
            astatCoins: data.microchips ?? 0,
            searchesLeft: 4,
            conditions: data.conditions || ['comfort'],
            exploredCount: 0
          }));

          if (data.lat && data.lng) {
            setCoords({ x: 0, y: 0, lat: data.lat, lng: data.lng });
          }
          if (data.camp_lat && data.camp_lng) {
            setCampCoords({ x: 0, y: 0, lat: data.camp_lat, lng: data.camp_lng });
          }
          if (data.inventory && Array.isArray(data.inventory) && data.inventory.length > 0) {
            setInventory(data.inventory);
          }
          setHasCompletedOnboarding(true);
        }
      });
  }, []);

  // Періодичне автозбереження кожні 20 секунд
  useEffect(() => {
    if (!hasCompletedOnboarding) return;
    const interval = setInterval(() => {
      syncGameState();
    }, 20000);
    return () => clearInterval(interval);
  }, [hasCompletedOnboarding, syncGameState]);

  // Завантаження радіоефіру та Realtime
  useEffect(() => {
    supabase
      .from('radio_messages')
      .select('*')
      .order('id', { ascending: false })
      .limit(40)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const formatted: RadioMessage[] = data.map((m: any) => ({
            id: m.id,
            createdAt: new Date(m.created_at).getTime(),
            sender: m.sender,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: m.text,
            type: m.type as 'local' | 'frequency',
            target: m.target
          }));
          setRadioMessages(formatted);
        }
      });

    const channel = supabase
      .channel('public:radio_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'radio_messages' },
        (payload) => {
          const newMsg = payload.new;
          setRadioMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [
              {
                id: newMsg.id,
                createdAt: new Date(newMsg.created_at).getTime(),
                sender: newMsg.sender,
                time: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                text: newMsg.text,
                type: newMsg.type,
                target: newMsg.target
              },
              ...prev
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Очищення локальних повідомлень, старіших за 60 секунд
  useEffect(() => {
    const timer = setInterval(() => {
      const cutoff = Date.now() - 60000;
      setRadioMessages((prev) => prev.filter((m) => (m.createdAt || m.id) > cutoff));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const spendMicrochips = (amount: number) => {
    const nextCoins = Math.max(0, player.astatCoins - amount);
    const nextPlayer: PlayerStats = { ...player, astatCoins: nextCoins };
    setPlayer(nextPlayer);
    syncGameState(nextPlayer);
  };

  const handleExpeditionComplete = (expData: any) => {
    const destCoords: Coordinates = expData.targetCoords || {
      x: expData.targetX,
      y: expData.targetY,
      lat: coords.lat,
      lng: coords.lng
    };

    const distFromCamp = calculateHaversineDistanceMeters(destCoords.lat, destCoords.lng, campCoords.lat, campCoords.lng);
    const isAtCamp = distFromCamp < 50;

    const destSector = createSectorData(destCoords.lat, destCoords.lng, false, false, isAtCamp);
    const searchStatus = getSectorSearchStatus(destCoords.lat, destCoords.lng, sectorSearches);

    setCoords(destCoords);
    setSelectedTarget(null);
    setExpedition(null);

    let updatedPlayer: PlayerStats = { ...player };

    setPlayer((prev) => {
      let newHp = prev.hp;
      const newHunger = Math.max(0, prev.hunger - expData.hungerCost);
      let conditions = [...prev.conditions];

      if (prev.hunger < expData.hungerCost) {
        const penalty = (expData.hungerCost - prev.hunger) * 2;
        newHp = Math.max(5, newHp - penalty);
      }

      if (destSector.radHazard > 0.3 && Math.random() < destSector.radHazard) {
        if (!conditions.includes('radiation')) conditions.push('radiation');
      }

      if (distFromCamp >= 50) {
        conditions = conditions.filter((c) => c !== 'comfort');
      }

      updatedPlayer = {
        ...prev,
        hp: newHp,
        hunger: newHunger,
        searchesLeft: searchStatus.searchesLeft,
        conditions,
        exploredCount: prev.exploredCount + 1
      };
      return updatedPlayer;
    });

    syncGameState(updatedPlayer, undefined, destCoords);

    if (searchStatus.isDepleted) {
      notify(`Сектор: ${destSector.name}. Ресурси вичерпано (24г)!`, 'warn');
    } else {
      notify(`Прибуття: ${destSector.name} (Пошуків: ${searchStatus.searchesLeft}/4)`, 'success');
    }
  };

  useGameLoop({
    expedition,
    setExpedition,
    onExpeditionComplete: handleExpeditionComplete,
    player,
    setPlayer
  });

  const handleStartExpedition = (targetCoordObj: Coordinates) => {
    if (expedition) {
      notify('Ви вже перебуваєте в дорозі!', 'warn');
      return;
    }

    const distMeters = calculateHaversineDistanceMeters(coords.lat, coords.lng, targetCoordObj.lat, targetCoordObj.lng);
    if (distMeters < 50) {
      notify('Ви вже знаходитесь у цій точці.', 'warn');
      return;
    }

    const estimates = calculateRealisticTravelTime(coords, targetCoordObj, player.conditions, player.specialization);

    if (player.hunger < estimates.hungerCost && player.hunger < 15) {
      notify('Критичне виснаження! Поїжте перед марш-кидком.', 'danger');
      return;
    }

    setExpedition({
      targetX: Math.round(targetCoordObj.lng * 1000),
      targetY: Math.round(targetCoordObj.lat * 1000),
      targetCoords: targetCoordObj,
      totalDuration: estimates.seconds,
      remaining: estimates.seconds,
      hungerCost: estimates.hungerCost,
      isMinimized: false
    } as any);

    notify(`Марш розпочато: ${estimates.meters}м. Час: ${estimates.seconds}с`, 'info');
  };

  const handleSearch = () => {
    const distToCamp = calculateHaversineDistanceMeters(coords.lat, coords.lng, campCoords.lat, campCoords.lng);
    if (distToCamp < 50) {
      notify('У межах Табору всі ресурси вже зібрані.', 'warn');
      return;
    }

    const searchStatus = getSectorSearchStatus(coords.lat, coords.lng, sectorSearches);
    if (searchStatus.isDepleted) {
      notify(`Сектор виснажено! Доступно через: ${formatCooldownTimer(searchStatus.cooldownRemainingMs)}.`, 'warn');
      return;
    }

    if (player.hunger < 4) {
      notify('Занадто слабкі від голоду для обстеження місцевості.', 'danger');
      return;
    }

    const nextSearchesLeft = searchStatus.searchesLeft - 1;
    const sectorKey = getSectorKey(coords.lat, coords.lng);

    const updatedHistory: Record<string, SectorSearchRecord> = {
      ...sectorSearches,
      [sectorKey]: {
        searchesLeft: nextSearchesLeft,
        lastSearchedAt: Date.now()
      }
    };

    setSectorSearches(updatedHistory);
    saveSectorSearchHistory(updatedHistory);

    const nextHunger = Math.max(0, player.hunger - 4);
    let nextPlayer = { ...player, searchesLeft: nextSearchesLeft, hunger: nextHunger };
    let nextInventory = [...inventory];

    // Єдиний чесний розподіл подій обшуку:
    // 60% — знахідка луту з бази Supabase
    // 20% — поранення / пастка
    // 20% — сектор порожній
    const roll = Math.random();

    if (roll < 0.60) {
      const foundItem = getRandomLoot();

      // Якщо з бази Supabase випала мікросхема — поповнюємо числовий баланс
      if (foundItem.id === 'microchip') {
        const chipsCount = foundItem.count || 1;
        nextPlayer.astatCoins += chipsCount;
        notify(`📟 Знайдено кремнієву плату: +${chipsCount} мікросхему!`, 'success');
      } 
      // Фізичні предмети додаємо в інвентар
      else {
        const idx = nextInventory.findIndex((i) => i.id === foundItem.id);
        if (idx >= 0) {
          nextInventory[idx] = { ...nextInventory[idx], count: nextInventory[idx].count + foundItem.count };
        } else {
          nextInventory.push(foundItem);
        }

        const itemIcon =
          foundItem.type === 'food' ? '📦' : 
          foundItem.type.startsWith('medical') ? '🩹' : 
          foundItem.type === 'junk' ? '🗑️' : 
          foundItem.type === 'rare' ? '✨' : '⚙️';

        const notifyType = foundItem.type === 'junk' ? 'info' : 'success';
        notify(`${itemIcon} Знайдено: ${foundItem.name} (+${foundItem.count})`, notifyType);
      }
    } else if (roll < 0.80) {
      nextPlayer.hp = Math.max(10, player.hp - 18);
      if (!nextPlayer.conditions.includes('bleeding')) {
        nextPlayer.conditions = [...nextPlayer.conditions, 'bleeding'];
      }
      notify('🩸 Пастка! Отримано 18 шкоди та кровотечу!', 'danger');
    } else {
      notify('Ретельний огляд нічого не дав, лише іржа та порожнеча.', 'info');
    }

    setPlayer(nextPlayer);
    setInventory(nextInventory);
    syncGameState(nextPlayer, nextInventory);

    if (nextSearchesLeft === 0) {
      notify(`Сектор зачищено! Блокування повторного огляду на 24 години.`, 'warn');
    }
  };

  const handleRest = () => {
    const distToCamp = calculateHaversineDistanceMeters(coords.lat, coords.lng, campCoords.lat, campCoords.lng);
    if (distToCamp >= 50) {
      notify('Повноцінний відпочинок можливий лише в Таборі.', 'warn');
      return;
    }

    const updatedConditions = player.conditions
      .filter((c) => c === 'zombified' || c === 'comfort')
      .concat(player.conditions.includes('comfort') ? [] : ['comfort']);

    const updatedPlayer: PlayerStats = {
      ...player,
      hp: player.maxHp,
      hunger: Math.min(player.maxHunger, player.hunger + 20),
      conditions: updatedConditions
    };

    setPlayer(updatedPlayer);
    notify('Ви поспали біля вогнища. Здоров’я та сили відновлено!', 'success');
    syncGameState(updatedPlayer);
  };

  const handleRelocateCamp = () => {
    const distToCamp = calculateHaversineDistanceMeters(coords.lat, coords.lng, campCoords.lat, campCoords.lng);
    if (distToCamp < 50) {
      notify('Табір уже розбитий тут.', 'info');
      return;
    }
    if (player.astatCoins < 100) {
      notify('Для перенесення потрібно 100 мікросхем!', 'danger');
      return;
    }

    spendMicrochips(100);
    setCampCoords({ ...coords });
    notify(`Табір перенесено на нові GPS: ${coords.lat.toFixed(5)}° N! (-100 мікросхем)`, 'success');
    syncGameState(undefined, undefined, undefined, coords);
  };

  const handleUseItem = (item: InventoryItem) => {
    if (item.count <= 0) return;

    let updatedPlayer = { ...player };

    if (item.type === 'food') {
      updatedPlayer.hunger = Math.min(player.maxHunger, player.hunger + item.value);
      notify(`Вжито ${item.name}. Ситість +${item.value}%`, 'success');
    } else if (item.type === 'medical_bleed') {
      updatedPlayer.hp = Math.min(player.maxHp, player.hp + item.value);
      updatedPlayer.conditions = player.conditions.filter((c) => c !== 'bleeding');
      notify(`Бинт накладено. Кровотечу зупинено, +${item.value} HP.`, 'success');
    } else if (item.type === 'medical_rad') {
      updatedPlayer.conditions = player.conditions.filter((c) => c !== 'radiation');
      notify('Антирад нейтралізував радіацію!', 'success');
    }

    const nextInventory = inventory
      .map((i) => (i.id === item.id ? { ...i, count: i.count - 1 } : i))
      .filter((i) => i.count > 0);

    setPlayer(updatedPlayer);
    setInventory(nextInventory);
    syncGameState(updatedPlayer, nextInventory);
  };

  const handleSendMessage = async (text: string, type: 'local' | 'frequency', target: string) => {
    let msg = text;
    if (player.conditions.includes('radiation')) {
      msg = msg
        .split('')
        .map((ch) => (Math.random() > 0.45 ? ['...', 'кхрр', 'шшш', '⚡', '~~'][Math.floor(Math.random() * 5)] : ch))
        .join('');
    }

    const senderName = player.callsign || player.name;

    try {
      const { error } = await supabase.from('radio_messages').insert({
        sender: senderName,
        text: msg,
        type: type || 'local',
        target: target
      });
      if (error) throw error;
    } catch (err) {
      console.warn('Помилка відправки в ефір:', err);
      notify('Помилка передачі сигналу в ефір', 'danger');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d0b] text-[#c6d1c8] font-mono selection:bg-[#2b5936] selection:text-white relative overflow-hidden flex flex-col justify-between">
      <div className="pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_100%)] opacity-80" />
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(18, 255, 50, 0) 50%, rgba(0, 0, 0, 0.7) 50%)',
          backgroundSize: '100% 4px'
        }}
      />

      {/* Каскадний стек тактичних Push-сповіщень */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-1.5 pointer-events-none max-w-[92vw] w-auto">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`px-3.5 py-2 rounded border shadow-2xl flex items-center gap-2 text-xs md:text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
              n.type === 'danger'
                ? 'bg-[#260f0f]/95 border-red-500 text-red-200'
                : n.type === 'warn'
                ? 'bg-[#291e0a]/95 border-amber-500 text-amber-200'
                : n.type === 'success'
                ? 'bg-[#0f2918]/95 border-emerald-500 text-emerald-200'
                : 'bg-[#141b16]/95 border-[#3b5e43] text-[#cfdcce]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold">{n.msg}</span>
          </div>
        ))}
      </div>

      <HeaderHUD player={player} />

      {/* Верхній банер ходу */}
      {expedition && activeTab !== 'map' && (
        <div className="bg-[#142318] border-b border-[#2b5936] px-3 py-2 text-xs z-30">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Footprints className="w-4 h-4 text-emerald-400 animate-bounce" />
              <div>
                <span className="text-emerald-300 font-semibold">
                  Триває марш на точку {(expedition as any).targetCoords ? `${(expedition as any).targetCoords.lat.toFixed(4)}° N, ${(expedition as any).targetCoords.lng.toFixed(4)}° E` : ''}
                </span>
                <span className="text-[#8ba792] ml-2">Залишилось: {expedition.remaining}с</span>
              </div>
            </div>
            <div className="flex-1 max-w-xs mx-4 bg-[#0a110c] h-2 rounded-full overflow-hidden border border-[#223d29]">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${((expedition.totalDuration - expedition.remaining) / expedition.totalDuration) * 100}%` }}
              />
            </div>
            <button
              onClick={() => setShowAfkModal(true)}
              className="px-2 py-1 bg-[#1a3321] hover:bg-[#25492f] border border-[#3b6b46] rounded text-[10px] text-emerald-200"
            >
              Диспетчер ходу
            </button>
          </div>
        </div>
      )}

      {/* Головний контейнер термінала */}
      <main className="max-w-7xl mx-auto w-full p-3 md:p-5 flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-1.5 border-b border-[#243328] pb-2 overflow-x-auto no-scrollbar text-xs">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 px-3 py-2 rounded font-semibold whitespace-nowrap shrink-0 transition ${
              activeTab === 'map' ? 'bg-[#1b2b20] text-emerald-300 border border-[#3b6645]' : 'text-[#7d9984] hover:text-[#c4d6c7]'
            }`}
          >
            <Compass className="w-4 h-4 shrink-0" /> Карта та сектор
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

        {activeTab === 'map' && (
          <MapView
            coords={coords}
            campCoords={campCoords}
            player={player}
            expedition={expedition}
            selectedTarget={selectedTarget}
            setSelectedTarget={setSelectedTarget}
            onStartExpedition={handleStartExpedition}
            onSearch={handleSearch}
            onRest={handleRest}
            onRelocateCamp={handleRelocateCamp}
            sectorSearches={sectorSearches}
            onOpenAfkModal={() => setShowAfkModal(true)}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryView inventory={inventory} coins={player.astatCoins} onUseItem={handleUseItem} />
        )}
        {activeTab === 'radio' && (
          <RadioView 
            messages={radioMessages} 
            player={player} 
            currentCoords={coords} 
            inventory={inventory}
            onSendMessage={handleSendMessage} 
          />
        )}
        {activeTab === 'profile' && <ProfileView player={player} campCoords={campCoords} />}
      </main>

      {showAfkModal && expedition && <AfkModal expedition={expedition} onClose={() => setShowAfkModal(false)} />}

      {!hasCompletedOnboarding && (
        <OnboardingModal
          onNotify={notify}
          onComplete={async (data) => {
            const isWater = Boolean(data.isWaterSpawn);

            const updatedPlayer: PlayerStats = {
              ...player,
              name: data.callsign,
              callsign: data.callsign,
              citizenship: data.citizenship,
              specialization: data.specialization,
              aggressorReason: data.aggressorReason,
              astatCoins: 0,
              hp: isWater ? 35 : player.hp,
              hunger: isWater ? 25 : player.hunger,
              conditions: data.isZombified 
                ? Array.from(new Set([...player.conditions, 'zombified'])) 
                : player.conditions
            };

            const initialInv = [...INITIAL_AWAKENING_INVENTORY];

            setPlayer(updatedPlayer);
            setCoords(data.startCoords);
            setCampCoords(data.startCoords);
            setInventory(initialInv);

            setHasCompletedOnboarding(true);
            setIsBooting(true);

            // Первинне збереження профілю та предметів у Supabase
            try {
              let localPlayerId = localStorage.getItem('astat_player_id');
              if (!localPlayerId) {
                localPlayerId = crypto.randomUUID();
                localStorage.setItem('astat_player_id', localPlayerId);
              }

              await supabase.from('players').upsert({
                id: localPlayerId,
                callsign: data.callsign,
                citizenship: data.citizenship,
                specialization: data.specialization,
                hp: updatedPlayer.hp,
                hunger: updatedPlayer.hunger,
                microchips: 0,
                lat: data.startCoords.lat,
                lng: data.startCoords.lng,
                camp_lat: data.startCoords.lat,
                camp_lng: data.startCoords.lng,
                conditions: updatedPlayer.conditions,
                inventory: initialInv,
                updated_at: new Date().toISOString()
              });
            } catch (err) {
              console.warn('Не вдалося зберегти гравця в Supabase:', err);
            }

            if (isWater) {
              notify(`🌊 ДЕСАНТУВАННЯ У ВОДУ! Штраф: -50 HP, ситість 25%!`, 'danger');
            }
            if (data.isZombified) {
              notify(`⚠️ Громадянство країни-агресора: отримано постійну мітку "Зомбований" (-80% мікросхем)!`, 'danger');
            }
          }}
        />
      )}

      {/* Екран тактичної ініціалізації та запуску терміналу */}
      {isBooting && (
        <TerminalBootScreen
          callsign={player.callsign}
          coords={coords}
          specialization={player.specialization}
          onBootComplete={() => {
            setIsBooting(false);
            notify('📡 Тактичний термінал запущено. Карта секторів активна.', 'success');
          }}
        />
      )}

      <footer className="border-t border-[#1d2720] bg-[#0c120e] px-4 py-2 text-[10px] text-[#556b5b] flex flex-wrap items-center justify-between gap-2">
        <div>ASTAT HYBRID RPG ENGINE • ПОЛІССЯ-АНТИМАТЕРІЯ • УКРАЇНСЬКА ЛОКАЛІЗАЦІЯ</div>
        <div className="flex items-center gap-3">
          <span>GPS: {coords.lat.toFixed(5)}° N, {coords.lng.toFixed(5)}° E</span>
          <span>Статус зв'язку: АКТИВНИЙ</span>
        </div>
      </footer>
    </div>
  );
}