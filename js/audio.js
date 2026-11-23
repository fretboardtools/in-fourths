// Sound: a plucked bass tone (Karplus-Strong) and a sustained drone.

let ctx = null;
let master = null;
const cache = new Map();
let drone = null;
let droneVol = 0.5;
const listeners = new Set();

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function hz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function pluckBuffer(midi) {
  if (cache.has(midi)) return cache.get(midi);
  const c = ac();
  const sr = c.sampleRate;
  const f = hz(midi);
  const N = Math.max(2, Math.round(sr / f));
  const len = Math.floor(sr * 2.2);
  const buf = c.createBuffer(1, len, sr);
  const y = buf.getChannelData(0);
  // a soft, thumb-like excitation: smoothed noise
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const n = Math.random() * 2 - 1;
    prev = prev * 0.55 + n * 0.45;
    y[i] = prev;
  }
  const decay = midi < 40 ? 0.9975 : 0.9965;
  for (let i = N; i < len; i++) {
    y[i] = decay * 0.5 * (y[i - N] + y[i - N - 1 >= 0 ? i - N - 1 : i - N]);
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(y[i]));
  if (peak > 0) for (let i = 0; i < len; i++) y[i] /= peak;
  cache.set(midi, buf);
  return buf;
}

export function pluck(midi, when = 0, dur = 1.6, gain = 0.85) {
  const c = ac();
  const t = when || c.currentTime;
  const src = c.createBufferSource();
  src.buffer = pluckBuffer(midi);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  // a little body so low notes still read on small speakers
  const body = c.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 220;
  body.gain.value = 5;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.setTargetAtTime(0, t + dur * 0.8, 0.08);
  src.connect(lp).connect(body).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.5);
  return t;
}

export function now() {
  return ac().currentTime;
}

// ---------------------------------------------------------------- drone

export function droneMidi(pc) {
  return 28 + ((pc - 4 + 12) % 12); // E1..D#2: the low register of a bass
}

export function startDrone(pc) {
  const c = ac();
  stopDrone(true);
  const f = hz(droneMidi(pc));
  const out = c.createGain();
  out.gain.value = 0;
  out.gain.setTargetAtTime(droneVol * 0.32, c.currentTime, 0.25);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 520;
  lp.Q.value = 0.7;
  const oscs = [];
  const mk = (type, freq, level, detune = 0) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = c.createGain();
    g.gain.value = level;
    o.connect(g).connect(lp);
    o.start();
    oscs.push(o);
  };
  mk('sawtooth', f, 0.35, -4);
  mk('sawtooth', f, 0.35, 4);
  mk('sine', f * 2, 0.5);
  mk('triangle', f * 3, 0.12);
  // slow movement in the filter so it breathes
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.12;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 120;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start();
  oscs.push(lfo);
  lp.connect(out).connect(master);
  drone = { pc, out, oscs };
  emit();
}

export function stopDrone(quick = false) {
  if (!drone) return;
  const c = ac();
  const d = drone;
  drone = null;
  d.out.gain.setTargetAtTime(0, c.currentTime, quick ? 0.03 : 0.2);
  setTimeout(() => d.oscs.forEach(o => { try { o.stop(); } catch (e) { /* already stopped */ } }), quick ? 200 : 1200);
  emit();
}

export function setDroneVolume(v) {
  droneVol = v;
  if (drone) drone.out.gain.setTargetAtTime(v * 0.32, ac().currentTime, 0.1);
}

export function droneState() {
  return drone ? { on: true, pc: drone.pc } : { on: false, pc: null };
}

export function onDroneChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  const s = droneState();
  listeners.forEach(fn => fn(s));
}
