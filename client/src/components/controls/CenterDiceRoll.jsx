import React, { useState, useEffect, useRef } from 'react';
import { Dices, Sparkles } from 'lucide-react';
import { sounds } from '../../sound/soundEffects.js';

/**
 * Otantik Monopoly Zar Yüzü (Ivory / Fildişi Tasarım, Derin Noktalar)
 */
function DieFace({ value = 1, size = 'md', isShaking = false }) {
  const dimClass = size === 'sm' ? 'w-8 h-8 rounded-lg' : size === 'lg' ? 'w-13 h-13 rounded-2xl' : 'w-10 h-10 sm:w-11 sm:h-11 rounded-xl';
  const pipDim = size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2';

  const pipPositions = {
    1: ['col-start-2 row-start-2'],
    2: ['col-start-1 row-start-1', 'col-start-3 row-start-3'],
    3: ['col-start-1 row-start-1', 'col-start-2 row-start-2', 'col-start-3 row-start-3'],
    4: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
    5: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-2 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
    6: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-2', 'col-start-3 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3']
  };

  const currentPips = pipPositions[Math.max(1, Math.min(6, value))] || pipPositions[1];

  return (
    <div
      className={`relative ${dimClass} bg-gradient-to-br from-[#ffffff] via-[#f8fafc] to-[#e2e8f0] border border-slate-300 dark:border-slate-600 shadow-[0_4px_12px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)] p-1 grid grid-cols-3 grid-rows-3 items-center justify-items-center flex-shrink-0 select-none ${
        isShaking ? 'animate-dice-shake' : ''
      }`}
    >
      {currentPips.map((posClass, idx) => (
        <span
          key={idx}
          className={`${pipDim} rounded-full bg-slate-900 dark:bg-slate-950 shadow-inner ${posClass}`}
        />
      ))}
    </div>
  );
}

export function CenterDiceRoll({
  isMyTurn = false,
  phase = 'WAITING_ROLL',
  canRollAgain = false,
  isPawnBusy = false,
  isRolling = false,
  dice = null,
  activePlayer = null,
  onRollDice,
  onRollAgain
}) {
  const [isLocalShaking, setIsLocalShaking] = useState(false);
  const [tumbleValues, setTumbleValues] = useState([1, 1]);
  const shakeTimerRef = useRef(null);

  // Zarlar yuvarlanırken rastgele zar yüzleri çevir (Havada dönme illüzyonu)
  useEffect(() => {
    let interval = null;
    if (isRolling || isLocalShaking) {
      interval = setInterval(() => {
        setTumbleValues([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1
        ]);
      }, 70);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRolling, isLocalShaking]);

  // Zar yere çarptığında ses efekti
  useEffect(() => {
    if (isRolling) {
      const impactTimer = setTimeout(() => {
        sounds?.playDiceImpact?.(0.9, 1.0);
      }, 400);
      return () => clearTimeout(impactTimer);
    }
  }, [isRolling]);

  const handleTriggerRoll = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (isPawnBusy || isLocalShaking || isRolling) return;

    // Dokunsal Çalkalama (Shake) başlat
    setIsLocalShaking(true);
    sounds?.playDiceRoll?.();

    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => {
      setIsLocalShaking(false);
      if (phase === 'TURN_ACTIONS' && canRollAgain) {
        onRollAgain?.();
      } else {
        onRollDice?.();
      }
    }, 420);
  };

  const displayDice = dice && Array.isArray(dice) && dice.length >= 2 ? dice : null;
  const isDouble = Boolean(displayDice && displayDice[0] === displayDice[1] && phase !== 'WAITING_ROLL');
  const diceTotal = displayDice ? (displayDice[0] + displayDice[1]) : null;

  // 1. Durum: Zar atılıyor (Tumbling animasyonu tahtanın tam ortasında)
  if (isRolling || isLocalShaking) {
    return (
      <div className="relative flex flex-col items-center justify-center p-2 select-none animate-fadeIn pointer-events-none">
        {/* Havada yuvarlanan zarlar */}
        <div className="relative flex items-center justify-center gap-6 h-14 sm:h-16">
          <div className="animate-dice-tumble-1">
            <DieFace value={tumbleValues[0]} size="lg" />
          </div>
          <div className="animate-dice-tumble-2">
            <DieFace value={tumbleValues[1]} size="lg" />
          </div>
        </div>

        {/* Zar gölgeleri */}
        <div className="flex items-center justify-center gap-10 mt-1 opacity-70">
          <div className="w-8 h-2 bg-black/40 rounded-full blur-[2px] animate-dice-shadow-1" />
          <div className="w-8 h-2 bg-black/40 rounded-full blur-[2px] animate-dice-shadow-2" />
        </div>

        <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-500 font-jetbrains mt-1 animate-pulse">
          {isLocalShaking ? '🎲 Zarlar Çalkalanıyor...' : '🎲 Zarlar Atılıyor...'}
        </span>
      </div>
    );
  }

  // 2. Durum: Sıra bende ve zar atılması bekleniyor (WAITING_ROLL veya canRollAgain)
  const showRollButton = isMyTurn && !isPawnBusy && (
    phase === 'WAITING_ROLL' || (phase === 'TURN_ACTIONS' && canRollAgain)
  );

  if (showRollButton) {
    const isJailRoll = activePlayer?.inJail && phase === 'WAITING_ROLL';
    const isAgain = phase === 'TURN_ACTIONS' && canRollAgain;

    return (
      <div className="w-full flex flex-col items-center gap-1.5 animate-fadeIn">
        <button
          type="button"
          onClick={handleTriggerRoll}
          className="group relative w-full py-2.5 sm:py-3 px-4 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:brightness-110 active:scale-95 text-slate-950 font-space font-extrabold text-xs sm:text-sm rounded-2xl shadow-[0_4px_16px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-2.5 cursor-pointer animate-dice-glow border-2 border-amber-300"
        >
          {/* Çalkalama İkonu & Zar Çifti */}
          <div className="flex items-center gap-1 group-hover:scale-110 transition-transform">
            <DieFace value={1} size="sm" isShaking={false} />
            <DieFace value={6} size="sm" isShaking={false} />
          </div>

          <div className="flex flex-col items-start text-left leading-tight">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider">
              {isJailRoll
                ? '🎲 ÇİFT ZAR DENE (KODES)'
                : isAgain
                ? '🎲 TEKRAR ZAR AT!'
                : '🎲 ZARLARI SALLA VE AT'}
            </span>
            <span className="text-[9px] text-amber-950/80 font-medium">
              {isJailRoll ? 'Çift gelirse ücretsiz çıkarsın' : 'Tahtanın ortasına yuvarla'}
            </span>
          </div>
        </button>
      </div>
    );
  }

  // 3. Durum: Zar atıldı ve tahtada durdu (Zar sonuç rozeti piyon yürürken veya aksiyonlar sırasında merkezde kalır)
  if (displayDice && phase !== 'WAITING_ROLL') {
    return (
      <div className="flex items-center justify-center gap-2 p-1.5 bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-lg animate-fadeIn select-none">
        <div className="flex items-center gap-1.5">
          <DieFace value={displayDice[0]} size="sm" />
          <DieFace value={displayDice[1]} size="sm" />
        </div>

        <div className="flex flex-col items-start leading-none pl-1">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-black text-amber-400 font-jetbrains">
              Toplam {diceTotal}
            </span>
            {isDouble && (
              <span className="text-[9px] bg-emerald-500 text-white font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> ÇİFT
              </span>
            )}
          </div>
          <span className="text-[8.5px] text-slate-400 font-medium mt-0.5">
            ({displayDice[0]} + {displayDice[1]})
          </span>
        </div>
      </div>
    );
  }

  return null;
}
