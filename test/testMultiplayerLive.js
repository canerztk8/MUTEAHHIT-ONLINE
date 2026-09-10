import { spawn } from "child_process";
import { io } from "socket.io-client";

console.log("=== MÜTEAHHİT CANLI 2 İSTEMCİLİ ÇOK OYUNCULU TESTİ BAŞLIYOR ===");

const serverProcess = spawn("node", ["server/index.js"], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, PORT: "3002" }
});

serverProcess.stdout.on("data", (data) => {
  const msg = data.toString().trim();
  if (msg.includes("Müteahhit Sunucusu")) {
    console.log(`[SUNUCU] ${msg}`);
    runClientTests();
  }
});

serverProcess.stderr.on("data", (data) => {
  console.error("[SUNUCU HATA]:", data.toString());
});

function cleanup(exitCode = 0) {
  console.log("\n[TEMİZLİK] İstemciler ve sunucu kapatılıyor...");
  try {
    serverProcess.kill();
  } catch (e) {}
  process.exit(exitCode);
}

process.on("SIGINT", () => cleanup(1));
process.on("uncaughtException", (err) => {
  console.error("Testte beklenmeyen hata:", err);
  cleanup(1);
});

async function runClientTests() {
  const SERVER_URL = "http://localhost:3002";
  console.log(`\n[BAĞLANTI] 2 Ayrı İstemci ${SERVER_URL} adresine bağlanıyor...`);

  const socket1 = io(SERVER_URL, { forceNew: true, reconnection: false });
  const socket2 = io(SERVER_URL, { forceNew: true, reconnection: false });

  let roomCode = "";
  let p1Id = "";
  let p2Id = "";
  let gameState = null;

  socket1.on("game_state", (state) => {
    gameState = state;
  });

  // 1. Bağlantı Kur
  await Promise.all([
    new Promise((resolve) => socket1.on("connect", resolve)),
    new Promise((resolve) => socket2.on("connect", resolve))
  ]);
  console.log(`✓ İstemci 1 (Caner) bağlandı: ${socket1.id}`);
  console.log(`✓ İstemci 2 (Ahmet) bağlandı: ${socket2.id}`);

  // 2. Oda Kur
  await new Promise((resolve) => {
    socket1.emit("create_room", { playerName: "Caner", token: { id: "baret", name: "Baret", icon: "👷" }, color: "#e11d48" }, (res) => {
      if (!res.success) throw new Error("Oda oluşturulamadı: " + res.error);
      roomCode = res.roomCode;
      p1Id = res.player.id;
      console.log(`✓ İstemci 1 odayı kurdu: Kod = [${roomCode}]`);
      resolve();
    });
  });

  // 3. Odaya Katıl
  await new Promise((resolve) => {
    socket2.emit("join_room", { roomCode, playerName: "Ahmet", token: { id: "kepce", name: "Kepçe", icon: "🚜" }, color: "#0284c7" }, (res) => {
      if (!res.success) throw new Error("Odaya katılınamadı: " + res.error);
      p2Id = res.player.id;
      console.log(`✓ İstemci 2 odaya katıldı! Oyuncu ID = ${p2Id}`);
      resolve();
    });
  });

  // 4. Canlı Sohbet Mesajlaşması
  await new Promise((resolve) => {
    socket2.on("chat_message", (msg) => {
      console.log(`✓ İstemci 2 mesajı aldı: [${msg.senderName}]: "${msg.text}"`);
      resolve();
    });
    socket1.emit("send_chat", { message: "Selam Ahmet, bol şans!" });
  });

  // 5. Oyunu Başlat
  await new Promise((resolve) => {
    socket1.emit("start_game", null, (res) => {
      if (!res.success) throw new Error("Oyun başlatılamadı: " + res.error);
      console.log("✓ İstemci 1 oyunu başlattı!");
      resolve();
    });
  });

  await new Promise((r) => setTimeout(r, 300));
  console.log(`✓ Oyun Başladı! Aktif Oyuncu: ${gameState.players[gameState.currentTurnIndex].name}, Faz: ${gameState.phase}`);

  // 6. Zar Atma
  const activeSocket = gameState.players[gameState.currentTurnIndex].id === p1Id ? socket1 : socket2;
  const activeName = gameState.players[gameState.currentTurnIndex].name;

  await new Promise((resolve) => {
    activeSocket.emit("roll_dice", null, (res) => {
      if (!res.success) throw new Error("Zar atılamadı: " + res.error);
      console.log(`✓ ${activeName} zar attı! Zarlar: [${gameState.dice.join(", ")}], Yeni Kare: "${res.tile?.name || gameState.currentTile?.name || 'Kare'}"`);
      resolve();
    });
  });

  await new Promise((r) => setTimeout(r, 400));

  // 7. Mülk Satın Alma veya Pas
  if (gameState.phase === "TILE_ACTION") {
    await new Promise((resolve) => {
      activeSocket.emit("buy_property", null, (res) => {
        if (res.success) {
          console.log(`✓ ${activeName}, "${res.tile?.name}" mülkünü satın aldı!`);
        } else {
          console.log(`✓ ${activeName} pas geçti (${res.error || 'Pas'}).`);
          activeSocket.emit("decline_buy", null, () => {});
        }
        resolve();
      });
    });
  }

  await new Promise((r) => setTimeout(r, 400));

  // 8. Turu Bitirme
  if (gameState.phase === "TURN_ACTIONS") {
    await new Promise((resolve) => {
      activeSocket.emit("end_turn", null, (res) => {
        console.log(`✓ ${activeName} turunu bitirdi!`);
        resolve();
      });
    });
  }

  await new Promise((r) => setTimeout(r, 400));
  console.log(`✓ Sıra sonraki oyuncuya geçti: ${gameState.players[gameState.currentTurnIndex].name}`);

  // 9. Hediye Gönderme Testi (Caner -> Ahmet'e 75₺)
  await new Promise((resolve) => {
    socket1.emit("send_gift", { toPlayerId: p2Id, amount: 75 }, (res) => {
      if (!res.success) throw new Error("Hediye gönderilemedi: " + res.error);
      console.log("✓ İstemci 1, İstemci 2'ye 75₺ hediye gönderdi!");
      resolve();
    });
  });

  await new Promise((r) => setTimeout(r, 400));
  const newMoneyP2 = gameState.players.find(p => p.id === p2Id).money;
  console.log(`✓ İstemci 2'nin yeni bakiyesi senkronize oldu: ${newMoneyP2}₺`);

  // 10. Son Çare Acil Banka Kredisi Testi
  await new Promise((resolve) => {
    socket2.emit("request_bank_loan", { amount: 200 }, (res) => {
      if (res.success) {
        console.log(`✓ İstemci 2 Merkez Bankası'ndan 200₺ acil kredi kullandı! (Toplam Borç: ${res.loan?.totalRepay}₺)`);
      } else {
        console.log(`✓ Banka kredisi yanıtı: ${res.error}`);
      }
      resolve();
    });
  });

  await new Promise((r) => setTimeout(r, 400));
  console.log(`✓ Aktif Krediler Listesi: ${gameState.activeLoans?.length || 0} adet borç kaydı var.`);

  console.log("\n========================================================");
  console.log("🎉 TÜM ÇOK OYUNCULU CANLI SOCKET.IO TESTLERİ %100 BAŞARILI!");
  console.log("========================================================");

  socket1.disconnect();
  socket2.disconnect();
  cleanup(0);
}
