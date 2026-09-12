import React, { useEffect } from 'react';
import { Zap, Dices } from 'lucide-react';
import { NonDrawerCardAlert } from './controls/NonDrawerCardAlert.jsx';
import { TurnStatusCapsule } from './controls/TurnStatusCapsule.jsx';
import { DebtEmergencyControl } from './controls/DebtEmergencyControl.jsx';
import { JailActionControl } from './controls/JailActionControl.jsx';
import { PropertyBuyActionControl } from './controls/PropertyBuyActionControl.jsx';
import { TurnEndControl } from './controls/TurnEndControl.jsx';

export function ActionControls({
  gameState,
  myPlayerId,
  onRollDice,
  onBuyProperty,
  onDeclineBuy,
  onEndTurn,
  onRollAgain,
  onPayJailFine,
  onUseJailCard,
  onDeclareBankruptcy,
  onAutoMortgage,
  onFastForwardBot,
  onAcknowledgeCard,
  onTimeoutTurn,
  isRolling = false,
  isMovingPawn = false,
  drawnCardForNonDrawer = null,
  onDismissDrawnCard = null
}) {
  const { players, currentTurnIndex, phase, currentTile, canRollAgain, dice, drawnCard } = gameState || {};
  const activePlayer = players?.[currentTurnIndex];
  const isMyTurn = activePlayer?.id === myPlayerId;
  const isDebt = (activePlayer?.money || 0) < 0;
  const jailFine = gameState?.jailFine ?? 50;
  const isPawnBusy = isMovingPawn || isRolling;

  // ⌨️ Space tuşu kısayolları: Zar at / Turu bitir / Tekrar at / Kartı onayla
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code !== 'Space') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (gameState?.status !== 'playing') return;
      if (!isMyTurn || isPawnBusy) return;
      e.preventDefault();
      if (phase === 'WAITING_ROLL' && !activePlayer?.inJail) {
        onRollDice?.();
      } else if (phase === 'CARD_DRAWN') {
        onAcknowledgeCard?.();
      } else if (phase === 'TURN_ACTIONS' && canRollAgain) {
        onRollAgain?.();
      } else if (phase === 'TURN_ACTIONS' && !canRollAgain) {
        onEndTurn?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState?.status, isMyTurn, isPawnBusy, phase, canRollAgain, activePlayer, onRollDice, onEndTurn, onRollAgain, onAcknowledgeCard]);

  if (gameState?.status !== 'playing') return null;



  // Etkileşimli bir aksiyon gerekiyor mu? (Piyon yürürken veya zar atılırken aksiyon kutuları açılmaz)
  const hasInteractiveAction = isMyTurn && !isPawnBusy && (
    (phase === 'WAITING_ROLL' && !activePlayer?.inJail) ||
    (canRollAgain && phase === 'TURN_ACTIONS') ||
    isDebt ||
    (phase === 'CARD_DRAWN' && !drawnCard) ||
    (activePlayer?.inJail && phase === 'WAITING_ROLL') ||
    (phase === 'TILE_ACTION' && currentTile) ||
    (phase === 'TURN_ACTIONS')
  );

  return (
    <div className="w-full flex flex-col items-center justify-center p-0.5 sm:p-1 text-center max-w-sm mx-auto select-none gap-2">
      {/* Diğer Oyuncunun Çektiği İhale & Fırsat / Belediye & İmar Kartı Bildirimi (Opsiyonel) */}
      <NonDrawerCardAlert
        card={drawnCardForNonDrawer}
        onDismiss={onDismissDrawnCard}
      />

      {/* MİNİMALİST SIRA & SAYAÇ KAPSÜLÜ */}
      <div className="flex-shrink-0 flex items-center justify-center">
        <TurnStatusCapsule
          activePlayer={activePlayer}
          isMyTurn={isMyTurn}
          gameState={gameState}
          myPlayerId={myPlayerId}
          onTimeoutTurn={onTimeoutTurn}
          dice={dice}
          isRolling={isRolling}
        />
      </div>

      {/* BUTON VE AKSİYON YUVASI (Sabit Rezerve Yükseklik Sayesinde Buton Gidip Gelirken Kapsül Asla Zıplamaz) */}
      <div className="w-full max-w-[290px] min-h-[50px] flex flex-col items-center justify-start">
        {/* BOT SIRASINDA HIZLI ATLA BUTONU */}
        {!isMyTurn && activePlayer?.isBot && onFastForwardBot && !isPawnBusy && (
          <button
            onClick={onFastForwardBot}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-space font-black text-xs shadow-md border border-amber-300 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 animate-pulse"
            title="Botun turunu anında bitir ve sıradakine geç"
          >
            <Zap className="w-3.5 h-3.5 fill-slate-950" />
            <span>{activePlayer?.name} Turunu Atla</span>
          </button>
        )}

        {/* SADECE ETKİLEŞİM GEREKTİREN AKSİYONLARDA GÖRÜNEN KOMPAKT KART */}
        {hasInteractiveAction && (
          <div className="w-full max-w-[290px] flex flex-col gap-2 animate-fadeIn">
          {/* ÇEKİLEN KART BEKLEME EYLEMİ (Yalnızca 3D modal kapalıysa yedek olarak görünür) */}
          {phase === 'CARD_DRAWN' && !drawnCard && (
            <button
              onClick={onAcknowledgeCard}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer font-space"
            >
              <span>📜 Kartı Okudum</span>
              <kbd className="px-1.5 py-0.5 text-[9px] bg-black/15 text-slate-900 rounded font-mono font-bold">Space</kbd>
            </button>
          )}

          {/* BORÇ VE İPOTEK UYARISI */}
          {isDebt && (
            <DebtEmergencyControl
              activePlayer={activePlayer}
              onAutoMortgage={onAutoMortgage}
              onDeclareBankruptcy={onDeclareBankruptcy}
            />
          )}

          {/* Kodes (Hapishane) Eylemleri */}
          {activePlayer?.inJail && phase === 'WAITING_ROLL' && (
            <JailActionControl
              activePlayer={activePlayer}
              jailFine={jailFine}
              onPayJailFine={onPayJailFine}
              onUseJailCard={onUseJailCard}
            />
          )}

          {/* Mülk Satın Alma Aşaması */}
          {phase === 'TILE_ACTION' && currentTile && !isPawnBusy && (
            <PropertyBuyActionControl
              currentTile={currentTile}
              activePlayer={activePlayer}
              players={players}
              onBuyProperty={onBuyProperty}
              onDeclineBuy={onDeclineBuy}
            />
          )}

          {/* Sıra Başında Zar Atma Butonu (Cardboard Ortası) */}
          {phase === 'WAITING_ROLL' && !activePlayer?.inJail && !isPawnBusy && (
            <button
              type="button"
              onClick={(e) => {
                e?.preventDefault?.();
                e?.stopPropagation?.();
                onRollDice?.();
              }}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:brightness-110 active:scale-95 text-slate-950 font-space font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer animate-dice-glow border border-amber-300"
            >
              <Dices className="w-4 h-4 text-slate-950 animate-bounce-short" />
              <span>ZAR AT</span>
            </button>
          )}

          {/* Tur Eylemleri & Turu Bitirme Butonu */}
          {phase === 'TURN_ACTIONS' && !isPawnBusy && (
            <TurnEndControl
              canRollAgain={canRollAgain}
              isDebt={isDebt}
              isPawnBusy={isPawnBusy}
              onRollAgain={() => onRollAgain?.()}
              onEndTurn={() => onEndTurn?.()}
            />
          )}
        </div>
      )}
      </div>
    </div>
  );
}
