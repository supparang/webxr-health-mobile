/* /herohealth/vr-goodjunk/goodjunk.safe.duet.js
   FULL PATCH v20260331-GJ-DUET-RUN-R7
   - กด rematch แล้ว write vote + กลับ lobby ทันที
   - cancel onDisconnect ก่อน redirect รีแมตช์
   - กัน beforeunload/pagehide ยิง phase:left ทับ
   - detach room listener ก่อนเด้งหน้า
   - summary overlay mobile/pc กดปุ่มได้ชัดเจน
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
      if (i < tries - 1) await waitMs(gap);
    }
    return lastSnap;
  }

  function fireAndForget(p){
    try{
      Promise.resolve(p).catch((err) => {
        console.warn('[duet.run] ignored async error:', err);
      });
    }catch(err){
      console.warn('[duet.run] wrap failed:', err);
    }
  }

  function safeReplace(nextHref){
    try{
      W.location.replace(nextHref);
    }catch(_){
      W.location.href = nextHref;
    }
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

  async function cancelDisconnectMarker(){
    try{
      if (STATE.meOnDisconnect && typeof STATE.meOnDisconnect.cancel === 'function'){
        await STATE.meOnDisconnect.cancel();
      }
    }catch(err){
      console.warn('[duet.run] cancel onDisconnect failed:', err);
    }
  }

  function detachRoomListener(){
    try{
      if (STATE.roomRef && STATE.roomOff){
        STATE.roomRef.off('value', STATE.roomOff);
      }
    }catch(err){
      console.warn('[duet.run] detach room listener failed:', err);
    }
    STATE.roomOff = null;
  }

  async function goLobbyForRematchNow(){
    if (STATE.rematchRedirected) return;

    STATE.rematchRedirected = true;
    stopHeartbeat();
    stopRematchPoll();
    detachRoomListener();

    await cancelDisconnectMarker();

    try{
      if (STATE.meRef){
        await STATE.meRef.update({
          connected: true,
          ready: true,
          phase: 'lobby',
          lastSeenAt: firebase.database.ServerValue.TIMESTAMP
        });
      }
    }catch(err){
      console.warn('[duet.run] pre-rematch lobby presence update failed:', err);
    }

    const nextUrl = buildSameRoomLobbyUrl(true);

    try{ W.location.replace(nextUrl); }catch(_){ W.location.href = nextUrl; }
    setTimeout(() => {
      try{ W.location.href = nextUrl; }catch(_){}
    }, 120);
    setTimeout(() => {
      try{ W.location.replace(nextUrl); }catch(_){}
    }, 320);
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

  function isProbablyAlivePlayer(p){
    if (!p) return false;
    const seen = Number(p.lastSeenAt || 0);
    if (p.connected !== false) return true;
    return (now() - seen) <= 20000;
  }

  function pickRecoveryHost(room){
    if (!room || !room.players) return null;

    const players = Object.keys(room.players)
      .map((id) => Object.assign({ id }, room.players[id] || {}))
      .filter(Boolean);

    if (!players.length) return null;

    players.sort((a, b) => {
      const aLive = isProbablyAlivePlayer(a) ? 1 : 0;
      const bLive = isProbablyAlivePlayer(b) ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;

      const aMe = a.id === STATE.uid ? 1 : 0;
      const bMe = b.id === STATE.uid ? 1 : 0;
      if (aMe !== bMe) return bMe - aMe;

      const aj = Number(a.joinedAt || 0);
      const bj = Number(b.joinedAt || 0);
      if (aj !== bj) return aj - bj;

      return String(a.id || '').localeCompare(String(b.id || ''));
    });

    return players[0] || null;
  }

  function resetResultMount(){
    if (!UI.resultMount) return;
    UI.resultMount.hidden = true;
    UI.resultMount.style.display = 'none';
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

  function bindPress(el, handler){
    if (!el || typeof handler !== 'function') return;
    let locked = false;

    const run = async (ev) => {
      if (ev){
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation?.();
      }
      if (locked) return;
      locked = true;
      try{
        await handler(ev);
      }catch(err){
        console.error('[duet.run] bindPress failed:', err);
      }finally{
        setTimeout(() => { locked = false; }, 260);
      }
    };

    el.addEventListener('pointerup', run, { passive:false });
    el.addEventListener('click', run, { passive:false });
  }

  function injectOverlayHardFixCSS(){
    if (D.getElementById('gjDuetSummaryHardFix')) return;

    const style = D.createElement('style');
    style.id = 'gjDuetSummaryHardFix';
    style.textContent = `
      #duetResultMount{
        position:fixed !important;
        inset:0 !important;
        z-index:99999 !important;
        overflow:auto !important;
        padding:14px !important;
        background:rgba(245,252,255,.96) !important;
        opacity:1 !important;
        filter:none !important;
        pointer-events:auto !important;
        isolation:isolate !important;
        -webkit-backdrop-filter:none !important;
        backdrop-filter:none !important;
      }
      #duetResultMount[hidden]{ display:none !important; }
      #duetResultMount .duet-result-card{
        position:relative !important;
        width:min(1120px,100%) !important;
        margin:0 auto !important;
        background:#fffdf8 !important;
        opacity:1 !important;
        filter:none !important;
        visibility:visible !important;
        pointer-events:auto !important;
        isolation:isolate !important;
        -webkit-backdrop-filter:none !important;
        backdrop-filter:none !important;
      }
      #duetResultMount .duet-confetti,
      #duetResultMount .duet-confetti-piece{
        pointer-events:none !important;
      }
      #duetResultMount .duet-mobile-quick-actions,
      #duetResultMount .duet-result-actions{
        position:sticky !important;
        z-index:30 !important;
        pointer-events:auto !important;
      }
      #duetResultMount .duet-result-actions .btn,
      #duetResultMount .duet-mobile-quick-actions .btn{
        pointer-events:auto !important;
        z-index:31 !important;
        position:relative !important;
        touch-action:manipulation !important;
      }
    `;
    D.head.appendChild(style);
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
    rematchPollTimer: 0,

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
    leaving: false,

    roomOff: null,
    meOnDisconnect: null
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

  function stopRematchPoll(){
    if (STATE.rematchPollTimer){
      clearInterval(STATE.rematchPollTimer);
      STATE.rematchPollTimer = 0;
    }
  }

  function startRematchPoll(){
    stopRematchPoll();

    let tries = 0;

    STATE.rematchPollTimer = setInterval(async () => {
      tries += 1;

      try{
        if (!STATE.roomRef){
          stopRematchPoll();
          return;
        }

        const snap = await STATE.roomRef.once('value');
        const room = snap && typeof snap.val === 'function' ? snap.val() : null;

        if (!room){
          if (tries >= 24) stopRematchPoll();
          return;
        }

        const status = String(room.status || 'waiting');
        const info = getRematchInfo(room);

        if (status === 'finished' && info.count >= 2){
          fireAndForget(recoverFinishedRoomForRematchFromRun(room));
        }

        if ((status === 'waiting' || status === 'countdown' || status === 'running') && STATE.rematchRequested){
          stopRematchPoll();

          if (!STATE.rematchRedirected){
            STATE.rematchRedirected = true;
            safeReplace(buildSameRoomLobbyUrl(true));
          }
          return;
        }

        if (tries >= 24){
          stopRematchPoll();
        }
      }catch(err){
        console.warn('[duet.run] rematch poll failed:', err);
        if (tries >= 24){
          stopRematchPoll();
        }
      }
    }, 500);
  }

  function buildSummary(){
    const peer = getPeer(STATE.room) || {};
    return {
      game: 'goodjunk',
      mode: 'duet',
      roomId: STATE.roomId,
      pid: STATE.pid,
      name: STATE.name,
      partnerName: String(peer.name || 'เพื่อน'),
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
      partnerFinished: !!peer.finished,
      endedAt: new Date().toISOString(),
      version: 'v20260331-GJ-DUET-RUN-R7'
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
    const peerName = String(peer.name || 'เพื่อน').trim() || 'เพื่อน';

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

  function getTrophyBadges(){
    const out = [];
    if (STATE.pairScore >= STATE.pairGoal) out.push({ cls:'good', text:'🏆 ทำคะแนนถึงเป้าหมายคู่' });
    else out.push({ cls:'gold', text:'🎯 ยังเหลืออีกนิดก็ถึงเป้า' });

    if (STATE.bestStreak >= 10) out.push({ cls:'good', text:'🔥 ต่อเนื่องเก่งมาก' });
    if (STATE.goodHit >= Math.max(20, STATE.junkHit * 2)) out.push({ cls:'good', text:'🍉 เลือกอาหารดีเก่งมาก' });
    if (STATE.junkHit <= 3) out.push({ cls:'gold', text:'🛡️ ระวัง Junk ได้ดี' });
    return out;
  }

  async function recoverFinishedRoomForRematchFromRun(room){
    if (!room || !STATE.roomRef || STATE.rematchResetting) return false;

    const status = String(room.status || 'waiting');
    if (status !== 'finished') return false;

    const info = getRematchInfo(room);
    if (info.ids.length !== 2) return false;
    if (info.count < 2) return false;

    const host = room.players && room.players[room.hostId] ? room.players[room.hostId] : null;
    const chosenHost = (host && isProbablyAlivePlayer(host)) ? host : pickRecoveryHost(room);

    if (!chosenHost) return false;
    if (chosenHost.id !== STATE.uid) return false;

    STATE.rematchResetting = true;

    try{
      const t = now();
      const updates = {
        status: 'waiting',
        startAt: 0,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        seed: String(t),
        hostId: chosenHost.id,
        hostName: chosenHost.name || 'Host',
        rematch: null,
        'match/status': 'idle',
        'match/lockedAt': 0,
        'match/finishedAt': 0,
        'match/participantIds': null
      };

      info.ids.forEach((id) => {
        updates[`players/${id}/ready`] = false;
        updates[`players/${id}/phase`] = 'lobby';
        updates[`players/${id}/finished`] = false;
        updates[`players/${id}/finalScore`] = 0;
        updates[`players/${id}/miss`] = 0;
        updates[`players/${id}/streak`] = 0;
        updates[`players/${id}/finishedAt`] = 0;
        updates[`players/${id}/connected`] = true;
        updates[`players/${id}/lastSeenAt`] = firebase.database.ServerValue.TIMESTAMP;
      });

      await STATE.roomRef.update(updates);
      return true;
    }catch(err){
      console.error('[duet.run] recoverFinishedRoomForRematchFromRun failed:', err);
      return false;
    }finally{
      STATE.rematchResetting = false;
    }
  }

  async function requestRematch(){
    if (!STATE.roomRef || !STATE.uid) return;
    if (STATE.rematchRedirected) return;

    STATE.rematchRequested = true;

    try{
      await STATE.roomRef.child('rematch/' + STATE.uid).set({
        uid: STATE.uid,
        pid: STATE.pid,
        name: STATE.name,
        ready: true,
        requestedAt: firebase.database.ServerValue.TIMESTAMP
      });

      await goLobbyForRematchNow();
    }catch(err){
      console.error('[duet.run] requestRematch failed:', err);
      STATE.rematchRequested = false;
      STATE.rematchRedirected = false;
      stopRematchPoll();
      throw err;
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

  async function leaveFinishedRoomAndMaybeCleanup(nextHref){
    if (STATE.leaving) return;
    STATE.leaving = true;

    stopHeartbeat();
    stopRematchPoll();
    detachRoomListener();

    try{
      if (STATE.meRef){
        fireAndForget(
          STATE.meRef.update({
            connected: false,
            phase: STATE.ended ? 'done' : 'left',
            lastSeenAt: firebase.database.ServerValue.TIMESTAMP
          })
        );
      }
    }catch(err){
      console.warn('[duet.run] leave update failed:', err);
    }

    safeReplace(nextHref);
  }

  function renderResultOverlay(reason){
    if (!UI.resultMount) return;

    const peer = getPeer(STATE.room) || {};
    const peerName = String(peer.name || 'เพื่อน').trim() || 'เพื่อน';
    const peerScore = Number(peer.finalScore || 0);
    const pairScore = STATE.score + peerScore;
    const goalReached = pairScore >= STATE.pairGoal;
    const peerDone = !!peer.finished;
    const rematchInfo = getRematchInfo(STATE.room);

    STATE.pairScore = pairScore;

    const overlaySig = JSON.stringify({
      reason: String(reason || ''),
      peerScore,
      pairScore,
      peerDone,
      goalReached,
      rematchCount: rematchInfo.count,
      rematchRequested: !!STATE.rematchRequested,
      status: String((STATE.room && STATE.room.status) || '')
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
          : (peerDone ? 'เพื่อนเล่นจบรอบแล้ว มาดูคะแนนคู่กัน' : 'กำลังรอคะแนนจากเพื่อนอีกนิด');

    const praise = getPraiseMeta();
    const recap = getRecapLines();
    const trophies = getTrophyBadges();
    const badges = praise.badges.slice();

    badges.push({ cls:'blue', text:`🔁 รีแมตช์ ${rematchInfo.count}/2` });
    if (STATE.rematchRequested && rematchInfo.count < 2){
      badges.push({ cls:'gold', text:'⌛ รอเพื่อนกดรีแมตช์' });
    }
    if (STATE.rematchRequested && rematchInfo.count >= 2){
      badges.push({ cls:'good', text:'✅ รีแมตช์ครบแล้ว' });
    }

    const starsHtml = Array.from({ length: praise.stars }, () => '<span class="duet-star">⭐</span>').join('');
    const badgesHtml = badges.map(b => `<span class="duet-badge ${esc(b.cls)}">${esc(b.text)}</span>`).join('');
    const trophiesHtml = trophies.map(t => `<span class="duet-trophy ${esc(t.cls)}">${esc(t.text)}</span>`).join('');
    const confettiHtml = goalReached ? buildConfettiHtml(26) : '';

    saveLastSummary(buildSummary());

    UI.resultMount.hidden = false;
    UI.resultMount.style.display = 'flex';
    STATE.resultOpen = true;

    UI.resultMount.innerHTML = `
      <div class="duet-result-card ${goalReached ? 'celebrate' : ''}">
        ${confettiHtml}

        <div class="duet-summary-head" style="position:relative;z-index:1;">
          <div class="duet-summary-kicker">👯 GOODJUNK • สรุปผลเล่นคู่</div>
          <div class="duet-result-title">${goalReached ? 'เยี่ยมมาก ทำคะแนนคู่ได้ดีมาก' : 'จบรอบเล่นคู่แล้ว'}</div>
          <div class="duet-result-sub">
            ${esc('สรุปคะแนนของฉัน + เพื่อน + คะแนนคู่')}<br>
            ${esc(statusText)}
          </div>
        </div>

        <div class="duet-praise" style="position:relative;z-index:1;">
          <div class="duet-mobile-quick-actions"></div>

          <div class="duet-praise-top">
            <div>
              <div class="duet-praise-title">${esc(praise.title)}</div>
              <div class="duet-praise-sub">${esc(praise.sub)}</div>
            </div>
            <div class="duet-stars big">${starsHtml}</div>
          </div>

          <div class="duet-badges">${badgesHtml}</div>
          <div class="duet-trophy-strip">${trophiesHtml}</div>
        </div>

        <div class="duet-sum-top" style="position:relative;z-index:1;">
          <div class="duet-sum-top-card">
            <div class="duet-sum-top-label">ฉัน</div>
            <div class="duet-sum-top-score me">${STATE.score}</div>
            <div class="duet-sum-top-sub">
              แตะอาหารดี ${STATE.goodHit} • โดน Junk ${STATE.junkHit} • พลาด ${STATE.miss}
            </div>
          </div>

          <div class="duet-sum-top-card">
            <div class="duet-sum-top-label">${esc(peerName)}</div>
            <div class="duet-sum-top-score peer">${peerScore}</div>
            <div class="duet-sum-top-sub">
              ${peerDone ? '<span class="duet-sum-status done">เล่นจบแล้ว</span>' : '<span class="duet-sum-status wait">กำลังรอคะแนน</span>'}
            </div>
          </div>

          <div class="duet-sum-top-card">
            <div class="duet-sum-top-label">คะแนนคู่</div>
            <div class="duet-sum-top-score pair">${pairScore}</div>
            <div class="duet-sum-top-sub">
              เป้าหมาย ${STATE.pairGoal}
              <span class="${goalReached ? 'duet-sum-goal-ok' : 'duet-sum-goal-wait'}">
                ${goalReached ? '• ถึงเป้าแล้ว' : '• ยังไปต่อได้'}
              </span>
            </div>
          </div>
        </div>

        <div class="duet-sum-stats" style="position:relative;z-index:1;">
          <div class="duet-sum-stat">
            <div class="duet-sum-stat-k">ต่อเนื่องสูงสุด</div>
            <div class="duet-sum-stat-v">${STATE.bestStreak}</div>
          </div>
          <div class="duet-sum-stat">
            <div class="duet-sum-stat-k">แตะอาหารดี</div>
            <div class="duet-sum-stat-v">${STATE.goodHit}</div>
          </div>
          <div class="duet-sum-stat">
            <div class="duet-sum-stat-k">โดน Junk</div>
            <div class="duet-sum-stat-v">${STATE.junkHit}</div>
          </div>
          <div class="duet-sum-stat">
            <div class="duet-sum-stat-k">พลาดอาหารดี</div>
            <div class="duet-sum-stat-v">${STATE.goodMiss}</div>
          </div>
        </div>

        <div class="duet-recap" style="position:relative;z-index:1;">
          ${recap.map(item => `
            <div class="duet-recap-card">
              <div class="duet-recap-k">${esc(item.k)}</div>
              <div class="duet-recap-v">${esc(item.v)}</div>
            </div>
          `).join('')}
        </div>

        <div class="duet-result-actions" style="position:relative;z-index:1;">
          <button class="btn good" id="duetBtnRematch" type="button">${STATE.rematchRequested ? 'กำลังรอรีแมตช์...' : 'ขอรีแมตช์'}</button>
          <button class="btn ghost" id="duetBtnBackLobby" type="button">กลับไป Lobby ห้องเดิม</button>
          <button class="btn ghost" id="duetBtnBackLauncher" type="button">กลับหน้าเลือกโหมด</button>
          <button class="btn primary" id="duetBtnBackHub" type="button">กลับหน้าหลัก</button>
          <button class="btn ghost" id="duetBtnClose" type="button">ปิดหน้าสรุป</button>
        </div>
      </div>
    `;

    const quickWrap = UI.resultMount.querySelector('.duet-mobile-quick-actions');
    if (quickWrap && isMobileViewport()){
      quickWrap.innerHTML = `
        <button class="btn good" id="duetBtnRematchTop" type="button">${STATE.rematchRequested ? 'กำลังรอรีแมตช์...' : 'รีแมตช์'}</button>
        <button class="btn ghost" id="duetBtnBackLobbyTop" type="button">กลับ Lobby</button>
      `;
    }

    ensureResultActionsVisible();

    const btnRematch = $('duetBtnRematch');
    const btnBackLobby = $('duetBtnBackLobby');
    const btnBackLauncher = $('duetBtnBackLauncher');
    const btnBackHub = $('duetBtnBackHub');
    const btnClose = $('duetBtnClose');
    const btnRematchTop = $('duetBtnRematchTop');
    const btnBackLobbyTop = $('duetBtnBackLobbyTop');

    if (btnRematch){
      btnRematch.disabled = !!STATE.rematchRequested;
      bindPress(btnRematch, async () => {
        if (STATE.rematchRequested) return;
        btnRematch.disabled = true;
        btnRematch.textContent = 'กำลังรอรีแมตช์...';
        try{
          await requestRematch();
          return;
        }catch(err){
          btnRematch.disabled = false;
          btnRematch.textContent = 'ขอรีแมตช์';
        }
      });
    }

    if (btnBackLobby){
      bindPress(btnBackLobby, async () => {
        await leaveFinishedRoomAndMaybeCleanup(buildSameRoomLobbyUrl(false));
      });
    }

    if (btnBackLauncher){
      bindPress(btnBackLauncher, async () => {
        await leaveFinishedRoomAndMaybeCleanup(
          (UI.btnBackLauncher && UI.btnBackLauncher.href) || './goodjunk-launcher.html'
        );
      });
    }

    if (btnBackHub){
      bindPress(btnBackHub, async () => {
        await leaveFinishedRoomAndMaybeCleanup(STATE.hub);
      });
    }

    if (btnClose){
      bindPress(btnClose, async () => {
        resetResultMount();
      });
    }

    if (btnRematchTop){
      btnRematchTop.disabled = !!STATE.rematchRequested;
      bindPress(btnRematchTop, async () => {
        if (STATE.rematchRequested) return;
        btnRematchTop.disabled = true;
        btnRematchTop.textContent = 'กำลังรอรีแมตช์...';
        try{
          await requestRematch();
          return;
        }catch(err){
          btnRematchTop.disabled = false;
          btnRematchTop.textContent = 'รีแมตช์';
        }
      });
    }

    if (btnBackLobbyTop){
      bindPress(btnBackLobbyTop, async () => {
        await leaveFinishedRoomAndMaybeCleanup(buildSameRoomLobbyUrl(false));
      });
    }
  }

  async function showBlockOverlay(title, sub){
    if (!UI.resultMount) return;
    STATE.blockReason = title;
    UI.resultMount.hidden = false;
    UI.resultMount.style.display = 'flex';
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

    try{
      const od = STATE.meRef.onDisconnect();
      STATE.meOnDisconnect = od || null;

      if (od && typeof od.update === 'function'){
        fireAndForget(
          od.update({
            connected: false,
            phase: 'left',
            lastSeenAt: firebase.database.ServerValue.TIMESTAMP
          })
        );
      }
    }catch(err){
      console.warn('[duet.run] onDisconnect setup ignored:', err);
    }

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

    STATE.roomOff = (snap) => {
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
        const rematchInfo = getRematchInfo(room);
        const status = String(room.status || 'waiting');

        renderResultOverlay(rematchInfo.count >= 2 ? 'rematch-requested' : 'sync-finish');

        if (status === 'finished' && rematchInfo.count >= 2){
          fireAndForget(recoverFinishedRoomForRematchFromRun(room));
        }

        if (
          STATE.rematchRequested &&
          (status === 'waiting' || status === 'countdown' || status === 'running') &&
          !STATE.rematchRedirected
        ){
          fireAndForget(goLobbyForRematchNow());
          return;
        }

        fireAndForget(maybeFinalizeRoom());
      }
    };

    STATE.roomRef.on('value', STATE.roomOff);
  }

  function bindUi(){
    if (UI.btnGoHub) UI.btnGoHub.href = STATE.hub;
    if (UI.hudToggle){
      UI.hudToggle.addEventListener('click', toggleHudCompact);
    }

    W.addEventListener('beforeunload', () => {
      stopHeartbeat();
      stopRematchPoll();
      caf(STATE.loopId);

      if (STATE.rematchRedirected) return;

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
      stopRematchPoll();

      if (STATE.rematchRedirected) return;
    });

    D.addEventListener('visibilitychange', () => {
      if (D.visibilityState === 'hidden'){
        stopHeartbeat();
        stopRematchPoll();
        return;
      }

      if (D.visibilityState === 'visible'){
        if (!STATE.ended){
          startHeartbeat();
          publishLivePresence();
        } else if (STATE.rematchRequested && !STATE.rematchRedirected){
          startRematchPoll();
        }
      }
    });
  }

  async function init(){
    injectOverlayHardFixCSS();
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