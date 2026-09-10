import { MonopolyGame } from '../server/game/MonopolyGame.js';
import { BOARD_TILES } from '../server/game/boardData.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log('=== MÜTEAHHİT KURAL & DENGE & YENİ ÖZELLİK TESTLERİ BAŞLIYOR ===');

const game = new MonopolyGame('TEST01');
const p1Res = game.addPlayer('p1', 'Caner');
const p2Res = game.addPlayer('p2', 'Ahmet');
game.startGame('p1');

console.log('1. Başlangıç bakiyesi kontrolü (1500₺):');
const p1 = game.players.find(p => p.id === 'p1');
const p2 = game.players.find(p => p.id === 'p2');
assert(p1.money === 1500, 'P1 parası 1500₺ olmalı');
assert(p2.money === 1500, 'P2 parası 1500₺ olmalı');
console.log('✓ Başlangıç sermayesi 1500₺ doğru ayarlandı.');

console.log('2. Hediye (Gift) Gönderme Testi:');
const giftRes = game.sendGift('p1', 'p2', 150);
assert(giftRes.success === true, 'Hediye başarılı olmalı');
assert(p1.money === 1350, 'P1 150₺ vermiş olmalı (1500 - 150 = 1350)');
assert(p2.money === 1650, 'P2 150₺ almış olmalı (1500 + 150 = 1650)');
console.log('✓ Hediye başarıyla gönderildi ve bakiyeler güncellendi.');

console.log('3. Ev Satma (Sell House / Downgrade) Testi:');
// Caner 1 ve 3 nolu kahverengi setine sahip olsun
game.properties[1].ownerId = 'p1';
game.properties[3].ownerId = 'p1';
game.buildHouse('p1', 1);
assert(game.properties[1].houses === 1, '1 ev inşa edilmiş olmalı');
const preSellMoney = p1.money;
const sellRes = game.sellHouse('p1', 1);
assert(sellRes.success === true, 'Ev başarıyla satılmalı');
assert(game.properties[1].houses === 0, 'Ev sayısı 0 olmalı');
assert(p1.money === preSellMoney + 30, 'Ev maliyetinin (60₺) %50si (30₺) iade edilmeli');
console.log('✓ Ev bankaya %50 bedelle başarıyla satıldı.');

console.log('4. Ücretsiz Otopark Havuzu (Jackpot) Testi (0₺ Ödül):');
game.freeParkingPool = 350; // Havuzda 350₺ birikmiş olsa da
const preJackpotMoney = p1.money;
game.handleTileLanding(p1, BOARD_TILES[20], 7);
assert(p1.money === preJackpotMoney, 'Otoparkta havuz ödülü verilmemeli (0₺)');
console.log('✓ Ücretsiz Otopark 0₺ ödül kuralı başarıyla doğrulandı.');

console.log('5. Oturum Yeniden Bağlama (Reconnect) & F5 Borç Koruma Testi:');
const reconnectLoanRes = game.requestBankLoan(p1.id, 100);
assert(reconnectLoanRes.success === true, 'Banka kredisi başarıyla alınabilmeli');
const reconnectLoanId = reconnectLoanRes.loan?.id;

const sessionToken = p1Res.player.sessionToken;
const recRes = game.reconnectPlayer('new_socket_p1', sessionToken);
assert(recRes.success === true, 'Oturum yeniden bağlanabilmeli');
const reconnectedP1 = game.players.find(p => p.id === 'new_socket_p1');
assert(reconnectedP1 !== undefined, 'Soket ID güncellenmiş olmalı');
assert(game.properties[1].ownerId === 'new_socket_p1', 'Mülk sahibi yeni ID olmalı');
assert(reconnectedP1.money === 1420, 'F5 sonrası oyuncunun bakiyesi (1420₺) korunmalı');
assert(game.activeLoans.some(l => l.borrowerId === 'new_socket_p1'), 'F5 sonrası aktif borç yeni soket IDye devrolmalı');
console.log('✓ F5 / Reconnect koruması ve aktif borç muhafazası başarıyla test edildi.');

console.log('6. Karşılıksız Para Dilenme Takası Engeli Testi:');
const begTrade = game.proposeTrade('new_socket_p1', {
  toPlayerId: 'p2',
  offeredMoney: 0,
  offeredProperties: [],
  requestedMoney: 300,
  requestedProperties: []
});
assert(begTrade.success === false, 'Karşılıksız sadece para isteme engellenmeli');
console.log('✓ Karşılıksız para dilenme takası başarıyla engellendi.');

console.log('7. Borçluyken Tur Bitirme Koruması Testi:');
reconnectedP1.money = -100;
game.phase = 'TURN_ACTIONS';
const endRes = game.endTurn('new_socket_p1');
assert(endRes.success === false, 'Borçluyken tur bitirilememeli');
console.log('✓ Borçlu oyuncunun borcu ödemeden tur bitirmesi engellendi.');

console.log('8. İflas Bildirme ve Galibiyet Testi:');
const bankrRes = game.declareBankruptcy('new_socket_p1');
assert(bankrRes.success === true, 'İflas başarıyla uygulanmalı');
assert(reconnectedP1.isBankrupt === true, 'P1 iflas etmiş olmalı');
console.log(`✓ İflas başarıyla işlendi ve ${game.winner.name} şampiyon ilan edildi!`);

console.log('9. Ankara Harita Doğrulaması:');
assert(BOARD_TILES[1].name.includes('Ulus'), 'Kare 1 Ulus olmalı');
assert(BOARD_TILES[21].name.includes('Bahçeli'), 'Kare 21 Bahçelievler olmalı');
assert(BOARD_TILES[24].name.includes('Kızılay'), 'Kare 24 Kızılay olmalı');
assert(BOARD_TILES[26].name.includes('Tunalı Hilmi'), 'Kare 26 Tunalı Hilmi olmalı');
assert(BOARD_TILES[31].name.includes('Çankaya'), 'Kare 31 Çankaya olmalı');
assert(BOARD_TILES[34].name.includes('Ümitköy'), 'Kare 34 Ümitköy olmalı');
assert(BOARD_TILES[37].name.includes('Bilkent'), 'Kare 37 Bilkent olmalı');
assert(BOARD_TILES[39].name.includes('İncek'), 'Kare 39 İncek olmalı');
assert(BOARD_TILES[5].name.includes('Ankara Tren Garı'), 'Kare 5 Ankara Tren Garı olmalı');
console.log('✓ Ankara semtleri ve istasyonları başarıyla doğrulandı.');

console.log('10. Faizli Borç Sistemi (%15 Faiz, Geri Ödeme ve İkinci Borç Engeli):');
const game2 = new MonopolyGame('TEST02');
game2.addPlayer('b1', 'Borçlu');
game2.addPlayer('l1', 'Alacaklı');
game2.startGame('b1');

// Borçlu 200₺ borç istesin
const loanReq = game2.requestLoan('b1', 'l1', 200);
assert(loanReq.success === true, 'Borç talebi başarılı olmalı');
assert(game2.pendingLoan.totalRepay === 230, '%15 faizle 200₺ -> 230₺ olmalı');
assert(game2.pendingLoan.interest === 30, 'Faiz 30₺ olmalı');

// Borç kabul edilsin
const bPlayer = game2.players.find(p => p.id === 'b1');
const lPlayer = game2.players.find(p => p.id === 'l1');
const bPre = bPlayer.money;
const lPre = lPlayer.money;
const loanAccept = game2.respondLoan('l1', true);
assert(loanAccept.success === true, 'Borç kabulü başarılı olmalı');
assert(bPlayer.money === bPre + 200, 'Borçluya 200₺ geçmeli');
assert(lPlayer.money === lPre - 200, 'Borç verenden 200₺ eksilmeli');
assert(game2.activeLoans.length === 1, 'Aktif borç kaydı oluşmalı');

// Aktif borcu varken yeni borç isteyememeli
const secondLoan = game2.requestLoan('b1', 'l1', 100);
assert(secondLoan.success === false, 'Aktif borç varken 2. borç engellenmeli');

// Borcu geri ödeme
const payRes = game2.payLoan('b1', game2.activeLoans[0].id);
assert(payRes.success === true, 'Borç başarıyla geri ödenmeli');
assert(game2.activeLoans.length === 0, 'Borç kapatıldıktan sonra liste boş olmalı');
assert(lPlayer.money === lPre + 30, 'Borç veren %15 faiz kazancını almış olmalı');
console.log('✓ Faizli borç alma, limit kontrolü ve faizli geri ödeme testi geçti.');

console.log('11. AFK Süre Aşımı Fail-Safe (forceTimeoutTurn) Testi:');
const game3 = new MonopolyGame('TEST03');
game3.addPlayer('u1', 'Oyuncu1');
game3.addPlayer('u2', 'Oyuncu2');
game3.startGame('u1');
const startActive = game3.getActivePlayer().id;
assert(['u1', 'u2'].includes(startActive), 'Sıra u1 veya u2 de olmalı');

// Aktif oyuncu hamle yapmadan beklerse forceTimeoutTurn çağrılır:
const timeoutRes = game3.forceTimeoutTurn(startActive);
assert(timeoutRes.success === true, 'Zaman aşımı devri başarılı olmalı');
const newActive = game3.getActivePlayer().id;
assert(newActive !== startActive, 'Sıra başarıyla diğer oyuncuya devredilmiş olmalı');
console.log('✓ AFK tur takılma engeli (forceTimeoutTurn) başarıyla test edildi.');

console.log('12. Yeni Şans Kartları (Tapuya Çökme & Zorunlu Müzayede) Testi:');
const game4 = new MonopolyGame('TEST04');
game4.addPlayer('pA', 'OyuncuA');
game4.addPlayer('pB', 'OyuncuB');
game4.startGame('pA');

const pA = game4.players.find(p => p.id === 'pA');
const pB = game4.players.find(p => p.id === 'pB');

// Oyuncu B'ye bir mülk ver (Kızılay id: 24, maliyet: 240)
game4.properties[24].ownerId = 'pB';
const pBPre = pB.money;

// Oyuncu A 'Tapuya Çökme' kartı uygular
game4.applyCard(pA, { action: { type: 'seize_property' } }, 7);
assert(game4.properties[24].ownerId === 'pA', 'Mülk Oyuncu A ya devredilmiş olmalı');
assert(pB.money === pBPre + 120, 'Eski sahip pB ye %50 tazminat (120₺) ödenmiş olmalı');

// Oyuncu A 'Zorunlu Müzayede' kartı uygular
const pAPre = pA.money;
game4.applyCard(pA, { action: { type: 'forced_auction' } }, 7);
assert(game4.properties[24].ownerId === null, 'Mülk ihale sonrası sahipsiz kalmalı');
assert(pA.money === pAPre + 300, 'Oyuncu A ya %125 primle 300₺ nakit ödenmiş olmalı');
console.log('✓ Tapuya Çökme ve Zorunlu Müzayede kart mantığı başarıyla doğrulandı.');

console.log('13. Bot Ekleme ve Bot Çıkarma (Remove Bot) Testi:');
const game5 = new MonopolyGame('TEST05');
assert(game5.turnTimeLimit === 75, 'Tur süresi 75 saniye olmalı');
game5.addPlayer('host1', 'Kurucu');
const botRes = game5.addBot();
assert(botRes.success === true, 'Bot başarıyla eklenmeli');
assert(game5.players.length === 2, 'Oyuncu sayısı 2 olmalı');
assert(game5.players.some(p => p.isBot === true), 'Oyuncular arasında bot olmalı');

// Lobide bot çıkarma
const remRes = game5.removeBot(botRes.player.id);
assert(remRes.success === true, 'Bot lobiden başarıyla çıkarılmalı');
assert(game5.players.length === 1, 'Oyuncu sayısı 1 e düşmeli');

// Yeniden bot ekleyip oyunda atma testi
const botRes2 = game5.addBot();
const p2Res5 = game5.addPlayer('p2', 'İkinciOyuncu');
game5.startGame('host1');
assert(game5.status === 'playing', 'Oyun başlamış olmalı');

// Yetkisiz oyuncunun bot çıkarma denemesi engellenmeli
const unauthorizedKick = game5.removeBot(botRes2.player.id, 'p2');
assert(unauthorizedKick.success === false, 'Oda kurucusu olmayan oyuncu bot çıkaramamalı');

// Kurucu tarafından bot başarıyla atılmalı
const kickRes = game5.removeBot(botRes2.player.id, 'host1');
assert(kickRes.success === true, 'Oyundaki bot kurucu tarafından başarıyla atılmalı');
const kickedBot = game5.players.find(p => p.id === botRes2.player.id);
assert(kickedBot.isBankrupt === true, 'Atılan bot iflas etmiş olmalı');
console.log('✓ Bot ekleme, lobide çıkarma ve yetkili/yetkisiz oyunda atma testi başarıyla geçti.');

// 14. Olay Günlüğü (Event Log) Kronolojisi ve Zar Tespiti Testi
console.log('14. Olay Günlüğü (Event Log) Kronolojisi ve Zar Tespiti Testi:');
const game6 = new MonopolyGame('TEST06');
game6.addPlayer('pA', 'Oyuncu A');
game6.addPlayer('pB', 'Oyuncu B');
game6.startGame('pA');

// Aktif oyuncu zar atar
const activeP6 = game6.getActivePlayer();
game6.rollDice(activeP6.id);
// Son log bir 'info' olmalı (kareye gelme logu), ama zar logu da geriye doğru tarandığında bulunmalı
assert(game6.logs.length >= 4, 'En az 4 log kaydı bulunmalı');
const oldestLog = game6.logs[0];
const newestLog = game6.logs[game6.logs.length - 1];
assert(oldestLog.text.includes('katıldı'), 'En eski log en başta olmalı (kronolojik sıra)');
assert(['info', 'card', 'rent'].includes(newestLog.type), 'En yeni log kareye varış veya kare olayı olmalı');

const latestDiceLog = [...game6.logs].reverse().find(l => l.type === 'dice');
assert(latestDiceLog !== undefined, 'Zar atış logu geriye doğru aramada başarıyla bulunmalı');
assert(latestDiceLog.type === 'dice', 'Bulunan log dice tipinde olmalı');
assert(latestDiceLog.text.includes('zar attı'), 'Zar atış metni içermeli');
console.log('✓ Olay günlüğü kronolojik sıralaması ve zar logu tespiti başarıyla doğrulandı.');

// 15. "En Yakın Boş Haneye İlerle" Şans Kartları Adet ve Fonksiyon Testi
console.log('15. "En Yakın Boş Haneye İlerle" Şans Kartları Testi:');
const game7 = new MonopolyGame('TEST07');
game7.addPlayer('p1', 'Oyuncu 1');
game7.addPlayer('p2', 'Oyuncu 2');
game7.addPlayer('p3', 'Oyuncu 3');
// 3 oyuncu için Math.ceil(3 / 2) = 2 kart eklenmeli
game7.startGame('p1');
const unownedCardsInDeck = game7.chanceDeck.filter(c => c.action?.type === 'advance_nearest_unowned');
assert(unownedCardsInDeck.length === 2, `3 oyuncu için 2 adet "En Yakın Boş Haneye İlerle" kartı olmalı, bulunan: ${unownedCardsInDeck.length}`);

// Kart fonksiyonunu test et (p1 konum 0'da, en yakın boş kare 1 Ulus olmalı)
const p1_7 = game7.players.find(p => p.id === 'p1');
game7.applyCard(p1_7, unownedCardsInDeck[0], 7);
assert(p1_7.position === 1, 'Oyuncu en yakın sahipsiz tapu olan 1. kareye (Ulus) ilerlemeli');
console.log('✓ "En Yakın Boş Haneye İlerle" kartı adedi ve ilerleme mekaniği başarıyla doğrulandı.');

// 16. 2 Tam Harita Turu (Full Map Laps) Sonrası Açık Artırma (Auction) Sistemi Testi
console.log('16. 2 Tam Harita Turu Sonrası Açık Artırma (Auction) Sistemi Testi:');
const game8 = new MonopolyGame('TEST08');
game8.addPlayer('alice', 'Alice');
game8.addPlayer('bob', 'Bob');
game8.addPlayer('charlie', 'Charlie');
game8.startGame('alice');

// 16. 1 Tam Harita Turu (Full Map Lap) Sonrası Açık Artırma (Auction) Sistemi Testi:
console.log('16. 1 Tam Harita Turu Sonrası Açık Artırma (Auction) Sistemi Testi:');
const alice8 = game8.players.find(p => p.id === 'alice');
const bob8 = game8.players.find(p => p.id === 'bob');
const charlie8 = game8.players.find(p => p.id === 'charlie');

const aliceIdx = game8.players.findIndex(p => p.id === 'alice');
game8.currentTurnIndex = aliceIdx;

// Oyuncuların harita turları 1'den azken (0 tur) mülkü reddetmek açık artırma başlatmamalı
alice8.position = 1; // Ulus
game8.currentTile = BOARD_TILES[1];
game8.phase = 'TILE_ACTION';
alice8.lapsCompleted = 0;
bob8.lapsCompleted = 0;
charlie8.lapsCompleted = 0;
const declineR1 = game8.declineBuy('alice');
assert(game8.phase === 'TURN_ACTIONS', 'Oyuncular 1 tam turu tamamlamadığında (lapsCompleted < 1) pas geçilince açık artırma başlamamalı');
assert(game8.auction === null, 'Açık artırma null kalmalı');

// Sadece bir veya iki oyuncu 1 tur tamamladıysa yine açık artırma başlamamalı
game8.players.forEach((p, idx) => p.lapsCompleted = idx === 0 ? 0 : 1);
game8.phase = 'TILE_ACTION';
const declinePartial = game8.declineBuy('alice');
assert(game8.phase === 'TURN_ACTIONS', 'Tüm oyuncular 1 tur tamamlamadıkça açık artırma başlamamalı');
assert(game8.auction === null, 'Açık artırma null kalmalı');

// Tüm aktif (iflas etmemiş) oyuncular en az 1 tam harita turunu (lapsCompleted >= 1) tamamladığında açık artırma başlamalı!
game8.players.forEach(p => p.lapsCompleted = 1);
game8.phase = 'TILE_ACTION';
const declineR2 = game8.declineBuy('alice');
assert(game8.phase === 'AUCTION', 'Tüm oyuncular 1 tam harita turunu tamamlayınca pas geçildiğinde phase AUCTION olmalı');
assert(game8.auction !== null, 'Açık artırma nesnesi oluşturulmalı');
assert(game8.auction.tileId === 1, 'Açık artırmadaki mülk Ulus olmalı');
assert(game8.auction.ownerName === 'Sahipsiz (Banka / Hazine)', 'Açık artırmada mülk sahibi bilgisi yer almalı');
assert(game8.auction.reason === 'pass', 'Açık artırma sebebi pass olmalı');

// Pas diyen oyuncu (Alice) de ihaleye teklif VEREBİLMELİ
const aliceBid = game8.placeBid('alice', 40);
assert(aliceBid.success === true, 'Pas geçen oyuncu da ihaleye teklif verebilmeli');

// Bob geçerli teklif verir
const bidRes1 = game8.placeBid('bob', 45);
assert(bidRes1.success === true, 'Bob geçerli teklif verebilmeli');
assert(game8.auction.currentBid === 45, 'Mevcut teklif 45 olmalı');
assert(game8.auction.highestBidderId === 'bob', 'En yüksek teklif sahibi Bob olmalı');

// Charlie daha yüksek teklif verir
const charlieBeforeBid = game8.players.find(p => p.id === 'charlie').money;
const bidRes2 = game8.placeBid('charlie', 50);
assert(bidRes2.success === true, 'Charlie karşı teklif verebilmeli');
assert(game8.auction.currentBid === 50, 'Mevcut teklif 50 olmalı');

// Alice ve Bob pas geçer ve açık artırma biter
game8.passAuction('alice');
game8.passAuction('bob');
assert(game8.auction === null, 'Tüm rakipler pas geçince açık artırma bitmeli');
assert(game8.properties[1].ownerId === 'charlie', 'Açık artırmayı kazanan Charlie tapuyu almalı');
const charliePlayerObj = game8.players.find(p => p.id === 'charlie');
assert(charliePlayerObj.money === charlieBeforeBid - 50, 'Charlie teklif ettiği 50₺ bedeli ödemiş olmalı');
console.log('✓ 1 tam harita turu sonrası açık artırma başlatma, pas diyen oyuncunun teklif verebilmesi ve kazanma başarıyla test edildi.');

// 17. Son Çare Acil Banka Kredisi (İlk 35 Turda %25 Faiz) & Oyuncu Kredisi Tam Tur (Pass GO) Faiz Testi:
console.log('17. Son Çare Acil Banka Kredisi & Oyuncu Kredisi Tam Tur (Pass GO) Faiz Testi:');
const game9 = new MonopolyGame('TEST09');
game9.addPlayer('charlie', 'Charlie');
game9.addPlayer('david', 'David');
game9.startGame('charlie');

const charliePlayer9 = game9.players.find(p => p.id === 'charlie');
const initialMoney = charliePlayer9.money;
const loanRes = game9.requestBankLoan('charlie', 200);
assert(loanRes.success === true, 'Banka kredisi başarıyla çekilmeli');
assert(charliePlayer9.money === initialMoney + 200, 'Charlie kasadan 200₺ nakit almalı');
const bankLoan = game9.activeLoans.find(l => l.borrowerId === 'charlie' && l.isBankLoan);
assert(bankLoan !== undefined, 'Aktif banka kredisi kaydı bulunmalı');
assert(bankLoan.totalRepay === 250, 'İlk 35 turda %25 faizle 200₺ kredinin geri ödemesi 250₺ olmalı');

// İkinci banka kredisi engellenmeli
const secondBankLoan = game9.requestBankLoan('charlie', 100);
assert(secondBankLoan.success === false, 'Mevcut kredi kapatılmadan ikinci kredi alınamamalı');

// Krediyi geri ödeme testi
const payBankRes = game9.payLoan('charlie', bankLoan.id);
assert(payBankRes.success === true, 'Kredi başarıyla geri ödenmeli');
assert(charliePlayer9.money === initialMoney + 200 - 250, 'Kredi 250₺ kesintiyle ödenmiş olmalı');
assert(game9.activeLoans.length === 0, 'Aktif kredi kalmamalı');

// Kademeli Bileşik Faiz ve Üst Limit (2.5x Cap) Testi - Banka Kredisi (Yeni Denge: %50 Maaş Kesintisi ile)
const loanCompoundRes = game9.requestBankLoan('charlie', 500);
assert(loanCompoundRes.success === true, '500₺ kredi çekilebilmeli');
const compLoan = game9.activeLoans.find(l => l.borrowerId === 'charlie' && l.isBankLoan);
assert(compLoan.remaining === 625, 'İlk 35 turda %25 faizle ilk borç 625₺ olmalı');
assert(compLoan.maxCap === 1250, '2.5x tavan limit 1250₺ olmalı');

// Tur devri (endTurn) faiz ARTIRMAMALI (sadece tam harita turunda/başlangıçtan geçince artmalı)
const lastPlayer = game9.players[game9.players.length - 1];
game9.currentTurnIndex = game9.players.length - 1;
game9.phase = 'TURN_ACTIONS';
const endRes9 = game9.endTurn(lastPlayer.id);
assert(endRes9.success === true, 'Son oyuncu turu bitirebilmeli');
assert(game9.roundNumber === 2, '2. tur başlamış olmalı');
assert(compLoan.remaining === 625, 'Normal tur değişiminde faiz artmamalı, 625₺ kalmalı');

// Charlie harita turunu tamamlayıp (Başlangıçtan geçince) 100₺ maaş haczi uygulanır (625 - 100 = 525₺)
// ve kalan borca %25 faiz biner (525 * 1.25 = 656.25 -> 656₺)
const charliePlayer = game9.players.find(p => p.id === 'charlie');
charliePlayer.position = 35;
game9.movePlayer(charliePlayer, 10); // 35 -> 5 (Başlangıç noktasından geçer)
assert(compLoan.remaining === 656, `Başlangıçtan geçince 100₺ kesinti ve %25 faizle 656₺ olmalı, şu an: ${compLoan.remaining}`);
assert(compLoan.compoundRounds === 1, 'Bileşik faiz 1 tur işlemiş olmalı');

// Charlie 8 tur daha atarak tavan sınıra ulaşır
for (let lap = 0; lap < 8; lap++) {
  game9.movePlayer(charliePlayer, 40);
}
assert(compLoan.remaining === 1250, `Borç tavan limit olan 1250₺ değerinde durmalı, şu an: ${compLoan.remaining}`);
assert(compLoan.isCapped === true, 'isCapped true olmalı');

game9.payLoan('charlie', compLoan.id);

// Oyuncular Arası Borç (Player-to-Player Loan) Tam Tur Faiz ve Maaş Kesintisi Testi
const pLoanReq = game9.requestLoan('charlie', 'david', 100);
assert(pLoanReq.success === true, 'Charlie David\'den borç isteyebilmeli');
game9.respondLoan('david', true);
const davidMoneyAfterLoan = game9.players.find(p => p.id === 'david').money;
const pLoan = game9.activeLoans.find(l => l.borrowerId === 'charlie' && !l.isBankLoan);
assert(pLoan !== undefined, 'Oyuncular arası borç aktif olmalı');
assert(pLoan.remaining === 115, 'İlk borç %15 faizle 115₺ olmalı');

// Charlie tam tur atınca 100₺ maaş kesintisi David'e ödenir (115 - 100 = 15₺), kalan 15₺'ye %40 faiz biner (15 + 6 = 21₺)
game9.movePlayer(charliePlayer, 40);
assert(pLoan.remaining === 21, `Oyuncu borcu 100₺ haciz ve %40 faiz sonrası 21₺ olmalı, şu an: ${pLoan.remaining}`);
const davidUpdatedMoney = game9.players.find(p => p.id === 'david').money;
assert(davidUpdatedMoney === davidMoneyAfterLoan + 100, `David'e Charlie'nin maaş kesintisinden 100₺ geçmiş olmalı`);

console.log('✓ Son çare acil banka kredisi ve oyuncu borcu tam tur faiz ve maaş haczi mekanizması başarıyla geçti.');

// 18. Bot Zorluk Seviyeleri Testi
console.log('18. Bot Zorluk Seviyeleri Testi:');
const game10 = new MonopolyGame('TEST10');
const b1 = game10.addBot('cok_kolay');
const b2 = game10.addBot('imkansiz');
assert(b1.player.difficulty === 'cok_kolay', 'b1 zorluğu cok_kolay olmalı');
assert(b2.player.difficulty === 'imkansiz', 'b2 zorluğu imkansiz olmalı');

// Zorluk değiştirme testi
const changeDiff = game10.setBotDifficulty(b1.player.id, 'zor');
assert(changeDiff.success === true, 'Zorluk başarıyla güncellenmeli');
assert(b1.player.difficulty === 'zor', 'b1 zorluğu zor olarak güncellenmiş olmalı');
console.log('✓ Bot zorluk seviyeleri belirleme ve değiştirme testi başarıyla geçti.');

// 19. Oyun Sıfırlama ve Lobiye Dönme (resetGameToLobby) Testi
console.log('19. Oyun Sıfırlama ve Lobiye Dönme (resetGameToLobby) Testi:');
const game11 = new MonopolyGame('TEST11');
game11.addPlayer('u1', 'Oyuncu 1');
game11.addPlayer('u2', 'Oyuncu 2');
game11.startGame('u1');
const pU1 = game11.players.find(p => p.id === 'u1');
pU1.money = 5000;
game11.properties[1].ownerId = 'u1';
game11.properties[1].houses = 3;
game11.winner = pU1;
game11.status = 'ended';

// Sıfırlama çağrısı
const resetRes = game11.resetGameToLobby();
assert(resetRes.success === true, 'Sıfırlama başarılı olmalı');
assert(game11.status === 'lobby', 'Oyun durumu lobby olmalı');
assert(game11.winner === null, 'Kazanan null olmalı');
assert(game11.properties[1].ownerId === null, 'Arsa mülkiyeti sıfırlanmalı');
assert(game11.properties[1].houses === 0, 'Binalar sıfırlanmalı');
assert(pU1.money === 1500, 'Oyuncu parası 1500₺ başlangıç değerine dönmeli');
assert(game11.players.length === 2, 'Oyuncular lobide kalmalı');
console.log('✓ Oyun sıfırlama ve lobiye dönme testi başarıyla geçti.');

// 20. Açık Artırma Sırasında Tur Bitirme Engeli Testi
console.log('20. Açık Artırma Sırasında Tur Bitirme Engeli Testi:');
const game12 = new MonopolyGame('TEST12');
game12.addPlayer('p_a', 'Oyuncu A');
game12.addPlayer('p_b', 'Oyuncu B');
game12.startGame('p_a');
game12.startAuction(BOARD_TILES[1]);
assert(game12.phase === 'AUCTION', 'Faz AUCTION olmalı');
const active12 = game12.getActivePlayer();
const endAuctionTurnRes = game12.endTurn(active12.id);
assert(endAuctionTurnRes.success === false, 'Açık artırma sırasında tur bitirme engellenmeli');
assert(endAuctionTurnRes.error.includes('Açık artırma devam ederken'), 'Hata mesajı açık artırma uyarısı içermeli');
console.log('✓ Açık artırma devam ederken endTurn çağrısının engellendiği doğrulandı.');

// 21. 1 Tam Harita Turu Tamamlandığında TILE_ACTION Aşamasında forceTimeoutTurn Açık Artırma Koruması Testi:
console.log('21. 1 Tam Harita Turu Tamamlandığında TILE_ACTION Aşamasında forceTimeoutTurn Açık Artırma Koruması Testi:');
const game13 = new MonopolyGame('TEST13');
game13.addPlayer('p_c', 'Oyuncu C');
game13.addPlayer('p_d', 'Oyuncu D');
game13.startGame('p_c');
game13.players.forEach(p => p.lapsCompleted = 1);
game13.currentTile = BOARD_TILES[3]; // Dışkapı
game13.phase = 'TILE_ACTION';
const active13 = game13.getActivePlayer();
const timeoutAuctionRes = game13.forceTimeoutTurn(active13.id);
assert(timeoutAuctionRes.success === true, 'forceTimeoutTurn başarılı olmalı');
assert(game13.phase === 'AUCTION', '1 tam harita turunu tamamlayınca AFK kalınca açık artırma başlamış olmalı');
assert(game13.auction !== null, 'Açık artırma nesnesi var olmalı');
assert(game13.auction.tileId === 3, 'Açık artırmadaki mülk Dışkapı olmalı');
assert(game13.currentTurnIndex === 0, 'Açık artırma başladığı için tur henüz devredilmemeli');
console.log('✓ 1 tam harita turu tamamlandıktan sonra TILE_ACTION aşamasında AFK kalınca açık artırmanın başladığı ve turun devredilmediği doğrulandı.');

// 22. Kodesteki Oyuncunun forceTimeoutTurn Sırasında Kodes Kurallarına Uyumu Testi:
console.log('22. Kodesteki Oyuncunun forceTimeoutTurn Sırasında Kodes Kurallarına Uyumu Testi:');
const game14 = new MonopolyGame('TEST14');
game14.addPlayer('jail_p', 'Kodesteki Oyuncu');
game14.addPlayer('free_p', 'Serbest Oyuncu');
game14.startGame('jail_p');
const jailActive = game14.getActivePlayer();
game14.sendToJail(jailActive);
assert(jailActive.inJail === true, 'Oyuncu kodeste olmalı');
assert(jailActive.position === 10, 'Oyuncu 10. karede olmalı');

// 1. Tur AFK zar atışı (eğer çift gelmezse kodeste kalmalı ve pozisyon 10 kalmalı)
game14.phase = 'WAITING_ROLL';
// Kontrollü zar için dice simülasyonu yerine rollDice fonksiyonunun jailTurns artırdığını doğrula
game14.forceTimeoutTurn(jailActive.id);
// forceTimeoutTurn sonrası eğer çift değilse jailTurns 1 olmuş olmalı ve pozisyon 10 kalmalı
if (jailActive.inJail) {
  assert(jailActive.position === 10, 'Çift atmadıkça piyon kodeste (kare 10) kalmalı, dışarı kaçmamalı');
  assert(jailActive.jailTurns === 1, 'Kodes tur sayısı 1 olmalı');
}
console.log('✓ Kodesteki oyuncu için AFK zar atışında kodes kuralına uyulduğu doğrulandı.');

// 23. 40 Karenin Tamamının Görsellerinin Doğrulanması Testi:
console.log('23. 40 Karenin Tamamının Görsellerinin Doğrulanması Testi:');
assert(BOARD_TILES.length === 40, 'Toplam 40 kare olmalı');
BOARD_TILES.forEach((tile, idx) => {
  assert(typeof tile.image === 'string', `Kare ${idx} (${tile.name}) görseli string olmalı`);
  assert(tile.image.startsWith('data:image/svg+xml') || tile.image.startsWith('http') || tile.image.startsWith('/images/tiles/'), `Kare ${idx} (${tile.name}) görseli geçerli SVG Data URI, HTTP URL veya /images/tiles/ yolu olmalı`);
  assert(tile.image.length >= 20, `Kare ${idx} (${tile.name}) görsel verisi boş olmamalı`);
});
console.log('✓ 40 karenin tümünün geçerli görsel URLine sahip olduğu doğrulandı.');

// 24. Banka Kredisi ve Oyuncu Kredisi Geri Ödeme Log Formatı Testi:
console.log('24. Banka Kredisi ve Oyuncu Kredisi Geri Ödeme Log Formatı Testi:');
const game15 = new MonopolyGame('TEST15');
game15.addPlayer('borclu', 'Borçlu');
game15.addPlayer('tefeci', 'Tefeci');
game15.startGame('borclu');

// Banka kredisi al ve öde
game15.requestBankLoan('borclu', 100);
const bankLoanRecord = game15.activeLoans.find(l => l.isBankLoan);
game15.payLoan('borclu', bankLoanRecord.id);
const bankLog = game15.logs.find(l => l.text.includes('Merkez Bankası acil kredi borcunu tamamen kapattı'));
assert(bankLog !== undefined, 'Banka kredisi kapama logunda "Merkez Bankası acil kredi borcunu tamamen kapattı" yazmalı');

console.log('✓ Banka kredisi geri ödeme log formatı başarıyla doğrulandı.');

// 25. Piyon İlerlemesinde Harita Turu (lapsCompleted) Artışı ve İflas Etmiş Oyuncu İstisnası Testi:
console.log('25. Piyon İlerlemesinde Harita Turu (lapsCompleted) Artışı ve İflas Etmiş Oyuncu İstisnası Testi:');
const game16 = new MonopolyGame('TEST16');
game16.addPlayer('p_x', 'Oyuncu X');
game16.addPlayer('p_y', 'Oyuncu Y');
game16.addPlayer('p_z', 'Oyuncu Z');
game16.startGame('p_x');

const px = game16.players.find(p => p.id === 'p_x');
const py = game16.players.find(p => p.id === 'p_y');
const pz = game16.players.find(p => p.id === 'p_z');

assert(px.lapsCompleted === 0, 'Başlangıçta lapsCompleted 0 olmalı');
assert(px.laps === 0, 'laps takma adı 0 olmalı');

// p_x 38. kareden 5 adım ilerlesin (Başlangıçtan geçer, yeni kare 3)
px.position = 38;
game16.movePlayer(px, 5);
assert(px.position === 3, 'Yeni pozisyon 3 olmalı');
assert(px.lapsCompleted === 1, 'Başlangıçtan geçince lapsCompleted 1 olmalı');
assert(px.laps === 1, 'laps getter 1 olmalı');

// p_x bir kez daha Başlangıçtan geçsin
px.position = 35;
game16.movePlayer(px, 10);
assert(px.lapsCompleted === 2, '2. kez geçince lapsCompleted 2 olmalı');

// p_z iflas etsin
game16.declareBankruptcy('p_z');
assert(pz.isBankrupt === true, 'p_z iflas etmeli');

// p_y 1 tam tur yapsın
py.lapsCompleted = 1;

// Şimdi aktif (iflas etmemiş) kalan tüm oyuncular (p_x ve p_y) en az 1 tur tamamladı
px.position = 1; // Ulus
game16.currentTile = BOARD_TILES[1];
const pxIdx = game16.players.findIndex(p => p.id === 'p_x');
game16.currentTurnIndex = pxIdx;
game16.phase = 'TILE_ACTION';
const decRes = game16.declineBuy('p_x');
assert(game16.phase === 'AUCTION', 'Aktif tüm oyuncular (iflas eden hariç) 1 turu tamamladığında açık artırma tetiklenmeli');
console.log('✓ Piyon turu artışı ve iflas etmiş oyuncu varken açık artırma tetikleme mantığı doğrulandı.');

// 19. Borç Tavan Sınırı Yaptırımları ve İcra Takibi Testi (%50 Maaş Haczi, İnşa Blokesi, 2 Tur İcra)
console.log('19. Borç Tavan Sınırı Yaptırımları ve İcra Takibi Testi:');
{
  const game19 = new MonopolyGame('TEST19');
  game19.addPlayer('u1', 'User 1');
  game19.addPlayer('u2', 'User 2');
  game19.startGame('u1');

  const u1 = game19.players.find(p => p.id === 'u1');
  const u2 = game19.players.find(p => p.id === 'u2');

  // u1 banka kredisi çeksin (100₺ anapara -> maxCap = 250₺)
  const loanRes = game19.requestBankLoan('u1', 100);
  assert(loanRes.success === true, 'u1 banka kredisi alabilmeli');
  const loan19 = game19.activeLoans[0];

  // Borcu tavan sınıra yükseltelim
  loan19.remaining = 250;
  loan19.totalRepay = 250;
  loan19.isCapped = true;
  loan19.cappedLaps = 0;

  // Test Rule 2: İnşa ve Mülk Alım Blokesi
  // u1'e 1. renk grubundaki mülkleri verelim
  game19.properties[1].ownerId = 'u1';
  game19.properties[3].ownerId = 'u1';
  const buildRes = game19.buildHouse('u1', 1);
  assert(buildRes.success === false, 'Tavan sınırdaki oyuncu ev inşası yapamamalı');
  assert(buildRes.error.includes('faiz tavan sınırına ulaştığı'), 'İnşa engeli hatası dönmeli');

  // u1 Başlangıçtan geçsin (1. Tur) -> %50 Maaş Kesintisi çalışmalı (200₺ yerine 100₺ almalı, 100₺ borca kesilmeli)
  const preMoney = u1.money;
  u1.position = 38;
  game19.movePlayer(u1, 5); // 38 + 5 = 3 (Başlangıçtan geçti)
  assert(u1.money === preMoney + 100, `Maaşın %50'si (100₺) alınmalı, şu anki para: ${u1.money}`);
  assert(loan19.remaining === 150, `Borç 100₺ azalarak 150₺ olmalı, şu an: ${loan19.remaining}`);
  assert(loan19.cappedLaps === 1, 'Tavan sınırda tamamlanan tur 1 olmalı');

  // u1 Başlangıçtan 2. kez geçsin (2. Tur) -> 2. Tur tamamlandı, İCRA MEKANİZMASI tetiklenmeli!
  game19.movePlayer(u1, 40); // Tam tur
  // Kasadaki nakitten kalan 150₺ tahsil edilip borç KAPATILMALI
  assert(loan19.remaining <= 0 || game19.activeLoans.length === 0, 'İcra takibi sonucu borç nakitten tahsil edilip kapatılmalı');
  console.log('✓ Borç tavan sınırı yaptırımları (%50 maaş haczi, inşa blokesi ve 2. tur icra takibi) başarıyla doğrulandı.');
}

// 20. Yeni Borç Dengeleme Kuralları (%40 Kira/Kart Kesintisi, %25 Zamlı Ev Dikimi)
console.log('20. Yeni Borç Dengeleme Kuralları Testi:');
{
  const game20 = new MonopolyGame('TEST20');
  game20.addPlayer('borclu', 'Borçlu Oyuncu');
  game20.addPlayer('kiraci', 'Kiracı Oyuncu');
  game20.startGame('borclu');

  const borclu = game20.players.find(p => p.id === 'borclu');
  const kiraci = game20.players.find(p => p.id === 'kiraci');

  // 1. Borç alma (İlk 35 turda %25 faiz)
  game20.requestBankLoan('borclu', 200); // 200₺ kredi -> 250₺ borç
  const loanRecord = game20.activeLoans.find(l => l.borrowerId === 'borclu');
  assert(loanRecord.remaining === 250, 'İlk borç 250₺ olmalı');

  // 2. Kira tahsilatında %40 kesinti testi
  const garnRes = game20.deductLoanGarnishment(borclu, 100, 'kira', 0.40);
  assert(garnRes.deducted === 40, '100₺ kiranın 40₺si borca kesilmeli');
  assert(garnRes.netAmount === 60, 'Kalan 60₺ borçluya kalmalı');
  assert(loanRecord.remaining === 210, 'Kalan borç 210₺ye düşmeli');

  // 3. Şans kartı gelirinde %40 kesinti testi
  const cardGarnRes = game20.deductLoanGarnishment(borclu, 50, 'şans kartı', 0.40);
  assert(cardGarnRes.deducted === 20, '50₺ kart gelirinin 20₺si borca kesilmeli');
  assert(cardGarnRes.netAmount === 30, 'Kalan 30₺ borçluya kalmalı');
  assert(loanRecord.remaining === 190, 'Kalan borç 190₺ye düşmeli');

  // 4. Borçlu iken ev dikme maliyetinin %25 zamlı olması testi
  game20.properties[1].ownerId = 'borclu';
  game20.properties[3].ownerId = 'borclu';
  const tile1 = BOARD_TILES[1]; // houseCost = 60₺
  assert(tile1.houseCost === 60, 'Normal ev maliyeti 60₺ olmalı');

  const moneyBeforeBuild = borclu.money;
  const buildRes = game20.buildHouse('borclu', 1);
  assert(buildRes.success === true, 'Ev inşası başarılı olmalı');
  assert(buildRes.cost === 75, '%25 zamla 60₺ -> 75₺ (Math.round(60 * 1.25)) olmalı');
  assert(borclu.money === moneyBeforeBuild - 75, 'Oyuncudan 75₺ kesilmiş olmalı');

  // 5. Borç kapatılınca ev dikiminin normale dönmesi
  game20.payLoan('borclu', loanRecord.id);
  assert(game20.activeLoans.length === 0, 'Borç kalmamalı');

  const moneyBeforeBuild2 = borclu.money;
  const buildRes2 = game20.buildHouse('borclu', 3);
  assert(buildRes2.success === true, '2. ev inşası başarılı olmalı');
  assert(buildRes2.cost === 60, 'Borç kapandıktan sonra ev maliyeti normal 60₺ olmalı');
  assert(borclu.money === moneyBeforeBuild2 - 60, 'Oyuncudan normal 60₺ kesilmiş olmalı');

  console.log('✓ Yeni borç dengeleme kuralları (%40 kira/kart kesintisi, %25 zamlı ev dikimi, borç kapanınca normale dönüş) başarıyla doğrulandı.');
}

// 21. Açık Artırma Erken Bitirme ve lastAuctionResult Testi
console.log('21. Açık Artırma Erken Bitirme ve lastAuctionResult Testi:');
{
  const game21 = new MonopolyGame('TEST21');
  game21.addPlayer('p1', 'Ahmet');
  game21.addPlayer('p2', 'Mehmet');
  game21.startGame();

  // Ulus için açık artırma başlat
  const tile1 = BOARD_TILES[1];
  game21.startAuction(tile1);
  assert(game21.phase === 'AUCTION', 'Aşama AUCTION olmalı');
  assert(game21.auction !== null, 'Aktif açık artırma olmalı');

  // p2 pas geçsin
  const passRes = game21.passAuction('p2');
  assert(passRes.success === true, 'p2 pas geçebilmeli');
  assert(game21.auction.passedPlayerIds.includes('p2'), 'p2 passed listesinde olmalı');

  // p1 teklif versin -> Tek kalan oyuncu olduğu için sayaç beklemeden DERHAL bitmeli!
  const bidRes = game21.placeBid('p1', 50);
  assert(bidRes.success === true, 'p1 teklif verebilmeli');
  assert(game21.auction === null, 'Tüm rakipler pas geçmişken teklif verilince açık artırma DERHAL sonlanmalı');
  assert(game21.phase === 'TURN_ACTIONS', 'Aşama TURN_ACTIONS olmalı');
  assert(game21.lastAuctionResult !== null, 'lastAuctionResult üretilmeli');
  assert(game21.lastAuctionResult.winnerId === 'p1', 'Kazanan p1 olmalı');
  assert(game21.lastAuctionResult.sold === true, 'Mülk satılmış olmalı');
  assert(game21.properties[1].ownerId === 'p1', 'Tapu p1 adına tescillenmeli');
  console.log('✓ Açık artırma erken bitirme ve lastAuctionResult mekanizması başarıyla doğrulandı.');
}

// 22. Hızlı Bot Takas Değerlendirme Testi (evaluateBotTrade)
console.log('22. Hızlı Bot Takas Değerlendirme Testi (evaluateBotTrade):');
{
  const game22 = new MonopolyGame('TEST22');
  game22.addPlayer('human', 'İnsan Oyuncu');
  const botRes = game22.addBot('zor');
  const bot1 = botRes.player;
  game22.startGame();

  // İnsan oyuncu bota kazançlı bir teklif sunsun
  game22.properties[1].ownerId = 'human';
  game22.properties[3].ownerId = bot1.id;

  // İnsan 1. mülkü + 200₺ nakit verip 3. mülkü istesin (Bota aşırı kârlı)
  const propRes = game22.proposeTrade('human', {
    toPlayerId: bot1.id,
    offeredMoney: 200,
    offeredProperties: [1],
    requestedMoney: 0,
    requestedProperties: [3]
  });

  assert(propRes.success === true, 'Takas teklifi başarılı olmalı');
  assert(game22.pendingTrade !== null, 'Bekleyen takas teklifi olmalı');
  const evalRes = game22.evaluateBotTrade(bot1.id);
  assert(evalRes.success === true, 'Bot teklifi değerlendirebilmeli');
  assert(evalRes.accepted === true, 'Kârlı teklif bot tarafından kabul edilmeli');
  assert(game22.pendingTrade === null, 'Kabul sonrası takas temizlenmeli');
  assert(game22.properties[3].ownerId === 'human', 'Mülk 3 takasla insana geçmeli');
  console.log('✓ Hızlı bot takas değerlendirmesi (evaluateBotTrade) başarıyla doğrulandı.');
}

// 23. Oyuncu Tapu Açık Artırması (50₺ Harç, Tur Başına 1 Hak, Otelli Mülk Desteği ve Satış Geliri)
console.log('23. Oyuncu Tapu Açık Artırması (50₺ Harç & Otel Desteği) Testi:');
{
  const game23 = new MonopolyGame('TEST23');
  game23.addPlayer('seller', 'Satıcı Oyuncu');
  game23.addPlayer('buyer', 'Alıcı Oyuncu');
  game23.startGame('seller');

  const seller = game23.players.find(p => p.id === 'seller');
  const buyer = game23.players.find(p => p.id === 'buyer');

  // Satıcıya mülk verelim ve otel dikelim
  game23.properties[1].ownerId = 'seller';
  game23.properties[1].houses = 5; // Otelli tapu

  // Henüz harita turu tamamlanmadı (lapsCompleted: 0, lastAuctionedLap: -1)
  // İlk turda lapsCompleted = 0 > -1 olduğu için 1 kez koyabilmeli
  const initialParking = game23.freeParkingPool;
  const initialSellerMoney = seller.money;

  const startRes = game23.startPlayerPropertyAuction('seller', 1, 100);
  assert(startRes.success === true, 'Satıcı otelli mülkünü açık artırmaya koyabilmeli');
  assert(seller.money === initialSellerMoney - 50, 'Satıcıdan 50₺ açık artırma harcı kesilmeli');
  assert(game23.freeParkingPool === initialParking + 50, '50₺ harç Ücretsiz Otopark havuzuna eklenmeli');
  assert(seller.lastAuctionedLap === 0, 'lastAuctionedLap güncellenmeli');
  assert(game23.phase === 'AUCTION', 'Aşama AUCTION olmalı');
  assert(game23.auction.sellerId === 'seller', 'Açık artırma satıcısı seller olmalı');
  assert(game23.auction.tileId === 1, 'Satılan mülk tileId 1 olmalı');

  // Alıcı teklif versin
  const bidRes = game23.placeBid('buyer', 150);
  assert(bidRes.success === true, 'Alıcı teklif verebilmeli');

  // Açık artırmayı sonlandır
  game23.endAuction();
  assert(game23.properties[1].ownerId === 'buyer', 'Mülk alıcıya geçmeli');
  assert(game23.properties[1].houses === 5, 'Oteller mülkle birlikte devredilmeli');
  assert(seller.money === initialSellerMoney - 50 + 150, 'Satıcı satış bedeli olan 150₺yi tahsil etmeli');
  assert(game23.lastPropertyAcquired !== null, 'lastPropertyAcquired bildirim verisi oluşturulmalı');
  assert(game23.lastPropertyAcquired.playerId === 'buyer', 'Kazanılan tapu buyer adına olmalı');

  // Aynı tur içinde 2. kez açık artırma başlatılamamalı!
  game23.properties[3].ownerId = 'seller';
  const secondAttempt = game23.startPlayerPropertyAuction('seller', 3, 100);
  assert(secondAttempt.success === false, 'Aynı harita turu içinde 2. açık artırma başlatılamamalı');
  assert(secondAttempt.error.includes('Bu turda zaten bir mülk açık artırmaya çıkardınız'), 'Tur hakkı hatası vermeli');

  // Harita turu atlayınca (lapsCompleted: 1) tekrar izin verilmeli
  seller.lapsCompleted = 1;
  const newLapAttempt = game23.startPlayerPropertyAuction('seller', 3, 100);
  assert(newLapAttempt.success === true, 'Yeni harita turu tamamlanınca tekrar açık artırma açılabilmeli');
  game23.endAuction();

  console.log('✓ Oyuncu tapu açık artırması (50₺ harç, tur başına 1 hak, otelli mülk desteği ve satış geliri) başarıyla doğrulandı.');
}

// 24. Bot Turunu Hızlı Atla (fastForwardBotTurn) Testi
console.log('24. Bot Turunu Hızlı Atla (fastForwardBotTurn) Testi:');
{
  const game24 = new MonopolyGame('TEST24');
  game24.addPlayer('human', 'İnsan Oyuncu');
  const botRes = game24.addBot('orta');
  const bot1 = botRes.player;
  game24.startGame('human');

  // İnsan oyuncu zar atıp turunu tamamlasın
  game24.rollDice('human');
  if (game24.phase === 'TILE_ACTION') {
    game24.declineBuy('human');
  }
  game24.canRollAgain = false;
  game24.endTurn('human');
  assert(game24.getActivePlayer().id === bot1.id, 'Aktif oyuncu bot olmalı');
  assert(game24.phase === 'WAITING_ROLL', 'Bot zar atma aşamasında olmalı');

  // Bot turunu anında işletip hızlı atla
  const skipRes = game24.fastForwardBotTurn();
  assert(skipRes.success === true, 'fastForwardBotTurn başarılı olmalı');
  // Tur anında bitip sıradaki oyuncuya (insana) geçmiş olmalı
  assert(game24.getActivePlayer().id === 'human', 'Bot turu tamamlanıp sıra insana geçmiş olmalı');
  console.log('✓ Bot turunu hızlı atlama mekanizması (fastForwardBotTurn) başarıyla doğrulandı.');
}

// 25. Vergi Müfettişi (gotojail) ve lastJailEvent Testi
console.log('25. Vergi Müfettişi (gotojail) ve lastJailEvent Testi:');
{
  const game25 = new MonopolyGame('TEST25');
  game25.addPlayer('p1', 'P1');
  game25.addPlayer('p2', 'P2');
  game25.startGame('p1');

  const p1 = game25.players.find(p => p.id === 'p1');
  // P1'i doğrudan 30. kareye taşıyalım
  p1.position = 28;
  // 2 adım atıp 30'a bassın
  game25.movePlayer(p1, 2, false);

  assert(p1.inJail === true, 'P1 kodeste olmalı');
  assert(p1.position === 10, 'P1 kodese (10. kareye) transfer edilmiş olmalı');
  assert(game25.lastJailEvent !== null, 'lastJailEvent oluşturulmuş olmalı');
  assert(game25.lastJailEvent.fromTileId === 30, 'lastJailEvent.fromTileId 30 olmalı');
  assert(game25.lastJailEvent.toTileId === 10, 'lastJailEvent.toTileId 10 olmalı');
  assert(game25.lastJailEvent.playerId === 'p1', 'lastJailEvent.playerId p1 olmalı');

  const pubState = game25.getPublicState();
  assert(pubState.lastJailEvent !== null, 'getPublicState içinde lastJailEvent bulunmalı');
  assert(pubState.lastJailEvent.fromTileId === 30, 'Public state fromTileId 30 olmalı');

  game25.resetGameToLobby();
  assert(game25.lastJailEvent === null, 'resetGameToLobby sonrası lastJailEvent sıfırlanmalı');
  console.log('✓ Vergi Müfettişi lastJailEvent oluşturma ve getPublicState yayını başarıyla doğrulandı.');
}

// 26. Bot Borç Tasfiyesi ve Takılma Önleme (Fail-Safe advanceTurn) Testi
console.log('26. Bot Borç Tasfiyesi ve Takılma Önleme (Fail-Safe advanceTurn) Testi:');
{
  const game26 = new MonopolyGame('TEST26');
  game26.addPlayer('human', 'İnsan');
  const bot = game26.addBot('orta').player;
  game26.startGame('human');

  // Sırayı doğrudan bota alalım
  const botIdx = game26.players.findIndex(p => p.id === bot.id);
  game26.currentTurnIndex = botIdx;
  game26.phase = 'WAITING_ROLL';
  assert(game26.getActivePlayer().id === bot.id, 'Sıra botta olmalı');

  // Botun parasını eksiye düşürelim (-300₺)
  bot.money = -300;
  // Botun 1 evi ve 1 ipoteksiz mülkü olsun
  game26.properties[1].ownerId = bot.id;
  game26.properties[1].houses = 1;
  game26.properties[3].ownerId = bot.id;
  game26.properties[3].mortgaged = false;

  // fastForwardBotTurn çağrıldığında borç tasfiye edilmeli ve tur güvenle sonraki oyuncuya devredilmeli
  const skipRes = game26.fastForwardBotTurn();
  assert(skipRes.success === true, 'fastForwardBotTurn başarılı olmalı');
  assert(bot.money >= 0 || bot.isBankrupt, 'Bot borcunu kapatmış veya iflas etmiş olmalı');
  assert(game26.getActivePlayer().id === 'human', 'Tur başarıyla insana geçmiş olmalı (takılma yok)');
  console.log('✓ Bot borç tasfiyesi ve fail-safe advanceTurn mekanizması başarıyla doğrulandı.');
}

// 27. DevTools / Süpervizör Komutları Testi (executeDevCommand & riggedDice)
console.log('27. DevTools / Süpervizör Komutları Testi:');
{
  const devGame = new MonopolyGame('DEVTEST');
  const p1 = devGame.addPlayer('p1', 'Caner').player;
  const p2 = devGame.addBot('orta').player;
  devGame.startGame('p1');

  // Tur sarma
  const rRes = devGame.executeDevCommand('set_round', { round: 32 });
  assert(rRes.success === true && devGame.roundNumber === 32, 'Tur 32 olmalı');

  // Para ekleme & borç testi
  devGame.executeDevCommand('set_money', { playerId: 'p1', amount: -300 });
  assert(p1.money === -300, 'Bakiye -300₺ olmalı');
  devGame.executeDevCommand('add_money', { playerId: 'p1', amount: 800 });
  assert(p1.money === 500, 'Bakiye 500₺ olmalı');

  // Işınlanma
  devGame.executeDevCommand('teleport', { playerId: 'p1', tileId: 20 });
  assert(p1.position === 20, 'Piyon 20. karede olmalı');

  // Kodes testi
  devGame.executeDevCommand('jail_status', { playerId: 'p1', inJail: true });
  assert(p1.inJail === true && p1.position === 10, 'Oyuncu kodeste olmalı');
  devGame.executeDevCommand('jail_status', { playerId: 'p1', inJail: false });
  assert(p1.inJail === false, 'Oyuncu kodesten çıkmış olmalı');

  // Zar sabitleme (riggedDice)
  devGame.executeDevCommand('rig_dice', { d1: 4, d2: 4 });
  const p1Idx = devGame.players.findIndex(p => p.id === 'p1');
  devGame.currentTurnIndex = p1Idx;
  devGame.phase = 'WAITING_ROLL';
  const rollRes = devGame.rollDice('p1');
  assert(rollRes.success === true, 'Zar atışı başarılı olmalı');
  assert(devGame.dice[0] === 4 && devGame.dice[1] === 4, 'Sabitlenen [4, 4] zarı gelmeli');

  // Monopol verme
  const mRes = devGame.executeDevCommand('give_monopoly', { playerId: 'p1', colorOrType: 'brown' });
  assert(mRes.success === true && mRes.count === 2, '2 kahverengi tapu verilmeli');
  assert(devGame.properties[1].ownerId === 'p1' && devGame.properties[3].ownerId === 'p1', 'Kahverengi tapuların sahibi Caner olmalı');

  console.log('✓ DevTools süpervizör komutları ve zar sabitleme mekanizması başarıyla doğrulandı.');
}

// 28. Otomatik İpotek (autoMortgage) Testi
console.log('28. Otomatik İpotek (autoMortgage) Testi:');
{
  const autoGame = new MonopolyGame('AUTOTEST');
  autoGame.addPlayer('p1', 'Caner');
  autoGame.addPlayer('p2', 'Ahmet');
  autoGame.startGame('p1');

  // Caner'e bir mülk verelim ve parasını negatife düşürelim
  autoGame.properties[1].ownerId = 'p1';
  autoGame.properties[1].mortgaged = false;
  const p1Caner = autoGame.players.find(p => p.id === 'p1');
  p1Caner.money = -20;

  const autoRes = autoGame.autoMortgage('p1');
  assert(autoRes.success === true, 'Otomatik ipotek başarılı olmalı');
  assert(autoGame.properties[1].mortgaged === true, '1 nolu mülk ipotek edilmiş olmalı');
  assert(p1Caner.money >= 0, 'Otomatik ipotek sonrası bakiye sıfır veya pozitif olmalı');
  console.log('✓ Otomatik ipotek (autoMortgage) başarıyla doğrulandı.');
}

// 29. Lobide Profil Özelleştirme & Benzersizlik Testi
console.log('29. Lobide Profil Özelleştirme & Benzersizlik Testi:');
{
  const profGame = new MonopolyGame('PROFGAME');
  profGame.addPlayer('p1', 'Caner');
  profGame.addPlayer('p2', 'Ahmet');

  // İsim değiştirme
  const nameRes = profGame.updatePlayerProfile('p1', { name: 'CanerYeni' });
  assert(nameRes.success === true, 'İsim güncelleme başarılı olmalı');
  assert(profGame.players[0].name === 'CanerYeni', 'Yeni isim CanerYeni olmalı');

  // Aynı renk seçilemez
  const duplicateColorRes = profGame.updatePlayerProfile('p1', { color: profGame.players[1].color });
  assert(duplicateColorRes.success === false, 'Kullanımdaki renk seçilememeli');

  // Farklı renk seçilebilir
  const unusedColor = '#8b5cf6';
  const colorRes = profGame.updatePlayerProfile('p1', { color: unusedColor });
  assert(colorRes.success === true, 'Kullanılmayan renk seçilebilmeli');
  assert(profGame.players[0].color === unusedColor, 'Renk güncellenmiş olmalı');

  // Aynı piyon seçilemez
  const duplicateTokenRes = profGame.updatePlayerProfile('p1', { tokenId: profGame.players[1].token.id });
  assert(duplicateTokenRes.success === false, 'Kullanımdaki piyon seçilememeli');

  console.log('✓ Profil özelleştirme ve piyon/renk benzersizlik kontrolü başarıyla doğrulandı.');
}

// 30. Lobide Oyuncu Atma (kickPlayer) Testi
console.log('30. Lobide Oyuncu Atma (kickPlayer) Testi:');
{
  const kickGame = new MonopolyGame('KICKGAME');
  kickGame.addPlayer('host', 'Kurucu');
  kickGame.addPlayer('guest', 'Misafir');

  // Kurucu olmayan oyuncu atamaz
  const failKick = kickGame.kickPlayer('guest', 'host');
  assert(failKick.success === false, 'Yetkisiz oyuncu atamamalı');

  // Kurucu misafiri atar
  const succKick = kickGame.kickPlayer('host', 'guest');
  assert(succKick.success === true, 'Kurucu oyuncu atabilmeli');
  assert(kickGame.players.length === 1, 'Oyuncu sayısı 1 e düşmeli');
  assert(kickGame.players[0].id === 'host', 'Sadece kurucu kalmalı');
  console.log('✓ Lobide kurucu tarafından oyuncu atma (kickPlayer) başarıyla doğrulandı.');
}

// 31. Oyunu Duraklatma (togglePause) Testi
console.log('31. Oyunu Duraklatma (togglePause) Testi:');
{
  const pauseGame = new MonopolyGame('PAUSEGAME');
  pauseGame.addPlayer('host', 'Kurucu');
  pauseGame.addPlayer('guest', 'Misafir');
  pauseGame.startGame('host');

  assert(pauseGame.isPaused === false, 'Başlangıçta duraklatılmamış olmalı');

  // Yetkisiz duraklatma denemesi
  const failPause = pauseGame.togglePause('guest');
  assert(failPause.success === false, 'Yetkisiz oyuncu duraklatamamalı');

  // Kurucu duraklatır
  const pauseRes = pauseGame.togglePause('host');
  assert(pauseRes.success === true && pauseGame.isPaused === true, 'Oyun duraklatılmalı');

  // Duraklatılmışken zar atılamaz
  const rollRes = pauseGame.rollDice(pauseGame.getActivePlayer().id);
  assert(rollRes.success === false, 'Oyun duraklatılmışken zar atılamaz');

  // Kurucu devam ettirir
  const resumeRes = pauseGame.togglePause('host');
  assert(resumeRes.success === true && pauseGame.isPaused === false, 'Oyun devam etmeli');
  console.log('✓ Oyunu duraklatma / devam ettirme (togglePause) ve hamle blokesi başarıyla doğrulandı.');
}

// 32. AFK WAITING_ROLL Süre Aşımında Sıranın Doğrudan Sonraki Oyuncuya Geçmesi Testi:
console.log('32. AFK WAITING_ROLL Süre Aşımında Sıranın Doğrudan Sonraki Oyuncuya Geçmesi Testi:');
{
  const timeoutGame = new MonopolyGame('TEST32');
  timeoutGame.addPlayer('afk_1', 'AFK Oyuncu 1');
  timeoutGame.addPlayer('active_2', 'Aktif Oyuncu 2');
  timeoutGame.startGame('afk_1');
  const activeAfk = timeoutGame.getActivePlayer();
  const nextExpected = timeoutGame.players.find(p => p.id !== activeAfk.id);
  assert(timeoutGame.phase === 'WAITING_ROLL', 'Aşama WAITING_ROLL olmalı');

  // activeAfk süre aşımına uğrar
  const timeoutRes = timeoutGame.forceTimeoutTurn(activeAfk.id);
  assert(timeoutRes.success === true, 'forceTimeoutTurn başarılı olmalı');
  assert(timeoutGame.getActivePlayer().id === nextExpected.id, 'Sıra doğrudan sonraki oyuncuya geçmiş olmalı');
  assert(timeoutGame.phase === 'WAITING_ROLL', 'Yeni oyuncu için aşama WAITING_ROLL olmalı');
  console.log('✓ AFK WAITING_ROLL süre aşımında sıranın doğrudan sonraki oyuncuya geçtiği doğrulandı.');
}

// 33. Süre Aşımı (AFK) İhalesi Tamamlandığında Sıranın Otomatik Devredilmesi Testi:
console.log('33. Süre Aşımı (AFK) İhalesi Tamamlandığında Sıranın Otomatik Devredilmesi Testi:');
{
  const auctionTimeoutGame = new MonopolyGame('TEST33');
  auctionTimeoutGame.addPlayer('afk_seller', 'AFK Satıcı');
  auctionTimeoutGame.addPlayer('buyer', 'Alıcı');
  auctionTimeoutGame.startGame('afk_seller');
  const afkSeller = auctionTimeoutGame.getActivePlayer();
  const buyerPlayer = auctionTimeoutGame.players.find(p => p.id !== afkSeller.id);
  auctionTimeoutGame.players.forEach(p => p.lapsCompleted = 1);
  auctionTimeoutGame.currentTile = BOARD_TILES[1]; // Ulus
  auctionTimeoutGame.phase = 'TILE_ACTION';

  // afkSeller arsayı almayıp süresi biter -> açık artırma başlar
  const timeoutRes = auctionTimeoutGame.forceTimeoutTurn(afkSeller.id);
  assert(timeoutRes.success === true, 'forceTimeoutTurn başarılı olmalı');
  assert(auctionTimeoutGame.phase === 'AUCTION', 'Aşama AUCTION olmalı');
  assert(auctionTimeoutGame.auction.startedByTimeout === true, 'startedByTimeout bayrağı true olmalı');

  // buyerPlayer teklif verir ve açık artırma sonuçlanır
  auctionTimeoutGame.placeBid(buyerPlayer.id, 40);
  const endRes = auctionTimeoutGame.endAuction();
  assert(endRes.success === true, 'endAuction başarılı olmalı');
  assert(auctionTimeoutGame.auction === null, 'Açık artırma sonuçlanmış olmalı');
  assert(auctionTimeoutGame.getActivePlayer().id === buyerPlayer.id, 'İhale bitince sıra derhal buyer oyuncusuna devredilmiş olmalı');
  assert(auctionTimeoutGame.phase === 'WAITING_ROLL', 'Sıradaki oyuncunun aşaması WAITING_ROLL olmalı');
  console.log('✓ Süre aşımı (AFK) ihalesi tamamlandığında sıranın derhal devredildiği doğrulandı.');
}

// 34. CARD_DRAWN Aşamasında Süre Aşımında Sıranın Temiz Devri Testi:
console.log('34. CARD_DRAWN Aşamasında Süre Aşımında Sıranın Temiz Devri Testi:');
{
  const cardGame = new MonopolyGame('TEST34');
  cardGame.addPlayer('p_card', 'Kart Çeken');
  cardGame.addPlayer('p_next', 'Sıradaki');
  cardGame.startGame('p_card');
  const cardPlayer = cardGame.getActivePlayer();
  const nextPlayer = cardGame.players.find(p => p.id !== cardPlayer.id);
  cardGame.drawnCard = { id: 'ch1', title: 'Test Kartı', drawerId: cardPlayer.id };
  cardGame.phase = 'CARD_DRAWN';

  const timeoutRes = cardGame.forceTimeoutTurn(cardPlayer.id);
  assert(timeoutRes.success === true, 'forceTimeoutTurn başarılı olmalı');
  assert(cardGame.drawnCard === null, 'Çekilen kart temizlenmiş olmalı');
  assert(cardGame.getActivePlayer().id === nextPlayer.id, 'Sıra nextPlayer oyuncusuna devredilmiş olmalı');
  assert(cardGame.phase === 'WAITING_ROLL', 'Aşama WAITING_ROLL olmalı');
  console.log('✓ CARD_DRAWN aşamasında süre aşımında kartın temizlenip sıranın devredildiği doğrulandı.');
}

console.log('=== TÜM TESTLER BAŞARIYLA GEÇTİ ===');


