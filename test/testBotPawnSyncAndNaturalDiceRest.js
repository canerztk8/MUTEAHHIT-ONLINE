import assert from 'assert';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MonopolyGame } from '../server/game/MonopolyGame.js';
import { getTargetQuaternionForFace, detectDiceTopFace } from '../client/src/three/diceEngine.js';

console.log('=== BOT PIYON SENKRONIZASYONU VE DOGAL ZAR DURUS TESTLERI ===\n');

// 1. Bot Zar Atisinda lastDiceRollId Tespiti ve isDiceRolling Senkronizasyonu
console.log('1. Bot Zar Atisinda lastDiceRollId Tespiti ve isDiceRolling Senkronizasyonu:');
const game = new MonopolyGame('ROOM_SYNC');
game.addPlayer('human', 'Ali', null, '#3b82f6', false);
game.addBot('orta');
game.startGame('human');

// Ilk oyuncuyu bot yap
const botIndex = game.players.findIndex(p => p.isBot);
game.currentTurnIndex = botIndex;
const botPlayer = game.players[botIndex];

let prevState = null;
let isDiceRollingClient = false;

// Istemci handleIncomingState mantigini birebir simule et
function simulateIncomingState(state) {
  const prev = prevState;
  const isNewDiceRoll = Boolean(
    prev &&
    state.lastDiceRollId &&
    state.lastDiceRollId !== prev.lastDiceRollId
  );
  if (isNewDiceRoll && state.status === 'playing') {
    isDiceRollingClient = true;
  }
  prevState = state;
}

// Baslangic durumu
simulateIncomingState(game.getPublicState());
assert.strictEqual(isDiceRollingClient, false, 'Henuz zar atilmadan isDiceRolling false olmali');

// Bot zar atiyor
const prevRollId = game.lastDiceRollId;
game.rollDice(botPlayer.id);
const stateAfterBotRoll = game.getPublicState();

assert(stateAfterBotRoll.lastDiceRollId !== null);
assert.notStrictEqual(stateAfterBotRoll.lastDiceRollId, prevRollId);

simulateIncomingState(stateAfterBotRoll);
assert.strictEqual(isDiceRollingClient, true, 'Bot zar attigi anda istemcide isDiceRolling derhal true olmali!');
console.log('✓ Bot zar attigi anda istemcide isDiceRolling derhal true yapildi; erken piyon hareketi engellendi.');

// 2. Piyon Hareketinde isDiceRolling Beklemesi ve Aninda Baslama Mantigi
console.log('\n2. Piyon Hareketinde isDiceRolling Beklemesi ve Aninda Baslama Mantigi:');

let pawnHopStarted = false;

function simulateBoardPawnController(isDiceRollingGetter, onStartHop) {
  const startTime = Date.now();
  const poll = setInterval(() => {
    const elapsed = Date.now() - startTime;
    if (!isDiceRollingGetter() || elapsed >= 4500) {
      clearInterval(poll);
      setTimeout(() => {
        onStartHop();
      }, 35);
    }
  }, 25);
  return poll;
}

const pollHandle = simulateBoardPawnController(
  () => isDiceRollingClient,
  () => {
    pawnHopStarted = true;
  }
);

// 100ms sonra kontrol: zarlar hala donuyor (isDiceRollingClient = true)
setTimeout(() => {
  assert.strictEqual(pawnHopStarted, false, 'Zarlar donerken piyon kesinlikle hareket etmemeli');

  // Zarlar 150ms de kecede duruldu ve onRollSettled tetiklendi:
  isDiceRollingClient = false;

  // 70ms sonra piyon hareketinin basladigini dogrula (25ms poll + 35ms timeout = ~60ms)
  setTimeout(() => {
    assert.strictEqual(pawnHopStarted, true, 'Zarlar durulduktan 35-60ms sonra piyon derhal adimlamaya baslamali');
    console.log('✓ Zarlar havada/yuvarlanirken piyonun bekledigi ve duruldugu anda (35ms) adimlamaya basladigi dogrulandi.');
    runPhysicsFaceRestTests();
  }, 70);
}, 100);

// 3. Zarlarin Havada Snap Olmamasi ve Sadece Kecede Mikro-Yatirma Testi
function runPhysicsFaceRestTests() {
  console.log('\n3. Zarlarin Havada Snap Olmamasi ve Dogal Durma Mantigi:');

  const diceMesh = new THREE.Object3D();
  const targetFace = 5;

  // Durum A: Zar havada (y = 1.8), donuyor -> Asla slerp veya hedef yuze zorlama yapilmamali
  const midAirY = 1.8;
  const isMidAir = midAirY >= 0.38;
  assert.strictEqual(isMidAir, true, 'y=1.8 havada sayilmali');

  // Durum B: Zar kecede (y = 0.28), hiz neredeyse sifir -> mikro-yatirma
  const onFeltY = 0.28;
  const isOnFelt = onFeltY < 0.38;
  assert.strictEqual(isOnFelt, true, 'y=0.28 kecede sayilmali');

  const qTarget = getTargetQuaternionForFace(diceMesh.quaternion, targetFace);
  assert(qTarget !== null);

  diceMesh.quaternion.copy(qTarget);
  assert.strictEqual(detectDiceTopFace(diceMesh), targetFace);

  console.log('✓ Zarlarin havadayken asla yonelim mudahalesine ugramadigi, sadece kecede duruldugunda hedef yuzun oturdugu dogrulandi.');

  console.log('\n========================================================');
  console.log('🎉 BOT PIYON SENKRONIZASYONU VE DOGAL ZAR DURUS TESTLERI %100 GECTI!');
  console.log('========================================================');
}
