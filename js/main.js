import { $, $$, el, reducedMotion, toast, openDialog, closeDialog, wireDialog, whenNear } from './util.js';
import { initField } from './field.js';
import { coverSVG } from './covers.js';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const EMAIL = 'alecagayan24@gmail.com';

/* --------------------------------------------------------------------------
   Theme
   -------------------------------------------------------------------------- */
const root = document.documentElement;
const themeToggle = $('#themeToggle');
const prefersLight = window.matchMedia('(prefers-color-scheme: light)');

function storedTheme() {
  try {
    return localStorage.getItem('theme');
  } catch {
    return null;
  }
}

function applyTheme(theme, persist) {
  root.setAttribute('data-theme', theme);
  if (persist) {
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* private mode: the choice just won't stick */
    }
  }
}

// Keep following the OS until the visitor makes an explicit choice
prefersLight.addEventListener('change', (e) => {
  if (!storedTheme()) applyTheme(e.matches ? 'light' : 'dark', false);
});

function toggleTheme(origin) {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  if (!document.startViewTransition || reducedMotion.matches) {
    applyTheme(next, true);
    return;
  }
  const x = origin?.x ?? innerWidth - 40;
  const y = origin?.y ?? 32;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(() => applyTheme(next, true)).ready.then(() => {
    root.animate(
      { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' }
    );
  });
}

themeToggle.addEventListener('click', (e) => {
  const rect = themeToggle.getBoundingClientRect();
  toggleTheme({ x: e.clientX || rect.left + rect.width / 2, y: e.clientY || rect.top + rect.height / 2 });
});

/* --------------------------------------------------------------------------
   Small static bits
   -------------------------------------------------------------------------- */
$('#year').textContent = new Date().getFullYear();

const modKey = isMac ? '⌘K' : 'Ctrl K';
// Touch devices have no keyboard shortcut to advertise, so the button just says Menu
const coarse = window.matchMedia('(pointer: coarse)').matches;
$('#cmdkKey').textContent = coarse ? 'Menu' : modKey;
$('#heroKbd').textContent = modKey;

const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
});

function updateClock() {
  const now = new Date();
  const time = timeFmt.format(now);
  $('#heroTime').textContent = `${time} ET`;
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(now));
  const mood = hour < 7 ? 'probably asleep' : hour < 12 ? 'probably caffeinated' : hour < 18 ? 'probably heads-down' : hour < 23 ? 'probably still online' : 'probably asleep';
  $('#contactTime').textContent = `It’s ${time} ET for me right now: ${mood}. I usually reply within a day.`;
}
updateClock();
setInterval(updateClock, 20_000);

// Ticker
const tickerItems = [
  'Full-stack web', 'Machine learning', 'iOS / SwiftUI', 'AWS Solutions Architect',
  'AWS Machine Learning Specialty', 'Python', 'TypeScript', 'Java', 'Swift', 'React',
  'TensorFlow', 'WebGL', 'UMD CS ’26', 'Open to new-grad roles',
];
const tickerTrack = $('#tickerTrack');
// Two identical halves so the -50% translate loops seamlessly
for (let i = 0; i < 2; i++) tickerItems.forEach((t) => tickerTrack.append(el('span', { text: t })));

/* --------------------------------------------------------------------------
   Top bar: scrolled state, progress, scrollspy
   -------------------------------------------------------------------------- */
const topbar = $('#topbar');
const progress = $('#scrollProgress');
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    topbar.classList.toggle('is-scrolled', scrollY > 12);
    progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    ticking = false;
  });
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const navLinks = $$('.nav-links a');
const spy = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.hash === `#${entry.target.id}`));
    });
  },
  { rootMargin: '-45% 0px -50% 0px' }
);
navLinks.forEach((a) => {
  const section = $(a.hash);
  if (section) spy.observe(section);
});

/* --------------------------------------------------------------------------
   Scroll reveal
   -------------------------------------------------------------------------- */
const revealer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      revealer.unobserve(entry.target);
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

function reveal(nodes, stagger = 0.06) {
  nodes.forEach((node, i) => {
    node.classList.add('reveal');
    node.style.setProperty('--delay', `${Math.min(i * stagger, 0.4)}s`);
    revealer.observe(node);
  });
}

reveal($$('.section-head, .lab, .portrait, .about-body, .contact-title, .contact-copy, .contact-actions, .socials'), 0);

/* --------------------------------------------------------------------------
   Content (JSON-driven so it stays easy to edit)
   -------------------------------------------------------------------------- */
const workList = $('#workList');
const workFilters = $('#workFilters');
let projects = [];
let activeFilter = 'All';

// Normalised word tokens, so the skill "AWS Lambda" matches a project tagged "Lambda"
function tokens(label) {
  return label.toLowerCase().replace(/\+/g, 'p').split(/[^a-z0-9]+/).filter((t) => t && t !== 'aws' && t !== 'and');
}

function projectMatches(project, label) {
  if (label === 'All') return true;
  const want = tokens(label);
  return project.tags.some((tag) => tokens(tag).some((t) => want.includes(t)));
}

function renderWork() {
  workList.replaceChildren(
    ...projects.map((project, i) => {
      const row = el(
        'button',
        {
          type: 'button',
          class: 'work-row',
          'aria-haspopup': 'dialog',
          onclick: () => openProject(project),
        },
        el('span', { class: 'work-index', text: String(i + 1).padStart(2, '0') }),
        el('span', { class: 'work-cover', html: coverSVG(project) }),
        el(
          'span',
          { class: 'work-body' },
          el('h3', { text: project.title }),
          el('span', { class: 'work-meta', text: `${project.year} · ${project.kind}` }),
          el('p', { class: 'work-desc', text: project.description }),
          el('ul', { class: 'tags' }, project.tags.map((t) => el('li', { text: t, dataset: { tag: t } })))
        ),
        el('span', {
          class: 'work-arrow',
          html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
        })
      );
      return el('li', { class: 'work-item' }, row);
    })
  );
  reveal($$('.work-item', workList));
}

function renderFilters() {
  const counts = new Map();
  projects.forEach((p) => p.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
  // The most-used tags make the best filters; cap it so the bar stays one line-ish
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 9);
  const chips = [['All', projects.length], ...top].map(([label, n]) =>
    el(
      'button',
      {
        type: 'button',
        class: 'chip',
        'aria-pressed': String(label === activeFilter),
        dataset: { filter: label },
        onclick: () => setFilter(label),
      },
      label,
      el('span', { class: 'chip-count', text: n })
    )
  );
  workFilters.replaceChildren(...chips);
}

function setFilter(label) {
  activeFilter = label;
  // Filters picked from the Stack section may not have a chip yet; add one so the state is visible
  if (!$$('.chip', workFilters).some((c) => c.dataset.filter === label)) {
    const count = projects.filter((p) => projectMatches(p, label)).length;
    $('.chip', workFilters)?.after(
      el('button', { type: 'button', class: 'chip', dataset: { filter: label }, onclick: () => setFilter(label) }, label, el('span', { class: 'chip-count', text: count }))
    );
  }
  $$('.chip', workFilters).forEach((c) => {
    c.setAttribute('aria-pressed', String(c.dataset.filter === label));
  });
  $$('.work-item', workList).forEach((item, i) => {
    const match = projectMatches(projects[i], label);
    item.classList.toggle('is-dimmed', !match);
    $$('.tags li', item).forEach((li) => {
      li.classList.toggle('is-match', label !== 'All' && tokens(li.dataset.tag).some((t) => tokens(label).includes(t)));
    });
  });
}

function renderExperience(jobs) {
  const list = $('#experienceList');
  list.replaceChildren(
    ...jobs.map((job) =>
      el(
        'li',
        { class: 'job' },
        el('p', { class: 'job-dates', text: job.dates.replace(' - ', ' → ') }),
        el(
          'div',
          {},
          el('h3', { class: 'job-role', text: job.role }),
          el('p', { class: 'job-org' }, el('strong', { text: job.company }), ` · ${job.location}`),
          el('ul', { class: 'job-bullets' }, job.bullets.map((b) => el('li', { text: b })))
        )
      )
    )
  );
  reveal($$('.job', list));
}

function renderCerts(certs) {
  $('#certList').replaceChildren(
    ...certs.map((c) =>
      el('li', {}, el('span', { class: 'cert-name', text: c.name }), el('span', { class: 'cert-meta', text: `${c.issuer} · ${c.date}` }))
    )
  );
}

function renderStack(groups) {
  $('#stackGrid').replaceChildren(
    ...groups.map(({ category, skills }) =>
      el(
        'div',
        { class: 'stack-col' },
        el('h4', { text: category }),
        el(
          'ul',
          {},
          skills.map((skill) => {
            const linked = projects.some((p) => projectMatches(p, skill));
            if (!linked) return el('li', {}, el('span', { class: 'stack-item', text: skill }));
            return el(
              'li',
              {},
              el('button', {
                type: 'button',
                class: 'stack-item',
                text: skill,
                title: `Show projects using ${skill}`,
                onclick: () => {
                  setFilter(skill);
                  $('#work').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' });
                  toast(`Showing projects that use ${skill}`);
                },
              })
            );
          })
        )
      )
    )
  );
  reveal($$('.stack-col'));
}

/* --------------------------------------------------------------------------
   Project drawer
   -------------------------------------------------------------------------- */
const drawer = $('#drawer');
wireDialog(drawer);
$('#drawerClose').addEventListener('click', () => closeDialog(drawer));

function openProject(project) {
  $('#drawerMeta').textContent = `${project.year} · ${project.kind}`;
  $('#drawerCover').innerHTML = coverSVG(project);
  $('#drawerTitle').textContent = project.title;
  $('#drawerDetails').textContent = project.details || project.description;
  $('#drawerHighlights').replaceChildren(...(project.highlights || []).map((h) => el('li', { text: h })));
  $('#drawerTags').replaceChildren(...project.tags.map((t) => el('li', { text: t })));
  $('#drawerLinks').replaceChildren(
    ...project.links.map((link, i) => {
      const internal = link.url.startsWith('#');
      return el('a', {
        class: `btn btn-small ${i === 0 ? 'btn-solid' : 'btn-ghost'}`,
        href: link.url,
        target: internal ? null : '_blank',
        rel: internal ? null : 'noopener',
        text: internal ? link.label : `${link.label} ↗`,
        onclick: internal
          ? (e) => {
              e.preventDefault();
              closeDialog(drawer);
              if (link.lab) selectLabTab(`tab-${link.lab}`);
              $(link.url)?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' });
            }
          : null,
      });
    })
  );
  openDialog(drawer);
}

/* --------------------------------------------------------------------------
   Lab tabs (WAI-ARIA tabs pattern) + lazy demo loading
   -------------------------------------------------------------------------- */
const labTabs = $$('.lab-tab');
const demoModules = {
  'panel-skin': () => import('./lab/skin.js'),
  'panel-c4': () => import('./lab/connect4.js'),
  'panel-huffman': () => import('./lab/huffman.js'),
  'panel-fractal': () => import('./lab/fractal.js'),
};
const demos = new Map(); // panel id -> Promise<demo instance>

function ensureDemo(panelId) {
  if (!demos.has(panelId)) {
    const panel = document.getElementById(panelId);
    demos.set(
      panelId,
      demoModules[panelId]()
        .then((mod) => mod.init(panel))
        .catch((err) => {
          console.error(`Could not start ${panelId}`, err);
          return null;
        })
    );
  }
  return demos.get(panelId);
}

function selectLabTab(tabId, focus = false) {
  const tab = document.getElementById(tabId);
  if (!tab) return;
  labTabs.forEach((t) => {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(t.getAttribute('aria-controls'));
    if (selected && panel.hidden) {
      panel.hidden = false;
      panel.classList.add('is-active', 'is-entering');
      panel.addEventListener('animationend', () => panel.classList.remove('is-entering'), { once: true });
    } else if (!selected) {
      panel.hidden = true;
      panel.classList.remove('is-active');
    }
  });
  if (focus) tab.focus();
  // On narrow screens the tabs are a horizontal strip; keep the active one in view
  const strip = tab.parentElement;
  if (strip.scrollWidth > strip.clientWidth) {
    strip.scrollTo({ left: tab.offsetLeft - 16, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }
  const panelId = tab.getAttribute('aria-controls');
  // Panels hidden at load have zero size, so tell the demo it's visible now
  ensureDemo(panelId).then((demo) => demo?.shown?.());
  demos.forEach((p, id) => {
    if (id !== panelId) p.then((demo) => demo?.hidden?.());
  });
}

labTabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectLabTab(tab.id));
  tab.addEventListener('keydown', (e) => {
    const horizontal = matchMedia('(max-width: 860px)').matches;
    const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
    let target = null;
    if (e.key === nextKey) target = labTabs[(i + 1) % labTabs.length];
    else if (e.key === prevKey) target = labTabs[(i - 1 + labTabs.length) % labTabs.length];
    else if (e.key === 'Home') target = labTabs[0];
    else if (e.key === 'End') target = labTabs[labTabs.length - 1];
    if (!target) return;
    e.preventDefault();
    selectLabTab(target.id, true);
  });
});

// Nothing in the lab (including tf.js and the model) loads until you scroll near it
// (If a tab was already picked, e.g. from the command menu, keep that one.)
whenNear($('#lab'), () => selectLabTab($('.lab-tab[aria-selected="true"]').id), '300px');

/* --------------------------------------------------------------------------
   Command menu
   -------------------------------------------------------------------------- */
const cmdk = $('#cmdk');
const cmdkInput = $('#cmdkInput');
const cmdkList = $('#cmdkList');
wireDialog(cmdk);

const go = (hash) => () => $(hash)?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' });
const openLab = (id) => () => {
  selectLabTab(`tab-${id}`);
  go('#lab')();
};

function copyEmail() {
  const done = () => {
    toast('Email copied to clipboard');
    const chip = $('#copyEmail');
    chip.classList.add('is-copied');
    $('#copyEmailLabel').textContent = 'Copied';
    setTimeout(() => {
      chip.classList.remove('is-copied');
      $('#copyEmailLabel').textContent = 'Copy';
    }, 1800);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(EMAIL).then(done, () => toast(EMAIL));
  } else {
    toast(EMAIL);
  }
}

const baseCommands = [
  { group: 'Navigate', label: 'Selected work', hint: '#work', run: go('#work') },
  { group: 'Navigate', label: 'The lab', hint: '#lab', run: go('#lab') },
  { group: 'Navigate', label: 'Experience', hint: '#experience', run: go('#experience') },
  { group: 'Navigate', label: 'About', hint: '#about', run: go('#about') },
  { group: 'Navigate', label: 'Contact', hint: '#contact', run: go('#contact') },
  { group: 'Lab', label: 'Classify a skin lesion', hint: 'TensorFlow.js', keywords: 'cnn ml model cancer', run: openLab('skin') },
  { group: 'Lab', label: 'Play Connect Four against the AI', hint: 'minimax', keywords: 'c4 connect 4 game alpha beta', run: openLab('c4') },
  { group: 'Lab', label: 'Compress text with Huffman coding', hint: 'min-heap', keywords: 'compression tree', run: openLab('huffman') },
  { group: 'Lab', label: 'Explore the Mandelbrot set', hint: 'WebGL', keywords: 'fractal julia glsl shader', run: openLab('fractal') },
  { group: 'Actions', label: 'Copy email address', hint: EMAIL, run: copyEmail },
  { group: 'Actions', label: 'Download résumé', hint: 'PDF', run: () => $('.hero-actions a[download]').click() },
  { group: 'Actions', label: 'Toggle light / dark theme', hint: 'theme', run: () => toggleTheme() },
  { group: 'Links', label: 'GitHub', hint: 'github.com/alecagayan', run: () => window.open('https://github.com/alecagayan', '_blank', 'noopener') },
  { group: 'Links', label: 'LinkedIn', hint: 'linkedin.com/in/alecagayan', run: () => window.open('https://linkedin.com/in/alecagayan', '_blank', 'noopener') },
];
let projectCommands = [];
let filtered = [];
let active = 0;

// Subsequence fuzzy match: "c4" finds "Connect Four", "skn" finds "Skin". Lower score is better.
function fuzzy(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const direct = t.indexOf(q);
  if (direct !== -1) return { score: direct, hits: Array.from({ length: q.length }, (_, i) => direct + i) };
  const hits = [];
  let from = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const at = t.indexOf(ch, from);
    if (at === -1) return null;
    hits.push(at);
    from = at + 1;
  }
  return { score: 100 + hits[hits.length - 1] - hits[0], hits };
}

function highlight(text, hits) {
  if (!hits?.length) return document.createTextNode(text);
  const set = new Set(hits);
  const frag = document.createDocumentFragment();
  [...text].forEach((ch, i) => frag.append(set.has(i) ? el('mark', { text: ch }) : ch));
  return frag;
}

function renderCmdk() {
  const q = cmdkInput.value.trim();
  const all = [...baseCommands, ...projectCommands];
  filtered = q
    ? all
        .map((cmd) => {
          const onLabel = fuzzy(q, cmd.label);
          // Hints and keywords only match as plain substrings; fuzzy matching
          // across an email address or tag list finds nonsense
          const extra = `${cmd.hint} ${cmd.keywords || ''}`.toLowerCase().indexOf(q.toLowerCase());
          if (!onLabel && extra === -1) return null;
          const score = Math.min(onLabel ? onLabel.score : Infinity, extra === -1 ? Infinity : 50 + extra);
          return { ...cmd, score, hits: onLabel && onLabel.score <= score ? onLabel.hits : null };
        })
        .filter(Boolean)
        .sort((a, b) => a.score - b.score)
    : all;
  active = Math.min(active, Math.max(filtered.length - 1, 0));

  cmdkList.replaceChildren();
  if (!filtered.length) {
    cmdkList.append(el('li', { class: 'cmdk-empty', text: `Nothing matches “${q}”.` }));
    cmdkInput.removeAttribute('aria-activedescendant');
    return;
  }
  let lastGroup = null;
  filtered.forEach((cmd, i) => {
    // Group headings only make sense for the unfiltered list
    if (!q && cmd.group !== lastGroup) {
      cmdkList.append(el('li', { class: 'cmdk-group', role: 'presentation', text: cmd.group }));
      lastGroup = cmd.group;
    }
    const item = el(
      'li',
      {
        class: 'cmdk-item',
        id: `cmdk-${i}`,
        role: 'option',
        'aria-selected': String(i === active),
        onclick: () => runCmd(cmd),
        onmousemove: () => {
          if (active !== i) setActive(i);
        },
      },
      el('span', {}, highlight(cmd.label, cmd.hits)),
      el('span', { class: 'cmdk-hint', text: cmd.hint })
    );
    cmdkList.append(item);
  });
  setActive(active, false);
}

function setActive(i, scroll = true) {
  active = i;
  $$('.cmdk-item', cmdkList).forEach((item, idx) => item.setAttribute('aria-selected', String(idx === i)));
  const node = document.getElementById(`cmdk-${i}`);
  if (node) {
    cmdkInput.setAttribute('aria-activedescendant', node.id);
    if (scroll) node.scrollIntoView({ block: 'nearest' });
  }
}

function runCmd(cmd) {
  closeDialog(cmdk);
  // Let the dialog start closing (and release focus) before navigating
  setTimeout(cmd.run, 60);
}

function openCmdk() {
  cmdkInput.value = '';
  active = 0;
  renderCmdk();
  openDialog(cmdk);
  cmdkInput.focus();
}

cmdkInput.addEventListener('input', () => {
  active = 0;
  renderCmdk();
});
cmdkInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setActive((active + 1) % Math.max(filtered.length, 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActive((active - 1 + filtered.length) % Math.max(filtered.length, 1));
  } else if (e.key === 'Enter' && filtered[active]) {
    e.preventDefault();
    runCmd(filtered[active]);
  }
});
$('#cmdkTrigger').addEventListener('click', openCmdk);

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    cmdk.open ? closeDialog(cmdk) : openCmdk();
    return;
  }
  // "/" also opens it, unless you're typing somewhere
  const typing = e.target.closest?.('input, textarea, [contenteditable="true"]');
  if (e.key === '/' && !typing && !cmdk.open && !drawer.open) {
    e.preventDefault();
    openCmdk();
  }
});

/* --------------------------------------------------------------------------
   Contact
   -------------------------------------------------------------------------- */
$('#copyEmail').addEventListener('click', copyEmail);

/* --------------------------------------------------------------------------
   Load data, then render everything that depends on it
   -------------------------------------------------------------------------- */
const getJSON = (path) =>
  fetch(path).then((res) => {
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  });

Promise.all([
  getJSON('data/projects.json'),
  getJSON('data/experience.json'),
  getJSON('data/skills.json'),
  getJSON('data/certifications.json'),
])
  .then(([projectData, jobs, skills, certs]) => {
    projects = projectData;
    renderWork();
    renderFilters();
    renderExperience(jobs);
    renderCerts(certs);
    renderStack(skills);
    projectCommands = projects.map((p) => ({
      group: 'Projects',
      label: p.title,
      hint: p.tags.join(', '),
      keywords: p.kind,
      run: () => openProject(p),
    }));
  })
  .catch((err) => {
    console.error('Could not load site content from data/', err);
    workList.replaceChildren(
      el('li', { class: 'muted', text: 'Projects could not be loaded right now. Try refreshing, or find everything on GitHub.' })
    );
  });

/* --------------------------------------------------------------------------
   Hero field + easter eggs
   -------------------------------------------------------------------------- */
const field = initField($('#heroField'));

// ↑ ↑ ↓ ↓ ← → ← → B A
const konami = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
let konamiAt = 0;
document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  konamiAt = key === konami[konamiAt] ? konamiAt + 1 : key === konami[0] ? 1 : 0;
  if (konamiAt === konami.length) {
    konamiAt = 0;
    field?.party();
    toast('Party mode. You found the secret.');
    if (scrollY > innerHeight) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

const title = document.title;
document.addEventListener('visibilitychange', () => {
  document.title = document.hidden ? 'Come back soon 👋' : title;
});

console.log('%cHey, you opened the console.', 'font: 600 15px Geist, system-ui; color: #ff5a1f');
console.log(`%cNo framework here; read the source in /js. If you're hiring: ${EMAIL}`, 'font: 13px Geist, system-ui');
