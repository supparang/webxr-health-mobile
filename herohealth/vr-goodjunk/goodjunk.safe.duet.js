'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk.safe.duet.js
 * GoodJunk Duet Run
 * FULL PATCH v20260331-gjduet-run-r8
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
    time: Number(qs.get('time') || 90),
    seed: String(qs.get('seed') || Date.now()),
    hub: qs.get('hub') || '../hub.html',
    view: qs.get('view') || 'mobile',
    run: qs.get('run') || 'play',
    gameId: qs.get('gameId') || 'goodjunk',
    zone: qs.get('zone') || 'nutrition',
    roomId: qs.get('roomId') || qs.get('room') || '',
    role: qs.get('role') || 'player',
    host: qs.get('host') === '1',
    wait: qs.get('wait') === '1',
    startAt: Number(qs.get('startAt') || 0)
  };

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
    ended: false,
    redirecting: false,

    roomStatus: 'waiting',
    currentCountdown: 0,

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
    gameTimer: 0,

    targets: [],
    lastFrameAt: 0,
    seq: 0,

    summaryShown: false,
    myResultSubmitted: false,
    peerResultSeen: false
  };

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

    const remainSec = state.started ? Math.max(0, (state.deadlineMs - Date.now()) / 1000) : Math.max(0, (state.startAtMs - Date.now()) / 1000);
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

  function resizeStageSafe(){
    if (!ui.duetGameStage) return { w: 360, h: 580 };
    const rect = ui.duetGameStage.getBoundingClientRect();
    return {
      w: Math.max(280, Math.floor(rect.width)),
      h: Math.max(520, Math.floor(rect.height))
    };
  }

  function clearTargets(){
    state.targets.forEach(t => {
      try { t.el.remove(); } catch(_) {}
    });
    state.targets = [];
  }

  function spawnTarget(){
    if (!state.started || state.ended || !ui.duetGameStage) return;

    const stage = resizeStageSafe();
    const good = rand() < conf.goodChance;
    const source = good
      ? GOOD_ITEMS[rint(0, GOOD_ITEMS.length - 1)]
      : JUNK_ITEMS[rint(0, JUNK_ITEMS.length - 1)];

    const size = rint(conf.sizeMin, conf.sizeMax);
    const padding = 12;
    const x = rint(padding, Math.max(padding, stage.w - size - padding));
    const y = rint(20, Math.max(24, stage.h - 180 - size));
    const vx = (rand() * 2 - 1) * 18;
    const vy = rint(conf.speedMin, conf.speedMax);
    const lifeMs = conf.lifeMs + rint(-180, 180);

    const el = D.createElement('button');
    el.type = 'button';
    el.className = `target ${good ? 'good' : 'junk'}`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerHTML = `<div class="t-emoji">${source.emoji}</div>`;

    const t = {
      id: ++state.seq,
      good,
      item: source,
      el,
      x,
      y,
      vx,
      vy,
      bornAt: Date.now(),
      dieAt: Date.now() + lifeMs,
      dead: false
    };

    const onHit = (ev) => {
      ev.preventDefault();
      hitTarget(t);
    };
    el.addEventListener('click', onHit, { passive:false });
    el.addEventListener('touchstart', onHit, { passive:false });

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
    removeTarget(t);
    state.targets = state.targets.filter(x => x !== t);

    if (t.good) {
      state.goodMiss += 1;
      state.miss += 1;
      state.streak = 0;
      setCoach('มีอาหารดีหลุดไปแล้ว รีบเก็บลูกถัดไปนะ', '🤖 AI Coach');
      renderHud();
    }
  }

  function frame(nowTs){
    if (state.ended) return;
    if (!state.started) return;

    if (!state.lastFrameAt) state.lastFrameAt = nowTs;
    const dt = Math.min(0.05, (nowTs - state.lastFrameAt) / 1000);
    state.lastFrameAt = nowTs;

    const stage = resizeStageSafe();

    state.targets.slice().forEach((t) => {
      if (t.dead) return;

      t.x += t.vx * dt;
      t.y += t.vy * dt;

      if (t.x < 6) { t.x = 6; t.vx *= -1; }
      if (t.x > stage.w - t.el.offsetWidth - 6) { t.x = stage.w - t.el.offsetWidth - 6; t.vx *= -1; }

      t.el.style.left = `${t.x}px`;
      t.el.style.top = `${t.y}px`;

      if (Date.now() >= t.dieAt || t.y > stage.h - 90) {
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

  function startCore(){
    if (state.started || state.ended) return;
    state.started = true;
    state.runStartedAt = Date.now();
    state.deadlineMs = state.runStartedAt + (ctx.time * 1000);
    state.lastFrameAt = 0;

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
    state.spawnTimer = setInterval(spawnTarget, conf.spawnMs);

    state.loopRaf = requestAnimationFrame(frame);
  }

  async function submitResult(reason){
    if (state.myResultSubmitted) return;
    state.myResultSubmitted = true;

    const duration = Math.max(0, Math.round((Date.now() - state.runStartedAt) / 1000));
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
          await state.refs.state.update({
            status: 'ended',
            updatedAt: Date.now()
          });
          await state.refs.match.update({
            status: 'finished'
          });
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
          <button class="btn good" data-act="replay">เล่นใหม่</button>
          <button class="btn ghost" data-act="hub">กลับ Hub</button>
        </div>

        <div class="duet-result-actions">
          <button class="btn good" data-act="replay">เล่นใหม่</button>
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
          const u = new URL('./goodjunk-duet-lobby.html', location.href);
          ['hub','run','diff','time','studyId','phase','conditionGroup','view','api','log','debug','ai','room','roomId','zone','gameId']
            .forEach((k) => {
              const v = qs.get(k);
              if (v != null && v !== '') u.searchParams.set(k, v);
            });
          u.searchParams.set('roomId', ctx.roomId);
          u.searchParams.set('room', ctx.roomId);
          u.searchParams.set('autojoin', '1');
          location.href = u.toString();
        } else if (act === 'copy-room') {
          try {
            await navigator.clipboard.writeText(ctx.roomId || '');
          } catch (_) {}
        } else if (act === 'export') {
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
        } else if (act === 'hub') {
          location.href = ctx.hub || '../hub.html';
        }
      });
    });
  }

  function showSummary(){
    if (!ui.duetResultMount) return;
    ui.duetResultMount.hidden = false;
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
    clearInterval(state.gameTimer);
    state.loopRaf = 0;
    state.spawnTimer = 0;
    state.syncTimer = 0;
    state.countdownTimer = 0;
    state.gameTimer = 0;
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
    state.roomStatus = String(raw?.state?.status || 'waiting');
    state.peerLiveScore = getPeerLiveScoreFromRoom();

    const matchIds = getParticipantIds();
    if (matchIds.length) {
      state.participants = matchIds;
    }

    renderHud();

    if (state.started && state.peerLiveScore > 0) {
      if (getPairScore() >= state.pairGoal) {
        setCoach('คะแนนคู่ถึงเป้าแล้ว เก็บต่อได้อีกเพื่อทำสถิติใหม่', '🤖 AI Coach');
      }
    }

    if (state.roomStatus === 'ended' && !state.summaryShown && state.myResultSubmitted) {
      showSummary();
    }
  }

  async function waitForFirebaseReady(timeoutMs = 12000){
    if (W.HHA_FIREBASE_READY && W.HHA_FIREBASE_DB) return true;

    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('firebase not ready')), timeoutMs);

      W.addEventListener('hha:firebase_ready', (ev) => {
        clearTimeout(timer);
        if (ev && ev.detail && ev.detail.ok) resolve(true);
        else reject(new Error((ev && ev.detail && ev.detail.error) || 'firebase not ready'));
      }, { once:true });
    });
  }

  async function ensureAuth(){
    await waitForFirebaseReady();

    if (typeof W.HHA_ensureAnonymousAuth === 'function') {
      const user = await W.HHA_ensureAnonymousAuth();
      if (user && user.uid) {
        state.uid = user.uid;
        return user;
      }
    }

    if (!W.firebase || !W.firebase.auth) {
      throw new Error('firebase auth sdk not loaded');
    }

    const auth = W.firebase.auth();
    if (auth.currentUser && auth.currentUser.uid) {
      state.uid = auth.currentUser.uid;
      return auth.currentUser;
    }

    await auth.signInAnonymously();
    const user = await new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error('anonymous auth timeout'));
      }, 12000);

      const off = auth.onAuthStateChanged((u) => {
        if (done) return;
        if (u && u.uid) {
          done = true;
          clearTimeout(timer);
          try { off(); } catch(_) {}
          resolve(u);
        }
      }, (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { off(); } catch(_) {}
        reject(err || new Error('auth state failed'));
      });
    });

    state.uid = user.uid;
    return user;
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
    await state.refs.root.update({
      roomId: ctx.roomId,
      game: 'goodjunk',
      mode: 'duet',
      hostId: state.uid,
      createdAt: nowTs,
      updatedAt: nowTs
    });

    await state.refs.state.update({
      status: ctx.wait ? 'countdown' : 'running',
      plannedSec: ctx.time,
      seed: ctx.seed,
      startAt: ctx.startAt || (Date.now() + 3000),
      countdownEndsAt: ctx.startAt || (Date.now() + 3000),
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

      if (!state.started) {
        const roomStartAt = Number(raw?.state?.startAt || raw?.state?.countdownEndsAt || ctx.startAt || 0);
        if (raw?.state?.status === 'running') {
          state.startAtMs = roomStartAt || Date.now();
          startCore();
        } else if (raw?.state?.status === 'countdown' && roomStartAt) {
          state.startAtMs = roomStartAt;
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
  }

  async function boot(){
    try {
      bindUI();
      renderHud();
      state.refs = null;

      await ensureAuth();
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
      setCountdown(true, '!', 'firebase หรือ room ยังไม่พร้อม');
    }
  }

  W.addEventListener('pagehide', () => {
    if (!state.ended && state.started) {
      endRun('pagehide');
    }
  });

  boot();
})();