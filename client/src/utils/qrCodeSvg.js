/**
 * qrCodeSvg.js
 * Sıfır bağımlılıklı (zero-dependency) saf JavaScript QR Kod SVG üreteci.
 * URL ve oda bağlantılarını mobil tarayıcıların anında okuyabileceği standart SVG olarak oluşturur.
 */

const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  GF256_EXP[i] = x;
  GF256_EXP[i + 255] = x;
  GF256_LOG[x] = i;
  x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
}

function gfMul(x, y) {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], GF256_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsCompute(data, eccCount) {
  const gen = rsGeneratorPoly(eccCount);
  const res = new Uint8Array(eccCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[eccCount - 1] = 0;
    for (let j = 0; j < eccCount; j++) {
      res[j] ^= gfMul(gen[j], factor);
    }
  }
  return res;
}

export function generateQrMatrix(text) {
  const size = 29;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(null));

  // 1. Bulucu Desenleri (Finder Patterns)
  function setFinder(r0, c0) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = r0 + r;
        const col = c0 + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        const isBlack = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                        (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                        (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        matrix[row][col] = isBlack;
      }
    }
  }
  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  // 2. Zamanlama Çizgileri (Timing Patterns)
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    if (matrix[6][i] === null) matrix[6][i] = val;
    if (matrix[i][6] === null) matrix[i][6] = val;
  }

  // 3. Hizalama Deseni (Alignment Pattern) - V3 için (22, 22)
  function setAlignment(r0, c0) {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const isBlack = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        matrix[r0 + r][c0 + c] = isBlack;
      }
    }
  }
  setAlignment(size - 7, size - 7);

  // 4. Veri Kodlama (Byte Mode 8-bit, V3-L kapasitesi maksimum 42-44 byte)
  const rawUtf8 = new TextEncoder().encode(text);
  const utf8 = rawUtf8.length > 42 ? rawUtf8.slice(0, 42) : rawUtf8;
  const bitBuf = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bitBuf.push((val >> i) & 1);
    }
  }
  pushBits(0b0100, 4);
  pushBits(utf8.length, 8);
  for (const b of utf8) {
    pushBits(b, 8);
  }
  // Terminatör
  pushBits(0, Math.min(4, 55 * 8 - bitBuf.length));
  while (bitBuf.length % 8 !== 0) bitBuf.push(0);

  // Pad baytları
  const pad = [0xec, 0x11];
  let pIdx = 0;
  while (bitBuf.length < 44 * 8) {
    pushBits(pad[pIdx % 2], 8);
    pIdx++;
  }

  const dataBytes = new Uint8Array(44);
  for (let i = 0; i < 44; i++) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | (bitBuf[i * 8 + b] || 0);
    }
    dataBytes[i] = byteVal;
  }

  // Reed-Solomon Hata Düzeltme (26 ECC baytı)
  const ecc = rsCompute(dataBytes, 26);
  const finalBits = [];
  for (const b of dataBytes) {
    for (let bit = 7; bit >= 0; bit--) finalBits.push((b >> bit) & 1);
  }
  for (const b of ecc) {
    for (let bit = 7; bit >= 0; bit--) finalBits.push((b >> bit) & 1);
  }

  // 5. Matrise Yerleştirme (Zigzag)
  let bitIdx = 0;
  let dir = -1;
  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    const rows = dir === -1 ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const r of rows) {
      for (const col of [c, c - 1]) {
        if (matrix[r][col] === null) {
          const bit = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0;
          const mask = (r + col) % 2 === 0;
          matrix[r][col] = (bit ^ (mask ? 1 : 0)) === 1;
        }
      }
    }
    dir = -dir;
  }

  // Format Bilgisi (Mask 0, EC L -> 111011111000100)
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  for (let i = 0; i < 15; i++) {
    const bit = formatBits[i] === 1;
    if (i < 6) matrix[8][i] = bit;
    else if (i < 8) matrix[8][i + 1] = bit;
    else matrix[14 - (i - 8)][8] = bit;

    if (i < 8) matrix[size - 1 - i][8] = bit;
    else matrix[8][size - 15 + i] = bit;
  }
  matrix[size - 8][8] = true;

  return matrix;
}

export function generateQrSvg(text, fgColor = '#0f172a', bgColor = '#ffffff', margin = 2) {
  try {
    const matrix = generateQrMatrix(text);
    const size = matrix.length;
    const totalSize = size + margin * 2;

    let paths = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c]) {
          paths += `M${c + margin},${r + margin}h1v1h-1z `;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges">
      <rect width="${totalSize}" height="${totalSize}" fill="${bgColor}" rx="2" />
      <path d="${paths}" fill="${fgColor}" />
    </svg>`;
  } catch (e) {
    console.error('QR code generation error:', e);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f87171" /><text x="50" y="50" fill="white" font-size="8" text-anchor="middle">QR Hata</text></svg>`;
  }
}
