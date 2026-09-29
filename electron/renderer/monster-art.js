// SVG art for each monster in src/monsters.ts, in the same order (index =
// floor % 6). Static, trusted markup — safe to inject with innerHTML.
const MONSTERS = [
  // 0: 버그 고블린
  `<defs>
    <radialGradient id="gob-skin" cx="45%" cy="40%" r="65%"><stop offset="0%" stop-color="#9be36b"/><stop offset="100%" stop-color="#3f7d25"/></radialGradient>
    <linearGradient id="gob-blade" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#eceff4"/><stop offset="100%" stop-color="#7b8394"/></linearGradient>
  </defs>
  <ellipse cx="100" cy="186" rx="52" ry="8" fill="#000" opacity=".35"/>
  <path d="M60 150 Q100 120 140 150 L132 184 L68 184 Z" fill="#5a3a1e"/>
  <path d="M72 184 L78 160 M128 184 L122 160" stroke="#3b2612" stroke-width="4"/>
  <polygon points="42,70 6,48 50,96" fill="#5fa83a" stroke="#2f5f1b" stroke-width="3"/>
  <polygon points="158,70 194,48 150,96" fill="#5fa83a" stroke="#2f5f1b" stroke-width="3"/>
  <circle cx="100" cy="95" r="58" fill="url(#gob-skin)" stroke="#2f5f1b" stroke-width="3"/>
  <path d="M62 78 Q78 66 92 80" stroke="#2f5f1b" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M138 78 Q122 66 108 80" stroke="#2f5f1b" stroke-width="5" fill="none" stroke-linecap="round"/>
  <ellipse cx="78" cy="96" rx="14" ry="11" fill="#fff6a0"/><circle cx="80" cy="97" r="5" fill="#1b1b1b"/>
  <ellipse cx="122" cy="96" rx="14" ry="11" fill="#fff6a0"/><circle cx="120" cy="97" r="5" fill="#1b1b1b"/>
  <path d="M70 122 Q100 146 130 122 Q100 132 70 122 Z" fill="#3b1a12"/>
  <path d="M78 124 l5 9 l5 -8 l5 9 l5 -8 l5 9 l5 -8 l5 9 l5 -9" fill="#fffbe6" stroke="#fffbe6" stroke-width="1"/>
  <g transform="rotate(-35 160 150)"><rect x="156" y="104" width="9" height="58" rx="3" fill="url(#gob-blade)"/><rect x="148" y="160" width="25" height="7" rx="2" fill="#7a4a1c"/><rect x="157" y="166" width="7" height="16" rx="2" fill="#5a3a1e"/></g>
  <text x="100" y="62" text-anchor="middle" font-size="11" fill="#d8ff9e" font-family="monospace" opacity=".8">bug</text>`,

  // 1: 타입 에러 슬라임
  `<defs>
    <radialGradient id="sl-body" cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#c7a8ff"/><stop offset="60%" stop-color="#7b52d6"/><stop offset="100%" stop-color="#3e2380"/></radialGradient>
  </defs>
  <ellipse cx="100" cy="186" rx="70" ry="9" fill="#000" opacity=".35"/>
  <path d="M28 176 Q20 110 60 72 Q100 30 140 72 Q180 110 172 176 Q150 186 128 176 Q116 188 100 178 Q84 190 70 176 Q48 188 28 176 Z" fill="url(#sl-body)" opacity=".92" stroke="#2b1760" stroke-width="3"/>
  <ellipse cx="72" cy="80" rx="16" ry="9" fill="#fff" opacity=".45" transform="rotate(-25 72 80)"/>
  <circle cx="78" cy="120" r="15" fill="#fff"/><circle cx="82" cy="123" r="7" fill="#1a0f33"/><circle cx="85" cy="119" r="2.5" fill="#fff"/>
  <circle cx="126" cy="120" r="15" fill="#fff"/><circle cx="122" cy="123" r="7" fill="#1a0f33"/><circle cx="125" cy="119" r="2.5" fill="#fff"/>
  <path d="M84 152 Q100 162 116 152" stroke="#1a0f33" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M46 176 q4 14 0 18 q-6 -4 0 -18" fill="#7b52d6"/><path d="M150 176 q4 12 0 16 q-6 -4 0 -16" fill="#7b52d6"/>
  <rect x="58" y="36" width="84" height="20" rx="4" fill="#bf616a"/>
  <text x="100" y="50" text-anchor="middle" font-size="11" fill="#fff" font-family="monospace" font-weight="bold">TypeError</text>`,

  // 2: 널 포인터 레이스
  `<defs>
    <linearGradient id="wr-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e5e9f0"/><stop offset="100%" stop-color="#4c566a" stop-opacity=".2"/></linearGradient>
    <radialGradient id="wr-eye"><stop offset="0%" stop-color="#8ffcff"/><stop offset="100%" stop-color="#8ffcff" stop-opacity="0"/></radialGradient>
  </defs>
  <path d="M100 20 Q156 22 160 92 L164 170 Q150 158 140 176 Q126 158 114 178 Q100 160 88 178 Q76 158 60 176 Q50 158 36 170 L40 92 Q44 22 100 20 Z" fill="url(#wr-body)" opacity=".9"/>
  <path d="M60 70 Q100 40 140 70 Q140 110 100 116 Q60 110 60 70 Z" fill="#0b0d12"/>
  <circle cx="82" cy="82" r="16" fill="url(#wr-eye)"/><circle cx="82" cy="82" r="5" fill="#dffeff"/>
  <circle cx="118" cy="82" r="16" fill="url(#wr-eye)"/><circle cx="118" cy="82" r="5" fill="#dffeff"/>
  <path d="M86 102 Q100 96 114 102" stroke="#8ffcff" stroke-width="2" fill="none" opacity=".7"/>
  <path d="M40 120 Q20 140 30 160 M160 120 Q180 140 170 160" stroke="#d8dee9" stroke-width="5" fill="none" opacity=".6" stroke-linecap="round"/>
  <g stroke="#9aa3b5" stroke-width="3" fill="none">
    <ellipse cx="64" cy="142" rx="7" ry="5"/><ellipse cx="76" cy="148" rx="7" ry="5"/><ellipse cx="88" cy="152" rx="7" ry="5"/>
  </g>
  <text x="104" y="160" font-size="14" fill="#8ffcff" font-family="monospace" font-weight="bold">null</text>`,

  // 3: 경쟁 상태 팬텀
  `<defs>
    <linearGradient id="ph-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff6b8b"/><stop offset="100%" stop-color="#ff6b8b" stop-opacity="0"/></linearGradient>
    <linearGradient id="ph-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5ce1ff"/><stop offset="100%" stop-color="#5ce1ff" stop-opacity="0"/></linearGradient>
  </defs>
  <g class="phantom-a" opacity=".75">
    <path d="M86 26 Q132 28 134 88 L136 170 Q122 156 110 172 Q98 156 86 172 Q74 156 60 170 L60 88 Q62 28 86 26 Z" fill="url(#ph-a)"/>
    <ellipse cx="78" cy="82" rx="8" ry="12" fill="#1b0a10"/><ellipse cx="106" cy="82" rx="8" ry="12" fill="#1b0a10"/>
  </g>
  <g class="phantom-b" opacity=".75">
    <path d="M114 36 Q160 38 162 98 L164 180 Q150 166 138 182 Q126 166 114 182 Q102 166 88 180 L88 98 Q90 38 114 36 Z" fill="url(#ph-b)"/>
    <ellipse cx="106" cy="92" rx="8" ry="12" fill="#06161b"/><ellipse cx="134" cy="92" rx="8" ry="12" fill="#06161b"/>
  </g>
  <path d="M92 118 Q100 128 108 118 Q116 128 124 118" stroke="#fff" stroke-width="3" fill="none"/>
  <g stroke="#fff" stroke-width="2" opacity=".5"><line x1="30" y1="60" x2="70" y2="60"/><line x1="140" y1="130" x2="186" y2="130"/><line x1="20" y1="150" x2="50" y2="150"/></g>
  <text x="100" y="16" text-anchor="middle" font-size="10" fill="#fff" font-family="monospace" opacity=".7">t1 ⇄ t2</text>`,

  // 4: 머지 컨플릭트 히드라
  `<defs>
    <radialGradient id="hy-body" cx="50%" cy="30%" r="70%"><stop offset="0%" stop-color="#5ecf9a"/><stop offset="100%" stop-color="#1b5c43"/></radialGradient>
  </defs>
  <ellipse cx="100" cy="188" rx="72" ry="8" fill="#000" opacity=".35"/>
  <path d="M60 110 Q40 70 44 40" stroke="#2c7a58" stroke-width="18" fill="none" stroke-linecap="round"/>
  <path d="M100 110 Q100 60 100 28" stroke="#2c7a58" stroke-width="20" fill="none" stroke-linecap="round"/>
  <path d="M140 110 Q160 70 156 40" stroke="#2c7a58" stroke-width="18" fill="none" stroke-linecap="round"/>
  <g><ellipse cx="42" cy="36" rx="20" ry="15" fill="#bf616a"/><circle cx="36" cy="32" r="4" fill="#ffe08a"/><path d="M26 42 l32 0" stroke="#3b0d12" stroke-width="3"/></g>
  <g><ellipse cx="100" cy="24" rx="22" ry="16" fill="#ebcb8b"/><circle cx="93" cy="20" r="4" fill="#3b2a0d"/><circle cx="107" cy="20" r="4" fill="#3b2a0d"/><path d="M88 32 l24 0" stroke="#3b2a0d" stroke-width="3"/></g>
  <g><ellipse cx="158" cy="36" rx="20" ry="15" fill="#5e81ac"/><circle cx="164" cy="32" r="4" fill="#ffe08a"/><path d="M142 42 l32 0" stroke="#0d1a2b" stroke-width="3"/></g>
  <path d="M40 180 Q30 110 100 100 Q170 110 160 180 Z" fill="url(#hy-body)" stroke="#123d2c" stroke-width="3"/>
  <g font-family="monospace" font-size="12" font-weight="bold">
    <text x="100" y="132" text-anchor="middle" fill="#bf616a">&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
    <text x="100" y="150" text-anchor="middle" fill="#eceff4">=======</text>
    <text x="100" y="168" text-anchor="middle" fill="#5e81ac">&gt;&gt;&gt;&gt;&gt;&gt;&gt;</text>
  </g>`,

  // 5: 레거시 코드 드래곤
  `<defs>
    <radialGradient id="dr-body" cx="45%" cy="35%" r="70%"><stop offset="0%" stop-color="#d9534f"/><stop offset="100%" stop-color="#5a1111"/></radialGradient>
    <linearGradient id="dr-wing" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b1e1e"/><stop offset="100%" stop-color="#2b0707"/></linearGradient>
    <radialGradient id="dr-fire" cx="0%" cy="50%" r="100%"><stop offset="0%" stop-color="#fff3b0"/><stop offset="40%" stop-color="#ffb347"/><stop offset="100%" stop-color="#ff4500" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="100" cy="190" rx="78" ry="8" fill="#000" opacity=".4"/>
  <path d="M70 100 L4 40 L22 96 L0 110 L30 124 L14 150 L70 140 Z" fill="url(#dr-wing)" stroke="#1f0505" stroke-width="2"/>
  <path d="M130 100 L196 40 L178 96 L200 110 L170 124 L186 150 L130 140 Z" fill="url(#dr-wing)" stroke="#1f0505" stroke-width="2"/>
  <path d="M50 186 Q40 120 100 104 Q160 120 150 186 Z" fill="url(#dr-body)" stroke="#2b0707" stroke-width="3"/>
  <path d="M74 186 Q100 150 126 186" fill="#e8b36a" opacity=".6"/>
  <path d="M60 60 Q100 20 140 60 Q150 100 100 112 Q50 100 60 60 Z" fill="url(#dr-body)" stroke="#2b0707" stroke-width="3"/>
  <path d="M68 50 L56 18 L80 44 Z" fill="#e5d3b3" stroke="#6b5a3a" stroke-width="2"/>
  <path d="M132 50 L144 18 L120 44 Z" fill="#e5d3b3" stroke="#6b5a3a" stroke-width="2"/>
  <path d="M74 66 L94 74 L76 80 Z" fill="#ffd54a"/><path d="M126 66 L106 74 L124 80 Z" fill="#ffd54a"/>
  <path d="M78 96 Q100 108 122 96" stroke="#2b0707" stroke-width="4" fill="none"/>
  <path d="M84 98 l4 7 l4 -6 M112 98 l4 7 l4 -6" stroke="#fff" stroke-width="2" fill="none"/>
  <ellipse class="dragon-fire" cx="150" cy="96" rx="44" ry="14" fill="url(#dr-fire)"/>
  <text x="100" y="170" text-anchor="middle" font-size="10" fill="#ffd9a0" font-family="monospace" opacity=".85">// TODO: refactor (2009)</text>`,
];

const BOSS_AURA = `<defs><radialGradient id="boss-aura"><stop offset="55%" stop-color="#b48ead" stop-opacity="0"/><stop offset="80%" stop-color="#b48ead" stop-opacity=".45"/><stop offset="100%" stop-color="#b48ead" stop-opacity="0"/></radialGradient></defs>
  <circle class="boss-aura" cx="100" cy="100" r="98" fill="url(#boss-aura)"/>`;

const BOSS_CROWN = `<path d="M70 14 L78 0 L88 12 L100 -4 L112 12 L122 0 L130 14 Z" fill="#ebcb8b" stroke="#8a6d2b" stroke-width="2" transform="translate(0 6)"/>`;

export function monsterSvg(index, isBoss) {
  const body = MONSTERS[index % MONSTERS.length];
  return `<svg class="monster-svg${isBoss ? ' boss' : ''}" viewBox="-10 -10 220 220" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    ${isBoss ? BOSS_AURA : ''}
    <g class="monster-body">${body}</g>
    ${isBoss ? BOSS_CROWN : ''}
  </svg>`;
}

// The merchant goblin: a friendly goblin with a pointed hat, a pack of wares
// and a coin. Same viewBox/animation class as the monsters.
const MERCHANT = `<defs>
    <radialGradient id="mer-skin" cx="45%" cy="40%" r="65%"><stop offset="0%" stop-color="#b6ec8a"/><stop offset="100%" stop-color="#4f8f2f"/></radialGradient>
    <radialGradient id="mer-coin" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#fff2b0"/><stop offset="100%" stop-color="#c9982a"/></radialGradient>
  </defs>
  <ellipse cx="100" cy="188" rx="60" ry="8" fill="#000" opacity=".35"/>
  <path d="M134 110 Q182 100 180 150 Q178 184 138 180 Z" fill="#8a5a2b" stroke="#4e3115" stroke-width="3"/>
  <path d="M142 118 Q170 116 170 136" stroke="#c49a5a" stroke-width="3" fill="none"/>
  <path d="M58 150 Q100 124 142 150 L136 184 L64 184 Z" fill="#4c6fa5" stroke="#2c4570" stroke-width="3"/>
  <rect x="64" y="160" width="72" height="8" fill="#ebcb8b"/>
  <polygon points="46,92 12,78 52,112" fill="#6fb843" stroke="#2f5f1b" stroke-width="3"/>
  <polygon points="154,92 188,78 148,112" fill="#6fb843" stroke="#2f5f1b" stroke-width="3"/>
  <circle cx="100" cy="108" r="50" fill="url(#mer-skin)" stroke="#2f5f1b" stroke-width="3"/>
  <path d="M46 76 Q100 60 154 76 L100 -2 Z" fill="#b04a5a" stroke="#6e2230" stroke-width="3"/>
  <ellipse cx="100" cy="74" rx="58" ry="10" fill="#8e3445" stroke="#6e2230" stroke-width="3"/>
  <circle cx="100" cy="0" r="7" fill="#ebcb8b"/>
  <path d="M70 102 Q80 94 90 102" stroke="#1b1b1b" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M110 102 Q120 94 130 102" stroke="#1b1b1b" stroke-width="4" fill="none" stroke-linecap="round"/>
  <ellipse cx="72" cy="118" rx="7" ry="4" fill="#e88a9a" opacity=".6"/><ellipse cx="128" cy="118" rx="7" ry="4" fill="#e88a9a" opacity=".6"/>
  <path d="M80 124 Q100 142 120 124" stroke="#3b1a12" stroke-width="4" fill="#3b1a12" stroke-linecap="round"/>
  <rect x="93" y="124" width="7" height="7" fill="#fffbe6"/>
  <circle cx="44" cy="150" r="17" fill="url(#mer-coin)" stroke="#8a6d2b" stroke-width="3"/>
  <text x="44" y="156" text-anchor="middle" font-size="16" font-weight="bold" fill="#8a6d2b" font-family="monospace">$</text>`;

export function merchantSvg() {
  return `<svg class="monster-svg" viewBox="-10 -10 220 220" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <g class="monster-body">${MERCHANT}</g>
  </svg>`;
}

// The blacksmith: a bearded dwarf with a hammer over an anvil.
const BLACKSMITH = `<defs>
    <radialGradient id="bs-skin" cx="45%" cy="40%" r="65%"><stop offset="0%" stop-color="#f3c9a0"/><stop offset="100%" stop-color="#c98b5e"/></radialGradient>
    <linearGradient id="bs-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#aeb6c4"/><stop offset="100%" stop-color="#4c566a"/></linearGradient>
    <radialGradient id="bs-glow"><stop offset="0%" stop-color="#ffcf70"/><stop offset="100%" stop-color="#ff7a30" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="100" cy="190" rx="75" ry="8" fill="#000" opacity=".35"/>
  <path d="M40 150 L160 150 L150 165 L120 168 L128 188 L72 188 L80 168 L50 165 Z" fill="url(#bs-metal)" stroke="#2e3440" stroke-width="3"/>
  <circle cx="100" cy="146" r="16" fill="url(#bs-glow)"/>
  <rect x="84" y="140" width="32" height="7" rx="2" fill="#ffb347"/>
  <path d="M64 136 Q100 108 136 136 L136 150 L64 150 Z" fill="#7a4a2a" stroke="#4e3115" stroke-width="3"/>
  <rect x="80" y="112" width="40" height="30" rx="4" fill="#5a3a1e"/>
  <circle cx="100" cy="72" r="36" fill="url(#bs-skin)" stroke="#8a5a3a" stroke-width="3"/>
  <path d="M64 70 Q100 30 136 70 Q130 46 100 40 Q70 46 64 70 Z" fill="#5a3a1e"/>
  <path d="M70 84 Q100 150 130 84 Q118 96 100 94 Q82 96 70 84 Z" fill="#c9793a" stroke="#8a4f22" stroke-width="2"/>
  <path d="M86 70 l8 0 M106 70 l8 0" stroke="#2e3440" stroke-width="4" stroke-linecap="round"/>
  <path d="M78 62 l14 -4 M122 62 l-14 -4" stroke="#5a3a1e" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="100" cy="80" rx="6" ry="5" fill="#e0a07a"/>
  <g transform="rotate(-30 150 90)">
    <rect x="146" y="64" width="8" height="64" rx="3" fill="#8a5a3a"/>
    <rect x="130" y="52" width="40" height="20" rx="3" fill="url(#bs-metal)" stroke="#2e3440" stroke-width="3"/>
  </g>
  <circle cx="72" cy="132" r="3" fill="#ffcf70"/><circle cx="130" cy="128" r="2.5" fill="#ffcf70"/><circle cx="118" cy="120" r="2" fill="#ffb347"/>`;

export function blacksmithSvg() {
  return `<svg class="monster-svg" viewBox="-10 -10 220 220" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <g class="monster-body">${BLACKSMITH}</g>
  </svg>`;
}
