(() => {
  'use strict';

  const W = window;
  const D = document;
  const qs = new URLSearchParams(location.search);

  const isRace = qs.get('mode') === 'race' || qs.get('race') === '1';
  const roomCode = cleanRoom(qs.get('roomCode') || '');
  if (!isRace || !roomCode) return;

  const ROOT_PATH = 'hha-battle/groups/raceRooms';
  const PUSH_MS = 700;
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
    roomListener: null,
    pushTimer: 0,
    endTimer: 0,
    playerId: getPlayerId(),
    pid: cleanText(qs.get('pid') || 'anon', 48),
    playerName: cleanText(
      qs.get('name') ||
      qs.get('nickName') ||
      qs.get('nick') ||
      'Player',
      24
    ),
    isHost: qs.get('isHost') === '1',
    room: null,
    ui: null,
    ended: false,
    lastPayloadHash: '',
    mount: null
  };

  boot();

  async function boot() {
    try {
      const fb = await ensureFirebaseCtx();
      state.db = fb.db;
      state.roomRef = state.db.ref(`${ROOT_PATH}/${roomCode}`);

      injectStyles();
      createFloatingBoard();
      attachRoom();
      startPushLoop();
      startEndWatcher();
    } catch (err) {
      console.warn('[Groups Race Sync Patch] boot failed:', safeErr(err));
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

  function createFloatingBoard() {
    const box = D.createElement('aside');
    box.className = 'hha-race-rank';
    box.innerHTML = `
      <div class="hha-race-rank__head">
        <div class="hha-race-rank__title">🏁 Race สด</div>
        <div class="hha-race-rank__room">${escapeHtml(roomCode)}</div>
      </div>
      <div class="hha-race-rank__body">
        <div class="hha-race-rank__empty">กำลังเชื่อมต่อห้องแข่ง...</div>
      </div>
    `;
    D.body.appendChild(box);
    state.mount = box;
  }

  function attachRoom() {
    if (!state.roomRef) return;

    state.roomListener = (snap) => {
      state.room = snap.val() || null;
      renderBoard();
    };

    state.roomRef.on('value', state.roomListener);
  }

  function startPushLoop() {
    pushStats().catch(() => {});
    state.pushTimer = W.setInterval(() => {
      pushStats().catch((err) => {
        console.warn('[Groups Race Sync Patch] push failed:', safeErr(err));
      });
    }, PUSH_MS);

    W.addEventListener('beforeunload', markLeftBestEffort);
    D.addEventListener('visibilitychange', () => {
      if (!D.hidden) pushStats().catch(() => {});
    });
  }

  function startEndWatcher() {
    state.endTimer = W.setInterval(() => {
      tryFinalize().catch(() => {});
    }, 900);
  }

  async function pushStats() {
    if (!state.roomRef || state.ended) return;

    const stats = readStatsFromHud();
    const hash = JSON.stringify(stats);
    if (hash === state.lastPayloadHash && !stats.force) return;
    state.lastPayloadHash = hash;

    await state.roomRef.update({
      [`players/${state.playerId}/playerId`]: state.playerId,
      [`players/${state.playerId}/pid`]: state.pid,
      [`players/${state.playerId}/name`]: state.playerName,
      [`players/${state.playerId}/presence`]: 'playing',
      [`players/${state.playerId}/isHost`]: !!state.isHost,
      [`players/${state.playerId}/lastSeen`]: now(),

      [`players/${state.playerId}/live/score`]: stats.score,
      [`players/${state.playerId}/live/streak`]: stats.streak,
      [`players/${state.playerId}/live/miss`]: stats.miss,
      [`players/${state.playerId}/live/accuracy`]: stats.accuracy,
      [`players/${state.playerId}/live/correct`]: stats.correct,
      [`players/${state.playerId}/live/wrong`]: stats.wrong,
      [`players/${state.playerId}/live/goalDone`]: stats.goalDone,
      [`players/${state.playerId}/live/goalTotal`]: stats.goalTotal,
      [`players/${state.playerId}/live/timeLeft`]: stats.timeLeft,
      [`players/${state.playerId}/live/phase`]: stats.phase,

      updatedAt: now()
    });
  }

  async function tryFinalize() {
    if (state.ended || !state.roomRef) return;

    const stats = readStatsFromHud();
    const summaryVisible = detectSummaryVisible();
    const timeFinished = stats.timeLeft <= 0;
    const clearlyEnded = summaryVisible || timeFinished;

    if (!clearlyEnded) return;

    state.ended = true;

    await state.roomRef.update({
      [`players/${state.playerId}/presence`]: 'finished',
      [`players/${state.playerId}/finishedAt`]: now(),
      [`players/${state.playerId}/result/score`]: stats.score,
      [`players/${state.playerId}/result/streak`]: stats.streak,
      [`players/${state.playerId}/result/miss`]: stats.miss,
      [`players/${state.playerId}/result/accuracy`]: stats.accuracy,
      [`players/${state.playerId}/result/correct`]: stats.correct,
      [`players/${state.playerId}/result/wrong`]: stats.wrong,
      [`players/${state.playerId}/result/goalDone`]: stats.goalDone,
      [`players/${state.playerId}/result/goalTotal`]: stats.goalTotal,
      [`players/${state.playerId}/result/phase`]: stats.phase,
      [`players/${state.playerId}/result/rankKey`]: makeRankKey(stats),
      updatedAt: now()
    });

    if (state.isHost) {
      const everyone = getPlayers(state.room);
      const allFinished = everyone.length >= 2 && everyone.every((p) => p.presence === 'finished' || !p.active);

      if (allFinished) {
        await state.roomRef.update({
          status: 'ended',
          endedAt: now(),
          updatedAt: now()
        });
      }
    }

    renderBoard(true);
    if (state.pushTimer) W.clearInterval(state.pushTimer);
    if (state.endTimer) W.clearInterval(state.endTimer);
  }

  function renderBoard(forceFinal = false) {
    if (!state.mount) return;

    const body = $('.hha-race-rank__body', state.mount);
    const room = state.room;
    const players = getPlayers(room);

    if (!players.length) {
      body.innerHTML = `<div class="hha-race-rank__empty">ยังไม่มีข้อมูลผู้เล่น</div>`;
      return;
    }

    const finals = players.some((p) => p.presence === 'finished') || forceFinal;
    const rows = players
      .sort((a, b) => comparePlayers(a, b, finals))
      .map((p, idx) => {
        const leader = idx === 0 ? `<span class="hha-race-rank__tag gold">ที่ 1</span>` : '';
        const you = p.playerId === state.playerId ? `<span class="hha-race-rank__tag you">คุณ</span>` : '';
        const host = p.isHost ? `<span class="hha-race-rank__tag host">Host</span>` : '';
        const status = p.presence === 'finished'
          ? `<span class="hha-race-rank__tag done">เสร็จแล้ว</span>`
          : p.active
            ? `<span class="hha-race-rank__tag live">กำลังเล่น</span>`
            : `<span class="hha-race-rank__tag off">หลุด</span>`;

        const score = finals ? p.result.score : p.live.score;
        const acc = finals ? p.result.accuracy : p.live.accuracy;
        const miss = finals ? p.result.miss : p.live.miss;
        const streak = finals ? p.result.streak : p.live.streak;

        return `
          <div class="hha-race-rank__row">
            <div class="hha-race-rank__left">
              <div class="hha-race-rank__place">${idx + 1}</div>
              <div class="hha-race-rank__meta">
                <div class="hha-race-rank__name">${escapeHtml(p.name || 'Player')}</div>
                <div class="hha-race-rank__tags">${leader}${you}${host}${status}</div>
              </div>
            </div>
            <div class="hha-race-rank__right">
              <div class="hha-race-rank__num">${score}</div>
              <div class="hha-race-rank__sub">ACC ${acc}% · MISS ${miss} · STREAK ${streak}</div>
            </div>
          </div>
        `;
      }).join('');

    body.innerHTML = rows;
  }

  function comparePlayers(a, b, finals) {
    const ax = finals ? a.result : a.live;
    const bx = finals ? b.result : b.live;

    if (num(bx.score) !== num(ax.score)) return num(bx.score) - num(ax.score);
    if (num(bx.accuracy) !== num(ax.accuracy)) return num(bx.accuracy) - num(ax.accuracy);
    if (num(ax.miss) !== num(bx.miss)) return num(ax.miss) - num(bx.miss);
    if (num(bx.streak) !== num(ax.streak)) return num(bx.streak) - num(ax.streak);
    return num(a.finishedAt || a.joinedAt) - num(b.finishedAt || b.joinedAt);
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
        presence: String(p.presence || 'lobby'),
        isHost: !!p.isHost || key === room.ownerPlayerId,
        joinedAt: num(p.joinedAt, 0),
        finishedAt: num(p.finishedAt, 0),
        active,
        live: {
          score: num(live.score, 0),
          streak: num(live.streak, 0),
          miss: num(live.miss, 0),
          accuracy: num(live.accuracy, 0),
          correct: num(live.correct, 0),
          wrong: num(live.wrong, 0),
          goalDone: num(live.goalDone, 0),
          goalTotal: num(live.goalTotal, 0),
          timeLeft: num(live.timeLeft, 0),
          phase: String(live.phase || '')
        },
        result: {
          score: num(result.score, 0),
          streak: num(result.streak, 0),
          miss: num(result.miss, 0),
          accuracy: num(result.accuracy, 0),
          correct: num(result.correct, 0),
          wrong: num(result.wrong, 0),
          goalDone: num(result.goalDone, 0),
          goalTotal: num(result.goalTotal, 0),
          phase: String(result.phase || '')
        }
      };
    });
  }

  function readStatsFromHud() {
    const score = readNumberByLabels(['score', 'คะแนน']);
    const streak = readNumberByLabels(['streak', 'คอมโบ', 'combo']);
    const miss = readNumberByLabels(['miss', 'พลาด']);
    const accuracy = readPercentByLabels(['accuracy', 'แม่นยำ']);
    const timeLeft = readTimeByLabels(['time', 'เวลา']);
    const goalPair = readGoalPair();

    const summaryPair = readCorrectWrongMissSummary();
    const correct = summaryPair.correct;
    const wrong = summaryPair.wrong;
    const phase = readPhaseText();

    return {
      score,
      streak,
      miss,
      accuracy,
      timeLeft,
      correct,
      wrong,
      goalDone: goalPair.done,
      goalTotal: goalPair.total,
      phase,
      force: false
    };
  }

  function detectSummaryVisible() {
    const candidates = $$('.summary, .summary-card, .result-overlay, .end-overlay, .final-summary, [data-summary], [data-role="summary"]');
    return candidates.some((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 120 && r.height > 80 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    });
  }

  function readNumberByLabels(labels) {
    for (const label of labels) {
      const n = findValueNearLabel(label);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  function readPercentByLabels(labels) {
    for (const label of labels) {
      const node = findTextNodeNearLabel(label);
      if (!node) continue;
      const m = String(node.textContent || '').match(/(\d+(?:\.\d+)?)\s*%/);
      if (m) return Math.round(Number(m[1]));
    }

    const all = D.body.innerText.match(/ACCURACY[\s\S]{0,24}?(\d+(?:\.\d+)?)\s*%/i);
    return all ? Math.round(Number(all[1])) : 0;
  }

  function readTimeByLabels(labels) {
    for (const label of labels) {
      const node = findTextNodeNearLabel(label);
      if (!node) continue;
      const m = String(node.textContent || '').match(/(\d{1,2}):(\d{2})/);
      if (m) return (Number(m[1]) * 60) + Number(m[2]);
    }

    const all = D.body.innerText.match(/TIME[\s\S]{0,24}?(\d{1,2}):(\d{2})/i);
    return all ? (Number(all[1]) * 60 + Number(all[2])) : 0;
  }

  function readGoalPair() {
    const nodes = $$('*').filter((el) => {
      const txt = cleanInlineText(el.textContent || '');
      return /^(goal|เป้าหมาย)$/i.test(txt);
    });

    for (const node of nodes) {
      const parent = node.closest('div,section,article') || node.parentElement;
      if (!parent) continue;
      const text = cleanInlineText(parent.innerText || '');
      const m = text.match(/(\d+)\s*\/\s*(\d+)/);
      if (m) {
        return { done: Number(m[1]), total: Number(m[2]) };
      }
    }

    const m = D.body.innerText.match(/(\d+)\s*\/\s*(\d+)/);
    if (m) return { done: Number(m[1]), total: Number(m[2]) };
    return { done: 0, total: 0 };
  }

  function readCorrectWrongMissSummary() {
    const text = D.body.innerText || '';
    const m = text.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
    if (m) {
      return {
        correct: Number(m[1]),
        wrong: Number(m[2]),
        miss: Number(m[3])
      };
    }
    return { correct: 0, wrong: 0, miss: readNumberByLabels(['miss', 'พลาด']) };
  }

  function readPhaseText() {
    const cands = $$('.stage-badge, .phase-badge, .mode-badge, .practice-badge, .mission-stage');
    for (const el of cands) {
      const txt = cleanText(el.textContent || '', 40);
      if (txt) return txt;
    }
    return '';
  }

  function findValueNearLabel(labelText) {
    const node = findTextNodeNearLabel(labelText);
    if (!node) return NaN;
    const m = String(node.textContent || '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  }

  function findTextNodeNearLabel(labelText) {
    const all = $$('*');
    const low = String(labelText).toLowerCase();

    for (const el of all) {
      const txt = cleanInlineText(el.textContent || '').toLowerCase();
      if (txt !== low) continue;

      const card = el.closest('div,section,article') || el.parentElement;
      if (!card) continue;

      const texts = $$( '*', card )
        .map((n) => cleanInlineText(n.textContent || ''))
        .filter(Boolean);

      for (const t of texts) {
        if (/\d/.test(t) || /%/.test(t) || /\d{1,2}:\d{2}/.test(t)) {
          return { textContent: t };
        }
      }

      const inline = cleanInlineText(card.innerText || '');
      if (inline) return { textContent: inline };
    }

    return null;
  }

  async function markLeftBestEffort() {
    try {
      if (!state.roomRef) return;
      await state.roomRef.update({
        [`players/${state.playerId}/presence`]: state.ended ? 'finished' : 'left',
        [`players/${state.playerId}/lastSeen`]: now(),
        updatedAt: now()
      });
    } catch (_) {}
  }

  function makeRankKey(stats) {
    const score = String(999999 - num(stats.score, 0)).padStart(6, '0');
    const miss = String(num(stats.miss, 0)).padStart(4, '0');
    const acc = String(999 - num(stats.accuracy, 0)).padStart(3, '0');
    const streak = String(999 - num(stats.streak, 0)).padStart(3, '0');
    return `${score}_${miss}_${acc}_${streak}`;
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

  function cleanInlineText(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
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
    style.id = 'hha-groups-race-sync-patch-style';
    style.textContent = `
      .hha-race-rank{
        position:fixed;
        right:12px;
        top:88px;
        z-index:40;
        width:min(320px, calc(100vw - 24px));
        background:rgba(255,255,255,.92);
        border:1px solid rgba(124,166,206,.28);
        border-radius:20px;
        box-shadow:0 14px 36px rgba(39,68,100,.18);
        backdrop-filter: blur(8px);
        overflow:hidden;
      }

      .hha-race-rank__head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:12px 14px;
        background:linear-gradient(180deg, rgba(114,199,255,.22), rgba(114,199,255,.08));
        border-bottom:1px solid rgba(124,166,206,.18);
      }

      .hha-race-rank__title{
        font-size:1rem;
        font-weight:900;
        color:#21435f;
      }

      .hha-race-rank__room{
        font-size:.82rem;
        font-weight:800;
        color:#557690;
      }

      .hha-race-rank__body{
        padding:10px;
        max-height:min(52vh, 420px);
        overflow:auto;
      }

      .hha-race-rank__empty{
        color:#67829a;
        font-weight:700;
        padding:10px;
      }

      .hha-race-rank__row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:10px 10px;
        border-radius:16px;
        background:rgba(238,247,255,.85);
        border:1px solid rgba(124,166,206,.18);
      }

      .hha-race-rank__row + .hha-race-rank__row{
        margin-top:8px;
      }

      .hha-race-rank__left{
        display:flex;
        align-items:center;
        gap:10px;
        min-width:0;
      }

      .hha-race-rank__place{
        width:34px;
        height:34px;
        border-radius:999px;
        display:grid;
        place-items:center;
        font-weight:900;
        color:#1f4766;
        background:#fff;
        border:1px solid rgba(124,166,206,.22);
        flex:0 0 auto;
      }

      .hha-race-rank__meta{ min-width:0; }

      .hha-race-rank__name{
        font-weight:900;
        color:#213f59;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .hha-race-rank__tags{
        display:flex;
        gap:6px;
        flex-wrap:wrap;
        margin-top:4px;
      }

      .hha-race-rank__tag{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:24px;
        padding:4px 8px;
        border-radius:999px;
        font-size:.72rem;
        font-weight:900;
      }

      .hha-race-rank__tag.gold{ background:#fff2be; color:#7c5a00; }
      .hha-race-rank__tag.you{ background:#d8f1ff; color:#176080; }
      .hha-race-rank__tag.host{ background:#def9d5; color:#2f6d23; }
      .hha-race-rank__tag.live{ background:#e8f2ff; color:#355e89; }
      .hha-race-rank__tag.done{ background:#e6ffe8; color:#276338; }
      .hha-race-rank__tag.off{ background:#ffe7e7; color:#8b4444; }

      .hha-race-rank__right{
        text-align:right;
        flex:0 0 auto;
      }

      .hha-race-rank__num{
        font-size:1.15rem;
        line-height:1.1;
        font-weight:900;
        color:#20435f;
      }

      .hha-race-rank__sub{
        font-size:.74rem;
        color:#627f98;
        font-weight:800;
        margin-top:3px;
        white-space:nowrap;
      }

      @media (max-width: 900px){
        .hha-race-rank{
          top:auto;
          bottom:10px;
          right:10px;
          left:10px;
          width:auto;
        }

        .hha-race-rank__body{
          max-height:34vh;
        }

        .hha-race-rank__row{
          padding:8px 9px;
        }

        .hha-race-rank__num{
          font-size:1rem;
        }

        .hha-race-rank__sub{
          font-size:.69rem;
        }
      }
    `;
    D.head.appendChild(style);
  }
})();