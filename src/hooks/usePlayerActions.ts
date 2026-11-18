import { useState, useEffect, useCallback } from 'react';
import type {
  Coordinates,
  ExpeditionState,
  InventoryItem,
  OtherPlayerCamp,
  PlayerCondition,
  PlayerStats,
  SectorStash,
  TabType,
  WorldEnvironment
} from '../types/game';
import { calculateRealisticTravelTime, calculateHaversineDistanceMeters } from '../utils/coordinates';
import { createSectorData } from '../utils/sectorGenerator';
import { getCachedSectorTerrain } from '../utils/waterDetectorService';
import { getSectorSearchStatus, type SectorSearchRecord } from '../utils/sectorCooldownManager';
import { saveActiveExpedition, getSurroundingSectorKeys } from './usePlayerPersistence';
import { useGameLoop } from './useGameLoop';
import type { NotifyFn } from './useNotifications';

interface UsePlayerActionsProps {
  player: PlayerStats;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerStats>>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  coords: Coordinates;
  setCoords: React.Dispatch<React.SetStateAction<Coordinates>>;
  campCoords: Coordinates;
  setCampCoords: React.Dispatch<React.SetStateAction<Coordinates>>;
  exploredSectors: string[];
  setExploredSectors: React.Dispatch<React.SetStateAction<string[]>>;
  expedition: ExpeditionState | null;
  setExpedition: React.Dispatch<React.SetStateAction<ExpeditionState | null>>;
  setSelectedTarget: React.Dispatch<React.SetStateAction<any>>;
  setActiveTab: React.Dispatch<React.SetStateAction<TabType>>;
  sectorSearches: Record<string, SectorSearchRecord>;
  worldEnvironment: WorldEnvironment;
  getForeignCampAt: (lat: number, lng: number) => OtherPlayerCamp | null;
  createDeathStash: (
    lat: number,
    lng: number,
    ownerCallsign: string,
    droppedItems: InventoryItem[],
    droppedCoins: number
  ) => Promise<boolean>;
  claimOwnStash: (stash: SectorStash) => Promise<{ items: InventoryItem[]; coins: number } | null>;
  sendMessage: (text: string, type: 'local' | 'frequency', target: string) => Promise<void>;
  syncGameState: (
    overridePlayer?: PlayerStats,
    overrideInventory?: InventoryItem[],
    overrideCoords?: Coordinates,
    overrideCamp?: Coordinates,
    overrideExplored?: string[]
  ) => Promise<void>;
  notify: NotifyFn;
}

export function usePlayerActions({
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
  expedition,
  setExpedition,
  setSelectedTarget,
  setActiveTab,
  sectorSearches,
  worldEnvironment,
  getForeignCampAt,
  createDeathStash,
  claimOwnStash,
  sendMessage,
  syncGameState,
  notify
}: UsePlayerActionsProps) {
  const isUnconscious = player.hp <= 0 || player.conditions.includes('unconscious');
  const [sosCooldown, setSosCooldown] = useState<number>(0);

  useEffect(() => {
    if (isUnconscious) {
      setActiveTab((prev) => (prev === 'map' ? 'inventory' : prev));
    }
  }, [isUnconscious, setActiveTab]);

  useEffect(() => {
    if (sosCooldown <= 0) return;
    const interval = setInterval(() => {
      setSosCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [sosCooldown]);

  const spendMicrochips = useCallback(
    (amount: number) => {
      const nextCoins = Math.max(0, player.astatCoins - amount);
      const nextPlayer: PlayerStats = { ...player, astatCoins: nextCoins };
      setPlayer(nextPlayer);
      syncGameState(nextPlayer);
    },
    [player, setPlayer, syncGameState]
  );

  const handleCallForHelp = useCallback(async () => {
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
  }, [sosCooldown, coords, sendMessage, notify, setActiveTab]);

  const handleSurrender = useCallback(async () => {
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
  }, [
    coords,
    inventory,
    player,
    campCoords,
    createDeathStash,
    setCoords,
    setSelectedTarget,
    setExpedition,
    setInventory,
    setPlayer,
    syncGameState,
    notify,
    setActiveTab
  ]);

  const handleClaimOwnStash = useCallback(
    async (stash: SectorStash) => {
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
    },
    [claimOwnStash, inventory, player, setInventory, setPlayer, syncGameState, notify]
  );

  const handleExpeditionComplete = useCallback(
    (expData: ExpeditionState) => {
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
    },
    [
      coords,
      campCoords,
      sectorSearches,
      exploredSectors,
      player,
      setCoords,
      setSelectedTarget,
      setExpedition,
      setExploredSectors,
      setPlayer,
      syncGameState,
      notify
    ]
  );

  useGameLoop({
    expedition,
    setExpedition,
    onExpeditionComplete: handleExpeditionComplete,
    player,
    setPlayer,
    onNotify: notify
  });

  const handleStartExpedition = useCallback(
    (targetCoordObj: Coordinates) => {
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

      const estimates = calculateRealisticTravelTime(
        coords,
        targetCoordObj,
        player.conditions,
        player.specialization,
        worldEnvironment
      );

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
    },
    [isUnconscious, expedition, coords, player, worldEnvironment, setExpedition, notify]
  );

  const handleRest = useCallback(() => {
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
  }, [coords, campCoords, player, setPlayer, notify, syncGameState]);

  const handleRelocateCamp = useCallback(() => {
    const distToCamp = calculateHaversineDistanceMeters(coords.lat, coords.lng, campCoords.lat, campCoords.lng);
    if (distToCamp < 50) {
      notify('Табір уже розбитий тут.', 'info');
      return;
    }

    const foreignCamp = getForeignCampAt(coords.lat, coords.lng);
    if (foreignCamp) {
      notify(
        `🛡️ Тут розташований табір виживанця «${foreignCamp.ownerCallsign}». Перенесення бази неможливе!`,
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
  }, [coords, campCoords, getForeignCampAt, player, spendMicrochips, setCampCoords, notify, syncGameState]);

  const handleUseItem = useCallback(
    (item: InventoryItem) => {
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
    },
    [player, inventory, setPlayer, setInventory, notify, syncGameState]
  );

  return {
    isUnconscious,
    sosCooldown,
    handleCallForHelp,
    handleSurrender,
    handleClaimOwnStash,
    handleStartExpedition,
    handleRest,
    handleRelocateCamp,
    handleUseItem
  };
}