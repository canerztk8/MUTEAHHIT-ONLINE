import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";
import { MonopolyGame } from "../server/game/MonopolyGame.js";
import { BOARD_TILES, COLOR_GROUPS, CHANCE_CARDS, CHEST_CARDS } from "../server/game/boardData.js";

const __filename = fileURLToPath(import.meta.url);

if (isMainThread) {
  const TOTAL_GAMES = parseInt(process.argv[2], 10) || 500000;
  const numWorkers = Math.min(16, os.cpus().length || 4);
  const gamesPerWorker = Math.floor(TOTAL_GAMES / numWorkers);

  console.log(`========================================================================`);
  console.log(`🔬 DERİN TELEMETRİ MONTE CARLO SİMÜLASYONU: ${TOTAL_GAMES.toLocaleString("tr-TR")} MAÇ`);
  console.log(`⚡ 16 Çekirdek Paralel İşleme | Hedef: Literal Olarak TÜM Oyun Verileri`);
  console.log(`========================================================================\n`);

  const startTime = Date.now();
  let completedWorkers = 0;
  let totalSimulated = 0;

  const combined = {
    totalGames: 0,
    validGames: 0,
    turnTimeouts: 0,
    seatWins: [0, 0, 0, 0],
    
    // Zar İstatistikleri
    totalDiceRolls: 0,
    diceSumDistribution: new Array(13).fill(0),
    doublesCount: 0,
    tripleDoublesJailCount: 0,

    // Kodes İstatistikleri
    totalJailEntries: 0,
    playersEverInJailCount: 0,
    jailReasons: { tile_gotojail: 0, card: 0, triple_doubles: 0 },
    jailExits: { paid_fine: 0, used_card: 0, rolled_doubles: 0, forced_turn3: 0 },
    totalJailTurnsSpent: 0,

    // Harita Isı Haritası (40 Kare)
    tileLandings: new Array(40).fill(0),

    // Para & Ekonomi
    totalGoPassCount: 0,
    totalRentPaid: 0,
    peakPlayerMoney: 0,
    jackpotClaims: 0,
    jackpotTotalMoney: 0,

    // Mülk & Açık Artırma & İnşaat
    directPurchases: 0,
    auctionTriggered: 0,
    auctionPurchases: 0,
    auctionTotalWinningBids: 0,
    totalHousesBuilt: 0,
    totalHotelsBuilt: 0,
    housesSoldBack: 0,
    mortgagesTaken: 0,
    unmortgagesDone: 0,

    // Borç & İflas
    bankLoansRequested: 0,
    bankLoansWonGame: 0,
    bankruptcyReasons: { rent: 0, debt_foreclosure: 0, other: 0 },

    // Kartlar
    chanceCardsDrawn: 0,
    chestCardsDrawn: 0,

    // Süre
    roundDistribution: { "fast_0_25": 0, "normal_26_45": 0, "long_46_70": 0, "very_long_70_plus": 0 },
    roundSum: 0
  };

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
        process.stdout.write(`\r[TELEMETRİ ANALİZİ] ${totalSimulated.toLocaleString("tr-TR")} / ${TOTAL_GAMES.toLocaleString("tr-TR")} (%${((totalSimulated / TOTAL_GAMES) * 100).toFixed(1)}) -> Hız: ${rate.toLocaleString("tr-TR")} maç/sn | Süre: ${elapsed}s`);
      } else if (msg.type === "result") {
        const r = msg.data;
        combined.totalGames += r.totalGames;
        combined.validGames += r.validGames;
        combined.turnTimeouts += r.turnTimeouts;
        for (let s = 0; s < 4; s++) combined.seatWins[s] += r.seatWins[s];

        combined.totalDiceRolls += r.totalDiceRolls;
        for (let d = 2; d <= 12; d++) combined.diceSumDistribution[d] += r.diceSumDistribution[d];
        combined.doublesCount += r.doublesCount;
        combined.tripleDoublesJailCount += r.tripleDoublesJailCount;

        combined.totalJailEntries += r.totalJailEntries;
        combined.playersEverInJailCount += r.playersEverInJailCount;
        combined.jailReasons.tile_gotojail += r.jailReasons.tile_gotojail;
        combined.jailReasons.card += r.jailReasons.card;
        combined.jailReasons.triple_doubles += r.jailReasons.triple_doubles;

        combined.jailExits.paid_fine += r.jailExits.paid_fine;
        combined.jailExits.used_card += r.jailExits.used_card;
        combined.jailExits.rolled_doubles += r.jailExits.rolled_doubles;
        combined.jailExits.forced_turn3 += r.jailExits.forced_turn3;
        combined.totalJailTurnsSpent += r.totalJailTurnsSpent;

        for (let t = 0; t < 40; t++) combined.tileLandings[t] += r.tileLandings[t];

        combined.totalGoPassCount += r.totalGoPassCount;
        combined.totalRentPaid += r.totalRentPaid;
        combined.peakPlayerMoney = Math.max(combined.peakPlayerMoney, r.peakPlayerMoney);
        combined.jackpotClaims += r.jackpotClaims;
        combined.jackpotTotalMoney += r.jackpotTotalMoney;

        combined.directPurchases += r.directPurchases;
        combined.auctionTriggered += r.auctionTriggered;
        combined.auctionPurchases += r.auctionPurchases;
        combined.auctionTotalWinningBids += r.auctionTotalWinningBids;
        combined.totalHousesBuilt += r.totalHousesBuilt;
        combined.totalHotelsBuilt += r.totalHotelsBuilt;
        combined.housesSoldBack += r.housesSoldBack;
        combined.mortgagesTaken += r.mortgagesTaken;
        combined.unmortgagesDone += r.unmortgagesDone;

        combined.bankLoansRequested += r.bankLoansRequested;
        combined.bankLoansWonGame += r.bankLoansWonGame;
        combined.bankruptcyReasons.rent += r.bankruptcyReasons.rent;
        combined.bankruptcyReasons.debt_foreclosure += r.bankruptcyReasons.debt_foreclosure;
        combined.bankruptcyReasons.other += r.bankruptcyReasons.other;

        combined.chanceCardsDrawn += r.chanceCardsDrawn;
        combined.chestCardsDrawn += r.chestCardsDrawn;

        combined.roundDistribution.fast_0_25 += r.roundDistribution.fast_0_25;
        combined.roundDistribution.normal_26_45 += r.roundDistribution.normal_26_45;
        combined.roundDistribution.long_46_70 += r.roundDistribution.long_46_70;
        combined.roundDistribution.very_long_70_plus += r.roundDistribution.very_long_70_plus;
        combined.roundSum += r.roundSum;

        completedWorkers++;
        if (completedWorkers === numWorkers) {
          const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(`\n\n🎉 ${TOTAL_GAMES.toLocaleString("tr-TR")} MAÇIN DERİNLEMESİNE TELEMETRİ ANALİZİ TAMAMLANDI! (${totalDuration}s)`);

          fs.writeFileSync("test/exhaustiveTelemetryReport.json", JSON.stringify({
            totalGames: TOTAL_GAMES,
            durationSeconds: totalDuration,
            combined
          }, null, 2));

          process.exit(0);
        }
      }
    });

    workers.push(worker);
  }
} else {
  // WORKER PROCESS
  const { workerId, games } = workerData;

  const res = {
    totalGames: games,
    validGames: 0,
    turnTimeouts: 0,
    seatWins: [0, 0, 0, 0],
    totalDiceRolls: 0,
    diceSumDistribution: new Array(13).fill(0),
    doublesCount: 0,
    tripleDoublesJailCount: 0,
    totalJailEntries: 0,
    playersEverInJailCount: 0,
    jailReasons: { tile_gotojail: 0, card: 0, triple_doubles: 0 },
    jailExits: { paid_fine: 0, used_card: 0, rolled_doubles: 0, forced_turn3: 0 },
    totalJailTurnsSpent: 0,
    tileLandings: new Array(40).fill(0),
    totalGoPassCount: 0,
    totalRentPaid: 0,
    peakPlayerMoney: 0,
    jackpotClaims: 0,
    jackpotTotalMoney: 0,
    directPurchases: 0,
    auctionTriggered: 0,
    auctionPurchases: 0,
    auctionTotalWinningBids: 0,
    totalHousesBuilt: 0,
    totalHotelsBuilt: 0,
    housesSoldBack: 0,
    mortgagesTaken: 0,
    unmortgagesDone: 0,
    bankLoansRequested: 0,
    bankLoansWonGame: 0,
    bankruptcyReasons: { rent: 0, debt_foreclosure: 0, other: 0 },
    chanceCardsDrawn: 0,
    chestCardsDrawn: 0,
    roundDistribution: { fast_0_25: 0, normal_26_45: 0, long_46_70: 0, very_long_70_plus: 0 },
    roundSum: 0
  };

  const reportBatch = Math.max(1000, Math.floor(games / 10));
  let unrecorded = 0;

  for (let g = 0; g < games; g++) {
    const game = new MonopolyGame(`TEL_${workerId}_${g}`);
    game.addLog = () => {};
    game.onStateUpdate = null;

    for (let p = 0; p < 4; p++) {
      game.addPlayer(`p${p}`, `P${p}`, null, null, true, null, "orta");
    }
    game.startGame("p0");

    let rounds = 0;
    const MAX_ROUNDS = 80;
    let turnCount = 0;
    let playersEverJailedInGame = new Set();
    let loansInGame = new Set();

    while (game.status === "playing" && rounds < MAX_ROUNDS && turnCount < 250) {
      turnCount++;
      const active = game.getActivePlayer();
      if (!active) break;

      res.peakPlayerMoney = Math.max(res.peakPlayerMoney, active.money);

      // 1. Borç / İflas Kontrolü
      if (active.money < 0) {
        // Ev sat
        for (const tileId in game.properties) {
          if (game.properties[tileId].ownerId === active.id && game.properties[tileId].houses > 0) {
            game.sellHouse(active.id, Number(tileId));
            res.housesSoldBack++;
            if (active.money >= 0) break;
          }
        }
        // İpotek et
        if (active.money < 0) {
          for (const tileId in game.properties) {
            if (game.properties[tileId].ownerId === active.id && !game.properties[tileId].mortgaged) {
              game.mortgageProperty(active.id, Number(tileId));
              res.mortgagesTaken++;
              if (active.money >= 0) break;
            }
          }
        }
        // Acil Banka Kredisi
        if (active.money < 0) {
          const lRes = game.requestBankLoan(active.id, Math.min(500, Math.abs(active.money) + 50));
          if (lRes && lRes.success) {
            loansInGame.add(active.id);
            res.bankLoansRequested++;
          }
        }
        // Hala negatifse İflas
        if (active.money < 0) {
          game.declareBankruptcy(active.id);
          res.bankruptcyReasons.rent++;
          if (game.status === "ended") break;
          continue;
        }
      }

      // 2. Kodes Eylemleri & Çıkışları
      if (active.inJail) {
        playersEverJailedInGame.add(active.id);
        res.totalJailTurnsSpent++;

        if (active.jailCards > 0) {
          game.useJailCard(active.id);
          res.jailExits.used_card++;
        } else if (active.money > 250) {
          game.payJailFine(active.id);
          res.jailExits.paid_fine++;
        }
      }

      // 3. Zar Atışı
      if (game.phase === "WAITING_ROLL") {
        const preJail = active.inJail;
        const prevPos = active.position;
        const rollRes = game.rollDice(active.id);
        res.totalDiceRolls++;

        const d1 = game.dice[0];
        const d2 = game.dice[1];
        const sum = d1 + d2;
        res.diceSumDistribution[sum]++;
        if (d1 === d2) res.doublesCount++;

        // Kodes'e giriş tespiti
        if (!preJail && active.inJail) {
          res.totalJailEntries++;
          playersEverJailedInGame.add(active.id);
          if (prevPos === 30 || game.currentTile?.id === 30) res.jailReasons.tile_gotojail++;
          else if (game.doublesCount >= 3) {
            res.jailReasons.triple_doubles++;
            res.tripleDoublesJailCount++;
          } else res.jailReasons.card++;
        }

        // Kodes'ten zarla çıkış tespiti
        if (preJail && !active.inJail) {
          if (d1 === d2) res.jailExits.rolled_doubles++;
          else res.jailExits.forced_turn3++;
        }

        res.tileLandings[active.position]++;

        // Tur tamamlama (GO)
        if (active.position < prevPos && !active.inJail) {
          res.totalGoPassCount++;
        }

        // Dinlenme Tesisi (Jackpot)
        if (active.position === 20 && game.freeParkingPool > 0) {
          res.jackpotClaims++;
          res.jackpotTotalMoney += game.freeParkingPool;
        }

        // Kart çekimi
        if (game.currentTile?.type === "chance") res.chanceCardsDrawn++;
        if (game.currentTile?.type === "chest") res.chestCardsDrawn++;
      }

      // 4. Mülk Satın Alma / İhale
      if (game.phase === "TILE_ACTION") {
        const tile = game.currentTile;
        if (tile && active.money >= tile.cost + 150) {
          game.buyCurrentProperty(active.id);
          res.directPurchases++;
        } else {
          game.declineBuy(active.id);
        }
      }

      // 5. Açık Artırma (Müzayede)
      if (game.phase === "AUCTION" && game.auction) {
        res.auctionTriggered++;
        let auctionLoops = 0;
        while (game.phase === "AUCTION" && game.auction && auctionLoops < 10) {
          auctionLoops++;
          const auction = game.auction;
          const activeParticipants = game.players.filter(p => !p.isBankrupt && !auction.passedPlayerIds.includes(p.id) && p.id !== auction.highestBidderId);
          if (activeParticipants.length === 0) {
            const endRes = game.endAuction();
            if (endRes?.result?.winnerName) {
              res.auctionPurchases++;
              res.auctionTotalWinningBids += (endRes.result.finalBid || 0);
            }
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

      // 6. Tur Sonu & İnşaat
      if (game.phase === "TURN_ACTIONS") {
        for (const tileId in game.properties) {
          if (game.properties[tileId].ownerId === active.id && active.money > 400) {
            const currentHouses = game.properties[tileId].houses || 0;
            const bRes = game.buildHouse(active.id, Number(tileId));
            if (bRes && bRes.success) {
              if (currentHouses === 4) res.totalHotelsBuilt++;
              else res.totalHousesBuilt++;
            }
          }
        }

        // İpoteği açma (unmortgage)
        if (active.money > 600) {
          for (const tileId in game.properties) {
            if (game.properties[tileId].ownerId === active.id && game.properties[tileId].mortgaged) {
              const uRes = game.unmortgageProperty(active.id, Number(tileId));
              if (uRes && uRes.success) {
                res.unmortgagesDone++;
                break;
              }
            }
          }
        }

        const endRes = game.endTurn(active.id);
        if (!endRes || !endRes.success) {
          if (active.money < 0) game.declareBankruptcy(active.id);
          else game.advanceTurn();
        }
      }

      rounds = game.roundNumber || (rounds + 1);
    }

    if (game.winner) {
      res.validGames++;
      const winnerSeat = game.players.findIndex(p => p.id === game.winner.id);
      if (winnerSeat >= 0) res.seatWins[winnerSeat]++;

      if (loansInGame.has(game.winner.id)) {
        res.bankLoansWonGame++;
      }
    } else {
      res.turnTimeouts++;
    }

    res.playersEverInJailCount += playersEverJailedInGame.size;
    res.roundSum += rounds;

    if (rounds <= 25) res.roundDistribution.fast_0_25++;
    else if (rounds <= 45) res.roundDistribution.normal_26_45++;
    else if (rounds <= 70) res.roundDistribution.long_46_70++;
    else res.roundDistribution.very_long_70_plus++;

    unrecorded++;
    if (unrecorded >= reportBatch || g === games - 1) {
      parentPort.postMessage({ type: "progress", count: unrecorded });
      unrecorded = 0;
    }
  }

  parentPort.postMessage({ type: "result", data: res });
}
