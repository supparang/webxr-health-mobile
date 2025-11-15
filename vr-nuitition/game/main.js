// === Hero Health — game/main.js (Engine กลาง + DOM mode) ===
// - อ่าน ?mode= / ?diff= / ?time= จาก URL
// - ใช้ window.HH_MODES[modeId] เป็นตัวกำหนด config + emoji
// - มี HUD, fever, rank, research log + CSV export

(function () {
  'use strict';

  // ---------- URL & Mode ----------
  const url = new URL(window.location.href);
  const MODE_ID = (url.searchParams.get('mode') || 'goodjunk').toLowerCase();
  const DIFF = (url.searchParams.get('diff') || 'normal').toLowerCase();

  let timeParam = parseInt(url.searchParams.get('time'), 10);
  if (isNaN(timeParam) || timeParam <= 0) timeParam = 60;
  if (timeParam < 20) timeParam = 20;
  if (timeParam > 180) timeParam = 180;

  const GAME_DURATION = timeParam;

  // ---------- เลือกโหมดที่ใช้ ----------
  const MODE_REGISTRY = window.HH_MODES || {};
  const ActiveMode =
    MODE_REGISTRY[MODE_ID] ||
    MODE_REGISTRY.goodjunk ||
    {
      id: 'fallback',
      label: 'Fallback Mode',
      setupForDiff: function () {
        return {
          SPAWN_INTERVAL: 800,
          ITEM_LIFETIME: 1600,
          MAX_ACTIVE: 4,
          MISSION_GOOD_TARGET: 15,
          SIZE_FACTOR: 1.0,
          TYPE_WEIGHTS: {
            good: 70,
            junk: 30
          },
          FEVER_DURATION: 5,
          DIAMOND_TIME_BONUS: 0
        };
      },
      missionText: function (target) {
        return 'ภารกิจวันนี้: เก็บของดีให้ครบ ' + target + ' ชิ้น';
      },
      pickEmoji: function (type) {
        if (type === 'junk') return '❌';
        return '✅';
      }
    };

  // ---------- Config ตัวแปร (จะถูกเซ็ตจาก ActiveMode.setupForDiff) ----------
  let SPAWN_INTERVAL = 650;
  let ITEM_LIFETIME = 1400;
  let MAX_ACTIVE = 4;
  let MISSION_GOOD_TARGET = 20;
  let SIZE_FACTOR = 1.0;
  let TYPE_WEIGHTS = {
    good: 45,
    junk: 30,
    star: 7,
    gold: 6,
    diamond: 5,
    shield: 3,
    fever: 4,
    rainbow: 1
  };
  let FEVER_DURATION = 6;
  let DIAMOND_TIME_BONUS = 2;

  // ---------- State ----------
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let timeLeft = GAME_DURATION;
  let running = false;
  let paused = false;

  let spawnTimer = null;
  let tickTimer = null;

  let missionGoodCount = 0;
  let activeItems = 0;
  let shieldCharges = 0;
  let feverTicksLeft = 0;

  let totalGoodSpawns = 0;
  let totalJunkSpawns = 0;

  // research / run info
  let runId = '';
  let runStartedAt = 0;
  let runEvents = [];

  // สำหรับ fever overlay
  let feverOverlayOn = false;

  // ---------- Helpers ----------
  function nowMs() {
    if (window.performance && performance.now) {
      return performance.now();
    }
    return Date.now();
  }

  function $(sel) {
    return document.querySelector(sel);
  }

  function $all(sel) {
    return document.querySelectorAll(sel);
  }

  function clamp01(x) {
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  // ---------- DOM host / FX ----------
  function createHost() {
    let host = $('#hha-dom-host');
    if (host) return host;

    host = document.createElement('div');
    host.id = 'hha-dom-host';
    Object.assign(host.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '9000'
    });
    document.body.appendChild(host);
    return host;
  }

  function createFXLayer() {
    let fx = $('#hha-fx-layer');
    if (fx) return fx;

    fx = document.createElement('div');
    fx.id = 'hha-fx-layer';
    Object.assign(fx.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '9050',
      overflow: 'hidden'
    });
    document.body.appendChild(fx);
    return fx;
  }

  // ---------- CSS ----------

  function ensureGameCSS() {
    if (document.getElementById('hha-game-css')) return;
    const st = document.createElement('style');
    st.id = 'hha-game-css';
    st.textContent = `
      @keyframes hha-float {
        0%   { transform: translate3d(0,0,0); }
        50%  { transform: translate3d(0,-10px,0); }
        100% { transform: translate3d(0,0,0); }
      }

      @keyframes hha-toast-in {
        0%   { opacity: 0; transform: translate3d(-50%,10px,0); }
        100% { opacity: 1; transform: translate3d(-50%,0,0); }
      }

      @keyframes hha-toast-out {
        0%   { opacity: 1; transform: translate3d(-50%,0,0); }
        100% { opacity: 0; transform: translate3d(-50%,-6px,0); }
      }

      body.hha-fever {
        background-image: radial-gradient(circle at top, rgba(248,113,113,0.18), transparent),
                          radial-gradient(circle at bottom, rgba(59,130,246,0.18), transparent);
        background-color:#020617;
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
    `;
    document.head.appendChild(st);
  }

  // ---------- Toast ----------
  function showToast(msg, durMs) {
    durMs = durMs || 2600;
    let el = $('#hha-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hha-toast';
      Object.assign(el.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '8px 14px',
        borderRadius: '999px',
        background: 'rgba(15,23,42,0.96)',
        color: '#e5e7eb',
        border: '1px solid rgba(148,163,184,0.9)',
        fontSize: '13px',
        fontFamily: 'system-ui,Segoe UI,Inter,Roboto,sans-serif',
        zIndex: '9300',
        opacity: '0',
        pointerEvents: 'none'
      });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.animation = 'hha-toast-in 180ms ease-out forwards';

    setTimeout(function () {
      el.style.animation = 'hha-toast-out 220ms ease-in forwards';
    }, durMs);
  }

  // ---------- HUD ----------
  function createHUD() {
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
        <div style="display:flex;gap:18px;justify-content:space-between;align-items:flex-start;">
          <div>
            <div>คะแนน</div>
            <div id="hha-score" style="text-align:right;font-weight:700;font-size:18px;">0</div>
          </div>
          <div>
            <div>คอมโบ</div>
            <div id="hha-combo" style="text-align:right;font-weight:700;font-size:18px;">0</div>
          </div>
          <button id="hha-pause-btn"
            type="button"
            style="
              margin-left:12px;
              border-radius:999px;border:0;
              padding:4px 10px;
              font-size:11px;
              background:rgba(15,23,42,0.9);
              color:#e5e7eb;
              border:1px solid rgba(148,163,184,0.9);
              cursor:pointer;
            ">
            ⏸ Pause
          </button>
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
            🛡 กันพลาด: <span id="hha-buff-shield">0</span> |
            🔥 พลังไฟ: <span id="hha-buff-fever">0</span>s
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
            style="margin-top:0;margin-bottom:4px;font-size:18px;">
            จบรอบแล้ว 🎉
          </h2>

          <div style="margin-bottom:4px;">
            Rank: <b id="hha-final-rank">-</b>
          </div>

          <div style="margin-bottom:4px;">
            คะแนนรวม: <b id="hha-final-score">0</b>
          </div>
          <div style="margin-bottom:4px;">
            คอมโบสูงสุด: <b id="hha-final-combo">0</b>
          </div>
          <div style="margin-bottom:8px;">
            ของดีที่เก็บได้: <b id="hha-final-good">0</b> / <span id="hha-final-target">0</span>
          </div>
          <div id="hha-final-note" style="font-size:12px;color:#cbd5f5;margin-bottom:12px;"></div>

          <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
            <button id="hha-restart"
              style="border-radius:999px;border:0;cursor:pointer;
                     padding:8px 18px;
                     background:linear-gradient(135deg,#38bdf8,#2563eb);
                     color:#fff;font-weight:600;font-size:14px;">
              เล่นอีกครั้ง
            </button>
            <button id="hha-back-hub"
              style="border-radius:999px;border:0;cursor:pointer;
                     padding:6px 16px;
                     background:rgba(15,23,42,0.96);
                     color:#e5e7eb;font-size:12px;
                     border:1px solid rgba(148,163,184,0.9);">
              ⬅ กลับ Hub
            </button>
          </div>

          <div style="border-top:1px solid rgba(51,65,85,0.9);padding-top:8px;margin-top:4px;font-size:12px;color:#cbd5f5;">
            สำหรับครู/วิจัย:
            <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px;">
              <button id="hha-csv-summary"
                style="border-radius:999px;border:0;cursor:pointer;
                       padding:4px 10px;
                       background:rgba(21,128,61,0.9);
                       color:#f9fafb;font-size:11px;">
                ⬇ ดาวน์โหลดสรุปต่อรอบ (CSV)
              </button>
              <button id="hha-csv-events"
                style="border-radius:999px;border:0;cursor:pointer;
                       padding:4px 10px;
                       background:rgba(30,64,175,0.9);
                       color:#f9fafb;font-size:11px;">
                ⬇ ดาวน์โหลดเหตุการณ์ในรอบนี้ (CSV)
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(hud);
    return hud;
  }

  function getModeMissionText() {
    const t = MISSION_GOOD_TARGET;
    if (ActiveMode && typeof ActiveMode.missionText === 'function') {
      return ActiveMode.missionText(t);
    }
    return 'ภารกิจวันนี้: เก็บของดีให้ครบ ' + t + ' ชิ้น';
  }

  function setFeverOverlay(on) {
    on = !!on;
    if (feverOverlayOn === on) return;
    feverOverlayOn = on;
    if (on) {
      document.body.classList.add('hha-fever');
    } else {
      document.body.classList.remove('hha-fever');
    }
  }

  function currentMultiplier() {
    if (feverTicksLeft <= 0) return 1;
    // ยิ่ง fever เหลือนาน → bonus สูงขึ้นนิดหน่อย
    if (feverTicksLeft >= FEVER_DURATION * 0.7) return 3;
    if (feverTicksLeft >= FEVER_DURATION * 0.4) return 2;
    return 1.5;
  }

  function updateHUD() {
    const sEl = $('#hha-score');
    const cEl = $('#hha-combo');
    const tEl = $('#hha-time');
    const mBar = $('#hha-mission-bar');
    const mText = $('#hha-mission-text');
    const starEl = $('#hha-buff-star');
    const shieldEl = $('#hha-buff-shield');
    const feverEl = $('#hha-buff-fever');

    if (sEl) sEl.textContent = String(score);
    if (cEl) cEl.textContent = String(combo);
    if (tEl) tEl.textContent = String(timeLeft);

    if (mBar) {
      const ratio = clamp01(missionGoodCount / MISSION_GOOD_TARGET);
      mBar.style.width = (ratio * 100).toFixed(1) + '%';
    }
    if (mText) {
      mText.textContent = getModeMissionText();
    }

    if (starEl) starEl.textContent = String(maxCombo);
    if (shieldEl) shieldEl.textContent = String(shieldCharges);
    if (feverEl) feverEl.textContent = String(Math.max(0, feverTicksLeft));
  }

  // ---------- Particle FX ----------
  function burstAt(x, y, kind) {
    const fxLayer = createFXLayer();
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed',
      left: x + 'px',
      top: y + 'px',
      width: '0',
      height: '0',
      pointerEvents: 'none',
      zIndex: '9060'
    });

    const shardCount = 10;
    let base;
    switch (kind) {
      case 'good':
        base = 'rgba(34,197,94,'; break;
      case 'star':
      case 'gold':
      case 'diamond':
      case 'rainbow':
        base = 'rgba(250,204,21,'; break;
      case 'shield':
        base = 'rgba(59,130,246,'; break;
      case 'fever':
        base = 'rgba(248,113,113,'; break;
      case 'bad':
      default:
        base = 'rgba(239,68,68,'; break;
    }

    for (let i = 0; i < shardCount; i++) {
      const shard = document.createElement('div');
      const size = 6 + Math.random() * 6;
      Object.assign(shard.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: size + 'px',
        height: size + 'px',
        borderRadius: '999px',
        background: base + (0.6 + Math.random() * 0.3) + ')',
        transform: 'translate3d(0,0,0) scale(0.6)',
        opacity: '1',
        transition: 'transform 260ms ease-out, opacity 260ms ease-out'
      });
      container.appendChild(shard);

      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 40;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      requestAnimationFrame(function () {
        shard.style.transform =
          'translate3d(' + dx + 'px,' + dy + 'px,0) scale(1.1)';
        shard.style.opacity = '0';
      });
    }

    fxLayer.appendChild(container);
    setTimeout(function () {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }, 320);
  }

  // ---------- Weight & Type ----------
  function pickType() {
    const entries = Object.entries(TYPE_WEIGHTS);
    let total = 0;
    for (let i = 0; i < entries.length; i++) {
      total += entries[i][1];
    }
    if (total <= 0) return 'good';

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

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Research log ----------
  function logEvent(evType, detail) {
    if (!runId) return;
    const t = nowMs() - runStartedAt;
    runEvents.push({
      t: Math.round(t),
      type: evType,
      detail: detail || {}
    });
  }

  function saveSummaryToLocal(summary) {
    try {
      const key = 'hha_runs';
      const raw = window.localStorage.getItem(key);
      let arr = [];
      if (raw) {
        arr = JSON.parse(raw);
        if (!Array.isArray(arr)) arr = [];
      }
      arr.push(summary);
      if (arr.length > 200) {
        arr = arr.slice(arr.length - 200);
      }
      window.localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {
      console.warn('saveSummaryToLocal error', e);
    }
  }

  function saveEventsToLocal(runId, events) {
    try {
      const key = 'hha_events_' + runId;
      window.localStorage.setItem(key, JSON.stringify(events || []));
    } catch (e) {
      console.warn('saveEventsToLocal error', e);
    }
  }

  function makeCSVFromSummary() {
    try {
      const key = 'hha_runs';
      const raw = window.localStorage.getItem(key);
      if (!raw) return '';
      const rows = JSON.parse(raw);
      if (!Array.isArray(rows) || !rows.length) return '';

      const header = [
        'runId','mode','diff','durationSec',
        'score','maxCombo','missionGood','missionTarget','success',
        'totalGoodSpawns','totalJunkSpawns',
        'startedAt','endedAt'
      ];
      const lines = [header.join(',')];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const line = [
          r.runId || '',
          r.mode || '',
          r.diff || '',
          r.durationSec != null ? r.durationSec : '',
          r.score != null ? r.score : '',
          r.maxCombo != null ? r.maxCombo : '',
          r.missionGood != null ? r.missionGood : '',
          r.missionTarget != null ? r.missionTarget : '',
          r.success ? '1' : '0',
          r.totalGoodSpawns != null ? r.totalGoodSpawns : '',
          r.totalJunkSpawns != null ? r.totalJunkSpawns : '',
          r.startedAt || '',
          r.endedAt || ''
        ];
        lines.push(line.join(','));
      }

      return lines.join('\n');
    } catch (e) {
      console.warn('makeCSVFromSummary error', e);
      return '';
    }
  }

  function makeCSVFromEvents(runId) {
    try {
      const key = 'hha_events_' + runId;
      const raw = window.localStorage.getItem(key);
      if (!raw) return '';
      const evs = JSON.parse(raw);
      if (!Array.isArray(evs) || !evs.length) return '';

      const header = ['runId','tMs','type','detailJson'];
      const lines = [header.join(',')];
      for (let i = 0; i < evs.length; i++) {
        const e = evs[i];
        const line = [
          runId,
          e.t != null ? e.t : '',
          e.type || '',
          JSON.stringify(e.detail || {})
            .replace(/"/g, '""')
        ];
        lines.push(line.join(','));
      }
      return lines.join('\n');
    } catch (e) {
      console.warn('makeCSVFromEvents error', e);
      return '';
    }
  }

  function downloadCSV(filename, content) {
    if (!content) {
      showToast('ไม่มีข้อมูลสำหรับ CSV', 2000);
      return;
    }
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlObj;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(urlObj);
    }, 0);
  }

  // ---------- Spawn ----------
  function spawnOne(host) {
    if (!running || paused) return;
    if (activeItems >= MAX_ACTIVE) return;

    const type = pickType();
    let emo = '❓';

    // ขอ emoji จากโหมดปัจจุบัน
    if (ActiveMode && typeof ActiveMode.pickEmoji === 'function') {
      emo = ActiveMode.pickEmoji(type);
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const marginX = Math.max(40, vw * 0.06);
    const marginTop = Math.max(140, vh * 0.20);
    const marginBottom = Math.max(80, vh * 0.12);

    const safeWidth = Math.max(60, vw - marginX * 2);
    const safeHeight = Math.max(60, vh - marginTop - marginBottom);

    const x = marginX + Math.random() * safeWidth;
    const y = marginTop + Math.random() * safeHeight;

    const shortest = Math.min(vw, vh);
    const baseSize = shortest < 700 ? 72 : 80;
    const size = Math.round(baseSize * SIZE_FACTOR);

    const item = document.createElement('button');
    item.type = 'button';
    item.textContent = emo;
    item.setAttribute('data-type', type);

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
      item.style.background =
        'radial-gradient(circle at 30% 20%, #facc15, #f97316)';
      item.style.boxShadow = '0 0 25px rgba(250,204,21,0.9)';
    } else if (type === 'shield') {
      item.style.background =
        'radial-gradient(circle at 30% 20%, #60a5fa, #1d4ed8)';
      item.style.boxShadow = '0 0 22px rgba(59,130,246,0.8)';
    } else if (type === 'fever') {
      item.style.background =
        'radial-gradient(circle at 30% 20%, #fb923c, #b91c1c)';
      item.style.boxShadow = '0 0 26px rgba(248,113,113,0.9)';
    } else if (type === 'good') {
      item.style.background = 'rgba(15,23,42,0.96)';
    } else if (type === 'junk') {
      item.style.background = 'rgba(30,27,75,0.96)';
    }

    item.style.left = String(x - size / 2) + 'px';
    item.style.top = String(y - size / 2) + 'px';

    activeItems++;

    const spawnTimeMs = nowMs();
    item.dataset.spawnAt = String(spawnTimeMs);
    item.dataset.itemType = type;

    if (type === 'good' || type === 'star' || type === 'gold' || type === 'diamond' || type === 'rainbow') {
      totalGoodSpawns++;
    } else if (type === 'junk') {
      totalJunkSpawns++;
    }

    logEvent('spawn', {
      itemType: type,
      x: Math.round(x),
      y: Math.round(y),
      spawnTimeMs: Math.round(spawnTimeMs)
    });

    function removeItem() {
      if (item.parentNode) {
        item.parentNode.removeChild(item);
        activeItems = Math.max(0, activeItems - 1);
      }
    }

    item.addEventListener('click', function (ev) {
      if (!running || paused) return;

      if (navigator.vibrate) {
        if (type === 'junk') navigator.vibrate(60);
        else if (type === 'shield' || type === 'fever' || type === 'rainbow') navigator.vibrate(40);
        else navigator.vibrate(25);
      }

      burstAt(ev.clientX, ev.clientY, type === 'junk' ? 'bad' : type);

      const mult = currentMultiplier();
      const beforeScore = score;
      const beforeCombo = combo;

      if (type === 'good') {
        score += Math.round(10 * mult);
        combo += 1;
        missionGoodCount += 1;
      } else if (type === 'star') {
        score += Math.round(15 * mult);
        combo += 2;
        missionGoodCount += 1;
      } else if (type === 'gold') {
        score += Math.round(20 * mult);
        combo += 2;
        missionGoodCount += 2;
      } else if (type === 'diamond') {
        score += Math.round(30 * mult);
        combo += 3;
        missionGoodCount += 2;
        timeLeft += DIAMOND_TIME_BONUS;
      } else if (type === 'rainbow') {
        score += Math.round(40 * mult);
        combo += 4;
        missionGoodCount += 3;
        feverTicksLeft = Math.max(feverTicksLeft, FEVER_DURATION + 2);
      } else if (type === 'shield') {
        shieldCharges += 1;
      } else if (type === 'fever') {
        feverTicksLeft = Math.max(feverTicksLeft, FEVER_DURATION);
      } else if (type === 'junk') {
        if (shieldCharges > 0) {
          shieldCharges -= 1;
        } else {
          score = Math.max(0, score - 5);
          combo = 0;
          const oldBg = document.body.style.backgroundColor || '#0b1220';
          document.body.style.backgroundColor = '#450a0a';
          setTimeout(function () {
            document.body.style.backgroundColor = oldBg || '#0b1220';
          }, 80);
        }
      }

      if (combo > maxCombo) maxCombo = combo;

      item.style.opacity = '0';
      item.style.transform = 'scale(0.7)';
      updateHUD();

      logEvent('click', {
        itemType: type,
        scoreBefore: beforeScore,
        scoreAfter: score,
        comboBefore: beforeCombo,
        comboAfter: combo,
        missionGoodCount: missionGoodCount
      });

      setTimeout(removeItem, 100);
    });

    host.appendChild(item);

    setTimeout(function () {
      if (!item.parentNode) return;
      item.style.opacity = '0';
      item.style.transform = 'scale(0.7)';
      setTimeout(removeItem, 120);
    }, ITEM_LIFETIME);
  }

  // ---------- Rank ----------
  function computeRank(scoreVal, success, diff) {
    if (!success) {
      if (scoreVal < 50) return 'C';
      if (scoreVal < 120) return 'B-';
      return 'B';
    }
    // ผ่านภารกิจ
    if (diff === 'easy') {
      if (scoreVal >= 250) return 'S';
      if (scoreVal >= 180) return 'A';
      if (scoreVal >= 120) return 'B+';
      return 'B';
    }
    if (diff === 'hard') {
      if (scoreVal >= 420) return 'SSS';
      if (scoreVal >= 340) return 'SS';
      if (scoreVal >= 280) return 'S';
      if (scoreVal >= 220) return 'A';
      return 'B+';
    }
    // normal
    if (scoreVal >= 360) return 'SS';
    if (scoreVal >= 280) return 'S';
    if (scoreVal >= 220) return 'A';
    if (scoreVal >= 160) return 'B+';
    return 'B';
  }

  function rankNote(rank, success) {
    if (!success) {
      if (rank === 'C') return 'ยังไม่ผ่านภารกิจ ลองตั้งใจอีกนิดนะ 💪';
      if (rank === 'B-') return 'ใกล้แล้ว! รอบหน้าลองเล็งของดีให้มากขึ้น ✨';
      return 'ไม่ผ่านภารกิจ แต่คะแนนดีอยู่ รอบหน้าลองเก็บให้ครบภารกิจนะ';
    }
    // success
    if (rank === 'SSS') return 'ตำนาน! เก่งสุดขีดแล้ว 🎉🔥';
    if (rank === 'SS')  return 'เทพโหดๆ เลยรอบนี้ สุดยอด! 💫';
    if (rank === 'S')   return 'เยี่ยมมาก! ผ่านภารกิจแบบสวย ๆ ✨';
    if (rank === 'A')   return 'ดีมาก! ลองดันให้ถึง S รอบหน้า 💪';
    if (rank === 'B+' || rank === 'B') return 'ผ่านภารกิจแล้ว เก่งมาก! รอบหน้าลองไต่ Rank สูงขึ้นนะ 😉';
    return 'ทำได้ดีมากแล้ว!';
  }

  // ---------- Game loop ----------
  function applyModeConfig() {
    const cfg = ActiveMode.setupForDiff
      ? ActiveMode.setupForDiff(DIFF)
      : null;
    if (!cfg) return;

    SPAWN_INTERVAL = cfg.SPAWN_INTERVAL || SPAWN_INTERVAL;
    ITEM_LIFETIME = cfg.ITEM_LIFETIME || ITEM_LIFETIME;
    MAX_ACTIVE = cfg.MAX_ACTIVE || MAX_ACTIVE;
    MISSION_GOOD_TARGET = cfg.MISSION_GOOD_TARGET || MISSION_GOOD_TARGET;
    SIZE_FACTOR = cfg.SIZE_FACTOR || SIZE_FACTOR;
    TYPE_WEIGHTS = cfg.TYPE_WEIGHTS || TYPE_WEIGHTS;
    FEVER_DURATION = cfg.FEVER_DURATION || FEVER_DURATION;
    DIAMOND_TIME_BONUS = cfg.DIAMOND_TIME_BONUS || DIAMOND_TIME_BONUS;
  }

  function setPaused(p) {
    p = !!p;
    if (!running) p = false;
    if (paused === p) return;
    paused = p;

    const btn = $('#hha-pause-btn');
    if (btn) {
      btn.textContent = paused ? '▶ Resume' : '⏸ Pause';
    }
    if (paused) {
      showToast('พักเกมชั่วคราว', 1500);
    } else {
      showToast('เล่นต่อ!', 1200);
    }
  }

  function startGame() {
    running = true;
    paused = false;

    score = 0;
    combo = 0;
    maxCombo = 0;
    missionGoodCount = 0;
    timeLeft = GAME_DURATION;
    activeItems = 0;
    shieldCharges = 0;
    feverTicksLeft = 0;
    totalGoodSpawns = 0;
    totalJunkSpawns = 0;
    setFeverOverlay(false);

    runId = Date.now().toString(36) + '-' +
      Math.random().toString(16).slice(2, 8);
    runEvents = [];
    runStartedAt = nowMs();

    applyModeConfig();
    updateHUD();

    const host = createHost();
    createHUD();
    createFXLayer();
    ensureGameCSS();

    if (spawnTimer) clearInterval(spawnTimer);
    if (tickTimer) clearInterval(tickTimer);

    spawnTimer = setInterval(function () {
      spawnOne(host);
    }, SPAWN_INTERVAL);

    tickTimer = setInterval(function () {
      if (!running || paused) return;

      timeLeft -= 1;
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateHUD();
        endGame();
        return;
      }

      if (feverTicksLeft > 0) {
        feverTicksLeft -= 1;
        if (feverTicksLeft < 0) feverTicksLeft = 0;
      }

      setFeverOverlay(feverTicksLeft > 0);
      updateHUD();
    }, 1000);

    logEvent('start', {
      mode: MODE_ID,
      diff: DIFF,
      gameDuration: GAME_DURATION
    });

    const resultPanel = $('#hha-result');
    if (resultPanel) resultPanel.style.display = 'none';
  }

  function endGame() {
    if (!running) return;
    running = false;
    paused = false;

    if (spawnTimer) clearInterval(spawnTimer);
    if (tickTimer) clearInterval(tickTimer);

    setFeverOverlay(false);

    const success = missionGoodCount >= MISSION_GOOD_TARGET;
    const durationSec = GAME_DURATION;
    const rank = computeRank(score, success, DIFF);

    const result = $('#hha-result');
    const fs = $('#hha-final-score');
    const fc = $('#hha-final-combo');
    const fg = $('#hha-final-good');
    const ft = $('#hha-final-target');
    const title = $('#hha-result-title');
    const fr = $('#hha-final-rank');
    const note = $('#hha-final-note');

    if (fs) fs.textContent = String(score);
    if (fc) fc.textContent = String(maxCombo);
    if (fg) fg.textContent = String(missionGoodCount);
    if (ft) ft.textContent = String(MISSION_GOOD_TARGET);
    if (fr) fr.textContent = rank;

    if (title) {
      title.textContent = success ? 'ภารกิจสำเร็จ! 🎉' : 'ยังไม่ผ่านภารกิจ ลองอีกทีนะ 💪';
    }
    if (note) {
      note.textContent = rankNote(rank, success);
    }
    if (result) {
      result.style.display = 'flex';
    }

    const endedAt = new Date().toISOString();
    const summary = {
      runId: runId,
      mode: MODE_ID,
      diff: DIFF,
      durationSec: durationSec,
      score: score,
      maxCombo: maxCombo,
      missionGood: missionGoodCount,
      missionTarget: MISSION_GOOD_TARGET,
      success: success,
      totalGoodSpawns: totalGoodSpawns,
      totalJunkSpawns: totalJunkSpawns,
      startedAt: new Date(runStartedAt ? Date.now() - (nowMs() - runStartedAt) : Date.now()).toISOString(),
      endedAt: endedAt
    };

    logEvent('end', summary);
    saveSummaryToLocal(summary);
    saveEventsToLocal(runId, runEvents);

    showToast('จบรอบแล้ว! ดู Rank และดาวน์โหลด CSV ได้ด้านล่าง', 2600);
  }

  // ---------- Event handlers ----------
  function initButtons() {
    const restartBtn = $('#hha-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        const panel = $('#hha-result');
        if (panel) panel.style.display = 'none';
        startGame();
      });
    }

    const backHubBtn = $('#hha-back-hub');
    if (backHubBtn) {
      backHubBtn.addEventListener('click', function () {
        window.location.href = './hub.html';
      });
    }

    const pauseBtn = $('#hha-pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', function () {
        setPaused(!paused);
      });
    }

    const csvSummaryBtn = $('#hha-csv-summary');
    if (csvSummaryBtn) {
      csvSummaryBtn.addEventListener('click', function () {
        const csv = makeCSVFromSummary();
        downloadCSV('herohealth_runs.csv', csv);
      });
    }

    const csvEventsBtn = $('#hha-csv-events');
    if (csvEventsBtn) {
      csvEventsBtn.addEventListener('click', function () {
        const csv = makeCSVFromEvents(runId);
        downloadCSV('herohealth_events_' + runId + '.csv', csv);
      });
    }
  }

  function initVisibilityPause() {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (running) {
          setPaused(true);
          logEvent('autoPause', { reason: 'tabHidden' });
        }
      }
    });
  }

  // ---------- Bootstrap ----------
  function bootstrap() {
    ensureGameCSS();
    createHost();
    createFXLayer();
    createHUD();
    updateHUD();
    initButtons();
    initVisibilityPause();
    startGame();

    console.log('[HHA DOM] Engine ready', {
      MODE_ID: MODE_ID,
      DIFF: DIFF,
      GAME_DURATION: GAME_DURATION,
      ActiveMode: ActiveMode && ActiveMode.id
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
