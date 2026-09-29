# Prompt Battle

**English** | [한국어](README.md)

A turn-based RPG wrapped around real AI coding. Every prompt you type is an attack — longer, more specific prompts hit harder — while the game actually reads/writes files and runs commands in your project via the Claude Agent SDK.

## Features

- **Prompts are attacks** — longer prompts and keywords ("step by step", "test", "edge case", "refactor", "why", "example") deal more damage; 2+ different keywords is a critical hit. Korean equivalents count too (단계별, 테스트, 엣지 케이스, 리팩토링, 왜, 예시, ...).
- **Real-time hits** — every command the AI runs or file it edits lands a hit as it happens; touched files fly at the monster as their real OS icon.
- **Player HP** — a monster that survives your turn strikes back (harder if you hesitate or your turn errors). 0 HP = defeat. Clearing a floor heals you.
- **Weapons = Claude models** — Haiku dagger (x0.8), Sonnet longsword (x1), Opus demon blade (x1.25), Fable holy sword (x1.5). Switch any time mid-run.
- **Story themes & chapters** — Adventure / Hunt the Demon King / Bug Sweep. Every 6th floor is a chapter boss; clearing it continues the story, and your progress is saved so the next run picks up where you left off.
- **Inventory** — the sidebar shows your project's file tree; open any file to view or edit and save it. **Drag** files/folders onto another folder to move them, and **drop files from Finder** to copy them in (a name clash becomes `name (1)`). `+📄` / `+📁` create a new file/folder inside the selected folder. Everything stays inside the project folder and nothing is overwritten. ↻ refresh re-reads the tree with an animation.
- **AI party (subagents)** — three Claude subagents: 🧙 wizard (explore/research), 🗡 swordsman (implement), 🏹 archer (test/verify). When the AI splits work and sends several **at once**, the screen shows "N processes running" and what each is doing. The wizard's work strikes as spirits, the archer's as companions, the swordsman's as a blade under the archer's cover fire. Can be turned off on the setup screen (it uses more tokens).
- **Turn timer & a game while you wait** — shows how long the AI has been working. Meanwhile, squash bugs popping up in a 3×3 grid for coins at the end of the turn (max 10 per turn).
- **Readable AI output** — replies are **typed out live** into a chat bubble as the AI streams them, with clean markdown (headings, lists, code, tables). Your messages sit in right-hand bubbles and the log jumps to the bottom when you send. The input grows for long, multi-line prompts (Shift+Enter newline, Enter attack). A question followed by a list becomes clickable choices.
- **Sessions** — after picking a folder, choose which of its Claude Code sessions to resume (terminal `claude` sessions included) or start a new one. Mid-run, the `세션` (session) button **swaps** to another session and shows its transcript in the log. When the context passes 80%, the game shows a ready-made `/new ...` prompt to continue in a new session.
- **Save / load (3 slots)** — in battle, `저장` (save) stores floor, HP, coins, bag, stats, sword level and the Claude session into a slot (free action). `불러오기` (load) on the setup screen restarts that folder, theme and weapon from the saved floor (including the HP of the monster you were fighting).
- **Chat history** — your prompts and the AI's replies are saved per folder and shown when you open that folder again.
- **Coins & merchant goblin** — clearing a floor earns coins (bosses pay 3x). After a clear, a merchant goblin sometimes (30%) appears selling a potion (+40 HP), whetstone (next attack x2), amulet (blocks one counterattack), smoke bomb (guaranteed escape) and life crystal (+10 max HP, permanent). Bag items are free actions. The merchant also runs an **odd/even dice game**: bet coins on odd or even, win double or lose the stake.
- **Stat growth (per run)** — stats start at Lv.0 every run. Every monster defeated grants a stat point; spend it in battle on attack (+10% damage per level), defense (-5% counterattack damage per level) or vitality (+10 max HP per level), each capped at Lv.10. They reset when the run ends; loading a save slot brings that run's stats back. (Sword level and life-crystal max HP are permanent.)
- **Sword enhancement (blacksmith)** — after a clear you sometimes (20%) meet a blacksmith. Pay coins to enhance your sword (+10% damage per level, max +10). The higher it goes the lower the success rate (+0→+1: 95% … +9→+10: 14%), and from +3 a failure can **break the sword back to +0** (10%–40%).
- **Usage bar** — a small line at the bottom shows how much of your Claude plan's 5-hour session limit and weekly limit is used/left and when each resets, plus the current conversation's context tokens (used/max). Refreshes after each turn; click to refresh. (Plan limits come from the SDK as percentages, not token counts; hidden with an API key.)
- **Flee vs. Exit** — fleeing has a 50% chance: success skips to the next floor with no reward, failure wastes the turn and draws a counterattack. You can't flee a boss. The Exit button offers "end today's adventure" (saves floor, coins, bag and session so you resume from that floor) or "keep playing".

## Tour

### 1. Setup
![Setup screen](docs/screenshots/setup.png)

Pick a project folder, a story theme, a weapon (Claude model) and a difficulty. Your current stats and sword level are shown here too. Saved progress shows next to each theme (e.g. `챕터 1 3/6층까지 진행` = chapter 1, floor 3/6); tick "continue" to resume from that floor. If the folder has a saved Claude session, a "resume previous session" checkbox appears too.

### 2. Battle
![Battle screen](docs/screenshots/battle.png)

- **Left, inventory**: your project's file tree. Files the AI touched are highlighted; click any file to view or edit it.
- **Top**: chapter/floor banner, the monster and its HP.
- **Middle bar**: your HP, coins and the weapon (model) switcher, with bag items as buttons below.
- **Log**: your prompts (blue bubbles), live commands/file edits as they land hits, crit keywords, the AI's reply rendered as markdown, and monster counterattacks. It always stays scrolled to the newest message.
- **Bottom**: prompt input plus `Attack` / `Flee` (50%) / `Exit`.

The capture is a real turn: the prompt asked (in Korean) to fix a bug in `cart.js` step by step and add an edge-case test. The AI actually edited `src/cart.js`, created `test/cart.test.js` and ran `npm test`. Three keywords made it a crit.

### 3. Merchant goblin
![Merchant goblin](docs/screenshots/merchant.png)

The merchant sometimes shows up after a clear. Click an item to buy it with coins. In the 🎲 odd/even box, set a stake (or `올인`, all-in) and press `홀` (odd) / `짝` (even) to roll. When done, press `떠나기` (leave) to move on. Typing a prompt here closes the shop and attacks the next monster with it.

### 4. Blacksmith
![Blacksmith](docs/screenshots/blacksmith.png)

Shows the current sword level, the next enhance's cost, success rate and break-on-failure chance. `강화하기` (enhance) rolls immediately: success, fail, or 💥 broken. The ⭐ stat-point buttons at the top spend points earned from defeated monsters.

### 5. Exit
![Exit dialog](docs/screenshots/exit.png)

`나가기` (Exit) asks whether to end today's adventure or keep playing. Ending saves your floor, coins, bag, and this folder's Claude session and chat history. Next time you open the folder, the earlier chat appears at the top of the log.

## Mac App

```bash
git clone https://github.com/tpgusgh/prompt-engineering-is-game.git
cd prompt-engineering-is-game
npm install
npm run electron:build
```

This produces a `.dmg` under `release/`. Open it and drag Prompt Battle into Applications, or run the built `.app` directly.

**First launch:** macOS may say the app "cannot be opened because the developer cannot be verified" — it isn't notarized (that needs a paid Apple Developer account). Right-click the app → Open, then confirm. Only needed once. (If your machine has an Apple Development signing identity, `electron-builder` uses it automatically and you may see no warning.) Apple Silicon (arm64) only for now.

## CLI

```bash
npm install
npm link
promptbattle --difficulty normal
```

Run it inside the project you want to work on. Type `/quit` to leave, `/flee` to try escaping (50%), `/new <prompt>` to start a fresh session, `/use <item>` to use an item, and `/buy <item>`, `/bet odd|even <coins>`, `/leave` at the merchant, `/enhance` at the blacksmith, and `/stat attack|defense|vitality`, `/save 1-3`, `/session <id>` any time. Requires Node.js >= 22.18.0 (native TypeScript execution, no build step). A published `npm install -g` copy won't work — Node refuses to type-strip `.ts` under `node_modules` — so use `npm link` from a clone.

## Setup

No API key needed: the game reuses the Claude Code login already on your machine (e.g. a Claude subscription). Prefer an API key? Set `ANTHROPIC_API_KEY` and the SDK uses that instead. Note that an app launched from Finder doesn't inherit shell environment variables, so the Claude Code login is the reliable path for the Mac app.

## Safety

The agent runs with full autonomous file/command permissions (no per-action confirmation), like `claude --dangerously-skip-permissions`. Only point it at projects you trust. Tool access is limited to Read/Write/Edit/Bash/Glob/Grep. Each run is one continuing Claude Code session, so context and cost grow across floors like a long `claude` session.

## Limitations

- Ctrl+C in the CLI ends the run and saves like `/quit`, but a turn already in flight finishes first (with full permissions).
- No npm registry publish yet — install from the repo.
