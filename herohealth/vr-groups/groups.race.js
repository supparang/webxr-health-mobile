// === /herohealth/vr-groups/groups.race.js ===
// HeroHealth • Food Groups Race Adapter
// Uses shared Food-to-Gate Sorting Core
// Requires: ./groups-core.js
// For: /herohealth/vr-groups/groups-race.html
// PATCH v20260517-GROUPS-RACE-ADAPTER-CORE-V3-ROOM-SYNC-LOCK

import {
  createGroupsCore,
  FOOD_GROUPS,
  GROUPS_CORE_VERSION
} from './groups-core.js?v=20260517-groups-core-v1';

const ROOM_ROOT = 'hha-battle/groups/raceRooms';

function qs(name, fallback = '') {
  try {
    return new URL(location.href).searchParams.get(name) || fallback;
  } catch (_) {
    return fallback;
  }
}

function now() {
  return Date.now();
}

function clamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) n = min;
  return Math.max(min, Math.min(max, n));
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanName(v, fallback = 'Hero') {
  const s = String(v || '')
    .replace(/[^\wก-๙ _-]/g, '')
    .trim()
    .slice(0, 24);

  return s || fallback;
}

function cleanRoom(v) {
  return String(v || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 16);
}

function makeLocalUid() {
  const key = 'HHA_GROUPS_RACE_LOCAL_UID';
  let uid = localStorage.getItem(key);

  if (!uid) {
    uid = `local-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    localStorage.setItem(key, uid);
  }

  return uid;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = Array.from(document.scripts).find((s) => {
      const v = s.getAttribute('src') || '';
      return v.includes(src);
    });

    if (existing) {
      resolve();
      return;
    }

    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Cannot load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureFirebase() {
  if (window.HHA_FIREBASE && window.HHA_FIREBASE.ready && window.HHA_FIREBASE.db) {
    return window.HHA_FIREBASE;
  }

  if (!window.firebase) {
    await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js');
  }

  if (!window.HHA_FIREBASE) {
    await loadScript('../firebase-config.js');
  }

  return new Promise((resolve, reject) => {
    if (window.HHA_FIREBASE && window.HHA_FIREBASE.ready && window.HHA_FIREBASE.db) {
      resolve(window.HHA_FIREBASE);
      return;
    }

    if (window.firebase && window.firebase.apps && window.firebase.apps.length && window.firebase.database) {
      resolve({
        ready: true,
        auth: window.firebase.auth ? window.firebase.auth() : null,
        db: window.firebase.database()
      });
      return;
    }

    let done = false;

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error(window.HHA_FIREBASE?.error || 'Firebase not ready'));
    }, 9000);

    function onReady() {
      if (done) return;
      done = true;
      cleanup();
      resolve(window.HHA_FIREBASE);
    }

    function onError(e) {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error(e?.detail?.message || window.HHA_FIREBASE?.error || 'Firebase init failed'));
    }

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('hha:firebase-ready', onReady);
      window.removeEventListener('hha:firebase-error', onError);
    }

    window.addEventListener('hha:firebase-ready', onReady, { once: true });
    window.addEventListener('hha:firebase-error', onError, { once: true });
  });
}

export function createGroupsRaceAdapter(shellContext = {}) {
  const mountSelector =
    shellContext.mountSelector ||
    shellContext.mount ||
    '#gameMount';

  const ctxMountEl =
    shellContext.mountEl ||
    shellContext.el ||
    null;

  const roomId = cleanRoom(qs('roomId') || qs('room') || 'LOCAL');
  const playerName = cleanName(qs('name') || qs('nick') || localStorage.getItem('HHA_GROUPS_RACE_LAST_NAME') || 'Hero');
  const diff = qs('diff', 'normal');
  const duration = clamp(Number(qs('timeSec') || qs('time') || 90), 45, 240);
  const startAt = Number(qs('startAt') || 0);
  const urlSeed = qs('seed', '');
  const hub = qs('hub', 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html');
  const isLocalTest = roomId === 'LOCAL';

  const raceSeed = [
    'groups-race',
    roomId,
    startAt || '',
    urlSeed || '',
    diff,
    duration
  ].join('|');

  const core = createGroupsCore({
    mode: 'race',
    diff,
    durationSec: duration,
    seed: raceSeed,
    hearts: 3,
    autoSpawn: true,
    decoyHardCap: true,
    allowPower: true,
    allowGolden: true,
    allowDecoy: true,
    missionEnabled: true,
    onEvent: handleCoreEvent
  });

  const state = {
    version: 'v20260517-groups-race-adapter-core-v3-room-sync-lock',
    coreVersion: GROUPS_CORE_VERSION,

    mounted: false,
    destroyed: false,

    mountEl: null,
    root: null,

    roomId,
    name: playerName,
    diff,
    duration,
    startAt,
    seed: raceSeed,
    hub,
    isLocalTest,

    uid: '',
    firebase: null,
    roomRef: null,
    playersRef: null,
    playersOff: null,
    roomOff: null,
    firebaseReady: false,
    firebaseError: '',

    mode: 'waiting',
    leaderboard: [],
    localRank: '-',

    raf: 0,
    tickTimer: 0,
    syncTimer: 0,
    startedOnce: false,
    endedOnce: false,
    lastToastAt: 0,
    lastCoreMode: 'idle'
  };

  function $(sel) {
    const root = state.root || document;
    return root.querySelector(sel);
  }

  function $all(sel) {
    const root = state.root || document;
    return Array.from(root.querySelectorAll(sel));
  }

  function setText(sel, text) {
    const el = $(sel);
    if (el) el.textContent = String(text);
  }

  function coreState() {
    return core.getState();
  }

  function coreSummary() {
    return core.getSummary();
  }

  function rankName() {
    const s = coreState();

    if (s.correct >= 24 && s.accuracy >= 88 && s.bestCombo >= 8) return 'Race Food Hero';
    if (s.correct >= 16 && s.accuracy >= 78) return 'Smart Racer';
    if (s.correct >= 8 && s.accuracy >= 62) return 'Food Racer';
    return 'Rookie Racer';
  }

  function handleCoreEvent(event) {
    if (!event || !event.type) return;

    if (event.type === 'judge:correct') {
      const gain = event.detail?.gain || 0;
      toast(`ถูกต้อง +${gain}`, 'good');
      vibrate([18, 12, 18]);
      syncPlayer('playing');
    }

    if (event.type === 'judge:miss') {
      const reason = event.detail?.reason || 'miss';
      const msg =
        reason === 'wrong-group' ? 'ผิดหมู่! -1 ❤️' :
        reason === 'timeout' ? 'หมดเวลา! -1 ❤️' :
        reason === 'hit-decoy' ? 'ยิงตัวหลอก! -1 ❤️' :
        'พลาด! -1 ❤️';

      toast(msg, 'bad');
      vibrate([28, 18, 28]);
      syncPlayer('playing');
    }

    if (event.type === 'judge:shield') {
      toast('🛡️ Shield ช่วยไว้', 'power');
      vibrate([22, 12, 22]);
      syncPlayer('playing');
    }

    if (event.type === 'judge:block') {
      toast('Power ต้องกดที่การ์ดพลัง', 'warn');
    }

    if (event.type === 'power:collect') {
      const power = event.detail?.power || '';
      const msg =
        power === 'shield' ? '🛡️ Shield +1' :
        power === 'slow' ? '⏱️ Slow Time' :
        power === 'boost' ? '⚡ Boost Score' :
        '⚡ Power';

      toast(msg, 'power');
      vibrate([18, 12, 18]);
      syncPlayer('playing');
    }

    if (event.type === 'power:miss') {
      toast('พลาด Power', 'warn');
    }

    if (event.type === 'decoy:pass') {
      toast('🚫 หลบตัวหลอก +8', 'good');
      vibrate(14);
      syncPlayer('playing');
    }

    if (event.type === 'mission:clear') {
      toast('⭐ Mission Clear +35', 'good');
    }

    if (event.type === 'item:spawn') {
      renderItem();
      renderHud();
    }

    if (event.type === 'game:end') {
      endRace(event.detail?.reason || 'time');
    }
  }

  function toast(text, kind = '') {
    const t = now();

    if (t - state.lastToastAt < 120 && kind !== 'bad') return;
    state.lastToastAt = t;

    const el = $('#raceToast');
    if (!el) return;

    el.className = `race-toast ${kind}`;
    el.textContent = text;
    el.classList.remove('show');

    void el.offsetWidth;
    el.classList.add('show');
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (_) {}
  }

  function renderShell() {
    state.root.innerHTML = `
      <section class="race-page">
        <header class="race-top">
          <div class="race-brand">
            <div class="race-mark">🏁</div>
            <div>
              <h1>Food Groups Race</h1>
              <p>แข่งแยกอาหารเข้าประตูหมู่ 1–5 ให้เร็วและแม่นที่สุด</p>
            </div>
          </div>

          <div class="race-actions">
            <button class="race-btn ghost" id="btnRaceLobby" type="button">← Lobby</button>
            <button class="race-btn ghost" id="btnRaceHub" type="button">🏠 HUB</button>
          </div>
        </header>

        <section class="race-layout">
          <main class="race-main-card">
            <div class="race-status-row">
              <div class="race-chip">Room <b id="roomText">${escapeHtml(state.roomId)}</b></div>
              <div class="race-chip">Player <b id="nameText">${escapeHtml(state.name)}</b></div>
              <div class="race-chip">Diff <b id="diffText">${escapeHtml(state.diff)}</b></div>
              <div class="race-chip">Core <b>Food-to-Gate</b></div>
            </div>

            <div id="raceWaiting" class="race-waiting">
              <div class="wait-icon">🚀</div>
              <h2>เตรียมเข้า Race</h2>
              <p id="raceWaitingText">กำลังเตรียมเกม...</p>
              <div id="raceStartCount" class="race-start-count">...</div>
            </div>

            <div id="raceGame" class="race-game" hidden>
              <div class="race-hud">
                <div class="hud-card">
                  <span>คะแนน</span>
                  <b id="scoreText">0</b>
                </div>
                <div class="hud-card">
                  <span>เวลา</span>
                  <b id="timeText">0</b>
                </div>
                <div class="hud-card">
                  <span>คอมโบ</span>
                  <b id="comboText">0</b>
                </div>
                <div class="hud-card heart">
                  <span>หัวใจ</span>
                  <b id="heartText">❤️❤️❤️</b>
                </div>
              </div>

              <div class="mission-box">
                <div id="missionText">Mission</div>
                <div class="mission-bar"><span id="missionBar"></span></div>
              </div>

              <section class="item-stage">
                <div class="time-bar"><span id="itemTimeBar"></span></div>

                <button id="itemCard" class="item-card" type="button">
                  <div id="itemIcon" class="item-icon">🍎</div>
                  <div id="itemKind" class="item-kind">FOOD</div>
                  <div id="itemHint" class="item-hint">เลือกประตูหมู่ที่ถูก</div>
                </button>
              </section>

              <section class="group-grid" id="groupGrid">
                ${FOOD_GROUPS.map((g) => `
                  <button class="group-btn" type="button" data-group="${g.key}" style="--group-color:${g.color}">
                    <span class="group-id">${g.id}</span>
                    <span class="group-icon">${g.icon}</span>
                    <b>${g.label}</b>
                    <small>${g.short}</small>
                  </button>
                `).join('')}
              </section>
            </div>

            <div id="raceSummary" class="race-summary" hidden>
              <div class="summary-icon">🏆</div>
              <h2 id="summaryRank">Race Result</h2>
              <p id="summarySub">สรุปผลการแข่งขัน</p>

              <div class="summary-grid">
                <div><b id="sumScore">0</b><span>คะแนน</span></div>
                <div><b id="sumAccuracy">0%</b><span>ความแม่นยำ</span></div>
                <div><b id="sumCombo">0</b><span>คอมโบสูงสุด</span></div>
                <div><b id="sumCorrect">0</b><span>ตอบถูก</span></div>
              </div>

              <div class="summary-actions">
                <button class="race-btn primary" id="btnPlayAgain" type="button">เล่นอีกครั้ง</button>
                <button class="race-btn gold" id="btnBackLobby2" type="button">กลับ Race Lobby</button>
              </div>
            </div>
          </main>

          <aside class="race-side-card">
            <div class="side-title">
              <h2>Live Leaderboard</h2>
              <span id="syncStatus">Offline</span>
            </div>

            <div id="leaderboard" class="leaderboard">
              <div class="board-empty">กำลังโหลดอันดับ...</div>
            </div>

            <div class="race-help">
              <div>🎯 อาหารปกติ/Golden: กดประตูหมู่ที่ถูก</div>
              <div>⚡ Power: กดการ์ดพลังกลางจอ</div>
              <div>🚫 ตัวหลอก: อย่ากด รอให้ผ่านไป</div>
              <div>🏆 คะแนน + ความแม่นยำ + คอมโบ ใช้จัดอันดับ</div>
            </div>
          </aside>
        </section>

        <div id="raceToast" class="race-toast">Ready</div>
      </section>
    `;

    bindUi();
    renderHud();
    renderLeaderboard();
  }

  function bindUi() {
    $('#btnRaceLobby')?.addEventListener('click', goLobby);
    $('#btnRaceHub')?.addEventListener('click', goHub);
    $('#btnBackLobby2')?.addEventListener('click', goLobby);
    $('#btnPlayAgain')?.addEventListener('click', replay);

    $all('.group-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        core.judgeGate(btn.dataset.group, {
          source: 'race-ui',
          input: 'group-button'
        });
      });
    });

    $('#itemCard')?.addEventListener('click', () => {
      const s = coreState();
      const item = s.current;

      if (!item) return;

      if (item.kind === 'power') {
        core.collectPower({
          source: 'race-ui',
          input: 'item-card'
        });
      } else if (item.kind === 'decoy') {
        core.judgeGate('__decoy_hit__', {
          source: 'race-ui',
          input: 'item-card-decoy'
        });
      } else {
        toast('อาหารต้องเลือกประตูหมู่ด้านล่าง', 'warn');
      }
    });

    document.addEventListener('keydown', onKeyDown);
  }

  function onKeyDown(ev) {
    if (state.mode !== 'playing') return;

    const n = Number(ev.key);

    if (n >= 1 && n <= 5) {
      const g = FOOD_GROUPS[n - 1];
      if (g) {
        core.judgeGate(g.key, {
          source: 'keyboard',
          key: ev.key
        });
      }
    }

    if (ev.key === ' ' || ev.key === 'Enter') {
      const item = coreState().current;
      if (item && item.kind === 'power') {
        core.collectPower({
          source: 'keyboard',
          key: ev.key
        });
      }
    }
  }

  function renderHud() {
    const s = coreState();

    setText('#scoreText', s.score);
    setText('#timeText', s.remainingSec + 's');
    setText('#comboText', s.combo);
    setText('#heartText', '❤️'.repeat(Math.max(0, s.hearts)) + (s.shield ? ` 🛡️${s.shield}` : ''));

    if (s.mission) {
      setText('#missionText', `${s.mission.icon} ${s.mission.label} ${s.mission.got}/${s.mission.need}`);
      const pct = clamp(s.mission.got / Math.max(1, s.mission.need), 0, 1) * 100;
      const bar = $('#missionBar');
      if (bar) bar.style.width = `${pct}%`;
    }

    const itemBar = $('#itemTimeBar');
    if (itemBar) itemBar.style.width = `${Math.round(s.itemProgress * 100)}%`;
  }

  function renderItem() {
    const item = coreState().current;
    if (!item) return;

    const card = $('#itemCard');
    const icon = $('#itemIcon');
    const kind = $('#itemKind');
    const hint = $('#itemHint');

    if (!card || !icon || !kind || !hint) return;

    card.className = `item-card ${item.kind}`;
    icon.textContent = item.icon;

    if (item.kind === 'food') {
      kind.textContent = 'FOOD';
      hint.textContent = `เลือกประตูหมู่ ${item.group.id} ${item.group.label}`;
    } else if (item.kind === 'golden') {
      kind.textContent = 'GOLDEN + BONUS';
      hint.textContent = `เลือกประตูหมู่ ${item.group.id} ${item.group.label}`;
    } else if (item.kind === 'power') {
      kind.textContent = String(item.label || 'POWER').toUpperCase();
      hint.textContent = 'กดการ์ดนี้เพื่อเก็บพลัง';
    } else {
      kind.textContent = 'DON’T TAP';
      hint.textContent = 'ตัวหลอก อย่ากด รอให้ผ่านไป';
    }
  }

  function setSyncStatus(text) {
    setText('#syncStatus', text);

    const el = $('#syncStatus');
    if (!el) return;

    el.classList.remove('online', 'offline', 'local', 'connecting');

    const t = String(text || '').toLowerCase();

    if (t.includes('online')) el.classList.add('online');
    else if (t.includes('local')) el.classList.add('local');
    else if (t.includes('connect')) el.classList.add('connecting');
    else el.classList.add('offline');
  }

  function renderLeaderboard() {
    const box = $('#leaderboard');
    if (!box) return;

    const rows = state.leaderboard.slice(0, 10);

    if (!rows.length) {
      box.innerHTML = `<div class="board-empty">ยังไม่มีคะแนนในห้อง</div>`;
      return;
    }

    box.innerHTML = rows.map((p, i) => {
      const isMe = p.uid === state.uid;
      const place = i + 1;
      const crown = place === 1 ? '👑' : place === 2 ? '🥈' : place === 3 ? '🥉' : place;

      return `
        <div class="board-row ${isMe ? 'me' : ''}">
          <div class="board-left">
            <span class="place">${crown}</span>
            <div>
              <b>${escapeHtml(p.name || 'Player')}${isMe ? ' (คุณ)' : ''}</b>
              <small>${p.done ? 'จบแล้ว' : 'กำลังแข่ง'} • Acc ${Math.round(p.accuracy || 0)}%</small>
            </div>
          </div>
          <div class="board-score">
            <b>${Math.round(p.score || 0)}</b>
            <small>Combo ${Math.round(p.bestCombo || 0)}</small>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderWaiting(msLeft) {
    const waiting = $('#raceWaiting');
    const game = $('#raceGame');
    const summary = $('#raceSummary');

    if (waiting) waiting.hidden = false;
    if (game) game.hidden = true;
    if (summary) summary.hidden = true;

    const count = $('#raceStartCount');

    if (!state.startAt) {
      setText('#raceWaitingText', 'กำลังรอเวลาเริ่มจากห้อง Race...');
      if (count) count.textContent = 'WAIT';
      return;
    }

    const sec = Math.ceil(msLeft / 1000);

    setText('#raceWaitingText', sec > 0 ? 'จะเริ่มแข่งใน...' : 'เริ่มแข่ง!');
    if (count) count.textContent = sec > 0 ? String(sec) : 'GO!';
  }

  function renderPlaying() {
    const waiting = $('#raceWaiting');
    const game = $('#raceGame');
    const summary = $('#raceSummary');

    if (waiting) waiting.hidden = true;
    if (game) game.hidden = false;
    if (summary) summary.hidden = true;

    renderHud();
    renderItem();
  }

  function renderSummary() {
    const waiting = $('#raceWaiting');
    const game = $('#raceGame');
    const summary = $('#raceSummary');

    if (waiting) waiting.hidden = true;
    if (game) game.hidden = true;
    if (summary) summary.hidden = false;

    const s = coreSummary();

    setText('#summaryRank', rankName());
    setText('#summarySub', `อันดับของคุณ: ${state.localRank || '-'} • Hit Rate ${s.hitRate || 0}%`);
    setText('#sumScore', s.score);
    setText('#sumAccuracy', s.accuracy + '%');
    setText('#sumCombo', s.bestCombo);
    setText('#sumCorrect', s.correct);
  }

  function startRace() {
    if (state.mode === 'playing' || state.destroyed || state.startedOnce) return;

    state.mode = 'playing';
    state.startedOnce = true;
    state.endedOnce = false;

    core.start({
      seed: state.seed,
      durationSec: state.duration,
      diff: state.diff,
      hearts: 3,
      startedAt: now()
    });

    syncPlayer('running');
    renderPlaying();

    clearInterval(state.tickTimer);
    state.tickTimer = setInterval(tick, 150);

    cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(loop);
  }

  function tick() {
    if (state.mode !== 'playing') return;

    core.tick({
      source: 'race-timer'
    });

    const s = coreState();

    if (s.mode === 'ended') {
      endRace(s.reason || 'time');
      return;
    }

    renderHud();
  }

  function loop() {
    if (state.destroyed) return;

    if (state.mode === 'waiting') {
      const left = state.startAt ? state.startAt - now() : 0;
      renderWaiting(left);

      if (state.startAt && left <= 0) {
        startRace();
      }
    }

    if (state.mode === 'playing') {
      renderHud();
    }

    state.raf = requestAnimationFrame(loop);
  }

  async function connectFirebase() {
    if (state.isLocalTest) {
      state.firebaseReady = false;
      state.firebaseError = 'LOCAL test mode';
      state.uid = makeLocalUid();

      setSyncStatus('Local Test');

      state.leaderboard = [{
        uid: state.uid,
        name: state.name,
        score: 0,
        accuracy: 0,
        correct: 0,
        bestCombo: 0,
        done: false,
        updatedAt: now()
      }];

      renderLeaderboard();
      return;
    }

    try {
      setSyncStatus('Connecting');

      const fb = await ensureFirebase();
      state.firebase = fb;

      if (!fb.db) throw new Error('Firebase database unavailable');

      if (fb.auth && !fb.auth.currentUser && typeof fb.auth.signInAnonymously === 'function') {
        try {
          await fb.auth.signInAnonymously();
        } catch (e) {
          console.warn('[Groups Race] Anonymous auth failed, continue with local uid', e);
        }
      }

      state.uid =
        fb.auth?.currentUser?.uid ||
        window.HHA_FIREBASE?.uid ||
        makeLocalUid();

      state.roomRef = fb.db.ref(`${ROOM_ROOT}/${state.roomId}`);
      state.playersRef = fb.db.ref(`${ROOM_ROOT}/${state.roomId}/players`);

      await state.roomRef.child(`players/${state.uid}`).update({
        uid: state.uid,
        name: state.name,
        ready: true,
        connected: true,
        running: false,
        done: false,
        inGame: true,
        page: 'groups-race',
        score: 0,
        accuracy: 0,
        bestCombo: 0,
        core: 'food-to-gate-sorting',
        coreVersion: GROUPS_CORE_VERSION,
        updatedAt: now()
      });

      try {
        state.roomRef.child(`players/${state.uid}/connected`).onDisconnect().set(false);
        state.roomRef.child(`players/${state.uid}/updatedAt`).onDisconnect().set(now());
      } catch (e) {}

      state.playersOff = state.playersRef.on('value', (snap) => {
        const obj = snap.val() || {};
        updateLeaderboard(obj);
      });

      state.roomOff = state.roomRef.on('value', (snap) => {
        const room = snap.val() || {};

        if (room.startAt && !state.startAt) state.startAt = Number(room.startAt) || 0;
        if (room.seed && !urlSeed) state.seed = [
          'groups-race',
          state.roomId,
          room.startAt || state.startAt || '',
          room.seed || '',
          state.diff,
          state.duration
        ].join('|');
      });

      state.firebaseReady = true;
      setSyncStatus('Online');
    } catch (err) {
      console.warn('[Groups Race] Firebase offline fallback:', err);

      state.firebaseError = err?.message || String(err);
      state.uid = makeLocalUid();
      setSyncStatus('Offline');

      state.leaderboard = [{
        uid: state.uid,
        name: state.name,
        score: 0,
        accuracy: 0,
        correct: 0,
        bestCombo: 0,
        done: false,
        updatedAt: now()
      }];

      renderLeaderboard();
    }
  }

  function updateLeaderboard(playersObj) {
    const players = Object.values(playersObj || {}).map((p) => ({
      uid: p.uid || '',
      name: p.name || 'Player',
      score: Number(p.score || p.race?.score || 0),
      accuracy: Number(p.accuracy || p.race?.accuracy || 0),
      correct: Number(p.correct || p.race?.correct || 0),
      bestCombo: Number(p.bestCombo || p.race?.bestCombo || 0),
      done: Boolean(p.done || p.race?.done),
      updatedAt: Number(p.updatedAt || 0)
    }));

    players.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (b.bestCombo !== a.bestCombo) return b.bestCombo - a.bestCombo;
      return b.correct - a.correct;
    });

    state.leaderboard = players;

    const idx = players.findIndex((p) => p.uid === state.uid);
    state.localRank = idx >= 0 ? String(idx + 1) : '-';

    renderLeaderboard();

    if (state.mode === 'ended') renderSummary();
  }

  async function syncPlayer(status = 'playing') {
    const s = coreState();

    if (state.isLocalTest || !state.roomRef || !state.uid) {
      const existing = state.leaderboard.find((p) => p.uid === state.uid) || {};
      state.leaderboard = [{
        ...existing,
        uid: state.uid,
        name: state.name,
        score: s.score,
        correct: s.correct,
        miss: s.miss,
        accuracy: s.accuracy,
        bestCombo: s.bestCombo,
        combo: s.combo,
        hearts: s.hearts,
        skippedDecoy: s.skippedDecoy,
        missionClear: s.missionClear,
        done: status === 'done',
        updatedAt: now()
      }];

      state.localRank = '1';
      renderLeaderboard();
      return;
    }

    const payload = {
      uid: state.uid,
      name: state.name,
      ready: true,
      connected: true,
      running: status === 'running' || status === 'playing',
      done: status === 'done',
      inGame: status !== 'done',
      page: 'groups-race',
      score: s.score,
      correct: s.correct,
      miss: s.miss,
      accuracy: s.accuracy,
      bestCombo: s.bestCombo,
      combo: s.combo,
      hearts: s.hearts,
      skippedDecoy: s.skippedDecoy,
      missionClear: s.missionClear,
      core: 'food-to-gate-sorting',
      coreVersion: GROUPS_CORE_VERSION,
      updatedAt: now(),
      race: {
        mode: 'race',
        status,
        score: s.score,
        correct: s.correct,
        miss: s.miss,
        accuracy: s.accuracy,
        hitRate: s.hitRate,
        bestCombo: s.bestCombo,
        combo: s.combo,
        hearts: s.hearts,
        skippedDecoy: s.skippedDecoy,
        missionClear: s.missionClear,
        done: status === 'done',
        core: 'food-to-gate-sorting',
        coreVersion: GROUPS_CORE_VERSION,
        updatedAt: now()
      }
    };

    try {
      await state.roomRef.child(`players/${state.uid}`).update(payload);
    } catch (err) {
      console.warn('[Groups Race] syncPlayer failed', err);
    }
  }

  async function endRace(reason = 'time') {
    if (state.mode === 'ended' || state.endedOnce) return;

    state.mode = 'ended';
    state.endedOnce = true;

    clearInterval(state.tickTimer);
    cancelAnimationFrame(state.raf);

    const s = coreState().mode === 'ended'
      ? coreSummary()
      : core.stop(reason);

    await syncPlayer('done');

    const result = {
      ts: new Date().toISOString(),
      game: 'groups',
      core: 'food-to-gate-sorting',
      coreVersion: GROUPS_CORE_VERSION,
      mode: 'race',
      roomId: state.roomId,
      uid: state.uid,
      name: state.name,
      reason,
      diff: state.diff,
      duration: state.duration,
      score: s.score,
      correct: s.correct,
      miss: s.miss,
      accuracy: s.accuracy,
      hitRate: s.hitRate,
      bestCombo: s.bestCombo,
      skippedDecoy: s.skippedDecoy,
      missionClear: s.missionClear,
      rank: rankName()
    };

    try {
      localStorage.setItem('HHA_GROUPS_RACE_LAST_SUMMARY', JSON.stringify(result));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        ts: result.ts,
        game: 'groups',
        mode: 'race',
        summary: result
      }));

      if (state.roomRef && state.uid && !state.isLocalTest) {
        await state.roomRef.child(`results/${state.uid}`).set(result);
      }
    } catch (_) {}

    renderSummary();
    renderLeaderboard();
  }

  function replay() {
    const u = new URL(location.href);

    u.searchParams.set('seed', String(Date.now()));

    if (state.isLocalTest) {
      u.searchParams.set('startAt', String(now() + 1200));
    }

    location.href = u.toString();
  }

  function goLobby() {
    const u = new URL('./groups-race-lobby.html', location.href);

    ['hub', 'zone', 'game', 'view', 'studyId', 'pid', 'conditionGroup'].forEach((k) => {
      const v = qs(k);
      if (v) u.searchParams.set(k, v);
    });

    u.searchParams.set('room', state.roomId);
    u.searchParams.set('roomId', state.roomId);
    u.searchParams.set('name', state.name);
    u.searchParams.set('diff', state.diff);
    u.searchParams.set('time', String(state.duration));
    u.searchParams.set('timeSec', String(state.duration));

    location.href = u.toString();
  }

  function goHub() {
    location.href = state.hub;
  }

  function injectStyle() {
    if (document.getElementById('groups-race-adapter-style')) return;

    const style = document.createElement('style');
    style.id = 'groups-race-adapter-style';
    style.textContent = `
      .race-page{
        min-height:100vh;
        padding:calc(12px + env(safe-area-inset-top,0px)) 12px calc(20px + env(safe-area-inset-bottom,0px));
        color:#f8fbff;
        background:
          radial-gradient(900px 500px at 50% -10%, rgba(60,100,255,.30), transparent 56%),
          radial-gradient(520px 280px at 10% 10%, rgba(0,201,255,.12), transparent 60%),
          linear-gradient(180deg,#030b26,#071a52 52%,#0c2d84);
        font-family:ui-rounded,"Nunito","Noto Sans Thai",system-ui,sans-serif;
      }

      .race-top{
        width:min(1180px,100%);
        margin:0 auto 12px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
      }

      .race-brand{
        min-width:0;
        flex:1;
        display:flex;
        align-items:center;
        gap:12px;
        padding:14px 16px;
        border-radius:26px;
        background:linear-gradient(180deg,rgba(14,32,91,.92),rgba(9,22,68,.96));
        border:1px solid rgba(132,168,255,.18);
        box-shadow:0 18px 40px rgba(0,0,0,.28);
      }

      .race-mark{
        width:58px;
        height:58px;
        border-radius:18px;
        display:grid;
        place-items:center;
        font-size:30px;
        background:linear-gradient(180deg,#fff2b9,#f4d36d);
        color:#3f2f00;
        flex:0 0 auto;
      }

      .race-brand h1{
        margin:0;
        font-size:clamp(24px,4vw,34px);
        line-height:1.02;
        font-weight:1000;
        letter-spacing:-.03em;
      }

      .race-brand p{
        margin:6px 0 0;
        color:#c8d7ff;
        font-size:13px;
        font-weight:900;
      }

      .race-actions,
      .summary-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        justify-content:center;
      }

      .race-btn{
        min-height:46px;
        border-radius:18px;
        border:1px solid rgba(255,255,255,.08);
        padding:0 16px;
        font:inherit;
        font-size:15px;
        font-weight:1000;
        cursor:pointer;
        color:#fff;
        background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.04));
        box-shadow:0 12px 28px rgba(0,0,0,.22);
      }

      .race-btn.primary{
        background:linear-gradient(180deg,#76c7ff,#4bb0ff);
      }

      .race-btn.gold{
        background:linear-gradient(180deg,#f0c16d,#d89a57);
        color:#251600;
      }

      .race-btn.ghost{
        color:#c8d7ff;
      }

      .race-layout{
        width:min(1180px,100%);
        margin:0 auto;
        display:grid;
        grid-template-columns:minmax(0,1fr) 360px;
        gap:12px;
      }

      .race-main-card,
      .race-side-card{
        border-radius:30px;
        background:linear-gradient(180deg,rgba(10,22,66,.92),rgba(6,16,52,.96));
        border:1px solid rgba(132,168,255,.18);
        box-shadow:0 18px 40px rgba(0,0,0,.28);
        padding:16px;
      }

      .race-status-row{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin-bottom:12px;
      }

      .race-chip{
        min-height:38px;
        display:inline-flex;
        align-items:center;
        gap:6px;
        border-radius:999px;
        padding:0 12px;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.08);
        color:#c8d7ff;
        font-size:13px;
        font-weight:900;
      }

      .race-chip b{
        color:#fff;
      }

      .race-waiting{
        min-height:520px;
        display:grid;
        place-items:center;
        text-align:center;
      }

      .wait-icon{
        width:110px;
        height:110px;
        margin:0 auto 16px;
        display:grid;
        place-items:center;
        border-radius:34px;
        font-size:58px;
        background:linear-gradient(180deg,#fff2b9,#f4d36d);
        color:#3f2f00;
      }

      .race-waiting h2{
        margin:0;
        font-size:clamp(34px,7vw,64px);
        line-height:1;
        font-weight:1000;
      }

      .race-waiting p{
        margin:12px 0;
        color:#c8d7ff;
        font-size:18px;
        font-weight:900;
      }

      .race-start-count{
        width:180px;
        height:180px;
        margin:16px auto 0;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:linear-gradient(180deg,#76c7ff,#4bb0ff);
        color:#fff;
        font-size:58px;
        font-weight:1000;
        box-shadow:0 20px 60px rgba(75,176,255,.28);
      }

      .race-hud{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
        margin-bottom:10px;
      }

      .hud-card{
        border-radius:20px;
        padding:12px;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.08);
        text-align:center;
      }

      .hud-card span{
        display:block;
        color:#95a7d6;
        font-size:12px;
        font-weight:900;
      }

      .hud-card b{
        display:block;
        margin-top:5px;
        font-size:clamp(20px,4vw,34px);
        line-height:1;
        font-weight:1000;
      }

      .mission-box{
        border-radius:22px;
        padding:12px;
        margin-bottom:10px;
        background:rgba(255,255,255,.05);
        border:1px solid rgba(255,255,255,.08);
        font-weight:1000;
      }

      .mission-bar{
        height:9px;
        margin-top:8px;
        border-radius:999px;
        background:rgba(255,255,255,.10);
        overflow:hidden;
      }

      .mission-bar span{
        display:block;
        height:100%;
        width:0;
        border-radius:999px;
        background:linear-gradient(90deg,#63d99b,#76c7ff);
      }

      .item-stage{
        position:relative;
        display:grid;
        place-items:center;
        min-height:330px;
        border-radius:30px;
        background:
          radial-gradient(circle at 50% 10%,rgba(255,255,255,.08),transparent 42%),
          rgba(255,255,255,.035);
        border:1px solid rgba(255,255,255,.07);
        margin-bottom:12px;
        overflow:hidden;
      }

      .time-bar{
        position:absolute;
        left:16px;
        right:16px;
        top:14px;
        height:12px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(255,255,255,.10);
      }

      .time-bar span{
        display:block;
        height:100%;
        width:100%;
        border-radius:999px;
        background:linear-gradient(90deg,#63d99b,#f0c16d,#ff8a8a);
      }

      .item-card{
        width:min(330px,80vw);
        aspect-ratio:1/1;
        border:0;
        border-radius:42px;
        display:grid;
        place-items:center;
        padding:18px;
        cursor:pointer;
        background:linear-gradient(180deg,#fff,#eef8ff);
        box-shadow:0 28px 80px rgba(0,0,0,.24);
        color:#244e68;
        font:inherit;
        text-align:center;
      }

      .item-card.golden{
        background:linear-gradient(180deg,#fff8c8,#ffd966);
        color:#4c3500;
      }

      .item-card.power{
        background:linear-gradient(180deg,#eaf8ff,#bcecff);
        color:#155276;
      }

      .item-card.decoy{
        background:linear-gradient(180deg,#fff0f0,#ffd1d1);
        color:#9b3d3d;
      }

      .item-icon{
        font-size:clamp(72px,15vw,128px);
        line-height:1;
      }

      .item-kind{
        margin-top:8px;
        font-size:18px;
        font-weight:1000;
        letter-spacing:.06em;
      }

      .item-hint{
        margin-top:8px;
        font-size:15px;
        font-weight:950;
        color:rgba(36,78,104,.78);
      }

      .group-grid{
        display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:8px;
      }

      .group-btn{
        min-height:110px;
        border:0;
        border-radius:24px;
        padding:10px 8px;
        color:#20344b;
        background:linear-gradient(180deg,var(--group-color),#fff);
        font:inherit;
        cursor:pointer;
        box-shadow:0 14px 30px rgba(0,0,0,.18);
        font-weight:1000;
      }

      .group-btn:active{
        transform:scale(.97);
      }

      .group-id{
        display:inline-grid;
        place-items:center;
        width:30px;
        height:30px;
        border-radius:50%;
        background:rgba(255,255,255,.72);
        font-size:14px;
        margin-bottom:4px;
      }

      .group-icon{
        display:block;
        font-size:30px;
        line-height:1;
      }

      .group-btn b{
        display:block;
        margin-top:5px;
        font-size:16px;
      }

      .group-btn small{
        display:block;
        margin-top:4px;
        font-size:10px;
        color:rgba(32,52,75,.70);
      }

      .side-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        margin-bottom:12px;
      }

      .side-title h2{
        margin:0;
        font-size:22px;
        font-weight:1000;
      }

      #syncStatus{
        min-height:32px;
        display:inline-flex;
        align-items:center;
        border-radius:999px;
        padding:0 10px;
        background:rgba(99,217,155,.12);
        color:#bfffd8;
        font-size:12px;
        font-weight:1000;
      }

      #syncStatus.online{
        background:rgba(99,217,155,.16);
        color:#bfffd8;
      }

      #syncStatus.offline{
        background:rgba(255,138,138,.14);
        color:#ffc5c5;
      }

      #syncStatus.local{
        background:rgba(240,193,109,.16);
        color:#ffe29b;
      }

      #syncStatus.connecting{
        background:rgba(118,199,255,.14);
        color:#c9ecff;
      }

      .leaderboard{
        display:grid;
        gap:8px;
      }

      .board-empty{
        padding:16px;
        border-radius:18px;
        background:rgba(255,255,255,.05);
        color:#c8d7ff;
        font-weight:900;
      }

      .board-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:12px;
        border-radius:18px;
        background:rgba(255,255,255,.045);
        border:1px solid rgba(255,255,255,.06);
      }

      .board-row.me{
        background:rgba(118,199,255,.12);
        border-color:rgba(118,199,255,.22);
      }

      .board-left{
        min-width:0;
        display:flex;
        align-items:center;
        gap:10px;
      }

      .place{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        border-radius:12px;
        background:rgba(255,255,255,.08);
        font-weight:1000;
        flex:0 0 auto;
      }

      .board-left b{
        display:block;
        max-width:160px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .board-left small,
      .board-score small{
        display:block;
        margin-top:3px;
        color:#95a7d6;
        font-size:11px;
        font-weight:850;
      }

      .board-score{
        text-align:right;
        flex:0 0 auto;
      }

      .board-score b{
        font-size:20px;
        line-height:1;
      }

      .race-help{
        margin-top:14px;
        display:grid;
        gap:8px;
        color:#c8d7ff;
        font-size:13px;
        font-weight:850;
        line-height:1.45;
      }

      .race-summary{
        min-height:560px;
        display:grid;
        place-items:center;
        text-align:center;
      }

      .summary-icon{
        width:110px;
        height:110px;
        display:grid;
        place-items:center;
        margin:0 auto 14px;
        border-radius:34px;
        font-size:58px;
        background:linear-gradient(180deg,#fff2b9,#f4d36d);
        color:#3f2f00;
      }

      .race-summary h2{
        margin:0;
        font-size:clamp(38px,7vw,68px);
        line-height:1;
        font-weight:1000;
      }

      .race-summary p{
        margin:12px 0 0;
        color:#c8d7ff;
        font-size:17px;
        font-weight:900;
      }

      .summary-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
        margin:22px auto;
        width:min(760px,100%);
      }

      .summary-grid div{
        border-radius:22px;
        padding:14px 10px;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.08);
      }

      .summary-grid b{
        display:block;
        font-size:clamp(24px,5vw,42px);
        line-height:1;
      }

      .summary-grid span{
        display:block;
        margin-top:6px;
        color:#95a7d6;
        font-size:12px;
        font-weight:900;
      }

      .race-toast{
        position:fixed;
        left:50%;
        top:58%;
        transform:translate(-50%,-50%);
        z-index:50;
        min-width:min(420px,82vw);
        border-radius:999px;
        padding:13px 18px;
        background:rgba(255,255,255,.96);
        color:#244e68;
        text-align:center;
        font-size:clamp(18px,4vw,28px);
        line-height:1.15;
        font-weight:1000;
        box-shadow:0 22px 70px rgba(0,0,0,.26);
        pointer-events:none;
        opacity:0;
      }

      .race-toast.show{
        animation:raceToast .82s ease both;
      }

      .race-toast.good{ background:#f5fff1; color:#31724b; }
      .race-toast.bad{ background:#fff0f0; color:#9b3d3d; }
      .race-toast.warn{ background:#fff5ca; color:#806000; }
      .race-toast.power{ background:#eaf8ff; color:#155276; }

      @keyframes raceToast{
        0%{opacity:0; transform:translate(-50%,-38%) scale(.86);}
        22%{opacity:1; transform:translate(-50%,-50%) scale(1.05);}
        78%{opacity:1; transform:translate(-50%,-53%) scale(1);}
        100%{opacity:0; transform:translate(-50%,-68%) scale(.95);}
      }

      @media (max-width:980px){
        .race-layout{
          grid-template-columns:1fr;
        }

        .race-side-card{
          order:2;
        }

        .race-hud{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .group-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .summary-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }

      @media (max-width:680px){
        .race-page{
          padding:calc(8px + env(safe-area-inset-top,0px)) 8px calc(16px + env(safe-area-inset-bottom,0px));
        }

        .race-top{
          flex-direction:column;
          align-items:stretch;
        }

        .race-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
        }

        .race-brand{
          border-radius:22px;
          padding:12px;
        }

        .race-mark{
          width:50px;
          height:50px;
          border-radius:16px;
          font-size:26px;
        }

        .race-main-card,
        .race-side-card{
          border-radius:24px;
          padding:12px;
        }

        .item-stage{
          min-height:280px;
          border-radius:24px;
        }

        .item-card{
          width:min(260px,78vw);
          border-radius:34px;
        }

        .group-btn{
          min-height:96px;
          border-radius:20px;
        }

        .race-waiting,
        .race-summary{
          min-height:480px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  async function mount() {
    if (state.mounted || state.destroyed) return;

    state.mountEl =
      ctxMountEl ||
      document.querySelector(mountSelector) ||
      document.getElementById('gameMount') ||
      document.body;

    state.root = state.mountEl;

    localStorage.setItem('HHA_GROUPS_RACE_LAST_NAME', state.name);

    injectStyle();
    renderShell();

    state.mounted = true;

    await connectFirebase();

    if (!state.startAt) {
      const fallbackDelay = state.isLocalTest ? 1800 : 2500;
      state.startAt = now() + fallbackDelay;
    }

    renderWaiting(state.startAt - now());

    cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(loop);

    clearInterval(state.syncTimer);
    state.syncTimer = setInterval(() => {
      if (state.mode === 'playing') syncPlayer('playing');
    }, 900);
  }

  function destroy() {
    state.destroyed = true;

    clearInterval(state.tickTimer);
    clearInterval(state.syncTimer);
    cancelAnimationFrame(state.raf);

    document.removeEventListener('keydown', onKeyDown);

    try {
      if (state.playersRef && state.playersOff) state.playersRef.off('value', state.playersOff);
      if (state.roomRef && state.roomOff) state.roomRef.off('value', state.roomOff);
    } catch (_) {}

    try {
      core.destroy();
    } catch (_) {}
  }

  const adapter = {
    mount,
    start: mount,
    init: mount,
    boot: mount,
    destroy,
    unmount: destroy,
    getState() {
      const s = coreState();

      return {
        version: state.version,
        coreVersion: GROUPS_CORE_VERSION,
        roomId: state.roomId,
        name: state.name,
        mode: state.mode,
        isLocalTest: state.isLocalTest,
        coreState: s,
        score: s.score,
        correct: s.correct,
        miss: s.miss,
        accuracy: s.accuracy,
        combo: s.combo,
        bestCombo: s.bestCombo,
        leaderboard: state.leaderboard,
        firebaseReady: state.firebaseReady,
        firebaseError: state.firebaseError
      };
    }
  };

  queueMicrotask(() => {
    mount();
  });

  window.HHA_GROUPS_RACE_ADAPTER = adapter;

  return adapter;
}
