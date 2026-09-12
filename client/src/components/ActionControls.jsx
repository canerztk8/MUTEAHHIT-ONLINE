import React, { useEffect } from 'react';
import { Zap, Dices } from 'lucide-react';
import { NonDrawerCardAlert } from './controls/NonDrawerCardAlert.jsx';
import { TurnStatusCapsule } from './controls/TurnStatusCapsule.jsx';
import { DebtEmergencyControl } from './controls/DebtEmergencyControl.jsx';
import { JailActionControl } from './controls/JailActionControl.jsx';
import { PropertyBuyActionControl } from './controls/PropertyBuyActionControl.jsx';
import { TurnEndControl } from './controls/TurnEndControl.jsx';
import { CenterDiceRoll } from './controls/CenterDiceRoll.jsx';

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
      if (phase === 'WAITING_ROLL') {
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
    (phase === 'WAITING_ROLL') ||
    (canRollAgain && phase === 'TURN_ACTIONS') ||
    isDebt ||
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

      {/* MERKEZ ZAR ALANI: Dokunsal Çalkalama, Yuvarlama Animasyonu ve Zar Rozeti */}
      <CenterDiceRoll
        isMyTurn={isMyTurn}
        phase={phase}
        canRollAgain={canRollAgain}
        isPawnBusy={isPawnBusy}
        isRolling={isRolling}
        dice={dice}
        activePlayer={activePlayer}
        onRollDice={onRollDice}
        onRollAgain={onRollAgain}
      />

      {/* BUTON VE AKSİYON YUVASI (Sabit Rezerve Yükseklik Sayesinde Buton Gidip Gelirken Kapsül Asla Zıplamaz) */}
      <div className="w-full max-w-[290px] min-h-[50px] flex flex-col items-center justify-start">
        {/* SADECE ETKİLEŞİM GEREKTİREN AKSİYONLARDA GÖRÜNEN KOMPAKT KART */}
        {hasInteractiveAction && (
          <div className="w-full max-w-[290px] flex flex-col gap-2 animate-fadeIn">

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
