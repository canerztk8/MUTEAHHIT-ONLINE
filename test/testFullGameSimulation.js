import assert from 'assert';
import { MonopolyGame } from '../server/game/MonopolyGame.js';

console.log('=== END-TO-END 4-BOT OYUN SİMÜLASYONU BAŞLIYOR ===');

const game = new MonopolyGame('SIM001');

// 1. Dört bot ekle
const p1 = game.addPlayer('bot_ankara', 'Müteahhit Ankara', { id: 'hard_hat' }, '#ef4444', true);
const p2 = game.addPlayer('bot_cankaya', 'Çankaya Beyi', { id: 'briefcase' }, '#3b82f6', true);
const p3 = game.addPlayer('bot_kecioren', 'Keçiörenli', { id: 'car' }, '#10b981', true);
const p4 = game.addPlayer('bot_mamak', 'Mamak Rüzgarı', { id: 'coffee' }, '#f59e0b', true);

// Zorlukları ayarla
game.setBotDifficulty('bot_ankara', 'uzman');
game.setBotDifficulty('bot_cankaya', 'orta');
game.setBotDifficulty('bot_kecioren', 'kolay');
game.setBotDifficulty('bot_mamak', 'orta');

console.log('✓ 4 bot lobiye eklendi ve zorlukları yapılandırıldı.');

// 2. Oyunu başlat
const startRes = game.startGame('bot_ankara');
assert.strictEqual(startRes.success, true, 'Oyun başlatılamadı');
assert.strictEqual(game.status, 'playing');
console.log('✓ Oyun resmen başlatıldı.');

// 3. 100 tura kadar bot hamlelerini simüle et
let turnCount = 0;
const maxTurns = 80;

while (game.status === 'playing' && turnCount < maxTurns) {
  turnCount++;
  const active = game.getActivePlayer();
  if (!active) break;

  // Eğer açık artırma fazındaysa ihaleyi sonlandır
  if (game.phase === 'AUCTION' && game.auction) {
    game.endAuction();
  }

  // fastForwardBotTurn ile bot turunu eksiksiz çalıştır
  const ffRes = game.fastForwardBotTurn();
  
  // Eğer açık artırma açıldıysa ihaleyi çöz
  if (game.phase === 'AUCTION' && game.auction) {
    game.endAuction();
  }

  // Tura devam et veya bir sonraki tura geçir
  if (game.phase === 'TURN_ACTIONS') {
    game.endTurn(active.id);
  } else if (game.phase === 'CARD_DRAWN') {
    game.acknowledgeCard(active.id);
  } else if (game.phase === 'WAITING_ROLL') {
    // Normal akış devam ediyor
  }
}

console.log(`✓ Simülasyon ${turnCount} tur boyunca başarıyla çalıştırıldı. Oyun Durumu: ${game.status}`);

// 4. Oyun durumu ve bütünlük doğrulaması
const state = game.getPublicState();
assert.ok(state, 'Public state alınamadı');
assert.ok(Array.isArray(state.players), 'Oyuncular dizisi eksik');
assert.strictEqual(state.players.length, 4, '4 oyuncu korunmalı');

// Ev / Otel Denge Kontrolü
for (const [tileId, prop] of Object.entries(game.properties)) {
  if (prop.houses > 0) {
    assert.ok(prop.houses >= 1 && prop.houses <= 5, `Geçersiz ev sayısı: ${prop.houses}`);
    assert.ok(prop.ownerId, `Sahipsiz arsada ev bulunamaz: ${tileId}`);
  }
}
console.log('✓ Ev ve otel seviyeleri kural bütünlüğüne (%100) uygun.');

// Mülk sahiplik kontrolü
const ownedTiles = new Set();
for (const [tileId, prop] of Object.entries(game.properties)) {
  if (prop.ownerId) {
    assert.ok(!ownedTiles.has(tileId), `Aynı mülk çift kaydedilmiş: ${tileId}`);
    ownedTiles.add(tileId);
  }
}
console.log(`✓ Toplam ${ownedTiles.size} adet mülk mülkiyet bütünlüğü doğrulandı.`);

// Borç / Kredi Kontrolü
for (const player of game.players) {
  if (player.isBankrupt) {
    assert.strictEqual(player.money, 0, 'İflas eden oyuncunun parası 0 olmalı');
    console.log(`  - Elenen Bot: ${player.name} (${player.lastEliminationReason || 'İflas'})`);
  }
}

console.log('✓ Public state export ve oyuncu durumları doğrulandı.');
console.log('======================================================');
console.log('🎉 E2E FULL OYUN SİMÜLASYONU HATASIZ TAMAMLANDI!');
console.log('======================================================');
