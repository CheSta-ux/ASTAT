import './App.css';
import { useState, useEffect } from 'react';
import { Footprints, AlertTriangle } from 'lucide-react';

import type { Coordinates, ExpeditionState, InventoryItem, PlayerCondition, PlayerStats, TabType } from './types/game';
import { getSearchEventForBiome } from './constants/searchEvents';
import type { SearchEventChoice } from './constants/searchEvents';
import { SearchEventModal } from './components/SearchEventModal';
import type { ActiveSearchEventState } from './components/SearchEventModal';
import { calculateRealisticTravelTime, calculateHaversineDistanceMeters } from './utils/coordinates';
import { createSectorData } from './utils/sectorGenerator';
import { detectGridWater, getCachedSectorTerrain } from './utils/waterDetectorService';
import { useGameLoop } from './hooks/useGameLoop';
import { useNotifications } from './hooks/useNotifications';
import { useRadioSync } from './hooks/useRadioSync';
import { useStashesAndCamps } from './hooks/useStashesAndCamps';
import type { SectorStash } from './types/game';
import {
  usePlayerPersistence,
  saveActiveExpedition,
  getSurroundingSectorKeys
} from './hooks/usePlayerPersistence';
import {
  loadSectorSearchHistory,
  getSectorSearchStatus,
  recordSectorSearch,
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
import { UnconsciousBanner } from './components/UnconsciousBanner';
import { DesktopTabs, MobileBottomNav } from './components/AppNavigation';
import { supabase } from './lib/supabase';

const DEFAULT_COORDS: Coordinates = {
  x: 0,
  y: 0,
  lat: 51.4082,
  lng: 30.0631
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const [showAfkModal, setShowAfkModal] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isBooting, setIsBooting] = useState(false);

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
  const [activeSearchEvent, setActiveSearchEvent] = useState<ActiveSearchEventState | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_AWAKENING_INVENTORY);

  const { notifications, notify } = useNotifications();
  const { radioMessages, sendMessage } = useRadioSync(player, notify);
  const { syncGameState } = usePlayerPersistence({
    defaultCoords: DEFAULT_COORDS,
    player,
    setPlayer,
    inventory,
    setInventory,
    coords,
    setCoords,
    campCoords,
    setCampCoords,
    exploredSectors,
    setExploredSectors,
    setExpedition,
    hasCompletedOnboarding,
    setHasCompletedOnboarding,
    notify
  });

  const spendMicrochips = (amount: number) => {
    const nextCoins = Math.max(0, player.astatCoins - amount);
    const nextPlayer: PlayerStats = { ...player, astatCoins: nextCoins };
    setPlayer(nextPlayer);
    syncGameState(nextPlayer);
  };

  // Схрони та табори інших гравців
  const {
    ownStashes,
    foreignCamps,
    getOwnStashAt,
    getForeignCampAt,
    createDeathStash,
    claimOwnStash,
    tryLootForeignStashAt
  } = useStashesAndCamps(notify);

  const currentOwnStash = getOwnStashAt(coords.lat, coords.lng);
  const currentForeignCamp = getForeignCampAt(coords.lat, coords.lng);

  // Стан непритомності та кулдаун крику SOS
  const isUnconscious = player.hp <= 0 || player.conditions.includes('unconscious');
  const [sosCooldown, setSosCooldown] = useState<number>(0);

  useEffect(() => {
    if (isUnconscious && activeTab === 'map') {
      setActiveTab('inventory');
    }
  }, [isUnconscious, activeTab]);

  useEffect(() => {
    if (sosCooldown <= 0) return;
    const interval = setInterval(() => {
      setSosCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [sosCooldown]);

  const handleCallForHelp = async () => {
    if (sosCooldown > 0) {
      notify(`Зв'язки перенапружені! Зачекайте ще ${sosCooldown} с перед наступним криком.`, 'warn');
      return;
    }

    const coordsStr = `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°`;
    const localSectorTarget = `${coords.lat.toFixed(3)}-${coords.lng.toFixed(3)}`;
    const screamText = `🚨 [КРИК ПРО ДОПОМОГУ]: "Я поранений в секторі ${coordsStr}! Допоможіть хто-небудь!"`;

    await sendMessage(screamText, 'local', localSectorTarget);
    setSosCooldown(60);
    notify('📢 Крик про допомогу рознісся сектором! (Кулдаун: 60с)', 'warn');
    setActiveTab('radio');
  };

  const handleSurrender = async () => {
    const deathLat = coords.lat;
    const deathLng = coords.lng;
    const droppedItems = [...inventory];
    const droppedCoins = player.astatCoins;
    const lostItemsCount = droppedItems.reduce((sum, item) => sum + item.count, 0);

    const stashCreated = await createDeathStash(
      deathLat,
      deathLng,
      player.callsign || player.name,
      droppedItems,
      droppedCoins
    );

    const respawnCoords = { ...campCoords };
    setCoords(respawnCoords);
    setSelectedTarget(null);
    setExpedition(null);
    saveActiveExpedition(null);
    setInventory([]);

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
      stashCreated
        ? `💀 Ви загинули. На координатах [${deathLat.toFixed(4)}°, ${deathLng.toFixed(4)}°] залишився схрон (${lostItemsCount} речей)!`
        : `💀 Ви здалися та загинули. Повернення до базового табору.`,
      'danger'
    );
    setActiveTab('map');
  };

  const handleClaimOwnStash = async (stash: SectorStash) => {
    const recovered = await claimOwnStash(stash);
    if (!recovered) return;

    const mergedInventory = [...inventory];
    for (const item of recovered.items) {
      const idx = mergedInventory.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        mergedInventory[idx] = { ...mergedInventory[idx], count: mergedInventory[idx].count + item.count };
      } else {
        mergedInventory.push({ ...item });
      }
    }

    const updatedPlayer: PlayerStats = {
      ...player,
      astatCoins: player.astatCoins + recovered.coins
    };

    setInventory(mergedInventory);
    setPlayer(updatedPlayer);
    syncGameState(updatedPlayer, mergedInventory);

    const totalRecovered = recovered.items.reduce((s, i) => s + i.count, 0);
    notify(
      `🎒 Схрон повернуто! Отримано ${totalRecovered} предметів${recovered.coins > 0 ? ` та ${recovered.coins} мікросхем` : ''}.`,
      'success'
    );
  };

  const handleExpeditionComplete = (expData: ExpeditionState) => {
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
      expData.targetSectorData ||
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
      notify('Ви без свідомості! Пошук ресурсів неможливий.', 'danger');
      return;
    }

    if (expedition) {
      notify('Неможливо обшукувати сектор під час руху!', 'warn');
      return;
    }

    const distToCamp = calculateHaversineDistanceMeters(coords.lat, coords.lng, campCoords.lat, campCoords.lng);
    if (distToCamp < 50) {
      notify('Ви у безпечному таборі. Вийдіть у сусідні сектори для пошуку припасів.', 'info');
      return;
    }

    const currentStatus = getSectorSearchStatus(coords.lat, coords.lng, sectorSearches);
    if (currentStatus.isDepleted) {
      notify(`Цей сектор повністю виснажено! Повторний огляд через ${formatCooldownTimer(currentStatus.cooldownRemainingMs)}`, 'warn');
      return;
    }

    if (player.hunger < 4) {
      notify('Занадто низька ситість для обшуку (-4% потрібно).', 'danger');
      return;
    }

    const { updatedMap, newStatus } = recordSectorSearch(coords.lat, coords.lng, sectorSearches);
    setSectorSearches(updatedMap);

    const updatedPlayer: PlayerStats = {
      ...player,
      hunger: Math.max(0, player.hunger - 4),
      searchesLeft: newStatus.searchesLeft
    };
    setPlayer(updatedPlayer);
    syncGameState(updatedPlayer);

    const sectorKey = `${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}`;
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
    const scenario = getSearchEventForBiome(sectorBiome, currentSector.name, player.specialization);

    setActiveSearchEvent({
      scenario,
      sectorName: currentSector.name,
      sectorBiome
    });

    if (newStatus.searchesLeft === 0) {
      notify('Сектор зачищено! Блокування повторного огляду на 24 години.', 'warn');
    }
  };

  const handleResolveSearchChoice = async (choice: SearchEventChoice) => {
    if (!activeSearchEvent || activeSearchEvent.resolved) return;

    const { sectorName, sectorBiome } = activeSearchEvent;
    const roll = Math.random();

    const nextPlayer: PlayerStats = { ...player };
    const nextInventory: InventoryItem[] = [...inventory];
    const isZombified = nextPlayer.conditions.includes('zombified');

    // 1. Перевірка пастки
    if (choice.trapChance > 0 && roll < choice.trapChance) {
      const dmg =
        player.specialization === 'soldier'
          ? Math.max(4, Math.round(choice.trapDamage * 0.67))
          : choice.trapDamage;
      const nextHp = Math.max(0, nextPlayer.hp - dmg);
      nextPlayer.hp = nextHp;

      const hadBleeding = nextPlayer.conditions.includes('bleeding');
      if (!hadBleeding) {
        nextPlayer.conditions = [...nextPlayer.conditions, 'bleeding'];
      }

      if (nextHp <= 0 && !nextPlayer.conditions.includes('unconscious')) {
        nextPlayer.conditions = [...nextPlayer.conditions, 'unconscious'];
      }

      setPlayer(nextPlayer);
      syncGameState(nextPlayer, nextInventory);

      setActiveSearchEvent({
        ...activeSearchEvent,
        resolved: {
          outcome: 'trap',
          narrative: choice.trapNarrative || 'Під час обшуку спрацювала прихована пастка!',
          damageTaken: dmg,
          gotBleeding: !hadBleeding
        }
      });

      if (nextHp <= 0) {
        notify('💀 Ви впали без свідомості від отриманих ран!', 'danger');
        setActiveTab('inventory');
      } else {
        notify(`🩸 Пастка! Отримано ${dmg} шкоди та кровотечу!`, 'danger');
      }
      return;
    }

    // 2. Перевірка знаходження луту
    if (Math.random() < choice.lootChance) {
      const foundItem = getRandomLoot(sectorBiome, sectorName);
      let chipsFound = 0;

      if (foundItem.id === 'microchip') {
        const rawChips = foundItem.count || 1;
        if (isZombified && Math.random() >= 0.2) {
          notify('💀 Знайдено пошкоджену мікросхему — через клеймо «Зомбований» (-80%) плата непридатна!', 'warn');
        } else {
          chipsFound = isZombified ? Math.max(1, Math.floor(rawChips * 0.2)) : rawChips;
          nextPlayer.astatCoins += chipsFound;
        }
      } else {
        const idx = nextInventory.findIndex((i) => i.id === foundItem.id);
        if (idx >= 0) {
          nextInventory[idx] = { ...nextInventory[idx], count: nextInventory[idx].count + (foundItem.count || 1) };
        } else {
          nextInventory.push({ ...foundItem, count: foundItem.count || 1 });
        }
      }

      if (choice.bonusChipChance && Math.random() < choice.bonusChipChance) {
        if (!isZombified || Math.random() < 0.2) {
          chipsFound += 1;
          nextPlayer.astatCoins += 1;
        }
      }

      // Перевірка наявності схрону іншого гравця на цій локації (часткове лутання)
      const foreignDiscoveryChance =
        player.specialization === 'scout' || choice.riskLevel === 'high' ? 0.9 : 0.65;
      const foreignLoot = await tryLootForeignStashAt(coords.lat, coords.lng, foreignDiscoveryChance);

      if (foreignLoot) {
        if (foreignLoot.takenItem) {
          const fIdx = nextInventory.findIndex((i) => i.id === foreignLoot.takenItem!.id);
          if (fIdx >= 0) {
            nextInventory[fIdx] = {
              ...nextInventory[fIdx],
              count: nextInventory[fIdx].count + foreignLoot.takenItem.count
            };
          } else {
            nextInventory.push({ ...foreignLoot.takenItem });
          }
        }
        if (foreignLoot.takenCoins > 0) {
          nextPlayer.astatCoins += foreignLoot.takenCoins;
        }
      }

      let healedHp = 0;
      if (choice.healBonus && choice.healBonus > 0) {
        const before = nextPlayer.hp;
        nextPlayer.hp = Math.min(nextPlayer.maxHp, nextPlayer.hp + choice.healBonus);
        healedHp = nextPlayer.hp - before;
      }

      let gotRadiation = false;
      if (choice.radChance && Math.random() < choice.radChance && !nextPlayer.conditions.includes('radiation')) {
        nextPlayer.conditions = [...nextPlayer.conditions, 'radiation'];
        gotRadiation = true;
      }

      setPlayer(nextPlayer);
      setInventory(nextInventory);
      syncGameState(nextPlayer, nextInventory);

      setActiveSearchEvent({
        ...activeSearchEvent,
        resolved: {
          outcome: 'loot',
          narrative: choice.successNarrative,
          foundItem: foundItem.id !== 'microchip' ? foundItem : undefined,
          chipsFound: chipsFound > 0 ? chipsFound : undefined,
          healedHp: healedHp > 0 ? healedHp : undefined,
          gotRadiation,
          foreignStashLoot: foreignLoot
            ? {
                ownerCallsign: foreignLoot.stashOwnerCallsign,
                takenItem: foreignLoot.takenItem,
                takenCoins: foreignLoot.takenCoins
              }
            : undefined
        }
      });

      if (foreignLoot) {
        notify(`📦 Ви виявили чужий схрон (${foreignLoot.stashOwnerCallsign}) і забрали частину припасів!`, 'warn');
      } else if (foundItem.id !== 'microchip') {
        notify(`🎒 Знайдено: ${foundItem.name} (+${foundItem.count || 1})`, 'success');
      } else if (chipsFound > 0) {
        notify(`📟 Знайдено мікросхем: +${chipsFound} шт.!`, 'success');
      }
      return;
    }

    // 3. Порожній результат
    setActiveSearchEvent({
      ...activeSearchEvent,
      resolved: {
        outcome: 'empty',
        narrative: choice.emptyNarrative
      }
    });
    notify('Обшук не дав результатів.', 'info');
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
      notify('Ви у безпечному таборі. Вийдіть у сусідні сектори для пошуку припасів.', 'info');
      return;
    }

    // Мітка: заборона перенесення табору на чужий схрон або табір
    const foreignCamp = getForeignCampAt(coords.lat, coords.lng);
    if (foreignCamp) {
      notify(
        `🛡️ Це табір виживанця «${foreignCamp.ownerCallsign}». Пошук предметів на території чужої бази заблоковано!`,
        'warn'
      );
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

    const updatedPlayer = { ...player };

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

      {/* Банер маршу в дорозі поза вкладкою карти */}
      {expedition && activeTab !== 'map' && (
        <div className="bg-[#142318] border-b border-[#2b5936] px-3 py-2.5 text-xs z-30">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Footprints className="w-4 h-4 text-emerald-400 animate-bounce shrink-0" />
                <span className="text-emerald-300 font-semibold truncate">
                  Марш на {expedition.targetCoords ? `${expedition.targetCoords.lat.toFixed(4)}° N, ${expedition.targetCoords.lng.toFixed(4)}° E` : 'точку'}
                </span>
              </div>
              <span className="text-[#a3c2ab] font-mono font-bold shrink-0">
                {expedition.remaining >= 60
                  ? `${Math.floor(expedition.remaining / 60)} хв ${expedition.remaining % 60} с`
                  : `${expedition.remaining} с`}
              </span>
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

      {/* Екстрений банер непритомності */}
      {isUnconscious && (
        <UnconsciousBanner
          sosCooldown={sosCooldown}
          onOpenInventory={() => setActiveTab('inventory')}
          onCallForHelp={handleCallForHelp}
          onSurrender={handleSurrender}
        />
      )}

      {/* Основний робочий простір */}
      <main className="max-w-7xl mx-auto w-full p-3 md:p-5 flex-1 flex flex-col gap-4">
        <DesktopTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isUnconscious={isUnconscious}
          notify={notify}
        />

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
            activeSearchEvent={activeSearchEvent}
            onSelectSearchChoice={handleResolveSearchChoice}
            onCloseSearchEvent={() => setActiveSearchEvent(null)}
            ownStashes={ownStashes}
            foreignCamps={foreignCamps}
            currentOwnStash={currentOwnStash}
            currentForeignCamp={currentForeignCamp}
            onClaimOwnStash={handleClaimOwnStash}
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
            onSendMessage={sendMessage}
          />
        )}
        {activeTab === 'profile' && <ProfileView player={player} campCoords={campCoords} />}
      </main>

      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isUnconscious={isUnconscious}
        notify={notify}
      />

      {showAfkModal && expedition && <AfkModal expedition={expedition} onClose={() => setShowAfkModal(false)} />}

      {activeSearchEvent && (
        <SearchEventModal
          eventState={activeSearchEvent}
          specialization={player.specialization}
          onSelectChoice={handleResolveSearchChoice}
          onClose={() => setActiveSearchEvent(null)}
        />
      )}

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