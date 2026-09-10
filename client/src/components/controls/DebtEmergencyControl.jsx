import React from 'react';
import { AlertCircle, Zap, Flame } from 'lucide-react';

export function DebtEmergencyControl({
  activePlayer,
  onAutoMortgage,
  onDeclareBankruptcy
}) {
  return (
    <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 shadow-md">
      <div className="flex items-center gap-1.5 text-rose-300 font-black text-xs">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Borçtasınız: {activePlayer?.money}₺!</span>
      </div>
      <p className="text-[10px] text-rose-300/90 leading-tight">
        Resmi kurallara göre borcu kapatmak için binalarınızı satmalı veya tapularınızı ipotek etmelisiniz. Karşılayamazsanız iflas etmeniz gerekir.
      </p>
      <div className="flex flex-col gap-1.5 mt-0.5">
        {onAutoMortgage && (
          <button
            onClick={onAutoMortgage}
            className="w-full py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-lg transition flex items-center justify-center gap-1 shadow-sm cursor-pointer active:scale-95"
            title="Borcu kapatmak için mülkleri otomatik ipotek et ve binaları sat"
          >
            <Zap className="w-3.5 h-3.5 fill-slate-950" />
            <span>⚡ Tapuları Otomatik İpotek Et</span>
          </button>
        )}
        {onDeclareBankruptcy && (
          <button
            onClick={() => {
              if (window.confirm('İflas etmek ve oyundan elenmek istediğinizden emin misiniz?')) {
                onDeclareBankruptcy();
              }
            }}
            className="w-full py-1.5 bg-rose-700 hover:bg-rose-600 text-white font-black text-xs rounded-lg transition flex items-center justify-center gap-1 shadow-sm cursor-pointer active:scale-95"
            title="Borcu ödeyemiyorsanız iflas edin ve oyundan elenin"
          >
            <Flame className="w-3.5 h-3.5 text-rose-200" />
            <span>💥 İflas Bayrağını Çek (İflas Et)</span>
          </button>
        )}
      </div>
    </div>
  );
}


