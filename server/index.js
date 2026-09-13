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

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());

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
    peerWss = new WebSocketServer(options);
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

const relayWss = new WebSocketServer({ noServer: true });

// Map<roomCode, Map<WebSocket, playerId>>
const relayRooms = new Map();

// 🔋 Zombi Bağlantı Temizleme (Dead connection reaper - 30sn aralık, 3 cevapsız ping toleransı = 90sn)
// Mobil veya arka plan sekmelerinde (background throttling) timer yavaşlaması nedeniyle
// aktif oyuncuların bağlantısının erkenden koparılmasını engellemek için toleranslı kontrol:
const relayHeartbeat = setInterval(() => {
  relayWss.clients.forEach((ws) => {
    if (ws.missedPings >= 3) {
      console.warn('[Relay] Zombi bağlantı temizlendi (3 cevapsız ping)');
      return ws.terminate();
    }
    ws.missedPings = (ws.missedPings || 0) + 1;
    try { ws.ping(); } catch (_) {}
  });
}, 30000);

relayWss.on('close', () => {
  clearInterval(relayHeartbeat);
});

relayWss.on('connection', (ws) => {
  let roomCode = null;
  let playerId = null;

  ws.isAlive = true;
  ws.missedPings = 0;
  ws.on('pong', () => {
    ws.isAlive = true;
    ws.missedPings = 0;
  });

  ws.on('message', (raw) => {
    ws.missedPings = 0;
    // Tüm mesaj işleme try/catch içinde — bu throw atarsa sadece bu mesaj atlanır, sunucu çalışmaya devam eder
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'relay:ping') {
        ws.isAlive = true;
        ws.missedPings = 0;
        safeSend(ws, JSON.stringify({ type: 'relay:pong', t0: msg.t0 }));
        return;
      }

      if (msg.type === 'relay:join') {
        const newRoomCode = String(msg.roomCode || '').toUpperCase().trim();
        const newPlayerId = String(msg.playerId || '');
        if (!newRoomCode) { ws.close(); return; }

        // FIX: Aynı WebSocket başka bir odadan ayrılıyorsa temizle (re-join senaryosu)
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
        
        // FIX: Aynı ws için eski kaydı sil (duplicate entry önleme — reconnect senaryosu)
        relayRooms.get(roomCode).set(ws, playerId);

        safeSend(ws, JSON.stringify({ type: 'relay:joined', roomCode, playerId }));
        console.log(`[Relay] ${playerId} odaya katıldı: ${roomCode} (${relayRooms.get(roomCode).size} kişi)`);

      } else if (msg.type === 'relay:msg') {
        if (!roomCode) return;
        const room = relayRooms.get(roomCode);
        if (!room) return;

        const targetId = msg.targetId || msg.payload?.targetId;
        const outgoing = JSON.stringify({ type: 'relay:msg', payload: msg.payload, from: playerId, targetId });

        // FIX: forEach içinde her client.send() try/catch içinde — EPIPE server crash'ini önler
        room.forEach((pid, client) => {
          if (client !== ws && client.readyState === 1 /* OPEN */) {
            if (targetId && pid !== targetId) return;
            safeSend(client, outgoing);
          }
        });

      } else if (msg.type === 'relay:broadcast') {
        // Host → tüm client'lara (SYNC_STATE gibi)
        if (!roomCode) return;
        const room = relayRooms.get(roomCode);
        if (!room) return;

        const targetId = msg.targetId || msg.payload?.targetId;
        const outgoing = JSON.stringify({ type: 'relay:msg', payload: msg.payload, from: playerId, targetId });

        // FIX: forEach içinde her client.send() try/catch içinde — EPIPE server crash'ini önler
        room.forEach((pid, client) => {
          // Gönderen istemciye (Host) gereksiz echo geri gönderme!
          if (client !== ws && client.readyState === 1) {
            if (targetId && pid !== targetId) return;
            safeSend(client, outgoing);
          }
        });
      }
    } catch (e) {
      console.error('[Relay] Mesaj işleme hatası:', e.message);
    }
  });

  ws.on('close', () => {
    try {
      if (roomCode && relayRooms.has(roomCode)) {
        relayRooms.get(roomCode).delete(ws);
        const remaining = relayRooms.get(roomCode).size;
        console.log(`[Relay] ${playerId} odadan ayrıldı: ${roomCode} (${remaining} kişi kaldı)`);
        if (remaining === 0) {
          relayRooms.delete(roomCode);
          console.log(`[Relay] Boş oda silindi: ${roomCode}`);
        }
      }
    } catch (err) {
      console.error('[Relay] close event hatası:', err.message);
    }
  });

  ws.on('error', (err) => {
    // FIX: WebSocket hata event'ini yakala — yakalanmayan hata sunucuyu crash'ler
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
}, 10000);

// HTTP Upgrade — /wsrelay path'i relay'e, diğerleri PeerJS'e
const peerUpgradeListeners = httpServer.rawListeners('upgrade').slice();
httpServer.removeAllListeners('upgrade');

httpServer.on('upgrade', (req, socket, head) => {
  try {
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

// ─── Oda Varlık Kontrolü ─────────────────────────────────────────────────────
app.get('/api/room-check', (req, res) => {
  const code = String(req.query.code || '').toUpperCase().trim();
  if (!code) {
    return res.status(400).json({ error: 'code parametresi gerekli' });
  }
  const exists = connectedPeers.has(code) || (relayRooms.has(code) && relayRooms.get(code).size > 0);
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
      res.send(`
        <html>
          <body style="font-family:sans-serif; background:#0f172a; color:#fff; text-align:center; padding:50px;">
            <h2>🏗️ Müteahhit Online</h2>
            <p>Frontend derlendikten sonra oyun burada görünecektir.</p>
            <p style="color:#94a3b8; font-size:0.85em;">PeerJS Sinyal Sunucusu aktif: <code>/peerjs</code></p>
          </body>
        </html>
      `);
    }
  });
});

// ─── Sunucuyu Başlat ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🏗️  Müteahhit Sunucusu v2.1 http://localhost:${PORT} adresinde hazır!`);
  console.log(`📡 PeerJS Sinyal Sunucusu: http://localhost:${PORT}/peerjs`);
  console.log(`🔄 WebSocket Relay Sunucusu: ws://localhost:${PORT}/wsrelay`);
  console.log(`🎮 Oyun mantığı: Tarayıcı tabanlı P2P (WebRTC DataChannel + Relay Fallback)`);
  console.log(`🛡️  Global hata yakalayıcıları aktif — crash koruması açık`);
});
