import React from 'react';
import { PLAYER_TOKENS } from '../game/boardData.js';
import { TopDownPawnSvg } from './TopDownPawnSvg.jsx';

/**
 * TopDownPawnPreview
 * ==============================================================================
 * 3D WebGL stüdyosunun yerine geçen hafif, yüksek performanslı ve kuşbakışı (2D)
 * masaüstü piyon pulu önizleme bileşeni.
 *
 * Sistemi yormayan saf CSS/SVG tabanlıdır; oyuncunun seçtiği renk ve piyonu
 * oyun tahtasındayken yukarıdan nasıl görünecekse birebir o şekilde sergiler.
 */
export function TopDownPawnPreview({
  token,
  tokenId,
  color = '#ef4444',
  playerName = '',
  isDarkMode = false,
  className = ''
}) {
  const tokenObj =
    token ||
    PLAYER_TOKENS.find(t => t.id === (tokenId || token?.id)) ||
    PLAYER_TOKENS[0];

  return (
    <div
      className={`relative w-full rounded-2xl p-4 border transition-all duration-300 overflow-hidden select-none flex flex-col items-center justify-between ${
        isDarkMode
          ? 'bg-slate-800/80 border-slate-700/80 text-white shadow-inner'
          : 'bg-slate-50/90 border-slate-200 text-slate-800 shadow-sm'
      } ${className}`}
    >
      {/* Arka Plan Yumuşak Renk İması / Ambient Halo */}
      <div
        className="absolute -top-10 left-1/2 -translate-x-1/2 w-44 h-44 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-500"
        style={{ backgroundColor: color }}
      />

      {/* Üst Bilgi Başlığı */}
      <div className="w-full flex items-center justify-between z-10 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🎯</span>
          <span className="text-[10.5px] font-space font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Kuşbakışı Piyon Görünümü
          </span>
        </div>
        <span className="text-[9.5px] font-jetbrains font-bold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300">
          2D Oyun Pulu
        </span>
      </div>

      {/* Orta Alan: Kuşbakışı Masaüstü Jetonu (Top-Down Token Disc) */}
      <div className="relative my-2 flex flex-col items-center justify-center z-10">
        {/* Dış Derinlik Gölgesi */}
        <div
          className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full p-2 transition-all duration-300 transform hover:scale-105"
          style={{
            boxShadow: `0 12px 28px -6px ${color}66, 0 4px 10px rgba(0,0,0,0.3)`
          }}
        >
          {/* Dış Eğimli Piyon Kaidesi (Beveled Outer Pedestal) */}
          <div
            className="w-full h-full rounded-full p-1.5 flex items-center justify-center transition-colors duration-300 relative overflow-hidden"
            style={{
              backgroundColor: color,
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -4px 6px rgba(0,0,0,0.45)'
            }}
          >
            {/* Üstten Işık Yansıması (Specular Highlight) */}
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.45)_0%,transparent_60%)] pointer-events-none" />

            {/* Altın / Yaldızlı Metalik İç Halka */}
            <div className="w-full h-full rounded-full border-2 border-amber-300/85 bg-black/25 flex items-center justify-center shadow-inner relative">
              {/* İkinci İnce İç Bordür */}
              <div className="absolute inset-1 rounded-full border border-white/25 pointer-events-none" />

              {/* Merkez İkon: Oyun İçi 3D Model Kuşbakışı Render Fotoğrafı */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center transform hover:scale-110 hover:rotate-3 transition-all duration-200">
                <img
                  src={`/images/pawns/${tokenObj.id}.png`}
                  alt={tokenObj.name}
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] select-none pointer-events-none"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'block';
                  }}
                />
                <div style={{ display: 'none' }}>
                  <TopDownPawnSvg
                    tokenId={tokenObj.id}
                    className="w-12 h-12 sm:w-14 sm:h-14"
                    color={color}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Kaide Altı Gerçekçi Zemin Gölgesi */}
        <div
          className="w-20 sm:w-24 h-2.5 rounded-full bg-black/20 dark:bg-black/45 blur-[3px] -mt-1 pointer-events-none"
        />
      </div>

      {/* Alt Bilgi Rozeti (İsim & Piyon Başlığı) */}
      <div className="z-10 mt-2 text-center w-full flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 shadow-xs max-w-full">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-xs"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-black font-space truncate max-w-[200px] text-slate-800 dark:text-slate-100">
            {playerName ? `${playerName} • ` : ''}{tokenObj.name}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-jetbrains mt-1">
          Oyun tahtasında piyonunuz bu pul tasarımıyla hareket eder
        </p>
      </div>
    </div>
  );
}
