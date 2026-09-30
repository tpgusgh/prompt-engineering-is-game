#!/usr/bin/env node
// Release builds only: writes electron/ranking-config.json (gitignored) with
// the ranking server URL and the app's signing key from CI secrets
// (RANKING_URL, RANKING_APP_SECRET). Without them the app just can't submit.
import { writeFileSync } from 'node:fs';
import { mask } from '../src/ranking.ts';

const url = process.env.RANKING_URL ?? '';
const secret = process.env.RANKING_APP_SECRET ?? '';
if (!url || !secret) {
  console.log('ranking: RANKING_URL / RANKING_APP_SECRET not set — this build cannot submit scores');
  process.exit(0);
}
writeFileSync('electron/ranking-config.json', JSON.stringify({ url, key: mask(secret) }));
console.log(`ranking: config written for ${url}`);
