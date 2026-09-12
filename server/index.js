/**
 * Müteahhit Online — Minimal Sunucu
 * ===================================
 * v2.0 P2P Mimarisi: Sunucu artık oyun mantığı çalıştırmıyor.
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
  alive_timeout: 120000,          // 2 dakika heartbeat zaman aşımı
  expire_timeout: 60000,          // 60 saniye mesaj zaman aşımı (erken EXPIRE engeller)
  createWebSocketServer: (options) => {
    peerWss = new WebSocketServer(options);
    return peerWss;
  },
});

app.use('/peerjs', peerServer);

// ─── Bağlı Peer Takibi ───────────────────────────────────────────────────────
// Bağlı peer'ların listesi; /api/room-check endpoint'i için kullanılır.
// Host'un peer ID'si oda kodu olarak kullanıldığından bu liste oda varlığını temsil eder.
const connectedPeers = new Set();

peerServer.on('connection', (client) => {
  const id = client.getId();
  connectedPeers.add(id);
  console.log(`[PeerJS] Sinyal bağlantısı: ${id} (toplam: ${connectedPeers.size})`);
});

peerServer.on('disconnect', (client) => {
  const id = client.getId();
  connectedPeers.delete(id);
  console.log(`[PeerJS] Sinyal ayrıldı: ${id} (toplam: ${connectedPeers.size})`);
});

// ─── WebSocket Relay Sunucusu ─────────────────────────────────────────────────
// WebRTC P2P bağlantısı kurulamayan kullanıcılar (VPN, CGNAT, WARP, firewall)
// için sunucu aracılığıyla mesaj iletimi. Her mesaj tüm oda üyelerine yayılır.
//
// Bağlantı: wss://domain/wsrelay
// Protokol:
//   → { type: 'relay:join', roomCode: 'ABC123', playerId: 'id' }
//   ← { type: 'relay:joined' }
//   → { type: 'relay:msg', payload: { ...oyun mesajı... } }
//   ← { type: 'relay:msg', payload: { ...oyun mesajı... }, from: 'playerId' }
//   → { type: 'relay:leave' }

const relayWss = new WebSocketServer({ noServer: true });
const relayRooms = new Map(); // roomCode -> Map<WebSocket, playerId>

// 🔋 Zombi Bağlantı Temizleme (Dead connection reaper - 30sn)
const relayHeartbeat = setInterval(() => {
  relayWss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
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
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'relay:ping') {
        ws.isAlive = true;
        ws.send(JSON.stringify({ type: 'relay:pong', t0: msg.t0 }));
        return;
      }

      if (msg.type === 'relay:join') {
        roomCode = String(msg.roomCode || '').toUpperCase().trim();
        playerId = String(msg.playerId || '');
        if (!roomCode) { ws.close(); return; }

        if (!relayRooms.has(roomCode)) relayRooms.set(roomCode, new Map());
        relayRooms.get(roomCode).set(ws, playerId);

        ws.send(JSON.stringify({ type: 'relay:joined', roomCode, playerId }));
        console.log(`[Relay] ${playerId} odaya katıldı: ${roomCode} (${relayRooms.get(roomCode).size} kişi)`);

      } else if (msg.type === 'relay:msg') {
        if (!roomCode) return;
        const room = relayRooms.get(roomCode);
        if (!room) return;

        const targetId = msg.targetId || msg.payload?.targetId;
        const outgoing = JSON.stringify({ type: 'relay:msg', payload: msg.payload, from: playerId, targetId });
        room.forEach((pid, client) => {
          if (client !== ws && client.readyState === 1 /* OPEN */) {
            if (targetId && pid !== targetId) return; // Belirli hedefe özel mesaj
            client.send(outgoing);
          }
        });

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
            client.send(outgoing);
          }
        });
      }
    } catch (e) {
      console.error('[Relay] Mesaj parse hatası:', e.message);
    }
  });

  ws.on('close', () => {
    if (roomCode && relayRooms.has(roomCode)) {
      relayRooms.get(roomCode).delete(ws);
      console.log(`[Relay] ${playerId} odadan ayrıldı: ${roomCode} (${relayRooms.get(roomCode).size} kişi kaldı)`);
      if (relayRooms.get(roomCode).size === 0) {
        relayRooms.delete(roomCode);
        console.log(`[Relay] Boş oda silindi: ${roomCode}`);
      }
    }
  });

  ws.on('error', (err) => {
    console.error('[Relay] WebSocket hatası:', err.message);
  });
});

// Render / Cloudflare boşta kalma (idle) zaman aşımını önlemek için periyodik WebSocket ping
setInterval(() => {
  // 1. WebSocket Relay istemcilerini canlı tut
  relayWss.clients.forEach((client) => {
    if (client.readyState === 1 /* OPEN */) {
      try { client.ping(); } catch (_) {}
    }
  });
  // 2. PeerJS Sinyal istemcilerini canlı tut (10. saniyede Render proxy veya WARP kopmasını önler)
  if (peerWss) {
    peerWss.clients.forEach((client) => {
      if (client.readyState === 1 /* OPEN */) {
        try { client.ping(); } catch (_) {}
      }
    });
  }
}, 10000);

// HTTP Upgrade — /wsrelay path'i relay'e, diğerleri PeerJS'e
// ExpressPeerServer'ın kendi WebSocket sunucusunun /wsrelay isteklerini
// 400 Bad Request ile reddetmesini engellemek için upgrade dinleyicilerini yönlendiriyoruz.
const peerUpgradeListeners = httpServer.rawListeners('upgrade').slice();
httpServer.removeAllListeners('upgrade');

httpServer.on('upgrade', (req, socket, head) => {
  if (req.url && req.url.startsWith('/wsrelay')) {
    relayWss.handleUpgrade(req, socket, head, (ws) => {
      relayWss.emit('connection', ws, req);
    });
  } else {
    for (const listener of peerUpgradeListeners) {
      listener.call(httpServer, req, socket, head);
    }
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
    version: '2.0.0',
    architecture: 'P2P WebRTC + WebSocket Relay Fallback',
    relayRooms: relayRooms.size,
    connectedPeers: connectedPeers.size,
  });
});

// ─── Oda Varlık Kontrolü ─────────────────────────────────────────────────────
// ?code=HVB454 → { exists: true } veya { exists: false }
// İstemci bağlanmadan önce oda var mı diye sorar; yoksa anında hata gösterilebilir.
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
  // Statik varlıklar (/assets/*, .js, .css, .wasm vb.) express.static tarafından bulunamadıysa
  // ASLA index.html dönme, gerçek HTTP 404 dön! Aksi takdirde tarayıcı HTML'i JS gibi çalıştırmaya kalkışır.
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
  console.log(`🏗️  Müteahhit Sunucusu http://localhost:${PORT} adresinde hazır!`);
  console.log(`📡 PeerJS Sinyal Sunucusu: http://localhost:${PORT}/peerjs`);
  console.log(`🔄 WebSocket Relay Sunucusu: ws://localhost:${PORT}/wsrelay`);
  console.log(`🎮 Oyun mantığı: Tarayıcı tabanlı P2P (WebRTC DataChannel + Relay Fallback)`);
});
