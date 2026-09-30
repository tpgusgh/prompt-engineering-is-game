import { colorize, renderHpBar } from './ui.ts';
import { AUTO_SAVE_SLOT, type BattleEvent } from './battle.ts';

export function formatBattleEvent(event: BattleEvent): string {
  switch (event.type) {
    case 'floorStart':
      return `\n${colorize(`Floor ${event.floor + 1}: ${event.monsterName} appears!`, 'bold')}\n${event.monsterArt}\n${renderHpBar(event.maxHp, event.maxHp)}\n${event.gimmick ? colorize(`Boss rule: ${event.gimmick.text}`, 'yellow') + '\n' : ''}`;
    case 'monsterWaits':
      return colorize('The AI is asking you something. The monster waits for your answer.', 'yellow') + '\n';
    case 'gimmickBlocked':
      return colorize(`The boss's rule held: ${event.text}. No damage this turn.`, 'yellow') + '\n';
    case 'monsterDown':
      return colorize('The monster falls! The rest of the work pounds on a treasure chest...', 'green') + '\n';
    case 'chestHit':
      return colorize(`  chest +${event.damage} (${event.total})`, 'yellow') + '\n';
    case 'chestOpened':
      return colorize(`Treasure: ${event.name} (overkill ${event.overkill}) — +${event.coins} coins${event.items.length ? `, ${event.items.join(', ')}` : ''}`, 'yellow') + '\n';
    case 'contractSigned':
      return colorize(`Contract with ${event.name}: ${event.text}${event.hpCost ? ` (-${event.hpCost} HP)` : ''}`, 'yellow') + '\n';
    case 'contractBroken':
      return colorize(`Contracts clash and break! Max HP -${event.penalty} for good (${event.maxHp}).`, 'red') + '\n';
    case 'traitThorns':
      return colorize(`A failed tool pricks you on the monster's thorns: -${event.damage} HP.`, 'red') + '\n';
    case 'traitRegen':
      return colorize(`The monster regenerates ${event.amount} HP.`, 'yellow') + '\n';
    case 'gimmickHeal':
      return colorize(`A tool failed — the boss regenerates ${event.amount} HP.`, 'yellow') + '\n';
    case 'hesitate':
      return colorize('You hesitate. No attack this turn.', 'yellow') + '\n';
    case 'turnStart':
      return colorize('Focusing your attack...', 'cyan') + '\n';
    case 'partialHit':
      return colorize(`  hit for ${event.damage}!`, 'red') + '\n';
    case 'agentEvent': {
      const e = event.agentEvent;
      if (e.type === 'command') return `  → running: ${e.value}\n`;
      if (e.type === 'file') return `  → editing: ${e.value}\n`;
      if (e.type === 'agentStart') return colorize(`  ✦ ${e.agentType} joins the party: ${e.description}`, 'cyan') + '\n';
      // Streamed text is printed once, whole, as agentSummary.
      return '';
    }
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
    case 'sessionSaved':
      return '';
    case 'fleeAttempt':
      return event.success
        ? colorize('You got away! On to the next floor (no reward).', 'cyan') + '\n'
        : colorize('You failed to escape! The turn is lost.', 'yellow') + '\n';
    case 'fleeBlocked':
      return colorize("You can't run from a boss!", 'red') + '\n';
    case 'coinsChanged':
      return colorize(`+${event.gained} coins (${event.coins} total)`, 'yellow') + '\n';
    case 'merchantOpen':
      return (
        colorize(`\nA merchant goblin appears! You have ${event.coins} coins.`, 'bold') +
        '\n' +
        event.items.map((item) => `  /buy ${item.id} — ${item.name}: ${item.description} (${item.price})`).join('\n') +
        '\n  /bet odd|even <coins> to gamble, /leave to move on\n'
      );
    case 'purchased':
      return colorize(`Bought ${event.itemId}. ${event.coins} coins left.`, 'green') + '\n';
    case 'purchaseFailed':
      return colorize(`Can't buy ${event.itemId}: ${event.reason}`, 'red') + '\n';
    case 'betResult':
      return colorize(
        `Die shows ${event.roll} (${event.roll % 2 ? 'odd' : 'even'}) — you ${event.won ? `win ${event.amount}` : `lose ${event.amount}`}. ${event.coins} coins.`,
        event.won ? 'green' : 'red',
      ) + '\n';
    case 'betFailed':
      return colorize(`Bet refused: ${event.reason}`, 'red') + '\n';
    case 'merchantClosed':
      return colorize('The merchant waves goodbye.', 'cyan') + '\n';
    case 'bagChanged':
      return `Bag: ${Object.entries(event.bag).map(([id, n]) => `${id} x${n}`).join(', ') || '(empty)'}\n`;
    case 'itemUsed':
      return colorize(`Used ${event.itemId}.`, 'green') + '\n';
    case 'itemUseFailed':
      return colorize(`No usable ${event.itemId} in your bag.`, 'red') + '\n';
    case 'contextUsage':
      return '';
    case 'snapshot':
      return event.slot === 0 || event.slot === AUTO_SAVE_SLOT ? '' : colorize('Save slots are available in the desktop app.', 'yellow') + '\n';
    case 'saveFailed':
      return colorize(`Save failed: ${event.reason}`, 'red') + '\n';
    case 'sessionSwitched':
      return colorize(`Switched to session ${event.sessionId}.`, 'cyan') + '\n';
    case 'statPointsChanged':
      return colorize(`+1 stat point (${event.points} unspent) — /stat attack|defense|vitality`, 'cyan') + '\n';
    case 'statRaised':
      return colorize(`${event.stat} is now Lv.${event.stats[event.stat]} (${event.points} points left)`, 'green') + '\n';
    case 'statRaiseFailed':
      return colorize(`Can't raise stat: ${event.reason}`, 'red') + '\n';
    case 'blacksmithOpen':
      return (
        colorize(`\nA blacksmith appears! Sword +${event.swordLevel}, ${event.coins} coins.`, 'bold') +
        `\n  /enhance — ${event.odds.cost} coins, ${Math.round(event.odds.successChance * 100)}% success, ${Math.round(event.odds.breakChance * 100)}% break on failure\n  /leave to move on\n`
      );
    case 'enhanceResult':
      return (
        colorize(
          event.outcome === 'success' ? `Success! Sword is now +${event.swordLevel}.` : event.outcome === 'broken' ? 'The sword BROKE! Back to +0.' : `Failed. Sword stays +${event.swordLevel}.`,
          event.outcome === 'success' ? 'green' : 'red',
        ) + ` ${event.coins} coins left.\n`
      );
    case 'enhanceFailed':
      return colorize(`Can't enhance: ${event.reason}`, 'red') + '\n';
    case 'blacksmithClosed':
      return colorize('The blacksmith goes back to the forge.', 'cyan') + '\n';
    case 'typingHit':
      return '';
    case 'turnInterrupted':
      return colorize('You stopped the attack.', 'yellow') + '\n';
    case 'counterBlocked':
      return colorize('Your amulet blocks the counterattack!', 'cyan') + '\n';
    case 'runEnded':
      return '';
  }
}
