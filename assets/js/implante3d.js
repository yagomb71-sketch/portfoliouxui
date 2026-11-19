/* Implante dentário 3D que se desmonta com o scroll — YE Studios */
import * as THREE from '../vendor/three.module.min.js';

const sec = document.getElementById('implante');
const stage = sec.querySelector('.imp-stage');
const canvas = sec.querySelector('canvas');
const labelsEl = sec.querySelector('.imp-labels');
const numEl = sec.querySelector('#impNum');
const titleEl = sec.querySelector('#impTitle');
const textEl = sec.querySelector('#impText');
const railEl = sec.querySelector('#impRail');

const PARTS = [
  { k: 'crown', n: '01', t: 'Coroa', d: 'Cerâmica feita sob medida, na cor e no formato dos seus dentes.' },
  { k: 'screw', n: '02', t: 'Parafuso de fixação', d: 'Prende a coroa ao pilar com firmeza, sem aparecer no sorriso.' },
  { k: 'abut', n: '03', t: 'Pilar', d: 'Faz a ponte entre o implante e a coroa, atravessando a gengiva.' },
  { k: 'impl', n: '04', t: 'Implante', d: 'Pino de titânio que ocupa o lugar da raiz do dente.' },
  { k: 'bone', n: '05', t: 'Osso e gengiva', d: 'Com o tempo, o osso se une ao titânio e vira a base firme do novo dente.' },
];
const DONE = { n: '✓', t: 'Montado', d: 'Por fora, ninguém percebe: parece e funciona como um dente natural.' };
const START = { n: '00', t: 'Role para desmontar', d: 'Cada peça do implante tem uma função. Role a página e veja uma por uma.' };

/* ---------- renderer ---------- */
// vista técnica não precisa de luz nem de mapa de ambiente: fica leve e compatível com qualquer celular
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
} catch (err) { renderer = null; }
if (!renderer) sec.classList.add('nogl');
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); sec.classList.add('nogl'); renderer = null; });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);


const root = new THREE.Group(); scene.add(root);

/* ---------- materiais ---------- */
const M = {
  ti: new THREE.MeshStandardMaterial({ color: 0xbfc4c9, metalness: 1, roughness: 0.32 }),
  tiDark: new THREE.MeshStandardMaterial({ color: 0x8f969c, metalness: 1, roughness: 0.38 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd8b57a, metalness: 1, roughness: 0.26 }),
  crown: new THREE.MeshPhysicalMaterial({ color: 0xf5f1e8, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.4, sheenColor: new THREE.Color(0xfff6e6) }),
  bone: new THREE.MeshStandardMaterial({ color: 0xece2d0, roughness: 0.9, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  boneIn: new THREE.MeshStandardMaterial({ color: 0xd9c7a8, roughness: 1, transparent: true, opacity: 0.35, depthWrite: false }),
  gum: new THREE.MeshPhysicalMaterial({ color: 0xe39a96, roughness: 0.45, clearcoat: 0.6, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide }),
};

/* ---------- geometrias ---------- */
function lathe(profile, seg = 96) {
  const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  g.computeVertexNormals(); return g;
}

// Implante: corpo cônico + rosca helicoidal + hexágono
function makeImplant() {
  const g = new THREE.Group();
  const L = 3.2, top = 0, bot = -L;
  const rAt = y => { const t = (top - y) / L; return 0.44 - 0.12 * Math.pow(t, 1.6); };
  const prof = [[0.0, bot - 0.02], [0.22, bot], [0.3, bot + 0.12]];
  for (let i = 0; i <= 24; i++) { const y = bot + 0.2 + (L - 0.3) * (i / 24); prof.push([rAt(y), y]); }
  prof.push([0.46, top - 0.06], [0.46, top], [0.3, top], [0.3, top + 0.02]);
  g.add(new THREE.Mesh(lathe(prof), M.ti));
  // rosca
  const turns = 11, pts = [];
  for (let i = 0; i <= turns * 48; i++) {
    const t = i / (turns * 48), y = bot + 0.28 + t * (L - 0.6), a = t * turns * Math.PI * 2;
    const r = rAt(y) - 0.015; pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const thread = new THREE.TubeGeometry(curve, turns * 64, 0.085, 10, false);
  // achata a rosca nas pontas
  g.add(new THREE.Mesh(thread, M.ti));
  // hexágono interno visível no topo
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 6), M.tiDark);
  hex.position.y = top + 0.1; g.add(hex);
  return g;
}

// Pilar (abutment): colar + cone com face plana
function makeAbutment() {
  const g = new THREE.Group();
  const prof = [[0.0, -0.06], [0.3, -0.06], [0.3, 0.06], [0.46, 0.12], [0.54, 0.38], [0.52, 0.48], [0.36, 0.56],
    [0.33, 1.25], [0.26, 1.36], [0.0, 1.38]];
  g.add(new THREE.Mesh(lathe(prof), M.gold));
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.2, 6), M.gold);
  hex.position.y = -0.14; g.add(hex);
  return g;
}

// Parafuso de fixação
function makeScrew() {
  const g = new THREE.Group();
  const prof = [[0, -0.9], [0.1, -0.88], [0.12, -0.8], [0.12, 0.6], [0.2, 0.62], [0.2, 0.8], [0.17, 0.84], [0, 0.84]];
  g.add(new THREE.Mesh(lathe(prof, 48), M.tiDark));
  const pts = [];
  for (let i = 0; i <= 8 * 32; i++) { const t = i / 256, y = -0.8 + t * 0.7, a = t * 8 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * 0.125, y, Math.sin(a) * 0.125)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 256, 0.025, 6), M.tiDark));
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0x3a3f44, metalness: .6, roughness: .5 }));
  slot.position.y = 0.84; g.add(slot);
  return g;
}

// Coroa: superelipsoide com mesa oclusal, cúspides e colo afunilado
function makeCrown() {
  const geo = new THREE.SphereGeometry(1, 128, 96);
  const p = geo.attributes.position, v = new THREE.Vector3();
  const sp = (t, e) => Math.sign(t) * Math.pow(Math.abs(t), e);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let x = sp(v.x, 0.7), z = sp(v.z, 0.7), y = v.y;
    if (y > 0) {
      y = 0.62 * Math.pow(y, 0.38);                 // topo mais plano
      const rr = Math.min(1, Math.hypot(x, z));
      const a = Math.atan2(z, x);
      const cusp = Math.pow(Math.max(0, Math.cos(2 * a - 0.785)), 2) * Math.sin(Math.PI * Math.min(1, rr / 0.95));
      y += 0.17 * cusp * Math.min(1, v.y * 5);
      y -= 0.16 * Math.max(0, 1 - rr / 0.42) * Math.min(1, v.y * 5);   // fossa central
    } else {
      const t = -y;                                    // 0 no equador, 1 no fundo
      const s = 1 - 0.42 * Math.pow(t, 1.25);
      x *= s; z *= s; y = -0.95 * Math.pow(t, 0.9);
    }
    x *= 1.08; z *= 0.98;
    const n = Math.sin(x * 9.1 + 1) * Math.cos(z * 7.3) * 0.008;
    p.setXYZ(i, x * (1 + n), y + n, z * (1 + n));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, M.crown);
  m.scale.setScalar(0.9);
  return m;
}

function makeBone() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.7, 2.3, 1, 1, 1), M.bone);
  box.position.y = -1.95; g.add(box);
  // trabéculas (pontos esponjosos)
  const sp = new THREE.SphereGeometry(1, 8, 6), inst = new THREE.InstancedMesh(sp, M.boneIn, 140), d = new THREE.Object3D();
  let r = 7;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 140; i++) {
    let x, y, z; do { x = (rnd() - .5) * 3.0; y = -0.5 - rnd() * 3.2; z = (rnd() - .5) * 2.0; } while (Math.hypot(x, z) < 0.62);
    d.position.set(x, y, z); d.scale.setScalar(0.06 + rnd() * 0.13); d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
  }
  g.add(inst);
  return g;
}
function makeGum() {
  const geo = new THREE.BoxGeometry(3.5, 0.55, 2.4, 24, 4, 16);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y > 0) { const bump = 0.12 * Math.cos(z / 1.2 * Math.PI / 2) - 0.1 * Math.exp(-(x * x + z * z) * 3); p.setY(i, y + bump); }
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, M.gum); m.position.y = 0.05;
  return m;
}

const parts = {
  bone: makeBone(), gum: makeGum(), impl: makeImplant(), abut: makeAbutment(), screw: makeScrew(), crown: makeCrown(),
};
// posições montadas e desmontadas (y)
const BASE = { bone: 0, gum: 0, impl: 0, abut: 0.02, screw: 0.35, crown: 1.15 };
const OPEN = { bone: -1.9, gum: -1.1, impl: 0.4, abut: 2.3, screw: 3.75, crown: 5.4 };
const SPIN = { bone: 0, gum: 0, impl: 1.6, abut: -0.8, screw: 3.2, crown: 0.6 };
Object.entries(parts).forEach(([k, o]) => { o.position.y = BASE[k]; root.add(o); });

// anchors para legenda (local, relativo à peça)
const ANCH = { crown: [0.95, 0.1, 0], screw: [0.2, 0.7, 0], abut: [0.5, 0.9, 0], impl: [0.45, -1.3, 0], bone: [1.7, -0.8, 0] };

/* ---------- vista técnica (arestas) ---------- */
const lineMats = {};
const edges = [];
Object.entries(parts).forEach(([k, part]) => {
  const lm = lineMats[k] = new THREE.LineBasicMaterial({ color: 0x9fe0d4, transparent: true, opacity: 0.85 });
  part.traverse(o => {
    if (o.isMesh && !o.isInstancedMesh) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 12), lm); o.add(e); edges.push(e); }
  });
});
// só a vista técnica: malha em arame bem leve + arestas
const wire = new THREE.MeshBasicMaterial({ color: 0x9fe0d4, wireframe: true, transparent: true, opacity: 0.07, depthWrite: false });
root.traverse(o => { if (o.isInstancedMesh) o.visible = false; else if (o.isMesh) o.material = wire; });
sec.classList.add('plan');

/* ---------- legendas HTML ---------- */
const labelNodes = PARTS.map((p, i) => {
  const el = document.createElement('div');
  el.className = 'imp-lab ' + (i % 2 ? 'l' : 'r');
  el.innerHTML = `<i></i><span><small>${p.n}</small>${p.t}</span>`;
  labelsEl.appendChild(el); return el;
});

/* ---------- interação ---------- */
let drag = 0, dragV = 0, down = false, lx = 0;
canvas.addEventListener('pointerdown', e => { down = true; lx = e.clientX; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - lx; lx = e.clientX; dragV = dx * 0.008; drag += dragV; needs = true; });
['pointerup', 'pointercancel'].forEach(t => canvas.addEventListener(t, () => { down = false; }));

/* ---------- loop ---------- */
let W = 0, H = 0, needs = true, visible = false, cur = 0, curE = 0, camY = -0.6, camD = 14.5, last = -1;
function resize() {
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height || (r.width === W && Math.abs(r.height - H) < 2)) return;
  W = r.width; H = r.height;
  if (renderer) { renderer.setPixelRatio(Math.min(devicePixelRatio, W < 700 ? 1.5 : 1.75)); renderer.setSize(W, H, false); } camera.aspect = W / H;
  if (W < 700) camera.setViewOffset(W, H, 0, -H * 0.05, W, H); else camera.clearViewOffset();
  camera.updateProjectionMatrix(); needs = true;
}
addEventListener('resize', resize); resize();
new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { rootMargin: '200px' }).observe(sec);

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const tmp = new THREE.Vector3();
let t0 = performance.now();

function tick(now) {
  requestAnimationFrame(tick);
  if (!visible) return;
  const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
  const r = sec.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
  const E = ss(0.06, 0.34, p) * (1 - ss(0.84, 0.97, p));
  cur += (p - cur) * Math.min(1, dt * 7);
  curE += (E - curE) * Math.min(1, dt * 6);
  railEl.style.transform = `scaleY(${p})`;

  // peça ativa
  let idx = -1;
  if (p > 0.34 && p < 0.86) idx = Math.min(4, Math.floor((p - 0.34) / 0.52 * 5));
  const info = p >= 0.86 ? DONE : idx < 0 ? START : PARTS[idx];
  const key = p >= 0.86 ? 'd' : idx;
  if (key !== last) {
    last = key;
    sec.querySelector('.imp-info').classList.remove('sw'); void sec.querySelector('.imp-info').offsetWidth;
    sec.querySelector('.imp-info').classList.add('sw');
    numEl.textContent = info.n; numEl.classList.toggle('of', typeof key === 'number'); titleEl.textContent = info.t; textEl.textContent = info.d;
  }

  // posiciona peças
  Object.entries(parts).forEach(([k, o]) => {
    o.position.y = BASE[k] + (OPEN[k] - BASE[k]) * curE;
    o.rotation.y = SPIN[k] * curE;
  });
  dragV *= 0.94; if (!down) drag += dragV;
  root.rotation.y = -0.5 + cur * Math.PI * 1.15 + drag + now * 0.00008;
  root.rotation.x = 0.06;

  // câmera foca na peça ativa
  const focusY = idx >= 0 ? parts[PARTS[idx].k].position.y + (PARTS[idx].k === 'bone' ? -1.4 : PARTS[idx].k === 'impl' ? -1.2 : 0.4) : -0.6 + curE * 1.9;
  const zoomIn = idx >= 0 ? (W < 700 ? 0.78 : 0.62) : 1;
  const mobile = W < 700;
  const baseD = (mobile ? 27 : 14.5) + curE * (mobile ? 15 : 8);
  camY += (focusY - camY) * Math.min(1, dt * 3);
  camD += (baseD * zoomIn - camD) * Math.min(1, dt * 3);
  root.position.x = mobile ? 0 : 1.9;
  camera.position.set(0, camY + 1.4, camD);
  camera.lookAt(0, camY, 0);

  // destaque da peça ativa
  const act = idx >= 0 ? PARTS[idx].k : null;
  Object.entries(lineMats).forEach(([k, m]) => {
    const on = !act || k === act || (act === 'bone' && k === 'gum');
    m.opacity += ((on ? 0.95 : 0.22) - m.opacity) * Math.min(1, dt * 6);
  });

  if (renderer) renderer.render(scene, camera);

  // legendas
  labelNodes.forEach((el, i) => {
    const k = PARTS[i].k, o = parts[k];
    tmp.set(...ANCH[k]); o.localToWorld(tmp); tmp.project(camera);
    let x = (tmp.x * 0.5 + 0.5) * W, y = (-tmp.y * 0.5 + 0.5) * H;
    if (W < 700) { y += H * 0.05; x = i % 2 ? Math.max(170, x) : Math.min(W - 160, x); }
    const vis = curE > 0.55 && tmp.z < 1;
    el.style.transform = `translate3d(${x}px,${y}px,0)`;
    el.classList.toggle('on', vis);
    el.classList.toggle('act', i === idx);
  });
}
requestAnimationFrame(tick);
sec.classList.add('ready3d');
