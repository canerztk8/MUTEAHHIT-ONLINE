import React, { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';

/**
 * Saniyeyi MM:SS veya HH:MM:SS formatına dönüştürür.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatGameElapsed(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Oyunun başladığı andan itibaren geçen süreyi gösteren,
 * performansı yüksek, yalıtılmış (isolated) sayaç bileşeni.
 * Sadece bu küçük bileşen saniyede bir yeniden çizilir;
 * üst bileşenler veya 3D sahne gereksiz re-render edilmez.
 */
export function GameElapsedTimer({
  gameStartTime,
  isPaused = false,
  pausedAt = null,
  totalPausedDuration = 0,
  status = 'playing'
}) {
  const computeElapsed = useCallback(() => {
    if (!gameStartTime || status === 'lobby') {
      return 0;
    }
    const now = Date.now();
    const currentPauseExtra = (isPaused && pausedAt) ? Math.max(0, now - pausedAt) : 0;
    const totalPaused = (totalPausedDuration || 0) + currentPauseExtra;
    const elapsedMs = Math.max(0, now - gameStartTime - totalPaused);
    return Math.floor(elapsedMs / 1000);
  }, [gameStartTime, isPaused, pausedAt, totalPausedDuration, status]);

  const [elapsedSeconds, setElapsedSeconds] = useState(computeElapsed);

  useEffect(() => {
    // Prop değişikliklerinde veya oyun durumunda hemen güncelle
    setElapsedSeconds(computeElapsed());

    if (status !== 'playing' || isPaused || !gameStartTime) {
      // Oyun duraklatıldığında veya lobi modundayken interval çalıştırma (CPU tasarrufu)
      return;
    }

    const intervalId = setInterval(() => {
      setElapsedSeconds(computeElapsed());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [computeElapsed, status, isPaused, gameStartTime]);

  const timeDisplay = formatGameElapsed(elapsedSeconds);

  return (
    <div
      className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-xs select-none transition-colors"
      title={isPaused ? `Oyun Duraklatıldı (Geçen Süre: ${timeDisplay})` : `Oyun Süresi: ${timeDisplay}`}
    >
      <Clock
        className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
          isPaused
            ? 'text-amber-500'
            : 'text-amber-600 dark:text-amber-400 animate-pulse'
        }`}
      />
      <span className="font-mono text-amber-700 dark:text-amber-400 font-bold font-jetbrains tracking-wider">
        {timeDisplay}
      </span>
      {isPaused && (
        <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 font-jetbrains uppercase tracking-tight ml-0.5">
          Durdu
        </span>
      )}
    </div>
  );
}
