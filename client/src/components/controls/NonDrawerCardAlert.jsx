import React from 'react';
import { XCircle } from 'lucide-react';

export function NonDrawerCardAlert({ card, onDismiss }) {
  if (!card) return null;

  const isChance = card.deckType === 'chance' || card.id?.startsWith('ch');

  return (
    <div className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-[#cbd5e1] dark:border-slate-700 text-[#0f172a] dark:text-slate-100 shadow-sm flex items-start justify-between gap-2 animate-fadeIn text-left">
      <div className="flex items-start gap-2 min-w-0">
        <span className="text-lg flex-shrink-0">
          {isChance ? '📜' : '🏛️'}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 font-space">
              {isChance ? 'İhale & Fırsat' : 'Belediye & İmar'}
            </span>
            {card.drawerName && (
              <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-semibold font-jetbrains">
                ({card.drawerName})
              </span>
            )}
          </div>
          <h5 className="text-xs font-black text-[#0f172a] dark:text-slate-100 leading-tight font-space">{card.title}</h5>
          <p className="text-[10.5px] text-slate-600 dark:text-slate-300 font-medium leading-snug font-jetbrains">
            {card.desc}
          </p>
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition flex-shrink-0 cursor-pointer"
          title="Kapat"
        >
          <XCircle className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
