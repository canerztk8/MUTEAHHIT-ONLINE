import React from 'react';
import { ShoppingCart, XCircle, Building2 } from 'lucide-react';

export function PropertyBuyActionControl({
  currentTile,
  activePlayer,
  players,
  onBuyProperty,
  onDeclineBuy
}) {

  return (
    <div className="p-1.5 sm:p-2 rounded-xl bg-white dark:bg-slate-900 border border-[#cbd5e1] dark:border-slate-700 text-[#0f172a] dark:text-slate-100 shadow-sm flex flex-col gap-1.5 sm:gap-2 max-w-full">
      <div className="flex items-center gap-2 text-left">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
          {currentTile?.image ? (
            <img
              src={currentTile.image}
              alt={currentTile.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <Building2 className="w-4 h-4 text-slate-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[11px] sm:text-xs font-bold text-[#0f172a] dark:text-slate-100 truncate leading-tight">
            {currentTile?.name}
          </h3>
          <span className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 font-jetbrains">
            Fiyat: <strong className="text-amber-800 dark:text-amber-400 font-black">{currentTile?.cost}₺</strong>
          </span>
        </div>
      </div>

      <div className="flex gap-1 sm:gap-1.5 w-full">
        <button
          onClick={onBuyProperty}
          disabled={activePlayer?.money < currentTile?.cost}
          className="flex-1 min-w-0 py-1.5 px-1.5 sm:px-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-[11px] sm:text-xs font-bold shadow-xs transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
          title={`Satın Al (${currentTile?.cost}₺)`}
        >
          <ShoppingCart className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="hidden sm:inline truncate">Satın Al ({currentTile?.cost}₺)</span>
          <span className="sm:hidden truncate">{currentTile?.cost}₺ Al</span>
        </button>
        <button
          onClick={onDeclineBuy}
          className="flex-1 min-w-0 py-1.5 px-1.5 sm:px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] sm:text-xs font-semibold border border-slate-300 dark:border-slate-600 transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
          title="Pas Geç (Açık Artırmaya Çıkar)"
        >
          <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="hidden sm:inline truncate">Pas (Açık Artırma)</span>
          <span className="sm:hidden truncate">Pas / İhale</span>
        </button>
      </div>
    </div>
  );
}
