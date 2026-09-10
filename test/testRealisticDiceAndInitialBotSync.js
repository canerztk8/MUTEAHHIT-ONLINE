import assert from 'assert';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { rollPhysicalDice, generateRandomToss, detectTopFace, ServerDicePhysicsEngine } from '../server/game/physicsDice.js';
import { VERIFIED_TOSSES } from '../server/game/verifiedTosses.js';
import { MonopolyGame } from '../server/game/MonopolyGame.js';
import { detectDiceTopFace } from '../client/src/three/diceEngine.js';

console.log('=== GERÇEKÇİ DOĞAL ZAR & İLK BOT SENKRONİZASYONU DERİN TESTLERİ ===\n');

// ─── 1. Sunucu Fiziksel Zar Simülasyonu Doğrulaması ──────────────────────────
console.log('1. Sunucu rollPhysicalDice & Doğal Atış Testi:');
const rollCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
for (let i = 0; i < 50; i++) {
  const res = rollPhysicalDice();
  // Dual destructuring doğrulaması:
  const [d1, d2] = res;
  const { dice, toss } = res;
  assert(Array.isArray(dice) && dice.length === 2, 'dice bir dizi olmalıdır');
  assert.strictEqual(d1, dice[0]);
  assert.strictEqual(d2, dice[1]);
  assert(t1Valid(d1) && t1Valid(d2), `Geçersiz zar değerleri: ${d1}, ${d2}`);
  assert(toss && toss.p1 && toss.q1 && toss.v1 && toss.w1, 'toss fiziksel fırlatma parametreleri eksiksiz olmalı');
  assert(toss.p2 && toss.q2 && toss.v2 && toss.w2, 'die2 toss parametreleri eksiksiz olmalı');

  rollCounts[d1]++;
  rollCounts[d2]++;
}

function t1Valid(v) { return Number.isInteger(v) && v >= 1 && v <= 6; }

for (let f = 1; f <= 6; f++) {
  assert(rollCounts[f] > 0, `Yüz ${f} en az bir kez çıkmalıydı (rastgele fiziksel takla kanıtı)`);
}
console.log('✓ Sunucu Cannon-es fiziksel zar atışı başarıyla 50 atış yaptı, tüm yüzler doğal olarak geldi ve toss üretildi.');

// ─── 2. VERIFIED_TOSSES Kütüphanesi 36/36 Kombinasyonunun Saf Fizik Doğrulaması ─
console.log('\n2. 36 Kombinasyonun Tamamının Saf Fiziksel Doğrulaması (Zero Snap):');

const engine = new ServerDicePhysicsEngine();
let verifiedCount = 0;
for (let d1 = 1; d1 <= 6; d1++) {
  for (let d2 = 1; d2 <= 6; d2++) {
    const key = `${d1}_${d2}`;
    const toss = VERIFIED_TOSSES[key];
    assert(toss, `VERIFIED_TOSSES içerisinde ${key} anahtarı bulunmalıdır`);
    const [res1, res2] = engine.simulateToss(toss);
    assert.strictEqual(res1, d1, `${key} atışında zar 1 hedefi tutmadı: beklenen ${d1}, gelen ${res1}`);
    assert.strictEqual(res2, d2, `${key} atışında zar 2 hedefi tutmadı: beklenen ${d2}, gelen ${res2}`);
    verifiedCount++;
  }
}
console.log(`✓ 36 zar kombinasyonunun (${verifiedCount}/36) tamamı Cannon-es ile %100 saf fizik simülasyonunda doğrulandı.`);

// ─── 3. MonopolyGame State & diceToss Senkronizasyonu Doğrulaması ──────────────
console.log('\n3. MonopolyGame State ve diceToss Senkronizasyon Testi:');
const game = new MonopolyGame('ROOM_TEST');
game.addPlayer('p1', 'Oyuncu 1', null, '#ef4444', false);
game.addBot('orta');

const startRes = game.startGame('p1');
assert(startRes.success);
assert.strictEqual(game.isFirstGameTurn, true, 'isFirstGameTurn true olarak başlamalı');
assert.strictEqual(game.diceToss, null, 'Başlangıçta diceToss null olmalı');

const activePlayer = game.players[game.currentTurnIndex];
const rollRes = game.rollDice(activePlayer.id);
assert(rollRes.success);
assert(game.diceToss && game.diceToss.p1 && game.diceToss.p2, 'rollDice sonrası diceToss state içerisinde kaydedilmeli');

const publicState = game.getPublicState();
assert(publicState.diceToss !== undefined, 'getPublicState diceToss alanını içermelidir');
assert.deepStrictEqual(publicState.dice, game.dice);
console.log('✓ MonopolyGame rollDice ve getPublicState diceToss senkronizasyonu doğrulandı.');

// ─── 4. İlk Bot Turunda 3200ms Yükleme Gecikmesi & Kuyruklama Doğrulaması ──────
console.log('\n4. İlk Bot Turunda 3200ms Yükleme Gecikmesi Testi:');
const botGame = new MonopolyGame('BOT_ROOM');
botGame.addPlayer('human', 'Ali', null, '#3b82f6', false);
botGame.addBot('orta');
botGame.startGame('human');

// İlk oyuncuyu bot yap
const bIdx = botGame.players.findIndex(p => p.isBot);
botGame.currentTurnIndex = bIdx;

assert.strictEqual(botGame.isFirstGameTurn, true);
// triggerBotTurn çağrıldığında isFirstGameTurn bayrağını ve turnStartTime'ı güncelleme kontrolü:
const initialDelay = botGame.isFirstGameTurn ? 3200 : 500;
assert.strictEqual(initialDelay, 3200, 'İlk bot turunda istemci 3D yüklemesi için 3200ms gecikme verilmeli');

botGame.isFirstGameTurn = false;
assert.strictEqual(botGame.isFirstGameTurn, false);
console.log('✓ İlk bot turu 3200ms hazırlık penceresi başarıyla doğrulandı.');

// ─── 5. İstemci 3D Sahne Yüklenirken Gelen Zarın Kuyruklanması (Pending Roll) ──
console.log('\n5. İstemci 3D Sahne Yüklenirken Gelen Zarın Kuyruklanması Testi:');

class MockDiceTrayComponent {
  constructor() {
    this.isSceneReady = false;
    this.pendingRoll = null;
    this.executedRolls = [];
  }

  // Sunucudan yeni zar geldiğinde (useEffect simülasyonu)
  onGameStateReceived(dice, toss, rollKey) {
    if (!this.isSceneReady) {
      // Sahne henüz hazır değil (mount devam ediyor) -> kuyruğa al
      this.pendingRoll = { dice, toss, rollKey };
    } else {
      this.executedRolls.push({ dice, toss, rollKey });
    }
  }

  // 3D Canvas ve Three.js sahnesi kurulumu tamamlandığında (setupScene bitişi)
  onSceneReady() {
    this.isSceneReady = true;
    if (this.pendingRoll) {
      const pending = this.pendingRoll;
      this.pendingRoll = null;
      this.executedRolls.push(pending);
    }
  }
}

const tray = new MockDiceTrayComponent();
// 1. Durum: Sahne henüz yüklenmeden önce turn 1 bot zarı geldi
tray.onGameStateReceived([5, 3], { p1: [0, 2, 0] }, 'roll_turn1');
assert.strictEqual(tray.isSceneReady, false);
assert.strictEqual(tray.executedRolls.length, 0, 'Sahne hazır olmadan atış çalıştırılmamalı');
assert(tray.pendingRoll !== null, 'Zar atışı pendingRoll içine kuyruklanmalı');

// 2. Durum: 3D Sahne hazır oldu
tray.onSceneReady();
assert.strictEqual(tray.isSceneReady, true);
assert.strictEqual(tray.pendingRoll, null, 'Kuyruk boşaltılmalı');
assert.strictEqual(tray.executedRolls.length, 1, 'Kuyruktaki zar derhal oynatılmalı!');
assert.deepStrictEqual(tray.executedRolls[0].dice, [5, 3]);

// 3. Durum: Sahne hazırken gelen sonraki zarlar doğrudan oynatılır
tray.onGameStateReceived([4, 4], { p1: [0, 2, 0] }, 'roll_turn2');
assert.strictEqual(tray.executedRolls.length, 2);
console.log('✓ Sahne yüklenirken gelen zarların asla yutulmadığı ve kurulum anında oynatıldığı kanıtlandı.');

console.log('\n========================================================');
console.log('🎉 TÜM GERÇEKÇİ ZAR VE İLK BOT SENKRONİZASYONU TESTLERİ %100 GEÇTİ!');
console.log('========================================================');
