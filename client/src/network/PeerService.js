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

function getPeerConfig() {
  const envHost = import.meta.env.VITE_PEER_HOST;
  const envPort = import.meta.env.VITE_PEER_PORT;
  const envPath = import.meta.env.VITE_PEER_PATH || '/peerjs';

  // Çevre değişkeni ile override
  if (envHost) {
    return {
      host: envHost,
      port: Number(envPort) || 443,
      path: envPath,
      secure: Number(envPort) !== 9000,
      debug: import.meta.env.DEV ? 2 : 0,
      config: { iceServers: ICE_SERVERS },
    };
  }

  // Production otomatik algılama:
  // Sayfa localhost'tan değil gerçek bir domain'den geliyorsa (Render, vb.)
  // kendi sunucumuzdaki /peerjs sinyal endpoint'ini kullan.
  // Bu, PeerJS Cloud (0.peerjs.com) yerine kendi kontrolümüzdeki sunucuyu
  // kullanır — Türkiye'den 0.peerjs.com engellenmiş olsa bile çalışır.
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');

  if (!isLocalhost) {
    return {
      host: hostname,
      port: window.location.port ? Number(window.location.port) : 443,
      path: '/peerjs',
      secure: window.location.protocol === 'https:',
      debug: 0,
      config: { iceServers: ICE_SERVERS },
    };
  }

  // Lokal geliştirme: kendi local sunucusu (npm run dev:server → :3000/peerjs)
  return {
    host: 'localhost',
    port: 3000,
    path: '/peerjs',
    secure: false,
    debug: import.meta.env.DEV ? 2 : 0,
    config: { iceServers: ICE_SERVERS },
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
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const port = isLocalhost ? ':3000' : (window.location.port ? `:${window.location.port}` : '');
  const host = isLocalhost ? 'localhost' : hostname;
  return `${protocol}//${host}${port}/wsrelay`;
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

    try {
      this._ws = new WebSocket(getRelayUrl());
    } catch (e) {
      console.error('[Relay] WebSocket açılamadı:', e);
      this._onError?.(e);
      return;
    }

    this._ws.onopen = () => {
      if (this._destroyed) { this._ws.close(); return; }
      this._ws.send(JSON.stringify({ type: 'relay:join', roomCode, playerId }));
    };

    this._ws.onmessage = (e) => {
      if (this._destroyed) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'relay:joined') {
          this._connected = true;
          this._onConnected?.();
        } else if (msg.type === 'relay:pong') {
          const rtt = Math.max(1, Date.now() - (msg.t0 || Date.now()));
          this._onPong?.(rtt);
        } else if (msg.type === 'relay:msg') {
          this._onMessage?.(msg.payload);
        }
      } catch {}
    };

    this._ws.onclose = () => {
      if (!this._destroyed) this._onDisconnected?.();
    };

    this._ws.onerror = (e) => {
      console.error('[Relay] WebSocket hatası:', e);
      this._onError?.({ type: 'relay-error', message: 'Relay sunucusuna bağlanılamadı' });
    };
  }

  /** Sadece diğer katılımcılara gönder (Client ACTION için) */
  send(payload) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: 'relay:msg', payload }));
    }
  }

  /** Tüm odaya yayınla — host hariç dahil (Host SYNC_STATE için) */
  broadcast(payload) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: 'relay:broadcast', payload }));
    }
  }

  /** Relay sunucusuna ping gönder ve RTT süresini ölç */
  ping(onPong) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._onPong = onPong;
      this._ws.send(JSON.stringify({ type: 'relay:ping', t0: Date.now() }));
    }
  }

  get isConnected() { return this._connected; }

  destroy() {
    this._destroyed = true;
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

    /** Spam koruması: son sohbet zamanı */
    this._lastChatTime = new Map();

    /** @type {import('peerjs').Peer} */
    this._peer = null;

    this._roomCode = migratedRoomCode || generateRoomCode();
    this._migratedState = migratedState;

    /** Kopan istemciler için 20 saniyelik tolerans/yeniden bağlanma zamanlayıcıları */
    this._disconnectTimers = new Map();

    this._init();
  }

  get roomCode() { return this._roomCode; }
  get peerId() { return this._peer?.id || null; }
  get game() { return this._game; }

  _init() {
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
      this._setupGame(id);
      this._onReady(id);

      // Relay odasına da katıl — WebRTC bağlanamayan client'lar için fallback
      this._relay = new RelayConnection({
        roomCode: this._roomCode,
        playerId: id,
        onMessage: (payload) => {
          // Relay üzerinden gelen ACTION mesajlarını işle
          if (payload?.type === MSG.ACTION) {
            this._handleMessage(payload, null);
          }
        },
        onConnected: () => console.log(`[HostPeerService] Relay odasına katıldı: ${this._roomCode}`),
        onDisconnected: () => console.warn('[HostPeerService] Relay bağlantısı koptu'),
      });

      // Host Ping ölçümü (Relay bağlıysa sunucu RTT, yoksa yerel 1 ms)
      this._pingInterval = setInterval(() => {
        const updateHostPing = (rtt) => {
          this._onPing(rtt);
          if (this._game && id) {
            this._game.updatePlayerPing(id, rtt);
            // Sadece ping değişti diye tüm oyun durumunu her 2.5 saniyede bir herkese yayınlama (VRAM/GC fırtınasını önler)
          }
        };
        if (this._relay?.isConnected) {
          this._relay.ping((rtt) => updateHostPing(rtt));
        } else {
          updateHostPing(1);
        }
      }, 2500);
      this._onPing(1);
    });

    this._peer.on('connection', (conn) => {
      this._handleIncomingConnection(conn);
    });

    this._peer.on('error', (err) => {
      console.error('[HostPeerService] PeerJS error:', err.type, err);
      if (err.type === 'unavailable-id') {
        // Oda kodu çakışması — yeni kod dene
        this._roomCode = generateRoomCode();
        this._peer.destroy();
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
      this._peer.reconnect();
    });
  }

  _setupGame(hostPeerId) {
    this._game = new MonopolyGame(this._roomCode);

    // Host Migration: eski durumu geri yükle
    if (this._migratedState) {
      this._restoreFromState(this._migratedState, hostPeerId);
    } else {
      // Normal akış: Host'u ilk oyuncu olarak ekle
      const joinRes = this._game.addPlayer(
        hostPeerId, this._playerName, this._token, this._color, false, this._sessionToken
      );
      if (joinRes.success && joinRes.player) {
        try {
          localStorage.setItem('muteahhit_session_token', joinRes.player.sessionToken);
          localStorage.setItem('muteahhit_room_code', this._roomCode);
        } catch (_) {}
      }
    }

    this._startWatchdog();
    this._broadcastState();
  }

  /**
   * Host Migration: Yeni Host eski game state'i devralır.
   * Bot'lar ve hayatta olan oyuncular güncellenir.
   */
  _restoreFromState(state, newHostPeerId) {
    try {
      // Hayatta olan oyuncuları MonopolyGame'e manuel yükle
      if (state.players) {
        for (const p of state.players) {
          if (!p.isBot && !p.isBankrupt) {
            this._game.addPlayer(p.id, p.name, p.token, p.color, false, p.sessionToken);
          }
        }
      }
      // Daha gelişmiş state restoration için MonopolyGame.loadState() eklenebilir
      // Şimdilik lobby'e dön (güvenli fallback)
      console.log('[HostPeerService] Host Migration: state restore, lobby fallback');
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

    conn.on('open', () => {
      // Yeni bağlanan client'a mevcut durumu gönder
      this._sendTo(conn, createSyncState(this._game.getPublicState()));
    });

    conn.on('data', (msg) => {
      this._handleMessage(msg, conn);
    });

    conn.on('close', () => {
      console.warn(`[HostPeerService] ${peerId} DataChannel kapandı, 20sn yeniden bağlanma/relay süresi tanınıyor...`);
      this._handleClientDisconnect(peerId);
    });

    conn.on('error', (err) => {
      console.error('[HostPeerService] Bağlantı hatası:', peerId, err);
      this._handleClientDisconnect(peerId);
    });
  }

  _handleMessage(msg, conn) {
    if (!msg) return;

    // Ping isteğine anında Pong ile cevap ver
    if (msg.type === MSG.PING) {
      const pong = createPong(msg.t0);
      if (conn) {
        this._sendTo(conn, pong);
      } else if (this._relay?.isConnected) {
        this._relay.broadcast(pong);
      }
      return;
    }

    if (msg.type !== MSG.ACTION) return;
    const { action, payload, senderId } = msg;
    const game = this._game;
    if (!game) return;

    // Oyuncu herhangi bir kanaldan (WebRTC veya Relay) mesaj yolladıysa kopma geri sayımını iptal et
    const activeSender = senderId || conn?.peer;
    if (activeSender && this._disconnectTimers.has(activeSender)) {
      clearTimeout(this._disconnectTimers.get(activeSender));
      this._disconnectTimers.delete(activeSender);
      console.log(`[HostPeerService] ${activeSender} eylem gönderdi, kopma geri sayımı iptal edildi.`);
      if (this._game?.disconnectNotice?.playerId === activeSender) {
        const p = this._game.players.find(x => x.id === activeSender);
        const pName = p?.name || 'Oyuncu';
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
            console.log(`[HostPeerService] ${existingPlayer.name} (${oldPeerId} -> ${senderId}) F5 / Reconnect ile bağlandı!`);

            // Kopma sayacını durdur
            if (this._disconnectTimers.has(oldPeerId)) {
              clearTimeout(this._disconnectTimers.get(oldPeerId));
              this._disconnectTimers.delete(oldPeerId);
            }

            const recRes = game.reconnectPlayer(senderId, existingPlayer.sessionToken, playerName);
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
                this._connections.set(senderId, conn);
              }

              // İstemciye session token'ını kesin olarak bildir
              if (conn) {
                this._sendTo(conn, {
                  type: MSG.EVENT,
                  event: 'SESSION_TOKEN',
                  payload: { sessionToken: existingPlayer.sessionToken }
                });
              } else if (this._relay?.isConnected) {
                this._relay.send({
                  type: MSG.EVENT,
                  event: 'SESSION_TOKEN',
                  payload: { sessionToken: existingPlayer.sessionToken },
                  targetId: senderId
                });
              }

              this._broadcastState();
              break;
            }
          }

          // 2. Oyun devam ederken katılan yeni kişiler -> İZLEYİCİ (SPECTATOR)
          if (game.status !== 'lobby') {
            const specName = playerName || `İzleyici ${this._spectators.size + 1}`;
            this._spectators.set(senderId, { id: senderId, name: specName });
            game.spectatorCount = this._spectators.size;
            console.log(`[HostPeerService] ${specName} (${senderId}) maçı izlemeye başladı. Toplam İzleyici: ${this._spectators.size}`);
            game.addLog(`👁️ ${specName} maçı izlemeye başladı.`, 'info');

            if (conn) {
              this._sendTo(conn, {
                type: MSG.EVENT,
                event: 'SPECTATOR_JOINED',
                payload: { isSpectator: true, spectatorCount: this._spectators.size }
              });
            } else if (this._relay?.isConnected) {
              this._relay.send({
                type: MSG.EVENT,
                event: 'SPECTATOR_JOINED',
                payload: { isSpectator: true, spectatorCount: this._spectators.size },
                targetId: senderId
              });
            }
            this._broadcastState();
            break;
          }

          // 3. Lobi aşamasında normal yeni oyuncu katılımı
          const res = game.addPlayer(senderId, playerName, token, color, false, sessionToken);
          if (res.success && res.player) {
            if (conn) {
              this._sendTo(conn, {
                type: MSG.EVENT,
                event: 'SESSION_TOKEN',
                payload: { sessionToken: res.player.sessionToken }
              });
            } else if (this._relay?.isConnected) {
              this._relay.send({
                type: MSG.EVENT,
                event: 'SESSION_TOKEN',
                payload: { sessionToken: res.player.sessionToken },
                targetId: senderId
              });
            }
          }
          break;
        }

        case ACTION.LEAVE_ROOM: {
          game.removePlayer(senderId);
          this._connections.get(senderId)?.close();
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
          const res = game.kickPlayer(senderId, targetPlayerId);
          if (res.success) {
            const targetConn = this._connections.get(targetPlayerId);
            if (targetConn) {
              this._sendTo(targetConn, createKicked('Oda kurucusu tarafından lobiden atıldınız.'));
              targetConn.close();
            }
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
          game.startGame(senderId);
          botTriggerNeeded = true;
          break;
        }

        case ACTION.RESTART_GAME: {
          const player = game.players.find(p => p.id === senderId);
          if (game.status === 'ended' || player?.isHost) {
            game.resetGameToLobby(senderId);
          }
          break;
        }

        // ─ Oyun Mekaniği ─
        case ACTION.ROLL_DICE: {
          if (game.phase === 'TURN_ACTIONS' && game.canRollAgain) {
            game.endTurn(senderId);
          }
          const allowCustom = Boolean(game.isDevMode);
          game.rollDice(senderId, allowCustom ? payload?.dice : undefined, allowCustom ? payload?.toss : undefined);
          this._broadcast({
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
            game.endTurn(senderId);
            game.rollDice(senderId, allowCustom2 ? payload?.dice : undefined, allowCustom2 ? payload?.toss : undefined);
          } else {
            game.rollDice(senderId, allowCustom2 ? payload?.dice : undefined, allowCustom2 ? payload?.toss : undefined);
          }
          this._broadcast({
            type: MSG.EVENT,
            event: 'DICE_ROLL',
            payload: { values: game.dice, rollId: game.lastDiceRollId }
          });
          botTriggerNeeded = true;
          break;
        }

        case ACTION.BUY_PROPERTY:
          game.buyCurrentProperty(senderId);
          break;

        case ACTION.DECLINE_BUY:
          game.declineBuy(senderId);
          break;

        case ACTION.END_TURN:
          game.endTurn(senderId);
          botTriggerNeeded = true;
          break;

        case ACTION.ACKNOWLEDGE_CARD:
          game.acknowledgeCard(senderId);
          botTriggerNeeded = true;
          break;

        case ACTION.TOGGLE_PAUSE:
          game.togglePause(senderId);
          botTriggerNeeded = true;
          break;

        case ACTION.SKIP_BOT_TURN:
          game.fastForwardBotTurn(() => this._broadcastState());
          botTriggerNeeded = true;
          break;

        case ACTION.TIMEOUT_TURN: {
          if (game.status !== 'playing' || game.isPaused) { broadcastNeeded = false; break; }
          const active = game.getActivePlayer();
          if (active?.id === senderId) {
            game.forceTimeoutTurn(senderId);
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
          if (Number.isInteger(tid) && tid >= 0 && tid <= 39) game.buildHouse(senderId, tid);
          break;
        }

        case ACTION.SELL_HOUSE: {
          const tid2 = Number.parseInt(payload.tileId, 10);
          if (Number.isInteger(tid2) && tid2 >= 0 && tid2 <= 39) game.sellHouse(senderId, tid2);
          break;
        }

        case ACTION.MORTGAGE: {
          const tid3 = Number.parseInt(payload.tileId, 10);
          if (Number.isInteger(tid3) && tid3 >= 0 && tid3 <= 39) game.mortgageProperty(senderId, tid3);
          break;
        }

        case ACTION.UNMORTGAGE: {
          const tid4 = Number.parseInt(payload.tileId, 10);
          if (Number.isInteger(tid4) && tid4 >= 0 && tid4 <= 39) game.unmortgageProperty(senderId, tid4);
          break;
        }

        case ACTION.AUTO_MORTGAGE:
          game.autoMortgage(senderId);
          break;

        // ─ Hapis ─
        case ACTION.PAY_JAIL_FINE:
          game.payJailFine(senderId);
          break;

        case ACTION.USE_JAIL_CARD:
          game.useJailCard(senderId);
          break;

        // ─ Takas ─
        case ACTION.PROPOSE_TRADE: {
          const tradeRes = game.proposeTrade(senderId, payload);
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
          game.respondTrade(senderId, payload.accept);
          break;

        case ACTION.CANCEL_TRADE:
          game.cancelTrade(senderId);
          break;

        // ─ Hediye & Kredi ─
        case ACTION.SEND_GIFT: {
          const amt = Number(payload.amount);
          if (Number.isFinite(amt) && amt > 0) game.sendGift(senderId, payload.toPlayerId, amt);
          break;
        }

        case ACTION.REQUEST_LOAN: {
          const lamt = Number(payload.amount);
          if (Number.isFinite(lamt) && lamt > 0) game.requestLoan(senderId, payload.toPlayerId, lamt);
          break;
        }

        case ACTION.RESPOND_LOAN:
          game.respondLoan(senderId, payload.accept);
          break;

        case ACTION.PAY_LOAN:
          if (payload.loanId) game.payLoan(senderId, payload.loanId);
          break;

        case ACTION.REQUEST_BANK_LOAN: {
          const bamt = Number(payload.amount);
          if (Number.isFinite(bamt) && bamt > 0) game.requestBankLoan(senderId, bamt);
          break;
        }

        // ─ Açık Artırma ─
        case ACTION.START_PLAYER_AUCTION: {
          const stid = Number.parseInt(payload.tileId, 10);
          const sbid = Number(payload.startingBid);
          if (Number.isInteger(stid) && stid >= 0 && stid <= 39 && Number.isFinite(sbid) && sbid >= 0) {
            game.startPlayerPropertyAuction(senderId, stid, sbid);
          }
          break;
        }

        case ACTION.PLACE_BID: {
          const bidAmt = Number(payload.bidAmount ?? payload.amount);
          if (Number.isFinite(bidAmt) && bidAmt > 0) {
            game.placeBid(senderId, bidAmt);
            if (game.phase !== 'AUCTION') botTriggerNeeded = true;
          }
          break;
        }

        case ACTION.PASS_AUCTION:
          game.passAuction(senderId);
          if (game.phase !== 'AUCTION') botTriggerNeeded = true;
          break;

        // ─ Sohbet ─
        case ACTION.SEND_CHAT: {
          broadcastNeeded = false;
          const lastChat = this._lastChatTime.get(senderId) || 0;
          const now = Date.now();
          if (now - lastChat < 400) break;
          this._lastChatTime.set(senderId, now);

          const sender = game.players.find(p => p.id === senderId);
          const cleanText = String(payload.message || '').trim().substring(0, 300);
          if (!cleanText) break;

          const chatMsg = {
            id: Math.random().toString(36).substring(2, 9),
            senderName: sender ? sender.name : 'Misafir',
            senderColor: sender ? sender.color : '#94a3b8',
            text: cleanText,
            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          };
          // Host dahil herkese broadcast et
          this._broadcastChat(chatMsg);
          break;
        }

        // ─ İflas ─
        case ACTION.DECLARE_BANKRUPTCY:
          game.declareBankruptcy(senderId);
          botTriggerNeeded = true;
          break;

        // ─ Dev Tools ─
        case ACTION.DEV_COMMAND: {
          const player = game.players.find(p => p.id === senderId);
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

  _handleClientDisconnect(peerId) {
    this._connections.delete(peerId);
    this._connectionOrder = this._connectionOrder.filter(id => id !== peerId);

    // 1. İzleyici ayrıldıysa: ASLA kopma uyarısı veya geri sayım başlatma!
    if (this._spectators?.has(peerId)) {
      const spec = this._spectators.get(peerId);
      this._spectators.delete(peerId);
      console.log(`[HostPeerService] İzleyici ayrıldı: ${spec?.name || peerId}. Kalan İzleyici: ${this._spectators.size}`);
      if (this._game) {
        this._game.spectatorCount = this._spectators.size;
        this._broadcastState();
      }
      return;
    }

    // 2. Oyunda olmayan, bot olan veya zaten iflas etmiş / atılmış biri için uyarı verme
    const player = this._game?.players?.find(p => p.id === peerId);
    if (!player || player.isBot || player.isBankrupt || player.isKicked) {
      return;
    }

    // Eğer bu oyuncu için zaten aktif bir kopma geri sayımı varsa devam etsin
    if (this._disconnectTimers.has(peerId)) return;

    const playerName = player.name || 'Bir oyuncunun';

    // 1. Aşama: Herkese kompakt bildirim gönder (bağlantı kesildi, 60 saniye bekleniyor)
    if (this._game) {
      this._game.disconnectNotice = {
        type: 'disconnecting',
        playerId: peerId,
        playerName: playerName,
        expiresAt: Date.now() + 60000,
      };
      this._game.addLog(`⚠️ ${playerName} bağlantısı kesildi, yeniden bağlanması bekleniyor (60sn)...`, 'warning');
      this._broadcastState();
    }

    // 60 saniye tolerans tanı (Relay fallback veya WebRTC yeniden bağlanma için)
    const timer = setTimeout(() => {
      this._disconnectTimers.delete(peerId);
      this._lastChatTime.delete(peerId);

      if (this._game) {
        console.warn(`[HostPeerService] ${peerId} 60 saniye içinde yeniden bağlanamadı, oyundan tamamen çıkarılıyor.`);
        // 2. Aşama: 60 saniye dolunca "atıldı" bildirimi ve oyundan tamamen çıkarma (iflas & piyon tasfiyesi)
        this._game.disconnectNotice = {
          type: 'kicked',
          playerId: peerId,
          playerName: playerName,
          timestamp: Date.now(),
        };
        this._game.addLog(`❌ ${playerName} 60 saniye içinde bağlanamadığı için oyundan atıldı.`, 'warning');
        this._game.removePlayer(peerId);
        this._broadcastState();

        // 6 saniye sonra bildirimi tahtadan temizle
        setTimeout(() => {
          if (this._game?.disconnectNotice?.type === 'kicked') {
            this._game.disconnectNotice = null;
            this._broadcastState();
          }
        }, 6000);
      }
    }, 60000);

    this._disconnectTimers.set(peerId, timer);
  }

  _broadcastState() {
    if (!this._game) return;
    this._game.spectatorCount = this._spectators ? this._spectators.size : 0;
    const state = this._game.getPublicState();
    this._onState(state); // Host'un kendi UI'ını güncelle

    const msg = createSyncState(state);
    // WebRTC DataChannel üzerinden gönder
    for (const conn of this._connections.values()) {
      this._sendTo(conn, msg);
    }
    // WebSocket Relay üzerinden de gönder (WARP/VPN kullanıcılar için)
    if (this._relay?.isConnected) {
      this._relay.broadcast(msg);
    }

    // Bot açık artırma tetikleme
    if (this._game.phase === 'AUCTION' && this._game.auction) {
      this._game.triggerBotAuction(() => {
        const s2 = this._game.getPublicState();
        this._onState(s2);
        const m2 = createSyncState(s2);
        for (const c of this._connections.values()) this._sendTo(c, m2);
        if (this._relay?.isConnected) this._relay.broadcast(m2);
      });
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
      if (!game || game.status !== 'playing' || game.isPaused) return;
      try {
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
   */
  destroy() {
    this._stopWatchdog();
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
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

    /** @type {import('peerjs').DataConnection | null} */
    this._conn = null;

    /** @type {import('peerjs').Peer} */
    this._peer = null;

    this._pingInterval = null;

    /** @type {RelayConnection | null} */
    this._relay = null;
    this._isRelayActive = false;
    this._isConnected = false;
    this._destroyed = false;
    this._fallbackTimeout = null;
    this._myRelayId = null;
    this._assignedPeerId = null;

    this._init();
  }

  get peerId() { return this._assignedPeerId || this._peer?.id || this._myRelayId || null; }

  _init() {
    const config = getPeerConfig();
    // Client için random PeerID
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

    // 4.5 saniye içinde WebRTC açılamazsa (DPI / WARP / CGNAT blokajı) otomatik Relay'e geç
    this._fallbackTimeout = setTimeout(() => {
      if (!this._isConnected && !this._destroyed) {
        console.warn('[ClientPeerService] WebRTC 4.5 saniyede açılamadı, WebSocket Relay devreye giriyor...');
        this._fallbackToRelay();
      }
    }, 4500);

    this._peer.on('open', (id) => {
      this._assignedPeerId = id;
      this._onMyId(id);
      this._connectToHost();
    });

    this._peer.on('error', (err) => {
      console.warn('[ClientPeerService] PeerJS error:', err?.type, err?.message);

      // Sinyal sunucusu hatası veya kopması:
      // Zaten odaya bağlanmışsak (P2P veya Relay aktifse) OYUN KESİNTİYE UĞRAMAZ!
      if (this._isConnected || this._conn?.open || this._relay?.isConnected) {
        console.warn('[ClientPeerService] Sinyal sunucusunda hata oluştu ancak oyun zaten aktif, arka planda reconnect deneniyor...');
        try { this._peer?.reconnect(); } catch (_) {}
        return;
      }

      // Henüz odaya bağlanamadıysa (ilk bağlantı aşaması): hemen relay dene
      if (!this._isConnected && !this._destroyed) {
        this._fallbackToRelay(err);
        return;
      }

      // Zaten bağlıyken sadece hem WebRTC hem Relay kapalıysa hata bildir
      if (!this._conn?.open && !this._relay?.isConnected) {
        this._onError(err);
      }
    });

    this._peer.on('disconnected', () => {
      console.warn('[ClientPeerService] Sinyal sunucusundan koptu, arka planda yeniden bağlanılıyor...');
      try { this._peer?.reconnect(); } catch (_) {}
    });
  }

  _connectToHost() {
    try {
      const conn = this._peer.connect(this._hostPeerId, {
        reliable: true,
        serialization: 'json',
      });
      this._conn = conn;

      conn.on('open', () => {
        if (this._destroyed || this._isRelayActive) return;
        this._isConnected = true;
        if (this._fallbackTimeout) {
          clearTimeout(this._fallbackTimeout);
          this._fallbackTimeout = null;
        }
        console.log('[ClientPeerService] WebRTC DataChannel başarıyla kuruldu!');
        const activeId = this._assignedPeerId || this._peer.id;
        this._onConnected(activeId);
        this._startPing();
        // Host'a katılım bildirimi
        this._send(createAction(ACTION.JOIN_LOBBY, {
          playerName: this._playerName,
          token: this._token,
          color: this._color,
          sessionToken: this._sessionToken,
        }, activeId));
      });

      conn.on('data', (msg) => {
        this._handleMessage(msg);
      });

      conn.on('close', () => {
        console.warn('[ClientPeerService] WebRTC DataChannel kapandı. Relay durumu kontrol ediliyor...');
        if (this._relay?.isConnected) {
          console.log('[ClientPeerService] Relay aktif, oyun WebSocket üzerinden kesintisiz devam ediyor.');
          return;
        }
        if (!this._destroyed) {
          console.log('[ClientPeerService] WebRTC kapandı, otomatik Relay fallback devreye giriyor...');
          this._fallbackToRelay();
        }
      });

      conn.on('error', (err) => {
        console.error('[ClientPeerService] DataChannel bağlantı hatası:', err);
        if (!this._destroyed) {
          this._fallbackToRelay(err);
        }
      });
    } catch (e) {
      if (!this._isConnected && !this._destroyed) {
        this._fallbackToRelay(e);
      }
    }
  }

  _fallbackToRelay(originalError = null) {
    if (this._isRelayActive || this._destroyed) return;
    this._isRelayActive = true;
    if (this._fallbackTimeout) {
      clearTimeout(this._fallbackTimeout);
      this._fallbackTimeout = null;
    }

    // WebRTC denemesini sessizce temizle
    try { this._conn?.close(); } catch (_) {}
    this._conn = null;

    // Oyuncu ID'sini koru — random yeni ID yerine mevcut peer ID'yi kullan
    this._myRelayId = this._assignedPeerId || this._peer?.id || ('c_' + Math.random().toString(36).substring(2, 9));
    this._onMyId(this._myRelayId);

    console.log(`[ClientPeerService] WebSocket Relay odasına bağlanılıyor: ${this._hostPeerId} (ID: ${this._myRelayId})`);

    let relayTimeout = null;
    if (!this._isConnected) {
      relayTimeout = setTimeout(() => {
        if (!this._isConnected && !this._destroyed) {
          this._onError(originalError || { type: 'peer-unavailable', message: 'Oda bulunamadı veya bağlantı kurulamadı.' });
        }
      }, 7000);
    }

    this._relay = new RelayConnection({
      roomCode: this._hostPeerId,
      playerId: this._myRelayId,
      onMessage: (payload) => {
        this._handleMessage(payload);
      },
      onConnected: () => {
        if (this._destroyed) return;
        if (relayTimeout) clearTimeout(relayTimeout);
        this._isConnected = true;
        console.log('[ClientPeerService] WebSocket Relay ile odaya başarıyla bağlanıldı!');
        this._onConnected(this._myRelayId);
        this._startPing();
        // Host'a katılım bildirimi
        this._relay.send(createAction(ACTION.JOIN_LOBBY, {
          playerName: this._playerName,
          token: this._token,
          color: this._color,
          sessionToken: this._sessionToken,
        }, this._myRelayId));
      },
      onDisconnected: () => {
        console.warn('[ClientPeerService] Relay bağlantısı kapandı.');
        if (this._isConnected && !this._destroyed) {
          this._onHostDropped();
        }
      },
      onError: (err) => {
        if (!this._isConnected && !this._destroyed) {
          if (relayTimeout) clearTimeout(relayTimeout);
          this._onError(originalError || err);
        }
      }
    });
  }

  _handleMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case MSG.SYNC_STATE:
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

  _startPing() {
    this._stopPing();
    const handlePingResult = (rtt) => {
      this._onPing(rtt);
      this.sendAction(ACTION.UPDATE_PING, { ping: rtt });
    };
    this._pingInterval = setInterval(() => {
      if (this._conn?.open) {
        this._send(createPing(Date.now()));
      } else if (this._relay?.isConnected) {
        this._relay.ping((rtt) => handlePingResult(rtt));
      }
    }, 2500);

    setTimeout(() => {
      if (this._conn?.open) {
        this._send(createPing(Date.now()));
      } else if (this._relay?.isConnected) {
        this._relay.ping((rtt) => handlePingResult(rtt));
      }
    }, 400);
  }

  _stopPing() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }

  /**
   * Host'a eylem gönder.
   * @param {string} action - ACTION sabitlerinden biri
   * @param {object} payload - Eyleme özgü veri
   */
  sendAction(action, payload = {}) {
    const senderId = this._assignedPeerId || this._peer?.id || this._myRelayId || '';
    const actionMsg = createAction(action, payload, senderId);

    if (this._conn?.open) {
      this._send(actionMsg);
    } else if (this._relay?.isConnected) {
      this._relay.send(actionMsg);
    } else {
      console.warn('[ClientPeerService] Bağlantı açık değil, eylem gönderilemedi:', action);
    }
  }

  _send(msg) {
    try {
      if (this._conn?.open) {
        this._conn.send(msg);
      } else if (this._relay?.isConnected) {
        this._relay.send(msg);
      } else {
        console.warn('[ClientPeerService] Bağlantı açık değil, mesaj gönderilemedi:', msg.action || msg.type);
      }
    } catch (e) {
      console.error('[ClientPeerService] Gönderme hatası:', e);
    }
  }

  /**
   * Odadan ayrıl.
   */
  destroy() {
    this._destroyed = true;
    this._stopPing();
    if (this._fallbackTimeout) {
      clearTimeout(this._fallbackTimeout);
      this._fallbackTimeout = null;
    }

    const leaveMsg = createAction(ACTION.LEAVE_ROOM, {}, this._assignedPeerId || this._peer?.id || this._myRelayId || '');
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

    try { this._peer?.destroy(); } catch (_) {}
    this._conn = null;
    this._peer = null;
  }
}

