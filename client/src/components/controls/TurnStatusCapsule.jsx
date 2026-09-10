import React from 'react';
import { Sparkles } from 'lucide-react';

export function TurnStatusCapsule({ activePlayer, isMyTurn, dice, isRolling }) {
  const showDiceSum = dice && dice[0] && dice[1] && !isRolling;
  const isDoubles = dice && dice[0] === dice[1];

  return (
    <div className="inline-flex items-center justify-center gap-2 px-3 py-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-[#cbd5e1] dark:border-slate-700 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.06)] text-[#0f172a] dark:text-slate-100 animate-fadeIn">
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

      {/* Zar Toplamı & Çift Rozeti (Zar Masada Durduğunda) */}
      {showDiceSum && (
        <div className="flex items-center gap-1.5 pl-1.5 border-l border-[#cbd5e1] dark:border-slate-700">
          <span className="text-xs font-black font-jetbrains text-[#0f172a] dark:text-slate-100">
            {dice[0] + dice[1]}
          </span>
          {isDoubles && (
            <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-jetbrains shadow-xs flex items-center gap-0.5 animate-bounce">
              <Sparkles className="w-2.5 h-2.5" /> Çift!
            </span>
          )}
        </div>
      )}
    </div>
  );
}
