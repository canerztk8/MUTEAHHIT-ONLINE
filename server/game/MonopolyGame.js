import { randomUUID } from 'crypto';
import { BOARD_TILES, COLOR_GROUPS, CHANCE_CARDS, CHEST_CARDS, PLAYER_TOKENS, PLAYER_COLORS } from './boardData.js';
import { BotAI } from './BotAI.js';
import { rollPhysicalDice } from './physicsDice.js';
import { TradeManager } from './managers/TradeManager.js';

export const TURN_TIMEOUT_SECONDS = 75;
export const AUCTION_FEE = 50; // Her açık artırma başlatıldığında satıcıdan kesilen harç
export const WEALTH_TAX_EXEMPTION = 500; // Servet Vergisi Taban Muafiyeti (Cash Shield): 500₺ ve altı nakit vergiden muaftır

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class MonopolyGame {
  constructor(roomCode) {
    this.roomCode = roomCode;
    this.status = 'lobby'; // 'lobby' | 'playing' | 'ended'
    this.players = [];
    this.currentTurnIndex = 0;
    this.dice = [1, 1];
    this.diceToss = null;
    this.lastDiceRollId = null;
    this.doublesCount = 0;
    this.hasRolledDoubleThisTurn = false;
    this.phase = 'WAITING_ROLL';
    this.canRollAgain = false;
    this.currentTile = null;
    this.pendingTrade = null;
    this.tradeQueue = [];
    this.pendingLoan = null;
    this.activeLoans = [];
    this.drawnCard = null;
    this.lastRentPayment = null;
    this.winner = null;
    this.roundNumber = 1;
    this.auction = null;
    this.lastAuctionResult = null;
    this.lastPropertyAcquired = null;
    this.lastPropertyLoss = null;
    this.lastJailEvent = null;
    this.lastMovement = null;
    this.lastTradeResult = null;
    this.lastLoanResult = null;
    this.eliminations = [];
    this.lastElimination = null;
    this.standings = null;
    this.botTurnInProgress = false;
    this.isPaused = false;
    this.gameStartTime = null;
    this.totalPausedDuration = 0;
    this.logs = [];

    // Oyun Bankası Başlangıç Sermayesi (10.000₺ - Mola alanına dağıtılmaz, banka rezervidir)
    this.bankMoney = 10000;
    this.bankHouses = 32; // Resmi Oyun Kuralı: Toplam 32 Ev
    this.bankHotels = 12; // Resmi Oyun Kuralı: Toplam 12 Otel

    // Dinlenme Tesisi Havuzu (Vergi ve harçlar kasada tutulur)
    this.freeParkingPool = 100;
    this.turnStartTime = Date.now();
    this.turnTimeLimit = TURN_TIMEOUT_SECONDS; // 75 saniye tur süresi

    // Takas durumu ve spam koruması (Aynı oyuncuya 30 saniye cooldown)
    this.tradeCooldowns = {};
    this.tradeQueue = [];
    this.pendingTrade = null;

    // Maç İstatistikleri
    this.stats = {
      rentsCollected: {},
      doublesRolled: {},
      tradesCompleted: 0,
      wealthTaxCollectedSum: 0,
      wealthTaxInstances: 0,
      wealthTaxShieldSaves: 0,
      wealthTaxShieldSavedTL: 0
    };

    // Mülk durumları
    this.properties = {};
    for (const tile of BOARD_TILES) {
      if (['property', 'railroad', 'utility'].includes(tile.type)) {
        this.properties[tile.id] = {
          tileId: tile.id,
          ownerId: null,
          houses: 0,
          mortgaged: false,
          acquiredAt: 0
        };
      }
    }

    this.chanceDeck = shuffle(CHANCE_CARDS);
    this.chestDeck = shuffle(CHEST_CARDS);

    this.tradeManager = new TradeManager(this);
    this.eliminations = [];
    this.lastElimination = null;
    this.standings = null;
  }

  formatGameElapsed(now = Date.now()) {
    if (this.status === 'lobby') {
      return '00:00';
    }
    const startTime = this.gameStartTime || this.turnStartTime || now;
    const currentPaused = (this.isPaused && this.pausedAt) ? Math.max(0, now - this.pausedAt) : 0;
    const totalPaused = (this.totalPausedDuration || 0) + currentPaused;
    const elapsedMs = Math.max(0, now - startTime - totalPaused);
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  addLog(text, type = 'info', meta = null) {
    const now = Date.now();
    const logEntry = {
      id: Math.random().toString(36).substring(2, 9),
      time: this.formatGameElapsed(now),
      timestamp: now,
      text,
      type,
      ...(meta || {})
    };
    this.logs.push(logEntry);
    if (this.logs.length > 50) this.logs.shift();
  }

  adjustPlayerMoney(player, delta, reason) {
    if (!player || delta === 0) return;
    player.money += delta;
    if (!player.moneyHistory) {
      player.moneyHistory = [];
    }
    const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    player.moneyHistory.push({
      delta,
      reason: reason || (delta > 0 ? 'Para girişi' : 'Para çıkışı'),
      time: now,
      balance: player.money,
      timestamp: Date.now()
    });
    if (player.moneyHistory.length > 35) {
      player.moneyHistory.shift();
    }
  }

  addPlayer(id, name, token = null, color = null, isBot = false, sessionToken = null, difficulty = 'orta') {
    if (this.players.length >= 6) return { success: false, error: 'Oda dolu (Maksimum 6 oyuncu).' };
    if (this.status !== 'lobby') return { success: false, error: 'Oyun çoktan başladı.' };

    const usedColors = this.players.map(p => p.color);
    const usedTokens = this.players.map(p => p.token.id);

    const availableColors = PLAYER_COLORS.filter(c => !usedColors.includes(c));
    const availableTokens = PLAYER_TOKENS.filter(t => !usedTokens.includes(t.id));

    const selectedColor = color && !usedColors.includes(color) ? color : (availableColors[0] || PLAYER_COLORS[0]);
    const selectedToken = token && !usedTokens.includes(token.id) ? token : (availableTokens[0] || PLAYER_TOKENS[0]);

    const generatedSessionToken = sessionToken || `st_${randomUUID().replace(/-/g, '')}`;

    // Resmi Oyun Kuralı: Her oyuncu eşit olarak 1500₺ ($1500) ile oyuna başlar.
    const startingMoney = 1500;

    const player = {
      id,
      sessionToken: generatedSessionToken,
      name: name || `Oyuncu ${this.players.length + 1}`,
      token: selectedToken,
      color: selectedColor,
      isBot,
      difficulty: isBot ? (['cok_kolay', 'kolay', 'orta', 'zor', 'imkansiz'].includes(difficulty) ? difficulty : 'orta') : undefined,
      isHost: this.players.length === 0,
      money: startingMoney,
      moneyHistory: [
        {
          delta: startingMoney,
          reason: 'Başlangıç Sermayesi',
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          balance: startingMoney,
          timestamp: Date.now()
        }
      ],
      position: 0,
      lapsCompleted: 0,
      lastAuctionedLap: -1,
      get laps() { return this.lapsCompleted; },
      set laps(v) { this.lapsCompleted = v; },
      inJail: false,
      jailTurns: 0,
      jailCards: 0,
      isBankrupt: false,
      lastCreditorId: null,
      ping: isBot ? 1 : 1
    };

    this.players.push(player);
    this.addLog(`${player.name} odaya katıldı.`, 'info');
    return { success: true, player };
  }

  reconnectPlayer(newSocketId, sessionToken, playerName = null) {
    const player = (sessionToken && this.players.find(p => p.sessionToken === sessionToken))
      || (playerName && this.players.find(p => p.name === playerName && !p.isBot));
    if (!player) return { success: false, error: 'Oturum bulunamadı.' };

    if (sessionToken && !player.sessionToken) {
      player.sessionToken = sessionToken;
    }

    const oldId = player.id;
    player.id = newSocketId;

    // Kopma bildirimini temizle
    if (this.disconnectNotice && (this.disconnectNotice.playerId === oldId || this.disconnectNotice.playerName === player.name)) {
      this.disconnectNotice = null;
    }

    // Mülk sahipliklerini güncelle
    for (const tileId in this.properties) {
      if (this.properties[tileId].ownerId === oldId) {
        this.properties[tileId].ownerId = newSocketId;
      }
    }

    // Aktif borç ve alacakları yeni soket ID'sine aktar (F5 borç silinme hatası düzeltmesi)
    if (this.activeLoans && this.activeLoans.length > 0) {
      for (const loan of this.activeLoans) {
        if (loan.borrowerId === oldId) {
          loan.borrowerId = newSocketId;
        }
        if (loan.lenderId === oldId) {
          loan.lenderId = newSocketId;
        }
      }
    }

    // Bekleyen borç talebini güncelle
    if (this.pendingLoan) {
      if (this.pendingLoan.borrowerId === oldId) this.pendingLoan.borrowerId = newSocketId;
      if (this.pendingLoan.lenderId === oldId) this.pendingLoan.lenderId = newSocketId;
    }

    // Bekleyen takas teklifini güncelle
    if (this.pendingTrade) {
      if (this.pendingTrade.fromPlayerId === oldId) this.pendingTrade.fromPlayerId = newSocketId;
      if (this.pendingTrade.toPlayerId === oldId) this.pendingTrade.toPlayerId = newSocketId;
    }

    // Açık artırma durumunu güncelle
    if (this.auction) {
      if (this.auction.highestBidderId === oldId) {
        this.auction.highestBidderId = newSocketId;
      }
      if (this.auction.sellerId === oldId) {
        this.auction.sellerId = newSocketId;
      }
      if (this.auction.passedPlayerIds) {
        this.auction.passedPlayerIds = this.auction.passedPlayerIds.map(id => (id === oldId ? newSocketId : id));
      }
    }

    // Oyuncu alacaklı referanslarını güncelle
    for (const p of this.players) {
      if (p.lastCreditorId === oldId) {
        p.lastCreditorId = newSocketId;
      }
    }

    // Son kira ödeme bilgisini güncelle
    if (this.lastRentPayment) {
      if (this.lastRentPayment.ownerId === oldId) this.lastRentPayment.ownerId = newSocketId;
      if (this.lastRentPayment.fromPlayerId === oldId) this.lastRentPayment.fromPlayerId = newSocketId;
      if (this.lastRentPayment.toPlayerId === oldId) this.lastRentPayment.toPlayerId = newSocketId;
    }

    // Son tapu kaybı referansını güncelle
    if (this.lastPropertyLoss) {
      if (this.lastPropertyLoss.victimId === oldId) this.lastPropertyLoss.victimId = newSocketId;
      if (this.lastPropertyLoss.instigatorId === oldId) this.lastPropertyLoss.instigatorId = newSocketId;
    }

    // Kazanan referansı güncelle
    if (this.winner && this.winner.id === oldId) {
      this.winner.id = newSocketId;
    }

    // İstatistikleri aktar
    if (this.stats?.rentsCollected && this.stats.rentsCollected[oldId] !== undefined) {
      this.stats.rentsCollected[newSocketId] = (this.stats.rentsCollected[newSocketId] || 0) + this.stats.rentsCollected[oldId];
      delete this.stats.rentsCollected[oldId];
    }
    if (this.stats?.doublesRolled && this.stats.doublesRolled[oldId] !== undefined) {
      this.stats.doublesRolled[newSocketId] = (this.stats.doublesRolled[newSocketId] || 0) + this.stats.doublesRolled[oldId];
      delete this.stats.doublesRolled[oldId];
    }

    this.addLog(`${player.name} oyuna yeniden bağlandı!`, 'info');
    return { success: true, player };
  }

  removePlayer(playerId) {
    const pIndex = this.players.findIndex(p => p.id === playerId);
    if (pIndex === -1) return;

    const removed = this.players[pIndex];
    this.addLog(`${removed.name} oyundan ayrıldı.`, 'info');

    // Eğer lobi aşamasındaysa mülkleri temizle ve çıkart
    if (this.status === 'lobby') {
      const wasHost = removed.isHost;
      this.players.splice(pIndex, 1);

      if (this.players.length > 0 && wasHost) {
        this.players[0].isHost = true;
        this.addLog(`${this.players[0].name} yeni oda yöneticisi oldu.`, 'info');
      }
    } else if (this.status === 'playing') {
      // Oyun sırasında bağlantısı kopup dönmeyen veya atılan oyuncu:
      // Derhal iflas ettir, mülklerini bankaya / ihaleye devret, sırasını devret ve piyonunu kaldır
      if (!removed.isBankrupt) {
        this.declareBankruptcy(playerId);
      }
      removed.isBankrupt = true;
      removed.isKicked = true;
      removed.isDisconnected = true;
    }
  }

  addBot(difficulty = 'orta') {
    if (this.players.length >= 6) return { success: false, error: 'Maksimum 6 oyuncu.' };
    const botNames = ['Zeki Bot', 'Usta Banker', 'Şanslı Robot', 'Emlak Kralı', 'Kurt Yatırımcı', 'Stratejist'];
    const usedNames = this.players.map(p => p.name);
    const availableName = botNames.find(n => !usedNames.includes(n)) || `Bot ${this.players.length + 1}`;
    const botId = 'bot_' + Math.random().toString(36).substring(2, 8);
    const validDiff = ['cok_kolay', 'kolay', 'orta', 'zor', 'imkansiz'].includes(difficulty) ? difficulty : 'orta';
    return this.addPlayer(botId, availableName, null, null, true, null, validDiff);
  }

  setBotDifficulty(botId, difficulty) {
    const bot = this.players.find(p => p.id === botId && p.isBot);
    if (!bot) return { success: false, error: 'Bot bulunamadı.' };
    const validDiff = ['cok_kolay', 'kolay', 'orta', 'zor', 'imkansiz'].includes(difficulty) ? difficulty : 'orta';
    bot.difficulty = validDiff;
    const diffNames = {
      cok_kolay: 'Çok Kolay',
      kolay: 'Kolay',
      orta: 'Orta',
      zor: 'Zor',
      imkansiz: 'İmkansız'
    };
    this.addLog(`🤖 ${bot.name} zorluk seviyesi "${diffNames[validDiff] || validDiff}" olarak ayarlandı.`, 'info');
    return { success: true, bot };
  }

  removeBot(botId = null, requesterId = null) {
    if (requesterId) {
      const requester = this.players.find(p => p.id === requesterId);
      if (requester && !requester.isHost) {
        return { success: false, error: 'Sadece oda kurucusu bot çıkarabilir.' };
      }
    }

    let botIndex = -1;
    if (botId) {
      botIndex = this.players.findIndex(p => p.id === botId && p.isBot);
    } else {
      for (let i = this.players.length - 1; i >= 0; i--) {
        if (this.players[i].isBot) {
          botIndex = i;
          break;
        }
      }
    }

    if (botIndex === -1) {
      return { success: false, error: 'Çıkarılacak bot bulunamadı.' };
    }

    const bot = this.players[botIndex];

    if (this.status === 'lobby') {
      this.players.splice(botIndex, 1);
      this.addLog(`🤖 ${bot.name} lobiden çıkarıldı.`, 'info');
      return { success: true, removedPlayer: bot };
    }

    if (this.status === 'playing') {
      this.addLog(`🤖 ${bot.name} oyundan atıldı.`, 'info');
      bot.lastCreditorId = null;
      this.declareBankruptcy(bot.id);
      return { success: true, removedPlayer: bot };
    }

    return { success: false, error: 'Oyun durumu uygun değil.' };
  }

  updatePlayerProfile(playerId, { name, tokenId, color }) {
    if (this.status !== 'lobby') {
      return { success: false, error: 'Profil yalnızca lobi aşamasında güncellenebilir.' };
    }
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Oyuncu bulunamadı.' };

    if (color) {
      const colorInUse = this.players.some(p => p.id !== playerId && p.color === color);
      if (colorInUse) {
        return { success: false, error: 'Bu renk başka bir oyuncu tarafından seçilmiş!' };
      }
      player.color = color;
    }

    if (tokenId) {
      const tokenInUse = this.players.some(p => p.id !== playerId && p.token?.id === tokenId);
      if (tokenInUse) {
        return { success: false, error: 'Bu piyon başka bir oyuncu tarafından seçilmiş!' };
      }
      const tokenObj = PLAYER_TOKENS.find(t => t.id === tokenId);
      if (tokenObj) {
        player.token = tokenObj;
      }
    }

    if (name && typeof name === 'string') {
      const cleanName = name.trim().slice(0, 20);
      if (cleanName.length > 0) {
        player.name = cleanName;
      }
    }

    return { success: true, player };
  }

  updatePlayerPing(playerId, ping) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.ping = Math.max(1, Math.round(ping));
      return true;
    }
    return false;
  }

  kickPlayer(hostId, targetPlayerId) {
    if (this.status !== 'lobby') {
      return { success: false, error: 'Oyuncular yalnızca lobideyken atılabilir.' };
    }
    const host = this.players.find(p => p.id === hostId);
    if (!host || !host.isHost) {
      return { success: false, error: 'Yalnızca oda kurucusu oyuncu atabilir.' };
    }
    if (hostId === targetPlayerId) {
      return { success: false, error: 'Kendinizi atamazsınız.' };
    }
    const target = this.players.find(p => p.id === targetPlayerId);
    if (!target) {
      return { success: false, error: 'Atılacak oyuncu bulunamadı.' };
    }

    this.removePlayer(targetPlayerId);
    this.addLog(`👢 ${target.name}, oda kurucusu tarafından lobiden atıldı.`, 'info');
    return { success: true, kickedPlayer: target };
  }

  togglePause(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || !player.isHost) {
      return { success: false, error: 'Yalnızca oda kurucusu oyunu duraklatabilir veya devam ettirebilir.' };
    }
    if (this.status !== 'playing') {
      return { success: false, error: 'Sadece devam eden oyun duraklatılabilir.' };
    }

    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.pausedAt = Date.now();
      const elapsed = Math.max(0, this.pausedAt - (this.turnStartTime || this.pausedAt));
      this.pausedRemainingTurnMs = Math.max(0, (this.turnTimeLimit * 1000) - elapsed);
    } else {
      if (this.pausedAt) {
        this.totalPausedDuration = (this.totalPausedDuration || 0) + Math.max(0, Date.now() - this.pausedAt);
      }
      const remainingMs = this.pausedRemainingTurnMs ?? (this.turnTimeLimit * 1000);
      this.turnStartTime = Date.now() - ((this.turnTimeLimit * 1000) - remainingMs);
      this.pausedAt = null;
      this.pausedRemainingTurnMs = null;
    }

    this.addLog(
      this.isPaused
        ? `⏸️ Oyun ${player.name} (Oda Kurucusu) tarafından duraklatıldı.`
        : `▶️ Oyun ${player.name} tarafından devam ettiriliyor.`,
      'info'
    );
    return { success: true, isPaused: this.isPaused };
  }

  startGame(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || !player.isHost) return { success: false, error: 'Sadece oda kurucusu oyunu başlatabilir.' };
    if (this.players.length < 2) return { success: false, error: 'En az 2 oyuncu gereklidir.' };

    this.status = 'playing';
    this.isPaused = false;
    this.gameStartTime = Date.now();
    this.totalPausedDuration = 0;
    // Oyun başladığında zar atma sırası rastgele olsun, ilk hep lobiyi kuran başlamasın
    this.players = shuffle(this.players);
    this.players.forEach((p) => {
      p.money = 1500; // Resmi Oyun Kuralı: 1500₺
    });
    this.currentTurnIndex = 0;
    this.roundNumber = 1;
    this.bankHouses = 32;
    this.bankHotels = 12;
    this.dice = [1, 1];
    this.diceToss = null;
    this.lastDiceRollId = null;
    this.phase = 'WAITING_ROLL';
    this.doublesCount = 0;
    this.hasRolledDoubleThisTurn = false;
    this.canRollAgain = false;
    this.currentTile = null;
    this.drawnCard = null;
    this.auction = null;
    this.freeParkingPool = 100;
    this.turnStartTime = Date.now();
    this.isFirstGameTurn = true;

    // Resmi 16'şar kartlık Şans ve Sandık desteleri
    this.chanceDeck = shuffle(CHANCE_CARDS);
    this.chestDeck = shuffle(CHEST_CARDS);

    this.addLog('Müteahhit oyunu başladı! İlk sıra kurası: ' + this.players[0].name, 'info');
    return { success: true };
  }

  getActivePlayer() {
    return this.players[this.currentTurnIndex];
  }

  rollDice(playerId, customDice = null, customToss = null) {
    if (this.isPaused) return { success: false, error: 'Oyun şu an duraklatılmış durumda.' };
    const active = this.getActivePlayer();
    if (!active || active.id !== playerId) return { success: false, error: 'Senin sıran değil.' };
    if (active.isBankrupt) return { success: false, error: 'İflas etmiş oyuncular zar atamaz.' };
    if (this.phase !== 'WAITING_ROLL') return { success: false, error: 'Şu an zar atamazsın.' };

    let d1, d2;
    let toss = customToss || null;

    if (this.riggedDice && Array.isArray(this.riggedDice) && this.riggedDice.length === 2) {
      d1 = Math.max(1, Math.min(6, parseInt(this.riggedDice[0]) || 1));
      d2 = Math.max(1, Math.min(6, parseInt(this.riggedDice[1]) || 1));
      this.riggedDice = null;
      const rollRes = rollPhysicalDice([d1, d2]);
      toss = rollRes.toss;
    } else if (customDice && Array.isArray(customDice) && customDice.length === 2) {
      const parsed1 = parseInt(customDice[0]);
      const parsed2 = parseInt(customDice[1]);
      if (parsed1 >= 1 && parsed1 <= 6 && parsed2 >= 1 && parsed2 <= 6) {
        d1 = parsed1;
        d2 = parsed2;
      } else {
        d1 = Math.floor(Math.random() * 6) + 1;
        d2 = Math.floor(Math.random() * 6) + 1;
      }
      if (!toss) {
        const rollRes = rollPhysicalDice([d1, d2]);
        toss = rollRes.toss;
      }
    } else {
      const rollRes = rollPhysicalDice();
      d1 = rollRes.dice[0];
      d2 = rollRes.dice[1];
      toss = rollRes.toss;
    }
    this.dice = [d1, d2];
    this.diceToss = toss;
    this.lastDiceRollId = `roll_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const isDoubles = d1 === d2;
    const sum = d1 + d2;

    this.addLog(`${active.name} zar attı: [ ${d1} - ${d2} ] (${sum})`, 'dice');

    if (isDoubles) {
      this.stats.doublesRolled[active.id] = (this.stats.doublesRolled[active.id] || 0) + 1;
    }

    // Maliye Denetimi (Kodes) kontrolü
    if (active.inJail) {
      if (isDoubles) {
        active.inJail = false;
        active.jailTurns = 0;
        this.doublesCount = 0;
        this.canRollAgain = false;
        this.addLog(`${active.name} çift zar atarak (${d1}-${d2}) Maliye Denetimi'nden (Kodes) çıktı!`, 'jail');
        return this.movePlayer(active, sum, false);
      } else {
        active.jailTurns++;
        if (active.jailTurns >= 3) {
          active.inJail = false;
          active.jailTurns = 0;
          this.doublesCount = 0;
          this.canRollAgain = false;
          const fine = 50; // Resmi Oyun Kuralı: 3. turda çıkamayan zorunlu 50₺ öder
          active.money -= fine;
          this.addLog(`${active.name} 3. turda da çift atamadı; Bankaya 50₺ zorunlu ceza ödeyerek tahliye oldu ve zar toplamı (${sum}) kadar ilerliyor.`, 'jail');
          this.checkBankruptcy(active, fine, null);
          return this.movePlayer(active, sum, false);
        } else {
          this.addLog(`🔒 ${active.name} çift atamadı ve Maliye Denetimi'nde kalmaya devam ediyor (${active.jailTurns}/3).`, 'jail');
          this.phase = 'TURN_ACTIONS';
          this.canRollAgain = false;
          return { success: true, dice: this.dice, inJail: true };
        }
      }
    }

    // Normal turda çift atma kuralı: 3 ardışık çift = Kodes (Aşırı Hız Kuralı)
    if (isDoubles) {
      this.doublesCount = (this.doublesCount || 0) + 1;
      if (this.doublesCount >= 3) {
        this.doublesCount = 0;
        this.canRollAgain = false;
        this.sendToJail(active, active.position);
        this.addLog(`🚨 ${active.name} üst üste 3 kez çift attı (Aşırı Hız)! İlerlemeden derhal Maliye Denetimi'ne (Kodes) sevk edildi.`, 'jail');
        return { success: true, dice: this.dice, sentToJail: true, inJail: true };
      } else {
        this.canRollAgain = true;
        this.addLog(`${active.name} çift attı (${this.doublesCount}. kez)! Tur sonunda tekrar zar atacak.`, 'info');
      }
    } else {
      this.doublesCount = 0;
      this.canRollAgain = false;
    }

    return this.movePlayer(active, sum, isDoubles);
  }

  sendToJail(player, fromTileId = 30) {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    this.doublesCount = 0;
    this.hasRolledDoubleThisTurn = false;
    this.canRollAgain = false;
    this.phase = 'TURN_ACTIONS';
    this.currentTile = BOARD_TILES[10];
    this.lastJailEvent = {
      id: Math.random().toString(36).substring(2, 9),
      playerId: player.id,
      fromTileId: fromTileId,
      toTileId: 10,
      timestamp: Date.now()
    };
  }

  payJailFine(playerId) {
    const active = this.getActivePlayer();
    if (!active || active.id !== playerId) return { success: false, error: 'Senin sıran değil.' };
    if (!active.inJail) return { success: false, error: 'Maliye Denetimi\'nde değilsin.' };
    const fine = 50; // Resmi Oyun Kuralı: Sabit 50₺ kefalet bedeli
    if (active.money < fine) return { success: false, error: `Uzlaşma cezası için ${fine}₺ paranız yok.` };

    this.adjustPlayerMoney(active, -fine, 'Kodes kefalet ücreti ödendi');
    active.inJail = false;
    active.jailTurns = 0;
    this.doublesCount = 0;
    this.canRollAgain = false;
    this.addLog(`${active.name} Bankaya ${fine}₺ uzlaşma/kefalet cezası ödeyerek Maliye Denetimi'nden çıktı.`, 'jail');
    return { success: true };
  }

  useJailCard(playerId) {
    const active = this.getActivePlayer();
    if (!active || active.id !== playerId) return { success: false, error: 'Senin sıran değil.' };
    if (!active.inJail) return { success: false, error: 'Maliye Denetimi\'nde değilsin.' };
    if (active.jailCards <= 0) return { success: false, error: 'Vergi Barışı & İmar Affı belgeniz yok.' };

    active.jailCards--;
    active.inJail = false;
    active.jailTurns = 0;
    this.doublesCount = 0;
    this.canRollAgain = false;
    this.addLog(`${active.name} "Vergi Barışı & İmar Affı" belgesini kullanarak denetimden muaf oldu.`, 'jail');
    return { success: true };
  }

  deductLoanGarnishment(player, amount, type = 'gelir', rate = 0.40) {
    return { netAmount: amount, deducted: 0, loanClosed: false };
  }

  handlePassGo(player, lapsPassed = 1) {
    if (lapsPassed <= 0) return;
    player.lapsCompleted = (player.lapsCompleted || 0) + lapsPassed;

    // Resmi Oyun Kuralı: GO'dan her geçişte sabit 200₺ maaş alınır.
    const totalSalary = 200 * lapsPassed;
    this.adjustPlayerMoney(player, totalSalary, 'Başlangıç (GO) Maaşı');
    this.addLog(`${player.name} Başlangıç (GO) noktasından geçti ve ${totalSalary}₺ maaş aldı.`, 'info');
  }

  movePlayer(player, steps, isDoubles = false) {
    const oldPos = player.position;
    const newPos = (oldPos + steps + 40) % 40;

    this.lastMovement = {
      id: Math.random().toString(36).substring(2, 9),
      playerId: player.id,
      from: oldPos,
      to: newPos,
      steps: steps,
      isBackward: steps < 0,
      timestamp: Date.now()
    };

    const lapsPassed = steps > 0 ? Math.floor((oldPos + steps) / 40) : 0;
    if (lapsPassed > 0) {
      this.handlePassGo(player, lapsPassed);
    }

    player.position = newPos;
    const tile = BOARD_TILES[newPos];
    this.currentTile = tile;

    return this.handleTileLanding(player, tile, steps);
  }

  handleTileLanding(player, tile, diceSum) {
    if (tile.type !== 'chance' && tile.type !== 'chest') {
      this.addLog(`${player.name} "${tile.name}" karesine geldi.`, 'info');
    }

    if (tile.type === 'go' || tile.type === 'jail') {
      this.phase = 'TURN_ACTIONS';
      return { success: true, tile };
    }

    // Dinlenme Tesisi (Mola Sahası: Herhangi bir kira/ceza ödenmez)
    if (tile.type === 'parking') {
      this.phase = 'TURN_ACTIONS';
      this.addLog(`${player.name} Dinlenme Tesisi'nde mola verdi ve çay içip dinleniyor.`, 'info');
      return { success: true, tile };
    }

    if (tile.type === 'gotojail') {
      this.addLog(`🚨 ${player.name} Vergi İncelemesine takılarak Maliye Denetimi'ne sevk edildi!`, 'jail');
      this.sendToJail(player, 30);
      return { success: true, tile, sentToJail: true };
    }

    // Vergiler (Bankaya ödenir)
    if (tile.type === 'tax') {
      const amount = tile.amount;
      this.adjustPlayerMoney(player, -amount, `Bankaya ${tile.name} ödendi`);
      player.lastCreditorId = null;
      this.addLog(`${player.name} Bankaya ${amount}₺ ${tile.name} ödedi.`, 'rent');
      this.checkBankruptcy(player, amount, null);
      if (player.isBankrupt) {
        return { success: true, tile, bankrupt: true };
      }
      this.phase = 'TURN_ACTIONS';
      return { success: true, tile };
    }

    // İhale & Fırsat (Şans) & Belediye & İmar (Kamu Fonu)
    if (tile.type === 'chance' || tile.type === 'chest') {
      const deck = tile.type === 'chance' ? this.chanceDeck : this.chestDeck;
      const card = deck.shift();
      deck.push(card);
      this.drawnCard = {
        ...card,
        instanceId: `card_${card.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        deckType: tile.type,
        deckName: tile.name,
        drawerId: player.id,
        drawerName: player.name,
        drawnAt: Date.now(),
        diceSum: diceSum,
        pendingAck: true
      };
      this.phase = 'CARD_DRAWN';
      this.addLog(`${player.name} "${tile.name}" karesine geldi ve kart çekti.`, 'info');
      this.addLog(`📜 ${player.name} "${card.title}" kartını açtı: ${card.desc}`, 'card', { deckType: card.deckType, drawerName: player.name, cardTitle: card.title, cardDesc: card.desc });

      return { success: true, tile, card: this.drawnCard };
    }

    // Satın Alınabilir Mülkler
    if (['property', 'railroad', 'utility'].includes(tile.type)) {
      const propState = this.properties[tile.id];

      if (!propState.ownerId) {
        this.phase = 'TILE_ACTION';
        return { success: true, tile, canBuy: true, cost: tile.cost };
      }

      if (propState.ownerId === player.id) {
        this.phase = 'TURN_ACTIONS';
        this.addLog(`${player.name} kendine ait ${tile.name} mülkünü teftiş ediyor.`, 'info');
        return { success: true, tile };
      }

      const owner = this.players.find(p => p.id === propState.ownerId);
      if (owner && !owner.isBankrupt) {
        if (propState.mortgaged) {
          this.addLog(`${tile.name} ipotekli olduğu için ${player.name} kira ödemedi.`, 'info');
          this.phase = 'TURN_ACTIONS';
          return { success: true, tile };
        }

        const rent = this.calculateRent(tile.id, diceSum);

        this.adjustPlayerMoney(player, -rent, `${owner.name} oyuncusuna kira ödendi (${tile.name})`);
        this.adjustPlayerMoney(owner, rent, `${player.name} oyuncusundan kira tahsil edildi (${tile.name})`);
        player.lastCreditorId = owner.id;

        this.lastRentPayment = {
          id: Math.random().toString(36).substring(2, 9),
          payerId: player.id,
          payerName: player.name,
          payerColor: player.color,
          ownerId: owner.id,
          ownerName: owner.name,
          ownerColor: owner.color,
          amount: rent,
          netAmount: rent,
          garnishedAmount: 0,
          tileId: tile.id,
          tileName: tile.name,
          timestamp: Date.now()
        };

        this.stats.rentsCollected[owner.id] = (this.stats.rentsCollected[owner.id] || 0) + rent;
        this.addLog(`${player.name}, ${owner.name} oyuncusuna ${rent}₺ kira ödedi! (${tile.name})`, 'rent');

        if (rent > 0) {
          this.checkBankruptcy(player, rent, owner.id);
        }
        if (player.isBankrupt) {
          return { success: true, tile, rentPaid: rent, ownerName: owner.name, bankrupt: true };
        }
        this.phase = 'TURN_ACTIONS';
        return { success: true, tile, rentPaid: rent, ownerName: owner.name };
      }
    }

    this.phase = 'TURN_ACTIONS';
    return { success: true, tile };
  }

  // Çekilen Şans / Belediye Kartını Oyuncunun Okuyup "Anladım" Demesiyle Yürüt
  acknowledgeCard(playerId) {
    const active = this.getActivePlayer();
    if (!active || active.id !== playerId) return { success: false, error: 'Senin sıran değil.' };
    if (!this.drawnCard || !this.drawnCard.pendingAck) return { success: false, error: 'Bekleyen kart yok.' };

    const card = this.drawnCard;
    const diceSum = card.diceSum || (this.dice ? this.dice[0] + this.dice[1] : 7);
    this.drawnCard = null;

    this.applyCard(active, card, diceSum);
    return { success: true, card };
  }

  drawChanceCard(player) {
    const target = player || this.getActivePlayer();
    if (!target) return { success: false, error: 'Oyuncu bulunamadı' };
    const card = this.chanceDeck.shift();
    this.chanceDeck.push(card);
    this.drawnCard = {
      ...card,
      instanceId: `card_${card.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      deckType: 'chance',
      deckName: 'İhale & Fırsat',
      drawerId: target.id,
      drawerName: target.name,
      drawnAt: Date.now(),
      diceSum: 7,
      pendingAck: true
    };
    this.phase = 'CARD_DRAWN';
    this.addLog(`${target.name} "İhale & Fırsat" karesine geldi ve kart çekti.`, 'info');
    this.addLog(`📜 ${target.name} "${card.title}" kartını açtı: ${card.desc}`, 'card', { deckType: 'chance', drawerName: target.name, cardTitle: card.title, cardDesc: card.desc });
    return { success: true, card: this.drawnCard };
  }

  drawCommunityCard(player) {
    const target = player || this.getActivePlayer();
    if (!target) return { success: false, error: 'Oyuncu bulunamadı' };
    const card = this.chestDeck.shift();
    this.chestDeck.push(card);
    this.drawnCard = {
      ...card,
      instanceId: `card_${card.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      deckType: 'chest',
      deckName: 'Belediye & İmar',
      drawerId: target.id,
      drawerName: target.name,
      drawnAt: Date.now(),
      diceSum: 7,
      pendingAck: true
    };
    this.phase = 'CARD_DRAWN';
    this.addLog(`${target.name} "Belediye & İmar" karesine geldi ve kart çekti.`, 'info');
    this.addLog(`📜 ${target.name} "${card.title}" kartını açtı: ${card.desc}`, 'card', { deckType: 'chest', drawerName: target.name, cardTitle: card.title, cardDesc: card.desc });
    return { success: true, card: this.drawnCard };
  }

  getGoSalary() {
    // Resmi Oyun Kuralı: GO karesinden geçiş veya inişte sabit 200₺ maaş alınır
    return 200;
  }

  getJailFine() {
    // Resmi Oyun Kuralı: Kodes kefaleti sabit 50₺'dir
    return 50;
  }

  getJailRentRate() {
    // Resmi Oyun Kuralı: Kodesteki oyuncu dışarıdaki tüm mülklerinin kiralarını %100 eksiksiz tahsil eder
    return 1.00;
  }

  getMandatoryJailFine() {
    return 50;
  }

  getWealthTaxExemption() {
    return 0;
  }

  getWealthTaxRate() {
    return 0;
  }

  calculateWealthTax(player) {
    return 0;
  }

  getUtilityMultiplier(count = 2) {
    // Resmi Oyun Kuralı: 1 kamu kuruluşu zarın 4 katı, 2 kamu kuruluşu zarın 10 katı
    return count === 2 ? 10 : 4;
  }

  calculateRent(tileId, diceSum = 7) {
    const tile = BOARD_TILES[tileId];
    const propState = this.properties[tileId];
    if (!propState || !propState.ownerId || propState.mortgaged) return 0;

    const ownerId = propState.ownerId;
    let baseRent = 0;
    const houses = propState.houses || 0;

    if (tile.type === 'property') {
      if (houses > 0) {
        baseRent = tile.rent[houses];
      } else {
        const groupTiles = COLOR_GROUPS[tile.group];
        const ownsAll = groupTiles.every(id => this.properties[id]?.ownerId === ownerId);
        // Resmi Oyun Kuralı: Monopol olan fakat bina dikilmemiş arsalarda kira 2 katıdır
        baseRent = ownsAll ? tile.rent[0] * 2 : tile.rent[0];
      }
    } else if (tile.type === 'railroad') {
      const railroads = COLOR_GROUPS.railroad;
      const count = railroads.filter(id => this.properties[id]?.ownerId === ownerId).length;
      // Resmi Oyun Kuralı: 1 Gar = 25₺, 2 Gar = 50₺, 3 Gar = 100₺, 4 Gar = 200₺
      const railroadRents = [25, 50, 100, 200];
      baseRent = railroadRents[Math.max(0, count - 1)] || 25;
    } else if (tile.type === 'utility') {
      const utilities = COLOR_GROUPS.utility;
      const count = utilities.filter(id => this.properties[id]?.ownerId === ownerId).length;
      const multiplier = this.getUtilityMultiplier(count);
      baseRent = diceSum * multiplier;
    }

    // Resmi Oyun Kuralı: Kiralar tapu senedindeki sabit değerlerdir, enflasyon/kriz çarpanı ve kodes kesintisi yoktur
    return baseRent;
  }

  applyCard(player, card, diceSum) {
    const action = card.action;
    this.phase = 'TURN_ACTIONS';

    switch (action.type) {
      case 'money':
        this.adjustPlayerMoney(player, action.amount, action.amount > 0 ? `Kart Geliri: "${card.title}"` : `Kart Kesintisi: "${card.title}"`);
        if (action.amount > 0) {
          this.addLog(`${player.name} karttan ${action.amount}₺ kazandı.`, 'info');
        } else {
          player.lastCreditorId = null;
          this.checkBankruptcy(player, Math.abs(action.amount), null);
        }
        break;

      case 'jail_free':
        player.jailCards++;
        this.addLog(`📜 ${player.name} bir "Vergi Barışı & İmar Affı Belgesi" kazandı.`, 'card');
        break;

      case 'go_to_jail':
        this.sendToJail(player, player.position);
        break;

      case 'advance_to': {
        const oldPos = player.position;
        const target = action.tileId;
        this.lastMovement = {
          id: Math.random().toString(36).substring(2, 9),
          playerId: player.id,
          from: oldPos,
          to: target,
          steps: (target - oldPos + 40) % 40,
          isBackward: false,
          timestamp: Date.now()
        };
        if (action.collectGo && (target < oldPos || target === 0)) {
          this.handlePassGo(player, 1);
        }
        player.position = target;
        const tile = BOARD_TILES[target];
        this.currentTile = tile;
        this.handleTileLanding(player, tile, diceSum);
        break;
      }

      case 'move_relative': {
        this.movePlayer(player, action.steps, false);
        break;
      }

      case 'advance_nearest_railroad': {
        const oldPos = player.position;
        const railroads = [5, 15, 25, 35];
        let nextRailroad = railroads.find(r => r > player.position);
        if (!nextRailroad) nextRailroad = railroads[0];
        this.lastMovement = {
          id: Math.random().toString(36).substring(2, 9),
          playerId: player.id,
          from: oldPos,
          to: nextRailroad,
          steps: (nextRailroad - oldPos + 40) % 40,
          isBackward: false,
          timestamp: Date.now()
        };
        if (nextRailroad < player.position) {
          this.handlePassGo(player, 1);
        }
        player.position = nextRailroad;
        const tile = BOARD_TILES[nextRailroad];
        this.currentTile = tile;
        const propState = this.properties[nextRailroad];
        if (propState && propState.ownerId && propState.ownerId !== player.id && !propState.mortgaged) {
          const owner = this.players.find(p => p.id === propState.ownerId);
          if (owner && !owner.isBankrupt) {
            // Resmi Oyun Kuralı: Sahibi varsa hak ettiği normal kiranın 2 katı ödenir
            const count = [5, 15, 25, 35].filter(id => this.properties[id]?.ownerId === owner.id).length;
            const railroadRents = [25, 50, 100, 200];
            const normalRent = railroadRents[Math.max(0, count - 1)] || 25;
            const doubleRent = normalRent * 2;
            this.adjustPlayerMoney(player, -doubleRent, `${owner.name} oyuncusuna 2 kat Gar kirası ödendi`);
            this.adjustPlayerMoney(owner, doubleRent, `${player.name} oyuncusundan 2 kat Gar kirası tahsil edildi`);
            player.lastCreditorId = owner.id;
            this.stats.rentsCollected[owner.id] = (this.stats.rentsCollected[owner.id] || 0) + doubleRent;
            this.lastRentPayment = {
              id: Math.random().toString(36).substring(2, 9),
              payerId: player.id,
              payerName: player.name,
              payerColor: player.color,
              ownerId: owner.id,
              ownerName: owner.name,
              ownerColor: owner.color,
              amount: doubleRent,
              netAmount: doubleRent,
              garnishedAmount: 0,
              tileId: nextRailroad,
              tileName: tile.name,
              timestamp: Date.now()
            };
            this.addLog(`🚂 ${player.name}, ${owner.name} oyuncusuna 2 kat Gar kirası (${doubleRent}₺) ödedi!`, 'rent');
            this.checkBankruptcy(player, doubleRent, owner.id);
            this.phase = 'TURN_ACTIONS';
            break;
          }
        }
        this.handleTileLanding(player, tile, diceSum);
        break;
      }

      case 'advance_nearest_utility': {
        const oldPos = player.position;
        const utilities = [12, 28];
        let nextUtil = utilities.find(u => u > player.position);
        if (!nextUtil) nextUtil = utilities[0];
        this.lastMovement = {
          id: Math.random().toString(36).substring(2, 9),
          playerId: player.id,
          from: oldPos,
          to: nextUtil,
          steps: (nextUtil - oldPos + 40) % 40,
          isBackward: false,
          timestamp: Date.now()
        };
        if (nextUtil < player.position) {
          this.handlePassGo(player, 1);
        }
        player.position = nextUtil;
        const tile = BOARD_TILES[nextUtil];
        this.currentTile = tile;
        const propState = this.properties[nextUtil];
        if (propState && propState.ownerId && propState.ownerId !== player.id && !propState.mortgaged) {
          const owner = this.players.find(p => p.id === propState.ownerId);
          if (owner && !owner.isBankrupt) {
            // Resmi Oyun Kuralı: Sahibi varsa zar atılır ve toplamın 10 katı kira ödenir
            const roll1 = Math.floor(Math.random() * 6) + 1;
            const roll2 = Math.floor(Math.random() * 6) + 1;
            const specialSum = roll1 + roll2;
            const utilRent = specialSum * 10;
            this.adjustPlayerMoney(player, -utilRent, `${owner.name} oyuncusuna Tesis kirası ödendi`);
            this.adjustPlayerMoney(owner, utilRent, `${player.name} oyuncusundan Tesis kirası tahsil edildi`);
            player.lastCreditorId = owner.id;
            this.stats.rentsCollected[owner.id] = (this.stats.rentsCollected[owner.id] || 0) + utilRent;
            this.lastRentPayment = {
              id: Math.random().toString(36).substring(2, 9),
              payerId: player.id,
              payerName: player.name,
              payerColor: player.color,
              ownerId: owner.id,
              ownerName: owner.name,
              ownerColor: owner.color,
              amount: utilRent,
              netAmount: utilRent,
              garnishedAmount: 0,
              tileId: nextUtil,
              tileName: tile.name,
              timestamp: Date.now()
            };
            this.addLog(`💡 ${player.name}, Tesis için özel zar attı (${roll1}+${roll2}=${specialSum}) ve 10 katı olan ${utilRent}₺ kirayı ${owner.name} oyuncusuna ödedi!`, 'rent');
            this.checkBankruptcy(player, utilRent, owner.id);
            this.phase = 'TURN_ACTIONS';
            break;
          }
        }
        this.handleTileLanding(player, tile, diceSum);
        break;
      }

      case 'advance_nearest_unowned': {
        let targetId = null;
        for (let step = 1; step <= 40; step++) {
          const checkPos = (player.position + step) % 40;
          const t = BOARD_TILES[checkPos];
          if (t && ['property', 'railroad', 'utility'].includes(t.type)) {
            const prop = this.properties[checkPos];
            if (prop && !prop.ownerId) {
              targetId = checkPos;
              break;
            }
          }
        }

        if (targetId !== null) {
          const oldPos = player.position;
          if (targetId < oldPos) {
            this.handlePassGo(player, 1);
          }
          player.position = targetId;
          const tile = BOARD_TILES[targetId];
          this.currentTile = tile;
          this.addLog(`🚀 ${player.name} en yakın boş tapu olan "${tile.name}" karesine ilerledi!`, 'info');
          this.handleTileLanding(player, tile, diceSum);
        } else {
          // Eğer haritada hiç sahipsiz mülk kalmadıysa
          this.handlePassGo(player, 1);
          player.position = 0;
          this.currentTile = BOARD_TILES[0];
          this.phase = 'TURN_ACTIONS';
        }
        break;
      }

      case 'pay_all': {
        const otherPlayers = this.players.filter(p => p.id !== player.id && !p.isBankrupt);
        const total = action.amount * otherPlayers.length;
        this.adjustPlayerMoney(player, -total, `Tüm oyunculara kart tazminatı ödendi ("${card.title}")`);
        otherPlayers.forEach(p => this.adjustPlayerMoney(p, action.amount, `${player.name} oyuncusundan kart payı alındı`));
        this.addLog(`${player.name} her oyuncuya ${action.amount}₺ ödedi.`, 'rent');
        this.checkBankruptcy(player, total, null);
        break;
      }

      case 'collect_from_all': {
        const others = this.players.filter(p => p.id !== player.id && !p.isBankrupt);
        let totalCollected = 0;
        others.forEach(p => {
          this.adjustPlayerMoney(p, -action.amount, `${player.name} oyuncusuna kart payı ödendi`);
          totalCollected += action.amount;
          this.checkBankruptcy(p, action.amount, player.id);
        });
        this.adjustPlayerMoney(player, totalCollected, `Tüm oyunculardan kart payı toplandı ("${card.title}")`);
        this.addLog(`${player.name} her oyuncudan ${action.amount}₺ (Toplam: ${totalCollected}₺) topladı.`, 'info');
        break;
      }

      case 'repairs': {
        let totalCost = 0;
        for (const tileId in this.properties) {
          const prop = this.properties[tileId];
          if (prop.ownerId === player.id) {
            if (prop.houses === 5) {
              totalCost += action.hotelCost;
            } else if (prop.houses > 0) {
              totalCost += prop.houses * action.houseCost;
            }
          }
        }
        this.adjustPlayerMoney(player, -totalCost, 'Bina bakım ve onarım harcı ödendi');
        this.addLog(`${player.name} bina bakım ve onarımı için ${totalCost}₺ ödedi.`, 'rent');
        this.checkBankruptcy(player, totalCost, null);
        break;
      }
    }
  }

  buyCurrentProperty(playerId) {
    const active = this.getActivePlayer();
    if (!active || active.id !== playerId) return { success: false, error: 'Senin sıran değil.' };
    if (this.phase !== 'TILE_ACTION') return { success: false, error: 'Şu an satın alamazsın.' };

    const tile = this.currentTile;
    if (!tile || !['property', 'railroad', 'utility'].includes(tile.type)) {
      return { success: false, error: 'Bu kare satın alınamaz.' };
    }

    const propState = this.properties[tile.id];
    if (propState.ownerId) return { success: false, error: 'Bu mülk zaten sahipli.' };
    if (active.money < tile.cost) return { success: false, error: 'Yetersiz bakiye!' };

    this.adjustPlayerMoney(active, -tile.cost, `"${tile.name}" mülk satın alma bedeli`);
    propState.ownerId = active.id;
    propState.acquiredAt = Date.now();
    this.phase = 'TURN_ACTIONS';

    this.lastPropertyAcquired = {
      id: Math.random().toString(36).substring(2, 9),
      playerId: active.id,
      playerName: active.name,
      tileId: tile.id,
      tileName: tile.name,
      tileCost: tile.cost,
      tileGroupColor: tile.groupColor || '#475569',
      tileType: tile.type,
      houses: 0,
      timestamp: Date.now()
    };

    this.addLog(`${active.name}, ${tile.cost}₺ karşılığında "${tile.name}" mülkünü satın aldı!`, 'buy');
    return { success: true, tile };
  }

  declineBuy(playerId) {
    const active = this.getActivePlayer();
    if (!active || active.id !== playerId) return { success: false, error: 'Senin sıran değil.' };
    if (this.phase !== 'TILE_ACTION') return { success: false, error: 'Satın alma aşamasında değilsin.' };

    const tile = this.currentTile;
    this.addLog(`${active.name}, "${tile?.name}" mülkünü satın almaktan vazgeçti.`, 'info');

    // Resmi Oyun Kuralı: Satın alınmayan sahipsiz mülk tur şartı olmaksızın derhal açık artırmaya çıkarılır!
    if (tile && ['property', 'railroad', 'utility'].includes(tile.type)) {
      return this.startAuction(tile, 'pass', active);
    }

    this.phase = 'TURN_ACTIONS';
    return { success: true };
  }

  // Açık Artırma Sistemi (Resmi Müzayede Motoru)
  startAuction(tileOrId, reason = 'unbought', initiator = null) {
    const tile = (typeof tileOrId === 'number' || typeof tileOrId === 'string') ? BOARD_TILES[Number(tileOrId)] : tileOrId;
    if (!tile) return { success: false, error: 'Açık artırmaya çıkarılacak mülk bulunamadı.' };
    const propState = this.properties[tile.id];
    if (propState && propState.ownerId && reason !== 'player_auction') {
      return { success: false, error: 'Bu mülk zaten sahipli.' };
    }

    // Resmi Oyun Kuralı: Başlangıç peyi 10₺'dir
    const startingBid = 10;

    // Açık artırmaya girme sebebini ve sahibini belirle
    let reasonText = 'Sahipsiz Mülk Açık Artırması';
    let ownerName = 'Sahipsiz (Banka / Hazine)';
    let ownerColor = '#94a3b8';
    let passedPlayerIds = [];

    if (reason === 'pass') {
      reasonText = 'Pas Geçildi (Satın Alınmadı)';
      // Pas geçen oyuncu da açık artırmaya teklif verebilir
      passedPlayerIds = [];
    } else if (reason === 'bankruptcy') {
      reasonText = initiator ? `İflas Tasfiyesi (${initiator.name})` : 'İflas Tasfiyesi';
      ownerName = initiator ? initiator.name : 'İflas Eden Oyuncu';
      ownerColor = initiator ? initiator.color : '#ef4444';
    } else if (reason === 'player_auction') {
      reasonText = 'Oyuncu Satış İhalesi';
      ownerName = initiator ? initiator.name : 'Mülk Sahibi';
      ownerColor = initiator ? initiator.color : '#3b82f6';
      if (initiator) {
        passedPlayerIds = [initiator.id]; // Satıcı kendi mülküne pey süremez
      }
    }

    this.auction = {
      tileId: tile.id,
      tileName: tile.name,
      tileCost: tile.cost,
      tileGroupColor: tile.groupColor || '#334155',
      tileImage: tile.image || null,
      tileType: tile.type,
      sellerId: (reason === 'player_auction' && initiator) ? initiator.id : null,
      sellerName: (reason === 'player_auction' && initiator) ? initiator.name : null,
      sellerColor: (reason === 'player_auction' && initiator) ? initiator.color : null,
      ownerName,
      ownerColor,
      reason,
      reasonText,
      houses: propState?.houses || 0,
      currentBid: startingBid,
      highestBidderId: null,
      highestBidderName: null,
      highestBidderColor: null,
      passedPlayerIds,
      timer: 15,
      lastBidTime: Date.now()
    };
    this.preAuctionRemainingTurnMs = Math.max(0, (this.turnTimeLimit * 1000) - (Date.now() - (this.turnStartTime || Date.now())));
    this.phase = 'AUCTION';
    this.addLog(`📢 "${tile.name}" açık artırmaya çıkarıldı! (${reasonText}) Başlangıç peyi: ${startingBid}₺.`, 'buy');
    return { success: true, auction: this.auction };
  }

  // Oyuncunun Kendi Tapu Senedini Açık Artırmaya Çıkarması
  startPlayerPropertyAuction(playerId, tileId, startingBid = null) {
    return { success: false, error: 'Resmi kurallarda oyuncu açık artırması yoktur; mülkler sadece doğrudan takas edilebilir veya ipotek edilebilir.' };
  }

  placeBid(playerId, bidAmount) {
    if (this.phase !== 'AUCTION' || !this.auction) {
      return { success: false, error: 'Şu an aktif bir açık artırma yok.' };
    }
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.isBankrupt) {
      return { success: false, error: 'Geçersiz veya elenmiş oyuncu.' };
    }
    if (this.auction.passedPlayerIds.includes(playerId)) {
      return { success: false, error: 'Bu açık artırmada daha önce pas geçtiniz, yeni teklif veremezsiniz.' };
    }

    const amount = Math.floor(Number(bidAmount));
    if (!Number.isFinite(amount) || isNaN(amount) || amount <= this.auction.currentBid) {
      return { success: false, error: `Teklifiniz en son tekliften (${this.auction.currentBid}₺) yüksek olmalıdır.` };
    }
    if (player.money < amount) {
      return { success: false, error: `Yetersiz bakiye! Mevcut nakdiniz: ${player.money}₺.` };
    }

    this.auction.currentBid = amount;
    this.auction.highestBidderId = player.id;
    this.auction.highestBidderName = player.name;
    this.auction.highestBidderColor = player.color;
    this.auction.lastBidTime = Date.now();
    this.auction.timer = 15;

    this.addLog(`🔨 ${player.name}, "${this.auction.tileName}" için ${amount}₺ teklif verdi!`, 'buy');

    // Eğer teklif veren oyuncu hariç diğer tüm oyuncular zaten pas geçmişse, sayacı beklemeden hemen bitir!
    const activeParticipants = this.players.filter(p => !p.isBankrupt);
    const nonPassed = activeParticipants.filter(p => !this.auction.passedPlayerIds.includes(p.id));
    if (nonPassed.length <= 1) {
      return this.endAuction();
    }

    return { success: true, auction: this.auction };
  }

  checkAuctionAffordability() {
    // Kullanıcı talebi: Para yetersizliğinde açık artırma süresi 3 saniyeye düşürülmez, standart geri sayım korunur.
  }

  passAuction(playerId) {
    if (this.phase !== 'AUCTION' || !this.auction) {
      return { success: false, error: 'Aktif açık artırma yok.' };
    }
    if (!this.auction.passedPlayerIds.includes(playerId)) {
      this.auction.passedPlayerIds.push(playerId);
      const player = this.players.find(p => p.id === playerId);
      if (player) {
        this.addLog(`${player.name} açık artırmadan çekildi (Pas geçti).`, 'info');
      }
    }

    // Aktif iflas etmemiş tüm oyuncular
    const activeParticipants = this.players.filter(p => !p.isBankrupt);
    // Pas geçmemiş oyuncular
    const remaining = activeParticipants.filter(p => !this.auction.passedPlayerIds.includes(p.id));

    // Teklif veren hariç herkes pas geçtiyse veya hiç kimse kalmadıysa açık artırmayı derhal sonlandır
    if (remaining.length === 0 || (this.auction.highestBidderId && remaining.length === 1 && remaining[0].id === this.auction.highestBidderId)) {
      return this.endAuction();
    }

    return { success: true, auction: this.auction };
  }

  endAuction() {
    if (!this.auction) return { success: false };
    const auction = this.auction;
    const tile = BOARD_TILES[auction.tileId];
    let resultSummary = null;

    if (auction.highestBidderId) {
      const winner = this.players.find(p => p.id === auction.highestBidderId);
      if (winner && winner.money >= auction.currentBid) {
        this.adjustPlayerMoney(winner, -auction.currentBid, `"${auction.tileName}" açık artırma bedeli`);
        this.properties[auction.tileId].ownerId = winner.id;
        this.properties[auction.tileId].acquiredAt = Date.now();

        // SADECE oyuncu açık artırmasında satış bedeli satıcıya ödenir (pas veya sahipsiz mülk bankaya gider)
        let sellerLogText = '';
        if (auction.reason === 'player_auction' && auction.sellerId) {
          const seller = this.players.find(p => p.id === auction.sellerId);
          if (seller && !seller.isBankrupt) {
            this.adjustPlayerMoney(seller, auction.currentBid, `"${auction.tileName}" açık artırma satış geliri`);
            sellerLogText = ` (Satış bedeli ${seller.name} hesabına aktarıldı)`;
          }
        }

        const stageText = (this.properties[auction.tileId].houses === 5)
          ? ' (Otelli)'
          : (this.properties[auction.tileId].houses > 0 ? ` (${this.properties[auction.tileId].houses} Evli)` : '');

        this.addLog(`🏆 Açık artırma tamamlandı! ${winner.name}, ${auction.currentBid}₺ ödeyerek "${auction.tileName}"${stageText} tapusunun yeni sahibi oldu!${sellerLogText}`, 'buy');

        this.lastPropertyAcquired = {
          id: Math.random().toString(36).substring(2, 9),
          playerId: winner.id,
          playerName: winner.name,
          tileId: auction.tileId,
          tileName: auction.tileName,
          tileCost: auction.currentBid,
          tileGroupColor: tile?.groupColor || '#475569',
          tileType: tile?.type || 'property',
          houses: this.properties[auction.tileId].houses || 0,
          sellerName: auction.sellerName || null,
          isAuction: true,
          timestamp: Date.now()
        };

        resultSummary = {
          tileId: auction.tileId,
          tileName: auction.tileName,
          winnerId: winner.id,
          winnerName: winner.name,
          winnerColor: winner.color,
          amount: auction.currentBid,
          sold: true,
          sellerName: auction.sellerName || null,
          timestamp: Date.now()
        };
      } else {
        const failText = auction.sellerName
          ? `Açık artırma kazananı ödeme yapamadığı için "${auction.tileName}" satılamadı ve sahibi ${auction.sellerName}'de kaldı.`
          : `Açık artırma kazananı ödeme yapamadığı için "${auction.tileName}" sahipsiz kaldı.`;
        this.addLog(failText, 'info');
        resultSummary = {
          tileId: auction.tileId,
          tileName: auction.tileName,
          sold: false,
          reason: 'Kazanan ödeme yapamadı',
          timestamp: Date.now()
        };
      }
    } else {
      const failText = auction.sellerName
        ? `Kimse teklif vermediği için "${auction.tileName}" satılamadı ve sahibi ${auction.sellerName}'de kaldı.`
        : `Kimse teklif vermediği için "${auction.tileName}" sahipsiz kaldı.`;
      this.addLog(failText, 'info');
      resultSummary = {
        tileId: auction.tileId,
        tileName: auction.tileName,
        sold: false,
        reason: 'Kimse teklif vermedi',
        timestamp: Date.now()
      };
    }

    this.lastAuctionResult = resultSummary;
    const wasTimeoutAuction = Boolean(auction.startedByTimeout);
    this.auction = null;

    if (wasTimeoutAuction) {
      // Açık artırma süre aşımı (AFK) nedeniyle başlatılmıştı; ihale bitince tur doğrudan devredilir!
      this.phase = 'WAITING_ROLL';
      this.preAuctionRemainingTurnMs = null;
      this.botTurnInProgress = false;
      this.advanceTurn();
    } else {
      this.phase = 'TURN_ACTIONS';
      const restoredRemaining = Math.max(20000, this.preAuctionRemainingTurnMs || (this.turnTimeLimit * 1000));
      this.turnStartTime = Date.now() - ((this.turnTimeLimit * 1000) - restoredRemaining);
      this.preAuctionRemainingTurnMs = null;
      this.botTurnInProgress = false;
    }

    // State yayınla (broadcastState artık bot tetiklemez)
    if (this.onStateUpdate) {
      this.onStateUpdate();
    }

    // TEK BİR YERDE bot turu tetikle (400ms gecikmeyle)
    const active = this.getActivePlayer();
    if (active && active.isBot && !active.isBankrupt && this.status === 'playing') {
      setTimeout(() => {
        if (this.status === 'playing' && this.getActivePlayer()?.id === active.id) {
          this.triggerBotTurn(this.onStateUpdate);
        }
      }, 400);
    }
    return { success: true, result: resultSummary };
  }

  triggerBotAuction(onUpdateCallback) {
    if (this.phase !== 'AUCTION' || !this.auction || this.auction.botThinking) return;
    const auction = this.auction;

    const activeBots = this.players.filter(
      p => p.isBot && !p.isBankrupt && !auction.passedPlayerIds.includes(p.id) && p.id !== auction.highestBidderId
    );
    if (activeBots.length === 0) return;

    const bot = activeBots[0];
    const difficulty = bot.difficulty || 'orta';
    const tile = BOARD_TILES[auction.tileId];
    const cost = tile?.cost || 100;

    auction.botThinking = true;

    setTimeout(() => {
      if (this.phase !== 'AUCTION' || !this.auction) return;
      this.auction.botThinking = false;
      if (this.auction.passedPlayerIds.includes(bot.id) || this.auction.highestBidderId === bot.id) {
        this.triggerBotAuction(onUpdateCallback);
        return;
      }

      const maxBid = BotAI.evaluateAuctionBid(this, bot, auction, difficulty);
      const increment = Math.max(10, Math.floor(cost * 0.1));
      const nextBid = auction.currentBid + increment;
      const cashBuffer = difficulty === 'imkansiz' ? 20 : 40;

      if (difficulty !== 'cok_kolay' && nextBid <= maxBid && bot.money >= nextBid + cashBuffer) {
        this.placeBid(bot.id, nextBid);
        if (onUpdateCallback) onUpdateCallback();
        setTimeout(() => this.triggerBotAuction(onUpdateCallback), 400);
      } else {
        this.passAuction(bot.id);
        if (onUpdateCallback) onUpdateCallback();
        setTimeout(() => this.triggerBotAuction(onUpdateCallback), 400);
      }
    }, 400);
  }

  // Resmi Kural: Banka kredisi bulunmaz
  requestBankLoan(borrowerId, amount) {
    return { success: false, error: 'Resmi kurallarda banka kredisi çekilemez. Nakit bulmak için evlerinizi satın veya mülklerinizi ipotek edin.' };
  }

  buildHouse(playerId, tileId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Oyuncu bulunamadı.' };

    const tile = BOARD_TILES[tileId];
    if (!tile || tile.type !== 'property') return { success: false, error: 'Buraya inşaat yapılamaz.' };

    const propState = this.properties[tileId];
    if (propState.ownerId !== playerId) return { success: false, error: 'Bu mülk senin değil.' };
    if (propState.mortgaged) return { success: false, error: 'İpotekli mülke inşaat yapılamaz.' };

    const groupTileIds = COLOR_GROUPS[tile.group];
    const ownsAll = groupTileIds.every(id => this.properties[id].ownerId === playerId && !this.properties[id].mortgaged);
    if (!ownsAll) return { success: false, error: 'Önce bu rengin tüm tapularını toplamalısın.' };

    if (propState.houses >= 5) return { success: false, error: 'Bu mülkte zaten Otel var (maksimum inşaat).' };

    const currentHouses = propState.houses;
    const groupHouses = groupTileIds.map(id => this.properties[id].houses);
    const minHouses = Math.min(...groupHouses);
    if (currentHouses > minHouses) {
      return { success: false, error: 'Binaları eşit inşa etmelisiniz. Önce diğer mülklere ev kurmalısınız.' };
    }

    // Resmi Oyun Kuralı: Bankada ev (32) ve otel (12) limitleri
    const willBeHotel = currentHouses === 4;
    if (willBeHotel) {
      if ((this.bankHotels ?? 12) <= 0) {
        return { success: false, error: 'Bankada otel kalmadı (Maksimum 12 otel limitine ulaşıldı).' };
      }
    } else {
      if ((this.bankHouses ?? 32) <= 0) {
        return { success: false, error: 'Bankada ev kalmadı (Maksimum 32 ev limitine ulaşıldı).' };
      }
    }

    const houseCost = tile.houseCost;
    if (player.money < houseCost) {
      return { success: false, error: `Yetersiz bakiye! İnşaat maliyeti: ${houseCost}₺.` };
    }
    if (willBeHotel) {
      this.bankHotels = (this.bankHotels ?? 12) - 1;
      this.bankHouses = (this.bankHouses ?? 0) + 4; // 4 ev bankaya geri döner
      propState.houses = 5;
    } else {
      this.bankHouses = (this.bankHouses ?? 32) - 1;
      propState.houses++;
    }

    const isHotel = propState.houses === 5;
    const stageNames = ['', '1 Ev', '2 Ev', '3 Ev', '4 Ev', 'Otel'];
    const currentStageName = stageNames[propState.houses] || `${propState.houses}. Kademe`;

    this.adjustPlayerMoney(player, -houseCost, willBeHotel ? `"${tile.name}" üzerine otel inşası` : `"${tile.name}" üzerine ${currentStageName} inşası`);

    const msg = isHotel
      ? `🏗️ ${player.name}, "${tile.name}" üzerine bir OTEL inşa etti! (${houseCost}₺)`
      : `🏗️ ${player.name}, "${tile.name}" üzerine ${currentStageName} inşa etti (${houseCost}₺).`;

    this.addLog(msg, 'buy');
    return { success: true, tileId, houses: propState.houses, isHotel, cost: houseCost, stageName: currentStageName };
  }

  // Binaları Bankaya Geri Satma (Sell House / Downgrade)
  sellHouse(playerId, tileId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Oyuncu bulunamadı.' };

    const tile = BOARD_TILES[tileId];
    if (!tile || tile.type !== 'property') return { success: false, error: 'Bu mülkte bina yok.' };

    const propState = this.properties[tileId];
    if (propState.ownerId !== playerId) return { success: false, error: 'Bu mülk sizin değil.' };
    if (propState.houses <= 0) return { success: false, error: 'Bu mülkte satılacak ev/otel yok.' };

    // Eşit yıkım kuralı (En çok evi olandan önce sat)
    const groupTileIds = COLOR_GROUPS[tile.group];
    const groupHouses = groupTileIds.map(id => this.properties[id].houses);
    const maxHouses = Math.max(...groupHouses);
    if (propState.houses < maxHouses) {
      return { success: false, error: 'Binaları eşit satmalısınız. Önce diğer mülklerdeki evleri satın.' };
    }

    const refund = Math.round(tile.houseCost * 0.5); // Resmi Oyun Kuralı: Ev maliyetinin yarısı iade edilir
    let stageDesc = '';

    if (propState.houses === 5) {
      // Otel satışı: Bankaya 1 otel iade edilir, bankadaki ev sayısına göre 4 eve kadar indirilir
      const returnHouses = Math.min(4, this.bankHouses ?? 32);
      this.bankHotels = (this.bankHotels ?? 11) + 1;
      this.bankHouses = (this.bankHouses ?? 32) - returnHouses;
      propState.houses = returnHouses;
      stageDesc = 'Oteli';
    } else {
      this.bankHouses = (this.bankHouses ?? 31) + 1;
      propState.houses--;
      stageDesc = `${propState.houses + 1}. Evi`;
    }

    this.adjustPlayerMoney(player, refund, `"${tile.name}" üzerindeki ${stageDesc} satışı`);
    this.addLog(`🏗️ ${player.name}, "${tile.name}" üzerindeki ${stageDesc} bankaya ${refund}₺ karşılığı geri sattı.`, 'buy');
    return { success: true, tileId, houses: propState.houses, refund };
  }

  mortgageProperty(playerId, tileId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Oyuncu bulunamadı.' };

    const tile = BOARD_TILES[tileId];
    const propState = this.properties[tileId];
    if (!propState || propState.ownerId !== playerId) return { success: false, error: 'Bu mülk senin değil.' };
    if (propState.mortgaged) return { success: false, error: 'Mülk zaten ipotekli.' };

    // Resmi Oyun Kuralı: Bir renk grubundan herhangi bir mülk ipotek edilmeden önce, o renk grubundaki TÜM evler bankaya satılmış olmalıdır!
    if (tile.group && COLOR_GROUPS[tile.group]) {
      const groupTileIds = COLOR_GROUPS[tile.group];
      const hasAnyHouses = groupTileIds.some(id => (this.properties[id]?.houses || 0) > 0);
      if (hasAnyHouses) {
        return { success: false, error: 'Bir mülkü ipotek etmeden önce o renk grubundaki TÜM evleri bankaya satmalısınız.' };
      }
    }

    propState.mortgaged = true;
    this.adjustPlayerMoney(player, tile.mortgage, `"${tile.name}" tapu ipotek geliri`);
    this.addLog(`${player.name}, "${tile.name}" mülkünü ${tile.mortgage}₺ karşılığı ipotek etti.`, 'info');
    return { success: true };
  }

  unmortgageProperty(playerId, tileId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Oyuncu bulunamadı.' };

    const tile = BOARD_TILES[tileId];
    const propState = this.properties[tileId];
    if (!propState || propState.ownerId !== playerId) return { success: false, error: 'Bu mülk senin değil.' };
    if (!propState.mortgaged) return { success: false, error: 'Mülk ipotekli değil.' };

    // Resmi Oyun Kuralı: İpoteği kaldırma bedeli = İpotek Değeri + %10 Faiz
    const cost = Math.round(tile.mortgage * 1.10);
    if (player.money < cost) return { success: false, error: `İpoteği kaldırmak için ${cost}₺ gerekli (%10 faiz dahil).` };

    this.adjustPlayerMoney(player, -cost, `"${tile.name}" ipoteği kaldırma harcı`);
    propState.mortgaged = false;
    this.addLog(`${player.name}, ${cost}₺ ödeyerek "${tile.name}" ipoteğini kaldırdı (%10 banka faizi).`, 'info');
    return { success: true };
  }

  // Negatife Düşen Oyuncu İçin Otomatik İpotek / Kurtarma Motoru
  autoMortgage(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Oyuncu bulunamadı.' };
    if (player.isBankrupt) return { success: false, error: 'İflas etmiş oyuncu işlem yapamaz.' };

    let totalGained = 0;
    const mortgagedTiles = [];

    const playerProps = Object.keys(this.properties)
      .map(id => Number(id))
      .filter(id => this.properties[id]?.ownerId === playerId);

    // Eğer oyuncunun hiç mülkü yoksa ve parası eksideyse derhal iflas etmelidir
    if (playerProps.length === 0 && player.money < 0) {
      this.addLog(`💥 ${player.name} ipotek edecek mülkü veya satılacak binası olmadığından borcunu (${player.money}₺) kapatamadı ve resmi oyun kuralları gereği İFLAS ETTİ!`, 'warning');
      this.declareBankruptcy(playerId);
      return { success: true, totalGained: 0, bankrupt: true, newBalance: player.money };
    }

    // 1. Aşama: Binasız ve ipoteksiz mülkleri ipotekle
    const unmortgagedWithoutHouses = playerProps
      .filter(id => !this.properties[id].mortgaged && (!this.properties[id].houses || this.properties[id].houses === 0))
      .sort((a, b) => (BOARD_TILES[a]?.mortgage || 0) - (BOARD_TILES[b]?.mortgage || 0));

    for (const tileId of unmortgagedWithoutHouses) {
      if (player.money >= 0) break;
      const tile = BOARD_TILES[tileId];
      if (!tile || !tile.mortgage) continue;
      this.properties[tileId].mortgaged = true;
      this.adjustPlayerMoney(player, tile.mortgage, `"${tile.name}" otomatik ipotek bedeli`);
      totalGained += tile.mortgage;
      mortgagedTiles.push(tile.name);
    }

    // 2. Aşama: Eğer hala negatifse ve binalı mülk varsa binaları sat ve sonra ipotekle
    if (player.money < 0) {
      let hasHousesToSell = true;
      while (player.money < 0 && hasHousesToSell) {
        hasHousesToSell = false;
        const withHouses = playerProps.filter(id => (this.properties[id]?.houses || 0) > 0);
        if (withHouses.length === 0) break;

        withHouses.sort((a, b) => (this.properties[b].houses || 0) - (this.properties[a].houses || 0));
        for (const tileId of withHouses) {
          const res = this.sellHouse(playerId, tileId);
          if (res.success) {
            hasHousesToSell = true;
            totalGained += res.refund || 0;
            if (player.money >= 0) break;
          }
        }
      }

      const remainingUnmortgaged = playerProps
        .filter(id => !this.properties[id].mortgaged && (!this.properties[id].houses || this.properties[id].houses === 0))
        .sort((a, b) => (BOARD_TILES[a]?.mortgage || 0) - (BOARD_TILES[b]?.mortgage || 0));

      for (const tileId of remainingUnmortgaged) {
        if (player.money >= 0) break;
        const tile = BOARD_TILES[tileId];
        if (!tile || !tile.mortgage) continue;
        this.properties[tileId].mortgaged = true;
        this.adjustPlayerMoney(player, tile.mortgage, `"${tile.name}" otomatik ipotek bedeli`);
        totalGained += tile.mortgage;
        mortgagedTiles.push(tile.name);
      }
    }

    if (totalGained > 0) {
      this.addLog(`⚡ ${player.name} Otomatik İpotek kullandı: ${mortgagedTiles.length > 0 ? mortgagedTiles.join(', ') + ' ipoteklendi. ' : ''}Toplam +${totalGained}₺ nakit sağlandı (Yeni Bakiye: ${player.money}₺).`, 'info');
    }

    // KRİTİK: Tüm mülkler ipotek edildiği ve binalar satıldığı halde bakiye hala eksideyse, resmi kurallar gereği oyuncu kaçınılmaz olarak İFLAS eder!
    if (player.money < 0) {
      this.addLog(`💥 ${player.name} tüm tapularını ipotek etmesine ve binalarını satmasına rağmen borcunu kapatamadı (${player.money}₺) ve resmi oyun kuralları gereği İFLAS ETTİ!`, 'warning');
      this.declareBankruptcy(playerId);
      return { success: true, totalGained, bankrupt: true, newBalance: player.money };
    }

    if (totalGained > 0) {
      return { success: true, totalGained, mortgagedTiles, newBalance: player.money };
    }

    return { success: false, error: 'İpoteklenecek uygun mülk veya satılacak bina bulunamadı.' };
  }

  proposeTrade(fromPlayerId, tradeData) {
    return this.tradeManager.proposeTrade(fromPlayerId, tradeData);
  }

  sendGift(fromPlayerId, toPlayerId, amount) {
    return this.tradeManager.sendGift(fromPlayerId, toPlayerId, amount);
  }

  respondTrade(playerId, accept) {
    return this.tradeManager.respondTrade(playerId, accept);
  }

  cancelTrade(playerId) {
    return this.tradeManager.cancelTrade(playerId);
  }

  // Resmi Kural: Oyuncular arası borç ve faiz yasaktır
  requestLoan(borrowerId, lenderId, amount) {
    return { success: false, error: 'Resmi kurallarda oyuncular arası borç veya kredi almak yasaktır.' };
  }

  respondLoan(lenderId, accept) {
    this.pendingLoan = null;
    return { success: false, error: 'Borç mekanizması devre dışıdır.' };
  }

  payLoan(borrowerId, loanId) {
    return { success: false, error: 'Aktif borç bulunmamaktadır.' };
  }

  // Süre dolduğunda turu KESİN OLARAK devret (AFK Stuck Bug Fix)
  forceTimeoutTurn(playerId) {
    const active = this.getActivePlayer();
    if (!active || active.id !== playerId) return { success: false };

    // Eğer açık artırma devam ediyorsa açık artırmayı bozma, fakat ihale bitince turun hemen devredileceğini işaretle
    if (this.phase === 'AUCTION') {
      if (this.auction) {
        this.auction.startedByTimeout = true;
      }
      return { success: false, error: 'Açık artırma devam ediyor.' };
    }

    this.addLog(`⏱️ ${active.name} ${this.turnTimeLimit} saniye boyunca hamle yapmadığı için sırası devredildi.`, 'info');

    // Bekleyen kart bildirimini sıfırla
    if (this.phase === 'CARD_DRAWN' || this.drawnCard) {
      this.drawnCard = null;
    }

    // Kodesteki oyuncu için kural gereği zar denenir (çift atıp çıkma veya jailTurns artırma)
    if (active.inJail && this.phase === 'WAITING_ROLL') {
      this.rollDice(active.id);
    }

    if (this.phase === 'TILE_ACTION') {
      this.declineBuy(active.id);
      if (this.phase === 'AUCTION') {
        // Açık artırma başladıysa, açık artırma bitince turun devredileceğini işaretle
        if (this.auction) {
          this.auction.startedByTimeout = true;
        }
        return { success: true };
      }
    }

    // Bekleyen takas veya borç taleplerini temizle
    if (this.pendingTrade && (this.pendingTrade.fromPlayerId === active.id || this.pendingTrade.toPlayerId === active.id)) {
      this.pendingTrade = null;
    }
    if (this.pendingLoan && (this.pendingLoan.borrowerId === active.id || this.pendingLoan.lenderId === active.id)) {
      this.pendingLoan = null;
    }

    // Eğer bakiye eksideyse otomatik tasfiye yap (evleri sat, ipotek et)
    if (active.money < 0) {
      BotAI.liquidateDebt(this, active, 'orta');
      if (active.isBankrupt || this.status === 'ended') {
        return { success: true };
      }
      // Hâlâ eksideyse doğrudan iflas ilan et ve oyundan çıkar
      if (active.money < 0) {
        this.declareBankruptcy(active.id);
        return { success: true };
      }
    }

    this.canRollAgain = false;
    this.hasRolledDoubleThisTurn = false;
    this.phase = 'WAITING_ROLL';
    return this.advanceTurn();
  }

  declareBankruptcy(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Oyuncu bulunamadı.' };

    player.isBankrupt = true;
    this.addLog(`💥 ${player.name} İFLAS ETTİ ve oyundan elendi!`, 'bankrupt');

    // Kalan aktif oyuncu sayısı ve elenme derecesi tespiti
    const activeRemaining = this.players.filter(p => !p.isBankrupt).length;
    const creditor = this.players.find(p => p.id === player.lastCreditorId);
    const eliminationData = {
      id: `elim_${Date.now()}_${player.id}`,
      playerId: player.id,
      name: player.name,
      token: player.token,
      color: player.color,
      rank: activeRemaining + 1,
      round: this.roundNumber || 1,
      debtAmount: Math.abs(player.money || 0),
      creditorId: creditor ? creditor.id : null,
      creditorName: creditor ? creditor.name : null,
      creditorToken: creditor ? creditor.token : null,
      creditorColor: creditor ? creditor.color : null,
      reason: creditor ? `${creditor.name} oyuncusuna borcunu ödeyemedi` : 'Kasa açığını ve borçlarını ödeyemedi',
      timestamp: Date.now()
    };

    if (!this.eliminations) this.eliminations = [];
    this.eliminations.push(eliminationData);
    this.lastElimination = eliminationData;

    // Bekleyen takas veya borç taleplerini temizle
    this.tradeManager?.cancelTrade(playerId);
    if (this.pendingLoan && (this.pendingLoan.borrowerId === playerId || this.pendingLoan.lenderId === playerId)) {
      this.pendingLoan = null;
    }
    this.activeLoans = this.activeLoans.filter(l => l.borrowerId !== playerId && l.lenderId !== playerId);

    const releasedProps = [];
    for (const tileId in this.properties) {
      const prop = this.properties[tileId];
      if (prop.ownerId === player.id) {
        if (creditor && !creditor.isBankrupt) {
          prop.ownerId = creditor.id;
          if (prop.mortgaged) {
            const fee = Math.round((BOARD_TILES[tileId]?.mortgage || 50) * 0.10);
            if (creditor.money >= fee) {
              creditor.money -= fee;
              this.addLog(`🏛️ ${creditor.name}, iflas eden ${player.name} oyuncusundan devraldığı ipotekli "${BOARD_TILES[tileId]?.name || 'Mülk'}" için Bankaya %10 devir faizi (${fee}₺) ödedi.`, 'rent');
            }
          }
        } else {
          prop.ownerId = null;
          prop.houses = 0;
          prop.mortgaged = false;
          releasedProps.push(BOARD_TILES[tileId]);
        }
      }
    }

    if (releasedProps.length > 0) {
      this.addLog(`📢 ${player.name} oyuncusunun iflasıyla sahipsiz kalan ${releasedProps.length} tapu banka yerine açık artırmaya açıldı!`, 'buy');
      if (!this.auction && this.phase !== 'AUCTION') {
        // En değerli tapuyu derhal açık artırmaya çıkar
        releasedProps.sort((a, b) => (b.cost || 0) - (a.cost || 0));
        this.startAuction(releasedProps[0], 'bankruptcy', player);
      }
    }

    const winner = this.checkWinner();

    if (!winner) {
      if (this.getActivePlayer()?.id === playerId) {
        this.advanceTurn();
      }
    } else {
      const winIdx = this.players.findIndex(p => p.id === winner.id);
      if (winIdx !== -1) {
        this.currentTurnIndex = winIdx;
      }
    }

    return { success: true };
  }

  endTurn(playerId) {
    const active = this.getActivePlayer();
    if (!active || active.id !== playerId) return { success: false, error: 'Senin sıran değil.' };
    if (this.phase === 'WAITING_ROLL') return { success: false, error: 'Önce zar atmalısın.' };
    if (this.phase === 'TILE_ACTION') return { success: false, error: 'Önce kareden çıkmalı ya da mülkü alıp/reddetmelisin.' };
    if (this.phase === 'AUCTION') return { success: false, error: 'Açık artırma devam ederken tur bitirilemez.' };

    if (active.money < 0) {
      return {
        success: false,
        error: `Bakiyeniz eksi (${active.money}₺)! Mülklerinizi ipotek ederek nakit bulun ya da "İflas Et" butonuna basarak elenin.`
      };
    }

    if (this.canRollAgain && !active.inJail && !active.isBankrupt) {
      this.phase = 'WAITING_ROLL';
      this.canRollAgain = false;
      this.drawnCard = null;
      this.turnStartTime = Date.now();
      this.addLog(`${active.name} çift attığı için 1 kez daha zar atacak.`, 'info');
      return { success: true, nextPlayer: active };
    }

    return this.advanceTurn();
  }

  hasCappedLoan(playerId) {
    return null;
  }

  executeLoanForeclosure(player, loan) {
    // Resmi oyun kurallarında icra ve maaş haczi yoktur
  }

  applyCompoundInterest(targetPlayer = null) {
    // Resmi oyun kurallarında faiz veya borç mekanizması yoktur
  }

  advanceTurn() {
    if (this.status === 'ended') return { success: false, error: 'Oyun sona erdi.' };

    this.doublesCount = 0;
    this.hasRolledDoubleThisTurn = false;
    this.canRollAgain = false;
    this.drawnCard = null;
    this.auction = null;

    let nextIndex = (this.currentTurnIndex + 1) % this.players.length;
    let attempts = 0;
    while (this.players[nextIndex].isBankrupt && attempts < this.players.length) {
      nextIndex = (nextIndex + 1) % this.players.length;
      attempts++;
    }

    if (nextIndex <= this.currentTurnIndex) {
      this.roundNumber = (this.roundNumber || 1) + 1;
      this.addLog(`🔄 ${this.roundNumber}. Tur Başladı!`, 'info');
    }

    this.currentTurnIndex = nextIndex;
    this.phase = 'WAITING_ROLL';
    this.turnStartTime = Date.now();

    const nextPlayer = this.getActivePlayer();
    this.addLog(`Sıra ${nextPlayer.name} oyuncusuna geçti.`, 'info');

    this.checkWinner();
    return { success: true, nextPlayer };
  }

  checkBankruptcy(player, debtAmount, creditorId) {
    if (player.money >= 0) return false;

    let maxLiquidity = player.money;
    for (const tileId in this.properties) {
      const prop = this.properties[tileId];
      if (prop.ownerId === player.id) {
        if (prop.houses > 0) {
          maxLiquidity += prop.houses * Math.round(BOARD_TILES[tileId].houseCost * 0.5);
        }
        if (!prop.mortgaged) {
          maxLiquidity += BOARD_TILES[tileId].mortgage;
        }
      }
    }

    if (maxLiquidity < 0) {
      return this.declareBankruptcy(player.id);
    }

    return false;
  }

  computeStandings(winner) {
    if (!winner) return null;
    const standings = [];

    const winnerOwnedProps = Object.values(this.properties || {}).filter(p => p.ownerId === winner.id);
    let winnerPropertyValuation = 0;
    for (const prop of winnerOwnedProps) {
      const tile = BOARD_TILES[prop.tileId];
      winnerPropertyValuation += (tile?.cost || 0) + (prop.houses || 0) * (tile?.houseCost || 0);
    }
    standings.push({
      rank: 1,
      playerId: winner.id,
      name: winner.name,
      token: winner.token,
      color: winner.color,
      isWinner: true,
      money: winner.money,
      netWorth: winner.money + winnerPropertyValuation,
      propertyCount: winnerOwnedProps.length,
      eliminatedRound: null,
      reason: 'Şampiyon'
    });

    const reversedElims = [...(this.eliminations || [])].reverse();
    reversedElims.forEach((elim, idx) => {
      standings.push({
        rank: idx + 2,
        playerId: elim.playerId,
        name: elim.name,
        token: elim.token,
        color: elim.color,
        isWinner: false,
        money: 0,
        netWorth: 0,
        propertyCount: 0,
        eliminatedRound: elim.round,
        creditorName: elim.creditorName,
        creditorToken: elim.creditorToken,
        reason: elim.reason
      });
    });

    const existingIds = new Set(standings.map(s => s.playerId));
    this.players.forEach(p => {
      if (!existingIds.has(p.id)) {
        standings.push({
          rank: standings.length + 1,
          playerId: p.id,
          name: p.name,
          token: p.token,
          color: p.color,
          isWinner: false,
          money: p.money,
          netWorth: p.money,
          propertyCount: 0,
          eliminatedRound: this.roundNumber || 1,
          reason: 'Elendi'
        });
      }
    });

    this.standings = standings;
    return standings;
  }

  checkWinner() {
    const activePlayers = this.players.filter(p => !p.isBankrupt);
    if (activePlayers.length === 1 && this.players.length > 1) {
      this.winner = activePlayers[0];
      this.status = 'ended';
      this.phase = 'GAME_OVER';
      this.computeStandings(this.winner);
      this.addLog(`🏆 OYUN BİTTİ! KAZANAN: ${this.winner.name}! Tebrikler! 🎉`, 'winner');
      return this.winner;
    }
    return null;
  }

  // Akıllı Bot hamlesi (Zorluk Seviyeleri: cok_kolay, kolay, orta, zor, imkansiz)
  triggerBotTurn(onUpdateCallback) {
    const active = this.getActivePlayer();
    if (!active || !active.isBot || this.status !== 'playing') {
      this.botTurnInProgress = false;
      return;
    }
    if (this.botTurnInProgress) return;
    this.botTurnInProgress = true;
    const diff = active.difficulty || 'orta';

    // Unique turn ID — stale setTimeout zincirlerini tespit etmek için
    const turnId = `${active.id}_${Date.now()}`;
    this.currentBotTurnId = turnId;
    const isStale = () => this.currentBotTurnId !== turnId || this.status !== 'playing' || this.getActivePlayer()?.id !== active.id;

    // Açık artırmadan sonra veya zaten zar atılmış durumda doğrudan turu tamamlama adımına geç
    if (this.phase === 'TURN_ACTIONS') {
      if (BotAI.liquidateDebt(this, active, diff)) {
        this.botTurnInProgress = false;
        if (onUpdateCallback) onUpdateCallback();
        else if (this.onStateUpdate) this.onStateUpdate();
        const next = this.getActivePlayer();
        if (next && next.isBot && this.status === 'playing') {
          setTimeout(() => {
            if (this.status === 'playing' && this.getActivePlayer()?.id === next.id) {
              this.triggerBotTurn(onUpdateCallback || this.onStateUpdate);
            }
          }, 400);
        }
        return;
      }
      setTimeout(() => {
        if (isStale()) {
          this.botTurnInProgress = false;
          return;
        }
        this.finishBotTurn(active, diff, onUpdateCallback);
      }, 400);
      return;
    }

    // Oyun yeni başladığında istemcilerin 3D tahta ve zar tablasını yükleyip monte etmesi için
    // ilk bot sırasına 3200ms gecikme ver (oyun açılmadan botun aniden fırlamasını engelle)
    const initialDelay = this.isFirstGameTurn ? 3200 : 500;
    if (this.isFirstGameTurn) {
      this.isFirstGameTurn = false;
      this.turnStartTime = Date.now() + 3000;
      if (onUpdateCallback) onUpdateCallback();
      else if (this.onStateUpdate) this.onStateUpdate();
    }

    setTimeout(() => {
      if (isStale()) {
        this.botTurnInProgress = false;
        return;
      }

      // Borç durumunu tasfiye et
      if (BotAI.liquidateDebt(this, active, diff)) {
        this.botTurnInProgress = false;
        if (onUpdateCallback) onUpdateCallback();
        else if (this.onStateUpdate) this.onStateUpdate();
        const next = this.getActivePlayer();
        if (next && next.isBot && this.status === 'playing') {
          setTimeout(() => {
            if (this.status === 'playing' && this.getActivePlayer()?.id === next.id) {
              this.triggerBotTurn(onUpdateCallback || this.onStateUpdate);
            }
          }, 400);
        }
        return;
      }

      BotAI.handleJailDecision(this, active, diff);

      if (this.phase === 'WAITING_ROLL') {
        this.rollDice(active.id);
        if (onUpdateCallback) onUpdateCallback();
        else if (this.onStateUpdate) this.onStateUpdate();
      }

      // Zarın masada durulması (~2200ms) + piyonun kare kare adımlaması (adım x 140ms) + varış beklemesi (750ms)
      const diceSum = (this.dice[0] || 1) + (this.dice[1] || 1);
      const stepTravelDuration = 2300 + (diceSum * 140) + 750;

      setTimeout(() => {
        if (isStale()) {
          this.botTurnInProgress = false;
          return;
        }

        if (this.phase === 'CARD_DRAWN') {
          // İnsan oyuncuların çekilen kartı okuyabilmesi için 2800ms bekle, ardından onayla
          setTimeout(() => {
            if (isStale()) {
              this.botTurnInProgress = false;
              return;
            }
            if (this.phase === 'CARD_DRAWN') {
              this.acknowledgeCard(active.id);
              if (onUpdateCallback) onUpdateCallback();
              else if (this.onStateUpdate) this.onStateUpdate();
            }

            // Kart hamlesi sonrası turu tamamlama (1200ms dinlenme)
            setTimeout(() => {
              if (isStale()) {
                this.botTurnInProgress = false;
                return;
              }
              if (this.phase === 'AUCTION') {
                this.botTurnInProgress = false;
                return;
              }
              this.finishBotTurn(active, diff, onUpdateCallback);
            }, 1200);
          }, 2800);
          return;
        }

        if (this.phase === 'TILE_ACTION') {
          // Piyonun kareye oturduğunu oyuncuların görmesi ve botun değerlendirmesi için 1100ms bekle
          setTimeout(() => {
            if (isStale()) {
              this.botTurnInProgress = false;
              return;
            }
            if (this.phase === 'TILE_ACTION') {
              const tile = this.currentTile;
              const shouldBuy = BotAI.shouldBuyProperty(this, active, tile, diff);

              if (shouldBuy && active.money >= (tile?.cost || 0)) {
                const buyRes = this.buyCurrentProperty(active.id);
                if (!buyRes.success) {
                  this.declineBuy(active.id);
                }
              } else {
                this.declineBuy(active.id);
              }
              if (onUpdateCallback) onUpdateCallback();
              else if (this.onStateUpdate) this.onStateUpdate();
            }

            // Mülk kararı sonrası turu tamamlama (1200ms dinlenme)
            setTimeout(() => {
              if (isStale()) {
                this.botTurnInProgress = false;
                return;
              }
              if (this.phase === 'AUCTION') {
                this.botTurnInProgress = false;
                return;
              }
              this.finishBotTurn(active, diff, onUpdateCallback);
            }, 1200);
          }, 1100);
          return;
        }

        // Kira, vergi veya mola karesinde piyonun varışını ve bildirimlerin görülmesini bekleme (1200ms)
        setTimeout(() => {
          if (isStale()) {
            this.botTurnInProgress = false;
            return;
          }
          if (this.phase === 'AUCTION') {
            this.botTurnInProgress = false;
            return;
          }

          this.finishBotTurn(active, diff, onUpdateCallback);
        }, 1200);
      }, stepTravelDuration);
    }, initialDelay);
  }

  finishBotTurn(active, diff, onUpdateCallback) {
    if (!active || !active.isBot || this.status !== 'playing') {
      this.botTurnInProgress = false;
      return;
    }

    // Bekleyen kart varsa onayla
    if (this.phase === 'CARD_DRAWN') {
      this.acknowledgeCard(active.id);
    }

    // 1. Borç durumunu mutlaka tasfiye et (borç kapanmazsa iflas ettir)
    if (active.money < 0) {
      if (BotAI.liquidateDebt(this, active, diff)) {
        this.botTurnInProgress = false;
        if (onUpdateCallback) onUpdateCallback();
        else if (this.onStateUpdate) this.onStateUpdate();
        const next = this.getActivePlayer();
        if (next && next.isBot && this.status === 'playing') {
          setTimeout(() => {
            if (this.status === 'playing' && this.getActivePlayer()?.id === next.id) {
              this.triggerBotTurn(onUpdateCallback || this.onStateUpdate);
            }
          }, 1100);
        }
        return;
      }
    }

    // 2. Kalan aşama TILE_ACTION ise güvenle pas geç
    if (this.phase === 'TILE_ACTION') {
      this.declineBuy(active.id);
    }

    // 3. Zorluk seviyesine göre bina inşası (sadece parası artıdaysa)
    if (active.money > 0) {
      BotAI.buildHouses(this, active, diff);
    }

    this.botTurnInProgress = false;

    // 4. Turu bitir (çift zar atıldıysa endTurn otomatik olarak WAITING_ROLL yapar ve aynı oyuncuda bırakır)
    const endRes = this.endTurn(active.id);
    if (!endRes || !endRes.success) {
      console.warn(`[BOT] endTurn failed for ${active.name}: ${endRes?.error}. Forcing advanceTurn.`);
      this.advanceTurn();
    }

    // 5. State yayınla
    if (onUpdateCallback) onUpdateCallback();
    else if (this.onStateUpdate) this.onStateUpdate();

    // 6. Sıradaki oyuncu da botsa (veya çift zarla tekrar aynı bot atacaksa) tetikle
    const next = this.getActivePlayer();
    if (next && next.isBot && this.status === 'playing') {
      setTimeout(() => {
        if (this.status === 'playing' && this.getActivePlayer()?.id === next.id) {
          this.triggerBotTurn(onUpdateCallback || this.onStateUpdate);
        }
      }, 1100);
    }
  }

  // Bot Turunu Hızlı Atla (Animasyonsuz, Anında İşletip Sıradakine Geç)
  fastForwardBotTurn(onUpdateCallback) {
    const active = this.getActivePlayer();
    if (!active || !active.isBot || this.status !== 'playing') {
      return { success: false, error: 'Sıra bir botta değil.' };
    }

    // Devam eden setTimeout zincirini geçersiz kıl
    this.currentBotTurnId = `skip_${Date.now()}`;
    this.botTurnInProgress = false;
    const diff = active.difficulty || 'orta';

    // 1. Borç durumunu çöz
    if (BotAI.liquidateDebt(this, active, diff)) {
      if (onUpdateCallback) onUpdateCallback();
      else if (this.onStateUpdate) this.onStateUpdate();
      return { success: true };
    }

    // 2. Kodes durumu
    BotAI.handleJailDecision(this, active, diff);

    // 3. Zar atışı
    if (this.phase === 'WAITING_ROLL') {
      this.rollDice(active.id);
    }

    if (this.phase === 'CARD_DRAWN') {
      this.acknowledgeCard(active.id);
    }

    // 4. Mülk eylemi
    if (this.phase === 'TILE_ACTION') {
      const tile = this.currentTile;
      const shouldBuy = BotAI.shouldBuyProperty(this, active, tile, diff);

      if (shouldBuy && active.money >= (tile?.cost || 0)) {
        const buyRes = this.buyCurrentProperty(active.id);
        if (!buyRes.success) {
          this.declineBuy(active.id);
        }
      } else {
        this.declineBuy(active.id);
      }
    }

    // 5. Açık artırma başladıysa durdur ve bekle
    if (this.phase === 'AUCTION') {
      if (onUpdateCallback) onUpdateCallback();
      else if (this.onStateUpdate) this.onStateUpdate();
      return { success: true };
    }

    // 6. Turu hemen bitir
    this.canRollAgain = false;
    this.hasRolledDoubleThisTurn = false;
    this.finishBotTurn(active, diff, onUpdateCallback);
    return { success: true };
  }

  // Botun Takas Tekliflerini Hızlıca Değerlendirmesi
  evaluateBotTrade(botId) {
    if (!this.pendingTrade || this.pendingTrade.toPlayerId !== botId) {
      return { success: false, error: 'Bota ait bekleyen takas yok.' };
    }
    const bot = this.players.find(p => p.id === botId && p.isBot);
    if (!bot || bot.isBankrupt) {
      return this.respondTrade(botId, false);
    }

    const accept = BotAI.evaluateTrade(this, bot, this.pendingTrade);
    return this.respondTrade(botId, accept);
  }

  resetGameToLobby(requesterId = null) {
    this.status = 'lobby';
    this.gameStartTime = null;
    this.totalPausedDuration = 0;
    this.pausedAt = null;
    this.winner = null;
    this.currentTurnIndex = 0;
    this.dice = [1, 1];
    this.doublesCount = 0;
    this.hasRolledDoubleThisTurn = false;
    this.phase = 'WAITING_ROLL';
    this.canRollAgain = false;
    this.currentTile = null;
    this.pendingTrade = null;
    this.pendingLoan = null;
    this.activeLoans = [];
    this.drawnCard = null;
    this.lastRentPayment = null;
    this.lastPropertyAcquired = null;
    this.lastPropertyLoss = null;
    this.lastJailEvent = null;
    this.lastTradeResult = null;
    this.lastLoanResult = null;
    this.roundNumber = 1;
    this.auction = null;
    this.lastAuctionResult = null;
    this.eliminations = [];
    this.lastElimination = null;
    this.standings = null;
    this.botTurnInProgress = false;
    this.bankMoney = 10000;
    this.tradeCooldowns = {};
    this.freeParkingPool = 100;
    this.turnStartTime = Date.now();
    this.stats = {
      rentsCollected: {},
      doublesRolled: {},
      tradesCompleted: 0,
      wealthTaxCollectedSum: 0,
      wealthTaxInstances: 0,
      wealthTaxShieldSaves: 0,
      wealthTaxShieldSavedTL: 0
    };

    // Tüm mülkleri sahipsiz hale getir
    for (const tile of BOARD_TILES) {
      if (['property', 'railroad', 'utility'].includes(tile.type)) {
        this.properties[tile.id] = {
          tileId: tile.id,
          ownerId: null,
          houses: 0,
          mortgaged: false
        };
      }
    }

    this.pendingTrade = null;
    this.tradeQueue = [];
    this.tradeCooldowns = {};

    this.chanceDeck = shuffle(CHANCE_CARDS);
    this.chestDeck = shuffle(CHEST_CARDS);

    // Tüm oyuncuları başlangıç durumuna getir
    this.players.forEach((p) => {
      p.money = 1500; // Resmi Oyun Kuralı: Eşit 1500₺ başlangıç parası
      p.position = 0;
      p.lapsCompleted = 0;
      p.lastAuctionedLap = -1;
      p.inJail = false;
      p.jailTurns = 0;
      p.jailCards = 0;
      p.isBankrupt = false;
      p.bankLoan = null;
      p.lastCreditorId = null;
    });
    this.bankHouses = 32;
    this.bankHotels = 12;

    // Oda Lideri Garanti Düzeltmesi (Bot asla oda lideri olamaz, mutlaka geçerli bir insan lider olmalı)
    const activeHumanHost = this.players.find(p => p.isHost && !p.isBot);
    if (!activeHumanHost) {
      this.players.forEach(p => { p.isHost = false; });
      const requester = requesterId ? this.players.find(p => p.id === requesterId && !p.isBot) : null;
      if (requester) {
        requester.isHost = true;
      } else {
        const firstHuman = this.players.find(p => !p.isBot);
        if (firstHuman) {
          firstHuman.isHost = true;
        } else if (this.players.length > 0) {
          this.players[0].isHost = true;
        }
      }
    }

    this.addLog('🔄 Oyun sıfırlandı ve yeni maç için lobiye dönüldü.', 'info');
    return { success: true };
  }

  getPublicState() {
    const round = this.roundNumber || 1;
    const sanitizedPlayers = this.players.map(({ sessionToken, ...safeProps }) => safeProps);
    const active = this.getActivePlayer();
    const sanitizedActive = active ? (({ sessionToken, ...safeProps }) => safeProps)(active) : null;

    return {
      roomCode: this.roomCode,
      status: this.status,
      gameStartTime: this.gameStartTime || (this.status === 'playing' ? (this.turnStartTime || Date.now()) : null),
      totalPausedDuration: this.totalPausedDuration || 0,
      isPaused: Boolean(this.isPaused),
      pausedAt: this.pausedAt || null,
      pausedRemainingTurnMs: this.pausedRemainingTurnMs || null,
      roundNumber: round,
      isInflationMode: false,
      isCrisisMode: false,
      isApocalypseMode: false,
      isHyperinflationMode: false,
      isNationalCrisisMode: false,
      isBankruptBank: false,
      bankMoney: this.bankMoney !== undefined ? this.bankMoney : 10000,
      bankHouses: this.bankHouses ?? 32,
      bankHotels: this.bankHotels ?? 12,
      wealthTaxRate: 0,
      wealthTaxExemption: 0,
      utilityMultipliers: {
        single: 4,
        both: 10
      },
      rentMultiplier: 1.0,
      goSalary: 200,
      jailFine: 50,
      jailRentRate: 1.0,
      mandatoryJailFine: 50,
      players: sanitizedPlayers,
      currentTurnIndex: this.currentTurnIndex,
      activePlayer: sanitizedActive,
      dice: this.dice,
      diceToss: this.diceToss,
      lastDiceRollId: this.lastDiceRollId,
      phase: this.phase,
      canRollAgain: this.canRollAgain,
      currentTile: this.currentTile,
      properties: this.properties,
      auction: this.auction,
      lastAuctionResult: this.lastAuctionResult,
      lastPropertyAcquired: this.lastPropertyAcquired,
      lastPropertyLoss: this.lastPropertyLoss,
      lastJailEvent: this.lastJailEvent,
      lastMovement: this.lastMovement,
      lastTradeResult: this.lastTradeResult,
      lastLoanResult: this.lastLoanResult,
      pendingTrade: this.pendingTrade,
      tradeQueue: (this.tradeManager?.tradeQueue || this.tradeQueue || []).map(t => ({
        id: t.id,
        fromPlayerId: t.fromPlayerId,
        fromPlayerName: t.fromPlayerName,
        toPlayerId: t.toPlayerId,
        toPlayerName: t.toPlayerName
      })),
      tradeCooldowns: this.tradeCooldowns || {},
      pendingLoan: this.pendingLoan,
      activeLoans: this.activeLoans,
      drawnCard: this.drawnCard,
      lastRentPayment: this.lastRentPayment,
      winner: this.winner,
      eliminations: this.eliminations,
      lastElimination: this.lastElimination,
      standings: this.standings,
      logs: this.logs,
      freeParkingPool: this.freeParkingPool,
      turnStartTime: this.turnStartTime,
      turnTimeLimit: this.turnTimeLimit,
      stats: this.stats,
      disconnectNotice: this.disconnectNotice || null,
      spectatorCount: this.spectatorCount || 0
    };
  }

  // 🛠️ DEVTOOLS / TEST MOTORU: Tüm kuralları ve durumları test etme süpervizörü
  executeDevCommand(command, payload = {}) {
    this.addLog(`🛠️ [DEV] Komut alındı: ${command}`, 'info');

    switch (command) {
      case 'set_round': {
        const round = Math.max(1, parseInt(payload.round) || 1);
        this.roundNumber = round;
        this.addLog(`🛠️ [DEV] Oyun ${round}. tura sarıldı.`, 'info');
        return { success: true, round };
      }

      case 'set_money': {
        const p = this.players.find(x => x.id === payload.playerId) || this.getActivePlayer();
        if (!p) return { success: false, error: 'Oyuncu bulunamadı' };
        p.money = parseInt(payload.amount) || 0;
        this.addLog(`🛠️ [DEV] ${p.name} bakiyesi ${p.money}₺ olarak ayarlandı.`, 'info');
        return { success: true, money: p.money };
      }

      case 'add_money': {
        const p = this.players.find(x => x.id === payload.playerId) || this.getActivePlayer();
        if (!p) return { success: false, error: 'Oyuncu bulunamadı' };
        const amount = parseInt(payload.amount) || 0;
        p.money += amount;
        this.addLog(`🛠️ [DEV] ${p.name} bakiyesine ${amount}₺ eklendi (Mevcut: ${p.money}₺).`, 'info');
        return { success: true, money: p.money };
      }

      case 'teleport': {
        const p = this.players.find(x => x.id === payload.playerId) || this.getActivePlayer();
        if (!p) return { success: false, error: 'Oyuncu bulunamadı' };
        const targetTileId = ((parseInt(payload.tileId) % 40) + 40) % 40;
        p.position = targetTileId;
        this.currentTile = BOARD_TILES[targetTileId];
        const tileName = BOARD_TILES[targetTileId]?.name || `Kare ${targetTileId}`;
        this.addLog(`🛠️ [DEV] ${p.name}, [${targetTileId}] ${tileName} karesine ışınlandı.`, 'info');
        if (payload.triggerAction) {
          this.landOnTile(p, targetTileId);
        }
        return { success: true, position: targetTileId };
      }

      case 'jail_status': {
        const p = this.players.find(x => x.id === payload.playerId) || this.getActivePlayer();
        if (!p) return { success: false, error: 'Oyuncu bulunamadı' };
        const inJail = Boolean(payload.inJail);
        p.inJail = inJail;
        if (inJail) {
          p.position = 10;
          p.jailTurns = 0;
          this.lastJailEvent = {
            playerId: p.id,
            playerName: p.name,
            reason: 'DevTools Kodes Testi',
            timestamp: Date.now()
          };
          this.addLog(`🛠️ [DEV] ${p.name} Maliye Denetimi'ne (Kodes) alındı.`, 'jail');
        } else {
          p.jailTurns = 0;
          this.addLog(`🛠️ [DEV] ${p.name} Denetim'den çıkarıldı.`, 'info');
        }
        return { success: true, inJail: p.inJail };
      }

      case 'rig_dice': {
        const d1 = Math.max(1, Math.min(6, parseInt(payload.d1) || 1));
        const d2 = Math.max(1, Math.min(6, parseInt(payload.d2) || 1));
        this.riggedDice = [d1, d2];
        this.addLog(`🛠️ [DEV] Bir sonraki zar [${d1}, ${d2}] (${d1 + d2}) olarak sabitlendi.`, 'info');
        return { success: true, riggedDice: this.riggedDice };
      }

      case 'advance_turn': {
        this.advanceTurn();
        return { success: true };
      }

      case 'set_turn': {
        const pIdx = this.players.findIndex(x => x.id === payload.playerId);
        if (pIdx !== -1) {
          this.currentTurnIndex = pIdx;
          this.phase = 'WAITING_ROLL';
          this.turnStartTime = Date.now();
          this.canRollAgain = false;
          this.addLog(`🛠️ [DEV] Sıra zorla ${this.players[pIdx].name} oyuncusuna verildi.`, 'info');
          return { success: true };
        }
        return { success: false, error: 'Oyuncu bulunamadı' };
      }

      case 'set_phase': {
        this.phase = payload.phase || 'WAITING_ROLL';
        this.addLog(`🛠️ [DEV] Faz değiştirildi: ${this.phase}`, 'info');
        return { success: true, phase: this.phase };
      }

      case 'set_property': {
        const tileId = parseInt(payload.tileId);
        const prop = this.properties[tileId];
        if (!prop) return { success: false, error: 'Tapu bulunamadı' };
        if (payload.ownerId !== undefined) prop.ownerId = payload.ownerId || null;
        if (payload.houses !== undefined) prop.houses = Math.max(0, Math.min(5, parseInt(payload.houses) || 0));
        if (payload.mortgaged !== undefined) prop.mortgaged = Boolean(payload.mortgaged);
        const tileName = BOARD_TILES[tileId]?.name || `Kare ${tileId}`;
        this.addLog(`🛠️ [DEV] ${tileName} güncellendi: Sahip=${prop.ownerId || 'Yok'}, Ev=${prop.houses}, İpotek=${prop.mortgaged}`, 'buy');
        return { success: true };
      }

      case 'give_monopoly': {
        const p = this.players.find(x => x.id === payload.playerId) || this.getActivePlayer();
        if (!p) return { success: false, error: 'Oyuncu bulunamadı' };
        const key = payload.colorOrType;
        const matching = BOARD_TILES.filter(t => t.group === key || t.groupColor === key || t.type === key);
        matching.forEach(t => {
          if (this.properties[t.id]) {
            this.properties[t.id].ownerId = p.id;
            this.properties[t.id].mortgaged = false;
          }
        });
        this.addLog(`🛠️ [DEV] ${p.name} oyuncusuna ${key} grubundaki ${matching.length} tapu verildi (Monopol).`, 'buy');
        return { success: true, count: matching.length };
      }

      case 'start_auction': {
        const tileId = parseInt(payload.tileId);
        const tile = BOARD_TILES[tileId];
        if (!tile) return { success: false, error: 'Kare bulunamadı' };
        this.startAuction(tile);
        this.addLog(`🛠️ [DEV] ${tile.name} açık artırmaya çıkarıldı.`, 'buy');
        return { success: true };
      }

      case 'trigger_card': {
        const p = this.players.find(x => x.id === payload.playerId) || this.getActivePlayer();
        if (payload.deckType === 'chance') {
          return this.drawChanceCard(p);
        } else {
          return this.drawCommunityCard(p);
        }
      }

      case 'trigger_rent_notification': {
        const receiver = this.players.find(x => x.id === payload.receiverId) || this.players[0];
        const payer = this.players.find(x => x.id !== receiver?.id) || { name: 'Örnek Kiracı' };
        this.lastRentPayment = {
          payerId: payer.id || 'payer',
          payerName: payer.name,
          receiverId: receiver?.id,
          receiverName: receiver?.name,
          amount: parseInt(payload.amount) || 450,
          tileId: parseInt(payload.tileId) || 39,
          tileName: BOARD_TILES[parseInt(payload.tileId) || 39]?.name || 'Çankaya',
          timestamp: Date.now()
        };
        this.addLog(`🛠️ [DEV] Test kira bildirimi tetiklendi: ${payer.name} -> ${receiver.name} (${payload.amount || 450}₺).`, 'rent');
        return { success: true };
      }

      case 'add_parking_pool': {
        const amt = parseInt(payload.amount) || 500;
        this.freeParkingPool += amt;
        this.addLog(`🛠️ [DEV] Dinlenme Tesisi havuzuna ${amt}₺ eklendi (Mevcut: ${this.freeParkingPool}₺).`, 'info');
        return { success: true, pool: this.freeParkingPool };
      }

      case 'trigger_bankruptcy': {
        const p = this.players.find(x => x.id === payload.playerId) || this.getActivePlayer();
        if (!p) return { success: false, error: 'Oyuncu bulunamadı' };
        this.declareBankruptcy(p.id);
        return { success: true };
      }

      case 'trigger_victory': {
        const winner = this.players.find(x => x.id === payload.playerId) || this.getActivePlayer();
        this.winner = winner;
        this.status = 'ended';
        this.phase = 'GAME_OVER';
        this.computeStandings(this.winner);
        this.addLog(`🏆 [DEV] ${winner.name} şampiyon ilan edildi!`, 'winner');
        return { success: true };
      }

      case 'reset_game': {
        this.resetGameToLobby();
        this.addLog('🛠️ [DEV] Oyun lobiye sıfırlandı.', 'info');
        return { success: true };
      }

      case 'fast_forward_bots': {
        const active = this.getActivePlayer();
        if (active && active.isBot) {
          return this.fastForwardBotTurn(this.onStateUpdate);
        }
        return { success: false, error: 'Şu an sıra bir botta değil' };
      }

      default:
        return { success: false, error: `Bilinmeyen dev komutu: ${command}` };
    }
  }
}

export { MonopolyGame as GameEngine };
