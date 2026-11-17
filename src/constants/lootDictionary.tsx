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

  // 1. ДОРОГИ, ПУТІВЦІ ТА УЗБІЧЧЯ (перевіряємо до лісу, щоб "Лісова колія" не потрапляла в чистий ліс)
  if (
    b.includes('road') ||
    b.includes('highway') ||
    b.includes('railway') ||
    b.includes('дорог') ||
    b.includes('колія') ||
    b.includes('узбіч') ||
    b.includes('шлях') ||
    b.includes('проїзд')
  ) {
    if (category === 'nature' || ['pine_branches', 'pine_resin', 'birch_bark', 'wild_berries', 'forest_mushrooms', 'wheat_stalks'].includes(itemId)) {
      return 0.0;
    }
    if (['empty_cans', 'broken_glass', 'rusty_nail', 'rag', 'old_newspaper'].includes(itemId)) return 2.8;
    if (['duct_tape', 'batteries', 'copper_wire', 'scrap', 'bale_wire'].includes(itemId)) return 1.8;
    if (['energy_bar', 'dirty_water', 'bandage', 'energy_water'].includes(itemId)) return 1.4;
    if (['microchip', 'ration', 'canned_meat', 'tourniquet', 'rad_pills'].includes(itemId)) return 0.5;
    return 0.6;
  }

  // 2. ЗАВОДИ, ПІДСТАНЦІЇ, МАЙСТЕРНІ, АНГАРИ ТА ПРОМЗОНИ
  if (
    b.includes('factory') ||
    b.includes('bunker') ||
    b.includes('depot') ||
    b.includes('завод') ||
    b.includes('ангар') ||
    b.includes('майстерн') ||
    b.includes('підстанц') ||
    b.includes('промислов') ||
    b.includes('промзон')
  ) {
    if (category === 'nature') return 0.0;
    if (['microchip', 'copper_wire', 'batteries', 'fuse', 'lead_plate'].includes(itemId)) return 3.5;
    if (['scrap', 'duct_tape', 'antiseptic', 'radio_station', 'encrypted_drive'].includes(itemId)) return 2.2;
    if (['ration', 'tourniquet', 'antirad'].includes(itemId)) return 1.4;
    return 1.0;
  }

  // 3. РУЇНИ, САДИБИ, КОРПУСИ ТА ЗАБУДОВА
  if (
    b.includes('ruin') ||
    b.includes('build') ||
    b.includes('urban') ||
    b.includes('садиб') ||
    b.includes('споруд') ||
    b.includes('селищ') ||
    b.includes('корпус') ||
    b.includes('будівел') ||
    b.includes('розвалин')
  ) {
    if (category === 'nature' || ['pine_branches', 'pine_resin', 'birch_bark', 'wild_berries', 'forest_mushrooms', 'wheat_stalks'].includes(itemId)) {
      return 0.0;
    }
    if (['microchip', 'copper_wire', 'batteries', 'fuse', 'duct_tape', 'lead_plate', 'antiseptic'].includes(itemId)) return 2.5;
    if (['scrap', 'broken_glass', 'rusty_nail', 'empty_cans', 'old_newspaper', 'rag', 'child_toy'].includes(itemId)) return 2.0;
    if (['ration', 'canned_meat', 'energy_bar', 'bandage', 'tourniquet', 'rad_pills', 'antirad'].includes(itemId)) return 1.5;
    if (['radio_station', 'encrypted_drive'].includes(itemId)) return 1.2;
    return 1.0;
  }

  // 4. ЛІСОВІ СЕКТОРИ (хвойний масив, бір, гай, посадка, хащі, просіка, вітролом)
  if (
    b.includes('forest') ||
    b.includes('ліс') ||
    b.includes('гай') ||
    b.includes('посадк') ||
    b.includes('хащ') ||
    b.includes('бір') ||
    b.includes('просік') ||
    b.includes('вітролом') ||
    b.includes('вибалок')
  ) {
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

  // 5. ПОЛЯ, ЛУКИ, РІЛЛЯ ТА КАМ'ЯНИСТІ ВИСОЧИНИ
  if (
    b.includes('field') ||
    b.includes('hills') ||
    b.includes('mountain') ||
    b.includes('поле') ||
    b.includes('лук') ||
    b.includes('рілл') ||
    b.includes('пустир') ||
    b.includes('рівнин') ||
    b.includes('пасовищ') ||
    b.includes('переліг') ||
    b.includes('схил') ||
    b.includes('уступ') ||
    b.includes('пагорб') ||
    b.includes('кар\'єр') ||
    b.includes('кряж') ||
    b.includes('урвищ') ||
    b.includes('сідловин')
  ) {
    if (['wheat_stalks', 'rosehip', 'wild_garlic', 'flint_stone', 'bale_wire'].includes(itemId)) return 3.5;
    if (['stout_stick', 'wild_berries'].includes(itemId)) return 1.5;
    if (['rusty_nail', 'empty_cans', 'broken_glass', 'scrap'].includes(itemId)) return 1.2;
    if (['microchip', 'batteries', 'copper_wire', 'fuse'].includes(itemId)) return 0.03;
    return 0.3;
  }

  // 6. БЕРЕГОВА СМУГА, ЗАПЛАВИ ТА ЗАБОЛОЧЕНІ НИЗИНИ
  if (
    b.includes('swamp') ||
    b.includes('water') ||
    b.includes('coast') ||
    b.includes('берег') ||
    b.includes('низин') ||
    b.includes('мілин') ||
    b.includes('заплав') ||
    b.includes('місток') ||
    b.includes('болот')
  ) {
    if (['moss_sphagnum', 'dirty_water', 'toxic_mushroom'].includes(itemId)) return 3.5;
    if (['empty_cans', 'broken_glass', 'rag', 'bale_wire'].includes(itemId)) return 1.2;
    if (['microchip', 'batteries', 'pine_resin'].includes(itemId)) return 0.02;
    return 0.4;
  }

  // 7. АНОМАЛЬНІ СЕКТОРИ
  if (
    b.includes('crater') ||
    b.includes('anomaly') ||
    b.includes('аномал') ||
    b.includes('воронк') ||
    b.includes('розлом') ||
    b.includes('викривлен') ||
    b.includes('викид')
  ) {
    if (['astat_shard', 'anomaly_crystal', 'radioactive_dust', 'quantum_capacitor'].includes(itemId)) return 6.0;
    if (['scrap', 'broken_glass'].includes(itemId)) return 1.5;
    return 0.1;
  }

  return 1.0;
};

// Контекстний пошук предметів відповідно до місцевості
export const getRandomLoot = (
  sectorBiome: string = 'forest',
  sectorName: string = '',
  preferredIds?: string[]
): InventoryItem => {
  const pool = dynamicLootPool.length > 0 ? dynamicLootPool : EMERGENCY_FALLBACK_LOOT;
  const context = `${sectorBiome} ${sectorName}`.toLowerCase();

  const weightedPool = pool
    .map((item) => {
      const mult = getBiomeMultiplier(item.id, item.category, context);
      const preferenceBoost = preferredIds?.includes(item.id) ? 3.0 : 1.0;
      return {
        item,
        effectiveWeight: Math.max(0, item.dropWeight * mult * preferenceBoost)
      };
    })
  .filter((entry) => entry.effectiveWeight > 0);

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