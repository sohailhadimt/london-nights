import * as THREE from 'three';
import { LANDMARKS } from '../config.js';

export function addLandmarks(scene) {
  const group = new THREE.Group();
  group.name = 'landmarks';
  group.add(makeShard());
  group.add(makeGherkin());
  group.add(makeTowerBridge());
  scene.add(group);
  return group;
}

function makeShard() {
  const g = new THREE.Group();
  const { x, z, h } = LANDMARKS.shard;
  g.position.set(x, 0, z);

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xcfe6f2,
    metalness: 0.35,
    roughness: 0.08,
    transmission: 0.15,
    thickness: 1,
    transparent: true,
    opacity: 0.92,
    envMapIntensity: 1.2,
  });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a97a3, metalness: 0.8, roughness: 0.25 });

  // Irregular tapered shard: octagon shrinking with a slanted cut
  const levels = 18;
  const shape = [];
  for (let i = 0; i <= levels; i++) {
    const t = i / levels;
    const y = t * h;
    const scale = Math.pow(1 - t, 0.85);
    const r = 22 * scale + 0.6;
    shape.push({ y, r, cut: t > 0.82 ? (t - 0.82) / 0.18 : 0 });
  }
  // Build as stacked frustum boxes slightly rotated for the "shard" plan
  const pts = 8;
  const positions = [];
  const indices = [];
  const uvs = [];
  let v = 0;
  for (let i = 0; i < shape.length - 1; i++) {
    const a = shape[i], b = shape[i + 1];
    for (let k = 0; k < pts; k++) {
      const a0 = (k / pts) * Math.PI * 2 - 0.2;
      const a1 = ((k + 1) / pts) * Math.PI * 2 - 0.2;
      const taper = (ang, s) => {
        // elongate on one axis and clip a corner for the shard silhouette
        const rx = s.r * (1.05 + 0.15 * Math.cos(ang * 2));
        const rz = s.r * (0.85 + 0.1 * Math.sin(ang));
        let px = Math.cos(ang) * rx;
        let pz = Math.sin(ang) * rz;
        if (s.cut > 0 && Math.cos(ang) > 0.2) px *= 1 - s.cut * 0.7;
        return [px, s.y, pz];
      };
      const p00 = taper(a0, a), p10 = taper(a1, a), p01 = taper(a0, b), p11 = taper(a1, b);
      positions.push(...p00, ...p10, ...p11, ...p01);
      uvs.push(k / pts, i / levels, (k + 1) / pts, i / levels, (k + 1) / pts, (i + 1) / levels, k / pts, (i + 1) / levels);
      indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, glass);
  body.castShadow = body.receiveShadow = true;
  g.add(body);

  // steel fins
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.7, h * 0.92, 1.2), steel);
    const ang = (i / 4) * Math.PI * 2 + 0.4;
    fin.position.set(Math.cos(ang) * 8, h * 0.46, Math.sin(ang) * 6);
    fin.rotation.y = ang;
    fin.scale.x = 0.6;
    g.add(fin);
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.1, 28, 6), steel);
  spire.position.y = h + 8;
  g.add(spire);

  // podium
  const podium = new THREE.Mesh(new THREE.BoxGeometry(48, 12, 40), new THREE.MeshStandardMaterial({
    color: 0x9aa7b0, metalness: 0.4, roughness: 0.3,
  }));
  podium.position.y = 6;
  podium.castShadow = true;
  g.add(podium);
  return g;
}

function makeGherkin() {
  const g = new THREE.Group();
  const { x, z, h } = LANDMARKS.gherkin;
  g.position.set(x, 0, z);

  const profile = [];
  const pts = 24;
  for (let i = 0; i <= pts; i++) {
    const t = i / pts;
    const y = t * h;
    // classic gherkin radius curve
    let r;
    if (t < 0.12) r = 18 + t / 0.12 * 8;
    else if (t < 0.62) r = 26 + Math.sin(((t - 0.12) / 0.5) * Math.PI) * 4;
    else r = 30 * Math.pow(1 - (t - 0.62) / 0.38, 0.75) + 0.8;
    profile.push(new THREE.Vector2(r, y));
  }
  const geo = new THREE.LatheGeometry(profile, 32);
  // diamond window texture
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6f8b96';
  ctx.fillRect(0, 0, 256, 512);
  ctx.strokeStyle = 'rgba(20,30,36,0.65)';
  ctx.lineWidth = 2;
  const step = 18;
  for (let y = -256; y < 512; y += step) {
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 2) {
      const yy = y + (x / 256) * step * 8;
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 2) {
      const yy = y - (x / 256) * step * 8;
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.repeat.set(2, 1);
  const mat = new THREE.MeshPhysicalMaterial({
    map, color: 0xb9d2db, metalness: 0.45, roughness: 0.12,
    transparent: true, opacity: 0.96,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  // apex cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xd9eef5, metalness: 0.6, roughness: 0.1 }));
  cap.position.y = h;
  g.add(cap);
  return g;
}

function makeTowerBridge() {
  const g = new THREE.Group();
  const a = LANDMARKS.towerBridgeN, b = LANDMARKS.towerBridgeS;
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
  const dx = b.x - a.x, dz = b.z - a.z;
  const span = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz); // rotate so local +z runs along the span
  g.position.set(mx, 0, mz);
  g.rotation.y = angle;

  const stone = new THREE.MeshStandardMaterial({ color: 0xb9a58a, roughness: 0.7, metalness: 0.05 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x2d4a7a, roughness: 0.4, metalness: 0.2 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9b37e, roughness: 0.35, metalness: 0.4 });
  const road = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.9 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.55 });

  function tower(zLocal) {
    const t = new THREE.Group();
    t.position.z = zLocal;
    const base = new THREE.Mesh(new THREE.BoxGeometry(16, 28, 16), stone);
    base.position.y = 14;
    base.castShadow = true;
    t.add(base);
    // corner turrets
    for (const sx of [-6.2, 6.2]) {
      for (const sz of [-6.2, 6.2]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 36, 10), stone);
        col.position.set(sx, 18, sz);
        t.add(col);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 6, 8), blue);
        roof.position.set(sx, 39, sz);
        t.add(roof);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), gold);
        ball.position.set(sx, 42.4, sz);
        t.add(ball);
      }
    }
    const mid = new THREE.Mesh(new THREE.BoxGeometry(14, 16, 14), stone);
    mid.position.y = 34;
    t.add(mid);
    // gothic windows
    const win = new THREE.Mesh(new THREE.BoxGeometry(3, 7, 0.4), new THREE.MeshStandardMaterial({ color: 0x1a2430 }));
    [[0, 18, 8.1], [0, 18, -8.1], [8.1, 18, 0], [-8.1, 18, 0]].forEach((p, i) => {
      const w = win.clone();
      w.position.set(...p);
      if (i >= 2) w.rotation.y = Math.PI / 2;
      t.add(w);
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(15, 3, 15), cream);
    top.position.y = 43;
    t.add(top);
    // spires
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.5, 10, 8), blue);
    spire.position.y = 49.5;
    t.add(spire);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), gold);
    tip.position.y = 55;
    t.add(tip);
    return t;
  }

  const half = span / 2 - 2;
  g.add(tower(-half), tower(half));

  // road deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(11, 1.2, span + 40), road);
  deck.position.y = 9.2;
  g.add(deck);
  // bascule joint hint (centre)
  const joint = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.4, 2), new THREE.MeshStandardMaterial({ color: 0x222 }));
  joint.position.y = 9.9;
  g.add(joint);
  // walkways
  const walk = new THREE.Mesh(new THREE.BoxGeometry(5, 1.4, span - 16), blue);
  walk.position.y = 38;
  g.add(walk);
  const walk2 = walk.clone();
  walk2.position.x = 0;
  walk2.scale.x = 0.7;
  walk2.position.y = 40;
  walk2.material = cream;
  g.add(walk2);
  // suspension chains (simple hanging boxes)
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.7, roughness: 0.3 });
  for (const side of [-1, 1]) {
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, half * 0.9), chainMat);
    chain.position.set(side * 5.2, 24, 0);
    chain.rotation.x = 0;
    // sag via a few segments
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const z = -half + t * (span - 4);
      const y = 36 - Math.sin(t * Math.PI) * 18;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, span / 9), chainMat);
      seg.position.set(side * 5.2, y, z * 0.5);
      // skip, add hanging bars from walkway instead
    }
  }
  // hanging rods from walkway to deck near towers
  for (const zpos of [-half * 0.55, half * 0.55]) {
    for (const sx of [-5, 5]) {
      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.3, 28, 0.3), chainMat);
      rod.position.set(sx, 24, zpos);
      g.add(rod);
    }
  }
  // approach walls
  for (const zpos of [-(span / 2 + 16), span / 2 + 16]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 12), stone);
    wall.position.set(0, 2, zpos);
    g.add(wall);
  }
  g.userData.deckY = 9.8;
  return g;
}

/** Famous City skyline extras — still generic extruded forms with the right silhouette. */
export function stylizeSkyscraper(name, centroid, height, pts) {
  const n = (name || '').toLowerCase();
  if (n.includes('leadenhall building')) return cheesegrater(centroid, height);
  if (n.includes('sky garden') || n.includes('20 fenchurch')) return walkie(centroid, height);
  if (n.includes('22 bishopsgate')) return bishopsgate(centroid, height);
  return null;
}

function cheesegrater(c, h) {
  const g = new THREE.Group();
  g.position.set(c.x, 0, c.z);
  const geo = new THREE.BufferGeometry();
  const w = 18, d = 40;
  const hw = w / 2, hd = d / 2;
  // slanted north face (wedge)
  const p = [
    -hw, 0, -hd,  hw, 0, -hd,  hw, 0, hd,  -hw, 0, hd,
    -hw, h, -hd,  hw, h, -hd,  hw, h * 0.2, hd,  -hw, h * 0.2, hd,
  ];
  const idx = [
    0, 1, 5, 0, 5, 4, // south
    1, 2, 6, 1, 6, 5, // east
    2, 3, 7, 2, 7, 6, // north slant
    3, 0, 4, 3, 4, 7, // west
    4, 5, 6, 4, 6, 7, // top
  ];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
    color: 0xc5d5de, metalness: 0.5, roughness: 0.15,
  }));
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

function walkie(c, h) {
  const g = new THREE.Group();
  g.position.set(c.x, 0, c.z);
  const profile = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const y = t * h;
    const r = 12 + Math.pow(t, 1.6) * 14;
    profile.push(new THREE.Vector2(r, y));
  }
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), new THREE.MeshPhysicalMaterial({
    color: 0xdde6ea, metalness: 0.45, roughness: 0.18,
  }));
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

function bishopsgate(c, h) {
  const g = new THREE.Group();
  g.position.set(c.x, 0, c.z);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x9eb0ba, metalness: 0.4, roughness: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(28, h * 0.92, 32), mat);
  body.position.y = h * 0.46;
  body.castShadow = true;
  g.add(body);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(30, h * 0.08, 34), new THREE.MeshStandardMaterial({
    color: 0xe8eef2, metalness: 0.5, roughness: 0.15,
  }));
  crown.position.y = h * 0.96;
  g.add(crown);
  return g;
}
