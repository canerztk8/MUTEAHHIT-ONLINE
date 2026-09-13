import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, LogOut, Copy, Check, Zap, Pause, Play } from 'lucide-react';

export function MobileBottomActionBar({
  isHost,
  isPaused,
  onTogglePause,
  activePlayerIsBot,
  onFastForwardBot,
  volume = 0.6,
  onVolumeToggle,
  onVolumeChange,
  roomCode,
  copiedLink,
  onCopyLink,
  onLeaveGame
}) {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeMenuRef = useRef(null);

  useEffect(() => {
    if (!showVolumeSlider) return;
    const handleClickOutside = (e) => {
      if (volumeMenuRef.current && !volumeMenuRef.current.contains(e.target)) {
        setShowVolumeSlider(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showVolumeSlider]);

  return (
    <div className="lg:hidden w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-slate-900/95 border-t border-slate-800 shadow-xl flex-shrink-0 z-30 select-none pb-safe">
      {/* Sol: Ses Ayarı & Oda Kodu */}
      <div className="flex items-center gap-1.5">
        {/* Ses Butonu & Slider Açılır Pencere */}
        <div className="relative" ref={volumeMenuRef}>
          <button
            type="button"
            onClick={() => setShowVolumeSlider(prev => !prev)}
            className="min-h-[36px] min-w-[36px] p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 flex items-center justify-center transition cursor-pointer"
            title="Ses Ayarları"
          >
            {volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>

          {showVolumeSlider && (
            <div className="absolute left-0 bottom-full mb-2 z-50 w-52 p-3 rounded-2xl bg-slate-900 border-2 border-amber-500/80 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col gap-2 animate-fadeIn text-slate-100">
              <div className="flex items-center justify-between text-[11px] font-space font-extrabold uppercase tracking-wider text-slate-300">
                <span>{volume === 0 ? 'Sessiz' : 'Oyun Sesi'}</span>
                <span className="font-jetbrains font-bold text-amber-400">
                  %{Math.round(volume * 100)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onVolumeToggle}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  {volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => onVolumeChange ? onVolumeChange(parseFloat(e.target.value)) : onVolumeToggle?.()}
                  className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Oda Kodu / Link Kopyalama */}
        {roomCode && (
          <button
            type="button"
            onClick={onCopyLink}
            className="min-h-[36px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 text-[11px] font-bold font-jetbrains transition cursor-pointer"
            title="Oda Bağlantısını Kopyala"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="font-mono">{roomCode}</span>
          </button>
        )}
      </div>

      {/* Orta: Bot Atla veya Duraklat Kontrolü */}
      <div className="flex items-center gap-1.5">
        {activePlayerIsBot && onFastForwardBot && (
          <button
            type="button"
            onClick={onFastForwardBot}
            className="min-h-[36px] flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 active:scale-95 border border-amber-400/60 text-amber-300 text-[11px] font-bold font-jetbrains transition cursor-pointer animate-pulse"
            title="Bot Turunu Atla"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Botu Atla</span>
          </button>
        )}

        {isHost && onTogglePause && (
          <button
            type="button"
            onClick={onTogglePause}
            className={`min-h-[36px] flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[11px] font-bold font-space transition active:scale-95 cursor-pointer ${
              isPaused
                ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse font-extrabold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={isPaused ? 'Oyunu Devam Ettir' : 'Oyunu Duraklat'}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                <span>Devam Et</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                <span>Duraklat</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Sağ: Oyundan Ayrıl */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onLeaveGame}
          className="min-h-[36px] flex items-center gap-1 px-2.5 py-1.5 bg-rose-950/50 hover:bg-rose-900/60 active:scale-95 border border-rose-800 rounded-xl text-rose-300 text-[11px] font-bold transition cursor-pointer"
          title="Oyundan Ayrıl"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">Ayrıl</span>
        </button>
      </div>
    </div>
  );
}
