// === /herohealth/vr-goodjunk/goodjunk-mobile-powerups-active-final-patch.js ===
// PATCH v20260603-v848b
// Purpose: stable mobile powerup tray and active state UI.

(function () {
  'use strict';

  const PATCH = 'GJ_MOBILE_POWERUPS_ACTIVE_V848B';

  function isGoodJunk() {
    return /goodjunk|good-junk/i.test(location.pathname + ' ' + document.title);
  }

  if (!isGoodJunk()) return;

  const state = {
    shield: false,
    magnet: false,
    slow: false,
    combo: false,
    lastToast: 0
  };

  const labels = {
    shield: { icon: '🛡️', name: 'Shield', tip: 'กัน junk' },
    magnet: { icon: '🧲', name: 'Magnet', tip: 'ดูดของดี' },
    slow: { icon: '🐢', name: 'Slow', tip: 'ชะลอเป้า' },
    combo: { icon: '⚡', name: 'Combo', tip: 'คอมโบแรง' }
  };

  function injectStyle() {
    if (document.getElementById('gjPowerupsActiveV848bStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjPowerupsActiveV848bStyle';
    style.textContent = `
      .gjpu-root{
        position:fixed;
        right:calc(10px + env(safe-area-inset-right,0px));
        top:calc(74px + env(safe-area-inset-top,0px));
        z-index:100025;
        display:grid;
        gap:8px;
        width:116px;
        pointer-events:none;
      }

      .gjpu-card{
        display:grid;
        grid-template-columns:34px 1fr;
        gap:7px;
        align-items:center;
        min-height:48px;
        border-radius:18px;
        padding:7px;
        background:rgba(255,255,255,.82);
        border:2px solid rgba(255,255,255,.94);
        box-shadow:0 12px 26px rgba(15,23,42,.15);
        backdrop-filter:blur(9px);
        opacity:.62;
        transform:scale(.96);
        transition:opacity .16s ease, transform .16s ease, box-shadow .16s ease;
        pointer-events:auto;
        touch-action:manipulation;
      }

      .gjpu-card.on{
        opacity:1;
        transform:scale(1);
        box-shadow:0 16px 34px rgba(34,197,94,.26);
      }

      .gjpu-card.ready{
        opacity:.92;
        box-shadow:0 16px 34px rgba(37,99,235,.22);
      }

      .gjpu-card .ico{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        border-radius:13px;
        background:linear-gradient(180deg,#f8fafc,#e0f2fe);
        font-size:20px;
        line-height:1;
      }

      .gjpu-card b{
        display:block;
        color:#0f172a;
        font-size:11px;
        line-height:1.05;
        font-weight:1000;
      }

      .gjpu-card span{
        display:block;
        margin-top:2px;
        color:#64748b;
        font-size:9px;
        line-height:1.05;
        font-weight:900;
      }

      .gjpu-toast{
        position:fixed;
        left:50%;
        bottom:calc(82px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%) translateY(8px);
        z-index:100050;
        width:min(390px,calc(100vw - 26px));
        border-radius:999px;
        padding:10px 14px;
        background:rgba(15,23,42,.9);
        color:#fff;
        text-align:center;
        font:900 13px/1.25 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 16px 34px rgba(15,23,42,.28);
        opacity:0;
        pointer-events:none;
        transition:opacity .16s ease, transform .16s ease;
      }

      .gjpu-toast.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }

      @media (max-width:720px){
        .gjpu-root{
          top:auto !important;
          right:calc(8px + env(safe-area-inset-right,0px)) !important;
          bottom:calc(8px + env(safe-area-inset-bottom,0px)) !important;
          width:auto !important;
          max-width:calc(100vw - 150px) !important;
          display:flex !important;
          flex-direction:row !important;
          gap:5px !important;
        }

        .gjpu-card{
          width:44px !important;
          min-height:44px !important;
          grid-template-columns:1fr !important;
          padding:5px !important;
          border-radius:15px !important;
        }

        .gjpu-card .ico{
          width:32px !important;
          height:32px !important;
          border-radius:12px !important;
          font-size:20px !important;
          margin:auto !important;
        }

        .gjpu-card b,
        .gjpu-card span{
          display:none !important;
        }
      }

      @media (max-width:420px){
        .gjpu-root{
          max-width:calc(100vw - 126px) !important;
          gap:4px !important;
        }

        .gjpu-card{
          width:39px !important;
          min-height:39px !important;
        }

        .gjpu-card .ico{
          width:29px !important;
          height:29px !important;
          font-size:18px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureRoot() {
    let root = document.getElementById('gjPowerupsRoot');
    if (root) return root;

    root = document.createElement('div');
    root.id = 'gjPowerupsRoot';
    root.className = 'gjpu-root';
    root.setAttribute('aria-label', 'GoodJunk powerups');

    Object.keys(labels).forEach(function (key) {
      const info = labels[key];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'gjpu-card';
      card.dataset.powerup = key;
      card.dataset.ready = '0';
      card.dataset.active = '0';
      card.innerHTML =
        '<i class="ico">' + info.icon + '</i>' +
        '<div><b>' + info.name + '</b><span>' + info.tip + '</span></div>';

      root.appendChild(card);
    });

    document.body.appendChild(root);
    return root;
  }

  function toast(msg) {
    const now = Date.now();
    if (now - state.lastToast < 650) return;
    state.lastToast = now;

    let box = document.getElementById('gjPowerupsToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'gjPowerupsToast';
      box.className = 'gjpu-toast';
      document.body.appendChild(box);
    }

    box.textContent = msg;
    box.classList.add('show');

    setTimeout(function () {
      box.classList.remove('show');
    }, 1400);
  }

  function setReady(type, ready) {
    const root = ensureRoot();
    const card = root.querySelector('[data-powerup="' + type + '"]');
    if (!card) return;

    card.dataset.ready = ready ? '1' : '0';
    card.classList.toggle('ready', !!ready);
  }

  function setActive(type, active, ms) {
    if (!labels[type]) return;

    state[type] = !!active;

    const root = ensureRoot();
    const card = root.querySelector('[data-powerup="' + type + '"]');
    if (!card) return;

    card.dataset.active = active ? '1' : '0';
    card.classList.toggle('on', !!active);

    if (active) {
      card.classList.remove('ready');
      card.dataset.ready = '0';
      toast(labels[type].icon + ' ใช้ ' + labels[type].name + ' แล้ว');

      if (ms && Number(ms) > 0) {
        setTimeout(function () {
          setActive(type, false);
        }, Number(ms));
      }
    }
  }

  function installEvents() {
    window.addEventListener('goodjunk:powerup-earned', function (ev) {
      const type = String(ev.detail && ev.detail.type || '').toLowerCase();
      if (!labels[type]) return;
      setReady(type, true);
      toast(labels[type].icon + ' ได้รับ ' + labels[type].name);
    });

    window.addEventListener('goodjunk:powerup-active', function (ev) {
      const type = String(ev.detail && ev.detail.type || '').toLowerCase();
      const ms = Number(ev.detail && ev.detail.ms || ev.detail && ev.detail.duration || 0);
      if (!labels[type]) return;
      setActive(type, true, ms || 5000);
    });

    window.addEventListener('goodjunk:powerup-end', function (ev) {
      const type = String(ev.detail && ev.detail.type || '').toLowerCase();
      if (!labels[type]) return;
      setActive(type, false);
    });
  }

  function install() {
    injectStyle();
    ensureRoot();
    installEvents();

    window.GJ_POWERUPS_ACTIVE_UI = {
      version: '20260603-v848b',
      state,
      setReady,
      setActive,
      toast
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
