(() => {
  'use strict';

  const W = window;
  const D = document;
  const qs = new URLSearchParams(location.search);

  const isRace = true;
  if (!isRace) return;

  const ROOT_PATH = 'hha-battle/groups/raceRooms';
  const ACTIVE_TTL_MS = 15000;

  const $ = (s, r = D) => r.querySelector(s);
  const now = () => Date.now();
  const num = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  const state = {
    db: null,
    roomRef: null,
    roomListener: null,
    roomCode: '',
    card: null,
    body: null,
    lastRenderedKey: ''
  };

  boot();

  async function boot() {
    try {
      injectStyles();
      mountCard();

      const fb = await ensureFirebaseCtx();
      state.db = fb.db;

      attachFromUi();
      setInterval(attachFromUi, 900);
    } catch (err) {
      console.warn('[Groups Race Lobby Winner Patch] boot failed:', safeErr(err));
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

  function mountCard() {
    const host =
      $('.players-card') ||
      $('.grid')?.parentElement ||
      $('.wrap') ||
      D.body;

    if (!host) return;

    const card = D.createElement('section');
    card.className = 'card hha-race-lobby-winner';
    card.innerHTML = `
      <div class="hha-race-lobby-winner__head">
        <h3 style="margin:0">ผลแข่งล่าสุด</h3>
        <div class="hha-race-lobby-winner__pill">🏁 Race ล่าสุด</div>
      </div>
      <div class="hha-race-lobby-winner__body">ยังไม่มีผลแข่งของห้องนี้</div>
    `;

    if ($('.players-card')) {
      $('.players-card').insertAdjacentElement('beforebegin', card);
    } else {
      host.appendChild(card);
    }

    state.card = card;
    state.body = $('.hha-race-lobby-winner__body', card);
  }

  function attachFromUi() {
    if (!state.db) return;

    const roomCode = cleanRoom(
      ($('#roomCodeOut')?.textContent || '').trim() ||
      ($('#roomCode')?.value || '').trim() ||
      qs.get('roomCode') ||
      qs.get('code') ||
      ''
    );

    if (!roomCode || roomCode === state.roomCode) return;
    state.roomCode = roomCode;

    if (state.roomRef && state.roomListener) {
      state.roomRef.off('value', state.roomListener);
    }

    state.roomRef = state.db.ref(`${ROOT_PATH}/${roomCode}`);
    state.roomListener = (snap) => renderRoom(snap.val() || null);
    state.roomRef.on('value', state.roomListener);
  }

  function renderRoom(room) {
    if (!state.body) return;

    if (!room) {
      state.body.innerHTML = `<div class="hha-race-lobby-winner__empty">ยังไม่พบข้อมูลห้องนี้</div>`;
      return;
    }

    const winner = room.raceLastWinner || null;
    const standings = Array.isArray(room.raceLastStandings) ? room.raceLastStandings : [];
    const active = getActivePlayers(room);
    const key = JSON.stringify({
      winner: winner ? [winner.playerId, winner.score, winner.accuracy, winner.miss, winner.streak] : null,
      standings: standings.map((p) => [p.playerId, p.score, p.accuracy, p.miss, p.streak]),
      active: active.map((p) => [p.playerId, p.name, p.active])
    });

    if (key === state.lastRenderedKey) return;
    state.lastRenderedKey = key;

    if (!winner) {
      state.body.innerHTML = `
        <div class="hha-race-lobby-winner__empty">ยังไม่มีผลแข่งของห้องนี้</div>
        ${active.length ? `
          <div class="hha-race-lobby-winner__active">
            ผู้เล่นในห้องตอนนี้: ${active.map((p) => escapeHtml(p.name)).join(' • ')}
          </div>
        ` : ''}
      `;
      return;
    }

    state.body.innerHTML = `
      <div class="hha-race-lobby-winner__hero">
        <div class="hha-race-lobby-winner__crown">👑</div>
        <div class="hha-race-lobby-winner__copy">
          <div class="hha-race-lobby-winner__eyebrow">แชมป์รอบล่าสุด</div>
          <div class="hha-race-lobby-winner__name">${escapeHtml(winner.name || 'Player')}</div>
          <div class="hha-race-lobby-winner__meta">
            SCORE ${num(winner.score)} · ACC ${num(winner.accuracy)}% · MISS ${num(winner.miss)} · STREAK ${num(winner.streak)}
          </div>
        </div>
      </div>

      <div class="hha-race-lobby-winner__board">
        ${(standings.length ? standings.slice(0, 5) : [winner]).map((p, idx) => `
          <div class="hha-race-lobby-winner__row ${idx === 0 ? 'is-top' : ''}">
            <div class="hha-race-lobby-winner__left">
              <div class="hha-race-lobby-winner__place">${idx + 1}</div>
              <div class="hha-race-lobby-winner__player">
                ${escapeHtml(p.name || 'Player')}
              </div>
            </div>
            <div class="hha-race-lobby-winner__right">
              <div class="hha-race-lobby-winner__score">${num(p.score)}</div>
              <div class="hha-race-lobby-winner__stat">ACC ${num(p.accuracy)}% · MISS ${num(p.miss)}</div>
            </div>
          </div>
        `).join('')}
      </div>

      ${active.length ? `
        <div class="hha-race-lobby-winner__active">
          ออนไลน์ตอนนี้: ${active.map((p) => `${escapeHtml(p.name)}${p.isHost ? ' (host)' : ''}`).join(' • ')}
        </div>
      ` : ''}
    `;
  }

  function getActivePlayers(room) {
    const map = room && room.players ? room.players : {};
    const t = now();

    return Object.keys(map).map((key) => {
      const p = map[key] || {};
      const lastSeen = num(p.lastSeen, 0);
      const active = p.presence !== 'left' && (t - lastSeen) <= ACTIVE_TTL_MS;
      return {
        playerId: String(p.playerId || key),
        name: cleanText(p.name || 'Player', 24),
        isHost: !!p.isHost || key === room.ownerPlayerId,
        active
      };
    }).filter((p) => p.active);
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
    style.id = 'hha-groups-race-lobby-winner-style';
    style.textContent = `
      .hha-race-lobby-winner{
        margin-top:16px;
      }

      .hha-race-lobby-winner__head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        flex-wrap:wrap;
        margin-bottom:12px;
      }

      .hha-race-lobby-winner__pill{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:30px;
        padding:6px 12px;
        border-radius:999px;
        background:rgba(255,198,77,.12);
        border:1px solid rgba(255,198,77,.24);
        color:#ffe7a3;
        font-size:.84rem;
        font-weight:900;
      }

      .hha-race-lobby-winner__hero{
        display:flex;
        align-items:center;
        gap:12px;
        padding:12px;
        border-radius:20px;
        background:linear-gradient(180deg, rgba(255,236,161,.12), rgba(255,255,255,.04));
        border:1px solid rgba(255,220,128,.16);
      }

      .hha-race-lobby-winner__crown{
        width:56px;
        height:56px;
        border-radius:18px;
        display:grid;
        place-items:center;
        font-size:1.8rem;
        background:linear-gradient(180deg,#ffe9a3,#ffc95f);
        box-shadow:0 10px 22px rgba(255,201,95,.18);
        flex:0 0 auto;
      }

      .hha-race-lobby-winner__eyebrow{
        font-size:.78rem;
        font-weight:900;
        color:#f5d57b;
      }

      .hha-race-lobby-winner__name{
        margin-top:3px;
        font-size:1.16rem;
        line-height:1.15;
        font-weight:900;
        color:#fff3c7;
      }

      .hha-race-lobby-winner__meta{
        margin-top:5px;
        color:#d9e8ff;
        font-weight:800;
        font-size:.86rem;
        line-height:1.45;
      }

      .hha-race-lobby-winner__board{
        display:grid;
        gap:8px;
        margin-top:12px;
      }

      .hha-race-lobby-winner__row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:10px 12px;
        border-radius:16px;
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.07);
      }

      .hha-race-lobby-winner__row.is-top{
        background:linear-gradient(180deg, rgba(255,231,156,.14), rgba(255,255,255,.05));
        border-color:rgba(255,214,116,.22);
      }

      .hha-race-lobby-winner__left{
        display:flex;
        align-items:center;
        gap:10px;
        min-width:0;
      }

      .hha-race-lobby-winner__place{
        width:34px;
        height:34px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:rgba(255,255,255,.08);
        color:#fff2c6;
        font-weight:900;
        flex:0 0 auto;
      }

      .hha-race-lobby-winner__player{
        font-weight:900;
        color:#eef4ff;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .hha-race-lobby-winner__right{
        text-align:right;
        flex:0 0 auto;
      }

      .hha-race-lobby-winner__score{
        font-size:1.05rem;
        font-weight:900;
        color:#ffffff;
      }

      .hha-race-lobby-winner__stat{
        margin-top:2px;
        color:#b9c8e8;
        font-size:.74rem;
        font-weight:800;
        white-space:nowrap;
      }

      .hha-race-lobby-winner__active{
        margin-top:10px;
        color:#b9c8e8;
        font-size:.84rem;
        line-height:1.5;
        font-weight:700;
      }

      .hha-race-lobby-winner__empty{
        padding:12px;
        border-radius:16px;
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.06);
        color:#c8d6f2;
        font-weight:800;
      }

      @media (max-width: 900px){
        .hha-race-lobby-winner__hero{
          align-items:flex-start;
        }

        .hha-race-lobby-winner__row{
          align-items:flex-start;
          flex-direction:column;
        }

        .hha-race-lobby-winner__right{
          text-align:left;
        }

        .hha-race-lobby-winner__stat{
          white-space:normal;
        }
      }
    `;
    D.head.appendChild(style);
  }
})();
