import React, { useEffect, useRef } from 'react';
import { Board3DManager } from '../three/Board3DManager.js';

export function Board3DOverlay({
  gameState,
  displayedPositions = {},
  myPlayerId,
  currentTurnPlayerId,
  onRollDice,
  canRoll = false
}) {
  const containerRef = useRef(null);
  const managerRef = useRef(null);

  // Zar atışı anahtarı (hem lastDiceRollId hem de log desteğiyle 100% güvenli tespit)
  const latestDiceLog = gameState?.logs
    ? [...gameState.logs].reverse().find(l => l.type === 'dice')
    : null;
  const currentRollKey = gameState?.lastDiceRollId || (latestDiceLog ? `${latestDiceLog.id}_${gameState?.dice?.[0]}_${gameState?.dice?.[1]}` : null);
  const lastRollKeyRef = useRef(currentRollKey);

  useEffect(() => {
    if (!containerRef.current) return;

    const manager = new Board3DManager();
    managerRef.current = manager;

    manager.setupScene(containerRef.current, () => {
      if (onRollDice) {
        onRollDice();
      }
    });

    // Sahne kurulduğu anda mevcut oyuncu piyonlarını anında render et
    if (gameState?.players) {
      manager.syncPlayers(gameState.players, displayedPositions, myPlayerId, currentTurnPlayerId);
    }

    return () => {
      manager.dispose();
      managerRef.current = null;
    };
  }, []);

  // Zar atma yetkisini 3D yöneticisine aktar (hover ve tıklama için)
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setCanRoll(canRoll);
    }
  }, [canRoll]);

  // Oyuncu piyonlarının 3D dünyada senkronize edilmesi ve adım adım zıplaması
  const playersSyncKey = React.useMemo(() => {
    if (!gameState?.players) return '';
    return (
      gameState.players
        .map(p => `${p.id}:${displayedPositions[p.id] ?? p.position}:${p.color}:${p.token?.id || ''}:${p.isBankrupt}`)
        .join('|') + `|my:${myPlayerId}|turn:${currentTurnPlayerId}`
    );
  }, [gameState?.players, displayedPositions, myPlayerId, currentTurnPlayerId]);

  useEffect(() => {
    if (managerRef.current && gameState?.players) {
      managerRef.current.syncPlayers(gameState.players, displayedPositions, myPlayerId, currentTurnPlayerId);
    }
  }, [playersSyncKey]);

  // Yeni zar atıldığında 3D zarları masaya fırlatıp yuvarla
  useEffect(() => {
    if (!managerRef.current || !currentRollKey) return;

    if (currentRollKey !== lastRollKeyRef.current) {
      lastRollKeyRef.current = currentRollKey;
      const target = gameState.dice || [1, 1];
      managerRef.current.rollDice(target);
    }
  }, [currentRollKey, gameState?.dice]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-40 pointer-events-none overflow-hidden rounded-2xl sm:rounded-3xl will-change-transform"
      style={{ transform: 'translateZ(0)', contain: 'strict' }}
      aria-hidden="true"
    />
  );
}
