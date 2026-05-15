// === /herohealth/vr-groups/groups-pc-cue-polish-v17.js ===
// HeroHealth Groups PC — v1.7 Power / Decoy Cue Polish
// Purpose:
// - Add clear visual cue on falling items.
// - Power: "Click to collect"
// - Decoy: "Do not click"
// - Golden: "Select + gate"
// - Normal food: "Select + gate"
// Safe add-on: DOM visual coach only.
// PATCH v20260515-GROUPS-PC-V17-CUE-POLISH

(function () {
  'use strict';

  const VERSION = 'v1.7-pc-cue-polish-20260515';

  if (window.__HHA_GROUPS_PC_CUE_V17__) return;
  window.__HHA_GROUPS_PC_CUE_V17__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    observer: null,
    poll: null,
    lastHint: ''
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function api() {
    return WIN.HHA_GROUPS_PC_V1 || null;
  }

  function gs() {
    try {
      const a = api();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function injectStyle() {
    if ($('groups-pc-v17-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-pc-v17-style';
    style.textContent = `
      .fall-item{
        overflow:visible !important;
      }

      .pc-v17-item-cue{
        position:absolute;
        left:50%;
        bottom:-18px;
        transform:translateX(-50%);
        z-index:3;
        min-width:92px;
        max-width:150px;
        border-radius:999px;
        padding:4px 7px;
        background:rgba(255,255,255,.95);
        color:#244e68;
        box-shadow:0 8px 18px rgba(35,81,107,.16);
        font-size:10px;
        line-height:1;
        font-weight:1000;
        text-align:center;
        white-space:nowrap;
        pointer-events:none;
      }

      .fall-item.decoy .pc-v17-item-cue{
        background:#fff0f0;
        color:#9b3d3d;
      }

      .fall-item.golden .pc-v17-item-cue{
        background:#fff5ca;
        color:#806000;
      }

      .fall-item.power .pc-v17-item-cue{
        background:#e6f8ff;
        color:#245c78;
      }

      .fall-item.power{
        animation:pcv17PowerPulse .55s ease-in-out infinite alternate !important;
      }

      .fall-item.decoy{
        animation:pcv17DecoyWarn .34s ease-in-out infinite alternate !important;
      }

      .fall-item.golden{
        animation:pcv17GoldenPulse .55s ease-in-out infinite alternate !important;
      }

      @keyframes pcv17PowerPulse{
        from{box-shadow:0 0 0 8px rgba(97,187,255,.14),0 18px 44px rgba(35,81,107,.18);}
        to{box-shadow:0 0 0 18px rgba(97,187,255,.24),0 24px 62px rgba(35,81,107,.23);}
      }

      @keyframes pcv17DecoyWarn{
        from{filter:brightness(1); transform:scale(1);}
        to{filter:brightness(1.08); transform:scale(1.06);}
      }

      @keyframes pcv17GoldenPulse{
        from{box-shadow:0 0 0 8px rgba(255,217,102,.15),0 18px 44px rgba(35,81,107,.18);}
        to{box-shadow:0 0 0 18px rgba(255,217,102,.26),0 24px 62px rgba(35,81,107,.23);}
      }

      .pc-v17-coachbar{
        position:absolute;
        left:50%;
        bottom:132px;
        transform:translateX(-50%);
        z-index:92;
        width:min(720px,calc(100vw - 40px));
        border-radius:999px;
        padding:10px 15px;
        background:rgba(255,255,255,.92);
        box-shadow:0 16px 42px rgba(35,81,107,.16);
        color:#244e68;
        font-size:clamp(15px,1.6vw,22px);
        line-height:1.12;
        font-weight:1000;
        text-align:center;
        pointer-events:none;
      }

      body.pc-v17-decoy .pc-v17-coachbar{
        background:#fff0f0;
        color:#9b3d3d;
      }

      body.pc-v17-power .pc-v17-coachbar{
        background:#e6f8ff;
        color:#245c78;
      }

      body.pc-v17-golden .pc-v17-coachbar{
        background:#fff5ca;
        color:#806000;
      }

      body.pc-v17-food .pc-v17-coachbar{
        background:#f5fff1;
        color:#31724b;
      }

      @media (max-height:760px){
        .pc-v17-coachbar{
          bottom:108px;
          font-size:14px;
          padding:8px 12px;
        }

        .pc-v17-item-cue{
          font-size:9px;
          bottom:-15px;
          min-width:82px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureCoachBar() {
    const game = $('game');
    if (!game || $('pcv17Coachbar')) return;

    const bar = DOC.createElement('div');
    bar.id = 'pcv17Coachbar';
    bar.className = 'pc-v17-coachbar';
    bar.textContent = 'คลิกอาหารก่อน แล้วคลิกประตู หรือกดเลข 1–5';
    game.appendChild(bar);
  }

  function itemCueText(el) {
    if (!el) return 'Select';

    if (el.classList.contains('power')) return 'Click to collect';
    if (el.classList.contains('decoy')) return 'Do not click!';
    if (el.classList.contains('golden')) return 'Select + gate';

    return 'Select + gate';
  }

  function applyCueToItem(el) {
    if (!el || !el.classList || !el.classList.contains('fall-item')) return;

    let cue = el.querySelector('.pc-v17-item-cue');
    if (!cue) {
      cue = DOC.createElement('span');
      cue.className = 'pc-v17-item-cue';
      el.appendChild(cue);
    }

    cue.textContent = itemCueText(el);
  }

  function applyAllCues() {
    DOC.querySelectorAll('.fall-item').forEach(applyCueToItem);
  }

  function nearestUrgentItem() {
    const items = Array.from(DOC.querySelectorAll('.fall-item'));
    if (!items.length) return null;

    return items
      .map(el => {
        const r = el.getBoundingClientRect();
        return { el, bottom: r.bottom, top: r.top };
      })
      .sort((a, b) => b.bottom - a.bottom)[0].el;
  }

  function kindFromEl(el) {
    if (!el) return 'none';
    if (el.classList.contains('power')) return 'power';
    if (el.classList.contains('decoy')) return 'decoy';
    if (el.classList.contains('golden')) return 'golden';
    return 'food';
  }

  function coachText(kind) {
    if (kind === 'power') return '🛡️/⏱️ Power-up: คลิกที่ตัวพลังได้เลย';
    if (kind === 'decoy') return '🚫 ตัวหลอก: ห้ามคลิก ปล่อยให้ผ่านไป';
    if (kind === 'golden') return '⭐ Golden: คลิกเลือก แล้วส่งเข้าประตูหมู่ที่ถูก';
    if (kind === 'food') return '🍎 อาหารปกติ: คลิกเลือก แล้วคลิกประตู หรือกดเลข 1–5';
    return 'คลิกอาหารก่อน แล้วคลิกประตู หรือกดเลข 1–5';
  }

  function setBodyKind(kind) {
    DOC.body.classList.remove(
      'pc-v17-food',
      'pc-v17-golden',
      'pc-v17-power',
      'pc-v17-decoy'
    );

    if (kind && kind !== 'none') {
      DOC.body.classList.add(`pc-v17-${kind}`);
    }
  }

  function updateCoachBar() {
    const s = gs();

    if (!s || s.mode !== 'game' || s.ended) {
      setBodyKind('');
      return;
    }

    ensureCoachBar();

    const bar = $('pcv17Coachbar');
    if (!bar) return;

    const selected = DOC.querySelector('.fall-item.selected');
    const urgent = selected || nearestUrgentItem();
    const kind = kindFromEl(urgent);
    const text = coachText(kind);

    setBodyKind(kind);

    if (text !== state.lastHint) {
      state.lastHint = text;
      bar.textContent = text;
    }
  }

  function improveSelectedPanel() {
    const s = gs();
    if (!s || s.mode !== 'game' || s.ended) return;

    const prompt = $('promptText');
    if (!prompt) return;

    const selected = DOC.querySelector('.fall-item.selected');
    if (!selected) return;

    const kind = kindFromEl(selected);

    if (kind === 'golden') {
      prompt.innerHTML = `
        ⭐ Golden Food ถูกต้องต้องเลือกหมู่ให้ถูก
        <small>คลิกประตูด้านล่าง หรือกดเลข 1–5</small>
      `;
    }

    if (kind === 'food') {
      prompt.innerHTML = `
        ส่งอาหารที่เลือกเข้าหมู่ที่ถูก
        <small>ใช้คีย์บอร์ดเลข 1–5 จะเร็วกว่า</small>
      `;
    }
  }

  function installObserver() {
    const stage = $('stage');
    if (!stage || state.observer) return;

    state.observer = new MutationObserver(() => {
      applyAllCues();
      updateCoachBar();
    });

    state.observer.observe(stage, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function expose() {
    WIN.HHA_GROUPS_PC_V17_CUE_POLISH = {
      version: VERSION,
      applyAllCues,
      getState: function () {
        return {
          version: VERSION,
          lastHint: state.lastHint,
          items: DOC.querySelectorAll('.fall-item').length
        };
      }
    };
  }

  function install() {
    injectStyle();
    ensureCoachBar();
    installObserver();
    applyAllCues();

    state.poll = setInterval(() => {
      applyAllCues();
      updateCoachBar();
      improveSelectedPanel();
    }, 240);

    expose();

    console.info('[Groups PC v1.7] cue polish installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
