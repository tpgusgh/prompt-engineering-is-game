// electron/renderer/reply-format.js
// Color the important parts of a reply: success / failure / warning words and
// file paths in prose, and a light syntax highlight inside code blocks.
const HIGHLIGHTS = [
  { cls: 'hl-bad', re: /(실패|오류|에러|버그|깨짐|\berror\b|\bfail(?:ed|ure|s)?\b|\bexception\b|❌|✗)/gi },
  { cls: 'hl-ok', re: /(성공|통과|완료|해결|수정됨|고쳤|\bpass(?:ed|es)?\b|\bsuccess\b|✅|✓)/gi },
  { cls: 'hl-warn', re: /(주의|경고|위험|\bwarning\b|\bTODO\b|⚠️?)/gi },
  { cls: 'hl-path', re: /(?:[\w.-]+\/)*[\w.-]+\.(?:tsx?|jsx?|mjs|cjs|py|json|md|css|html|go|rs|java|kt|swift|c|cpp|h|sh|ya?ml|toml|sql|txt)\b/g },
];

function highlightText(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest('pre, code, a, .hl') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue;
    const marks = [];
    for (const { cls, re } of HIGHLIGHTS) {
      re.lastIndex = 0;
      for (let m; (m = re.exec(text)); ) marks.push({ start: m.index, end: m.index + m[0].length, cls });
    }
    if (marks.length === 0) continue;
    marks.sort((a, b) => a.start - b.start || b.end - a.end);
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const mk of marks) {
      if (mk.start < pos) continue; // overlapping: first one wins
      frag.append(text.slice(pos, mk.start));
      const span = document.createElement('span');
      span.className = `hl ${mk.cls}`;
      span.textContent = text.slice(mk.start, mk.end);
      frag.append(span);
      pos = mk.end;
    }
    frag.append(text.slice(pos));
    node.replaceWith(frag);
  }
}

const KEYWORDS = new Set(('const let var function return if else for while do switch case break continue new class extends import export from default async await try catch finally throw typeof instanceof in of yield ' +
  'def lambda pass with as elif not and or is None True False self print ' +
  'func go defer chan struct interface type package map range fn let mut impl pub use match enum trait ' +
  'public private protected static void int string bool float double long char null true false this super ' +
  'SELECT FROM WHERE JOIN ON GROUP BY ORDER INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE INDEX AND OR NOT LIMIT HAVING AS').split(/\s+/));

function highlightCode(codeEl) {
  const lang = (codeEl.className.match(/language-(\w+)/) || [])[1] || '';
  const hashComments = /^(py|python|bash|sh|shell|zsh|yaml|yml|toml|ruby|rb|r|dockerfile|make)$/i.test(lang);
  const src = codeEl.textContent;
  const token = new RegExp(
    [
      hashComments ? '(#.*)' : '(\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\/)',
      '("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`)',
      '(\\b\\d+(?:\\.\\d+)?\\b)',
      '([A-Za-z_][\\w]*)',
    ].join('|'),
    'g',
  );
  const frag = document.createDocumentFragment();
  let pos = 0;
  for (let m; (m = token.exec(src)); ) {
    const [whole, comment, str, num, word] = m;
    const cls = comment ? 'tok-com' : str ? 'tok-str' : num ? 'tok-num' : word && KEYWORDS.has(word) ? 'tok-kw' : null;
    if (!cls) continue;
    frag.append(src.slice(pos, m.index));
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = whole;
    frag.append(span);
    pos = m.index + whole.length;
  }
  frag.append(src.slice(pos));
  codeEl.textContent = '';
  codeEl.append(frag);
}

export function decorateReply(el) {
  highlightText(el);
  for (const code of el.querySelectorAll('pre code')) highlightCode(code);
}
