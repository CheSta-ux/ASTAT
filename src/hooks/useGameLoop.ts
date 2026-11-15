import { useEffect, useRef } from 'react';
import type { ExpeditionState, PlayerCondition, PlayerStats } from '../types/game';

interface UseGameLoopProps {
  expedition: ExpeditionState | null;
  setExpedition: React.Dispatch<React.SetStateAction<ExpeditionState | null>>;
  onExpeditionComplete: (expedition: ExpeditionState) => void;
  player: PlayerStats;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerStats>>;
  onNotify?: (msg: string, type?: 'info' | 'warn' | 'danger' | 'success') => void;
}

export function useGameLoop({
  expedition,
  setExpedition,
  onExpeditionComplete,
  setPlayer,
  onNotify
}: UseGameLoopProps) {
  const completeCallbackRef = useRef(onExpeditionComplete);
  completeCallbackRef.current = onExpeditionComplete;

  const notifyRef = useRef(onNotify);
  notifyRef.current = onNotify;

  const isCompletedRef = useRef(false);

  // 1. Таймер експедиції на основі реального системного часу (endsAt)
  useEffect(() => {
    if (!expedition) {
      isCompletedRef.current = false;
      return;
    }

    const syncExpeditionTimer = () => {
      setExpedition((prev) => {
        if (!prev) return null;

        const nextRemaining = prev.endsAt
          ? Math.ceil((prev.endsAt - Date.now()) / 1000)
          : prev.remaining - 1;

        if (nextRemaining <= 0) {
          if (!isCompletedRef.current) {
            isCompletedRef.current = true;
            setTimeout(() => {
              completeCallbackRef.current(prev);
            }, 0);
          }
          return null;
        }

        if (nextRemaining === prev.remaining) {
          return prev;
        }

        return { ...prev, remaining: nextRemaining };
      });
    };

    const timer = setInterval(syncExpeditionTimer, 1000);

    // Миттєвий перерахунок при поверненні у вкладку або розблокуванні смартфона
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncExpeditionTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [Boolean(expedition), setExpedition]);

  // 2. Періодичний вплив кровотечі та голоду (раз на 15 секунд)
  useEffect(() => {
    const statusTimer = setInterval(() => {
      setPlayer((prev) => {
        if (prev.hp <= 0 || prev.conditions.includes('unconscious')) {
          return prev;
        }

        const isBleeding = prev.conditions.includes('bleeding');
        const isStarving = prev.hunger <= 0 && !prev.conditions.includes('comfort');

        if (!isBleeding && !isStarving) {
          return prev;
        }

        let hpLoss = 0;
        if (isBleeding) hpLoss += 2;
        if (isStarving) hpLoss += 2;

        const nextHp = Math.max(0, prev.hp - hpLoss);
        let nextConditions: PlayerCondition[] = [...prev.conditions];

        if (nextHp <= 0 && !nextConditions.includes('unconscious')) {
          nextConditions = [...nextConditions, 'unconscious'];
          setTimeout(() => {
            notifyRef.current?.(
              '💀 Ви знепритомніли від втрати крові або виснаження! Перевʼяжіть рани або гукайте SOS.',
              'danger'
            );
          }, 0);
        } else if (isBleeding && nextHp > 0 && nextHp <= 25 && prev.hp > 25) {
          setTimeout(() => {
            notifyRef.current?.('🩸 Критична крововтрата! Терміново накладіть бинт або джгут.', 'danger');
          }, 0);
        }

        return {
          ...prev,
          hp: nextHp,
          conditions: nextConditions
        };
      });
    }, 15000);

    return () => clearInterval(statusTimer);
  }, [setPlayer]);
}