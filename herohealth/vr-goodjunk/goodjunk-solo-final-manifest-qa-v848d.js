// === /herohealth/vr-goodjunk/goodjunk-solo-final-manifest-qa-v848d.js ===
// PATCH v20260604-v848d
// Purpose:
// 1) Lock current GoodJunk Solo Boss Mobile manifest
// 2) Detect duplicate final-freeze / missing patches
// 3) Verify launcher / cooldown / summary hooks
// 4) Save QA status to localStorage
// 5) Does NOT modify score/gameplay logic

(function () {
  'use strict';

  const PATCH = 'GJ_SOLO_FINAL_MANIFEST_QA_V848D';
  const VERSION = '20260604-v848d';

  function isGoodJunk() {
    return /goodjunk|good-junk/i.test(location.pathname + ' ' + document.title);
  }

  if (!isGoodJunk()) return;

  const REQUIRED = [
    'goodjunk-solo-boss-ultimate.js',
    'goodjunk-solo-boss-drama.js',
    'goodjunk-solo-boss-juice.js',
    'goodjunk-solo-boss-reward.js',
    'goodjunk-solo-boss-reward-polish.js',
    'goodjunk-solo-boss-director.js',
    'goodjunk-solo-boss-shim.js',
    'goodjunk-solo-boss-merge.js',
    'goodjunk-solo-boss-foodbank.js',
    'goodjunk-solo-boss-visual-variety.js',
    'goodjunk-solo-boss-main.js',
    'goodjunk-solo-boss-mobile-polish.js',
    'goodjunk-solo-boss-touch-comfort.js',
    'goodjunk-solo-boss-powerups.js',
    'goodjunk-solo-boss-guard.js',
    'goodjunk-solo-boss-version-health.js',

    'goodjunk-solo-boss-mobile-target-compact-patch.js',
    'goodjunk-solo-boss-final-polish-patch.js',
    'goodjunk-mobile-cooldown-return-launcher-final-patch.js',
    'goodjunk-mobile-powerups-active-final-patch.js',
    'goodjunk-mobile-powerups-click-active-final-patch.js',
    'goodjunk-mobile-powerups-earned-final-patch.js',
    'goodjunk-mobile-powerups-effect-lock-final.js',
    'goodjunk-mobile-powerups-hitbox-unblock-final.js',
    'goodjunk-mobile-start-button-bridge-final.js',
    'goodjunk-mobile-target-tight-v848c.js',
    'goodjunk-solo-v848-final-freeze.js'
  ];

  const SHOULD_NOT_DUPLICATE = [
    'goodjunk-solo-v848-final-freeze.js',
    'goodjunk-mobile-start-button-bridge-final.js',
    'goodjunk-mobile-target-tight-v848c.js',
    'goodjunk-mobile-cooldown-return-launcher-final-patch.js'
  ];

  const EXPECTED = {
    launcher: 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html',
    nutritionZone: 'https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html',
    hub: 'https://supparang.github.io/webxr-health-mobile/herohealth/hub-v2.html',
    cooldownGate: 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html'
  };

  const state = {
    installed: false,
    lastReport: null,
    lastToast: 0
  };

  function getScripts() {
    return Array.prototype.slice.call(document.querySelectorAll('script[src]')).map(function (s) {
      return {
        src: s.getAttribute('src') || '',
        full: s.src || ''
      };
    });
  }

  function basename(src) {
    try {
      const u = new URL(src, location.href);
      return u.pathname.split('/').pop();
    } catch (_) {
      return String(src || '').split('?')[0].split('/').pop();
    }
  }

  function countScript(name) {
    return getScripts().filter(function (s) {
      return basename(s.src) === name || basename(s.full) === name;
    }).length;
  }

  function hasScript(name) {
    return countScript(name) > 0;
  }

  function shell() {
    return window.GJ_SOLO_BOSS_SHELL || null;
  }

  function getLauncherFromShell() {
    try {
      if (shell() && typeof shell().buildGoodJunkLauncherUrl === 'function') {
        return shell().buildGoodJunkLauncherUrl();
      }
    } catch (_) {}
    return '';
  }

  function getCooldownFromShell() {
    try {
      if (shell() && typeof shell().buildCooldownUrl === 'function') {
        return shell().buildCooldownUrl({ reason: 'qa-preview' });
      }
    } catch (_) {}
    return '';
  }

  function isSummaryVisible() {
    const selectors = [
      '#summary',
      '#summaryScreen',
      '#result',
      '#resultScreen',
      '#gjRewardSummary',
      '#gjrSummary',
      '.summary',
      '.summary-screen',
      '.result',
      '.result-screen',
      '.gjr-root',
      '.gj-reward-summary',
      '[data-summary]',
      '[data-screen="summary"]'
    ];

    return selectors.some(function (sel) {
      return Array.prototype.slice.call(document.querySelectorAll(sel)).some(function (el) {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        return (
          cs.display !== 'none' &&
          cs.visibility !== 'hidden' &&
          Number(cs.opacity || 1) > 0.05 &&
          rect.width > 80 &&
          rect.height > 60
        );
      });
    });
  }

  function targetSizeSnapshot() {
    const target = document.querySelector(
      '.gjpu-item,.gj-target,.target,.food,.junk,[data-target],[data-food],[data-junk],[data-kind]'
    );

    if (!target) {
      return {
        found: false,
        width: 0,
        height: 0,
        note: 'ยังไม่พบเป้าในจอ'
      };
    }

    const r = target.getBoundingClientRect();

    return {
      found: true,
      width: Math.round(r.width),
      height: Math.round(r.height),
      note: r.width <= 76 ? 'ขนาดเป้าเหมาะกับ mobile' : 'เป้าอาจยังใหญ่ไป'
    };
  }

  function buildReport() {
    const missing = REQUIRED.filter(function (name) {
      return !hasScript(name);
    });

    const duplicates = SHOULD_NOT_DUPLICATE
      .map(function (name) {
        return {
          name: name,
          count: countScript(name)
        };
      })
      .filter(function (x) {
        return x.count > 1;
      });

    const launcher = getLauncherFromShell();
    const cooldown = getCooldownFromShell();
    const target = targetSizeSnapshot();

    const hasStartBridge = !!window.GJ_MOBILE_START_BRIDGE;
    const hasPowerupUI = !!window.GJ_POWERUPS_ACTIVE_UI;
    const hasCooldownPatch = !!window.GJ_MOBILE_COOLDOWN_RETURN;
    const hasFinalFreeze =
      !!window.GJ_FINAL_LAUNCHER_URL ||
      !!window.GJ_FINAL_COOLDOWN_URL ||
      document.documentElement.classList.contains('gj-v848-final-freeze-b');

    const launcherOk = launcher.indexOf(EXPECTED.launcher) === 0;
    const cooldownOk =
      cooldown.indexOf(EXPECTED.cooldownGate) === 0 &&
      decodeURIComponent(cooldown).indexOf(EXPECTED.launcher) >= 0;

    const report = {
      patch: PATCH,
      version: VERSION,
      page: location.pathname,
      checkedAt: new Date().toISOString(),

      status: 'UNKNOWN',

      missingScripts: missing,
      duplicateScripts: duplicates,

      hooks: {
        shell: !!shell(),
        startBridge: hasStartBridge,
        powerupUI: hasPowerupUI,
        cooldownPatch: hasCooldownPatch,
        finalFreeze: hasFinalFreeze
      },

      urls: {
        launcher: launcher,
        launcherOk: launcherOk,
        cooldownPreview: cooldown,
        cooldownOk: cooldownOk
      },

      ui: {
        summaryVisible: isSummaryVisible(),
        target: target
      }
    };

    const hardFail =
      missing.length > 0 ||
      duplicates.length > 0 ||
      !hasStartBridge ||
      !hasCooldownPatch ||
      !hasFinalFreeze ||
      !launcherOk ||
      !cooldownOk;

    report.status = hardFail ? 'NEEDS_FIX' : 'READY_FOR_MOBILE_QA';

    return report;
  }

  function saveReport(report) {
    state.lastReport = report;

    try {
      localStorage.setItem('GJ_SOLO_FINAL_MANIFEST_QA_LAST', JSON.stringify(report));
    } catch (_) {}
  }

  function toast(msg) {
    const now = Date.now();
    if (now - state.lastToast < 700) return;
    state.lastToast = now;

    let box = document.getElementById('gjManifestQaToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'gjManifestQaToast';
      box.style.cssText = [
        'position:fixed',
        'left:50%',
        'top:calc(54px + env(safe-area-inset-top,0px))',
        'transform:translateX(-50%)',
        'z-index:2147483647',
        'max-width:min(92vw,520px)',
        'border-radius:999px',
        'padding:9px 13px',
        'background:rgba(15,23,42,.9)',
        'color:white',
        'font:900 12px/1.25 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'text-align:center',
        'box-shadow:0 14px 34px rgba(15,23,42,.28)',
        'pointer-events:none',
        'opacity:0',
        'transition:opacity .16s ease, transform .16s ease'
      ].join(';');
      document.body.appendChild(box);
    }

    box.textContent = msg;
    box.style.opacity = '1';
    box.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(function () {
      box.style.opacity = '0';
      box.style.transform = 'translateX(-50%) translateY(-5px)';
    }, 1600);
  }

  function createBadge(report) {
    let badge = document.getElementById('gjManifestQaBadge');

    if (!badge) {
      badge = document.createElement('button');
      badge.id = 'gjManifestQaBadge';
      badge.type = 'button';
      badge.style.cssText = [
        'position:fixed',
        'right:calc(10px + env(safe-area-inset-right,0px))',
        'top:calc(42px + env(safe-area-inset-top,0px))',
        'z-index:2147482400',
        'border:1px solid rgba(255,255,255,.32)',
        'border-radius:999px',
        'padding:7px 9px',
        'font:1000 10px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'background:rgba(15,23,42,.72)',
        'color:#fff',
        'box-shadow:0 8px 18px rgba(15,23,42,.22)',
        'backdrop-filter:blur(8px)',
        'opacity:.8'
      ].join(';');

      badge.addEventListener('click', function () {
        const r = runQa(true);
        toast(r.status === 'READY_FOR_MOBILE_QA' ? 'QA พร้อมทดสอบ Mobile' : 'QA ยังมีจุดต้องแก้');
      });

      document.body.appendChild(badge);
    }

    badge.textContent = report.status === 'READY_FOR_MOBILE_QA'
      ? 'QA READY'
      : 'QA FIX';
  }

  function consoleReport(report) {
    try {
      console.group('[GoodJunk Solo Manifest QA] ' + report.status);
      console.log('Report:', report);

      if (report.missingScripts.length) {
        console.warn('Missing scripts:', report.missingScripts);
      }

      if (report.duplicateScripts.length) {
        console.warn('Duplicate scripts:', report.duplicateScripts);
      }

      console.table(report.hooks);
      console.table(report.urls);
      console.table(report.ui.target);
      console.groupEnd();
    } catch (_) {}
  }

  function runQa(showConsole) {
    const report = buildReport();
    saveReport(report);
    createBadge(report);

    if (showConsole) {
      consoleReport(report);
    }

    return report;
  }

  function install() {
    if (state.installed) return;
    state.installed = true;

    setTimeout(function () {
      const report = runQa(true);

      if (report.status === 'READY_FOR_MOBILE_QA') {
        toast('GoodJunk Solo: QA READY');
      } else {
        toast('GoodJunk Solo: ยังมีจุดต้องแก้');
      }
    }, 700);

    setInterval(function () {
      runQa(false);
    }, 3000);

    window.GJ_SOLO_FINAL_QA = {
      version: VERSION,
      expected: EXPECTED,
      required: REQUIRED.slice(),
      run: function () {
        return runQa(true);
      },
      last: function () {
        return state.lastReport;
      }
    };

    try {
      console.log('[' + PATCH + '] installed');
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();