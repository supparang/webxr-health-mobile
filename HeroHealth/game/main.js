// === Hero Health Academy — main.js (G7 Emoji 3D Ready) ===
// - Three.js 3D renderer พร้อม pointer
// - Cache-bust โหลดโหมดเสมอ (กันค้างเวอร์ชันเก่า)
// - ส่งทั้ง camera และ cam ให้โหมด (compat)
// - HUD/Timer/Score/Combo ครบ & DOM fallback ปลอดภัย

window.__HHA_BOOT_OK = true;

// ---------- Helpers ----------
const $ = (s)=>document.querySelector(s);
function on(el,ev,fn){ if(el) el.addEventListener(ev,fn,false); }
function setText(sel,txt){ const el=$(sel); if(el) el.textContent = txt; }
function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

// ---------- Ensure base DOM (เล่นได้แม้ index ต่างเวอร์ชัน) ----------
(function ensureDOM(){
  const header = document.querySelector('header.brand');
  if(header){ header.style.position='sticky'; header.style.top='0'; header.style.zIndex='2000'; }

  const hud = $('#hudWrap');
  if(hud){
    hud.style.position='fixed';
    hud.style.top='60px';
    hud.style.right='12px';
    hud.style.zIndex='1500';
    hud.style.pointerEvents='none';
  }

  let gl = $('#gameLayer');
  if(!gl){
    gl = document.createElement('section');
    gl.id='gameLayer';
    gl.setAttribute('aria-label','playfield');
    gl.style.cssText = 'position:relative;width:min(980px,96vw);height:60vh;min-height:420px;margin:10px auto;border-radius:16px;border:1px solid #152641;background:radial-gradient(1200px 500px at 50% -40%, #152644 12%, #0c1729 55%, #0b1626);overflow:hidden;';
    document.body.appendChild(gl);
  }
  let host = $('#spawnHost');
  if(!host){
    host = document.createElement('div');
    host.id='spawnHost';
    host.style.cssText='position:absolute;inset:0;z-index:8;';
    gl.appendChild(host);
  }else{
    host.style.zIndex='8';
  }
})();

// ---------- Paths ----------
const BASE = '/webxr-health-mobile/HeroHealth/game/';
const MODES_DIR = BASE + 'modes/';

// ---------- Global state ----------
const STATE = {
  lang:'th',
  difficulty:'Normal',
  modeKey:'goodjunk',
  running:false, paused:false,
  timeLeft:60, score:0, combo:0, best:0,
  modeAPI:null, startAt:0
};

// ---------- Score/Combo hooks ----------
function addScore(delta, perfect){
  STATE.score += delta;
  STATE.combo += 1;
  STATE.best = Math.max(STATE.best, STATE.combo);
  setText('#score', STATE.score);
  setText('#combo', 'x'+STATE.combo);
  // mini screen shake
  const gl = $('#gameLayer');
  try{
    gl.style.transition='transform 80ms ease';
    gl.style.transform='translate3d(4px,-4px,0)';
    setTimeout(()=>{ gl.style.transform='translate3d(0,0,0)'; }, 90);
  }catch(_){}
}
function badHit(){
  STATE.combo = 0;
  setText('#combo','x0');
}
window.__HHA_modeHooks = { addScore, badHit };

// ---------- Time ----------
function setTimeLeft(v){
  STATE.timeLeft = Math.max(0, v);
  setText('#time', Math.round(STATE.timeLeft));
}

// ---------- Three.js context ----------
let THREE_CTX = { ready:false, THREE:null, renderer:null, scene:null, camera:null, cam:null, ray:null, pointer:null, canvas:null };

function ensureThree(){
  if(THREE_CTX.ready) return Promise.resolve(THREE_CTX);
  return import('https://unpkg.com/three@0.159.0/build/three.module.js').then((THREE)=>{
    const gl = $('#gameLayer');

    // canvas (ใต้ HUD, เหนือพื้น, ต่ำกว่า DOM spawn)
    let cvs = document.getElementById('c');
    if(!cvs){
      cvs = document.createElement('canvas');
      cvs.id='c';
      gl.appendChild(cvs);
    }
    cvs.style.position='absolute';
    cvs.style.inset='0';
    cvs.style.zIndex='6';            // spawnHost = 8
    cvs.style.pointerEvents='auto';
    cvs.style.cursor='crosshair';

    const renderer = new THREE.WebGLRenderer({ canvas:cvs, antialias:true, alpha:true });
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const cam   = new THREE.PerspectiveCamera(50, 16/9, 0.1, 100);
    cam.position.set(0,0,8);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(4,5,5); scene.add(dl);

    function resize(){
      const r = gl.getBoundingClientRect();
      const w = Math.max(320, r.width), h = Math.max(220, r.height);
      cam.aspect = w/h; cam.updateProjectionMatrix(); renderer.setSize(w,h,false);
    }
    resize(); window.addEventListener('resize', resize);

    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    cvs.addEventListener('click', (e)=>{
      if(!STATE.modeAPI || typeof STATE.modeAPI.onPointer!=='function') return;
      const rect = cvs.getBoundingClientRect();
      pointer.x = ((e.clientX-rect.left)/rect.width)*2 - 1;
      pointer.y = -((e.clientY-rect.top)/rect.height)*2 + 1;
      THREE_CTX.pointer = pointer; THREE_CTX.ray = ray;
      STATE.modeAPI.onPointer(THREE_CTX);
    }, false);

    // NOTE: ให้ทั้งชื่อ camera และ cam เพื่อรองรับโหมดทุกรุ่น
    THREE_CTX = { ready:true, THREE, renderer, scene, camera:cam, cam, ray, pointer, canvas:cvs };
    return THREE_CTX;
  }).catch(()=>({ready:false}));
}

// ---------- Mode loader (cache-bust) ----------
const registry = {};
function getMode(key){
  if(registry[key]) return Promise.resolve(registry[key]);
  const bust = `v=emoji3d&cb=${Date.now()}`;
  const url  = `${MODES_DIR}${key}.js?${bust}`;
  return import(url).then(m => (registry[key]=m)).catch(async (e)=>{
    console.warn('[HHA] load mode failed:', e);
    const fallback = `${MODES_DIR}goodjunk.js?${bust}`;
    const m = await import(fallback);
    registry[key]=m; return m;
  });
}

// ---------- Game lifecycle ----------
function resetGame(){
  STATE.running=false; STATE.paused=false;
  STATE.score=0; STATE.combo=0; setText('#score','0'); setText('#combo','x0');
  const d = STATE.difficulty;
  setTimeLeft(d==='Easy' ? 70 : (d==='Hard'? 50 : 60));
  const hud = $('#hudWrap'); if(hud) hud.style.display='block';
}

function startGame(){
  if(STATE.running) return;
  resetGame();
  getMode(STATE.modeKey).then((api)=>{
    STATE.modeAPI = api;
    return ensureThree().then((ctx)=>{
      if(api && typeof api.start==='function'){
        api.start({ difficulty: STATE.difficulty, lang: STATE.lang, three: ctx.ready ? ctx : null });
      }
      STATE.running = true; STATE.paused = false; STATE.startAt = now();
      loop(); timerTick();
    });
  }).catch((e)=>{
    console.error('[HHA] startGame error', e);
  });
}

function stopGame(){
  STATE.running=false; STATE.paused=false;
  try{ STATE.modeAPI && STATE.modeAPI.stop && STATE.modeAPI.stop(); }catch(_){}
}

// ---------- Main loop & timer ----------
let _last=0, _tickId=null;
function loop(t){
  if(!STATE.running) return;
  requestAnimationFrame(loop);
  if(!t) t = now();
  const dt = (_last ? (t - _last) : 16.6); _last = t;
  if(STATE.paused) return;

  try{ STATE.modeAPI && STATE.modeAPI.update && STATE.modeAPI.update(dt); }catch(_){}

  if(THREE_CTX.ready){
    try{ THREE_CTX.renderer.render(THREE_CTX.scene, THREE_CTX.cam || THREE_CTX.camera); }catch(_){}
  }
}
function timerTick(){
  if(_tickId) clearInterval(_tickId);
  _tickId = setInterval(()=>{
    if(!STATE.running){ clearInterval(_tickId); _tickId=null; return; }
    if(STATE.paused) return;
    setTimeLeft(STATE.timeLeft - 1);
    if(STATE.timeLeft <= 0){ stopGame(); clearInterval(_tickId); _tickId=null; }
  }, 1000);
}

// ---------- UI wiring (ใช้ id เดิมใน index) ----------
on($('#btn_start'),  'click', startGame);
on($('#btn_pause'),  'click', ()=>{ if(STATE.running){ STATE.paused = !STATE.paused; } });
on($('#btn_restart'),'click', ()=>{ stopGame(); startGame(); });

// Difficulty & mode selectors (ถ้ามีปุ่ม)
function setDiff(d){ STATE.difficulty = d; setText('#difficulty', d); }
on($('#d_easy'),   'click', ()=>setDiff('Easy'));
on($('#d_normal'), 'click', ()=>setDiff('Normal'));
on($('#d_hard'),   'click', ()=>setDiff('Hard'));

function setMode(key){ STATE.modeKey = key; const map={th:{goodjunk:'ดี vs ขยะ',groups:'จาน 5 หมู่',hydration:'สมดุลน้ำ',plate:'จัดจานสุขภาพ'},en:{goodjunk:'Good vs Junk',groups:'Food Groups',hydration:'Water Balance',plate:'Healthy Plate'}}; const L = map[STATE.lang]||map.th; setText('#modeName', L[key]||key); }
on($('#m_goodjunk'),'click', ()=>setMode('goodjunk'));
on($('#m_groups'),  'click', ()=>setMode('groups'));
on($('#m_hydration'),'click',()=>setMode('hydration'));
on($('#m_plate'),   'click', ()=>setMode('plate'));
