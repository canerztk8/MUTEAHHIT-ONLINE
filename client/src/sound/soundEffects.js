// Web Audio API Sound Synthesizer with Master Volume Control
let audioCtx = null;
let masterGain = null;
const MASTER_VOLUME_SCALE = 0.85; // Oyunun tüm ses ve ses efektleri %15 kısıldı
let currentVolume = 0.6; // Varsayılan seviye (%15 kısılarak 0.7 -> 0.6 yapıldı)

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(currentVolume * MASTER_VOLUME_SCALE, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    try {
      audioCtx.resume().catch(() => {});
    } catch (_) {}
  }
  return audioCtx;
}

function getDestination(ctx) {
  return masterGain || ctx.destination;
}

// 🔋 Page Visibility API: Sekme gizlendiğinde AudioContext'i askıya alıp pil/CPU tasarrufu sağla
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (audioCtx && audioCtx.state === 'running') {
        try {
          audioCtx.suspend().catch(() => {});
        } catch (_) {}
      }
    } else {
      if (audioCtx && audioCtx.state === 'suspended') {
        try {
          audioCtx.resume().catch(() => {});
        } catch (_) {}
      }
    }
  });
}

// İsteğe bağlı harici özel zar sesi (client/public/sounds/dice.mp3 veya dice.wav)
let customDiceAudio = null;
if (typeof window !== 'undefined') {
  try {
    customDiceAudio = new Audio('/sounds/dice.mp3');
    customDiceAudio.preload = 'auto';
  } catch (e) {}
}

// İsteğe bağlı harici özel kodes kapısı sesi (client/public/sounds/jail.mp3)
let customJailAudio = null;
if (typeof window !== 'undefined') {
  try {
    customJailAudio = new Audio('/sounds/jail.mp3');
    customJailAudio.preload = 'auto';
  } catch (e) {}
}

let lastImpactSoundTime = 0;
let lastBankruptcyTime = 0;

// ─── AudioBuffer Havuzu (Buffer Pooling) ──────────────────────────────────
// Her zar çarpışmasında, kart çekiminde ve kodes kapısında yeni Float32Array
// ve AudioBuffer tahsis etmek yerine, değişmeyen gürültü tamponları bir defa
// üretilip tekrar kullanılır (Sıfır Garbage Collection baskısı).
let cachedDiceImpactBuffer = null;
let cachedDiceClickBuffer = null;
let cachedCardSlideBuffer = null;
let cachedJailSlideBuffer = null;

function getDiceImpactBuffer(ctx) {
  const sampleRate = ctx.sampleRate || 44100;
  if (!cachedDiceImpactBuffer || cachedDiceImpactBuffer.sampleRate !== sampleRate) {
    const duration = 0.030;
    const bufferSize = Math.floor(sampleRate * duration);
    const buf = ctx.createBuffer(1, bufferSize, sampleRate);
    const output = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    cachedDiceImpactBuffer = buf;
  }
  return cachedDiceImpactBuffer;
}

function getDiceClickBuffer(ctx) {
  const sampleRate = ctx.sampleRate || 44100;
  if (!cachedDiceClickBuffer || cachedDiceClickBuffer.sampleRate !== sampleRate) {
    const duration = 0.032;
    const bufferSize = Math.floor(sampleRate * duration);
    const buf = ctx.createBuffer(1, bufferSize, sampleRate);
    const output = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    cachedDiceClickBuffer = buf;
  }
  return cachedDiceClickBuffer;
}

function getCardSlideBuffer(ctx) {
  const sampleRate = ctx.sampleRate || 44100;
  if (!cachedCardSlideBuffer || cachedCardSlideBuffer.sampleRate !== sampleRate) {
    const duration = 0.28;
    const bufferSize = Math.max(256, Math.floor(sampleRate * duration));
    const buf = ctx.createBuffer(1, bufferSize, sampleRate);
    const output = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.9;
    }
    cachedCardSlideBuffer = buf;
  }
  return cachedCardSlideBuffer;
}

function getJailSlideBuffer(ctx) {
  const sampleRate = ctx.sampleRate || 44100;
  if (!cachedJailSlideBuffer || cachedJailSlideBuffer.sampleRate !== sampleRate) {
    const bufferSize = Math.floor(sampleRate * 0.18);
    const buf = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.08));
    }
    cachedJailSlideBuffer = buf;
  }
  return cachedJailSlideBuffer;
}

const rawSounds = {
  setVolume(val) {
    currentVolume = Math.max(0, Math.min(1, val));
    if (audioCtx && masterGain) {
      masterGain.gain.setValueAtTime(currentVolume * MASTER_VOLUME_SCALE, audioCtx.currentTime);
    }
  },

  getVolume() {
    return currentVolume;
  },

  // Zar Atma Başlangıç Sesi (Kupa sallama veya fırlatma sesi)
  playDiceRoll() {
    if (currentVolume === 0) return;
    try {
      if (!customDiceAudio && typeof window !== 'undefined') {
        customDiceAudio = new Audio('/sounds/dice.mp3');
        customDiceAudio.preload = 'auto';
      }
      if (customDiceAudio) {
        customDiceAudio.volume = Math.min(1.0, currentVolume * 0.6 * MASTER_VOLUME_SCALE);
        if (customDiceAudio.paused || customDiceAudio.ended) {
          customDiceAudio.currentTime = 0;
          const p = customDiceAudio.play();
          if (p !== undefined) {
            p.catch(() => {
              rawSounds.playProceduralDiceRoll();
            });
            return;
          }
        } else {
          rawSounds.playProceduralDiceRoll();
          return;
        }
      }
      rawSounds.playProceduralDiceRoll();
    } catch (e) {
      rawSounds.playProceduralDiceRoll();
    }
  },

  // ⚠️ Ağır Çekim Kira Şoku / Çöküş Bas Patlaması
  playDramaticHit() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const now = ctx.currentTime;

      // Derin şok bas tonu (Sub-bass drop)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.6);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + 0.6);

      gain.gain.setValueAtTime(0.45 * currentVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(getDestination(ctx));

      osc.start(now);
      osc.stop(now + 0.72);
    } catch (e) {}
  },

  // Tekil Fiziksel Zar Çarpışma / Sekme Sesi (Physical Collision Clack)
  // Cannon-es temas anında tetiklenir: Şiddete göre ses seviyesi ve zarlar arası çarpışmada yüksek tiz
  playDiceImpact(intensity = 0.8, pitchMod = 1.0) {
    if (currentVolume === 0) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      if (now - lastImpactSoundTime < 0.035) return;
      lastImpactSoundTime = now;
      const duration = 0.030;
      const noiseBuffer = getDiceImpactBuffer(ctx);

      // 1. Sert yüzey çarpma gürültüsü (akrilik darbe)
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime((3100 + Math.random() * 600) * pitchMod, now);
      filter.Q.setValueAtTime(4.5, now);

      const noiseGain = ctx.createGain();
      const clampedIntensity = Math.min(1.0, Math.max(0.08, intensity));
      noiseGain.gain.setValueAtTime(0.35 * clampedIntensity * currentVolume, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(getDestination(ctx));

      noiseSource.start(now);
      noiseSource.stop(now + duration);

      // 2. Zar masif gövde rezonansı
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      const baseFreq = (950 + Math.random() * 250) * pitchMod;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + 0.026);

      oscGain.gain.setValueAtTime(0.24 * clampedIntensity * currentVolume, now);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);

      osc.connect(oscGain);
      oscGain.connect(getDestination(ctx));

      osc.start(now);
      osc.stop(now + 0.028);
    } catch (e) {}
  },


  // Gerçekçi Akustik Zar Atma ve Masada Sekme Şıkırtısı (Acoustic Procedural Dice Clatter)
  playProceduralDiceRoll() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;

      const now = ctx.currentTime;

      // Akrilik / Reçine zar çarpışma tıkırtısı (Noise transient + Body resonance)
      const playSingleDiceClick = (time, intensity = 1.0, pitchMod = 1.0) => {
        const duration = 0.032;
        const noiseBuffer = getDiceClickBuffer(ctx);

        // 1. Sert yüzey çarpma gürültüsü (2600-3800 Hz Band-pass filtresi)
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime((3000 + Math.random() * 600) * pitchMod, time);
        filter.Q.setValueAtTime(4.2, time);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.32 * intensity, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(getDestination(ctx));

        noiseSource.start(time);
        noiseSource.stop(time + duration);

        // 2. Zarın masif gövde tıkırtısı (Hızlı sönen 850-1200 Hz rezonans)
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        const baseFreq = (950 + Math.random() * 250) * pitchMod;
        osc.frequency.setValueAtTime(baseFreq, time);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, time + 0.028);

        oscGain.gain.setValueAtTime(0.24 * intensity, time);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.028);

        osc.connect(oscGain);
        oscGain.connect(getDestination(ctx));

        osc.start(time);
        osc.stop(time + 0.03);
      };

      // Gerçek zar atma fiziği ritmi (İlk fırlatış kümesi -> masa sekmeleri -> son durulma tıkırtıları)
      const clackTimings = [
        { delay: 0.015, intensity: 0.92, pitch: 1.15 },
        { delay: 0.055, intensity: 0.82, pitch: 0.94 },
        { delay: 0.105, intensity: 1.0,  pitch: 1.06 },
        { delay: 0.175, intensity: 0.85, pitch: 1.12 },
        { delay: 0.265, intensity: 0.74, pitch: 0.89 },
        { delay: 0.375, intensity: 0.62, pitch: 1.02 },
        { delay: 0.495, intensity: 0.50, pitch: 0.96 },
        { delay: 0.640, intensity: 0.38, pitch: 1.08 },
        { delay: 0.810, intensity: 0.28, pitch: 0.93 },
        { delay: 0.950, intensity: 0.18, pitch: 1.01 }
      ];

      clackTimings.forEach((t) => {
        const jitter = (Math.random() - 0.5) * 0.012;
        playSingleDiceClick(now + t.delay + jitter, t.intensity, t.pitch);
      });
    } catch (e) {}
  },

  // Para Girişi Sesi (Coin chimes / Kasaya Para Geldi: +₺)
  playMoneyIn() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const now = ctx.currentTime;
      const frequencies = [987.77, 1318.51, 1975.53]; // B5, E6, B6
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0, now + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.18 * currentVolume, now + idx * 0.06 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.38);

        osc.connect(gain);
        gain.connect(getDestination(ctx));
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.4);
      });
    } catch (e) {}
  },

  // Para Çıkışı / Harcama Sesi (Expense / Kasadan Para Çıktı: -₺)
  playMoneyOut() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const now = ctx.currentTime;

      // 1. Düşen frekanslı ödeme tonu (480Hz -> 200Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(460, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.18);

      gain.gain.setValueAtTime(0.16 * currentVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(getDestination(ctx));
      osc.start(now);
      osc.stop(now + 0.19);

      // 2. Hafif mekanik pos/tahsilat kliği
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'sine';
      clickOsc.frequency.setValueAtTime(320, now + 0.08);
      clickOsc.frequency.exponentialRampToValueAtTime(140, now + 0.14);

      clickGain.gain.setValueAtTime(0.12 * currentVolume, now + 0.08);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      clickOsc.connect(clickGain);
      clickGain.connect(getDestination(ctx));
      clickOsc.start(now + 0.08);
      clickOsc.stop(now + 0.15);
    } catch (e) {}
  },

  // Para sesi (Cha-ching!) - Geriye dönük uyumluluk için
  playCash() {
    this.playMoneyIn();
  },

  // Mülk / Tapu Satın Alma Sesi (playPropertyAcquired ile eşdeğer)
  playBuy() {
    this.playPropertyAcquired();
  },

  // Yeni Mülk/Tapu Satın Alındığında Çalan Zafer Tınısı
  playPropertyAcquired() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const now = ctx.currentTime;
      const notes = [
        { f: 523.25, d: 0.08 }, // C5
        { f: 659.25, d: 0.08 }, // E5
        { f: 783.99, d: 0.10 }, // G5
        { f: 1046.50, d: 0.35 } // C6
      ];
      let t = now;
      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f, t);

        gain.gain.setValueAtTime(0.2 * currentVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);

        osc.connect(gain);
        gain.connect(getDestination(ctx));
        osc.start(t);
        osc.stop(t + n.d);
        t += n.d * 0.75;
      });
    } catch (e) {}
  },

  // Teklif Kabul Edildi Sesi (Trade Accepted)
  playTradeAccepted() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const now = ctx.currentTime;
      [659.25, 880, 1174.66].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.18 * currentVolume, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);
        osc.connect(gain);
        gain.connect(getDestination(ctx));
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.26);
      });
    } catch (e) {}
  },

  // Teklif Reddedildi Sesi (Trade Rejected)
  playTradeRejected() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const now = ctx.currentTime;
      [370, 293.66].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.14 * currentVolume, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.2);
        osc.connect(gain);
        gain.connect(getDestination(ctx));
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.22);
      });
    } catch (e) {}
  },

  // Tapu Kaybı / Kamulaştırma / İcra Alarm Sesi
  playPropertyLoss() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const now = ctx.currentTime;
      [440, 311.13, 220].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        gain.gain.setValueAtTime(0.22 * currentVolume, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.28);
        osc.connect(gain);
        gain.connect(getDestination(ctx));
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.3);
      });
    } catch (e) {}
  },

  // Adım sekme sesi (Kare kare piyon ilerlemesi)
  playStep() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(getDestination(ctx));
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {}
  },

  // Kart desteden sıyrılma ve kayma sesi (Gerçekçi kağıt/karton sürtünme hışırtısı)
  playCardSlide() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const now = ctx.currentTime;
      const duration = 0.28;

      // Desteden sıyrılan karton / kağıt sürtünme hışırtısı (Bandpass Noise)
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = getCardSlideBuffer(ctx);

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(900, now);
      bandpass.frequency.exponentialRampToValueAtTime(2600, now + duration * 0.7);
      bandpass.Q.setValueAtTime(2.2, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.001, now);
      noiseGain.gain.linearRampToValueAtTime(0.24 * currentVolume, now + 0.05);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSource.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(getDestination(ctx));

      noiseSource.start(now);
      noiseSource.stop(now + duration);

      // Hafif aerodinamik süzülme tonu (Whoosh sweep)
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.2);
      oscGain.gain.setValueAtTime(0.001, now);
      oscGain.gain.linearRampToValueAtTime(0.09 * currentVolume, now + 0.04);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(oscGain);
      oscGain.connect(getDestination(ctx));
      osc.start(now);
      osc.stop(now + 0.24);
    } catch (e) {}
  },

  // Kartın yerine oturma tıkı (Tactile Card Snap)
  playCardSnap() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const now = ctx.currentTime;

      // Tok, tatmin edici kart dokunma tıkı
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.06);

      gain.gain.setValueAtTime(0.25 * currentVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(getDestination(ctx));
      osc.start(now);
      osc.stop(now + 0.07);

      // Üst frekans çıtırtısı (Paper tap click)
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'sine';
      clickOsc.frequency.setValueAtTime(1800, now);
      clickOsc.frequency.exponentialRampToValueAtTime(350, now + 0.03);
      clickGain.gain.setValueAtTime(0.14 * currentVolume, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      clickOsc.connect(clickGain);
      clickGain.connect(getDestination(ctx));
      clickOsc.start(now);
      clickOsc.stop(now + 0.04);
    } catch (e) {}
  },

  // Kart çekme sesi (Slide + Snap senkron kombinasyonu)
  playCard() {
    this.playCardSlide();
    setTimeout(() => {
      this.playCardSnap();
    }, 180);
  },

  // Kodes demir kapı sesi (playJailDoor ile entegre)
  playJail() {
    this.playJailDoor();
  },

  // Galibiyet / Zafer Fanfarı (playVictory ile entegre)
  playWinner() {
    this.playVictory();
  },

  // Açık artırma tokmak sesi (Gavel double strike: Tok - Tok)
  playGavel() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const strikes = [0, 0.12];
      strikes.forEach(delay => {
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);

        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

        osc.connect(gain);
        gain.connect(getDestination(ctx));

        osc.start(t);
        osc.stop(t + 0.08);
      });
    } catch (e) {}
  },

  // Açık artırma son saniyeler kalp atışı efekti (Lub-dub suspense thud)
  playHeartbeat() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const beats = [
        { delay: 0, freq: 75, dur: 0.08, vol: 0.28 },
        { delay: 0.13, freq: 55, dur: 0.12, vol: 0.22 }
      ];
      beats.forEach(b => {
        const t = ctx.currentTime + b.delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(b.freq, t);
        osc.frequency.exponentialRampToValueAtTime(28, t + b.dur);

        gain.gain.setValueAtTime(b.vol * currentVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + b.dur);

        osc.connect(gain);
        gain.connect(getDestination(ctx));

        osc.start(t);
        osc.stop(t + b.dur + 0.01);
      });
    } catch (e) {}
  },

  // 🚨 Kodes Kapısı Sesi (İndirilenler'deki Sound Effects - Prison Door.mp3 veya prosedürel sentez)
  playJailDoor() {
    if (currentVolume === 0) return;
    try {
      if (!customJailAudio && typeof window !== 'undefined') {
        customJailAudio = new Audio('/sounds/jail.mp3');
        customJailAudio.preload = 'auto';
      }
      if (customJailAudio) {
        customJailAudio.volume = Math.min(1.0, currentVolume * 0.48 * MASTER_VOLUME_SCALE);
        customJailAudio.currentTime = 0;
        const p = customJailAudio.play();
        if (p !== undefined) {
          p.catch(() => {
            this.playSynthesizedJailDoor();
          });
          return;
        }
      }
    } catch (e) {}

    this.playSynthesizedJailDoor();
  },

  // Prosedürel Kodes Demir Kapı Sentezleyicisi (Ağır Demir Parmaklık Hücre Kapanışı & Metal Kilit Sesi)
  playSynthesizedJailDoor() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const now = ctx.currentTime;

      // 1. Demir parmaklıkların kayma/sürtünme gıcırtısı (Metal screech)
      const slideNoise = ctx.createBufferSource();
      slideNoise.buffer = getJailSlideBuffer(ctx);
      const slideFilter = ctx.createBiquadFilter();
      slideFilter.type = 'bandpass';
      slideFilter.frequency.setValueAtTime(2200, now);
      slideFilter.Q.setValueAtTime(4.5, now);
      const slideGain = ctx.createGain();
      slideGain.gain.setValueAtTime(0.16 * currentVolume, now);
      slideGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      slideNoise.connect(slideFilter);
      slideFilter.connect(slideGain);
      slideGain.connect(getDestination(ctx));
      slideNoise.start(now);
      slideNoise.stop(now + 0.19);

      // 2. Ağır hücre kapısının küt diye çarpması (Massive Low Sub-Bass Impact: 110Hz -> 24Hz)
      const slamTime = now + 0.10;
      const slamOsc = ctx.createOscillator();
      const slamGain = ctx.createGain();
      slamOsc.type = 'sawtooth';
      slamOsc.frequency.setValueAtTime(115, slamTime);
      slamOsc.frequency.exponentialRampToValueAtTime(22, slamTime + 0.45);
      slamGain.gain.setValueAtTime(0.32 * currentVolume, slamTime);
      slamGain.gain.exponentialRampToValueAtTime(0.001, slamTime + 0.45);
      slamOsc.connect(slamGain);
      slamGain.connect(getDestination(ctx));
      slamOsc.start(slamTime);
      slamOsc.stop(slamTime + 0.46);

      // 3. Ağır demir parmaklık çınlaması (Metallic Harmonic Ringing: 480Hz & 920Hz & 1420Hz)
      [480, 920, 1420].forEach((freq, idx) => {
        const ringOsc = ctx.createOscillator();
        const ringGain = ctx.createGain();
        ringOsc.type = 'triangle';
        ringOsc.frequency.setValueAtTime(freq, slamTime);
        ringOsc.frequency.exponentialRampToValueAtTime(freq * 0.88, slamTime + 0.55);
        ringGain.gain.setValueAtTime((0.14 / (idx + 1)) * currentVolume, slamTime);
        ringGain.gain.exponentialRampToValueAtTime(0.0001, slamTime + 0.55 + idx * 0.08);
        ringOsc.connect(ringGain);
        ringGain.connect(getDestination(ctx));
        ringOsc.start(slamTime);
        ringOsc.stop(slamTime + 0.65);
      });

      // 4. Sert demir kilit mandalı klik sesi (Heavy Iron Lock Bolt Click)
      const lockTime = slamTime + 0.28;
      const lockOsc = ctx.createOscillator();
      const lockGain = ctx.createGain();
      lockOsc.type = 'sine';
      lockOsc.frequency.setValueAtTime(680, lockTime);
      lockOsc.frequency.exponentialRampToValueAtTime(120, lockTime + 0.08);
      lockGain.gain.setValueAtTime(0.20 * currentVolume, lockTime);
      lockGain.gain.exponentialRampToValueAtTime(0.001, lockTime + 0.08);
      lockOsc.connect(lockGain);
      lockGain.connect(getDestination(ctx));
      lockOsc.start(lockTime);
      lockOsc.stop(lockTime + 0.09);
    } catch (e) {}
  },

  // 🔨 Ev / Otel İnşaatı Çekiç Sesi (3 Ritmik Çivi & Örs Vuruşu: Çink - Çink - Güm!)
  playBuild() {
    try {
      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const now = ctx.currentTime;

      // 3 Vuruş Ritim Zamanlaması
      const hits = [
        { delay: 0.0,  freq: 1680, impact: 220, dur: 0.08, vol: 0.32 },
        { delay: 0.12, freq: 1820, impact: 250, dur: 0.08, vol: 0.38 },
        { delay: 0.24, freq: 1350, impact: 110, dur: 0.25, vol: 0.55 } // Son sert vuruş
      ];

      hits.forEach(h => {
        const t = now + h.delay;

        // A. Metalik çivi çınlaması (High metallic ping)
        const pingOsc = ctx.createOscillator();
        const pingGain = ctx.createGain();
        pingOsc.type = 'triangle';
        pingOsc.frequency.setValueAtTime(h.freq, t);
        pingOsc.frequency.exponentialRampToValueAtTime(h.freq * 0.65, t + h.dur);
        pingGain.gain.setValueAtTime(h.vol * currentVolume, t);
        pingGain.gain.exponentialRampToValueAtTime(0.001, t + h.dur);
        pingOsc.connect(pingGain);
        pingGain.connect(getDestination(ctx));
        pingOsc.start(t);
        pingOsc.stop(t + h.dur + 0.01);

        // B. Ahşap gövde darbesi (Wood thud)
        const thudOsc = ctx.createOscillator();
        const thudGain = ctx.createGain();
        thudOsc.type = 'sine';
        thudOsc.frequency.setValueAtTime(h.impact, t);
        thudOsc.frequency.exponentialRampToValueAtTime(45, t + h.dur * 0.9);
        thudGain.gain.setValueAtTime(h.vol * 0.75 * currentVolume, t);
        thudGain.gain.exponentialRampToValueAtTime(0.001, t + h.dur * 0.9);
        thudOsc.connect(thudGain);
        thudGain.connect(getDestination(ctx));
        thudOsc.start(t);
        thudOsc.stop(t + h.dur);
      });

      // İnşaat bitiş hafif sevinç tınısı (Sparkle chime at finish)
      const finishTime = now + 0.36;
      [880, 1174.66, 1760].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, finishTime + idx * 0.05);
        gain.gain.setValueAtTime(0.15 * currentVolume, finishTime + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, finishTime + idx * 0.05 + 0.22);
        osc.connect(gain);
        gain.connect(getDestination(ctx));
        osc.start(finishTime + idx * 0.05);
        osc.stop(finishTime + idx * 0.05 + 0.24);
      });
    } catch (e) {}
  },

  // 💀 İflas Zili & Kayıp Sireni (Dramatik İflas Buzzerı ve Hüzünlü İniş Tonları)
  playBankruptcy() {
    try {
      const nowMs = Date.now();
      if (nowMs - lastBankruptcyTime < 3000) return;
      lastBankruptcyTime = nowMs;

      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const now = ctx.currentTime;

      // 1. Sert İflas Buzzerı (Dissonant harsh electric buzzer: 110Hz + 117Hz beating)
      [110, 117, 155].forEach(freq => {
        const buzzOsc = ctx.createOscillator();
        const buzzGain = ctx.createGain();
        buzzOsc.type = 'sawtooth';
        buzzOsc.frequency.setValueAtTime(freq, now);
        buzzGain.gain.setValueAtTime(0.28 * currentVolume, now);
        buzzGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        buzzOsc.connect(buzzGain);
        buzzGain.connect(getDestination(ctx));
        buzzOsc.start(now);
        buzzOsc.stop(now + 0.46);
      });

      // 2. Hüzünlü Trombon İnişi (Descending Sad Slide: Eb3 -> D3 -> Db3 -> C3)
      const sadNotes = [
        { f: 155.56, start: now + 0.45, dur: 0.22 }, // Eb3
        { f: 146.83, start: now + 0.67, dur: 0.22 }, // D3
        { f: 138.59, start: now + 0.89, dur: 0.25 }, // Db3
        { f: 130.81, start: now + 1.14, dur: 0.75, dropTo: 65 } // C3 dropping to low sub
      ];

      sadNotes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, n.start);
        if (n.dropTo) {
          osc.frequency.exponentialRampToValueAtTime(n.dropTo, n.start + n.dur);
        }
        gain.gain.setValueAtTime(0.32 * currentVolume, n.start);
        gain.gain.exponentialRampToValueAtTime(0.001, n.start + n.dur);
        osc.connect(gain);
        gain.connect(getDestination(ctx));
        osc.start(n.start);
        osc.stop(n.start + n.dur + 0.02);
      });
    } catch (e) {}
  },

  _lastVictoryTime: 0,

  // 🎺 Zafer Fanfarı (Görkemli Şampiyonluk ve Galibiyet Pirinci - Brass Fanfare)
  playVictory() {
    try {
      const nowMs = Date.now();
      if (nowMs - this._lastVictoryTime < 3500) {
        return; // Çift ses koruması: Son 3.5 saniye içinde zafer sesi çalındıysa tekrarlama!
      }
      this._lastVictoryTime = nowMs;

      const ctx = getAudioContext();
      if (!ctx || currentVolume === 0) return;
      const now = ctx.currentTime;

      // Pirinç / Bando Fanfar Melodisi: C4 -> E4 -> G4 -> C5 -> G4 -> C5 (Görkemli Akor)
      const fanfare = [
        { f: 261.63, delay: 0.0,  dur: 0.14 }, // C4
        { f: 329.63, delay: 0.14, dur: 0.14 }, // E4
        { f: 392.00, delay: 0.28, dur: 0.16 }, // G4
        { f: 523.25, delay: 0.44, dur: 0.24 }, // C5
        { f: 392.00, delay: 0.70, dur: 0.14 }, // G4
        { f: 523.25, delay: 0.86, dur: 0.90 }  // C5 (Görkemli son)
      ];

      fanfare.forEach(note => {
        const t = now + note.delay;

        // Brass Oscillator (Sawtooth + Lowpass filter envelope)
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note.f, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(note.f * 1.5, t);
        filter.frequency.exponentialRampToValueAtTime(note.f * 4.5, t + 0.05);
        filter.frequency.exponentialRampToValueAtTime(note.f * 2.0, t + note.dur);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.26 * currentVolume, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + note.dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(getDestination(ctx));

        osc.start(t);
        osc.stop(t + note.dur + 0.02);
      });

      // Son görkemli notaya eşlik eden zengin Do Majör akoru (E5 + G5 harmonileri)
      const chordTime = now + 0.86;
      [659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const chordOsc = ctx.createOscillator();
        const chordGain = ctx.createGain();
        chordOsc.type = 'triangle';
        chordOsc.frequency.setValueAtTime(freq, chordTime);
        chordGain.gain.setValueAtTime(0.20 * currentVolume, chordTime);
        chordGain.gain.exponentialRampToValueAtTime(0.001, chordTime + 0.95 + idx * 0.1);
        chordOsc.connect(chordGain);
        chordGain.connect(getDestination(ctx));
        chordOsc.start(chordTime);
        chordOsc.stop(chordTime + 1.1);
      });
    } catch (e) {}
  },

  // Eşdeğer takma adlar (Aliases)
  playJailSlam() { this.playJailDoor(); },
  playHammer() { this.playBuild(); },
  playBuzzer() { this.playBankruptcy(); },
  playFanfare() { this.playVictory(); },
  playWinner() { this.playVictory(); }
};

// Ses yöneticisi için Proxy koruması: Olmayan bir ses çağrılsa dahi oyun asla çökmez!
export const sounds = new Proxy(rawSounds, {
  get(target, prop) {
    if (prop in target) {
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    }
    return () => {};
  }
});
