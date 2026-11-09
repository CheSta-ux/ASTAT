import type { InventoryItem } from '../types/game';
import { supabase } from '../lib/supabase';

export interface LootDefinition extends InventoryItem {
  dropWeight: number;
}

// Єдиний аварійний предмет на випадок повного обриву зв'язку з Supabase
const EMERGENCY_FALLBACK_LOOT: LootDefinition[] = [
  {
    id: 'scrap',
    name: 'Електронний брухт',
    type: 'material',
    count: 1,
    value: 0,
    desc: 'Уламки заліза та мідного дроту.',
    dropWeight: 100
  }
];

// Живий пул луту, який наповнюється виключно з Supabase
let dynamicLootPool: LootDefinition[] = [];

// Асинхронне завантаження актуального довідника предметів
export const loadLootFromSupabase = async (): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('loot_items')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    if (data && data.length > 0) {
      dynamicLootPool = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        type: item.type as any,
        count: 0,
        value: item.value,
        desc: item.description,
        dropWeight: item.drop_weight
      }));
      console.log(`📦 Завантажено ${dynamicLootPool.length} предметів луту з Supabase`);
    }
  } catch (err) {
    console.warn('Supabase недоступний, активовано аварійний лут:', err);
  }
};

// Запуск завантаження при старті
loadLootFromSupabase();

export const getRandomLoot = (): InventoryItem => {
  const pool = dynamicLootPool.length > 0 ? dynamicLootPool : EMERGENCY_FALLBACK_LOOT;
  const totalWeight = pool.reduce((sum, item) => sum + item.dropWeight, 0);
  let randomVal = Math.random() * totalWeight;

  for (const item of pool) {
    randomVal -= item.dropWeight;
    if (randomVal <= 0) {
      const { dropWeight: _, ...inventoryItem } = item;
      return { ...inventoryItem, count: 1 };
    }
  }

  const { dropWeight: _, ...fallbackItem } = pool[0];
  return { ...fallbackItem, count: 1 };
};

// Стартовий набір спорядження для нового виживанця
export const INITIAL_AWAKENING_INVENTORY: InventoryItem[] = [
  { id: 'ration', name: 'Армійський сухпай', type: 'food', count: 3, value: 35, desc: 'Стандартний армійський пайок.' },
  { id: 'bandage', name: 'Гемостатичний бинт', type: 'medical_bleed', count: 2, value: 20, desc: 'Зупиняє кровотечу і повертає HP.' },
  { id: 'antirad', name: 'Ампула "Астат-Блок"', type: 'medical_rad', count: 1, value: 0, desc: 'Нейтралізує гострий радіаційний синдром.' }
];