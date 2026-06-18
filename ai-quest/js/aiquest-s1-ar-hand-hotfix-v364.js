/* CSAI2102 AI Quest — S1 AR Hand Tracking Hotfix
   /ai-quest/js/aiquest-s1-ar-hand-hotfix-v364.js
   v3.6.4-s1-ar-hand-next-support-universal
   Works with v362 and v364 S1 AR practice files.
*/
(function(){
  'use strict';
  const VERSION='v3.6.4-s1-ar-hand-next-support-universal';
  const HANDS_URL='https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
  const CFG={mirror:true,dwellMs:850,pinchThreshold:.075,minDetectionConfidence:.45,minTrackingConfidence:.45,hitPad:46};
  let hands=null,active=false,raf=0,lastHover=null,hoverStart=0,lastPinch=false;
  const $=id=>document.getElementById(id);

  function loadScript(src){
    return new Promise((res,rej)=>{
      if(document.querySelector(`script[src="${src}"]`)) return res();
      const s=document.createElement('script');
      s.src=src;s.crossOrigin='anonymous';s.onload=res;s.onerror=rej;document.head.appendChild(s);
    });
  }

  function injectStyle(){
    if($('s1HandHotfixStyleV364'))return;
    const css=document.createElement('style');
    css.id='s1HandHotfixStyleV364';
    css.textContent=`
      .s1-hand-cursor-v364{position:fixed;left:0;top:0;width:38px;height:38px;border:3px solid #67e8f9;border-radius:999px;z-index:10020;pointer-events:none;transform:translate(-50%,-50%);display:none;background:rgba(255,255,255,.08);box-shadow:0 0 0 9px rgba(34,211,238,.16),0 0 26px rgba(34,211,238,.46)}
      .s1-hand-cursor-v364.pinch{width:50px;height:50px;border-color:#86efac;box-shadow:0 0 0 12px rgba(34,197,94,.22),0 0 34px rgba(34,197,94,.58)}
      .s1-hand-status-v364{position:fixed;left:12px;top:calc(66px + env(safe-area-inset-top,0px));z-index:10021;padding:8px 12px;border-radius:999px;color:#e0f2fe;background:rgba(15,23,42,.72);border:1px solid rgba(255,255,255,.18);font-size:12px;font-weight:900;backdrop-filter:blur(10px);display:none}
      .s1-hand-dwell-v364{position:fixed;left:0;top:0;width:64px;height:64px;border-radius:999px;z-index:10019;pointer-events:none;transform:translate(-50%,-50%);display:none;background:conic-gradient(#86efac var(--p,0deg),rgba(255,255,255,.14) 0deg);-webkit-mask:radial-gradient(circle,transparent 54%,#000 55%);mask:radial-gradient(circle,transparent 54%,#000 55%)}
      .s1-ar-choice-v362.hand-hover-v364,.s1-ar-choice-v364.hand-hover-v364,#s1ArNextV362.hand-hover-v364,#s1ArNextV364.hand-hover-v364,#s1ArReplayV362.hand-hover-v364,#s1ArReplayV364.hand-hover-v364,#s1ArBackV362.hand-hover-v364,#s1ArBackV364.hand-hover-v364{outline:3px solid rgba(34,211,238,.95)!important;box-shadow:0 0 0 7px rgba(34,211,238,.18),0 0 30px rgba(34,211,238,.42)!important;transform:translateY(-1px)}
      .s1-ar-choice-v362.hand-hover-v364::after,.s1-ar-choice-v364.hand-hover-v364::after,#s1ArNextV362.hand-hover-v364::after,#s1ArNextV364.hand-hover-v364::after,#s1ArReplayV362.hand-hover-v364::after,#s1ArReplayV364.hand-hover-v364::after,#s1ArBackV362.hand-hover-v364::after,#s1ArBackV364.hand-hover-v364::after{content:'ชี้ค้าง / หนีบนิ้วเพื่อเลือก';position:absolute;right:10px;top:-13px;padding:4px 8px;border-radius:999px;background:#06b6d4;color:#042f2e;font-size:10px;font-weight:1000;white-space:nowrap;z-index:2}
      #s1ArNextV362,#s1ArNextV364,#s1ArReplayV362,#s1ArReplayV364,#s1ArBackV362,#s1ArBackV364{position:relative}
    `;
    document.head.appendChild(css);
  }

  function ensureUI(){
    injectStyle();
    if(!$('s1HandCursorV364')){
      const c=document.createElement('div');c.id='s1HandCursorV364';c.className='s1-hand-cursor-v364';document.body.appendChild(c);
    }
    if(!$('s1HandDwellV364')){
      const d=document.createElement('div');d.id='s1HandDwellV364';d.className='s1-hand-dwell-v364';document.body.appendChild(d);
    }
    if(!$('s1HandStatusV364')){
      const s=document.createElement('div');s.id='s1HandStatusV364';s.className='s1-hand-status-v364';s.textContent='Hand: loading…';document.body.appendChild(s);
    }
  }

  function getPanel(){return $('s1ArPanelV364')||$('s1ArPanelV362')}
  function isOpen(){const p=getPanel();return !!(p&&p.classList.contains('open'))}
  function getVideo(){return $('s1ArVideoV364')||$('s1ArVideoV362')}
  function status(msg){const s=$('s1HandStatusV364');if(s){s.style.display=isOpen()?'block':'none';s.textContent=msg||''}}
  function clearHover(){if(lastHover)lastHover.classList.remove('hand-hover-v364');lastHover=null;hoverStart=0;const r=$('s1HandDwellV364');if(r)r.style.setProperty('--p','0deg')}
  function hideCursor(){const c=$('s1HandCursorV364'),d=$('s1HandDwellV364');if(c)c.style.display='none';if(d)d.style.display='none';clearHover()}

  async function initHands(){
    ensureUI();
    if(window.Hands)return true;
    try{await loadScript(HANDS_URL);return !!window.Hands}
    catch(e){console.warn('[AIQuest S1 Hand] MediaPipe load failed',e);status('Hand: โหลด MediaPipe ไม่ได้ ใช้ touch/mouse แทน');return false}
  }

  async function start(){
    ensureUI();
    if(active)return;
    if(!await initHands())return;
    const v=getVideo();
    if(!v||!v.srcObject){status('Hand: ยังไม่พบกล้อง รอเปิด AR ก่อน');return}
    try{
      hands=new window.Hands({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
      hands.setOptions({maxNumHands:1,modelComplexity:1,minDetectionConfidence:CFG.minDetectionConfidence,minTrackingConfidence:CFG.minTrackingConfidence});
      hands.onResults(onResults);
      active=true;status('Hand: พร้อมแล้ว • ชี้คำตอบ/ปุ่ม แล้วหนีบนิ้ว หรือชี้ค้าง');loop();
    }catch(e){console.warn('[AIQuest S1 Hand] init failed',e);status('Hand: เริ่มไม่ได้ ใช้ touch/mouse แทน')}
  }

  function stop(){
    active=false;if(raf)cancelAnimationFrame(raf);raf=0;hideCursor();status('');
  }

  async function loop(){
    if(!active)return;
    const v=getVideo();
    if(isOpen()&&hands&&v&&v.readyState>=2){try{await hands.send({image:v})}catch(e){}}
    raf=requestAnimationFrame(loop);
  }

  function targetAt(sx,sy){
    const el=document.elementFromPoint(sx,sy);
    let t=el&&el.closest?el.closest(
      '.s1-ar-choice-v364:not([disabled]),.s1-ar-choice-v362:not([disabled]),'+
      '#s1ArNextV364:not([disabled]),#s1ArNextV362:not([disabled]),'+
      '#s1ArReplayV364:not([disabled]),#s1ArReplayV362:not([disabled]),'+
      '#s1ArBackV364:not([disabled]),#s1ArBackV362:not([disabled])'
    ):null;
    if(t)return t;
    const buttons=[$('s1ArNextV364'),$('s1ArNextV362'),$('s1ArReplayV364'),$('s1ArReplayV362'),$('s1ArBackV364'),$('s1ArBackV362')].filter(x=>x&&!x.disabled);
    for(const b of buttons){
      const r=b.getBoundingClientRect(),p=CFG.hitPad;
      if(sx>=r.left-p&&sx<=r.right+p&&sy>=r.top-p&&sy<=r.bottom+p)return b;
    }
    return null;
  }

  function onResults(results){
    if(!isOpen()){hideCursor();return}
    const cursor=$('s1HandCursorV364'),ring=$('s1HandDwellV364');
    const lm=results&&results.multiHandLandmarks&&results.multiHandLandmarks[0];
    if(!lm||!lm[8]||!lm[4]){hideCursor();status('Hand: ไม่พบมือ • ยกมือให้อยู่ในกล้อง');return}

    const it=lm[8],th=lm[4];
    let x=CFG.mirror?(1-it.x):it.x,y=it.y;
    x=Math.max(0,Math.min(1,x));y=Math.max(0,Math.min(1,y));
    const sx=x*innerWidth,sy=y*innerHeight;
    const dx=it.x-th.x,dy=it.y-th.y,dz=(it.z||0)-(th.z||0);
    const pinch=Math.sqrt(dx*dx+dy*dy+dz*dz)<CFG.pinchThreshold;

    cursor.style.display='block';cursor.style.left=sx+'px';cursor.style.top=sy+'px';cursor.classList.toggle('pinch',pinch);
    ring.style.display='block';ring.style.left=sx+'px';ring.style.top=sy+'px';

    const action=targetAt(sx,sy);
    if(!action){clearHover();ring.style.setProperty('--p','0deg');status('Hand: เลื่อนปลายนิ้วไปที่ตัวเลือกหรือปุ่ม');lastPinch=pinch;return}

    if(action!==lastHover){clearHover();lastHover=action;hoverStart=Date.now();action.classList.add('hand-hover-v364')}
    const dwell=Date.now()-hoverStart;
    ring.style.setProperty('--p',Math.min(360,Math.round(dwell/CFG.dwellMs*360))+'deg');

    const text=(action.textContent||'').trim();
    const label=action.id.includes('Next')?(text||'ข้อต่อไป'):action.id.includes('Replay')?'เล่นอีกครั้ง':action.id.includes('Back')?'กลับ Mission':'เลือกคำตอบ';
    status(pinch?`Hand: pinch ${label}`:`Hand: ชี้ค้าง หรือหนีบนิ้วเพื่อ${label}`);

    if((pinch&&!lastPinch)||dwell>=CFG.dwellMs){action.click();clearHover()}
    lastPinch=pinch;
  }

  function watch(){
    ensureUI();
    const mo=new MutationObserver(()=>{
      if(isOpen()){
        const s=$('s1HandStatusV364');if(s)s.style.display='block';
        const v=getVideo();if(v&&v.srcObject&&!active)start();
      }else stop();
    });
    mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    setInterval(()=>{if(isOpen()){const v=getVideo();if(v&&v.srcObject&&!active)start()}else if(active)stop()},800);
  }

  window.AIQUEST_S1_HAND_HOTFIX={version:VERSION,start,stop,config:CFG};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',watch):watch();
  console.log('[AIQuest] '+VERSION+' loaded');
})();
