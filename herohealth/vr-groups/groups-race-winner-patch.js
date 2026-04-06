(() => {
  'use strict';

  const W = window;
  const D = document;
  const qs = new URLSearchParams(location.search);

  const isRace = qs.get('mode') === 'race' || qs.get('race') === '1';
  const roomCode = cleanRoom(qs.get('roomCode') || qs.get('code') || '');
  if (!isRace || !roomCode) return;

  const ROOT_PATH = 'hha-battle/groups/raceRooms';
  const ACTIVE_TTL_MS = 15000;

  const now = () => Date.now();
  const num = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  const state = {
    db: null,
    roomRef: null,
    room: null,
    roomListener: null,
    playerId: getPlayerId(),
    isHost: qs.get('isHost') === '1',
    summarySeen: false,
    writing: false,
    lastSignature: '',
    lastWinnerBannerKey: '',
    playerName: cleanText(
      qs.get('name') ||
      qs.get('nickName') ||
      qs.get('nick') ||
      'Player',
      24
    ),
    observer: null
  };

  boot();

  async function boot() {
    try {
      injectStyles();
      const fb = await ensureFirebaseCtx();
      state.db = fb.db;
      state.roomRef = state.db.ref(`${ROOT_PATH}/${roomCode}`);
      attachRoom();
      observeSummary();
      setInterval(tickFinalize, 900);
      setInterval(renderWinnerBanner, 700);
    } catch (err) {
      console.warn('[Groups Race Winner Patch] boot failed:', safeErr(err));
    }
  }

  async function ensureFirebaseCtx() {
    if (W.HHA_FIREBASE && W.HHA_FIREBASE.ready && W.HHA_FIREBASE.db) {
      return W.HHA_FIREBASE;
    }

    if (W.HHA_FIREBASE_READY && typeof W.HHA_FIREBASE_READY.then === 'function') {
      const ctx = await W.HHA_FIREBASE_READY;
      if (ctx && ctx.db) return ctx;
    }

    if (!W.firebase) throw new Error('Firebase SDK not loaded');

    const cfg =
      W.HHA_FIREBASE_CONFIG ||
      W.HEROHEALTH_FIREBASE_CONFIG ||
      W.FIREBASE_CONFIG ||
      W.__firebaseConfig;

    if (!cfg || !cfg.apiKey || !cfg.projectId || !cfg.databaseURL) {
      throw new Error('Missing Firebase config');
    }

    let app;
    try {
      app = (firebase.apps && firebase.apps.length)
        ? firebase.app()
        : firebase.initializeApp(cfg);
    } catch (err) {
      if (firebase.apps && firebase.apps.length) app = firebase.app();
      else throw err;
    }

    const auth = firebase.auth ? firebase.auth() : null;
    const db = firebase.database ? firebase.database() : null;

    if (auth && !auth.currentUser && auth.signInAnonymously) {
      try { await auth.signInAnonymously(); } catch (_) {}
    }

    const ctx = { app, auth, db, config: cfg, ready: true };
    W.HHA_FIREBASE = ctx;
    return ctx;
  }

  function attachRoom() {
    if (!state.roomRef) return;

    state.roomListener = (snap) => {
      state.room = snap.val() || null;
      renderWinnerBanner();
    };

    state.roomRef.on('value', state.roomListener);
  }

  function observeSummary() {
    if (state.observer) {
      try { state.observer.disconnect(); } catch (_) {}
    }

    state.observer = new MutationObserver(() => {
      if (findVisibleSummary()) state.summarySeen = true;
      renderWinnerBanner();
    });

    state.observer.observe(D.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    if (findVisibleSummary()) state.summarySeen = true;
  }

  async function tickFinalize() {
    const room = state.room;
    if (!room || !state.roomRef || state.writing) return;

    const players = getPlayers(room);
    if (players.length < 2) return;

    const endedEnough =
      room.status === 'ended' ||
      state.summarySeen ||
      players.every((p) => p.finished || !p.active);

    if (!endedEnough) return;

    const standings = players
      .sort(comparePlayers)
      .map((p, idx) => ({
        place: idx + 1,
        playerId: p.playerId,
        name: p.name,
        score: p.score,
        accuracy: p.accuracy,
        miss: p.miss,
        streak: p.streak,
        finishedAt: p.finishedAt,
        active: p.active,
        isHost: p.isHost
      }));

    if (!standings.length) return;

    const winner = standings[0];
    const signature = JSON.stringify({
      winner: [winner.playerId, winner.score, winner.accuracy, winner.miss, winner.streak],
      top3: standings.slice(0, 3).map((p) => [p.playerId, p.score, p.accuracy, p.miss, p.streak]),
      status: room.status || ''
    });

    if (signature === state.lastSignature) return;
    state.lastSignature = signature;

    const mayWrite =
      state.isHost ||
      String(room.ownerPlayerId || '') === String(state.playerId) ||
      !room.raceLastWinner ||
      !room.raceLastEndedAt;

    if (!mayWrite) return;

    state.writing = true;
    try {
      const endedAt = now();
      const update = {
        raceLastEndedAt: endedAt,
        raceLastWinner: {
          playerId: winner.playerId,
          name: winner.name,
          score: winner.score,
          accuracy: winner.accuracy,
          miss: winner.miss,
          streak: winner.streak,
          place: 1,
          roomCode,
          updatedAt: endedAt
        },
        raceLastStandings: standings.slice(0, 8),
        updatedAt: endedAt
      };

      if (room.status !== 'ended') {
        update.status = 'ended';
        update.endedAt = endedAt;
      }

      await state.roomRef.update(update);
    } catch (err) {
      console.warn('[Groups Race Winner Patch] finalize failed:', safeErr(err));
    } finally {
      state.writing = false;
    }
  }

  function renderWinnerBanner() {
    const room = state.room;
    if (!room || !room.raceLastWinner) return;

    const winner = room.raceLastWinner;
    const standings = Array.isArray(room.raceLastStandings) ? room.raceLastStandings : [];
    const myPlace = standings.findIndex((p) => String(p.playerId) === String(state.playerId)) + 1;
    const isMeWinner = String(winner.playerId || '') === String(state.playerId || '');

    const key = JSON.stringify({
      winner: [winner.playerId, winner.name, winner.score, winner.accuracy, winner.miss, winner.streak],
      myPlace
    });

    if (key === state.lastWinnerBannerKey && D.querySelector('.hha-race-winner-banner')) return;
    state.lastWinnerBannerKey = key;

    let mount = D.querySelector('.hha-race-winner-banner');
    if (!mount) {
      mount = D.createElement('div');
      mount.className = 'hha-race-winner-banner';
      D.body.appendChild(mount);
    }

    mount.innerHTML = `
      <div class="hha-race-winner-banner__left">
        <div class="hha-race-winner-banner__icon">${isMeWinner ? '🏆' : '👑'}</div>
        <div class="hha-race-winner-banner__copy">
          <div class="hha-race-winner-banner__eyebrow">ผลแข่งล่าสุด</div>
          <div class="hha-race-winner-banner__title">
            ${isMeWinner ? 'คุณชนะรอบนี้!' : `ผู้ชนะคือ ${escapeHtml(winner.name || 'Player')}`}
          </div>
          <div class="hha-race-winner-banner__sub">
            SCORE ${num(winner.score)} · ACC ${num(winner.accuracy)}% · MISS ${num(winner.miss)} · STREAK ${num(winner.streak)}
            ${myPlace ? ` • อันดับคุณ ${myPlace}` : ''}
          </div>
        </div>
      </div>
      <button type="button" class="hha-race-winner-banner__close" aria-label="ปิด">✕</button>
    `;

    const closeBtn = mount.querySelector('.hha-race-winner-banner__close');
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = '1';
      closeBtn.addEventListener('click', () => {
        mount.classList.add('is-hidden');
      });
    }

    mount.classList.remove('is-hidden');
  }

  function findVisibleSummary() {
    const candidates = D.querySelectorAll(
      '.summary, .summary-card, .result-overlay, .end-overlay, .final-summary, [data-summary], [data-role="summary"], #summaryOverlay'
    );
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width > 120 && r.height > 80 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0') {
        return el;
      }
    }
    return null;
  }

  function getPlayers(room) {
    const map = room && room.players ? room.players : {};
    const t = now();

    return Object.keys(map).map((key) => {
      const p = map[key] || {};
      const live = p.live || {};
      const result = p.result || {};
      const lastSeen = num(p.lastSeen, 0);
      const active = p.presence !== 'left' && (t - lastSeen) <= ACTIVE_TTL_MS;

      return {
        playerId: String(p.playerId || key),
        name: cleanText(p.name || 'Player', 24),
        isHost: !!p.isHost || key === room.ownerPlayerId,
        active,
        finished: p.presence === 'finished' || !!p.finishedAt || room.status === 'ended',
        finishedAt: num(p.finishedAt, 0),
        score: num(result.score, num(live.score, 0)),
        accuracy: num(result.accuracy, num(live.accuracy, 0)),
        miss: num(result.miss, num(live.miss, 0)),
        streak: num(result.streak, num(live.streak, 0))
      };
    });
  }

  function comparePlayers(a, b) {
    if (num(b.score) !== num(a.score)) return num(b.score) - num(a.score);
    if (num(b.accuracy) !== num(a.accuracy)) return num(b.accuracy) - num(a.accuracy);
    if (num(a.miss) !== num(b.miss)) return num(a.miss) - num(b.miss);
    if (num(b.streak) !== num(a.streak)) return num(b.streak) - num(a.streak);
    return num(a.finishedAt, 0) - num(b.finishedAt, 0);
  }

  function getPlayerId() {
    try {
      const saved = localStorage.getItem('HHA_GROUPS_PLAYER_ID');
      if (saved) return saved;
    } catch (_) {}
    return cleanText(qs.get('playerId') || `grp_${Math.random().toString(36).slice(2, 10)}`, 40).toUpperCase();
  }

  function cleanRoom(v) {
    return String(v == null ? '' : v)
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16);
  }

  function cleanText(v, max = 24) {
    return String(v == null ? '' : v)
      .replace(/[^\wก-๙ _-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function safeErr(err) {
    return err && err.message ? err.message : String(err || 'Unknown error');
  }

  function injectStyles() {
    const style = D.createElement('style');
    style.id = 'hha-groups-race-winner-patch-style';
    style.textContent = `
      .hha-race-winner-banner{
        position:fixed;
        left:12px;
        right:12px;
        top:12px;
        z-index:70;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:12px 14px;
        border-radius:20px;
        background:rgba(255,255,255,.95);
        border:1px solid rgba(228,197,103,.26);
        box-shadow:0 16px 36px rgba(80,103,126,.18);
        backdrop-filter:blur(8px);
      }

      .hha-race-winner-banner.is-hidden{
        display:none;
      }

      .hha-race-winner-banner__left{
        min-width:0;
        display:flex;
        align-items:center;
        gap:12px;
      }

      .hha-race-winner-banner__icon{
        width:52px;
        height:52px;
        border-radius:16px;
        display:grid;
        place-items:center;
        font-size:1.65rem;
        background:linear-gradient(180deg,#fff3bc,#ffe08d);
        box-shadow:0 8px 18px rgba(201,156,36,.18);
        flex:0 0 auto;
      }

      .hha-race-winner-banner__eyebrow{
        font-size:.76rem;
        font-weight:900;
        color:#9a7a18;
      }

      .hha-race-winner-banner__title{
        margin-top:2px;
        font-size:1.02rem;
        line-height:1.2;
        font-weight:900;
        color:#54410a;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .hha-race-winner-banner__sub{
        margin-top:3px;
        color:#6d7f8d;
        font-size:.8rem;
        line-height:1.4;
        font-weight:800;
      }

      .hha-race-winner-banner__close{
        appearance:none;
        border:none;
        width:40px;
        height:40px;
        border-radius:12px;
        cursor:pointer;
        background:rgba(124,166,206,.10);
        color:#5a7388;
        font-size:1rem;
        font-weight:900;
        flex:0 0 auto;
      }

      @media (max-width: 900px){
        .hha-race-winner-banner{
          top:auto;
          bottom:12px;
          align-items:flex-start;
        }

        .hha-race-winner-banner__title{
          white-space:normal;
        }
      }
    `;
    D.head.appendChild(style);
  }
})();