/*
 * site.js — page behaviour.
 * Copyright (c) 2026 Chang He. MIT (see /LICENSE).
 */

import { animate, stagger } from 'anime';
import { mountHeroCircuit } from './hero-circuit.js';

const root = document.documentElement;
root.classList.remove('no-js');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const forcedStill = new URLSearchParams(window.location.search).has('static');
const still = reduceMotion || forcedStill;
if (still) root.classList.add('motion-off');

/* ------------------------------------------------------------------ hero */

const stage = document.querySelector('[data-hero]');
if (stage) {
  try {
    mountHeroCircuit(stage, { still });
  } catch (err) {
    // Leave the static circuit in place; a hero is not worth a broken page.
    console.warn('hero unavailable:', err);
  }
}

/* --------------------------------------------------------- current page */

const here = window.location.pathname.replace(/\/$/, '/index.html').split('/').pop() || 'index.html';
for (const link of document.querySelectorAll('.masthead-nav a')) {
  if (link.getAttribute('href') === here) link.setAttribute('aria-current', 'page');
}

/* ------------------------------------------------------------- reveals */

const revealed = document.querySelectorAll('[data-reveal]');
if (still) {
  for (const el of revealed) el.style.opacity = '1';
} else if (revealed.length) {
  const seen = new WeakSet();
  const io = new IntersectionObserver((entries) => {
    const batch = entries.filter((e) => e.isIntersecting && !seen.has(e.target));
    if (!batch.length) return;
    for (const e of batch) { seen.add(e.target); io.unobserve(e.target); }
    animate(batch.map((e) => e.target), {
      opacity: [0, 1],
      translateY: [14, 0],
      duration: 620,
      delay: stagger(70),
      ease: 'out(3)',
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  for (const el of revealed) io.observe(el);
}

/* --------------------------------------------------------------- footer */

for (const el of document.querySelectorAll('[data-year]')) {
  el.textContent = String(new Date().getFullYear());
}

/* -------------------------------------------------------------- contact */

/* The address is kept out of the static HTML so it does not sit in the page
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
