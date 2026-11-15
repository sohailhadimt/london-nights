import * as THREE from 'three';
import { CAR_COLORS } from '../config.js';

export const CAR_TYPES = [
  { id: 'vortex', name: 'Vortex', kind: 'supercar', accel: 28, brake: 38, max: 42, steer: 2.6, desc: 'Mid-engine wedge' },
  { id: 'rosso', name: 'Rosso GT', kind: 'supercar', accel: 26, brake: 36, max: 40, steer: 2.5, desc: 'Long-bonnet GT' },
  { id: 'arrow', name: 'Arrow', kind: 'supercar', accel: 30, brake: 40, max: 44, steer: 2.7, desc: 'Teardrop hypercar' },
  { id: 'royale', name: 'Royale', kind: 'supercar', accel: 24, brake: 34, max: 41, steer: 2.2, desc: 'Grand tourer' },
  { id: 'apex', name: 'Apex', kind: 'supercar', accel: 32, brake: 42, max: 46, steer: 2.8, desc: 'Track hypercar' },
  { id: 'borough', name: 'Borough', kind: 'hatch', accel: 12, brake: 22, max: 22, steer: 2.4, desc: 'City hatchback' },
  { id: 'crown', name: 'Crown', kind: 'saloon', accel: 14, brake: 24, max: 26, steer: 2.3, desc: 'Everyday saloon' },
];

export const WHEEL_STYLES = [
  { id: 'standard', name: 'Standard', spokes: 5, dish: 0.02 },
  { id: 'sport', name: 'Sport', spokes: 7, dish: 0.04 },
  { id: 'deep', name: 'Deep dish', spokes: 6, dish: 0.08 },
];

export function createCar(typeId, options = {}) {
  const type = CAR_TYPES.find((t) => t.id === typeId) || CAR_TYPES[0];
  const color = options.color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  const wheelStyle = options.wheelStyle || 'standard';
  const root = new THREE.Group();
  root.userData = {
    type, color, wheelStyle, speed: 0, heading: options.heading || 0,
    steer: 0, throttle: 0, brake: 0, parked: !!options.parked,
    wheels: [], driveable: true, name: type.name,
  };
  buildBody(root, type, color, wheelStyle);
  root.rotation.y = root.userData.heading;
  if (options.x != null) root.position.set(options.x, 0, options.z || 0);
  return root;
}

export function recolorCar(root, color, wheelStyle) {
  root.userData.color = color;
  if (wheelStyle) root.userData.wheelStyle = wheelStyle;
  const type = root.userData.type;
  const x = root.position.x, z = root.position.z, y = root.rotation.y;
  const speed = root.userData.speed, heading = root.userData.heading, parked = root.userData.parked;
  while (root.children.length) root.remove(root.children[0]);
  buildBody(root, type, color, root.userData.wheelStyle);
  root.position.set(x, 0, z);
  root.rotation.y = y;
  Object.assign(root.userData, { speed, heading, parked, type, color, driveable: true, name: type.name });
}

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25, ...extra });
}

function buildBody(root, type, color, wheelStyle) {
  const paint = mat(color, { roughness: 0.28, metalness: 0.35 });
  const dark = mat(0x111111, { roughness: 0.4, metalness: 0.3 });
  const glass = mat(0x89a8bc, { roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55 });
  const chrome = mat(0xc9cdd1, { roughness: 0.2, metalness: 0.8 });
  const wheel = WHEEL_STYLES.find((w) => w.id === wheelStyle) || WHEEL_STYLES[0];

  const dims = {
    vortex: { l: 4.5, w: 2.0, h: 1.15, wheelR: 0.36, wheelB: 2.6 },
    rosso: { l: 4.6, w: 1.95, h: 1.2, wheelR: 0.35, wheelB: 2.65 },
    arrow: { l: 4.55, w: 2.05, h: 1.12, wheelR: 0.36, wheelB: 2.7 },
    royale: { l: 4.9, w: 2.0, h: 1.22, wheelR: 0.37, wheelB: 2.85 },
    apex: { l: 4.7, w: 2.15, h: 1.08, wheelR: 0.38, wheelB: 2.75 },
    borough: { l: 3.9, w: 1.75, h: 1.48, wheelR: 0.32, wheelB: 2.45 },
    crown: { l: 4.5, w: 1.8, h: 1.42, wheelR: 0.33, wheelB: 2.7 },
  }[type.id] || { l: 4.4, w: 1.9, h: 1.3, wheelR: 0.34, wheelB: 2.6 };

  root.userData.dims = dims;
  const id = type.id;

  // undertray
  const floor = mesh(new THREE.BoxGeometry(dims.w * 0.9, 0.12, dims.l * 0.9), dark);
  floor.position.y = 0.22;
  root.add(floor);

  if (id === 'vortex') {
    const body = mesh(new THREE.BoxGeometry(dims.w, 0.45, dims.l), paint);
    body.position.y = 0.48;
    root.add(body);
    const cabin = mesh(new THREE.BoxGeometry(dims.w * 0.85, 0.38, dims.l * 0.4), glass);
    cabin.position.set(0, 0.82, 0.15);
    root.add(cabin);
    const nose = mesh(new THREE.BoxGeometry(dims.w * 0.7, 0.2, 0.8), paint);
    nose.position.set(0, 0.42, -dims.l * 0.42);
    root.add(nose);
    const wing = mesh(new THREE.BoxGeometry(dims.w * 1.05, 0.06, 0.4), paint);
    wing.position.set(0, 0.85, dims.l * 0.42);
    root.add(wing);
  } else if (id === 'rosso') {
    const hood = mesh(new THREE.BoxGeometry(dims.w * 0.92, 0.28, dims.l * 0.42), paint);
    hood.position.set(0, 0.55, -dims.l * 0.22);
    root.add(hood);
    const cabin = mesh(new THREE.BoxGeometry(dims.w * 0.88, 0.5, dims.l * 0.38), paint);
    cabin.position.set(0, 0.72, 0.15);
    root.add(cabin);
    const wind = mesh(new THREE.BoxGeometry(dims.w * 0.8, 0.32, 0.5), glass);
    wind.position.set(0, 0.86, -0.1);
    wind.rotation.x = -0.5;
    root.add(wind);
    const boot = mesh(new THREE.BoxGeometry(dims.w * 0.9, 0.3, 0.7), paint);
    boot.position.set(0, 0.55, dims.l * 0.35);
    root.add(boot);
  } else if (id === 'arrow') {
    const body = mesh(new THREE.BoxGeometry(dims.w * 0.95, 0.4, dims.l), paint);
    body.position.y = 0.48;
    root.add(body);
    const cabin = mesh(new THREE.SphereGeometry(0.7, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    cabin.position.set(0, 0.62, 0.05);
    cabin.scale.set(dims.w * 0.65, 0.7, dims.l * 0.28);
    root.add(cabin);
    const wing = mesh(new THREE.BoxGeometry(dims.w * 1.1, 0.05, 0.35), dark);
    wing.position.set(0, 0.95, dims.l * 0.4);
    root.add(wing);
  } else if (id === 'royale') {
    const body = mesh(new THREE.BoxGeometry(dims.w, 0.42, dims.l), paint);
    body.position.y = 0.5;
    root.add(body);
    const cabin = mesh(new THREE.BoxGeometry(dims.w * 0.86, 0.42, dims.l * 0.42), paint);
    cabin.position.set(0, 0.82, 0.1);
    root.add(cabin);
    const wind = mesh(new THREE.BoxGeometry(dims.w * 0.8, 0.3, 0.55), glass);
    wind.position.set(0, 0.9, -0.2);
    wind.rotation.x = -0.45;
    root.add(wind);
    const grill = mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 16, Math.PI), chrome);
    grill.position.set(0, 0.45, -dims.l * 0.5 + 0.05);
    grill.rotation.x = Math.PI / 2;
    root.add(grill);
  } else if (id === 'apex') {
    const body = mesh(new THREE.BoxGeometry(dims.w, 0.32, dims.l), paint);
    body.position.y = 0.42;
    root.add(body);
    const cabin = mesh(new THREE.BoxGeometry(dims.w * 0.7, 0.4, 1.2), glass);
    cabin.position.set(0, 0.7, 0.1);
    root.add(cabin);
    const wing = mesh(new THREE.BoxGeometry(dims.w * 1.25, 0.08, 0.5), dark);
    wing.position.set(0, 1.05, dims.l * 0.42);
    root.add(wing);
    const posts = mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), dark);
    const p1 = posts.clone(); p1.position.set(-0.6, 0.85, dims.l * 0.38);
    const p2 = posts.clone(); p2.position.set(0.6, 0.85, dims.l * 0.38);
    root.add(p1, p2);
  } else if (id === 'borough') {
    const body = mesh(new THREE.BoxGeometry(dims.w, 0.7, dims.l), paint);
    body.position.y = 0.65;
    root.add(body);
    const cabin = mesh(new THREE.BoxGeometry(dims.w * 0.92, 0.5, dims.l * 0.55), glass);
    cabin.position.set(0, 1.15, 0.05);
    root.add(cabin);
  } else {
    const body = mesh(new THREE.BoxGeometry(dims.w, 0.55, dims.l), paint);
    body.position.y = 0.58;
    root.add(body);
    const cabin = mesh(new THREE.BoxGeometry(dims.w * 0.9, 0.48, dims.l * 0.5), glass);
    cabin.position.set(0, 1.05, 0.05);
    root.add(cabin);
    const boot = mesh(new THREE.BoxGeometry(dims.w * 0.9, 0.3, 0.7), paint);
    boot.position.set(0, 0.7, dims.l * 0.35);
    root.add(boot);
  }

  // lights
  const lightF = mat(0xfff2c8, { emissive: 0xfff2c8, emissiveIntensity: 0.6 });
  const lightR = mat(0xaa1111, { emissive: 0x880000, emissiveIntensity: 0.4 });
  for (const s of [-1, 1]) {
    const fl = mesh(new THREE.BoxGeometry(0.22, 0.1, 0.08), lightF);
    fl.position.set(s * dims.w * 0.35, 0.42, -dims.l * 0.5 + 0.02);
    root.add(fl);
    const rl = mesh(new THREE.BoxGeometry(0.28, 0.1, 0.08), lightR);
    rl.position.set(s * dims.w * 0.35, 0.45, dims.l * 0.5 - 0.02);
    root.add(rl);
  }

  // wheels
  const wheels = [];
  const wb = dims.wheelB / 2;
  for (const side of [-1, 1]) {
    for (const fb of [-1, 1]) {
      const w = makeWheel(dims.wheelR, wheel);
      w.position.set(side * (dims.w * 0.5 - 0.05), dims.wheelR, fb * wb);
      w.rotation.y = side > 0 ? 0 : Math.PI;
      root.add(w);
      wheels.push({ mesh: w, front: fb < 0, side });
    }
  }
  root.userData.wheels = wheels;
  root.userData.halfLen = dims.l / 2;
  root.userData.halfW = dims.w / 2;
  root.userData.radius = Math.max(dims.l, dims.w) * 0.45;
}

function makeWheel(r, style) {
  const g = new THREE.Group();
  const tyre = mesh(new THREE.CylinderGeometry(r, r, 0.22 + style.dish, 12), mat(0x111111, { roughness: 0.9 }));
  tyre.rotation.z = Math.PI / 2;
  g.add(tyre);
  const rim = mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.16, 12), mat(0xc0c4c8, { metalness: 0.7, roughness: 0.25 }));
  rim.rotation.z = Math.PI / 2;
  g.add(rim);
  for (let i = 0; i < style.spokes; i++) {
    const sp = mesh(new THREE.BoxGeometry(0.04, r * 1.0, 0.04), mat(0xdddddd, { metalness: 0.6 }));
    sp.rotation.z = (i / style.spokes) * Math.PI;
    g.add(sp);
  }
  return g;
}

function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createBus() {
  const root = new THREE.Group();
  const red = mat(0xb0101a, { roughness: 0.45, metalness: 0.15 });
  const cream = mat(0xe8dcc8, { roughness: 0.6 });
  const dark = mat(0x1a1a1a);
  const glass = mat(0x87a0b0, { transparent: true, opacity: 0.5, roughness: 0.1 });
  const gold = mat(0xd0b070, { metalness: 0.5, roughness: 0.3 });

  const lower = mesh(new THREE.BoxGeometry(2.5, 1.35, 9.2), red);
  lower.position.y = 1.0;
  root.add(lower);
  const upper = mesh(new THREE.BoxGeometry(2.5, 1.25, 8.6), red);
  upper.position.set(0, 2.28, 0.15);
  root.add(upper);
  const band = mesh(new THREE.BoxGeometry(2.56, 0.16, 9.25), cream);
  band.position.y = 1.68;
  root.add(band);
  // windows
  for (const deck of [0, 1]) {
    for (let i = 0; i < 6; i++) {
      const w = mesh(new THREE.BoxGeometry(0.08, 0.55, 0.9), glass);
      w.position.set(1.26, 0.95 + deck * 1.25, -3.2 + i * 1.25);
      root.add(w);
      const w2 = w.clone();
      w2.position.x = -1.26;
      root.add(w2);
    }
  }
  const frontGlass = mesh(new THREE.BoxGeometry(2.1, 0.7, 0.08), glass);
  frontGlass.position.set(0, 1.15, -4.62);
  root.add(frontGlass);
  const frontGlass2 = frontGlass.clone();
  frontGlass2.position.set(0, 2.35, -4.15);
  root.add(frontGlass2);
  const bumper = mesh(new THREE.BoxGeometry(2.5, 0.28, 0.3), dark);
  bumper.position.set(0, 0.4, -4.55);
  root.add(bumper);
  const light = mat(0xfff0c0, { emissive: 0xffe8a0, emissiveIntensity: 0.5 });
  for (const s of [-1, 1]) {
    const l = mesh(new THREE.BoxGeometry(0.3, 0.16, 0.08), light);
    l.position.set(s * 0.9, 0.7, -4.65);
    root.add(l);
  }
  // stair hint / rear
  const rear = mesh(new THREE.BoxGeometry(2.4, 2.3, 0.2), red);
  rear.position.set(0, 1.6, 4.55);
  root.add(rear);
  // roof ad board
  const board = mesh(new THREE.BoxGeometry(2.2, 0.35, 4), cream);
  board.position.set(0, 3.05, 0.2);
  root.add(board);
  // wheels
  const wheels = [];
  for (const side of [-1, 1]) {
    for (const z of [-2.8, -1.5, 2.6]) {
      const w = makeWheel(0.48, WHEEL_STYLES[0]);
      w.position.set(side * 1.15, 0.48, z);
      root.add(w);
      wheels.push({ mesh: w, front: z < 0, side });
    }
  }
  // destination blind
  const blind = mesh(new THREE.BoxGeometry(1.8, 0.22, 0.08), dark);
  blind.position.set(0, 1.65, -4.64);
  root.add(blind);

  root.userData = {
    type: { id: 'bus', name: 'East London Bus', accel: 6, brake: 14, max: 12, steer: 1.4 },
    wheels, speed: 0, heading: 0, pathI: 0, dir: 1, radius: 4.2,
    halfLen: 4.6, halfW: 1.25, driveable: true, isBus: true, color: '#b0101a',
  };
  return root;
}

export function updateWheels(root, dt) {
  const u = root.userData;
  if (!u.wheels) return;
  const r = u.dims?.wheelR || (u.isBus ? 0.48 : 0.34);
  const spin = (u.speed / (r || 0.34)) * dt;
  const steerAng = u.steer || 0;
  for (const w of u.wheels) {
    const tyre = w.mesh.children[0];
    if (tyre) tyre.rotation.x -= spin;
    if (w.front) w.mesh.rotation.y = (w.side > 0 ? 0 : Math.PI) + (w.side > 0 ? -steerAng : steerAng) * 0.35;
  }
}

/**
 * Arcade driving. heading is rotation around Y, +speed goes toward -Z of the car (model forward).
 * Our models face -Z (nose is negative z).
 */
export function driveCar(root, input, dt, collideFn) {
  const u = root.userData;
  const t = u.type;
  const throttle = input.throttle || 0;
  const brake = input.brake || 0;
  const steerIn = input.steer || 0;

  const reversing = u.speed < -0.4;
  const speedAbs = Math.abs(u.speed);
  // speed-sensitive steering
  const steerLimit = t.steer / (1 + speedAbs * 0.08);
  u.steer = THREE.MathUtils.damp(u.steer || 0, steerIn * steerLimit, 8, dt);

  if (throttle > 0) u.speed += throttle * t.accel * dt;
  else if (throttle < 0) u.speed += throttle * t.brake * 0.7 * dt;
  if (brake > 0) {
    if (speedAbs < 1) u.speed = 0;
    else u.speed -= Math.sign(u.speed) * t.brake * brake * dt;
  }
  // drag
  u.speed *= (1 - 0.55 * dt);
  const max = t.max;
  if (u.speed > max) u.speed = max;
  if (u.speed < -max * 0.4) u.speed = -max * 0.4;

  const turn = u.steer * (reversing ? -1 : 1) * (speedAbs / (6 + speedAbs));
  u.heading += turn * dt * 1.15;

  const step = u.speed * dt;
  const prevX = root.position.x, prevZ = root.position.z;
  // models face -Z, so heading 0 drives toward -Z
  root.position.x += -Math.sin(u.heading) * step;
  root.position.z += -Math.cos(u.heading) * step;
  root.rotation.y = u.heading;

  if (collideFn) {
    const hit = collideFn(root);
    if (hit) {
      root.position.x = prevX;
      root.position.z = prevZ;
      u.speed *= -0.25;
    }
  }
  updateWheels(root, dt);
  // body roll
  root.rotation.z = THREE.MathUtils.damp(root.rotation.z, -u.steer * 0.06 * Math.min(1, speedAbs / 12), 6, dt);
  return u.speed;
}

export function followPath(root, path, dt, speed = 9) {
  if (!path || path.length < 2) return;
  const u = root.userData;
  if (u.pathI == null) u.pathI = 0;
  if (u.dir == null) u.dir = 1;
  let i = u.pathI;
  let target = path[i];
  let looks = 0;
  while (looks++ < 4 && target && Math.hypot(root.position.x - target[0], root.position.z - target[1]) < 5) {
    i += u.dir;
    if (i >= path.length) { u.dir = -1; i = path.length - 2; }
    if (i < 0) { u.dir = 1; i = 1; }
    target = path[i];
    u.pathI = i;
  }
  if (!target) return;
  const ang = Math.atan2(target[0] - root.position.x, target[1] - root.position.z) + Math.PI;
  let d = ((ang - (u.heading || 0) + Math.PI) % (Math.PI * 2));
  if (d < 0) d += Math.PI * 2;
  d -= Math.PI;
  u.heading = (u.heading || 0) + d * (1 - Math.exp(-4 * dt));
  u.speed = speed;
  root.position.x += -Math.sin(u.heading) * speed * dt;
  root.position.z += -Math.cos(u.heading) * speed * dt;
  root.rotation.y = u.heading;
  u.steer = d * 2;
  updateWheels(root, dt);
}
