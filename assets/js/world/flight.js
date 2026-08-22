/*
 * flight.js — eight restrained qubit forms moving around the closed world.
 * Copyright (c) 2026 Chang He. MIT (see /LICENSE).
 *
 * Position and visual state are analytic functions of the loop coordinate.
 * No history buffer, random walk or runtime quantum simulation is involved.
 */

import * as THREE from 'three';
import { GATES } from './curve.js';
import { ACCENT, ACCENT_2, INK, PAPER } from './circuit.js';
import { samplePrecomputedState } from './states.js';

const TAU = Math.PI * 2;
const COHORTS = 2;
const COHORT_ALPHA = [1, 0.43];
const STAGGER = [0, 0.0032, -0.0022, 0.0044];
const ORBIT_PHASE = [0.08, 0.34, 0.60, 0.84];
const TRAIL_SPAN = 0.026;
const TRAIL_N = 42;
const EPS = 0.00034;
const NEAR_FADE = [3.6, 6.4];
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const PHASE = new THREE.Color('#6757a6');
const PHASE_ARC = Math.PI * 1.48;

const smoothstep = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function chordsAt(t) {
  const [start, end] = GATES.qft;
  return smoothstep(start - 0.025, start + 0.015, t)
    * (1 - smoothstep(end - 0.015, end + 0.025, t));
}

function makeBlochGeometry(radius = 0.315, segments = 48) {
  const positions = [];
  const point = (plane, angle) => {
    const a = Math.cos(angle) * radius;
    const b = Math.sin(angle) * radius;
    if (plane === 0) return [a, b, 0];
    if (plane === 1) return [a, 0, b];
    return [0, a, b];
  };
  for (let plane = 0; plane < 3; plane++) {
    for (let i = 0; i < segments; i++) {
      positions.push(...point(plane, TAU * i / segments));
      positions.push(...point(plane, TAU * (i + 1) / segments));
    }
  }
  const reach = radius * 1.14;
  positions.push(-reach, 0, 0, reach, 0, 0);
  positions.push(0, -reach, 0, 0, reach, 0);
  positions.push(0, 0, -reach, 0, 0, reach);
  return new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
}

function makeStateVectorGeometry(length = 0.30) {
  const wing = 0.052;
  const neck = length - 0.072;
  return new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute([
      0, 0, 0, 0, length, 0,
      0, length, 0, wing, neck, 0,
      0, length, 0, -wing, neck, 0,
      0, length, 0, 0, neck, wing,
      0, length, 0, 0, neck, -wing,
    ], 3),
  );
}

export function buildFlight(loop, { registry }) {
  const group = new THREE.Group();
  const coreGeometry = new THREE.IcosahedronGeometry(0.125, 2);
  const cageGeometry = makeBlochGeometry();
  const vectorGeometry = makeStateVectorGeometry();
  const phaseArcGeometry = new THREE.TorusGeometry(0.338, 0.005, 4, 52, PHASE_ARC);
  const phaseMarkerGeometry = new THREE.ConeGeometry(0.026, 0.07, 4);
  const poleGeometry = new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, -0.315, 0, 0, 0.315, 0], 3),
  );

  function standardMaterial(color, opacity, extra = {}) {
    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      roughness: 0.72,
      metalness: 0.02,
      flatShading: true,
      ...extra,
    });
    registry.push({ m: material, base: opacity });
    return material;
  }

  function basicMaterial(color, opacity, extra = {}) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      ...extra,
    });
    registry.push({ m: material, base: opacity });
    return material;
  }

  function lineMaterial(color, opacity) {
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      fog: true,
    });
    registry.push({ m: material, base: opacity });
    return material;
  }

  function pointsMaterial(color, opacity, size) {
    const material = new THREE.PointsMaterial({
      color,
      transparent: true,
      opacity,
      size,
      sizeAttenuation: true,
      depthWrite: false,
      fog: true,
    });
    registry.push({ m: material, base: opacity });
    return material;
  }

  function makeQubit(color, alpha, scale) {
    const root = new THREE.Group();
    root.scale.setScalar(scale);
    root.frustumCulled = false;

    const coreMaterial = standardMaterial(color, 0.52 * alpha, {
      emissive: color,
      emissiveIntensity: 0.16,
      roughness: 0.42,
    });
    const cageMaterial = lineMaterial(color.clone().lerp(PAPER, 0.18), 0.40 * alpha);
    const vectorMaterial = lineMaterial(INK.clone().lerp(color, 0.44), 0.82 * alpha);
    const phaseMaterial = basicMaterial(PHASE.clone().lerp(color, 0.22), 0.48 * alpha);
    const poleMaterial = pointsMaterial(INK.clone().lerp(color, 0.30), 0.62 * alpha, 0.038);
    const ghostMaterial = pointsMaterial(PHASE.clone().lerp(PAPER, 0.12), 0.36 * alpha, 0.082);

    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    const cage = new THREE.LineSegments(cageGeometry, cageMaterial);
    const vector = new THREE.LineSegments(vectorGeometry, vectorMaterial);
    const phaseFrame = new THREE.Group();
    const phaseSweep = new THREE.Group();
    const phaseArc = new THREE.Mesh(phaseArcGeometry, phaseMaterial);
    const phaseMarker = new THREE.Mesh(phaseMarkerGeometry, phaseMaterial);
    phaseMarker.position.set(Math.cos(PHASE_ARC) * 0.338, Math.sin(PHASE_ARC) * 0.338, 0);
    phaseMarker.rotation.z = PHASE_ARC;
    const poles = new THREE.Points(poleGeometry, poleMaterial);
    const ghostGeometry = new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3),
    );
    const ghosts = new THREE.Points(ghostGeometry, ghostMaterial);
    phaseSweep.add(phaseArc, phaseMarker);
    phaseFrame.add(phaseSweep);
    root.add(cage, poles, ghosts, core, vector, phaseFrame);

    return {
      root,
      core,
      cage,
      vector,
      phaseFrame,
      phaseSweep,
      phaseArc,
      ghosts,
      materials: [coreMaterial, cageMaterial, vectorMaterial, phaseMaterial, poleMaterial, ghostMaterial],
      bases: [0.52 * alpha, 0.40 * alpha, 0.82 * alpha, 0.48 * alpha, 0.62 * alpha, 0.36 * alpha],
      baseColor: color.clone(),
    };
  }

  function makeFilament(color, opacity) {
    const geometries = [];
    const lines = [];
    for (let strand = 0; strand < 2; strand++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3));
      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: strand === 0 ? opacity : opacity * 0.58,
        depthWrite: false,
        fog: true,
      });
      registry.push({ m: material, base: material.opacity });
      const line = new THREE.Line(geometry, material);
      line.frustumCulled = false;
      geometries.push(geometry);
      lines.push(line);
    }
    return { geometries, lines, color, base: opacity };
  }

  const flyers = [];
  for (let cohort = 0; cohort < COHORTS; cohort++) {
    const lead = cohort * 0.5;
    const alpha = COHORT_ALPHA[cohort];
    for (let j = 0; j < 4; j++) {
      const color = (j % 2 ? ACCENT_2 : ACCENT).clone();
      const followed = cohort === 0 && j === 0;
      const visual = makeQubit(color, alpha, followed ? 1.07 : cohort === 0 ? 0.90 : 0.78);
      const filament = makeFilament(color, (followed ? 0.34 : 0.24) * alpha);
      group.add(visual.root, ...filament.lines);
      flyers.push({
        cohort,
        lead,
        j,
        visual,
        filament,
        followed,
        currentT: 0,
        displayFade: 0,
        state: { qubits: Array.from({ length: 4 }, () => ({})) },
      });
    }
  }

  const leader = flyers.find((flyer) => flyer.followed);
  const _axisPoint = new THREE.Vector3();
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _forward = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _side = new THREE.Vector3();
  const _direction = new THREE.Vector3();
  const _basis = new THREE.Matrix4();
  const _targetQuaternion = new THREE.Quaternion();
  const _stateQuaternion = new THREE.Quaternion();
  const _color = new THREE.Color();
  const follow = {
    t: 0,
    position: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    up: new THREE.Vector3(),
    side: new THREE.Vector3(),
  };

  function routeT(flyer, head) {
    return loop.wrap(head + flyer.lead + STAGGER[flyer.j]);
  }

  function positionOf(flyer, head, out) {
    const t = routeT(flyer, head);
    const breath = 0.068 + 0.018 * Math.sin(TAU * (2 * t + flyer.j * 0.19));
    const orbit = TAU * (t + ORBIT_PHASE[flyer.j] + flyer.cohort * 0.17);
    return loop.rail(flyer.j, t, orbit, breath, out);
  }

  function nearness(point, camera, followed) {
    if (!camera || followed) return 1;
    return smoothstep(NEAR_FADE[0], NEAR_FADE[1], camera.position.distanceTo(point));
  }

  function resetOpacity(visual, fade) {
    for (let i = 0; i < visual.materials.length; i++) {
      visual.materials[i].opacity = visual.bases[i] * fade;
    }
    visual.root.visible = fade > 0.008;
  }

  function poseQubit(flyer, head, dt, camera, emphasis) {
    const t = routeT(flyer, head);
    flyer.currentT = t;
    positionOf(flyer, head, _a);
    positionOf(flyer, head + EPS, _b);
    loop.point(t, _axisPoint);
    flyer.visual.root.position.copy(_a);

    _forward.subVectors(_b, _a).normalize();
    _up.subVectors(_a, _axisPoint);
    if (_up.lengthSq() < 1e-8) loop.normal(t, _up);
    _up.normalize();
    _side.crossVectors(_forward, _up).normalize();
    _up.crossVectors(_side, _forward).normalize();
    _basis.makeBasis(_forward, _up, _side);
    _targetQuaternion.setFromRotationMatrix(_basis);
    if (!flyer.visual.root.userData.oriented || dt <= 0) {
      flyer.visual.root.quaternion.copy(_targetQuaternion);
      flyer.visual.root.userData.oriented = true;
    } else {
      flyer.visual.root.quaternion.slerp(
        _targetQuaternion,
        1 - Math.exp(-5.4 * Math.min(dt, 0.05)),
      );
    }

    const fade = nearness(_a, camera, flyer.followed)
      * (flyer.followed ? Math.max(emphasis, 0.34) : emphasis);
    flyer.displayFade = fade;
    resetOpacity(flyer.visual, fade);

    const descriptor = samplePrecomputedState(t, flyer.state).qubits[flyer.j];
    _direction.set(
      Math.sin(descriptor.theta) * Math.cos(descriptor.phi),
      Math.cos(descriptor.theta),
      Math.sin(descriptor.theta) * Math.sin(descriptor.phi),
    ).normalize();

    const vectorScale = 0.46 + 0.54 * descriptor.purity;
    _stateQuaternion.setFromUnitVectors(Y_AXIS, _direction);
    flyer.visual.vector.quaternion.slerp(
      _stateQuaternion,
      dt <= 0 ? 1 : 1 - Math.exp(-4.2 * Math.min(dt, 0.05)),
    );
    flyer.visual.vector.scale.setScalar(vectorScale);
    _stateQuaternion.setFromUnitVectors(Z_AXIS, _direction);
    flyer.visual.phaseFrame.quaternion.slerp(
      _stateQuaternion,
      dt <= 0 ? 1 : 1 - Math.exp(-3.4 * Math.min(dt, 0.05)),
    );
    flyer.visual.phaseSweep.rotation.z = -descriptor.phi;
    flyer.visual.core.scale.setScalar(0.76 + 0.24 * descriptor.purity);
    flyer.visual.core.material.opacity *= 0.62 + 0.38 * descriptor.purity;
    flyer.visual.cage.material.opacity *= 0.78 + 0.22 * descriptor.split;
    flyer.visual.vector.material.opacity *= 0.42 + 0.58 * descriptor.purity;
    flyer.visual.phaseArc.material.opacity *= 0.66 + 0.34 * descriptor.purity;

    const ghostPositions = flyer.visual.ghosts.geometry.attributes.position;
    const ghostRadius = 0.16 + descriptor.split * 0.09;
    ghostPositions.setXYZ(0, _direction.x * ghostRadius, _direction.y * ghostRadius, _direction.z * ghostRadius);
    ghostPositions.setXYZ(1, -_direction.x * ghostRadius, -_direction.y * ghostRadius, -_direction.z * ghostRadius);
    ghostPositions.needsUpdate = true;
    flyer.visual.ghosts.material.opacity *= descriptor.split * 0.88;
    _color.copy(flyer.visual.baseColor).lerp(PAPER, (1 - descriptor.purity) * 0.10);
    flyer.visual.core.material.color.copy(_color);
  }

  function poseFilament(flyer, head, camera, emphasis) {
    let closest = Infinity;
    for (let i = 0; i < TRAIL_N; i++) {
      const back = (TRAIL_N - 1 - i) / (TRAIL_N - 1);
      const sampleHead = head - back * TRAIL_SPAN;
      const t = routeT(flyer, sampleHead);
      positionOf(flyer, sampleHead, _a);
      loop.point(t, _axisPoint);
      if (camera) closest = Math.min(closest, camera.position.distanceToSquared(_a));
      _up.subVectors(_a, _axisPoint);
      if (_up.lengthSq() < 1e-8) loop.normal(t, _up);
      _up.normalize();
      positionOf(flyer, sampleHead + EPS, _b);
      _forward.subVectors(_b, _a).normalize();
      _side.crossVectors(_forward, _up).normalize();

      const taper = (1 - back) ** 1.45;
      const phase = TAU * (back * 2.25 + t * 3.0 + flyer.j * 0.17 + flyer.cohort * 0.31);
      const separation = 0.010 + 0.027 * (1 - taper);
      for (let strand = 0; strand < 2; strand++) {
        const wave = Math.sin(phase + (strand ? Math.PI : 0));
        const quadrature = Math.cos(phase + (strand ? Math.PI : 0));
        const position = flyer.filament.geometries[strand].attributes.position.array;
        const color = flyer.filament.geometries[strand].attributes.color.array;
        const offset = i * 3;
        position[offset] = _a.x + (_up.x * wave + _side.x * quadrature * 0.46) * separation;
        position[offset + 1] = _a.y + (_up.y * wave + _side.y * quadrature * 0.46) * separation;
        position[offset + 2] = _a.z + (_up.z * wave + _side.z * quadrature * 0.46) * separation;
        _color.copy(PAPER).lerp(strand ? PHASE : flyer.filament.color, 0.10 + 0.90 * taper);
        color[offset] = _color.r;
        color[offset + 1] = _color.g;
        color[offset + 2] = _color.b;
      }
    }

    const near = !camera || flyer.followed
      ? 1
      : smoothstep(NEAR_FADE[0], NEAR_FADE[1], Math.sqrt(closest));
    const strength = near * (flyer.followed ? Math.max(emphasis, 0.28) : emphasis);
    flyer.filament.geometries.forEach((geometry, strand) => {
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      const line = flyer.filament.lines[strand];
      line.material.opacity = flyer.filament.base * (strand ? 0.58 : 1) * strength;
      line.visible = line.material.opacity > 0.006;
    });
  }

  function followFrame(flowHead) {
    follow.t = routeT(leader, flowHead);
    positionOf(leader, flowHead, follow.position);
    positionOf(leader, flowHead + EPS, _b);
    follow.forward.subVectors(_b, follow.position).normalize();
    loop.point(follow.t, _axisPoint);
    follow.up.subVectors(follow.position, _axisPoint);
    if (follow.up.lengthSq() < 1e-8) loop.normal(follow.t, follow.up);
    follow.up.normalize();
    follow.side.crossVectors(follow.forward, follow.up).normalize();
    follow.up.crossVectors(follow.side, follow.forward).normalize();
    return follow;
  }

  return {
    group,
    flyers,
    chordsAt,
    followFrame,
    update(flowHead, dt, camera, emphasis = 1) {
      for (const flyer of flyers) {
        poseQubit(flyer, flowHead, dt, camera, emphasis);
        poseFilament(flyer, flowHead, camera, emphasis);
      }
    },
  };
}
