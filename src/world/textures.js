import * as THREE from 'three';

const cache = new Map();

function canvasTexture(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function getTexture(name) {
  if (cache.has(name)) return cache.get(name);
  let tex;
  switch (name) {
    case 'office':
      tex = facade('#8aa0b0', '#1c2833', 8, 14, 0.55); break;
    case 'glass':
      tex = facade('#9ec3d4', '#163044', 10, 16, 0.7); break;
    case 'brick':
      tex = brick('#8a4a3a', '#6e382c'); break;
    case 'stone':
      tex = facade('#c9c0af', '#3d3a34', 6, 10, 0.25); break;
    case 'portland':
      tex = facade('#b9b3a6', '#2f2d29', 7, 12, 0.35); break;
    case 'residential':
      tex = facade('#c4b09a', '#3a2f28', 5, 8, 0.3); break;
    case 'retail':
      tex = facade('#cfc6b8', '#2a2620', 4, 7, 0.4, true); break;
    case 'roof':
      tex = canvasTexture(64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#4a4f55';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#3a3f44';
        for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 1);
      }, 4, 4);
      break;
    case 'asphalt':
      tex = canvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#3a3c40';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 800; i++) {
          ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
          ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
      }, 1, 1);
      break;
    case 'pavement':
      tex = canvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#8a8680';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += 16) {
          for (let x = 0; x < w; x += 16) {
            ctx.strokeRect(x + 0.5, y + 0.5, 16, 16);
          }
        }
      }, 8, 8);
      break;
    case 'grass':
      tex = canvasTexture(64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#4a6b3a';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 200; i++) {
          ctx.fillStyle = Math.random() > 0.5 ? '#3e5c32' : '#5a7c45';
          ctx.fillRect(Math.random() * w, Math.random() * h, 2, 3);
        }
      }, 6, 6);
      break;
    case 'water':
      tex = canvasTexture(128, 128, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#1a4a5c');
        g.addColorStop(0.5, '#163d52');
        g.addColorStop(1, '#1c5560');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(180,220,230,0.18)';
        ctx.lineWidth = 2;
        for (let y = 8; y < h; y += 16) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.2 + y) * 3);
          ctx.stroke();
        }
      }, 14, 14);
      break;
    default:
      tex = canvasTexture(4, 4, (ctx) => { ctx.fillStyle = '#888'; ctx.fillRect(0, 0, 4, 4); });
  }
  cache.set(name, tex);
  return tex;
}

function facade(wall, window, cols, rows, glassChance, shopFront = false) {
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);
    const ww = w / (cols + 1);
    const wh = h / (rows + 2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * (w / cols);
        const y = (r + 0.8) * (h / (rows + 1));
        const lit = Math.random() < glassChance;
        ctx.fillStyle = lit ? window : shade(wall, 0.85);
        ctx.fillRect(x, y, ww * 0.7, wh * 0.55);
        if (lit) {
          ctx.fillStyle = 'rgba(255,255,230,0.08)';
          ctx.fillRect(x, y, ww * 0.35, wh * 0.25);
        }
      }
    }
    if (shopFront) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(20, h * 0.78, w - 40, h * 0.2);
      ctx.fillStyle = '#cde7f5';
      ctx.fillRect(28, h * 0.8, w - 56, h * 0.14);
    }
  }, 1, 1);
}

function brick(a, b) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6a3a32';
    ctx.fillRect(0, 0, w, h);
    const bh = 10, bw = 22;
    for (let y = 0, row = 0; y < h; y += bh, row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < w; x += bw) {
        ctx.fillStyle = Math.random() > 0.5 ? a : b;
        ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
      }
    }
    // windows
    ctx.fillStyle = '#1c2228';
    for (let y = 24; y < h - 20; y += 48) {
      for (let x = 16; x < w - 16; x += 40) ctx.fillRect(x, y, 16, 22);
    }
  }, 2, 3);
}

function shade(hex, m) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor(((n >> 16) & 255) * m);
  const g = Math.floor(((n >> 8) & 255) * m);
  const b = Math.floor((n & 255) * m);
  return `rgb(${r},${g},${b})`;
}

export function makeWaterMaterial() {
  const tex = getTexture('water');
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0x2e6d80,
    roughness: 0.22,
    metalness: 0.15,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });
  mat.userData.scroll = true;
  return mat;
}
