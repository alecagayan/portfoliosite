// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Theme toggle (persisted, but defaults to the OS preference on a first visit)
const themeToggle = document.getElementById('themeToggle');
const root = document.documentElement;
const prefersLight = window.matchMedia('(prefers-color-scheme: light)');
const savedTheme = localStorage.getItem('theme');
const initialTheme = savedTheme || (prefersLight.matches ? 'light' : 'dark');
root.setAttribute('data-theme', initialTheme);
themeToggle.textContent = initialTheme === 'light' ? '☀️' : '🌙';

// If the visitor hasn't made an explicit choice, keep following the OS setting live
prefersLight.addEventListener('change', (e) => {
  if (localStorage.getItem('theme')) return;
  const next = e.matches ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  themeToggle.textContent = next === 'light' ? '☀️' : '🌙';
});

function setTheme(next) {
  root.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  themeToggle.textContent = next === 'light' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', (e) => {
  const current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'light' ? 'dark' : 'light';

  if (!document.startViewTransition) {
    setTheme(next);
    return;
  }

  const x = e.clientX;
  const y = e.clientY;
  const endRadius = Math.hypot(
    Math.max(x, innerWidth - x),
    Math.max(y, innerHeight - y)
  );

  const transition = document.startViewTransition(() => setTheme(next));

  transition.ready.then(() => {
    root.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 600,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }
    );
  });
});

// Typewriter effect on the hero tagline
const typewriterEl = document.getElementById('typewriterText');
const typewriterPhrases = [
  "a software engineer.",
  "a machine learning enthusiast.",
  "a full-stack builder.",
  "a problem solver.",
];

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  typewriterEl.textContent = typewriterPhrases[0];
} else {
  let twPhrase = 0;
  let twChar = 0;
  let twDeleting = false;

  function tickTypewriter() {
    const current = typewriterPhrases[twPhrase];

    if (!twDeleting) {
      twChar++;
      typewriterEl.textContent = current.slice(0, twChar);
      if (twChar === current.length) {
        twDeleting = true;
        setTimeout(tickTypewriter, 1700);
        return;
      }
      setTimeout(tickTypewriter, 55);
    } else {
      twChar--;
      typewriterEl.textContent = current.slice(0, twChar);
      if (twChar === 0) {
        twDeleting = false;
        twPhrase = (twPhrase + 1) % typewriterPhrases.length;
        setTimeout(tickTypewriter, 300);
        return;
      }
      setTimeout(tickTypewriter, 30);
    }
  }
  tickTypewriter();
}

// Confetti burst on the "Say Hello" and "Download Resume" buttons
function burstConfetti(x, y) {
  const colors = ['#7c6dfa', '#b45cff', '#5846e6', '#9333ea', '#dbe0f5'];

  for (let i = 0; i < 26; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.background = colors[i % colors.length];
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    document.body.appendChild(piece);

    const angle = Math.random() * Math.PI * 2;
    const distance = 70 + Math.random() * 130;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 40;
    const rotation = Math.random() * 720 - 360;

    const animation = piece.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rotation}deg)`, opacity: 0 },
      ],
      { duration: 800 + Math.random() * 400, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
    );
    animation.onfinish = () => piece.remove();
  }
}

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document
    .querySelectorAll('#contact .btn-primary, .hero-actions a[download]')
    .forEach((btn) => {
      btn.addEventListener('click', (e) => {
        burstConfetti(e.clientX, e.clientY);
      });
    });
}

// Scrollspy nav: highlight the link for whichever section is in view
const navLinks = [...document.querySelectorAll('.nav-links a')];
const spySections = navLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

const spyObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const link = navLinks.find(
        (a) => a.getAttribute('href') === `#${entry.target.id}`
      );
      if (!link) return;
      link.classList.toggle('active', entry.isIntersecting);
    });
  },
  { rootMargin: '-40% 0px -55% 0px' }
);
spySections.forEach((section) => spyObserver.observe(section));

// Back to top button
const backToTop = document.getElementById('backToTop');
window.addEventListener(
  'scroll',
  () => {
    backToTop.classList.toggle('visible', window.scrollY > window.innerHeight * 0.6);
  },
  { passive: true }
);
backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Local time, so visitors know what time zone they'd be reaching me in
const localTimeEl = document.getElementById('localTime');
function updateLocalTime() {
  const now = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date());
  localTimeEl.textContent = `It's currently ${now} where I am`;
}
updateLocalTime();
setInterval(updateLocalTime, 30000);

// Command palette (Ctrl/Cmd+K)
const cmdk = document.getElementById('cmdk');
const cmdkInput = document.getElementById('cmdkInput');
const cmdkList = document.getElementById('cmdkList');
const cmdkTrigger = document.getElementById('cmdkTrigger');

const staticCmdkCommands = [
  ...navLinks.map((link) => ({
    label: `Go to ${link.textContent}`,
    hint: 'Section',
    action: () =>
      document.querySelector(link.getAttribute('href')).scrollIntoView({ behavior: 'smooth' }),
  })),
  {
    label: 'Toggle dark / light theme',
    hint: 'Theme',
    action: () => themeToggle.click(),
  },
  {
    label: 'Download résumé',
    hint: 'PDF',
    action: () => document.querySelector('.hero-actions a[download]').click(),
  },
  {
    label: 'Copy email address',
    hint: 'alecagayan24@gmail.com',
    action: () => navigator.clipboard?.writeText('alecagayan24@gmail.com'),
  },
  {
    label: 'Open GitHub profile',
    hint: '↗',
    action: () => window.open('https://github.com/alecagayan', '_blank', 'noopener'),
  },
  {
    label: 'Open LinkedIn profile',
    hint: '↗',
    action: () => window.open('https://linkedin.com/in/alecagayan', '_blank', 'noopener'),
  },
];

// Populated once projects.json loads, so the palette doubles as a project search
let projectCmdkCommands = [];

function getCmdkCommands() {
  return [...staticCmdkCommands, ...projectCmdkCommands];
}

let cmdkActiveIndex = 0;
let cmdkFiltered = staticCmdkCommands;

function renderCmdkList() {
  cmdkList.innerHTML = '';

  if (!cmdkFiltered.length) {
    const empty = document.createElement('li');
    empty.className = 'cmdk-empty';
    empty.textContent = 'No matching commands';
    cmdkList.appendChild(empty);
    return;
  }

  cmdkFiltered.forEach((cmd, i) => {
    const item = document.createElement('li');
    item.className = 'cmdk-item';
    if (i === cmdkActiveIndex) item.classList.add('is-active');

    const label = document.createElement('span');
    label.textContent = cmd.label;
    item.appendChild(label);

    const hint = document.createElement('span');
    hint.className = 'cmdk-item-hint';
    hint.textContent = cmd.hint;
    item.appendChild(hint);

    item.addEventListener('mouseenter', () => {
      cmdkActiveIndex = i;
      renderCmdkList();
    });
    item.addEventListener('click', () => runCmdkCommand(cmd));

    cmdkList.appendChild(item);
  });
}

function runCmdkCommand(cmd) {
  closeCmdk();
  cmd.action();
}

function filterCmdk(query) {
  const q = query.trim().toLowerCase();
  const all = getCmdkCommands();
  cmdkFiltered = q
    ? all.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(q) || cmd.hint.toLowerCase().includes(q)
      )
    : all;
  cmdkActiveIndex = 0;
  renderCmdkList();
}

function openCmdk() {
  cmdkInput.value = '';
  filterCmdk('');
  cmdk.showModal();
  requestAnimationFrame(() => cmdk.classList.add('is-open'));
  cmdkInput.focus();
}

function closeCmdk() {
  if (!cmdk.classList.contains('is-open')) return;
  cmdk.classList.remove('is-open');
  const finish = (e) => {
    if (e && (e.target !== cmdk || e.propertyName !== 'transform')) return;
    cmdk.removeEventListener('transitionend', finish);
    cmdk.close();
  };
  cmdk.addEventListener('transitionend', finish);
  setTimeout(finish, 400);
}

cmdkTrigger.addEventListener('click', openCmdk);
cmdk.addEventListener('click', (e) => {
  if (e.target === cmdk) closeCmdk();
});
cmdk.addEventListener('cancel', (e) => {
  e.preventDefault();
  closeCmdk();
});
cmdkInput.addEventListener('input', () => filterCmdk(cmdkInput.value));
cmdkInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    cmdkActiveIndex = Math.min(cmdkActiveIndex + 1, cmdkFiltered.length - 1);
    renderCmdkList();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    cmdkActiveIndex = Math.max(cmdkActiveIndex - 1, 0);
    renderCmdkList();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (cmdkFiltered[cmdkActiveIndex]) runCmdkCommand(cmdkFiltered[cmdkActiveIndex]);
  }
});

document.addEventListener('keydown', (e) => {
  const isK = e.key.toLowerCase() === 'k';
  if ((e.metaKey || e.ctrlKey) && isK) {
    e.preventDefault();
    cmdk.classList.contains('is-open') ? closeCmdk() : openCmdk();
  }
});

// Tab title easter egg: nudge people back when they wander off
const defaultTitle = document.title;
document.addEventListener('visibilitychange', () => {
  document.title = document.hidden ? '👋 Come back!' : defaultTitle;
});

// Hey there, curious developer
console.log(
  '%cLooking under the hood, huh?',
  'font-size: 16px; font-weight: bold; color: #7c6dfa;'
);
console.log(
  "%cI like your style. Let's talk: alecagayan24@gmail.com",
  'font-size: 13px; color: #b45cff;'
);

// Scroll reveal animations
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

function observeReveal(el) {
  el.classList.add('reveal');
  observer.observe(el);
}

document
  .querySelectorAll('.section-title, .about-grid, .contact-copy, .social-links')
  .forEach(observeReveal);

// Skills and projects are both loaded from JSON so they're easy to add/edit.
// A skill tag auto-links to a project whenever their labels share a word,
// e.g. skill "AWS Lambda" links to any project tagged "Lambda" or "AWS Lambda" -
// no manual wiring needed when adding a new skill or project tag.
const experienceList = document.getElementById('experienceList');
const skillsGrid = document.getElementById('skillsGrid');
const certGrid = document.getElementById('certGrid');
const projectsGrid = document.getElementById('projectsGrid');

function tokenize(label) {
  return label
    .toLowerCase()
    .replace(/\+/g, 'p')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function renderExperience(jobs) {
  experienceList.innerHTML = '';

  jobs.forEach((job) => {
    const card = document.createElement('div');
    card.className = 'experience-card';

    const top = document.createElement('div');
    top.className = 'experience-top';

    const role = document.createElement('span');
    role.className = 'experience-role';
    role.textContent = job.role;
    top.appendChild(role);

    const dates = document.createElement('span');
    dates.className = 'experience-dates';
    dates.textContent = job.dates;
    top.appendChild(dates);

    card.appendChild(top);

    const meta = document.createElement('div');
    meta.className = 'experience-meta';
    meta.textContent = `${job.company} · ${job.location}`;
    card.appendChild(meta);

    const bullets = document.createElement('ul');
    bullets.className = 'experience-bullets';
    (job.bullets || []).forEach((bullet) => {
      const li = document.createElement('li');
      li.textContent = bullet;
      bullets.appendChild(li);
    });
    card.appendChild(bullets);

    experienceList.appendChild(card);
  });
}

function renderSkills(categories) {
  skillsGrid.innerHTML = '';

  categories.forEach(({ category, skills }) => {
    const card = document.createElement('div');
    card.className = 'skill-card';

    const heading = document.createElement('h3');
    heading.textContent = category;
    card.appendChild(heading);

    const tagList = document.createElement('ul');
    tagList.className = 'tag-list';
    skills.forEach((skill) => {
      const li = document.createElement('li');
      li.className = 'skill-tag';
      li.tabIndex = 0;
      li.textContent = skill;
      tagList.appendChild(li);
    });
    card.appendChild(tagList);

    skillsGrid.appendChild(card);
  });
}

function renderCertifications(certifications) {
  certGrid.innerHTML = '';

  certifications.forEach((cert) => {
    const card = document.createElement('div');
    card.className = 'cert-card';

    const icon = document.createElement('span');
    icon.className = 'cert-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = cert.icon || '🏅';
    card.appendChild(icon);

    const info = document.createElement('div');

    const name = document.createElement('div');
    name.className = 'cert-name';
    name.textContent = cert.name;
    info.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'cert-meta';
    meta.textContent = `${cert.issuer} · ${cert.date}`;
    info.appendChild(meta);

    card.appendChild(info);
    certGrid.appendChild(card);
  });
}

function renderLinks(container, links) {
  container.innerHTML = '';
  (links || []).forEach((link) => {
    const a = document.createElement('a');
    a.href = link.url;
    a.textContent = link.label;
    a.setAttribute('aria-label', link.ariaLabel || `View ${link.label}`);
    if (link.url && link.url !== '#' && link.url.startsWith('#')) {
      // In-page section link (e.g. "#playground") - close the modal if it's
      // open, then smooth-scroll instead of navigating/opening a new tab.
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (projectModal.open) closeProjectModal();
        document.querySelector(link.url)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else if (link.url && link.url !== '#') {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    container.appendChild(a);
  });
}

function renderTags(container, tags) {
  container.innerHTML = '';
  (tags || []).forEach((tag) => {
    const li = document.createElement('li');
    li.textContent = tag;
    container.appendChild(li);
  });
}

let projectsData = [];

function renderProjects(projects) {
  projectsData = projects;
  projectsGrid.innerHTML = '';

  projects.forEach((project) => {
    const card = document.createElement('article');
    card.className = 'project-card';

    const top = document.createElement('div');
    top.className = 'project-top';

    const icon = document.createElement('span');
    icon.className = 'folder-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = project.icon || '📁';
    top.appendChild(icon);

    const links = document.createElement('div');
    links.className = 'project-links';
    renderLinks(links, project.links);
    top.appendChild(links);
    card.appendChild(top);

    const title = document.createElement('h3');
    title.textContent = project.title;
    card.appendChild(title);

    const description = document.createElement('p');
    description.textContent = project.description;
    card.appendChild(description);

    const tagList = document.createElement('ul');
    tagList.className = 'tag-list small';
    renderTags(tagList, project.tags);
    card.appendChild(tagList);

    projectsGrid.appendChild(card);
  });
}

// Feeds each project into the command palette as a searchable entry, so
// typing a project name or tag (e.g. "Swift", "Keras") surfaces it there too.
function buildProjectCommands(projects) {
  projectCmdkCommands = projects.map((project) => ({
    label: project.title,
    hint: `Project · ${(project.tags || []).join(', ')}`,
    action: () => openProjectModal(project),
  }));
}

// Project detail modal
const projectModal = document.getElementById('projectModal');
const modalClose = document.getElementById('modalClose');
const modalIcon = document.getElementById('modalIcon');
const modalLinks = document.getElementById('modalLinks');
const modalTitle = document.getElementById('modalTitle');
const modalDetails = document.getElementById('modalDetails');
const modalTags = document.getElementById('modalTags');

function openProjectModal(project) {
  modalIcon.textContent = project.icon || '📁';
  modalTitle.textContent = project.title;
  modalDetails.textContent = project.details || project.description;
  renderLinks(modalLinks, project.links);
  renderTags(modalTags, project.tags);
  projectModal.showModal();
  // Wait a frame so the modal renders in its closed state first, then
  // animate to open - otherwise the browser has nothing to transition from.
  requestAnimationFrame(() => projectModal.classList.add('is-open'));
}

function closeProjectModal() {
  if (!projectModal.classList.contains('is-open')) return;
  projectModal.classList.remove('is-open');
  const finish = (e) => {
    if (e && (e.target !== projectModal || e.propertyName !== 'transform')) return;
    projectModal.removeEventListener('transitionend', finish);
    projectModal.close();
  };
  projectModal.addEventListener('transitionend', finish);
  // Fallback in case transitionend never fires (e.g. reduced-motion overrides)
  setTimeout(finish, 400);
}

modalClose.addEventListener('click', closeProjectModal);
projectModal.addEventListener('click', (e) => {
  if (e.target === projectModal) closeProjectModal();
});
projectModal.addEventListener('cancel', (e) => {
  e.preventDefault();
  closeProjectModal();
});

function initInteractions() {
  const projectCards = document.querySelectorAll('.project-card');

  document.querySelectorAll('.experience-card').forEach(observeReveal);
  document.querySelectorAll('.skill-card').forEach(observeReveal);
  document.querySelectorAll('.cert-card').forEach(observeReveal);
  projectCards.forEach(observeReveal);

  // Cursor-follow spotlight glow on every card type
  document
    .querySelectorAll('.experience-card, .skill-card, .cert-card, .project-card')
    .forEach((card) => {
      card.classList.add('spotlight');
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
      });
    });

  // Subtle 3D tilt that follows the cursor
  function addTiltEffect(card) {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotateX = ((y / rect.height) - 0.5) * -4;
      const rotateY = ((x / rect.width) - 0.5) * 4;
      card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  }

  // Tilt, plus click-to-open the detail modal
  projectCards.forEach((card, i) => {
    addTiltEffect(card);

    card.tabIndex = 0;
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      openProjectModal(projectsData[i]);
    });
    card.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) {
        e.preventDefault();
        openProjectModal(projectsData[i]);
      }
    });
  });

  // Each project card's tokenized tag words, computed once up front
  const cardTokens = [...projectCards].map(
    (card) =>
      new Set(
        [...card.querySelectorAll('.tag-list.small li')].flatMap((li) =>
          tokenize(li.textContent)
        )
      )
  );

  // Clicking a skill tag jumps to Projects and highlights matching cards
  let filterTimeout;

  document.querySelectorAll('.skill-tag').forEach((tag) => {
    const techs = tokenize(tag.textContent);
    const matches = [...projectCards].filter((_, i) =>
      techs.some((t) => cardTokens[i].has(t))
    );

    // Tags with no matching project stay static, like the Practices list
    if (!matches.length) {
      tag.classList.remove('skill-tag');
      tag.removeAttribute('tabindex');
      return;
    }

    tag.classList.add('linked');

    const activate = () => {
      document
        .getElementById('projects')
        .scrollIntoView({ behavior: 'smooth', block: 'start' });

      clearTimeout(filterTimeout);
      projectCards.forEach((card) => card.classList.remove('tech-match'));
      matches.forEach((card) => card.classList.add('tech-match'));
      projectsGrid.classList.add('filtering');

      filterTimeout = setTimeout(() => {
        projectsGrid.classList.remove('filtering');
        projectCards.forEach((card) => card.classList.remove('tech-match'));
      }, 2200);
    };

    tag.addEventListener('click', activate);
    tag.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
  });
}

Promise.all([
  fetch('data/experience.json').then((res) => res.json()),
  fetch('data/skills.json').then((res) => res.json()),
  fetch('data/certifications.json').then((res) => res.json()),
  fetch('data/projects.json').then((res) => res.json()),
])
  .then(([experience, skills, certifications, projects]) => {
    renderExperience(experience);
    renderSkills(skills);
    renderCertifications(certifications);
    renderProjects(projects);
    buildProjectCommands(projects);
    initInteractions();
  })
  .catch((err) => {
    console.error('Failed to load site data from the data/ folder', err);
    projectsGrid.innerHTML = '<p>Could not load projects right now.</p>';
  });

// Skin lesion classifier: the real TensorFlow.js model from the Skin Cancer
// Detection project (a CNN trained on HAM10000 dermatoscopic images), run as
// client-side inference. tf.js is lazy-loaded from a CDN the first time it's
// needed, same pattern as the three.js background.
(() => {
  const dropzone = document.getElementById('skinDropzone');
  if (!dropzone) return;
  const fileInput = document.getElementById('skinFileInput');
  const preview = document.getElementById('skinPreview');
  const dropzoneLabel = document.getElementById('skinDropzoneLabel');
  const blurOverlay = document.getElementById('skinBlurOverlay');
  const sampleBtn = document.getElementById('skinSample');
  const clearBtn = document.getElementById('skinClear');
  const statusEl = document.getElementById('skinStatus');
  const resultBody = document.getElementById('skinResultBody');
  const predictedEl = document.getElementById('skinPredicted');
  const confidenceEl = document.getElementById('skinConfidence');
  const barRows = {};
  document.querySelectorAll('#skinBars .pg-bar-row').forEach((row) => {
    barRows[row.dataset.code] = {
      row,
      fill: row.querySelector('.pg-bar > div'),
      pct: row.querySelector('.pg-bar-pct'),
    };
  });

  // Real HAM10000 dermatoscopic photos (via the ISIC Archive, CC-0) - blurred
  // by default since medical lesion photos can be unpleasant to stumble on.
  const sampleImages = Array.from(
    { length: 18 },
    (_, i) => `assets/skin-cancer-model/samples/lesion-${String(i + 1).padStart(2, '0')}.jpg`
  );

  const skinClasses = {
    akiec: 'Actinic Keratoses',
    bcc: 'Basal Cell Carcinoma',
    bkl: 'Benign Keratosis',
    df: 'Dermatofibroma',
    mel: 'Melanoma',
    nv: 'Melanocytic Nevi',
    vasc: 'Vascular Lesion',
  };
  const classOrder = ['akiec', 'bcc', 'bkl', 'df', 'mel', 'nv', 'vasc'];
  const isMalignant = { akiec: true, bcc: true, bkl: false, df: false, mel: true, nv: false, vasc: false };

  let tfPromise = null;
  function ensureTf() {
    if (window.tf) return Promise.resolve();
    if (!tfPromise) {
      tfPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }
    return tfPromise;
  }

  let model = null;
  let modelPromise = null;
  function loadModel() {
    if (!modelPromise) {
      modelPromise = ensureTf().then(() => tf.loadLayersModel('assets/skin-cancer-model/model.json'));
    }
    return modelPromise;
  }

  // Types text into an element one character at a time. A generation token
  // lets a newer call cancel an in-flight one (e.g. rapid-fire shuffling).
  let typewriterToken = 0;
  function typewriteInto(el, text, speed, onDone) {
    const token = ++typewriterToken;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = text;
      el.classList.remove('is-typing');
      if (onDone) onDone();
      return;
    }
    el.textContent = '';
    el.classList.add('is-typing');
    let i = 0;
    (function tick() {
      if (token !== typewriterToken) return;
      i++;
      el.textContent = text.slice(0, i);
      if (i < text.length) {
        setTimeout(tick, speed);
      } else {
        el.classList.remove('is-typing');
        if (onDone) onDone();
      }
    })();
  }

  function renderResults(ranked) {
    statusEl.hidden = true;
    resultBody.hidden = false;
    resultBody.classList.remove('is-loading');

    const top = ranked[0];
    predictedEl.className = `pg-predicted${top.malignant ? ' is-malignant' : ''}`;
    const labelText = `${top.label} (${top.malignant ? 'likely malignant' : 'likely benign'})`;
    const confText = `${(top.prob * 100).toFixed(1)}% confident`;
    typewriteInto(predictedEl, labelText, 16, () => {
      typewriteInto(confidenceEl, confText, 16);
    });

    ranked.forEach((r) => {
      const bar = barRows[r.code];
      if (!bar) return;
      bar.row.classList.toggle('is-top', r.code === top.code);
      bar.fill.classList.toggle('is-malignant', r.malignant);
      bar.fill.style.width = `${(r.prob * 100).toFixed(1)}%`;
      bar.pct.textContent = `${(r.prob * 100).toFixed(0)}%`;
    });
  }

  async function classifyImage(imgEl) {
    const firstRun = resultBody.hidden;
    if (firstRun) {
      statusEl.hidden = false;
      statusEl.textContent = model ? 'Analyzing...' : 'Loading model...';
    } else {
      resultBody.classList.add('is-loading');
    }

    try {
      if (!model) model = await loadModel();
    } catch (err) {
      console.error('Failed to load the skin lesion model', err);
      statusEl.hidden = false;
      statusEl.textContent = 'Could not load the model (check your connection).';
      resultBody.hidden = true;
      return;
    }

    if (firstRun) statusEl.textContent = 'Analyzing...';

    const predictionTensor = tf.tidy(() => {
      const offset = tf.scalar(127.5);
      const tensor = tf.browser
        .fromPixels(imgEl)
        .resizeNearestNeighbor([224, 224])
        .toFloat()
        .sub(offset)
        .div(offset)
        .expandDims();
      return model.predict(tensor);
    });
    const data = await predictionTensor.data();
    predictionTensor.dispose();

    const ranked = classOrder
      .map((code, i) => ({
        code,
        label: skinClasses[code],
        prob: data[i],
        malignant: isMalignant[code],
      }))
      .sort((a, b) => b.prob - a.prob);

    renderResults(ranked);
  }

  // Whether the visitor has chosen to reveal a blurred image - once true, it
  // stays true across new sample/upload requests until they re-blur one manually.
  let revealed = false;

  function showImage(url) {
    preview.onload = () => classifyImage(preview);
    preview.src = url;
    preview.hidden = false;
    preview.classList.toggle('is-blurred', !revealed);
    blurOverlay.hidden = revealed;
    dropzoneLabel.hidden = true;
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) showImage(URL.createObjectURL(file));
  });

  // Clicking the dropzone opens the file picker - except when the click lands
  // on the reveal overlay (handled separately), or when an already-revealed
  // image is clicked again, which re-blurs it instead. It's a plain div, not
  // a <label>, so the blur overlay button can sit on top without also
  // triggering the file dialog underneath it.
  function reblur() {
    revealed = false;
    preview.classList.add('is-blurred');
    blurOverlay.hidden = false;
  }

  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#skinBlurOverlay')) return;
    if (!preview.hidden && !preview.classList.contains('is-blurred')) {
      reblur();
      return;
    }
    fileInput.click();
  });
  dropzone.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('#skinBlurOverlay')) return;
    e.preventDefault();
    if (!preview.hidden && !preview.classList.contains('is-blurred')) {
      reblur();
      return;
    }
    fileInput.click();
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('is-dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) showImage(URL.createObjectURL(file));
  });

  blurOverlay.addEventListener('click', (e) => {
    e.stopPropagation();
    revealed = true;
    preview.classList.remove('is-blurred');
    blurOverlay.hidden = true;
  });

  sampleBtn.addEventListener('click', () => {
    const pick = sampleImages[Math.floor(Math.random() * sampleImages.length)];
    showImage(pick);
  });

  clearBtn.addEventListener('click', () => {
    preview.removeAttribute('src');
    preview.hidden = true;
    preview.classList.remove('is-blurred');
    blurOverlay.hidden = true;
    dropzoneLabel.hidden = false;
    fileInput.value = '';
    revealed = false;
    typewriterToken++;
    resultBody.hidden = true;
    resultBody.classList.remove('is-loading');
    statusEl.hidden = false;
    statusEl.textContent = 'Upload a dermatoscopic image to classify it.';
  });

  // Show a blurred sample as soon as the Playground section scrolls into
  // view, rather than an empty dropzone, without forcing every site visitor
  // to download tf.js and the model up front - it only loads for visitors
  // who actually scroll to this section.
  const playgroundSection = document.getElementById('playground');
  if (playgroundSection) {
    const initObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          obs.disconnect();
          const pick = sampleImages[Math.floor(Math.random() * sampleImages.length)];
          showImage(pick);
        });
      },
      { threshold: 0.2 }
    );
    initObserver.observe(playgroundSection);
  }
})();

// Lazily load the decorative three.js background after the page has settled,
// so the initial load isn't blocked by a ~600KB library that's purely cosmetic.
function loadBackgroundScene() {
  const threeScript = document.createElement('script');
  threeScript.src = 'https://unpkg.com/three@0.160.0/build/three.min.js';
  threeScript.onload = () => {
    const sceneScript = document.createElement('script');
    sceneScript.src = 'three-scene.js';
    document.body.appendChild(sceneScript);
  };
  document.body.appendChild(threeScript);
}

window.addEventListener('load', () => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadBackgroundScene, { timeout: 2000 });
  } else {
    setTimeout(loadBackgroundScene, 200);
  }
});
