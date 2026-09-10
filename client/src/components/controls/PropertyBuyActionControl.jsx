import React from 'react';
import { ShoppingCart, XCircle } from 'lucide-react';

export function PropertyBuyActionControl({
  currentTile,
  activePlayer,
  players,
  onBuyProperty,
  onDeclineBuy
}) {

  return (
    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-[#cbd5e1] dark:border-slate-700 text-[#0f172a] dark:text-slate-100 shadow-sm flex flex-col gap-2">
      <div className="flex items-center gap-2 text-left">
        <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
          {currentTile?.image ? (
            <img
              src={currentTile.image}
              alt={currentTile.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <span className="text-base">{currentTile?.icon || '🏛️'}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-black text-[#0f172a] dark:text-slate-100 truncate font-space leading-tight">
            {currentTile?.name}
          </h3>
          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-jetbrains">
            Fiyat: <strong className="text-amber-800 dark:text-amber-400 font-black">{currentTile?.cost}₺</strong>
          </span>
        </div>
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={onBuyProperty}
          disabled={activePlayer?.money < currentTile?.cost}
          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
        >
          <ShoppingCart className="w-3 h-3" />
          <span>Satın Al ({currentTile?.cost}₺)</span>
        </button>
        <button
          onClick={onDeclineBuy}
          className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-600 transition flex items-center justify-center gap-0.5 active:scale-95 cursor-pointer"
        >
          <XCircle className="w-3 h-3" />
          <span>Pas (Açık Artırma)</span>
        </button>
      </div>
    </div>
  );
}
