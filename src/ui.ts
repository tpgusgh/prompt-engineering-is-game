const RESET = '\x1b[0m';

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
} as const;

export type Color = keyof typeof COLORS;

export function colorize(text: string, color: Color): string {
  return `${COLORS[color]}${text}${RESET}`;
}

export function renderHpBar(current: number, max: number, width = 20): string {
  const safeMax = Math.max(1, max);
  const clampedCurrent = Math.max(0, Math.min(current, safeMax));
  const ratio = clampedCurrent / safeMax;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '-'.repeat(empty);
  const color: Color = ratio > 0.5 ? 'green' : ratio > 0.2 ? 'yellow' : 'red';
  return `[${colorize(bar, color)}] ${clampedCurrent}/${safeMax}`;
}
