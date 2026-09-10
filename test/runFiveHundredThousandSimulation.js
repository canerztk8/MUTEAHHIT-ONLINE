import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";
import { MonopolyGame } from "../server/game/MonopolyGame.js";
import { BOARD_TILES, COLOR_GROUPS } from "../server/game/boardData.js";

const __filename = fileURLToPath(import.meta.url);

const EXPERIMENT_GAMES = parseInt(process.argv[2], 10) || 100000;
const numWorkers = Math.min(16, os.cpus().length || 4);

if (isMainThread) {
  console.log(`================================================================================`);
  console.log(`🏆 500.000 MAÇLIK BÜYÜK KODESTEN KAÇIŞ VE SİSTEM ÇÖKÜŞÜ SİMÜLASYONU`);
  console.log(`⚡ Deney 1: 100.000 Maç Kendine Karşı (Grandmaster Self-Play)`);
  console.log(`⚡ Deney 2: 100.000 Maç Sen (Grandmaster) vs 3 Bot (İmkansız / Zor / Orta)`);
  console.log(`⚡ Deney 3: 100.000 Maç Botlar Kendi Arasında (İmkansız / Zor / Orta / Kolay)`);
  console.log(`⚡ Deney 4: 100.000 Maç Kodes Fırsat Maliyeti & Beleş Kira Telemetrisi`);
  console.log(`⚡ Deney 5: 100.000 Maç Ekstrem Kıyamet, Kayyum & Hiperenflasyon Stres Testi`);
  console.log(`🔥 16 Çekirdek Paralel İş Parçacığı | Deney Başına: ${EXPERIMENT_GAMES.toLocaleString("tr-TR")} Maç`);
  console.log(`================================================================================\n`);

  async function runExperiment(modeName, modeKey) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const gamesPerWorker = Math.floor(EXPERIMENT_GAMES / numWorkers);
      let completedWorkers = 0;
      let totalSimulated = 0;

      const combined = {
        mode: modeKey,
        modeName,
        totalGames: 0,
        validGames: 0,
        turnTimeouts: 0,
        wins: {},
        seatWins: [0, 0, 0, 0],
        roundSum: 0,
        roundHistogram: {
          under20: 0,
          rounds20to24: 0,
          rounds25to31: 0,
          rounds32to39: 0,
          rounds40to49: 0,
          rounds50plus: 0
        },
        jailStalls: 0,
        jailEarlyExits: 0,
        jailZeroRentBlockedCount: 0, // 40+ turda mülk sahibinin kodeste olup 0₺ ödenen beleş kira
        jailZeroRentBlockedAmount: 0, // Kaç TL beleşe basıldı
        jailDiscountedRentCount: 0, // 12-39 turlarda indirimli ödenen kira
        jailDiscountedRentSaved: 0, // Rakiplerin indirim sayesinde cebinde kalan para
        threeHouseWins: 0,
        hotelWins: 0,
        railroadWins: 0,
        bankLoansDeniedAt40: 0,
        highInterestUnmortgages: 0,
        thresholdReach: {
          round15: 0,
          round20: 0,
          round25: 0,
          round32: 0,
          round40: 0,
          round50: 0
        }
      };

      console.log(`▶️ BAŞLIYOR: [${modeName}] (${EXPERIMENT_GAMES.toLocaleString("tr-TR")} Maç)...`);

      for (let i = 0; i < numWorkers; i++) {
        const worker = new Worker(__filename, {
          workerData: { workerId: i, games: gamesPerWorker, mode: modeKey }
        });

        worker.on("message", (msg) => {
          if (msg.type === "progress") {
            totalSimulated += msg.count;
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const rate = Math.floor(totalSimulated / (elapsed || 0.001));
            process.stdout.write(`\r  [${modeKey}] ${totalSimulated.toLocaleString("tr-TR")} / ${EXPERIMENT_GAMES.toLocaleString("tr-TR")} (%${((totalSimulated / EXPERIMENT_GAMES) * 100).toFixed(1)}) | Hız: ${rate.toLocaleString("tr-TR")} maç/s`);
          } else if (msg.type === "result") {
            const r = msg.data;
            combined.totalGames += r.totalGames;
            combined.validGames += r.validGames;
            combined.turnTimeouts += r.turnTimeouts;
            combined.roundSum += r.roundSum;
            combined.jailStalls += r.jailStalls;
            combined.jailEarlyExits += r.jailEarlyExits;
            combined.jailZeroRentBlockedCount += r.jailZeroRentBlockedCount;
            combined.jailZeroRentBlockedAmount += r.jailZeroRentBlockedAmount;
            combined.jailDiscountedRentCount += r.jailDiscountedRentCount;
            combined.jailDiscountedRentSaved += r.jailDiscountedRentSaved;
            combined.threeHouseWins += r.threeHouseWins;
            combined.hotelWins += r.hotelWins;
            combined.railroadWins += r.railroadWins;
            combined.bankLoansDeniedAt40 += r.bankLoansDeniedAt40;
            combined.highInterestUnmortgages += r.highInterestUnmortgages;

            for (let s = 0; s < 4; s++) combined.seatWins[s] += r.seatWins[s];
            for (const k in r.wins) {
              combined.wins[k] = (combined.wins[k] || 0) + r.wins[k];
            }
            for (const h in r.roundHistogram) {
              combined.roundHistogram[h] += r.roundHistogram[h];
            }
            for (const t in r.thresholdReach) {
              combined.thresholdReach[t] += r.thresholdReach[t];
            }

            completedWorkers++;
            if (completedWorkers === numWorkers) {
              const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
              const finalRate = Math.floor(EXPERIMENT_GAMES / totalDuration);
              console.log(`\n  ✅ Tamamlandı! Süre: ${totalDuration}s (${finalRate.toLocaleString("tr-TR")} maç/s)\n`);
              resolve(combined);
            }
          }
        });
      }
    });
  }

  async function runAll() {
    const overallStart = Date.now();
    const exp1 = await runExperiment("DENEY 1: USTA KENDİNE KARŞI (SELF-PLAY)", "SELF_PLAY");
    const exp2 = await runExperiment("DENEY 2: SEN (GRANDMASTER) BOTLARA KARŞI", "GM_VS_BOTS");
    const exp3 = await runExperiment("DENEY 3: BOTLAR KENDİ ARASINDA (ZORLUK SAVAŞI)", "BOTS_ONLY");
    const exp4 = await runExperiment("DENEY 4: KODES FIRSAT MALİYETİ & BELEŞ KİRA TESTİ", "JAIL_COST_TEST");
    const exp5 = await runExperiment("DENEY 5: EKSTREM KIYAMET, KAYYUM & HİPERENFLASYON", "CRISIS_STRESS");

    const totalSec = ((Date.now() - overallStart) / 1000).toFixed(2);
    console.log(`================================================================================`);
    console.log(`🎉 TÜM 500.000 MAÇ ${totalSec} SANİYEDE TAMAMLANDI!`);
    console.log(`================================================================================\n`);

    const finalReport = {
      timestamp: new Date().toISOString(),
      totalDurationSeconds: totalSec,
      totalSimulatedGames: EXPERIMENT_GAMES * 5,
      experiments: { exp1, exp2, exp3, exp4, exp5 }
    };

    fs.writeFileSync(
      new URL("./fiveHundredThousandResults.json", import.meta.url),
      JSON.stringify(finalReport, null, 2),
      "utf-8"
    );
    console.log("📁 Sonuçlar test/fiveHundredThousandResults.json dosyasına kaydedildi.\n");
  }

  runAll();
} else {
  // WORKER THREAD LOGIC
  const { workerId, games, mode } = workerData;

  const res = {
    totalGames: games,
    validGames: 0,
    turnTimeouts: 0,
    wins: {},
    seatWins: [0, 0, 0, 0],
    roundSum: 0,
    roundHistogram: {
      under20: 0,
      rounds20to24: 0,
      rounds25to31: 0,
      rounds32to39: 0,
      rounds40to49: 0,
      rounds50plus: 0
    },
    jailStalls: 0,
    jailEarlyExits: 0,
    jailZeroRentBlockedCount: 0,
    jailZeroRentBlockedAmount: 0,
    jailDiscountedRentCount: 0,
    jailDiscountedRentSaved: 0,
    threeHouseWins: 0,
    hotelWins: 0,
    railroadWins: 0,
    bankLoansDeniedAt40: 0,
    highInterestUnmortgages: 0,
    thresholdReach: {
      round15: 0,
      round20: 0,
      round25: 0,
      round32: 0,
      round40: 0,
      round50: 0
    }
  };

  const reportBatch = Math.max(500, Math.floor(games / 25));
  let unrecorded = 0;

  for (let g = 0; g < games; g++) {
    const game = new MonopolyGame(`W${workerId}_G${g}`);
    game.addLog = () => {};
    game.onStateUpdate = null;

    let roles = [];
    if (mode === "SELF_PLAY") {
      const archetypes = ["GRANDMASTER", "MONOPOLY_RUSHER", "CASH_TITAN", "AUCTION_SHARK"];
      roles = archetypes.map((arch, s) => ({
        id: `p${s}`,
        name: arch,
        strategy: archetypes[(s + (g % 4)) % 4],
        isBot: false,
        diff: null
      }));
    } else if (mode === "GM_VS_BOTS") {
      const baseRoles = [
        { name: "GRANDMASTER_SEN", strategy: "GRANDMASTER", isBot: false, diff: null },
        { name: "BOT_IMKANSIZ", strategy: "BOT_IMKANSIZ", isBot: true, diff: "imkansiz" },
        { name: "BOT_ZOR", strategy: "BOT_ZOR", isBot: true, diff: "zor" },
        { name: "BOT_ORTA", strategy: "BOT_ORTA", isBot: true, diff: "orta" }
      ];
      roles = baseRoles.map((r, s) => {
        const rotated = baseRoles[(s + (g % 4)) % 4];
        return {
          id: `p${s}`,
          name: rotated.name,
          strategy: rotated.strategy,
          isBot: rotated.isBot,
          diff: rotated.diff
        };
      });
    } else if (mode === "BOTS_ONLY") {
      const botDiffs = [
        { name: "BOT_IMKANSIZ", diff: "imkansiz" },
        { name: "BOT_ZOR", diff: "zor" },
        { name: "BOT_ORTA", diff: "orta" },
        { name: "BOT_KOLAY", diff: "kolay" }
      ];
      roles = botDiffs.map((b, s) => {
        const rotated = botDiffs[(s + (g % 4)) % 4];
        return {
          id: `p${s}`,
          name: rotated.name,
          strategy: rotated.name,
          isBot: true,
          diff: rotated.diff
        };
      });
    } else if (mode === "JAIL_COST_TEST") {
      // 2 Grandmaster (yeni fırsat maliyetli erken kodes çıkışı) vs 2 Eski Usul Pasif Kodes Botu
      const testRoles = [
        { name: "GM_AGRESSIVE_EXIT", strategy: "GRANDMASTER", isBot: false, diff: null },
        { name: "GM_SHARK_EXIT", strategy: "AUCTION_SHARK", isBot: false, diff: null },
        { name: "BOT_IMKANSIZ_SMART", strategy: "BOT_IMKANSIZ", isBot: true, diff: "imkansiz" },
        { name: "BOT_ZOR_STANDARD", strategy: "BOT_ZOR", isBot: true, diff: "zor" }
      ];
      roles = testRoles.map((r, s) => {
        const rotated = testRoles[(s + (g % 4)) % 4];
        return {
          id: `p${s}`,
          name: rotated.name,
          strategy: rotated.strategy,
          isBot: rotated.isBot,
          diff: rotated.diff
        };
      });
    } else if (mode === "CRISIS_STRESS") {
      const stressRoles = [
        { name: "GM_AGRESSIVE", strategy: "GRANDMASTER", isBot: false, diff: null },
        { name: "GM_DEFENSIVE", strategy: "CASH_TITAN", isBot: false, diff: null },
        { name: "BOT_IMKANSIZ_A", strategy: "BOT_IMKANSIZ", isBot: true, diff: "imkansiz" },
        { name: "BOT_IMKANSIZ_B", strategy: "BOT_IMKANSIZ", isBot: true, diff: "imkansiz" }
      ];
      roles = stressRoles.map((r, s) => {
        const rotated = stressRoles[(s + (g % 4)) % 4];
        return {
          id: `p${s}`,
          name: rotated.name,
          strategy: rotated.strategy,
          isBot: rotated.isBot,
          diff: rotated.diff
        };
      });
    }

    for (let s = 0; s < 4; s++) {
      game.addPlayer(roles[s].id, roles[s].name, null, null, roles[s].isBot, null, roles[s].diff || "orta");
      game.players[s].strategyKey = roles[s].strategy;
    }

    game.startGame("p0");

    let rounds = 1;
    const MAX_ROUNDS = 75;
    let turnCount = 0;

    let reached15 = false;
    let reached20 = false;
    let reached25 = false;
    let reached32 = false;
    let reached40 = false;
    let reached50 = false;

    while (game.status === "playing" && rounds < MAX_ROUNDS && turnCount < 400) {
      turnCount++;
      const active = game.getActivePlayer();
      if (!active) break;

      const currentRound = game.roundNumber || 1;
      if (!reached15 && currentRound >= 15) { reached15 = true; res.thresholdReach.round15++; }
      if (!reached20 && currentRound >= 20) { reached20 = true; res.thresholdReach.round20++; }
      if (!reached25 && currentRound >= 25) { reached25 = true; res.thresholdReach.round25++; }
      if (!reached32 && currentRound >= 32) { reached32 = true; res.thresholdReach.round32++; }
      if (!reached40 && currentRound >= 40) { reached40 = true; res.thresholdReach.round40++; }
      if (!reached50 && currentRound >= 50) { reached50 = true; res.thresholdReach.round50++; }

      const strat = active.strategyKey || "BOT_ORTA";

      // Borç Tasfiyesi (Grandmaster & Bot Kriz Yönetimi)
      if (active.money < 0) {
        // 1. Tekel dışı evleri sat
        for (const tId in game.properties) {
          const prop = game.properties[tId];
          if (prop.ownerId === active.id && prop.houses > 0) {
            const tile = BOARD_TILES[tId];
            const groupIds = COLOR_GROUPS[tile.group] || [];
            const isMonopoly = groupIds.every(id => game.properties[id]?.ownerId === active.id);
            if (!isMonopoly) {
              game.sellHouse(active.id, Number(tId));
              if (active.money >= 0) break;
            }
          }
        }
        // 2. Tekel dışı arsaları ipotek et
        if (active.money < 0) {
          for (const tId in game.properties) {
            const prop = game.properties[tId];
            if (prop.ownerId === active.id && !prop.mortgaged) {
              const tile = BOARD_TILES[tId];
              const groupIds = COLOR_GROUPS[tile.group] || [];
              const isMonopoly = groupIds.every(id => game.properties[id]?.ownerId === active.id);
              if (!isMonopoly) {
                game.mortgageProperty(active.id, Number(tId));
                if (active.money >= 0) break;
              }
            }
          }
        }
        // 3. Tekel evlerini sat
        if (active.money < 0) {
          for (const tId in game.properties) {
            const prop = game.properties[tId];
            if (prop.ownerId === active.id && prop.houses > 0) {
              game.sellHouse(active.id, Number(tId));
              if (active.money >= 0) break;
            }
          }
        }
        // 4. Tekel arsalarını ipotek et
        if (active.money < 0) {
          for (const tId in game.properties) {
            const prop = game.properties[tId];
            if (prop.ownerId === active.id && !prop.mortgaged) {
              game.mortgageProperty(active.id, Number(tId));
              if (active.money >= 0) break;
            }
          }
        }
        // 5. Acil Banka Kredisi (40. turdan sonra banka iflası)
        if (active.money < 0) {
          if (currentRound >= 40) {
            res.bankLoansDeniedAt40++;
          } else {
            game.requestBankLoan(active.id, Math.min(500, Math.abs(active.money) + 50));
          }
        }
        // İflas
        if (active.money < 0) {
          game.declareBankruptcy(active.id);
          if (game.status === "ended") break;
          continue;
        }
      }

      // Kodes Kararı (Yeni Kademeli Fırsat Maliyeti Matrisi)
      if (active.inJail) {
        const jailFine = game.getJailFine();
        let myRentPower = 0;
        for (const tid in game.properties) {
          const prop = game.properties[tid];
          if (prop.ownerId === active.id && !prop.mortgaged) {
            const tile = BOARD_TILES[tid];
            myRentPower += (tile?.rent ? (tile.rent[prop.houses] || tile.rent[0]) : 50);
          }
        }

        // 40+ Tur: %0 Kayyum Blokesi! Mülk varsa içeride kalmak intihardır!
        // 32+ Tur: %25 Kira! Mülk gücü yüksekse fırsat maliyeti çok ağırdır!
        const mustExitDueToLostRent = (currentRound >= 40 && myRentPower > 0) || (currentRound >= 32 && myRentPower >= 200);

        if (strat === "GRANDMASTER" || strat === "AUCTION_SHARK" || strat === "BOT_IMKANSIZ") {
          if (mustExitDueToLostRent) {
            res.jailEarlyExits++;
            if (active.jailCards > 0) game.useJailCard(active.id);
            else if (active.money >= jailFine) game.payJailFine(active.id);
          } else {
            const opponentThreatOnBoard = Object.values(game.properties).some(
              p => p.ownerId && p.ownerId !== active.id && p.houses >= 2
            );
            // Sadece 12-31 turlarda ve mülk geliri düşükken sığınak mantıklıdır
            if (currentRound > 12 && currentRound < 32 && opponentThreatOnBoard && myRentPower < 150) {
              res.jailStalls++;
              // Çift atmayı dene
            } else {
              res.jailEarlyExits++;
              if (active.jailCards > 0) game.useJailCard(active.id);
              else if (active.money >= jailFine + 80) game.payJailFine(active.id);
            }
          }
        } else {
          // Diğer botlar
          if (active.jailCards > 0) {
            res.jailEarlyExits++;
            game.useJailCard(active.id);
          } else if (mustExitDueToLostRent ? active.money >= jailFine : active.money > jailFine + (strat === "BOT_ZOR" ? 60 : 120)) {
            res.jailEarlyExits++;
            game.payJailFine(active.id);
          } else {
            res.jailStalls++;
          }
        }
      }

      // Zar Atışı
      if (game.phase === "WAITING_ROLL") {
        game.rollDice(active.id);
      }

      // Kare Hamlesi & Beleş Kira Telemetrisi
      if (game.phase === "TILE_ACTION") {
        const tile = game.currentTile;
        if (tile && ["property", "railroad", "utility"].includes(tile.type)) {
          const propState = game.properties[tile.id];
          if (propState && propState.ownerId && propState.ownerId !== active.id && !propState.mortgaged) {
            const tileOwner = game.players.find(p => p.id === propState.ownerId);
            if (tileOwner && tileOwner.inJail) {
              const fullRent = game.calculateRent(tile.id, 7); // Şu anki kademeli kira
              const jailRate = game.getJailRentRate();
              if (jailRate === 0) {
                // 40+ Tur Kayyum Blokesi: Rakipler beleşe bastı!
                res.jailZeroRentBlockedCount++;
                // Nominal taban kira değerini kayıp olarak hesapla
                const nominalRent = tile.rent ? (tile.rent[propState.houses] || tile.rent[0]) * 2 : 350;
                res.jailZeroRentBlockedAmount += nominalRent;
              } else if (jailRate < 1) {
                res.jailDiscountedRentCount++;
                const nominalRent = Math.round(fullRent / jailRate);
                res.jailDiscountedRentSaved += (nominalRent - fullRent);
              }
            }
          }

          let shouldBuy = false;
          const cost = tile.cost || 100;
          const reserve = strat === "CASH_TITAN" ? 250 : (strat === "GRANDMASTER" ? 120 : 50);

          if (strat === "BOT_IMKANSIZ" || strat === "GRANDMASTER") {
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
          } else if (strat.startsWith("BOT_")) {
            const botDiff = active.difficulty || "orta";
            const botReserve = botDiff === "zor" ? 70 : 40;
            shouldBuy = active.money >= (cost + botReserve);
          } else {
            shouldBuy = active.money >= (cost + reserve);
          }

          if (shouldBuy) {
            game.buyCurrentProperty(active.id);
          } else {
            game.declineBuy(active.id);
          }
        } else {
          game.phase = "TURN_ACTIONS";
        }
      }

      // Açık Artırma Çözümleyici
      if (game.phase === "AUCTION" && game.auction) {
        const a = game.auction;
        let highestBid = a.currentBid || 10;
        let highestBidder = null;

        for (const p of game.players) {
          if (p.isBankrupt || a.passedPlayerIds.includes(p.id)) continue;
          const pStrat = p.strategyKey || "BOT_ORTA";
          let maxAffordable = p.money - 30;
          let bidCeiling = (a.tileCost || 100) * 1.0;

          if (pStrat === "AUCTION_SHARK" || pStrat === "GRANDMASTER") {
            bidCeiling = (a.tileCost || 100) * 1.35;
          } else if (pStrat === "BOT_IMKANSIZ") {
            maxAffordable = p.money - 15;
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
            else if (blocksOpp) bidCeiling = (a.tileCost || 100) * 1.50;
            else bidCeiling = (a.tileCost || 100) * 1.25;
          } else if (pStrat === "BOT_ZOR") {
            bidCeiling = (a.tileCost || 100) * 1.15;
          } else if (pStrat === "BOT_KOLAY") {
            bidCeiling = (a.tileCost || 100) * 0.8;
          }

          const targetBid = Math.min(maxAffordable, Math.floor(bidCeiling));
          if (targetBid > highestBid) {
            highestBid = targetBid;
            highestBidder = p;
          }
        }

        if (highestBidder && highestBid > a.currentBid) {
          highestBidder.money -= highestBid;
          const prop = game.properties[a.tileId];
          if (prop) prop.ownerId = highestBidder.id;
        }
        game.phase = "TURN_ACTIONS";
        game.auction = null;
      }

      // İnşaat Fazı (Three-House Rule & Otel İndirimi)
      if (game.phase === "TURN_ACTIONS" && !active.isBankrupt) {
        const cashBuffer = strat === "CASH_TITAN" ? 300 : (strat === "GRANDMASTER" ? 150 : (strat === "BOT_IMKANSIZ" ? 60 : (strat === "BOT_ZOR" ? 160 : 60)));
        for (const groupName in COLOR_GROUPS) {
          if (groupName === "railroad" || groupName === "utility") continue;
          const groupTiles = COLOR_GROUPS[groupName];
          const ownsAll = groupTiles.every(id => game.properties[id]?.ownerId === active.id && !game.properties[id]?.mortgaged);
          if (ownsAll) {
            for (const tId of groupTiles) {
              const prop = game.properties[tId];
              const tile = BOARD_TILES[tId];
              const cost = prop.houses === 4 ? Math.round((tile.houseCost || 100) * 0.85) : (tile.houseCost || 100);

              const targetHouses = (strat === "MONOPOLY_RUSHER" || strat === "BOT_IMKANSIZ" || strat === "GRANDMASTER")
                ? (prop.houses < 3 ? 3 : (active.money > 300 ? 5 : 3))
                : (strat === "CASH_TITAN" ? 3 : (active.money > 500 ? 5 : 3));

              if (prop.houses < targetHouses && active.money >= (cost + cashBuffer)) {
                game.buildHouse(active.id, Number(tId));
              }
            }
          }
        }

        // İpotek Kaldırma Stratejisi
        if (active.money > 500) {
          for (const tId in game.properties) {
            const prop = game.properties[tId];
            if (prop.ownerId === active.id && prop.mortgaged) {
              const tile = BOARD_TILES[tId];
              const interest = currentRound >= 40 ? 1.5 : 1.1;
              const unCost = Math.round(tile.mortgage * interest);
              if (active.money >= unCost + cashBuffer) {
                const unRes = game.unmortgageProperty(active.id, Number(tId));
                if (unRes.success && currentRound >= 40) res.highInterestUnmortgages++;
              }
            }
          }
        }

        game.endTurn(active.id);
        rounds = game.roundNumber || rounds + 1;
      }
    }

    // Oyun Bitiş İstatistikleri
    if (game.winner) {
      res.validGames++;
      const endRound = game.roundNumber || 1;
      res.roundSum += endRound;

      if (endRound < 20) res.roundHistogram.under20++;
      else if (endRound < 25) res.roundHistogram.rounds20to24++;
      else if (endRound < 32) res.roundHistogram.rounds25to31++;
      else if (endRound < 40) res.roundHistogram.rounds32to39++;
      else if (endRound < 50) res.roundHistogram.rounds40to49++;
      else res.roundHistogram.rounds50plus++;

      const winStrat = game.winner.strategyKey || "UNKNOWN";
      res.wins[winStrat] = (res.wins[winStrat] || 0) + 1;

      const seat = game.players.findIndex(p => p.id === game.winner.id);
      if (seat >= 0 && seat < 4) res.seatWins[seat]++;

      let hasThreeHouse = false;
      let hasHotel = false;
      let winnerRailroadCount = 0;
      for (const tId in game.properties) {
        const prop = game.properties[tId];
        if (prop.ownerId === game.winner.id) {
          if (prop.houses >= 3) hasThreeHouse = true;
          if (prop.houses === 5) hasHotel = true;
          if (COLOR_GROUPS.railroad.includes(Number(tId))) winnerRailroadCount++;
        }
      }
      if (hasThreeHouse) res.threeHouseWins++;
      if (hasHotel) res.hotelWins++;
      if (winnerRailroadCount >= 2) res.railroadWins++;
    } else {
      res.turnTimeouts++;
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

  parentPort.postMessage({ type: "result", data: res });
}
