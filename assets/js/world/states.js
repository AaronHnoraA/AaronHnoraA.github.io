/*
 * states.js — precomputed visual states for one small Shor demonstration.
 * Copyright (c) 2026 Chang He. MIT (see /LICENSE).
 *
 * This is deliberately a playback table, not a quantum simulator. The browser
 * interpolates display descriptors that were written down for the fixed
 * N = 15, a = 2 example; it never constructs or evolves a state vector.
 */

const PI = Math.PI;
const HALF_PI = PI / 2;

const q = (theta, phi, purity = 1, split = 0) =>
  Object.freeze({ theta, phi, purity, split });

/* `qubits` are Bloch-display descriptors only. `purity` shortens the Bloch
 * vector when a counting qubit is entangled with the work register; `split`
 * opens its coherence shell. Stage names are internal timing markers only. */
export const PRECOMPUTED_STAGES = Object.freeze([
  Object.freeze({
    id: 'prepare', t: 0.000,
    qubits: Object.freeze([q(0, 0), q(0, 0), q(0, 0), q(0, 0)]),
  }),
  Object.freeze({
    id: 'hadamard', t: 0.105,
    qubits: Object.freeze([q(HALF_PI, 0), q(HALF_PI, 0), q(HALF_PI, 0), q(HALF_PI, 0)]),
  }),
  Object.freeze({
    id: 'cu1', t: 0.225,
    qubits: Object.freeze([q(HALF_PI, 0.35, 0.20, 1), q(HALF_PI, 0), q(HALF_PI, 0), q(HALF_PI, 0)]),
  }),
  Object.freeze({
    id: 'cu2', t: 0.305,
    qubits: Object.freeze([q(HALF_PI, 0.35, 0.20, 1), q(HALF_PI, 1.10, 0.20, 1), q(HALF_PI, 0), q(HALF_PI, 0)]),
  }),
  Object.freeze({
    id: 'cu4', t: 0.385,
    qubits: Object.freeze([q(HALF_PI, 0.35, 0.20, 1), q(HALF_PI, 1.10, 0.20, 1), q(HALF_PI, 1.90, 0.20, 1), q(HALF_PI, 0)]),
  }),
  Object.freeze({
    id: 'cu8', t: 0.465,
    qubits: Object.freeze([q(HALF_PI, 0.35, 0.20, 1), q(HALF_PI, 1.10, 0.20, 1), q(HALF_PI, 1.90, 0.20, 1), q(HALF_PI, 2.65, 0.20, 1)]),
  }),
  Object.freeze({
    id: 'periodic', t: 0.535,
    qubits: Object.freeze([q(HALF_PI, 0.55, 0.16, 1), q(HALF_PI, 1.35, 0.16, 1), q(HALF_PI, 2.15, 0.16, 1), q(HALF_PI, 2.95, 0.16, 1)]),
  }),
  Object.freeze({
    id: 'iqft', t: 0.665,
    qubits: Object.freeze([q(HALF_PI, 0.0, 0.72, 0.35), q(HALF_PI, PI, 0.72, 0.35), q(PI * 0.72, PI / 2, 0.72, 0.35), q(HALF_PI, -PI / 2, 0.72, 0.35)]),
  }),
  Object.freeze({
    id: 'measure', t: 0.765,
    qubits: Object.freeze([q(0, 0), q(0, 0), q(PI, 0), q(0, 0)]),
  }),
  Object.freeze({
    id: 'classical', t: 0.855,
    qubits: Object.freeze([q(0, 0), q(0, 0), q(PI, 0), q(0, 0)]),
  }),
  Object.freeze({
    id: 'factors', t: 0.925,
    qubits: Object.freeze([q(0, 0), q(0, 0), q(PI, 0), q(0, 0)]),
  }),
  Object.freeze({
    id: 'recycle', t: 1.000,
    qubits: Object.freeze([q(0, 0), q(0, 0), q(0, 0), q(0, 0)]),
  }),
]);

/* The 3D-only playback ledger. These strings are authored alongside the
 * descriptor table, so the HUD describes the same fixed computation that the
 * Bloch displays enact. Nothing here is injected into the flat document. */
const step = (id, t, marker, title, formula, qubits) => Object.freeze({
  id, t, marker, title, formula, qubits: Object.freeze(qubits),
});
const tex = String.raw;

export const SHOR_STEPS = Object.freeze([
  step('prepare', 0.000, '0', 'Prepare',
    tex`\lvert\psi_0\rangle=\lvert0000\rangle\lvert1\rangle`,
    [tex`\lvert0\rangle`, tex`\lvert0\rangle`, tex`\lvert0\rangle`, tex`\lvert0\rangle`]),
  step('hadamard', 0.090, 'H', 'Superposition',
    tex`H^{\otimes4}\lvert0000\rangle=\frac14\sum_{x=0}^{15}\lvert x\rangle`,
    [tex`\lvert+\rangle`, tex`\lvert+\rangle`, tex`\lvert+\rangle`, tex`\lvert+\rangle`]),
  step('cu1', 0.210, 'U¹', 'Controlled U¹',
    tex`C\!U^1:\lvert b\rangle\lvert y\rangle\mapsto\lvert b\rangle\lvert2^b y\bmod15\rangle`,
    [tex`\rho_0(.35)`, tex`\lvert+\rangle`, tex`\lvert+\rangle`, tex`\lvert+\rangle`]),
  step('cu2', 0.290, 'U²', 'Controlled U²',
    tex`C\!U^2:\lvert b\rangle\lvert y\rangle\mapsto\lvert b\rangle\lvert4^b y\bmod15\rangle`,
    [tex`\rho_0(.35)`, tex`\rho_1(1.10)`, tex`\lvert+\rangle`, tex`\lvert+\rangle`]),
  step('cu4', 0.370, 'U⁴', 'Controlled U⁴',
    tex`2^4\equiv1\pmod{15}\;\Longrightarrow\;C\!U^4=I`,
    [tex`\rho_0(.35)`, tex`\rho_1(1.10)`, tex`\rho_2(1.90)`, tex`\lvert+\rangle`]),
  step('cu8', 0.450, 'U⁸', 'Controlled U⁸',
    tex`2^8\equiv1\pmod{15}\;\Longrightarrow\;C\!U^8=I`,
    [tex`\rho_0(.35)`, tex`\rho_1(1.10)`, tex`\rho_2(1.90)`, tex`\rho_3(2.65)`]),
  step('periodic', 0.535, 'f(x)', 'Period encoded',
    tex`\lvert\psi\rangle=\frac14\sum_{x=0}^{15}\lvert x\rangle\lvert2^x\bmod15\rangle`,
    [tex`\rho_0(.55)`, tex`\rho_1(1.35)`, tex`\rho_2(2.15)`, tex`\rho_3(2.95)`]),
  step('iqft', 0.595, 'QFT†', 'Inverse Fourier transform',
    tex`\operatorname{QFT}_{16}^{\dagger}\lvert\psi_c\rangle\;\leadsto\;y\in\{0,4,8,12\}`,
    [tex`\lvert+\rangle`, tex`\lvert-\rangle`, tex`\lvert q(.72\pi,\pi/2)\rangle`, tex`\lvert-i\rangle`]),
  step('measure', 0.750, 'M', 'Measurement',
    tex`P(y)=\frac14,\qquad y\in\{0,4,8,12\}`,
    [tex`\lvert0\rangle`, tex`\lvert0\rangle`, tex`\lvert1\rangle`, tex`\lvert0\rangle`]),
  step('factors', 0.925, '3·5', 'Classical factors',
    tex`\gcd(2^2\!\pm1,15)=\{3,5\}`,
    [tex`\lvert0\rangle`, tex`\lvert0\rangle`, tex`\lvert1\rangle`, tex`\lvert0\rangle`]),
]);

/** The authored ledger entry at a closed-loop coordinate. Keeping this lookup
 * beside the table lets the Bloch visuals and their 3D annotations read from
 * exactly the same precomputed source. */
export function shorStepAt(t) {
  const u = ((t % 1) + 1) % 1;
  let current = SHOR_STEPS[0];
  for (let i = 1; i < SHOR_STEPS.length; i++) {
    if (u + 1e-5 < SHOR_STEPS[i].t) break;
    current = SHOR_STEPS[i];
  }
  return current;
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

function angleLerp(a, b, amount) {
  let d = (b - a) % (PI * 2);
  if (d > PI) d -= PI * 2;
  if (d < -PI) d += PI * 2;
  return a + d * amount;
}

/** Sample the authored playback table. Transitions occupy only the final part
 * of each gate interval, so states are readable instead of constantly twitching. */
export function samplePrecomputedState(t, out = {}) {
  const u = ((t % 1) + 1) % 1;
  let left = PRECOMPUTED_STAGES[0];
  let right = PRECOMPUTED_STAGES[1];
  for (let i = 0; i < PRECOMPUTED_STAGES.length - 1; i++) {
    if (u >= PRECOMPUTED_STAGES[i].t && u < PRECOMPUTED_STAGES[i + 1].t) {
      left = PRECOMPUTED_STAGES[i];
      right = PRECOMPUTED_STAGES[i + 1];
      break;
    }
  }
  const interval = Math.max(1e-6, right.t - left.t);
  const local = (u - left.t) / interval;
  const mix = ease((local - 0.48) / 0.52);

  out.t = u;
  out.stage = mix < 0.5 ? left : right;
  out.qubits ||= Array.from({ length: 4 }, () => ({}));
  for (let j = 0; j < 4; j++) {
    const a = left.qubits[j];
    const b = right.qubits[j];
    const target = out.qubits[j];
    target.theta = a.theta + (b.theta - a.theta) * mix;
    target.phi = angleLerp(a.phi, b.phi, mix);
    target.purity = a.purity + (b.purity - a.purity) * mix;
    target.split = a.split + (b.split - a.split) * mix;
  }
  return out;
}
