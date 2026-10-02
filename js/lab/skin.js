// L1: Skin lesion classifier. The real CNN from my Skin Cancer Detection
// project (trained on HAM10000), converted to TensorFlow.js and run entirely
// client-side. tf.js and the model are only fetched once this tab is opened.
import { $, el } from '../util.js';

const TF_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js';
const MODEL_URL = 'assets/skin-cancer-model/model.json';
const SAMPLE_COUNT = 18;

// Output order of the model's softmax layer
const CLASSES = [
  { code: 'akiec', label: 'Actinic keratosis', malignant: true },
  { code: 'bcc', label: 'Basal cell carcinoma', malignant: true },
  { code: 'bkl', label: 'Benign keratosis', malignant: false },
  { code: 'df', label: 'Dermatofibroma', malignant: false },
  { code: 'mel', label: 'Melanoma', malignant: true },
  { code: 'nv', label: 'Melanocytic nevus', malignant: false },
  { code: 'vasc', label: 'Vascular lesion', malignant: false },
];

let tfPromise;
function loadTf() {
  if (window.tf) return Promise.resolve(window.tf);
  tfPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TF_URL;
    script.onload = () => resolve(window.tf);
    script.onerror = () => {
      tfPromise = null;
      reject(new Error('tf.js failed to load'));
    };
    document.head.append(script);
  });
  return tfPromise;
}

export function init(panel) {
  const dropzone = $('#skinDropzone', panel);
  const fileInput = $('#skinFile', panel);
  const preview = $('#skinPreview', panel);
  const dropLabel = $('#skinDropLabel', panel);
  const revealBtn = $('#skinReveal', panel);
  const statusEl = $('#skinStatus', panel);
  const resultEl = $('#skinResult', panel);
  const labelEl = $('#skinLabel', panel);
  const confEl = $('#skinConf', panel);
  const barsEl = $('#skinBars', panel);

  // Build the bar rows once; later runs only animate their widths
  const rows = new Map();
  CLASSES.forEach((cls) => {
    const fill = el('div', { class: 'bar-fill' });
    const pct = el('span', { class: 'bar-pct', text: '0%' });
    const row = el('li', { class: 'bar-row' }, el('span', { text: cls.label }), el('div', { class: 'bar-track' }, fill), pct);
    rows.set(cls.code, { row, fill, pct });
  });

  let model = null;
  let modelPromise = null;
  let revealed = false;
  // Whether the visitor chose to see sample photos; it carries across new samples
  let samplesRevealed = false;
  let runId = 0;
  let objectUrl = null;

  function loadModel() {
    modelPromise ??= loadTf()
      .then((tf) => tf.loadLayersModel(MODEL_URL))
      .catch((err) => {
        modelPromise = null;
        throw err;
      });
    return modelPromise;
  }

  function setStatus(text) {
    statusEl.hidden = false;
    statusEl.textContent = text;
  }

  async function classify() {
    const id = ++runId;
    dropzone.classList.add('is-scanning');
    if (resultEl.hidden) setStatus(model ? 'Analyzing…' : 'Loading the model (about 4 MB, first time only)…');
    else resultEl.classList.add('is-stale');

    try {
      model ??= await loadModel();
    } catch (err) {
      console.error(err);
      dropzone.classList.remove('is-scanning');
      resultEl.hidden = true;
      setStatus('Couldn’t load the model. Check your connection and try again.');
      return;
    }

    const tf = window.tf;
    const output = tf.tidy(() => {
      const offset = tf.scalar(127.5);
      const input = tf.browser
        .fromPixels(preview)
        .resizeNearestNeighbor([224, 224])
        .toFloat()
        .sub(offset)
        .div(offset)
        .expandDims();
      return model.predict(input);
    });
    const probs = await output.data();
    output.dispose();

    // A newer image arrived while this one was running; drop the stale result
    if (id !== runId) return;
    // Keep the scan visible for a beat so fast results still read as "work happened"
    await new Promise((r) => setTimeout(r, 350));
    if (id !== runId) return;

    dropzone.classList.remove('is-scanning');
    render(CLASSES.map((cls, i) => ({ ...cls, prob: probs[i] })).sort((a, b) => b.prob - a.prob));
  }

  function render(ranked) {
    const top = ranked[0];
    statusEl.hidden = true;
    resultEl.hidden = false;
    resultEl.classList.remove('is-stale');

    labelEl.replaceChildren(
      top.label,
      el('span', {
        class: `verdict ${top.malignant ? 'is-malignant' : 'is-benign'}`,
        text: top.malignant ? 'Likely malignant' : 'Likely benign',
      })
    );
    confEl.textContent = `${(top.prob * 100).toFixed(1)}% confidence · ${top.code}`;

    barsEl.replaceChildren(...ranked.map((r) => rows.get(r.code).row));
    requestAnimationFrame(() => {
      ranked.forEach((r) => {
        const { row, fill, pct } = rows.get(r.code);
        row.classList.toggle('is-top', r === top);
        fill.classList.toggle('is-malignant', r.malignant);
        fill.style.width = `${(r.prob * 100).toFixed(1)}%`;
        pct.textContent = `${(r.prob * 100).toFixed(r.prob < 0.1 ? 1 : 0)}%`;
      });
    });
  }

  function show(url) {
    preview.onload = classify;
    preview.src = url;
    preview.hidden = false;
    preview.classList.toggle('is-blurred', !revealed);
    revealBtn.hidden = revealed;
    dropLabel.hidden = true;
  }

  function showFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    // Your own upload doesn't need the content warning
    revealed = true;
    show(objectUrl);
  }

  let lastSample = -1;
  function randomSample() {
    let n;
    do n = Math.floor(Math.random() * SAMPLE_COUNT);
    while (n === lastSample);
    lastSample = n;
    show(`assets/skin-cancer-model/samples/lesion-${String(n + 1).padStart(2, '0')}.jpg`);
  }

  function setRevealed(value) {
    revealed = value;
    if (!preview.src.startsWith('blob:')) samplesRevealed = value;
    preview.classList.toggle('is-blurred', !value);
    revealBtn.hidden = value;
  }

  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#skinReveal')) return;
    // Clicking a revealed image blurs it again; otherwise open the file picker
    if (!preview.hidden && revealed) return setRevealed(false);
    fileInput.click();
  });
  dropzone.addEventListener('keydown', (e) => {
    if (e.target !== dropzone || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    fileInput.click();
  });
  revealBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setRevealed(true);
  });

  fileInput.addEventListener('change', () => showFile(fileInput.files?.[0]));
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-over');
    showFile(e.dataTransfer.files?.[0]);
  });

  $('#skinSample', panel).addEventListener('click', () => {
    revealed = samplesRevealed;
    randomSample();
  });
  $('#skinClear', panel).addEventListener('click', () => {
    runId++;
    preview.removeAttribute('src');
    preview.hidden = true;
    revealBtn.hidden = true;
    dropLabel.hidden = false;
    fileInput.value = '';
    revealed = samplesRevealed;
    dropzone.classList.remove('is-scanning');
    resultEl.hidden = true;
    setStatus('Upload a dermatoscopic image to classify it.');
  });

  // Start with a blurred sample (and warm up the model) instead of an empty box
  randomSample();

  return {};
}
