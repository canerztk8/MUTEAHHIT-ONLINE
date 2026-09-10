import React from 'react';
import { ShieldCheck, Key } from 'lucide-react';

export function JailActionControl({
  activePlayer,
  jailFine = 50,
  onPayJailFine,
  onUseJailCard
}) {
  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-rose-950/40 border border-rose-800/60 text-left">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] text-rose-300 font-bold">
          🚨 Maliye Denetimi (Kodes)
        </span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-black bg-emerald-900 text-emerald-200" title="Resmi kurallara göre denetimdeyken mülklerinizden tam kira toplamaya devam edersiniz">
          Kira: %100 (Tam)
        </span>
      </div>
      <div className="flex gap-1.5 mt-0.5">
        <button
          onClick={onPayJailFine}
          disabled={activePlayer?.money < jailFine}
          className="flex-1 py-1 px-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-lg text-[10.5px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
        >
          <ShieldCheck className="w-3 h-3" />
          <span>{jailFine}₺ Harç Öde</span>
        </button>
        {activePlayer?.jailCards > 0 && (
          <button
            onClick={onUseJailCard}
            className="flex-1 py-1 px-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10.5px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <Key className="w-3 h-3" />
            <span>Muafiyet Belgesi ({activePlayer.jailCards})</span>
          </button>
        )}
      </div>
    </div>
  );
}

