import * as THREE from 'three';
import { SKIN_TONES, HAIR_COLORS } from '../config.js';

export const DEFAULT_LOOK = {
  gender: 'male',
  skin: 1,
  hair: 0,
  hairStyle: 'short',
  top: 'jacket',
  bottom: 'trousers',
  topColor: '#1b3a5f',
  bottomColor: '#1c1c1c',
  shoeColor: '#111111',
};

const TOPS = ['tee', 'jacket', 'hoodie', 'coat', 'shirt'];
const BOTTOMS = ['trousers', 'jeans', 'skirt'];
const HAIRS = ['short', 'crop', 'long', 'bun', 'ponytail', 'slick'];

export const OPTIONS = { TOPS, BOTTOMS, HAIRS, SKIN_TONES, HAIR_COLORS };

export function createCharacter(look = DEFAULT_LOOK, detail = 'high') {
  const l = { ...DEFAULT_LOOK, ...look };
  const g = new THREE.Group();
  g.userData.look = l;
  g.userData.phase = Math.random() * Math.PI * 2;
  rebuildCharacter(g, l, detail);
  return g;
}

export function rebuildCharacter(root, look, detail = 'high') {
  // keep root transform
  while (root.children.length) {
    const c = root.children[0];
    root.remove(c);
    c.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  const l = { ...DEFAULT_LOOK, ...look };
  root.userData.look = l;
  const female = l.gender === 'female';
  const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color(SKIN_TONES[l.skin] || SKIN_TONES[1]), roughness: 0.7 });
  const top = new THREE.MeshStandardMaterial({ color: new THREE.Color(l.topColor), roughness: 0.65 });
  const bottom = new THREE.MeshStandardMaterial({ color: new THREE.Color(l.bottomColor), roughness: 0.7 });
  const shoe = new THREE.MeshStandardMaterial({ color: new THREE.Color(l.shoeColor), roughness: 0.5 });
  const hair = new THREE.MeshStandardMaterial({ color: new THREE.Color(HAIR_COLORS[l.hair] || HAIR_COLORS[0]), roughness: 0.8 });
  const segs = detail === 'high' ? 10 : 6;

  const scaleY = female ? 0.97 : 1;
  const sh = female ? 0.28 : 0.34; // shoulder half-width
  const hip = female ? 0.22 : 0.18;

  const hips = new THREE.Group();
  hips.position.y = 0.92 * scaleY;
  root.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);
  const chestW = l.top === 'coat' ? sh * 2.4 : sh * 2.15;
  const chest = mesh(box(chestW, female ? 0.48 : 0.55, 0.22), top);
  chest.position.y = 0.38;
  torso.add(chest);
  if (l.top === 'jacket' || l.top === 'coat') {
    const lapel = mesh(box(chestW * 1.05, 0.46, 0.26), top);
    lapel.position.y = 0.36;
    torso.add(lapel);
  }
  if (l.top === 'hoodie') {
    const hood = mesh(new THREE.SphereGeometry(0.16, segs, segs), top);
    hood.position.set(0, 0.62, -0.05);
    torso.add(hood);
  }

  const neck = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, segs), skin);
  neck.position.y = 0.68;
  torso.add(neck);
  const head = mesh(new THREE.SphereGeometry(female ? 0.125 : 0.135, segs, segs), skin);
  head.position.y = 0.82;
  torso.add(head);
  addHair(torso, l.hairStyle, hair, female, segs);
  // simple face
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const eyeL = mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeM);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.045, 0.84, 0.11);
  eyeR.position.set(0.045, 0.84, 0.11);
  torso.add(eyeL, eyeR);

  function arm(side) {
    const a = new THREE.Group();
    a.position.set(side * sh, 0.55, 0);
    const upper = mesh(new THREE.CapsuleGeometry(0.055, 0.26, 4, segs), top);
    upper.position.y = -0.16;
    a.add(upper);
    const lowerG = new THREE.Group();
    lowerG.position.y = -0.32;
    const lower = mesh(new THREE.CapsuleGeometry(0.048, 0.24, 4, segs), l.top === 'tee' ? skin : top);
    lower.position.y = -0.14;
    lowerG.add(lower);
    const hand = mesh(new THREE.SphereGeometry(0.05, 6, 6), skin);
    hand.position.y = -0.30;
    lowerG.add(hand);
    a.add(lowerG);
    a.userData.lower = lowerG;
    return a;
  }
  const armL = arm(-1), armR = arm(1);
  torso.add(armL, armR);

  function leg(side) {
    const a = new THREE.Group();
    a.position.set(side * hip, 0, 0);
    const isSkirt = l.bottom === 'skirt' && female;
    const upper = mesh(new THREE.CapsuleGeometry(0.07, 0.36, 4, segs), bottom);
    upper.position.y = -0.22;
    a.add(upper);
    const lowerG = new THREE.Group();
    lowerG.position.y = -0.42;
    const lower = mesh(new THREE.CapsuleGeometry(0.055, 0.34, 4, segs), bottom);
    lower.position.y = -0.2;
    lowerG.add(lower);
    const foot = mesh(box(0.1, 0.07, 0.2), shoe);
    foot.position.set(0, -0.40, 0.04);
    lowerG.add(foot);
    a.add(lowerG);
    a.userData.lower = lowerG;
    if (isSkirt && side > 0) {
      const skirt = mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.32, 10), bottom);
      skirt.position.set(-side * hip, -0.18, 0);
      a.add(skirt);
    }
    return a;
  }
  const legL = leg(-1), legR = leg(1);
  hips.add(legL, legR);

  root.userData.rig = { hips, torso, armL, armR, legL, legR };
  root.userData.height = 1.75 * scaleY;
}

function addHair(torso, style, mat, female, segs) {
  const y = 0.90;
  if (style === 'crop') {
    const m = mesh(new THREE.SphereGeometry(0.14, segs, segs, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    m.position.y = y;
    m.scale.set(1.02, 0.55, 1.02);
    torso.add(m);
  } else if (style === 'long' || style === 'ponytail') {
    const cap = mesh(new THREE.SphereGeometry(0.145, segs, segs, 0, Math.PI * 2, 0, Math.PI / 1.6), mat);
    cap.position.y = y;
    torso.add(cap);
    const fall = mesh(new THREE.CapsuleGeometry(0.08, style === 'ponytail' ? 0.35 : 0.28, 4, 8), mat);
    fall.position.set(0, 0.62, -0.12);
    fall.rotation.x = 0.3;
    torso.add(fall);
  } else if (style === 'bun') {
    const cap = mesh(new THREE.SphereGeometry(0.14, segs, segs, 0, Math.PI * 2, 0, Math.PI / 1.7), mat);
    cap.position.y = y;
    torso.add(cap);
    const bun = mesh(new THREE.SphereGeometry(0.08, segs, segs), mat);
    bun.position.set(0, 0.98, -0.08);
    torso.add(bun);
  } else if (style === 'slick') {
    const cap = mesh(new THREE.SphereGeometry(0.138, segs, segs, 0, Math.PI * 2, 0, Math.PI / 1.8), mat);
    cap.position.y = y + 0.01;
    cap.scale.set(1, 0.7, 1.05);
    torso.add(cap);
  } else {
    const cap = mesh(new THREE.SphereGeometry(0.145, segs, segs, 0, Math.PI * 2, 0, Math.PI / 1.55), mat);
    cap.position.y = y;
    torso.add(cap);
  }
}

function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

export function animateCharacter(root, dt, moving, speed, turning = 0) {
  const rig = root.userData.rig;
  if (!rig) return;
  const run = speed > 4.2;
  const cadence = run ? 9 : 7;
  if (moving) root.userData.phase += dt * cadence * Math.min(1.4, speed / 3);
  const p = root.userData.phase;
  const amp = moving ? (run ? 0.85 : 0.55) : 0.04;
  const s = Math.sin(p) * amp;
  rig.legL.rotation.x = s;
  rig.legR.rotation.x = -s;
  rig.armL.rotation.x = -s * 0.8;
  rig.armR.rotation.x = s * 0.8;
  if (rig.legL.userData.lower) rig.legL.userData.lower.rotation.x = Math.max(0, -s) * 0.6;
  if (rig.legR.userData.lower) rig.legR.userData.lower.rotation.x = Math.max(0, s) * 0.6;
  rig.torso.rotation.y = moving ? Math.sin(p) * 0.08 : 0;
  rig.torso.position.y = moving ? Math.abs(Math.sin(p)) * 0.03 : 0;
  rig.hips.rotation.z = turning * 0.15;
}

export function applyLook(root, look) {
  rebuildCharacter(root, look, root.userData.detail || 'high');
}
