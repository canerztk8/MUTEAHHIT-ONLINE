import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";
import { MonopolyGame } from "../server/game/MonopolyGame.js";
import { BOARD_TILES, COLOR_GROUPS } from "../server/game/boardData.js";

const __filename = fileURLToPath(import.meta.url);

const TOTAL_SIMULATION_GAMES = parseInt(process.argv[2], 10) || 10000000;
const CAMPAIGN_COUNT = 5;
const GAMES_PER_CAMPAIGN = Math.floor(TOTAL_SIMULATION_GAMES / CAMPAIGN_COUNT);
const numWorkers = Math.min(16, os.cpus().length || 4);

const BUYABLE_PROP_IDS = [1, 3, 5, 6, 8, 9, 11, 12, 13, 14, 15, 16, 18, 19, 21, 23, 24, 25, 26, 27, 28, 29, 31, 32, 34, 35, 37, 39];

if (isMainThread) {
  console.log(`================================================================================`);
  console.log(`🏆 10.000.000 (ON MİLYON) MAÇLIK BÜYÜK MONOPOLY DENGE & STRES SİMÜLASYONU`);
  console.log(`📊 Toplam Hedef: ${TOTAL_SIMULATION_GAMES.toLocaleString("tr-TR")} Maç | 5 Büyük Kampanya x ${(GAMES_PER_CAMPAIGN).toLocaleString("tr-TR")}`);
  console.log(`⚡ Kampanya 1: Grandmaster Usta Oyuncular (Oyun Teorisi Self-Play) [2M]`);
  console.log(`⚡ Kampanya 2: İnsan (Grandmaster) vs Karma Bot Zorlukları [2M]`);
  console.log(`⚡ Kampanya 3: Botlar Kendi Arasında Tüm Zorluk Permütasyonları [2M]`);
  console.log(`⚡ Kampanya 4: Finansal Kriz, Borç, İcra & 40. Tur Kıyamet Modu [2M]`);
  console.log(`⚡ Kampanya 5: Agresif Açık Artırma, İhale Savaşları & Tekel Blokajı [2M]`);
  console.log(`🔥 Donanım: 16 Çekirdek AMD Ryzen | İşçi Başına: ${Math.floor(GAMES_PER_CAMPAIGN / numWorkers).toLocaleString("tr-TR")} Maç/Kampanya`);
  console.log(`================================================================================\n`);

  async function runCampaign(name, key) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const gamesPerWorker = Math.floor(GAMES_PER_CAMPAIGN / numWorkers);
      let completedWorkers = 0;
      let totalSimulated = 0;

      const combined = {
        campaign: key,
        campaignName: name,
        totalGames: 0,
        validGames: 0,
        turnTimeouts: 0,
        wins: {},
        seatWins: [0, 0, 0, 0],
        roundSum: 0,
        jailEntries: 0,
        jailStalls: 0,
        jailWardFees: 0,
        jailBailsPaid: 0,
        jailForcedExits: 0,
        jailRentCollected: 0,
        threeHouseWins: 0,
        hotelWins: 0,
        hotelDiscountUses: 0,
        winningMonopolyGroups: {},
        auctionsTriggered: 0,
        auctionsSold: 0,
        monopolyDenialBids: 0,
        inflationRoundsTriggered: 0,
        suddenDeathTriggered: 0,
        bankLoansRequested: 0,
        bankLoansForeclosed: 0,
        roundDistribution: {
          under20: 0,
          rounds20to24: 0,
          rounds25to29: 0,
          rounds30to39: 0,
          rounds40plus: 0
        }
      };

      console.log(`\n▶️ BAŞLIYOR: [${name}] (${GAMES_PER_CAMPAIGN.toLocaleString("tr-TR")} Maç)...`);

      for (let i = 0; i < numWorkers; i++) {
        const worker = new Worker(__filename, {
          workerData: { workerId: i, games: gamesPerWorker, campaignKey: key }
        });

        worker.on("message", (msg) => {
          if (msg.type === "progress") {
            totalSimulated += msg.count;
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const rate = Math.floor(totalSimulated / (elapsed || 0.001));
            const pct = ((totalSimulated / GAMES_PER_CAMPAIGN) * 100).toFixed(1);
            process.stdout.write(`\r  [${key}] ${totalSimulated.toLocaleString("tr-TR")} / ${GAMES_PER_CAMPAIGN.toLocaleString("tr-TR")} (%${pct}) | Hız: ${rate.toLocaleString("tr-TR")} maç/s`);
          } else if (msg.type === "result") {
            const r = msg.data;
            combined.totalGames += r.totalGames;
            combined.validGames += r.validGames;
            combined.turnTimeouts += r.turnTimeouts;
            combined.roundSum += r.roundSum;
            combined.jailEntries += r.jailEntries;
            combined.jailStalls += r.jailStalls;
            combined.jailWardFees += r.jailWardFees;
            combined.jailBailsPaid += r.jailBailsPaid;
            combined.jailForcedExits += r.jailForcedExits;
            combined.jailRentCollected += r.jailRentCollected;
            combined.threeHouseWins += r.threeHouseWins;
            combined.hotelWins += r.hotelWins;
            combined.hotelDiscountUses += r.hotelDiscountUses;
            combined.auctionsTriggered += r.auctionsTriggered;
            combined.auctionsSold += r.auctionsSold;
            combined.monopolyDenialBids += r.monopolyDenialBids;
            combined.inflationRoundsTriggered += r.inflationRoundsTriggered;
            combined.suddenDeathTriggered += r.suddenDeathTriggered;
            combined.bankLoansRequested += r.bankLoansRequested;
            combined.bankLoansForeclosed += r.bankLoansForeclosed;

            for (let s = 0; s < 4; s++) combined.seatWins[s] += r.seatWins[s];
            for (const k in r.wins) combined.wins[k] = (combined.wins[k] || 0) + r.wins[k];
            for (const g in r.winningMonopolyGroups) {
              combined.winningMonopolyGroups[g] = (combined.winningMonopolyGroups[g] || 0) + r.winningMonopolyGroups[g];
            }
            for (const dist in r.roundDistribution) {
              combined.roundDistribution[dist] += r.roundDistribution[dist];
            }

            completedWorkers++;
            if (completedWorkers === numWorkers) {
              const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
              const finalRate = Math.floor(GAMES_PER_CAMPAIGN / totalDuration);
              console.log(`\n  ✅ ${name} Tamamlandı! Süre: ${totalDuration}s (${finalRate.toLocaleString("tr-TR")} maç/s)`);
              resolve(combined);
            }
          }
        });
      }
    });
  }

  async function runMasterSimulation() {
    const masterStart = Date.now();
    const c1 = await runCampaign("KAMPANYA 1: USTA KENDİNE KARŞI (SELF-PLAY)", "CAMP_SELF_PLAY");
    const c2 = await runCampaign("KAMPANYA 2: İNSAN (GRANDMASTER) VS KARMA BOTLAR", "CAMP_GM_VS_BOTS");
    const c3 = await runCampaign("KAMPANYA 3: BOTLAR KENDİ ARASINDA (TÜM PERMÜTASYONLAR)", "CAMP_BOTS_ONLY");
    const c4 = await runCampaign("KAMPANYA 4: FİNANSAL KRİZ, BORÇ, İCRA & KIYAMET", "CAMP_STRESS_ECONOMY");
    const c5 = await runCampaign("KAMPANYA 5: AGRESİF AÇIK ARTIRMA & İHALE SAVAŞLARI", "CAMP_AUCTION_TRADE");

    const totalSec = ((Date.now() - masterStart) / 1000).toFixed(2);
    console.log(`\n================================================================================`);
    console.log(`🎉 10.000.000 MAÇLIK DEVASA SİMÜLASYON ${totalSec} SANİYEDE TAMAMLANDI!`);
    console.log(`⚡ Ortalama Simülasyon Hızı: ${Math.floor(TOTAL_SIMULATION_GAMES / totalSec).toLocaleString("tr-TR")} Maç/Saniye`);
    console.log(`================================================================================\n`);

    const masterReport = {
      meta: {
        totalSimulatedGames: TOTAL_SIMULATION_GAMES,
        durationSeconds: parseFloat(totalSec),
        averageRatePerSec: Math.floor(TOTAL_SIMULATION_GAMES / totalSec),
        completedAt: new Date().toISOString()
      },
      campaigns: {
        c1_SelfPlay: c1,
        c2_GmVsBots: c2,
        c3_BotsOnly: c3,
        c4_StressEconomy: c4,
        c5_AuctionTrade: c5
      }
    };

    fs.writeFileSync("test/tenMillionSimulationReport.json", JSON.stringify(masterReport, null, 2));
    console.log("📁 Devasa sonuç raporu 'test/tenMillionSimulationReport.json' dosyasına yazıldı.\n");
    process.exit(0);
  }

  runMasterSimulation();
} else {
  // WORKER THREAD İÇİ SİMÜLATÖR
  const { workerId, games, campaignKey } = workerData;

  // Performans: Worker içinde gereksiz log string oluşturmayı devre dışı bırak
  MonopolyGame.prototype.addLog = () => {};

  const stats = {
    totalGames: games,
    validGames: 0,
    turnTimeouts: 0,
    wins: {},
    seatWins: [0, 0, 0, 0],
    roundSum: 0,
    jailEntries: 0,
    jailStalls: 0,
    jailWardFees: 0,
    jailBailsPaid: 0,
    jailForcedExits: 0,
    jailRentCollected: 0,
    threeHouseWins: 0,
    hotelWins: 0,
    hotelDiscountUses: 0,
    winningMonopolyGroups: {},
    auctionsTriggered: 0,
    auctionsSold: 0,
    monopolyDenialBids: 0,
    inflationRoundsTriggered: 0,
    suddenDeathTriggered: 0,
    bankLoansRequested: 0,
    bankLoansForeclosed: 0,
    roundDistribution: {
      under20: 0,
      rounds20to24: 0,
      rounds25to29: 0,
      rounds30to39: 0,
      rounds40plus: 0
    }
  };

  const reportBatch = Math.max(5000, Math.floor(games / 25));
  let unrecorded = 0;

  for (let g = 0; g < games; g++) {
    const game = new MonopolyGame(`W${workerId}_G${g}`);
    game.onStateUpdate = null;

    let roles = [];

    if (campaignKey === "CAMP_SELF_PLAY") {
      const archetypes = ["GRANDMASTER", "MONOPOLY_RUSHER", "CASH_TITAN", "AUCTION_SHARK", "TACTICAL_JAILER"];
      roles = [0, 1, 2, 3].map((s) => {
        const arch = archetypes[(s + (g % 5)) % 5];
        return { id: `p${s}`, name: arch, strategy: arch, isBot: false, diff: null };
      });
    } else if (campaignKey === "CAMP_GM_VS_BOTS") {
      const subMode = g % 5;
      let baseBots = [];
      if (subMode === 0) {
        // 1 GM vs 3 İmkansız
        baseBots = [{ name: "BOT_IMK1", diff: "imkansiz" }, { name: "BOT_IMK2", diff: "imkansiz" }, { name: "BOT_IMK3", diff: "imkansiz" }];
      } else if (subMode === 1) {
        // 1 GM vs 1 İmkansız, 1 Zor, 1 Orta
        baseBots = [{ name: "BOT_IMKANSIZ", diff: "imkansiz" }, { name: "BOT_ZOR", diff: "zor" }, { name: "BOT_ORTA", diff: "orta" }];
      } else if (subMode === 2) {
        // 1 GM vs 2 Zor, 1 Orta
        baseBots = [{ name: "BOT_ZOR1", diff: "zor" }, { name: "BOT_ZOR2", diff: "zor" }, { name: "BOT_ORTA", diff: "orta" }];
      } else if (subMode === 3) {
        // 1 GM vs 1 Zor, 1 Orta, 1 Kolay
        baseBots = [{ name: "BOT_ZOR", diff: "zor" }, { name: "BOT_ORTA", diff: "orta" }, { name: "BOT_KOLAY", diff: "kolay" }];
      } else {
        // 1 GM vs 3 Kolay
        baseBots = [{ name: "BOT_KOL1", diff: "kolay" }, { name: "BOT_KOL2", diff: "kolay" }, { name: "BOT_KOL3", diff: "kolay" }];
      }
      const allMembers = [{ name: "GRANDMASTER_SEN", strategy: "GRANDMASTER", isBot: false, diff: null }, ...baseBots];
      roles = allMembers.map((m, s) => {
        const rot = allMembers[(s + (g % 4)) % 4];
        return { id: `p${s}`, name: rot.name, strategy: rot.strategy || rot.name, isBot: rot.isBot !== false, diff: rot.diff };
      });
    } else if (campaignKey === "CAMP_BOTS_ONLY") {
      const subMode = g % 5;
      let botList = [];
      if (subMode === 0) {
        botList = [{ name: "BOT_IMKANSIZ", diff: "imkansiz" }, { name: "BOT_ZOR", diff: "zor" }, { name: "BOT_ORTA", diff: "orta" }, { name: "BOT_KOLAY", diff: "kolay" }];
      } else if (subMode === 1) {
        botList = [{ name: "BOT_IMK1", diff: "imkansiz" }, { name: "BOT_IMK2", diff: "imkansiz" }, { name: "BOT_IMK3", diff: "imkansiz" }, { name: "BOT_IMK4", diff: "imkansiz" }];
      } else if (subMode === 2) {
        botList = [{ name: "BOT_IMK1", diff: "imkansiz" }, { name: "BOT_IMK2", diff: "imkansiz" }, { name: "BOT_ZOR1", diff: "zor" }, { name: "BOT_ZOR2", diff: "zor" }];
      } else if (subMode === 3) {
        botList = [{ name: "BOT_IMKANSIZ", diff: "imkansiz" }, { name: "BOT_ORTA1", diff: "orta" }, { name: "BOT_ORTA2", diff: "orta" }, { name: "BOT_ORTA3", diff: "orta" }];
      } else {
        botList = [{ name: "BOT_ZOR1", diff: "zor" }, { name: "BOT_ZOR2", diff: "zor" }, { name: "BOT_ORTA", diff: "orta" }, { name: "BOT_KOLAY", diff: "kolay" }];
      }
      roles = botList.map((b, s) => {
        const rot = botList[(s + (g % 4)) % 4];
        return { id: `p${s}`, name: rot.name, strategy: rot.name, isBot: true, diff: rot.diff };
      });
    } else if (campaignKey === "CAMP_STRESS_ECONOMY") {
      // Yüksek Kredi Stresi ve Agresif Borçlanma Modu
      roles = [
        { name: "BORC_SEVER_1", strategy: "DEBT_USER", isBot: true, diff: "zor" },
        { name: "KREDI_KULLANAN_2", strategy: "DEBT_USER", isBot: true, diff: "orta" },
        { name: "KORUMACI_3", strategy: "CASH_TITAN", isBot: true, diff: "imkansiz" },
        { name: "GRANDMASTER_4", strategy: "GRANDMASTER", isBot: false, diff: null }
      ].map((r, s) => {
        const rot = [0, 1, 2, 3].map(i => [
          { name: "BORC_SEVER_1", strategy: "DEBT_USER", isBot: true, diff: "zor" },
          { name: "KREDI_KULLANAN_2", strategy: "DEBT_USER", isBot: true, diff: "orta" },
          { name: "KORUMACI_3", strategy: "CASH_TITAN", isBot: true, diff: "imkansiz" },
          { name: "GRANDMASTER_4", strategy: "GRANDMASTER", isBot: false, diff: null }
        ][(i + (g % 4)) % 4])[s];
        return { id: `p${s}`, name: rot.name, strategy: rot.strategy, isBot: rot.isBot, diff: rot.diff };
      });
    } else {
      // CAMP_AUCTION_TRADE: Açık artırma ve takas odaklı kaos
      roles = [
        { name: "AUCTION_SHARK_1", strategy: "AUCTION_SHARK", isBot: true, diff: "imkansiz" },
        { name: "AUCTION_SHARK_2", strategy: "AUCTION_SHARK", isBot: true, diff: "zor" },
        { name: "TRADER_BOT", strategy: "GRANDMASTER", isBot: true, diff: "imkansiz" },
        { name: "RUSHER_BOT", strategy: "MONOPOLY_RUSHER", isBot: true, diff: "orta" }
      ].map((r, s) => {
        const rot = [
          { name: "AUCTION_SHARK_1", strategy: "AUCTION_SHARK", isBot: true, diff: "imkansiz" },
          { name: "AUCTION_SHARK_2", strategy: "AUCTION_SHARK", isBot: true, diff: "zor" },
          { name: "TRADER_BOT", strategy: "GRANDMASTER", isBot: true, diff: "imkansiz" },
          { name: "RUSHER_BOT", strategy: "MONOPOLY_RUSHER", isBot: true, diff: "orta" }
        ][(s + (g % 4)) % 4];
        return { id: `p${s}`, name: rot.name, strategy: rot.strategy, isBot: rot.isBot, diff: rot.diff };
      });
    }

    for (let s = 0; s < 4; s++) {
      game.addPlayer(roles[s].id, roles[s].name, null, null, roles[s].isBot, null, roles[s].diff || "orta");
      game.players[s].strategyKey = roles[s].strategy;
    }

    game.startGame("p0");

    let rounds = 0;
    const MAX_ROUNDS = 70;
    let turnCount = 0;

    while (game.status === "playing" && rounds < MAX_ROUNDS && turnCount < 350) {
      turnCount++;
      const active = game.getActivePlayer();
      if (!active) break;

      const strat = active.strategyKey || "BOT_ORTA";

      // 1. Borç Tasfiyesi (Ev Satma, İpotek, Kredi, İflas)
      if (active.money < 0) {
        // Tekel dışı evleri sat
        for (let i = 0; i < BUYABLE_PROP_IDS.length; i++) {
          const tId = BUYABLE_PROP_IDS[i];
          const prop = game.properties[tId];
          if (prop && prop.ownerId === active.id && prop.houses > 0) {
            const tile = BOARD_TILES[tId];
            const groupIds = COLOR_GROUPS[tile.group] || [];
            const isMonopoly = groupIds.every(id => game.properties[id]?.ownerId === active.id);
            if (!isMonopoly) {
              game.sellHouse(active.id, tId);
              if (active.money >= 0) break;
            }
          }
        }
        // Tekel dışı arsaları ipotek et
        if (active.money < 0) {
          for (let i = 0; i < BUYABLE_PROP_IDS.length; i++) {
            const tId = BUYABLE_PROP_IDS[i];
            const prop = game.properties[tId];
            if (prop && prop.ownerId === active.id && !prop.mortgaged) {
              const tile = BOARD_TILES[tId];
              const groupIds = COLOR_GROUPS[tile.group] || [];
              const isMonopoly = groupIds.every(id => game.properties[id]?.ownerId === active.id);
              if (!isMonopoly) {
                game.mortgageProperty(active.id, tId);
                if (active.money >= 0) break;
              }
            }
          }
        }
        // Tekel evlerini sat
        if (active.money < 0) {
          for (let i = 0; i < BUYABLE_PROP_IDS.length; i++) {
            const tId = BUYABLE_PROP_IDS[i];
            const prop = game.properties[tId];
            if (prop && prop.ownerId === active.id && prop.houses > 0) {
              game.sellHouse(active.id, tId);
              if (active.money >= 0) break;
            }
          }
        }
        // Tekel arsalarını ipotek et
        if (active.money < 0) {
          for (let i = 0; i < BUYABLE_PROP_IDS.length; i++) {
            const tId = BUYABLE_PROP_IDS[i];
            const prop = game.properties[tId];
            if (prop && prop.ownerId === active.id && !prop.mortgaged) {
              game.mortgageProperty(active.id, tId);
              if (active.money >= 0) break;
            }
          }
        }
        // Acil Banka Kredisi
        if (active.money < 0) {
          stats.bankLoansRequested++;
          game.requestBankLoan(active.id, Math.min(500, Math.abs(active.money) + 50));
        }
        // İflas
        if (active.money < 0) {
          game.declareBankruptcy(active.id);
          if (game.status === "ended") break;
          continue;
        }
      }

      // 2. Kodes Kararı
      if (active.inJail) {
        stats.jailEntries++;
        if (strat === "GRANDMASTER" || strat === "AUCTION_SHARK" || strat === "TACTICAL_JAILER" || strat.includes("IMKANSIZ")) {
          const danger = Object.values(game.properties).some(p => p.ownerId && p.ownerId !== active.id && p.houses >= 2);
          if (rounds > 12 || danger) {
            stats.jailStalls++;
            // İçeride kal, çift atmayı dene
          } else {
            if (active.jailCards > 0) game.useJailCard(active.id);
            else if (active.money >= 180) {
              game.payJailFine(active.id);
              stats.jailBailsPaid++;
            }
          }
        } else {
          // Diğer botlar
          if (active.jailCards > 0) game.useJailCard(active.id);
          else if (active.money >= (strat.includes("ZOR") ? 140 : 180)) {
            game.payJailFine(active.id);
            stats.jailBailsPaid++;
          }
        }
      }

      // 3. Zar Atışı
      if (game.phase === "WAITING_ROLL") {
        const wasInJailBefore = active.inJail;
        const prevTurns = active.jailTurns;
        game.rollDice(active.id);

        if (wasInJailBefore && active.inJail) {
          // 15₺ iaşe masrafı kesildi
          stats.jailWardFees += 15;
        } else if (wasInJailBefore && !active.inJail && prevTurns >= 2) {
          // 3. tur mecburi çıkış (65₺ ceza)
          stats.jailForcedExits++;
        }
      }

      // 4. Kare Hamlesi (Satın Alma / Açık Artırma)
      if (game.phase === "TILE_ACTION") {
        const tile = game.currentTile;
        if (tile && ["property", "railroad", "utility"].includes(tile.type)) {
          let shouldBuy = false;
          const cost = tile.cost || 100;

          if (strat.includes("IMKANSIZ") || strat === "GRANDMASTER" || strat === "TACTICAL_JAILER") {
            let isMonopolyGoal = false;
            if (tile.group && COLOR_GROUPS[tile.group]) {
              const grp = COLOR_GROUPS[tile.group];
              const ownedCount = grp.filter(id => game.properties[id]?.ownerId === active.id).length;
              if (ownedCount >= 1) isMonopolyGoal = true;
              for (const opp of game.players) {
                if (opp.id !== active.id && !opp.isBankrupt) {
                  const oppOwned = grp.filter(id => game.properties[id]?.ownerId === opp.id).length;
                  if (oppOwned === grp.length - 1) isMonopolyGoal = true;
                }
              }
            }
            shouldBuy = isMonopolyGoal ? (active.money >= cost + 10) : (active.money >= cost + 25);
          } else if (strat === "CASH_TITAN") {
            shouldBuy = active.money >= (cost + 300);
          } else if (strat === "MONOPOLY_RUSHER") {
            shouldBuy = active.money >= (cost + 30);
          } else {
            const botDiff = active.difficulty || "orta";
            const botReserve = botDiff === "zor" ? 80 : (botDiff === "kolay" ? 200 : 120);
            shouldBuy = active.money >= (cost + botReserve);
          }

          if (shouldBuy) {
            game.buyCurrentProperty(active.id);
          } else {
            stats.auctionsTriggered++;
            game.declineBuy(active.id);
          }
        } else {
          game.phase = "TURN_ACTIONS";
        }
      }

      // 5. Açık Artırma Çözümleyici
      if (game.phase === "AUCTION" && game.auction) {
        const a = game.auction;
        let highestBid = a.currentBid || 10;
        let highestBidder = null;

        for (const p of game.players) {
          if (p.isBankrupt || a.passedPlayerIds.includes(p.id)) continue;
          const pStrat = p.strategyKey || p.name || "BOT_ORTA";
          let maxAffordable = p.money - 40;
          let bidCeiling = (a.tileCost || 100) * 1.0;

          if (pStrat === "AUCTION_SHARK") {
            bidCeiling = (a.tileCost || 100) * 1.45;
          } else if (pStrat.includes("IMKANSIZ") || pStrat === "GRANDMASTER") {
            maxAffordable = p.money - 20;
            let blocksOpp = false;
            let completesSelf = false;
            const aTile = BOARD_TILES[a.tileId];
            if (aTile?.group && COLOR_GROUPS[aTile.group]) {
              const grp = COLOR_GROUPS[aTile.group];
              const myCount = grp.filter(id => game.properties[id]?.ownerId === p.id).length;
              if (myCount === grp.length - 1) completesSelf = true;
              for (const opp of game.players) {
                if (opp.id !== p.id && !opp.isBankrupt) {
                  const oppCount = grp.filter(id => game.properties[id]?.ownerId === opp.id).length;
                  if (oppCount === grp.length - 1) blocksOpp = true;
                }
              }
            }
            if (completesSelf) bidCeiling = (a.tileCost || 100) * 1.65;
            else if (blocksOpp) {
              bidCeiling = (a.tileCost || 100) * 1.50;
              stats.monopolyDenialBids++;
            } else bidCeiling = (a.tileCost || 100) * 1.25;
          } else if (pStrat.includes("ZOR")) {
            bidCeiling = (a.tileCost || 100) * 1.15;
          } else if (pStrat.includes("KOLAY")) {
            bidCeiling = (a.tileCost || 100) * 0.60;
          } else {
            bidCeiling = (a.tileCost || 100) * 0.85;
          }

          const targetBid = Math.min(maxAffordable, Math.floor(bidCeiling));
          if (targetBid > highestBid) {
            highestBid = targetBid;
            highestBidder = p;
          }
        }

        if (highestBidder && highestBid > a.currentBid) {
          stats.auctionsSold++;
          highestBidder.money -= highestBid;
          const prop = game.properties[a.tileId];
          if (prop) prop.ownerId = highestBidder.id;
        }
        game.phase = "TURN_ACTIONS";
        game.auction = null;
      }

      // 6. İnşaat Fazı
      if (game.phase === "TURN_ACTIONS" && !active.isBankrupt) {
        const cashBuffer = strat === "CASH_TITAN" ? 350 : (strat.includes("IMKANSIZ") || strat === "GRANDMASTER" ? 75 : 180);

        for (const groupName in COLOR_GROUPS) {
          if (groupName === "railroad" || groupName === "utility") continue;
          const groupTiles = COLOR_GROUPS[groupName];
          const ownsAll = groupTiles.every(id => game.properties[id]?.ownerId === active.id && !game.properties[id]?.mortgaged);

          if (ownsAll) {
            for (let i = 0; i < groupTiles.length; i++) {
              const tId = groupTiles[i];
              const prop = game.properties[tId];
              const tile = BOARD_TILES[tId];
              const isHotelTransition = prop.houses === 4;
              const cost = isHotelTransition ? Math.round((tile.houseCost || 100) * 0.85) : (tile.houseCost || 100);

              const targetHouses = (strat.includes("IMKANSIZ") || strat === "GRANDMASTER" || strat === "MONOPOLY_RUSHER")
                ? (prop.houses < 3 ? 3 : (active.money > 350 ? 5 : 3))
                : (strat === "CASH_TITAN" ? 3 : (active.money > 600 ? 5 : 3));

              if (prop.houses < targetHouses && active.money >= (cost + cashBuffer)) {
                if (isHotelTransition) stats.hotelDiscountUses++;
                game.buildHouse(active.id, tId);
              }
            }
          }
        }

        if (game.roundNumber >= 20) stats.inflationRoundsTriggered++;
        if (game.roundNumber >= 40) stats.suddenDeathTriggered++;

        game.endTurn(active.id);
        rounds = game.roundNumber || rounds + 1;
      }
    }

    // Oyun Sonu Veri Kaydı
    if (game.winner) {
      stats.validGames++;
      const finalRound = game.roundNumber || 1;
      stats.roundSum += finalRound;

      if (finalRound < 20) stats.roundDistribution.under20++;
      else if (finalRound < 25) stats.roundDistribution.rounds20to24++;
      else if (finalRound < 30) stats.roundDistribution.rounds25to29++;
      else if (finalRound < 40) stats.roundDistribution.rounds30to39++;
      else stats.roundDistribution.rounds40plus++;

      const winKey = game.winner.strategyKey || game.winner.name || "UNKNOWN";
      stats.wins[winKey] = (stats.wins[winKey] || 0) + 1;

      const seat = game.players.findIndex(p => p.id === game.winner.id);
      if (seat >= 0 && seat < 4) stats.seatWins[seat]++;

      let hasThreeHouse = false;
      let hasHotel = false;

      for (const groupName in COLOR_GROUPS) {
        const groupTiles = COLOR_GROUPS[groupName];
        const winnerMonopoly = groupTiles.every(id => game.properties[id]?.ownerId === game.winner.id);
        if (winnerMonopoly) {
          stats.winningMonopolyGroups[groupName] = (stats.winningMonopolyGroups[groupName] || 0) + 1;
        }
      }

      for (let i = 0; i < BUYABLE_PROP_IDS.length; i++) {
        const tId = BUYABLE_PROP_IDS[i];
        const prop = game.properties[tId];
        if (prop && prop.ownerId === game.winner.id) {
          if (prop.houses >= 3) hasThreeHouse = true;
          if (prop.houses === 5) hasHotel = true;
        }
      }
      if (hasThreeHouse) stats.threeHouseWins++;
      if (hasHotel) stats.hotelWins++;
    } else {
      stats.turnTimeouts++;
    }

    unrecorded++;
    if (unrecorded >= reportBatch) {
      parentPort.postMessage({ type: "progress", count: unrecorded });
      unrecorded = 0;
    }
  }

  if (unrecorded > 0) {
    parentPort.postMessage({ type: "progress", count: unrecorded });
  }

  parentPort.postMessage({ type: "result", data: stats });
}

