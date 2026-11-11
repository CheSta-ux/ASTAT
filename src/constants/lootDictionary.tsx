import type { InventoryItem } from '../types/game';
import { supabase } from '../lib/supabase';

export interface LootDefinition extends InventoryItem {
  dropWeight: number;
  category?: string;
}

// Аварійний пул предметів на випадок відсутності інтернету (охоплює ліс, руїни та поле)
const EMERGENCY_FALLBACK_LOOT: LootDefinition[] = [
  { id: 'pine_branches', name: 'Сухе соснове гілля', type: 'material', count: 1, value: 0, desc: 'Хмиз для вогнища.', dropWeight: 100, category: 'nature' },
  { id: 'forest_mushrooms', name: 'Дикі гриби (Лисички)', type: 'food', count: 1, value: 18, desc: 'Їстівні лісові гриби.', dropWeight: 90, category: 'nature' },
  { id: 'wild_berries', name: 'Лісові ягоди', type: 'food', count: 1, value: 12, desc: 'Кисло-солодкі ягоди.', dropWeight: 80, category: 'nature' },
  { id: 'scrap', name: 'Електронний брухт', type: 'material', count: 1, value: 0, desc: 'Уламки заліза та дроту.', dropWeight: 70, category: 'material' },
  { id: 'bandage', name: 'Гемостатичний бинт', type: 'medical_bleed', count: 1, value: 20, desc: 'Зупиняє кровотечу.', dropWeight: 40, category: 'medical_bleed' }
];

let dynamicLootPool: LootDefinition[] = [];

// Асинхронне завантаження з Supabase
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
        category: item.category,
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

loadLootFromSupabase();

// МАТРИЦЯ МНОЖНИКІВ ВАГИ ЛУТУ ЗА БІОМАМИ (БІОМНИЙ КОНТЕКСТ)
const getBiomeMultiplier = (itemId: string, category: string | undefined, biome: string): number => {
  const b = biome.toLowerCase();

  // 1. ЛІСОВІ СЕКТОРИ (forest, посадки, хащі, ліс)
  if (b.includes('forest') || b.includes('ліс') || b.includes('гай') || b.includes('посадк')) {
    // Природний лісовий лут (смола, гілки, ягоди, гриби, палиці)
    if (['pine_branches', 'pine_resin', 'birch_bark', 'stout_stick'].includes(itemId)) return 4.0;
    if (['wild_berries', 'forest_mushrooms', 'spring_water'].includes(itemId)) return 3.5;
    if (['moss_sphagnum', 'toxic_mushroom', 'rusty_trap', 'shotgun_shell'].includes(itemId)) return 2.0;
    if (['rag', 'empty_cans', 'broken_glass', 'rusty_nail'].includes(itemId)) return 0.8;
    if (['old_newspaper', 'dirty_water'].includes(itemId)) return 0.3;
    // Технічні предмети практично неможливі посеред лісу
    if (['scrap', 'bandage'].includes(itemId)) return 0.1;
    if (['energy_bar', 'canned_meat', 'ration', 'tourniquet', 'rad_pills', 'antirad'].includes(itemId)) return 0.04;
    if (['microchip', 'batteries', 'copper_wire', 'duct_tape', 'fuse', 'lead_plate', 'antiseptic'].includes(itemId)) return 0.01;
    if (['astat_shard', 'radio_station', 'encrypted_drive', 'anomaly_crystal'].includes(itemId)) return 0.005;
    return 0.1;
  }

  // 2. РУЇНИ / СПОРУДИ / КПП / СЕЛА (ruins, building, village, urban, highway)
  if (b.includes('ruin') || b.includes('build') || b.includes('urban') || b.includes('село') || b.includes('highway') || b.includes('railway')) {
    // У залізобетонних руїнах КПП не росте свіжа смола та лісові лисички
    if (category === 'nature' || ['pine_branches', 'pine_resin', 'birch_bark', 'wild_berries', 'forest_mushrooms', 'wheat_stalks'].includes(itemId)) {
      return 0.0;
    }
    if (['microchip', 'copper_wire', 'batteries', 'fuse', 'duct_tape', 'lead_plate', 'antiseptic'].includes(itemId)) return 2.5;
    if (['scrap', 'broken_glass', 'rusty_nail', 'empty_cans', 'old_newspaper', 'rag', 'child_toy'].includes(itemId)) return 2.0;
    if (['ration', 'canned_meat', 'energy_bar', 'bandage', 'tourniquet', 'rad_pills', 'antirad'].includes(itemId)) return 1.5;
    if (['radio_station', 'encrypted_drive'].includes(itemId)) return 1.2;
    return 1.0;
  }

  // 3. ЗАВОДИ / СКЛАДИ / БУНКЕРИ (factory, depot, bunker)
  if (b.includes('factory') || b.includes('bunker') || b.includes('depot') || b.includes('завод') || b.includes('база')) {
    if (category === 'nature') return 0.0;
    if (['microchip', 'copper_wire', 'batteries', 'fuse', 'lead_plate'].includes(itemId)) return 3.5;
    if (['scrap', 'duct_tape', 'antiseptic', 'radio_station', 'encrypted_drive'].includes(itemId)) return 2.0;
    if (['ration', 'tourniquet', 'antirad'].includes(itemId)) return 1.5;
    return 1.0;
  }

  // 4. ПОЛЯ ТА СТЕПОВІ ПУСТОШІ (field, hills)
  if (b.includes('field') || b.includes('hills') || b.includes('поле') || b.includes('пустош')) {
    if (['wheat_stalks', 'rosehip', 'wild_garlic', 'flint_stone', 'bale_wire'].includes(itemId)) return 3.5;
    if (['stout_stick', 'wild_berries'].includes(itemId)) return 1.5;
    if (['rusty_nail', 'empty_cans', 'broken_glass', 'scrap'].includes(itemId)) return 1.2;
    if (['microchip', 'batteries', 'copper_wire', 'fuse'].includes(itemId)) return 0.03;
    return 0.3;
  }

  // 5. БОЛОТА ТА ДРАГОВИНИ (swamp, water)
  if (b.includes('swamp') || b.includes('water') || b.includes('болот')) {
    if (['moss_sphagnum', 'dirty_water', 'toxic_mushroom'].includes(itemId)) return 3.5;
    if (['empty_cans', 'broken_glass', 'rag'].includes(itemId)) return 1.2;
    if (['microchip', 'batteries', 'pine_resin'].includes(itemId)) return 0.02;
    return 0.4;
  }

  // 6. АНОМАЛЬНІ СЕКТОРИ (crater, anomaly)
  if (b.includes('crater') || b.includes('anomaly') || b.includes('аномал')) {
    if (['astat_shard', 'anomaly_crystal', 'radioactive_dust', 'quantum_capacitor'].includes(itemId)) return 6.0;
    if (['scrap', 'broken_glass'].includes(itemId)) return 1.5;
    return 0.1;
  }

  return 1.0;
};

// Контекстний пошук предметів відповідно до місцевості
export const getRandomLoot = (sectorBiome: string = 'forest', sectorName: string = ''): InventoryItem => {
  const pool = dynamicLootPool.length > 0 ? dynamicLootPool : EMERGENCY_FALLBACK_LOOT;
  const context = `${sectorBiome} ${sectorName}`.toLowerCase();

  // Обчислення ефективної ваги кожного предмета в цьому біомі
  const weightedPool = pool.map((item) => {
    const mult = getBiomeMultiplier(item.id, item.category, context);
    return {
      item,
      effectiveWeight: Math.max(0, item.dropWeight * mult)
    };
  }).filter((entry) => entry.effectiveWeight > 0);

  const activePool = weightedPool.length > 0 ? weightedPool : pool.map((i) => ({ item: i, effectiveWeight: 1 }));
  const totalWeight = activePool.reduce((sum, entry) => sum + entry.effectiveWeight, 0);

  let randomVal = Math.random() * totalWeight;

  for (const entry of activePool) {
    randomVal -= entry.effectiveWeight;
    if (randomVal <= 0) {
      const { dropWeight: _, category: __, ...inventoryItem } = entry.item;
      return { ...inventoryItem, count: 1 };
    }
  }

  const { dropWeight: _, category: __, ...fallbackItem } = activePool[0].item;
  return { ...fallbackItem, count: 1 };
};

export const INITIAL_AWAKENING_INVENTORY: InventoryItem[] = [
  { id: 'ration', name: 'Армійський сухпай', type: 'food', count: 3, value: 35, desc: 'Стандартний армійський пайок.' },
  { id: 'bandage', name: 'Гемостатичний бинт', type: 'medical_bleed', count: 2, value: 20, desc: 'Зупиняє кровотечу і повертає HP.' },
  { id: 'antirad', name: 'Ампула "Астат-Блок"', type: 'medical_rad', count: 1, value: 0, desc: 'Нейтралізує гострий радіаційний синдром.' }
];