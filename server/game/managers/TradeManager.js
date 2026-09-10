import { BOARD_TILES, COLOR_GROUPS } from '../boardData.js';

export class TradeManager {
  constructor(game) {
    this.game = game;
  }

  get pendingTrade() {
    return this.game.pendingTrade;
  }

  set pendingTrade(val) {
    this.game.pendingTrade = val;
  }

  get lastTradeResult() {
    return this.game.lastTradeResult;
  }

  set lastTradeResult(val) {
    this.game.lastTradeResult = val;
  }

  get tradeCooldowns() {
    return this.game.tradeCooldowns;
  }

  set tradeCooldowns(val) {
    this.game.tradeCooldowns = val;
  }

  get tradeQueue() {
    if (!this.game.tradeQueue) this.game.tradeQueue = [];
    return this.game.tradeQueue;
  }

  set tradeQueue(val) {
    this.game.tradeQueue = val;
  }

  proposeTrade(fromPlayerId, tradeData) {
    const { toPlayerId, offeredProperties = [], requestedProperties = [], offeredJailCards = 0, requestedJailCards = 0 } = tradeData || {};
    const parsedOffered = Math.floor(Number(tradeData?.offeredMoney) || 0);
    const parsedRequested = Math.floor(Number(tradeData?.requestedMoney) || 0);
    if (!Number.isFinite(parsedOffered) || !Number.isFinite(parsedRequested) || parsedOffered < 0 || parsedRequested < 0) {
      return { success: false, error: 'Geçersiz para tutarı.' };
    }
    const offeredMoney = parsedOffered;
    const requestedMoney = parsedRequested;

    const fromPlayer = this.game.players.find(p => p.id === fromPlayerId);
    const toPlayer = this.game.players.find(p => p.id === toPlayerId);

    if (!fromPlayer || !toPlayer) return { success: false, error: 'Geçersiz oyuncu.' };
    if (fromPlayer.isBankrupt || toPlayer.isBankrupt) return { success: false, error: 'İflas etmiş oyuncular takas yapamaz.' };

    // Takas spam koruması (Aynı oyuncuya 30 saniye cooldown)
    const cooldownKey = `${fromPlayerId}_${toPlayerId}`;
    const lastTradeTime = this.game.tradeCooldowns?.[cooldownKey] || 0;
    const now = Date.now();
    if (now - lastTradeTime < 30000) {
      const remainingSec = Math.ceil((30000 - (now - lastTradeTime)) / 1000);
      return { success: false, error: `Bu oyuncuya tekrar takas teklifi göndermek için ${remainingSec} saniye beklemelisiniz.` };
    }

    if (offeredMoney > 0 && fromPlayer.money < offeredMoney) return { success: false, error: 'Teklif edilen para bakiyenizden fazla olamaz.' };
    if (requestedMoney > 0 && toPlayer.money < requestedMoney) return { success: false, error: 'İstenen para karşı oyuncunun bakiyesinden fazla olamaz.' };

    const parsedOfferedJail = Math.max(0, parseInt(offeredJailCards) || 0);
    const parsedRequestedJail = Math.max(0, parseInt(requestedJailCards) || 0);
    if (parsedOfferedJail > 0 && (fromPlayer.jailCards || 0) < parsedOfferedJail) {
      return { success: false, error: 'Yeterli Kodes Af Kartınız yok.' };
    }
    if (parsedRequestedJail > 0 && (toPlayer.jailCards || 0) < parsedRequestedJail) {
      return { success: false, error: 'Karşı oyuncunun bu kadar Kodes Af Kartı yok.' };
    }

    if (fromPlayer.money < 0 && offeredMoney > 0) {
      return { success: false, error: 'Borçtayken nakit teklif edemezsiniz, sadece mülk satabilirsiniz.' };
    }

    for (const tileId of [...offeredProperties, ...requestedProperties]) {
      const t = BOARD_TILES[tileId];
      if (t?.group && COLOR_GROUPS[t.group]) {
        const hasHouses = COLOR_GROUPS[t.group].some(id => (this.game.properties[id]?.houses || 0) > 0);
        if (hasHouses) {
          return { success: false, error: `"${t.name}" renk grubunda binalar varken takas yapılamaz. Önce gruptaki tüm binaları bankaya satmalısınız.` };
        }
      }
    }

    const hasAnyAssets = offeredProperties.length > 0 || requestedProperties.length > 0 || parsedOfferedJail > 0 || parsedRequestedJail > 0;
    if (!hasAnyAssets) {
      return { success: false, error: 'Takas yapabilmek için en az bir mülk veya Kodes Af Kartı teklif edilmeli veya istenmelidir.' };
    }

    if (requestedMoney > 0 && requestedProperties.length === 0 && parsedRequestedJail === 0 && offeredProperties.length === 0 && parsedOfferedJail === 0) {
      return { success: false, error: 'Karşılıksız para talep edemezsiniz!' };
    }

    let offeredValue = offeredMoney + (parsedOfferedJail * 50);
    offeredProperties.forEach(id => {
      offeredValue += BOARD_TILES[id]?.cost || 0;
    });

    let requestedValue = requestedMoney + (parsedRequestedJail * 50);
    requestedProperties.forEach(id => {
      requestedValue += BOARD_TILES[id]?.cost || 0;
    });

    const isDetrimental = offeredValue < requestedValue;

    if (!this.game.tradeCooldowns) this.game.tradeCooldowns = {};
    this.game.tradeCooldowns[cooldownKey] = now;

    const trade = {
      id: Math.random().toString(36).substring(2, 8),
      fromPlayerId,
      fromPlayerName: fromPlayer.name,
      toPlayerId,
      toPlayerName: toPlayer.name,
      offeredMoney,
      offeredProperties,
      offeredJailCards: parsedOfferedJail,
      requestedMoney,
      requestedProperties,
      requestedJailCards: parsedRequestedJail,
      offeredValue,
      requestedValue,
      isDetrimental,
      createdAt: now
    };

    if (this.pendingTrade) {
      this.tradeQueue.push(trade);
      this.game.addLog(`⏳ ${fromPlayer.name}, ${toPlayer.name} oyuncusuna bir takas teklifi gönderdi (Önceki teklif sonuçlanana kadar sıraya alındı).`, 'info');
      return { success: true, queued: true, trade, message: 'Teklifiniz sıraya alındı, önceki teklif yanıtlandıktan sonra iletilecektir.' };
    }

    this.pendingTrade = trade;
    this.game.addLog(`${fromPlayer.name}, ${toPlayer.name} oyuncusuna bir takas teklifi gönderdi.`, 'info');
    return { success: true, queued: false, trade };
  }

  sendGift(fromPlayerId, toPlayerId, amount) {
    return { success: false, error: 'Resmi oyun kurallarında karşılıksız para transferi / bağış yasaktır.' };
  }

  respondTrade(playerId, accept) {
    if (!this.pendingTrade || this.pendingTrade.toPlayerId !== playerId) {
      return { success: false, error: 'Bekleyen takas teklifi yok.' };
    }

    const trade = this.pendingTrade;
    const fromPlayer = this.game.players.find(p => p.id === trade.fromPlayerId);
    const toPlayer = this.game.players.find(p => p.id === trade.toPlayerId);

    if (!accept) {
      this.lastTradeResult = {
        id: Math.random().toString(36).substring(2, 9),
        fromPlayerId: trade.fromPlayerId,
        toPlayerId: trade.toPlayerId,
        fromPlayerName: fromPlayer?.name || 'Oyuncu',
        toPlayerName: toPlayer?.name || 'Oyuncu',
        senderName: fromPlayer?.name || 'Oyuncu',
        receiverName: toPlayer?.name || 'Oyuncu',
        accepted: false,
        timestamp: Date.now()
      };
      this.game.addLog(`${toPlayer.name}, ${fromPlayer.name} oyuncusunun takas teklifini reddetti.`, 'info');
      this.processNextQueuedTrade();
      return { success: true, accepted: false };
    }

    const offeredMoney = Math.max(0, trade.offeredMoney);
    const requestedMoney = Math.max(0, trade.requestedMoney);

    if (fromPlayer.money < offeredMoney || toPlayer.money < requestedMoney) {
      this.processNextQueuedTrade();
      return { success: false, error: 'Takas için gerekli nakit para yetersiz.' };
    }

    for (const tileId of trade.offeredProperties) {
      if (this.game.properties[tileId].ownerId !== fromPlayer.id || this.game.properties[tileId].houses > 0) {
        this.processNextQueuedTrade();
        return { success: false, error: 'Teklif edilen mülkler artık geçerli değil veya üzerinde bina var.' };
      }
    }
    for (const tileId of trade.requestedProperties) {
      if (this.game.properties[tileId].ownerId !== toPlayer.id || this.game.properties[tileId].houses > 0) {
        this.processNextQueuedTrade();
        return { success: false, error: 'İstenen mülkler artık geçerli değil veya üzerinde bina var.' };
      }
    }

    const offeredJailCards = Math.max(0, parseInt(trade.offeredJailCards) || 0);
    const requestedJailCards = Math.max(0, parseInt(trade.requestedJailCards) || 0);

    if (offeredJailCards > 0 && (fromPlayer.jailCards || 0) < offeredJailCards) {
      this.processNextQueuedTrade();
      return { success: false, error: 'Teklif edilen Kodes Af Kartı artık mevcut değil.' };
    }
    if (requestedJailCards > 0 && (toPlayer.jailCards || 0) < requestedJailCards) {
      this.processNextQueuedTrade();
      return { success: false, error: 'İstenen Kodes Af Kartı artık mevcut değil.' };
    }

    if (offeredMoney > 0) {
      this.game.adjustPlayerMoney(fromPlayer, -offeredMoney, `${toPlayer.name} ile takas ödemesi`);
      this.game.adjustPlayerMoney(toPlayer, offeredMoney, `${fromPlayer.name} ile takas tahsilatı`);
    }

    if (requestedMoney > 0) {
      this.game.adjustPlayerMoney(toPlayer, -requestedMoney, `${fromPlayer.name} ile takas ödemesi`);
      this.game.adjustPlayerMoney(fromPlayer, requestedMoney, `${toPlayer.name} ile takas tahsilatı`);
    }

    if (offeredJailCards > 0) {
      fromPlayer.jailCards -= offeredJailCards;
      toPlayer.jailCards = (toPlayer.jailCards || 0) + offeredJailCards;
    }
    if (requestedJailCards > 0) {
      toPlayer.jailCards -= requestedJailCards;
      fromPlayer.jailCards = (fromPlayer.jailCards || 0) + requestedJailCards;
    }

    const tradeTimestamp = Date.now();
    for (const tileId of trade.offeredProperties) {
      this.game.properties[tileId].ownerId = toPlayer.id;
      this.game.properties[tileId].acquiredAt = tradeTimestamp;
      if (this.game.properties[tileId].mortgaged) {
        const fee = Math.round((BOARD_TILES[tileId]?.mortgage || 50) * 0.10);
        if (toPlayer.money >= fee) {
          this.game.adjustPlayerMoney(toPlayer, -fee, 'İpotekli tapu devir harcı (%10)');
          this.game.addLog(`🏛️ ${toPlayer.name}, devraldığı ipotekli "${BOARD_TILES[tileId].name}" için Bankaya %10 devir faizi (${fee}₺) ödedi.`, 'rent');
        }
      }
    }
    for (const tileId of trade.requestedProperties) {
      this.game.properties[tileId].ownerId = fromPlayer.id;
      this.game.properties[tileId].acquiredAt = tradeTimestamp;
      if (this.game.properties[tileId].mortgaged) {
        const fee = Math.round((BOARD_TILES[tileId]?.mortgage || 50) * 0.10);
        if (fromPlayer.money >= fee) {
          this.game.adjustPlayerMoney(fromPlayer, -fee, 'İpotekli tapu devir harcı (%10)');
          this.game.addLog(`🏛️ ${fromPlayer.name}, devraldığı ipotekli "${BOARD_TILES[tileId].name}" için Bankaya %10 devir faizi (${fee}₺) ödedi.`, 'rent');
        }
      }
    }

    this.game.stats.tradesCompleted++;
    this.lastTradeResult = {
      id: Math.random().toString(36).substring(2, 9),
      fromPlayerId: trade.fromPlayerId,
      toPlayerId: trade.toPlayerId,
      fromPlayerName: fromPlayer.name,
      toPlayerName: toPlayer.name,
      senderName: fromPlayer.name,
      receiverName: toPlayer.name,
      accepted: true,
      timestamp: Date.now()
    };

    const offeredNames = [
      ...trade.offeredProperties.map(id => BOARD_TILES[id]?.name || id),
      ...(offeredJailCards > 0 ? [`${offeredJailCards}x Kodes Af Kartı`] : [])
    ];
    const requestedNames = [
      ...trade.requestedProperties.map(id => BOARD_TILES[id]?.name || id),
      ...(requestedJailCards > 0 ? [`${requestedJailCards}x Kodes Af Kartı`] : [])
    ];

    const fromGave = [
      ...offeredNames,
      ...(offeredMoney > 0 ? [`${offeredMoney}₺`] : [])
    ].join(' + ') || '0₺';

    const toGave = [
      ...requestedNames,
      ...(requestedMoney > 0 ? [`${requestedMoney}₺`] : [])
    ].join(' + ') || '0₺';

    this.game.addLog(`🤝 ${toPlayer.name} ve ${fromPlayer.name} takası tamamladı! (${fromPlayer.name}: [${fromGave}] ⇄ ${toPlayer.name}: [${toGave}])`, 'buy');
    this.processNextQueuedTrade();
    return { success: true, accepted: true };
  }

  processNextQueuedTrade() {
    this.pendingTrade = null;
    while (this.tradeQueue.length > 0) {
      const nextTrade = this.tradeQueue.shift();
      const fromPlayer = this.game.players.find(p => p.id === nextTrade.fromPlayerId);
      const toPlayer = this.game.players.find(p => p.id === nextTrade.toPlayerId);

      if (!fromPlayer || !toPlayer || fromPlayer.isBankrupt || toPlayer.isBankrupt) {
        continue;
      }

      // Mülk sahipliği ve bina kontrolü
      const offeredPropsValid = nextTrade.offeredProperties.every(id => {
        const prop = this.game.properties[id];
        return prop && prop.ownerId === fromPlayer.id && (prop.houses || 0) === 0;
      });
      const requestedPropsValid = nextTrade.requestedProperties.every(id => {
        const prop = this.game.properties[id];
        return prop && prop.ownerId === toPlayer.id && (prop.houses || 0) === 0;
      });

      if (!offeredPropsValid || !requestedPropsValid) {
        this.game.addLog(`⚠️ ${fromPlayer.name} ile ${toPlayer.name} arasındaki sıradaki takas, mülk durumu değiştiği için iptal edildi.`, 'info');
        continue;
      }

      if (fromPlayer.money < nextTrade.offeredMoney || toPlayer.money < nextTrade.requestedMoney) {
        this.game.addLog(`⚠️ ${fromPlayer.name} ile ${toPlayer.name} arasındaki sıradaki takas, nakit yetersizliği nedeniyle iptal edildi.`, 'info');
        continue;
      }

      if (nextTrade.offeredJailCards > 0 && (fromPlayer.jailCards || 0) < nextTrade.offeredJailCards) {
        continue;
      }
      if (nextTrade.requestedJailCards > 0 && (toPlayer.jailCards || 0) < nextTrade.requestedJailCards) {
        continue;
      }

      this.pendingTrade = nextTrade;
      this.game.addLog(`📩 ${toPlayer.name} için sıradaki bekleyen takas açıldı (${fromPlayer.name} tarafından).`, 'info');

      if (toPlayer.isBot && !toPlayer.isBankrupt) {
        setTimeout(() => {
          if (this.pendingTrade && this.pendingTrade.toPlayerId === toPlayer.id) {
            this.game.evaluateBotTrade(toPlayer.id);
            this.game.onStateUpdate?.();
          }
        }, 400);
      }
      break;
    }
  }

  cancelTrade(playerId) {
    let changed = false;
    const initialLen = this.tradeQueue.length;
    this.tradeQueue = this.tradeQueue.filter(t => t.fromPlayerId !== playerId && t.toPlayerId !== playerId);
    if (this.tradeQueue.length !== initialLen) {
      changed = true;
    }
    if (this.pendingTrade && (this.pendingTrade.fromPlayerId === playerId || this.pendingTrade.toPlayerId === playerId)) {
      this.processNextQueuedTrade();
      return { success: true };
    }
    return { success: changed };
  }
}
