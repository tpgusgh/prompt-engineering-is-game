// BGM and sound effects. Music: the recorded tracks in ./music (looped,
// crossfaded), falling back to a synthesized chiptune sequencer for any
// track without a file or whose file fails to load. SFX: short synthesized
// one-shots (Web Audio).

const STORE_KEY = 'pb-audio';
let settings = { volume: 0.6, muted: false };
try {
  settings = { ...settings, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
} catch {}

let ctx = null;
let master, musicGain, sfxGain, noiseBuffer;

function ensure() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.55;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.connect(master);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    applyVolume();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function applyVolume() {
  if (master) master.gain.value = settings.muted ? 0 : settings.volume;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  } catch {}
}

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

function tone(midi, start, dur, { type = 'square', gain = 0.15, dest = sfxGain, slideTo, attack = 0.005, release = 0.06 } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(hz(midi), start);
  if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(hz(slideTo), start + dur);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur + release);
  o.connect(g).connect(dest);
  o.start(start);
  o.stop(start + dur + release + 0.02);
}

function noise(start, dur, { gain = 0.15, dest = sfxGain, freq = 3000, type = 'lowpass' } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(start);
  src.stop(start + dur + 0.02);
}

// ---------------------------------------------------------------------------
// Tracks: lead/bass are semitone offsets from root per 16th step (null = rest),
// drums: k = kick, s = snare, h = hat, . = rest.
const _ = null;
const TRACKS = {
  title: {
    bpm: 84, root: 64, leadType: 'triangle', bassType: 'sine',
    lead: [0, _, 7, _, 12, _, 11, _, 7, _, 4, _, 5, _, _, _, 0, _, 7, _, 12, _, 14, _, 12, _, 7, _, 9, _, _, _],
    bass: [-24, _, _, _, _, _, _, _, -19, _, _, _, _, _, _, _, -20, _, _, _, _, _, _, _, -17, _, _, _, _, _, _, _],
    drums: 'k.......h.......k.......h.......',
  },
  adventure: {
    bpm: 128, root: 67, leadType: 'square', bassType: 'triangle',
    lead: [0, _, 4, 7, 9, _, 7, 4, 5, _, 4, 2, 0, _, _, _, 0, _, 4, 7, 12, _, 11, 9, 7, _, 5, 4, 2, _, _, _],
    bass: [-24, _, -12, _, -24, _, -12, _, -19, _, -7, _, -19, _, -7, _, -20, _, -8, _, -20, _, -8, _, -17, _, -5, _, -17, _, -5, _],
    drums: 'k.h.s.h.k.h.s.h.k.h.s.h.k.hks.hh',
  },
  'demon-king': {
    bpm: 136, root: 62, leadType: 'sawtooth', bassType: 'square',
    lead: [0, _, 3, _, 7, _, 6, _, 3, _, 0, _, -2, _, 0, _, 0, _, 3, _, 8, _, 7, _, 3, _, 2, _, 0, _, _, _],
    bass: [-24, -24, _, -24, -24, _, -24, _, -21, -21, _, -21, -21, _, -22, _, -20, -20, _, -20, -20, _, -20, _, -17, -17, _, -17, -19, _, -19, _],
    drums: 'k.hkskh.k.hksk.hk.hkskh.k.hkskss',
  },
  'debug-quest': {
    bpm: 132, root: 60, leadType: 'square', bassType: 'sawtooth',
    lead: [12, _, 12, 15, _, 12, 10, _, 7, _, 10, _, 12, _, _, _, 12, _, 12, 15, _, 17, 15, _, 12, _, 10, _, 7, _, _, _],
    bass: [-24, _, -12, -24, _, -12, -24, _, -24, _, -12, -24, _, -12, -22, _, -20, _, -8, -20, _, -8, -20, _, -19, _, -7, -19, _, -7, -17, _],
    drums: 'k.h.shh.k.h.shh.k.h.shh.kkh.shss',
  },
  boss: {
    bpm: 150, root: 57, leadType: 'sawtooth', bassType: 'square',
    lead: [0, 0, 3, 0, 6, _, 5, _, 3, 3, 1, 0, -1, _, 0, _, 0, 0, 3, 0, 7, _, 6, _, 8, 7, 6, 3, 1, _, 0, _],
    bass: [-24, -24, -24, -24, -18, -18, -19, -19, -21, -21, -21, -21, -25, -25, -24, -24, -24, -24, -24, -24, -17, -17, -18, -18, -16, -16, -17, -17, -23, -23, -24, -24],
    drums: 'kkskkhskkkskkhsskkskkhskkkskskss',
  },
  shop: {
    bpm: 100, root: 72, leadType: 'triangle', bassType: 'triangle',
    lead: [0, _, 4, _, 7, 4, _, 2, 0, _, _, _, 9, _, 7, _, 5, _, 9, _, 7, 5, _, 4, 2, _, 4, _, 0, _, _, _],
    bass: [-24, _, _, -17, _, _, -12, _, -19, _, _, -12, _, _, -14, _, -20, _, _, -13, _, _, -8, _, -17, _, _, -10, _, _, -12, _],
    drums: 'k...h.h.k...h.h.k...h.h.k...h.hh',
  },
  forge: {
    bpm: 112, root: 55, leadType: 'square', bassType: 'triangle',
    lead: [0, _, _, 3, _, _, 5, _, 7, _, 5, _, 3, _, _, _, 0, _, _, 3, _, _, 7, _, 10, _, 8, _, 7, _, _, _],
    bass: [-24, _, _, _, -24, _, _, _, -19, _, _, _, -19, _, _, _, -21, _, _, _, -21, _, _, _, -17, _, _, _, -19, _, _, _],
    drums: 's...s...s...s.s.s...s...s...sss.',
  },
};

// Per-chapter variation: shift key and tempo so later chapters feel new.
const CHAPTER_SHIFT = [0, 2, -3, 5, -2, 3];

let music = null; // { id, track, step, nextTime, timer, transpose, bpm }

// Recorded tracks (Suno), keyed like TRACKS; a missing/broken one falls back.
const FILE_TRACKS = new Set(['title', 'adventure', 'demon-king', 'debug-quest', 'boss', 'shop', 'forge', 'quest']);
const brokenFiles = new Set();
const FILE_GAIN = 0.9;
const FADE = 0.7;
let fileMusic = null; // { key, el, gain }
let current = null; // last playMusic request, for push/pop
const stack = [];

function fadeOutFile() {
  if (!fileMusic) return;
  const { el, gain } = fileMusic;
  fileMusic = null;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0, t + FADE);
  setTimeout(() => {
    el.pause();
    el.removeAttribute('src');
    el.load();
  }, FADE * 1000 + 50);
}

function playFile(key, opts) {
  const el = new Audio(`music/${key}.m4a`);
  el.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  ctx.createMediaElementSource(el).connect(gain).connect(musicGain);
  const t = ctx.currentTime;
  gain.gain.linearRampToValueAtTime(FILE_GAIN, t + FADE);
  const fallback = () => {
    if (brokenFiles.has(key)) return;
    brokenFiles.add(key);
    if (fileMusic?.el === el) {
      fileMusic = null;
      playMusic(key, opts);
    }
  };
  el.addEventListener('error', fallback);
  el.play().catch(fallback);
  fileMusic = { key, el, gain };
}

export function playMusic(key, opts = {}) {
  current = { key, opts };
  const useFile = FILE_TRACKS.has(key) && !brokenFiles.has(key);
  if (useFile) {
    if (fileMusic?.key === key) return;
    ensure();
    stopSynth();
    fadeOutFile();
    playFile(key, opts);
    return;
  }
  playSynth(key, opts);
}

// Temporarily switch (e.g. the quest window), then go back.
export function pushMusic(key) {
  if (current) stack.push(current);
  playMusic(key);
}
export function popMusic() {
  const prev = stack.pop();
  if (prev) playMusic(prev.key, prev.opts);
}

function playSynth(key, { chapter = 1 } = {}) {
  const track = TRACKS[key] ?? TRACKS.adventure;
  const transpose = CHAPTER_SHIFT[(chapter - 1) % CHAPTER_SHIFT.length];
  const bpm = Math.min(track.bpm + (chapter - 1) * 4, track.bpm + 24);
  const id = `${key}:${transpose}:${bpm}`;
  if (music && music.id === id) return;
  stopSynth();
  ensure();
  fadeOutFile();
  music = { id, track, step: 0, nextTime: ctx.currentTime + 0.08, transpose, bpm };
  music.timer = setInterval(scheduleMusic, 25);
}

function stopSynth() {
  if (!music) return;
  clearInterval(music.timer);
  music = null;
}

export function stopMusic() {
  stopSynth();
  if (ctx) fadeOutFile();
  current = null;
  stack.length = 0;
}

function scheduleMusic() {
  if (!music) return;
  const { track, transpose } = music;
  const stepDur = 60 / music.bpm / 4;
  while (music.nextTime < ctx.currentTime + 0.12) {
    const i = music.step % 32;
    const t = music.nextTime;
    const lead = track.lead[i];
    const bass = track.bass[i];
    if (lead !== null && lead !== undefined) tone(track.root + lead + transpose, t, stepDur * 1.6, { type: track.leadType, gain: 0.07, dest: musicGain });
    if (bass !== null && bass !== undefined) tone(track.root + bass + transpose, t, stepDur * 1.8, { type: track.bassType, gain: 0.11, dest: musicGain });
    const d = track.drums[i];
    if (d === 'k') tone(45, t, 0.08, { type: 'sine', gain: 0.35, dest: musicGain, slideTo: 30 });
    else if (d === 's') noise(t, 0.12, { gain: 0.1, dest: musicGain, freq: 1800, type: 'bandpass' });
    else if (d === 'h') noise(t, 0.03, { gain: 0.04, dest: musicGain, freq: 7000, type: 'highpass' });
    music.step += 1;
    music.nextTime += stepDur;
  }
}

// ---------------------------------------------------------------------------
// Sound effects.
const arp = (notes, step, opts) => {
  const t = ctx.currentTime;
  notes.forEach((n, i) => tone(n, t + i * step, step * 1.2, opts));
};

const SFX = {
  hit: () => { const t = ctx.currentTime; noise(t, 0.08, { gain: 0.18, freq: 2500 }); tone(64, t, 0.08, { gain: 0.12, slideTo: 40 }); },
  partial: () => { const t = ctx.currentTime; noise(t, 0.05, { gain: 0.1, freq: 3500 }); tone(76, t, 0.04, { gain: 0.06, slideTo: 60 }); },
  crit: () => { const t = ctx.currentTime; noise(t, 0.2, { gain: 0.28, freq: 1800 }); tone(72, t, 0.18, { type: 'sawtooth', gain: 0.16, slideTo: 36 }); tone(84, t + 0.05, 0.12, { gain: 0.1 }); },
  hurt: () => { const t = ctx.currentTime; tone(52, t, 0.18, { type: 'sawtooth', gain: 0.18, slideTo: 35 }); noise(t, 0.12, { gain: 0.12, freq: 900 }); },
  dodge: () => noise(ctx.currentTime, 0.18, { gain: 0.1, freq: 5000, type: 'highpass' }),
  block: () => arp([79, 91], 0.05, { type: 'triangle', gain: 0.12 }),
  coin: () => arp([83, 88], 0.07, { type: 'square', gain: 0.1 }),
  buy: () => arp([76, 81, 88], 0.06, { type: 'square', gain: 0.1 }),
  levelUp: () => arp([72, 76, 79, 84], 0.07, { type: 'square', gain: 0.1 }),
  win: () => arp([72, 76, 79, 84, 79, 84], 0.09, { type: 'square', gain: 0.12 }),
  fanfare: () => arp([67, 67, 67, 72, 76, 74, 76, 79, 84], 0.11, { type: 'square', gain: 0.13 }),
  defeat: () => arp([67, 63, 60, 55, 48], 0.22, { type: 'triangle', gain: 0.16 }),
  enhanceOk: () => { const t = ctx.currentTime; for (let i = 0; i < 3; i++) noise(t + i * 0.12, 0.05, { gain: 0.15, freq: 4000, type: 'bandpass' }); setTimeout(() => arp([72, 79, 84, 91], 0.07, { type: 'square', gain: 0.11 }), 380); },
  enhanceFail: () => { const t = ctx.currentTime; for (let i = 0; i < 3; i++) noise(t + i * 0.12, 0.05, { gain: 0.15, freq: 4000, type: 'bandpass' }); setTimeout(() => arp([64, 60], 0.15, { type: 'triangle', gain: 0.12 }), 380); },
  shatter: () => { const t = ctx.currentTime; noise(t, 0.6, { gain: 0.3, freq: 6000, type: 'highpass' }); tone(60, t, 0.5, { type: 'sawtooth', gain: 0.15, slideTo: 30 }); },
  monster: () => tone(48, ctx.currentTime, 0.25, { type: 'sawtooth', gain: 0.12, slideTo: 55 }),
  boss: () => { const t = ctx.currentTime; tone(36, t, 0.8, { type: 'sawtooth', gain: 0.2, slideTo: 31 }); noise(t, 0.8, { gain: 0.1, freq: 400 }); },
  flee: () => arp([79, 74, 69, 64], 0.05, { type: 'triangle', gain: 0.1 }),
  key: () => tone(90 + Math.floor(Math.random() * 4), ctx.currentTime, 0.015, { type: 'square', gain: 0.025, release: 0.01 }),
  typo: () => tone(40, ctx.currentTime, 0.05, { type: 'square', gain: 0.05 }),
  typed: () => arp([84, 88, 91], 0.05, { type: 'triangle', gain: 0.1 }),
  party: () => arp([67, 74, 79], 0.06, { type: 'triangle', gain: 0.08 }),
};

export function sfx(name) {
  if (settings.muted || !SFX[name]) return;
  ensure();
  SFX[name]();
}

export function getAudioSettings() {
  return { ...settings };
}

export function setVolume(volume) {
  settings.volume = Math.max(0, Math.min(1, volume));
  if (settings.volume > 0) settings.muted = false;
  ensure();
  applyVolume();
}

export function toggleMute() {
  settings.muted = !settings.muted;
  ensure();
  applyVolume();
  return settings.muted;
}
