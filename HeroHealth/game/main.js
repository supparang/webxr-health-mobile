// === Hero Health Academy — main.js (2025-10-31 G4) ===
// 3D Renderer + Timer + Score + HUD fixed + fallback-safe

window.__HHA_BOOT_OK = true;

function $(s){return document.querySelector(s);}
function on(el,ev,fn){if(el)el.addEventListener(ev,fn,false);}
function setText(sel,txt){const e=$(sel);if(e)e.textContent=txt;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function now(){return performance?.now?.()||Date.now();}

// ----- DOM assure -----
(function(){
  const hud=$('#hudWrap')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'hudWrap'}));
  hud.style.cssText='position:fixed;top:60px;right:12px;z-index:1500;display:none;pointer-events:none;';
  const gl=$('#gameLayer')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'gameLayer'}));
  gl.style.cssText='position:relative;width:min(980px,96vw);height:60vh;min-height:420px;margin:10px auto;border:1px solid #152641;border-radius:16px;background:radial-gradient(1000px 400px at 50% -40%,#152644 10%,#0c1729 55%,#0b1626);overflow:hidden;';
  const host=$('#spawnHost')||gl.appendChild(Object.assign(document.createElement('div'),{id:'spawnHost'}));
  host.style.cssText='position:absolute;inset:0;z-index:8;';
})();

// ----- Paths -----
const BASE='/webxr-health-mobile/HeroHealth/game/';
const MODES_DIR=BASE+'modes/';

// ----- 3D Context -----
let THREE_CTX={ready:false,THREE:null,renderer:null,scene:null,camera:null,ray:null,pointer:null,canvas:null};

function ensureThree(){
  if(THREE_CTX.ready)return Promise.resolve(THREE_CTX);
  return import('https://unpkg.com/three@0.159.0/build/three.module.js').then(THREE=>{
    const gl=$('#gameLayer');
    const cvs=document.createElement('canvas');
    cvs.id='c';cvs.style.cssText='position:absolute;inset:0;z-index:6;pointer-events:auto;cursor:crosshair;';
    gl.appendChild(cvs);
    const r=new THREE.WebGLRenderer({canvas:cvs,antialias:true,alpha:true});
    r.setClearColor(0x000000,0);
    const s=new THREE.Scene();
    const c=new THREE.PerspectiveCamera(50,16/9,0.1,100);c.position.set(0,0,8);
    s.add(new THREE.AmbientLight(0xffffff,0.5));
    const dl=new THREE.DirectionalLight(0xffffff,1);dl.position.set(3,5,4);s.add(dl);
    const resize=()=>{const rect=gl.getBoundingClientRect();const w=Math.max(320,rect.width);const h=Math.max(220,rect.height);c.aspect=w/h;c.updateProjectionMatrix();r.setSize(w,h,false);};
    resize();window.addEventListener('resize',resize);
    const ray=new THREE.Raycaster();const pointer=new THREE.Vector2();
    cvs.addEventListener('click',e=>{
      if(!STATE.modeAPI?.onPointer)return;
      const rect=cvs.getBoundingClientRect();
      pointer.x=((e.clientX-rect.left)/rect.width)*2-1;
      pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;
      THREE_CTX.pointer=pointer;THREE_CTX.ray=ray;
      STATE.modeAPI.onPointer(THREE_CTX);
    });
    THREE_CTX={ready:true,THREE,renderer:r,scene:s,camera:c,ray,pointer,canvas:cvs};
    return THREE_CTX;
  }).catch(()=>({ready:false}));
}

// ----- State -----
const STATE={lang:'th',difficulty:'Normal',modeKey:'goodjunk',running:false,paused:false,timeLeft:60,score:0,combo:0,best:0,modeAPI:null,startAt:0};

// ----- Score -----
function addScore(delta,perfect){
  STATE.score+=delta;STATE.combo++;
  STATE.best=Math.max(STATE.best,STATE.combo);
  setText('#score',STATE.score);setText('#combo','x'+STATE.combo);
}
function badHit(){STATE.combo=0;setText('#combo','x0');}
window.__HHA_modeHooks={addScore,badHit};

// ----- Timer -----
function setTimeLeft(v){STATE.timeLeft=Math.max(0,v);setText('#time',Math.round(STATE.timeLeft));}

// ----- Loader -----
const registry={};
function getMode(key){
  if(registry[key])return Promise.resolve(registry[key]);
  return import(MODES_DIR+key+'.js?v=live').then(m=>registry[key]=m)
    .catch(()=>import(MODES_DIR+'goodjunk.js?v=live').then(m=>registry[key]=m));
}

// ----- Game Control -----
function resetGame(){
  STATE.running=false;STATE.paused=false;STATE.score=0;STATE.combo=0;
  setTimeLeft(STATE.difficulty==='Easy'?70:(STATE.difficulty==='Hard'?55:60));
  $('#hudWrap').style.display='block';
}

function startGame(){
  if(STATE.running)return;
  resetGame();
  getMode(STATE.modeKey).then(api=>{
    STATE.modeAPI=api;
    ensureThree().then(ctx=>{
      if(api.start)api.start({difficulty:STATE.difficulty,lang:STATE.lang,three:ctx.ready?ctx:null});
      STATE.running=true;STATE.paused=false;STATE.startAt=now();
      loop();timerTick();
    });
  });
}

function stopGame(){STATE.running=false;STATE.paused=false;if(STATE.modeAPI?.stop)STATE.modeAPI.stop();}

// ----- Loop -----
let last=0;
function loop(t){
  if(!STATE.running)return;
  requestAnimationFrame(loop);
  if(!t) t=now();const dt=t-(last||t);last=t;
  if(STATE.paused)return;
  STATE.modeAPI?.update?.(dt);
  if(THREE_CTX.ready)THREE_CTX.renderer.render(THREE_CTX.scene,THREE_CTX.camera);
}
function timerTick(){
  const tick=setInterval(()=>{
    if(!STATE.running){clearInterval(tick);return;}
    if(STATE.paused)return;
    setTimeLeft(STATE.timeLeft-1);
    if(STATE.timeLeft<=0){stopGame();clearInterval(tick);}
  },1000);
}

// ----- UI -----
on($('#btn_start'),'click',startGame);
on($('#btn_pause'), 'click',()=>STATE.paused=!STATE.paused);
on($('#btn_restart'),'click',()=>{stopGame();startGame();});
