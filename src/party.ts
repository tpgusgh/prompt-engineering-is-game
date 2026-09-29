import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

// The AI party: three Claude subagents the main agent can send out, several
// at once. Their in-game attacks: the wizard's spirits, the archer's
// companions, the swordsman backed by the archer's cover fire.
export type PartyRole = 'wizard' | 'swordsman' | 'archer';

export const PARTY: Record<PartyRole, AgentDefinition> = {
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

export const PARTY_SYSTEM_PROMPT =
  'You lead a party of subagents: wizard (explore/research, read-only), swordsman (implement changes), archer (run tests/verify). ' +
  'When a task has independent parts, delegate them by calling the Agent tool several times in ONE message with run_in_background: false, so they work in parallel. ' +
  'For small, simple tasks just do the work yourself. Reply to the user in the language they wrote in.';
