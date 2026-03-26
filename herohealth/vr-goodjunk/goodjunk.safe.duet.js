/* /herohealth/vr-goodjunk/goodjunk.safe.duet.js
   FULL PATCH v20260327-GOODJUNK-DUET-RUN-WORK-SURE-V3
   - pairs with duet lobby path: hha-battle/goodjunk/duetRooms/{ROOM}
   - firebase anonymous auth
   - authoritative countdown from room.startAt
   - child-friendly duet gameplay
   - seeded spawn pattern + simple AI coach
   - live sync score to room.players/{uid}
   - final summary + pair score + last summary save
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
        pid = 'p-' + Math.random().toString(36).slice(2,10);
        localStorage.setItem(KEY, pid);
      }
      return pid;
    }catch{
      return 'p-' + Math.random().toString(36).slice(2,10);
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

  function saveLastSummary(summary){
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      const key = 'HHA_SUMMARY_HISTORY';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.unshift(summary);
      localStorage.setItem(key, JSON.stringify(arr.slice(0, 20)));
    }catch{}
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
    'แตะของดีให้ไว แล้วช่วยกันทำคะแนนคู่',
    'ของดีเพิ่มคะแนนและช่วยให้ streak ยาวขึ้น',
    'ถ้าเก็บของดีต่อเนื่อง คะแนนจะพุ่งเร็วมาก',
    'ช่วยกันมองของดีให้ทันก่อนหลุดจอ'
  ];

  const TIPS_JUNK = [
    'ของหวานจัดและของทอดให้ปล่อยผ่าน',
    'เห็น junk แล้วอย่าแตะนะ',
    'อย่ากดพลาดโดน junk ไม่งั้น miss จะเพิ่ม',
    'เก็บของดีอย่างเดียว คะแนนจะสวยกว่า'
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
    hub: qs('hub') || './hub.html',
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
    coachTimer: 0,

    rng: null,
    cfg: null,

    prestart: true,
    started: false,
    ended: false,
    resultOpen: false,

    roomStatus: 'waiting',
    startAt: Number(qs('startAt') || 0) || 0,
    endAt: 0,

    lastFrameAt: 0,
    lastSpawnAt: 0,
    lastCoachAt: 0,

    targets: [],
    seq: 0,

    score: 0,
    goodHit: 0,
    junkHit: 0,
    goodMiss: 0,
    miss: 0,           // standard miss = junk hit + good expired
    streak: 0,
    bestStreak: 0,

    peerScore: 0,
    pairScore: 0,
    pairGoal: 360,

    hudCompact: false,
    blockReason: '',
    finishedPublished: false
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
      UI.itemTitle.textContent = 'JUNK';
      UI.itemSub.textContent = 'ของแบบนี้ไม่ต้องแตะ ปล่อยให้ผ่านไป';
      setCoach(TIPS_JUNK[(STATE.seq + STATE.junkHit) % TIPS_JUNK.length]);
    } else {
      UI.itemEmoji.textContent = '🍉';
      UI.itemTitle.textContent = 'GOOD';
      UI.itemSub.textContent = 'แตะของดีให้ไว ช่วยกันทำคะแนน';
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

  function getPairScoreFromRoom(room){
    if (!room || !room.players) return STATE.score;
    const me = room.players[STATE.uid] || {};
    const peer = getPeer(room) || {};
    const my = Number(me.finalScore || STATE.score || 0);
    const pe = Number(peer.finalScore || 0);
    return my + pe;
  }

  function renderHud(){
    if (UI.roomPill) UI.roomPill.textContent = `ROOM ${STATE.roomId || '-'}`;
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

  function toggleHudCompact(){
    STATE.hudCompact = !STATE.hudCompact;
    const children = UI.hud ? Array.from(UI.hud.children) : [];
    children.forEach((el, idx) => {
      if (idx <= 2) return; // keep toolbar + top + score
      el.style.display = STATE.hudCompact ? 'none' : '';
    });
    if (UI.hudToggle) UI.hudToggle.textContent = STATE.hudCompact ? '＋' : '⋯';
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
    if (!UI.score) return;
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
      setCoach('ดีมาก แตะของดีต่อเนื่องได้เลย');
    } else {
      STATE.junkHit += 1;
      STATE.miss += 1;
      STATE.streak = 0;
      STATE.score = Math.max(0, STATE.score - 8);
      setCoach('ไม่เป็นไร รอบหน้าปล่อย junk ผ่านไปนะ');
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
      setCoach('ของดีหลุดไปแล้ว ลองแตะให้ไวขึ้นอีกนิด');
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

  function getPeerScore(){
    const peer = getPeer(STATE.room);
    return Number(peer && peer.finalScore || 0);
  }

  function pickCoachTip(){
    const left = STATE.started ? Math.max(0, (STATE.endAt - now()) / 1000) : STATE.timeSec;

    if (STATE.junkHit >= 3 && STATE.junkHit > STATE.goodHit / 2){
      return 'ระวัง junk ให้มากขึ้น แตะเฉพาะของดีนะ';
    }
    if (STATE.goodMiss >= 3 && STATE.goodMiss > STATE.goodHit / 2){
      return 'ของดีหลุดหลายชิ้น ลองกวาดสายตามุมบนให้เร็วขึ้น';
    }
    if (STATE.streak >= 6){
      return 'ยอดเยี่ยมมาก streak กำลังดี รักษาจังหวะนี้ไว้';
    }
    if (left <= 15 && STATE.pairScore < STATE.pairGoal){
      return 'ช่วงท้ายแล้ว เก็บของดีให้ไวเพื่อปิด gap ให้ได้';
    }
    if (STATE.pairScore >= STATE.pairGoal){
      return 'ถึงเป้าหมายคู่แล้ว ลุยต่อเพื่อทำคะแนนเพิ่มได้เลย';
    }
    return TIPS_GOOD[(STATE.goodHit + STATE.junkHit + STATE.goodMiss) % TIPS_GOOD.length];
  }

  function coachTick(){
    const t = pickCoachTip();
    setCoach(t);
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
    const room = STATE.room;
    const status = String((room && room.status) || STATE.roomStatus || 'waiting');
    const startAt = Number((room && room.startAt) || STATE.startAt || 0);

    if (!room){
      showCountdown('กำลังเชื่อมห้อง Duet...', '…');
      return;
    }

    if (!isParticipant(room)){
      showCountdown('คุณยังไม่ถูกล็อกเป็นผู้เล่นในรอบนี้ ให้กลับไปเริ่มจาก Lobby', '!');
      return;
    }

    if ((status === 'countdown' || status === 'running') && startAt){
      const ms = startAt - now();
      if (ms > 0){
        const sec = Math.ceil(ms / 1000);
        showCountdown('พร้อมกันทั้งคู่ กำลังเริ่มเกม', String(sec));
        return;
      }
      startGame();
      return;
    }

    if (status === 'running' && !startAt){
      startGame();
      return;
    }

    showCountdown('รอ Host กดเริ่มจาก Duet Lobby', '…');
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

  function buildSummary(){
    const peer = getPeer(STATE.room) || {};
    const peerName = String(peer.name || 'Partner');
    const peerFinished = !!peer.finished;
    const summary = {
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
      version: 'v20260327-GOODJUNK-DUET-RUN-WORK-SURE-V3'
    };
    return summary;
  }

  function renderResultOverlay(reason){
    if (!UI.resultMount) return;

    const peer = getPeer(STATE.room) || {};
    const peerName = String(peer.name || 'Partner');
    const peerScore = Number(peer.finalScore || 0);
    const pairScore = STATE.score + peerScore;
    const goalReached = pairScore >= STATE.pairGoal;
    const peerDone = !!peer.finished;
    const statusText = peerDone ? 'เพื่อนจบรอบแล้ว' : 'กำลังรอคะแนนเพื่อน / เพื่อนอาจยังเล่นอยู่';

    const summary = buildSummary();
    saveLastSummary(summary);

    UI.resultMount.hidden = false;
    UI.resultMount.innerHTML = `
      <div class="duet-result-card">
        <div class="duet-result-title">${goalReached ? 'เยี่ยมมาก ทำคะแนนคู่ได้ดีมาก' : 'จบรอบ GoodJunk Duet แล้ว'}</div>
        <div class="duet-result-sub">
          ${esc(reason === 'room-finished' ? 'รอบนี้ถูกปิดจากห้องส่วนกลางแล้ว' : 'สรุปผลของฉัน + เพื่อน + คะแนนคู่')}<br>
          ${esc(statusText)}
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">
          <div style="border:1px solid #bfe3f2;border-radius:20px;background:#fff;padding:14px;text-align:center;">
            <div style="color:#6b7280;font-size:12px;font-weight:1000;">ฉัน</div>
            <div style="margin-top:6px;font-size:34px;line-height:1;font-weight:1100;color:#7a2558;">${STATE.score}</div>
            <div style="margin-top:8px;color:#6b7280;font-size:12px;line-height:1.7;font-weight:900;">
              Good ${STATE.goodHit} • Junk ${STATE.junkHit} • Miss ${STATE.miss}
            </div>
          </div>

          <div style="border:1px solid #bfe3f2;border-radius:20px;background:#fff;padding:14px;text-align:center;">
            <div style="color:#6b7280;font-size:12px;font-weight:1000;">${esc(peerName)}</div>
            <div style="margin-top:6px;font-size:34px;line-height:1;font-weight:1100;color:#1f5d73;">${peerScore}</div>
            <div style="margin-top:8px;color:#6b7280;font-size:12px;line-height:1.7;font-weight:900;">
              ${peerDone ? 'finished' : 'waiting sync'}
            </div>
          </div>

          <div style="border:1px solid #bfe3f2;border-radius:20px;background:linear-gradient(180deg,#fff7fb,#fff);padding:14px;text-align:center;">
            <div style="color:#6b7280;font-size:12px;font-weight:1000;">คะแนนคู่</div>
            <div style="margin-top:6px;font-size:38px;line-height:1;font-weight:1100;color:#c2410c;">${pairScore}</div>
            <div style="margin-top:8px;color:#6b7280;font-size:12px;line-height:1.7;font-weight:900;">
              เป้าหมาย ${STATE.pairGoal} ${goalReached ? '• ถึงเป้าแล้ว' : '• ยังไปต่อได้'}
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">
          <div style="border:1px solid #bfe3f2;border-radius:16px;background:#ffffff;padding:12px;text-align:center;">
            <div style="font-size:12px;color:#6b7280;font-weight:1000;">Best Streak</div>
            <div style="margin-top:5px;font-size:24px;font-weight:1100;color:#244f6d;">${STATE.bestStreak}</div>
          </div>
          <div style="border:1px solid #bfe3f2;border-radius:16px;background:#ffffff;padding:12px;text-align:center;">
            <div style="font-size:12px;color:#6b7280;font-weight:1000;">Good hit</div>
            <div style="margin-top:5px;font-size:24px;font-weight:1100;color:#244f6d;">${STATE.goodHit}</div>
          </div>
          <div style="border:1px solid #bfe3f2;border-radius:16px;background:#ffffff;padding:12px;text-align:center;">
            <div style="font-size:12px;color:#6b7280;font-weight:1000;">Junk hit</div>
            <div style="margin-top:5px;font-size:24px;font-weight:1100;color:#244f6d;">${STATE.junkHit}</div>
          </div>
          <div style="border:1px solid #bfe3f2;border-radius:16px;background:#ffffff;padding:12px;text-align:center;">
            <div style="font-size:12px;color:#6b7280;font-weight:1000;">Good missed</div>
            <div style="margin-top:5px;font-size:24px;font-weight:1100;color:#244f6d;">${STATE.goodMiss}</div>
          </div>
        </div>

        <div class="duet-result-actions">
          <a class="btn good" id="duetBtnNewRoom" href="./goodjunk-duet-lobby.html?pid=${encodeURIComponent(STATE.pid)}&name=${encodeURIComponent(STATE.name)}&hub=${encodeURIComponent(STATE.hub)}&diff=${encodeURIComponent(STATE.diff)}&time=${encodeURIComponent(String(STATE.timeSec))}&seed=${encodeURIComponent(String(now()))}&view=${encodeURIComponent(STATE.view)}&run=${encodeURIComponent(STATE.run)}&zone=${encodeURIComponent(STATE.zone)}&theme=${encodeURIComponent(STATE.theme)}">เล่นอีกรอบ</a>
          <a class="btn ghost" id="duetBtnLauncher" href="${esc((UI.btnBackLauncher && UI.btnBackLauncher.href) || './goodjunk-launcher.html')}">กลับ Launcher</a>
          <a class="btn primary" id="duetBtnHub" href="${esc(STATE.hub)}">กลับ Hub</a>
          <button class="btn ghost" id="duetBtnClose" type="button">ปิดหน้าสรุป</button>
        </div>
      </div>
    `;

    const btnClose = $('duetBtnClose');
    if (btnClose){
      btnClose.addEventListener('click', () => {
        UI.resultMount.hidden = true;
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
    try{
      await publishLivePresence();
    }catch{}
    try{
      await maybeFinalizeRoom();
    }catch{}
  }

  async function showBlockOverlay(title, sub){
    if (!UI.resultMount) return;
    UI.resultMount.hidden = false;
    UI.resultMount.innerHTML = `
      <div class="duet-result-card">
        <div class="duet-result-title">${esc(title)}</div>
        <div class="duet-result-sub">${esc(sub)}</div>
        <div class="duet-result-actions">
          <a class="btn ghost" href="./goodjunk-duet-lobby.html?pid=${encodeURIComponent(STATE.pid)}&name=${encodeURIComponent(STATE.name)}&hub=${encodeURIComponent(STATE.hub)}&diff=${encodeURIComponent(STATE.diff)}&time=${encodeURIComponent(String(STATE.timeSec))}&seed=${encodeURIComponent(String(now()))}&view=${encodeURIComponent(STATE.view)}&run=${encodeURIComponent(STATE.run)}&zone=${encodeURIComponent(STATE.zone)}&theme=${encodeURIComponent(STATE.theme)}">กลับ Lobby</a>
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

    const snap = await STATE.roomRef.once('value');
    const room = snap.val();

    if (!room){
      throw new Error('room not found');
    }

    const me = room.players && room.players[STATE.uid];
    const isKnownParticipant = isParticipant(room);
    const meExists = !!me;

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

    await STATE.meRef.update({
      id: STATE.uid,
      uid: STATE.uid,
      pid: STATE.pid,
      name: STATE.name,
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
        maybeFinalizeRoom();
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
        : msg === 'player not in room' ? 'ผู้เล่นนี้ยังไม่ได้เข้าห้องจาก Lobby'
        : msg === 'player not locked into current duet round' ? 'คุณยังไม่ถูกล็อกในรอบนี้ ให้กลับไปเริ่มจาก Lobby'
        : 'เกิดปัญหาระหว่างเชื่อม Firebase หรือข้อมูลห้อง'
      );
    }
  }

  init();
})();