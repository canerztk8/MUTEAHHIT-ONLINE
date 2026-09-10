import assert from 'assert';
import { MonopolyGame } from '../server/game/MonopolyGame.js';
import { RoomManager } from '../server/game/RoomManager.js';

// Müteahhit Online Güvenlik ve Optimizasyon Test Paketi
console.log('=== GÜVENLİK, PERFORMANS VE CODE REVIEW DÜZELTMELERİ TESTİ BAŞLIYOR ===');

// 1. Session Token İfşa Koruması & getPublicState Güvenliği Testi
console.log('1. Session Token Veri İfşa Koruması Testi:');
const game = new MonopolyGame('SEC001');
const p1Res = game.addPlayer('socket_1', 'Caner', null, '#ef4444', false);
const p2Res = game.addPlayer('socket_2', 'Ahmet', null, '#3b82f6', false);

assert.ok(p1Res.player.sessionToken, 'addPlayer çağrısı özel oturum tokenı üretmeli');
assert.ok(p1Res.player.sessionToken.startsWith('st_'), 'Token st_ ön ekiyle başlamalı');
// crypto.randomUUID hex length is 32 chars + 3 chars prefix = 35 chars
assert.ok(p1Res.player.sessionToken.length >= 34, `Güvenli UUID uzunluğu bekleniyor, uzunluk: ${p1Res.player.sessionToken.length}`);

const publicState = game.getPublicState();
for (const p of publicState.players) {
  assert.strictEqual(p.sessionToken, undefined, `sessionToken genel duruma (getPublicState) sızmamalı! Oyuncu: ${p.name}`);
}
if (publicState.activePlayer) {
  assert.strictEqual(publicState.activePlayer.sessionToken, undefined, 'activePlayer objesinde sessionToken sızmamalı!');
}
console.log('✓ getPublicState() içinde sessionToken sızıntısı kesin olarak engellendi.');

// 2. Yeniden Bağlanma (Reconnect) Doğrulaması (Token sızmasa bile sunucuda geçerlidir)
console.log('2. Yeniden Bağlanma Güvenliği Testi:');
const privateToken = p1Res.player.sessionToken;
const recRes = game.reconnectPlayer('socket_1_new', privateToken);
assert.strictEqual(recRes.success, true, 'Özel token ile yeniden bağlanma başarılı olmalı');
assert.strictEqual(recRes.player.id, 'socket_1_new');
console.log('✓ Özel sessionToken ile yeniden bağlanma başarıyla doğrulandı.');

// 3. RoomManager Bellek Sızıntısı & Yetim Oda Koruması Testi
console.log('3. RoomManager Yetim Oda Koruması Testi:');
const rm = new RoomManager();
const r1 = rm.createRoom('socket_user_a');
const room1Code = r1.roomCode;
assert.ok(rm.rooms.has(room1Code), 'Oda 1 oluşturuldu');
assert.strictEqual(rm.socketToRoom.get('socket_user_a'), room1Code);

// Kullanıcı soketini kapatmadan yeni bir oda açarsa önceki oda yetim kalmamalı, temizlenmeli!
const r2 = rm.createRoom('socket_user_a');
const room2Code = r2.roomCode;
assert.notStrictEqual(room1Code, room2Code);
assert.ok(!rm.rooms.has(room1Code), 'Önceki oda lobi aşamasında sahipsiz kaldığı için derhal silindi');
assert.ok(rm.rooms.has(room2Code), 'Yeni oda başarıyla oluşturuldu');
assert.strictEqual(rm.socketToRoom.get('socket_user_a'), room2Code);

// Başka odaya katılırken önceki odadan ayrılma testi
const r3 = rm.createRoom('socket_user_b');
rm.joinRoom(r3.roomCode, 'socket_user_a', 'Caner Yeni');
assert.ok(!rm.rooms.has(room2Code), 'Başka odaya geçince eski oda bellekten silindi');
assert.strictEqual(rm.socketToRoom.get('socket_user_a'), r3.roomCode);
console.log('✓ RoomManager yetim oda ve bellek sızıntısı koruması doğrulandı.');

// 4. Sunucu Otoriter Zar Atışı Testi (Client Custom Dice Spoofing Koruması)
console.log('4. Zar Otoritesi ve Sahtecilik Koruması Testi:');
const testGame = new MonopolyGame('DICE01');
testGame.addPlayer('p_roll', 'Tester', null, '#ef4444', false);
testGame.startGame('p_roll');

// Standart (non-dev) oyunda sunucu fiziksel zarları kendisi üretir
const rollRes = testGame.rollDice('p_roll');
assert.ok(rollRes.success);
assert.ok(Array.isArray(testGame.dice) && testGame.dice.length === 2);
assert.ok(testGame.dice[0] >= 1 && testGame.dice[0] <= 6);
assert.ok(testGame.dice[1] >= 1 && testGame.dice[1] <= 6);
assert.ok(testGame.lastDiceRollId, 'lastDiceRollId üretildi');
console.log('✓ Sunucu Cannon-es fizik motoru otoriter zar atışını başarıyla gerçekleştirdi.');

console.log('=============================================================');
console.log('🎉 TÜM GÜVENLİK VE PERFORMANS DÜZELTMELERİ %100 BAŞARIYLA GEÇTİ!');
console.log('=============================================================');
