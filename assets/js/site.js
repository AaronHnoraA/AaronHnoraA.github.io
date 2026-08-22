/*
 * site.js — decides whether this page is a document or a world.
 * Copyright (c) 2026 Chang He. MIT (see /LICENSE).
 *
 * The markup is a complete, readable document on its own. Only when the
 * conditions are right does JavaScript lift it into three dimensions. Every
 * explicit ?flat=1 or missing WebGL leaves a page that still works. Small
 * screens still get the world; reduced-motion keeps the 3D composition but
 * renders it as a still scene.
 */

const root = document.documentElement;
root.classList.remove('no-js');

const params = new URLSearchParams(window.location.search);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const still = params.has('static') || reduceMotion;
const flat = params.has('flat');
const numericParam = (name) => {
  const raw = params.get(name);
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

/* --------------------------------------------------------------- footer */

for (const el of document.querySelectorAll('[data-year]')) {
  el.textContent = String(new Date().getFullYear());
}

/* -------------------------------------------------------------- contact */

/* The address is kept out of the static HTML so it is not sitting in the page
 * source for harvesters; it is assembled only when a reader asks for it. */
const CONTACT_KEY = 37;
const CONTACT = [68, 68, 87, 74, 75, 11, 77, 64, 101, 86, 81, 80, 65, 64, 75, 81, 11, 80, 75, 86, 82, 11, 64, 65, 80, 11, 68, 80];

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element
    ? event.target.closest('[data-contact-link]')
    : null;
  if (!target) return;
  event.preventDefault();
  const address = CONTACT.map((n) => String.fromCharCode(n ^ CONTACT_KEY)).join('');
  window.location.href = `mailto:${address}`;
});

/* ---------------------------------------------------------------- world */

const host = document.querySelector('[data-world]');
const viewToggle = document.querySelector('[data-view-toggle]');

function viewURL(nextFlat) {
  const url = new URL(window.location.href);
  if (nextFlat) url.searchParams.set('flat', '1');
  else url.searchParams.delete('flat');
  return `${url.pathname}${url.search}${url.hash}`;
}

function showFlatToggle() {
  if (!viewToggle) return;
  viewToggle.textContent = 'Enter 3D';
  viewToggle.setAttribute('aria-label', 'Enter the 3D circuit');
  viewToggle.href = viewURL(false);
}

function showWorldToggle() {
  if (!viewToggle) return;
  viewToggle.textContent = 'Close 3D';
  viewToggle.setAttribute('aria-label', 'Close 3D and read the static page');
  viewToggle.href = viewURL(true);
}

showFlatToggle();

async function lift() {
  if (!host || flat) return;
  try {
    const { mountWorld } = await import('./world/index.js');
    root.classList.add('is-world');
    const world = mountWorld(host, {
      still,
      debug: params.has('debug'),
      head: numericParam('head'),
      flow: numericParam('flow'),
    });
    if (!world) root.classList.remove('is-world');   // no WebGL: stay flat
    else showWorldToggle();
  } catch (err) {
    root.classList.remove('is-world');
    showFlatToggle();
    console.warn('staying flat:', err);
  }
}

lift();
