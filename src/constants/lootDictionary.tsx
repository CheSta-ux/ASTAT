import type { InventoryItem } from '../types/game';

export interface LootDefinition extends InventoryItem {
  dropWeight: number;
}

export const LOOT_DICTIONARY: Record<string, LootDefinition[]> = {
  food: [
    { id: 'ration', name: 'Армійський сухпай', type: 'food', count: 0, value: 35, desc: 'Стандартний армійський пайок.', dropWeight: 30 },
    { id: 'canned_meat', name: 'Банка тушонки', type: 'food', count: 0, value: 25, desc: 'Стара, але ще їстівна тушонка.', dropWeight: 40 },
    { id: 'energy_bar', name: 'Енергетичний батончик', type: 'food', count: 0, value: 15, desc: 'Швидкий перекус на ходу.', dropWeight: 80 },
    { id: 'energy_water', name: 'Енергетик', type: 'food', count: 0, value: 20, desc: 'Ненадовго відновлює сили.', dropWeight: 50 },
    { id: 'dirty_water', name: 'Фляга з каламутною водою', type: 'food', count: 0, value: 10, desc: 'Ризик легкого отруєння.', dropWeight: 90 },
  ],
  medical_bleed: [
    { id: 'bandage', name: 'Гемостатичний бинт', type: 'medical_bleed', count: 0, value: 20, desc: 'Зупиняє кровотечу і повертає HP.', dropWeight: 50 },
    { id: 'rag', name: 'Стерильна ганчірка', type: 'medical_bleed', count: 0, value: 5, desc: 'Зупиняє кровотечу і повертає HP.', dropWeight: 90 },
    { id: 'tourniquet', name: 'Турнікет СІЧ', type: 'medical_bleed', count: 0, value: 40, desc: 'Миттєво зупиняє сильну кровотечу, повертає HP.', dropWeight: 20 },
  ],
  medical_rad: [
    { id: 'antirad', name: 'Ампула "Астат-Блок"', type: 'medical_rad', count: 0, value: 0, desc: 'Нейтралізує гострий радіаційний синдром.', dropWeight: 15 },
    { id: 'rad_pills', name: 'Таблетки йодиду калію', type: 'medical_rad', count: 0, value: 0, desc: 'Знімає легке радіаційне опромінення.', dropWeight: 40 },
  ],
  material: [
    // ГОЛОВНА ВАЛЮТА І ЛУТ ВОДНОЧАС
    { id: 'microchip', name: 'Мікросхема', type: 'material', count: 0, value: 1, desc: 'Вціліла кремнієва плата логіки. Універсальна тверда валюта та основа технологій.', dropWeight: 10 },
    { id: 'scrap', name: 'Електронний брухт', type: 'material', count: 0, value: 0, desc: 'Цінні радіодеталі для модифікацій табору.', dropWeight: 70 },
    { id: 'copper_wire', name: 'Мідний дріт', type: 'material', count: 0, value: 0, desc: 'Котушка старого мідного дроту.', dropWeight: 90 },
    { id: 'duct_tape', name: 'Армований скотч', type: 'material', count: 0, value: 0, desc: 'Універсальний інструмент виживанця.', dropWeight: 60 },
    { id: 'batteries', name: 'Старі батарейки', type: 'material', count: 0, value: 0, desc: 'Ще мають трохи заряду для ліхтарика.', dropWeight: 80 },
  ],
  rare: [
    { id: 'radio_station', name: 'Радіостанція Р-159', type: 'rare', count: 0, value: 0, desc: 'Переносна тактична радіостанція. Відкриває доступ до глобальних частот.', dropWeight: 4 },
    { id: 'astat_shard', name: 'Осколок Астату-211', type: 'rare', count: 0, value: 0, desc: 'Надважка аномальна фракція для експедиційного синтезу.', dropWeight: 3 },
    { id: 'encrypted_drive', name: 'Зашифрований накопичувач', type: 'rare', count: 0, value: 0, desc: 'Військовий флеш-накопичувач. Потребує дешифрування.', dropWeight: 5 },
  ],
  junk: [
    { id: 'broken_glass', name: 'Бите скло', type: 'junk', count: 0, value: 0, desc: 'Не має практичної цінності. Тільки місце займає.', dropWeight: 100 },
    { id: 'empty_cans', name: 'Порожні бляшанки', type: 'junk', count: 0, value: 0, desc: 'Колись тут була їжа.', dropWeight: 120 },
    { id: 'old_newspaper', name: 'Стара газета', type: 'junk', count: 0, value: 0, desc: 'Датована днем до катаклізму. Можна розпалити вогнище.', dropWeight: 80 },
    { id: 'rusty_nail', name: 'Іржавий цвях', type: 'junk', count: 0, value: 0, desc: 'Обережно, не пробийте черевик.', dropWeight: 110 },
    { id: 'child_toy', name: 'Зламана іграшка', type: 'junk', count: 0, value: 0, desc: 'Моторошне нагадування про минуле життя.', dropWeight: 30 },
  ]
};

export const getRandomLoot = (): InventoryItem => {
  const allLoot = Object.values(LOOT_DICTIONARY).flat();
  const totalWeight = allLoot.reduce((sum, item) => sum + item.dropWeight, 0);
  let randomVal = Math.random() * totalWeight;

  for (const item of allLoot) {
    randomVal -= item.dropWeight;
    if (randomVal <= 0) {
      const { dropWeight, ...inventoryItem } = item;
      return { ...inventoryItem, count: 1 };
    }
  }

  const fallback = allLoot[0];
  const { dropWeight, ...fallbackItem } = fallback;
  return { ...fallbackItem, count: 1 };
};

export const INITIAL_AWAKENING_INVENTORY: InventoryItem[] = [
  { id: 'ration', name: 'Армійський сухпай', type: 'food', count: 3, value: 35, desc: 'Стандартний армійський пайок.' },
  { id: 'bandage', name: 'Гемостатичний бинт', type: 'medical_bleed', count: 2, value: 20, desc: 'Зупиняє кровотечу і повертає HP.' },
  { id: 'antirad', name: 'Ампула "Астат-Блок"', type: 'medical_rad', count: 1, value: 0, desc: 'Нейтралізує гострий радіаційний синдром.' },
  { id: 'microchip', name: 'Мікросхема', type: 'material', count: 0, value: 1, desc: 'Вціліла кремнієва плата логіки. Універсальна тверда валюта та основа технологій.' }
];