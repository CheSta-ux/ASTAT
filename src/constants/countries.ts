export interface AggressorEntry {
  id: string;
  name: string;
  status: string;
  role: string;
}

export const AGGRESSOR_STATES: Record<string, AggressorEntry> = {
  RU: {
    id: 'RU',
    name: 'Російська Федерація',
    status: 'Держава-агресор',
    role: 'Пряма збройна агресія, окупація територій, ведення повномасштабної війни.'
  },
  BY: {
    id: 'BY',
    name: 'Республіка Білорусь',
    status: 'Співучасник агресії (держава, що надала територію)',
    role: 'Надання плацдарму для військ вторгнення, запуск ракет та використання повітряного простору.'
  },
  IR: {
    id: 'IR',
    name: 'Іранська Ісламська Республіка',
    status: 'Пособник агресора',
    role: 'Постачання ударних БПЛА (Shahed-136/131), балістичного озброєння та компонентів.'
  },
  KP: {
    id: 'KP',
    name: 'Корейська Народно-Демократична Республіка (КНДР)',
    status: 'Військовий союзник агресора',
    role: 'Постачання мільйонів артилерійських снарядів, ракет KN-23 та пряме відправлення військових контингентів.'
  }
};

// Перелік держав світу (Україна на першому місці, далі за алфавітом)
export const WORLD_COUNTRIES = [
  { code: 'UA', name: 'Україна 🇺🇦' },
  { code: 'RU', name: 'Російська Федерація 💀 (Країна-агресор)', isAggressor: true },
  { code: 'BY', name: 'Республіка Білорусь (Співучасник агресії)', isAggressor: true },
  { code: 'IR', name: 'Іранська Ісламська Республіка (Пособник агресора)', isAggressor: true },
  { code: 'KP', name: 'КНДР (Північна Корея) (Військовий союзник)', isAggressor: true },
  
  // Європа
  { code: 'PL', name: 'Польща' },
  { code: 'GB', name: 'Велика Британія' },
  { code: 'DE', name: 'Німеччина' },
  { code: 'FR', name: 'Франція' },
  { code: 'IT', name: 'Італія' },
  { code: 'ES', name: 'Іспанія' },
  { code: 'LT', name: 'Литва' },
  { code: 'LV', name: 'Латвія' },
  { code: 'EE', name: 'Естонія' },
  { code: 'CZ', name: 'Чехія' },
  { code: 'SE', name: 'Швеція' },
  { code: 'NO', name: 'Норвегія' },
  { code: 'FI', name: 'Фінляндія' },
  { code: 'DK', name: 'Данія' },
  { code: 'NL', name: 'Нідерланди' },
  { code: 'BE', name: 'Бельгія' },
  { code: 'CH', name: 'Швейцарія' },
  { code: 'AT', name: 'Австрія' },
  { code: 'RO', name: 'Румунія' },
  { code: 'MD', name: 'Молдова' },
  { code: 'GE', name: 'Грузія' },

  // Північна та Південна Америка
  { code: 'US', name: 'Сполучені Штати Америки (США)' },
  { code: 'CA', name: 'Канада' },
  { code: 'MX', name: 'Мексика' },
  { code: 'BR', name: 'Бразилія' },
  { code: 'AR', name: 'Аргентина' },

  // Азія, Африка, Австралія
  { code: 'JP', name: 'Японія' },
  { code: 'KR', name: 'Південна Корея' },
  { code: 'TW', name: 'Тайвань' },
  { code: 'AU', name: 'Австралія' },
  { code: 'NZ', name: 'Нова Зеландія' },
  { code: 'IL', name: 'Ізраїль' },
  { code: 'TR', name: 'Туреччина' },
  { code: 'IN', name: 'Індія' },
  { code: 'ZA', name: 'Південно-Африканська Республіка' },
  { code: 'KZ', name: 'Казахстан' },
  { code: 'AZ', name: 'Азербайджан' }
];