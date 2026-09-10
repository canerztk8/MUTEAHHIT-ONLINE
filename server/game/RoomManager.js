import { MonopolyGame } from './MonopolyGame.js';

export class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> GameEngine instance
    this.socketToRoom = new Map(); // socketId -> roomCode
    this.roomDeleteTimeouts = new Map(); // roomCode -> NodeJS.Timeout (F5 / kopma toleransı)
  }

  _clearRoomDeleteTimeout(roomCode) {
    if (!roomCode) return;
    const code = roomCode.toUpperCase();
    if (this.roomDeleteTimeouts.has(code)) {
      clearTimeout(this.roomDeleteTimeouts.get(code));
      this.roomDeleteTimeouts.delete(code);
    }
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  createRoom(creatorSocketId = null) {
    if (creatorSocketId) {
      this.leaveRoom(creatorSocketId);
    }
    let code = this.generateRoomCode();
    while (this.rooms.has(code)) {
      code = this.generateRoomCode();
    }
    const game = new MonopolyGame(code);
    this.rooms.set(code, game);
    if (creatorSocketId) {
      this.socketToRoom.set(creatorSocketId, code);
    }
    return game;
  }

  getRoom(roomCode) {
    if (!roomCode) return null;
    return this.rooms.get(roomCode.toUpperCase()) || null;
  }

  getRoomBySocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    return code ? this.getRoom(code) : null;
  }

  joinRoom(roomCode, socketId, playerName, token, color, sessionToken = null) {
    const game = this.getRoom(roomCode);
    if (!game) return { success: false, error: 'Oda bulunamadı.' };

    const currentRoomCode = this.socketToRoom.get(socketId);
    if (currentRoomCode && currentRoomCode !== game.roomCode) {
      this.leaveRoom(socketId);
    }

    this._clearRoomDeleteTimeout(game.roomCode);

    // Eğer sessionToken ile eşleşen mevcut bir oyuncu varsa yeniden bağla!
    if (sessionToken) {
      const existing = game.players.find(p => p.sessionToken === sessionToken);
      if (existing) {
        const rec = game.reconnectPlayer(socketId, sessionToken);
        if (rec.success) {
          this.socketToRoom.set(socketId, game.roomCode);
          return { success: true, player: rec.player, reconnected: true };
        }
      }
    }

    const res = game.addPlayer(socketId, playerName, token, color, false, sessionToken);
    if (res.success) {
      this.socketToRoom.set(socketId, game.roomCode);
    }
    return res;
  }

  reconnect(roomCode, socketId, sessionToken) {
    const game = this.getRoom(roomCode);
    if (!game || !sessionToken) return { success: false, error: 'Oda veya oturum bulunamadı.' };

    this._clearRoomDeleteTimeout(game.roomCode);

    const rec = game.reconnectPlayer(socketId, sessionToken);
    if (rec.success) {
      this.socketToRoom.set(socketId, game.roomCode);
      return { success: true, player: rec.player, roomCode: game.roomCode };
    }
    return { success: false, error: 'Oyuncu bulunamadı.' };
  }

  leaveRoom(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;

    this.socketToRoom.delete(socketId);
    const game = this.getRoom(code);
    if (game) {
      game.removePlayer(socketId);
      
      // Odadaki aktif bağlı insan soketlerini kontrol et
      const activeHumanSockets = Array.from(this.socketToRoom.entries())
        .filter(([sId, rCode]) => rCode === code);

      if (activeHumanSockets.length === 0) {
        if (game.status === 'playing') {
          // Devam eden oyunda F5 veya anlık kopmalarda odayı hemen silme; 90 saniye tolerans tanı!
          if (!this.roomDeleteTimeouts.has(code)) {
            const timer = setTimeout(() => {
              const stillHasSockets = Array.from(this.socketToRoom.values()).some(rCode => rCode === code);
              if (!stillHasSockets) {
                console.log(`[ROOM_CLEANUP] Oda ${code} için yeniden bağlanma süresi doldu, oda kapatılıyor.`);
                this.rooms.delete(code);
              }
              this.roomDeleteTimeouts.delete(code);
            }, 90000);
            this.roomDeleteTimeouts.set(code, timer);
          }
        } else {
          // Lobi aşamasındaysa ve kimse kalmadıysa hemen temizle
          this.rooms.delete(code);
        }
      }
      return game;
    }
    return null;
  }
}
