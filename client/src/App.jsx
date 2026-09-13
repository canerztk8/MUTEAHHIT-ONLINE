import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { HostPeerService, ClientPeerService } from './network/PeerService.js';
import { ACTION } from './network/protocol.js';
import { BOARD_TILES } from './game/boardData.js';
import { Lobby } from './components/Lobby.jsx';
import { Board } from './components/Board.jsx';
import { ActionControls } from './components/ActionControls.jsx';
import { PlayerPanel } from './components/PlayerPanel.jsx';
import { ChatAndLog } from './components/ChatAndLog.jsx';
import { TitleDeedCards } from './components/TitleDeedCards.jsx';
import { DiceSidebarTray } from './components/DiceSidebarTray.jsx';
import { MobileTopPlayerBar } from './components/MobileTopPlayerBar.jsx';
import { MobileBottomActionBar } from './components/MobileBottomActionBar.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';

// 🚀 Modallar — Dinamik code-splitting ile ana bundle yükü hafifletilir
const PropertyCardModal = lazy(() => import('./components/PropertyCardModal.jsx').then(m => ({ default: m.PropertyCardModal })));
const TradeModal = lazy(() => import('./components/TradeModal.jsx').then(m => ({ default: m.TradeModal })));
const WinnerModal = lazy(() => import('./components/WinnerModal.jsx').then(m => ({ default: m.WinnerModal })));
const EliminationModal = lazy(() => import('./components/EliminationModal.jsx').then(m => ({ default: m.EliminationModal })));
const DevToolsModal = lazy(() => import('./components/DevToolsModal.jsx').then(m => ({ default: m.DevToolsModal })));
import { sounds } from './sound/soundEffects.js';
import { Volume2, VolumeX, Copy, Check, Users, Sparkles, LogOut, Wrench, Sun, Moon, X, Wifi, Landmark, MessageSquare } from 'lucide-react';

// 🃏 Son 3 Çekilen Kart Geçmişi Modalı (Deste kartına tıklanınca açılır)
function CardHistoryModal({ deckType, logs, onClose }) {
  const isChance = deckType === 'chance';
  const deckName = isChance ? 'İhale & Fırsat' : 'Belediye & İmar';
  const icon = isChance ? '📜' : '🏛️';
  const accentColor = isChance ? 'bg-amber-500' : 'bg-emerald-700';
  const badgeColor = isChance ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
  const highlightBg = isChance
    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700'
    : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-700';

  // Loglardan son 3 kart çekimini filtrele (hem meta field hem text fallback destekli)
  const cardLogs = (logs || [])
    .filter(l => {
      if (l.type === 'card') {
        if (l.deckType) return l.deckType === deckType;
        const txt = (l.text || '').toLowerCase();
        if (isChance) {
          return txt.includes('ihale') || txt.includes('fırsat') || txt.includes('firsat') || (!txt.includes('belediye') && !txt.includes('imar'));
        } else {
          return txt.includes('belediye') || txt.includes('imar');
        }
      }
      return false;
    })
    .map(l => {
      const rawText = (l.text || '').replace(/<[^>]+>/g, '').trim();
      const titleMatch = rawText.match(/"([^"]+)"/);
      const descMatch = rawText.match(/(?:açtı|çekti|çekiyor)\s*[:\-–]\s*(.+)$/);
      const drawerMatch = rawText.match(/^[📜\s]*([^\s"]+(?:\s+[^\s"]+)*?)\s+(?:bir|"|kartı|kartını)/);
      return {
        ...l,
        cardTitle: l.cardTitle || (titleMatch ? titleMatch[1] : rawText),
        cardDesc: l.cardDesc || (descMatch ? descMatch[1].trim() : ''),
        drawerName: l.drawerName || (drawerMatch ? drawerMatch[1].trim() : '')
      };
    })
    .slice(-3)
    .reverse();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fadeIn"
        onClick={e => e.stopPropagation()}
      >
        {/* Başlık */}
        <div className={`flex items-center justify-between px-4 py-3 ${accentColor}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/80 font-space">Son Çekilen Kartlar</p>
              <h3 className="text-sm font-black text-white font-space">{deckName}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Kart Listesi */}
        <div className="p-3 flex flex-col gap-2 max-h-72 overflow-y-auto custom-scrollbar">
          {cardLogs.length === 0 ? (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-6 font-jetbrains">
              Henüz bu desteden kart açılmadı.
            </p>
          ) : (
            cardLogs.map((log, i) => (
              <div
                key={log.id || i}
                className={`rounded-xl p-2.5 border ${i === 0 ? highlightBg : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  {i === 0 && (
                    <span className={`text-[9px] font-black uppercase tracking-wider ${badgeColor} font-space`}>En Son</span>
                  )}
                  {log.drawerName && (
                    <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 font-jetbrains">
                      {i > 0 && '· '}{log.drawerName}
                    </span>
                  )}
                </div>
                <p className="text-xs font-black text-slate-800 dark:text-slate-100 font-space leading-tight">{log.cardTitle}</p>
                {log.cardDesc && (
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium font-jetbrains leading-snug mt-0.5">{log.cardDesc}</p>
                )}
              </div>
            ))
          )}
        </div>
        <div className="px-4 pb-3 pt-0.5">
          <p className="text-[9.5px] text-center text-slate-400 dark:text-slate-600 font-jetbrains">
            {cardLogs.length > 0 ? `Son ${cardLogs.length} çekim gösteriliyor` : 'Kart geçmişi boş'}
          </p>
        </div>
      </div>
    </div>
  );
}



function AnitkabirBackground({ isDarkMode }) {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none">
      <img
        src="/images/francesca-minto-NdsCWVfkUu0-unsplash.webp"
        alt="Ankara Anıtkabir Arka Planı"
        className={`w-full h-full object-cover object-[center_32%] transition-all duration-700 ease-out scale-105 ${
          isDarkMode
            ? 'brightness-[0.62] contrast-[1.18] saturate-[0.90]'
            : 'brightness-[0.96] contrast-[1.02] saturate-[1.04]'
        }`}
      />
      {/* Aydınlık mod yumuşak atmosferik tül */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isDarkMode
            ? 'opacity-0'
            : 'opacity-100 bg-gradient-to-b from-white/60 via-slate-50/40 to-amber-50/65 backdrop-blur-[1px]'
        }`}
      />
      {/* Karanlık mod sinematik gece tülü */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isDarkMode
            ? 'opacity-100 bg-gradient-to-b from-[#020617]/75 via-slate-950/60 to-[#020617]/85 backdrop-blur-[1px]'
            : 'opacity-0'
        }`}
      />
      {/* Çevresel gölge / vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.38)_100%)] pointer-events-none" />
    </div>
  );
}

export function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const themeParam = urlParams.get('theme');
      if (themeParam === 'dark') return true;
      if (themeParam === 'light') return false;
      const saved = localStorage.getItem('muteahhit_dark_mode');
      if (saved !== null) return saved === '1';
      return false;
    } catch {
      return false;
    }
  });

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('muteahhit_dark_mode', next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {}
  }, [isDarkMode]);

  // ⚡ Yüksek Performans Kalıcı Ana Mod (Her zaman devrede, 60 FPS akıcılık)
  const isPerformanceMode = true;
  useEffect(() => {
    try {
      localStorage.removeItem('muteahhit_perf_mode');
      document.documentElement.classList.add('perf-mode');
    } catch {}
  }, []);

  // 🚀 Render Backend Pre-Warm (Erken Uyandırma)
  // Sayfa açıldığı anda backend'e arka planda sessizce bir GET isteği atarak
  // Render uyku modundaysa oyuncu lobideyken uyanmasını sağlar.
  useEffect(() => {
    const backendHost = import.meta.env.VITE_PEER_HOST || 'muteahhit-online-backend.onrender.com';
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!isLocal && backendHost) {
      const url = `https://${backendHost}/api/health`;
      fetch(url, { mode: 'cors', cache: 'no-store' })
        .then(res => res.json())
        .then(() => console.log('[Network] Backend erken uyandırma sinyali başarılı (Pre-warm OK).'))
        .catch(() => {
          setTimeout(() => {
            fetch(url, { mode: 'cors', cache: 'no-store' }).catch(() => {});
          }, 3500);
        });
    }
  }, []);

  // ─── P2P Ağ Durumu ─────────────────────────────────────────────────────────
  /** @type {[HostPeerService|ClientPeerService|null, function]} */
  const [network, setNetwork] = useState(null);
  const networkRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [peerError, setPeerError] = useState(null);
  const [ping, setPing] = useState(null);
  const [showPingTable, setShowPingTable] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const myPlayerIdRef = useRef(null);
  const [isSpectatorMode, setIsSpectatorMode] = useState(false);
  // Davet linki ile açıldığında oda mevcut değilse gösterilecek ekran için
  const [roomNotFound, setRoomNotFound] = useState(null); // null | { code: string }

  const formatPeerError = (err) => {
    if (!err) return null;
    const type = err.type || (typeof err === 'string' ? err : '');
    const msg = err.message || (typeof err === 'string' ? err : '');
    if (type === 'peer-unavailable') {
      return 'Oda bulunamadı. Lütfen oda kodunu kontrol edin veya yeni bir oda açın.';
    }
    if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'relay-error') {
      return 'Sunucu bağlantısı kurulamadı. Lütfen sayfayı yenileyin.';
    }
    if (type === 'error' || type === 'webrtc') {
      return 'Ağ bağlantısı kurulamadı. Lütfen tekrar deneyin.';
    }
    if (type === 'HOST_DROPPED') {
      return 'Host bağlantısı koptu. Oyun sona erdi.';
    }
    return msg || type || 'Bağlantı hatası oluştu.';
  };

  useEffect(() => {
    myPlayerIdRef.current = myPlayerId;
  }, [myPlayerId]);

  const [gameState, setGameState] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [showDevTools, setShowDevTools] = useState(false);
  const [devToolsUnlocked, setDevToolsUnlocked] = useState(() => {
    try {
      return localStorage.getItem('vechiron_devtools_unlocked') === '1';
    } catch {
      return false;
    }
  });
  const [selectedTileModal, setSelectedTileModal] = useState(null);
  const [cardHistoryModal, setCardHistoryModal] = useState(null); // { deckType: 'chance'|'chest' }

  const [tradeTargetPlayer, setTradeTargetPlayer] = useState(null);
  const [tradeInitialPropId, setTradeInitialPropId] = useState(null);
  const [tradeInitialPrice, setTradeInitialPrice] = useState(0);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [volume, setVolumeState] = useState(() => {
    const saved = localStorage.getItem('muteahhit_vol');
    return saved !== null ? Number(saved) : 0.6;
  });

  const handleVolumeChange = (newVal) => {
    const val = Math.max(0, Math.min(1, newVal));
    setVolumeState(val);
    sounds.setVolume(val);
    localStorage.setItem('muteahhit_vol', val);
  };

  // Önceki durumu saklayarak ses tetikleme
  const prevStateRef = useRef(null);
  // Zafer sesinin hangi winner ID için çalındığını takip eder — çift ses önlemi
  const victoryPlayedForRef = useRef(null);

  // Bekleyen Para Değişimi Referansı (Piyon hedef kareye varmadan para sesini/bildirimini çalma!)
  const pendingMoneyRef = useRef(null);
  const pendingMoneyTimeoutRef = useRef(null);
  const [moneyToast, setMoneyToast] = useState(null);

  // İflas ve Elenme Ekranı Takibi
  const [activeElimination, setActiveElimination] = useState(null);
  const lastSeenEliminationIdRef = useRef(null);

  useEffect(() => {
    if (gameState?.lastElimination && gameState.lastElimination.id !== lastSeenEliminationIdRef.current) {
      lastSeenEliminationIdRef.current = gameState.lastElimination.id;
      setActiveElimination(gameState.lastElimination);
    }
  }, [gameState?.lastElimination]);

  useEffect(() => {
    if (gameState?.status === 'lobby') {
      setActiveElimination(null);
      lastSeenEliminationIdRef.current = null;
      victoryPlayedForRef.current = null;
    }
  }, [gameState?.status]);

  // Sol alt bakiye kartı → Para geçmişi modalı
  const [showMyMoneyHistory, setShowMyMoneyHistory] = useState(false);
  const myMoneyHistoryRef = useRef([]); // [{delta, reason, time, balance}]
  const prevMyMoneyRef = useRef(null);
  const pawnMovingSafetyTimeoutRef = useRef(null);

  // Sol alt kart: tüm para değişimlerini yakala (kart, kira, hediye, ihale vs.)
  useEffect(() => {
    if (!gameState?.players || !myPlayerId) return;
    const myP = gameState.players.find(p => p.id === myPlayerId);
    if (!myP) return;

    const prev = prevMyMoneyRef.current;
    prevMyMoneyRef.current = myP.money;
    if (prev === null || prev === myP.money) return;

    const diff = myP.money - prev;
    if (diff === 0) return;

    const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logs = gameState?.logs || [];
    const recentLog = logs.length > 0
      ? [...logs].reverse().find(l => l.text && l.text.includes(myP.name))
      : null;
    const reason = recentLog
      ? recentLog.text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 100)
      : diff > 0 ? 'Para girişi' : 'Para çıkışı';

    myMoneyHistoryRef.current.push({ delta: diff, reason, time: now, balance: myP.money });
    if (myMoneyHistoryRef.current.length > 30) myMoneyHistoryRef.current.shift();
  }, [gameState?.players, myPlayerId]);

  // 3D Zar Tablasında Zarların Yuvarlanma / Durulma Durumu (Erken UI güncellemesini ve erken piyon adımını önler)
  const [isDiceRolling, setIsDiceRolling] = useState(false);
  // Piyonun tahtada kare kare yürüme durumu (Erken bakiye, kart, kira ve tapu tetiklenmesini önler)
  const [isPawnMoving, setIsPawnMoving] = useState(false);
  const isPawnMovingRef = useRef(false);
  isPawnMovingRef.current = isPawnMoving;
  const latestStateRef = useRef(null);

  useEffect(() => {
    if (gameState?.status === 'lobby' || gameState?.status === 'ended') {
      setIsDiceRolling(false);
      setIsPawnMoving(false);
      isPawnMovingRef.current = false;
    }
  }, [gameState?.status]);

  // Oyuncu bakiyelerinin piyon kareye varmadan erken değişmesini önleyen tamponlama
  const [displayedBalances, setDisplayedBalances] = useState({});
  const pendingBalancesRef = useRef({});
  const prevPlayerPositionsRef = useRef({});

  // Oyuncu kodes durumunun ve konumunun piyon kareye varmadan erken ifşa olmasını önleyen tamponlama
  const [displayedJailStatus, setDisplayedJailStatus] = useState({});
  const pendingJailStatusRef = useRef({});
  const [displayedPlayerPositions, setDisplayedPlayerPositions] = useState({});
  const pendingPlayerPositionsRef = useRef({});

  // Olay günlüğünün piyon kareye varmadan erken ifşa olmasını önleyen tamponlama
  const [displayedLogs, setDisplayedLogs] = useState([]);
  const pendingLogsRef = useRef(null);
  const pendingLogsTimeoutRef = useRef(null);

  // Mobil Çekmece / Modal Menüsü (null | 'deeds' | 'chat')
  const [mobileDrawer, setMobileDrawer] = useState(null);
  const [lastReadChatCount, setLastReadChatCount] = useState(0);

  useEffect(() => {
    if (mobileDrawer === 'chat') {
      setLastReadChatCount(chatMessages?.length || 0);
    }
  }, [chatMessages, mobileDrawer]);

  // Görünen bakiyelerle ve görsel durumlarla zenginleştirilmiş oyun durumu (Piyon adımlarken bakiye, kodes ve konumu eski değerde tutar)
  const effectiveGameState = React.useMemo(() => {
    if (!gameState || !gameState.players) return gameState;
    return {
      ...gameState,
      players: gameState.players.map((p) => ({
        ...p,
        money: displayedBalances[p.id] !== undefined ? displayedBalances[p.id] : p.money,
        inJail: displayedJailStatus[p.id] !== undefined ? displayedJailStatus[p.id] : p.inJail,
        jailTurns: (displayedJailStatus[p.id] !== undefined && !displayedJailStatus[p.id]) ? 0 : p.jailTurns,
        position: displayedPlayerPositions[p.id] !== undefined ? displayedPlayerPositions[p.id] : p.position
      }))
    };
  }, [gameState, displayedBalances, displayedJailStatus, displayedPlayerPositions]);

  // Yerel oyuncu ve üzerinde bulunduğu kare (F5 ve oda geçişlerinde kesintisiz eşleşme kalkanı)
  const savedPlayerName = typeof localStorage !== 'undefined' ? localStorage.getItem('muteahhit_name') : null;
  const savedSessionToken = typeof localStorage !== 'undefined' ? localStorage.getItem('muteahhit_session_token') : null;

  const matchedPlayer = effectiveGameState?.players?.find(p => !p.isBot && (
    (myPlayerId && p.id === myPlayerId) ||
    (savedPlayerName && p.name === savedPlayerName)
  )) || null;

  // FIX: matchedPlayer bulunduğunda isSpectatorMode'u sıfırla —
  // F5 sonrası reconnect esnasında "oyuncu yok" geçici durumunun izleyici moduna kilitlenmesini önler
  useEffect(() => {
    if (matchedPlayer && isSpectatorMode) {
      setIsSpectatorMode(false);
    }
  }, [matchedPlayer?.id, isSpectatorMode]);

  const isSpectator = Boolean(
    isSpectatorMode ||
    network?.isSpectator ||
    (effectiveGameState?.status === 'playing' && !matchedPlayer)
  );
  const myPlayer = isSpectator ? null : matchedPlayer;
  const effectiveMyPlayerId = myPlayer?.id || myPlayerId;
  const isHost = Boolean(myPlayer?.isHost);

  useEffect(() => {
    if (myPlayer?.id && myPlayerId !== myPlayer.id) {
      setMyPlayerId(myPlayer.id);
      myPlayerIdRef.current = myPlayer.id;
    }
  }, [myPlayer?.id, myPlayerId]);

  useEffect(() => {
    if (moneyToast) {
      const timer = setTimeout(() => {
        setMoneyToast(null);
      }, 2600);
      return () => clearTimeout(timer);
    }
  }, [moneyToast?.key]);

  // Piyon hedefe ulaştığında bekleyen para bildirimini ve bakiyeleri senkronize tetikle
  const handlePawnLanded = (playerId, targetPos) => {
    setIsPawnMoving(false);
    isPawnMovingRef.current = false;
    setIsDiceRolling(false);

    if (pawnMovingSafetyTimeoutRef.current) {
      clearTimeout(pawnMovingSafetyTimeoutRef.current);
      pawnMovingSafetyTimeoutRef.current = null;
    }

    if (pendingMoneyTimeoutRef.current) {
      clearTimeout(pendingMoneyTimeoutRef.current);
      pendingMoneyTimeoutRef.current = null;
    }
    if (pendingMoneyRef.current !== null) {
      const diff = pendingMoneyRef.current;
      pendingMoneyRef.current = null;
      if (diff > 0) {
        sounds.playMoneyIn();
        setMoneyToast({ amount: diff, type: 'in', key: Date.now() });
      } else if (diff < 0) {
        sounds.playMoneyOut();
        setMoneyToast({ amount: Math.abs(diff), type: 'out', key: Date.now() });
      }
    }

    // Bekleyen olay günlüklerini derhal serbest bırak
    if (pendingLogsTimeoutRef.current) {
      clearTimeout(pendingLogsTimeoutRef.current);
      pendingLogsTimeoutRef.current = null;
    }
    const currentLogs = latestStateRef.current?.logs || pendingLogsRef.current;
    if (currentLogs) {
      setDisplayedLogs(currentLogs);
    }
    pendingLogsRef.current = null;

    // Piyon hedefe ulaştı: bekleyen TÜM oyuncu bakiyelerini, kodes durumunu ve pozisyonları aynı anda ekrana yansıt
    setDisplayedBalances((prev) => {
      const next = { ...prev };
      const currentPlayers = latestStateRef.current?.players || gameState?.players || [];
      currentPlayers.forEach((p) => {
        next[p.id] = p.money;
        delete pendingBalancesRef.current[p.id];
      });
      return next;
    });

    setDisplayedJailStatus((prev) => {
      const next = { ...prev };
      const currentPlayers = latestStateRef.current?.players || gameState?.players || [];
      currentPlayers.forEach((p) => {
        next[p.id] = p.inJail;
        delete pendingJailStatusRef.current[p.id];
      });
      return next;
    });

    setDisplayedPlayerPositions((prev) => {
      const next = { ...prev };
      const currentPlayers = latestStateRef.current?.players || gameState?.players || [];
      currentPlayers.forEach((p) => {
        next[p.id] = p.position;
        delete pendingPlayerPositionsRef.current[p.id];
      });
      return next;
    });
  };

  // ─── P2P State Callback (Host ve Client tarafından paylaşılır) ───────────────
  // Bu callback, gelen her game_state güncellemesini işler.
  // useCallback ile sadeleştirildi (stale closure önlemi için ref'ler kullanılıyor).
  const handleIncomingState = useCallback((state) => {
    latestStateRef.current = state;
    const prev = prevStateRef.current;
    const currentPid = myPlayerIdRef.current;

    const hasPawnMoved = Boolean(
      prev &&
      state.players?.some((p) => {
        const oldP = prev.players?.find((op) => op.id === p.id);
        return oldP && oldP.position !== p.position;
      })
    );

    // Yeni zar atışı tespiti (Bot veya uzak oyuncu attığında da isDiceRolling ve isPawnMoving derhal true yapılarak erken piyon yürüyüşü ve erken bakiye/kart açılması engellenir)
    const isNewDiceRoll = Boolean(
      prev &&
      state.lastDiceRollId &&
      state.lastDiceRollId !== prev.lastDiceRollId
    );
    const flushVisualStateOnSafetyTimeout = () => {
      setIsPawnMoving(false);
      isPawnMovingRef.current = false;
      setIsDiceRolling(false);
      const curPlayers = latestStateRef.current?.players || [];
      if (curPlayers.length > 0) {
        setDisplayedBalances((prev) => {
          const next = { ...prev };
          curPlayers.forEach((p) => { next[p.id] = p.money; });
          return next;
        });
        setDisplayedJailStatus((prev) => {
          const next = { ...prev };
          curPlayers.forEach((p) => { next[p.id] = p.inJail; });
          return next;
        });
        setDisplayedPlayerPositions((prev) => {
          const next = { ...prev };
          curPlayers.forEach((p) => { next[p.id] = p.position; });
          return next;
        });
      }
    };

    if (isNewDiceRoll && state.status === 'playing') {
      setIsDiceRolling(true);
      setIsPawnMoving(true);
      isPawnMovingRef.current = true;
      if (pawnMovingSafetyTimeoutRef.current) clearTimeout(pawnMovingSafetyTimeoutRef.current);
      pawnMovingSafetyTimeoutRef.current = setTimeout(flushVisualStateOnSafetyTimeout, 4200);
    } else if (hasPawnMoved && state.status === 'playing') {
      setIsPawnMoving(true);
      isPawnMovingRef.current = true;
      if (pawnMovingSafetyTimeoutRef.current) clearTimeout(pawnMovingSafetyTimeoutRef.current);
      pawnMovingSafetyTimeoutRef.current = setTimeout(flushVisualStateOnSafetyTimeout, 4200);
    } else if ((state.phase === 'TURN_ACTIONS' || state.phase === 'TILE_ACTION' || state.phase === 'WAITING_ROLL') && !hasPawnMoved && !isNewDiceRoll) {
      setIsPawnMoving(false);
      isPawnMovingRef.current = false;
      setIsDiceRolling(false);
      if (pawnMovingSafetyTimeoutRef.current) {
        clearTimeout(pawnMovingSafetyTimeoutRef.current);
        pawnMovingSafetyTimeoutRef.current = null;
      }
      if (state.players && state.players.length > 0) {
        setDisplayedBalances((prev) => {
          const next = { ...prev };
          state.players.forEach((p) => {
            delete pendingBalancesRef.current[p.id];
            next[p.id] = p.money;
          });
          return next;
        });
        setDisplayedJailStatus((prev) => {
          const next = { ...prev };
          state.players.forEach((p) => {
            next[p.id] = p.inJail;
          });
          return next;
        });
        setDisplayedPlayerPositions((prev) => {
          const next = { ...prev };
          state.players.forEach((p) => {
            delete pendingPlayerPositionsRef.current[p.id];
            next[p.id] = p.position;
          });
          return next;
        });
      }
    }

    const isMovementTurnInProgress = hasPawnMoved || isNewDiceRoll || isPawnMovingRef.current;

    // Olay günlüğü tamponlama: Piyon yürürken varış/kira/kart spoilerlarını engelle
    if (isMovementTurnInProgress && state.logs && state.logs.length > 0) {
      let lastDiceIdx = -1;
      for (let i = state.logs.length - 1; i >= 0; i--) {
        if (state.logs[i].type === 'dice') {
          lastDiceIdx = i;
          break;
        }
      }
      pendingLogsRef.current = state.logs;
      if (pendingLogsTimeoutRef.current) clearTimeout(pendingLogsTimeoutRef.current);
      pendingLogsTimeoutRef.current = setTimeout(() => {
        const targetLogs = latestStateRef.current?.logs || pendingLogsRef.current;
        if (targetLogs) {
          setDisplayedLogs(targetLogs);
        }
        pendingLogsRef.current = null;
      }, 2200);

      if (lastDiceIdx !== -1) {
        setDisplayedLogs(state.logs.slice(0, lastDiceIdx + 1));
      }
    } else {
      if (pendingLogsTimeoutRef.current) {
        clearTimeout(pendingLogsTimeoutRef.current);
        pendingLogsTimeoutRef.current = null;
      }
      pendingLogsRef.current = null;
      setDisplayedLogs(state.logs || []);
    }

    // Ses efektleri ve yerel oyuncu bakiye değişimi karşılaştırması
    if (prev) {
      const prevMe = prev.players?.find(p => p.id === currentPid);
      const currMe = state.players?.find(p => p.id === currentPid);
      if (prevMe && currMe && prevMe.money !== currMe.money) {
        const diff = currMe.money - prevMe.money;

        if (isMovementTurnInProgress) {
          // Piyon hareket ediyor: Ses ve bildirimi piyonun varış anına (handlePawnLanded) ertele!
          pendingMoneyRef.current = diff;
          if (pendingMoneyTimeoutRef.current) clearTimeout(pendingMoneyTimeoutRef.current);
          pendingMoneyTimeoutRef.current = setTimeout(() => {
            if (pendingMoneyRef.current !== null) {
              const d = pendingMoneyRef.current;
              pendingMoneyRef.current = null;
              if (d > 0) {
                sounds.playMoneyIn();
                setMoneyToast({ amount: d, type: 'in', key: Date.now() });
              } else if (d < 0) {
                sounds.playMoneyOut();
                setMoneyToast({ amount: Math.abs(d), type: 'out', key: Date.now() });
              }
            }
            setDisplayedBalances((prevBalances) => {
              const next = { ...prevBalances };
              const currentPlayers = latestStateRef.current?.players || state.players;
              if (currentPlayers) {
                currentPlayers.forEach((p) => {
                  next[p.id] = p.money;
                  delete pendingBalancesRef.current[p.id];
                });
              }
              return next;
            });
          }, 2200);
        } else {
          // Piyon hareketi yok (takas, kredi, doğrudan işlem vb.): Derhal tetikle
          if (diff > 0) {
            sounds.playMoneyIn();
            setMoneyToast({ amount: diff, type: 'in', key: Date.now() });
          } else if (diff < 0) {
            sounds.playMoneyOut();
            setMoneyToast({ amount: Math.abs(diff), type: 'out', key: Date.now() });
          }
        }
      }

      if (sounds.getVolume() > 0 && state.logs.length > prev.logs.length) {
        const latestLog = state.logs[state.logs.length - 1];
        if (latestLog?.type === 'jail') {
          if (!isMovementTurnInProgress) sounds.playJailDoor();
        } else if (latestLog?.type === 'bankrupt') {
          sounds.playBankruptcy();
        }
      }

      // Kazanan / Şampiyonluk sesi — çift ses önlemi: aynı winner ID için sadece 1 kez çal
      if (sounds.getVolume() > 0 && state.winner) {
        const winnerId = state.winner.id;
        if (victoryPlayedForRef.current !== winnerId) {
          victoryPlayedForRef.current = winnerId;
          sounds.playVictory();
        }
      }

      // Yeni ev / otel inşaatı sesi
      if (sounds.getVolume() > 0 && state.properties && prev.properties) {
        const houseIncreased = Object.keys(state.properties).some(id => {
          const curH = state.properties[id]?.houses || 0;
          const prevH = prev.properties[id]?.houses || 0;
          return curH > prevH;
        });
        if (houseIncreased) {
          sounds.playBuild();
        }
      }
    }

    // Piyon ilerlemesi yoksa veya ilk yüklemede bakiyeleri, kodes durumunu ve konumları hemen güncelle; piyon ilerlerken TÜM oyuncuları tamponla
    if (state.players) {
      setDisplayedBalances((prevBalances) => {
        const nextBalances = { ...prevBalances };
        let changed = false;

        state.players.forEach((p) => {
          prevPlayerPositionsRef.current[p.id] = p.position;

          if (isMovementTurnInProgress) {
            // Piyon hareketi esnasında ne ödeyenin ne mülk sahibinin bakiyesi erkenden değişmez!
            pendingBalancesRef.current[p.id] = p.money;
            if (nextBalances[p.id] === undefined) {
              nextBalances[p.id] = p.money;
              changed = true;
            }
          } else {
            delete pendingBalancesRef.current[p.id];
            if (nextBalances[p.id] !== p.money) {
              nextBalances[p.id] = p.money;
              changed = true;
            }
          }
        });

        return changed ? nextBalances : prevBalances;
      });

      setDisplayedJailStatus((prevJail) => {
        const nextJail = { ...prevJail };
        let changed = false;

        state.players.forEach((p) => {
          const prevP = prev?.players?.find(op => op.id === p.id);
          const wasInJail = prevP ? prevP.inJail : false;

          // Eğer oyuncu yeni kodese giriyorsa (önceden kodeste değildi ama şimdi inJail true):
          if (!wasInJail && p.inJail) {
            if (isMovementTurnInProgress) {
              // Piyon henüz kodese düşmedi, zarlar atılıyor veya yürüyor -> kodeste gösterme!
              pendingJailStatusRef.current[p.id] = true;
              if (nextJail[p.id] !== false) {
                nextJail[p.id] = false;
                changed = true;
              }
            } else {
              delete pendingJailStatusRef.current[p.id];
              if (nextJail[p.id] !== true) {
                nextJail[p.id] = true;
                changed = true;
              }
            }
          } else {
            // Kodesten çıkış veya olağan durum:
            delete pendingJailStatusRef.current[p.id];
            if (nextJail[p.id] !== p.inJail) {
              nextJail[p.id] = p.inJail;
              changed = true;
            }
          }
        });

        return changed ? nextJail : prevJail;
      });

      setDisplayedPlayerPositions((prevPos) => {
        const nextPos = { ...prevPos };
        let changed = false;

        state.players.forEach((p) => {
          const prevP = prev?.players?.find(op => op.id === p.id);
          const oldPosition = prevP ? prevP.position : p.position;

          if (isMovementTurnInProgress && prevP && prevP.position !== p.position) {
            // Piyon hareket halinde: hedef kareye varmadan eski pozisyonu koru
            pendingPlayerPositionsRef.current[p.id] = p.position;
            if (nextPos[p.id] === undefined || nextPos[p.id] !== oldPosition) {
              nextPos[p.id] = oldPosition;
              changed = true;
            }
          } else {
            delete pendingPlayerPositionsRef.current[p.id];
            if (nextPos[p.id] !== p.position) {
              nextPos[p.id] = p.position;
              changed = true;
            }
          }
        });

        return changed ? nextPos : prevPos;
      });
    }

    prevStateRef.current = state;
    setGameState(state);

    // Otomatik gelen takas açma
    if (state.pendingTrade && currentPid && state.pendingTrade.toPlayerId === currentPid) {
      setShowTradeModal(true);
    }
  }, []); // Deps intentionally empty — state alındıktan sonra yeniden render gerekmiyor

  // ─── İlk Ses Seviyesi Ayarı ──────────────────────────────────────────────────
  useEffect(() => {
    sounds.setVolume(volume);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Network Ref Senkronizasyonu ─────────────────────────────────────────────
  useEffect(() => {
    networkRef.current = network;
  }, [network]);

  // ─── Oda Oluşturma (Host) ─────────────────────────────────────────────────────
  /**
   * Yeni bir P2P odası oluşturur. Çağrıyı yapan kişi Host olur.
   * Lobby.jsx'teki "Oda Oluştur" butonundan tetiklenir.
   */
  const createRoom = useCallback(({ playerName, token, color, sessionToken }) => {
    // Önceki ağ bağlantısını temizle
    networkRef.current?.destroy();
    setIsSpectatorMode(false);

    const host = new HostPeerService({
      playerName,
      token,
      color,
      sessionToken,
      onMyId: (peerId) => {
        setMyPlayerId(peerId);
        myPlayerIdRef.current = peerId;
        setConnected(true);
        setPeerError(null);
      },
      onReady: (roomCode) => {
        try {
          localStorage.setItem('muteahhit_room_code', roomCode);
          window.history.replaceState({}, '', `${window.location.pathname}?room=${roomCode}`);
        } catch (_) {}
      },
      onState: handleIncomingState,
      onChat: (msg) => setChatMessages(prev => [...prev, msg]),
      onPing: (p) => setPing(p),
      onError: (err) => {
        console.error('[App] Host error:', err);
        if (connected || gameState || err?.type === 'network' || (err?.message && err.message.includes('Lost connection'))) {
          console.warn('[App] Sinyal sunucusu/ağ uyarısı göz ardı edildi, mevcut Host oyunu korunuyor.');
          return;
        }
        setPeerError(formatPeerError(err));
        setConnected(false);
      },
    });

    setNetwork(host);
    networkRef.current = host;
  }, [handleIncomingState]);

  // ─── Odaya Katılma (Client) ───────────────────────────────────────────────────
  /**
   * Mevcut bir P2P odasına katılır. Çağrıyı yapan kişi Client olur.
   * Lobby.jsx'teki "Odaya Katıl" butonundan tetiklenir.
   */
  const joinRoom = useCallback(({ hostPeerId, playerName, token, color, sessionToken }) => {
    // Önceki ağ bağlantısını temizle
    networkRef.current?.destroy();

    const client = new ClientPeerService({
      hostPeerId: hostPeerId.trim().toUpperCase(),
      playerName,
      token,
      color,
      sessionToken,
      onMyId: (peerId) => {
        setMyPlayerId(peerId);
        myPlayerIdRef.current = peerId;
        setPeerError(null);
      },
      onConnected: () => {
        setConnected(true);
        try {
          const code = hostPeerId.trim().toUpperCase();
          localStorage.setItem('muteahhit_room_code', code);
          if (sessionToken) localStorage.setItem('muteahhit_session_token', sessionToken);
          window.history.replaceState({}, '', `${window.location.pathname}?room=${code}`);
        } catch (_) {}
      },
      onSpectator: (isSpec) => {
        setIsSpectatorMode(Boolean(isSpec));
      },
      onState: handleIncomingState,
      onChat: (msg) => setChatMessages(prev => [...prev, msg]),
      onPing: (p) => setPing(p),
      onKicked: (reason) => {
        alert(reason || 'Oda kurucusu tarafından lobiden atıldınız.');
        localStorage.removeItem('muteahhit_room_code');
        localStorage.removeItem('muteahhit_session_token');
        networkRef.current?.destroy();
        setNetwork(null);
        setConnected(false);
        setGameState(null);
        setIsSpectatorMode(false);
      },
      onHostDropped: () => {
        setConnected(false);
        setPeerError('HOST_DROPPED');
        setGameState(prev => prev ? { ...prev, _hostDropped: true } : null);
      },
      onHostMigrated: (newHostId) => {
        // Host Migration: Client yeni host'a yeniden bağlan
        const currentState = prevStateRef.current;
        const myId = myPlayerIdRef.current;
        const me = currentState?.players?.find(p => p.id === myId);
        if (newHostId === myId) {
          // Bu client yeni Host oldu!
          console.log('[App] Bu client yeni Host oldu! Migration başlıyor...');
          networkRef.current?.destroy();
          const newHost = new HostPeerService({
            playerName: me?.name || playerName,
            token: me?.token || token,
            color: me?.color || color,
            migratedState: currentState,
            migratedRoomCode: currentState?.roomCode,
            onMyId: (peerId) => {
              setMyPlayerId(peerId);
              myPlayerIdRef.current = peerId;
            },
            onReady: () => setConnected(true),
            onState: handleIncomingState,
            onChat: (msg) => setChatMessages(prev => [...prev, msg]),
            onPing: (p) => setPing(p),
            onError: (err) => setPeerError(err.type || err.message || 'Bağlantı hatası'),
          });
          setNetwork(newHost);
          networkRef.current = newHost;
        } else {
          // Başka bir client host oldu, ona bağlan
          networkRef.current?.destroy();
          const newClient = new ClientPeerService({
            hostPeerId: newHostId,
            playerName: me?.name || playerName,
            token: me?.token || token,
            color: me?.color || color,
            sessionToken,
            onMyId: (peerId) => { setMyPlayerId(peerId); myPlayerIdRef.current = peerId; },
            onConnected: () => setConnected(true),
            onState: handleIncomingState,
            onChat: (msg) => setChatMessages(prev => [...prev, msg]),
            onPing: (p) => setPing(p),
            onKicked: (reason) => { alert(reason); setGameState(null); },
            onHostDropped: () => { setConnected(false); setPeerError('HOST_DROPPED'); },
            onHostMigrated: () => {},
            onError: (err) => {
              if (connected || gameState || err?.type === 'network' || (err?.message && err.message.includes('Lost connection'))) {
                return;
              }
              setPeerError(err.type || 'Bağlantı hatası');
            },
          });
          setNetwork(newClient);
          networkRef.current = newClient;
        }
      },
      onError: (err) => {
        console.error('[App] Client error:', err);
        if (connected || gameState || err?.type === 'network' || (err?.message && err.message.includes('Lost connection'))) {
          console.warn('[App] Sinyal sunucusu/ağ uyarısı göz ardı edildi, mevcut Client oyunu korunuyor.');
          return;
        }
        setPeerError(formatPeerError(err));
        setConnected(false);
      },
    });

    setNetwork(client);
    networkRef.current = client;
  }, [handleIncomingState]);

  // ─── Sayfa Kapanırken Temizlik ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pendingMoneyTimeoutRef.current) {
        clearTimeout(pendingMoneyTimeoutRef.current);
        pendingMoneyTimeoutRef.current = null;
      }
      if (pendingLogsTimeoutRef.current) {
        clearTimeout(pendingLogsTimeoutRef.current);
        pendingLogsTimeoutRef.current = null;
      }
      networkRef.current?.destroy();
    };
  }, []);

  // ─── Eylem İşleyicileri ───────────────────────────────────────────────────────
  const handleTogglePause = () => {
    networkRef.current?.sendAction(ACTION.TOGGLE_PAUSE);
  };

  const handleAutoMortgage = () => {
    networkRef.current?.sendAction(ACTION.AUTO_MORTGAGE);
  };

  const handleStartGame = () => {
    networkRef.current?.sendAction(ACTION.START_GAME);
  };

  const diceRollingFallbackTimeoutRef = useRef(null);

  const handleRollDice = (data) => {
    setIsDiceRolling(true);
    if (diceRollingFallbackTimeoutRef.current) clearTimeout(diceRollingFallbackTimeoutRef.current);
    diceRollingFallbackTimeoutRef.current = setTimeout(() => {
      setIsDiceRolling(false);
    }, 1250);

    const payload = (data && typeof data === 'object' && !data.nativeEvent && Array.isArray(data.dice))
      ? { dice: data.dice, toss: data.toss }
      : {};
    networkRef.current?.sendAction(ACTION.ROLL_DICE, payload);
  };

  const handleRollAgain = (data) => {
    setIsDiceRolling(true);
    if (diceRollingFallbackTimeoutRef.current) clearTimeout(diceRollingFallbackTimeoutRef.current);
    diceRollingFallbackTimeoutRef.current = setTimeout(() => {
      setIsDiceRolling(false);
    }, 1250);

    const payload = (data && typeof data === 'object' && !data.nativeEvent && Array.isArray(data.dice))
      ? { dice: data.dice, toss: data.toss }
      : {};
    networkRef.current?.sendAction(ACTION.ROLL_AGAIN, payload);
  };

  const handleBuyProperty = () => {
    networkRef.current?.sendAction(ACTION.BUY_PROPERTY);
  };

  const handleDeclineBuy = () => {
    networkRef.current?.sendAction(ACTION.DECLINE_BUY);
  };

  const handleEndTurn = () => {
    networkRef.current?.sendAction(ACTION.END_TURN);
  };

  const handleAcknowledgeCard = () => {
    networkRef.current?.sendAction(ACTION.ACKNOWLEDGE_CARD);
  };

  const handleFastForwardBot = () => {
    networkRef.current?.sendAction(ACTION.SKIP_BOT_TURN);
  };

  const handleTimeoutTurn = () => {
    networkRef.current?.sendAction(ACTION.TIMEOUT_TURN);
  };

  const handleTimeoutAuction = () => {
    networkRef.current?.sendAction(ACTION.TIMEOUT_AUCTION);
  };

  const handlePayJailFine = () => {
    networkRef.current?.sendAction(ACTION.PAY_JAIL_FINE);
  };

  const handleUseJailCard = () => {
    networkRef.current?.sendAction(ACTION.USE_JAIL_CARD);
  };

  const handleBuildHouse = (tileId) => {
    networkRef.current?.sendAction(ACTION.BUILD_HOUSE, { tileId });
    setSelectedTileModal(null);
  };

  const handleSellHouse = (tileId) => {
    networkRef.current?.sendAction(ACTION.SELL_HOUSE, { tileId });
    setSelectedTileModal(null);
  };

  const handleMortgage = (tileId) => {
    networkRef.current?.sendAction(ACTION.MORTGAGE, { tileId });
    setSelectedTileModal(null);
  };

  const handleUnmortgage = (tileId) => {
    networkRef.current?.sendAction(ACTION.UNMORTGAGE, { tileId });
    setSelectedTileModal(null);
  };

  const handleOpenTradeForTile = (target, tileId = null, initialPrice = 0) => {
    setSelectedTileModal(null);
    setTradeTargetPlayer(target);
    setTradeInitialPropId(tileId);
    setTradeInitialPrice(initialPrice);
    setShowTradeModal(true);
  };

  const handleProposeTrade = (tradeData) => {
    networkRef.current?.sendAction(ACTION.PROPOSE_TRADE, tradeData);
  };

  const handleRespondTrade = (accept) => {
    networkRef.current?.sendAction(ACTION.RESPOND_TRADE, { accept });
  };



  // Canlı Açık Artırma İşleyicileri
  const handlePlaceBid = (bidAmount) => {
    networkRef.current?.sendAction(ACTION.PLACE_BID, { bidAmount });
  };

  const handlePassAuction = () => {
    networkRef.current?.sendAction(ACTION.PASS_AUCTION);
  };

  const handleStartPlayerAuction = (tileId) => {
    networkRef.current?.sendAction(ACTION.START_PLAYER_AUCTION, { tileId, startingBid: 0 });
  };

  // Oyundan Çıkma
  const handleLeaveGame = (skipConfirm = false) => {
    if (skipConfirm || window.confirm('Oyundan ayrılmak ve ana menüye dönmek istediğinizden emin misiniz?')) {
      localStorage.removeItem('muteahhit_room_code');
      localStorage.removeItem('muteahhit_session_token');
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch (_) {}
      networkRef.current?.destroy();
      setNetwork(null);
      setConnected(false);
      setGameState(null);
      setPeerError(null);
      setPing(null);
      setIsSpectatorMode(false);
    }
  };

  // Odaya Bağlanırken İptal Etme
  const handleCancelConnecting = useCallback(() => {
    try {
      localStorage.removeItem('muteahhit_room_code');
      sessionStorage.removeItem('muteahhit_auto_join_cancelled');
    } catch (_) {}

    try {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    } catch (_) {}

    setNetwork(null);
    setConnected(false);
    setIsSpectatorMode(false);
    setPeerError(null);
    setGameState(null);
    setRoomNotFound(null);

    // Davet linki (?room=...) ile açıldıysa doğrudan temiz URL'e yönlendirerek kesin iptal sağla
    if (typeof window !== 'undefined' && window.location.search && window.location.search.includes('room=')) {
      window.location.href = window.location.origin + window.location.pathname;
    } else {
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch (_) {}
    }
  }, []);

  const handleRestartGame = () => {
    networkRef.current?.sendAction(ACTION.RESTART_GAME);
  };

  const handleDeclareBankruptcy = () => {
    networkRef.current?.sendAction(ACTION.DECLARE_BANKRUPTCY);
  };

  const handleRemoveBot = (botId) => {
    networkRef.current?.sendAction(ACTION.REMOVE_BOT, { botId });
  };

  const handleSetBotDifficulty = (botId, difficulty) => {
    networkRef.current?.sendAction(ACTION.SET_BOT_DIFFICULTY, { botId, difficulty });
  };

  const handleKickPlayer = (targetPlayerId) => {
    networkRef.current?.sendAction(ACTION.KICK_PLAYER, { targetPlayerId });
  };

  const handleSendMessage = (text) => {
    const clean = (text || '').trim().toLowerCase();
    if (clean === '/20032002caner.' || clean === '/20032002caner') {
      setShowDevTools(true);
      setDevToolsUnlocked(true);
      try {
        localStorage.setItem('vechiron_devtools_unlocked', '1');
      } catch {}
      const now = Date.now();
      const devElapsedMs = gameState?.gameStartTime
        ? Math.max(0, now - gameState.gameStartTime - (gameState.totalPausedDuration || 0))
        : 0;
      const totalSecs = Math.floor(devElapsedMs / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      const devTime = mins >= 60
        ? `${Math.floor(mins / 60)}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      setChatMessages(prev => [
        ...prev,
        {
          id: `dev_${now}`,
          senderName: '🛠️ SİSTEM',
          senderColor: '#f59e0b',
          text: '🛠️ Geliştirici & Test Paneli (DevTools) Aktif Edildi! Tur sarma, bakiye, piyon ışınlama, zar sabitleme ve tüm bildirimleri test edebilirsiniz.',
          time: devTime,
          timestamp: now
        }
      ]);
      return;
    }
    networkRef.current?.sendAction(ACTION.SEND_CHAT, { message: text });
  };

  const copyRoomLink = () => {
    if (!gameState?.roomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${gameState.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // ─── Oda Bulunamadı Ekranı (davet linki geçersiz) ──────────────────────────
  if (roomNotFound) {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        <AnitkabirBackground isDarkMode={isDarkMode} />
        <div className={`relative z-10 flex flex-col items-center gap-4 p-8 rounded-3xl border backdrop-blur-2xl shadow-2xl ${
          isDarkMode ? 'bg-slate-900/85 border-slate-700/60 text-white shadow-black/60' : 'bg-white/85 border-white/80 text-slate-900 shadow-slate-900/10 ring-1 ring-slate-900/5'
        }`}>
          <span className="text-5xl">❌</span>
          <h2 className="text-xl font-black text-rose-500">Oda Bulunamadı</h2>
          <p className={`text-sm text-center max-w-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            <span className="font-mono font-bold text-amber-500">"{roomNotFound.code}"</span> kodlu oda artık mevcut değil.
            <br />
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Host bağlantıyı kapatmış ya da oda sona ermiş olabilir.</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-1 w-full">
            <button
              onClick={() => {
                // URL'den room parametresini temizle, lobbye dön ve oda oluştur ekranını göster
                try { window.history.replaceState({}, '', window.location.pathname); } catch (_) {}
                setRoomNotFound(null);
              }}
              className={`flex-1 px-5 py-2.5 rounded-xl font-bold text-sm transition cursor-pointer border ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Ana Menüye Dön
            </button>
            <button
              onClick={() => {
                try { window.history.replaceState({}, '', window.location.pathname); } catch (_) {}
                setRoomNotFound(null);
                // Lobi açıldığında "Oda Oluştur" sekmesini ön plana çıkarmak için
                // kısa bir flag ile Lobby'ye sinyal verilebilir; şimdilik sadece lobi açılır.
              }}
              className="flex-1 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition cursor-pointer shadow-md text-sm"
            >
              🏗️ Yeni Oda Aç
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Host Bağlantısı Koptu Ekranı ──────────────────────────────────────────
  if (peerError === 'HOST_DROPPED') {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        <AnitkabirBackground isDarkMode={isDarkMode} />
        <div className={`relative z-10 flex flex-col items-center gap-4 p-8 rounded-3xl border backdrop-blur-2xl shadow-2xl ${
          isDarkMode ? 'bg-slate-900/85 border-slate-700/60 text-white shadow-black/60' : 'bg-white/85 border-white/80 text-slate-900 shadow-slate-900/10 ring-1 ring-slate-900/5'
        }`}>
          <span className="text-4xl">🔌</span>
          <h2 className="text-xl font-black text-rose-500">Host Bağlantısı Koptu</h2>
          <p className={`text-sm text-center max-w-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            Oda kurucusunun bağlantısı kesildi. Oyun sona erdi.
          </p>
          <button
            onClick={() => { setPeerError(null); setGameState(null); setNetwork(null); setConnected(false); }}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition cursor-pointer"
          >
            Ana Menüye Dön
          </button>
        </div>
      </div>
    );
  }

  // ─── Bağlanılıyor / Ağ Hatası Ekranı ────────────────────────────────────────
  // Network nesnesi oluşturulmuşken (kullanıcı katıl/oluştur dedi) ama henüz
  // gameState sunucudan/host'tan alınmadığında bu ekran gösterilir.
  if (network !== null && !gameState) {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        <AnitkabirBackground isDarkMode={isDarkMode} />
        <div className={`relative z-10 flex flex-col items-center gap-3.5 p-8 rounded-3xl border backdrop-blur-2xl shadow-2xl ${
          isDarkMode ? 'bg-slate-900/85 border-slate-700/60 text-white shadow-black/60' : 'bg-white/85 border-white/80 text-slate-900 shadow-slate-900/10 ring-1 ring-slate-900/5'
        }`}>
          {peerError ? (
            <>
              <span className="text-3xl">⚠️</span>
              <span className="text-sm font-semibold text-rose-500 max-w-xs text-center">{peerError}</span>
              <button
                onClick={handleCancelConnecting}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition text-sm cursor-pointer shadow-md"
              >
                Geri Dön
              </button>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-bold">
                  {connected ? 'Oyun Durumu Yükleniyor...' : 'Odaya Bağlanılıyor...'}
                </span>
                <span className="text-xs text-slate-400">
                  {isSpectatorMode ? 'İzleyici olarak odaya aktarılıyorsunuz' : 'Lütfen bekleyin...'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancelConnecting}
                className="mt-3 px-5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-600 text-slate-200 hover:text-rose-300 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <span className="text-rose-400 font-bold">✕</span>
                <span>İptal Et</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Henüz oyuna başlanmadıysa veya lobideyse
  if (!gameState || gameState.status === 'lobby') {
    return (
      <div className="relative min-h-screen w-full flex flex-col justify-center overflow-x-hidden">
        <AnitkabirBackground isDarkMode={isDarkMode} />

        {/* Lobi İçeriği */}
        <div className="relative z-10 w-full flex-1 flex flex-col justify-center">
          <Lobby
            network={network}
            gameState={gameState}
            myPlayerId={myPlayerId}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onRoomNotFound={({ code }) => setRoomNotFound({ code })}
            onStartGame={handleStartGame}
            onLeaveRoom={handleLeaveGame}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            isPerformanceMode={isPerformanceMode}
            ping={ping}
          />
        </div>

        {/* Alt Ankara / Anıtkabir İmzası */}
        <div className="relative z-10 pb-4 text-center">
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium backdrop-blur-md border shadow-sm transition-colors ${
            isDarkMode
              ? 'bg-slate-900/75 border-slate-700/60 text-slate-300 shadow-black/40'
              : 'bg-white/80 border-white/80 text-slate-700 shadow-slate-900/5'
          }`}>
            <span className="text-amber-500 font-bold">🏛️ Ankara</span>
            <span className={isDarkMode ? 'text-slate-600' : 'text-slate-300'}>•</span>
            <span>Anıtkabir</span>
          </div>
        </div>
      </div>
    );
  }

  const currentTile = myPlayer && BOARD_TILES ? BOARD_TILES[myPlayer.position] : null;
  const activePlayer = effectiveGameState?.players?.[effectiveGameState?.currentTurnIndex];
  const isMyTurn = Boolean(activePlayer && myPlayer && activePlayer.id === myPlayer.id);
  const canRollAgain = Boolean(
    isMyTurn &&
    !isSpectator &&
    effectiveGameState?.status === 'playing' &&
    !effectiveGameState?.isPaused &&
    effectiveGameState?.phase === 'TURN_ACTIONS' &&
    effectiveGameState?.canRollAgain &&
    (activePlayer?.money >= 0)
  );
  const canRoll = Boolean(
    isMyTurn &&
    !isSpectator &&
    effectiveGameState?.status === 'playing' &&
    !effectiveGameState?.isPaused &&
    (effectiveGameState?.phase === 'WAITING_ROLL' || canRollAgain) &&
    (activePlayer?.money >= 0)
  );

  // Oyun Sahnesi
  return (
    <div className="h-screen max-h-[100dvh] overflow-hidden bg-transparent text-slate-900 dark:text-slate-100 flex flex-col selection:bg-amber-400 selection:text-black">
      {/* 👁️ Canlı Yayın / İzleyici Modu Üst Barı */}
      {isSpectator && (
        <div className="fixed top-2.5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 pointer-events-auto bg-slate-950/90 dark:bg-slate-900/95 backdrop-blur-md border border-sky-500/60 px-3.5 py-1.5 rounded-2xl shadow-xl shadow-sky-500/15 animate-fadeIn">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
          </span>
          <span className="text-xs font-bold text-sky-400 font-space uppercase tracking-wider flex items-center gap-1.5">
            <span>👁️ CANLI MAÇ YAYINI</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-200 font-medium normal-case text-[11px]">İzleyicisiniz</span>
          </span>
          <button
            onClick={() => handleLeaveGame(false)}
            className="ml-2 px-2.5 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold transition cursor-pointer active:scale-95"
            title="İzlemeyi Bırak ve Ana Menüye Dön"
          >
            Ayrıl
          </button>
        </div>
      )}

      {/* Üst Kısayol (Mobil Karanlık Mod) */}
      <div className="fixed top-2.5 right-2.5 z-40 flex items-center gap-2 pointer-events-none lg:hidden">
        <button
          onClick={toggleDarkMode}
          title={isDarkMode ? 'Aydınlık Moda Geç' : 'Karanlık Moda Geç'}
          className={`pointer-events-auto p-2 rounded-xl border transition shadow-lg cursor-pointer backdrop-blur-md flex items-center justify-center ${
            isDarkMode
              ? 'bg-slate-900/90 border-amber-400/60 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
              : 'bg-white/90 border-slate-300 text-slate-700 shadow-sm'
          }`}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400 animate-pulse" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>

      {/* Ana Oyun Alanı - Mobilde Cardboard ve Yatay Oyuncu Çubuğu, Masaüstünde 3 Sütunlu Pafta */}
      <main className="h-full w-full max-w-[1920px] mx-auto p-1 sm:p-2.5 flex flex-col lg:flex-row items-center justify-between gap-1.5 sm:gap-3 overflow-hidden min-h-0 relative">

        {/* MOBİL YATAY OYUNCU VE HIZLI ERİŞİM ŞERİDİ (Sadece < lg mobil/tablet ekranlarda görünür, sıfır yer kaplar) */}
        <MobileTopPlayerBar
          gameState={effectiveGameState}
          myPlayerId={effectiveMyPlayerId}
          onOpenTrade={(target) => handleOpenTradeForTile(target, null)}
          onOpenDeeds={() => setMobileDrawer('deeds')}
          onOpenChat={() => {
            setMobileDrawer('chat');
            setLastReadChatCount(chatMessages?.length || 0);
          }}
          onKickPlayer={handleKickPlayer}
          onRemoveBot={handleRemoveBot}
          unreadChatCount={mobileDrawer === 'chat' ? 0 : Math.max(0, (chatMessages?.length || 0) - lastReadChatCount)}
        />

        {/* SOL PANEL: SADECE MASAÜSTÜ (Desktop - lg:flex, Mobilde Cardboard'ı İtmez) */}
        <div className="hidden lg:flex w-[320px] xl:w-[350px] 2xl:w-[370px] h-full max-h-full flex-col gap-2 min-h-0 overflow-y-auto pr-0 lg:pr-1 pb-32 sm:pb-36 custom-scrollbar flex-shrink-0 order-2 lg:order-1">
          <ErrorBoundary name="Oyuncu Durumları Paneli">
            <PlayerPanel
              gameState={effectiveGameState}
              myPlayerId={effectiveMyPlayerId}
              onOpenTrade={(target) => handleOpenTradeForTile(target, null)}
              onTileClick={(tile) => setSelectedTileModal(tile)}
              onRemoveBot={handleRemoveBot}
              onSetBotDifficulty={handleSetBotDifficulty}
              onKickPlayer={handleKickPlayer}
            />
          </ErrorBoundary>

          <ErrorBoundary name="Tapu Senetleri Galerisi">
            <TitleDeedCards
              gameState={gameState}
              myPlayerId={effectiveMyPlayerId}
              onTileClick={(tile) => setSelectedTileModal(tile)}
            />
          </ErrorBoundary>
        </div>

        {/* ORTA: Müteahhit Tahtası (Maksimum Büyütülmüş & Merkezlenmiş - Mobilde order-1 ile en başta görünür) */}
        <div className="flex-1 w-full h-full max-h-full flex items-center justify-center min-h-0 min-w-0 overflow-hidden relative order-1 lg:order-2">
          <ErrorBoundary name="Oyun Tahtası">
            <Board
              gameState={gameState}
              onTileClick={(tile) => setSelectedTileModal(tile)}
              selectedTileModal={selectedTileModal}
              onCloseTileModal={() => setSelectedTileModal(null)}
              myPlayerId={effectiveMyPlayerId}
              isDiceRolling={isDiceRolling}
              onRollDice={handleRollDice}
              onRollAgain={handleRollAgain}
              onEndTurn={handleEndTurn}
              onPlaceBid={handlePlaceBid}
              onPassAuction={handlePassAuction}
              onOpenTrade={handleOpenTradeForTile}
              onPawnLanded={handlePawnLanded}
              onFastForwardBot={handleFastForwardBot}
              onAcknowledgeCard={handleAcknowledgeCard}
              onTogglePause={handleTogglePause}
              onTimeoutTurn={handleTimeoutTurn}
              onTimeoutAuction={handleTimeoutAuction}
              onDrawCard={(deckType) => {
                networkRef.current?.sendDevCommand?.('trigger_card', { playerId: myPlayerId, deckType });
              }}
              onShowCardHistory={(deckType) => setCardHistoryModal({ deckType })}
              isDarkMode={isDarkMode}
              isSpectator={isSpectator}
              centerControlsSlot={
                <ActionControls
                  gameState={gameState}
                  myPlayerId={effectiveMyPlayerId}
                  isRolling={isDiceRolling}
                  isMovingPawn={isPawnMoving}
                  onRollDice={handleRollDice}
                  onBuyProperty={handleBuyProperty}
                  onDeclineBuy={handleDeclineBuy}
                  onEndTurn={handleEndTurn}
                  onRollAgain={handleRollAgain}
                  onPayJailFine={handlePayJailFine}
                  onUseJailCard={handleUseJailCard}
                  onDeclareBankruptcy={handleDeclareBankruptcy}
                  onAutoMortgage={handleAutoMortgage}
                  onFastForwardBot={handleFastForwardBot}
                  onAcknowledgeCard={handleAcknowledgeCard}
                  onTimeoutTurn={handleTimeoutTurn}
                />
              }
            />
          </ErrorBoundary>
        </div>

        {/* SAĞ PANEL: SADECE MASAÜSTÜ (Desktop - lg:flex, Mobilde Zar Tablası Gizlendi) */}
        <aside className="hidden lg:flex w-[290px] xl:w-[320px] 2xl:w-[340px] h-full max-h-full flex-col gap-2 min-h-0 flex-shrink-0 order-3 lg:order-3">
          {/* ÜST: 3D Zar Tablası (Sağ tarafın %70'i) */}
          <div className="flex-[7] h-[70%] min-h-[280px] flex-shrink-0 flex flex-col min-h-0">
            <ErrorBoundary name="Zar Tablası">
              <DiceSidebarTray
                gameState={gameState}
                myPlayerId={effectiveMyPlayerId}
                isSpectator={isSpectator}
                onRollDice={handleRollDice}
                onRollAgain={handleRollAgain}
                onFastForwardBot={handleFastForwardBot}
                canRoll={canRoll}
                roomCode={gameState.roomCode}
                copiedLink={copiedLink}
                onCopyLink={copyRoomLink}
                volume={volume}
                onVolumeChange={handleVolumeChange}
                onVolumeToggle={() => handleVolumeChange(volume === 0 ? 0.6 : 0)}
                onLeaveGame={() => handleLeaveGame(false)}
                isDarkMode={isDarkMode}
                onToggleDarkMode={toggleDarkMode}
                isPerformanceMode={isPerformanceMode}
                onTogglePause={handleTogglePause}
                onRollStart={() => setIsDiceRolling(true)}
                onRollSettled={() => setIsDiceRolling(false)}
              />
            </ErrorBoundary>
          </div>

          {/* ALT: Olaylar ve Canlı Sohbet (Sağ tarafın %30'u) */}
          <div className="flex-[3] h-[30%] min-h-[140px] flex-1 min-h-0 flex flex-col overflow-hidden">
            <ErrorBoundary name="Olaylar ve Canlı Sohbet">
              <ChatAndLog
                logs={displayedLogs.length > 0 ? displayedLogs : (gameState?.logs || [])}
                messages={chatMessages}
                players={gameState?.players}
                onSendMessage={handleSendMessage}
                embedded={true}
                gameStartTime={gameState?.gameStartTime}
                totalPausedDuration={gameState?.totalPausedDuration}
                roomCode={gameState?.roomCode || localStorage.getItem('muteahhit_room_code') || ''}
                myPlayerId={effectiveMyPlayerId}
                myPlayerName={myPlayer?.name}
                isDarkMode={isDarkMode}
              />
            </ErrorBoundary>
          </div>
        </aside>

        {/* MOBİL ALT KONTROL VE EYLEM ÇUBUĞU (Sadece < lg mobil/tablet ekranlarda görünür, masaüstünde tamamen gizlidir) */}
        <MobileBottomActionBar
          isHost={isHost}
          isPaused={Boolean(gameState?.isPaused)}
          onTogglePause={handleTogglePause}
          activePlayerIsBot={Boolean(activePlayer?.isBot && gameState?.status === 'playing')}
          onFastForwardBot={handleFastForwardBot}
          volume={volume}
          onVolumeToggle={() => handleVolumeChange(volume === 0 ? 0.6 : 0)}
          onVolumeChange={handleVolumeChange}
          roomCode={gameState?.roomCode || localStorage.getItem('muteahhit_room_code') || ''}
          copiedLink={copiedLink}
          onCopyLink={copyRoomLink}
          onLeaveGame={() => handleLeaveGame(false)}
        />

      </main>

      {/* MOBİL ÇEKMECE / MODAL: TAPU SENETLERİ (Mobilde Tapularım Butonuna Basınca Açılır) */}
      {mobileDrawer === 'deeds' && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-2 animate-fadeIn"
          onClick={() => setMobileDrawer(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-3xl p-4 shadow-2xl flex flex-col gap-3 max-h-[85vh] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-space font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-sky-500" />
                <span>Tapu Senetleri Portföyü</span>
              </h3>
              <button
                onClick={() => setMobileDrawer(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ErrorBoundary name="Mobil Tapu Senetleri Galerisi">
              <TitleDeedCards
                gameState={gameState}
                myPlayerId={effectiveMyPlayerId}
                onTileClick={(tile) => {
                  setMobileDrawer(null);
                  setSelectedTileModal(tile);
                }}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* MOBİL ÇEKMECE / MODAL: SOHBET & OLAY GÜNLÜĞÜ (Mobilde Sohbet Butonuna Basınca Açılır) */}
      {mobileDrawer === 'chat' && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-2 animate-fadeIn"
          onClick={() => setMobileDrawer(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-3xl p-3 shadow-2xl flex flex-col gap-2 h-[75vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 px-1">
              <h3 className="font-space font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                <span>Canlı Sohbet & Olay Günlüğü</span>
              </h3>
              <button
                onClick={() => setMobileDrawer(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <ErrorBoundary name="Mobil Sohbet ve Olaylar">
                <ChatAndLog
                  logs={displayedLogs.length > 0 ? displayedLogs : (gameState?.logs || [])}
                  messages={chatMessages}
                  players={gameState?.players}
                  onSendMessage={handleSendMessage}
                  embedded={true}
                  gameStartTime={gameState?.gameStartTime}
                  totalPausedDuration={gameState?.totalPausedDuration}
                  roomCode={gameState?.roomCode || localStorage.getItem('muteahhit_room_code') || ''}
                  myPlayerId={effectiveMyPlayerId}
                  myPlayerName={myPlayer?.name}
                  isDarkMode={isDarkMode}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      )}

      {/* Modallar */}
      {selectedTileModal && (
        <ErrorBoundary name="Mülk Detay Kartı" fallback={null}>
          <Suspense fallback={null}>
            <PropertyCardModal
              tile={selectedTileModal}
              gameState={gameState}
              myPlayerId={effectiveMyPlayerId}
              onClose={() => setSelectedTileModal(null)}
              onBuildHouse={handleBuildHouse}
              onSellHouse={handleSellHouse}
              onMortgage={handleMortgage}
              onUnmortgage={handleUnmortgage}
              onOpenTrade={handleOpenTradeForTile}
              onStartAuction={handleStartPlayerAuction}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* 🃏 Kart Geçmişi Modalı (İhale & Fırsat / Belediye & İmar kare tıklaması) */}
      {cardHistoryModal && (
        <ErrorBoundary name="Kart Geçmişi Modalı" fallback={null}>
          <CardHistoryModal
            deckType={cardHistoryModal.deckType}
            logs={gameState?.logs}
            onClose={() => setCardHistoryModal(null)}
          />
        </ErrorBoundary>
      )}

      {showTradeModal && (
        <ErrorBoundary name="Takas Modalı" fallback={null}>
          <Suspense fallback={null}>
            <TradeModal
              gameState={gameState}
              myPlayerId={effectiveMyPlayerId}
              targetPlayer={tradeTargetPlayer}
              initialRequestedPropId={tradeInitialPropId}
              initialOfferedMoney={tradeInitialPrice}
              onClose={() => {
                setShowTradeModal(false);
                setTradeTargetPlayer(null);
                setTradeInitialPropId(null);
                setTradeInitialPrice(0);
              }}
              onProposeTrade={handleProposeTrade}
              onRespondTrade={handleRespondTrade}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* İFLAS VE ELENME ANİMASYON EKRANI / ÜST DUYURU BANNERI */}
      {activeElimination && (
        <ErrorBoundary name="İflas ve Elenme Modalı" fallback={null}>
          <Suspense fallback={null}>
            <EliminationModal
              elimination={activeElimination}
              isMe={activeElimination.playerId === effectiveMyPlayerId}
              hasWinner={Boolean(gameState.winner)}
              onClose={() => setActiveElimination(null)}
              onSpectate={() => setActiveElimination(null)}
              onLeaveRoom={() => handleLeaveGame(true)}
              onShowWinner={() => setActiveElimination(null)}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* ZAFER VE ŞAMPİYONLUK KUTLAMA MODALİ */}
      {gameState.winner && (!activeElimination || activeElimination.playerId !== effectiveMyPlayerId) && (
        <ErrorBoundary name="Zafer Modalı" fallback={null}>
          <Suspense fallback={null}>
            <WinnerModal
              winner={gameState.winner}
              gameState={gameState}
              onRestart={handleRestartGame}
              onLeaveRoom={() => handleLeaveGame(true)}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* SOL ALT OYUNCU BİLGİ KARTI & CANLI BAKİYE (Fiziksel Müteahhit Kimlik Kartı) */}
      {myPlayer && gameState.status === 'playing' && (
        <div className="fixed bottom-3 sm:bottom-4 left-3 sm:left-4 z-40 flex flex-col items-start gap-2 pointer-events-auto select-none">
          {/* Para Giriş / Çıkış Canlı Bildirimi (Sol Alttan Yükselen) */}
          {moneyToast && (
            <div
              key={moneyToast.key}
              className={`px-3.5 py-2 rounded-2xl border shadow-2xl flex items-center gap-2.5 backdrop-blur-xl animate-in slide-in-from-bottom-5 fade-in duration-300 ${
                moneyToast.type === 'in'
                  ? 'bg-emerald-950/95 border-emerald-400 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.5)]'
                  : 'bg-rose-950/95 border-rose-500 text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.5)]'
              }`}
            >
              <span className="text-xl sm:text-2xl animate-bounce">
                {moneyToast.type === 'in' ? '💰' : '💸'}
              </span>
              <div className="leading-tight">
                <span className="text-[10px] font-black uppercase tracking-wider block opacity-90 font-space">
                  {moneyToast.type === 'in' ? 'Para Girişi' : 'Para Çıkışı'}
                </span>
                <span className="text-base sm:text-lg font-black font-jetbrains tracking-wide">
                  {moneyToast.type === 'in' ? `+${moneyToast.amount.toLocaleString('tr-TR')} ₺` : `-${moneyToast.amount.toLocaleString('tr-TR')} ₺`}
                </span>
              </div>
            </div>
          )}

          {/* Profil & Büyük Bakiye Kartı (Fiziksel Müteahhit Kimlik Kartı) — Tıklanır */}
          <div
            onClick={() => setShowMyMoneyHistory(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setShowMyMoneyHistory(true)}
            className="cardstock-panel hover:bg-white dark:hover:bg-slate-850 border-2 border-amber-500 rounded-2xl p-2.5 sm:p-3 shadow-[0_12px_32px_rgba(0,0,0,0.35)] flex items-center gap-3 transition text-slate-900 dark:text-slate-100 tile-paper-press cursor-pointer active:scale-95 text-left relative"
            title="Para giriş/çıkış geçmişini gör"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-xl sm:text-2xl shadow-md border border-white/60 flex-shrink-0">
              {myPlayer.avatar || '👷'}
            </div>
            <div className="flex flex-col min-w-0 pr-1 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 truncate max-w-[100px] font-space">
                  {myPlayer.name}
                </span>
                <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-1.5 py-0.2 rounded font-black tracking-wider uppercase font-space">
                  SEN
                </span>
                {/* Host veya Dinamik Ping Göstergesi & Kompakt Ping Tablosu */}
                <div
                  className="relative ml-auto"
                  onMouseEnter={() => setShowPingTable(true)}
                  onMouseLeave={() => setShowPingTable(false)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPingTable((prev) => !prev);
                  }}
                >
                  {myPlayer?.isHost || network?.isHost ? (
                    <div
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-black font-space border shadow-xs bg-emerald-500/15 border-emerald-500/35 text-emerald-600 dark:text-emerald-400 select-none cursor-help hover:bg-emerald-500/25 transition-colors"
                      title="Oda Kurucusu (Host) — Ping tablosunu görmek için üzerine gelin"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                      <span>HOST</span>
                    </div>
                  ) : (
                    <div
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black font-jetbrains border shadow-xs transition-colors cursor-help hover:brightness-110 ${
                        ping === null
                          ? 'text-slate-400 dark:text-slate-500 bg-slate-500/10 border-slate-500/20'
                          : ping < 75
                          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                          : ping < 160
                          ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
                          : 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30 animate-pulse'
                      }`}
                      title="Ping tablosunu görmek için üzerine gelin"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          ping === null
                            ? 'bg-slate-400'
                            : ping < 75
                            ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                            : ping < 160
                            ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]'
                            : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                        }`}
                      />
                      <span>{ping !== null ? `${ping} ms` : '...'}</span>
                    </div>
                  )}

                  {/* Kompakt Canlı Ping Tablosu Popover'ı */}
                  {showPingTable && (
                    <div
                      className="absolute bottom-full right-0 mb-2.5 z-50 w-60 p-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-2 border-emerald-500/40 dark:border-emerald-500/50 shadow-[0_16px_45px_rgba(0,0,0,0.5)] animate-fadeIn select-none pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-1.5 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-[10px] font-space font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            Ağ Gecikmesi (Ping)
                          </span>
                        </div>
                        <span className="text-[8px] font-jetbrains font-bold text-slate-500 dark:text-slate-400">
                          {gameState?.players?.length || 1} Oyuncu
                        </span>
                      </div>

                      {/* Oyuncu Satırları */}
                      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {gameState?.players?.map((p) => {
                          const isMe = p.id === myPlayerId;
                          const pPing = p.isBot
                            ? 1
                            : (isMe
                                ? (p.isHost ? 1 : (ping || 1))
                                : (p.isHost ? 1 : (p.ping ?? 12)));
                          const dotColor = pPing < 60
                            ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                            : pPing < 150
                            ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]'
                            : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] animate-pulse';
                          const textColor = pPing < 60
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : pPing < 150
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400';

                          return (
                            <div
                              key={p.id}
                              className={`flex items-center justify-between px-2 py-1 rounded-xl text-[10px] transition-colors ${
                                isMe
                                  ? 'bg-amber-500/10 border border-amber-500/30'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                <div
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/40"
                                  style={{ backgroundColor: p.color || '#cbd5e1' }}
                                />
                                <span className="font-space font-bold truncate max-w-[90px] text-slate-900 dark:text-slate-100">
                                  {p.name}
                                </span>
                                {isMe && (
                                  <span className="text-[7.5px] font-black text-amber-600 dark:text-amber-400 uppercase">
                                    (Sen)
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {p.isHost && (
                                  <span className="text-[7.5px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.2 rounded uppercase">
                                    HOST
                                  </span>
                                )}
                                {p.isBot ? (
                                  <span className="text-[7.5px] font-bold text-slate-400 bg-slate-500/10 px-1 py-0.2 rounded font-jetbrains">
                                    BOT
                                  </span>
                                ) : (
                                  <div className={`flex items-center gap-1 font-jetbrains font-bold ${textColor}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                    <span>{p.isHost ? '0 ms' : `${pPing} ms`}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Alt Bilgi: Bağlantı Türü */}
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[8px] text-slate-500 dark:text-slate-400 font-jetbrains">
                        <span>Bağlantı Türü:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {network?.isHost ? 'Yerel Sunucu (Host)' : network?.isRelayActive ? 'Röle Sunucusu' : 'WebRTC P2P'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base sm:text-xl font-black font-jetbrains text-emerald-700 dark:text-emerald-400 drop-shadow-xs">
                  {myPlayer.money?.toLocaleString('tr-TR')} ₺
                </span>
                {currentTile && (
                  <span className="text-[9.5px] text-slate-600 dark:text-slate-400 font-bold truncate max-w-[110px]" title={currentTile.name}>
                    📍 {currentTile.name}
                  </span>
                )}
              </div>
              <span className="text-[8px] text-amber-600 dark:text-amber-400 font-bold mt-0.5 opacity-80">📊 Geçmişi gör →</span>
            </div>
          </div>
        </div>
      )}

      {/* Sol Alt Para Geçmişi Modalı */}
      {showMyMoneyHistory && myPlayer && (() => {
        const history = (myPlayer.moneyHistory && myPlayer.moneyHistory.length > 0)
          ? myPlayer.moneyHistory
          : myMoneyHistoryRef.current;
        return (
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center p-3"
            onClick={() => setShowMyMoneyHistory(false)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
              className="relative z-10 w-full max-w-sm max-h-[80vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl leading-none">{myPlayer.avatar || myPlayer.token?.icon || '👷'}</span>
                  <div>
                    <div className="font-black text-sm text-slate-900 dark:text-slate-100 font-space">{myPlayer.name} — Bakiye Geçmişim</div>
                    <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-jetbrains">{myPlayer.money?.toLocaleString('tr-TR')} ₺ güncel bakiye</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowMyMoneyHistory(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer text-slate-500 dark:text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Body */}
              <div className="overflow-y-auto flex-1 p-3 space-y-2 custom-scrollbar">
                {history.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-8 font-medium">Henüz kayıtlı para hareketi yok.</p>
                ) : (
                  [...history].reverse().map((entry, i) => (
                    <div
                      key={i}
                      className={`flex flex-col gap-1 px-3 py-2 rounded-2xl text-xs border ${
                        entry.delta > 0
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50'
                          : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50'
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <span className={`flex-shrink-0 font-bold mt-0.5 ${entry.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {entry.delta > 0 ? '↑' : '↓'}
                        </span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold leading-snug break-words">{entry.reason}</span>
                      </div>
                      <div className="flex items-center justify-between pl-4">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-jetbrains">{entry.time}</span>
                        <span className={`font-black font-jetbrains text-xs ${entry.delta > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                          {entry.delta > 0 ? '+' : ''}{entry.delta.toLocaleString('tr-TR')} ₺
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 text-center text-[10px] text-slate-400 dark:text-slate-500 font-jetbrains bg-slate-50/50 dark:bg-slate-850/50">
                Son {history.length} işlem kaydı
              </div>
            </div>
          </div>
        );
      })()}

      {/* 🛠️ DevTools Kalıcı Tetikleyici Butonu (Ekranın En Sağ Altı - Saydam & Erişilebilir) */}
      {devToolsUnlocked && (
        <button
          onClick={() => setShowDevTools(prev => !prev)}
          className="fixed bottom-3 right-3 z-50 p-2.5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/95 text-amber-400 border border-amber-500/40 hover:border-amber-400 shadow-xl backdrop-blur-md flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-90 hover:scale-105 opacity-60 hover:opacity-100 select-none group"
          title="Müteahhit DevTools Test Panelini Aç / Kapat"
        >
          <Wrench className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
        </button>
      )}

      {/* 🛠️ DevTools Modal */}
      {showDevTools && (
        <ErrorBoundary name="Geliştirici Araçları" fallback={null}>
          <Suspense fallback={null}>
            <DevToolsModal
              isOpen={showDevTools}
              onClose={() => setShowDevTools(false)}
              gameState={gameState}
              myPlayerId={myPlayerId}
              network={network}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}
