import { colorize, renderHpBar } from './ui.ts';
import type { BattleEvent } from './battle.ts';

export function formatBattleEvent(event: BattleEvent): string {
  switch (event.type) {
    case 'floorStart':
      return `\n${colorize(`Floor ${event.floor + 1}: ${event.monsterName} appears!`, 'bold')}\n${event.monsterArt}\n${renderHpBar(event.maxHp, event.maxHp)}\n`;
    case 'hesitate':
      return colorize('You hesitate. No attack this turn.', 'yellow') + '\n';
    case 'agentEvent':
      return event.agentEvent.type === 'command'
        ? `  → running: ${event.agentEvent.value}\n`
        : `  → editing: ${event.agentEvent.value}\n`;
    case 'agentError':
      return colorize(`Your attack misses! The spell fizzles: ${event.error}`, 'red') + '\n';
    case 'attack': {
      const critLabel = event.crit ? colorize(' CRITICAL HIT!', 'red') : '';
      let out = `You attack for ${event.damage} damage!${critLabel}\n`;
      if (event.matchedKeywords.length > 0) out += `(keywords: ${event.matchedKeywords.join(', ')})\n`;
      return out;
    }
    case 'agentSummary':
      return `${event.summary}\n`;
    case 'hpChanged':
      return renderHpBar(event.hp, event.maxHp) + '\n';
    case 'floorCleared':
      return colorize(`\n${event.monsterName} defeated! +${event.xpGained} XP\n`, 'green');
    case 'runEnded':
      return '';
  }
}
