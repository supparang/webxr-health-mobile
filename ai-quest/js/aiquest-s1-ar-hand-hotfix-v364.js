/* =========================================================
   CSAI2102 AI Quest
   S1 AR Hand Tracking Hotfix
   File: /ai-quest/js/aiquest-s1-ar-hand-hotfix-v364.js
   Version: v3.6.4-s1-ar-hand-next-support

   ใช้คู่กับ:
   - aiquest-s1-ar-practice-v364.js

   ความสามารถ:
   - ใช้ MediaPipe Hands จับมือจากกล้อง
   - วงกลมสีฟ้าตามปลายนิ้วชี้
   - หนีบนิ้วโป้ง+นิ้วชี้เพื่อเลือกคำตอบ
   - หรือชี้ค้าง 0.8 วินาทีเพื่อเลือก
   - ใช้มือกดปุ่ม “ข้อต่อไป”
   - ใช้มือกด “เล่น AR อีกครั้ง” / “กลับ Mission”
   - fallback เป็น mouse/touch ได้เหมือนเดิม
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v3.6.4-s1-ar-hand-next-support';
  const HANDS_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';

  let hands = null;
  let active = false;
  let raf = 0;

  let lastHover = null;
  let hoverStart = 0;
  let lastPinch = false;

  const CONFIG = {
    mirror: true,
    dwellMs: 850,
    pinchThreshold: 0.075,
    minDetectionConfidence: 0.45,
    minTrackingConfidence: 0.45,
    hitPad: 40
  };

  function $(id){
    return document.getElementById(id);
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      if(document.querySelector(`script[src="${src}"]`)){
        resolve();
        return;
      }

      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function injectStyle(){
    if($('s1HandHotfixStyleV364')) return;

    const css = document.createElement('style');
    css.id = 's1HandHotfixStyleV364';
    css.textContent = `
      .s1-hand-cursor-v364{
        position:fixed;
        left:0;
        top:0;
        width:36px;
        height:36px;
        border:3px solid #67e8f9;
        border-radius:999px;
        z-index:10020;
        pointer-events:none;
        transform:translate(-50%,-50%);
        display:none;
        background:rgba(255,255,255,.08);
        box-shadow:
          0 0 0 9px rgba(34,211,238,.16),
          0 0 26px rgba(34,211,238,.46);
      }

      .s1-hand-cursor-v364.pinch{
        width:48px;
        height:48px;
        border-color:#86efac;
        box-shadow:
          0 0 0 12px rgba(34,197,94,.22),
          0 0 34px rgba(34,197,94,.58);
      }

      .s1-hand-status-v364{
        position:fixed;
        left:12px;
        top:calc(66px + env(safe-area-inset-top,0px));
        z-index:10021;
        padding:8px 12px;
        border-radius:999px;
        color:#e0f2fe;
        background:rgba(15,23,42,.72);
        border:1px solid rgba(255,255,255,.18);
        font-size:12px;
        font-weight:900;
        backdrop-filter:blur(10px);
        display:none;
      }

      .s1-hand-dwell-v364{
        position:fixed;
        left:0;
        top:0;
        width:62px;
        height:62px;
        border-radius:999px;
        z-index:10019;
        pointer-events:none;
        transform:translate(-50%,-50%);
        display:none;
        background:conic-gradient(#86efac var(--p,0deg), rgba(255,255,255,.14) 0deg);
        -webkit-mask:radial-gradient(circle, transparent 54%, #000 55%);
        mask:radial-gradient(circle, transparent 54%, #000 55%);
      }

      .s1-ar-choice-v364.hand-hover-v364,
      #s1ArNextV364.hand-hover-v364,
      #s1ArReplayV364.hand-hover-v364,
      #s1ArBackV364.hand-hover-v364{
        outline:3px solid rgba(34,211,238,.95) !important;
        box-shadow:
          0 0 0 7px rgba(34,211,238,.18),
          0 0 30px rgba(34,211,238,.42) !important;
        transform:translateY(-1px);
      }

      .s1-ar-choice-v364.hand-hover-v364::after,
      #s1ArNextV364.hand-hover-v364::after,
      #s1ArReplayV364.hand-hover-v364::after,
      #s1ArBackV364.hand-hover-v364::after{
        content:'ชี้ค้าง / หนีบนิ้วเพื่อเลือก';
        position:absolute;
        right:10px;
        top:-13px;
        padding:4px 8px;
        border-radius:999px;
        background:#06b6d4;
        color:#042f2e;
        font-size:10px;
        font-weight:1000;
        white-space:nowrap;
        z-index:2;
      }

      #s1ArNextV364,
      #s1ArReplayV364,
      #s1ArBackV364{
        position:relative;
      }
    `;
    document.head.appendChild(css);
  }

  function ensureUI(){
    injectStyle();

    if(!$('s1HandCursorV364')){
      const c = document.createElement('div');
      c.id = 's1HandCursorV364';
      c.className = 's1-hand-cursor-v364';
      document.body.appendChild(c);
    }

    if(!$('s1HandDwellV364')){
      const d = document.createElement('div');
      d.id = 's1HandDwellV364';
      d.className = 's1-hand-dwell-v364';
      document.body.appendChild(d);
    }

    if(!$('s1HandStatusV364')){
      const s = document.createElement('div');
      s.id = 's1HandStatusV364';
      s.className = 's1-hand-status-v364';
      s.textContent = 'Hand: loading…';
      document.body.appendChild(s);
    }
  }

  function status(msg){
    const s = $('s1HandStatusV364');
    if(!s) return;

    s.style.display = isArOpen() ? 'block' : 'none';
    s.textContent = msg || '';
  }

  function isArOpen(){
    const panel = $('s1ArPanelV364');
    return !!(panel && panel.classList.contains('open'));
  }

  function video(){
    return $('s1ArVideoV364');
  }

  function clearHover(){
    if(lastHover){
      lastHover.classList.remove('hand-hover-v364');
    }

    lastHover = null;
    hoverStart = 0;

    const ring = $('s1HandDwellV364');
    if(ring){
      ring.style.setProperty('--p', '0deg');
    }
  }

  function hideCursor(){
    const c = $('s1HandCursorV364');
    const d = $('s1HandDwellV364');

    if(c) c.style.display = 'none';
    if(d) d.style.display = 'none';

    clearHover();
  }

  async function initHands(){
    ensureUI();

    if(window.Hands){
      return true;
    }

    try{
      await loadScript(HANDS_URL);
      return !!window.Hands;
    }catch(err){
      console.warn('[AIQuest S1 Hand] MediaPipe load failed', err);
      status('Hand: โหลด MediaPipe ไม่ได้ ใช้ touch/mouse แทน');
      return false;
    }
  }

  async function startHandTracking(){
    ensureUI();

    if(active) return;

    const ok = await initHands();
    if(!ok) return;

    const v = video();

    if(!v || !v.srcObject){
      status('Hand: ยังไม่พบกล้อง รอเปิด AR ก่อน');
      return;
    }

    try{
      hands = new window.Hands({
        locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: CONFIG.minDetectionConfidence,
        minTrackingConfidence: CONFIG.minTrackingConfidence
      });

      hands.onResults(onResults);

      active = true;
      status('Hand: พร้อมแล้ว • ชี้คำตอบ/ปุ่ม แล้วหนีบนิ้ว หรือชี้ค้าง');

      loop();

    }catch(err){
      console.warn('[AIQuest S1 Hand] init failed', err);
      status('Hand: เริ่มไม่ได้ ใช้ touch/mouse แทน');
    }
  }

  function stopHandTracking(){
    active = false;

    if(raf){
      cancelAnimationFrame(raf);
    }

    raf = 0;
    hideCursor();
    status('');
  }

  async function loop(){
    if(!active) return;

    const v = video();

    if(isArOpen() && hands && v && v.readyState >= 2){
      try{
        await hands.send({ image:v });
      }catch(err){
        // avoid frame-level noisy errors
      }
    }

    raf = requestAnimationFrame(loop);
  }

  function getActionTargetAtPoint(sx, sy){
    const target = document.elementFromPoint(sx, sy);

    let actionTarget = target && target.closest
      ? target.closest(
          '.s1-ar-choice-v364:not([disabled]), ' +
          '#s1ArNextV364:not([disabled]), ' +
          '#s1ArReplayV364:not([disabled]), ' +
          '#s1ArBackV364:not([disabled])'
        )
      : null;

    if(actionTarget){
      return actionTarget;
    }

    const candidates = [
      $('s1ArNextV364'),
      $('s1ArReplayV364'),
      $('s1ArBackV364')
    ].filter(el => el && !el.disabled);

    for(const btn of candidates){
      const r = btn.getBoundingClientRect();
      const pad = CONFIG.hitPad;

      const near =
        sx >= r.left - pad &&
        sx <= r.right + pad &&
        sy >= r.top - pad &&
        sy <= r.bottom + pad;

      if(near){
        return btn;
      }
    }

    return null;
  }

  function onResults(results){
    if(!isArOpen()){
      hideCursor();
      return;
    }

    const cursor = $('s1HandCursorV364');
    const ring = $('s1HandDwellV364');

    const lm = results &&
      results.multiHandLandmarks &&
      results.multiHandLandmarks[0];

    if(!lm || !lm[8] || !lm[4]){
      hideCursor();
      status('Hand: ไม่พบมือ • ยกมือให้อยู่ในกล้อง');
      return;
    }

    const indexTip = lm[8];
    const thumbTip = lm[4];

    let x = CONFIG.mirror ? (1 - indexTip.x) : indexTip.x;
    let y = indexTip.y;

    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    const sx = x * window.innerWidth;
    const sy = y * window.innerHeight;

    const dx = indexTip.x - thumbTip.x;
    const dy = indexTip.y - thumbTip.y;
    const dz = (indexTip.z || 0) - (thumbTip.z || 0);

    const pinchDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const pinch = pinchDistance < CONFIG.pinchThreshold;

    cursor.style.display = 'block';
    cursor.style.left = sx + 'px';
    cursor.style.top = sy + 'px';
    cursor.classList.toggle('pinch', pinch);

    ring.style.display = 'block';
    ring.style.left = sx + 'px';
    ring.style.top = sy + 'px';

    const actionTarget = getActionTargetAtPoint(sx, sy);

    if(!actionTarget){
      clearHover();
      ring.style.setProperty('--p', '0deg');
      status('Hand: เลื่อนปลายนิ้วไปที่ตัวเลือกหรือปุ่ม');
      lastPinch = pinch;
      return;
    }

    if(actionTarget !== lastHover){
      clearHover();
      lastHover = actionTarget;
      hoverStart = Date.now();
      actionTarget.classList.add('hand-hover-v364');
    }

    const dwell = Date.now() - hoverStart;
    const deg = Math.min(360, Math.round(dwell / CONFIG.dwellMs * 360));

    ring.style.setProperty('--p', deg + 'deg');

    const isNext = actionTarget.id === 's1ArNextV364';
    const isReplay = actionTarget.id === 's1ArReplayV364';
    const isBack = actionTarget.id === 's1ArBackV364';

    let label = 'เลือกคำตอบ';

    if(isNext) label = 'ไปข้อต่อไป';
    if(isReplay) label = 'เล่นอีกครั้ง';
    if(isBack) label = 'กลับ Mission';

    status(
      pinch
        ? `Hand: pinch ${label}`
        : `Hand: ชี้ค้าง หรือหนีบนิ้วเพื่อ${label}`
    );

    const pinchStarted = pinch && !lastPinch;
    const dwellDone = dwell >= CONFIG.dwellMs;

    if(pinchStarted || dwellDone){
      actionTarget.click();
      clearHover();
    }

    lastPinch = pinch;
  }

  function installWatcher(){
    ensureUI();

    const mo = new MutationObserver(() => {
      if(isArOpen()){
        const s = $('s1HandStatusV364');
        if(s) s.style.display = 'block';

        const v = video();

        if(v && v.srcObject && !active){
          startHandTracking();
        }
      }else{
        stopHandTracking();
      }
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    setInterval(() => {
      if(isArOpen()){
        const v = video();

        if(v && v.srcObject && !active){
          startHandTracking();
        }
      }else if(active){
        stopHandTracking();
      }
    }, 1000);
  }

  window.AIQUEST_S1_HAND_HOTFIX = {
    version: VERSION,
    start: startHandTracking,
    stop: stopHandTracking,
    config: CONFIG
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', installWatcher);
  }else{
    installWatcher();
  }

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
