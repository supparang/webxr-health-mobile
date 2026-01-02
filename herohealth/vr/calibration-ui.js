// === /herohealth/vr/calibration-ui.js ===
// HHA Calibration UI — PRODUCTION
// Purpose:
// - Cardboard/cVR helper: fullscreen, landscape hint, recenter button
// - Ensure HUD doesn't block VR UI buttons (ENTER VR / EXIT / RECENTER)
// - Minimal + safe: no dependencies; optional integration with vr-ui.js
//
// Usage:
// <script src="../vr/calibration-ui.js" defer></script>
// then in game boot: window.HHA_CALIB?.mount({ hub, mode:'hydration' })

(function(root){
  'use strict';
  const DOC = root.document;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
  }
  function isCVR(){
    try{ return DOC.body.classList.contains('view-cvr'); }catch(_){ return false; }
  }
  function isCardboard(){
    try{ return DOC.body.classList.contains('cardboard'); }catch(_){ return false; }
  }

  async function enterFullscreen(){
    try{
      const el = DOC.documentElement;
      if (!DOC.fullscreenElement && el.requestFullscreen){
        await el.requestFullscreen({ navigationUI:'hide' });
      }
    }catch(_){}
  }
  async function lockLandscape(){
    try{
      const o = screen.orientation;
      if (o && o.lock) await o.lock('landscape');
    }catch(_){}
  }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, {detail})); }catch(_){}
  }

  function ensureStyle(){
    if (DOC.getElementById('hha-calib-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-calib-style';
    st.textContent = `
      .hha-calib{
        position:fixed; left:12px; right:12px;
        top: calc(12px + env(safe-area-inset-top,0px));
        z-index: 96;
        pointer-events:none;
        display:flex;
        justify-content:space-between;
        gap:12px;
      }
      .hha-calib .card{
        pointer-events:auto;
        flex: 0 1 auto;
        max-width:min(560px, 100%);
        background: rgba(2,6,23,.70);
        border:1px solid rgba(148,163,184,.18);
        border-radius: 16px;
        backdrop-filter: blur(10px);
        box-shadow: 0 18px 70px rgba(0,0,0,.42);
        padding:10px 12px;
      }
      .hha-calib .row{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .hha-calib .t{
        font: 900 12px/1.15 system-ui;
        color: rgba(229,231,235,.92);
        letter-spacing:.2px;
        margin: 0 0 6px 0;
      }
      .hha-calib .sub{
        font: 700 11px/1.25 system-ui;
        color: rgba(148,163,184,.95);
        margin:0;
        white-space:pre-line;
      }
      .hha-calib .btn{
        appearance:none;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(15,23,42,.62);
        color: rgba(229,231,235,.92);
        padding:8px 10px;
        border-radius: 999px;
        font: 900 12px/1 system-ui;
        cursor:pointer;
      }
      .hha-calib .btn.cyan{
        border-color: rgba(34,211,238,.26);
        background: rgba(34,211,238,.12);
      }
      .hha-calib .btn.green{
        border-color: rgba(34,197,94,.26);
        background: rgba(34,197,94,.14);
      }
      .hha-calib .btn.warn{
        border-color: rgba(245,158,11,.26);
        background: rgba(245,158,11,.14);
      }
      .hha-calib.hide{ display:none; }

      /* Reserve top space so HUD won't overlap VR UI buttons */
      body.hha-calib-on{
        --hha-top-reserve: 72px;
      }
      .hud{ padding-top: calc(12px + env(safe-area-inset-top,0px) + var(--hha-top-reserve,0px)); }
    `;
    DOC.head.appendChild(st);
  }

  function mount(opts={}){
    ensureStyle();

    const hub = String(opts.hub || qs('hub','../hub.html'));
    const mode = String(opts.mode || 'game');
    const show = isCardboard() || isCVR();
    if (!show) return { hide(){} };

    DOC.body.classList.add('hha-calib-on');

    const wrap = DOC.createElement('div');
    wrap.className = 'hha-calib';

    const card = DOC.createElement('div');
    card.className = 'card';

    const title = DOC.createElement('p');
    title.className='t';
    title.textContent = '🧭 Calibration / Recenter';

    const sub = DOC.createElement('p');
    sub.className='sub';
    sub.textContent =
      (isCVR()
        ? 'โหมด cVR: ยิงจาก 🎯 กลางจอ (แตะเพื่อยิง)\nแนะนำ Fullscreen + หมุนเป็นแนวนอน'
        : 'โหมด Cardboard: จอแยกซ้าย–ขวา\nแนะนำ Fullscreen + แนวนอน แล้วกด Recenter');

    const row = DOC.createElement('div');
    row.className='row';

    const bFS = DOC.createElement('button');
    bFS.className='btn cyan';
    bFS.textContent='⛶ Fullscreen';
    bFS.addEventListener('click', async()=>{
      await enterFullscreen();
      await lockLandscape();
      emit('hha:calib', {type:'fullscreen'});
    });

    const bLand = DOC.createElement('button');
    bLand.className='btn';
    bLand.textContent='↔ แนวนอน';
    bLand.addEventListener('click', async()=>{
      await lockLandscape();
      emit('hha:calib', {type:'landscape'});
    });

    const bRec = DOC.createElement('button');
    bRec.className='btn green';
    bRec.textContent='🎯 Recenter';
    bRec.addEventListener('click', ()=>{
      // Prefer vr-ui.js recenter if present
      emit('hha:recenter', {source:'calibration'});
      // also try to click VRUI button if exists
      try{
        const btn = DOC.querySelector('[data-hha-vrui="recenter"], #btnRecenter, .hha-vrui-recenter');
        btn && btn.click && btn.click();
      }catch(_){}
    });

    const bBack = DOC.createElement('button');
    bBack.className='btn warn';
    bBack.textContent='🏠 HUB';
    bBack.addEventListener('click', ()=> location.href = hub);

    const bHide = DOC.createElement('button');
    bHide.className='btn';
    bHide.textContent='✖ ซ่อน';
    bHide.addEventListener('click', ()=>{
      wrap.classList.add('hide');
      DOC.body.classList.remove('hha-calib-on');
      emit('hha:calib', {type:'hide'});
    });

    row.appendChild(bFS);
    row.appendChild(bLand);
    row.appendChild(bRec);
    row.appendChild(bBack);
    row.appendChild(bHide);

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(row);

    wrap.appendChild(card);
    DOC.body.appendChild(wrap);

    // Auto-hide after a bit when game starts (optional)
    root.addEventListener('hha:start', ()=>{
      setTimeout(()=>{
        // keep for 6s then collapse to not annoy
        try{
          wrap.classList.add('hide');
          DOC.body.classList.remove('hha-calib-on');
        }catch(_){}
      }, 6000);
    }, { once:true });

    return {
      hide(){
        try{
          wrap.classList.add('hide');
          DOC.body.classList.remove('hha-calib-on');
        }catch(_){}
      }
    };
  }

  root.HHA_CALIB = { mount };

})(window);