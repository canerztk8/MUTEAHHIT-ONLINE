import React from 'react';
import { X, TrendingUp, TrendingDown, Receipt } from 'lucide-react';

export function MoneyHistoryModal({ player, history = [], onClose }) {
  if (!player) return null;

  const currentBalance = player.money ?? 0;
  const reversedHistory = Array.isArray(history) ? [...history].reverse() : [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 dark:bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative z-10 w-full max-w-sm max-h-[80vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 transition-colors"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 border border-white/60 shadow-xs"
              style={{ backgroundColor: player.color || '#f59e0b' }}
            >
              <span>{player.token?.icon || '●'}</span>
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                {player.name} <span className="text-slate-400 dark:text-slate-500 font-normal">| Bakiye Geçmişi</span>
              </div>
              <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {currentBalance.toLocaleString('tr-TR')} ₺ güncel bakiye
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer flex-shrink-0"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-3 space-y-2 bg-white dark:bg-slate-900 custom-scrollbar">
          {reversedHistory.length === 0 ? (
            <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400">
                <Receipt className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Henüz kayıtlı para hareketi bulunmuyor.
              </p>
            </div>
          ) : (
            reversedHistory.map((entry, i) => {
              const isGain = entry.delta > 0;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/50 text-xs transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0 pr-2">
                    <div className={`p-1 rounded-lg flex-shrink-0 mt-0.5 ${
                      isGain ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    }`}>
                      {isGain ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span className="text-slate-800 dark:text-slate-200 font-medium leading-snug break-words">
                      {entry.reason}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className={`font-mono font-bold text-xs ${
                        isGain
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isGain ? '+' : ''}{entry.delta?.toLocaleString('tr-TR')} ₺
                    </span>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {entry.time}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 text-center text-[10px] text-slate-500 dark:text-slate-400 font-mono">
          Son {reversedHistory.length} işlem kaydı
        </div>
      </div>
    </div>
  );
}
