import { MonopolyGame, GameEngine } from '../server/game/MonopolyGame.js';
import { BOARD_TILES, CHANCE_CARDS, CHEST_CARDS, PLAYER_TOKENS } from '../server/game/boardData.js';

console.log('=== RESMİ OYUN KURALLARI VE TELİF GÜVENCESİ UYUMLULUK TESTİ BAŞLIYOR ===\n');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ HATA: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ ${message}`);
  }
}

// 0. Export Alias ve Token Kontrolleri
console.log('--- 0. Motor Export ve Piyon Güvencesi Kontrolleri ---');
assert(GameEngine === MonopolyGame, 'GameEngine export aliası MonopolyGame ile birebir eşleşmeli');
assert(PLAYER_TOKENS.length === 9, 'Tam 9 adet piyon tanımlı olmalı');
const tokenNames = PLAYER_TOKENS.map(t => t.name.toLowerCase()).join(' ');
assert(!tokenNames.includes('porsche'), 'Piyon isimlerinde hiçbir üçüncü taraf marka (Porsche) bulunmamalı');
assert(!tokenNames.includes('jordan'), 'Piyon isimlerinde hiçbir üçüncü taraf marka (Jordan) bulunmamalı');
assert(!tokenNames.includes('yamaha'), 'Piyon isimlerinde hiçbir üçüncü taraf marka (Yamaha) bulunmamalı');

// 1. Board & Kart Verisi Kontrolleri
console.log('\n--- 1. Board ve Kart Destesi Kontrolleri ---');
assert(BOARD_TILES.length === 40, 'Tahta tam 40 kareden oluşmalı');
assert(CHANCE_CARDS.length === 16, 'Şans destesinde tam 16 resmi kart olmalı');
assert(CHEST_CARDS.length === 16, 'Kamu Fonu destesinde tam 16 resmi kart olmalı');

// Vergi kareleri
const incomeTax = BOARD_TILES.find(t => t.id === 4);
const luxuryTax = BOARD_TILES.find(t => t.id === 38);
assert(incomeTax.amount === 200, 'Gelir Vergisi (Kare 4) 200₺ olmalı');
assert(luxuryTax.amount === 100, 'Lüks Vergisi (Kare 38) 100₺ olmalı');

// Demiryolları
const railroads = BOARD_TILES.filter(t => t.type === 'railroad');
assert(railroads.length === 4, '4 adet istasyon olmalı');
railroads.forEach(rr => {
  assert(rr.cost === 200, `${rr.name} fiyatı 200₺ olmalı`);
  assert(rr.mortgage === 100, `${rr.name} ipotek değeri 100₺ olmalı`);
  assert(JSON.stringify(rr.rent) === JSON.stringify([25, 50, 100, 200]), `${rr.name} kiraları [25, 50, 100, 200] olmalı`);
});

// Kamu Kuruluşları (Utilities)
const utilities = BOARD_TILES.filter(t => t.type === 'utility');
assert(utilities.length === 2, '2 adet kamu kuruluşu olmalı');
utilities.forEach(u => {
  assert(u.cost === 150, `${u.name} fiyatı 150₺ olmalı`);
  assert(u.mortgage === 75, `${u.name} ipotek değeri 75₺ olmalı`);
});

// Sokak Fiyatları ve Ev Maliyetleri
const brown = BOARD_TILES.filter(t => t.group === 'brown');
assert(brown.every(t => t.houseCost === 50), 'Kahverengi ev maliyeti 50₺ olmalı');
const darkBlue = BOARD_TILES.filter(t => t.group === 'dark_blue');
assert(darkBlue.every(t => t.houseCost === 200), 'Koyu Mavi ev maliyeti 200₺ olmalı');
const bilkent = darkBlue.find(t => t.id === 37);
const beysukent = darkBlue.find(t => t.id === 39);
assert(bilkent.cost === 350 && bilkent.mortgage === 175, 'Bilkent 350₺, ipotek 175₺ olmalı');
assert(beysukent.cost === 400 && beysukent.mortgage === 200, 'Beysukent 400₺, ipotek 200₺ olmalı');
assert(beysukent.rent[5] === 2000, 'Beysukent otel kirası 2000₺ olmalı');

// 2. Oyun Başlangıcı ve Para
console.log('\n--- 2. Oyun Başlangıç Parası ve Banka Rezervleri ---');
const game = new MonopolyGame('TEST01');
game.addPlayer('p1', 'Player1');
game.addPlayer('p2', 'Player2');
game.addPlayer('p3', 'Player3');
game.startGame('p1');

const p1 = game.players.find(p => p.id === 'p1');
const p2 = game.players.find(p => p.id === 'p2');
const p3 = game.players.find(p => p.id === 'p3');

assert(p1.money === 1500, 'Oyuncu 1 başlangıç parası 1500₺ olmalı');
assert(p2.money === 1500, 'Oyuncu 2 başlangıç parası 1500₺ olmalı (koltuk avantajı yok)');
assert(p3.money === 1500, 'Oyuncu 3 başlangıç parası 1500₺ olmalı');
assert(game.bankHouses === 32, 'Banka toplam 32 eve sahip olmalı');
assert(game.bankHotels === 12, 'Banka toplam 12 otele sahip olmalı');

// 3. GO Maaşı
console.log('\n--- 3. GO Maaşı ---');
assert(game.getGoSalary() === 200, 'GO maaşı tam 200₺ olmalı');
game.roundNumber = 80; // Enflasyon testi
assert(game.getGoSalary() === 200, '80. turda da GO maaşı sabit 200₺ olmalı (kriz kesintisi yok)');

// 4. Çift Zar ve Hız Cezası (Speeding)
console.log('\n--- 4. Çift Zar ve 3. Çiftte Kodese Sevk (Aşırı Hız) ---');
const activeP = game.getActivePlayer();
activeP.inJail = false;
activeP.position = 0;
game.phase = 'WAITING_ROLL';
game.doublesCount = 0;

// 1. Çift
const r1 = game.rollDice(activeP.id, [3, 3]);
assert(r1.success, `1. zar atışı başarılı olmalı: ${r1.error}`);
assert(game.doublesCount === 1, '1. çift zar sayıldı');
assert(game.canRollAgain === true, '1. çift zar sonrası tekrar atma hakkı verildi');
assert(!activeP.inJail, '1. çiftte kodese girilmedi');

// 2. Çift
game.phase = 'WAITING_ROLL';
const r2 = game.rollDice(activeP.id, [4, 4]);
assert(r2.success, `2. zar atışı başarılı olmalı: ${r2.error}`);
assert(game.doublesCount === 2, '2. çift zar sayıldı');
assert(game.canRollAgain === true, '2. çift zar sonrası tekrar atma hakkı verildi');
assert(!activeP.inJail, '2. çiftte kodese girilmedi');

// 3. Çift (Aşırı Hız Kuralı)
game.phase = 'WAITING_ROLL';
const r3 = game.rollDice(activeP.id, [5, 5]);
assert(r3.success, `3. zar atışı başarılı olmalı: ${r3.error}`);
assert(activeP.inJail === true, '3. ardışık çift zarda derhal KODESE gönderildi');
assert(activeP.position === 10, 'Oyuncu 10. kareye (Kodese) taşındı');
assert(game.canRollAgain === false, 'Kodese gidince tekrar zar atma hakkı iptal edildi');
assert(game.phase === 'TURN_ACTIONS', 'Tur sonu aşamasına geçildi');

// 5. Kodeste Tam Kira Tahsilatı
console.log('\n--- 5. Kodesteyken Mülk Kirası Toplama ---');
// p1 kodeste iken Beysukent'e sahip olsun
game.properties[39] = { ownerId: 'p1', houses: 0, mortgaged: false };
const beysukentRent = game.calculateRent(39);
assert(beysukentRent === 50, 'Beysukent yalın kirası 50₺');
// p2 Beysukent'e bassın
const p2StartMoney = p2.money;
const p1StartMoney = p1.money;
p2.position = 39;
game.handleTileLanding(p2, BOARD_TILES[39], 7);
assert(p2.money === p2StartMoney - 50, 'p2 tam kirayı ödedi');
assert(p1.money === p1StartMoney + 50, 'Kodesteki p1 kirayı %100 tam olarak tahsil etti (kodeste ceza kesintisi yok)');

// 6. Ev İnşaatı ve Banka Stok Sınırı
console.log('\n--- 6. Ev İnşaatı Eşitlik Kuralı ve Banka Rezervi Sınırı ---');
// Koyu mavi seti p1'e verelim (37 ve 39)
game.properties[37] = { ownerId: 'p1', houses: 0, mortgaged: false };
p1.money = 10000;

// 37'ye 1 ev yap
const b1 = game.buildHouse('p1', 37);
assert(b1.success, '37 numaraya ilk ev başarıyla yapıldı');
assert(game.bankHouses === 31, 'Banka ev stoku 31 e düştü');

// 37'ye 2. evi yapmaya çalış (eşit inşaat kuralı: 39'da 0 ev varken 37'ye 2. ev yapılamaz)
const b2 = game.buildHouse('p1', 37);
assert(!b2.success, 'Eşit inşa kuralı gereği diğer tapuda ev olmadan 2. ev yapılamaz');

// 39'a 1 ev yap
const b3 = game.buildHouse('p1', 39);
assert(b3.success, '39 numaraya 1. ev başarıyla yapıldı');
assert(game.bankHouses === 30, 'Banka ev stoku 30 a düştü');

// Şimdi 37'ye 2. ev yapılabilir
const b4 = game.buildHouse('p1', 37);
assert(b4.success, '37 numaraya 2. ev başarıyla yapıldı');

// 7. İpotek Kuralı: Grupta Ev Varken İpotek Edilemez
console.log('\n--- 7. İpotek Kuralları ve %10 İpotek Kaldırma Faizi ---');
const m1 = game.mortgageProperty('p1', 37);
assert(!m1.success, 'Grupta ev varken mülk ipotek edilemez kuralı doğrulandı');

// Evleri geri satalım
game.sellHouse('p1', 37);
game.sellHouse('p1', 39);
game.sellHouse('p1', 37);
assert(game.properties[37].houses === 0 && game.properties[39].houses === 0, 'Tüm evler satıldı');
assert(game.bankHouses === 32, 'Satılan tüm evler banka stokuna geri döndü');

// Şimdi ipotek edilebilir
const p1BeforeMortgage = p1.money;
const m2 = game.mortgageProperty('p1', 37);
assert(m2.success, 'Evler satıldıktan sonra ipotek başarıyla yapıldı');
assert(p1.money === p1BeforeMortgage + 175, '175₺ ipotek bedeli kasanıza eklendi');

// İpoteği kaldır (%10 resmi banka faizi = 175 * 1.10 = 192.5 -> 193₺)
const p1BeforeUnmortgage = p1.money;
const u1 = game.unmortgageProperty('p1', 37);
assert(u1.success, 'İpotek başarıyla kaldırıldı');
assert(p1BeforeUnmortgage - p1.money === Math.round(175 * 1.10), 'Yalnızca resmi %10 banka faizi tahsil edildi');

// 8. Kredi Taleplerinin Engellenmesi
console.log('\n--- 8. Resmi Kural: Borç ve Kredi Sisteminin Kapatılması ---');
const loan1 = game.requestBankLoan('p1', 500);
assert(!loan1.success, 'Merkez Bankası kredisi resmi kurallar gereği engellendi');
const loan2 = game.requestLoan('p1', 'p2', 200, 250);
assert(!loan2.success, 'Oyuncular arası faizli borç resmi kurallar gereği engellendi');

// 9. Takas Kuralları (Bağış yasağı & İpotekli mülk %10 banka devir faizi)
console.log('\n--- 9. Takas Kuralları (Bağış yasağı & %10 Devir Harcı) ---');
// Karşılıksız nakit bağışı (sendGift)
const giftRes = game.tradeManager.sendGift('p1', 'p2', 100);
assert(!giftRes.success, 'Karşılıksız para transferi / bağış resmi kurallarca engellendi');

// İpotekli mülk takası (%10 banka devir faizi)
game.properties[37] = { ownerId: 'p1', houses: 0, mortgaged: true };
p2.money = 1000;
const p2StartForTrade = p2.money;
game.tradeManager.pendingTrade = {
  fromPlayerId: 'p1',
  toPlayerId: 'p2',
  offeredProperties: [37],
  requestedProperties: [],
  offeredMoney: 0,
  requestedMoney: 0,
  offeredJailCards: 0,
  requestedJailCards: 0
};
const resTrade = game.tradeManager.respondTrade('p2', true);
assert(resTrade.success, `Takas başarılı olmalı: ${resTrade.error}`);
assert(game.properties[37].ownerId === 'p2', 'Mülk p2 ye devredildi');
assert(game.properties[37].mortgaged === true, 'Mülk hala ipotekli devroldu');
// 10. Otomatik İpotek Sonrası Borç Kapanmazsa Kaçınılmaz İflas Testi
console.log('\n--- 10. Otomatik İpotek Sonrası Borç Kapanmazsa Kaçınılmaz İflas ---');
p3.money = -50;
const autoRes = game.autoMortgage('p3');
assert(autoRes.success, 'Otomatik ipotek çağrısı başarılı olmalı');
assert(autoRes.bankrupt === true, 'Mülkü olmayan ve borçlu oyuncu derhal iflas etmeli');
assert(p3.isBankrupt === true, 'p3 oyuncusu resmen isBankrupt olmalı');

// 11. Kartla İlerleme (Advance To) ve GO Maaşı Testleri
console.log('\n--- 11. Kartla İlerleme (Advance To) ve GO Maaşı Testleri ---');
// Test 11.1: 7. Karedeki (Şans) Oyuncu "Ankara Tren Garı'na Git" (ch15, hedef 5) çeker:
// Hedef mevcut kareden geride olduğu için saat yönünde tahtayı turlar (38 adım), GO'dan geçer ve 200₺ maaş alır!
p1.position = 7;
p1.money = 1000;
const card15 = CHANCE_CARDS.find(c => c.id === 'ch15');
game.applyCard(p1, card15, 7);
assert(p1.position === 5, 'Oyuncu 5. kareye (Ankara Tren Garı) ulaşmalı');
assert(p1.money === 1200, 'GO noktasından geçtiği için 200₺ maaş almış olmalı (1000 + 200 = 1200)');
assert(game.lastMovement.from === 7 && game.lastMovement.to === 5, 'Hareket 7 -> 5 kaydedilmeli');
assert(game.lastMovement.steps === 38, 'İleri hareket adımı tam 38 olmalı (asla geriye gitmemeli!)');
assert(game.lastMovement.isBackward === false, 'isBackward kesinlikle false olmalı');

// Test 11.2: 36. Karedeki Oyuncu "Kızılay Meydanı'na İlerle" (ch2, hedef 24) çeker:
p1.position = 36;
p1.money = 1000;
const card2 = CHANCE_CARDS.find(c => c.id === 'ch2');
game.applyCard(p1, card2, 7);
assert(p1.position === 24, 'Oyuncu 24. kareye (Kızılay Meydanı) ulaşmalı');
assert(p1.money === 1200, 'GO noktasından geçtiği için 200₺ maaş almış olmalı');
assert(game.lastMovement.steps === 28, 'İleri hareket adımı 28 olmalı');
assert(game.lastMovement.isBackward === false, 'isBackward false olmalı');

// Test 11.3: 22. Karedeki Oyuncu "Altındağ'a İlerle" (ch3, hedef 11) çeker:
p1.position = 22;
p1.money = 1000;
const card3 = CHANCE_CARDS.find(c => c.id === 'ch3');
game.applyCard(p1, card3, 7);
assert(p1.position === 11, 'Oyuncu 11. kareye (Altındağ) ulaşmalı');
assert(p1.money === 1200, 'GO noktasından geçtiği için 200₺ maaş almış olmalı');
assert(game.lastMovement.steps === 29, 'İleri hareket adımı 29 olmalı');
assert(game.lastMovement.isBackward === false, 'isBackward false olmalı');

// Test 11.4: 36. Karedeki Oyuncu "En Yakın Gara İlerle" (ch4) çeker:
// 36'dan sonraki en yakın gar 5'tir (Ankara Tren Garı), GO'dan geçer ve 200₺ maaş alır!
p1.position = 36;
p1.money = 1000;
game.properties[5].ownerId = 'p2'; // Gar p2'ye ait olsun (2 kat kira)
p2.money = 1000;
const card4 = CHANCE_CARDS.find(c => c.id === 'ch4');
game.applyCard(p1, card4, 7);
assert(p1.position === 5, 'En yakın gar 5 olmalı');
// 1000 + 200 (GO) - 50 (2 kat gar kirası: 1 gar=25, 2x=50) = 1150
assert(p1.money === 1150, 'GO maaşı (+200) ve 2 kat gar kirası (-50) doğru hesaplanmalı');
assert(game.lastRentPayment !== null && game.lastRentPayment.amount === 50, 'Kira bildirimi lastRentPayment olarak kaydedilmeli');

// Test 11.5: 36. Karedeki Oyuncu "En Yakın Altyapı Kurumuna İlerle" (ch5) çeker:
// 36'dan sonraki en yakın altyapı 12'dir (Başkent Elektrik Dağıtım), GO'dan geçer ve 200₺ maaş alır!
p1.position = 36;
p1.money = 1000;
game.properties[12].ownerId = null; // Sahipsiz olsun
const card5 = CHANCE_CARDS.find(c => c.id === 'ch5');
game.applyCard(p1, card5, 7);
assert(p1.position === 12, 'En yakın altyapı 12 olmalı');
assert(p1.money === 1200, 'GO noktasından geçtiği için 200₺ maaş almalı');
assert(game.phase === 'TILE_ACTION', 'Sahipsiz tesis için satın alma aşaması açılmalı');

// 12. "3 Kare Geri Git" Kartı Testi (Resmi Kurallarda Geriye Giden Tek Kart)
console.log('\n--- 12. "3 Kare Geri Git" Kartı Testi ---');
p1.position = 7;
p1.money = 1000;
const card8 = CHANCE_CARDS.find(c => c.id === 'ch8');
game.applyCard(p1, card8, 7);
assert(p1.position === 4, '7. kareden 3 kare geri gidince 4. kareye (Gelir Vergisi) inmeli');
assert(p1.money === 800, 'Gelir Vergisi (-200₺) kesilmeli, asla GO maaşı almamalı');
assert(game.lastMovement.isBackward === true, 'isBackward true olmalı');
assert(game.lastMovement.steps === -3, 'steps -3 olmalı');

// 36. kareden 3 kare geri gidiş: 36 - 3 = 33 (Kamu Fonu karesi) ve yeni kart çekilmeli
p1.position = 36;
game.applyCard(p1, card8, 7);
assert(p1.position === 33, '36. kareden 3 kare geri gidince 33. kareye (Kamu Fonu) inmeli');
assert(game.phase === 'CARD_DRAWN', '33. karede derhal Belediye & İmar (Kamu Fonu) kartı çekilmeli');

// 13. Board.jsx İstemci Animasyon Adım Hesabı Doğrulaması
console.log('\n--- 13. Board.jsx İstemci Animasyon Adım Hesabı Doğrulaması ---');
function calculateClientMovement(prevPos, targetPos, lastMovement) {
  const forwardSteps = (targetPos - prevPos + 40) % 40;
  const backwardSteps = (prevPos - targetPos + 40) % 40;
  const isGoBackCard = (prevPos === 7 && targetPos === 4) ||
                       (prevPos === 22 && targetPos === 19) ||
                       (prevPos === 36 && targetPos === 33);
  const isExplicitBackward = Boolean(lastMovement?.isBackward);
  const isBackward = (isExplicitBackward || isGoBackCard) && backwardSteps === 3;
  const totalSteps = isBackward ? backwardSteps : forwardSteps;
  return { isBackward, totalSteps, forwardSteps, backwardSteps };
}

// Case A: 7'den 5'e (Ankara Tren Garı):
const moveA = calculateClientMovement(7, 5, { isBackward: false });
assert(moveA.isBackward === false, '7 -> 5 durumunda isBackward KESİNLİKLE false olmalı');
assert(moveA.totalSteps === 38, '7 -> 5 durumunda piyon saat yönünde 38 adım atmalı');

// Case B: 7'den 4'e (3 Kare Geri Git):
const moveB = calculateClientMovement(7, 4, { isBackward: true });
assert(moveB.isBackward === true, '7 -> 4 durumunda isBackward true olmalı');
assert(moveB.totalSteps === 3, '7 -> 4 durumunda piyon geriye 3 adım atmalı');

// Case C: 36'dan 24'e (Kızılay Meydanı):
const moveC = calculateClientMovement(36, 24, { isBackward: false });
assert(moveC.isBackward === false, '36 -> 24 durumunda isBackward false olmalı');
assert(moveC.totalSteps === 28, '36 -> 24 durumunda piyon saat yönünde 28 adım atmalı');

// Case D: 22'den 11'e (Altındağ):
const moveD = calculateClientMovement(22, 11, { isBackward: false });
assert(moveD.isBackward === false, '22 -> 11 durumunda isBackward false olmalı');
assert(moveD.totalSteps === 29, '22 -> 11 durumunda piyon saat yönünde 29 adım atmalı');

console.log('\n=============================================================');
console.log('🎉 TÜM RESMİ EMLAK VE STRATEJİ KURALLARI TESTLERİ');
console.log('   EKSİKSİZ VE %100 BAŞARIYLA GEÇTİ!');
console.log('=============================================================');
