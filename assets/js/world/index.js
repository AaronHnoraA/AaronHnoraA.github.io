/*
 * world/index.js — assembles the world, motion, reading states and flight HUD.
 * Copyright (c) 2026 Chang He. MIT (see /LICENSE).
 */

import * as THREE from 'three';
import { animate, createDraggable, createTimeline, spring, utils } from 'anime';
import { makeLoop, PANELS } from './curve.js';
import { buildCircuit, PAPER } from './circuit.js';
import { buildFlight } from './flight.js';
import { buildPanels } from './panels.js';
import { makeRig, MODE } from './rig.js';

const FLOW_SPEED = 0.0105;

function buildFlightUI(host, loop, stations, actions, { still = false } = {}) {
  const hud = document.createElement('div');
  hud.className = 'flight-hud';
  hud.setAttribute('role', 'group');
  hud.setAttribute('aria-label', 'Flight controls');
  hud.innerHTML = `
    <button class="motion-toggle" type="button" aria-label="Pause motion" aria-pressed="false">
      <span aria-hidden="true" data-motion-icon>Ⅱ</span>
    </button>
    <button class="follow-toggle" type="button" aria-label="Follow lead qubit" aria-pressed="true">
      <span aria-hidden="true">◎</span>
    </button>
    <div class="route-control">
      <div class="route-track" aria-hidden="true">
        <span class="route-progress"></span>
        <span class="route-thumb" role="slider" tabindex="0" aria-label="Flight position"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></span>
      </div>
      <div class="route-stations"></div>
    </div>
  `;
  host.appendChild(hud);

  const toggle = hud.querySelector('.motion-toggle');
  const followToggle = hud.querySelector('.follow-toggle');
  const icon = hud.querySelector('[data-motion-icon]');
  const routeControl = hud.querySelector('.route-control');
  const track = hud.querySelector('.route-track');
  const progress = hud.querySelector('.route-progress');
  const thumb = hud.querySelector('.route-thumb');
  const stationHost = hud.querySelector('.route-stations');
  const navLinks = new Map(
    [...document.querySelectorAll('.masthead-nav a[href^="#"], .masthead-name[href^="#"]')]
      .map((link) => [link.getAttribute('href').slice(1), link]),
  );

  const stationButtons = new Map();
  for (const station of stations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'route-station';
    button.style.setProperty('--station', station.t);
    button.dataset.station = station.id;
    button.setAttribute('aria-label', `Open ${station.id}`);
    button.addEventListener('click', () => actions.focus(station.id));
    stationHost.appendChild(button);
    stationButtons.set(station.id, button);
  }

  let paused = false;
  let activeId = '';
  let syncing = false;
  let currentHead = 0;

  if (still) {
    toggle.disabled = true;
    toggle.setAttribute('aria-label', 'Motion disabled by preference');
    icon.textContent = '—';
    hud.classList.add('is-still');
  }

  function setPaused(next) {
    if (still) return;
    paused = Boolean(next);
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Resume motion' : 'Pause motion');
    icon.textContent = paused ? '▶' : 'Ⅱ';
    actions.pause(paused);
    animate(toggle, {
      scale: [0.88, 1],
      duration: 420,
      ease: spring({ stiffness: 220, damping: 18 }),
    });
  }

  toggle.addEventListener('click', () => setPaused(!paused));
  followToggle.addEventListener('click', () => {
    dismissHint();
    actions.follow();
  });

  const draggable = createDraggable(thumb, {
    container: track,
    x: true,
    y: false,
    containerPadding: 0,
    dragSpeed: 1,
    velocityMultiplier: 0.42,
    maxVelocity: 1200,
    releaseEase: spring({ stiffness: 150, damping: 22 }),
    onGrab: () => {
      dismissHint();
      hud.classList.add('is-scrubbing');
      actions.beginSeek();
    },
    onUpdate: (self) => {
      if (syncing) return;
      const head = THREE.MathUtils.clamp(self.progressX, 0, 0.999999);
      progress.style.transform = `scaleX(${head})`;
      actions.seek(head);
    },
    onRelease: () => hud.classList.remove('is-scrubbing'),
    onSettle: () => hud.classList.remove('is-scrubbing'),
  });

  thumb.addEventListener('keydown', (event) => {
    let next = currentHead;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next -= 0.025;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next += 0.025;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 0.999999;
    else return;
    event.preventDefault();
    event.stopPropagation();
    dismissHint();
    actions.beginSeek();
    actions.seek(loop.wrap(next));
  });

  function dismissHint() {
    /* Kept as a semantic action hook; the reduced HUD has no tutorial copy. */
  }

  function nearestStation(head) {
    let best = stations[0];
    let distance = Infinity;
    for (const station of stations) {
      const d = Math.abs(loop.delta(head, station.t));
      if (d < distance) { best = station; distance = d; }
    }
    return best;
  }

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    for (const [stationId, button] of stationButtons) {
      const current = stationId === id;
      button.classList.toggle('is-current', current);
      if (current) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    }
    for (const [stationId, link] of navLinks) {
      const current = stationId === id;
      link.classList.toggle('is-current', current);
      if (current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }

  function update(head, mode, focused) {
    const wrapped = loop.wrap(head);
    currentHead = wrapped;
    thumb.setAttribute('aria-valuenow', String(Math.round(wrapped * 100)));
    if (!draggable.grabbed) {
      syncing = true;
      draggable.progressX = wrapped;
      syncing = false;
      progress.style.transform = `scaleX(${wrapped})`;
    }
    const active = focused?.id || nearestStation(wrapped).id;
    setActive(active);
    const reading = mode === MODE.READ || mode === MODE.TRAVEL;
    hud.classList.toggle('is-reading', reading);
    followToggle.disabled = reading;
    followToggle.setAttribute('aria-pressed', String(mode === MODE.FOLLOW));
    followToggle.setAttribute('aria-label', mode === MODE.FOLLOW
      ? 'Following lead qubit'
      : 'Follow lead qubit');
    routeControl.inert = reading;
    routeControl.setAttribute('aria-disabled', String(reading));
  }

  function focus(panel) {
    const detail = panel?.el.querySelector('.panel-detail');
    const preview = panel?.el.querySelector('.panel-preview');
    if (preview) animate(preview, { opacity: [0.72, 1], y: [5, 0], duration: 420, ease: 'out(3)' });
    if (detail) animate(detail, { opacity: [0, 1], y: [12, 0], duration: 560, ease: 'out(4)' });
  }

  function release(panel) {
    const preview = panel?.el.querySelector('.panel-preview');
    if (preview) animate(preview, { opacity: 1, y: 0, duration: 260, ease: 'out(2)' });
  }

  let intro = null;
  if (!still) {
    utils.set(hud, { opacity: 0, y: 16 });
    const masthead = document.querySelector('.masthead-inner');
    if (masthead) utils.set(masthead, { opacity: 0, y: -8 });
    intro = createTimeline({ defaults: { ease: 'out(4)' } })
      .add(host.querySelector('.world-gl'), { opacity: [0, 1], duration: 1150 }, 0)
      .add(host.querySelector('.world-css'), { opacity: [0, 1], duration: 850 }, 420)
      .add(masthead, { opacity: [0, 1], y: [-8, 0], duration: 650 }, 540)
      .add(hud, { opacity: [0, 1], y: [16, 0], duration: 720 }, 760);
  }

  return {
    element: hud,
    update,
    focus,
    release,
    dismissHint,
    togglePaused: () => setPaused(!paused),
    isPaused: () => paused,
    destroy() {
      intro?.cancel?.();
      draggable.revert?.();
      hud.remove();
    },
  };
}

export function mountWorld(host, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'world-gl';

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    return null;
  }
  if (!renderer.getContext()) return null;
  host.appendChild(canvas);

  renderer.setClearAlpha(0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PAPER, 14, 58);

  const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 180);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd7c7ac, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 2.65);
  key.position.set(7, 13, 9);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc1c8, 0.72);
  fill.position.set(-10, 2, -7);
  scene.add(fill);

  const registry = [];
  const loop = makeLoop();
  const circuit = buildCircuit(loop, { registry });
  const flight = buildFlight(loop, { registry });
  scene.add(circuit.group, flight.group);

  const cssScene = new THREE.Scene();
  const panels = buildPanels(loop, cssScene, host);
  const rig = makeRig(loop, camera);

  let ui;
  let flowHead = loop.wrap(opts.flow ?? 0.965);
  let motionPaused = Boolean(opts.still);
  let flowVelocity = 0;
  let focusedPanel = null;

  function focusPanel(panel, { push = true } = {}) {
    if (!panel) return;
    if (focusedPanel === panel && (rig.state.mode === MODE.TRAVEL || rig.state.mode === MODE.READ)) return;
    if (focusedPanel && focusedPanel !== panel) {
      focusedPanel.el.classList.remove('is-targeted', 'is-focused');
      focusedPanel.el.scrollTop = 0;
      ui?.release(focusedPanel);
    }
    focusedPanel = panel;
    rig.goTo(panel);
    for (const p of panels.panels) {
      p.el.classList.toggle('is-targeted', p === panel);
      p.el.classList.remove('is-focused');
    }
    host.classList.add('is-reading');
    ui?.dismissHint();
    if (push && window.location.hash !== `#${panel.id}`) {
      history.pushState(null, '', `#${panel.id}`);
    }
  }

  function enterRead(panel) {
    if (!panel || panel.el.classList.contains('is-focused')) return;
    panel.el.classList.add('is-focused');
    panel.el.scrollTop = 0;
    ui?.focus(panel);
    panel.el.querySelector('.panel-close')?.focus({ preventScroll: true });
  }

  function releasePanel({ push = true } = {}) {
    const previous = focusedPanel;
    focusedPanel = null;
    rig.release();
    for (const p of panels.panels) p.el.classList.remove('is-targeted', 'is-focused');
    host.classList.remove('is-reading');
    if (previous) previous.el.scrollTop = 0;
    ui?.release(previous);
    if (push && window.location.hash) {
      history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  }

  function setPaused(paused) {
    motionPaused = Boolean(paused);
    rig.setPaused(paused);
  }

  ui = buildFlightUI(host, loop, PANELS, {
    focus: (id) => focusPanel(panels.byId(id)),
    pause: setPaused,
    follow: () => {
      if (!focusedPanel) rig.follow();
    },
    beginSeek: () => {
      if (!focusedPanel) rig.seek(rig.state.head);
    },
    seek: (head) => {
      if (focusedPanel) return;
      rig.seek(head);
    },
  }, { still: Boolean(opts.still) });

  /* --------------------------------------------------------- interaction */

  for (const p of panels.panels) {
    p.el.addEventListener('click', (event) => {
      if (event.target.closest('a, button')) return;
      if (window.getSelection()?.toString()) return;
      if (p !== focusedPanel) focusPanel(p);
    });
  }

  function onPanelClose(event) {
    const close = event.target.closest('.panel-close');
    if (!close) return;
    event.preventDefault();
    event.stopPropagation();
    releasePanel();
  }
  host.addEventListener('click', onPanelClose);

  function onWorldClick(event) {
    if (!focusedPanel) return;
    if (event.target.closest('.is-panel, .flight-hud')) return;
    releasePanel();
  }
  host.addEventListener('click', onWorldClick);

  function onNavClick(event) {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    const panel = panels.byId(id);
    if (!panel) return;
    event.preventDefault();
    focusPanel(panel);
  }
  document.addEventListener('click', onNavClick);

  function onHashChange() {
    const id = window.location.hash.slice(1);
    const panel = panels.byId(id);
    if (panel) focusPanel(panel, { push: false });
    else if (focusedPanel) releasePanel({ push: false });
  }
  window.addEventListener('hashchange', onHashChange);

  function onWheel(event) {
    event.preventDefault();
    if (focusedPanel) {
      if (rig.state.mode === MODE.READ) {
        const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 18
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? focusedPanel.el.clientHeight
            : 1;
        focusedPanel.el.scrollTop += event.deltaY * unit;
      }
      return;
    }
    ui.dismissHint();
    rig.push(event.deltaY * 0.000035);
  }
  host.addEventListener('wheel', onWheel, { passive: false });

  function onKey(event) {
    if (event.key === 'Escape' && focusedPanel) {
      event.preventDefault();
      releasePanel();
      return;
    }
    if (focusedPanel) {
      if (event.target.closest?.('a, button, input, textarea, select')
          && (event.key === ' ' || event.key === 'Enter')) return;
      const page = Math.max(120, focusedPanel.el.clientHeight * 0.82);
      let next = focusedPanel.el.scrollTop;
      if (event.key === 'ArrowDown') next += 44;
      else if (event.key === 'ArrowUp') next -= 44;
      else if (event.key === 'PageDown' || event.key === ' ') next += page;
      else if (event.key === 'PageUp') next -= page;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = focusedPanel.el.scrollHeight;
      else return;
      event.preventDefault();
      focusedPanel.el.scrollTo({ top: next, behavior: 'smooth' });
      return;
    }
    switch (event.key) {
      case ' ': event.preventDefault(); ui.togglePaused(); break;
      case 'ArrowRight': case 'ArrowDown': case 'PageDown':
        rig.push(0.018); ui.dismissHint(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        rig.push(-0.018); ui.dismissHint(); break;
      case 'Home': focusPanel(panels.byId('home')); break;
      default: return;
    }
  }
  window.addEventListener('keydown', onKey);

  let dragging = null;
  host.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.is-panel, .flight-hud')) return;
    /* In reading mode this pointer may become an outside click. Do not
     * capture or cancel it: onWorldClick releases only a completed click. */
    if (focusedPanel) return;
    dragging = { x: event.clientX, y: event.clientY, id: event.pointerId };
    host.setPointerCapture(event.pointerId);
    ui.dismissHint();
  });
  host.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== dragging.id) return;
    const amount = (dragging.y - event.clientY) + (dragging.x - event.clientX) * 0.35;
    rig.push(amount * 0.000055);
    dragging.x = event.clientX;
    dragging.y = event.clientY;
  });
  const endDrag = (event) => {
    if (dragging && event.pointerId === dragging.id) {
      host.releasePointerCapture?.(event.pointerId);
      dragging = null;
    }
  };
  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);

  /* --------------------------------------------------------------- loop */

  function resize() {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    panels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function draw(dt) {
    const readScale = rig.state.mode === MODE.READ ? 0.24 : 1;
    const targetVelocity = motionPaused ? 0 : FLOW_SPEED * readScale;
    flowVelocity = THREE.MathUtils.lerp(
      flowVelocity,
      targetVelocity,
      1 - Math.exp(-2.8 * Math.min(dt, 0.06)),
    );
    flowHead = loop.wrap(flowHead + flowVelocity * dt);
    const followFrame = flight.followFrame(flowHead);
    rig.update(dt, followFrame);
    if (focusedPanel && rig.state.mode === MODE.READ) enterRead(focusedPanel);
    const emphasis = rig.state.mode === MODE.READ ? 0.26 : 1;
    flight.update(flowHead, dt, camera, emphasis);
    circuit.update(camera);
    const chords = flight.chordsAt(flowHead);
    for (const chord of circuit.qftChords) chord.material.opacity = 0.24 * chords * emphasis;
    panels.update(camera, focusedPanel);
    ui.update(rig.state.head, rig.state.mode, focusedPanel);
    renderer.render(scene, camera);
    panels.render(cssScene, camera);
  }

  const still = Boolean(opts.still);
  let raf = 0;
  let last = 0;
  let running = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, 0.06) : 1 / 60;
    last = now;
    draw(dt);
  }

  function start() {
    if (running || still) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function onVisibility() { document.hidden ? stop() : start(); }
  document.addEventListener('visibilitychange', onVisibility);

  const ro = new ResizeObserver(() => { resize(); if (!running) draw(1 / 60); });
  ro.observe(host);

  resize();
  const initialFollow = flight.followFrame(flowHead);
  rig.settle(opts.head ?? initialFollow.t, null, initialFollow);
  if (opts.head !== undefined) rig.seek(opts.head);
  onHashChange();

  if (still) {
    for (let i = 0; i < 24; i++) draw(1 / 60);
  } else {
    start();
  }

  host.dataset.world = 'on';

  if (opts.debug) {
    window.__world = {
      scene, cssScene, camera, renderer, loop, rig, flight, circuit, panels,
      get flowHead() { return flowHead; },
      get flowVelocity() { return flowVelocity; },
      setFlow(head) { flowHead = loop.wrap(head); flight.update(flowHead, 0, camera); },
      setPaused,
    };
  }

  return {
    focus: (id) => focusPanel(panels.byId(id)),
    seek: (head) => rig.seek(head),
    follow: () => rig.follow(),
    setPaused,
    destroy() {
      stop();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('click', onNavClick);
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('keydown', onKey);
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('click', onPanelClose);
      host.removeEventListener('click', onWorldClick);
      ui.destroy();
      panels.dispose();
      scene.traverse((object) => {
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            material.map?.dispose();
            material.dispose();
          }
        }
        object.geometry?.dispose();
      });
      renderer.dispose();
      canvas.remove();
      delete host.dataset.world;
      if (opts.debug) delete window.__world;
    },
  };
}
