(() => {
  'use strict';

  const W = window;
  const D = document;
  const qs = new URLSearchParams(location.search);

  const isRace = qs.get('mode') === 'race' || qs.get('race') === '1';
  const roomCode = cleanRoom(qs.get('roomCode') || '');
  if (!isRace || !roomCode) return;

  const ROOT_PATH = 'hha-battle/groups/raceRooms';
  const ACTIVE_TTL_MS = 15000;

  const $ = (s, r = D) => r.querySelector(s);
  const $$ = (s, r = D) => Array.from(r.querySelectorAll(s));
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
    playerName: cleanText(
      qs.get('name') ||
      qs.get('nickName') ||
      qs.get('nick') ||
      'Player',
      24
    ),
    isHost: qs.get('isHost') === '1',
    hub: qs.get('hub') || 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html',
    summaryObserver: null,
    mounted: false,
    redirecting: false,
    rematchTokenSeen: ''
  };

  boot();

  async function boot() {
    injectStyles();

    try {
      const fb = await ensureFirebaseCtx();
      state.db = fb.db;
      state.roomRef = state.db.ref(`${ROOT_PATH}/${roomCode}`);
      attachRoom();
      watchSummary();
      setInterval(ensureSummaryPanel, 500);
    } catch (err) {
      console.warn('[Groups Race End Patch] boot failed:', safeErr(err));
      watchSummary();
      setInterval(ensureSummaryPanel, 700);
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

    if (!W.firebase) {
      throw new Error('Firebase SDK not loaded');
    }

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
      if (firebase.apps && firebase.apps.length) {
        app = firebase.app();
      } else {
        throw err;
      }
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
      ensureSummaryPanel();
      maybeFollowRematch();
    };

    state.roomRef.on('value', state.roomListener);
  }

  function watchSummary() {
    if (state.summaryObserver) {
      try { state.summaryObserver.disconnect(); } catch (_) {}
    }

    state.summaryObserver = new MutationObserver(() => {
      ensureSummaryPanel();
      maybeFollowRematch();
    });

    state.summaryObserver.observe(D.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  function ensureSummaryPanel() {
    const summary = findVisibleSummary();
    if (!summary) return;

    let mount = $('.hha-race-final', summary);
    if (!mount) {
      mount = D.createElement('section');
      mount.className = 'hha-race-final';
      summary.appendChild(mount);
    }

    const players = getPlayers(state.room);
    const finals = players.sort(comparePlayers);

    const winner = finals[0] || null;
    const me = finals.find((p) => p.playerId === state.playerId) || null;
    const myPlace = me ? finals.findIndex((p) => p.playerId === state.playerId) + 1 : 0;
    const canRematch = !!state.room;
    const rematchHint = state.isHost
      ? 'กดรีแมตช์เพื่อพาทุกคนกลับไปเข้าห้องเดิม'
      : 'รอเจ้าของห้องกดรีแมตช์ หรือกลับไปที่ล็อบบี้ได้เลย';

    mount.innerHTML = `
      <div class="hha-race-final__hero">
        <div class="hha-race-final__icon">${placeEmoji(myPlace || 9)}</div>
        <div class="hha-race-final__copy">
          <div class="hha-race-final__eyebrow">🏁 Groups Race Result</div>
          <h3 class="hha-race-final__title">
            ${winner ? `ผู้ชนะคือ ${escapeHtml(winner.name)}` : 'สรุปผลการแข่งขัน'}
          </h3>
          <p class="hha-race-final__sub">
            ${me
              ? `อันดับของคุณ: ${myPlace} • คะแนน ${me.result.score} • ความแม่นยำ ${me.result.accuracy}%`
              : 'แสดงอันดับผู้เล่นจากผลแข่งล่าสุด'}
          </p>
        </div>
      </div>

      <div class="hha-race-final__board">
        ${finals.length ? finals.slice(0, 6).map((p, idx) => `
          <div class="hha-race-final__row ${p.playerId === state.playerId ? 'is-you' : ''}">
            <div class="hha-race-final__left">
              <div class="hha-race-final__place">${idx + 1}</div>
              <div class="hha-race-final__meta">
                <div class="hha-race-final__name">${escapeHtml(p.name)}</div>
                <div class="hha-race-final__tags">
                  ${idx === 0 ? '<span class="hha-race-final__tag gold">Winner</span>' : ''}
                  ${p.playerId === state.playerId ? '<span class="hha-race-final__tag you">คุณ</span>' : ''}
                  ${p.isHost ? '<span class="hha-race-final__tag host">Host</span>' : ''}
                  ${p.active ? '<span class="hha-race-final__tag live">ออนไลน์</span>' : '<span class="hha-race-final__tag off">ออฟไลน์</span>'}
                </div>
              </div>
            </div>
            <div class="hha-race-final__right">
              <div class="hha-race-final__score">${p.result.score}</div>
              <div class="hha-race-final__stat">
                ACC ${p.result.accuracy}% · MISS ${p.result.miss} · STREAK ${p.result.streak}
              </div>
            </div>
          </div>
        `).join('') : `
          <div class="hha-race-final__empty">ยังไม่มีข้อมูลจัดอันดับจากห้องแข่ง</div>
        `}
      </div>

      <div class="hha-race-final__actions">
        <button type="button" class="hha-race-final__btn replay" data-race-action="replay">🔁 เล่นใหม่หน้านี้</button>
        <button type="button" class="hha-race-final__btn rematch" data-race-action="rematch" ${canRematch ? '' : 'disabled'}>🏁 รีแมตช์</button>
        <button type="button" class="hha-race-final__btn hub" data-race-action="hub">🏠 กลับ HUB</button>
      </div>

      <div class="hha-race-final__hint">${escapeHtml(rematchHint)}</div>
    `;

    bindSummaryButtons(mount);
    state.mounted = true;
  }

  function bindSummaryButtons(root) {
    const replay = $('[data-race-action="replay"]', root);
    const rematch = $('[data-race-action="rematch"]', root);
    const hub = $('[data-race-action="hub"]', root);

    if (replay && !replay.dataset.bound) {
      replay.dataset.bound = '1';
      replay.addEventListener('click', () => {
        const url = new URL(location.href);
        url.searchParams.set('seed', String(Date.now()));
        location.href = url.toString();
      });
    }

    if (rematch && !rematch.dataset.bound) {
      rematch.dataset.bound = '1';
      rematch.addEventListener('click', onRematch);
    }

    if (hub && !hub.dataset.bound) {
      hub.dataset.bound = '1';
      hub.addEventListener('click', () => {
        location.href = state.hub;
      });
    }
  }

  async function onRematch() {
    if (state.redirecting) return;

    const btns = $$('[data-race-action="rematch"]');
    btns.forEach((b) => {
      b.disabled = true;
      b.textContent = state.isHost ? 'กำลังเปิดรีแมตช์...' : 'กำลังกลับไปล็อบบี้...';
    });

    try {
      if (state.roomRef && state.room && state.isHost) {
        const token = `rm_${Date.now()}`;
        const room = state.room;
        const playersMap = room.players || {};
        const updates = {
          status: 'rematch',
          rematchToken: token,
          rematchRequestedAt: now(),
          rematchBy: state.playerId,
          updatedAt: now()
        };

        Object.keys(playersMap).forEach((key) => {
          updates[`players/${key}/presence`] = 'lobby';
          updates[`players/${key}/live`] = null;
          updates[`players/${key}/result`] = null;
          updates[`players/${key}/finishedAt`] = null;
          updates[`players/${key}/lastSeen`] = now();
        });

        await state.roomRef.update(updates);
        state.rematchTokenSeen = token;
      }
    } catch (err) {
      console.warn('[Groups Race End Patch] rematch update failed:', safeErr(err));
    }

    goLobbyForRematch();
  }

  function maybeFollowRematch() {
    if (state.redirecting || !state.room) return;
    const token = String(state.room.rematchToken || '');
    if (!token) return;
    if (state.room.status !== 'rematch') return;
    if (token === state.rematchTokenSeen && state.redirecting) return;
    state.rematchTokenSeen = token;
    goLobbyForRematch();
  }

  function goLobbyForRematch() {
    if (state.redirecting) return;
    state.redirecting = true;

    const lobby = new URL('./groups-race-lobby.html', location.href);
    for (const [k, v] of qs.entries()) {
      lobby.searchParams.set(k, v);
    }

    lobby.searchParams.set('mode', 'race');
    lobby.searchParams.set('race', '1');
    lobby.searchParams.set('roomCode', roomCode);
    lobby.searchParams.set('code', roomCode);
    lobby.searchParams.set('name', state.playerName);
    lobby.searchParams.set('hub', state.hub);

    if (state.room) {
      lobby.searchParams.set('diff', state.room.diff || qs.get('diff') || 'normal');
      lobby.searchParams.set('timeSec', String(state.room.timeSec || qs.get('timeSec') || qs.get('time') || 60));
      lobby.searchParams.set('time', String(state.room.timeSec || qs.get('time') || 60));
    }

    setTimeout(() => {
      location.href = lobby.toString();
    }, 600);
  }

  function findVisibleSummary() {
    const candidates = $$('.summary, .summary-card, .result-overlay, .end-overlay, .final-summary, [data-summary], [data-role="summary"]');
    return candidates.find((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 120 && r.height > 80 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    }) || null;
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

      const score = num(result.score, num(live.score, 0));
      const accuracy = num(result.accuracy, num(live.accuracy, 0));
      const miss = num(result.miss, num(live.miss, 0));
      const streak = num(result.streak, num(live.streak, 0));

      return {
        playerId: String(p.playerId || key),
        name: cleanText(p.name || 'Player', 24),
        isHost: !!p.isHost || key === room?.ownerPlayerId,
        active,
        finishedAt: num(p.finishedAt, 0),
        result: {
          score,
          accuracy,
          miss,
          streak
        }
      };
    });
  }

  function comparePlayers(a, b) {
    if (num(b.result.score) !== num(a.result.score)) return num(b.result.score) - num(a.result.score);
    if (num(b.result.accuracy) !== num(a.result.accuracy)) return num(b.result.accuracy) - num(a.result.accuracy);
    if (num(a.result.miss) !== num(b.result.miss)) return num(a.result.miss) - num(b.result.miss);
    if (num(b.result.streak) !== num(a.result.streak)) return num(b.result.streak) - num(a.result.streak);
    return num(a.finishedAt, 0) - num(b.finishedAt, 0);
  }

  function placeEmoji(place) {
    if (place === 1) return '🥇';
    if (place === 2) return '🥈';
    if (place === 3) return '🥉';
    return '🏁';
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
    style.id = 'hha-groups-race-end-patch-style';
    style.textContent = `
      .hha-race-final{
        margin-top:14px;
        padding:14px;
        border-radius:22px;
        background:linear-gradient(180deg, rgba(255,248,229,.96), rgba(255,255,255,.96));
        border:1px solid rgba(232,201,118,.35);
        box-shadow:0 12px 28px rgba(183,145,52,.10);
      }

      .hha-race-final__hero{
        display:flex;
        align-items:center;
        gap:12px;
        margin-bottom:12px;
      }

      .hha-race-final__icon{
        width:58px;
        height:58px;
        border-radius:18px;
        display:grid;
        place-items:center;
        font-size:1.8rem;
        background:linear-gradient(180deg, #fff3bc, #ffe08d);
        box-shadow:0 8px 18px rgba(201,156,36,.18);
        flex:0 0 auto;
      }

      .hha-race-final__eyebrow{
        font-size:.78rem;
        font-weight:900;
        color:#9a7a18;
        margin-bottom:2px;
      }

      .hha-race-final__title{
        margin:0;
        font-size:1.12rem;
        line-height:1.2;
        color:#674b0a;
      }

      .hha-race-final__sub{
        margin:4px 0 0;
        color:#816a29;
        font-weight:700;
        font-size:.9rem;
        line-height:1.4;
      }

      .hha-race-final__board{
        display:grid;
        gap:8px;
      }

      .hha-race-final__row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:10px 12px;
        border-radius:16px;
        background:rgba(255,255,255,.85);
        border:1px solid rgba(226,201,126,.22);
      }

      .hha-race-final__row.is-you{
        background:linear-gradient(180deg, rgba(224,244,255,.96), rgba(241,250,255,.96));
        border-color:rgba(100,180,230,.30);
      }

      .hha-race-final__left{
        display:flex;
        align-items:center;
        gap:10px;
        min-width:0;
      }

      .hha-race-final__place{
        width:34px;
        height:34px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:#fff;
        border:1px solid rgba(228,197,103,.28);
        color:#8d6c11;
        font-weight:900;
        flex:0 0 auto;
      }

      .hha-race-final__meta{ min-width:0; }

      .hha-race-final__name{
        font-weight:900;
        color:#4a6173;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .hha-race-final__tags{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin-top:4px;
      }

      .hha-race-final__tag{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:24px;
        padding:4px 8px;
        border-radius:999px;
        font-size:.72rem;
        font-weight:900;
      }

      .hha-race-final__tag.gold{ background:#fff1bd; color:#7f5c00; }
      .hha-race-final__tag.you{ background:#d8f0ff; color:#12607f; }
      .hha-race-final__tag.host{ background:#def8d7; color:#2d6c24; }
      .hha-race-final__tag.live{ background:#eef6ff; color:#426b93; }
      .hha-race-final__tag.off{ background:#ffeaea; color:#8a4646; }

      .hha-race-final__right{
        text-align:right;
        flex:0 0 auto;
      }

      .hha-race-final__score{
        font-size:1.15rem;
        line-height:1.1;
        font-weight:900;
        color:#455f72;
      }

      .hha-race-final__stat{
        margin-top:3px;
        font-size:.75rem;
        color:#7a8fa0;
        font-weight:800;
        white-space:nowrap;
      }

      .hha-race-final__actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:14px;
      }

      .hha-race-final__btn{
        appearance:none;
        border:none;
        min-height:46px;
        padding:12px 14px;
        border-radius:16px;
        font-weight:900;
        cursor:pointer;
        color:#fff;
      }

      .hha-race-final__btn.replay{
        background:linear-gradient(180deg,#f5a04f,#eb7a30);
      }

      .hha-race-final__btn.rematch{
        background:linear-gradient(180deg,#66c7ff,#3399ff);
      }

      .hha-race-final__btn.hub{
        background:linear-gradient(180deg,#86b7ff,#6294f0);
      }

      .hha-race-final__btn[disabled]{
        opacity:.6;
        cursor:not-allowed;
      }

      .hha-race-final__hint{
        margin-top:10px;
        color:#8a7433;
        font-size:.84rem;
        line-height:1.45;
        font-weight:700;
      }

      .hha-race-final__empty{
        padding:12px;
        border-radius:16px;
        background:rgba(255,255,255,.76);
        color:#7c8c98;
        font-weight:800;
      }

      @media (max-width: 900px){
        .hha-race-final{
          padding:12px;
          border-radius:18px;
        }

        .hha-race-final__hero{
          align-items:flex-start;
        }

        .hha-race-final__actions{
          flex-direction:column;
        }

        .hha-race-final__btn{
          width:100%;
        }

        .hha-race-final__row{
          align-items:flex-start;
          flex-direction:column;
        }

        .hha-race-final__right{
          text-align:left;
        }

        .hha-race-final__stat{
          white-space:normal;
        }
      }
    `;
    D.head.appendChild(style);
  }
})();