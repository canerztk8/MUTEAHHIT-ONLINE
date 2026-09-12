/**
 * Müteahhit Online — P2P Ağ Protokolü
 * =====================================
 * WebRTC DataChannel üzerinden taşınan mesaj tipleri ve factory fonksiyonları.
 *
 * Yön: Client → Host
 *   { type: MSG.ACTION, action: string, payload: object, senderId: string }
 *
 * Yön: Host → Client(s)
 *   { type: MSG.SYNC_STATE, gameState: object }
 *   { type: MSG.EVENT, event: string, payload: object }
 *   { type: MSG.CHAT, message: object }
 *   { type: MSG.KICKED, reason: string }
 *   { type: MSG.HOST_DROPPED }
 *   { type: MSG.ERROR, code: string, message: string }
 *   { type: MSG.HOST_MIGRATED, newHostId: string }
 */

export const MSG = Object.freeze({
  // Client → Host
  ACTION: 'ACTION',

  // Host → Client
  SYNC_STATE: 'SYNC_STATE',
  EVENT: 'EVENT',
  CHAT: 'CHAT',
  KICKED: 'KICKED',
  HOST_DROPPED: 'HOST_DROPPED',
  HOST_MIGRATED: 'HOST_MIGRATED',
  ERROR: 'ERROR',
  PING: 'PING',
  PONG: 'PONG',
});

// Eylem adları (Client → Host: ACTION.action alanı)
export const ACTION = Object.freeze({
  // Oda Yönetimi
  JOIN_LOBBY: 'JOIN_LOBBY',
  LEAVE_ROOM: 'LEAVE_ROOM',
  ADD_BOT: 'ADD_BOT',
  REMOVE_BOT: 'REMOVE_BOT',
  KICK_PLAYER: 'KICK_PLAYER',
  UPDATE_PROFILE: 'UPDATE_PROFILE',
  UPDATE_PING: 'UPDATE_PING',
  SET_BOT_DIFFICULTY: 'SET_BOT_DIFFICULTY',
  START_GAME: 'START_GAME',
  RESTART_GAME: 'RESTART_GAME',

  // Oyun Mekaniği
  ROLL_DICE: 'ROLL_DICE',
  ROLL_AGAIN: 'ROLL_AGAIN',
  BUY_PROPERTY: 'BUY_PROPERTY',
  DECLINE_BUY: 'DECLINE_BUY',
  END_TURN: 'END_TURN',
  ACKNOWLEDGE_CARD: 'ACKNOWLEDGE_CARD',
  TOGGLE_PAUSE: 'TOGGLE_PAUSE',
  SKIP_BOT_TURN: 'SKIP_BOT_TURN',
  TIMEOUT_TURN: 'TIMEOUT_TURN',
  TIMEOUT_AUCTION: 'TIMEOUT_AUCTION',

  // Mülk İşlemleri
  BUILD_HOUSE: 'BUILD_HOUSE',
  SELL_HOUSE: 'SELL_HOUSE',
  MORTGAGE: 'MORTGAGE',
  UNMORTGAGE: 'UNMORTGAGE',
  AUTO_MORTGAGE: 'AUTO_MORTGAGE',

  // Hapis
  PAY_JAIL_FINE: 'PAY_JAIL_FINE',
  USE_JAIL_CARD: 'USE_JAIL_CARD',

  // Takas
  PROPOSE_TRADE: 'PROPOSE_TRADE',
  RESPOND_TRADE: 'RESPOND_TRADE',
  CANCEL_TRADE: 'CANCEL_TRADE',

  // Hediye & Kredi
  SEND_GIFT: 'SEND_GIFT',
  REQUEST_LOAN: 'REQUEST_LOAN',
  RESPOND_LOAN: 'RESPOND_LOAN',
  PAY_LOAN: 'PAY_LOAN',
  REQUEST_BANK_LOAN: 'REQUEST_BANK_LOAN',

  // Açık Artırma
  START_PLAYER_AUCTION: 'START_PLAYER_AUCTION',
  PLACE_BID: 'PLACE_BID',
  PASS_AUCTION: 'PASS_AUCTION',

  // Sohbet
  SEND_CHAT: 'SEND_CHAT',

  // İflas
  DECLARE_BANKRUPTCY: 'DECLARE_BANKRUPTCY',

  // Dev Tools
  DEV_COMMAND: 'DEV_COMMAND',
});

// ─── Factory Fonksiyonları ────────────────────────────────────────────────────

/**
 * İstemciden Host'a eylem mesajı oluşturur.
 * @param {string} action - ACTION sabitlerinden biri
 * @param {object} payload - Eyleme özgü veri
 * @param {string} senderId - Gönderen oyuncunun peer ID'si
 */
export function createAction(action, payload = {}, senderId = '') {
  return { type: MSG.ACTION, action, payload, senderId };
}

/**
 * Host'tan tüm istemcilere durum senkronizasyonu mesajı oluşturur.
 * @param {object} gameState - MonopolyGame.getPublicState() çıktısı
 */
export function createSyncState(gameState) {
  return { type: MSG.SYNC_STATE, gameState };
}

/**
 * Host'tan istemcilere olay bildirimi mesajı oluşturur.
 * @param {string} event - Olay adı (örn. 'DICE_ROLLED')
 * @param {object} payload - Olaya özgü veri
 */
export function createEvent(event, payload = {}) {
  return { type: MSG.EVENT, event, payload };
}

/**
 * Sohbet mesajı paketi oluşturur (Host tarafından broadcast edilir).
 * @param {object} message - { id, senderName, senderColor, text, time }
 */
export function createChatMessage(message) {
  return { type: MSG.CHAT, message };
}

/**
 * Oyuncu lobiden atılma mesajı.
 * @param {string} reason - Atılma sebebi
 */
export function createKicked(reason = 'Oda kurucusu tarafından atıldınız.') {
  return { type: MSG.KICKED, reason };
}

/**
 * Host bağlantısı kopma bildirimi.
 */
export function createHostDropped() {
  return { type: MSG.HOST_DROPPED };
}

/**
 * Host göçü bildirimi (yeni host seçildi).
 * @param {string} newHostId - Yeni Host'un peer ID'si
 */
export function createHostMigrated(newHostId) {
  return { type: MSG.HOST_MIGRATED, newHostId };
}

/**
 * Hata mesajı oluşturur.
 * @param {string} code - Hata kodu (örn. 'ROOM_NOT_FOUND')
 * @param {string} message - İnsan okunabilir hata mesajı
 */
export function createError(code, message) {
  return { type: MSG.ERROR, code, message };
}

/**
  * Ağ gecikmesi (Ping) ölçüm mesajı.
  * @param {number} t0 - Gönderim zaman damgası
  */
export function createPing(t0 = Date.now()) {
  return { type: MSG.PING, t0 };
}

/**
  * Ağ gecikmesi (Pong) yanıt mesajı.
  * @param {number} t0 - Orijinal ping zaman damgası
  */
export function createPong(t0) {
  return { type: MSG.PONG, t0 };
}
