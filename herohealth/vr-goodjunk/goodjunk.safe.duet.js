/* /herohealth/vr-goodjunk/goodjunk.safe.duet.js
   FULL PATCH v20260327-GOODJUNK-DUET-FINAL-V6
   - quota-safe localStorage
   - bindRoom retry ถ้า room ยัง sync มาไม่ทัน
   - bindRoom ไม่ reset score/finished โดยไม่จำเป็น
   - ไม่ลบ room อัตโนมัติแล้ว
   - rematch flow
   - mobile summary scroll/sticky action bar
   - background/unload/reconnect presence แข็งขึ้น
   - กัน result overlay rerender ซ้ำโดยไม่จำเป็น
*/

(function(){
  'use strict';

  const W = window;
  const D = document;
  const $ = (id) => D.getElementById(id);

  const UI = {
    stage: $('duetGameStage'),
    roomPill: $('duetRoomPill'),
    score: $('duetScoreValue'),
    time: $('duetTimeValue'),
    miss: $('duetMissValue'),
    streak: $('duetStreakValue'),

    itemIcon: $('duetItemIcon'),
    itemEmoji: $('duetItemEmoji'),
    itemTitle: $('duetItemTitle'),
    itemSub: $('duetItemSub'),

    goodHit: $('duetGoodHitValue'),
    junkHit: $('duetJunkHitValue'),
    goodMiss: $('duetGoodMissValue'),

    coachBadge: $('duetCoachBadge'),
    tip: $('duetTipText'),

    pairGoalValue: $('duetPairGoalValue'),
    pairGoalFill: $('duetPairGoalFill'),
    pairGoalSubFill: $('duetPairGoalSubFill'),

    hud: $('duetHud'),
    hudToggle: $('duetHudToggle'),

    countdownOverlay: $('duetCountdownOverlay'),
    countdownNum: $('duetCountdownNum'),
    countdownText: $('duetCountdownText'),

    resultMount: $('duetResultMount'),

    btnGoHub: $('btnGoHub'),
    btnBackLauncher: $('btnBackLauncher')
  };

  const qs = (k, d='') => {
    try{
      const v = new URL(W.location.href).searchParams.get(k);
      return (v == null || v === '') ? d : String(v);
    }catch{
      return d;
    }
  };

  const DEBUG = qs('debug', '0') === '1';

  const clamp = (v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  };

  const now = () => Date.now();
  const raf = W.requestAnimationFrame ? W.requestAnimationFrame.bind(W) : (fn => setTimeout(fn, 16));
  const caf = W.cancelAnimationFrame ? W.cancelAnimationFrame.bind(W) : clearTimeout;

  function safeSetItem(key, value){
    try{
      localStorage.setItem(key, value);
      return true;
    }catch(err){
      console.warn('[safeSetItem] failed:', key, err && err.message ? err.message : err);
      return false;
    }
  }

  function safeGetItem(key, fallback = null){
    try{
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    }catch{
      return fallback;
    }
  }

  function safeRemoveItem(key){
    try{
      localStorage.removeItem(key);
    }catch{}
  }

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function xmur3(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normalizeRoomId(raw){
    return String(raw || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
  }

  function makeDevicePid(){
    const KEY = 'GJ_DEVICE_PID';
    let pid = safeGetItem(KEY, '');

    if (!pid){
      pid = 'p-' + Math.random().toString(36).slice(2, 10);
      safeSetItem(KEY, pid);
    }
    return pid;
  }

  function normalizePid(raw){
    const v = String(raw || '').trim().replace(/[.#$[\]/]/g, '-');
    if (!v || v.toLowerCase() === 'anon') return makeDevicePid();
    return v.slice(0, 80);
  }

  function roomPath(roomId){
    return `hha-battle/goodjunk/duetRooms/${roomId}`;
  }

  async function waitMs(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function getRoomSnapshotWithRetry(roomRef, tries = 12, gap = 350){
    let lastSnap = null;

    for (let i = 0; i < tries; i++){
      const snap = await roomRef.once('value');
      lastSnap = snap;

      if (snap && typeof snap.exists === 'function' && snap.exists()) return snap;
      if (snap && typeof snap.val === 'function' && snap.val()) return snap;

      if (i < tries - 1){
        await waitMs(gap);
      }
    }

    return lastSnap;
  }

  function saveLastSummary(summary){
    try{
      safeSetItem('HHA_LAST_SUMMARY', JSON.stringify(summary));

      const key = 'HHA_SUMMARY_HISTORY';
      let arr = [];

      try{
        arr = JSON.parse(safeGetItem(key, '[]') || '[]');
        if (!Array.isArray(arr)) arr = [];
      }catch{
        arr = [];
      }

      arr.unshift(summary);
      arr = arr.slice(0, 8);

      safeSetItem(key, JSON.stringify(arr));
    }catch(err){
      console.warn('[saveLastSummary] failed:', err && err.message ? err.message : err);
    }
  }

  function buildSameRoomLobbyUrl(isRematch){
    const u = new URL('./goodjunk-duet-lobby.html', W.location.href);
    u.searchParams.set('room', STATE.roomId);
    u.searchParams.set('roomId', STATE.roomId);
    u.searchParams.set('pid', STATE.pid);
    u.searchParams.set('name', STATE.name);
    u.searchParams.set('nick', STATE.name);
    u.searchParams.set('hub', STATE.hub);
    u.searchParams.set('diff', STATE.diff);
    u.searchParams.set('time', String(STATE.timeSec));
    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.set('view', STATE.view);
    u.searchParams.set('run', STATE.run);
    u.searchParams.set('zone', STATE.zone);
    u.searchParams.set('theme', STATE.theme);
    if (DEBUG) u.searchParams.set('debug', '1');
    if (isRematch) u.searchParams.set('rematch', '1');
    return u.toString();
  }

  function getCurrentParticipantIds(room){
    const ids = (((room || {}).match || {}).participantIds || []).filter(Boolean);
    if (ids.length) return ids;
    const players = (room && room.players) ? Object.keys(room.players) : [];
    return players.slice(0, 2);
  }

  function getRematchInfo(room){
    const ids = getCurrentParticipantIds(room);
    const votes = (room && room.rematch) ? room.rematch : {};
    let count = 0;

    ids.forEach((id) => {
      if (votes[id] && votes[id].ready) count += 1;
    });

    return { ids, count, votes };
  }

  function resetResultMount(){
    if (!UI.resultMount) return;
    UI.resultMount.hidden = true;
    UI.resultMount.innerHTML = '';
    STATE.resultOpen = false;
    STATE.lastOverlaySig = '';
  }

  function isMobileViewport(){
    return W.matchMedia ? W.matchMedia('(max-width: 760px)').matches : (W.innerWidth <= 760);
  }

  function ensureResultActionsVisible(){
    if (!UI.resultMount) return;
    const card = UI.resultMount.querySelector('.duet-result-card');
    const actions = UI.resultMount.querySelector('.duet-result-actions');
    if (!card || !actions) return;

    (W.requestAnimationFrame || ((fn) => setTimeout(fn, 16)))(() => {
      try{
        if (isMobileViewport()){
          actions.scrollIntoView({ block:'end', inline:'nearest', behavior:'auto' });
          card.scrollTop = Math.max(0, card.scrollTop - 8);
        }else{
          card.scrollTop = 0;
        }
      }catch{}
    });
  }

  const GOOD_ITEMS = [
    { emoji:'🍎', name:'Apple' },
    { emoji:'🍌', name:'Banana' },
    { emoji:'🍉', name:'Watermelon' },
    { emoji:'🥕', name:'Carrot' },
    { emoji:'🥦', name:'Broccoli' },
    { emoji:'🥛', name:'Milk' },
    { emoji:'🍓', name:'Strawberry' },
    { emoji:'🍇', name:'Grapes' }
  ];

  const JUNK_ITEMS = [
    { emoji:'🍟', name:'Fries' },
    { emoji:'🍩', name:'Donut' },
    { emoji:'🍬', name:'Candy' },
    { emoji:'🍭', name:'Lollipop' },
    { emoji:'🧃', name:'Sweet drink' },
    { emoji:'🍪', name:'Cookie' },
    { emoji:'🧁', name:'Cupcake' }
  ];

  const TIPS_GOOD = [
    'แตะอาหารดีให้ไว แล้วช่วยกันทำคะแนนคู่',
    'อาหารดีช่วยเพิ่มคะแนน ลุยต่อได้เลย',
    'แตะต่อเนื่องได้ดีมาก คะแนนจะขึ้นเร็ว',
    'ช่วยกันมองอาหารดีให้ทันก่อนหลุดจอ'
  ];

  const TIPS_JUNK = [
    'ของหวานจัดและของทอดให้ปล่อยผ่าน',
    'ชิ้นที่ไม่ดีต่อสุขภาพไม่ต้องแตะนะ',
    'ระวังอย่าเผลอแตะ junk ไม่งั้นจะเสียคะแนน',
    'เลือกแตะเฉพาะอาหารดี คะแนนจะสวยมาก'
  ];

  const DIFF_CFG = {
    easy:   { spawnEvery: 820, maxTargets: 5, ttl: 2700, speed: 125, goodRatio: 0.78 },
    normal: { spawnEvery: 690, maxTargets: 6, ttl: 2350, speed: 155, goodRatio: 0.72 },
    hard:   { spawnEvery: 560, maxTargets: 7, ttl: 2050, speed: 185, goodRatio: 0.66 }
  };

  const STATE = {
    roomId: normalizeRoomId(qs('roomId') || qs('room') || ''),
    pid: normalizePid(qs('pid') || ''),
    name: String(qs('name') || qs('nick') || 'Player').slice(0, 64),
    hub: qs('hub') || '../hub.html',
    view: (qs('view') || 'mobile').toLowerCase(),
    run: (qs('run') || 'play').toLowerCase(),
    diff: (() => {
      const v = String(qs('diff') || 'normal').toLowerCase();
      return (v === 'easy' || v === 'hard') ? v : 'normal';
    })(),
    timeSec: clamp(qs('time') || 90, 30, 300),
    seed: String(qs('seed') || now()),
    zone: qs('zone') || 'nutrition',
    theme: qs('theme') || 'goodjunk',

    uid: '',
    db: null,
    auth: null,
    roomRef: null,
    meRef: null,

    room: null,
    peerId: '',
    loopId: 0,
    heartbeatTimer: 0,

    rng: null,
    cfg: null,

    prestart: true,
    started: false,
    ended: false,
    resultOpen: false,
    lastOverlaySig: '',

    roomStatus: 'waiting',
    startAt: Number(qs('startAt') || 0) || 0,
    endAt: 0,

    lastFrameAt: 0,
    lastSpawnAt: 0,

    targets: [],
    seq: 0,

    score: 0,
    goodHit: 0,
    junkHit: 0,
    goodMiss: 0,
    miss: 0,
    streak: 0,
    bestStreak: 0,

    peerScore: 0,
    pairScore: 0,
    pairGoal: 360,

    hudCompact: false,
    blockReason: '',
    finishedPublished: false,

    rematchRequested: false,
    rematchRedirected: false,
    rematchResetting: false,
    leaving: false
  };

  safeSetItem('HHA_PLAYER_PID', STATE.pid);
  safeSetItem('HHA_PLAYER_NICK', STATE.name);

  function getCfg(){
    return DIFF_CFG[STATE.diff] || DIFF_CFG.normal;
  }

  function computePairGoal(){
    const base = STATE.timeSec * 3.6;
    const mult = STATE.diff === 'easy' ? 0.95 : (STATE.diff === 'hard' ? 1.18 : 1);
    return Math.max(180, Math.round(base * mult));
  }

  function setCoach(text){
    if (UI.tip) UI.tip.textContent = text;
    if (UI.coachBadge) UI.coachBadge.textContent = '🤖 AI Coach';
  }

  function updateItemGuide(kind){
    if (!UI.itemIcon || !UI.itemEmoji || !UI.itemTitle || !UI.itemSub) return;

    if (kind === 'junk'){
      UI.itemEmoji.textContent = '🍩';
      UI.itemTitle.textContent = 'อาหารควรเลี่ยง';
      UI.itemSub.textContent = 'ชิ้นแบบนี้ไม่ต้องแตะ ปล่อยให้ผ่านไป';
      setCoach(TIPS_JUNK[(STATE.seq + STATE.junkHit) % TIPS_JUNK.length]);
    } else {
      UI.itemEmoji.textContent = '🍉';
      UI.itemTitle.textContent = 'อาหารดี';
      UI.itemSub.textContent = 'แตะอาหารดีให้ไว ช่วยกันทำคะแนน';
      setCoach(TIPS_GOOD[(STATE.seq + STATE.goodHit) % TIPS_GOOD.length]);
    }
  }

  function formatTime(sec){
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function getStageRect(){
    const r = UI.stage ? UI.stage.getBoundingClientRect() : { width: 960, height: 580 };
    return {
      w: Math.max(320, Math.round(r.width || 960)),
      h: Math.max(420, Math.round(r.height || 580))
    };
  }

  function getPeer(room){
    if (!room || !room.players) return null;
    const ids = Object.keys(room.players);
    for (const id of ids){
      if (id !== STATE.uid) return Object.assign({ id }, room.players[id] || {});
    }
    return null;
  }

  function isParticipant(room){
    const ids = (((room || {}).match || {}).participantIds || []);
    return Array.isArray(ids) && ids.includes(STATE.uid);
  }

  function getPeerScore(){
    const peer = getPeer(STATE.room);
    return Number((peer && peer.finalScore) || 0);
  }

  let __runDebugLastPaint = 0;
  function ensureRunDebugBox(){
    if (!DEBUG) return null;
    let el = D.getElementById('duetRunDebugBox');
    if (el) return el;

    el = D.createElement('div');
    el.id = 'duetRunDebugBox';
    el.style.cssText = [
      'position:fixed',
      'left:10px',
      'right:10px',
      'bottom:10px',
      'z-index:9999',
      'padding:10px 12px',
      'border-radius:14px',
      'border:1px solid rgba(191,227,242,.9)',
      'background:rgba(15,23,42,.92)',
      'color:#f8fafc',
      'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
      'box-shadow:0 18px 40px rgba(0,0,0,.28)',
      'white-space:pre-wrap',
      'word-break:break-word',
      'backdrop-filter:blur(8px)',
      'max-height:42vh',
      'overflow:auto'
    ].join(';');

    D.body.appendChild(el);
    return el;
  }

  function renderRunDebug(){
    if (!DEBUG) return;

    const t = now();
    if (t - __runDebugLastPaint < 120) return;
    __runDebugLastPaint = t;

    const el = ensureRunDebugBox();
    if (!el) return;

    const room = STATE.room || {};
    const peer = getPeer(room) || {};
    const match = room.match || {};
    const leftSec = STATE.started ? Math.max(0, (STATE.endAt - now()) / 1000).toFixed(1) : '-';
    const me = room.players && STATE.uid ? (room.players[STATE.uid] || null) : null;

    const lines = [
      '[DUET RUN DEBUG]',
      `room=${STATE.roomId || '-'}`,
      `uid=${STATE.uid || '-'}`,
      `pid=${STATE.pid || '-'}`,
      `status=${String(room.status || STATE.roomStatus || '-')}`,
      `startAt=${Number(room.startAt || STATE.startAt || 0)}`,
      `started=${STATE.started}`,
      `ended=${STATE.ended}`,
      `leftSec=${leftSec}`,
      `targetCount=${STATE.targets.length}`,
      `score=${STATE.score}`,
      `peerScore=${Number(peer.finalScore || 0)}`,
      `pairScore=${STATE.pairScore}`,
      `pairGoal=${STATE.pairGoal}`,
      `goodHit=${STATE.goodHit}`,
      `junkHit=${STATE.junkHit}`,
      `goodMiss=${STATE.goodMiss}`,
      `miss=${STATE.miss}`,
      `streak=${STATE.streak}`,
      `bestStreak=${STATE.bestStreak}`,
      `participantIds=${Array.isArray(match.participantIds) ? match.participantIds.join(', ') : '-'}`,
      `peerUid=${peer.id || '-'}`,
      `peerName=${peer.name || '-'}`,
      `peerConnected=${peer.id ? (peer.connected !== false) : '-'}`,
      `peerFinished=${peer.id ? (!!peer.finished) : '-'}`,
      `peerLastSeen=${peer.id ? Number(peer.lastSeenAt || 0) : 0}`,
      `myPhase=${me ? String(me.phase || '-') : '-'}`,
      `myFinished=${me ? (!!me.finished) : '-'}`,
      `blockReason=${STATE.blockReason || '-'}`,
      `rematchRequested=${STATE.rematchRequested}`,
      `rematchCount=${getRematchInfo(room).count}`,
      `rematchResetting=${STATE.rematchResetting}`
    ];

    el.textContent = lines.join('\n');
  }

  function renderHud(){
    if (UI.roomPill) UI.roomPill.textContent = `ห้อง ${STATE.roomId || '-'}`;
    if (UI.score) UI.score.textContent = String(Math.max(0, Math.round(STATE.score)));
    if (UI.time) {
      const left = STATE.started ? Math.max(0, (STATE.endAt - now()) / 1000) : (STATE.timeSec || 0);
      UI.time.textContent = formatTime(left);
    }
    if (UI.miss) UI.miss.textContent = String(STATE.miss);
    if (UI.streak) UI.streak.textContent = String(STATE.streak);

    if (UI.goodHit) UI.goodHit.textContent = String(STATE.goodHit);
    if (UI.junkHit) UI.junkHit.textContent = String(STATE.junkHit);
    if (UI.goodMiss) UI.goodMiss.textContent = String(STATE.goodMiss);

    if (UI.pairGoalValue) UI.pairGoalValue.textContent = String(STATE.pairGoal);
    if (UI.pairGoalFill){
      const pct = Math.max(0, Math.min(100, (STATE.pairScore / Math.max(1, STATE.pairGoal)) * 100));
      UI.pairGoalFill.style.width = pct.toFixed(1) + '%';
    }
    if (UI.pairGoalSubFill){
      const mine = Math.max(0, Math.min(100, (STATE.score / Math.max(1, STATE.pairGoal)) * 100));
      UI.pairGoalSubFill.style.width = mine.toFixed(1) + '%';
    }

    renderRunDebug();
  }

  function applyHudCompact(flag){
    STATE.hudCompact = !!flag;
    const children = UI.hud ? Array.from(UI.hud.children) : [];
    children.forEach((el, idx) => {
      if (idx <= 2) return;
      el.style.display = STATE.hudCompact ? 'none' : '';
    });
    if (UI.hudToggle) UI.hudToggle.textContent = STATE.hudCompact ? '＋' : '⋯';
  }

  function toggleHudCompact(){
    applyHudCompact(!STATE.hudCompact);
  }

  function showCountdown(text, num){
    if (UI.countdownOverlay) UI.countdownOverlay.classList.add('show');
    if (UI.countdownText) UI.countdownText.textContent = text || 'เตรียมตัว';
    if (UI.countdownNum) UI.countdownNum.textContent = String(num || '3');
  }

  function hideCountdown(){
    if (UI.countdownOverlay) UI.countdownOverlay.classList.remove('show');
  }

  function makeTarget(kind){
    const rect = getStageRect();
    const size = Math.round(58 + STATE.rng() * 28);
    const pad = 10;
    const x = pad + Math.round((rect.w - size - pad * 2) * STATE.rng());
    const y = -size - Math.round(STATE.rng() * 30);
    const speed = STATE.cfg.speed * (0.9 + STATE.rng() * 0.55);
    const sway = (STATE.rng() - 0.5) * 48;
    const ttl = Math.round(STATE.cfg.ttl * (0.9 + STATE.rng() * 0.22));
    const src = kind === 'good' ? GOOD_ITEMS : JUNK_ITEMS;
    const meta = src[Math.floor(STATE.rng() * src.length)];

    const el = D.createElement('button');
    el.type = 'button';
    el.className = `target ${kind}`;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.setAttribute('aria-label', meta.name);
    el.innerHTML = `<span class="t-emoji">${meta.emoji}</span>`;

    const t = {
      id: `t${++STATE.seq}`,
      kind,
      emoji: meta.emoji,
      name: meta.name,
      x, y, size,
      speed,
      sway,
      bornAt: now(),
      ttl,
      dead: false,
      el
    };

    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      hitTarget(t);
    }, { passive:false });

    UI.stage.appendChild(el);
    STATE.targets.push(t);
    updateItemGuide(kind);
  }

  function spawnTarget(){
    if (!STATE.started || STATE.ended) return;
    if (!UI.stage) return;
    if (STATE.targets.length >= STATE.cfg.maxTargets) return;
    const kind = STATE.rng() < STATE.cfg.goodRatio ? 'good' : 'junk';
    makeTarget(kind);
  }

  function removeTarget(t){
    if (!t || t.dead) return;
    t.dead = true;
    try{ t.el && t.el.remove(); }catch{}
  }

  function pulseScore(){
    if (!UI.score || !UI.score.animate) return;
    UI.score.animate(
      [{ transform:'scale(1)' }, { transform:'scale(1.08)' }, { transform:'scale(1)' }],
      { duration:180, easing:'ease-out' }
    );
  }

  function hitTarget(t){
    if (!t || t.dead || !STATE.started || STATE.ended) return;

    removeTarget(t);

    if (t.kind === 'good'){
      STATE.streak += 1;
      STATE.bestStreak = Math.max(STATE.bestStreak, STATE.streak);
      const comboBonus = Math.min(12, Math.floor(STATE.streak / 3) * 2);
      const gain = 10 + comboBonus;
      STATE.score += gain;
      STATE.goodHit += 1;
      setCoach('เก่งมาก แตะอาหารดีต่อเนื่องได้เลย');
    } else {
      STATE.junkHit += 1;
      STATE.miss += 1;
      STATE.streak = 0;
      STATE.score = Math.max(0, STATE.score - 8);
      setCoach('ไม่เป็นไร รอบหน้าปล่อยอาหารควรเลี่ยงผ่านไปนะ');
    }

    pulseScore();
    refreshLiveScore();
    renderHud();
  }

  function expireTarget(t){
    removeTarget(t);
    if (t.kind === 'good'){
      STATE.goodMiss += 1;
      STATE.miss += 1;
      STATE.streak = 0;
      setCoach('อาหารดีหลุดไปแล้ว ลองแตะให้ไวขึ้นอีกนิด');
      renderHud();
      refreshLiveScore();
    }
  }

  function clearTargets(){
    STATE.targets.forEach(removeTarget);
    STATE.targets = [];
  }

  function refreshLiveScore(){
    STATE.peerScore = getPeerScore();
    STATE.pairScore = STATE.score + STATE.peerScore;
    renderHud();
  }

  function pickCoachTip(){
    const left = STATE.started ? Math.max(0, (STATE.endAt - now()) / 1000) : STATE.timeSec;

    if (STATE.junkHit >= 3 && STATE.junkHit > STATE.goodHit / 2){
      return 'ลองแตะเฉพาะอาหารดีให้มากขึ้นนะ';
    }
    if (STATE.goodMiss >= 3 && STATE.goodMiss > STATE.goodHit / 2){
      return 'อาหารดีหลุดหลายชิ้น ลองมองให้ไวขึ้นอีกนิด';
    }
    if (STATE.streak >= 6){
      return 'ยอดเยี่ยมมาก แตะต่อเนื่องได้ดีสุด ๆ';
    }
    if (left <= 15 && STATE.pairScore < STATE.pairGoal){
      return 'ใกล้หมดเวลาแล้ว รีบช่วยกันเก็บอาหารดี';
    }
    if (STATE.pairScore >= STATE.pairGoal){
      return 'ถึงเป้าหมายคู่แล้ว เก่งมาก ลุยต่อได้เลย';
    }
    return TIPS_GOOD[(STATE.goodHit + STATE.junkHit + STATE.goodMiss) % TIPS_GOOD.length];
  }

  function coachTick(){
    setCoach(pickCoachTip());
  }

  function isPeerStale(room){
    const peer = getPeer(room);
    if (!peer || !peer.id) return false;
    if (peer.connected !== false) return false;
    return (now() - Number(peer.lastSeenAt || 0)) > 45000;
  }

  function loop(frameTs){
    if (STATE.ended) return;

    const ts = Number(frameTs || (W.performance ? W.performance.now() : Date.now()));
    if (!STATE.lastFrameAt) STATE.lastFrameAt = ts;
    const dt = Math.min(40, ts - STATE.lastFrameAt) / 1000;
    STATE.lastFrameAt = ts;

    if (!STATE.started){
      prestartTick();
      STATE.loopId = raf(loop);
      return;
    }

    const tNow = now();

    if (STATE.started && !STATE.ended && isPeerStale(STATE.room)){
      setCoach('เพื่อนหลุดจากห้องนานเกินกำหนด กำลังสรุปผลจากคะแนนล่าสุด');
      finishGame('peer-stale');
      return;
    }

    if (STATE.lastSpawnAt === 0) STATE.lastSpawnAt = tNow;
    if (tNow - STATE.lastSpawnAt >= STATE.cfg.spawnEvery){
      STATE.lastSpawnAt = tNow;
      spawnTarget();
    }

    const rect = getStageRect();

    for (let i = STATE.targets.length - 1; i >= 0; i--){
      const t = STATE.targets[i];
      if (!t || t.dead){
        STATE.targets.splice(i, 1);
        continue;
      }

      t.y += t.speed * dt;
      t.x += Math.sin((tNow - t.bornAt) / 240) * t.sway * dt;
      t.x = Math.max(2, Math.min(rect.w - t.size - 2, t.x));

      t.el.style.left = t.x.toFixed(1) + 'px';
      t.el.style.top = t.y.toFixed(1) + 'px';

      const expired = (tNow - t.bornAt > t.ttl) || (t.y > rect.h + t.size + 8);
      if (expired){
        STATE.targets.splice(i, 1);
        expireTarget(t);
      }
    }

    refreshLiveScore();
    renderHud();

    const leftMs = STATE.endAt - tNow;
    if (leftMs <= 0){
      finishGame('timer-end');
      return;
    }

    STATE.loopId = raf(loop);
  }

  function prestartTick(){
    if (STATE.blockReason) return;
    resetResultMount();

    const room = STATE.room;
    const status = String((room && room.status) || STATE.roomStatus || 'waiting');
    const startAt = Number((room && room.startAt) || STATE.startAt || 0);

    if (!room){
      showCountdown('กำลังเชื่อมห้อง Duet...', '…');
      return;
    }

    if (!isParticipant(room)){
      showCountdown('รอบนี้ยังไม่พร้อมสำหรับผู้เล่นคนนี้ ลองกลับไปเข้าห้องใหม่อีกครั้ง', '!');
      return;
    }

    if ((status === 'countdown' || status === 'running') && startAt){
      const ms = startAt - now();
      if (ms > 0){
        const sec = Math.ceil(ms / 1000);
        showCountdown('พร้อมแล้วทั้งคู่ กำลังเริ่มเล่น', String(sec));
        return;
      }
      startGame();
      return;
    }

    if (status === 'running' && !startAt){
      startGame();
      return;
    }

    showCountdown('รอหัวหน้าห้องกดเริ่มเกม', '…');
  }

  async function markRoomRunning(){
    if (!STATE.roomRef) return;
    try{
      const room = STATE.room;
      const isHost = room && room.hostId === STATE.uid;
      if (isHost){
        await STATE.roomRef.update({
          status: 'running',
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        await STATE.roomRef.child('match/status').set('running');
      }
    }catch{}
  }

  function startGame(){
    if (STATE.started || STATE.ended) return;

    STATE.blockReason = '';
    resetResultMount();

    STATE.started = true;
    STATE.prestart = false;
    STATE.roomStatus = 'running';
    STATE.endAt = now() + STATE.timeSec * 1000;
    STATE.lastFrameAt = 0;
    STATE.lastSpawnAt = 0;
    hideCountdown();
    markRoomRunning();
    coachTick();
  }

  async function publishLivePresence(){
    if (!STATE.meRef) return;
    try{
      await STATE.meRef.update({
        id: STATE.uid,
        uid: STATE.uid,
        pid: STATE.pid,
        name: STATE.name,
        connected: true,
        ready: true,
        phase: STATE.ended ? 'done' : (STATE.started ? 'run' : 'lobby'),
        finished: !!STATE.ended,
        finalScore: Number(STATE.score || 0),
        miss: Number(STATE.miss || 0),
        streak: Number(STATE.bestStreak || 0),
        lastSeenAt: firebase.database.ServerValue.TIMESTAMP,
        finishedAt: STATE.ended ? firebase.database.ServerValue.TIMESTAMP : 0
      });
    }catch{}
  }

  function startHeartbeat(){
    stopHeartbeat();
    STATE.heartbeatTimer = setInterval(() => {
      publishLivePresence();
      maybeFinalizeRoom();
    }, 2500);
  }

  function stopHeartbeat(){
    if (STATE.heartbeatTimer){
      clearInterval(STATE.heartbeatTimer);
      STATE.heartbeatTimer = 0;
    }
  }

  function getTransientPhase(){
    if (STATE.ended) return 'done';

    const room = STATE.room || null;
    const status = String((room && room.status) || STATE.roomStatus || 'waiting');

    if (STATE.started || status === 'countdown' || status === 'running'){
      return 'run';
    }
    return 'lobby';
  }

  async function markDisconnectedForSuspend(){
    try{
      if (STATE.meRef){
        await STATE.meRef.update({
          connected: false,
          phase: getTransientPhase(),
          lastSeenAt: firebase.database.ServerValue.TIMESTAMP
        });
      }
    }catch{}
  }

  async function markReconnectedAfterResume(){
    try{
      if (STATE.meRef){
        await STATE.meRef.update({
          connected: true,
          phase: STATE.ended ? 'done' : (STATE.started ? 'run' : 'lobby'),
          lastSeenAt: firebase.database.ServerValue.TIMESTAMP
        });
      }
    }catch{}
  }

  function buildSummary(){
    const peer = getPeer(STATE.room) || {};
    const peerName = String(peer.name || 'เพื่อน');
    const peerFinished = !!peer.finished;
    return {
      game: 'goodjunk',
      mode: 'duet',
      roomId: STATE.roomId,
      pid: STATE.pid,
      name: STATE.name,
      partnerName: peerName,
      diff: STATE.diff,
      time: STATE.timeSec,
      seed: STATE.seed,
      view: STATE.view,
      zone: STATE.zone,
      theme: STATE.theme,
      score: STATE.score,
      partnerScore: Number(peer.finalScore || 0),
      pairScore: STATE.score + Number(peer.finalScore || 0),
      pairGoal: STATE.pairGoal,
      goodHit: STATE.goodHit,
      junkHit: STATE.junkHit,
      goodMiss: STATE.goodMiss,
      miss: STATE.miss,
      bestStreak: STATE.bestStreak,
      partnerFinished: peerFinished,
      endedAt: new Date().toISOString(),
      version: 'v20260327-GOODJUNK-DUET-FINAL-V6'
    };
  }

  function getPraiseMeta(){
    const ratio = STATE.pairGoal > 0 ? (STATE.pairScore / STATE.pairGoal) : 0;
    const accBase = STATE.goodHit + STATE.junkHit + STATE.goodMiss;
    const accuracy = accBase > 0 ? (STATE.goodHit / accBase) : 0;

    let title = 'เก่งมาก เล่นคู่ได้ดี';
    let sub = 'ช่วยกันแตะอาหารดีได้ดีมาก';
    let stars = 2;
    const badges = [];

    if (ratio >= 1.45){
      title = 'สุดยอดมาก คะแนนคู่พุ่งเลย';
      sub = 'ทั้งคู่ช่วยกันได้เยี่ยมมาก เก็บอาหารดีได้ต่อเนื่องสุด ๆ';
      stars = 3;
      badges.push({ cls:'good', text:'🌟 คะแนนคู่ยอดเยี่ยม' });
    } else if (ratio >= 1.0){
      title = 'เยี่ยมมาก ทำคะแนนคู่ได้ดีมาก';
      sub = 'ถึงเป้าหมายคู่แล้ว เก่งมากทั้งสองคน';
      stars = 3;
      badges.push({ cls:'good', text:'🎯 ถึงเป้าหมายแล้ว' });
    } else if (ratio >= 0.7){
      title = 'เก่งมาก ใกล้ถึงเป้าหมายแล้ว';
      sub = 'อีกนิดเดียวก็ถึงเป้าหมายคู่แล้ว';
      stars = 2;
      badges.push({ cls:'pink', text:'💪 ใกล้ถึงเป้าหมาย' });
    } else {
      title = 'เริ่มได้ดี ลองอีกครั้งนะ';
      sub = 'ครั้งหน้าช่วยกันแตะอาหารดีให้มากขึ้นอีกนิด';
      stars = 1;
      badges.push({ cls:'warn', text:'🔁 ลองอีกครั้ง' });
    }

    if (accuracy >= 0.72){
      badges.push({ cls:'good', text:'🍉 เลือกอาหารดีเก่งมาก' });
    } else if (STATE.junkHit >= 6){
      badges.push({ cls:'warn', text:'🍩 ระวัง Junk เพิ่มอีกนิด' });
    }

    if (STATE.bestStreak >= 12){
      badges.push({ cls:'pink', text:'🔥 แตะต่อเนื่องเก่งมาก' });
    }

    if (STATE.goodMiss >= 20){
      badges.push({ cls:'warn', text:'👀 ลองมองอาหารดีให้ไวขึ้น' });
    }

    return { title, sub, stars, badges };
  }

  function getRecapLines(){
    const peer = getPeer(STATE.room) || {};
    const peerNameRaw = String(peer.name || 'เพื่อน');
    const peerName = peerNameRaw.trim() || 'เพื่อน';

    return [
      {
        k: 'สิ่งที่ทำได้ดี',
        v: STATE.goodHit >= Math.max(10, STATE.junkHit * 2)
          ? 'แตะอาหารดีได้เยอะมาก ช่วยดันคะแนนคู่ขึ้นดีมาก'
          : 'ช่วยกันเล่นจนคะแนนคู่เพิ่มขึ้นต่อเนื่อง'
      },
      {
        k: 'ลองพัฒนาต่อ',
        v: STATE.goodMiss > STATE.junkHit
          ? 'ถ้าแตะอาหารดีได้ไวขึ้นอีกนิด คะแนนจะขึ้นเร็วมาก'
          : 'ถ้าระวัง Junk มากขึ้น คะแนนจะสวยกว่าเดิม'
      },
      {
        k: 'เพื่อนร่วมทีม',
        v: `${peerName} ช่วยทำคะแนนได้ ${Number(peer.finalScore || 0)} คะแนน`
      }
    ];
  }

  function buildConfettiHtml(count){
    const colors = ['pink','blue','green','gold','violet'];
    const pieces = [];

    for (let i = 0; i < count; i++){
      const left = Math.random() * 100;
      const dx = (Math.random() * 180 - 90).toFixed(1) + 'px';
      const rot = (360 + Math.random() * 540).toFixed(0) + 'deg';
      const dur = (2.6 + Math.random() * 1.8).toFixed(2) + 's';
      const delay = (Math.random() * 0.45).toFixed(2) + 's';
      const color = colors[i % colors.length];
      const w = (8 + Math.random() * 8).toFixed(0) + 'px';
      const h = (14 + Math.random() * 14).toFixed(0) + 'px';

      pieces.push(
        `<span class="duet-confetti-piece ${color}" style="left:${left}%;width:${w};height:${h};--dx:${dx};--rot:${rot};animation-duration:${dur};animation-delay:${delay};"></span>`
      );
    }

    return `<div class="duet-confetti" aria-hidden="true">${pieces.join('')}</div>`;
  }

  function getCelebrationFlags(goalReached){
    return {
      cardClass: goalReached ? 'celebrate' : '',
      starClass: goalReached ? 'celebrate' : '',
      pairClass: goalReached ? 'celebrate' : '',
      confettiHtml: goalReached ? buildConfettiHtml(26) : ''
    };
  }

  function getTrophyBadges(){
    const out = [];

    if (STATE.pairScore >= STATE.pairGoal){
      out.push({ cls:'good', text:'🏆 ทำคะแนนถึงเป้าหมายคู่' });
    } else {
      out.push({ cls:'gold', text:'🎯 ยังเหลืออีกนิดก็ถึงเป้า' });
    }

    if (STATE.bestStreak >= 10){
      out.push({ cls:'good', text:'🔥 ต่อเนื่องเก่งมาก' });
    }

    if (STATE.goodHit >= Math.max(20, STATE.junkHit * 2)){
      out.push({ cls:'good', text:'🍉 เลือกอาหารดีเก่งมาก' });
    }

    if (STATE.junkHit <= 3){
      out.push({ cls:'gold', text:'🛡️ ระวัง Junk ได้ดี' });
    }

    return out;
  }

  async function requestRematch(){
    if (!STATE.roomRef || !STATE.uid) return;
    STATE.rematchRequested = true;

    await STATE.roomRef.child('rematch/' + STATE.uid).set({
      uid: STATE.uid,
      pid: STATE.pid,
      name: STATE.name,
      ready: true,
      requestedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  async function maybeResetRoomForRematch(room){
    if (!STATE.roomRef || !room || STATE.rematchResetting) return;

    const status = String(room.status || 'waiting');
    if (status !== 'finished') return;

    const info = getRematchInfo(room);
    if (info.ids.length !== 2) return;
    if (info.count < 2) return;
    if (room.hostId !== STATE.uid) return;

    STATE.rematchResetting = true;

    try{
      await new Promise((resolve, reject) => {
        STATE.roomRef.transaction((current) => {
          if (!current) return current;

          const currentStatus = String(current.status || 'waiting');
          if (currentStatus !== 'finished') return current;

          const ids = getCurrentParticipantIds(current);
          const infoNow = getRematchInfo(current);
          if (ids.length !== 2 || infoNow.count < 2) return current;

          const t = now();
          current.status = 'waiting';
          current.startAt = 0;
          current.updatedAt = t;
          current.seed = String(t);
          current.match = {
            participantIds: [],
            lockedAt: 0,
            status: 'idle',
            finishedAt: 0
          };
          current.rematch = {};
          current.players = current.players || {};

          ids.forEach((id) => {
            const oldP = current.players[id] || {};
            current.players[id] = Object.assign({}, oldP, {
              id,
              uid: id,
              ready: false,
              phase: 'lobby',
              finished: false,
              finalScore: 0,
              miss: 0,
              streak: 0,
              finishedAt: 0,
              connected: true,
              lastSeenAt: t
            });
          });

          return current;
        }, (err, committed) => {
          if (err) return reject(err);
          if (!committed) return reject(new Error('rematch-reset-aborted'));
          resolve();
        }, false);
      });
    }catch(err){
      console.error('[duet.rematch.reset] failed:', err);
    }finally{
      STATE.rematchResetting = false;
    }
  }

  async function leaveFinishedRoomAndMaybeCleanup(nextHref){
    if (STATE.leaving) return;
    STATE.leaving = true;

    try{
      if (STATE.meRef){
        await STATE.meRef.update({
          connected: false,
          phase: STATE.ended ? 'done' : 'left',
          lastSeenAt: firebase.database.ServerValue.TIMESTAMP
        });
      }
    }catch(err){
      console.warn('[duet.leave] meRef update failed:', err);
    }

    W.location.href = nextHref;
  }

  function renderResultOverlay(reason){
    if (!UI.resultMount) return;

    const peer = getPeer(STATE.room) || {};
    const peerNameRaw = String(peer.name || 'เพื่อน');
    const peerName = peerNameRaw.trim() || 'เพื่อน';
    const peerScore = Number(peer.finalScore || 0);
    const pairScore = STATE.score + peerScore;
    STATE.pairScore = pairScore;

    const goalReached = pairScore >= STATE.pairGoal;
    const peerDone = !!peer.finished;
    const rematchInfo = getRematchInfo(STATE.room);

    const overlaySig = JSON.stringify({
      reason: String(reason || ''),
      peerScore,
      peerDone,
      pairScore,
      rematchCount: rematchInfo.count,
      rematchRequested: !!STATE.rematchRequested,
      roomStatus: String((STATE.room && STATE.room.status) || ''),
      goalReached
    });

    if (STATE.resultOpen && STATE.lastOverlaySig === overlaySig){
      return;
    }
    STATE.lastOverlaySig = overlaySig;

    const statusText = reason === 'peer-stale'
      ? 'เพื่อนหลุดจากห้องนานเกินกำหนด จึงสรุปผลจากคะแนนล่าสุด'
      : reason === 'rematch-requested'
        ? 'ส่งคำขอรีแมตช์แล้ว รอเพื่อนกดรีแมตช์'
        : reason === 'room-finished'
          ? 'รอบนี้ปิดจากห้องส่วนกลางแล้ว'
          : (peerDone
              ? 'เพื่อนเล่นจบแล้ว มาดูคะแนนคู่กัน'
              : 'กำลังรอคะแนนจากเพื่อนอีกนิด');

    const peerStatusHtml = peerDone
      ? '<span class="duet-sum-status done">เล่นจบแล้ว</span>'
      : '<span class="duet-sum-status wait">กำลังรอคะแนน</span>';

    const praise = getPraiseMeta();
    const recap = getRecapLines();
    const trophies = getTrophyBadges();
    const fx = getCelebrationFlags(goalReached);
    const rematchBadges = [
      `<span class="duet-badge blue">🔁 รีแมตช์ ${rematchInfo.count}/2</span>`
    ];

    if (STATE.rematchRequested && rematchInfo.count < 2){
      rematchBadges.push(`<span class="duet-badge gold">⌛ รอเพื่อนกดรีแมตช์</span>`);
    }

    const starsHtml = Array.from({ length: praise.stars }, () => '<span class="duet-star">⭐</span>').join('');
    const badgesHtml = praise.badges
      .map(b => `<span class="duet-badge ${esc(b.cls)}">${esc(b.text)}</span>`)
      .concat(rematchBadges)
      .join('');
    const trophiesHtml = trophies.map(t => `<span class="duet-trophy ${esc(t.cls)}">${esc(t.text)}</span>`).join('');

    const summary = buildSummary();
    saveLastSummary(summary);

    UI.resultMount.hidden = false;
    STATE.resultOpen = true;
    UI.resultMount.innerHTML = `
      <div class="duet-result-card hubv2 ${fx.cardClass}">
        ${fx.confettiHtml}

        <div class="duet-summary-head" style="position:relative;z-index:1;">
          <div class="duet-summary-kicker">👯 GOODJUNK • สรุปผลเล่นคู่</div>
          <div class="duet-result-title">${goalReached ? 'เยี่ยมมาก ทำคะแนนคู่ได้ดีมาก' : 'จบรอบเล่นคู่แล้ว'}</div>
          <div class="duet-result-sub">
            ${esc('สรุปคะแนนของฉัน + เพื่อน + คะแนนคู่')}<br>
            ${esc(statusText)}
          </div>
        </div>

        <div class="duet-praise hubv2" style="position:relative;z-index:1;">
          <div class="duet-mobile-quick-actions"></div>

          <div class="duet-praise-top">
            <div>
              <div class="duet-praise-title">${esc(praise.title)}</div>
              <div class="duet-praise-sub">${esc(praise.sub)}</div>
            </div>
            <div class="duet-stars big ${fx.starClass}">${starsHtml}</div>
          </div>

          <div class="duet-badges">${badgesHtml}</div>
          <div class="duet-trophy-strip">${trophiesHtml}</div>
        </div>

        <div class="duet-sum-top" style="position:relative;z-index:1;">
          <div class="duet-sum-top-card hubv2">
            <div class="duet-sum-top-label">ฉัน</div>
            <div class="duet-sum-top-score me">${STATE.score}</div>
            <div class="duet-sum-top-sub">
              แตะอาหารดี ${STATE.goodHit} • โดน Junk ${STATE.junkHit} • พลาด ${STATE.miss}
            </div>
          </div>

          <div class="duet-sum-top-card hubv2">
            <div class="duet-sum-top-label">${esc(peerName)}</div>
            <div class="duet-sum-top-score peer">${peerScore}</div>
            <div class="duet-sum-top-sub">
              ${peerStatusHtml}
            </div>
          </div>

          <div class="duet-sum-top-card hubv2 goal">
            <div class="duet-sum-top-label">คะแนนคู่</div>
            <div class="duet-sum-top-score pair ${fx.pairClass}">${pairScore}</div>
            <div class="duet-sum-top-sub">
              เป้าหมาย ${STATE.pairGoal}
              <span class="${goalReached ? 'duet-sum-goal-ok' : 'duet-sum-goal-wait'}">
                ${goalReached ? '• ถึงเป้าแล้ว' : '• ยังไปต่อได้'}
              </span>
            </div>
          </div>
        </div>

        <div class="duet-sum-stats" style="position:relative;z-index:1;">
          <div class="duet-sum-stat hubv2">
            <div class="duet-sum-stat-k">ต่อเนื่องสูงสุด</div>
            <div class="duet-sum-stat-v">${STATE.bestStreak}</div>
          </div>
          <div class="duet-sum-stat hubv2">
            <div class="duet-sum-stat-k">แตะอาหารดี</div>
            <div class="duet-sum-stat-v">${STATE.goodHit}</div>
          </div>
          <div class="duet-sum-stat hubv2">
            <div class="duet-sum-stat-k">โดน Junk</div>
            <div class="duet-sum-stat-v">${STATE.junkHit}</div>
          </div>
          <div class="duet-sum-stat hubv2">
            <div class="duet-sum-stat-k">พลาดอาหารดี</div>
            <div class="duet-sum-stat-v">${STATE.goodMiss}</div>
          </div>
        </div>

        <div class="duet-recap" style="position:relative;z-index:1;">
          ${recap.map(item => `
            <div class="duet-recap-card hubv2">
              <div class="duet-recap-k">${esc(item.k)}</div>
              <div class="duet-recap-v">${esc(item.v)}</div>
            </div>
          `).join('')}
        </div>

        <div class="duet-result-actions hubv2" style="position:relative;z-index:1;">
          <button class="btn good" id="duetBtnRematch" type="button">${STATE.rematchRequested ? 'กำลังรอรีแมตช์...' : 'ขอรีแมตช์'}</button>
          <button class="btn ghost" id="duetBtnBackLobby" type="button">กลับไป Lobby ห้องเดิม</button>
          <button class="btn ghost" id="duetBtnBackLauncher" type="button">กลับหน้าเลือกโหมด</button>
          <button class="btn primary" id="duetBtnBackHub" type="button">กลับหน้าหลัก</button>
          <button class="btn ghost" id="duetBtnClose" type="button">ปิดหน้าสรุป</button>
        </div>
      </div>
    `;

    const resultCard = UI.resultMount.querySelector('.duet-result-card');
    if (resultCard){
      resultCard.scrollTop = 0;
      resultCard.style.webkitOverflowScrolling = 'touch';
      resultCard.style.overscrollBehavior = 'contain';
      resultCard.style.touchAction = 'pan-y';
    }

    UI.resultMount.scrollTop = 0;
    UI.resultMount.style.overflowY = 'auto';
    UI.resultMount.style.webkitOverflowScrolling = 'touch';
    UI.resultMount.style.overscrollBehavior = 'contain';

    const quickWrap = UI.resultMount.querySelector('.duet-mobile-quick-actions');
    if (quickWrap && isMobileViewport()){
      quickWrap.innerHTML = `
        <button class="btn good" id="duetBtnRematchTop" type="button">${STATE.rematchRequested ? 'รอรีแมตช์...' : 'รีแมตช์'}</button>
        <button class="btn ghost" id="duetBtnBackLobbyTop" type="button">กลับ Lobby</button>
      `;
    }

    ensureResultActionsVisible();

    const btnClose = $('duetBtnClose');
    const btnRematch = $('duetBtnRematch');
    const btnBackLobby = $('duetBtnBackLobby');
    const btnBackLauncher = $('duetBtnBackLauncher');
    const btnBackHub = $('duetBtnBackHub');
    const btnRematchTop = $('duetBtnRematchTop');
    const btnBackLobbyTop = $('duetBtnBackLobbyTop');

    if (btnClose){
      btnClose.addEventListener('click', () => {
        resetResultMount();
      });
    }

    if (btnRematch){
      btnRematch.disabled = !!STATE.rematchRequested;
      btnRematch.addEventListener('click', async () => {
        if (STATE.rematchRequested) return;
        btnRematch.disabled = true;
        btnRematch.textContent = 'กำลังรอรีแมตช์...';

        try{
          await requestRematch();
          renderResultOverlay('rematch-requested');
        }catch(err){
          console.error('[duet.rematch.request] failed:', err);
          btnRematch.disabled = false;
          btnRematch.textContent = 'ขอรีแมตช์';
        }
      });
    }

    if (btnBackLobby){
      btnBackLobby.addEventListener('click', () => {
        leaveFinishedRoomAndMaybeCleanup(buildSameRoomLobbyUrl(false));
      });
    }

    if (btnBackLauncher){
      btnBackLauncher.addEventListener('click', () => {
        leaveFinishedRoomAndMaybeCleanup(
          (UI.btnBackLauncher && UI.btnBackLauncher.href) || '../goodjunk-launcher.html'
        );
      });
    }

    if (btnBackHub){
      btnBackHub.addEventListener('click', () => {
        leaveFinishedRoomAndMaybeCleanup(STATE.hub);
      });
    }

    if (btnRematchTop){
      btnRematchTop.disabled = !!STATE.rematchRequested;
      btnRematchTop.addEventListener('click', async () => {
        if (STATE.rematchRequested) return;
        btnRematchTop.disabled = true;
        btnRematchTop.textContent = 'รอรีแมตช์...';

        try{
          await requestRematch();
          renderResultOverlay('rematch-requested');
        }catch(err){
          console.error('[duet.rematch.request.top] failed:', err);
          btnRematchTop.disabled = false;
          btnRematchTop.textContent = 'รีแมตช์';
        }
      });
    }

    if (btnBackLobbyTop){
      btnBackLobbyTop.addEventListener('click', () => {
        leaveFinishedRoomAndMaybeCleanup(buildSameRoomLobbyUrl(false));
      });
    }
  }

  async function maybeFinalizeRoom(){
    if (!STATE.roomRef || !STATE.room) return;

    try{
      const room = STATE.room;
      const ids = (((room || {}).match || {}).participantIds || []).filter(Boolean);
      if (ids.length < 2) return;

      const players = room.players || {};
      const a = players[ids[0]] || null;
      const b = players[ids[1]] || null;
      if (!a || !b) return;

      const t = now();
      const staleMs = 45000;
      const allFinished = !!a.finished && !!b.finished;
      const oneStale = (
        (a.connected === false && (t - Number(a.lastSeenAt || 0) > staleMs)) ||
        (b.connected === false && (t - Number(b.lastSeenAt || 0) > staleMs))
      );

      if (!allFinished && !oneStale) return;

      await STATE.roomRef.update({
        status: 'finished',
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
      await STATE.roomRef.child('match/status').set('finished');
      await STATE.roomRef.child('match/finishedAt').set(firebase.database.ServerValue.TIMESTAMP);
    }catch{}
  }

  async function finishGame(reason){
    if (STATE.ended) return;
    STATE.ended = true;
    STATE.started = false;
    STATE.prestart = false;
    STATE.roomStatus = 'finished';
    caf(STATE.loopId);
    clearTargets();
    hideCountdown();

    await publishFinish();
    renderHud();
    renderResultOverlay(reason || 'timer-end');
  }

  async function publishFinish(){
    if (STATE.finishedPublished) return;
    STATE.finishedPublished = true;
    try{ await publishLivePresence(); }catch{}
    try{ await maybeFinalizeRoom(); }catch{}
  }

  async function showBlockOverlay(title, sub){
    if (!UI.resultMount) return;
    STATE.blockReason = title;
    UI.resultMount.hidden = false;
    STATE.resultOpen = true;
    STATE.lastOverlaySig = `block:${String(title)}|${String(sub)}`;

    UI.resultMount.innerHTML = `
      <div class="duet-result-card">
        <div class="duet-result-title">${esc(title)}</div>
        <div class="duet-result-sub">${esc(sub)}</div>
        <div class="duet-result-actions">
          <a class="btn ghost" href="./goodjunk-duet-lobby.html?room=${encodeURIComponent(STATE.roomId)}&roomId=${encodeURIComponent(STATE.roomId)}&pid=${encodeURIComponent(STATE.pid)}&name=${encodeURIComponent(STATE.name)}&hub=${encodeURIComponent(STATE.hub)}&diff=${encodeURIComponent(STATE.diff)}&time=${encodeURIComponent(String(STATE.timeSec))}&seed=${encodeURIComponent(String(now()))}&view=${encodeURIComponent(STATE.view)}&run=${encodeURIComponent(STATE.run)}&zone=${encodeURIComponent(STATE.zone)}&theme=${encodeURIComponent(STATE.theme)}${DEBUG ? '&debug=1' : ''}">กลับ Lobby</a>
          <a class="btn primary" href="${esc(STATE.hub)}">กลับ Hub</a>
        </div>
      </div>
    `;
  }

  async function ensureFirebaseReady(){
    if (!W.firebase || !firebase.apps || !firebase.apps.length){
      throw new Error('Firebase not initialized');
    }
    if (typeof firebase.database !== 'function'){
      throw new Error('firebase-database.js missing');
    }
    if (typeof firebase.auth !== 'function'){
      throw new Error('firebase-auth.js missing');
    }

    STATE.db = firebase.database();
    STATE.auth = firebase.auth();

    if (STATE.auth.currentUser){
      STATE.uid = STATE.auth.currentUser.uid;
      return STATE.auth.currentUser;
    }

    const cred = await STATE.auth.signInAnonymously();
    const user = (cred && cred.user) || STATE.auth.currentUser;
    if (!user) throw new Error('Anonymous auth failed');
    STATE.uid = user.uid;
    return user;
  }

  async function bindRoom(){
    if (!STATE.roomId){
      throw new Error('roomId missing');
    }

    STATE.roomRef = STATE.db.ref(roomPath(STATE.roomId));
    STATE.meRef = STATE.roomRef.child('players/' + STATE.uid);

    const snap = await getRoomSnapshotWithRetry(STATE.roomRef, 14, 400);
    const room = snap && typeof snap.val === 'function' ? snap.val() : null;

    if (!room){
      throw new Error('room not found');
    }

    const prev = room.players && room.players[STATE.uid];
    const isKnownParticipant = isParticipant(room);
    const meExists = !!prev;

    if (!meExists){
      throw new Error('player not in room');
    }

    if (!isKnownParticipant && String(room.status || 'waiting') !== 'waiting'){
      throw new Error('player not locked into current duet round');
    }

    STATE.room = room;
    STATE.roomStatus = String(room.status || 'waiting');
    STATE.startAt = Number(room.startAt || STATE.startAt || 0);
    STATE.peerId = ((getPeer(room) || {}).id || '');

    await STATE.meRef.onDisconnect().update({
      connected: false,
      phase: 'left',
      lastSeenAt: firebase.database.ServerValue.TIMESTAMP
    });

    const computedPhase = prev.finished
      ? 'done'
      : ((String(room.status || 'waiting') === 'waiting') ? 'lobby' : 'run');

    await STATE.meRef.update({
      id: STATE.uid,
      uid: STATE.uid,
      pid: STATE.pid,
      name: STATE.name,
      connected: true,
      ready: (typeof prev.ready === 'boolean') ? prev.ready : true,
      phase: computedPhase,
      lastSeenAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  function attachRoomListener(){
    if (!STATE.roomRef) return;

    STATE.roomRef.on('value', (snap) => {
      const room = snap.val();

      if (!room){
        if (!STATE.ended){
          showBlockOverlay('ไม่พบห้อง Duet แล้ว', 'ห้องนี้อาจถูกลบหรือหมดอายุ ให้กลับไปสร้างห้องใหม่');
        }
        return;
      }

      STATE.room = room;
      STATE.roomStatus = String(room.status || 'waiting');
      STATE.startAt = Number(room.startAt || STATE.startAt || 0);
      STATE.peerId = ((getPeer(room) || {}).id || '');
      STATE.peerScore = getPeerScore();
      STATE.pairScore = STATE.score + STATE.peerScore;

      const peer = getPeer(room);
      if (peer && peer.connected === false && !STATE.ended && STATE.started){
        setCoach('เพื่อนอาจหลุดออกจากเกม แต่คุณยังเล่นต่อได้');
      }

      if (!STATE.started && !STATE.ended){
        prestartTick();
      }

      renderHud();

      if (STATE.ended){
        renderResultOverlay('sync-finish');
        maybeResetRoomForRematch(room);
        maybeFinalizeRoom();

        if (
          STATE.rematchRequested &&
          String(room.status || 'waiting') === 'waiting' &&
          !STATE.rematchRedirected
        ){
          STATE.rematchRedirected = true;
          setTimeout(() => {
            W.location.replace(buildSameRoomLobbyUrl(true));
          }, 450);
        }
      }
    });
  }

  function bindUi(){
    if (UI.btnGoHub) UI.btnGoHub.href = STATE.hub;
    if (UI.hudToggle){
      UI.hudToggle.addEventListener('click', toggleHudCompact);
    }

    W.addEventListener('beforeunload', () => {
      stopHeartbeat();
      caf(STATE.loopId);
      markDisconnectedForSuspend();
    });

    W.addEventListener('pagehide', () => {
      stopHeartbeat();
      markDisconnectedForSuspend();
    });

    D.addEventListener('visibilitychange', () => {
      if (D.visibilityState === 'hidden'){
        stopHeartbeat();
        markDisconnectedForSuspend();
        return;
      }

      if (D.visibilityState === 'visible'){
        markReconnectedAfterResume();
        if (!STATE.ended){
          startHeartbeat();
          publishLivePresence();
        }
      }
    });

    W.addEventListener('resize', () => {
      renderHud();
    });
  }

  async function init(){
    bindUi();
    resetResultMount();

    if (W.matchMedia && W.matchMedia('(max-width: 980px)').matches) {
      applyHudCompact(true);
    } else {
      applyHudCompact(false);
    }

    STATE.cfg = getCfg();
    STATE.pairGoal = computePairGoal();
    const seedHash = xmur3(`${STATE.seed}|${STATE.roomId}|${STATE.diff}|${STATE.timeSec}`)();
    STATE.rng = mulberry32(seedHash);

    renderHud();
    updateItemGuide('good');
    showCountdown('กำลังเชื่อมห้อง Duet...', '…');

    try{
      await ensureFirebaseReady();
      await bindRoom();
      attachRoomListener();
      startHeartbeat();
      publishLivePresence();
      coachTick();

      if (STATE.room) {
        STATE.peerScore = getPeerScore();
        STATE.pairScore = STATE.score + STATE.peerScore;
      }

      renderHud();
      STATE.loopId = raf(loop);
    }catch(err){
      const msg = (err && err.message) ? err.message : 'unknown';
      console.error('[goodjunk.duet.run] init failed:', {
        msg,
        roomId: STATE.roomId,
        uid: STATE.uid,
        pid: STATE.pid,
        path: roomPath(STATE.roomId)
      }, err);

      await showBlockOverlay(
        'เข้า GoodJunk Duet ไม่สำเร็จ',
        msg === 'roomId missing' ? 'ไม่มี room id ส่งมาจาก lobby'
        : msg === 'room not found' ? `ไม่พบห้อง ${STATE.roomId} ใน Firebase ห้องนี้อาจถูกลบไปแล้ว หรือยัง sync มาไม่ทัน`
        : msg === 'player not in room' ? 'ผู้เล่นนี้ยังไม่ได้เข้าห้องจาก Lobby'
        : msg === 'player not locked into current duet round' ? 'คุณยังไม่ถูกล็อกในรอบนี้ ให้กลับไปเริ่มจาก Lobby'
        : 'เกิดปัญหาระหว่างเชื่อม Firebase หรือข้อมูลห้อง'
      );
    }
  }

  init();
})();