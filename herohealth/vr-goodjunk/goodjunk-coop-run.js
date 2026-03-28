/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-coop-run.js
 * FULL PATCH v20260328-GOODJUNK-COOP-ENGINE-R2
 * ---------------------------------------------------------
 * Coop gameplay engine
 * - participant-locked coop round
 * - falling good/junk gameplay
 * - team mission
 * - power-up: shield / double / freeze
 * - boss phase
 * - live score sync to Firebase
 * - team score / goal / players sync
 * - summary event bridge for run shell + CoopSafe
 * ========================================================= */

(() => {
  'use strict';

  if (window.__GJ_COOP_ENGINE_LOADED__) return;
  window.__GJ_COOP_ENGINE_LOADED__ = true;

  const D = document;
  const W = window;
  const qs = new URLSearchParams(location.search);

  const ctx = {
    pid: normalizePid(qs.get('pid') || W.__GJ_RUN_CTX__?.pid || 'anon'),
    name: clean(qs.get('name') || W.__GJ_RUN_CTX__?.name || ''),
    roomId: normalizeRoomId(qs.get('roomId') || qs.get('room') || W.__GJ_RUN_CTX__?.roomId || ''),
    diff: clean(qs.get('diff') || W.__GJ_RUN_CTX__?.diff || 'normal') || 'normal',
    time: clampInt(Number(qs.get('time') || W.__GJ_RUN_CTX__?.time || 120), 30, 600),
    seed: clean(qs.get('seed') || W.__GJ_RUN_CTX__?.seed || String(Date.now())),
    hub: clean(qs.get('hub') || W.__GJ_RUN_CTX__?.hub || '../hub.html') || '../hub.html',
    view: clean(qs.get('view') || W.__GJ_RUN_CTX__?.view || 'mobile') || 'mobile',
    run: clean(qs.get('run') || W.__GJ_RUN_CTX__?.run || 'play') || 'play',
    mode: 'coop',
    gameId: clean(qs.get('gameId') || W.__GJ_RUN_CTX__?.gameId || 'goodjunk') || 'goodjunk',
    startAt: Number(qs.get('startAt') || W.__GJ_RUN_CTX__?.startAt || 0) || 0
  };

  W.__GJ_RUN_CTX__ = { ...(W.__GJ_RUN_CTX__ || {}), ...ctx };
  W.__GJ_MULTI_RUN_CTX__ = W.__GJ_RUN_CTX__;

  const ROOM_PATH = `hha-battle/goodjunk/rooms/${ctx.roomId}`;
  const MOUNT = D.getElementById('gameMount') || D.body;

  const GOOD_ITEMS = ['🍎','🥕','🥦','🍌','🥛','🍉','🍓','🥬'];
  const JUNK_ITEMS = ['🍔','🍟','🍩','🍭','🥤','🍕','🧁','🍫'];

  const PRESETS = {
    easy:   { spawnMs: 900, goodRatio: 0.75, speedMin: 110, speedMax: 170, sizeMin: 68, sizeMax: 92, junkPenalty: 6, goodReward: 10, bossHp: 6, bossReward: 36 },
    normal: { spawnMs: 760, goodRatio: 0.67, speedMin: 135, speedMax: 220, sizeMin: 62, sizeMax: 86, junkPenalty: 7, goodReward: 10, bossHp: 8, bossReward: 48 },
    hard:   { spawnMs: 620, goodRatio: 0.60, speedMin: 165, speedMax: 280, sizeMin: 56, sizeMax: 80, junkPenalty: 8, goodReward: 11, bossHp: 10, bossReward: 60 }
  };

  const state = {
    firebase: null,
    db: null,
    roomRef: null,
    myRef: null,

    room: null,
    running: false,
    ended: false,
    summaryShown: false,

    width: 360,
    height: 640,

    loopRaf: 0,
    spawnAccum: 0,
    powerAccum: 0,
    lastTs: 0,
    startedAtPerf: 0,
    timeLeftMs: ctx.time * 1000,
    totalMs: ctx.time * 1000,

    score: 0,
    contribution: 0,
    miss: 0,
    bestStreak: 0,
    streak: 0,
    helps: 0,
    stars: 0,

    goodHit: 0,
    junkHit: 0,
    goodMiss: 0,

    shieldCharges: 0,
    doubleUntil: 0,
    freezeUntil: 0,

    mission: null,
    missionBonusGiven: false,
    missionFailed: false,

    bossStarted: false,
    bossCleared: false,
    bossId: '',
    bossHits: 0,

    targets: new Map(),
    targetSeq: 0,

    syncTimer: 0,
    roomListenerBound: false
  };

  const ui = {
    root: null,
    stage: null,
    layer: null,
    note: null,
    missionTitle: null,
    missionDesc: null,
    missionProgress: null,
    missionBadge: null,
    powerShield: null,
    powerDouble: null,
    powerFreeze: null,
    bossWrap: null,
    bossFill: null,
    hudScore: null,
    hudTime: null,
    hudMiss: null,
    hudStreak: null,
    hudTeamScore: null,
    hudGoal: null,
    hudContribution: null,
    hudPlayers: null,
    hudFill: null
  };

  const rng = seeded(`${ctx.seed}:${ctx.pid}`);

  boot().catch((err) => {
    console.error('[GJ-COOP-ENGINE] boot failed:', err);
    renderFatal(`เปิด GoodJunk Coop ไม่สำเร็จ: ${String(err?.message || err)}`);
  });

  function clean(v) {
    return String(v || '').trim();
  }

  function normalizePid(v) {
    const s = clean(v).replace(/[.#$[\]/]/g, '-');
    if (!s || s.toLowerCase() === 'anon') return `p-${Math.random().toString(36).slice(2, 10)}`;
    return s.slice(0, 48);
  }

  function normalizeRoomId(v) {
    return clean(v).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
  }

  function clampInt(v, min, max) {
    v = Math.round(Number(v) || 0);
    return Math.max(min, Math.min(max, v));
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, Number(v) || 0));
  }

  function esc(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function now() {
    return Date.now();
  }

  function preset() {
    return PRESETS[ctx.diff] || PRESETS.normal;
  }

  function seeded(seedText) {
    let h = 1779033703 ^ String(seedText || '').length;
    for (let i = 0; i < String(seedText || '').length; i++) {
      h = Math.imul(h ^ String(seedText).charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function() {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function rand() { return rng(); }
  function randRange(min, max) { return min + ((max - min) * rand()); }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)] || arr[0]; }

  function emit(name, detail) {
    try {
      W.dispatchEvent(new CustomEvent(name, { detail }));
    } catch {}
  }

  function roomFromRaw(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const playersMap = raw.players && typeof raw.players === 'object' ? raw.players : {};
    const players = Object.keys(playersMap).map((pid) => {
      const p = playersMap[pid] || {};
      return {
        id: normalizePid(pid),
        pid: normalizePid(pid),
        name: clean(p.name || pid),
        ready: !!p.ready,
        joinedAt: Number(p.joinedAt || 0) || 0,
        lastSeenAt: Number(p.lastSeenAt || 0) || 0,
        finished: !!p.finished,
        finalScore: Number(p.finalScore || 0) || 0,
        score: Number(p.score || p.finalScore || 0) || 0,
        contribution: Number(p.contribution || p.score || p.finalScore || 0) || 0,
        miss: Number(p.miss || 0) || 0,
        streak: Number(p.streak || 0) || 0,
        helps: Number(p.helps || 0) || 0,
        phase: clean(p.phase || 'lobby') || 'lobby',
        connected: p.connected !== false
      };
    });

    const participantIds = Array.isArray(raw.match?.participantIds)
      ? raw.match.participantIds.map(normalizePid).filter(Boolean)
      : [];

    return {
      roomId: normalizeRoomId(raw.roomId || ctx.roomId),
      hostId: normalizePid(raw.hostId || ''),
      mode: clean(raw.mode || 'coop') || 'coop',
      status: clean(raw.status || 'waiting') || 'waiting',
      startAt: Number(raw.startAt || 0) || 0,
      minPlayers: Math.max(2, Number(raw.minPlayers || 2) || 2),
      maxPlayers: Math.max(2, Number(raw.maxPlayers || 10) || 10),
      createdAt: Number(raw.createdAt || 0) || 0,
      updatedAt: Number(raw.updatedAt || 0) || 0,
      players,
      match: {
        participantIds,
        lockedAt: Number(raw.match?.lockedAt || 0) || 0,
        status: clean(raw.match?.status || 'idle') || 'idle',
        coop: {
          finishedAt: Number(raw.match?.coop?.finishedAt || 0) || 0
        }
      }
    };
  }

  function participants(room = state.room) {
    const ids = Array.isArray(room?.match?.participantIds) ? room.match.participantIds : [];
    if (!ids.length) return [];
    const idSet = new Set(ids);
    return (room?.players || []).filter((p) => idSet.has(p.id));
  }

  function mePlayer(room = state.room) {
    return (room?.players || []).find((p) => p.id === ctx.pid) || null;
  }

  function amParticipant(room = state.room) {
    const ids = participants(room).map((p) => p.id);
    if (!ids.length) return false;
    return ids.includes(ctx.pid);
  }

  function teamGoal(room = state.room) {
    const count = Math.max(2, participants(room).length || 0);
    const base = ctx.diff === 'easy' ? 85 : ctx.diff === 'hard' ? 125 : 105;
    return base * count;
  }

  function teamScore(room = state.room) {
    return participants(room).reduce((sum, p) => {
      return sum + Number(p.finished ? p.finalScore : (p.score || p.finalScore || 0));
    }, 0);
  }

  function participantsFinished(room = state.room) {
    const list = participants(room);
    if (!list.length) return false;
    return list.every((p) => !!p.finished);
  }

  function sortedSummaryPlayers(room = state.room) {
    return participants(room)
      .map((p) => ({
        pid: p.id,
        name: p.name,
        score: Number(p.finalScore || p.score || 0) || 0,
        contribution: Number(p.finalScore || p.contribution || p.score || 0) || 0,
        miss: Number(p.miss || 0) || 0,
        bestStreak: Number(p.streak || 0) || 0,
        helps: Number(p.helps || 0) || 0,
        ready: !!p.ready,
        finished: !!p.finished,
        connected: p.connected !== false
      }))
      .sort((a, b) => {
        if (b.contribution !== a.contribution) return b.contribution - a.contribution;
        if (a.miss !== b.miss) return a.miss - b.miss;
        if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
        return a.name.localeCompare(b.name, 'th');
      });
  }

  function activeDouble() {
    return now() < state.doubleUntil;
  }

  function activeFreeze() {
    return now() < state.freezeUntil;
  }

  function writeBridgeHud() {
    if (ui.hudScore) ui.hudScore.textContent = String(state.score);
    if (ui.hudTime) ui.hudTime.textContent = fmtClock(Math.ceil(state.timeLeftMs / 1000));
    if (ui.hudMiss) ui.hudMiss.textContent = String(state.miss);
    if (ui.hudStreak) ui.hudStreak.textContent = String(state.bestStreak);
    if (ui.hudTeamScore) ui.hudTeamScore.textContent = String(teamScore());
    if (ui.hudGoal) ui.hudGoal.textContent = String(teamGoal());
    if (ui.hudContribution) ui.hudContribution.textContent = String(state.contribution);
    if (ui.hudPlayers) ui.hudPlayers.textContent = String(participants().length);
    if (ui.hudFill) ui.hudFill.style.width = `${Math.round(clamp01(teamScore() / Math.max(1, teamGoal())) * 100)}%`;

    if (ui.powerShield) ui.powerShield.textContent = `🛡️ ${state.shieldCharges}`;
    if (ui.powerDouble) ui.powerDouble.textContent = activeDouble() ? `✨ x2 ${Math.ceil((state.doubleUntil - now())/1000)}s` : '✨ x2 0s';
    if (ui.powerFreeze) ui.powerFreeze.textContent = activeFreeze() ? `❄️ ${Math.ceil((state.freezeUntil - now())/1000)}s` : '❄️ 0s';

    if (state.mission) {
      if (ui.missionTitle) ui.missionTitle.textContent = state.mission.title;
      if (ui.missionDesc) ui.missionDesc.textContent = state.mission.desc;
      if (ui.missionProgress) ui.missionProgress.textContent = missionProgressText();
      if (ui.missionBadge) {
        ui.missionBadge.textContent = state.mission.cleared ? '✅' : '🎯';
        ui.missionBadge.style.background = state.mission.cleared ? 'linear-gradient(180deg,#eaffdf,#fffef9)' : 'linear-gradient(180deg,#f2ecff,#fffef9)';
      }
      if (ui.bossWrap) ui.bossWrap.style.display = state.bossStarted ? '' : 'none';
      if (ui.bossFill) {
        const boss = state.targets.get(state.bossId);
        const hpMax = state.mission?.bossHp || preset().bossHp;
        const hpNow = boss && boss.kind === 'boss' ? boss.hp : (state.bossCleared ? 0 : hpMax);
        ui.bossFill.style.width = `${Math.round(clamp01(hpNow / Math.max(1, hpMax)) * 100)}%`;
      }
    }
  }

  function pushBridgeState() {
    const summaryPlayers = sortedSummaryPlayers();

    const baseState = {
      pid: ctx.pid,
      name: ctx.name || ctx.pid,
      roomId: ctx.roomId,
      score: state.score,
      contribution: state.contribution,
      miss: state.miss,
      bestStreak: state.bestStreak,
      timeLeftSec: Math.ceil(state.timeLeftMs / 1000),
      teamScore: teamScore(),
      teamGoal: teamGoal(),
      playerCount: participants().length,
      playersReady: participants().filter((p) => p.ready).length,
      helps: state.helps,
      stars: state.stars,
      missionLabel: state.mission?.title || '',
      missionCleared: !!state.mission?.cleared,
      shieldCharges: state.shieldCharges,
      bossCleared: state.bossCleared,
      players: summaryPlayers.map((p) => ({
        pid: p.pid,
        name: p.name,
        score: p.score,
        contribution: p.contribution,
        miss: p.miss,
        bestStreak: p.bestStreak,
        helps: p.helps,
        finished: p.finished,
        ready: p.ready
      })),
      finalClear: teamScore() >= teamGoal(),
      ended: state.ended
    };

    writeBridgeHud();

    try { W.CoopSafe?.setState(baseState); } catch {}
    try { W.CoopSafe?.setPlayers(baseState.players); } catch {}
    try { W.CoopSafe?.setTeamProgress({
      teamScore: baseState.teamScore,
      teamGoal: baseState.teamGoal,
      playerCount: baseState.playerCount,
      playersReady: baseState.playersReady,
      finalClear: baseState.finalClear
    }); } catch {}

    emit('coop:update', baseState);
    emit('coop:players', { players: baseState.players });
    emit('coop:team', {
      teamScore: baseState.teamScore,
      teamGoal: baseState.teamGoal,
      playerCount: baseState.playerCount,
      playersReady: baseState.playersReady,
      finalClear: baseState.finalClear
    });
  }

  function fmtClock(sec) {
    const s = Math.max(0, Number(sec) || 0);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
  }

  function injectStyle() {
    const style = D.createElement('style');
    style.textContent = `
      #gjCoopEngineRoot{position:absolute;inset:0;overflow:hidden}
      .gj-coop-stage{
        position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:min(96vw,980px);height:min(76dvh,720px);
        border-radius:34px;border:3px solid rgba(255,255,255,.66);
        background:
          radial-gradient(circle at 12% 8%, rgba(255,255,255,.78), transparent 18%),
          radial-gradient(circle at 84% 16%, rgba(255,255,255,.54), transparent 16%),
          linear-gradient(180deg,#dff4ff 0%,#bfe8ff 58%,#fff7d8 100%);
        box-shadow:0 28px 70px rgba(86,155,194,.24);
        overflow:hidden;
      }
      .gj-coop-stage::before{
        content:"";position:absolute;left:-8%;right:-8%;bottom:-22%;
        height:44%;border-radius:50%;
        background:radial-gradient(circle at 50% 30%, rgba(126,217,87,.38), rgba(88,195,63,.52));
        filter:blur(10px);
      }
      .gj-coop-layer{position:absolute;inset:0;overflow:hidden}
      .gj-coop-target{
        position:absolute;border:0;cursor:pointer;
        display:grid;place-items:center;
        border-radius:24px;
        box-shadow:0 14px 26px rgba(86,155,194,.18);
        transition:transform .06s ease;
        user-select:none;-webkit-user-select:none;
      }
      .gj-coop-target:active{transform:scale(.96)}
      .gj-coop-target.good{
        background:linear-gradient(180deg,#f7fff4,#fffef9);
        border:3px solid rgba(126,217,87,.92);
      }
      .gj-coop-target.junk{
        background:linear-gradient(180deg,#fff7f4,#fffef9);
        border:3px solid rgba(255,165,86,.96);
      }
      .gj-coop-target.power{
        background:linear-gradient(180deg,#f2ecff,#fffef9);
        border:3px solid rgba(122,99,199,.82);
      }
      .gj-coop-target.boss{
        background:linear-gradient(180deg,#ffe8df,#fff5e7);
        border:4px solid rgba(255,136,63,.96);
        box-shadow:0 18px 34px rgba(255,138,61,.20);
      }
      .gj-coop-emoji{
        font-size:clamp(28px,4vw,42px);
        line-height:1;
        filter:drop-shadow(0 4px 8px rgba(0,0,0,.10));
      }
      .gj-coop-target.boss .gj-coop-emoji{
        font-size:clamp(38px,6vw,58px);
      }
      .gj-coop-tag{
        position:absolute;left:50%;bottom:6px;transform:translateX(-50%);
        font-size:10px;font-weight:1000;letter-spacing:.06em;
        color:#7b7a72;text-transform:uppercase;white-space:nowrap;
      }
      .gj-coop-note{
        position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        min-width:min(84vw,380px);max-width:min(90vw,520px);
        padding:16px 18px;border-radius:24px;
        background:rgba(255,255,255,.88);
        border:3px solid rgba(191,227,242,.98);
        box-shadow:0 18px 40px rgba(86,155,194,.18);
        color:#6d6a62;text-align:center;font-size:18px;font-weight:1000;
        line-height:1.5;z-index:7;
      }
      .gj-coop-note.hide{display:none}

      .gj-coop-board{
        position:absolute;left:12px;right:12px;top:12px;z-index:5;
        display:flex;justify-content:space-between;gap:10px;align-items:flex-start;pointer-events:none;
      }
      .gj-coop-panel{
        min-width:min(46vw,280px);
        max-width:min(48vw,320px);
        border-radius:22px;
        background:rgba(255,255,255,.82);
        border:3px solid rgba(191,227,242,.95);
        box-shadow:0 10px 22px rgba(86,155,194,.14);
        padding:12px;
      }
      .gj-coop-panel-title{
        font-size:12px;font-weight:1000;color:#9884db;margin-bottom:6px;
      }
      .gj-coop-panel-badge{
        width:42px;height:42px;border-radius:14px;
        display:grid;place-items:center;
        border:2px solid rgba(191,227,242,.95);
        background:linear-gradient(180deg,#f2ecff,#fffef9);
        font-size:22px;flex:0 0 auto;
      }
      .gj-coop-panel-row{
        display:flex;gap:10px;align-items:flex-start;
      }
      .gj-coop-panel-main{
        min-width:0;flex:1 1 auto;
      }
      .gj-coop-panel-main strong{
        display:block;color:#4d4a42;font-size:16px;line-height:1.15;
      }
      .gj-coop-panel-main div{
        margin-top:4px;color:#7b7a72;font-size:12px;line-height:1.6;font-weight:1000;
      }
      .gj-coop-minirow{
        display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;
      }
      .gj-coop-mini{
        display:inline-flex;align-items:center;gap:6px;
        padding:8px 10px;border-radius:999px;
        background:#fff;border:2px solid rgba(191,227,242,.95);
        color:#6d6a62;font-size:12px;font-weight:1000;
      }

      .gj-coop-boss{
        margin-top:10px;display:none;
      }
      .gj-coop-boss-label{
        font-size:11px;font-weight:1000;color:#a05a25;margin-bottom:6px;
      }
      .gj-coop-boss-bar{
        height:14px;border-radius:999px;overflow:hidden;
        background:rgba(255,255,255,.72);
        border:2px solid rgba(255,185,132,.9);
      }
      .gj-coop-boss-fill{
        height:100%;width:100%;
        background:linear-gradient(90deg,#ffcf6a,#ff9e4a,#ff7548);
      }

      .gj-coop-fx{
        position:absolute;z-index:8;font-size:20px;font-weight:1000;
        transform:translate(-50%,-50%);
        pointer-events:none;
        animation:gj-coop-fx-up .72s ease forwards;
      }
      @keyframes gj-coop-fx-up{
        0%{opacity:1;transform:translate(-50%,-20%) scale(.94)}
        100%{opacity:0;transform:translate(-50%,-150%) scale(1.06)}
      }

      .gj-coop-bridge{display:none !important}

      @media (max-width:760px){
        .gj-coop-board{
          left:10px; right:10px; top:10px;
          flex-direction:column;
          align-items:stretch;
        }
        .gj-coop-panel{
          min-width:0; max-width:none;
        }
      }
    `;
    D.head.appendChild(style);
  }

  function buildStage() {
    MOUNT.innerHTML = `
      <div id="gjCoopEngineRoot">
        <div class="gj-coop-stage" id="gjCoopStage">
          <div class="gj-coop-board">
            <div class="gj-coop-panel">
              <div class="gj-coop-panel-title">TEAM MISSION</div>
              <div class="gj-coop-panel-row">
                <div class="gj-coop-panel-badge" id="gjMissionBadge">🎯</div>
                <div class="gj-coop-panel-main">
                  <strong id="gjMissionTitle">เตรียมภารกิจ...</strong>
                  <div id="gjMissionDesc">กำลังเลือกภารกิจให้รอบนี้</div>
                </div>
              </div>
              <div class="gj-coop-minirow">
                <div class="gj-coop-mini" id="gjMissionProgress">...</div>
              </div>
              <div class="gj-coop-boss" id="gjBossWrap">
                <div class="gj-coop-boss-label">BOSS HP</div>
                <div class="gj-coop-boss-bar"><div class="gj-coop-boss-fill" id="gjBossFill"></div></div>
              </div>
            </div>

            <div class="gj-coop-panel">
              <div class="gj-coop-panel-title">POWER-UP</div>
              <div class="gj-coop-minirow">
                <div class="gj-coop-mini" id="gjPowerShield">🛡️ 0</div>
                <div class="gj-coop-mini" id="gjPowerDouble">✨ x2 0s</div>
                <div class="gj-coop-mini" id="gjPowerFreeze">❄️ 0s</div>
              </div>
            </div>
          </div>

          <div class="gj-coop-layer" id="gjCoopLayer"></div>
          <div class="gj-coop-note" id="gjCoopNote">กำลังเตรียม GoodJunk Coop...</div>

          <div class="gj-coop-bridge" id="coopHud" aria-hidden="true">
            <div id="coopScoreValue">0</div>
            <div id="coopTimeValue">0:00</div>
            <div id="coopMissValue">0</div>
            <div id="coopStreakValue">0</div>
            <div id="coopTeamScoreValue">0</div>
            <div id="coopGoalValue">0</div>
            <div id="coopContributionValue">0</div>
            <div id="coopPlayersValue">0</div>
            <div id="coopTeamFill" style="width:0%"></div>
          </div>
        </div>
      </div>
    `;

    ui.root = D.getElementById('gjCoopEngineRoot');
    ui.stage = D.getElementById('gjCoopStage');
    ui.layer = D.getElementById('gjCoopLayer');
    ui.note = D.getElementById('gjCoopNote');

    ui.missionTitle = D.getElementById('gjMissionTitle');
    ui.missionDesc = D.getElementById('gjMissionDesc');
    ui.missionProgress = D.getElementById('gjMissionProgress');
    ui.missionBadge = D.getElementById('gjMissionBadge');
    ui.powerShield = D.getElementById('gjPowerShield');
    ui.powerDouble = D.getElementById('gjPowerDouble');
    ui.powerFreeze = D.getElementById('gjPowerFreeze');
    ui.bossWrap = D.getElementById('gjBossWrap');
    ui.bossFill = D.getElementById('gjBossFill');

    ui.hudScore = D.getElementById('coopScoreValue');
    ui.hudTime = D.getElementById('coopTimeValue');
    ui.hudMiss = D.getElementById('coopMissValue');
    ui.hudStreak = D.getElementById('coopStreakValue');
    ui.hudTeamScore = D.getElementById('coopTeamScoreValue');
    ui.hudGoal = D.getElementById('coopGoalValue');
    ui.hudContribution = D.getElementById('coopContributionValue');
    ui.hudPlayers = D.getElementById('coopPlayersValue');
    ui.hudFill = D.getElementById('coopTeamFill');

    measure();
    W.addEventListener('resize', measure);
  }

  function measure() {
    const rect = ui.stage?.getBoundingClientRect();
    if (!rect) return;
    state.width = Math.max(320, rect.width);
    state.height = Math.max(420, rect.height);
  }

  function showNote(html) {
    if (!ui.note) return;
    ui.note.innerHTML = html;
    ui.note.classList.remove('hide');
  }

  function hideNote() {
    ui.note?.classList.add('hide');
  }

  function spawnFx(x, y, text, good) {
    const fx = D.createElement('div');
    fx.className = 'gj-coop-fx';
    fx.style.left = `${x}px`;
    fx.style.top = `${y}px`;
    fx.style.color = good ? '#58c33f' : '#ff8a3d';
    fx.textContent = text;
    ui.layer.appendChild(fx);
    setTimeout(() => fx.remove(), 740);
  }

  function chooseMission() {
    const pcount = Math.max(2, participants().length || 2);
    const diffOffset = ctx.diff === 'easy' ? 0 : ctx.diff === 'hard' ? 2 : 1;
    const selector = Math.floor(rand() * 3);

    if (selector === 0) {
      const goal = 14 + (pcount * 2) + diffOffset * 2;
      return {
        kind: 'collect',
        goal,
        title: 'Healthy Collector',
        desc: `เก็บอาหารดีให้ได้อย่างน้อย ${goal} ชิ้น`,
        cleared: false,
        bonus: 28,
        bossHp: preset().bossHp
      };
    }

    if (selector === 1) {
      const goal = ctx.diff === 'easy' ? 7 : ctx.diff === 'hard' ? 11 : 9;
      return {
        kind: 'streak',
        goal,
        title: 'Super Streak',
        desc: `ทำสตรีกให้ถึง ${goal} ครั้ง`,
        cleared: false,
        bonus: 26,
        bossHp: preset().bossHp
      };
    }

    const goal = ctx.diff === 'easy' ? 4 : ctx.diff === 'hard' ? 6 : 5;
    return {
      kind: 'careful',
      goal,
      title: 'Careful Hero',
      desc: `จบรอบโดยมี Miss ไม่เกิน ${goal}`,
      cleared: false,
      bonus: 24,
      bossHp: preset().bossHp
    };
  }

  function missionProgressText() {
    if (!state.mission) return '-';
    if (state.mission.kind === 'collect') {
      return `เก็บแล้ว ${state.goodHit}/${state.mission.goal}`;
    }
    if (state.mission.kind === 'streak') {
      return `สตรีกสูงสุด ${state.bestStreak}/${state.mission.goal}`;
    }
    if (state.mission.kind === 'careful') {
      return `Miss ${state.miss}/${state.mission.goal}`;
    }
    return '-';
  }

  function maybeClearMission(fromFinish = false) {
    if (!state.mission || state.mission.cleared || state.missionFailed) return false;

    let ok = false;
    if (state.mission.kind === 'collect') ok = state.goodHit >= state.mission.goal;
    if (state.mission.kind === 'streak') ok = state.bestStreak >= state.mission.goal;
    if (state.mission.kind === 'careful' && fromFinish) ok = state.miss <= state.mission.goal;

    if (!ok) return false;

    state.mission.cleared = true;
    if (!state.missionBonusGiven) {
      state.missionBonusGiven = true;
      state.score += state.mission.bonus;
      state.contribution = state.score;
      state.stars += 1;
      showNote(`Mission Clear!<br>+${state.mission.bonus} โบนัส`);
      setTimeout(hideNote, 900);
    }
    return true;
  }

  function spawnPowerTarget() {
    const powerKinds = ['shield','double','freeze'];
    const powerType = pick(powerKinds);

    const size = 70;
    const x = clampInt(randRange(16, state.width - size - 16), 16, Math.max(16, state.width - size - 16));
    const y = -size - 16;
    const speed = 120;

    const icon = powerType === 'shield' ? '🛡️' : powerType === 'double' ? '✨' : '❄️';
    const label = powerType === 'shield' ? 'shield' : powerType === 'double' ? 'x2' : 'freeze';

    const id = `gjc-p-${++state.targetSeq}`;
    const el = D.createElement('button');
    el.type = 'button';
    el.className = 'gj-coop-target power';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.innerHTML = `
      <div class="gj-coop-emoji">${icon}</div>
      <div class="gj-coop-tag">${label}</div>
    `;

    const target = { id, el, kind:'power', powerType, x, y, size, speed, dead:false };
    el.addEventListener('click', () => hitTarget(target));

    ui.layer.appendChild(el);
    state.targets.set(id, target);
  }

  function spawnBossTarget() {
    const size = clampInt(Math.min(state.width * 0.20, 136), 96, 136);
    const x = clampInt(state.width * 0.5 - size * 0.5, 20, Math.max(20, state.width - size - 20));
    const y = 72;
    const hp = state.mission?.bossHp || preset().bossHp;

    const id = `gjc-b-${++state.targetSeq}`;
    const el = D.createElement('button');
    el.type = 'button';
    el.className = 'gj-coop-target boss';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.innerHTML = `
      <div class="gj-coop-emoji">👾</div>
      <div class="gj-coop-tag">boss</div>
    `;

    const target = {
      id, el, kind:'boss', x, y, size,
      dx: rand() > .5 ? 160 : -160,
      hp,
      hpMax: hp,
      dead:false
    };

    el.addEventListener('click', () => hitTarget(target));

    ui.layer.appendChild(el);
    state.targets.set(id, target);
    state.bossId = id;
    state.bossStarted = true;
    ui.bossWrap.style.display = '';
  }

  function createFallingTarget() {
    if (!state.running) return;

    const p = preset();
    const good = rand() < p.goodRatio;
    const size = clampInt(randRange(p.sizeMin, p.sizeMax), p.sizeMin, p.sizeMax);
    const x = clampInt(randRange(10, state.width - size - 10), 10, Math.max(10, state.width - size - 10));
    const y = -size - clampInt(randRange(0, 26), 0, 26);
    const speed = randRange(p.speedMin, p.speedMax);

    const id = `gjc-${++state.targetSeq}`;
    const el = D.createElement('button');
    el.type = 'button';
    el.className = `gj-coop-target ${good ? 'good' : 'junk'}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.innerHTML = `
      <div class="gj-coop-emoji">${good ? pick(GOOD_ITEMS) : pick(JUNK_ITEMS)}</div>
      <div class="gj-coop-tag">${good ? 'good' : 'junk'}</div>
    `;

    const target = { id, el, kind:good ? 'good' : 'junk', x, y, size, speed, dead:false };
    el.addEventListener('click', () => hitTarget(target));

    ui.layer.appendChild(el);
    state.targets.set(id, target);
  }

  function removeTarget(target) {
    if (!target || target.dead) return;
    target.dead = true;
    state.targets.delete(target.id);
    target.el?.remove();
    if (state.bossId === target.id) state.bossId = '';
  }

  function applyPower(powerType) {
    if (powerType === 'shield') {
      state.shieldCharges = Math.min(3, state.shieldCharges + 1);
      showNote('Shield +1');
      setTimeout(hideNote, 700);
      return;
    }
    if (powerType === 'double') {
      state.doubleUntil = now() + 6000;
      showNote('Double Score 6s');
      setTimeout(hideNote, 700);
      return;
    }
    if (powerType === 'freeze') {
      state.freezeUntil = now() + 4500;
      showNote('Freeze 4.5s');
      setTimeout(hideNote, 700);
    }
  }

  function hitTarget(target) {
    if (!state.running || state.ended || !target || target.dead) return;

    const p = preset();
    const cx = target.x + target.size / 2;
    const cy = target.y + target.size / 2;

    if (target.kind === 'good') {
      const multi = activeDouble() ? 2 : 1;
      const reward = p.goodReward * multi;
      state.score += reward;
      state.contribution = state.score;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.goodHit += 1;
      state.helps += (state.streak > 0 && state.streak % 8 === 0) ? 1 : 0;
      spawnFx(cx, cy, `+${reward}`, true);
      maybeClearMission(false);
      writeBridgeHud();
      pushBridgeState();
      removeTarget(target);
      return;
    }

    if (target.kind === 'junk') {
      if (state.shieldCharges > 0) {
        state.shieldCharges -= 1;
        spawnFx(cx, cy, 'SHIELD!', true);
      } else {
        state.score = Math.max(0, state.score - p.junkPenalty);
        state.contribution = state.score;
        state.miss += 1;
        state.streak = 0;
        state.junkHit += 1;
        spawnFx(cx, cy, `-${p.junkPenalty}`, false);
      }
      writeBridgeHud();
      pushBridgeState();
      removeTarget(target);
      return;
    }

    if (target.kind === 'power') {
      applyPower(target.powerType);
      writeBridgeHud();
      pushBridgeState();
      removeTarget(target);
      return;
    }

    if (target.kind === 'boss') {
      const hitPower = activeDouble() ? 2 : 1;
      target.hp = Math.max(0, target.hp - hitPower);
      state.bossHits += hitPower;
      spawnFx(cx, cy, `HIT`, true);

      if (target.hp <= 0) {
        const reward = preset().bossReward * (activeDouble() ? 2 : 1);
        state.score += reward;
        state.contribution = state.score;
        state.bossCleared = true;
        state.stars += 1;
        spawnFx(cx, cy, `+${reward}`, true);
        showNote('Boss Clear!');
        setTimeout(hideNote, 900);
        removeTarget(target);
      }

      writeBridgeHud();
      pushBridgeState();
    }
  }

  function updateTargets(dtSec) {
    const freezeFactor = activeFreeze() ? 0.45 : 1;
    const floorY = state.height + 40;

    state.targets.forEach((target) => {
      if (target.dead) return;

      if (target.kind === 'boss') {
        target.x += target.dx * dtSec;
        if (target.x <= 12 || target.x >= state.width - target.size - 12) {
          target.dx *= -1;
          target.x = Math.max(12, Math.min(state.width - target.size - 12, target.x));
        }
        target.el.style.left = `${target.x}px`;
        return;
      }

      target.y += (target.speed * freezeFactor) * dtSec;
      target.el.style.top = `${target.y}px`;

      if (target.y > floorY) {
        if (target.kind === 'good') {
          state.miss += 1;
          state.goodMiss += 1;
          state.streak = 0;
          spawnFx(target.x + target.size / 2, state.height - 26, 'MISS', false);
        }
        removeTarget(target);
      }
    });
  }

  function maybeStartBossPhase() {
    if (state.bossStarted || state.bossCleared) return;
    const elapsed = state.totalMs - state.timeLeftMs;
    if (elapsed < state.totalMs * 0.62) return;

    state.bossStarted = true;
    showNote('Boss Phase!');
    setTimeout(hideNote, 900);
    spawnBossTarget();
  }

  function gameFrame(ts) {
    if (!state.running || state.ended) return;

    const dtMs = Math.min(32, Math.max(0, ts - state.lastTs));
    const dtSec = dtMs / 1000;

    state.lastTs = ts;
    state.timeLeftMs = Math.max(0, state.totalMs - (ts - state.startedAtPerf));
    state.spawnAccum += dtMs;
    state.powerAccum += dtMs;

    const p = preset();

    while (state.spawnAccum >= p.spawnMs) {
      state.spawnAccum -= p.spawnMs;
      createFallingTarget();
    }

    if (state.powerAccum >= 6500) {
      state.powerAccum = 0;
      spawnPowerTarget();
    }

    maybeStartBossPhase();
    updateTargets(dtSec);
    maybeClearMission(false);
    pushBridgeState();

    if (state.timeLeftMs <= 0) {
      finishGame('timeup').catch((err) => {
        console.error('[GJ-COOP-ENGINE] finishGame error:', err);
      });
      return;
    }

    state.loopRaf = requestAnimationFrame(gameFrame);
  }

  async function syncSelf(extra = {}) {
    if (!state.myRef) return;
    try {
      await state.myRef.update({
        name: ctx.name || ctx.pid,
        ready: true,
        connected: true,
        phase: state.ended ? 'done' : 'run',
        score: Number(state.score || 0),
        contribution: Number(state.contribution || state.score || 0),
        finalScore: Number(state.ended ? state.score : 0),
        miss: Number(state.miss || 0),
        streak: Number(state.bestStreak || 0),
        helps: Number(state.helps || 0),
        finished: !!state.ended,
        lastSeenAt: now(),
        ...extra
      });
      await state.roomRef.child('updatedAt').set(now());
    } catch (err) {
      console.warn('[GJ-COOP-ENGINE] syncSelf failed:', err);
    }
  }

  function startSyncLoop() {
    stopSyncLoop();
    state.syncTimer = setInterval(() => {
      syncSelf();
    }, 320);
  }

  function stopSyncLoop() {
    if (state.syncTimer) {
      clearInterval(state.syncTimer);
      state.syncTimer = 0;
    }
  }

  async function ensureSafeLayer() {
    if (W.CoopSafe || W.__GJ_COOP_SAFE_LOADED__) return;
    await loadScript('./goodjunk.safe.coop.js');
  }

  async function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = D.createElement('script');
      s.src = new URL(src, location.href).toString();
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error(`โหลด script ไม่สำเร็จ: ${src}`));
      D.body.appendChild(s);
    });
  }

  async function ensureFirebase() {
    if (W.HHA_FIREBASE_DB && W.HHA_FIREBASE) {
      state.firebase = W.HHA_FIREBASE;
      state.db = W.HHA_FIREBASE_DB;
      return;
    }

    if (!W.firebase) {
      await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js');
    }

    if (!W.HHA_FIREBASE_CONFIG && !W.HEROHEALTH_FIREBASE_CONFIG && !W.FIREBASE_CONFIG) {
      try { await loadScript('./firebase-config.js'); } catch {}
    }

    const cfg =
      W.HHA_FIREBASE_CONFIG ||
      W.HEROHEALTH_FIREBASE_CONFIG ||
      W.FIREBASE_CONFIG ||
      W.__firebaseConfig;

    if (!cfg || !cfg.apiKey || !cfg.projectId) {
      throw new Error('ไม่พบ Firebase config');
    }

    const fb = W.firebase;
    const app = (fb.apps && fb.apps.length) ? fb.app() : fb.initializeApp(cfg);
    state.firebase = fb;
    state.db = fb.database(app);

    W.HHA_FIREBASE = fb;
    W.HHA_FIREBASE_DB = state.db;
    W.HHA_FIREBASE_READY = true;
    emit('hha:firebase_ready', { ok: true });
  }

  async function bindRoom() {
    state.roomRef = state.db.ref(ROOM_PATH);
    state.myRef = state.roomRef.child('players').child(ctx.pid);

    try {
      await state.myRef.onDisconnect().update({
        connected: false,
        phase: 'lobby'
      });
    } catch {}

    if (state.roomListenerBound) return;
    state.roomListenerBound = true;

    state.roomRef.on('value', async (snap) => {
      const raw = snap.val();
      if (!raw) {
        if (!state.summaryShown) {
          renderFatal('ไม่พบห้อง coop นี้');
        }
        return;
      }

      state.room = roomFromRaw(raw);
      pushBridgeState();

      if (state.running && !amParticipant(state.room)) {
        showNote('รอบนี้คุณไม่ได้อยู่ใน participant');
        return;
      }

      if (state.ended) {
        if ((state.room.status === 'finished') || participantsFinished(state.room)) {
          await finalizeSummaryIfNeeded('room-finished');
        }
        return;
      }

      if (state.running && isHost() && participantsFinished(state.room)) {
        try {
          await state.roomRef.update({
            status: 'finished',
            updatedAt: now(),
            'match/status': 'finished',
            'match/coop/finishedAt': now()
          });
        } catch {}
      }
    });
  }

  function isHost(room = state.room) {
    return !!room && normalizePid(room.hostId) === ctx.pid;
  }

  async function waitStartGate() {
    const startAt = Number(state.room?.startAt || ctx.startAt || 0) || 0;
    if (!startAt) return;

    return new Promise((resolve) => {
      const tick = () => {
        const left = startAt - now();
        if (left <= 0) {
          showNote('GO!');
          setTimeout(() => {
            hideNote();
            resolve();
          }, 380);
          return;
        }
        showNote(`เริ่มเล่นพร้อมกันใน<br><span style="font-size:42px;color:#7a63c7;">${Math.ceil(left / 1000)}</span>`);
        setTimeout(tick, 120);
      };
      tick();
    });
  }

  async function joinRunPresence() {
    const me = mePlayer(state.room);
    await syncSelf({
      ready: true,
      connected: true,
      phase: 'run',
      finished: false,
      score: Number(me?.score || 0) || 0,
      contribution: Number(me?.contribution || me?.score || 0) || 0,
      finalScore: 0,
      miss: Number(me?.miss || 0) || 0,
      streak: Number(me?.streak || 0) || 0,
      helps: Number(me?.helps || 0) || 0
    });
  }

  function startGameplay() {
    if (state.running || state.ended) return;

    state.running = true;
    state.ended = false;
    state.timeLeftMs = ctx.time * 1000;
    state.totalMs = ctx.time * 1000;
    state.spawnAccum = 0;
    state.powerAccum = 2200;
    state.lastTs = performance.now();
    state.startedAtPerf = state.lastTs;

    state.score = 0;
    state.contribution = 0;
    state.miss = 0;
    state.bestStreak = 0;
    state.streak = 0;
    state.helps = 0;
    state.stars = 0;
    state.goodHit = 0;
    state.junkHit = 0;
    state.goodMiss = 0;

    state.shieldCharges = 0;
    state.doubleUntil = 0;
    state.freezeUntil = 0;

    state.mission = chooseMission();
    state.missionBonusGiven = false;
    state.missionFailed = false;

    state.bossStarted = false;
    state.bossCleared = false;
    state.bossId = '';
    state.bossHits = 0;

    hideNote();
    writeBridgeHud();
    pushBridgeState();
    startSyncLoop();

    state.loopRaf = requestAnimationFrame(gameFrame);
  }

  async function finishGame(reason = 'finished') {
    if (state.ended) return;

    maybeClearMission(true);

    state.ended = true;
    state.running = false;

    if (state.loopRaf) cancelAnimationFrame(state.loopRaf);
    state.loopRaf = 0;
    stopSyncLoop();

    state.targets.forEach((t) => removeTarget(t));
    state.targets.clear();

    await syncSelf({
      finished: true,
      phase: 'done',
      finalScore: Number(state.score || 0),
      score: Number(state.score || 0),
      contribution: Number(state.score || 0),
      miss: Number(state.miss || 0),
      streak: Number(state.bestStreak || 0),
      helps: Number(state.helps || 0)
    });

    if (isHost(state.room) && participantsFinished(state.room)) {
      try {
        await state.roomRef.update({
          status: 'finished',
          updatedAt: now(),
          'match/status': 'finished',
          'match/coop/finishedAt': now()
        });
      } catch {}
    }

    await finalizeSummaryIfNeeded(reason);
  }

  async function finalizeSummaryIfNeeded(reason = 'finished') {
    if (state.summaryShown) return;
    state.summaryShown = true;

    const players = sortedSummaryPlayers();
    const summary = {
      mode: 'coop',
      game: 'goodjunk-coop',
      gameId: ctx.gameId,
      pid: ctx.pid,
      name: ctx.name || ctx.pid,
      roomId: ctx.roomId,
      diff: ctx.diff,
      time: ctx.time,
      result: teamScore() >= teamGoal() ? 'ผ่านเป้าหมายทีม' : 'จบรอบ',
      reason,
      score: state.score,
      contribution: state.score,
      teamScore: teamScore(),
      teamGoal: teamGoal(),
      players: players.length,
      miss: state.miss,
      goodHit: state.goodHit,
      junkHit: state.junkHit,
      bestStreak: state.bestStreak,
      duration: ctx.time,
      finalClear: teamScore() >= teamGoal(),
      missionTitle: state.mission?.title || '',
      missionDesc: state.mission?.desc || '',
      missionCleared: !!state.mission?.cleared,
      missionBonus: state.mission?.cleared ? state.mission?.bonus || 0 : 0,
      shieldCharges: state.shieldCharges,
      bossCleared: state.bossCleared,
      stars: state.stars,
      endedAt: new Date().toISOString(),
      summary: {
        mode: 'coop',
        score: state.score,
        contribution: state.score,
        teamScore: teamScore(),
        teamGoal: teamGoal(),
        playerCount: players.length,
        players,
        miss: state.miss,
        goodHit: state.goodHit,
        junkHit: state.junkHit,
        bestStreak: state.bestStreak,
        duration: ctx.time,
        finalClear: teamScore() >= teamGoal(),
        roomId: ctx.roomId,
        result: teamScore() >= teamGoal() ? 'ผ่านเป้าหมายทีม' : 'จบรอบ',
        reason,
        missionTitle: state.mission?.title || '',
        missionDesc: state.mission?.desc || '',
        missionCleared: !!state.mission?.cleared,
        missionBonus: state.mission?.cleared ? state.mission?.bonus || 0 : 0,
        shieldCharges: state.shieldCharges,
        bossCleared: state.bossCleared,
        stars: state.stars,
        endedAt: new Date().toISOString()
      }
    };

    try { W.CoopSafe?.finishGame(summary.summary); } catch {}
    emit('coop:finish', summary.summary);
    emit('gj:coop-summary', summary);
    emit('gj:summary', summary);
    emit('hha:summary', summary);

    try {
      localStorage.setItem(`GJ_COOP_LAST_SUMMARY_${ctx.roomId}_${ctx.pid}`, JSON.stringify(summary));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    } catch {}
  }

  function renderFatal(message) {
    MOUNT.innerHTML = `
      <div style="position:absolute;inset:0;display:grid;place-items:center;padding:18px;">
        <div style="width:min(92vw,620px);border-radius:28px;border:3px solid #bfe3f2;background:linear-gradient(180deg,#fffef9,#f7fff4);box-shadow:0 28px 70px rgba(86,155,194,.24);padding:22px;">
          <div style="font-size:30px;line-height:1.05;font-weight:1000;color:#7a63c7;">GoodJunk Coop</div>
          <div style="margin-top:10px;color:#6d6a62;font-size:15px;line-height:1.75;font-weight:900;">${esc(message)}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;">
            <a href="./goodjunk-coop-lobby.html?roomId=${encodeURIComponent(ctx.roomId)}&pid=${encodeURIComponent(ctx.pid)}&name=${encodeURIComponent(ctx.name)}&hub=${encodeURIComponent(ctx.hub)}&diff=${encodeURIComponent(ctx.diff)}&time=${encodeURIComponent(String(ctx.time))}&view=${encodeURIComponent(ctx.view)}&run=${encodeURIComponent(ctx.run)}&gameId=${encodeURIComponent(ctx.gameId)}"
               style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:10px 16px;border-radius:16px;background:linear-gradient(180deg,#7fcfff,#58b7f5);color:#fffef9;font-weight:1000;box-shadow:0 10px 20px rgba(86,155,194,.14);">กลับ Lobby</a>
            <a href="${esc(ctx.hub)}"
               style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:10px 16px;border-radius:16px;background:#fff;color:#6d6a62;border:2px solid #bfe3f2;font-weight:1000;box-shadow:0 10px 20px rgba(86,155,194,.14);">กลับ HUB</a>
          </div>
        </div>
      </div>
    `;
  }

  async function boot() {
    if (!ctx.roomId) {
      throw new Error('ไม่พบ roomId');
    }

    injectStyle();
    buildStage();
    showNote('กำลังโหลด GoodJunk Coop...');

    await ensureSafeLayer();
    await ensureFirebase();
    await bindRoom();

    const snap = await state.roomRef.once('value');
    state.room = roomFromRaw(snap.val());
    if (!state.room) throw new Error('ไม่พบห้อง coop');

    if (!amParticipant(state.room)) {
      showNote('รอบนี้คุณไม่ได้อยู่ใน participant ของรอบนี้');
      pushBridgeState();
      return;
    }

    await joinRunPresence();
    pushBridgeState();

    await waitStartGate();

    if (!state.room || !amParticipant(state.room)) {
      showNote('participant ไม่ถูกต้อง');
      return;
    }

    startGameplay();

    D.addEventListener('visibilitychange', () => {
      if (D.visibilityState === 'visible' && !state.ended) syncSelf();
    });

    W.addEventListener('focus', () => {
      if (!state.ended) syncSelf();
    });

    W.addEventListener('beforeunload', () => {
      stopSyncLoop();
      try {
        state.myRef?.update({
          connected: false,
          phase: state.ended ? 'done' : 'lobby'
        });
      } catch {}
    });
  }
})();