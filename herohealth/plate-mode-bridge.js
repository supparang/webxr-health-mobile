/* =========================================================
   /herohealth/plate-mode-bridge.js
   PATCH v20260410-PLATE-MODE-BRIDGE
   ========================================================= */

(function () {
  'use strict';

  const W = window;
  const D = document;

  const qs = (k, d = '') => {
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch (_) { return d; }
  };

  const MODE_META = {
    solo:   { label: 'Solo',   minPlayers: 1, kind: 'solo' },
    duet:   { label: 'Duet',   minPlayers: 2, kind: 'team' },
    race:   { label: 'Race',   minPlayers: 2, kind: 'race' },
    battle: { label: 'Battle', minPlayers: 2, kind: 'battle' },
    coop:   { label: 'Co-op',  minPlayers: 2, kind: 'team' }
  };

  function clean(v, d = '') {
    const s = String(v ?? '').trim();
    return s || d;
  }

  function readJson(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function now() {
    return Date.now();
  }

  const ctx = {
    pid: clean(qs('pid', 'anon')),
    name: clean(qs('name', qs('nick', 'Hero'))),
    mode: clean(qs('mode', 'solo')).toLowerCase(),
    role: clean(qs('role', qs('playerRole', 'solo'))).toLowerCase(),
    room: clean(qs('room', '')),
    diff: clean(qs('diff', 'normal')),
    time: Number(clean(qs('time', '90')) || 90),
    view: clean(qs('view', 'mobile')),
    hub: clean(qs('hub', './hub-v2.html')),
    launcher: clean(qs('launcher', './plate-launcher.html')),
    run: clean(qs('run', 'play'))
  };

  if (!MODE_META[ctx.mode]) ctx.mode = 'solo';
  if (!ctx.role) ctx.role = ctx.mode === 'solo' ? 'solo' : 'guest';

  const ROOM_KEY_PREFIX = 'PLATE_ROOM_V2:';
  const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
  const LAST_SUMMARY_GLOBAL_KEY = 'HHA_LAST_SUMMARY_GLOBAL';

  const state = {
    booted: false,
    started: false,
    ended: false,
    roomData: null,
    watchStop: null,
    publishedAt: 0,

    me: {
      pid: ctx.pid,
      name: ctx.name,
      mode: ctx.mode,
      role: ctx.role,
      room: ctx.room,
      joinedAt: now(),
      score: 0,
      miss: 0,
      streak: 0,
      hp: 100,
      status: 'idle',
      finished: false,
      finishAt: 0
    }
  };

  function roomStorageKey(roomId) {
    return ROOM_KEY_PREFIX + roomId;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function createLocalRoomAdapter() {
    const listeners = new Map();

    function readRoom(roomId) {
      return readJson(roomStorageKey(roomId), null);
    }

    function writeRoom(room) {
      writeJson(roomStorageKey(room.roomId), room);
      notify(room.roomId);
      return clone(room);
    }

    function notify(roomId) {
      const room = readRoom(roomId);
      const arr = listeners.get(roomId) || [];
      arr.forEach(fn => {
        try { fn(clone(room)); } catch (_) {}
      });
    }

    W.addEventListener('storage', (ev) => {
      if (!ev.key || !ev.key.startsWith(ROOM_KEY_PREFIX)) return;
      const roomId = ev.key.slice(ROOM_KEY_PREFIX.length);
      notify(roomId);
    });

    return {
      async ensureJoined({ roomId, mode, player }) {
        let room = readRoom(roomId);
        if (!room) {
          room = {
            roomId,
            mode,
            status: 'waiting',
            hostPid: player.role === 'host' ? player.pid : '',
            startedAt: 0,
            players: {}
          };
        }

        if (!room.hostPid && player.role === 'host') {
          room.hostPid = player.pid;
        }

        room.mode = mode || room.mode || 'duet';
        room.players[player.pid] = {
          ...(room.players[player.pid] || {}),
          pid: player.pid,
          name: player.name,
          role: player.role,
          joinedAt: room.players[player.pid]?.joinedAt || now(),
          score: room.players[player.pid]?.score || 0,
          miss: room.players[player.pid]?.miss || 0,
          streak: room.players[player.pid]?.streak || 0,
          hp: room.players[player.pid]?.hp || 100,
          status: room.players[player.pid]?.status || 'joined',
          finished: !!room.players[player.pid]?.finished,
          finishAt: room.players[player.pid]?.finishAt || 0
        };

        const count = Object.keys(room.players).length;
        if (room.status !== 'started') {
          room.status = count >= (MODE_META[room.mode]?.minPlayers || 2) ? 'ready' : 'waiting';
        }

        return writeRoom(room);
      },

      async updatePlayer({ roomId, pid, patch }) {
        const room = readRoom(roomId);
        if (!room || !room.players?.[pid]) return null;
        room.players[pid] = { ...room.players[pid], ...patch };
        return writeRoom(room);
      },

      async watchRoom(roomId, callback) {
        if (!listeners.has(roomId)) listeners.set(roomId, []);
        listeners.get(roomId).push(callback);

        callback(readRoom(roomId));

        const timer = setInterval(() => {
          callback(readRoom(roomId));
        }, 700);

        return () => {
          clearInterval(timer);
          const arr = listeners.get(roomId) || [];
          listeners.set(roomId, arr.filter(fn => fn !== callback));
        };
      }
    };
  }

  const adapter = W.PlateRoomAdapter || createLocalRoomAdapter();

  function mountHud() {
    if (D.getElementById('plateModeHud')) return;

    const wrap = D.createElement('div');
    wrap.id = 'plateModeHud';
    wrap.style.cssText = [
      'position:fixed',
      'top:12px',
      'right:12px',
      'z-index:9999',
      'display:grid',
      'gap:8px',
      'max-width:min(92vw,340px)',
      'pointer-events:none'
    ].join(';');

    wrap.innerHTML = `
      <div id="plateModeChips" style="
        display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;">
      </div>
      <div id="plateModePanel" style="
        display:none;
        border-radius:16px;
        padding:10px 12px;
        background:rgba(2,6,23,.82);
        color:#fff;
        border:1px solid rgba(255,255,255,.12);
        box-shadow:0 12px 28px rgba(0,0,0,.22);
        font:900 13px/1.5 system-ui,sans-serif;">
      </div>
    `;
    D.body.appendChild(wrap);
  }

  function pill(text, tone) {
    const map = {
      good:  'background:rgba(34,197,94,.18);border:1px solid rgba(34,197,94,.28);color:#ecfdf5;',
      info:  'background:rgba(56,189,248,.18);border:1px solid rgba(56,189,248,.28);color:#e0f2fe;',
      warn:  'background:rgba(245,158,11,.18);border:1px solid rgba(245,158,11,.28);color:#fef3c7;',
      purple:'background:rgba(167,139,250,.18);border:1px solid rgba(167,139,250,.28);color:#f3e8ff;'
    };
    return `<span style="
      min-height:28px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:5px 10px;
      border-radius:999px;
      font:1000 12px/1 system-ui,sans-serif;
      ${map[tone] || map.info}
    ">${text}</span>`;
  }

  function renderHud() {
    mountHud();

    const chips = D.getElementById('plateModeChips');
    const panel = D.getElementById('plateModePanel');
    if (!chips || !panel) return;

    const room = state.roomData;
    const players = room?.players ? Object.values(room.players) : [];
    const count = players.length;
    const modeLabel = MODE_META[ctx.mode]?.label || ctx.mode;

    chips.innerHTML = [
      pill(`🍽️ ${modeLabel}`, 'warn'),
      ctx.mode !== 'solo' ? pill(`👤 ${ctx.role}`, 'purple') : '',
      ctx.room ? pill(`🏷️ ${ctx.room}`, 'info') : '',
      ctx.mode !== 'solo' ? pill(`👥 ${count}/${MODE_META[ctx.mode].minPlayers}`, count >= MODE_META[ctx.mode].minPlayers ? 'good' : 'warn') : ''
    ].filter(Boolean).join('');

    if (ctx.mode === 'solo') {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = 'block';

    const me = room?.players?.[ctx.pid];
    const others = players.filter(p => p.pid !== ctx.pid);

    if (ctx.mode === 'duet' || ctx.mode === 'coop') {
      const teamScore = players.reduce((s, p) => s + Number(p.score || 0), 0);
      const myScore = Number(me?.score || 0);
      const contribution = teamScore > 0 ? Math.round((myScore / teamScore) * 100) : 0;
      panel.innerHTML = `
        <div><b>ทีม</b> • คะแนนรวม ${teamScore}</div>
        <div>ของฉัน ${myScore} • ช่วยทีม ${contribution}%</div>
        <div>ผู้เล่น: ${players.map(p => `${p.name || p.pid}(${p.score || 0})`).join(' • ') || '-'}</div>
      `;
      return;
    }

    if (ctx.mode === 'race') {
      const ranking = [...players].sort((a,b) => Number(b.score || 0) - Number(a.score || 0));
      const myRank = ranking.findIndex(p => p.pid === ctx.pid) + 1;
      const leader = ranking[0];
      panel.innerHTML = `
        <div><b>Race</b> • อันดับของฉัน ${myRank || '-'}/${ranking.length || 0}</div>
        <div>ผู้นำ: ${leader ? `${leader.name || leader.pid} (${leader.score || 0})` : '-'}</div>
        <div>คู่แข่ง: ${others.map(p => `${p.name || p.pid}(${p.score || 0})`).join(' • ') || '-'}</div>
      `;
      return;
    }

    if (ctx.mode === 'battle') {
      const enemy = others[0] || null;
      const myScore = Number(me?.score || 0);
      const enemyScore = Number(enemy?.score || 0);
      const diff = myScore - enemyScore;
      const leadText = diff > 0 ? `นำอยู่ +${diff}` : diff < 0 ? `ตามอยู่ ${diff}` : 'เสมอ';
      panel.innerHTML = `
        <div><b>Battle</b> • ${leadText}</div>
        <div>ฉัน ${myScore} • คู่ต่อสู้ ${enemyScore}</div>
        <div>คู่ต่อสู้: ${enemy ? (enemy.name || enemy.pid) : '-'}</div>
      `;
      return;
    }

    panel.innerHTML = `<div>mode: ${ctx.mode}</div>`;
  }

  async function joinRoomIfNeeded() {
    if (ctx.mode === 'solo' || !ctx.room) return;

    const role = ctx.role === 'host' ? 'host' : 'guest';

    const room = await adapter.ensureJoined({
      roomId: ctx.room,
      mode: ctx.mode,
      player: {
        pid: ctx.pid,
        name: ctx.name,
        role
      }
    });

    state.roomData = room;
    renderHud();

    state.watchStop = await adapter.watchRoom(ctx.room, (nextRoom) => {
      state.roomData = nextRoom;
      renderHud();
    });
  }

  async function publishState() {
    if (ctx.mode === 'solo' || !ctx.room) return;
    if (now() - state.publishedAt < 120) return;
    state.publishedAt = now();

    await adapter.updatePlayer({
      roomId: ctx.room,
      pid: ctx.pid,
      patch: {
        score: Number(state.me.score || 0),
        miss: Number(state.me.miss || 0),
        streak: Number(state.me.streak || 0),
        hp: Number(state.me.hp || 100),
        status: state.me.status,
        finished: !!state.me.finished,
        finishAt: Number(state.me.finishAt || 0)
      }
    });
  }

  function computeModeSummary(base = {}) {
    const room = state.roomData;
    const players = room?.players ? Object.values(room.players) : [];
    const me = room?.players?.[ctx.pid] || state.me;
    const others = players.filter(p => p.pid !== ctx.pid);

    const summary = {
      ...base,
      game: 'plate',
      gameId: 'plate',
      zone: 'nutrition',
      cat: 'nutrition',
      theme: 'plate',
      mode: ctx.mode,
      role: ctx.role,
      room: ctx.room || '',
      pid: ctx.pid,
      name: ctx.name
    };

    if (ctx.mode === 'solo') {
      summary.resultLabel = base.resultLabel || 'solo';
      return summary;
    }

    if (ctx.mode === 'duet' || ctx.mode === 'coop') {
      const teamScore = players.reduce((s, p) => s + Number(p.score || 0), 0);
      const myScore = Number(me?.score || 0);
      summary.teamScore = teamScore;
      summary.myScore = myScore;
      summary.playerCount = players.length;
      summary.contributionPct = teamScore > 0 ? Math.round((myScore / teamScore) * 100) : 0;
      summary.resultLabel = ctx.mode === 'duet' ? 'duet-team' : 'coop-team';
      return summary;
    }

    if (ctx.mode === 'race') {
      const ranking = [...players].sort((a,b) => Number(b.score || 0) - Number(a.score || 0));
      summary.rank = ranking.findIndex(p => p.pid === ctx.pid) + 1;
      summary.playerCount = ranking.length;
      summary.winnerPid = ranking[0]?.pid || '';
      summary.winnerName = ranking[0]?.name || '';
      summary.resultLabel = summary.rank === 1 ? 'race-win' : 'race-finish';
      return summary;
    }

    if (ctx.mode === 'battle') {
      const enemy = others[0] || null;
      const myScore = Number(me?.score || 0);
      const enemyScore = Number(enemy?.score || 0);
      summary.enemyPid = enemy?.pid || '';
      summary.enemyName = enemy?.name || '';
      summary.enemyScore = enemyScore;
      summary.scoreDiff = myScore - enemyScore;
      summary.resultLabel = summary.scoreDiff > 0 ? 'battle-win' : summary.scoreDiff < 0 ? 'battle-lose' : 'battle-draw';
      return summary;
    }

    return summary;
  }

  function saveSummary(summary) {
    writeJson(LAST_SUMMARY_KEY, summary);
    writeJson(LAST_SUMMARY_GLOBAL_KEY, summary);
  }

  const bridge = {
    ctx,
    state,

    async boot() {
      if (state.booted) return;
      state.booted = true;
      mountHud();
      await joinRoomIfNeeded();
      renderHud();
    },

    async markStarted() {
      state.started = true;
      state.me.status = 'playing';
      await publishState();
      renderHud();
    },

    async metricPatch(patch = {}) {
      if (state.ended) return;

      if (patch.score != null) state.me.score = Number(patch.score || 0);
      if (patch.miss != null) state.me.miss = Number(patch.miss || 0);
      if (patch.streak != null) state.me.streak = Number(patch.streak || 0);
      if (patch.hp != null) state.me.hp = Number(patch.hp || 0);
      if (patch.status != null) state.me.status = String(patch.status || 'playing');

      await publishState();
      renderHud();
    },

    async finish(baseSummary = {}) {
      if (state.ended) return null;
      state.ended = true;

      state.me.status = 'finished';
      state.me.finished = true;
      state.me.finishAt = now();

      await publishState();

      const summary = computeModeSummary({
        ...baseSummary,
        score: Number(baseSummary.score ?? state.me.score ?? 0),
        miss: Number(baseSummary.miss ?? state.me.miss ?? 0),
        streak: Number(baseSummary.streak ?? state.me.streak ?? 0)
      });

      saveSummary(summary);
      renderHud();
      return summary;
    },

    getSummary() {
      return computeModeSummary({
        score: Number(state.me.score || 0),
        miss: Number(state.me.miss || 0),
        streak: Number(state.me.streak || 0)
      });
    }
  };

  W.PlateModeBridge = bridge;
})();