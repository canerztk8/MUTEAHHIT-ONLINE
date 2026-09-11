import React, { useState, useEffect, useRef } from 'react';
import { Dices, Zap, Clock, Sparkles, Copy, Check, Volume2, VolumeX, LogOut, Sun, Moon, Eye } from 'lucide-react';
import { Dice3DTrayManager } from '../three/Dice3DTrayManager.js';

export function DiceSidebarTray({
  gameState,
  myPlayerId,
  isSpectator = false,
  onRollDice,
  onRollAgain,
  onFastForwardBot,
  canRoll = false,
  roomCode,
  copiedLink = false,
  onCopyLink,
  volume = 0.6,
  onVolumeToggle,
  onVolumeChange,
  onLeaveGame,
  isDarkMode = false,
  onToggleDarkMode,
  isPerformanceMode = false,
  onTogglePause,
  onRollStart,
  onRollSettled
}) {
  const containerRef = useRef(null);
  const managerRef = useRef(null);

  const me = gameState?.players?.find(p => p.id === myPlayerId);
  const isHost = Boolean(me?.isHost);
  const activePlayer = gameState?.players?.[gameState?.currentTurnIndex];
  const isMyTurn = activePlayer?.id === myPlayerId;

  // Fiziksel olarak duran zarları yerel state'te sakla; atış sırasında null yapılarak erken UI güncellemesi önlenir
  const [settledDice, setSettledDice] = useState(null);
  const displayDice = settledDice || (gameState?.phase !== 'WAITING_ROLL' ? gameState?.dice : null);
  const dice1 = displayDice?.[0] || 1;
  const dice2 = displayDice?.[1] || 1;
  const diceTotal = dice1 + dice2;
  const isDouble = Boolean(displayDice && dice1 === dice2 && gameState?.phase !== 'WAITING_ROLL');
  const isRollAgain = Boolean(
    isMyTurn &&
    gameState?.status === 'playing' &&
    !gameState?.isPaused &&
    gameState?.phase === 'TURN_ACTIONS' &&
    gameState?.canRollAgain &&
    (activePlayer?.money >= 0)
  );
  const canRollAny = Boolean((canRoll || isRollAgain) && !gameState?.isPaused);

  // Ses Seviyesi Slider Menüsü State'i
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeMenuRef = useRef(null);

  useEffect(() => {
    if (!showVolumeSlider) return;
    const handleClickOutside = (e) => {
      if (volumeMenuRef.current && !volumeMenuRef.current.contains(e.target)) {
        setShowVolumeSlider(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVolumeSlider]);

  // Zar atış tespiti – aynı atış için TEK key
  // Server bazen aynı atış için iki ayrı state güncellemesi gönderir:
  //   Güncelleme 1: { dice, logs: [{ id: 'L1', type:'dice' }], lastDiceRollId: null }
  //   Güncelleme 2: { lastDiceRollId: 'R1' }  ← aynı atış, farklı key → çift tetik!
  // Çözüm: logId değişince yeni atış say; sadece lastDiceRollId değişimi aynı atışın teyidi
  const latestDiceLog = gameState?.logs
    ? [...gameState.logs].reverse().find((l) => l.type === 'dice')
    : null;

  const currentLogId    = latestDiceLog?.id != null ? String(latestDiceLog.id) : null;
  const currentServerId = gameState?.lastDiceRollId != null ? String(gameState.lastDiceRollId) : null;

  const stableRollKeyRef = useRef(null);     // son kararlı atış anahtarı
  const lastSeenLogIdRef = useRef(null);     // en son işlenen log.id
  const lastSeenServerIdRef = useRef(null);  // en son işlenen lastDiceRollId

  // Hem log ID hem lastDiceRollId değişimini tanı; aynı atış için tekil ve değişmez key üret
  if (
    (currentServerId && currentServerId === lastSeenServerIdRef.current) ||
    (currentLogId && currentLogId === lastSeenLogIdRef.current)
  ) {
    // Aynı atışın devam eden durum güncellemesi – anahtar kesinlikle sabit kalmalı
    if (currentServerId) lastSeenServerIdRef.current = currentServerId;
    if (currentLogId) lastSeenLogIdRef.current = currentLogId;
  } else if (currentServerId && currentServerId !== lastSeenServerIdRef.current) {
    lastSeenServerIdRef.current = currentServerId;
    if (currentLogId) lastSeenLogIdRef.current = currentLogId;
    stableRollKeyRef.current = currentServerId;
  } else if (currentLogId && currentLogId !== lastSeenLogIdRef.current) {
    lastSeenLogIdRef.current = currentLogId;
    stableRollKeyRef.current = currentServerId || `log_${currentLogId}`;
  }

  const currentRollKey = stableRollKeyRef.current;
  const lastRollKeyRef = useRef(null);   // null = ilk render'da tetik olmaz

  // Tur süresi sayacı (75 saniye)
  const [secondsLeft, setSecondsLeft] = useState(gameState?.turnTimeLimit || 75);
  const [isRollingLocal, setIsRollingLocal] = useState(false);
  const isRollingLocalRef      = useRef(false);
  const localRollTimeoutRef    = useRef(null);
  const handleManualRollRef    = useRef(null);

  // Sıra / faz değiştiğinde bekleyen zamanlayıcıları sıfırla (zarlar hala havada dönüyorsa kilidi erken açma)
  useEffect(() => {
    if (!managerRef.current?.isRolling) {
      isRollingLocalRef.current = false;
      setIsRollingLocal(false);
    }
    if (activePlayer?.id !== myPlayerId) {
      if (localRollTimeoutRef.current) {
        clearTimeout(localRollTimeoutRef.current);
        localRollTimeoutRef.current = null;
      }
    }
  }, [gameState?.currentTurnIndex, gameState?.phase, activePlayer?.id, myPlayerId]);

  useEffect(() => {
    return () => {
      if (localRollTimeoutRef.current) {
        clearTimeout(localRollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
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

    let lastSec = -1;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - gameState.turnStartTime) / 1000);
      const remaining = Math.max(0, (gameState.turnTimeLimit || 75) - elapsed);
      if (remaining !== lastSec) {
        lastSec = remaining;
        setSecondsLeft(remaining);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [gameState?.turnStartTime, gameState?.turnTimeLimit, gameState?.status, gameState?.currentTurnIndex, gameState?.isPaused, gameState?.pausedAt, gameState?.pausedRemainingTurnMs, gameState?.phase]);

  // 3D Zar Tablası Sahnesini Başlat (Mevcut zar değerleri ile)
  const [isSceneReady, setIsSceneReady] = useState(false);
  const pendingRollRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const manager = new Dice3DTrayManager();
    managerRef.current = manager;

    const initialDice = gameState?.dice || [1, 1];
    manager.setupScene(containerRef.current, () => {
      handleManualRollRef.current?.();
    }, initialDice);

    setIsSceneReady(true);

    // Eğer sahne yüklenirken bot veya uzak oyuncu zar atışı geldiyse derhal oynat
    if (pendingRollRef.current) {
      const pending = pendingRollRef.current;
      pendingRollRef.current = null;
      isRollingLocalRef.current = true;
      setIsRollingLocal(true);
      setSettledDice(null);
      onRollStart?.();

      (async () => {
        try {
          await manager.rollDice(pending.dice, pending.toss);
        } catch (err) {
          console.warn('[DiceSidebarTray] Mount roll error:', err);
        } finally {
          isRollingLocalRef.current = false;
          setIsRollingLocal(false);
          setSettledDice(pending.dice);
          onRollSettled?.(pending.dice, pending.dice[0] + pending.dice[1], pending.dice[0] === pending.dice[1]);
        }
      })();
    }

    return () => {
      setIsSceneReady(false);
      manager.dispose();
      managerRef.current = null;
    };
  }, []);

  // canRoll durumunu 3D yöneticisine aktar
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setCanRoll(canRollAny && !isRollingLocal);
    }
  }, [canRollAny, isRollingLocal]);

  // Zar değerleri atış dışındayken güncellendiğinde statik yüzleri hizala
  useEffect(() => {
    if (
      managerRef.current &&
      !managerRef.current.isRolling &&
      !isRollingLocal &&
      currentRollKey === lastRollKeyRef.current &&
      gameState?.dice
    ) {
      managerRef.current.setDiceFaces(gameState.dice[0], gameState.dice[1]);
    }
  }, [gameState?.dice?.[0], gameState?.dice?.[1], currentRollKey, isRollingLocal]);

  // İlk mount anındaki mevcut rollKey (F5 sayfa yenilemesinde eski geçmiş atışı tekrar oynatmamak için)
  const initialRollKeyRef = useRef(currentRollKey);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  // Uzak/bot atışlarını ve yeni autoroll/roll_again atışlarını göster.
  useEffect(() => {
    if (!currentRollKey) return;

    const isOldHistoricalRoll =
      !hasMountedRef.current &&
      currentRollKey === initialRollKeyRef.current &&
      gameState?.phase !== 'WAITING_ROLL' &&
      (gameState?.roundNumber > 1 || (gameState?.logs && gameState.logs.filter((l) => l.type === 'dice').length > 1));

    if (isOldHistoricalRoll) {
      lastRollKeyRef.current = currentRollKey;
      return;
    }

    if (currentRollKey !== lastRollKeyRef.current) {
      lastRollKeyRef.current = currentRollKey;

      if (localRollTimeoutRef.current) {
        clearTimeout(localRollTimeoutRef.current);
        localRollTimeoutRef.current = null;
      }

      const target = gameState?.dice || [1, 1];
      const toss = gameState?.diceToss || null;

      // Zarlar yuvarlanırken yerel durumu kilitle ve önceki toplamı temizle
      isRollingLocalRef.current = true;
      setIsRollingLocal(true);
      setSettledDice(null);
      onRollStart?.();

      (async () => {
        try {
          if (!managerRef.current || !isSceneReady) {
            pendingRollRef.current = { dice: target, toss };
            await new Promise(resolve => setTimeout(resolve, 1400));
          } else {
            await managerRef.current.rollDice(target, toss);
          }
        } catch (err) {
          console.warn('[DiceSidebarTray] Roll error:', err);
        } finally {
          // Yalnızca Promise bittiğinde (zarlar tamamen durduğunda):
          isRollingLocalRef.current = false;
          setIsRollingLocal(false);
          setSettledDice(target);
          onRollSettled?.(target, target[0] + target[1], target[0] === target[1]);
        }
      })();
    }
  }, [currentRollKey, isSceneReady, myPlayerId, activePlayer?.id, gameState?.dice, gameState?.diceToss]);

  const handleManualRoll = () => {
    if (!canRollAny || isRollingLocalRef.current || gameState?.isPaused) return;

    // Çift çağrıyı ve spam tıklamaları anında engelle
    isRollingLocalRef.current = true;
    setIsRollingLocal(true);
    setSettledDice(null);
    onRollStart?.();

    if (localRollTimeoutRef.current) {
      clearTimeout(localRollTimeoutRef.current);
    }
    // Emniyet zaman aşımı: sunucudan yanıt gelmezse kilidi serbest bırak
    localRollTimeoutRef.current = setTimeout(() => {
      isRollingLocalRef.current = false;
      setIsRollingLocal(false);
    }, 6000);

    // Sunucuya gecikmesiz, anında zar atma isteği gönder (tüm oyuncularla 100% senkron)
    if (isRollAgain) {
      if (onRollAgain) {
        onRollAgain();
      } else {
        onRollDice?.();
      }
    } else {
      onRollDice?.();
    }
  };
  handleManualRollRef.current = handleManualRoll;

  return (
    <div className="w-full h-full max-h-full flex flex-col gap-2 min-h-0">
      {/* ÜST BAŞLIK BARI: Oda Kodu, Ses, Ayrıl & Kontroller (Logo ve Başlık Talebe Göre Kaldırıldı) */}
      <div className="relative z-40 cardstock-panel rounded-2xl p-2 sm:p-2.5 flex items-center justify-between gap-1.5 shadow-md flex-shrink-0 text-slate-900 dark:text-slate-100 tile-paper-press">
        <div className="flex items-center gap-1.5 min-w-0">
          {roomCode ? (
            <button
              onClick={onCopyLink}
              className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-200 transition shadow-xs cursor-pointer"
              title="Oda Davet Linkini Kopyala"
            >
              <span className="font-mono text-amber-700 dark:text-amber-400 font-bold font-jetbrains">{roomCode}</span>
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          ) : <div />}

          {/* Canlı İzleyici Sayısı Rozeti */}
          {(gameState?.spectatorCount > 0 || isSpectator) && (
            <div
              className="flex items-center gap-1 bg-sky-50 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800/80 px-2 py-1 rounded-xl text-[11px] sm:text-xs font-bold text-sky-700 dark:text-sky-300 shadow-xs backdrop-blur-sm animate-fadeIn"
              title={`${gameState?.spectatorCount || 1} izleyici maçı canlı izliyor`}
            >
              <Eye className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 animate-pulse" />
              <span className="font-jetbrains font-black">: {gameState?.spectatorCount || 1}</span>
            </div>
          )}
        </div>

        {/* Oda Kodu, Karanlık Mod, Ses, Ayrıl */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {/* 🌙 / ☀️ Karanlık Mod Değiştirici Buton */}
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Aydınlık Moda Geç' : 'Karanlık Moda Geç (Koyu Tahta & Göz Yormayan Gece Modu)'}
            className={`p-1.5 rounded-xl border transition cursor-pointer shadow-xs flex items-center justify-center ${
              isDarkMode
                ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/70 text-amber-300'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
            }`}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
          </button>

          {/* 🔊 Ses Ayarı & Slider Popover */}
          <div className="relative z-50" ref={volumeMenuRef}>
            <button
              onClick={() => setShowVolumeSlider(prev => !prev)}
              title={showVolumeSlider ? undefined : (volume === 0 ? 'Ses Kapalı (Ayar için tıkla)' : `Ses Seviyesi: %${Math.round(volume * 100)} (Ayar için tıkla)`)}
              className={`p-1.5 rounded-xl border transition cursor-pointer shadow-xs flex items-center justify-center ${
                showVolumeSlider
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 ring-2 ring-amber-400/40'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
            </button>

            {/* Ses Seviyesi Slider Balonu */}
            {showVolumeSlider && (
              <div className="absolute right-0 top-full mt-2 z-50 w-52 p-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-amber-400/80 dark:border-amber-500/80 shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-fadeIn flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-[10.5px] font-space font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    {volume === 0 ? 'Sessiz' : 'Oyun Sesi'}
                  </span>
                  <span className="font-jetbrains font-bold text-amber-500">
                    %{Math.round(volume * 100)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onVolumeToggle}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                    title={volume === 0 ? 'Sesi Aç' : 'Sessize Al'}
                  >
                    {volume === 0 ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => onVolumeChange ? onVolumeChange(parseFloat(e.target.value)) : onVolumeToggle?.()}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          {isHost && onTogglePause && (
            <button
              onClick={onTogglePause}
              title={gameState?.isPaused ? 'Oyunu Devam Ettir' : 'Oyunu Duraklat'}
              className={`p-1.5 rounded-xl border transition cursor-pointer shadow-xs flex items-center justify-center ${
                gameState?.isPaused
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold animate-pulse'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              <span className="text-xs">{gameState?.isPaused ? '▶️' : '⏸️'}</span>
            </button>
          )}

          <button
            onClick={onLeaveGame}
            className="p-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 transition shadow-xs cursor-pointer"
            title="Oyundan Ayrıl ve Lobiye Dön"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          </button>
        </div>
      </div>

      {/* 3D FİZİKSEL ZAR TABLASI (Yeşil Çuha / Casino Green Felt Arenası) */}
      <div
        className="flex-1 relative z-10 border-4 border-[#2d1b10] dark:border-[#3a2216] ring-1 ring-amber-600/35 rounded-3xl shadow-[inset_0_4px_32px_rgba(0,0,0,0.88),0_8px_20px_rgba(0,0,0,0.5)] flex flex-col min-h-0 overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at 50% 45%, #195638 0%, #103d27 50%, #072316 100%)',
        }}
      >
        {/* Üst Bilgi Rozeti (Aktif Oyuncu & Bot Atlama) */}
        <div className="absolute top-2 inset-x-2.5 z-10 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md px-2 py-0.5 rounded-xl border border-slate-800 shadow-sm">
            <div
              className="w-2.5 h-2.5 rounded-full border border-white/60 shadow-sm flex-shrink-0"
              style={{ backgroundColor: activePlayer?.color || '#cbd5e1' }}
            />
            <span className="text-[10px] font-space font-bold text-slate-200 truncate max-w-[110px]">
              {isMyTurn ? 'Senin Sıran' : activePlayer?.name || 'Sıra Bekleniyor'}
            </span>
          </div>

          {/* Süre Sayacı */}
          {gameState?.status === 'playing' && (
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-xl border text-[10px] font-jetbrains font-bold transition shadow-sm bg-slate-950/85 backdrop-blur-md ${
                gameState?.isPaused
                  ? 'border-amber-400 text-amber-300 animate-pulse'
                  : gameState?.phase === 'AUCTION'
                  ? 'border-cyan-400 text-cyan-300'
                  : secondsLeft <= 10
                  ? 'border-rose-500 text-rose-300 animate-pulse'
                  : 'border-slate-800 text-slate-300'
              }`}
              title={gameState?.isPaused ? 'Oyun duraklatıldı' : gameState?.phase === 'AUCTION' ? 'Açık artırma süresince sıra sayacı donduruldu' : 'Sıra zaman aşımı süresi'}
            >
              <Clock className="w-2.5 h-2.5 text-amber-400" />
              <span>
                {gameState?.isPaused ? '⏸️ DURDU' : gameState?.phase === 'AUCTION' ? '⏸️ İHALE' : `${secondsLeft}s`}
              </span>
            </div>
          )}

          {/* Bot Turunu Hızlı Atla Kısayolu */}
          {gameState?.status === 'playing' && activePlayer?.isBot && onFastForwardBot && (
            <button
              onClick={onFastForwardBot}
              className="flex items-center gap-1 px-2 py-0.5 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/60 text-amber-300 text-[9px] font-jetbrains font-bold transition shadow-sm cursor-pointer active:scale-95 animate-pulse"
              title="Botun turunu anında atla"
            >
              <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
              <span>Hızlı Atla</span>
            </button>
          )}
        </div>

        {/* 3D WebGL Canvas Haznesi */}
        <div
          id="dice-tray-container"
          ref={containerRef}
          className="w-full h-full flex-1 rounded-2xl overflow-hidden relative cursor-pointer"
          title={canRollAny ? (isRollAgain ? 'Çift attın! Tekrar zar atmak için tıkla veya Space tuşuna bas' : 'Zar atmak için tıkla veya Space tuşuna bas') : 'Zar Tablası'}
        />

        {/* Alt Bilgi & Eylem Alanı */}
        <div className="absolute bottom-2 inset-x-2 z-10 flex flex-col items-center gap-1 pointer-events-auto">
          {/* Toplam ve Çift Zar Durumu */}
          <div className="flex items-center gap-1.5 min-h-[28px]">
            {isRollingLocal ? (
              <div className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/80 text-amber-300 shadow-lg flex items-center gap-1.5 text-xs font-jetbrains font-bold backdrop-blur-md animate-pulse">
                <span>🎲 Zarlar Yuvarlanıyor...</span>
              </div>
            ) : displayDice ? (
              <>
                <div className="px-3 py-1 rounded-full bg-slate-950/90 border border-slate-700/80 shadow-lg flex items-center gap-1.5 text-xs font-jetbrains font-bold backdrop-blur-md animate-fadeIn">
                  <span className="text-slate-400 text-[10.5px]">Toplam:</span>
                  <span className="text-amber-400 font-extrabold text-sm">{diceTotal}</span>
                  <span className="text-slate-500 text-[9.5px]">({dice1}+{dice2})</span>
                </div>

                {isDouble && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/25 border border-amber-400/90 text-amber-300 text-[8.5px] font-space font-black uppercase tracking-wide shadow-md animate-pulse backdrop-blur-md">
                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                    <span>ÇİFT ZAR! TEKRAR ZAR AT</span>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Zar Atma Butonu */}
          {isRollingLocal ? (
            <div className="w-full py-2.5 px-3 rounded-xl bg-amber-500/30 border border-amber-400/60 text-amber-300 font-space font-extrabold text-xs sm:text-sm tracking-wide text-center animate-pulse flex items-center justify-center gap-2">
              <Dices className="w-4 h-4 animate-spin text-amber-400" />
              <span>ZARLAR YUVARLANIYOR...</span>
            </div>
          ) : isRollAgain ? (
            <button
              onClick={handleManualRoll}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:brightness-110 active:scale-95 text-slate-950 font-space font-black text-xs sm:text-sm tracking-wide border border-emerald-300 ring-4 ring-emerald-400/80 animate-dice-glow flex items-center justify-center gap-2 cursor-pointer transition-all uppercase shadow-lg shadow-emerald-500/30"
              title="Çift attın! Tekrar zar atmak için tıkla veya Space tuşuna bas"
            >
              <Dices className="w-4 h-4 text-slate-950 animate-bounce-short" />
              <Sparkles className="w-4 h-4 text-slate-950 animate-spin-slow" />
              <span>ÇİFT ATTIN! TEKRAR ZAR AT</span>
            </button>
          ) : canRoll ? (
            <button
              onClick={handleManualRoll}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:brightness-110 active:scale-95 text-slate-950 font-space font-extrabold text-xs sm:text-sm tracking-wide border border-amber-300 ring-4 ring-amber-400/80 animate-dice-glow flex items-center justify-center gap-2 cursor-pointer transition-all uppercase"
              title="Zar atmak için tıkla veya Space tuşuna bas"
            >
              <Dices className="w-4 h-4 text-slate-950 animate-bounce-short" />
              <span>ZAR AT</span>
            </button>
          ) : activePlayer?.isBot && onFastForwardBot ? (
            <button
              onClick={onFastForwardBot}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-space font-black text-xs sm:text-sm tracking-wide border border-amber-300 ring-2 ring-amber-400/80 animate-pulse flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all uppercase"
              title="Botun turunu anında tamamla ve sıradakine geç"
            >
              <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
              <span>{activePlayer?.name} Turunu Atla</span>
            </button>
          ) : (
            <div className="w-full py-2 px-2.5 rounded-xl bg-slate-950/85 border border-slate-800 text-slate-400 font-jetbrains text-[10px] text-center truncate backdrop-blur-md">
              {isMyTurn ? 'Tur hamlesi bekleniyor...' : `${activePlayer?.name || 'Oyuncu'} oynuyor...`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
