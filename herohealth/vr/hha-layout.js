// === /herohealth/vr/hha-layout.js ===
// HHA Unified Layout Helper
// ✅ VR button toggle (view-cvr) + fullscreen
// ✅ Measure HUD -> set --hha-play-* for spawn safe rect
// ✅ window.HHAPlayRect()

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const $ = (q)=>DOC.querySelector(q);

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  function px(n){ return Math.round(n) + 'px'; }

  function setVar(name, val){
    DOC.documentElement.style.setProperty(name, val);
  }

  function rectUnion(a,b){
    if(!a) return b;
    if(!b) return a;
    return {
      left: Math.min(a.left,b.left),
      top: Math.min(a.top,b.top),
      right: Math.max(a.right,b.right),
      bottom: Math.max(a.bottom,b.bottom),
    };
  }

  function safeGetRect(el){
    if(!el) return null;
    const r = el.getBoundingClientRect();
    if(!r || !isFinite(r.left)) return null;
    return { left:r.left, top:r.top, right:r.right, bottom:r.bottom };
  }

  function measurePlayRect(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;

    // elements by class (ทุกเกมใช้ชื่อเดียวกัน)
    const topbar = $('.hha-topbar');
    const quest  = $('.hha-quest');
    const power  = $('.hha-power');
    const coach  = $('.hha-coach');
    const vrbtn  = $('.hha-vrbtn');

    // union top region
    let topR = null;
    topR = rectUnion(topR, safeGetRect(topbar));
    topR = rectUnion(topR, safeGetRect(quest));

    // bottom region union
    let botR = null;
    botR = rectUnion(botR, safeGetRect(power));
    botR = rectUnion(botR, safeGetRect(coach));
    botR = rectUnion(botR, safeGetRect(vrbtn));

    const pad = 10;
    const leftPad = 16;
    const rightPad = 16;

    const top = clamp((topR ? topR.bottom : 140) + pad, 90, H-180);
    const bottom = clamp((H - (botR ? (H - botR.top) : 170)) - pad, 120, H-80);

    // left/right: กันทับ quest/coach ถ้า overlay กว้าง
    let rightInset = rightPad;
    if (quest){
      const qr = quest.getBoundingClientRect();
      rightInset = Math.max(rightInset, Math.max(0, W - qr.left) + 8);
    }
    if (coach){
      const cr = coach.getBoundingClientRect();
      rightInset = Math.max(rightInset, Math.max(0, W - cr.left) + 8);
    }

    setVar('--hha-play-top', px(top));
    setVar('--hha-play-bottom', px(H - bottom));
    setVar('--hha-play-left', px(leftPad));
    setVar('--hha-play-right', px(rightInset));

    return { x0:leftPad, x1:W-rightInset, y0:top, y1:bottom, W, H };
  }

  function HHAPlayRect(){
    // read vars if set (fast path)
    const cs = getComputedStyle(DOC.documentElement);
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;
    const top = parseFloat(cs.getPropertyValue('--hha-play-top')) || 150;
    const bottomInset = parseFloat(cs.getPropertyValue('--hha-play-bottom')) || 190;
    const left = parseFloat(cs.getPropertyValue('--hha-play-left')) || 16;
    const right = parseFloat(cs.getPropertyValue('--hha-play-right')) || 16;

    return { x0:left, x1:W-right, y0:top, y1:H-bottomInset, W, H };
  }

  function isFs(){
    return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
  }
  async function enterFs(){
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    }catch(_){}
  }
  async function exitFs(){
    try{
      if (DOC.exitFullscreen) await DOC.exitFullscreen();
      else if (DOC.webkitExitFullscreen) await DOC.webkitExitFullscreen();
    }catch(_){}
  }

  function setView(clsOn){
    DOC.body.classList.toggle('view-cvr', !!clsOn);
    measurePlayRect();
  }

  function ensureVrButton(){
    let wrap = $('.hha-vrbtn');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'hha-vrbtn';
    wrap.innerHTML = `
      <button id="hhaBtnVr">VR</button>
    `;
    DOC.body.appendChild(wrap);

    const btn = wrap.querySelector('#hhaBtnVr');
    btn.addEventListener('click', async ()=>{
      const on = !DOC.body.classList.contains('view-cvr');
      setView(on);
      btn.textContent = on ? 'EXIT VR' : 'VR';
      btn.classList.toggle('ghost', !on);
      if (on && !isFs()) await enterFs();
      if (!on && isFs()) await exitFs();
    }, { passive:true });

    return wrap;
  }

  function boot(){
    ensureVrButton();
    measurePlayRect();

    let t = null;
    const onResize = ()=>{
      clearTimeout(t);
      t = setTimeout(measurePlayRect, 80);
    };
    root.addEventListener('resize', onResize, { passive:true });
    DOC.addEventListener('visibilitychange', ()=>setTimeout(measurePlayRect, 80), { passive:true });

    // expose
    root.HHAPlayRect = HHAPlayRect;
    root.HHALayout = { measure: measurePlayRect, setView };
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();

})(typeof window !== 'undefined' ? window : globalThis);