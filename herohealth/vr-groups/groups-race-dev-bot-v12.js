/* =========================================================
   HeroHealth • Groups Race Dev Bot / Single-device Tester
   File: /herohealth/vr-groups/groups-race-dev-bot-v12.js
   PATCH: v20260604-GROUPS-RACE-DEV-BOT-V12

   Purpose:
   - ใช้ทดสอบ Groups Race ด้วยเครื่องเดียว
   - เพิ่ม Bot Player เข้า Firebase เป็นผู้เล่นคนที่ 2
   - ช่วยปลดล็อก Start แบบ Race Standard 2 players
   - จำลองผลคะแนน Bot เพื่อให้ Summary / Ranking ทดสอบได้
   - ทำงานเฉพาะเมื่อเปิด URL ด้วย ?mock=1 หรือ ?dev=1 หรือ ?bot=1
   ========================================================= */

(function () {
  'use strict';

  const PATCH = 'v20260604-GROUPS-RACE-DEV-BOT-V12';
  const BASE = 'herohealth/groups/raceRooms';

  if (window.__HHA_GROUPS_RACE_DEV_BOT_V12__) return;
  window.__HHA_GROUPS_RACE_DEV_BOT_V12__ = true;

  const qs = new URLSearchParams(location.search || '');

  const ENABLED =
    qs.get('mock') === '1' ||
    qs.get('dev') === '1' ||
    qs.get('bot') === '1' ||
    qs.get('testBot') === '1' ||
    localStorage.getItem('HHA_GROUPS_RACE_DEV_BOT') === '1';

  if (!ENABLED) return;

  let db = null;
  let roomCode = '';
  let botKey = '';
  let botName = qs.get('botName') || 'RaceBot';
  let botAdded = false;
  let botRunning = false;
  let botFinished = false;
  let botTimer = null;
  let playersCache = {};

  function log() {
    try {
      console.log('[GroupsRaceDevBot]', ...arguments);
    } catch (_) {}
  }

  function warn() {
    try {
      console.warn('[GroupsRaceDevBot]', ...arguments);
    } catch (_) {}
  }

  function norm(v) {
    return String(v || '').trim();
  }

  function lower(v) {
    return norm(v).toLowerCase();
  }

  function now() {
    return Date.now();
  }

  function textOf(el) {
    return String((el && (el.innerText || el.textContent)) || '').trim();
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

  function roomPath(child) {
    return BASE + '/' + roomCode + (child ? '/' + child : '');
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

    const filtered = candidates.filter(function (x) {
      return !/GROUPS|RACE|PLAYER|NORMAL|MOBILE|FIREBASE/i.test(x);
    });

    return filtered[0] ? filtered[0].toUpperCase() : '';
  }

  function getDurationSec() {
    const t = Number(qs.get('time') || qs.get('duration') || 45);

    if (!Number.isFinite(t)) return 45;
    if (t < 20) return 20;
    if (t > 90) return 90;

    return Math.round(t);
  }

  function makeBotKey() {
    if (botKey) return botKey;

    const saved = getLS(['HHA_GROUPS_RACE_DEV_BOT_KEY']);

    if (saved) {
      botKey = saved;
      return botKey;
    }

    botKey = 'devbot_' + Math.random().toString(36).slice(2, 8).toUpperCase();
    setLS('HHA_GROUPS_RACE_DEV_BOT_KEY', botKey);

    return botKey;
  }

  function playerNameOf(p, key) {
    return norm(
      p &&
      (
        p.name ||
        p.playerName ||
        p.nickname ||
        p.displayName ||
        p.label ||
        key ||
        ''
      )
    );
  }

  function isBotPlayer(p, key) {
    if (!p) return false;

    return (
      p.isBot === true ||
      p.devBot === true ||
      lower(p.role) === 'bot' ||
      lower(p.type) === 'bot' ||
      String(key || '').indexOf('devbot_') === 0
    );
  }

  function updateBot(data) {
    if (!roomCode || !ensureDb()) return Promise.resolve(false);

    makeBotKey();

    const payload = Object.assign({
      pid: botKey,
      id: botKey,
      name: botName,
      playerName: botName,
      nickname: botName,
      role: 'bot',
      type: 'bot',
      isBot: true,
      devBot: true,
      view: 'bot',
      diff: qs.get('diff') || 'normal',
      ready: true,
      updatedAt: now(),
      patch: PATCH
    }, data || {});

    return db.ref(roomPath('players/' + botKey)).update(payload)
      .then(function () {
        botAdded = true;
        renderPanel();
        return true;
      })
      .catch(function (err) {
        warn('update bot failed', err && err.message ? err.message : err);
        renderPanel('เขียน Bot ไม่สำเร็จ');
        return false;
      });
  }

  function addBot() {
    if (!roomCode) roomCode = detectRoomCode();

    if (!roomCode) {
      renderPanel('ยังไม่เจอ Room Code');
      return Promise.resolve(false);
    }

    if (!ensureDb()) {
      renderPanel('Firebase ยังไม่พร้อม');
      return Promise.resolve(false);
    }

    makeBotKey();

    const data = {
      status: 'ready',
      state: 'ready',
      phase: 'ready',
      joinedAt: now(),
      readyAt: now(),
      score: 0,
      correct: 0,
      wrong: 0,
      accuracy: 0,
      maxCombo: 0
    };

    return updateBot(data).then(function (ok) {
      if (ok) {
        renderPanel('เพิ่ม Bot แล้ว');
        attachBotDisconnect();
      }

      return ok;
    });
  }

  function attachBotDisconnect() {
    if (!roomCode || !ensureDb() || !botKey) return;

    try {
      db.ref(roomPath('players/' + botKey)).onDisconnect().remove();
    } catch (e) {
      warn('onDisconnect not available', e);
    }
  }

  function removeBot() {
    if (!roomCode || !ensureDb()) return;

    makeBotKey();

    try {
      db.ref(roomPath('players/' + botKey)).remove()
        .then(function () {
          botAdded = false;
          botRunning = false;
          botFinished = false;

          if (botTimer) {
            clearInterval(botTimer);
            botTimer = null;
          }

          renderPanel('ลบ Bot แล้ว');
        })
        .catch(function (err) {
          warn('remove bot failed', err && err.message ? err.message : err);
          renderPanel('ลบ Bot ไม่สำเร็จ');
        });
    } catch (e) {
      warn('remove bot exception', e);
    }
  }

  function writeStartSignal() {
    if (!roomCode || !ensureDb()) return;

    const t = now();

    const signal = {
      room: roomCode,
      phase: 'countdown',
      status: 'running',
      signal: 'race-start',
      raceSignal: 'race-start',
      raceStarted: true,
      start: true,
      started: true,
      startSeq: t,
      startedAt: t,
      raceStartAt: t,
      hostStartAt: t,
      reason: 'dev-bot-start',
      patch: PATCH
    };

    const jobs = [
      db.ref(roomPath('raceState')).update(signal).catch(function () { return false; }),
      db.ref(roomPath('state')).update(signal).catch(function () { return false; }),
      db.ref(roomPath('meta')).update({
        phase: 'countdown',
        status: 'running',
        startedAt: t,
        startSeq: t,
        patch: PATCH
      }).catch(function () { return false; })
    ];

    Promise.all(jobs).then(function () {
      renderPanel('ส่ง Start Signal แล้ว');
      startBotRaceSimulation();
    });
  }

  function startBotRaceSimulation() {
    if (botRunning || botFinished) return;

    botRunning = true;
    botFinished = false;

    const duration = getDurationSec();
    const startedAt = now();

    updateBot({
      status: 'running',
      state: 'running',
      phase: 'running',
      runningAt: startedAt,
      score: 0,
      correct: 0,
      wrong: 0,
      accuracy: 0,
      maxCombo: 0
    });

    if (botTimer) {
      clearInterval(botTimer);
      botTimer = null;
    }

    botTimer = setInterval(function () {
      const elapsed = Math.floor((now() - startedAt) / 1000);
      const progress = Math.min(1, elapsed / duration);

      const correct = Math.max(0, Math.floor(progress * 12 + Math.random() * 2));
      const wrong = Math.max(0, Math.floor(progress * 4));
      const total = correct + wrong;
      const accuracy = total ? Math.round((correct / total) * 100) : 0;
      const maxCombo = Math.max(1, Math.floor(2 + progress * 6));
      const score = Math.max(0, correct * 105 + maxCombo * 15 - wrong * 25);

      updateBot({
        status: 'running',
        state: 'running',
        phase: 'running',
        score: score,
        correct: correct,
        wrong: wrong,
        accuracy: accuracy,
        maxCombo: maxCombo,
        updatedAt: now()
      });

      if (elapsed >= duration) {
        clearInterval(botTimer);
        botTimer = null;
        finishBotRace();
      }
    }, 3000);
  }

  function finishBotRace() {
    if (botFinished) return;

    botRunning = false;
    botFinished = true;

    const correct = 8 + Math.floor(Math.random() * 5);
    const wrong = 2 + Math.floor(Math.random() * 3);
    const total = correct + wrong;
    const accuracy = Math.round((correct / total) * 100);
    const maxCombo = 4 + Math.floor(Math.random() * 5);
    const score = correct * 110 + maxCombo * 20 - wrong * 25;

    const result = {
      name: botName,
      pid: botKey,
      isBot: true,
      score: score,
      accuracy: accuracy,
      correct: correct,
      wrong: wrong,
      total: total,
      maxCombo: maxCombo,
      status: 'finished',
      phase: 'finished',
      finishedAt: now(),
      patch: PATCH
    };

    updateBot({
      result: result,
      lastResult: result,
      score: score,
      accuracy: accuracy,
      correct: correct,
      wrong: wrong,
      total: total,
      maxCombo: maxCombo,
      status: 'finished',
      state: 'finished',
      phase: 'finished',
      finishedAt: result.finishedAt
    }).then(function () {
      renderPanel('Bot แข่งจบแล้ว');
    });
  }

  function hasStartSignal(v) {
    if (!v || typeof v !== 'object') return false;

    const phase = lower(v.phase);
    const status = lower(v.status);
    const signal = lower(v.signal || v.raceSignal || v.action);

    return (
      v.raceStarted === true ||
      v.start === true ||
      v.started === true ||
      !!v.startedAt ||
      !!v.startSeq ||
      phase === 'countdown' ||
      phase === 'running' ||
      status === 'running' ||
      signal === 'race-start' ||
      signal === 'running'
    );
  }

  function watchRoom() {
    if (!roomCode || !ensureDb()) return;

    db.ref(roomPath('players')).on('value', function (snap) {
      const players = snap.val() || {};
      playersCache = players;

      const keys = Object.keys(players);
      const botExists = keys.some(function (k) {
        return isBotPlayer(players[k], k);
      });

      botAdded = botExists;

      const running = keys.some(function (k) {
        return hasStartSignal(players[k]) || lower(players[k] && players[k].phase) === 'running';
      });

      if (running && botAdded && !botRunning && !botFinished) {
        startBotRaceSimulation();
      }

      renderPanel();
    });

    ['raceState', 'state', 'meta'].forEach(function (child) {
      db.ref(roomPath(child)).on('value', function (snap) {
        const v = snap.val();

        if (hasStartSignal(v) && botAdded && !botRunning && !botFinished) {
          startBotRaceSimulation();
        }
      });
    });
  }

  function injectStyle() {
    if (document.getElementById('hhaRaceDevBotV12Style')) return;

    const style = document.createElement('style');
    style.id = 'hhaRaceDevBotV12Style';
    style.textContent = `
      #hhaRaceDevBotV12{
        position:fixed;
        right:10px;
        bottom:calc(10px + env(safe-area-inset-bottom,0px));
        z-index:999999;
        width:min(320px,calc(100vw - 20px));
        box-sizing:border-box;
        padding:12px;
        border-radius:22px;
        color:#fff;
        background:rgba(15,23,42,.94);
        border:1px solid rgba(255,255,255,.22);
        box-shadow:0 18px 48px rgba(0,0,0,.36);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      #hhaRaceDevBotV12 h3{
        margin:0 0 6px;
        font-size:16px;
        line-height:1.2;
      }

      #hhaRaceDevBotV12 p{
        margin:0 0 8px;
        color:#c7d2fe;
        font-size:12px;
        line-height:1.35;
        font-weight:800;
      }

      .hha-devbot-row-v12{
        display:flex;
        gap:6px;
        flex-wrap:wrap;
      }

      .hha-devbot-btn-v12{
        flex:1 1 auto;
        min-width:86px;
        border:0;
        border-radius:14px;
        padding:9px 10px;
        font-size:13px;
        font-weight:1000;
        cursor:pointer;
        color:#06142f;
        background:linear-gradient(180deg,#bfdbfe,#60a5fa);
      }

      .hha-devbot-btn-warn-v12{
        background:linear-gradient(180deg,#fed7aa,#fb923c);
      }

      .hha-devbot-btn-danger-v12{
        color:#fff;
        background:linear-gradient(180deg,#fb7185,#e11d48);
      }

      .hha-devbot-mini-v12{
        margin-top:7px;
        padding-top:7px;
        border-top:1px solid rgba(255,255,255,.14);
        color:#bbf7d0;
        font-size:12px;
        font-weight:900;
      }
    `;

    document.head.appendChild(style);
  }

  function renderPanel(message) {
    injectStyle();

    let panel = document.getElementById('hhaRaceDevBotV12');

    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'hhaRaceDevBotV12';
      document.body.appendChild(panel);
    }

    const playerCount = Object.keys(playersCache || {}).length;

    panel.innerHTML = `
      <h3>🤖 Race Dev Bot</h3>
      <p>
        Single-device test mode<br>
        Room: <b>${roomCode || '-'}</b> · Players: <b>${playerCount}</b>
      </p>
      <div class="hha-devbot-row-v12">
        <button class="hha-devbot-btn-v12" id="hhaDevBotAddV12">+ Bot</button>
        <button class="hha-devbot-btn-v12 hha-devbot-btn-warn-v12" id="hhaDevBotStartV12">Start</button>
        <button class="hha-devbot-btn-v12 hha-devbot-btn-danger-v12" id="hhaDevBotRemoveV12">ลบ Bot</button>
      </div>
      <div class="hha-devbot-mini-v12">
        ${message || (botAdded ? 'Bot พร้อมแล้ว' : 'กด + Bot เพื่อจำลองผู้เล่นคนที่ 2')}
      </div>
    `;

    const addBtn = document.getElementById('hhaDevBotAddV12');
    const startBtn = document.getElementById('hhaDevBotStartV12');
    const removeBtn = document.getElementById('hhaDevBotRemoveV12');

    if (addBtn) addBtn.onclick = addBot;
    if (startBtn) startBtn.onclick = function () {
      addBot().then(function () {
        writeStartSignal();
      });
    };
    if (removeBtn) removeBtn.onclick = removeBot;
  }

  function boot() {
    localStorage.setItem('HHA_GROUPS_RACE_DEV_BOT', '1');

    let tries = 0;

    renderPanel('กำลังหา Room Code...');

    const timer = setInterval(function () {
      tries += 1;

      if (!roomCode) roomCode = detectRoomCode();

      if (roomCode && ensureDb()) {
        clearInterval(timer);

        setLS('HHA_GROUPS_RACE_ROOM_CODE', roomCode);
        setLS('HHA_GROUPS_RACE_ROOM', roomCode);

        log('boot', {
          patch: PATCH,
          roomCode: roomCode,
          botKey: makeBotKey(),
          href: location.href
        });

        watchRoom();

        setTimeout(function () {
          addBot();
        }, 500);

        renderPanel('Dev Bot พร้อมทำงาน');
      }

      if (tries >= 60) {
        clearInterval(timer);
        renderPanel('ยังไม่เจอ Room/Firebase');
      }
    }, 250);
  }

  window.addEventListener('beforeunload', function () {
    /*
      ไม่ remove ทันทีทุกครั้ง เพราะบางรอบ reload เพื่อ test ต่อ
      ใช้ onDisconnect เป็นหลัก
    */
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
