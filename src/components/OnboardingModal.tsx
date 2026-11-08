import React, { useState, useEffect } from 'react';
import { 
  UserCheck, Shield, Crosshair, Wrench, HeartPulse, MapPin, 
  Navigation, RefreshCw, Skull, AlertOctagon, Edit3, Check, 
  Waves, Terminal, Eye, Backpack, Radio, Sparkles, Loader2
} from 'lucide-react';
import type { Specialization, Coordinates } from '../types/game';
import { WORLD_COUNTRIES, AGGRESSOR_STATES } from '../constants/countries';
import { GLOBAL_SPAWN_POOL, SpawnLocation } from '../constants/spawns';
import { checkCoordinateIsWater } from '../utils/waterDetectorService';

interface OnboardingModalProps {
  onComplete: (data: {
    callsign: string;
    citizenship: string;
    specialization: Specialization;
    startCoords: Coordinates;
    isZombified: boolean;
    isWaterSpawn?: boolean;
    aggressorReason?: string;
  }) => void;
  onNotify: (msg: string, type: 'info' | 'warn' | 'danger' | 'success') => void;
}

const ROLES: { id: Specialization; title: string; desc: string; icon: any }[] = [
  { id: 'scout', title: 'Розвідник', desc: '+25% до швидкості маршу (4.5 → 5.6 км/год).', icon: Crosshair },
  { id: 'soldier', title: 'Штурмовик', desc: '+20% запасу HP, стійкість до засідок.', icon: Shield },
  { id: 'medic', title: 'Польовий медик', desc: 'Ефективна нейтралізація кровотеч та радіації.', icon: HeartPulse },
  { id: 'engineer', title: 'Технік', desc: '-50% вартості переносу бази та ремонту.', icon: Wrench }
];

const getRandomSpawns = () => {
  const shuffled = [...GLOBAL_SPAWN_POOL].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 4);
};

const checkIsRuTerritory = (lat: number, lng: number) => {
  return lat > 45 && lat < 82 && lng > 20 && lng < 180 && !(lat > 44 && lat < 52.5 && lng > 22 && lng < 40.2);
};

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete, onNotify }) => {
  const [stage, setStage] = useState<'prologue' | 'identity' | 'awakening'>('prologue');

  const [callsign, setCallsign] = useState('');
  const [countryCode, setCountryCode] = useState('UA');
  const [selectedRole, setSelectedRole] = useState<Specialization>('scout');
  const [availableSpawns, setAvailableSpawns] = useState<SpawnLocation[]>(getRandomSpawns);
  const [selectedSpawnIndex, setSelectedSpawnIndex] = useState(0);

  // Ручні або автовизначені координати
  const [customGps, setCustomGps] = useState<{
    lat: number;
    lng: number;
    name: string;
    isRu?: boolean;
    isWater?: boolean;
    elev?: number | null;
  } | null>(null);

  const [isManualInputOpen, setIsManualInputOpen] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualError, setManualError] = useState('');
  const [isVerifyingCoords, setIsVerifyingCoords] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isRerolling, setIsRerolling] = useState(false);

  // Стан пробудження
  const [awakeningStep, setAwakeningStep] = useState(0);
  const [isSearchingBag, setIsSearchingBag] = useState(false);

  const selectedAggressor = AGGRESSOR_STATES[countryCode];
  const isAggressorByCountry = Boolean(selectedAggressor);
  const isRuByCoords = Boolean(customGps?.isRu || (!customGps && (availableSpawns[selectedSpawnIndex] as any)?.isRu));
  const isZombified = isAggressorByCountry || isRuByCoords;
  const isWaterSpawn = Boolean(customGps?.isWater);

  const handleRerollSpawns = () => {
    setIsRerolling(true);
    setAvailableSpawns(getRandomSpawns());
    setSelectedSpawnIndex(0);
    setCustomGps(null);
    setIsManualInputOpen(false);
    setTimeout(() => setIsRerolling(false), 300);
  };

  // Резервне визначення по мережевому IP (працює завжди на ПК без GPS/Wi-Fi)
  const fallbackIpLocation = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) throw new Error('IP API error');
      const data = await res.json();
      
      const lat = Number(Number(data.latitude).toFixed(5));
      const lng = Number(Number(data.longitude).toFixed(5));
      const cityName = data.city ? `${data.city}, ${data.country_name}` : 'Мережева геопозиція (IP)';
      const inRu = checkIsRuTerritory(lat, lng);

      let waterCheck = { isWater: false, elevation: null as number | null };
      try {
        waterCheck = await checkCoordinateIsWater(lat, lng);
      } catch (err) {
        console.warn(err);
      }

      setCustomGps({
        lat,
        lng,
        name: inRu ? 'Поточна геолокація (територія рф)' : cityName,
        isRu: inRu,
        isWater: waterCheck.isWater,
        elev: waterCheck.elevation
      });
      setIsManualInputOpen(false);
      onNotify(`📍 Локацію зафіксовано: ${cityName} [${lat}°, ${lng}°]`, 'success');
    } catch (e) {
      console.warn('IP fallback failed:', e);
      onNotify('Оберіть локацію зі списку нижче або введіть через GPS.', 'info');
    } finally {
      setIsLocating(false);
    }
  };

  // Головна функція визначення геопозиції (Browser GPS -> IP Fallback)
  const requestRealLocation = (isAuto = false) => {
    setIsLocating(true);

    if (!navigator.geolocation) {
      fallbackIpLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = Number(pos.coords.latitude.toFixed(5));
          const lng = Number(pos.coords.longitude.toFixed(5));
          const inRu = checkIsRuTerritory(lat, lng);

          let waterCheck = { isWater: false, elevation: null as number | null };
          try {
            waterCheck = await checkCoordinateIsWater(lat, lng);
          } catch (err) {
            console.warn(err);
          }

          setCustomGps({
            lat,
            lng,
            name: inRu ? 'Поточна геолокація (територія рф)' : 'Моє реальне GPS місце',
            isRu: inRu,
            isWater: waterCheck.isWater,
            elev: waterCheck.elevation
          });
          setIsManualInputOpen(false);
          setIsLocating(false);
          onNotify(`📍 GPS зафіксовано: ${lat}° N, ${lng}° E`, 'success');
        } catch (err) {
          console.error(err);
          fallbackIpLocation();
        }
      },
      (error) => {
        console.warn('Browser GPS unavailable, switching to IP lookup:', error.message);
        if (!isAuto) {
          onNotify('Супутники недоступні, перемикаємось на IP-шлюз...', 'info');
        }
        fallbackIpLocation();
      },
      {
        enableHighAccuracy: false,
        timeout: 4000,
        maximumAge: 60000
      }
    );
  };

  // АВТОМАТИЧНИЙ ЗАПУСК при відкритті анкети
  useEffect(() => {
    if (stage === 'identity' && !customGps) {
      requestRealLocation(true);
    }
  }, [stage]);

  const handleApplyManualCoords = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');

    const lat = parseFloat(manualLat.replace(',', '.'));
    const lng = parseFloat(manualLng.replace(',', '.'));

    if (isNaN(lat) || isNaN(lng)) {
      setManualError('Введіть коректні числові значення.');
      return;
    }
    if (lat < -90 || lat > 90) {
      setManualError('Широта (Lat) повинна бути в межах від -90 до 90.');
      return;
    }
    if (lng < -180 || lng > 180) {
      setManualError('Довгота (Lng) повинна бути в межах від -180 до 180.');
      return;
    }

    setIsVerifyingCoords(true);
    const inRu = checkIsRuTerritory(lat, lng);
    const waterCheck = await checkCoordinateIsWater(lat, lng);
    setIsVerifyingCoords(false);

    setCustomGps({
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      name: `Ручні координати [${lat.toFixed(4)}°, ${lng.toFixed(4)}°]`,
      isRu: inRu,
      isWater: waterCheck.isWater,
      elev: waterCheck.elevation
    });
    setIsManualInputOpen(false);
  };

  const currentSelection = customGps || availableSpawns[selectedSpawnIndex];

  const handleIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!callsign.trim()) return;
    setStage('awakening');
  };

  const handleInspectBackpack = () => {
    setIsSearchingBag(true);

    setTimeout(() => {
      setAwakeningStep(1);
      onNotify('📦 Знайдено: Армійський сухпай (3 шт.)', 'success');
    }, 400);

    setTimeout(() => {
      setAwakeningStep(2);
      onNotify('🩹 Знайдено: Гемостатичний бинт (2 шт.)', 'success');
    }, 1300);

    setTimeout(() => {
      setAwakeningStep(3);
      onNotify('🧪 Знайдено: Дивна ампула «Астат-Блок» (1 шт.)', 'warn');
    }, 2200);

    setTimeout(() => {
      setAwakeningStep(4);
      onNotify('📡 Тактичний термінал запущено. Мікросхеми: 0 шт.', 'info');
      setIsSearchingBag(false);
    }, 3100);
  };

  const handleFinishAwakening = () => {
    const chosenCountryName = WORLD_COUNTRIES.find((c) => c.code === countryCode)?.name || 'Невизначено';

    let reason: string | undefined = undefined;
    if (selectedAggressor) {
      reason = `${selectedAggressor.status}: ${selectedAggressor.role}`;
    } else if (isRuByCoords) {
      reason = 'Точка висадки знаходиться на території рф. Режим тотальної ізоляції.';
    }

    onComplete({
      callsign: callsign.trim(),
      citizenship: chosenCountryName,
      specialization: selectedRole,
      startCoords: {
        x: 0,
        y: 0,
        lat: currentSelection.lat,
        lng: currentSelection.lng
      },
      isZombified,
      isWaterSpawn,
      aggressorReason: reason
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex items-center justify-center p-3 md:p-4">
      <div className="bg-[#0b120d] border-2 border-[#2b5936] rounded-xl max-w-xl w-full p-5 md:p-6 text-xs shadow-2xl overflow-y-auto max-h-[94vh] relative">
        
        {/* ================= ЕТАП 1: ПЕРЕДІСТОРІЯ ================= */}
        {stage === 'prologue' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1f3826] pb-3">
              <Terminal className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[#5ba16e] font-bold">ASTAT RPG // АРХІВНИЙ ПРОТОКОЛ</div>
                <h2 className="text-base md:text-lg font-bold text-slate-100">Каскадний розпад ізотопу Астат-211</h2>
              </div>
            </div>

            <div className="space-y-2.5 text-[#9cb5a2] text-xs leading-relaxed font-mono">
              <p>
                <b className="text-emerald-300">2027 рік.</b> Глобальний ланцюговий розпад нестабільного ізотопу <i>Астат-211</i> спричинив тектонічну та атмосферну деформацію материків.
              </p>
              <p>
                Міжнародні супутникові мережі замовкли, а енергосистеми згоріли під час гамма-спалаху. Цивілізація розпалася на ізольовані сектори, де колишні промислові комплекси, поля та річки стали небезпечною зоною відчуження.
              </p>
              <p className="border-l-2 border-[#376943] pl-2.5 italic text-[#cfdcce]">
                «Ті, хто залишився серед руїн, більше не мають доступу до централізованих банків чи урядів. Єдина валюта — вцілілі Мікросхеми та плати логіки, а єдиний шанс вижити — тактичний планшет та інстинкти.»
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setStage('identity')}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs rounded transition flex items-center justify-center gap-2 shadow-lg"
              >
                <Sparkles className="w-4 h-4" /> Відновити спогади про себе →
              </button>
            </div>
          </div>
        )}

        {/* ================= ЕТАП 2: ЗГАДКИ ПРО СЕБЕ ================= */}
        {stage === 'identity' && (
          <form onSubmit={handleIdentitySubmit} className="space-y-4">
            <div className="text-center mb-4 border-b border-[#1f3826] pb-2.5">
              <div className="text-[10px] uppercase tracking-widest text-[#5ba16e] font-bold">ЗГАДКИ ПРО СЕБЕ // ІДЕНТИФІКАЦІЯ</div>
              <h2 className="text-lg font-bold text-slate-100 mt-0.5">Ким ви були до катаклізму?</h2>
            </div>

            {/* Позивний */}
            <div>
              <label className="block text-[#8ea393] mb-1 font-bold">ВАШ ПОЗИВНИЙ В ЕФІРІ:</label>
              <input
                type="text"
                required
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="Введіть позивний або ім'я..."
                className="w-full bg-[#121c15] border border-[#2b4432] focus:border-emerald-500 rounded px-3 py-2 text-xs text-slate-100 outline-none font-mono"
              />
            </div>

            {/* Громадянство */}
            <div>
              <label className="block text-[#8ea393] mb-1 font-bold">ГРОМАДЯНСТВО / НАЦІОНАЛЬНІСТЬ:</label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className={`w-full bg-[#121c15] border rounded px-3 py-2 text-xs font-semibold outline-none transition ${
                  isAggressorByCountry ? 'border-red-600 text-red-300' : 'border-[#2b4432] text-slate-200 focus:border-emerald-500'
                }`}
              >
                {WORLD_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-[#101712] text-slate-200">
                    {c.name}
                  </option>
                ))}
              </select>

              {selectedAggressor && (
                <div className="mt-2 p-2.5 rounded border border-red-700 bg-[#290c0c] text-red-200 space-y-1 animate-pulse">
                  <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs uppercase">
                    <Skull className="w-4 h-4 shrink-0" /> {selectedAggressor.name} — {selectedAggressor.status}
                  </div>
                  <div className="text-[10px] text-red-300/90">{selectedAggressor.role}</div>
                  <div className="text-[10px] text-red-400 font-semibold flex items-center gap-1 pt-1 border-t border-red-900">
                    <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                    Мітка «Зомбований» (-80% штраф до мікросхем)!
                  </div>
                </div>
              )}
            </div>

            {/* Спеціалізація */}
            <div>
              <label className="block text-[#8ea393] mb-1.5 font-bold">СПЕЦІАЛІЗАЦІЯ:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ROLES.map((role) => {
                  const Icon = role.icon;
                  const isSelected = selectedRole === role.id;
                  return (
                    <div
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      className={`p-2.5 rounded border cursor-pointer transition ${
                        isSelected
                          ? 'bg-[#1e3825] border-emerald-400 text-white shadow-sm'
                          : 'bg-[#121c15] border-[#223326] text-[#93a897] hover:border-[#385c40]'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Icon className="w-4 h-4 text-emerald-400" />
                        {role.title}
                      </div>
                      <div className="text-[10px] mt-0.5 opacity-80">{role.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Точка висадки */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[#8ea393] font-bold">ТОЧКА СТАРТУ (СВІТ):</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleRerollSpawns}
                    className="flex items-center gap-1 px-2 py-0.5 bg-[#152419] hover:bg-[#203626] border border-[#2d5236] rounded text-[10px] text-emerald-300"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRerolling ? 'animate-spin' : ''}`} />
                    Інші
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsManualInputOpen((prev) => !prev)}
                    className="flex items-center gap-1 px-2 py-0.5 border border-[#31573c] rounded text-[10px] text-emerald-300 hover:bg-[#203626]"
                  >
                    <Edit3 className="w-3 h-3" /> GPS
                  </button>

                  <button
                    type="button"
                    onClick={() => requestRealLocation(false)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-[#1a2e20] hover:bg-[#25462f] border border-[#3b6d47] rounded text-[10px] text-emerald-300"
                  >
                    {isLocating ? (
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    ) : (
                      <Navigation className="w-3 h-3" />
                    )}
                    {isLocating ? 'Пошук...' : customGps && !customGps.name.includes('Ручні') ? 'GPS знайдено' : 'Моє GPS'}
                  </button>
                </div>
              </div>

              {/* Форма введення координат */}
              {isManualInputOpen && (
                <div className="p-2.5 mb-2 rounded-lg border border-[#345b3f] bg-[#0c160f] space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Lat (-90..90)"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      className="bg-[#121c15] border border-[#2b4432] rounded px-2 py-1 text-xs text-slate-100 font-mono outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Lng (-180..180)"
                      value={manualLng}
                      onChange={(e) => setManualLng(e.target.value)}
                      className="bg-[#121c15] border border-[#2b4432] rounded px-2 py-1 text-xs text-slate-100 font-mono outline-none"
                    />
                  </div>
                  {manualError && <div className="text-[10px] text-red-400 font-semibold">{manualError}</div>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={isVerifyingCoords}
                      onClick={handleApplyManualCoords}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-[10px] rounded flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      {isVerifyingCoords ? 'Перевірка...' : 'Застосувати'}
                    </button>
                  </div>
                </div>
              )}

              {/* Активний спавн */}
              {customGps ? (
                <div className={`p-2.5 rounded border flex items-center justify-between shadow-md ${
                  customGps.isWater 
                    ? 'border-cyan-500 bg-cyan-950/60 text-cyan-200' 
                    : 'border-emerald-500 bg-[#16291b] text-emerald-200'
                }`}>
                  <div>
                    <div className="font-bold flex items-center gap-1.5 text-xs">
                      {customGps.isWater ? <Waves className="w-4 h-4 text-cyan-400" /> : <MapPin className="w-4 h-4 text-emerald-400 animate-pulse" />}
                      <span>{customGps.name}</span>
                      {customGps.isWater && <span className="text-[7px] px-1 py-0.2 rounded bg-cyan-900 border border-cyan-500 text-cyan-100 font-bold ml-1">ВОДА</span>}
                    </div>
                    <div className="text-[10.5px] font-mono text-[#8cbda0] mt-0.5">
                      {customGps.lat}° N, {customGps.lng}° E
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setCustomGps(null)} 
                    className="text-xs text-red-400 hover:text-red-300 underline font-mono ml-2"
                  >
                    Скинути
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {availableSpawns.map((loc, idx) => {
                    const isSelected = selectedSpawnIndex === idx;
                    return (
                      <div
                        key={loc.name}
                        onClick={() => setSelectedSpawnIndex(idx)}
                        className={`p-2 rounded border cursor-pointer transition flex items-center justify-between ${
                          isSelected ? 'bg-[#1e3825] border-emerald-400 text-white' : 'bg-[#121c15] border-[#223326] text-[#93a897] hover:border-[#385c40]'
                        }`}
                      >
                        <div>
                          <div className="font-semibold flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400" /> {loc.name}
                            <span className="text-[8px] px-1 rounded border border-[#2d4734] bg-[#0c140e] text-[#719179]">{loc.country}</span>
                          </div>
                          <div className="text-[9.5px] opacity-80 truncate max-w-[280px]">{loc.desc}</div>
                        </div>
                        <div className="text-[9px] font-mono opacity-80 pl-1 shrink-0">{loc.lat}° N</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs rounded transition flex items-center justify-center gap-2 shadow-lg"
            >
              <UserCheck className="w-4 h-4" /> Зафіксувати дані та опритомніти →
            </button>
          </form>
        )}

        {/* ================= ЕТАП 3: ПРОБУДЖЕННЯ ================= */}
        {stage === 'awakening' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1f3826] pb-2.5">
              <Eye className="w-5 h-5 text-emerald-400 animate-pulse" />
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[#5ba16e] font-bold">СВІДОМІСТЬ // ВХІД У РЕАЛЬНІСТЬ</div>
                <h2 className="text-base md:text-lg font-bold text-slate-100">Пробудження на холодному бетоні</h2>
              </div>
            </div>

            <div className="p-3 bg-[#111a14] rounded-lg border border-[#223828] text-xs font-mono leading-relaxed text-[#a6bea9] space-y-2">
              <p>
                Ви розплющуєте очі. У скронях пульсує різкий головний біль. Повітря просякнуте запахом вологої землі, пилу та металу.
              </p>
              <p>
                Ви лежите біля розбитої стіни у точці <b className="text-emerald-300 font-bold">{currentSelection.lat.toFixed(4)}° N, {currentSelection.lng.toFixed(4)}° E</b>. 
                Поруч у смітті лежить потертий штурмовий рюкзак та армійський тактичний планшет.
              </p>
            </div>

            {/* Лог знайдених речей */}
            <div className="space-y-2 border border-[#203627] bg-[#0c140e] p-3 rounded-lg font-mono text-[11px]">
              <div className="text-[#6d9475] uppercase text-[10px] font-bold flex items-center gap-1.5 border-b border-[#1a2d20] pb-1">
                <Backpack className="w-3.5 h-3.5 text-emerald-400" />
                Вміст спорядження виживанця:
              </div>

              {awakeningStep === 0 && (
                <div className="text-[#6b8271] italic py-2 text-center">
                  Рюкзак ще не відкрито. Перевірте вміст підсумків...
                </div>
              )}

              {awakeningStep >= 1 && (
                <div className="flex items-center justify-between text-slate-200 animate-in fade-in duration-300">
                  <span className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">✓</span> Армійський сухпай
                  </span>
                  <b className="text-amber-400 font-mono">3 шт. (їжа)</b>
                </div>
              )}

              {awakeningStep >= 2 && (
                <div className="flex items-center justify-between text-slate-200 animate-in fade-in duration-300">
                  <span className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">✓</span> Гемостатичний бинт
                  </span>
                  <b className="text-emerald-400 font-mono">2 шт. (медицина)</b>
                </div>
              )}

              {awakeningStep >= 3 && (
                <div className="flex items-center justify-between text-slate-200 animate-in fade-in duration-300">
                  <span className="flex items-center gap-1.5">
                    <span className="text-cyan-400 font-bold">✓</span> Дивна ампула «Астат-Блок»
                  </span>
                  <b className="text-cyan-300 font-mono">1 шт. (антирадіація)</b>
                </div>
              )}

              {awakeningStep >= 4 && (
                <div className="flex items-center justify-between text-slate-200 pt-1 border-t border-[#1a2d20] animate-in fade-in duration-300">
                  <span className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-yellow-400" />
                    Запас мікросхем:
                  </span>
                  <b className="text-yellow-400 font-mono">0 (порожньо)</b>
                </div>
              )}
            </div>

            {/* Кнопки дій */}
            <div>
              {awakeningStep < 4 ? (
                <button
                  type="button"
                  disabled={isSearchingBag}
                  onClick={handleInspectBackpack}
                  className="w-full py-3 bg-[#1e3825] hover:bg-[#2b5135] disabled:bg-[#142017] disabled:text-[#4d6353] border border-[#3b6e47] text-emerald-100 font-bold text-xs rounded transition flex items-center justify-center gap-2 shadow"
                >
                  <Backpack className="w-4 h-4" />
                  {isSearchingBag ? 'Оглядаємо рюкзак...' : 'Розстебнути рюкзак та оглянути кишені'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishAwakening}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs rounded transition flex items-center justify-center gap-2 shadow-xl animate-bounce"
                >
                  <Navigation className="w-4 h-4" />
                  Встати на ноги та увімкнути термінал мапи →
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};