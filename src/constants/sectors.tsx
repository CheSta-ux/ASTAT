import { InventoryItem, SectorDefinition } from '../types/game';

export const SECTOR_TYPES: SectorDefinition[] = [
  { id: 'forest', name: 'Мертвий хвойний гай', icon: '🌲', radHazard: 0.1, desc: 'Покривлені чорні сосни, що пахнуть озоном і гниллю.' },
  { id: 'ruins', name: 'Руїни КПП "Зоря"', icon: '🏚️', radHazard: 0.2, desc: 'Бетонні перекриття, потрощені військові броньовики.' },
  { id: 'crater', name: 'Аномальна воронка "Астат"', icon: '☄️', radHazard: 0.6, desc: 'Флуоресцентний ґрунт, що пульсує рідкісним металоїдом.' },
  { id: 'hills', name: 'Скелясті пустоші', icon: '⛰️', radHazard: 0.15, desc: 'Пронизливий вітер розносить дрібний сірий пил.' },
  { id: 'bunker', name: 'Запечатаний гермобункер', icon: '🚪', radHazard: 0.35, desc: 'Сталеві масивні стулки зі слідами спроб автогенного різання.' },
  { id: 'swamp', name: 'Кислотні драговини', icon: '☣️', radHazard: 0.5, desc: 'Шиплячі калюжі випаровують отруйний жовтуватий туман.' },
  { id: 'highway', name: 'Шосе М-07 "Варшавка"', icon: '🛣️', radHazard: 0.1, desc: 'Розірваний асфальт, черги заіржавілих цивільних автівок.' }
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  { id: 'ration', name: 'Армійський сухпай', count: 3, type: 'food', value: 35, desc: 'Відновлює 35% ситості.' },
  { id: 'bandage', name: 'Гемостатичний бинт', count: 2, type: 'medical_bleed', value: 20, desc: 'Зупиняє кровотечу і повертає 20 HP.' },
  { id: 'antirad', name: 'Ампула "Астат-Блок"', count: 1, type: 'medical_rad', value: 0, desc: 'Нейтралізує гострий радіаційний синдром.' },
  { id: 'scrap', name: 'Електронний брухт', count: 8, type: 'material', value: 5, desc: 'Цінні радіодеталі для модифікацій табору.' },
  { id: 'isotope', name: 'Осколок Астату-211', count: 2, type: 'rare', value: 50, desc: 'Надважка аномальна фракція для експедиційного синтезу.' }
];