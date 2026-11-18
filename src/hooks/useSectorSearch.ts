import { useState, useCallback } from 'react';
import type { Coordinates, ExpeditionState, InventoryItem, OtherPlayerCamp, PlayerStats, TabType } from '../types/game';
import { getSearchEventForBiome } from '../constants/searchEvents';
import type { SearchEventChoice } from '../constants/searchEvents';
import type { ActiveSearchEventState } from '../components/SearchEventModal';
import { calculateHaversineDistanceMeters } from '../utils/coordinates';
import { createSectorData } from '../utils/sectorGenerator';
import { detectGridWater, getCachedSectorTerrain } from '../utils/waterDetectorService';
import {
  loadSectorSearchHistory,
  getSectorSearchStatus,
  recordSectorSearch,
  formatCooldownTimer,
  type SectorSearchRecord
} from '../utils/sectorCooldownManager';
import { getRandomLoot } from '../constants/lootDictionary';
import type { ForeignStashLootResult } from './useStashesAndCamps';
import type { NotifyFn } from './useNotifications';

interface UseSectorSearchProps {
  coords: Coordinates;
  campCoords: Coordinates;
  player: PlayerStats;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerStats>>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  expedition: ExpeditionState | null;
  isUnconscious: boolean;
  setActiveTab: React.Dispatch<React.SetStateAction<TabType>>;
  getForeignCampAt: (lat: number, lng: number) => OtherPlayerCamp | null;
  tryLootForeignStashAt: (lat: number, lng: number, chance?: number) => Promise<ForeignStashLootResult | null>;
  syncGameState: (
    overridePlayer?: PlayerStats,
    overrideInventory?: InventoryItem[]
  ) => Promise<void>;
  notify: NotifyFn;
}

export function useSectorSearch({
  coords,
  campCoords,
  player,
  setPlayer,
  inventory,
  setInventory,
  expedition,
  isUnconscious,
  setActiveTab,
  getForeignCampAt,
  tryLootForeignStashAt,
  syncGameState,
  notify
}: UseSectorSearchProps) {
  const [sectorSearches, setSectorSearches] = useState<Record<string, SectorSearchRecord>>(loadSectorSearchHistory);
  const [activeSearchEvent, setActiveSearchEvent] = useState<ActiveSearchEventState | null>(null);

  const handleSearch = useCallback(async () => {
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

    const foreignCamp = getForeignCampAt(coords.lat, coords.lng);
    if (foreignCamp) {
      notify(
        `🛡️ Це табір виживанця «${foreignCamp.ownerCallsign}». Пошук предметів на території чужої бази заблоковано!`,
        'warn'
      );
      return;
    }

    const currentStatus = getSectorSearchStatus(coords.lat, coords.lng, sectorSearches);
    if (currentStatus.isDepleted) {
      notify(
        `Цей сектор повністю виснажено! Повторний огляд через ${formatCooldownTimer(currentStatus.cooldownRemainingMs)}`,
        'warn'
      );
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
  }, [
    isUnconscious,
    expedition,
    coords,
    campCoords,
    getForeignCampAt,
    sectorSearches,
    player,
    setPlayer,
    syncGameState,
    notify
  ]);

  const handleResolveSearchChoice = useCallback(
    async (choice: SearchEventChoice) => {
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

        // Часткове лутання схрону іншого гравця
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
    },
    [
      activeSearchEvent,
      player,
      inventory,
      coords,
      tryLootForeignStashAt,
      setPlayer,
      setInventory,
      syncGameState,
      setActiveTab,
      notify
    ]
  );

  return {
    sectorSearches,
    activeSearchEvent,
    setActiveSearchEvent,
    handleSearch,
    handleResolveSearchChoice
  };
}