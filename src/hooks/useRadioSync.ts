import { useState, useEffect, useCallback } from 'react';
import type { PlayerStats, RadioMessage } from '../types/game';
import { supabase } from '../lib/supabase';
import type { NotifyFn } from './useNotifications';

export function useRadioSync(player: PlayerStats, notify: NotifyFn) {
  const [radioMessages, setRadioMessages] = useState<RadioMessage[]>([
    { id: 1, createdAt: Date.now(), sender: 'Маяк-База', time: '11:42', text: 'Усім групам: викид стабілізувався, вихід на сектори Півночі дозволено.', type: 'frequency', target: '104.2' },
    { id: 2, createdAt: Date.now(), sender: 'Штаб Оборони', time: '12:05', text: 'Увага! У зоні радіусом 5 км фіксуються аномальні сплески сполук Астату.', type: 'frequency', target: '104.2' },
    { id: 3, createdAt: Date.now(), sender: 'Бродяга_99', time: '11:58', text: 'Хто біля закинутого порту? Залишив схрон під іржавим краном.', type: 'local', target: '51.408-30.063' }
  ]);

  // Початкове завантаження та підписка на нові повідомлення в реальному часі
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

  // Очищення повідомлень, старших за 60 секунд (TTL)
  useEffect(() => {
    const timer = setInterval(() => {
      const cutoff = Date.now() - 60000;
      setRadioMessages((prev) => prev.filter((m) => (m.createdAt || m.id) > cutoff));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const sendMessage = useCallback(
    async (text: string, type: 'local' | 'frequency', target: string) => {
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
          target
        });
        if (error) throw error;
      } catch (err) {
        console.warn('Помилка відправки в ефір:', err);
        notify('Помилка передачі сигналу в ефір', 'danger');
      }
    },
    [player.conditions, player.callsign, player.name, notify]
  );

  return { radioMessages, sendMessage };
}