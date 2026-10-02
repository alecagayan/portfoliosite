// L2: Connect Four AI. Depth-limited minimax with alpha-beta pruning,
// center-first move ordering, and a hand-tuned window heuristic. The board is
// a flat Int8Array and wins are checked only around the last move, which is
// what makes the 7-ply "Hard" search fast enough to run on the main thread.
import { $, $$, el, reducedMotion } from '../util.js';

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const YOU = 1;
const AI = 2;
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const WIN = 1_000_000;

// Every 4-in-a-row window on the board, precomputed once
const WINDOWS = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [-1, 1]]) {
      const cells = [];
      for (let k = 0; k < 4; k++) {
        const rr = r + dr * k;
        const cc = c + dc * k;
        if (rr < 0 || rr >= ROWS || cc >= COLS) break;
        cells.push(rr * COLS + cc);
      }
      if (cells.length === 4) WINDOWS.push(cells);
    }
  }
}

export class Engine {
  constructor() {
    this.reset();
  }

  reset() {
    this.cells = new Int8Array(ROWS * COLS);
    this.heights = new Int8Array(COLS); // discs in each column
    this.moves = 0;
  }

  canPlay(col) {
    return this.heights[col] < ROWS;
  }

  // Returns the row the disc landed in (0 = top row)
  play(col, who) {
    const row = ROWS - 1 - this.heights[col];
    this.cells[row * COLS + col] = who;
    this.heights[col]++;
    this.moves++;
    return row;
  }

  undo(col) {
    this.heights[col]--;
    const row = ROWS - 1 - this.heights[col];
    this.cells[row * COLS + col] = EMPTY;
    this.moves--;
  }

  // The winning line through (row, col), or null
  winLine(row, col) {
    const who = this.cells[row * COLS + col];
    if (!who) return null;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [-1, 1]]) {
      const line = [row * COLS + col];
      for (const sign of [1, -1]) {
        let r = row + dr * sign;
        let c = col + dc * sign;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && this.cells[r * COLS + c] === who) {
          line.push(r * COLS + c);
          r += dr * sign;
          c += dc * sign;
        }
      }
      if (line.length >= 4) return line;
    }
    return null;
  }

  isFull() {
    return this.moves === ROWS * COLS;
  }

  evaluate() {
    const b = this.cells;
    let score = 0;
    for (let r = 0; r < ROWS; r++) {
      if (b[r * COLS + 3] === AI) score += 6;
      else if (b[r * COLS + 3] === YOU) score -= 6;
    }
    for (const w of WINDOWS) {
      let ai = 0;
      let you = 0;
      for (const i of w) {
        if (b[i] === AI) ai++;
        else if (b[i] === YOU) you++;
      }
      if (ai && you) continue;
      if (ai === 3) score += 50;
      else if (ai === 2) score += 10;
      else if (you === 3) score -= 60;
      else if (you === 2) score -= 10;
    }
    return score;
  }

  // Minimax with alpha-beta pruning. Scores are from the AI's perspective;
  // faster wins (and slower losses) score higher thanks to the depth bonus.
  search(depth, alpha, beta, maximizing, stats) {
    stats.nodes++;
    if (depth === 0) return this.evaluate();
    let best = maximizing ? -Infinity : Infinity;
    let any = false;
    for (const col of ORDER) {
      if (!this.canPlay(col)) continue;
      any = true;
      const row = this.play(col, maximizing ? AI : YOU);
      let score;
      if (this.winLine(row, col)) score = maximizing ? WIN + depth : -WIN - depth;
      else score = this.search(depth - 1, alpha, beta, !maximizing, stats);
      this.undo(col);
      if (maximizing) {
        if (score > best) best = score;
        if (best > alpha) alpha = best;
      } else {
        if (score < best) best = score;
        if (best < beta) beta = best;
      }
      if (alpha >= beta) break;
    }
    return any ? best : 0; // no moves left: draw
  }

  bestMove(depth) {
    const stats = { nodes: 0 };
    const start = performance.now();
    let bestCol = ORDER.find((c) => this.canPlay(c));
    let bestScore = -Infinity;
    let alpha = -Infinity;
    for (const col of ORDER) {
      if (!this.canPlay(col)) continue;
      const row = this.play(col, AI);
      const score = this.winLine(row, col) ? WIN + depth : this.search(depth - 1, alpha, Infinity, false, stats);
      this.undo(col);
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
      if (score > alpha) alpha = score;
    }
    return { col: bestCol, score: bestScore, nodes: stats.nodes, ms: performance.now() - start };
  }
}

export function init(panel) {
  const boardEl = $('#c4Board', panel);
  const statusEl = $('#c4Status', panel);
  const statsEl = $('#c4Stats', panel);
  const difficulty = $('#c4Difficulty', panel);
  const tally = { you: $('#c4You', panel), ai: $('#c4Ai', panel), draw: $('#c4Draw', panel) };
  const score = { you: 0, ai: 0, draw: 0 };

  const engine = new Engine();
  let depth = 4;
  let busy = false;
  let over = false;
  let cursor = 3;
  let hoverCol = -1;

  // DOM: 7 columns of 6 cells, so a column is one big click target
  const cellEls = [];
  const colEls = [];
  for (let c = 0; c < COLS; c++) {
    const col = el('div', { class: 'c4-col', dataset: { col: c } });
    for (let r = 0; r < ROWS; r++) {
      const cell = el('div', { class: 'c4-cell' });
      cellEls[r * COLS + c] = cell;
      col.append(cell);
    }
    col.addEventListener('click', () => humanMove(c));
    col.addEventListener('pointerenter', () => setHover(c));
    colEls.push(col);
    boardEl.append(col);
  }
  boardEl.addEventListener('pointerleave', () => setHover(-1));

  const ghost = el('div', { class: 'c4-ghost' });

  function setHover(col) {
    hoverCol = col;
    colEls.forEach((c, i) => c.classList.toggle('is-hover', i === col));
    ghost.remove();
    if (col < 0 || busy || over || !engine.canPlay(col)) return;
    const row = ROWS - 1 - engine.heights[col];
    cellEls[row * COLS + col].append(ghost);
  }

  function dropDisc(row, col, who) {
    const cell = cellEls[row * COLS + col];
    const disc = el('div', { class: `c4-disc ${who === YOU ? 'is-you' : 'is-ai'}` });
    if (!reducedMotion.matches) {
      // Start above the board and fall to this row; the distance is measured in disc heights
      const cellPx = cell.getBoundingClientRect().height;
      const pitch = (cellPx + 6) / (cellPx * 0.86);
      disc.style.setProperty('--drop-from', `${-(row + 1.2) * pitch * 100}%`);
      disc.style.setProperty('--drop-ms', `${Math.round(160 + 55 * (row + 1))}ms`);
      disc.classList.add('is-dropping');
    }
    cell.append(disc);
    const ms = reducedMotion.matches ? 0 : 160 + 55 * (row + 1) + 220;
    return new Promise((r) => setTimeout(r, ms));
  }

  function finish(line, message, who) {
    over = true;
    boardEl.classList.add('is-over');
    line?.forEach((i) => cellEls[i].classList.add('is-win'));
    statusEl.textContent = message;
    score[who]++;
    tally[who].textContent = score[who];
    setHover(-1);
  }

  async function humanMove(col) {
    if (busy || over || !engine.canPlay(col)) return;
    busy = true;
    boardEl.classList.add('is-busy');
    ghost.remove();
    const row = engine.play(col, YOU);
    await dropDisc(row, col, YOU);
    const line = engine.winLine(row, col);
    if (line) return endTurn(() => finish(line, 'You win! Nicely played.', 'you'));
    if (engine.isFull()) return endTurn(() => finish(null, 'Draw. Evenly matched.', 'draw'));

    statusEl.textContent = 'AI is thinking…';
    // Yield a frame so the status text paints before the search blocks
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
    const move = engine.bestMove(depth);
    const aiRow = engine.play(move.col, AI);
    statsEl.textContent = `Searched ${move.nodes.toLocaleString()} positions in ${move.ms.toFixed(0)} ms at depth ${depth}.${
      move.score >= WIN ? ' It sees a forced win.' : move.score <= -WIN ? ' It thinks you have a forced win.' : ''
    }`;
    await dropDisc(aiRow, move.col, AI);
    const aiLine = engine.winLine(aiRow, move.col);
    if (aiLine) return endTurn(() => finish(aiLine, 'The AI wins. Try again?', 'ai'));
    if (engine.isFull()) return endTurn(() => finish(null, 'Draw. Evenly matched.', 'draw'));
    endTurn(() => {
      statusEl.textContent = 'Your move.';
    });
  }

  function endTurn(fn) {
    busy = false;
    boardEl.classList.remove('is-busy');
    fn();
    if (!over && hoverCol >= 0) setHover(hoverCol);
  }

  function newGame() {
    engine.reset();
    over = false;
    busy = false;
    boardEl.classList.remove('is-over', 'is-busy');
    cellEls.forEach((c) => {
      c.classList.remove('is-win');
      c.replaceChildren();
    });
    statusEl.textContent = 'Your move. You’re orange.';
  }

  $('#c4Reset', panel).addEventListener('click', newGame);

  $$('[role="radio"]', difficulty).forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('[role="radio"]', difficulty).forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
      depth = Number(btn.dataset.depth);
    });
  });

  boardEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      cursor = (cursor + (e.key === 'ArrowLeft' ? COLS - 1 : 1)) % COLS;
      setHover(cursor);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      humanMove(hoverCol >= 0 ? hoverCol : cursor);
    }
  });
  boardEl.addEventListener('focus', () => {
    if (boardEl.matches(':focus-visible')) setHover(cursor);
  });
  boardEl.addEventListener('blur', () => setHover(-1));

  return {};
}
