/*
 * circuit.js — an abstract quantum structure along the closed loop.
 * Copyright (c) 2026 Chang He. MIT (see /LICENSE).
 *
 * The geometry keeps the rhythm of the hidden precomputed circuit without
 * putting notation or tutorial copy into the personal homepage.
 */

import * as THREE from 'three';
import { GATES, RAIL_ANGLE, RAIL_R } from './curve.js';

export const PAPER = new THREE.Color('#f4f1e9');
export const INK = new THREE.Color('#1b1a17');
export const ACCENT = new THREE.Color('#2f6673');
export const ACCENT_2 = new THREE.Color('#a56b45');

const Z = new THREE.Vector3(0, 0, 1);

export function makeInk(registry) {
  return function ink(color, opacity, extra = {}) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      ...extra,
    });
    registry.push({ m: material, base: opacity });
    return material;
  };
}

function alignToLoop(object, loop, t) {
  loop.point(t, object.position);
  object.quaternion.setFromUnitVectors(Z, loop.tangent(t));
}

export function buildCircuit(loop, { registry }) {
  const group = new THREE.Group();
  const ink = makeInk(registry);
  const ringGeometry = (radius, tube, arc = Math.PI * 2) =>
    new THREE.TorusGeometry(radius, tube, 6, 40, arc);

  function railTube(points, radius, opacity, color) {
    const path = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
    return new THREE.Mesh(
      new THREE.TubeGeometry(path, 420, radius, 5, true),
      ink(color, opacity),
    );
  }

  for (let j = 0; j < 4; j++) {
    group.add(railTube(loop.railPoints(j, 300), 0.0075, 0.18, INK));
  }
  group.add(railTube(loop.corePoints(300), 0.011, 0.14, ACCENT));

  /* Quiet threshold rings: readable as spatial rhythm, not as gate labels. */
  const hadamards = [];
  for (let j = 0; j < 4; j++) {
    const station = new THREE.Group();
    alignToLoop(station, loop, GATES.hadamard);
    const angle = RAIL_ANGLE[j];
    const hoop = new THREE.Mesh(ringGeometry(0.38, 0.010), ink(INK, 0.24));
    hoop.position.set(Math.cos(angle) * RAIL_R, Math.sin(angle) * RAIL_R, 0);
    station.add(hoop);
    group.add(station);
    hadamards.push({ hoop, t: GATES.hadamard });
  }

  const modexp = GATES.modexp.map((t, j) => {
    const station = new THREE.Group();
    alignToLoop(station, loop, t);
    const angle = RAIL_ANGLE[j];
    const rail = new THREE.Vector3(
      Math.cos(angle) * RAIL_R,
      Math.sin(angle) * RAIL_R,
      0,
    );
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 10, 7),
      ink(j % 2 ? ACCENT_2 : ACCENT, 0.58),
    );
    dot.position.copy(rail);
    station.add(dot);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, RAIL_R, 5),
      ink(INK, 0.12),
    );
    beam.position.copy(rail).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rail.clone().normalize());
    station.add(beam);

    const inner = new THREE.Mesh(ringGeometry(0.34, 0.008), ink(INK, 0.16));
    inner.rotation.z = Math.PI / 4 + j * 0.24;
    station.add(inner);
    group.add(station);
    return { dot, beam, t };
  });

  const [qftStart, qftEnd] = GATES.qft;
  const cageRadius = RAIL_R + 0.55;
  const qft = new THREE.Group();
  const qftChords = [];
  for (const t of [qftStart, (qftStart + qftEnd) / 2, qftEnd]) {
    const hoop = new THREE.Mesh(ringGeometry(cageRadius, 0.008), ink(ACCENT, 0.10));
    alignToLoop(hoop, loop, t);
    qft.add(hoop);
  }
  for (let k = 0; k < 6; k++) {
    const angle = (Math.PI * 2 * k) / 6;
    const points = [];
    for (let i = 0; i <= 20; i++) {
      points.push(loop.offset(
        qftStart + ((qftEnd - qftStart) * i) / 20,
        angle,
        cageRadius,
        new THREE.Vector3(),
      ));
    }
    const spar = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    qft.add(new THREE.Mesh(
      new THREE.TubeGeometry(spar, 20, 0.0055, 4, false),
      ink(INK, 0.045),
    ));
  }
  for (let j = 0; j < 4; j++) {
    const k = (j + 1) % 4;
    const t = qftStart + 0.018 + (j / 4) * (qftEnd - qftStart - 0.036);
    const from = loop.rail(j, t, 0, 0, new THREE.Vector3());
    const to = loop.rail(k, t, 0, 0, new THREE.Vector3());
    const chord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, from.distanceTo(to), 4),
      ink(ACCENT, 0),
    );
    chord.position.copy(from).add(to).multiplyScalar(0.5);
    chord.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      to.clone().sub(from).normalize(),
    );
    qft.add(chord);
    qftChords.push(chord);
  }
  group.add(qft);

  const meters = [];
  for (let j = 0; j < 4; j++) {
    const station = new THREE.Group();
    alignToLoop(station, loop, GATES.measure);
    const angle = RAIL_ANGLE[j];
    const hoop = new THREE.Mesh(ringGeometry(0.36, 0.009), ink(INK, 0.22));
    hoop.position.set(Math.cos(angle) * RAIL_R, Math.sin(angle) * RAIL_R, 0);
    station.add(hoop);
    const arc = new THREE.Mesh(
      ringGeometry(0.20, 0.008, Math.PI * 0.72),
      ink(j % 2 ? ACCENT_2 : ACCENT, 0.26),
    );
    arc.position.copy(hoop.position);
    arc.rotation.z = Math.PI * 0.14;
    station.add(arc);
    group.add(station);
    meters.push({ hoop, t: GATES.measure });
  }

  return {
    group,
    hadamards,
    modexp,
    meters,
    qftChords,
    update() {},
  };
}
