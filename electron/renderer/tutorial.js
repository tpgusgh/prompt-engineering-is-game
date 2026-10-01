// electron/renderer/tutorial.js
// First-time tour: a spotlight on one part of the screen at a time with a
// short note, 다음 / 건너뛰기. Each tour (start screen, first battle) shows
// once; ⚙️ → 👁 보기 → 튜토리얼 다시 보기 resets them.
const KEY = 'pb-tutorial';
const seen = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
};
const markSeen = (tour) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...seen(), [tour]: true }));
  } catch {}
};
export const resetTutorial = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {}
};

export const TOURS = {
  setup: [
    ['#pick-folder-btn', '먼저 AI가 일할 프로젝트 폴더를 고른다. AI는 이 폴더 안의 코드를 읽고 고친다.'],
    ['#theme-options', '이야기 테마. 테마마다 나오는 몬스터와 규칙이 다르다.'],
    ['#class-options', '직업을 고르면 무기 이름과 스킬이 바뀐다.'],
    ['#weapon-options', '무기 = Claude 모델. 셀수록 세게 때리지만 사용량(토큰 ●)을 더 쓴다.'],
    ['#hero-skill-options', '스킬 = Claude가 얼마나 깊게 생각할지(effort). 전투 중에도 바꿀 수 있다.'],
    ['#start-btn', '준비됐으면 던전 입장! 매일 바뀌는 오늘의 도전도 아래에 있다.'],
  ],
  battle: [
    ['#prompt-input', '여기에 AI에게 시킬 일을 쓰면 그게 공격이다. 구체적이고 키워드가 많을수록 세다.'],
    ['#monster-panel', 'AI가 명령을 실행하고 파일을 고칠 때마다 몬스터가 맞는다. 턴이 끝나면 마무리 일격!'],
    ['#bag', '가방 아이템은 턴을 쓰지 않고 바로 쓴다 (숫자 키 1~9).'],
    ['#stat-panel', '몬스터를 쓰러뜨리면 능력치 포인트. 공격력·방어력·체력 중 하나를 올리자.'],
    ['#attach-btn', '📎 파일 첨부, 📜 스킬북. 단축키는 ? 키로 볼 수 있다.'],
  ],
};

let active = null;
export function startTour(tour, { force = false } = {}) {
  if (active || (!force && seen()[tour])) return;
  const steps = TOURS[tour].filter(([sel]) => {
    const el = document.querySelector(sel);
    return el && el.offsetParent;
  });
  if (!steps.length) return;
  const veil = document.createElement('div');
  veil.className = 'tour-veil';
  const ring = document.createElement('div');
  ring.className = 'tour-ring';
  const tip = document.createElement('div');
  tip.className = 'tour-tip';
  tip.setAttribute('role', 'dialog');
  const text = document.createElement('p');
  const count = document.createElement('small');
  const next = document.createElement('button');
  next.type = 'button';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'tour-skip';
  skip.textContent = '건너뛰기';
  const row = document.createElement('div');
  row.className = 'tour-row';
  row.append(count, skip, next);
  tip.append(text, row);
  document.body.append(veil, ring, tip);
  let i = 0;
  const end = () => {
    veil.remove();
    ring.remove();
    tip.remove();
    window.removeEventListener('resize', place);
    active = null;
    markSeen(tour);
  };
  function place() {
    const el = document.querySelector(steps[i][0]);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    const pad = 6;
    Object.assign(ring.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const below = r.bottom + 12 + 140 < innerHeight;
    tip.style.left = `${Math.min(Math.max(12, r.left), innerWidth - 352)}px`;
    tip.style.top = below ? `${r.bottom + 12}px` : `${Math.max(12, r.top - 12 - tip.offsetHeight)}px`;
  }
  function show() {
    text.textContent = steps[i][1];
    count.textContent = `${i + 1} / ${steps.length}`;
    next.textContent = i === steps.length - 1 ? '시작하기 ▶' : '다음 ▶';
    place();
  }
  next.addEventListener('click', () => (++i < steps.length ? show() : end()));
  skip.addEventListener('click', end);
  veil.addEventListener('click', end);
  window.addEventListener('resize', place);
  active = tour;
  show();
  next.focus();
}
