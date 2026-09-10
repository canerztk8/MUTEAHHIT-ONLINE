import React from 'react';
import { ArrowRight, Dices } from 'lucide-react';

export function TurnEndControl({
  canRollAgain,
  isDebt,
  isPawnBusy,
  onRollAgain,
  onEndTurn
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // canRollAgain veya piyon durumu değiştiğinde submitting kilidini sıfırla
  React.useEffect(() => {
    setIsSubmitting(false);
  }, [canRollAgain, isPawnBusy]);

  const handleRollAgainClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isPawnBusy || isSubmitting) return;
    setIsSubmitting(true);
    onRollAgain?.();
    setTimeout(() => setIsSubmitting(false), 2000);
  };

  const handleEndTurnClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isDebt || isPawnBusy || isSubmitting) return;
    setIsSubmitting(true);
    onEndTurn?.();
    setTimeout(() => setIsSubmitting(false), 2000);
  };

  if (canRollAgain) {
    return (
      <button
        type="button"
        onClick={handleRollAgainClick}
        disabled={isPawnBusy || isSubmitting}
        className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 hover:brightness-110 active:scale-95 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed animate-dice-glow border border-emerald-300 font-space"
      >
        <Dices className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : 'animate-bounce-short'}`} />
        <span>{isSubmitting ? 'Zar Atılıyor...' : 'Çift Attın! Tekrar Zar At'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleEndTurnClick}
      disabled={isDebt || isPawnBusy || isSubmitting}
      className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer font-space ${
        isDebt || isPawnBusy || isSubmitting
          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
          : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
      }`}
    >
      <span>{isDebt ? 'Önce Borcu Kapatın' : (isSubmitting ? 'Tur Bitiriliyor...' : 'Turu Bitir')}</span>
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
}
