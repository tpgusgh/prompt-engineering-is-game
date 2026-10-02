// What makes a prompt hit hard (src/damage.ts): each criterion met adds
// +50% damage, three or more crit (x1.5). Shared with the page, which lights
// them up under the input as you type.
export const CRITERIA_BONUS = 0.5;
export const CRIT_AT = 3;
// Shorter than this, the criteria count half and can't crit: a bare list of
// keywords isn't a good prompt.
export const FULL_BONUS_AT = 50;

export const PROMPT_CRITERIA = [
  {
    id: 'target', icon: '🎯', label: '대상', hint: '어디를: 파일·함수·`코드`를 짚는다 (src/app.ts, login(), `useState`)',
    test: /`[^`\n]+`|[\w/-]+\.(?:tsx?|jsx?|mjs|cjs|py|go|rs|java|kt|swift|rb|php|cs|c|cc|cpp|h|hpp|css|scss|html|vue|svelte|json|ya?ml|toml|md|sql|sh)\b|\b[A-Za-z_]\w*\(\)/,
  },
  {
    id: 'constraint', icon: '🧱', label: '제약', hint: '하지 말 것·지킬 것 (반드시, ~말고, ~없이, 유지, only, don\'t)',
    test: /반드시|꼭 |하지 ?마|건드리지|말고|없이|유지|바꾸지|그대로 두|\bonly\b|\bmust\b|don'?t|do not|without|\bkeep\b/i,
  },
  {
    id: 'verify', icon: '✅', label: '검증', hint: '끝났는지 확인하는 법 (테스트, 검증, 통과, 확인해, test, verify)',
    test: /테스트|검증|통과|확인해|\btests?\b|verify|\bpass(?:es|ing)?\b/i,
  },
  {
    id: 'steps', icon: '🪜', label: '단계', hint: '순서 (단계별, 차근차근, 순서대로, 먼저 ~ 그다음, 1. 2. 목록, step by step)',
    test: /단계별|차근차근|순서대로|하나씩|먼저.*(?:그다음|그 다음|다음에|그리고 나서)|step by step|\bfirst\b.*\bthen\b|^\s*(?:\d+[.)]|[-*•])\s.*\n\s*(?:\d+[.)]|[-*•])\s/ims,
  },
  {
    id: 'why', icon: '🧐', label: '이유', hint: '왜 필요한지 (왜, 이유, ~때문에, ~하려고, why, because)',
    test: /왜|이유|때문에|하려고|위해서|\bwhy\b|because|so that/i,
  },
  {
    id: 'example', icon: '📎', label: '예시', hint: '원하는 결과의 예 (예시, 예를 들어, 예:, example, e.g.)',
    test: /예시|예제|예를 들어|예:|example|e\.g\./i,
  },
  {
    id: 'edge', icon: '⚠️', label: '엣지 케이스', hint: '예외 상황 (엣지 케이스, 예외, 경계값, 빈 값, null, 에러 처리)',
    test: /엣지 ?케이스|예외|경계값|빈 ?값|빈 문자열|\bnull\b|undefined|에러 처리|오류 처리|edge case|corner case/i,
  },
];

export const metCriteria = (prompt) => PROMPT_CRITERIA.filter((c) => c.test.test(prompt));
