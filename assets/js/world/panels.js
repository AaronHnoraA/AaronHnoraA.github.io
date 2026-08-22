/*
 * panels.js — the page's own content, lifted into the world.
 * Copyright (c) 2026 Chang He. MIT (see /LICENSE).
 *
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
import { GATES, PANELS } from './curve.js';
import { seatFrame } from './rig.js';
import { renderMath } from './math.js';

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

export function buildPanels(loop, scene, host, circuit) {
  const renderer = new CSS3DRenderer();
  renderer.domElement.className = 'world-css';
  host.appendChild(renderer.domElement);

  const panels = [];
  const gateLabels = [];

  PANELS.forEach(({ id, t, shot }) => {
    const el = document.getElementById(id);
    if (!el) return;

    /* Every station uses the same screen-side safe area.  The previous
     * alternating layout made the circuit and content compete unpredictably;
     * the circuit now owns the left/depth field and reading owns the right. */
    const view = seatFrame(loop, t - APPROACH);
    const side = (shot?.side || 1) * SIDE;
    const rise = shot?.lift || 0.3;

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

    const panel = { id, t, object, el, forward: new THREE.Vector3(), visible: 1 };
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

  const _toCam = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _cameraRight = new THREE.Vector3();

  return {
    panels,
    gateLabels,
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
      for (const label of gateLabels) {
        if (label.anchor) label.anchor.getWorldPosition(label.object.position);
        else loop.point(label.t, label.object.position);
        _cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
        label.object.position.addScaledVector(camera.up, -0.35)
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
        const want = far * close * current * (focused ? 0.12 : 1);
        if (Math.abs(want - label.visible) > 0.002) {
          label.visible = want;
          label.el.style.opacity = want.toFixed(3);
          label.el.style.visibility = want < 0.02 ? 'hidden' : 'visible';
        }
      }
    },
    byId: (id) => panels.find((p) => p.id === id),
    render(scene_, camera) { renderer.render(scene_, camera); },
    setSize(w, h) { renderer.setSize(w, h); },
    dispose() { renderer.domElement.remove(); },
  };
}
