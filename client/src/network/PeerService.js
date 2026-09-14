/**
 * Müteahhit Online — PeerJS P2P Ağ Katmanı
 * ==========================================
 * Authoritative Host (Yetkili İstemci) topolojisi.
 * Tüm oyun mantığı Host'un tarayıcısında çalışır; Client'lar yalnızca
 * intent (niyet) gönderir ve Host'tan gelen state'i render eder.
 *
 * Topoloji: Yıldız (Star)
 *   Client ─DataChannel─► Host (MonopolyGame) ─DataChannel─► Client(ler)
 *
 * Sinyal: PeerJS Cloud (0.peerjs.com) veya konfigürasyon ile özel sunucu.
 *
 * Host Migration: Host koptuğunda en uzun süredir bağlı Client yeni Host olur.
 *   Yeni Host eski game state'i alır ve MonopolyGame'i yeniden oluşturur.
 */

import Peer from 'peerjs';
import { MonopolyGame } from '../game/MonopolyGame.js';
import {
  MSG, ACTION,
  createAction, createSyncState, createChatMessage,
  createKicked, createHostDropped, createHostMigrated, createEvent,
  createPing, createPong
} from './protocol.js';

// ─── ICE Sunucuları (STUN + TURN) ───────────────────────────────────────────
// STUN: Kendi public IP'ni öğrenmek için (basit NAT çalışır)
// TURN: Symmetric NAT (Türkiye CGNAT gibi) için ZORUNLU relay sunucusu
//
// Türkiye ISP'leri (Türk Telekom, Turkcell, Vodafone TR) büyük oranda
// Symmetric NAT / CGNAT kullanır. Bu durumda STUN tek başına yetersiz,
// trafik TURN relay'den geçmek zorunda.
const ICE_SERVERS = [
  // ── STUN ──────────────────────────────────────────────────────────────────
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' },

  // ── TURN — Open Relay (ucretsiz, kimlik dogrulama gerektirmez) ────────────
  // Symmetric NAT durumunda tum trafik bu relay uzerinden gecer.
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  // TCP fallback: 443 portu guvenlik duvarlarinda genellikle acik
  {
    urls: 'turns:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const DEFAULT_BACKEND_HOST = 'muteahhit-online-backend.onrender.com';

/**
 * Arkadaş davet linki oluşturur.
 * Yerel ortamda veya Cloudflare pages.dev (Türkiye'de bazı ISS'lerde DNS engeli/çözümleme sorunu olan)
 * üzerindeyken, tüm ISS'lerde doğrudan DNS çözülen Render domain'ini hedefler.
 */
export function getShareableInviteUrl(roomCode) {
  if (typeof window === 'undefined' || !roomCode) return '';
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');

  if (isLocal || hostname.includes('pages.dev')) {
    return `https://${DEFAULT_BACKEND_HOST}/?room=${encodeURIComponent(roomCode)}`;
  }

  return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`;
}

function resolveBackendHost() {
  const envHost = import.meta.env.VITE_PEER_HOST;
  if (envHost && envHost.trim()) return envHost.trim();

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
  if (isLocalhost) {
    return 'localhost';
  }

  // Eğer doğrudan Render domain'indeyse o domain, Cloudflare Pages (*.pages.dev)
  // veya başka bir statik CDN üzerindeyse Render backend'ini hedefle!
  if (hostname.includes('onrender.com')) {
    return hostname;
  }
  return DEFAULT_BACKEND_HOST;
}

function resolveBackendPort() {
  const envPort = import.meta.env.VITE_PEER_PORT;
  if (envPort) return Number(envPort);

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
  if (isLocalhost) {
    return 3000;
  }
  return 443;
}

export function getPeerConfig() {
  const host = resolveBackendHost();
  const port = resolveBackendPort();
  const isLocalhost = host === 'localhost';

  return {
    host,
    port,
    path: import.meta.env.VITE_PEER_PATH || '/peerjs',
    secure: !isLocalhost,
    debug: 0,
    config: { iceServers: ICE_SERVERS, iceCandidatePoolSize: 2 },
  };
}

// ─── WebSocket Relay Bağlantısı ───────────────────────────────────────────────
// WebRTC P2P bağlantısı kurulamadığında (WARP, GoodbyeDPI, CGNAT, firewall)
// Render sunucusu üzerinden mesaj iletimi için fallback transport.
//
// Kullanım: Host ve Client aynı relay odaya katılır.
// Host SYNC_STATE'i relay:broadcast ile gönderir (herkese iletilir).
// Client ACTION'ı relay:msg ile gönderir (sadece diğerlerine iletilir).

function getRelayUrl() {
  const host = resolveBackendHost();
  const port = resolveBackendPort();
  const isLocalhost = host === 'localhost';

  if (isLocalhost) {
    return `ws://localhost:${port}/wsrelay`;
  }
  const protocol = (import.meta.env.VITE_PEER_SECURE === 'false') ? 'ws:' : 'wss:';
  return `${protocol}//${host}/wsrelay`;
}

class RelayConnection {
  constructor({ roomCode, playerId, onMessage, onConnected, onDisconnected, onError }) {
    this._roomCode = roomCode;
    this._playerId = playerId;
    this._onMessage = onMessage;
    this._onConnected = onConnected;
    this._onDisconnected = onDisconnected;
    this._onError = onError;
    this._connected = false;
    this._destroyed = false;
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
    this._sendQueue = [];
    this._ws = null;

    this._onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !this._destroyed) {
        if (!this._connected || this._ws?.readyState !== WebSocket.OPEN) {
          console.log('[Relay] Sekme ön plana geçti, bağlantı tazeleniyor...');
          this._connect();
        } else {
          this.ping();
        }
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibilityChange);
      window.addEventListener('online', this._onVisibilityChange);
    }

    this._connect();
  }

  _connect() {
    if (this._destroyed) return;
    try {
      this._ws = new WebSocket(getRelayUrl());
    } catch (e) {
      console.error('[Relay] WebSocket açılamadı:', e);
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      if (this._destroyed) { this._ws.close(); return; }
      this._reconnectAttempts = 0;
      this._ws.send(JSON.stringify({ type: 'relay:join', roomCode: this._roomCode, playerId: this._playerId }));
      this._startHeartbeat();
    };

    this._ws.onmessage = (e) => {
      if (this._destroyed) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'relay:joined') {
          this._connected = true;
          this._flushQueue();
          this._onConnected?.();
        } else if (msg.type === 'relay:pong') {
          const rtt = Math.max(1, Date.now() - (msg.t0 || Date.now()));
          this._onPong?.(rtt);
        } else if (msg.type === 'relay:keepalive') {
          // Sunucu keepalive mesajına pong gönder
          if (this._ws?.readyState === WebSocket.OPEN) {
            try { this._ws.send(JSON.stringify({ type: 'relay:pong', t0: msg.t })); } catch (_) {}
          }
        } else if (msg.type === 'relay:peer_left') {
          this._onMessage?.({ type: 'relay:peer_left', playerId: msg.playerId }, msg.playerId);
        } else if (msg.type === 'relay:msg') {
          this._onMessage?.(msg.payload, msg.from);
        }
      } catch (err) {
        console.warn('[Relay] Mesaj parse hatası:', err);
      }
    };

    this._ws.onclose = () => {
      this._connected = false;
      this._stopHeartbeat();
      if (!this._destroyed) {
        this._onDisconnected?.();
        this._scheduleReconnect();
      }
    };

    this._ws.onerror = (e) => {
      console.warn('[Relay] WebSocket bağlantı uyarısı/hatası:', e?.message || e);
      this._connected = false;
    };
  }

  _scheduleReconnect() {
    if (this._destroyed || this._reconnectTimer) return;
    const delay = Math.min(800 * Math.pow(1.3, this._reconnectAttempts), 4000);
    this._reconnectAttempts++;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this._destroyed) {
        this._connect();
      }
    }, delay);
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    // Render/Cloudflare 100s zaman aşımını önlemek için 6 saniyede bir ping gönder
    this._heartbeatTimer = setInterval(() => {
      if (this._ws?.readyState === WebSocket.OPEN) {
        try {
          this._ws.send(JSON.stringify({ type: 'relay:ping', t0: Date.now() }));
        } catch (_) {}
      }
    }, 6000);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  _flushQueue() {
    if (this._ws?.readyState === WebSocket.OPEN && this._connected && this._sendQueue.length > 0) {
      while (this._sendQueue.length > 0) {
        const item = this._sendQueue.shift();
        try {
          this._ws.send(JSON.stringify(item));
        } catch (_) {
          break;
        }
      }
    }
  }

  /** Sadece diğer katılımcılara gönder (Client ACTION için) */
  send(payload, targetId = null) {
    const data = { type: 'relay:msg', payload };
    if (targetId) data.targetId = targetId;
    if (this._ws?.readyState === WebSocket.OPEN) {
      try {
        this._ws.send(JSON.stringify(data));
      } catch (e) {
        console.warn('[Relay] send hatası:', e);
        if (this._sendQueue.length < 50) this._sendQueue.push(data);
      }
    } else if (!this._destroyed) {
      if (this._sendQueue.length < 50) this._sendQueue.push(data);
    }
  }

  /** Tüm odaya yayınla — host hariç dahil (Host SYNC_STATE için) */
  broadcast(payload, targetId = null) {
    const data = { type: 'relay:broadcast', payload };
    if (targetId) data.targetId = targetId;
    if (this._ws?.readyState === WebSocket.OPEN) {
      try {
        this._ws.send(JSON.stringify(data));
      } catch (e) {
        console.warn('[Relay] broadcast hatası:', e);
        if (this._sendQueue.length < 50) this._sendQueue.push(data);
      }
    } else if (!this._destroyed) {
      if (this._sendQueue.length < 50) this._sendQueue.push(data);
    }
  }

  /** Relay sunucusuna ping gönder ve RTT süresini ölç */
  ping(onPong) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      if (onPong) this._onPong = onPong;
      try {
        this._ws.send(JSON.stringify({ type: 'relay:ping', t0: Date.now() }));
      } catch (_) {}
    }
  }

  get isConnected() { return Boolean(this._connected && this._ws?.readyState === WebSocket.OPEN); }

  destroy() {
    this._destroyed = true;
    this._stopHeartbeat();
    if (this._onVisibilityChange && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
      window.removeEventListener('online', this._onVisibilityChange);
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._sendQueue = [];
    this._connected = false;
    try { this._ws?.close(); } catch {}
  }
}

/**
 * 6 karakterlik oda kodu oluşturur (PeerJS Peer ID olarak kullanılır).
 * Karıştırılabilir karakterlerden kaçınılmıştır: 0/O, 1/I/L, vs.
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─── HostPeerService ─────────────────────────────────────────────────────────

/**
 * Oda kuran (Host) oyuncunun ağ servisi.
 * MonopolyGame instance'ını yönetir ve tüm istemcilere state broadcast eder.
 */
export class HostPeerService {
  /**
   * @param {object} opts
   * @param {string} opts.playerName  - Host oyuncunun adı
   * @param {object} opts.token       - Seçilen piyon tokeni
   * @param {string} opts.color       - Seçilen renk
   * @param {function} opts.onState   - (gameState) => void  — state değişimini bildir
   * @param {function} opts.onChat    - (message) => void    — sohbet mesajı
   * @param {function} opts.onError   - (error) => void      — bağlantı hatası
   * @param {function} opts.onReady   - (roomCode) => void   — Host hazır
   * @param {function} opts.onMyId    - (peerId) => void     — peer ID atandı
   * @param {object} [opts.migratedState] - Host Migration: devralınan game state
   * @param {string} [opts.migratedRoomCode] - Host Migration: korunacak oda kodu
   */
  constructor({
    playerName,
    token,
    color,
    onState,
    onChat,
    onError,
    onReady,
    onMyId,
    onPing,
    sessionToken,
    migratedState = null,
    migratedRoomCode = null,
  }) {
    this._playerName = playerName;
    this._token = token;
    this._color = color;
    this._sessionToken = sessionToken || (() => {
      try {
        let st = localStorage.getItem('muteahhit_session_token');
        if (!st) {
          st = 'st_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
          localStorage.setItem('muteahhit_session_token', st);
        }
        return st;
      } catch (_) {
        return null;
      }
    })();
    this._onState = onState || (() => {});
    this._onChat = onChat || (() => {});
    this._onError = onError || (() => {});
    this._onReady = onReady || (() => {});
    this._onMyId = onMyId || (() => {});
    this._onPing = onPing || (() => {});

    this._pingInterval = null;

    /** @type {Map<string, import('peerjs').DataConnection>} peerId -> connection */
    this._connections = new Map();

    /** @type {Map<string, { id: string, name: string }>} peerId -> spectator */
    this._spectators = new Map();

    /** Bağlantı sırası: Host Migration için en uzun bağlı client'ı bilmek amacıyla */
    this._connectionOrder = [];

    /** @type {MonopolyGame | null} */
    this._game = null;

    /** Bot watchdog timer handle */
    this._watchdogInterval = null;
    /** Oyunda yalnızca bot kaldığında (veya kimse kalmadığında) 2dk sayaç başlangıcı */
    this._onlyBotsStartTime = null;

    /** Spam koruması: son sohbet zamanı */
    this._lastChatTime = new Map();

    /** @type {import('peerjs').Peer} */
    this._peer = null;

    this._roomCode = migratedRoomCode || generateRoomCode();
    this._migratedState = migratedState;

    /** Kopan istemciler için 60 saniyelik tolerans/yeniden bağlanma zamanlayıcıları */
    this._disconnectTimers = new Map();

    /** Oyuncu son etkinlik zamanı takibi (WebRTC + Relay birleşik) */
    this._playerLastActivity = new Map();

    /** Çift kanal aksiyon tekilleştirme: tekrarlanan eylemleri engelle */
    this._processedActionIds = new Set();

    /** PeerJS conn.peer -> Game Player ID eşleme haritası */
    this._peerIdToPlayerId = new Map();

    /** WebSocket Relay fromRelayId -> Game Player ID eşleme haritası */
    this._relayIdToPlayerId = new Map();

    this._init();
  }

  get roomCode() { return this._roomCode; }
  get peerId() { return this._peer?.id || this._roomCode; }
  get game() { return this._game; }
  get isHost() { return true; }

  _init() {
    // 0. Host F5 veya Migration ile odayı geri yüklüyorsa oyunu DERHAL (0ms) ayağa kaldır
    if (this._migratedState && !this._game) {
      this._setupGame(this._roomCode);
      this._onMyId(this._roomCode);
      this._onReady(this._roomCode);
    }

    // 1. WebSocket Relay odasını DERHAL kur — Host'un odası Render üzerinde hemen aktif olsun
    this._relay = new RelayConnection({
      roomCode: this._roomCode,
      playerId: this._roomCode,
      onMessage: (payload, fromRelayId) => {
        if (!payload) return;
        // Sunucu tarafından iletilen oyuncu ayrıldı / soket kapandı bildirimi
        if (payload.type === 'relay:peer_left' && payload.playerId) {
          const pid = payload.playerId;
          console.warn(`[HostPeerService] Relay: oyuncu soketi kapandı bildirimi: ${pid}`);
          // 1. Oyuncu WebRTC DataChannel üzerinden hala açıksa oyunu asla kesintiye uğratma
          const mappedId = this._relayIdToPlayerId?.get(pid) || this._peerIdToPlayerId?.get(pid) || pid;
          const p = this._game?.players?.find(x => x.id === pid || x.id === mappedId);
          const hasOpenWebRTC = Array.from(this._connections.values()).some(c => c?.open && (c.peer === pid || c.peer === mappedId || (p && c.peer === p.id)));
          if (hasOpenWebRTC) {
            console.log(`[HostPeerService] ${p?.name || pid} WebRTC DataChannel üzerinden hala bağlı, kopma tetiklenmedi.`);
            return;
          }
          // 2. İstemcinin Relay yeniden bağlanması (reconnect 800ms) için 6 saniyelik tolerans tanı
          setTimeout(() => {
            const lastAct = p ? Math.max(
              this._playerLastActivity.get(p.id) || 0,
              this._playerLastActivity.get(p.sessionToken) || 0,
              this._playerLastActivity.get(p.name) || 0
            ) : 0;
            if (Date.now() - lastAct > 6000 && !this._disconnectTimers.has(p?.id || pid)) {
              this._handleClientDisconnect(pid);
            }
          }, 6000);
          return;
        }
        if (fromRelayId && !payload.senderId) {
          payload.senderId = fromRelayId;
        }
        // Relay üzerinden gelen ACTION, PING, CHAT vb. tüm mesajları işle
        if (payload.type === MSG.ACTION || payload.type === MSG.PING || payload.type === MSG.CHAT) {
          this._handleMessage(payload, null, fromRelayId);
        }
      },
      onConnected: () => {
        console.log(`[HostPeerService] Relay odasına bağlandı: ${this._roomCode}`);
        // Eğer Host F5 veya Migration ile odayı geri yüklüyorsa oyunu Relay üzerinden hemen ayağa kaldır
        if (!this._game) {
          this._setupGame(this._roomCode);
          this._onMyId(this._roomCode);
          this._onReady(this._roomCode);
        }
        setTimeout(() => {
          if (!this._destroyed && this._game) {
            this._broadcastState();
          }
        }, 300);
      },
      onDisconnected: () => console.warn('[HostPeerService] Relay bağlantısı geçici koptu (otomatik yeniden bağlanılıyor)...'),
    });

    // 2. WebRTC PeerJS bağlantısını paralel olarak başlat
    this._initPeerJS();
  }

  _initPeerJS() {
    if (this._destroyed) return;
    try {
      const config = getPeerConfig();
      this._peer = new Peer(this._roomCode, config);

      // Sinyal sunucusunun LEAVE mesajı yollayarak WebRTC DataChannel'ı zorla kapatmasını engelle:
      const origHandleMessage = this._peer._handleMessage?.bind(this._peer);
      if (origHandleMessage) {
        this._peer._handleMessage = (message) => {
          if (message?.type === 'LEAVE') {
            console.warn(`[HostPeerService] Sinyal sunucusundan LEAVE alındı (${message.src}), ancak P2P/Relay oyun bağlantısı KORUNUYOR.`);
            return;
          }
          return origHandleMessage(message);
        };
      }

      this._peer.on('open', (id) => {
        this._onMyId(id);
        if (!this._game) {
          this._setupGame(id);
        }
        this._onReady(id);

        // Host Ping ölçümü (Relay bağlıysa sunucu RTT, yoksa yerel 1 ms)
        if (!this._pingInterval) {
          this._pingInterval = setInterval(() => {
            const updateHostPing = (rtt) => {
              this._onPing(rtt);
              if (this._game && id) {
                this._game.updatePlayerPing(id, rtt);
              }
            };
            if (this._relay?.isConnected) {
              this._relay.ping((rtt) => updateHostPing(rtt));
            } else {
              updateHostPing(1);
            }
          }, 2500);
          this._onPing(1);
        }
      });

      this._peer.on('connection', (conn) => {
        this._handleIncomingConnection(conn);
      });

      this._peer.on('error', (err) => {
        console.error('[HostPeerService] PeerJS error:', err.type, err);
        if (err.type === 'unavailable-id') {
          // F5 kurtarması veya Host Migration durumunda oda kodunu ASLA rastgele değiştirme!
          if (this._migratedRoomCode || this._migratedState) {
            console.warn(`[HostPeerService] ${this._roomCode} Peer ID sinyal sunucusunda henüz serbest kalmadı. Oyun Relay üzerinden devam ediyor, WebRTC 2sn sonra tekrar denenecek.`);
            if (!this._game) {
              this._setupGame(this._roomCode);
              this._onMyId(this._roomCode);
              this._onReady(this._roomCode);
            }
            setTimeout(() => {
              if (!this._destroyed) {
                try { this._peer?.destroy(); } catch (_) {}
                this._initPeerJS();
              }
            }, 2000);
            return;
          }
          // Sıfırdan yeni oda açarken rastgele kod çakışması — yeni kod dene
          this._roomCode = generateRoomCode();
          try { this._peer?.destroy(); } catch (_) {}
          this._init();
          return;
        }
        if (err.type === 'network' || (err.message && err.message.includes('Lost connection'))) {
          console.warn('[HostPeerService] Sinyal sunucusu bağlantısı koptu (Host oyunu kesintiye uğramaz). Yeniden bağlanılıyor...');
          try { this._peer?.reconnect(); } catch (_) {}
          return;
        }
        // Oyun/Lobi zaten aktifse, tekil bir istemcinin bağlantı kopması veya STUN/TURN hatası yüzünden
        // Host'un kendi odasını kapatma ve host'a hata ekranı gösterme!
        if (this._game) {
          console.warn('[HostPeerService] İstemci bağlantı/ICE uyarısı göz ardı edildi (Host aktif kalıyor):', err.type || err.message);
          return;
        }
        this._onError(err);
      });

      this._peer.on('disconnected', () => {
        console.warn('[HostPeerService] Sinyal sunucusuyla bağlantı koptu, yeniden deneniyor...');
        try { this._peer?.reconnect(); } catch (_) {}
      });
    } catch (e) {
      console.warn('[HostPeerService] PeerJS başlatma hatası, Relay omurgası ile devam ediliyor:', e);
      if (!this._game && (this._migratedRoomCode || this._migratedState)) {
        this._setupGame(this._roomCode);
        this._onMyId(this._roomCode);
        this._onReady(this._roomCode);
      }
    }
  }

  _setupGame(hostPeerId) {
    this._game = new MonopolyGame(this._roomCode);

    // Host F5 Yenilemesi veya Host Migration: eski durumu eksiksiz geri yükle
    if (this._migratedState) {
      this._restoreFromState(this._migratedState, hostPeerId);
    } else {
      // Normal akış: Host'u ilk oyuncu olarak ekle
      this._game.addPlayer(
        hostPeerId, this._playerName, this._token, this._color, false, this._sessionToken
      );
    }

    try {
      const now = Date.now();
      if (this._sessionToken) localStorage.setItem('muteahhit_session_token', this._sessionToken);
      localStorage.setItem('muteahhit_room_code', this._roomCode);
      localStorage.setItem('muteahhit_is_host_' + this._roomCode, '1');
      localStorage.setItem('muteahhit_host_room', this._roomCode);
      localStorage.setItem('muteahhit_host_saved_at_' + this._roomCode, String(now));
    } catch (_) {}

    this._startWatchdog();
    this._broadcastState();
  }

  /**
   * Host F5 Yenilemesi ve Host Migration: Oyun durumunu eksiksiz devralır.
   */
  _restoreFromState(state, newHostPeerId) {
    try {
      const loaded = this._game.loadState(state);
      if (loaded) {
        console.log(`[HostPeerService] Oyun durumu başarıyla geri yüklendi (${this._game.status}, ${this._game.players?.length} oyuncu).`);

        // Host oyuncuyu tespit et ve yeni soket/peer ID'si ile eşle
        const hostPlayer = this._game.players?.find(p => p.isHost || (this._sessionToken && p.sessionToken === this._sessionToken) || p.name === this._playerName);
        if (hostPlayer) {
          const oldHostId = hostPlayer.id;
          hostPlayer.id = newHostPeerId;
          hostPlayer.isHost = true;
          if (this._sessionToken) hostPlayer.sessionToken = this._sessionToken;

          this._peerIdToPlayerId.set(oldHostId, newHostPeerId);
          this._peerIdToPlayerId.set(newHostPeerId, newHostPeerId);
          if (hostPlayer.sessionToken) {
            this._peerIdToPlayerId.set(hostPlayer.sessionToken, newHostPeerId);
          }

          // Mülk sahipliklerini güncelle
          for (const tileId in this._game.properties) {
            if (this._game.properties[tileId].ownerId === oldHostId) {
              this._game.properties[tileId].ownerId = newHostPeerId;
            }
          }

          if (oldHostId !== newHostPeerId) {
            if (this._game.pendingLoan) {
              if (this._game.pendingLoan.borrowerId === oldHostId) this._game.pendingLoan.borrowerId = newHostPeerId;
              if (this._game.pendingLoan.lenderId === oldHostId) this._game.pendingLoan.lenderId = newHostPeerId;
            }
            if (this._game.pendingTrade) {
              if (this._game.pendingTrade.fromPlayerId === oldHostId) this._game.pendingTrade.fromPlayerId = newHostPeerId;
              if (this._game.pendingTrade.toPlayerId === oldHostId) this._game.pendingTrade.toPlayerId = newHostPeerId;
            }
            if (this._game.auction) {
              if (this._game.auction.highestBidderId === oldHostId) this._game.auction.highestBidderId = newHostPeerId;
              if (this._game.auction.sellerId === oldHostId) this._game.auction.sellerId = newHostPeerId;
              if (this._game.auction.passedPlayerIds) {
                this._game.auction.passedPlayerIds = this._game.auction.passedPlayerIds.map(id => (id === oldHostId ? newHostPeerId : id));
              }
            }
            if (this._game.lastRentPayment) {
              if (this._game.lastRentPayment.ownerId === oldHostId) this._game.lastRentPayment.ownerId = newHostPeerId;
              if (this._game.lastRentPayment.fromPlayerId === oldHostId) this._game.lastRentPayment.fromPlayerId = newHostPeerId;
              if (this._game.lastRentPayment.toPlayerId === oldHostId) this._game.lastRentPayment.toPlayerId = newHostPeerId;
            }
          }
        }

        // F5 sonrası tüm oyuncuların canlılık takibini sıfırla (watchdog'un erken atmasını önler)
        const now = Date.now();
        for (const p of this._game.players) {
          this._playerLastActivity.set(p.id, now);
          if (p.sessionToken) this._playerLastActivity.set(p.sessionToken, now);
          if (p.name) this._playerLastActivity.set(p.name, now);
        }

        this._game.addLog(`🔄 Oda yöneticisi (Host) sayfayı yenileyerek oyuna tekrar bağlandı.`, 'info');
      } else {
        // Geri yükleme başarısız olursa güvenli fallback
        if (state.players) {
          for (const p of state.players) {
            if (!p.isBot && !p.isBankrupt) {
              this._game.addPlayer(p.id, p.name, p.token, p.color, false, p.sessionToken);
            }
          }
        }
      }
    } catch (e) {
      console.error('[HostPeerService] State restore hatası:', e);
    }
  }

  _handleIncomingConnection(conn) {
    const peerId = conn.peer;
    this._connections.set(peerId, conn);
    if (!this._connectionOrder.includes(peerId)) {
      this._connectionOrder.push(peerId);
    }
    // Eğer bu oyuncu için bir kopma geri sayımı varsa hemen iptal et (DataChannel tekrar kuruldu)
    if (this._disconnectTimers.has(peerId)) {
      clearTimeout(this._disconnectTimers.get(peerId));
      this._disconnectTimers.delete(peerId);
      console.log(`[HostPeerService] ${peerId} WebRTC DataChannel üzerinden tekrar aktif oldu.`);
      if (this._game?.disconnectNotice?.playerId === peerId) {
        const p = this._game.players.find(x => x.id === peerId);
        const pName = p?.name || 'Oyuncu';
        this._game.disconnectNotice = null;
        this._game.addLog(`🟢 ${pName} oyuna tekrar bağlandı!`, 'info');
        this._broadcastState();
      }
    }

    const sendInitialState = () => {
      if (this._game) {
        this._sendTo(conn, createSyncState(this._game.getPublicState()));
      }
    };
    if (conn.open) {
      sendInitialState();
    } else {
      conn.on('open', sendInitialState);
    }

    conn.on('data', (msg) => {
      this._handleMessage(msg, conn);
    });

    conn.on('close', () => {
      console.warn(`[HostPeerService] ${peerId} WebRTC DataChannel kapandı. Relay ve canlılık durumu kontrol ediliyor...`);
      this._connections.delete(peerId);
      const mappedId = this._peerIdToPlayerId?.get(peerId) || peerId;
      const p = this._game?.players?.find(x => x.id === peerId || x.id === mappedId);
      const lastAct = p ? Math.max(
        this._playerLastActivity.get(p.id) || 0,
        this._playerLastActivity.get(p.sessionToken) || 0,
        this._playerLastActivity.get(p.name) || 0
      ) : 0;
      // Eğer oyuncu WebSocket Relay üzerinden hala aktifse, oyunu asla kesintiye uğratma
      if (this._relay?.isConnected && (Date.now() - lastAct < 20000)) {
        console.log(`[HostPeerService] ${p?.name || peerId} WebSocket Relay üzerinden aktif kalmaya devam ediyor.`);
        return;
      }
      // Hemen kesme, 8 saniyelik tolerans tanı (WebRTC yeniden bağlanma veya Relay fallback için)
      setTimeout(() => {
        const stillActive = p ? Math.max(
          this._playerLastActivity.get(p.id) || 0,
          this._playerLastActivity.get(p.sessionToken) || 0,
          this._playerLastActivity.get(p.name) || 0
        ) : 0;
        if (Date.now() - stillActive > 15000 && !this._connections.has(peerId) && !this._disconnectTimers.has(p?.id || peerId)) {
          this._handleClientDisconnect(peerId);
        }
      }, 8000);
    });

    conn.on('error', (err) => {
      console.warn('[HostPeerService] WebRTC DataChannel hatası (sessiz):', peerId, err?.message || err);
      // conn.on('close') zaten tetiklenecektir, doğrudan kopma işlemi başlatma
    });
  }

  _handleMessage(msg, conn, fromRelayId = null) {
    if (!msg) return;

    // Ping isteğine anında Pong ile cevap ver ve gönderici canlılığını kaydet
    if (msg.type === MSG.PING) {
      const now = Date.now();
      const sender = conn?.peer || fromRelayId || msg.senderId;
      if (sender) {
        this._playerLastActivity.set(sender, now);
        const mapped = this._peerIdToPlayerId?.get(sender) || this._relayIdToPlayerId?.get(sender);
        const p = this._game?.players?.find(x => x.id === sender || x.id === mapped || (x.sessionToken && x.sessionToken.includes(String(sender).replace(/^p_/, ''))));
        if (p) {
          if (p.id) this._playerLastActivity.set(p.id, now);
          if (p.sessionToken) this._playerLastActivity.set(p.sessionToken, now);
          if (p.name) this._playerLastActivity.set(p.name, now);
        }
      }
      const pong = createPong(msg.t0);
      if (conn) {
        this._sendTo(conn, pong);
      } else if (this._relay?.isConnected && fromRelayId) {
        // FIX: broadcast yerine sadece ping'i gönderene hedefli yanıt ver
        this._relay.send(pong, fromRelayId);
      }
      return;
    }

    if (msg.type !== MSG.ACTION) return;
    const { action, payload, senderId, actionId } = msg;
    const game = this._game;
    if (!game) return;

    // Aksiyon tekilleştirme: Çift kanaldan (WebRTC + Relay) gelebilecek aynı aksiyonu 2 kez çalıştırma
    if (actionId) {
      if (this._processedActionIds.has(actionId)) return;
      this._processedActionIds.add(actionId);
      if (this._processedActionIds.size > 500) {
        const first = this._processedActionIds.values().next().value;
        this._processedActionIds.delete(first);
      }
    }

    // Gönderici oyuncuyu kesin ve güvenli olarak tespit et
    let effectiveSenderId = senderId || conn?.peer || fromRelayId;
    let senderPlayer = game.players?.find(p => p.id === effectiveSenderId);
    if (!senderPlayer) {
      const token = payload?.sessionToken || msg?.sessionToken;
      if (token) {
        senderPlayer = game.players?.find(p => p.sessionToken === token);
      }
      if (!senderPlayer && conn?.peer) {
        senderPlayer = game.players?.find(p => p.id === conn.peer);
      }
      if (!senderPlayer && fromRelayId) {
        senderPlayer = game.players?.find(p => p.id === fromRelayId);
      }
      if (!senderPlayer && payload?.playerName) {
        senderPlayer = game.players?.find(p => !p.isBot && p.name === payload.playerName);
      }
      if (senderPlayer) {
        effectiveSenderId = senderPlayer.id;
      }
    }

    if (senderPlayer) {
      effectiveSenderId = senderPlayer.id;
      if (fromRelayId) {
        this._relayIdToPlayerId.set(fromRelayId, senderPlayer.id);
        this._peerIdToPlayerId.set(fromRelayId, senderPlayer.id);
      }
      if (senderPlayer.sessionToken) {
        this._peerIdToPlayerId.set(senderPlayer.sessionToken, senderPlayer.id);
      }
      if (conn?.peer) {
        this._peerIdToPlayerId.set(conn.peer, senderPlayer.id);
      }
    }

    if (conn) {
      if (conn.peer) this._connections.set(conn.peer, conn);
      if (effectiveSenderId) this._connections.set(effectiveSenderId, conn);
      if (conn.peer && effectiveSenderId) this._peerIdToPlayerId.set(conn.peer, effectiveSenderId);
    }

    // Oyuncu yeni bir bağlantı/transport ID'si ile gelmişse (reconnect / relay fallback),
    // motor üzerindeki ID'yi, mülk sahipliklerini ve aktif bağlantıyı derhal senkronize et:
    const incomingConnId = senderId || fromRelayId || conn?.peer;
    if ((action === ACTION.JOIN_LOBBY || action === ACTION.REQUEST_STATE) && senderPlayer && incomingConnId && senderPlayer.id !== incomingConnId && action !== ACTION.LEAVE_ROOM) {
      const oldPlayerId = senderPlayer.id;
      console.log(`[HostPeerService] Oyuncu transport/ID senkronizasyonu: ${senderPlayer.name} (${oldPlayerId} -> ${incomingConnId})`);
      game.reconnectPlayer(incomingConnId, senderPlayer.sessionToken, senderPlayer.name);
      if (conn) {
        this._connections.delete(oldPlayerId);
        this._connections.set(incomingConnId, conn);
      }
      effectiveSenderId = incomingConnId;
      senderPlayer = game.players.find(p => p.id === incomingConnId);
    }

    // Oyuncu herhangi bir kanaldan (WebRTC veya Relay) mesaj yolladıysa son etkinlik zamanını güncelle ve kopma sayacını iptal et
    const activeSender = effectiveSenderId || senderId || conn?.peer || fromRelayId;
    if (activeSender) {
      const now = Date.now();
      this._playerLastActivity.set(activeSender, now);
      const p = senderPlayer || this._game.players?.find(x => x.id === activeSender);
      if (p?.sessionToken) this._playerLastActivity.set(p.sessionToken, now);
      if (p?.name) this._playerLastActivity.set(p.name, now);
      if (p?.id) this._playerLastActivity.set(p.id, now);

      if (this._disconnectTimers.has(activeSender)) {
        clearTimeout(this._disconnectTimers.get(activeSender));
        this._disconnectTimers.delete(activeSender);
        console.log(`[HostPeerService] ${activeSender} aktif mesaj gönderdi, kopma geri sayımı iptal edildi.`);
      }
      if (senderPlayer && this._disconnectTimers.has(senderPlayer.id)) {
        clearTimeout(this._disconnectTimers.get(senderPlayer.id));
        this._disconnectTimers.delete(senderPlayer.id);
      }
      if (this._game.disconnectNotice && (
        this._game.disconnectNotice.playerId === activeSender ||
        (senderPlayer && this._game.disconnectNotice.playerId === senderPlayer.id) ||
        (p && this._game.disconnectNotice.playerName === p.name)
      )) {
        const pName = p?.name || senderPlayer?.name || 'Oyuncu';
        this._game.disconnectNotice = null;
        this._game.addLog(`🟢 ${pName} oyuna tekrar bağlandı!`, 'info');
        this._broadcastState();
      }
    }

    let broadcastNeeded = true;
    let botTriggerNeeded = false;

    try {
      switch (action) {
        // ─ Oda Yönetimi ─
        case ACTION.JOIN_LOBBY: {
          const { playerName, token, color, sessionToken } = payload;
          const joinId = fromRelayId || senderId || conn?.peer;

          // 1. F5 / Yeniden Bağlanma Kontrolü:
          // Önce sessionToken, yoksa playerName ile odada önceden var olan oyuncuyu bul
          let existingPlayer = null;
          if (sessionToken) {
            existingPlayer = game.players.find(p => p.sessionToken === sessionToken);
          }
          if (!existingPlayer && playerName) {
            existingPlayer = game.players.find(p => p.name === playerName && !p.isBot);
          }

          if (existingPlayer) {
            const oldPeerId = existingPlayer.id;
            console.log(`[HostPeerService] ${existingPlayer.name} (${oldPeerId} -> ${joinId}) F5 / Reconnect ile bağlandı!`);

            // Kopma sayacını durdur
            if (this._disconnectTimers.has(oldPeerId)) {
              clearTimeout(this._disconnectTimers.get(oldPeerId));
              this._disconnectTimers.delete(oldPeerId);
            }

            const recRes = game.reconnectPlayer(joinId, existingPlayer.sessionToken, playerName);
            if (recRes.success) {
              if (game.disconnectNotice?.playerId === oldPeerId || game.disconnectNotice?.playerName === existingPlayer.name) {
                game.disconnectNotice = null;
              }

              // Eski bağlantıyı temizle ve yeni bağlantıyı kaydet
              const oldConn = this._connections.get(oldPeerId);
              if (oldConn && oldConn !== conn) {
                try { oldConn.close(); } catch (_) {}
                this._connections.delete(oldPeerId);
              }
              if (conn) {
                this._connections.set(joinId, conn);
              }

              if (fromRelayId) {
                this._relayIdToPlayerId.set(fromRelayId, existingPlayer.id);
                this._peerIdToPlayerId.set(fromRelayId, existingPlayer.id);
              }
              if (conn?.peer) {
                this._peerIdToPlayerId.set(conn.peer, existingPlayer.id);
              }
              if (existingPlayer.sessionToken) {
                this._peerIdToPlayerId.set(existingPlayer.sessionToken, existingPlayer.id);
              }

              // İstemciye session token'ını ve son oyun durumunu HEM WebRTC HEM Relay üzerinden doğrudan bildir
              const publicState = game.getPublicState();
              const syncMsg = createSyncState(publicState);
              const sessionTokenMsg = {
                type: MSG.EVENT,
                event: 'SESSION_TOKEN',
                payload: { sessionToken: existingPlayer.sessionToken },
                targetId: joinId
              };
              if (conn) {
                this._sendTo(conn, sessionTokenMsg);
                this._sendTo(conn, syncMsg);
              }
              if (this._relay?.isConnected) {
                this._relay.send(sessionTokenMsg, joinId);
                this._relay.send(syncMsg, joinId);
                this._relay.broadcast(syncMsg);
              }

              this._broadcastState();
              break;
            }
          }

          // 2. Oyun devam ederken katılan yeni kişiler -> İZLEYİCİ (SPECTATOR)
          if (game.status !== 'lobby') {
            const specName = playerName || `İzleyici ${this._spectators.size + 1}`;
            this._spectators.set(joinId, { id: joinId, name: specName });
            game.spectatorCount = this._spectators.size;
            console.log(`[HostPeerService] ${specName} (${joinId}) maçı izlemeye başladı. Toplam İzleyici: ${this._spectators.size}`);
            game.addLog(`👁️ ${specName} maçı izlemeye başladı.`, 'info');

            const spectatorEvent = {
              type: MSG.EVENT,
              event: 'SPECTATOR_JOINED',
              payload: { isSpectator: true, spectatorCount: this._spectators.size },
              targetId: joinId
            };
            const currentPublicState = game.getPublicState();
            const syncStateMsg = createSyncState(currentPublicState);

            if (conn) {
              this._sendTo(conn, spectatorEvent);
              this._sendTo(conn, syncStateMsg);
            }
            if (this._relay?.isConnected) {
              this._relay.send(spectatorEvent, joinId);
              this._relay.send(syncStateMsg, joinId);
              // Güvence: Relay odasındaki herkese de broadcast et (joinId hedef eşleşmeme riskine karşı)
              this._relay.broadcast(syncStateMsg);
            }
            this._broadcastState();
            break;
          }

          // 3. Lobi aşamasında normal yeni oyuncu katılımı
          const res = game.addPlayer(joinId, playerName, token, color, false, sessionToken);
          if (res.success && res.player) {
            if (fromRelayId) {
              this._relayIdToPlayerId.set(fromRelayId, res.player.id);
              this._peerIdToPlayerId.set(fromRelayId, res.player.id);
            }
            if (conn?.peer) {
              this._peerIdToPlayerId.set(conn.peer, res.player.id);
            }
            if (res.player.sessionToken) {
              this._peerIdToPlayerId.set(res.player.sessionToken, res.player.id);
            }

            const tokenMsg = {
              type: MSG.EVENT,
              event: 'SESSION_TOKEN',
              payload: { sessionToken: res.player.sessionToken },
              targetId: joinId
            };
            if (conn) {
              this._sendTo(conn, tokenMsg);
            }
            if (this._relay?.isConnected) {
              this._relay.send(tokenMsg, joinId);
            }
          }
          break;
        }

        case ACTION.REQUEST_STATE: {
          broadcastNeeded = false;
          const publicState = game.getPublicState();
          const syncMsg = createSyncState(publicState);
          if (conn) {
            this._sendTo(conn, syncMsg);
          }
          if (this._relay?.isConnected) {
            this._relay.send(syncMsg, fromRelayId || senderId);
            this._relay.broadcast(syncMsg);
          }
          break;
        }

        case ACTION.LEAVE_ROOM: {
          game.removePlayer(effectiveSenderId);
          this._connections.get(effectiveSenderId)?.close();
          this._connections.delete(effectiveSenderId);
          break;
        }

        case ACTION.ADD_BOT: {
          const { difficulty } = payload;
          const me = game.players.find(p => p.id === senderId);
          if (!me?.isHost) { broadcastNeeded = false; break; }
          game.addBot(difficulty || 'orta');
          break;
        }

        case ACTION.REMOVE_BOT: {
          game.removeBot(payload.botId, senderId);
          break;
        }

        case ACTION.KICK_PLAYER: {
          const { targetPlayerId } = payload;
          const isPlaying = game.status === 'playing';
          const res = game.kickPlayer(senderId, targetPlayerId);
          if (res.success) {
            const reasonMsg = isPlaying
              ? 'Oda kurucusu tarafından oyundan atıldınız.'
              : 'Oda kurucusu tarafından lobiden atıldınız.';
            const targetConn = this._connections.get(targetPlayerId);
            if (targetConn) {
              this._sendTo(targetConn, createKicked(reasonMsg));
              targetConn.close();
            } else if (this._relay?.isConnected) {
              this._relay.send(createKicked(reasonMsg), targetPlayerId);
            }
            broadcastNeeded = true;
          }
          break;
        }

        case ACTION.UPDATE_PROFILE: {
          game.updatePlayerProfile(senderId, payload);
          break;
        }

        case ACTION.UPDATE_PING: {
          broadcastNeeded = false;
          if (payload?.ping && senderId) {
            game.updatePlayerPing(senderId, payload.ping);
            const now = Date.now();
            if (!this._lastPingBroadcastTime || now - this._lastPingBroadcastTime > 15000) {
              this._lastPingBroadcastTime = now;
              broadcastNeeded = true;
            }
          }
          break;
        }

        case ACTION.SET_BOT_DIFFICULTY: {
          game.setBotDifficulty(payload.botId, payload.difficulty);
          break;
        }

        case ACTION.START_GAME: {
          game.startGame(effectiveSenderId);
          botTriggerNeeded = true;
          break;
        }

        case ACTION.RESTART_GAME: {
          const player = game.players.find(p => p.id === effectiveSenderId);
          if (game.status === 'ended' || player?.isHost) {
            game.resetGameToLobby(effectiveSenderId);
          }
          break;
        }

        // ─ Oyun Mekaniği ─
        case ACTION.ROLL_DICE: {
          if (game.phase === 'TURN_ACTIONS' && game.canRollAgain) {
            game.endTurn(effectiveSenderId);
          }
          const allowCustom = Boolean(game.isDevMode);
          game.rollDice(effectiveSenderId, allowCustom ? payload?.dice : undefined, allowCustom ? payload?.toss : undefined);
          this._broadcastToAll({
            type: MSG.EVENT,
            event: 'DICE_ROLL',
            payload: { values: game.dice, rollId: game.lastDiceRollId }
          });
          botTriggerNeeded = true;
          break;
        }

        case ACTION.ROLL_AGAIN: {
          const allowCustom2 = Boolean(game.isDevMode);
          if (game.phase === 'TURN_ACTIONS' && game.canRollAgain) {
            game.endTurn(effectiveSenderId);
            game.rollDice(effectiveSenderId, allowCustom2 ? payload?.dice : undefined, allowCustom2 ? payload?.toss : undefined);
          } else {
            game.rollDice(effectiveSenderId, allowCustom2 ? payload?.dice : undefined, allowCustom2 ? payload?.toss : undefined);
          }
          this._broadcastToAll({
            type: MSG.EVENT,
            event: 'DICE_ROLL',
            payload: { values: game.dice, rollId: game.lastDiceRollId }
          });
          botTriggerNeeded = true;
          break;
        }

        case ACTION.BUY_PROPERTY: {
          const res = game.buyCurrentProperty(effectiveSenderId);
          if (!res?.success) {
            console.warn('[HostPeerService] buyCurrentProperty hatası:', res?.error, 'sender:', effectiveSenderId);
            if (res?.error) {
              game.addLog(`⚠️ Satın alma gerçekleştirilemedi: ${res.error}`, 'info');
            }
          }
          break;
        }

        case ACTION.DECLINE_BUY: {
          const res = game.declineBuy(effectiveSenderId);
          if (!res?.success) {
            console.warn('[HostPeerService] declineBuy hatası:', res?.error, 'sender:', effectiveSenderId);
          }
          break;
        }

        case ACTION.END_TURN: {
          const res = game.endTurn(effectiveSenderId);
          if (!res?.success) {
            console.warn('[HostPeerService] endTurn hatası:', res?.error, 'sender:', effectiveSenderId);
          }
          botTriggerNeeded = true;
          break;
        }

        case ACTION.ACKNOWLEDGE_CARD:
          game.acknowledgeCard(effectiveSenderId);
          botTriggerNeeded = true;
          break;

        case ACTION.TOGGLE_PAUSE:
          game.togglePause(effectiveSenderId);
          botTriggerNeeded = true;
          break;

        case ACTION.SKIP_BOT_TURN:
          game.fastForwardBotTurn(() => this._broadcastState());
          botTriggerNeeded = true;
          break;

        case ACTION.TIMEOUT_TURN: {
          if (game.status !== 'playing' || game.isPaused) { broadcastNeeded = false; break; }
          const active = game.getActivePlayer();
          if (active?.id === effectiveSenderId) {
            game.forceTimeoutTurn(effectiveSenderId);
            botTriggerNeeded = true;
          }
          break;
        }

        case ACTION.TIMEOUT_AUCTION: {
          if (game.status !== 'playing' || game.isPaused) { broadcastNeeded = false; break; }
          if (game.phase === 'AUCTION' && game.auction) {
            const elapsed = (Date.now() - (game.auction.lastBidTime || Date.now())) / 1000;
            if (elapsed >= (game.auction.timer || 15) - 0.5) {
              game.endAuction();
              botTriggerNeeded = true;
            }
          }
          break;
        }

        // ─ Mülk ─
        case ACTION.BUILD_HOUSE: {
          const tid = Number.parseInt(payload.tileId, 10);
          if (Number.isInteger(tid) && tid >= 0 && tid <= 39) {
            const res = game.buildHouse(effectiveSenderId, tid);
            if (!res?.success) {
              console.warn('[HostPeerService] buildHouse hatası:', res?.error, 'sender:', effectiveSenderId);
              if (res?.error) {
                game.addLog(`⚠️ İnşaat gerçekleştirilemedi: ${res.error}`, 'info');
              }
            }
          }
          break;
        }

        case ACTION.SELL_HOUSE: {
          const tid2 = Number.parseInt(payload.tileId, 10);
          if (Number.isInteger(tid2) && tid2 >= 0 && tid2 <= 39) {
            const res = game.sellHouse(effectiveSenderId, tid2);
            if (!res?.success) {
              console.warn('[HostPeerService] sellHouse hatası:', res?.error, 'sender:', effectiveSenderId);
            }
          }
          break;
        }

        case ACTION.MORTGAGE: {
          const tid3 = Number.parseInt(payload.tileId, 10);
          if (Number.isInteger(tid3) && tid3 >= 0 && tid3 <= 39) {
            const res = game.mortgageProperty(effectiveSenderId, tid3);
            if (!res?.success) {
              console.warn('[HostPeerService] mortgageProperty hatası:', res?.error, 'sender:', effectiveSenderId);
            }
          }
          break;
        }

        case ACTION.UNMORTGAGE: {
          const tid4 = Number.parseInt(payload.tileId, 10);
          if (Number.isInteger(tid4) && tid4 >= 0 && tid4 <= 39) {
            const res = game.unmortgageProperty(effectiveSenderId, tid4);
            if (!res?.success) {
              console.warn('[HostPeerService] unmortgageProperty hatası:', res?.error, 'sender:', effectiveSenderId);
            }
          }
          break;
        }

        case ACTION.AUTO_MORTGAGE:
          game.autoMortgage(effectiveSenderId);
          break;

        // ─ Hapis ─
        case ACTION.PAY_JAIL_FINE:
          game.payJailFine(effectiveSenderId);
          break;

        case ACTION.USE_JAIL_CARD:
          game.useJailCard(effectiveSenderId);
          break;

        // ─ Takas ─
        case ACTION.PROPOSE_TRADE: {
          const tradeRes = game.proposeTrade(effectiveSenderId, payload);
          if (tradeRes?.success && payload?.toPlayerId) {
            const targetBot = game.players.find(p => p.id === payload.toPlayerId && p.isBot);
            if (targetBot && !targetBot.isBankrupt) {
              setTimeout(() => {
                if (game.pendingTrade?.toPlayerId === targetBot.id) {
                  game.evaluateBotTrade(targetBot.id);
                  this._broadcastState();
                }
              }, 400);
            }
          }
          break;
        }

        case ACTION.RESPOND_TRADE:
          game.respondTrade(effectiveSenderId, payload.accept);
          break;

        case ACTION.CANCEL_TRADE:
          game.cancelTrade(effectiveSenderId);
          break;

        // ─ Hediye & Kredi ─
        case ACTION.SEND_GIFT: {
          const amt = Number(payload.amount);
          if (Number.isFinite(amt) && amt > 0) game.sendGift(effectiveSenderId, payload.toPlayerId, amt);
          break;
        }

        case ACTION.REQUEST_LOAN: {
          const lamt = Number(payload.amount);
          if (Number.isFinite(lamt) && lamt > 0) game.requestLoan(effectiveSenderId, payload.toPlayerId, lamt);
          break;
        }

        case ACTION.RESPOND_LOAN:
          game.respondLoan(effectiveSenderId, payload.accept);
          break;

        case ACTION.PAY_LOAN:
          if (payload.loanId) game.payLoan(effectiveSenderId, payload.loanId);
          break;

        case ACTION.REQUEST_BANK_LOAN: {
          const bamt = Number(payload.amount);
          if (Number.isFinite(bamt) && bamt > 0) game.requestBankLoan(effectiveSenderId, bamt);
          break;
        }

        // ─ Açık Artırma ─
        case ACTION.START_PLAYER_AUCTION: {
          const stid = Number.parseInt(payload.tileId, 10);
          const sbid = Number(payload.startingBid);
          if (Number.isInteger(stid) && stid >= 0 && stid <= 39 && Number.isFinite(sbid) && sbid >= 0) {
            game.startPlayerPropertyAuction(effectiveSenderId, stid, sbid);
          }
          break;
        }

        case ACTION.PLACE_BID: {
          const bidAmt = Number(payload.bidAmount ?? payload.amount);
          if (Number.isFinite(bidAmt) && bidAmt > 0) {
            game.placeBid(effectiveSenderId, bidAmt);
            if (game.phase !== 'AUCTION') botTriggerNeeded = true;
          }
          break;
        }

        case ACTION.PASS_AUCTION:
          game.passAuction(effectiveSenderId);
          if (game.phase !== 'AUCTION') botTriggerNeeded = true;
          break;

        // ─ Sohbet ─
        case ACTION.SEND_CHAT: {
          broadcastNeeded = false;
          const lastChat = this._lastChatTime.get(effectiveSenderId) || 0;
          const now = Date.now();
          if (now - lastChat < 400) break;
          this._lastChatTime.set(effectiveSenderId, now);

          const sender = game.players.find(p => p.id === effectiveSenderId);
          const spectator = this._spectators?.get(effectiveSenderId);
          const cleanText = String(payload.message || '').trim().substring(0, 300);
          if (!cleanText) break;

          const gameTime = game.formatGameElapsed ? game.formatGameElapsed(now) : '00:00';
          const chatMsg = {
            id: Math.random().toString(36).substring(2, 9),
            senderName: sender ? sender.name : (spectator?.name ? `👁️ ${spectator.name}` : 'İzleyici'),
            senderColor: sender ? sender.color : '#38bdf8',
            text: cleanText,
            time: gameTime,
            timestamp: now
          };
          // Host dahil herkese broadcast et
          this._broadcastChat(chatMsg);
          break;
        }

        // ─ İflas ─
        case ACTION.DECLARE_BANKRUPTCY:
          game.declareBankruptcy(effectiveSenderId);
          botTriggerNeeded = true;
          break;

        // ─ Dev Tools ─
        case ACTION.DEV_COMMAND: {
          const player = game.players.find(p => p.id === effectiveSenderId);
          if (!player?.isHost) { broadcastNeeded = false; break; }
          game.executeDevCommand(payload.command, payload.payload);
          botTriggerNeeded = true;
          break;
        }

        default:
          console.warn('[HostPeerService] Bilinmeyen action:', action);
          broadcastNeeded = false;
      }
    } catch (err) {
      console.error('[HostPeerService] Action işleme hatası:', action, err);
    }

    if (broadcastNeeded) {
      this._broadcastState();
    }

    if (botTriggerNeeded) {
      this._triggerBotIfNeeded();
    }
  }

  _handleClientDisconnect(rawId) {
    if (!rawId) return;
    const mappedId = this._peerIdToPlayerId?.get(rawId) || this._relayIdToPlayerId?.get(rawId) || rawId;
    this._connections.delete(rawId);
    this._connections.delete(mappedId);
    this._connectionOrder = this._connectionOrder.filter(id => id !== rawId && id !== mappedId);

    // 1. İzleyici ayrıldıysa: ASLA kopma uyarısı veya geri sayım başlatma!
    if (this._spectators?.has(rawId) || this._spectators?.has(mappedId)) {
      const spec = this._spectators.get(rawId) || this._spectators.get(mappedId);
      this._spectators.delete(rawId);
      this._spectators.delete(mappedId);
      console.log(`[HostPeerService] İzleyici ayrıldı: ${spec?.name || rawId}. Kalan İzleyici: ${this._spectators.size}`);
      if (this._game) {
        this._game.spectatorCount = this._spectators.size;
        this._broadcastState();
      }
      return;
    }

    // 2. Oyuncuyu bul (ID, mappedId, sessionToken, partial token veya isim üzerinden)
    let player = this._game?.players?.find(p => {
      if (p.isHost || p.isBot) return false;
      if (p.id === rawId || p.id === mappedId) return true;
      if (p.sessionToken && (p.sessionToken === rawId || p.sessionToken === mappedId)) return true;
      // ClientPeerService._myId formatı: 'p_' + sessionToken.slice(3, 11)
      if (typeof rawId === 'string' && rawId.startsWith('p_') && p.sessionToken && p.sessionToken.includes(rawId.slice(2))) return true;
      if (typeof mappedId === 'string' && mappedId.startsWith('p_') && p.sessionToken && p.sessionToken.includes(mappedId.slice(2))) return true;
      if (p.name && (p.name === rawId || p.name === mappedId)) return true;
      return false;
    });

    if (!player || player.isHost || player.isBot || player.isBankrupt || player.isKicked) {
      return;
    }

    const playerId = player.id;
    const playerName = player.name || 'Bir oyuncunun';

    // Eğer bu oyuncu için zaten aktif bir kopma geri sayımı varsa devam etsin
    if (this._disconnectTimers.has(playerId)) return;

    console.warn(`[HostPeerService] ${playerName} (${playerId}) bağlantısı koptu! 60sn geri sayım başlatılıyor...`);

    // 1. Aşama: Herkese kompakt bildirim gönder (bağlantı kesildi, 60 saniye bekleniyor)
    if (this._game) {
      this._game.disconnectNotice = {
        type: 'disconnecting',
        playerId: playerId,
        playerName: playerName,
        expiresAt: Date.now() + 60000,
        remainingSeconds: 60,
      };
      this._game.addLog(`⚠️ ${playerName} bağlantısı kesildi, yeniden bağlanması bekleniyor (60sn)...`, 'warning');
      this._broadcastState();
    }

    // 60 saniye tolerans tanı (Relay fallback veya WebRTC yeniden bağlanma için)
    const timer = setTimeout(() => {
      this._disconnectTimers.delete(playerId);
      this._lastChatTime.delete(playerId);

      // 60 saniye dolduğunda son bir kontrol: Oyuncu bu esnada bağlandıysa atma!
      const finalActive = Math.max(
        this._playerLastActivity.get(playerId) || 0,
        this._playerLastActivity.get(player.sessionToken) || 0,
        this._playerLastActivity.get(player.name) || 0
      );
      if (Date.now() - finalActive < 8000) {
        console.log(`[HostPeerService] ${playerName} 60sn doldu fakat son 8sn içinde aktif bulundu, oyundan atılmadı.`);
        if (this._game?.disconnectNotice?.playerId === playerId) {
          this._game.disconnectNotice = null;
          this._broadcastState();
        }
        return;
      }

      if (this._game) {
        console.warn(`[HostPeerService] ${playerId} 60 saniye içinde yeniden bağlanamadı, oyundan tamamen çıkarılıyor.`);
        // 2. Aşama: 60 saniye dolunca "atıldı" bildirimi ve oyundan tamamen çıkarma (iflas & piyon tasfiyesi)
        this._game.disconnectNotice = {
          type: 'kicked',
          playerId: playerId,
          playerName: playerName,
          timestamp: Date.now(),
        };
        this._game.addLog(`❌ ${playerName} 60 saniye içinde bağlanamadığı için oyundan atıldı.`, 'warning');
        this._game.removePlayer(playerId);
        this._broadcastState();
        this._triggerBotIfNeeded();

        // 6 saniye sonra bildirimi tahtadan temizle
        setTimeout(() => {
          if (this._game?.disconnectNotice?.type === 'kicked') {
            this._game.disconnectNotice = null;
            this._broadcastState();
          }
        }, 6000);
      }
    }, 60000);

    this._disconnectTimers.set(playerId, timer);
  }

  _broadcastState() {
    if (!this._game) return;
    this._game.spectatorCount = this._spectators ? this._spectators.size : 0;
    const state = this._game.getPublicState();
    this._onState(state); // Host'un kendi UI'ını güncelle

    // Host F5 ve kesintisiz oturum kurtarma için son geçerli durumu localStorage'a kaydet
    if (this._roomCode) {
      try {
        const now = Date.now();
        state.savedAt = now;
        localStorage.setItem('muteahhit_is_host_' + this._roomCode, '1');
        localStorage.setItem('muteahhit_host_room', this._roomCode);
        localStorage.setItem('muteahhit_host_state_' + this._roomCode, JSON.stringify(state));
        localStorage.setItem('muteahhit_host_saved_at_' + this._roomCode, String(now));
      } catch (_) {}
    }

    const msg = createSyncState(state);
    // WebRTC DataChannel üzerinden doğrudan gönder
    for (const conn of this._connections.values()) {
      this._sendTo(conn, msg);
    }
    // WebSocket Relay üzerinden de her zaman gönder (Relay bağlıysa)
    if (this._relay?.isConnected) {
      this._relay.broadcast(msg);
    }

    // Bot açık artırma tetikleme
    if (this._game.phase === 'AUCTION' && this._game.auction) {
      this._game.triggerBotAuction(() => {
        const s2 = this._game.getPublicState();
        this._onState(s2);
        if (this._roomCode) {
          try {
            const now2 = Date.now();
            s2.savedAt = now2;
            localStorage.setItem('muteahhit_host_state_' + this._roomCode, JSON.stringify(s2));
            localStorage.setItem('muteahhit_host_saved_at_' + this._roomCode, String(now2));
          } catch (_) {}
        }
        const m2 = createSyncState(s2);
        for (const c of this._connections.values()) this._sendTo(c, m2);
        // FIX: Bot auction sonucu Relay'e de yayınla (önceden eksikti)
        if (this._relay?.isConnected) this._relay.broadcast(m2);
      });
    }
  }

  /**
   * Hem WebRTC (DataChannel) hem WebSocket Relay üzerinden tüm bağlı client'lara mesaj yayınlar.
   * _broadcastState()'den farklı olarak game state değil, EVENT gibi özel mesajlar için kullanılır.
   * @param {object} msg - Gönderilecek mesaj objesi
   */
  _broadcastToAll(msg) {
    for (const conn of this._connections.values()) {
      this._sendTo(conn, msg);
    }
    if (this._relay?.isConnected) {
      this._relay.broadcast(msg);
    }
  }

  _broadcastChat(message) {
    this._onChat(message); // Host'un kendi sohbet listesini güncelle
    const msg = createChatMessage(message);
    for (const conn of this._connections.values()) {
      this._sendTo(conn, msg);
    }
    if (this._relay?.isConnected) {
      this._relay.broadcast(msg);
    }
  }

  _triggerBotIfNeeded() {
    const game = this._game;
    if (!game || game.status !== 'playing' || game.isPaused) return;
    if (game.phase === 'AUCTION') return;
    const active = game.getActivePlayer();
    if (active?.isBot && !active.isBankrupt) {
      game.triggerBotTurn(() => {
        this._broadcastState();
        this._triggerBotIfNeeded();
      });
    }
  }

  _startWatchdog() {
    this._stopWatchdog();
    this._watchdogInterval = setInterval(() => {
      const game = this._game;
      if (!game) return;
      try {
        const now = Date.now();

        // 1. Canlı Geri Sayım Senkronizasyonu (Tüm istemcilerde saniye saniye geri sayımı güncelle)
        if (game.disconnectNotice && game.disconnectNotice.type === 'disconnecting' && game.disconnectNotice.expiresAt) {
          const remaining = Math.max(0, Math.ceil((game.disconnectNotice.expiresAt - now) / 1000));
          if (game.disconnectNotice.remainingSeconds !== remaining) {
            game.disconnectNotice.remainingSeconds = remaining;
            this._broadcastState();
          }
        }

        // 2. Oyuncu Canlılık / Hareketsizlik Kontrolü (Inactivity Liveness Check)
        // WebRTC ve Relay üzerinden belirli süre ping/aksiyon yollamayan aktif insan oyuncular
        if (game.players && game.players.length > 0) {
          for (const p of game.players) {
            if (p.isBot || p.isBankrupt || p.isKicked || p.isHost || p.id === this._peer?.id) continue;
            let lastActive = Math.max(
              this._playerLastActivity.get(p.id) || 0,
              this._playerLastActivity.get(p.sessionToken) || 0,
              this._playerLastActivity.get(p.name) || 0
            );
            // Reverse mapping ile ilişkili tüm peer ve relay ID'lerini de tara
            for (const [key, val] of this._playerLastActivity.entries()) {
              if (this._peerIdToPlayerId?.get(key) === p.id || this._relayIdToPlayerId?.get(key) === p.id) {
                if (val > lastActive) lastActive = val;
              }
            }
            if (!lastActive) {
              this._playerLastActivity.set(p.id, now);
              continue;
            }
            // 8.5 saniye çok hassastı (mobil gecikmelerinde / arka planda anında bildirim çıkmasına yol açıyordu).
            // 25 saniye tolerans tanı (mobil / arka sekme / hücresel veri dalgalanmalarını tolere eder).
            if (now - lastActive > 25000 && !this._disconnectTimers.has(p.id)) {
              console.warn(`[HostPeerService] ${p.name} 25 saniyedir sessiz, bağlantı kesildi işlemi başlatılıyor...`);
              this._handleClientDisconnect(p.id);
            }
          }
        }

        // 3. Yalnızca Bot Kalma / Boş Oda Zaman Aşımı (2 Dakika Grace Period)
        // Eğer oyunda aktif hiç insan oyuncu kalmadıysa (sadece botlar varsa veya tüm insanlar iflas ettiyse/ayrıldıysa)
        if (game.status === 'playing') {
          const activeHumans = game.players?.filter(p => !p.isBot && !p.isBankrupt && !p.isKicked) || [];
          if (activeHumans.length === 0) {
            if (!this._onlyBotsStartTime) {
              this._onlyBotsStartTime = now;
              console.warn('[HostPeerService] Oyunda aktif insan oyuncu kalmadı (sadece botlar var). 2dk süre sınırı başladı.');
            } else if (now - this._onlyBotsStartTime > 120000) {
              console.warn('[HostPeerService] Oyunda 2 dakikadır sadece botlar var / kimse yok. Oturum sonlandırılıyor.');
              this._game.addLog('⌛ Oyunda aktif insan oyuncu kalmadığı için 2 dakikalık süre sınırı doldu ve oyun sonlandırıldı.', 'warning');
              this._game.status = 'ended';
              this._broadcastState();
              if (this._roomCode) {
                try {
                  localStorage.removeItem('muteahhit_is_host_' + this._roomCode);
                  localStorage.removeItem('muteahhit_host_state_' + this._roomCode);
                  localStorage.removeItem('muteahhit_host_saved_at_' + this._roomCode);
                  localStorage.removeItem('muteahhit_host_room');
                } catch (_) {}
              }
              return;
            }
          } else {
            this._onlyBotsStartTime = null;
          }
        }

        if (game.status !== 'playing' || game.isPaused) return;

        if (game.phase === 'AUCTION' && game.auction) {
          const elapsed = (Date.now() - (game.auction.lastBidTime || Date.now())) / 1000;
          if (elapsed >= (game.auction.timer || 15)) {
            game.endAuction();
            this._broadcastState();
            this._triggerBotIfNeeded();
          }
        } else {
          const active = game.getActivePlayer();
          if (active && !active.isBot) {
            const elapsed = (Date.now() - game.turnStartTime) / 1000;
            if (elapsed >= (game.turnTimeLimit || 75)) {
              game.forceTimeoutTurn(active.id);
              this._broadcastState();
              this._triggerBotIfNeeded();
            }
          }
          // Bot watchdog: 10 saniye takılı kalırsa zorla ilerlet
          if (active?.isBot && game.phase !== 'AUCTION') {
            const elapsed = (Date.now() - game.turnStartTime) / 1000;
            if (elapsed > 10) {
              console.warn(`[WATCHDOG] Bot ${active.name} ${elapsed.toFixed(0)}s takılı — kurtarılıyor`);
              game.fastForwardBotTurn();
              this._broadcastState();
              this._triggerBotIfNeeded();
            }
          }
        }
      } catch (err) {
        console.error('[WATCHDOG] Hata:', err);
      }
    }, 500);
  }

  _stopWatchdog() {
    this._onlyBotsStartTime = null;
    if (this._watchdogInterval) {
      clearInterval(this._watchdogInterval);
      this._watchdogInterval = null;
    }
  }

  _sendTo(conn, msg) {
    try {
      if (conn.open) {
        conn.send(msg);
      }
    } catch (e) {
      console.error('[HostPeerService] Gönderme hatası:', e);
    }
  }

  /**
   * Host'un kendi kendine bir action göndermesi (kendi arayüzünden tetiklenen eylemler).
   * Client'ların sendAction() ile eşdeğer, ancak doğrudan game'e gider.
   * @param {string} action - ACTION sabitlerinden biri
   * @param {object} payload - Eyleme özgü veri
   */
  sendAction(action, payload = {}) {
    const hostId = this._peer?.id;
    if (!hostId) return;
    this._handleMessage(createAction(action, payload, hostId), null);
  }

  /**
   * Odadan ayrıl — tüm bağlantıları kapat ve PeerJS'i yok et.
   * @param {boolean} [isPermanent=false] - true ise oda kalıcı olarak kapatılır (Host ayrıldı mesajı gönderilir ve yerel durum temizlenir). false ise sayfa yenileme (F5) veya geçici durumdur.
   */
  destroy(isPermanent = false) {
    this._destroyed = true;
    this._onState = () => {};
    this._onChat = () => {};
    this._onError = () => {};
    this._onReady = () => {};
    this._onPing = () => {};
    this._onMyId = () => {};
    this._stopWatchdog();
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }

    if (isPermanent) {
      // Kalıcı ayrılma: Yerel Host durum kayıtlarını sil
      try {
        if (this._roomCode) {
          localStorage.removeItem('muteahhit_is_host_' + this._roomCode);
          localStorage.removeItem('muteahhit_host_state_' + this._roomCode);
          localStorage.removeItem('muteahhit_host_saved_at_' + this._roomCode);
        }
        localStorage.removeItem('muteahhit_host_room');
      } catch (_) {}

      // Tüm client'lara host düştü mesajı gönder
      const dropMsg = createHostDropped();
      for (const conn of this._connections.values()) {
        this._sendTo(conn, dropMsg);
        try { conn.close(); } catch (_) {}
      }
      if (this._relay) {
        try {
          if (this._relay.isConnected) this._relay.broadcast(dropMsg);
          this._relay.destroy();
        } catch (_) {}
        this._relay = null;
      }
    } else {
      // F5 Yenilemesi / Geçici Kopma: Client'lara HOST_DROPPED gönderme!
      // Soketleri sessizce kapat, client'lar 30 saniyelik toleransla beklesin
      for (const conn of this._connections.values()) {
        try { conn.close(); } catch (_) {}
      }
      if (this._relay) {
        try { this._relay.destroy(); } catch (_) {}
        this._relay = null;
      }
    }

    for (const timer of this._disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this._disconnectTimers.clear();
    this._connections.clear();
    this._connectionOrder = [];
    try { this._peer?.destroy(); } catch (_) {}
    this._game = null;
  }
}

// ─── ClientPeerService ───────────────────────────────────────────────────────

/**
 * Odaya katılan (Client) oyuncunun ağ servisi.
 * Host'tan gelen state'i yerel olarak saklar ve render için iletir.
 * Yalnızca intent (niyet) mesajları gönderir.
 */
export class ClientPeerService {
  /**
   * @param {object} opts
   * @param {string} opts.hostPeerId     - Bağlanılacak Host'un Peer ID'si (= oda kodu)
   * @param {string} opts.playerName     - Katılan oyuncunun adı
   * @param {object} opts.token          - Seçilen piyon tokeni
   * @param {string} opts.color          - Seçilen renk
   * @param {string} [opts.sessionToken] - F5 / yeniden bağlanma oturum tokeni
   * @param {function} opts.onState      - (gameState) => void
   * @param {function} opts.onChat       - (message) => void
   * @param {function} opts.onKicked     - (reason) => void
   * @param {function} opts.onHostDropped - () => void
   * @param {function} opts.onHostMigrated - (newHostId: string) => void
   * @param {function} opts.onError      - (error) => void
   * @param {function} opts.onConnected  - (peerId: string) => void
   * @param {function} opts.onMyId       - (peerId: string) => void
   */
  constructor({
    hostPeerId,
    playerName,
    token,
    color,
    sessionToken = null,
    onState,
    onChat,
    onKicked,
    onHostDropped,
    onHostMigrated,
    onError,
    onConnected,
    onMyId,
    onPing,
    onSpectator,
  }) {
    this._hostPeerId = hostPeerId;
    this._playerName = playerName;
    this._token = token;
    this._color = color;
    this._sessionToken = sessionToken || (() => {
      try {
        let st = localStorage.getItem('muteahhit_session_token');
        if (!st) {
          st = 'st_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
          localStorage.setItem('muteahhit_session_token', st);
        }
        return st;
      } catch (_) {
        return null;
      }
    })();

    this._onState = onState || (() => {});
    this._onChat = onChat || (() => {});
    this._onKicked = onKicked || (() => {});
    this._onHostDropped = onHostDropped || (() => {});
    this._onHostMigrated = onHostMigrated || (() => {});
    this._onError = onError || (() => {});
    this._onConnected = onConnected || (() => {});
    this._onMyId = onMyId || (() => {});
    this._onPing = onPing || (() => {});
    this._onSpectator = onSpectator || (() => {});
    this.isSpectator = false;

    // Her iki transport (WebRTC + Relay) ve F5 reconnect için sabit, tutarlı istemci kimliği
    this._myId = this._sessionToken ? ('p_' + this._sessionToken.slice(3, 11)) : ('p_' + Math.random().toString(36).substring(2, 10));

    /** @type {import('peerjs').DataConnection | null} */
    this._conn = null;

    /** @type {import('peerjs').Peer} */
    this._peer = null;

    this._pingInterval = null;

    /** @type {RelayConnection | null} */
    this._relay = null;
    this._isConnected = false;
    this._destroyed = false;
    this._initialConnectTimeout = null;
    this._relayReconnectTimeout = null;
    this._hasReceivedState = false;
    this._stateWatchdogTimer = null;
    this._assignedPeerId = null;
    this._lastHostMessageTime = Date.now();

    this._init();
  }

  get peerId() {
    return this._myId || this._assignedPeerId || this._peer?.id || null;
  }
  get isHost() { return false; }
  get isRelayActive() { return Boolean(this._relay?.isConnected); }

  _init() {
    // 1. Kendi kimliğimizi UI'a bildir
    this._onMyId(this._myId);

    // 2. WebSocket Relay'e DERHAL (0ms) bağlan — Render backend üzerinden kesintisiz ana omurga
    this._initRelay();

    // 3. WebRTC PeerJS bağlantısını paralel olarak başlat (P2P düşük gecikme)
    this._initWebRTC();

    // 4. Güvenlik zaman aşımı: 8 saniye boyunca hiçbir kanaldan bağlantı kurulamazsa hata ver
    this._initialConnectTimeout = setTimeout(() => {
      if (!this._isConnected && !this._destroyed) {
        console.warn('[ClientPeerService] 8 saniyede odaya bağlanılamadı.');
        this._onError({ type: 'peer-unavailable', message: 'Oda bulunamadı veya bağlantı kurulamadı.' });
      }
    }, 8000);

    // 5. Sekme ön plana geldiğinde (mobil / arka plandan dönüş) canlılık tazele
    this._onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !this._destroyed) {
        try {
          if (this._conn?.open) {
            this._conn.send(createPing(Date.now(), this._myId));
          }
          if (this._relay?.isConnected) {
            this._relay.send(createPing(Date.now(), this._myId));
            this.sendAction(ACTION.REQUEST_STATE, {});
          }
        } catch (_) {}
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibilityChange);
      window.addEventListener('online', this._onVisibilityChange);
    }
  }

  _initRelay() {
    if (this._destroyed) return;
    this._relay = new RelayConnection({
      roomCode: this._hostPeerId,
      playerId: this._myId,
      onMessage: (payload) => {
        this._handleMessage(payload);
      },
      onConnected: () => {
        if (this._destroyed) return;
        console.log(`[ClientPeerService] WebSocket Relay odasına bağlandı: ${this._hostPeerId}`);
        this._markConnected();
        // Host'a katılım / reconnect bildirimi gönder
        this._relay.send(createAction(ACTION.JOIN_LOBBY, {
          playerName: this._playerName,
          token: this._token,
          color: this._color,
          sessionToken: this._sessionToken,
        }, this._myId));
      },
      onDisconnected: () => {
        console.warn('[ClientPeerService] Relay bağlantısı geçici koptu (otomatik yeniden bağlanılıyor)...');
        if (!this._relayReconnectTimeout && !this._destroyed) {
          this._relayReconnectTimeout = setTimeout(() => {
            this._relayReconnectTimeout = null;
            if (!this._relay?.isConnected && !this._conn?.open && !this._destroyed) {
              console.error('[ClientPeerService] 30 saniye boyunca hiçbir bağlantı kurulamadı, Host koptu kabul ediliyor.');
              this._onHostDropped();
            }
          }, 30000);
        }
      },
      onError: (err) => {
        console.warn('[ClientPeerService] Relay hata:', err);
      }
    });
  }

  _initWebRTC() {
    if (this._destroyed) return;
    try {
      const config = getPeerConfig();
      this._peer = new Peer(config);

      // Sinyal sunucusunun "LEAVE" mesajı yollayarak WebRTC DataChannel'ı zorla kapatmasını engelle:
      const origHandleMessage = this._peer._handleMessage?.bind(this._peer);
      if (origHandleMessage) {
        this._peer._handleMessage = (message) => {
          if (message?.type === 'LEAVE') {
            console.warn('[ClientPeerService] Sinyal sunucusundan LEAVE alındı, aktif oyun bağlantısı korunuyor.');
            return;
          }
          return origHandleMessage(message);
        };
      }

      this._peer.on('open', (id) => {
        if (this._destroyed) return;
        this._assignedPeerId = id;
        this._connectWebRTCToHost();
      });

      this._peer.on('error', (err) => {
        console.warn('[ClientPeerService] PeerJS uyarısı/hatası:', err?.type, err?.message);
        // Relay zaten bağlıysa WebRTC hatası oyunu kesintiye uğratmaz
        if (this._isConnected || this._relay?.isConnected) {
          try { this._peer?.reconnect(); } catch (_) {}
          return;
        }
      });

      this._peer.on('disconnected', () => {
        console.warn('[ClientPeerService] Sinyal sunucusundan koptu, arka planda yeniden bağlanılıyor...');
        try { this._peer?.reconnect(); } catch (_) {}
      });
    } catch (e) {
      console.warn('[ClientPeerService] WebRTC başlatılamadı, Relay omurgası ile devam ediliyor:', e);
    }
  }

  _connectWebRTCToHost() {
    if (this._destroyed || !this._peer) return;
    try {
      const conn = this._peer.connect(this._hostPeerId, {
        reliable: true,
        serialization: 'json',
      });
      this._conn = conn;

      conn.on('open', () => {
        if (this._destroyed) return;
        console.log('[ClientPeerService] WebRTC DataChannel başarıyla kuruldu (P2P aktif)!');
        this._markConnected();
        // Host'a WebRTC üzerinden de katılım gönder
        try {
          conn.send(createAction(ACTION.JOIN_LOBBY, {
            playerName: this._playerName,
            token: this._token,
            color: this._color,
            sessionToken: this._sessionToken,
          }, this._myId));
        } catch (_) {}
      });

      conn.on('data', (msg) => {
        this._handleMessage(msg);
      });

      conn.on('close', () => {
        console.warn('[ClientPeerService] WebRTC DataChannel kapandı. Relay durumu:', this._relay?.isConnected ? 'Aktif (Oyun Devam Ediyor)' : 'Bağlanıyor');
        this._conn = null;
      });

      conn.on('error', (err) => {
        console.warn('[ClientPeerService] WebRTC DataChannel hatası:', err);
        this._conn = null;
      });
    } catch (e) {
      console.warn('[ClientPeerService] WebRTC bağlantı hatası:', e);
    }
  }

  _markConnected() {
    if (this._destroyed) return;
    if (this._initialConnectTimeout) {
      clearTimeout(this._initialConnectTimeout);
      this._initialConnectTimeout = null;
    }
    if (this._relayReconnectTimeout) {
      clearTimeout(this._relayReconnectTimeout);
      this._relayReconnectTimeout = null;
    }
    if (!this._isConnected) {
      this._isConnected = true;
      this._onConnected(this._myId);
      this._startPing();
      this._ensureStateWatchdog();
    }
  }

  _handleMessage(msg) {
    if (!msg || !msg.type) return;
    this._lastHostMessageTime = Date.now();

    // Hedef filtreleme: Eğer bu mesaj belirli bir hedef oyuncuya özelse
    const target = msg.targetId || msg.payload?.targetId;
    if (target) {
      const isForMe = target === this._myId ||
                      target === this._assignedPeerId ||
                      target === this._peer?.id ||
                      (this._sessionToken && target === this._sessionToken);
      if (!isForMe) return;
    }

    switch (msg.type) {
      case MSG.SYNC_STATE:
        this._hasReceivedState = true;
        if (this._stateWatchdogTimer) {
          clearTimeout(this._stateWatchdogTimer);
          this._stateWatchdogTimer = null;
        }
        this._onState(msg.gameState);
        break;

      case MSG.EVENT:
        if (msg.event === 'SESSION_TOKEN' && msg.payload?.sessionToken) {
          this._sessionToken = msg.payload.sessionToken;
          try {
            localStorage.setItem('muteahhit_session_token', msg.payload.sessionToken);
          } catch (_) {}
        } else if (msg.event === 'SPECTATOR_JOINED') {
          this.isSpectator = true;
          this._onSpectator?.(true);
          // İzleyici olarak katıldık — state henüz alınmadıysa watchdog derhal devreye girsin
          if (!this._hasReceivedState) {
            this._ensureStateWatchdog();
          }
        }
        break;

      case MSG.CHAT:
        this._onChat(msg.message);
        break;

      case MSG.KICKED:
        this._onKicked(msg.reason || 'Oda kurucusu tarafından atıldınız.');
        break;

      case MSG.HOST_DROPPED:
        this._onHostDropped();
        break;

      case MSG.HOST_MIGRATED:
        this._onHostMigrated(msg.newHostId);
        break;

      case MSG.ERROR:
        console.error('[ClientPeerService] Host hatası:', msg.code, msg.message);
        break;

      case MSG.PONG:
        if (msg.t0) {
          const rtt = Math.max(1, Date.now() - msg.t0);
          this._onPing(rtt);
          this.sendAction(ACTION.UPDATE_PING, { ping: rtt });
        }
        break;

      default:
        console.warn('[ClientPeerService] Bilinmeyen mesaj tipi:', msg.type);
    }
  }

  _ensureStateWatchdog() {
    if (this._hasReceivedState || this._destroyed) return;
    if (this._stateWatchdogTimer) clearTimeout(this._stateWatchdogTimer);

    let attempt = 0;
    const tryRequestState = () => {
      if (this._hasReceivedState || this._destroyed) return;
      if (!(this._conn?.open || this._relay?.isConnected)) return;

      attempt++;
      console.log(`[ClientPeerService] Oyun durumu henüz alınmadı, durum Host'tan talep ediliyor... (Deneme ${attempt}/6)`);
      this.sendAction(ACTION.REQUEST_STATE, {});

      if (attempt < 6) {
        this._stateWatchdogTimer = setTimeout(tryRequestState, 1500);
      }
    };

    // 800ms sonra ilk denemeyi yap
    this._stateWatchdogTimer = setTimeout(tryRequestState, 800);
  }

  _startPing() {
    this._stopPing();
    this._lastHostMessageTime = Date.now();
    const handlePingResult = (rtt) => {
      this._lastHostMessageTime = Date.now();
      this._onPing(rtt);
      this.sendAction(ACTION.UPDATE_PING, { ping: rtt });
    };

    this._pingInterval = setInterval(() => {
      if (this._relay?.isConnected) {
        this._relay.ping((rtt) => handlePingResult(rtt));
      }
      if (this._conn?.open) {
        try {
          this._conn.send(createPing(Date.now(), this._myId));
        } catch (_) {}
      } else if (this._relay?.isConnected) {
        // WebRTC açık değilse doğrudan Relay üzerinden Host'a PING ilet
        try {
          this._relay.send(createPing(Date.now(), this._myId));
        } catch (_) {}
      }
    }, 2500);

    setTimeout(() => {
      if (this._relay?.isConnected) this._relay.ping((rtt) => handlePingResult(rtt));
      if (this._conn?.open) {
        try { this._conn.send(createPing(Date.now(), this._myId)); } catch (_) {}
      } else if (this._relay?.isConnected) {
        try { this._relay.send(createPing(Date.now(), this._myId)); } catch (_) {}
      }
    }, 300);
  }

  _stopPing() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }

  /**
   * Host'a eylem gönder.
   * Çift kanal (Dual-Transport) mimarisi: Hem WebRTC DataChannel hem WebSocket Relay üzerinden
   * actionId ile gönderilir; Host ilk ulaşanı işleyip diğerini tekilleştirir.
   * @param {string} action - ACTION sabitlerinden biri
   * @param {object} payload - Eyleme özgü veri
   */
  sendAction(action, payload = {}) {
    const actionId = 'act_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    const actionMsg = createAction(action, {
      ...payload,
      sessionToken: this._sessionToken || undefined,
      playerName: this._playerName || undefined
    }, this._myId, actionId);

    let sent = false;

    // 1. WebRTC DataChannel açıksa ultra hızlı gönder
    if (this._conn?.open) {
      try {
        this._conn.send(actionMsg);
        sent = true;
      } catch (e) {
        console.warn('[ClientPeerService] WebRTC send hatası:', e);
      }
    }

    // 2. WebSocket Relay bağlıysa garantili sunucu kanalı üzerinden de gönder
    if (this._relay?.isConnected) {
      try {
        this._relay.send(actionMsg);
        sent = true;
      } catch (e) {
        console.warn('[ClientPeerService] Relay send hatası:', e);
      }
    }

    if (!sent) {
      console.warn('[ClientPeerService] Hiçbir kanal açık değil, mesaj Relay kuyruğuna alınıyor:', action);
      this._relay?.send(actionMsg);
    }
  }

  _send(msg) {
    let sent = false;
    if (this._conn?.open) {
      try {
        this._conn.send(msg);
        sent = true;
      } catch (_) {}
    }
    if (this._relay?.isConnected) {
      try {
        this._relay.send(msg);
        sent = true;
      } catch (_) {}
    }
    return sent;
  }

  /**
   * Odadan ayrıl.
   * @param {boolean} [isPermanent=false] - true ise kalıcı ayrılma bildirimi gönderilir. false ise sayfa yenileme (F5) veya geçici durumdur.
   */
  destroy(isPermanent = false) {
    this._destroyed = true;
    this._onState = () => {};
    this._onChat = () => {};
    this._onKicked = () => {};
    this._onHostDropped = () => {};
    this._onHostMigrated = () => {};
    this._onError = () => {};
    this._onConnected = () => {};
    this._onMyId = () => {};
    this._onPing = () => {};
    this._onSpectator = () => {};
    this._stopPing();
    if (this._onVisibilityChange && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
      window.removeEventListener('online', this._onVisibilityChange);
    }
    if (this._initialConnectTimeout) {
      clearTimeout(this._initialConnectTimeout);
      this._initialConnectTimeout = null;
    }
    if (this._relayReconnectTimeout) {
      clearTimeout(this._relayReconnectTimeout);
      this._relayReconnectTimeout = null;
    }
    if (this._stateWatchdogTimer) {
      clearTimeout(this._stateWatchdogTimer);
      this._stateWatchdogTimer = null;
    }

    if (isPermanent) {
      const leaveMsg = createAction(ACTION.LEAVE_ROOM, {}, this._myId);
      try {
        if (this._conn?.open) {
          this._conn.send(leaveMsg);
          this._conn.close();
        }
      } catch (_) {}

      if (this._relay) {
        try {
          if (this._relay.isConnected) this._relay.send(leaveMsg);
          this._relay.destroy();
        } catch (_) {}
        this._relay = null;
      }
    } else {
      try { if (this._conn?.open) this._conn.close(); } catch (_) {}
      if (this._relay) {
        try { this._relay.destroy(); } catch (_) {}
        this._relay = null;
      }
    }

    try { this._peer?.destroy(); } catch (_) {}
    this._conn = null;
    this._peer = null;
  }
}

