/**
 * Müteahhit Online — Sunucu
 * ===================================
 * v2.1 P2P Mimarisi: Sunucu artık oyun mantığı çalıştırmıyor.
 *
 * Sorumlulukları:
 *   1. Statik dosyaları sun (client/dist)
 *   2. PeerJS WebRTC sinyalleşme sunucusu (peer npm paketi)
 *   3. WebSocket Relay — WebRTC bağlanamayan kullanıcılar için (VPN, CGNAT, WARP)
 *   4. Sağlık kontrolü API'si
 *
 * Tüm oyun mantığı ve durum yönetimi artık Host oyuncunun tarayıcısında çalışır.
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ExpressPeerServer } from 'peer';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── KRİTİK: Global Hata Yakalayıcıları ─────────────────────────────────────
// Bu olmadan herhangi bir uncaught exception tüm sunucuyu crash'ler ve
// aktif tüm oyunlar aniden sona erer.
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Yakalanmamış istisna — sunucu çalışmaya devam ediyor:', err.message, err.stack);
  // NOT: process.exit() çağrılmıyor — sunucu ayakta kalır
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] İşlenmeyen Promise reddi — sunucu çalışmaya devam ediyor:', reason);
});

// ─── Güvenli WebSocket Gönderim Yardımcısı ───────────────────────────────────
// Kapalı veya kapanmakta olan bir socket'e gönderim EPIPE hatasına yol açar.
// Bu hata try/catch olmadan sunucuyu crash'ler.
function safeSend(ws, data) {
  try {
    if (ws && ws.readyState === 1 /* WebSocket.OPEN */) {
      ws.send(data);
    }
  } catch (err) {
    // EPIPE veya benzeri ağ hataları — sessizce görmezden gel
    console.warn('[Relay] safeSend hatası (sessiz):', err.message);
  }
}

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/muteahhit-online\.pages\.dev$/,
  /^https:\/\/[a-z0-9-]+\.muteahhit-online\.pages\.dev$/,
  /^https:\/\/muteahhit-online-backend\.onrender\.com$/,
];

function isOriginAllowed(origin) {
  if (!origin) return true; // Same-origin, direct browser nav or local scripts
  if (process.env.ALLOWED_ORIGINS) {
    const list = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
    if (list.includes(origin) || list.includes('*')) return true;
  }
  return ALLOWED_ORIGIN_PATTERNS.some(rx => rx.test(origin));
}

const app = express();
const httpServer = createServer(app);

// ─── Güvenlik Başlıkları (Security Headers) ──────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ─── Kısıtlayıcı CORS Politikası ─────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '100kb' }));

// ─── PeerJS Sinyal Sunucusu ───────────────────────────────────────────────────
// Tüm WebRTC handshake sinyalleşmesi burada gerçekleşir.
// Gerçek oyun trafiği (DataChannel) doğrudan tarayıcılar arasında akar.
let peerWss = null;
const peerServer = ExpressPeerServer(httpServer, {
  path: '/',                      // /peerjs altında mount edilecek
  allow_discovery: false,         // Güvenlik: peer listesi kamuya açık olmasın
  proxied: true,                  // Render reverse proxy arkasında çalışır
  alive_timeout: 180000,          // 3 dakika heartbeat zaman aşımı (2dk'dan artırıldı)
  expire_timeout: 60000,          // 60 saniye mesaj zaman aşımı
  createWebSocketServer: (options) => {
    peerWss = new WebSocketServer({
      ...options,
      maxPayload: 64 * 1024,      // 64 KB yük sınırı (DoS önleme)
      perMessageDeflate: {
        zlibDeflateOptions: { level: 3 },
        threshold: 1024,
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
      },
    });
    return peerWss;
  },
});

app.use('/peerjs', peerServer);


// ─── Bağlı Peer Takibi ───────────────────────────────────────────────────────
// Bağlı peer'ların listesi; /api/room-check endpoint'i için kullanılır.
const connectedPeers = new Set();

peerServer.on('connection', (client) => {
  try {
    const id = client.getId();
    connectedPeers.add(id);
    console.log(`[PeerJS] Sinyal bağlantısı: ${id} (toplam: ${connectedPeers.size})`);
  } catch (err) {
    console.error('[PeerJS] connection event hatası:', err.message);
  }
});

peerServer.on('disconnect', (client) => {
  try {
    const id = client.getId();
    connectedPeers.delete(id);
    console.log(`[PeerJS] Sinyal ayrıldı: ${id} (toplam: ${connectedPeers.size})`);
  } catch (err) {
    console.error('[PeerJS] disconnect event hatası:', err.message);
  }
});

// ─── WebSocket Relay Sunucusu ─────────────────────────────────────────────────
// WebRTC P2P bağlantısı kurulamayan kullanıcılar (VPN, CGNAT, WARP, firewall)
// için sunucu aracılığıyla mesaj iletimi.
//
// Bağlantı: wss://domain/wsrelay
// Protokol:
//   → { type: 'relay:join', roomCode: 'ABC123', playerId: 'id' }
//   ← { type: 'relay:joined' }
//   → { type: 'relay:msg', payload: { ...oyun mesajı... } }
//   ← { type: 'relay:msg', payload: { ...oyun mesajı... }, from: 'playerId' }
//   → { type: 'relay:broadcast', payload: { ...oyun mesajı... } }
//   ← { type: 'relay:msg', payload: { ...oyun mesajı... }, from: 'playerId' } (tüm odaya)

const relayWss = new WebSocketServer({
  noServer: true,
  maxPayload: 64 * 1024, // 64 KB yük sınırı (DoS bellek tüketimini önleme)
  perMessageDeflate: {
    zlibDeflateOptions: { level: 3 },
    threshold: 1024, // 1 KB altındaki minik ping/pong paketleri sıkıştırma masrafı olmadan ham akar
    clientNoContextTakeover: true, // Bellek sızıntısı önleme (Render RAM dostu)
    serverNoContextTakeover: true,
  },
});

// Map<roomCode, Map<WebSocket, playerId>>
const relayRooms = new Map();
// Map<roomCode, TimeoutId> — Boşalan odaların anında silinmesini önleyen 2dk (120sn) grace period (F5 / reconnect koruması)
const roomGraceTimers = new Map();

// 🔋 Bağlantı Canlılık Takibi (Application-level Heartbeat & Keepalive)
// Render reverse proxy ham WebSocket PING frame'lerini istemciye iletmediğinden,
// bağlantılar hem JSON düzeyinde hem de WS düzeyinde canlı tutulur.
// Bağlantı sadece 5 dakika (300sn) boyunca hiçbir veri veya ping göndermezse sonlandırılır.
const relayHeartbeat = setInterval(() => {
  const now = Date.now();
  relayWss.clients.forEach((ws) => {
    if (ws.readyState === 1 /* OPEN */) {
      // 5 dakika mutlak sessizlik kontrolü
      if (ws.lastActive && (now - ws.lastActive > 300000)) {
        console.warn('[Relay] 5 dakikadır hareketsiz bağlantı temizlendi');
        return ws.terminate();
      }
      // Render/Cloudflare 100sn boşta kalma zaman aşımını engellemek için keepalive gönder
      safeSend(ws, JSON.stringify({ type: 'relay:keepalive', t: now }));
      try { ws.ping(); } catch (_) {}
    }
  });
}, 25000);

relayWss.on('close', () => {
  clearInterval(relayHeartbeat);
  for (const timer of roomGraceTimers.values()) clearTimeout(timer);
  roomGraceTimers.clear();
});

relayWss.on('connection', (ws) => {
  let roomCode = null;
  let playerId = null;

  ws.isAlive = true;
  ws.lastActive = Date.now();
  ws.msgWindowStart = Date.now();
  ws.msgCount = 0;

  ws.on('pong', () => {
    ws.isAlive = true;
    ws.lastActive = Date.now();
  });

  ws.on('message', (raw) => {
    const now = Date.now();
    ws.lastActive = now;
    ws.isAlive = true;

    // Bağlantı başına mesaj hız sınırı (DoS & Spam Koruması: saniyede maks. 40 mesaj)
    if (now - ws.msgWindowStart > 1000) {
      ws.msgWindowStart = now;
      ws.msgCount = 1;
    } else {
      ws.msgCount++;
      if (ws.msgCount > 40) {
        console.warn(`[Relay] Rate limit aşıldı, soket kapatılıyor: ${playerId || 'anonim'}`);
        ws.close(1008, 'Mesaj hızı aşıldı');
        return;
      }
    }

    // Tüm mesaj işleme try/catch içinde — bu throw atarsa sadece bu mesaj atlanır, sunucu çalışmaya devam eder
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'relay:ping') {
        safeSend(ws, JSON.stringify({ type: 'relay:pong', t0: msg.t0 }));
        return;
      }

      if (msg.type === 'relay:join') {
        const newRoomCode = String(msg.roomCode || '').toUpperCase().trim();
        const newPlayerId = String(msg.playerId || '').trim();
        
        // Girdi Doğrulama: Oda kodu ve oyuncu kimliği
        if (!newRoomCode || !/^[A-Z0-9]{4,8}$/.test(newRoomCode)) {
          ws.close(1008, 'Geçersiz oda kodu formatı');
          return;
        }
        if (!newPlayerId || newPlayerId.length > 64) {
          ws.close(1008, 'Geçersiz oyuncu kimliği');
          return;
        }

        // Bu oda için bekleyen bir grace timer varsa iptal et (oyuncu/host odaya geri döndü)
        if (roomGraceTimers.has(newRoomCode)) {
          clearTimeout(roomGraceTimers.get(newRoomCode));
          roomGraceTimers.delete(newRoomCode);
          console.log(`[Relay] Oda grace period iptal edildi (yeniden katılım): ${newRoomCode}`);
        }

        // Aynı WebSocket başka bir odadan ayrılıyorsa temizle (re-join senaryosu)
        if (roomCode && roomCode !== newRoomCode && relayRooms.has(roomCode)) {
          relayRooms.get(roomCode).delete(ws);
          if (relayRooms.get(roomCode).size === 0) {
            relayRooms.delete(roomCode);
            console.log(`[Relay] Eski oda temizlendi: ${roomCode}`);
          }
        }

        roomCode = newRoomCode;
        playerId = newPlayerId;

        if (!relayRooms.has(roomCode)) relayRooms.set(roomCode, new Map());
        
        // Aynı ws için kaydı güncelle
        relayRooms.get(roomCode).set(ws, playerId);

        safeSend(ws, JSON.stringify({ type: 'relay:joined', roomCode, playerId }));
        console.log(`[Relay] ${playerId} odaya katıldı: ${roomCode} (${relayRooms.get(roomCode).size} kişi)`);

      } else if (msg.type === 'relay:msg') {
        if (!roomCode) return;
        const room = relayRooms.get(roomCode);
        if (!room) return;

        const targetId = msg.targetId || msg.payload?.targetId;
        const outgoing = JSON.stringify({ type: 'relay:msg', payload: msg.payload, from: playerId, targetId });

        room.forEach((pid, client) => {
          if (client !== ws && client.readyState === 1 /* OPEN */) {
            if (targetId) {
              if (pid === targetId) {
                safeSend(client, outgoing);
              }
            } else {
              safeSend(client, outgoing);
            }
          }
        });
        // GÜVENLİK DÜZELTMESİ: targetId eşleşmediğinde mesaj odadaki herkese ASLA broadcast edilmez!
        // Bu sayede SESSION_TOKEN veya hedefe özel verilerin üçüncü şahıslara sızması kesin olarak engellenir.


      } else if (msg.type === 'relay:broadcast') {
        // Host → tüm client'lara (SYNC_STATE gibi)
        if (!roomCode) return;
        const room = relayRooms.get(roomCode);
        if (!room) return;

        const targetId = msg.targetId || msg.payload?.targetId;
        const outgoing = JSON.stringify({ type: 'relay:msg', payload: msg.payload, from: playerId, targetId });

        room.forEach((pid, client) => {
          // Gönderen istemciye (Host) gereksiz echo geri gönderme!
          if (client !== ws && client.readyState === 1) {
            if (targetId && pid !== targetId) return;
            safeSend(client, outgoing);
          }
        });
      } else if (msg.type === 'relay:leave') {
        if (roomCode && relayRooms.has(roomCode)) {
          const room = relayRooms.get(roomCode);
          room.delete(ws);
          const remaining = room.size;
          console.log(`[Relay] ${playerId} odadan ayrıldı: ${roomCode} (${remaining} kişi kaldı)`);
          if (remaining > 0 && playerId) {
            const leaveNotice = JSON.stringify({ type: 'relay:peer_left', playerId, roomCode });
            room.forEach((pid, client) => {
              if (client !== ws && client.readyState === 1) safeSend(client, leaveNotice);
            });
          }
        }
      }
    } catch (e) {
      console.error('[Relay] Mesaj işleme hatası:', e.message);
    }
  });

  ws.on('close', () => {
    try {
      if (roomCode && relayRooms.has(roomCode)) {
        const room = relayRooms.get(roomCode);
        room.delete(ws);
        const remaining = room.size;
        console.log(`[Relay] ${playerId} bağlantısı kapandı: ${roomCode} (${remaining} kişi kaldı)`);
        
        // Odadaki diğer üyelere (özellikle Host'a) kopma bildirimini anında ilet
        if (remaining > 0 && playerId) {
          const leaveNotice = JSON.stringify({
            type: 'relay:peer_left',
            playerId,
            roomCode
          });
          room.forEach((pid, client) => {
            if (client !== ws && client.readyState === 1) {
              safeSend(client, leaveNotice);
            }
          });
        }

        if (remaining === 0) {
          // F5 yenilemesi ve geçici ağ kopmalarında odayı ANINDA SİLME!
          // 2 dakikalık (120sn) grace period toleransı tanı:
          if (roomGraceTimers.has(roomCode)) clearTimeout(roomGraceTimers.get(roomCode));
          const timer = setTimeout(() => {
            roomGraceTimers.delete(roomCode);
            if (relayRooms.has(roomCode) && relayRooms.get(roomCode).size === 0) {
              relayRooms.delete(roomCode);
              console.log(`[Relay] Boş oda (2dk grace period doldu) silindi: ${roomCode}`);
            }
          }, 120000); // 2 dakika
          roomGraceTimers.set(roomCode, timer);
        }
      }
    } catch (err) {
      console.error('[Relay] close event hatası:', err.message);
    }
  });

  ws.on('error', (err) => {
    console.warn('[Relay] WebSocket bağlantı hatası (sessiz):', err.message);
  });
});

// ─── Render / Cloudflare Boşta Kalma Önleme ──────────────────────────────────
// Render.com'un 15 dakika boşta sonrası uyku moduna geçmesini engelle
setInterval(() => {
  // 1. WebSocket Relay istemcilerini canlı tut
  relayWss.clients.forEach((client) => {
    if (client.readyState === 1 /* OPEN */) {
      try { client.ping(); } catch (_) {}
    }
  });
  // 2. PeerJS Sinyal istemcilerini canlı tut
  if (peerWss) {
    peerWss.clients.forEach((client) => {
      if (client.readyState === 1 /* OPEN */) {
        try { client.ping(); } catch (_) {}
      }
    });
  }
}, 25000);

// HTTP Upgrade — /wsrelay path'i relay'e, diğerleri PeerJS'e
const peerUpgradeListeners = httpServer.rawListeners('upgrade').slice();
httpServer.removeAllListeners('upgrade');

httpServer.on('upgrade', (req, socket, head) => {
  try {
    const origin = req.headers.origin;
    if (origin && !isOriginAllowed(origin)) {
      console.warn('[HTTP Upgrade] Yetkisiz Origin engellendi (CSWSH Koruması):', origin);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    if (req.url && req.url.startsWith('/wsrelay')) {
      relayWss.handleUpgrade(req, socket, head, (ws) => {
        relayWss.emit('connection', ws, req);
      });
    } else {
      for (const listener of peerUpgradeListeners) {
        listener.call(httpServer, req, socket, head);
      }
    }
  } catch (err) {
    console.error('[HTTP Upgrade] Hata:', err.message);
    try { socket.destroy(); } catch (_) {}
  }
});

// ─── Statik Dosya Sunumu ─────────────────────────────────────────────────────
const distPath = path.join(__dirname, '../client/dist');
const publicPath = path.join(__dirname, '../client/public');
app.use(express.static(distPath));
app.use(express.static(publicPath));

// ─── API Uç Noktaları ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.1.0',
    architecture: 'P2P WebRTC + WebSocket Relay Fallback',
    relayRooms: relayRooms.size,
    relayClients: relayWss.clients.size,
    connectedPeers: connectedPeers.size,
    uptime: Math.floor(process.uptime()),
  });
});

// ─── IP Bazlı İstek Sınırlayıcı (Rate Limiter: dakikada maks. 60 istek) ──────
const roomCheckBuckets = new Map();
function rateLimitRoomCheck(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let bucket = roomCheckBuckets.get(ip);
  if (!bucket || now - bucket.resetTime > 60000) {
    bucket = { count: 1, resetTime: now };
    roomCheckBuckets.set(ip, bucket);
  } else {
    bucket.count++;
  }
  if (roomCheckBuckets.size > 2000) {
    for (const [k, v] of roomCheckBuckets.entries()) {
      if (now - v.resetTime > 120000) roomCheckBuckets.delete(k);
    }
  }
  if (bucket.count > 60) {
    return res.status(429).json({ error: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.' });
  }
  next();
}

// ─── Oda Varlık Kontrolü ─────────────────────────────────────────────────────
app.get('/api/room-check', rateLimitRoomCheck, (req, res) => {
  const code = String(req.query.code || '').toUpperCase().trim();
  if (!code || !/^[A-Z0-9]{4,8}$/.test(code)) {
    return res.status(400).json({ error: 'Geçersiz oda kodu formatı.' });
  }
  const hasPeers = connectedPeers.has(code);
  const hasRelay = relayRooms.has(code) && (relayRooms.get(code).size > 0 || roomGraceTimers.has(code));
  const exists = hasPeers || hasRelay;
  res.json({ exists, code });
});

// ─── SPA Yönlendirmesi ───────────────────────────────────────────────────────
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/peerjs')) {
    return next();
  }
  if (req.path.startsWith('/assets/') || /\.[a-zA-Z0-9]+$/.test(req.path)) {
    return res.status(404).type('text/plain').send('Asset not found');
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      const target = `https://muteahhit-online.pages.dev${req.originalUrl || req.url}`;
      return res.redirect(302, target);
    }
  });
});

// ─── Güvenli Express Hata Yakalayıcı (Stack Trace Sızıntısını Önleme) ────────
app.use((err, req, res, next) => {
  console.error('[Express Hatası]:', err.message);
  res.status(500).json({ error: 'İç sunucu hatası oluştu.' });
});

// ─── Sunucuyu Başlat ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🏗️  Müteahhit Sunucusu v2.1 http://localhost:${PORT} adresinde hazır!`);
  console.log(`📡 PeerJS Sinyal Sunucusu: http://localhost:${PORT}/peerjs`);
  console.log(`🔄 WebSocket Relay Sunucusu: ws://localhost:${PORT}/wsrelay`);
  console.log(`🎮 Oyun mantığı: Tarayıcı tabanlı P2P (WebRTC DataChannel + Relay Fallback)`);
  console.log(`🛡️  Global hata yakalayıcıları ve güvenlik kalkanı aktif`);
});

