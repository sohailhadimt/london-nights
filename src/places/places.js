import * as THREE from 'three';
import { OPTIONS } from '../player/character.js';

export const SHOPS = [
  {
    id: 'outfitters',
    name: 'Southwark Outfitters',
    kind: 'clothes',
    x: 34, z: 173,
    blurb: 'Change your clothes here.',
  },
  {
    id: 'cafe',
    name: 'Bridge Café',
    kind: 'cafe',
    x: 1, z: 158,
    blurb: 'A quiet table by the window.',
  },
  {
    id: 'news',
    name: 'City News',
    kind: 'newsagent',
    x: -88, z: 234,
    blurb: 'Papers, sweets, and a pint of milk.',
  },
];

export function addPlaceMarkers(scene, world) {
  const group = new THREE.Group();
  const shopMats = {
    clothes: 0xc9a227,
    cafe: 0xb04a2a,
    newsagent: 0x2a5a8c,
  };
  for (const s of SHOPS) {
    const marker = makeSign(s.name, shopMats[s.kind] || 0xc9a227);
    marker.position.set(s.x, 0, s.z);
    group.add(marker);
    s.marker = marker;
  }
  for (const st of world.stations) {
    const sign = makeTubeSign(st.n);
    // nudge off the building if needed — sit on the pavement
    sign.position.set(st.x, 0, st.z);
    group.add(sign);
    st.marker = sign;
  }
  scene.add(group);
  return group;
}

function makeSign(text, color) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x333 }),
  );
  post.position.y = 1.2;
  g.add(post);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.5, 0.08),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
  );
  board.position.y = 2.5;
  g.add(board);
  const canvas = labelCanvas(text, '#fff', '#0000');
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvas, transparent: true }));
  sprite.position.y = 2.5;
  sprite.scale.set(1.7, 0.45, 1);
  g.add(sprite);
  return g;
}

function makeTubeSign(name) {
  const g = new THREE.Group();
  // Generic "TUBE" entrance — not a copy of any official logo
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.12, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x6b1c28, roughness: 0.45 }),
  );
  canopy.position.y = 2.7;
  g.add(canopy);
  for (const s of [-1.5, 1.5]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 2.7, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a }),
    );
    post.position.set(s, 1.35, 0.55);
    g.add(post);
  }
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 2.2, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x1a2a44 }),
  );
  wall.position.set(0, 1.1, -0.5);
  g.add(wall);
  const canvas = labelCanvas('TUBE  ·  ' + name.toUpperCase(), '#f2f2f2', '#1a2a44');
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvas, transparent: true }));
  sprite.position.set(0, 2.95, 0);
  sprite.scale.set(3.0, 0.5, 1);
  g.add(sprite);
  return g;
}

function labelCanvas(text, fg, bg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 80;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 80);
  ctx.fillStyle = fg;
  ctx.font = '700 32px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createInterior(scene) {
  const room = new THREE.Group();
  room.position.set(0, -80, 0);
  room.visible = false;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8ddcc, roughness: 0.8 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x6a4a32, roughness: 0.7 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), floorMat);
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 3.2;
  room.add(ceil);
  const walls = [
    [0, 1.6, -5, 12, 3.2, 0.2],
    [0, 1.6, 5, 12, 3.2, 0.2],
    [-6, 1.6, 0, 0.2, 3.2, 10],
    [6, 1.6, 0, 0.2, 3.2, 10],
  ];
  for (const [x, y, z, w, h, d] of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, y, z);
    room.add(m);
  }
  // door opening on +Z wall — dark portal
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.2, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x1a120c }),
  );
  door.position.set(0, 1.1, 5);
  door.name = 'exitDoor';
  room.add(door);

  const lamp = new THREE.PointLight(0xfff2dd, 40, 18);
  lamp.position.set(0, 3, 0);
  room.add(lamp);
  const furn = new THREE.Group();
  furn.name = 'furniture';
  room.add(furn);

  scene.add(room);
  return room;
}

export function dressInterior(room, shop) {
  const furn = room.getObjectByName('furniture');
  while (furn.children.length) furn.remove(furn.children[0]);
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2f, roughness: 0.7 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x2a4a6a, roughness: 0.8 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf0e6d4, roughness: 0.7 });
  const red = new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.6 });

  if (shop.kind === 'clothes') {
    for (let i = 0; i < 4; i++) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 0.5), wood);
      rack.position.set(-3.5 + i * 0.1, 0.9, -2 + i * 0.05);
      // actually place along back wall
    }
    for (let i = 0; i < 3; i++) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.7, 0.45), wood);
      rack.position.set(-3 + i * 3, 0.85, -3.6);
      furn.add(rack);
      for (let k = 0; k < 5; k++) {
        const garm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.15), new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(k / 5, 0.45, 0.4),
        }));
        garm.position.set(-3 + i * 3 + (k - 2) * 0.4, 1.0, -3.45);
        furn.add(garm);
      }
    }
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 0.8), wood);
    counter.position.set(3.5, 0.5, 2);
    furn.add(counter);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 0.05), new THREE.MeshStandardMaterial({
      color: 0xbfd4e0, metalness: 0.6, roughness: 0.1,
    }));
    mirror.position.set(-5.4, 1.4, 0);
    furn.add(mirror);
  } else if (shop.kind === 'cafe') {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.1, 1.0), wood);
    counter.position.set(-1, 0.55, -3.6);
    furn.add(counter);
    const machine = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.4), new THREE.MeshStandardMaterial({ color: 0x222, metalness: 0.5 }));
    machine.position.set(-2.2, 1.45, -3.5);
    furn.add(machine);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const table = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12), cream);
        table.position.set(-3 + i * 2.5, 0.75, -0.5 + j * 2.4);
        furn.add(table);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8), wood);
        leg.position.set(-3 + i * 2.5, 0.37, -0.5 + j * 2.4);
        furn.add(leg);
        const chair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.4), cloth);
        chair.position.set(-3 + i * 2.5, 0.3, 0.15 + j * 2.4);
        furn.add(chair);
      }
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 0.5), wood);
      shelf.position.set(-3.8 + (i % 2) * 3.2, 1.0, -3.5 + Math.floor(i / 2) * 2.2);
      furn.add(shelf);
      for (let k = 0; k < 6; k++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.2), new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL((k + i) / 8, 0.6, 0.5),
        }));
        box.position.set(-4.5 + (i % 2) * 3.2 + k * 0.3, 1.3, -3.3 + Math.floor(i / 2) * 2.2);
        furn.add(box);
      }
    }
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.9), wood);
    counter.position.set(3.6, 0.5, 1.5);
    furn.add(counter);
    const papers = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.6), red);
    papers.position.set(3.6, 1.1, 1.5);
    furn.add(papers);
  }
}

export function nearestPlace(x, z, list, radius = 6) {
  let best = null, bestD = radius;
  for (const p of list) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

export { OPTIONS };
