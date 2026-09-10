---
name: monopoly-ai-bot
description: >-
  Strategic artificial intelligence (AI) bot engine, decision trees, and heuristics for web Monopoly.
  Use when designing or debugging bot player behavior: property purchasing heuristics, auction valuation,
  the Three-House construction rule, intelligent trade proposals/counter-offers, tactical jail stalling,
  and optimal debt liquidation algorithms.
---

# Monopoly AI Bot & Strategic Heuristics Skill

Mathematical decision trees, probability models, and algorithmic heuristics for building intelligent, competitive AI players in digital Monopoly.

---

## 1. Board Tile Probabilities & Spatial Heatmaps

Due to 2d6 probability distribution (peak at sum 7) and frequent redirects to Jail (Tile 10):
* **Most Landed-On Tiles:** 
  1. **Kızılay Meydanı (Tile 24):** Direct landing 14 steps from Jail (two 7s or Chance redirect).
  2. **Marşandiz Garı (Tile 25)**
  3. **Eryaman (Tile 19) & Batıkent (Tile 18):** 8 and 9 steps from Jail.
* **Tier-1 Monopolies:** **Orange** (Etimesgut, Batıkent, Eryaman) and **Red** (Bahçelievler 7. Cadde, Emek, Kızılay). They have the highest frequency of visits and lowest cost-to-rent ratio.
* **Tier-2 Monopolies:** **Yellow** and **Green**.
* **Specialist Value:** **Dark Blue (Beysukent / Bilkent)** - Highest absolute rent, deadly late-game trap.

---

## 2. Property Purchase Heuristics

When an AI bot lands on an unowned property:
```javascript
export function shouldBotBuyProperty(bot, property, allTiles) {
  const price = property.price;
  const cashAfterPurchase = bot.money - price;
  
  // Rule 1: Always maintain a minimum emergency cash reserve
  const minReserve = 120; // Enough to survive standard early rents and taxes
  if (cashAfterPurchase < minReserve) {
    return false;
  }

  // Rule 2: Complete monopoly if this property finishes a color set
  const groupTiles = allTiles.filter(t => t.group === property.group);
  const ownedInGroup = groupTiles.filter(t => t.owner === bot.id).length;
  if (ownedInGroup === groupTiles.length - 1) {
    return true; // Urgent: complete monopoly!
  }

  // Rule 3: Block an opponent from completing a monopoly
  const opponentMonopolyThreat = groupTiles.some(t => {
    if (!t.owner) return false;
    const opponentOwned = groupTiles.filter(g => g.owner === t.owner).length;
    return opponentOwned === groupTiles.length - 1;
  });
  if (opponentMonopolyThreat) {
    return true; // Defensive block
  }

  // Rule 4: Standard acquisition if cash reserve remains healthy
  return cashAfterPurchase >= 150;
}
```

---

## 3. The "Three-House Rule" Construction Strategy

In Monopoly, the jump in rent from 2 houses to 3 houses is the steepest inflection point in the entire game (often jumping from $100 $\to$ $500+).

```
Houses:  0 ───> 1 ───> 2 ───> 3 (Huge Spike!) ───> 4 ───> Hotel
ROI:    Low    Mod    Good    MAXIMUM EFFICIENCY    Diminishing Returns
```

### Bot Building Priority:
1. **Target 3 houses per property** across the color set before pushing any to 4 houses or hotels.
2. Build on the highest-rent property in the group first (while adhering to the even-building rule).
3. Keep an emergency cash buffer equal to the average rent of opponents' active properties ($150 - $300).

---

## 4. Intelligent Trading Engine

The bot must evaluate trade proposals objectively and avoid "kingmaking" (giving an opponent a game-winning monopoly):

### Trade Evaluation Formula:
$$\text{Score} = \text{Cash Offered} + \sum \text{Strategic Value}(\text{Offered Properties}) - (\text{Cash Requested} + \sum \text{Strategic Value}(\text{Requested Properties}))$$

* **Strategic Value of Property:**
  - Base Value = Printed Cost
  - Completes Bot's Monopoly = $\text{Base Value} \times 3.5$
  - Completes Opponent's Monopoly = $-\text{Base Value} \times 4.0$ (Strictly decline unless bot also receives a monopoly of equal/higher tier + cash compensation)
  - Breaks Opponent's Monopoly = $\text{Base Value} \times 2.0$

---

## 5. Tactical Jail Behavior: Phase Dependent

* **Early Game (Unowned properties remain > 4):**
  - **Goal:** Get out immediately! Land and buy deeds.
  - **Action:** Pay $50 fine or use card on turn 1. Do not roll for doubles.
* **Late Game (All properties owned, board filled with houses):**
  - **Goal:** Stay safe inside the cell! Avoid lethal rent traps.
  - **Action:** Never pay the $50 fine. Roll for doubles and stay in jail for the maximum 3 turns.

---

## 6. Crisis Asset Liquidation Priority

When facing rent debt, execute liquidation in this optimal order:
1. **Mortgage standalone single properties** that belong to an incomplete, broken group.
2. **Mortgage Utilities** (Başkent EDAŞ / ASKİ Su İdaresi - low rent yield).
3. **Mortgage single Railroads** (if holding only 1 or 2).
4. **Sell houses evenly** on low-tier monopolies (Brown, Cyan) at 50% cost.
5. **Mortgage completed monopolies ONLY as the last resort.**
