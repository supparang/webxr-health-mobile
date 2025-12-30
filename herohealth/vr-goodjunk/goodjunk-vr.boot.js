// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Boot — cache-bust safe import + VR OK starts + on-screen error if crash

'use strict';

function qp(name, fallback=null){
  try{ const u=new URL(location.href); const v=u.searchParams.get(name); return (v==null||v==='')?fallback:v; }
  catch(_){ return fallback; }
}
function toInt(v,d){ v=Number(v); return Number.isFinite(v)?(v|0):d; }
function toStr(v,d){ v=String(v??'').trim(); return v? v : d; }

function setHudMeta(t){ const el=document.getElementById('hudMeta'); if(el) el.textContent=t; }
function setStartMeta(t){ const el=document.getElementById('startMeta'); if(el) el.textContent=t; }
function showStart(){ const o=document.getElementById('startOverlay'); if(o){ o.style.display='flex'; o.style.pointerEvents='auto'; } }
function hideStart(){ const o=document.getElementById('startOverlay'); if(o){ o.style.display='none'; o.style.pointerEvents='none'; } }

function hardFail(msg, err){
  console.error('[BOOT FAIL]', msg, err||'');
  setHudMeta(`❌ ${msg}`);
  setStartMeta(`ERROR: ${msg}${err? ' | '+(err?.message||String(err)) : ''}`);
  showStart();
}

function setView(mode){
  document.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  document.body.classList.add(`view-${mode}`);
  const eyeR = document.getElementById('eyeR');
  if (eyeR) eyeR.setAttribute('aria-hidden', (mode==='pc'||mode==='mobile') ? 'true' : 'false');
}

function isMobileLike(){
  const w=innerWidth||360, h=innerHeight||640;
  const coarse = (matchMedia && matchMedia('(pointer: coarse)').matches);
  return coarse || (Math.min(w,h) < 520);
}

function wireViewButtons(begin){
  const btnPC=document.getElementById('btnViewPC');
  const btnM=document.getElementById('btnViewMobile');
  const btnVR=document.getElementById('btnViewVR');
  const btnCVR=document.getElementById('btnViewCVR');
  const btnFS=document.getElementById('btnEnterFS');
  const btnEnterVR=document.getElementById('btnEnterVR');

  const apply = async (m)=>{
    setView(m);
    if (m==='vr' || m==='cvr') await showVrHintIfNeeded(begin);
  };

  if(btnPC) btnPC.onclick=()=>apply('pc');
  if(btnM) btnM.onclick=()=>apply('mobile');
  if(btnVR) btnVR.onclick=()=>apply('vr');
  if(btnCVR) btnCVR.onclick=()=>apply('cvr');

  if(btnFS) btnFS.onclick=async()=>{
    try{ if(!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); }catch(_){}
  };

  if(btnEnterVR) btnEnterVR.onclick=async()=>{
    const m=isMobileLike()? 'cvr':'vr';
    await apply(m);
    try{ if(!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); }catch(_){}
    begin?.('enter_vr');
  };
}

function showStartOverlay(metaText, begin){
  setStartMeta(metaText||'—');
  const o=document.getElementById('startOverlay');
  const b=document.getElementById('btnStart');
  if(!o||!b){ begin?.('no_start_overlay'); return; }
  showStart();
  b.onclick=()=>{ hideStart(); begin?.('btn_start'); };
}

function showVrHintIfNeeded(begin){
  const hint=document.getElementById('vrHint');
  const ok=document.getElementById('btnVrOk');
  if(!hint||!ok) return Promise.resolve();

  try{ if(localStorage.getItem('GJ_VR_HINT_OK')==='1') return Promise.resolve(); }catch(_){}
  hint.hidden=false;

  return new Promise((resolve)=>{
    ok.onclick=()=>{
      hint.hidden=true;
      try{ localStorage.setItem('GJ_VR_HINT_OK','1'); }catch(_){}
      // ✅ MUST start game
      hideStart();
      begin?.('vr_ok');
      resolve();
    };
    // failsafe
    setTimeout(()=>{ /* do nothing */ resolve(); }, 900);
  });
}

(async function main(){
  // Show runtime errors on screen (soไม่ต้องเดา)
  window.addEventListener('error', (e)=>{
    hardFail('runtime error', e?.error || e?.message || e);
  });
  window.addEventListener('unhandledrejection', (e)=>{
    hardFail('unhandled promise', e?.reason || e);
  });

  try{
    const v = (window.__HHA_V__ || qp('v','') || String(Date.now()));
    const diff = toStr(qp('diff','normal'),'normal').toLowerCase();
    const time = toInt(qp('time','80'),80);
    const run  = toStr(qp('run','play'),'play').toLowerCase();
    const endPolicy = toStr(qp('end','time'),'time').toLowerCase();
    const challenge = toStr(qp('challenge','rush'),'rush').toLowerCase();

    const initial = qp('view', null);
    if(['pc','mobile','vr','cvr'].includes(initial)) setView(initial);
    else setView(isMobileLike()? 'mobile':'pc');

    const stageEl = document.getElementById('gj-stage');
    const layerL  = document.getElementById('gj-layer');     // legacy id
    const layerR  = document.getElementById('gj-layer-r');   // right eye
    const crossL  = document.getElementById('gj-crosshair');
    const crossR  = document.getElementById('gj-crosshair-r');
    const ringL   = document.getElementById('atk-ring');
    const ringR   = document.getElementById('atk-ring-r');
    const laserL  = document.getElementById('atk-laser');
    const laserR  = document.getElementById('atk-laser-r');
    const shootEl = document.getElementById('btnShoot');

    if(!stageEl) return hardFail('missing #gj-stage');
    if(!layerL)  return hardFail('missing #gj-layer (legacy id)');

    setHudMeta(`[BOOT] import safe • v=${v}`);

    let safeMod=null;
    try{
      safeMod = await import(`./goodjunk.safe.js?v=${encodeURIComponent(v)}`);
    }catch(err){
      return hardFail('cannot import ./goodjunk.safe.js (path/syntax/cache)', err);
    }
    if(!safeMod || typeof safeMod.boot !== 'function'){
      return hardFail('goodjunk.safe.js has no exported boot()');
    }

    let started=false;
    const begin = (why)=>{
      if(started) return;
      started=true;
      hideStart();
      const hint=document.getElementById('vrHint');
      if(hint) hint.hidden=true;

      setHudMeta(`[BOOT] starting • ${why||''}`);

      safeMod.boot({
        diff, time, run,
        endPolicy, challenge,
        layerEl: layerL,
        layerElR: layerR,
        crosshairEl: crossL,
        crosshairElR: crossR,
        ringEl: ringL,
        ringElR: ringR,
        laserEl: laserL,
        laserElR: laserR,
        shootEl,
        safeMargins: { top: 128, bottom: 170, left: 18, right: 18 }
      });

      setHudMeta(`[BOOT] running • dual=${!!layerR}`);
    };

    wireViewButtons(begin);

    // Touch anywhere = begin (เผื่อปุ่มโดนบัง)
    stageEl.addEventListener('pointerdown', ()=> begin('stage_touch'), {passive:true});
    if(shootEl) shootEl.addEventListener('pointerdown', ()=> begin('shoot_button'), {passive:true});

    const metaText = `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge} • v=${v}`;
    showStartOverlay(metaText, begin);

    if(document.body.classList.contains('view-vr') || document.body.classList.contains('view-cvr')){
      await showVrHintIfNeeded(begin);
    }

    setHudMeta('[BOOT] ready');
  }catch(err){
    hardFail('boot crashed', err);
  }
})();