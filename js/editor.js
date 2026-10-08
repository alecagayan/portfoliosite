// Edit mode for project screenshots. Loaded only when the URL has ?edit.
// Every change is saved to the server straight away (see server/server.py).
import { $, el } from './util.js';
import { state, renderAllGalleries, renderGallery, scroller } from './gallery.js';

const MAX_SIDE = 2000; // longest edge after resizing, in pixels

/* ---------- Server calls ---------- */
async function api(path, { method = 'GET', body, type } = {}) {
  const headers = { 'X-Portfolio-Editor': '1' };
  if (type) headers['Content-Type'] = type;
  const res = await fetch(`api/${path}`, { method, body, headers, credentials: 'same-origin', cache: 'no-store' });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error page, e.g. from the proxy */
  }
  if (res.status === 401 && path !== 'login') {
    showLogin('Your session ended. Sign in again to keep editing.');
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

const json = (value) => ({ body: JSON.stringify(value), type: 'application/json' });

/* ---------- Small UI pieces ---------- */
let toastTimer;
function toast(message, isError = false) {
  let node = $('#editToast');
  if (!node) {
    node = el('div', { id: 'editToast', class: 'edit-toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.toggle('is-error', isError);
  node.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-shown'), isError ? 5000 : 2200);
}

function pickFiles(multiple) {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: multiple || null });
    input.addEventListener('change', () => resolve([...input.files]));
    input.click();
  });
}

/* ---------- Sign in ---------- */
let loginDialog;
let onSignedIn;

function showLogin(message = '') {
  if (!loginDialog) {
    const input = el('input', { type: 'password', id: 'editPassword', autocomplete: 'current-password', required: true });
    const error = el('p', { class: 'login-error', role: 'alert' });
    const form = el(
      'form',
      { method: 'dialog' },
      el('h2', { class: 'login-title', text: 'Edit mode' }),
      el('p', { class: 'login-message muted' }),
      el('label', { for: 'editPassword', text: 'Password' }),
      input,
      error,
      el(
        'div',
        { class: 'login-actions' },
        el('a', { class: 'btn', href: location.pathname, text: 'Cancel' }),
        el('button', { type: 'submit', class: 'btn btn-primary', text: 'Sign in' })
      )
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.textContent = '';
      try {
        await api('login', { method: 'POST', ...json({ password: input.value }) });
        input.value = '';
        loginDialog.close();
        onSignedIn?.();
      } catch (err) {
        error.textContent = err.message;
        input.select();
      }
    });
    loginDialog = el('dialog', { class: 'login card' }, form);
    // Escape shouldn't leave you on a half-enabled page; Cancel exits edit mode instead
    loginDialog.addEventListener('cancel', (e) => e.preventDefault());
    document.body.append(loginDialog);
  }
  $('.login-message', loginDialog).textContent = message || 'Sign in to add and arrange project screenshots.';
  if (!loginDialog.open) loginDialog.showModal();
  $('#editPassword').focus();
}

/* ---------- Edit bar ---------- */
function showEditBar() {
  if ($('#editBar')) return;
  const bar = el(
    'div',
    { id: 'editBar', class: 'edit-bar' },
    el('span', {}, el('strong', { text: 'Edit mode' }), ' · changes save automatically'),
    el(
      'span',
      { class: 'edit-bar-actions' },
      el('a', { class: 'btn', href: location.pathname, text: 'View site' }),
      el('button', {
        type: 'button',
        class: 'btn',
        text: 'Sign out',
        onclick: async () => {
          await api('logout', { method: 'POST' }).catch(() => {});
          location.href = location.pathname;
        },
      })
    )
  );
  document.body.append(bar);
  document.body.classList.add('is-editing');
}

/* ---------- Images ---------- */
// Shrinks big screenshots and re-encodes them (WebP where supported) so the page stays fast.
async function prepareImage(file) {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error(`${file.name} isn't a PNG, JPEG, WebP or GIF`);
  if (file.type === 'image/gif') return file; // re-encoding would drop animation
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name} couldn't be read as an image`);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const encode = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, 0.86));
  let blob = await encode('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg'); // older Safari can't make WebP
  return blob.size < file.size ? blob : file;
}

async function upload(file) {
  const blob = await prepareImage(file);
  const { src } = await api('upload', { method: 'POST', body: blob, type: blob.type });
  return src;
}

/* ---------- Saving ---------- */
async function save(id, items) {
  try {
    state.shots = await api(`screenshots/${id}`, { method: 'PUT', ...json(items) });
    return true;
  } catch (err) {
    toast(err.message, true);
    // Re-sync with what the server actually has
    state.shots = await api('screenshots').catch(() => state.shots);
    return false;
  } finally {
    rerender(id);
  }
}

function rerender(id) {
  const slot = document.querySelector(`.shots-slot[data-project="${id}"]`);
  if (slot) renderGallery(slot);
}

async function addFiles(slot, id, files) {
  const images = files.filter((f) => f.type.startsWith('image/'));
  if (!images.length) return;
  const status = $('.add-status', slot);
  slot.classList.add('is-busy');
  const added = [];
  try {
    for (const [i, file] of images.entries()) {
      if (status) status.textContent = `Uploading ${i + 1} of ${images.length}…`;
      try {
        added.push({ src: await upload(file), alt: '' });
      } catch (err) {
        toast(`${file.name}: ${err.message}`, true);
      }
    }
  } finally {
    slot.classList.remove('is-busy');
  }
  if (added.length && (await save(id, [...(state.shots[id] || []), ...added]))) {
    toast(`Added ${added.length} screenshot${added.length > 1 ? 's' : ''}`);
  } else {
    rerender(id);
  }
}

/* ---------- Edit view of one project's strip ---------- */
let dragFrom = null;

function renderEditGallery(slot, id, items) {
  const update = (next, message) => save(id, next).then((ok) => ok && message && toast(message));
  const move = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    update(next, 'Order saved');
  };

  const tiles = items.map((item, i) => {
    const caption = el('input', {
      class: 'caption',
      type: 'text',
      value: item.alt,
      maxlength: 300,
      placeholder: 'Caption (optional)',
      'aria-label': `Caption for screenshot ${i + 1}`,
    });
    caption.addEventListener('change', () => {
      const next = items.map((it, j) => (j === i ? { ...it, alt: caption.value } : it));
      update(next, 'Caption saved');
    });

    const tile = el(
      'li',
      { class: 'edit-shot', draggable: 'true' },
      el('img', { src: item.src, alt: item.alt || `Screenshot ${i + 1}`, draggable: 'false' }),
      caption,
      el(
        'div',
        { class: 'edit-actions' },
        el('button', { type: 'button', title: 'Move left', 'aria-label': 'Move left', text: '←', disabled: i === 0 || null, onclick: () => move(i, i - 1) }),
        el('button', { type: 'button', title: 'Move right', 'aria-label': 'Move right', text: '→', disabled: i === items.length - 1 || null, onclick: () => move(i, i + 1) }),
        el('button', {
          type: 'button',
          text: 'Replace',
          onclick: async () => {
            const [file] = await pickFiles(false);
            if (!file) return;
            slot.classList.add('is-busy');
            try {
              const src = await upload(file);
              await update(items.map((it, j) => (j === i ? { ...it, src } : it)), 'Screenshot replaced');
            } catch (err) {
              toast(err.message, true);
            } finally {
              slot.classList.remove('is-busy');
            }
          },
        }),
        el('button', {
          type: 'button',
          class: 'danger',
          text: 'Delete',
          onclick: () => {
            if (confirm('Delete this screenshot?')) update(items.filter((_, j) => j !== i), 'Screenshot deleted');
          },
        })
      )
    );

    // Drag a tile onto another to reorder
    tile.addEventListener('dragstart', (e) => {
      dragFrom = { id, index: i };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i));
      tile.classList.add('is-dragging');
    });
    tile.addEventListener('dragend', () => {
      dragFrom = null;
      tile.classList.remove('is-dragging');
    });
    tile.addEventListener('dragover', (e) => {
      if (dragFrom?.id !== id) return;
      e.preventDefault();
      tile.classList.add('is-drop-target');
    });
    tile.addEventListener('dragleave', () => tile.classList.remove('is-drop-target'));
    tile.addEventListener('drop', (e) => {
      if (dragFrom?.id !== id) return;
      e.preventDefault();
      e.stopPropagation();
      tile.classList.remove('is-drop-target');
      move(dragFrom.index, i);
    });
    return tile;
  });

  const addTile = el(
    'li',
    { class: 'add-tile' },
    el('button', {
      type: 'button',
      class: 'add-btn',
      onclick: async () => addFiles(slot, id, await pickFiles(true)),
    }, el('span', { class: 'add-plus', text: '+' }), 'Add screenshots'),
    el('span', { class: 'add-status muted', text: 'or drop images here' })
  );

  const track = el('ul', { class: 'shots-track' }, tiles, addTile);
  const title = state.projects.find((p) => p.id === id)?.title || 'project';
  const wrap = scroller(track, `Edit screenshots of ${title}`);
  wrap.classList.add('is-edit');

  // Dropping image files from your computer anywhere on the strip uploads them
  wrap.addEventListener('dragover', (e) => {
    if (dragFrom || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    wrap.classList.add('is-file-over');
  });
  wrap.addEventListener('dragleave', (e) => {
    if (!wrap.contains(e.relatedTarget)) wrap.classList.remove('is-file-over');
  });
  wrap.addEventListener('drop', (e) => {
    if (dragFrom || !e.dataTransfer.files.length) return;
    e.preventDefault();
    wrap.classList.remove('is-file-over');
    addFiles(slot, id, [...e.dataTransfer.files]);
  });

  slot.replaceChildren(wrap);
}

/* ---------- Entry point ---------- */
function enable() {
  state.editRenderer = renderEditGallery;
  showEditBar();
  api('screenshots')
    .then((shots) => {
      state.shots = shots;
    })
    .catch(() => {})
    .finally(renderAllGalleries);
  $('#projects')?.scrollIntoView({ behavior: 'smooth' });
}

export async function start() {
  onSignedIn = enable;
  try {
    const { authed } = await api('session');
    if (authed) return enable();
  } catch (err) {
    toast(`Edit mode isn't available: ${err.message}`, true);
    return;
  }
  showLogin();
}
