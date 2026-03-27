/* /herohealth/vr-goodjunk/goodjunk.safe.duet.js
   FULL PATCH v20260327-GOODJUNK-DUET-FINAL-V2A
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

  const BRIDGE = W.HHA_DUET_BOOT || null;

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
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 24);
  }

  function makeDevicePid(){
    try{
      const KEY = 'GJ_DEVICE_PID';
      let pid = localStorage.getItem(KEY);
      if (!pid){
        pid = 'p-' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(KEY, pid);
      }
      return pid;
    }catch{
      return 'p-' + Math.random().toString(36).slice(2, 10);
    }
  }

  function normalizePid(raw){
    const v = String(raw || '').trim().replace(/[.#$[\]/]/g, '-');
    if (!v || v.toLowerCase() === 'anon') return makeDevicePid();
    return v.slice(0, 80);
  }

  function getBootValue(key, fallback=''){
    if (BRIDGE && BRIDGE[key] != null && BRIDGE[key] !== '') return BRIDGE[key];
    return qs(key, fallback);
  }

  function roomPath(roomId){
    return `hha-battle/goodjunk/rooms/${roomId}`;
  }

  function roomIdCandidates(raw){
    const exact = normalizeRoomId(raw);
    const compact = exact.replace(/[^A-Z0-9]/g, '');
    const out = [];

    function push(v){
      v = normalizeRoomId(v);
      if (!v) return;
      if (!out.includes(v)) out.push(v);
    }

    push(exact);
    push(compact);

    if (/^GJD[A-Z0-9]{5,8}$/.test(compact)){
      push(`GJD-${compact.slice(3)}`);
    }

    if (/^GJD-[A-Z0-9]{5,8}$/.test(exact)){
      push(exact.replace('-', ''));
    }

    return out;
  }

  async function resolveRoomRef(rawRoomId){
    const candidates = roomIdCandidates(rawRoomId);

    if (DEBUG) {
      console.log('[duet.resolveRoomRef] candidates =', candidates);
    }

    for (const id of candidates){
      const ref = STATE.db.ref(roomPath(id));
      const snap = await ref.once('value');
      if (snap.exists()){
        if (DEBUG) {
          console.log('[duet.resolveRoomRef] resolved =', id);
        }
        return { id, ref, snap };
      }
    }

    throw new Error('room not found');
  }

  function saveLastSummary(summary){
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      const key = 'HHA_SUMMARY_HISTORY';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.unshift(summary);
      localStorage.setItem(key, JSON.stringify(arr.slice(0, 20)));
    }catch{}
  }

  function buildSameRoomLobbyUrl(){
    const u = new URL('./goodjunk-duet-lobby.html', W.location.href);
    u.searchParams.set('room', STATE.roomId);
    u.searchParams.set('roomId', STATE.roomId);
    u.searchParams.set('pid', STATE.uid || STATE.pid);
    u.searchParams.set('uid', STATE.uid || STATE.pid);
    u.searchParams.set('playerId', STATE.uid || STATE.pid);
    u.searchParams.set('name', STATE.name);
    u.searchParams.set('nick', STATE.name);
    u.searchParams.set('hub', STATE.hub);
    u.searchParams.set('diff', STATE.diff);
    u.searchParams.set('time', String(STATE.timeSec));
    u.searchParams.set('seed', String(now()));
    u.searchParams.set('view', STATE.view);
    u.searchParams.set('run', STATE.run);
    u.searchParams.set('zone', STATE.zone);
    u.searchParams.set('theme', STATE.theme);
    if (DEBUG) u.searchParams.set('debug', '1');
    return u.toString();
  }

  function buildLauncherUrl(){
    const u = new URL('./goodjunk-launcher.html', W.location.href);
    [
      'pid','uid','playerId','name','nick','hub','run','diff','time','studyId','phase',
      'conditionGroup','sessionOrder','blockLabel','siteCode',
      'schoolYear','semester','view','api','log','debug','ai','zone','theme'
    ].forEach((k) => {
      let v = '';
      if (k === 'pid' || k === 'uid' || k === 'playerId') v = STATE.uid || STATE.pid;
      else if (k === 'name' || k === 'nick') v = STATE.name;
      else if (k === 'hub') v = STATE.hub;
      else if (k === 'diff') v = STATE.diff;
      else if (k === 'time') v = String(STATE.timeSec);
      else if (k === 'view') v = STATE.view;
      else if (k === 'run') v = STATE.run;
      else if (k === 'zone') v = STATE.zone;
      else if (k === 'theme') v = STATE.theme;
      else v = qs(k, '');
      if (v != null && v !== '') u.searchParams.set(k, v);
    });
    return u.toString();
  }

  function resetResultMount(){
    if (!UI.resultMount) return;
    UI.resultMount.hidden = true;
    UI.resultMount.innerHTML = '';
    STATE.resultOpen = false;
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
    roomId: normalizeRoomId(getBootValue('roomId', getBootValue('room', ''))),
    pid: normalizePid(getBootValue('pid', '')),
    name: String(getBootValue('name', getBootValue('nick', 'Player'))).slice(0, 64),
    hub: getBootValue('hub', '../hub.html'),
    view: String(getBootValue('view', 'mobile')).toLowerCase(),
    run: String(getBootValue('run', 'play')).toLowerCase(),
    diff: (() => {
      const v = String(getBootValue('diff', 'normal')).toLowerCase();
      return (v === 'easy' || v === 'hard') ? v : 'normal';
    })(),
    timeSec: clamp(getBootValue('time', 90), 30, 300),
    seed: String(getBootValue('seed', now())),
    zone: getBootValue('zone', 'nutrition'),
    theme: getBootValue('theme', 'goodjunk'),

    uid: '',
    db: null,
    auth: null,
    roomRef: null,
    metaRef: null,
    stateRef: null,
    playersRef: null,
    meRef: null,

    room: null,
    roomRaw: null,
    meta: {},
    stateNode: {},
    playersNode: {},
    peerId: '',
    loopId: 0,
    heartbeatTimer: 0,

    rng: null,
    cfg: null,

    prestart: true,
    started: false,
    ended: false,
    resultOpen: false,

    roomStatus: 'waiting',
    startAt: Number(getBootValue('startAt', 0)) || 0,
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
    leaving: false
  };

  try{ localStorage.setItem('HHA_PLAYER_PID', STATE.pid); }catch{}
  try{ localStorage.setItem('HHA_PLAYER_NICK', STATE.name); }catch{}

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

  function normalizeRoom(raw){
    const roomRaw = raw || {};
    const meta = roomRaw.meta || {};
    const stateNode = roomRaw.state || {};
    const players = roomRaw.players || {};
    const hostId = String(meta.hostPid || meta.hostPlayerId || '');
    const status = String(stateNode.status || 'waiting');
    const startAt = Number(stateNode.startAt || stateNode.countdownEndsAt || 0) || 0;

    return {
      raw: roomRaw,
      meta,
      state: stateNode,
      players,
      hostId,
      status,
      startAt
    };
  }

  function getCurrentParticipantIds(room){
    const players = (room && room.players) ? Object.keys(room.players) : [];
    return players.filter(Boolean).slice(0, 2);
  }

  function getPeer(room){
    if (!room || !room.players) return null;
    const ids = Object.keys(room.players);
    for (const id of ids){
      if (id !== STATE.uid){
        return Object.assign({ id }, room.players[id] || {});
      }
    }
    return null;
  }

  function isParticipant(room){
    if (!room || !room.players || !STATE.uid) return false;
    if (room.players[STATE.uid]) return true;

    const me = Object.values(room.players).find((p) => {
      return p && (
        String(p.uid || '') === STATE.uid ||
        String(p.playerId || '') === STATE.uid ||
        String(p.pid || '') === STATE.uid
      );
    });

    return !!me;
  }

  function getPeerScore(){
    const peer = getPeer(STATE.room);
    return Number(peer && peer.finalScore || 0);
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
      `participantIds=${getCurrentParticipantIds(room).join(', ') || '-'}`,
      `peerUid=${peer.id || '-'}`,
      `peerName=${peer.name || peer.nick || '-'}`,
      `peerConnected=${peer.id ? (peer.connected !== false) : '-'}`,
      `peerFinished=${peer.id ? (!!peer.finished) : '-'}`,
      `peerLastSeen=${peer.id ? Number(peer.lastSeenAt || 0) : 0}`,
      `myPhase=${me ? String(me.phase || '-') : '-'}`,
      `myFinished=${me ? (!!me.finished) : '-'}`,
      `blockReason=${STATE.blockReason || '-'}`
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
    if (!UI.score || typeof UI.score.animate !== 'function') return;
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

    const ts = Number(frameTs || performance.now());
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

    if ((status === 'countdown' || status === 'playing' || status === 'running') && startAt){
      const ms = startAt - now();
      if (ms > 0){
        const sec = Math.ceil(ms / 1000);
        showCountdown('พร้อมแล้วทั้งคู่ กำลังเริ่มเล่น', String(sec));
        return;
      }
      startGame();
      return;
    }

    if ((status === 'playing' || status === 'running') && !startAt){
      startGame();
      return;
    }

    if (status === 'ended' || status === 'finished'){
      finishGame('room-finished');
      return;
    }

    showCountdown('รอหัวหน้าห้องกดเริ่มเกม', '…');
  }

  async function markRoomPlaying(){
    if (!STATE.stateRef) return;
    try{
      const room = STATE.room;
      const isHost = room && room.hostId === STATE.uid;
      if (isHost){
        await STATE.stateRef.update({
          status: 'playing',
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
      }
    }catch{}
  }

  function startGame(){
    if (STATE.started || STATE.ended) return;

    STATE.blockReason = '';
    resetResultMount();

    STATE.started = true;
    STATE.prestart = false;
    STATE.roomStatus = 'playing';
    STATE.endAt = now() + STATE.timeSec * 1000;
    STATE.lastFrameAt = 0;
    STATE.lastSpawnAt = 0;
    hideCountdown();
    markRoomPlaying();
    coachTick();
  }

  async function publishLivePresence(){
    if (!STATE.meRef) return;
    try{
      await STATE.meRef.update({
        id: STATE.uid,
        uid: STATE.uid,
        playerId: STATE.uid,
        pid: STATE.uid,
        name: STATE.name,
        nick: STATE.name,
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

  function buildSummary(){
    const peer = getPeer(STATE.room) || {};
    const peerName = String(peer.name || peer.nick || 'เพื่อน');
    const peerFinished = !!peer.finished;
    return {
      game: 'goodjunk',
      mode: 'duet',
      roomId: STATE.roomId,
      pid: STATE.uid || STATE.pid,
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
      version: 'v20260327-GOODJUNK-DUET-FINAL-V2A'
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
    const peerNameRaw = String(peer.name || peer.nick || 'เพื่อน');
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

    try{
      if (STATE.roomRef && STATE.room && String(STATE.room.status || '') === 'ended'){
        const room = STATE.room;
        const ids = getCurrentParticipantIds(room);
        const players = room.players || {};

        const anotherActive = ids.some((id) => {
          if (id === STATE.uid) return false;
          const p = players[id];
          if (!p) return false;
          if (p.connected !== false) return true;
          return (now() - Number(p.lastSeenAt || 0)) <= 20000;
        });

        if (!anotherActive){
          await STATE.roomRef.remove();
        }
      }
    }catch(err){
      console.warn('[duet.cleanup] room cleanup skipped:', err);
    }

    W.location.href = nextHref;
  }

  function renderResultOverlay(reason){
    if (!UI.resultMount) return;

    const peer = getPeer(STATE.room) || {};
    const peerNameRaw = String(peer.name || peer.nick || 'เพื่อน');
    const peerName = peerNameRaw.trim() || 'เพื่อน';
    const peerScore = Number(peer.finalScore || 0);
    const pairScore = STATE.score + peerScore;
    STATE.pairScore = pairScore;

    const goalReached = pairScore >= STATE.pairGoal;
    const peerDone = !!peer.finished;

    const statusText = reason === 'peer-stale'
      ? 'เพื่อนหลุดจากห้องนานเกินกำหนด จึงสรุปผลจากคะแนนล่าสุด'
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

    const starsHtml = Array.from({ length: praise.stars }, () => '<span class="duet-star">⭐</span>').join('');
    const badgesHtml = praise.badges.map(b => `<span class="duet-badge ${esc(b.cls)}">${esc(b.text)}</span>`).join('');
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
            ${esc(statusText)}
          </div>
        </div>

        <div class="duet-praise hubv2" style="position:relative;z-index:1;">
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
          <button class="btn good" id="duetBtnPlayAgain" type="button">เล่นอีกครั้ง</button>
          <button class="btn ghost" id="duetBtnBackLobby" type="button">กลับไป Lobby ห้องเดิม</button>
          <button class="btn ghost" id="duetBtnBackLauncher" type="button">กลับหน้าเลือกโหมด</button>
          <button class="btn primary" id="duetBtnBackHub" type="button">กลับหน้าหลัก</button>
          <button class="btn ghost" id="duetBtnClose" type="button">ปิดหน้าสรุป</button>
        </div>
      </div>
    `;

    const btnClose = $('duetBtnClose');
    const btnPlayAgain = $('duetBtnPlayAgain');
    const btnBackLobby = $('duetBtnBackLobby');
    const btnBackLauncher = $('duetBtnBackLauncher');
    const btnBackHub = $('duetBtnBackHub');

    if (btnClose){
      btnClose.addEventListener('click', () => {
        resetResultMount();
      });
    }

    if (btnPlayAgain){
      btnPlayAgain.addEventListener('click', () => {
        leaveFinishedRoomAndMaybeCleanup(buildSameRoomLobbyUrl());
      });
    }

    if (btnBackLobby){
      btnBackLobby.addEventListener('click', () => {
        leaveFinishedRoomAndMaybeCleanup(buildSameRoomLobbyUrl());
      });
    }

    if (btnBackLauncher){
      btnBackLauncher.addEventListener('click', () => {
        leaveFinishedRoomAndMaybeCleanup(buildLauncherUrl());
      });
    }

    if (btnBackHub){
      btnBackHub.addEventListener('click', () => {
        leaveFinishedRoomAndMaybeCleanup(STATE.hub);
      });
    }
  }

  async function maybeFinalizeRoom(){
    if (!STATE.stateRef || !STATE.room) return;

    try{
      const room = STATE.room;
      const ids = getCurrentParticipantIds(room);
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
      if (String(room.status || 'waiting') === 'ended') return;

      const isHost = room.hostId === STATE.uid;
      if (!isHost) return;

      await STATE.stateRef.update({
        status: 'ended',
        endedAt: firebase.database.ServerValue.TIMESTAMP,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
    }catch{}
  }

  async function finishGame(reason){
    if (STATE.ended) return;
    STATE.ended = true;
    STATE.started = false;
    STATE.prestart = false;
    STATE.roomStatus = 'ended';
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
    UI.resultMount.innerHTML = `
      <div class="duet-result-card">
        <div class="duet-result-title">${esc(title)}</div>
        <div class="duet-result-sub">${esc(sub)}</div>
        <div class="duet-result-actions">
          <a class="btn ghost" href="${esc(buildSameRoomLobbyUrl())}">กลับ Lobby</a>
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

    const resolved = await resolveRoomRef(STATE.roomId);

    STATE.roomId = resolved.id;
    STATE.roomRef = resolved.ref;
    STATE.metaRef = STATE.roomRef.child('meta');
    STATE.stateRef = STATE.roomRef.child('state');
    STATE.playersRef = STATE.roomRef.child('players');
    STATE.meRef = STATE.playersRef.child(STATE.uid);

    const raw = resolved.snap.val();

    if (!raw){
      throw new Error('room not found');
    }

    const room = normalizeRoom(raw);
    const me = room.players && room.players[STATE.uid];
    const meExists = !!me;

    if (!meExists){
      throw new Error('player not in room');
    }

    STATE.roomRaw = raw;
    STATE.room = room;
    STATE.meta = room.meta;
    STATE.stateNode = room.state;
    STATE.playersNode = room.players;
    STATE.roomStatus = room.status;
    STATE.startAt = room.startAt;
    STATE.peerId = ((getPeer(room) || {}).id || '');

    try{
      await STATE.meRef.onDisconnect().update({
        connected: false,
        phase: 'left',
        lastSeenAt: firebase.database.ServerValue.TIMESTAMP
      });
    }catch{}

    await STATE.meRef.update({
      id: STATE.uid,
      uid: STATE.uid,
      playerId: STATE.uid,
      pid: STATE.uid,
      name: STATE.name,
      nick: STATE.name,
      connected: true,
      ready: true,
      phase: (String(room.status || 'waiting') === 'waiting') ? 'lobby' : 'run',
      finished: false,
      finalScore: 0,
      miss: 0,
      streak: 0,
      lastSeenAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  function attachRoomListener(){
    if (!STATE.roomRef) return;

    STATE.roomRef.on('value', (snap) => {
      const raw = snap.val();
      if (!raw){
        if (!STATE.ended){
          showBlockOverlay('ไม่พบห้อง Duet แล้ว', 'ห้องนี้อาจถูกลบหรือหมดอายุ ให้กลับไปสร้างห้องใหม่');
        }
        return;
      }

      const room = normalizeRoom(raw);

      STATE.roomRaw = raw;
      STATE.room = room;
      STATE.meta = room.meta;
      STATE.stateNode = room.state;
      STATE.playersNode = room.players;
      STATE.roomStatus = room.status;
      STATE.startAt = room.startAt;
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
        maybeFinalizeRoom();
      }
    });
  }

  function bindUi(){
    if (UI.btnGoHub) UI.btnGoHub.href = STATE.hub;
    if (UI.btnBackLauncher) UI.btnBackLauncher.href = buildLauncherUrl();

    if (UI.hudToggle){
      UI.hudToggle.addEventListener('click', toggleHudCompact);
    }

    W.addEventListener('beforeunload', () => {
      stopHeartbeat();
      caf(STATE.loopId);
      try{
        if (STATE.meRef){
          STATE.meRef.update({
            connected: false,
            phase: STATE.ended ? 'done' : 'left',
            lastSeenAt: firebase.database.ServerValue.TIMESTAMP
          }).catch(() => {});
        }
      }catch{}
    });

    W.addEventListener('pagehide', () => {
      stopHeartbeat();
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
      console.error('[goodjunk.duet.run] init failed:', msg, err);
      await showBlockOverlay(
        'เข้า GoodJunk Duet ไม่สำเร็จ',
        msg === 'roomId missing' ? 'ไม่มี room id ส่งมาจาก lobby'
        : msg === 'room not found' ? 'ไม่พบห้องนี้ใน Firebase'
        : msg === 'player not in room' ? 'ผู้เล่นนี้ยังไม่ได้เข้าห้องจาก Lobby หรือ uid ไม่ตรงกับห้อง'
        : 'เกิดปัญหาระหว่างเชื่อม Firebase หรือข้อมูลห้อง'
      );
    }
  }

  init();
})();