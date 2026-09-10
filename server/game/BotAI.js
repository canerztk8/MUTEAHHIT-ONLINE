import { BOARD_TILES, COLOR_GROUPS } from './boardData.js';

/**
 * BotAI - Yapay Zeka Botlarının Karar Ağaçları & Heuristik Motoru
 * MonopolyGame sınıfındaki spagetti kodları önlemek ve kararları tekilleştirmek için kullanılır.
 */
export class BotAI {
  /**
   * Borç durumunu tasfiye et: Önce evleri eşit sat, sonra mülkleri stratejik sırayla ipotek et, gerekirse kredi çek
   * @param {import('./MonopolyGame.js').MonopolyGame} game
   * @param {object} active - Aktif oyuncu
   * @param {string} diff - Zorluk seviyesi
   * @returns {boolean} İflas edip etmediği (true = iflas etti)
   */
  static liquidateDebt(game, active, diff) {
    if (active.money >= 0) return false;

    // 1. Evleri / Otelleri Eşit Yıkım Kuralına Uygun Olarak Sat (En çok evi olandan başla)
    let hasHousesLeft = true;
    while (active.money < 0 && hasHousesLeft) {
      const ownedHouseProps = Object.entries(game.properties)
        .filter(([_, p]) => p.ownerId === active.id && (p.houses || 0) > 0)
        .sort((a, b) => b[1].houses - a[1].houses);

      if (ownedHouseProps.length === 0) {
        hasHousesLeft = false;
        break;
      }

      let soldAny = false;
      for (const [tid] of ownedHouseProps) {
        const res = game.sellHouse(active.id, Number(tid));
        if (res?.success) {
          soldAny = true;
          if (active.money >= 0) return false;
          break; // Yeniden sıralayıp eşit yıkımı korumak için döngüyü tazele
        }
      }

      if (!soldAny) {
        hasHousesLeft = false;
        break;
      }
    }

    if (active.money >= 0) return false;

    // 2. Mülkleri İpotek Et (Önce tekil/tamamlanmamış mülkler, en son tekel mülkleri)
    const ownedMortgageableProps = Object.entries(game.properties)
      .filter(([_, p]) => p.ownerId === active.id && !p.mortgaged && (p.houses || 0) === 0)
      .map(([tid, p]) => {
        const tile = BOARD_TILES[tid];
        const group = tile?.group && COLOR_GROUPS[tile.group] ? COLOR_GROUPS[tile.group] : [];
        const isMonopoly = group.length > 0 && group.every(id => game.properties[id]?.ownerId === active.id);
        const groupCount = group.filter(id => game.properties[id]?.ownerId === active.id).length;
        return { tid: Number(tid), p, isMonopoly, groupCount, mortgage: tile?.mortgage || 50 };
      })
      .sort((a, b) => {
        // Tekel olmayanları önce ipotek et
        if (a.isMonopoly !== b.isMonopoly) return a.isMonopoly ? 1 : -1;
        // Grubu daha az tamamlanmış olanları önce ipotek et
        return a.groupCount - b.groupCount;
      });

    for (const item of ownedMortgageableProps) {
      game.mortgageProperty(active.id, item.tid);
      if (active.money >= 0) return false;
    }

    // 3. Hâlâ eksi bakiyedeyse İflas İlan Et
    if (active.money < 0) {
      game.declareBankruptcy(active.id);
      return true;
    }

    return false;
  }

  /**
   * Kodeste kalma / çıkma kararını değerlendir
   * @param {import('./MonopolyGame.js').MonopolyGame} game
   * @param {object} active - Aktif oyuncu
   * @param {string} diff - Zorluk seviyesi
   */
  static handleJailDecision(game, active, diff) {
    if (!active.inJail) return;

    const jailFine = game.getJailFine();

    // Haritadaki sahipsiz mülk sayısı
    let unownedPropertiesCount = 0;
    for (const tid in game.properties) {
      if (!game.properties[tid].ownerId && BOARD_TILES[tid]?.cost) {
        unownedPropertiesCount++;
      }
    }

    // Tahtada rakiplere ait ev/otel tehlikesi var mı?
    const opponentThreatOnBoard = Object.values(game.properties).some(
      p => p.ownerId && p.ownerId !== active.id && p.houses >= 2
    );

    // Erken/Orta Oyun: Sahipsiz arsalar varken dışarı çıkıp tapu toplamak kritiktir
    if (unownedPropertiesCount > 0) {
      if (active.jailCards > 0) {
        game.useJailCard(active.id);
      } else if (active.money >= jailFine + (diff === 'kolay' ? 50 : 100)) {
        game.payJailFine(active.id);
      }
      return;
    }

    // İleri Oyun: Tüm arsalar satılmışken ve rakiplerin tehlikeli evleri varken kodeste beklemek stratejik sığınaktır (Resmi kural: Kodeste tam kira toplanır)
    if (opponentThreatOnBoard) {
      // Tehlikeli tahtada pusuya yat, kefalet ödeme, çift zar denemesi yap
      return;
    }

    // Tahtada tehdit yoksa ve nakit bolsa dışarı çıkıp GO maaşı al
    if (active.jailCards > 0) {
      game.useJailCard(active.id);
    } else if (active.money >= jailFine + (diff === 'imkansiz' ? 200 : 300)) {
      game.payJailFine(active.id);
    }
  }

  /**
   * Sahipsiz mülkü satın alma veya açık artırmaya bırakma kararı
   * @param {import('./MonopolyGame.js').MonopolyGame} game
   * @param {object} active - Aktif oyuncu
   * @param {object} tile - Basılan kare
   * @param {string} diff - Zorluk seviyesi
   * @returns {boolean} Satın alsın mı?
   */
  static shouldBuyProperty(game, active, tile, diff) {
    if (!tile || !tile.cost) return false;

    if (diff === 'cok_kolay') {
      return Math.random() < 0.35 && active.money >= tile.cost + 300;
    }
    if (diff === 'kolay') {
      return active.money >= tile.cost + 250;
    }
    if (diff === 'orta') {
      return active.money >= tile.cost + 150;
    }
    if (diff === 'zor') {
      return active.money >= tile.cost + 40;
    }
    if (diff === 'imkansiz') {
      // İmkansız: Tekel tamamlama veya rakip blokajı varsa 10₺ kalsa bile alır
      let isHighStrategicValue = false;
      if (tile.group && COLOR_GROUPS[tile.group]) {
        const grp = COLOR_GROUPS[tile.group];
        const botOwned = grp.filter(id => game.properties[id]?.ownerId === active.id).length;
        if (botOwned >= 1) isHighStrategicValue = true; // Tekel kurmaya doğru

        for (const opp of game.players) {
          if (opp.id !== active.id && !opp.isBankrupt) {
            const oppOwned = grp.filter(id => game.properties[id]?.ownerId === opp.id).length;
            if (oppOwned === grp.length - 1) isHighStrategicValue = true; // Rakibin tekelini kırma
          }
        }
      }
      return isHighStrategicValue ? (active.money >= tile.cost + 10) : (active.money >= tile.cost + 25);
    }

    return active.money >= tile.cost + 150;
  }

  /**
   * Tur sonunda ev / otel inşaat stratejisi
   * @param {import('./MonopolyGame.js').MonopolyGame} game
   * @param {object} active - Aktif oyuncu
   * @param {string} diff - Zorluk seviyesi
   */
  static buildHouses(game, active, diff) {
    if (diff === 'cok_kolay') return;

    // Minimum nakit rezervi (zorluk seviyesine göre güvenlik marjı)
    const minReserve = diff === 'imkansiz' ? 60 : diff === 'zor' ? 140 : diff === 'orta' ? 250 : 400;

    for (const groupName in COLOR_GROUPS) {
      if (groupName === 'railroad' || groupName === 'utility') continue;
      const groupTiles = COLOR_GROUPS[groupName];
      const ownsMonopoly = groupTiles.every(id => game.properties[id]?.ownerId === active.id && !game.properties[id]?.mortgaged);
      if (!ownsMonopoly) continue;

      // Eşit inşaat kuralına tam uyum sağlamak için döngüsel inşaat
      let builtSomething = true;
      while (builtSomething && active.money > minReserve) {
        builtSomething = false;

        // En az binası olan mülkleri öncele
        const sortedTiles = [...groupTiles].sort((a, b) => {
          return (game.properties[a]?.houses || 0) - (game.properties[b]?.houses || 0);
        });

        for (const tId of sortedTiles) {
          const prop = game.properties[tId];
          const t = BOARD_TILES[tId];
          if (!prop || !t || prop.houses >= 5) continue;

          const cost = t.houseCost || 100;
          if (active.money >= cost + minReserve) {
            const res = game.buildHouse(active.id, Number(tId));
            if (res?.success) {
              builtSomething = true;
              break; // Her başarılı inşadan sonra eşitliği korumak için tekrar sırala
            }
          }
        }
      }
    }
  }

  /**
   * Açık artırma teklif tavanı hesabı
   * @param {import('./MonopolyGame.js').MonopolyGame} game
   * @param {object} bot
   * @param {object} auction
   * @param {string} diff
   * @returns {number} Maksimum verilecek teklif
   */
  static evaluateAuctionBid(game, bot, auction, diff) {
    const tile = BOARD_TILES[auction.tileId];
    const cost = tile?.cost || 100;

    let maxFactor = 0.85;
    if (diff === 'cok_kolay') maxFactor = 0.25;
    else if (diff === 'kolay') maxFactor = 0.50;
    else if (diff === 'orta') maxFactor = 0.85;
    else if (diff === 'zor') maxFactor = 1.15;
    else if (diff === 'imkansiz') {
      let completesBotMonopoly = false;
      let blocksOpponentMonopoly = false;

      if (tile && tile.group && COLOR_GROUPS[tile.group]) {
        const group = COLOR_GROUPS[tile.group];
        const botOwned = group.filter(id => game.properties[id]?.ownerId === bot.id).length;
        if (botOwned === group.length - 1) completesBotMonopoly = true;

        for (const opp of game.players) {
          if (opp.id !== bot.id && !opp.isBankrupt) {
            const oppOwned = group.filter(id => game.properties[id]?.ownerId === opp.id).length;
            if (oppOwned === group.length - 1) {
              blocksOpponentMonopoly = true;
              break;
            }
          }
        }
      }

      if (completesBotMonopoly) maxFactor = 1.65;
      else if (blocksOpponentMonopoly) maxFactor = 1.50;
      else maxFactor = 1.25;
    }

    const maxBid = Math.floor(cost * maxFactor);
    const affordable = bot.money - (diff === 'imkansiz' ? 15 : diff === 'zor' ? 30 : 60);
    return Math.min(maxBid, affordable);
  }

  /**
   * Takas teklifi değerlendirmesi
   * @param {import('./MonopolyGame.js').MonopolyGame} game
   * @param {object} bot
   * @param {object} trade
   * @returns {boolean} Teklifi kabul etsin mi?
   */
  static evaluateTrade(game, bot, trade) {
    const diff = bot.difficulty || 'orta';

    if (trade.requestedMoney > 0 && bot.money < trade.requestedMoney) {
      game.addLog(`🤖 ${bot.name}, nakit parası yetersiz olduğu için takas teklifini reddetti.`, 'info');
      return false;
    }

    // Bot elindeki tekel setini bozuyor mu?
    let botLosesMonopoly = false;
    for (const tileId of trade.requestedProperties) {
      const tile = BOARD_TILES[tileId];
      if (tile && tile.group && COLOR_GROUPS[tile.group]) {
        const group = COLOR_GROUPS[tile.group];
        const botOwnsAll = group.every(id => game.properties[id]?.ownerId === bot.id);
        if (botOwnsAll) {
          botLosesMonopoly = true;
          break;
        }
      }
    }

    if (botLosesMonopoly) {
      game.addLog(`🤖 ${bot.name}, tekel olduğu seti bozmamak için takas teklifini reddetti.`, 'info');
      return false;
    }

    // Bot bu teklifle tekel oluyor mu?
    let botCompletesMonopoly = false;
    for (const tileId of trade.offeredProperties) {
      const tile = BOARD_TILES[tileId];
      if (tile && tile.group && COLOR_GROUPS[tile.group]) {
        const group = COLOR_GROUPS[tile.group];
        const botWillOwnCount = group.filter(id => game.properties[id]?.ownerId === bot.id || trade.offeredProperties.includes(id)).length;
        if (botWillOwnCount === group.length) {
          botCompletesMonopoly = true;
          break;
        }
      }
    }

    // Rakip oyuncu bu takasla tekel kuruyor mu?
    let givesOpponentMonopoly = false;
    for (const tileId of trade.requestedProperties) {
      const tile = BOARD_TILES[tileId];
      if (tile && tile.group && COLOR_GROUPS[tile.group]) {
        const group = COLOR_GROUPS[tile.group];
        const oppWillOwnCount = group.filter(id => game.properties[id]?.ownerId === trade.fromPlayerId || trade.requestedProperties.includes(id)).length;
        if (oppWillOwnCount === group.length) {
          givesOpponentMonopoly = true;
          break;
        }
      }
    }

    // İmkansız Bot: Asla bir rakibe tekel hediye etmez (kendisi de olmuyorsa)
    if (diff === 'imkansiz' && givesOpponentMonopoly && !botCompletesMonopoly) {
      game.addLog(`🤖 ${bot.name}, rakibe oyun kazandıracak tekel seti hediye etmemek için takası reddetti.`, 'info');
      return false;
    }

    const offeredVal = trade.offeredValue;
    const requestedVal = trade.requestedValue;

    let threshold = 1.0;
    if (botCompletesMonopoly) threshold = (diff === 'imkansiz' ? 0.70 : 0.75);
    else if (diff === 'cok_kolay') threshold = 0.80;
    else if (diff === 'kolay') threshold = 0.95;
    else if (diff === 'orta') threshold = 1.05;
    else if (diff === 'zor') threshold = 1.15;
    else if (diff === 'imkansiz') threshold = 1.35;

    return offeredVal >= Math.round(requestedVal * threshold);
  }
}
