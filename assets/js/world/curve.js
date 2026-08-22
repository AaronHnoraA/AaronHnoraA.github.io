/*
 * curve.js — one continuous closed frame for the whole circuit.
 * The first version exposed the nearest one of a finite set of frame samples.
 * At cruise speed that left the camera frozen for several display frames and
 * then moved it in one visible step. The samples below are now only control
 * data: positions are evaluated continuously by arc length and the transported
 * frame is interpolated and re-orthogonalised for every query.
 */

import * as THREE from 'three';

const SEGMENTS = 960;

export const RAIL_R = 1.72;
export const RAIL_ANGLE = [0, 1, 2, 3].map((j) => (Math.PI / 2) * j + Math.PI / 4);

export const GATES = {
  prepare: 0.00,
  hadamard: 0.09,
  modexp: [0.21, 0.29, 0.37, 0.45],
  qft: [0.55, 0.65],
  measure: 0.75,
  classical: 0.84,
};

/* A broad asymmetric double-lobed orbit. The apparent crossing is separated
 * vertically, so the circuit reads as one object without becoming a knot. */
function controlPoints() {
  const points = [];
  const count = 16;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    const breathe = 1 + 0.075 * Math.sin(3 * a + 0.45);
    points.push(new THREE.Vector3(
      20.5 * Math.sin(a) * breathe,
      3.1 * Math.cos(a) + 1.15 * Math.sin(3 * a - 0.4),
      9.4 * Math.sin(2 * a) + 2.7 * Math.cos(a + 0.35),
    ));
  }
  return points;
}

export function makeLoop() {
  const curve = new THREE.CatmullRomCurve3(controlPoints(), true, 'catmullrom', 0.5);
  curve.arcLengthDivisions = SEGMENTS * 2;

  const frames = curve.computeFrenetFrames(SEGMENTS, true);
  const wrap = (t) => ((t % 1) + 1) % 1;

  const _frame = {
    point: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    binormal: new THREE.Vector3(),
  };

  function sampleFrame(t, out) {
    const u = wrap(t);
    const fIndex = u * SEGMENTS;
    const i0 = Math.floor(fIndex);
    const i1 = (i0 + 1) % SEGMENTS;
    const mix = fIndex - i0;

    curve.getPointAt(u, out.point);
    out.tangent.copy(frames.tangents[i0])
      .lerp(frames.tangents[i1], mix)
      .normalize();
    out.normal.copy(frames.normals[i0])
      .lerp(frames.normals[i1], mix);

    /* Restore an exact orthonormal basis before consumers use it for offsets. */
    out.normal.addScaledVector(out.tangent, -out.normal.dot(out.tangent));
    if (out.normal.lengthSq() < 1e-10) out.normal.copy(frames.normals[i0]);
    out.normal.normalize();
    out.binormal.crossVectors(out.tangent, out.normal).normalize();
    out.normal.crossVectors(out.binormal, out.tangent).normalize();
    return out;
  }

  const loop = {
    curve,
    length: curve.getLength(),
    wrap,

    frame(t, out = {
      point: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      binormal: new THREE.Vector3(),
    }) {
      return sampleFrame(t, out);
    },

    point(t, out = new THREE.Vector3()) {
      return curve.getPointAt(wrap(t), out);
    },

    tangent(t, out = new THREE.Vector3()) {
      return curve.getTangentAt(wrap(t), out).normalize();
    },

    normal(t, out = new THREE.Vector3()) {
      sampleFrame(t, _frame);
      return out.copy(_frame.normal);
    },

    binormal(t, out = new THREE.Vector3()) {
      sampleFrame(t, _frame);
      return out.copy(_frame.binormal);
    },

    offset(t, angle, radius, out = new THREE.Vector3()) {
      sampleFrame(t, _frame);
      out.copy(_frame.point)
        .addScaledVector(_frame.normal, Math.cos(angle) * radius)
        .addScaledVector(_frame.binormal, Math.sin(angle) * radius);
      return out;
    },

    rail(j, t, orbitAngle = 0, orbitRadius = 0, out = new THREE.Vector3()) {
      sampleFrame(t, _frame);
      const a = RAIL_ANGLE[j];
      out.copy(_frame.point)
        .addScaledVector(_frame.normal, Math.cos(a) * RAIL_R)
        .addScaledVector(_frame.binormal, Math.sin(a) * RAIL_R);
      if (orbitRadius) {
        out.addScaledVector(_frame.normal, Math.cos(orbitAngle) * orbitRadius)
          .addScaledVector(_frame.binormal, Math.sin(orbitAngle) * orbitRadius);
      }
      return out;
    },

    delta(a, b) {
      let d = wrap(b) - wrap(a);
      if (d > 0.5) d -= 1;
      if (d < -0.5) d += 1;
      return d;
    },

    railPoints(j, count = SEGMENTS) {
      const out = [];
      for (let i = 0; i < count; i++) {
        out.push(loop.rail(j, i / count, 0, 0, new THREE.Vector3()));
      }
      return out;
    },

    corePoints(count = SEGMENTS) {
      const out = [];
      for (let i = 0; i < count; i++) out.push(loop.point(i / count, new THREE.Vector3()));
      return out;
    },
  };

  return loop;
}
