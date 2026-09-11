import * as THREE from 'three';
import { getTileWorldPosition, getPawnTileOffset } from './boardCoordinates.js';
import { createPlayerToken } from './proceduralTokens.js';

// Açıyı (-PI, +PI] aralığında normalize ederek en kısa açı farkını hesaplayan ve lerp eden fonksiyon (360 spin kesinlikle önlenir)
function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function lerpAngle(current, target, alpha) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return normalizeAngle(current + diff * alpha);
}

// ─── Prosedürel Dinamik Zemin Temas Gölgesi (Contact Drop Shadow) ──────────────
// Ağır WebGL gölge haritası pass'leri yerine, sıfır GPU yüküyle çalışan 60 FPS
// radyal gradyan temas gölgesi. Piyon zıpladıkça küçülüp solar, indikçe netleşir.
let cachedShadowTexture = null;
function getContactShadowTexture() {
  if (!cachedShadowTexture && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.16)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    cachedShadowTexture = new THREE.CanvasTexture(canvas);
  }
  return cachedShadowTexture;
}

const VECTOR_ONE = new THREE.Vector3(1, 1, 1);
let cachedShadowGeo = null;

function getContactShadowGeo() {
  if (!cachedShadowGeo) {
    cachedShadowGeo = new THREE.PlaneGeometry(0.78, 0.78);
  }
  return cachedShadowGeo;
}

function createContactShadowMesh() {
  const geo = getContactShadowGeo();
  const mat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity: 0.68,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// ─── Prosedürel 3D Konum Oku (Chevron / Arrow Pointer) ─────────────────────────
// Piyonun tam tepesinde süzülen, köşelerde 45° açıyla karta bakan şık ve hafif 3D ok.
let cachedArrowGeo = null;
function getArrowGeometry() {
  if (!cachedArrowGeo) {
    const shape = new THREE.Shape();
    // Ok ucu +Z yönüne bakar (top-down görünümde South / aşağı)
    shape.moveTo(0, 0.44);        // Uç
    shape.lineTo(-0.24, 0.08);   // Sol kanat ucu
    shape.lineTo(-0.11, 0.12);   // Sol iç oyuk
    shape.lineTo(-0.11, -0.26);  // Sol gövde altı
    shape.lineTo(0.11, -0.26);   // Sağ gövde altı
    shape.lineTo(0.11, 0.12);    // Sağ iç oyuk
    shape.lineTo(0.24, 0.08);    // Sağ kanat ucu
    shape.closePath();

    const extrudeSettings = {
      depth: 0.10,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Geometriyi yatay XZ düzlemine yatır: +Z yönüne baksın
    geo.rotateX(-Math.PI / 2);
    geo.center();
    cachedArrowGeo = geo;
  }
  return cachedArrowGeo;
}

function createLocationArrow(colorHex = '#fbbf24') {
  const group = new THREE.Group();
  group.name = 'player_location_arrow';

  const geo = getArrowGeometry();
  const mainColor = new THREE.Color(colorHex);

  const mat = new THREE.MeshStandardMaterial({
    color: mainColor,
    emissive: mainColor,
    emissiveIntensity: 0.88,
    roughness: 0.22,
    metalness: 0.18
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);

  // Beyaz parıldayan kontur (Aura)
  const edges = new THREE.EdgesGeometry(geo, 25);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.92
  });
  const line = new THREE.LineSegments(edges, lineMat);
  group.add(line);

  group.userData = {
    colorHex,
    dispose: () => {
      mat.dispose();
      lineMat.dispose();
      edges.dispose();
    }
  };

  return group;
}

export class Board3DManager {
  constructor() {
    this.container = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animFrameId = null;

    this.playerTokens = new Map(); // playerId -> { root, currentTile, startPos, targetPos, targetRotY, hopProgress, tokenId, color }
    this.resizeObserver = null;
    this.isLoopRunning = false;
    this.wakeUntil = 0;
    this._renderLoopBound = this._renderLoop.bind(this);
    this.lastRenderTime = 0;
  }

  setupScene(container, onDiceClick = null) {
    this.container = container;
    this.onDiceClickCallback = onDiceClick;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 800;

    // 1. Sahne
    this.scene = new THREE.Scene();

    // 2. Kamera: Tahtaya tam dik ve sıfır perspektif kaymasıyla bakan OrthographicCamera
    // 11x11 CSS Grid ile Three.js dünya koordinatları (BOARD_EXTENT = 10 -> [-10, 10]) birebir pixel-perfect örtüşür.
    const frustumSize = 20;
    this.frustumSize = frustumSize;
    this.camera = new THREE.OrthographicCamera(
      -frustumSize / 2,
      frustumSize / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    );
    this.camera.position.set(0, 25, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 0, -1);

    // 3. Renderer (Şeffaf WebGL Canvas - 2D tahtanın üstüne tam oturur)
    // 🔋 Donanım & Pil Kalkanı: Mobilde termal ısınmayı ve pili korumak için 'default' GPU ve 1.15x tavan, masaüstünde 1.5x 'high-performance'
    const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || /Android|iPhone|iPad/i.test(navigator.userAgent));
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
      powerPreference: isMobile ? 'default' : 'high-performance'
    });
    this.renderer.setSize(width, height);
    const maxDpr = isMobile ? 1.15 : 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.shadowMap.enabled = false; // ⚡ 60 FPS: İkincil shadow pass kaldırılarak GPU çizim yükü yarıya indirildi
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Canvas stili
    const canvas = this.renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    // 4. Işıklandırma Sistemi (AmbientLight + DirectionalLight)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    dirLight.position.set(8, 22, 10);
    dirLight.castShadow = false;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 40;
    dirLight.shadow.camera.left = -12;
    dirLight.shadow.camera.right = 12;
    dirLight.shadow.camera.top = 12;
    dirLight.shadow.camera.bottom = -12;
    dirLight.shadow.bias = -0.0006;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    fillLight.position.set(-10, 14, -8);
    this.scene.add(fillLight);

    // ResizeObserver ile responsive boyutlandırma
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    this.handleResize();

    // Sahne ilk açıldığında render et ve dinlenmeye geç
    this.wakeLoop(1200);
  }

  setCanRoll(_canRoll) {
    // Arayüz uyumluluğu için no-op
  }

  handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    const aspect = width / height;
    const fs = this.frustumSize || 20;
    if (aspect >= 1) {
      this.camera.left = (-fs * aspect) / 2;
      this.camera.right = (fs * aspect) / 2;
      this.camera.top = fs / 2;
      this.camera.bottom = -fs / 2;
    } else {
      this.camera.left = -fs / 2;
      this.camera.right = fs / 2;
      this.camera.top = (fs / aspect) / 2;
      this.camera.bottom = (-fs / aspect) / 2;
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderOnce();
  }

  _disposeToken(root, shadow = null, arrow = null) {
    if (arrow && this.scene) {
      this.scene.remove(arrow);
      arrow.userData?.dispose?.();
    }
    if (shadow && this.scene) {
      this.scene.remove(shadow);
      shadow.material?.dispose();
    }
    if (!root) return;
    root.traverse((child) => {
      if (child.isMesh) {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              if (m.map) m.map.dispose();
              m?.dispose?.();
            });
          } else {
            if (child.material.map) child.material.map.dispose();
            child.material?.dispose?.();
          }
        }
      }
    });
  }

  // Tahta rayları üzerindeki piyonların hareket yönüne dönmesi (South, West, North, East)
  _getBoardTrackRotation(tileId) {
    if (tileId >= 1 && tileId <= 10) return -Math.PI / 2;
    if (tileId >= 11 && tileId <= 20) return -Math.PI;
    if (tileId >= 21 && tileId <= 30) return Math.PI / 2;
    return 0; // 31..39, 0
  }

  // 3D Konum Oku Açısı: Tahtanın 4 köşesinde (0, 10, 20, 30) tam 45° çapraz, kenarlarında ise karta dik açı
  _getTileArrowRotation(tileId) {
    // 0: GO (Alt-Sağ Köşe) -> Tahta merkezinden sağ alta çapraz 45°
    if (tileId === 0) return Math.PI / 4;
    // 1..9: Alt Kenar -> Aşağı karta doğru (+Z)
    if (tileId >= 1 && tileId <= 9) return 0;
    // 10: Maliye / Kodes (Alt-Sol Köşe) -> Tahta merkezinden sol alta çapraz 45°
    if (tileId === 10) return -Math.PI / 4;
    // 11..19: Sol Kenar -> Sola karta doğru (-X)
    if (tileId >= 11 && tileId <= 19) return -Math.PI / 2;
    // 20: Ücretsiz Otopark (Üst-Sol Köşe) -> Tahta merkezinden sol üste çapraz 45°
    if (tileId === 20) return -3 * Math.PI / 4;
    // 21..29: Üst Kenar -> Yukarı karta doğru (-Z)
    if (tileId >= 21 && tileId <= 29) return Math.PI;
    // 30: Müfettiş (Üst-Sağ Köşe) -> Tahta merkezinden sağ üste çapraz 45°
    if (tileId === 30) return 3 * Math.PI / 4;
    // 31..39: Sağ Kenar -> Sağa karta doğru (+X)
    return Math.PI / 2;
  }

  // Oyuncu 3D piyonlarının Three.js sahnesiyle canlı senkronizasyonu
  syncPlayers(players, displayedPositions = {}, myPlayerId = null, currentTurnPlayerId = null) {
    if (!this.scene) return;
    if (!players || !Array.isArray(players)) return;

    const activePlayerIds = new Set();
    const tileOccupants = new Map();
    let hasMovement = false;

    // 1. İflas etmemiş aktif oyuncuları ve durdukları kareleri haritalandır
    for (const p of players) {
      if (p.isBankrupt) continue;
      activePlayerIds.add(p.id);
      const tileId = displayedPositions[p.id] ?? p.position ?? 0;
      if (!tileOccupants.has(tileId)) tileOccupants.set(tileId, []);
      tileOccupants.get(tileId).push(p);
    }

    // 2. Oyundan çıkan / iflas eden piyonları sahneden temizle ve bellek sızıntısını önle
    for (const [pId, record] of this.playerTokens.entries()) {
      if (!activePlayerIds.has(pId)) {
        if (record?.root) {
          this.scene.remove(record.root);
          this._disposeToken(record.root, record.shadow, record.arrow);
        }
        this.playerTokens.delete(pId);
        hasMovement = true;
      }
    }

    // 3. Her aktif oyuncunun 3D piyonunu ve konum okunu senkronize et
    for (const p of players) {
      if (p.isBankrupt) continue;

      const tileId = displayedPositions[p.id] ?? p.position ?? 0;
      const worldPos = getTileWorldPosition(tileId);

      const occupants = tileOccupants.get(tileId) || [p];
      const idxInTile = occupants.findIndex((o) => o.id === p.id);
      const offset = getPawnTileOffset(idxInTile >= 0 ? idxInTile : 0, occupants.length);

      const targetX = worldPos.x + offset.x;
      const targetZ = worldPos.z + offset.z;
      const targetRotY = this._getBoardTrackRotation(tileId);

      const isMe = p.id === myPlayerId;
      const isTurn = Boolean(currentTurnPlayerId && p.id === currentTurnPlayerId);
      const shouldHaveArrow = isMe || isTurn;
      const arrowColor = isMe ? '#fbbf24' : (p.color || '#38bdf8');
      const arrowRot = this._getTileArrowRotation(tileId);

      let record = this.playerTokens.get(p.id);

      if (!record) {
        // Yeni piyon oluştur (tahta için optimize edilmiş 0.72 ölçek ve zengin 3D açılı -0.28 pitchAngle)
        const root = createPlayerToken(p.token?.id || 'hard_hat', p.color || '#ef4444', null, {
          targetScale: 0.72,
          pitchAngle: -0.28,
          showPedestal: false
        });
        root.position.set(targetX, 0.02, targetZ);
        root.rotation.y = targetRotY;
        this.scene.add(root);

        // Zemin temas gölgesi
        const shadow = createContactShadowMesh();
        shadow.position.set(targetX, 0.005, targetZ);
        this.scene.add(shadow);

        let arrow = null;
        if (shouldHaveArrow) {
          arrow = createLocationArrow(arrowColor);
          arrow.position.set(targetX, 0.97, targetZ);
          arrow.rotation.y = arrowRot;
          this.scene.add(arrow);
        }

        record = {
          root,
          shadow,
          arrow,
          currentTile: tileId,
          startPos: new THREE.Vector3(targetX, 0.02, targetZ),
          targetPos: new THREE.Vector3(targetX, 0.02, targetZ),
          startRotY: targetRotY,
          targetRotY,
          startArrowRot: arrowRot,
          targetArrowRot: arrowRot,
          hopProgress: 1.0,
          tokenId: p.token?.id,
          color: p.color
        };
        this.playerTokens.set(p.id, record);
        hasMovement = true;
      } else {
        // Model veya renk değişmişse güncelle ve eski materyalleri temizle
        if (record.tokenId !== p.token?.id || record.color !== p.color) {
          this.scene.remove(record.root);
          this._disposeToken(record.root, record.shadow);

          const newRoot = createPlayerToken(p.token?.id || 'hard_hat', p.color || '#ef4444', null, {
            targetScale: 0.72,
            pitchAngle: -0.28,
            showPedestal: false
          });
          newRoot.position.copy(record.root.position);
          newRoot.rotation.copy(record.root.rotation);
          this.scene.add(newRoot);

          const newShadow = createContactShadowMesh();
          newShadow.position.set(newRoot.position.x, 0.005, newRoot.position.z);
          this.scene.add(newShadow);

          record.root = newRoot;
          record.shadow = newShadow;
          record.tokenId = p.token?.id;
          record.color = p.color;
          hasMovement = true;
        }

        // 3D Konum Oku Yönetimi (Bizim oyuncumuzda daima, rakipte ise sadece sıra ondayken)
        if (shouldHaveArrow) {
          if (!record.arrow) {
            const arrow = createLocationArrow(arrowColor);
            arrow.position.set(record.root.position.x, record.root.position.y + 0.97, record.root.position.z);
            arrow.rotation.y = arrowRot;
            this.scene.add(arrow);
            record.arrow = arrow;
            record.startArrowRot = arrowRot;
            record.targetArrowRot = arrowRot;
            hasMovement = true;
          } else if (record.arrow.userData.colorHex !== arrowColor) {
            this.scene.remove(record.arrow);
            record.arrow.userData?.dispose?.();
            const arrow = createLocationArrow(arrowColor);
            arrow.position.set(record.root.position.x, record.root.position.y + 0.97, record.root.position.z);
            arrow.rotation.y = arrowRot;
            this.scene.add(arrow);
            record.arrow = arrow;
            record.startArrowRot = arrowRot;
            record.targetArrowRot = arrowRot;
            hasMovement = true;
          }
        } else if (record.arrow) {
          this.scene.remove(record.arrow);
          record.arrow.userData?.dispose?.();
          record.arrow = null;
          hasMovement = true;
        }

        record.targetRotY = targetRotY;

        // Kare değişimi -> Zıplama animasyonunu (parabolik hop) başlat
        if (record.currentTile !== tileId) {
          record.startPos.copy(record.root.position);
          record.targetPos.set(targetX, 0.02, targetZ);
          record.startRotY = record.root.rotation.y;
          record.targetRotY = targetRotY;

          if (record.arrow) {
            record.startArrowRot = record.arrow.rotation.y;
            record.targetArrowRot = arrowRot;
          }

          record.hopProgress = 0.0;
          record.currentTile = tileId;
          hasMovement = true;
        } else {
          // Aynı karedeyken konum farkı varsa güncelle
          if (Math.abs(record.targetPos.x - targetX) > 0.01 || Math.abs(record.targetPos.z - targetZ) > 0.01) {
            record.targetPos.set(targetX, 0.02, targetZ);
            hasMovement = true;
          }
          if (record.arrow) {
            record.targetArrowRot = arrowRot;
          }
        }
      }
    }

    if (hasMovement) {
      this.wakeLoop(1400);
    } else if (!this._hasInitialRender) {
      this._hasInitialRender = true;
      this.renderOnce();
    }
  }

  rollDice(_targetDice = [1, 1], onComplete = null) {
    if (onComplete) onComplete();
  }

  wakeLoop(durationMs = 1200) {
    this.wakeUntil = Math.max(this.wakeUntil || 0, performance.now() + durationMs);
    if (!this.isLoopRunning) {
      this.isLoopRunning = true;
      this.lastRenderTime = performance.now();
      this.animFrameId = requestAnimationFrame(this._renderLoopBound);
    }
  }

  renderOnce() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _renderLoop(now = performance.now()) {
    const dt = Math.min(0.033, (now - (this.lastRenderTime || now)) / 1000);
    this.lastRenderTime = now;

    let hasActiveAnimation = false;

    // 3D Piyonların yay çizerek (parabolik hop) pürüzsüz ilerlemesi
    for (const record of this.playerTokens.values()) {
      if (!record?.root) continue;

      if (record.hopProgress < 1.0) {
        hasActiveAnimation = true;
        // 160ms'lik adım süresine tam uyumlu, pürüzsüz ve doğal parabolik yay temposu (1.0 / 0.160s = 6.25)
        record.hopProgress = Math.min(1.0, record.hopProgress + dt * 6.25);
        const t = record.hopProgress;

        // X ve Z ekseninde pürüzsüz smoothstep interpolasyonu
        const easeT = t * t * (3 - 2 * t);
        record.root.position.x = THREE.MathUtils.lerp(record.startPos.x, record.targetPos.x, easeT);
        record.root.position.z = THREE.MathUtils.lerp(record.startPos.z, record.targetPos.z, easeT);

        // Y ekseninde zengin parabolik zıplama yayı (hop) - Köşe karelerin mesafesine göre dinamik yay yüksekliği
        const dist = record.startPos.distanceTo(record.targetPos);
        const hopHeight = 0.55 * Math.min(1.4, Math.max(1.0, dist / 1.7));
        const arc = Math.sin(t * Math.PI) * hopHeight;
        record.root.position.y = 0.02 + arc;

        // 1. ZEMİN GÖLGESİ DİNAMİĞİ: Piyon havalandıkça zemin gölgesi küçülür ve solar, indikçe koyulaşır
        if (record.shadow) {
          record.shadow.position.x = record.root.position.x;
          record.shadow.position.z = record.root.position.z;
          const shadowScale = Math.max(0.45, 1.0 - (arc / hopHeight) * 0.45);
          record.shadow.scale.set(shadowScale, shadowScale, 1);
          record.shadow.material.opacity = Math.max(0.18, 0.68 - (arc / hopHeight) * 0.45);
        }

        // 2. YÖN DÖNÜŞÜ (Hop easeT'ye kilitli, yere temas anında 100% tamamlanan pürüzsüz köşe dönüşü)
        if (record.targetRotY !== undefined) {
          const startRot = record.startRotY !== undefined ? record.startRotY : record.root.rotation.y;
          const rotDiff = Math.atan2(Math.sin(record.targetRotY - startRot), Math.cos(record.targetRotY - startRot));
          record.root.rotation.y = normalizeAngle(startRot + rotDiff * easeT);
        }

        // 3. SQUASH & STRETCH FİZİĞİ:
        let scaleY = 1.0;
        let scaleXZ = 1.0;
        if (t < 0.82) {
          const stretch = (arc / hopHeight) * 0.15;
          scaleY = 1.0 + stretch;
          scaleXZ = 1.0 - stretch * 0.5;
        } else {
          const landT = (t - 0.82) / 0.18; // 0..1
          const squash = Math.sin(landT * Math.PI) * 0.15;
          scaleY = 1.0 - squash;
          scaleXZ = 1.0 + squash * 0.6;
        }
        record.root.scale.set(scaleXZ, scaleY, scaleXZ);

        // 4. 3D KONUM OKU (Piyonla havada %100 senkronize zıplama ve köşe 45° açısına pürüzsüz dönüş)
        if (record.arrow) {
          const floatBob = Math.sin(now * 0.0038) * 0.06;
          record.arrow.position.x = record.root.position.x;
          record.arrow.position.z = record.root.position.z;
          record.arrow.position.y = record.root.position.y + 0.95 + floatBob;

          if (record.targetArrowRot !== undefined) {
            const startArrow = record.startArrowRot !== undefined ? record.startArrowRot : record.arrow.rotation.y;
            const arrowDiff = Math.atan2(Math.sin(record.targetArrowRot - startArrow), Math.cos(record.targetArrowRot - startArrow));
            record.arrow.rotation.y = normalizeAngle(startArrow + arrowDiff * easeT);
          }
        }
      } else {
        // Dinlenme (Idle): pürüzsüzce orijinal ölçeğe ve zemine tam otur
        record.root.scale.lerp(VECTOR_ONE, 0.22);
        record.root.position.copy(record.targetPos);
        record.root.position.y = 0.02;

        if (record.shadow) {
          record.shadow.position.x = record.targetPos.x;
          record.shadow.position.z = record.targetPos.z;
          record.shadow.scale.lerp(VECTOR_ONE, 0.22);
          record.shadow.material.opacity = THREE.MathUtils.lerp(record.shadow.material.opacity, 0.68, 0.22);
        }

        if (record.targetRotY !== undefined) {
          record.root.rotation.y = record.targetRotY;
          record.startRotY = record.targetRotY;
        }

        // 4. 3D KONUM OKU (Dinlenme anında piyonun tepesinde hafif süzülme - floating bobbing)
        if (record.arrow) {
          hasActiveAnimation = true;
          const floatBob = Math.sin(now * 0.0038) * 0.06;
          record.arrow.position.x = record.targetPos.x;
          record.arrow.position.z = record.targetPos.z;
          record.arrow.position.y = 0.97 + floatBob;

          if (record.targetArrowRot !== undefined) {
            record.arrow.rotation.y = record.targetArrowRot;
            record.startArrowRot = record.targetArrowRot;
          }
        }
      }
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    // Eğer tüm piyonlar durduysa ve uyanıklık süresi dolduysa RAF döngüsünü durdur
    const shouldSleep = !hasActiveAnimation && now > this.wakeUntil;
    if (shouldSleep) {
      this.isLoopRunning = false;
      this.animFrameId = null;
      return;
    }

    this.animFrameId = requestAnimationFrame(this._renderLoopBound);
  }

  dispose() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isLoopRunning = false;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.playerTokens) {
      for (const record of this.playerTokens.values()) {
        if (record?.arrow) {
          this.scene?.remove(record.arrow);
          record.arrow.userData?.dispose?.();
        }
        if (record?.shadow) {
          this.scene?.remove(record.shadow);
          record.shadow.geometry?.dispose();
          record.shadow.material?.dispose();
        }
        if (record?.root) {
          this._disposeToken(record.root);
        }
      }
      this.playerTokens.clear();
    }
    if (this.scene) {
      this.scene.traverse((child) => {
        if (child.isMesh) {
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => {
                if (m.map) m.map.dispose();
                m?.dispose?.();
              });
            } else {
              if (child.material.map) child.material.map.dispose();
              child.material?.dispose?.();
            }
          }
        }
      });
      this.scene.clear();
      this.scene = null;
    }
    if (this.renderer) {
      if (this.renderer.domElement?.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
      this.renderer = null;
    }
    this.camera = null;
    this.container = null;
  }
}
