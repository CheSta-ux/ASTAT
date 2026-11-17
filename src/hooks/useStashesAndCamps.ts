import { useState, useEffect, useCallback } from 'react';
import type { InventoryItem, OtherPlayerCamp, SectorStash } from '../types/game';
import { calculateHaversineDistanceMeters } from '../utils/coordinates';
import { supabase } from '../lib/supabase';
import type { NotifyFn } from './useNotifications';

export interface ForeignStashLootResult {
  stashOwnerCallsign: string;
  takenItem?: InventoryItem;
  takenCoins: number;
  stashDepleted: boolean;
}

export function useStashesAndCamps(notify: NotifyFn) {
  const [stashes, setStashes] = useState<SectorStash[]>([]);
  const [foreignCamps, setForeignCamps] = useState<OtherPlayerCamp[]>([]);

  const localPlayerId = localStorage.getItem('astat_player_id') || '';

  // 1. Завантаження активних схронів із Supabase
  const fetchActiveStashes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sector_stashes')
        .select('*')
        .eq('is_looted', false)
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error && Array.isArray(data)) {
        const mapped: SectorStash[] = data.map((row: any) => ({
          id: row.id,
          ownerId: row.owner_id,
          ownerCallsign: row.owner_callsign || 'Невідомий виживший',
          lat: Number(row.lat),
          lng: Number(row.lng),
          items: Array.isArray(row.items) ? row.items : [],
          coins: Number(row.coins || 0),
          createdAt: row.created_at,
          isLooted: Boolean(row.is_looted)
        }));
        setStashes(mapped);
      }
    } catch (err) {
      console.warn('Не вдалося завантажити схрони:', err);
    }
  }, []);

  // 2. Завантаження координат базових таборів інших гравців
  const fetchForeignCamps = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, callsign, camp_lat, camp_lng')
        .not('camp_lat', 'is', null)
        .not('camp_lng', 'is', null)
        .limit(300);

      if (!error && Array.isArray(data)) {
        const myId = localStorage.getItem('astat_player_id') || '';
        const camps: OtherPlayerCamp[] = data
          .filter(
            (p: any) =>
              p.id &&
              p.id !== myId &&
              typeof p.camp_lat === 'number' &&
              typeof p.camp_lng === 'number'
          )
          .map((p: any) => ({
            ownerId: p.id,
            ownerCallsign: p.callsign || 'Виживший',
            lat: Number(p.camp_lat),
            lng: Number(p.camp_lng)
          }));
        setForeignCamps(camps);
      }
    } catch (err) {
      console.warn('Не вдалося завантажити координати таборів:', err);
    }
  }, []);

  useEffect(() => {
    fetchActiveStashes();
    fetchForeignCamps();

    const stashChannel = supabase
      .channel('public:sector_stashes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sector_stashes' },
        () => {
          fetchActiveStashes();
        }
      )
      .subscribe();

    const campRefreshInterval = setInterval(() => {
      fetchForeignCamps();
    }, 60000);

    return () => {
      supabase.removeChannel(stashChannel);
      clearInterval(campRefreshInterval);
    };
  }, [fetchActiveStashes, fetchForeignCamps]);

  // Власні активні схрони поточного гравця
  const ownStashes = stashes.filter((s) => !s.isLooted && s.ownerId === localPlayerId);

  // Перевірка: чи стоїть гравець на власному схроні (радіус 50 м)
  const getOwnStashAt = useCallback(
    (lat: number, lng: number): SectorStash | null => {
      const myId = localStorage.getItem('astat_player_id') || '';
      return (
        stashes.find(
          (s) =>
            !s.isLooted &&
            s.ownerId === myId &&
            calculateHaversineDistanceMeters(lat, lng, s.lat, s.lng) < 50
        ) || null
      );
    },
    [stashes]
  );

  // Перевірка: чи стоїть гравець на території чужого табору (радіус 50 м)
  const getForeignCampAt = useCallback(
    (lat: number, lng: number): OtherPlayerCamp | null => {
      return (
        foreignCamps.find(
          (c) => calculateHaversineDistanceMeters(lat, lng, c.lat, c.lng) < 50
        ) || null
      );
    },
    [foreignCamps]
  );

  // Створення схрону в Supabase при загибелі гравця
  const createDeathStash = useCallback(
    async (
      lat: number,
      lng: number,
      ownerCallsign: string,
      droppedItems: InventoryItem[],
      droppedCoins: number
    ): Promise<boolean> => {
      const validItems = droppedItems.filter((i) => i.count > 0);
      if (validItems.length === 0 && droppedCoins <= 0) {
        return false;
      }

      const myId = localStorage.getItem('astat_player_id');
      if (!myId) return false;

      try {
        const { data, error } = await supabase
          .from('sector_stashes')
          .insert({
            owner_id: myId,
            owner_callsign: ownerCallsign,
            lat,
            lng,
            items: validItems,
            coins: Math.max(0, Math.floor(droppedCoins)),
            is_looted: false
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setStashes((prev) => [
            {
              id: data.id,
              ownerId: data.owner_id,
              ownerCallsign: data.owner_callsign,
              lat: Number(data.lat),
              lng: Number(data.lng),
              items: data.items || [],
              coins: Number(data.coins || 0),
              createdAt: data.created_at,
              isLooted: false
            },
            ...prev
          ]);
        }
        return true;
      } catch (err) {
        console.warn('Помилка створення схрону в Supabase:', err);
        notify('Не вдалося зафіксувати схрон на сервері.', 'warn');
        return false;
      }
    },
    [notify]
  );

  // Повне повернення власного схрону гравцем
  const claimOwnStash = useCallback(
    async (stash: SectorStash): Promise<{ items: InventoryItem[]; coins: number } | null> => {
      try {
        const { error } = await supabase
          .from('sector_stashes')
          .update({
            items: [],
            coins: 0,
            is_looted: true
          })
          .eq('id', stash.id);

        if (error) throw error;

        setStashes((prev) => prev.filter((s) => s.id !== stash.id));
        return {
          items: stash.items,
          coins: stash.coins
        };
      } catch (err) {
        console.warn('Помилка повернення схрону:', err);
        notify('Помилка звʼязку при відкритті схрону.', 'danger');
        return null;
      }
    },
    [notify]
  );

  // Часткове знаходження чужого схрону під час обшуку сектора
  const tryLootForeignStashAt = useCallback(
    async (
      lat: number,
      lng: number,
      discoveryChance = 0.65
    ): Promise<ForeignStashLootResult | null> => {
      const myId = localStorage.getItem('astat_player_id') || '';
      const candidate = stashes.find(
        (s) =>
          !s.isLooted &&
          s.ownerId !== myId &&
          (s.items.length > 0 || s.coins > 0) &&
          calculateHaversineDistanceMeters(lat, lng, s.lat, s.lng) < 50
      );

      if (!candidate) return null;
      if (Math.random() > discoveryChance) return null;

      // Забираємо лише частину речей (1 слот у кількості 1–2 шт. та/або до 35% мікросхем)
      const remainingItems: InventoryItem[] = candidate.items.map((i) => ({ ...i }));
      let remainingCoins = candidate.coins;
      let takenItem: InventoryItem | undefined;
      let takenCoins = 0;

      if (remainingItems.length > 0) {
        const randIdx = Math.floor(Math.random() * remainingItems.length);
        const target = remainingItems[randIdx];
        const takeCount = target.count > 2 ? Math.min(2, Math.ceil(target.count * 0.35)) : 1;

        takenItem = { ...target, count: takeCount };
        if (target.count - takeCount <= 0) {
          remainingItems.splice(randIdx, 1);
        } else {
          remainingItems[randIdx] = { ...target, count: target.count - takeCount };
        }
      }

      if (remainingCoins > 0 && (!takenItem || Math.random() < 0.45)) {
        takenCoins = Math.max(1, Math.min(remainingCoins, Math.ceil(remainingCoins * 0.35)));
        remainingCoins -= takenCoins;
      }

      if (!takenItem && takenCoins <= 0) return null;

      const isNowEmpty = remainingItems.length === 0 && remainingCoins <= 0;

      try {
        const { error } = await supabase
          .from('sector_stashes')
          .update({
            items: remainingItems,
            coins: remainingCoins,
            is_looted: isNowEmpty
          })
          .eq('id', candidate.id);

        if (error) throw error;

        setStashes((prev) =>
          isNowEmpty
            ? prev.filter((s) => s.id !== candidate.id)
            : prev.map((s) =>
                s.id === candidate.id
                  ? { ...s, items: remainingItems, coins: remainingCoins }
                  : s
              )
        );

        return {
          stashOwnerCallsign: candidate.ownerCallsign,
          takenItem,
          takenCoins,
          stashDepleted: isNowEmpty
        };
      } catch (err) {
        console.warn('Помилка оновлення чужого схрону:', err);
        return null;
      }
    },
    [stashes]
  );

  return {
    stashes,
    ownStashes,
    foreignCamps,
    getOwnStashAt,
    getForeignCampAt,
    createDeathStash,
    claimOwnStash,
    tryLootForeignStashAt
  };
}