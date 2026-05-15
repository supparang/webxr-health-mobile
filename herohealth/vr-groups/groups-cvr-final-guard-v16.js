// === /herohealth/vr-groups/groups-cvr-final-guard-v16.js ===
// HeroHealth Groups cVR — v1.6 Final QA Guard
// Adds:
// - Core load check
// - Shoot / aim / summary guard
// - Stuck-state watcher
// - Rescue panel
// - Safe replay / safe end / safe Nutrition Zone return
// - QA debug overlay with ?qa=1 or ?debug=1
// Safe add-on: does not change scoring logic.
// PATCH v20260515-GROUPS-CVR-V16-FINAL-QA-GUARD

(function () {
  'use strict';

  const VERSION = 'v1.6-cvr-final-qa-guard-20260515';

  if (window.__HHA_GROUPS_CVR_FINAL_GUARD_V16__) return;
  window.__HHA_GROUPS_CVR_FINAL_GUARD_V16__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    bootAt: Date.now(),
    lastSig: '',
    lastProgressAt: Date.now(),
    lastMode: '',
    lastScore: 0,
    lastCorrect: 0,
    lastMiss: 0,
    lastShots: 0,
    lastHits: 0,
    rescueShown: false,
    summaryChecked: false,
    coreWarned: false,
    shootWarned: false,
    errorCount: 0,
    lastError: '',
    timer: null
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

  function coreApi() {
    return WIN.HHA_GROUPS_CVR_V1 || null;
  }

  function shootApi() {
    return WIN.HHA_GROUPS_CVR_SHOOT_FIX_V11 || null;
  }

  function aimApi() {
    return WIN.HHA_GROUPS_CVR_AIM_ASSIST_V12 || null;
  }

  function comfortApi() {
    return WIN.HHA_GROUPS_CVR_COMFORT_V13 || null;
  }

  function replayApi() {
    return WIN.HHA_GROUPS_CVR_REPLAY_METRICS_V15 || null;
  }

  function gs() {
    try {
      const a = coreApi();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function shootState() {
    try {
      const a = shootApi();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function aimState() {
    try {
      const a = aimApi();
      if (a && typeof a.getTarget === 'function') return a.getTarget() || {};
    } catch (e) {}
    return {};
  }

  function comfortState() {
    try {
      const a = comfortApi();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function isPlaying() {
    const s = gs();
    return s && s.mode === 'game' && !s.ended;
  }

  function isSummary() {
    const s = gs();
    return s && s.mode === 'summary';
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
    u.searchParams.set('from', 'groups-cvr-v16');
    u.searchParams.set('hub', 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html');

    return u.toString();
  }

  function replayUrl() {
    const u = new URL(location.href);
    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.set('v', VERSION);
    return u.toString();
  }

  function injectStyle() {
    if ($('groups-cvr-v16-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v16-style';
    style.textContent = `
      .cvr-v16-toast{
        position:fixed;
        left:50%;
        bottom:calc(62px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:2147482700;
        width:min(540px,calc(100vw - 24px));
        border-radius:24px;
        padding:11px 14px;
        background:rgba(36,78,104,.96);
        color:#fff;
        box-shadow:0 22px 66px rgba(35,81,107,.32);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:clamp(14px,3.8vw,20px);
        line-height:1.3;
        font-weight:950;
        text-align:center;
        pointer-events:none;
        display:none;
      }

      .cvr-v16-toast.show{
        display:block;
        animation:cvrV16Toast .22s ease both;
      }

      @keyframes cvrV16Toast{
        from{opacity:0; transform:translateX(-50%) translateY(8px);}
        to{opacity:1; transform:translateX(-50%) translateY(0);}
      }

      .cvr-v16-rescue{
        position:fixed;
        left:50%;
        top:50%;
        transform:translate(-50%,-50%);
        z-index:2147482800;
        width:min(540px,calc(100vw - 26px));
        border-radius:32px;
        padding:18px;
        background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(239,251,255,.96));
        color:#244e68;
        box-shadow:0 30px 90px rgba(35,81,107,.36);
        border:2px solid rgba(255,255,255,.92);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        display:none;
      }

      .cvr-v16-rescue.show{
        display:block;
        animation:cvrV16Rescue .24s ease both;
      }

      @keyframes cvrV16Rescue{
        from{opacity:0; transform:translate(-50%,-44%) scale(.96);}
        to{opacity:1; transform:translate(-50%,-50%) scale(1);}
      }

      .cvr-v16-rescue h3{
        margin:0;
        font-size:22px;
        line-height:1.12;
        font-weight:1000;
      }

      .cvr-v16-rescue p{
        margin:9px 0 14px;
        color:#7193a8;
        font-size:14px;
        line-height:1.38;
        font-weight:850;
      }

      .cvr-v16-actions{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
      }

      .cvr-v16-actions button{
        border:0;
        border-radius:999px;
        padding:12px 10px;
        background:#fff;
        color:#244e68;
        box-shadow:0 10px 26px rgba(35,81,107,.14);
        font:inherit;
        font-size:14px;
        line-height:1;
        font-weight:1000;
        cursor:pointer;
      }

      .cvr-v16-actions button.primary{
        background:linear-gradient(135deg,#ffb347,#ff8f3d);
        color:#fff;
      }

      .cvr-v16-actions button.zone{
        background:linear-gradient(135deg,#eaffda,#ffffff);
      }

      .cvr-v16-debug{
        position:fixed;
        left:8px;
        top:calc(8px + env(safe-area-inset-top,0px));
        z-index:2147482600;
        display:none;
        max-width:calc(100vw - 16px);
        border-radius:18px;
        padding:8px 10px;
        background:rgba(36,78,104,.92);
        color:#fff;
        font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        white-space:pre-wrap;
        pointer-events:none;
      }

      body.cvr-v16-debug-on .cvr-v16-debug{
        display:block;
      }

      .cvr-v16-safe-shoot{
        position:fixed;
        right:10px;
        top:calc(10px + env(safe-area-inset-top,0px));
        z-index:2147482200;
        border:0;
        border-radius:999px;
        padding:10px 12px;
        background:rgba(255,255,255,.94);
        color:#244e68;
        box-shadow:0 12px 30px rgba(35,81,107,.16);
        font:inherit;
        font-size:13px;
        line-height:1;
        font-weight:1000;
        cursor:pointer;
        display:none;
      }

      body.playing .cvr-v16-safe-shoot{
        display:block;
      }

      @media (max-width:460px){
        .cvr-v16-actions{
          grid-template-columns:1fr;
        }

        .cvr-v16-safe-shoot{
          top:calc(54px + env(safe-area-inset-top,0px));
          padding:9px 10px;
          font-size:12px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureUi() {
    if (!$('cvrV16Toast')) {
      const toast = DOC.createElement('div');
      toast.id = 'cvrV16Toast';
      toast.className = 'cvr-v16-toast';
      DOC.body.appendChild(toast);
    }

    if (!$('cvrV16Rescue')) {
      const panel = DOC.createElement('div');
      panel.id = 'cvrV16Rescue';
      panel.className = 'cvr-v16-rescue';
      panel.innerHTML = `
        <h3>🛟 cVR Rescue</h3>
        <p id="cvrV16RescueText">
          ถ้าเกมค้าง ยิงไม่ได้ หรือประตูไม่อยู่ตรงหน้า ใช้ปุ่มด้านล่างเพื่อกู้สถานะ
        </p>
        <div class="cvr-v16-actions">
          <button id="cvrV16ContinueBtn" class="primary" type="button">เล่นต่อ</button>
          <button id="cvrV16RecenterBtn" type="button">🎯 Recenter</button>
          <button id="cvrV16ShootBtn" type="button">ทดสอบยิง</button>
          <button id="cvrV16EndBtn" type="button">จบเกม</button>
          <button id="cvrV16ReplayBtn" type="button">เริ่มใหม่</button>
          <button id="cvrV16ZoneBtn" class="zone" type="button">Nutrition Zone</button>
        </div>
      `;
      DOC.body.appendChild(panel);
    }

    if (!$('cvrV16Debug')) {
      const debug = DOC.createElement('div');
      debug.id = 'cvrV16Debug';
      debug.className = 'cvr-v16-debug';
      DOC.body.appendChild(debug);
    }

    if (!$('cvrV16SafeShoot')) {
      const shoot = DOC.createElement('button');
      shoot.id = 'cvrV16SafeShoot';
      shoot.className = 'cvr-v16-safe-shoot';
      shoot.type = 'button';
      shoot.textContent = '🎯 Shoot';
      DOC.body.appendChild(shoot);
    }
  }

  function toast(msg, ms) {
    const el = $('cvrV16Toast');
    if (!el) return;

    el.textContent = msg;
    el.classList.add('show');

    clearTimeout(el.__timer);
    el.__timer = setTimeout(() => {
      el.classList.remove('show');
    }, ms || 2400);
  }

  function showRescue(reason) {
    const panel = $('cvrV16Rescue');
    const text = $('cvrV16RescueText');
    if (!panel) return;

    state.rescueShown = true;

    if (text) {
      text.textContent = reason || 'ตรวจพบว่าเกมอาจค้างหรือยิงไม่ตอบสนอง';
    }

    panel.classList.add('show');
  }

  function hideRescue() {
    const panel = $('cvrV16Rescue');
    if (panel) panel.classList.remove('show');
    state.rescueShown = false;
  }

  function safeShoot(source) {
    try {
      const sh = shootApi();
      if (sh && typeof sh.shoot === 'function') {
        const ok = sh.shoot(source || 'v16-safe-shoot');
        if (ok) {
          toast('🎯 ยิงแล้ว');
          return true;
        }
      }
    } catch (e) {}

    try {
      const core = coreApi();
      if (core && typeof core.shoot === 'function') {
        core.shoot();
        toast('🎯 ยิงแล้ว');
        return true;
      }
    } catch (e) {}

    try {
      WIN.dispatchEvent(new CustomEvent('hha:shoot', {
        detail: {
          source: source || 'v16-safe-shoot',
          version: VERSION
        }
      }));
      toast('ส่งคำสั่งยิงแล้ว');
      return true;
    } catch (e) {}

    toast('ยังยิงไม่ได้');
    return false;
  }

  function safeRecenter(source) {
    try {
      const comfort = comfortApi();
      if (comfort && typeof comfort.recenter === 'function') {
        comfort.recenter(source || 'v16');
        return true;
      }
    } catch (e) {}

    toast('ยังไม่พบระบบ Recenter');
    return false;
  }

  function safeEnd(reason) {
    try {
      const core = coreApi();
      if (core && typeof core.end === 'function') {
        core.end(reason || 'v16-rescue-end');
        return true;
      }
    } catch (e) {}

    toast('จบเกมอัตโนมัติไม่ได้ กำลังเริ่มใหม่');
    setTimeout(() => {
      location.href = replayUrl();
    }, 700);

    return false;
  }

  function signature(s, sh) {
    return [
      s.mode || '',
      s.score || 0,
      s.correct || 0,
      s.miss || 0,
      s.combo || 0,
      s.phase || '',
      s.current && s.current.kind || '',
      s.current && s.current.icon || '',
      sh.shots || 0,
      sh.hits || 0
    ].join('|');
  }

  function updateProgressWatch() {
    const s = gs();
    const sh = shootState();

    if (!s || !s.mode) return;

    const sig = signature(s, sh);

    if (
      sig !== state.lastSig ||
      s.mode !== state.lastMode ||
      Number(s.score || 0) !== state.lastScore ||
      Number(s.correct || 0) !== state.lastCorrect ||
      Number(s.miss || 0) !== state.lastMiss ||
      Number(sh.shots || 0) !== state.lastShots ||
      Number(sh.hits || 0) !== state.lastHits
    ) {
      state.lastSig = sig;
      state.lastMode = s.mode || '';
      state.lastScore = Number(s.score || 0);
      state.lastCorrect = Number(s.correct || 0);
      state.lastMiss = Number(s.miss || 0);
      state.lastShots = Number(sh.shots || 0);
      state.lastHits = Number(sh.hits || 0);
      state.lastProgressAt = Date.now();

      if (state.rescueShown && s.mode === 'game') {
        hideRescue();
      }
    }
  }

  function guardCoreLoaded() {
    if (coreApi()) return true;

    const elapsed = Date.now() - state.bootAt;

    if (elapsed > 2600 && !state.coreWarned) {
      state.coreWarned = true;
      showRescue('ยังไม่พบ Core ของ Groups cVR อาจโหลดไฟล์หลักไม่ครบ ลองเริ่มใหม่หรือกลับ Nutrition Zone');
    }

    return false;
  }

  function guardShootSystem() {
    const s = gs();
    if (!s || s.mode !== 'game' || s.ended) return;

    const elapsedGame = Date.now() - Number(s.startedAt || state.bootAt);
    const sh = shootState();

    if (!shootApi() && !state.shootWarned && Date.now() - state.bootAt > 4200) {
      state.shootWarned = true;
      toast('ยังไม่พบ Shoot Fix v1.1 ถ้ายิงไม่ได้ให้ตรวจ script tag');
    }

    /*
      If player has been in game a while and there are no shots,
      show a gentle hint, not a rescue immediately.
    */
    if (elapsedGame > 15000 && Number(sh.shots || 0) === 0 && !state.shootWarned) {
      state.shootWarned = true;
      toast('แตะจอ หรือกดปุ่ม 🎯 Shoot เพื่อยิง');
    }
  }

  function guardStuck() {
    const s = gs();

    if (!s || s.mode !== 'game' || s.ended) return;

    updateProgressWatch();

    const noProgress = Date.now() - state.lastProgressAt;

    /*
      cVR may have slow moments while a child is aiming.
      Use a longer threshold than Mobile/PC.
    */
    if (noProgress > 22000 && !state.rescueShown) {
      showRescue('ดูเหมือนเกมไม่มีความคืบหน้านานเกินไป ถ้ายิงไม่ได้ให้กด “ทดสอบยิง” หรือ “Recenter”');
    }
  }

  function guardSummary() {
    const s = gs();

    if (!s || s.mode !== 'summary') return;
    if (state.summaryChecked) return;

    state.summaryChecked = true;

    setTimeout(() => {
      const summary = $('summary');
      const scoreText = $('scoreText');
      const zoneBtn = $('zoneBtn');

      if (!summary || !summary.classList.contains('active')) {
        showRescue('เกมจบแล้วแต่หน้าสรุปไม่แสดง กดเริ่มใหม่หรือกลับ Nutrition Zone');
        return;
      }

      if (!scoreText || !String(scoreText.textContent || '').trim()) {
        toast('หน้าสรุปขึ้นแล้ว แต่คะแนนอาจยังไม่สมบูรณ์');
      }

      try {
        const raw = localStorage.getItem('HHA_GROUPS_CVR_SUMMARY');
        if (!raw) {
          toast('ยังไม่พบ cVR summary ในเครื่อง แต่หน้าสรุปยังใช้งานได้');
        }
      } catch (e) {}

      if (zoneBtn && !zoneBtn.__cvrV16Patched) {
        zoneBtn.__cvrV16Patched = true;
        zoneBtn.addEventListener('click', () => {
          setTimeout(() => {
            if (location.href.includes('groups-cvr.html')) {
              location.href = zoneUrl();
            }
          }, 250);
        });
      }
    }, 450);
  }

  function updateDebug() {
    const debugOn = qs('qa', '') === '1' || qs('debug', '') === '1';
    DOC.body.classList.toggle('cvr-v16-debug-on', debugOn);

    if (!debugOn) return;

    const el = $('cvrV16Debug');
    if (!el) return;

    const s = gs();
    const sh = shootState();
    const aim = aimState();
    const comfort = comfortState();

    el.textContent = [
      `Groups cVR QA ${VERSION}`,
      `core=${coreApi() ? 'ok' : 'missing'}`,
      `shootFix=${shootApi() ? 'ok' : 'missing'}`,
      `aimAssist=${aimApi() ? 'ok' : 'missing'}`,
      `comfort=${comfortApi() ? 'ok' : 'missing'}`,
      `replay=${replayApi() ? 'ok' : 'missing'}`,
      `mode=${s.mode || '-'}`,
      `score=${s.score || 0}`,
      `correct=${s.correct || 0}`,
      `miss=${s.miss || 0}`,
      `combo=${s.combo || 0}`,
      `phase=${s.phase || '-'}`,
      `current=${s.current ? ((s.current.kind || '-') + ':' + (s.current.icon || '-')) : '-'}`,
      `shots=${sh.shots || 0}`,
      `hits=${sh.hits || 0}`,
      `shootMisses=${sh.misses || 0}`,
      `aimTarget=${aim.targetKey || '-'}`,
      `aimConf=${Math.round(Number(aim.confidence || 0) * 100)}%`,
      `recenter=${comfort.recenterCount || 0}`,
      `errors=${state.errorCount}`,
      `lastError=${state.lastError || '-'}`
    ].join('\n');
  }

  function loop() {
    if (!guardCoreLoaded()) {
      updateDebug();
      return;
    }

    guardShootSystem();
    guardStuck();
    guardSummary();
    updateDebug();
  }

  function installUiEvents() {
    $('cvrV16ContinueBtn')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      hideRescue();
      toast('กลับเข้าเกมแล้ว');
    });

    $('cvrV16RecenterBtn')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      safeRecenter('v16-rescue');
      hideRescue();
    });

    $('cvrV16ShootBtn')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      safeShoot('v16-rescue-test');
    });

    $('cvrV16EndBtn')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      hideRescue();
      safeEnd('v16-rescue-end');
    });

    $('cvrV16ReplayBtn')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      location.href = replayUrl();
    });

    $('cvrV16ZoneBtn')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      location.href = zoneUrl();
    });

    $('cvrV16SafeShoot')?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      safeShoot('v16-safe-shoot-button');
    });
  }

  function installGameEvents() {
    WIN.addEventListener('groups-cvr:end', () => {
      state.lastProgressAt = Date.now();
      setTimeout(guardSummary, 400);
    });

    WIN.addEventListener('groups:end', () => {
      state.lastProgressAt = Date.now();
      setTimeout(guardSummary, 400);
    });

    WIN.addEventListener('hha:shoot', () => {
      state.lastProgressAt = Date.now();
    }, true);

    DOC.addEventListener('visibilitychange', () => {
      if (!DOC.hidden) {
        state.lastProgressAt = Date.now();
        setTimeout(loop, 300);
      }
    });

    DOC.addEventListener('keydown', ev => {
      if (!isPlaying()) return;

      if (ev.key === 'q' || ev.key === 'Q') {
        showRescue('เปิด cVR Rescue ด้วยปุ่ม Q');
      }
    }, true);

    /*
      Four taps on top-left opens rescue.
      Useful on mobile when buttons are hard to reach.
    */
    let taps = [];
    DOC.addEventListener('pointerdown', ev => {
      if (!isPlaying()) return;

      if (ev.clientX > 92 || ev.clientY > 92) return;

      const t = Date.now();
      taps = taps.filter(x => t - x < 1100);
      taps.push(t);

      if (taps.length >= 4) {
        taps = [];
        showRescue('เปิด cVR Rescue ด้วยการแตะมุมซ้ายบน 4 ครั้ง');
      }
    }, { passive: true });
  }

  function installErrorGuard() {
    WIN.addEventListener('error', ev => {
      state.errorCount += 1;
      state.lastError = String(ev.message || 'window error').slice(0, 180);

      if (state.errorCount >= 2 && !state.rescueShown) {
        showRescue('ตรวจพบ error ซ้ำใน cVR ถ้าเล่นต่อไม่ได้ให้ใช้ปุ่มกู้สถานะ');
      }
    });

    WIN.addEventListener('unhandledrejection', ev => {
      state.errorCount += 1;
      const reason = ev.reason;
      state.lastError = String((reason && reason.message) || reason || 'promise error').slice(0, 180);

      if (state.errorCount >= 2 && !state.rescueShown) {
        showRescue('ตรวจพบ promise error ซ้ำใน cVR ถ้าเล่นต่อไม่ได้ให้ใช้ปุ่มกู้สถานะ');
      }
    });
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_FINAL_GUARD_V16 = {
      version: VERSION,
      showRescue,
      hideRescue,
      safeShoot,
      safeRecenter,
      safeEnd,
      zoneUrl,
      replayUrl,
      getState: function () {
        return {
          version: VERSION,
          coreLoaded: Boolean(coreApi()),
          shootFixLoaded: Boolean(shootApi()),
          aimAssistLoaded: Boolean(aimApi()),
          comfortLoaded: Boolean(comfortApi()),
          replayLoaded: Boolean(replayApi()),
          rescueShown: state.rescueShown,
          errorCount: state.errorCount,
          lastError: state.lastError,
          lastProgressAt: state.lastProgressAt,
          gameState: gs(),
          shootState: shootState(),
          aimState: aimState(),
          comfortState: comfortState()
        };
      }
    };
  }

  function init() {
    injectStyle();
    ensureUi();
    installUiEvents();
    installGameEvents();
    installErrorGuard();
    expose();

    state.timer = setInterval(loop, 1000);

    setTimeout(() => {
      if (coreApi()) toast('Groups cVR พร้อมเล่นแล้ว', 1400);
    }, 1100);

    console.info('[Groups cVR v1.6] final QA guard installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
