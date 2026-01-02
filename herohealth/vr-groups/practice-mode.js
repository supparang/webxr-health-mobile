// === /herohealth/vr-groups/practice-mode.js ===
// PACK 14: Practice Mode (cVR) — 15s warmup
// - Provides a tiny controller for practice state + countdown overlay
// - Use by calling: window.GroupsVR.PracticeMode.attach({ enabled, sec })
// - Emits: groups:practice {state:'start'|'tick'|'end', leftSec}

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const NS = WIN.GroupsVR = WIN.GroupsVR || {};
  const PM = NS.PracticeMode = NS.PracticeMode || {};

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  let active = false;
  let left = 0;
  let tmr = 0;

  function ensureOverlay(){
    let ov = DOC.querySelector('.groups-practice-ov');
    if (ov) return ov;

    ov = DOC.createElement('div');
    ov.className = 'groups-practice-ov';
    ov.style.cssText = `
      position:fixed; inset:0; z-index:150;
      display:flex; align-items:flex-start; justify-content:center;
      padding: calc(92px + env(safe-area-inset-top,0px)) 18px 18px;
      pointer-events:none;
    `;
    ov.innerHTML = `
      <div class="groups-practice-card" style="
        width:min(520px,100%);
        border-radius:22px;
        background: rgba(2,6,23,.72);
        border: 1px solid rgba(148,163,184,.18);
        box-shadow: 0 10px 28px rgba(0,0,0,.30);
        backdrop-filter: blur(10px);
        padding:12px 12px 10px;
        color:#e5e7eb;
        font-family: system-ui,-apple-system,'Segoe UI',sans-serif;
      ">
        <div style="font-weight:1000; font-size:13px;">🧪 PRACTICE</div>
        <div id="practiceLine" style="margin-top:6px; font-weight:900; font-size:14px;">
          อุ่นเครื่องก่อนเริ่มจริง… <span id="practiceLeft">15</span>s
        </div>
        <div style="margin-top:6px; font-weight:800; font-size:12px; color:#94a3b8; line-height:1.35;">
          ยิงจาก crosshair ให้ชินมือ • เน้น “ถูกหมู่” ก่อน ความเร็วค่อยตามมา
        </div>
      </div>
    `;
    DOC.body.appendChild(ov);
    return ov;
  }

  function setLeft(sec){
    const ov = ensureOverlay();
    const el = DOC.getElementById('practiceLeft');
    if (el) el.textContent = String(sec|0);
  }

  function hideOverlay(){
    const ov = DOC.querySelector('.groups-practice-ov');
    if (ov) ov.remove();
  }

  function tick(){
    clearTimeout(tmr);
    if (!active) return;
    left = Math.max(0, left - 1);
    setLeft(left);
    emit('groups:practice', { state:'tick', leftSec:left });

    if (left <= 0){
      active = false;
      hideOverlay();
      emit('groups:practice', { state:'end', leftSec:0 });
      return;
    }
    tmr = setTimeout(tick, 1000);
  }

  PM.attach = function(cfg){
    cfg = cfg || {};
    const enabled = !!cfg.enabled;
    const sec = clamp(cfg.sec ?? 15, 5, 30);

    if (!enabled) return;

    active = true;
    left = sec|0;
    ensureOverlay();
    setLeft(left);
    emit('groups:practice', { state:'start', leftSec:left });

    clearTimeout(tmr);
    tmr = setTimeout(tick, 1000);
  };

  PM.isActive = function(){ return !!active; };

})();