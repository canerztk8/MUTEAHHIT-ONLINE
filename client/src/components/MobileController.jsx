import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ClientPeerService } from '../network/PeerService.js';
import { Smartphone, Dice5, Volume2, Sparkles, CheckCircle, Wifi, AlertTriangle } from 'lucide-react';
import { sounds } from '../sound/soundEffects.js';

export function MobileController({ roomCode, playerId, playerName }) {
  const [connectionState, setConnectionState] = useState('connecting'); // connecting, connected, error
  const [gameState, setGameState] = useState(null);
  const [lastShakenAt, setLastShakenAt] = useState(0);
  const [shakeCount, setShakeCount] = useState(0);
  const [motionPermissionNeeded, setMotionPermissionNeeded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const peerServiceRef = useRef(null);
  const lastRollTimeRef = useRef(0);

  // 1. Odaya İstemci Olarak Bağlan
  useEffect(() => {
    if (!roomCode) {
      setConnectionState('error');
      setErrorMessage('Geçerli bir oda kodu bulunamadı.');
      return;
    }

    try {
      const service = new ClientPeerService({
        hostPeerId: roomCode,
        playerName: playerName || 'Kumanda',
        token: { id: 'controller', name: 'Kumanda' },
        color: '#f59e0b',
        onConnected: () => {
          setConnectionState('connected');
        },
        onState: (state) => {
          setGameState(state);
        },
        onError: (err) => {
          console.error('[MobileController] Hata:', err);
          setErrorMessage(err.message || 'Bağlantı hatası.');
        },
        onHostDropped: () => {
          setErrorMessage('Masaüstü bağlantısı kesildi.');
          setConnectionState('error');
        }
      });

      peerServiceRef.current = service;

      return () => {
        service.destroy();
        peerServiceRef.current = null;
      };
    } catch (e) {
      setConnectionState('error');
      setErrorMessage(e.message);
    }
  }, [roomCode, playerName]);

  // Aktif oyuncu ve zar durumu tespiti
  const activePlayer = gameState?.players?.[gameState?.currentTurnIndex];
  const effectivePlayerId = playerId || gameState?.players?.[0]?.id;
  const isMyTurn = Boolean(
    activePlayer &&
    (activePlayer.id === effectivePlayerId || activePlayer.name === playerName) &&
    gameState?.phase === 'WAITING_ROLL'
  );

  // Zar Atma Eylemi
  const triggerRoll = useCallback(() => {
    const now = Date.now();
    if (now - lastRollTimeRef.current < 1500) return;
    lastRollTimeRef.current = now;

    // Dokunsal Titreşim (Haptic Feedback)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 60, 120]);
    }

    // Ses efekti
    sounds.playDice();

    // Servise zar atma komutu ilet
    if (peerServiceRef.current) {
      peerServiceRef.current.sendAction('ROLL_DICE', {
        forPlayerId: effectivePlayerId,
        playerId: effectivePlayerId
      });
    }
  }, [effectivePlayerId]);

  // 2. HTML5 DeviceMotionEvent (Jiroskop / İvmeölçer Dinleyicisi)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // iOS 13+ izin kontrolü
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      setMotionPermissionNeeded(true);
    }

    let lastX = null, lastY = null, lastZ = null;
    let lastTime = Date.now();

    const handleMotion = (event) => {
      const current = event.accelerationIncludingGravity || event.acceleration;
      if (!current) return;

      const currentTime = Date.now();
      const diffTime = currentTime - lastTime;
      if (diffTime < 100) return; // 100ms debouncing

      const x = current.x || 0;
      const y = current.y || 0;
      const z = current.z || 0;

      if (lastX !== null && lastY !== null && lastZ !== null) {
        const deltaX = Math.abs(x - lastX);
        const deltaY = Math.abs(y - lastY);
        const deltaZ = Math.abs(z - lastZ);
        const totalDelta = deltaX + deltaY + deltaZ;

        // Sallama eşik değeri (17 birim üzeri ani hızlanma)
        if (totalDelta > 17) {
          setLastShakenAt(currentTime);
          setShakeCount(prev => prev + 1);

          if (isMyTurn) {
            triggerRoll();
          }
        }
      }

      lastX = x;
      lastY = y;
      lastZ = z;
      lastTime = currentTime;
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [isMyTurn, triggerRoll]);

  const requestMotionPermission = async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        if (response === 'granted') {
          setMotionPermissionNeeded(false);
        }
      } catch (e) {
        console.error('İvmeölçer izin hatası:', e);
      }
    }
  };

  const isRecentShake = Date.now() - lastShakenAt < 500;

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-100 flex flex-col justify-between p-5 select-none overflow-hidden touch-none font-sans">
      
      {/* Üst Bilgi Başlığı */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-xl">
            🎲
          </div>
          <div>
            <h1 className="text-sm font-black font-space tracking-tight text-white leading-none">
              MÜTEAHHİT KUMANDASI
            </h1>
            <span className="text-[10px] text-slate-400 font-jetbrains">
              ODA: <strong className="text-amber-400">{roomCode}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-jetbrains">
          {connectionState === 'connected' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-bold text-[10px]">BAĞLI</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-amber-400 font-bold text-[10px]">BAĞLANIYOR</span>
            </>
          )}
        </div>
      </div>

      {/* iOS İzin Butonu (Gerekirse) */}
      {motionPermissionNeeded && (
        <div className="my-2 p-3 bg-amber-950/60 border border-amber-500/60 rounded-2xl flex items-center justify-between">
          <span className="text-xs text-amber-200 font-medium">Sallama sensörünü aç:</span>
          <button
            onClick={requestMotionPermission}
            className="px-3 py-1 bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer"
          >
            İzin Ver
          </button>
        </div>
      )}

      {/* Merkez Alan: Canlı Zar Bardağı & Sallama Hissi */}
      <div className="flex-1 flex flex-col items-center justify-center text-center my-4 relative">
        
        {/* Durum Rozeti */}
        <div className="mb-6">
          {isMyTurn ? (
            <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500/30 via-emerald-600/20 to-teal-500/30 border-2 border-emerald-400 text-emerald-300 font-black font-space text-sm tracking-wide shadow-[0_0_25px_rgba(16,185,129,0.4)] animate-bounce">
              ⚡ SIRA SENDE! TELEFONU SALLA
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 font-medium text-xs">
              {activePlayer ? `Sıra: ${activePlayer.name} bekleniyor...` : 'Oyun bekleniyor...'}
            </div>
          )}
        </div>

        {/* 3D Dokunsal Zar Bardağı Dairesi */}
        <div
          onClick={() => {
            if (isMyTurn) triggerRoll();
          }}
          className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
            isMyTurn
              ? 'bg-gradient-to-br from-amber-500/30 via-amber-600/15 to-slate-900 border-amber-400 shadow-[0_0_60px_rgba(245,158,11,0.5)] active:scale-95'
              : 'bg-slate-900/60 border-slate-800 shadow-inner opacity-75'
          } ${isRecentShake ? 'scale-110 rotate-6 border-rose-400' : ''}`}
        >
          {/* İç Daire & İkon */}
          <div className="w-24 h-24 rounded-full bg-slate-950/80 border border-amber-400/40 flex items-center justify-center text-5xl shadow-2xl mb-2">
            {isRecentShake ? '💥' : '🎲'}
          </div>

          <span className={`text-xs font-black font-space uppercase tracking-widest ${
            isMyTurn ? 'text-amber-300 drop-shadow' : 'text-slate-500'
          }`}>
            {isMyTurn ? 'ZARLARI FIRLAT' : 'BEKLEMEDE'}
          </span>
          <span className="text-[9px] text-slate-400 mt-0.5">
            {isMyTurn ? 'Telefonu salla veya tıkla' : 'Masada sıra bekleniyor'}
          </span>
        </div>

        {/* Son Zar Sonucu (Varsa) */}
        {gameState?.dice && (
          <div className="mt-6 flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-2xl">
            <span className="text-xs text-slate-400 font-jetbrains">Son Atılan:</span>
            <span className="text-lg font-black text-amber-400 font-mono">
              [{gameState.dice[0]}] + [{gameState.dice[1]}] = {gameState.dice[0] + gameState.dice[1]}
            </span>
          </div>
        )}
      </div>

      {/* Alt Buton ve Canlı İpucu */}
      <div className="w-full">
        {isMyTurn ? (
          <button
            onClick={triggerRoll}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black text-base uppercase tracking-wider shadow-[0_10px_30px_rgba(245,158,11,0.4)] active:scale-98 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Dice5 className="w-6 h-6 animate-spin" />
            <span>ZARLARI MASAYA SAVUR!</span>
          </button>
        ) : (
          <div className="text-center py-2 text-[11px] text-slate-500 italic">
            Masadaki oyunu izleyin; sıranız geldiğinde telefonunuz titreyecektir.
          </div>
        )}
      </div>
    </div>
  );
}
