import React, { useState } from 'react';
import { Dices, Sparkles } from 'lucide-react';
import { sounds } from '../sound/soundEffects.js';

// Zar yüzü noktaları
function renderDiceFace(val) {
  const dots = {
    1: ['center'],
    2: ['top-left', 'bottom-right'],
    3: ['top-left', 'center', 'bottom-right'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-right']
  };

  const activeDots = dots[val] || dots[1];

  const dotPositions = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
    'mid-left': 'top-1/2 -translate-y-1/2 left-2',
    'mid-right': 'top-1/2 -translate-y-1/2 right-2',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2'
  };

  return (
    <div className="relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-white via-slate-100 to-slate-200 border-2 border-slate-300 rounded-xl sm:rounded-2xl shadow-xl p-1 sm:p-1.5 flex-shrink-0">
      {activeDots.map((pos, idx) => (
        <span
          key={idx}
          className={`absolute w-1.5 h-1.5 sm:w-2 sm:h-2 md:w-2.5 md:h-2.5 bg-slate-900 rounded-full shadow-inner ${dotPositions[pos]}`}
        />
      ))}
    </div>
  );
}

export function DiceRoller({ dice, canRoll, onRoll, isDoubles, rolling }) {
  const [localRolling, setLocalRolling] = useState(false);

  const handleRollClick = () => {
    if (!canRoll || localRolling) return;
    setLocalRolling(true);
    onRoll();

    setTimeout(() => {
      setLocalRolling(false);
    }, 1300);
  };

  const isSpinning = rolling || localRolling;

  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2">

      {/* Toplam & Çift Bildirimi */}
      <div className="text-center h-5">
        {dice[0] && dice[1] && !isSpinning && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-bold text-slate-700 font-jetbrains">
            <span>Toplam: <strong className="text-[#0F172A] text-xs sm:text-sm">{dice[0] + dice[1]}</strong></span>
            {dice[0] === dice[1] && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-800 border border-amber-500/50 text-[9px] uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5 text-amber-600" /> Çift Zar!
              </span>
            )}
          </div>
        )}
      </div>

      {/* Zar Butonu */}
      {canRoll && (
        <button
          onClick={handleRollClick}
          disabled={!canRoll || isSpinning}
          className="w-full max-w-xs py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 border border-amber-300 ring-4 ring-amber-400/80 animate-dice-glow hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
        >
          <Dices className={`w-4 h-4 sm:w-5 sm:h-5 ${isSpinning ? 'animate-spin' : ''}`} />
          <span>{isSpinning ? 'Zar Atılıyor...' : 'ZARLARI AT!'}</span>
        </button>
      )}
    </div>
  );
}
