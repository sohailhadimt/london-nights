import { CAR_TYPES, WHEEL_STYLES } from '../vehicles/vehicles.js';
import { OPTIONS, DEFAULT_LOOK } from '../player/character.js';
import { CAR_COLORS, SKIN_TONES, TITLE } from '../config.js';

export function $(id) { return document.getElementById(id); }

export function setLoad(msg, pct) {
  const t = $('load-text');
  const b = $('load-bar');
  if (t) t.textContent = msg;
  if (b) b.style.width = `${Math.round(pct * 100)}%`;
}

export function hideLoader() {
  $('loader')?.classList.add('hidden');
}

export function showCreator() {
  $('creator')?.classList.remove('hidden');
}

export function hideCreator() {
  $('creator')?.classList.add('hidden');
}

export function showHud() {
  $('hud')?.classList.remove('hidden');
  if (matchMedia('(pointer: coarse)').matches || /iPhone|Android/i.test(navigator.userAgent)) {
    $('touch')?.classList.remove('hidden');
  }
}

export function setPrompt(text) {
  const el = $('prompt');
  if (!el) return;
  if (text) { el.textContent = text; el.classList.remove('hidden'); }
  else el.classList.add('hidden');
}

export function setSpeedo(show, mph, gear) {
  const el = $('speedo');
  if (!el) return;
  if (!show) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  $('speedo-num').textContent = String(Math.max(0, Math.round(mph)));
  $('speedo-gear').textContent = gear || 'D';
}

export function setPlace(text) {
  const el = $('place');
  if (el) el.textContent = text || '';
}

export function showTube(stations, onPick, onClose) {
  const modal = $('modal');
  modal.classList.remove('hidden');
  modal.innerHTML = `
    <div class="panel">
      <h2>Underground</h2>
      <p class="muted">Choose a station. You'll come out at the entrance.</p>
      <div class="station-list">
        ${stations.map((s) => `<button class="station" data-n="${s.n}">${s.n}</button>`).join('')}
      </div>
      <button class="ghost" id="tube-cancel">Stay here</button>
    </div>`;
  modal.querySelectorAll('.station').forEach((btn) => {
    btn.addEventListener('click', () => {
      const st = stations.find((s) => s.n === btn.dataset.n);
      modal.classList.add('hidden');
      onPick(st);
    });
  });
  $('tube-cancel').onclick = () => { modal.classList.add('hidden'); onClose?.(); };
}

export function showClothes(look, onChange, onClose) {
  const modal = $('modal');
  modal.classList.remove('hidden');
  modal.innerHTML = `
    <div class="panel">
      <h2>Southwark Outfitters</h2>
      <p class="muted">Try something on. It's all on the house today.</p>
      <label>Top
        <select id="c-top">${OPTIONS.TOPS.map((t) => `<option ${t===look.top?'selected':''}>${t}</option>`).join('')}</select>
      </label>
      <label>Bottom
        <select id="c-bot">${OPTIONS.BOTTOMS.map((t) => `<option ${t===look.bottom?'selected':''}>${t}</option>`).join('')}</select>
      </label>
      <label>Top colour <input type="color" id="c-tc" value="${look.topColor}"></label>
      <label>Bottom colour <input type="color" id="c-bc" value="${look.bottomColor}"></label>
      <div class="row">
        <button id="c-done">Done</button>
      </div>
    </div>`;
  const fire = () => onChange({
    ...look,
    top: $('c-top').value,
    bottom: $('c-bot').value,
    topColor: $('c-tc').value,
    bottomColor: $('c-bc').value,
  });
  $('c-top').onchange = fire;
  $('c-bot').onchange = fire;
  $('c-tc').oninput = fire;
  $('c-bc').oninput = fire;
  $('c-done').onclick = () => { modal.classList.add('hidden'); onClose?.(); };
}

export function showCarCustom(car, onChange, onClose) {
  const modal = $('modal');
  modal.classList.remove('hidden');
  const color = car.userData.color || '#b10b0b';
  const wheel = car.userData.wheelStyle || 'standard';
  modal.innerHTML = `
    <div class="panel">
      <h2>${car.userData.type?.name || 'Car'} — Customise</h2>
      <p class="muted">Paint and wheels. This one is yours to keep.</p>
      <div class="swatches" id="swatches">
        ${CAR_COLORS.map((c) => `<button class="swatch ${c===color?'on':''}" data-c="${c}" style="background:${c}"></button>`).join('')}
      </div>
      <label>Wheels
        <select id="wheels">${WHEEL_STYLES.map((w) => `<option value="${w.id}" ${w.id===wheel?'selected':''}>${w.name}</option>`).join('')}</select>
      </label>
      <div class="row">
        <button id="car-done">Done</button>
      </div>
    </div>`;
  modal.querySelectorAll('.swatch').forEach((b) => {
    b.onclick = () => {
      modal.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onChange(b.dataset.c, $('wheels').value);
    };
  });
  $('wheels').onchange = () => onChange(modal.querySelector('.swatch.on')?.dataset.c || color, $('wheels').value);
  $('car-done').onclick = () => { modal.classList.add('hidden'); onClose?.(); };
}

export function hideModal() {
  $('modal')?.classList.add('hidden');
}

export function toast(msg, ms = 2400) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), ms);
}

export function readCreatorForm() {
  return {
    gender: document.querySelector('input[name="gender"]:checked')?.value || 'male',
    skin: Number($('skin')?.value || 1),
    hair: Number($('hair')?.value || 0),
    hairStyle: $('hairstyle')?.value || 'short',
    top: $('top')?.value || 'jacket',
    bottom: $('bottom')?.value || 'trousers',
    topColor: $('topcolor')?.value || '#1b3a5f',
    bottomColor: $('botcolor')?.value || '#1c1c1c',
    shoeColor: '#111111',
  };
}

export function fillCreator() {
  const skin = $('skin');
  if (skin) {
    skin.max = String(SKIN_TONES.length - 1);
    skin.value = '1';
  }
  const hs = $('hairstyle');
  if (hs) hs.innerHTML = OPTIONS.HAIRS.map((h) => `<option>${h}</option>`).join('');
  const top = $('top');
  if (top) top.innerHTML = OPTIONS.TOPS.map((h) => `<option ${h==='jacket'?'selected':''}>${h}</option>`).join('');
  const bot = $('bottom');
  if (bot) bot.innerHTML = OPTIONS.BOTTOMS.map((h) => `<option>${h}</option>`).join('');
}

export function updateMinimap(ctx, world, player, cars, w, h) {
  const scale = 0.22;
  const cx = w / 2, cy = h / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(12,18,24,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-player.heading || 0);
  ctx.translate(-player.x * scale, -player.z * scale);
  ctx.strokeStyle = 'rgba(200,200,200,0.35)';
  ctx.lineWidth = 1.2;
  for (const r of world.roads) {
    if (!r.p || r.p.length < 2) continue;
    if (r.k === 'footway' || r.k === 'steps' || r.k === 'path') continue;
    ctx.beginPath();
    ctx.moveTo(r.p[0][0] * scale, r.p[0][1] * scale);
    for (let i = 1; i < r.p.length; i++) ctx.lineTo(r.p[i][0] * scale, r.p[i][1] * scale);
    ctx.stroke();
  }
  ctx.fillStyle = '#4aa3c8';
  for (const water of world.water) {
    if (!water.p || water.p.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(water.p[0][0] * scale, water.p[0][1] * scale);
    for (let i = 1; i < water.p.length; i++) ctx.lineTo(water.p[i][0] * scale, water.p[i][1] * scale);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#e8c36a';
  for (const s of world.stations) {
    ctx.fillRect(s.x * scale - 2, s.z * scale - 2, 4, 4);
  }
  ctx.restore();
  // player
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 7);
  ctx.lineTo(cx + 5, cy + 6);
  ctx.lineTo(cx - 5, cy + 6);
  ctx.closePath();
  ctx.fill();
}

export { TITLE, DEFAULT_LOOK, CAR_TYPES };
