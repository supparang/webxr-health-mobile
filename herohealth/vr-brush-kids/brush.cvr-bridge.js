/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.cvr-bridge.js
 * PATCH v20260511-P33-BRUSH-KIDS-CVR-BRIDGE
 *
 * Purpose:
 * - รองรับ view=cvr / cardboard / vr
 * - เพิ่ม crosshair กลางจอ
 * - แตะหน้าจอ / กด Space / กด Enter = แปรงจากกลางจอ
 * - ส่ง event ไปยัง element ใต้ crosshair
 * - ใช้ร่วมกับ brush.flow-guard.js ได้
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260511-P33-BRUSH-KIDS-CVR-BRIDGE';

  function qs(){
    try{ return new URLSearchParams(WIN.location.search || ''); }
    catch(_){ return new URLSearchParams(); }
  }

  function param(k, fallback){
    const p = qs();
    const v = p.get(k);
    return v === null || v === '' ? fallback : v;
  }

  function isCVR(){
    const view = String(param('view', '')).toLowerCase();
    return view === 'cvr' || view === 'cardboard' || view === 'vr' || param('cvr','') === '1';
  }

  function log(){
    try{ console.log('[BrushCVR]', PATCH_ID, ...arguments); }catch(_){}
  }

  function center(){
    return {
      x: Math.round(WIN.innerWidth / 2),
      y: Math.round(WIN.innerHeight / 2)
    };
  }

  function elementAtCenter(){
    const c = center();

    let el = null;
    try{ el = DOC.elementFromPoint(c.x, c.y); }catch(_){}

    if(!el || el === DOC.documentElement || el === DOC.body){
      el =
        DOC.querySelector('[data-brush-zone].active') ||
        DOC.querySelector('[data-brush-zone]') ||
        DOC.querySelector('.brush-zone.active') ||
        DOC.querySelector('.brush-zone') ||
        DOC.querySelector('.tooth-zone.active') ||
        DOC.querySelector('.tooth-zone') ||
        DOC.querySelector('canvas') ||
        DOC.body;
    }

    return el;
  }

  function makePointerEvent(type, x, y){
    try{
      return new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        pageX: x,
        pageY: y,
        buttons: type === 'pointerup' ? 0 : 1,
        button: 0
      });
    }catch(_){
      try{
        const ev = DOC.createEvent('MouseEvents');
        ev.initMouseEvent(
          type.replace('pointer','mouse'),
          true,
          true,
          WIN,
          1,
          x,
          y,
          x,
          y,
          false,
          false,
          false,
          false,
          0,
          null
        );
        return ev;
      }catch(__){
        return null;
      }
    }
  }

  function dispatchBrushPulse(source){
    const c = center();
    const el = elementAtCenter();

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brushTap', {
        detail: {
          source: source || 'cvr',
          patch: PATCH_ID,
          x: c.x,
          y: c.y,
          target: el && (el.id || el.className || el.tagName)
        }
      }));
    }catch(_){}

    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', {
        detail: {
          source: 'brush-cvr',
          patch: PATCH_ID,
          x: c.x,
          y: c.y
        }
      }));
    }catch(_){}

    if(el){
      ['pointerdown','pointermove','pointerup','click'].forEach(type => {
        const ev = makePointerEvent(type, c.x, c.y);
        try{ if(ev) el.dispatchEvent(ev); }catch(_){}
      });
    }

    callKnownBrushHooks(c.x, c.y, source);
    flashCrosshair();
  }

  function callKnownBrushHooks(x, y, source){
    const candidates = [
      'brushAt',
      'BrushAt',
      'HHA_BRUSH_AT',
      'HHA_brushAt',
      'onBrushAt',
      'handleBrushAt'
    ];

    for(const name of candidates){
      try{
        if(typeof WIN[name] === 'function'){
          WIN[name](x, y, {
            source: source || 'cvr',
            patch: PATCH_ID,
            view: 'cvr'
          });
          return true;
        }
      }catch(e){
        console.warn('[BrushCVR] hook failed:', name, e);
      }
    }

    try{
      if(WIN.BrushGame && typeof WIN.BrushGame.brushAt === 'function'){
        WIN.BrushGame.brushAt(x, y, {
          source: source || 'cvr',
          patch: PATCH_ID,
          view: 'cvr'
        });
        return true;
      }
    }catch(e){}

    try{
      if(WIN.HHA_BRUSH && typeof WIN.HHA_BRUSH.brushAt === 'function'){
        WIN.HHA_BRUSH.brushAt(x, y, {
          source: source || 'cvr',
          patch: PATCH_ID,
          view: 'cvr'
        });
        return true;
      }
    }catch(e){}

    return false;
  }

  function ensureStyle(){
    if(DOC.getElementById('hha-brush-cvr-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-brush-cvr-style';
    style.textContent = `
      html.hha-brush-cvr,
      body.hha-brush-cvr{
        overflow:hidden;
        touch-action:manipulation;
      }

      .hha-brush-cvr #hha-brush-cvr-layer{
        position:fixed;
        inset:0;
        z-index:999997;
        pointer-events:none;
      }

      #hha-brush-cvr-crosshair{
        position:fixed;
        left:50%;
        top:50%;
        width:42px;
        height:42px;
        margin-left:-21px;
        margin-top:-21px;
        border-radius:999px;
        border:4px solid rgba(255,255,255,.96);
        box-shadow:
          0 0 0 4px rgba(20,80,120,.22),
          0 10px 28px rgba(0,0,0,.20);
        pointer-events:none;
        z-index:999999;
        transform:scale(1);
        transition:transform .08s ease, box-shadow .08s ease;
      }

      #hha-brush-cvr-crosshair::before,
      #hha-brush-cvr-crosshair::after{
        content:"";
        position:absolute;
        background:rgba(255,255,255,.98);
        border-radius:999px;
        left:50%;
        top:50%;
        transform:translate(-50%,-50%);
      }

      #hha-brush-cvr-crosshair::before{
        width:8px;
        height:8px;
      }

      #hha-brush-cvr-crosshair::after{
        width:2px;
        height:58px;
        opacity:.7;
      }

      #hha-brush-cvr-crosshair .hha-cross-line{
        position:absolute;
        width:58px;
        height:2px;
        left:50%;
        top:50%;
        transform:translate(-50%,-50%);
        border-radius:999px;
        background:rgba(255,255,255,.7);
      }

      #hha-brush-cvr-crosshair.is-fire{
        transform:scale(.84);
        box-shadow:
          0 0 0 7px rgba(255,217,93,.45),
          0 12px 34px rgba(0,0,0,.22);
      }

      #hha-brush-cvr-hint{
        position:fixed;
        left:50%;
        bottom:calc(18px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:999999;
        max-width:min(92vw,520px);
        padding:10px 14px;
        border-radius:999px;
        background:rgba(255,255,255,.92);
        border:2px solid rgba(157,230,255,.9);
        box-shadow:0 12px 28px rgba(20,80,120,.18);
        color:#17384f;
        font-weight:1000;
        font-size:13px;
        text-align:center;
        pointer-events:none;
      }

      @media (max-width:640px){
        #hha-brush-cvr-hint{
          font-size:12px;
          bottom:calc(12px + env(safe-area-inset-bottom,0px));
        }
      }
    `;
    DOC.head.appendChild(style);
  }

  function mountLayer(){
    if(DOC.getElementById('hha-brush-cvr-layer')) return;

    DOC.documentElement.classList.add('hha-brush-cvr');
    if(DOC.body) DOC.body.classList.add('hha-brush-cvr');

    const layer = DOC.createElement('div');
    layer.id = 'hha-brush-cvr-layer';
    layer.setAttribute('aria-hidden', 'true');

    const cross = DOC.createElement('div');
    cross.id = 'hha-brush-cvr-crosshair';

    const line = DOC.createElement('div');
    line.className = 'hha-cross-line';
    cross.appendChild(line);

    const hint = DOC.createElement('div');
    hint.id = 'hha-brush-cvr-hint';
    hint.textContent = '🎯 Cardboard: เล็งคราบฟันไว้กลางจอ แล้วแตะหน้าจอเพื่อแปรง';

    layer.appendChild(cross);
    layer.appendChild(hint);
    DOC.body.appendChild(layer);

    setTimeout(() => {
      try{ hint.style.opacity = '.72'; }catch(_){}
    }, 2600);
  }

  function flashCrosshair(){
    const cross = DOC.getElementById('hha-brush-cvr-crosshair');
    if(!cross) return;
    cross.classList.add('is-fire');
    clearTimeout(cross.__hhaFireTimer);
    cross.__hhaFireTimer = setTimeout(() => {
      try{ cross.classList.remove('is-fire'); }catch(_){}
    }, 95);
  }

  function bindInput(){
    let lastFire = 0;

    function fire(source, ev){
      const now = Date.now();
      if(now - lastFire < 90) return;
      lastFire = now;

      try{
        if(ev && ev.preventDefault) ev.preventDefault();
        if(ev && ev.stopPropagation) ev.stopPropagation();
      }catch(_){}

      dispatchBrushPulse(source);
    }

    DOC.addEventListener('click', ev => fire('click', ev), true);
    DOC.addEventListener('touchend', ev => fire('touchend', ev), { capture:true, passive:false });
    DOC.addEventListener('pointerup', ev => fire('pointerup', ev), true);

    DOC.addEventListener('keydown', ev => {
      const key = String(ev.key || '').toLowerCase();
      if(key === ' ' || key === 'enter'){
        fire('keyboard', ev);
      }
    }, true);

    WIN.addEventListener('hha:shoot', ev => {
      const src = ev && ev.detail && ev.detail.source;
      if(src === 'brush-cvr') return;
      dispatchBrushPulse('hha:shoot');
    });
  }

  function expose(){
    WIN.HHA_BRUSH_CVR = Object.assign({}, WIN.HHA_BRUSH_CVR || {}, {
      patch: PATCH_ID,
      fire: () => dispatchBrushPulse('api'),
      isCVR
    });
  }

  function boot(){
    if(!isCVR()){
      expose();
      return;
    }

    ensureStyle();
    mountLayer();
    bindInput();
    expose();

    log('booted');
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();
