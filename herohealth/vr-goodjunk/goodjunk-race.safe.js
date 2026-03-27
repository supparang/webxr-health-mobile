/* /herohealth/vr-goodjunk/goodjunk-race.safe.js
   FULL PATCH v20260327-GOODJUNK-RACE-SAFE-COMPANION
   ใช้คู่กับ goodjunk-race-run.html
   - กัน 404
   - bridge สถานะ / summary
   - บอก shell ว่า engine พร้อมแล้ว
*/
(function () {
  'use strict';

  const W = window;
  const D = document;

  function byId(id){ return D.getElementById(id); }
  function clean(v){ return String(v || '').trim(); }

  function readCtx() {
    const q = new URLSearchParams(location.search);
    const ctx = W.__GJ_RUN_CTX__ || W.__GJ_MULTI_RUN_CTX__ || {};
    return {
      pid: clean(ctx.pid || q.get('pid') || 'anon'),
      name: clean(ctx.name || q.get('name') || q.get('nick') || ''),
      roomId: clean(ctx.roomId || q.get('roomId') || q.get('room') || ''),
      role: clean(ctx.role || q.get('role') || 'player'),
      diff: clean(ctx.diff || q.get('diff') || 'normal'),
      time: clean(ctx.time || q.get('time') || '120'),
      mode: 'race'
    };
  }

  function setText(ids, text) {
    const list = Array.isArray(ids) ? ids : [ids];
    for (const id of list) {
      const el = byId(id);
      if (el) el.textContent = text;
    }
  }

  function setStatus(title, text, isError) {
    const titleEl = byId('engineStatusTitle');
    const textEl = byId('engineStatusText');
    if (titleEl) titleEl.textContent = title;
    if (textEl) {
      textEl.textContent = text;
      textEl.className = isError ? 'error' : '';
    }
  }

  function dispatch(name, detail) {
    try { W.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }

  const ctx = readCtx();

  const Safe = {
    patch: 'v20260327-GOODJUNK-RACE-SAFE-COMPANION',
    ctx,
    state: {
      room: null,
      players: [],
      score: 0,
      summary: null,
      ready: false,
      lastMessage: ''
    },

    init() {
      setText(['pillRoom', 'engineMiniRoom'], `ROOM • ${ctx.roomId || '-'}`);
      setText(['pillRole'], `ROLE • ${ctx.role || 'player'}`);
      setText(['pillDiff'], `LEVEL • ${ctx.diff || 'normal'}`);
      setText(['pillTime'], `TIME • ${ctx.time || '120'}`);
      return true;
    },

    setState(patch) {
      this.state = Object.assign({}, this.state, patch || {});
      return this.state;
    },

    setRoomState(room) {
      this.state.room = room || null;
      const roomId = clean((room && (room.roomId || room.id || room.code)) || ctx.roomId);
      if (roomId) {
        ctx.roomId = roomId;
        setText(['pillRoom', 'engineMiniRoom'], `ROOM • ${roomId}`);
      }
      return this.state.room;
    },

    setPlayers(players) {
      if (Array.isArray(players)) this.state.players = players.slice();
      else if (players && typeof players === 'object') this.state.players = Object.values(players);
      else this.state.players = [];
      return this.state.players;
    },

    setScore(score) {
      this.state.score = Number(score) || 0;
      return this.state.score;
    },

    setSummary(summary) {
      this.state.summary = summary || null;
      return this.state.summary;
    },

    render(){ return true; },
    updateHud(){ return true; },
    syncRoom(){ return true; },
    syncPlayers(){ return true; },
    onJudge(){ return true; },
    onDamage(){ return true; },
    onAttackCharge(){ return true; },

    showLoading(text) {
      const msg = clean(text) || 'กำลังโหลดเกม';
      this.state.lastMessage = msg;
      setStatus('กำลังเตรียมเกม…', msg, false);
    },

    showWarn(text) {
      const msg = clean(text) || 'กำลังรอข้อมูล';
      this.state.lastMessage = msg;
      setStatus('กำลังเตรียมเกม…', msg, false);
    },

    showError(text) {
      const msg = clean(text) || 'โหลดเกมไม่สำเร็จ';
      this.state.lastMessage = msg;
      setStatus('เกิดปัญหาในการโหลด', msg, true);
    },

    clearMessage() {
      this.state.lastMessage = '';
      setStatus('พร้อมแล้ว!', 'กำลังเข้าเกม…', false);
    },

    markEngineReady(info) {
      this.state.ready = true;
      W.__GJ_RACE_ENGINE_READY__ = true;
      try {
        if (typeof W.GJRaceShellReady === 'function') {
          W.GJRaceShellReady(info || {});
        }
      } catch (_) {}
      dispatch('gj:race-engine-ready', info || {});
      return true;
    },

    emitSummary(detail) {
      const payload = detail || this.state.summary || {};
      this.state.summary = payload;
      dispatch('gj:race-summary', payload);
      dispatch('gj:summary', payload);
      dispatch('hha:summary', payload);
      try { W.postMessage({ type: 'gj:race-summary', detail: payload }, '*'); } catch (_) {}
      return payload;
    },

    finishGame(detail) {
      return this.emitSummary(detail);
    }
  };

  W.GJRaceSafe = Safe;
  W.RaceSafe = Safe;

  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', () => Safe.init(), { once: true });
  } else {
    Safe.init();
  }
})();