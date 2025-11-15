// === Hero Health — game/main.js (Multi-mode + Goal + Mini Quest + CSV) ===
(function(){
  'use strict';

  // --------------------------------------------------
  // URL Params + Player Profile
  // --------------------------------------------------
  const url = new URL(window.location.href);

  const MODE_ID = (url.searchParams.get('mode') || 'goodjunk').toLowerCase();
  const DIFF    = (url.searchParams.get('diff') || 'normal').toLowerCase();

  let timeParam = parseInt(url.searchParams.get('time'), 10);
  if (isNaN(timeParam) || timeParam <= 0) timeParam = 60;
  if (timeParam < 20) timeParam = 20;
  if (timeParam > 180) timeParam = 180;
  const GAME_DURATION = timeParam;

  const PLAYER_NAME = url.searchParams.get('stName') || '';
  const PLAYER_ROOM = url.searchParams.get('stRoom') || '';
  const PLAYER_AGE  = url.searchParams.get('stAge')  || '';

  // --------------------------------------------------
  // Base Config (โหมดพื้นฐาน ถ้าไม่มี HH_MODES)
  // --------------------------------------------------
  let SPAWN_INTERVAL      = 650;
  let ITEM_LIFETIME       = 1400;
  let MAX_ACTIVE          = 4;
  let MISSION_GOOD_TARGET = 20;
  let SIZE_FACTOR         = 1.0;

  let TYPE_WEIGHTS = {
    good:   45,
    junk:   30,
    star:    7,
    gold:    6,
    diamond: 5,
    shield:  3,
    fever:   4,
    rainbow: 0
  };

  let FEVER_DURATION       = 5;
  let DIAMOND_TIME_BONUS   = 2;

  // ปรับตาม diff เบื้องต้น (ถ้าโหมดไม่ override)
  (function applyDiffBase(){
    switch (DIFF) {
      case 'easy':
        SPAWN_INTERVAL = 950;
        ITEM_LIFETIME = 2000;
        MAX_ACTIVE = 3;
        MISSION_GOOD_TARGET = 15;
        SIZE_FACTOR = 1.25;
        TYPE_WEIGHTS = {
          good:   60,
          junk:   15,
          star:    8,
          gold:    7,
          diamond: 4,
          shield:  4,
          fever:   2,
          rainbow: 0
        };
        FEVER_DURATION = 4;
        DIAMOND_TIME_BONUS = 3;
        break;
      case 'hard':
        SPAWN_INTERVAL = 430;
        ITEM_LIFETIME = 900;
        MAX_ACTIVE = 7;
        MISSION_GOOD_TARGET = 30;
        SIZE_FACTOR = 0.85;
        TYPE_WEIGHTS = {
          good:   30,
          junk:   45,
          star:    5,
          gold:    5,
          diamond: 5,
          shield:  2,
          fever:   8,
          rainbow: 0
        };
        FEVER_DURATION = 7;
        DIAMOND_TIME_BONUS = 1;
        break;
      case 'normal':
      default:
        // ใช้ค่าด้านบน
        break;
    }
  })();

  // --------------------------------------------------
  // Mode API (จาก mode.goodjunk.js / mode.groups.js)
  // --------------------------------------------------
  const MODES = (window.HH_MODES || {});
  const MODE_API = MODES[MODE_ID] || null;

  let missionTextCached = '';

  if (MODE_API && typeof MODE_API.setupForDiff === 'function') {
    try {
      const cfg = MODE_API.setupForDiff(DIFF) || {};
      if (cfg.SPAWN_INTERVAL != null)      SPAWN_INTERVAL      = cfg.SPAWN_INTERVAL;
      if (cfg.ITEM_LIFETIME != null)       ITEM_LIFETIME       = cfg.ITEM_LIFETIME;
      if (cfg.MAX_ACTIVE != null)          MAX_ACTIVE          = cfg.MAX_ACTIVE;
      if (cfg.MISSION_GOOD_TARGET != null) MISSION_GOOD_TARGET = cfg.MISSION_GOOD_TARGET;
      if (cfg.SIZE_FACTOR != null)         SIZE_FACTOR         = cfg.SIZE_FACTOR;
      if (cfg.TYPE_WEIGHTS != null)        TYPE_WEIGHTS        = cfg.TYPE_WEIGHTS;
      if (cfg.FEVER_DURATION != null)      FEVER_DURATION      = cfg.FEVER_DURATION;
      if (cfg.DIAMOND_TIME_BONUS != null)  DIAMOND_TIME_BONUS  = cfg.DIAMOND_TIME_BONUS;
    } catch (err) {
      console.warn('[HHA] mode setup error', err);
    }
  }

  if (MODE_API && typeof MODE_API.missionText === 'function') {
    missionTextCached = MODE_API.missionText(MISSION_GOOD_TARGET);
  } else {
    missionTextCached = 'ภารกิจ: เก็บของดีให้ครบ ' + MISSION_GOOD_TARGET + ' ชิ้น';
  }

  // --------------------------------------------------
  // Emoji fallback (ถ้าโหมดไม่ override pickEmoji)
  // --------------------------------------------------
  const FALLBACK_GOOD   = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
  const FALLBACK_JUNK   = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
  const FALLBACK_STAR   = ['⭐','🌟'];
  const FALLBACK_GOLD   = ['🥇','🏅','🪙'];
  const FALLBACK_DIAM   = ['💎'];
  const FALLBACK_SHIELD = ['🛡️'];
  const FALLBACK_FEVER  = ['🔥'];
  const FALLBACK_RAIN   = ['🌈'];

  function pickRandom(arr){
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickEmoji(type){
    if (MODE_API && typeof MODE_API.pickEmoji === 'function') {
      return MODE_API.pickEmoji(type);
    }
    // fallback Good vs Junk เดิม
    if (type === 'good')    return pickRandom(FALLBACK_GOOD);
    if (type === 'junk')    return pickRandom(FALLBACK_JUNK);
    if (type === 'star')    return pickRandom(FALLBACK_STAR);
    if (type === 'gold')    return pickRandom(FALLBACK_GOLD);
    if (type === 'diamond') return pickRandom(FALLBACK_DIAM);
    if (type === 'shield')  return pickRandom(FALLBACK_SHIELD);
    if (type === 'fever')   return pickRandom(FALLBACK_FEVER);
    if (type === 'rainbow') return pickRandom(FALLBACK_RAIN);
    return '❓';
  }

  // --------------------------------------------------
  // GAME STATE
  // --------------------------------------------------
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let timeLeft = GAME_DURATION;
  let running = false;
  let spawnTimer = null;
  let tickTimer = null;

  let missionGoodCount = 0;
  let activeItems = 0;

  let shieldCharges = 0;
  let feverTicksLeft = 0;

  // Metrics สำหรับ Mini Quests
  let badHits = 0;
  let elapsedSec = 0;
  let lastBadTime = 0;
  let maxNoBadStreak = 0;
  let powerupHits = 0;
  let feverActivations = 0;
  let fastHitAchieved = false;
  let scoreAt20s = 0;
  let recordedScoreAt20 = false;

  const hitEvents = []; // {timeSec,type,isGood,isBad,reactionSec}

  // Mini Quest State
  const QUEST_DEFS = [
    { id:'streak3',  icon:'⚡', text:'คอมโบ ≥ 3',           check:m=>m.maxCombo >= 3 },
    { id:'streak5',  icon:'⚡', text:'คอมโบ ≥ 5',           check:m=>m.maxCombo >= 5 },
    { id:'streak10', icon:'⚡', text:'คอมโบ ≥ 10',          check:m=>m.maxCombo >= 10 },
    { id:'fast1',    icon:'⏱', text:'แตะเป้าให้ทัน ≤ 1 วิ', check:m=>m.fastHitAchieved },
    { id:'noBad10',  icon:'🛡', text:'ไม่พลาดเลย 10 วิ',    check:m=>m.maxNoBadStreak >= 10 },
    { id:'power1',   icon:'⭐', text:'เก็บ Power-up ≥ 1',    check:m=>m.powerupHits >= 1 },
    { id:'fever1',   icon:'🔥', text:'เข้า Fever ≥ 1 ครั้ง', check:m=>m.feverActivations >= 1 },
    { id:'score200', icon:'💥', text:'คะแนน ≥ 200 ใน 20 วิ', check:m=>m.scoreAt20s >= 200 },
    { id:'noBad5',   icon:'🛡', text:'ไม่พลาดเลย 5 วิ',     check:m=>m.maxNoBadStreak >= 5 },
    { id:'streak8',  icon:'⚡', text:'คอมโบ ≥ 8',            check:m=>m.maxCombo >= 8 }
  ];

  let activeQuests = []; // {id, icon, text, done}
  let allQuestsClearedOnce = false;

  // --------------------------------------------------
  // DOM Helpers
  // --------------------------------------------------
  function $(sel){ return document.querySelector(sel); }

  function createHost(){
    let host = $('#hha-dom-host');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'hha-dom-host';
    Object.assign(host.style,{
      position:'fixed',
      inset:'0',
      pointerEvents:'none',
      zIndex:'9000'
    });
    document.body.appendChild(host);
    return host;
  }

  function createFXLayer(){
    let fx = $('#hha-fx-layer');
    if (fx) return fx;
    fx = document.createElement('div');
    fx.id = 'hha-fx-layer';
    Object.assign(fx.style,{
      position:'fixed',
      inset:'0',
      pointerEvents:'none',
      zIndex:'9050',
      overflow:'hidden'
    });
    document.body.appendChild(fx);
    return fx;
  }

  function ensureGameCSS(){
    if (document.getElementById('hha-game-css')) return;
    const st = document.createElement('style');
    st.id = 'hha-game-css';
    st.textContent = `
      @keyframes hha-float {
        0%   { transform: translate3d(0,0,0); }
        50%  { transform: translate3d(0,-12px,0); }
        100% { transform: translate3d(0,0,0); }
      }

      @media (max-width: 720px) {
        #hha-hud-inner {
          padding: 8px 12px;
          font-size: 12px;
          min-width: 220px;
        }
        #hha-hud-inner #hha-score,
        #hha-hud-inner #hha-combo {
          font-size: 16px;
        }
        #hha-timebox {
          font-size: 11px;
          padding: 4px 10px;
        }
      }

      @media (max-width: 480px) {
        #hha-hud-inner {
          padding: 6px 10px;
          font-size: 11px;
          min-width: 200px;
        }
        #hha-hud-inner #hha-score,
        #hha-hud-inner #hha-combo {
          font-size: 14px;
        }
        #hha-buffs {
          font-size: 10px;
        }
        #hha-timebox {
          font-size: 10px;
          padding: 3px 8px;
        }
      }

      #hha-quests {
        position:fixed;
        left:12px;
        bottom:12px;
        z-index:9100;
        max-width:260px;
        font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
        font-size:11px;
        color:#e5e7eb;
      }
      .hha-quest-panel{
        background:rgba(15,23,42,0.92);
        border-radius:14px;
        border:1px solid rgba(148,163,184,0.8);
        padding:8px 10px;
        box-shadow:0 10px 30px rgba(0,0,0,0.7);
      }
      .hha-quest-title{
        font-size:11px;
        margin-bottom:4px;
        color:#cbd5f5;
      }
      .hha-quest-row{
        display:flex;
        align-items:flex-start;
        gap:6px;
        margin-bottom:3px;
      }
      .hha-quest-icon{
        width:18px;height:18px;
        display:flex;
        align-items:center;
        justify-content:center;
      }
      .hha-quest-text{
        flex:1;
      }
      .hha-quest-row.done .hha-quest-text{
        color:#bbf7d0;
        text-decoration:underline;
      }
      .hha-quest-row.done .hha-quest-icon{
        filter:drop-shadow(0 0 6px rgba(34,197,94,0.9));
      }
    `;
    document.head.appendChild(st);
  }

  function createHUD(){
    let hud = $('#hha-hud');
    if (hud) return hud;

    hud = document.createElement('div');
    hud.id = 'hha-hud';

    hud.innerHTML = `
      <div id="hha-hud-inner"
        style="
          position:fixed;top:16px;left:50%;
          transform:translateX(-50%);
          background:rgba(15,23,42,0.95);
          border-radius:16px;padding:10px 18px;
          display:flex;flex-direction:column;gap:6px;
          box-shadow:0 18px 40px rgba(0,0,0,0.65);
          border:1px solid rgba(51,65,85,0.9);
          z-index:9100;
          font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
          font-size:14px;min-width:260px;
        "
      >
        <div style="display:flex;gap:18px;justify-content:space-between;">
          <div>
            <div>คะแนน</div>
            <div id="hha-score"
              style="text-align:right;font-weight:700;font-size:18px;">
              0
            </div>
          </div>
          <div>
            <div>คอมโบ</div>
            <div id="hha-combo"
              style="text-align:right;font-weight:700;font-size:18px;">
              0
            </div>
          </div>
        </div>

        <div style="font-size:12px;color:#cbd5f5;display:flex;flex-direction:column;gap:4px;">
          <div id="hha-mission-text"></div>

          <div style="
            width:100%;height:6px;border-radius:999px;
            background:rgba(15,23,42,0.9);
            overflow:hidden;
            border:1px solid rgba(148,163,184,0.7);">
            <div id="hha-mission-bar"
              style="width:0%;height:100%;border-radius:999px;
                     background:linear-gradient(90deg,#22c55e,#16a34a);">
            </div>
          </div>

          <div id="hha-buffs" style="margin-top:2px;">
            ⭐ คอมโบสูงสุด: <span id="hha-buff-star">0</span> |
            🛡 เกราะ: <span id="hha-buff-shield">0</span> |
            🔥 Fever: <span id="hha-buff-fever">0</span>s
          </div>
        </div>
      </div>

      <div id="hha-timebox"
        style="
          position:fixed;top:16px;right:16px;
          background:rgba(15,23,42,0.95);
          border-radius:999px;padding:6px 14px;
          border:1px solid rgba(148,163,184,0.9);
          font-size:13px;z-index:9100;
          font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
        ">
        ${MODE_ID.toUpperCase()} • ${DIFF.toUpperCase()} • <span id="hha-time"></span>s
      </div>

      <div id="hha-result"
        style="position:fixed;inset:0;display:none;
               align-items:center;justify-content:center;z-index:9200;">
        <div style="
          background:rgba(15,23,42,0.97);
          border-radius:18px;padding:20px 26px;
          min-width:260px;border:1px solid rgba(34,197,94,0.8);
          text-align:center;box-shadow:0 18px 40px rgba(0,0,0,0.75);
          font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
        ">
          <h2 id="hha-result-title"
            style="margin-top:0;margin-bottom:8px;font-size:18px;">
            จบรอบแล้ว 🎉
          </h2>

          <div style="font-size:12px;color:#cbd5f5;margin-bottom:8px;">
            <div id="hha-player-line"></div>
          </div>

          <div style="margin-bottom:4px;">
            คะแนนรวม: <b id="hha-final-score">0</b>
          </div>
          <div style="margin-bottom:4px;">
            คอมโบสูงสุด: <b id="hha-final-combo">0</b>
          </div>
          <div style="margin-bottom:10px;">
            ของดีที่เก็บได้:
            <b id="hha-final-good">0</b> / <span id="hha-final-target">0</span>
          </div>

          <div id="hha-result-quests"
               style="font-size:12px;color:#e5e7eb;margin-bottom:10px;"></div>

          <button id="hha-restart"
            style="border-radius:999px;border:0;cursor:pointer;
                   padding:8px 18px;
                   background:linear-gradient(135deg,#38bdf8,#2563eb);
                   color:#fff;font-weight:600;font-size:14px;margin-right:8px;">
            เล่นอีกครั้ง
          </button>

          <button id="hha-download"
            style="border-radius:999px;border:0;cursor:pointer;
                   padding:8px 18px;
                   background:linear-gradient(135deg,#22c55e,#16a34a);
                   color:#fff;font-weight:600;font-size:14px;">
            ดาวน์โหลดข้อมูล (CSV)
          </button>
        </div>
      </div>

      <div id="hha-quests"></div>
    `;
    document.body.appendChild(hud);
    return hud;
  }

  function setMissionText(){
    const el = $('#hha-mission-text');
    if (!el) return;
    el.textContent = missionTextCached;
  }

  function currentMultiplier(){
    return feverTicksLeft > 0 ? 2 : 1;
  }

  function updateHUD(){
    const sEl = $('#hha-score');
    const cEl = $('#hha-combo');
    const tEl = $('#hha-time');
    const mBar = $('#hha-mission-bar');
    const starEl = $('#hha-buff-star');
    const shieldEl = $('#hha-buff-shield');
    const feverEl = $('#hha-buff-fever');

    if (sEl) sEl.textContent = String(score);
    if (cEl) cEl.textContent = String(combo);
    if (tEl) tEl.textContent = String(timeLeft);

    if (mBar) {
      const ratio = Math.max(0, Math.min(1, missionGoodCount / MISSION_GOOD_TARGET));
      mBar.style.width = (ratio * 100).toFixed(1) + '%';
    }

    if (starEl) starEl.textContent = String(maxCombo);
    if (shieldEl) shieldEl.textContent = String(shieldCharges);
    if (feverEl) feverEl.textContent = String(Math.max(0, feverTicksLeft));
  }

  // --------------------------------------------------
  // FX
  // --------------------------------------------------
  function burstAt(x, y, kind){
    const fxLayer = createFXLayer();
    const container = document.createElement('div');
    Object.assign(container.style,{
      position:'fixed',
      left:x + 'px',
      top:y + 'px',
      width:'0',
      height:'0',
      pointerEvents:'none',
      zIndex:'9060'
    });

    const shardCount = 10;
    let base;
    switch (kind) {
      case 'good':    base = 'rgba(34,197,94,'; break;
      case 'star':
      case 'gold':
      case 'diamond':
      case 'rainbow':
        base = 'rgba(250,204,21,'; break;
      case 'shield':  base = 'rgba(59,130,246,'; break;
      case 'fever':   base = 'rgba(248,113,113,'; break;
      case 'bad':
      default:        base = 'rgba(239,68,68,'; break;
    }

    for (let i = 0; i < shardCount; i++) {
      const shard = document.createElement('div');
      const size = 6 + Math.random() * 6;
      Object.assign(shard.style,{
        position:'absolute',
        left:'0',
        top:'0',
        width:size + 'px',
        height:size + 'px',
        borderRadius:'999px',
        background:base + (0.6 + Math.random()*0.3) + ')',
        transform:'translate3d(0,0,0) scale(0.6)',
        opacity:'1',
        transition:'transform 260ms ease-out, opacity 260ms ease-out'
      });
      container.appendChild(shard);

      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 40;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      requestAnimationFrame(function(){
        shard.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(1.1)';
        shard.style.opacity = '0';
      });
    }

    fxLayer.appendChild(container);
    setTimeout(function(){
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }, 320);
  }

  // --------------------------------------------------
  // Type picking
  // --------------------------------------------------
  function pickType(){
    const entries = Object.entries(TYPE_WEIGHTS);
    let total = 0;
    for (let i = 0; i < entries.length; i++) {
      total += entries[i][1];
    }
    const r = Math.random() * total;
    let acc = 0;
    for (let i = 0; i < entries.length; i++) {
      const type = entries[i][0];
      const w = entries[i][1];
      acc += w;
      if (r <= acc) return type;
    }
    return 'good';
  }

  // --------------------------------------------------
  // Mini Quest Logic (เลือก 3 ข้อ และอัปเดตสถานะ)
  // --------------------------------------------------
  function chooseQuests(count){
    const pool = QUEST_DEFS.slice();
    const chosen = [];
    while (pool.length && chosen.length < count) {
      const idx = Math.floor(Math.random() * pool.length);
      const q = pool.splice(idx,1)[0];
      chosen.push({ id:q.id, icon:q.icon, text:q.text, done:false, check:q.check });
    }
    return chosen;
  }

  function ensureQuestPanel(){
    const root = $('#hha-quests');
    if (!root) return;
    root.innerHTML = '';
    if (!activeQuests.length) return;

    const box = document.createElement('div');
    box.className = 'hha-quest-panel';

    const title = document.createElement('div');
    title.className = 'hha-quest-title';
    title.textContent = '🔥 Mini Quest';
    box.appendChild(title);

    activeQuests.forEach(q=>{
      const row = document.createElement('div');
      row.className = 'hha-quest-row';
      row.dataset.questId = q.id;

      const icon = document.createElement('div');
      icon.className = 'hha-quest-icon';
      icon.textContent = q.icon;

      const txt = document.createElement('div');
      txt.className = 'hha-quest-text';
      txt.textContent = q.text;

      row.appendChild(icon);
      row.appendChild(txt);
      box.appendChild(row);
    });

    root.appendChild(box);
  }

  function getMetrics(){
    return {
      maxCombo,
      fastHitAchieved,
      maxNoBadStreak,
      powerupHits,
      feverActivations,
      scoreAt20s,
      score
    };
  }

  function refreshQuestUI(){
    const metrics = getMetrics();
    let clearedCount = 0;
    activeQuests.forEach(q=>{
      if (!q.done && q.check && q.check(metrics)) {
        q.done = true;
      }
      if (q.done) clearedCount++;
    });

    const root = $('#hha-quests');
    if (!root) return;
    const rows = root.querySelectorAll('.hha-quest-row');
    rows.forEach(row=>{
      const id = row.dataset.questId;
      const q = activeQuests.find(qq=>qq.id === id);
      if (!q) return;
      if (q.done) {
        row.classList.add('done');
      }
    });

    if (clearedCount === activeQuests.length && activeQuests.length > 0 && !allQuestsClearedOnce) {
      allQuestsClearedOnce = true;
      // แสดงข้อความเล็ก ๆ ว่าเคลียร์ครบแล้ว
      const title = root.querySelector('.hha-quest-title');
      if (title) {
        title.textContent = '🎉 Mini Quest เคลียร์ครบ!';
      }
    }
  }

  // --------------------------------------------------
  // SPAWN LOGIC
  // --------------------------------------------------
  function spawnOne(host){
    if (!running) return;
    if (activeItems >= MAX_ACTIVE) return;

    const type = pickType();
    const emo = pickEmoji(type) || '❓';

    const item = document.createElement('button');
    item.type = 'button';
    item.textContent = emo;
    item.setAttribute('data-type', type);

    const shortest = Math.min(window.innerWidth, window.innerHeight);
    const baseSize = shortest < 700 ? 72 : 80;
    const size = Math.round(baseSize * SIZE_FACTOR);

    const baseStyle = {
      position: 'absolute',
      width: size + 'px',
      height: size + 'px',
      borderRadius: '999px',
      border: '0',
      fontSize: String(size * 0.52) + 'px',
      boxShadow: '0 8px 22px rgba(15,23,42,0.85)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'transform 0.12s ease, opacity 0.12s ease',
      pointerEvents: 'auto',
      animation: 'hha-float 1.3s ease-in-out infinite'
    };
    Object.assign(item.style, baseStyle);

    if (type === 'gold' || type === 'diamond' || type === 'star' || type === 'rainbow') {
      item.style.background = 'radial-gradient(circle at 30% 20%, #facc15, #f97316)';
      item.style.boxShadow = '0 0 25px rgba(250,204,21,0.9)';
    } else if (type === 'shield') {
      item.style.background = 'radial-gradient(circle at 30% 20%, #60a5fa, #1d4ed8)';
      item.style.boxShadow = '0 0 22px rgba(59,130,246,0.8)';
    } else if (type === 'fever') {
      item.style.background = 'radial-gradient(circle at 30% 20%, #fb923c, #b91c1c)';
      item.style.boxShadow = '0 0 26px rgba(248,113,113,0.9)';
    } else if (type === 'good') {
      item.style.background = 'rgba(15,23,42,0.96)';
    } else if (type === 'junk') {
      item.style.background = 'rgba(30,27,75,0.96)';
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = 0.1 * vw + Math.random() * 0.8 * vw;
    const y = 0.18 * vh + Math.random() * 0.7 * vh;
    item.style.left = String(x - size / 2) + 'px';
    item.style.top = String(y - size / 2) + 'px';

    activeItems++;
    const spawnAt = performance.now();
    item.dataset.spawnAt = String(spawnAt);

    function removeItem(){
      if (item.parentNode) {
        item.parentNode.removeChild(item);
        activeItems = Math.max(0, activeItems - 1);
      }
    }

    item.addEventListener('click', function(ev){
      if (!running) return;

      const tNow = performance.now();
      const spawnTime = parseFloat(item.dataset.spawnAt || String(tNow));
      const reactionSec = Math.max(0, (tNow - spawnTime) / 1000);

      if (reactionSec <= 1) {
        fastHitAchieved = true;
      }

      const clickType = item.getAttribute('data-type') || 'good';

      if (navigator.vibrate) {
        if (clickType === 'junk') navigator.vibrate(60);
        else if (clickType === 'shield' || clickType === 'fever') navigator.vibrate(40);
        else navigator.vibrate(25);
      }
      burstAt(ev.clientX, ev.clientY, clickType === 'junk' ? 'bad' : clickType);

      const mult = currentMultiplier();
      const wasCombo = combo;

      if (clickType === 'good') {
        score += 10 * mult;
        combo += 1;
        missionGoodCount += 1;
      } else if (clickType === 'star') {
        score += 15 * mult;
        combo += 2;
        missionGoodCount += 1;
        powerupHits++;
      } else if (clickType === 'gold') {
        score += 20 * mult;
        combo += 2;
        missionGoodCount += 2;
        powerupHits++;
      } else if (clickType === 'diamond') {
        score += 30 * mult;
        combo += 3;
        missionGoodCount += 2;
        timeLeft += DIAMOND_TIME_BONUS;
        powerupHits++;
      } else if (clickType === 'shield') {
        shieldCharges += 1;
        powerupHits++;
      } else if (clickType === 'fever') {
        feverTicksLeft = Math.max(feverTicksLeft, FEVER_DURATION);
        feverActivations++;
        powerupHits++;
      } else if (clickType === 'rainbow') {
        score += 25 * mult;
        combo += 2;
        missionGoodCount += 2;
        powerupHits++;
      } else if (clickType === 'junk') {
        if (shieldCharges > 0) {
          shieldCharges -= 1;
        } else {
          score = Math.max(0, score - 5);
          combo = 0;
          badHits++;
          lastBadTime = elapsedSec;
          const oldBg = document.body.style.backgroundColor || '#0b1220';
          document.body.style.backgroundColor = '#450a0a';
          setTimeout(function(){
            document.body.style.backgroundColor = oldBg || '#0b1220';
          }, 80);
        }
      }

      if (combo > maxCombo) maxCombo = combo;

      hitEvents.push({
        timeSec: elapsedSec,
        type: clickType,
        isGood: clickType === 'good' || clickType === 'star' || clickType === 'gold' || clickType === 'diamond' || clickType === 'rainbow',
        isBad: clickType === 'junk',
        reactionSec: reactionSec,
        comboBefore: wasCombo,
        comboAfter: combo
      });

      item.style.opacity = '0';
      item.style.transform = 'scale(1.2)';
      updateHUD();
      refreshQuestUI();

      setTimeout(removeItem, 100);
    });

    host.appendChild(item);

    setTimeout(function(){
      if (item.parentNode) {
        item.style.opacity = '0';
        item.style.transform = 'scale(0.7)';
        setTimeout(removeItem, 120);
      }
    }, ITEM_LIFETIME);
  }

  // --------------------------------------------------
  // GAME LOOP
  // --------------------------------------------------
  function resetMetrics(){
    badHits = 0;
    elapsedSec = 0;
    lastBadTime = 0;
    maxNoBadStreak = 0;
    powerupHits = 0;
    feverActivations = 0;
    fastHitAchieved = false;
    scoreAt20s = 0;
    recordedScoreAt20 = false;
    hitEvents.length = 0;
    allQuestsClearedOnce = false;
    activeQuests = chooseQuests(3);
  }

  function startGame(){
    if (running) return;
    running = true;
    score = 0;
    combo = 0;
    maxCombo = 0;
    missionGoodCount = 0;
    timeLeft = GAME_DURATION;
    activeItems = 0;
    shieldCharges = 0;
    feverTicksLeft = 0;

    resetMetrics();
    ensureQuestPanel();
    updateHUD();
    refreshQuestUI();

    const host = createHost();
    createHUD();
    createFXLayer();
    ensureGameCSS();
    setMissionText();

    if (spawnTimer) clearInterval(spawnTimer);
    if (tickTimer) clearInterval(tickTimer);

    spawnTimer = setInterval(function(){
      spawnOne(host);
    }, SPAWN_INTERVAL);

    tickTimer = setInterval(function(){
      elapsedSec += 1;
      timeLeft -= 1;
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateHUD();
        refreshQuestUI();
        endGame();
        return;
      }

      const noBadDuration = elapsedSec - lastBadTime;
      if (noBadDuration > maxNoBadStreak) {
        maxNoBadStreak = noBadDuration;
      }

      if (!recordedScoreAt20 && elapsedSec >= 20) {
        recordedScoreAt20 = true;
        scoreAt20s = score;
      }

      if (feverTicksLeft > 0) {
        feverTicksLeft -= 1;
        if (feverTicksLeft < 0) feverTicksLeft = 0;
      }

      updateHUD();
      refreshQuestUI();
    }, 1000);
  }

  function buildQuestSummaryText(){
    if (!activeQuests.length) return 'ไม่มี Mini Quest';
    let cleared = 0;
    activeQuests.forEach(q=>{ if (q.done) cleared++; });
    const parts = activeQuests.map(q=>{
      return (q.done ? '✅ ' : '⬜ ') + q.text;
    });
    return 'Mini Quest สำเร็จ ' + cleared + '/' + activeQuests.length + ' ข้อ\n' + parts.join('\n');
  }

  function buildCSV(){
    const timestamp = new Date().toISOString();
    const missionSuccess = missionGoodCount >= MISSION_GOOD_TARGET ? 1 : 0;

    const q1 = activeQuests[0] || {id:'',done:false};
    const q2 = activeQuests[1] || {id:'',done:false};
    const q3 = activeQuests[2] || {id:'',done:false};

    const header = [
      'timestamp',
      'mode','diff','timeLimit',
      'playerName','playerRoom','playerAge',
      'score','maxCombo',
      'missionGood','missionTarget','missionSuccess',
      'quest1_id','quest1_done',
      'quest2_id','quest2_done',
      'quest3_id','quest3_done'
    ].join(',');

    const row = [
      timestamp,
      MODE_ID, DIFF, GAME_DURATION,
      JSON.stringify(PLAYER_NAME).slice(1,-1), // escape ถ้าอยาก
      JSON.stringify(PLAYER_ROOM).slice(1,-1),
      JSON.stringify(PLAYER_AGE).slice(1,-1),
      score, maxCombo,
      missionGoodCount, MISSION_GOOD_TARGET, missionSuccess,
      q1.id, q1.done ? 1 : 0,
      q2.id, q2.done ? 1 : 0,
      q3.id, q3.done ? 1 : 0
    ].join(',');

    return header + '\n' + row + '\n';
  }

  function triggerDownloadCSV(){
    const csv = buildCSV();
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const urlBlob = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlBlob;
    a.download = 'herohealth_' + MODE_ID + '_' + Date.now() + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){
      document.body.removeChild(a);
      URL.revokeObjectURL(urlBlob);
    }, 0);
  }

  function endGame(){
    if (!running) return;
    running = false;
    if (spawnTimer) clearInterval(spawnTimer);
    if (tickTimer) clearInterval(tickTimer);

    const result = $('#hha-result');
    const fs = $('#hha-final-score');
    const fc = $('#hha-final-combo');
    const fg = $('#hha-final-good');
    const ft = $('#hha-final-target');
    const title = $('#hha-result-title');
    const qBox = $('#hha-result-quests');
    const playerLine = $('#hha-player-line');

    const missionSuccess = missionGoodCount >= MISSION_GOOD_TARGET;

    if (fs) fs.textContent = String(score);
    if (fc) fc.textContent = String(maxCombo);
    if (fg) fg.textContent = String(missionGoodCount);
    if (ft) ft.textContent = String(MISSION_GOOD_TARGET);

    if (title) {
      title.textContent = missionSuccess ? 'ภารกิจสำเร็จ! 🎉' : 'ยังไม่ผ่านภารกิจ ลองอีกทีนะ 💪';
    }

    if (playerLine) {
      const parts = [];
      if (PLAYER_NAME) parts.push('ชื่อ: ' + PLAYER_NAME);
      if (PLAYER_ROOM) parts.push('ห้อง: ' + PLAYER_ROOM);
      if (PLAYER_AGE)  parts.push('อายุ: ' + PLAYER_AGE);
      playerLine.textContent = parts.join(' • ');
    }

    if (qBox) {
      const summary = buildQuestSummaryText();
      qBox.innerHTML = summary.replace(/\n/g, '<br/>');
    }

    if (result) result.style.display = 'flex';
  }

  // --------------------------------------------------
  // BOOTSTRAP
  // --------------------------------------------------
  function bootstrap(){
    ensureGameCSS();
    createHUD();
    createHost();
    createFXLayer();
    setMissionText();
    updateHUD();

    // restart
    const restartBtn = $('#hha-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', function(){
        const panel = $('#hha-result');
        if (panel) panel.style.display = 'none';
        startGame();
      });
    }

    const dlBtn = $('#hha-download');
    if (dlBtn) {
      dlBtn.addEventListener('click', function(){
        triggerDownloadCSV();
      });
    }

    startGame();

    console.log('[HHA] Boot', {
      MODE_ID,
      DIFF,
      GAME_DURATION,
      SPAWN_INTERVAL,
      ITEM_LIFETIME,
      MAX_ACTIVE,
      TYPE_WEIGHTS,
      SIZE_FACTOR,
      MISSION_GOOD_TARGET
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();  // end IIFE
