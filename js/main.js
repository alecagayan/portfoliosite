import { $, $$, el, whenNear } from './util.js';

/* Theme toggle. With no saved choice the page follows the OS setting. */
const root = document.documentElement;
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

$('#themeToggle').addEventListener('click', () => {
  const current = root.getAttribute('data-theme') || (prefersDark.matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* storage unavailable; the choice just won't persist */
  }
});

$('#year').textContent = new Date().getFullYear();

/* Content, loaded from data/*.json so it's easy to edit */
function renderProjects(projects) {
  $('#projectList').replaceChildren(
    ...projects.map((p) =>
      el(
        'li',
        {},
        el('div', { class: 'project-head' }, el('h3', { text: p.title }), el('span', { class: 'project-meta', text: p.year })),
        el('p', { text: p.description }),
        el('p', { class: 'project-meta', text: p.tags.join(', ') }),
        el(
          'div',
          { class: 'project-links' },
          p.links.map((link) => {
            const internal = link.url.startsWith('#');
            return el('a', {
              href: link.url,
              text: link.label,
              target: internal ? null : '_blank',
              rel: internal ? null : 'noopener',
              onclick: link.demo ? () => selectTab(`tab-${link.demo}`) : null,
            });
          })
        )
      )
    )
  );
}

function renderExperience(jobs) {
  $('#experienceList').replaceChildren(
    ...jobs.map((job) =>
      el(
        'li',
        { class: 'entry' },
        el('div', { class: 'entry-head' }, el('strong', { text: job.role }), el('span', { class: 'muted', text: job.dates.replace(' - ', ' – ') })),
        el('p', { class: 'entry-sub', text: `${job.company}, ${job.location}` }),
        el('ul', {}, job.bullets.map((b) => el('li', { text: b })))
      )
    )
  );
}

function renderCerts(certs) {
  $('#certList').replaceChildren(...certs.map((c) => el('li', {}, c.name, el('span', { class: 'muted', text: ` (${c.issuer}, ${c.date})` }))));
}

function renderSkills(groups) {
  $('#skillList').replaceChildren(...groups.flatMap(({ category, skills }) => [el('dt', { text: category }), el('dd', { text: skills.join(', ') })]));
}

const getJSON = (path) =>
  fetch(path).then((res) => {
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  });

Promise.all(['projects', 'experience', 'certifications', 'skills'].map((name) => getJSON(`data/${name}.json`)))
  .then(([projects, jobs, certs, skills]) => {
    renderProjects(projects);
    renderExperience(jobs);
    renderCerts(certs);
    renderSkills(skills);
  })
  .catch((err) => {
    console.error('Could not load site content', err);
    $('#projectList').replaceChildren(el('li', { class: 'muted', text: 'Projects could not be loaded. Try refreshing the page.' }));
  });

/* Demo tabs (WAI-ARIA tabs pattern). Each demo's code loads the first time it's shown. */
const tabs = $$('.lab-tab');
const demoModules = {
  'panel-skin': () => import('./lab/skin.js'),
  'panel-c4': () => import('./lab/connect4.js'),
  'panel-huffman': () => import('./lab/huffman.js'),
  'panel-fractal': () => import('./lab/fractal.js'),
};
const demos = new Map();

function ensureDemo(panelId) {
  if (!demos.has(panelId)) {
    demos.set(
      panelId,
      demoModules[panelId]()
        .then((mod) => mod.init(document.getElementById(panelId)))
        .catch((err) => {
          console.error(`Could not start ${panelId}`, err);
          return null;
        })
    );
  }
  return demos.get(panelId);
}

function selectTab(tabId, focus = false) {
  const tab = document.getElementById(tabId);
  if (!tab) return;
  tabs.forEach((t) => {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
  });
  if (focus) tab.focus();
  const panelId = tab.getAttribute('aria-controls');
  // Panels hidden at load have zero size, so tell the demo it's visible now
  ensureDemo(panelId).then((demo) => demo?.shown?.());
  demos.forEach((p, id) => {
    if (id !== panelId) p.then((demo) => demo?.hidden?.());
  });
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab.id));
  tab.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    let target = null;
    if (step) target = tabs[(i + step + tabs.length) % tabs.length];
    else if (e.key === 'Home') target = tabs[0];
    else if (e.key === 'End') target = tabs[tabs.length - 1];
    if (!target) return;
    e.preventDefault();
    selectTab(target.id, true);
  });
});

// Nothing in the demos (including TensorFlow.js) loads until you scroll near them
whenNear($('#demos'), () => selectTab($('.lab-tab[aria-selected="true"]').id), '300px');
