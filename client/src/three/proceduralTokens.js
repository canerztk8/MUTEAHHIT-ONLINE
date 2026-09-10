import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/gltf/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
const loadedModelCache = new Map();

/**
 * 3D Token Model URL eşleyicisi
 */
export function getPawnModelUrl(tokenId) {
  const modelMap = {
    hard_hat: '/models/pawns/hard_hat.glb',
    hardhat: '/models/pawns/hard_hat.glb',
    hat: '/models/pawns/hard_hat.glb',
    suv: '/models/pawns/suv.glb',
    car: '/models/pawns/suv.glb',
    excavator: '/models/pawns/excavator.glb',
    train: '/models/pawns/train.glb',
    sports_car: '/models/pawns/sports_car.glb',
    sneaker: '/models/pawns/sneaker.glb',
    warship: '/models/pawns/warship_ww12_us_dd.glb',
    sphinx: '/models/pawns/roman_sphinx.glb',
    scooter: '/models/pawns/scooter.glb'
  };
  return modelMap[tokenId] || `/models/pawns/${tokenId}.glb`;
}

/**
 * Piyonların kapladıkları görsel alan, taban alanı (footprint) ve hacimlerini eşitleyen ölçek çarpanları.
 * Uzun/ince modellerin (savaş gemisi, tren, spor araba) tahtada iğne gibi küçücük kalmasını,
 * küresel/kübik modellerin (sarı baret) devasa durmasını engeller; tüm piyonları eşit boyuta getirir.
 */
export const TOKEN_SCALE_MULTIPLIERS = {
  hard_hat: 0.88,
  hardhat: 0.88,
  hat: 0.88,
  excavator: 0.92,
  sneaker: 1.00,
  suv: 1.15,
  car: 1.15,
  sphinx: 1.55,
  scooter: 1.15,
  sports_car: 1.35,
  warship: 1.95,
  train: 1.85
};

export function getTokenScaleMultiplier(tokenId, size = null) {
  if (tokenId && TOKEN_SCALE_MULTIPLIERS[tokenId]) {
    return TOKEN_SCALE_MULTIPLIERS[tokenId];
  }
  // Otomatik hacimsel/alansal eşitleme formülü (yeni bir GLB modeli eklendiğinde devreye girer):
  if (size && size.x && size.y && size.z) {
    const maxDim = Math.max(size.x, size.y, size.z);
    const vol = size.x * size.y * size.z;
    const cbrtVol = Math.cbrt(vol);
    const fullness = cbrtVol / (maxDim || 1); // İnce modellerde düşük (0.3), küresel modellerde yüksek (0.8)
    return Math.min(2.1, Math.max(0.8, Math.sqrt(0.72 / Math.max(0.2, fullness))));
  }
  return 1.0;
}

/**
 * Procedural 3D Token Generator with PBR Metallic Finish
 * Her token oyuncu rengiyle kaplanmış otantik metal Müteahhit piyonu olarak üretilir.
 */

function createPedestal(playerColor) {
  const group = new THREE.Group();
  
  // Alt metal kaide
  const baseGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.08, 32);
  const baseMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(playerColor),
    metalness: 0.85,
    roughness: 0.2,
    envMapIntensity: 1.2
  });
  baseMat.__isCloned = true;
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.04;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Kaide altın yiv halkası
  const ringGeo = new THREE.TorusGeometry(0.43, 0.02, 16, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.9,
    roughness: 0.1
  });
  ringMat.__isCloned = true;
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  // Kaide üstü oyuncu renginde ışıltılı neon halka
  const neonRingGeo = new THREE.RingGeometry(0.33, 0.41, 32);
  const neonRingMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(playerColor),
    side: THREE.DoubleSide
  });
  neonRingMat.__isCloned = true;
  const neonRing = new THREE.Mesh(neonRingGeo, neonRingMat);
  neonRing.rotation.x = -Math.PI / 2;
  neonRing.position.y = 0.082;
  group.add(neonRing);

  return group;
}

// 1. Sarı Baret (Hard Hat 👷)
function createHardHatMesh(color) {
  const group = new THREE.Group();
  
  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24, // Şantiye sarısı
    metalness: 0.45,
    roughness: 0.25
  });

  const playerMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.75,
    roughness: 0.3
  });

  // Baret kubbesi
  const domeGeo = new THREE.SphereGeometry(0.28, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const dome = new THREE.Mesh(domeGeo, yellowMat);
  dome.position.y = 0.12;
  dome.scale.set(1.0, 0.85, 1.15);
  dome.castShadow = true;
  group.add(dome);

  // Siperlik (ön tarafı hafif uzatılmış tabla)
  const brimGeo = new THREE.CylinderGeometry(0.36, 0.38, 0.03, 32);
  const brim = new THREE.Mesh(brimGeo, yellowMat);
  brim.position.set(0, 0.12, 0.04);
  brim.scale.set(1.0, 1.0, 1.22);
  brim.castShadow = true;
  group.add(brim);

  // Üst mukavemet omurgası (şantiye baretlerinin klasik üst çıkıntısı)
  const ridgeGeo = new THREE.BoxGeometry(0.07, 0.06, 0.44);
  const ridge = new THREE.Mesh(ridgeGeo, yellowMat);
  ridge.position.set(0, 0.34, 0.04);
  ridge.castShadow = true;
  group.add(ridge);

  // Oyuncu renk kuşağı (baret çevresi renk şeridi)
  const bandGeo = new THREE.CylinderGeometry(0.31, 0.33, 0.04, 32);
  const band = new THREE.Mesh(bandGeo, playerMat);
  band.position.set(0, 0.14, 0.03);
  band.scale.set(0.95, 1.0, 1.12);
  group.add(band);

  // Ön reflektör amblem
  const emblemGeo = new THREE.BoxGeometry(0.1, 0.08, 0.02);
  const emblemMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.9,
    roughness: 0.1
  });
  const emblem = new THREE.Mesh(emblemGeo, emblemMat);
  emblem.position.set(0, 0.22, 0.32);
  emblem.rotation.x = -0.25;
  group.add(emblem);

  return group;
}

// 2. Lüks SUV Şantiye Aracı (SUV 🚙)
function createSuvMesh(color) {
  const group = new THREE.Group();
  
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.85,
    roughness: 0.2
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.1
  });

  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    metalness: 0.3,
    roughness: 0.7
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.1
  });

  // Alt gövde
  const bodyGeo = new THREE.BoxGeometry(0.66, 0.16, 0.34);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.18;
  body.castShadow = true;
  group.add(body);

  // Kabin / Üst cam bloğu
  const cabGeo = new THREE.BoxGeometry(0.38, 0.16, 0.28);
  const cab = new THREE.Mesh(cabGeo, glassMat);
  cab.position.set(-0.04, 0.32, 0);
  cab.castShadow = true;
  group.add(cab);

  // Tavan çıtası (roof rack)
  const railGeo = new THREE.BoxGeometry(0.36, 0.02, 0.02);
  const rail1 = new THREE.Mesh(railGeo, chromeMat);
  rail1.position.set(-0.04, 0.41, 0.12);
  group.add(rail1);
  const rail2 = new THREE.Mesh(railGeo, chromeMat);
  rail2.position.set(-0.04, 0.41, -0.12);
  group.add(rail2);

  // Ön tampon koruma demiri (Bull bar)
  const barGeo = new THREE.BoxGeometry(0.04, 0.12, 0.28);
  const bar = new THREE.Mesh(barGeo, chromeMat);
  bar.position.set(0.34, 0.17, 0);
  group.add(bar);

  // Farlar (LED)
  const lightGeo = new THREE.BoxGeometry(0.02, 0.05, 0.08);
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });
  const l1 = new THREE.Mesh(lightGeo, lightMat);
  l1.position.set(0.33, 0.22, 0.11);
  group.add(l1);
  const l2 = new THREE.Mesh(lightGeo, lightMat);
  l2.position.set(0.33, 0.22, -0.11);
  group.add(l2);

  // 4 Büyük Arazi Tekerleği
  const wheelGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.07, 16);
  const wheelOffsets = [
    [-0.2, 0.09, 0.17],
    [-0.2, 0.09, -0.17],
    [0.2, 0.09, 0.17],
    [0.2, 0.09, -0.17]
  ];
  wheelOffsets.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, blackMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    group.add(wheel);

    const rimGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.075, 12);
    const rim = new THREE.Mesh(rimGeo, chromeMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, y, z);
    group.add(rim);
  });

  return group;
}

// 3. Kepçe / Ekskavatör (Excavator 🚜)
function createExcavatorMesh(color) {
  const group = new THREE.Group();

  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // İş makinesi sarısı
    metalness: 0.5,
    roughness: 0.3
  });

  const playerMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.8,
    roughness: 0.25
  });

  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    metalness: 0.4,
    roughness: 0.6
  });

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.9,
    roughness: 0.2
  });

  // Paletler
  const treadGeo = new THREE.BoxGeometry(0.56, 0.1, 0.09);
  const t1 = new THREE.Mesh(treadGeo, blackMat);
  t1.position.set(0, 0.09, 0.14);
  t1.castShadow = true;
  group.add(t1);

  const t2 = new THREE.Mesh(treadGeo, blackMat);
  t2.position.set(0, 0.09, -0.14);
  t2.castShadow = true;
  group.add(t2);

  // Şasi
  const chassisGeo = new THREE.BoxGeometry(0.38, 0.06, 0.2);
  const chassis = new THREE.Mesh(chassisGeo, blackMat);
  chassis.position.set(0, 0.11, 0);
  group.add(chassis);

  // Dönen üst kabin & motor
  const cabGeo = new THREE.BoxGeometry(0.34, 0.2, 0.26);
  const cab = new THREE.Mesh(cabGeo, yellowMat);
  cab.position.set(-0.06, 0.23, 0);
  cab.castShadow = true;
  group.add(cab);

  // Kabin camı
  const glassGeo = new THREE.BoxGeometry(0.14, 0.15, 0.12);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.1 });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0.04, 0.25, 0.06);
  group.add(glass);

  // Arka karşı ağırlık (Oyuncu renginde)
  const counterGeo = new THREE.BoxGeometry(0.1, 0.18, 0.26);
  const counter = new THREE.Mesh(counterGeo, playerMat);
  counter.position.set(-0.18, 0.23, 0);
  group.add(counter);

  // Bom kolu 1 (Yukarı eğimli ana kol)
  const boom1Geo = new THREE.BoxGeometry(0.06, 0.32, 0.06);
  const boom1 = new THREE.Mesh(boom1Geo, yellowMat);
  boom1.rotation.z = -Math.PI / 4;
  boom1.position.set(0.18, 0.34, -0.04);
  boom1.castShadow = true;
  group.add(boom1);

  // Bom kolu 2 (Kova kolu)
  const boom2Geo = new THREE.BoxGeometry(0.05, 0.24, 0.05);
  const boom2 = new THREE.Mesh(boom2Geo, yellowMat);
  boom2.rotation.z = Math.PI / 3;
  boom2.position.set(0.34, 0.36, -0.04);
  boom2.castShadow = true;
  group.add(boom2);

  // Kazıcı Kepçe (Bucket)
  const bucketGeo = new THREE.BoxGeometry(0.14, 0.1, 0.12);
  const bucket = new THREE.Mesh(bucketGeo, steelMat);
  bucket.rotation.z = -Math.PI / 6;
  bucket.position.set(0.42, 0.22, -0.04);
  bucket.castShadow = true;
  group.add(bucket);

  return group;
}

// 4. Ankara Kedisi (Cat 🐈)
function createCatMesh(color) {
  const group = new THREE.Group();

  const furMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc, // Ankara kedisi beyaz kürkü
    metalness: 0.2,
    roughness: 0.5
  });

  const playerMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.85,
    roughness: 0.2
  });

  // Gövde
  const bodyGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.38, 16);
  const body = new THREE.Mesh(bodyGeo, furMat);
  body.rotation.z = Math.PI / 3;
  body.position.set(-0.06, 0.26, 0);
  body.castShadow = true;
  group.add(body);

  // Kafa
  const headGeo = new THREE.SphereGeometry(0.14, 16, 16);
  const head = new THREE.Mesh(headGeo, furMat);
  head.position.set(0.14, 0.4, 0);
  head.castShadow = true;
  group.add(head);

  // Kulaklar
  const earGeo = new THREE.ConeGeometry(0.05, 0.12, 4);
  const ear1 = new THREE.Mesh(earGeo, furMat);
  ear1.position.set(0.14, 0.53, 0.08);
  ear1.rotation.z = -0.15;
  group.add(ear1);

  const ear2 = new THREE.Mesh(earGeo, furMat);
  ear2.position.set(0.14, 0.53, -0.08);
  ear2.rotation.z = -0.15;
  group.add(ear2);

  // Renkli Gözler (Ankara Kedisi Klasiği: Mavi & Yeşil)
  const eyeGeo = new THREE.SphereGeometry(0.022, 8, 8);
  const blueEyeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.4 });
  const greenEyeMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x16a34a, emissiveIntensity: 0.4 });

  const eye1 = new THREE.Mesh(eyeGeo, blueEyeMat);
  eye1.position.set(0.24, 0.42, 0.06);
  group.add(eye1);

  const eye2 = new THREE.Mesh(eyeGeo, greenEyeMat);
  eye2.position.set(0.24, 0.42, -0.06);
  group.add(eye2);

  // Burun
  const snoutGeo = new THREE.BoxGeometry(0.06, 0.04, 0.06);
  const snoutMat = new THREE.MeshStandardMaterial({ color: 0xfda4af });
  const snout = new THREE.Mesh(snoutGeo, snoutMat);
  snout.position.set(0.26, 0.38, 0);
  group.add(snout);

  // Tasma
  const collarGeo = new THREE.TorusGeometry(0.12, 0.02, 12, 24);
  const collar = new THREE.Mesh(collarGeo, playerMat);
  collar.position.set(0.1, 0.32, 0);
  collar.rotation.y = Math.PI / 2;
  group.add(collar);

  // Ayaklar
  const legGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.18, 12);
  const legOffsets = [
    [-0.18, 0.1, 0.08],
    [-0.18, 0.1, -0.08],
    [0.08, 0.1, 0.08],
    [0.08, 0.1, -0.08]
  ];
  legOffsets.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, furMat);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    group.add(leg);
  });

  // Kuyruk
  const tailGeo = new THREE.CylinderGeometry(0.03, 0.015, 0.28, 8);
  const tail = new THREE.Mesh(tailGeo, furMat);
  tail.rotation.z = Math.PI / 3;
  tail.position.set(-0.28, 0.38, 0);
  group.add(tail);

  return group;
}

// 5. Kule Vinç (Tower Crane 🏗️)
function createCraneMesh(color) {
  const group = new THREE.Group();

  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.65,
    roughness: 0.3
  });

  const playerMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.85,
    roughness: 0.2
  });

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.9,
    roughness: 0.2
  });

  // Dikey kule (Mast)
  const mastGeo = new THREE.BoxGeometry(0.09, 0.62, 0.09);
  const mast = new THREE.Mesh(mastGeo, yellowMat);
  mast.position.y = 0.35;
  mast.castShadow = true;
  group.add(mast);

  // Operatör kabini
  const cabGeo = new THREE.BoxGeometry(0.18, 0.14, 0.14);
  const cab = new THREE.Mesh(cabGeo, playerMat);
  cab.position.set(0.04, 0.66, 0);
  cab.castShadow = true;
  group.add(cab);

  // Kabin camı
  const glassGeo = new THREE.BoxGeometry(0.08, 0.09, 0.11);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.1 });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0.1, 0.67, 0);
  group.add(glass);

  // Yatay bom kolu (Jib)
  const jibGeo = new THREE.BoxGeometry(0.72, 0.05, 0.05);
  const jib = new THREE.Mesh(jibGeo, yellowMat);
  jib.position.set(0.18, 0.74, 0);
  jib.castShadow = true;
  group.add(jib);

  // Arka karşı ağırlık bloğu
  const weightGeo = new THREE.BoxGeometry(0.14, 0.1, 0.1);
  const weight = new THREE.Mesh(weightGeo, steelMat);
  weight.position.set(-0.2, 0.71, 0);
  weight.castShadow = true;
  group.add(weight);

  // Kanca ve halat
  const cableGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6);
  const cable = new THREE.Mesh(cableGeo, steelMat);
  cable.position.set(0.38, 0.58, 0);
  group.add(cable);

  const hookGeo = new THREE.TorusGeometry(0.03, 0.012, 8, 16, Math.PI * 1.3);
  const hook = new THREE.Mesh(hookGeo, steelMat);
  hook.position.set(0.38, 0.41, 0);
  group.add(hook);

  return group;
}

// 6. Hızlı Tren (Bullet Train 🚄)
function createTrainMesh(color) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.6,
    roughness: 0.2
  });

  const playerMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.85,
    roughness: 0.2
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.1
  });

  // Gövde
  const bodyGeo = new THREE.BoxGeometry(0.68, 0.18, 0.26);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.17;
  body.castShadow = true;
  group.add(body);

  // Burun konisi
  const noseGeo = new THREE.ConeGeometry(0.13, 0.24, 16);
  const nose = new THREE.Mesh(noseGeo, bodyMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(0.44, 0.16, 0);
  nose.scale.set(1.0, 1.0, 0.85);
  nose.castShadow = true;
  group.add(nose);

  // Renkli şerit
  const stripeGeo = new THREE.BoxGeometry(0.78, 0.04, 0.265);
  const stripe = new THREE.Mesh(stripeGeo, playerMat);
  stripe.position.set(0.04, 0.17, 0);
  group.add(stripe);

  // Cam şeridi
  const windowGeo = new THREE.BoxGeometry(0.56, 0.04, 0.27);
  const windowStrip = new THREE.Mesh(windowGeo, darkMat);
  windowStrip.position.set(-0.02, 0.21, 0);
  group.add(windowStrip);

  // Kokpit
  const cockpitGeo = new THREE.BoxGeometry(0.1, 0.05, 0.16);
  const cockpit = new THREE.Mesh(cockpitGeo, darkMat);
  cockpit.rotation.z = -0.4;
  cockpit.position.set(0.38, 0.21, 0);
  group.add(cockpit);

  // Pantograf
  const pantoGeo = new THREE.BoxGeometry(0.14, 0.06, 0.08);
  const pantoMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.3 });
  const panto = new THREE.Mesh(pantoGeo, pantoMat);
  panto.position.set(-0.16, 0.28, 0);
  group.add(panto);

  return group;
}

const loadingPromisesCache = new Map();
const modelMetadataCache = new Map();
let isPreloadingStarted = false;

/**
 * 3D Modelin önbellekte olup olmadığını kontrol eder
 */
export function isPawnModelCached(tokenId) {
  const url = getPawnModelUrl(tokenId);
  return url ? loadedModelCache.has(url) : false;
}

const modelLoadedCallbacks = new Set();

/**
 * Piyon modeli arka planda indiğinde ve çözüldüğünde tetiklenecek dinleyici
 */
export function onPawnModelPreloaded(callback) {
  modelLoadedCallbacks.add(callback);
  return () => modelLoadedCallbacks.delete(callback);
}

/**
 * Tüm 3D piyon modellerini arka planda paralel ve hızlıca önbelleğe alır
 */
export function preloadPawnModels() {
  if (isPreloadingStarted) return;
  isPreloadingStarted = true;

  const tokenList = [
    'hard_hat',
    'suv',
    'train',
    'excavator',
    'sphinx',
    'sports_car',
    'sneaker',
    'warship',
    'scooter'
  ];

  const loadSingleToken = async (tokenId) => {
    const url = getPawnModelUrl(tokenId);
    if (!url) return;
    try {
      const scene = await loadGLTFModel(url);
      if (scene && !modelMetadataCache.has(url)) {
        const box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const tokenMultiplier = getTokenScaleMultiplier(tokenId, size);
        modelMetadataCache.set(url, {
          center: { x: center.x, y: center.y, z: center.z },
          minY: box.min.y,
          maxDim,
          tokenMultiplier
        });
      }
      // WebGL GPU Isıtma (Pre-warming) için dinleyicilere bildir
      modelLoadedCallbacks.forEach((cb) => {
        try { cb(tokenId, url, scene); } catch (e) {}
      });
    } catch (err) {
      console.warn(`[PawnPreloader] Preload error for ${tokenId}:`, err);
    }
  };

  // UI açılışını engellemeden 10ms sonra paralel indirmeyi başlat
  setTimeout(async () => {
    // 1. En popüler ilk 3 modeli hemen paralel indir
    await Promise.allSettled(tokenList.slice(0, 3).map(loadSingleToken));
    // 2. Kalan modelleri de paralel olarak hızla belleğe al
    Promise.allSettled(tokenList.slice(3).map(loadSingleToken));
  }, 10);
}

/**
 * Yüklenmiş GLTF sahnesini piyon ölçek ve renk ayarlarına göre optimize edilmiş şekilde hazırlar
 */
export function buildPawnMesh(gltfScene, tokenId, playerColor, options = {}) {
  const cloned = gltfScene.clone(true);
  const modelWrapper = new THREE.Group();

  const modelUrl = options.modelUrl || getPawnModelUrl(tokenId);
  let meta = modelMetadataCache.get(modelUrl);
  if (!meta) {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const tokenMultiplier = getTokenScaleMultiplier(tokenId, size);
    meta = {
      center: { x: center.x, y: center.y, z: center.z },
      minY: box.min.y,
      maxDim,
      tokenMultiplier
    };
    if (modelUrl) {
      modelMetadataCache.set(modelUrl, meta);
    }
  }

  const targetScale = ((options.targetScale || 0.41) * meta.tokenMultiplier) / meta.maxDim;

  // Pivot grubu: Model geometrisini kaide/zemin merkezine kusursuz oturtur
  const pivot = new THREE.Group();
  cloned.position.set(-meta.center.x, -meta.minY, -meta.center.z);
  pivot.add(cloned);

  // İsteğe bağlı öne/kameraya hafif eğim açısı (pitchAngle)
  if (options.pitchAngle) {
    pivot.rotation.x = options.pitchAngle;
  }

  modelWrapper.add(pivot);
  modelWrapper.scale.set(targetScale, targetScale, targetScale);
  modelWrapper.position.set(0, options.showPedestal ? 0.08 : 0, 0);

  const pColor = new THREE.Color(playerColor);

  cloned.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        const isArr = Array.isArray(child.material);
        const mats = isArr ? child.material : [child.material];
        let hasModified = false;

        const updatedMats = mats.map((mat) => {
          if (!mat) return mat;

          // 1. Kırmızı Spor Araba: Yalnızca kaporta ('paint', 'coat') oyuncu rengine bürünür
          if (tokenId === 'sports_car') {
            if (mat.name === 'paint' || mat.name === 'coat') {
              hasModified = true;
              const m = mat.clone();
              m.__isCloned = true;
              m.color.copy(pColor);
              m.roughness = 0.2;
              m.metalness = 0.8;
              return m;
            }
            // Camlar, farlar, jantlar, frenler, lastikler orijinal materyali paylaşır (sıfır klon, sıfır shader derleme)
            return mat;
          }

          // 2. Sneaker, Warship, Sphinx, Scooter: Gerçekçi dokulu 3D modeller
          // Orijinal doku ve materyalleri koru (sıfır gereksiz klonlama -> sıfır GPU shader derleme donması)
          if (['sneaker', 'warship', 'sphinx', 'scooter'].includes(tokenId)) {
            return mat;
          }

          // 3. Prosedürel/yarı-prosedürel modeller (suv, excavator, train, hard_hat)
          if (mat.map) {
            hasModified = true;
            const m = mat.clone();
            m.__isCloned = true;
            const tintColor = new THREE.Color().lerpColors(new THREE.Color(0xffffff), pColor, 0.65);
            m.color.copy(tintColor);
            if ('emissive' in m && m.emissive) {
              m.emissive.copy(pColor).multiplyScalar(0.18);
            }
            return m;
          } else if (mat.name === 'F44336' || mat.name === '_crayfishdiffuse' || mat.name === 'Yellow') {
            hasModified = true;
            const m = mat.clone();
            m.__isCloned = true;
            m.color.copy(pColor);
            return m;
          } else {
            const preserve = ['Window', 'Black', 'Concrete', 'White', 'Metal', '1A1A1A', 'FFFFFF', '78909C', '02___Default'];
            if (!preserve.includes(mat.name) && !mat.name?.startsWith('Cube')) {
              hasModified = true;
              const m = mat.clone();
              m.__isCloned = true;
              m.color.copy(pColor);
              return m;
            }
            return mat;
          }
        });

        if (hasModified) {
          child.material = isArr ? updatedMats : updatedMats[0];
        }
      }
    }
  });

  return modelWrapper;
}

/**
 * Oyuncu için 3D Token Nesnesi Oluşturucu
 * @param {string} tokenId - 'hard_hat', 'suv', 'excavator', 'sports_car', 'sneaker', 'warship', 'sphinx', 'scooter', 'train'
 * @param {string} playerColor - Hex renk kodu (örn. #ef4444)
 * @param {string} [customModelUrl] - Varsa harici .glb URL'i (verilmezse getPawnModelUrl(tokenId) kullanılır)
 * @param {object} [options] - Hedef boyut ve ölçek parametreleri
 */
export function createPlayerToken(tokenId, playerColor, customModelUrl = null, options = {}) {
  const root = new THREE.Group();
  root.name = `token_${tokenId}`;

  // Kaide yalnızca açıkça istendiğinde eklenir (varsayılan: kaidesiz, piyonun saf modeli)
  if (options.showPedestal) {
    const pedestal = createPedestal(playerColor);
    root.add(pedestal);
  }

  const modelUrl = customModelUrl || getPawnModelUrl(tokenId);

  // 1. Model zaten önbellekte hazırsa doğrudan ve senkron olarak tak (Asla geçici piyon flaşlamaz!)
  if (modelUrl && loadedModelCache.has(modelUrl)) {
    const gltfScene = loadedModelCache.get(modelUrl);
    const modelWrapper = buildPawnMesh(gltfScene, tokenId, playerColor, { ...options, modelUrl });
    root.add(modelWrapper);
    return root;
  }

  // 2. Model henüz hazır değilse:
  // SADECE o token ile birebir eşleşen prosedürel model varsa placeholder olarak göster
  // (Asla spor araba veya sfenkse alakasız baret/suv koyma!)
  let placeholderMesh = null;
  switch (tokenId) {
    case 'hard_hat':
    case 'hardhat':
    case 'hat':
      placeholderMesh = createHardHatMesh(playerColor);
      break;
    case 'suv':
    case 'car':
      placeholderMesh = createSuvMesh(playerColor);
      break;
    case 'excavator':
      placeholderMesh = createExcavatorMesh(playerColor);
      break;
    case 'train':
      placeholderMesh = createTrainMesh(playerColor);
      break;
    default:
      // sports_car, sneaker, warship, sphinx, scooter için alakasız model asla koyulmaz
      placeholderMesh = null;
      break;
  }

  if (placeholderMesh) {
    if (!options.showPedestal) {
      placeholderMesh.position.y -= 0.08;
    }
    placeholderMesh.name = '__temp_placeholder';
    root.add(placeholderMesh);
  }

  // 3. Asenkron yükleme tamamlandığında piyonu sahneye yerleştir
  if (modelUrl) {
    loadGLTFModel(modelUrl).then((gltfScene) => {
      if (gltfScene) {
        const temp = root.getObjectByName('__temp_placeholder');
        if (temp) root.remove(temp);

        const modelWrapper = buildPawnMesh(gltfScene, tokenId, playerColor, { ...options, modelUrl });
        root.add(modelWrapper);
      }
    }).catch((err) => {
      console.warn(`[createPlayerToken] Error loading GLB for ${tokenId}:`, err);
    });
  }

  return root;
}

// GLTF Modeli Yükleme ve Önbellekleme (Eşzamanlı istekleri tek promise altında birleştirir)
export function loadGLTFModel(url) {
  if (!url) return Promise.resolve(null);

  if (loadedModelCache.has(url)) {
    return Promise.resolve(loadedModelCache.get(url));
  }

  if (loadingPromisesCache.has(url)) {
    return loadingPromisesCache.get(url);
  }

  const promise = new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        loadedModelCache.set(url, gltf.scene);
        loadingPromisesCache.delete(url);
        resolve(gltf.scene);
      },
      undefined,
      (err) => {
        loadingPromisesCache.delete(url);
        reject(err);
      }
    );
  });

  loadingPromisesCache.set(url, promise);
  return promise;
}

