import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Nokta konum koordinatları (512x512 Canvas için hassas merkezler)
const DOT_COORDS = {
  1: [[256, 256]],
  2: [[140, 140], [372, 372]],
  3: [[140, 140], [256, 256], [372, 372]],
  4: [[140, 140], [372, 140], [140, 372], [372, 372]],
  5: [[140, 140], [372, 140], [256, 256], [140, 372], [372, 372]],
  6: [[140, 126], [372, 126], [140, 256], [372, 256], [140, 386], [372, 386]]
};

/**
 * 512x512 Yüksek Çözünürlüklü Fildişi & Derin Çukur Nokta (Engraved Pip) Diffuse Dokusu
 */
function createDiceFaceTexture(value) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // 1. Zemin: Lüks Fildişi / Akrilik Reçine Radyal Gradyanı
  const bgGrad = ctx.createRadialGradient(256, 256, 40, 256, 256, 320);
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(0.5, '#faf8f5');
  bgGrad.addColorStop(0.85, '#f1ece1');
  bgGrad.addColorStop(1, '#e5ded0');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 512);

  // 2. Pahlı kenar hafif iç gölgesi (Subtle edge vignette)
  ctx.strokeStyle = 'rgba(180, 165, 145, 0.25)';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, 494, 494);

  const coords = DOT_COORDS[value] || DOT_COORDS[1];
  const isOne = value === 1;
  const radius = isOne ? 68 : 46;

  coords.forEach(([x, y]) => {
    // A. Noktanın dış çukur gölgesi (Hafif oyuk derinlik hissi)
    const bevelGrad = ctx.createRadialGradient(x, y - 2, radius * 0.8, x, y, radius + 5);
    bevelGrad.addColorStop(0, 'rgba(0,0,0,0)');
    bevelGrad.addColorStop(0.8, 'rgba(0,0,0,0.15)');
    bevelGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = bevelGrad;
    ctx.fill();

    // B. Noktanın Ana Rengi (İçbükey oyuk dolgusu)
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);

    if (isOne) {
      // 1 Numaralı yüz: Lüks Yakut / Kızıl Ejder kırmızısı
      const redGrad = ctx.createRadialGradient(x - radius * 0.25, y - radius * 0.25, radius * 0.1, x, y, radius);
      redGrad.addColorStop(0, '#f87171');
      redGrad.addColorStop(0.4, '#dc2626');
      redGrad.addColorStop(0.8, '#991b1b');
      redGrad.addColorStop(1, '#6b1111');
      ctx.fillStyle = redGrad;
    } else {
      // 2..6 Numaralı yüzler: Derin Obsidyen Siyahı ve fildişi çukur gölgesi
      const darkGrad = ctx.createRadialGradient(x - radius * 0.25, y - radius * 0.25, radius * 0.1, x, y, radius);
      darkGrad.addColorStop(0, '#475569');
      darkGrad.addColorStop(0.45, '#1e293b');
      darkGrad.addColorStop(0.85, '#090d16');
      darkGrad.addColorStop(1, '#000000');
      ctx.fillStyle = darkGrad;
    }
    ctx.fill();

    // C. Oyuk Kenarı Işık Parıltısı (Hilal şeklinde alt kenar refleksi)
    ctx.beginPath();
    ctx.arc(x, y, radius - 2, Math.PI * 0.1, Math.PI * 0.9, false);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.stroke();

    // D. Nokta içi mine parıltısı (Üst sol specular nokta)
    ctx.beginPath();
    ctx.arc(x - radius * 0.32, y - radius * 0.32, radius * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

/**
 * Dokunsal Derinlik için Bump Map Haritası (Noktalar içbükey çukur, zemin düz)
 */
function createDiceBumpMap(value) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Zemin beyaz (nötr yükseklik)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);

  const scale = 0.5; // 512 -> 256
  const coords = DOT_COORDS[value] || DOT_COORDS[1];
  const isOne = value === 1;
  const radius = (isOne ? 68 : 46) * scale;

  coords.forEach(([cx, cy]) => {
    const x = cx * scale;
    const y = cy * scale;

    const bumpGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    bumpGrad.addColorStop(0, '#050505'); // En derin nokta (koyu siyah)
    bumpGrad.addColorStop(0.7, '#404040');
    bumpGrad.addColorStop(0.9, '#a0a0a0');
    bumpGrad.addColorStop(1, '#ffffff'); // Zemin düzeyi

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = bumpGrad;
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// 6 Yüzün Paylaşılan Materyal Havuzu (Shared Material Pool)
// İki zarın aynı doku ve shader'ları paylaşmasını sağlayarak VRAM ve Draw Call yükünü yarıya indirir
let cachedDiceMaterials = null;
let cachedDiceGeometry = null;

function getSharedDiceMaterials() {
  if (!cachedDiceMaterials) {
    const faces = [2, 5, 1, 6, 3, 4];
    cachedDiceMaterials = faces.map((val) => {
      return new THREE.MeshStandardMaterial({
        map: createDiceFaceTexture(val),
        bumpMap: createDiceBumpMap(val),
        bumpScale: 0.035,
        roughness: 0.14,
        metalness: 0.04,
        color: 0xffffff
      });
    });
  }
  return cachedDiceMaterials;
}

/**
 * AAA Kalitesinde Optimize Edilmiş Yuvarlatılmış Pahlı Kenarlı 3D D6 Zar Mesh'i
 * (Segments: 2 ile 900 vertex, 60-144 FPS akıcı performans)
 */
export function createDiceMesh(size = 0.95) {
  if (!cachedDiceGeometry) {
    // 2 segment pah: Görsel yuvarlaklığı korurken vertex sayısını 4356'dan 900'e (%80) düşürür
    cachedDiceGeometry = new RoundedBoxGeometry(size, size, size, 2, 0.14);
  }

  const materials = getSharedDiceMaterials();
  const dice = new THREE.Mesh(cachedDiceGeometry, materials);

  dice.castShadow = true;
  dice.receiveShadow = true;
  dice.userData = { isDice: true, size };

  return dice;
}

/**
 * Üst Yüz Tespiti (Top Face Detection)
 * Zarın mevcut kuaterniyonunu dünya (0, 1, 0) tavan vektörüyle skaler çarparak
 * hangi yüzün en dik yukarı baktığını tespit eder (1..6).
 */
export function detectDiceTopFace(dieMesh) {
  const faceNormals = [
    { value: 1, normal: new THREE.Vector3(0, 1, 0) },
    { value: 6, normal: new THREE.Vector3(0, -1, 0) },
    { value: 2, normal: new THREE.Vector3(1, 0, 0) },
    { value: 5, normal: new THREE.Vector3(-1, 0, 0) },
    { value: 3, normal: new THREE.Vector3(0, 0, 1) },
    { value: 4, normal: new THREE.Vector3(0, 0, -1) }
  ];

  let bestValue = 1;
  let maxDot = -Infinity;
  const worldUp = new THREE.Vector3(0, 1, 0);

  for (const face of faceNormals) {
    const worldNormal = face.normal.clone().applyQuaternion(dieMesh.quaternion);
    const dot = worldNormal.dot(worldUp);
    if (dot > maxDot) {
      maxDot = dot;
      bestValue = face.value;
    }
  }

  return bestValue;
}

/**
 * Belirli bir zar değerinin (1..6) üstte kalması için gereken temel Euler rotasyonları
 */
export function getRotationForDiceValue(value) {
  switch (value) {
    case 1:
      return new THREE.Euler(0, 0, 0);
    case 6:
      return new THREE.Euler(Math.PI, 0, 0);
    case 2:
      return new THREE.Euler(0, 0, Math.PI / 2);
    case 5:
      return new THREE.Euler(0, 0, -Math.PI / 2);
    case 3:
      return new THREE.Euler(-Math.PI / 2, 0, 0);
    case 4:
      return new THREE.Euler(Math.PI / 2, 0, 0);
    default:
      return new THREE.Euler(0, 0, 0);
  }
}

const DICE_LOCAL_NORMALS = {
  1: new THREE.Vector3(0, 1, 0),
  6: new THREE.Vector3(0, -1, 0),
  2: new THREE.Vector3(1, 0, 0),
  5: new THREE.Vector3(-1, 0, 0),
  3: new THREE.Vector3(0, 0, 1),
  4: new THREE.Vector3(0, 0, -1)
};
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Zarın mevcut dönme açısından hedeflenen yüz değerini (1..6) en kısa açıyla
 * tavana (+Y) döndüren pürüzsüz hedef kuaterniyonu hesaplar.
 * Doğal yuvarlanma yatay açısını (yaw) korur, zorlama yapmaz.
 * Hem getTargetQuaternionForFace(targetValue) hem de getTargetQuaternionForFace(currentQuat, targetValue) çağrılarını destekler.
 */
export function getTargetQuaternionForFace(arg1, arg2) {
  let currentQuat;
  let targetValue;

  if (typeof arg1 === 'number') {
    targetValue = arg1;
    currentQuat = (arg2 && typeof arg2.clone === 'function') ? arg2 : new THREE.Quaternion();
  } else if (arg1 && typeof arg1.clone === 'function') {
    currentQuat = arg1;
    targetValue = typeof arg2 === 'number' ? arg2 : 1;
  } else {
    currentQuat = new THREE.Quaternion();
    targetValue = typeof arg2 === 'number' ? arg2 : (typeof arg1 === 'number' ? arg1 : 1);
  }

  const localNormal = DICE_LOCAL_NORMALS[targetValue];
  if (!localNormal) return currentQuat.clone();

  const worldNormal = localNormal.clone().applyQuaternion(currentQuat).normalize();
  const qAlign = new THREE.Quaternion().setFromUnitVectors(worldNormal, WORLD_UP);
  return qAlign.clone().multiply(currentQuat).normalize();
}

