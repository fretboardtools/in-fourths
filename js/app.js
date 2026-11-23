import { ROOT_NAMES, CIRCLE, notePc, MODE_NAMES, majorScale, midiAt, leadingNote, pcAt } from './theory.js';
import { diagramSVG, figureHTML, wireDiagrams, playOrder, playSequence, stopPlayback } from './neck.js';
import { startDrone, stopDrone, setDroneVolume, droneState, onDroneChange, pluck } from './audio.js';
import { CELL_VIEWS, blockView, chordView, movesView, mapView, modeOf, blockPlaces } from './cells.js';
import { LADDERS, ladder } from './oneroot.js';
import { FORMS, SONGS, SHORTLIST } from './songs.js';

const app = document.getElementById('app');
const UTG_BASS = 'https://unlocktheguitar.net/bass-scale-patterns-two-position-system.html';
const UTG_BUNDLE = 'https://payhip.com/b/iuf50';

// ---------------------------------------------------------------- storage (one viewer, one browser)

const store = {
  get(k, d) { try { const v = localStorage.getItem('if.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('if.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};
const done = new Set(store.get('done', []));
function markDone(day, on) {
  if (on) done.add(day); else done.delete(day);
  store.set('done', [...done]);
}

// ---------------------------------------------------------------- data

let SHED = null;
async function shed() {
  if (!SHED) {
    const r = await fetch('data/woodshed.json');
    SHED = await r.json();
  }
  return SHED;
}

const PARTS = [
  [1, 2, 'Groundwork', 'The two positions, every interval in them, and the four triads. These two weeks don\'t follow the weekly template.'],
  [3, 9, 'The seven modes', 'In the order a bass player uses them, not by brightness: Ionian, Dorian, Mixolydian, Aeolian, Lydian, Phrygian, Locrian.'],
  [10, 15, 'Modes over changes', 'ii–V–I, minor ii–V–i, two blues, a turnaround and a key change. Lines that hit a chord tone on beat 1 and lead into the next chord on beat 4.'],
  [16, 20, 'Minor-key modes', 'Melodic minor, Lydian dominant, altered, harmonic minor and Phrygian dominant: the ones worth your time.'],
  [21, 22, 'Smaller maps', 'Pentatonics and triad pairs inside the modes.'],
  [23, 26, 'The whole neck', 'Blocks end to end, seven modes in one position, all twelve keys in one area, and from chord symbol to pattern.'],
];

const WEEKDAYS = [
  ['The Map', 'The week\'s mode in both positions, labelled with intervals. Play it over a drone and say the intervals out loud.'],
  ['The Triad', 'The triad inside the pattern, with every inversion it holds.'],
  ['The Seventh', 'The 7th arpeggio from the root in each position: up, down and from the 3rd.'],
  ['The Colour', 'The note that gives the mode its sound. Chord tones on the beat, the colour note off it.'],
  ['The Move', 'Six-note blocks on two strings to the neighbouring modes, along the neck and across the strings.'],
  ['The Line', 'A bass line over a short progression where the mode lives, one bar per diagram.'],
  ['Review', 'Earlier pages from memory, at one, three and eight weeks back, then free playing with one constraint.'],
];

function nextDay() {
  // the day after the furthest one you've marked done
  if (!done.size) return 1;
  return Math.min(182, Math.max(...done) + 1);
}

// ---------------------------------------------------------------- small pieces

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function legendHTML() {
  const item = (st, lab, text) => `<li>${diagramDot(st, lab)}<span>${text}</span></li>`;
  return `<ul class="legend">
    ${item('root', '1', 'The root')}
    ${item('lit', '3', 'A chord tone, or the notes you\'re playing today')}
    ${item('sel', '2', 'Another note of the pattern')}
    ${item('colour', '6', 'The colour note, or the note that just changed')}
    ${item('faint', '4', 'The rest of the mode')}
    ${item('out', '♭5', 'A note from outside the pattern')}
    <li><svg class="mini" viewBox="0 0 40 30" aria-hidden="true"><rect class="wood" x="0" y="0" width="40" height="30" rx="4"/><rect class="stretch" x="4" y="4" width="32" height="22" rx="3"/></svg><span>A stretch fret: shift for it low on the neck</span></li>
  </ul>`;
}

function diagramDot(st, lab) {
  return `<svg class="mini" viewBox="0 0 40 30" aria-hidden="true"><rect class="wood" x="0" y="0" width="40" height="30" rx="4"/><line class="string" x1="0" y1="15" x2="40" y2="15" stroke-width="2"/>
  <g class="dot d-${st}">${st === 'colour' ? '<circle class="ring" cx="20" cy="15" r="13"/>' : ''}<circle class="c" cx="20" cy="15" r="10"/><text class="lab${lab.length > 1 ? ' lab-s' : ''}" x="20" y="19">${lab}</text></g></svg>`;
}

function chips(items, current, href, cls = '') {
  return `<div class="chips ${cls}" role="list">${items.map(([v, label]) =>
    `<a role="listitem" class="chip${String(v) === String(current) ? ' is-on' : ''}" href="${href(v)}"${String(v) === String(current) ? ' aria-current="true"' : ''}>${label}</a>`).join('')}</div>`;
}

function boxes(p) {
  if (!p.do?.length && !p.rule) return '';
  return `<section class="drill">
    ${p.do?.length ? `<div class="drill-do"><h3>Do this</h3><ol>${p.do.map(x => `<li>${x}</li>`).join('')}</ol></div>` : ''}
    <div class="drill-pair">
      ${p.rule ? `<div><h3>One rule</h3><p>${p.rule}</p></div>` : ''}
      ${p.got ? `<div><h3>Got it when</h3><p>${p.got}</p></div>` : ''}
    </div>
  </section>`;
}

function droneButton(pc, label) {
  return `<button class="btn btn-drone" type="button" data-drone="${pc}"><span class="pulse" aria-hidden="true"></span>Drone on ${esc(label || ROOT_NAMES[pc])}</button>`;
}

// ---------------------------------------------------------------- views

function heroSpec() {
  // C Ionian block in every place it fits on all three string pairs
  const m = modeOf('C', 0);
  const notes = [], bx = [];
  const seen = new Map();
  [0, 1, 2].forEach(lower => {
    blockPlaces(m.pc, lower).forEach(f => {
      bx.push({ lo: f, hi: f + 4, s0: lower, s1: lower + 1, style: 'solid' });
      m.semis.filter(s => s <= 9).forEach(s => {
        const st = s <= 4 ? lower : lower + 1;
        const fr = s <= 4 ? f + s : f + s - 5;
        const key = `${st},${fr}`;
        if (!seen.has(key)) {
          seen.set(key, true);
          const lab = ['1', '', '2', '', '3', '4', '', '5', '', '6'][s];
          notes.push([st, fr, lab, s === 0 ? 'root' : 'lit']);
        }
      });
    });
  });
  return { start: 0, n: 16, strings: [0, 1, 2, 3], notes, boxes: bx, cap: 'C Ionian block: every place it fits, open strings to the 15th fret' };
}

function viewHome() {
  const nd = nextDay();
  const started = done.size > 0;
  app.innerHTML = `
  <section class="hero">
    <div class="hero-text wrap">
      <h1>Learn one small shape.<br>Then find it all over the neck.</h1>
      <p class="lede">Every string on a bass is a fourth apart, so a shape you learn on two strings works on every pair of strings, and again twelve frets up. Everything on this site is built on that.</p>
    </div>
    <div class="hero-neck" id="heroNeck">${diagramSVG(heroSpec())}</div>
    <div class="wrap hero-foot">
      <p class="hero-cap">Six notes of C Ionian, three on one string and three on the next. Tap any note to hear it.</p>
      <div class="actions">
        <a class="btn btn-main" href="#/woodshed/${nd}">${started ? `Carry on with Day ${nd}` : 'Start Day 1 of the Woodshed'}</a>
        <a class="btn" href="#/cells">Open Cells</a>
      </div>
    </div>
  </section>

  <section class="wrap ways">
    <h2>Three ways to practise</h2>
    <div class="way">
      <div class="way-fig">${diagramSVG(miniWoodshed())}</div>
      <div class="way-text">
        <h3><a href="#/woodshed">The Woodshed</a></h3>
        <p>Twenty-six weeks, one page a day, twenty to thirty minutes with a drone. Each week takes one mode or one set of changes, and each weekday has the same job, so you never have to decide what to practise. Review days bring every page back at one, three and eight weeks.</p>
        <p class="meta">182 pages · progress saved in this browser</p>
      </div>
    </div>
    <div class="way">
      <div class="way-fig">${diagramSVG(miniCells())}</div>
      <div class="way-text">
        <h3><a href="#/cells">Cells</a></h3>
        <p>Small shapes from the modes: the six-note block, the triad, the 7th and the 9th, in any key. Each one is shown with every place it repeats on the neck, and the four moves that take you from one mode's block to the next.</p>
        <p class="meta">7 modes · 12 keys · interval or note names</p>
      </div>
    </div>
    <div class="way">
      <div class="way-fig">${diagramSVG(miniRoot())}</div>
      <div class="way-text">
        <h3><a href="#/one-root">One Root</a></h3>
        <p>Triads, sevenths, ninths, modes and scales on one root, arranged in ladders where each step changes a single note. E major to E minor to E diminished. Lydian down to Locrian. You only ever learn one new note at a time.</p>
        <p class="meta">8 ladders · any root</p>
      </div>
    </div>
  </section>

  <section class="band">
    <div class="wrap band-inner">
      <div>
        <h2>Practise against a drone</h2>
        <p>A mode is a sound against a root, and on bass you're the one playing the root. The drone at the bottom of every page holds that root for you, so each interval has something to rub against. Pick the note, press start, and leave it on for the whole session.</p>
      </div>
      <div class="band-side">
        <p class="band-q">Why does bass make sense to people who never got on with guitar?</p>
        <p>The tuning is the same all the way across. On guitar the B string bends every shape that crosses it. On bass a shape means the same thing wherever you put it, so a system built from small shapes simply works, everywhere, with no exceptions.</p>
      </div>
    </div>
  </section>

  <section class="wrap more">
    <div>
      <h2><a href="#/songs">Songs worth learning</a></h2>
      <p>Eleven songs chosen for what they teach, not for the setlist: the forms bands call, the keys you'd rather avoid, and a mode in each.</p>
    </div>
    <div>
      <h2>The books</h2>
      <p>The system behind this site is <a href="${UTG_BASS}" target="_blank" rel="noopener">The 2 Position Bass System</a>: scales, chord tones and chords in two positions from one root. It's also in the <a href="${UTG_BUNDLE}" target="_blank" rel="noopener">2 Position System bundle</a> with the guitar books.</p>
    </div>
  </section>`;
  animateHero();
}

function miniWoodshed() {
  return { start: 4, n: 6, strings: [0, 1, 2, 3], root: 5, notes: [[0, 5, '1', 'root', '1'], [1, 7, '5', 'lit', '2'], [2, 5, '♭7', 'lit', '3'], [1, 9, '6', 'colour', '4'], [0, 7, '2', 'faint'], [0, 8, '♭3', 'faint'], [1, 5, '4', 'faint'], [2, 7, '8', 'faint']] };
}
function miniCells() {
  return { start: 7, n: 6, strings: [0, 1, 2, 3], root: 8, notes: [[0, 8, '1', 'root'], [0, 10, '2', 'lit'], [0, 12, '3', 'lit'], [1, 8, '4', 'lit'], [1, 10, '5', 'lit'], [1, 12, '6', 'lit']], boxes: [{ lo: 8, hi: 12, s0: 0, s1: 1 }] };
}
function miniRoot() {
  return { start: 11, n: 6, strings: [0, 1, 2, 3], root: 12, notes: [[0, 12, '1', 'root'], [0, 16, '3', 'lit'], [1, 14, '5', 'lit'], [0, 15, '♭3', 'colour']] };
}

function animateHero() {
  const svg = document.querySelector('#heroNeck svg');
  if (!svg) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const boxesEls = [...svg.querySelectorAll('.box')];
  const dots = [...svg.querySelectorAll('.dot')];
  if (reduce) return;
  // light the first block, then each repeat in turn along the neck
  svg.classList.add('hero-anim');
  const order = boxesEls.map((b, i) => ({ b, x: +b.getAttribute('x'), i })).sort((a, b) => a.x - b.x || a.i - b.i);
  const inBox = (d, b) => {
    const c = d.querySelector('.c');
    const cx = +c.getAttribute('cx'), cy = +c.getAttribute('cy');
    const x = +b.getAttribute('x'), y = +b.getAttribute('y'), w = +b.getAttribute('width'), h = +b.getAttribute('height');
    return cx > x && cx < x + w && cy > y && cy < y + h;
  };
  order.forEach(({ b }, k) => {
    setTimeout(() => {
      b.classList.add('show');
      dots.filter(d => inBox(d, b)).forEach(d => d.classList.add('show'));
    }, 500 + k * 340);
  });
}

// ---------- woodshed

async function viewWoodshed() {
  const data = await shed();
  const nd = nextDay();
  const parts = PARTS.map(([a, b, name, text]) => {
    const weeks = [];
    for (let w = a; w <= b; w++) {
      const wk = data.weeks[w];
      const days = [];
      for (let d = 1; d <= 7; d++) {
        const day = (w - 1) * 7 + d;
        const t = data.days[day - 1].title;
        days.push(`<a class="daybox${done.has(day) ? ' is-done' : ''}${day === nd ? ' is-next' : ''}" href="#/woodshed/${day}" title="Day ${day}: ${esc(t)}"><span>${day}</span></a>`);
      }
      weeks.push(`<li class="week"><a class="week-name" href="#/woodshed/${(w - 1) * 7 + 1}"><span class="wn">Week ${w}</span> ${esc(wk.title)}</a><span class="week-key">Key of ${wk.key}</span><span class="week-days">${days.join('')}</span></li>`);
    }
    return `<section class="part"><div class="part-head"><h2>${name}</h2><p>Weeks ${a}–${b}. ${text}</p></div><ol class="weeks" start="${a}">${weeks.join('')}</ol></section>`;
  }).join('');
  app.innerHTML = `
  <div class="wrap page">
    <header class="page-head">
      <h1>The Woodshed</h1>
      <p class="lede">Twenty-six weeks, one page a day. Each page is one idea, a few diagrams, three steps, one rule, and a line that tells you when you've got it. Twenty to thirty minutes with a drone.</p>
      <div class="actions"><a class="btn btn-main" href="#/woodshed/${nd}">${done.size ? `Carry on with Day ${nd}` : 'Start Day 1'}</a><span class="progress">${done.size} of 182 days done</span></div>
    </header>
    <section class="template">
      <h2>The week</h2>
      <p>From Week 3 to Week 20 every week covers one mode or one set of changes, and each weekday always has the same job. By the third week you know what tomorrow's page is before you open it.</p>
      <ol class="weekdays">${WEEKDAYS.map(([n, t], i) => `<li><span class="wd">Day ${i + 1}</span><strong>${n}</strong><span>${t}</span></li>`).join('')}</ol>
      <p class="note">If you haven't got a page, move on anyway. The review days bring every page back. Keys move one step round the circle of fifths each week, so by the end you've played in every key more than twice.</p>
    </section>
    ${parts}
    <section class="readme">
      <h2>Reading the diagrams</h2>
      <p>The neck is drawn flat, the way you look down at it: E string at the bottom, G at the top, fret numbers underneath. The root's fret number is bold. Labels are intervals from the root, so the shapes work in any key.</p>
      ${legendHTML()}
    </section>
  </div>`;
}

async function viewDay(day) {
  const data = await shed();
  day = Math.min(182, Math.max(1, day));
  const p = data.days[day - 1];
  const wk = data.weeks[p.w];
  store.set('last', day);
  const weekStart = (p.w - 1) * 7 + 1;
  const strip = [];
  for (let d = weekStart; d < weekStart + 7; d++) {
    const t = data.days[d - 1].title;
    strip.push(`<a class="daybox${done.has(d) ? ' is-done' : ''}${d === day ? ' is-here' : ''}" href="#/woodshed/${d}" title="Day ${d}: ${esc(t)}"${d === day ? ' aria-current="page"' : ''}><span>${d}</span></a>`);
  }
  const rows = p.rows.map(row => {
    const cls = row.length === 1 && row[0].n > 8 ? 'row row-wide' : `row row-${row.length}`;
    return `<div class="${cls}">${row.map(spec => figureHTML(spec)).join('')}</div>`;
  }).join('');
  const hasLine = p.rows.some(r => r.some(s => s.notes.some(n => n[4])));
  const rootPc = dayRoot(p, wk);
  app.innerHTML = `
  <article class="wrap page day">
    <nav class="crumbs"><a href="#/woodshed">The Woodshed</a><span>Week ${p.w}: ${esc(wk.title)}</span></nav>
    <header class="day-head">
      <div class="day-num" aria-hidden="true">${day}</div>
      <div>
        <p class="day-meta">Day ${day} of 182 · Week ${p.w}, day ${p.d}</p>
        <h1>${esc(p.title)}</h1>
        ${p.sub ? `<p class="sub">${esc(p.sub)}</p>` : ''}
      </div>
    </header>
    <div class="day-tools">
      <div class="strip" aria-label="Days this week">${strip.join('')}</div>
      <div class="tools">${rootPc !== null ? droneButton(rootPc) : ''}${hasLine ? `<button class="btn" type="button" id="playLine">Play the line</button><label class="bpm">Tempo <input type="range" id="bpm" min="50" max="140" step="5" value="${store.get('bpm', 80)}"><output id="bpmOut">${store.get('bpm', 80)}</output></label>` : ''}</div>
    </div>
    ${p.intro ? `<p class="intro">${p.intro}</p>` : ''}
    ${p.after ? `<div class="after">${p.after}</div>` : ''}
    <div class="figs">${rows}</div>
    ${boxes(p)}
    <footer class="day-foot">
      <button class="btn ${done.has(day) ? 'is-done' : 'btn-main'}" type="button" id="doneBtn">${done.has(day) ? `Day ${day} done` : `Mark day ${day} done`}</button>
      <div class="pager">
        ${day > 1 ? `<a class="btn btn-quiet" href="#/woodshed/${day - 1}">Day ${day - 1}</a>` : ''}
        ${day < 182 ? `<a class="btn btn-quiet" href="#/woodshed/${day + 1}">Day ${day + 1}</a>` : ''}
        <button class="btn btn-quiet" type="button" onclick="window.print()">Print this page</button>
      </div>
    </footer>
    <details class="readme"><summary>Reading the diagrams</summary>${legendHTML()}</details>
  </article>`;
  document.getElementById('doneBtn').addEventListener('click', e => {
    const on = !done.has(day);
    markDone(day, on);
    if (on && day < 182) { location.hash = `#/woodshed/${day + 1}`; return; }
    viewDay(day);
  });
  const bpm = document.getElementById('bpm');
  if (bpm) {
    document.documentElement.dataset.bpm = bpm.value;
    bpm.addEventListener('input', () => {
      document.getElementById('bpmOut').textContent = bpm.value;
      document.documentElement.dataset.bpm = bpm.value;
      store.set('bpm', +bpm.value);
    });
    document.getElementById('playLine').addEventListener('click', () => {
      stopPlayback();
      const all = [];
      app.querySelectorAll('.figs svg.neck').forEach(svg => {
        if (svg.querySelector('.dot[data-tag]:not([data-tag=""])')) all.push(...playOrder(svg));
      });
      playSequence(all, +bpm.value);
    });
  }
}

function dayRoot(p, wk) {
  const lead = leadingNote(p.sub) || leadingNote(wk.title);
  if (lead) return notePc(lead);
  for (const row of p.rows) for (const spec of row) {
    const r = spec.notes.find(n => n[3] === 'root');
    if (r) return pcAt(r[0], r[1]);
  }
  return notePc(wk.key);
}

// ---------- cells

function viewCells(key = 'C', k = 0, view = 'block') {
  if (!CIRCLE.includes(key)) key = 'C';
  k = Math.max(0, Math.min(6, +k || 0));
  const labels = store.get('labels', 'intervals');
  const names = majorScale(key);
  const href = (kk = key, mm = k, vv = view) => `#/cells/${encodeURIComponent(kk)}/${mm}/${vv}`;
  let body = '';
  let rootPc = notePc(names[k]);
  if (view === 'map') {
    const v = mapView(key, labels);
    rootPc = notePc(key);
    body = `<h2 class="v-title">${esc(v.title)}</h2><p class="intro">${v.intro}</p>
      <h3 class="fig-h">Along the neck</h3><div class="row row-wide">${figureHTML(v.along, { wide: true })}</div>
      <h3 class="fig-h">The stack, up the strings</h3><p class="fig-p">${v.stackNames.join(', then ')}: each one a string up at the same fret and one mode brighter, until Lydian wraps round to Locrian. That step is the one exception: Lydian's ♯4 is a fret higher, so the Locrian block starts one fret up.</p><div class="row row-1">${figureHTML(v.stack)}</div>
      <h3 class="fig-h">The whole grid</h3><div class="row row-wide">${figureHTML(v.grid, { wide: true })}</div>
      ${boxes(v)}`;
  } else if (view === 'block') {
    const v = blockView(key, k, labels);
    body = `<h2 class="v-title">${esc(v.title)}</h2><p class="intro">${v.intro}</p>
      <div class="row row-1 big">${figureHTML(v.big)}</div>
      <h3 class="fig-h">Every place it fits</h3>
      ${v.strips.map(s => `<div class="row row-wide">${figureHTML(s, { wide: true })}</div>`).join('')}
      ${boxes(v)}`;
  } else if (view === 'moves') {
    const v = movesView(key, k, labels);
    body = `<h2 class="v-title">${esc(v.title)}</h2><p class="intro">${v.intro}</p>
      <div class="moves">${v.diags.map(d => `<div class="move"><h3>${esc(d.title)}</h3><p>${d.text}</p>${figureHTML(d.spec)}</div>`).join('')}</div>
      ${boxes(v)}`;
  } else {
    const v = chordView(key, k, view, labels);
    body = `<h2 class="v-title">${esc(v.title)}</h2><p class="intro">${v.intro}</p>
      <div class="row row-2">${v.shapes.map(s => figureHTML(s)).join('')}</div>
      ${boxes(v)}`;
  }
  app.innerHTML = `
  <div class="wrap page tool">
    <header class="page-head">
      <h1>Cells</h1>
      <p class="lede">Small shapes from the modes, everywhere on the neck. Learn one, find it in every place it repeats, then move from it in any direction.</p>
    </header>
    <div class="controls">
      <div class="control"><span class="control-l">Key</span>${chips(CIRCLE.map(c => [c, c]), key, v => href(v, k, view), 'chips-keys')}</div>
      <div class="control"><span class="control-l">Mode</span>${chips(names.map((n, i) => [i, `${n} ${MODE_NAMES[i]}`]), view === 'map' ? -1 : k, v => href(key, v, view === 'map' ? 'block' : view))}</div>
      <div class="control"><span class="control-l">Show</span>${chips([...CELL_VIEWS, ['map', `Map of ${key} major`]], view, v => href(key, k, v), 'chips-tabs')}</div>
      <div class="control control-right"><span class="control-l">Labels</span>
        <div class="seg" role="group" aria-label="Labels"><button type="button" data-labels="intervals" class="${labels === 'intervals' ? 'is-on' : ''}" aria-pressed="${labels === 'intervals'}">Intervals</button><button type="button" data-labels="names" class="${labels === 'names' ? 'is-on' : ''}" aria-pressed="${labels === 'names'}">Note names</button></div>
        ${droneButton(rootPc)}
      </div>
    </div>
    <div class="tool-body">${body}</div>
  </div>`;
  app.querySelectorAll('[data-labels]').forEach(b => b.addEventListener('click', () => {
    store.set('labels', b.dataset.labels);
    viewCells(key, k, view);
  }));
}

// ---------- one root

function viewOneRoot(root = 'E', id = 'root') {
  if (!ROOT_NAMES.includes(root)) root = 'E';
  if (!LADDERS.some(l => l.id === id)) id = 'root';
  const v = ladder(root, id);
  const href = (r = root, i = id) => `#/one-root/${encodeURIComponent(r)}/${i}`;
  const order = ['E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A'];
  let body;
  if (id === 'root') {
    body = `<div class="row row-wide">${figureHTML(v.map, { wide: true })}</div>`;
  } else {
    body = `<ol class="ladder">${v.rows.map(r => `<li class="rung">
      <div class="rung-head"><span class="rung-n">${r.n}</span><h3>${esc(r.name)}</h3>${r.change ? `<span class="rung-change">${esc(r.change)}</span>` : ''}<span class="rung-spell">${esc(r.spelling)}</span></div>
      <div class="row row-2">${r.shapes.map(s => figureHTML(s)).join('')}</div></li>`).join('')}</ol>`;
  }
  app.innerHTML = `
  <div class="wrap page tool">
    <header class="page-head">
      <h1>One Root</h1>
      <p class="lede">Everything on one root, in ladders where each step changes a single note. The root stays put, so you hear exactly what each note does to it.</p>
    </header>
    <div class="controls">
      <div class="control"><span class="control-l">Root</span>${chips(order.map(c => [c, c]), root, r => href(r, id), 'chips-keys')}</div>
      <div class="control"><span class="control-l">Ladder</span>${chips(LADDERS.map(l => [l.id, l.name]), id, i => href(root, i), 'chips-tabs')}</div>
      <div class="control control-right">${droneButton(notePc(root))}</div>
    </div>
    <div class="tool-body">
      <h2 class="v-title">${esc(v.title)}</h2>
      <p class="sub">${esc(v.sub)}</p>
      <p class="intro">${v.intro}</p>
      ${body}
      ${boxes(v)}
    </div>
  </div>`;
}

// ---------- songs

function viewSongs() {
  app.innerHTML = `
  <div class="wrap page narrow">
    <header class="page-head">
      <h1>Songs worth learning</h1>
      <p class="lede">These are vehicles, not repertoire. Each one teaches something you can reuse, and most are songs bands actually call. Some are in awkward keys on purpose.</p>
    </header>
    <h2>Learn these forms first</h2>
    <p>They cover most of what you'll be asked to play in a band.</p>
    <table class="songs"><thead><tr><th scope="col">Form</th><th scope="col">Keys</th><th scope="col">What it gives you</th></tr></thead>
    <tbody>${FORMS.map(([a, b, c]) => `<tr><th scope="row">${a}</th><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody></table>
    <h2>Then these songs</h2>
    <p>Keys are from the original recordings.</p>
    <table class="songs"><thead><tr><th scope="col">Song</th><th scope="col">Key</th><th scope="col">What it gives you</th></tr></thead>
    <tbody>${SONGS.map(([a, b, c]) => `<tr${SHORTLIST.includes(a) ? ' class="short"' : ''}><th scope="row">${a}</th><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody></table>
    <p class="note">If you only learn five, learn the marked ones: <em>Stand By Me</em>, <em>Come Together</em>, <em>Chameleon</em>, <em>Superstition</em> and <em>Autumn Leaves</em>. Between them they cover major, Dorian, funk and walking, plus B♭ and E♭ in songs you'd actually get called to play.</p>
    <h2>How to use them</h2>
    <ol class="steps">
      <li>Learn the original line by ear.</li>
      <li>Write a one-page breakdown: the mode, the block it sits in, which cells it uses and which moves it makes.</li>
      <li>Play your own line over the same changes. The original shows you what a good bass player chose; your version keeps it yours.</li>
    </ol>
  </div>`;
}

// ---------- about

function viewAbout() {
  app.innerHTML = `
  <div class="wrap page narrow">
    <header class="page-head">
      <h1>How it works</h1>
      <p class="lede">Two positions from one root, small shapes inside them, and a drone underneath.</p>
    </header>
    <h2>Two positions, one root</h2>
    <p>Everything here sits in two five-fret windows built from one root on the E string. Position 1 reaches forward from the root, up the neck. Position 2 reaches back from it. Join them at the root and they cover nine frets. On a bass every string is a fourth apart, so the shapes never change from one string to the next, and inside a window every note has exactly one place.</p>
    <div class="row row-2">${figureHTML({ start: 7, n: 7, strings: [0, 1, 2, 3], root: 8, notes: [[0, 8, '1', 'root'], [2, 10, '8', 'root'], [0, 10, '2', 'sel'], [0, 12, '3', 'sel'], [1, 8, '4', 'sel'], [1, 10, '5', 'sel'], [1, 12, '6', 'sel'], [2, 9, '7', 'sel']], shade: [[0, 12], [1, 12]], cap: 'Position 1: forward from C, 8th fret' })}${figureHTML({ start: 3, n: 7, strings: [0, 1, 2, 3], root: 8, notes: [[0, 8, '1', 'root'], [3, 5, '8', 'root'], [1, 5, '2', 'sel'], [1, 7, '3', 'sel'], [1, 8, '4', 'sel'], [2, 5, '5', 'sel'], [2, 7, '6', 'sel'], [3, 4, '7', 'sel']], shade: [[3, 4]], cap: 'Position 2: back from the same C' })}</div>
    <h2>The diagrams</h2>
    <p>The neck is drawn flat, the way you look down at it: E string at the bottom, G at the top, fret numbers underneath, the root's fret in bold. Labels are intervals from the root unless a page says otherwise. Tap any note to hear it, or press the play button under a diagram to hear the whole shape.</p>
    ${legendHTML()}
    <h2>The drone</h2>
    <p>The bar at the bottom of the screen holds a low root note for as long as you want it. Each practice page has a button that sets it to that page's root. Bass speakers and headphones will give you the low end; laptop speakers will give you mostly the overtones, which is still enough to hear the intervals against.</p>
    <h2>Your progress</h2>
    <p>Days you mark as done in the Woodshed are saved in this browser on this device. Nothing is sent anywhere. Clearing your browser data clears them.</p>
    <p><button class="btn btn-quiet" type="button" id="resetBtn">Clear my Woodshed progress</button></p>
    <h2>Who made this</h2>
    <p>I'm Graham Tippett. I write the books at <a href="https://unlocktheguitar.net" target="_blank" rel="noopener">unlocktheguitar.net</a>, mostly about guitar, built on intervals and small systems rather than memorising boxes. Bass is where that way of thinking works best, because the instrument is already organised that way. The Woodshed, Cells and One Root started as books I wrote for my own practice.</p>
    <p>The system behind them is in <a href="${UTG_BASS}" target="_blank" rel="noopener">The 2 Position Bass System</a>.</p>
  </div>`;
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!done.size) return;
    done.clear();
    store.set('done', []);
    document.getElementById('resetBtn').textContent = 'Progress cleared';
  });
}

// ---------------------------------------------------------------- drone bar

function droneBar() {
  const bar = document.getElementById('droneBar');
  const sel = bar.querySelector('select');
  sel.innerHTML = ROOT_NAMES.map((n, i) => `<option value="${i}">${n}</option>`).join('');
  sel.value = store.get('dronePc', 4);
  const btn = bar.querySelector('.drone-toggle');
  const vol = bar.querySelector('input[type=range]');
  vol.value = store.get('droneVol', 0.5);
  setDroneVolume(+vol.value);
  const render = s => {
    btn.textContent = s.on ? 'Stop' : 'Start';
    btn.setAttribute('aria-pressed', s.on);
    bar.classList.toggle('is-on', s.on);
    document.body.classList.toggle('drone-on', s.on);
    if (s.on) sel.value = s.pc;
  };
  onDroneChange(render);
  btn.addEventListener('click', () => {
    if (droneState().on) stopDrone(); else startDrone(+sel.value);
  });
  sel.addEventListener('change', () => {
    store.set('dronePc', +sel.value);
    if (droneState().on) startDrone(+sel.value);
  });
  vol.addEventListener('input', () => { setDroneVolume(+vol.value); store.set('droneVol', +vol.value); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-drone]');
    if (!b) return;
    const pc = +b.dataset.drone;
    sel.value = pc;
    store.set('dronePc', pc);
    if (droneState().on && droneState().pc === pc) stopDrone(); else startDrone(pc);
  });
  render(droneState());
}

// ---------------------------------------------------------------- router

function setNav(name) {
  document.querySelectorAll('.nav a').forEach(a => {
    const on = a.dataset.nav === name;
    a.classList.toggle('is-on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

const TITLES = { home: 'In Fourths: bass practice, one small shape at a time', woodshed: 'The Woodshed', cells: 'Cells', oneroot: 'One Root', songs: 'Songs worth learning', about: 'How it works' };

async function route() {
  stopPlayback();
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const [a, b, c, d] = parts;
  let nav = 'home';
  try {
    if (a === 'woodshed' && b) { nav = 'woodshed'; await viewDay(parseInt(b, 10) || 1); }
    else if (a === 'woodshed') { nav = 'woodshed'; await viewWoodshed(); }
    else if (a === 'cells') { nav = 'cells'; viewCells(b || 'C', c || 0, d || 'block'); }
    else if (a === 'one-root') { nav = 'oneroot'; viewOneRoot(b || 'E', c || 'root'); }
    else if (a === 'songs') { nav = 'songs'; viewSongs(); }
    else if (a === 'about') { nav = 'about'; viewAbout(); }
    else viewHome();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="wrap page"><h1>This page didn't load</h1><p>${esc(err.message)}. Reload the page to try again, or go back to the <a href="#/">start</a>.</p></div>`;
  }
  setNav(nav);
  document.title = nav === 'home' ? TITLES.home : `${TITLES[nav]} · In Fourths`;
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
}

wireDiagrams(app);
droneBar();
window.addEventListener('hashchange', route);
route();
