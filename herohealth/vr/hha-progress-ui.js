// === /herohealth/vr/hha-progress-ui.js ===
// HHA Universal Progress + LowTime Overlay — v1.0.0
// Listens: window 'hha:start' and 'hha:time' and 'hha:end'
// - 'hha:start' should contain durationPlannedSec (preferred) or timePlanSec
// - 'hha:time' may contain leftSec OR left (number)
// Auto:
// - progress bar bottom (safe-area)
// - low-time overlay when <= 5s (big countdown)
// Non-blocking: pointer-events none

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (WIN.__HHA_PROGRESS_UI_LOADED__) return;
  WIN.__HHA_PROGRESS_UI_LOADED__ = true;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  // window.HHA_PROGRESS_CONFIG = { showLowAt:5, barHeight:10, bottomPx:10, maxWidthPx:860 }
  const CFG = Object.assign({
    showLowAt: 5,
    barHeight: 10,
    bottomPx: 10,
    maxWidthPx: 860
  }, WIN.HHA_PROGRESS_CONFIG || {});

  const S = {
    plannedSec: 0,
    lastLeftSec: null,
    startedAtMs: 0,
    ended: false,
    lastRenderAt: 0,
    // soft-fallback when start missing
    inferredPlannedSec: 0
  };

  function ensureStyle(){
    if (DOC.getElementById('hha-progress-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-progress-style';
    st.textContent = `
      .hhaProgWrap{
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: calc(${CFG.bottomPx}px + env(safe-area-inset-bottom));
        z-index: 99995;
        width: min(${CFG.maxWidthPx}px, 92vw);
        pointer-events: none;
      }
      .hhaProgWrap[hidden]{ display:none !important; }

      .hhaProgTrack{
        width: 100%;
        height: ${CFG.barHeight}px;
        border-radius: 999px;
        background: rgba(148,163,184,.14);
        border: 1px solid rgba(148,163,184,.18);
        overflow: hidden;
        box-shadow: 0 10px 26px rgba(0,0,0,.22);
        backdrop-filter: blur(8px);
      }
      .hhaProgFill{
        width: 0%;
        height: 100%;
        border-radius: 999px;
        background: rgba(34,197,94,.75);
        transition: width 180ms ease;
      }
      .hhaProgMeta{
        margin-top: 6px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 10px;
        font-weight: 900;
        font-size: 11px;
        color: rgba(148,163,184,.92);
        text-shadow: 0 1px 0 rgba(0,0,0,.22);
      }
      .hhaProgMeta b{
        color: rgba(226,232,240,.96);
        font-weight: 950;
      }

      /* low time overlay */
      .hhaLowWrap{
        position: fixed;
        inset: 0;
        z-index: 99997;
        display:flex;
        align-items:center;
        justify-content:center;
        pointer-events:none;
        background: rgba(2,6,23,.10);
        backdrop-filter: blur(1px);
        opacity: 0;
        transition: opacity 140ms ease;
      }
      .hhaLowWrap.show{ opacity: 1; }

      .hhaLowCard{
        width: min(340px, 74vw);
        border-radius: 22px;
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.72);
        box-shadow: 0 18px 60px rgba(0,0,0,.35);
        padding: 18px 18px 14px;
        text-align:center;
      }
      .hhaLowTitle{
        font-weight: 950;
        font-size: 13px;
        color: rgba(148,163,184,.96);
        letter-spacing: .2px;
        margin-bottom: 8px;
      }
      .hhaLowNum{
        font-weight: 1000;
        font-size: 72px;
        line-height: 1;
        color: rgba(226,232,240,.98);
        text-shadow: 0 10px 30px rgba(0,0,0,.35);
      }
      .hhaLowHint{
        margin-top: 8px;
        font-weight: 950;
        font-size: 12px;
        color: rgba(34,197,94,.90);
      }

      body.view-cvr .hhaProgWrap{
        bottom: calc(${CFG.bottomPx + 6}px + env(safe-area-inset-bottom));
      }
    `;
    DOC.head.appendChild(st);
  }

  function ensureDom(){
    ensureStyle();

    let wrap = DOC.getElementById('hhaProgWrap');
    if (!wrap){
      wrap = DOC.createElement('div');
      wrap.id = 'hhaProgWrap';
      wrap.className = 'hhaProgWrap';
      wrap.hidden = true;
      wrap.innerHTML = `
        <div class="hhaProgTrack"><div class="hhaProgFill" id="hhaProgFill"></div></div>
        <div class="hhaProgMeta">
          <span>เวลาเหลือ <b id="hhaProgLeft">—</b>s</span>
          <span>รวม <b id="hhaProgPlan">—</b>s</span>
        </div>
      `;
      DOC.body.appendChild(wrap);
    }

    let low = DOC.getElementById('hhaLowWrap');
    if (!low){
      low = DOC.createElement('div');
      low.id = 'hhaLowWrap';
      low.className = 'hhaLowWrap';
      low.innerHTML = `
        <div class="hhaLowCard" role="status" aria-live="polite">
          <div class="hhaLowTitle">ใกล้หมดเวลา</div>
          <div class="hhaLowNum" id="hhaLowNum">5</div>
          <div class="hhaLowHint">ยิงให้แม่น! 🔥</div>
        </div>
      `;
      DOC.body.appendChild(low);
    }

    return { wrap, low };
  }

  function readLeftSec(detail){
    const d = detail || {};
    let left = d.leftSec;
    if (!Number.isFinite(left)) left = d.left;
    if (!Number.isFinite(left)) left = d.left_seconds;
    if (!Number.isFinite(left)) return null;
    return Math.max(0, Math.round(Number(left)));
  }

  function setPlannedFromStart(detail){
    const d = detail || {};
    let p = d.durationPlannedSec;
    if (!Number.isFinite(p)) p = d.timePlanSec;
    if (!Number.isFinite(p)) p = d.timePlan;
    if (!Number.isFinite(p)) p = d.timePlannedSec;
    if (!Number.isFinite(p)) return false;

    S.plannedSec = clamp(p, 10, 3600);
    S.inferredPlannedSec = 0;
    return true;
  }

  function inferPlannedIfMissing(leftSec){
    // If we never got plannedSec, use the first observed leftSec as planned
    if (S.plannedSec > 0) return;
    if (!Number.isFinite(leftSec)) return;
    if (S.inferredPlannedSec <= 0){
      S.inferredPlannedSec = clamp(leftSec, 10, 3600);
      S.plannedSec = S.inferredPlannedSec;
    }else{
      // keep max just in case time emits start later
      S.plannedSec = Math.max(S.plannedSec, leftSec);
    }
  }

  function render(leftSec){
    const t = nowMs();
    if ((t - S.lastRenderAt) < 70) return; // throttle
    S.lastRenderAt = t;

    const { wrap, low } = ensureDom();
    const fill = DOC.getElementById('hhaProgFill');
    const elLeft = DOC.getElementById('hhaProgLeft');
    const elPlan = DOC.getElementById('hhaProgPlan');
    const elLowNum = DOC.getElementById('hhaLowNum');

    wrap.hidden = false;

    inferPlannedIfMissing(leftSec);

    const plan = Math.max(1, Number(S.plannedSec)||1);
    const left = clamp(leftSec, 0, plan);
    const played = clamp(plan - left, 0, plan);

    const pct = clamp((played/plan)*100, 0, 100);
    fill.style.width = `${pct.toFixed(0)}%`;

    elLeft.textContent = String(left);
    elPlan.textContent = String(plan);

    // low time overlay
    if (left <= CFG.showLowAt && left > 0){
      low.classList.add('show');
      elLowNum.textContent = String(left);
    }else{
      low.classList.remove('show');
    }
  }

  function hideAll(){
    const w = DOC.getElementById('hhaProgWrap');
    const low = DOC.getElementById('hhaLowWrap');
    if (w) w.hidden = true;
    if (low) low.classList.remove('show');
  }

  function onStart(ev){
    S.ended = false;
    S.startedAtMs = nowMs();
    S.lastLeftSec = null;

    setPlannedFromStart(ev && ev.detail);

    // show but wait for time ticks to render
    ensureDom();
    const w = DOC.getElementById('hhaProgWrap');
    if (w) w.hidden = false;
  }

  function onTime(ev){
    if (S.ended) return;
    const leftSec = readLeftSec(ev && ev.detail);
    if (leftSec == null) return;

    // avoid redundant renders
    if (S.lastLeftSec === leftSec) return;
    S.lastLeftSec = leftSec;

    render(leftSec);
  }

  function onEnd(){
    S.ended = true;
    // keep progress visible for a moment, then hide
    setTimeout(()=>hideAll(), 520);
  }

  WIN.addEventListener('hha:start', onStart, { passive:true });
  WIN.addEventListener('hha:time', onTime, { passive:true });
  WIN.addEventListener('hha:end', onEnd, { passive:true });

  WIN.HHA_ProgressUI = {
    reset: ()=>{ S.plannedSec=0; S.inferredPlannedSec=0; S.lastLeftSec=null; hideAll(); },
    setPlanned: (sec)=>{ S.plannedSec = clamp(sec, 10, 3600); },
    hide: hideAll
  };
})();