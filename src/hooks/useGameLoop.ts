import { useEffect, useRef } from 'react';
import type { ExpeditionState, PlayerStats } from '../types/game';

interface UseGameLoopProps {
  expedition: ExpeditionState | null;
  setExpedition: React.Dispatch<React.SetStateAction<ExpeditionState | null>>;
  onExpeditionComplete: (expedition: ExpeditionState) => void;
  player: PlayerStats;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerStats>>;
}

export function useGameLoop({
  expedition,
  setExpedition,
  onExpeditionComplete
}: UseGameLoopProps) {
  const completeCallbackRef = useRef(onExpeditionComplete);
  completeCallbackRef.current = onExpeditionComplete;

  // Захист від подвійного спрацьовування завершення
  const isCompletedRef = useRef(false);

  useEffect(() => {
    // Якщо експедиції немає — скидаємо блокування для наступного маршу
    if (!expedition) {
      isCompletedRef.current = false;
      return;
    }

    const timer = setInterval(() => {
      setExpedition((prev) => {
        if (!prev) return null;

        // Коли час маршу вичерпано
        if (prev.remaining <= 1) {
          if (!isCompletedRef.current) {
            isCompletedRef.current = true;
            // Виносимо виклик завершення в мікротаску за межі черги стану React
            setTimeout(() => {
              completeCallbackRef.current(prev);
            }, 0);
          }
          return null;
        }

        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
    // Відстежуємо факт наявності експедиції, а не її зміну щосекунди
  }, [Boolean(expedition), setExpedition]);
}