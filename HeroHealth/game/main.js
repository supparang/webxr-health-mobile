// === Hero Health Academy — main.js (G10 Layer-Lock & 3D/DOM Toggle) ===
window.__HHA_BOOT_OK = true;

const $ = s => document.querySelector(s);
const on = (el,ev,fn)=>{ if(el) el.addEventListener(ev,fn,false); };
const setText=(sel,txt)=>{ const el=$(sel); if(el) el.textContent=txt; };
const now = ()=> performance?.now?.() ?? Date.now();

// ---------- CSS (stacking & clipping) ----------
(function css(){
  const tag=document.createElement('style'); tag.textContent = `
    header.brand{position:sticky;top:0;z-index:2000}
    #gameLayer{
      position:relative;width:min(980px,96vw);
      height:calc(100vh - 290px);min-height:420px;margin:10px auto;
      border-radius:16px;border:1px solid #152641;
      background:radial-gradient(1200px 500px at 50% -40%, #152644 12%, #0c1729 55%, #0b1626);
      overflow:hidden;isolation:isolate;z-index:100;
    }
    #spawnHost{position:absolute;inset:0;z-index:6}
    #c{position:absolute;inset:0;z-index:6;display:block;width:100%;height:100%;pointer-events:auto;cursor:crosshair}
    /* HUD never eats clicks */
    #hudWrap{position:fixed;top:60px;right:12px;z-index:1500;pointer-events:none}
    /* Menu safe */
    #menuBar{position:relative;z-index:120}
    body.playing #menuBar{pointer-events:none}
    /* Mode toggles: when 3D is ON, canvas above DOM; when OFF, DOM above canvas */
    body.use3d  #c{z-index:12}
    body.use3d  #spawnHost{z-index:6;pointer-events:none}
    body.no3d   #c{z-index:6}
    body.no3d   #spawnHost{z-index:12;pointer-events:auto}
  `; document.head.appendChild(tag);
})();

// ---------- Ensure base DOM ----------
(function ensureDOM(){
  if(!$('#gameLayer')){ const gl=document.createElement('section'); gl.id='gameLayer'; document.body.appendChild(gl); }
  if(!$('#spawnHost')){ const h=document.createElement('div'); h.id='spawnHost'; $('#gameLayer').appendChild(h); }
})();

// ---------- Paths ----------
const BASE = '/webxr-health-mobile/HeroHealth/game/';
const MODES_DIR = BASE + 'modes/';

// ---------- State ----------
const STATE = {
  lang:'th', difficulty:'Normal', modeKey:'goodjunk',
  running:false, paused:false, timeLeft:60, score:0, combo:0, best:0,
  modeAPI:null, startAt:0
};

// ---------- Score hooks ----------
function addScore(delta, perfect){
  STATE.score += delta; STATE.combo += 1; STATE.best=Math.max(STATE.best,STATE.combo);
  setText('#score',STATE.score); setText('#combo','x'+STATE.combo);
  const gl=$('#gameLayer'); try{ gl.style.transition='transform 80ms ease';
    gl.style.transform='translate3d(4px,-4px,0)'; setTimeout(()=>gl.style.transform='translate3d(0,0,0)',90);}catch(_){}
}
function badHit(){ STATE.combo=0; setText('#combo','x0'); }
window.__HHA_modeHooks = { addScore, badHit };

function setTimeLeft(v){ STATE.timeLeft=Math.max(0,v); setText('#time',Math.round(STATE.timeLeft)); }

// ---------- Three.js context ----------
let THREE_CTX = { ready:false };

function ensureThree(){
  if(THREE_CTX.ready) return Promise.resolve(THREE_CTX);
  return import('https://unpkg.com/three@0.159.0/build/three.module.js').then((THREE)=>{
    const gl = $('#gameLayer');
    let cvs = document.getElementById('c'); if(!cvs){ cvs=document.createElement('canvas'); cvs.id='c'; gl.appendChild(cvs); }

    const renderer = new THREE.WebGLRenderer({ canvas:cvs, antialias:true, alpha:true });
    renderer.setClearColor(0x000000,0); renderer.sortObjects = true;

    const scene = new THREE.Scene();
    const cam   = new THREE.PerspectiveCamera(50, 16/9, 0.1, 50);
    cam.position.set(0,0,8);
    scene.add(new THREE.AmbientLight(0xffffff,0.65));
    const dl=new THREE.DirectionalLight(0xffffff,0.9); dl.position.set(4,5,5); scene.add(dl);

    // Size sync — keep canvas exactly the same box as #gameLayer
    function size(){
      const r = gl.getBoundingClientRect();
      const w = Math.max(320, r.width), h = Math.max(260, r.height);
      cam.aspect=w/h; cam.updateProjectionMatrix(); renderer.setSize(w,h,false);
    }
    size();
    new ResizeObserver(size).observe(gl);
    window.addEventListener('resize', size);
    setInterval(size, 800); // mobile/VR URL bar shifts

    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function updatePointer(e){
      const rect = cvs.getBoundingClientRect();
      const cx = (e?.clientX ?? e?.touches?.[0]?.clientX ?? rect.left + rect.width/2);
      const cy = (e?.clientY ?? e?.touches?.[0]?.clientY ?? rect.top  + rect.height/2);
      pointer.x = ((cx - rect.left)/rect.width)*2 - 1;
      pointer.y = -((cy - rect.top)/rect.height)*2 + 1;
      THREE_CTX.pointer = pointer; THREE_CTX.ray = ray;
    }
    function firePointer(){ if(STATE.modeAPI?.onPointer) STATE.modeAPI.onPointer(THREE_CTX); }

    cvs.addEventListener('click',       e=>{ updatePointer(e); firePointer(); }, false);
    cvs.addEventListener('pointerdown', e=>{ updatePointer(e); firePointer(); }, false);
    cvs.addEventListener('touchstart',  e=>{ updatePointer(e); firePointer(); }, {passive:true});
    window.addEventListener('keydown',  e=>{ if(e.code==='Space'||e.code==='Enter'){ updatePointer(); firePointer(); }}, false);

    // Helper: random point inside camera view (safe margin)
    function randInView(z=0){
      const zv = Math.min(0.6, Math.max(-0.25, z));
      const dist = (cam.position.z - zv);
      const halfH = Math.tan((cam.fov*Math.PI/180)/2) * dist;
      const halfW = halfH * cam.aspect;
      return { x:(Math.random()*2-1)*(halfW*0.9), y:(Math.random()*2-1)*(halfH*0.9), z:zv };
    }

    THREE_CTX = { ready:true, THREE, renderer, scene, camera:cam, cam, ray, pointer, canvas:cvs, utils:{ randInView } };
    return THREE_CTX;
  }).catch(()=>({ready:false}));
}

// ---------- Mode loader (cache-bust) ----------
const registry = {};
function getMode(key){
  if(registry[key]) return Promise.resolve(registry[key]);
  const ver=`v=emoji3d&cb=${Date.now()}`;
  return import(`${MODES_DIR}${key}.js?${ver}`)
    .then(m => (registry[key]=m))
    .catch(async e=>{ console.warn('[HHA] mode load failed',e);
      const m = await import(`${MODES_DIR}goodjunk.js?${ver}`); registry[key]=m; return m; });
}

// ---------- Lifecycle ----------
function resetGame(){
  STATE.running=false; STATE.paused=false;
  STATE.score=0; STATE.combo=0; setText('#score','0'); setText('#combo','x0');
  setTimeLeft(STATE.difficulty==='Easy'?70:(STATE.difficulty==='Hard'?50:60));
  document.body.classList.remove('playing','use3d','no3d');
  const hud=$('#hudWrap'); if(hud) hud.style.display='block';
}

function startGame(){
  if(STATE.running) return;
  resetGame();
  getMode(STATE.modeKey).then(api=>{
    STATE.modeAPI = api;
    return ensureThree().then(ctx=>{
      // Toggle layers by capability
      if(ctx.ready){ document.body.classList.add('use3d'); document.body.classList.remove('no3d'); }
      else         { document.body.classList.add('no3d');  document.body.classList.remove('use3d'); }

      api?.start?.({ difficulty:STATE.difficulty, lang:STATE.lang, three:ctx.ready?ctx:null, hints:{ spriteOnTop:true } });
      STATE.running=true; STATE.paused=false; STATE.startAt=now();
      document.body.classList.add('playing');
      loop(); timerTick();
    });
  });
}

function stopGame(){
  STATE.running=false; STATE.paused=false; document.body.classList.remove('playing');
  try{ STATE.modeAPI?.stop?.(); }catch(_){}
}

// ---------- Loop & Timer ----------
let _last=0, _tick=null;
function loop(t){
  if(!STATE.running) return;
  requestAnimationFrame(loop);
  if(!t) t=now(); const dt=_last?(t-_last):16.6; _last=t;
  if(STATE.paused) return;
  try{ STATE.modeAPI?.update?.(dt); }catch(_){}
  if(THREE_CTX.ready){ try{ THREE_CTX.renderer.render(THREE_CTX.scene, THREE_CTX.cam||THREE_CTX.camera); }catch(_){} }
}
function timerTick(){
  if(_tick) clearInterval(_tick);
  _tick=setInterval(()=>{
    if(!STATE.running){ clearInterval(_tick); _tick=null; return; }
    if(STATE.paused) return;
    setTimeLeft(STATE.timeLeft-1);
    if(STATE.timeLeft<=0){ stopGame(); clearInterval(_tick); _tick=null; }
  },1000);
}

// ---------- UI ----------
on($('#btn_start'),'click', startGame);
on($('#btn_pause'),'click', ()=>{ if(STATE.running) STATE.paused=!STATE.paused; });
on($('#btn_restart'),'click', ()=>{ stopGame(); startGame(); });

function setDiff(d){ STATE.difficulty=d; setText('#difficulty', d); }
on($('#d_easy'),'click',   ()=>setDiff('Easy'));
on($('#d_normal'),'click', ()=>setDiff('Normal'));
on($('#d_hard'),'click',   ()=>setDiff('Hard'));

function setMode(key){
  STATE.modeKey=key;
  const map={th:{goodjunk:'ดี vs ขยะ',groups:'จาน 5 หมู่',hydration:'สมดุลน้ำ',plate:'จัดจานสุขภาพ'},
             en:{goodjunk:'Good vs Junk',groups:'Food Groups',hydration:'Water Balance',plate:'Healthy Plate'}};
  const L=map[STATE.lang]||map.th; setText('#modeName', L[key]||key);
}
on($('#m_goodjunk'),'click', ()=>setMode('goodjunk'));
on($('#m_groups'),  'click', ()=>setMode('groups'));
on($('#m_hydration'),'click',()=>setMode('hydration'));
on($('#m_plate'),   'click', ()=>setMode('plate'));
