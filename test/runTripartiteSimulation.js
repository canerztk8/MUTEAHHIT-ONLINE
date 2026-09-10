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
  console.log(`🏆 300.000 MAÇLIK ÜÇLÜ BÜYÜK KARŞILAŞTIRMA SİMÜLASYONU`);
  console.log(`⚡ 1. Deney: 100.000 Maç Kendine Karşı (Grandmaster Self-Play)`);
  console.log(`⚡ 2. Deney: 100.000 Maç Sen (Grandmaster) vs 3 Bot (Zor / Orta / Kolay)`);
  console.log(`⚡ 3. Deney: 100.000 Maç Botlar Kendi Arasında (İmkansız / Zor / Orta / Kolay)`);
  console.log(`🔥 16 Çekirdek AMD Ryzen | İşçi Başına: ${Math.floor(EXPERIMENT_GAMES / numWorkers).toLocaleString("tr-TR")} Maç`);
  console.log(`================================================================================\n`);

  async function runExperiment(modeName, modeKey) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const gamesPerWorker = Math.floor(EXPERIMENT_GAMES / numWorkers);
      let completedWorkers = 0;
      let totalSimulated = 0;

      const combined = {
        mode: modeKey,
        totalGames: 0,
        validGames: 0,
        turnTimeouts: 0,
        wins: {},
        seatWins: [0, 0, 0, 0],
        roundSum: 0,
        jailStalls: 0,
        threeHouseWins: 0,
        hotelWins: 0,
        inflationRoundsTriggered: 0,
        suddenDeathTriggered: 0
      };

      console.log(`\n▶️ BAŞLIYOR: [${modeName}] (${EXPERIMENT_GAMES.toLocaleString("tr-TR")} Maç)...`);

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
            combined.threeHouseWins += r.threeHouseWins;
            combined.hotelWins += r.hotelWins;
            combined.inflationRoundsTriggered += r.inflationRoundsTriggered;
            combined.suddenDeathTriggered += r.suddenDeathTriggered;

            for (let s = 0; s < 4; s++) combined.seatWins[s] += r.seatWins[s];
            for (const k in r.wins) {
              combined.wins[k] = (combined.wins[k] || 0) + r.wins[k];
            }

            completedWorkers++;
            if (completedWorkers === numWorkers) {
              const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
              const finalRate = Math.floor(EXPERIMENT_GAMES / totalDuration);
              console.log(`\n  ✅ Tamamlandı! Süre: ${totalDuration}s (${finalRate.toLocaleString("tr-TR")} maç/s)`);
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

    const totalSec = ((Date.now() - overallStart) / 1000).toFixed(2);
    console.log(`\n================================================================================`);
    console.log(`🎉 TÜM 300.000 MAÇ ${totalSec} SANİYEDE TAMAMLANDI!`);
    console.log(`================================================================================\n`);

    const finalReport = {
      timestamp: new Date().toISOString(),
      totalDurationSeconds: totalSec,
      experiment1_SelfPlay: exp1,
      experiment2_GmVsBots: exp2,
      experiment3_BotsOnly: exp3
    };

    fs.writeFileSync("test/tripartiteSimulationReport.json", JSON.stringify(finalReport, null, 2));
    console.log("📁 Sonuçlar 'test/tripartiteSimulationReport.json' dosyasına kaydedildi.\n");
    process.exit(0);
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
    jailStalls: 0,
    threeHouseWins: 0,
    hotelWins: 0,
    inflationRoundsTriggered: 0,
    suddenDeathTriggered: 0
  };

  const reportBatch = Math.max(500, Math.floor(games / 20));
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
        isBot: false
      }));
    } else if (mode === "GM_VS_BOTS") {
      // 1 Grandmaster (Sen), 3 Bot (Zor, Orta, Kolay)
      const baseRoles = [
        { name: "GRANDMASTER_SEN", strategy: "GRANDMASTER", isBot: false, diff: null },
        { name: "BOT_ZOR", strategy: "BOT_ZOR", isBot: true, diff: "zor" },
        { name: "BOT_ORTA", strategy: "BOT_ORTA", isBot: true, diff: "orta" },
        { name: "BOT_KOLAY", strategy: "BOT_KOLAY", isBot: true, diff: "kolay" }
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
      // 4 Farklı Bot Zorluğu
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
        // 5. Acil Banka Kredisi
        if (active.money < 0) {
          game.requestBankLoan(active.id, Math.min(500, Math.abs(active.money) + 50));
        }
        // İflas
        if (active.money < 0) {
          game.declareBankruptcy(active.id);
          if (game.status === "ended") break;
          continue;
        }
      }

      // Kodes Kararı
      if (active.inJail) {
        if (strat === "GRANDMASTER" || strat === "AUCTION_SHARK" || strat === "BOT_IMKANSIZ") {
          // 12. turdan sonra veya dışarıda tehlike varsa pusuya yat
          const danger = Object.values(game.properties).some(p => p.ownerId && p.ownerId !== active.id && p.houses >= 2);
          if (rounds > 12 || danger) {
            res.jailStalls++;
            // Çift atmayı dene, kefalet ödeme
          } else {
            if (active.jailCards > 0) game.useJailCard(active.id);
            else if (active.money >= 180) game.payJailFine(active.id);
          }
        } else {
          // Botlar veya Rusher: Nakdi varsa hemen uzlaşma öder
          if (active.jailCards > 0) game.useJailCard(active.id);
          else if (active.money >= (strat === "BOT_ZOR" ? 140 : 180)) game.payJailFine(active.id);
        }
      }

      // Zar Atışı
      if (game.phase === "WAITING_ROLL") {
        game.rollDice(active.id);
      }

      // Kare Hamlesi (Satın Alma / Açık Artırma)
      if (game.phase === "TILE_ACTION") {
        const tile = game.currentTile;
        if (tile && ["property", "railroad", "utility"].includes(tile.type)) {
          let shouldBuy = false;
          const cost = tile.cost || 100;
          const reserve = strat === "CASH_TITAN" ? 300 : (strat === "GRANDMASTER" ? 150 : 60);

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
            const botReserve = botDiff === "zor" ? 80 : 50;
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
          let maxAffordable = p.money - 40;
          let bidCeiling = (a.tileCost || 100) * 1.0;

          if (pStrat === "AUCTION_SHARK" || pStrat === "GRANDMASTER") {
            bidCeiling = (a.tileCost || 100) * 1.35; // Blokaj için agresif pey
          } else if (pStrat === "BOT_IMKANSIZ") {
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

      // İnşaat Fazı (Three-House Optimal Rule)
      if (game.phase === "TURN_ACTIONS" && !active.isBankrupt) {
        const cashBuffer = strat === "CASH_TITAN" ? 350 : (strat === "GRANDMASTER" ? 180 : (strat === "BOT_IMKANSIZ" ? 80 : (strat === "BOT_ZOR" ? 200 : 75)));
        for (const groupName in COLOR_GROUPS) {
          if (groupName === "railroad" || groupName === "utility") continue;
          const groupTiles = COLOR_GROUPS[groupName];
          const ownsAll = groupTiles.every(id => game.properties[id]?.ownerId === active.id && !game.properties[id]?.mortgaged);
          if (ownsAll) {
            for (const tId of groupTiles) {
              const prop = game.properties[tId];
              const tile = BOARD_TILES[tId];
              const cost = prop.houses === 4 ? Math.round((tile.houseCost || 100) * 0.85) : (tile.houseCost || 100);

              // 3 Ev Kuralı: 3 eve kadar agresif, otele indirimle veya para taşarsa çık
              const targetHouses = (strat === "MONOPOLY_RUSHER" || strat === "BOT_IMKANSIZ" || strat === "GRANDMASTER")
                ? (prop.houses < 3 ? 3 : (active.money > 350 ? 5 : 3))
                : (strat === "CASH_TITAN" ? 3 : (active.money > 600 ? 5 : 3));

              if (prop.houses < targetHouses && active.money >= (cost + cashBuffer)) {
                game.buildHouse(active.id, Number(tId));
              }
            }
          }
        }

        if (game.roundNumber >= 20) res.inflationRoundsTriggered++;
        if (game.roundNumber >= 40) res.suddenDeathTriggered++;

        game.endTurn(active.id);
        rounds = game.roundNumber || rounds + 1;
      }
    }

    // Oyun Bitiş İstatistikleri
    if (game.winner) {
      res.validGames++;
      res.roundSum += (game.roundNumber || 1);
      const winStrat = game.winner.strategyKey || "UNKNOWN";
      res.wins[winStrat] = (res.wins[winStrat] || 0) + 1;

      const seat = game.players.findIndex(p => p.id === game.winner.id);
      if (seat >= 0 && seat < 4) res.seatWins[seat]++;

      let hasThreeHouse = false;
      let hasHotel = false;
      for (const tId in game.properties) {
        const prop = game.properties[tId];
        if (prop.ownerId === game.winner.id) {
          if (prop.houses >= 3) hasThreeHouse = true;
          if (prop.houses === 5) hasHotel = true;
        }
      }
      if (hasThreeHouse) res.threeHouseWins++;
      if (hasHotel) res.hotelWins++;
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
