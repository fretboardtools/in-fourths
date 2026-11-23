// Cells: small shapes from the modes, and every place they repeat on the neck.
import {
  MODE_NAMES, modeInfo, majorScale, notePc, efret, place, pcAt, windowOf, labelFor, tokSemis, ordinal, BRIGHT
} from './theory.js';

export const CELL_VIEWS = [
  ['block', 'The block'],
  ['moves', 'The moves'],
  ['triad', 'The triad'],
  ['seventh', 'The 7th'],
  ['ninth', 'The 9th'],
];

const ABBR = { Ionian: 'Ion', Dorian: 'Dor', Phrygian: 'Phr', Lydian: 'Lyd', Mixolydian: 'Mix', Aeolian: 'Aeo', Locrian: 'Loc' };
const MAXF = 15;

export function modeOf(key, k) {
  const names = majorScale(key);
  const info = modeInfo(k);
  const root = names[k];
  return { ...info, root, pc: notePc(root), names, title: `${root} ${info.name}` };
}

// note name for a pitch class inside the key
function nameIn(key, pc) {
  const names = majorScale(key);
  const hit = names.find(n => notePc(n) === pc);
  return hit || null;
}

function lab(m, s, mode, key) {
  if (mode === 'names') return nameIn(key, ((m.pc + s) % 12 + 12) % 12) || labelFor(m.toks, s);
  return labelFor(m.toks, s);
}

function blockSemis(m) {
  return m.semis.filter(s => s <= 9);
}

// The six notes of a block with its root on string rs, fret r.
function blockNotes(m, rs, r, labels, key, opts = {}) {
  const out = [];
  for (const s of blockSemis(m)) {
    const p = place(rs, r, 1, s);
    if (!p) continue;
    let st = s === 0 ? 'root' : 'lit';
    if (opts.colour && labelFor(m.toks, s) === m.colour && s !== 0) st = 'colour';
    if (opts.style) st = opts.style(s, st);
    out.push([p[0], p[1], lab(m, s, labels, key), st]);
  }
  return out;
}

// Moving a block up a string: the next block starts on this mode's 4th, on the string above.
// That's the same fret for every mode except Lydian, whose ♯4 is a fret higher.
function upString(m, rs, r) {
  return { rs: rs + 1, r: r + (m.semis[3] - 5) };
}
// Moving down a string: the next block's root is a 4th below, on the string below.
// Same fret for every mode except Locrian, whose 4th below (a ♯4 below) is a fret lower.
function downString(m, rs, r, below) {
  let d = ((below.pc - pcAt(rs - 1, r)) % 12 + 12) % 12;
  if (d > 6) d -= 12;
  return { rs: rs - 1, r: r + d };
}

export function blockPlaces(pc, lower) {
  const out = [];
  for (let f = 0; f + 4 <= MAXF; f++) if (pcAt(lower, f) === pc) out.push(f);
  return out;
}

// ---------------------------------------------------------------- the views

export function blockView(key, k, labels) {
  const m = modeOf(key, k);
  const r = efret(m.pc, 1);
  const big = {
    start: Math.max(1, r - 1), n: 7, strings: [0, 1, 2, 3], root: r,
    notes: blockNotes(m, 0, r, labels, key, { colour: true }),
    shade: [], cap: `${m.title} block · E string, ${ordinal(r)} fret`,
  };
  const pairs = [[0, 'E and A strings'], [1, 'A and D strings'], [2, 'D and G strings']];
  const strips = pairs.map(([lower, nm]) => {
    const places = blockPlaces(m.pc, lower);
    const notes = [];
    const boxes = [];
    for (const f of places) {
      notes.push(...blockNotes(m, lower, f, labels, key, { colour: true }));
      boxes.push({ lo: f, hi: f + 4, s0: lower, s1: lower + 1, style: 'solid' });
    }
    return { start: 0, n: MAXF + 1, strings: [lower, lower + 1], notes, boxes, cap: `${nm}: ${places.length} place${places.length === 1 ? '' : 's'}` };
  });
  const colourIn = blockSemis(m).some(s => labelFor(m.toks, s) === m.colour);
  return {
    m,
    title: `${m.title}: the block`,
    intro: `Three notes on one string and three on the next, from the root. That's the whole of ${m.name} on two strings. ` +
      (colourIn ? `The ringed note is the ${m.colour}, the note that makes it sound like ${m.name}. ` : '') +
      `Below, every place the same six notes fit on the neck, up to the 15th fret. It's the same shape on every pair of strings, so there's nothing new to learn in any of them.`,
    big, strips,
    do: [`Drone on ${m.root}. Play the block up and back until it's automatic.`,
      'Then play it in every outlined place in the strips, moving from one to the next without stopping.',
      `Say "${m.title}" every time you land on the root.`],
    rule: 'Six notes, two strings, nothing else.',
    got: 'You can find the block anywhere on the neck in a second.',
  };
}

function cellToks(m, kind) {
  const t = [0, m.semis[2], m.semis[4]];
  if (kind === 'seventh' || kind === 'ninth') t.push(m.semis[6]);
  if (kind === 'ninth') t.push(m.semis[1] + 12);
  return t;
}

function shapeSpec(m, kind, pos, labels, key) {
  const r = efret(m.pc, pos);
  const [lo, hi] = windowOf(r, pos);
  const lit = cellToks(m, kind);
  const notes = [];
  const taken = new Set();
  const shade = [];
  const stretch = pos === 1 ? hi : lo;
  for (const s of lit) {
    const p = place(0, r, pos, s);
    if (!p) continue;
    taken.add(p.join(','));
    notes.push([p[0], p[1], lab(m, s, labels, key), s === 0 ? 'root' : 'lit']);
    if (p[1] === stretch && s !== 0) shade.push(p);
  }
  for (let st = 0; st < 4; st++) {
    for (let f = lo; f <= hi; f++) {
      const s = f - r + 5 * st;
      if (s < 0 || s > 12 || taken.has(`${st},${f}`)) continue;
      if (m.semis.includes(s % 12)) notes.push([st, f, lab(m, s, labels, key), 'faint']);
    }
  }
  return {
    start: Math.max(1, lo - 1), n: 7, strings: [0, 1, 2, 3], root: r, notes, shade,
    cap: pos === 1 ? `Forward, Position 1, ${ordinal(r)} fret` : `Back, Position 2, ${ordinal(r)} fret`,
  };
}

export function chordView(key, k, kind, labels) {
  const m = modeOf(key, k);
  const q = kind === 'triad' ? m.q3 : kind === 'seventh' ? m.q7 : m.q9;
  const chord = `${m.root}${q}`;
  const toks = cellToks(m, kind).map(s => labelFor(m.toks, s));
  const two = 'Both shapes are movable: they work from any root on the E string, and the forward one from the A string too. Join them at the root and they cover nine frets. The faint notes are the rest of the mode.';
  const sev = labelFor(m.toks, m.semis[6]);
  const nin = labelFor(m.toks, m.semis[1] + 12);
  const text = {
    triad: {
      intro: `${chord} in two movable shapes. Forward from the root: the 1 and 3 on one string and the 5 on the next, the same three notes you found in the block. Back from the root: one note per string as you go up. ${two}`,
      do: [`Drone on ${m.root}. The forward shape up and back, then the back shape.`,
        'Then join them at the root: back shape up to the root, forward shape on from there, and back down.',
        'Root on beat 1 every time.'],
      rule: 'Three notes. If you play a faint one, start again.',
      got: 'You can play the triad either way from any root without stopping to work it out.',
    },
    seventh: {
      intro: `Add the ${sev} and you have ${chord}, again in two shapes. Forward, it reaches onto a third string and stays inside four frets. Back, the ${sev} sits ${m.semis[6] === 11 ? 'on the G string at the stretch fret' : 'on the D string, at the same fret as the root'}. ${two}`,
      do: [`Drone on ${m.root}. The forward shape up and back, then the back shape.`, 'Join them at the root, as with the triad.',
        `Then from the 3 in each shape: 3, 5, ${sev}, and back down to the 1.`],
      rule: 'Four notes. Nothing faint.',
      got: `You can play ${chord} forward or back from any root on the E string.`,
    },
    ninth: {
      intro: `One more note, the ${nin}, and you have ${chord}. Forward, it goes on the same string as the ${sev}. Back, it's on the G string, ${m.semis[1] === 2 ? 'one fret' : 'two frets'} behind the root. Played from the 3rd, the top four notes are a chord sitting on top of the root. ${two}`,
      do: [`Drone on ${m.root}. The forward shape up and back, then the back shape.`, 'Join them at the root.',
        `Then only the top four, ${toks.slice(1).join(' ')}, over the drone.`],
      rule: 'Five notes. Nothing faint.',
      got: `You can hear ${chord} as one sound, not five notes.`,
    },
  }[kind];
  return {
    m, title: `${chord}: ${toks.join(' ')}`,
    shapes: [shapeSpec(m, kind, 1, labels, key), shapeSpec(m, kind, 2, labels, key)],
    ...text,
  };
}

function moveDiagram(key, from, to, labels, strings, cap) {
  // from/to: {m, rs, r}
  const notes = new Map();
  const put = (st, f, lb, style) => {
    const k = `${st},${f}`;
    const prev = notes.get(k);
    const rank = { lit: 1, colour: 2, root: 3 };
    if (!prev || rank[style] > rank[prev[3]]) notes.set(k, [st, f, lb, style]);
  };
  for (const s of blockSemis(from.m)) {
    const p = place(from.rs, from.r, 1, s);
    put(p[0], p[1], lab(from.m, s, 'names', key), s === 0 ? 'root' : 'lit');
  }
  for (const s of blockSemis(to.m)) {
    const p = place(to.rs, to.r, 1, s);
    put(p[0], p[1], lab(to.m, s, 'names', key), s === 0 ? 'colour' : 'lit');
  }
  const lo = Math.min(from.r, to.r), hi = Math.max(from.r, to.r) + 4;
  const n = Math.max(7, hi - lo + 3);
  const start = lo <= 1 ? 0 : lo - 1;
  return {
    start, n, strings, root: from.r, notes: [...notes.values()],
    boxes: [
      { lo: from.r, hi: from.r + 4, s0: from.rs, s1: from.rs + 1, style: 'solid' },
      { lo: to.r, hi: to.r + 4, s0: to.rs, s1: to.rs + 1, style: 'dash' },
    ],
    cap,
  };
}

export function movesView(key, k, labels) {
  const m = modeOf(key, k);
  const r = efret(m.pc, 1);
  const up = modeOf(key, (k + 1) % 7);
  let rUp = r + ((up.pc - m.pc + 12) % 12);
  const down = modeOf(key, (k + 6) % 7);
  let rDown = r - ((m.pc - down.pc + 12) % 12);
  let rA = r, rB = r;
  if (rDown < 0) { rDown += 12; rB += 12; }
  const across = modeOf(key, (k + 3) % 7);   // root a 4th up: one mode brighter
  const below = modeOf(key, (k + 4) % 7);    // root a 4th down: one mode darker
  let ra = ((m.pc - 9) % 12 + 12) % 12; if (ra < 1) ra += 12;
  const brighter = BRIGHT.indexOf(across.name) < BRIGHT.indexOf(m.name) ? 'one mode brighter' : 'Lydian to Locrian: the wrap-round';
  const darker = BRIGHT.indexOf(below.name) > BRIGHT.indexOf(m.name) ? 'one mode darker' : 'Locrian to Lydian: the wrap-round';
  const diags = [
    { title: `Up the neck: ${up.title}`, text: `Start the next block on the second note of this one. Same two strings, next mode in scale order.`,
      spec: moveDiagram(key, { m, rs: 0, r: rA }, { m: up, rs: 0, r: rUp }, labels, [0, 1], `${m.title} to ${up.title}`) },
    { title: `Down the neck: ${down.title}`, text: `Start a block on the note below this root. Same two strings, the mode before in scale order.`,
      spec: moveDiagram(key, { m, rs: 0, r: rB }, { m: down, rs: 0, r: rDown }, labels, [0, 1], `${m.title} to ${down.title}`) },
    { title: `Up a string: ${across.title}`, text: `${m.name === 'Lydian' ? 'Move the block up a string, one fret higher: Lydian\'s ♯4 is where the next block starts.' : 'Stay at the same fret and move the block up a string.'} The top half of this block becomes the bottom half of the next, and the mode gets ${brighter === 'one mode brighter' ? 'one step brighter' : 'darker: this is the one place it wraps round'}.`,
      spec: moveDiagram(key, { m, rs: 0, r }, { m: across, ...upString(m, 0, r) }, labels, [0, 1, 2], `${m.title} to ${across.title}, ${brighter}`) },
    { title: `Down a string: ${below.title}`, text: `Play this block from its root on the A string, then drop it a string${m.name === 'Locrian' ? ', one fret lower' : ' at the same fret'}. The bottom half of this block becomes the top half of the next, and the mode gets ${darker === 'one mode darker' ? 'one step darker' : 'brighter: this is the one place it wraps round'}.`,
      spec: moveDiagram(key, { m, rs: 1, r: ra }, { m: below, ...downString(m, 1, ra, below) }, labels, [0, 1, 2], `${m.title} to ${below.title}, ${darker}`) },
  ];
  return {
    m, title: `${m.title}: the moves`,
    intro: `Four ways out of the block. Along the neck you move to the next mode in scale order. Across the strings you move one mode brighter going up and one darker going down, at the same fret except at the Lydian–Locrian step, which is a fret off. The solid outline is where you are, the dashed one is where you're going, and the ringed note is the new root. Note names here, because the root changes.`,
    diags,
    do: [`Drone on ${m.root}. Play this block, then each move in turn: play the new block and come back.`,
      'Then chain them: up the neck twice, up a string, down the neck, down a string. Name each mode as you land on its root.',
      'Then keep the drone on the key\'s root and walk the blocks without stopping.'],
    rule: 'Name the mode before you play it.',
    got: 'You can leave the block in any direction and know which mode you\'re in.',
  };
}

export function mapView(key, labels) {
  const names = majorScale(key);
  const pcs = names.map(notePc);
  const tagFor = (st, f) => {
    if (st > 2) return null;
    const i = pcs.indexOf(pcAt(st, f));
    if (i < 0) return null;
    if (f + 4 > MAXF) return null;
    return ABBR[MODE_NAMES[i]];
  };
  const notes = (strings) => {
    const out = [];
    for (const st of strings) for (let f = 0; f <= MAXF; f++) {
      const pc = pcAt(st, f);
      const i = pcs.indexOf(pc);
      if (i < 0) continue;
      const tag = strings.includes(st + 1) ? tagFor(st, f) : null;
      out.push([st, f, names[i], i === 0 ? 'root' : 'sel', tag]);
    }
    return out;
  };
  const along = { start: 0, n: MAXF + 1, strings: [0, 1], notes: notes([0, 1]), cap: `${key} major along the E and A strings: every note starts a block` };
  // the stack: Ionian on the E string, then a string up at the same fret
  const r = efret(pcs[0], 1);
  const stackModes = [[0, 0, 'solid'], [1, 3, 'dash'], [2, 6, 'dot']];
  const sNotes = [];
  const boxes = [];
  let cur = { rs: 0, r };
  for (const [rs, k, style] of stackModes) {
    const m = modeOf(key, k);
    for (const s of blockSemis(m)) {
      const p = place(cur.rs, cur.r, 1, s);
      if (!sNotes.some(n => n[0] === p[0] && n[1] === p[1])) sNotes.push([p[0], p[1], lab(m, s, 'names', key), s === 0 ? 'root' : 'lit']);
      else if (s === 0) sNotes.find(n => n[0] === p[0] && n[1] === p[1])[3] = 'root';
    }
    boxes.push({ lo: cur.r, hi: cur.r + 4, s0: rs, s1: rs + 1, style });
    cur = upString(m, cur.rs, cur.r);
  }
  const stackNames = stackModes.map(([, k]) => modeOf(key, k).title);
  const stack = { start: Math.max(1, r - 1), n: 8, strings: [0, 1, 2, 3], root: r, notes: sNotes, boxes, cap: stackNames.join(' / ') };
  const grid = { start: 0, n: MAXF + 1, strings: [0, 1, 2, 3], notes: notes([0, 1, 2, 3]), cap: `${key} major, the whole neck to the 15th fret` };
  return {
    title: `${key} major: the map`,
    intro: `The seven blocks put together. Every note of ${key} major on the E, A and D strings starts a block, and the small tag says which mode. Along a string the modes go in scale order. Up a string at the same fret, each is one mode brighter; the one exception is Lydian, whose next block up (Locrian) starts a fret higher.`,
    along, stack, grid, stackNames,
    do: [`Drone on ${key}. Every block along the E and A strings, lowest to highest and back, naming each mode.`,
      `Then the stack: ${stackNames.join(', ')}, up the strings and back down.`,
      'Then pick any tag on the grid, play that block, and move from it in all four directions.'],
    rule: 'Find the root first.',
    got: `You can play all seven blocks in ${key} and move between them without the page.`,
  };
}

export function keyTable(key) {
  return majorScale(key).map((n, i) => ({ mode: MODE_NAMES[i], root: n, title: `${n} ${MODE_NAMES[i]}` }));
}
