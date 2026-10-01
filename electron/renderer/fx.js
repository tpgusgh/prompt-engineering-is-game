// Battle effects: floating damage numbers, sparkle bursts, hit rings and a
// crit flash. All DOM + CSS animations (style.css "fx-"), removed when done;
// prefers-reduced-motion keeps only the numbers.
const reduced = () => document.body.classList.contains('a11y-calm') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const layer = () => {
  let el = document.getElementById('fx-layer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fx-layer';
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
  }
  return el;
};

const center = (target) => {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  const r = el?.getBoundingClientRect();
  return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null;
};

function spawn(className, x, y, life, style = {}) {
  const el = document.createElement('div');
  el.className = className;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  for (const [k, v] of Object.entries(style)) el.style.setProperty(k, v);
  layer().append(el);
  setTimeout(() => el.remove(), life);
  return el;
}

const PALETTE = {
  hit: ['#eceff4', '#d8dee9'],
  crit: ['#ebcb8b', '#ffd36b', '#fff6c8'],
  chest: ['#ebcb8b', '#a3be8c', '#88c0d0', '#fff6c8'],
  levelup: ['#a3be8c', '#ebcb8b', '#88c0d0'],
  awaken: ['#bf616a', '#ff6b6b', '#d08770'],
  heal: ['#a3be8c', '#c8f0a8'],
  fire: ['#d08770', '#ebcb8b', '#bf616a'],
  clear: ['#ebcb8b', '#b48ead', '#88c0d0', '#a3be8c'],
};

export const fx = {
  // A number that pops up and floats away: kind 'hit' | 'crit' | 'small' | 'hurt' | 'heal'.
  number(target, value, kind = 'hit') {
    const c = center(target);
    if (!c) return;
    const jitter = (Math.random() - 0.5) * c.w * 0.4;
    const el = spawn(`fx-number fx-${kind}`, c.x + jitter, c.y - c.h * 0.15, 1100);
    el.textContent = kind === 'heal' ? `+${value}` : kind === 'hurt' ? `-${value}` : String(value);
  },
  // Sparkles flying out of a point.
  burst(kind = 'hit', target = 'monster-art', count) {
    if (reduced()) return;
    const c = center(target);
    if (!c) return;
    const colors = PALETTE[kind] ?? PALETTE.hit;
    const n = count ?? (kind === 'crit' || kind === 'chest' || kind === 'clear' || kind === 'awaken' ? 26 : 10);
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const dist = 50 + Math.random() * (kind === 'hit' ? 40 : 110);
      spawn('fx-spark', c.x, c.y, 900, {
        '--dx': `${Math.cos(angle) * dist}px`,
        '--dy': `${Math.sin(angle) * dist}px`,
        '--c': colors[i % colors.length],
        '--s': `${4 + Math.random() * 6}px`,
      });
    }
    if (kind !== 'heal') spawn(`fx-ring fx-ring-${kind}`, c.x, c.y, 600);
  },
  // A quick full-screen flash (crits, awakenings).
  flash(color = 'rgba(255, 236, 170, 0.35)') {
    if (reduced()) return;
    spawn('fx-flash', 0, 0, 350, { '--c': color });
  },
};
