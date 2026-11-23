// Fretboard diagrams drawn as SVG. The neck is flat: E string at the bottom.
import { STRINGS } from './theory.js';

const FS = 46;      // fret width
const SS = 30;      // string spacing
const R = 12.6;     // dot radius
const LEFT = 26;
const TOP = 18;
const GAUGE = [3.4, 2.7, 2.1, 1.6];
const ORDER = { faint: 0, out: 1, sel: 2, lit: 3, colour: 4, root: 5 };

function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// spec: {start, n, strings, root, shade:[[s,f]], win:[[lo,hi]], notes:[[s,f,label,style,tag]],
//        boxes:[{lo,hi,s0,s1,style}], cap, figcap}
export function diagramSVG(spec, opts = {}) {
  const start = spec.start;
  const n = spec.n;
  const end = start + n - 1;
  const rows = spec.strings || [0, 1, 2, 3];
  const nrows = rows.length;
  const W = LEFT + n * FS + 10;
  const H = TOP + (nrows - 1) * SS + 34;
  const y = {};
  rows.forEach((s, k) => { y[s] = TOP + (nrows - 1 - k) * SS; });
  const xc = f => LEFT + (f - start) * FS + FS / 2;
  const ytop = TOP - SS / 2 + 2;
  const ybot = TOP + (nrows - 1) * SS + SS / 2 - 2;
  const out = [];
  const label = esc(spec.cap || spec.figcap || 'Bass fretboard diagram');
  out.push(`<svg class="neck" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg" style="--w:${W}">`);

  // the board: open-string column (fret 0) sits outside the wood
  out.push(`<rect class="wood" x="${LEFT}" y="${ytop}" width="${n * FS}" height="${ybot - ytop}" rx="5"/>`);
  if (start === 0) out.push(`<rect class="headstock" x="${LEFT}" y="${ytop}" width="${FS}" height="${ybot - ytop}" rx="5"/>`);
  for (const [a, b] of spec.win || []) {
    const a2 = Math.max(a, start), b2 = Math.min(b, end);
    if (a2 <= b2) out.push(`<rect class="win" x="${LEFT + (a2 - start) * FS}" y="${ytop}" width="${(b2 - a2 + 1) * FS}" height="${ybot - ytop}"/>`);
  }
  for (const [s, f] of spec.shade || []) {
    if (y[s] !== undefined && f >= start && f <= end) {
      out.push(`<rect class="stretch" x="${LEFT + (f - start) * FS + 2}" y="${y[s] - SS / 2 + 2}" width="${FS - 4}" height="${SS - 4}" rx="3"/>`);
    }
  }
  // frets
  for (let k = 0; k <= n; k++) {
    const wire = start + k - 1; // the wire at the left edge of column k belongs to fret `wire`
    if (wire < 0) continue;
    const x = LEFT + k * FS;
    out.push(`<line class="${wire === 0 ? 'nut' : 'fret'}" x1="${x}" y1="${ytop}" x2="${x}" y2="${ybot}"/>`);
  }
  // strings
  for (const s of rows) {
    out.push(`<line class="string" x1="${LEFT + (start === 0 ? FS * 0.2 : 0)}" y1="${y[s]}" x2="${LEFT + n * FS}" y2="${y[s]}" stroke-width="${GAUGE[s]}"/>`);
    out.push(`<text class="sname" x="${LEFT - 13}" y="${y[s] + 4.5}">${STRINGS[s]}</text>`);
  }
  // fret numbers
  for (let f = start; f <= end; f++) {
    const bold = f === spec.root;
    const marker = [3, 5, 7, 9, 12, 15, 17, 19].includes(f);
    out.push(`<text class="fnum${bold ? ' fnum-root' : ''}${marker ? ' fnum-mark' : ''}" x="${xc(f)}" y="${ybot + 19}">${f === 0 ? 'open' : f}</text>`);
  }
  // outlines
  for (const b of spec.boxes || []) {
    const ys = [y[b.s0], y[b.s1]].filter(v => v !== undefined);
    if (!ys.length) continue;
    const top = Math.min(...ys) - SS / 2 + 3, bot = Math.max(...ys) + SS / 2 - 3;
    const lo = Math.max(b.lo, start), hi = Math.min(b.hi, end);
    out.push(`<rect class="box box-${b.style || 'solid'}" x="${LEFT + (lo - start) * FS + 2}" y="${top}" width="${(hi - lo + 1) * FS - 4}" height="${bot - top}" rx="9"/>`);
    if (b.label) out.push(`<text class="boxlabel" x="${LEFT + (lo - start) * FS + 6}" y="${top - 4}">${esc(b.label)}</text>`);
  }
  // notes
  const notes = [...(spec.notes || [])].sort((a, b) => (ORDER[a[3]] || 0) - (ORDER[b[3]] || 0));
  for (const nt of notes) {
    const [s, f, lab, st, tag] = nt;
    if (y[s] === undefined || f < start || f > end) continue;
    const x = xc(f), yy = y[s];
    const small = String(lab).length > 2;
    out.push(`<g class="dot d-${st}">`);
    if (st === 'colour') out.push(`<circle class="ring" cx="${x}" cy="${yy}" r="${R + 3.6}"/>`);
    out.push(`<circle class="c" cx="${x}" cy="${yy}" r="${R}"/>`);
    out.push(`<text class="lab${small ? ' lab-s' : ''}" x="${x}" y="${yy + (small ? 4 : 4.8)}">${esc(lab)}</text>`);
    out.push('</g>');
    if (tag) out.push(`<text class="beat" x="${x + R + 1}" y="${yy - R + 2}">${esc(tag)}</text>`);
  }
  out.push('</svg>');
  return out.join('');
}

// A figure: the diagram plus its caption.
export function figureHTML(spec, opts = {}) {
  const cap = [spec.cap, spec.figcap].filter(Boolean).join(' / ');
  return `<figure class="fig${opts.wide ? ' fig-wide' : ''}">
    <div class="neckwrap">${diagramSVG(spec, opts)}</div>
    <figcaption>${esc(cap)}</figcaption>
  </figure>`;
}
