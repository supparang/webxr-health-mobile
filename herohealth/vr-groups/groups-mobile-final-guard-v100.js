// === /herohealth/vr-groups/groups-mobile-final-guard-v100.js ===
// HeroHealth Groups Mobile — v10.0 Final QA Guard
// Adds: final small-screen polish, core-load check, stuck-state watcher,
// emergency rescue panel, summary/localStorage verification, safe return fallback.
// PATCH v20260514-GROUPS-MOBILE-V100-FINAL-QA-GUARD

(function () {
  'use strict';

  const VERSION = 'v10.0-mobile-final-qa-guard-20260514';

  if (window.__HHA_GROUPS_MOBILE_V100_FINAL_GUARD__) {
    console.warn('[Groups Mobile v10.0] already installed');
    return;
  }

  window.__HHA_GROUPS_MOBILE_V100_FINAL_GUARD__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    startedAt: Date.now(),
    lastMode: '',
    lastStateAt: Date.now(),
    lastScore: 0,
    lastCorrect: 0,
    lastCurrentSig: '',
    lastProgressAt: Date.now(),
    rescueShown: false,
    errorCount: 0,
    lastError: '',
    guardTimer: null,
    uiTimer: null,
    summaryChecked: false
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function qs(name, fallback) {
    try {
      return new URL(location.href).searchParams.get(name) || fallback || '';
    } catch (e) {
      return fallback || '';
    }
  }

  function api() {
    return WIN.HHA_GROUPS_MOBILE_V9 || null;
  }

  function gameState() {
    try {
      const a = api();
      if (a && typeof a.getState === 'function') {
        return a.getState() || {};
      }
    } catch (e) {}

    return {};
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;

    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;

    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  }

  function injectStyle() {
    if ($('groups-mobile-v100-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-mobile-v100-style';
    style.textContent = `
      :root{
        --v100-safe-top: env(safe-area-inset-top, 0px);
        --v100-safe-bottom: env(safe-area-inset-bottom, 0px);
      }

      /*
        Final tiny-screen polish:
        prevent mission / fever / power HUD from swallowing gameplay area.
      */
      @media (max-height:700px){
        .hud{
          top:calc(5px + var(--safe-top)) !important;
        }

        .wave-card{
          padding:7px 9px !important;
          border-radius:18px !important;
          max-width:57vw !important;
        }

        .wave-title{
          font-size:18px !important;
        }

        .wave-sub{
          font-size:11px !important;
          line-height:1.12 !important;
        }

        .chip{
          padding:6px 9px !important;
          font-size:11px !important;
        }

        .fever-hud{
          top:calc(68px + var(--safe-top)) !important;
          height:10px !important;
        }

        .fever-label{
          top:calc(80px + var(--safe-top)) !important;
          font-size:9px !important;
        }

        .mission-hud{
          top:calc(98px + var(--safe-top)) !important;
          padding:6px 8px !important;
          border-radius:16px !important;
        }

        .mission-top,
        .v98-event-title{
          font-size:10px !important;
        }

        .mission-count,
        .v98-event-count{
          font-size:9px !important;
          padding:3px 6px !important;
        }

        .mission-bar{
          height:6px !important;
          margin-top:4px !important;
        }

        .power-state{
          top:calc(140px + var(--safe-top)) !important;
        }

        .power-pill{
          font-size:9px !important;
          padding:4px 6px !important;
        }

        .v98-event-card{
          top:calc(160px + var(--safe-top)) !important;
          padding:6px 8px !important;
          border-radius:16px !important;
        }

        .v98-event-bars{
          margin-top:5px !important;
        }

        .stage{
          inset:188px 0 178px !important;
        }

        .food{
          width:86px !important;
          height:86px !important;
          margin-left:-43px !important;
          font-size:44px !important;
          border-width:5px !important;
        }

        .prompt{
          bottom:calc(103px + var(--safe-bottom)) !important;
          min-height:50px !important;
          padding:6px 8px !important;
          font-size:clamp(15px,4.5vw,21px) !important;
        }

        .prompt small{
          font-size:9px !important;
          margin-top:2px !important;
        }

        .gates{
          bottom:calc(28px + var(--safe-bottom)) !important;
          gap:4px !important;
        }

        .gate{
          min-height:56px !important;
          max-height:64px !important;
          border-radius:14px !important;
          padding:4px 1px 3px !important;
        }

        .gate .num{
          width:22px !important;
          height:22px !important;
          font-size:12px !important;
          border-radius:9px !important;
        }

        .gate .label{
          font-size:9.5px !important;
        }
      }

      @media (max-width:360px){
        .gate .label{
          font-size:8.8px !important;
        }

        .prompt{
          left:7px !important;
          right:7px !important;
        }

        .gates{
          left:5px !important;
          right:5px !important;
        }
      }

      .v100-toast{
        position:fixed;
        left:50%;
        bottom:calc(16px + var(--v100-safe-bottom));
        transform:translateX(-50%);
        z-index:2147482500;
        width:min(520px,calc(100vw - 24px));
        border-radius:22px;
        padding:12px 14px;
        background:rgba(36,78,104,.96);
        color:#fff;
        box-shadow:0 20px 62px rgba(35,81,107,.32);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:14px;
        line-height:1.35;
        font-weight:900;
        text-align:center;
        display:none;
      }

      .v100-toast.show{
        display:block;
        animation:v100Toast .22s ease both;
      }

      @keyframes v100Toast{
        from{opacity:0; transform:translateX(-50%) translateY(8px);}
        to{opacity:1; transform:translateX(-50%) translateY(0);}
      }

      .v100-rescue{
        position:fixed;
        inset:auto 12px calc(16px + var(--v100-safe-bottom)) 12px;
        z-index:2147482600;
        border-radius:28px;
        padding:15px;
        background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(239,251,255,.96));
        color:#244e68;
        box-shadow:0 26px 80px rgba(35,81,107,.34);
        border:2px solid rgba(255,255,255,.92);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        display:none;
      }

      .v100-rescue.show{
        display:block;
        animation:v100Rescue .22s ease both;
      }

      @keyframes v100Rescue{
        from{opacity:0; transform:translateY(10px) scale(.98);}
        to{opacity:1; transform:translateY(0) scale(1);}
      }

      .v100-rescue h3{
        margin:0;
        font-size:18px;
        line-height:1.15;
        font-weight:1000;
      }

      .v100-rescue p{
        margin:7px 0 12px;
        color:#7193a8;
        font-size:13px;
        line-height:1.35;
        font-weight:850;
      }

      .v100-actions{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
      }

      .v100-actions button{
        border:0;
        border-radius:999px;
        padding:11px 10px;
        font:inherit;
        font-size:13px;
        font-weight:1000;
        background:#fff;
        box-shadow:0 10px 26px rgba(35,81,107,.14);
        color:#244e68;
      }

      .v100-actions button.primary{
        background:linear-gradient(135deg,#ffb347,#ff8f3d);
        color:#fff;
      }

      .v100-actions button.zone{
        background:linear-gradient(135deg,#eaffda,#ffffff);
      }

      .v100-debug{
        position:fixed;
        left:10px;
        top:calc(10px + var(--v100-safe-top));
        z-index:2147482400;
        max-width:calc(100vw - 20px);
        border-radius:18px;
        padding:8px 10px;
        background:rgba(36,78,104,.92);
        color:#fff;
        font:12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        display:none;
        pointer-events:none;
        white-space:pre-wrap;
      }

      body.v100-debug-on .v100-debug{
        display:block;
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureUi() {
    if (!$('v100Toast')) {
      const toast = DOC.createElement('div');
      toast.id = 'v100Toast';
      toast.className = 'v100-toast';
      DOC.body.appendChild(toast);
    }

    if (!$('v100Rescue')) {
      const box = DOC.createElement('div');
      box.id = 'v100Rescue';
      box.className = 'v100-rescue';
      box.innerHTML = `
        <h3>🛟 ตัวช่วยฉุกเฉิน</h3>
        <p id="v100RescueText">ถ้าเกมค้างหรือ UI ไม่ตอบสนอง ใช้ปุ่มด้านล่างเพื่อกู้สถานะ</p>
        <div class="v100-actions">
          <button id="v100ContinueBtn" type="button" class="primary">เล่นต่อ</button>
          <button id="v100EndBtn" type="button">จบเกม</button>
          <button id="v100ReplayBtn" type="button">เริ่มใหม่</button>
          <button id="v100ZoneBtn" type="button" class="zone">กลับ Nutrition Zone</button>
        </div>
      `;
      DOC.body.appendChild(box);
    }

    if (!$('v100Debug')) {
      const debug = DOC.createElement('div');
      debug.id = 'v100Debug';
      debug.className = 'v100-debug';
      DOC.body.appendChild(debug);
    }
  }

  function toast(msg, ms) {
    const el = $('v100Toast');
    if (!el) return;

    el.textContent = msg;
    el.classList.add('show');

    clearTimeout(el.__timer);
    el.__timer = setTimeout(() => {
      el.classList.remove('show');
    }, ms || 2600);
  }

  function zoneUrl() {
    const hub = qs('hub', '');

    if (hub && hub.includes('nutrition-zone.html')) {
      return hub;
    }

    const u = new URL('https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html');

    [
      'pid',
      'name',
      'diff',
      'time',
      'view',
      'seed',
      'studyId',
      'conditionGroup'
    ].forEach(k => {
      const v = qs(k, '');
      if (v) u.searchParams.set(k, v);
    });

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('from', 'groups-mobile-v100');
    u.searchParams.set('hub', 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html');

    return u.toString();
  }

  function showRescue(reason) {
    const box = $('v100Rescue');
    const text = $('v100RescueText');
    if (!box) return;

    state.rescueShown = true;

    if (text) {
      text.textContent = reason || 'ตรวจพบว่าเกมอาจค้างหรือไม่มีความคืบหน้า';
    }

    box.classList.add('show');
  }

  function hideRescue() {
    const box = $('v100Rescue');
    if (box) box.classList.remove('show');
    state.rescueShown = false;
  }

  function installUiEvents() {
    const continueBtn = $('v100ContinueBtn');
    const endBtn = $('v100EndBtn');
    const replayBtn = $('v100ReplayBtn');
    const zoneBtn = $('v100ZoneBtn');

    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        hideRescue();
        toast('กลับเข้าเกมแล้ว');
      });
    }

    if (endBtn) {
      endBtn.addEventListener('click', () => {
        hideRescue();

        try {
          const a = api();
          if (a && typeof a.end === 'function') {
            a.end('v100-rescue-end');
            return;
          }
        } catch (e) {}

        toast('ไม่พบระบบจบเกมอัตโนมัติ กำลังเริ่มใหม่');
        setTimeout(() => location.reload(), 600);
      });
    }

    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        const u = new URL(location.href);
        u.searchParams.set('seed', String(Date.now()));
        u.searchParams.set('v', VERSION);
        location.href = u.toString();
      });
    }

    if (zoneBtn) {
      zoneBtn.addEventListener('click', () => {
        location.href = zoneUrl();
      });
    }
  }

  function currentSignature(s) {
    try {
      const c = s.current || {};
      return [
        s.mode,
        s.score,
        s.correct,
        s.miss,
        s.combo,
        c.kind,
        c.icon,
        c.group && c.group.key
      ].join('|');
    } catch (e) {
      return '';
    }
  }

  function updateProgressWatch(s) {
    const sig = currentSignature(s);
    const score = Number(s.score || 0);
    const correct = Number(s.correct || 0);

    if (
      sig !== state.lastCurrentSig ||
      score !== state.lastScore ||
      correct !== state.lastCorrect ||
      s.mode !== state.lastMode
    ) {
      state.lastProgressAt = Date.now();
      state.lastCurrentSig = sig;
      state.lastScore = score;
      state.lastCorrect = correct;
      state.lastMode = s.mode || '';
    }
  }

  function guardCoreLoaded() {
    if (api()) return true;

    const elapsed = Date.now() - state.startedAt;

    if (elapsed > 2200) {
      showRescue('ยังไม่พบ Core เกม Mobile v9.6 อาจโหลดไฟล์หลักไม่ครบ ลองเริ่มใหม่หรือกลับ Nutrition Zone');
      return false;
    }

    return false;
  }

  function guardGameplayStuck(s) {
    if (!s || s.mode !== 'game' || s.ended) return;

    updateProgressWatch(s);

    const noProgressMs = Date.now() - state.lastProgressAt;

    /*
      During countdown there may be no current item for a few seconds.
      Start warning only after 14 seconds with no state change.
    */
    if (noProgressMs > 14000 && !state.rescueShown) {
      showRescue('ดูเหมือนเกมไม่มีความคืบหน้านานเกินไป ถ้าอาหารไม่ตกหรือปุ่มไม่ตอบสนอง ให้กด “จบเกม” หรือ “เริ่มใหม่”');
    }
  }

  function guardSummary(s) {
    if (!s || s.mode !== 'summary') return;
    if (state.summaryChecked) return;

    state.summaryChecked = true;

    setTimeout(() => {
      const summary = DOC.getElementById('summary');
      const scoreText = DOC.getElementById('scoreText');
      const zoneBtn = DOC.getElementById('zoneBtn');

      if (!summary || !isVisible(summary)) {
        showRescue('เกมจบแล้วแต่หน้าสรุปไม่แสดง กดจบเกม/เริ่มใหม่เพื่อกู้สถานะ');
        return;
      }

      if (!scoreText || !String(scoreText.textContent || '').trim()) {
        toast('ตรวจพบหน้าสรุป แต่คะแนนอาจยังไม่สมบูรณ์');
      }

      if (zoneBtn && !zoneBtn.__v100ZonePatched) {
        zoneBtn.__v100ZonePatched = true;
        zoneBtn.addEventListener('click', () => {
          setTimeout(() => {
            if (location.href.includes('groups-mobile.html')) {
              location.href = zoneUrl();
            }
          }, 250);
        });
      }

      verifySummaryStorage();
    }, 400);
  }

  function verifySummaryStorage() {
    try {
      const raw = localStorage.getItem('HHA_GROUPS_MOBILE_SUMMARY');
      if (!raw) {
        toast('ยังไม่พบข้อมูล summary ในเครื่อง แต่หน้าสรุปยังใช้งานได้');
        return;
      }

      const summary = JSON.parse(raw);

      if (!summary || summary.game !== 'groups') {
        toast('summary ไม่ตรงเกม groups ตรวจสอบ storage ภายหลัง');
      }
    } catch (e) {
      toast('อ่าน summary storage ไม่สำเร็จ แต่เกมยังเล่นได้');
    }
  }

  function updateDebug(s) {
    const debugOn = qs('debug', '') === '1' || qs('qa', '') === '1';
    DOC.body.classList.toggle('v100-debug-on', debugOn);

    if (!debugOn) return;

    const el = $('v100Debug');
    if (!el) return;

    el.textContent = [
      `Groups Mobile QA ${VERSION}`,
      `core=${api() ? 'ok' : 'missing'}`,
      `mode=${s.mode || '-'}`,
      `score=${s.score || 0}`,
      `correct=${s.correct || 0}`,
      `miss=${s.miss || 0}`,
      `combo=${s.combo || 0}`,
      `phase=${s.phase || '-'}`,
      `current=${s.current ? (s.current.kind + ':' + s.current.icon) : '-'}`,
      `errors=${state.errorCount}`,
      `lastError=${state.lastError || '-'}`
    ].join('\n');
  }

  function guardLoop() {
    if (!guardCoreLoaded()) {
      updateDebug({});
      return;
    }

    const s = gameState();

    guardGameplayStuck(s);
    guardSummary(s);
    updateDebug(s);
  }

  function handleError(msg) {
    state.errorCount += 1;
    state.lastError = String(msg || '').slice(0, 160);

    if (state.errorCount >= 2 && !state.rescueShown) {
      showRescue('ตรวจพบ error ซ้ำในเกม ถ้าเล่นต่อไม่ได้ให้ใช้ปุ่มช่วยเหลือฉุกเฉิน');
    } else {
      toast('พบ error เล็กน้อย แต่ระบบยังพยายามเล่นต่อ');
    }
  }

  function installGlobalErrorGuard() {
    WIN.addEventListener('error', ev => {
      const msg = ev && (ev.message || (ev.error && ev.error.message));
      handleError(msg || 'window error');
    });

    WIN.addEventListener('unhandledrejection', ev => {
      const reason = ev && ev.reason;
      const msg = reason && (reason.message || String(reason));
      handleError(msg || 'unhandled promise rejection');
    });
  }

  function installGameEvents() {
    WIN.addEventListener('groups:judge', () => {
      state.lastProgressAt = Date.now();

      if (state.rescueShown) {
        hideRescue();
      }
    });

    WIN.addEventListener('groups:decoy-dodged', () => {
      state.lastProgressAt = Date.now();
    });

    WIN.addEventListener('groups:end', () => {
      state.lastProgressAt = Date.now();
      setTimeout(() => {
        const s = gameState();
        guardSummary(s);
      }, 300);
    });

    DOC.addEventListener('visibilitychange', () => {
      if (!DOC.hidden) {
        state.lastProgressAt = Date.now();
        setTimeout(guardLoop, 250);
      }
    });

    /*
      Triple tap top-left to open rescue manually.
    */
    let taps = [];
    DOC.addEventListener('pointerdown', ev => {
      if (ev.clientX > 80 || ev.clientY > 90) return;

      const t = Date.now();
      taps = taps.filter(x => t - x < 900);
      taps.push(t);

      if (taps.length >= 3) {
        taps = [];
        showRescue('เปิดตัวช่วยฉุกเฉินด้วยการแตะมุมซ้ายบน 3 ครั้ง');
      }
    }, { passive: true });
  }

  function expose() {
    WIN.HHA_GROUPS_MOBILE_V100_QA = {
      version: VERSION,
      showRescue,
      hideRescue,
      zoneUrl,
      getState: function () {
        return {
          version: VERSION,
          coreLoaded: Boolean(api()),
          rescueShown: state.rescueShown,
          errorCount: state.errorCount,
          lastError: state.lastError,
          lastProgressAt: state.lastProgressAt,
          gameState: gameState()
        };
      }
    };
  }

  function init() {
    injectStyle();
    ensureUi();
    installUiEvents();
    installGlobalErrorGuard();
    installGameEvents();
    expose();

    state.guardTimer = setInterval(guardLoop, 1000);
    state.uiTimer = setTimeout(() => {
      if (api()) {
        toast('Groups Mobile พร้อมเล่นแล้ว', 1400);
      }
    }, 900);

    console.info('[Groups Mobile v10.0] final QA guard installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
