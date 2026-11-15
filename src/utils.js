export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function damp(a, b, l, dt) { return lerp(a, b, 1 - Math.exp(-l * dt)); }
export function dampAngle(a, b, l, dt) { return lerpAngle(a, b, 1 - Math.exp(-l * dt)); }

export function hash(n) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}

export function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
    const hit = ((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-9) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

export function polyCentroid(pts) {
  let x = 0, z = 0;
  for (const p of pts) { x += p[0]; z += p[1]; }
  const n = pts.length || 1;
  return { x: x / n, z: z / n };
}

export function closestPointOnSegments(x, z, pts) {
  let best = Infinity, px = x, pz = z, dx = 0, dz = 1, tAcc = 0, along = 0, total = 0;
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
    const ex = bx - ax, ez = bz - az;
    const len2 = ex * ex + ez * ez;
    const t = len2 > 0 ? clamp(((x - ax) * ex + (z - az) * ez) / len2, 0, 1) : 0;
    const cx = ax + ex * t, cz = az + ez * t;
    const d = (x - cx) * (x - cx) + (z - cz) * (z - cz);
    const len = Math.sqrt(len2);
    segs.push(len);
    total += len;
    if (d < best) {
      best = d; px = cx; pz = cz; along = tAcc + t * len;
      const inv = 1 / (len || 1);
      dx = ex * inv; dz = ez * inv;
    }
    tAcc += len;
  }
  return { x: px, z: pz, dist: Math.sqrt(best), dx, dz, along, total };
}

export function resamplePath(pts, step = 8) {
  if (!pts || pts.length < 2) return pts ? pts.slice() : [];
  if (!pts[0] || !pts[1]) return [];
  const out = [[pts[0][0], pts[0][1]]];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    let ax = pts[i][0], az = pts[i][1];
    const bx = pts[i + 1][0], bz = pts[i + 1][1];
    let dx = bx - ax, dz = bz - az;
    let len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    dx /= len; dz /= len;
    while (carry + len >= step) {
      const use = step - carry;
      ax += dx * use; az += dz * use;
      out.push([ax, az]);
      len -= use;
      carry = 0;
    }
    carry += len;
  }
  const last = pts[pts.length - 1];
  const prev = out[out.length - 1];
  if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > 1) out.push([last[0], last[1]]);
  return out;
}

export { clamp as default };
