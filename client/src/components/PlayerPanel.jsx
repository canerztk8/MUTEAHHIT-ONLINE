import React, { useState, useEffect, useRef } from 'react';
import { Users, Handshake, ShieldAlert, Bot, Landmark, Trash2, Minimize2, Maximize2, X, TrendingUp, TrendingDown } from 'lucide-react';
import { BOARD_TILES } from '../game/boardData.js';

// Para geçmişi modalı
function MoneyHistoryModal({ player, history, onClose }) {
  const balance = player.money;
  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-96 max-h-[75vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">{player.token?.icon || '●'}</span>
            <div>
              <div className="font-black text-sm text-slate-900 dark:text-slate-100 font-space">{player.name}</div>
              <div className="text-xs font-black text-amber-600 dark:text-amber-400 font-jetbrains">{balance.toLocaleString('tr-TR')}₺</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
          {history.length === 0 ? (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-6">Henüz işlem yok</p>
          ) : (
            [...history].reverse().map((entry, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1 px-3 py-2 rounded-xl text-xs ${
                  entry.delta > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50'
                }`}
              >
                {/* Üst satır: İkon + Sebep metni (tam görünsün) */}
                <div className="flex items-start gap-1.5">
                  {entry.delta > 0
                    ? <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    : <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                  }
                  <span className="text-slate-700 dark:text-slate-300 font-medium leading-snug break-words">{entry.reason}</span>
                </div>
                {/* Alt satır: Tutar + Saat */}
                <div className="flex items-center justify-between pl-4">
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-jetbrains">{entry.time}</span>
                  <span className={`font-black font-jetbrains text-sm ${entry.delta > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                    {entry.delta > 0 ? '+' : ''}{entry.delta.toLocaleString('tr-TR')}₺
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-center text-[10px] text-slate-400 dark:text-slate-500 font-jetbrains">
          Son {history.length} işlem
        </div>
      </div>
    </div>
  );
}

function PlayerPanelBase({ gameState, myPlayerId, onOpenTrade, onTileClick, onRemoveBot, onSetBotDifficulty }) {
  const { players, currentTurnIndex, properties, logs = [] } = gameState;
  const activePlayer = players[currentTurnIndex];
  const myPlayer = players.find(p => p.id === myPlayerId);
  const isHost = myPlayer?.isHost;

  // Kompakt / Genişletilmiş Görünüm Modu (Varsayılan olarak hep minimize başlar)
  const [isCompact, setIsCompact] = useState(true);

  // Para geçmişi modal
  const [historyModal, setHistoryModal] = useState(null); // player id
  const moneyHistoryRef = useRef({}); // { [playerId]: [{delta, reason, time, balance}] }

  // Canlı Bakiye Değişimleri (Her para girişinde +₺, çıkışında -₺ animasyonu)
  const [activeDeltas, setActiveDeltas] = useState({});
  const prevBalancesRef = useRef({});
  const prevLogsLengthRef = useRef(0);

  useEffect(() => {
    if (!players || players.length === 0) return;

    const newDeltas = {};
    const key = Date.now();
    const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    players.forEach(p => {
      const prev = prevBalancesRef.current[p.id];
      if (prev !== undefined && prev !== p.money) {
        const diff = p.money - prev;
        if (diff !== 0) {
          newDeltas[p.id] = {
            text: diff > 0 ? `+${diff}₺` : `-${Math.abs(diff)}₺`,
            color: diff > 0 ? 'text-emerald-400' : 'text-rose-400',
            key: `${p.id}-${key}`
          };

          // Para geçmişine ekle — logs'tan bu oyuncuya ait son kaydı bul
          const recentLog = logs && logs.length > 0
            ? [...logs].reverse().find(l => l.text && l.text.includes(p.name))
            : null;
          const reason = recentLog
            ? recentLog.text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 100)
            : diff > 0 ? 'Para girişi' : 'Para çıkışı';

          if (!moneyHistoryRef.current[p.id]) {
            moneyHistoryRef.current[p.id] = [];
          }
          moneyHistoryRef.current[p.id].push({
            delta: diff,
            reason,
            time: now,
            balance: p.money
          });
          // Max 30 kayıt tut
          if (moneyHistoryRef.current[p.id].length > 30) {
            moneyHistoryRef.current[p.id].shift();
          }
        }
      }
      prevBalancesRef.current[p.id] = p.money;
    });

    if (Object.keys(newDeltas).length > 0) {
      setActiveDeltas(prev => ({ ...prev, ...newDeltas }));
      const timer = setTimeout(() => {
        setActiveDeltas(prev => {
          const updated = { ...prev };
          Object.keys(newDeltas).forEach(pid => {
            if (updated[pid]?.key === newDeltas[pid].key) {
              delete updated[pid];
            }
          });
          return updated;
        });
      }, 2900);
      return () => clearTimeout(timer);
    }
  }, [players, logs]);

  return (
    <>
      {/* Para Geçmişi Modalı */}
      {historyModal && (() => {
        const hp = players.find(p => p.id === historyModal);
        if (!hp) return null;
        return (
          <MoneyHistoryModal
            player={hp}
            history={hp.moneyHistory && hp.moneyHistory.length > 0 ? hp.moneyHistory : (moneyHistoryRef.current[historyModal] || [])}
            onClose={() => setHistoryModal(null)}
          />
        );
      })()}
    <div className="cardstock-panel rounded-3xl p-3.5 sm:p-4.5 flex flex-col gap-3 text-slate-900 dark:text-slate-100 flex-shrink-0">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 font-space">
          <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Oyuncu Durumları</span>
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold font-jetbrains">
            {players.filter(p => !p.isBankrupt).length} Aktif
          </span>
          {/* Kompakt / Genişlet Toggle Butonu */}
          <button
            onClick={() => setIsCompact(prev => !prev)}
            className="p-1 sm:px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white transition cursor-pointer flex items-center gap-1 text-[10px] font-bold font-jetbrains shadow-xs active:scale-95"
            title={isCompact ? 'Geniş Görünüme Geç (Tapu ve Portföy Ayrıntılarını Gör)' : 'Kompakt Görünüme Geç (Alttaki Menülere Yer Aç)'}
          >
            {isCompact ? <Maximize2 className="w-3 h-3 text-amber-600 dark:text-amber-400" /> : <Minimize2 className="w-3 h-3 text-slate-600 dark:text-slate-400" />}
            <span>{isCompact ? 'Genişlet' : 'Küçült'}</span>
          </button>
        </div>
      </div>

      <div className={isCompact ? 'space-y-1.5' : 'space-y-2.5'}>
        {players.map((player, idx) => {
          const isTurn = idx === currentTurnIndex;
          const isMe = player.id === myPlayerId;

          // Sahip olunan mülkler
          const ownedTiles = Object.values(properties)
            .filter(prop => prop.ownerId === player.id)
            .map(prop => BOARD_TILES[prop.tileId]);

          // Kompakt Mod Görünümü: İsim, Bakiye, Takas, Bot At (Maksimum Dikey Tasarruf)
          if (isCompact) {
            return (
              <div
                key={player.id}
                className={`px-2.5 py-1.5 rounded-xl border transition-all flex items-center justify-between gap-1.5 tile-paper-press ${
                  player.isBankrupt
                    ? 'bg-slate-100/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 opacity-40 grayscale'
                    : isTurn && isMe
                    ? 'bg-amber-50/95 dark:bg-amber-950/40 border-2 border-amber-500 ring-1 ring-amber-400/60 shadow-xs'
                    : isTurn && !isMe
                    ? 'bg-sky-50/95 dark:bg-sky-950/40 border-2 border-sky-400 ring-1 ring-sky-300/40 shadow-xs'
                    : isMe
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-600/50 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs'
                }`}
              >
                {/* Sol: Piyon İkonu + İsim + Rozetler */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div
                    className="flex-shrink-0 flex items-center justify-center"
                    title={player.token?.name || 'Piyon'}
                  >
                    <span className="text-base leading-none">{player.token?.icon || '●'}</span>
                  </div>
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 font-space truncate max-w-[65px] sm:max-w-[80px] xl:max-w-[105px]">
                    {player.name}
                  </span>
                  {isMe && (
                    <span className="text-[7.5px] bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 px-1 rounded font-black font-space flex-shrink-0">
                      SEN
                    </span>
                  )}
                  {isTurn && !isMe && !player.isBankrupt && !player.isKicked && (
                    <span className="text-[7.5px] bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-700 px-1 rounded font-bold font-jetbrains flex-shrink-0">
                      Sırada
                    </span>
                  )}
                  {player.isKicked ? (
                    <span className="text-[7.5px] bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 px-1 rounded font-bold font-jetbrains flex-shrink-0">
                      Atıldı
                    </span>
                  ) : player.isBankrupt ? (
                    <span className="text-[7.5px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 px-1 rounded font-bold font-jetbrains flex-shrink-0">
                      İflas
                    </span>
                  ) : null}
                  {player.inJail && !player.isBankrupt && !player.isKicked ? (
                    <span className="text-[7.5px] bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 px-1 rounded font-bold flex items-center flex-shrink-0" title="Kodeste (Tam Kira Toplar)">
                      🚨
                    </span>
                  ) : BOARD_TILES[player.position] ? (
                    <span className="text-[8.5px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[80px] hidden sm:inline" title={BOARD_TILES[player.position].name}>
                      📍{BOARD_TILES[player.position].name}
                    </span>
                  ) : null}
                </div>

                {/* Orta: Kompakt Hızlı Aksiyon Butonları (Takas, Bot At) */}
                {!player.isBankrupt && !isMe && gameState.status === 'playing' ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onOpenTrade(player)}
                      className="text-[9px] font-bold text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 rounded transition flex items-center gap-0.5 cursor-pointer shadow-xs"
                      title="Mülk ve Para Takası Yap"
                    >
                      <Handshake className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                      <span className="hidden xl:inline">Takas</span>
                    </button>
                    {isHost && player.isBot && onRemoveBot && (
                      <button
                        onClick={() => {
                          if (window.confirm(`${player.name} botunu oyundan atmak istediğinize emin misiniz?`)) {
                            onRemoveBot(player.id);
                          }
                        }}
                        className="text-[9px] font-bold text-rose-800 dark:text-rose-300 hover:text-rose-950 dark:hover:text-rose-100 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-300 dark:border-rose-800/60 px-1 py-0.5 rounded transition cursor-pointer shadow-xs"
                        title="Bu botu oyundan at"
                      >
                        <Trash2 className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                      </button>
                    )}
                  </div>
                ) : null}

                {/* Sağ: Canlı Bakiye (Tüm oyuncularda en sağda hizalı) */}
                <div className="flex items-center justify-end gap-1 flex-shrink-0 relative min-w-[45px] text-right">
                  {activeDeltas[player.id] && (
                    <div
                      key={activeDeltas[player.id].key}
                      className={`absolute -top-3.5 right-0 ${activeDeltas[player.id].color} font-black text-[9px] animate-floatUp pointer-events-none drop-shadow-sm z-30 select-none`}
                    >
                      {activeDeltas[player.id].text}
                    </div>
                  )}
                  <button
                    onClick={() => setHistoryModal(player.id)}
                    className="text-xs font-black text-slate-900 dark:text-slate-100 font-jetbrains hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer underline-offset-2 hover:underline"
                    title="Para giriş/çıkış geçmişini gör"
                  >
                    {player.isKicked ? 'Atıldı' : player.isBankrupt ? 'İflas' : `${player.money.toLocaleString('tr-TR')}₺`}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={player.id}
              className={`p-3 rounded-2xl border transition-all relative overflow-hidden tile-paper-press ${
                player.isBankrupt
                  ? 'bg-slate-100/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 opacity-40 grayscale'
                  : isTurn && isMe
                  ? 'bg-amber-50/95 dark:bg-amber-950/40 border-2 border-amber-500 ring-2 ring-amber-400/60 shadow-[0_4px_18px_rgba(245,158,11,0.25)] active-player-glow'
                  : isTurn && !isMe
                  ? 'bg-sky-50/95 dark:bg-sky-950/40 border-2 border-sky-400 ring-2 ring-sky-300/40 shadow-[0_4px_16px_rgba(56,189,248,0.2)]'
                  : isMe
                  ? 'bg-amber-50/40 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-600/50 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Üst Kısım: İsim, Bakiye, Piyon */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex-shrink-0 flex items-center justify-center"
                    title={player.token?.name || 'Piyon'}
                  >
                    <span className="text-2xl leading-none">{player.token?.icon || '●'}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-sm text-slate-900 dark:text-slate-100 font-space">{player.name}</span>
                      {isMe && (
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 px-1 rounded font-black font-space">
                          SEN
                        </span>
                      )}
                      {isTurn && !isMe && !player.isBankrupt && !player.isKicked && (
                        <span className="text-[10px] bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-700 px-1 rounded font-bold font-jetbrains flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                          <span>Sırada</span>
                        </span>
                      )}
                      {player.isKicked ? (
                        <span className="text-[10px] bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 px-1.5 py-0.5 rounded font-bold font-jetbrains">
                          Atıldı
                        </span>
                      ) : player.isBankrupt ? (
                        <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 rounded font-bold font-jetbrains">
                          İflas Etti
                        </span>
                      ) : null}
                      {player.isBot && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 px-1 rounded font-bold font-jetbrains flex items-center gap-0.5">
                            <Bot className="w-2.5 h-2.5" /> Bot
                          </span>
                          {isHost && onSetBotDifficulty ? (
                            <select
                              value={player.difficulty || 'orta'}
                              onChange={(e) => onSetBotDifficulty(player.id, e.target.value)}
                              className="bg-white dark:bg-slate-800 border border-amber-400/60 text-amber-900 dark:text-amber-300 text-[9px] font-bold rounded px-1 py-0.2 cursor-pointer focus:outline-none"
                              title="Bot Zorluk Seviyesi"
                            >
                              <option value="cok_kolay" className="bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300">Çok Kolay</option>
                              <option value="kolay" className="bg-white dark:bg-slate-800 text-sky-800 dark:text-sky-300">Kolay</option>
                              <option value="orta" className="bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300">Orta</option>
                              <option value="zor" className="bg-white dark:bg-slate-800 text-orange-800 dark:text-orange-300">Zor</option>
                              <option value="imkansiz" className="bg-white dark:bg-slate-800 text-rose-800 dark:text-rose-300">İmkansız</option>
                            </select>
                          ) : (
                            <span className="text-[9px] font-bold text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-1 py-0.2 rounded font-jetbrains">
                              {player.difficulty === 'cok_kolay' ? 'Çok Kolay' : player.difficulty === 'kolay' ? 'Kolay' : player.difficulty === 'zor' ? 'Zor' : player.difficulty === 'imkansiz' ? 'İmkansız' : 'Orta'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {player.inJail ? (
                        <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5" title="Resmi Kural: Kodesteyken tam kira toplanır">
                          <ShieldAlert className="w-3 h-3" /> Kodeste ({player.jailTurns}/3)
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                          {BOARD_TILES[player.position]?.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bakiye & Takas/Bot Butonları */}
                <div className="flex flex-col items-end gap-1 relative">
                  {/* Uçan / Yükselen Kira Değişimi Rozeti (-₺ / +₺) */}
                  {activeDeltas[player.id] && (
                    <div
                      key={activeDeltas[player.id].key}
                      className={`absolute -top-3.5 right-0 ${activeDeltas[player.id].color} font-black text-xs sm:text-sm animate-floatUp pointer-events-none drop-shadow-md z-30 select-none`}
                    >
                      {activeDeltas[player.id].text}
                    </div>
                  )}
                  <button
                    onClick={() => setHistoryModal(player.id)}
                    className="text-base font-black text-slate-900 dark:text-slate-100 font-jetbrains tracking-tight hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer underline-offset-2 hover:underline"
                    title="Para giriş/çıkış geçmişini gör"
                  >
                    {player.isKicked ? 'Atıldı' : player.isBankrupt ? 'İflas Etti' : `${player.money.toLocaleString('tr-TR')}₺`}
                  </button>
                  {!player.isBankrupt && !isMe && gameState.status === 'playing' && (
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      <button
                        onClick={() => onOpenTrade(player)}
                        className="text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 rounded-lg transition flex items-center gap-0.5 cursor-pointer shadow-xs"
                        title="Mülk ve Para Takası Yap"
                      >
                        <Handshake className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>Takas</span>
                      </button>
                      {isHost && player.isBot && onRemoveBot && (
                        <button
                          onClick={() => {
                            if (window.confirm(`${player.name} botunu oyundan atmak istediğinize emin misiniz?`)) {
                              onRemoveBot(player.id);
                            }
                          }}
                          className="text-[10px] font-bold text-rose-800 dark:text-rose-300 hover:text-rose-950 dark:hover:text-rose-100 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-300 dark:border-rose-800/60 px-1.5 py-0.5 rounded-lg transition flex items-center gap-0.5 cursor-pointer shadow-xs"
                          title="Bu botu oyundan at"
                        >
                          <Trash2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          <span>At</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Sahip Olunan Mülk Renk Çipleri */}
              {ownedTiles.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-1">
                  {ownedTiles.map(tile => {
                    const prop = properties[tile.id];
                    return (
                      <button
                        key={tile.id}
                        onClick={() => onTileClick(tile)}
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold text-white shadow-xs flex items-center gap-1 transition hover:brightness-110 cursor-pointer ${
                          prop.mortgaged ? 'opacity-40 line-through' : ''
                        }`}
                        style={{ backgroundColor: tile.groupColor || '#475569' }}
                        title={`${tile.name} (${prop.houses === 5 ? 'Otel' : `${prop.houses} Ev`})`}
                      >
                        <span className="font-space">{tile.name}</span>
                        {prop.houses > 0 && (
                          <span className="text-[8px] bg-black/40 px-1 rounded font-jetbrains">
                            {prop.houses === 5 ? '🏨' : `🏠${prop.houses}`}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}

function arePlayerPanelPropsEqual(prev, next) {
  if (prev.myPlayerId !== next.myPlayerId) return false;
  if (!prev.gameState || !next.gameState) return prev.gameState === next.gameState;

  if (prev.gameState.currentTurnIndex !== next.gameState.currentTurnIndex) return false;
  if (prev.gameState.status !== next.gameState.status) return false;
  if (prev.gameState.phase !== next.gameState.phase) return false;

  const p1 = prev.gameState.players || [];
  const p2 = next.gameState.players || [];
  if (p1.length !== p2.length) return false;

  for (let i = 0; i < p1.length; i++) {
    const a = p1[i];
    const b = p2[i];
    if (!a || !b) return false;
    if (
      a.id !== b.id ||
      a.money !== b.money ||
      a.position !== b.position ||
      a.inJail !== b.inJail ||
      a.isBankrupt !== b.isBankrupt ||
      a.isHost !== b.isHost ||
      a.difficulty !== b.difficulty ||
      a.ping !== b.ping
    ) {
      return false;
    }
  }

  // Mülkler kontrolü (ev, otel, ipotek veya sahip değişti mi)
  const pr1 = prev.gameState.properties;
  const pr2 = next.gameState.properties;
  if (pr1 !== pr2) {
    if (!pr1 || !pr2) return false;
    for (const id in pr2) {
      if (
        pr1[id]?.ownerId !== pr2[id]?.ownerId ||
        pr1[id]?.houses !== pr2[id]?.houses ||
        pr1[id]?.mortgaged !== pr2[id]?.mortgaged
      ) {
        return false;
      }
    }
  }

  return true;
}

export const PlayerPanel = React.memo(PlayerPanelBase, arePlayerPanelPropsEqual);
