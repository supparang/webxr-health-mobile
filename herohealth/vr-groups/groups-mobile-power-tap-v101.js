// === /herohealth/vr-groups/groups-mobile-power-tap-v101.js ===
// HeroHealth Groups Mobile — v10.1 Power Tap Fix
// Purpose:
// - Make mobile power-up collection intuitive.
// - Player can tap the falling 🛡️ Shield / ⏱️ Slow Time directly.
// - Internally forwards the tap to a gate click, because v9.6 core collects power through gate selection.
// PATCH v20260515-GROUPS-MOBILE-V101-POWER-TAP

(function () {
  'use strict';

  const VERSION = 'v10.1-mobile-power-tap-fix-20260515';

  if (window.__HHA_GROUPS_MOBILE_POWER_TAP_V101__) {
    return;
  }

  window.__HHA_GROUPS_MOBILE_POWER_TAP_V101__ = true;

  const DOC = document;
  const WIN = window;

  function $(id) {
    return DOC.getElementById(id);
  }

  function api() {
    return WIN.HHA_GROUPS_MOBILE_V9 || null;
  }

  function getState() {
    try {
      const a = api();
      if (a && typeof a.getState === 'function') {
        return a.getState() || {};
      }
    } catch (e) {}

    return {};
  }

  function currentItem() {
    const s = getState();
    return s && s.current ? s.current : null;
  }

  function injectStyle() {
    if ($('groups-mobile-v101-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-mobile-v101-style';
    style.textContent = `
      .food.power{
        cursor:pointer;
        pointer-events:auto;
        animation:
          floatFood 1.1s ease-in-out infinite alternate,
          v101PowerGlow .55s ease-in-out infinite alternate !important;
      }

      @keyframes v101PowerGlow{
        from{
          box-shadow:
            0 0 0 8px rgba(97,187,255,.14),
            0 22px 52px rgba(35,81,107,.20);
          transform:scale(1);
        }
        to{
          box-shadow:
            0 0 0 16px rgba(97,187,255,.22),
            0 26px 64px rgba(35,81,107,.24);
          transform:scale(1.05);
        }
      }

      .v101-power-tip{
        position:absolute;
        left:50%;
        top:42%;
        transform:translate(-50%,-50%);
        z-index:95;
        width:min(78vw,360px);
        border-radius:999px;
        padding:10px 14px;
        text-align:center;
        background:rgba(255,255,255,.94);
        color:#245c78;
        box-shadow:0 18px 48px rgba(35,81,107,.18);
        font-size:clamp(18px,5vw,28px);
        line-height:1.12;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
      }

      .v101-power-tip.show{
        animation:v101Tip .75s ease both;
      }

      @keyframes v101Tip{
        0%{ opacity:0; transform:translate(-50%,-35%) scale(.84); }
        20%{ opacity:1; transform:translate(-50%,-50%) scale(1.06); }
        74%{ opacity:1; transform:translate(-50%,-54%) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-70%) scale(.94); }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureTip() {
    const game = $('game');
    if (!game || $('v101PowerTip')) return;

    const tip = DOC.createElement('div');
    tip.id = 'v101PowerTip';
    tip.className = 'v101-power-tip';
    tip.textContent = 'เก็บ Power!';
    game.appendChild(tip);
  }

  function tip(text) {
    ensureTip();

    const el = $('v101PowerTip');
    if (!el) return;

    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  }

  function tapAnyGateToCollectPower() {
    const gate =
      DOC.querySelector('.gate.veg') ||
      DOC.querySelector('.gate[data-id="3"]') ||
      DOC.querySelector('.gate');

    if (!gate) {
      tip('ยังไม่พบประตู');
      return false;
    }

    gate.click();
    return true;
  }

  function onFoodTap(ev) {
    const item = currentItem();

    if (!item) return;

    /*
      Only power-up should be collected by directly tapping the falling item.
      Normal food still requires choosing the correct group gate.
      Decoy should still be avoided.
    */
    if (item.kind === 'power') {
      ev.preventDefault();
      ev.stopPropagation();

      const ok = tapAnyGateToCollectPower();

      if (ok) {
        const label = item.power === 'shield'
          ? '🛡️ เก็บ Shield แล้ว!'
          : item.power === 'slow'
            ? '⏱️ เก็บ Slow Time แล้ว!'
            : 'เก็บ Power แล้ว!';

        tip(label);
        vibrate([25, 15, 25]);
      }

      return;
    }

    if (item.kind === 'decoy') {
      tip('🚫 ตัวหลอก อย่าแตะ!');
      vibrate(18);
      return;
    }

    if (item.kind === 'golden') {
      tip('⭐ Golden ต้องแตะประตูหมู่ที่ถูก');
      return;
    }

    tip('แตะประตูหมู่ที่ถูกด้านล่าง');
  }

  function improvePrompt() {
    const item = currentItem();
    const prompt = $('prompt');

    if (!item || !prompt) return;

    if (item.kind === 'power') {
      const label = item.power === 'shield'
        ? 'Shield'
        : item.power === 'slow'
          ? 'Slow Time'
          : 'Power-up';

      prompt.classList.add('power-prompt');
      prompt.innerHTML = `
        <div>
          Power-up ${item.icon} ${label}
          <small>แตะที่ ${item.icon} โดยตรง หรือแตะประตูใดก็ได้เพื่อเก็บพลัง</small>
        </div>
      `;
    }
  }

  function install() {
    injectStyle();
    ensureTip();

    const food = $('food');

    if (food && !food.__v101PowerTap) {
      food.__v101PowerTap = true;

      food.addEventListener('pointerdown', onFoodTap, {
        passive: false
      });

      food.addEventListener('click', onFoodTap, {
        passive: false
      });
    }

    setInterval(improvePrompt, 180);

    WIN.HHA_GROUPS_MOBILE_POWER_TAP_V101 = {
      version: VERSION,
      currentItem,
      tapAnyGateToCollectPower
    };

    console.info('[Groups Mobile v10.1] power tap fix installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
