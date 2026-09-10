/**
 * boardCoordinates.js
 * 11x11 Responsive Müteahhit tahta geometrisini Three.js 3D dünya koordinatlarına (X, Y, Z) eşler.
 * Tahta Zemini: X [-10, 10], Z [-10, 10], Y: Dikey eksen (Yukarı)
 */

export const BOARD_EXTENT = 10; // Tahta yarıçapı (alan: [-10, 10])

// 11x11 Grid kolon/satır merkez koordinatları (Köşeler: 1.45fr, Kenarlar: 1fr, Toplam: 11.9fr)
function getGridFractionOffset(gridIndex) {
  // gridIndex: 1'den 11'e (CSS Grid satır/sütun indeksi)
  if (gridIndex === 1) return -0.87815 * BOARD_EXTENT; // Sol / Üst köşe
  if (gridIndex === 11) return 0.87815 * BOARD_EXTENT; // Sağ / Alt köşe

  // 2..10 arasındaki kenar kareleri (Merkez 6 = 0)
  const edgeUnitStep = (2.0 / 11.9) * BOARD_EXTENT; // ~1.68 birim
  return (gridIndex - 6) * edgeUnitStep;
}

// Her bir karenin (0..39) 3D dünya düzlemindeki (X, Z) koordinatları
export function getTileWorldPosition(tileId) {
  let colIndex = 1;
  let rowIndex = 1;

  if (tileId === 0) {
    rowIndex = 11;
    colIndex = 11;
  } else if (tileId >= 1 && tileId <= 9) {
    rowIndex = 11;
    colIndex = 11 - tileId;
  } else if (tileId === 10) {
    rowIndex = 11;
    colIndex = 1;
  } else if (tileId >= 11 && tileId <= 19) {
    rowIndex = 11 - (tileId - 10);
    colIndex = 1;
  } else if (tileId === 20) {
    rowIndex = 1;
    colIndex = 1;
  } else if (tileId >= 21 && tileId <= 29) {
    rowIndex = 1;
    colIndex = tileId - 19;
  } else if (tileId === 30) {
    rowIndex = 1;
    colIndex = 11;
  } else if (tileId >= 31 && tileId <= 39) {
    rowIndex = tileId - 29;
    colIndex = 11;
  }

  const x = getGridFractionOffset(colIndex);
  const z = getGridFractionOffset(rowIndex);

  return { x, y: 0.15, z };
}

// Aynı karede birden fazla piyon olduğunda çakışmayı önleyen radyal ofset (%40 küçültülmüş piyonlara optimize)
export function getPawnTileOffset(playerIndexInTile, totalPlayersInTile) {
  if (totalPlayersInTile <= 1) return { x: 0, z: 0 };

  const radius = 0.28;
  const angle = (playerIndexInTile / totalPlayersInTile) * (Math.PI * 2);
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius
  };
}

// İki kare arasındaki yol boyunca adım adım waypoint noktalarını oluşturur
export function getWaypointPath(fromIndex, toIndex, boardSize = 40) {
  const steps = [];
  let current = fromIndex;

  while (current !== toIndex) {
    current = (current + 1) % boardSize;
    steps.push(current);
  }

  return steps;
}
