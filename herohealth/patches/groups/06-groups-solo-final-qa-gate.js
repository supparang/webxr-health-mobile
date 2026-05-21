/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260520-groups-solo-final-qa-gate-06
   File: /herohealth/patches/groups/06-groups-solo-final-qa-gate.js

   Purpose:
   - Final QA Gate for Groups Solo
   - Check PC / Mobile / cVR readiness
   - Check Summary / Replay / Back Zone / Cooldown / Save Summary
   - Add non-blocking error guard
   - Store QA report for teacher/debug review
   - Show QA panel only when ?qa=1 or ?debug=1 or ?teacher=1
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260520-groups-solo-final-qa-gate-06';
  if (window.__HHA_GROUPS_SOLO_FINAL_QA_GATE__) return;
  window.__HHA_GROUPS_SOLO_FINAL_QA_GATE__ = true;

  const qs = new URLSearchParams(location.search);

  const BASE = 'https://supparang.github.io/webxr-health-mobile';
  const HERO = BASE + '/herohealth';

  const CANONICAL_RUN = '/herohealth/vr-groups/groups.html';
  const GAME_ID = 'groups';
  const MODE = 'solo';
  const ZONE = 'nutrition';

  const qaEnabled =
    qs.get('qa') === '1' ||
    qs.get('debug') === '1' ||
    qs.get('teacher') === '1';

  const state = {
    patch: PATCH_ID,
    startedAt: new Date().toISOString(),
    lastRunAt: null,
    errors: [],
    warnings: [],
    checks: [],
    score: { pass: 0, warn: 0, fail: 0 },
    latestReport: null
  };

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function viewMode(){
    const raw = String(qs.get('view') || '').toLowerCase();

    if (['pc','desktop'].includes(raw)) return 'pc';
    if (['mobile','phone','touch'].includes(raw)) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(raw)) return 'cvr';

    return isMobileUA() ? 'mobile' : 'pc';
  }

  const VIEW = viewMode();

  document.body.classList.add('hha-groups-qa-ready');
  document.body.classList.add('hha-groups-qa-view-' + VIEW);

  function safeText(v){
    return String(v === null || v === undefined ? '' : v).trim();
  }

  function textOf(el){
    return String(el && (el.innerText || el.textContent || el.getAttribute('aria-label') || '') || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function storageGet(key){
    try {
      return localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch(e) {
      return null;
    }
  }

  function storageSetJSON(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
  }

  function addCheck(id, label, status, detail){
    const item = {
      id,
      label,
      status,
      detail: detail || '',
      at: new Date().toISOString()
    };

    state.checks.push(item);

    if (status === 'pass') state.score.pass += 1;
    else if (status === 'warn') state.score.warn += 1;
    else state.score.fail += 1;

    return item;
  }

  function resetChecks(){
    state.checks = [];
    state.score.pass = 0;
    state.score.warn = 0;
    state.score.fail = 0;
  }

  function pageText(){
    return String(document.body && document.body.innerText || '');
  }

  function isSummaryVisible(){
    const t = pageText();

    return (
      t.includes('สรุปผลการเล่น') ||
      t.includes('เล่นอีกครั้ง') ||
      t.includes('กลับ Nutrition Zone') ||
      (t.includes('Food Hero') && t.includes('Best Score')) ||
      (t.includes('Mobile Final Polish') && t.includes('Avg Response'))
    );
  }

  function isGameplayVisible(){
    if (isSummaryVisible()) return false;

    const hasTargets = !!document.querySelector(
      '.food,.food-card,.foodItem,.target,.orb,.item,.gate,.group,.bucket,.answer,[data-food],[data-target],[data-group],[data-gate],[data-choice]'
    );

    const t = pageText();

    const hasGameWords =
      t.includes('คะแนน') ||
      t.includes('Score') ||
      t.includes('Combo') ||
      t.includes('คอมโบ') ||
      t.includes('เวลา') ||
      t.includes('หมู่');

    return hasTargets || hasGameWords;
  }

  function findSummaryRoot(){
    const candidates = Array.from(document.querySelectorAll('main,section,article,div'))
      .filter(el => {
        const t = textOf(el);
        if (t.length < 40) return false;

        return (
          t.includes('สรุปผลการเล่น') ||
          t.includes('เล่นอีกครั้ง') ||
          t.includes('กลับ Nutrition Zone') ||
          (t.includes('Food Hero') && t.includes('Best Score'))
        );
      })
      .map(el => {
        const r = el.getBoundingClientRect();
        return { el, area: Math.max(1, r.width * r.height) };
      })
      .filter(x => x.area > 10000)
      .sort((a,b) => b.area - a.area);

    return candidates.length ? candidates[0].el : null;
  }

  function getTargets(){
    return Array.from(document.querySelectorAll(
      '.food,.food-card,.foodItem,.target,.orb,.item,.gate,.group,.bucket,.answer,[data-food],[data-target],[data-group],[data-gate],[data-choice]'
    )).filter(el => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);

      return (
        r.width > 10 &&
        r.height > 10 &&
        st.display !== 'none' &&
        st.visibility !== 'hidden' &&
        Number(st.opacity) > 0.03
      );
    });
  }

  function checkCanonicalFile(){
    const ok = location.pathname.endsWith(CANONICAL_RUN);
    addCheck('canonical-file', 'ใช้ไฟล์ตัวจริง /herohealth/vr-groups/groups.html', ok ? 'pass' : 'warn', location.pathname);
  }

  function checkUrlParams(){
    const mode = qs.get('mode') || MODE;
    const zone = qs.get('zone') || qs.get('cat') || ZONE;
    const game = qs.get('game') || qs.get('gameId') || GAME_ID;

    addCheck('mode-solo', 'mode=solo', mode === 'solo' ? 'pass' : 'warn', 'mode=' + mode);
    addCheck('zone-nutrition', 'zone=nutrition', zone === 'nutrition' ? 'pass' : 'warn', 'zone=' + zone);
    addCheck('game-groups', 'game=groups', game === 'groups' ? 'pass' : 'warn', 'game=' + game);
    addCheck('view-supported', 'รองรับ view: pc / mobile / cvr', ['pc','mobile','cvr'].includes(VIEW) ? 'pass' : 'fail', 'view=' + VIEW);

    const hasPid = !!(qs.get('pid') || qs.get('studentId'));
    addCheck('player-id', 'มี pid หรือ studentId', hasPid ? 'pass' : 'warn', 'pid=' + safeText(qs.get('pid') || qs.get('studentId') || '(missing)'));
  }

  function checkLoadedPatches(){
    const required = [
      ['3-view stabilizer', '__HHA_GROUPS_SOLO_3VIEW_STABILIZER__'],
      ['summary mobile final', '__HHA_GROUPS_SOLO_SUMMARY_MOBILE_FINAL__'],
      ['gameplay mobile/cVR final', '__HHA_GROUPS_SOLO_GAMEPLAY_MOBILE_CVR_FINAL__'],
      ['cooldown flow final', '__HHA_GROUPS_SOLO_COOLDOWN_FLOW_FINAL__'],
      ['save/log final', '__HHA_GROUPS_SOLO_SAVE_LOG_FINAL__']
    ];

    required.forEach(([label, key]) => {
      addCheck('patch-' + key, 'Patch loaded: ' + label, window[key] ? 'pass' : 'warn', key + '=' + !!window[key]);
    });
  }

  function checkGameplayLayout(){
    if (!isGameplayVisible()) {
      addCheck('gameplay-visible', 'ยังไม่อยู่หน้า gameplay', 'warn', 'ตรวจแบบเต็มได้ตอน run=play หรือระหว่างเล่น');
      return;
    }

    const targets = getTargets();
    addCheck('targets-visible', 'มีอาหาร/เป้าหมายให้เล่น', targets.length >= 3 ? 'pass' : 'fail', 'visible targets=' + targets.length);

    if (VIEW === 'mobile') {
      const tooLarge = targets.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > window.innerWidth * 0.34 || r.height > window.innerHeight * 0.22;
      });

      addCheck('mobile-target-size', 'Mobile: เป้าไม่ใหญ่เกินไป', tooLarge.length === 0 ? 'pass' : 'warn', 'too large=' + tooLarge.length);

      const bodyOverflow = document.documentElement.scrollWidth > window.innerWidth + 8;
      addCheck('mobile-no-horizontal-overflow', 'Mobile: ไม่มีล้นแนวนอน', bodyOverflow ? 'warn' : 'pass', 'scrollWidth=' + document.documentElement.scrollWidth + ', innerWidth=' + window.innerWidth);
    }

    if (VIEW === 'cvr') {
      const hasCrosshair =
        !!document.querySelector('.hha-cvr-crosshair') ||
        !!document.querySelector('[data-hha-crosshair]') ||
        document.body.classList.contains('hha-view-cvr');

      addCheck('cvr-crosshair', 'cVR: มี crosshair หรือระบบเล็ง', hasCrosshair ? 'pass' : 'warn', hasCrosshair ? 'crosshair ready' : 'crosshair not found');

      const hasShootHook =
        !!window.__HHA_GROUPS_CVR_SHOOT_FALLBACK__ ||
        !!window.__HHA_GROUPS_GAMEPLAY_SHOOT_BOUND__ ||
        !!window.HHA_VR_UI ||
        Array.from(document.scripts).some(s => String(s.src || '').includes('/herohealth/vr/vr-ui.js'));

      addCheck('cvr-shoot-hook', 'cVR: มี shoot hook / vr-ui', hasShootHook ? 'pass' : 'warn', hasShootHook ? 'shoot hook ready' : 'shoot hook not detected');
    }
  }

  function checkSummaryFlow(){
    if (!isSummaryVisible()) {
      addCheck('summary-visible', 'ยังไม่อยู่หน้า Summary', 'warn', 'ตรวจ Summary เต็มได้หลังเล่นจบ');
      return;
    }

    const root = findSummaryRoot();
    addCheck('summary-root', 'Summary แสดงผล', root ? 'pass' : 'fail', root ? 'summary root found' : 'summary root not found');

    const text = textOf(root || document.body);

    addCheck('summary-score', 'Summary มีคะแนน', /\d+/.test(text) && (text.includes('คะแนน') || text.includes('Score')) ? 'pass' : 'warn', 'score text=' + (text.includes('คะแนน') || text.includes('Score')));
    addCheck('summary-replay', 'มีปุ่มเล่นอีกครั้ง', text.includes('เล่นอีกครั้ง') || text.includes('Replay') || text.includes('Play Again') ? 'pass' : 'warn', 'replay button');
    addCheck('summary-zone', 'มีปุ่มกลับ Nutrition Zone', text.includes('Nutrition Zone') ? 'pass' : 'warn', 'back zone button');

    const hasCooldown = text.includes('Cooldown') || text.includes('ผ่อนคลาย') || text.includes('ทำ Cooldown');
    addCheck('summary-cooldown', 'มี Cooldown flow', hasCooldown ? 'pass' : 'warn', hasCooldown ? 'cooldown visible' : 'cooldown not visible');
  }

  function checkBackLinks(){
    const links = Array.from(document.querySelectorAll('a,button,[role="button"]'));

    const textLinks = links.map(el => ({
      el,
      text: textOf(el),
      href: String(el.getAttribute && el.getAttribute('href') || '')
    }));

    const zoneLike = textLinks.filter(x =>
      x.text.includes('Nutrition Zone') ||
      x.text.includes('กลับโซน') ||
      x.href.includes('/nutrition-zone.html')
    );

    const wrongHub = textLinks.filter(x =>
      x.href.includes('/hub.html') &&
      (x.text.includes('Nutrition') || x.text.includes('Zone') || x.text.includes('กลับ'))
    );

    addCheck('back-zone-link', 'ปุ่มกลับ Zone ชี้ Nutrition Zone', zoneLike.length > 0 ? 'pass' : 'warn', 'zone links=' + zoneLike.length);
    addCheck('no-wrong-hub-return', 'ไม่กลับ Hub ผิดแทน Nutrition Zone', wrongHub.length === 0 ? 'pass' : 'warn', 'wrong hub links=' + wrongHub.length);
  }

  function checkFloatingButtons(){
    const floating = Array.from(document.querySelectorAll('button,a,div,[role="button"]'))
      .filter(el => {
        const st = getComputedStyle(el);
        if (st.position !== 'fixed' && st.position !== 'sticky') return false;

        const r = el.getBoundingClientRect();
        return (
          r.width >= 34 &&
          r.width <= 100 &&
          r.height >= 34 &&
          r.height <= 100 &&
          r.bottom >= window.innerHeight - 190 &&
          r.right >= window.innerWidth - 260
        );
      });

    if (isSummaryVisible()) {
      const visible = floating.filter(el => {
        const st = getComputedStyle(el);
        return st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0.05;
      });

      addCheck('summary-floating-hidden', 'Summary: ปุ่มลอยไม่บัง', visible.length <= 1 ? 'pass' : 'warn', 'visible floating=' + visible.length);
    } else {
      addCheck('gameplay-floating-safe', 'Gameplay: ปุ่มลอยอยู่ระดับปลอดภัย', floating.length <= 4 ? 'pass' : 'warn', 'floating=' + floating.length);
    }
  }

  function checkStorageAndLogging(){
    const keys = [
      'HHA_LAST_SUMMARY',
      'HHA_GROUPS_LAST_SUMMARY',
      'HHA_GROUPS_SOLO_LAST_SUMMARY',
      'HHA_NUTRITION_GROUPS_LAST_SUMMARY',
      'HHA_GROUPS_SOLO_LAST_SESSION_PAYLOAD'
    ];

    const found = keys.filter(k => !!storageGet(k));
    addCheck('summary-storage', 'Save Last Summary keys', found.length >= 2 ? 'pass' : 'warn', 'found=' + found.join(', '));

    const endpoint = qs.get('log') || qs.get('api') || qs.get('endpoint') || '';
    addCheck('log-endpoint-safe', 'Logging endpoint safe', endpoint ? 'pass' : 'warn', endpoint ? 'endpoint configured' : 'local only, no ?log= or ?api=');

    addCheck('save-log-patch-loaded', 'Save/Log patch loaded', window.__HHA_GROUPS_SOLO_SAVE_LOG_FINAL__ ? 'pass' : 'warn', window.__HHA_GROUPS_SOLO_SAVE_LOG_FINAL__ ? 'loaded' : 'not detected');
  }

  function buildReport(){
    resetChecks();
    state.lastRunAt = new Date().toISOString();

    checkCanonicalFile();
    checkUrlParams();
    checkLoadedPatches();
    checkGameplayLayout();
    checkSummaryFlow();
    checkBackLinks();
    checkFloatingButtons();
    checkStorageAndLogging();

    const status = state.score.fail > 0 ? 'fail' : state.score.warn > 0 ? 'warn' : 'pass';

    const report = {
      patch: PATCH_ID,
      status,
      score: Object.assign({}, state.score),
      view: VIEW,
      gameId: GAME_ID,
      mode: MODE,
      zone: ZONE,
      path: location.pathname,
      url: location.href,
      qaEnabled,
      isGameplayVisible: isGameplayVisible(),
      isSummaryVisible: isSummaryVisible(),
      errors: state.errors.slice(-20),
      warnings: state.warnings.slice(-20),
      checks: state.checks.slice(),
      createdAt: new Date().toISOString(),
      userAgent: navigator.userAgent || ''
    };

    state.latestReport = report;
    storageSetJSON('HHA_GROUPS_SOLO_QA_REPORT', report);
    storageSetJSON('HHA_GROUPS_LAST_QA_REPORT', report);

    window.HHA_GROUPS_SOLO_QA_REPORT = report;
    window.dispatchEvent(new CustomEvent('hha:groups:qa-report', { detail: report }));

    return report;
  }

  function addStyle(){
    if (document.getElementById('hha-groups-final-qa-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-final-qa-style';
    style.textContent = `
      .hha-groups-qa-pill{
        position:fixed;
        left:10px;
        bottom:calc(10px + env(safe-area-inset-bottom, 0px));
        z-index:999999;
        display:flex;
        align-items:center;
        gap:7px;
        border:0;
        border-radius:999px;
        padding:8px 11px;
        color:#fff;
        font:900 11px/1.1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 12px 28px rgba(0,0,0,.22);
        cursor:pointer;
        touch-action:manipulation;
      }
      .hha-groups-qa-pill.pass{ background:rgba(32,145,83,.92); }
      .hha-groups-qa-pill.warn{ background:rgba(222,139,28,.94); }
      .hha-groups-qa-pill.fail{ background:rgba(199,52,52,.94); }

      .hha-groups-qa-panel{
        position:fixed;
        left:10px;
        right:10px;
        bottom:calc(58px + env(safe-area-inset-bottom, 0px));
        z-index:999999;
        max-height:min(72vh, 620px);
        overflow:auto;
        padding:14px;
        border-radius:22px;
        background:rgba(255,255,255,.97);
        color:#1c3e52;
        border:2px solid rgba(183,226,240,.95);
        box-shadow:0 20px 48px rgba(0,0,0,.24);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        display:none;
      }
      .hha-groups-qa-panel.show{ display:block; }
      .hha-groups-qa-panel h3{ margin:0 0 8px; font-size:18px; line-height:1.15; }
      .hha-groups-qa-panel .qa-meta{ margin:0 0 10px; font-size:12px; color:#668596; font-weight:800; }
      .hha-groups-qa-panel .qa-row{ display:grid; grid-template-columns:58px 1fr; gap:8px; align-items:start; padding:8px 0; border-top:1px solid rgba(192,222,232,.75); font-size:12px; }
      .hha-groups-qa-panel .qa-status{ display:inline-flex; align-items:center; justify-content:center; border-radius:999px; padding:4px 7px; color:#fff; font-weight:900; text-transform:uppercase; font-size:10px; }
      .hha-groups-qa-panel .qa-status.pass{ background:#209153; }
      .hha-groups-qa-panel .qa-status.warn{ background:#de8b1c; }
      .hha-groups-qa-panel .qa-status.fail{ background:#c73434; }
      .hha-groups-qa-panel .qa-label{ font-weight:900; }
      .hha-groups-qa-panel .qa-detail{ margin-top:3px; color:#7893a2; word-break:break-word; font-weight:700; }
      .hha-groups-qa-actions{ display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
      .hha-groups-qa-actions button{ border:0; border-radius:999px; padding:8px 11px; background:#eaf8ff; color:#214f64; font-weight:900; cursor:pointer; }
    `;

    document.head.appendChild(style);
  }

  let pill = null;
  let panel = null;

  function escapeHtml(s){
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensurePanel(){
    if (!qaEnabled) return;

    addStyle();

    if (!pill) {
      pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'hha-groups-qa-pill warn';
      pill.textContent = 'QA';
      document.body.appendChild(pill);

      pill.addEventListener('click', function(){
        if (!panel) ensurePanel();
        panel.classList.toggle('show');
        renderPanel();
      });
    }

    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'hha-groups-qa-panel';
      document.body.appendChild(panel);
    }
  }

  function renderPanel(){
    if (!qaEnabled || !panel) return;

    const report = state.latestReport || buildReport();

    if (pill) {
      pill.className = 'hha-groups-qa-pill ' + report.status;
      pill.textContent = report.status.toUpperCase() + ' P' + report.score.pass + ' W' + report.score.warn + ' F' + report.score.fail;
    }

    const rows = report.checks.map(c => {
      return `
        <div class="qa-row">
          <div><span class="qa-status ${c.status}">${c.status}</span></div>
          <div>
            <div class="qa-label">${escapeHtml(c.label)}</div>
            <div class="qa-detail">${escapeHtml(c.detail || '')}</div>
          </div>
        </div>
      `;
    }).join('');

    panel.innerHTML = `
      <h3>Groups Solo QA Gate</h3>
      <div class="qa-meta">${escapeHtml(report.patch)} • view=${escapeHtml(report.view)} • status=${escapeHtml(report.status)}</div>
      <div class="qa-meta">Pass ${report.score.pass} • Warn ${report.score.warn} • Fail ${report.score.fail}</div>
      ${rows}
      <div class="hha-groups-qa-actions">
        <button type="button" data-qa-action="rerun">Run QA Again</button>
        <button type="button" data-qa-action="copy">Copy JSON</button>
        <button type="button" data-qa-action="close">Close</button>
      </div>
    `;

    panel.querySelector('[data-qa-action="rerun"]').addEventListener('click', function(){
      buildReport();
      renderPanel();
    });

    panel.querySelector('[data-qa-action="copy"]').addEventListener('click', function(){
      const txt = JSON.stringify(state.latestReport || buildReport(), null, 2);

      try {
        navigator.clipboard.writeText(txt);
        this.textContent = 'Copied';
      } catch(e) {
        console.log('[Groups Solo QA]', state.latestReport || buildReport());
        this.textContent = 'Console';
      }

      setTimeout(() => { this.textContent = 'Copy JSON'; }, 1200);
    });

    panel.querySelector('[data-qa-action="close"]').addEventListener('click', function(){
      panel.classList.remove('show');
    });
  }

  function toast(message, type){
    try {
      window.dispatchEvent(new CustomEvent('hha:toast', {
        detail: { type: type || 'info', message: String(message || '') }
      }));
    } catch(e) {}
  }

  function bindErrorGuard(){
    if (window.__HHA_GROUPS_QA_ERROR_GUARD_BOUND__) return;
    window.__HHA_GROUPS_QA_ERROR_GUARD_BOUND__ = true;

    window.addEventListener('error', function(ev){
      const item = {
        type: 'error',
        message: String(ev.message || ''),
        source: String(ev.filename || ''),
        line: ev.lineno || 0,
        col: ev.colno || 0,
        at: new Date().toISOString()
      };

      state.errors.push(item);
      if (state.errors.length > 30) state.errors.splice(0, state.errors.length - 30);
      storageSetJSON('HHA_GROUPS_SOLO_LAST_ERROR', item);
      console.warn('[Groups Solo QA Guard] Non-blocking error captured:', item);

      if (qaEnabled) {
        buildReport();
        renderPanel();
      }
    }, true);

    window.addEventListener('unhandledrejection', function(ev){
      const reason = ev.reason;
      const item = {
        type: 'unhandledrejection',
        message: String(reason && (reason.message || reason) || ''),
        stack: String(reason && reason.stack || ''),
        at: new Date().toISOString()
      };

      state.errors.push(item);
      if (state.errors.length > 30) state.errors.splice(0, state.errors.length - 30);
      storageSetJSON('HHA_GROUPS_SOLO_LAST_REJECTION', item);
      console.warn('[Groups Solo QA Guard] Non-blocking promise rejection captured:', item);

      if (qaEnabled) {
        buildReport();
        renderPanel();
      }
    }, true);
  }

  function runQA(){
    const report = buildReport();

    if (qaEnabled) {
      ensurePanel();
      renderPanel();
    }

    console.info('[HeroHealth Groups Solo QA]', report);

    return report;
  }

  function installPublicApi(){
    window.HHA_GROUPS_SOLO_QA = {
      patch: PATCH_ID,
      run: runQA,
      report: function(){ return state.latestReport || buildReport(); },
      open: function(){
        ensurePanel();
        if (panel) panel.classList.add('show');
        renderPanel();
      },
      close: function(){
        if (panel) panel.classList.remove('show');
      }
    };
  }

  function boot(){
    bindErrorGuard();
    installPublicApi();

    setTimeout(runQA, 300);
    setTimeout(runQA, 1200);
    setTimeout(runQA, 2600);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_QA_TIMER__);
      window.__HHA_GROUPS_QA_TIMER__ = setTimeout(function(){
        const report = buildReport();

        if (qaEnabled) {
          ensurePanel();
          renderPanel();
        }

        if (report.status === 'fail') {
          toast('QA พบจุดที่ต้องตรวจใน Groups Solo', 'warn');
        }
      }, 300);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['href','class','style']
    });

    window.addEventListener('resize', function(){
      setTimeout(runQA, 220);
    }, {passive:true});

    window.addEventListener('orientationchange', function(){
      setTimeout(runQA, 500);
    }, {passive:true});

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      view: VIEW,
      qaEnabled
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }

})();
