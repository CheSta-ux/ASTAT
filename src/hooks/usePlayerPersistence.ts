import { useEffect, useCallback } from 'react';
import type { Coordinates, ExpeditionState, InventoryItem, PlayerStats } from '../types/game';
import { calculateHaversineDistanceMeters, offsetGeoBySectors } from '../utils/coordinates';
import { createSectorData } from '../utils/sectorGenerator';
import { supabase } from '../lib/supabase';
import type { NotifyFn } from './useNotifications';

const ACTIVE_EXPEDITION_KEY = 'astat_active_expedition_v1';

export const saveActiveExpedition = (exp: ExpeditionState | null) => {
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

export const loadActiveExpedition = (): ExpeditionState | null => {
  try {
    const raw = localStorage.getItem(ACTIVE_EXPEDITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExpeditionState;
    return parsed && typeof parsed.endsAt === 'number' ? parsed : null;
  } catch {
    return null;
  }
};

export const getSurroundingSectorKeys = (lat: number, lng: number): string[] => {
  const keys: string[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const geo = offsetGeoBySectors(lat, lng, dx, dy);
      keys.push(`${geo.lat.toFixed(5)}-${geo.lng.toFixed(5)}`);
    }
  }
  return keys;
};

interface UsePlayerPersistenceProps {
  defaultCoords: Coordinates;
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
  setExpedition: React.Dispatch<React.SetStateAction<ExpeditionState | null>>;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: React.Dispatch<React.SetStateAction<boolean>>;
  notify: NotifyFn;
}

export function usePlayerPersistence({
  defaultCoords,
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
}: UsePlayerPersistenceProps) {
  const syncGameState = useCallback(
    async (
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
    },
    [player, inventory, coords, campCoords, exploredSectors]
  );

  // Початкове завантаження профілю та відновлення/завершення AFK-маршу
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
            data.lat && data.lng ? { x: 0, y: 0, lat: data.lat, lng: data.lng } : defaultCoords;
          const baseCamp: Coordinates =
            data.camp_lat && data.camp_lng ? { x: 0, y: 0, lat: data.camp_lat, lng: data.camp_lng } : defaultCoords;
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
              setExpedition({ ...savedExp, remaining: remainingSec });
            } else {
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

  // Періодична автосинхронізація кожні 20 секунд
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

  return { syncGameState };
}