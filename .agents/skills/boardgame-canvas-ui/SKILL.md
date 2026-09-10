---
name: boardgame-canvas-ui
description: >-
  Advanced responsive UI/UX, 2D/3D board layouts, and pawn movement animations for web Monopoly board games.
  Use when designing or debugging the 40-tile board grid, token hop waypoint interpolation,
  3D dice rolling animations, deed inspection cards, interactive trading dialogs, and mobile-adaptive game boards.
---

# Board Game Canvas & Responsive UI Skill

Design systems, mathematical layout formulas, and animation techniques for high-performance web board games built with React, CSS Grid, Canvas, and Tailwind.

---

## 1. The 11x11 Responsive Board Grid Geometry

A standard Monopoly board is an 11x11 square grid containing 40 perimeter tiles and an open center area:
* **Corners:** 4 corner tiles (GO, Jail, Free Parking, Go to Jail), each occupying a $1 \times 1$ corner unit (larger aspect ratio, e.g., $1.5 \times 1.5$ relative to standard edge tiles).
* **Edges:** 9 tiles per edge (Bottom/South, Left/West, Top/North, Right/East).
* **Center:** A $9 \times 9$ inner space for cards, dice trays, logs, and game announcements.

### Optimal CSS Grid Template (Fractional Units):
```css
.monopoly-board {
  display: grid;
  grid-template-columns: 1.6fr repeat(9, 1fr) 1.6fr;
  grid-template-rows: 1.6fr repeat(9, 1fr) 1.6fr;
  width: min(92vw, 92vh, 850px);
  height: min(92vw, 92vh, 850px);
  aspect-ratio: 1 / 1;
  position: relative;
  user-select: none;
}
```

### Tile Coordinate Mapping (Index 0 to 39):
* **Tile 0 (GO):** Row 11, Column 11
* **Tiles 1 to 9 (South Row):** Row 11, Column $10 - (i - 1)$
* **Tile 10 (Jail):** Row 11, Column 1
* **Tiles 11 to 19 (West Row):** Row $10 - (i - 11)$, Column 1
* **Tile 20 (Free Parking):** Row 1, Column 1
* **Tiles 21 to 29 (North Row):** Row 1, Column $2 + (i - 21)$
* **Tile 30 (Go To Jail):** Row 1, Column 11
* **Tiles 31 to 39 (East Row):** Row $2 + (i - 31)$, Column 11
* **Inner Center:** Grid Row 2 to 11, Grid Column 2 to 11

---

## 2. Pawn Token Multi-Occupancy & Collision Stacking

When multiple players occupy the same tile, tokens must not obscure each other. Use radial or grid displacement offsets:

```javascript
export function getTokenOffset(playerIndexInTile, totalPlayersInTile) {
  if (totalPlayersInTile <= 1) return { x: 0, y: 0 };
  
  const radius = 14; // pixels
  const angle = (playerIndexInTile / totalPlayersInTile) * (2 * Math.PI);
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius)
  };
}
```

---

## 3. Smooth Pawn Waypoint Traversal Animation

Instead of teleporting directly to the destination tile, authentic board games animate the pawn hopping sequentially tile-by-tile ($N \to N+1 \to \dots \to \text{target}$):

### Waypoint Traversal Algorithm:
```javascript
export function animatePawnStepByStep({
  fromIndex,
  toIndex,
  boardSize = 40,
  hopDurationMs = 220,
  onStep,
  onComplete,
  playHopSound
}) {
  const steps = [];
  let curr = fromIndex;
  
  while (curr !== toIndex) {
    curr = (curr + 1) % boardSize;
    steps.push(curr);
  }

  let stepIdx = 0;
  function step() {
    if (stepIdx < steps.length) {
      const tile = steps[stepIdx];
      onStep(tile);
      if (playHopSound) playHopSound();
      stepIdx++;
      setTimeout(step, hopDurationMs);
    } else {
      if (onComplete) onComplete();
    }
  }

  step();
}
```

### Hop Bounce Keyframe (CSS):
```css
@keyframes pawn-hop {
  0% { transform: translate(var(--tx), var(--ty)) scale(1); }
  45% { transform: translate(var(--tx), calc(var(--ty) - 18px)) scale(1.18); }
  100% { transform: translate(var(--tx), var(--ty)) scale(1); }
}
.pawn-hopping {
  animation: pawn-hop 0.22s cubic-bezier(0.25, 1, 0.5, 1);
}
```

---

## 4. 3D Dice Rolling Animation (Pure CSS & JS)

Use a 3D perspective cube for maximum tactile feedback:
```html
<div class="dice-scene">
  <div class="cube" style="transform: rotateX(var(--rx)deg) rotateY(var(--ry)deg);">
    <div class="cube-face face-1">1</div>
    <div class="cube-face face-2">2</div>
    <div class="cube-face face-3">3</div>
    <div class="cube-face face-4">4</div>
    <div class="cube-face face-5">5</div>
    <div class="cube-face face-6">6</div>
  </div>
</div>
```

### Face Orientation Map:
* Face 1: `rotateY(0deg)`
* Face 2: `rotateY(90deg)`
* Face 3: `rotateY(180deg)`
* Face 4: `rotateY(-90deg)`
* Face 5: `rotateX(90deg)`
* Face 6: `rotateX(-90deg)`

To roll: Add random full revolutions ($360^\circ \times 3$) to the base face rotation over a 1-second transition timing function `cubic-bezier(0.15, 0.9, 0.3, 1.2)`.

---

## 5. Title Deed Modal Card Component

Render property deeds faithfully to physical Monopoly cards:
1. **Color Header Bar:** Authentic color matching the group (e.g. Navy, Dark Pink, Orange, Red, Yellow, Green, Dark Blue).
2. **Title:** Uppercase bold property name.
3. **Rent Breakdown Table:**
   - Base Rent
   - With 1 House, 2 Houses, 3 Houses, 4 Houses
   - With HOTEL
4. **Footer:** Mortgage Value ($50\%$) and House Cost ($50 / 100 / 150 / 200).
5. **Interactive Controls:** Build House, Sell House, Mortgage / Unmortgage buttons dynamically enabled based on player funds and game state.

---

## 6. Mobile Responsive Adaptations

On screens narrower than 768px:
1. Board scales dynamically using CSS `transform: scale(...)` or `zoom` based on viewport width.
2. Bottom-fixed action drawer for current player actions (Roll, End Turn, Manage Properties).
3. Tap on any tile opens a lightweight bottom sheet preview instead of a blocking popup.
