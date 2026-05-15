// === /herohealth/vr-groups/groups-cvr-qa-balance-v19.js ===
// HeroHealth Groups cVR — v1.9 QA + Balance Guard
// Fixes:
// - Wrong-gate warning can still feel stuck.
// - Halo can remain on wrong gate after soft retry.
// - Food may be too low after a blocked/wrong aim, causing fast fail.
// - Ensures gates=5 and item=1 while playing.
// - Adds lightweight QA overlay with ?qa=1 or ?debug=1.
// Safe add-on: does not change scoring rules.
// PATCH v20260515-GROUPS-CVR-V19-QA-BALANCE-GUARD

(function () {
  'use strict';

  const VERSION = 'v1.9-cvr-qa-balance-guard-20260515';

  if (window.__HHA_GROUPS_CVR_QA_BALANCE_V19__) return;
  window.__HHA_GROUPS_CVR_QA_BALANCE_V19__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    lastBlocked: 0,
    lastHits: 0,
    lastShots: 0,
    lastSoftAt: 0,
    lastRecoverAt: 0,
    lastGateFlashAt: 0,
    lastItemSig: '',
    staleHaloCount: 0,
    qaTimer: null,
    guardTimer: null,
    pulseTimer: null
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

  function directApi() {
    return WIN.HHA_GROUPS_CVR_DIRECT_SHOOT_V18 || null;
  }

  function aimApi() {
    return WIN.HHA_GROUPS_CVR_AIM_ASSIST_V12 || null;
  }

  function gs() {
    try {
      const core = coreApi();
      if (core && typeof core.getState === 'function') return core.getState() || {};
    } catch (e) {}
    return {};
  }

  function ds() {
    try {
      const direct = directApi();
      if (direct && typeof direct.getState === 'function') return direct.getState() || {};
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

  function currentGroupKey() {
    const item = currentItem();
    return item && item.group && item.group.key ? item.group.key : '';
  }

  function currentGroupId() {
    const item = currentItem();
    return item && item.group && item.group.id ? item.group.id : '';
  }

  function currentKind() {
    const item = currentItem();
    return item && item.kind ? item.kind : '';
  }

  function hasTargets() {
    return {
      gates: DOC.querySelectorAll('.clickable[data-role="gate"]').length,
      items: DOC.querySelectorAll('.clickable[data-role="item"]').length
    };
  }

  function now() {
    return Date.now();
  }

  function itemSignature() {
    const item = currentItem();
    if (!item) return 'none';

    return [
      item.kind || '',
      item.icon || '',
      item.power || '',
      item.group && item.group.key || ''
    ].join('|');
  }

  function injectStyle() {
    if ($('groups-cvr-v19-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v19-style';
    style.textContent = `
      .cvr-v19-tip{
        position:fixed;
        left:50%;
        top:calc(104px + env(safe-area-inset-top,0px));
        transform:translateX(-50%);
        z-index:2147483400;
        width:min(520px,calc(100vw - 24px));
        border-radius:999px;
        padding:9px 14px;
        background:rgba(255,255,255,.94);
        color:#244e68;
        box-shadow:0 18px 48px rgba(35,81,107,.18);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:clamp(15px,4vw,22px);
        line-height:1.15;
        font-weight:1000;
        text-align:center;
        pointer-events:none;
        opacity:0;
      }

      .cvr-v19-tip.show{
        animation:cvrV19Tip .9s ease both;
      }

      .cvr-v19-tip.warn{
        background:#fff5ca;
        color:#806000;
      }

      .cvr-v19-tip.good{
        background:#f5fff1;
        color:#31724b;
      }

      @keyframes cvrV19Tip{
        0%{opacity:0; transform:translateX(-50%) translateY(8px) scale(.96);}
        18%{opacity:1; transform:translateX(-50%) translateY(0) scale(1.02);}
        75%{opacity:1; transform:translateX(-50%) translateY(0) scale(1);}
        100%{opacity:0; transform:translateX(-50%) translateY(-10px) scale(.98);}
      }

      .cvr-v19-correct-gate-pulse{
        animation:cvrV19GatePulse .58s ease-in-out 2;
        filter:drop-shadow(0 0 18px rgba(126,217,87,.8));
      }

      @keyframes cvrV19GatePulse{
        0%{transform:scale(1);}
        50%{transform:scale(1.1);}
        100%{transform:scale(1);}
      }

      .cvr-v19-qa{
        position:fixed;
        right:8px;
        top:calc(74px + env(safe-area-inset-top,0px));
        z-index:2147483350;
        width:min(320px,calc(100vw - 16px));
        border-radius:18px;
        padding:8px 10px;
        display:none;
        background:rgba(36,78,104,.92);
        color:#fff;
        font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        white-space:pre-wrap;
        pointer-events:none;
      }

      body.cvr-v19-qa-on .cvr-v19-qa{
        display:block;
      }

      @media (max-height:700px){
        .cvr-v19-tip{
          top:calc(88px + env(safe-area-inset-top,0px));
          font-size:clamp(13px,3.5vw,18px);
          padding:7px 12px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureUi() {
    if (!$('cvrV19Tip')) {
      const tip = DOC.createElement('div');
      tip.id = 'cvrV19Tip';
      tip.className = 'cvr-v19-tip';
      DOC.body.appendChild(tip);
    }

    if (!$('cvrV19Qa')) {
      const qa = DOC.createElement('div');
      qa.id = 'cvrV19Qa';
      qa.className = 'cvr-v19-qa';
      DOC.body.appendChild(qa);
    }
  }

  function tip(text, kind) {
    const el = $('cvrV19Tip');
    if (!el) return;

    el.className = 'cvr-v19-tip ' + (kind || '');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function clearHalos() {
    DOC.querySelectorAll('.cvr-v12-halo').forEach(halo => {
      try {
        halo.setAttribute('visible', 'false');
      } catch (e) {}
    });

    DOC.querySelectorAll('.clickable').forEach(el => {
      try {
        el.setAttribute('scale', '1 1 1');
      } catch (e) {}
    });

    DOC.body.classList.remove(
      'cvr-v12-has-target',
      'cvr-v12-target-good',
      'cvr-v12-target-power',
      'cvr-v12-target-decoy',
      'cvr-v12-target-golden',
      'cvr-v12-target-neutral'
    );
  }

  function flashCorrectGate() {
    const key = currentGroupKey();
    const id = currentGroupId();

    if (!key) return;

    const gate = DOC.querySelector(`.clickable[data-role="gate"][data-group="${key}"]`);
    if (!gate) return;

    if (now() - state.lastGateFlashAt < 650) return;
    state.lastGateFlashAt = now();

    try {
      gate.classList.add('cvr-v19-correct-gate-pulse');
      gate.setAttribute('scale', '1.18 1.18 1.18');

      setTimeout(() => {
        if (!gate.isConnected) return;
        gate.classList.remove('cvr-v19-correct-gate-pulse');
        gate.setAttribute('scale', '1 1 1');
      }, 780);
    } catch (e) {}

    if (id) {
      tip(`ไปประตูหมู่ ${id}`, 'warn');
    }
  }

  function recoverArena(reason) {
    const core = coreApi();

    if (!core) return false;
    if (now() - state.lastRecoverAt < 420) return false;

    state.lastRecoverAt = now();

    try {
      if (typeof core.recoverArena === 'function') {
        core.recoverArena(reason || 'v19-recover');
        return true;
      }
    } catch (e) {}

    try {
      if (typeof core.rebuildGates === 'function') core.rebuildGates();
      if (typeof core.forceSpawn === 'function') core.forceSpawn();
      return true;
    } catch (e) {}

    return false;
  }

  function softRetry(reason) {
    const core = coreApi();

    clearHalos();
    flashCorrectGate();

    if (!core) return false;
    if (now() - state.lastSoftAt < 420) return false;

    state.lastSoftAt = now();

    try {
      if (typeof core.softRetry === 'function') {
        core.softRetry(reason || 'v19-soft-retry');
        return true;
      }
    } catch (e) {}

    return recoverArena(reason || 'v19-soft-retry-fallback');
  }

  function guardTargets() {
    if (!isPlaying()) return;

    const count = hasTargets();

    if (count.gates < 5 || count.items < 1) {
      recoverArena('v19-target-count');
      return;
    }

    const sig = itemSignature();

    if (sig !== state.lastItemSig) {
      state.lastItemSig = sig;
      clearHalos();

      const kind = currentKind();

      if (kind === 'food' || kind === 'golden') {
        setTimeout(flashCorrectGate, 180);
      }
    }
  }

  function guardWrongBlock() {
    if (!isPlaying()) return;

    const d = ds();
    const blocked = Number(d.blocked || 0);
    const hits = Number(d.hits || 0);
    const shots = Number(d.shots || 0);

    if (blocked > state.lastBlocked) {
      const delta = blocked - state.lastBlocked;
      state.lastBlocked = blocked;

      clearHalos();
      softRetry('v19-blocked-' + delta);

      const id = currentGroupId();
      if (id) tip(`ลองใหม่: เล็งประตูหมู่ ${id}`, 'warn');
    }

    if (hits > state.lastHits) {
      state.lastHits = hits;
      clearHalos();
      tip('ยิงเข้าแล้ว!', 'good');
    }

    state.lastShots = shots;
  }

  function guardNearFloorAfterWrongAim() {
    if (!isPlaying()) return;

    const s = gs();
    const y = Number(s.itemY || 0);
    const d = ds();

    const blocked = Number(d.blocked || 0);

    /*
      If the player recently had a blocked/wrong target and the item is already low,
      give one more fair retry instead of letting it immediately fall and punish.
    */
    const recentBlock = blocked > 0 && now() - state.lastSoftAt < 1600;

    if (recentBlock && y > 0 && y < 1.05) {
      softRetry('v19-near-floor-after-block');
    }
  }

  function guardStaleHalo() {
    if (!isPlaying()) return;

    const kind = currentKind();
    const key = currentGroupKey();

    if (!(kind === 'food' || kind === 'golden') || !key) return;

    const highlighted = Array.from(DOC.querySelectorAll('.clickable')).find(el => {
      const halo = el.querySelector('.cvr-v12-halo');
      if (!halo) return false;

      const visible = halo.getAttribute('visible');
      return visible === true || visible === 'true';
    });

    if (!highlighted) return;

    const dsTarget = highlighted.dataset || {};

    if (dsTarget.role === 'gate' && dsTarget.group !== key) {
      state.staleHaloCount += 1;

      if (state.staleHaloCount >= 2) {
        clearHalos();
        flashCorrectGate();
        state.staleHaloCount = 0;
      }
    } else {
      state.staleHaloCount = 0;
    }
  }

  function tuneAimTolerance() {
    /*
      Keep aim helpful but not too sticky.
      v18d uses 390; v19 gently caps it around 360–400.
    */
    try {
      const direct = directApi();
      if (direct && typeof direct.setAimPx === 'function') {
        direct.setAimPx(385);
      }
    } catch (e) {}

    try {
      const aim = aimApi();
      if (aim && typeof aim.setAimPx === 'function') {
        aim.setAimPx(300);
      }
    } catch (e) {}
  }

  function qaOverlay() {
    const enabled = qs('qa', '') === '1' || qs('debug', '') === '1';
    DOC.body.classList.toggle('cvr-v19-qa-on', enabled);

    if (!enabled) return;

    const el = $('cvrV19Qa');
    if (!el) return;

    const s = gs();
    const d = ds();
    const count = hasTargets();

    el.textContent = [
      `Groups cVR QA ${VERSION}`,
      `mode=${s.mode || '-'}`,
      `phase=${s.phase || '-'}`,
      `score=${s.score || 0}`,
      `correct=${s.correct || 0}`,
      `miss=${s.miss || 0}`,
      `combo=${s.combo || 0}`,
      `hearts=${s.hearts || 0}`,
      `itemY=${Number(s.itemY || 0).toFixed(2)}`,
      `current=${s.current ? ((s.current.kind || '-') + ':' + (s.current.icon || '-')) : '-'}`,
      `needGroup=${currentGroupId() || '-'}`,
      `gates=${count.gates}`,
      `items=${count.items}`,
      `shots=${d.shots || 0}`,
      `hits=${d.hits || 0}`,
      `blocked=${d.blocked || 0}`,
      `lastTarget=${d.lastTarget || '-'}`,
      `softReady=${Boolean(coreApi() && coreApi().softRetry)}`,
      `recovery=${d.recoveryCount || 0}`
    ].join('\n');
  }

  function guardLoop() {
    guardTargets();
    guardWrongBlock();
    guardNearFloorAfterWrongAim();
    guardStaleHalo();
    qaOverlay();
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_QA_BALANCE_V19 = {
      version: VERSION,
      recoverArena,
      softRetry,
      clearHalos,
      flashCorrectGate,
      getState: function () {
        return {
          version: VERSION,
          playing: isPlaying(),
          targets: hasTargets(),
          core: Boolean(coreApi()),
          direct: Boolean(directApi()),
          current: currentItem(),
          currentGroupKey: currentGroupKey(),
          currentGroupId: currentGroupId(),
          lastBlocked: state.lastBlocked,
          lastHits: state.lastHits,
          lastSoftAt: state.lastSoftAt,
          lastRecoverAt: state.lastRecoverAt
        };
      }
    };
  }

  function init() {
    injectStyle();
    ensureUi();
    expose();
    tuneAimTolerance();

    state.guardTimer = setInterval(guardLoop, 260);
    state.pulseTimer = setInterval(() => {
      if (!isPlaying()) return;
      guardTargets();
      tuneAimTolerance();
    }, 1200);

    console.info('[Groups cVR v1.9] QA + balance guard installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
