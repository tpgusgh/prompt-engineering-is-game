import { calculateDamage } from './damage.ts';
import { renderHpBar, colorize } from './ui.ts';
import { spawnMonster, type Difficulty } from './monsters.ts';
import type { TurnResult, AgentEvent } from './agent.ts';

export interface BattleDeps {
  runTurn: (prompt: string, cwd: string, sessionId?: string, onEvent?: (event: AgentEvent) => void) => Promise<TurnResult>;
  readInput: () => Promise<string | null>;
  write: (text: string) => void;
  cwd: string;
  difficulty: Difficulty;
}

export interface BattleSummary {
  floorsCleared: number;
  floorsEngaged: number;
  xpGained: number;
}

function renderEvent(event: AgentEvent): string {
  return event.type === 'command' ? `  → running: ${event.value}\n` : `  → editing: ${event.value}\n`;
}

function xpForFloor(floor: number): number {
  return 20 + floor * 5;
}

export async function runDungeon(deps: BattleDeps): Promise<BattleSummary> {
  let floor = 0;
  let floorsCleared = 0;
  let floorsEngaged = 0;
  let xpGained = 0;
  let sessionId: string | undefined;

  while (true) {
    const monster = spawnMonster(floor, deps.difficulty);
    let hp = monster.maxHp;
    deps.write(`\n${colorize(`Floor ${floor + 1}: ${monster.name} appears!`, 'bold')}\n${monster.art}\n${renderHpBar(hp, monster.maxHp)}\n`);

    let left = false;
    let currentFloorEngaged = false;
    while (hp > 0) {
      deps.write('\n> ');
      const raw = await deps.readInput();
      if (raw === null) {
        left = true;
        break;
      }
      const prompt = raw.trim();
      if (prompt === '/quit' || prompt === '/flee') {
        left = true;
        break;
      }
      if (prompt.length === 0) {
        deps.write(colorize('You hesitate. No attack this turn.', 'yellow') + '\n');
        continue;
      }

      currentFloorEngaged = true;
      const { damage, crit, matchedKeywords } = calculateDamage(prompt);
      let turn: TurnResult;
      try {
        turn = await deps.runTurn(prompt, deps.cwd, sessionId, (event) => deps.write(renderEvent(event)));
      } catch (err) {
        turn = { summary: '', filesChanged: [], commandsRun: [], error: err instanceof Error ? err.message : String(err) };
      }
      // Only adopt a session id from a turn that actually succeeded — resuming
      // a session captured from a failed turn (a broken/never-saved session)
      // would make every later turn fail the same way for the rest of the run.
      if (!turn.error && turn.sessionId) sessionId = turn.sessionId;

      if (turn.error) {
        deps.write(colorize(`Your attack misses! The spell fizzles: ${turn.error}`, 'red') + '\n');
      } else {
        hp = Math.max(0, hp - damage);
        const critLabel = crit ? colorize(' CRITICAL HIT!', 'red') : '';
        deps.write(`You attack for ${damage} damage!${critLabel}\n`);
        if (matchedKeywords.length > 0) {
          deps.write(`(keywords: ${matchedKeywords.join(', ')})\n`);
        }
        if (turn.summary) deps.write(`${turn.summary}\n`);
      }
      deps.write(renderHpBar(hp, monster.maxHp) + '\n');
    }

    if (currentFloorEngaged) floorsEngaged += 1;
    if (left) break;

    const gained = xpForFloor(floor);
    xpGained += gained;
    floorsCleared += 1;
    deps.write(colorize(`\n${monster.name} defeated! +${gained} XP\n`, 'green'));
    floor += 1;
  }

  return { floorsCleared, floorsEngaged, xpGained };
}
