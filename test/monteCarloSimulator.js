import { MonopolyGame } from "../server/game/MonopolyGame.js";
import { BOARD_TILES, COLOR_GROUPS } from "../server/game/boardData.js";
import fs from "fs";

class FastBalanceSimulator {
  constructor(totalGames = 50000, experimentMode = "equal_bots") {
    this.totalGames = totalGames;
    this.experimentMode = experimentMode;

    this.results = {
      completedGames: 0,
      turnTimeouts: 0,
      totalRounds: 0,
      roundDistribution: {},
      seatWins: [0, 0, 0, 0],
      difficultyWins: { cok_kolay: 0, kolay: 0, orta: 0, zor: 0, imkansiz: 0 },
      difficultyPlays: { cok_kolay: 0, kolay: 0, orta: 0, zor: 0, imkansiz: 0 },
      groupMonopolyFormed: {},
      groupMonopolyWins: {},
      tileLandings: new Array(40).fill(0),
      bankLoansTaken: 0,
      bankLoanWinCount: 0,
      jackpotTotalCollected: 0,
      jackpotWinCount: 0,
      jackpotClaimCount: 0,
      bankruptciesTotal: 0
    };

    for (const g in COLOR_GROUPS) {
      this.results.groupMonopolyFormed[g] = 0;
      this.results.groupMonopolyWins[g] = 0;
    }
  }

  runSingleGame(gameIndex) {
    const game = new MonopolyGame(`SIM_${gameIndex}`);
    game.addLog = () => {};
    game.onStateUpdate = null;

    let difficulties = ["orta", "orta", "orta", "orta"];
    if (this.experimentMode === "difficulty_clash") {
      difficulties = ["kolay", "orta", "zor", "imkansiz"];
    }

    for (let i = 0; i < 4; i++) {
      game.addPlayer(`p${i}`, `Player_${i}`, null, null, true, null, difficulties[i]);
      this.results.difficultyPlays[difficulties[i]]++;
    }

    game.startGame("p0");

    let rounds = 0;
    const MAX_ROUNDS = 100;
    let turnCount = 0;
    let loanTakenPlayers = new Set();
    let jackpotClaimers = new Set();
    let monopoliesInGame = {};

    while (game.status === "playing" && rounds < MAX_ROUNDS && turnCount < 400) {
      turnCount++;
      const active = game.getActivePlayer();
      if (!active) break;

      const diff = active.difficulty || "orta";

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
        if (active.money < 0 && (diff === "zor" || diff === "imkansiz")) {
          const loanRes = game.requestBankLoan(active.id, Math.min(500, Math.abs(active.money) + 50));
          if (loanRes && loanRes.success) {
            loanTakenPlayers.add(active.id);
            this.results.bankLoansTaken++;
          }
        }
        if (active.money < 0) {
          game.declareBankruptcy(active.id);
          this.results.bankruptciesTotal++;
          if (game.status === "ended") break;
          continue;
        }
      }

      if (active.inJail) {
        if (active.jailCards > 0) {
          game.useJailCard(active.id);
        } else if (active.money > 250) {
          game.payJailFine(active.id);
        }
      }

      if (game.phase === "WAITING_ROLL") {
        game.rollDice(active.id);
        this.results.tileLandings[active.position]++;

        if (active.position === 20 && game.freeParkingPool > 0) {
          jackpotClaimers.add(active.id);
          this.results.jackpotClaimCount++;
          this.results.jackpotTotalCollected += game.freeParkingPool;
        }
      }

      if (game.phase === "TILE_ACTION") {
        const tile = game.currentTile;
        let shouldBuy = false;
        if (tile) {
          if (diff === "cok_kolay") shouldBuy = Math.random() < 0.35 && active.money >= tile.cost + 300;
          else if (diff === "kolay") shouldBuy = active.money >= tile.cost + 250;
          else if (diff === "orta") shouldBuy = active.money >= tile.cost + 150;
          else if (diff === "zor") shouldBuy = active.money >= tile.cost + 40;
          else if (diff === "imkansiz") shouldBuy = active.money >= tile.cost;
        }

        if (shouldBuy) {
          game.buyCurrentProperty(active.id);
        } else {
          game.declineBuy(active.id);
        }
      }

      if (game.phase === "AUCTION" && game.auction) {
        let auctionLoops = 0;
        while (game.phase === "AUCTION" && game.auction && auctionLoops < 20) {
          auctionLoops++;
          const auction = game.auction;
          const activeParticipants = game.players.filter(p => !p.isBankrupt && !auction.passedPlayerIds.includes(p.id) && p.id !== auction.highestBidderId);
          if (activeParticipants.length === 0) {
            game.endAuction();
            break;
          }

          const bidder = activeParticipants[0];
          const bDiff = bidder.difficulty || "orta";
          const tCost = auction.tileCost || 100;
          let maxFactor = bDiff === "cok_kolay" ? 0.25 : bDiff === "kolay" ? 0.5 : bDiff === "orta" ? 0.85 : bDiff === "zor" ? 1.15 : 1.45;
          const maxBid = Math.floor(tCost * maxFactor);
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
        if (diff !== "cok_kolay") {
          const minReserve = diff === "imkansiz" ? 80 : diff === "zor" ? 200 : diff === "orta" ? 400 : 600;
          for (const tileId in game.properties) {
            if (game.properties[tileId].ownerId === active.id && active.money > minReserve) {
              game.buildHouse(active.id, Number(tileId));
            }
          }
        }
        const endRes = game.endTurn(active.id);
        if (!endRes || !endRes.success) {
          if (active.money < 0) {
            game.declareBankruptcy(active.id);
          } else {
            game.advanceTurn();
          }
        }
      }

      for (const groupName in COLOR_GROUPS) {
        if (!monopoliesInGame[groupName]) {
          const ids = COLOR_GROUPS[groupName];
          const firstOwner = game.properties[ids[0]]?.ownerId;
          if (firstOwner && ids.every(id => game.properties[id]?.ownerId === firstOwner)) {
            monopoliesInGame[groupName] = firstOwner;
            this.results.groupMonopolyFormed[groupName]++;
          }
        }
      }

      rounds = game.roundNumber || (rounds + 1);
    }

    if (game.winner) {
      this.results.completedGames++;
      const winnerSeat = game.players.findIndex(p => p.id === game.winner.id);
      if (winnerSeat >= 0) this.results.seatWins[winnerSeat]++;

      if (game.winner.difficulty) {
        this.results.difficultyWins[game.winner.difficulty]++;
      }

      if (loanTakenPlayers.has(game.winner.id)) {
        this.results.bankLoanWinCount++;
      }

      if (jackpotClaimers.has(game.winner.id)) {
        this.results.jackpotWinCount++;
      }

      for (const groupName in monopoliesInGame) {
        if (monopoliesInGame[groupName] === game.winner.id) {
          this.results.groupMonopolyWins[groupName]++;
        }
      }
    } else {
      this.results.turnTimeouts++;
    }

    this.results.totalRounds += rounds;
    const bucket = Math.min(100, Math.floor(rounds / 5) * 5);
    this.results.roundDistribution[bucket] = (this.results.roundDistribution[bucket] || 0) + 1;
  }

  run() {
    const startTime = Date.now();
    console.log(`[SIMULATION] ${this.totalGames.toLocaleString("tr-TR")} mac baslatiliyor (Mod: ${this.experimentMode})...`);

    const logInterval = Math.max(5000, Math.floor(this.totalGames / 10));
    for (let i = 0; i < this.totalGames; i++) {
      this.runSingleGame(i);
      if ((i + 1) % logInterval === 0 || i + 1 === this.totalGames) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = Math.floor((i + 1) / (elapsed || 0.001));
        console.log(` -> Tamamlanan: ${(i + 1).toLocaleString("tr-TR")} / ${this.totalGames.toLocaleString("tr-TR")} (${rate} mac/sn, Sure: ${elapsed}s)`);
      }
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[TAMAMLANDI] ${this.totalGames.toLocaleString("tr-TR")} mac ${durationSeconds} saniyede simule edildi!`);
    return this.generateReport(durationSeconds);
  }

  generateReport(durationSeconds) {
    const validGames = this.results.completedGames;
    const avgRounds = (this.results.totalRounds / this.totalGames).toFixed(1);
    const seatWinPercentages = this.results.seatWins.map(w => ((w / validGames) * 100).toFixed(2));
    
    const monopolyStats = {};
    for (const g in COLOR_GROUPS) {
      const formed = this.results.groupMonopolyFormed[g];
      const wins = this.results.groupMonopolyWins[g];
      const winRate = formed > 0 ? ((wins / formed) * 100).toFixed(1) : 0;
      const frequency = ((formed / this.totalGames) * 100).toFixed(1);
      monopolyStats[g] = { formed, wins, winRate: Number(winRate), frequency: Number(frequency) };
    }

    return {
      totalGames: this.totalGames,
      validGames,
      turnTimeouts: this.results.turnTimeouts,
      completionRate: ((validGames / this.totalGames) * 100).toFixed(2),
      avgRounds,
      durationSeconds,
      seatWinPercentages,
      difficultyWins: this.results.difficultyWins,
      difficultyPlays: this.results.difficultyPlays,
      monopolyStats,
      tileLandings: this.results.tileLandings,
      roundDistribution: this.results.roundDistribution,
      bankLoans: {
        takenTotal: this.results.bankLoansTaken,
        winnerWithLoan: this.results.bankLoanWinCount,
        loanWinnerRate: validGames > 0 ? ((this.results.bankLoanWinCount / Math.max(1, this.results.bankLoansTaken)) * 100).toFixed(2) : 0
      },
      jackpot: {
        totalClaimed: this.results.jackpotClaimCount,
        totalMoneyCollected: this.results.jackpotTotalCollected,
        avgJackpotPerClaim: this.results.jackpotClaimCount > 0 ? Math.round(this.results.jackpotTotalCollected / this.results.jackpotClaimCount) : 0,
        jackpotWinnerRate: this.results.jackpotClaimCount > 0 ? ((this.results.jackpotWinCount / validGames) * 100).toFixed(2) : 0
      }
    };
  }
}

const BATCH_SIZE = 50000;
console.log("=== 100.000 MACLIK MUTEAHHIT MONTE CARLO DENGE SIMULASYONU ===\n");

console.log("--- DENEY 1: 50.000 MAC (4 Esit Seviye Bot: Sira Avantaji, Mülk Gucu & Sure) ---");
const sim1 = new FastBalanceSimulator(BATCH_SIZE, "equal_bots");
const report1 = sim1.run();

console.log("\n--- DENEY 2: 50.000 MAC (Zorluk Seviyesi Karsilasmasi: Kolay vs Orta vs Zor vs Imkansiz) ---");
const sim2 = new FastBalanceSimulator(BATCH_SIZE, "difficulty_clash");
const report2 = sim2.run();

fs.writeFileSync("test/monteCarloResults.json", JSON.stringify({ report1, report2 }, null, 2));
console.log("\n[BASARILI] Rapor test/monteCarloResults.json dosyasina yazildi!");
