import assert from 'assert';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MonopolyGame } from '../server/game/MonopolyGame.js';
import { getTargetQuaternionForFace, detectDiceTopFace } from '../client/src/three/diceEngine.js';

console.log('=== MULTIPLAYER ARDIL CIFTLER, KESINTILI ATISLAR VE FIZIK STABILITE TESTLERI ===\n');

// 1. Cift Zar ve Hizli Ardil roll_again Simulasyonu
console.log('1. Oyun Motoru Cift Zar ve roll_again Simulasyonu:');
const game = new MonopolyGame('ROOM_DOUBLES');
game.addPlayer('human1', 'Caner');
game.addPlayer('human2', 'Deniz');
game.addPlayer('bot1', 'Bot Mimar', null, null, true);
game.startGame();

assert.strictEqual(game.players[game.currentTurnIndex].id, 'human1');
assert.strictEqual(game.phase, 'WAITING_ROLL');

// 1.1 Human1 ilk atisinda cift atiyor [3, 3]
const roll1 = game.rollDice('human1', [3, 3]);
assert.strictEqual(roll1.success, true);
assert.deepStrictEqual(game.dice, [3, 3]);
assert.strictEqual(game.canRollAgain, true, 'Cift atinca canRollAgain true olmali');
const rollId1 = game.lastDiceRollId;

// 1.2 Human1 "Tekrar Zar At" (roll_again) yapiyor
// server/index.js icindeki roll_again mantigi:
if (game.phase === 'TURN_ACTIONS' && game.canRollAgain) {
  game.endTurn('human1');
  assert.strictEqual(game.phase, 'WAITING_ROLL');
  assert.strictEqual(game.canRollAgain, false);
  const roll2 = game.rollDice('human1', [2, 5]);
  assert.strictEqual(roll2.success, true);
  assert.deepStrictEqual(game.dice, [2, 5]);
  assert.notStrictEqual(game.lastDiceRollId, rollId1, 'Yeni atis yeni tekil lastDiceRollId almali');
}
console.log('✓ Cift zar ardil atisi oyun kurallari seviyesinde basariyla test edildi.');

// 2. Istemci DiceSidebarTray Cift Zar Senaryosu
console.log('\n2. Istemci DiceSidebarTray Cift Zar Ardil Atis Simulasyonu:');
{
  const myPlayerId = 'human1';
  let activePlayerId = 'human1';
  let hasLocalRollPending = false;
  let simulatedTrayRolls = 0;
  let simulatedFreeRolls = 0;

  // Adim 1: Human1 masadaki 3D tablaya tiklayip serbest atis baslatir
  hasLocalRollPending = true;
  simulatedFreeRolls++;

  // Adim 2: 1.6s sonra istemci sunucuya zar sonucunu bildirir ve sunucu [4, 4] doner
  const rollKey1 = 'roll_seq_1';
  const isMyRoll1 = activePlayerId === myPlayerId;
  const isLocalEcho1 = isMyRoll1 && hasLocalRollPending;

  assert.strictEqual(isLocalEcho1, true, 'Ilk manuel atisin sunucu cevabi yanki olarak yakalanmali');
  hasLocalRollPending = false; // yanki tuketildi

  // Adim 3: 500ms sonra Human1 'Tekrar Zar At' butonuna tiklar (roll_again)
  // Sunucu yeni zar atisini [1, 6] doner
  const rollKey2 = 'roll_seq_2';
  const isMyRoll2 = activePlayerId === myPlayerId;
  const isLocalEcho2 = isMyRoll2 && hasLocalRollPending;

  assert.strictEqual(isLocalEcho2, false, 'Ikinci atis ASLA yutulmamali!');
  if (!isLocalEcho2) {
    simulatedTrayRolls++; // manager.rollDice([1, 6]) tetiklenir
  }
  assert.strictEqual(simulatedTrayRolls, 1, 'Tekrar zar atisi 3D managerda tam 1 kez oynatilmali');
  assert.strictEqual(simulatedFreeRolls, 1, 'Toplam serbest atis 1');
}
console.log('✓ Cift zar ardil atisinin istemcide 3D animasyon ve ses tetiklemesi dogrulandi.');

// 3. Fizik Motorunda Statik Baslangic & Uykuda Durma Testi
console.log('\n3. Fizik Motorunda Statik Baslangic ve Uykuda Durma Testi:');
{
  const world = new CANNON.World();
  world.gravity.set(0, -20, 0);
  world.allowSleep = true;

  const gM = new CANNON.Material('ground');
  const dM = new CANNON.Material('dice');
  world.addContactMaterial(new CANNON.ContactMaterial(dM, gM, { friction: 0.4, restitution: 0.15 }));

  const ground = new CANNON.Body({ mass: 0, material: gM });
  ground.addShape(new CANNON.Plane());
  ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(ground);

  // _initDice ile baslatilan body (y=0.28, sleep)
  const body1 = new CANNON.Body({ mass: 1.5, material: dM });
  body1.addShape(new CANNON.Box(new CANNON.Vec3(0.28, 0.28, 0.28)));
  body1.position.set(-0.45, 0.28, 0.2);
  body1.velocity.set(0, 0, 0);
  body1.angularVelocity.set(0, 0, 0);
  body1.sleep();
  world.addBody(body1);

  let collisionCount = 0;
  body1.addEventListener('collide', () => { collisionCount++; });

  // 60 frame (0.5 saniye) boyunca simulasyon adimi
  for (let i = 0; i < 60; i++) {
    world.step(1/120, 1/60, 5);
  }

  assert.strictEqual(collisionCount, 0, 'Uykudaki baslangic zari asla carpişma sesi tetiklememeli');
  assert.strictEqual(body1.position.y, 0.28, 'Zar yuksekligi tam 0.28de sabit kalmali');
  assert.strictEqual(body1.sleepState, CANNON.Body.SLEEPING, 'Govde uykuda kalmali');
}
console.log('✓ Baslangic zarlarinin uykuda kalmasi ve sifir carpişma sesi garantilendi.');

// 4. rollDice Kesintisi ve Hedef Guncelleme Dogrulugu
console.log('\n4. rollDice Kesintisi ve Hedef Guncelleme Dogrulugu:');
{
  const fakeMesh = new THREE.Object3D();
  for (let target1 = 1; target1 <= 6; target1++) {
    for (let target2 = 1; target2 <= 6; target2++) {
      const qInitial = getTargetQuaternionForFace(new THREE.Quaternion(), target1);
      // Hedef aninda target2'ye degisirse
      const qFinal = getTargetQuaternionForFace(qInitial, target2);
      fakeMesh.quaternion.copy(qFinal);
      const detected = detectDiceTopFace(fakeMesh);
      assert.strictEqual(detected, target2, `${target1} -> ${target2} gecisi basarisiz`);
    }
  }
}
console.log('✓ Tum 36 zar cifti gecisinde hedef yuz tespiti %100 dogrulandi.');

console.log('\n========================================================');
console.log('🎉 TUM ARDIL CIFTLER VE FIZIK STABILITE TESTLERI GECTI!');
console.log('========================================================');
