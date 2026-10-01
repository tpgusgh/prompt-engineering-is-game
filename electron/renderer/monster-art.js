// SVG art for each monster in src/monsters.ts, in the same order (index =
// roster * 6 + floor % 6: chapters alternate between the two rosters). Static, trusted markup — safe to inject with innerHTML.
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

  // 6: 메모리 릭 젤리
  `<defs>
    <radialGradient id="ml-body" cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#9ff0e4"/><stop offset="60%" stop-color="#2fa89a"/><stop offset="100%" stop-color="#14564f"/></radialGradient>
  </defs>
  <ellipse cx="100" cy="186" rx="78" ry="10" fill="#1f8f82" opacity=".45"/>
  <ellipse cx="46" cy="184" rx="18" ry="5" fill="#2fa89a" opacity=".7"/><ellipse cx="160" cy="186" rx="14" ry="4" fill="#2fa89a" opacity=".7"/>
  <path d="M40 170 Q30 100 70 70 Q100 48 130 70 Q170 100 160 170 Q140 180 124 168 L122 186 Q116 190 112 176 Q100 182 88 172 L86 190 Q80 194 76 176 Q58 182 40 170 Z" fill="url(#ml-body)" opacity=".9" stroke="#0f4a44" stroke-width="3"/>
  <ellipse cx="78" cy="84" rx="16" ry="8" fill="#fff" opacity=".4" transform="rotate(-20 78 84)"/>
  <circle cx="80" cy="118" r="13" fill="#fff"/><circle cx="83" cy="121" r="6" fill="#0b2b28"/>
  <circle cx="122" cy="118" r="13" fill="#fff"/><circle cx="119" cy="121" r="6" fill="#0b2b28"/>
  <path d="M86 148 Q100 140 114 148" stroke="#0b2b28" stroke-width="4" fill="none" stroke-linecap="round"/>
  <rect x="62" y="34" width="76" height="20" rx="4" fill="#0f4a44"/>
  <text x="100" y="48" text-anchor="middle" font-size="11" fill="#9ff0e4" font-family="monospace" font-weight="bold">4.2 GB ↑</text>`,

  // 7: 무한 루프 뱀
  `<defs>
    <linearGradient id="lp-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f7d774"/><stop offset="100%" stop-color="#c77d1a"/></linearGradient>
  </defs>
  <ellipse cx="100" cy="186" rx="64" ry="8" fill="#000" opacity=".35"/>
  <circle cx="100" cy="112" r="58" fill="none" stroke="url(#lp-body)" stroke-width="26"/>
  <circle cx="100" cy="112" r="58" fill="none" stroke="#7a4a0c" stroke-width="3" stroke-dasharray="6 10"/>
  <path d="M148 70 Q176 58 178 80 Q180 100 156 96 Z" fill="#e8a93a" stroke="#7a4a0c" stroke-width="3"/>
  <circle cx="166" cy="76" r="4" fill="#1b1b1b"/>
  <path d="M176 88 l10 4 l-10 2" stroke="#bf616a" stroke-width="2" fill="none"/>
  <path d="M140 64 Q132 52 142 48" stroke="#c77d1a" stroke-width="10" fill="none" stroke-linecap="round"/>
  <text x="100" y="117" text-anchor="middle" font-size="13" fill="#f7d774" font-family="monospace" font-weight="bold">while(true)</text>
  <path d="M84 150 A30 30 0 1 1 116 150" stroke="#f7d774" stroke-width="3" fill="none" stroke-dasharray="4 4" opacity=".7"/>`,

  // 8: 스택 오버플로 골렘
  `<defs>
    <linearGradient id="st-block" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b3bccb"/><stop offset="100%" stop-color="#5f6b7d"/></linearGradient>
  </defs>
  <ellipse cx="100" cy="188" rx="62" ry="8" fill="#000" opacity=".4"/>
  <rect x="62" y="150" width="30" height="34" rx="4" fill="url(#st-block)" stroke="#2e3440" stroke-width="3"/>
  <rect x="108" y="150" width="30" height="34" rx="4" fill="url(#st-block)" stroke="#2e3440" stroke-width="3"/>
  <rect x="56" y="96" width="88" height="56" rx="6" fill="url(#st-block)" stroke="#2e3440" stroke-width="3"/>
  <rect x="24" y="100" width="30" height="46" rx="5" fill="url(#st-block)" stroke="#2e3440" stroke-width="3"/>
  <rect x="146" y="100" width="30" height="46" rx="5" fill="url(#st-block)" stroke="#2e3440" stroke-width="3"/>
  <rect x="66" y="46" width="68" height="48" rx="6" fill="url(#st-block)" stroke="#2e3440" stroke-width="3"/>
  <rect x="80" y="62" width="14" height="10" fill="#ff6b6b"/><rect x="106" y="62" width="14" height="10" fill="#ff6b6b"/>
  <rect x="84" y="80" width="32" height="5" fill="#2e3440"/>
  <text x="100" y="118" text-anchor="middle" font-size="9" fill="#2e3440" font-family="monospace">frame #9999</text>
  <text x="100" y="132" text-anchor="middle" font-size="9" fill="#2e3440" font-family="monospace">frame #10000</text>
  <rect x="72" y="18" width="56" height="22" rx="4" fill="#bf616a" stroke="#7a2e36" stroke-width="2"/>
  <text x="100" y="33" text-anchor="middle" font-size="9" fill="#fff" font-family="monospace" font-weight="bold">OVERFLOW</text>`,

  // 9: 의존성 지옥 거미
  `<defs>
    <radialGradient id="dp-body" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#7a6a9e"/><stop offset="100%" stop-color="#2a2140"/></radialGradient>
  </defs>
  <g stroke="#d8dee9" stroke-width="1" opacity=".35" fill="none">
    <path d="M100 100 L10 20 M100 100 L190 20 M100 100 L10 180 M100 100 L190 180 M100 100 L100 0 M100 100 L0 100 M100 100 L200 100"/>
    <circle cx="100" cy="100" r="40"/><circle cx="100" cy="100" r="70"/>
  </g>
  <g stroke="#1b1530" stroke-width="6" stroke-linecap="round" fill="none">
    <path d="M78 104 Q40 80 22 104"/><path d="M78 112 Q36 112 20 140"/><path d="M80 120 Q46 140 40 172"/><path d="M84 96 Q56 60 34 60"/>
    <path d="M122 104 Q160 80 178 104"/><path d="M122 112 Q164 112 180 140"/><path d="M120 120 Q154 140 160 172"/><path d="M116 96 Q144 60 166 60"/>
  </g>
  <ellipse cx="100" cy="132" rx="34" ry="30" fill="url(#dp-body)" stroke="#1b1530" stroke-width="3"/>
  <circle cx="100" cy="96" r="24" fill="url(#dp-body)" stroke="#1b1530" stroke-width="3"/>
  <circle cx="90" cy="92" r="4" fill="#ff5c5c"/><circle cx="110" cy="92" r="4" fill="#ff5c5c"/><circle cx="96" cy="84" r="3" fill="#ff5c5c"/><circle cx="104" cy="84" r="3" fill="#ff5c5c"/>
  <rect x="14" y="10" width="54" height="16" rx="3" fill="#3b4252" stroke="#88c0d0"/><text x="41" y="21" text-anchor="middle" font-size="8" fill="#88c0d0" font-family="monospace">left-pad</text>
  <rect x="132" y="10" width="54" height="16" rx="3" fill="#3b4252" stroke="#88c0d0"/><text x="159" y="21" text-anchor="middle" font-size="8" fill="#88c0d0" font-family="monospace">^1.0.0 ?</text>
  <text x="100" y="140" text-anchor="middle" font-size="9" fill="#d8c8ff" font-family="monospace">node_modules</text>`,

  // 10: 캐시 무효화 유령
  `<defs>
    <linearGradient id="ch-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f0f4ff"/><stop offset="100%" stop-color="#8fa3d9" stop-opacity=".25"/></linearGradient>
  </defs>
  <ellipse cx="100" cy="188" rx="46" ry="6" fill="#000" opacity=".25"/>
  <path d="M50 170 Q44 80 100 50 Q156 80 150 170 L138 158 L126 172 L112 158 L100 172 L88 158 L74 172 L62 158 Z" fill="url(#ch-body)" stroke="#5e6f9e" stroke-width="3" opacity=".95"/>
  <ellipse cx="82" cy="106" rx="10" ry="14" fill="#1d2440"/><ellipse cx="118" cy="106" rx="10" ry="14" fill="#1d2440"/>
  <ellipse cx="100" cy="138" rx="10" ry="7" fill="#1d2440"/>
  <circle cx="158" cy="62" r="24" fill="#fdf6e3" stroke="#5e6f9e" stroke-width="3"/>
  <path d="M158 62 L158 46 M158 62 L170 68" stroke="#1d2440" stroke-width="3" stroke-linecap="round"/>
  <text x="158" y="98" text-anchor="middle" font-size="9" fill="#ebcb8b" font-family="monospace">stale</text>
  <text x="100" y="40" text-anchor="middle" font-size="10" fill="#aebde8" font-family="monospace">Cache-Control: forever</text>`,

  // 11: 프로덕션 장애 타이탄 (boss)
  `<defs>
    <linearGradient id="pt-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e06c6c"/><stop offset="100%" stop-color="#5c1414"/></linearGradient>
    <radialGradient id="pt-siren" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#fff3b0"/><stop offset="100%" stop-color="#ff3b3b"/></radialGradient>
  </defs>
  <ellipse cx="100" cy="190" rx="74" ry="9" fill="#000" opacity=".45"/>
  <path d="M58 188 L66 146 L134 146 L142 188 Z" fill="#3b0d0d" stroke="#1a0505" stroke-width="3"/>
  <path d="M40 150 Q30 90 60 70 L140 70 Q170 90 160 150 Z" fill="url(#pt-body)" stroke="#1a0505" stroke-width="3"/>
  <path d="M40 96 Q10 110 16 150 L34 150 Q32 118 48 108 Z" fill="url(#pt-body)" stroke="#1a0505" stroke-width="3"/>
  <path d="M160 96 Q190 110 184 150 L166 150 Q168 118 152 108 Z" fill="url(#pt-body)" stroke="#1a0505" stroke-width="3"/>
  <rect x="70" y="84" width="60" height="44" rx="6" fill="#1a0505"/>
  <rect x="78" y="94" width="16" height="8" fill="#ff5c5c"/><rect x="106" y="94" width="16" height="8" fill="#ff5c5c"/>
  <text x="100" y="122" text-anchor="middle" font-size="12" fill="#ffb3b3" font-family="monospace" font-weight="bold">500</text>
  <path d="M80 70 L80 50 Q100 30 120 50 L120 70 Z" fill="url(#pt-siren)" stroke="#7a1a1a" stroke-width="3"/>
  <path class="dragon-fire" d="M60 46 L40 30 M140 46 L160 30 M100 26 L100 4" stroke="#ff5c5c" stroke-width="4" stroke-linecap="round"/>
  <text x="100" y="170" text-anchor="middle" font-size="9" fill="#ffd0d0" font-family="monospace">P0 · all hands on deck</text>`,
];

// Later rosters are assembled from parts: a body shape, eyes, a mouth, and a
// few lines of monster-specific flavor (props, labels).
const SHAPES = {
  blob: (g) => `<path d="M34 176 Q24 104 66 70 Q100 44 134 70 Q176 104 166 176 Q100 190 34 176 Z" fill="url(#${g})" stroke="currentColor" stroke-width="3"/>`,
  ghost: (g) => `<path d="M48 172 Q42 78 100 48 Q158 78 152 172 L138 160 L124 174 L112 160 L100 174 L88 160 L76 174 L62 160 Z" fill="url(#${g})" stroke="currentColor" stroke-width="3"/>`,
  golem: (g) => `<rect x="54" y="92" width="92" height="64" rx="8" fill="url(#${g})" stroke="currentColor" stroke-width="3"/><rect x="66" y="44" width="68" height="50" rx="8" fill="url(#${g})" stroke="currentColor" stroke-width="3"/><rect x="24" y="96" width="28" height="48" rx="6" fill="url(#${g})" stroke="currentColor" stroke-width="3"/><rect x="148" y="96" width="28" height="48" rx="6" fill="url(#${g})" stroke="currentColor" stroke-width="3"/><rect x="64" y="154" width="26" height="30" rx="4" fill="url(#${g})" stroke="currentColor" stroke-width="3"/><rect x="110" y="154" width="26" height="30" rx="4" fill="url(#${g})" stroke="currentColor" stroke-width="3"/>`,
  orb: (g) => `<circle cx="100" cy="108" r="64" fill="url(#${g})" stroke="currentColor" stroke-width="3"/>`,
  beast: (g) => `<path d="M40 70 L28 30 L70 58 Z M160 70 L172 30 L130 58 Z" fill="url(#${g})" stroke="currentColor" stroke-width="3"/><path d="M50 150 Q100 120 150 150 L144 184 L56 184 Z" fill="url(#${g})" stroke="currentColor" stroke-width="3"/><circle cx="100" cy="96" r="56" fill="url(#${g})" stroke="currentColor" stroke-width="3"/>`,
  bat: (g) => `<path d="M100 96 Q60 50 10 70 Q30 90 24 118 Q50 100 70 124 Q80 104 100 120 Q120 104 130 124 Q150 100 176 118 Q170 90 190 70 Q140 50 100 96 Z" fill="url(#${g})" stroke="currentColor" stroke-width="3"/><circle cx="100" cy="108" r="36" fill="url(#${g})" stroke="currentColor" stroke-width="3"/>`,
  knight: (g) => `<path d="M58 184 L64 126 L136 126 L142 184 Z" fill="url(#${g})" stroke="currentColor" stroke-width="3"/><path d="M58 128 Q54 54 100 40 Q146 54 142 128 Z" fill="url(#${g})" stroke="currentColor" stroke-width="3"/><rect x="66" y="84" width="68" height="12" rx="3" fill="#10131a"/>`,
  titan: (g) => `<path d="M56 188 L64 146 L136 146 L144 188 Z" fill="url(#${g})" stroke="currentColor" stroke-width="3"/><path d="M38 150 Q28 86 60 66 L140 66 Q172 86 162 150 Z" fill="url(#${g})" stroke="currentColor" stroke-width="3"/><path d="M38 94 Q8 110 14 152 L32 152 Q30 118 46 106 Z M162 94 Q192 110 186 152 L168 152 Q170 118 154 106 Z" fill="url(#${g})" stroke="currentColor" stroke-width="3"/>`,
};
const EYES = {
  round: (y, c) => `<circle cx="80" cy="${y}" r="12" fill="#fff"/><circle cx="83" cy="${y + 2}" r="5.5" fill="${c}"/><circle cx="120" cy="${y}" r="12" fill="#fff"/><circle cx="117" cy="${y + 2}" r="5.5" fill="${c}"/>`,
  angry: (y, c) => `<path d="M66 ${y - 12} L92 ${y - 4} M134 ${y - 12} L108 ${y - 4}" stroke="${c}" stroke-width="5" stroke-linecap="round"/><ellipse cx="80" cy="${y + 2}" rx="10" ry="7" fill="#ffe36b"/><ellipse cx="120" cy="${y + 2}" rx="10" ry="7" fill="#ffe36b"/><circle cx="80" cy="${y + 2}" r="3.5" fill="${c}"/><circle cx="120" cy="${y + 2}" r="3.5" fill="${c}"/>`,
  sleepy: (y, c) => `<path d="M68 ${y} Q80 ${y + 8} 92 ${y} M108 ${y} Q120 ${y + 8} 132 ${y}" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  x: (y, c) => `<path d="M72 ${y - 8} l16 16 m0 -16 l-16 16 M112 ${y - 8} l16 16 m0 -16 l-16 16" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`,
  glow: (y, c) => `<rect x="70" y="${y - 5}" width="20" height="10" rx="2" fill="${c}"/><rect x="110" y="${y - 5}" width="20" height="10" rx="2" fill="${c}"/>`,
  many: (y, c) => [70, 90, 110, 130].map((x, i) => `<circle cx="${x}" cy="${y + (i % 2 ? -6 : 4)}" r="6" fill="${c}"/>`).join(''),
};
const MOUTHS = {
  grin: (y, c) => `<path d="M76 ${y} Q100 ${y + 22} 124 ${y}" stroke="${c}" stroke-width="4" fill="${c}"/><path d="M84 ${y + 3} l5 7 l5 -6 l5 7 l5 -6 l5 7 l5 -7" stroke="#fffbe6" stroke-width="2" fill="none"/>`,
  frown: (y, c) => `<path d="M84 ${y + 8} Q100 ${y - 2} 116 ${y + 8}" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  o: (y, c) => `<ellipse cx="100" cy="${y + 4}" rx="9" ry="7" fill="${c}"/>`,
  flat: (y, c) => `<path d="M84 ${y + 4} H116" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`,
  fangs: (y, c) => `<path d="M80 ${y} Q100 ${y + 14} 120 ${y}" stroke="${c}" stroke-width="4" fill="none"/><path d="M86 ${y + 3} l3 10 l3 -9 M108 ${y + 3} l3 10 l3 -9" fill="#fff" stroke="#fff" stroke-width="1.5"/>`,
};
const tag = (x, y, w, text, bg, fg, size = 9) =>
  `<rect x="${x - w / 2}" y="${y - 11}" width="${w}" height="16" rx="3" fill="${bg}"/><text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="${fg}" font-family="monospace" font-weight="bold">${text}</text>`;

function build(id, { shape, light, dark, line, eyes = 'round', eyeY = 104, eyeColor = '#12151c', mouth = 'frown', mouthY = 138, back = '', front = '' }) {
  return `<defs><radialGradient id="${id}" cx="40%" cy="32%" r="75%"><stop offset="0%" stop-color="${light}"/><stop offset="100%" stop-color="${dark}"/></radialGradient></defs>
  <ellipse cx="100" cy="188" rx="62" ry="8" fill="#000" opacity=".35"/>
  ${back}<g color="${line}">${SHAPES[shape](id)}</g>
  ${EYES[eyes](eyeY, eyeColor)}${MOUTHS[mouth](mouthY, eyeColor)}${front}`;
}

MONSTERS.push(
  // 12: 세미콜론 요정
  build('m12', { shape: 'orb', light: '#fff3b0', dark: '#d9a520', line: '#7a5a10', eyes: 'round', mouth: 'o', back: '<path d="M60 70 Q20 30 30 90 Q44 80 62 96 Z M140 70 Q180 30 170 90 Q156 80 138 96 Z" fill="#e9f6ff" opacity=".8" stroke="#9ab" stroke-width="2"/>', front: '<text x="100" y="186" text-anchor="middle" font-size="40" fill="#7a5a10" font-family="monospace" font-weight="bold">;</text>' }),
  // 13: 인덴트 트롤
  build('m13', { shape: 'beast', light: '#9fb58a', dark: '#46583a', line: '#243019', eyes: 'angry', mouth: 'fangs', mouthY: 122, eyeY: 92, front: tag(100, 172, 96, '→ tab / ␣␣ space', '#243019', '#d7f0b8', 8) }),
  // 14: 매직 넘버 박쥐
  build('m14', { shape: 'bat', light: '#8a7bd1', dark: '#2c2356', line: '#17112e', eyes: 'glow', eyeColor: '#ffea6b', mouth: 'fangs', eyeY: 102, mouthY: 118, front: '<text x="100" y="60" text-anchor="middle" font-size="16" fill="#ffea6b" font-family="monospace" font-weight="bold">42 · 86400 · 0x7F</text>' }),
  // 15: 데드락 쌍둥이 기사
  build('m15', { shape: 'knight', light: '#c5ccd8', dark: '#56607a', line: '#262c3a', eyes: 'glow', eyeColor: '#ff6b6b', eyeY: 90, mouth: 'flat', mouthY: 112, back: '<path d="M10 140 L60 100 M190 140 L140 100" stroke="#8a93a8" stroke-width="7" stroke-linecap="round"/>', front: '<circle cx="100" cy="156" r="12" fill="none" stroke="#ebcb8b" stroke-width="4"/><rect x="92" y="156" width="16" height="14" rx="2" fill="#ebcb8b"/><text x="100" y="30" text-anchor="middle" font-size="10" fill="#ff9b9b" font-family="monospace">waiting for lock…</text>' }),
  // 16: SQL 인젝션 뱀파이어
  build('m16', { shape: 'beast', light: '#e8e0f0', dark: '#8f7fa8', line: '#2a1f38', eyes: 'angry', eyeColor: '#7a0f1f', mouth: 'fangs', eyeY: 92, mouthY: 120, back: '<path d="M30 190 Q20 110 60 96 L100 150 L140 96 Q180 110 170 190 Z" fill="#3a0f1f" stroke="#1a0510" stroke-width="3"/>', front: tag(100, 172, 150, "'; DR" + "OP TABLE users;--", '#1a0510', '#ff8fa3', 8) }),
  // 17: 모놀리스 거인 (boss)
  build('m17', { shape: 'titan', light: '#9aa5b8', dark: '#2f3645', line: '#151922', eyes: 'glow', eyeColor: '#7fdcff', eyeY: 92, mouth: 'flat', mouthY: 118, front: tag(100, 140, 88, 'app.js 48,000줄', '#151922', '#7fdcff', 8) + '<path d="M70 70 V40 H130 V70" fill="none" stroke="#151922" stroke-width="4"/>' }),

  // 18: 오프바이원 도깨비
  build('m18', { shape: 'beast', light: '#ff9e7a', dark: '#b3401f', line: '#5a1a08', eyes: 'round', mouth: 'grin', eyeY: 92, mouthY: 118, back: '<path d="M92 40 L100 8 L108 40 Z" fill="#ffe3a0" stroke="#5a1a08" stroke-width="3"/>', front: tag(100, 174, 100, 'for (i &lt;= len)', '#5a1a08', '#ffd0b8', 8) }),
  // 19: 시간대 버그 시계괴물
  build('m19', { shape: 'orb', light: '#fdf6e3', dark: '#b8a878', line: '#4a4028', eyes: 'x', eyeColor: '#4a4028', mouth: 'o', eyeY: 96, mouthY: 136, back: '<path d="M100 44 V24 M100 172 V192 M36 108 H16 M164 108 H184" stroke="#4a4028" stroke-width="5"/>', front: '<path d="M100 108 L100 76 M100 108 L124 120" stroke="#bf616a" stroke-width="4" stroke-linecap="round"/>' + tag(100, 196, 96, 'UTC+9 ≠ UTC', '#4a4028', '#fdf6e3', 8) }),
  // 20: 부동소수점 유령
  build('m20', { shape: 'ghost', light: '#e8f7ff', dark: '#7aa7c7', line: '#35526b', eyes: 'round', mouth: 'o', eyeY: 100, mouthY: 130, front: tag(100, 36, 150, '0.1 + 0.2 = 0.30000000000000004', '#35526b', '#e8f7ff', 7) }),
  // 21: 정규식 미궁 미노타우로스
  build('m21', { shape: 'beast', light: '#c99a6b', dark: '#5e3a1a', line: '#2c1a08', eyes: 'angry', mouth: 'flat', eyeY: 94, mouthY: 122, back: '<path d="M44 66 Q14 40 20 14 Q40 36 62 50 Z M156 66 Q186 40 180 14 Q160 36 138 50 Z" fill="#e8dcc0" stroke="#2c1a08" stroke-width="3"/>', front: '<ellipse cx="100" cy="126" rx="18" ry="10" fill="#8a5a30"/><circle cx="92" cy="126" r="3" fill="#2c1a08"/><circle cx="108" cy="126" r="3" fill="#2c1a08"/>' + tag(100, 176, 110, '^(a+)+$', '#2c1a08', '#ffd79a') }),
  // 22: 좀비 프로세스
  build('m22', { shape: 'golem', light: '#a8c49a', dark: '#4d6644', line: '#1f2a1b', eyes: 'x', eyeColor: '#1f2a1b', mouth: 'frown', eyeY: 68, mouthY: 80, front: tag(100, 126, 72, 'PID &lt;defunct&gt;', '#1f2a1b', '#c8f0b0', 8) + '<path d="M40 144 l-6 12 M160 144 l6 12" stroke="#4d6644" stroke-width="4"/>' }),
  // 23: 기술부채 리치 (boss)
  build('m23', { shape: 'titan', light: '#b48ead', dark: '#3a1f40', line: '#1a0b1f', eyes: 'glow', eyeColor: '#a3ff8a', eyeY: 92, mouth: 'fangs', mouthY: 118, back: '<path d="M60 66 L70 30 L84 58 L100 22 L116 58 L130 30 L140 66 Z" fill="#ebcb8b" stroke="#6b4a1a" stroke-width="3"/>', front: tag(100, 140, 104, '이자: 매 스프린트', '#1a0b1f', '#a3ff8a', 8) }),

  // 24: 404 도둑 고양이
  build('m24', { shape: 'beast', light: '#6b6f7a', dark: '#23252b', line: '#0e0f12', eyes: 'glow', eyeColor: '#ffd54a', mouth: 'grin', eyeY: 92, mouthY: 116, back: '<path d="M150 170 Q196 150 176 110" stroke="#23252b" stroke-width="10" fill="none" stroke-linecap="round"/>', front: '<rect x="70" y="60" width="60" height="10" rx="3" fill="#0e0f12"/>' + tag(100, 172, 70, '404', '#bf616a', '#fff', 12) }),
  // 25: CORS 문지기
  build('m25', { shape: 'knight', light: '#8fbcbb', dark: '#2e5654', line: '#132928', eyes: 'glow', eyeColor: '#ebcb8b', eyeY: 90, mouth: 'flat', mouthY: 112, back: '<rect x="150" y="30" width="8" height="150" fill="#6b5a3a"/><path d="M144 30 L164 30 L154 6 Z" fill="#d8dee9"/>', front: tag(100, 160, 150, 'No Access-Control-Allow-Origin', '#132928', '#ebcb8b', 7) }),
  // 26: 인코딩 깨짐 모지바케
  build('m26', { shape: 'blob', light: '#f5a3c7', dark: '#9c3a6a', line: '#4a0f2c', eyes: 'many', eyeColor: '#2a0718', mouth: 'o', eyeY: 108, mouthY: 136, front: '<text x="100" y="60" text-anchor="middle" font-size="16" fill="#fff" font-family="monospace">ì•ˆë…• ???</text>' }),
  // 27: 플래키 테스트 카멜레온
  build('m27', { shape: 'blob', light: '#b8f28a', dark: '#3f8f5a', line: '#16391f', eyes: 'round', mouth: 'grin', eyeY: 102, mouthY: 132, back: '<path d="M160 150 Q196 160 188 120 Q176 104 164 120" stroke="#3f8f5a" stroke-width="10" fill="none" stroke-linecap="round"/>', front: tag(70, 60, 50, 'PASS', '#2e7d32', '#fff') + tag(130, 60, 50, 'FAIL', '#bf616a', '#fff') }),
  // 28: 핫픽스 폭탄병
  build('m28', { shape: 'orb', light: '#5e6b80', dark: '#1a1f29', line: '#0b0d12', eyes: 'angry', eyeColor: '#0b0d12', mouth: 'grin', eyeY: 102, mouthY: 130, back: '<path d="M140 52 Q156 30 172 34" stroke="#8a6d2b" stroke-width="5" fill="none"/><circle class="dragon-fire" cx="176" cy="32" r="8" fill="#ffb347"/>', front: tag(100, 176, 110, 'git push -f main', '#0b0d12', '#ffb347', 8) }),
  // 29: AI 환각 키메라 (boss)
  build('m29', { shape: 'titan', light: '#a0d8ff', dark: '#3b2a78', line: '#140c33', eyes: 'many', eyeColor: '#fff36b', eyeY: 96, mouth: 'fangs', mouthY: 122, back: '<path d="M38 70 Q10 30 44 20 Q52 50 70 60 Z M162 70 Q190 30 156 20 Q148 50 130 60 Z" fill="#ff8fd0" stroke="#140c33" stroke-width="3"/>', front: tag(100, 146, 128, '출처: 제가 방금 지어냄', '#140c33', '#fff36b', 8) }),

  // 30-35: 고대 신전 (adventure only)
  build('m30', { shape: 'ghost', light: '#efe6cf', dark: '#a8966a', line: '#4a3f24', eyes: 'x', eyeColor: '#4a3f24', mouth: 'flat', eyeY: 98, mouthY: 126, front: '<path d="M52 80 L148 110 M50 120 L150 90 M56 150 L146 140" stroke="#cdbb8e" stroke-width="7" opacity=".9"/>' + tag(100, 40, 70, '/* TODO */', '#4a3f24', '#efe6cf') }),
  build('m31', { shape: 'golem', light: '#c9c3b6', dark: '#6e6757', line: '#2e2a22', eyes: 'sleepy', eyeColor: '#2e2a22', mouth: 'flat', eyeY: 66, mouthY: 78, front: tag(100, 126, 84, '@deprecated', '#2e2a22', '#ebcb8b') + '<path d="M70 104 l8 10 M122 110 l6 12" stroke="#2e2a22" stroke-width="2"/>' }),
  build('m32', { shape: 'ghost', light: '#e0ecff', dark: '#6f7fa8', line: '#2c3552', eyes: 'round', mouth: 'o', eyeY: 98, mouthY: 128, back: '<rect x="138" y="118" width="40" height="52" rx="3" fill="#8a6d4a" stroke="#3b2a18" stroke-width="3"/><path d="M146 132 H170 M146 142 H170 M146 152 H164" stroke="#efe6cf" stroke-width="2"/>', front: tag(100, 40, 60, 'v0.1', '#2c3552', '#e0ecff') }),
  build('m33', { shape: 'golem', light: '#a3d0c9', dark: '#3f6d66', line: '#1c3330', eyes: 'glow', eyeColor: '#ffe36b', mouth: 'flat', eyeY: 66, mouthY: 80, front: '<text x="100" y="116" text-anchor="middle" font-size="9" fill="#1c3330" font-family="monospace">key:</text><text x="104" y="128" text-anchor="middle" font-size="9" fill="#1c3330" font-family="monospace">  - value:</text><text x="108" y="140" text-anchor="middle" font-size="9" fill="#1c3330" font-family="monospace">    - ???</text>' }),
  build('m34', { shape: 'bat', light: '#9aa0b0', dark: '#343846', line: '#15171e', eyes: 'glow', eyeColor: '#a3be8c', mouth: 'fangs', eyeY: 102, mouthY: 118, front: tag(100, 60, 80, '* * * * *', '#15171e', '#a3be8c', 10) }),
  build('m35', { shape: 'titan', light: '#e8d6a0', dark: '#7a5f24', line: '#3a2a0a', eyes: 'glow', eyeColor: '#fff6c8', eyeY: 92, mouth: 'flat', mouthY: 118, back: '<circle cx="100" cy="58" r="40" fill="none" stroke="#ebcb8b" stroke-width="3" opacity=".7"/>', front: tag(100, 140, 110, 'final_final_v2.zip', '#3a2a0a', '#fff6c8', 8) }),

  // 36-41: 마왕군 (demon-king only)
  build('m36', { shape: 'beast', light: '#e5e2da', dark: '#8a857a', line: '#2a2824', eyes: 'x', eyeColor: '#bf616a', mouth: 'grin', eyeY: 92, mouthY: 116, back: '<g opacity=".45"><circle cx="40" cy="120" r="26" fill="#e5e2da"/><circle cx="160" cy="120" r="26" fill="#e5e2da"/></g>', front: tag(100, 172, 90, 'x10,000 req/s', '#2a2824', '#ff9b9b', 8) }),
  build('m37', { shape: 'knight', light: '#5a5f6b', dark: '#1d2027', line: '#0b0c10', eyes: 'glow', eyeColor: '#ff5c5c', eyeY: 90, mouth: 'flat', mouthY: 112, front: '<rect x="84" y="140" width="32" height="26" rx="3" fill="#ebcb8b"/><path d="M90 140 V130 Q100 118 110 130 V140" fill="none" stroke="#ebcb8b" stroke-width="4"/>' + tag(100, 184, 90, '₿ 입금하시오', '#0b0c10', '#ebcb8b', 8) }),
  build('m38', { shape: 'ghost', light: '#3b3f4d', dark: '#0f1117', line: '#000', eyes: 'angry', eyeColor: '#0b0c10', mouth: 'flat', eyeY: 100, mouthY: 126, back: '<path d="M160 60 L190 150" stroke="#d8dee9" stroke-width="4"/><path d="M186 146 l8 16 l-14 -6 Z" fill="#d8dee9"/>', front: tag(100, 40, 60, '0-day', '#bf616a', '#fff') }),
  build('m39', { shape: 'beast', light: '#7b5fb0', dark: '#2a1c4a', line: '#120b24', eyes: 'glow', eyeColor: '#a3ff8a', mouth: 'grin', eyeY: 92, mouthY: 116, back: '<path d="M60 44 L100 0 L140 44 Z" fill="#4c3580" stroke="#120b24" stroke-width="3"/>', front: '<rect x="138" y="130" width="34" height="50" rx="3" fill="#6b4a2a" stroke="#2a1a0a" stroke-width="3"/><circle cx="164" cy="156" r="3" fill="#ebcb8b"/>' }),
  build('m40', { shape: 'titan', light: '#5f7a5a', dark: '#1f2e1c', line: '#0c140b', eyes: 'many', eyeColor: '#ffea6b', eyeY: 94, mouth: 'fangs', mouthY: 120, back: '<g fill="#a3be8c" opacity=".6"><circle cx="20" cy="40" r="4"/><circle cx="40" cy="24" r="4"/><circle cx="180" cy="40" r="4"/><circle cx="160" cy="22" r="4"/><circle cx="100" cy="14" r="4"/></g>', front: tag(100, 142, 70, '1000 bots', '#0c140b', '#a3be8c', 8) }),
  build('m41', { shape: 'titan', light: '#6b2a3a', dark: '#1a060c', line: '#000', eyes: 'glow', eyeColor: '#ff3b3b', eyeY: 92, mouth: 'fangs', mouthY: 118, back: '<path d="M56 70 L40 20 L76 56 M144 70 L160 20 L124 56" stroke="#2a0a12" stroke-width="10" stroke-linecap="round"/>', front: tag(100, 142, 70, 'uid=0', '#000', '#ff3b3b', 10) }),

  // 42-47: 벌레 굴 (debug-quest only)
  build('m42', { shape: 'bat', light: '#d8c8a8', dark: '#7a6848', line: '#2e2618', eyes: 'round', mouth: 'o', eyeY: 104, mouthY: 118, back: '<g opacity=".35"><circle cx="40" cy="80" r="10" fill="#d8c8a8"/><circle cx="160" cy="80" r="10" fill="#d8c8a8"/></g>', front: tag(100, 170, 100, '(보면 사라짐)', '#2e2618', '#d8c8a8', 8) }),
  build('m43', { shape: 'blob', light: '#c26a6a', dark: '#5a1a1a', line: '#240808', eyes: 'sleepy', eyeColor: '#240808', mouth: 'fangs', eyeY: 108, mouthY: 132, front: tag(100, 60, 90, '0xDEADBEEF', '#240808', '#ffb3b3', 9) }),
  build('m44', { shape: 'orb', light: '#4a8f8a', dark: '#12302e', line: '#061413', eyes: 'angry', eyeColor: '#061413', mouth: 'frown', eyeY: 100, mouthY: 132, back: '<path d="M40 150 l-20 20 M160 150 l20 20 M50 170 l-14 24 M150 170 l14 24" stroke="#061413" stroke-width="5" stroke-linecap="round"/><path d="M100 44 V172" stroke="#061413" stroke-width="3"/>', front: tag(100, 186, 70, 'SIGSEGV', '#bf616a', '#fff') }),
  build('m45', { shape: 'orb', light: '#b35a3a', dark: '#4a1e10', line: '#1e0a04', eyes: 'round', mouth: 'grin', eyeY: 100, mouthY: 128, back: '<g fill="#4a1e10"><circle cx="30" cy="160" r="12"/><circle cx="170" cy="160" r="12"/><circle cx="24" cy="120" r="9"/><circle cx="176" cy="120" r="9"/></g>', front: tag(100, 40, 110, 'thread 1 ⇄ thread 2', '#1e0a04', '#ffb38a', 8) }),
  build('m46', { shape: 'blob', light: '#9bc46a', dark: '#3a5a1a', line: '#16240a', eyes: 'x', eyeColor: '#16240a', mouth: 'o', eyeY: 108, mouthY: 136, back: '<g fill="none" stroke="#3a5a1a" stroke-width="6"><circle cx="30" cy="150" r="12"/><circle cx="170" cy="150" r="12"/><circle cx="20" cy="112" r="10"/><circle cx="180" cy="112" r="10"/></g>', front: tag(100, 60, 80, 'f(f(f(f(', '#16240a', '#d7f0b8', 10) }),
  build('m47', { shape: 'titan', light: '#d97aa8', dark: '#5a1a3c', line: '#240818', eyes: 'many', eyeColor: '#fff36b', eyeY: 94, mouth: 'fangs', mouthY: 120, back: '<path d="M60 66 L70 30 L84 58 L100 22 L116 58 L130 30 L140 66 Z" fill="#ebcb8b" stroke="#6b4a1a" stroke-width="3"/>', front: tag(100, 142, 110, 'bugs x999 · D-1', '#240818', '#fff36b', 8) }),
  // 48-53: 클라우드 상공
  build('m48', { shape: 'orb', light: '#dff3ff', dark: '#6aa7d8', line: '#244a6b', eyes: 'sleepy', eyeColor: '#244a6b', mouth: 'o', eyeY: 102, mouthY: 132, front: tag(100, 186, 121, '3.2s cold start', '#244a6b', '#dff3ff', 8) }),
  build('m49', { shape: 'blob', light: '#c8f7c5', dark: '#3f9a5a', line: '#174a26', eyes: 'round', eyeColor: '#174a26', mouth: 'grin', eyeY: 102, mouthY: 132, front: tag(100, 60, 107, 'replicas: 1→∞', '#174a26', '#c8f7c5', 8) }),
  build('m50', { shape: 'ghost', light: '#fff4d6', dark: '#c9a24a', line: '#5a4410', eyes: 'angry', eyeColor: '#5a4410', mouth: 'grin', eyeY: 102, mouthY: 132, front: tag(100, 40, 86, '$48,210.00', '#5a4410', '#fff4d6', 8) }),
  build('m51', { shape: 'beast', light: '#8fb8e8', dark: '#2a4f80', line: '#10223a', eyes: 'many', eyeColor: '#10223a', mouth: 'fangs', eyeY: 92, mouthY: 118, front: tag(100, 172, 128, 'CrashLoopBackOff', '#10223a', '#8fb8e8', 8) }),
  build('m52', { shape: 'orb', light: '#c7d2ff', dark: '#4b4fa8', line: '#1a1c4a', eyes: 'glow', eyeColor: '#1a1c4a', mouth: 'flat', eyeY: 102, mouthY: 132, front: tag(100, 186, 114, 'us-east-1 DOWN', '#1a1c4a', '#c7d2ff', 8) }),
  build('m53', { shape: 'titan', light: '#b8c8ff', dark: '#2c2f7a', line: '#0c0e30', eyes: 'glow', eyeColor: '#0c0e30', mouth: 'fangs', eyeY: 94, mouthY: 120, front: tag(100, 142, 135, 'AWS · GCP · Azure', '#0c0e30', '#b8c8ff', 8) }),

  // 54-59: 데이터 심해
  build('m54', { shape: 'ghost', light: '#e0f7ff', dark: '#5ab0d0', line: '#1a4a5a', eyes: 'round', eyeColor: '#1a4a5a', mouth: 'o', eyeY: 102, mouthY: 132, front: tag(100, 40, 93, 'id,,name,,,', '#1a4a5a', '#e0f7ff', 8) }),
  build('m55', { shape: 'beast', light: '#e8a0c8', dark: '#8a2a5a', line: '#3a0a24', eyes: 'angry', eyeColor: '#3a0a24', mouth: 'grin', eyeY: 92, mouthY: 118, front: tag(100, 172, 114, 'SELECT … ×1001', '#3a0a24', '#e8a0c8', 8) }),
  build('m56', { shape: 'golem', light: '#b8c8a0', dark: '#5a6a3a', line: '#232a14', eyes: 'sleepy', eyeColor: '#232a14', mouth: 'flat', eyeY: 66, mouthY: 80, front: tag(100, 126, 121, 'FULL TABLE SCAN', '#232a14', '#b8c8a0', 8) }),
  build('m57', { shape: 'beast', light: '#c8a078', dark: '#6a4222', line: '#2a1608', eyes: 'angry', eyeColor: '#2a1608', mouth: 'grin', eyeY: 92, mouthY: 118, front: tag(100, 172, 121, 'cache miss ×10k', '#2a1608', '#c8a078', 8) }),
  build('m58', { shape: 'beast', light: '#d8c0a0', dark: '#7a5a3a', line: '#30200e', eyes: 'round', eyeColor: '#30200e', mouth: 'grin', eyeY: 92, mouthY: 118, front: tag(100, 172, 114, '{ \"any\": ??? }', '#30200e', '#d8c0a0', 8) }),
  build('m59', { shape: 'titan', light: '#6ab0c8', dark: '#0e3a4a', line: '#04161c', eyes: 'many', eyeColor: '#04161c', mouth: 'fangs', eyeY: 94, mouthY: 120, front: tag(100, 142, 107, '3PB · 아무도 안 봄', '#04161c', '#6ab0c8', 8) }),

  // 60-65: 프론트엔드 도시
  build('m60', { shape: 'ghost', light: '#f0e6ff', dark: '#9a7ad0', line: '#3a2a5a', eyes: 'round', eyeColor: '#3a2a5a', mouth: 'frown', eyeY: 102, mouthY: 132, front: tag(100, 40, 142, 'margin: 0 auto ???', '#3a2a5a', '#f0e6ff', 8) }),
  build('m61', { shape: 'golem', light: '#e0e0e8', dark: '#6a6a7a', line: '#2a2a34', eyes: 'glow', eyeColor: '#2a2a34', mouth: 'flat', eyeY: 66, mouthY: 80, front: tag(100, 126, 107, 'z-index: 9999', '#2a2a34', '#e0e0e8', 8) }),
  build('m62', { shape: 'orb', light: '#ffd8a8', dark: '#c8823a', line: '#5a3410', eyes: 'round', eyeColor: '#5a3410', mouth: 'grin', eyeY: 102, mouthY: 132, front: tag(100, 186, 79, 'render ×∞', '#5a3410', '#ffd8a8', 8) }),
  build('m63', { shape: 'blob', light: '#b8d08a', dark: '#5a7a2a', line: '#243410', eyes: 'angry', eyeColor: '#243410', mouth: 'fangs', eyeY: 102, mouthY: 132, front: tag(100, 60, 114, 'bundle.js 14MB', '#243410', '#b8d08a', 8) }),
  build('m64', { shape: 'ghost', light: '#e8e8f0', dark: '#7a7a9a', line: '#2a2a40', eyes: 'x', eyeColor: '#2a2a40', mouth: 'flat', eyeY: 102, mouthY: 132, front: tag(100, 40, 121, 'server ≠ client', '#2a2a40', '#e8e8f0', 8) }),
  build('m65', { shape: 'orb', light: '#3a3050', dark: '#0a0612', line: '#000', eyes: 'glow', eyeColor: '#000', mouth: 'flat', eyeY: 102, mouthY: 132, front: tag(100, 186, 170, '1.2GB · 1,284 packages', '#000', '#3a3050', 8) }),

  // 66-71: 잊힌 해적섬
  build('m66', { shape: 'beast', light: '#d8a070', dark: '#6a3a1a', line: '#2a1406', eyes: 'angry', eyeColor: '#2a1406', mouth: 'grin', eyeY: 92, mouthY: 118, front: tag(100, 172, 107, 'git rebase -i', '#2a1406', '#d8a070', 8) }),
  build('m67', { shape: 'bat', light: '#ff9a8a', dark: '#c83a2a', line: '#5a1208', eyes: 'round', eyeColor: '#5a1208', mouth: 'o', eyeY: 104, mouthY: 118, front: tag(100, 60, 142, 'cherry-pick a1b2c3', '#5a1208', '#ff9a8a', 8) }),
  build('m68', { shape: 'golem', light: '#c8a050', dark: '#6a4a10', line: '#2a1c04', eyes: 'glow', eyeColor: '#2a1c04', mouth: 'fangs', eyeY: 66, mouthY: 80, front: tag(100, 126, 79, 'stash@{7}', '#2a1c04', '#c8a050', 8) }),
  build('m69', { shape: 'ghost', light: '#c8e0e8', dark: '#4a7a8a', line: '#1a303a', eyes: 'x', eyeColor: '#1a303a', mouth: 'flat', eyeY: 102, mouthY: 132, front: tag(100, 40, 177, 'HEAD detached at 3f2a1c', '#1a303a', '#c8e0e8', 8) }),
  build('m70', { shape: 'beast', light: '#8ac8b0', dark: '#2a6a5a', line: '#0a2a22', eyes: 'many', eyeColor: '#0a2a22', mouth: 'fangs', eyeY: 92, mouthY: 118, front: tag(100, 172, 177, 'submodule update --init', '#0a2a22', '#8ac8b0', 8) }),
  build('m71', { shape: 'titan', light: '#c86a4a', dark: '#5a1a0a', line: '#200604', eyes: 'angry', eyeColor: '#200604', mouth: 'fangs', eyeY: 94, mouthY: 120, front: tag(100, 142, 128, 'git push --force', '#200604', '#c86a4a', 8) }),

  // 72-77: 하늘섬 도서관
  build('m72', { shape: 'bat', light: '#4a4a5a', dark: '#16161e', line: '#000', eyes: 'glow', eyeColor: '#000', mouth: 'o', eyeY: 104, mouthY: 118, front: tag(100, 60, 121, 'Ctrl+C · Ctrl+V', '#000', '#4a4a5a', 8) }),
  build('m73', { shape: 'blob', light: '#f0d8a0', dark: '#a07a2a', line: '#3a2a08', eyes: 'sleepy', eyeColor: '#3a2a08', mouth: 'frown', eyeY: 102, mouthY: 132, front: tag(100, 60, 86, 'Todo 앱 #47', '#3a2a08', '#f0d8a0', 8) }),
  build('m74', { shape: 'golem', light: '#c0c8d8', dark: '#5a6278', line: '#232838', eyes: 'x', eyeColor: '#232838', mouth: 'flat', eyeY: 66, mouthY: 80, front: tag(100, 126, 163, 'example: v2 · lib: v5', '#232838', '#c0c8d8', 8) }),
  build('m75', { shape: 'orb', light: '#fff0a0', dark: '#c8a01a', line: '#4a3a04', eyes: 'many', eyeColor: '#4a3a04', mouth: 'grin', eyeY: 102, mouthY: 132, front: tag(100, 186, 114, '1,842 warnings', '#4a3a04', '#fff0a0', 8) }),
  build('m76', { shape: 'beast', light: '#e8d0a0', dark: '#8a6a3a', line: '#34240c', eyes: 'glow', eyeColor: '#34240c', mouth: 'flat', eyeY: 92, mouthY: 118, front: tag(100, 172, 114, 'PR #812: \"fix\"', '#34240c', '#e8d0a0', 8) }),
  build('m77', { shape: 'titan', light: '#e0e8ff', dark: '#5a6aa8', line: '#1a2248', eyes: 'many', eyeColor: '#1a2248', mouth: 'flat', eyeY: 94, mouthY: 120, front: tag(100, 142, 79, 'nit: ×248', '#1a2248', '#e0e8ff', 8) }),

  // 78-83: 마왕군 정예
  build('m78', { shape: 'bat', light: '#ff9ab0', dark: '#c8325a', line: '#50081e', eyes: 'angry', eyeColor: '#50081e', mouth: 'grin', eyeY: 104, mouthY: 118, front: tag(100, 60, 100, '[광고] 축하합니다!!', '#50081e', '#ff9ab0', 8) }),
  build('m79', { shape: 'ghost', light: '#a8e0f0', dark: '#3a8aa8', line: '#10303a', eyes: 'glow', eyeColor: '#10303a', mouth: 'grin', eyeY: 102, mouthY: 132, front: tag(100, 40, 128, 'paypa1.com/login', '#10303a', '#a8e0f0', 8) }),
  build('m80', { shape: 'beast', light: '#b0a0d0', dark: '#4a3a78', line: '#1a1230', eyes: 'angry', eyeColor: '#1a1230', mouth: 'fangs', eyeY: 92, mouthY: 118, front: tag(100, 172, 135, 'CPU 100% · mining', '#1a1230', '#b0a0d0', 8) }),
  build('m81', { shape: 'ghost', light: '#4a4a58', dark: '#12121a', line: '#000', eyes: 'glow', eyeColor: '#000', mouth: 'flat', eyeY: 102, mouthY: 132, front: tag(100, 40, 142, 'keystrokes: 48,221', '#000', '#4a4a58', 8) }),
  build('m82', { shape: 'blob', light: '#d0c0e8', dark: '#6a4aa8', line: '#261844', eyes: 'round', eyeColor: '#261844', mouth: 'grin', eyeY: 102, mouthY: 132, front: tag(100, 60, 142, '\"I am not a robot\"', '#261844', '#d0c0e8', 8) }),
  build('m83', { shape: 'titan', light: '#6a3a5a', dark: '#1a0612', line: '#000', eyes: 'glow', eyeColor: '#000', mouth: 'fangs', eyeY: 94, mouthY: 120, front: tag(100, 142, 121, '.onion · 뭐든 팝니다', '#000', '#6a3a5a', 8) }),

  // 84-89: 마계 서버실
  build('m84', { shape: 'orb', light: '#ffc070', dark: '#c83a0a', line: '#4a0e00', eyes: 'angry', eyeColor: '#4a0e00', mouth: 'grin', eyeY: 102, mouthY: 132, front: tag(100, 186, 72, 'CPU 98°C', '#4a0e00', '#ffc070', 8) }),
  build('m85', { shape: 'golem', light: '#a8b0a0', dark: '#4a5040', line: '#1c2016', eyes: 'sleepy', eyeColor: '#1c2016', mouth: 'flat', eyeY: 66, mouthY: 80, front: tag(100, 126, 86, 'battery 3%', '#1c2016', '#a8b0a0', 8) }),
  build('m86', { shape: 'beast', light: '#8a8aa8', dark: '#2a2a48', line: '#0c0c1c', eyes: 'many', eyeColor: '#0c0c1c', mouth: 'fangs', eyeY: 92, mouthY: 118, front: tag(100, 172, 100, '(어느 게 어느 선?)', '#0c0c1c', '#8a8aa8', 8) }),
  build('m87', { shape: 'bat', light: '#9a9aa8', dark: '#3a3a48', line: '#14141c', eyes: 'angry', eyeColor: '#14141c', mouth: 'fangs', eyeY: 104, mouthY: 118, front: tag(100, 60, 65, 'sudo !!', '#14141c', '#9a9aa8', 8) }),
  build('m88', { shape: 'ghost', light: '#d0d0e0', dark: '#6a6a88', line: '#24243a', eyes: 'sleepy', eyeColor: '#24243a', mouth: 'o', eyeY: 102, mouthY: 132, front: tag(100, 40, 93, '&gt; /dev/null', '#24243a', '#d0d0e0', 8) }),
  build('m89', { shape: 'titan', light: '#8a2a3a', dark: '#200008', line: '#000', eyes: 'glow', eyeColor: '#000', mouth: 'fangs', eyeY: 94, mouthY: 120, front: tag(100, 142, 177, 'uid=0(root) gid=0(root)', '#000', '#8a2a3a', 8) }),

  // 90-95: 컴파일 화산
  build('m90', { shape: 'beast', light: '#e88a5a', dark: '#8a2a0a', line: '#300a00', eyes: 'x', eyeColor: '#300a00', mouth: 'frown', eyeY: 92, mouthY: 118, front: tag(100, 172, 170, 'undefined reference to', '#300a00', '#e88a5a', 8) }),
  build('m91', { shape: 'blob', light: '#c8a0e8', dark: '#5a2a8a', line: '#200a34', eyes: 'angry', eyeColor: '#200a34', mouth: 'fangs', eyeY: 102, mouthY: 132, front: tag(100, 60, 170, 'error: … (3,000 lines)', '#200a34', '#c8a0e8', 8) }),
  build('m92', { shape: 'beast', light: '#a0d890', dark: '#3a7a2a', line: '#10300a', eyes: 'round', eyeColor: '#10300a', mouth: 'grin', eyeY: 92, mouthY: 118, front: tag(100, 172, 107, 'a → b → c → a', '#10300a', '#a0d890', 8) }),
  build('m93', { shape: 'beast', light: '#ffb04a', dark: '#b8520a', line: '#401a00', eyes: 'glow', eyeColor: '#401a00', mouth: 'grin', eyeY: 92, mouthY: 118, front: tag(100, 172, 142, '-w  # warnings off', '#401a00', '#ffb04a', 8) }),
  build('m94', { shape: 'golem', light: '#b0a090', dark: '#5a4a3a', line: '#221a12', eyes: 'x', eyeColor: '#221a12', mouth: 'flat', eyeY: 66, mouthY: 80, front: tag(100, 126, 135, 'stale build cache', '#221a12', '#b0a090', 8) }),
  build('m95', { shape: 'titan', light: '#ff7a3a', dark: '#6a1400', line: '#200400', eyes: 'glow', eyeColor: '#200400', mouth: 'fangs', eyeY: 94, mouthY: 120, front: tag(100, 142, 114, 'build: 40m 12s', '#200400', '#ff7a3a', 8) }),

  // 96-101: 테스트 늪
  build('m96', { shape: 'golem', light: '#f0d8c0', dark: '#a07a5a', line: '#3a2818', eyes: 'round', eyeColor: '#3a2818', mouth: 'o', eyeY: 66, mouthY: 80, front: tag(100, 126, 79, 'jest.fn()', '#3a2818', '#f0d8c0', 8) }),
  build('m97', { shape: 'ghost', light: '#e8e0f8', dark: '#7a6aa8', line: '#2a2440', eyes: 'sleepy', eyeColor: '#2a2440', mouth: 'frown', eyeY: 102, mouthY: 132, front: tag(100, 40, 149, '› 1 snapshot failed', '#2a2440', '#e8e0f8', 8) }),
  build('m98', { shape: 'golem', light: '#e8d890', dark: '#8a7a2a', line: '#343008', eyes: 'glow', eyeColor: '#343008', mouth: 'flat', eyeY: 66, mouthY: 80, front: tag(100, 126, 114, 'coverage: 100%', '#343008', '#e8d890', 8) }),
  build('m99', { shape: 'golem', light: '#90b890', dark: '#3a6a3a', line: '#123012', eyes: 'sleepy', eyeColor: '#123012', mouth: 'frown', eyeY: 66, mouthY: 80, front: tag(100, 126, 180, 'Exceeded timeout of 5000 ms', '#123012', '#90b890', 8) }),
  build('m100', { shape: 'orb', light: '#a0c8e8', dark: '#2a5a8a', line: '#0a2034', eyes: 'round', eyeColor: '#0a2034', mouth: 'grin', eyeY: 102, mouthY: 132, front: tag(100, 186, 156, 'passes only in order', '#0a2034', '#a0c8e8', 8) }),
  build('m101', { shape: 'titan', light: '#ff8a8a', dark: '#5a0a1a', line: '#1a0006', eyes: 'many', eyeColor: '#1a0006', mouth: 'fangs', eyeY: 94, mouthY: 120, front: tag(100, 142, 149, 'works on my machine', '#1a0006', '#ff8a8a', 8) }),
);

const BOSS_AURA = `<defs><radialGradient id="boss-aura"><stop offset="55%" stop-color="#b48ead" stop-opacity="0"/><stop offset="80%" stop-color="#b48ead" stop-opacity=".45"/><stop offset="100%" stop-color="#b48ead" stop-opacity="0"/></radialGradient></defs>
  <circle class="boss-aura" cx="100" cy="100" r="98" fill="url(#boss-aura)"/>`;

const BOSS_CROWN = `<path d="M70 14 L78 0 L88 12 L100 -4 L112 12 L122 0 L130 14 Z" fill="#ebcb8b" stroke="#8a6d2b" stroke-width="2" transform="translate(0 6)"/>`;

// Each drawing gets its own gradient ids: the same monster can be on the
// page twice (battle + bestiary), and a url(#id) shared between them can
// draw from the wrong (hidden) copy and come out broken on some GPUs.
let drawSeq = 0;
function scoped(svg) {
  const n = ++drawSeq;
  return svg.replace(/\bid="([^"]+)"/g, (_, id) => `id="${id}-${n}"`).replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${id}-${n})`);
}

export function monsterSvg(index, isBoss) {
  const body = MONSTERS[index % MONSTERS.length];
  return scoped(`<svg class="monster-svg${isBoss ? ' boss' : ''}" viewBox="-10 -10 220 220" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    ${isBoss ? BOSS_AURA : ''}
    <g class="monster-body">${body}</g>
    ${isBoss ? BOSS_CROWN : ''}
  </svg>`);
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
  return scoped(`<svg class="monster-svg" viewBox="-10 -10 220 220" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <g class="monster-body">${MERCHANT}</g>
  </svg>`);
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
  return scoped(`<svg class="monster-svg" viewBox="-10 -10 220 220" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <g class="monster-body">${BLACKSMITH}</g>
  </svg>`);
}

// Treasure chest (the monster fell mid-turn; overkill decides the grade).
const CHEST_COLORS = {
  wood: ['#b07a44', '#6b4420', '#d9c08a'],
  iron: ['#9aa3b0', '#4c5563', '#dfe5ee'],
  silver: ['#d8e0ea', '#7f8ea3', '#ffffff'],
  gold: ['#ffd76a', '#b8860b', '#fff4c2'],
  platinum: ['#e6eef5', '#8aa0b4', '#ffffff'],
  diamond: ['#9fe8ff', '#2a8fb8', '#e8fbff'],
  legend: ['#c9a2ff', '#5b2aa8', '#ffe9ff'],
  mythic: ['#ff9ed2', '#b0206f', '#fff1a8'],
};
export function chestSvg(grade, open = false) {
  const [body, dark, shine] = CHEST_COLORS[grade] ?? CHEST_COLORS.wood;
  const lid = open
    ? `<path d="M44 92 L60 40 L140 40 L156 92 Z" fill="${dark}" stroke="#1a1208" stroke-width="3" transform="rotate(-18 44 92)"/>`
    : `<path d="M40 96 Q40 56 100 56 Q160 56 160 96 Z" fill="${body}" stroke="#1a1208" stroke-width="3"/><rect x="92" y="70" width="16" height="30" fill="${dark}"/>`;
  const glow = open ? `<ellipse class="boss-aura" cx="100" cy="92" rx="70" ry="30" fill="${shine}" opacity=".55"/><path d="M70 90 L60 30 M100 90 L100 16 M130 90 L140 30" stroke="${shine}" stroke-width="5" stroke-linecap="round" opacity=".8"/>` : '';
  return scoped(`<svg class="monster-svg chest-svg" viewBox="-10 -10 220 220" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="100" cy="186" rx="70" ry="9" fill="#000" opacity=".4"/>
    <g class="monster-body">
      ${glow}
      <rect x="40" y="94" width="120" height="84" rx="6" fill="${body}" stroke="#1a1208" stroke-width="3"/>
      <rect x="40" y="94" width="120" height="14" fill="${dark}"/>
      <rect x="92" y="94" width="16" height="84" fill="${dark}"/>
      <rect x="88" y="112" width="24" height="22" rx="4" fill="${shine}" stroke="#1a1208" stroke-width="2"/>
      <circle cx="100" cy="123" r="3.5" fill="#1a1208"/>
      ${lid}
    </g>
  </svg>`);
}
