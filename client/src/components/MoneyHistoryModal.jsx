import React from 'react';
import { X, TrendingUp, TrendingDown, Receipt } from 'lucide-react';

export function MoneyHistoryModal({ player, history = [], onClose, isDarkMode }) {
  if (!player) return null;

  // Güvenilir tema tespiti: İster prop olarak verilsin, ister DOM <html> dark sınıfından okunsun
  const isDark = typeof isDarkMode === 'boolean'
    ? isDarkMode
    : (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const currentBalance = player.money ?? 0;
  const reversedHistory = Array.isArray(history) ? [...history].reverse() : [];

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200 ${
        isDark ? 'bg-slate-950/75' : 'bg-slate-900/40'
      }`}
      onClick={onClose}
    >
      <div
        className={`relative z-10 w-full max-w-sm max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-colors border ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200/90 text-slate-900 ring-1 ring-slate-900/5'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-3.5 border-b transition-colors ${
            isDark
              ? 'border-slate-800 bg-slate-900/95 text-slate-100'
              : 'border-slate-200 bg-slate-50/95 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 border border-white/60 shadow-xs"
              style={{ backgroundColor: player.color || '#f59e0b' }}
            >
              <span>{player.token?.icon || '●'}</span>
            </div>
            <div className="min-w-0">
              <div
                className={`font-black text-sm truncate font-space ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                {player.name}{' '}
                <span
                  className={`font-normal ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  | Bakiye Geçmişi
                </span>
              </div>
              <div
                className={`text-xs font-jetbrains font-bold ${
                  isDark ? 'text-emerald-400' : 'text-emerald-700'
                }`}
              >
                {currentBalance.toLocaleString('tr-TR')} ₺ güncel bakiye
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition cursor-pointer flex-shrink-0 ${
              isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-200/80 text-slate-500 hover:text-slate-900'
            }`}
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div
          className={`overflow-y-auto flex-1 p-3 space-y-2 custom-scrollbar transition-colors ${
            isDark ? 'bg-slate-900' : 'bg-slate-50/40'
          }`}
        >
          {reversedHistory.length === 0 ? (
            <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  isDark
                    ? 'bg-slate-800/80 text-slate-400 border-slate-700/60'
                    : 'bg-white text-slate-400 border-slate-200 shadow-xs'
                }`}
              >
                <Receipt className="w-5 h-5" />
              </div>
              <p
                className={`text-xs font-medium ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Henüz kayıtlı para hareketi bulunmuyor.
              </p>
            </div>
          ) : (
            reversedHistory.map((entry, i) => {
              const isGain = entry.delta > 0;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                    isDark
                      ? 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/50 text-slate-200'
                      : 'bg-white hover:bg-slate-100/70 border-slate-200/90 text-slate-800 shadow-xs'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 pr-2">
                    <div
                      className={`p-1 rounded-lg flex-shrink-0 mt-0.5 ${
                        isGain
                          ? isDark
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-emerald-100 text-emerald-700'
                          : isDark
                          ? 'bg-rose-500/15 text-rose-400'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {isGain ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span
                      className={`font-semibold leading-snug break-words ${
                        isDark ? 'text-slate-200' : 'text-slate-800'
                      }`}
                    >
                      {entry.reason}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className={`font-jetbrains font-bold text-xs ${
                        isGain
                          ? isDark
                            ? 'text-emerald-400'
                            : 'text-emerald-700 font-extrabold'
                          : isDark
                          ? 'text-rose-400'
                          : 'text-rose-600 font-extrabold'
                      }`}
                    >
                      {isGain ? '+' : ''}
                      {entry.delta?.toLocaleString('tr-TR')} ₺
                    </span>
                    <span
                      className={`block text-[10px] font-jetbrains mt-0.5 ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      {entry.time}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-4 py-2.5 border-t text-center text-[10px] font-jetbrains transition-colors ${
            isDark
              ? 'border-slate-800 bg-slate-900/95 text-slate-400'
              : 'border-slate-200 bg-slate-50/95 text-slate-600'
          }`}
        >
          Son {reversedHistory.length} işlem kaydı
        </div>
      </div>
    </div>
  );
}
