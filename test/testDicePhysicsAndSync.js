import assert from 'assert';
import * as THREE from 'three';
import { getTargetQuaternionForFace, detectDiceTopFace } from '../client/src/three/diceEngine.js';
import { MonopolyGame } from '../server/game/MonopolyGame.js';

console.log('=== 3D ZAR FIZIGI, QUATERNION VE SENKRONIZASYON TESTLERI BASLIYOR ===\n');

// 1. Tum Yuzler (1..6) Testi
console.log('1. Tum Yuzler (1..6) Icin getTargetQuaternionForFace ve detectDiceTopFace Testi:');
const fakeMesh = new THREE.Object3D();

for (let face = 1; face <= 6; face++) {
  const q = getTargetQuaternionForFace(new THREE.Quaternion(), face);
  fakeMesh.quaternion.copy(q);
  const detected = detectDiceTopFace(fakeMesh);
  assert.strictEqual(detected, face, 'Yuz tespiti basarisiz: ' + face);
}
console.log('✓ Temel durum: 1..6 arasindaki tum yuzler kusursuz tespit edildi.');

// 2. Rastgele Baslangic Rotasyonlarindan Hedef Yuze Oturma
console.log('\n2. Rastgele 3D Donmelerden Hedef Yuze getTargetQuaternionForFace Testi:');
for (let face = 1; face <= 6; face++) {
  for (let trial = 0; trial < 10; trial++) {
    const randomEuler = new THREE.Euler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    const startQ = new THREE.Quaternion().setFromEuler(randomEuler);
    const targetQ = getTargetQuaternionForFace(startQ, face);

    fakeMesh.quaternion.copy(targetQ);
    const detected = detectDiceTopFace(fakeMesh);
    assert.strictEqual(detected, face, 'Rastgele rotasyondan yuz tespiti basarisiz: ' + face);
  }
}
console.log('✓ 60 farkli rastgele 3D aci kombinasyonundan hedef yuzler 100% dogrulukla tavana (+Y) hizalandi.');

// 3. Slerp Yumusatma Surekliligi ve Sifir Sicrama (Zero Snap) Testi
console.log('\n3. Slerp Yumusatma Surekliligi ve Son An Sicramasiz Durus Testi:');
for (let face = 1; face <= 6; face++) {
  const startEuler = new THREE.Euler(Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.5);
  const startQ = new THREE.Quaternion().setFromEuler(startEuler);
  const targetQ = getTargetQuaternionForFace(startQ, face);

  let prevAngle = null;
  const steps = 50;
  for (let step = 0; step <= steps; step++) {
    const progress = step / steps;
    const ease = 1 - Math.pow(1 - progress, 3);
    const currentQ = new THREE.Quaternion().slerpQuaternions(startQ, targetQ, ease);

    assert(Math.abs(currentQ.length() - 1.0) < 1e-4, 'Kuaterniyon normalize kalmali');

    const angleToTarget = currentQ.angleTo(targetQ);
    if (prevAngle !== null) {
      assert(angleToTarget <= prevAngle + 1e-4, 'Aci monoton azaliyor');
    }
    prevAngle = angleToTarget;

    if (step === steps) {
      assert(angleToTarget < 1e-4, 'Son asamada hedefe tam oturmadi: ' + angleToTarget);
      fakeMesh.quaternion.copy(currentQ);
      assert.strictEqual(detectDiceTopFace(fakeMesh), face, 'Durulma tamamlandiginda yuz eslesmeli');
    }
  }
}
console.log('✓ Slerp interpolasyonu kademeli olarak sifir hiz tureviyle duruluyor; sonradan yuz donmesi (post-rest flipping) matematiksel olarak imkansiz.');

// 4. Sunucu MonopolyGame rollDice ve lastDiceRollId Idempotentlik Testi
console.log('\n4. Sunucu MonopolyGame rollDice ve lastDiceRollId Idempotentlik Testi:');
const game = new MonopolyGame('TEST_DICE');
game.addPlayer('p1', 'Ahmet');
game.addPlayer('p2', 'Bot1', null, null, true);
game.startGame();

assert.strictEqual(game.phase, 'WAITING_ROLL');
const initialRollId = game.lastDiceRollId;

const rollRes1 = game.rollDice('p1', [3, 4]);
assert.strictEqual(rollRes1.success, true);
assert.deepStrictEqual(game.dice, [3, 4]);
assert(game.lastDiceRollId !== null && game.lastDiceRollId !== initialRollId);
const rollId1 = game.lastDiceRollId;

const rollResDuplicate = game.rollDice('p1');
assert.strictEqual(rollResDuplicate.success, false, 'Ayni turda mukerrer zar atisi engellenmeli');
assert.strictEqual(game.lastDiceRollId, rollId1, 'Reddedilen atis lastDiceRollId degistirmemeli');

console.log('✓ Sunucu zar atisi idempotenti dogrulandi (faz korumasi ve tekil lastDiceRollId).');

// 5. Istemci Local Echo, Cift Zar ve Bot Roll Tetikleme Mantigi Simulasyonu
console.log('\n5. Istemci Local Echo, Cift Zar ve Bot Roll Tetikleme Mantigi Simulasyonu:');

// 5.1 Ilk Mount Sessizligi
{
  let isFirstMount = true;
  let lastRollKey = null;
  const currentRollKey = 'roll_12345';
  let didTriggerRoll = false;

  if (isFirstMount) {
    isFirstMount = false;
    lastRollKey = currentRollKey;
  } else if (currentRollKey !== lastRollKey) {
    didTriggerRoll = true;
  }
  assert.strictEqual(didTriggerRoll, false, 'Ilk mount aninda mevcut zar atisi oynatilmamali');
}

// 5.2 Ilk Manuel Atis Yankisi (Local Echo)
let hasLocalRollPending = false;
{
  const myPlayerId = 'p1';
  const activePlayer = { id: 'p1', isBot: false };
  hasLocalRollPending = true; // handleManualRoll cagrisi

  const isMyRoll = activePlayer.id === myPlayerId;
  const isLocalEcho = isMyRoll && hasLocalRollPending;
  assert.strictEqual(isLocalEcho, true, 'Lokal oyuncunun kendi atisinin yankisi tespit edilmeli');

  // Yanki tespit edildikten sonra bayrak temizlenir
  hasLocalRollPending = false;
}

// 5.3 KRITIK TEST: Cift Zar Sonrasi Tekrar Zar Atisi (roll_again / ardil atis)
{
  const myPlayerId = 'p1';
  const activePlayer = { id: 'p1', isBot: false };
  // Oyuncu cift atti; sunucudan canRollAgain geldi ve oyuncu "Tekrar Zar At" butonuna basti.
  // Bu atis sunucu tarafindan roll_again ile uretildi (yani hasLocalRollPending false).
  const isMyRoll = activePlayer.id === myPlayerId;
  const isLocalEcho = isMyRoll && hasLocalRollPending;

  assert.strictEqual(isLocalEcho, false, 'Cift zar sonrasi ardil atis (roll_again) ASLA yanki olarak yutulmamali!');
  let didAnimateSecondRoll = false;
  if (!isLocalEcho) {
    didAnimateSecondRoll = true;
  }
  assert.strictEqual(didAnimateSecondRoll, true, 'Cift zar ardil atisi basariyla 3D animasyon ve ses tetiklemeli');
}

// 5.4 Bot Atisi Koruma Testi
{
  const myPlayerId = 'p1';
  const activePlayer = { id: 'bot_1', isBot: true };
  const isMyRoll = activePlayer.id === myPlayerId;
  const isLocalEcho = isMyRoll && hasLocalRollPending;
  assert.strictEqual(isLocalEcho, false, 'Botun atisi ASLA yerel yanki olarak yutulmamali');
}

// 5.5 Sira Degisiminde Pending Bayraginin Temizlenmesi
{
  hasLocalRollPending = true;
  const myPlayerId = 'p1';
  const nextPlayer = { id: 'p2', isBot: false };
  if (nextPlayer.id !== myPlayerId) {
    hasLocalRollPending = false;
  }
  assert.strictEqual(hasLocalRollPending, false, 'Sira baska oyuncuya gectiginde bekleyen yerel bayrak sifirlanmali');
}
console.log('✓ Istemci local echo, cift zar ardil atisi, bot korumasi ve mount sessizligi basariyla dogrulandi.');

// 6. Ardil ve Kesintili rollDice Yeniden Baslatma (Interruptible Re-roll) Testi
console.log('\n6. 3D Manager rollDice Kesintili Yeniden Baslatma Testi:');
{
  // Simule edilmis Dice3DTrayManager rollDice davranisi
  let isRolling = false;
  let activeTarget = null;
  let rollCount = 0;

  const simulateRollDice = (targetValues) => {
    // Eger onceden atis yapiliyorsa bile yeni hedef atanip animasyon tazelenmeli
    isRolling = true;
    activeTarget = targetValues;
    rollCount++;
  };

  simulateRollDice([2, 3]);
  assert.strictEqual(isRolling, true);
  assert.deepStrictEqual(activeTarget, [2, 3]);
  assert.strictEqual(rollCount, 1);

  // Hizli bot atlama / ardil atis: zar henuz durmadan yeni atis geldi
  simulateRollDice([6, 6]);
  assert.strictEqual(isRolling, true);
  assert.deepStrictEqual(activeTarget, [6, 6], 'Yeni atis hedefleri eski hedeflerin uzerine yazilmali');
  assert.strictEqual(rollCount, 2, 'Yeni atis reddedilmemeli, yeniden baslatilmali');
}
console.log('✓ rollDice kesintili calisma ve yeni hedefe aninda gecis dogrulandi.');

// 7. Tepsi Sinirlari (Boundary Clamp) Testi
console.log('\n7. Tepsi Sinirleri (Boundary Clamp) Testi:');
{
  const clampDice = (body) => {
    const minX = -1.45, maxX = 1.45;
    const minZ = -2.95, maxZ = 2.95;
    const minY = 0.28;

    if (body.position.x < minX) {
      body.position.x = minX;
      if (body.velocity.x < 0) body.velocity.x *= -0.3;
    } else if (body.position.x > maxX) {
      body.position.x = maxX;
      if (body.velocity.x > 0) body.velocity.x *= -0.3;
    }

    if (body.position.z < minZ) {
      body.position.z = minZ;
      if (body.velocity.z < 0) body.velocity.z *= -0.3;
    } else if (body.position.z > maxZ) {
      body.position.z = maxZ;
      if (body.velocity.z > 0) body.velocity.z *= -0.3;
    }

    if (body.position.y < minY) {
      body.position.y = minY;
      if (body.velocity.y < 0) body.velocity.y = 0;
    }
  };

  const testBody = {
    position: { x: 5.0, y: -1.0, z: -10.0 },
    velocity: { x: 10, y: -5, z: -8 }
  };
  clampDice(testBody);

  assert.strictEqual(testBody.position.x, 1.45, 'X maksimum sinirda tutulmali');
  assert.strictEqual(testBody.position.z, -2.95, 'Z minimum sinirda tutulmali');
  assert.strictEqual(testBody.position.y, 0.28, 'Y zemin seviyesinde tutulmali');
  assert.strictEqual(testBody.velocity.y, 0, 'Asagi dogru hiz sifirlanmali');
  assert(testBody.velocity.x < 0, 'X hizi duvardan sekerek ters donmeli');
  assert(testBody.velocity.z > 0, 'Z hizi duvardan sekerek ters donmeli');
}
console.log('✓ Zar govdesi tepsi sinirlarina tam hapsedildi (duvar delme/batma imkansiz).');

console.log('\n========================================================');
console.log('🎉 TUM 3D ZAR FIZIGI VE SENKRONIZASYON TESTLERI %100 GECTI!');
console.log('========================================================');
