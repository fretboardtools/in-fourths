import { ROOT_NAMES, CIRCLE, notePc, MODE_NAMES, majorScale, leadingNote, pcAt } from './theory.js';
import { diagramSVG, figureHTML } from './neck.js';
import { startDrone, stopDrone, setDroneVolume, droneState, onDroneChange } from './audio.js';
import { CELL_VIEWS, blockView, chordView, movesView, mapView, modeOf, blockPlaces } from './cells.js';
import { LADDERS, ladder } from './oneroot.js';
import { FORMS, SONGS, SHORTLIST } from './songs.js';

const app = document.getElementById('app');
const UTG_BASS = 'https://unlocktheguitar.net/bass-scale-patterns-two-position-system.html';

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
  // the C Ionian block at the 8th fret, lit; every other place it fits drawn faint
  const m = modeOf('C', 0);
  const notes = [], bx = [];
  const seen = new Set();
  const labs = ['1', '', '2', '', '3', '4', '', '5', '', '6'];
  [0, 1, 2].forEach(lower => {
    blockPlaces(m.pc, lower).forEach(f => {
      const main = lower === 0 && f === 8;
      bx.push({ lo: f, hi: f + 4, s0: lower, s1: lower + 1, style: main ? 'solid' : 'dash' });
      m.semis.filter(s => s <= 9).forEach(s => {
        const st = s <= 4 ? lower : lower + 1;
        const fr = s <= 4 ? f + s : f + s - 5;
        const key = `${st},${fr}`;
        if (main) { notes.push([st, fr, labs[s], s === 0 ? 'root' : 'lit']); seen.add(key); }
        else if (!seen.has(key)) { notes.push([st, fr, labs[s], 'faint']); seen.add(key); }
      });
    });
  });
  return { start: 0, n: 16, strings: [0, 1, 2, 3], notes, boxes: bx, cap: 'The C Ionian block at the 8th fret, and the other places the same shape fits' };
}

function viewHome() {
  const nd = nextDay();
  const started = done.size > 0;
  app.innerHTML = `
  <section class="hero">
    <div class="hero-text wrap">
      <h1>Learn one small shape. Then find it all over the neck.</h1>
      <p class="lede">Every string on a bass is a fourth apart, so a shape you learn on two strings works on every pair, and again twelve frets up.</p>
    </div>
    <div class="hero-neck" id="heroNeck">${diagramSVG(heroSpec())}</div>
    <div class="wrap start">
      <a class="btn btn-main btn-big" href="#/woodshed/${nd}">${started ? `Carry on with Day ${nd}` : 'Start Day 1'}</a>
      <p>${started ? `You've done ${done.size} of 182 days of the Woodshed.` : 'The Woodshed is one page a day for 26 weeks, twenty to thirty minutes with a drone. You never have to decide what to practise.'}</p>
    </div>
  </section>

  <section class="wrap also">
    <p class="also-l">Or go straight to the shapes</p>
    <a class="also-item" href="#/cells"><strong>Cells</strong><span>The small shapes inside each mode, and every place they repeat, in any key.</span></a>
    <a class="also-item" href="#/one-root"><strong>One Root</strong><span>Chords, modes and scales on one root, one changed note at a time.</span></a>
  </section>`;
  animateHero();
}

function animateHero() {
  const svg = document.querySelector('#heroNeck svg');
  if (!svg) return;
  // on a narrow screen the neck scrolls: bring the lit block into view
  const wrap = document.getElementById('heroNeck');
  const main = svg.querySelector('.box-solid');
  if (main && wrap.scrollWidth > wrap.clientWidth) {
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    const x = (+main.getAttribute('x') + +main.getAttribute('width') / 2) * scale;
    wrap.scrollLeft = x - wrap.clientWidth / 2;
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const repeats = [...svg.querySelectorAll('.box-dash')];
  svg.classList.add('hero-anim');
  repeats.sort((a, b) => +a.getAttribute('x') - +b.getAttribute('x')).forEach((b, k) => {
    setTimeout(() => b.classList.add('show'), 700 + k * 450);
  });
}

// ---------- woodshed

async function viewWoodshed() {
  const data = await shed();
  const nd = nextDay();
  const cw = Math.ceil(nd / 7);
  const wk = data.weeks[cw];
  const thisWeek = [];
  for (let d = (cw - 1) * 7 + 1; d <= cw * 7; d++) {
    const p = data.days[d - 1];
    thisWeek.push(`<li><a class="wday${done.has(d) ? ' is-done' : ''}${d === nd ? ' is-next' : ''}" href="#/woodshed/${d}"><span class="wday-n">${d}</span><span class="wday-t">${esc(p.title)}</span>${done.has(d) ? '<span class="tick" aria-label="done"></span>' : ''}</a></li>`);
  }
  const parts = PARTS.map(([a, b, name, text]) => {
    const rows = [];
    let partDone = 0;
    for (let w = a; w <= b; w++) {
      let n = 0;
      for (let d = (w - 1) * 7 + 1; d <= w * 7; d++) if (done.has(d)) n++;
      partDone += n;
      rows.push(`<li><a href="#/woodshed/${(w - 1) * 7 + 1}"><span class="wn">Week ${w}</span><span class="wt">${esc(data.weeks[w].title)}</span><span class="wk">${n ? `${n} of 7` : ''}</span></a></li>`);
    }
    const open = cw >= a && cw <= b;
    return `<details class="part"${open ? ' open' : ''}><summary><span class="part-name">${name}</span><span class="part-weeks">Weeks ${a}–${b}</span></summary><p>${text}</p><ol class="weeks">${rows.join('')}</ol></details>`;
  }).join('');
  app.innerHTML = `
  <div class="wrap page narrow">
    <header class="page-head">
      <h1>The Woodshed</h1>
      <p class="lede">One page a day for 26 weeks. Each page is one idea, a few diagrams, three steps and one rule.</p>
    </header>
    <section class="thisweek">
      <h2>Week ${cw}: ${esc(wk.title)}</h2>
      <ol class="wdays">${thisWeek.join('')}</ol>
      <a class="btn btn-main" href="#/woodshed/${nd}">${done.size ? `Carry on with Day ${nd}` : 'Start Day 1'}</a>
    </section>
    <section class="allweeks">
      <h2>All 26 weeks</h2>
      ${parts}
    </section>
    <details class="readme">
      <summary>How a week works</summary>
      <p>From Week 3 to Week 20 each week covers one mode or one set of changes, and each day of the week has the same job. Keys move one step round the circle of fifths each week. If you haven't got a page, move on anyway: the review days bring it back.</p>
      <ol class="weekdays">${WEEKDAYS.map(([n, t], i) => `<li><strong>Day ${i + 1}: ${n}.</strong> ${t}</li>`).join('')}</ol>
    </details>
    <details class="readme">
      <summary>Reading the diagrams</summary>
      <p>E string at the bottom, G at the top, fret numbers underneath, the root's fret in bold. Labels are intervals from the root.</p>
      ${legendHTML()}
    </details>
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
      <div class="tools">${rootPc !== null ? droneButton(rootPc) : ''}</div>
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

function selectHTML(id, label, options, current) {
  return `<label class="pick"><span>${label}</span><select id="${id}">${options.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(current) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
}

function tabsHTML(items, current, href) {
  return `<nav class="tabs" aria-label="View">${items.map(([v, t]) => `<a href="${href(v)}" class="${v === current ? 'is-on' : ''}"${v === current ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>`;
}

function viewCells(key = 'C', k = 0, view = 'block') {
  if (!CIRCLE.includes(key)) key = 'C';
  k = Math.max(0, Math.min(6, +k || 0));
  const views = [...CELL_VIEWS.map(([v, t]) => [v, t.replace(/^The /, '').replace(/^./, c => c.toUpperCase())]), ['map', 'Whole key']];
  if (!views.some(([v]) => v === view)) view = 'block';
  const labels = store.get('labels', 'intervals');
  const names = majorScale(key);
  const href = (kk = key, mm = k, vv = view) => `#/cells/${encodeURIComponent(kk)}/${mm}/${vv}`;
  let body = '';
  let rootPc = notePc(names[k]);
  if (view === 'map') {
    const v = mapView(key, labels);
    rootPc = notePc(key);
    body = `<p class="intro">${v.intro}</p>
      <h3 class="fig-h">Along the neck</h3><div class="row row-wide">${figureHTML(v.along, { wide: true })}</div>
      <h3 class="fig-h">The stack, up the strings</h3><p class="fig-p">${v.stackNames.join(', then ')}: each a string up and one mode brighter. Lydian to Locrian is the one step that moves a fret, because Lydian's ♯4 is a fret higher.</p><div class="row row-1">${figureHTML(v.stack)}</div>
      <details class="more-figs"><summary>The whole grid</summary><div class="row row-wide">${figureHTML(v.grid, { wide: true })}</div></details>
      ${boxes(v)}`;
  } else if (view === 'block') {
    const v = blockView(key, k, labels);
    body = `<p class="intro">${v.intro}</p>
      <div class="row row-1 big">${figureHTML(v.big)}</div>
      <details class="more-figs"><summary>Every place it fits on the neck</summary>${v.strips.map(st => `<div class="row row-wide">${figureHTML(st, { wide: true })}</div>`).join('')}</details>
      ${boxes(v)}`;
  } else if (view === 'moves') {
    const v = movesView(key, k, labels);
    body = `<p class="intro">${v.intro}</p>
      <div class="moves">${v.diags.map(d => `<div class="move"><h3>${esc(d.title)}</h3><p>${d.text}</p>${figureHTML(d.spec)}</div>`).join('')}</div>
      ${boxes(v)}`;
  } else {
    const v = chordView(key, k, view, labels);
    body = `<h2 class="v-title">${esc(v.title)}</h2><p class="intro">${v.intro}</p>
      <div class="row row-2">${v.shapes.map(sh => figureHTML(sh)).join('')}</div>
      ${boxes(v)}`;
  }
  const heading = view === 'map' ? `${key} major` : `${names[k]} ${MODE_NAMES[k]}`;
  app.innerHTML = `
  <div class="wrap page tool">
    <header class="tool-head">
      <h1>Cells</h1>
      <div class="picks">
        ${selectHTML('pickKey', 'Key', CIRCLE.map(c => [c, `${c} major`]), key)}
        ${view === 'map' ? '' : selectHTML('pickMode', 'Mode', names.map((n, i) => [i, `${n} ${MODE_NAMES[i]}`]), k)}
        ${droneButton(rootPc)}
      </div>
    </header>
    ${tabsHTML(views, view, v => href(key, k, v))}
    <div class="tool-body">
      <div class="v-head"><h2 class="v-big">${esc(heading)}</h2>
        <label class="toggle"><input type="checkbox" id="names"${labels === 'names' ? ' checked' : ''}> Note names</label></div>
      ${body}
    </div>
  </div>`;
  document.getElementById('pickKey').addEventListener('change', e => { location.hash = href(e.target.value, k, view); });
  const pm = document.getElementById('pickMode');
  if (pm) pm.addEventListener('change', e => { location.hash = href(key, e.target.value, view); });
  document.getElementById('names').addEventListener('change', e => {
    store.set('labels', e.target.checked ? 'names' : 'intervals');
    viewCells(key, k, view);
  });
}

// ---------- one root

function viewOneRoot(root = 'E', id = 'triads', step = 1) {
  if (!ROOT_NAMES.includes(root)) root = 'E';
  if (!LADDERS.some(l => l.id === id)) id = 'triads';
  const v = ladder(root, id);
  const href = (r = root, i = id, st) => `#/one-root/${encodeURIComponent(r)}/${i}${st ? '/' + st : ''}`;
  const order = ['E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A'];
  const li = LADDERS.findIndex(l => l.id === id);
  const prev = LADDERS[li - 1], next = LADDERS[li + 1];
  let body;
  if (id === 'root') {
    body = `<p class="intro">${v.intro}</p><div class="row row-wide">${figureHTML(v.map, { wide: true })}</div>`;
  } else {
    step = Math.max(1, Math.min(v.rows.length, +step || 1));
    const sel = v.rows.find(r => r.n === step) || v.rows[0];
    body = `<p class="intro">${v.intro}</p>
      <ol class="rungs">${v.rows.map(r => `<li><a class="rung-link${r === sel ? ' is-on' : ''}" href="${href(root, id, r.n)}"${r === sel ? ' aria-current="step"' : ''}>
        <span class="rung-n">${r.n}</span><span class="rung-name">${esc(r.name)}</span><span class="rung-change">${esc(r.change || 'the top')}</span><span class="rung-spell">${esc(r.spelling)}</span></a></li>`).join('')}</ol>
      <div class="rung-open">
        <h3>${esc(sel.name)}${sel.change ? `<span class="rung-change">${esc(sel.change)}</span>` : ''}</h3>
        <div class="row row-2">${sel.shapes.map(sh => figureHTML(sh)).join('')}</div>
      </div>`;
  }
  app.innerHTML = `
  <div class="wrap page tool">
    <header class="tool-head">
      <h1>One Root</h1>
      <div class="picks">
        ${selectHTML('pickRoot', 'Root', order.map(c => [c, c]), root)}
        ${selectHTML('pickLadder', 'Ladder', LADDERS.map(l => [l.id, l.name]), id)}
        ${droneButton(notePc(root))}
      </div>
    </header>
    <div class="tool-body">
      <div class="v-head"><h2 class="v-big">${esc(v.title)}</h2><p class="sub">${esc(v.sub)}</p></div>
      ${body}
      ${boxes(v)}
      <nav class="pager ladder-pager">${prev ? `<a class="btn btn-quiet" href="${href(root, prev.id)}">${esc(prev.name)}</a>` : ''}${next ? `<a class="btn btn-quiet" href="${href(root, next.id)}">Next: ${esc(next.name)}</a>` : ''}</nav>
    </div>
  </div>`;
  document.getElementById('pickRoot').addEventListener('change', e => { location.hash = href(e.target.value, id, step); });
  document.getElementById('pickLadder').addEventListener('change', e => { location.hash = href(root, e.target.value); });
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
    <p>The neck is drawn flat, the way you look down at it: E string at the bottom, G at the top, fret numbers underneath, the root's fret in bold. Labels are intervals from the root unless a page says otherwise. On the line pages, the small numbers beside the notes are the beats.</p>
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

let prevA = null;
async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const [a, b, c, d] = parts;
  let nav = 'home';
  try {
    if (a === 'woodshed' && b) { nav = 'woodshed'; await viewDay(parseInt(b, 10) || 1); }
    else if (a === 'woodshed') { nav = 'woodshed'; await viewWoodshed(); }
    else if (a === 'cells') { nav = 'cells'; viewCells(b || 'C', c || 0, d || 'block'); }
    else if (a === 'one-root') { nav = 'oneroot'; viewOneRoot(b || 'E', c || 'triads', d || 1); }
    else if (a === 'songs') { nav = 'songs'; viewSongs(); }
    else if (a === 'about') { nav = 'about'; viewAbout(); }
    else viewHome();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="wrap page"><h1>This page didn't load</h1><p>${esc(err.message)}. Reload the page to try again, or go back to the <a href="#/">start</a>.</p></div>`;
  }
  setNav(nav);
  document.title = nav === 'home' ? TITLES.home : `${TITLES[nav]} · In Fourths`;
  if (!(a === 'one-root' && d) && !(a === 'cells' && c !== undefined && prevA === 'cells')) window.scrollTo(0, 0);
  prevA = a;
  app.focus({ preventScroll: true });
}

droneBar();
window.addEventListener('hashchange', route);
route();
