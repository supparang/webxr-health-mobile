/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk.safe.race.js
 * FULL SAFE LAYER FOR RACE
 * ---------------------------------------------------------
 * Features:
 * - robust self detection (PID-first)
 * - race HUD bridge
 * - room/player bridge
 * - stable race sorting
 * - fixed result table / rank badge
 * - no "guess first row as me"
 * - fallback result modal if existing result DOM is absent
 * - public API for legacy gameplay logic
 *
 * Public API:
 *   window.RaceSafe.setState(patch)
 *   window.RaceSafe.setRoomState(room)
 *   window.RaceSafe.setPlayers(players)
 *   window.RaceSafe.onJudge(judge)
 *   window.RaceSafe.finishGame(detail)
 *   window.RaceSafe.render()
 *   window.RaceSafe.getState()
 * ========================================================= */

(() => {
  if (window.__GJ_RACE_SAFE_LOADED__) return;
  window.__GJ_RACE_SAFE_LOADED__ = true;

  const LS_KEYS = {
    devicePid: 'GJ_DEVICE_PID',
    selfPidGlobal: 'GJ_RACE_SELF_PID',
    selfNameGlobal: 'GJ_RACE_SELF_NAME',
    selfPidByRoomPrefix: 'GJ_RACE_SELF_BY_ROOM:',
    selfNameByRoomPrefix: 'GJ_RACE_SELF_NAME_BY_ROOM:',
    lastSummaryScoped: 'HHA_LAST_SUMMARY:goodjunk-race',
    lastSummaryGlobal: 'HHA_LAST_SUMMARY'
  };

  const REF = {
    hud: null,
    mode: null,
    room: null,
    score: null,
    time: null,
    miss: null,
    streak: null,
    resultMount: null
  };

  const BRIDGE = {
    started: false,
    timer: null,
    resultShown: false,
    wrapped: false
  };

  const STATE = {
    pid: '',
    name: '',
    roomId: '-',
    score: 0,
    miss: 0,
    bestStreak: 0,
    timeLeftSec: 0,
    players: [],
    room: null,
    ended: false,
    endedAt: '',
    endReason: ''
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function q(sel, root = document) {
    try { return root.querySelector(sel); } catch (_) { return null; }
  }

  function qa(sel, root = document) {
    try { return Array.from(root.querySelectorAll(sel)); } catch (_) { return []; }
  }

  function txt(v) {
    return String(v ?? '').trim();
  }

  function num(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function int(v, d = 0) {
    return Math.round(num(v, d));
  }

  function esc(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function qsGet(k, d = '') {
    try {
      return new URL(location.href).searchParams.get(k) ?? d;
    } catch (_) {
      return d;
    }
  }

  function parseNumText(v, d = 0) {
    const n = Number(String(v || '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : d;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function readText(key) {
    try {
      return txt(localStorage.getItem(key));
    } catch (_) {
      return '';
    }
  }

  function writeText(key, value) {
    try {
      localStorage.setItem(key, txt(value));
    } catch (_) {}
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function safeCall(fn, ...args) {
    try {
      if (typeof fn === 'function') return fn(...args);
    } catch (err) {
      console.warn('[race-safe] safeCall error:', err);
    }
    return undefined;
  }

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (_) {
      return '';
    }
  }

  function shortDateTime(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '-';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
    } catch (_) {
      return '-';
    }
  }

  function fmtClock(sec) {
    const s = Math.max(0, int(sec, 0));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
  }

  function devicePid() {
    try {
      let pid = localStorage.getItem(LS_KEYS.devicePid);
      if (!pid) {
        pid = `p-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(LS_KEYS.devicePid, pid);
      }
      return pid;
    } catch (_) {
      return `p-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function normalizePid(raw) {
    const v = txt(raw).replace(/[.#$[\]/]/g, '-');
    if (!v) return '';
    if (v.toLowerCase() === 'anon') return '';
    return v;
  }

  function normalizeName(raw) {
    return txt(raw).replace(/\s+/g, ' ').slice(0, 64);
  }

  function currentRoomId() {
    const raw = txt(
      STATE.roomId ||
      STATE.room?.roomId ||
      qsGet('roomId') ||
      qsGet('room') ||
      window.__RACE_ROOM__?.roomId ||
      window.raceRoom?.roomId ||
      window.roomState?.roomId ||
      window.state?.room?.roomId ||
      window.gameState?.room?.roomId
    );
    return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24) || '-';
  }

  function getSelfPid() {
    return normalizePid(
      window.RUN_CTX?.pid ||
      window.RUN_CTX?.playerPid ||
      window.__GJ_CTX?.pid ||
      window.__RACE_SELF_PID__ ||
      qsGet('pid') ||
      readText(LS_KEYS.selfPidGlobal) ||
      devicePid()
    );
  }

  function getSelfName() {
    return normalizeName(
      window.RUN_CTX?.name ||
      window.RUN_CTX?.nick ||
      window.__GJ_CTX?.name ||
      window.__RACE_SELF_NAME__ ||
      qsGet('name') ||
      readText(LS_KEYS.selfNameGlobal)
    );
  }

  function rememberSelfIdentity() {
    const roomId = currentRoomId();
    const pid = getSelfPid();
    const name = getSelfName();

    if (pid) {
      window.__RACE_SELF_PID__ = pid;
      writeText(LS_KEYS.selfPidGlobal, pid);
      if (roomId && roomId !== '-') {
        writeText(`${LS_KEYS.selfPidByRoomPrefix}${roomId}`, pid);
      }
    }

    if (name) {
      window.__RACE_SELF_NAME__ = name;
      writeText(LS_KEYS.selfNameGlobal, name);
      if (roomId && roomId !== '-') {
        writeText(`${LS_KEYS.selfNameByRoomPrefix}${roomId}`, name);
      }
    }
  }

  function gatherKnownSelfPidSet(roomId = '') {
    const set = new Set();
    [
      getSelfPid(),
      normalizePid(qsGet('pid')),
      normalizePid(window.RUN_CTX?.pid),
      normalizePid(window.RUN_CTX?.playerPid),
      normalizePid(window.__GJ_CTX?.pid),
      normalizePid(readText(LS_KEYS.selfPidGlobal)),
      normalizePid(devicePid()),
      roomId ? normalizePid(readText(`${LS_KEYS.selfPidByRoomPrefix}${roomId}`)) : ''
    ].forEach(v => { if (v) set.add(v); });
    return set;
  }

  function gatherKnownSelfNameSet(roomId = '') {
    const set = new Set();
    [
      getSelfName(),
      normalizeName(qsGet('name')),
      normalizeName(window.RUN_CTX?.name),
      normalizeName(window.RUN_CTX?.nick),
      normalizeName(window.__GJ_CTX?.name),
      normalizeName(readText(LS_KEYS.selfNameGlobal)),
      roomId ? normalizeName(readText(`${LS_KEYS.selfNameByRoomPrefix}${roomId}`)) : ''
    ].forEach(v => { if (v) set.add(v); });
    return set;
  }

  function normalizePlayers(input) {
    const arr = Array.isArray(input)
      ? input
      : Array.isArray(input?.players)
        ? input.players
        : Object.values(input?.players || {});

    return arr.map((p, idx) => ({
      pid: normalizePid(p?.pid || p?.playerId || p?.id || `p${idx + 1}`),
      name: normalizeName(p?.name || p?.nick || p?.playerName || p?.displayName || `Player ${idx + 1}`),
      score: int(p?.score, 0),
      miss: int(p?.miss ?? p?.misses, 0),
      bestStreak: int(p?.bestStreak ?? p?.comboMax ?? p?.streak, 0),
      ready: !!p?.ready,
      isHost: !!p?.isHost,
      raw: p || {}
    }));
  }

  function sortRacePlayers(players) {
    return [...players].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      return a.name.localeCompare(b.name, 'th');
    });
  }

  function resolveSelfPlayer(players, roomId = '') {
    const knownPids = gatherKnownSelfPidSet(roomId);
    const knownNames = gatherKnownSelfNameSet(roomId);

    let self = players.find(p => p.pid && knownPids.has(p.pid));
    if (self) return self;

    const matchedByName = players.filter(p => p.name && knownNames.has(p.name));
    if (matchedByName.length === 1) return matchedByName[0];

    return null;
  }

  function bindNodes() {
    REF.hud = byId('raceHud') || byId('hudRace') || byId('raceHUD');
    REF.mode = byId('raceModePill') || byId('raceModeValue');
    REF.room = byId('raceRoomPill') || byId('raceRoomValue');
    REF.score = byId('raceScoreValue') || byId('scoreValue');
    REF.time = byId('raceTimeValue') || byId('timeValue');
    REF.miss = byId('raceMissValue') || byId('missValue');
    REF.streak = byId('raceStreakValue') || byId('bestStreakValue');
    ensureResultMount();
  }

  function ensureResultMount() {
    let mount = byId('raceSafeResultMount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'raceSafeResultMount';
      mount.hidden = true;
      mount.style.position = 'fixed';
      mount.style.inset = '0';
      mount.style.zIndex = '1400';
      mount.style.alignItems = 'flex-end';
      mount.style.justifyContent = 'center';
      mount.style.padding = '12px';
      mount.style.background = 'rgba(2,6,23,.66)';
      mount.style.backdropFilter = 'blur(8px)';
      mount.style.display = 'none';
      document.body.appendChild(mount);
    }
    REF.resultMount = mount;
    return mount;
  }

  function setText(el, value) {
    if (el) el.textContent = String(value ?? '');
  }

  function recalcState() {
    STATE.pid = getSelfPid();
    STATE.name = getSelfName();
    STATE.roomId = currentRoomId();

    const players = normalizePlayers(STATE.players);
    if (players.length) {
      const sorted = sortRacePlayers(players);
      const self = resolveSelfPlayer(sorted, STATE.roomId);

      if (self) {
        STATE.score = self.score;
        STATE.miss = self.miss;
        STATE.bestStreak = self.bestStreak;
      } else {
        STATE.score = int(STATE.score, 0);
        STATE.miss = int(STATE.miss, 0);
        STATE.bestStreak = int(STATE.bestStreak, 0);
      }

      STATE.players = sorted;
    } else {
      STATE.score = int(STATE.score, 0);
      STATE.miss = int(STATE.miss, 0);
      STATE.bestStreak = int(STATE.bestStreak, 0);
      STATE.players = [];
    }

    window.__RACE_STATE__ = STATE;
    if (STATE.room) window.__RACE_ROOM__ = STATE.room;
  }

  function renderHud() {
    recalcState();

    if (REF.mode) setText(REF.mode, 'MODE race');
    if (REF.room) setText(REF.room, `ROOM ${STATE.roomId}`);
    if (REF.score) setText(REF.score, STATE.score);
    if (REF.time) setText(REF.time, fmtClock(STATE.timeLeftSec));
    if (REF.miss) setText(REF.miss, STATE.miss);
    if (REF.streak) setText(REF.streak, STATE.bestStreak);
  }

  function findExistingResultRoot() {
    return (
      q('#raceResultMount:not([hidden])') ||
      q('#raceResult:not([hidden])') ||
      q('.race-result-card') ||
      q('.race-result') ||
      q('[data-race-result]')
    );
  }

  function findResultTbody(root) {
    return (
      q('#raceResultTable tbody', root) ||
      q('.race-result-table tbody', root) ||
      q('[data-race-result-table] tbody', root) ||
      q('tbody', root)
    );
  }

  function findRankBadge(root) {
    return (
      q('#raceRankBadge', root) ||
      q('.race-rank-badge', root) ||
      q('[data-race-rank-badge]', root)
    );
  }

  function findResultSubtitle(root) {
    return (
      q('.race-result-sub', root) ||
      q('[data-race-result-sub]', root)
    );
  }

  function buildSummary() {
    recalcState();

    const players = sortRacePlayers(normalizePlayers(STATE.players));
    const self = resolveSelfPlayer(players, STATE.roomId);
    const selfIndex = self ? players.findIndex(p => p.pid === self.pid) : -1;
    const selfRank = selfIndex >= 0 ? selfIndex + 1 : null;

    return {
      game: 'goodjunk-race',
      mode: 'race',
      pid: getSelfPid(),
      name: getSelfName(),
      roomId: STATE.roomId,
      scoreFinal: STATE.score,
      missTotal: STATE.miss,
      comboMax: STATE.bestStreak,
      timeLeftSec: STATE.timeLeftSec,
      players,
      self,
      selfRank,
      selfKnown: !!self,
      endedAt: STATE.endedAt || nowIso(),
      endReason: STATE.endReason || 'finished',
      timestampIso: nowIso()
    };
  }

  function saveLastSummary(summary) {
    try {
      writeJSON(`${LS_KEYS.lastSummaryScoped}:${summary.pid}`, summary);
      writeJSON(LS_KEYS.lastSummaryGlobal, summary);
    } catch (_) {}
  }

  function renderRowsHTML(summary) {
    return summary.players.map((p, idx) => {
      const isMe = summary.self && p.pid === summary.self.pid;
      return `
        <tr class="${isMe ? 'me-row' : ''}">
          <td>
            <div style="font-weight:1100;line-height:1.1">${esc(p.name || p.pid || `Player ${idx + 1}`)}</div>
            ${p.pid ? `<div style="margin-top:4px;color:#94a3b8;font-size:12px;font-weight:900">${esc(p.pid)}</div>` : ''}
            ${isMe ? `<div style="margin-top:6px;color:#7dd3fc;font-size:12px;font-weight:1100">• คุณ</div>` : ''}
            <div style="margin-top:4px;color:#86efac;font-size:12px;font-weight:1100">รอบนี้จบแล้ว</div>
          </td>
          <td>${p.score}</td>
          <td>${p.miss}</td>
          <td>${p.bestStreak}</td>
        </tr>
      `;
    }).join('');
  }

  function patchExistingResultDOM(summary) {
    const root = findExistingResultRoot();
    if (!root) return false;

    const badge = findRankBadge(root);
    if (badge) {
      if (!summary.selfKnown || !summary.selfRank) {
        badge.textContent = 'อันดับ ?';
        badge.style.opacity = '.72';
      } else {
        badge.textContent = `อันดับ #${summary.selfRank}`;
        badge.style.opacity = '1';
      }
    }

    const sub = findResultSubtitle(root);
    if (sub) {
      sub.textContent = `ผลสุดท้าย • ผู้เล่นทั้งหมด ${summary.players.length} คน`;
    }

    const tbody = findResultTbody(root);
    if (tbody) {
      tbody.innerHTML = renderRowsHTML(summary);
    }

    return true;
  }

  function mountFallbackResult(summary) {
    const mount = ensureResultMount();
    if (!mount) return;

    mount.hidden = false;
    mount.style.display = 'flex';

    mount.innerHTML = `
      <div style="
        width:min(920px,100%);
        max-height:min(92vh,920px);
        overflow:auto;
        border-radius:28px;
        border:1px solid rgba(148,163,184,.18);
        background:linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.96));
        color:#f8fafc;
        box-shadow:0 24px 80px rgba(0,0,0,.42);
        padding:18px;
      ">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
          <div>
            <div style="font-size:24px;line-height:1.15;font-weight:1100;">🏁 Race Result</div>
            <div style="margin-top:6px;color:#94a3b8;font-size:13px;font-weight:900;line-height:1.45;">
              ROOM ${esc(summary.roomId)} • ${esc(shortDateTime(summary.endedAt))}
            </div>
          </div>
          <button id="raceSafeCloseBtn" type="button" style="
            min-width:44px;min-height:44px;padding:8px 12px;border-radius:14px;
            border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.04);
            color:#e5e7eb;font-weight:1100;cursor:pointer;">✕</button>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
          <div style="
            display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:18px;
            border:1px solid rgba(56,189,248,.24);background:rgba(56,189,248,.12);
            color:#7dd3fc;font-size:18px;font-weight:1100;">
            ${summary.selfKnown && summary.selfRank ? `อันดับ #${summary.selfRank}` : 'อันดับ ?'}
          </div>
          <div style="color:#94a3b8;font-size:13px;font-weight:900;">
            ระบบจัดอันดับจากคะแนนก่อน แล้วดู miss และ best streak
          </div>
        </div>

        <div style="
          border-radius:22px;border:1px solid rgba(148,163,184,.16);
          background:rgba(15,23,42,.66);padding:12px;">
          <div style="overflow:auto;-webkit-overflow-scrolling:touch;">
            <table style="width:100%;min-width:640px;border-collapse:separate;border-spacing:0 8px;">
              <thead>
                <tr>
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">ผู้เล่น</th>
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">คะแนน</th>
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">Miss</th>
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">Best Streak</th>
                </tr>
              </thead>
              <tbody>
                ${summary.players.map((p) => {
                  const isMe = summary.self && p.pid === summary.self.pid;
                  return `
                    <tr>
                      <td style="padding:12px 10px;background:${isMe ? 'rgba(30,41,59,.78)' : 'rgba(2,6,23,.42)'};${isMe ? 'outline:1px solid rgba(56,189,248,.26);' : ''}border-top-left-radius:14px;border-bottom-left-radius:14px;">
                        <div style="font-weight:1100;line-height:1.1">${esc(p.name || p.pid)}</div>
                        ${p.pid ? `<div style="margin-top:4px;color:#94a3b8;font-size:12px;font-weight:900">${esc(p.pid)}</div>` : ''}
                        ${isMe ? `<div style="margin-top:6px;color:#7dd3fc;font-size:12px;font-weight:1100">• คุณ</div>` : ''}
                        <div style="margin-top:4px;color:#86efac;font-size:12px;font-weight:1100">รอบนี้จบแล้ว</div>
                      </td>
                      <td style="padding:12px 10px;background:${isMe ? 'rgba(30,41,59,.78)' : 'rgba(2,6,23,.42)'};${isMe ? 'outline:1px solid rgba(56,189,248,.26);' : ''}">${p.score}</td>
                      <td style="padding:12px 10px;background:${isMe ? 'rgba(30,41,59,.78)' : 'rgba(2,6,23,.42)'};${isMe ? 'outline:1px solid rgba(56,189,248,.26);' : ''}">${p.miss}</td>
                      <td style="padding:12px 10px;background:${isMe ? 'rgba(30,41,59,.78)' : 'rgba(2,6,23,.42)'};${isMe ? 'outline:1px solid rgba(56,189,248,.26);' : ''}border-top-right-radius:14px;border-bottom-right-radius:14px;">${p.bestStreak}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
          <button id="raceSafeRematchBtn" type="button" style="
            min-width:140px;min-height:46px;padding:10px 14px;border-radius:16px;
            border:1px solid rgba(34,197,94,.28);background:rgba(34,197,94,.14);
            color:#f8fafc;font-weight:1100;cursor:pointer;">🔁 เล่นใหม่</button>

          <button id="raceSafeHubBtn" type="button" style="
            min-width:140px;min-height:46px;padding:10px 14px;border-radius:16px;
            border:1px solid rgba(59,130,246,.28);background:rgba(59,130,246,.14);
            color:#f8fafc;font-weight:1100;cursor:pointer;">🏠 กลับ HUB</button>

          <button id="raceSafeCloseBtn2" type="button" style="
            min-width:140px;min-height:46px;padding:10px 14px;border-radius:16px;
            border:1px solid rgba(167,139,250,.28);background:rgba(167,139,250,.14);
            color:#f8fafc;font-weight:1100;cursor:pointer;">✅ ปิด</button>
        </div>
      </div>
    `;

    const close = () => {
      mount.hidden = true;
      mount.style.display = 'none';
      mount.innerHTML = '';
    };

    byId('raceSafeCloseBtn')?.addEventListener('click', close);
    byId('raceSafeCloseBtn2')?.addEventListener('click', close);
    byId('raceSafeHubBtn')?.addEventListener('click', () => {
      location.href = qsGet('hub', '../hub.html');
    });
    byId('raceSafeRematchBtn')?.addEventListener('click', () => {
      const u = new URL(location.href);
      location.href = u.toString();
    });
  }

  function mergeState(patch = {}) {
    const src = patch || {};

    STATE.pid = normalizePid(src.pid ?? STATE.pid ?? getSelfPid());
    STATE.name = normalizeName(src.name ?? src.nick ?? STATE.name ?? getSelfName());
    STATE.roomId = txt(src.roomId ?? src.room ?? STATE.roomId ?? currentRoomId()) || '-';

    if (src.room && typeof src.room === 'object') {
      STATE.room = src.room;
    }

    STATE.score = int(src.score ?? src.myScore ?? STATE.score, 0);
    STATE.miss = int(src.miss ?? src.misses ?? STATE.miss, 0);
    STATE.bestStreak = int(src.bestStreak ?? src.comboMax ?? src.streak ?? STATE.bestStreak, 0);
    STATE.timeLeftSec = int(src.timeLeftSec ?? src.timeLeft ?? STATE.timeLeftSec, 0);

    if (Array.isArray(src.players)) {
      STATE.players = normalizePlayers(src.players);
    } else if (src.players && typeof src.players === 'object') {
      STATE.players = normalizePlayers(src.players);
    }

    STATE.ended = !!(src.ended ?? src.finished ?? src.isEnded ?? STATE.ended);
    STATE.endedAt = txt(src.endedAt ?? src.timestampIso ?? src.finishedAt ?? STATE.endedAt);
    STATE.endReason = txt(src.endReason ?? src.reason ?? STATE.endReason);

    window.__RACE_STATE__ = STATE;
    if (STATE.room) window.__RACE_ROOM__ = STATE.room;

    rememberSelfIdentity();
    recalcState();
  }

  function setRoomState(room) {
    if (!room || typeof room !== 'object') return;
    STATE.room = room;
    STATE.roomId = txt(room.roomId || room.id || STATE.roomId || '-');
    STATE.players = normalizePlayers(room.players || room);
    window.__RACE_ROOM__ = room;
    rememberSelfIdentity();
    renderHud();
  }

  function setPlayers(players) {
    STATE.players = normalizePlayers(players);
    rememberSelfIdentity();
    renderHud();
  }

  function onJudge(judge = {}) {
    if (judge.score != null) STATE.score = int(judge.score, STATE.score);
    if (judge.miss != null) STATE.miss = int(judge.miss, STATE.miss);
    if (judge.bestStreak != null) STATE.bestStreak = int(judge.bestStreak, STATE.bestStreak);
    renderHud();
  }

  function finishGame(detail = {}) {
    if (BRIDGE.resultShown) return;

    mergeState({
      ...detail,
      ended: true,
      endedAt: detail.endedAt || detail.timestampIso || nowIso(),
      endReason: detail.endReason || detail.reason || 'finished'
    });

    const summary = buildSummary();
    saveLastSummary(summary);

    const patchedExisting = patchExistingResultDOM(summary);
    if (!patchedExisting) {
      mountFallbackResult(summary);
    }

    BRIDGE.resultShown = true;
    STATE.ended = true;
    stopBridge();
  }

  function render() {
    renderHud();
    if (BRIDGE.resultShown) {
      patchExistingResultDOM(buildSummary());
    }
  }

  function getState() {
    return JSON.parse(JSON.stringify(STATE));
  }

  function readKnownGlobals() {
    const candidates = [
      window.state,
      window.gameState,
      window.__RACE_STATE__,
      window.RUN_CTX,
      window.__GJ_CTX
    ].filter(Boolean);

    for (const src of candidates) {
      if (src && typeof src === 'object') mergeState(src);
    }

    const roomCandidates = [
      window.__RACE_ROOM__,
      window.raceRoom,
      window.roomState,
      window.state?.room,
      window.gameState?.room
    ].filter(Boolean);

    for (const room of roomCandidates) {
      if (room && typeof room === 'object') {
        setRoomState(room);
        break;
      }
    }
  }

  function readLegacyDom() {
    const score =
      parseNumText(txt(q('#scoreValue')?.textContent)) ||
      parseNumText(txt(q('.score-value')?.textContent)) ||
      parseNumText(txt(q('[data-score]')?.textContent)) ||
      STATE.score;

    const miss =
      parseNumText(txt(q('#missValue')?.textContent)) ||
      parseNumText(txt(q('.miss-value')?.textContent)) ||
      parseNumText(txt(q('[data-miss]')?.textContent)) ||
      STATE.miss;

    const bestStreak =
      parseNumText(txt(q('#bestStreakValue')?.textContent)) ||
      parseNumText(txt(q('.best-streak-value')?.textContent)) ||
      parseNumText(txt(q('[data-best-streak]')?.textContent)) ||
      STATE.bestStreak;

    const timerText =
      txt(q('#timeValue')?.textContent) ||
      txt(q('.time-value')?.textContent) ||
      '';

    let timeLeftSec = STATE.timeLeftSec;
    if (timerText.includes(':')) {
      const parts = timerText.split(':').map(v => Number(v || 0));
      if (parts.length === 2) timeLeftSec = (parts[0] * 60) + parts[1];
    } else if (timerText) {
      timeLeftSec = parseNumText(timerText, STATE.timeLeftSec);
    }

    mergeState({ score, miss, bestStreak, timeLeftSec });
  }

  function tickTimeFromEndsAt() {
    const s = window.state || window.gameState || window.__RACE_STATE__ || {};
    const endsAtMs = num(s.endsAtMs || s.endAtMs || 0, 0);
    if (endsAtMs > 0 && !STATE.ended) {
      STATE.timeLeftSec = Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
    }
  }

  function bridgeLoop() {
    try {
      readKnownGlobals();
      readLegacyDom();
      tickTimeFromEndsAt();
      renderHud();

      const s = window.state || window.gameState || window.__RACE_STATE__ || {};
      const ended =
        !!STATE.ended ||
        !!s.isEnded ||
        !!s.ended ||
        !!s.finished ||
        !!s.showSummary ||
        !!s.showResult ||
        (num(s.endsAtMs || s.endAtMs || 0, 0) > 0 && Date.now() > num(s.endsAtMs || s.endAtMs || 0, 0) + 300);

      if (ended && !BRIDGE.resultShown) {
        finishGame({ reason: s.reason || 'finished' });
      }

      if (BRIDGE.resultShown) {
        patchExistingResultDOM(buildSummary());
      }
    } catch (err) {
      console.warn('[race-safe] bridgeLoop error:', err);
    }
  }

  function startBridge() {
    if (BRIDGE.started) return;
    BRIDGE.started = true;
    bridgeLoop();
    BRIDGE.timer = setInterval(bridgeLoop, 120);
  }

  function stopBridge() {
    if (BRIDGE.timer) {
      clearInterval(BRIDGE.timer);
      BRIDGE.timer = null;
    }
  }

  function wrapEndFunction(obj, key) {
    try {
      if (!obj || typeof obj[key] !== 'function') return false;
      if (obj[key].__raceWrapped) return true;

      const original = obj[key];
      const wrapped = function (...args) {
        const out = original.apply(this, args);
        try {
          finishGame({ reason: key });
        } catch (err) {
          console.warn(`[race-safe] wrapped end fn error for ${key}:`, err);
        }
        return out;
      };
      wrapped.__raceWrapped = true;
      wrapped.__raceOriginal = original;
      obj[key] = wrapped;
      return true;
    } catch (err) {
      console.warn(`[race-safe] wrapEndFunction failed for ${key}:`, err);
      return false;
    }
  }

  function installEndHooks() {
    if (BRIDGE.wrapped) return;
    BRIDGE.wrapped = true;

    const keys = [
      'showRaceResult',
      'openRaceResult',
      'renderRaceResult',
      'finishGame',
      'endGame',
      'showSummary',
      'showResult',
      'openResult'
    ];

    for (const key of keys) {
      wrapEndFunction(window, key);
    }
  }

  function installCustomEventHooks() {
    if (window.__RACE_SAFE_EVENTS_BOUND__) return;
    window.__RACE_SAFE_EVENTS_BOUND__ = true;

    const on = (name, fn) => window.addEventListener(name, (ev) => {
      try {
        fn(ev?.detail || {});
      } catch (err) {
        console.warn(`[race-safe] custom event ${name} error:`, err);
      }
    });

    on('race:update', detail => {
      mergeState(detail);
      renderHud();
    });

    on('race:room', detail => {
      setRoomState(detail);
    });

    on('race:players', detail => {
      setPlayers(detail.players || detail);
    });

    on('race:judge', detail => {
      onJudge(detail);
    });

    on('race:finish', detail => {
      finishGame(detail);
    });

    on('hha:race:update', detail => {
      mergeState(detail);
      renderHud();
    });

    on('hha:race:finish', detail => {
      finishGame(detail);
    });
  }

  function ensureBoot() {
    bindNodes();
    rememberSelfIdentity();
    installEndHooks();
    installCustomEventHooks();
    mergeState({
      pid: getSelfPid(),
      name: getSelfName(),
      roomId: currentRoomId()
    });
    renderHud();
    startBridge();
  }

  const API = {
    setState(patch) {
      mergeState(patch);
      renderHud();
    },
    setRoomState(room) {
      setRoomState(room);
    },
    setPlayers(players) {
      setPlayers(players);
    },
    onJudge(judge) {
      onJudge(judge);
    },
    finishGame(detail) {
      finishGame(detail);
    },
    render() {
      render();
    },
    getState() {
      return getState();
    }
  };

  window.RaceSafe = API;
  window.__RACE_STATE__ = STATE;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureBoot, { once: true });
  } else {
    ensureBoot();
  }
})();