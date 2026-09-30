import os from 'node:os';

// Where the game keeps its files (~/.promptbattle under this). Development
// and tests can point it elsewhere with PROMPTBATTLE_HOME; the released app
// clears that variable at startup (electron/main.ts).
export function dataHome(): string {
  return process.env.PROMPTBATTLE_HOME || os.homedir();
}
