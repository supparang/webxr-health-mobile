/* =========================================================
   CSAI2102 AI Quest
   S1 AR Hand Tracking Hotfix
   File: /ai-quest/js/aiquest-s1-ar-hand-hotfix-v364.js
   Version: v3.6.5b-s1-ar-hand-next-support-universal
   ใช้ได้กับ panel/button id v362 / v364 / v365B
========================================================= */
(function(){
  'use strict';

  const VERSION='v3.6.5b-s1-ar-hand-next-support-universal';
  const HANDS_URL='https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';

  let hands=null, active=false, raf=0, lastHover=null, hoverStart=0, lastPinch=false;

  const CFG={
    mirror:true,
    dwellMs:850,
    pinchThreshold:0.075,
    minDetectionConfidence:0.45,
    minTrackingConfidence:0.45,
    hitPad:48
  };

  const $=id=>document.getElementById(id);

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      if(document.querySelector(`script[src="${src}"]`)){resolve();return;}
      const s=document.createElement('script');
      s.src=src; s.crossOrigin='anonymous'; s.onload=resolve; s.onerror=reject;
      document.head.appendChild(s);
    });
  }

  function injectStyle(){
    if($('s1HandHotfixStyleV365B'))return;
    const css=document.createElement('style');
    css.id='s1HandHotfixStyleV365B';
    css.textContent=`
      .s1-hand-cursor-v365b{position:fixed;left:0;top:0;width:38px;height:38px;border:3px solid #67e8f9;border-radius:999px;z-index:10020;pointer-events:none;transform:translate(-50%,-50%);display:none;background:rgba(255,255,255,.08);box-shadow:0 0 0 9px rgba(34,211,238,.16),0 0 26px rgba(34,211,238,.46)}
      .s1-hand-cursor-v365b.pinch{width:50px;height:50px;border-color:#86efac;box-shadow:0 0 0 12px rgba(34,197,94,.22),0 0 34px rgba(34,197,94,.58)}
      .s1-hand-status-v365b{position:fixed;left:12px;top:calc(66px + env(safe-area-inset-top,0px));z-index:10021;padding:8px 12px;border-radius:999px;color:#e0f2fe;background:rgba(15,23,42,.72);border:1px solid rgba(255,255,255,.18);font-size:12px;font-weight:900;backdrop-filter:blur(10px);display:none}
      .s1-hand-dwell-v365b{position:fixed;left:0;top:0;width:64px;height:64px;border-radius:999px;z-index:10019;pointer-events:none;transform:translate(-50%,-50%);display:none;background:conic-gradient(#86efac var(--p,0deg),rgba(255,255,255,.14) 0deg);-webkit-mask:radial-gradient(circle,transparent 54%,#000 55%);mask:radial-gradient(circle,transparent 54%,#000 55%)}
      .s1-ar-choice-v365b.hand-hover-v365b,.s1-ar-choice-v365.hand-hover-v365b,.s1-ar-choice-v364.hand-hover-v365b,.s1-ar-choice-v362.hand-hover-v365b,#s1ArNextV365B.hand-hover-v365b,#s1ArNextV365.hand-hover-v365b,#s1ArNextV364.hand-hover-v365b,#s1ArNextV362.hand-hover-v365b,#s1ArReplayV365B.hand-hover-v365b,#s1ArReplayV365.hand-hover-v365b,#s1ArReplayV364.hand-hover-v365b,#s1ArReplayV362.hand-hover-v365b,#s1ArBackV365B.hand-hover-v365b,#s1ArBackV365.hand-hover-v365b,#s1ArBackV364.hand-hover-v365b,#s1ArBackV362.hand-hover-v365b{outline:3px solid rgba(34,211,238,.95)!important;box-shadow:0 0 0 7px rgba(34,211,238,.18),0 0 30px rgba(34,211,238,.42)!important;transform:translateY(-1px)}
      #s1ArNextV365B,#s1ArNextV365,#s1ArNextV364,#s1ArNextV362,#s1ArReplayV365B,#s1ArReplayV365,#s1ArReplayV364,#s1ArReplayV362,#s1ArBackV365B,#s1ArBackV365,#s1ArBackV364,#s1ArBackV362{position:relative}
    `;
    document.head.appendChild(css);
  }

  function ensureUI(){
    injectStyle();
    if(!$('s1HandCursorV365B')){
      const c=document.createElement('div'); c.id='s1HandCursorV365B'; c.className='s1-hand-cursor-v365b'; document.body.appendChild(c);
    }
    if(!$('s1HandDwellV365B')){
      const d=document.createElement('div'); d.id='s1HandDwellV365B'; d.className='s1-hand-dwell-v365b'; document.body.appendChild(d);
    }
    if(!$('s1HandStatusV365B')){
      const s=document.createElement('div'); s.id='s1HandStatusV365B'; s.className='s1-hand-status-v365b'; s.textContent='Hand: loading…'; document.body.appendChild(s);
    }
  }

  function panel(){return $('s1ArPanelV365B')||$('s1ArPanelV365')||$('s1ArPanelV364')||$('s1ArPanelV362');}
  function video(){return $('s1ArVideoV365B')||$('s1ArVideoV365')||$('s1ArVideoV364')||$('s1ArVideoV362');}
  function isOpen(){const p=panel(); return !!(p&&p.classList.contains('open'));}
  function status(msg){const s=$('s1HandStatusV365B'); if(!s)return; s.style.display=isOpen()?'block':'none'; s.textContent=msg||'';}
  function clearHover(){if(lastHover)lastHover.classList.remove('hand-hover-v365b'); lastHover=null; hoverStart=0; const r=$('s1HandDwellV365B'); if(r)r.style.setProperty('--p','0deg');}
  function hideCursor(){const c=$('s1HandCursorV365B'),d=$('s1HandDwellV365B'); if(c)c.style.display='none'; if(d)d.style.display='none'; clearHover();}

  async function initHands(){
    ensureUI();
    if(window.Hands)return true;
    try{await loadScript(HANDS_URL);return !!window.Hands;}
    catch(err){console.warn('[AIQuest S1 Hand] MediaPipe load failed',err);status('Hand: โหลด MediaPipe ไม่ได้ ใช้ touch/mouse แทน');return false;}
  }

  async function start(){
    ensureUI();
    if(active)return;
    if(!await initHands())return;
    const v=video();
    if(!v||!v.srcObject){status('Hand: ยังไม่พบกล้อง รอเปิด AR ก่อน');return;}
    try{
      hands=new window.Hands({locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
      hands.setOptions({maxNumHands:1,modelComplexity:1,minDetectionConfidence:CFG.minDetectionConfidence,minTrackingConfidence:CFG.minTrackingConfidence});
      hands.onResults(onResults);
      active=true; status('Hand: พร้อมแล้ว • ชี้คำตอบ/ปุ่ม แล้วหนีบนิ้ว หรือชี้ค้าง'); loop();
    }catch(err){console.warn('[AIQuest S1 Hand] init failed',err);status('Hand: เริ่มไม่ได้ ใช้ touch/mouse แทน');}
  }

  function stop(){active=false; if(raf)cancelAnimationFrame(raf); raf=0; hideCursor(); status('');}

  async function loop(){
    if(!active)return;
    const v=video();
    if(isOpen()&&hands&&v&&v.readyState>=2){try{await hands.send({image:v});}catch(e){}}
    raf=requestAnimationFrame(loop);
  }

  function targetAt(sx,sy){
    const el=document.elementFromPoint(sx,sy);
    let t=el&&el.closest?el.closest(
      '.s1-ar-choice-v365b:not([disabled]),.s1-ar-choice-v365:not([disabled]),.s1-ar-choice-v364:not([disabled]),.s1-ar-choice-v362:not([disabled]),'+
      '#s1ArNextV365B:not([disabled]),#s1ArNextV365:not([disabled]),#s1ArNextV364:not([disabled]),#s1ArNextV362:not([disabled]),'+
      '#s1ArReplayV365B:not([disabled]),#s1ArReplayV365:not([disabled]),#s1ArReplayV364:not([disabled]),#s1ArReplayV362:not([disabled]),'+
      '#s1ArBackV365B:not([disabled]),#s1ArBackV365:not([disabled]),#s1ArBackV364:not([disabled]),#s1ArBackV362:not([disabled])'
    ):null;
    if(t)return t;

    const candidates=[
      's1ArNextV365B','s1ArNextV365','s1ArNextV364','s1ArNextV362',
      's1ArReplayV365B','s1ArReplayV365','s1ArReplayV364','s1ArReplayV362',
      's1ArBackV365B','s1ArBackV365','s1ArBackV364','s1ArBackV362'
    ].map($).filter(x=>x&&!x.disabled);

    for(const b of candidates){
      const r=b.getBoundingClientRect(),p=CFG.hitPad;
      if(sx>=r.left-p&&sx<=r.right+p&&sy>=r.top-p&&sy<=r.bottom+p)return b;
    }
    return null;
  }

  function onResults(results){
    if(!isOpen()){hideCursor();return;}
    const cursor=$('s1HandCursorV365B'), ring=$('s1HandDwellV365B');
    const lm=results&&results.multiHandLandmarks&&results.multiHandLandmarks[0];
    if(!lm||!lm[8]||!lm[4]){hideCursor();status('Hand: ไม่พบมือ • ยกมือให้อยู่ในกล้อง');return;}

    const it=lm[8], th=lm[4];
    let x=CFG.mirror?(1-it.x):it.x, y=it.y;
    x=Math.max(0,Math.min(1,x)); y=Math.max(0,Math.min(1,y));
    const sx=x*innerWidth, sy=y*innerHeight;

    const dx=it.x-th.x, dy=it.y-th.y, dz=(it.z||0)-(th.z||0);
    const pinch=Math.sqrt(dx*dx+dy*dy+dz*dz)<CFG.pinchThreshold;

    cursor.style.display='block'; cursor.style.left=sx+'px'; cursor.style.top=sy+'px'; cursor.classList.toggle('pinch',pinch);
    ring.style.display='block'; ring.style.left=sx+'px'; ring.style.top=sy+'px';

    const action=targetAt(sx,sy);
    if(!action){clearHover();ring.style.setProperty('--p','0deg');status('Hand: เลื่อนปลายนิ้วไปที่ตัวเลือกหรือปุ่ม');lastPinch=pinch;return;}

    if(action!==lastHover){clearHover();lastHover=action;hoverStart=Date.now();action.classList.add('hand-hover-v365b');}
    const dwell=Date.now()-hoverStart;
    ring.style.setProperty('--p',Math.min(360,Math.round(dwell/CFG.dwellMs*360))+'deg');

    const text=(action.textContent||'').trim();
    let label='เลือกคำตอบ';
    if(action.id.includes('Next'))label=text||'ข้อต่อไป';
    if(action.id.includes('Replay'))label='เล่นอีกครั้ง';
    if(action.id.includes('Back'))label='กลับ Mission';

    status(pinch?`Hand: pinch ${label}`:`Hand: ชี้ค้าง หรือหนีบนิ้วเพื่อ${label}`);

    if((pinch&&!lastPinch)||dwell>=CFG.dwellMs){action.click();clearHover();}
    lastPinch=pinch;
  }

  function watch(){
    ensureUI();
    const mo=new MutationObserver(()=>{
      if(isOpen()){
        const s=$('s1HandStatusV365B'); if(s)s.style.display='block';
        const v=video(); if(v&&v.srcObject&&!active)start();
      }else stop();
    });
    mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    setInterval(()=>{if(isOpen()){const v=video(); if(v&&v.srcObject&&!active)start();}else if(active)stop();},800);
  }

  window.AIQUEST_S1_HAND_HOTFIX={version:VERSION,start,stop,config:CFG};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',watch):watch();
  console.log('[AIQuest] '+VERSION+' loaded');
})();
