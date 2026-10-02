import { $, el, whenNear } from './util.js';

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
const tagList = (items) => el('ul', { class: 'tags' }, items.map((t) => el('li', { text: t })));

function renderProjects(projects) {
  $('#projectList').replaceChildren(
    ...projects.map((p) =>
      el(
        'li',
        { class: 'card project' },
        el('div', { class: 'project-head' }, el('h3', { text: p.title }), el('span', { class: 'meta', text: p.year })),
        el('p', { class: 'project-desc', text: p.description }),
        tagList(p.tags),
        el(
          'div',
          { class: 'project-links' },
          p.links.map((link) => {
            const internal = link.url.startsWith('#');
            return el('a', {
              href: link.url,
              text: internal ? `${link.label} ↓` : `${link.label} ↗`,
              target: internal ? null : '_blank',
              rel: internal ? null : 'noopener',
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
        el('p', { class: 'entry-dates meta', text: job.dates.replace(' - ', ' – ') }),
        el(
          'div',
          {},
          el('h3', { class: 'entry-title', text: job.role }),
          el('p', { class: 'entry-sub', text: `${job.company} · ${job.location}` }),
          el('ul', { class: 'entry-bullets' }, job.bullets.map((b) => el('li', { text: b })))
        )
      )
    )
  );
}

function renderCerts(certs) {
  $('#certList').replaceChildren(
    ...certs.map((c) => el('li', {}, el('span', { text: c.name }), el('span', { class: 'meta', text: `${c.issuer} · ${c.date}` })))
  );
}

function renderSkills(groups) {
  $('#skillList').replaceChildren(...groups.flatMap(({ category, skills }) => [el('dt', { text: category }), el('dd', {}, tagList(skills))]));
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

/* Skin lesion classifier demo. Its code, TensorFlow.js and the model only load
   once you scroll near it. */
whenNear($('#demo'), () => {
  import('./lab/skin.js')
    .then((mod) => mod.init($('#panel-skin')))
    .catch((err) => console.error('Could not start the demo', err));
}, '300px');
