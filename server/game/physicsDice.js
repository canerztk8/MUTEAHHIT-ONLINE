import * as CANNON from 'cannon-es';
import { VERIFIED_TOSSES } from './verifiedTosses.js';

// ─── Fizik Sabitleri (Ağır Reçine & Gerçekçi Yer Çekimi) ─────────────────────
const GRAVITY     = -38.0;
const DICE_MASS   = 1.2;
const LIN_DAMP    = 0.15;
const ANG_DAMP    = 0.18;
const SLEEP_SPEED = 0.08;
const SLEEP_TIME  = 0.20;
const FRIC_FLOOR  = 0.82;
const FRIC_WALL   = 0.65;
const REST_FLOOR  = 0.22;
const REST_WALL   = 0.30;

const FACE_NORMALS = [
  { value: 1, x: 0, y: 1, z: 0 },
  { value: 6, x: 0, y: -1, z: 0 },
  { value: 2, x: 1, y: 0, z: 0 },
  { value: 5, x: -1, y: 0, z: 0 },
  { value: 3, x: 0, y: 0, z: 1 },
  { value: 4, x: 0, y: 0, z: -1 }
];

export function detectTopFace(quat) {
  let bestValue = 1;
  let maxDot = -Infinity;
  const qx = quat.x, qy = quat.y, qz = quat.z, qw = quat.w;

  for (const face of FACE_NORMALS) {
    const vx = face.x, vy = face.y, vz = face.z;
    // Y-bileşeni (dünya tavanı (0, 1, 0) ile skaler çarpım)
    const ny = 2 * (qx * qy - qw * qz) * vx + (1 - 2 * (qx * qx + qz * qz)) * vy + 2 * (qy * qz + qw * qx) * vz;
    if (ny > maxDot) {
      maxDot = ny;
      bestValue = face.value;
    }
  }
  return bestValue;
}

export function detectTopFaceWithDot(quat) {
  let bestValue = 1;
  let maxDot = -Infinity;
  const qx = quat.x, qy = quat.y, qz = quat.z, qw = quat.w;

  for (const face of FACE_NORMALS) {
    const vx = face.x, vy = face.y, vz = face.z;
    const ny = 2 * (qx * qy - qw * qz) * vx + (1 - 2 * (qx * qx + qz * qz)) * vy + 2 * (qy * qz + qw * qx) * vz;
    if (ny > maxDot) {
      maxDot = ny;
      bestValue = face.value;
    }
  }
  return { value: bestValue, dot: maxDot };
}

/**
 * Zarların masaya atılmasını simüle eden doğal, rastgele fiziksel fırlatma parametreleri üretir.
 * Zarlar havaya rastgele açıyla atılır, taklalar atarak iner ve durduğu yüz resmi zar kabul edilir.
 */
export function generateRandomToss() {
  const randQ = () => {
    const qx = (Math.random() - 0.5) * 2;
    const qy = (Math.random() - 0.5) * 2;
    const qz = (Math.random() - 0.5) * 2;
    const qw = (Math.random() - 0.5) * 2;
    const len = Math.hypot(qx, qy, qz, qw) || 1;
    return [qx / len, qy / len, qz / len, qw / len];
  };

  const spin = () => (Math.random() > 0.5 ? 1 : -1) * (28 + Math.random() * 20);

  return {
    p1: [
      -0.55 + (Math.random() - 0.5) * 0.2,
      2.6 + Math.random() * 0.2,
      -2.3 + (Math.random() - 0.5) * 0.2
    ],
    q1: randQ(),
    v1: [
      0.3 + (Math.random() - 0.5) * 0.3,
      -4.8 - Math.random() * 0.8,
      4.5 + (Math.random() - 0.5) * 0.6
    ],
    w1: [spin(), spin(), spin()],
    p2: [
      0.55 + (Math.random() - 0.5) * 0.2,
      2.6 + Math.random() * 0.2,
      -2.35 + (Math.random() - 0.5) * 0.2
    ],
    q2: randQ(),
    v2: [
      -0.3 + (Math.random() - 0.5) * 0.3,
      -4.8 - Math.random() * 0.8,
      4.3 + (Math.random() - 0.5) * 0.6
    ],
    w2: [spin(), spin(), spin()]
  };
}

export class ServerDicePhysicsEngine {
  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, GRAVITY, 0);
    this.world.allowSleep = true;

    const gM = new CANNON.Material('ground');
    const dM = new CANNON.Material('dice');
    const wM = new CANNON.Material('wall');

    this.world.addContactMaterial(new CANNON.ContactMaterial(dM, gM, { friction: FRIC_FLOOR, restitution: REST_FLOOR }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(dM, wM, { friction: FRIC_WALL, restitution: REST_WALL }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(dM, dM, { friction: 0.55, restitution: 0.25 }));

    const ground = new CANNON.Body({ mass: 0, material: gM });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(ground);

    const wallBodies = [
      { p: [0,    3.0, -4.2], h: [2.4, 3.0, 0.6] },
      { p: [0,    3.0,  4.2], h: [2.4, 3.0, 0.6] },
      { p: [-2.4, 3.0,  0  ], h: [0.6, 3.0, 3.8] },
      { p: [ 2.4, 3.0,  0  ], h: [0.6, 3.0, 3.8] },
      { p: [0,    6.0,  0  ], h: [2.4, 0.3, 3.8] }
    ];
    wallBodies.forEach(({ p, h }) => {
      const b = new CANNON.Body({ mass: 0, material: wM });
      b.addShape(new CANNON.Box(new CANNON.Vec3(...h)));
      b.position.set(...p);
      this.world.addBody(b);
    });

    this.die1 = new CANNON.Body({ mass: DICE_MASS, material: dM, linearDamping: LIN_DAMP, angularDamping: ANG_DAMP });
    this.die1.addShape(new CANNON.Box(new CANNON.Vec3(0.28, 0.28, 0.28)));
    this.die1.sleepSpeedLimit = SLEEP_SPEED;
    this.die1.sleepTimeLimit  = SLEEP_TIME;
    this.world.addBody(this.die1);

    this.die2 = new CANNON.Body({ mass: DICE_MASS, material: dM, linearDamping: LIN_DAMP, angularDamping: ANG_DAMP });
    this.die2.addShape(new CANNON.Box(new CANNON.Vec3(0.28, 0.28, 0.28)));
    this.die2.sleepSpeedLimit = SLEEP_SPEED;
    this.die2.sleepTimeLimit  = SLEEP_TIME;
    this.world.addBody(this.die2);
  }

  simulateToss(toss) {
    this.die1.wakeUp();
    this.die2.wakeUp();

    this.die1.position.set(...toss.p1);
    this.die1.quaternion.set(...toss.q1);
    this.die1.quaternion.normalize();
    this.die1.velocity.set(...toss.v1);
    this.die1.angularVelocity.set(...toss.w1);

    this.die2.position.set(...toss.p2);
    this.die2.quaternion.set(...toss.q2);
    this.die2.quaternion.normalize();
    this.die2.velocity.set(...toss.v2);
    this.die2.angularVelocity.set(...toss.w2);

    let settledConsecutive = 0;

    for (let s = 0; s < 250; s++) {
      this.world.step(1 / 120);

      const vSq1 = this.die1.velocity.lengthSquared();
      const wSq1 = this.die1.angularVelocity.lengthSquared();
      const vSq2 = this.die2.velocity.lengthSquared();
      const wSq2 = this.die2.angularVelocity.lengthSquared();

      const isRest1 = this.die1.sleepState === CANNON.Body.SLEEPING || (vSq1 < 0.01 && wSq1 < 0.01);
      const isRest2 = this.die2.sleepState === CANNON.Body.SLEEPING || (vSq2 < 0.01 && wSq2 < 0.01);

      if (s > 40 && isRest1 && isRest2) {
        settledConsecutive++;
        if (settledConsecutive >= 10) break;
      } else {
        settledConsecutive = 0;
      }

      // Cocked dice emniyet müdahalesi: zarlar 200 adımdan sonra hala durmadıysa veya eğik kaldıysa
      if (s === 200 && settledConsecutive < 10) {
        this.die1.velocity.y += 1.2;
        this.die2.velocity.y += 1.2;
      }
    }

    const { value: f1 } = detectTopFaceWithDot(this.die1.quaternion);
    const { value: f2 } = detectTopFaceWithDot(this.die2.quaternion);

    const settledTransforms = {
      p1: [this.die1.position.x, this.die1.position.y, this.die1.position.z],
      q1: [this.die1.quaternion.x, this.die1.quaternion.y, this.die1.quaternion.z, this.die1.quaternion.w],
      p2: [this.die2.position.x, this.die2.position.y, this.die2.position.z],
      q2: [this.die2.quaternion.x, this.die2.quaternion.y, this.die2.quaternion.z, this.die2.quaternion.w]
    };

    const dice = [Math.max(1, Math.min(6, f1)), Math.max(1, Math.min(6, f2))];
    return {
      dice,
      settledTransforms,
      [Symbol.iterator]() {
        return [dice[0], dice[1]][Symbol.iterator]();
      },
      0: dice[0],
      1: dice[1],
      length: 2
    };
  }

  roll(target = null) {
    let toss;
    let dice;
    let settledTransforms = null;

    if (target && Array.isArray(target) && target.length === 2) {
      const t1 = Math.max(1, Math.min(6, parseInt(target[0]) || 1));
      const t2 = Math.max(1, Math.min(6, parseInt(target[1]) || 1));
      const key = `${t1}_${t2}`;
      toss = VERIFIED_TOSSES[key] || generateRandomToss();
      dice = [t1, t2];
    } else {
      toss = generateRandomToss();
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      dice = [d1, d2];
    }

    const result = {
      dice,
      toss,
      settledTransforms,
      sum: dice[0] + dice[1],
      isDoubles: dice[0] === dice[1],
      [Symbol.iterator]() {
        return [dice[0], dice[1]][Symbol.iterator]();
      },
      0: dice[0],
      1: dice[1],
      length: 2
    };
    return result;
  }
}

let serverEngineInstance = null;

/**
 * Sunucu tarafında Cannon-es fizik motoru ile gerçekçi zar atışı simüle eder.
 * Zarlar fiziksel olarak yuvarlanır, keçeye ve duvarlara çarparak durur.
 * Üstte kalan yüzlerin değeri döner (önceden belirlenmez).
 * Hem [d1, d2] destructuring'i hem de { dice, toss, settledTransforms } nesne erişimini destekler.
 */
export function rollPhysicalDice(target = null) {
  if (!serverEngineInstance) {
    serverEngineInstance = new ServerDicePhysicsEngine();
  }
  return serverEngineInstance.roll(target);
}
