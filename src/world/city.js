import * as THREE from 'three';
import { HEIGHT_OVERRIDES, LANDMARKS, DRIVEABLE, BUS_ROUTE_NAMES } from '../config.js';
import { hash, polyCentroid, resamplePath, closestPointOnSegments, dist2 } from '../utils.js';
import { getTexture, makeWaterMaterial } from './textures.js';
import { SpatialHash, boundsOf } from './collision.js';
import { addLandmarks, stylizeSkyscraper } from './landmarks.js';

const SKIP_NAMES = new Set(['the shard', '30 st mary axe']);

export async function buildCity(scene) {
  const res = await fetch('./data/city.json');
  if (!res.ok) throw new Error('Could not load city data');
  const data = await res.json();

  const world = {
    data,
    hash: new SpatialHash(28),
    roads: [],
    driveGraph: { nodes: new Map(), edges: [] },
    sidewalks: [],
    busPath: [],
    stations: [],
    shops: data.shops || [],
    water: data.water || [],
    bounds: { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  };

  addGround(scene);
  addParks(scene, data.parks || []);
  addWater(scene, world, data.water || []);
  addRoads(scene, world, data.roads || []);
  addBuildings(scene, world, data.buildings || []);
  addLandmarks(scene);
  registerLandmarkCollision(world);
  world.stations = prepareStations(data.stations || []);
  buildDriveGraph(world, data.roads || []);
  world.busPath = buildBusPath(data.roads || []);
  world.sidewalks = buildSidewalks(data.roads || []);
  expandBounds(world);
  addBoundFog(scene);

  return world;
}

function expandBounds(world) {
  const pad = 40;
  // From road extents
  for (const r of world.roads) {
    for (const p of r.p) {
      if (p[0] < world.bounds.minX) world.bounds.minX = p[0];
      if (p[0] > world.bounds.maxX) world.bounds.maxX = p[0];
      if (p[1] < world.bounds.minZ) world.bounds.minZ = p[1];
      if (p[1] > world.bounds.maxZ) world.bounds.maxZ = p[1];
    }
  }
  world.bounds.minX -= pad; world.bounds.maxX += pad;
  world.bounds.minZ -= pad; world.bounds.maxZ += pad;
}

function addBoundFog(scene) {
  scene.background = new THREE.Color(0xb6d4e6);
  scene.fog = new THREE.Fog(0xb6d4e6, 260, 720);
}

function addGround(scene) {
  const mat = new THREE.MeshStandardMaterial({
    map: getTexture('pavement'),
    color: 0xb4aea4,
    roughness: 0.95,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.2;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function addParks(scene, parks) {
  const mat = new THREE.MeshStandardMaterial({
    map: getTexture('grass'),
    color: 0x5a7a44,
    roughness: 0.95,
  });
  const geos = [];
  for (const park of parks) {
    const geo = shapeGeom(park.p, 0.25);
    if (geo) geos.push(geo);
  }
  if (!geos.length) return;
  const merged = mergeGeos(geos);
  const mesh = new THREE.Mesh(merged, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function addWater(scene, world, polys) {
  const mat = makeWaterMaterial();
  const geos = [];
  for (const w of polys) {
    if (!w.p || w.p.length < 3) continue;
    const b = boundsOf(w.p);
    world.hash.insert({ kind: 'water', pts: w.p, ...b, bridgeable: false });
    // Large named river: triangle strip from two banks (left half / right half)
    if ((w.name === 'River Thames' || w.p.length > 200) && w.p.length % 2 === 0) {
      const geo = riverStripGeom(w.p, 0.04);
      if (geo) geos.push(geo);
      continue;
    }
    const geo = shapeGeom(w.p, 0.05);
    if (geo) geos.push(geo);
  }
  if (!geos.length) return;
  const mesh = new THREE.Mesh(mergeGeos(geos), mat);
  mesh.name = 'thames';
  scene.add(mesh);
  world.waterMesh = mesh;
}

function riverStripGeom(pts, y) {
  const half = pts.length / 2;
  const left = pts.slice(0, half);
  const right = pts.slice(half).reverse();
  const n = Math.min(left.length, right.length);
  if (n < 2) return null;
  const pos = [], uv = [], idx = [];
  let dist = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) dist += Math.hypot(left[i][0] - left[i - 1][0], left[i][1] - left[i - 1][1]);
    pos.push(left[i][0], y, left[i][1], right[i][0], y, right[i][1]);
    uv.push(0, dist / 40, 1, dist / 40);
    if (i > 0) {
      const v = i * 2;
      idx.push(v - 2, v - 1, v + 1, v - 2, v + 1, v);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function addRoads(scene, world, roads) {
  const asphalt = new THREE.MeshStandardMaterial({
    color: 0x5a5d62, roughness: 0.88, metalness: 0,
    map: getTexture('asphalt'),
  });
  const foot = new THREE.MeshStandardMaterial({ color: 0x9a968e, roughness: 0.95 });
  const mark = new THREE.MeshStandardMaterial({ color: 0xd8d0a8, roughness: 0.7 });
  const driveGeos = [], footGeos = [], markGeos = [];

  for (const r of roads) {
    if (!r.p || r.p.length < 2) continue;
    world.roads.push(r);
    const drive = DRIVEABLE.has(r.k) || r.k === 'pedestrian';
    const w = r.w || 6;
    const y = r.bridge ? 9.45 : 0.06;
    const geo = ribbonGeom(r.p, r.bridge ? Math.max(w, 13) : w, y);
    if (!geo) continue;
    if (r.bridge && drive) {
      (world._bridgeGeos || (world._bridgeGeos = [])).push(geo);
      const railL = ribbonGeom(offsetPath(r.p, (r.w || 12) * 0.5 + 0.2), 0.25, y + 1.05);
      const railR = ribbonGeom(offsetPath(r.p, -(r.w || 12) * 0.5 - 0.2), 0.25, y + 1.05);
      if (railL) (world._railGeos || (world._railGeos = [])).push(railL);
      if (railR) (world._railGeos || (world._railGeos = [])).push(railR);
    } else if (drive && r.k !== 'pedestrian' && r.k !== 'service') driveGeos.push(geo);
    else if (r.k === 'footway' || r.k === 'path' || r.k === 'steps' || r.k === 'cycleway' || r.k === 'pedestrian') {
      footGeos.push(geo);
    } else {
      driveGeos.push(geo);
    }
    if (drive && w >= 8 && !r.tunnel) {
      const line = ribbonGeom(r.p, 0.22, y + 0.03, true);
      if (line) markGeos.push(line);
    }
  }
  if (driveGeos.length) {
    const m = new THREE.Mesh(mergeGeos(driveGeos), asphalt);
    m.receiveShadow = true;
    scene.add(m);
  }
  if (world._bridgeGeos && world._bridgeGeos.length) {
    const deck = new THREE.Mesh(mergeGeos(world._bridgeGeos), new THREE.MeshStandardMaterial({
      color: 0x6a6e74, roughness: 0.85, metalness: 0,
    }));
    deck.receiveShadow = true;
    deck.name = 'bridges';
    scene.add(deck);
    delete world._bridgeGeos;
  }
  if (world._railGeos && world._railGeos.length) {
    scene.add(new THREE.Mesh(mergeGeos(world._railGeos), new THREE.MeshStandardMaterial({
      color: 0x2a2c30, metalness: 0.4, roughness: 0.45,
    })));
    delete world._railGeos;
  }
  if (footGeos.length) {
    const m = new THREE.Mesh(mergeGeos(footGeos), foot);
    m.receiveShadow = true;
    scene.add(m);
  }
  if (markGeos.length) scene.add(new THREE.Mesh(mergeGeos(markGeos), mark));
}

function offsetPath(pts, off) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    let dx, dz;
    if (i === 0) { dx = pts[1][0] - pts[0][0]; dz = pts[1][1] - pts[0][1]; }
    else if (i === pts.length - 1) { dx = pts[i][0] - pts[i - 1][0]; dz = pts[i][1] - pts[i - 1][1]; }
    else { dx = pts[i + 1][0] - pts[i - 1][0]; dz = pts[i + 1][1] - pts[i - 1][1]; }
    const len = Math.hypot(dx, dz) || 1;
    out.push([pts[i][0] + (-dz / len) * off, pts[i][1] + (dx / len) * off]);
  }
  return out;
}

function materialFor(kind, name, h) {
  const k = (kind || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (k === 'church' || k === 'cathedral' || k === 'chapel' || k === 'castle' || k === 'ruins' || k === 'tower') return 'stone';
  if (k === 'apartments' || k === 'residential' || k === 'house' || k === 'terrace' || k === 'dormitory') return 'residential';
  if (k === 'retail' || k === 'shop' || k === 'supermarket') return 'retail';
  if (k === 'commercial' || k === 'office' || k === 'hotel' || h >= 50) return h >= 80 ? 'glass' : 'office';
  if (n.includes('market')) return 'stone';
  if (k === 'brick') return 'brick';
  return h >= 40 ? 'portland' : (hash(h + (name || '').length) > 0.7 ? 'brick' : 'portland');
}

function addBuildings(scene, world, buildings) {
  const buckets = new Map();
  const roofGeos = [];
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x5a6066, roughness: 0.8, metalness: 0.05, map: getTexture('roof'),
  });

  for (const b of buildings) {
    if (!b.p || b.p.length < 3) continue;
    const name = b.n || '';
    if (SKIP_NAMES.has(name.toLowerCase())) continue;
    const c = polyCentroid(b.p);
    // skip footprints under custom landmarks
    if (dist2(c.x, c.z, LANDMARKS.shard.x, LANDMARKS.shard.z) < 42 * 42) continue;
    if (dist2(c.x, c.z, LANDMARKS.gherkin.x, LANDMARKS.gherkin.z) < 32 * 32) continue;
    // drop mis-tagged mega-polygons (e.g. a 400m "London Bridge" slab)
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of b.p) {
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
      if (p[1] < minZ) minZ = p[1]; if (p[1] > maxZ) maxZ = p[1];
    }
    const bw = maxX - minX, bd = maxZ - minZ;
    if ((bw > 160 || bd > 160 || bw * bd > 14000) && (HEIGHT_OVERRIDES[name] || b.h || 16) < 50) continue;

    let h = HEIGHT_OVERRIDES[name] || b.h || 16;
    // slight variation so the city isn't a slab
    if (!HEIGHT_OVERRIDES[name] && h <= 16) h += hash(c.x * 0.1 + c.z) * 8;
    h = Math.max(4, Math.min(h, 310));

    const styled = stylizeSkyscraper(name, c, h, b.p);
    if (styled) {
      scene.add(styled);
      const box = boundsOf(b.p, 0.5);
      world.hash.insert({ kind: 'building', pts: b.p, name, ...box });
      continue;
    }

    const matKey = materialFor(b.k, name, h);
    const wall = shapeWalls(b.p, h);
    if (!wall) continue;
    if (!buckets.has(matKey)) buckets.set(matKey, []);
    buckets.get(matKey).push(wall);
    const roof = shapeGeom(b.p, h);
    if (roof) roofGeos.push(roof);

    const box = boundsOf(b.p, 0.4);
    world.hash.insert({ kind: 'building', pts: b.p, name, h, ...box });
  }

  for (const [key, geos] of buckets) {
    const tex = getTexture(key);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xffffff,
      roughness: key === 'glass' || key === 'office' ? 0.25 : 0.75,
      metalness: key === 'glass' || key === 'office' ? 0.35 : 0.04,
    });
    const mesh = new THREE.Mesh(mergeGeos(geos), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  }
  if (roofGeos.length) {
    const roof = new THREE.Mesh(mergeGeos(roofGeos), roofMat);
    roof.receiveShadow = true;
    scene.add(roof);
  }
}

function registerLandmarkCollision(world) {
  const boxes = [
    { kind: 'building', name: 'The Shard', pts: rect(LANDMARKS.shard.x, LANDMARKS.shard.z, 40, 34) },
    { kind: 'building', name: 'The Gherkin', pts: circle(LANDMARKS.gherkin.x, LANDMARKS.gherkin.z, 28, 16) },
  ];
  for (const b of boxes) {
    world.hash.insert({ ...b, ...boundsOf(b.pts, 0.5) });
  }
}

function rect(x, z, w, d) {
  const hw = w / 2, hd = d / 2;
  return [[x - hw, z - hd], [x + hw, z - hd], [x + hw, z + hd], [x - hw, z + hd]];
}
function circle(x, z, r, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([x + Math.cos(a) * r, z + Math.sin(a) * r]);
  }
  return pts;
}

function shapeGeom(pts, y) {
  const shape = makeShape(pts);
  if (!shape) return null;
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y, 0);
  return geo;
}

function shapeWalls(pts, h) {
  // Manual side quads so UVs tile correctly per storey
  const pos = [], norm = [], uv = [], idx = [];
  let v = 0;
  const storeys = Math.max(1, h / 4);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ax = a[0], az = a[1], bx = b[0], bz = b[1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.15) continue;
    const nx = (az - bz) / len, nz = (bx - ax) / len;
    pos.push(ax, 0, az, bx, 0, bz, bx, h, bz, ax, h, az);
    norm.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz);
    const u = Math.max(0.4, len / 18);
    const vv = Math.max(0.6, h / 36);
    uv.push(0, 0, u, 0, u, vv, 0, vv);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

function makeShape(pts) {
  if (!pts || pts.length < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1]);
  shape.closePath();
  return shape;
}

function ribbonGeom(pts, width, y, dashed = false) {
  if (pts.length < 2) return null;
  const hw = width / 2;
  const pos = [], uv = [], idx = [];
  const dirs = [];
  for (let i = 0; i < pts.length; i++) {
    let dx, dz;
    if (i === 0) { dx = pts[1][0] - pts[0][0]; dz = pts[1][1] - pts[0][1]; }
    else if (i === pts.length - 1) { dx = pts[i][0] - pts[i - 1][0]; dz = pts[i][1] - pts[i - 1][1]; }
    else { dx = pts[i + 1][0] - pts[i - 1][0]; dz = pts[i + 1][1] - pts[i - 1][1]; }
    const len = Math.hypot(dx, dz) || 1;
    dirs.push([-dz / len, dx / len]);
  }
  let v = 0, dist = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    const [nx, nz] = dirs[i];
    pos.push(x + nx * hw, y, z + nz * hw, x - nx * hw, y, z - nz * hw);
    if (i > 0) dist += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const u = dist / 8;
    uv.push(0, u, 1, u);
    if (i > 0) {
      if (!dashed || Math.floor(dist / 6) % 2 === 0) {
        idx.push(v - 2, v - 1, v + 1, v - 2, v + 1, v);
      }
    }
    v += 2;
  }
  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function mergeGeos(geos) {
  const pos = [], norm = [], uv = [], idx = [];
  let base = 0;
  for (const g of geos) {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const u = g.getAttribute('uv');
    const index = g.getIndex();
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) norm.push(n.getX(i), n.getY(i), n.getZ(i));
      if (u) uv.push(u.getX(i), u.getY(i));
      else uv.push(0, 0);
    }
    if (index) {
      for (let i = 0; i < index.count; i++) idx.push(index.getX(i) + base);
    } else {
      for (let i = 0; i < p.count; i++) idx.push(base + i);
    }
    base += p.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (norm.length === pos.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  else geo.computeVertexNormals();
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

function snapKey(x, z, cell = 6) {
  return `${Math.round(x / cell) * cell},${Math.round(z / cell) * cell}`;
}

function buildDriveGraph(world, roads) {
  const nodes = world.driveGraph.nodes;
  const edges = world.driveGraph.edges;
  const ensure = (x, z) => {
    const k = snapKey(x, z);
    let n = nodes.get(k);
    if (!n) {
      const [sx, sz] = k.split(',').map(Number);
      n = { k, x: sx, z: sz, out: [] };
      nodes.set(k, n);
    }
    return n;
  };
  for (const r of roads) {
    if (!DRIVEABLE.has(r.k) || r.tunnel) continue;
    if (r.k === 'service' && (r.w || 6) < 5) continue;
    const pts = r.p;
    if (!pts || pts.length < 2) continue;
    const speed = r.k === 'primary' || r.k === 'trunk' ? 16
      : r.k === 'secondary' || r.k === 'tertiary' ? 13
      : 10;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = ensure(pts[i][0], pts[i][1]);
      const b = ensure(pts[i + 1][0], pts[i + 1][1]);
      if (a === b) continue;
      const e = { a, b, speed, w: r.w || 6, name: r.name || '', bridge: !!r.bridge };
      a.out.push(e);
      edges.push(e);
      if (!r.oneway) {
        const e2 = { a: b, b: a, speed, w: r.w || 6, name: r.name || '', bridge: !!r.bridge };
        b.out.push(e2);
        edges.push(e2);
      }
    }
  }
}

function buildBusPath(roads) {
  const byName = new Map();
  for (const r of roads) {
    if (!r.name || !r.p) continue;
    if (!DRIVEABLE.has(r.k)) continue;
    if (!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name).push(r.p);
  }
  const chain = [];
  for (const name of BUS_ROUTE_NAMES) {
    const segs = byName.get(name);
    if (!segs || !segs.length) continue;
    // stitch segments of this street
    const unused = segs.map((p) => p.slice());
    let current = unused.shift();
    while (unused.length) {
      let bestI = -1, bestD = 80, rev = false, atEnd = true;
      const head = current[0], tail = current[current.length - 1];
      unused.forEach((s, i) => {
        const a = s[0], b = s[s.length - 1];
        const d = [
          [dist2(tail[0], tail[1], a[0], a[1]), false, true],
          [dist2(tail[0], tail[1], b[0], b[1]), true, true],
          [dist2(head[0], head[1], a[0], a[1]), true, false],
          [dist2(head[0], head[1], b[0], b[1]), false, false],
        ];
        for (const [dd, r, end] of d) {
          if (dd < bestD * bestD) { bestD = Math.sqrt(dd); bestI = i; rev = r; atEnd = end; }
        }
      });
      if (bestI < 0) break;
      let add = unused.splice(bestI, 1)[0];
      if (rev) add = add.slice().reverse();
      current = atEnd ? current.concat(add) : add.concat(current);
    }
    if (!chain.length) chain.push(...current);
    else {
      const t = chain[chain.length - 1];
      const a = current[0], b = current[current.length - 1];
      const use = dist2(t[0], t[1], a[0], a[1]) <= dist2(t[0], t[1], b[0], b[1]) ? current : current.slice().reverse();
      chain.push(...use);
    }
  }
  const path = resamplePath(chain, 7);
  return path.length > 8 ? path : [];
}

function buildSidewalks(roads) {
  const pts = [];
  for (const r of roads) {
    if (!DRIVEABLE.has(r.k) && r.k !== 'pedestrian') continue;
    if (!r.p || r.p.length < 2) continue;
    const w = (r.w || 6) / 2 + 2.2;
    const sampled = resamplePath(r.p, 10);
    if (!sampled || sampled.length < 2) continue;
    for (let i = 0; i < sampled.length; i++) {
      let dx, dz;
      if (i === 0) { dx = sampled[1][0] - sampled[0][0]; dz = sampled[1][1] - sampled[0][1]; }
      else if (i === sampled.length - 1) { dx = sampled[i][0] - sampled[i - 1][0]; dz = sampled[i][1] - sampled[i - 1][1]; }
      else { dx = sampled[i + 1][0] - sampled[i - 1][0]; dz = sampled[i + 1][1] - sampled[i - 1][1]; }
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      pts.push([sampled[i][0] + nx * w, sampled[i][1] + nz * w]);
      pts.push([sampled[i][0] - nx * w, sampled[i][1] - nz * w]);
    }
  }
  return pts;
}

function prepareStations(list) {
  const want = new Set([
    'London Bridge', 'Borough', 'Monument', 'Bank', 'Cannon Street',
    'Mansion House', "St. Paul's", 'Liverpool Street', 'Aldgate', 'Tower Hill',
  ]);
  const out = [];
  const seen = new Set();
  for (const s of list) {
    let name = s.n || 'Station';
    if (name === 'London Cannon Street') name = 'Cannon Street';
    if (name === 'London Fenchurch Street' || name === 'Tower Gateway') continue;
    if (!want.has(name) && ![...want].some((w) => name.includes(w))) continue;
    const key = [...want].find((w) => name === w || name.includes(w)) || name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ n: key, x: s.x, z: s.z });
  }
  return out;
}

export function nearestRoad(world, x, z, driveableOnly = false) {
  let best = null, bestD = 40;
  for (const r of world.roads) {
    if (driveableOnly && !DRIVEABLE.has(r.k)) continue;
    const c = closestPointOnSegments(x, z, r.p);
    if (c.dist < bestD) { bestD = c.dist; best = { road: r, ...c }; }
  }
  return best;
}

export function isOnBridge(world, x, z) {
  const n = nearestRoad(world, x, z, true);
  return n && n.road.bridge && n.dist < (n.road.w || 8);
}

export function findWalkableNear(world, x, z, hashQuery) {
  for (const r of [0, 6, 12, 18, 26, 36]) {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      const px = x + Math.cos(ang) * r, pz = z + Math.sin(ang) * r;
      if (!hashQuery(px, pz)) return { x: px, z: pz };
    }
  }
  return { x, z };
}


export function groundHeight(world, x, z) {
  const n = nearestRoad(world, x, z, true);
  if (n && n.road && n.road.bridge && n.dist < (n.road.w || 8) * 0.65 + 2.5) return 9.35;
  return 0;
}
