import { MonopolyGame } from '../server/game/MonopolyGame.js';
import { BOARD_TILES } from '../server/game/boardData.js';

console.log('=== TAKAS KUYRUĞU VE COOLDOWN MEKANİZMASI TESTİ ===\n');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ HATA: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ ${message}`);
  }
}

// 1. Oyun ve Oyuncuları Başlat
const game = new MonopolyGame('TRADE_TEST');
game.addPlayer('p1', 'Ahmet');
game.addPlayer('p2', 'Mehmet');
game.addPlayer('p3', 'Ayşe');
game.startGame('p1');

// P1 ve P2'ye mülk ata (Kahverengi grup)
game.properties[1] = { ownerId: 'p1', houses: 0, mortgaged: false };
game.properties[3] = { ownerId: 'p2', houses: 0, mortgaged: false };
game.properties[6] = { ownerId: 'p3', houses: 0, mortgaged: false };

// 2. Ahmet (P1), Mehmet'e (P2) Takas Teklifi Gönderir
console.log('\n--- 1. İlk Takas Teklifi (P1 -> P2) ---');
const res1 = game.proposeTrade('p1', {
  toPlayerId: 'p2',
  offeredMoney: 50,
  offeredProperties: [1],
  requestedMoney: 0,
  requestedProperties: [3]
});

assert(res1.success === true, 'P1 -> P2 takas teklifi başarılı olmalı');
assert(res1.queued === false, 'İlk takas sıraya alınmamalı, doğrudan pendingTrade olmalı');
assert(game.pendingTrade !== null, 'pendingTrade dolu olmalı');
assert(game.pendingTrade.fromPlayerId === 'p1', 'pendingTrade gönderen P1 olmalı');
assert(game.pendingTrade.toPlayerId === 'p2', 'pendingTrade alıcı P2 olmalı');
assert(game.tradeQueue.length === 0, 'Sıra boş olmalı');

// 3. Cooldown Kontrolü: Ahmet hemen tekrar Mehmet'e teklif gönderememeli
console.log('\n--- 2. Cooldown Kontrolü (P1 -> P2 Tekrarı) ---');
const resCooldown = game.proposeTrade('p1', {
  toPlayerId: 'p2',
  offeredMoney: 10,
  offeredProperties: [1],
  requestedMoney: 0,
  requestedProperties: [3]
});

assert(resCooldown.success === false, 'Cooldown süresince aynı oyuncuya teklif gönderilememeli');
assert(resCooldown.error.includes('beklemelisiniz'), `Cooldown hatası dönmeli: "${resCooldown.error}"`);

// 4. Ayşe (P3), Mehmet'e (P2) Takas Teklifi Gönderir -> Sıraya Alınmalı
console.log('\n--- 3. Eşzamanlı Teklif Kuyruğa Alınmalı (P3 -> P2) ---');
const res2 = game.proposeTrade('p3', {
  toPlayerId: 'p2',
  offeredMoney: 100,
  offeredProperties: [6],
  requestedMoney: 0,
  requestedProperties: [3]
});

assert(res2.success === true, 'P3 -> P2 takası kabul edilmeli');
assert(res2.queued === true, 'P3 -> P2 teklifi kuyruğa (sıraya) alınmalı');
assert(game.pendingTrade.fromPlayerId === 'p1', 'pendingTrade hala ilk teklif (P1) olmalı, ezilmemeli');
assert(game.tradeQueue.length === 1, 'tradeQueue uzunluğu 1 olmalı');
assert(game.tradeQueue[0].fromPlayerId === 'p3', 'Kuyruktaki teklif P3 olmalı');

// 5. getPublicState Kontrolü
console.log('\n--- 4. Public State Kontrolleri (tradeQueue ve tradeCooldowns) ---');
const pubState = game.getPublicState();
assert(Array.isArray(pubState.tradeQueue), 'publicState.tradeQueue dizi olmalı');
assert(pubState.tradeQueue.length === 1, 'publicState.tradeQueue 1 eleman içermeli');
assert(pubState.tradeCooldowns !== undefined, 'publicState.tradeCooldowns tanımlı olmalı');
assert(pubState.tradeCooldowns['p1_p2'] > 0, 'p1_p2 cooldown zaman damgası mevcut olmalı');

// 6. Mehmet (P2), Ahmet'in (P1) Teklifini Reddeder -> Sıradaki P3 teklifi açılmalı
console.log('\n--- 5. Teklif Reddedilince Sıradakinin Otomatik Açılması ---');
const respondRes = game.respondTrade('p2', false);
assert(respondRes.success === true, 'P2 teklifi reddedebilmeli');
assert(respondRes.accepted === false, 'accepted false olmalı');

// Şimdi pendingTrade otomatik olarak P3'ün teklifine dönüşmeli
assert(game.pendingTrade !== null, 'Sıradaki teklif aktifleştiği için pendingTrade dolu olmalı');
assert(game.pendingTrade.fromPlayerId === 'p3', 'Yeni pendingTrade P3 tarafından olmalı');
assert(game.pendingTrade.toPlayerId === 'p2', 'Yeni pendingTrade alıcı P2 olmalı');
assert(game.tradeQueue.length === 0, 'Kuyruk boşalmış olmalı');

// 7. Mehmet (P2), Ayşe'nin (P3) Teklifini Kabul Eder
console.log('\n--- 6. Sıradaki Teklifin Kabul Edilmesi ve Tamamlanması ---');
const p3MoneyBefore = game.players.find(p => p.id === 'p3').money;
const p2MoneyBefore = game.players.find(p => p.id === 'p2').money;

const acceptRes = game.respondTrade('p2', true);
assert(acceptRes.success === true, 'P2, P3 teklifini kabul edebilmeli');
assert(acceptRes.accepted === true, 'accepted true olmalı');
assert(game.pendingTrade === null, 'Tüm teklifler bittiğinde pendingTrade null olmalı');
assert(game.properties[6].ownerId === 'p2', 'Mülk 6 artık P2 nin olmalı');
assert(game.properties[3].ownerId === 'p3', 'Mülk 3 artık P3 ün olmalı');

// 8. İflas Durumunda Takas Kuyruğunun Temizlenmesi
console.log('\n--- 7. İflas ve İptal Temizliği ---');
// P1 -> P3 e takas aç
game.proposeTrade('p1', {
  toPlayerId: 'p3',
  offeredMoney: 20,
  offeredProperties: [1],
  requestedMoney: 0,
  requestedProperties: [3]
});
assert(game.pendingTrade !== null, 'P1 -> P3 pendingTrade aktif');

// P1 iflas etti
game.declareBankruptcy('p1');
assert(game.pendingTrade === null, 'İflas eden oyuncunun bekleyen takası temizlenmeli');
assert(game.tradeQueue.length === 0, 'İflas eden oyuncunun kuyruktaki takasları temizlenmeli');

console.log('\n🎉 TÜM TAKAS KUYRUĞU VE COOLDOWN TESTLERİ BAŞARIYLA GEÇTİ!');
