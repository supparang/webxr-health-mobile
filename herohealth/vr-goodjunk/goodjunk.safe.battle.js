(() => {
  'use strict';

  const W = window;
  const D = document;

  if (W.__GJ_BATTLE_SAFE_LOADED__) return;
  W.__GJ_BATTLE_SAFE_LOADED__ = true;

  const LS_KEYS = {
    lastSummaryGlobal: 'GJ_BATTLE_LAST_SUMMARY_GLOBAL',
    lastSummaryScoped: 'GJ_BATTLE_LAST_SUMMARY_SCOPED'
  };

  const STATE = {
    roomId: '',
    ended: false,
    current: {},
    mountedFallback: false
  };

  const BRIDGE = {
    timer: 0,
    resultShown: false
  };

  function qsGet(key, fb = '') {
    try { return new URL(location.href).searchParams.get(key) ?? fb; }
    catch { return fb; }
  }

  function txt(v, fb = '') {
    const s = String(v == null ? '' : v).trim();
    return s || fb;
  }

  function num(v, fb = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  }

  function int(v, fb = 0) {
    return Math.round(num(v, fb));
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, num(v, a)));
  }

  function nowIso() {
    try { return new Date().toISOString(); }
    catch { return ''; }
  }

  function safeJson(v) {
    try { return JSON.stringify(v, null, 2); }
    catch { return '{}'; }
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizePid(v) {
    const s = String(v == null ? '' : v).trim().replace(/[.#$[\]/]/g, '-');
    if (!s || s.toLowerCase() === 'anon') return '';
    return s.slice(0, 80);
  }

  function normalizeRoomId(v) {
    return String(v == null ? '' : v)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 24);
  }

  function byId(id) {
    return D.getElementById(id);
  }

  function getSelfPid() {
    return normalizePid(
      (W.__GJ_RUN_CTX__ || {}).pid ||
      (W.RUN_CTX || {}).pid ||
      qsGet('pid') ||
      qsGet('playerId') ||
      ''
    );
  }

  function getSelfUid() {
    return normalizePid(
      (W.__GJ_RUN_CTX__ || {}).uid ||
      (W.RUN_CTX || {}).uid ||
      (W.state || {}).uid ||
      qsGet('uid') ||
      qsGet('playerId') ||
      ''
    );
  }

  function getSelfName() {
    return txt(
      (W.__GJ_RUN_CTX__ || {}).name ||
      (W.RUN_CTX || {}).name ||
      qsGet('name') ||
      qsGet('nick') ||
      'Player'
    );
  }

  function currentRoomId() {
    return normalizeRoomId(
      STATE.roomId ||
      (W.__GJ_RUN_CTX__ || {}).roomId ||
      (W.RUN_CTX || {}).roomId ||
      ((W.state || {}).roomId) ||
      qsGet('roomId') ||
      qsGet('room') ||
      ''
    );
  }

  function saveLastSummary(summary) {
    try {
      localStorage.setItem(LS_KEYS.lastSummaryGlobal, JSON.stringify(summary));
    } catch (_) {}

    try {
      const pid = summary?.pid || getSelfPid() || '';
      if (pid) {
        localStorage.setItem(`${LS_KEYS.lastSummaryScoped}:${pid}`, JSON.stringify(summary));
      }
    } catch (_) {}
  }

  function clearReplayCaches(summary) {
    try {
      const pid = summary?.pid || getSelfPid() || '';
      if (pid) {
        localStorage.removeItem(`${LS_KEYS.lastSummaryScoped}:${pid}`);
      }
    } catch (_) {}

    try { localStorage.removeItem(LS_KEYS.lastSummaryGlobal); } catch (_) {}
    try { delete W.__GJ_BATTLE_LAST_SUMMARY__; } catch (_) {}
    try { delete W.__GJ_BATTLE_LAST_SESSION_FLUSH__; } catch (_) {}
    try { delete W.__HHA_BATTLE_EVENT_BUFFER__; } catch (_) {}
  }

  function buildReplayLobbyUrl(summary) {
    const roomId = normalizeRoomId(
      summary?.roomId ||
      STATE.roomId ||
      currentRoomId() ||
      qsGet('roomId') ||
      qsGet('room')
    ) || '';

    const u = new URL('./goodjunk-battle-lobby.html', location.href);

    if (roomId) {
      u.searchParams.set('roomId', roomId);
      u.searchParams.set('room', roomId);
    }

    const pid = getSelfPid();
    const name = getSelfName();

    if (pid) u.searchParams.set('pid', pid);
    if (name) {
      u.searchParams.set('name', name);
      u.searchParams.set('nick', name);
    }

    const plannedSec =
      int(summary?.raw?.room?.state?.plannedSec, 0) ||
      int(qsGet('time'), 150);

    const diff =
      txt(summary?.raw?.room?.meta?.diff) ||
      txt(qsGet('diff')) ||
      'normal';

    u.searchParams.set('time', String(plannedSec || 150));
    u.searchParams.set('diff', diff || 'normal');
    u.searchParams.set('view', qsGet('view', 'mobile'));
    u.searchParams.set('run', qsGet('run', 'play'));
    u.searchParams.set('mode', 'battle');
    u.searchParams.set('hub', qsGet('hub', '../hub.html'));
    u.searchParams.set('replay', '1');
    u.searchParams.delete('showLastSummary');

    return u.toString();
  }

  async function resetRoomForReplay(summary) {
    const firebase = W.firebase;
    if (!firebase || !firebase.database) return false;

    const roomId = normalizeRoomId(
      summary?.roomId ||
      STATE.roomId ||
      currentRoomId() ||
      qsGet('roomId') ||
      qsGet('room')
    ) || '';

    if (!roomId) return false;

    const roomRef = firebase.database().ref(`hha-battle/goodjunk/rooms/${roomId}`);
    const snap = await roomRef.once('value');
    if (!snap.exists()) return false;

    const room = snap.val() || {};
    const t = Date.now();
    const playersSrc = (room.players && typeof room.players === 'object') ? room.players : {};
    const nextPlayers = {};

    Object.keys(playersSrc).forEach((key) => {
      const p = playersSrc[key] || {};
      nextPlayers[key] = {
        ...p,
        connected: p.connected !== false,
        ready: true,
        status: 'waiting',

        score: 0,
        miss: 0,
        combo: 0,
        bestStreak: 0,

        hp: 100,
        maxHp: 100,
        shield: 0,

        attackCharge: 0,
        maxAttackCharge: 100,
        attackReady: false,

        attacksUsed: 0,
        guardsUsed: 0,
        perfectGuardCount: 0,
        blockedDamage: 0,
        criticalCount: 0,
        damageDealt: 0,
        damageTaken: 0,
        koCount: 0,

        counterUsed: 0,
        chargeDrained: 0,
        junkRainSent: 0,
        junkRainReceived: 0,
        drainComboUsed: 0,
        junkComboUsed: 0,
        counterBonusUsed: 0,

        telegraphType: '',
        telegraphUntil: 0,

        lastAttackId: '',
        lastAttackAt: 0,
        lastAttackDamage: 0,
        lastAttackTarget: '',

        updatedAt: t,
        lastSeen: t
      };
    });

    await roomRef.set({
      meta: {
        ...(room.meta || {}),
        updatedAt: t
      },
      state: {
        ...(room.state || {}),
        status: 'waiting',
        plannedSec: int(room?.state?.plannedSec, 150) || 150,
        countdownEndsAt: 0,
        startedAt: 0,
        endsAt: 0,
        endedAt: 0,
        roundToken: '',
        phase: 'A',
        bossEvent: null,
        finalRageDone: false,
        director: {
          id: `dir-balanced-${t}`,
          mode: 'balanced',
          updatedAt: t
        },
        updatedAt: t
      },
      players: nextPlayers
    });

    return true;
  }

  function readRoomFromGlobals() {
    return (
      W.__BATTLE_ROOM__ ||
      W.battleRoom ||
      (W.state || {}).room ||
      (W.gameState || {}).room ||
      {}
    );
  }

  function normalizePlayers(playersObj) {
    const out = [];
    const src = (playersObj && typeof playersObj === 'object') ? playersObj : {};

    Object.keys(src).forEach((key) => {
      const p = src[key] || {};
      const uid = normalizePid(p.uid || p.playerId || key);
      const pid = normalizePid(p.pid || p.playerId || p.uid || key);
      const hp = num(p.hp, 100);
      const item = {
        key,
        uid,
        playerId: uid,
        pid,
        name: txt(p.name || p.nick || pid || 'Player'),
        score: num(p.score, 0),
        miss: num(p.miss, 0),
        bestStreak: num(p.bestStreak, 0),
        hp,
        maxHp: Math.max(1, num(p.maxHp, 100)),
        koCount: num(p.koCount, 0),
        alive: hp > 0,
        raw: p
      };
      out.push(item);
    });

    return out;
  }

  function sortBattlePlayers(players) {
    return [...players].sort((a, b) => {
      if (Number(b.alive) !== Number(a.alive)) return Number(b.alive) - Number(a.alive);
      if (b.score !== a.score) return b.score - a.score;
      if (b.hp !== a.hp) return b.hp - a.hp;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      if (b.koCount !== a.koCount) return b.koCount - a.koCount;
      return String(a.name || '').localeCompare(String(b.name || ''), 'th');
    });
  }

  function mergeState(detail) {
    STATE.current = Object.assign({}, STATE.current || {}, detail || {});
    if (detail && detail.roomId) STATE.roomId = normalizeRoomId(detail.roomId);
  }

  function buildSummary() {
    const room = readRoomFromGlobals();
    const roomPlayers = normalizePlayers(room.players || {});
    const players = sortBattlePlayers(roomPlayers);

    const selfUid = getSelfUid();
    const selfPid = getSelfPid();

    let me = players.find((p) => p.uid && p.uid === selfUid);
    if (!me && selfPid) me = players.find((p) => p.pid === selfPid);
    if (!me && players.length) me = players[0] || null;

    const rank = me ? (players.findIndex((p) => p.key === me.key) + 1) : '';
    const opponent = players.find((p) => !me || p.key !== me.key) || null;
    const result = rank === 1 ? 'win' : (rank ? `อันดับ ${rank}` : 'finished');

    return {
      mode: 'battle',
      label: 'Battle',
      game: 'goodjunk-battle',
      roomId: normalizeRoomId(room?.meta?.roomId || currentRoomId()),
      pid: getSelfPid(),
      uid: getSelfUid(),
      name: getSelfName(),
      rank,
      score: me ? me.score : num((W.state || {}).score, 0),
      opponentScore: opponent ? opponent.score : '',
      players: players.length,
      miss: me ? me.miss : num((W.state || {}).miss, 0),
      bestStreak: me ? me.bestStreak : num((W.state || {}).bestStreak, 0),
      result,
      reason: txt(STATE.current.endReason || STATE.current.reason || 'finished'),
      hp: me ? me.hp : num((W.state || {}).hp, 0),
      maxHp: me ? me.maxHp : Math.max(1, num((W.state || {}).maxHp, 100)),
      raw: {
        room,
        players,
        state: W.state || {},
        current: STATE.current || {}
      },
      endedAt: nowIso()
    };
  }

  function emitBattleSummary(summary) {
    try { W.__GJ_BATTLE_LAST_SUMMARY__ = summary; } catch (_) {}

    const payload = { summary };

    const events = [
      'gj:battle-summary',
      'gj:summary',
      'gj:match-summary',
      'hha:summary',
      'hha:session-summary',
      'hha:match-summary'
    ];

    events.forEach((name) => {
      try { W.dispatchEvent(new CustomEvent(name, { detail: payload })); } catch (_) {}
    });

    try {
      W.postMessage({ type: 'gj:battle-summary', detail: payload }, '*');
    } catch (_) {}
  }

  function removeFallbackResult() {
    const el = byId('battleSafeFallbackOverlay');
    if (el) el.remove();
    STATE.mountedFallback = false;
  }

  function patchExistingResultDOM() {
    return false;
  }

  function mountFallbackResult(summary) {
    removeFallbackResult();

    const overlay = D.createElement('div');
    overlay.id = 'battleSafeFallbackOverlay';
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:9999',
      'display:grid',
      'place-items:center',
      'padding:16px',
      'background:rgba(255,244,221,.72)',
      'backdrop-filter:blur(10px)'
    ].join(';');

    overlay.innerHTML = `
      <div style="
        width:min(920px,100%);
        max-height:88dvh;
        overflow:auto;
        background:linear-gradient(180deg,#fffef8,#f7fff4);
        border:3px solid #bfe3f2;
        border-radius:30px;
        box-shadow:0 28px 70px rgba(86,155,194,.24);
        padding:18px;
        color:#4d4a42;
        font-family:system-ui,-apple-system,'Segoe UI',sans-serif;
      ">
        <div style="
          display:inline-flex;align-items:center;gap:8px;
          padding:8px 14px;border-radius:999px;background:#fff4dd;border:2px solid #bfe3f2;
          color:#b7791f;font-size:13px;font-weight:1000;margin-bottom:10px;
        ">⚔️ GOODJUNK BATTLE SUMMARY</div>

        <div style="
          display:grid;grid-template-columns:96px 1fr;gap:14px;align-items:center;
          margin-bottom:14px;padding:14px;border-radius:24px;background:#fff;
          border:2px solid #f0ddbc;box-shadow:0 10px 24px rgba(86,155,194,.10);
        ">
          <div style="
            width:96px;height:96px;border-radius:28px;display:grid;place-items:center;
            background:linear-gradient(180deg,#fff4dd,#fffdf6);border:3px solid #f0ddbc;font-size:42px;
            box-shadow:0 10px 20px rgba(86,155,194,.10);
          ">${summary.rank === 1 ? '🏆' : '⚔️'}</div>
          <div>
            <h3 style="margin:0 0 6px;font-size:32px;line-height:1.08;color:#b7791f;font-weight:1000;">
              ${summary.rank === 1 ? 'Battle Winner!' : 'Battle Hero!'}
            </h3>
            <p style="margin:0;color:#6d6b63;font-size:14px;line-height:1.7;font-weight:900;">
              ${escHtml(summary.name || 'Player')} • ${summary.rank === 1 ? 'เธอชนะการปะทะครั้งนี้ได้สุดยอดมาก' : 'จบรอบแล้ว มาดูผลการปะทะกัน'}
            </p>
          </div>
        </div>

        <div style="
          margin:0 auto 14px;width:min(480px,100%);border-radius:24px;background:#fff;
          border:3px solid #f0ddbc;box-shadow:0 10px 22px rgba(86,155,194,.10);padding:16px 14px;text-align:center;
        ">
          <div style="color:#d09e52;font-size:15px;font-weight:1000;margin-bottom:4px;">Score</div>
          <div style="color:#4d4a42;font-size:56px;line-height:1;font-weight:1000;">${int(summary.score, 0)}</div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
          ${[
            ['ผลลัพธ์', summary.result],
            ['อันดับ', summary.rank],
            ['คะแนนเรา', summary.score],
            ['คะแนนคู่แข่ง', summary.opponentScore],
            ['ผู้เล่นทั้งหมด', summary.players],
            ['Miss', summary.miss],
            ['Best Streak', summary.bestStreak],
            ['ห้อง', summary.roomId || '-']
          ].map(([k, v]) => `
            <div style="background:#fff;border:2px solid #f0ddbc;border-radius:22px;box-shadow:0 8px 18px rgba(86,155,194,.08);padding:14px;">
              <div style="color:#d09e52;font-size:12px;font-weight:1000;margin-bottom:6px;">${escHtml(k)}</div>
              <div style="color:#4d4a42;font-size:28px;font-weight:1000;line-height:1.18;">${escHtml(v == null ? '-' : String(v))}</div>
            </div>
          `).join('')}
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
          <button id="battleSafeRematchBtn" style="
            appearance:none;border:0;cursor:pointer;border-radius:18px;padding:13px 18px;
            font-weight:1000;font-size:15px;background:linear-gradient(180deg,#7ed957,#58c33f);color:#fffef9;
            box-shadow:0 10px 20px rgba(86,155,194,.14);
          ">เล่นใหม่</button>

          <button id="battleSafeCopyRoomBtn" style="
            appearance:none;border:0;cursor:pointer;border-radius:18px;padding:13px 18px;
            font-weight:1000;font-size:15px;background:linear-gradient(180deg,#7fcfff,#58b7f5);color:#fffef9;
            box-shadow:0 10px 20px rgba(86,155,194,.14);
          ">คัดลอกห้อง</button>

          <button id="battleSafeExportBtn" style="
            appearance:none;border:0;cursor:pointer;border-radius:18px;padding:13px 18px;
            font-weight:1000;font-size:15px;background:linear-gradient(180deg,#ffd45c,#ffb547);color:#6d4e00;
            box-shadow:0 10px 20px rgba(86,155,194,.14);
          ">Export JSON</button>

          <button id="battleSafeBackHubBtn" style="
            appearance:none;cursor:pointer;border-radius:18px;padding:13px 18px;font-weight:1000;font-size:15px;
            background:#fff;color:#6d6a62;border:2px solid #bfe3f2;box-shadow:0 10px 20px rgba(86,155,194,.14);
          ">กลับ HUB</button>
        </div>

        <pre style="
          margin-top:14px;padding-top:10px;border-top:1px dashed #f0ddbc;color:#8a887f;
          font-size:11px;line-height:1.6;font-weight:900;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto;
        ">${escHtml(safeJson(summary))}</pre>
      </div>
    `;

    D.body.appendChild(overlay);
    STATE.mountedFallback = true;

    byId('battleSafeCopyRoomBtn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(summary.roomId || '');
      } catch (_) {}
    });

    byId('battleSafeExportBtn')?.addEventListener('click', () => {
      try {
        const blob = new Blob([safeJson(summary)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = D.createElement('a');
        a.href = url;
        a.download = `goodjunk-battle-summary-${txt(summary.roomId, 'room')}-${Date.now()}.json`;
        D.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (_) {}
    });

    byId('battleSafeBackHubBtn')?.addEventListener('click', () => {
      location.href = qsGet('hub', '../hub.html');
    });

    byId('battleSafeRematchBtn')?.addEventListener('click', async () => {
      const btn = byId('battleSafeRematchBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ กำลังรีเซ็ตห้อง...';
      }

      clearReplayCaches(summary);

      try {
        await resetRoomForReplay(summary);
      } catch (err) {
        console.warn('[battle-safe] rematch reset failed:', err);
      }

      location.href = buildReplayLobbyUrl(summary);
    });
  }

  function stopBridge() {
    if (BRIDGE.timer) {
      clearInterval(BRIDGE.timer);
      BRIDGE.timer = 0;
    }
  }

  function finishGame(detail = {}) {
    if (BRIDGE.resultShown) return;

    mergeState({
      ...detail,
      ended: true,
      endedAt: detail.endedAt || detail.timestampIso || nowIso(),
      endReason: detail.endReason || detail.reason || 'finished'
    });

    BRIDGE.resultShown = true;
    STATE.ended = true;

    const summary = buildSummary();
    saveLastSummary(summary);

    emitBattleSummary(summary);

    const hasRunBridgeSummary =
      typeof W.__GJ_SHOW_BATTLE_SUMMARY__ === 'function' ||
      !!D.getElementById('summaryOverlay');

    if (!hasRunBridgeSummary) {
      const patchedExisting = patchExistingResultDOM(summary);
      if (!patchedExisting) {
        mountFallbackResult(summary);
      }
    }

    if (BRIDGE.timer) {
      setTimeout(() => {
        stopBridge();
      }, 1500);
    }
  }

  function syncFromGlobals() {
    const room = readRoomFromGlobals();
    if (room && room.meta && room.meta.roomId) {
      STATE.roomId = normalizeRoomId(room.meta.roomId);
    }

    const gs = W.state || W.gameState || {};
    if (gs && (gs.finished || gs.ended || gs.isEnded || gs.showSummary)) {
      finishGame({
        reason: gs.reason || 'finished',
        endedAt: nowIso()
      });
    }
  }

  function installListeners() {
    W.addEventListener('battle:finish', (evt) => {
      finishGame((evt && evt.detail) || {});
    });

    W.addEventListener('hha:battle:finish', (evt) => {
      finishGame((evt && evt.detail) || {});
    });

    W.addEventListener('battle:update', (evt) => {
      mergeState((evt && evt.detail) || {});
    });
  }

  function initBridge() {
    installListeners();

    BRIDGE.timer = setInterval(() => {
      syncFromGlobals();
    }, 400);
  }

  W.BattleSafe = Object.assign({}, W.BattleSafe || {}, {
    finishGame,
    stopBridge
  });

  initBridge();
})();