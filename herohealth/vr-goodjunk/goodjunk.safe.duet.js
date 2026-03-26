(function(){
  'use strict';

  const qs = new URLSearchParams(location.search);

  function normalizeRoomId(v){
    return String(v || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
  }
  function normalizeName(v){
    return String(v || '').trim().replace(/\s+/g, ' ').slice(0, 40) || 'Player';
  }
  function clamp(n, a, b){
    n = Number(n);
    if (!Number.isFinite(n)) n = a;
    return Math.max(a, Math.min(b, n));
  }
  function esc(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;');
  }

  async function ensureAnonAuth(){
    if (!window.firebase || !firebase.auth) throw new Error('firebase auth not loaded');
    if (firebase.auth().currentUser) return firebase.auth().currentUser;
    const cred = await firebase.auth().signInAnonymously();
    return cred.user;
  }

  const GAME = 'goodjunk';
  const MODE = 'duet';

  const ROOM_ID = normalizeRoomId(qs.get('roomId') || '');
  const VIEW = (qs.get('view') || 'mobile').toLowerCase();
  const DIFF = (qs.get('diff') || 'normal').toLowerCase();
  const HUB = qs.get('hub') || './hub.html';

  let AUTH_USER = null;
  let PID = '';
  let NAME = normalizeName(qs.get('name') || 'Player');

  const UI = {
    stage: document.getElementById('duetGameStage'),
    roomPill: document.getElementById('duetRoomPill'),
    score: document.getElementById('duetScoreValue'),
    time: document.getElementById('duetTimeValue'),
    miss: document.getElementById('duetMissValue'),
    streak: document.getElementById('duetStreakValue'),
    itemEmoji: document.getElementById('duetItemEmoji'),
    itemTitle: document.getElementById('duetItemTitle'),
    itemSub: document.getElementById('duetItemSub'),
    goodHit: document.getElementById('duetGoodHitValue'),
    junkHit: document.getElementById('duetJunkHitValue'),
    goodMiss: document.getElementById('duetGoodMissValue'),
    tip: document.getElementById('duetTipText'),
    pairGoalValue: document.getElementById('duetPairGoalValue'),
    pairGoalFill: document.getElementById('duetPairGoalFill'),
    pairGoalSubFill: document.getElementById('duetPairGoalSubFill'),
    resultMount: document.getElementById('duetResultMount'),
    countdownOverlay: document.getElementById('duetCountdownOverlay'),
    countdownNum: document.getElementById('duetCountdownNum'),
    countdownText: document.getElementById('duetCountdownText'),
    coachBadge: document.getElementById('duetCoachBadge')
  };

  const GOOD_ITEMS = [
    { emoji:'🍎', label:'apple' },
    { emoji:'🥕', label:'carrot' },
    { emoji:'🥦', label:'broccoli' },
    { emoji:'🍌', label:'banana' },
    { emoji:'🥛', label:'milk' },
    { emoji:'🥗', label:'salad' },
    { emoji:'🍉', label:'watermelon' }
  ];

  const JUNK_ITEMS = [
    { emoji:'🍟', label:'fries' },
    { emoji:'🍩', label:'donut' },
    { emoji:'🍭', label:'candy' },
    { emoji:'🍔', label:'burger' },
    { emoji:'🥤', label:'soda' },
    { emoji:'🍕', label:'pizza' },
    { emoji:'🧁', label:'cupcake' }
  ];

  const PRESET = {
    easy:   { spawnMs: 900, goodRatio: .72, speedMin: 90,  speedMax: 145, sizeMin: 62, sizeMax: 86, scoreGood: 12 },
    normal: { spawnMs: 760, goodRatio: .66, speedMin: 110, speedMax: 190, sizeMin: 58, sizeMax: 82, scoreGood: 14 },
    hard:   { spawnMs: 620, goodRatio: .60, speedMin: 130, speedMax: 235, sizeMin: 54, sizeMax: 78, scoreGood: 16 }
  };
  const CFG = PRESET[DIFF] || PRESET.normal;

  const state = {
    width: 0,
    height: 0,
    totalSec: Math.max(15, Number(qs.get('time') || 120) || 120),
    timeLeft: Math.max(15, Number(qs.get('time') || 120) || 120),
    score: 0,
    miss: 0,
    streak: 0,
    bestStreak: 0,
    goodHit: 0,
    junkHit: 0,
    goodMiss: 0,
    totalGood: 0,
    running: false,
    ended: false,
    lastTs: 0,
    spawnAccum: 0,
    targets: [],
    seededTick: 0
  };

  let roomState = null;
  let stopWatchRoom = null;
  let heartbeatTimer = 0;
  let submitTimer = 0;
  let rafId = 0;
  let summaryShown = false;
  let finishRequested = false;
  let countdownShown = false;
  let countdownInterval = 0;

  function fmtTime(sec){
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function createSeededRng(seed){
    let h = 2166136261 >>> 0;
    const str = String(seed || 'seed');
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function(){
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roomSeed(room){
    return room?.meta?.seed || qs.get('seed') || `${ROOM_ID}-seed`;
  }

  function getRng(room){
    return createSeededRng(`${roomSeed(room)}:${state.seededTick}`);
  }

  function pairGoal(room){
    const players = Object.keys(room?.players || {}).length || 2;
    return Math.max(240, players * state.totalSec * 3);
  }

  function pairScore(room){
    const scores = room?.scores || {};
    return Object.values(scores).reduce((sum, s) => sum + Number(s?.score || 0), 0);
  }

  function myScore(room){ return Number(room?.scores?.[PID]?.score || 0); }
  function myDone(room){ return !!room?.scores?.[PID]?.done; }

  function allDone(room){
    const ids = Object.keys(room?.players || {});
    if (!ids.length) return false;
    return ids.every(pid => !!room?.scores?.[pid]?.done);
  }

  function setTip(text){ if (UI.tip) UI.tip.textContent = text; }

  function coachMessage(){
    const acc = state.totalGood > 0 ? Math.round((state.goodHit / state.totalGood) * 100) : 0;

    if (state.miss >= 8) return 'ลองแตะเฉพาะของดีชิ้นใหญ่ก่อน จะช่วยลดการพลาด';
    if (state.goodMiss >= 5) return 'ชิ้นสีเขียวหรือผลไม้ควรเก็บก่อนนะ';
    if (state.streak >= 8) return 'ยอดเยี่ยม! เก็บต่อเนื่องแบบนี้ช่วยให้คะแนนคู่ขึ้นเร็วมาก';
    if (acc >= 80 && state.goodHit >= 6) return 'แม่นมาก! ตอนนี้ช่วยกันเก็บของดีเพื่อถึง Pair Goal';
    if (state.junkHit >= 4) return 'ระวัง junk สีโทนแดงหรือขนมหวาน แตะผิดจะเสียจังหวะ';
    return 'ช่วยกันเก็บของดีให้ได้มากที่สุด และอย่ากด junk';
  }

  function updateCoach(){
    const msg = coachMessage();
    setTip(msg);
    if (UI.coachBadge) UI.coachBadge.textContent = '🤖 AI Coach';
  }

  function updateLocalUi(){
    if (UI.roomPill) UI.roomPill.textContent = `ROOM ${ROOM_ID || '-'}`;
    if (UI.score) UI.score.textContent = String(state.score);
    if (UI.time) UI.time.textContent = fmtTime(state.timeLeft);
    if (UI.miss) UI.miss.textContent = String(state.miss);
    if (UI.streak) UI.streak.textContent = String(state.bestStreak);
    if (UI.goodHit) UI.goodHit.textContent = String(state.goodHit);
    if (UI.junkHit) UI.junkHit.textContent = String(state.junkHit);
    if (UI.goodMiss) UI.goodMiss.textContent = String(state.goodMiss);
    updateCoach();
  }

  function updatePairUi(room){
    const goal = pairGoal(room);
    const pScore = pairScore(room);
    const mine = myScore(room);

    if (UI.pairGoalValue) UI.pairGoalValue.textContent = String(goal);
    if (UI.pairGoalFill) UI.pairGoalFill.style.width = `${clamp((pScore / goal) * 100, 0, 100)}%`;
    if (UI.pairGoalSubFill) UI.pairGoalSubFill.style.width = `${clamp((mine / goal) * 100, 0, 100)}%`;
  }

  function setCurrentItemView(kind, emoji){
    if (UI.itemEmoji) UI.itemEmoji.textContent = emoji || (kind === 'good' ? '🍎' : '🍩');
    if (UI.itemTitle) UI.itemTitle.textContent = kind === 'good' ? 'GOOD' : 'JUNK';
    if (UI.itemSub) {
      UI.itemSub.textContent = kind === 'good'
        ? 'เก็บของดีเพื่อช่วยเพื่อนทำคะแนนคู่'
        : 'หลบ junk เพื่อไม่ให้เสียจังหวะ';
    }
  }

  function layoutStage(){
    if (!UI.stage) throw new Error('duetGameStage not found');
    UI.stage.style.position = 'relative';
    UI.stage.style.width = '100%';
    UI.stage.style.height = '100%';
    UI.stage.style.minHeight = '580px';
    UI.stage.style.overflow = 'hidden';

    const rect = UI.stage.getBoundingClientRect();
    state.width = rect.width || 640;
    state.height = rect.height || 580;
  }

  function buildSpawnPattern(room){
    state.seededTick += 1;
    const rng = getRng(room);

    const good = rng() < CFG.goodRatio;
    const pool = good ? GOOD_ITEMS : JUNK_ITEMS;
    const item = pool[Math.floor(rng() * pool.length)];

    const size = Math.round(CFG.sizeMin + rng() * (CFG.sizeMax - CFG.sizeMin));
    const laneCount = 5;
    const lane = Math.floor(rng() * laneCount);
    const laneWidth = state.width / laneCount;
    const x = clamp(laneWidth * lane + laneWidth / 2 + (rng() - 0.5) * 26, 34, state.width - 34);
    const speed = CFG.speedMin + rng() * (CFG.speedMax - CFG.speedMin);

    return {
      id: `duet_${Math.random().toString(36).slice(2,8)}_${Date.now().toString(36)}`,
      kind: good ? 'good' : 'junk',
      emoji: item.emoji,
      label: item.label,
      x,
      y: -size,
      size,
      speed,
      el: null
    };
  }

  function mountTarget(t){
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `target ${t.kind === 'good' ? 'good' : 'junk'}`;
    el.innerHTML = `<span class="t-emoji">${t.emoji}</span>`;
    el.setAttribute('aria-label', t.label);
    Object.assign(el.style, {
      width: `${t.size}px`,
      height: `${t.size}px`,
      left: `${t.x - t.size/2}px`,
      top: `${t.y}px`
    });

    el.addEventListener('click', () => onTargetTap(t.id));
    t.el = el;
    UI.stage.appendChild(el);
  }

  function removeTarget(id){
    const idx = state.targets.findIndex(t => t.id === id);
    if (idx < 0) return null;
    const [t] = state.targets.splice(idx, 1);
    try{ t.el && t.el.remove(); }catch(_){}
    return t;
  }

  function onTargetTap(id){
    if (!state.running || state.ended) return;
    const t = removeTarget(id);
    if (!t) return;

    setCurrentItemView(t.kind, t.emoji);

    if (t.kind === 'good') {
      state.score += CFG.scoreGood + Math.min(14, state.streak);
      state.goodHit += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      setTip('เก็บของดีได้แล้ว! ช่วยกันไปต่อ');
    } else {
      state.junkHit += 1;
      state.miss += 1;
      state.streak = 0;
      setTip('โอ๊ะ แตะ junk แล้ว ลองเลือกชิ้นสีเขียวหรือผลไม้แทน');
    }

    updateLocalUi();
  }

  function onGoodMiss(id){
    const t = removeTarget(id);
    if (!t || t.kind !== 'good') return;
    state.goodMiss += 1;
    state.miss += 1;
    state.streak = 0;
    setTip('พลาดของดีไปหนึ่งชิ้น ลองแตะชิ้นที่ตกช้ากว่าก่อน');
    updateLocalUi();
  }

  async function pushScore(done = false){
    await HHAMulti.submitScore({
      game: GAME,
      mode: MODE,
      roomCode: ROOM_ID,
      playerId: PID,
      score: state.score,
      combo: state.bestStreak,
      miss: state.miss,
      acc: state.totalGood > 0 ? Math.round((state.goodHit / state.totalGood) * 100) : 0,
      hp: 100,
      charge: 0,
      done,
      result: done ? 'finished' : ''
    });
  }

  async function pushReport(){
    await HHAMulti.submitReport({
      game: GAME,
      mode: MODE,
      roomCode: ROOM_ID,
      playerId: PID,
      result: 'finished',
      score: state.score,
      combo: state.bestStreak,
      miss: state.miss,
      acc: state.totalGood > 0 ? Math.round((state.goodHit / state.totalGood) * 100) : 0
    });
  }

  function clearRuntime(){
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (submitTimer) clearInterval(submitTimer);
    if (countdownInterval) clearInterval(countdownInterval);
    heartbeatTimer = 0;
    submitTimer = 0;
    countdownInterval = 0;
    try{ cancelAnimationFrame(rafId); }catch(_){}
  }

  async function endRun(){
    if (state.ended) return;
    state.ended = true;
    state.running = false;

    clearRuntime();
    for (const t of [...state.targets]) removeTarget(t.id);

    try{
      await pushScore(true);
      await pushReport();
    }catch(err){
      console.warn(err);
    }

    if (roomState && allDone(roomState) && !finishRequested) {
      finishRequested = true;
      try{
        await HHAMulti.finishMatch({
          game: GAME,
          mode: MODE,
          roomCode: ROOM_ID
        });
      }catch(err){
        console.warn(err);
      }
    }

    showSummary();
  }

  function showCountdownOverlay(){
    if (!UI.countdownOverlay || countdownShown) return;
    countdownShown = true;
    UI.countdownOverlay.classList.add('show');

    let n = 3;
    UI.countdownNum.textContent = String(n);
    UI.countdownText.textContent = 'จับคู่ให้พร้อม แล้วเริ่มพร้อมกัน';

    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      n -= 1;
      if (n > 0) {
        UI.countdownNum.textContent = String(n);
      } else if (n === 0) {
        UI.countdownNum.textContent = 'GO!';
        UI.countdownText.textContent = 'ช่วยกันเก็บของดีให้ถึง Pair Goal';
      } else {
        clearInterval(countdownInterval);
        UI.countdownOverlay.classList.remove('show');
      }
    }, 1000);
  }

  function showSummary(){
    if (summaryShown || !UI.resultMount) return;
    summaryShown = true;

    const players = Object.entries(roomState?.players || {}).map(([pid, p]) => {
      const s = roomState?.scores?.[pid] || {};
      return {
        pid,
        name: p?.name || pid,
        score: Number(s?.score || 0),
        miss: Number(s?.miss || 0),
        streak: Number(s?.combo || 0),
        done: !!s?.done
      };
    }).sort((a,b) => b.score - a.score);

    const pair = pairScore(roomState);
    const goal = pairGoal(roomState);
    const mine = players.find(p => p.pid === PID);
    const mate = players.find(p => p.pid !== PID);

    UI.resultMount.hidden = false;
    UI.resultMount.innerHTML = `
      <div class="duet-result-card">
        <div class="duet-result-title">สรุปผล GoodJunk Duet</div>
        <div class="duet-result-sub">
          คะแนนคู่รวม <strong style="color:#7a2558;">${pair}</strong> / เป้าหมาย <strong style="color:#244f6d;">${goal}</strong>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="border:1px solid #bfe3f2;border-radius:20px;padding:14px;background:#fff;">
            <div style="font-size:12px;color:#6b7280;font-weight:1000;">ฉัน</div>
            <div style="margin-top:6px;font-size:28px;font-weight:1100;color:#7a2558;">${mine ? mine.score : state.score}</div>
            <div style="margin-top:8px;color:#6b7280;font-size:13px;line-height:1.6;">Miss ${mine ? mine.miss : state.miss} • Best Streak ${mine ? mine.streak : state.bestStreak}</div>
          </div>

          <div style="border:1px solid #bfe3f2;border-radius:20px;padding:14px;background:#fff;">
            <div style="font-size:12px;color:#6b7280;font-weight:1000;">เพื่อนคู่</div>
            <div style="margin-top:6px;font-size:28px;font-weight:1100;color:#244f6d;">${mate ? mate.score : 0}</div>
            <div style="margin-top:8px;color:#6b7280;font-size:13px;line-height:1.6;">${mate ? esc(mate.name) : 'ยังไม่มีข้อมูลอีกคน'}</div>
          </div>
        </div>

        <div style="border:1px solid #bfe3f2;border-radius:20px;padding:14px;background:#fff;">
          <div style="font-size:14px;font-weight:1100;color:#7a2558;margin-bottom:8px;">ผลในห้อง</div>
          <div style="display:grid;gap:8px;">
            ${players.map((p, idx) => `
              <div style="display:grid;grid-template-columns:32px 1fr auto auto;gap:10px;align-items:center;border-radius:14px;border:1px solid #e3f0f6;padding:10px;background:${p.pid===PID?'#fff4fb':'#ffffff'};">
                <div style="font-weight:1100;color:#7a2558;">${idx + 1}</div>
                <div>
                  <div style="font-weight:1100;color:#4d4a42;">${esc(p.name)} ${p.pid===PID?'<span style="color:#c74f8d;font-size:12px;">(คุณ)</span>':''}</div>
                  <div style="margin-top:4px;color:#94a3b8;font-size:12px;">${esc(p.pid)}</div>
                </div>
                <div style="font-weight:1100;color:#244f6d;">${p.score}</div>
                <div style="color:#6b7280;font-size:12px;">Miss ${p.miss}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="duet-result-actions">
          <button type="button" id="duetRematchBtn" class="btn primary">🔁 Rematch</button>
          <button type="button" id="duetBackLobbyBtn" class="btn ghost">👥 Back Lobby</button>
          <a href="${esc(HUB)}" class="btn ghost">🏠 Hub</a>
        </div>
      </div>
    `;

    const btnRematch = document.getElementById('duetRematchBtn');
    const btnBackLobby = document.getElementById('duetBackLobbyBtn');

    if (btnRematch) {
      btnRematch.addEventListener('click', async () => {
        try{
          const readyCount = await HHAMulti.requestRematch({
            game: GAME,
            mode: MODE,
            roomCode: ROOM_ID,
            playerId: PID
          });

          const room = await HHAMulti.readRoom(GAME, MODE, ROOM_ID);
          const totalPlayers = Object.keys(room?.players || {}).length;

          if (room?.meta?.hostPlayerId === PID && readyCount >= Math.max(2, totalPlayers)) {
            await HHAMulti.resetForRematch({
              game: GAME,
              mode: MODE,
              roomCode: ROOM_ID,
              playerId: PID
            });
          } else {
            setTip(`ส่งคำขอรีแมตช์แล้ว (${readyCount}/${totalPlayers})`);
          }
        }catch(err){
          console.warn(err);
        }
      });
    }

    if (btnBackLobby) {
      btnBackLobby.addEventListener('click', () => {
        const u = new URL('./goodjunk-duet-lobby.html', location.href);
        for (const [k,v] of qs.entries()) u.searchParams.set(k, v);
        u.searchParams.set('roomId', ROOM_ID);
        u.searchParams.set('hub', HUB);
        location.href = u.toString();
      });
    }
  }

  function loop(ts){
    if (!state.running || state.ended) return;

    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.04, (ts - state.lastTs) / 1000);
    state.lastTs = ts;

    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.spawnAccum += dt * 1000;

    if (state.spawnAccum >= CFG.spawnMs) {
      state.spawnAccum = 0;
      const t = buildSpawnPattern(roomState);
      state.targets.push(t);
      mountTarget(t);
      if (t.kind === 'good') state.totalGood += 1;
      setCurrentItemView(t.kind, t.emoji);
    }

    for (let i = state.targets.length - 1; i >= 0; i--) {
      const t = state.targets[i];
      t.y += t.speed * dt;
      if (t.el) t.el.style.top = `${t.y}px`;

      if (t.y > state.height + 24) {
        if (t.kind === 'good') onGoodMiss(t.id);
        else removeTarget(t.id);
      }
    }

    updateLocalUi();
    updatePairUi(roomState);

    if (state.timeLeft <= 0) {
      endRun();
      return;
    }

    rafId = requestAnimationFrame(loop);
  }

  async function startRun(){
    if (state.running || state.ended) return;
    state.running = true;
    state.ended = false;
    state.lastTs = 0;
    showCountdownOverlay();
    setTip('เริ่มแล้ว! ช่วยกันเก็บของดีให้ถึง Pair Goal');

    try{ await pushScore(false); }catch(_){}

    heartbeatTimer = setInterval(() => {
      HHAMulti.heartbeat({
        game: GAME,
        mode: MODE,
        roomCode: ROOM_ID,
        playerId: PID
      }).catch(() => {});
    }, 2500);

    submitTimer = setInterval(() => {
      pushScore(false).catch(() => {});
    }, 1200);

    setTimeout(() => {
      rafId = requestAnimationFrame(loop);
    }, 3200);
  }

  async function ensurePresence(){
    const room = await HHAMulti.readRoom(GAME, MODE, ROOM_ID);
    if (!room) throw new Error('room-not-found');

    if (!(room.players || {})[PID]) {
      await HHAMulti.joinRoom({
        game: GAME,
        mode: MODE,
        roomCode: ROOM_ID,
        playerId: PID,
        name: NAME,
        view: VIEW || 'mobile',
        pid: PID
      });
    } else {
      await HHAMulti.rootRef(GAME, MODE, ROOM_ID).child(`players/${PID}`).update({
        name: NAME,
        online: true,
        lastSeenAt: Date.now(),
        view: VIEW || 'mobile',
        pid: PID
      });
    }
  }

  function renderFromRoom(room){
    roomState = room || null;
    updatePairUi(roomState);

    const phase = String(room?.match?.phase || room?.meta?.status || 'lobby');
    if (UI.roomPill) UI.roomPill.textContent = `ROOM ${ROOM_ID || '-'}`;

    if (phase === 'countdown' && !countdownShown && !state.running) {
      showCountdownOverlay();
    }

    if (phase === 'playing' && !state.running && !state.ended) {
      startRun();
    }

    if (phase === 'ended' && !summaryShown) {
      showSummary();
    }
  }

  function bindWatch(){
    if (stopWatchRoom) {
      try{ stopWatchRoom(); }catch(_){}
    }

    stopWatchRoom = HHAMulti.watchRoom(
      { game: GAME, mode: MODE, roomCode: ROOM_ID },
      (room) => renderFromRoom(room),
      (err) => console.error(err)
    );
  }

  async function boot(){
    try{
      if (!window.firebase || !window.firebase.database) throw new Error('firebase database not loaded');
      if (!window.HHAMulti) throw new Error('HHAMulti not loaded');
      if (!ROOM_ID) throw new Error('missing roomId');

      AUTH_USER = await ensureAnonAuth();
      PID = AUTH_USER.uid;
      NAME = normalizeName(qs.get('name') || `Player-${PID.slice(0,4)}`);

      layoutStage();
      updateLocalUi();
      setCurrentItemView('good', '🍉');
      setTip('กำลังเชื่อมห้อง Duet...');
      await ensurePresence();
      bindWatch();

      window.addEventListener('resize', layoutStage);
    }catch(err){
      console.error(err);
      setTip(`เชื่อมห้องไม่สำเร็จ: ${err?.message || err}`);
    }
  }

  window.addEventListener('beforeunload', () => {
    clearRuntime();
    try{
      HHAMulti.setOffline({
        game: GAME,
        mode: MODE,
        roomCode: ROOM_ID,
        playerId: PID
      });
    }catch(_){}
    try{ stopWatchRoom && stopWatchRoom(); }catch(_){}
  });

  boot();
})();
