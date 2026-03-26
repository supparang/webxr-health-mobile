(function(){
  'use strict';

  const qs = new URLSearchParams(location.search);

  function makeDevicePid() {
    try {
      const KEY = 'GJ_DEVICE_PID';
      let pid = localStorage.getItem(KEY);
      if (!pid) {
        pid = `p-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(KEY, pid);
      }
      return pid;
    } catch {
      return `p-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function normalizePid(rawPid) {
    const v = String(rawPid || '').trim().replace(/[.#$[\]/]/g, '-');
    if (!v) return makeDevicePid();
    if (v.toLowerCase() === 'anon') return makeDevicePid();
    return v.slice(0, 80);
  }

  function normalizeRoomId(rawRoomId) {
    return String(rawRoomId || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
  }

  function normalizeName(raw) {
    return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 40) || 'Player';
  }

  const RUN_CTX = window.__GJ_DUET_CTX__ || {
    pid: normalizePid(qs.get('pid') || ''),
    name: qs.get('name') || '',
    studyId: qs.get('studyId') || '',
    roomId: normalizeRoomId(qs.get('roomId') || ''),
    mode: 'duet',
    diff: qs.get('diff') || 'normal',
    time: qs.get('time') || '120',
    seed: qs.get('seed') || String(Date.now()),
    startAt: Number(qs.get('startAt') || 0) || 0,
    hub: qs.get('hub') || './hub.html',
    view: qs.get('view') || 'mobile',
    run: qs.get('run') || 'play',
    gameId: qs.get('gameId') || 'goodjunk'
  };

  const GAME = 'goodjunk';
  const MODE = 'duet';
  const GJ_PID = normalizePid(RUN_CTX.pid || '');
  const GJ_NAME = normalizeName(RUN_CTX.name || GJ_PID);
  const GJ_ROOM_ID = normalizeRoomId(RUN_CTX.roomId || '');
  const GJ_HUB = RUN_CTX.hub || './hub.html';

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

  const DIFF_PRESET = {
    easy:   { spawnMs: 930, goodRatio: 0.70, speedMin: 90,  speedMax: 150, targetSizeMin: 60, targetSizeMax: 84, scoreGood: 12 },
    normal: { spawnMs: 760, goodRatio: 0.65, speedMin: 110, speedMax: 190, targetSizeMin: 58, targetSizeMax: 82, scoreGood: 14 },
    hard:   { spawnMs: 610, goodRatio: 0.60, speedMin: 130, speedMax: 240, targetSizeMin: 56, targetSizeMax: 80, scoreGood: 16 }
  };

  const cfg = DIFF_PRESET[RUN_CTX.diff] || DIFF_PRESET.normal;

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
    resultMount: document.getElementById('duetResultMount')
  };

  let roomState = null;
  let stopWatchRoom = null;
  let heartbeatTimer = 0;
  let submitTimer = 0;
  let loopHandle = 0;
  let spawnClock = 0;
  let localStarted = false;
  let localEnded = false;
  let summaryShown = false;
  let lastTs = 0;
  let finishRequested = false;

  const state = {
    width: 0,
    height: 0,
    timeSec: Math.max(15, Number(RUN_CTX.time || 120) || 120),
    timeLeft: Math.max(15, Number(RUN_CTX.time || 120) || 120),
    score: 0,
    miss: 0,
    streak: 0,
    bestStreak: 0,
    goodHit: 0,
    junkHit: 0,
    goodMiss: 0,
    totalGood: 0,
    items: []
  };

  function esc(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;');
  }

  function clamp(n, min, max){
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function fmtTime(sec){
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function pairGoal(room){
    const players = Object.keys(room?.players || {}).length || 2;
    return Math.max(240, players * state.timeSec * 3);
  }

  function pairScore(room){
    const scores = room?.scores || {};
    return Object.values(scores).reduce((sum, s) => sum + Number(s?.score || 0), 0);
  }

  function myScore(room){
    return Number(room?.scores?.[GJ_PID]?.score || 0);
  }

  function myDone(room){
    return !!room?.scores?.[GJ_PID]?.done;
  }

  function allDone(room){
    const players = Object.keys(room?.players || {});
    if (!players.length) return false;
    return players.every(pid => !!room?.scores?.[pid]?.done);
  }

  function setTip(text){
    if (UI.tip) UI.tip.textContent = text;
  }

  function updateUiFromLocal(){
    if (UI.roomPill) UI.roomPill.textContent = `ROOM ${GJ_ROOM_ID || '-'}`;
    if (UI.score) UI.score.textContent = String(state.score);
    if (UI.time) UI.time.textContent = fmtTime(state.timeLeft);
    if (UI.miss) UI.miss.textContent = String(state.miss);
    if (UI.streak) UI.streak.textContent = String(state.bestStreak);
    if (UI.goodHit) UI.goodHit.textContent = String(state.goodHit);
    if (UI.junkHit) UI.junkHit.textContent = String(state.junkHit);
    if (UI.goodMiss) UI.goodMiss.textContent = String(state.goodMiss);
  }

  function updatePairUi(room){
    const goal = pairGoal(room);
    const pScore = pairScore(room);
    const mine = myScore(room);

    if (UI.pairGoalValue) UI.pairGoalValue.textContent = String(goal);
    if (UI.pairGoalFill) UI.pairGoalFill.style.width = `${clamp((pScore / goal) * 100, 0, 100)}%`;
    if (UI.pairGoalSubFill) UI.pairGoalSubFill.style.width = `${clamp((mine / goal) * 100, 0, 100)}%`;
  }

  function setCurrentItemView(kind){
    const pool = kind === 'good' ? GOOD_ITEMS : JUNK_ITEMS;
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (UI.itemEmoji) UI.itemEmoji.textContent = item.emoji;
    if (UI.itemTitle) UI.itemTitle.textContent = kind === 'good' ? 'GOOD' : 'JUNK';
    if (UI.itemSub) UI.itemSub.textContent = kind === 'good' ? 'เก็บของดีให้ได้มากที่สุด' : 'หลบ junk ไม่ให้เสีย streak';
  }

  function ensureStage(){
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

  function randomItem(){
    const good = Math.random() < cfg.goodRatio;
    const data = good
      ? GOOD_ITEMS[Math.floor(Math.random() * GOOD_ITEMS.length)]
      : JUNK_ITEMS[Math.floor(Math.random() * JUNK_ITEMS.length)];

    const size = Math.round(cfg.targetSizeMin + Math.random() * (cfg.targetSizeMax - cfg.targetSizeMin));
    const x = clamp(30 + Math.random() * (state.width - 60), 30, state.width - 30);
    const speed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);

    return {
      id: `duet_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`,
      kind: good ? 'good' : 'junk',
      emoji: data.emoji,
      label: data.label,
      x,
      y: -size,
      size,
      speed,
      el: null
    };
  }

  function mountItem(item){
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'duet-fall';
    el.innerHTML = item.emoji;
    el.setAttribute('aria-label', item.label);
    Object.assign(el.style, {
      position: 'absolute',
      left: `${item.x}px`,
      top: `${item.y}px`,
      width: `${item.size}px`,
      height: `${item.size}px`,
      marginLeft: `-${item.size/2}px`,
      borderRadius: '18px',
      border: '1px solid rgba(148,163,184,.18)',
      background: item.kind === 'good'
        ? 'linear-gradient(180deg, rgba(34,197,94,.24), rgba(34,197,94,.10))'
        : 'linear-gradient(180deg, rgba(239,68,68,.24), rgba(239,68,68,.10))',
      color: '#fff',
      fontSize: `${Math.round(item.size * 0.58)}px`,
      boxShadow: '0 12px 24px rgba(0,0,0,.22)',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center'
    });

    el.addEventListener('click', () => hitItem(item.id));
    item.el = el;
    UI.stage.appendChild(el);
  }

  function removeItem(id){
    const idx = state.items.findIndex(it => it.id === id);
    if (idx < 0) return null;
    const [it] = state.items.splice(idx, 1);
    try{ it.el && it.el.remove(); }catch(_){}
    return it;
  }

  function hitItem(id){
    if (!localStarted || localEnded) return;
    const item = removeItem(id);
    if (!item) return;

    setCurrentItemView(item.kind === 'good' ? 'good' : 'junk');

    if (item.kind === 'good') {
      state.score += cfg.scoreGood + Math.min(12, state.streak);
      state.goodHit += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      setTip('ดีมาก! เก็บของดีได้แล้ว ช่วยกันทำ pair score ต่อ');
    } else {
      state.junkHit += 1;
      state.miss += 1;
      state.streak = 0;
      setTip('โดน junk แล้ว ระวังพลาดต่อเนื่อง');
    }

    updateUiFromLocal();
  }

  function missGood(id){
    const item = removeItem(id);
    if (!item) return;
    if (item.kind !== 'good') return;

    state.goodMiss += 1;
    state.miss += 1;
    state.streak = 0;
    setTip('พลาดของดีไปหนึ่งชิ้น ลองจับจังหวะใหม่');
    updateUiFromLocal();
  }

  async function pushScore(done = false){
    try{
      await HHAMulti.submitScore({
        game: GAME,
        mode: MODE,
        roomCode: GJ_ROOM_ID,
        playerId: GJ_PID,
        score: state.score,
        combo: state.bestStreak,
        miss: state.miss,
        acc: state.totalGood > 0 ? Math.round((state.goodHit / state.totalGood) * 100) : 0,
        hp: 100,
        charge: 0,
        done,
        result: done ? 'finished' : ''
      });
    }catch(err){
      console.warn('[goodjunk.safe.duet] submitScore warn:', err);
    }
  }

  async function pushReport(){
    try{
      await HHAMulti.submitReport({
        game: GAME,
        mode: MODE,
        roomCode: GJ_ROOM_ID,
        playerId: GJ_PID,
        result: 'finished',
        score: state.score,
        combo: state.bestStreak,
        miss: state.miss,
        acc: state.totalGood > 0 ? Math.round((state.goodHit / state.totalGood) * 100) : 0
      });
    }catch(err){
      console.warn('[goodjunk.safe.duet] submitReport warn:', err);
    }
  }

  function clearTimers(){
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (submitTimer) clearInterval(submitTimer);
    heartbeatTimer = 0;
    submitTimer = 0;
  }

  async function endRun(){
    if (localEnded) return;
    localEnded = true;
    localStarted = false;
    clearTimers();

    for (const it of [...state.items]) removeItem(it.id);
    await pushScore(true);
    await pushReport();

    if (roomState && allDone(roomState) && !finishRequested) {
      finishRequested = true;
      try{
        await HHAMulti.finishMatch({
          game: GAME,
          mode: MODE,
          roomCode: GJ_ROOM_ID
        });
      }catch(err){
        console.warn('[goodjunk.safe.duet] finishMatch warn:', err);
      }
    }

    showSummary();
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
    const mine = players.find(p => p.pid === GJ_PID);
    const mate = players.find(p => p.pid !== GJ_PID);

    UI.resultMount.hidden = false;
    UI.resultMount.innerHTML = `
      <div class="duet-result-card">
        <div class="duet-result-title">สรุปผล GoodJunk Duet</div>
        <div class="duet-result-sub">
          คะแนนคู่รวม <strong style="color:#fff;">${pair}</strong> / เป้าหมาย <strong style="color:#fff;">${goal}</strong>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="border:1px solid rgba(148,163,184,.18);border-radius:20px;padding:14px;background:rgba(255,255,255,.03);">
            <div style="font-size:12px;color:#94a3b8;font-weight:1000;">ฉัน</div>
            <div style="margin-top:6px;font-size:28px;font-weight:1100;color:#fff;">${mine ? mine.score : state.score}</div>
            <div style="margin-top:8px;color:#cbd5e1;font-size:13px;line-height:1.6;">Miss ${mine ? mine.miss : state.miss} • Best Streak ${mine ? mine.streak : state.bestStreak}</div>
          </div>

          <div style="border:1px solid rgba(148,163,184,.18);border-radius:20px;padding:14px;background:rgba(255,255,255,.03);">
            <div style="font-size:12px;color:#94a3b8;font-weight:1000;">เพื่อนคู่</div>
            <div style="margin-top:6px;font-size:28px;font-weight:1100;color:#fff;">${mate ? mate.score : 0}</div>
            <div style="margin-top:8px;color:#cbd5e1;font-size:13px;line-height:1.6;">${mate ? esc(mate.name) : 'ยังไม่มีข้อมูลอีกคน'}</div>
          </div>
        </div>

        <div style="border:1px solid rgba(148,163,184,.18);border-radius:20px;padding:14px;background:rgba(255,255,255,.03);">
          <div style="font-size:14px;font-weight:1100;color:#fff;margin-bottom:8px;">ผลในห้อง</div>
          <div style="display:grid;gap:8px;">
            ${players.map((p, idx) => `
              <div style="display:grid;grid-template-columns:32px 1fr auto auto;gap:10px;align-items:center;border-radius:14px;border:1px solid rgba(148,163,184,.12);padding:10px;background:${p.pid===GJ_PID?'rgba(30,41,59,.84)':'rgba(15,23,42,.48)'};">
                <div style="font-weight:1100;color:#fff;">${idx + 1}</div>
                <div>
                  <div style="font-weight:1100;color:#fff;">${esc(p.name)} ${p.pid===GJ_PID?'<span style="color:#fbcfe8;font-size:12px;">(คุณ)</span>':''}</div>
                  <div style="margin-top:4px;color:#94a3b8;font-size:12px;">${esc(p.pid)}</div>
                </div>
                <div style="font-weight:1100;color:#fff;">${p.score}</div>
                <div style="color:#cbd5e1;font-size:12px;">Miss ${p.miss}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="duet-result-actions">
          <button type="button" id="duetRematchBtn" class="btn violet">🔁 Rematch</button>
          <button type="button" id="duetBackLobbyBtn" class="btn ghost">👥 Back Lobby</button>
          <a href="${esc(GJ_HUB)}" class="btn ghost">🏠 Hub</a>
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
            roomCode: GJ_ROOM_ID,
            playerId: GJ_PID
          });

          const room = await HHAMulti.readRoom(GAME, MODE, GJ_ROOM_ID);
          const totalPlayers = Object.keys(room?.players || {}).length;

          if (room?.meta?.hostPlayerId === GJ_PID && readyCount >= Math.max(2, totalPlayers)) {
            await HHAMulti.resetForRematch({
              game: GAME,
              mode: MODE,
              roomCode: GJ_ROOM_ID,
              playerId: GJ_PID
            });
          } else {
            setTip(`ส่งคำขอรีแมตช์แล้ว (${readyCount}/${totalPlayers})`);
          }
        }catch(err){
          console.warn('[goodjunk.safe.duet] rematch warn:', err);
        }
      });
    }

    if (btnBackLobby) {
      btnBackLobby.addEventListener('click', () => {
        const u = new URL('./goodjunk-duet-lobby.html', location.href);
        for (const [k,v] of qs.entries()) u.searchParams.set(k, v);
        u.searchParams.set('roomId', GJ_ROOM_ID);
        u.searchParams.set('hub', GJ_HUB);
        location.href = u.toString();
      });
    }
  }

  function loop(ts){
    if (!localStarted || localEnded) return;

    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.04, (ts - lastTs) / 1000);
    lastTs = ts;

    state.timeLeft = Math.max(0, state.timeLeft - dt);
    spawnClock += dt * 1000;

    if (spawnClock >= cfg.spawnMs) {
      spawnClock = 0;
      const item = randomItem();
      state.items.push(item);
      mountItem(item);
      if (item.kind === 'good') state.totalGood += 1;
      setCurrentItemView(item.kind);
    }

    for (let i = state.items.length - 1; i >= 0; i--) {
      const it = state.items[i];
      it.y += it.speed * dt;
      if (it.el) it.el.style.top = `${it.y}px`;

      if (it.y > state.height + 24) {
        if (it.kind === 'good') missGood(it.id);
        else removeItem(it.id);
      }
    }

    updateUiFromLocal();
    updatePairUi(roomState);

    if (state.timeLeft <= 0) {
      endRun().catch(console.error);
      return;
    }

    loopHandle = requestAnimationFrame(loop);
  }

  function startRun(){
    if (localStarted || localEnded) return;
    localStarted = true;
    localEnded = false;
    lastTs = 0;
    setTip('เริ่มแล้ว! ช่วยกันเก็บของดีให้ถึง pair goal');
    updateUiFromLocal();

    pushScore(false);
    heartbeatTimer = setInterval(() => {
      HHAMulti.heartbeat({
        game: GAME,
        mode: MODE,
        roomCode: GJ_ROOM_ID,
        playerId: GJ_PID
      }).catch(() => {});
    }, 2500);

    submitTimer = setInterval(() => {
      pushScore(false);
    }, 1200);

    loopHandle = requestAnimationFrame(loop);
  }

  async function ensurePresence(){
    const room = await HHAMulti.readRoom(GAME, MODE, GJ_ROOM_ID);
    if (!room) throw new Error('room-not-found');

    if (!(room.players || {})[GJ_PID]) {
      await HHAMulti.joinRoom({
        game: GAME,
        mode: MODE,
        roomCode: GJ_ROOM_ID,
        playerId: GJ_PID,
        name: GJ_NAME,
        view: RUN_CTX.view || 'mobile',
        pid: GJ_PID
      });
    } else {
      await HHAMulti.rootRef(GAME, MODE, GJ_ROOM_ID).child(`players/${GJ_PID}`).update({
        name: GJ_NAME,
        online: true,
        lastSeenAt: Date.now(),
        view: RUN_CTX.view || 'mobile',
        pid: GJ_PID
      });
    }
  }

  function renderFromRoom(room){
    roomState = room || null;
    updatePairUi(roomState);

    const phase = String(room?.match?.phase || room?.meta?.status || 'lobby');
    const roomPill = UI.roomPill;
    if (roomPill) roomPill.textContent = `ROOM ${GJ_ROOM_ID || '-'}`;

    if (phase === 'playing' && !localStarted && !localEnded) {
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
      { game: GAME, mode: MODE, roomCode: GJ_ROOM_ID },
      (room) => renderFromRoom(room),
      (err) => console.error('[goodjunk.safe.duet] watchRoom error:', err)
    );
  }

  async function boot(){
    try{
      if (!window.firebase || !window.firebase.database) throw new Error('firebase-database not loaded');
      if (!window.HHAMulti) throw new Error('HHAMulti not loaded');
      if (!GJ_ROOM_ID) throw new Error('missing roomId');

      ensureStage();
      updateUiFromLocal();
      setCurrentItemView('good');
      await ensurePresence();
      bindWatch();
      setTip('กำลังเชื่อมห้อง Duet...');
    }catch(err){
      console.error('[goodjunk.safe.duet] boot failed:', err);
      setTip(`เชื่อมห้องไม่สำเร็จ: ${err?.message || err}`);
    }
  }

  window.addEventListener('beforeunload', () => {
    clearTimers();
    try{ cancelAnimationFrame(loopHandle); }catch(_){}
    try{
      HHAMulti.setOffline({
        game: GAME,
        mode: MODE,
        roomCode: GJ_ROOM_ID,
        playerId: GJ_PID
      });
    }catch(_){}
    try{ stopWatchRoom && stopWatchRoom(); }catch(_){}
  });

  boot();
})();
