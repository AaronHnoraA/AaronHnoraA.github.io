/*
 * panels.js — the page's own content, lifted into the world.
 * These are not pictures of text. Each panel is the real <section> element
 * from the document, moved into a CSS3DObject: still selectable, still
 * searchable, still reachable by a screen reader, still a link when it is a
 * link. If this module never runs, the same markup is a plain page.
 *
 * The one thing CSS3D cannot do is share a depth buffer with WebGL, so panels
 * and circuit cannot occlude each other. Rather than hide that, the panels are
 * translucent paper: the circuit reads through them, which is the look anyway.
 */

import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from './css3d.js';
import { GATES } from './curve.js';
import { seatFrame } from './rig.js';
import { renderMath } from './math.js';
import { SHOR_STEPS, shorStepAt } from './states.js';

/** How far ahead of the viewer a panel stands when it comes into view. */
const AHEAD = 8.9;
/** How far to one side, and how far up, in the viewer's own frame. */
const SIDE = 3.25;
/** How far back along the loop the viewer is at that moment. */
const APPROACH = 0.038;
/** CSS pixels per world unit: panels are authored at real px, then scaled. */
const PX_PER_UNIT = 240;
const tex = String.raw;
const GATE_LABELS = Object.freeze([
  { id: 'h', t: GATES.hadamard, rail: 1, name: 'Hadamard', math: tex`H^{\otimes4}` },
  { id: 'u1', t: GATES.modexp[0], rail: 0, name: 'Controlled modular power', math: tex`C\!U^{1}` },
  { id: 'u2', t: GATES.modexp[1], rail: 1, name: 'Controlled modular power', math: tex`C\!U^{2}` },
  { id: 'u4', t: GATES.modexp[2], rail: 2, name: 'Controlled modular power', math: tex`C\!U^{4}` },
  { id: 'u8', t: GATES.modexp[3], rail: 3, name: 'Controlled modular power', math: tex`C\!U^{8}` },
  { id: 'period', t: GATES.qft[0] - 0.015, rail: 0, name: 'Period encoded', math: tex`f(x)=2^x\bmod15` },
  { id: 'qft', t: (GATES.qft[0] + GATES.qft[1]) / 2, rail: 0, name: 'Inverse Fourier transform', math: tex`\operatorname{QFT}_{16}^{\dagger}` },
  { id: 'measure', t: GATES.measure, rail: 1, name: 'Measurement', math: tex`\mathcal M_Z` },
]);

/** Panels fade in as they are approached and out once they are passed: a
 *  panel seen from behind renders mirrored, and one far down the loop is
 *  illegible clutter. */
const FADE_FAR = [23, 32];
/* And out again as it is passed, before it fills the screen edge to edge. */
const FADE_CLOSE = [4.7, 7.0];

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

const wrap = (t) => ((t % 1) + 1) % 1;
const numberFrom = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function largestGapMidpoint(used) {
  if (!used.length) return 0.035;
  const sorted = [...used].sort((a, b) => a - b);
  let start = sorted[0];
  let gap = -1;
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const b = i === sorted.length - 1 ? sorted[0] + 1 : sorted[i + 1];
    if (b - a > gap) { start = a; gap = b - a; }
  }
  return wrap(start + gap / 2);
}

/** The HTML sections are the content registry. A new `.panel[id]` therefore
 * becomes a flat section, a CSS3D card and a route station without a JS edit.
 * Explicit positions preserve art direction; omitted positions are placed in
 * the largest free arc of the closed world. */
export function collectPanelStations(host) {
  const elements = [...host.querySelectorAll(':scope > section.panel[id]')];
  const ids = new Set();
  for (const el of elements) {
    if (ids.has(el.id)) throw new Error(`Duplicate panel id: #${el.id}`);
    ids.add(el.id);
    if (el.dataset.worldT && !Number.isFinite(Number(el.dataset.worldT))) {
      console.warn(`Ignoring invalid data-world-t on #${el.id}`);
    }
  }
  const used = elements
    .map((el) => numberFrom(el.dataset.worldT, NaN))
    .filter(Number.isFinite)
    .map(wrap);

  return elements.map((el) => {
    let t = numberFrom(el.dataset.worldT, NaN);
    if (Number.isFinite(t)) t = wrap(t);
    else {
      t = largestGapMidpoint(used);
      used.push(t);
    }
    const defaultLabel = el.id
      .split('-')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return Object.freeze({
      id: el.id,
      el,
      t,
      label: el.dataset.worldLabel || defaultLabel,
      shot: Object.freeze({
        side: Math.sign(numberFrom(el.dataset.worldSide, 1)) || 1,
        lift: numberFrom(el.dataset.worldLift, 0.3),
      }),
    });
  });
}

export function buildPanels(loop, scene, host, circuit, flight, stations) {
  const renderer = new CSS3DRenderer();
  renderer.domElement.className = 'world-css';
  host.appendChild(renderer.domElement);
  const focusLayer = document.createElement('div');
  focusLayer.className = 'panel-focus-layer';
  focusLayer.setAttribute('aria-live', 'off');
  host.appendChild(focusLayer);

  const panels = [];
  const gateLabels = [];
  const qubitLabels = [];

  stations.forEach(({ id, el, t, shot }) => {

    /* Every station uses the same screen-side safe area.  The previous
     * alternating layout made the circuit and content compete unpredictably;
     * the circuit now owns the left/depth field and reading owns the right. */
    const view = seatFrame(loop, t - APPROACH);
    const side = (shot?.side ?? 1) * SIDE;
    const rise = shot?.lift ?? 0.3;

    const object = new CSS3DObject(el);
    object.position.copy(view.pos)
      .addScaledVector(view.forward, AHEAD)
      .addScaledVector(view.right, side)
      .addScaledVector(view.up, rise);
    /* Face where the viewer is coming from. Panels stay level in the world,
     * like real signage: what tilt you see is the camera's own bank. */
    object.lookAt(view.pos);
    object.scale.setScalar(1 / PX_PER_UNIT);

    scene.add(object);
    el.classList.add('is-panel');

    const panel = {
      id, t, object, el, forward: new THREE.Vector3(), visible: 1,
      promoted: false, worldTransform: '',
    };
    panels.push(panel);
  });

  for (const spec of GATE_LABELS) {
    const el = document.createElement('div');
    el.className = 'gate-label';
    el.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'gate-label-name';
    name.textContent = spec.name;
    const math = document.createElement('span');
    math.className = 'gate-label-math';
    renderMath(math, spec.math);
    el.append(name, math);

    el.style.opacity = '0';
    el.style.visibility = 'hidden';
    const object = new CSS3DObject(el);
    object.scale.setScalar(1 / PX_PER_UNIT);
    scene.add(object);
    gateLabels.push({
      ...spec,
      anchor: circuit?.gateAnchors?.[spec.id] || null,
      object,
      el,
      visible: 0,
    });
  }

  /* Algorithm telemetry belongs to the quantum objects, not to the page UI.
   * These CSS3D annotations follow the primary Bloch forms. The flat document
   * never contains a second copy of any of this 3D-only material. */
  const primaryFlyers = (flight?.flyers || [])
    .filter((flyer) => flyer.cohort === 0)
    .sort((a, b) => a.j - b.j);
  for (const flyer of primaryFlyers) {
    const el = document.createElement('div');
    el.className = 'qubit-label';
    el.setAttribute('aria-hidden', 'true');
    const index = document.createElement('b');
    index.textContent = `q${flyer.j}`;
    const math = document.createElement('span');
    math.className = 'qubit-label-math';
    el.append(index, math);
    el.style.opacity = '0';
    el.style.visibility = 'hidden';

    const object = new CSS3DObject(el);
    object.scale.setScalar(1 / PX_PER_UNIT);
    scene.add(object);
    qubitLabels.push({ flyer, object, el, math, stepId: '', visible: 0 });
  }

  const stageEl = document.createElement('div');
  stageEl.className = 'quantum-stage-label';
  stageEl.setAttribute('aria-hidden', 'true');
  stageEl.innerHTML = `
    <span class="quantum-stage-meta"></span>
    <strong class="quantum-stage-name"></strong>
    <span class="quantum-stage-math"></span>
  `;
  stageEl.style.opacity = '0';
  stageEl.style.visibility = 'hidden';
  const stageObject = new CSS3DObject(stageEl);
  stageObject.scale.setScalar(1 / PX_PER_UNIT);
  scene.add(stageObject);
  const stageLabel = {
    flyer: primaryFlyers[0] || null,
    object: stageObject,
    el: stageEl,
    meta: stageEl.querySelector('.quantum-stage-meta'),
    name: stageEl.querySelector('.quantum-stage-name'),
    math: stageEl.querySelector('.quantum-stage-math'),
    stepId: '',
    visible: 0,
  };

  const _toCam = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _cameraRight = new THREE.Vector3();
  const _cameraUp = new THREE.Vector3();

  function setVisibility(item, want) {
    if (Math.abs(want - item.visible) <= 0.002) return;
    item.visible = want;
    item.el.style.opacity = want.toFixed(3);
    item.el.style.visibility = want < 0.02 ? 'hidden' : 'visible';
  }

  return {
    panels,
    gateLabels,
    qubitLabels,
    renderer,

    /** Called every frame: decide which panels are worth showing. */
    update(camera, focused, head = 0) {
      for (const p of panels) {
        _toCam.subVectors(camera.position, p.object.position);
        const distance = _toCam.length();
        _toCam.divideScalar(distance || 1);
        _fwd.set(0, 0, 1).applyQuaternion(p.object.quaternion);

        const facing = smoothstep(0.05, 0.42, _fwd.dot(_toCam));
        const far = 1 - smoothstep(FADE_FAR[0], FADE_FAR[1], distance);
        const close = smoothstep(FADE_CLOSE[0], FADE_CLOSE[1], distance);
        const want = p === focused ? 1 : facing * far * close;

        if (Math.abs(want - p.visible) > 0.002) {
          p.visible = want;
          p.el.style.opacity = want.toFixed(3);
          p.el.style.visibility = want < 0.02 ? 'hidden' : 'visible';
        }
      }
      _cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
      _cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
      for (const label of gateLabels) {
        if (label.anchor) label.anchor.getWorldPosition(label.object.position);
        else loop.point(label.t, label.object.position);
        label.object.position.addScaledVector(_cameraUp, -0.35)
          .addScaledVector(_cameraRight, 0.42);
        label.object.quaternion.copy(camera.quaternion);
        _toCam.subVectors(camera.position, label.object.position);
        const distance = _toCam.length();
        const labelScale = THREE.MathUtils.clamp(distance / 6, 0.82, 2.8) / PX_PER_UNIT;
        label.object.scale.setScalar(labelScale);
        const far = 1 - smoothstep(18, 26, distance);
        const close = smoothstep(2.8, 4.6, distance);
        const along = Math.abs(loop.delta(head, label.t));
        const current = 1 - smoothstep(0.045, 0.095, along);
        const want = far * close * current * (focused ? 0.055 : 0.82);
        setVisibility(label, want);
      }

      for (const label of qubitLabels) {
        label.flyer.visual.root.getWorldPosition(label.object.position);
        label.object.position
          .addScaledVector(_cameraRight, label.flyer.j % 2 ? 0.46 : 0.58)
          .addScaledVector(_cameraUp, label.flyer.j > 1 ? -0.22 : 0.28);
        label.object.quaternion.copy(camera.quaternion);

        const step = shorStepAt(label.flyer.currentT ?? head);
        if (step.id !== label.stepId) {
          label.stepId = step.id;
          renderMath(label.math, step.qubits[label.flyer.j]);
        }

        _toCam.subVectors(camera.position, label.object.position);
        const distance = _toCam.length();
        const labelScale = THREE.MathUtils.clamp(distance / 7.2, 0.68, 1.9) / PX_PER_UNIT;
        label.object.scale.setScalar(labelScale);
        const far = 1 - smoothstep(15, 22, distance);
        const close = smoothstep(2.3, 3.7, distance);
        const want = far * close * (label.flyer.displayFade ?? 1) * (focused ? 0.035 : 0.78);
        setVisibility(label, want);
      }

      if (stageLabel.flyer) {
        stageLabel.flyer.visual.root.getWorldPosition(stageLabel.object.position);
        stageLabel.object.position
          .addScaledVector(_cameraRight, 0.92)
          .addScaledVector(_cameraUp, 1.02);
        stageLabel.object.quaternion.copy(camera.quaternion);

        const step = shorStepAt(stageLabel.flyer.currentT ?? head);
        if (step.id !== stageLabel.stepId) {
          stageLabel.stepId = step.id;
          const index = SHOR_STEPS.indexOf(step) + 1;
          stageLabel.meta.textContent = `${String(index).padStart(2, '0')} / ${SHOR_STEPS.length}`;
          stageLabel.name.textContent = step.title;
          renderMath(stageLabel.math, step.formula);
        }

        _toCam.subVectors(camera.position, stageLabel.object.position);
        const distance = _toCam.length();
        const stageScale = THREE.MathUtils.clamp(distance / 7.2, 0.68, 1.75) / PX_PER_UNIT;
        stageLabel.object.scale.setScalar(stageScale);
        const far = 1 - smoothstep(16, 23, distance);
        const close = smoothstep(2.7, 4.0, distance);
        const want = far * close * (stageLabel.flyer.displayFade ?? 1) * (focused ? 0.025 : 0.72);
        setVisibility(stageLabel, want);
      }
    },
    byId: (id) => panels.find((p) => p.id === id),
    promote(panel) {
      if (!panel || panel.promoted) return;
      panel.promoted = true;
      panel.worldTransform = panel.el.style.transform;
      scene.remove(panel.object);
      panel.el.classList.add('is-overlay');
      panel.el.style.position = 'relative';
      panel.el.style.transform = 'none';
      panel.el.style.userSelect = 'text';
      panel.el.style.visibility = 'visible';
      panel.el.style.opacity = '1';
      panel.el.style.display = '';
      focusLayer.appendChild(panel.el);
    },
    restore(panel) {
      if (!panel?.promoted) return;
      panel.promoted = false;
      panel.el.classList.remove('is-overlay');
      panel.el.style.position = 'absolute';
      panel.el.style.transform = panel.worldTransform;
      panel.el.style.userSelect = 'none';
      panel.el.style.opacity = panel.visible.toFixed(3);
      panel.el.style.visibility = panel.visible < 0.02 ? 'hidden' : 'visible';
      scene.add(panel.object);
    },
    render(scene_, camera) { renderer.render(scene_, camera); },
    setSize(w, h) { renderer.setSize(w, h); },
    dispose() { focusLayer.remove(); renderer.domElement.remove(); },
  };
}
