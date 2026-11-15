export function createInput(canvas) {
  const state = {
    keys: Object.create(null),
    mx: 0, my: 0, lookX: 0, lookY: 0,
    pointerLocked: false,
    joy: { x: 0, y: 0, active: false },
    lookDrag: { x: 0, y: 0, down: false },
    enter: false,
    run: false,
    brake: false,
    camYaw: 0,
    camPitch: 0.32,
  };

  window.addEventListener('keydown', (e) => {
    state.keys[e.code] = true;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === 'KeyE' || e.code === 'Enter') state.enter = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') state.run = true;
    if (e.code === 'Space') state.brake = true;
  });
  window.addEventListener('keyup', (e) => {
    state.keys[e.code] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') state.run = false;
    if (e.code === 'Space') state.brake = false;
  });

  canvas.addEventListener('click', () => {
    if (!('ontouchstart' in window)) canvas.requestPointerLock?.();
  });
  document.addEventListener('pointerlockchange', () => {
    state.pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (state.pointerLocked) {
      state.camYaw -= e.movementX * 0.0035;
      state.camPitch = clamp(state.camPitch + e.movementY * 0.0025, -0.15, 1.1);
    } else if (state.lookDrag.down) {
      state.camYaw -= e.movementX * 0.006;
      state.camPitch = clamp(state.camPitch + e.movementY * 0.004, -0.15, 1.1);
    }
  });

  // Look drag on the right half (desktop without pointer lock, and mobile)
  canvas.addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('.touch, .ui, .menu, .creator, button, input, select')) return;
    if (e.clientX > window.innerWidth * 0.42) {
      state.lookDrag.down = true;
      canvas.setPointerCapture?.(e.pointerId);
    }
  });
  window.addEventListener('pointerup', () => { state.lookDrag.down = false; });

  state.consumeEnter = () => {
    if (state.enter) { state.enter = false; return true; }
    return false;
  };

  state.wasd = () => {
    let x = 0, y = 0;
    if (state.keys.KeyW || state.keys.ArrowUp) y += 1;
    if (state.keys.KeyS || state.keys.ArrowDown) y -= 1;
    if (state.keys.KeyA || state.keys.ArrowLeft) x -= 1;
    if (state.keys.KeyD || state.keys.ArrowRight) x += 1;
    if (state.joy.active) { x += state.joy.x; y += -state.joy.y; }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  };

  return state;
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export function bindTouch(input) {
  const stick = document.getElementById('stick');
  const knob = document.getElementById('knob');
  if (!stick) return;
  const rectOf = () => stick.getBoundingClientRect();
  let pid = null;
  const setFrom = (cx, cy) => {
    const r = rectOf();
    const px = cx - (r.left + r.width / 2);
    const py = cy - (r.top + r.height / 2);
    const m = Math.hypot(px, py);
    const max = r.width * 0.38;
    const k = m > max ? max / m : 1;
    const x = (px * k) / max;
    const y = (py * k) / max;
    input.joy.x = x;
    input.joy.y = y;
    input.joy.active = true;
    knob.style.transform = `translate(${px * k}px, ${py * k}px)`;
  };
  const end = () => {
    pid = null;
    input.joy.x = input.joy.y = 0;
    input.joy.active = false;
    knob.style.transform = 'translate(0,0)';
  };
  stick.addEventListener('pointerdown', (e) => {
    pid = e.pointerId;
    stick.setPointerCapture(pid);
    setFrom(e.clientX, e.clientY);
    e.preventDefault();
  });
  stick.addEventListener('pointermove', (e) => {
    if (pid !== e.pointerId) return;
    setFrom(e.clientX, e.clientY);
  });
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);

  const bindBtn = (id, on, off) => {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (e) => { e.preventDefault(); on(); };
    const up = (e) => { e.preventDefault(); off && off(); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
  };
  bindBtn('btn-enter', () => { input.enter = true; });
  bindBtn('btn-run', () => { input.run = true; }, () => { input.run = false; });
  bindBtn('btn-brake', () => { input.brake = true; }, () => { input.brake = false; });
}
