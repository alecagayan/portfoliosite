// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Theme toggle (persisted)
const themeToggle = document.getElementById('themeToggle');
const root = document.documentElement;
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  root.setAttribute('data-theme', savedTheme);
  themeToggle.textContent = savedTheme === 'light' ? '☀️' : '🌙';
}

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
const skillsGrid = document.getElementById('skillsGrid');
const projectsGrid = document.getElementById('projectsGrid');

function tokenize(label) {
  return label
    .toLowerCase()
    .replace(/\+/g, 'p')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function renderSkills(categories) {
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

function renderProjects(projects) {
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
    (project.links || []).forEach((link) => {
      const a = document.createElement('a');
      a.href = link.url;
      a.textContent = link.label;
      a.setAttribute('aria-label', link.ariaLabel || `View ${link.label}`);
      if (link.url && link.url !== '#') {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      links.appendChild(a);
    });
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
    (project.tags || []).forEach((tag) => {
      const li = document.createElement('li');
      li.textContent = tag;
      tagList.appendChild(li);
    });
    card.appendChild(tagList);

    projectsGrid.appendChild(card);
  });
}

function initInteractions() {
  const projectCards = document.querySelectorAll('.project-card');

  document.querySelectorAll('.skill-card').forEach(observeReveal);
  projectCards.forEach(observeReveal);

  // Subtle 3D tilt on project cards
  projectCards.forEach((card) => {
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
  fetch('skills.json').then((res) => res.json()),
  fetch('projects.json').then((res) => res.json()),
])
  .then(([skills, projects]) => {
    renderSkills(skills);
    renderProjects(projects);
    initInteractions();
  })
  .catch((err) => {
    console.error('Failed to load skills.json or projects.json', err);
    projectsGrid.innerHTML = '<p>Could not load projects right now.</p>';
  });
