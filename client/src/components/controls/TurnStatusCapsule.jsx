import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

export function TurnStatusCapsule({
  activePlayer,
  isMyTurn,
  gameState,
  myPlayerId,
  onTimeoutTurn
}) {
  const [secondsLeft, setSecondsLeft] = useState(gameState?.turnTimeLimit || 75);
  const hasEmittedTimeoutRef = useRef(false);

  useEffect(() => {
    hasEmittedTimeoutRef.current = false;

    if (!gameState?.turnStartTime || gameState?.status !== 'playing') {
      setSecondsLeft(gameState?.turnTimeLimit || 75);
      return;
    }

    if (gameState?.isPaused) {
      const remaining = typeof gameState.pausedRemainingTurnMs === 'number'
        ? Math.max(0, Math.ceil(gameState.pausedRemainingTurnMs / 1000))
        : Math.max(0, (gameState.turnTimeLimit || 75) - Math.floor(((gameState.pausedAt || Date.now()) - gameState.turnStartTime) / 1000));
      setSecondsLeft(remaining);
      return;
    }

    if (gameState?.phase === 'AUCTION') {
      return;
    }

    const updateCountdown = () => {
      const elapsed = Math.floor((Date.now() - gameState.turnStartTime) / 1000);
      const remaining = Math.max(0, (gameState.turnTimeLimit || 75) - elapsed);
      setSecondsLeft(prev => (prev !== remaining ? remaining : prev));

      if (
        remaining === 0 &&
        activePlayer?.id === myPlayerId &&
        gameState.status === 'playing' &&
        !gameState.isPaused &&
        gameState.phase !== 'AUCTION'
      ) {
        if (!hasEmittedTimeoutRef.current) {
          hasEmittedTimeoutRef.current = true;
          onTimeoutTurn?.();
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 500);
    return () => clearInterval(interval);
  }, [
    gameState?.turnStartTime,
    gameState?.turnTimeLimit,
    gameState?.status,
    gameState?.isPaused,
    gameState?.pausedAt,
    gameState?.pausedRemainingTurnMs,
    gameState?.phase,
    activePlayer?.id,
    myPlayerId,
    onTimeoutTurn
  ]);

  return (
    <div className="inline-flex items-center justify-center gap-2 px-3 py-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-[#cbd5e1] dark:border-slate-700 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-[#0f172a] dark:text-slate-100 animate-fadeIn select-none">
      <div
        className="w-2.5 h-2.5 rounded-full border border-white shadow-xs flex-shrink-0"
        style={{ backgroundColor: activePlayer?.color || '#cbd5e1' }}
      />
      <span className="text-xs font-bold truncate max-w-[110px] text-[#0f172a] dark:text-slate-100 font-jetbrains">
        {activePlayer?.name}
      </span>
      <span
        className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-jetbrains shadow-xs flex-shrink-0 ${
          isMyTurn
            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white animate-pulse'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
        }`}
      >
        {isMyTurn ? 'Senin Sıran' : 'Bekleniyor'}
      </span>

      {/* Geri Sayan Sayaç (Fotodaki '8' Zar Toplamı Yerine) */}
      {gameState?.status === 'playing' && (
        <div
          className={`flex items-center gap-1 pl-1.5 border-l border-[#cbd5e1] dark:border-slate-700 font-jetbrains font-bold text-xs leading-none ${
            secondsLeft <= 10 ? 'text-rose-500 animate-pulse font-extrabold' : 'text-amber-500 dark:text-amber-400'
          }`}
          title="Kalan Hamle Süresi"
        >
          <Clock className={`w-3 h-3 ${secondsLeft <= 10 ? 'text-rose-500' : 'text-amber-500'}`} />
          <span>{secondsLeft}s</span>
        </div>
      )}
    </div>
  );
}
