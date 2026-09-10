import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Award, Dices, Handshake, Eye, Maximize2, Minimize2, Sparkles, Crown } from 'lucide-react';
import { sounds } from '../sound/soundEffects.js';

export function WinnerModal({ winner, gameState, onRestart, onLeaveRoom }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const { stats, players, standings, properties } = gameState || {};

  useEffect(() => {
    if (winner) {
      try {
        sounds.playWinner();
      } catch (e) {}

      const end = Date.now() + 4 * 1000;
      const colors = ['#f59e0b', '#fbbf24', '#eab308', '#ef4444', '#3b82f6', '#10b981', '#a855f7'];

      (function frame() {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 60,
          origin: { x: 0 },
          colors
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 60,
          origin: { x: 1 },
          colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    }
  }, [winner]);

  if (!winner) return null;

  // İstatistik şampiyonları
  let topRentPlayer = null;
  let maxRent = 0;
  if (stats?.rentsCollected && players) {
    for (const pid in stats.rentsCollected) {
      if (stats.rentsCollected[pid] > maxRent) {
        maxRent = stats.rentsCollected[pid];
        topRentPlayer = players.find(p => p.id === pid);
      }
    }
  }

  let topDoublesPlayer = null;
  let maxDoubles = 0;
  if (stats?.doublesRolled && players) {
    for (const pid in stats.doublesRolled) {
      if (stats.doublesRolled[pid] > maxDoubles) {
        maxDoubles = stats.doublesRolled[pid];
        topDoublesPlayer = players.find(p => p.id === pid);
      }
    }
  }

  const tokenIcon = typeof winner.token === 'object' ? (winner.token?.icon || '👑') : (winner.token || '👑');

  // Mülk sayısı hesaplama
  const winnerPropsCount = properties
    ? Object.values(properties).filter(p => p.ownerId === winner.id).length
    : 0;

  // Sıralama listesi (Standings varsa sunucudan, yoksa fallback hesapla)
  const rankingList = standings && standings.length > 0 ? standings : [
    { rank: 1, name: winner.name, token: winner.token, color: winner.color, isWinner: true, money: winner.money, propertyCount: winnerPropsCount },
    ...(players ? players.filter(p => p.id !== winner.id).map((p, i) => ({
      rank: i + 2,
      name: p.name,
      token: p.token,
      color: p.color,
      isWinner: false,
      reason: p.isBankrupt ? 'İflas Etti' : 'Elendi'
    })) : [])
  ];

  // 1. KÜÇÜLTÜLMÜŞ MOD: "TAHTAYI İNCELE" AKTİF
  if (isMinimized) {
    return (
      <div className="fixed bottom-5 right-5 z-50 pointer-events-auto">
        <button
          onClick={() => setIsMinimized(false)}
          className="px-4 py-3 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm rounded-2xl shadow-2xl shadow-amber-500/40 border-2 border-amber-300 transition active:scale-95 flex items-center gap-2.5 cursor-pointer animate-trophy-glow"
        >
          <Trophy className="w-5 h-5 stroke-[2.5]" />
          <div className="text-left leading-tight">
            <span className="text-[10px] uppercase tracking-wider block font-bold opacity-80">Şampiyon: {winner.name}</span>
            <span className="text-xs font-black">🏆 Sonuç Podyumunu Aç</span>
          </div>
          <Maximize2 className="w-4 h-4 ml-1" />
        </button>
      </div>
    );
  }

  // 2. TAM EKRAN ŞAMPİYONLUK VE SIRALAMA MODALİ
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/60 rounded-3xl p-5 sm:p-7 text-center shadow-2xl shadow-amber-500/20 overflow-hidden my-auto">
        {/* Altın Parıltı & Radial Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Küçültme (Tahtayı İncele) Butonu Üst Sağ */}
        <button
          onClick={() => setIsMinimized(true)}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer active:scale-95 flex items-center gap-1 text-xs"
          title="Tahtayı İncele (Modali Küçült)"
        >
          <Eye className="w-4 h-4 text-sky-400" />
          <span className="hidden sm:inline text-[11px] font-bold">Tahtayı İncele</span>
          <Minimize2 className="w-3.5 h-3.5" />
        </button>

        <div className="relative z-10 flex flex-col items-center">
          {/* Şampiyonluk Kupası */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-3xl sm:text-4xl shadow-xl shadow-amber-500/40 mb-3 animate-trophy-glow border-2 border-amber-300">
            <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-slate-950 stroke-[2.5]" />
          </div>

          <span className="text-[10px] sm:text-xs font-black tracking-widest text-amber-400 uppercase mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            MÜTEAHHİTLİK ŞAMPİYONU
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </span>

          <h2 className="text-2xl sm:text-3xl font-black text-white mb-1 tracking-tight">
            {winner.name} KAZANDI!
          </h2>

          <p className="text-slate-400 text-xs sm:text-sm mb-4">
            Tüm rakiplerini iflas ettirerek şehrin tek gayrimenkul kralı oldu.
          </p>

          {/* Şampiyonun Kasası & Piyon Bilgisi */}
          <div className="w-full p-3 rounded-2xl bg-slate-800/90 border border-amber-500/40 flex items-center justify-around mb-4 shadow-inner">
            <div className="text-center">
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Kalan Nakit</span>
              <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                {winner.money.toLocaleString('tr-TR')}₺
              </span>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div className="text-center">
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Tapu & Mülk</span>
              <span className="text-base sm:text-lg font-black text-amber-400 font-mono">
                {winnerPropsCount} Adet
              </span>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div className="text-center">
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Piyon</span>
              <span className="text-xl sm:text-2xl">{tokenIcon}</span>
            </div>
          </div>

          {/* 🏅 NİHAİ MAÇ SIRALAMASI (PODIUM) */}
          <div className="w-full mb-4">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Nihai Sıralama Tablosu
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {rankingList.length} Oyuncu
              </span>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {rankingList.map((entry) => {
                const isChampion = entry.rank === 1;
                const isFinalist = entry.rank === 2;
                const pToken = typeof entry.token === 'object' ? (entry.token?.icon || '♟️') : (entry.token || '♟️');

                return (
                  <div
                    key={entry.playerId || entry.name}
                    className={`p-2 rounded-xl flex items-center justify-between text-xs transition border ${
                      isChampion
                        ? 'bg-amber-500/15 border-amber-500/60 shadow-sm'
                        : isFinalist
                        ? 'bg-slate-800/80 border-slate-600/80'
                        : 'bg-slate-900/60 border-slate-800/80 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] flex-shrink-0 ${
                          isChampion
                            ? 'bg-amber-400 text-slate-950 shadow'
                            : isFinalist
                            ? 'bg-slate-300 text-slate-900'
                            : entry.rank === 3
                            ? 'bg-amber-700 text-amber-100'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {entry.rank}
                      </span>
                      <span className="text-base flex-shrink-0">{pToken}</span>
                      <strong className={`truncate ${isChampion ? 'text-amber-300 font-black' : 'text-white'}`}>
                        {entry.name}
                      </strong>
                    </div>

                    <div className="text-right flex-shrink-0 text-[11px]">
                      {isChampion ? (
                        <span className="text-amber-400 font-black flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Şampiyon
                        </span>
                      ) : entry.eliminatedRound ? (
                        <span className="text-slate-400">
                          {entry.eliminatedRound}. Turda Elendi
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          {entry.reason || 'Elendi'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Maç Sonu Öne Çıkanlar (Highlights) */}
          <div className="w-full space-y-1.5 mb-4 text-left text-xs">
            {topRentPlayer && (
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span className="text-slate-300">Kira Şampiyonu:</span>
                </div>
                <strong className="text-amber-400 font-bold">{topRentPlayer.name} ({maxRent.toLocaleString('tr-TR')}₺)</strong>
              </div>
            )}
            {topDoublesPlayer && (
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dices className="w-4 h-4 text-sky-400" />
                  <span className="text-slate-300">En Şanslı Zarcı:</span>
                </div>
                <strong className="text-sky-300 font-bold">{topDoublesPlayer.name} ({maxDoubles} Çift)</strong>
              </div>
            )}
            {stats?.tradesCompleted > 0 && (
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Handshake className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300">Başarılı Takaslar:</span>
                </div>
                <strong className="text-emerald-300 font-bold">{stats.tradesCompleted} Takas</strong>
              </div>
            )}
          </div>

          {/* Butonlar */}
          <div className="w-full space-y-2">
            <button
              onClick={onRestart}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 stroke-[2.5]" />
              <span>Aynı Odada Yeniden Başla (Lobi)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsMinimized(true)}
                className="py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                <span>Tahtayı İncele</span>
              </button>

              <button
                onClick={onLeaveRoom}
                className="py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>← Ana Menü</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
