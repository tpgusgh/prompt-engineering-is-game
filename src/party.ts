import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

// The AI party: three Claude subagents the main agent can send out, several
// at once. Their in-game attacks: the wizard's spirits, the archer's
// companions, the swordsman backed by the archer's cover fire.
export type PartyRole = 'wizard' | 'swordsman' | 'archer' | 'courier';

export const PARTY: Record<Exclude<PartyRole, 'courier'>, AgentDefinition> = {
  wizard: {
    description: 'Wizard (마법사): explores and researches — reads, searches and explains code to gather context. Never edits files.',
    prompt:
      'You are the party wizard: an investigator. Read and search the codebase to answer the question you were given, then report findings concisely with file paths. Do not modify files.',
    tools: ['Read', 'Glob', 'Grep'],
    model: 'inherit',
  },
  swordsman: {
    description: 'Swordsman (검사): implements — makes focused code changes for a well-defined task.',
    prompt:
      'You are the party swordsman: an implementer. Make the requested, focused code change, keep it minimal, and report what you changed with file paths.',
    tools: ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash'],
    model: 'inherit',
  },
  archer: {
    description: 'Archer (궁수): verifies — runs tests, builds and linters, and reports failures precisely.',
    prompt:
      'You are the party archer: a verifier. Run the relevant tests/build/lint commands, and report exactly what passed and what failed (with the decisive error lines). Do not modify source files.',
    tools: ['Bash', 'Read', 'Glob', 'Grep'],
    model: 'inherit',
  },
};

// The courier (전령) carries long-running work off the main thread. Always
// available, party mode or not, so long jobs never block a turn.
export const COURIER: AgentDefinition = {
  description:
    'Courier (전령): runs long-running or background-worthy work — builds, full test suites, installs, data processing, training, long scripts, anything likely to take more than a few minutes — and reports the outcome.',
  prompt:
    'You are the courier: you carry out one long-running job to completion (it may take a long time; that is fine), then report concisely what ran, whether it succeeded, and the decisive output lines or errors.',
  tools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
  model: 'inherit',
};

export function agentsFor(party: boolean): Record<string, AgentDefinition> {
  return party ? { ...PARTY, courier: COURIER } : { courier: COURIER };
}

const COURIER_RULE =
  'Delegate long-running or background-worthy work (builds, full test suites, installs, data processing, training, long scripts — anything likely to take more than a few minutes, and certainly anything around 20 minutes or more) to the courier subagent via the Agent tool with run_in_background: true, instead of running it inline or with Bash run_in_background. Keep working or end your turn; when the courier reports back, tell the user the result.';

const PARTY_RULE =
  'You also lead a party of subagents: wizard (explore/research, read-only), swordsman (implement changes), archer (run tests/verify). ' +
  'When a task has independent parts, delegate them by calling the Agent tool several times in ONE message so they work in parallel. For small, simple tasks just do the work yourself.';

// A dev server run with Bash run_in_background never ends, so the turn would
// wait on it forever; detached, the turn ends and the game's 🖥 서버 panel
// (src/servers.ts) shows it and can stop it.
const SERVER_RULE =
  'To start a long-running server (dev server, API, watcher), run it detached in the project folder so your turn can end — e.g. `nohup npm run dev > server.log 2>&1 &` — then check it is up and give the user the URL. Do not use Bash run_in_background for servers. The user can see and stop it from the game\'s Servers panel.';

export function systemPromptFor(party: boolean): string {
  return [COURIER_RULE, SERVER_RULE, ...(party ? [PARTY_RULE] : []), 'Reply to the user in the language they wrote in.'].join(' ');
}
