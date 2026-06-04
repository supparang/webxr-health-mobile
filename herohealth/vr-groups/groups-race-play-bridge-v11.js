/* =========================================================
   HeroHealth • Groups Race Play Bridge
   File: /herohealth/vr-groups/groups-race-play-bridge-v11.js
   PATCH: v20260604-GROUPS-RACE-PLAY-BRIDGE-V11

   Purpose:
   - แก้เคส Host/Player เห็น GO แล้ว แต่ยังค้าง Waiting Room
   - เมื่อรับ Start Sync แล้ว บังคับเข้า Race Gameplay
   - ถ้าไฟล์หลักมี start function อยู่ จะเรียก function เดิมก่อน
   - ถ้าไม่มี จะเปิด fallback gameplay แบบ Race Standard ให้เล่นได้ทันที
   ========================================================= */

(function () {
  'use strict';

  const PATCH = 'v20260604-GROUPS-RACE-PLAY-BRIDGE-V11';
  const BASE = 'herohealth/groups/raceRooms';

  if (window.__HHA_GROUPS_RACE_PLAY_BRIDGE_V11__) return;
  window.__HHA_GROUPS_RACE_PLAY_BRIDGE_V11__ = true;

  const qs = new URLSearchParams(location.search || '');

  let db = null;
  let roomCode = '';
  let playerName = '';
  let playerPid = '';
  let selfKey = '';
  let playersCache = {};
  let started = false;
  let ended = false;

  const FOODS = [
    { name: 'ไข่ต้ม', emoji: '🥚', group: 1, label: 'หมู่ 1 โปรตีน' },
    { name: 'ปลา', emoji: '🐟', group: 1, label: 'หมู่ 1 โปรตีน' },
    { name: 'นม', emoji: '🥛', group: 1, label: 'หมู่ 1 โปรตีน' },
    { name: 'ถั่ว', emoji: '🫘', group: 1, label: 'หมู่ 1 โปรตีน' },

    { name: 'ข้าว', emoji: '🍚', group: 2, label: 'หมู่ 2 คาร์โบไฮเดรต' },
    { name: 'ขนมปัง', emoji: '🍞', group: 2, label: 'หมู่ 2 คาร์โบไฮเดรต' },
    { name: 'มันเทศ', emoji: '🍠', group: 2, label: 'หมู่ 2 คาร์โบไฮเดรต' },
    { name: 'เส้นก๋วยเตี๋ยว', emoji: '🍜', group: 2, label: 'หมู่ 2 คาร์โบไฮเดรต' },

    { name: 'ผักบุ้ง', emoji: '🥬', group: 3, label: 'หมู่ 3 ผัก' },
    { name: 'แครอต', emoji: '🥕', group: 3, label: 'หมู่ 3 ผัก' },
    { name: 'บรอกโคลี', emoji: '🥦', group: 3, label: 'หมู่ 3 ผัก' },
    { name: 'แตงกวา', emoji: '🥒', group: 3, label: 'หมู่ 3 ผัก' },

    { name: 'กล้วย', emoji: '🍌', group: 4, label: 'หมู่ 4 ผลไม้' },
    { name: 'แอปเปิล', emoji: '🍎', group: 4, label: 'หมู่ 4 ผลไม้' },
    { name: 'ส้ม', emoji: '🍊', group: 4, label: 'หมู่ 4 ผลไม้' },
    { name: 'แตงโม', emoji: '🍉', group: 4, label: 'หมู่ 4 ผลไม้' },

    { name: 'น้ำมัน', emoji: '🛢️', group: 5, label: 'หมู่ 5 ไขมัน' },
    { name: 'เนย', emoji: '🧈', group: 5, label: 'หมู่ 5 ไขมัน' },
    { name: 'อะโวคาโด', emoji: '🥑', group: 5, label: 'หมู่ 5 ไขมัน' },
    { name: 'ถั่วทอด', emoji: '🥜', group: 5, label: 'หมู่ 5 ไขมัน' }
  ];

  const GROUPS = [
    { id: 1, text: 'หมู่ 1\nโปรตีน' },
    { id: 2, text: 'หมู่ 2\nข้าว-แป้ง' },
    { id: 3, text: 'หมู่ 3\nผัก' },
    { id: 4, text: 'หมู่ 4\nผลไม้' },
    { id: 5, text: 'หมู่ 5\nไขมัน' }
  ];

  function log() {
    try {
      console.log('[GroupsRacePlayBridge]', ...arguments);
    } catch (_) {}
  }

  function warn() {
    try {
      console.warn('[GroupsRacePlayBridge]', ...arguments);
    } catch (_) {}
  }

  function norm(v) {
    return String(v || '').trim();
  }

  function lower(v) {
    return norm(v).toLowerCase();
  }

  function textOf(el) {
    return String((el && (el.innerText || el.textContent)) || '').trim();
  }

  function now() {
    return Date.now();
  }

  function randInt(max) {
    return Math.floor(Math.random() * max);
  }

  function getLS(keys) {
    for (const k of keys) {
      try {
        const v = localStorage.getItem(k);
        if (v) return v;
      } catch (_) {}
    }
    return '';
  }

  function setLS(k, v) {
    try {
      localStorage.setItem(k, String(v));
    } catch (_) {}
  }

  function isFirebaseReady() {
    return (
      window.firebase &&
      typeof window.firebase.database === 'function'
    );
  }

  function ensureDb() {
    if (db) return true;

    if (!isFirebaseReady()) return false;

    try {
      db = window.firebase.database();
      return !!db;
    } catch (e) {
      warn('Firebase DB not ready', e);
      return false;
    }
  }

  function detectRoomCode() {
    const fromUrl =
      qs.get('room') ||
      qs.get('code') ||
      qs.get('roomCode') ||
      qs.get('raceRoom') ||
      '';

    if (fromUrl) return norm(fromUrl).toUpperCase();

    const fromLS = getLS([
      'HHA_GROUPS_RACE_ROOM_CODE',
      'HHA_GROUPS_RACE_ROOM',
      'HHA_RACE_ROOM',
      'groupsRaceRoom',
      'groupsRaceRoomCode'
    ]);

    if (fromLS) return norm(fromLS).toUpperCase();

    const body = textOf(document.body);

    const m =
      body.match(/Room\s*Code\s*[:：]?\s*([A-Z0-9]{5,10})/i) ||
      body.match(/เข้าห้องแล้ว\s*[:：]?\s*([A-Z0-9]{5,10})/i) ||
      body.match(/รหัสห้อง\s*[:：]?\s*([A-Z0-9]{5,10})/i);

    if (m && m[1]) return norm(m[1]).toUpperCase();

    const candidates = body.match(/\b[A-Z0-9]{6}\b/g) || [];
    return candidates[0] ? candidates[0].toUpperCase() : '';
  }

  function detectPlayerName() {
    const fromUrl =
      qs.get('name') ||
      qs.get('player') ||
      qs.get('playerName') ||
      '';

    if (fromUrl) return norm(fromUrl);

    const fromLS = getLS([
      'HHA_PLAYER_NAME',
      'HHA_GROUPS_RACE_PLAYER_NAME',
      'groupsRacePlayerName'
    ]);

    if (fromLS) return norm(fromLS);

    const body = textOf(document.body);

    const m =
      body.match(/ผู้เล่น\s*[:：]?\s*([A-Za-z0-9ก-ฮะ-์ _.-]{2,30})/i) ||
      body.match(/Player\s*[:：]?\s*([A-Za-z0-9ก-ฮะ-์ _.-]{2,30})/i);

    if (m && m[1]) return norm(m[1]);

    return 'Hero';
  }

  function detectPid() {
    const fromUrl =
      qs.get('pid') ||
      qs.get('playerId') ||
      qs.get('uid') ||
      '';

    if (fromUrl) return norm(fromUrl);

    const fromLS = getLS([
      'HHA_GROUPS_RACE_PID',
      'HHA_PLAYER_PID',
      'groupsRacePid'
    ]);

    if (fromLS) return norm(fromLS);

    return '';
  }

  function roomPath(child) {
    return BASE + '/' + roomCode + (child ? '/' + child : '');
  }

  function playerNameOf(p) {
    return norm(
      p &&
      (
        p.name ||
        p.playerName ||
        p.nickname ||
        p.displayName ||
        p.label ||
        ''
      )
    );
  }

  function playerPidOf(p, key) {
    return norm(
      p &&
      (
        p.pid ||
        p.playerId ||
        p.uid ||
        p.id ||
        key ||
        ''
      )
    );
  }

  function isHostLike(p) {
    return !!(
      p &&
      (
        p.isHost === true ||
        p.host === true ||
        lower(p.role) === 'host' ||
        lower(p.type) === 'host'
      )
    );
  }

  function detectSelfKey(players) {
    players = players || playersCache || {};

    const keys = Object.keys(players || {});

    if (playerPid && players[playerPid]) return playerPid;

    for (const k of keys) {
      const p = players[k];
      if (playerPid && playerPidOf(p, k) === playerPid) return k;
    }

    const myName = lower(playerName);

    if (myName) {
      for (const k of keys) {
        const p = players[k];
        if (lower(playerNameOf(p)) === myName) return k;
      }
    }

    const body = lower(textOf(document.body));

    if (body.includes('host') || body.includes('คุณ')) {
      for (const k of keys) {
        if (isHostLike(players[k])) return k;
      }
    }

    return '';
  }

  function updatePlayer(data) {
    if (!roomCode || !ensureDb()) return Promise.resolve(false);

    selfKey = selfKey || detectSelfKey(playersCache);

    if (!selfKey) {
      selfKey = playerPid || playerName || ('p_' + now());
    }

    return db.ref(roomPath('players/' + selfKey)).update(data)
      .then(function () {
        return true;
      })
      .catch(function (err) {
        warn('update player failed', err && err.message ? err.message : err);
        return false;
      });
  }

  function readPlayersThen(cb) {
    if (!roomCode || !ensureDb()) {
      cb({});
      return;
    }

    db.ref(roomPath('players')).once('value')
      .then(function (snap) {
        cb(snap.val() || {});
      })
      .catch(function () {
        cb({});
      });
  }

  function injectStyle() {
    if (document.getElementById('hhaRacePlayBridgeV11Style')) return;

    const style = document.createElement('style');
    style.id = 'hhaRacePlayBridgeV11Style';
    style.textContent = `
      html,body{
        min-height:100%;
      }

      #hhaRacePlayV11{
        position:fixed;
        inset:0;
        z-index:999998;
        box-sizing:border-box;
        overflow:auto;
        padding:
          calc(14px + env(safe-area-inset-top,0px))
          max(14px,env(safe-area-inset-right,0px))
          calc(18px + env(safe-area-inset-bottom,0px))
          max(14px,env(safe-area-inset-left,0px));
        color:#fff;
        background:
          radial-gradient(circle at 50% 16%, rgba(56,189,248,.26), transparent 34%),
          linear-gradient(180deg,#07163f 0%,#08194c 46%,#0d2d80 100%);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .hha-race-wrap-v11{
        width:min(980px,100%);
        margin:0 auto;
      }

      .hha-race-top-v11{
        display:flex;
        gap:12px;
        align-items:center;
        justify-content:space-between;
        padding:12px;
        border-radius:24px;
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.15);
        box-shadow:0 18px 48px rgba(0,0,0,.25);
      }

      .hha-race-title-v11{
        display:flex;
        align-items:center;
        gap:12px;
        min-width:0;
      }

      .hha-race-icon-v11{
        width:58px;
        height:58px;
        border-radius:18px;
        display:grid;
        place-items:center;
        background:linear-gradient(135deg,#fef08a,#fdba74);
        font-size:32px;
        flex:0 0 auto;
      }

      .hha-race-title-v11 h1{
        margin:0;
        font-size:clamp(22px,5vw,36px);
        line-height:1.1;
      }

      .hha-race-title-v11 p{
        margin:4px 0 0;
        color:#c7d2fe;
        font-weight:800;
        font-size:clamp(13px,3.5vw,16px);
      }

      .hha-race-pill-v11{
        padding:10px 14px;
        border-radius:999px;
        background:rgba(34,197,94,.18);
        color:#bbf7d0;
        border:1px solid rgba(187,247,208,.32);
        font-weight:1000;
        white-space:nowrap;
      }

      .hha-race-board-v11{
        display:grid;
        grid-template-columns:1fr;
        gap:14px;
        margin-top:14px;
      }

      .hha-race-stats-v11{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:10px;
      }

      .hha-race-stat-v11{
        border-radius:20px;
        padding:12px;
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.14);
        text-align:center;
      }

      .hha-race-stat-v11 b{
        display:block;
        font-size:clamp(22px,7vw,36px);
        line-height:1.05;
      }

      .hha-race-stat-v11 span{
        display:block;
        margin-top:3px;
        color:#c7d2fe;
        font-size:13px;
        font-weight:900;
      }

      .hha-race-question-v11{
        border-radius:30px;
        padding:18px;
        background:rgba(255,255,255,.09);
        border:1px solid rgba(255,255,255,.16);
        text-align:center;
        box-shadow:0 20px 55px rgba(0,0,0,.26);
      }

      .hha-race-food-v11{
        width:min(260px,68vw);
        aspect-ratio:1;
        margin:6px auto 12px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:
          radial-gradient(circle at 35% 25%,rgba(255,255,255,.7),transparent 22%),
          linear-gradient(135deg,#86efac,#22c55e);
        border:8px solid rgba(255,255,255,.22);
        box-shadow:0 18px 48px rgba(34,197,94,.26);
      }

      .hha-race-food-v11 .emoji{
        display:block;
        font-size:clamp(68px,20vw,118px);
        line-height:1;
      }

      .hha-race-food-name-v11{
        margin:0;
        font-size:clamp(28px,8vw,48px);
        font-weight:1000;
        line-height:1.1;
      }

      .hha-race-hint-v11{
        margin:8px 0 0;
        color:#bfdbfe;
        font-weight:900;
        font-size:clamp(15px,4vw,18px);
      }

      .hha-race-options-v11{
        display:grid;
        grid-template-columns:repeat(5,1fr);
        gap:10px;
      }

      .hha-race-choice-v11{
        min-height:74px;
        border:0;
        border-radius:22px;
        padding:10px 8px;
        color:#07163f;
        background:linear-gradient(180deg,#ffffff,#dbeafe);
        font-weight:1000;
        font-size:clamp(14px,3.8vw,18px);
        line-height:1.15;
        box-shadow:0 10px 24px rgba(0,0,0,.22);
        cursor:pointer;
        touch-action:manipulation;
      }

      .hha-race-choice-v11:active{
        transform:scale(.97);
      }

      .hha-race-choice-v11.good{
        background:linear-gradient(180deg,#bbf7d0,#4ade80);
      }

      .hha-race-choice-v11.bad{
        background:linear-gradient(180deg,#fecaca,#fb7185);
      }

      .hha-race-feedback-v11{
        min-height:34px;
        margin-top:10px;
        font-weight:1000;
        font-size:clamp(18px,5vw,26px);
      }

      .hha-race-summary-v11{
        display:none;
        border-radius:30px;
        padding:18px;
        margin-top:14px;
        background:rgba(255,255,255,.1);
        border:1px solid rgba(255,255,255,.18);
        box-shadow:0 20px 55px rgba(0,0,0,.26);
        text-align:center;
      }

      .hha-race-summary-v11 h2{
        margin:4px 0 10px;
        font-size:clamp(28px,8vw,44px);
      }

      .hha-race-rank-list-v11{
        display:grid;
        gap:10px;
        margin-top:12px;
      }

      .hha-race-rank-row-v11{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:12px 14px;
        border-radius:18px;
        background:rgba(255,255,255,.09);
        border:1px solid rgba(255,255,255,.15);
        font-weight:1000;
      }

      .hha-race-actions-v11{
        display:flex;
        gap:10px;
        justify-content:center;
        flex-wrap:wrap;
        margin-top:14px;
      }

      .hha-race-action-v11{
        border:0;
        border-radius:18px;
        padding:13px 18px;
        font-weight:1000;
        font-size:16px;
        cursor:pointer;
      }

      .hha-race-action-primary-v11{
        color:#082f49;
        background:linear-gradient(180deg,#7dd3fc,#38bdf8);
      }

      .hha-race-action-warn-v11{
        color:#431407;
        background:linear-gradient(180deg,#fed7aa,#fb923c);
      }

      @media (max-width:700px){
        #hhaRacePlayV11{
          padding-left:10px;
          padding-right:10px;
        }

        .hha-race-top-v11{
          align-items:flex-start;
        }

        .hha-race-pill-v11{
          font-size:12px;
          padding:8px 10px;
        }

        .hha-race-stats-v11{
          grid-template-columns:repeat(2,1fr);
        }

        .hha-race-options-v11{
          grid-template-columns:repeat(2,1fr);
        }

        .hha-race-choice-v11:last-child{
          grid-column:1 / -1;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function buildGameShell() {
    injectStyle();

    let root = document.getElementById('hhaRacePlayV11');

    if (root) return root;

    root = document.createElement('main');
    root.id = 'hhaRacePlayV11';
    root.innerHTML = `
      <div class="hha-race-wrap-v11">
        <section class="hha-race-top-v11">
          <div class="hha-race-title-v11">
            <div class="hha-race-icon-v11">🏁</div>
            <div>
              <h1>Groups Race</h1>
              <p>แตะหมู่อาหารให้ถูก เร็ว และต่อเนื่อง</p>
            </div>
          </div>
          <div class="hha-race-pill-v11" id="hhaRaceRoomPillV11">Room</div>
        </section>

        <section class="hha-race-board-v11">
          <div class="hha-race-stats-v11">
            <div class="hha-race-stat-v11">
              <b id="hhaRaceTimeV11">45</b>
              <span>เวลา</span>
            </div>
            <div class="hha-race-stat-v11">
              <b id="hhaRaceScoreV11">0</b>
              <span>คะแนน</span>
            </div>
            <div class="hha-race-stat-v11">
              <b id="hhaRaceCorrectV11">0</b>
              <span>ถูก</span>
            </div>
            <div class="hha-race-stat-v11">
              <b id="hhaRaceComboV11">0</b>
              <span>Combo</span>
            </div>
          </div>

          <div class="hha-race-question-v11" id="hhaRaceQuestionV11">
            <div class="hha-race-food-v11">
              <span class="emoji" id="hhaRaceEmojiV11">🍚</span>
            </div>
            <h2 class="hha-race-food-name-v11" id="hhaRaceFoodNameV11">ข้าว</h2>
            <p class="hha-race-hint-v11">อาหารนี้อยู่หมู่ใด?</p>
            <div class="hha-race-feedback-v11" id="hhaRaceFeedbackV11"></div>
          </div>

          <div class="hha-race-options-v11" id="hhaRaceOptionsV11"></div>

          <section class="hha-race-summary-v11" id="hhaRaceSummaryV11">
            <h2>🏆 Race Summary</h2>
            <div id="hhaRaceSummaryTextV11"></div>
            <div class="hha-race-rank-list-v11" id="hhaRaceRankListV11"></div>
            <div class="hha-race-actions-v11">
              <button class="hha-race-action-v11 hha-race-action-primary-v11" id="hhaRaceAgainV11">🔁 เล่นอีกครั้ง</button>
              <button class="hha-race-action-v11 hha-race-action-warn-v11" id="hhaRaceBackLobbyV11">← กลับ Lobby</button>
              <button class="hha-race-action-v11 hha-race-action-warn-v11" id="hhaRaceBackModeV11">🏠 กลับโหมด</button>
            </div>
          </section>
        </section>
      </div>
    `;

    document.body.appendChild(root);

    return root;
  }

  function tryOriginalStart() {
    const names = [
      'HHA_GROUPS_RACE_PLAY',
      'HHA_GROUPS_RACE_START_PLAY',
      'HHA_GROUPS_RACE_RUN',
      'startRaceGameplay',
      'startRaceGame',
      'beginRaceGameplay',
      'beginRaceGame',
      'launchRaceGameplay',
      'launchRace',
      'startGame',
      'beginGame'
    ];

    for (const name of names) {
      try {
        if (typeof window[name] === 'function') {
          log('calling original gameplay function:', name);
          window[name]({
            room: roomCode,
            player: playerName,
            pid: playerPid,
            patch: PATCH
          });
          return true;
        }
      } catch (e) {
        warn('original start failed:', name, e);
      }
    }

    return false;
  }

  function stateFromQueryTime() {
    const t = Number(qs.get('time') || qs.get('duration') || 45);

    if (!Number.isFinite(t) || t < 20) return 45;
    if (t > 90) return 90;

    return Math.round(t);
  }

  function startFallbackGame(reason) {
    if (started) return;
    started = true;
    ended = false;

    log('startFallbackGame', reason);

    const root = buildGameShell();

    try {
      root.scrollTop = 0;
      window.scrollTo(0, 0);
    } catch (_) {}

    const state = {
      totalTime: stateFromQueryTime(),
      timeLeft: stateFromQueryTime(),
      score: 0,
      correct: 0,
      wrong: 0,
      combo: 0,
      maxCombo: 0,
      round: 0,
      current: null,
      locked: false,
      startedAt: now()
    };

    const roomPill = document.getElementById('hhaRaceRoomPillV11');
    const timeEl = document.getElementById('hhaRaceTimeV11');
    const scoreEl = document.getElementById('hhaRaceScoreV11');
    const correctEl = document.getElementById('hhaRaceCorrectV11');
    const comboEl = document.getElementById('hhaRaceComboV11');
    const emojiEl = document.getElementById('hhaRaceEmojiV11');
    const foodNameEl = document.getElementById('hhaRaceFoodNameV11');
    const feedbackEl = document.getElementById('hhaRaceFeedbackV11');
    const optionsEl = document.getElementById('hhaRaceOptionsV11');
    const questionEl = document.getElementById('hhaRaceQuestionV11');
    const summaryEl = document.getElementById('hhaRaceSummaryV11');
    const summaryTextEl = document.getElementById('hhaRaceSummaryTextV11');
    const rankListEl = document.getElementById('hhaRaceRankListV11');

    roomPill.textContent = 'Room ' + (roomCode || '-');

    optionsEl.innerHTML = GROUPS.map(function (g) {
      return '<button class="hha-race-choice-v11" data-g="' + g.id + '">' + g.text + '</button>';
    }).join('');

    function updateHud() {
      timeEl.textContent = String(Math.max(0, state.timeLeft));
      scoreEl.textContent = String(state.score);
      correctEl.textContent = String(state.correct);
      comboEl.textContent = String(state.combo);
    }

    function nextQuestion() {
      if (ended) return;

      state.locked = false;
      state.round += 1;
      state.current = FOODS[randInt(FOODS.length)];

      emojiEl.textContent = state.current.emoji;
      foodNameEl.textContent = state.current.name;
      feedbackEl.textContent = '';

      Array.from(optionsEl.querySelectorAll('button')).forEach(function (btn) {
        btn.disabled = false;
        btn.classList.remove('good', 'bad');
      });
    }

    function answer(groupId, btn) {
      if (state.locked || ended) return;

      state.locked = true;

      const ok = Number(groupId) === Number(state.current.group);

      Array.from(optionsEl.querySelectorAll('button')).forEach(function (b) {
        b.disabled = true;
      });

      if (ok) {
        state.correct += 1;
        state.combo += 1;
        state.maxCombo = Math.max(state.maxCombo, state.combo);
        state.score += 100 + Math.min(100, state.combo * 10);

        btn.classList.add('good');
        feedbackEl.textContent = '✅ ถูกต้อง! ' + state.current.label;
        feedbackEl.style.color = '#bbf7d0';
      } else {
        state.wrong += 1;
        state.combo = 0;
        state.score = Math.max(0, state.score - 30);

        btn.classList.add('bad');
        feedbackEl.textContent = '❌ คำตอบที่ถูกคือ ' + state.current.label;
        feedbackEl.style.color = '#fecaca';

        const correctBtn = optionsEl.querySelector('[data-g="' + state.current.group + '"]');
        if (correctBtn) correctBtn.classList.add('good');
      }

      updateHud();

      setTimeout(function () {
        if (!ended) nextQuestion();
      }, ok ? 520 : 850);
    }

    optionsEl.addEventListener('click', function (ev) {
      const btn = ev.target.closest('button[data-g]');
      if (!btn) return;
      answer(btn.getAttribute('data-g'), btn);
    });

    function finish() {
      if (ended) return;
      ended = true;

      const playedMs = now() - state.startedAt;
      const total = state.correct + state.wrong;
      const accuracy = total ? Math.round((state.correct / total) * 100) : 0;

      questionEl.style.display = 'none';
      optionsEl.style.display = 'none';
      summaryEl.style.display = 'block';

      summaryTextEl.innerHTML = `
        <div class="hha-race-stats-v11">
          <div class="hha-race-stat-v11"><b>${state.score}</b><span>คะแนน</span></div>
          <div class="hha-race-stat-v11"><b>${accuracy}%</b><span>Accuracy</span></div>
          <div class="hha-race-stat-v11"><b>${state.correct}</b><span>ถูก</span></div>
          <div class="hha-race-stat-v11"><b>${state.maxCombo}</b><span>Max Combo</span></div>
        </div>
      `;

      const result = {
        name: playerName || 'Hero',
        pid: playerPid || selfKey || '',
        score: state.score,
        accuracy: accuracy,
        correct: state.correct,
        wrong: state.wrong,
        total: total,
        maxCombo: state.maxCombo,
        playedMs: playedMs,
        finishedAt: now(),
        status: 'finished',
        phase: 'finished',
        patch: PATCH
      };

      setLS('HHA_GROUPS_RACE_LAST_RESULT', JSON.stringify(result));

      updatePlayer({
        result: result,
        lastResult: result,
        score: state.score,
        accuracy: accuracy,
        correct: state.correct,
        wrong: state.wrong,
        maxCombo: state.maxCombo,
        status: 'finished',
        phase: 'finished',
        finishedAt: result.finishedAt,
        patch: PATCH
      }).then(function () {
        renderRanking(rankListEl);
      });

      renderRanking(rankListEl);
    }

    function renderRanking(targetEl) {
      readPlayersThen(function (players) {
        const rows = Object.keys(players || {}).map(function (k) {
          const p = players[k] || {};
          const r = p.result || p.lastResult || p;

          return {
            key: k,
            name: playerNameOf(p) || r.name || k,
            score: Number(r.score || p.score || 0),
            accuracy: Number(r.accuracy || p.accuracy || 0),
            finished: lower(p.status) === 'finished' || lower(p.phase) === 'finished' || !!p.finishedAt
          };
        }).sort(function (a, b) {
          return b.score - a.score || b.accuracy - a.accuracy;
        });

        if (!rows.length) {
          targetEl.innerHTML = '<div class="hha-race-rank-row-v11">กำลังรอผลผู้เล่น...</div>';
          return;
        }

        targetEl.innerHTML = rows.map(function (r, i) {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏁';
          const wait = r.finished ? '' : ' · รอผล';
          return `
            <div class="hha-race-rank-row-v11">
              <span>${medal} ${i + 1}. ${r.name}${wait}</span>
              <span>${r.score} pts · ${r.accuracy}%</span>
            </div>
          `;
        }).join('');
      });
    }

    document.getElementById('hhaRaceAgainV11').onclick = function () {
      const ok = confirm('เล่น Race ห้องเดิมอีกครั้งหรือไม่?');
      if (!ok) return;
      location.reload();
    };

    document.getElementById('hhaRaceBackLobbyV11').onclick = function () {
      const url = new URL(location.href);
      url.searchParams.set('room', roomCode || '');
      url.searchParams.set('name', playerName || 'Hero');
      url.searchParams.delete('autostart');
      url.searchParams.delete('run');
      location.href = url.toString();
    };

    document.getElementById('hhaRaceBackModeV11').onclick = function () {
      const hub =
        qs.get('hub') ||
        '../groups-vr.html';

      location.href = hub;
    };

    updateHud();
    nextQuestion();

    updatePlayer({
      status: 'running',
      phase: 'running',
      runningAt: now(),
      patch: PATCH
    });

    const timer = setInterval(function () {
      if (ended) {
        clearInterval(timer);
        return;
      }

      state.timeLeft -= 1;
      updateHud();

      if (state.timeLeft <= 0) {
        clearInterval(timer);
        finish();
      }
    }, 1000);
  }

  function forceStart(reason) {
    if (started) return;

    roomCode = roomCode || detectRoomCode();
    playerName = playerName || detectPlayerName();
    playerPid = playerPid || detectPid();

    if (roomCode) {
      setLS('HHA_GROUPS_RACE_ROOM_CODE', roomCode);
      setLS('HHA_GROUPS_RACE_ROOM', roomCode);
    }

    if (playerName) {
      setLS('HHA_GROUPS_RACE_PLAYER_NAME', playerName);
    }

    log('forceStart', reason, {
      roomCode: roomCode,
      playerName: playerName,
      playerPid: playerPid
    });

    const originalStarted = tryOriginalStart();

    if (originalStarted) {
      setTimeout(function () {
        const stillWaiting = isStillWaitingRoom();

        if (stillWaiting && !started) {
          startFallbackGame(reason + ':fallback-after-original');
        }
      }, 1200);

      return;
    }

    startFallbackGame(reason);
  }

  function isStillWaitingRoom() {
    const body = lower(textOf(document.body));

    return (
      body.includes('groups race waiting room') ||
      body.includes('รอผู้เล่นพร้อม') ||
      body.includes('เข้าห้องแล้ว') ||
      body.includes('รอเพื่อนเข้าห้อง') ||
      body.includes('race start')
    );
  }

  function hasGoSignalInDom() {
    const body = lower(textOf(document.body));

    return (
      body.includes('go') &&
      (
        body.includes('พร้อมแข่งแล้ว') ||
        body.includes('race start') ||
        body.includes('ผู้เล่นครบอย่างน้อย 2 คน')
      )
    );
  }

  function hasStartLS() {
    if (!roomCode) roomCode = detectRoomCode();

    if (!roomCode) return false;

    const keys = [
      'HHA_GROUPS_RACE_FORCE_START_' + roomCode,
      'HHA_GROUPS_RACE_FORCE_START_SIGNAL_' + roomCode,
      'HHA_GROUPS_RACE_LAST_START_ROOM',
      'HHA_GROUPS_RACE_LAST_START_SIGNAL'
    ];

    return !!getLS(keys);
  }

  function attachStartEvent() {
    window.addEventListener('hha:groups-race-start-sync', function (ev) {
      log('received hha start event', ev && ev.detail);
      setTimeout(function () {
        forceStart('event:hha:groups-race-start-sync');
      }, 700);
    });

    document.addEventListener('hha:groups-race-start-sync', function (ev) {
      log('received document hha start event', ev && ev.detail);
      setTimeout(function () {
        forceStart('document-event:hha:groups-race-start-sync');
      }, 700);
    });
  }

  function attachFirebaseStartWatcher() {
    if (!roomCode || !ensureDb()) return;

    db.ref(roomPath('players')).on('value', function (snap) {
      const players = snap.val() || {};
      playersCache = players;
      selfKey = selfKey || detectSelfKey(players);

      const keys = Object.keys(players);

      const hasRunning = keys.some(function (k) {
        const p = players[k] || {};
        const phase = lower(p.phase);
        const status = lower(p.status);
        const sig = lower(p.signal || p.raceSignal);

        return (
          phase === 'countdown' ||
          phase === 'running' ||
          status === 'running' ||
          sig === 'race-start' ||
          p.raceStarted === true ||
          p.started === true ||
          p.start === true
        );
      });

      if (hasRunning && !started) {
        setTimeout(function () {
          forceStart('firebase:players-running');
        }, 600);
      }
    });

    ['raceState', 'state', 'meta'].forEach(function (child) {
      db.ref(roomPath(child)).on('value', function (snap) {
        const v = snap.val();

        if (!v || started) return;

        const phase = lower(v.phase);
        const status = lower(v.status);
        const sig = lower(v.signal || v.raceSignal);

        if (
          phase === 'countdown' ||
          phase === 'running' ||
          status === 'running' ||
          sig === 'race-start' ||
          v.raceStarted === true ||
          v.started === true ||
          v.start === true
        ) {
          setTimeout(function () {
            forceStart('firebase:' + child);
          }, 600);
        }
      });
    });
  }

  function interceptStartClick() {
    document.addEventListener('click', function (ev) {
      const target = ev.target && ev.target.closest
        ? ev.target.closest('button,a,[role="button"],.btn,.button')
        : null;

      if (!target) return;

      const txt = lower(textOf(target));

      if (
        txt.includes('เริ่มแข่ง') ||
        txt.includes('race start') ||
        txt === 'start' ||
        txt === 'go'
      ) {
        setTimeout(function () {
          forceStart('click:start-button');
        }, 900);
      }
    }, true);
  }

  function boot() {
    roomCode = detectRoomCode();
    playerName = detectPlayerName();
    playerPid = detectPid();

    log('boot', {
      patch: PATCH,
      roomCode: roomCode,
      playerName: playerName,
      playerPid: playerPid,
      href: location.href
    });

    attachStartEvent();
    interceptStartClick();

    let tries = 0;

    const timer = setInterval(function () {
      tries += 1;

      if (!roomCode) roomCode = detectRoomCode();

      if (roomCode && ensureDb()) {
        attachFirebaseStartWatcher();
        clearInterval(timer);
      }

      if (!started && hasGoSignalInDom()) {
        clearInterval(timer);
        setTimeout(function () {
          forceStart('dom:go-signal');
        }, 900);
      }

      if (!started && hasStartLS()) {
        clearInterval(timer);
        setTimeout(function () {
          forceStart('localStorage:start-signal');
        }, 900);
      }

      if (tries >= 80) {
        clearInterval(timer);
      }
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();