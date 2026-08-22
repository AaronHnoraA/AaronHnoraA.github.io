/*
 * hero-circuit.js — Shor's algorithm, flown through in three dimensions.
 * Copyright (c) 2026 Chang He. MIT (see /LICENSE).
 *
 * The circuit of Nielsen & Chuang §5.3, built as a volume instead of a
 * diagram: four counting rails ring a central work register, and the gates
 * are apertures the register flies through.
 *
 *   |0>^4  --[H]--*----*----*----*----[ QFT+ ]--[meter]==>
 *                 |    |    |    |
 *   |1>^n  -------[ a^(2^j) mod N ]------------------------
 *
 * What the third dimension is for: a qubit does not slide along its rail, it
 * orbits it. The Hadamards open that orbit and split each qubit into two
 * counter-phased branches; each rail winds twice as fast as the one before it,
 * because qubit j drives U^(2^j); the inverse QFT reads those windings out;
 * measurement drops everything back onto the rail as one classical bit.
 *
 * The darts bank into their turns and trail ribbons, which is why it reads as
 * flight rather than as animation. Original work — see /credits.html.
 */

import * as THREE from 'three';
import { createTimeline } from 'anime';

const PAPER = new THREE.Color('#f6f3ec');
const INK = new THREE.Color('#1b1a17');
const ACCENT = new THREE.Color('#2f5d6b');
const ACCENT_2 = new THREE.Color('#9a5b33');

const L = {
  ring: 1.35,                          // radius of the counting-rail ring
  xStart: -8.0,
  xKet: -7.5,
  xH: -6.0,
  xCU: [-4.2, -2.6, -1.0, 0.6],        // controlled-U^(2^j) columns
  xQFT: [1.9, 3.9],                    // inverse QFT enclosure
  xMeter: 5.3,
  xExit: 7.6,
  orbit: 0.46,                         // how far a qubit orbits its own rail
};

/* Rail angles around the bus, evenly spread so the ring reads as a ring from
 * any camera azimuth. Index j is also the exponent in U^(2^j). */
const RAIL_ANGLE = [0, 1, 2, 3].map((j) => (Math.PI / 2) * j + Math.PI / 4);

/* A unit cylinder lying along +X, growing from the origin: scale.x is length,
 * scale.y/z are radius. Reused by every rail and beam in the scene. */
const barGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true)
  .rotateZ(-Math.PI / 2)
  .translate(0.5, 0, 0);

/* A dart pointing along +X with its up along +Y. */
const dartGeo = new THREE.ConeGeometry(0.085, 0.34, 4, 1)
  .rotateZ(-Math.PI / 2)
  .rotateX(Math.PI / 4);

const nodeGeo = new THREE.SphereGeometry(1, 12, 8);

export function mountHeroCircuit(stage, opts = {}) {
  const canvas = document.createElement('canvas');
  stage.insertBefore(canvas, stage.firstChild);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    canvas.remove();
    return null; // the caller leaves the static fallback in place
  }
  if (!renderer.getContext()) { canvas.remove(); return null; }

  const narrow = window.matchMedia('(max-width: 46rem)').matches;
  const RIBBON = narrow ? 26 : 46;

  renderer.setClearAlpha(0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow ? 1.75 : 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PAPER, 9, 30);
  const camera = new THREE.PerspectiveCamera(52, 2, 0.1, 120);

  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(-3, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd8cfbc, 0.9);
  rim.position.set(4, -5, -6);
  scene.add(rim);

  const circuit = new THREE.Group();
  scene.add(circuit);

  /* Materials are individually owned so the whole scene can dissolve between
   * loops; `base` is the opacity each element wants at full strength. */
  const fadeables = [];
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  function basic(color, opacity, extra = {}) {
    const m = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, ...extra,
    });
    fadeables.push({ m, base: opacity });
    return m;
  }

  function bar(from, to, radius, color, opacity) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const mesh = new THREE.Mesh(barGeo, basic(color, opacity));
    mesh.position.copy(from);
    mesh.scale.set(len, radius, radius);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
    return mesh;
  }

  function railPoint(j, x) {
    const a = RAIL_ANGLE[j];
    return new THREE.Vector3(x, Math.sin(a) * L.ring, Math.cos(a) * L.ring);
  }

  /* Rings are built at their true size: pulsing them by scale would otherwise
   * thin the tube below a pixel. */
  function ring(radius, tube, color, opacity) {
    const geo = new THREE.TorusGeometry(radius, tube, 8, 44).rotateY(Math.PI / 2);
    return new THREE.Mesh(geo, basic(color, opacity));
  }

  function aperture(x, radius, color, opacity) {
    const mesh = ring(radius, 0.018, color, opacity);
    mesh.position.x = x;
    return mesh;
  }

  function sprite(text, size, opacity = 0.85, weight = 400) {
    const px = 128;
    const probe = document.createElement('canvas').getContext('2d');
    const font = `${weight} ${px}px "Iowan Old Style", Charter, Palatino, Georgia, serif`;
    probe.font = font;
    const w = Math.ceil(probe.measureText(text).width + px * 0.5);
    const h = Math.ceil(px * 1.5);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.font = font;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillStyle = '#1b1a17';
    cx.fillText(text, w / 2, h / 2);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.anisotropy = maxAniso;

    const m = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity, depthWrite: false, fog: true,
    });
    fadeables.push({ m, base: opacity });
    const s = new THREE.Sprite(m);
    s.scale.set(size * (w / h), size, 1);
    return s;
  }

  function place(obj, x, y, z) { obj.position.set(x, y, z); return obj; }

  /* ------------------------------------------------------------- rails */

  const inkRails = [];
  for (let j = 0; j <= 4; j++) {
    const core = j === 4;
    const a = core ? 0 : RAIL_ANGLE[j];
    const r = core ? 0 : L.ring;
    const y = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const radius = core ? 0.045 : 0.022;

    const guide = new THREE.Mesh(barGeo, basic(INK, 0.13));
    guide.position.set(L.xStart, y, z);
    guide.scale.set(L.xExit - L.xStart, radius, radius);
    circuit.add(guide);

    const ink = new THREE.Mesh(barGeo, basic(core ? INK : ACCENT, core ? 0.5 : 0.42));
    ink.position.set(L.xStart, y, z);
    ink.scale.set(0.001, radius * 1.25, radius * 1.25);
    circuit.add(ink);
    inkRails.push(ink);
  }

  /* Ket labels at the entrance. */
  for (let j = 0; j < 4; j++) {
    circuit.add(place(sprite('|0⟩', 0.42), ...railPoint(j, L.xKet).addScaledVector(
      railPoint(j, 0).setX(0).normalize(), 0.34).toArray()));
  }
  circuit.add(place(sprite('|1⟩', 0.44), L.xKet, -0.42, 0));
  circuit.add(place(sprite('n', 0.26, 0.6), L.xKet + 0.55, -0.34, 0));

  /* -------------------------------------------------------- H apertures */

  const hGates = [];
  for (let j = 0; j < 4; j++) {
    const p = railPoint(j, L.xH);
    const g = new THREE.Group();
    g.position.copy(p);
    const hoop = ring(0.44, 0.018, INK, 0.55);
    g.add(hoop);
    const lab = sprite('H', 0.34, 0.9, 500);
    lab.position.set(0, 0.62, 0);
    g.add(lab);
    circuit.add(g);
    hGates.push({ group: g, hoop, x: L.xH });
  }

  /* ------------------------------------- controlled modular exponentiation */

  const superscripts = ['¹', '²', '⁴', '⁸'];
  const cuColumns = L.xCU.map((x, j) => {
    const from = railPoint(j, x);
    const to = new THREE.Vector3(x, 0, 0);
    const beam = bar(from.clone(), to.clone(), 0.014, INK, 0.2);

    const control = new THREE.Mesh(nodeGeo, basic(ACCENT, 0.9));
    control.position.copy(from);
    control.scale.setScalar(0.085);

    const band = new THREE.Group();
    band.position.x = x;
    for (const dx of [-0.28, 0.28]) {
      const hoop = ring(0.44, 0.016, INK, 0.45);
      hoop.position.x = dx;
      band.add(hoop);
    }
    const lab = sprite(`a${superscripts[j]} mod N`, 0.26, 0.8);
    lab.position.set(0, -0.78, 0);
    band.add(lab);

    circuit.add(beam, control, band);
    return { x, beam, control, band };
  });

  /* --------------------------------------------------------- inverse QFT */

  const qft = new THREE.Group();
  const [qa, qb] = L.xQFT;
  const qr = L.ring + 0.5;
  for (const x of [qa, (qa + qb) / 2, qb]) qft.add(aperture(x, qr, INK, 0.32));
  for (let k = 0; k < 8; k++) {
    const a = (Math.PI * 2 * k) / 8;
    const p0 = new THREE.Vector3(qa, Math.sin(a) * qr, Math.cos(a) * qr);
    const p1 = new THREE.Vector3(qb, Math.sin(a) * qr, Math.cos(a) * qr);
    qft.add(bar(p0, p1, 0.008, INK, 0.16));
  }
  /* The controlled-phase network, sketched as chords between rails. */
  const qftChords = [];
  for (let j = 0; j < 4; j++) {
    for (let k = j + 1; k < 4; k++) {
      const t = (j + k) / 6;
      const x = qa + 0.28 + t * (qb - qa - 0.56);
      const chord = bar(railPoint(j, x), railPoint(k, x), 0.01, ACCENT, 0.0);
      qftChords.push(chord);
      qft.add(chord);
    }
  }
  const qftLabel = sprite('QFT†', 0.36, 0.9);
  qftLabel.position.set((qa + qb) / 2, qr + 0.5, 0);
  qft.add(qftLabel);
  circuit.add(qft);

  /* ------------------------------------------------------------- meters */

  const meters = [];
  for (let j = 0; j < 4; j++) {
    const g = new THREE.Group();
    g.position.copy(railPoint(j, L.xMeter));
    const hoop = ring(0.42, 0.017, INK, 0.5);
    g.add(hoop);
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.016, 6, 20, Math.PI * 0.85).rotateY(Math.PI / 2),
      basic(INK, 0.75),
    );
    arc.rotation.x = Math.PI * 0.08;
    g.add(arc);
    circuit.add(g);
    meters.push({ group: g, hoop });
  }
  const meterLabel = sprite('measure', 0.24, 0.7);
  meterLabel.position.set(L.xMeter, -L.ring - 0.75, 0);
  circuit.add(meterLabel);

  /* Classical rails leaving to the right. */
  const classical = [];
  for (let j = 0; j < 4; j++) {
    const p = railPoint(j, L.xMeter + 0.4);
    for (const d of [0.035, -0.035]) {
      const mesh = new THREE.Mesh(barGeo, basic(INK, 0.4));
      mesh.position.set(p.x, p.y + d, p.z + d);
      mesh.scale.set(0.001, 0.012, 0.012);
      circuit.add(mesh);
      classical.push({ mesh, x0: p.x });
    }
  }

  const caption = sprite('r = 4  →  gcd(a^(r/2) ± 1, N)', 0.34, 0);
  caption.position.set(3.4, -L.ring - 1.35, 0);
  const captionFade = fadeables[fadeables.length - 1];
  captionFade.base = 0.82;
  circuit.add(caption);

  /* -------------------------------------------------------------- darts */

  const dartMat = () => {
    const m = new THREE.MeshLambertMaterial({
      color: ACCENT, transparent: true, opacity: 0.95, emissive: ACCENT.clone().multiplyScalar(0.12),
    });
    fadeables.push({ m, base: 0.95 });
    return m;
  };

  function makeRibbon(color) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(RIBBON * 2 * 3);
    const col = new Float32Array(RIBBON * 2 * 3);
    const idx = [];
    for (let i = 0; i < RIBBON - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.8,
      side: THREE.DoubleSide, depthWrite: false,
    });
    fadeables.push({ m, base: 0.8 });
    const mesh = new THREE.Mesh(geo, m);
    mesh.frustumCulled = false;
    mesh.userData.color = color;
    return { mesh, geo, pos, col, history: [] };
  }

  const flyers = [];
  for (let j = 0; j < 4; j++) {
    for (const sign of [1, -1]) {
      const dart = new THREE.Mesh(dartGeo, dartMat());
      if (sign < 0) dart.material.color = ACCENT_2.clone();
      circuit.add(dart);
      const ribbon = makeRibbon(sign > 0 ? ACCENT : ACCENT_2);
      circuit.add(ribbon.mesh);
      flyers.push({ j, sign, dart, ribbon });
    }
  }

  const coreDart = new THREE.Mesh(dartGeo, dartMat());
  coreDart.material.color = INK.clone();
  coreDart.scale.setScalar(1.25);
  circuit.add(coreDart);
  const coreRibbon = makeRibbon(INK);
  circuit.add(coreRibbon.mesh);

  /* -------------------------------------------------------------- state */

  const S = { head: L.xStart, split: 0, phase: 0, collapse: 0, fade: 1, caption: 0, chords: 0 };
  let seated = false;   // camera has taken its seat behind the qubit it rides

  function reset() {
    seated = false;
    S.head = L.xStart; S.split = 0; S.phase = 0; S.collapse = 0; S.caption = 0; S.chords = 0;
    for (const f of flyers) f.ribbon.history.length = 0;
    coreRibbon.history.length = 0;
  }

  function buildTimeline() {
    return createTimeline({ loop: true, defaults: { ease: 'inOutSine' } })
      .add(S, { head: L.xH, duration: 1400 }, 0)
      .add(S, { split: 1, duration: 900, ease: 'outCubic' }, '-=350')
      .add(S, { head: L.xCU[3] + 0.9, duration: 3000, ease: 'linear' })
      .add(S, { head: L.xQFT[0], duration: 900 })
      .add(S, { chords: 1, duration: 500, ease: 'outQuad' })
      .add(S, { head: L.xQFT[1], duration: 1600, ease: 'linear' })
      .add(S, { phase: Math.PI * 4.5, duration: 2100, ease: 'inOutQuad' }, '-=2100')
      .add(S, { chords: 0, duration: 500, ease: 'inQuad' }, '-=400')
      .add(S, { head: L.xMeter, duration: 1000 })
      .add(S, { collapse: 1, duration: 500, ease: 'outQuad' })
      .add(S, { head: L.xExit, duration: 1100 })
      .add(S, { caption: 1, duration: 700, ease: 'outQuad' })
      .add(S, { caption: 0, fade: 0, duration: 800, ease: 'inQuad' }, '+=2000')
      .add(S, { fade: 1, duration: 900, ease: 'outQuad', onBegin: reset }, '+=150');
  }

  /* ------------------------------------------------ flight path & posing */

  const _p = new THREE.Vector3();
  const _q = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _centre = new THREE.Vector3();
  const _side = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _c = new THREE.Color();

  /* Where a flyer is: on its rail, orbiting it by an angle that winds with
   * distance and with the accumulated phase. Rail j winds at 2^j-ish rate,
   * mirroring U^(2^j); the two branches sit half a turn apart. */
  function flightPoint(out, j, sign, x, t) {
    const a = RAIL_ANGLE[j];
    const cy = Math.sin(a) * L.ring;
    const cz = Math.cos(a) * L.ring;
    const rate = 1 + j * 0.7;
    const amp = L.orbit * S.split * (1 - S.collapse) * (1 + 0.22 * Math.sin(x * 0.7 + j));
    const ang = (sign > 0 ? 0 : Math.PI) + x * 0.55 * rate + S.phase * rate + t * 0.00042 * rate;
    return out.set(x, cy + Math.sin(ang) * amp, cz + Math.cos(ang) * amp);
  }

  function corePoint(out, x, t) {
    const wobble = 0.16 * S.split * (1 - 0.7 * S.collapse);
    return out.set(x, Math.sin(x * 0.9 + t * 0.0006) * wobble, Math.cos(x * 0.7 + t * 0.0005) * wobble);
  }

  function orient(obj, at, ahead, centre) {
    obj.position.copy(at);
    _fwd.subVectors(ahead, at);
    if (_fwd.lengthSq() < 1e-9) return;
    _fwd.normalize();
    /* Bank into the turn: "up" leans toward the rail the flyer orbits. */
    _up.subVectors(centre, at);
    if (_up.lengthSq() < 1e-9) _up.set(0, 1, 0);
    _up.normalize().multiplyScalar(-1);
    _side.crossVectors(_fwd, _up);
    if (_side.lengthSq() < 1e-9) return;
    _side.normalize();
    _up.crossVectors(_side, _fwd).normalize();
    _m.makeBasis(_fwd, _up, _side);
    obj.quaternion.setFromRotationMatrix(_m);
  }

  function pushRibbon(rb, p) {
    rb.history.push(p.x, p.y, p.z);
    const cap = RIBBON * 3;
    if (rb.history.length > cap) rb.history.splice(0, rb.history.length - cap);
  }

  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _nrm = new THREE.Vector3();

  function writeRibbon(rb) {
    const n = rb.history.length / 3;
    if (n < 3) { rb.geo.setDrawRange(0, 0); return; }
    for (let i = 0; i < n; i++) {
      _a.fromArray(rb.history, i * 3);
      const iN = Math.min(i + 1, n - 1);
      const iP = Math.max(i - 1, 0);
      _b.fromArray(rb.history, iN * 3);
      _tan.copy(_b);
      _b.fromArray(rb.history, iP * 3);
      _tan.sub(_b);
      if (_tan.lengthSq() < 1e-10) _tan.set(1, 0, 0);
      _tan.normalize();
      /* Ribbon plane: perpendicular to the tangent, leaning away from the axis. */
      _nrm.set(0, _a.y, _a.z);
      if (_nrm.lengthSq() < 1e-8) _nrm.set(0, 1, 0);
      _nrm.normalize().cross(_tan).normalize();

      const t = i / (n - 1);
      const w = 0.062 * t * t * (1 - 0.55 * S.collapse);
      const o = i * 6;
      rb.pos[o] = _a.x + _nrm.x * w;
      rb.pos[o + 1] = _a.y + _nrm.y * w;
      rb.pos[o + 2] = _a.z + _nrm.z * w;
      rb.pos[o + 3] = _a.x - _nrm.x * w;
      rb.pos[o + 4] = _a.y - _nrm.y * w;
      rb.pos[o + 5] = _a.z - _nrm.z * w;

      /* Fading toward the paper colour instead of toward zero alpha: on a
       * light ground it reads identically and costs no sorting. */
      _c.copy(PAPER).lerp(rb.mesh.userData.color, t ** 1.6);
      for (const k of [0, 3]) {
        rb.col[o + k] = _c.r; rb.col[o + k + 1] = _c.g; rb.col[o + k + 2] = _c.b;
      }
    }
    rb.geo.attributes.position.needsUpdate = true;
    rb.geo.attributes.color.needsUpdate = true;
    rb.geo.setDrawRange(0, (n - 1) * 6);
  }

  function pose(t) {
    const head = Math.min(S.head, L.xExit);
    const drawn = Math.max(0.001, head - L.xStart);
    for (const r of inkRails) r.scale.x = drawn;

    const near = (x, w) => THREE.MathUtils.clamp((head - (x - w)) / w, 0, 1);

    for (const g of hGates) {
      const a = near(g.x, 1.1);
      g.hoop.scale.setScalar(1 + 0.18 * Math.sin(a * Math.PI));
      g.hoop.material.opacity = (0.28 + 0.45 * a) * S.fade;
      g.group.rotation.x = t * 0.0002;
    }

    for (const c of cuColumns) {
      const a = near(c.x, 1.2);
      c.beam.material.opacity = (0.1 + 0.5 * a) * S.fade;
      c.control.scale.setScalar(0.085 * (1 + 0.5 * Math.sin(a * Math.PI)));
      c.band.rotation.x = -t * 0.00016;
    }

    qft.rotation.x = t * 0.00011;
    for (const chord of qftChords) chord.material.opacity = 0.5 * S.chords * S.fade;

    for (const m of meters) {
      const a = near(L.xMeter, 0.9);
      m.hoop.scale.setScalar(1 + 0.15 * a);
    }

    for (const c of classical) {
      c.mesh.scale.x = Math.max(0.001, head - c.x0);
      c.mesh.visible = head > c.x0;
    }

    for (const f of flyers) {
      flightPoint(_p, f.j, f.sign, head, t);
      flightPoint(_q, f.j, f.sign, head + 0.12, t);
      const a = RAIL_ANGLE[f.j];
      _centre.set(head, Math.sin(a) * L.ring, Math.cos(a) * L.ring);
      orient(f.dart, _p, _q, _centre);
      const shrink = 1 - 0.3 * S.split * (1 - S.collapse);
      f.dart.scale.setScalar(shrink * (f.sign > 0 ? 1 : 1 - 0.5 * S.collapse));
      f.dart.material.opacity = (f.sign > 0 ? 0.95 : 0.95 * (1 - 0.75 * S.collapse)) * S.fade;
      pushRibbon(f.ribbon, _p);
      writeRibbon(f.ribbon);
    }

    corePoint(_p, head, t);
    corePoint(_q, head + 0.12, t);
    _centre.set(head, 0, 0);
    orient(coreDart, _p, _q, _centre);
    coreDart.material.opacity = 0.9 * S.fade;
    pushRibbon(coreRibbon, _p);
    writeRibbon(coreRibbon);

    caption.material.opacity = S.caption * captionFade.base * S.fade;
  }

  function applyFade() {
    for (const { m, base } of fadeables) m.opacity = base * S.fade;
    caption.material.opacity = S.caption * captionFade.base * S.fade;
  }

  /* ------------------------------------------------------------- camera */

  /* The viewpoint is not an observer of the circuit — it is one of the qubits
   * in it. The camera rides just off the shoulder of rail 1's leading branch,
   * so the reader flies the algorithm rather than watching it. */
  const HERO = { j: 1, sign: 1, lag: 2.35, lead: 2.4, out: 0.30, lift: 0.42 };

  const mouse = new THREE.Vector2();
  const eased = new THREE.Vector2();
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const camUp = new THREE.Vector3(0, 1, 0);
  const _ideal = new THREE.Vector3();
  const _radial = new THREE.Vector3();
  const _tangent = new THREE.Vector3();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  let dist = 16;

  function resize() {
    const w = stage.clientWidth || 1;
    const h = stage.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    /* Frame the bus: it is long in x and compact in the ring plane, so the
     * distance that matters depends on which way round the aspect is. */
    /* Riding inside the bus, the depth that matters is how far down the rails
     * you can still read structure. Fog does the rest of the framing. */
    dist = narrow ? 9 : 11;
    scene.fog.near = dist * 0.35;
    scene.fog.far = dist * 2.6;
  }

  function placeCamera(t) {
    eased.lerp(mouse, 0.045);
    const front = THREE.MathUtils.clamp(S.head, L.xStart, L.xExit);

    /* Seat: a little behind and off the shoulder of the qubit we are riding. */
    const xSeat = front - HERO.lag;
    flightPoint(_p, HERO.j, HERO.sign, xSeat, t);
    flightPoint(_q, HERO.j, HERO.sign, front + HERO.lead, t);

    const a = RAIL_ANGLE[HERO.j];
    _centre.set(xSeat, Math.sin(a) * L.ring, Math.cos(a) * L.ring);
    _radial.subVectors(_p, _centre);
    if (_radial.lengthSq() < 1e-8) _radial.set(0, 1, 0);
    _radial.normalize();
    _tangent.crossVectors(_radial, WORLD_UP);
    if (_tangent.lengthSq() < 1e-8) _tangent.set(0, 0, 1);
    _tangent.normalize();

    _ideal.copy(_p)
      .addScaledVector(_radial, HERO.out)
      .addScaledVector(WORLD_UP, HERO.lift - eased.y * 0.28)
      .addScaledVector(_tangent, eased.x * 0.55);

    if (!seated) { camPos.copy(_ideal); camLook.copy(_q); seated = true; }
    /* Heavy damping is what turns a tight spiral into a glide. */
    camPos.lerp(_ideal, 0.055);
    camLook.lerp(_q, 0.09);

    /* Lean with the orbit, but never all the way: a full barrel roll every
     * few metres is unreadable. */
    camUp.lerp(_radial, 0.03).lerp(WORLD_UP, 0.09).normalize();
    camera.up.copy(camUp);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function onPointer(e) {
    const r = stage.getBoundingClientRect();
    mouse.set(
      ((e.clientX - r.left) / r.width - 0.5) * 2,
      ((e.clientY - r.top) / r.height - 0.5) * 2,
    );
  }

  /* --------------------------------------------------------------- loop */

  const still = Boolean(opts.still);
  let timeline = null;
  let raf = 0;
  let running = false;

  function draw(t) {
    placeCamera(t);
    pose(t);
    applyFade();
    renderer.render(scene, camera);
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    draw(t);
  }

  function start() {
    if (running || still) return;
    running = true;
    timeline?.play();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) return;
    running = false;
    timeline?.pause();
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function renderStill() {
    /* The pose for reduced motion, ?static=1, or a paused tab: the circuit
     * fully drawn and measured, seen from a readable angle. */
    S.head = L.xExit; S.split = 1; S.phase = Math.PI * 1.4;
    S.collapse = 0.85; S.caption = 1; S.fade = 1; S.chords = 0.35;
    for (let i = 0; i < RIBBON; i++) {
      const x = L.xStart + ((L.xExit - L.xStart) * i) / (RIBBON - 1);
      for (const f of flyers) pushRibbon(f.ribbon, flightPoint(_p, f.j, f.sign, x, 0));
      pushRibbon(coreRibbon, corePoint(_p, x, 0));
    }
    draw(2600);
  }

  resize();

  if (still) {
    renderStill();
  } else {
    timeline = buildTimeline();
    timeline.pause();
  }

  const ro = new ResizeObserver(() => {
    resize();
    if (!running) draw(performance.now());
  });
  ro.observe(stage);

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && !document.hidden) start(); else stop();
    }
  }, { threshold: 0.02 });
  io.observe(stage);

  function onVisibility() {
    if (document.hidden) stop();
    else if (stage.getBoundingClientRect().bottom > 0) start();
  }

  if (!still) {
    document.addEventListener('visibilitychange', onVisibility);
    stage.addEventListener('pointermove', onPointer);
    stage.addEventListener('pointerleave', () => mouse.set(0, 0));
  }

  stage.dataset.webgl = 'yes';

  return {
    destroy() {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      timeline?.revert?.();
      const shared = new Set([barGeo, dartGeo, nodeGeo]);
      scene.traverse((o) => {
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
        if (o.geometry && !shared.has(o.geometry)) o.geometry.dispose();
      });
      renderer.dispose();
      canvas.remove();
      delete stage.dataset.webgl;
    },
  };
}
