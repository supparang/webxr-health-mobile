// === /herohealth/vr-groups/groups-cvr-comfort-v13.js ===
// HeroHealth Groups cVR — v1.3 Comfort / Recenter / Cardboard UX Polish
// Adds:
// - Recenter arena to current head direction
// - Comfort controls: big text / reduced FX / steady mode
// - Cardboard-safe floating buttons
// - First-time comfort tip
// - Screen-size and orientation guard
// - Exit / Nutrition Zone fallback
// Safe add-on: does not change scoring logic.
// PATCH v20260515-GROUPS-CVR-V13-COMFORT-RECENTER

(function () {
  'use strict';

  const VERSION = 'v1.3-cvr-comfort-recenter-20260515';

  if (window.__HHA_GROUPS_CVR_COMFORT_V13__) return;
  window.__HHA_GROUPS_CVR_COMFORT_V13__ = true;

  const WIN = window;
  const DOC = document;

  const STORE = {
    settings: 'HHA_GROUPS_CVR_V13_SETTINGS',
    firstTip: 'HHA_GROUPS_CVR_V13_FIRST_TIP_DONE'
  };

  const state = {
    settings: {
      largeText: false,
      reducedFx: false,
      steady: true,
      showCoach: true
    },
    recenterCount: 0,
    lastYaw: 0,
    toastTimer: null,
    poll: null
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function api() {
    return WIN.HHA_GROUPS_CVR_V1 || null;
  }

  function gs() {
    try {
      const a = api();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function isPlaying() {
    const s = gs();
    return s && s.mode === 'game' && !s.ended;
  }

  function getJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function qs(name, fallback) {
    try {
      return new URL(location.href).searchParams.get(name) || fallback || '';
    } catch (e) {
      return fallback || '';
    }
  }

  function zoneUrl() {
    const hub = qs('hub', '');

    if (hub && hub.includes('nutrition-zone.html')) return hub;

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
    u.searchParams.set('from', 'groups-cvr-v13');
    u.searchParams.set('hub', 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html');

    return u.toString();
  }

  function loadSettings() {
    state.settings = Object.assign({}, state.settings, getJson(STORE.settings, {}));
  }

  function saveSettings() {
    setJson(STORE.settings, state.settings);
  }

  function injectStyle() {
    if ($('groups-cvr-v13-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v13-style';
    style.textContent = `
      body.cvr-v13-large-text .mission-title,
      body.cvr-v13-large-text .bottom-hint,
      body.cvr-v13-large-text .cvr-v12-aim-card{
        font-size:clamp(18px,5vw,28px) !important;
      }

      body.cvr-v13-large-text .mission-sub,
      body.cvr-v13-large-text .chip,
      body.cvr-v13-large-text .cvr-v12-status{
        font-size:clamp(14px,3.8vw,20px) !important;
      }

      body.cvr-v13-reduced-fx .center-toast,
      body.cvr-v13-reduced-fx .cvr-v11-shoot-tip,
      body.cvr-v13-reduced-fx .cvr-v12-aim-card,
      body.cvr-v13-reduced-fx .cvr-v12-lock,
      body.cvr-v13-reduced-fx #crosshair{
        animation:none !important;
      }

      body.cvr-v13-reduced-fx a-scene,
      body.cvr-v13-reduced-fx .hud,
      body.cvr-v13-reduced-fx .bottom-hint{
        transition:none !important;
      }

      /*
        Steady mode: keep HUD calm and prevent it from feeling too flashy in Cardboard.
      */
      body.cvr-v13-steady .hud{
        opacity:.96;
      }

      body.cvr-v13-steady .center-toast{
        top:54% !important;
      }

      .cvr-v13-controls{
        position:fixed;
        left:50%;
        bottom:calc(8px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:2147482300;
        display:flex;
        gap:7px;
        justify-content:center;
        align-items:center;
        pointer-events:auto;
        max-width:calc(100vw - 14px);
      }

      .cvr-v13-controls button{
        border:0;
        border-radius:999px;
        min-width:42px;
        height:42px;
        padding:0 12px;
        background:rgba(255,255,255,.94);
        color:#244e68;
        box-shadow:0 12px 30px rgba(35,81,107,.18);
        font:inherit;
        font-size:13px;
        line-height:1;
        font-weight:1000;
        cursor:pointer;
        white-space:nowrap;
      }

      .cvr-v13-controls button.primary{
        background:linear-gradient(135deg,#ffb347,#ff8f3d);
        color:#fff;
        text-shadow:0 1px 0 rgba(0,0,0,.08);
      }

      .cvr-v13-controls button.on{
        background:#fff5ca;
        color:#806000;
        box-shadow:inset 0 0 0 2px #ffd966, 0 12px 30px rgba(35,81,107,.16);
      }

      body:not(.playing) .cvr-v13-controls{
        display:none;
      }

      .cvr-v13-toast{
        position:fixed;
        left:50%;
        top:calc(150px + env(safe-area-inset-top,0px));
        transform:translateX(-50%);
        z-index:2147482400;
        width:min(520px,calc(100vw - 24px));
        border-radius:24px;
        padding:11px 14px;
        background:rgba(36,78,104,.96);
        color:#fff;
        box-shadow:0 20px 60px rgba(35,81,107,.28);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:clamp(14px,3.8vw,20px);
        line-height:1.28;
        font-weight:950;
        text-align:center;
        pointer-events:none;
        display:none;
      }

      .cvr-v13-toast.show{
        display:block;
        animation:cvrV13Toast .22s ease both;
      }

      @keyframes cvrV13Toast{
        from{opacity:0; transform:translateX(-50%) translateY(8px);}
        to{opacity:1; transform:translateX(-50%) translateY(0);}
      }

      .cvr-v13-comfort-card{
        position:fixed;
        left:50%;
        top:50%;
        transform:translate(-50%,-50%);
        z-index:2147482500;
        width:min(520px,calc(100vw - 26px));
        border-radius:32px;
        padding:18px;
        background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(239,251,255,.96));
        color:#244e68;
        box-shadow:0 28px 84px rgba(35,81,107,.34);
        border:2px solid rgba(255,255,255,.92);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        display:none;
      }

      .cvr-v13-comfort-card.show{
        display:block;
        animation:cvrV13Card .24s ease both;
      }

      @keyframes cvrV13Card{
        from{opacity:0; transform:translate(-50%,-44%) scale(.96);}
        to{opacity:1; transform:translate(-50%,-50%) scale(1);}
      }

      .cvr-v13-comfort-card h3{
        margin:0;
        font-size:22px;
        line-height:1.12;
        font-weight:1000;
      }

      .cvr-v13-comfort-card p{
        margin:9px 0 14px;
        color:#7193a8;
        font-size:14px;
        line-height:1.38;
        font-weight:850;
      }

      .cvr-v13-card-actions{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
      }

      .cvr-v13-card-actions button{
        border:0;
        border-radius:999px;
        padding:12px 10px;
        font:inherit;
        font-size:14px;
        line-height:1;
        font-weight:1000;
        background:#fff;
        color:#244e68;
        box-shadow:0 10px 26px rgba(35,81,107,.14);
        cursor:pointer;
      }

      .cvr-v13-card-actions button.primary{
        background:linear-gradient(135deg,#ffb347,#ff8f3d);
        color:#fff;
      }

      .cvr-v13-orientation{
        position:fixed;
        inset:0;
        z-index:2147482600;
        display:none;
        place-items:center;
        padding:20px;
        background:rgba(223,247,255,.96);
        color:#244e68;
        text-align:center;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .cvr-v13-orientation.show{
        display:grid;
      }

      .cvr-v13-orientation .box{
        width:min(480px,100%);
        border-radius:32px;
        padding:22px 18px;
        background:#fff;
        box-shadow:0 24px 70px rgba(35,81,107,.2);
      }

      .cvr-v13-orientation .emoji{
        font-size:64px;
        line-height:1;
      }

      .cvr-v13-orientation h3{
        margin:10px 0 0;
        font-size:28px;
        line-height:1.1;
        font-weight:1000;
      }

      .cvr-v13-orientation p{
        margin:9px 0 0;
        color:#7193a8;
        font-size:16px;
        line-height:1.35;
        font-weight:850;
      }

      @media (max-width:460px){
        .cvr-v13-controls{
          gap:5px;
          bottom:calc(6px + env(safe-area-inset-bottom,0px));
        }

        .cvr-v13-controls button{
          min-width:38px;
          height:38px;
          padding:0 9px;
          font-size:12px;
        }

        .cvr-v13-card-actions{
          grid-template-columns:1fr;
        }
      }

      @media (orientation:portrait) and (max-width:900px){
        body.playing.cvr-v13-check-orientation .cvr-v13-orientation{
          display:grid;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureUi() {
    if (!$('cvrV13Controls')) {
      const controls = DOC.createElement('div');
      controls.id = 'cvrV13Controls';
      controls.className = 'cvr-v13-controls';
      controls.innerHTML = `
        <button id="cvrV13RecenterBtn" class="primary" type="button">🎯 RECENTER</button>
        <button id="cvrV13LargeBtn" type="button">🔎</button>
        <button id="cvrV13FxBtn" type="button">🌿</button>
        <button id="cvrV13CoachBtn" type="button">💬</button>
        <button id="cvrV13ZoneBtn" type="button">Zone</button>
      `;
      DOC.body.appendChild(controls);
    }

    if (!$('cvrV13Toast')) {
      const toast = DOC.createElement('div');
      toast.id = 'cvrV13Toast';
      toast.className = 'cvr-v13-toast';
      toast.textContent = 'พร้อมเล่น';
      DOC.body.appendChild(toast);
    }

    if (!$('cvrV13ComfortCard')) {
      const card = DOC.createElement('div');
      card.id = 'cvrV13ComfortCard';
      card.className = 'cvr-v13-comfort-card';
      card.innerHTML = `
        <h3>🥽 ก่อนใส่ Cardboard</h3>
        <p>
          วางมือถือให้แน่น หันหน้าไปกลางสนาม แล้วกด RECENTER หนึ่งครั้ง
          ถ้ารู้สึกเวียนหัว ให้พักทันทีและใช้โหมดลดเอฟเฟกต์
        </p>
        <div class="cvr-v13-card-actions">
          <button id="cvrV13CardRecenter" class="primary" type="button">🎯 Recenter</button>
          <button id="cvrV13CardReduce" type="button">🌿 ลดเอฟเฟกต์</button>
          <button id="cvrV13CardClose" type="button">เริ่มต่อ</button>
          <button id="cvrV13CardZone" type="button">กลับ Zone</button>
        </div>
      `;
      DOC.body.appendChild(card);
    }

    if (!$('cvrV13Orientation')) {
      const orient = DOC.createElement('div');
      orient.id = 'cvrV13Orientation';
      orient.className = 'cvr-v13-orientation';
      orient.innerHTML = `
        <div class="box">
          <div class="emoji">📱↔️</div>
          <h3>หมุนเครื่องเป็นแนวนอน</h3>
          <p>โหมด Cardboard VR เล่นสบายที่สุดในแนวนอน แล้วกด RECENTER ก่อนเริ่มยิง</p>
        </div>
      `;
      DOC.body.appendChild(orient);
    }
  }

  function toast(msg, ms) {
    const el = $('cvrV13Toast');
    if (!el) return;

    el.textContent = msg;
    el.classList.add('show');

    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, ms || 2200);
  }

  function setComfortCard(show) {
    const el = $('cvrV13ComfortCard');
    if (!el) return;
    el.classList.toggle('show', Boolean(show));
  }

  function getCameraEntity() {
    return $('camera');
  }

  function getArenaEntity() {
    return $('arena');
  }

  function currentYawDeg() {
    if (!WIN.THREE) return 0;

    const camEl = getCameraEntity();
    if (!camEl || !camEl.object3D) return 0;

    const dir = new THREE.Vector3();
    camEl.object3D.getWorldDirection(dir);

    /*
      Default forward in the scene is negative Z.
      This yaw rotates the arena so the gates are centered in the current head direction.
    */
    const yaw = Math.atan2(dir.x, -dir.z) * 180 / Math.PI;

    return Number.isFinite(yaw) ? yaw : 0;
  }

  function recenterArena(source) {
    const arena = getArenaEntity();
    if (!arena) {
      toast('ยังไม่พบสนาม VR');
      return false;
    }

    const yaw = currentYawDeg();

    state.lastYaw = yaw;
    state.recenterCount += 1;

    try {
      arena.setAttribute('rotation', `0 ${yaw.toFixed(2)} 0`);
    } catch (e) {}

    toast('🎯 จัดสนามให้อยู่ด้านหน้าแล้ว');
    vibrate([25, 12, 25]);

    try {
      WIN.dispatchEvent(new CustomEvent('groups-cvr:recenter', {
        detail: {
          version: VERSION,
          yaw,
          source: source || 'button',
          count: state.recenterCount
        }
      }));
    } catch (e) {}

    return true;
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  }

  function applySettings() {
    DOC.body.classList.toggle('cvr-v13-large-text', Boolean(state.settings.largeText));
    DOC.body.classList.toggle('cvr-v13-reduced-fx', Boolean(state.settings.reducedFx));
    DOC.body.classList.toggle('cvr-v13-steady', Boolean(state.settings.steady));
    DOC.body.classList.toggle('cvr-v13-check-orientation', true);

    const aim = $('cvrV12AimCard');
    const status = $('cvrV12Status');

    if (aim) aim.style.display = state.settings.showCoach ? '' : 'none';
    if (status) status.style.display = state.settings.showCoach ? '' : 'none';

    updateButtons();

    try {
      const aimApi = WIN.HHA_GROUPS_CVR_AIM_ASSIST_V12;
      if (aimApi && typeof aimApi.setAimPx === 'function') {
        aimApi.setAimPx(state.settings.steady ? 300 : 260);
      }
    } catch (e) {}
  }

  function updateButtons() {
    const pairs = [
      ['cvrV13LargeBtn', 'largeText'],
      ['cvrV13FxBtn', 'reducedFx'],
      ['cvrV13CoachBtn', 'showCoach']
    ];

    pairs.forEach(pair => {
      const btn = $(pair[0]);
      if (btn) btn.classList.toggle('on', Boolean(state.settings[pair[1]]));
    });
  }

  function toggleSetting(key) {
    if (!(key in state.settings)) return;

    state.settings[key] = !state.settings[key];
    saveSettings();
    applySettings();

    const label = {
      largeText: 'ข้อความใหญ่',
      reducedFx: 'ลดเอฟเฟกต์',
      steady: 'Steady Mode',
      showCoach: 'คำใบ้'
    }[key] || key;

    toast(`${state.settings[key] ? 'เปิด' : 'ปิด'} ${label}`);
  }

  function showFirstTipIfNeeded() {
    const done = localStorage.getItem(STORE.firstTip) === '1';
    if (done) return;

    setTimeout(() => {
      const s = gs();
      if (s && s.mode === 'game' && !s.ended) {
        setComfortCard(true);
        localStorage.setItem(STORE.firstTip, '1');
      }
    }, 1400);
  }

  function installEvents() {
    $('cvrV13RecenterBtn')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      recenterArena('control-button');
    });

    $('cvrV13LargeBtn')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      toggleSetting('largeText');
    });

    $('cvrV13FxBtn')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      toggleSetting('reducedFx');
    });

    $('cvrV13CoachBtn')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      toggleSetting('showCoach');
    });

    $('cvrV13ZoneBtn')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      location.href = zoneUrl();
    });

    $('cvrV13CardRecenter')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      recenterArena('comfort-card');
    });

    $('cvrV13CardReduce')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();

      state.settings.reducedFx = true;
      saveSettings();
      applySettings();
      toast('🌿 เปิดโหมดลดเอฟเฟกต์แล้ว');
    });

    $('cvrV13CardClose')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      setComfortCard(false);
    });

    $('cvrV13CardZone')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      location.href = zoneUrl();
    });

    /*
      Long press / R key = recenter.
      Useful when testing on desktop or when VR UI buttons are hard to tap.
    */
    DOC.addEventListener('keydown', ev => {
      if (!isPlaying()) return;

      if (ev.key === 'r' || ev.key === 'R') {
        ev.preventDefault();
        recenterArena('keyboard-r');
      }
    }, true);

    let downAt = 0;
    DOC.addEventListener('pointerdown', ev => {
      if (!isPlaying()) return;
      downAt = Date.now();
    }, { passive: true });

    DOC.addEventListener('pointerup', ev => {
      if (!isPlaying()) return;

      const dt = Date.now() - downAt;

      /*
        Long press in a non-button area recenters instead of shooting.
        Keep it longer than normal tap to avoid accidental recenter.
      */
      if (dt > 850) {
        const target = ev.target;
        if (target && target.closest && target.closest('button')) return;

        ev.preventDefault();
        recenterArena('long-press');
      }
    }, { passive: false });

    WIN.addEventListener('groups-cvr:end', () => {
      setComfortCard(false);
    });

    WIN.addEventListener('groups:end', () => {
      setComfortCard(false);
    });
  }

  function poll() {
    const s = gs();

    if (s && s.mode === 'game' && !s.ended) {
      showFirstTipIfNeeded();
    }

    updateButtons();
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_COMFORT_V13 = {
      version: VERSION,
      recenter: recenterArena,
      zoneUrl,
      getState: function () {
        return {
          version: VERSION,
          settings: Object.assign({}, state.settings),
          recenterCount: state.recenterCount,
          lastYaw: state.lastYaw,
          playing: isPlaying()
        };
      },
      setSetting: function (key, value) {
        if (!(key in state.settings)) return;

        state.settings[key] = Boolean(value);
        saveSettings();
        applySettings();
      }
    };
  }

  function init() {
    injectStyle();
    ensureUi();
    loadSettings();
    applySettings();
    installEvents();
    expose();

    state.poll = setInterval(poll, 700);

    /*
      Give A-Frame / look-controls a moment, then align arena to current view.
    */
    setTimeout(() => {
      if (isPlaying()) recenterArena('auto-after-load');
    }, 1200);

    console.info('[Groups cVR v1.3] comfort/recenter installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
