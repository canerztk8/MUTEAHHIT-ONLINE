---
name: boardgame-audio-sfx
description: >-
  Zero-asset procedural sound engine and audio FX for web board games using the Web Audio API.
  Use when implementing or debugging board game sound effects: dice shaking & rolling, cash register & money counting,
  pawn step/hop clicks, jail iron cell slam, card flips, construction hammer sounds, bankruptcy buzzer, and victory fanfare.
---

# Board Game Web Audio API & Sound Synthesis Skill

A complete, self-contained procedural audio engine for web board games. Eliminates external MP3/WAV dependencies, prevents 404 missing audio errors, eliminates loading latency, and provides crisp, responsive sound effects.

---

## 1. AudioContext Initialization & User Interaction Unlock

Browsers block audio until the user interacts with the document. Implement an auto-resuming singleton:

```javascript
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.masterVolume = 0.4;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
  }

  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }
}

export const soundEngine = new SoundEngine();
```

---

## 2. Procedural Sound Generators

### 2.1 Dice Shake & Rolling Clatter
Simulates the rattling sound of two wooden or plastic dice tumbling onto a wooden board using decaying filtered noise:

```javascript
export function playDiceRollSound() {
  if (soundEngine.isMuted) return;
  soundEngine.init();
  const ctx = soundEngine.ctx;
  const now = ctx.currentTime;

  // Generate 4-6 rapid micro-clicks representing bounces
  const bounces = 5;
  for (let i = 0; i < bounces; i++) {
    const timeOffset = now + i * 0.08 + Math.random() * 0.03;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 + Math.random() * 80, timeOffset);
    osc.frequency.exponentialRampToValueAtTime(40, timeOffset + 0.04);

    gain.gain.setValueAtTime(soundEngine.masterVolume * 0.6, timeOffset);
    gain.gain.exponentialRampToValueAtTime(0.001, timeOffset + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(timeOffset);
    osc.stop(timeOffset + 0.05);
  }
}
```

### 2.2 Cash Register & Coin Chime
Crisp, celebratory dual-tone chime for receiving money or collecting $200 at GO:

```javascript
export function playCashSound() {
  if (soundEngine.isMuted) return;
  soundEngine.init();
  const ctx = soundEngine.ctx;
  const now = ctx.currentTime;

  const frequencies = [987.77, 1318.51, 1975.53]; // B5, E6, B6
  frequencies.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.07);

    gain.gain.setValueAtTime(0, now + idx * 0.07);
    gain.gain.linearRampToValueAtTime(soundEngine.masterVolume * 0.4, now + idx * 0.07 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.07);
    osc.stop(now + idx * 0.07 + 0.5);
  });
}
```

### 2.3 Pawn Hop / Step Sound
Short, tactile wooden thud for tile-by-tile pawn movement:

```javascript
export function playPawnHopSound() {
  if (soundEngine.isMuted) return;
  soundEngine.init();
  const ctx = soundEngine.ctx;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);

  gain.gain.setValueAtTime(soundEngine.masterVolume * 0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.07);
}
```

### 2.4 Jail Door Slam
Heavy, reverberating metallic thud when a player is sent to jail:

```javascript
export function playJailSlamSound() {
  if (soundEngine.isMuted) return;
  soundEngine.init();
  const ctx = soundEngine.ctx;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(90, now);
  osc.frequency.exponentialRampToValueAtTime(25, now + 0.4);

  gain.gain.setValueAtTime(soundEngine.masterVolume * 0.8, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.45);
}
```

### 2.5 House Building Hammer Sound
```javascript
export function playBuildSound() {
  if (soundEngine.isMuted) return;
  soundEngine.init();
  const ctx = soundEngine.ctx;
  const now = ctx.currentTime;

  [0, 0.1].forEach((delay) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now + delay);
    osc.frequency.exponentialRampToValueAtTime(120, now + delay + 0.05);

    gain.gain.setValueAtTime(soundEngine.masterVolume * 0.5, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + delay);
    osc.stop(now + delay + 0.06);
  });
}
```

### 2.6 Victory Fanfare & Bankruptcy Buzzer
* **Victory Fanfare:** Ascending major triad arpeggio with high sustain (C5 - E5 - G5 - C6).
* **Bankruptcy Buzzer:** Low dissonance tritone interval with rapid vibrato.
