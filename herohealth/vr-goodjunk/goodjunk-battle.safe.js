/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-battle.safe.js
 * GOODJUNK BATTLE ENGINE
 * ---------------------------------------------------------
 * - works with rooms/{roomId}/{meta,state,players}
 * - self-loads Firebase compat + firebase-config if missing
 * - joins existing room from Battle Lobby
 * - host flips countdown -> playing -> ended
 * - local gameplay: good/junk targets, score, streak, HP, charge
 * - attack system synced through Firebase
 * - emits battle summary events for run shell
 * - compatible with goodjunk.safe.battle.js if loaded separately
 * ========================================================= */

(() => {
  'use strict';

  const W = window;
  const D = document;

  const VERSION = 'v20260327-GJBATTLE-ENGINE-R1';
  const FIREBASE_APP = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js';
  const FIREBASE_AUTH = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js';
  const FIREBASE_DB = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js';
  const FIREBASE_CONFIG = '../firebase-config.js';

  const qs = (k, d = '') => {
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch { return d; }
  };

  const clamp = (v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  };

  const num = (v, d = 0) => {
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  };

  const int = (v, d = 0) => Math.round(num(v, d));

  const txt = (v) => String(v == null ? '' : v).trim();

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const now = () => Date.now();

  const raf = W.requestAnimationFrame ? W.requestAnimationFrame.bind(W) : (fn => setTimeout(fn, 16));
  const caf = W.cancelAnimationFrame ? W.cancelAnimationFrame.bind(W) : clearTimeout;

  const ROOM_ID = String(qs('roomId') || qs('room') || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  const HUB = qs('hub', '../hub.html');
  const NAME = String(qs('name') || qs('nick') || 'Player').trim().slice(0, 48);
  const PID = String(qs('pid') || 'anon').trim().slice(0, 80);
  const DIFF = String(qs('diff') || 'normal').toLowerCase();
  const VIEW = String(qs('view') || 'mobile').toLowerCase();
  const MODE = 'battle';
  const DEBUG = qs('debug', '0') === '1' || qs('battleDebug', '0') === '1';

  const DIFF_CFG = {
    easy:   { spawnEvery: 900, maxTargets: 5, ttl: 3200, speedMin: 58, speedMax: 86, goodRatio: 0.76, atkGain: 20, atkDmg: 12 },
    normal: { spawnEvery: 760, maxTargets: 6, ttl: 2800, speedMin: 72, speedMax: 104, goodRatio: 0.72, atkGain: 18, atkDmg: 14 },
    hard:   { spawnEvery: 640, maxTargets: 7, ttl: 2450, speedMin: 86, speedMax: 124, goodRatio: 0.68, atkGain: 16, atkDmg: 16 }
  };

  const GOOD_ITEMS = [
    { emoji: '🍎', name: 'Apple' },
    { emoji: '🍌', name: 'Banana' },
    { emoji: '🍉', name: 'Watermelon' },
    { emoji: '🥕', name: 'Carrot' },
    { emoji: '🥦', name: 'Broccoli' },
    { emoji: '🥛', name: 'Milk' },
    { emoji: '🍓', name: 'Strawberry' },
    { emoji: '🍇', name: 'Grapes' }
  ];

  const JUNK_ITEMS = [
    { emoji: '🍟', name: 'Fries' },
    { emoji: '🍩', name: 'Donut' },
    { emoji: '🍬', name: 'Candy' },
    { emoji: '🍭', name: 'Lollipop' },
    { emoji: '🧃', name: 'Sweet drink' },
    { emoji: '🍪', name: 'Cookie' },
    { emoji: '🧁', name: 'Cupcake' }
  ];

  const TOASTS = {
    ready: '⚡ พลังโจมตีเต็มแล้ว กด ATTACK ได้เลย',
    noOpponent: 'ยังไม่มีคู่แข่งให้โจมตี',
    attack: '💥 โจมตีคู่แข่งแล้ว',
    junk: 'โอ๊ะ เจอ junk แล้ว',
    miss: 'อาหารดีหลุดไปแล้ว',
    good: 'เยี่ยมมาก เก็บอาหารดีได้',
    ko: '🛡️ HP หมดแล้ว',
    wait: 'กำลังรออีกคนเข้าเกม',
    sync: 'กำลังซิงก์ห้อง Battle'
  };

  const CFG = DIFF_CFG[DIFF] || DIFF_CFG.normal;

  const S = {
    uid: '',
    db: null,
    auth: null,
    joinedAt: 0,

    refs: {
      root: null,
      meta: null,
      state: null,
      players: null,
      self: null
    },

    roomMeta: null,
    roomState: null,
    playersMap: {},

    started: false,
    ended: false,
    roundKey: '',
    endAtMs: 0,

    loopId: 0,
    heartbeatId: 0,
    writeQueued: false,
    lastWriteAt: 0,
    hostStartInFlight: false,
    hostEndInFlight: false,

    toastTimer: 0,
    debugPaintAt: 0,

    seq: 0,
    lastFrameAt: 0,
    lastSpawnAt: 0,
    targets: [],

    self: {
      pid: PID || 'anon',
      name: NAME || 'Player',
      score: 0,
      miss: 0,
      bestStreak: 0,
      streak: 0,
      hp: 100,
      maxHp: 100,
      shield: 0,
      attackCharge: 0,
      maxAttackCharge: 100,
      attackReady: false,
      attacksUsed: 0,
      damageDealt: 0,
      damageTaken: 0,
      koCount: 0,
      goodHit: 0,
      junkHit: 0,
      goodMiss: 0
    }
  };

  const UI = {};

  function xmur3(str) {
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function() {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const RNG = mulberry32(xmur3(`${ROOM_ID}|${qs('seed', String(now()))}|${DIFF}|${MODE}`)());

  function devicePid() {
    try {
      let pid = localStorage.getItem('GJ_DEVICE_PID');
      if (!pid) {
        pid = `p-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem('GJ_DEVICE_PID', pid);
      }
      return pid;
    } catch (_) {
      return `p-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function ensurePid() {
    const v = txt(PID).replace(/[.#$[\]/]/g, '-');
    if (!v || v.toLowerCase() === 'anon') return devicePid();
    return v.slice(0, 80);
  }

  function ensureName() {
    return (txt(NAME) || 'Player').slice(0, 48);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const abs = new URL(src, location.href).toString();
      const exist = Array.from(D.scripts).find((s) => s.src === abs);
      if (exist) {
        if (exist.dataset.loaded === '1') return resolve();
        exist.addEventListener('load', () => resolve(), { once: true });
        exist.addEventListener('error', () => reject(new Error(`load failed: ${src}`)), { once: true });
        return;
      }

      const s = D.createElement('script');
      s.src = abs;
      s.async = true;
      s.onload = () => {
        s.dataset.loaded = '1';
        resolve();
      };
      s.onerror = () => reject(new Error(`load failed: ${src}`));
      D.head.appendChild(s);
    });
  }

  async function ensureFirebase() {
    if (!W.firebase || !W.firebase.database || !W.firebase.auth) {
      await loadScript(FIREBASE_APP);
      await loadScript(FIREBASE_AUTH);
      await loadScript(FIREBASE_DB);
    }

    if (!W.HHA_FIREBASE_CONFIG && !W.__HHA_FIREBASE_CONFIG__ && !W.firebaseConfig) {
      await loadScript(FIREBASE_CONFIG);
    }

    const config = W.HHA_FIREBASE_CONFIG || W.__HHA_FIREBASE_CONFIG__ || W.firebaseConfig;
    if (!config) throw new Error('firebase config missing');

    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(config);
    }

    S.auth = firebase.auth();
    S.db = firebase.database();

    if (!S.auth.currentUser) {
      await S.auth.signInAnonymously();
    }

    if (!S.auth.currentUser) {
      throw new Error('anonymous auth failed');
    }

    S.uid = S.auth.currentUser.uid;
  }

  function injectStyle() {
    if (D.getElementById('gj-battle-engine-style')) return;
    const style = D.createElement('style');
    style.id = 'gj-battle-engine-style';
    style.textContent = `
      #gjBattleEngineRoot{
        position:absolute; inset:0; z-index:1;
        pointer-events:auto;
        user-select:none;
        -webkit-user-select:none;
      }
      #gjBattleArena{
        position:absolute; inset:0;
        overflow:hidden;
      }
      .gjb-cloud{
        position:absolute;
        border-radius:999px;
        background:rgba(255,255,255,.9);
        box-shadow:0 8px 20px rgba(0,0,0,.06);
        pointer-events:none;
      }
      .gjb-cloud.c1{ width:148px; height:48px; left:4%; top:7%; }
      .gjb-cloud.c2{ width:104px; height:36px; right:8%; top:10%; }
      .gjb-cloud.c3{ width:124px; height:40px; left:36%; top:16%; }

      #gjBattleStage{
        position:absolute;
        inset:0;
        overflow:hidden;
      }

      .gjb-target{
        position:absolute;
        display:grid;
        place-items:center;
        border-radius:24px;
        border:2px solid rgba(255,255,255,.95);
        box-shadow:0 12px 28px rgba(0,0,0,.14);
        cursor:pointer;
        transform:translate3d(0,0,0);
        will-change:transform;
        touch-action:manipulation;
      }
      .gjb-target.good{
        background:linear-gradient(180deg,#fffef9,#f1fff2);
      }
      .gjb-target.junk{
        background:linear-gradient(180deg,#fff7f7,#ffe7e7);
      }
      .gjb-target .emo{
        font-size:clamp(28px,5vw,42px);
        line-height:1;
      }

      #gjBattleHud{
        position:absolute;
        left:12px; right:12px; top:12px;
        display:grid;
        grid-template-columns:minmax(220px,300px) 1fr minmax(220px,300px);
        gap:10px;
        z-index:4;
        pointer-events:none;
      }
      .gjb-card{
        background:rgba(255,255,255,.9);
        border:2px solid rgba(191,227,242,.95);
        border-radius:22px;
        box-shadow:0 14px 30px rgba(86,155,194,.16);
        padding:12px;
      }
      .gjb-card *{ pointer-events:auto; }
      .gjb-head{
        font-size:12px;
        font-weight:1000;
        color:#7b7a72;
        letter-spacing:.04em;
        text-transform:uppercase;
      }
      .gjb-big{
        font-size:34px;
        line-height:1;
        font-weight:1000;
        color:#4d4a42;
        margin-top:6px;
      }
      .gjb-row{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin-top:10px;
      }
      .gjb-mini{
        border-radius:16px;
        padding:10px;
        background:#fff;
        border:1.5px solid rgba(191,227,242,.95);
        text-align:center;
      }
      .gjb-mini .k{
        font-size:11px;
        color:#7b7a72;
        font-weight:1000;
      }
      .gjb-mini .v{
        margin-top:4px;
        font-size:20px;
        line-height:1;
        font-weight:1000;
        color:#244260;
      }

      .gjb-center{
        display:grid;
        gap:10px;
      }
      .gjb-matchbar{
        display:grid;
        grid-template-columns:1fr auto 1fr;
        gap:10px;
        align-items:center;
      }
      .gjb-name{
        font-size:14px;
        font-weight:1000;
        color:#4d4a42;
      }
      .gjb-sub{
        font-size:12px;
        color:#7b7a72;
        font-weight:900;
        line-height:1.45;
      }
      .gjb-vs{
        min-width:62px;
        height:62px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:linear-gradient(180deg,#fff5d2,#ffd45c);
        border:2px solid rgba(191,227,242,.95);
        font-size:22px;
        font-weight:1000;
        color:#8c5f00;
      }
      .gjb-bar{
        height:12px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(191,227,242,.65);
        margin-top:8px;
      }
      .gjb-fill{
        height:100%;
        width:0%;
        border-radius:999px;
        transition:width .12s linear;
      }
      .gjb-fill.hp{ background:linear-gradient(90deg,#7ed957,#58c33f); }
      .gjb-fill.charge{ background:linear-gradient(90deg,#7fcfff,#58b7f5); }

      #attackBtn{
        appearance:none;
        border:0;
        cursor:pointer;
        min-height:46px;
        padding:12px 16px;
        border-radius:18px;
        background:linear-gradient(180deg,#ffd45c,#ffb547);
        color:#6d4e00;
        font-size:15px;
        font-weight:1000;
        box-shadow:0 10px 18px rgba(86,155,194,.14);
      }
      #attackBtn[disabled]{
        opacity:.58;
        cursor:not-allowed;
      }
      #attackReadyBadge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:34px;
        padding:6px 12px;
        border-radius:999px;
        background:#fff;
        border:2px solid rgba(191,227,242,.95);
        font-size:12px;
        font-weight:1000;
        color:#7b7a72;
        width:max-content;
      }

      #gjBattleBottom{
        position:absolute;
        left:12px; right:12px; bottom:12px;
        z-index:4;
        display:flex;
        gap:10px;
        justify-content:space-between;
        align-items:flex-end;
        pointer-events:none;
      }
      #gjBattleCoach,
      #gjBattleToast{
        pointer-events:auto;
        background:rgba(255,255,255,.92);
        border:2px solid rgba(191,227,242,.95);
        box-shadow:0 12px 24px rgba(86,155,194,.12);
      }
      #gjBattleCoach{
        max-width:min(680px, calc(100vw - 24px));
        border-radius:20px;
        padding:12px 14px;
        color:#6d6a62;
        font-size:13px;
        font-weight:1000;
        line-height:1.6;
      }
      #gjBattleToast{
        min-width:180px;
        max-width:min(320px, calc(100vw - 24px));
        border-radius:16px;
        padding:10px 12px;
        color:#4d4a42;
        font-size:13px;
        font-weight:1000;
        line-height:1.5;
        text-align:center;
        opacity:0;
        transform:translateY(8px);
        transition:opacity .16s ease, transform .16s ease;
      }
      #gjBattleToast.show{
        opacity:1;
        transform:translateY(0);
      }

      #gjBattleGate{
        position:absolute;
        inset:0;
        z-index:6;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(255,255,255,.34);
        backdrop-filter:blur(8px);
      }
      #gjBattleGate[hidden]{ display:none !important; }
      .gjb-gate-card{
        width:min(560px,100%);
        background:rgba(255,253,246,.96);
        border:2px solid rgba(191,227,242,.95);
        border-radius:28px;
        box-shadow:0 24px 50px rgba(86,155,194,.18);
        padding:20px;
        text-align:center;
      }
      .gjb-gate-kicker{
        display:inline-flex;
        align-items:center;
        gap:8px;
        min-height:34px;
        padding:6px 14px;
        border-radius:999px;
        background:#fff4dd;
        border:2px solid rgba(191,227,242,.95);
        color:#b7791f;
        font-size:12px;
        font-weight:1000;
      }
      .gjb-gate-title{
        margin-top:12px;
        font-size:34px;
        line-height:1.05;
        font-weight:1000;
        color:#b7791f;
        text-shadow:0 2px 0 #fff;
      }
      .gjb-gate-text{
        margin-top:10px;
        color:#7b7a72;
        font-size:14px;
        line-height:1.7;
        font-weight:900;
      }
      .gjb-gate-mini{
        margin-top:12px;
        display:flex;
        justify-content:center;
        gap:8px;
        flex-wrap:wrap;
      }
      .gjb-gpill{
        padding:8px 12px;
        border-radius:999px;
        background:#fff;
        border:1.5px solid rgba(191,227,242,.95);
        color:#6d6a62;
        font-size:12px;
        font-weight:1000;
      }

      #gjBattleDebug{
        position:fixed;
        left:10px; right:10px; bottom:10px;
        z-index:9999;
        padding:10px 12px;
        border-radius:14px;
        border:1px solid rgba(191,227,242,.9);
        background:rgba(15,23,42,.92);
        color:#f8fafc;
        font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
        box-shadow:0 18px 40px rgba(0,0,0,.28);
        white-space:pre-wrap;
        word-break:break-word;
        backdrop-filter:blur(8px);
        max-height:42vh;
        overflow:auto;
        display:none;
      }
      #gjBattleDebug.show{ display:block; }

      @media (max-width:980px){
        #gjBattleHud{
          grid-template-columns:1fr;
          top:10px; left:10px; right:10px;
        }
        .gjb-big{ font-size:28px; }
        .gjb-row{ grid-template-columns:repeat(3,minmax(0,1fr)); }
        #gjBattleBottom{
          flex-direction:column;
          align-items:stretch;
          left:10px; right:10px; bottom:10px;
        }
        #gjBattleCoach, #gjBattleToast{ max-width:none; }
      }

      @media (prefers-reduced-motion: reduce){
        .gjb-fill,
        #gjBattleToast{
          transition:none !important;
        }
      }
    `;
    D.head.appendChild(style);
  }

  function buildDom() {
    const mount = D.getElementById('gameMount') || D.body;
    mount.innerHTML = `
      <div id="gjBattleEngineRoot">
        <div id="gjBattleArena">
          <div class="gjb-cloud c1" aria-hidden="true"></div>
          <div class="gjb-cloud c2" aria-hidden="true"></div>
          <div class="gjb-cloud c3" aria-hidden="true"></div>

          <div id="gjBattleHud">
            <div class="gjb-card">
              <div class="gjb-head">My Score</div>
              <div class="gjb-big" id="scoreValue">0</div>

              <div class="gjb-row">
                <div class="gjb-mini">
                  <div class="k">TIME</div>
                  <div class="v" id="timeValue">0:00</div>
                </div>
                <div class="gjb-mini">
                  <div class="k">MISS</div>
                  <div class="v" id="missValue">0</div>
                </div>
                <div class="gjb-mini">
                  <div class="k">BEST</div>
                  <div class="v" id="bestStreakValue">0</div>
                </div>
              </div>
            </div>

            <div class="gjb-card gjb-center">
              <div class="gjb-matchbar">
                <div>
                  <div class="gjb-name" id="meName">Me</div>
                  <div class="gjb-sub" id="meMeta">Battle hero</div>
                  <div class="gjb-bar"><div class="gjb-fill hp" id="hpFill"></div></div>
                  <div class="gjb-sub" style="margin-top:6px;" id="hpValue">100/100</div>
                </div>

                <div class="gjb-vs">VS</div>

                <div style="text-align:right;">
                  <div class="gjb-name" id="enemyName">Waiting...</div>
                  <div class="gjb-sub" id="enemyMeta">ยังไม่มีคู่แข่ง</div>
                  <div class="gjb-bar"><div class="gjb-fill hp" id="enemyHpFill"></div></div>
                  <div class="gjb-sub" style="margin-top:6px;" id="enemyHpValue">-</div>
                </div>
              </div>

              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
                <div style="display:grid;gap:8px;">
                  <div class="gjb-sub" id="attackChargeValue">0/100</div>
                  <div class="gjb-bar" style="min-width:180px;"><div class="gjb-fill charge" id="attackChargeFill"></div></div>
                </div>
                <div style="display:grid;gap:8px;justify-items:end;">
                  <div id="attackReadyBadge">CHARGING</div>
                  <button id="attackBtn" type="button" disabled>⚡ ATTACK</button>
                </div>
              </div>
            </div>

            <div class="gjb-card">
              <div class="gjb-head">Opponent</div>
              <div class="gjb-big" id="enemyScoreValue">0</div>

              <div class="gjb-row">
                <div class="gjb-mini">
                  <div class="k">ROOM</div>
                  <div class="v" id="battleRoomValue">${esc(ROOM_ID || '-')}</div>
                </div>
                <div class="gjb-mini">
                  <div class="k">LEVEL</div>
                  <div class="v" id="battleLevelValue">${esc(DIFF)}</div>
                </div>
                <div class="gjb-mini">
                  <div class="k">VIEW</div>
                  <div class="v" id="battleViewValue">${esc(VIEW)}</div>
                </div>
              </div>
            </div>
          </div>

          <div id="gjBattleStage"></div>

          <div id="gjBattleBottom">
            <div id="gjBattleCoach">⚔️ เก็บอาหารดีให้ไว ระวัง junk และใช้ ATTACK ให้ถูกจังหวะ</div>
            <div id="gjBattleToast"></div>
          </div>

          <div id="gjBattleGate">
            <div class="gjb-gate-card">
              <div class="gjb-gate-kicker">⚔️ GOODJUNK BATTLE</div>
              <div class="gjb-gate-title" id="gjBattleGateTitle">กำลังเตรียมห้อง...</div>
              <div class="gjb-gate-text" id="gjBattleGateText">กำลังโหลดระบบและเชื่อมห้อง Battle</div>
              <div class="gjb-gate-mini">
                <div class="gjb-gpill" id="gateRoomPill">ROOM • ${esc(ROOM_ID || '-')}</div>
                <div class="gjb-gpill" id="gateDiffPill">LEVEL • ${esc(DIFF)}</div>
                <div class="gjb-gpill" id="gateTimePill">TIME • ${esc(qs('time', '90'))}</div>
              </div>
            </div>
          </div>
        </div>

        <div id="gjBattleDebug"></div>
      </div>
    `;

    UI.stage = D.getElementById('gjBattleStage');
    UI.gate = D.getElementById('gjBattleGate');
    UI.gateTitle = D.getElementById('gjBattleGateTitle');
    UI.gateText = D.getElementById('gjBattleGateText');

    UI.score = D.getElementById('scoreValue');
    UI.time = D.getElementById('timeValue');
    UI.miss = D.getElementById('missValue');
    UI.best = D.getElementById('bestStreakValue');

    UI.hpValue = D.getElementById('hpValue');
    UI.hpFill = D.getElementById('hpFill');

    UI.chargeValue = D.getElementById('attackChargeValue');
    UI.chargeFill = D.getElementById('attackChargeFill');
    UI.attackReady = D.getElementById('attackReadyBadge');
    UI.attackBtn = D.getElementById('attackBtn');

    UI.meName = D.getElementById('meName');
    UI.meMeta = D.getElementById('meMeta');

    UI.enemyName = D.getElementById('enemyName');
    UI.enemyMeta = D.getElementById('enemyMeta');
    UI.enemyScore = D.getElementById('enemyScoreValue');
    UI.enemyHpValue = D.getElementById('enemyHpValue');
    UI.enemyHpFill = D.getElementById('enemyHpFill');

    UI.coach = D.getElementById('gjBattleCoach');
    UI.toast = D.getElementById('gjBattleToast');
    UI.debug = D.getElementById('gjBattleDebug');

    UI.attackBtn.addEventListener('click', useAttack);
  }

  function showGate(title, text) {
    if (!UI.gate) return;
    UI.gate.hidden = false;
    if (UI.gateTitle) UI.gateTitle.textContent = title;
    if (UI.gateText) UI.gateText.textContent = text;
  }

  function hideGate() {
    if (UI.gate) UI.gate.hidden = true;
  }

  function setCoach(text) {
    if (UI.coach) UI.coach.textContent = text;
  }

  function toast(text) {
    if (!UI.toast) return;
    UI.toast.textContent = text;
    UI.toast.classList.add('show');
    clearTimeout(S.toastTimer);
    S.toastTimer = setTimeout(() => {
      UI.toast.classList.remove('show');
    }, 1400);
  }

  function fmtClock(sec) {
    const s = Math.max(0, int(sec, 0));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
  }

  function stageRect() {
    const r = UI.stage ? UI.stage.getBoundingClientRect() : { width: innerWidth, height: innerHeight };
    return {
      w: Math.max(320, int(r.width, innerWidth)),
      h: Math.max(420, int(r.height, innerHeight))
    };
  }

  function isHost() {
    return !!S.uid && !!S.roomMeta && txt(S.roomMeta.hostPid) === txt(S.uid);
  }

  function roomPath() {
    return `hha-battle/goodjunk/rooms/${ROOM_ID}`;
  }

  function mergedPlayersMap() {
    const out = Object.assign({}, S.playersMap || {});
    if (S.uid) {
      out[S.uid] = Object.assign({}, out[S.uid] || {}, {
        pid: S.self.pid,
        uid: S.uid,
        playerId: S.uid,
        name: S.self.name,
        nick: S.self.name,
        score: S.self.score,
        miss: S.self.miss,
        bestStreak: S.self.bestStreak,
        hp: S.self.hp,
        maxHp: S.self.maxHp,
        shield: S.self.shield,
        attackCharge: S.self.attackCharge,
        maxAttackCharge: S.self.maxAttackCharge,
        attackReady: S.self.attackReady,
        attacksUsed: S.self.attacksUsed,
        damageDealt: S.self.damageDealt,
        damageTaken: S.self.damageTaken,
        koCount: S.self.koCount,
        connected: true,
        ready: true,
        alive: S.self.hp > 0,
        status: S.ended ? 'finished' : (S.started ? 'playing' : (txt(S.roomState?.status) || 'waiting')),
        joinedAt: S.joinedAt || now(),
        updatedAt: now(),
        lastSeen: now()
      });
    }
    return out;
  }

  function activePlayersArray() {
    const ttl = 20000;
    const t = now();
    return Object.entries(mergedPlayersMap())
      .map(([key, p]) => Object.assign({ key }, p || {}))
      .filter((p) => {
        if (p.connected === false) return false;
        const lastSeen = num(p.lastSeen || p.updatedAt || p.joinedAt, 0);
        if (!lastSeen) return true;
        return (t - lastSeen) <= ttl;
      })
      .sort((a, b) => num(a.joinedAt, 0) - num(b.joinedAt, 0));
  }

  function sortedPlayersForResult() {
    return activePlayersArray().sort((a, b) => {
      const aliveA = num((a.hp ?? 0) > 0, 0);
      const aliveB = num((b.hp ?? 0) > 0, 0);
      if (aliveB !== aliveA) return aliveB - aliveA;
      if (num(b.score, 0) !== num(a.score, 0)) return num(b.score, 0) - num(a.score, 0);
      if (num(b.hp, 0) !== num(a.hp, 0)) return num(b.hp, 0) - num(a.hp, 0);
      if (num(a.miss, 0) !== num(b.miss, 0)) return num(a.miss, 0) - num(b.miss, 0);
      return txt(a.name).localeCompare(txt(b.name), 'th');
    });
  }

  function enemyPlayer() {
    const arr = activePlayersArray();
    return arr.find((p) => txt(p.uid || p.playerId || p.pid || p.key) !== txt(S.uid)) || null;
  }

  function updateBattleBootBridge() {
    const room = {
      roomId: ROOM_ID,
      meta: S.roomMeta || {},
      state: S.roomState || {},
      players: mergedPlayersMap()
    };

    const boot = {
      uid: S.uid,
      pid: S.self.pid,
      playerId: S.uid,
      name: S.self.name,
      nick: S.self.name,
      roomId: ROOM_ID,
      room
    };

    W.HHA_BATTLE_BOOT = boot;
    W.__GJ_BATTLE_BOOT__ = boot;
    W.__BATTLE_ROOM__ = room;
    W.__BATTLE_STATE__ = {
      room,
      roomId: ROOM_ID,
      pid: S.self.pid,
      uid: S.uid,
      name: S.self.name,
      score: S.self.score,
      miss: S.self.miss,
      bestStreak: S.self.bestStreak,
      hp: S.self.hp,
      maxHp: S.self.maxHp,
      attackCharge: S.self.attackCharge,
      maxAttackCharge: S.self.maxAttackCharge,
      attackReady: S.self.attackReady,
      attacksUsed: S.self.attacksUsed,
      damageDealt: S.self.damageDealt,
      damageTaken: S.self.damageTaken,
      koCount: S.self.koCount,
      timeLeftSec: Math.max(0, Math.ceil((S.endAtMs - now()) / 1000)),
      endsAtMs: S.endAtMs,
      started: S.started,
      ended: S.ended
    };

    W.state = W.__BATTLE_STATE__;
    W.gameState = W.__BATTLE_STATE__;
  }

  function renderHud() {
    if (UI.score) UI.score.textContent = String(int(S.self.score, 0));
    if (UI.time) UI.time.textContent = fmtClock(Math.max(0, (S.endAtMs - now()) / 1000));
    if (UI.miss) UI.miss.textContent = String(int(S.self.miss, 0));
    if (UI.best) UI.best.textContent = String(int(S.self.bestStreak, 0));

    if (UI.hpValue) UI.hpValue.textContent = `${int(S.self.hp, 0)}/${int(S.self.maxHp, 100)}`;
    if (UI.hpFill) UI.hpFill.style.width = `${clamp((num(S.self.hp, 0) / Math.max(1, num(S.self.maxHp, 100))) * 100, 0, 100)}%`;

    if (UI.chargeValue) UI.chargeValue.textContent = `${int(S.self.attackCharge, 0)}/${int(S.self.maxAttackCharge, 100)}`;
    if (UI.chargeFill) UI.chargeFill.style.width = `${clamp((num(S.self.attackCharge, 0) / Math.max(1, num(S.self.maxAttackCharge, 100))) * 100, 0, 100)}%`;

    if (UI.attackReady) {
      UI.attackReady.textContent = S.self.attackReady ? 'ATTACK READY' : 'CHARGING';
      UI.attackReady.style.color = S.self.attackReady ? '#8c5f00' : '#7b7a72';
    }

    if (UI.attackBtn) {
      UI.attackBtn.disabled = !S.started || S.ended || !S.self.attackReady || !enemyPlayer();
    }

    if (UI.meName) UI.meName.textContent = `${S.self.name}`;
    if (UI.meMeta) UI.meMeta.textContent = `HP ${int(S.self.hp, 0)} • Score ${int(S.self.score, 0)}`;

    const enemy = enemyPlayer();
    if (enemy) {
      if (UI.enemyName) UI.enemyName.textContent = txt(enemy.name || 'Opponent');
      if (UI.enemyMeta) UI.enemyMeta.textContent = `HP ${int(enemy.hp, 0)} • Score ${int(enemy.score, 0)}`;
      if (UI.enemyScore) UI.enemyScore.textContent = String(int(enemy.score, 0));
      if (UI.enemyHpValue) UI.enemyHpValue.textContent = `${int(enemy.hp, 0)}/${int(enemy.maxHp || 100, 100)}`;
      if (UI.enemyHpFill) UI.enemyHpFill.style.width = `${clamp((num(enemy.hp, 0) / Math.max(1, num(enemy.maxHp || 100, 100))) * 100, 0, 100)}%`;
    } else {
      if (UI.enemyName) UI.enemyName.textContent = 'Waiting...';
      if (UI.enemyMeta) UI.enemyMeta.textContent = 'ยังไม่มีคู่แข่ง';
      if (UI.enemyScore) UI.enemyScore.textContent = '0';
      if (UI.enemyHpValue) UI.enemyHpValue.textContent = '-';
      if (UI.enemyHpFill) UI.enemyHpFill.style.width = '0%';
    }

    updateBattleBootBridge();
    renderDebug();
  }

  function renderDebug() {
    if (!DEBUG || !UI.debug) return;
    const players = activePlayersArray();
    UI.debug.classList.add('show');
    UI.debug.textContent = [
      `[GOODJUNK BATTLE ENGINE ${VERSION}]`,
      `room=${ROOM_ID || '-'}`,
      `uid=${S.uid || '-'}`,
      `pid=${S.self.pid || '-'}`,
      `status=${txt(S.roomState?.status || '-')}`,
      `host=${isHost()}`,
      `started=${S.started}`,
      `ended=${S.ended}`,
      `players=${players.length}`,
      `score=${S.self.score}`,
      `hp=${S.self.hp}/${S.self.maxHp}`,
      `charge=${S.self.attackCharge}/${S.self.maxAttackCharge}`,
      `attackReady=${S.self.attackReady}`,
      `best=${S.self.bestStreak}`,
      `miss=${S.self.miss}`,
      `endAtMs=${S.endAtMs || 0}`,
      `enemy=${enemyPlayer() ? txt(enemyPlayer().name) : '-'}`,
      '',
      JSON.stringify(mergedPlayersMap(), null, 2)
    ].join('\n');
  }

  function queueWrite() {
    S.writeQueued = true;
  }

  async function writeSelfNow(force) {
    if (!S.refs.self || !S.uid) return;
    if (!force && !S.writeQueued && (now() - S.lastWriteAt < 180)) return;

    S.writeQueued = false;
    S.lastWriteAt = now();

    try {
      await S.refs.self.update({
        pid: S.self.pid,
        uid: S.uid,
        playerId: S.uid,
        id: S.uid,
        name: S.self.name,
        nick: S.self.name,

        score: int(S.self.score, 0),
        miss: int(S.self.miss, 0),
        bestStreak: int(S.self.bestStreak, 0),
        streak: int(S.self.streak, 0),

        hp: int(S.self.hp, 0),
        maxHp: int(S.self.maxHp, 100),
        shield: int(S.self.shield, 0),

        attackCharge: int(S.self.attackCharge, 0),
        maxAttackCharge: int(S.self.maxAttackCharge, 100),
        attackReady: !!S.self.attackReady,
        attacksUsed: int(S.self.attacksUsed, 0),
        damageDealt: int(S.self.damageDealt, 0),
        damageTaken: int(S.self.damageTaken, 0),
        koCount: int(S.self.koCount, 0),

        goodHit: int(S.self.goodHit, 0),
        junkHit: int(S.self.junkHit, 0),
        goodMiss: int(S.self.goodMiss, 0),

        connected: true,
        ready: true,
        alive: S.self.hp > 0,
        status: S.ended ? 'finished' : (S.started ? 'playing' : (txt(S.roomState?.status) || 'waiting')),
        joinedAt: S.joinedAt || now(),
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
      });
    } catch (err) {
      console.warn('[gj-battle] write self failed:', err);
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    S.heartbeatId = setInterval(() => {
      writeSelfNow(true);
      maybeHostPromoteToPlaying();
      maybeHostEndRound('heartbeat');
    }, 2500);
  }

  function stopHeartbeat() {
    if (S.heartbeatId) {
      clearInterval(S.heartbeatId);
      S.heartbeatId = 0;
    }
  }

  function spawnTarget() {
    if (!S.started || S.ended) return;
    if (!UI.stage) return;
    if (S.targets.length >= CFG.maxTargets) return;

    const rect = stageRect();
    const size = int(58 + RNG() * 26, 64);
    const x = int(20 + RNG() * Math.max(20, rect.w - size - 40), 40);
    const y = int(160 + RNG() * Math.max(40, rect.h - size - 260), 220);

    const dirX = RNG() > 0.5 ? 1 : -1;
    const dirY = RNG() > 0.5 ? 1 : -1;
    const speed = CFG.speedMin + RNG() * (CFG.speedMax - CFG.speedMin);

    const good = RNG() < CFG.goodRatio;
    const meta = good
      ? GOOD_ITEMS[Math.floor(RNG() * GOOD_ITEMS.length)]
      : JUNK_ITEMS[Math.floor(RNG() * JUNK_ITEMS.length)];

    const el = D.createElement('button');
    el.type = 'button';
    el.className = `gjb-target ${good ? 'good' : 'junk'}`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.innerHTML = `<span class="emo">${meta.emoji}</span>`;
    el.setAttribute('aria-label', meta.name);

    const t = {
      id: `t${++S.seq}`,
      kind: good ? 'good' : 'junk',
      name: meta.name,
      emoji: meta.emoji,
      x, y,
      vx: dirX * speed,
      vy: dirY * (speed * 0.72),
      size,
      bornAt: now(),
      ttl: CFG.ttl * (0.88 + RNG() * 0.24),
      dead: false,
      el
    };

    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      hitTarget(t);
    }, { passive: false });

    UI.stage.appendChild(el);
    S.targets.push(t);
  }

  function removeTarget(t) {
    if (!t || t.dead) return;
    t.dead = true;
    try { t.el.remove(); } catch (_) {}
  }

  function clearTargets() {
    S.targets.forEach(removeTarget);
    S.targets = [];
  }

  function hitTarget(t) {
    if (!t || t.dead || !S.started || S.ended) return;
    removeTarget(t);

    if (t.kind === 'good') {
      S.self.streak += 1;
      S.self.bestStreak = Math.max(S.self.bestStreak, S.self.streak);
      S.self.goodHit += 1;
      S.self.score += 10 + Math.min(10, Math.floor(S.self.streak / 3) * 2);
      S.self.attackCharge = clamp(S.self.attackCharge + CFG.atkGain, 0, S.self.maxAttackCharge);

      if (S.self.attackCharge >= S.self.maxAttackCharge) {
        S.self.attackCharge = S.self.maxAttackCharge;
        if (!S.self.attackReady) toast(TOASTS.ready);
        S.self.attackReady = true;
      }

      setCoach('🍉 เก็บอาหารดีต่อเนื่องให้มากที่สุด แล้วใช้ ATTACK ตอนจังหวะดี');
      if (S.self.streak % 5 === 0) toast('🔥 ต่อเนื่องเก่งมาก');
      else if (S.self.streak === 1) toast(TOASTS.good);
    } else {
      S.self.junkHit += 1;
      S.self.miss += 1;
      S.self.streak = 0;
      S.self.score = Math.max(0, S.self.score - 8);
      S.self.attackCharge = Math.max(0, S.self.attackCharge - 10);
      if (S.self.attackCharge < S.self.maxAttackCharge) S.self.attackReady = false;
      setCoach('🍩 ระวัง junk อย่าแตะของไม่ดีบ่อยเกินไป');
      toast(TOASTS.junk);
    }

    queueWrite();
    renderHud();
  }

  function expireTarget(t) {
    removeTarget(t);
    if (t.kind === 'good') {
      S.self.goodMiss += 1;
      S.self.miss += 1;
      S.self.streak = 0;
      setCoach('⏱️ อาหารดีหลุดไปแล้ว ลองแตะให้ไวขึ้นอีกนิด');
      toast(TOASTS.miss);
      queueWrite();
      renderHud();
    }
  }

  async function useAttack() {
    if (!S.started || S.ended) return;
    if (!S.self.attackReady) return;

    const enemy = enemyPlayer();
    if (!enemy) {
      toast(TOASTS.noOpponent);
      return;
    }

    const enemyKey = txt(enemy.uid || enemy.playerId || enemy.pid || enemy.key);
    if (!enemyKey || !S.refs.players) {
      toast(TOASTS.noOpponent);
      return;
    }

    const dmg = CFG.atkDmg;

    try {
      const enemyRef = S.refs.players.child(enemyKey);
      await enemyRef.transaction((cur) => {
        cur = cur || {};
        const hp = clamp(int(cur.hp, 100) - dmg, 0, int(cur.maxHp, 100) || 100);
        cur.hp = hp;
        cur.maxHp = Math.max(1, int(cur.maxHp, 100));
        cur.damageTaken = int(cur.damageTaken, 0) + dmg;
        cur.alive = hp > 0;
        cur.updatedAt = now();
        cur.lastSeen = now();
        if (hp <= 0) {
          cur.status = 'ko';
        }
        return cur;
      });

      S.self.attacksUsed += 1;
      S.self.damageDealt += dmg;
      S.self.attackCharge = 0;
      S.self.attackReady = false;
      queueWrite();
      renderHud();
      toast(TOASTS.attack);
      setCoach('💥 โจมตีถูกจังหวะมาก รีบเก็บอาหารดีเพื่อชาร์จใหม่');
      maybeHostEndRound('after-attack');
    } catch (err) {
      console.warn('[gj-battle] attack failed:', err);
      toast('โจมตีไม่สำเร็จ');
    }
  }

  async function maybeHostPromoteToPlaying() {
    if (!isHost() || !S.refs.state || S.hostStartInFlight) return;

    const status = txt(S.roomState?.status).toLowerCase();
    const countdownEndsAt = num(S.roomState?.countdownEndsAt, 0);
    const plannedSec = clamp(S.roomState?.plannedSec || qs('time', '90'), 30, 300);

    if (status !== 'countdown') return;
    if (countdownEndsAt > now() + 120) return;

    S.hostStartInFlight = true;

    try {
      await S.refs.state.transaction((cur) => {
        cur = cur || {};
        const st = txt(cur.status).toLowerCase();
        const cEnd = num(cur.countdownEndsAt, 0);

        if (st === 'playing' || st === 'ended' || st === 'finished') return cur;
        if (st === 'countdown' && cEnd > now() + 120) return cur;

        const startedAt = now();
        cur.status = 'playing';
        cur.startedAt = startedAt;
        cur.endsAt = startedAt + plannedSec * 1000;
        cur.updatedAt = startedAt;
        return cur;
      });
    } catch (err) {
      console.warn('[gj-battle] promote to playing failed:', err);
    } finally {
      S.hostStartInFlight = false;
    }
  }

  async function maybeHostEndRound(reason) {
    if (!isHost() || !S.refs.state || S.hostEndInFlight) return;
    if (!S.started || S.ended) return;

    const st = txt(S.roomState?.status).toLowerCase();
    if (st === 'ended' || st === 'finished') return;

    const players = activePlayersArray();
    const alive = players.filter((p) => int(p.hp, 0) > 0);
    const timeUp = now() >= S.endAtMs;
    const koEnd = players.length >= 2 && alive.length <= 1;

    if (!timeUp && !koEnd) return;

    S.hostEndInFlight = true;

    try {
      await writeSelfNow(true);

      const sorted = sortedPlayersForResult();
      const winner = sorted[0] || null;

      await S.refs.state.update({
        status: 'ended',
        endedAt: now(),
        updatedAt: now(),
        reason: reason || (timeUp ? 'time-up' : 'ko'),
        winnerPid: winner ? txt(winner.pid) : '',
        winnerUid: winner ? txt(winner.uid || winner.playerId || winner.key) : '',
        endSummary: {
          winnerPid: winner ? txt(winner.pid) : '',
          winnerName: winner ? txt(winner.name) : '',
          winnerScore: winner ? int(winner.score, 0) : 0
        }
      });
    } catch (err) {
      console.warn('[gj-battle] end round failed:', err);
    } finally {
      S.hostEndInFlight = false;
    }
  }

  function syncSelfFromRemote(remote) {
    if (!remote) return;

    const remoteHp = int(remote.hp, S.self.hp);
    if (remoteHp !== S.self.hp) {
      S.self.hp = remoteHp;
    }

    S.self.maxHp = Math.max(1, int(remote.maxHp, S.self.maxHp));
    S.self.damageTaken = Math.max(int(remote.damageTaken, 0), int(S.self.damageTaken, 0));

    if (remoteHp <= 0) {
      S.self.hp = 0;
      if (!S.ended) {
        toast(TOASTS.ko);
        setCoach('🛡️ HP หมดแล้ว รอสรุปผลรอบนี้');
      }
    }
  }

  function startRoundIfNeeded() {
    const status = txt(S.roomState?.status).toLowerCase();
    if (status !== 'playing') return;

    const startedAt = num(S.roomState?.startedAt, 0);
    const endsAt = num(S.roomState?.endsAt, 0);
    if (!startedAt || !endsAt) return;

    const key = `${startedAt}|${endsAt}`;
    if (S.roundKey === key) {
      S.started = true;
      S.endAtMs = endsAt;
      return;
    }

    S.roundKey = key;
    S.started = true;
    S.ended = false;
    S.endAtMs = endsAt;
    clearTargets();

    const remote = (S.playersMap && S.playersMap[S.uid]) || {};
    S.self.score = int(remote.score, 0);
    S.self.miss = int(remote.miss, 0);
    S.self.bestStreak = int(remote.bestStreak, 0);
    S.self.streak = int(remote.streak, 0);
    S.self.hp = int(remote.hp, 100);
    S.self.maxHp = Math.max(1, int(remote.maxHp, 100));
    S.self.shield = int(remote.shield, 0);
    S.self.attackCharge = int(remote.attackCharge ?? remote.charge, 0);
    S.self.maxAttackCharge = Math.max(1, int(remote.maxAttackCharge, 100));
    S.self.attackReady = !!remote.attackReady;
    S.self.attacksUsed = int(remote.attacksUsed, 0);
    S.self.damageDealt = int(remote.damageDealt, 0);
    S.self.damageTaken = int(remote.damageTaken, 0);
    S.self.koCount = int(remote.koCount, 0);
    S.self.goodHit = int(remote.goodHit, 0);
    S.self.junkHit = int(remote.junkHit, 0);
    S.self.goodMiss = int(remote.goodMiss, 0);

    setCoach('⚔️ เกมเริ่มแล้ว เก็บอาหารดี ชาร์จพลัง แล้วใช้ ATTACK ให้ถูกเวลา');
    hideGate();
    queueWrite();
    renderHud();
  }

  function finishLocal(reason) {
    if (S.ended) return;
    S.ended = true;
    S.started = false;
    clearTargets();
    queueWrite();
    writeSelfNow(true).catch(() => {});
    emitSummary(reason || txt(S.roomState?.reason || 'finished'));
  }

  function emitSummary(reason) {
    if (W.__GJ_BATTLE_ENGINE_SUMMARY_EMITTED__) return;
    W.__GJ_BATTLE_ENGINE_SUMMARY_EMITTED__ = true;

    const sorted = sortedPlayersForResult();
    const myIndex = sorted.findIndex((p) => txt(p.uid || p.playerId || p.key) === txt(S.uid));
    const myRank = myIndex >= 0 ? myIndex + 1 : '';
    const opponent = sorted.find((p) => txt(p.uid || p.playerId || p.key) !== txt(S.uid)) || null;

    const detail = {
      summary: {
        mode: 'battle',
        game: 'goodjunk-battle',
        roomId: ROOM_ID,
        pid: S.self.pid,
        name: S.self.name,
        rank: myRank,
        score: int(S.self.score, 0),
        opponentScore: opponent ? int(opponent.score, 0) : '',
        players: sorted.length,
        miss: int(S.self.miss, 0),
        bestStreak: int(S.self.bestStreak, 0),
        result: myRank === 1 ? 'win' : (myRank ? `อันดับ ${myRank}` : 'finished'),
        reason: reason || 'finished',
        hp: int(S.self.hp, 0),
        maxHp: int(S.self.maxHp, 100),
        attackCharge: int(S.self.attackCharge, 0),
        maxAttackCharge: int(S.self.maxAttackCharge, 100),
        attackReady: !!S.self.attackReady,
        attacksUsed: int(S.self.attacksUsed, 0),
        damageDealt: int(S.self.damageDealt, 0),
        damageTaken: int(S.self.damageTaken, 0),
        koCount: int(S.self.koCount, 0),
        raw: {
          version: VERSION,
          self: Object.assign({}, S.self),
          players: sorted,
          roomState: S.roomState || {},
          roomMeta: S.roomMeta || {}
        }
      }
    };

    const names = [
      'gj:battle-summary',
      'gj:summary',
      'gj:match-summary',
      'gj:session-end',
      'hha:summary',
      'hha:session-summary',
      'hha:match-summary'
    ];

    names.forEach((name) => {
      try {
        W.dispatchEvent(new CustomEvent(name, { detail }));
      } catch (err) {
        console.warn('[gj-battle] summary event failed:', name, err);
      }
    });

    try {
      W.postMessage({ type: 'gj:battle-summary', detail }, '*');
    } catch (_) {}

    try {
      if (typeof W.__GJ_SHOW_BATTLE_SUMMARY__ === 'function') {
        W.__GJ_SHOW_BATTLE_SUMMARY__(detail);
      }
    } catch (_) {}
  }

  function updateTargets(frameTs) {
    if (!S.started || S.ended) return;

    if (!S.lastFrameAt) S.lastFrameAt = frameTs;
    const dt = Math.min(40, frameTs - S.lastFrameAt) / 1000;
    S.lastFrameAt = frameTs;

    const rect = stageRect();
    const topPad = 150;
    const bottomPad = 150;

    if (!S.lastSpawnAt) S.lastSpawnAt = now();
    if (now() - S.lastSpawnAt >= CFG.spawnEvery) {
      S.lastSpawnAt = now();
      spawnTarget();
    }

    for (let i = S.targets.length - 1; i >= 0; i--) {
      const t = S.targets[i];
      if (!t || t.dead) {
        S.targets.splice(i, 1);
        continue;
      }

      t.x += t.vx * dt;
      t.y += t.vy * dt;

      if (t.x <= 6 || t.x >= rect.w - t.size - 6) {
        t.vx *= -1;
        t.x = clamp(t.x, 6, rect.w - t.size - 6);
      }

      if (t.y <= topPad || t.y >= rect.h - t.size - bottomPad) {
        t.vy *= -1;
        t.y = clamp(t.y, topPad, rect.h - t.size - bottomPad);
      }

      t.el.style.transform = `translate3d(${t.x}px, ${t.y}px, 0)`;

      const expired = (now() - t.bornAt) > t.ttl;
      if (expired) {
        S.targets.splice(i, 1);
        expireTarget(t);
      }
    }
  }

  function gameLoop(ts) {
    if (S.ended && txt(S.roomState?.status).toLowerCase() !== 'playing') {
      renderHud();
      S.loopId = raf(gameLoop);
      return;
    }

    const st = txt(S.roomState?.status).toLowerCase();

    if (st === 'waiting') {
      showGate('รอผู้เล่นอีกคน', 'เมื่อครบ 2 คนแล้ว host จะเริ่มนับถอยหลังเข้าสู่เกม');
    } else if (st === 'countdown') {
      const left = Math.max(0, Math.ceil((num(S.roomState?.countdownEndsAt, 0) - now()) / 1000));
      showGate(left > 0 ? String(left) : 'GO!', 'เตรียมตัวให้พร้อม ทั้งสองฝั่งจะเข้าเกมพร้อมกัน');
    } else if (st === 'playing') {
      startRoundIfNeeded();
      hideGate();
    } else if (st === 'ended' || st === 'finished') {
      showGate('จบรอบแล้ว', 'กำลังสรุปผลการแข่งรอบนี้');
      finishLocal(txt(S.roomState?.reason || 'ended'));
    } else {
      showGate('กำลังเชื่อมห้อง...', TOASTS.sync);
    }

    if (S.started && !S.ended) {
      updateTargets(ts);

      if (now() >= S.endAtMs) {
        maybeHostEndRound('time-up');
      }

      if (S.self.hp <= 0) {
        maybeHostEndRound('ko');
      }

      writeSelfNow(false).catch(() => {});
    }

    renderHud();
    S.loopId = raf(gameLoop);
  }

  async function bindRoom() {
    if (!ROOM_ID) throw new Error('roomId missing');

    S.refs.root = S.db.ref(roomPath());
    S.refs.meta = S.refs.root.child('meta');
    S.refs.state = S.refs.root.child('state');
    S.refs.players = S.refs.root.child('players');
    S.refs.self = S.refs.players.child(S.uid);

    const snap = await S.refs.root.once('value');
    if (!snap.exists()) throw new Error('room not found');

    const room = snap.val() || {};
    S.roomMeta = room.meta || {};
    S.roomState = room.state || {};
    S.playersMap = room.players || {};
    S.joinedAt = now();

    await S.refs.self.update({
      pid: ensurePid(),
      uid: S.uid,
      playerId: S.uid,
      id: S.uid,
      name: ensureName(),
      nick: ensureName(),
      score: 0,
      miss: 0,
      bestStreak: 0,
      streak: 0,
      hp: 100,
      maxHp: 100,
      shield: 0,
      attackCharge: 0,
      maxAttackCharge: 100,
      attackReady: false,
      attacksUsed: 0,
      damageDealt: 0,
      damageTaken: 0,
      koCount: 0,
      connected: true,
      ready: true,
      alive: true,
      status: txt(S.roomState?.status || 'waiting'),
      joinedAt: now(),
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    try {
      await S.refs.self.onDisconnect().update({
        connected: false,
        status: 'left',
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
      });
    } catch (_) {}

    S.refs.meta.on('value', (s) => {
      S.roomMeta = s.val() || {};
      renderHud();
    });

    S.refs.state.on('value', (s) => {
      S.roomState = s.val() || {};
      renderHud();
      maybeHostPromoteToPlaying();
      if (txt(S.roomState?.status).toLowerCase() === 'ended') {
        finishLocal(txt(S.roomState?.reason || 'ended'));
      }
    });

    S.refs.players.on('value', (s) => {
      S.playersMap = s.val() || {};

      const mine = S.playersMap[S.uid];
      if (mine) {
        syncSelfFromRemote(mine);
      }

      const hostMissing = txt(S.roomMeta?.hostPid) && !S.playersMap[txt(S.roomMeta.hostPid)];
      if (hostMissing && activePlayersArray()[0] && txt(activePlayersArray()[0].uid || activePlayersArray()[0].playerId) === txt(S.uid)) {
        S.refs.meta.update({
          hostPid: S.uid,
          updatedAt: now()
        }).catch(() => {});
      }

      renderHud();
    });

    S.self.pid = ensurePid();
    S.self.name = ensureName();
    updateBattleBootBridge();
  }

  function unbindRoom() {
    try { S.refs.meta && S.refs.meta.off(); } catch (_) {}
    try { S.refs.state && S.refs.state.off(); } catch (_) {}
    try { S.refs.players && S.refs.players.off(); } catch (_) {}
  }

  function onVisibility() {
    if (D.hidden) {
      writeSelfNow(true).catch(() => {});
    }
  }

  function onUnload() {
    stopHeartbeat();
    caf(S.loopId);
    clearTargets();
    writeSelfNow(true).catch(() => {});
  }

  async function boot() {
    injectStyle();
    buildDom();

    if (!ROOM_ID) {
      showGate('เข้าเกมไม่ได้', 'ไม่มี roomId ส่งมาจาก lobby');
      setCoach('กรุณากลับไปสร้างห้องหรือเข้าห้องจาก Battle Lobby ก่อน');
      return;
    }

    if (UI.meName) UI.meName.textContent = ensureName();
    setCoach('กำลังเตรียมห้อง Battle และเชื่อมข้อมูลผู้เล่น');
    toast(TOASTS.sync);

    try {
      await ensureFirebase();
      await bindRoom();
      await writeSelfNow(true);
      startHeartbeat();

      W.HHA_BATTLE_BOOT = {
        uid: S.uid,
        pid: S.self.pid,
        playerId: S.uid,
        name: S.self.name,
        nick: S.self.name,
        roomId: ROOM_ID
      };

      D.addEventListener('visibilitychange', onVisibility);
      W.addEventListener('beforeunload', onUnload);
      W.addEventListener('pagehide', onUnload);

      renderHud();
      S.loopId = raf(gameLoop);
    } catch (err) {
      console.error('[gj-battle] boot failed:', err);
      showGate('เข้า Battle ไม่สำเร็จ', err && err.message ? err.message : 'unknown error');
      setCoach('กลับไปที่ Battle Lobby แล้วลองใหม่อีกครั้ง');
      if (DEBUG && UI.debug) {
        UI.debug.classList.add('show');
        UI.debug.textContent = String(err && err.stack ? err.stack : err);
      }
    }
  }

  boot();
})();