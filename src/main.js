import './style.css';
import { TITLE, isMobile } from './config.js';
import { createCharacter, applyLook, DEFAULT_LOOK } from './player/character.js';
import * as UI from './ui/ui.js';
import { startGame } from './game.js';
import * as THREE from 'three';

document.title = TITLE;
UI.fillCreator();

const params = new URLSearchParams(location.search);
const autoplay = params.get('play') === '1' || params.get('play') === 'true';

let preview, previewChar, previewRaf;

function startPreview() {
  const canvas = document.getElementById('creator-view');
  if (!canvas) return;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(canvas.clientWidth || 280, canvas.clientHeight || 360, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.1));
  const d = new THREE.DirectionalLight(0xfff1d0, 1.1);
  d.position.set(2, 4, 3);
  scene.add(d);
  const cam = new THREE.PerspectiveCamera(35, (canvas.clientWidth || 280) / (canvas.clientHeight || 360), 0.1, 20);
  cam.position.set(0, 1.2, 3.4);
  cam.lookAt(0, 0.9, 0);
  previewChar = createCharacter(DEFAULT_LOOK, 'high');
  scene.add(previewChar);
  const clock = new THREE.Clock();
  const loop = () => {
    previewRaf = requestAnimationFrame(loop);
    previewChar.rotation.y += clock.getDelta() * 0.4;
    renderer.render(scene, cam);
  };
  loop();
  preview = { renderer, scene, cam, apply: (look) => applyLook(previewChar, look) };
}

function bindCreator() {
  const update = () => preview?.apply(UI.readCreatorForm());
  ['skin', 'hair', 'hairstyle', 'top', 'bottom', 'topcolor', 'botcolor'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', update);
    document.getElementById(id)?.addEventListener('change', update);
  });
  document.querySelectorAll('input[name="gender"]').forEach((el) => el.addEventListener('change', update));
  document.getElementById('play-btn')?.addEventListener('click', async () => {
    const look = UI.readCreatorForm();
    UI.hideCreator();
    if (previewRaf) cancelAnimationFrame(previewRaf);
    UI.setLoad('Stepping out onto London Bridge…', 0.15);
    document.getElementById('loader')?.classList.remove('hidden');
    try {
      await startGame(look);
    } catch (err) {
      console.error(err);
      UI.setLoad('Something went wrong building the city. Try a refresh.', 0);
      alert(err.message || String(err));
    }
  });
}

async function boot() {
  UI.setLoad('Loading central London…', 0.1);
  if (autoplay) {
    try {
      await startGame(DEFAULT_LOOK, { skipIntro: true });
    } catch (err) {
      console.error(err);
      UI.setLoad('Could not start the game.', 0);
    }
    return;
  }
  UI.hideLoader();
  UI.showCreator();
  startPreview();
  bindCreator();
}

boot();
