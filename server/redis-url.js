// Redis over its own protocol (REDIS_URL — the Vercel "Redis" / Redis Cloud
// integration), for when there's no Upstash REST endpoint. Same `run`
// contract as upstash() in lib.js; the connection is reused while the
// function instance stays warm.
import { createClient } from 'redis';

let client = null;

export function redisUrl(url) {
  return async (commands) => {
    if (!client) {
      client = createClient({ url });
      client.on('error', () => {}); // surfaced by the command that fails
      await client.connect();
    }
    const out = [];
    for (const cmd of commands) out.push(await client.sendCommand(cmd.map(String)));
    return out;
  };
}
