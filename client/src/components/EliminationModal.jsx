import React, { useEffect, useState, useRef } from 'react';
import { Skull, Eye, LogOut, Trophy, AlertOctagon, X, Flame } from 'lucide-react';
import { sounds } from '../sound/soundEffects.js';

export function EliminationModal({
  elimination,
  isMe,
  hasWinner,
  onClose,
  onSpectate,
  onLeaveRoom,
  onShowWinner
}) {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const playedElimIdRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Her elenme olayında (elimination.id) iflas sesini YALNIZCA BİR KEZ çal
  useEffect(() => {
    if (!elimination?.id) return;
    if (playedElimIdRef.current === elimination.id) return;
    playedElimIdRef.current = elimination.id;

    try {
      sounds.playBankruptcy();
    } catch (e) {}
  }, [elimination?.id]);

  // Başka bir oyuncu elendiyse 5 saniyelik otomatik kapanma geri sayımı (onClose yeniden oluşunca sıfırlanmaz)
  useEffect(() => {
    if (!elimination || isMe) return;

    setSecondsLeft(5);
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onCloseRef.current) onCloseRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [elimination?.id, isMe]);

  if (!elimination) return null;

  const playerToken = typeof elimination.token === 'object' ? (elimination.token?.icon || '♟️') : (elimination.token || '♟️');
  const creditorToken = typeof elimination.creditorToken === 'object' ? (elimination.creditorToken?.icon || '🏦') : (elimination.creditorToken || '🏦');

  // 1. DURUM: BİZ ELENDİK (Full screen dramatik iflas & seyirci modu seçeneği)
  if (isMe) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
        <div className="relative w-full max-w-lg bg-gradient-to-b from-rose-950 via-slate-950 to-black border-2 border-rose-600/80 rounded-3xl p-6 sm:p-8 text-center shadow-2xl animate-elimination-pulse overflow-hidden">
          {/* Kırmızı arka plan ışık huzmesi */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-rose-600/25 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center">
            {/* Animasyonlu Titreyen Kurukafa İkonu */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-rose-700 via-red-600 to-rose-900 border-2 border-rose-400 flex items-center justify-center text-4xl sm:text-5xl shadow-2xl shadow-rose-600/50 mb-4 animate-dramatic-shake">
              <Skull className="w-10 h-10 sm:w-12 sm:h-12 text-rose-100 stroke-[2.5]" />
            </div>

            <span className="text-[11px] sm:text-xs font-black tracking-widest text-rose-400 uppercase mb-1 flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5" /> İFLAS BAYRAĞI ÇEKİLDİ
            </span>

            <h2 className="text-2xl sm:text-4xl font-black text-white mb-2 tracking-tight">
              OYUNDAN ELENDİNİZ!
            </h2>

            <p className="text-rose-200/80 text-xs sm:text-sm mb-5 max-w-sm">
              Borcunuzu ödeyemediğiniz ve varlıklarınızı nakde çeviremediğiniz için resmi kurallar gereği iflas ettiniz.
            </p>

            {/* İflas Detay Kartı */}
            <div className="w-full bg-slate-900/90 border border-rose-900/80 rounded-2xl p-4 mb-6 text-left space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-rose-900/40">
                <span className="text-xs text-slate-400">Elenme Sıralaması:</span>
                <strong className="text-rose-400 font-black text-sm flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-rose-950 border border-rose-700 text-xs">
                    #{elimination.rank}. Sırada
                  </span>
                </strong>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-rose-900/40">
                <span className="text-xs text-slate-400">Elenilen Tur:</span>
                <strong className="text-white font-mono text-sm">{elimination.round}. Tur</strong>
              </div>

              {elimination.debtAmount > 0 && (
                <div className="flex items-center justify-between pb-2 border-b border-rose-900/40">
                  <span className="text-xs text-slate-400">Ödenemeyen Kasa Açığı:</span>
                  <strong className="text-rose-400 font-mono font-black text-sm">
                    {elimination.debtAmount.toLocaleString('tr-TR')} ₺
                  </strong>
                </div>
              )}

              <div className="flex items-start justify-between pt-0.5">
                <span className="text-xs text-slate-400">Alacaklı / Sebep:</span>
                <span className="text-xs font-bold text-slate-200 text-right max-w-[200px] flex items-center gap-1 justify-end">
                  {elimination.creditorName ? (
                    <>
                      <span>{creditorToken}</span>
                      <strong className="text-amber-300">{elimination.creditorName}</strong>
                    </>
                  ) : (
                    <span className="text-slate-300">Banka / Maliye İcrası</span>
                  )}
                </span>
              </div>
            </div>

            {/* Butonlar */}
            <div className="w-full space-y-2.5">
              {hasWinner && (
                <button
                  onClick={onShowWinner || onClose}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-amber-500/25 hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trophy className="w-5 h-5 stroke-[2.5]" />
                  <span>Şampiyonluk Törenine Geç →</span>
                </button>
              )}

              <button
                onClick={onSpectate || onClose}
                className="w-full py-3 bg-slate-800/90 hover:bg-slate-700 text-white font-black text-xs sm:text-sm rounded-2xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Eye className="w-4 h-4 text-sky-400" />
                <span>Oyunu Canlı İzlemeye Devam Et (Seyirci Modu)</span>
              </button>

              <button
                onClick={onLeaveRoom}
                className="w-full py-2.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white font-bold text-xs rounded-xl border border-rose-800/60 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Odadan Ayrıl / Ana Menüye Dön</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. DURUM: BAŞKA BİR OYUNCU ELENDİ (Üst/Orta Floating Görkemli Duyuru Bannerı)
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 pointer-events-auto">
      <div className="relative overflow-hidden bg-slate-950/95 border-2 border-rose-500/90 rounded-2xl p-4 sm:p-5 shadow-[0_0_35px_rgba(244,63,94,0.5)] backdrop-blur-2xl animate-in slide-in-from-top-6 duration-300">
        {/* 5 Saniyelik Animasyonlu Geri Sayım Çubuğu */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-950/60 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-rose-500 to-red-600 animate-countdown-bar" />
        </div>

        <div className="flex items-center gap-3.5 sm:gap-4 mt-1">
          {/* Elenen Oyuncu Avatarı & Kurukafa Rozeti */}
          <div className="relative flex-shrink-0">
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl border-2 shadow-lg"
              style={{
                backgroundColor: elimination.color ? `${elimination.color}22` : '#1e293b',
                borderColor: elimination.color || '#ef4444'
              }}
            >
              {playerToken}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-rose-600 border border-white flex items-center justify-center text-xs text-white shadow">
              <Skull className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>

          {/* Elenme Bilgisi */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-800/80">
                <Flame className="w-3 h-3 text-rose-400" /> #{elimination.rank}. SIRADA ELENDİ
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {elimination.round}. Tur
              </span>
            </div>

            <h3 className="text-white font-black text-sm sm:text-base leading-tight truncate">
              {elimination.name} <span className="text-rose-400 font-extrabold">İflas Etti!</span>
            </h3>

            <p className="text-slate-300 text-xs truncate mt-0.5">
              {elimination.creditorName ? (
                <span>Alacaklı: <strong className="text-amber-300 font-bold">{elimination.creditorName}</strong> ({elimination.reason})</span>
              ) : (
                <span className="text-slate-400">{elimination.reason}</span>
              )}
            </p>
          </div>

          {/* Kapat / İncele Butonu */}
          <div className="flex-shrink-0 flex items-center gap-2">
            {hasWinner ? (
              <button
                onClick={onShowWinner || onClose}
                className="px-3 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 rounded-xl font-black text-xs hover:brightness-110 active:scale-95 transition shadow-md flex items-center gap-1 cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">Şampiyon</span>
              </button>
            ) : null}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer active:scale-95"
              title="Bildirimi Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
