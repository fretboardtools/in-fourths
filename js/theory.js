// Music theory for a 4-string bass in standard tuning (E A D G).
// Placement follows the 2 Position System: Position 1 runs forward from the root
// (root fret to root + 4), Position 2 runs back (root - 4 to root fret).

export const LETTERS = 'CDEFGAB';
export const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const MAJ = [0, 2, 4, 5, 7, 9, 11];
export const STRINGS = ['E', 'A', 'D', 'G'];
export const OPEN = [4, 9, 2, 7];
export const OPEN_MIDI = [28, 33, 38, 43];

export const ROOT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const CIRCLE = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];

const ACC = { '♭♭': -2, '♭': -1, '': 0, '♯': 1, '♯♯': 2 };
const ACC_SYM = { '-2': '♭♭', '-1': '♭', '0': '', '1': '♯', '2': '♯♯' };

export function notePc(name) {
  const letter = name[0];
  let pc = LETTER_PC[letter];
  for (const ch of name.slice(1)) {
    if (ch === '♭' || ch === 'b') pc -= 1;
    if (ch === '♯' || ch === '#') pc += 1;
  }
  return ((pc % 12) + 12) % 12;
}

// '♭3' -> {acc:-1, deg:3}
export function parseTok(tok) {
  const m = /^([♭♯]*)(\d+)$/.exec(tok);
  if (!m) throw new Error('bad token ' + tok);
  return { acc: ACC[m[1]] ?? 0, deg: parseInt(m[2], 10) };
}

export function tokSemis(tok) {
  const { acc, deg } = parseTok(tok);
  const oct = Math.floor((deg - 1) / 7);
  const d = (deg - 1) % 7;
  return MAJ[d] + 12 * oct + acc;
}

export function spell(root, tok) {
  const { deg } = parseTok(tok);
  const li = (LETTERS.indexOf(root[0]) + deg - 1) % 7;
  const letter = LETTERS[li];
  const pc = (notePc(root) + tokSemis(tok)) % 12;
  let diff = ((pc - LETTER_PC[letter]) % 12 + 12) % 12;
  if (diff > 6) diff -= 12;
  return letter + ACC_SYM[diff];
}

// Major-key spelling: the seven note names of the major scale on `key`.
export function majorScale(key) {
  return ['1', '2', '3', '4', '5', '6', '7'].map(t => spell(key, t));
}

export const DEFAULT_LABEL = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];

// ---------------------------------------------------------------- modes of the major scale

export const MODE_NAMES = ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'];
export const BRIGHT = ['Lydian', 'Ionian', 'Mixolydian', 'Dorian', 'Aeolian', 'Phrygian', 'Locrian'];
export const COLOUR = { Ionian: '7', Dorian: '6', Phrygian: '♭2', Lydian: '♯4', Mixolydian: '♭7', Aeolian: '♭6', Locrian: '♭5' };

export function modeTokens(k) {
  const s = MAJ.map((_, i) => (MAJ[(k + i) % 7] - MAJ[k] + 12) % 12);
  return s.map((v, i) => {
    const d = v - MAJ[i];
    return ({ '-2': '♭♭', '-1': '♭', '0': '', '1': '♯' })[d] + (i + 1);
  });
}

export function modeInfo(k) {
  const toks = modeTokens(k);
  const semis = toks.map(tokSemis);
  const name = MODE_NAMES[k];
  const third = semis[2] === 4 ? '' : 'm';
  const fifth = semis[4];
  const sev = semis[6];
  const ninth = semis[1] === 2 ? 14 : 13;
  let q3 = third; if (fifth === 6) q3 = 'dim';
  let q7 = third === '' ? (sev === 11 ? 'maj7' : '7') : (fifth === 6 ? 'm7♭5' : 'm7');
  let q9;
  if (q7 === 'maj7') q9 = 'maj9';
  else if (q7 === '7') q9 = '9';
  else if (q7 === 'm7') q9 = ninth === 14 ? 'm9' : 'm7♭9';
  else q9 = 'm7♭5♭9';
  return { k, name, toks, semis, colour: COLOUR[name], q3, q7, q9, ninthTok: ninth === 14 ? '9' : '♭9' };
}

export function labelFor(toks, s) {
  const semis = toks.map(tokSemis);
  const r = ((s % 12) + 12) % 12;
  const i = semis.indexOf(r);
  if (s === 12) return '8';
  const base = i >= 0 ? toks[i] : DEFAULT_LABEL[r];
  if (s > 12) {
    const comp = { '2': '9', '♭2': '♭9', '♯2': '♯9', '4': '11', '♯4': '♯11', '6': '13', '♭6': '♭13' };
    return comp[base] || base;
  }
  return base;
}

// ---------------------------------------------------------------- placement

export function windowOf(r, pos) {
  return pos === 1 ? [r, r + 4] : [r - 4, r];
}

export function place(rs, r, pos, s) {
  const [lo, hi] = windowOf(r, pos);
  for (let i = 0; i < 4; i++) {
    const f = r + s - 5 * (i - rs);
    if (f >= lo && f <= hi) return [i, f];
  }
  return null;
}

export function efret(pc, pos) {
  const f = ((pc - 4) % 12 + 12) % 12;
  if (pos === 1) return f >= 1 ? f : 12;
  return f >= 5 ? f : f + 12;
}

export function pcAt(string, fret) {
  return (OPEN[string] + fret) % 12;
}

export function midiAt(string, fret) {
  return OPEN_MIDI[string] + fret;
}

export function ordinal(n) {
  const s = n % 100;
  if (s >= 11 && s <= 13) return n + 'th';
  return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
}

// Parse the first note name at the start of a string ("G♭ Lydian" -> "G♭").
export function leadingNote(str) {
  const m = /^([A-G][♭♯]?)(\s|$|m|7|maj)/.exec(str || '');
  return m ? m[1] : null;
}
