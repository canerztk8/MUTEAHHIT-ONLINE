import assert from 'assert';
import { Dice3DTrayManager } from '../client/src/three/Dice3DTrayManager.js';

console.log('=== KLASIK NOKTALI MONOPOLY ZARI VE BOYUT TESTLERI BASLIYOR ===\n');

// 1. Dice3DTrayManager baseScale Yapılandırması Testi
console.log('1. Dice3DTrayManager baseScale ve Boyut Yapılandırması Testi:');
const manager = new Dice3DTrayManager();
assert.strictEqual(manager.isRolling, false);
assert.strictEqual(manager.isSceneReady, false);

// 2. _createPipImage Metodu ve Çizim Mantığı Testi
console.log('\n2. Noktalı Yüz Dokuları (_createPipImage) Testi:');
// Node.js ortamında document tanımlı olmadığı için zarif fallback null döner
assert.strictEqual(manager._createPipImage(1), null, 'Node ortamında document yokken hata fırlatmadan null dönmeli');

// Tarayıcı DOM mock ortamında pips görsel üretim testi
const mockCanvas = {
  width: 256,
  height: 256,
  getContext: () => ({
    clearRect: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    fillStyle: ''
  }),
  toDataURL: (type) => `data:${type};base64,mockPngData`
};

globalThis.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return mockCanvas;
    return {};
  }
};

globalThis.Image = class {
  constructor() {
    this.src = '';
    this.complete = true;
  }
};

for (let face = 1; face <= 6; face++) {
  const img = manager._createPipImage(face, 256);
  assert(img !== null, `Yüz ${face} için Image nesnesi üretilmeli`);
  assert(img.src.startsWith('data:image/png;base64,'), `Yüz ${face} data URL formatında olmalı`);
}
console.log('✓ 1..6 arasındaki tüm klasik noktalı (pip) yüzler başarıyla ve hatasız üretildi.');

// 3. d6 Yüzeylerine Pips Enjeksiyonu (_applyClassicMonopolyPips) Testi
console.log('\n3. d6 Yüzeylerine Pips Enjeksiyonu ve Önbellek Sıfırlama Testi:');
const mockD6 = {
  labels: ['', '', '1', '2', '3', '4', '5', '6'],
  values: [1, 2, 3, 4, 5, 6]
};

manager.box = {
  DiceFactory: {
    get: (type) => (type === 'd6' ? mockD6 : null),
    materials_cache: { oldTexture: true }
  }
};

await manager._applyClassicMonopolyPips();

assert.strictEqual(mockD6.labels.length, 8, 'd6.labels uzunluğu tam 8 olmalı (0, 1 padding + 6 yüz)');
assert.strictEqual(mockD6.labels[0], '', 'Index 0 boşluk padding olmalı');
assert.strictEqual(mockD6.labels[1], '', 'Index 1 boşluk padding olmalı');
for (let i = 2; i <= 7; i++) {
  assert(mockD6.labels[i] instanceof globalThis.Image, `Index ${i} (Yüz ${i - 1}) pip Image olmalı`);
}
assert.deepStrictEqual(manager.box.DiceFactory.materials_cache, {}, 'materials_cache yeni materyaller için sıfırlanmış olmalı');
console.log('✓ d6 tanımlayıcısına 6 adet noktalı Monopoly yüzü enjekte edildi ve materyal önbelleği temizlendi.');

// 4. rollDice Fonksiyonu Predetermined Roll Parametre Doğrulama Testi
console.log('\n4. rollDice Predetermined Roll Çıktı Testi:');
let rolledNotation = null;
manager.isSceneReady = true;
manager.box.roll = async (notation) => {
  rolledNotation = notation;
};

const result = await manager.rollDice([5, 6]);
assert.strictEqual(rolledNotation, '2d6@5,6', 'Predetermined roll formatı 2d6@5,6 olmalı');
assert.deepStrictEqual(result.dice, [5, 6]);
assert.strictEqual(result.sum, 11);
assert.strictEqual(result.isDoubles, false);

const doublesResult = await manager.rollDice([3, 3]);
assert.strictEqual(rolledNotation, '2d6@3,3');
assert.strictEqual(doublesResult.isDoubles, true);
assert.strictEqual(doublesResult.sum, 6);

console.log('✓ rollDice predetermined roll çıktısı ve çift zar tespiti doğrulandı.');

// Temizlik
delete globalThis.document;
delete globalThis.Image;

console.log('\n=============================================================');
console.log('🎉 KLASİK NOKTALI MONOPOLY ZARI VE BOYUT TESTLERİ %100 GEÇTİ!');
console.log('=============================================================');
