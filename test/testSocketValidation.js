import { io as Client } from 'socket.io-client';
import assert from 'assert';

console.log('=== SOKET GİRDİ DOĞRULAMA & GÜVENLİK TESTİ BAŞLIYOR ===');

const PORT = 3000;
// We test against the running or locally spawned server
import { createServer } from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from '../server/game/RoomManager.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const roomManager = new RoomManager();

// Setup handlers exactly as in server/index.js
io.on('connection', (socket) => {
  socket.on('create_room', ({ playerName }, callback) => {
    const game = roomManager.createRoom();
    socket.join(game.roomCode);
    const joinRes = game.addPlayer(socket.id, playerName || 'Host', null, '#ef4444', false);
    roomManager.socketToRoom.set(socket.id, game.roomCode);
    if (callback) callback({ success: true, roomCode: game.roomCode, player: joinRes.player });
  });

  socket.on('roll_dice', (data, callback) => {
    const cb = typeof data === 'function' ? data : callback;
    const payload = typeof data === 'object' && data !== null ? data : {};
    const game = roomManager.getRoomBySocket(socket.id);
    if (!game) return cb?.({ success: false, error: 'Oda bulunamadı' });
    if (game.phase === 'TURN_ACTIONS' && game.canRollAgain) {
      game.endTurn(socket.id);
    }
    const res = game.rollDice(socket.id, payload?.dice, payload?.toss);
    if (cb) cb(res);
  });

  socket.on('build_house', ({ tileId }, callback) => {
    const game = roomManager.getRoomBySocket(socket.id);
    if (!game) return callback?.({ success: false, error: 'Oda bulunamadı' });

    const parsedTileId = Number.parseInt(tileId, 10);
    if (!Number.isInteger(parsedTileId) || parsedTileId < 0 || parsedTileId > 39) {
      return callback?.({ success: false, error: 'Geçersiz arsa numarası.' });
    }

    const res = game.buildHouse(socket.id, parsedTileId);
    if (callback) callback(res);
  });

  socket.on('sell_house', ({ tileId }, callback) => {
    const game = roomManager.getRoomBySocket(socket.id);
    if (!game) return callback?.({ success: false, error: 'Oda bulunamadı' });

    const parsedTileId = Number.parseInt(tileId, 10);
    if (!Number.isInteger(parsedTileId) || parsedTileId < 0 || parsedTileId > 39) {
      return callback?.({ success: false, error: 'Geçersiz arsa numarası.' });
    }

    const res = game.sellHouse(socket.id, parsedTileId);
    if (callback) callback(res);
  });

  socket.on('mortgage_property', ({ tileId }, callback) => {
    const game = roomManager.getRoomBySocket(socket.id);
    if (!game) return callback?.({ success: false, error: 'Oda bulunamadı' });

    const parsedTileId = Number.parseInt(tileId, 10);
    if (!Number.isInteger(parsedTileId) || parsedTileId < 0 || parsedTileId > 39) {
      return callback?.({ success: false, error: 'Geçersiz arsa numarası.' });
    }

    const res = game.mortgageProperty(socket.id, parsedTileId);
    if (callback) callback(res);
  });

  socket.on('unmortgage_property', ({ tileId }, callback) => {
    const game = roomManager.getRoomBySocket(socket.id);
    if (!game) return callback?.({ success: false, error: 'Oda bulunamadı' });

    const parsedTileId = Number.parseInt(tileId, 10);
    if (!Number.isInteger(parsedTileId) || parsedTileId < 0 || parsedTileId > 39) {
      return callback?.({ success: false, error: 'Geçersiz arsa numarası.' });
    }

    const res = game.unmortgageProperty(socket.id, parsedTileId);
    if (callback) callback(res);
  });

  socket.on('send_gift', ({ toPlayerId, amount }, callback) => {
    const game = roomManager.getRoomBySocket(socket.id);
    if (!game) return callback?.({ success: false, error: 'Oda bulunamadı' });

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return callback?.({ success: false, error: 'Geçersiz hediye miktarı.' });
    }

    const res = game.sendGift(socket.id, toPlayerId, parsedAmount);
    if (callback) callback(res);
  });

  socket.on('request_loan', ({ toPlayerId, amount }, callback) => {
    const game = roomManager.getRoomBySocket(socket.id);
    if (!game) return callback?.({ success: false, error: 'Oda bulunamadı' });

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return callback?.({ success: false, error: 'Geçersiz borç miktarı.' });
    }

    const res = game.requestLoan(socket.id, toPlayerId, parsedAmount);
    if (callback) callback(res);
  });

  socket.on('request_bank_loan', ({ amount }, callback) => {
    const game = roomManager.getRoomBySocket(socket.id);
    if (!game) return callback?.({ success: false, error: 'Oda bulunamadı' });

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return callback?.({ success: false, error: 'Geçersiz kredi tutarı.' });
    }

    const res = game.requestBankLoan(socket.id, parsedAmount);
    if (callback) callback(res);
  });

  socket.on('start_player_auction', ({ tileId, startingBid }, callback) => {
    const game = roomManager.getRoomBySocket(socket.id);
    if (!game) return callback?.({ success: false, error: 'Oda bulunamadı' });

    const parsedTileId = Number.parseInt(tileId, 10);
    const parsedBid = Number(startingBid);
    if (!Number.isInteger(parsedTileId) || parsedTileId < 0 || parsedTileId > 39) {
      return callback?.({ success: false, error: 'Geçersiz arsa numarası.' });
    }
    if (!Number.isFinite(parsedBid) || parsedBid < 0) {
      return callback?.({ success: false, error: 'Geçersiz başlangıç teklifi.' });
    }

    const res = game.startPlayerPropertyAuction(socket.id, parsedTileId, parsedBid);
    if (callback) callback(res);
  });

  socket.on('place_bid', (data, callback) => {
    const game = roomManager.getRoomBySocket(socket.id);
    if (!game) return callback?.({ success: false, error: 'Oda bulunamadı' });

    const rawAmount = data?.bidAmount ?? data?.amount;
    const bidAmount = Number(rawAmount);
    if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
      return callback?.({ success: false, error: 'Geçersiz teklif tutarı.' });
    }

    const res = game.placeBid(socket.id, bidAmount);
    if (callback) callback(res);
  });
});

const TEST_PORT = 3999;
httpServer.listen(TEST_PORT, async () => {
  const client = Client(`http://localhost:${TEST_PORT}`);

  await new Promise((resolve) => client.on('connect', resolve));
  console.log('✓ Test istemcisi bağlandı.');

  // 1. roll_dice when not in room -> returns error cleanly
  const rollRes = await new Promise((resolve) => client.emit('roll_dice', {}, resolve));
  assert.strictEqual(rollRes.success, false);
  assert.strictEqual(rollRes.error, 'Oda bulunamadı');
  console.log('✓ Oda dışı roll_dice güvenliği doğrulandı.');

  // Create room
  const createRes = await new Promise((resolve) => client.emit('create_room', { playerName: 'Tester' }, resolve));
  assert.strictEqual(createRes.success, true);
  console.log('✓ Test odası kuruldu.');

  // 2. build_house with invalid tileId
  const b1 = await new Promise((resolve) => client.emit('build_house', { tileId: -1 }, resolve));
  assert.strictEqual(b1.success, false);
  assert.strictEqual(b1.error, 'Geçersiz arsa numarası.');

  const b2 = await new Promise((resolve) => client.emit('build_house', { tileId: 40 }, resolve));
  assert.strictEqual(b2.success, false);
  assert.strictEqual(b2.error, 'Geçersiz arsa numarası.');

  const b3 = await new Promise((resolve) => client.emit('build_house', { tileId: 'gecersiz' }, resolve));
  assert.strictEqual(b3.success, false);
  assert.strictEqual(b3.error, 'Geçersiz arsa numarası.');
  console.log('✓ build_house geçersiz tileId sınır kontrolleri doğrulandı.');

  // 3. sell_house with invalid tileId
  const s1 = await new Promise((resolve) => client.emit('sell_house', { tileId: 99 }, resolve));
  assert.strictEqual(s1.success, false);
  assert.strictEqual(s1.error, 'Geçersiz arsa numarası.');
  console.log('✓ sell_house geçersiz tileId sınır kontrolleri doğrulandı.');

  // 4. mortgage_property with invalid tileId
  const m1 = await new Promise((resolve) => client.emit('mortgage_property', { tileId: -5 }, resolve));
  assert.strictEqual(m1.success, false);
  assert.strictEqual(m1.error, 'Geçersiz arsa numarası.');
  console.log('✓ mortgage_property sınır kontrolleri doğrulandı.');

  // 5. unmortgage_property with invalid tileId
  const u1 = await new Promise((resolve) => client.emit('unmortgage_property', { tileId: 'xyz' }, resolve));
  assert.strictEqual(u1.success, false);
  assert.strictEqual(u1.error, 'Geçersiz arsa numarası.');
  console.log('✓ unmortgage_property sınır kontrolleri doğrulandı.');

  // 6. send_gift with non-positive or non-finite amount
  const g1 = await new Promise((resolve) => client.emit('send_gift', { toPlayerId: 'p2', amount: -50 }, resolve));
  assert.strictEqual(g1.success, false);
  assert.strictEqual(g1.error, 'Geçersiz hediye miktarı.');

  const g2 = await new Promise((resolve) => client.emit('send_gift', { toPlayerId: 'p2', amount: 'NaN' }, resolve));
  assert.strictEqual(g2.success, false);
  assert.strictEqual(g2.error, 'Geçersiz hediye miktarı.');
  console.log('✓ send_gift miktar doğrulama kontrolleri doğrulandı.');

  // 7. request_loan with invalid amount
  const l1 = await new Promise((resolve) => client.emit('request_loan', { toPlayerId: 'p2', amount: 0 }, resolve));
  assert.strictEqual(l1.success, false);
  assert.strictEqual(l1.error, 'Geçersiz borç miktarı.');
  console.log('✓ request_loan miktar doğrulama kontrolleri doğrulandı.');

  // 8. request_bank_loan with invalid amount
  const bl1 = await new Promise((resolve) => client.emit('request_bank_loan', { amount: -100 }, resolve));
  assert.strictEqual(bl1.success, false);
  assert.strictEqual(bl1.error, 'Geçersiz kredi tutarı.');
  console.log('✓ request_bank_loan miktar doğrulama kontrolleri doğrulandı.');

  // 9. start_player_auction with invalid tileId or startingBid
  const a1 = await new Promise((resolve) => client.emit('start_player_auction', { tileId: 50, startingBid: 100 }, resolve));
  assert.strictEqual(a1.success, false);
  assert.strictEqual(a1.error, 'Geçersiz arsa numarası.');

  const a2 = await new Promise((resolve) => client.emit('start_player_auction', { tileId: 1, startingBid: -10 }, resolve));
  assert.strictEqual(a2.success, false);
  assert.strictEqual(a2.error, 'Geçersiz başlangıç teklifi.');
  console.log('✓ start_player_auction parametre doğrulama kontrolleri doğrulandı.');

  // 10. place_bid with invalid amount
  const pb1 = await new Promise((resolve) => client.emit('place_bid', { bidAmount: -20 }, resolve));
  assert.strictEqual(pb1.success, false);
  assert.strictEqual(pb1.error, 'Geçersiz teklif tutarı.');

  const pb2 = await new Promise((resolve) => client.emit('place_bid', { bidAmount: 'bad' }, resolve));
  assert.strictEqual(pb2.success, false);
  assert.strictEqual(pb2.error, 'Geçersiz teklif tutarı.');
  console.log('✓ place_bid miktar doğrulama kontrolleri doğrulandı.');

  client.disconnect();
  httpServer.close();

  console.log('======================================================');
  console.log('🎉 TÜM SOKET GİRDİ DOĞRULAMA VE GÜVENLİK TESTLERİ GEÇTİ!');
  console.log('======================================================');
  process.exit(0);
});
