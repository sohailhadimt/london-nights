import * as THREE from 'three';
import { PERFORMANCE, SPAWN, LANDMARKS, isMobile, CAR_COLORS } from './config.js';
import { damp, dampAngle, dist2 } from './utils.js';
import { buildCity, nearestRoad, findWalkableNear, groundHeight } from './world/city.js';
import { resolveCircle, insideAny } from './world/collision.js';
import { createCharacter, animateCharacter, applyLook, DEFAULT_LOOK } from './player/character.js';
import { createCar, createBus, driveCar, followPath, recolorCar, CAR_TYPES } from './vehicles/vehicles.js';
import { createPedestrians, updatePedestrians, createTraffic, updateTraffic } from './ai/crowd.js';
import { SHOPS, addPlaceMarkers, createInterior, dressInterior, nearestPlace } from './places/places.js';
import { createInput, bindTouch } from './input.js';
import * as UI from './ui/ui.js';

export async function startGame(look, { skipIntro } = {}) {
  const mobile = isMobile();
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !mobile, powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? PERFORMANCE.pixelRatio.mobile : PERFORMANCE.pixelRatio.desktop));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  addLights(scene, mobile);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.15, 900);
  const input = createInput(canvas);
  bindTouch(input);

  UI.setLoad('Laying the streets of the City…', 0.35);
  const world = await buildCity(scene);
  UI.setLoad('Opening shops and stations…', 0.7);
  addPlaceMarkers(scene, world);
  const interior = createInterior(scene);

  // spawn
  const blocked = (x, z) => !!insideAny(world.hash, x, z, 'building');
  const spawn = findWalkableNear(world, SPAWN.x, SPAWN.z, blocked);
  // if still blocked, try a few known plaza points
  let sx = spawn.x, sz = spawn.z;
  if (blocked(sx, sz)) {
    for (const p of [[20, 220], [60, 200], [-20, 200], [0, 180], [120, 200]]) {
      const q = findWalkableNear(world, p[0], p[1], blocked);
      if (!blocked(q.x, q.z)) { sx = q.x; sz = q.z; break; }
    }
  }

  const player = createCharacter(look || DEFAULT_LOOK, 'high');
  player.position.set(sx, groundHeight(world, sx, sz), sz);
  scene.add(player);

  const peds = createPedestrians(scene, world, mobile ? PERFORMANCE.pedCount.mobile : PERFORMANCE.pedCount.desktop);
  const traffic = createTraffic(scene, world, mobile ? PERFORMANCE.trafficCount.mobile : PERFORMANCE.trafficCount.desktop);

  // parked player cars near spawn
  const parked = [];
  const parkSpots = offsetSpots(-40, 125, 8);
  CAR_TYPES.forEach((t, i) => {
    const spot = parkSpots[i] || { x: sx + 6 + i * 3.5, z: sz + 8 };
    const car = createCar(t.id, {
      x: spot.x, z: spot.z,
      heading: Math.PI * 0.15 * (i - 3),
      color: CAR_COLORS[i % CAR_COLORS.length],
      parked: true,
      wheelStyle: 'sport',
    });
    // nudge out of buildings
    const pos = { x: car.position.x, z: car.position.z };
    resolveCircle(world.hash, pos, car.userData.radius || 2);
    car.position.set(pos.x, groundHeight(world, pos.x, pos.z), pos.z);
    scene.add(car);
    parked.push(car);
  });

  const bus = createBus();
  if (world.busPath.length > 4) {
    const p0 = world.busPath[0];
    bus.position.set(p0[0], 0, p0[1]);
    bus.position.y = groundHeight(world, p0[0], p0[1]);
    bus.userData.pathI = 1;
  } else {
    bus.position.set(sx + 20, 0, sz + 30);
  }
  scene.add(bus);

  const sun = scene.getObjectByName('sun');
  const clock = new THREE.Clock();
  const state = {
    mode: 'walk', // walk | drive | interior | tube
    vehicle: null,
    shop: null,
    look: { ...(look || DEFAULT_LOOK) },
    camDist: 4.6,
    heading: 0,
    fade: 0,
    hint: 8,
  };

  UI.hideLoader();
  UI.showHud();
  if (!skipIntro) {
    UI.toast('Welcome to London. The Shard is just behind you.');
  }

  const mapCanvas = document.getElementById('minimap');
  const mapCtx = mapCanvas?.getContext('2d');

  function playerPos() { return { x: player.position.x, z: player.position.z }; }

  function collideVehicle(root) {
    const pos = { x: root.position.x, z: root.position.z };
    const hit = resolveCircle(world.hash, pos, (root.userData.radius || 1.8) * 0.85);
    const water = insideAny(world.hash, pos.x, pos.z, 'water');
    if (water) {
      const road = nearestRoad(world, pos.x, pos.z, true);
      if (!(road && road.dist < (road.road.w || 8) * 0.7) && !(road && road.road.bridge && road.dist < 14)) {
        root.position.x = pos.x;
        root.position.z = pos.z;
        return true;
      }
    }
    if (hit) {
      root.position.x = pos.x;
      root.position.z = pos.z;
      return true;
    }
    return false;
  }

  function enterVehicle(car) {
    state.mode = 'drive';
    state.vehicle = car;
    car.userData.playerControlled = true;
    player.visible = false;
    UI.toast(`${car.userData.type?.name || 'Car'} — ${car.userData.isBus ? 'hang on' : 'drive nice'}. F to customise, E to get out.`);
  }

  function exitVehicle() {
    const car = state.vehicle;
    if (!car) return;
    const side = 1.6;
    const hx = Math.cos(car.userData.heading);
    const hz = -Math.sin(car.userData.heading);
    const pos = { x: car.position.x + hx * side, z: car.position.z + hz * side };
    resolveCircle(world.hash, pos, 0.4);
    player.position.set(pos.x, groundHeight(world, pos.x, pos.z), pos.z);
    player.visible = true;
    car.userData.playerControlled = false;
    car.userData.speed = 0;
    state.vehicle = null;
    state.mode = 'walk';
  }

  function enterShop(shop) {
    state.mode = 'interior';
    state.shop = shop;
    state._out = { x: player.position.x, z: player.position.z, y: player.rotation.y };
    dressInterior(interior, shop);
    interior.visible = true;
    player.position.set(0, -80, 3.2);
    player.rotation.y = Math.PI;
    if (shop.kind === 'clothes') {
      UI.showClothes(state.look, (look) => {
        state.look = look;
        applyLook(player, look);
      });
    } else {
      UI.toast(shop.blurb);
    }
  }

  function exitShop() {
    interior.visible = false;
    if (state._out) {
      player.position.set(state._out.x, 0, state._out.z);
      player.rotation.y = state._out.y;
    }
    state.shop = null;
    state.mode = 'walk';
    UI.hideModal();
  }

  function travelTo(station) {
    const pos = findWalkableNear(world, station.x + 4, station.z + 4, blocked);
    player.position.set(pos.x, groundHeight(world, pos.x, pos.z), pos.z);
    state.mode = 'walk';
    UI.toast(`You come out at ${station.n}.`);
  }

  function nearestParked() {
    const p = state.mode === 'drive' ? state.vehicle.position : player.position;
    let best = null, bestD = 5.5;
    for (const c of [...parked, bus, ...traffic]) {
      if (!c.userData.driveable) continue;
      const d = Math.hypot(c.position.x - p.x, c.position.z - p.z);
      const reach = c.userData.isBus ? 7 : 5.5;
      if (d < reach && d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function interact() {
    if (state.mode === 'interior') { exitShop(); return; }
    if (state.mode === 'drive') { exitVehicle(); return; }
    const p = playerPos();
    const shop = nearestPlace(p.x, p.z, SHOPS, 6);
    if (shop) { enterShop(shop); return; }
    const st = nearestPlace(p.x, p.z, world.stations, 8);
    if (st) {
      UI.showTube(world.stations, (s) => travelTo(s));
      return;
    }
    const car = nearestParked();
    if (car) enterVehicle(car);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF' && state.vehicle && !state.vehicle.userData.isBus) {
      UI.showCarCustom(state.vehicle, (color, wheels) => recolorCar(state.vehicle, color, wheels));
    }
    if (e.code === 'KeyH') UI.toast('WASD walk · Shift run · mouse look · E enter/exit · F customise car · click to lock mouse');
    if (e.code === 'Escape') {
      document.exitPointerLock?.();
      UI.hideModal();
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  });

  let lastPlace = '';
  function tickPlace() {
    const p = state.mode === 'drive' ? state.vehicle.position : player.position;
    const road = nearestRoad(world, p.x, p.z, true);
    let name = road?.road?.name || '';
    // landmarks
    const dShard = Math.hypot(p.x - LANDMARKS.shard.x, p.z - LANDMARKS.shard.z);
    const dGherkin = Math.hypot(p.x - LANDMARKS.gherkin.x, p.z - LANDMARKS.gherkin.z);
    if (dShard < 80) name = name ? `${name} · The Shard` : 'The Shard';
    else if (dGherkin < 90) name = name ? `${name} · The Gherkin` : 'The Gherkin';
    const st = nearestPlace(p.x, p.z, world.stations, 40);
    if (st && !name) name = st.n;
    if (name !== lastPlace) { UI.setPlace(name); lastPlace = name; }
  }

  function updatePrompt() {
    if (state.mode === 'interior') {
      UI.setPrompt('E  Leave shop');
      return;
    }
    if (state.mode === 'drive') {
      UI.setPrompt(state.vehicle.userData.isBus ? 'E  Hop off' : 'E  Get out   ·   F  Customise');
      return;
    }
    const p = playerPos();
    const shop = nearestPlace(p.x, p.z, SHOPS, 6);
    if (shop) { UI.setPrompt(`E  Enter ${shop.name}`); return; }
    const st = nearestPlace(p.x, p.z, world.stations, 8);
    if (st) { UI.setPrompt(`E  ${st.n} Underground`); return; }
    const car = nearestParked();
    if (car) { UI.setPrompt(`E  ${car.userData.isBus ? 'Ride the bus' : 'Drive the ' + (car.userData.type?.name || 'car')}`); return; }
    UI.setPrompt('');
  }

  function followCamera(dt, target, dist, height, lookHeight) {
    const yaw = input.camYaw;
    const pitch = input.camPitch;
    const ox = Math.sin(yaw) * Math.cos(pitch) * dist;
    const oy = Math.sin(pitch) * dist + height;
    const oz = Math.cos(yaw) * Math.cos(pitch) * dist;
    const desired = new THREE.Vector3(target.x + ox, target.y + oy, target.z + oz);
    camera.position.x = damp(camera.position.x, desired.x, 8, dt);
    camera.position.y = damp(camera.position.y, desired.y, 8, dt);
    camera.position.z = damp(camera.position.z, desired.z, 8, dt);
    camera.lookAt(target.x, target.y + lookHeight, target.z);
  }

  // kick camera behind spawn, looking north toward the river / City
  input.camYaw = Math.PI; // look south, toward The Shard
  const gy = groundHeight(world, sx, sz);
  camera.position.set(sx, gy + 6, sz - 8);
  camera.lookAt(sx, gy + 1.4, sz);

  function loop() {
    requestAnimationFrame(loop);
    let dt = clock.getDelta();
    if (dt > 0.05) dt = 0.05;

    if (input.consumeEnter()) interact();

    if (state.mode === 'walk' || state.mode === 'interior') {
      const wish = input.wasd();
      const running = input.run || input.keys.ShiftLeft;
      const speed = (running ? 6.6 : 3.4) * (wish.x || wish.y ? 1 : 0);
      if (speed) {
        const yaw = input.camYaw;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        const rx = Math.cos(yaw), rz = -Math.sin(yaw);
        const wx = fx * wish.y + rx * wish.x;
        const wz = fz * wish.y + rz * wish.x;
        const pos = { x: player.position.x + wx * speed * dt, z: player.position.z + wz * speed * dt };
        if (state.mode === 'interior') {
          pos.x = THREE.MathUtils.clamp(pos.x, -5.4, 5.4);
          pos.z = THREE.MathUtils.clamp(pos.z, -4.4, 4.4);
          // auto-exit at door
          if (pos.z > 4.2 && Math.abs(pos.x) < 0.8) exitShop();
        } else {
          resolveCircle(world.hash, pos, 0.35);
          const water = insideAny(world.hash, pos.x, pos.z, 'water');
          const road = nearestRoad(world, pos.x, pos.z, true);
          const onBridge = !!(road && road.road.bridge && road.dist < (road.road.w || 8) * 0.7 + 2);
          const onRoad = !!(road && road.dist < (road.road.w || 6) * 0.55);
          if (water && !onBridge && !onRoad) {
            // don't walk into the Thames
          } else {
            player.position.x = pos.x;
            player.position.z = pos.z;
          }
        }
        if (state.mode === 'walk') {
          const gy = groundHeight(world, player.position.x, player.position.z);
          player.position.y = THREE.MathUtils.damp(player.position.y, gy, 12, dt);
        }
        const heading = Math.atan2(wx, wz);
        player.rotation.y = dampAngle(player.rotation.y, heading, 12, dt);
        state.heading = player.rotation.y;
      }
      animateCharacter(player, dt, !!speed, speed || 0);
      const camTarget = player.position;
      if (state.mode === 'interior') followCamera(dt, camTarget, 3.6, 1.6, 1.2);
      else followCamera(dt, camTarget, 5.0, 2.1, 1.4);
      UI.setSpeedo(false);
    } else if (state.mode === 'drive' && state.vehicle) {
      const wish = input.wasd();
      const car = state.vehicle;
      if (car.userData.isBus && world.busPath.length) {
        // player can ride; still follows route, WASD ignored except exit
        followPath(car, world.busPath, dt, 9);
      } else {
        driveCar(car, {
          throttle: wish.y,
          steer: wish.x,
          brake: input.brake || input.keys.Space ? 1 : 0,
        }, dt, collideVehicle);
      }
      // keep camera behind the car, allow mouse yaw offset
      const baseYaw = car.userData.heading;
      // blend user look onto vehicle heading
      const yaw = input.camYaw;
      // slowly snap look behind car if not looking around
      if (!input.lookDrag.down && !input.pointerLocked) {
        input.camYaw = dampAngle(input.camYaw, baseYaw, 1.8, dt);
      }
      car.position.y = groundHeight(world, car.position.x, car.position.z);
      followCamera(dt, car.position, 8.2, 2.6, 1.2);
      const mph = Math.abs(car.userData.speed) * 2.237;
      UI.setSpeedo(true, mph, car.userData.speed < -0.5 ? 'R' : 'D');
      state.heading = car.userData.heading;
    }

    if (state.mode !== 'interior') {
      updatePedestrians(peds, world, playerPos(), dt);
      updateTraffic(traffic, world, state.vehicle ? state.vehicle.position : player.position, dt);
      if (!bus.userData.playerControlled && world.busPath.length) followPath(bus, world.busPath, dt, 8.5);
      bus.position.y = groundHeight(world, bus.position.x, bus.position.z);
      tickPlace();
      if (sun) {
        const t = state.mode === 'drive' ? state.vehicle.position : player.position;
        sun.position.set(t.x + 80, 140, t.z - 60);
        sun.target.position.set(t.x, 0, t.z);
        sun.target.updateMatrixWorld();
      }
    }
    updatePrompt();

    if (state.hint > 0) {
      state.hint -= dt;
      if (state.hint <= 0) UI.toast('Take a car from the plaza, or walk into a Tube entrance.');
    }

    // water scroll
    const water = scene.getObjectByName('thames');
    if (water?.material?.map) {
      water.material.map.offset.x += dt * 0.01;
      water.material.map.offset.y += dt * 0.006;
    }

    if (mapCtx && mapCanvas && state.mode !== 'interior') {
      const p = state.mode === 'drive' ? state.vehicle : player;
      UI.updateMinimap(mapCtx, world, {
        x: p.position.x, z: p.position.z, heading: state.mode === 'drive' ? state.vehicle.userData.heading : player.rotation.y,
      }, null, mapCanvas.width, mapCanvas.height);
    }

    renderer.render(scene, camera);
  }

  window.__LN = { scene, camera, player, world, input, state };
  loop();
  return { scene, camera, player, world };
}

function addLights(scene, mobile) {
  scene.add(new THREE.AmbientLight(0xdde7f0, 0.55));
  const hemi = new THREE.HemisphereLight(0xe7f2fa, 0xb0a48c, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3d8, 1.55);
  sun.name = 'sun';
  sun.position.set(80, 140, -60);
  sun.castShadow = true;
  const s = mobile ? 40 : 70;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 300;
  sun.shadow.mapSize.set(
    mobile ? PERFORMANCE.shadow.mobile : PERFORMANCE.shadow.desktop,
    mobile ? PERFORMANCE.shadow.mobile : PERFORMANCE.shadow.desktop,
  );
  sun.shadow.bias = -0.0003;
  scene.add(sun);
  scene.add(sun.target);
  // fill
  const fill = new THREE.DirectionalLight(0xb8d4e8, 0.45);
  fill.position.set(-40, 50, 30);
  scene.add(fill);
}

function offsetSpots(x, z, n) {
  const spots = [];
  for (let i = 0; i < n; i++) {
    spots.push({ x: x + 8 + (i % 4) * 5.2, z: z + 10 + Math.floor(i / 4) * 7 });
  }
  return spots;
}
