// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot (PRODUCTION)
// ✅ Start overlay -> click to start
// ✅ View switch PC/Mobile/VR/cVR + Fullscreen
// ✅ VR Tip overlay (#vrTip + #vrTipOk) -> OK แล้วเข้าเกมแน่นอน
// ✅ Safe margins per view (กันเป้าไปโผล่นอกจอ/ต่ำเกินใน landscape)
// ✅ Optional logger: ?log=<WEB_APP_EXEC_URL>

import { boot as gameBoot } from './goodjunk.safe.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function qs(k, d=null){
  try{ return (new URL(ROOT.location.href)).searchParams.get(k) ?? d; }
  catch(_){ return d; }
}
function setQS(k, v){
  try{
    const u = new URL(ROOT.location.href);
    if (v === null || v === undefined || v === '') u.searchParams.delete(k);
    else u.searchParams.set(k, String(v));
    history.replaceState({}, '', u.toString());
  }catch(_){}
}

function $(sel){ return DOC.querySelector(sel); }
function clamp(v,a,b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

async function tryFullscreen(){
  const el = DOC.documentElement;
  try{
    if (!DOC.fullscreenElement && el.requestFullscreen) await el.requestFullscreen();
  }catch(_){}
}
async function tryExitFullscreen(){
  try{ if (DOC.fullscreenElement && DOC.exitFullscreen) await DOC.exitFullscreen(); }catch(_){}
}
async function tryLockLandscape(){
  try{
    const o = ROOT.screen && ROOT.screen.orientation;
    if (o && o.lock) await o.lock('landscape');
  }catch(_){}
}

function isMobileLike(){
  const w = ROOT.innerWidth || 360;
  const h = ROOT.innerHeight || 640;
  const coarse = (ROOT.matchMedia && ROOT.matchMedia('(pointer: coarse)').matches);
  return coarse || (Math.min(w,h) < 520);
}

function setView(view){
  view = String(view||'').toLowerCase();
  if (!['pc','mobile','vr','cvr'].includes(view)){
    view = isMobileLike() ? 'mobile' : 'pc';
  }

  DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  DOC.body.classList.add(`view-${view}`);
  setQS('view', view);

  const on = (id)=>{ const b = DOC.getElementById(id); if(b) b.classList.add('is-on'); };
  const off = (id)=>{ const b = DOC.getElementById(id); if(b) b.classList.remove('is-on'); };
  ['btnViewPC','btnViewMB','btnViewVR','btnViewCVR'].forEach(off);
  if (view === 'pc') on('btnViewPC');
  if (view === 'mobile') on('btnViewMB');
  if (view === 'vr') on('btnViewVR');
  if (view === 'cvr') on('btnViewCVR');

  return view;
}

function showVrTip(show){
  const tip = DOC.getElementById('vrTip');
  if (!tip) return;
  tip.hidden = !show;
}

function metaText(){
  const diff = String(qs('diff','normal'));
  const run  = String(qs('run','play'));
  const end  = String(qs('end','time'));
  const ch   = String(qs('challenge','rush'));
  const view = String(qs('view', isMobileLike()?'mobile':'pc'));
  return `diff=${diff} • run=${run} • end=${end} • ${ch} • view=${view}`;
}

function bindViewBar(){
  const chipSub = DOC.getElementById('chipSub');
  const hudMeta = DOC.getElementById('hudMeta');
  const startMeta = DOC.getElementById('startMeta');

  const refreshMeta = ()=>{
    const t = metaText();
    if (chipSub) chipSub.textContent = t;
    if (hudMeta) hudMeta.textContent = t;
    if (startMeta) startMeta.textContent = t;
  };
  refreshMeta();

  const bPC  = DOC.getElementById('btnViewPC');
  const bMB  = DOC.getElementById('btnViewMB');
  const bVR  = DOC.getElementById('btnViewVR');
  const bCVR = DOC.getElementById('btnViewCVR');
  const bFS  = DOC.getElementById('btnFullscreen');
  const bEnterVR = DOC.getElementById('btnEnterVR');

  if (bPC)  bPC.onclick  = ()=>{ setView('pc'); refreshMeta(); };
  if (bMB)  bMB.onclick  = ()=>{ setView('mobile'); refreshMeta(); };
  if (bVR)  bVR.onclick  = ()=>{ setView('vr'); showVrTip(true); refreshMeta(); };
  if (bCVR) bCVR.onclick = ()=>{ setView('cvr'); showVrTip(true); refreshMeta(); };

  if (bFS) bFS.onclick = async ()=>{
    if (DOC.fullscreenElement) await tryExitFullscreen();
    else await tryFullscreen();
  };

  // WebXR button (best effort): ในเกม DOM เราใช้แค่ fullscreen+landscape เป็นหลัก
  if (bEnterVR) bEnterVR.onclick = async ()=>{
    setView('vr');
    showVrTip(true);
    await tryFullscreen();
    await tryLockLandscape();
    refreshMeta();
  };

  // reflect URL initial
  const initView = setView(qs('view', isMobileLike()?'mobile':'pc'));
  if (initView === 'vr' || initView === 'cvr') showVrTip(true);

  // update meta on resize/orientation
  ROOT.addEventListener('resize', ()=> refreshMeta(), { passive:true });
}

function computeSafeMargins(view){
  // ✅ สำคัญ: VR/landscape ต้องลด top/bottom ไม่งั้นเป้า “ไปโผล่ไหนนี่”
  const isLand = (ROOT.innerWidth||0) > (ROOT.innerHeight||0);
  if (view === 'vr' || view === 'cvr'){
    return {
      top:  isLand ? 64 : 110,
      bottom: isLand ? 110 : 170,
      left:  22,
      right: 22
    };
  }
  // pc/mobile
  return {
    top:  isLand ? 86 : 128,
    bottom: isLand ? 140 : 170,
    left:  26,
    right: 26
  };
}

let started = false;
function startGame(){
  if (started) return;
  started = true;

  const overlay = DOC.getElementById('startOverlay');
  if (overlay) overlay.style.display = 'none';

  const view = String(qs('view', isMobileLike()?'mobile':'pc'));
  const safeMargins = computeSafeMargins(view);

  // optional logger
  const logUrl = qs('log', '');
  if (logUrl){
    try{
      if (ROOT.HHA_CLOUD_LOGGER && typeof ROOT.HHA_CLOUD_LOGGER.setEndpoint === 'function'){
        ROOT.HHA_CLOUD_LOGGER.setEndpoint(logUrl);
      } else {
        ROOT.HHA_LOG_ENDPOINT = logUrl;
      }
    }catch(_){}
  }

  gameBoot({
    diff: qs('diff','normal'),
    run:  qs('run','play'),
    time: clamp(Number(qs('time','70')), 30, 600),
    endPolicy: qs('end','time'),
    challenge: qs('challenge','rush'),
    sessionId: qs('sessionId', qs('sid','')),
    seed: qs('seed', null),
    safeMargins,
    context: { projectTag: qs('projectTag','GoodJunkVR') }
  });
}

function bindStartOverlay(){
  const btn = DOC.getElementById('btnStart');
  if (btn) btn.onclick = ()=> startGame();
}

function bindVrTipOk(){
  const ok = DOC.getElementById('vrTipOk');
  if (!ok) return;

  ok.onclick = async ()=>{
    showVrTip(false);
    // VR comfort
    await tryFullscreen();
    await tryLockLandscape();

    // ถ้ายังไม่เริ่มเกม ให้เริ่มให้เลย
    const overlay = DOC.getElementById('startOverlay');
    if (overlay && overlay.style.display !== 'none'){
      overlay.style.display = 'none';
      startGame();
    }
  };
}

bindViewBar();
bindStartOverlay();
bindVrTipOk();