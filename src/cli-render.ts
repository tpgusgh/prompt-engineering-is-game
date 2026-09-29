import { colorize, renderHpBar } from './ui.ts';
import type { BattleEvent } from './battle.ts';

export function formatBattleEvent(event: BattleEvent): string {
  switch (event.type) {
    case 'floorStart':
      return `\n${colorize(`Floor ${event.floor + 1}: ${event.monsterName} appears!`, 'bold')}\n${event.monsterArt}\n${renderHpBar(event.maxHp, event.maxHp)}\n`;
    case 'hesitate':
      return colorize('You hesitate. No attack this turn.', 'yellow') + '\n';
    case 'turnStart':
      return colorize('Focusing your attack...', 'cyan') + '\n';
    case 'partialHit':
      return colorize(`  hit for ${event.damage}!`, 'red') + '\n';
    case 'agentEvent':
      return event.agentEvent.type === 'command'
        ? `  → running: ${event.agentEvent.value}\n`
        : `  → editing: ${event.agentEvent.value}\n`;
    case 'agentError':
      return colorize(`Your attack misses! The spell fizzles: ${event.error}`, 'red') + '\n';
    case 'attack': {
      if (event.damage === 0) return colorize('The monster dodged your final blow!', 'yellow') + '\n';
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
    case 'runStart':
      return colorize(`Your HP: ${event.playerHp}/${event.playerMaxHp}`, 'green') + '\n';
    case 'monsterAttack':
      return colorize(`The monster strikes back for ${event.damage}!`, 'red') + '\n';
    case 'playerHpChanged':
      return colorize(`Your HP: ${event.hp}/${event.maxHp}`, 'green') + '\n';
    case 'playerDefeated':
      return colorize('\nYou have fallen...', 'red') + '\n';
    case 'chapterCleared':
      return colorize(`\n*** Chapter ${event.chapter} cleared! The story continues... ***`, 'bold') + '\n';
    case 'sessionReset':
      return colorize('A fresh session begins.', 'cyan') + '\n';
    case 'sessionNearlyFull':
      return (
        colorize(
          `Session is ${Math.round((event.usedTokens / event.contextWindow) * 100)}% full — start your next prompt with "/new" to continue in a fresh session.`,
          'yellow',
        ) + '\n'
      );
    case 'runEnded':
      return '';
  }
}
