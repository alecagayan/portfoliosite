// Screenshot strips under each project, plus a full-size viewer.
// Screenshots live in uploads/screenshots.json (managed from edit mode), so a
// missing file just means there aren't any yet.
import { $, el } from './util.js';

export const state = {
  shots: {}, // project id -> [{ src, alt }]
  projects: [], // from data/projects.json
  editRenderer: null, // set by the editor while edit mode is on
};

export async function loadShots() {
  try {
    const res = await fetch('uploads/screenshots.json', { cache: 'no-cache' });
    state.shots = res.ok ? await res.json() : {};
  } catch {
    state.shots = {};
  }
}

// Draws every project's strip, in view or edit form
export function renderAllGalleries() {
  document.querySelectorAll('.shots-slot[data-project]').forEach((slot) => renderGallery(slot));
}

export function renderGallery(slot) {
  const id = slot.dataset.project;
  const items = state.shots[id] || [];
  if (state.editRenderer) return state.editRenderer(slot, id, items);

  slot.replaceChildren();
  if (!items.length) return;
  const title = state.projects.find((p) => p.id === id)?.title || 'project';
  const track = el(
    'ul',
    { class: 'shots-track' },
    items.map((item, i) =>
      el(
        'li',
        {},
        el(
          'button',
          { type: 'button', class: 'shot', 'aria-label': `View screenshot ${i + 1} of ${items.length}${item.alt ? `: ${item.alt}` : ''}`, onclick: () => openViewer(items, i) },
          el('img', { src: item.src, alt: item.alt || '', loading: 'lazy', decoding: 'async' })
        )
      )
    )
  );
  slot.append(scroller(track, `Screenshots of ${title}`));
}

// Wraps a track in a scroll area with previous/next buttons that only show when it overflows
export function scroller(track, label) {
  const prev = el('button', { type: 'button', class: 'shots-nav prev', 'aria-label': 'Scroll left', text: '‹' });
  const next = el('button', { type: 'button', class: 'shots-nav next', 'aria-label': 'Scroll right', text: '›' });
  const wrap = el('div', { class: 'shots', role: 'region', 'aria-label': label }, track, prev, next);

  const step = () => Math.max(track.clientWidth * 0.8, 120);
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));

  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    wrap.classList.toggle('can-prev', track.scrollLeft > 2);
    wrap.classList.toggle('can-next', track.scrollLeft < max - 2);
  };
  track.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(track);
  track.querySelectorAll('img').forEach((img) => img.addEventListener('load', update, { once: true }));
  requestAnimationFrame(update);
  return wrap;
}

/* ---------- Full-size viewer ---------- */
let viewer;
let viewerItems = [];
let viewerIndex = 0;

function buildViewer() {
  viewer = el(
    'dialog',
    { class: 'viewer', 'aria-label': 'Screenshot viewer' },
    el('button', { type: 'button', class: 'viewer-close', 'aria-label': 'Close', text: '×', onclick: () => viewer.close() }),
    el('button', { type: 'button', class: 'viewer-nav prev', 'aria-label': 'Previous screenshot', text: '‹', onclick: () => showViewer(viewerIndex - 1) }),
    el('figure', {}, el('img', { alt: '' }), el('figcaption', {})),
    el('button', { type: 'button', class: 'viewer-nav next', 'aria-label': 'Next screenshot', text: '›', onclick: () => showViewer(viewerIndex + 1) })
  );
  viewer.addEventListener('click', (e) => {
    if (e.target === viewer) viewer.close();
  });
  viewer.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') showViewer(viewerIndex - 1);
    if (e.key === 'ArrowRight') showViewer(viewerIndex + 1);
  });
  document.body.append(viewer);
}

function showViewer(i) {
  viewerIndex = (i + viewerItems.length) % viewerItems.length;
  const item = viewerItems[viewerIndex];
  const img = $('img', viewer);
  img.src = item.src;
  img.alt = item.alt || '';
  $('figcaption', viewer).textContent = [item.alt, viewerItems.length > 1 ? `${viewerIndex + 1} / ${viewerItems.length}` : '']
    .filter(Boolean)
    .join(' · ');
  viewer.classList.toggle('single', viewerItems.length < 2);
}

function openViewer(items, i) {
  if (!viewer) buildViewer();
  viewerItems = items;
  showViewer(i);
  viewer.showModal();
}
