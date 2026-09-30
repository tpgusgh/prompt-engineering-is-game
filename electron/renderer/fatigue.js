// electron/renderer/fatigue.js
// Hero fatigue = how close the Claude plan's usage limits are: the busier of
// the 5-hour and weekly windows. At 90%+ the AI may stop answering soon.
export const FATIGUE_TIRED = 75;
export const FATIGUE_DANGER = 90;

export function fatigueOf(planUsage) {
  if (!planUsage || typeof planUsage !== 'object') return null;
  const windows = [['5시간', planUsage.session], ['주간', planUsage.weekly]].filter(([, w]) => w && Number.isFinite(w.usedPercent));
  if (!windows.length) return null;
  const [label, w] = windows.reduce((a, b) => (b[1].usedPercent > a[1].usedPercent ? b : a));
  const percent = Math.round(w.usedPercent);
  const level = percent >= FATIGUE_DANGER ? 'danger' : percent >= FATIGUE_TIRED ? 'tired' : 'ok';
  return { level, percent, window: label };
}
