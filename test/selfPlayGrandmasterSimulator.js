import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";
import { MonopolyGame } from "../server/game/MonopolyGame.js";
import { BOARD_TILES, COLOR_GROUPS } from "../server/game/boardData.js";

const __filename = fileURLToPath(import.meta.url);

// 4 USTA OYUNCU (GRANDMASTER) STRATEJİ ARKETİPİ
export const STRATEGIES = {
  GRANDMASTER: "Grandmaster (EV & Dinamik Tampon)",
  MONOPOLY_RUSHER: "Agresif Tekelci (3 Ev Kuralı & Hızlı İnşaat)",
  CASH_TITAN: "Nakit Baronu (4 Gar & Yüksek Güvenlik Rezervi)",
  AUCTION_SHARK: "Müzayede Köpekbalığı (Açık Artırma & Kodes Pususu)"
};

if (isMainThread) {
  const TOTAL_GAMES = parseInt(process.argv[2], 10) || 1000000;
  const numWorkers = Math.min(16, os.cpus().length || 4);
  const gamesPerWorker = Math.floor(TOTAL_GAMES / numWorkers);

  console.log(`================================================================================`);
  console.log(`🧠 1.000.000 MAÇLIK ŞAMPİYONLAR LİGİ: KENDİ KENDİNE REKABETÇİ SİMÜLASYON`);
  console.log(`⚡ Bot Yok! 4 Farklı Usta (Grandmaster) Yapay Zeka Arketipi Kendi Arasında Savaşıyor`);
  console.log(`🔥 16 Çekirdek AMD Ryzen | İşçi Başına: ${gamesPerWorker.toLocaleString("tr-TR")} Maç`);
  console.log(`================================================================================\n`);

  const startTime = Date.now();
  let completedWorkers = 0;
  let totalSimulated = 0;

  const combined = {
    totalGames: 0,
    validGames: 0,
    turnTimeouts: 0,
    strategyWins: {
      GRANDMASTER: 0,
      MONOPOLY_RUSHER: 0,
      CASH_TITAN: 0,
      AUCTION_SHARK: 0
    },
    seatWins: [0, 0, 0, 0],
    strategyMonopolies: {
      GRANDMASTER: 0,
      MONOPOLY_RUSHER: 0,
      CASH_TITAN: 0,
      AUCTION_SHARK: 0
    },
    jailStallSuccessCount: 0,
    jailStallAttempts: 0,
    threeHousePeakWins: 0,
    hotelRushWins: 0,
    auctionSnipeCount: 0,
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
        process.stdout.write(`\r[KENDİNE KARŞI REKABETÇİ] ${totalSimulated.toLocaleString("tr-TR")} / ${TOTAL_GAMES.toLocaleString("tr-TR")} (%${((totalSimulated / TOTAL_GAMES) * 100).toFixed(1)}) -> Hız: ${rate.toLocaleString("tr-TR")} maç/sn | Süre: ${elapsed}s`);
      } else if (msg.type === "result") {
        const r = msg.data;
        combined.totalGames += r.totalGames;
        combined.validGames += r.validGames;
        combined.turnTimeouts += r.turnTimeouts;
        combined.strategyWins.GRANDMASTER += r.strategyWins.GRANDMASTER;
        combined.strategyWins.MONOPOLY_RUSHER += r.strategyWins.MONOPOLY_RUSHER;
        combined.strategyWins.CASH_TITAN += r.strategyWins.CASH_TITAN;
        combined.strategyWins.AUCTION_SHARK += r.strategyWins.AUCTION_SHARK;

        for (let s = 0; s < 4; s++) combined.seatWins[s] += r.seatWins[s];

        combined.strategyMonopolies.GRANDMASTER += r.strategyMonopolies.GRANDMASTER;
        combined.strategyMonopolies.MONOPOLY_RUSHER += r.strategyMonopolies.MONOPOLY_RUSHER;
        combined.strategyMonopolies.CASH_TITAN += r.strategyMonopolies.CASH_TITAN;
        combined.strategyMonopolies.AUCTION_SHARK += r.strategyMonopolies.AUCTION_SHARK;

        combined.jailStallSuccessCount += r.jailStallSuccessCount;
        combined.jailStallAttempts += r.jailStallAttempts;
        combined.threeHousePeakWins += r.threeHousePeakWins;
        combined.hotelRushWins += r.hotelRushWins;
        combined.auctionSnipeCount += r.auctionSnipeCount;
        combined.roundSum += r.roundSum;

        completedWorkers++;
        if (completedWorkers === numWorkers) {
          const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
          const finalRate = Math.floor(TOTAL_GAMES / totalDuration);
          console.log(`\n\n🎉 TÜM ${TOTAL_GAMES.toLocaleString("tr-TR")} ŞAMPİYONLUK MAÇI BAŞARIYLA BİTTİ!`);
          console.log(`⏱️ Toplam Süre: ${totalDuration} saniye (${finalRate.toLocaleString("tr-TR")} maç/saniye hız!)`);

          const v = combined.validGames || 1;
          const stratPcts = {
            GRANDMASTER: ((combined.strategyWins.GRANDMASTER / v) * 100).toFixed(2),
            MONOPOLY_RUSHER: ((combined.strategyWins.MONOPOLY_RUSHER / v) * 100).toFixed(2),
            CASH_TITAN: ((combined.strategyWins.CASH_TITAN / v) * 100).toFixed(2),
            AUCTION_SHARK: ((combined.strategyWins.AUCTION_SHARK / v) * 100).toFixed(2)
          };

          const seatPcts = combined.seatWins.map(w => ((w / v) * 100).toFixed(2));

          console.log("\n================ 👑 STRATEJİLERİN ŞAMPİYONLUK ORANLARI ================");
          console.log(`1. ${STRATEGIES.GRANDMASTER.padEnd(45)}: %${stratPcts.GRANDMASTER} (${combined.strategyWins.GRANDMASTER.toLocaleString("tr-TR")} galibiyet)`);
          console.log(`2. ${STRATEGIES.MONOPOLY_RUSHER.padEnd(45)}: %${stratPcts.MONOPOLY_RUSHER} (${combined.strategyWins.MONOPOLY_RUSHER.toLocaleString("tr-TR")} galibiyet)`);
          console.log(`3. ${STRATEGIES.AUCTION_SHARK.padEnd(45)}: %${stratPcts.AUCTION_SHARK} (${combined.strategyWins.AUCTION_SHARK.toLocaleString("tr-TR")} galibiyet)`);
          console.log(`4. ${STRATEGIES.CASH_TITAN.padEnd(45)}: %${stratPcts.CASH_TITAN} (${combined.strategyWins.CASH_TITAN.toLocaleString("tr-TR")} galibiyet)`);
          console.log(`\nKoltuk Sırası Dağılımı (Koltuk 0 / 1 / 2 / 3): %${seatPcts.join(" / %")}`);
          console.log(`3 Ev Kuralı (Three-House Optimal ROI) ile Kazanılan Maçlar: %${((combined.threeHousePeakWins / v) * 100).toFixed(1)}`);
          console.log(`Geç Oyunda Kodes Pususu (Jail Stalling) Başarı Oranı: %${((combined.jailStallSuccessCount / Math.max(1, combined.jailStallAttempts)) * 100).toFixed(1)}`);
          console.log("========================================================================");

          fs.writeFileSync("test/selfPlayGrandmasterResults.json", JSON.stringify({
            totalGames: TOTAL_GAMES,
            durationSeconds: totalDuration,
            ratePerSec: finalRate,
            strategyPercentages: stratPcts,
            seatPercentages: seatPcts,
            combined
          }, null, 2));

          process.exit(0);
        }
      }
    });

    workers.push(worker);
  }
} else {
  // WORKER ENGINE
  const { workerId, games } = workerData;

  const res = {
    totalGames: games,
    validGames: 0,
    turnTimeouts: 0,
    strategyWins: { GRANDMASTER: 0, MONOPOLY_RUSHER: 0, CASH_TITAN: 0, AUCTION_SHARK: 0 },
    seatWins: [0, 0, 0, 0],
    strategyMonopolies: { GRANDMASTER: 0, MONOPOLY_RUSHER: 0, CASH_TITAN: 0, AUCTION_SHARK: 0 },
    jailStallSuccessCount: 0,
    jailStallAttempts: 0,
    threeHousePeakWins: 0,
    hotelRushWins: 0,
    auctionSnipeCount: 0,
    roundSum: 0
  };

  const STRAT_KEYS = ["GRANDMASTER", "MONOPOLY_RUSHER", "CASH_TITAN", "AUCTION_SHARK"];
  const reportBatch = Math.max(1000, Math.floor(games / 10));
  let unrecorded = 0;

  for (let g = 0; g < games; g++) {
    const game = new MonopolyGame(`SP_${workerId}_${g}`);
    game.addLog = () => {};
    game.onStateUpdate = null;

    // Koltuk sıralamasını her maç rotasyonla karıştır (strateji ile koltuk sırası bağımsız olsun)
    const offset = g % 4;
    const playerStrategies = {};

    for (let p = 0; p < 4; p++) {
      const strat = STRAT_KEYS[(p + offset) % 4];
      playerStrategies[`p${p}`] = strat;
      game.addPlayer(`p${p}`, `Master_${strat}`, null, null, true, null, "imkansiz");
    }
    game.startGame("p0");

    let rounds = 0;
    const MAX_ROUNDS = 75;
    let turnCount = 0;
    let threeHouseUsed = false;
    let hotelUsed = false;

    while (game.status === "playing" && rounds < MAX_ROUNDS && turnCount < 250) {
      turnCount++;
      const active = game.getActivePlayer();
      if (!active) break;

      const strat = playerStrategies[active.id];

      // A. MAKSİMUM TAHTA TEHLİKESİ HESABI (Tahtadaki rakip otel ve ev kiraları)
      let maxOpponentThreat = 0;
      for (const tId in game.properties) {
        const prop = game.properties[tId];
        if (prop.ownerId && prop.ownerId !== active.id && !prop.mortgaged) {
          const tile = BOARD_TILES[tId];
          const rent = game.calculateRent(tId);
          if (rent > maxOpponentThreat) maxOpponentThreat = rent;
        }
      }

      // B. BORÇ & KRİZ YÖNETİMİ (USTA SEVİYESİ LİKİDİTASYON)
      if (active.money < 0) {
        // Stratejik Tasfiye 1: Tekel olmayan mülklerin evlerini sat
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
        // Stratejik Tasfiye 2: Tekel olmayan arsaları ipotek et (Tekel setini koru!)
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
        // Stratejik Tasfiye 3: Hala yetmiyorsa tekel evlerini sat
        if (active.money < 0) {
          for (const tId in game.properties) {
            const prop = game.properties[tId];
            if (prop.ownerId === active.id && prop.houses > 0) {
              game.sellHouse(active.id, Number(tId));
              if (active.money >= 0) break;
            }
          }
        }
        // Stratejik Tasfiye 4: Son çare tekel arsalarını ipotek et
        if (active.money < 0) {
          for (const tId in game.properties) {
            const prop = game.properties[tId];
            if (prop.ownerId === active.id && !prop.mortgaged) {
              game.mortgageProperty(active.id, Number(tId));
              if (active.money >= 0) break;
            }
          }
        }
        // Stratejik Tasfiye 5: Banka kredisi
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

      // C. KODES STRATEJİSİ (ERKEN OYUN VS GEÇ OYUN TAKTİĞİ)
      if (active.inJail) {
        const boardHasDangerousHouses = maxOpponentThreat > 300;

        if (strat === "GRANDMASTER" || strat === "AUCTION_SHARK") {
          // Eğer tahtada tehlikeli evler varsa: KODESTE PUSUYA YAT!
          if (boardHasDangerousHouses && rounds > 15) {
            res.jailStallAttempts++;
            // 50₺ harç ödeme, çift atmayı dene
          } else {
            // Erken oyunda arsa kapmak için hemen çık
            if (active.jailCards > 0) game.useJailCard(active.id);
            else if (active.money >= 150) game.payJailFine(active.id);
          }
        } else if (strat === "MONOPOLY_RUSHER") {
          // Her zaman hemen çık, vakit kaybetme
          if (active.jailCards > 0) game.useJailCard(active.id);
          else if (active.money >= 100) game.payJailFine(active.id);
        } else if (strat === "CASH_TITAN") {
          if (active.money >= 400) game.payJailFine(active.id);
        }
      }

      // D. ZAR ATMA
      if (game.phase === "WAITING_ROLL") {
        game.rollDice(active.id);
      }

      // E. MÜLK SATIN ALMA KARARLARI (STRATEJİK SATIN ALMA)
      if (game.phase === "TILE_ACTION") {
        const tile = game.currentTile;
        if (tile) {
          let shouldBuy = false;
          const cost = tile.cost;

          if (strat === "MONOPOLY_RUSHER") {
            // Parası yeten her şeyi al
            shouldBuy = active.money >= cost + 40;
          } else if (strat === "CASH_TITAN") {
            // Tren garları ve lüksleri çok sev, ama 250₺ rezerv tut
            if (tile.type === "railroad") shouldBuy = active.money >= cost + 100;
            else shouldBuy = active.money >= cost + 250;
          } else if (strat === "AUCTION_SHARK") {
            // Turuncu, Kırmızı, Sarı ve Koyu Mavi ise kesin al, değilse ucuza açık artırmaya düşür
            const isHighROI = ["orange", "red", "yellow", "dark_blue"].includes(tile.group);
            if (isHighROI) shouldBuy = active.money >= cost + 60;
            else shouldBuy = active.money >= cost + 200; // Pas geçerse açık artırmada ucuza kapar
          } else if (strat === "GRANDMASTER") {
            // EV Analizi: Kendi tekelini tamamlıyorsa veya rakibin tekelini blokluyorsa borçlanarak bile al!
            const groupIds = COLOR_GROUPS[tile.group] || [];
            const isMonopolyCompleter = groupIds.filter(id => game.properties[id]?.ownerId === active.id).length === groupIds.length - 1;
            const isBlocker = groupIds.some(id => {
              const oId = game.properties[id]?.ownerId;
              return oId && oId !== active.id && groupIds.filter(gId => game.properties[gId]?.ownerId === oId).length === groupIds.length - 1;
            });

            if (isMonopolyCompleter || isBlocker) {
              shouldBuy = active.money >= cost; // Bloke veya tamamlama: her koşulda al!
            } else {
              shouldBuy = active.money >= cost + Math.max(80, Math.floor(maxOpponentThreat * 0.3));
            }
          }

          if (shouldBuy) game.buyCurrentProperty(active.id);
          else game.declineBuy(active.id);
        }
      }

      // F. MÜZAYEDE (AÇIK ARTIRMA KÖPEKBALIĞI & BLOKLAMA)
      if (game.phase === "AUCTION" && game.auction) {
        let auctionLoops = 0;
        while (game.phase === "AUCTION" && game.auction && auctionLoops < 15) {
          auctionLoops++;
          const auction = game.auction;
          const activeParticipants = game.players.filter(p => !p.isBankrupt && !auction.passedPlayerIds.includes(p.id) && p.id !== auction.highestBidderId);
          if (activeParticipants.length === 0) {
            game.endAuction();
            break;
          }

          const bidder = activeParticipants[0];
          const bStrat = playerStrategies[bidder.id];
          const tCost = auction.tileCost || 100;
          const tile = BOARD_TILES[game.currentTile?.id || 0];

          // İhale Değerleme Çarpanı
          let valueMultiplier = 0.80;
          if (bStrat === "AUCTION_SHARK") valueMultiplier = 1.35; // Fırsatçı agresif teklif verir
          else if (bStrat === "GRANDMASTER") {
            // Tekel tamamlama veya bloklama kontrolü
            const groupIds = COLOR_GROUPS[tile?.group] || [];
            const isCritical = groupIds.some(id => game.properties[id]?.ownerId !== null);
            valueMultiplier = isCritical ? 1.40 : 0.85;
          } else if (bStrat === "MONOPOLY_RUSHER") valueMultiplier = 1.05;
          else if (bStrat === "CASH_TITAN") valueMultiplier = tile?.type === "railroad" ? 1.25 : 0.65;

          const maxBid = Math.floor(tCost * valueMultiplier);
          const inc = Math.max(10, Math.floor(tCost * 0.1));
          const nextBid = auction.currentBid + inc;

          if (nextBid <= maxBid && bidder.money >= nextBid + 50) {
            game.placeBid(bidder.id, nextBid);
            if (bStrat === "AUCTION_SHARK") res.auctionSnipeCount++;
          } else {
            game.passAuction(bidder.id);
          }
        }
        if (game.phase === "AUCTION") game.endAuction();
      }

      // G. İNŞAAT STRATEJİSİ (3-EV OPTİMAL KURALI VS OTEL SALDIRISI)
      if (game.phase === "TURN_ACTIONS") {
        for (const tId in game.properties) {
          const prop = game.properties[tId];
          if (prop.ownerId === active.id) {
            const tile = BOARD_TILES[tId];
            if (tile && tile.type === "property") {
              const houses = prop.houses || 0;

              if (strat === "MONOPOLY_RUSHER" || strat === "GRANDMASTER") {
                // 3 Ev Kuralı: Bütün set 3 ev olmadan 4. ve oteli dikme! (Maksimum ROI)
                const groupIds = COLOR_GROUPS[tile.group] || [];
                const minInGroup = Math.min(...groupIds.map(id => game.properties[id]?.houses || 0));

                if (minInGroup < 3 && houses < 3 && active.money >= tile.houseCost + 60) {
                  game.buildHouse(active.id, Number(tId));
                  threeHouseUsed = true;
                } else if (minInGroup >= 3 && active.money >= tile.houseCost + 200) {
                  game.buildHouse(active.id, Number(tId));
                  hotelUsed = true;
                }
              } else if (strat === "CASH_TITAN") {
                // Sadece kasada 400₺ üstü nakit varken inşa et
                if (active.money >= tile.houseCost + 400) {
                  game.buildHouse(active.id, Number(tId));
                }
              } else if (strat === "AUCTION_SHARK") {
                if (active.money >= tile.houseCost + 120) {
                  game.buildHouse(active.id, Number(tId));
                }
              }
            }
          }
        }

        // İpoteği Açma (Gereksiz faiz ödememek için)
        if (active.money >= 350) {
          for (const tId in game.properties) {
            if (game.properties[tId].ownerId === active.id && game.properties[tId].mortgaged) {
              game.unmortgageProperty(active.id, Number(tId));
              break;
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
      const winnerStrat = playerStrategies[game.winner.id];
      if (winnerStrat) res.strategyWins[winnerStrat]++;

      const winnerSeat = game.players.findIndex(p => p.id === game.winner.id);
      if (winnerSeat >= 0) res.seatWins[winnerSeat]++;

      if (threeHouseUsed) res.threeHousePeakWins++;
      if (hotelUsed) res.hotelRushWins++;
      if (res.jailStallAttempts > 0) res.jailStallSuccessCount++;
    } else {
      res.turnTimeouts++;
    }

    res.roundSum += rounds;
    unrecorded++;
    if (unrecorded >= reportBatch || g === games - 1) {
      parentPort.postMessage({ type: "progress", count: unrecorded });
      unrecorded = 0;
    }
  }

  parentPort.postMessage({ type: "result", data: res });
}
