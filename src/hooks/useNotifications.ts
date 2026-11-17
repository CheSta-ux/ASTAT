import { useState, useRef, useCallback } from 'react';
import type { NotificationState } from '../types/game';

export type NotifyFn = (msg: string, type?: 'info' | 'warn' | 'danger' | 'success') => void;

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationState[]>([]);
  const lastNotificationRef = useRef<{ msg: string; time: number }>({ msg: '', time: 0 });

  const notify: NotifyFn = useCallback((msg, type = 'info') => {
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

  return { notifications, notify };
}