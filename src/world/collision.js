import { pointInPoly } from '../utils.js';

export class SpatialHash {
  constructor(cell = 24) {
    this.cell = cell;
    this.map = new Map();
    this.items = [];
  }
  key(cx, cz) { return `${cx},${cz}`; }
  insert(item) {
    this.items.push(item);
    const { minX, maxX, minZ, maxZ } = item;
    const c = this.cell;
    const x0 = Math.floor(minX / c), x1 = Math.floor(maxX / c);
    const z0 = Math.floor(minZ / c), z1 = Math.floor(maxZ / c);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const k = this.key(x, z);
        let b = this.map.get(k);
        if (!b) { b = []; this.map.set(k, b); }
        b.push(item);
      }
    }
  }
  query(x, z, r = 4) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    const out = [];
    const seen = new Set();
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const b = this.map.get(this.key(ix, iz));
        if (!b) continue;
        for (const it of b) {
          if (seen.has(it)) continue;
          seen.add(it);
          out.push(it);
        }
      }
    }
    return out;
  }
}

export function boundsOf(pts, pad = 0) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minZ) minZ = p[1];
    if (p[1] > maxZ) maxZ = p[1];
  }
  return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
}

/** Push a circle out of building footprints. Returns true if collided. */
export function resolveCircle(hash, pos, radius) {
  let collided = false;
  const near = hash.query(pos.x, pos.z, radius + 8);
  for (const item of near) {
    if (item.kind !== 'building' && item.kind !== 'water') continue;
    if (item.kind === 'water' && item.bridgeable) continue;
    if (pos.x < item.minX - radius || pos.x > item.maxX + radius ||
        pos.z < item.minZ - radius || pos.z > item.maxZ + radius) continue;
    if (!pointInPoly(pos.x, pos.z, item.pts) && !edgeHit(pos.x, pos.z, radius, item.pts)) continue;
    // push out to nearest edge
    const n = nearestEdge(pos.x, pos.z, item.pts);
    if (!n) continue;
    const need = radius + 0.15;
    if (n.dist < need || pointInPoly(pos.x, pos.z, item.pts)) {
      const push = pointInPoly(pos.x, pos.z, item.pts) ? need + n.dist : need - n.dist;
      // outward normal from edge (approx from closest point)
      let nx = pos.x - n.x, nz = pos.z - n.z;
      let len = Math.hypot(nx, nz);
      if (len < 1e-5) { nx = n.nx; nz = n.nz; len = 1; }
      nx /= len; nz /= len;
      // if still inside after using this direction, flip
      const testX = n.x + nx * need, testZ = n.z + nz * need;
      if (pointInPoly(testX, testZ, item.pts)) { nx = -nx; nz = -nz; }
      pos.x = n.x + nx * need;
      pos.z = n.z + nz * need;
      collided = true;
    }
  }
  return collided;
}

function edgeHit(x, z, r, pts) {
  const r2 = r * r;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const ax = pts[j][0], az = pts[j][1], bx = pts[i][0], bz = pts[i][1];
    const ex = bx - ax, ez = bz - az;
    const len2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / len2));
    const cx = ax + ex * t, cz = az + ez * t;
    if ((x - cx) * (x - cx) + (z - cz) * (z - cz) <= r2) return true;
  }
  return false;
}

function nearestEdge(x, z, pts) {
  let best = Infinity, res = null;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const ax = pts[j][0], az = pts[j][1], bx = pts[i][0], bz = pts[i][1];
    const ex = bx - ax, ez = bz - az;
    const len2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / len2));
    const cx = ax + ex * t, cz = az + ez * t;
    const d = (x - cx) * (x - cx) + (z - cz) * (z - cz);
    if (d < best) {
      best = d;
      const len = Math.sqrt(len2);
      res = { x: cx, z: cz, dist: Math.sqrt(d), nx: -ez / len, nz: ex / len };
    }
  }
  return res;
}

export function insideAny(hash, x, z, kind) {
  const near = hash.query(x, z, 2);
  for (const item of near) {
    if (kind && item.kind !== kind) continue;
    if (x < item.minX || x > item.maxX || z < item.minZ || z > item.maxZ) continue;
    if (pointInPoly(x, z, item.pts)) return item;
  }
  return null;
}
