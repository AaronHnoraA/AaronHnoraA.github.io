/*
 * circuit.js — an abstract quantum structure along the closed loop.
 * The geometry keeps the rhythm of the hidden precomputed circuit without
 * putting notation or tutorial copy into the personal homepage.
 */

import * as THREE from 'three';
import { GATES, RAIL_ANGLE, RAIL_R } from './curve.js';

export const PAPER = new THREE.Color('#f4f1e9');
export const INK = new THREE.Color('#1b1a17');
export const ACCENT = new THREE.Color('#2f6673');
export const ACCENT_2 = new THREE.Color('#a56b45');
const PHASE = new THREE.Color('#6757a6');

const Z = new THREE.Vector3(0, 0, 1);
const TAU = Math.PI * 2;

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

function makeLineInk(registry) {
  return function lineInk(color, opacity) {
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      fog: true,
    });
    registry.push({ m: material, base: opacity });
    return material;
  };
}

function lineSegments(points, material) {
  return new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute(points, 3),
    ),
    material,
  );
}

function alignToLoop(object, loop, t) {
  loop.point(t, object.position);
  object.quaternion.setFromUnitVectors(Z, loop.tangent(t));
}

export function buildCircuit(loop, { registry }) {
  const group = new THREE.Group();
  const ink = makeInk(registry);
  const lineInk = makeLineInk(registry);
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

  /* Hadamard portals: actual circuit notation, kept small enough to remain
   * part of the spatial world rather than turn the page into a lesson. */
  const hadamards = [];
  for (let j = 0; j < 4; j++) {
    const station = new THREE.Group();
    alignToLoop(station, loop, GATES.hadamard);
    const angle = RAIL_ANGLE[j];
    const rail = new THREE.Vector3(Math.cos(angle) * RAIL_R, Math.sin(angle) * RAIL_R, 0);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.46),
      ink(j % 2 ? ACCENT_2 : ACCENT, 0.075, { side: THREE.DoubleSide }),
    );
    plate.position.copy(rail);
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.46, 0.46)),
      lineInk(INK, 0.34),
    );
    frame.position.copy(rail);
    frame.position.z += 0.006;
    const mark = lineSegments([
      -0.105, -0.14, 0.014, -0.105, 0.14, 0.014,
      0.105, -0.14, 0.014, 0.105, 0.14, 0.014,
      -0.105, 0, 0.014, 0.105, 0, 0.014,
    ], lineInk(j % 2 ? ACCENT_2 : ACCENT, 0.72));
    mark.position.copy(rail);
    station.add(plate, frame, mark);
    group.add(station);
    hadamards.push({ plate, frame, mark, t: GATES.hadamard });
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

    const targetAngle = RAIL_ANGLE[(j + 2) % 4];
    const target = new THREE.Vector3(
      Math.cos(targetAngle) * RAIL_R,
      Math.sin(targetAngle) * RAIL_R,
      0,
    );
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, rail.distanceTo(target), 5),
      ink(INK, 0.12),
    );
    beam.position.copy(rail).add(target).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      target.clone().sub(rail).normalize(),
    );
    station.add(beam);

    const targetRing = new THREE.Mesh(ringGeometry(0.135, 0.008), ink(PHASE, 0.38));
    targetRing.position.copy(target);
    const targetMark = lineSegments([
      -0.10, 0, 0.01, 0.10, 0, 0.01,
      0, -0.10, 0.01, 0, 0.10, 0.01,
    ], lineInk(PHASE, 0.62));
    targetMark.position.copy(target);
    station.add(targetRing, targetMark);
    group.add(station);
    return { dot, beam, targetRing, targetMark, t };
  });

  const [qftStart, qftEnd] = GATES.qft;
  const cageRadius = RAIL_R + 0.55;
  const qft = new THREE.Group();
  const qftChords = [];
  const qftHoops = [];
  for (const t of [qftStart, (qftStart + qftEnd) / 2, qftEnd]) {
    const hoop = new THREE.Mesh(ringGeometry(cageRadius, 0.008), ink(PHASE, 0.16));
    alignToLoop(hoop, loop, t);
    qft.add(hoop);
    qftHoops.push(hoop);
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
      ink(INK, 0.055),
    ));
  }
  /* Four coherent amplitude paths wind through the transform region. Their
   * crossings make the interference step legible without explanatory copy. */
  for (let j = 0; j < 4; j++) {
    const points = [];
    for (let i = 0; i <= 72; i++) {
      const u = i / 72;
      const t = qftStart + (qftEnd - qftStart) * u;
      const angle = RAIL_ANGLE[j] + TAU * (1.15 * u + j * 0.04);
      const radius = RAIL_R + 0.10 * Math.sin(TAU * (2 * u + j * 0.25));
      points.push(loop.offset(t, angle, radius, new THREE.Vector3()));
    }
    qft.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      lineInk(j % 2 ? PHASE : ACCENT, 0.24),
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
    const needle = lineSegments([
      -0.13, -0.07, 0.012, 0.11, 0.09, 0.012,
      -0.16, -0.12, 0.012, 0.16, -0.12, 0.012,
    ], lineInk(j % 2 ? ACCENT_2 : ACCENT, 0.54));
    needle.position.copy(hoop.position);
    station.add(arc, needle);
    group.add(station);
    meters.push({ hoop, t: GATES.measure });
  }

  return {
    group,
    hadamards,
    modexp,
    meters,
    qftChords,
    gateAnchors: {
      h: hadamards[3].plate,
      u1: modexp[0].dot,
      u2: modexp[1].dot,
      u4: modexp[2].dot,
      u8: modexp[3].dot,
      period: qftHoops[0],
      qft: qftHoops[1],
      measure: meters[1].hoop,
    },
    update() {},
  };
}
