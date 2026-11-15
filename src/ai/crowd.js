import * as THREE from 'three';
import { createCharacter, animateCharacter } from '../player/character.js';
import { createCar, followPath, driveCar, CAR_TYPES, updateWheels } from '../vehicles/vehicles.js';
import { CAR_COLORS, PERFORMANCE, isMobile, SKIN_TONES, HAIR_COLORS } from '../config.js';
import { hash, dist2 } from '../utils.js';
import { insideAny, resolveCircle } from '../world/collision.js';
import { groundHeight } from '../world/city.js';

const TOP_COLORS = ['#1b3a5f', '#5a1a1a', '#2d4a2d', '#c4c0b8', '#222', '#6a3a1a', '#3a3a5a', '#8a2a4a'];
const BOT_COLORS = ['#1c1c1c', '#2c3a55', '#4a3b2a', '#333', '#5a5a5a'];

function randomLook(i) {
  const female = hash(i + 3) > 0.5;
  return {
    gender: female ? 'female' : 'male',
    skin: Math.floor(hash(i + 7) * SKIN_TONES.length),
    hair: Math.floor(hash(i + 9) * HAIR_COLORS.length),
    hairStyle: ['short', 'crop', 'long', 'bun', 'ponytail', 'slick'][Math.floor(hash(i + 11) * 6)],
    top: ['tee', 'jacket', 'hoodie', 'coat', 'shirt'][Math.floor(hash(i + 13) * 5)],
    bottom: female && hash(i + 15) > 0.7 ? 'skirt' : 'trousers',
    topColor: TOP_COLORS[Math.floor(hash(i + 17) * TOP_COLORS.length)],
    bottomColor: BOT_COLORS[Math.floor(hash(i + 19) * BOT_COLORS.length)],
    shoeColor: '#111',
  };
}

export function createPedestrians(scene, world, count) {
  const list = [];
  const pts = world.sidewalks;
  if (!pts.length) return list;
  let attempts = 0;
  for (let i = 0; list.length < count && attempts < count * 8; attempts++) {
    const p = pts[Math.floor(hash(i * 17 + attempts) * pts.length)];
    if (insideAny(world.hash, p[0], p[1], 'building')) continue;
    const ch = createCharacter(randomLook(i + attempts), 'low');
    ch.position.set(p[0], 0, p[1]);
    ch.userData.ai = {
      speed: 1.2 + hash(i + 21) * 1.1,
      target: pickNear(pts, p, 40 + hash(i) * 60),
      wait: 0,
    };
    scene.add(ch);
    list.push(ch);
    i++;
  }
  return list;
}

function pickNear(pts, from, radius) {
  // pick a random sidewalk point somewhat far
  for (let k = 0; k < 8; k++) {
    const p = pts[Math.floor(Math.random() * pts.length)];
    const d = Math.hypot(p[0] - from[0], p[1] - from[1]);
    if (d > 12 && d < radius) return p;
  }
  return pts[Math.floor(Math.random() * pts.length)];
}

export function updatePedestrians(list, world, player, dt) {
  const pts = world.sidewalks;
  if (!pts.length) return;
  const px = player.x, pz = player.z;
  for (const ch of list) {
    // cheap far skip
    const dx = ch.position.x - px, dz = ch.position.z - pz;
    if (dx * dx + dz * dz > 220 * 220) continue;
    const ai = ch.userData.ai;
    if (ai.wait > 0) { ai.wait -= dt; animateCharacter(ch, dt, false, 0); continue; }
    let tx = ai.target[0] - ch.position.x, tz = ai.target[1] - ch.position.z;
    let dist = Math.hypot(tx, tz);
    if (dist < 1.2) {
      ai.target = pickNear(pts, [ch.position.x, ch.position.z], 80);
      if (Math.random() < 0.15) ai.wait = 1 + Math.random() * 3;
      continue;
    }
    tx /= dist; tz /= dist;
    // avoid player
    const pdx = ch.position.x - px, pdz = ch.position.z - pz;
    const pd = Math.hypot(pdx, pdz);
    if (pd < 2.4 && pd > 0.01) {
      tx += (pdx / pd) * 1.2;
      tz += (pdz / pd) * 1.2;
      const n = Math.hypot(tx, tz) || 1;
      tx /= n; tz /= n;
    }
    const step = ai.speed * dt;
    const pos = { x: ch.position.x + tx * step, z: ch.position.z + tz * step };
    resolveCircle(world.hash, pos, 0.3);
    ch.position.x = pos.x;
    ch.position.z = pos.z;
    ch.position.y = groundHeight(world, pos.x, pos.z);
    const heading = Math.atan2(tx, tz);
    ch.rotation.y = heading;
    animateCharacter(ch, dt, true, ai.speed);
  }
}

export function createTraffic(scene, world, count) {
  const list = [];
  const edges = world.driveGraph.edges;
  if (!edges.length) return list;
  let tries = 0;
  while (list.length < count && tries++ < count * 10) {
    const e = edges[Math.floor(Math.random() * edges.length)];
    const everyday = Math.random() < 0.78;
    const type = everyday
      ? (Math.random() < 0.5 ? 'borough' : 'crown')
      : CAR_TYPES[Math.floor(Math.random() * 5)].id;
    const car = createCar(type, {
      x: e.a.x, z: e.a.z,
      heading: Math.atan2(e.b.x - e.a.x, e.b.z - e.a.z) + Math.PI,
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    });
    car.userData.ai = { edge: e, kind: 'traffic' };
    car.userData.parked = false;
    scene.add(car);
    list.push(car);
  }
  return list;
}

export function updateTraffic(list, world, player, dt) {
  const px = player.x, pz = player.z;
  for (const car of list) {
    if (car.userData.playerControlled) continue;
    const dx = car.position.x - px, dz = car.position.z - pz;
    if (dx * dx + dz * dz > 280 * 280) continue;
    const ai = car.userData.ai;
    if (!ai || !ai.edge) continue;
    const target = ai.edge.b;
    const tx = target.x - car.position.x, tz = target.z - car.position.z;
    const dist = Math.hypot(tx, tz);
    if (dist < 5) {
      const nexts = target.out.filter((e) => e.b !== ai.edge.a);
      ai.edge = (nexts.length ? nexts : target.out)[Math.floor(Math.random() * Math.max(1, (nexts.length ? nexts : target.out).length))] || ai.edge;
      continue;
    }
    const ang = Math.atan2(tx, tz) + Math.PI;
    let d = ((ang - car.userData.heading + Math.PI) % (Math.PI * 2));
    if (d < 0) d += Math.PI * 2;
    d -= Math.PI;
    car.userData.heading += d * (1 - Math.exp(-5 * dt));
    let speed = ai.edge.speed || 12;
    // slow near player vehicle
    if (pdNear(car, player, 8)) speed *= 0.3;
    car.userData.speed = speed;
    const pos = {
      x: car.position.x - Math.sin(car.userData.heading) * speed * dt,
      z: car.position.z - Math.cos(car.userData.heading) * speed * dt,
    };
    const hit = resolveCircle(world.hash, pos, car.userData.radius || 1.6);
    if (hit) {
      // try to pick another edge later
      car.userData.speed *= 0.4;
    }
    car.position.x = pos.x;
    car.position.z = pos.z;
    car.position.y = groundHeight(world, pos.x, pos.z);
    car.rotation.y = car.userData.heading;
    car.userData.steer = d * 1.5;
    updateWheels(car, dt);
  }
}

function pdNear(car, player, r) {
  return Math.hypot(car.position.x - player.x, car.position.z - player.z) < r;
}
