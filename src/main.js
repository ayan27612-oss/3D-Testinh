import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8e6);
scene.fog = new THREE.Fog(0x87b8e6, 70, 160);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.4;
world.defaultContactMaterial.restitution = 0.25;

const bouncyMat = new CANNON.Material('bouncy');
world.addContactMaterial(
  new CANNON.ContactMaterial(bouncyMat, world.defaultMaterial, {
    friction: 0.3,
    restitution: 1.2,
  })
);

scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x3a5f3a, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(28, 45, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45;
sun.shadow.camera.bottom = -45;
sun.shadow.camera.far = 150;
scene.add(sun);

const palette = [0xe74c3c, 0xe67e22, 0xf1c40f, 0x2ecc71, 0x1abc9c, 0x3498db, 0x9b59b6, 0xecf0f1];
const dynamicEntries = [];
const removalQueue = new Set();

const objCountEl = document.getElementById('obj-count');
const scoreCountEl = document.getElementById('score-count');
let score = 0;

function staticBox(x, y, z, sx, sy, sz, color, opacity = 1) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshStandardMaterial({ color, transparent: opacity < 1, opacity, roughness: 0.85 })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)) });
  body.position.set(x, y, z);
  world.addBody(body);
  return { mesh, body };
}

const ground = staticBox(0, -0.25, 0, 60, 0.5, 60, 0x4a7d4a);
const grid = new THREE.GridHelper(60, 60, 0x2a5a2a, 0x3a6a3a);
grid.position.y = 0.02;
scene.add(grid);

staticBox(0, 4, -30.5, 62, 8, 1, 0x7a9bbd, 0.25);
staticBox(0, 4, 30.5, 62, 8, 1, 0x7a9bbd, 0.25);
staticBox(-30.5, 4, 0, 1, 8, 62, 0x7a9bbd, 0.25);
staticBox(30.5, 4, 0, 1, 8, 62, 0x7a9bbd, 0.25);

staticBox(-16, 2, 6, 10, 0.5, 7, 0x8d6e4f);
const ramp = staticBox(-9, 1.05, 6, 6.5, 0.4, 7, 0xa1886a);
ramp.body.quaternion.setFromEuler(0, 0, -0.32);
ramp.mesh.rotation.z = -0.32;

staticBox(-16, 6, -10, 8, 0.5, 8, 0x8d6e4f);
staticBox(15, 6.5, -10, 8, 0.5, 8, 0x6d8a4f);

const trampolineMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(4, 4, 0.6, 32),
  new THREE.MeshStandardMaterial({ color: 0xff5577, roughness: 0.4, emissive: 0x330011 })
);
trampolineMesh.position.set(14, 0.3, 2);
trampolineMesh.receiveShadow = true;
scene.add(trampolineMesh);
const trampolineBody = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Cylinder(4, 4, 0.6, 16),
  material: bouncyMat,
});
trampolineBody.position.set(14, 0.3, 2);
world.addBody(trampolineBody);

function spawnBox(x, y, z, size, mass, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const body = new CANNON.Body({
    mass,
    shape: new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2)),
    position: new CANNON.Vec3(x, y, z),
  });
  world.addBody(body);
  scene.add(mesh);
  dynamicEntries.push({ mesh, body, collectible: false });
  return { mesh, body };
}

for (let row = 0; row < 3; row++) {
  const count = 3 - row;
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < count; j++) {
      spawnBox(
        2 + row * 1.4 + i * 1.4 - 1.4,
        0.8 + row * 1.4,
        -14 + j * 1.4 - (count - 1) * 0.7,
        1.25,
        1.5,
        palette[(row + i + j) % palette.length]
      );
    }
  }
}

const playerMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 24),
  new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.35, metalness: 0.25 })
);
playerMesh.castShadow = true;
scene.add(playerMesh);
const playerBody = new CANNON.Body({
  mass: 5,
  shape: new CANNON.Sphere(1),
  position: new CANNON.Vec3(0, 4, 12),
  linearDamping: 0.22,
  angularDamping: 0.35,
});
playerBody.addEventListener('collide', (e) => {
  const c = e.contact;
  if (c.bi.id === playerBody.id && c.ni.y < -0.4) lastGroundedAt = clock.elapsedTime;
  else if (c.bj.id === playerBody.id && c.ni.y > 0.4) lastGroundedAt = clock.elapsedTime;
});
world.addBody(playerBody);

function spawnSphere(x, y, z, radius, mass, color, velocity) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 18),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 })
  );
  mesh.castShadow = true;
  const body = new CANNON.Body({
    mass,
    shape: new CANNON.Sphere(radius),
    position: new CANNON.Vec3(x, y, z),
  });
  if (velocity) body.velocity.set(velocity.x, velocity.y, velocity.z);
  world.addBody(body);
  scene.add(mesh);
  dynamicEntries.push({ mesh, body, collectible: false });
  return body;
}

function spawnCollectible() {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.6, 1),
    new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0x994400,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    })
  );
  mesh.castShadow = true;
  const body = new CANNON.Body({
    mass: 0.8,
    shape: new CANNON.Sphere(0.6),
    position: new CANNON.Vec3(
      (Math.random() - 0.5) * 48,
      6 + Math.random() * 8,
      (Math.random() - 0.5) * 48
    ),
  });
  body.addEventListener('collide', (e) => {
    if (e.body.id === playerBody.id) {
      score++;
      scoreCountEl.textContent = score;
      removalQueue.add(entry);
    }
  });
  const entry = { mesh, body, collectible: true };
  body.userData = entry;
  world.addBody(body);
  scene.add(mesh);
  dynamicEntries.push(entry);
}

for (let i = 0; i < 5; i++) spawnCollectible();
let nextCollectibleAt = 0;

function removeEntry(entry) {
  const i = dynamicEntries.indexOf(entry);
  if (i < 0) return;
  world.removeBody(entry.body);
  scene.remove(entry.mesh);
  entry.mesh.geometry.dispose();
  entry.mesh.material.dispose();
  dynamicEntries.splice(i, 1);
}

function resetScene() {
  for (const entry of [...dynamicEntries]) removeEntry(entry);
  playerBody.position.set(0, 4, 12);
  playerBody.velocity.set(0, 0, 0);
  playerBody.angularVelocity.set(0, 0, 0);
  score = 0;
  scoreCountEl.textContent = '0';
  nextCollectibleAt = clock.elapsedTime + 1;
}

const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyR') resetScene();
  if (e.code === 'Digit1') spawnBox((Math.random() - 0.5) * 30, 10, (Math.random() - 0.5) * 30, 1.2, 1.5, palette[Math.floor(Math.random() * palette.length)]);
  if (e.code === 'Digit2') spawnSphere((Math.random() - 0.5) * 30, 10, (Math.random() - 0.5) * 30, 0.7, 1, palette[Math.floor(Math.random() * palette.length)]);
});
addEventListener('keyup', (e) => keys.delete(e.code));

const isTouchDevice = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouchDevice) document.body.classList.add('touch');

const joyVec = { x: 0, y: 0 };
const joyBase = document.getElementById('joy-base');
const joyKnob = document.getElementById('joy-knob');
let joyPointerId = null;
const JOY_RANGE = 38;

function updateJoyFromEvent(e) {
  const rect = joyBase.getBoundingClientRect();
  let dx = e.clientX - (rect.left + rect.width / 2);
  let dy = e.clientY - (rect.top + rect.height / 2);
  const dist = Math.hypot(dx, dy);
  if (dist > JOY_RANGE) {
    dx = (dx / dist) * JOY_RANGE;
    dy = (dy / dist) * JOY_RANGE;
  }
  joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  joyVec.x = Math.abs(dx) < 4 ? 0 : dx / JOY_RANGE;
  joyVec.y = Math.abs(dy) < 4 ? 0 : dy / JOY_RANGE;
}

function releaseJoy(e) {
  if (e.pointerId !== joyPointerId) return;
  joyPointerId = null;
  joyVec.x = 0;
  joyVec.y = 0;
  joyKnob.style.transform = 'translate(-50%, -50%)';
}

if (joyBase) {
  joyBase.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joyPointerId = e.pointerId;
    joyBase.setPointerCapture(e.pointerId);
    updateJoyFromEvent(e);
  });
  joyBase.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyPointerId) updateJoyFromEvent(e);
  });
  joyBase.addEventListener('pointerup', releaseJoy);
  joyBase.addEventListener('pointercancel', releaseJoy);
}

function throwBallFromPlayer() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = Math.max(dir.y, 0.18);
  dir.normalize();
  const p = playerBody.position;
  spawnSphere(
    p.x + dir.x * 2.4,
    p.y + 1.5,
    p.z + dir.z * 2.4,
    0.45,
    2,
    0x353535,
    { x: dir.x * 34, y: dir.y * 34, z: dir.z * 34 }
  );
}

function bindTap(id, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handler();
  });
}

const btnJump = document.getElementById('btn-jump');
if (btnJump) {
  btnJump.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    keys.add('Space');
  });
  btnJump.addEventListener('pointerup', () => keys.delete('Space'));
  btnJump.addEventListener('pointercancel', () => keys.delete('Space'));
}
bindTap('btn-throw', throwBallFromPlayer);
bindTap('btn-box', () => spawnBox((Math.random() - 0.5) * 30, 10, (Math.random() - 0.5) * 30, 1.2, 1.5, palette[Math.floor(Math.random() * palette.length)]));
bindTap('btn-sphere', () => spawnSphere((Math.random() - 0.5) * 30, 10, (Math.random() - 0.5) * 30, 0.7, 1, palette[Math.floor(Math.random() * palette.length)]));
bindTap('btn-reset', resetScene);

let camYaw = Math.PI;
let camPitch = 0.5;
let camDist = 15;
let dragging = false;
let downX = 0;
let downY = 0;
let lastX = 0;
let lastY = 0;
let clickNDC = { x: 0, y: 0 };

const canvasPointers = new Map();
let pinchStartDist = 0;
let pinchStartCamDist = 0;

renderer.domElement.addEventListener('pointerdown', (e) => {
  canvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (canvasPointers.size === 1) {
    dragging = true;
    downX = e.clientX;
    downY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;
  } else {
    dragging = false;
    if (canvasPointers.size === 2) {
      const pts = [...canvasPointers.values()];
      pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartCamDist = camDist;
    }
  }
});
addEventListener('pointerup', (e) => {
  canvasPointers.delete(e.pointerId);
  if (canvasPointers.size < 2) pinchStartDist = 0;
  if (!dragging) return;
  dragging = false;
  if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) < 6) {
    clickNDC.x = (e.clientX / innerWidth) * 2 - 1;
    clickNDC.y = -(e.clientY / innerHeight) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(clickNDC, camera);
    const dir = raycaster.ray.direction;
    const origin = camera.position.clone().add(dir.clone().multiplyScalar(2));
    spawnSphere(
      origin.x,
      origin.y,
      origin.z,
      0.45,
      2,
      0x353535,
      { x: dir.x * 32, y: dir.y * 32, z: dir.z * 32 }
    );
  }
});
addEventListener('pointercancel', (e) => canvasPointers.delete(e.pointerId));
addEventListener('pointermove', (e) => {
  if (canvasPointers.has(e.pointerId)) canvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (canvasPointers.size >= 2) {
    if (pinchStartDist > 0 && canvasPointers.size === 2) {
      const pts = [...canvasPointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (d > 0) camDist = Math.min(28, Math.max(7, pinchStartCamDist * (pinchStartDist / d)));
    }
    return;
  }
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  camYaw -= dx * 0.005;
  camPitch = Math.min(1.3, Math.max(0.1, camPitch + dy * 0.005));
});
addEventListener('wheel', (e) => {
  camDist = Math.min(28, Math.max(7, camDist + e.deltaY * 0.02));
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
let lastGroundedAt = -10;

function updatePlayer(dt) {
  const forward = { x: -Math.sin(camYaw), z: -Math.cos(camYaw) };
  const right = { x: -forward.z, z: forward.x };
  let mx = 0;
  let mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) { mx += forward.x; mz += forward.z; }
  if (keys.has('KeyS') || keys.has('ArrowDown')) { mx -= forward.x; mz -= forward.z; }
  if (keys.has('KeyA') || keys.has('ArrowLeft')) { mx -= right.x; mz -= right.z; }
  if (keys.has('KeyD') || keys.has('ArrowRight')) { mx += right.x; mz += right.z; }
  mx += -joyVec.y * forward.x + joyVec.x * right.x;
  mz += -joyVec.y * forward.z + joyVec.x * right.z;
  const len = Math.hypot(mx, mz);
  const grounded = clock.elapsedTime - lastGroundedAt < 0.12;
  const power = grounded ? 110 : 35;
  if (len > 0) {
    const strength = Math.min(len, 1);
    playerBody.applyForce(new CANNON.Vec3((mx / len) * power * strength, 0, (mz / len) * power * strength));
  }
  if (keys.has('Space') && grounded) {
    playerBody.velocity.y = 11;
    lastGroundedAt = -10;
  }
  if (playerBody.position.y < -25) {
    playerBody.position.set(0, 4, 12);
    playerBody.velocity.set(0, 0, 0);
  }
}

function updateCamera() {
  const t = playerBody.position;
  const cx = t.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist;
  const cy = t.y + 1 + Math.sin(camPitch) * camDist;
  const cz = t.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist;
  camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.15);
  camera.lookAt(t.x, t.y + 1.2, t.z);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  updatePlayer(dt);
  updateCamera();

  world.step(1 / 60, dt, 3);

  for (const entry of removalQueue) removeEntry(entry);
  removalQueue.clear();

  playerMesh.position.copy(playerBody.position);
  playerMesh.quaternion.copy(playerBody.quaternion);

  for (let i = dynamicEntries.length - 1; i >= 0; i--) {
    const entry = dynamicEntries[i];
    entry.mesh.position.copy(entry.body.position);
    entry.mesh.quaternion.copy(entry.body.quaternion);
    if (entry.body.position.y < -30) removeEntry(entry);
    else if (entry.collectible) entry.mesh.rotation.y += 0.03;
  }

  if (dynamicEntries.filter((e) => e.collectible).length < 5 && clock.elapsedTime > nextCollectibleAt) {
    spawnCollectible();
    nextCollectibleAt = clock.elapsedTime + 1.5;
  }

  while (dynamicEntries.length > 90) {
    const victim = dynamicEntries.find((e) => !e.collectible);
    if (!victim) break;
    removeEntry(victim);
  }

  objCountEl.textContent = dynamicEntries.length;
  renderer.render(scene, camera);
}
animate();

const fsBtn = document.getElementById('fs-btn');
const fsRoot = document.documentElement;

function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

async function lockLandscape() {
  const so = screen.orientation;
  if (so && typeof so.lock === 'function') {
    try { await so.lock('landscape'); } catch {}
  }
}

async function toggleFullscreen() {
  if (isFullscreen()) {
    try { await document.exitFullscreen(); } catch {}
  } else {
    try {
      const req = fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen;
      if (req) await req.call(fsRoot);
    } catch {}
    lockLandscape();
  }
}

function onFsChange() {
  fsBtn.textContent = isFullscreen() ? 'Exit Fullscreen' : 'Fullscreen';
  if (isFullscreen()) lockLandscape();
}

fsBtn.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', onFsChange);
document.addEventListener('webkitfullscreenchange', onFsChange);
addEventListener('keydown', (e) => {
  if (e.code === 'KeyF') toggleFullscreen();
});
