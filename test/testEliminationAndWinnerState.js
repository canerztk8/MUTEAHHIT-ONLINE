import { MonopolyGame } from '../server/game/MonopolyGame.js';

console.log('=== İFLAS VE ZAFER DURUM DOĞRULAMA TESTİ BAŞLIYOR ===');

const game = new MonopolyGame('TEST_ROOM');
game.addPlayer('p1', 'Ahmet');
game.addPlayer('p2', 'Mehmet');
game.addPlayer('p3', 'Ayşe');
game.addPlayer('p4', 'Fatma');

game.status = 'playing';
game.roundNumber = 5;

// Mülk sahipliği verelim
game.properties[1].ownerId = 'p1';
game.properties[3].ownerId = 'p1';
game.properties[3].houses = 2;

// 1. Ayşe (p3) iflas etsin (4 oyuncu varken ilk elenen -> 4. sıra)
{
  const p3 = game.players.find(p => p.id === 'p3');
  p3.lastCreditorId = 'p1';
  p3.money = -150;
  game.declareBankruptcy('p3');
}

console.log('1. Ayşe İflas Etti:');
if (game.lastElimination?.playerId !== 'p3') throw new Error('lastElimination p3 olmalıydı!');
if (game.lastElimination?.rank !== 4) throw new Error('lastElimination rank 4 olmalıydı, bulunan: ' + game.lastElimination?.rank);
if (game.lastElimination?.creditorName !== 'Ahmet') throw new Error('Alacaklı Ahmet olmalıydı!');
console.log('✓ p3 başarıyla 4. sırada elendi (Alacaklı: ' + game.lastElimination.creditorName + ').');

// 2. Fatma (p4) iflas etsin (3 oyuncu kalmışken -> 3. sıra)
{
  const p4 = game.players.find(p => p.id === 'p4');
  p4.lastCreditorId = 'p2';
  p4.money = -300;
  game.declareBankruptcy('p4');
}

console.log('2. Fatma İflas Etti:');
if (game.lastElimination?.playerId !== 'p4') throw new Error('lastElimination p4 olmalıydı!');
if (game.lastElimination?.rank !== 3) throw new Error('lastElimination rank 3 olmalıydı, bulunan: ' + game.lastElimination?.rank);
console.log('✓ p4 başarıyla 3. sırada elendi (Alacaklı: ' + game.lastElimination.creditorName + ').');

// 3. Mehmet (p2) iflas etsin -> Son 2 oyuncudan biri elenir, Ahmet (p1) şampiyon olur!
{
  const p2 = game.players.find(p => p.id === 'p2');
  p2.lastCreditorId = 'p1';
  p2.money = -1200;
  game.declareBankruptcy('p2');
}

console.log('3. Mehmet İflas Etti (Final Düellosu):');
if (game.lastElimination?.playerId !== 'p2') throw new Error('lastElimination p2 olmalıydı!');
if (game.lastElimination?.rank !== 2) throw new Error('lastElimination rank 2 olmalıydı, bulunan: ' + game.lastElimination?.rank);
if (!game.winner || game.winner.id !== 'p1') throw new Error('Kazanan p1 Ahmet olmalıydı!');
console.log('✓ p2 başarıyla 2. sırada finalist olarak elendi.');
console.log('✓ Ahmet Şampiyon ilan edildi!');

// 4. Standings Doğrulaması
console.log('4. Standings Sıralaması Doğrulaması:');
const standings = game.standings;
if (!standings || standings.length !== 4) throw new Error('Standings 4 kişi olmalıydı, bulunan: ' + standings?.length);

if (standings[0].rank !== 1 || standings[0].playerId !== 'p1' || !standings[0].isWinner) {
  throw new Error('Standings[0] Şampiyon p1 Ahmet olmalı!');
}
if (standings[1].rank !== 2 || standings[1].playerId !== 'p2') {
  throw new Error('Standings[1] 2. Mehmet olmalı!');
}
if (standings[2].rank !== 3 || standings[2].playerId !== 'p4') {
  throw new Error('Standings[2] 3. Fatma olmalı!');
}
if (standings[3].rank !== 4 || standings[3].playerId !== 'p3') {
  throw new Error('Standings[3] 4. Ayşe olmalı!');
}

console.log('✓ Sıralama Podyumu Tam Doğrulandı:');
standings.forEach(s => {
  console.log('   ' + s.rank + '. [' + (s.isWinner ? '👑 Şampiyon' : 'Elendi') + '] ' + s.name + ' - ' + (s.reason || ''));
});

// 5. getPublicState Doğrulaması
console.log('5. getPublicState Yayını:');
const pubState = game.getPublicState();
if (!pubState.lastElimination) throw new Error('getPublicState lastElimination içermeli!');
if (!pubState.eliminations || pubState.eliminations.length !== 3) throw new Error('getPublicState eliminations içermeli!');
if (!pubState.standings || pubState.standings.length !== 4) throw new Error('getPublicState standings içermeli!');
console.log('✓ getPublicState tüm alanları eksiksiz içeriyor.');

// 6. resetGameToLobby Doğrulaması
console.log('6. Lobiye Sıfırlama:');
game.resetGameToLobby();
if (game.eliminations.length !== 0 || game.lastElimination !== null || game.standings !== null) {
  throw new Error('resetGameToLobby sonrası elenme ve sıralama verileri sıfırlanmalı!');
}
console.log('✓ Lobi sıfırlaması elenme ve sıralama durumunu başarıyla temizledi.');

// 7. DevTools Komutları Doğrulaması
console.log('7. DevTools trigger_victory Komutu:');
game.status = 'playing';
game.executeDevCommand('trigger_victory', { playerId: 'p2' });
if (!game.winner || game.winner.id !== 'p2') throw new Error('trigger_victory p2 yapmalıydı!');
if (!game.standings || game.standings[0].playerId !== 'p2') throw new Error('trigger_victory sonrası standings[0] p2 olmalıydı!');
console.log('✓ trigger_victory dev komutu standings ile birlikte başarıyla çalıştı.');

console.log('=== TÜM TESTLER BAŞARIYLA GEÇTİ ===');
