/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-battle-v2-core.js
 * GoodJunk Battle v2 Core
 * VERSION: v2.4.26-core-final
 *
 * ใช้ร่วมกันใน:
 * - goodjunk-battle-v2-run-mobile.html
 * - goodjunk-battle-v2-run-pc.html
 * - goodjunk-battle-v2-run-cardboard.html
 *
 * ต้องโหลดหลัง:
 * - goodjunk-battle-v2-firebase-bridge.js
 *
 * รวม:
 * - v2.4.22 Room Schema Compatibility Guard
 * - v2.4.20 Battle Core / Skill / Mobile Dock
 * - v2.4.25 Runtime Realtime Score Sync
 * - v2.4.26 Final Manifest + QA Checklist
 * ========================================================= */

(function GoodJunkBattleV2Core(){
  'use strict';

  const CORE_VERSION = 'v2.4.26-core-final';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const url = new URL(location.href);
  const params = url.searchParams;

  const VIEW = String(params.get('view') || params.get('device') || 'pc').toLowerCase();
  const IS_CARDBOARD = ['cardboard','cvr','vr'].includes(VIEW);
  const IS_MOBILE = !IS_CARDBOARD && (
    VIEW === 'mobile' ||
    (
      VIEW !== 'pc' &&
      window.matchMedia &&
      window.matchMedia('(max-width:760px)').matches
    )
  );

  const PLAYER_ID = String(
    window.GJ_PLAYER_ID ||
    window.MY_PLAYER_ID ||
    window.playerId ||
    params.get('pid') ||
    'anon'
  );

  const PLAYER_NAME = String(
    window.GJ_PLAYER_NAME ||
    window.MY_PLAYER_NAME ||
    window.playerName ||
    params.get('name') ||
    'Hero'
  );

  const ROOM_CODE = String(
    window.GJ_ROOM_CODE ||
    window.ROOM_CODE ||
    window.roomCode ||
    params.get('room') ||
    params.get('roomCode') ||
    params.get('code') ||
    params.get('lastRoom') ||
    ''
  ).trim().toUpperCase();

  const CFG = {
    maxPower: 5,
    maxHearts: 3,

    stormCost: 1,
    shieldCost: 1,
    freezeCost: 2,
    healCost: 2,

    stormCooldownMs: 9000,
    shieldCooldownMs: 14000,
    freezeCooldownMs: 16000,
    healCooldownMs: 18000,

    stormDurationMs: 6500,
    shieldDurationMs: 7000,
    freezeDurationMs: 5200,

    stormJunkCount: 5,

    globalSkillGapMs: 2200,
    maxSkillPer10Sec: 3,
    maxStormPer30Sec: 2,
    maxFreezePer30Sec: 1,
    maxHealPer45Sec: 2,
    maxShieldPer30Sec: 2,

    heartbeatMs: 3500,
    offlineAfterMs: 12000,
    staleEffectAfterMs: 30000,
    rematchReadyExpireMs: 45000,

    realtimeSyncThrottleMs: 450,
    realtimeForceSyncMs: 1800
  };

  const SKILLS = [
    {
      id: 'btnJunkStorm',
      key: 'junk-storm',
      icon: '⚡',
      label: 'Junk Storm',
      hint: 'โจมตีคู่แข่ง',
      cost: CFG.stormCost
    },
    {
      id: 'btnShield',
      key: 'shield',
      icon: '🛡️',
      label: 'Shield',
      hint: 'ป้องกัน',
      cost: CFG.shieldCost
    },
    {
      id: 'btnFreeze',
      key: 'freeze',
      icon: '❄️',
      label: 'Freeze',
      hint: 'ทำให้คู่แข่งช้าลง',
      cost: CFG.freezeCost
    },
    {
      id: 'btnHeal',
      key: 'heal',
      icon: '💚',
      label: 'Heal',
      hint: 'ฟื้นหัวใจ/ล้างสถานะ',
      cost: CFG.healCost
    }
  ];

  const junkIcons = ['🍩','🍟','🍔','🥤','🍰','🍭','🍬','🧁'];

  const state = {
    phase: 'play',
    matchId: String(params.get('matchId') || params.get('roundId') || ''),
    score: 0,
    good: 0,
    junk: 0,
    miss: 0,
    hearts: CFG.maxHearts,
    maxHearts: CFG.maxHearts,
    power: 0,
    maxPower: CFG.maxPower,

    shieldUntil: 0,
    freezeUntil: 0,
    stormUntil: 0,

    cooldowns: {
      'junk-storm': 0,
      shield: 0,
      freeze: 0,
      heal: 0
    },

    locks: {
      'junk-storm': 0,
      shield: 0,
      freeze: 0,
      heal: 0
    },

    skillLog: [],
    appliedEffects: Object.create(null),
    feed: [],
    heartbeatTimer: null,
    roomListenerAttached: false,
    opponentLeftHandled: false,
    qaOpen: false,

    lastEventGate: Object.create(null),

    realtime: {
      lastSyncAt: 0,
      lastForceSyncAt: 0,
      pendingSync: false,
      syncTimer: null,
      lastScoreHash: '',
      opponent: null,
      roomListenerAttached: false
    }
  };

  function now(){
    return Date.now();
  }

  function safeObj(v){
    return v && typeof v === 'object' ? v : {};
  }

  function firstDefined(){
    for (let i = 0; i < arguments.length; i++){
      const v = arguments[i];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return '';
  }

  function toNumber(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(n, a, b){
    n = Number(n);
    if (!Number.isFinite(n)) n = a;
    return Math.max(a, Math.min(b, n));
  }

  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function emit(name, detail){
    window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    document.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function eventGate(key, ms){
    ms = Number(ms || 140);
    const t = now();
    const last = state.lastEventGate[key] || 0;
    state.lastEventGate[key] = t;
    return t - last > ms;
  }

  /* =========================================================
   * v2.4.22 Schema Guard
   * ========================================================= */

  function schemaReadRoomCode(room, urlParams){
    room = safeObj(room);
    urlParams = urlParams || new URLSearchParams(location.search);

    return String(firstDefined(
      room.code,
      room.room,
      room.roomCode,
      room.room_id,
      room.roomId,
      urlParams.get('room'),
      urlParams.get('roomCode'),
      urlParams.get('code'),
      urlParams.get('lastRoom')
    ) || '').toUpperCase();
  }

  function schemaReadPhase(room){
    room = safeObj(room);

    return String(firstDefined(
      room.phase,
      room.status,
      room.state,
      room.gamePhase,
      room.matchPhase,
      'lobby'
    )).toLowerCase();
  }

  function schemaReadMatchId(room){
    room = safeObj(room);

    return String(firstDefined(
      room.matchId,
      room.roundId,
      room.runId,
      room.sessionId,
      room.currentMatchId,
      ''
    ));
  }

  function schemaReadPlayersMap(room){
    room = safeObj(room);

    return safeObj(firstDefined(
      room.players,
      room.members,
      room.participants,
      room.users,
      {}
    ));
  }

  function schemaReadEffectsMap(room){
    room = safeObj(room);

    return safeObj(firstDefined(
      room.effects,
      room.attacks,
      room.skills,
      room.eventsEffects,
      {}
    ));
  }

  function normalizePlayer(id, raw){
    raw = safeObj(raw);

    const name = String(firstDefined(
      raw.name,
      raw.playerName,
      raw.displayName,
      raw.nick,
      raw.nickname,
      id,
      'Hero'
    ));

    const view = String(firstDefined(
      raw.view,
      raw.device,
      raw.modeView,
      'pc'
    )).toLowerCase();

    const status = String(firstDefined(
      raw.status,
      raw.state,
      raw.presence,
      raw.onlineState,
      'online'
    )).toLowerCase();

    const lastSeen = toNumber(firstDefined(
      raw.lastSeen,
      raw.heartbeatAt,
      raw.updatedAt,
      raw.ts,
      raw.lastActiveAt,
      0
    ), 0);

    const score = toNumber(firstDefined(
      raw.score,
      raw.points,
      raw.totalScore,
      raw.myScore,
      0
    ), 0);

    const hearts = toNumber(firstDefined(
      raw.hearts,
      raw.hp,
      raw.life,
      raw.lives,
      3
    ), 3);

    const good = toNumber(firstDefined(
      raw.good,
      raw.goodCount,
      raw.goodHits,
      raw.correct,
      0
    ), 0);

    const junk = toNumber(firstDefined(
      raw.junk,
      raw.junkCount,
      raw.badHits,
      raw.wrong,
      0
    ), 0);

    const miss = toNumber(firstDefined(
      raw.miss,
      raw.misses,
      raw.missCount,
      raw.errors,
      0
    ), 0);

    const power = toNumber(firstDefined(
      raw.power,
      raw.attackPower,
      raw.energy,
      raw.skillPower,
      0
    ), 0);

    const rematchReady = !!(
      raw.rematchReady === true ||
      raw.readyRematch === true ||
      raw.nextReady === true ||
      raw.status === 'rematch-ready' ||
      raw.state === 'rematch-ready'
    );

    const left = !!(
      raw.left === true ||
      raw.quit === true ||
      raw.disconnected === true ||
      status === 'left' ||
      status === 'offline'
    );

    const finished = !!(
      raw.finished === true ||
      raw.done === true ||
      raw.completed === true ||
      status === 'finished'
    );

    return {
      id: String(id),
      raw,

      name,
      playerName: name,
      displayName: name,

      view,
      status,

      lastSeen,
      heartbeatAt: toNumber(raw.heartbeatAt, lastSeen),
      updatedAt: toNumber(raw.updatedAt, lastSeen || now()),

      score,
      points: score,

      hearts,
      hp: hearts,
      lives: hearts,

      good,
      goodCount: good,

      junk,
      junkCount: junk,

      miss,
      missCount: miss,

      power,
      attackPower: power,
      energy: power,

      rematchReady,
      readyRematch: rematchReady,
      nextReady: rematchReady,
      rematchReadyAt: toNumber(firstDefined(raw.rematchReadyAt, raw.readyAt, raw.updatedAt, 0), 0),

      left,
      quit: left,
      disconnected: left,

      finished,
      done: finished,

      host: !!raw.host,
      result: firstDefined(raw.result, raw.outcome, null)
    };
  }

  function normalizePlayers(room){
    const map = schemaReadPlayersMap(room);

    return Object.entries(map).map(function(pair){
      return normalizePlayer(pair[0], pair[1]);
    });
  }

  function normalizeEffect(key, raw){
    raw = safeObj(raw);

    const type = String(firstDefined(
      raw.type,
      raw.skill,
      raw.action,
      raw.effectType,
      ''
    ));

    const from = String(firstDefined(
      raw.from,
      raw.fromPlayer,
      raw.sender,
      raw.playerId,
      ''
    ));

    const id = String(firstDefined(
      raw.id,
      raw.effectId,
      key,
      from + '_' + type + '_' + firstDefined(raw.ts, now())
    ));

    return Object.assign({}, raw, {
      key,
      id,
      type,
      skill: type,
      from,
      fromPlayer: from,
      ts: toNumber(firstDefined(raw.ts, raw.createdAt, raw.updatedAt, now()), now()),
      durationMs: toNumber(firstDefined(raw.durationMs, raw.duration, 0), 0),
      count: toNumber(firstDefined(raw.count, raw.amount, raw.junkCount, 0), 0),
      consumed: !!raw.consumed,
      consumedBy: firstDefined(raw.consumedBy, raw.usedBy, '')
    });
  }

  function normalizeEffects(room){
    const map = schemaReadEffectsMap(room);
    const out = {};

    Object.entries(map).forEach(function(pair){
      out[pair[0]] = normalizeEffect(pair[0], pair[1]);
    });

    return out;
  }

  function normalizeRoom(room, urlParams){
    room = safeObj(room);

    const code = schemaReadRoomCode(room, urlParams);
    const phase = schemaReadPhase(room);
    const matchId = schemaReadMatchId(room);
    const players = normalizePlayers(room);
    const effects = normalizeEffects(room);

    return {
      raw: room,

      code,
      room: code,
      roomCode: code,

      phase,
      status: phase,
      state: phase,

      matchId,
      roundId: matchId,
      runId: matchId,

      players,
      playersMap: schemaReadPlayersMap(room),
      effects,
      effectsMap: schemaReadEffectsMap(room),

      createdAt: toNumber(room.createdAt, 0),
      updatedAt: toNumber(room.updatedAt, 0),
      startedAt: toNumber(room.startedAt, 0),
      endedAt: toNumber(room.endedAt, 0),

      winner: firstDefined(room.winner, room.winnerId, ''),
      reason: firstDefined(room.reason, room.endReason, '')
    };
  }

  function isOnlinePlayer(player, offlineAfterMs){
    offlineAfterMs = Number(offlineAfterMs || CFG.offlineAfterMs);

    if (!player) return false;
    if (player.left || player.quit || player.disconnected) return false;

    const status = String(player.status || '').toLowerCase();
    if (status === 'left' || status === 'offline') return false;

    const lastSeen = Number(player.lastSeen || player.heartbeatAt || player.updatedAt || 0);
    if (lastSeen && now() - lastSeen > offlineAfterMs) return false;

    return true;
  }

  function getMeAndOpponent(room, myId, offlineAfterMs){
    const nr = normalizeRoom(room);
    const id = String(myId || '');

    const me = nr.players.find(function(p){
      return String(p.id) === id;
    });

    const opponent = nr.players.find(function(p){
      return String(p.id) !== id && isOnlinePlayer(p, offlineAfterMs);
    });

    const opponentAny = nr.players.find(function(p){
      return String(p.id) !== id;
    });

    return {
      room: nr,
      players: nr.players,
      onlinePlayers: nr.players.filter(function(p){
        return isOnlinePlayer(p, offlineAfterMs);
      }),
      me,
      opponent,
      opponentAny
    };
  }

  function buildCanonicalPlayerPatch(playerPatch){
    playerPatch = safeObj(playerPatch);

    const name = firstDefined(
      playerPatch.name,
      playerPatch.playerName,
      playerPatch.displayName,
      playerPatch.nick,
      'Hero'
    );

    const score = toNumber(firstDefined(
      playerPatch.score,
      playerPatch.points,
      playerPatch.totalScore,
      0
    ), 0);

    const hearts = toNumber(firstDefined(
      playerPatch.hearts,
      playerPatch.hp,
      playerPatch.lives,
      3
    ), 3);

    const power = toNumber(firstDefined(
      playerPatch.power,
      playerPatch.attackPower,
      playerPatch.energy,
      0
    ), 0);

    const rematchReady = !!(
      playerPatch.rematchReady ||
      playerPatch.readyRematch ||
      playerPatch.nextReady
    );

    const left = !!(
      playerPatch.left ||
      playerPatch.quit ||
      playerPatch.disconnected ||
      playerPatch.status === 'left'
    );

    const status = firstDefined(
      playerPatch.status,
      left ? 'left' : rematchReady ? 'rematch-ready' : 'online'
    );

    const good = toNumber(firstDefined(playerPatch.good, playerPatch.goodCount, 0), 0);
    const junk = toNumber(firstDefined(playerPatch.junk, playerPatch.junkCount, 0), 0);
    const miss = toNumber(firstDefined(playerPatch.miss, playerPatch.missCount, 0), 0);

    return Object.assign({}, playerPatch, {
      name,
      playerName: name,
      displayName: name,

      score,
      points: score,
      myScore: score,

      hearts,
      hp: hearts,
      lives: hearts,

      good,
      goodCount: good,

      junk,
      junkCount: junk,

      miss,
      missCount: miss,

      power,
      attackPower: power,
      energy: power,

      rematchReady,
      readyRematch: rematchReady,
      nextReady: rematchReady,

      left,
      quit: left,
      disconnected: left,

      status,

      updatedAt: now(),
      lastSeen: now(),
      heartbeatAt: now()
    });
  }

  function buildCanonicalRoomPatch(roomPatch){
    roomPatch = safeObj(roomPatch);

    const phase = String(firstDefined(
      roomPatch.phase,
      roomPatch.status,
      roomPatch.state,
      'lobby'
    )).toLowerCase();

    const matchId = String(firstDefined(
      roomPatch.matchId,
      roomPatch.roundId,
      roomPatch.runId,
      ''
    ));

    const out = Object.assign({}, roomPatch, {
      phase,
      status: phase,
      state: phase,
      updatedAt: now()
    });

    if (matchId){
      out.matchId = matchId;
      out.roundId = matchId;
      out.runId = matchId;
    }

    return out;
  }

  function exposeSchema(){
    window.GJ_BATTLE_SCHEMA = {
      version: 'v2.4.26-schema-final',

      safeObj,
      firstDefined,
      toNumber,

      readRoomCode: schemaReadRoomCode,
      readPhase: schemaReadPhase,
      readMatchId: schemaReadMatchId,
      readPlayersMap: schemaReadPlayersMap,
      readEffectsMap: schemaReadEffectsMap,

      normalizePlayer,
      normalizePlayers,
      normalizeEffect,
      normalizeEffects,
      normalizeRoom,

      isOnlinePlayer,
      getMeAndOpponent,

      buildCanonicalPlayerPatch,
      buildCanonicalRoomPatch
    };

    emit('gj:battle-schema-ready', {
      version: window.GJ_BATTLE_SCHEMA.version
    });
  }

  /* =========================================================
   * Core helpers
   * ========================================================= */

  function toast(msg){
    if (typeof window.showToast === 'function'){
      window.showToast(msg);
      return;
    }

    let el = $('#gjBattleSkillToast');
    if (!el){
      el = document.createElement('div');
      el.id = 'gjBattleSkillToast';
      el.className = 'gj-battle-skill-toast';
      document.body.appendChild(el);
    }

    el.textContent = msg;
    el.classList.add('show');

    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 1500);
  }

  function getArena(){
    return (
      $('#arena') ||
      $('.arena') ||
      $('.battle-arena') ||
      $('.game-arena') ||
      $('#gameArea') ||
      $('.game-area')
    );
  }

  function getDb(){
    if (window.GJ_BATTLE_FIREBASE_BRIDGE && typeof window.GJ_BATTLE_FIREBASE_BRIDGE.getDb === 'function'){
      return window.GJ_BATTLE_FIREBASE_BRIDGE.getDb();
    }

    return (
      window.GJ_DB ||
      window.db ||
      window.firebaseDb ||
      window.database ||
      null
    );
  }

  function getRoomRef(){
    if (window.GJ_ROOM_REF) return window.GJ_ROOM_REF;
    if (window.roomRef) return window.roomRef;
    if (window.ROOM_REF) return window.ROOM_REF;

    if (window.GJ_BATTLE_FIREBASE_BRIDGE && typeof window.GJ_BATTLE_FIREBASE_BRIDGE.getRoomRef === 'function'){
      const ref = window.GJ_BATTLE_FIREBASE_BRIDGE.getRoomRef(ROOM_CODE);
      if (ref) return ref;
    }

    const db = getDb();

    if (db && ROOM_CODE && typeof db.ref === 'function'){
      return db.ref('goodjunk_battle_rooms/' + ROOM_CODE);
    }

    return null;
  }

  function updateGlobalState(){
    const t = now();

    window.GJ_BATTLE_STATE = Object.assign({}, window.GJ_BATTLE_STATE || {}, {
      score: state.score,
      myScore: state.score,
      good: state.good,
      junk: state.junk,
      miss: state.miss,

      hearts: state.hearts,
      hp: state.hearts,
      maxHearts: state.maxHearts,
      maxHp: state.maxHearts,

      power: state.power,
      attackPower: state.power,
      maxPower: state.maxPower,

      shieldActive: t < state.shieldUntil,
      freezeActive: t < state.freezeUntil,
      stormActive: t < state.stormUntil,

      stormCooldown: Math.ceil(Math.max(0, state.cooldowns['junk-storm'] - t) / 1000),
      shieldCooldown: Math.ceil(Math.max(0, state.cooldowns.shield - t) / 1000),
      freezeCooldown: Math.ceil(Math.max(0, state.cooldowns.freeze - t) / 1000),
      healCooldown: Math.ceil(Math.max(0, state.cooldowns.heal - t) / 1000)
    });

    emit('gj:battle-state-updated', window.GJ_BATTLE_STATE);
  }

  function isShieldActive(){
    return now() < state.shieldUntil;
  }

  function isFreezeActive(){
    return now() < state.freezeUntil;
  }

  function isStormActive(){
    return now() < state.stormUntil;
  }

  function addPower(amount){
    state.power = clamp(state.power + Number(amount || 1), 0, state.maxPower);
    syncHud();
    updateGlobalState();
    scheduleRealtimeSync('add-power');
  }

  function spendPower(amount){
    state.power = clamp(state.power - Number(amount || 1), 0, state.maxPower);
    syncHud();
    updateGlobalState();
    scheduleRealtimeSync('spend-power');
  }

  function damage(amount){
    if (isShieldActive()){
      toast('🛡️ Shield กันความเสียหาย!');
      addFeed('🛡️ Shield กันความเสียหายได้', 'shield');
      scheduleRealtimeSync('shield-block');
      return;
    }

    state.hearts = clamp(state.hearts - Number(amount || 1), 0, state.maxHearts);
    state.miss += 1;

    if (state.power > 0) state.power -= 1;

    syncHud();
    updateGlobalState();
    scheduleRealtimeSync('damage');

    if (state.hearts <= 0){
      endBattle('lose', 'heart-zero');
    }
  }

  function heal(){
    state.hearts = clamp(state.hearts + 1, 0, state.maxHearts);
    state.freezeUntil = 0;
    state.stormUntil = 0;
    syncHud();
    updateGlobalState();
    scheduleRealtimeSync('heal');
  }

  /* =========================================================
   * Skill UI
   * ========================================================= */

  function ensureActionsBar(){
    let bar =
      $('#battleActions') ||
      $('.battle-actions') ||
      $('.action-bar') ||
      $('.power-actions') ||
      $('.skill-bar');

    if (!bar){
      bar = document.createElement('div');
      bar.id = 'battleActions';
      bar.className = 'battle-actions action-bar gj-battle-actions-v4';

      const arena = getArena();
      if (arena && arena.parentNode){
        arena.parentNode.insertBefore(bar, arena.nextSibling);
      }else{
        document.body.appendChild(bar);
      }
    }

    bar.classList.add('gj-battle-actions-v4');
    return bar;
  }

  function skillHTML(skill){
    return `
      <span class="gj-skill-icon">${skill.icon}</span>
      <span class="gj-skill-main">${skill.label}</span>
      <span class="gj-skill-sub">${skill.hint}</span>
      <span class="gj-skill-cost">ใช้พลัง ${skill.cost}</span>
    `;
  }

  function ensureSkillButtons(){
    const bar = ensureActionsBar();

    SKILLS.forEach(skill => {
      let btn =
        $('#' + skill.id) ||
        $('[data-skill="' + skill.key + '"]') ||
        $('[data-action="' + skill.key + '"]');

      if (!btn){
        btn = document.createElement('button');
        btn.id = skill.id;
        btn.type = 'button';
        btn.className = 'gj-skill-btn gj-skill-' + skill.key;
        btn.dataset.skill = skill.key;
        btn.dataset.action = skill.key;
        btn.innerHTML = skillHTML(skill);
        bar.appendChild(btn);
      }

      btn.classList.add('gj-skill-btn', 'gj-skill-' + skill.key);
      btn.dataset.skill = skill.key;
      btn.dataset.action = skill.key;

      if (!btn.querySelector('.gj-skill-main')){
        btn.innerHTML = skillHTML(skill);
      }

      if (!btn.dataset.gjCoreBound){
        btn.dataset.gjCoreBound = '1';
        btn.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          useSkill(skill.key);
        });
      }
    });

    refreshSkillButtons();
  }

  function refreshSkillButtons(){
    const t = now();

    SKILLS.forEach(skill => {
      const btn =
        $('[data-skill="' + skill.key + '"]') ||
        $('[data-action="' + skill.key + '"]');

      if (!btn) return;

      let enabled = state.power >= skill.cost;
      let reason = 'ใช้พลัง ' + skill.cost;

      const cd = Math.max(0, state.cooldowns[skill.key] - t);
      const lock = Math.max(0, state.locks[skill.key] - t);
      const remain = Math.max(cd, lock);

      if (remain > 0){
        enabled = false;
        reason = 'รอ ' + Math.ceil(remain / 1000) + 's';
      }

      if (skill.key === 'shield' && isShieldActive()){
        enabled = false;
        reason = 'กำลังป้องกัน';
      }

      if (skill.key === 'heal' && state.hearts >= state.maxHearts && !isFreezeActive() && !isStormActive()){
        enabled = false;
        reason = 'หัวใจเต็ม';
      }

      btn.disabled = !enabled;
      btn.classList.toggle('is-ready', enabled);
      btn.classList.toggle('is-disabled', !enabled);

      const cost = btn.querySelector('.gj-skill-cost');
      if (cost) cost.textContent = reason;
    });

    syncMobileDock();
  }

  function recentSkills(ms, key){
    const cutoff = now() - ms;
    return state.skillLog.filter(x => {
      if (!x || x.ts < cutoff) return false;
      if (key && x.skill !== key) return false;
      return true;
    });
  }

  function canUseSkill(key){
    const skill = SKILLS.find(s => s.key === key);
    if (!skill) return false;

    if (state.power < skill.cost){
      toast('พลัง Battle ยังไม่พอ');
      return false;
    }

    if (now() < state.cooldowns[key] || now() < state.locks[key]){
      toast('⏳ รอก่อนใช้สกิลอีกครั้ง');
      return false;
    }

    if (recentSkills(10000).length >= CFG.maxSkillPer10Sec){
      toast('ใช้สกิลถี่เกินไป รออีกนิด');
      return false;
    }

    if (key === 'junk-storm' && recentSkills(30000, key).length >= CFG.maxStormPer30Sec){
      toast('Junk Storm ใช้ได้จำกัด');
      return false;
    }

    if (key === 'freeze' && recentSkills(30000, key).length >= CFG.maxFreezePer30Sec){
      toast('Freeze ใช้ได้จำกัดเพื่อความยุติธรรม');
      return false;
    }

    if (key === 'shield' && recentSkills(30000, key).length >= CFG.maxShieldPer30Sec){
      toast('Shield ใช้ถี่เกินไป');
      return false;
    }

    if (key === 'heal' && recentSkills(45000, key).length >= CFG.maxHealPer45Sec){
      toast('Heal ใช้ถี่เกินไป');
      return false;
    }

    return true;
  }

  function registerSkill(key){
    const t = now();

    state.skillLog.push({
      skill: key,
      ts: t
    });

    state.skillLog = state.skillLog.filter(x => t - x.ts < 60000);

    if (key === 'junk-storm'){
      state.cooldowns[key] = t + CFG.stormCooldownMs;
      state.locks[key] = t + CFG.stormDurationMs;
    }

    if (key === 'shield'){
      state.cooldowns[key] = t + CFG.shieldCooldownMs;
      state.locks[key] = t + 7000;
    }

    if (key === 'freeze'){
      state.cooldowns[key] = t + CFG.freezeCooldownMs;
      state.locks[key] = t + 7200;
    }

    if (key === 'heal'){
      state.cooldowns[key] = t + CFG.healCooldownMs;
      state.locks[key] = t + 9000;
    }

    emit('gj:battle-skill-balanced-used', {
      skill: key,
      ts: t
    });
  }

  async function useSkill(key){
    if (!canUseSkill(key)) return false;

    const skill = SKILLS.find(s => s.key === key);
    if (!skill) return false;

    spendPower(skill.cost);
    registerSkill(key);

    if (key === 'junk-storm'){
      await pushEffect('junk-storm', {
        count: CFG.stormJunkCount,
        durationMs: CFG.stormDurationMs
      });

      toast('⚡ ส่ง Junk Storm ไปแล้ว!');
      addFeed('⚡ ส่ง Junk Storm ไปแล้ว!', 'storm');

      emit('gj:battle-skill-local', { skill: key });
    }

    if (key === 'shield'){
      state.shieldUntil = now() + CFG.shieldDurationMs;

      toast('🛡️ เปิด Shield แล้ว!');
      addFeed('🛡️ เปิด Shield แล้ว!', 'shield');

      emit('gj:battle-skill-local', { skill: key });
    }

    if (key === 'freeze'){
      await pushEffect('freeze', {
        durationMs: CFG.freezeDurationMs
      });

      toast('❄️ ส่ง Freeze ไปแล้ว!');
      addFeed('❄️ ส่ง Freeze ไปแล้ว!', 'freeze');

      emit('gj:battle-skill-local', { skill: key });
    }

    if (key === 'heal'){
      heal();

      toast('💚 Heal/Cleanse สำเร็จ!');
      addFeed('💚 Heal/Cleanse สำเร็จ!', 'heal');

      emit('gj:battle-skill-local', { skill: key });
    }

    syncHud();
    refreshSkillButtons();
    updateGlobalState();
    scheduleRealtimeSync('use-skill-' + key);

    return true;
  }

  async function pushEffect(type, payload){
    const roomRef = getRoomRef();

    if (!roomRef){
      console.warn('[GoodJunk Battle Core] no roomRef; local only:', type);
      return false;
    }

    const effect = Object.assign({
      id: PLAYER_ID + '_' + type + '_' + now(),
      type,
      skill: type,
      from: PLAYER_ID,
      fromName: PLAYER_NAME,
      ts: now(),
      matchId: state.matchId || window.GJ_MATCH_ID || ''
    }, payload || {});

    try{
      await roomRef.child('effects').push(effect);
      return true;
    }catch(err){
      console.warn('[GoodJunk Battle Core] pushEffect failed', err);
      return false;
    }
  }

  function applyEffect(effect, key){
    if (!effect) return;

    const normalized = normalizeEffect(key, effect);
    const id = normalized.id || key;

    if (state.appliedEffects[id]) return;
    state.appliedEffects[id] = true;

    if (String(normalized.from || '') === PLAYER_ID) return;

    if (normalized.type === 'junk-storm'){
      if (isShieldActive()){
        toast('🛡️ Shield กัน Junk Storm ได้!');
        addFeed('🛡️ Shield กัน Junk Storm ได้!', 'shield');
        emit('gj:battle-skill-received', { skill: 'blocked-junk-storm', effect: normalized });
      }else{
        state.stormUntil = now() + Number(normalized.durationMs || CFG.stormDurationMs);
        startStorm(
          Number(normalized.count || CFG.stormJunkCount),
          Number(normalized.durationMs || CFG.stormDurationMs),
          normalized
        );

        toast('⚡ คู่แข่งส่ง Junk Storm มา!');
        addFeed('⚡ โดน Junk Storm!', 'storm');
        emit('gj:battle-skill-received', { skill: 'junk-storm', effect: normalized });
      }
    }

    if (normalized.type === 'freeze'){
      if (isShieldActive()){
        toast('🛡️ Shield กัน Freeze ได้!');
        addFeed('🛡️ Shield กัน Freeze ได้!', 'shield');
        emit('gj:battle-skill-received', { skill: 'blocked-freeze', effect: normalized });
      }else{
        state.freezeUntil = now() + Number(normalized.durationMs || CFG.freezeDurationMs);
        startFreeze(Number(normalized.durationMs || CFG.freezeDurationMs));

        toast('❄️ โดน Freeze!');
        addFeed('❄️ โดน Freeze!', 'freeze');
        emit('gj:battle-skill-received', { skill: 'freeze', effect: normalized });
      }
    }

    markEffectConsumed(key);
    syncHud();
    refreshSkillButtons();
    updateGlobalState();
    scheduleRealtimeSync('effect-received');
  }

  async function markEffectConsumed(key){
    const roomRef = getRoomRef();
    if (!roomRef || !key) return;

    try{
      await roomRef.child('effects').child(key).update({
        consumed: true,
        consumedBy: PLAYER_ID,
        consumedAt: now()
      });
    }catch(e){}
  }

  function startFreeze(durationMs){
    state.freezeUntil = now() + Number(durationMs || CFG.freezeDurationMs);
    document.documentElement.classList.add('gj-freeze-active');

    const apply = () => {
      getMovableTargets().forEach(el => {
        el.classList.add('gj-freeze-slow-target');
      });
    };

    apply();

    clearInterval(startFreeze._tick);
    startFreeze._tick = setInterval(() => {
      if (!isFreezeActive()){
        clearInterval(startFreeze._tick);
        document.documentElement.classList.remove('gj-freeze-active');
        $$('.gj-freeze-slow-target').forEach(el => el.classList.remove('gj-freeze-slow-target'));
        return;
      }

      apply();
    }, 250);

    emit('gj:freeze-player', { durationMs });
  }

  function getMovableTargets(){
    const selectors = [
      '.target',
      '.food',
      '.junk',
      '.good',
      '.falling',
      '.item',
      '.sprite',
      '.enemy',
      '.gj-target',
      '.gj-item',
      '[data-kind]',
      '[data-type]',
      '[data-target]'
    ];

    const set = new Set();

    selectors.forEach(sel => {
      $$(sel).forEach(el => {
        if (el.closest('#gjBattleMobileActionDock')) return;
        if (el.closest('.battle-actions')) return;
        if (el.closest('.hud')) return;
        set.add(el);
      });
    });

    return Array.from(set);
  }

  function startStorm(count, durationMs, effect){
    count = Number(count || CFG.stormJunkCount);
    durationMs = Number(durationMs || CFG.stormDurationMs);

    state.stormUntil = now() + durationMs;
    document.documentElement.classList.add('gj-storm-active');

    let spawned = 0;
    clearInterval(startStorm._timer);

    startStorm._timer = setInterval(() => {
      if (now() > state.stormUntil || spawned >= count){
        clearInterval(startStorm._timer);
        setTimeout(() => {
          document.documentElement.classList.remove('gj-storm-active');
        }, 500);
        return;
      }

      spawnStormJunk(effect);
      spawned += 1;
    }, 520);

    emit('gj:spawn-junk-storm', { count, durationMs, effect });
  }

  function spawnStormJunk(effect){
    const arena = getArena();
    if (!arena) return;

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'gj-storm-junk target junk bad';
    item.textContent = junkIcons[Math.floor(Math.random() * junkIcons.length)];
    item.dataset.kind = 'junk';
    item.dataset.type = 'junk';
    item.dataset.battleStorm = '1';

    const size = Math.round(46 + Math.random() * 18);
    item.style.left = (6 + Math.random() * 84) + '%';
    item.style.top = (12 + Math.random() * 70) + '%';
    item.style.width = size + 'px';
    item.style.height = size + 'px';

    item.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();

      item.textContent = '💥';
      item.classList.add('gj-storm-junk-hit');

      damage(1);

      emit('gj:junk-hit', {
        source: 'battle-storm',
        damage: 1,
        effect
      });

      emit('hha:miss', {
        type: 'junk',
        source: 'battle-storm',
        damage: 1
      });

      setTimeout(() => item.remove(), 180);
    });

    arena.appendChild(item);

    if (isFreezeActive()){
      item.classList.add('gj-freeze-slow-target');
    }

    setTimeout(() => {
      if (item.parentNode){
        item.classList.add('gj-storm-junk-timeout');
        setTimeout(() => item.remove(), 240);
      }
    }, 4200);
  }

  /* =========================================================
   * HUD / Mobile Dock
   * ========================================================= */

  function ensureHud(){
    if (!IS_MOBILE && !IS_CARDBOARD) return;

    let hud = $('#gjBattleCompactHud');

    if (!hud){
      hud = document.createElement('div');
      hud.id = 'gjBattleCompactHud';
      hud.className = 'gj-battle-compact-hud';
      hud.innerHTML = `
        <div class="gj-chud-item">
          <span class="gj-chud-label">คะแนน</span>
          <b id="gjChudScore">0</b>
        </div>
        <div class="gj-chud-item">
          <span class="gj-chud-label">หัวใจ</span>
          <b id="gjChudHearts">❤❤❤</b>
        </div>
        <div class="gj-chud-item">
          <span class="gj-chud-label">พลัง</span>
          <b id="gjChudPower">0/5</b>
        </div>
        <div class="gj-chud-item">
          <span class="gj-chud-label">เวลา</span>
          <b id="gjChudTime">--</b>
        </div>
      `;

      const arena = getArena();
      if (arena && arena.parentNode){
        arena.parentNode.insertBefore(hud, arena);
      }else{
        document.body.insertBefore(hud, document.body.firstChild);
      }
    }
  }

  function syncHud(){
    const scoreSource = readRuntimeScore();
    if (scoreSource.score || scoreSource.good || scoreSource.junk || scoreSource.miss){
      state.score = scoreSource.score;
      state.good = scoreSource.good;
      state.junk = scoreSource.junk;
      state.miss = scoreSource.miss;
      state.hearts = scoreSource.hearts;
    }

    const heartText = '❤'.repeat(state.hearts) + '♡'.repeat(Math.max(0, state.maxHearts - state.hearts));

    const scoreEl = $('#gjChudScore');
    const heartsEl = $('#gjChudHearts');
    const powerEl = $('#gjChudPower');
    const timeEl = $('#gjChudTime');

    if (scoreEl) scoreEl.textContent = String(state.score);
    if (heartsEl) heartsEl.textContent = heartText;
    if (powerEl) powerEl.textContent = state.power + '/' + state.maxPower;

    if (timeEl && scoreSource.timeLeft !== undefined){
      timeEl.textContent = String(scoreSource.timeLeft);
    }

    const oldScore = $('#score') || $('#myScore') || $('[data-score]');
    const oldHearts = $('#hearts') || $('#battleHearts') || $('[data-hearts]');
    const oldPower = $('#battlePower') || $('#skillPower') || $('[data-battle-power]');

    if (oldScore) oldScore.textContent = String(state.score);
    if (oldHearts) oldHearts.textContent = heartText;
    if (oldPower) oldPower.textContent = IS_CARDBOARD
      ? state.power + '/' + state.maxPower
      : 'พลัง ' + state.power + '/' + state.maxPower;

    let badge = $('#gjBattlePowerBadge');

    if (!badge && !IS_CARDBOARD){
      badge = document.createElement('div');
      badge.id = 'gjBattlePowerBadge';
      badge.className = 'gj-battle-power-badge';
      const bar = $('#battleActions') || $('.battle-actions');
      if (bar && bar.parentNode) bar.parentNode.insertBefore(badge, bar);
    }

    if (badge) badge.textContent = '⚔️ พลัง ' + state.power + '/' + state.maxPower;
  }

  function ensureMobileDock(){
    if (!IS_MOBILE || IS_CARDBOARD) return null;

    let dock = $('#gjBattleMobileActionDock');

    if (!dock){
      dock = document.createElement('div');
      dock.id = 'gjBattleMobileActionDock';
      dock.className = 'gj-mobile-action-dock';
      dock.innerHTML = `
        <button id="gjBattleDockToggle" class="gj-battle-dock-toggle" type="button">⌄ ย่อปุ่มโจมตี</button>
        <div class="gj-mobile-action-grid" id="gjBattleMobileActionGrid"></div>
      `;
      document.body.appendChild(dock);

      $('#gjBattleDockToggle', dock).addEventListener('click', () => {
        document.documentElement.classList.toggle('gj-battle-dock-collapsed');
        const collapsed = document.documentElement.classList.contains('gj-battle-dock-collapsed');
        $('#gjBattleDockToggle', dock).textContent = collapsed ? '⚔️ แสดงปุ่มโจมตี' : '⌄ ย่อปุ่มโจมตี';
      });
    }

    return dock;
  }

  function syncMobileDock(){
    if (!IS_MOBILE || IS_CARDBOARD) return;

    const dock = ensureMobileDock();
    const grid = $('#gjBattleMobileActionGrid', dock);
    if (!grid) return;

    SKILLS.forEach(skill => {
      const original =
        $('[data-skill="' + skill.key + '"]') ||
        $('[data-action="' + skill.key + '"]');

      if (!original) return;

      let clone = $('#dock_' + skill.key.replaceAll('-','_'), grid);

      if (!clone){
        clone = document.createElement('button');
        clone.id = 'dock_' + skill.key.replaceAll('-','_');
        clone.type = 'button';
        clone.className = 'gj-mobile-action-btn';
        clone.dataset.skill = skill.key;
        clone.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!original.disabled) original.click();
        });
        grid.appendChild(clone);
      }

      clone.innerHTML = original.innerHTML;
      clone.disabled = original.disabled;
      clone.classList.toggle('is-disabled', original.disabled);
      clone.classList.toggle('is-ready', !original.disabled);
    });

    const oldBar = $('#battleActions') || $('.battle-actions');
    if (oldBar) oldBar.classList.add('gj-original-actions-hidden-mobile');
  }

  function addFeed(text, cls){
    let feed = $('#gjBattleCombatFeed');

    if (!feed){
      feed = document.createElement('div');
      feed.id = 'gjBattleCombatFeed';
      feed.className = 'gj-battle-combat-feed';

      const arena = getArena();
      if (arena) arena.appendChild(feed);
      else document.body.appendChild(feed);
    }

    state.feed.unshift({
      text,
      cls: cls || 'battle',
      ts: now()
    });

    state.feed = state.feed.slice(0, 5);

    feed.innerHTML = state.feed.map(x => `
      <div class="gj-feed-item gj-feed-${escapeHtml(x.cls)}">
        <span class="gj-feed-text">${escapeHtml(x.text)}</span>
      </div>
    `).join('');

    clearTimeout(addFeed._t);
    addFeed._t = setTimeout(() => {
      state.feed = state.feed.filter(x => now() - x.ts < 6500);
      feed.innerHTML = state.feed.map(x => `
        <div class="gj-feed-item gj-feed-${escapeHtml(x.cls)}">
          <span class="gj-feed-text">${escapeHtml(x.text)}</span>
        </div>
      `).join('');
    }, 6800);
  }

  function bigFx(text, cls){
    let fx = $('#gjBattleBigCombatFx');

    if (!fx){
      fx = document.createElement('div');
      fx.id = 'gjBattleBigCombatFx';
      fx.className = 'gj-battle-big-combat-fx';
      document.body.appendChild(fx);
    }

    fx.className = 'gj-battle-big-combat-fx show ' + (cls || '');
    fx.innerHTML = `<div class="gj-bigfx-text">${escapeHtml(text)}</div>`;

    clearTimeout(bigFx._t);
    bigFx._t = setTimeout(() => {
      fx.className = 'gj-battle-big-combat-fx';
    }, 1100);
  }

  /* =========================================================
   * Firebase room/player sync
   * ========================================================= */

  async function updateMyPlayer(patch){
    const roomRef = getRoomRef();
    if (!roomRef) return false;

    const canonical = buildCanonicalPlayerPatch(Object.assign({
      name: PLAYER_NAME,
      playerName: PLAYER_NAME,
      displayName: PLAYER_NAME,
      pid: PLAYER_ID,
      view: VIEW,
      device: VIEW,
      matchId: state.matchId || window.GJ_MATCH_ID || '',
      roundId: state.matchId || window.GJ_MATCH_ID || '',
      clientPatch: CORE_VERSION
    }, patch || {}));

    try{
      await roomRef.child('players').child(PLAYER_ID).update(canonical);
      return true;
    }catch(err){
      console.warn('[GoodJunk Battle Core] updateMyPlayer failed', err);
      return false;
    }
  }

  async function updateRoom(patch){
    const roomRef = getRoomRef();
    if (!roomRef) return false;

    const canonical = buildCanonicalRoomPatch(patch || {});

    try{
      await roomRef.update(canonical);
      return true;
    }catch(err){
      console.warn('[GoodJunk Battle Core] updateRoom failed', err);
      return false;
    }
  }

  function startHeartbeat(){
    if (state.heartbeatTimer) return;

    updateMyPlayer({
      left: false,
      quit: false,
      disconnected: false,
      status: 'playing',
      currentUrl: location.href
    });

    state.heartbeatTimer = setInterval(() => {
      updateMyPlayer({
        left: false,
        quit: false,
        disconnected: false,
        status: 'playing',
        currentUrl: location.href
      });
    }, CFG.heartbeatMs);

    window.addEventListener('beforeunload', markLeftSync);
    window.addEventListener('pagehide', markLeftSync);
  }

  function markLeftSync(){
    try{
      const roomRef = getRoomRef();
      if (!roomRef) return;

      roomRef.child('players').child(PLAYER_ID).update(buildCanonicalPlayerPatch({
        name: PLAYER_NAME,
        left: true,
        quit: true,
        disconnected: true,
        status: 'left',
        rematchReady: false,
        readyRematch: false,
        nextReady: false,
        lastSeen: now(),
        heartbeatAt: now(),
        updatedAt: now()
      }));
    }catch(e){}
  }

  async function markLeftAndGo(urlToGo){
    await updateMyPlayer({
      left: true,
      quit: true,
      disconnected: true,
      status: 'left',
      rematchReady: false,
      readyRematch: false,
      nextReady: false
    });

    location.href = urlToGo;
  }

  async function handleOpponentLeft(room){
    const data = getMeAndOpponent(room, PLAYER_ID, CFG.offlineAfterMs);
    const me = data.me;
    const opponent = data.opponent;
    const opponentAny = data.opponentAny;

    if (!me || !opponentAny) return false;
    if (opponent) return false;

    const waitingRematch =
      me.rematchReady === true ||
      me.readyRematch === true ||
      me.nextReady === true ||
      me.status === 'rematch-ready';

    const phase = data.room.phase;

    if (waitingRematch || ['summary','result','ended','finished','gameover','rematch','opponent-left'].includes(phase)){
      if (!state.opponentLeftHandled){
        state.opponentLeftHandled = true;

        await updateMyPlayer({
          rematchReady: false,
          readyRematch: false,
          nextReady: false,
          status: 'online'
        });

        showOpponentLeftRematch();
      }

      return true;
    }

    if (['play','playing','running','battle','active'].includes(phase)){
      showOpponentLeftPlaying();

      await updateRoom({
        phase: 'opponent-left',
        status: 'opponent-left',
        endedAt: now(),
        winner: PLAYER_ID,
        reason: 'opponent-left'
      });

      return true;
    }

    return false;
  }

  function showOpponentLeftPlaying(){
    toast('คู่แข่งออกจาก Battle แล้ว');
    addFeed('คู่แข่งออกจาก Battle แล้ว', 'danger');
    bigFx('คู่แข่งออกจาก Battle แล้ว', 'danger');

    emit('gj:battle-opponent-left', {
      during: 'play',
      ts: now()
    });
  }

  function showOpponentLeftRematch(){
    toast('คู่แข่งออกแล้ว กรุณากลับ Lobby');
    addFeed('คู่แข่งออกแล้ว กรุณากลับ Lobby', 'danger');

    const title = $('#resultTitle') || $('[data-result-title]') || $('.result-title');
    if (title) title.textContent = 'คู่แข่งออกจาก Battle แล้ว';

    const note = $('#rematchStatus') || $('[data-rematch-status]') || $('.rematch-status') || $('.result-note');
    if (note){
      note.textContent = 'อีกฝ่ายออกจากห้องแล้ว • กลับ Lobby เพื่อเริ่ม Battle ใหม่';
      note.classList.add('opponent-left','danger');
    }

    const btn = $('#btnRematch') || $('[data-rematch-btn]') || $('.btn-rematch');

    if (btn){
      btn.disabled = false;
      btn.classList.remove('is-waiting');
      btn.classList.add('is-opponent-left');
      btn.textContent = '⚔️ กลับ Lobby เพื่อเริ่มใหม่';
      btn.onclick = ev => {
        ev.preventDefault();
        markLeftAndGo(buildLobbyUrl());
      };
    }

    emit('gj:battle-opponent-left', {
      during: 'rematch',
      ts: now()
    });
  }

  async function handleRematchReady(room){
    const roomRef = getRoomRef();
    if (!roomRef) return false;

    const nr = normalizeRoom(room);
    const phase = nr.phase;

    if (!['summary','result','ended','finished','gameover','rematch'].includes(phase)) return false;

    const players = nr.players.filter(p => isOnlinePlayer(p, CFG.offlineAfterMs));
    if (players.length < 2) return false;

    const ready = players.filter(p => {
      const r =
        p.rematchReady === true ||
        p.readyRematch === true ||
        p.nextReady === true ||
        p.status === 'rematch-ready';

      const readyAt = Number(p.rematchReadyAt || p.readyAt || p.updatedAt || 0);
      const fresh = !readyAt || now() - readyAt < CFG.rematchReadyExpireMs;

      return r && fresh;
    });

    if (ready.length < 2) return false;

    const newMatchId = 'm_' + now() + '_' + Math.random().toString(16).slice(2,8);

    const updates = buildCanonicalRoomPatch({
      phase: 'play',
      status: 'play',
      matchId: newMatchId,
      roundId: newMatchId,
      startedAt: now(),
      endedAt: null,
      winner: null,
      reason: null,
      effects: null
    });

    players.forEach(p => {
      const base = 'players/' + p.id + '/';
      const patch = buildCanonicalPlayerPatch({
        score: 0,
        good: 0,
        junk: 0,
        miss: 0,
        hearts: CFG.maxHearts,
        power: 0,
        result: null,
        finished: false,
        done: false,
        rematchReady: false,
        readyRematch: false,
        nextReady: false,
        rematchReadyAt: null,
        status: 'online',
        left: false,
        quit: false,
        disconnected: false
      });

      Object.entries(patch).forEach(([k,v]) => {
        updates[base + k] = v;
      });
    });

    try{
      await roomRef.update(updates);

      resetLocalRound(newMatchId);
      toast('เริ่ม Battle รอบใหม่!');
      emit('gj:battle-rematch-start', { matchId: newMatchId });

      return true;
    }catch(err){
      console.warn('[GoodJunk Battle Core] rematch failed', err);
      return false;
    }
  }

  function resetLocalRound(matchId){
    state.matchId = matchId || state.matchId || '';
    state.phase = 'play';
    state.score = 0;
    state.good = 0;
    state.junk = 0;
    state.miss = 0;
    state.hearts = CFG.maxHearts;
    state.power = 0;
    state.shieldUntil = 0;
    state.freezeUntil = 0;
    state.stormUntil = 0;
    state.cooldowns = {
      'junk-storm': 0,
      shield: 0,
      freeze: 0,
      heal: 0
    };
    state.locks = {
      'junk-storm': 0,
      shield: 0,
      freeze: 0,
      heal: 0
    };
    state.skillLog = [];
    state.appliedEffects = Object.create(null);
    state.opponentLeftHandled = false;

    syncHud();
    updateGlobalState();
    forceRealtimeSync('reset-local-round');
  }

  async function onRoomValue(room){
    if (!room) return;

    window.GJ_CURRENT_ROOM = room;
    window.currentRoom = room;

    const nr = normalizeRoom(room);

    state.phase = nr.phase || state.phase || 'play';
    state.matchId = nr.matchId || state.matchId || '';
    window.GJ_BATTLE_PHASE = state.phase;
    window.GJ_MATCH_ID = state.matchId;

    await handleOpponentLeft(room);
    await handleRematchReady(room);

    Object.entries(nr.effects || {}).forEach(([key, eff]) => {
      if (!eff) return;
      if (eff.consumed === true && eff.consumedBy === PLAYER_ID) return;
      applyEffect(eff, key);
    });

    const opponent =
      nr.players.find(p => String(p.id) !== PLAYER_ID && isOnlinePlayer(p, CFG.offlineAfterMs)) ||
      nr.players.find(p => String(p.id) !== PLAYER_ID);

    if (opponent){
      applyOpponentToUI(opponent);
    }

    cleanStaleEffects(room);
  }

  async function cleanStaleEffects(room){
    const roomRef = getRoomRef();
    if (!roomRef) return;

    const nr = normalizeRoom(room);
    const updates = {};
    const cutoff = now() - CFG.staleEffectAfterMs;

    Object.entries(nr.effects || {}).forEach(([key, eff]) => {
      const ts = Number(eff && eff.ts || 0);
      if (ts && ts < cutoff) updates['effects/' + key] = null;
      if (eff && eff.consumed === true) updates['effects/' + key] = null;
    });

    if (!Object.keys(updates).length) return;

    try{
      await roomRef.update(updates);
    }catch(e){}
  }

  function attachRoomListener(){
    const roomRef = getRoomRef();

    if (!roomRef || typeof roomRef.on !== 'function') return;
    if (state.roomListenerAttached) return;

    state.roomListenerAttached = true;

    roomRef.on('value', snapshot => {
      const room = snapshot && typeof snapshot.val === 'function' ? snapshot.val() || {} : {};
      onRoomValue(room);
    });
  }

  /* =========================================================
   * Realtime Score Sync v2.4.25
   * ========================================================= */

  function readRuntimeScore(){
    const rt = window.GJ_BATTLE_RUNTIME;
    const rs = rt && rt.state ? rt.state : {};
    const bs = window.GJ_BATTLE_STATE || {};

    const score = Number(
      rs.score ??
      bs.score ??
      bs.myScore ??
      state.score ??
      readNumber('#score', 0)
    );

    const good = Number(
      rs.good ??
      bs.good ??
      state.good ??
      readNumber('#goodCount', 0)
    );

    const junk = Number(
      rs.junk ??
      bs.junk ??
      state.junk ??
      readNumber('#junkCount', 0)
    );

    const miss = Number(
      rs.miss ??
      bs.miss ??
      state.miss ??
      readNumber('#missCount', 0)
    );

    const hearts = Number(
      rs.hearts ??
      bs.hearts ??
      bs.hp ??
      state.hearts ??
      readHeartCount()
    );

    const power = Number(
      bs.power ??
      bs.attackPower ??
      state.power ??
      readPowerCount()
    );

    const timeLeft = Number(
      rs.timeLeft ??
      bs.timeLeft ??
      bs.remaining ??
      readNumber('#timer', 0)
    );

    return {
      score: Number.isFinite(score) ? score : 0,
      good: Number.isFinite(good) ? good : 0,
      junk: Number.isFinite(junk) ? junk : 0,
      miss: Number.isFinite(miss) ? miss : 0,
      hearts: Number.isFinite(hearts) ? hearts : 3,
      power: Number.isFinite(power) ? power : 0,
      timeLeft: Number.isFinite(timeLeft) ? timeLeft : 0
    };
  }

  function readNumber(sel, fallback){
    const el = $(sel);
    if (!el) return fallback;

    const txt = String(el.textContent || el.value || '');
    const m = txt.match(/-?\d+/);

    if (!m) return fallback;

    const n = Number(m[0]);
    return Number.isFinite(n) ? n : fallback;
  }

  function readHeartCount(){
    const el =
      $('#hearts') ||
      $('#battleHearts') ||
      $('[data-hearts]');

    if (!el) return 3;

    const txt = String(el.textContent || '');

    const full = (txt.match(/❤/g) || []).length;
    if (full > 0) return full;

    const m = txt.match(/\d+/);
    if (m) return Number(m[0]);

    return 3;
  }

  function readPowerCount(){
    const el =
      $('#battlePower') ||
      $('#skillPower') ||
      $('[data-battle-power]') ||
      $('#gjBattlePowerBadge');

    if (!el) return 0;

    const txt = String(el.textContent || '');
    const m = txt.match(/\d+/);

    if (!m) return 0;

    return Number(m[0]) || 0;
  }

  function scoreHash(score){
    return [
      score.score,
      score.good,
      score.junk,
      score.miss,
      score.hearts,
      score.power,
      score.timeLeft,
      state.matchId || window.GJ_MATCH_ID || ''
    ].join('|');
  }

  function buildRealtimePlayerPatch(extra){
    const score = readRuntimeScore();

    state.score = score.score;
    state.good = score.good;
    state.junk = score.junk;
    state.miss = score.miss;
    state.hearts = score.hearts;
    state.power = score.power;

    return buildCanonicalPlayerPatch(Object.assign({
      name: PLAYER_NAME,
      playerName: PLAYER_NAME,
      displayName: PLAYER_NAME,

      pid: PLAYER_ID,
      view: VIEW,
      device: VIEW,

      score: score.score,
      points: score.score,
      myScore: score.score,

      good: score.good,
      goodCount: score.good,

      junk: score.junk,
      junkCount: score.junk,

      miss: score.miss,
      missCount: score.miss,

      hearts: score.hearts,
      hp: score.hearts,
      lives: score.hearts,

      power: score.power,
      attackPower: score.power,
      energy: score.power,

      timeLeft: score.timeLeft,
      remaining: score.timeLeft,

      matchId: state.matchId || window.GJ_MATCH_ID || '',
      roundId: state.matchId || window.GJ_MATCH_ID || '',

      status: 'playing',
      currentPage: 'run',
      phase: 'play',

      left: false,
      quit: false,
      disconnected: false,

      realtimeSyncVersion: 'v2.4.26-realtime-final'
    }, extra || {}));
  }

  async function syncRealtimeNow(reason, force){
    const roomRef = getRoomRef();

    if (!roomRef){
      return false;
    }

    const t = now();
    const score = readRuntimeScore();
    const hash = scoreHash(score);

    if (!force && hash === state.realtime.lastScoreHash && t - state.realtime.lastForceSyncAt < CFG.realtimeForceSyncMs){
      return false;
    }

    if (!force && t - state.realtime.lastSyncAt < CFG.realtimeSyncThrottleMs){
      scheduleRealtimeSync(reason || 'throttle');
      return false;
    }

    state.realtime.lastSyncAt = t;
    if (force) state.realtime.lastForceSyncAt = t;
    state.realtime.lastScoreHash = hash;
    state.realtime.pendingSync = false;

    const patch = buildRealtimePlayerPatch({
      lastSyncReason: reason || 'runtime',
      lastSyncAt: t
    });

    try{
      await roomRef.child('players').child(PLAYER_ID).update(patch);

      emit('gj:battle-score-synced', {
        reason: reason || 'runtime',
        patch,
        version: 'v2.4.26-realtime-final'
      });

      return true;
    }catch(err){
      console.warn('[GoodJunk Battle Realtime Sync] sync failed', err);

      emit('gj:battle-score-sync-failed', {
        reason: reason || 'runtime',
        error: String(err && err.message || err),
        version: 'v2.4.26-realtime-final'
      });

      return false;
    }
  }

  function scheduleRealtimeSync(reason){
    state.realtime.pendingSync = true;

    clearTimeout(state.realtime.syncTimer);

    state.realtime.syncTimer = setTimeout(function(){
      syncRealtimeNow(reason || 'scheduled', false);
    }, CFG.realtimeSyncThrottleMs);
  }

  function forceRealtimeSync(reason){
    return syncRealtimeNow(reason || 'force', true);
  }

  function applyOpponentToUI(opponent){
    if (!opponent) return;

    const p = normalizePlayer(opponent.id || opponent.pid || 'opponent', opponent);
    state.realtime.opponent = p;

    const name = p.name || 'Hero';

    const nameEl =
      $('#opponentName') ||
      $('[data-opponent-name]') ||
      $('.opponent-name');

    if (nameEl){
      if (nameEl.id === 'opponentName' && String(nameEl.textContent || '').includes('คู่แข่ง')){
        nameEl.textContent = 'คู่แข่ง: ' + name;
      }else{
        nameEl.textContent = name;
      }
    }

    const statusEl =
      $('#opponentStatus') ||
      $('[data-opponent-status]') ||
      $('.opponent-status');

    if (statusEl){
      if (isOnlinePlayer(p, CFG.offlineAfterMs)){
        statusEl.textContent = 'PLAY';
        statusEl.classList.remove('off');
      }else{
        statusEl.textContent = 'LEFT';
        statusEl.classList.add('off');
      }
    }

    const scoreEl = $('#opponentScore') || $('[data-opponent-score]');
    if (scoreEl) scoreEl.textContent = String(p.score);

    window.GJ_BATTLE_OPPONENT = {
      id: p.id,
      name: p.name,
      score: p.score,
      good: p.good,
      junk: p.junk,
      miss: p.miss,
      hearts: p.hearts,
      power: p.power,
      status: p.status,
      updatedAt: p.updatedAt || p.lastSeen || 0
    };

    emit('gj:battle-opponent-updated', window.GJ_BATTLE_OPPONENT);
  }

  function patchRuntimeOpponentSnapshot(){
    const rt = window.GJ_BATTLE_RUNTIME;
    if (!rt) return;

    if (rt.__gjRealtimeOpponentPatched) return;
    rt.__gjRealtimeOpponentPatched = true;

    rt.getRealtimeOpponent = function(){
      return window.GJ_BATTLE_OPPONENT || state.realtime.opponent || null;
    };

    const oldUpdate = rt.updateOpponentUI;

    if (typeof oldUpdate === 'function'){
      rt.updateOpponentUI = function(){
        oldUpdate.apply(this, arguments);
        if (window.GJ_BATTLE_OPPONENT){
          applyOpponentToUI(window.GJ_BATTLE_OPPONENT);
        }
      };
    }
  }

  function bindGameEvents(){
    window.addEventListener('gj:good-collected', ev => {
      const d = ev.detail || {};

      if (eventGate('good', 120)){
        state.good += 1;
        state.score += Number(d.score || 10);
        addPower(Number(d.power || 1));
      }

      scheduleRealtimeSync('gj:good-collected');
    });

    window.addEventListener('goodjunk:good', () => {
      if (eventGate('good', 120)){
        state.good += 1;
        state.score += 10;
        addPower(1);
      }

      scheduleRealtimeSync('goodjunk:good');
    });

    window.addEventListener('hha:score', ev => {
      const d = ev.detail || {};
      const type = String(d.type || d.kind || '').toLowerCase();

      if (eventGate('score', 120)){
        if (!type || type.includes('good') || type.includes('score')){
          if (!window.GJ_BATTLE_RUNTIME){
            state.score += Number(d.score || d.points || 10);
            state.good += type.includes('good') ? 1 : 0;
            addPower(1);
          }
        }
      }

      scheduleRealtimeSync('hha:score');
    });

    window.addEventListener('gj:junk-hit', () => {
      if (eventGate('junk', 120)){
        if (!window.GJ_BATTLE_RUNTIME){
          damage(1);
        }
      }

      scheduleRealtimeSync('gj:junk-hit');
    });

    window.addEventListener('goodjunk:junk', () => {
      if (eventGate('junk', 120)){
        if (!window.GJ_BATTLE_RUNTIME){
          damage(1);
        }
      }

      scheduleRealtimeSync('goodjunk:junk');
    });

    window.addEventListener('hha:miss', ev => {
      const d = ev.detail || {};
      const type = String(d.type || d.kind || '').toLowerCase();

      if (eventGate('miss', 120)){
        if (!type || type.includes('junk') || type.includes('miss')){
          if (!window.GJ_BATTLE_RUNTIME){
            damage(1);
          }
        }
      }

      scheduleRealtimeSync('hha:miss');
    });

    [
      'gj:battle-state-updated',
      'gj:battle-skill-local',
      'gj:battle-skill-received',
      'gj:battle-skill-balanced-used',
      'gj:battle-power-balanced-gain',
      'gj:heal-player',
      'gj:freeze-player',
      'gj:spawn-junk-storm'
    ].forEach(evName => {
      window.addEventListener(evName, () => scheduleRealtimeSync(evName));
    });

    window.addEventListener('gj:battle-ended', () => forceRealtimeSync('battle-ended'));
    window.addEventListener('pagehide', () => forceRealtimeSync('pagehide'));
    window.addEventListener('beforeunload', () => forceRealtimeSync('beforeunload'));
  }

  /* =========================================================
   * Navigation / Rematch / End
   * ========================================================= */

  function buildUrl(path){
    const out = new URL(path, location.href);

    [
      'pid','name','diff','time','view','zone','cat','game','gameId',
      'variant','mode','entry','theme','seed','api','log','studyId',
      'conditionGroup','hub'
    ].forEach(k => {
      const v = params.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    if (ROOM_CODE) out.searchParams.set('lastRoom', ROOM_CODE);

    return out.toString();
  }

  function buildLobbyUrl(){
    return buildUrl('./goodjunk-battle-v2-lobby.html');
  }

  function buildModesUrl(){
    return buildUrl('../goodjunk-launcher.html');
  }

  function buildHubUrl(){
    const hub = params.get('hub');
    if (hub){
      try{ return new URL(hub, location.href).toString(); }catch(e){}
    }
    return buildUrl('../nutrition-zone.html');
  }

  function patchNavigation(){
    const lobbySelectors = [
      '#btnBackLobby',
      '[data-back-lobby]',
      '.btn-back-lobby',
      '.back-lobby',
      '#backLobby'
    ];

    lobbySelectors.forEach(sel => {
      $$(sel).forEach(btn => {
        if (btn.dataset.gjCoreLobbyBound) return;
        btn.dataset.gjCoreLobbyBound = '1';
        btn.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          markLeftAndGo(buildLobbyUrl());
        }, true);
      });
    });

    const modeSelectors = [
      '#btnAllModes',
      '#btnModes',
      '[data-all-modes]',
      '[data-back-modes]',
      '.btn-all-modes',
      '.btn-modes',
      '.back-modes'
    ];

    modeSelectors.forEach(sel => {
      $$(sel).forEach(btn => {
        if (btn.dataset.gjCoreModesBound) return;
        btn.dataset.gjCoreModesBound = '1';
        btn.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          markLeftAndGo(buildModesUrl());
        }, true);
      });
    });

    const hubSelectors = [
      '#btnHub',
      '#backHub',
      '[data-back-hub]',
      '[data-hub]',
      '.btn-hub',
      '.back-hub'
    ];

    hubSelectors.forEach(sel => {
      $$(sel).forEach(btn => {
        if (btn.dataset.gjCoreHubBound) return;
        btn.dataset.gjCoreHubBound = '1';
        btn.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          markLeftAndGo(buildHubUrl());
        }, true);
      });
    });
  }

  function patchRematch(){
    const buttons = [
      $('#btnRematch'),
      $('[data-rematch-btn]'),
      $('.btn-rematch')
    ].filter(Boolean);

    buttons.forEach(btn => {
      if (btn.dataset.gjCoreRematchBound) return;
      btn.dataset.gjCoreRematchBound = '1';

      btn.addEventListener('click', () => {
        updateMyPlayer({
          rematchReady: true,
          readyRematch: true,
          nextReady: true,
          rematchReadyAt: now(),
          status: 'rematch-ready'
        });

        const note = $('#rematchStatus') || $('[data-rematch-status]') || $('.rematch-status') || $('.result-note');
        if (note) note.textContent = 'คุณพร้อมแล้ว • รออีกฝ่ายกด Battle อีกครั้ง';

        btn.disabled = true;
        btn.classList.add('is-waiting');
        btn.textContent = '✅ รออีกฝ่าย';
      }, true);
    });
  }

  function endBattle(result, reason){
    state.phase = 'summary';
    updateGlobalState();

    updateMyPlayer({
      score: state.score,
      hearts: state.hearts,
      good: state.good,
      junk: state.junk,
      miss: state.miss,
      power: state.power,
      result,
      finished: true,
      done: true,
      status: 'finished'
    });

    updateRoom({
      phase: 'summary',
      status: 'summary',
      endedAt: now(),
      reason: reason || result
    });

    forceRealtimeSync('end-battle');

    emit('gj:battle-ended', { result, reason });
  }

  function shouldHideDock(){
    const phase = String(state.phase || '').toLowerCase();

    if (['summary','result','ended','finished','gameover','rematch','opponent-left'].includes(phase)) return true;

    return [
      '.result-card',
      '.summary-card',
      '.battle-result',
      '.modal-card',
      '#resultPanel',
      '#summaryPanel',
      '#gameSummary',
      '.rematch-panel'
    ].some(sel => {
      const el = $(sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 40 && r.height > 40;
    });
  }

  function layoutTick(){
    document.documentElement.classList.toggle('gj-battle-mobile', IS_MOBILE);
    document.documentElement.classList.toggle('gj-battle-cardboard', IS_CARDBOARD);

    const arena = getArena();
    if (arena){
      arena.classList.add('gj-battle-arena-core');
    }

    const dock = $('#gjBattleMobileActionDock');
    if (dock){
      dock.classList.toggle('gj-final-hide-dock', shouldHideDock());
    }

    patchNavigation();
    patchRematch();
    refreshSkillButtons();
  }

  /* =========================================================
   * QA + Final Manifest
   * ========================================================= */

  const MANIFEST = {
    version: 'v2.4.26-final-manifest-qa-checklist',
    files: {
      launcher: '/herohealth/goodjunk-launcher.html',
      lobby: '/herohealth/vr-goodjunk/goodjunk-battle-v2-lobby.html',
      router: '/herohealth/vr-goodjunk/goodjunk-battle-v2-run.html',
      core: '/herohealth/vr-goodjunk/goodjunk-battle-v2-core.js',
      bridge: '/herohealth/vr-goodjunk/goodjunk-battle-v2-firebase-bridge.js',
      mobile: '/herohealth/vr-goodjunk/goodjunk-battle-v2-run-mobile.html',
      pc: '/herohealth/vr-goodjunk/goodjunk-battle-v2-run-pc.html',
      cardboard: '/herohealth/vr-goodjunk/goodjunk-battle-v2-run-cardboard.html'
    },
    skills: ['junk-storm','shield','freeze','heal']
  };

  function detectPageRole(){
    const p = location.pathname;

    if (p.includes('goodjunk-launcher.html')) return 'launcher';
    if (p.includes('goodjunk-battle-v2-lobby.html')) return 'lobby';
    if (p.includes('goodjunk-battle-v2-run.html')) return 'router';
    if (p.includes('goodjunk-battle-v2-run-mobile.html')) return 'mobile-runtime';
    if (p.includes('goodjunk-battle-v2-run-pc.html')) return 'pc-runtime';
    if (p.includes('goodjunk-battle-v2-run-cardboard.html')) return 'cardboard-runtime';

    return 'unknown';
  }

  function checkFirebase(){
    const ready = !!window.GJ_BATTLE_DB_READY;
    const db = window.GJ_DB || window.db || window.database || window.firebaseDb || null;

    return {
      ok: ready && !!(db && typeof db.ref === 'function'),
      ready,
      source: window.GJ_BATTLE_DB_SOURCE || 'none',
      hasDbRef: !!(db && typeof db.ref === 'function')
    };
  }

  function checkSkills(){
    const missing = [];
    const present = [];

    MANIFEST.skills.forEach(function(skill){
      const el =
        $('[data-skill="' + skill + '"]') ||
        $('[data-action="' + skill + '"]');

      if (el) present.push(skill);
      else missing.push(skill);
    });

    return {
      ok: missing.length === 0,
      present,
      missing
    };
  }

  function qaSnapshot(){
    const role = detectPageRole();

    const checks = {
      role,
      firebase: checkFirebase(),
      bridge: {
        ok: !!window.GJ_BATTLE_FIREBASE_BRIDGE,
        version: window.GJ_BATTLE_FIREBASE_BRIDGE && window.GJ_BATTLE_FIREBASE_BRIDGE.version
      },
      schema: {
        ok: !!window.GJ_BATTLE_SCHEMA,
        version: window.GJ_BATTLE_SCHEMA && window.GJ_BATTLE_SCHEMA.version
      },
      core: {
        ok: !!window.GJ_BATTLE_CORE,
        version: window.GJ_BATTLE_CORE && window.GJ_BATTLE_CORE.version
      },
      runtime: {
        ok: !!window.GJ_BATTLE_RUNTIME,
        version: window.GJ_BATTLE_RUNTIME && window.GJ_BATTLE_RUNTIME.version
      },
      realtimeSync: {
        ok: !!window.GJ_BATTLE_REALTIME_SYNC,
        version: window.GJ_BATTLE_REALTIME_SYNC && window.GJ_BATTLE_REALTIME_SYNC.version
      },
      room: {
        ok: !!ROOM_CODE,
        room: ROOM_CODE,
        matchId: state.matchId || window.GJ_MATCH_ID || ''
      },
      player: {
        ok: !!PLAYER_ID && !!PLAYER_NAME,
        pid: PLAYER_ID,
        name: PLAYER_NAME
      },
      view: {
        ok: ['mobile','pc','cardboard','cvr','vr'].includes(VIEW),
        view: VIEW
      },
      skills: checkSkills()
    };

    const critical = [];

    if (['mobile-runtime','pc-runtime','cardboard-runtime'].includes(role)){
      ['bridge','schema','core','runtime','room','player','view','skills'].forEach(function(k){
        if (!checks[k] || checks[k].ok === false) critical.push(k);
      });
    }

    return {
      version: 'v2.4.26-final-manifest-qa-checklist',
      manifest: MANIFEST,
      url: location.href,
      path: location.pathname,
      timestamp: now(),
      checks,
      ok: critical.length === 0,
      critical
    };
  }

  function renderFinalBadge(){
    let badge = $('#gjBattleFinalManifestBadge');

    if (!badge){
      badge = document.createElement('div');
      badge.id = 'gjBattleFinalManifestBadge';
      badge.className = 'gj-final-manifest-badge';
      document.body.appendChild(badge);
    }

    const snap = qaSnapshot();

    badge.textContent = snap.ok
      ? 'Battle QA OK'
      : 'Battle QA: ' + snap.critical.join(', ');

    badge.classList.toggle('ok', snap.ok);
    badge.classList.toggle('bad', !snap.ok);
    badge.title = snap.version;
  }

  function ensureQA(){
    const qa = String(params.get('qa') || params.get('debug') || '').toLowerCase();
    const show = qa === '1' || qa === 'true' || window.GJ_BATTLE_QA_FORCE === true;

    let btn = $('#gjBattleQAButton');
    let panel = $('#gjBattleQAPanel');

    if (!show){
      if (btn) btn.remove();
      if (panel) panel.remove();
      return;
    }

    if (!btn){
      btn = document.createElement('button');
      btn.id = 'gjBattleQAButton';
      btn.type = 'button';
      btn.className = 'gj-battle-qa-btn';
      btn.textContent = 'QA';
      document.body.appendChild(btn);

      btn.addEventListener('click', () => {
        state.qaOpen = !state.qaOpen;
        document.documentElement.classList.toggle('gj-qa-open', state.qaOpen);
        syncQA();
      });
    }

    if (!panel){
      panel = document.createElement('div');
      panel.id = 'gjBattleQAPanel';
      panel.className = 'gj-battle-qa-panel';
      panel.innerHTML = `
        <div class="gj-qa-head">
          <b>GoodJunk Battle QA</b>
          <button id="gjBattleQAClose" type="button">×</button>
        </div>
        <div class="gj-qa-body" id="gjBattleQABody"></div>
      `;
      document.body.appendChild(panel);

      $('#gjBattleQAClose', panel).addEventListener('click', () => {
        state.qaOpen = false;
        document.documentElement.classList.remove('gj-qa-open');
      });
    }

    syncQA();
  }

  function syncQA(){
    const body = $('#gjBattleQABody');
    if (!body) return;

    const snap = qaSnapshot();

    body.innerHTML = `
      <div class="gj-qa-grid">
        <span>core</span><b>${CORE_VERSION}</b>
        <span>pid</span><b>${escapeHtml(PLAYER_ID)}</b>
        <span>name</span><b>${escapeHtml(PLAYER_NAME)}</b>
        <span>room</span><b>${escapeHtml(ROOM_CODE || '-')}</b>
        <span>view</span><b>${escapeHtml(VIEW)}</b>
        <span>phase</span><b>${escapeHtml(state.phase)}</b>
        <span>match</span><b>${escapeHtml(state.matchId || '-')}</b>
        <span>score</span><b>${state.score}</b>
        <span>heart</span><b>${state.hearts}</b>
        <span>power</span><b>${state.power}/${state.maxPower}</b>
        <span>skills</span><b>${snap.checks.skills.ok ? 'OK' : 'MISSING: ' + snap.checks.skills.missing.join(', ')}</b>
        <span>db</span><b>${snap.checks.firebase.ok ? 'READY' : 'OFFLINE'}</b>
      </div>
    `;
  }

  /* =========================================================
   * CSS
   * ========================================================= */

  function injectCSS(){
    if ($('#gjBattleCoreCSS')) return;

    const css = document.createElement('style');
    css.id = 'gjBattleCoreCSS';
    css.textContent = `
      .gj-battle-actions-v4{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:10px!important;
        width:100%!important;
        margin:10px 0!important;
        padding:10px!important;
        border-radius:24px!important;
        border:3px solid rgba(255,190,105,.75)!important;
        background:rgba(255,252,238,.96)!important;
        box-shadow:0 10px 24px rgba(96,50,20,.12)!important;
      }

      .gj-skill-btn{
        position:relative!important;
        min-width:0!important;
        min-height:84px!important;
        padding:10px 8px!important;
        border-radius:20px!important;
        border:3px solid rgba(255,205,120,.95)!important;
        background:linear-gradient(180deg,#fff8da,#ffe073)!important;
        color:#87331f!important;
        font-weight:1000!important;
        line-height:1.1!important;
        box-shadow:0 7px 0 rgba(177,105,22,.22)!important;
        touch-action:manipulation!important;
      }

      .gj-skill-btn .gj-skill-icon{display:block!important;font-size:24px!important;}
      .gj-skill-btn .gj-skill-main{display:block!important;font-size:15px!important;font-weight:1000!important;}
      .gj-skill-btn .gj-skill-sub{display:block!important;font-size:11px!important;opacity:.78!important;}
      .gj-skill-btn .gj-skill-cost{
        display:inline-block!important;
        margin-top:5px!important;
        padding:3px 7px!important;
        border-radius:999px!important;
        background:rgba(255,255,255,.62)!important;
        font-size:10px!important;
        font-weight:900!important;
      }

      .gj-skill-shield{background:linear-gradient(180deg,#ecf8ff,#aee0ff)!important;border-color:rgba(120,198,255,.96)!important;color:#13527a!important;}
      .gj-skill-freeze{background:linear-gradient(180deg,#f0fbff,#bdf1ff)!important;border-color:rgba(107,220,255,.96)!important;color:#146075!important;}
      .gj-skill-heal{background:linear-gradient(180deg,#edfff3,#aaf0bf)!important;border-color:rgba(95,220,135,.96)!important;color:#236b35!important;}

      .gj-skill-btn[disabled],
      .gj-skill-btn.is-disabled{
        opacity:.48!important;
        filter:grayscale(.25)!important;
        box-shadow:none!important;
      }

      .gj-battle-power-badge{
        width:fit-content!important;
        margin:8px auto 4px!important;
        padding:7px 12px!important;
        border-radius:999px!important;
        background:rgba(255,246,214,.96)!important;
        border:2px solid rgba(255,188,88,.9)!important;
        color:#8b3b19!important;
        font-weight:1000!important;
        font-size:13px!important;
      }

      .gj-battle-skill-toast{
        position:fixed!important;
        left:50%!important;
        bottom:calc(150px + env(safe-area-inset-bottom))!important;
        transform:translateX(-50%) translateY(12px)!important;
        z-index:100000!important;
        max-width:min(92vw,420px)!important;
        padding:12px 16px!important;
        border-radius:999px!important;
        background:rgba(60,34,16,.92)!important;
        color:#fff!important;
        font-weight:900!important;
        text-align:center!important;
        opacity:0!important;
        pointer-events:none!important;
        transition:opacity .18s ease,transform .18s ease!important;
      }

      .gj-battle-skill-toast.show{
        opacity:1!important;
        transform:translateX(-50%) translateY(0)!important;
      }

      .gj-storm-junk{
        position:absolute!important;
        display:grid!important;
        place-items:center!important;
        border-radius:999px!important;
        border:3px solid rgba(255,120,72,.9)!important;
        background:linear-gradient(180deg,#fff2d9,#ffb36a)!important;
        font-size:26px!important;
        font-weight:1000!important;
        cursor:pointer!important;
        z-index:15!important;
        box-shadow:0 8px 18px rgba(130,50,12,.18)!important;
        animation:gjStormJunkPop .32s ease both, gjStormJunkWiggle .75s ease-in-out infinite alternate!important;
      }

      .gj-storm-junk-hit{animation:gjStormJunkHit .22s ease both!important;}
      .gj-storm-junk-timeout{opacity:0!important;transform:scale(.72)!important;transition:opacity .22s ease,transform .22s ease!important;}

      @keyframes gjStormJunkPop{
        from{opacity:0;transform:scale(.45) rotate(-10deg);}
        to{opacity:1;transform:scale(1) rotate(0deg);}
      }

      @keyframes gjStormJunkWiggle{
        from{transform:translateY(0) rotate(-4deg);}
        to{transform:translateY(-5px) rotate(5deg);}
      }

      @keyframes gjStormJunkHit{
        from{opacity:1;transform:scale(1);}
        to{opacity:0;transform:scale(1.35) rotate(18deg);}
      }

      html.gj-freeze-active .gj-freeze-slow-target{
        filter:saturate(.75) brightness(.96) drop-shadow(0 0 8px rgba(125,221,255,.65))!important;
        animation-duration:2.4s!important;
        transition-duration:2.4s!important;
      }

      html.gj-storm-active .arena,
      html.gj-storm-active .battle-arena,
      html.gj-storm-active #arena{
        box-shadow:inset 0 0 0 5px rgba(255,176,74,.48),0 0 30px rgba(255,144,42,.38)!important;
      }

      .gj-battle-combat-feed{
        position:absolute!important;
        left:10px!important;
        top:10px!important;
        z-index:35!important;
        display:flex!important;
        flex-direction:column!important;
        gap:5px!important;
        width:min(300px,72%)!important;
        pointer-events:none!important;
      }

      .gj-feed-item{
        width:fit-content!important;
        max-width:100%!important;
        padding:6px 9px!important;
        border-radius:999px!important;
        background:rgba(255,255,255,.88)!important;
        border:2px solid rgba(255,205,120,.82)!important;
        color:#633015!important;
        font-size:12px!important;
        font-weight:1000!important;
        box-shadow:0 8px 18px rgba(70,30,8,.13)!important;
      }

      .gj-feed-storm{background:rgba(255,244,204,.94)!important;color:#884010!important;}
      .gj-feed-freeze{background:rgba(232,250,255,.94)!important;color:#145970!important;}
      .gj-feed-shield{background:rgba(230,246,255,.94)!important;color:#10517c!important;}
      .gj-feed-heal{background:rgba(235,255,239,.94)!important;color:#246836!important;}
      .gj-feed-danger{background:rgba(255,236,230,.95)!important;color:#8d2816!important;}

      .gj-battle-big-combat-fx{
        position:fixed!important;
        left:50%!important;
        top:38%!important;
        transform:translate(-50%,-50%) scale(.85)!important;
        z-index:100001!important;
        min-width:min(88vw,360px)!important;
        max-width:92vw!important;
        padding:16px 18px!important;
        border-radius:28px!important;
        background:rgba(255,255,255,.94)!important;
        border:4px solid rgba(255,203,112,.92)!important;
        box-shadow:0 20px 45px rgba(85,42,12,.23)!important;
        text-align:center!important;
        opacity:0!important;
        pointer-events:none!important;
        transition:opacity .16s ease,transform .16s ease!important;
      }

      .gj-battle-big-combat-fx.show{
        opacity:1!important;
        transform:translate(-50%,-50%) scale(1)!important;
      }

      .gj-bigfx-text{
        font-size:clamp(18px,5vw,28px)!important;
        font-weight:1000!important;
        color:#653018!important;
      }

      .opponent-status.off,
      #opponentStatus.off{
        border-color:rgba(255,123,105,.75)!important;
        background:rgba(255,239,236,.82)!important;
        color:#8d2b1f!important;
      }

      .gj-final-manifest-badge{
        position:fixed!important;
        left:8px!important;
        bottom:calc(8px + env(safe-area-inset-bottom))!important;
        z-index:100006!important;
        padding:5px 9px!important;
        border-radius:999px!important;
        border:1px solid rgba(255,200,110,.86)!important;
        background:rgba(255,255,255,.78)!important;
        color:#7b421e!important;
        font-size:10px!important;
        font-weight:1000!important;
        pointer-events:none!important;
        opacity:.62!important;
        box-shadow:0 6px 16px rgba(70,35,12,.12)!important;
      }

      .gj-final-manifest-badge.ok{border-color:rgba(90,210,120,.85)!important;color:#246a35!important;}
      .gj-final-manifest-badge.bad{border-color:rgba(255,120,90,.9)!important;color:#8d2918!important;opacity:.9!important;}

      @media(max-width:760px){
        html.gj-battle-mobile body{
          padding-bottom:calc(136px + env(safe-area-inset-bottom))!important;
          overflow-x:hidden!important;
          overflow-y:auto!important;
        }

        .gj-battle-actions-v4{
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
        }

        .gj-skill-btn{
          min-height:64px!important;
          padding:8px 6px!important;
          border-radius:18px!important;
        }

        .gj-skill-btn .gj-skill-icon{
          display:inline-block!important;
          font-size:20px!important;
          margin-right:3px!important;
        }

        .gj-skill-btn .gj-skill-main{
          display:inline!important;
          font-size:clamp(14px,4vw,17px)!important;
        }

        .gj-skill-btn .gj-skill-sub{display:none!important;}

        .gj-skill-btn .gj-skill-cost{
          display:block!important;
          width:fit-content!important;
          margin:4px auto 0!important;
        }

        .gj-original-actions-hidden-mobile{display:none!important;}

        .gj-mobile-action-dock{
          position:fixed!important;
          left:6px!important;
          right:6px!important;
          bottom:max(6px,env(safe-area-inset-bottom))!important;
          z-index:99999!important;
          padding:7px!important;
          border-radius:20px!important;
          border:3px solid rgba(255,189,105,.92)!important;
          background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,248,231,.98))!important;
          box-shadow:0 12px 30px rgba(89,45,12,.20)!important;
        }

        .gj-battle-dock-toggle{
          width:100%!important;
          min-height:30px!important;
          margin:0 0 6px!important;
          border-radius:999px!important;
          border:2px solid rgba(255,200,100,.85)!important;
          background:rgba(255,255,255,.76)!important;
          color:#82401e!important;
          font-size:12px!important;
          font-weight:1000!important;
        }

        .gj-mobile-action-grid{
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:7px!important;
        }

        .gj-mobile-action-btn{
          min-height:54px!important;
          padding:6px 5px!important;
          border-radius:16px!important;
          border:3px solid rgba(255,203,122,.92)!important;
          background:linear-gradient(180deg,#fff8d9,#ffe27a)!important;
          color:#87331f!important;
          font-size:clamp(13px,3.8vw,16px)!important;
          font-weight:1000!important;
        }

        html.gj-battle-dock-collapsed body{
          padding-bottom:calc(54px + env(safe-area-inset-bottom))!important;
        }

        html.gj-battle-dock-collapsed .gj-mobile-action-grid{
          display:none!important;
        }

        .gj-battle-compact-hud{
          position:sticky!important;
          top:max(4px,env(safe-area-inset-top))!important;
          z-index:9990!important;
          display:grid!important;
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:5px!important;
          width:100%!important;
          margin:4px 0 6px!important;
          padding:6px!important;
          border-radius:18px!important;
          border:2px solid rgba(255,198,92,.86)!important;
          background:rgba(255,252,239,.96)!important;
        }

        .gj-chud-item{
          min-width:0!important;
          padding:5px 3px!important;
          border-radius:13px!important;
          background:rgba(255,255,255,.68)!important;
          text-align:center!important;
        }

        .gj-chud-label{
          display:block!important;
          font-size:10px!important;
          font-weight:900!important;
          color:#8a5a2b!important;
        }

        .gj-chud-item b{
          display:block!important;
          margin-top:2px!important;
          font-size:clamp(13px,3.8vw,17px)!important;
          font-weight:1000!important;
          color:#5a3218!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
        }

        .arena,
        .battle-arena,
        .game-arena,
        #arena{
          height:clamp(300px,48dvh,430px)!important;
          min-height:300px!important;
          max-height:48dvh!important;
          overflow:hidden!important;
        }

        .gj-final-hide-dock{display:none!important;}

        .gj-final-manifest-badge{
          display:none!important;
        }
      }

      html.gj-battle-cardboard .gj-mobile-action-dock{
        display:none!important;
      }

      .gj-battle-qa-btn{
        position:fixed!important;
        right:8px!important;
        top:max(8px,env(safe-area-inset-top))!important;
        z-index:100002!important;
        width:34px!important;
        height:30px!important;
        border-radius:999px!important;
      }

      .gj-battle-qa-panel{
        position:fixed!important;
        right:8px!important;
        top:46px!important;
        z-index:100003!important;
        width:min(360px,calc(100vw - 16px))!important;
        max-height:min(70vh,520px)!important;
        overflow:auto!important;
        border-radius:18px!important;
        background:rgba(255,255,255,.96)!important;
        border:2px solid rgba(255,200,110,.92)!important;
        display:none!important;
      }

      html.gj-qa-open .gj-battle-qa-panel{
        display:block!important;
      }

      .gj-qa-head{
        display:flex!important;
        justify-content:space-between!important;
        align-items:center!important;
        padding:10px 12px!important;
        background:rgba(255,247,221,.92)!important;
      }

      .gj-qa-body{
        padding:10px 12px!important;
      }

      .gj-qa-grid{
        display:grid!important;
        grid-template-columns:80px minmax(0,1fr)!important;
        gap:5px 8px!important;
        font-size:11px!important;
      }

      .gj-qa-grid b{
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        white-space:nowrap!important;
      }
    `;

    document.head.appendChild(css);
  }

  /* =========================================================
   * Expose + Boot
   * ========================================================= */

  function exposeCore(){
    window.GJ_BATTLE_CORE = {
      version: CORE_VERSION,
      state,
      config: CFG,
      skills: SKILLS,

      useSkill,
      addPower,
      spendPower,
      damage,
      heal,

      resetLocalRound,
      updateMyPlayer,
      updateRoom,
      getRoomRef,

      buildLobbyUrl,
      buildModesUrl,
      buildHubUrl,

      endBattle,

      syncHud,
      refreshSkillButtons,

      readRuntimeScore,
      syncRealtimeNow,
      scheduleRealtimeSync,
      forceRealtimeSync,

      qaSnapshot
    };

    window.GJ_BATTLE_SKILL_LOGIC = window.GJ_BATTLE_CORE;
    window.GJ_BATTLE_SYNC = window.GJ_BATTLE_CORE;
    window.GJ_BATTLE_BALANCE = window.GJ_BATTLE_CORE;

    window.GJ_BATTLE_REALTIME_SYNC = {
      version: 'v2.4.26-realtime-final',
      readRuntimeScore,
      syncNow: syncRealtimeNow,
      scheduleSync: scheduleRealtimeSync,
      forceSync: forceRealtimeSync,
      applyOpponentToUI,
      state: state.realtime
    };

    window.GJ_BATTLE_FINAL_MANIFEST = {
      version: 'v2.4.26-final-manifest-qa-checklist',
      manifest: MANIFEST,
      detectPageRole,
      checkFirebase,
      checkSkills,
      qaSnapshot
    };
  }

  function boot(){
    exposeSchema();
    injectCSS();
    exposeCore();

    ensureHud();
    ensureSkillButtons();
    ensureMobileDock();
    syncHud();
    updateGlobalState();

    bindGameEvents();
    startHeartbeat();
    attachRoomListener();
    patchNavigation();
    patchRematch();
    ensureQA();

    layoutTick();

    setTimeout(function(){
      attachRoomListener();
      forceRealtimeSync('boot');
      patchRuntimeOpponentSnapshot();
      renderFinalBadge();
    }, 250);

    setTimeout(function(){
      attachRoomListener();
      forceRealtimeSync('boot-late');
      patchRuntimeOpponentSnapshot();
      renderFinalBadge();
    }, 1200);

    setInterval(() => {
      layoutTick();
      syncHud();
      refreshSkillButtons();
      ensureQA();
      patchRuntimeOpponentSnapshot();

      if (state.realtime.pendingSync || now() - state.realtime.lastForceSyncAt > CFG.realtimeForceSyncMs){
        forceRealtimeSync('interval-force');
      }

      renderFinalBadge();
    }, 900);

    window.addEventListener('resize', () => {
      setTimeout(layoutTick, 80);
      setTimeout(layoutTick, 400);
    }, { passive:true });

    window.addEventListener('orientationchange', () => {
      setTimeout(layoutTick, 250);
      setTimeout(layoutTick, 900);
    }, { passive:true });

    console.info('[GoodJunk Battle Core]', CORE_VERSION, 'loaded', {
      view: VIEW,
      mobile: IS_MOBILE,
      cardboard: IS_CARDBOARD,
      room: ROOM_CODE,
      player: PLAYER_ID
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();