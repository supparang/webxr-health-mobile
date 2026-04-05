'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk.safe.duet.js
 * GoodJunk Duet Run
 * FULL PATCH v20260405-gjduet-run-r13
 * - fix firebase ready wait logic
 * - support roomCode query param
 * - guard missing roomId before building refs
 * - hard-hide summary overlay before run
 * - synced countdown / deadline by shared startAt
 * - replay -> rematch handoff to lobby
 * - dispatch hha:end for Apps Script cloud logger
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  const qs = new URLSearchParams(location.search);
  const ctx = {
    mode: 'duet',
    pid: qs.get('pid') || 'anon',
    name: qs.get('name') || qs.get('nick') || 'Player',
    studyId: qs.get('studyId') || '',
    diff: qs.get('diff') || 'normal',
    time: Math.max(30, Math.min(300, Number(qs.get('time') || 90) || 90)),
    seed: String(qs.get('seed') || Date.now()),
    hub: qs.get('hub') || '../hub.html',
    view: qs.get('view') || 'mobile',
    run: qs.get('run') || 'play',
    gameId: qs.get('gameId') || 'goodjunk',
    zone: qs.get('zone') || 'nutrition',
    roomId: qs.get('roomId') || qs.get('room') || qs.get('roomCode') || '',
    role: qs.get('role') || 'player',
    host: qs.get('host') === '1',
    wait: qs.get('wait') === '1',
    startAt: Number(qs.get('startAt') || 0)
  };

  const PENDING_REMATCH_KEY = 'GJ_DUET_PENDING_REMATCH_V1';

  const $ = (id) => D.getElementById(id);

  const ui = {
    btnGoHub: $('btnGoHub'),
    btnBackLauncher: $('btnBackLauncher'),

    duetHud: $('duetHud'),
    duetHudToggle: $('duetHudToggle'),
    duetCoachBadge: $('duetCoachBadge'),
    duetRoomPill: $('duetRoomPill'),

    duetScoreValue: $('duetScoreValue'),
    duetTimeValue: $('duetTimeValue'),
    duetMissValue: $('duetMissValue'),
    duetStreakValue: $('duetStreakValue'),

    duetItemEmoji: $('duetItemEmoji'),
    duetItemTitle: $('duetItemTitle'),
    duetItemSub: $('duetItemSub'),

    duetGoodHitValue: $('duetGoodHitValue'),
    duetJunkHitValue: $('duetJunkHitValue'),
    duetGoodMissValue: $('duetGoodMissValue'),
    duetTipText: $('duetTipText'),

    duetPairGoalValue: $('duetPairGoalValue'),
    duetPairGoalFill: $('duetPairGoalFill'),
    duetPairGoalSubFill: $('duetPairGoalSubFill'),

    duetGameStage: $('duetGameStage'),
    duetCountdownOverlay: $('duetCountdownOverlay'),
    duetCountdownNum: $('duetCountdownNum'),
    duetCountdownText: $('duetCountdownText'),

    duetResultMount: $('duetResultMount')
  };

  const GOOD_ITEMS = [
    { emoji:'🍎', title:'Apple', sub:'แตะผลไม้ดีให้ไว' },
    { emoji:'🍌', title:'Banana', sub:'กล้วยช่วยเพิ่มพลัง' },
    { emoji:'🥕', title:'Carrot', sub:'ผักดีต่อร่างกาย' },
    { emoji:'🥦', title:'Broccoli', sub:'ผักใบเขียวมีประโยชน์' },
    { emoji:'🍉', title:'Watermelon', sub:'หวานฉ่ำและสดชื่น' },
    { emoji:'🐟', title:'Fish', sub:'โปรตีนดีต่อสุขภาพ' },
    { emoji:'🥛', title:'Milk', sub:'ดื่มนมเพื่อร่างกายแข็งแรง' },
    { emoji:'🥗', title:'Salad', sub:'ช่วยกันเก็บอาหารดี' }
  ];

  const JUNK_ITEMS = [
    { emoji:'🍔', title:'Burger', sub:'อย่าแตะอาหารขยะมากเกินไป' },
    { emoji:'🍟', title:'Fries', sub:'ของทอดไม่ควรเก็บ' },
    { emoji:'🍕', title:'Pizza', sub:'เลี่ยงของมันจัด' },
    { emoji:'🍩', title:'Donut', sub:'หวานเกินไปไม่ดี' },
    { emoji:'🍫', title:'Chocolate', sub:'น้ำตาลสูง ระวังนะ' },
    { emoji:'🍭', title:'Candy', sub:'ของหวานเกินไป' },
    { emoji:'🥤', title:'Soda', sub:'น้ำอัดลมไม่ใช่เป้าหมาย' },
    { emoji:'🧁', title:'Cupcake', sub:'ของหวานอย่าเผลอแตะ' }
  ];

  const CFG = {
    easy:   { spawnMs: 980, lifeMs: 2400, goodChance: 0.78, speedMin: 14, speedMax: 22, sizeMin: 68, sizeMax: 92, goodScore: 12, junkPenalty: 8 },
    normal: { spawnMs: 760, lifeMs: 2050, goodChance: 0.72, speedMin: 18, speedMax: 28, sizeMin: 62, sizeMax: 86, goodScore: 12, junkPenalty: 10 },
    hard:   { spawnMs: 590, lifeMs: 1750, goodChance: 0.67, speedMin: 22, speedMax: 34, sizeMin: 58, sizeMax: 78, goodScore: 14, junkPenalty: 12 }
  };
  const conf = CFG[ctx.diff] || CFG.normal;

  const state = {
    uid: '',
    db: null,
    refs: null,
    room: null,
    participants: [],

    ready: false,
    started: false,
    starting: false,
    ended: false,
    redirecting: false,

    roomStatus: 'waiting',

    score: 0,
    miss: 0,
    streak: 0,
    bestStreak: 0,
    goodHit: 0,
    junkHit: 0,
    goodMiss: 0,

    pairGoal: Math.max(180, Math.round(ctx.time * 4)),
    peerLiveScore: 0,
    peerFinalScore: 0,

    startAtMs: 0,
    runStartedAt: 0,
    deadlineMs: 0,

    loopRaf: 0,
    spawnTimer: 0,
    syncTimer: 0,
    countdownTimer: 0,

    targets: [],
    lastFrameAt: 0,
    seq: 0,

    summaryShown: false,
    myResultSubmitted: false,
    peerResultSeen: false
  };

  function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function hashSeed(str){
    let h = 2166136261 >>> 0;
    const s = String(str || '0');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(hashSeed(ctx.seed + '|' + ctx.roomId + '|' + ctx.pid));

  function rand(){
    return rng();
  }

  function rint(min, max){
    return Math.floor(min + rand() * (max - min + 1));
  }

  function clamp(v, a, b){
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function escapeHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function fmtTime(sec){
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function setCoach(text, badge){
    if (ui.duetTipText) ui.duetTipText.textContent = text || '';
    if (ui.duetCoachBadge && badge) ui.duetCoachBadge.textContent = badge;
  }

  function getPairScore(){
    return state.score + Math.max(state.peerLiveScore, state.peerFinalScore, 0);
  }

  function updateGoalBars(){
    const pair = getPairScore();
    const pairPct = clamp((pair / state.pairGoal) * 100, 0, 100);
    const selfPct = clamp((state.score / state.pairGoal) * 100, 0, 100);

    if (ui.duetPairGoalValue) ui.duetPairGoalValue.textContent = `${pair} / ${state.pairGoal}`;
    if (ui.duetPairGoalFill) ui.duetPairGoalFill.style.width = `${pairPct}%`;
    if (ui.duetPairGoalSubFill) ui.duetPairGoalSubFill.style.width = `${selfPct}%`;
  }

  function renderHud(){
    if (ui.duetRoomPill) ui.duetRoomPill.textContent = `ห้อง ${ctx.roomId || '-'}`;
    if (ui.duetScoreValue) ui.duetScoreValue.textContent = String(state.score);
    if (ui.duetMissValue) ui.duetMissValue.textContent = String(state.miss);
    if (ui.duetStreakValue) ui.duetStreakValue.textContent = String(state.streak);
    if (ui.duetGoodHitValue) ui.duetGoodHitValue.textContent = String(state.goodHit);
    if (ui.duetJunkHitValue) ui.duetJunkHitValue.textContent = String(state.junkHit);
    if (ui.duetGoodMissValue) ui.duetGoodMissValue.textContent = String(state.goodMiss);

    let remainSec = 0;
    if (state.started) {
      remainSec = Math.max(0, (state.deadlineMs - Date.now()) / 1000);
    } else if (state.startAtMs > 0) {
      remainSec = Math.max(0, (state.startAtMs - Date.now()) / 1000);
    }

    if (ui.duetTimeValue) ui.duetTimeValue.textContent = fmtTime(remainSec);
    updateGoalBars();
  }

  function updateItemBox(item, good){
    if (ui.duetItemEmoji) ui.duetItemEmoji.textContent = item.emoji;
    if (ui.duetItemTitle) ui.duetItemTitle.textContent = good ? 'อาหารดี' : 'อาหารขยะ';
    if (ui.duetItemSub) ui.duetItemSub.textContent = item.sub;
  }

  function setCountdown(show, numText, subText){
    if (!ui.duetCountdownOverlay) return;
    ui.duetCountdownOverlay.classList.toggle('show', !!show);
    if (ui.duetCountdownNum) ui.duetCountdownNum.textContent = String(numText || '');
    if (ui.duetCountdownText) ui.duetCountdownText.textContent = String(subText || '');
  }

  function hardHideSummaryMount(){
    if (!ui.duetResultMount) return;
    ui.duetResultMount.hidden = true;
    ui.duetResultMount.innerHTML = '';
    ui.duetResultMount.style.display = 'none';
    ui.duetResultMount.style.pointerEvents = 'none';
    ui.duetResultMount.style.visibility = 'hidden';
    ui.duetResultMount.style.opacity = '0';
  }

  function hardShowSummaryMount(){
    if (!ui.duetResultMount) return;
    ui.duetResultMount.hidden = false;
    ui.duetResultMount.style.display = 'flex';
    ui.duetResultMount.style.pointerEvents = 'auto';
    ui.duetResultMount.style.visibility = 'visible';
    ui.duetResultMount.style.opacity = '1';
  }

  function getStageMetrics(stage){
    if (!stage) return { width: 360, height: 580 };
    const rect = stage.getBoundingClientRect();
    return {
      width: Math.max(320, Math.floor(rect.width || stage.clientWidth || 0)),
      height: Math.max(240, Math.floor(rect.height || stage.clientHeight || 0))
    };
  }

  async function waitStageReady(stage){
    if (!stage) throw new Error('stage element not found');
    for (let i = 0; i < 40; i++){
      const m = getStageMetrics(stage);
      if (m.width >= 320 && m.height >= 240) return m;
      await sleep(100);
    }
    throw new Error('stage not ready');
  }

  function getSpawnRect(stage){
    const { width, height } = getStageMetrics(stage);
    const size = clamp(Math.round(Math.min(width, height) * 0.11), conf.sizeMin, conf.sizeMax);
    const margin = 12;

    const minX = margin;
    const maxX = Math.max(minX, width - size - margin);

    const minY = 24;
    const maxY = Math.max(minY, height - size - 150);

    return {
      x: clamp(rint(minX, maxX), minX, maxX),
      y: clamp(rint(minY, maxY), minY, maxY),
      w: size,
      h: size
    };
  }

  function resizeStageSafe(){
    const m = getStageMetrics(ui.duetGameStage);
    return { w: m.width, h: m.height };
  }

  function clearTargets(){
    state.targets.forEach(t => {
      try { t.el.remove(); } catch(_) {}
    });
    state.targets = [];
  }

  function resetRunState(){
    state.score = 0;
    state.miss = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.goodHit = 0;
    state.junkHit = 0;
    state.goodMiss = 0;
    state.peerLiveScore = 0;
    state.peerFinalScore = 0;
    state.lastFrameAt = 0;
    state.seq = 0;
    state.summaryShown = false;
    state.myResultSubmitted = false;
    state.peerResultSeen = false;
    clearTargets();
  }

  function shouldCountExpireMiss(el){
    if (!el || !D.body.contains(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return false;
    return true;
  }

  function styleTarget(el, good, size){
    el.style.position = 'absolute';
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.padding = '0';
    el.style.margin = '0';
    el.style.display = 'grid';
    el.style.placeItems = 'center';
    el.style.borderRadius = '22px';
    el.style.border = '2px solid #fff';
    el.style.boxShadow = '0 10px 22px rgba(0,0,0,.12)';
    el.style.cursor = 'pointer';
    el.style.userSelect = 'none';
    el.style.webkitTapHighlightColor = 'transparent';
    el.style.fontSize = '0';
    el.style.lineHeight = '1';
    el.style.transform = 'translateZ(0)';
    el.style.zIndex = '10';
    el.style.pointerEvents = 'auto';
    el.style.background = good
      ? 'linear-gradient(180deg,#ffffff,#f1fff1)'
      : 'linear-gradient(180deg,#fff3f3,#ffe1e1)';
  }

  function spawnTarget(){
    if (!state.started || state.ended || !ui.duetGameStage) return;

    const spawn = getSpawnRect(ui.duetGameStage);
    const good = rand() < conf.goodChance;
    const source = good
      ? GOOD_ITEMS[rint(0, GOOD_ITEMS.length - 1)]
      : JUNK_ITEMS[rint(0, JUNK_ITEMS.length - 1)];

    const vx = (rand() * 2 - 1) * 18;
    const vy = rint(conf.speedMin, conf.speedMax);
    const lifeMs = conf.lifeMs + rint(-180, 180);

    const el = D.createElement('button');
    el.type = 'button';
    el.className = `target ${good ? 'good' : 'junk'}`;
    styleTarget(el, good, spawn.w);

    const emoji = D.createElement('div');
    emoji.className = 't-emoji';
    emoji.textContent = source.emoji;
    emoji.style.fontSize = `${Math.max(28, Math.round(spawn.w * 0.44))}px`;
    emoji.style.lineHeight = '1';
    emoji.style.pointerEvents = 'none';
    el.appendChild(emoji);

    const t = {
      id: ++state.seq,
      good,
      item: source,
      el,
      x: spawn.x,
      y: spawn.y,
      vx,
      vy,
      w: spawn.w,
      h: spawn.h,
      bornAt: Date.now(),
      dieAt: Date.now() + lifeMs,
      dead: false
    };

    el.style.left = `${t.x}px`;
    el.style.top = `${t.y}px`;

    const onHit = (ev) => {
      ev.preventDefault();
      hitTarget(t);
    };

    el.addEventListener('pointerdown', onHit, { passive:false });
    el.addEventListener('click', onHit, { passive:false });

    ui.duetGameStage.appendChild(el);
    state.targets.push(t);
  }

  function removeTarget(t){
    if (!t || t.dead) return;
    t.dead = true;
    try { t.el.remove(); } catch(_) {}
  }

  function hitTarget(t){
    if (!t || t.dead || state.ended || !state.started) return;

    removeTarget(t);
    state.targets = state.targets.filter(x => x !== t);

    updateItemBox(t.item, t.good);

    if (t.good) {
      state.score += conf.goodScore;
      state.goodHit += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      setCoach('เยี่ยมมาก ช่วยกันเก็บอาหารดีต่อไป', '🤖 AI Coach');
    } else {
      state.score = Math.max(0, state.score - conf.junkPenalty);
      state.junkHit += 1;
      state.miss += 1;
      state.streak = 0;
      setCoach('อุ๊ย แตะอาหารขยะไปแล้ว ลองตั้งสมาธิใหม่', '🤖 AI Coach');
    }

    renderHud();
  }

  function missGoodTarget(t){
    if (!t || t.dead) return;

    const countable = t.good && shouldCountExpireMiss(t.el);
    removeTarget(t);
    state.targets = state.targets.filter(x => x !== t);

    if (countable) {
      state.goodMiss += 1;
      state.miss += 1;
      state.streak = 0;
      setCoach('มีอาหารดีหลุดไปแล้ว รีบเก็บลูกถัดไปนะ', '🤖 AI Coach');
      renderHud();
    }
  }

  function frame(nowTs){
    if (state.ended || !state.started) return;

    if (!state.lastFrameAt) state.lastFrameAt = nowTs;
    const dt = Math.min(0.05, (nowTs - state.lastFrameAt) / 1000);
    state.lastFrameAt = nowTs;

    const stage = resizeStageSafe();

    state.targets.slice().forEach((t) => {
      if (t.dead) return;

      t.x += t.vx * dt;
      t.y += t.vy * dt;

      const tw = t.el.offsetWidth || t.w;
      const th = t.el.offsetHeight || t.h;

      if (t.x < 6) {
        t.x = 6;
        t.vx *= -1;
      }

      if (t.x > stage.w - tw - 6) {
        t.x = stage.w - tw - 6;
        t.vx *= -1;
      }

      t.el.style.left = `${t.x}px`;
      t.el.style.top = `${t.y}px`;

      if (Date.now() >= t.dieAt || t.y > stage.h - th - 90) {
        missGoodTarget(t);
      }
    });

    if (Date.now() >= state.deadlineMs) {
      endRun('timeup');
      return;
    }

    renderHud();
    state.loopRaf = requestAnimationFrame(frame);
  }

  async function startCore(){
    if (state.started || state.ended || state.starting) return;
    state.starting = true;

    try {
      hardHideSummaryMount();
      await waitStageReady(ui.duetGameStage);
      resetRunState();

      const sharedStart = state.startAtMs > 0 ? state.startAtMs : Date.now();
      state.started = true;
      state.runStartedAt = sharedStart;
      state.deadlineMs = sharedStart + (ctx.time * 1000);
      state.lastFrameAt = 0;

      if (Date.now() >= state.deadlineMs) {
        state.starting = false;
        endRun('late-start');
        return;
      }

      setCountdown(false, '', '');
      setCoach('เริ่มแล้ว ช่วยกันเก็บอาหารดีให้ถึงเป้าหมายคู่', '🤖 AI Coach');
      renderHud();

      try {
        state.refs.myPlayer.update({
          ready: true,
          connected: true,
          phase: 'run',
          score: state.score,
          finalScore: 0,
          miss: state.miss,
          streak: state.bestStreak,
          lastSeenAt: Date.now()
        });
      } catch(_) {}

      clearInterval(state.spawnTimer);
      spawnTarget();
      state.spawnTimer = setInterval(() => {
        if (!state.ended) spawnTarget();
      }, conf.spawnMs);

      state.loopRaf = requestAnimationFrame(frame);
    } catch (err) {
      console.error('[duet-run] startCore failed', err);
      setCoach(`เริ่มเกมไม่สำเร็จ: ${err && err.message ? err.message : err}`, '⚠️ Error');
      setCountdown(true, '!', 'stage ยังไม่พร้อม');
    } finally {
      state.starting = false;
    }
  }

  async function submitResult(reason){
    if (state.myResultSubmitted) return;
    state.myResultSubmitted = true;

    const duration = Math.max(0, Math.round((Date.now() - Math.max(state.runStartedAt || Date.now(), 1)) / 1000));
    const payload = {
      pid: state.uid,
      nick: String(ctx.name || 'Player'),
      roomId: ctx.roomId,
      reason,
      score: state.score,
      shots: state.goodHit + state.junkHit + state.goodMiss,
      hits: state.goodHit,
      miss: state.miss,
      goodHit: state.goodHit,
      junkHit: state.junkHit,
      bestStreak: state.bestStreak,
      duration,
      at: Date.now(),
      final: true
    };

    try {
      await state.refs.myResult.set(payload);
    } catch (err) {
      console.error('[duet-run] result write failed', err);
    }

    try {
      await state.refs.myPlayer.update({
        connected: true,
        phase: 'done',
        finished: true,
        finalScore: state.score,
        miss: state.miss,
        streak: state.bestStreak,
        score: state.score,
        ready: false,
        lastSeenAt: Date.now()
      });
    } catch (err) {
      console.error('[duet-run] player final update failed', err);
    }

    if (ctx.host) {
      try {
        const snap = await state.refs.results.once('value');
        const results = snap.val() || {};
        const participantIds = getParticipantIds();
        const finals = Object.values(results).filter((r) => participantIds.includes(String(r.pid || '')) && r.final);

        if (finals.length >= 2) {
          await state.refs.root.update({
            status: 'ended',
            updatedAt: Date.now()
          }).catch(()=>{});

          await state.refs.state.update({
            status: 'ended',
            updatedAt: Date.now()
          }).catch(()=>{});

          await state.refs.match.update({
            status: 'finished'
          }).catch(()=>{});
        }
      } catch (_) {}
    }
  }

  function getParticipantIds(){
    const raw = state.room && state.room.match && Array.isArray(state.room.match.participantIds)
      ? state.room.match.participantIds
      : [];
    return raw.map(x => String(x || '')).filter(Boolean);
  }

  function getPeerData(){
    const participantIds = getParticipantIds();
    const peerId = participantIds.find(id => id !== state.uid) || Object.keys(state.room?.players || {}).find(id => id !== state.uid) || '';
    const peerPlayer = peerId ? (state.room.players && state.room.players[peerId]) : null;
    const peerResult = peerId ? (state.room.results && state.room.results[peerId]) : null;

    return {
      peerId,
      peerPlayer: peerPlayer || null,
      peerResult: peerResult || null
    };
  }

  function calcStars(pairScore){
    if (pairScore >= state.pairGoal) return 3;
    if (pairScore >= Math.round(state.pairGoal * 0.72)) return 2;
    return 1;
  }

  function launchConfetti(host){
    const mount = host.querySelector('.duet-confetti');
    if (!mount) return;
    mount.innerHTML = '';

    const colors = ['pink','blue','green','gold','violet'];
    const pieces = 34;

    for (let i = 0; i < pieces; i++) {
      const p = D.createElement('div');
      p.className = `duet-confetti-piece ${colors[i % colors.length]}`;
      const w = 8 + Math.round(rand() * 10);
      const h = 12 + Math.round(rand() * 16);
      p.style.width = `${w}px`;
      p.style.height = `${h}px`;
      p.style.left = `${Math.round(rand() * 100)}%`;
      p.style.animationDuration = `${3.2 + rand() * 2.6}s`;
      p.style.animationDelay = `${rand() * .9}s`;
      p.style.setProperty('--dx', `${Math.round((rand() * 2 - 1) * 180)}px`);
      p.style.setProperty('--rot', `${Math.round((rand() * 2 - 1) * 720)}deg`);
      mount.appendChild(p);
    }
  }

  function savePendingRematch(){
    const payload = {
      roomId: ctx.roomId,
      pid: state.uid || ctx.pid || 'anon',
      requestedAt: Date.now(),
      name: ctx.name || 'Player'
    };
    try { sessionStorage.setItem(PENDING_REMATCH_KEY, JSON.stringify(payload)); } catch(_) {}
    try { localStorage.setItem(PENDING_REMATCH_KEY, JSON.stringify(payload)); } catch(_) {}
  }

  function buildSummaryHtml(){
    const peer = getPeerData();
    const peerName = peer.peerResult?.nick || peer.peerPlayer?.name || 'เพื่อนร่วมทีม';
    const peerScore = Number(peer.peerResult?.score ?? peer.peerPlayer?.finalScore ?? peer.peerPlayer?.score ?? 0);
    const pairScore = state.score + peerScore;
    const goalReached = pairScore >= state.pairGoal;
    const stars = calcStars(pairScore);

    const myDone = state.myResultSubmitted;
    const peerDone = !!(peer.peerResult && peer.peerResult.final);

    return `
      <div class="duet-result-card ${goalReached ? 'celebrate' : ''}">
        <div class="duet-confetti"></div>

        <div class="duet-summary-kicker">DUET SUMMARY</div>
        <div class="duet-result-title">${goalReached ? 'เล่นคู่สุดยอดเลย!' : 'จบรอบ Duet แล้ว!'}</div>
        <div class="duet-result-sub">
          ห้อง ${escapeHtml(ctx.roomId || '-')} • เป้าหมายคู่ ${state.pairGoal} คะแนน •
          ${goalReached ? 'ถึงเป้าหมายคู่แล้ว 🎉' : 'ยังไม่ถึงเป้าหมาย ลองใหม่ได้'}
        </div>

        <div class="duet-praise">
          <div class="duet-praise-top">
            <div>
              <div class="duet-praise-title">${goalReached ? 'Great Teamwork!' : 'Nice Try Duo!'}</div>
              <div class="duet-praise-sub">
                ${escapeHtml(ctx.name)} ทำได้ ${state.score} คะแนน • ${escapeHtml(peerName)} ทำได้ ${peerScore} คะแนน
              </div>
            </div>
            <div class="duet-stars big">
              ${[1,2,3].map(i => `<div class="duet-star">${i <= stars ? '⭐' : '☆'}</div>`).join('')}
            </div>
          </div>

          <div class="duet-badges">
            <div class="duet-badge pink">ห้อง ${escapeHtml(ctx.roomId || '-')}</div>
            <div class="duet-badge blue">เป้าหมาย ${state.pairGoal}</div>
            <div class="duet-badge ${goalReached ? 'good' : 'warn'}">${goalReached ? 'ถึงเป้าแล้ว' : 'ยังไม่ถึงเป้า'}</div>
            <div class="duet-badge gold">best streak ${state.bestStreak}</div>
          </div>
        </div>

        <div class="duet-sum-top">
          <div class="duet-sum-top-card">
            <div class="duet-sum-top-label">คะแนนของฉัน</div>
            <div class="duet-sum-top-score me">${state.score}</div>
            <div class="duet-sum-top-sub">
              ${escapeHtml(ctx.name)} •
              <span class="duet-sum-status ${myDone ? 'done' : 'wait'}">${myDone ? 'ส่งผลแล้ว' : 'กำลังส่งผล'}</span>
            </div>
          </div>

          <div class="duet-sum-top-card">
            <div class="duet-sum-top-label">คะแนนคู่หู</div>
            <div class="duet-sum-top-score peer">${peerScore}</div>
            <div class="duet-sum-top-sub">
              ${escapeHtml(peerName)} •
              <span class="duet-sum-status ${peerDone ? 'done' : 'wait'}">${peerDone ? 'ส่งผลแล้ว' : 'รอผลอีกฝ่าย'}</span>
            </div>
          </div>

          <div class="duet-sum-top-card">
            <div class="duet-sum-top-label">คะแนนรวมคู่</div>
            <div class="duet-sum-top-score pair">${pairScore}</div>
            <div class="duet-sum-top-sub">
              <span class="${goalReached ? 'duet-sum-goal-ok' : 'duet-sum-goal-wait'}">
                ${goalReached ? 'ถึงเป้าหมายคู่แล้ว' : `ต้องการอีก ${Math.max(0, state.pairGoal - pairScore)} คะแนน`}
              </span>
            </div>
          </div>
        </div>

        <div class="duet-sum-stats">
          <div class="duet-sum-stat">
            <div class="duet-sum-stat-k">Good hit</div>
            <div class="duet-sum-stat-v">${state.goodHit}</div>
          </div>
          <div class="duet-sum-stat">
            <div class="duet-sum-stat-k">Junk hit</div>
            <div class="duet-sum-stat-v">${state.junkHit}</div>
          </div>
          <div class="duet-sum-stat">
            <div class="duet-sum-stat-k">Miss</div>
            <div class="duet-sum-stat-v">${state.miss}</div>
          </div>
          <div class="duet-sum-stat">
            <div class="duet-sum-stat-k">Best streak</div>
            <div class="duet-sum-stat-v">${state.bestStreak}</div>
          </div>
        </div>

        <div class="duet-recap">
          <div class="duet-recap-card">
            <div class="duet-recap-k">คำแนะนำจาก AI Coach</div>
            <div class="duet-recap-v">
              ${goalReached
                ? 'ทั้งคู่ช่วยกันเก็บอาหารดีได้ถึงเป้าหมายแล้ว รอบต่อไปลองรักษาความต่อเนื่องของ streak ให้ยาวขึ้นอีก'
                : 'คะแนนรวมคู่ยังไม่ถึงเป้า ลองช่วยกันโฟกัสอาหารดีและหลีกเลี่ยง junk ให้มากขึ้น'}
            </div>
          </div>

          <div class="duet-recap-card">
            <div class="duet-recap-k">สรุปรอบนี้</div>
            <div class="duet-recap-v">
              ห้อง ${escapeHtml(ctx.roomId || '-')} • ระดับ ${escapeHtml(ctx.diff)} • เวลา ${ctx.time} วินาที
            </div>
          </div>

          <div class="duet-recap-card">
            <div class="duet-recap-k">สถานะการส่งผล</div>
            <div class="duet-recap-v">
              ของฉัน: ${myDone ? 'เรียบร้อย' : 'กำลังส่ง'}<br/>
              อีกฝ่าย: ${peerDone ? 'เรียบร้อย' : 'รอข้อมูล'}
            </div>
          </div>
        </div>

        <div class="duet-mobile-quick-actions">
          <button class="btn good" data-act="replay">รีแมตช์</button>
          <button class="btn ghost" data-act="hub">กลับ Hub</button>
        </div>

        <div class="duet-result-actions">
          <button class="btn good" data-act="replay">รีแมตช์</button>
          <button class="btn primary" data-act="copy-room">คัดลอก Room</button>
          <button class="btn ghost" data-act="export">Export JSON</button>
          <button class="btn ghost" data-act="hub">กลับ Hub</button>
        </div>
      </div>
    `;
  }

  function attachSummaryActions(){
    if (!ui.duetResultMount) return;

    ui.duetResultMount.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = btn.getAttribute('data-act');

        if (act === 'replay') {
          state.redirecting = true;
          savePendingRematch();

          const u = new URL('./goodjunk-duet-lobby.html', location.href);
          [
            'hub','run','diff','time','studyId','phase','conditionGroup',
            'view','api','log','debug','ai','room','roomId','roomCode','zone',
            'gameId','name','nick','seed'
          ].forEach((k) => {
            const v = qs.get(k);
            if (v != null && v !== '') u.searchParams.set(k, v);
          });

          u.searchParams.set('roomId', ctx.roomId);
          u.searchParams.set('room', ctx.roomId);
          u.searchParams.set('roomCode', ctx.roomId);
          u.searchParams.set('autojoin', '1');
          u.searchParams.set('rematch', '1');
          location.href = u.toString();
        }

        else if (act === 'copy-room') {
          try {
            await navigator.clipboard.writeText(ctx.roomId || '');
          } catch (_) {}
        }

        else if (act === 'export') {
          const peer = getPeerData();
          const payload = {
            roomId: ctx.roomId,
            me: {
              pid: state.uid,
              nick: ctx.name,
              score: state.score,
              goodHit: state.goodHit,
              junkHit: state.junkHit,
              miss: state.miss,
              bestStreak: state.bestStreak
            },
            peer: peer.peerResult || peer.peerPlayer || null,
            pairGoal: state.pairGoal,
            pairScore: getPairScore(),
            at: Date.now()
          };
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
          const url = URL.createObjectURL(blob);
          const a = D.createElement('a');
          a.href = url;
          a.download = `goodjunk-duet-summary-${ctx.roomId || 'room'}-${Date.now()}.json`;
          D.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }

        else if (act === 'hub') {
          state.redirecting = true;
          location.href = ctx.hub || '../hub.html';
        }
      });
    });
  }

  function showSummary(){
    if (!ui.duetResultMount) return;
    hardShowSummaryMount();
    ui.duetResultMount.innerHTML = buildSummaryHtml();
    attachSummaryActions();
    const card = ui.duetResultMount.querySelector('.duet-result-card');
    if (card) launchConfetti(card);
    state.summaryShown = true;
  }

  function stopAllTimers(){
    cancelAnimationFrame(state.loopRaf);
    clearInterval(state.spawnTimer);
    clearInterval(state.syncTimer);
    clearInterval(state.countdownTimer);
    state.loopRaf = 0;
    state.spawnTimer = 0;
    state.syncTimer = 0;
    state.countdownTimer = 0;
  }

  function dispatchCloudSummary(reason){
    try {
      const peer = getPeerData();
      const peerScore = Number(peer.peerResult?.score ?? peer.peerPlayer?.finalScore ?? peer.peerPlayer?.score ?? 0);

      W.dispatchEvent(new CustomEvent('hha:end', {
        detail: {
          session_id: `sess_${ctx.roomId || 'room'}_${state.uid || ctx.pid || 'anon'}_${state.runStartedAt || Date.now()}`,
          pid: state.uid || ctx.pid || 'anon',
          name: ctx.name || 'Player',
          game: 'goodjunk',
          game_title: 'GoodJunk Duet',
          zone: ctx.zone || 'nutrition',
          mode: 'duet',
          run: ctx.run || 'play',
          diff: ctx.diff || 'normal',
          timeSec: Number(ctx.time || 90),
          view: ctx.view || 'mobile',
          seed: String(ctx.seed || ''),
          roomId: ctx.roomId || '',
          match_id: ctx.roomId || '',
          startAt: state.runStartedAt || Date.now(),
          endAt: Date.now(),
          durationSec: Math.max(0, Math.round((Date.now() - Math.max(state.runStartedAt || Date.now(), 1)) / 1000)),
          reason: reason,
          score: state.score,
          peerScore: peerScore,
          pairScore: state.score + peerScore,
          pairGoal: state.pairGoal,
          goodHit: state.goodHit,
          junkHit: state.junkHit,
          goodMiss: state.goodMiss,
          miss: state.miss,
          bestStreak: state.bestStreak,
          study_id: ctx.studyId || '',
          condition_group: qs.get('conditionGroup') || '',
          research_phase: qs.get('phase') || '',
          app_version: 'herohealth',
          game_version: 'goodjunk-duet-r13',
          schema_version: 'v20260403-HHA-RECEIVER-V4'
        }
      }));
    } catch (err) {
      console.warn('[duet-run] dispatch hha:end failed', err);
    }
  }

  async function endRun(reason){
    if (state.ended) return;
    state.ended = true;
    stopAllTimers();
    clearTargets();
    setCountdown(false, '', '');
    setCoach('จบรอบแล้ว กำลังสรุปผลของทั้งคู่', '🤖 AI Coach');
    renderHud();

    await submitResult(reason);
    dispatchCloudSummary(reason);
    showSummary();
  }

  function getPeerLiveScoreFromRoom(){
    const players = state.room && state.room.players ? state.room.players : {};
    const ids = getParticipantIds();
    let peerId = ids.find(id => id !== state.uid);
    if (!peerId) peerId = Object.keys(players).find(id => id !== state.uid);
    if (!peerId) return 0;
    const p = players[peerId] || {};
    return Number(p.finalScore ?? p.score ?? 0);
  }

  function syncFromRoomSnapshot(raw){
    state.room = raw || {};
    state.roomStatus = String(raw?.state?.status || raw?.status || 'waiting');
    state.peerLiveScore = getPeerLiveScoreFromRoom();

    const matchIds = getParticipantIds();
    if (matchIds.length) {
      state.participants = matchIds;
    }

    renderHud();

    if (state.started && state.peerLiveScore > 0 && getPairScore() >= state.pairGoal) {
      setCoach('คะแนนคู่ถึงเป้าแล้ว เก็บต่อได้อีกเพื่อทำสถิติใหม่', '🤖 AI Coach');
    }

    if (state.roomStatus === 'ended' && !state.summaryShown && state.myResultSubmitted) {
      showSummary();
      return;
    }

    if (state.roomStatus !== 'ended' && !state.summaryShown) {
      hardHideSummaryMount();
    }
  }

  async function waitForFirebaseReady(timeoutMs = 12000){
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (W.HHA_FIREBASE_READY && W.HHA_FIREBASE_DB && W.HHA_FIREBASE_AUTH) {
        return true;
      }

      if (W.HHA_FIREBASE_ERROR) {
        throw new Error(W.HHA_FIREBASE_ERROR);
      }

      await sleep(120);
    }

    throw new Error(W.HHA_FIREBASE_ERROR || 'firebase not ready');
  }

  async function ensureAuth(){
    await waitForFirebaseReady();

    const auth =
      W.HHA_FIREBASE_AUTH ||
      (W.firebase && W.firebase.auth ? W.firebase.auth() : null);

    if (!auth) {
      throw new Error('firebase auth sdk not loaded');
    }

    if (auth.currentUser && auth.currentUser.uid) {
      state.uid = auth.currentUser.uid;
      return auth.currentUser;
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < 12000) {
      if (auth.currentUser && auth.currentUser.uid) {
        state.uid = auth.currentUser.uid;
        return auth.currentUser;
      }

      if (W.HHA_FIREBASE_UID) {
        state.uid = W.HHA_FIREBASE_UID;
        return auth.currentUser || { uid: W.HHA_FIREBASE_UID };
      }

      if (W.HHA_FIREBASE_ERROR) {
        throw new Error(W.HHA_FIREBASE_ERROR);
      }

      await sleep(120);
    }

    throw new Error('anonymous auth timeout');
  }

  function getDb(){
    if (state.db) return state.db;
    if (W.HHA_FIREBASE_DB) {
      state.db = W.HHA_FIREBASE_DB;
      return state.db;
    }
    if (typeof W.HHA_ENSURE_FIREBASE_DB === 'function') {
      state.db = W.HHA_ENSURE_FIREBASE_DB();
      return state.db;
    }
    if (W.firebase && W.firebase.database) {
      state.db = W.firebase.database();
      return state.db;
    }
    throw new Error('firebase db not ready');
  }

  async function ensureRoomExists(){
    const snap = await state.refs.root.once('value');
    if (snap.exists()) return;

    const nowTs = Date.now();
    const startAt = ctx.startAt || (Date.now() + 3000);

    await state.refs.root.update({
      roomId: ctx.roomId,
      game: 'goodjunk',
      mode: 'duet',
      hostId: state.uid,
      createdAt: nowTs,
      updatedAt: nowTs,
      status: ctx.wait ? 'countdown' : 'running',
      plannedSec: ctx.time,
      seed: ctx.seed,
      startAt,
      countdownEndsAt: startAt
    });

    await state.refs.state.update({
      status: ctx.wait ? 'countdown' : 'running',
      plannedSec: ctx.time,
      seed: ctx.seed,
      startAt,
      countdownEndsAt: startAt,
      updatedAt: nowTs
    });

    await state.refs.match.update({
      participantIds: [state.uid],
      lockedAt: nowTs,
      status: ctx.wait ? 'countdown' : 'running',
      race: { finishedAt: 0 }
    });
  }

  function subscribeRoom(){
    const onRoom = (snap) => {
      const raw = snap.val() || {};
      syncFromRoomSnapshot(raw);

      if (!state.started && !state.starting) {
        const roomStartAt = Number(
          raw?.state?.startAt ||
          raw?.state?.countdownEndsAt ||
          raw?.startAt ||
          raw?.countdownEndsAt ||
          ctx.startAt ||
          0
        );

        if (roomStartAt > 0) {
          state.startAtMs = roomStartAt;
        }

        const st = String(raw?.state?.status || raw?.status || 'waiting');

        if (st === 'running') {
          startCore();
        } else if (st === 'countdown' && roomStartAt) {
          startCountdownLoop();
        } else if (!ctx.wait && !state.started) {
          state.startAtMs = Date.now() + 800;
          startCountdownLoop();
        }
      }
    };

    const onResults = (snap) => {
      const raw = snap.val() || {};
      if (state.room) state.room.results = raw;

      const peer = getPeerData();
      if (peer.peerResult && peer.peerResult.final) {
        state.peerFinalScore = Number(peer.peerResult.score || 0);
        state.peerResultSeen = true;
      }

      if (state.summaryShown) {
        showSummary();
      }
    };

    state.refs.root.on('value', onRoom, (err) => {
      console.error('[duet-run] room subscribe failed', err);
    });

    state.refs.results.on('value', onResults, (err) => {
      console.error('[duet-run] result subscribe failed', err);
    });
  }

  async function joinPresence(){
    await state.refs.myPlayer.update({
      id: state.uid,
      name: ctx.name,
      ready: true,
      connected: true,
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
      finished: false,
      finalScore: 0,
      miss: 0,
      streak: 0,
      phase: 'run',
      score: 0
    });

    try {
      state.refs.myPlayer.onDisconnect().update({
        connected: false,
        phase: 'left'
      });
    } catch(_) {}
  }

  function startSyncLoop(){
    clearInterval(state.syncTimer);
    state.syncTimer = setInterval(() => {
      state.refs.myPlayer.update({
        connected: true,
        ready: true,
        phase: state.ended ? 'done' : (state.started ? 'run' : 'lobby'),
        score: state.score,
        finalScore: state.ended ? state.score : 0,
        miss: state.miss,
        streak: state.bestStreak,
        lastSeenAt: Date.now()
      }).catch(()=>{});
    }, 1000);
  }

  function startCountdownLoop(){
    if (state.countdownTimer) return;

    clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(() => {
      const nowTs = Date.now();
      const remainMs = state.startAtMs - nowTs;
      const sec = Math.max(0, Math.ceil(remainMs / 1000));

      setCountdown(true, sec > 0 ? String(sec) : 'GO!', 'เตรียมตัวเริ่มพร้อมกันทั้งคู่');
      if (ui.duetTimeValue) ui.duetTimeValue.textContent = fmtTime(Math.max(0, remainMs / 1000));

      if (remainMs <= 0) {
        clearInterval(state.countdownTimer);
        state.countdownTimer = 0;
        startCore();
      }
    }, 100);
  }

  function bindUI(){
    if (ui.duetHudToggle && ui.duetHud) {
      ui.duetHudToggle.addEventListener('click', () => {
        const collapsed = ui.duetHud.dataset.collapsed === '1';
        ui.duetHud.dataset.collapsed = collapsed ? '0' : '1';
        Array.from(ui.duetHud.children).forEach((child, idx) => {
          if (idx <= 1) return;
          child.style.display = collapsed ? '' : 'none';
        });
      });
    }

    if (ui.btnGoHub) {
      ui.btnGoHub.addEventListener('click', () => {
        state.redirecting = true;
      });
    }

    if (ui.btnBackLauncher) {
      ui.btnBackLauncher.addEventListener('click', () => {
        state.redirecting = true;
      });
    }
  }

  async function boot(){
    try {
      bindUI();
      hardHideSummaryMount();
      renderHud();
      state.refs = null;

      await waitStageReady(ui.duetGameStage);
      await ensureAuth();

      if (!ctx.roomId) {
        throw new Error('missing room id');
      }

      state.refs = {
        root: getDb().ref(`hha-battle/goodjunk/duetRooms/${ctx.roomId}`),
        state: getDb().ref(`hha-battle/goodjunk/duetRooms/${ctx.roomId}/state`),
        match: getDb().ref(`hha-battle/goodjunk/duetRooms/${ctx.roomId}/match`),
        players: getDb().ref(`hha-battle/goodjunk/duetRooms/${ctx.roomId}/players`),
        myPlayer: getDb().ref(`hha-battle/goodjunk/duetRooms/${ctx.roomId}/players/${state.uid}`),
        results: getDb().ref(`hha-battle/goodjunk/duetRooms/${ctx.roomId}/results`),
        myResult: getDb().ref(`hha-battle/goodjunk/duetRooms/${ctx.roomId}/results/${state.uid}`)
      };

      await ensureRoomExists();
      await joinPresence();
      subscribeRoom();
      startSyncLoop();

      setCoach('กำลังรอเริ่มพร้อมกันทั้งคู่', '🤖 AI Coach');
      updateItemBox(GOOD_ITEMS[0], true);

      if (!ctx.wait && !ctx.startAt) {
        state.startAtMs = Date.now() + 1200;
        startCountdownLoop();
      }
    } catch (err) {
      console.error('[duet-run] boot failed', err);
      setCoach(`เริ่ม duet run ไม่สำเร็จ: ${err && err.message ? err.message : err}`, '⚠️ Error');
      setCountdown(true, '!', (err && err.message) ? err.message : 'firebase หรือ room ยังไม่พร้อม');
    }
  }

  W.addEventListener('pagehide', () => {
    if (state.redirecting) return;
    if (!state.ended && state.started) {
      endRun('pagehide');
    }
  });

  boot();
})();