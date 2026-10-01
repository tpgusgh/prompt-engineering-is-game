// The translator behind i18n.js, pure so it can be tested: a dictionary maps
// Korean UI text (from scripts/i18n-extract.mjs) to a language. Lookup order:
// the exact text; a template ("{0}의 피해!") with its pieces translated too;
// then, for text built from several pieces, every known phrase inside it.
const HANGUL = /[가-힣]/;
const PLACEHOLDER = /\{(\w+)\}/g;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// iconize.js may already have turned emoji into icons (splitting the text),
// so every key is also known without its leading/trailing emoji.
const EDGE_EMOJI = /^(?:[\p{Extended_Pictographic}\u2600-\u27bf\u2b00-\u2bff✕✓✗▾▴▶◀⚀-⚅]\ufe0f?\u200d?)+\s*|\s*(?:[\p{Extended_Pictographic}\u2600-\u27bf✕✓✗▾▴▶◀]\ufe0f?)+$/gu;
const bare = (s) => s.replace(EDGE_EMOJI, '').trim().replace(/^[·│]\s*/, '');

export function makeTranslator(dict) {
  const exact = new Map(Object.entries(dict));
  for (const [ko, out] of [...exact]) {
    const k = bare(ko);
    if (k && k !== ko && HANGUL.test(k) && !exact.has(k)) exact.set(k, bare(out));
  }
  const patterns = [];
  const phrases = [];
  for (const [ko, out] of exact) {
    if (/\{\w+\}/.test(ko)) {
      // Placeholders side by side ({0}{1}) can't be told apart: fill them as
      // one piece, when the translation keeps them side by side too.
      let key = ko, tr = out;
      for (const run of new Set(ko.match(/(?:\{\w+\}){2,}/g) ?? [])) {
        const merged = `{${run.replace(/[{}]/g, '')}}`;
        if (!tr.includes(run)) { key = null; break; }
        key = key.split(run).join(merged);
        tr = tr.split(run).join(merged);
      }
      if (key === null) continue;
      const names = [...key.matchAll(PLACEHOLDER)].map((m) => m[1]);
      // A merged {0}{1} group is greedy: it's usually a whole phrase, the rest are numbers.
      const literals = key.split(/\{\w+\}/).map(escape);
      // A trailing placeholder may be empty (an optional suffix like "{0}" = "").
      const group = (i) => (names[i - 1].length > 1 ? '(.+)' : i === literals.length - 1 && !literals[i] ? '(.*?)' : '(.+?)');
      const source = literals.reduce((acc, lit, i) => acc + (i ? group(i) : '') + lit, '');
      const literal = key.replace(PLACEHOLDER, '');
      // A template that is only placeholders and symbols would match anything.
      if (HANGUL.test(literal)) patterns.push({ re: new RegExp(`^${source}$`, 's'), names, out: tr, weight: literal.length });
    } else if (ko.length >= 2) phrases.push(ko);
  }
  patterns.sort((a, b) => b.weight - a.weight); // the most specific template first
  phrases.sort((a, b) => b.length - a.length); // longest phrase first
  const cache = new Map();

  const fromTemplate = (text) => {
    for (const p of patterns) {
      const m = p.re.exec(text);
      if (!m) continue;
      const values = Object.fromEntries(p.names.map((n, i) => [n, m[i + 1]]));
      return p.out.replace(PLACEHOLDER, (all, n) => (n in values ? (n.length > 1 ? joined(values[n]) : piece(values[n])) : all));
    }
    return null;
  };
  // Text glued from several pieces: swap every known phrase in place.
  const fromPhrases = (text) => {
    let out = text;
    for (const ko of phrases) if (out.includes(ko)) out = out.split(ko).join(exact.get(ko));
    return out === text ? null : out;
  };
  // A line glued from separate texts ("{theme} · {floor}"): each part on its own.
  const SEP = /(\s+[·│]\s+)/;
  // From each part, the shortest run of parts that a key translates fully.
  const fromParts = (text) => {
    if (!SEP.test(text)) return null;
    const bits = text.split(SEP); // text, sep, text, sep, ...
    const out = [];
    for (let i = 0; i < bits.length; i += 2) {
      let taken = -1;
      for (let j = i; j < bits.length && taken < 0; j += 2) {
        if (i === 0 && j === bits.length - 1) break; // the whole line was tried already
        const span = bits.slice(i, j + 1).join('').trim();
        const hit = HANGUL.test(span) ? (exact.get(span) ?? fromTemplate(span)) : span;
        if (hit != null && !HANGUL.test(hit)) {
          out.push(hit);
          taken = j;
        }
      }
      if (taken < 0) {
        out.push(bits[i]);
        taken = i;
      }
      if (taken + 1 < bits.length) out.push(bits[taken + 1]);
      i = taken;
    }
    const joined = out.join('');
    return joined === text ? null : joined;
  };
  // A merged {0}{1} value: two known texts back to back ("버그 고블린" + "의 반격!").
  const joined = (v) => {
    for (let k = 1; k < v.length; k++) {
      const a = v.slice(0, k), b = v.slice(k);
      const ta = HANGUL.test(a) ? exact.get(a.trim()) : a;
      const tb = HANGUL.test(b) ? exact.get(b.trim()) : b;
      if (ta != null && tb != null) return (a.match(/^\s*/)[0]) + ta + (b.match(/^\s*/)[0]) + tb;
    }
    return piece(v);
  };
  const piece = (v) => {
    if (!HANGUL.test(v)) return v;
    const t = v.trim();
    const lead = v.slice(0, v.indexOf(t)), trail = v.slice(v.indexOf(t) + t.length);
    const parts = exact.has(t) ? null : fromParts(t);
    const whole = parts && !HANGUL.test(parts) ? parts : null; // fully translated by parts: best
    return lead + (exact.get(t) ?? whole ?? fromTemplate(t) ?? parts ?? fromPhrases(t) ?? t) + trail;
  };

  return function translate(text) {
    if (!text || !HANGUL.test(text)) return text;
    if (cache.has(text)) return cache.get(text);
    const out = text
      .split('\n')
      .map((line) => piece(line))
      .join('\n');
    if (cache.size > 20000) cache.clear(); // ponytail: crude bound, fine for a game session
    cache.set(text, out);
    return out;
  };
}
