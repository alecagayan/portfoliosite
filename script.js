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

const cmdkCommands = [
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

let cmdkActiveIndex = 0;
let cmdkFiltered = cmdkCommands;

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
  cmdkFiltered = q
    ? cmdkCommands.filter((cmd) => cmd.label.toLowerCase().includes(q))
    : cmdkCommands;
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
    if (link.url && link.url !== '#') {
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

  // Subtle 3D tilt on project cards, and click-to-open the detail modal
  projectCards.forEach((card, i) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotateX = ((y / rect.height) - 0.5) * -8;
      const rotateY = ((x / rect.width) - 0.5) * 8;
      card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });

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
    initInteractions();
  })
  .catch((err) => {
    console.error('Failed to load site data from the data/ folder', err);
    projectsGrid.innerHTML = '<p>Could not load projects right now.</p>';
  });

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
