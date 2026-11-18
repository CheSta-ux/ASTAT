import type { Specialization } from '../types/game';

export type SearchEventBiome = 'forest' | 'road' | 'urban' | 'industrial' | 'field' | 'coast' | 'mountain' | 'anomaly';

export interface SearchEventChoice {
  id: string;
  label: string;
  sublabel: string;
  riskLevel: 'low' | 'medium' | 'high' | 'class';
  requiredSpec?: Specialization;
  lootChance: number;       // 0..1 шанс знайти предмет
  bonusChipChance?: number; // 0..1 додатковий шанс знайти мікросхему
  trapChance: number;       // 0..1 шанс отримати поранення та кровотечу
  trapDamage: number;       // базова шкода від пастки
  radChance?: number;       // 0..1 шанс отримати променеве отруєння
  healBonus?: number;       // відновлення HP при успіху (наприклад, для Медика)
  preferredLootIds?: string[]; // пріоритетні предмети для цієї дії
  successNarrative: string;
  emptyNarrative: string;
  trapNarrative: string;
}

export interface SearchEventScenario {
  id: string;
  biome: SearchEventBiome;
  title: string;
  situation: string;
  choices: SearchEventChoice[];
}

export const SEARCH_EVENT_SCENARIOS: SearchEventScenario[] = [
  // ================= 1. ЛІС =================
  {
    id: 'forest_buried_pack',
    biome: 'forest',
    title: 'Прихований схрон під корінням',
    situation:
      'Між вивернутим корінням старої сосни видніється край вологого брезентового рюкзака. Мох навколо підозріло примʼятий, а в гілках натягнутий тонкий сталевий дріт.',
    choices: [
      {
        id: 'cautious_probe',
        label: 'Обережно підчепити гілкою здалеку',
        sublabel: 'Безпечно перевірити вміст • Низький ризик',
        riskLevel: 'low',
        lootChance: 0.62,
        trapChance: 0.06,
        trapDamage: 10,
        successNarrative: 'Ви обережно витягли рюкзак довгою палицею, оминувши старий мисливський самостріл.',
        emptyNarrative: 'Рюкзак виявився прогнилим і майже порожнім — усе цінне забрали до вас.',
        trapNarrative: 'Гілка зірвалася, і старий іржавий капкан боляче клацнув по нозі!'
      },
      {
        id: 'deep_dig',
        label: 'Розкопати яму голіруч',
        sublabel: 'Високий шанс знахідки • Ризик пастки',
        riskLevel: 'high',
        lootChance: 0.88,
        bonusChipChance: 0.2,
        trapChance: 0.34,
        trapDamage: 18,
        preferredLootIds: ['canned_meat', 'ration', 'bandage', 'shotgun_shell', 'pine_resin'],
        successNarrative: 'Під шаром хвої та брезенту зберігся герметичний пакунок із припасами!',
        emptyNarrative: 'Ви перерили яму під корінням, але знайшли лише порожні гільзи й мокре листя.',
        trapNarrative: 'Під час розкопок ви зачепили приховану розтяжку! Уламки посікли руки.'
      },
      {
        id: 'scout_disarm',
        label: 'Вистежити та зняти розтяжку',
        sublabel: 'Навичка Розвідника • Гарантована безпека',
        riskLevel: 'class',
        requiredSpec: 'scout',
        lootChance: 0.92,
        bonusChipChance: 0.25,
        trapChance: 0.0,
        trapDamage: 0,
        preferredLootIds: ['ration', 'canned_meat', 'bandage', 'shotgun_shell'],
        successNarrative: 'Око розвідника миттєво помітило дріт. Ви знешкодили пастку та забрали весь вміст схрону.',
        emptyNarrative: 'Ви безпечно зняли розтяжку, проте попередній власник встиг винести майже все.',
        trapNarrative: ''
      }
    ]
  },
  {
    id: 'forest_resin_hollow',
    biome: 'forest',
    title: 'Повалені стовбури та густий підлісок',
    situation:
      'У глухому буреломі помітні сліди давньої стоянки: обвуглене багаття, старі бляшанки та сосни з рясними патьоками густої смоли.',
    choices: [
      {
        id: 'gather_surface',
        label: 'Зібрати лісові ресурси навколо стоянки',
        sublabel: 'Спокійний збір • Мінімальний ризик',
        riskLevel: 'low',
        lootChance: 0.72,
        trapChance: 0.05,
        trapDamage: 10,
        preferredLootIds: ['pine_resin', 'pine_branches', 'birch_bark', 'forest_mushrooms', 'wild_berries'],
        successNarrative: 'Ви акуратно зібрали придатні лісові ресурси поблизу старої стоянки.',
        emptyNarrative: 'Навколо стоянки залишилися лише сирі гілки та попіл.',
        trapNarrative: 'Ви оступилися на слизькому стовбурі й глибоко розрізали долоню об гострий сук.'
      },
      {
        id: 'medic_herbal',
        label: 'Відібрати цілющий мох і дикороси',
        sublabel: 'Навичка Медика • +5 HP при огляді',
        riskLevel: 'class',
        requiredSpec: 'medic',
        lootChance: 0.9,
        trapChance: 0.0,
        trapDamage: 0,
        healBonus: 5,
        preferredLootIds: ['moss_sphagnum', 'wild_berries', 'forest_mushrooms', 'spring_water'],
        successNarrative: 'Ви безпомилково відібрали чистий сфагнум та їстівні плоди, заодно обробивши дрібні подряпини.',
        emptyNarrative: 'Рослинність у цій низині виявилася надто виснаженою.',
        trapNarrative: ''
      }
    ]
  },

  // ================= 2. ДОРОГИ ТА УЗБІЧЧЯ =================
  {
    id: 'road_abandoned_vehicle',
    biome: 'road',
    title: 'Перекинутий фургон на узбіччі',
    situation:
      'У кюветі край дороги лежить заіржавілий вантажний фургон із напіввідчиненими задніми стулками. Всередині темно, пахне старим мастилом і паливом.',
    choices: [
      {
        id: 'check_cab',
        label: 'Оглянути кабіну та бардачок',
        sublabel: 'Швидкий огляд • Низький ризик',
        riskLevel: 'low',
        lootChance: 0.65,
        trapChance: 0.08,
        trapDamage: 12,
        preferredLootIds: ['rag', 'old_newspaper', 'empty_cans', 'batteries', 'duct_tape'],
        successNarrative: 'У кабіні під сидінням вдалося знайти вцілілі дрібниці водія.',
        emptyNarrative: 'Кабіна виявилася повністю випотрошеною мародерами.',
        trapNarrative: 'Ви порізалися об розбите лобове скло, тягнучись до бардачка.'
      },
      {
        id: 'crawl_cargo',
        label: 'Залізти в темний кузов під завал ящиків',
        sublabel: 'Високий шанс луту • Ризик обвалу',
        riskLevel: 'high',
        lootChance: 0.86,
        bonusChipChance: 0.25,
        trapChance: 0.35,
        trapDamage: 18,
        preferredLootIds: ['duct_tape', 'copper_wire', 'batteries', 'energy_bar', 'bandage'],
        successNarrative: 'У глибині кузова серед розбитих ящиків зберігся вцілілий ремонтний набір!',
        emptyNarrative: 'Усі ящики в кузові виявилися порожніми й засипаними битим склом.',
        trapNarrative: 'Металевий стелаж усередині фургона обвалився вам на плече!'
      },
      {
        id: 'soldier_breach',
        label: 'Вирвати заклинені двері силою',
        sublabel: 'Навичка Штурмовика • Безпечний штурм',
        riskLevel: 'class',
        requiredSpec: 'soldier',
        lootChance: 0.88,
        bonusChipChance: 0.2,
        trapChance: 0.0,
        trapDamage: 0,
        preferredLootIds: ['ration', 'duct_tape', 'batteries', 'copper_wire'],
        successNarrative: 'Ви одним ривком зірвали заіржавілі петлі, зафіксували кузов і забрали вцілілий вантаж.',
        emptyNarrative: 'Двері піддалися легко, але всередині гуляв лише вітер.',
        trapNarrative: ''
      }
    ]
  },

  // ================= 3. ЗАБУДОВА ТА РУЇНИ =================
  {
    id: 'urban_cellar_hatch',
    biome: 'urban',
    title: 'Напівзасипаний льох під руїнами',
    situation:
      'Серед уламків цегляної кладки видніються залізні дверцята старого погреба. Зі щілини тягне сирістю та затхлим повітрям.',
    choices: [
      {
        id: 'surface_rubble',
        label: 'Перевірити уламки навколо входу',
        sublabel: 'Без спускання вниз • Низький ризик',
        riskLevel: 'low',
        lootChance: 0.62,
        trapChance: 0.08,
        trapDamage: 12,
        preferredLootIds: ['broken_glass', 'rusty_nail', 'scrap', 'rag', 'empty_cans'],
        successNarrative: 'Серед битої цегли вдалося знайти корисний брухт і залишки спорядження.',
        emptyNarrative: 'На поверхні лише уламки шиферу та цегляний пил.',
        trapNarrative: 'Іржавий цвях пробив підошву, залишивши глибоку рану.'
      },
      {
        id: 'descend_cellar',
        label: 'Спуститися в темний льох',
        sublabel: 'Високий шанс цінних припасів • Ризик обвалу',
        riskLevel: 'high',
        lootChance: 0.87,
        bonusChipChance: 0.3,
        trapChance: 0.36,
        trapDamage: 18,
        preferredLootIds: ['canned_meat', 'ration', 'antiseptic', 'bandage', 'microchip'],
        successNarrative: 'На нижній полиці погреба збереглися старі запаси та герметичний футляр!',
        emptyNarrative: 'У льоху по коліно води — все давно зіпсувалося.',
        trapNarrative: 'Трухляві сходи провалилися під ногами, ви боляче впали на арматуру!'
      },
      {
        id: 'engineer_pry',
        label: 'Підперти перекриття та зламати замок',
        sublabel: 'Навичка Техніка • +35% шанс мікросхеми',
        riskLevel: 'class',
        requiredSpec: 'engineer',
        lootChance: 0.9,
        bonusChipChance: 0.35,
        trapChance: 0.0,
        trapDamage: 0,
        preferredLootIds: ['microchip', 'copper_wire', 'batteries', 'fuse', 'scrap'],
        successNarrative: 'Ви надійно розклинили балками вхід, розкрили ящик і дістали електроніку без жодної подряпини.',
        emptyNarrative: 'Ви безпечно відкрили приміщення, але всередині залишився тільки пил.',
        trapNarrative: ''
      }
    ]
  },

  // ================= 4. ПРОМЗОНА ТА СКЛАДИ =================
  {
    id: 'industrial_power_cabinet',
    biome: 'industrial',
    title: 'Силова розподільча шафа в цеху',
    situation:
      'У кутку напівзруйнованого цеху стоїть важка металева електрошафа зі збитим індикатором. Всередині видно плати, мідні шини та запобіжники, але ізоляція місцями обвуглена.',
    choices: [
      {
        id: 'outer_shelves',
        label: 'Оглянути верстак поруч із шафою',
        sublabel: 'Без лізання в проводку • Низький ризик',
        riskLevel: 'low',
        lootChance: 0.65,
        trapChance: 0.08,
        trapDamage: 12,
        preferredLootIds: ['scrap', 'duct_tape', 'rusty_nail', 'copper_wire'],
        successNarrative: 'На старому верстаку лежали придатні деталі та моток дроту.',
        emptyNarrative: 'На столі залишилася лише металева стружка.',
        trapNarrative: 'Ви зачепили гострий край розірваного листа бляхи.'
      },
      {
        id: 'rip_panels',
        label: 'Вирвати плати з силового блоку',
        sublabel: 'Високий шанс мікросхем • Ризик розряду/травми',
        riskLevel: 'high',
        lootChance: 0.88,
        bonusChipChance: 0.45,
        trapChance: 0.38,
        trapDamage: 20,
        preferredLootIds: ['microchip', 'copper_wire', 'fuse', 'lead_plate', 'batteries'],
        successNarrative: 'Вам вдалося витягти цілий блок із кремнієвими платами та мідними контактами!',
        emptyNarrative: 'Усі плати всередині виявилися вигорілими вщент.',
        trapNarrative: 'Залишковий заряд конденсатора вдарив по руках, а гострий кожух розрізав долоню!'
      },
      {
        id: 'engineer_discharge',
        label: 'Розрядити контур і акуратно демонтувати вузли',
        sublabel: 'Навичка Техніка • Максимальний вихід плат',
        riskLevel: 'class',
        requiredSpec: 'engineer',
        lootChance: 0.94,
        bonusChipChance: 0.5,
        trapChance: 0.0,
        trapDamage: 0,
        preferredLootIds: ['microchip', 'copper_wire', 'fuse', 'lead_plate'],
        successNarrative: 'Ви заземлили контур викруткою та професійно витягли вцілілі мікросхеми й деталі.',
        emptyNarrative: 'Вузол виявився заздалегідь демонтованим іншим техніком.',
        trapNarrative: ''
      }
    ]
  },

  // ================= 5. ПОЛЯ, ЛУКИ ТА ВИСОЧИНИ =================
  {
    id: 'field_abandoned_camp',
    biome: 'field',
    title: 'Покинутий спостережний пост у траві',
    situation:
      'Серед високого полину та сухостою видніються обкладені камінням залишки бліндажа та заіржавілий металевий ящик.',
    choices: [
      {
        id: 'check_perimeter',
        label: 'Обійти позицію по колу',
        sublabel: 'Обережний огляд • Низький ризик',
        riskLevel: 'low',
        lootChance: 0.66,
        trapChance: 0.06,
        trapDamage: 10,
        preferredLootIds: ['wheat_stalks', 'rosehip', 'bale_wire', 'flint_stone', 'stout_stick'],
        successNarrative: 'На краю позиції ви зібрали корисні польові матеріали та дріт.',
        emptyNarrative: 'Вітер давно розніс усе, що залишалося на відкритому полі.',
        trapNarrative: 'У густій траві ви наступили на прихований моток колючого дроту!'
      },
      {
        id: 'open_ammo_box',
        label: 'Відкрити заклинений металевий ящик',
        sublabel: 'Високий шанс припасів • Ризик пастки',
        riskLevel: 'high',
        lootChance: 0.85,
        bonusChipChance: 0.2,
        trapChance: 0.3,
        trapDamage: 16,
        preferredLootIds: ['ration', 'bandage', 'tourniquet', 'scrap', 'flint_stone'],
        successNarrative: 'Кришка піддалася — всередині виявився сухий недоторканий запас!',
        emptyNarrative: 'Ящик був набитий лише мокрим ганчірʼям.',
        trapNarrative: 'Кришка зірвалася, а пружинний фіксатор глибоко розсік пальці!'
      },
      {
        id: 'scout_recon',
        label: 'Просканувати підходи до бліндажа',
        sublabel: 'Навичка Розвідника • Безпечний обшук',
        riskLevel: 'class',
        requiredSpec: 'scout',
        lootChance: 0.9,
        bonusChipChance: 0.25,
        trapChance: 0.0,
        trapDamage: 0,
        preferredLootIds: ['ration', 'bandage', 'bale_wire', 'flint_stone'],
        successNarrative: 'Ви прочитали сліди навколо поста, оминули колючий дріт і забрали припаси.',
        emptyNarrative: 'Позиція була залишена організовано — усе вивезли ще раніше.',
        trapNarrative: ''
      }
    ]
  },

  // ================= 6. БЕРЕГ ТА ЗАПЛАВИ =================
  {
    id: 'coast_washed_crate',
    biome: 'coast',
    title: 'Прибитий до берега герметичний контейнер',
    situation:
      'В очереті на мілководді застряг пластиковий контейнер зі слідами мулу. Дістатися до нього можна по слизьких каменях.',
    choices: [
      {
        id: 'shore_search',
        label: 'Оглянути лише суху берегову смугу',
        sublabel: 'Не заходити у воду • Низький ризик',
        riskLevel: 'low',
        lootChance: 0.65,
        trapChance: 0.06,
        trapDamage: 10,
        preferredLootIds: ['moss_sphagnum', 'empty_cans', 'rag', 'bale_wire'],
        successNarrative: 'Уздовж берега вдалося зібрати мох сфагнум та вцілілий мотлох.',
        emptyNarrative: 'На березі лише мул та сухий очерет.',
        trapNarrative: 'Ви послизнулися на мокрому камінні й розбили коліно.'
      },
      {
        id: 'wade_container',
        label: 'Пробратися по слизьких плитах до контейнера',
        sublabel: 'Високий шанс луту • Ризик травми та радіації',
        riskLevel: 'high',
        lootChance: 0.88,
        bonusChipChance: 0.25,
        trapChance: 0.32,
        trapDamage: 16,
        radChance: 0.2,
        preferredLootIds: ['antirad', 'bandage', 'canned_meat', 'duct_tape', 'dirty_water'],
        successNarrative: 'Контейнер виявився герметичним — усередині збереглися медикаменти та припаси!',
        emptyNarrative: 'Корпус контейнера дав тріщину, і вода знищила весь вміст.',
        trapNarrative: 'Нога зірвалася зі слизької бетонної плити прямо на іржаву арматуру!'
      },
      {
        id: 'medic_sanitize',
        label: 'Оглянути контейнер та продезінфікувати вміст',
        sublabel: 'Навичка Медика • Без зараження +5 HP',
        riskLevel: 'class',
        requiredSpec: 'medic',
        lootChance: 0.9,
        trapChance: 0.0,
        trapDamage: 0,
        healBonus: 5,
        preferredLootIds: ['antirad', 'bandage', 'antiseptic', 'moss_sphagnum'],
        successNarrative: 'Ви обережно витягли вцілілі ампули та перевʼязувальні пакети, знезаразивши руки.',
        emptyNarrative: 'Всередині виявилися лише розбиті скляні флакони.',
        trapNarrative: ''
      }
    ]
  }
];

export const getSearchEventForBiome = (
  biome: string,
  sectorName: string,
  spec: Specialization,
  excludeScenarioId?: string
): SearchEventScenario => {
  const ctx = `${biome} ${sectorName}`.toLowerCase();

  let normalizedBiome: SearchEventBiome = 'forest';
  if (ctx.includes('anomaly') || ctx.includes('crater') || ctx.includes('аномал') || ctx.includes('воронк')) {
    normalizedBiome = 'industrial';
  } else if (
    ctx.includes('road') ||
    ctx.includes('highway') ||
    ctx.includes('дорог') ||
    ctx.includes('колія') ||
    ctx.includes('узбіч') ||
    ctx.includes('шлях')
  ) {
    normalizedBiome = 'road';
  } else if (
    ctx.includes('factory') ||
    ctx.includes('industrial') ||
    ctx.includes('ангар') ||
    ctx.includes('майстерн') ||
    ctx.includes('підстанц') ||
    ctx.includes('промзон')
  ) {
    normalizedBiome = 'industrial';
  } else if (
    ctx.includes('urban') ||
    ctx.includes('ruin') ||
    ctx.includes('build') ||
    ctx.includes('садиб') ||
    ctx.includes('споруд') ||
    ctx.includes('селищ') ||
    ctx.includes('корпус')
  ) {
    normalizedBiome = 'urban';
  } else if (
    ctx.includes('coast') ||
    ctx.includes('water') ||
    ctx.includes('swamp') ||
    ctx.includes('берег') ||
    ctx.includes('низин') ||
    ctx.includes('мілин') ||
    ctx.includes('заплав')
  ) {
    normalizedBiome = 'coast';
  } else if (
    ctx.includes('field') ||
    ctx.includes('mountain') ||
    ctx.includes('поле') ||
    ctx.includes('лук') ||
    ctx.includes('рілл') ||
    ctx.includes('пустир') ||
    ctx.includes('схил') ||
    ctx.includes('пагорб')
  ) {
    normalizedBiome = 'field';
  }

  const matching = SEARCH_EVENT_SCENARIOS.filter((s) => s.biome === normalizedBiome);
  const basePool = matching.length > 0 ? matching : SEARCH_EVENT_SCENARIOS;
  const filteredPool = excludeScenarioId
    ? basePool.filter((s) => s.id !== excludeScenarioId)
    : basePool;
  const pool = filteredPool.length > 0 ? filteredPool : basePool;
  const scenario = pool[Math.floor(Math.random() * pool.length)];

  const availableChoices = scenario.choices.filter(
    (c) => !c.requiredSpec || c.requiredSpec === spec
  );

  return {
    ...scenario,
    choices: availableChoices
  };
};