import React from 'react';

/**
 * Pawn3DToken: Gerçekçi Heykelsi 3D Tahta Oyunu Piyonu
 * Düz 2D emoji yerine silindirik ışıklandırmalı gövde, pahlama halkalı boyun,
 * fildişi/metalik küre başlık, çift kademeli kaide ve masaya düşen yumuşak gölge.
 */
export function Pawn3DToken({ player, isMe = false, size = 'small', showName = false, isMoving = false }) {
  if (!player) return null;

  const color = player.color || '#3b82f6';
  const icon = player.token?.icon || player.token || '🎩';

  // Boyutlandırma haritası
  const dimensions = {
    small: {
      headSize: 13,
      collarW: 8,
      collarH: 2,
      bodyW: 11,
      bodyH: 8,
      baseW: 14,
      baseH: 3.5,
      shadowW: 13,
      iconSize: 'text-[7.5px]',
      containerH: 'h-6'
    },
    medium: {
      headSize: 22,
      collarW: 13,
      collarH: 3.5,
      bodyW: 19,
      bodyH: 14,
      baseW: 24,
      baseH: 6.5,
      shadowW: 22,
      iconSize: 'text-xs',
      containerH: 'h-10'
    },
    large: {
      headSize: 32,
      collarW: 19,
      collarH: 5,
      bodyW: 28,
      bodyH: 20,
      baseW: 36,
      baseH: 9,
      shadowW: 34,
      iconSize: 'text-lg',
      containerH: 'h-14'
    }
  }[size] || dimensions.small;

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-end select-none group cursor-pointer ${
        isMe ? 'z-30' : 'z-10'
      } ${isMoving ? 'animate-bounce' : ''}`}
      title={`${player.name} (${player.token?.name || 'Piyon'}) ${isMe ? '• SEN' : ''}`}
    >
      {/* Piyon Gövde Grubu */}
      <div className={`relative flex flex-col items-center justify-end transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-1`}>
        {/* Oyuncunun Kendisine Aitse Tepe Işıltısı (Golden Beacon Halo) */}
        {isMe && (
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping opacity-80 pointer-events-none" />
        )}

        {/* 1. 3D Piyon Başlığı (Işık Yansımalı Küre) */}
        <div
          className="relative rounded-full flex items-center justify-center border border-white/50 overflow-hidden z-20"
          style={{
            width: `${dimensions.headSize}px`,
            height: `${dimensions.headSize}px`,
            background: `radial-gradient(circle at 35% 28%, #ffffff 0%, ${color} 48%, #030712 100%)`,
            boxShadow: isMe
              ? `0 0 12px rgba(251, 191, 36, 0.9), inset 0 2px 4px rgba(255, 255, 255, 0.9), 0 3px 6px rgba(0, 0, 0, 0.7)`
              : `inset 0 2px 3px rgba(255, 255, 255, 0.8), 0 3px 5px rgba(0, 0, 0, 0.6)`
          }}
        >
          {/* Tepe Parlaması (Specular Flare) */}
          <div className="absolute top-0.5 left-1 w-2 h-1 bg-white/80 rounded-full blur-[0.4px] pointer-events-none" />

          {/* Figür / Karakter Rozeti */}
          <span className={`${dimensions.iconSize} drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)] filter leading-none transform transition-transform group-hover:scale-110`}>
            {icon}
          </span>
        </div>

        {/* 2. Metalik Boyun Halkası (Neck Collar) */}
        <div
          className="-mt-0.5 rounded-full border border-white/60 z-15 shadow-sm"
          style={{
            width: `${dimensions.collarW}px`,
            height: `${dimensions.collarH}px`,
            background: `linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(255,255,255,0.9) 50%, rgba(0,0,0,0.7) 100%)`
          }}
        />

        {/* 3. Konik 3D Gövde / Bel (Sculpted Conical Body) */}
        <div
          className="-mt-0.5 z-10"
          style={{
            width: `${dimensions.bodyW}px`,
            height: `${dimensions.bodyH}px`,
            clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)',
            background: `linear-gradient(90deg, rgba(0,0,0,0.65) 0%, ${color} 30%, rgba(255,255,255,0.6) 55%, ${color} 80%, rgba(0,0,0,0.7) 100%)`,
            boxShadow: `inset 0 2px 4px rgba(255,255,255,0.4)`
          }}
        />

        {/* 4. Çift Kademeli Kaide / Alt Tabla (Beveled Stepped Pedestal Base) */}
        <div
          className="-mt-0.5 rounded-full border border-white/60 z-10 shadow-lg"
          style={{
            width: `${dimensions.baseW}px`,
            height: `${dimensions.baseH}px`,
            background: `linear-gradient(180deg, rgba(255,255,255,0.9) 0%, ${color} 35%, #050b14 100%)`,
            boxShadow: `0 3px 5px rgba(0,0,0,0.85), inset 0 1px 2px rgba(255,255,255,0.7)`
          }}
        />
      </div>

      {/* 5. Masaya Vuran 3D Yumuşak Gölge (Contact Shadow) */}
      <div
        className="rounded-full bg-black/75 blur-[1.5px] pointer-events-none -mt-1"
        style={{
          width: `${dimensions.shadowW}px`,
          height: `${Math.max(3, dimensions.baseH * 0.6)}px`
        }}
      />

      {showName && (
        <span className="text-[8.5px] font-black text-white bg-slate-950/85 px-1 py-0.2 rounded mt-0.5 truncate max-w-[65px] border border-slate-700 leading-none">
          {player.name}
        </span>
      )}
    </div>
  );
}

