import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BOARD_TILES } from '../game/boardData.js';
import { sounds } from '../sound/soundEffects.js';
import { Building2, Building, Train, Zap, AlertTriangle, Coins, Clock, Home, Landmark, Gavel, Sparkles } from 'lucide-react';
import { Board3DOverlay } from './Board3DOverlay.jsx';

// 11x11 Grid konumlandırması
function getGridPosition(id) {
  if (id === 0) return { gridRow: 11, gridColumn: 11 };
  if (id >= 1 && id <= 9) return { gridRow: 11, gridColumn: 11 - id };
  if (id === 10) return { gridRow: 11, gridColumn: 1 };
  if (id >= 11 && id <= 19) return { gridRow: 11 - (id - 10), gridColumn: 1 };
  if (id === 20) return { gridRow: 1, gridColumn: 1 };
  if (id >= 21 && id <= 29) return { gridRow: 1, gridColumn: id - 19 };
  if (id === 30) return { gridRow: 1, gridColumn: 11 };
  if (id >= 31 && id <= 39) return { gridRow: id - 29, gridColumn: 11 };
  return { gridRow: 1, gridColumn: 1 };
}

// 40 Karenin grid koordinatlarını bellekte sabit tutarak referans eşitliğini koru (TileCell React.memo bypassını önler)
const GRID_POSITIONS = Array.from({ length: 40 }, (_, id) => getGridPosition(id));
const EMPTY_PLAYERS = Object.freeze([]);

// ─── İzole Tur Süresi Sayacı (250ms interval tahtayı baştan render etmez) ──────
const TurnTimerCell = React.memo(function TurnTimerCell({
  gameState,
  activePlayer,
  myPlayerId,
  onFastForwardBot,
  onTimeoutTurn,
  isDarkMode
}) {
  const [secondsLeft, setSecondsLeft] = useState(gameState?.turnTimeLimit || 75);
  const hasEmittedTimeoutRef = useRef(false);

  useEffect(() => {
    hasEmittedTimeoutRef.current = false;

    if (!gameState?.turnStartTime || gameState?.status !== 'playing') {
      setSecondsLeft(gameState?.turnTimeLimit || 75);
      return;
    }

    if (gameState?.isPaused) {
      const remaining = typeof gameState.pausedRemainingTurnMs === 'number'
        ? Math.max(0, Math.ceil(gameState.pausedRemainingTurnMs / 1000))
        : Math.max(0, (gameState.turnTimeLimit || 75) - Math.floor(((gameState.pausedAt || Date.now()) - gameState.turnStartTime) / 1000));
      setSecondsLeft(remaining);
      return;
    }

    if (gameState?.phase === 'AUCTION') {
      return;
    }

    const updateCountdown = () => {
      const elapsed = Math.floor((Date.now() - gameState.turnStartTime) / 1000);
      const remaining = Math.max(0, (gameState.turnTimeLimit || 75) - elapsed);
      setSecondsLeft(prev => (prev !== remaining ? remaining : prev));

      if (
        remaining === 0 &&
        activePlayer?.id === myPlayerId &&
        gameState.status === 'playing' &&
        !gameState.isPaused &&
        gameState.phase !== 'AUCTION'
      ) {
        if (!hasEmittedTimeoutRef.current) {
          hasEmittedTimeoutRef.current = true;
          onTimeoutTurn?.();
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 500);
    return () => clearInterval(interval);
  }, [
    gameState?.turnStartTime,
    gameState?.turnTimeLimit,
    gameState?.status,
    gameState?.isPaused,
    gameState?.pausedAt,
    gameState?.pausedRemainingTurnMs,
    gameState?.phase,
    activePlayer?.id,
    myPlayerId,
    onTimeoutTurn
  ]);

  if (gameState?.status === 'playing' && activePlayer?.isBot && onFastForwardBot) {
    return (
      <button
        onClick={onFastForwardBot}
        className="w-full py-1 px-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-space font-black text-[8px] sm:text-[9px] transition flex items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 animate-pulse"
        title="Botun turunu anında tamamla ve sıradakine geç"
      >
        <Zap className="w-2.5 h-2.5 text-slate-950 fill-slate-950" />
        <span>Atla</span>
      </button>
    );
  }

  if (gameState?.status === 'playing') {
    return (
      <div
        className={`flex items-center justify-center gap-1 font-jetbrains font-bold text-xs sm:text-sm leading-none ${
          secondsLeft <= 10 ? 'text-rose-500 animate-pulse' : (isDarkMode ? 'text-slate-200' : 'text-slate-700')
        }`}
        title="Kalan Hamle Süresi"
      >
        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500" />
        <span>{secondsLeft}s</span>
      </div>
    );
  }

  return <span className="text-[7.5px] text-slate-400 font-jetbrains">BEKLEMEDE</span>;
});

// ─── İzole Açık Artırma Sayacı ────────────────────────────────────────────────
const AuctionCountdownBadge = React.memo(function AuctionCountdownBadge({
  auction,
  onTimeoutAuction
}) {
  const [secondsLeft, setSecondsLeft] = useState(auction?.timer || 15);
  const lastHeartbeatSecRef = useRef(null);
  const hasEmittedTimeoutRef = useRef(false);

  useEffect(() => {
    hasEmittedTimeoutRef.current = false;
    lastHeartbeatSecRef.current = null;

    const updateAuctionCountdown = () => {
      const timerLimit = auction?.timer || 15;
      const lastBidTime = auction?.lastBidTime || Date.now();
      const elapsed = Math.floor((Date.now() - lastBidTime) / 1000);
      const rem = Math.max(0, timerLimit - elapsed);
      setSecondsLeft(prev => (prev !== rem ? rem : prev));

      if (rem === 0 && !hasEmittedTimeoutRef.current) {
        hasEmittedTimeoutRef.current = true;
        onTimeoutAuction?.();
      }

      if (rem > 0 && rem <= 3 && lastHeartbeatSecRef.current !== rem) {
        lastHeartbeatSecRef.current = rem;
        sounds.playHeartbeat();
      }
    };

    updateAuctionCountdown();
    const interval = setInterval(updateAuctionCountdown, 500);
    return () => clearInterval(interval);
  }, [auction?.lastBidTime, auction?.timer, onTimeoutAuction]);

  return (
    <div className="flex items-center gap-1 bg-amber-400/20 border border-amber-400/50 px-2.5 py-1 rounded-xl text-xs font-black text-amber-300">
      <Clock className="w-3.5 h-3.5 animate-spin" />
      <span>{secondsLeft}s</span>
    </div>
  );
});

function areTilePropsEqual(prev, next) {
  if (prev.tile?.id !== next.tile?.id) return false;
  if (prev.isMyTile !== next.isMyTile) return false;
  if (prev.isMyTurn !== next.isMyTurn) return false;
  if (prev.isActiveTurnTile !== next.isActiveTurnTile) return false;
  if (prev.isAuctionTile !== next.isAuctionTile) return false;
  if (prev.isDemandHighlighted !== next.isDemandHighlighted) return false;
  if (prev.isTradeOffered !== next.isTradeOffered) return false;
  if (prev.isTradeRequested !== next.isTradeRequested) return false;
  if (prev.ringClass !== next.ringClass) return false;
  if (prev.isDarkMode !== next.isDarkMode) return false;
  if (prev.isApocalypse !== next.isApocalypse) return false;

  // propState (ev, ipotek, sahip) karşılaştırması
  if (prev.propState?.houses !== next.propState?.houses) return false;
  if (prev.propState?.mortgaged !== next.propState?.mortgaged) return false;
  if (prev.propState?.ownerId !== next.propState?.ownerId) return false;

  // owner karşılaştırması
  if (prev.owner?.id !== next.owner?.id) return false;
  if (prev.owner?.color !== next.owner?.color) return false;
  if (prev.owner?.name !== next.owner?.name) return false;

  // activeTurnPlayer (yalnızca bu kare aktif oyuncunun karesiyse veya aktif kareden ayrıldıysa kontrol et)
  if (prev.isActiveTurnTile || next.isActiveTurnTile) {
    if (prev.activeTurnPlayer?.id !== next.activeTurnPlayer?.id) return false;
    if (prev.activeTurnPlayer?.color !== next.activeTurnPlayer?.color) return false;
    if (prev.activeTurnPlayer?.name !== next.activeTurnPlayer?.name) return false;
  }

  return true;
}

// ─── Memoized Tekil Kare Bileşeni (40 Karenin Gereksiz Re-render Olmasını Önler) ──
const TileCell = React.memo(function TileCell({
  tile,
  gridPos,
  propState,
  owner,
  isMyTile,
  isMyTurn,
  isActiveTurnTile,
  activeTurnPlayer,
  isCorner,
  isSideTile,
  canBeOwned,
  isAuctionTile,
  isDemandHighlighted,
  isTradeOffered,
  isTradeRequested,
  ringClass,
  isDarkMode,
  isApocalypse,
  onTileClick,
  onMouseEnter,
  onMouseLeave
}) {
  return (
    <div
      onClick={() => onTileClick(tile)}
      onMouseEnter={() => onMouseEnter(tile)}
      style={{
        ...gridPos,
        contain: isDemandHighlighted ? 'none' : 'paint layout'
      }}
      className={`tile relative flex flex-col justify-between border transition-all duration-100 cursor-pointer ${
        isDemandHighlighted ? 'overflow-visible' : 'overflow-hidden'
      } group tile-paper-press ${
        tile.id === 0 && isApocalypse
          ? 'bg-gradient-to-br from-rose-950 via-red-950 to-slate-950 text-rose-100 border-2 border-rose-500 shadow-[inset_0_0_25px_rgba(225,29,72,0.85)]'
          : isDarkMode
            ? (isCorner ? 'bg-[#0b1329]' : 'bg-[#0f172a]')
            : (isCorner ? 'bg-[#f8fafc]' : 'bg-white')
      } ${isDarkMode ? 'border-slate-800' : 'border-slate-300/80'} ${ringClass}`}
    >
      {/* Gerçek Ankara Şehir Fotoğrafı Arka Planı */}
      {tile.image && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
          <img
            src={tile.image}
            alt={tile.name}
            className={`w-full h-full object-cover object-center filter transition-all duration-300 ${
              isDarkMode
                ? 'brightness-[0.75] contrast-[1.1] grayscale-[40%] opacity-[0.16] group-hover:opacity-[0.28] group-hover:scale-105'
                : 'brightness-[1.05] contrast-[1.1] grayscale-[80%] opacity-[0.12] group-hover:opacity-[0.22] group-hover:scale-105'
            }`}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div
            className={`absolute inset-0 ${
              isDarkMode
                ? 'bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/60'
                : 'bg-gradient-to-b from-white/50 via-transparent to-white/70'
            }`}
          />
        </div>
      )}

      {/* Açık Artırma veya Takas Parlayan İç Zemin / Aura */}
      {isDemandHighlighted && (
        <div
          className={`absolute inset-0 z-20 pointer-events-none rounded-sm transition-all ${
            isAuctionTile
              ? 'bg-red-500/20 ring-inset ring-2 ring-red-400/60'
              : 'bg-cyan-500/20 ring-inset ring-2 ring-cyan-300/60'
          }`}
        />
      )}

      {/* Açık Artırma veya Takas Talep Belirgin Konum İşareti (İçeriden Tahtaya Doğru Yönelen Kusursuz Ortalanmış İşaretçi) */}
      {isDemandHighlighted && (() => {
        const isBottomEdge = tile.id >= 0 && tile.id <= 10;
        const isTopEdge = tile.id >= 20 && tile.id <= 30;
        const isLeftEdge = tile.id >= 11 && tile.id <= 19;
        const isRightEdge = tile.id >= 31 && tile.id <= 39;

        const containerClasses = isTopEdge
          ? 'top-full inset-x-0 pt-1 flex flex-col items-center demand-indicator-top'
          : isLeftEdge
          ? 'left-full inset-y-0 pl-1 flex flex-row items-center demand-indicator-left'
          : isRightEdge
          ? 'right-full inset-y-0 pr-1 flex flex-row items-center demand-indicator-right'
          : 'bottom-full inset-x-0 pb-1 flex flex-col items-center demand-indicator-bottom';

        const arrowColor = isAuctionTile ? 'text-red-500' : 'text-cyan-400';

        const arrowSvg = (
          <svg
            className={`drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] flex-shrink-0 ${arrowColor} ${
              isTopEdge ? 'w-3.5 h-2 -mb-0.5' : isLeftEdge ? 'w-2 h-3.5 -mr-0.5' : isRightEdge ? 'w-2 h-3.5 -ml-0.5' : 'w-3.5 h-2 -mt-0.5'
            }`}
            viewBox={isLeftEdge || isRightEdge ? '0 0 8 14' : '0 0 14 8'}
            fill="currentColor"
          >
            {isTopEdge && <polygon points="7,0 14,8 0,8" />}
            {isBottomEdge && <polygon points="0,0 14,0 7,8" />}
            {isLeftEdge && <polygon points="0,7 8,0 8,14" />}
            {isRightEdge && <polygon points="8,7 0,0 0,14" />}
          </svg>
        );

        const badgePill = (
          <div
            className={`text-[8px] sm:text-[9.5px] font-black px-2.5 sm:px-3 py-1 rounded-full shadow-2xl border-2 border-white tracking-wider flex items-center gap-1.5 whitespace-nowrap leading-none ${
              isAuctionTile
                ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white ring-4 ring-red-400/90 shadow-red-600/70'
                : 'bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-500 text-slate-950 font-black ring-4 ring-cyan-300/90 shadow-cyan-500/70'
            }`}
          >
            <span className="text-xs sm:text-sm leading-none">{isAuctionTile ? '🔨' : '🤝'}</span>
            <span className="font-space font-extrabold uppercase">
              {isAuctionTile
                ? 'AÇIK ARTIRMA'
                : isTradeOffered && !isTradeRequested
                ? 'TAKAS: VERİLECEK'
                : isTradeRequested && !isTradeOffered
                ? 'TAKAS: İSTENEN'
                : 'TAKAS TEKLİFİ'}
            </span>
          </div>
        );

        return (
          <div className={`absolute z-50 pointer-events-none drop-shadow-2xl ${containerClasses}`}>
            {(isTopEdge || isLeftEdge) ? (
              <>
                {arrowSvg}
                {badgePill}
              </>
            ) : (
              <>
                {badgePill}
                {arrowSvg}
              </>
            )}
          </div>
        );
      })()}

      {/* Karakterimizin Bulunduğu Yeri Gösteren Belirgin Ok */}
      {isMyTile && (
        <div className={`absolute -top-3 sm:-top-3.5 z-50 flex flex-col items-center pointer-events-none drop-shadow-[0_2px_8px_rgba(245,158,11,0.85)] ${
          isActiveTurnTile ? 'left-[32%] -translate-x-1/2' : 'left-1/2 -translate-x-1/2'
        }`}>
          <div className={`text-slate-950 font-black text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded-full shadow-md border border-white tracking-wider flex items-center gap-0.5 whitespace-nowrap leading-none ${isMyTurn ? 'bg-gradient-to-r from-amber-400 to-yellow-300' : 'bg-amber-400/80'}`}>
            <span>SEN</span>
          </div>
          <div className="text-amber-500 text-[9px] sm:text-[11px] -mt-0.5 leading-none">▼</div>
        </div>
      )}

      {/* Sıradaki Diğer Oyuncunun Bulunduğu Yeri Gösteren Şık Takip Oku */}
      {isActiveTurnTile && (
        <div className={`absolute -top-3 sm:-top-3.5 z-50 pointer-events-none drop-shadow-[0_2px_8px_rgba(56,189,248,0.85)] ${
          isMyTile ? 'left-[68%] -translate-x-1/2' : 'left-1/2 -translate-x-1/2'
        }`}>
          <div className="flex flex-col items-center animate-bounce">
            <div
              className="text-white font-black text-[7.5px] sm:text-[8.5px] px-1.5 py-0.5 rounded-full shadow-md border border-white tracking-wider flex items-center gap-0.5 whitespace-nowrap leading-none shadow-[0_0_8px_rgba(56,189,248,0.8)]"
              style={{ backgroundColor: activeTurnPlayer?.color || '#38bdf8' }}
            >
              <span>{activeTurnPlayer?.name}</span>
            </div>
            <div className="text-sky-500 text-[9px] sm:text-[11px] -mt-0.5 leading-none">▼</div>
          </div>
        </div>
      )}

      {/* Mülk Renk Çubuğu & Binalar */}
      {tile.groupColor && tile.type === 'property' && (
        <div
          className={`w-full ${isSideTile ? 'h-[16%] min-h-[12px] sm:min-h-[14px]' : 'h-[20%] min-h-[16px] sm:min-h-[18px] md:min-h-[20px]'} relative flex items-center justify-between px-1 border-b ${
            isDarkMode ? 'border-slate-800' : 'border-slate-300'
          } flex-shrink-0 z-10`}
          style={{ backgroundColor: tile.groupColor }}
        >
          <div className="flex items-center gap-0.5 z-20 min-w-0">
            {propState && propState.houses > 0 && (
              propState.houses === 5 ? (
                <div
                  className="px-1 py-0.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 border border-amber-300 text-[6px] sm:text-[7px] font-black text-amber-100 rounded shadow-sm leading-none flex items-center gap-0.5 font-jetbrains"
                  title="Otel (5. Seviye)"
                >
                  <span className="text-[7px] sm:text-[8px]">🏨</span>
                  <span className="tracking-tight">OTEL</span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-0.5 bg-slate-950/90 border border-emerald-500/80 px-1 py-0.5 rounded shadow-sm"
                  title={`${propState.houses} Ev`}
                >
                  <span className="text-[7px]">🏠</span>
                  <span className="text-[6px] sm:text-[7px] font-black text-emerald-300 font-jetbrains leading-none">
                    {propState.houses}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* İpotek Bandı */}
      {propState && propState.mortgaged && (
        <div className="absolute inset-0 bg-rose-950/85 flex items-center justify-center z-20 backdrop-blur-[1px]">
          <span className="text-[8px] sm:text-[10px] font-space font-extrabold text-rose-200 uppercase tracking-wider -rotate-12 border border-rose-400 px-1.5 py-0.5 rounded bg-rose-900 shadow-md">
            İPOTEK
          </span>
        </div>
      )}

      {/* Kare İçeriği */}
      <div className="w-full flex-1 flex flex-col items-center justify-between text-center px-1 py-0.5 sm:py-1 relative z-10 min-h-0 overflow-hidden">
        <div className="w-full flex items-center justify-center flex-shrink-0">
          <span
            className={`text-center w-full uppercase select-none ${
              isCorner
                ? `font-space font-extrabold text-[9.5px] sm:text-[11px] md:text-[12px] tracking-[0.5px] leading-tight ${
                    isDarkMode ? 'text-slate-100 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]' : 'text-[#0F172A] drop-shadow-[0_1px_2px_rgba(255,255,255,0.95)]'
                  }`
                : `font-space font-black text-[8px] sm:text-[9px] md:text-[9.5px] tracking-tight leading-[1.1] ${
                    isDarkMode ? 'text-slate-100 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]' : 'text-[#0F172A] drop-shadow-[0_1px_2px_rgba(255,255,255,0.95)]'
                  }`
            }`}
            title={tile.name}
          >
            {tile.shortName || tile.name}
          </span>
        </div>

        {(isCorner || tile.type !== 'property') && (
          <div className="my-0.5 flex items-center justify-center flex-shrink-0 z-10">
            {tile.icon ? (
              <span className={`leading-none select-none ${
                isCorner ? 'text-lg sm:text-xl md:text-2xl drop-shadow-md' : 'text-xs sm:text-sm md:text-base drop-shadow-sm'
              }`}>
                {tile.icon}
              </span>
            ) : tile.type === 'railroad' ? (
              <Train className={`w-3.5 h-3.5 sm:w-4 sm:h-4 drop-shadow ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} />
            ) : tile.type === 'utility' ? (
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 drop-shadow" />
            ) : tile.type === 'tax' ? (
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 drop-shadow" />
            ) : null}
          </div>
        )}

        <div className="z-10 mt-auto pb-0.5">
          <span className={`font-jetbrains font-extrabold text-[8px] sm:text-[9px] md:text-[9.5px] leading-none inline-block select-none ${
            isDarkMode ? 'text-amber-300 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]' : 'text-amber-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.95)]'
          }`}>
            {tile.cost
              ? `${tile.cost}₺`
              : tile.amount
              ? `-${tile.amount}₺`
              : tile.id === 0
              ? '+200₺'
              : ''}
          </span>
        </div>
      </div>

      {canBeOwned && (
        <div
          className={`w-full ${
            isSideTile ? 'h-[12px] sm:h-[14px]' : 'h-[14px] sm:h-[16px]'
          } border-t ${
            isDarkMode ? 'border-slate-800' : 'border-slate-300/80'
          } flex items-center justify-center px-0.5 flex-shrink-0 z-10 overflow-hidden relative`}
          style={{
            backgroundColor: owner ? `${owner.color}${isDarkMode ? '26' : '18'}` : (isDarkMode ? '#080d1a' : '#F1F5F9'),
            borderBottom: owner ? `2px solid ${owner.color}` : 'none'
          }}
        >
          {owner ? (
            <div className="flex items-center gap-0.5 min-w-0 justify-center h-full">
              <div
                className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: owner.color }}
              />
              <span
                className="text-[6.5px] sm:text-[7px] md:text-[7.5px] font-space font-black truncate leading-none uppercase tracking-tighter text-center"
                style={{ color: owner.color }}
                title={`Mülk Sahibi: ${owner.name}`}
              >
                {owner.name}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}, areTilePropsEqual);

// ⚡ Performans İzolasyonu: Fare kareler üzerinde gezinirken devasa Board bileşenini baştan render etmez
const tileHoverListeners = new Set();
function notifyTileHover(tile) {
  for (const fn of tileHoverListeners) fn(tile);
}

const CenterInspectedTilePreview = React.memo(function CenterInspectedTilePreview({
  properties,
  players,
  myPlayerId,
  isDarkMode,
  onTileClick,
  onOpenTrade
}) {
  const [inspectedTile, setInspectedTile] = useState(null);

  useEffect(() => {
    tileHoverListeners.add(setInspectedTile);
    return () => {
      tileHoverListeners.delete(setInspectedTile);
    };
  }, []);

  if (!inspectedTile) return null;

  return (
    <div
      onClick={() => onTileClick(inspectedTile)}
      className={`pointer-events-auto w-full max-w-sm ${
        isDarkMode ? 'bg-[#0f172a]/95 border-slate-700 text-slate-100 shadow-[0_8px_24px_rgba(0,0,0,0.45)]' : 'bg-white/95 border-[#cbd5e1] text-[#0f172a] shadow-[0_8px_24px_rgba(0,0,0,0.12)]'
      } border rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 animate-fadeIn cursor-pointer hover:border-amber-400 transition-colors backdrop-blur-md`}
      title="Detaylı bilgi için tıklayın"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-11 h-11 sm:w-13 sm:h-13 rounded-xl overflow-hidden border ${
          isDarkMode ? 'border-slate-700 bg-slate-850 shadow-md' : 'border-slate-300 bg-slate-100 shadow-sm'
        } flex-shrink-0 flex items-center justify-center relative`}>
          {inspectedTile.image && (
            <img
              src={inspectedTile.image}
              alt={inspectedTile.name}
              className="w-full h-full object-cover relative z-10"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div
            className="absolute inset-0 flex items-center justify-center text-base sm:text-lg font-bold select-none z-0"
            style={{ backgroundColor: inspectedTile.groupColor || (isDarkMode ? '#1e293b' : '#e2e8f0') }}
          >
            {inspectedTile.icon || '🏛️'}
          </div>
        </div>
        <div className="min-w-0 text-left leading-tight">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h4 className={`text-[11px] sm:text-xs font-black truncate font-space ${
              isDarkMode ? 'text-slate-100' : 'text-[#0f172a]'
            }`}>{inspectedTile.name}</h4>
            {inspectedTile.cost && (
              <span className={`text-[10px] sm:text-[11px] font-black font-jetbrains ${
                isDarkMode ? 'text-amber-400' : 'text-amber-700'
              }`}>{inspectedTile.cost}₺</span>
            )}
          </div>
          {inspectedTile.type === 'property' && inspectedTile.rent ? (
            <div className={`text-[8px] sm:text-[9px] flex items-center gap-1.5 sm:gap-2 flex-wrap font-jetbrains ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>
              <span>Yalın: <strong className={isDarkMode ? 'text-slate-100' : 'text-[#0f172a]'}>{inspectedTile.rent[0]}₺</strong></span>
              <span>1 Ev: <strong className={isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}>{inspectedTile.rent[1]}₺</strong></span>
              <span>Otel: <strong className={isDarkMode ? 'text-rose-400' : 'text-rose-700'}>{inspectedTile.rent[5]}₺</strong></span>
              <span>İpotek: <strong className={isDarkMode ? 'text-amber-400' : 'text-amber-800'}>{inspectedTile.mortgage}₺</strong></span>
            </div>
          ) : inspectedTile.type === 'railroad' ? (
            <div className={`text-[8px] sm:text-[9px] flex items-center gap-1.5 sm:gap-2 flex-wrap font-jetbrains ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>
              <span>1 Gar: <strong className={isDarkMode ? 'text-slate-100' : 'text-[#0f172a]'}>25₺</strong></span>
              <span>2 Gar: <strong className={isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}>50₺</strong></span>
              <span>4 Gar: <strong className={isDarkMode ? 'text-rose-400' : 'text-rose-700'}>200₺</strong></span>
              <span>İpotek: <strong className={isDarkMode ? 'text-amber-400' : 'text-amber-800'}>100₺</strong></span>
            </div>
          ) : inspectedTile.type === 'utility' ? (
            <div className={`text-[8px] sm:text-[9px] flex items-center gap-1.5 sm:gap-2 flex-wrap font-jetbrains ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>
              <span>1 Tesis: <strong className={isDarkMode ? 'text-slate-100' : 'text-[#0f172a]'}>4x Zar</strong></span>
              <span>2 Tesis: <strong className={isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}>10x Zar</strong></span>
              <span>İpotek: <strong className={isDarkMode ? 'text-amber-400' : 'text-amber-800'}>75₺</strong></span>
            </div>
          ) : (
            <p className={`text-[8px] sm:text-[8.5px] truncate font-jetbrains ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>{inspectedTile.description || 'Özel Kare'}</p>
          )}
        </div>
      </div>
      {(() => {
        const insProp = properties[inspectedTile.id];
        const insOwner = insProp?.ownerId ? players.find(p => p.id === insProp.ownerId) : null;
        if (insOwner && insOwner.id !== myPlayerId && !insOwner.isBankrupt && (insProp?.houses || 0) === 0) {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenTrade && onOpenTrade(insOwner, inspectedTile.id);
              }}
              className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-[9.5px] sm:text-[10px] flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer flex-shrink-0"
              title={`${insOwner.name} oyuncusuna bu mülk için teklif yap`}
            >
              <span>🤝</span>
              <span>Teklif</span>
            </button>
          );
        }
        return null;
      })()}
    </div>
  );
});

export function Board({
  gameState,
  onTileClick,
  myPlayerId,
  isDiceRolling = false,
  centerControlsSlot,
  onPlaceBid,
  onPassAuction,
  onOpenTrade,
  onRollDice,
  onPawnLanded,
  onFastForwardBot,
  onAcknowledgeCard,
  onTogglePause,
  onTimeoutTurn,
  onTimeoutAuction,
  onDrawCard,
  onShowCardHistory,
  isDarkMode = false,
  isSpectator = false
}) {
  const { players, properties, currentTurnIndex, freeParkingPool, turnStartTime, turnTimeLimit = 75 } = gameState;
  const activePlayer = players[currentTurnIndex];
  const myPlayer = players?.find(p => p.id === myPlayerId);
  const isHost = Boolean(myPlayer?.isHost);
  const isApocalypse = false;

  const isDiceRollingRef = useRef(isDiceRolling);
  isDiceRollingRef.current = isDiceRolling;
  useEffect(() => {
    isDiceRollingRef.current = isDiceRolling;
  }, [isDiceRolling]);

  // Aktif kullanıcının zar atma yetkisi
  const canRoll =
    activePlayer?.id === myPlayerId &&
    (gameState.phase === 'WAITING_ROLL' || (gameState.phase === 'TURN_ACTIONS' && gameState.canRollAgain)) &&
    (activePlayer?.money >= 0) &&
    gameState.status === 'playing';

  // Piyonların kare kare adım animasyonu (başlangıçta tüm oyuncular hemen pozisyonlarında yer alsın)
  const [displayedPositions, setDisplayedPositions] = useState(() => {
    const init = {};
    if (players) {
      players.forEach((p) => {
        init[p.id] = p.position ?? 0;
      });
    }
    return init;
  });
  const prevPositionsRef = useRef({});
  const activeIntervalsRef = useRef({});

  // İlk mount anında prevPositionsRef'i de doldur
  useEffect(() => {
    if (players) {
      players.forEach((p) => {
        if (prevPositionsRef.current[p.id] === undefined) {
          prevPositionsRef.current[p.id] = p.position ?? 0;
        }
      });
    }
  }, [players]);

  // Canlı Büyüteç (Hover / İncelenen Kare) — İzole olay bildirim sistemi
  const handleTileMouseEnter = useCallback((t) => notifyTileHover(t), []);
  const handleTileMouseLeave = useCallback(() => notifyTileHover(null), []);
  const deckLiftTimeoutRef = useRef(null);

  // Açık Artırma Canlı Tokmak Sesi Takibi (Sayaç izole alt bileşende çalışır)
  const lastAuctionBidRef = useRef(null);

  // ⚡ Performans Optimizasyonu: Oyuncuları ve karedeki piyonları O(1) harita ile indeksle
  const playersById = useMemo(() => {
    const map = new Map();
    if (players) {
      players.forEach((p) => map.set(p.id, p));
    }
    return map;
  }, [players]);

  const playersOnTileMap = useMemo(() => {
    const map = {};
    if (players) {
      for (const p of players) {
        if (!p.isBankrupt && !p.isKicked) {
          const pos = displayedPositions[p.id] ?? p.position;
          if (!map[pos]) map[pos] = [];
          map[pos].push(p);
        }
      }
    }
    return map;
  }, [players, displayedPositions]);

  // Yeni pey sürüldüğünde tokmak sesi çal (Sayaçtan bağımsız re-render üretmez)
  useEffect(() => {
    if (gameState.phase !== 'AUCTION' || !gameState.auction) {
      lastAuctionBidRef.current = null;
      return;
    }
    if (lastAuctionBidRef.current !== null && lastAuctionBidRef.current !== gameState.auction.currentBid) {
      sounds.playGavel();
    }
    lastAuctionBidRef.current = gameState.auction.currentBid;
  }, [gameState.phase, gameState.auction?.currentBid]);

  // Çekilen kartı kapatma ve onaylama durumu
  const [dismissedCardId, setDismissedCardId] = useState(null);
  const dismissedCardKeysRef = useRef(new Set());
  const [deckLift, setDeckLift] = useState(null);
  const triggerDeckLift = useCallback((deck) => {
    if (deckLiftTimeoutRef.current) {
      clearTimeout(deckLiftTimeoutRef.current);
    }
    setDeckLift(deck);
    deckLiftTimeoutRef.current = setTimeout(() => {
      setDeckLift(null);
      deckLiftTimeoutRef.current = null;
    }, 550);
  }, []);

  // Canlı Kira Ödeme Bildirimi Takibi (Piyon kareye varmadan erken bildirim çıkmasını önlemek için pending kuyruğu)
  const [rentNotification, setRentNotification] = useState(null);
  const lastRentIdRef = useRef(null);
  const pendingRentRef = useRef(null);

  // Piyon hareket durumu (Zar atıldıktan sonra piyon hareket halindeyken butonların erken açılmasını önler)
  const [isMovingPawn, setIsMovingPawn] = useState(false);

  // Canlı Tapu Satın Alma / İhale Kazanma Bildirimi
  const [propertyAcquiredNotification, setPropertyAcquiredNotification] = useState(null);
  const lastPropertyAcquiredIdRef = useRef(null);

  // Piyon tam kareye ulaştığında ve kart çekilmişse kart sesini çal
  const lastDrawnCardAudioRef = useRef(null);

  // Canlı Takas Sonuç Bildirimi
  const [tradeResultNotification, setTradeResultNotification] = useState(null);
  const lastTradeResultIdRef = useRef(null);

  // Açık artırma tamamlandığında sonucu modal olarak bir süre ekranda tut
  const [activeAuctionResult, setActiveAuctionResult] = useState(null);
  const lastAuctionResultTimestampRef = useRef(null);

  const isCardDrawer = Boolean(
    gameState.drawnCard && (
      gameState.drawnCard.drawerId
        ? gameState.drawnCard.drawerId === myPlayerId
        : activePlayer?.id === myPlayerId
    )
  );

  const handleAcknowledgeDrawnCard = () => {
    const cardKey = gameState.drawnCard?.instanceId || gameState.drawnCard?.drawnAt || gameState.drawnCard?.id;
    if (cardKey) {
      dismissedCardKeysRef.current.add(String(cardKey));
      setDismissedCardId(cardKey);
    }
    if ((activePlayer?.id === myPlayerId || gameState.drawnCard?.drawerId === myPlayerId) && (gameState.drawnCard?.pendingAck || gameState.phase === 'CARD_DRAWN')) {
      onAcknowledgeCard?.();
    }
  };

  // Tur değiştiğinde eski turun kira ve tapu bildirimlerini sıfırla; kart bildirimini sadece kart tamamen kalktığında sıfırla
  useEffect(() => {
    setRentNotification(null);
    setPropertyAcquiredNotification(null);
    if (!gameState.drawnCard) {
      setDismissedCardId(null);
    }
  }, [currentTurnIndex, gameState.drawnCard]);

  // Kart izleyen oyunculara ne zaman gösterilmeye başlandığını izle (min 2s garantisi için)
  const cardDisplayedAtRef = useRef(null);

  // Kart ilk göründüğünde zamanı kaydet ve maksimum 7s sonra kapat
  useEffect(() => {
    if (gameState.drawnCard && !isCardDrawer) {
      const cardKey = String(gameState.drawnCard.instanceId || gameState.drawnCard.drawnAt || gameState.drawnCard.id);
      if (!dismissedCardKeysRef.current.has(cardKey)) {
        cardDisplayedAtRef.current = Date.now();
        const timer = setTimeout(() => {
          handleAcknowledgeDrawnCard();
        }, 7000);
        return () => clearTimeout(timer);
      }
    } else {
      cardDisplayedAtRef.current = null;
    }
  }, [gameState.drawnCard, isCardDrawer]);

  // Tur değiştiğinde kartı kapat: En az 4 saniye geçtiyse anında, geçmediyse kalan süreyi bekle
  // Not: displayedAt null olabilir (kart piyon hareketi sırasında bloklanmışsa henüz görüntülenmemişti)
  // Bu durumda tur değişimi anından itibaren 4s bekliyoruz ki kart en az 4s görünsün
  useEffect(() => {
    if (!gameState.drawnCard || isCardDrawer) return;
    const cardKey = String(gameState.drawnCard.instanceId || gameState.drawnCard.drawnAt || gameState.drawnCard.id);
    if (dismissedCardKeysRef.current.has(cardKey)) return;
    const displayedAt = cardDisplayedAtRef.current ?? Date.now();
    const elapsed = Date.now() - displayedAt;
    const MIN_DISPLAY_MS = 4000;
    if (elapsed >= MIN_DISPLAY_MS) {
      handleAcknowledgeDrawnCard();
    } else {
      const remaining = MIN_DISPLAY_MS - elapsed;
      const timer = setTimeout(() => handleAcknowledgeDrawnCard(), remaining);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurnIndex]);

  // Kira bildirimi otomatik kaybolma (2.5 saniye sonra kaybolur)
  useEffect(() => {
    if (rentNotification) {
      const timer = setTimeout(() => {
        setRentNotification(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [rentNotification]);

  useEffect(() => {
    if (gameState.lastRentPayment && gameState.lastRentPayment.id !== lastRentIdRef.current) {
      lastRentIdRef.current = gameState.lastRentPayment.id;
      
      const activeP = players[currentTurnIndex];
      const isPawnMovingOrWillMove =
        isDiceRolling ||
        isMovingPawn ||
        (activeP && (displayedPositions[activeP.id] ?? activeP.position) !== activeP.position);

      if (isPawnMovingOrWillMove) {
        pendingRentRef.current = gameState.lastRentPayment;
      } else {
        setRentNotification(gameState.lastRentPayment);
        sounds.playCash();
      }
    }
  }, [gameState.lastRentPayment, isDiceRolling, isMovingPawn, players, currentTurnIndex, displayedPositions]);

  useEffect(() => {
    const isPawnMoving =
      isDiceRolling ||
      isMovingPawn ||
      Boolean(activePlayer && (displayedPositions[activePlayer.id] ?? activePlayer.position) !== activePlayer.position);
    const cardKey = String(gameState.drawnCard?.instanceId || gameState.drawnCard?.drawnAt || gameState.drawnCard?.id);
    const isDismissed = dismissedCardKeysRef.current.has(cardKey) || dismissedCardId === cardKey;
    if (!isPawnMoving && gameState.drawnCard && !isDismissed) {
      if (lastDrawnCardAudioRef.current !== cardKey) {
        lastDrawnCardAudioRef.current = cardKey;
        const isChance = gameState.drawnCard.deckType === 'chance' || gameState.drawnCard.id?.startsWith('ch');
        triggerDeckLift(isChance ? 'chance' : 'chest');
        if (typeof sounds.playCard === 'function') {
          sounds.playCard();
        }
      }
    }
  }, [isDiceRolling, isMovingPawn, displayedPositions, activePlayer, gameState.drawnCard, dismissedCardId]);

  useEffect(() => {
    if (gameState.lastPropertyAcquired && gameState.lastPropertyAcquired.id !== lastPropertyAcquiredIdRef.current) {
      lastPropertyAcquiredIdRef.current = gameState.lastPropertyAcquired.id;
      setPropertyAcquiredNotification(gameState.lastPropertyAcquired);
      if (typeof sounds.playBuy === 'function') {
        sounds.playBuy();
      } else if (typeof sounds.playPropertyAcquired === 'function') {
        sounds.playPropertyAcquired();
      } else if (typeof sounds.playCash === 'function') {
        sounds.playCash();
      }

      // 4.5 saniye sonra bildirimi kaldır
      const timer = setTimeout(() => {
        setPropertyAcquiredNotification(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [gameState.lastPropertyAcquired]);

  useEffect(() => {
    if (gameState.lastTradeResult && gameState.lastTradeResult.id !== lastTradeResultIdRef.current) {
      lastTradeResultIdRef.current = gameState.lastTradeResult.id;
      setTradeResultNotification(gameState.lastTradeResult);

      const duration = gameState.lastTradeResult.accepted ? 3000 : 2500;
      const timer = setTimeout(() => {
        setTradeResultNotification(null);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [gameState.lastTradeResult]);



  useEffect(() => {
    if (gameState.lastAuctionResult && gameState.lastAuctionResult.timestamp !== lastAuctionResultTimestampRef.current) {
      lastAuctionResultTimestampRef.current = gameState.lastAuctionResult.timestamp;
      setActiveAuctionResult(gameState.lastAuctionResult);

      const timer = setTimeout(() => {
        setActiveAuctionResult(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [gameState.lastAuctionResult]);

  useEffect(() => {
    // Sıra zar bekleme aşamasındaysa piyon hareket bayrağını sıfırla
    if (gameState.phase === 'WAITING_ROLL') {
      setIsMovingPawn(false);
    }

    players.forEach((p) => {
      const prevPos = prevPositionsRef.current[p.id];
      const targetPos = p.position;

      // İlk yükleme
      if (prevPos === undefined) {
        prevPositionsRef.current[p.id] = targetPos;
        setDisplayedPositions((prev) => ({ ...prev, [p.id]: targetPos }));
        return;
      }

      // Pozisyon değişimi tespit edildiğinde
      if (prevPos !== targetPos) {
        // Varsa devam eden eski interval ve timeout'u anında durdur
        if (activeIntervalsRef.current[p.id]) {
          clearInterval(activeIntervalsRef.current[p.id]);
          delete activeIntervalsRef.current[p.id];
        }
        if (activeIntervalsRef.current[`timeout_${p.id}`]) {
          clearTimeout(activeIntervalsRef.current[`timeout_${p.id}`]);
          delete activeIntervalsRef.current[`timeout_${p.id}`];
        }
        if (activeIntervalsRef.current[`transfer_${p.id}`]) {
          clearTimeout(activeIntervalsRef.current[`transfer_${p.id}`]);
          delete activeIntervalsRef.current[`transfer_${p.id}`];
        }
        if (activeIntervalsRef.current[`poll_${p.id}`]) {
          clearInterval(activeIntervalsRef.current[`poll_${p.id}`]);
          delete activeIntervalsRef.current[`poll_${p.id}`];
        }

        // Tekrar tetiklenmesini engellemek için hedefi hemen kaydet
        prevPositionsRef.current[p.id] = targetPos;

        if (!p.inJail) {
          const forwardSteps = (targetPos - prevPos + 40) % 40;
          const backwardSteps = (prevPos - targetPos + 40) % 40;
          // Resmi Oyun Kuralları:
          // Tahtada geriye doğru hareket YALNIZCA VE YALNIZCA "3 Kare Geri Git" Şans kartında mümkündür.
          // Şans kareleri 7, 22 ve 36 olup geriye gidiş sadece 3 adım geriye (4, 19, 33) gerçekleşebilir.
          // Bunun dışındaki TÜM ilerlemeler (Gar, Tesis, Arsa, GO vb.) daima saat yönünde ileri doğru yapılır.
          const isGoBackCard = (prevPos === 7 && targetPos === 4) ||
                               (prevPos === 22 && targetPos === 19) ||
                               (prevPos === 36 && targetPos === 33);
          const isExplicitBackward = Boolean(gameState?.lastMovement?.playerId === p.id && gameState?.lastMovement?.isBackward);
          const isBackward = (isExplicitBackward || isGoBackCard) && backwardSteps === 3;
          const totalSteps = isBackward ? backwardSteps : forwardSteps;

          // Makul zar adımı veya geri çekilme kartıysa pürüzsüz yürüt
          if (totalSteps > 0 && (totalSteps <= 12 || isBackward)) {
            let step = 0;
            let current = prevPos;
            const startDelay = isBackward ? 300 : 1250; // Zarların 3D tepside durulmasıyla tam senkronize piyon hareketi

            setIsMovingPawn(true);

            const startStepMovement = () => {
              const interval = setInterval(() => {
                step++;
                current = isBackward ? (current - 1 + 40) % 40 : (current + 1) % 40;
                setDisplayedPositions((prev) => ({ ...prev, [p.id]: current }));
                sounds.playStep();

                if (step >= totalSteps) {
                  clearInterval(interval);
                  delete activeIntervalsRef.current[p.id];
                  setDisplayedPositions((prev) => ({ ...prev, [p.id]: targetPos }));
                  setIsMovingPawn(false);

                  // Piyon tam kareye ulaştı: bekleyen kira bildirimi ve ses efektini tetikle
                  if (pendingRentRef.current) {
                    setRentNotification(pendingRentRef.current);
                    sounds.playCash();
                    pendingRentRef.current = null;
                  }

                  // Üst bileşene piyonun vardığını haber ver
                  if (onPawnLanded) {
                    onPawnLanded(p.id, targetPos);
                  }
                }
              }, 175);

              activeIntervalsRef.current[p.id] = interval;
            };

            if (isBackward) {
              const timeout = setTimeout(startStepMovement, 300);
              activeIntervalsRef.current[`timeout_${p.id}`] = timeout;
            } else {
              // Zarlar 3D tepside durulana kadar bekle; durulunca piyon derhal (35ms içinde) adımlamaya başlasın
              const startTime = Date.now();
              const pollInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                if (!isDiceRollingRef.current || elapsed >= 1800) {
                  clearInterval(pollInterval);
                  delete activeIntervalsRef.current[`poll_${p.id}`];
                  const timeout = setTimeout(startStepMovement, 35);
                  activeIntervalsRef.current[`timeout_${p.id}`] = timeout;
                }
              }, 60);
              activeIntervalsRef.current[`poll_${p.id}`] = pollInterval;
            }
          } else {
            // totalSteps > 12: ışınlanmak yerine saat yönünde akıcı tempolu (110ms) yürüyüş ile hedefe ulaş
            if (totalSteps > 0) {
              let step = 0;
              let current = prevPos;
              setIsMovingPawn(true);

              const timeout = setTimeout(() => {
                const interval = setInterval(() => {
                  step++;
                  current = (current + 1) % 40;
                  setDisplayedPositions((prev) => ({ ...prev, [p.id]: current }));
                  sounds.playStep();

                  if (step >= totalSteps) {
                    clearInterval(interval);
                    delete activeIntervalsRef.current[p.id];
                    setDisplayedPositions((prev) => ({ ...prev, [p.id]: targetPos }));
                    setIsMovingPawn(false);

                    if (pendingRentRef.current) {
                      setRentNotification(pendingRentRef.current);
                      sounds.playCash();
                      pendingRentRef.current = null;
                    }

                    if (onPawnLanded) {
                      onPawnLanded(p.id, targetPos);
                    }
                  }
                }, 110);

                activeIntervalsRef.current[p.id] = interval;
              }, 250);

              activeIntervalsRef.current[`timeout_${p.id}`] = timeout;
            } else {
              setDisplayedPositions((prev) => ({ ...prev, [p.id]: targetPos }));
              setIsMovingPawn(false);
              if (pendingRentRef.current) {
                setRentNotification(pendingRentRef.current);
                sounds.playCash();
                pendingRentRef.current = null;
              }
              if (onPawnLanded) {
                onPawnLanded(p.id, targetPos);
              }
            }
          }
        } else {
          // Kodese gönderilme durumu (p.inJail === true)
          // Eğer 30. karedeki Vergi Müfettişi'ne basıp oradan Maliye'ye (10. kare) sevk edildiyse:
          const isFromInspector = (gameState?.lastJailEvent?.playerId === p.id && gameState?.lastJailEvent?.fromTileId === 30);
          const stepsToInspector = (30 - prevPos + 40) % 40;

          if (isFromInspector && stepsToInspector > 0 && stepsToInspector <= 12) {
            let step = 0;
            let current = prevPos;
            setIsMovingPawn(true);

            const startInspectorMovement = () => {
              const interval = setInterval(() => {
                step++;
                current = (current + 1) % 40;
                setDisplayedPositions((prev) => ({ ...prev, [p.id]: current }));
                sounds.playStep();

                if (step >= stepsToInspector) {
                  clearInterval(interval);
                  delete activeIntervalsRef.current[p.id];
                  setDisplayedPositions((prev) => ({ ...prev, [p.id]: 30 }));
                  sounds.playJail();

                  // 30. karede (Müfettiş) teftiş uyarısını oyuncu görsün, ardından 900ms sonra 10. kareye (Maliye) sevk et
                  const jailTransferTimeout = setTimeout(() => {
                    setDisplayedPositions((prev) => ({ ...prev, [p.id]: targetPos }));
                    sounds.playJail();
                    setIsMovingPawn(false);
                    if (pendingRentRef.current) {
                      pendingRentRef.current = null;
                    }
                    if (onPawnLanded) {
                      onPawnLanded(p.id, targetPos);
                    }
                  }, 900);
                  activeIntervalsRef.current[`transfer_${p.id}`] = jailTransferTimeout;
                }
              }, 175);

              activeIntervalsRef.current[p.id] = interval;
            };

            const startTime = Date.now();
            const pollInterval = setInterval(() => {
              const elapsed = Date.now() - startTime;
              if (!isDiceRollingRef.current || elapsed >= 1800) {
                clearInterval(pollInterval);
                delete activeIntervalsRef.current[`poll_${p.id}`];
                const timeout = setTimeout(startInspectorMovement, 35);
                activeIntervalsRef.current[`timeout_${p.id}`] = timeout;
              }
            }, 60);
            activeIntervalsRef.current[`poll_${p.id}`] = pollInterval;
          } else {
            // Doğrudan kodese yerleşme (örneğin kart çekimi)
            setDisplayedPositions((prev) => ({ ...prev, [p.id]: targetPos }));
            setIsMovingPawn(false);
            if (pendingRentRef.current) {
              pendingRentRef.current = null;
            }
            if (onPawnLanded) {
              onPawnLanded(p.id, targetPos);
            }
          }
        }
      }
    });
  }, [players, currentTurnIndex, gameState.phase, gameState.lastJailEvent, onPawnLanded]);

  // Bileşen unmount olduğunda veya sayfa değiştiğinde çalışan tüm piyon animasyon sayaçlarını temizle
  useEffect(() => {
    return () => {
      Object.values(activeIntervalsRef.current).forEach((id) => {
        clearInterval(id);
        clearTimeout(id);
      });
      activeIntervalsRef.current = {};
      if (deckLiftTimeoutRef.current) {
        clearTimeout(deckLiftTimeoutRef.current);
        deckLiftTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="relative w-full aspect-square select-none mx-auto flex items-center justify-center p-0.5 sm:p-1"
      style={{
        maxWidth: 'calc(100dvh - 16px)',
        maxHeight: 'calc(100dvh - 16px)'
      }}
    >
      {/* 11x11 Grid Tahta */}
      <div
        className={`w-full h-full grid gap-0.5 sm:gap-1 rounded-2xl p-0.5 sm:p-1 transition-all duration-700 ${
          isApocalypse
            ? 'bg-[#450a0a] border-4 border-rose-600 shadow-[0_0_65px_rgba(225,29,72,0.7)] ring-4 ring-rose-500/60'
            : isDarkMode
            ? 'bg-[#090d16] border-4 border-[#1e293b] board-cardboard-elevation'
            : 'bg-[#CBD5E1] border-4 border-[#0F172A] board-cardboard-elevation'
        }`}
        style={{
          gridTemplateColumns: '1.45fr repeat(9, 1fr) 1.45fr',
          gridTemplateRows: '1.45fr repeat(9, 1fr) 1.45fr'
        }}
      >
            {/* Ortadaki Merkez Alan (Center of Board) - Ankara Kalesi Arka Plan / Mimari Pafta Zemin */}
            <div
              className={`relative flex flex-col items-center justify-between rounded-2xl p-2 sm:p-3 text-center overflow-hidden shadow-inner transition-all duration-700 ${
                isApocalypse
                  ? 'bg-gradient-to-b from-[#1c0408] via-[#120306] to-[#0a0204] border border-rose-800/80 shadow-[inset_0_0_50px_rgba(225,29,72,0.45)]'
                  : isDarkMode
                  ? 'bg-blueprint-grid border border-slate-800/90 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]'
                  : 'bg-blueprint-grid border border-[#CBD5E1]'
              }`}
              style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}
            >
              {/* Ankara Kalesi Fotoğraf Arka Planı */}
              {!isApocalypse && (
                <img
                  src="/images/ankara-castle-bg.webp"
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none rounded-2xl"
                  style={{
                    filter: isDarkMode
                      ? 'saturate(0.55) brightness(0.38) contrast(1.05)'
                      : 'saturate(0.45) brightness(0.88) contrast(0.95)',
                    zIndex: 0
                  }}
                />
              )}

              {/* Mod'a Uygun Overlay — Blueprint grid texture & okunabilirliği korur */}
              {!isApocalypse && (
                <div
                  className="absolute inset-0 pointer-events-none rounded-2xl"
                  style={{
                    background: isDarkMode
                      ? 'linear-gradient(135deg, rgba(8,13,26,0.72) 0%, rgba(9,13,22,0.68) 50%, rgba(8,13,26,0.74) 100%)'
                      : 'linear-gradient(135deg, rgba(248,250,252,0.62) 0%, rgba(241,245,249,0.58) 50%, rgba(248,250,252,0.64) 100%)',
                    zIndex: 1
                  }}
                />
              )}

              {/* Arka plan yumuşak derinlik (radyal gradient) */}
              <div className={`absolute inset-0 pointer-events-none ${
                isDarkMode
                  ? 'bg-[radial-gradient(circle_at_50%_35%,rgba(56,189,248,0.04)_0%,transparent_70%)]'
                  : 'bg-[radial-gradient(circle_at_50%_35%,rgba(15,23,42,0.04)_0%,transparent_70%)]'
              }`} style={{ zIndex: 2 }} />

              {/* Tahtaya Sabit Basılmış İhale Kartı Yuvası (Board Slot) */}
              <div className="flex absolute left-3 sm:left-6 md:left-8 top-8 sm:top-12 md:top-14 w-20 h-28 sm:w-28 sm:h-40 md:w-32 md:h-44 -rotate-12 rounded-2xl board-card-slot items-center justify-center pointer-events-none select-none z-0">
                <div className="flex flex-col items-center justify-center text-center opacity-20 dark:opacity-30">
                  <span className="text-lg sm:text-2xl md:text-3xl mb-1">📁</span>
                  <span className={`text-[7px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] ${isDarkMode ? 'text-slate-300' : 'text-[#0F172A]'} font-space text-center leading-snug`}>
                    İHALE & FIRSAT<br />DESTESİ
                  </span>
                </div>
              </div>

              {/* Fiziksel İhale & Fırsat Destesi (Manila Klasörü / Kraft & Kamu İhalesi Damgası) */}
              <div className="flex absolute left-3 sm:left-6 md:left-8 top-8 sm:top-12 md:top-14 z-30 pointer-events-auto select-none">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    sounds.playCard();
                    triggerDeckLift('chance');
                    onShowCardHistory?.('chance');
                  }}
                  className={`relative w-20 h-28 sm:w-28 sm:h-40 md:w-32 md:h-44 rounded-2xl bg-gradient-to-br from-[#c26a27] via-[#b45309] to-[#78350f] p-2 sm:p-2.5 md:p-3 text-white physical-deck-stack flex flex-col items-center justify-between border border-amber-300/40 cursor-pointer transition-all duration-300 ${
                    deckLift === 'chance' ? '-rotate-6 -translate-y-3.5 scale-105 shadow-2xl' : '-rotate-12 hover:-rotate-6 hover:-translate-y-2 hover:scale-102'
                  }`}
                  title="İhale & Fırsat Kart Geçmişini Gör (Tıkla)"
                >
                  {/* Kraft Dosya İnce İç Çerçevesi */}
                  <div className="absolute inset-1.5 sm:inset-2 border border-white/30 rounded-xl pointer-events-none" />

                  {/* Üst Deste Başlığı */}
                  <div className="w-full text-center border-b border-amber-200/30 pb-1 z-10">
                    <span className="text-[7.5px] sm:text-[9.5px] md:text-[11px] font-black uppercase tracking-wider block text-amber-100 font-space drop-shadow-sm whitespace-nowrap">
                      İHALE & FIRSAT
                    </span>
                  </div>

                  {/* Orta Klasör / Evrak İkonu & Damga */}
                  <div className="relative flex flex-col items-center justify-center my-auto z-10">
                    <div className="w-10 h-10 sm:w-13 sm:h-13 md:w-15 md:h-15 rounded-xl bg-black/25 border border-amber-400/40 flex items-center justify-center shadow-inner">
                      <span className="text-xl sm:text-2xl md:text-3xl drop-shadow-md">📁</span>
                    </div>
                  </div>

                  {/* Alt Bilgi */}
                  <div className="w-full text-center z-10">
                    <span className="text-[6px] sm:text-[8px] md:text-[9px] font-black opacity-85 uppercase tracking-widest text-amber-200 font-jetbrains block">
                      DOSYA NO: 06
                    </span>
                  </div>
                </div>
              </div>

              {/* Tahtaya Sabit Basılmış Şans / Belediye Kartı Yuvası (Board Slot) */}
              <div className="flex absolute right-3 sm:right-6 md:right-8 bottom-8 sm:bottom-12 md:bottom-14 w-20 h-28 sm:w-28 sm:h-40 md:w-32 md:h-44 rotate-12 rounded-2xl board-card-slot items-center justify-center pointer-events-none select-none z-0">
                <div className="flex flex-col items-center justify-center text-center opacity-20 dark:opacity-30">
                  <span className="text-lg sm:text-2xl md:text-3xl mb-1">🏛️</span>
                  <span className={`text-[7px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] ${isDarkMode ? 'text-slate-300' : 'text-[#0F172A]'} font-space text-center leading-snug`}>
                    BELEDİYE & İMAR<br />DESTESİ
                  </span>
                </div>
              </div>

              {/* Fiziksel Belediye & Şans Destesi (Resmi Tebligat & Altın Yaldız Estetiği) */}
              <div className="flex absolute right-3 sm:right-6 md:right-8 bottom-8 sm:bottom-12 md:bottom-14 z-30 pointer-events-auto select-none">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    sounds.playCard();
                    triggerDeckLift('chest');
                    onShowCardHistory?.('chest');
                  }}
                  className={`relative w-20 h-28 sm:w-28 sm:h-40 md:w-32 md:h-44 rounded-2xl bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#022c22] p-2 sm:p-2.5 md:p-3 text-white physical-deck-stack flex flex-col items-center justify-between border border-emerald-400/50 cursor-pointer transition-all duration-300 ${
                    deckLift === 'chest' ? 'rotate-6 -translate-y-3.5 scale-105 shadow-2xl' : 'rotate-12 hover:rotate-6 hover:-translate-y-2 hover:scale-102'
                  }`}
                  title="Belediye & İmar Kart Geçmişini Gör (Tıkla)"
                >
                  {/* Altın Yaldızlı İnce İç Çerçeve */}
                  <div className="absolute inset-1.5 sm:inset-2 border border-amber-400/40 rounded-xl pointer-events-none" />

                  {/* Üst Deste Başlığı */}
                  <div className="w-full text-center border-b border-amber-400/35 pb-1 z-10">
                    <span className="text-[7.5px] sm:text-[9.5px] md:text-[11px] font-black uppercase tracking-wider block text-amber-300 font-space drop-shadow-sm whitespace-nowrap">
                      BELEDİYE & İMAR
                    </span>
                  </div>

                  {/* Orta Belediye Terazi / Sütun İkonu & Yaldızlı Tebligat Damgası */}
                  <div className="relative flex flex-col items-center justify-center my-auto z-10">
                    <div className="w-10 h-10 sm:w-13 sm:h-13 md:w-15 md:h-15 rounded-xl bg-black/30 border border-emerald-300/40 flex items-center justify-center shadow-inner">
                      <span className="text-xl sm:text-2xl md:text-3xl drop-shadow-md">🏛️</span>
                    </div>
                  </div>

                  {/* Alt Bilgi */}
                  <div className="w-full text-center z-10">
                    <span className="text-[6px] sm:text-[8px] md:text-[9px] font-black opacity-90 uppercase tracking-widest text-emerald-200 font-jetbrains block">
                      İMAR DAİRESİ
                    </span>
                  </div>
                </div>
              </div>

              {/* MERKEZ İZLEYİCİ BİLGİ ROZETİ */}
              {isSpectator && !gameState?.disconnectNotice && (
                <div className="relative z-30 w-full max-w-xs sm:max-w-sm mx-auto mb-1 animate-fadeIn">
                  <div className="bg-sky-950/90 text-sky-200 border border-sky-500/50 px-2.5 py-1.5 rounded-xl shadow-lg flex items-center justify-center gap-1.5 text-[9px] sm:text-[11px] font-bold backdrop-blur-md">
                    <span className="text-xs">👁️</span>
                    <span>Canlı Maç İzleniyor (İzleyici Modu)</span>
                  </div>
                </div>
              )}

              {/* MERKEZ KOMPAKT KOPMA / ATILMA BİLDİRİMİ (Cardboard Ortası) */}
              {gameState?.disconnectNotice && (
                <div className="relative z-30 w-full max-w-xs sm:max-w-sm mx-auto mb-1 animate-fadeIn">
                  {gameState.disconnectNotice.type === 'disconnecting' ? (
                    <div className="bg-amber-500/95 text-slate-950 px-2.5 py-1.5 rounded-xl border-2 border-amber-300 shadow-xl flex items-center justify-center gap-1.5 text-[9px] sm:text-[11px] font-black backdrop-blur-md animate-pulse">
                      <span className="text-xs">⚠️</span>
                      <span className="truncate">
                        <strong>{gameState.disconnectNotice.playerName}</strong> bağlantısı kesildi... (Yeniden bağlanması bekleniyor - 60sn)
                      </span>
                    </div>
                  ) : gameState.disconnectNotice.type === 'kicked' ? (
                    <div className="bg-rose-600/95 text-white px-2.5 py-1.5 rounded-xl border-2 border-rose-400 shadow-xl flex items-center justify-center gap-1.5 text-[9px] sm:text-[11px] font-black backdrop-blur-md animate-bounce">
                      <span className="text-xs">❌</span>
                      <span className="truncate">
                        <strong>{gameState.disconnectNotice.playerName}</strong> 60sn içinde bağlanamadığı için oyundan atıldı.
                      </span>
                    </div>
                  ) : null}
                </div>
              )}

              {/* MERKEZ TEKNİK BİLGİ VE KONTROL BARI */}
              <div className={`relative z-20 w-full max-w-xs sm:max-w-sm mx-auto my-0.5 ${
                isDarkMode ? 'bg-[#0f172a]/95 border-slate-700' : 'bg-white/95 border-slate-300'
              } border ${
                isApocalypse ? 'border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.3)]' : ''
              } rounded-xl shadow-sm overflow-hidden select-none backdrop-blur-sm`}>
                {/* 4 Hücreli Kompakt Grid */}
                <div className={`grid grid-cols-4 divide-x ${
                  isDarkMode ? 'divide-slate-800 bg-[#0f172a]/95 text-slate-200' : 'divide-slate-200 bg-slate-50/95 text-slate-800'
                }`}>
                  {/* 1. Hücre: Tur Sayısı */}
                  <div className="p-1 sm:p-1.5 flex flex-col items-center justify-center text-center">
                    <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase font-space tracking-wider">
                      TUR
                    </span>
                    <span className={`font-extrabold font-jetbrains ${isDarkMode ? 'text-slate-100' : 'text-slate-900'} text-xs sm:text-sm leading-none mt-0.5`}>
                      {gameState?.roundNumber || 1}
                    </span>
                  </div>

                  {/* 2. Hücre: Kalan Dikilebilir Ev Sayısı */}
                  <div
                    className="p-1 sm:p-1.5 flex flex-col items-center justify-center text-center cursor-help group"
                    title="Bankada kalan dikilebilir ev stoku (Toplam: 32)"
                  >
                    <span className="text-[7px] sm:text-[8px] font-bold text-emerald-400 uppercase font-space tracking-wider flex items-center gap-0.5">
                      <Home className="w-2.5 h-2.5 text-emerald-500" /> KALAN EV
                    </span>
                    <span className={`font-extrabold font-jetbrains ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'} text-xs sm:text-sm leading-none mt-0.5`}>
                      {gameState?.bankHouses ?? 32}<span className="text-[8.5px] font-normal text-slate-400">/32</span>
                    </span>
                  </div>

                  {/* 3. Hücre: Kalan Dikilebilir Otel Sayısı */}
                  <div
                    className="p-1 sm:p-1.5 flex flex-col items-center justify-center text-center cursor-help group"
                    title="Bankada kalan dikilebilir otel stoku (Toplam: 12)"
                  >
                    <span className="text-[7px] sm:text-[8px] font-bold text-rose-400 uppercase font-space tracking-wider flex items-center gap-0.5">
                      <Building className="w-2.5 h-2.5 text-rose-500" /> OTEL
                    </span>
                    <span className={`font-extrabold font-jetbrains ${isDarkMode ? 'text-rose-400' : 'text-rose-700'} text-xs sm:text-sm leading-none mt-0.5`}>
                      {gameState?.bankHotels ?? 12}<span className="text-[8.5px] font-normal text-slate-400">/12</span>
                    </span>
                  </div>

                  {/* 4. Hücre: Sıra Süresi & Hızlı Atla (İzole Sayaç) */}
                  <div className="p-1 sm:p-1.5 flex flex-col items-center justify-center text-center">
                    <TurnTimerCell
                      gameState={gameState}
                      activePlayer={activePlayer}
                      myPlayerId={myPlayerId}
                      onFastForwardBot={onFastForwardBot}
                      onTimeoutTurn={onTimeoutTurn}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                </div>
              </div>




          {/* Merkez Kontrol Alanı (Zar & Eylemler - ASLA KAPANMAZ!) */}
          <div className="relative z-20 w-full flex-1 flex flex-col items-center justify-center my-0.5 sm:my-1 min-h-0 overflow-y-auto custom-scrollbar">
            {React.isValidElement(centerControlsSlot)
              ? React.cloneElement(centerControlsSlot, {
                  isRolling: isDiceRolling || centerControlsSlot.props?.isRolling,
                  isMovingPawn: isMovingPawn || centerControlsSlot.props?.isMovingPawn || Boolean(activePlayer && (displayedPositions[activePlayer.id] ?? activePlayer.position) !== activePlayer.position),
                  drawnCardForNonDrawer: (!isCardDrawer && gameState.drawnCard && !(isDiceRolling || isMovingPawn || centerControlsSlot.props?.isMovingPawn || Boolean(activePlayer && (displayedPositions[activePlayer.id] ?? activePlayer.position) !== activePlayer.position)) && !dismissedCardKeysRef.current.has(String(gameState.drawnCard.instanceId || gameState.drawnCard.drawnAt || gameState.drawnCard.id)) && dismissedCardId !== (gameState.drawnCard.instanceId || gameState.drawnCard.id)) ? gameState.drawnCard : null,
                  onDismissDrawnCard: handleAcknowledgeDrawnCard
                })
              : centerControlsSlot}
          </div>

          {/* İncelenen Arsa / Tapu Bilgi Şeridi (Layout Shift Engellenmiş Sabit Taban Rozeti) */}
          <div className="absolute bottom-1.5 sm:bottom-2 inset-x-2 z-30 flex items-center justify-center pointer-events-none transition-all duration-200">
            <CenterInspectedTilePreview
              properties={properties}
              players={players}
              myPlayerId={myPlayerId}
              isDarkMode={isDarkMode}
              onTileClick={onTileClick}
              onOpenTrade={onOpenTrade}
            />
          </div>
        </div>

        {/* Canlı Kira Ödeme Bildirimi Banner'ı (Sadece ödeyen ve mülk sahibine gözükür) */}
        {rentNotification && myPlayerId && (rentNotification.payerId === myPlayerId || rentNotification.ownerId === myPlayerId) && (
          <div className="fixed top-6 inset-x-0 z-50 pointer-events-none flex justify-center px-4">
            <div className="w-full max-w-sm animate-rent-banner-bounce">
              <div className="bg-gradient-to-r from-rose-950/95 via-slate-900/95 to-emerald-950/95 border-2 border-amber-400 rounded-2xl px-4 py-2.5 shadow-[0_0_35px_rgba(251,191,36,0.65)] flex items-center gap-3 backdrop-blur-md">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-xl flex-shrink-0">
                  💸
                </div>
                <div className="min-w-0 flex-1 leading-tight text-left">
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 block">
                    KİRA ÖDEMESİ GERÇEKLEŞTİ!
                  </span>
                  <div className="text-xs font-black text-white truncate flex items-center gap-1 mt-0.5">
                    <span style={{ color: rentNotification.payerColor }}>{rentNotification.payerName}</span>
                    <span className="text-slate-400">➔</span>
                    <span style={{ color: rentNotification.ownerColor }}>{rentNotification.ownerName}</span>
                    <span className="text-amber-400 font-mono text-sm font-extrabold ml-1">
                      {rentNotification.amount}₺
                    </span>
                  </div>
                  <span className="text-[8.5px] text-slate-300 italic truncate block">
                    {rentNotification.tileName} mülkü için
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Canlı Tapu Satın Alma / İhale Kazanma Bildirimi */}
        {propertyAcquiredNotification && (
          propertyAcquiredNotification.playerId === myPlayerId ? (
            <div className="fixed top-6 sm:top-8 inset-x-0 z-50 pointer-events-auto flex justify-center px-4 animate-fadeIn">
              <div className="w-full max-w-sm sm:max-w-md bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950/90 border-2 border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.6)] rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 backdrop-blur-md">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-xl flex-shrink-0">
                  🏛️
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <span className="text-[9.5px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
                    TEBRİKLER! YENİ TAPU KAZANDINIZ
                  </span>
                  <h4 className="text-xs sm:text-sm font-black text-white truncate">
                    {propertyAcquiredNotification.tileName}
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    <span className="text-emerald-400 font-bold">{propertyAcquiredNotification.cost}₺ karşılığında portföyünüze eklendi!</span>
                  </p>
                </div>
                <button
                  onClick={() => setPropertyAcquiredNotification(null)}
                  className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold transition flex-shrink-0 cursor-pointer"
                  title="Kapat"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            /* Başkaları tapu satın alınca altta çıkan küçük, göz yormayan mini bilgilendirme çubuğu */
            <div className="fixed bottom-20 sm:bottom-24 inset-x-0 z-[100] pointer-events-none flex justify-center px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-slate-900/95 border border-slate-700/80 shadow-lg px-3.5 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md text-[11px] text-slate-300 pointer-events-auto">
                <span className="text-xs">📜</span>
                <span>
                  <strong className="text-slate-100 font-bold">{propertyAcquiredNotification.playerName}</strong>,{' '}
                  <span className="text-amber-300 font-medium">{propertyAcquiredNotification.tileName}</span> tapusunu satın aldı ({propertyAcquiredNotification.cost}₺).
                </span>
                <button
                  onClick={() => setPropertyAcquiredNotification(null)}
                  className="ml-1 text-slate-500 hover:text-slate-300 text-[10px] font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        )}



        {/* Canlı Takas Sonuç Bildirimi Banner'ı (Reddedilme durumunda SADECE teklif gönderene gözükür) */}
        {tradeResultNotification && (tradeResultNotification.accepted ? (myPlayerId === tradeResultNotification.fromPlayerId || myPlayerId === tradeResultNotification.toPlayerId) : (myPlayerId === tradeResultNotification.fromPlayerId)) && (
          <div className="fixed top-6 sm:top-8 inset-x-0 z-50 pointer-events-auto flex justify-center px-4 animate-fadeIn">
            <div className={`w-full max-w-sm sm:max-w-md bg-gradient-to-r ${
              tradeResultNotification.accepted
                ? 'from-emerald-950 via-slate-900 to-teal-950/90 border-2 border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.5)]'
                : 'from-rose-950 via-slate-900 to-rose-950/90 border-2 border-rose-500 shadow-[0_0_35px_rgba(244,63,94,0.5)]'
            } rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 backdrop-blur-md`}>
              <div className={`w-10 h-10 rounded-xl ${tradeResultNotification.accepted ? 'bg-emerald-500/20 border-emerald-400/50' : 'bg-rose-500/20 border-rose-400/50'} border flex items-center justify-center text-xl flex-shrink-0`}>
                {tradeResultNotification.accepted ? '🤝' : '❌'}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <span className={`text-[9.5px] font-black uppercase tracking-widest block ${tradeResultNotification.accepted ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tradeResultNotification.accepted ? 'TAKAS ANLAŞMASI KABUL EDİLDİ' : 'TAKAS TEKLİFİ REDDEDİLDİ'}
                </span>
                <p className="text-xs text-slate-200 mt-0.5 leading-snug">
                  {tradeResultNotification.accepted
                    ? `${tradeResultNotification.senderName || tradeResultNotification.fromPlayerName || 'Oyuncu'} ile ${tradeResultNotification.receiverName || tradeResultNotification.toPlayerName || 'Oyuncu'} arasındaki takas onaylandı!`
                    : `${tradeResultNotification.receiverName || tradeResultNotification.toPlayerName || 'Oyuncu'}, ${tradeResultNotification.senderName || tradeResultNotification.fromPlayerName || 'Oyuncu'} tarafından sunulan takas teklifini reddetti.`}
                </p>
              </div>
              <button
                onClick={() => setTradeResultNotification(null)}
                className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold transition flex-shrink-0 cursor-pointer"
                title="Kapat"
              >
                ✕
              </button>
            </div>
          </div>
        )}


        {/* 40 Kare Render */}
        {BOARD_TILES.map((tile) => {
          const gridPos = GRID_POSITIONS[tile.id] || getGridPosition(tile.id);
          const propState = properties[tile.id];
          const owner = propState?.ownerId ? playersById.get(propState.ownerId) : null;
          const playersOnTile = playersOnTileMap[tile.id] || EMPTY_PLAYERS;

          const activeTurnPlayer = players[currentTurnIndex];
          const isMyTurn = activeTurnPlayer?.id === myPlayerId;
          const activePlayerPos = activeTurnPlayer ? (displayedPositions[activeTurnPlayer.id] ?? activeTurnPlayer.position) : null;
          const isActiveTurnTile = activeTurnPlayer && activeTurnPlayer.id !== myPlayerId && activePlayerPos === tile.id;

          const myPlayer = playersById.get(myPlayerId);
          const myPos = displayedPositions[myPlayerId] ?? myPlayer?.position;
          const isMyTile = myPos === tile.id;
          const isCorner = [0, 10, 20, 30].includes(tile.id);
          const isSideTile = (tile.id >= 11 && tile.id <= 19) || (tile.id >= 31 && tile.id <= 39);
          const canBeOwned = tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility';

          const isAuctionTile = gameState.auction && gameState.auction.tileId === tile.id;
          const isPendingTradeTile = gameState.pendingTrade && (
            gameState.pendingTrade.offeredProperties?.includes(tile.id) ||
            gameState.pendingTrade.requestedProperties?.includes(tile.id)
          );
          const isDemandHighlighted = Boolean(isAuctionTile || isPendingTradeTile);

          const isTradeOffered = Boolean(gameState.pendingTrade?.offeredProperties?.includes(tile.id));
          const isTradeRequested = Boolean(gameState.pendingTrade?.requestedProperties?.includes(tile.id));

          let ringClass = '';
          if (isDemandHighlighted) {
            ringClass = isAuctionTile
              ? 'demand-highlight-auction'
              : 'demand-highlight-trade';
          } else if (isActiveTurnTile && isMyTile) {
            ringClass = 'ring-2 ring-amber-500 border-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.85)] z-30';
          } else if (isActiveTurnTile) {
            ringClass = 'ring-2 ring-sky-500 border-sky-400 shadow-[0_0_14px_rgba(14,165,233,0.7)] z-30';
          } else if (isMyTile) {
            if (isMyTurn) {
              ringClass = 'ring-2 ring-amber-500 border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.85)] z-30';
            } else {
              ringClass = 'ring-1 ring-amber-400 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)] z-20';
            }
          } else if (owner) {
            ringClass = isDarkMode ? 'border-slate-700 hover:border-amber-500 shadow-sm' : 'border-slate-300 hover:border-amber-500 shadow-sm';
          } else {
            ringClass = isDarkMode ? 'border-slate-800 hover:border-slate-600' : 'border-[#CBD5E1] hover:border-slate-400';
          }

          return (
            <TileCell
              key={tile.id}
              tile={tile}
              gridPos={gridPos}
              propState={propState}
              owner={owner}
              isMyTile={isMyTile}
              isMyTurn={isMyTurn}
              isActiveTurnTile={isActiveTurnTile}
              activeTurnPlayer={activeTurnPlayer}
              isCorner={isCorner}
              isSideTile={isSideTile}
              canBeOwned={canBeOwned}
              isAuctionTile={isAuctionTile}
              isDemandHighlighted={isDemandHighlighted}
              isTradeOffered={isTradeOffered}
              isTradeRequested={isTradeRequested}
              ringClass={ringClass}
              isDarkMode={isDarkMode}
              isApocalypse={isApocalypse}
              onTileClick={onTileClick}
              onMouseEnter={handleTileMouseEnter}
              onMouseLeave={handleTileMouseLeave}
            />
          );
        })}
      </div>

      {/* 3D Three.js Şeffaf Katman: 3D Piyonlar - TAHTA KARELERİNİN ÜSTÜNDE PARLAYAN 3D MODELLER */}
      <Board3DOverlay
        gameState={gameState}
        displayedPositions={displayedPositions}
        myPlayerId={myPlayerId}
        onRollDice={onRollDice}
        canRoll={canRoll}
      />

      {/* DESTEDEN ÇEKİLEN ŞANS / BELEDİYE KARTI 3D MODALI (SADECE KARTI ÇEKEN OYUNCUYA 3D ANİMASYONLA AÇILIR) */}
      {isCardDrawer &&
        !isDiceRolling &&
        !(isMovingPawn || Boolean(activePlayer && (displayedPositions[activePlayer.id] ?? activePlayer.position) !== activePlayer.position)) &&
        gameState.drawnCard &&
        !dismissedCardKeysRef.current.has(String(gameState.drawnCard.instanceId || gameState.drawnCard.drawnAt || gameState.drawnCard.id)) &&
        dismissedCardId !== (gameState.drawnCard.instanceId || gameState.drawnCard.id) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-[3px] animate-fadeIn pointer-events-auto select-none perspective-1200">
          {/* 3D Flipper Kart Öğesi (Desteden Fırlayıp Havada 180° Dönen Gerçekçi Kart) */}
          <div className={`relative w-full max-w-xs sm:max-w-sm preserve-3d cursor-default ${
            (gameState.drawnCard.deckType === 'chance' || gameState.drawnCard.id?.startsWith('ch'))
              ? 'animate-card-draw-chance'
              : 'animate-card-draw-chest'
          }`}>
            
            {/* 1. ARKA YÜZ (Uçuşun başında desteden fırlarken görünen kapalı kart arkası) */}
            <div
              className={`card-face backface-hidden absolute inset-0 w-full h-full rounded-3xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-2 flex flex-col items-center justify-between min-h-[280px] select-none ${
                (gameState.drawnCard.deckType === 'chance' || gameState.drawnCard.id?.startsWith('ch'))
                  ? 'bg-gradient-to-br from-[#c26a27] via-[#b45309] to-[#78350f] border-amber-300/60 text-amber-100'
                  : 'bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#022c22] border-emerald-400/60 text-emerald-100'
              }`}
              style={{ transform: 'rotateY(180deg)' }}
            >
              {/* Altın Yaldızlı İç Bordür Çerçeve */}
              <div className="absolute inset-2 sm:inset-2.5 border-2 border-dashed border-amber-300/40 rounded-2xl pointer-events-none" />
              
              {/* Deste Arka Başlık */}
              <div className="w-full text-center z-10">
                <span className="text-xs sm:text-sm font-black uppercase tracking-[0.25em] font-space text-amber-200 drop-shadow-md block">
                  {(gameState.drawnCard.deckType === 'chance' || gameState.drawnCard.id?.startsWith('ch'))
                    ? 'İHALE & FIRSAT'
                    : 'BELEDİYE & İMAR'}
                </span>
                <span className="text-[9px] font-bold text-white/70 font-jetbrains tracking-wider block mt-0.5">
                  MÜTEAHHİT RESMİ EVRAK
                </span>
              </div>

              {/* Merkez Mühür & İkon */}
              <div className="relative flex flex-col items-center justify-center my-auto z-10">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-black/30 border-2 border-amber-400/60 flex items-center justify-center text-3xl sm:text-4xl shadow-inner">
                  {(gameState.drawnCard.deckType === 'chance' || gameState.drawnCard.id?.startsWith('ch')) ? '📁' : '🏛️'}
                </div>
              </div>

              {/* Alt Damga */}
              <div className="w-full text-center z-10">
                <span className="text-[8px] font-semibold text-white/50 font-jetbrains tracking-widest uppercase">
                  ANKARA BÜYÜKŞEHİR BELGESİ
                </span>
              </div>
            </div>

            {/* 2. ÖN YÜZ (Havada 180° dönüp açılan, kart içeriği ve aksiyon butonu - TAM DÜZ) */}
            <div className={`card-face backface-hidden relative w-full rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-2 overflow-hidden ${
              isDarkMode ? 'bg-[#0f172a] border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-[#0f172a]'
            }`}>
              
              {/* Açılış Işık Hüzmesi (Shimmer Sweep) */}
              <div className="pointer-events-none absolute inset-0 z-20 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-25 animate-card-shimmer" />

              {/* Üst Deste Başlığı */}
              <div className={`flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} pb-2.5 mb-3`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-2xl sm:text-3xl flex-shrink-0">
                    {gameState.drawnCard.deckType === 'chance' || gameState.drawnCard.id?.startsWith('ch') ? '📜' : '🏛️'}
                  </span>
                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider block font-space ${
                          gameState.drawnCard.deckType === 'chance' || gameState.drawnCard.id?.startsWith('ch')
                            ? (isDarkMode ? 'text-amber-400' : 'text-amber-700')
                            : (isDarkMode ? 'text-emerald-400' : 'text-emerald-700')
                        }`}
                      >
                        {gameState.drawnCard.deckType === 'chance' || gameState.drawnCard.id?.startsWith('ch')
                          ? 'İHALE & FIRSAT KARTI'
                          : 'BELEDİYE & İMAR KARTI'}
                      </span>
                      {activePlayer && (
                        <span className={`text-[9px] font-jetbrains font-semibold truncate max-w-[130px] ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          ({activePlayer.id === myPlayerId ? 'Sen çektin' : `${activePlayer.name} çekti`})
                        </span>
                      )}
                    </div>
                    <h4 className={`text-sm sm:text-base font-black leading-tight font-space truncate mt-0.5 ${
                      isDarkMode ? 'text-slate-100' : 'text-[#0f172a]'
                    }`}>
                      {gameState.drawnCard.title}
                    </h4>
                  </div>
                </div>
                <button
                  onClick={handleAcknowledgeDrawnCard}
                  className={`w-7 h-7 rounded-full ${
                    isDarkMode ? 'bg-slate-850 hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800'
                  } flex items-center justify-center text-xs font-bold transition flex-shrink-0 cursor-pointer`}
                  title="Kapat"
                >
                  ✕
                </button>
              </div>

              {/* Kart Açıklaması */}
              <div className={`${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-2xl p-3.5 border mb-4 text-center`}>
                <p className={`text-xs sm:text-sm font-medium leading-relaxed font-jetbrains ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  {gameState.drawnCard.desc}
                </p>
              </div>

              {/* Buton */}
              <button
                onClick={handleAcknowledgeDrawnCard}
                className={`w-full py-3 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 shadow-md transition active:scale-95 cursor-pointer ${
                  gameState.drawnCard.deckType === 'chance' || gameState.drawnCard.id?.startsWith('ch')
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:brightness-110'
                    : 'bg-gradient-to-r from-emerald-400 to-teal-400 hover:brightness-110'
                }`}
              >
                {activePlayer?.id === myPlayerId ? 'Anladım' : 'Kapat'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CANLI AÇIK ARTIRMA MODALI (Aktif İhale veya İhale Sonucu - Tahtayı ve karton dokuyu kapatmaz) */}
      {((gameState.phase === 'AUCTION' && gameState.auction) || activeAuctionResult) && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-2 sm:p-3 bg-black/25 pointer-events-none animate-fadeIn">
          {activeAuctionResult ? (
            /* Açık Artırma Bittiğinde Doğrudan Ekranın İçinde Kazananı Gösteren Kart */
            <div className="pointer-events-auto relative w-full max-w-[340px] sm:max-w-sm bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-400 rounded-3xl p-4 sm:p-5 shadow-[0_0_50px_rgba(251,191,36,0.45)] flex flex-col items-center text-center gap-3.5 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border-2 border-amber-400/60 flex items-center justify-center text-3xl shadow-lg shadow-amber-500/20">
                {activeAuctionResult.sold ? '🏆' : '⚠️'}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                  AÇIK ARTIRMA TAMAMLANDI
                </span>
                <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
                  "{activeAuctionResult.tileName}"
                </h3>
              </div>
              {activeAuctionResult.sold ? (
                <div className="bg-emerald-950/80 border border-emerald-500/60 rounded-2xl p-3.5 w-full flex flex-col items-center gap-1 shadow-inner">
                  <span className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider">Kazanan Oyuncu</span>
                  <span className="text-base sm:text-xl font-black" style={{ color: activeAuctionResult.winnerColor || '#34d399' }}>
                    {activeAuctionResult.winnerName}
                  </span>
                  <span className="text-xs font-mono font-black text-amber-400 mt-0.5">
                    {activeAuctionResult.amount}₺ teklif ile tapuyu kazandı!
                  </span>
                </div>
              ) : (
                <div className="bg-rose-950/70 border border-rose-600/60 rounded-2xl p-3.5 w-full text-xs text-rose-300 font-medium">
                  {activeAuctionResult.reason || 'Kimse teklif vermediği için'} mülk sahipsiz kaldı.
                </div>
              )}
              <button
                onClick={() => setActiveAuctionResult(null)}
                className="mt-1 px-5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
              >
                Kapat
              </button>
            </div>
          ) : (
            <div className="pointer-events-auto relative w-full max-w-[340px] sm:max-w-sm bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-400 rounded-3xl p-3.5 sm:p-4 shadow-[0_0_50px_rgba(251,191,36,0.35)] flex flex-col gap-3">
            {/* Üst Başlık & Süre */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-lg text-amber-400">
                  <Gavel className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                    CANLI AÇIK ARTIRMA
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                    {gameState.auction.tileName}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 font-semibold text-slate-300 flex items-center gap-1">
                      <span>Mülk Sahibi:</span>
                      <strong style={{ color: gameState.auction.ownerColor || '#94a3b8' }}>
                        {gameState.auction.ownerName || 'Sahipsiz'}
                      </strong>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/40 font-semibold text-amber-300">
                      {gameState.auction.reasonText || 'Açık Artırma'}
                    </span>
                  </div>
                </div>
              </div>
              <AuctionCountdownBadge
                auction={gameState.auction}
                onTimeoutAuction={onTimeoutAuction}
              />
            </div>

            {/* Mülk Önizlemesi & Mevcut Teklif */}
            <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800 flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-amber-400/40 flex-shrink-0 bg-slate-900 flex items-center justify-center">
                {gameState.auction.tileImage ? (
                  <img
                    src={gameState.auction.tileImage}
                    alt={gameState.auction.tileName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-2xl"
                    style={{ backgroundColor: gameState.auction.tileGroupColor }}
                  >
                    🏛️
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-slate-400 font-bold block">
                  Orijinal Değer: {gameState.auction.tileCost}₺
                </span>
                <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono flex items-center gap-1.5 my-0.5">
                  <span>{gameState.auction.currentBid}₺</span>
                </div>
                <div className="text-xs text-slate-300 flex items-center gap-1">
                  <span>En Yüksek Teklif:</span>
                  {gameState.auction.highestBidderName ? (
                    <span className="font-extrabold" style={{ color: gameState.auction.highestBidderColor }}>
                      {gameState.auction.highestBidderName}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Başlangıç Peyi</span>
                  )}
                </div>
              </div>
            </div>

            {/* Teklif Verebilecek Başka Oyuncu Kalmadığında 3sn Hızlı Kapanış Uyarısı */}
            {gameState.auction.guaranteedWinner && (
              <div className="bg-amber-500/20 border border-amber-400/80 rounded-xl px-3 py-1.5 text-center text-[10.5px] text-amber-300 font-bold flex items-center justify-center gap-1.5 animate-pulse">
                <span>⚡ Başka pey sürebilecek oyuncu kalmadı! Tapu 3 saniyede kesinleşiyor...</span>
              </div>
            )}

            {/* Teklif Durumu / Pas / Butonlar */}
            {(() => {
              const myPlayer = players.find(p => p.id === myPlayerId);
              const isBankrupt = Boolean(myPlayer?.isBankrupt);
              const hasPassed = gameState.auction.passedPlayerIds?.includes(myPlayerId);
              const isHighestBidder = gameState.auction.highestBidderId === myPlayerId;
              const currentBid = gameState.auction.currentBid;
              const myCash = myPlayer?.money || 0;

              if (isBankrupt) {
                return (
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3 text-center text-xs text-rose-300 font-medium">
                    <span className="text-rose-400 font-bold block">
                      💀 İflas ettiğiniz için açık artırmaya katılamazsınız (Yalnızca İzleyici Modu).
                    </span>
                  </div>
                );
              }

              if (hasPassed) {
                return (
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3 text-center text-xs text-slate-400 font-medium">
                    Bu açık artırmadan çekildiniz (Pas geçildi). Sonucu bekliyorsunuz...
                  </div>
                );
              }

              if (isHighestBidder) {
                return (
                  <div className="bg-emerald-950/60 border border-emerald-500/60 rounded-xl p-3 text-center text-xs text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>Şu an en yüksek teklif sizde! Diğer oyuncular bekleniyor...</span>
                  </div>
                );
              }

              return (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-slate-400 font-bold text-center">
                    Mevcut Nakdiniz: <strong className="text-amber-400 font-mono">{myCash}₺</strong>
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: '+10₺', sub: 'Hızlı', targetBid: currentBid + 10 },
                      { label: '+50₺', sub: 'Agresif', targetBid: currentBid + 50 },
                      { label: '+%10', sub: 'Blokaj', targetBid: Math.max(currentBid + 10, Math.round(currentBid * 1.10)) }
                    ].map((btn, idx) => {
                      const canAfford = myCash >= btn.targetBid;
                      return (
                        <button
                          key={idx}
                          onClick={() => onPlaceBid?.(btn.targetBid)}
                          disabled={!canAfford}
                          className="py-2.5 px-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-40 disabled:hover:from-amber-400 disabled:hover:to-amber-500 text-slate-950 font-black text-xs shadow-md transition active:scale-95 cursor-pointer flex flex-col items-center justify-center border border-amber-300/40"
                        >
                          <span className="font-extrabold">{btn.label}</span>
                          <span className="text-[10px] font-mono opacity-85">({btn.targetBid}₺)</span>
                          <span className="text-[8.5px] uppercase tracking-wider text-slate-900/80 font-bold -mt-0.5">{btn.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => onPassAuction?.()}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs transition active:scale-95 cursor-pointer mt-1"
                  >
                    Pas Geç (Çekil)
                  </button>
                </div>
              );
            })()}
          </div>
          )}
        </div>
      )}



      {/* OYUN DURAKLATMA (PAUSE) EKRANI */}
      {gameState.isPaused && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg animate-fadeIn select-none">
          <div className="relative w-full max-w-sm rounded-3xl p-6 bg-slate-900 border-2 border-amber-400/80 shadow-[0_0_60px_rgba(251,191,36,0.35)] flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-400/20 border-2 border-amber-400/60 flex items-center justify-center text-3xl shadow-lg shadow-amber-500/30 animate-pulse">
              ⏸️
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block font-space">
                OYUN DURAKLATILDI
              </span>
              <h3 className="text-lg font-black text-white mt-1 font-space">
                Oyun Beklemeye Alındı
              </h3>
              <p className="text-xs text-slate-300 font-medium mt-1 font-jetbrains">
                Oda kurucusu oyunu duraklattı. Süre sayaçları ve hamleler donduruldu.
              </p>
            </div>
            {isHost && (
              <button
                onClick={onTogglePause}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 font-space"
              >
                <span>▶️ Oyunu Devam Ettir</span>
              </button>
            )}
            {!isHost && (
              <div className="text-[11px] text-amber-300/80 bg-amber-950/40 border border-amber-500/30 rounded-xl px-3 py-2 w-full font-jetbrains">
                Oda kurucusunun oyunu devam ettirmesi bekleniyor...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
