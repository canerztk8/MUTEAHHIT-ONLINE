import assert from "assert";
import { MonopolyGame } from "../server/game/MonopolyGame.js";
import { BOARD_TILES } from "../server/game/boardData.js";

console.log("=== RESMİ OYUN KURALLARI VE DENGE TESTİ ===");

const game = new MonopolyGame("TEST01");
const p1 = { id: "p1", name: "Caner", money: 1500, position: 0, lapsCompleted: 0, inJail: false, jailTurns: 0, jailCards: 0, isBankrupt: false, color: "#f59e0b" };
const p2 = { id: "p2", name: "Rakip", money: 1500, position: 0, lapsCompleted: 0, inJail: false, jailTurns: 0, jailCards: 0, isBankrupt: false, color: "#3b82f6" };
game.players = [p1, p2];
game.status = "playing";

// 1. Test: Demiryolu / Gar Maliyeti ve Kirası (Resmi Kural: 200₺ alış, 100₺ ipotek, kiralar: 25, 50, 100, 200)
const rrTile = BOARD_TILES[5];
assert.strictEqual(rrTile.cost, 200, "Gar satın alma maliyeti 200₺ olmalı");
assert.strictEqual(rrTile.mortgage, 100, "Gar ipotek bedeli 100₺ olmalı");
assert.strictEqual(rrTile.rent[3], 200, "4 Gar toplandığında taban kira 200₺ olmalı");
console.log("✓ 1. Gar Fiyatı (200₺) ve 4 Gar Kirası (200₺) Doğrulandı");

// 2. Test: Otel Kiraları (Resmi Kural: Ulus 250₺, İncek 2000₺)
const ulusTile = BOARD_TILES[1];
assert.strictEqual(ulusTile.rent[5], 250, "Ulus otel kirası resmi kural 250₺ olmalı");
const incekTile = BOARD_TILES[39];
assert.strictEqual(incekTile.rent[5], 2000, "İncek otel kirası resmi kural 2000₺ olmalı");
console.log("✓ 2. Resmi Otel Kiraları (Ulus 250₺, İncek 2000₺) Doğrulandı");

// 3. Test: İnşaat Maliyetleri (50, 100, 150, 200) ve Otele Geçişte Standart Maliyet
assert.strictEqual(BOARD_TILES[1].houseCost, 50, "Kahverengi ev maliyeti 50₺ olmalı");
assert.strictEqual(BOARD_TILES[6].houseCost, 50, "Açık mavi ev maliyeti 50₺ olmalı");
assert.strictEqual(BOARD_TILES[11].houseCost, 100, "Pembe ev maliyeti 100₺ olmalı");
assert.strictEqual(BOARD_TILES[16].houseCost, 100, "Turuncu ev maliyeti 100₺ olmalı");
assert.strictEqual(BOARD_TILES[21].houseCost, 150, "Kırmızı ev maliyeti 150₺ olmalı");
assert.strictEqual(BOARD_TILES[26].houseCost, 150, "Sarı ev maliyeti 150₺ olmalı");
assert.strictEqual(BOARD_TILES[31].houseCost, 200, "Yeşil ev maliyeti 200₺ olmalı");
assert.strictEqual(BOARD_TILES[37].houseCost, 200, "Koyu mavi ev maliyeti 200₺ olmalı");

game.properties[1].ownerId = p1.id;
game.properties[3].ownerId = p1.id;
game.properties[1].houses = 4;
game.properties[3].houses = 4;
const prevMoney = p1.money;
const buildRes = game.buildHouse(p1.id, 1);
assert.strictEqual(buildRes.success, true);
assert.strictEqual(buildRes.isHotel, true);
assert.strictEqual(buildRes.cost, 50, "Otele geçişte ev maliyeti 50₺ olmalı");
assert.strictEqual(p1.money, prevMoney - 50);
console.log("✓ 3. İnşaat Maliyetleri (50/100/150/200) ve Otel İnşası Doğrulandı");

// 4. Test: Sabit Kodes Çıkış Ücreti (50₺) ve 3. Tur Mecburi 50₺ Ödemesi
assert.strictEqual(game.getJailFine(), 50, "Resmi kodes çıkış ücreti her zaman 50₺ olmalıdır");
assert.strictEqual(game.getMandatoryJailFine(), 50, "3 tur mecburi çıkış cezası 50₺ olmalıdır");

// Kodes Çıkış (50₺)
p2.inJail = true;
p2.money = 1000;
game.currentTurnIndex = 1;
const payRes = game.payJailFine(p2.id);
assert.strictEqual(payRes.success, true);
assert.strictEqual(p2.money, 950, "50₺ uzlaşma cezası tahsil edilmeli (1000₺ - 50₺ = 950₺)");
assert.strictEqual(p2.inJail, false);

// 3. Tur sonu mecburi çıkışta 50₺ ödeme kuralı
p2.position = 10;
p2.inJail = true;
p2.jailTurns = 2;
p2.money = 1000;
game.phase = "WAITING_ROLL";
game.currentTurnIndex = 1;
const origRandom = Math.random;
let rCount = 0;
game.rollDice(p2.id, [1, 2]);
Math.random = origRandom;
assert.strictEqual(p2.inJail, false, "3. tur sonunda kodesten çıkmalı");
assert.strictEqual(p2.money, 950, "3. tur çift atamayan oyuncu 50₺ ödeyip ilerlemeli (1000₺ - 50₺ = 950₺)");
console.log("✓ 4. Kodes Çıkış (Sabit 50₺) ve 3. Tur Mecburi 50₺ Ödeme Kuralı Doğrulandı");

// 5. Test: Sabit GO Maaşı (200₺)
assert.strictEqual(game.getGoSalary(), 200, "Resmi GO maaşı 200₺ olmalı");
p1.money = 1000;
game.handlePassGo(p1, 1);
assert.strictEqual(p1.money, 1200, "GO geçişinde 200₺ maaş alınmalı");
console.log("✓ 5. GO Maaşı (200₺) Doğrulandı");

// 6. Test: İpotek ve İpotek Kaldırma (%10 Faiz)
const tile21 = BOARD_TILES[21];
game.properties[21].ownerId = p1.id;
game.properties[21].houses = 0;
game.properties[21].mortgaged = false;
const mortRes = game.mortgageProperty(p1.id, 21);
assert.strictEqual(mortRes.success, true);
assert.strictEqual(game.properties[21].mortgaged, true);
const unmortCost = Math.round(tile21.mortgage * 1.1);
const preUnmort = p1.money;
const unmortRes = game.unmortgageProperty(p1.id, 21);
assert.strictEqual(unmortRes.success, true);
assert.strictEqual(p1.money, preUnmort - unmortCost);
assert.strictEqual(game.properties[21].mortgaged, false);
console.log("✓ 6. İpotek ve İpotek Kaldırma (+%10 Faiz) Doğrulandı");

// 7. Test: Kodesteyken Tam Kira Toplama (%100)
assert.strictEqual(game.getJailRentRate(), 1.0, "Kodesteki oyuncu %100 kira toplamalıdır");
console.log("✓ 7. Kodeste Tam Kira Toplama Doğrulandı");

// 8. Test: Açık artırma olunca pas geçene para gitmemesi (Bankaya gitmesi)
p1.money = 1500;
p2.money = 1500;
game.properties[6].ownerId = null; // Kızılay
const startAucRes = game.startAuction(6, 'pass', p1);
assert.strictEqual(startAucRes.success, true);
assert.strictEqual(game.auction.sellerId, null, "Pas geçilen açık artırmada satıcı null olmalı (Banka)");
game.placeBid(p2.id, 100);
const prePassMoney = p1.money;
const endAucRes = game.endAuction();
assert.strictEqual(endAucRes.success, true);
assert.strictEqual(endAucRes.result?.winnerId, p2.id);
assert.strictEqual(game.properties[6].ownerId, p2.id);
assert.strictEqual(p2.money, 1400, "Kazanan 100₺ ödemeli");
assert.strictEqual(p1.money, prePassMoney, "Pas geçen oyuncunun parası ASLA artmamalı, para bankaya gitmeli");
console.log("✓ 8. Açık Artırma Pas Geçildiğinde Paranın Pas Geçene Gitmemesi Doğrulandı");

// 9. Test: Authoritative moneyHistory takibi
assert.ok(Array.isArray(p2.moneyHistory), "Oyuncunun moneyHistory dizisi bulunmalı");
assert.ok(p2.moneyHistory.length > 0, "p2 para harcadıkça moneyHistory kaydı oluşmalı");
const lastEntry = p2.moneyHistory[p2.moneyHistory.length - 1];
assert.strictEqual(lastEntry.delta, -100);
assert.strictEqual(lastEntry.balance, 1400);
assert.ok(/açık artırma/i.test(lastEntry.reason), "Açık artırma ibaresi içermeli: " + lastEntry.reason);
console.log("✓ 9. Authoritative moneyHistory Takibi Doğrulandı");

console.log("\n🎉 TÜM RESMİ DENGE VE KURAL TESTLERİ BAŞARIYLA GEÇTİ! 🎉");

