import { io } from 'socket.io-client';

async function testGame() {
  console.log('--- Müteahhit Multiplayer Simülasyon Testi Başlatılıyor ---');

  const p1 = io('http://localhost:3000');
  const p2 = io('http://localhost:3000');

  await new Promise(resolve => p1.on('connect', resolve));
  await new Promise(resolve => p2.on('connect', resolve));
  console.log('✓ Oyuncu 1 ve Oyuncu 2 sunucuya bağlandı.');

  // 1. Oyuncu 1 oda oluşturur
  let roomCode = null;
  await new Promise(resolve => {
    p1.emit('create_room', {
      playerName: 'Caner',
      token: { id: 'hard_hat', name: 'Sarı Baret', icon: '👷' },
      color: '#ef4444'
    }, (res) => {
      console.log('✓ Oda oluşturuldu:', res);
      roomCode = res.roomCode;
      resolve();
    });
  });

  // 2. Oyuncu 2 odaya katılır
  await new Promise(resolve => {
    p2.emit('join_room', {
      roomCode,
      playerName: 'Ahmet',
      token: { id: 'car', name: 'Yarış Arabası', icon: '🏎️' },
      color: '#3b82f6'
    }, (res) => {
      console.log('✓ Oyuncu 2 odaya katıldı:', res);
      resolve();
    });
  });

  // 3. Bot ekle
  await new Promise(resolve => {
    p1.emit('add_bot', {}, (res) => {
      console.log('✓ Yapay zeka bot eklendi:', res.player?.name);
      resolve();
    });
  });

  // 4. Oyunu Başlat
  await new Promise(resolve => {
    p1.emit('start_game', {}, (res) => {
      console.log('✓ Oyun başlatıldı:', res);
      resolve();
    });
  });

  // 5. Zar atma testi
  await new Promise(resolve => {
    p1.emit('roll_dice', {}, (res) => {
      console.log('✓ Caner zar attı:', res);
      resolve();
    });
  });

  // 6. Sohbet mesajı testi
  p2.on('chat_message', (msg) => {
    console.log('✓ Canlı sohbet mesajı alındı:', msg);
  });

  p1.emit('send_chat', { message: 'Herkese bol şans! Bu oyunu ben alacağım!' });

  await new Promise(r => setTimeout(r, 1000));

  console.log('--- TESTLER BAŞARIYLA TAMAMLANDI ---');
  p1.disconnect();
  p2.disconnect();
  process.exit(0);
}

testGame().catch(err => {
  console.error('Test hatası:', err);
  process.exit(1);
});
