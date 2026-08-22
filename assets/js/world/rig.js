/*
 * rig.js — a calm, horizon-led camera for the closed circuit.
 * Copyright (c) 2026 Chang He. MIT (see /LICENSE).
 */

import * as THREE from 'three';

export const MODE = {
  FOLLOW: 'follow',
  CRUISE: 'cruise',
  TRAVEL: 'travel',
  READ: 'read',
};

const CAMERA_OUT = 7.4;
const CAMERA_UP = 2.45;
const LOOK_AHEAD = 0.052;
const LOOK_RISE = 0.72;
const LOOK_SIDE = -0.65;
const CRUISE_SPEED = 0.0072;
const READ_DISTANCE = 4.8;
const MAX_BANK = THREE.MathUtils.degToRad(3.5);
const FOLLOW_BACK = 5.85;
const FOLLOW_RISE = 1.58;
const FOLLOW_SIDE = 0.72;
const FOLLOW_LOOK = 3.05;

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const dampFactor = (lambda, dt) => 1 - Math.exp(-lambda * dt);

/* A smooth periodic field around the route.  Choosing a sign from the local
 * tangent looks reasonable but flips discontinuously on a double-lobed curve;
 * this explicit field closes exactly and never asks which side is "outside". */
function stableOutward(loop, t, out) {
  const u = loop.wrap(t);
  const angle = Math.PI * 2 * u + 0.18 * Math.sin(Math.PI * 4 * u);
  return out.set(Math.sin(angle), 0, Math.cos(angle));
}

export function seatFrame(loop, t) {
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const outward = stableOutward(loop, t, new THREE.Vector3());

  loop.point(t, pos);
  pos.addScaledVector(outward, CAMERA_OUT)
    .addScaledVector(WORLD_UP, CAMERA_UP + 0.35 * Math.sin(Math.PI * 4 * t + 0.4));

  loop.point(t + LOOK_AHEAD, look);
  look.y += LOOK_RISE;
  look.addScaledVector(outward, LOOK_SIDE);

  const forward = look.clone().sub(pos).normalize();
  const right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  return { pos, look, forward, right, up, outward };
}

export function makeRig(loop, camera) {
  const state = {
    mode: MODE.FOLLOW,
    head: 0,
    drive: 0,
    target: null,
    idleFor: 0,
    paused: false,
    hold: 0,
  };

  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const _seat = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _outward = new THREE.Vector3();
  const _tan0 = new THREE.Vector3();
  const _tan1 = new THREE.Vector3();
  const _forward = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _baseUp = new THREE.Vector3();
  const _panelFacing = new THREE.Vector3();
  const _turn = new THREE.Vector3();
  let seated = false;

  function cruiseSeat(head, outPos, outLook, outUp) {
    stableOutward(loop, head, _outward);
    loop.point(head, outPos);
    outPos.addScaledVector(_outward, CAMERA_OUT)
      .addScaledVector(WORLD_UP, CAMERA_UP + 0.35 * Math.sin(Math.PI * 4 * head + 0.4));

    loop.point(head + LOOK_AHEAD, outLook);
    outLook.y += LOOK_RISE;
    outLook.addScaledVector(_outward, LOOK_SIDE);

    _forward.subVectors(outLook, outPos).normalize();
    _right.crossVectors(_forward, WORLD_UP).normalize();
    _baseUp.crossVectors(_right, _forward).normalize();

    loop.tangent(head, _tan0);
    loop.tangent(head + 0.008, _tan1);
    const signedTurn = _turn.crossVectors(_tan0, _tan1).dot(WORLD_UP);
    const roll = clamp(signedTurn * 3.2, -MAX_BANK, MAX_BANK);
    outUp.copy(_baseUp).multiplyScalar(Math.cos(roll))
      .addScaledVector(_right, Math.sin(roll))
      .normalize();
  }

  function readSeat(panel, outPos, outLook, outUp) {
    outLook.copy(panel.object.position);
    panel.object.getWorldDirection(_panelFacing);
    outPos.copy(outLook).addScaledVector(_panelFacing, READ_DISTANCE);
    outUp.set(0, 1, 0).applyQuaternion(panel.object.quaternion).normalize();
  }

  function followSeat(frame, outPos, outLook, outUp) {
    outPos.copy(frame.position)
      .addScaledVector(frame.forward, -FOLLOW_BACK)
      .addScaledVector(frame.up, FOLLOW_RISE)
      .addScaledVector(frame.side, FOLLOW_SIDE);
    outLook.copy(frame.position)
      .addScaledVector(frame.forward, FOLLOW_LOOK)
      .addScaledVector(frame.up, 0.08)
      .addScaledVector(frame.side, -0.18);

    _forward.subVectors(outLook, outPos).normalize();
    _right.crossVectors(_forward, WORLD_UP).normalize();
    _baseUp.crossVectors(_right, _forward).normalize();
    loop.tangent(frame.t, _tan0);
    loop.tangent(frame.t + 0.010, _tan1);
    const signedTurn = _turn.crossVectors(_tan0, _tan1).dot(frame.up);
    const roll = clamp(signedTurn * 2.6, -MAX_BANK, MAX_BANK);
    outUp.copy(_baseUp).multiplyScalar(Math.cos(roll))
      .addScaledVector(_right, Math.sin(roll))
      .normalize();
  }

  return {
    state,

    push(amount) {
      state.drive = clamp(state.drive + amount, -0.075, 0.075);
      state.idleFor = 0;
      state.hold = 0;
      if (state.mode !== MODE.CRUISE) {
        state.mode = MODE.CRUISE;
        state.target = null;
      }
    },

    seek(t) {
      state.head = loop.wrap(t);
      state.drive = 0;
      state.idleFor = 0;
      state.hold = 0;
      state.mode = MODE.CRUISE;
      state.target = null;
    },

    goTo(panel) {
      state.target = panel;
      state.mode = MODE.TRAVEL;
      state.drive = 0;
      state.idleFor = 0;
      state.hold = 0;
    },

    release() {
      state.mode = MODE.FOLLOW;
      state.target = null;
      state.drive = 0;
      state.hold = 0;
    },

    follow() {
      state.mode = MODE.FOLLOW;
      state.target = null;
      state.drive = 0;
      state.hold = 0;
    },

    setPaused(paused) {
      state.paused = Boolean(paused);
      if (state.paused) state.drive = 0;
    },

    update(dt, followFrame) {
      const step = Math.min(dt, 0.05);
      state.idleFor += step;
      state.hold = Math.max(0, state.hold - step);

      if (state.mode === MODE.FOLLOW && followFrame) {
        state.head = loop.wrap(followFrame.t);
      } else if (state.mode === MODE.TRAVEL && state.target) {
        const d = loop.delta(state.head, state.target.t);
        state.head = loop.wrap(state.head + d * dampFactor(2.35, step));
        if (Math.abs(d) < 0.0012) {
          state.head = state.target.t;
          state.mode = MODE.READ;
        }
      } else if (state.mode === MODE.CRUISE) {
        const auto = state.paused || state.hold > 0 ? 0 : CRUISE_SPEED;
        state.head = loop.wrap(state.head + (auto + state.drive) * step);
        state.drive = THREE.MathUtils.lerp(state.drive, 0, dampFactor(4.1, step));
      }

      if (state.mode === MODE.READ && state.target) {
        readSeat(state.target, _seat, _look, _up);
      } else if (state.mode === MODE.FOLLOW && followFrame) {
        followSeat(followFrame, _seat, _look, _up);
      } else {
        cruiseSeat(state.head, _seat, _look, _up);
      }

      if (!seated) {
        pos.copy(_seat);
        look.copy(_look);
        up.copy(_up);
        seated = true;
      }

      const poseLambda = state.mode === MODE.FOLLOW ? 3.8
        : state.mode === MODE.CRUISE ? 3.2 : 2.55;
      pos.lerp(_seat, dampFactor(poseLambda, step));
      look.lerp(_look, dampFactor(poseLambda + 0.95, step));
      up.lerp(_up, dampFactor(2.7, step)).normalize();

      camera.position.copy(pos);
      camera.up.copy(up);
      camera.lookAt(look);
    },

    settle(head, panel, followFrame) {
      state.head = loop.wrap(head);
      state.mode = panel ? MODE.READ : MODE.FOLLOW;
      state.target = panel || null;
      seated = false;
      this.update(1 / 60, followFrame);
    },
  };
}
