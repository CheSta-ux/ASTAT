import './App.css';
import { useState } from 'react';
import { Footprints, AlertTriangle } from 'lucide-react';

import type { Coordinates, ExpeditionState, InventoryItem, PlayerStats, TabType } from './types/game';
import { SearchEventModal } from './components/SearchEventModal';
import { useNotifications } from './hooks/useNotifications';
import { useRadioSync } from './hooks/useRadioSync';
import { useStashesAndCamps } from './hooks/useStashesAndCamps';
import { useWorldEnvironment } from './hooks/useWorldEnvironment';
import { usePlayerPersistence, getSurroundingSectorKeys } from './hooks/usePlayerPersistence';
import { useSectorSearch } from './hooks/useSectorSearch';
import { usePlayerActions } from './hooks/usePlayerActions';
import { TerminalBootScreen } from './components/TerminalBootScreen';
import { INITIAL_AWAKENING_INVENTORY } from './constants/lootDictionary';

import { HeaderHUD } from './components/HeaderHUD';
import { MapView } from './components/MapView';
import { InventoryView } from './components/InventoryView';
import { RadioView } from './components/RadioView';
import { ProfileView } from './components/ProfileView';
import { AfkModal } from './components/AfkModal';
import { OnboardingModal } from './components/OnboardingModal';
import { UnconsciousBanner } from './components/UnconsciousBanner';
import { DesktopTabs, MobileBottomNav } from './components/AppNavigation';
import { supabase } from './lib/supabase';

const DEFAULT_COORDS: Coordinates = {
  x: 0,
  y: 0,
  lat: 51.4082,
  lng: 30.0631
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const [showAfkModal, setShowAfkModal] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isBooting, setIsBooting] = useState(false);
  const [exploredSectors, setExploredSectors] = useState<string[]>([]);

  const [player, setPlayer] = useState<PlayerStats>({
    name: 'Виживший-33',
    callsign: 'Привид Полісся',
    citizenship: 'Україна 🇺🇦',
    specialization: 'scout',
    hp: 85,
    maxHp: 100,
    hunger: 72,
    maxHunger: 100,
    astatCoins: 0,
    searchesLeft: 4,
    conditions: ['comfort'],
    exploredCount: 0
  });

  const [coords, setCoords] = useState<Coordinates>(DEFAULT_COORDS);
  const [campCoords, setCampCoords] = useState<Coordinates>(DEFAULT_COORDS);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [expedition, setExpedition] = useState<ExpeditionState | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_AWAKENING_INVENTORY);

  const worldEnvironment = useWorldEnvironment(coords, player.specialization);
  const { notifications, notify } = useNotifications();
  const { radioMessages, sendMessage } = useRadioSync(player, notify);

  const { syncGameState } = usePlayerPersistence({
    defaultCoords: DEFAULT_COORDS,
    player,
    setPlayer,
    inventory,
    setInventory,
    coords,
    setCoords,
    campCoords,
    setCampCoords,
    exploredSectors,
    setExploredSectors,
    setExpedition,
    hasCompletedOnboarding,
    setHasCompletedOnboarding,
    notify
  });

  const {
    ownStashes,
    foreignCamps,
    getOwnStashAt,
    getForeignCampAt,
    createDeathStash,
    claimOwnStash,
    tryLootForeignStashAt
  } = useStashesAndCamps(notify);

  const currentOwnStash = getOwnStashAt(coords.lat, coords.lng);
  const currentForeignCamp = getForeignCampAt(coords.lat, coords.lng);
  const isUnconsciousState = player.hp <= 0 || player.conditions.includes('unconscious');

  const {
    sectorSearches,
    activeSearchEvent,
    setActiveSearchEvent,
    handleSearch,
    handleResolveSearchChoice
  } = useSectorSearch({
    coords,
    campCoords,
    player,
    setPlayer,
    inventory,
    setInventory,
    expedition,
    isUnconscious: isUnconsciousState,
    setActiveTab,
    getForeignCampAt,
    tryLootForeignStashAt,
    syncGameState,
    notify
  });

  const {
    isUnconscious,
    sosCooldown,
    handleCallForHelp,
    handleSurrender,
    handleClaimOwnStash,
    handleStartExpedition,
    handleRest,
    handleRelocateCamp,
    handleUseItem
  } = usePlayerActions({
    player,
    setPlayer,
    inventory,
    setInventory,
    coords,
    setCoords,
    campCoords,
    setCampCoords,
    exploredSectors,
    setExploredSectors,
    expedition,
    setExpedition,
    setSelectedTarget,
    setActiveTab,
    sectorSearches,
    worldEnvironment,
    getForeignCampAt,
    createDeathStash,
    claimOwnStash,
    sendMessage,
    syncGameState,
    notify
  });

  return (
    <div className="min-h-screen bg-[#0a0d0b] text-[#d3ded5] font-mono selection:bg-[#2b5936] selection:text-white relative overflow-x-hidden flex flex-col justify-between pb-24 md:pb-0">
      <div className="pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_100%)] opacity-80" />
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(18, 255, 50, 0) 50%, rgba(0, 0, 0, 0.7) 50%)',
          backgroundSize: '100% 4px'
        }}
      />

      {/* Push-сповіщення */}
      <div className="fixed top-[68px] sm:top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-1.5 pointer-events-none max-w-[94vw] w-auto">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`px-3.5 py-2 rounded border shadow-2xl flex items-center gap-2 text-xs md:text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
              n.type === 'danger'
                ? 'bg-[#260f0f]/95 border-red-500 text-red-200'
                : n.type === 'warn'
                ? 'bg-[#291e0a]/95 border-amber-500 text-amber-200'
                : n.type === 'success'
                ? 'bg-[#0f2918]/95 border-emerald-500 text-emerald-200'
                : 'bg-[#141b16]/95 border-[#3b5e43] text-[#cfdcce]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold">{n.msg}</span>
          </div>
        ))}
      </div>

      <HeaderHUD player={player} environment={worldEnvironment} />

      {/* Банер маршу в дорозі поза вкладкою карти */}
      {expedition && activeTab !== 'map' && (
        <div className="bg-[#142318] border-b border-[#2b5936] px-3 py-2.5 text-xs z-30">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Footprints className="w-4 h-4 text-emerald-400 animate-bounce shrink-0" />
                <span className="text-emerald-300 font-semibold truncate">
                  Марш на{' '}
                  {expedition.targetCoords
                    ? `${expedition.targetCoords.lat.toFixed(4)}° N, ${expedition.targetCoords.lng.toFixed(4)}° E`
                    : 'точку'}
                </span>
              </div>
              <span className="text-[#a3c2ab] font-mono font-bold shrink-0">
                {expedition.remaining >= 60
                  ? `${Math.floor(expedition.remaining / 60)} хв ${expedition.remaining % 60} с`
                  : `${expedition.remaining} с`}
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-1 sm:max-w-xs">
              <div className="flex-1 bg-[#0a110c] h-2 rounded-full overflow-hidden border border-[#223d29]">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{
                    width: `${((expedition.totalDuration - expedition.remaining) / expedition.totalDuration) * 100}%`
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAfkModal(true)}
                className="px-2.5 py-1 bg-[#1a3321] hover:bg-[#25462f] border border-[#3b6b46] rounded text-[11px] font-bold text-emerald-200 shrink-0"
              >
                Деталі
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Екстрений банер непритомності */}
      {isUnconscious && (
        <UnconsciousBanner
          sosCooldown={sosCooldown}
          onOpenInventory={() => setActiveTab('inventory')}
          onCallForHelp={handleCallForHelp}
          onSurrender={handleSurrender}
        />
      )}

      {/* Основний робочий простір */}
      <main className="max-w-7xl mx-auto w-full p-3 md:p-5 flex-1 flex flex-col gap-4">
        <DesktopTabs activeTab={activeTab} setActiveTab={setActiveTab} isUnconscious={isUnconscious} notify={notify} />

        {activeTab === 'map' && !isUnconscious && (
          <MapView
            coords={coords}
            campCoords={campCoords}
            player={player}
            expedition={expedition}
            selectedTarget={selectedTarget}
            setSelectedTarget={setSelectedTarget}
            onStartExpedition={handleStartExpedition}
            onSearch={handleSearch}
            onRest={handleRest}
            onRelocateCamp={handleRelocateCamp}
            sectorSearches={sectorSearches}
            exploredSectors={exploredSectors}
            notifications={notifications}
            onOpenAfkModal={() => setShowAfkModal(true)}
            activeSearchEvent={activeSearchEvent}
            onSelectSearchChoice={handleResolveSearchChoice}
            onCloseSearchEvent={() => setActiveSearchEvent(null)}
            ownStashes={ownStashes}
            foreignCamps={foreignCamps}
            currentOwnStash={currentOwnStash}
            currentForeignCamp={currentForeignCamp}
            onClaimOwnStash={handleClaimOwnStash}
            environment={worldEnvironment}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView inventory={inventory} coins={player.astatCoins} onUseItem={handleUseItem} />
        )}

        {activeTab === 'radio' && (
          <RadioView
            messages={radioMessages}
            player={player}
            currentCoords={coords}
            inventory={inventory}
            onSendMessage={sendMessage}
          />
        )}

        {activeTab === 'profile' && <ProfileView player={player} campCoords={campCoords} />}
      </main>

      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} isUnconscious={isUnconscious} notify={notify} />

      {showAfkModal && expedition && <AfkModal expedition={expedition} onClose={() => setShowAfkModal(false)} />}

      {activeSearchEvent && (
        <SearchEventModal
          eventState={activeSearchEvent}
          specialization={player.specialization}
          onSelectChoice={handleResolveSearchChoice}
          onClose={() => setActiveSearchEvent(null)}
        />
      )}

      {!hasCompletedOnboarding && (
        <OnboardingModal
          onNotify={notify}
          onComplete={async (data) => {
            const isWater = Boolean(data.isWaterSpawn);
            const isSoldier = data.specialization === 'soldier';
            const startMaxHp = isSoldier ? 120 : 100;
            const startHp = isWater ? 35 : isSoldier ? 102 : player.hp;

            const updatedPlayer: PlayerStats = {
              ...player,
              name: data.callsign,
              callsign: data.callsign,
              citizenship: data.citizenship,
              specialization: data.specialization,
              aggressorReason: data.aggressorReason,
              astatCoins: 0,
              hp: startHp,
              maxHp: startMaxHp,
              hunger: isWater ? 25 : player.hunger,
              conditions: data.isZombified
                ? Array.from(new Set([...player.conditions, 'zombified']))
                : player.conditions
            };

            const initialInv = [...INITIAL_AWAKENING_INVENTORY];
            const initialExplored = getSurroundingSectorKeys(data.startCoords.lat, data.startCoords.lng);

            setPlayer(updatedPlayer);
            setCoords(data.startCoords);
            setCampCoords(data.startCoords);
            setInventory(initialInv);
            setExploredSectors(initialExplored);

            setHasCompletedOnboarding(true);
            setIsBooting(true);

            try {
              let localPlayerId = localStorage.getItem('astat_player_id');
              if (!localPlayerId) {
                localPlayerId = crypto.randomUUID();
                localStorage.setItem('astat_player_id', localPlayerId);
              }

              await supabase.from('players').upsert({
                id: localPlayerId,
                callsign: data.callsign,
                citizenship: data.citizenship,
                specialization: data.specialization,
                hp: updatedPlayer.hp,
                hunger: updatedPlayer.hunger,
                microchips: 0,
                lat: data.startCoords.lat,
                lng: data.startCoords.lng,
                camp_lat: data.startCoords.lat,
                camp_lng: data.startCoords.lng,
                conditions: updatedPlayer.conditions,
                inventory: initialInv,
                explored_sectors: initialExplored,
                updated_at: new Date().toISOString()
              });
            } catch (err) {
              console.warn('Не вдалося зберегти гравця в Supabase:', err);
            }

            if (isWater) {
              notify(`🌊 ДЕСАНТУВАННЯ У ВОДУ! Штраф: -50 HP, ситість 25%!`, 'danger');
            }
            if (data.isZombified) {
              notify(`⚠️ Громадянство країни-агресора: отримано постійну мітку "Зомбований" (-80% мікросхем)!`, 'danger');
            }
          }}
        />
      )}

      {isBooting && (
        <TerminalBootScreen
          callsign={player.callsign}
          coords={coords}
          specialization={player.specialization}
          onBootComplete={() => {
            setIsBooting(false);
            notify('📡 Тактичний термінал запущено. Карта секторів активна.', 'success');
          }}
        />
      )}

      <footer className="border-t border-[#1d2720] bg-[#0c120e] px-4 py-2 text-[10px] text-[#556b5b] hidden md:flex flex-wrap items-center justify-between gap-2">
        <div>ASTAT HYBRID RPG ENGINE • ПОЛІССЯ-АНТИМАТЕРІЯ • УКРАЇНСЬКА ЛОКАЛІЗАЦІЯ</div>
        <div className="flex items-center gap-3">
          <span>GPS: {coords.lat.toFixed(5)}° N, {coords.lng.toFixed(5)}° E</span>
          <span>Статус зв'язку: АКТИВНИЙ</span>
        </div>
      </footer>
    </div>
  );
}