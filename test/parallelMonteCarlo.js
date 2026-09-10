import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";
import { MonopolyGame } from "../server/game/MonopolyGame.js";
import { BOARD_TILES, COLOR_GROUPS } from "../server/game/boardData.js";

const __filename = fileURLToPath(import.meta.url);

if (isMainThread) {
  const TOTAL_GAMES = parseInt(process.argv[2], 10) || 1000000;
  const numWorkers = Math.min(16, os.cpus().length || 4);
  const gamesPerWorker = Math.floor(TOTAL_GAMES / numWorkers);

  console.log(`=============================================================`);
  console.log(`🚀 ${TOTAL_GAMES.toLocaleString("tr-TR")} MAÇLIK PARALEL MONTE CARLO SİMÜLASYONU`);
  console.log(`🔥 CPU Çekirdekleri: ${numWorkers} Adet Paralel İş Parçacığı (Worker Thread)`);
  console.log(`⚡ İşçi Başına: ${gamesPerWorker.toLocaleString("tr-TR")} Maç`);
  console.log(`=============================================================\n`);

  const startTime = Date.now();
  let completedWorkers = 0;
  let totalSimulated = 0;

  const combined = {
    totalGames: 0,
    validGames: 0,
    turnTimeouts: 0,
    seatWins: [0, 0, 0, 0],
    groupMonopolyFormed: {},
    groupMonopolyWins: {},
    bankLoansTaken: 0,
    bankLoanWins: 0,
    roundSum: 0
  };

  for (const g in COLOR_GROUPS) {
    combined.groupMonopolyFormed[g] = 0;
    combined.groupMonopolyWins[g] = 0;
  }

  const workers = [];

  for (let i = 0; i < numWorkers; i++) {
    const worker = new Worker(__filename, {
      workerData: { workerId: i, games: gamesPerWorker }
    });

    worker.on("message", (msg) => {
      if (msg.type === "progress") {
        totalSimulated += msg.count;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = Math.floor(totalSimulated / (elapsed || 0.001));
        process.stdout.write(`\r[PARALEL SİMÜLASYON] ${totalSimulated.toLocaleString("tr-TR")} / ${TOTAL_GAMES.toLocaleString("tr-TR")} tamamlandı (%${((totalSimulated / TOTAL_GAMES) * 100).toFixed(1)}) -> Hız: ${rate.toLocaleString("tr-TR")} maç/sn | Süre: ${elapsed}s`);
      } else if (msg.type === "result") {
        const r = msg.data;
        combined.totalGames += r.totalGames;
        combined.validGames += r.validGames;
        combined.turnTimeouts += r.turnTimeouts;
        combined.seatWins[0] += r.seatWins[0];
        combined.seatWins[1] += r.seatWins[1];
        combined.seatWins[2] += r.seatWins[2];
        combined.seatWins[3] += r.seatWins[3];
        combined.bankLoansTaken += r.bankLoansTaken;
        combined.bankLoanWins += r.bankLoanWins;
        combined.roundSum += r.roundSum;

        for (const g in COLOR_GROUPS) {
          combined.groupMonopolyFormed[g] += r.groupMonopolyFormed[g] || 0;
          combined.groupMonopolyWins[g] += r.groupMonopolyWins[g] || 0;
        }

        completedWorkers++;
        if (completedWorkers === numWorkers) {
          const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
          const finalRate = Math.floor(TOTAL_GAMES / totalDuration);
          console.log(`\n\n🎉 TÜM ${TOTAL_GAMES.toLocaleString("tr-TR")} MAÇ BAŞARIYLA TAMAMLANDI!`);
          console.log(`⏱️ Toplam Süre: ${totalDuration} saniye (${finalRate.toLocaleString("tr-TR")} maç/saniye hız!)`);

          const seatPct = combined.seatWins.map(w => ((w / combined.validGames) * 100).toFixed(2));
          const avgRounds = (combined.roundSum / combined.totalGames).toFixed(1);

          console.log("\n================ KESİN MATEMATİKSEL SONUÇLAR ================");
          console.log(`Toplam Geçerli Maç: ${combined.validGames.toLocaleString("tr-TR")} (%${((combined.validGames / combined.totalGames) * 100).toFixed(1)})`);
          console.log(`Ortalama Tur Süresi: ${avgRounds} tur`);
          console.log(`Koltuk Kazanma Dağılımı:`);
          console.log(`  1. Oyuncu (Koltuk 0): %${seatPct[0]} (${combined.seatWins[0].toLocaleString("tr-TR")} galibiyet)`);
          console.log(`  2. Oyuncu (Koltuk 1): %${seatPct[1]} (${combined.seatWins[1].toLocaleString("tr-TR")} galibiyet)`);
          console.log(`  3. Oyuncu (Koltuk 2): %${seatPct[2]} (${combined.seatWins[2].toLocaleString("tr-TR")} galibiyet)`);
          console.log(`  4. Oyuncu (Koltuk 3): %${seatPct[3]} (${combined.seatWins[3].toLocaleString("tr-TR")} galibiyet)`);
          console.log("\nRenk Grupları Güç Dağılımı (Monopoly Win Rates):");
          for (const g in COLOR_GROUPS) {
            const f = combined.groupMonopolyFormed[g];
            const w = combined.groupMonopolyWins[g];
            const wr = f > 0 ? ((w / f) * 100).toFixed(1) : 0;
            console.log(`  ${g.padEnd(12)}: Kurulma: ${f.toLocaleString("tr-TR").padStart(8)} | Kazanma Oranı: %${wr}`);
          }
          console.log("=============================================================");

          fs.writeFileSync("test/massiveMonteCarloResults.json", JSON.stringify({
            totalGames: TOTAL_GAMES,
            durationSeconds: totalDuration,
            ratePerSec: finalRate,
            avgRounds,
            seatPercentages: seatPct,
            combined
          }, null, 2));

          process.exit(0);
        }
      }
    });

    workers.push(worker);
  }
} else {
  // WORKER LOGIC
  const { workerId, games } = workerData;

  const res = {
    totalGames: games,
    validGames: 0,
    turnTimeouts: 0,
    seatWins: [0, 0, 0, 0],
    groupMonopolyFormed: {},
    groupMonopolyWins: {},
    bankLoansTaken: 0,
    bankLoanWins: 0,
    roundSum: 0
  };

  for (const g in COLOR_GROUPS) {
    res.groupMonopolyFormed[g] = 0;
    res.groupMonopolyWins[g] = 0;
  }

  const reportBatch = Math.max(1000, Math.floor(games / 10));
  let unrecordedBatch = 0;

  for (let i = 0; i < games; i++) {
    const game = new MonopolyGame(`W${workerId}_G${i}`);
    game.addLog = () => {};
    game.onStateUpdate = null;

    for (let p = 0; p < 4; p++) {
      game.addPlayer(`p${p}`, `P${p}`, null, null, true, null, "orta");
    }
    game.startGame("p0");

    let rounds = 0;
    const MAX_ROUNDS = 80;
    let turnCount = 0;
    let monopoliesInGame = {};

    while (game.status === "playing" && rounds < MAX_ROUNDS && turnCount < 300) {
      turnCount++;
      const active = game.getActivePlayer();
      if (!active) break;

      if (active.money < 0) {
        for (const tileId in game.properties) {
          if (game.properties[tileId].ownerId === active.id && game.properties[tileId].houses > 0) {
            game.sellHouse(active.id, Number(tileId));
            if (active.money >= 0) break;
          }
        }
        if (active.money < 0) {
          for (const tileId in game.properties) {
            if (game.properties[tileId].ownerId === active.id && !game.properties[tileId].mortgaged) {
              game.mortgageProperty(active.id, Number(tileId));
              if (active.money >= 0) break;
            }
          }
        }
        if (active.money < 0) {
          game.declareBankruptcy(active.id);
          if (game.status === "ended") break;
          continue;
        }
      }

      if (active.inJail) {
        if (active.jailCards > 0) game.useJailCard(active.id);
        else if (active.money > 250) game.payJailFine(active.id);
      }

      if (game.phase === "WAITING_ROLL") {
        game.rollDice(active.id);
      }

      if (game.phase === "TILE_ACTION") {
        const tile = game.currentTile;
        if (tile && active.money >= tile.cost + 150) {
          game.buyCurrentProperty(active.id);
        } else {
          game.declineBuy(active.id);
        }
      }

      if (game.phase === "AUCTION" && game.auction) {
        let auctionLoops = 0;
        while (game.phase === "AUCTION" && game.auction && auctionLoops < 10) {
          auctionLoops++;
          const auction = game.auction;
          const activeParticipants = game.players.filter(p => !p.isBankrupt && !auction.passedPlayerIds.includes(p.id) && p.id !== auction.highestBidderId);
          if (activeParticipants.length === 0) {
            game.endAuction();
            break;
          }
          const bidder = activeParticipants[0];
          const tCost = auction.tileCost || 100;
          const maxBid = Math.floor(tCost * 0.85);
          const inc = Math.max(10, Math.floor(tCost * 0.1));
          const nextBid = auction.currentBid + inc;

          if (nextBid <= maxBid && bidder.money >= nextBid + 40) {
            game.placeBid(bidder.id, nextBid);
          } else {
            game.passAuction(bidder.id);
          }
        }
        if (game.phase === "AUCTION") game.endAuction();
      }

      if (game.phase === "TURN_ACTIONS") {
        for (const tileId in game.properties) {
          if (game.properties[tileId].ownerId === active.id && active.money > 400) {
            game.buildHouse(active.id, Number(tileId));
          }
        }
        const endRes = game.endTurn(active.id);
        if (!endRes || !endRes.success) {
          if (active.money < 0) game.declareBankruptcy(active.id);
          else game.advanceTurn();
        }
      }

      for (const groupName in COLOR_GROUPS) {
        if (!monopoliesInGame[groupName]) {
          const ids = COLOR_GROUPS[groupName];
          const firstOwner = game.properties[ids[0]]?.ownerId;
          if (firstOwner && ids.every(id => game.properties[id]?.ownerId === firstOwner)) {
            monopoliesInGame[groupName] = firstOwner;
            res.groupMonopolyFormed[groupName]++;
          }
        }
      }

      rounds = game.roundNumber || (rounds + 1);
    }

    if (game.winner) {
      res.validGames++;
      const winnerSeat = game.players.findIndex(p => p.id === game.winner.id);
      if (winnerSeat >= 0) res.seatWins[winnerSeat]++;

      for (const groupName in monopoliesInGame) {
        if (monopoliesInGame[groupName] === game.winner.id) {
          res.groupMonopolyWins[groupName]++;
        }
      }
    } else {
      res.turnTimeouts++;
    }

    res.roundSum += rounds;
    unrecordedBatch++;

    if (unrecordedBatch >= reportBatch || i === games - 1) {
      parentPort.postMessage({ type: "progress", count: unrecordedBatch });
      unrecordedBatch = 0;
    }
  }

  parentPort.postMessage({ type: "result", data: res });
}
