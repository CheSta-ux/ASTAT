import './App.css';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Compass, Backpack, Radio, Crosshair, Footprints, AlertTriangle, Skull, Lock } from 'lucide-react';

import type { Coordinates, ExpeditionState, InventoryItem, PlayerCondition, PlayerStats, RadioMessage, TabType } from './types/game';
import { calculateRealisticTravelTime, calculateHaversineDistanceMeters, offsetGeoBySectors } from './utils/coordinates';
import { createSectorData } from './utils/sectorGenerator';
import { detectGridWater, getCachedSectorTerrain } from './utils/waterDetectorService';
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

const ACTIVE_EXPEDITION_KEY = 'astat_active_expedition_v1';

const saveActiveExpedition = (exp: ExpeditionState | null) => {
  try {
    if (exp) {
      localStorage.setItem(ACTIVE_EXPEDITION_KEY, JSON.stringify(exp));
    } else {
      localStorage.removeItem(ACTIVE_EXPEDITION_KEY);
    }
  } catch {
    // ігноруємо помилки localStorage
  }
};

const loadActiveExpedition = (): ExpeditionState | null => {
  try {
    const raw = localStorage.getItem(ACTIVE_EXPEDITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExpeditionState;
    return parsed && typeof parsed.endsAt === 'number' ? parsed : null;
  } catch {
    return null;
  }
};

interface GameToast {
  id: number;
  msg: string;
  type: 'info' | 'warn' | 'danger' | 'success';
}

const getSurroundingSectorKeys = (lat: number, lng: number): string[] => {
  const keys: string[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const geo = offsetGeoBySectors(lat, lng, dx, dy);
      keys.push(`${geo.lat.toFixed(5)}-${geo.lng.toFixed(5)}`);
    }
  }
  return keys;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const [showAfkModal, setShowAfkModal] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isBooting, setIsBooting] = useState(false);

  const [notifications, setNotifications] = useState<GameToast[]>([]);
  const [sectorSearches, setSectorSearches] = useState<Record<string, SectorSearchRecord>>(loadSectorSearchHistory);
  const [exploredSectors, setExploredSectors] = useState<string[]>([]);

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

  const syncGameState = useCallback(async (
    overridePlayer?: PlayerStats,
    overrideInventory?: InventoryItem[],
    overrideCoords?: Coordinates,
    overrideCamp?: Coordinates,
    overrideExplored?: string[]
  ) => {
    const localPlayerId = localStorage.getItem('astat_player_id');
    if (!localPlayerId) return;

    const curPlayer = overridePlayer || player;
    const curInv = overrideInventory || inventory;
    const curCoords = overrideCoords || coords;
    const curCamp = overrideCamp || campCoords;
    const curExplored = overrideExplored || exploredSectors;

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
      explored_sectors: curExplored,
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('players').upsert(payload);
      if (error) {
        if (error.message?.includes('explored_sectors')) {
          delete payload.explored_sectors;
          await supabase.from('players').upsert(payload);
        } else {
          console.warn('Supabase sync warning:', error.message);
        }
      }
    } catch (err) {
      console.warn('Network sync error:', err);
    }
  }, [player, inventory, coords, campCoords, exploredSectors]);

  useEffect(() => {
    const localPlayerId = localStorage.getItem('astat_player_id');
    if (!localPlayerId) return;

    supabase
      .from('players')
      .select('*')
      .eq('id', localPlayerId)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!error && data) {
          const loadedSpec = data.specialization || 'scout';
          const computedMaxHp = loadedSpec === 'soldier' ? 120 : 100;

          if (data.inventory && Array.isArray(data.inventory) && data.inventory.length > 0) {
            setInventory(data.inventory);
          }

          const baseCoords: Coordinates =
            data.lat && data.lng ? { x: 0, y: 0, lat: data.lat, lng: data.lng } : DEFAULT_COORDS;
          const baseCamp: Coordinates =
            data.camp_lat && data.camp_lng ? { x: 0, y: 0, lat: data.camp_lat, lng: data.camp_lng } : DEFAULT_COORDS;
          let baseExplored: string[] =
            Array.isArray(data.explored_sectors) && data.explored_sectors.length > 0
              ? data.explored_sectors
              : getSurroundingSectorKeys(baseCoords.lat, baseCoords.lng);

          setCampCoords(baseCamp);

          let finalCoords = baseCoords;
          let finalHp = Math.min(computedMaxHp, data.hp ?? computedMaxHp);
          let finalHunger = data.hunger ?? 100;
          let finalConditions = data.conditions || ['comfort'];

          const savedExp = loadActiveExpedition();
          if (savedExp && savedExp.endsAt) {
            const remainingSec = Math.ceil((savedExp.endsAt - Date.now()) / 1000);

            if (remainingSec > 0) {
              // Марш ще триває — відновлюємо таймер із точним залишком часу
              setExpedition({ ...savedExp, remaining: remainingSec });
            } else {
              // Марш завершився, поки браузер був закритий — фіксуємо прибуття
              saveActiveExpedition(null);
              const destCoords: Coordinates = savedExp.targetCoords || {
                x: savedExp.targetX,
                y: savedExp.targetY,
                lat: baseCoords.lat,
                lng: baseCoords.lng
              };
              const distFromCamp = calculateHaversineDistanceMeters(
                destCoords.lat,
                destCoords.lng,
                baseCamp.lat,
                baseCamp.lng
              );
              const isAtCamp = distFromCamp < 50;
              const destSector =
                savedExp.targetSectorData ||
                createSectorData(destCoords.lat, destCoords.lng, false, false, isAtCamp);

              const newlyRevealed = getSurroundingSectorKeys(destCoords.lat, destCoords.lng);
              baseExplored = Array.from(new Set([...baseExplored, ...newlyRevealed]));
              finalCoords = destCoords;

              finalHunger = Math.max(0, finalHunger - savedExp.hungerCost);
              if ((data.hunger ?? 100) < savedExp.hungerCost) {
                finalHp = Math.max(5, finalHp - (savedExp.hungerCost - (data.hunger ?? 100)) * 2);
              }
              if (distFromCamp >= 50) {
                finalConditions = finalConditions.filter((c: string) => c !== 'comfort');
              }
              if (destSector.radHazard > 0.3 && Math.random() < destSector.radHazard && !finalConditions.includes('radiation')) {
                finalConditions = [...finalConditions, 'radiation'];
              }

              setExpedition(null);
              notify(`🏁 Марш завершено під час вашої відсутності! Прибуття: ${destSector.name}`, 'success');

              // Одразу фіксуємо прибуття в Supabase
              supabase
                .from('players')
                .update({
                  lat: finalCoords.lat,
                  lng: finalCoords.lng,
                  hp: finalHp,
                  hunger: finalHunger,
                  conditions: finalConditions,
                  explored_sectors: baseExplored,
                  updated_at: new Date().toISOString()
                })
                .eq('id', localPlayerId)
                .then(() => {});
            }
          }

          setCoords(finalCoords);
          setExploredSectors(baseExplored);
          setPlayer((prev) => ({
            ...prev,
            name: data.callsign || 'Виживший',
            callsign: data.callsign || 'Виживший',
            citizenship: data.citizenship || 'Україна 🇺🇦',
            specialization: loadedSpec,
            hp: finalHp,
            maxHp: computedMaxHp,
            hunger: finalHunger,
            maxHunger: 100,
            astatCoins: data.microchips ?? 0,
            searchesLeft: 4,
            conditions: finalConditions,
            exploredCount: baseExplored.length
          }));

          setHasCompletedOnboarding(true);
        }
      });
  }, []);

  useEffect(() => {
    if (!hasCompletedOnboarding) return;
    const interval = setInterval(() => {
      syncGameState();
    }, 20000);
    return () => clearInterval(interval);
  }, [hasCompletedOnboarding, syncGameState]);

  // Жива синхронізація гравця з Supabase (Realtime)
  useEffect(() => {
    const localPlayerId = localStorage.getItem('astat_player_id');
    if (!localPlayerId) return;

    const channel = supabase
      .channel(`player-realtime-${localPlayerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `id=eq.${localPlayerId}`
        },
        (payload) => {
          const data = payload.new;
          if (!data) return;

          setPlayer((prev) => ({
            ...prev,
            hp: data.hp ?? prev.hp,
            hunger: data.hunger ?? prev.hunger,
            astatCoins: data.microchips ?? prev.astatCoins,
            conditions: data.conditions || prev.conditions,
            specialization: data.specialization || prev.specialization,
            callsign: data.callsign || prev.callsign
          }));

          if (data.inventory && Array.isArray(data.inventory)) {
            setInventory(data.inventory);
          }
          if (data.explored_sectors && Array.isArray(data.explored_sectors)) {
            setExploredSectors(data.explored_sectors);
          }
          if (data.camp_lat && data.camp_lng) {
            setCampCoords({ x: 0, y: 0, lat: data.camp_lat, lng: data.camp_lng });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  // Стан непритомності
  const isUnconscious = player.hp <= 0 || player.conditions.includes('unconscious');

  // Автоперемикання з заблокованої карти на рюкзак при втраті свідомості
  useEffect(() => {
    if (isUnconscious && activeTab === 'map') {
      setActiveTab('inventory');
    }
  }, [isUnconscious, activeTab]);

  // Дія 1: Гукати про допомогу в радіоефір (SOS)
  // Стан кулдауну для крику про допомогу (60 секунд)
  const [sosCooldown, setSosCooldown] = useState<number>(0);

  // Таймер зворотного відліку кожну секунду
  useEffect(() => {
    if (sosCooldown <= 0) return;
    const interval = setInterval(() => {
      setSosCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [sosCooldown]);

  // Дія 1: Гукати про допомогу (тільки крик гравця з кулдауном 1 хв)
  const handleCallForHelp = async () => {
    if (sosCooldown > 0) {
      notify(`Зв'язки перенапружені! Зачекайте ще ${sosCooldown} с перед наступним криком.`, 'warn');
      return;
    }

    const coordsStr = `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°`;
    const localSectorTarget = `${coords.lat.toFixed(3)}-${coords.lng.toFixed(3)}`;

    const screamText = `🚨 [КРИК ПРО ДОПОМОГУ]: "Я поранений в секторі ${coordsStr}! Допоможіть хто-небудь!"`;

    // Просто відправляємо в базу, Realtime миттєво підхопить і виведе його на екран 1 раз
    await handleSendMessage(screamText, 'local', localSectorTarget);

    // Запуск обмеження на 60 секунд
    setSosCooldown(60);

    notify('📢 Крик про допомогу рознісся сектором! (Кулдаун: 60с)', 'warn');
    setActiveTab('radio');
  };

  // Дія 2: Здатись (миттєва загибель)
  const handleSurrender = () => {
    const lostItemsCount = inventory.reduce((sum, item) => sum + item.count, 0);

    const respawnCoords = { ...campCoords };
    setCoords(respawnCoords);
    setSelectedTarget(null);
    setExpedition(null);
    saveActiveExpedition(null);
    setInventory([]); // Речі залишаються на секторі

    const respawnMaxHp = player.specialization === 'soldier' ? 120 : 100;
    const respawnHp = player.specialization === 'soldier' ? 72 : 60;
    const preservedConditions: PlayerCondition[] = player.conditions.includes('zombified')
      ? ['comfort', 'zombified']
      : ['comfort'];

    const respawnedPlayer: PlayerStats = {
      ...player,
      hp: respawnHp,
      maxHp: respawnMaxHp,
      hunger: 60,
      astatCoins: 0,
      conditions: preservedConditions
    };

    setPlayer(respawnedPlayer);
    syncGameState(respawnedPlayer, [], respawnCoords);

    notify(
      `💀 Ви здалися та загинули. ${lostItemsCount} предметів спорядження залишилося на секторі.`,
      'danger'
    );
    setActiveTab('map');
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

    const cachedDestTerrain = getCachedSectorTerrain(destCoords.lat, destCoords.lng);
    const destSector =
      (expData as any).targetSectorData ||
      createSectorData(
        destCoords.lat,
        destCoords.lng,
        Boolean(cachedDestTerrain?.isWater && cachedDestTerrain?.biome === 'water'),
        Boolean(cachedDestTerrain?.isCoast),
        isAtCamp,
        cachedDestTerrain?.biome
      );
    const searchStatus = getSectorSearchStatus(destCoords.lat, destCoords.lng, sectorSearches);

    setCoords(destCoords);
    setSelectedTarget(null);
    setExpedition(null);
    saveActiveExpedition(null);

    const newRevealed = getSurroundingSectorKeys(destCoords.lat, destCoords.lng);
    const nextExplored = Array.from(new Set([...exploredSectors, ...newRevealed]));
    setExploredSectors(nextExplored);

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
        exploredCount: nextExplored.length
      };
      return updatedPlayer;
    });

    syncGameState(updatedPlayer, undefined, destCoords, undefined, nextExplored);

    if (searchStatus.isDepleted) {
      notify(`Сектор: ${destSector.name}. Ресурси вичерпано (24г)!`, 'warn');
    } else {
      notify(`Прибуття: ${destSector.name} (Розкрито нові сектори!)`, 'success');
    }
  };

  useGameLoop({
    expedition,
    setExpedition,
    onExpeditionComplete: handleExpeditionComplete,
    player,
    setPlayer,
    onNotify: notify
  });

  const handleStartExpedition = (targetCoordObj: Coordinates) => {
    if (isUnconscious) {
      notify('Ви без свідомості! Пересування неможливе.', 'danger');
      return;
    }

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

    const endsAt = Date.now() + estimates.seconds * 1000;
    const nextExpedition: ExpeditionState = {
      targetX: Math.round(targetCoordObj.lng * 1000),
      targetY: Math.round(targetCoordObj.lat * 1000),
      targetCoords: targetCoordObj,
      targetSectorData: (targetCoordObj as any).targetSectorData,
      totalDuration: estimates.seconds,
      remaining: estimates.seconds,
      endsAt,
      hungerCost: estimates.hungerCost,
      isMinimized: false
    };

    setExpedition(nextExpedition);
    saveActiveExpedition(nextExpedition);

    const timeLabel =
      estimates.seconds >= 60
        ? `${Math.floor(estimates.seconds / 60)} хв ${estimates.seconds % 60} с`
        : `${estimates.seconds} с`;
    notify(`Марш розпочато: ${estimates.meters}м. Час: ${timeLabel}`, 'info');
  };

  const handleSearch = async () => {
    if (isUnconscious) {
      notify('Ви без свідомості! Обстеження неможливе.', 'danger');
      return;
    }

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

    const roll = Math.random();

    // 1. УСПІШНИЙ ПОШУК (55% шанс)
    if (roll < 0.55) {
      // Беремо реальний біом із кешу або визначаємо його по тайлах мапи
      const cached = getCachedSectorTerrain(coords.lat, coords.lng);
      const terrain =
        cached ||
        (await detectGridWater([{ lat: coords.lat, lng: coords.lng, key: sectorKey }]))[sectorKey];

      const isDeepWater = Boolean(terrain?.isWater && terrain?.biome === 'water');
      const currentSector = createSectorData(
        coords.lat,
        coords.lng,
        isDeepWater,
        Boolean(terrain?.isCoast),
        false,
        terrain?.biome
      );
      const sectorBiome = terrain?.biome || currentSector.icon || currentSector.id || 'forest';

      // Отримуємо лут, логічно прив'язаний до поточної місцевості
      const foundItem = getRandomLoot(sectorBiome, currentSector.name);

      if (foundItem.id === 'microchip') {
        const rawChips = foundItem.count || 1;
        const isZombified = nextPlayer.conditions.includes('zombified');

        if (isZombified && Math.random() >= 0.2) {
          notify('💀 Знайдено пошкоджену мікросхему — через клеймо «Зомбований» (-80%) плата непридатна!', 'warn');
        } else {
          const finalChips = isZombified ? Math.max(1, Math.floor(rawChips * 0.2)) : rawChips;
          nextPlayer.astatCoins += finalChips;
          notify(`📟 Знайдено кремнієву плату: +${finalChips} мікросхему!`, 'success');
        }
      } else {
        const idx = nextInventory.findIndex((i) => i.id === foundItem.id);
        if (idx >= 0) {
          nextInventory[idx] = { ...nextInventory[idx], count: nextInventory[idx].count + (foundItem.count || 1) };
        } else {
          nextInventory.push({ ...foundItem, count: foundItem.count || 1 });
        }

        // Тематична іконка для сповіщення
        const itemIcon =
          (foundItem as any).category === 'nature' ? '🌿' :
          foundItem.type === 'food' ? '🍏' : 
          foundItem.type.startsWith('medical') ? '🩹' : 
          foundItem.type === 'junk' ? '🗑️' : 
          foundItem.type === 'rare' ? '✨' : '⚙️';

        const notifyType = foundItem.type === 'junk' ? 'info' : 'success';
        notify(`${itemIcon} Знайдено: ${foundItem.name} (+${foundItem.count || 1})`, notifyType);
      }
    } else if (roll < 0.80) {
      const trapDamage = player.specialization === 'soldier' ? 12 : 18;
      const nextHp = Math.max(0, player.hp - trapDamage);
      nextPlayer.hp = nextHp;

      if (!nextPlayer.conditions.includes('bleeding')) {
        nextPlayer.conditions = [...nextPlayer.conditions, 'bleeding'];
      }

      if (nextHp <= 0) {
        if (!nextPlayer.conditions.includes('unconscious')) {
          nextPlayer.conditions = [...nextPlayer.conditions, 'unconscious'];
        }
        notify(
          '💀 Ви впали без свідомості, все що в вас лишається це гукати на допомогу або спробувати підлікуватись самостійно',
          'danger'
        );
        setActiveTab('inventory');
      } else {
        notify('🩸 Пастка! Отримано 18 шкоди та кровотечу!', 'danger');
      }
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
    const relocateCost = player.specialization === 'engineer' ? 50 : 100;
    if (player.astatCoins < relocateCost) {
      notify(`Для перенесення потрібно ${relocateCost} мікросхем!`, 'danger');
      return;
    }

    spendMicrochips(relocateCost);
    setCampCoords({ ...coords });
    notify(`Табір перенесено на нові GPS: ${coords.lat.toFixed(5)}° N! (-${relocateCost} мікросхем)`, 'success');
    syncGameState(undefined, undefined, undefined, coords);
  };

  const handleUseItem = (item: InventoryItem) => {
    if (item.count <= 0) return;

    let updatedPlayer = { ...player };

    if (item.type === 'food') {
      updatedPlayer.hunger = Math.min(player.maxHunger, player.hunger + item.value);
      notify(`Вжито ${item.name}. Ситість +${item.value}%`, 'success');
    } else if (item.type === 'medical_bleed' || item.type.startsWith('medical')) {
      const baseHeal = item.value || 20;
      const healAmount = player.specialization === 'medic' ? Math.round(baseHeal * 1.5) : baseHeal;
      const nextHp = Math.min(player.maxHp, player.hp + healAmount);
      updatedPlayer.hp = nextHp;

      updatedPlayer.conditions = player.conditions.filter((c) => c !== 'bleeding' && c !== 'unconscious');

      if (player.hp <= 0 && nextHp > 0) {
        notify(`✨ Бинт накладено. Ви опритомніли! HP: +${healAmount}. Карта знову доступна.`, 'success');
      } else {
        notify(`Бинт накладено. Кровотечу зупинено, +${healAmount} HP.`, 'success');
      }
    } else if (item.type === 'medical_rad') {
      updatedPlayer.conditions = player.conditions.filter((c) => c !== 'radiation');
      if (player.specialization === 'medic') {
        updatedPlayer.hp = Math.min(player.maxHp, player.hp + 15);
        notify('Антирад нейтралізував радіацію! Бонус медика: +15 HP.', 'success');
      } else {
        notify('Антирад нейтралізував радіацію!', 'success');
      }
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
    <div className="min-h-screen bg-[#0a0d0b] text-[#d3ded5] font-mono selection:bg-[#2b5936] selection:text-white relative overflow-x-hidden flex flex-col justify-between pb-24 md:pb-0">
      <div className="pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_100%)] opacity-80" />
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(18, 255, 50, 0) 50%, rgba(0, 0, 0, 0.7) 50%)',
          backgroundSize: '100% 4px'
        }}
      />

      {/* Push-сповіщення */}
      <div className="fixed top-[68px] sm:top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-1.5 pointer-events-none max-w-[94vw] w-auto">
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

      {/* Банер маршу в дорозі */}
      {expedition && activeTab !== 'map' && (
        <div className="bg-[#142318] border-b border-[#2b5936] px-3 py-2.5 text-xs z-30">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Footprints className="w-4 h-4 text-emerald-400 animate-bounce shrink-0" />
                <span className="text-emerald-300 font-semibold truncate">
                  Марш на {(expedition as any).targetCoords ? `${(expedition as any).targetCoords.lat.toFixed(4)}° N, ${(expedition as any).targetCoords.lng.toFixed(4)}° E` : 'точку'}
                </span>
              </div>
              <span className="text-[#a3c2ab] font-mono font-bold shrink-0">{expedition.remaining}с</span>
            </div>

            <div className="flex items-center gap-2.5 flex-1 sm:max-w-xs">
              <div className="flex-1 bg-[#0a110c] h-2 rounded-full overflow-hidden border border-[#223d29]">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${((expedition.totalDuration - expedition.remaining) / expedition.totalDuration) * 100}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAfkModal(true)}
                className="px-2.5 py-1 bg-[#1a3321] hover:bg-[#25462f] border border-[#3b6b46] rounded text-[11px] font-bold text-emerald-200 shrink-0"
              >
                Деталі
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ЕКСТРЕНИЙ БАНЕР НЕПРИТОМНОСТІ ================= */}
      {isUnconscious && (
        <div className="max-w-7xl mx-auto w-full px-3 md:px-5 pt-3 z-30">
          <div className="bg-[#260909]/95 border-2 border-red-600 rounded-lg p-3.5 md:p-4 shadow-[0_0_25px_rgba(220,38,38,0.35)]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3.5 text-center md:text-left">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="p-2.5 rounded-full bg-red-950 border border-red-500 shrink-0 shadow-lg">
                  <Skull className="w-6 h-6 text-red-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-red-200 uppercase tracking-wider font-mono">
                    КРИТИЧНИЙ СТАН // БЕЗ СВІДОМОСТІ (0 HP)
                  </h3>
                  <p className="text-xs text-red-200/90 mt-1 leading-relaxed font-mono">
                    Ви впали без свідомості, все що в вас лишається це гукати на допомогу або спробувати підлікуватись самостійно.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:flex items-center gap-2 shrink-0 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('inventory')}
                  className="px-3 py-2.5 bg-[#1b3821] hover:bg-[#285732] border border-emerald-500 text-emerald-100 text-xs font-bold leading-tight rounded flex items-center justify-center gap-1.5 transition shadow active:scale-95"
                >
                  <Backpack className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Інвентар (лікуватись)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCallForHelp}
                  disabled={sosCooldown > 0}
                  className={`px-3 py-2.5 border text-xs font-bold leading-tight rounded flex items-center justify-center gap-1.5 transition shadow active:scale-95 ${
                    sosCooldown > 0
                      ? 'bg-[#18130e] border-[#453020] text-[#9c7a5e] cursor-not-allowed'
                      : 'bg-[#2c1d12] hover:bg-[#422917] border-amber-500 text-amber-200'
                  }`}
                >
                  <Radio className={`w-4 h-4 shrink-0 ${sosCooldown > 0 ? 'text-[#9c7a5e]' : 'text-amber-400 animate-pulse'}`} />
                  <span>{sosCooldown > 0 ? `Кулдаун (${sosCooldown}с)` : 'Гукати допомогу (SOS)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSurrender}
                  className="col-span-2 md:col-span-1 px-3.5 py-2.5 bg-red-900/90 hover:bg-red-800 border border-red-500 text-white text-xs font-bold leading-tight rounded flex items-center justify-center gap-1.5 transition shadow active:scale-95"
                >
                  <Skull className="w-4 h-4 text-red-200 shrink-0" />
                  <span>Здатись (загинути)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Основний робочий простір */}
      <main className="max-w-7xl mx-auto w-full p-3 md:p-5 flex-1 flex flex-col gap-4">
        {/* Верхні вкладки (ПК) */}
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

        {activeTab === 'map' && !isUnconscious && (
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
            exploredSectors={exploredSectors}
            notifications={notifications}
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

      {/* Мобільна нижня док-панель */}
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

      {showAfkModal && expedition && <AfkModal expedition={expedition} onClose={() => setShowAfkModal(false)} />}

      {!hasCompletedOnboarding && (
        <OnboardingModal
          onNotify={notify}
          onComplete={async (data) => {
            const isWater = Boolean(data.isWaterSpawn);

            const isSoldier = data.specialization === 'soldier';
            const startMaxHp = isSoldier ? 120 : 100;
            const startHp = isWater ? 35 : isSoldier ? 102 : player.hp;

            const updatedPlayer: PlayerStats = {
              ...player,
              name: data.callsign,
              callsign: data.callsign,
              citizenship: data.citizenship,
              specialization: data.specialization,
              aggressorReason: data.aggressorReason,
              astatCoins: 0,
              hp: startHp,
              maxHp: startMaxHp,
              hunger: isWater ? 25 : player.hunger,
              conditions: data.isZombified 
                ? Array.from(new Set([...player.conditions, 'zombified'])) 
                : player.conditions
            };

            const initialInv = [...INITIAL_AWAKENING_INVENTORY];
            const initialExplored = getSurroundingSectorKeys(data.startCoords.lat, data.startCoords.lng);

            setPlayer(updatedPlayer);
            setCoords(data.startCoords);
            setCampCoords(data.startCoords);
            setInventory(initialInv);
            setExploredSectors(initialExplored);

            setHasCompletedOnboarding(true);
            setIsBooting(true);

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
                explored_sectors: initialExplored,
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

      <footer className="border-t border-[#1d2720] bg-[#0c120e] px-4 py-2 text-[10px] text-[#556b5b] hidden md:flex flex-wrap items-center justify-between gap-2">
        <div>ASTAT HYBRID RPG ENGINE • ПОЛІССЯ-АНТИМАТЕРІЯ • УКРАЇНСЬКА ЛОКАЛІЗАЦІЯ</div>
        <div className="flex items-center gap-3">
          <span>GPS: {coords.lat.toFixed(5)}° N, {coords.lng.toFixed(5)}° E</span>
          <span>Статус зв'язку: АКТИВНИЙ</span>
        </div>
      </footer>
    </div>
  );
}