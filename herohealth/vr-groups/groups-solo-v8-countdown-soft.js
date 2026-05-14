// === /herohealth/vr-groups/groups-solo-v8-countdown-soft.js ===
// HeroHealth Groups Solo — v8.3.2 Countdown Soft Bridge
// FIX: show countdown WITHOUT blocking the original Start button.
// สำคัญ: ไฟล์นี้ไม่ใช้ preventDefault / stopImmediatePropagation
// PATCH v20260513-GROUPS-SOLO-V832-COUNTDOWN-SOFT

(function () {
  'use strict';

  const VERSION = 'v8.3.2-countdown-soft-20260513';

  if (window.__HHA_GROUPS_SOLO_V832_COUNTDOWN_SOFT__) {
    console.warn('[GroupsSolo v8.3.2] already installed');
    return;
  }

  window.__HHA_GROUPS_SOLO_V832_COUNTDOWN_SOFT__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    started: false,
    counting: false,
    ended: false,
    lastClickAt: 0
  };

  function textOf(el) {
    return String(el ? (el.textContent || el.getAttribute?.('aria-label') || '') : '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  }

  function looksLikeSummary() {
    const tx = textOf(DOC.body);
    return (
      tx.includes('สรุปผลการเล่น') ||
      tx.includes('Hero Rank') ||
      tx.includes('Food Rookie') ||
      tx.includes('ความแม่นยำ') ||
      tx.includes('คอมโบสูงสุด')
    );
  }

  function findStartButton(target) {
    const btn = target?.closest?.(
      'button,a,[role="button"],.btn,.button,.start,.play,.start-btn,.play-btn,[data-start],[data-action]'
    );

    if (!btn || !isVisible(btn)) return null;

    const tx = textOf(btn).toLowerCase();
    const action = String(btn.getAttribute('data-action') || btn.getAttribute('data-start') || '').toLowerCase();

    const isStart =
      action.includes('start') ||
      action.includes('play') ||
      tx.includes('เริ่ม') ||
      tx.includes('เล่น') ||
      tx.includes('start') ||
      tx.includes('play');

    const isBack =
      tx.includes('กลับ') ||
      tx.includes('nutrition') ||
      tx.includes('zone') ||
      tx.includes('hub');

    return isStart && !isBack ? btn : null;
  }

  function injectStyle() {
    if (DOC.getElementById('hha-groups-v832-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-groups-v832-style';
    style.textContent = `
      body.hha-groups-v832-counting .hha-groups-v82-layer,
      body.hha-groups-v832-counting .hha-groups-v82-target,
      body.hha-groups-v832-counting [data-hha-v82-target="1"],
      body.hha-groups-v832-counting .hha-groups-v82-chip,
      body.hha-groups-v832-counting .hha-groups-v82-fx,
      body.hha-groups-v832-counting .hha-groups-v81-pop,
      body.hha-groups-v832-counting .hha-groups-v8-burst{
        display:none !important;
        opacity:0 !important;
        pointer-events:none !important;
        animation:none !important;
      }

      .hha-groups-v832-overlay{
        position:fixed;
        inset:0;
        z-index:2147483000;
        display:grid;
        place-items:center;
        pointer-events:none;
        background:
          radial-gradient(circle at 50% 42%, rgba(255,255,255,.88), rgba(255,255,255,.18) 48%, rgba(226,246,255,.16) 100%);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .hha-groups-v832-card{
        width:min(380px,84vw);
        border-radius:36px;
        padding:28px 22px;
        text-align:center;
        color:#244e68;
        background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(236,250,255,.94));
        border:3px solid rgba(255,255,255,.92);
        box-shadow:0 26px 76px rgba(35,81,107,.2);
      }

      .hha-groups-v832-main{
        font-size:clamp(64px,18vw,120px);
        line-height:.9;
        font-weight:1000;
        color:#5e9fc8;
        text-shadow:0 5px 0 rgba(255,255,255,.9);
        animation:hhaV832Pop .62s ease both;
      }

      .hha-groups-v832-title{
        margin-top:14px;
        font-size:clamp(19px,4.8vw,30px);
        line-height:1.12;
        font-weight:1000;
      }

      .hha-groups-v832-tip{
        margin-top:8px;
        font-size:clamp(13px,3.2vw,18px);
        line-height:1.25;
        font-weight:850;
        opacity:.82;
      }

      @keyframes hhaV832Pop{
        0%{opacity:0; transform:scale(.72);}
        24%{opacity:1; transform:scale(1.14);}
        100%{opacity:1; transform:scale(1);}
      }
    `;

    DOC.head.appendChild(style);
  }

  function setSpawnEnabled(v) {
    try {
      if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.setEnabled === 'function') {
        WIN.HHA_GROUPS_V82.setEnabled(Boolean(v));
      }
    } catch (e) {}
  }

  function killBonusTargets() {
    DOC.querySelectorAll(
      '.hha-groups-v82-target,[data-hha-v82-target="1"],.hha-groups-v82-fx,.hha-groups-v81-pop,.hha-groups-v8-burst'
    ).forEach(function (el) {
      try {
        clearTimeout(el.__hhaV82Timeout);
        el.remove();
      } catch (e) {}
    });

    try {
      if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.killAllTargets === 'function') {
        WIN.HHA_GROUPS_V82.killAllTargets();
      }
    } catch (e) {}
  }

  function showCountdown() {
    if (state.counting || state.ended || looksLikeSummary()) return;

    state.counting = true;
    state.started = true;

    injectStyle();

    DOC.body.classList.add('hha-groups-v832-counting');

    /*
      ปิดเฉพาะ bonus spawn layer ระหว่างนับถอยหลัง
      แต่ไม่บล็อก core start ของเกม
    */
    setSpawnEnabled(false);
    killBonusTargets();

    const old = DOC.getElementById('hha-groups-v832-overlay');
    if (old) old.remove();

    const overlay = DOC.createElement('div');
    overlay.id = 'hha-groups-v832-overlay';
    overlay.className = 'hha-groups-v832-overlay';
    overlay.innerHTML = `
      <div class="hha-groups-v832-card">
        <div class="hha-groups-v832-main" data-v832-main>3</div>
        <div class="hha-groups-v832-title">เตรียมแยกหมู่อาหาร!</div>
        <div class="hha-groups-v832-tip" data-v832-tip>ดูโจทย์ก่อน แล้วค่อยแตะอาหารที่ถูกต้อง</div>
      </div>
    `;

    DOC.body.appendChild(overlay);

    const main = overlay.querySelector('[data-v832-main]');
    const tip = overlay.querySelector('[data-v832-tip]');

    const steps = [
      { at: 0, text: '3', tip: 'ดูโจทย์ก่อน' },
      { at: 820, text: '2', tip: 'เก็บอาหารหมู่ที่กำหนด' },
      { at: 1640, text: '1', tip: 'หลบตัวหลอก เช่น 🍩 🥤 🍬' },
      { at: 2460, text: 'เริ่ม!', tip: 'ลุยเลย!' }
    ];

    steps.forEach(function (s) {
      setTimeout(function () {
        if (!overlay.isConnected) return;

        main.textContent = s.text;
        tip.textContent = s.tip;

        main.style.animation = 'none';
        void main.offsetWidth;
        main.style.animation = 'hhaV832Pop .62s ease both';
      }, s.at);
    });

    setTimeout(function () {
      if (overlay.isConnected) overlay.remove();

      DOC.body.classList.remove('hha-groups-v832-counting');

      state.counting = false;

      setSpawnEnabled(true);

      try {
        if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.start === 'function') {
          WIN.HHA_GROUPS_V82.start();
        }
      } catch (e) {}

      try {
        WIN.dispatchEvent(new CustomEvent('groups:v832:countdown-done', {
          detail: { version: VERSION }
        }));
        WIN.dispatchEvent(new CustomEvent('groups:v831:countdown-done', {
          detail: { version: VERSION, alias: true }
        }));
      } catch (e) {}

      console.info('[GroupsSolo v8.3.2] countdown done');
    }, 3250);
  }

  function onClick(ev) {
    if (state.ended || state.counting || looksLikeSummary()) return;

    const now = Date.now();
    if (now - state.lastClickAt < 800) return;

    const btn = findStartButton(ev.target);
    if (!btn) return;

    state.lastClickAt = now;

    /*
      สำคัญ:
      ไม่ preventDefault
      ไม่ stopPropagation
      ให้ปุ่ม Start ของเกมทำงานตามปกติ
      เราแค่โชว์ countdown ครอบไว้เฉย ๆ
    */
    showCountdown();
  }

  function installHooks() {
    DOC.addEventListener('click', onClick, true);

    [
      'groups:end',
      'hha:end',
      'game:end',
      'groups:summary',
      'hha:summary',
      'groups:v82:end',
      'groups:v83:end',
      'groups:v87:summary-ready'
    ].forEach(function (name) {
      WIN.addEventListener(name, function () {
        state.ended = true;
        state.counting = false;

        const overlay = DOC.getElementById('hha-groups-v832-overlay');
        if (overlay) overlay.remove();

        DOC.body.classList.remove('hha-groups-v832-counting');
      });
    });
  }

  function publicApi() {
    WIN.HHA_GROUPS_V832_COUNTDOWN_SOFT = {
      version: VERSION,
      show: showCountdown,
      getState: function () {
        return {
          version: VERSION,
          started: state.started,
          counting: state.counting,
          ended: state.ended
        };
      }
    };
  }

  function init() {
    injectStyle();
    installHooks();
    publicApi();

    console.info('[GroupsSolo v8.3.2] countdown soft installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
