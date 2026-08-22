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
import { PANELS } from './curve.js';
import { seatFrame } from './rig.js';

/** How far ahead of the viewer a panel stands when it comes into view. */
const AHEAD = 8.9;
/** How far to one side, and how far up, in the viewer's own frame. */
const SIDE = 3.25;
/** How far back along the loop the viewer is at that moment. */
const APPROACH = 0.038;
/** CSS pixels per world unit: panels are authored at real px, then scaled. */
const PX_PER_UNIT = 240;

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

export function buildPanels(loop, scene, host) {
  const renderer = new CSS3DRenderer();
  renderer.domElement.className = 'world-css';
  host.appendChild(renderer.domElement);

  const panels = [];

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

  const _toCam = new THREE.Vector3();
  const _fwd = new THREE.Vector3();

  return {
    panels,
    renderer,

    /** Called every frame: decide which panels are worth showing. */
    update(camera, focused) {
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
    },
    byId: (id) => panels.find((p) => p.id === id),
    render(scene_, camera) { renderer.render(scene_, camera); },
    setSize(w, h) { renderer.setSize(w, h); },
    dispose() { renderer.domElement.remove(); },
  };
}
