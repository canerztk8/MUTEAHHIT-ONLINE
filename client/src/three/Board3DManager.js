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
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    // Yüksek DPI ekranlarda GPU fill-rate yükünü hafifleten 1.5x tavan
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    dirLight.castShadow = true;
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

    // 5. Tahta Zemin Gölge Yakalayıcısı (Görünmez zemin, piyon ve zar gölgelerini yakalar)
    const shadowPlaneGeo = new THREE.PlaneGeometry(24, 24);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.38 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.01;
    shadowPlane.receiveShadow = true;
    this.scene.add(shadowPlane);

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

  _disposeToken(root) {
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
    if (tileId >= 0 && tileId <= 9) return -Math.PI / 2;
    if (tileId >= 10 && tileId <= 19) return -Math.PI;
    if (tileId >= 20 && tileId <= 29) return Math.PI / 2;
    return 0; // 30..39
  }

  // Oyuncu 3D piyonlarının Three.js sahnesiyle canlı senkronizasyonu
  syncPlayers(players, displayedPositions = {}) {
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
          this._disposeToken(record.root);
        }
        this.playerTokens.delete(pId);
        hasMovement = true;
      }
    }

    // 3. Her aktif oyuncunun 3D piyonunu senkronize et
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

      let record = this.playerTokens.get(p.id);

      if (!record) {
        // Yeni piyon oluştur (tahta için %40 küçültülmüş 0.69 ölçek ve kaidesiz saf model)
        const root = createPlayerToken(p.token?.id || 'hard_hat', p.color || '#ef4444', null, {
          targetScale: 0.69,
          pitchAngle: -0.22,
          showPedestal: false
        });
        root.position.set(targetX, 0.02, targetZ);
        root.rotation.y = targetRotY;
        this.scene.add(root);

        record = {
          root,
          currentTile: tileId,
          startPos: new THREE.Vector3(targetX, 0.02, targetZ),
          targetPos: new THREE.Vector3(targetX, 0.02, targetZ),
          targetRotY,
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
          this._disposeToken(record.root);

          const newRoot = createPlayerToken(p.token?.id || 'hard_hat', p.color || '#ef4444', null, {
            targetScale: 0.69,
            pitchAngle: -0.22,
            showPedestal: false
          });
          newRoot.position.copy(record.root.position);
          newRoot.rotation.copy(record.root.rotation);
          this.scene.add(newRoot);
          record.root = newRoot;
          record.tokenId = p.token?.id;
          record.color = p.color;
          hasMovement = true;
        }

        record.targetRotY = targetRotY;

        // Kare değişimi -> Zıplama animasyonunu (parabolik hop) başlat
        if (record.currentTile !== tileId) {
          record.startPos.copy(record.root.position);
          record.targetPos.set(targetX, 0.02, targetZ);
          record.hopProgress = 0.0;
          record.currentTile = tileId;
          hasMovement = true;
        } else {
          // Aynı karedeyken konum farkı varsa güncelle
          if (Math.abs(record.targetPos.x - targetX) > 0.01 || Math.abs(record.targetPos.z - targetZ) > 0.01) {
            record.targetPos.set(targetX, 0.02, targetZ);
            hasMovement = true;
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
        record.hopProgress = Math.min(1.0, record.hopProgress + dt * 6.5);
        const t = record.hopProgress;
        record.root.position.lerpVectors(record.startPos, record.targetPos, t);
        const hopHeight = 0.45;
        const arc = Math.sin(t * Math.PI) * hopHeight;
        record.root.position.y = 0.02 + arc;

        if (record.targetRotY !== undefined) {
          record.root.rotation.y = lerpAngle(record.root.rotation.y, record.targetRotY, dt * 10.0);
        }
      } else {
        // Dinlenme konumuna yaklaş
        const distSq = record.root.position.distanceToSquared(record.targetPos);
        if (distSq > 0.0001) {
          hasActiveAnimation = true;
          record.root.position.lerp(record.targetPos, 0.25);
        } else {
          record.root.position.copy(record.targetPos);
        }

        if (record.targetRotY !== undefined) {
          const diff = Math.abs(Math.atan2(Math.sin(record.targetRotY - record.root.rotation.y), Math.cos(record.targetRotY - record.root.rotation.y)));
          if (diff > 0.005) {
            hasActiveAnimation = true;
            record.root.rotation.y = lerpAngle(record.root.rotation.y, record.targetRotY, 0.15);
          } else {
            record.root.rotation.y = record.targetRotY;
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
