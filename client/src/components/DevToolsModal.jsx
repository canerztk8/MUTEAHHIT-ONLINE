import React, { useState } from 'react';
import { 
  Wrench, X, Play, FastForward, DollarSign, MapPin, Dices, 
  Building2, Bell, Volume2, Sparkles, RefreshCw, 
  Trash2, RotateCcw, AlertCircle, CheckCircle, ChevronRight, Minimize2, Maximize2
} from 'lucide-react';
import { BOARD_TILES } from '../game/boardData.js';
import { sounds } from '../sound/soundEffects.js';
import { ACTION } from '../network/protocol.js';

export function DevToolsModal({
  isOpen,
  onClose,
  gameState,
  myPlayerId,
  network
}) {
  const [activeTab, setActiveTab] = useState('round');
  const [selectedPlayerId, setSelectedPlayerId] = useState(myPlayerId || gameState?.players?.[0]?.id || '');
  const [customRound, setCustomRound] = useState(gameState?.roundNumber || 1);
  const [customMoney, setCustomMoney] = useState(1500);
  const [selectedTileId, setSelectedTileId] = useState(0);
  const [triggerLandAction, setTriggerLandAction] = useState(true);
  const [riggedD1, setRiggedD1] = useState(3);
  const [riggedD2, setRiggedD2] = useState(3);
  const [propOwnerId, setPropOwnerId] = useState(myPlayerId || '');
  const [propHouses, setPropHouses] = useState(0);
  const [propMortgaged, setPropMortgaged] = useState(false);
  const [lastActionMsg, setLastActionMsg] = useState('');

  if (!isOpen || !gameState) return null;

  const players = gameState.players || [];
  const selectedPlayer = players.find(p => p.id === selectedPlayerId) || players[0];
  const properties = gameState.properties || {};

  const sendDevCmd = (command, payload = {}) => {
    if (!network) return;
    network.sendAction(ACTION.DEV_COMMAND, { command, payload });
    setLastActionMsg(`⟳ ${command} gönderildi...`);
    setTimeout(() => setLastActionMsg(''), 3000);
  };

  const COLOR_GROUPS = [
    { name: 'Kahverengi (Ulus-Dışkapı)', key: 'brown', color: '#92400e' },
    { name: 'Açık Mavi (Mamak-Siteler-Aydınlıkevler)', key: 'lightblue', color: '#0284c7' },
    { name: 'Pembe (Eryaman-Batıkent-Yenimahalle)', key: 'pink', color: '#db2777' },
    { name: 'Turuncu (Keçiören-Etlik-İncirli)', key: 'orange', color: '#ea580c' },
    { name: 'Kırmızı (Kızılay-Maltepe-Tandoğan)', key: 'red', color: '#dc2626' },
    { name: 'Sarı (Tunalı-Bahçelievler-GOP)', key: 'yellow', color: '#ca8a04' },
    { name: 'Yeşil (Bilkent-Ümitköy-Çayyolu)', key: 'green', color: '#16a34a' },
    { name: 'Koyu Mavi (İncek-Çankaya)', key: 'darkblue', color: '#1d4ed8' },
    { name: 'Garlar (TCDD / YHT)', key: 'railroad', color: '#475569' },
    { name: 'Altyapı (ASKİ & Başkentgaz)', key: 'utility', color: '#0891b2' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn select-none font-space">
      <div className="w-full max-w-2xl bg-white border-2 border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-900">
        {/* Üst Başlık Barı */}
        <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black tracking-wide">MÜTEAHHİT DEVTOOLS</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/50 font-jetbrains font-bold">
                  SÜPERVİZÖR AKTİF
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-jetbrains">
                Oda: <strong className="text-white">{gameState.roomCode}</strong> | Tur: <strong className="text-amber-400">#{gameState.roundNumber || 1}</strong> | Faz: <strong className="text-sky-300">{gameState.phase}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastActionMsg && (
              <span className="text-[11px] font-bold text-amber-300 animate-pulse bg-slate-800/90 px-2 py-1 rounded-lg border border-slate-700 font-jetbrains">
                {lastActionMsg}
              </span>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition flex items-center justify-center cursor-pointer active:scale-95"
              title="DevTools Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sekme Menüleri */}
        <div className="flex items-center gap-1 px-3 py-2 bg-slate-100 border-b border-slate-200 overflow-x-auto">
          {[
            { id: 'round', label: '⏱️ Tur & Zaman' },
            { id: 'money', label: '💰 Para & Borç' },
            { id: 'teleport', label: '📍 Işınlanma' },
            { id: 'dice', label: '🎲 Zarlar' },
            { id: 'property', label: '🏢 Tapu & İnşa' },
            { id: 'fx', label: '🔔 Bildirim & FX' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex-shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Seçili Oyuncu Seçici */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <span>Hedef Oyuncu:</span>
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 font-jetbrains focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {players.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.id === myPlayerId ? '(SEN)' : p.isBot ? `[BOT-${p.difficulty || 'orta'}]` : ''} - {p.money}₺
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-jetbrains text-slate-500">
            <span>Konum: <strong>{selectedPlayer?.position ?? 0}. Kare</strong></span>
            {selectedPlayer?.inJail && <span className="text-rose-600 font-bold ml-1">🚨 KODESTE</span>}
            {selectedPlayer?.isBankrupt && <span className="text-red-700 font-black ml-1">💥 İFLAS</span>}
          </div>
        </div>

        {/* Sekme İçeriği */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs font-jetbrains min-h-0">
          {/* 1. TUR & ZAMAN */}
          {activeTab === 'round' && (
            <div className="space-y-3">
              <div>
                <h4 className="font-black text-slate-900 mb-1 font-space uppercase">Hızlı Tur Değiştirme (Tur Sayaç Ayarı)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { r: 1, label: 'Tur 1: Açılış Turları' },
                    { r: 10, label: 'Tur 10: Orta Oyun' },
                    { r: 25, label: 'Tur 25: İleri Seviye' },
                    { r: 50, label: 'Tur 50: Geç Oyun' },
                    { r: 75, label: 'Tur 75: Maraton' },
                    { r: 100, label: 'Tur 100: Uzun Oyun' }
                  ].map(b => (
                    <button
                      key={b.r}
                      onClick={() => sendDevCmd('set_round', { round: b.r })}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-900 hover:text-white border border-slate-300 font-bold transition text-left cursor-pointer active:scale-95"
                    >
                      <div className="text-[10px] text-amber-600 font-black">#{b.r}. Tur</div>
                      <div className="text-[9.5px] truncate">{b.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold">Özel Tur Sayısı:</span>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={customRound}
                  onChange={(e) => setCustomRound(e.target.value)}
                  className="w-20 px-2 py-1 bg-white border border-slate-300 rounded text-center font-bold"
                />
                <button
                  onClick={() => sendDevCmd('set_round', { round: customRound })}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold cursor-pointer transition active:scale-95"
                >
                  Tura Git
                </button>
              </div>

              <div>
                <h4 className="font-black text-slate-900 mb-1 font-space uppercase">Sıra & Tur Akışı Manipülasyonu</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => sendDevCmd('advance_turn')}
                    className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black transition cursor-pointer flex items-center justify-center gap-1 shadow-xs active:scale-95"
                  >
                    <FastForward className="w-4 h-4" />
                    <span>Sonraki Tura Geç</span>
                  </button>
                  <button
                    onClick={() => sendDevCmd('set_turn', { playerId: selectedPlayerId })}
                    className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black transition cursor-pointer flex items-center justify-center gap-1 shadow-xs active:scale-95"
                  >
                    <Play className="w-4 h-4" />
                    <span>Sırayı Bu Oyuncuya Ver</span>
                  </button>
                  <button
                    onClick={() => sendDevCmd('fast_forward_bots')}
                    className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black transition cursor-pointer flex items-center justify-center gap-1 shadow-xs active:scale-95"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Bot Turunu Hızlı Atla</span>
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-black text-slate-900 mb-1 font-space uppercase">📜 Kart Çekme & 3D Animasyon Testi</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => sendDevCmd('trigger_card', { playerId: selectedPlayerId, deckType: 'chance' })}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95 text-xs sm:text-sm"
                  >
                    <span>📜 Şans Kartı Çek (3D Test)</span>
                  </button>
                  <button
                    onClick={() => sendDevCmd('trigger_card', { playerId: selectedPlayerId, deckType: 'chest' })}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95 text-xs sm:text-sm"
                  >
                    <span>🏛️ Belediye Kartı Çek (3D Test)</span>
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-black text-slate-900 mb-1 font-space uppercase">Oyun Fazını Zorla Değiştir</h4>
                <div className="flex gap-1.5 flex-wrap">
                  {['WAITING_ROLL', 'TILE_ACTION', 'TURN_ACTIONS', 'AUCTION', 'GAME_OVER'].map(ph => (
                    <button
                      key={ph}
                      onClick={() => sendDevCmd('set_phase', { phase: ph })}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer active:scale-95 ${
                        gameState.phase === ph
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {ph}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <button
                  onClick={() => {
                    if (window.confirm('Oyunu sıfırlayıp lobiye dönmek istediğinize emin misiniz?')) {
                      sendDevCmd('reset_game');
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Oyunu Sıfırla (Lobiye Dön)</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. PARA & BORÇ */}
          {activeTab === 'money' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-amber-800 font-bold">Seçili: <strong>{selectedPlayer?.name}</strong></span>
                  <div className="text-xl font-black text-slate-950">{selectedPlayer?.money}₺</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => sendDevCmd('set_money', { playerId: selectedPlayerId, amount: -300 })}
                    className="px-2.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition cursor-pointer shadow-md flex items-center gap-1 active:scale-95"
                    title="Borç, İpotek ve İflas mantığını anında test et"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>🚨 Borç Yap (-300₺)</span>
                  </button>
                  <button
                    onClick={() => sendDevCmd('trigger_bankruptcy', { playerId: selectedPlayerId })}
                    className="px-2.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition cursor-pointer shadow-md flex items-center gap-1 active:scale-95 animate-pulse"
                    title="Seçili oyuncuyu derhal iflas ettir ve elenme ekranını gör"
                  >
                    <span>💀 İflas Ettir</span>
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-black text-slate-900 mb-1 font-space uppercase">Hızlı Bakiye Ekle / Çıkar</h4>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[500, 1000, 2000, 5000].map(val => (
                    <button
                      key={`add-${val}`}
                      onClick={() => sendDevCmd('add_money', { playerId: selectedPlayerId, amount: val })}
                      className="py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold transition cursor-pointer active:scale-95 text-center"
                    >
                      +{val}₺
                    </button>
                  ))}
                  {[-200, -500].map(val => (
                    <button
                      key={`sub-${val}`}
                      onClick={() => sendDevCmd('add_money', { playerId: selectedPlayerId, amount: val })}
                      className="py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold transition cursor-pointer active:scale-95 text-center"
                    >
                      {val}₺
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold">Özel Bakiye Belirle:</span>
                <input
                  type="number"
                  value={customMoney}
                  onChange={(e) => setCustomMoney(e.target.value)}
                  className="w-24 px-2 py-1 bg-white border border-slate-300 rounded text-center font-bold"
                />
                <button
                  onClick={() => sendDevCmd('set_money', { playerId: selectedPlayerId, amount: customMoney })}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold cursor-pointer transition active:scale-95"
                >
                  Bakiyeyi Ayarla
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200 flex gap-2 flex-wrap">
                <button
                  onClick={() => sendDevCmd('trigger_bankruptcy', { playerId: selectedPlayerId })}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{selectedPlayer?.name} İflas Ettir</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. IŞINLANMA (TELEPORT) */}
          {activeTab === 'teleport' && (
            <div className="space-y-3">
              <div>
                <h4 className="font-black text-slate-900 mb-1 font-space uppercase">Önemli Noktalara Hızlı Işınlanma</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 0, label: '👷 [0] Merkez Şantiye' },
                    { id: 4, label: '💸 [4] Gelir Vergisi' },
                    { id: 10, label: '📋 [10] Maliye Denetimi' },
                    { id: 20, label: '☕ [20] Dinlenme Tesisi' },
                    { id: 30, label: '🕵️‍♂️ [30] Vergi İncelemesi' },
                    { id: 38, label: '💎 [38] Lüks Vergisi' },
                    { id: 7, label: '📜 [7] İhale & Fırsat' },
                    { id: 2, label: '🏛️ [2] Belediye & İmar' }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => sendDevCmd('teleport', { playerId: selectedPlayerId, tileId: p.id, triggerAction: triggerLandAction })}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white border border-slate-200 font-bold text-left transition cursor-pointer active:scale-95"
                    >
                      <div className="text-[10px] truncate">{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">40 Kare Arasından Seç:</span>
                  <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={triggerLandAction}
                      onChange={(e) => setTriggerLandAction(e.target.checked)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                    />
                    <span>Kare Eylemini Tetikle (Kira/Vergi/Alım)</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedTileId}
                    onChange={(e) => setSelectedTileId(Number(e.target.value))}
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold font-jetbrains cursor-pointer"
                  >
                    {BOARD_TILES.map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.id}] {t.name} {t.cost ? `(${t.cost}₺)` : `[${t.type}]`}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => sendDevCmd('teleport', { playerId: selectedPlayerId, tileId: selectedTileId, triggerAction: triggerLandAction })}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer transition active:scale-95"
                  >
                    Işınla
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-black text-slate-900 mb-1 font-space uppercase">Maliye Denetimi (Kodes) Kontrolü</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => sendDevCmd('jail_status', { playerId: selectedPlayerId, inJail: true })}
                    className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                  >
                    🚨 {selectedPlayer?.name} Kodese At
                  </button>
                  <button
                    onClick={() => sendDevCmd('jail_status', { playerId: selectedPlayerId, inJail: false })}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                  >
                    🔓 Kodesten Çıkar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. ZARLAR */}
          {activeTab === 'dice' && (
            <div className="space-y-3">
              <div>
                <h4 className="font-black text-slate-900 mb-1 font-space uppercase">Bir Sonraki Zarı Sabitle (Dice Rigging)</h4>
                <p className="text-[10px] text-slate-500 mb-2">
                  Buradan seçtiğiniz zar, atılacak ilk zar atışında (senin veya botun) garanti olarak gelecektir.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {[
                    { d1: 1, d2: 1, label: '🎲 [1-1] Çift Zar' },
                    { d1: 3, d2: 3, label: '🎲 [3-3] Çift Zar' },
                    { d1: 6, d2: 6, label: '🎲 [6-6] Çift Zar' },
                    { d1: 4, d2: 3, label: '🎲 [4-3] Toplam: 7' }
                  ].map(item => (
                    <button
                      key={`${item.d1}-${item.d2}`}
                      onClick={() => sendDevCmd('rig_dice', { d1: item.d1, d2: item.d2 })}
                      className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold transition text-center cursor-pointer active:scale-95"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span>Zar 1:</span>
                    <select
                      value={riggedD1}
                      onChange={(e) => setRiggedD1(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-300 rounded font-black font-mono cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>Zar 2:</span>
                    <select
                      value={riggedD2}
                      onChange={(e) => setRiggedD2(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-300 rounded font-black font-mono cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={() => sendDevCmd('rig_dice', { d1: riggedD1, d2: riggedD2 })}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer transition active:scale-95"
                  >
                    Sabitle ({riggedD1 + riggedD2})
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold">Masadaki Mevcut Zar:</span>
                  <div className="text-base font-black text-amber-600 font-mono">
                    [{gameState.dice?.[0] || 1} - {gameState.dice?.[1] || 1}] = {(gameState.dice?.[0] || 1) + (gameState.dice?.[1] || 1)}
                  </div>
                </div>
                <button
                  onClick={() => sounds.playDiceRoll()}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Zar Sesini Test Et</span>
                </button>
              </div>
            </div>
          )}

          {/* 5. TAPU & İNŞAAT */}
          {activeTab === 'property' && (
            <div className="space-y-3">
              <div>
                <h4 className="font-black text-slate-900 mb-1 font-space uppercase">Hızlı Tekel Grubu Ver</h4>
                <p className="text-[10px] text-slate-500 mb-2">
                  Seçili oyuncuya ilgili renk grubundaki tüm tapuları anında verip ipoteksiz hale getirir.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {COLOR_GROUPS.map(g => (
                    <button
                      key={g.key}
                      onClick={() => sendDevCmd('give_monopoly', { playerId: selectedPlayerId, colorOrType: g.key })}
                      className="p-1.5 rounded-xl border border-slate-200 hover:border-amber-500 bg-white hover:bg-amber-50/50 text-left transition cursor-pointer flex items-center gap-1.5"
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0 border border-slate-400" style={{ backgroundColor: g.color || '#475569' }} />
                      <span className="text-[10px] font-bold truncate">{g.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <h4 className="font-black text-slate-900 font-space uppercase">Tekil Tapu Düzenleyici</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Tapu Seç:</label>
                    <select
                      value={selectedTileId}
                      onChange={(e) => {
                        const tid = Number(e.target.value);
                        setSelectedTileId(tid);
                        const cur = properties[tid];
                        if (cur) {
                          setPropOwnerId(cur.ownerId || '');
                          setPropHouses(cur.houses || 0);
                          setPropMortgaged(cur.mortgaged || false);
                        }
                      }}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold font-jetbrains cursor-pointer"
                    >
                      {BOARD_TILES.filter(t => t.type === 'property' || t.type === 'railroad' || t.type === 'utility').map(t => (
                        <option key={t.id} value={t.id}>[{t.id}] {t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Sahip Ata:</label>
                    <select
                      value={propOwnerId}
                      onChange={(e) => setPropOwnerId(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold font-jetbrains cursor-pointer"
                    >
                      <option value="">(Sahipsiz / Banka)</option>
                      {players.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Ev / Otel:</label>
                    <select
                      value={propHouses}
                      onChange={(e) => setPropHouses(Number(e.target.value))}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold font-jetbrains cursor-pointer"
                    >
                      <option value={0}>0 Ev (Yalın Arsa)</option>
                      <option value={1}>🏠 1 Ev</option>
                      <option value={2}>🏠🏠 2 Ev</option>
                      <option value={3}>🏠🏠🏠 3 Ev</option>
                      <option value={4}>🏠🏠🏠🏠 4 Ev</option>
                      <option value={5}>🏨 1 Otel</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={propMortgaged}
                      onChange={(e) => setPropMortgaged(e.target.checked)}
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span>İpotekli Olarak İşaretle</span>
                  </label>

                  <div className="flex gap-2">
                    <button
                      onClick={() => sendDevCmd('set_property', {
                        tileId: selectedTileId,
                        ownerId: propOwnerId || null,
                        houses: propHouses,
                        mortgaged: propMortgaged
                      })}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer transition active:scale-95"
                    >
                      Tapuyu Güncelle
                    </button>
                    <button
                      onClick={() => sendDevCmd('start_auction', { tileId: selectedTileId })}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-bold cursor-pointer transition active:scale-95"
                    >
                      Açık Artırma Başlat
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. BİLDİRİMLER & FX */}
          {activeTab === 'fx' && (
            <div className="space-y-3">
              <div>
                <h4 className="font-black text-slate-900 mb-1 font-space uppercase">Arayüz Bildirimlerini Simüle Et</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => sendDevCmd('trigger_rent_notification', {
                      payerName: 'Zeki Bot',
                      receiverId: selectedPlayerId,
                      amount: 750,
                      tileId: 39
                    })}
                    className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 font-bold text-left transition cursor-pointer"
                  >
                    <div className="text-[11px] font-black">💰 Canlı Kira Banner'ı</div>
                    <div className="text-[9.5px] text-rose-700">750₺ Kira Ödemesi Banner'ı Aç</div>
                  </button>

                  <button
                    onClick={() => sendDevCmd('trigger_card', { playerId: selectedPlayerId, deckType: 'chance' })}
                    className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-left transition cursor-pointer"
                  >
                    <div className="text-[11px] font-black">📜 İhale & Şans Kartı</div>
                    <div className="text-[9.5px] text-amber-700">Kart Çek ve Ekrana Bildir</div>
                  </button>

                  <button
                    onClick={() => sendDevCmd('trigger_card', { playerId: selectedPlayerId, deckType: 'community' })}
                    className="p-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 font-bold text-left transition cursor-pointer"
                  >
                    <div className="text-[11px] font-black">🏛️ Belediye & Fon Kartı</div>
                    <div className="text-[9.5px] text-sky-700">Kart Çek ve Ekrana Bildir</div>
                  </button>

                  <button
                    onClick={() => sendDevCmd('trigger_victory', { playerId: selectedPlayerId })}
                    className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 font-bold text-left transition cursor-pointer"
                  >
                    <div className="text-[11px] font-black">🏆 Zafer / Şampiyonluk</div>
                    <div className="text-[9.5px] text-purple-700">Şampiyon Ekranını Tetikle</div>
                  </button>

                  <button
                    onClick={() => sendDevCmd('trigger_bankruptcy', { playerId: selectedPlayerId })}
                    className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 font-bold text-left transition cursor-pointer"
                  >
                    <div className="text-[11px] font-black">💀 İflas & Elenme Ekranı</div>
                    <div className="text-[9.5px] text-rose-700">Eleniş Ekranını Tetikle</div>
                  </button>

                  <button
                    onClick={() => sendDevCmd('jail_status', { playerId: selectedPlayerId, inJail: true })}
                    className="p-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-300 font-bold text-left transition cursor-pointer"
                  >
                    <div className="text-[11px] font-black">🚨 Kodes Demir Parmaklık</div>
                    <div className="text-[9.5px] text-orange-700">Hücre Kapatma Animasyonu</div>
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-black text-slate-900 mb-1 font-space uppercase">Web Audio SFX Ses Efekti Testleri</h4>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[
                    { fn: () => sounds.playDiceRoll(), label: '🎲 Zar Sesi' },
                    { fn: () => sounds.playCash(), label: '💵 Para Sayma' },
                    { fn: () => sounds.playJailDoor(), label: '🚨 Kodes Kapısı' },
                    { fn: () => sounds.playBuild(), label: '🔨 Ev İnşa' },
                    { fn: () => sounds.playBankruptcy(), label: '💀 İflas Zili' },
                    { fn: () => sounds.playVictory(), label: '🎺 Zafer Fanfarı' }
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      onClick={s.fn}
                      className="py-2 px-1 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-[10px] text-center transition cursor-pointer active:scale-95 shadow-xs"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Alt Bar */}
        <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-jetbrains">
          <span>Gizli Komut: <code className="bg-slate-200 px-1.5 py-0.5 rounded font-bold text-slate-800">/20032002Caner.</code></span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer transition"
          >
            Paneli Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
