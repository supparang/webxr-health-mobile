// === /herohealth/vr-groups/groups-cvr-decoy-guard-v19d.js ===
// HeroHealth Groups cVR — v1.9d Decoy Runtime Guard
// Purpose:
// - Runtime safety guard against too many decoys.
// - If decoy appears too often, skip it softly.
// - Works as add-on with groups-cvr.html v1.9c+.
// - Does not change scoring directly.
// PATCH v20260515-GROUPS-CVR-V19D-DECOY-RUNTIME-GUARD

(function () {
  'use strict';

  const VERSION = 'v1.9d-cvr-decoy-runtime-guard-20260515';

  if (window.__HHA_GROUPS_CVR_DECOY_GUARD_V19D__) return;
  window.__HHA_GROUPS_CVR_DECOY_GUARD_V19D__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    seenSig: '',
    decoySeen: 0,
    decoySkipped: 0,
    recentKinds: [],
    lastSkipAt: 0,
    lastToastAt: 0,
    guardTimer: null
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function coreApi() {
    return WIN.HHA_GROUPS_CVR_V1 || null;
  }

  function gs() {
    try {
      const core = coreApi();
      if (core && typeof core.getState === 'function') return core.getState() || {};
    } catch (e) {}
    return {};
  }

  function isPlaying() {
    const s = gs();
    return s && s.mode === 'game' && !s.ended;
  }

  function currentItem() {
    const s = gs();
    return s && s.current ? s.current : null;
  }

  function duration() {
    const s = gs();
    return Number(s.duration || 90);
  }

  function remain() {
    const s = gs();
    const startedAt = Number(s.startedAt || 0);
    const dur = Number(s.duration || 90);

    if (!startedAt) return dur;

    return Math.max(0, dur - Math.floor((Date.now() - startedAt) / 1000));
  }

  function itemSig(item) {
    if (!item) return 'none';

    return [
      item.kind || '',
      item.icon || '',
      item.label || '',
      item.group && item.group.key || '',
      item.power || ''
    ].join('|');
  }

  function maxDecoys() {
    const d = duration();

    if (d <= 90) return 3;
    if (d <= 120) return 4;
    return 5;
  }

  function injectStyle() {
    if ($('groups-cvr-v19d-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v19d-style';
    style.textContent = `
      .cvr-v19d-toast{
        position:fixed;
        left:50%;
        top:calc(132px + env(safe-area-inset-top,0px));
        transform:translateX(-50%);
        z-index:2147483600;
        width:min(500px,calc(100vw - 28px));
        border-radius:999px;
        padding:8px 13px;
        text-align:center;
        background:rgba(245,255,241,.96);
        color:#31724b;
        box-shadow:0 18px 48px rgba(35,81,107,.16);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:clamp(14px,3.7vw,21px);
        line-height:1.15;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
      }

      .cvr-v19d-toast.show{
        animation:cvrV19dToast .85s ease both;
      }

      @keyframes cvrV19dToast{
        0%{opacity:0; transform:translateX(-50%) translateY(8px) scale(.96);}
        18%{opacity:1; transform:translateX(-50%) translateY(0) scale(1.02);}
        76%{opacity:1; transform:translateX(-50%) translateY(0) scale(1);}
        100%{opacity:0; transform:translateX(-50%) translateY(-10px) scale(.98);}
      }

      .cvr-v19d-qa{
        position:fixed;
        left:8px;
        bottom:calc(92px + env(safe-area-inset-bottom,0px));
        z-index:2147483500;
        display:none;
        max-width:300px;
        border-radius:16px;
        padding:8px 10px;
        background:rgba(49,114,75,.92);
        color:#fff;
        font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        white-space:pre-wrap;
        pointer-events:none;
      }

      body.cvr-v19d-qa-on .cvr-v19d-qa{
        display:block;
      }
    `;
    DOC.head.appendChild(style);
  }

  function ensureUi() {
    if (!$('cvrV19dToast')) {
      const el = DOC.createElement('div');
      el.id = 'cvrV19dToast';
      el.className = 'cvr-v19d-toast';
      DOC.body.appendChild(el);
    }

    if (!$('cvrV19dQa')) {
      const el = DOC.createElement('div');
      el.id = 'cvrV19dQa';
      el.className = 'cvr-v19d-qa';
      DOC.body.appendChild(el);
    }
  }

  function toast(text) {
    if (Date.now() - state.lastToastAt < 900) return;
    state.lastToastAt = Date.now();

    const el = $('cvrV19dToast');
    if (!el) return;

    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function recentDecoyCount() {
    return state.recentKinds.filter(k => k === 'decoy').length;
  }

  function shouldSkipDecoy() {
    const cap = maxDecoys();
    const r = remain();

    if (state.decoySeen > cap) return true;
    if (recentDecoyCount() >= 1) return true;
    if (r <= 25) return true;

    return false;
  }

  function forceNextNonDecoy() {
    const core = coreApi();
    if (!core) return false;

    if (Date.now() - state.lastSkipAt < 650) return false;
    state.lastSkipAt = Date.now();

    /*
      Best effort:
      call forceSpawn a few times until random gives non-decoy.
      v1.9c chooseItem() should already make this unlikely to repeat.
    */
    let tries = 0;

    function step() {
      if (!isPlaying()) return;

      const item = currentItem();

      if (item && item.kind !== 'decoy') return;

      tries += 1;

      try {
        if (typeof core.forceSpawn === 'function') {
          core.forceSpawn();
        } else if (typeof core.recoverArena === 'function') {
          core.recoverArena('v19d-decoy-skip');
        }
      } catch (e) {}

      if (tries < 4) {
        setTimeout(step, 120);
      }
    }

    step();

    state.decoySkipped += 1;
    toast('พักตัวหลอกก่อน • กลับมาเล่นอาหารจริง');

    return true;
  }

  function guard() {
    if (!isPlaying()) return;

    const item = currentItem();
    const sig = itemSig(item);

    if (sig !== state.seenSig) {
      state.seenSig = sig;

      if (item && item.kind) {
        state.recentKinds = state.recentKinds.concat(item.kind).slice(-6);

        if (item.kind === 'decoy') {
          state.decoySeen += 1;

          if (shouldSkipDecoy()) {
            forceNextNonDecoy();
          }
        }
      }
    }

    /*
      Also guard sustained decoy on screen after cap or near end.
    */
    if (item && item.kind === 'decoy' && shouldSkipDecoy()) {
      forceNextNonDecoy();
    }

    updateQa();
  }

  function qs(name, fallback) {
    try {
      return new URL(location.href).searchParams.get(name) || fallback || '';
    } catch (e) {
      return fallback || '';
    }
  }

  function updateQa() {
    const enabled = qs('qa', '') === '1' || qs('debug', '') === '1';
    DOC.body.classList.toggle('cvr-v19d-qa-on', enabled);

    if (!enabled) return;

    const el = $('cvrV19dQa');
    if (!el) return;

    const item = currentItem();

    el.textContent = [
      `Decoy Guard ${VERSION}`,
      `decoySeen=${state.decoySeen}/${maxDecoys()}`,
      `decoySkipped=${state.decoySkipped}`,
      `recent=${state.recentKinds.join(',') || '-'}`,
      `remain=${remain()}s`,
      `current=${item ? item.kind + ':' + (item.icon || '-') : '-'}`,
      `skip=${item && item.kind === 'decoy' ? shouldSkipDecoy() : false}`
    ].join('\n');
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_DECOY_GUARD_V19D = {
      version: VERSION,
      forceNextNonDecoy,
      getState: function () {
        return {
          version: VERSION,
          playing: isPlaying(),
          decoySeen: state.decoySeen,
          maxDecoys: maxDecoys(),
          decoySkipped: state.decoySkipped,
          recentKinds: state.recentKinds.slice(),
          current: currentItem(),
          remain: remain()
        };
      }
    };
  }

  function init() {
    injectStyle();
    ensureUi();
    expose();

    state.guardTimer = setInterval(guard, 260);

    console.info('[Groups cVR v1.9d] decoy runtime guard installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
