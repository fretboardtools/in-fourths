// One Root: triads, sevenths, ninths, modes and scales on one root, in ladders
// where each step changes a single note.
import { place, windowOf, tokSemis, spell, efret, notePc, ordinal, OPEN } from './theory.js';

const OCT = ['8'];

const TRIADS = [
  ['augmented', '', ['1', '3', '♯5'], [], []],
  ['major', '♯5 → 5', ['1', '3', '5'], ['5'], ['♯5']],
  ['minor', '3 → ♭3', ['1', '♭3', '5'], ['♭3'], ['3']],
  ['diminished', '5 → ♭5', ['1', '♭3', '♭5'], ['♭5'], ['5']],
];
const SEVENTHS = [
  ['maj7', '', ['1', '3', '5', '7'], [], []],
  ['7', '7 → ♭7', ['1', '3', '5', '♭7'], ['♭7'], ['7']],
  ['m7', '3 → ♭3', ['1', '♭3', '5', '♭7'], ['♭3'], ['3']],
  ['m7♭5', '5 → ♭5', ['1', '♭3', '♭5', '♭7'], ['♭5'], ['5']],
  ['dim7', '♭7 → ♭♭7', ['1', '♭3', '♭5', '6'], ['6'], ['♭7'], { '6': '♭♭7' }, ['1', '♭3', '♭5', '♭♭7']],
];
const NINTHS = [
  ['maj9', '', ['1', '3', '5', '7', '9'], [], []],
  ['9', '7 → ♭7', ['1', '3', '5', '♭7', '9'], ['♭7'], ['7']],
  ['m9', '3 → ♭3', ['1', '♭3', '5', '♭7', '9'], ['♭3'], ['3']],
  ['m9♭5', '5 → ♭5', ['1', '♭3', '♭5', '♭7', '9'], ['♭5'], ['5']],
  ['m7♭5♭9', '9 → ♭9', ['1', '♭3', '♭5', '♭7', '♭9'], ['♭9'], ['9']],
];
const MODES = [
  ['Lydian', '', '1 2 3 ♯4 5 6 7', [], []],
  ['Ionian', '♯4 → 4', '1 2 3 4 5 6 7', ['4'], ['♯4']],
  ['Mixolydian', '7 → ♭7', '1 2 3 4 5 6 ♭7', ['♭7'], ['7']],
  ['Dorian', '3 → ♭3', '1 2 ♭3 4 5 6 ♭7', ['♭3'], ['3']],
  ['Aeolian', '6 → ♭6', '1 2 ♭3 4 5 ♭6 ♭7', ['♭6'], ['6']],
  ['Phrygian', '2 → ♭2', '1 ♭2 ♭3 4 5 ♭6 ♭7', ['♭2'], ['2']],
  ['Locrian', '5 → ♭5', '1 ♭2 ♭3 4 ♭5 ♭6 ♭7', ['♭5'], ['5']],
];
const OUTSIDE = [
  ['Melodic Minor', 'from Dorian: ♭7 → 7', '1 2 ♭3 4 5 6 7', ['7'], ['♭7']],
  ['Harmonic Minor', 'from Aeolian: ♭7 → 7', '1 2 ♭3 4 5 ♭6 7', ['7'], ['♭7']],
  ['Lydian Dominant', 'from Mixolydian: 4 → ♯4', '1 2 3 ♯4 5 6 ♭7', ['♯4'], ['4']],
  ['Phrygian Dominant', 'from Phrygian: ♭3 → 3', '1 ♭2 3 4 5 ♭6 ♭7', ['3'], ['♭3']],
  ['Altered', 'from Locrian: 4 → ♭4 (sounds as 3)', '1 ♭2 ♯2 3 ♭5 ♯5 ♭7', ['3'], ['4'], null, '1 ♭2 ♭3 ♭4 ♭5 ♭6 ♭7'],
];
const PENT = [
  ['Major Pentatonic', 'Ionian without 4 and 7', '1 2 3 5 6 8', [], ['4', '7']],
  ['Minor Pentatonic', 'Aeolian without 2 and ♭6', '1 ♭3 4 5 ♭7 8', [], ['2', '♭6']],
  ['Blues', 'minor pentatonic + ♭5', '1 ♭3 4 ♭5 5 ♭7 8', ['♭5'], []],
];

export const LADDERS = [
  { id: 'root', name: 'The root' },
  { id: 'triads', name: 'Triads' },
  { id: 'sevenths', name: 'Sevenths' },
  { id: 'ninths', name: 'Ninths' },
  { id: 'major-modes', name: 'Modes: major side' },
  { id: 'minor-modes', name: 'Modes: minor side' },
  { id: 'one-note', name: 'One note from a mode' },
  { id: 'pentatonics', name: 'Pentatonics and blues' },
];

function shape(root, R, tokens, pos, ring, ghost, labels) {
  const [lo, hi] = windowOf(R, pos);
  const stretch = pos === 1 ? hi : lo;
  const notes = [], shade = [], taken = new Set();
  const lab = t => (labels && labels[t]) || t;
  for (const t of tokens) {
    const s = tokSemis(t);
    const p = place(0, R, pos, s);
    if (!p) continue;
    const st = s % 12 === 0 ? 'root' : (ring.includes(t) ? 'colour' : 'lit');
    notes.push([p[0], p[1], lab(t), st]);
    taken.add(p.join(','));
    if (p[1] === stretch && st !== 'root') shade.push(p);
  }
  for (const t of ghost) {
    const p = place(0, R, pos, tokSemis(t));
    if (p && !taken.has(p.join(','))) notes.push([p[0], p[1], lab(t), 'faint']);
  }
  return { start: Math.max(1, lo - 1), n: 7, strings: [0, 1, 2, 3], root: R, notes, shade };
}

function spellLine(root, toks) {
  return toks.map(t => (t === '8' ? root : spell(root, t))).join(' ');
}

function rows(root, R, steps) {
  return steps.map(([name, change, toks, ring, ghost, labels, spelling], i) => {
    const tokens = Array.isArray(toks) ? toks : toks.split(' ');
    const sp = spelling ? (Array.isArray(spelling) ? spelling : spelling.split(' ')) : tokens;
    const f = shape(root, R, tokens, 1, ring, ghost, labels);
    const b = shape(root, R, tokens, 2, ring, ghost, labels);
    f.cap = 'Forward, Position 1';
    b.cap = 'Back, Position 2';
    return { n: i + 1, name, change, spelling: spellLine(root, sp.filter(t => !(t === '8' && sp.length > 1 && false))), shapes: [f, b] };
  });
}

const RING = 'Ringed: the note that just changed. Faint: where it was.';

export function ladder(root, id) {
  const pc = notePc(root);
  const R = efret(pc, 2);
  const nm = (x) => `${root}${x}`;
  switch (id) {
    case 'root': {
      const notes = [];
      for (let st = 0; st < 4; st++) for (let f = 0; f <= 17; f++) if ((OPEN[st] + f) % 12 === pc) notes.push([st, f, root, 'root']);
      return {
        title: `The root: ${root}`, sub: 'Everything on this page is built on one note',
        intro: `Every shape here starts from the same ${root}: the E string, ${ordinal(R)} fret. Position 2 reaches back from it to the ${ordinal(R - 4)} fret and Position 1 reaches forward to the ${ordinal(R + 4)}, so both shapes in every row share that root. The diagram shows every ${root} on the neck, so you can find it anywhere before you start.`,
        map: { start: 0, n: 18, strings: [0, 1, 2, 3], root: R, notes, boxes: [{ lo: R - 4, hi: R, s0: 0, s1: 3, style: 'dash' }, { lo: R, hi: R + 4, s0: 0, s1: 3, style: 'solid' }], cap: `Every ${root} to the 17th fret. Dashed: Position 2. Solid: Position 1.` },
        do: [`Find every ${root} on the neck, low to high, then high to low.`,
          `Play the ${root} at the ${ordinal(R)} fret, then the same note on the A string, ${ordinal(R - 5)} fret.`,
          `Put on a ${root} drone and leave it on for the whole session.`],
        rule: `Every shape here starts from this ${root}.`,
        got: `You can find any ${root} on the neck without counting.`,
      };
    }
    case 'triads':
      return {
        title: 'Triads', sub: 'Augmented → major → minor → diminished',
        intro: `Four triads on ${root}, each one note lower than the last. ${RING}`,
        rows: rows(root, R, TRIADS.map(([n, c, t, r, g]) => [nm(n === 'major' ? '' : n === 'minor' ? 'm' : n === 'augmented' ? '+' : '°'), c, t, r, g])),
        do: [`Drone on ${root}. Down the ladder one bar each, forward shape, then back shape.`, 'Then up the ladder.', 'Then only the moving notes against the drone: ♯5, 5, ♭3, ♭5.'],
        rule: 'Only the ringed note moves.', got: 'You can hear each triad turn into the next.',
      };
    case 'sevenths':
      return {
        title: 'Sevenths', sub: 'maj7 → 7 → m7 → m7♭5 → dim7',
        intro: `Five seventh chords on ${root}, each one note lower than the last. Between them they cover almost every chord symbol on a chart. ${RING}`,
        rows: rows(root, R, SEVENTHS.map(([n, c, t, r, g, l, sp]) => [nm(n), c, t, r, g, l, sp])),
        do: [`Drone on ${root}. Down the ladder one bar each, forward then back.`, 'Then up.', 'Then only the moving notes: 7, ♭7, ♭3, ♭5, ♭♭7.'],
        rule: 'Only the ringed note moves.', got: 'You can name each chord from its sound as it turns into the next.',
      };
    case 'ninths':
      return {
        title: 'Ninths', sub: 'maj9 → 9 → m9 → m9♭5 → m7♭5♭9',
        intro: `The seventh ladder with the 9 on top, then one more step: the 9 itself drops to ♭9. The 9 sits on the D string at the stretch fret going forward, and on the G string going back. Played from the 3rd, the top four notes are a chord sitting on the root. ${RING}`,
        rows: rows(root, R, NINTHS.map(([n, c, t, r, g]) => [nm(n), c, t, r, g])),
        do: [`Drone on ${root}. Down the ladder one bar each, forward then back.`, 'Then from the 3rd only, 3 5 7 9, so you hear the upper chord over the drone.', 'Then only the moving notes: 7, ♭7, ♭3, ♭5, ♭9.'],
        rule: 'Only the ringed note moves.', got: 'You can hear the 9 as part of the chord, not an extra note.',
      };
    case 'major-modes':
    case 'minor-modes': {
      const steps = MODES.map(([n, c, f, r, g]) => [`${root} ${n}`, c, f.split(' ').concat(OCT), r, g]);
      const major = id === 'major-modes';
      return {
        title: major ? 'The modes: major side' : 'The modes: minor side',
        sub: major ? 'Lydian → Ionian → Mixolydian → Dorian' : 'Dorian → Aeolian → Phrygian → Locrian',
        intro: (major ? 'The bright half of the ladder: three major modes, then the first step into minor. ' : 'The dark half, starting again from Dorian so the two pages join. ') +
          `Each mode is the one before with a single note flattened: the ♯4, then the 7, the 3, the 6, the 2 and the 5. It's the move up a string from Cells, seen from one root instead of across the neck. ${RING}`,
        rows: rows(root, R, major ? steps.slice(0, 4) : steps.slice(3)).map((r, i) => ({ ...r, n: major ? i + 1 : i + 4 })),
        do: major
          ? [`Drone on ${root}. One bar of each, forward shape, top to bottom, then back shape.`, 'Then bottom to top, raising one note each time.', 'Then only the moving notes: ♯4, 4, ♭7, ♭3.']
          : [`Drone on ${root}. One bar of each, forward then back, top to bottom.`, 'Then bottom to top.', 'Then the whole ladder from Lydian to Locrian and back without stopping.'],
        rule: 'Find the moving note before you play the mode.',
        got: major ? 'You can hear each step with the drone on.' : 'You can go up and down all seven with the drone on and hear every step.',
      };
    }
    case 'one-note':
      return {
        title: 'One note from a mode', sub: 'Melodic minor, harmonic minor, Lydian dominant, Phrygian dominant, altered',
        intro: 'Five scales that aren\'t on the ladder, each shown against the mode it\'s one note away from. Melodic minor is Dorian with a 7; harmonic minor is Aeolian with a 7; Lydian dominant is Mixolydian with a ♯4; Phrygian dominant is Phrygian with a 3; altered is Locrian with a ♭4, which sounds as the 3. The ringed note is the change; the faint note is the mode\'s own.',
        rows: rows(root, R, OUTSIDE.map(([n, c, f, r, g, l, sp]) => [`${root} ${n}`, c, f.split(' ').concat(OCT), r, g, l, sp ? sp.split(' ').concat(OCT) : null])),
        do: [`Drone on ${root}. Play the mode first, then the scale, forward shape. One bar each.`, 'Then both in the back shape.', 'Then switch every bar and listen to the one note.'],
        rule: 'Always play the mode first.', got: 'You can turn any of the five modes into its neighbour on purpose.',
      };
    case 'pentatonics':
      return {
        title: 'Pentatonics and blues', sub: 'Five notes, then six',
        intro: 'The pentatonics are modes with two notes left out: the faint notes are the missing ones. The blues scale adds one note back, the ringed ♭5, between the 4 and 5.',
        rows: rows(root, R, PENT.map(([n, c, f, r, g]) => [`${root} ${n}`, c, f.split(' '), r, g])),
        do: [`Drone on ${root}. The full mode, then its pentatonic, forward shape.`, 'Then the blues scale, using the ♭5 only as a passing note.', 'Then all three in the back shape.'],
        rule: 'The ♭5 always moves on.', got: 'You can play each one from the root either way.',
      };
  }
  return null;
}
