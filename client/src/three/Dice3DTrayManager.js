import DiceBox from '@3d-dice/dice-box-threejs';
import { sounds } from '../sound/soundEffects.js';
import { getTargetQuaternionForFace, detectDiceTopFace } from './diceEngine.js';

export function generateRandomToss() {
  return {
    p1: [0, 2, 0],
    q1: [0, 0, 0, 1],
    v1: [0, -1, 0],
    w1: [5, 5, 5],
    p2: [0.5, 2, 0],
    q2: [0, 0, 0, 1],
    v2: [0, -1, 0],
    w2: [-5, 5, -5]
  };
}

export class Dice3DTrayManager {
  constructor() {
    this.box = null;
    this.container = null;
    this.isRolling = false;
    this.canRoll = false;
    this.onRollClickCallback = null;
    this.resizeObserver = null;
    this.boundClickHandler = null;
    this.isSceneReady = false;
  }

  /**
   * Klasik Monopoly zarı için 1..6 modern noktalı (pip) yüz görseli üretir
   */
  _createPipImage(faceNumber, size = 256) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Şeffaf arka plan – DiceBox yüzeyi beyaz plastik materyalle dolduracaktır
    ctx.clearRect(0, 0, size, size);

    // Modern zar yüzeyi çerçeve pahı (subtle modern edge bevel)
    if (typeof ctx.roundRect === 'function') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.lineWidth = 2.5;
      const pad = 10;
      const rad = 24;
      ctx.beginPath();
      ctx.roundRect(pad, pad, size - pad * 2, size - pad * 2, rad);
      ctx.stroke();
    }

    const radius = size * 0.082; // ~21px
    const c = size * 0.5;        // 128
    const p1 = size * 0.27;      // ~69
    const p2 = size * 0.73;      // ~187

    const drawDot = (x, y, r = radius) => {
      // 1. Dış derinlik / gölge (engraved depth shadow)
      ctx.beginPath();
      ctx.arc(x, y + r * 0.07, r * 1.04, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fill();

      // 2. Modern lake obsidian akrilik degradeli gövde
      if (typeof ctx.createRadialGradient === 'function') {
        const dotGrad = ctx.createRadialGradient(
          x - r * 0.3, y - r * 0.3, r * 0.08,
          x, y, r
        );
        dotGrad.addColorStop(0, '#27272a'); // Hafif tepe ışıltısı
        dotGrad.addColorStop(0.45, '#18181b'); // Derin parlak lake siyah
        dotGrad.addColorStop(1, '#09090b'); // Dip gölge
        ctx.fillStyle = dotGrad;
      } else {
        ctx.fillStyle = '#111111';
      }

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // 3. Mikro speküler parıltı (modern cam/akrilik derinliği)
      ctx.beginPath();
      ctx.arc(x - r * 0.24, y - r * 0.24, r * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fill();
    };

    switch (faceNumber) {
      case 1:
        // 1 yüzü için modern casino standardında hafif belirgin merkez nokta
        drawDot(c, c, radius * 1.18);
        break;
      case 2:
        drawDot(p1, p1);
        drawDot(p2, p2);
        break;
      case 3:
        drawDot(p1, p1);
        drawDot(c, c);
        drawDot(p2, p2);
        break;
      case 4:
        drawDot(p1, p1);
        drawDot(p2, p1);
        drawDot(p1, p2);
        drawDot(p2, p2);
        break;
      case 5:
        drawDot(p1, p1);
        drawDot(p2, p1);
        drawDot(c, c);
        drawDot(p1, p2);
        drawDot(p2, p2);
        break;
      case 6:
        drawDot(p1, p1);
        drawDot(p2, p1);
        drawDot(p1, c);
        drawDot(p2, c);
        drawDot(p1, p2);
        drawDot(p2, p2);
        break;
      default:
        break;
    }

    const img = new Image();
    img.src = canvas.toDataURL('image/png');
    return img;
  }

  /**
   * d6 yüzeylerine rakam yerine klasik Monopoly siyah noktalarını (pips) enjekte eder
   */
  async _applyClassicMonopolyPips() {
    if (!this.box?.DiceFactory || typeof document === 'undefined') return;
    try {
      const d6 = this.box.DiceFactory.get('d6');
      if (!d6) return;

      const pipImages = [];
      for (let i = 1; i <= 6; i++) {
        const img = this._createPipImage(i);
        if (img) pipImages.push(img);
      }

      if (pipImages.length === 6) {
        await Promise.all(pipImages.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }));

        // DiceFactory içinde d6.labels 0 ve 1 indexlerinde boşluk barındırır, 2..7 yüzleri içerir
        d6.labels = ['', '', ...pipImages];

        if (this.box.DiceFactory.materials_cache) {
          this.box.DiceFactory.materials_cache = {};
        }
      }
    } catch (err) {
      console.warn('[Dice3DTrayManager] Failed to apply classic monopoly pips:', err);
    }
  }

  /**
   * Zarların tepsi dışına, butonların arkasına veya tavana fırlamasını engelleyen
   * 4 yönlü görünmez fiziksel sınır duvarlarını (Cannon-ES) kurar ve her setDimensions
   * yeniden boyutlandırmasında sınırları yeşil çuha içinde kilitler.
   */
  _setupInvisibleWalls() {
    if (!this.box) return;

    const enforceWalls = () => {
      if (!this.box?.box_body || !this.box?.display) return;
      const cw = this.box.display.containerWidth;
      const ch = this.box.display.containerHeight;
      if (!cw || !ch) return;

      // Üst duvar: Üst oyuncu rozeti ve sürenin hemen altında zarları tutar
      if (this.box.box_body.topWall) {
        this.box.box_body.topWall.position.set(0, ch * 0.78, 0);
      }
      // Alt duvar: Alt "ZAR AT" butonu ve skor rozetinin hemen üzerinde zarları tutar
      if (this.box.box_body.bottomWall) {
        this.box.box_body.bottomWall.position.set(0, -ch * 0.74, 0);
      }
      // Sol duvar: Ahşap çerçeve iç sınırı
      if (this.box.box_body.leftWall) {
        this.box.box_body.leftWall.position.set(cw * 0.84, 0, 0);
      }
      // Sağ duvar: Ahşap çerçeve iç sınırı
      if (this.box.box_body.rightWall) {
        this.box.box_body.rightWall.position.set(-cw * 0.84, 0, 0);
      }
    };

    if (typeof this.box.makeWorldBox === 'function') {
      const origMakeWorldBox = this.box.makeWorldBox.bind(this.box);
      this.box.makeWorldBox = () => {
        origMakeWorldBox();
        enforceWalls();
      };
    }

    enforceWalls();
  }

  /**
   * 3D Zar Tablasını ve DiceBox motorunu başlatır
   */
  async setupScene(container, onRollClick = null, initialDice = [1, 1]) {
    if (!container) return;
    this.container = container;
    this.onRollClickCallback = onRollClick;

    if (!container.id) {
      container.id = 'dice-tray-container';
    }

    try {
      this.box = new DiceBox(`#${container.id}`, {
        assetPath: '/assets/dice-box/',
        baseScale: 50, // Klasik boyutu yarı yarıya küçültüldü (varsayılan 100 idi)
        gravity_multiplier: 450,
        strength: 1.15,
        theme_surface: 'green-felt',
        theme_colorset: 'white',
        theme_material: 'plastic',
        shadows: false, // ⚡ 60 FPS: WebGL dinamik gölge haritalama geçişini kaldırarak GPU çizim yükünü düşürür
        sounds: false, // Monopoly oyun ses sistemi (soundEffects.js) devrededir
        light_intensity: 0.85
      });

      if (typeof this.box.init === 'function') {
        await this.box.init();
      } else if (typeof this.box.initialize === 'function') {
        await this.box.initialize();
      }

      // Klasik noktalı Monopoly zarı dokusunu uygula
      await this._applyClassicMonopolyPips();

      // Zarların tepsi sınırları dışına taşmasını engelleyen görünmez fiziksel sınır duvarlarını kur
      this._setupInvisibleWalls();

      this.isSceneReady = true;
    } catch (err) {
      console.warn('[Dice3DTrayManager] DiceBox initialization failed:', err);
    }

    // Tıklama dinleyicisi
    this.boundClickHandler = (e) => {
      if (!this.canRoll || this.isRolling) return;
      e.preventDefault();
      this.onRollClickCallback?.();
    };
    this.container.addEventListener('click', this.boundClickHandler);

    // Otomatik responsive yeniden boyutlandırma
    this.resizeObserver = new ResizeObserver(() => {
      if (this.box && this.container && this.container.clientWidth > 0 && this.container.clientHeight > 0) {
        try {
          this.box.setDimensions?.();
        } catch (e) {}
      }
    });
    this.resizeObserver.observe(this.container);
  }

  setCanRoll(canRoll) {
    this.canRoll = !!canRoll;
    if (this.container) {
      this.container.style.cursor = this.canRoll ? 'pointer' : 'default';
    }
  }

  setDiceFaces(d1 = 1, d2 = 1) {
    if (this.dice1 && typeof getTargetQuaternionForFace === 'function') {
      const top1 = typeof detectDiceTopFace === 'function' ? detectDiceTopFace(this.dice1) : null;
      if (top1 !== d1) {
        this.dice1.quaternion.copy(getTargetQuaternionForFace(this.dice1.quaternion, d1));
      }
    }
    if (this.dice2 && typeof getTargetQuaternionForFace === 'function') {
      const top2 = typeof detectDiceTopFace === 'function' ? detectDiceTopFace(this.dice2) : null;
      if (top2 !== d2) {
        this.dice2.quaternion.copy(getTargetQuaternionForFace(this.dice2.quaternion, d2));
      }
    }
  }

  _cleanupOldDice() {
    if (!this.box) return;
    try {
      if (this.box.DiceFactory?.materials_cache) {
        this.box.DiceFactory.materials_cache = {};
      }
      if (Array.isArray(this.box.diceList)) {
        for (const die of this.box.diceList) {
          if (!die) continue;
          die.traverse?.((child) => {
            if (child.isMesh) {
              child.geometry?.dispose?.();
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((m) => {
                    m.map?.dispose?.();
                    m?.dispose?.();
                  });
                } else {
                  child.material.map?.dispose?.();
                  child.material?.dispose?.();
                }
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('[Dice3DTrayManager] _cleanupOldDice error:', e);
    }
  }

  /**
   * Zarları ThreeJS + Cannon-ES fizik motoru ile fırlatır.
   * "Predetermined Roll" (2d6@d1,d2) özelliği sayesinde simülasyon öncesi yüz eşlemesi yapılır,
   * zarlar keçede ve kenarlıklarda serbest fizikle takla atar; kesinlikle havada veya duruşta
   * ani yüz atlaması (snap / teleport) veya titreme gerçekleşmez!
   */
  async rollDice(targetDice = [1, 1], toss = null) {
    if (this.isRolling) return;
    this.isRolling = true;

    const d1 = Math.max(1, Math.min(6, Number(targetDice[0]) || 1));
    const d2 = Math.max(1, Math.min(6, Number(targetDice[1]) || 1));

    sounds?.playDiceRoll?.();

    // Önceki atıştan kalan zar modellerinin GPU/VRAM kaynaklarını boşalt
    this._cleanupOldDice();

    if (this.box && this.isSceneReady) {
      try {
        await this.box.roll(`2d6@${d1},${d2}`);
      } catch (err) {
        console.warn('[Dice3DTrayManager] Box.roll error, settling fallback:', err);
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 1400));
    }

    this.isRolling = false;

    return {
      dice: [d1, d2],
      sum: d1 + d2,
      isDoubles: d1 === d2
    };
  }

  dispose() {
    this.animFrameId = null;
    this.activeRoll = null;
    this.world = null;
    this.scene = null;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.container && this.boundClickHandler) {
      this.container.removeEventListener('click', this.boundClickHandler);
      this.boundClickHandler = null;
    }
    this._cleanupOldDice();
    if (this.renderer) {
      if (this.renderer.domElement?.parentNode && this.boundClickHandler) {
        this.renderer.domElement.removeEventListener('click', this.boundClickHandler);
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose?.();
      this.renderer = null;
    }
    if (this.box) {
      try {
        this.box.clearDice?.();
        if (this.box.renderer) {
          this.box.renderer.dispose?.();
          this.box.renderer.forceContextLoss?.();
        }
      } catch (e) {}
      this.box = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    this.isRolling = false;
    this.isSceneReady = false;
  }
}

