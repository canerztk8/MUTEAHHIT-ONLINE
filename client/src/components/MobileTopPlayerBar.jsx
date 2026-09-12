import React, { useState } from 'react';
import { Users, Landmark, MessageSquare, ShieldAlert, Bot, X, Handshake, ChevronDown } from 'lucide-react';
import { BOARD_TILES } from '../game/boardData.js';

export function MobileTopPlayerBar({
  gameState,
  myPlayerId,
  onOpenTrade,
  onOpenDeeds,
  onOpenChat,
  onKickPlayer,
  onRemoveBot,
  unreadChatCount = 0
}) {
  const { players = [], currentTurnIndex = 0, properties = {} } = gameState || {};
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const activePlayer = players[currentTurnIndex];
  const myPlayer = players.find(p => p.id === myPlayerId);
  const isHost = Boolean(myPlayer?.isHost);

  return (
    <>
      {/* Üst Yatay Oyuncu Çubuğu (Sadece Mobil/Tablet ekranlarda) */}
      <div className="lg:hidden w-full flex items-center justify-between gap-1.5 px-2 py-1.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-md flex-shrink-0 z-30 select-none">
        {/* Yatay Kaydırılabilir Oyuncu Çipleri */}
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0">
          {players.map((p, idx) => {
            const isTurn = idx === currentTurnIndex;
            const isMe = p.id === myPlayerId;
            const isBankrupt = p.isBankrupt;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPlayer(p)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer flex-shrink-0 text-left border ${
                  isBankrupt
                    ? 'bg-slate-900/60 border-slate-800 opacity-40 grayscale text-slate-500'
                    : isTurn && isMe
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-2 ring-amber-400/50 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                    : isTurn && !isMe
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200 ring-2 ring-sky-400/40 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                    : isMe
                    ? 'bg-amber-950/30 border-amber-600/40 text-amber-100'
                    : 'bg-slate-800/80 border-slate-750 text-slate-200 hover:bg-slate-750'
                }`}
              >
                {/* Piyon Rengi / Avatar */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-white/50 shadow-xs"
                  style={{ backgroundColor: p.color || '#cbd5e1' }}
                />

                {/* İsim */}
                <span className="text-[11px] font-black truncate max-w-[70px] font-space">
                  {p.name}
                </span>

                {/* Bakiye */}
                <span className={`text-[10.5px] font-black font-jetbrains ${
                  isBankrupt ? 'text-slate-500' : 'text-amber-400'
                }`}>
                  {p.money?.toLocaleString('tr-TR')}₺
                </span>

                {/* Sıra İkonu */}
                {isTurn && (
                  <span className="text-xs animate-bounce-short">🎲</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sağ Mobil Hızlı Erişim Butonları: Tapularım ve Sohbet */}
        <div className="flex items-center gap-1 flex-shrink-0 pl-1 border-l border-slate-800">
          <button
            type="button"
            onClick={onOpenDeeds}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold font-jetbrains cursor-pointer active:scale-95 transition"
            title="Tapu Senetleri Portföyü"
          >
            <Landmark className="w-3 h-3 text-sky-400" />
            <span className="hidden sm:inline">Tapular</span>
          </button>

          <button
            type="button"
            onClick={onOpenChat}
            className="relative flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold font-jetbrains cursor-pointer active:scale-95 transition"
            title="Sohbet ve Oyun Günlüğü"
          >
            <MessageSquare className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Sohbet</span>
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            )}
          </button>
        </div>
      </div>

      {/* Tıklanan Oyuncu Bilgi & Takas Modalı (Mobil Bottom Sheet) */}
      {selectedPlayer && (() => {
        const p = selectedPlayer;
        const isMe = p.id === myPlayerId;
        const ownedTiles = Object.values(properties)
          .filter(prop => prop.ownerId === p.id)
          .map(prop => BOARD_TILES[prop.tileId])
          .filter(Boolean);

        return (
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-2 animate-fadeIn"
            onClick={() => setSelectedPlayer(null)}
          >
            <div
              className="w-full max-w-sm bg-slate-900 border border-slate-750 rounded-3xl p-4 shadow-2xl flex flex-col gap-3 text-slate-100 max-h-[80vh] overflow-y-auto custom-scrollbar"
              onClick={e => e.stopPropagation()}
            >
              {/* Başlık */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-5 h-5 rounded-full border border-white/60 shadow-sm flex-shrink-0"
                    style={{ backgroundColor: p.color || '#cbd5e1' }}
                  />
                  <div>
                    <div className="font-space font-black text-sm flex items-center gap-1.5">
                      <span>{p.name}</span>
                      {p.isBot && (
                        <span className="text-[9px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-700">BOT</span>
                      )}
                      {p.isHost && (
                        <span className="text-[9px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-700">KURUCU</span>
                      )}
                    </div>
                    <div className="text-xs font-black text-amber-400 font-jetbrains">
                      Bakiye: {p.money?.toLocaleString('tr-TR')}₺
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mülkler */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-space flex items-center justify-between">
                  <span>Sahip Olunan Mülkler</span>
                  <span className="font-jetbrains text-sky-400">{ownedTiles.length} Adet</span>
                </div>

                {ownedTiles.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">Henüz mülk satın alınmadı.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {ownedTiles.map(tile => (
                      <div
                        key={tile.id}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tile.color || '#64748b' }}
                        />
                        <span className="truncate font-semibold text-slate-200">{tile.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Eylemler: Takas & Kick */}
              <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                {!isMe && !p.isBankrupt && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlayer(null);
                      onOpenTrade?.(p);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:brightness-110 text-white text-xs font-bold font-space flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition"
                  >
                    <Handshake className="w-3.5 h-3.5" />
                    <span>Takas Teklif Et</span>
                  </button>
                )}

                {isHost && !isMe && (
                  <button
                    type="button"
                    onClick={() => {
                      if (p.isBot) {
                        onRemoveBot?.(p.id);
                      } else {
                        onKickPlayer?.(p.id);
                      }
                      setSelectedPlayer(null);
                    }}
                    className="py-2 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold font-space flex items-center justify-center gap-1 cursor-pointer transition"
                    title="Odadan Çıkar"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>At</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
