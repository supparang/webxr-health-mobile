'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-battle.js
 * GoodJunk Battle Controller
 * FULL PATCH v20260406-gjb-controller-r1
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  if (W.__GJ_BATTLE_CONTROLLER_LOADED__) return;
  W.__GJ_BATTLE_CONTROLLER_LOADED__ = true;

  const ROOT_PATH = 'hha-battle/goodjunk/rooms';
  const FIREBASE_SDKS = [
    'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js',
    '../firebase-config.js'
  ];

  const q = new URLSearchParams(location.search);

  const STATE = {
    pid: cleanPid(qs('pid') || 'anon'),
    uid: '',
    name: cleanText(qs('name') || qs('nick') || 'Player', 80),
    roomId: cleanRoom(qs('roomId') || qs('room') || ''),
    roomKind: cleanText(qs('roomKind') || 'battle', 24) || 'battle',
    diff: cleanText(qs('diff') || 'normal', 16) || 'normal',
    timeSec: clampInt(qs('time') || '120', 60, 300, 120),
    hub: qs('hub') || '../hub.html',
    run: cleanText(qs('run') || 'play', 24) || 'play',
    view: cleanText(qs('view') || 'mobile', 24) || 'mobile',
    seed: cleanText(qs('seed') || String(Date.now()), 120),

    db: null,
    auth: null,
    refs: { room:null, state:null, players:null, final:null, self:null },
    room: { meta:{}, state:{}, players:{}, final:null },

    lastDebugHash: '',
    lastEmittedFinalToken: '',
    localFinishSeen: false,
    localFinishDetail: null,
    bootDone: false
  };

  function qs(key, fb=''){
    try{
      const v = q.get(key);
      return v == null || v === '' ? fb : v;
    }catch{
      return fb;
    }
  }

  function now(){ return Date.now(); }

  function num(v, d=0){
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function clampInt(v, min, max, fb){
    const n = Number(v);
    if (!Number.isFinite(n)) return fb;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function cleanText(v, max=120){
    return String(v == null ? '' : v).trim().slice(0, max);
  }

  function cleanPid(v){
    return String(v == null ? '' : v).trim().replace(/[.#$[\]/]/g, '-').slice(0, 120);
  }

  function cleanRoom(v){
    return String(v || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  }

  function escapeJson(v){
    try{ return JSON.stringify(v); }
    catch{ return ''; }
  }

  function roomStatus(){
    return cleanText((STATE.room.state || {}).status || 'waiting', 32) || 'waiting';
  }

  function roomRoundToken(){
    return cleanText((STATE.room.state || {}).roundToken || '', 120);
  }

  function roomEndsAt(){
    return num((STATE.room.state || {}).endsAt, 0);
  }

  function roomCountdownEndsAt(){
    return num((STATE.room.state || {}).countdownEndsAt, 0);
  }

  function activePlayers(){
    const t = now();
    const map = (STATE.room.players && typeof STATE.room.players === 'object') ? STATE.room.players : {};
    return Object.entries(map)
      .map(([key, p]) => Object.assign({ key }, p || {}))
      .filter((p) => {
        if (p.connected === false) return false;
        const lastSeen = num(p.lastSeen || p.updatedAt || p.joinedAt, 0);
        if (!lastSeen) return true;
        return (t - lastSeen) <= 15000;
      })
      .sort((a, b) => num(a.joinedAt, 0) - num(b.joinedAt, 0));
  }

  function hostUid(){
    return cleanPid((STATE.room.meta || {}).hostUid || '');
  }

  function isHost(){
    return !!STATE.uid && STATE.uid === hostUid();
  }

  function playersForRanking(){
    const map = (STATE.room.players && typeof STATE.room.players === 'object') ? STATE.room.players : {};
    return Object.entries(map)
      .map(([key, p]) => Object.assign({ key }, p || {}))
      .filter((p) => {
        const pid = cleanPid(p.pid || p.uid || p.playerId || p.key || '');
        return !!pid;
      });
  }

  function debugDetail(extra){
    const players = activePlayers();
    const detail = {
      tag: 'goodjunk-battle-controller',
      roomKind: STATE.roomKind,
      stateStatus: roomStatus(),
      matchStatus: roomStatus(),
      participantIds: players.map(p => cleanPid(p.pid || p.uid || p.playerId || p.key || '')),
      resultCount: players.filter(p => !!p.resultSubmitted).length,
      finalCount: Array.isArray(STATE.room.final?.standings) ? STATE.room.final.standings.length : 0,
      runStarted: roomStatus() === 'playing',
      resultSubmitted: !!((STATE.room.players || {})[STATE.uid] || {}).resultSubmitted,
      finalSummarySent: !!STATE.room.final,
      isHost: isHost(),
      roomId: STATE.roomId,
      roundToken: roomRoundToken(),
      ...extra
    };
    return detail;
  }

  function emitDebug(extra){
    const detail = debugDetail(extra);
    const hash = escapeJson(detail);
    if (hash === STATE.lastDebugHash) return;
    STATE.lastDebugHash = hash;

    try{
      W.dispatchEvent(new CustomEvent('gj:battle-debug', { detail }));
    }catch{}
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const full = new URL(src, location.href).toString();
      const found = Array.from(document.scripts).find(s => s.src === full);
      if (found){
        if (found.dataset.loaded === '1') return resolve(full);
        found.addEventListener('load', () => resolve(full), { once:true });
        found.addEventListener('error', () => reject(new Error('load failed: ' + src)), { once:true });
        return;
      }

      const s = D.createElement('script');
      s.src = full;
      s.async = true;
      s.onload = () => {
        s.dataset.loaded = '1';
        resolve(full);
      };
      s.onerror = () => reject(new Error('load failed: ' + src));
      D.head.appendChild(s);
    });
  }

  async function ensureFirebase(){
    if (!(W.firebase && W.firebase.apps && W.firebase.database && W.firebase.auth)){
      for (const src of FIREBASE_SDKS){
        await loadScript(src);
      }
    }

    const firebase = W.firebase;
    const cfg = W.HHA_FIREBASE_CONFIG || W.__HHA_FIREBASE_CONFIG__ || W.firebaseConfig || null;

    if (firebase.apps && !firebase.apps.length){
      if (!cfg) throw new Error('Firebase config not found');
      firebase.initializeApp(cfg);
    }

    STATE.db = firebase.database();
    STATE.auth = firebase.auth();

    if (typeof W.HHA_ensureAnonymousAuth === 'function'){
      await W.HHA_ensureAnonymousAuth();
    } else if (!STATE.auth.currentUser){
      await STATE.auth.signInAnonymously();
    }

    const user = STATE.auth.currentUser;
    if (!user) throw new Error('Anonymous auth failed');

    STATE.uid = cleanPid(user.uid || '');
    if (!STATE.pid) STATE.pid = STATE.uid;
  }

  async function bindRoom(){
    if (!STATE.roomId) throw new Error('roomId missing');

    STATE.refs.room = STATE.db.ref(`${ROOT_PATH}/${STATE.roomId}`);
    STATE.refs.state = STATE.refs.room.child('state');
    STATE.refs.players = STATE.refs.room.child('players');
    STATE.refs.final = STATE.refs.room.child('finalSummary');
    STATE.refs.self = STATE.refs.players.child(STATE.uid);

    const snap = await STATE.refs.room.once('value');
    if (!snap.exists()) throw new Error('room not found');

    const room = snap.val() || {};
    STATE.room.meta = room.meta || {};
    STATE.room.state = room.state || {};
    STATE.room.players = room.players || {};
    STATE.room.final = room.finalSummary || null;

    STATE.refs.state.on('value', (s) => {
      STATE.room.state = s.val() || {};
      emitDebug();
      maybeDriveState();
      maybeEmitFinalSummary();
    });

    STATE.refs.players.on('value', (s) => {
      STATE.room.players = s.val() || {};
      emitDebug();
      maybeDriveState();
      maybeFinalizeRound();
      maybeEmitFinalSummary();
    });

    STATE.refs.final.on('value', (s) => {
      STATE.room.final = s.val() || null;
      emitDebug();
      maybeEmitFinalSummary();
    });
  }

  async function heartbeat(){
    if (!STATE.refs.self) return;

    const self = ((STATE.room.players || {})[STATE.uid]) || {};
    try{
      await STATE.refs.self.update({
        connected: true,
        pid: STATE.pid,
        uid: STATE.uid,
        playerId: STATE.uid,
        name: STATE.name,
        nick: STATE.name,
        status: self.status || roomStatus(),
        updatedAt: now(),
        lastSeen: now()
      });
    }catch{}
  }

  function createStandings(){
    const rows = playersForRanking().map((p) => {
      const uid = cleanPid(p.uid || p.playerId || p.key || '');
      const pid = cleanPid(p.pid || uid || '');
      const nick = cleanText(p.name || p.nick || pid || 'Player', 80);

      return {
        uid,
        pid,
        nick,
        score: num(p.score, 0),
        miss: num(p.miss, 0),
        bestStreak: num(p.bestStreak, 0),
        hp: num(p.hp, 100),
        maxHp: Math.max(1, num(p.maxHp, 100)),
        attacksUsed: num(p.attacksUsed, 0),
        damageDealt: num(p.damageDealt, 0),
        damageTaken: num(p.damageTaken, 0),
        guardsUsed: num(p.guardsUsed, 0),
        perfectGuardCount: num(p.perfectGuardCount, 0),
        blockedDamage: num(p.blockedDamage, 0),
        junkRainSent: num(p.junkRainSent, 0),
        junkRainReceived: num(p.junkRainReceived, 0),
        drainUsed: num(p.drainUsed, 0),
        chargeDrained: num(p.chargeDrained, 0),
        chargeLostToDrain: num(p.chargeLostToDrain, 0),
        counterTriggered: num(p.counterTriggered, 0),
        counterDamageDealt: num(p.counterDamageDealt, 0),
        counterDamageTaken: num(p.counterDamageTaken, 0),
        finisherUsed: num(p.finisherUsed, 0),
        finisherBonusDamage: num(p.finisherBonusDamage, 0),
        bestAttackCombo: num(p.bestAttackCombo, 0),
        rageTriggered: !!p.rageTriggered,
        rageAttackBonusDamage: num(p.rageAttackBonusDamage, 0),
        rageFinisherUsed: num(p.rageFinisherUsed, 0),
        rageFinisherBonusDamage: num(p.rageFinisherBonusDamage, 0),
        leadChanges: num(p.leadChanges, 0),
        comebackCount: num(p.comebackCount, 0),
        biggestLead: num(p.biggestLead, 0),
        biggestDeficit: num(p.biggestDeficit, 0),
        koByAttack: num(p.koByAttack, 0),
        koTaken: num(p.koTaken, 0),
        endedByKo: !!p.endedByKo,
        resultSubmitted: !!p.resultSubmitted,
        status: cleanText(p.status || '', 24),
        joinedAt: num(p.joinedAt, 0),
        updatedAt: num(p.updatedAt, 0)
      };
    });

    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      if (b.hp !== a.hp) return b.hp - a.hp;
      return a.joinedAt - b.joinedAt;
    });

    rows.forEach((r, idx) => { r.rank = idx + 1; });
    return rows;
  }

  function compareBlockFor(pid, standings){
    const me = standings.find(r => String(r.pid || '') === String(pid || '')) || standings[0] || null;
    const opponent = standings.find(r => String(r.pid || '') !== String((me && me.pid) || '')) || null;
    return { me, opponent };
  }

  function buildSummaryForPid(pid, standings, finalSummary){
    const compare = compareBlockFor(pid, standings);
    const me = compare.me || null;
    const opponent = compare.opponent || null;

    const result =
      !me ? 'finished' :
      me.rank === 1 ? 'win' :
      (standings.length >= 2 ? 'lose' : 'finished');

    return {
      controllerFinal: true,
      roomId: STATE.roomId,
      pid: me ? me.pid : pid,
      name: me ? me.nick : STATE.name,
      result,
      rank: me ? me.rank : '',
      score: me ? me.score : 0,
      players: standings.length,
      miss: me ? me.miss : 0,
      goodHit: me ? num(me.goodHit, 0) : 0,
      junkHit: me ? num(me.junkHit, 0) : 0,
      bestStreak: me ? me.bestStreak : 0,
      duration: STATE.timeSec,
      compare: { me, opponent },
      standings,
      generatedAt: finalSummary.generatedAt,
      roundToken: finalSummary.roundToken,
      finalToken: finalSummary.finalToken,
      raw: {
        finalSummary,
        me,
        opponent
      }
    };
  }

  async function maybeHostPromoteCountdown(){
    if (!isHost()) return;
    if (roomStatus() !== 'countdown') return;

    const ends = roomCountdownEndsAt();
    if (!ends) return;
    if (now() < ends) return;

    const t = now();
    const roundToken = roomRoundToken() || `round-${t}`;

    try{
      await STATE.refs.state.update({
        status: 'playing',
        startedAt: t,
        endsAt: t + (STATE.timeSec * 1000),
        countdownEndsAt: 0,
        roundToken,
        updatedAt: t
      });

      if (STATE.refs.final){
        await STATE.refs.final.remove().catch(() => {});
      }
    }catch(err){
      console.warn('[GJ-BATTLE-CTRL] promote countdown failed', err);
    }
  }

  async function maybeHostEndRound(){
    if (!isHost()) return;
    if (roomStatus() !== 'playing') return;

    const endsAt = roomEndsAt();
    const players = activePlayers();
    const alive = players.some((p) => num(p.hp, 100) > 0);

    if ((endsAt && now() >= endsAt) || !alive){
      try{
        await STATE.refs.state.update({
          status: 'ended',
          updatedAt: now()
        });
      }catch(err){
        console.warn('[GJ-BATTLE-CTRL] end round failed', err);
      }
    }
  }

  async function submitLocalFinish(detail){
    if (!STATE.refs.self) return;
    if (STATE.localFinishSeen) return;

    const src = detail && detail.summary ? detail.summary : (detail || {});
    STATE.localFinishSeen = true;
    STATE.localFinishDetail = src;

    try{
      await STATE.refs.self.update({
        resultSubmitted: true,
        resultSubmittedAt: now(),
        status: 'finished',
        finalRank: src.rank ?? '',
        finalResult: cleanText(src.result || '', 24),
        updatedAt: now(),
        lastSeen: now()
      });
    }catch(err){
      console.warn('[GJ-BATTLE-CTRL] submitLocalFinish failed', err);
    }

    emitDebug({ localFinishSeen:true });
  }

  function enoughResultsToFinalize(players){
    if (!players.length) return false;
    const submitted = players.filter(p => !!p.resultSubmitted).length;
    const finishedLike = players.filter((p) => {
      const st = cleanText(p.status || '', 24);
      return st === 'finished' || st === 'ko' || st === 'left';
    }).length;

    return submitted >= 2 || finishedLike >= players.length;
  }

  async function maybeFinalizeRound(){
    if (!isHost()) return;
    if (roomStatus() !== 'ended') return;
    if (STATE.room.final && STATE.room.final.roundToken === roomRoundToken()) return;

    const rows = createStandings();
    if (rows.length < 2) return;
    if (!enoughResultsToFinalize(rows)) return;

    const finalSummary = {
      controllerFinal: true,
      roomId: STATE.roomId,
      roomKind: STATE.roomKind,
      generatedAt: now(),
      roundToken: roomRoundToken() || `round-${now()}`,
      finalToken: `final-${STATE.roomId}-${now()}`,
      standings: rows
    };

    try{
      await STATE.refs.final.set(finalSummary);

      const updates = {};
      rows.forEach((r) => {
        const uid = r.uid;
        if (!uid) return;
        updates[`${uid}/finalRank`] = r.rank;
        updates[`${uid}/finalResult`] = r.rank === 1 ? 'win' : 'lose';
        updates[`${uid}/resultSubmitted`] = true;
        updates[`${uid}/status`] = 'finished';
        updates[`${uid}/updatedAt`] = now();
      });

      if (Object.keys(updates).length){
        await STATE.refs.players.update(updates);
      }

      emitDebug({ finalSummarySent:true, finalCount:rows.length });
    }catch(err){
      console.warn('[GJ-BATTLE-CTRL] finalize failed', err);
    }
  }

  function maybeEmitFinalSummary(){
    const finalSummary = STATE.room.final;
    if (!finalSummary || !finalSummary.controllerFinal) return;

    const finalToken = cleanText(finalSummary.finalToken || '', 120);
    const finalRoundToken = cleanText(finalSummary.roundToken || '', 120);
    const roomToken = roomRoundToken();

    if (!finalToken) return;
    if (roomToken && finalRoundToken && roomToken !== finalRoundToken) return;
    if (STATE.lastEmittedFinalToken === finalToken) return;

    const standings = Array.isArray(finalSummary.standings) ? finalSummary.standings : [];
    if (!standings.length) return;

    const summary = buildSummaryForPid(STATE.pid, standings, finalSummary);
    STATE.lastEmittedFinalToken = finalToken;

    try{
      W.dispatchEvent(new CustomEvent('gj:battle-summary', { detail:{ summary } }));
    }catch{}

    try{
      W.dispatchEvent(new CustomEvent('battle:finish', { detail:{ summary } }));
    }catch{}

    try{
      W.dispatchEvent(new CustomEvent('hha:battle:finish', { detail:{ summary } }));
    }catch{}

    emitDebug({ emittedFinalToken:finalToken });
  }

  function maybeDriveState(){
    maybeHostPromoteCountdown();
    maybeHostEndRound();
  }

  function wireFinishEvents(){
    const onFinish = (evt) => {
      const detail = evt && evt.detail ? evt.detail : {};
      submitLocalFinish(detail);
    };

    W.addEventListener('battle:finish', onFinish);
    W.addEventListener('hha:battle:finish', onFinish);
  }

  async function boot(){
    if (STATE.bootDone) return;
    STATE.bootDone = true;

    if (!STATE.roomId){
      emitDebug({ error:'roomId missing' });
      return;
    }

    await ensureFirebase();
    await bindRoom();
    wireFinishEvents();
    emitDebug({ boot:'ok' });

    setInterval(() => {
      heartbeat();
      maybeDriveState();
      emitDebug();
    }, 2500);

    maybeDriveState();
    maybeEmitFinalSummary();
  }

  boot().catch((err) => {
    console.error('[GJ-BATTLE-CTRL] boot failed', err);
    emitDebug({ error:String(err && err.message ? err.message : err) });
  });
})();