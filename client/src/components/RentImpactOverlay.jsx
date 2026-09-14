import React from 'react';
import { Skull, TrendingDown, Coins, Trophy } from 'lucide-react';

export function RentImpactOverlay({ rentNotification, myPlayerId }) {
  if (!rentNotification) return null;

  const amount = rentNotification.amount || 0;
  if (amount < 400) return null;

  const effectiveMyId = myPlayerId;
  const isPayer = Boolean(effectiveMyId && rentNotification.payerId === effectiveMyId);
  const isReceiver = Boolean(effectiveMyId && rentNotification.ownerId === effectiveMyId);

  // Sadece parayı ödeyen veya alan oyuncunun ekranında tetiklenir (3. taraf izleyiciler rahatsız edilmez)
  if (!isPayer && !isReceiver) return null;

  const isTier2 = amount >= 1000; // 1000₺ ve üzeri: Kritik Darbe / Büyük Vurgun
  const animClass = isPayer
    ? (isTier2 ? 'animate-rent-damage-tier2' : 'animate-rent-damage-tier1')
    : (isTier2 ? 'animate-rent-gain-tier2' : 'animate-rent-gain-tier1');

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-40 pointer-events-none select-none overflow-hidden flex flex-col justify-between items-center"
    >
      {/* 🔴 ÖDEYEN OYUNCU: CAN YAKICI KIRMIZI KENAR IŞIMASI & VIGNETTE */}
      {isPayer && (
        <div className={`absolute inset-0 pointer-events-none ${animClass}`}>
          {/* Sol Kenar Kızıl Işık Huzmesi */}
          <div
            className={`absolute inset-y-0 left-0 ${
              isTier2 ? 'w-24 sm:w-44 md:w-56' : 'w-16 sm:w-28 md:w-36'
            } bg-gradient-to-r ${
              isTier2
                ? 'from-red-600/90 via-rose-600/50 to-transparent'
                : 'from-red-500/70 via-rose-500/30 to-transparent'
            }`}
          />

          {/* Sağ Kenar Kızıl Işık Huzmesi */}
          <div
            className={`absolute inset-y-0 right-0 ${
              isTier2 ? 'w-24 sm:w-44 md:w-56' : 'w-16 sm:w-28 md:w-36'
            } bg-gradient-to-l ${
              isTier2
                ? 'from-red-600/90 via-rose-600/50 to-transparent'
                : 'from-red-500/70 via-rose-500/30 to-transparent'
            }`}
          />

          {/* Tier 2 İçin Üst ve Alt Koyu Vişne Baskısı */}
          {isTier2 && (
            <>
              <div className="absolute inset-x-0 top-0 h-20 sm:h-32 bg-gradient-to-b from-red-700/80 via-rose-900/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-20 sm:h-32 bg-gradient-to-t from-red-700/80 via-rose-900/40 to-transparent" />
            </>
          )}

          {/* Bütünsel Kenar Kararması / Kızarması (Radial Vignette) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: isTier2
                ? 'radial-gradient(ellipse at center, transparent 35%, rgba(225, 29, 72, 0.25) 65%, rgba(136, 19, 55, 0.85) 100%)'
                : 'radial-gradient(ellipse at center, transparent 55%, rgba(239, 68, 68, 0.18) 80%, rgba(185, 28, 28, 0.6) 100%)'
            }}
          />
        </div>
      )}

      {/* 🟢 ALAN OYUNCU: ZÜMRÜT YEŞİLİ & ALTIN KAZANÇ IŞIMASI */}
      {isReceiver && (
        <div className={`absolute inset-0 pointer-events-none ${animClass}`}>
          {/* Sol Kenar Zümrüt Işık Huzmesi */}
          <div
            className={`absolute inset-y-0 left-0 ${
              isTier2 ? 'w-24 sm:w-44 md:w-56' : 'w-16 sm:w-28 md:w-36'
            } bg-gradient-to-r ${
              isTier2
                ? 'from-amber-400/90 via-emerald-500/60 to-transparent'
                : 'from-emerald-500/70 via-teal-500/30 to-transparent'
            }`}
          />

          {/* Sağ Kenar Zümrüt Işık Huzmesi */}
          <div
            className={`absolute inset-y-0 right-0 ${
              isTier2 ? 'w-24 sm:w-44 md:w-56' : 'w-16 sm:w-28 md:w-36'
            } bg-gradient-to-l ${
              isTier2
                ? 'from-amber-400/90 via-emerald-500/60 to-transparent'
                : 'from-emerald-500/70 via-teal-500/30 to-transparent'
            }`}
          />

          {/* Tier 2 İçin Üst ve Alt Altın Işıltı Baskısı */}
          {isTier2 && (
            <>
              <div className="absolute inset-x-0 top-0 h-20 sm:h-32 bg-gradient-to-b from-amber-400/75 via-emerald-600/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-20 sm:h-32 bg-gradient-to-t from-amber-400/75 via-emerald-600/35 to-transparent" />
            </>
          )}

          {/* Bütünsel Zümrüt / Altın Radial Vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: isTier2
                ? 'radial-gradient(ellipse at center, transparent 35%, rgba(16, 185, 129, 0.25) 65%, rgba(4, 120, 87, 0.85) 100%)'
                : 'radial-gradient(ellipse at center, transparent 55%, rgba(16, 185, 129, 0.18) 80%, rgba(5, 150, 105, 0.6) 100%)'
            }}
          />
        </div>
      )}

      {/* 🚀 SİNEMATİK ÜST HUD DARBE / VURGUN ROZETİ */}
      <div className={`relative z-50 mt-14 sm:mt-16 pointer-events-none ${animClass}`}>
        {isPayer ? (
          <div
            className={`px-4 py-2 sm:px-6 sm:py-2.5 rounded-2xl flex items-center gap-2.5 sm:gap-3 shadow-2xl backdrop-blur-md border ${
              isTier2
                ? 'bg-rose-950/95 border-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.7)] text-rose-100 ring-4 ring-rose-600/40'
                : 'bg-red-950/90 border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.5)] text-red-100'
            }`}
          >
            <div
              className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-black ${
                isTier2 ? 'bg-rose-600/40 text-rose-300 animate-pulse' : 'bg-red-600/30 text-red-300'
              }`}
            >
              {isTier2 ? <Skull className="w-5 h-5 sm:w-6 sm:h-6 text-rose-300" /> : <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-red-300" />}
            </div>
            <div className="text-left leading-tight">
              <span
                className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block ${
                  isTier2 ? 'text-rose-400' : 'text-red-400'
                }`}
              >
                {isTier2 ? 'Kritik Gider • Yüksek Kira' : 'Kira Ödendi'}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-lg sm:text-2xl font-black font-jetbrains tracking-tight text-white drop-shadow-md">
                  -{amount}₺
                </span>
                <span className="text-[10px] sm:text-xs text-rose-200 font-medium truncate max-w-[150px] sm:max-w-[200px]">
                  {rentNotification.tileName}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`px-4 py-2 sm:px-6 sm:py-2.5 rounded-2xl flex items-center gap-2.5 sm:gap-3 shadow-2xl backdrop-blur-md border ${
              isTier2
                ? 'bg-emerald-950/95 border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.7)] text-emerald-100 ring-4 ring-amber-400/40'
                : 'bg-emerald-950/90 border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.5)] text-emerald-100'
            }`}
          >
            <div
              className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-black ${
                isTier2 ? 'bg-amber-400/30 text-amber-300 animate-pulse' : 'bg-emerald-600/30 text-emerald-300'
              }`}
            >
              {isTier2 ? <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300" /> : <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300" />}
            </div>
            <div className="text-left leading-tight">
              <span
                className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block ${
                  isTier2 ? 'text-amber-300' : 'text-emerald-400'
                }`}
              >
                {isTier2 ? 'Yüksek Gelir • Kira Tahsilatı' : 'Kira Tahsil Edildi'}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-lg sm:text-2xl font-black font-jetbrains tracking-tight text-white drop-shadow-md">
                  +{amount}₺
                </span>
                <span className="text-[10px] sm:text-xs text-emerald-200 font-medium truncate max-w-[150px] sm:max-w-[200px]">
                  {rentNotification.tileName}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div />
    </div>
  );
}
