// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (GoodJunk Boss++ friendly)
// listens: hha:boss, hha:storm, hha:judge, hha:time
(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  const qs = (s)=>DOC.querySelector(s);

  function ensureFxLayer(){
    let el = qs('.hha-fx-director-layer');
    if(el) return el;
    el = DOC.createElement('div');
    el.className = 'hha-fx-director-layer';
    el.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:199;
    `;
    const flash = DOC.createElement('div');
    flash.className = 'hha-fx-flash';
    flash.style.cssText = `
      position:absolute; inset:0; opacity:0;
      background: radial-gradient(circle at 50% 30%, rgba(167,139,250,.22), rgba(2,6,23,0) 55%),
                  radial-gradient(circle at 50% 70%, rgba(239,68,68,.16), rgba(2,6,23,0) 62%);
      transition: opacity .14s ease;
    `;
    const vign = DOC.createElement('div');
    vign.className = 'hha-fx-vignette';
    vign.style.cssText = `
      position:absolute; inset:-2px; opacity:0;
      background: radial-gradient(circle at 50% 45%, rgba(0,0,0,0), rgba(0,0,0,.35) 70%, rgba(0,0,0,.55));
      transition: opacity .18s ease;
    `;
    el.appendChild(flash);
    el.appendChild(vign);
    DOC.body.appendChild(el);
    return el;
  }

  function pulseFlash(strength=1){
    const layer = ensureFxLayer();
    const flash = layer.querySelector('.hha-fx-flash');
    if(!flash) return;
    flash.style.opacity = String(Math.min(0.85, 0.25 + 0.35*strength));
    setTimeout(()=>{ try{ flash.style.opacity='0'; }catch(_){} }, 120);
  }

  function setVignette(on, strength=1){
    const layer = ensureFxLayer();
    const v = layer.querySelector('.hha-fx-vignette');
    if(!v) return;
    v.style.opacity = on ? String(Math.min(0.75, 0.18 + 0.22*strength)) : '0';
  }

  function shake(ms=180, cls='hha-fx-shake'){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>DOC.body.classList.remove(cls), ms);
    }catch(_){}
  }

  // add tiny shake keyframes (once)
  (function injectCss(){
    const id='hha-fx-director-css';
    if(DOC.getElementById(id)) return;
    const st=DOC.createElement('style');
    st.id=id;
    st.textContent = `
      @keyframes hhaShake {
        0%{ transform: translateX(0) }
        25%{ transform: translateX(-4px) }
        50%{ transform: translateX(4px) }
        75%{ transform: translateX(-3px) }
        100%{ transform: translateX(0) }
      }
      body.hha-fx-shake{ animation: hhaShake .18s ease; }
      body.hha-fx-shake2{ animation: hhaShake .26s ease; }
    `;
    DOC.head.appendChild(st);
  })();

  // Phase2 pulser
  let phase2Timer = null;
  function startPhase2Pulse(sec=6){
    stopPhase2Pulse();
    const tEnd = Date.now() + Math.max(1, sec)*1000;
    phase2Timer = setInterval(()=>{
      if(Date.now() >= tEnd){
        stopPhase2Pulse();
        return;
      }
      pulseFlash(1.15);
      shake(120,'hha-fx-shake');
    }, 520); // ถี่พอดี “เร้าใจ” แต่ไม่เวียนหัว
  }
  function stopPhase2Pulse(){
    if(phase2Timer){
      clearInterval(phase2Timer);
      phase2Timer = null;
    }
  }

  // Listen boss
  WIN.addEventListener('hha:boss', (ev)=>{
    const d = ev?.detail || {};
    const on = !!d.on;
    if(on){
      pulseFlash(1.2);
      shake(240,'hha-fx-shake2');
      // ช่วยให้ safezone update ถ้า html expose ไว้
      try{ if(typeof WIN.HHA_UPDATE_SAFEZONE==='function') WIN.HHA_UPDATE_SAFEZONE(); }catch(_){}
      if(d.phase === 2){
        startPhase2Pulse(Number(d.phase2Sec)||6);
      }else{
        stopPhase2Pulse();
      }
    }else{
      stopPhase2Pulse();
      setVignette(false);
      pulseFlash(0.6);
      try{ if(typeof WIN.HHA_UPDATE_SAFEZONE==='function') WIN.HHA_UPDATE_SAFEZONE(); }catch(_){}
    }
  }, {passive:true});

  // Listen storm
  WIN.addEventListener('hha:storm', (ev)=>{
    const d = ev?.detail || {};
    const on = !!d.on;
    setVignette(on, 1.0);
    if(on){
      pulseFlash(0.9);
      shake(160,'hha-fx-shake');
    }
  }, {passive:true});

  // Judge sparks (tiny)
  WIN.addEventListener('hha:judge', (ev)=>{
    const d = ev?.detail || {};
    const t = String(d.type||'');
    if(t==='bad' || t==='miss'){
      pulseFlash(0.85);
    }else if(t==='perfect'){
      pulseFlash(0.55);
    }
  }, {passive:true});

  // Lowtime tick helper (optional)
  WIN.addEventListener('hha:time', (ev)=>{
    const t = Number(ev?.detail?.timeLeftSec ?? ev?.detail?.t ?? 999);
    if(t <= 5 && t > 0){
      // อย่าถี่เกิน: ให้ lowTimeOverlay ของคุณทำหลักอยู่แล้ว
      // ที่นี่แค่เติมจังหวะให้รู้สึก "บีบ"
      if(Math.abs(t - Math.round(t)) < 0.04) pulseFlash(0.25);
    }
  }, {passive:true});
})();