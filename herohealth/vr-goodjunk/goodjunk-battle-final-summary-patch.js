/*
  HeroHealth • GoodJunk Battle Final Summary Patch
  v20260515-battle-v236-rematch-new-match

  Purpose:
  - Fix rival identity: never use SFX / DOM text as rival name
  - Sync local player score/hp/power to Firebase
  - Create one shared finalSummary for both players
  - Force legacy end/showSummary paths to use Firebase finalSummary
  - Fix “Battle อีกครั้ง” so it creates a NEW match, clears finalSummary, resets players
*/

(function(){
  'use strict';

  window.HHA_GJ_BATTLE_FINAL_PATCH =
    'v20260515-battle-v236-rematch-new-match';

  const params = new URLSearchParams(location.search);
  const ROOM_ROOT = 'hha-battle/goodjunk/battleV2Rooms';

  const patchState = {
    db:null,
    room:'',
    pid:'',
    name:'',
    role:'',
    view:'',
    matchId:'',
    playerSyncTimer:null,
    finalSummaryRendered:false,
    battleEnding:false,
    patched:false,
    roomListenerAttached:false
  };

  function now(){
    return Date.now();
  }

  function safeKey(v){
    return String(v || '')
      .trim()
      .replace(/[.#$/\[\]]/g,'_')
      .slice(0,96) || 'anon';
  }

  function normalizeRoom(v){
    let s = String(v || '').trim().toUpperCase();
    s = s.replace(/\s+/g,'').replace(/[^A-Z0-9-]/g,'');
    if (!s) return '';
    if (!s.startsWith('GJ-BT-')){
      s = 'GJ-BT-' + s
        .replace(/^GJ-BT/i,'')
        .replace(/^GJBT/i,'')
        .replace(/^BT/i,'')
        .replace(/^-/, '');
    }
    return s.slice(0,24);
  }

  function readGlobalState(){
    const s = window.state || window.GJ_STATE || window.BATTLE_STATE || {};

    patchState.room = normalizeRoom(
      s.room ||
      s.roomId ||
      params.get('room') ||
      params.get('roomId') ||
      ''
    );

    patchState.pid = String(
      s.pid ||
      params.get('pid') ||
      'anon'
    );

    patchState.name = String(
      s.name ||
      params.get('name') ||
      params.get('nick') ||
      'Hero'
    );

    patchState.role = String(
      s.role ||
      params.get('role') ||
      ''
    );

    patchState.view = String(
      s.view ||
      params.get('view') ||
      params.get('device') ||
      'mobile'
    );

    patchState.matchId = String(
      s.matchId ||
      params.get('matchId') ||
      ''
    );

    return s;
  }

  function roomPath(){
    readGlobalState();
    return `${ROOM_ROOT}/${safeKey(patchState.room)}`;
  }

  async function ensureDb(){
    if (patchState.db) return patchState.db;

    if (window.firebase && firebase.database){
      patchState.db = firebase.database();
      return patchState.db;
    }

    if (window.HHA_FIREBASE_READY){
      const fb = await window.HHA_FIREBASE_READY;
      if (fb && fb.db){
        patchState.db = fb.db;
        return patchState.db;
      }
    }

    throw new Error('Firebase database not ready');
  }

  function getTextNumber(id){
    const el = document.getElementById(id);
    if (!el) return 0;
    const n = Number(String(el.textContent || '').replace(/[^\d.-]/g,''));
    return Number.isFinite(n) ? n : 0;
  }

  function getScore(){
    const s = readGlobalState();

    return Number(
      s.score ??
      window.score ??
      getTextNumber('scoreText') ??
      getTextNumber('myScore') ??
      0
    );
  }

  function getHp(){
    const s = readGlobalState();

    return Number(
      s.hp ??
      s.heart ??
      window.hp ??
      window.heart ??
      100
    );
  }

  function getPower(){
    const s = readGlobalState();

    return Number(
      s.power ??
      window.power ??
      getTextNumber('powerText') ??
      0
    );
  }

  function getMetric(name, fallback=0){
    const s = readGlobalState();
    const v = s[name] ?? window[name] ?? fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function battlePlayersArray(room){
    return Object.values(room?.players || {})
      .filter(Boolean)
      .sort((a,b) => {
        const ar = a.role === 'host' ? 0 : 1;
        const br = b.role === 'host' ? 0 : 1;
        if (ar !== br) return ar - br;
        return Number(a.joinedAt || 0) - Number(b.joinedAt || 0);
      });
  }

  function getMePlayer(room){
    readGlobalState();

    return room?.players?.[safeKey(patchState.pid)] ||
      battlePlayersArray(room).find(p => p.pid === patchState.pid) ||
      null;
  }

  function getRivalPlayer(room){
    readGlobalState();
    return battlePlayersArray(room).find(p => p.pid !== patchState.pid) || null;
  }

  function safePlayerName(p, fallback='Player'){
    const n = String(p?.name || p?.nick || p?.displayName || '').trim();

    if (!n) return fallback;
    if (/^(sfx|sound|audio|เสียง)$/i.test(n)) return fallback;
    if (/🔊/.test(n)) return fallback;

    return n;
  }

  function heartText(hp){
    const n = Math.max(0, Math.min(100, Number(hp || 0)));
    const full = Math.ceil(n / 20);
    return '❤️'.repeat(full) + '♡'.repeat(Math.max(0,5-full));
  }

  function setText(selectors, text){
    for (const sel of selectors){
      let el = null;

      if (sel.startsWith('#')){
        el = document.getElementById(sel.slice(1));
      }else{
        el = document.querySelector(sel);
      }

      if (el){
        el.textContent = text;
        return true;
      }
    }

    return false;
  }

  function showOverlay(){
    const overlay =
      document.getElementById('summaryOverlay') ||
      document.getElementById('resultOverlay') ||
      document.getElementById('overlay') ||
      document.querySelector('[data-summary-overlay]') ||
      document.querySelector('.resultOverlay') ||
      document.querySelector('.summaryOverlay');

    if (overlay){
      overlay.classList.add('show');
      overlay.classList.add('active');
      overlay.style.display = overlay.style.display === 'none' ? 'flex' : overlay.style.display;
      overlay.style.visibility = 'visible';
      overlay.style.opacity = '1';
      overlay.style.pointerEvents = 'auto';
      overlay.style.zIndex = '9999';
    }
  }

  async function writeBattleSelf(extra={}, force=false){
    if (patchState.battleEnding && !force) return;

    const db = await ensureDb();
    const s = readGlobalState();

    const payload = {
      pid:patchState.pid,
      name:patchState.name,
      role:patchState.role || s.role || '',
      view:patchState.view,

      score:getScore(),
      hp:getHp(),
      maxHp:Number(s.maxHp || 100),
      power:getPower(),
      shield:getMetric('shield',0),

      attackUsed:getMetric('attackUsed', getMetric('attack',0)),
      shieldUsed:getMetric('shieldUsed',0),
      damageDealt:getMetric('damageDealt',0),
      damageTaken:getMetric('damageTaken',0),

      good:getMetric('good',0),
      junk:getMetric('junk',0),
      miss:getMetric('miss',0),
      combo:getMetric('combo',0),

      finished:!!(s.finished || extra.finished),
      updatedAt:now(),
      lastSeenAt:now(),

      ...extra
    };

    try{
      await db.ref(`${roomPath()}/players/${safeKey(patchState.pid)}`).update(payload);
    }catch(err){
      console.warn('[GJ Battle Patch] writeBattleSelf failed', err);
    }
  }

  function startPlayerSyncLoop(){
    clearInterval(patchState.playerSyncTimer);

    writeBattleSelf().catch(()=>{});

    patchState.playerSyncTimer = setInterval(() => {
      writeBattleSelf().catch(()=>{});
    }, 800);
  }

  async function acquireBattleFinalLock(){
    const db = await ensureDb();
    readGlobalState();

    const ref = db.ref(`${roomPath()}/battleEndLock`);

    try{
      const result = await ref.transaction(current => {
        if (current && current.locked) return;

        return {
          locked:true,
          byPid:patchState.pid,
          byName:patchState.name,
          at:now()
        };
      });

      return result && result.committed;
    }catch(err){
      console.warn('[GJ Battle Patch] acquireBattleFinalLock failed', err);
      return false;
    }
  }

  function makeBattleFinalSummary(room, reason='time-up'){
    readGlobalState();

    const players = battlePlayersArray(room).slice(0,2);
    const pA = players[0] || null;
    const pB = players[1] || null;

    function scoreOf(p){ return Number(p?.score || 0); }
    function hpOf(p){ return Number(p?.hp ?? p?.heart ?? 0); }

    let winner = null;
    let loser = null;

    if (pA && pB){
      if (hpOf(pA) > hpOf(pB)){
        winner = pA;
        loser = pB;
      }else if (hpOf(pA) < hpOf(pB)){
        winner = pB;
        loser = pA;
      }else if (scoreOf(pA) > scoreOf(pB)){
        winner = pA;
        loser = pB;
      }else if (scoreOf(pA) < scoreOf(pB)){
        winner = pB;
        loser = pA;
      }
    }

    return {
      roomId:patchState.room,
      matchId:room?.activeMatchId || room?.matchId || patchState.matchId || '',
      mode:'battle',
      battleType:'duel',
      reason,
      roundNo:Number(room?.series?.roundNo || 1),

      winnerPid:winner?.pid || '',
      winnerName:winner ? safePlayerName(winner,'Winner') : '',
      loserPid:loser?.pid || '',
      loserName:loser ? safePlayerName(loser,'Loser') : '',

      endedAt:now(),

      players:Object.fromEntries(players.map(p => [
        safeKey(p.pid),
        {
          pid:p.pid,
          name:safePlayerName(p,'Player'),
          role:p.role || '',
          score:Number(p.score || 0),
          hp:Number(p.hp ?? p.heart ?? 0),
          maxHp:Number(p.maxHp || 100),
          power:Number(p.power || 0),
          shield:Number(p.shield || 0),
          attackUsed:Number(p.attackUsed || p.attack || 0),
          shieldUsed:Number(p.shieldUsed || 0),
          damageDealt:Number(p.damageDealt || 0),
          damageTaken:Number(p.damageTaken || 0),
          good:Number(p.good || 0),
          junk:Number(p.junk || 0),
          miss:Number(p.miss || 0),
          combo:Number(p.combo || 0),
          finished:!!p.finished
        }
      ]))
    };
  }

  function bindBattleAgainButton(){
    setTimeout(() => {
      const buttons = Array.from(document.querySelectorAll('button,a'));

      const againBtn = buttons.find(btn =>
        /Battle\s*อีกครั้ง|เล่นอีกครั้ง|อีกครั้ง/i.test(btn.textContent || '')
      );

      if (againBtn){
        againBtn.removeAttribute('href');
        againBtn.dataset.rematchPatched = '1';

        againBtn.onclick = function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          startBattleAgainFromSummary();
          return false;
        };
      }
    }, 80);
  }

  function renderBattleSummaryFromFinal(summary){
    if (!summary || patchState.finalSummaryRendered) return;

    patchState.finalSummaryRendered = true;
    clearInterval(patchState.playerSyncTimer);

    readGlobalState();

    const myPid = patchState.pid;
    const me =
      summary.players?.[safeKey(myPid)] ||
      Object.values(summary.players || {}).find(p => p.pid === myPid) ||
      null;

    const rival =
      Object.values(summary.players || {}).find(p => p.pid !== myPid) ||
      null;

    const result =
      !summary.winnerPid
        ? 'draw'
        : summary.winnerPid === myPid
          ? 'win'
          : 'lose';

    const titleText =
      result === 'win'
        ? 'ชนะ Battle!'
        : result === 'lose'
          ? 'แพ้ Battle!'
          : 'เสมอ Battle!';

    setText(['#summaryTitle','[data-summary-title]','.summary-title'], titleText);

    setText(
      ['#summaryReason','[data-summary-reason]','.summary-reason'],
      `รอบที่ ${Number(summary.roundNo || 1)} • ${summary.reason || 'สรุปผล'}`
    );

    setText(
      ['#summaryMyName','[data-summary-my-name]','.summary-my-name'],
      `คุณ: ${safePlayerName(me, patchState.name || 'Hero')}`
    );

    setText(
      ['#summaryRivalName','[data-summary-rival-name]','.summary-rival-name'],
      `คู่แข่ง: ${safePlayerName(rival, 'คู่แข่ง')}`
    );

    setText(
      ['#summaryMyScore','[data-summary-my-score]','.summary-my-score'],
      String(Number(me?.score || 0))
    );

    setText(
      ['#summaryRivalScore','[data-summary-rival-score]','.summary-rival-score'],
      String(Number(rival?.score || 0))
    );

    setText(
      ['#summaryMyHeart','[data-summary-my-heart]','.summary-my-heart'],
      heartText(Number(me?.hp || 0))
    );

    setText(
      ['#summaryRivalHeart','[data-summary-rival-heart]','.summary-rival-heart'],
      heartText(Number(rival?.hp || 0))
    );

    showOverlay();
    bindBattleAgainButton();

    console.log('[GJ Battle Patch] FinalSummary rendered', {
      version:window.HHA_GJ_BATTLE_FINAL_PATCH,
      myPid,
      winnerPid:summary.winnerPid,
      winnerName:summary.winnerName,
      me,
      rival,
      result
    });
  }

  async function createFinalSummaryIfNeeded(reason='time-up'){
    const db = await ensureDb();

    await writeBattleSelf({
      finished:true,
      finishAt:now(),
      finishReason:reason
    }, true);

    const latest = await db.ref(roomPath()).get().then(s => s.val()).catch(() => null);
    if (!latest) return;

    if (latest.finalSummary){
      renderBattleSummaryFromFinal(latest.finalSummary);
      return;
    }

    const locked = await acquireBattleFinalLock();

    if (!locked){
      setTimeout(async () => {
        const again = await db.ref(roomPath()).get().then(s => s.val()).catch(() => null);
        if (again?.finalSummary){
          renderBattleSummaryFromFinal(again.finalSummary);
        }
      }, 700);

      return;
    }

    const latestAfterLock = await db.ref(roomPath()).get().then(s => s.val()).catch(() => latest);
    const finalSummary = makeBattleFinalSummary(latestAfterLock, reason);

    await db.ref(roomPath()).update({
      status:'ended',
      endedAt:now(),
      endReason:reason,
      finalSummary,
      updatedAt:now()
    });

    renderBattleSummaryFromFinal(finalSummary);
  }

  async function endBattleSafely(reason='time-up'){
    if (patchState.battleEnding || patchState.finalSummaryRendered) return;

    patchState.battleEnding = true;
    clearInterval(patchState.playerSyncTimer);

    try{
      await createFinalSummaryIfNeeded(reason);
    }catch(err){
      console.warn('[GJ Battle Patch] endBattleSafely failed', err);
      patchState.battleEnding = false;
    }
  }

  function finishBattleOnce(reason='time-up'){
    if (patchState.battleEnding || patchState.finalSummaryRendered) return;

    endBattleSafely(reason).catch(err => {
      console.warn('[GJ Battle Patch] finishBattleOnce failed', err);
    });
  }

  function renderRivalHud(room){
    const rival = getRivalPlayer(room);

    const rivalName = safePlayerName(rival,'คู่แข่ง');
    const rivalScore = Number(rival?.score || 0);
    const rivalHp = Number(rival?.hp ?? rival?.heart ?? 100);
    const rivalAttack = Number(rival?.attackUsed || rival?.attack || 0);
    const rivalShield = Number(rival?.shield || 0);

    setText(['#rivalName','[data-rival-name]'], rivalName);
    setText(['#rivalScore','[data-rival-score]'], String(rivalScore));
    setText(['#rivalHeart','#rivalHp','[data-rival-heart]'], heartText(rivalHp));
    setText(['#rivalAttack','[data-rival-attack]'], `${rivalAttack}/3`);
    setText(['#rivalShield','[data-rival-shield]'], rivalShield > 0 ? `🛡 ${rivalShield}` : '—');
  }

  async function startBattleAgainFromSummary(){
    try{
      const db = await ensureDb();
      readGlobalState();

      const latest = await db.ref(roomPath()).get().then(s => s.val()).catch(() => null);
      if (!latest){
        alert('ไม่พบข้อมูลห้อง Battle');
        return;
      }

      const players = battlePlayersArray(latest).slice(0, 2);

      if (players.length < 2){
        alert('ต้องมีผู้เล่น 2 คนก่อนเริ่ม Battle อีกครั้ง');
        return;
      }

      const matchId =
        'BT2-' + safeKey(patchState.room) + '-' + Date.now().toString(36).toUpperCase();

      const resetPlayers = {};

      players.forEach((p, idx) => {
        resetPlayers[safeKey(p.pid)] = {
          pid: p.pid,
          name: safePlayerName(p, idx === 0 ? 'Hero' : 'Player'),
          role: idx === 0 ? 'host' : 'guest',
          view: p.view || patchState.view || 'mobile',
          ready: true,
          rank: idx + 1,

          hp: 100,
          maxHp: 100,
          score: 0,
          power: 0,
          shield: 0,

          attackUsed: 0,
          shieldUsed: 0,
          damageDealt: 0,
          damageTaken: 0,

          good: 0,
          junk: 0,
          miss: 0,
          combo: 0,

          finished: false,
          finishAt: null,
          finishReason: '',

          joinedAt: p.joinedAt || Date.now(),
          updatedAt: Date.now(),
          lastSeenAt: Date.now()
        };
      });

      await db.ref(roomPath()).update({
        status: 'countdown',
        countdownAt: Date.now(),

        matchId,
        activeMatchId: matchId,

        mode: 'battle',
        battleType: 'duel',
        type: 'duel',

        capacity: 2,
        maxPlayers: 2,
        activePlayers: 2,

        startedAt: null,
        endedAt: null,
        endReason: null,

        finalSummary: null,
        summary: null,

        battleEndLock: null,
        rematchStartLock: null,

        players: resetPlayers,
        updatedAt: Date.now()
      });

      patchState.finalSummaryRendered = false;
      patchState.battleEnding = false;

      const runFile = location.pathname.includes('goodjunk-battle-v2-run-pc.html')
        ? './goodjunk-battle-v2-run-pc.html'
        : './goodjunk-vr-battle.html';

      const u = new URL(runFile, location.href);

      u.searchParams.set('room', patchState.room);
      u.searchParams.set('roomId', patchState.room);
      u.searchParams.set('matchId', matchId);

      u.searchParams.set('pid', patchState.pid);
      u.searchParams.set('name', patchState.name);
      u.searchParams.set('nick', patchState.name);

      u.searchParams.set('diff', params.get('diff') || 'normal');
      u.searchParams.set('time', params.get('time') || '90');
      u.searchParams.set('view', params.get('view') || patchState.view || 'pc');
      u.searchParams.set('device', params.get('device') || params.get('view') || patchState.view || 'pc');

      u.searchParams.set('mode', 'battle');
      u.searchParams.set('battleType', 'duel');
      u.searchParams.set('type', 'duel');
      u.searchParams.set('capacity', '2');
      u.searchParams.set('maxPlayers', '2');
      u.searchParams.set('run', 'play');

      u.searchParams.set('v', '20260515-battle-rematch-v236-new-match');

      location.href = u.toString();

    }catch(err){
      console.warn('[GJ Battle Patch] startBattleAgainFromSummary failed', err);
      alert('เริ่ม Battle อีกครั้งไม่สำเร็จ: ' + (err?.message || err));
    }
  }

  function patchLegacyFunctions(){
    const legacyNames = [
      'showSummary',
      'renderSummary',
      'showResult',
      'renderResult',
      'endGame',
      'finishGame',
      'gameOver'
    ];

    legacyNames.forEach(name => {
      const oldFn = window[name];

      window[name] = function(reason){
        console.warn(`[GJ Battle Patch] Legacy ${name} intercepted`);
        finishBattleOnce(reason || `legacy-${name}`);

        if (typeof oldFn === 'function'){
          return undefined;
        }
      };
    });

    window.endBattleSafely = endBattleSafely;
    window.finishBattleOnce = finishBattleOnce;
    window.renderBattleSummaryFromFinal = renderBattleSummaryFromFinal;
    window.writeBattleSelf = writeBattleSelf;
    window.startPlayerSyncLoop = startPlayerSyncLoop;
    window.startBattleAgainFromSummary = startBattleAgainFromSummary;
  }

  async function attachRoomListener(){
    if (patchState.roomListenerAttached) return;
    patchState.roomListenerAttached = true;

    try{
      const db = await ensureDb();

      if (!patchState.room){
        readGlobalState();
      }

      if (!patchState.room) return;

      db.ref(roomPath()).on('value', snap => {
        const room = snap.val();
        if (!room) return;

        if (window.state){
          window.state.roomData = room;
        }

        if (room.finalSummary){
          renderBattleSummaryFromFinal(room.finalSummary);
          return;
        }

        renderRivalHud(room);
      });
    }catch(err){
      console.warn('[GJ Battle Patch] attachRoomListener failed', err);
    }
  }

  function hookTimerChecks(){
    setInterval(() => {
      if (patchState.finalSummaryRendered || patchState.battleEnding) return;

      const s = readGlobalState();

      const timeLeft = Number(
        s.timeLeft ??
        s.remaining ??
        window.timeLeft ??
        999
      );

      const hp = Number(
        s.hp ??
        s.heart ??
        window.hp ??
        100
      );

      if (Number.isFinite(timeLeft) && timeLeft <= 0){
        finishBattleOnce('time-up');
        return;
      }

      if (Number.isFinite(hp) && hp <= 0){
        finishBattleOnce('hp-zero');
      }
    }, 500);
  }

  function install(){
    if (patchState.patched) return;
    patchState.patched = true;

    readGlobalState();
    patchLegacyFunctions();
    startPlayerSyncLoop();
    attachRoomListener();
    hookTimerChecks();

    window.addEventListener('beforeunload', () => {
      try{
        clearInterval(patchState.playerSyncTimer);
        writeBattleSelf({ lastSeenAt:now(), updatedAt:now() }, true);
      }catch(_){}
    });

    console.log('[GJ Battle Patch] installed', {
      version:window.HHA_GJ_BATTLE_FINAL_PATCH,
      room:patchState.room,
      pid:patchState.pid,
      name:patchState.name,
      matchId:patchState.matchId
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', install);
  }else{
    install();
  }
})();
