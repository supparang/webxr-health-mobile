// === Hero Health Academy — main.js (G6 Emoji 3D Edition) ===
// 3D Emoji Targets, Shatter Effect, Score & Timer system.

window.__HHA_BOOT_OK = true;

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const on = (el, ev, fn) => { if(el) el.addEventListener(ev, fn, false); };
function setText(sel, txt){ const el=$(sel); if(el) el.textContent=txt; }
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function now(){ return performance.now(); }

// ---------- State ----------
const STATE = {
  running:false, paused:false,
  score:0, combo:0, timeLeft:60,
  difficulty:'Normal', lang:'th',
  modeKey:'goodjunk', modeAPI:null,
  best:0, startAt:0
};

// ---------- Three.js Context ----------
let THREE_CTX = { ready:false };

function ensureThree(){
  if(THREE_CTX.ready) return Promise.resolve(THREE_CTX);
  return import('https://unpkg.com/three@0.159.0/build/three.module.js').then(THREE=>{
    const gl = $('#gameLayer');
    const cvs = document.createElement('canvas');
    cvs.id='c'; cvs.style.cssText='position:absolute;inset:0;z-index:6;cursor:crosshair;';
    gl.appendChild(cvs);

    const renderer = new THREE.WebGLRenderer({canvas:cvs,antialias:true,alpha:true});
    renderer.setClearColor(0x000000,0);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(50,16/9,0.1,100); cam.position.set(0,0,8);
    scene.add(new THREE.AmbientLight(0xffffff,0.6));
    const dl=new THREE.DirectionalLight(0xffffff,0.9); dl.position.set(4,5,5); scene.add(dl);

    function resize(){
      const rect=gl.getBoundingClientRect();
      const w=Math.max(320,rect.width), h=Math.max(220,rect.height);
      cam.aspect=w/h; cam.updateProjectionMatrix(); renderer.setSize(w,h,false);
    }
    resize(); window.addEventListener('resize',resize);

    const ray=new THREE.Raycaster(), pointer=new THREE.Vector2();

    cvs.addEventListener('click', e=>{
      if(!STATE.modeAPI?.onPointer) return;
      const rect=cvs.getBoundingClientRect();
      pointer.x=((e.clientX-rect.left)/rect.width)*2-1;
      pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;
      THREE_CTX.pointer=pointer; THREE_CTX.ray=ray;
      STATE.modeAPI.onPointer(THREE_CTX);
    });

    THREE_CTX = { ready:true, THREE, renderer, scene, cam, ray, pointer, cvs };
    return THREE_CTX;
  }).catch(()=>({ready:false}));
}

// ---------- Hooks for score ----------
function addScore(delta,perfect){
  STATE.score += delta; STATE.combo++;
  STATE.best = Math.max(STATE.best, STATE.combo);
  setText('#score', STATE.score); setText('#combo','x'+STATE.combo);
  // Shake effect
  const gl=$('#gameLayer');
  gl.style.transition='transform 80ms ease'; gl.style.transform='translate(4px,-4px)';
  setTimeout(()=>gl.style.transform='translate(0,0)',100);
}
function badHit(){
  STATE.combo=0; setText('#combo','x0');
}
window.__HHA_modeHooks = { addScore, badHit };

// ---------- Time ----------
function setTimeLeft(v){ STATE.timeLeft=Math.max(0,v); setText('#time',Math.round(STATE.timeLeft)); }

// ---------- Game Load ----------
const BASE='/webxr-health-mobile/HeroHealth/game/';
const MODES_DIR=BASE+'modes/';
const registry={};

function getMode(key){
  if(registry[key]) return Promise.resolve(registry[key]);
  return import(MODES_DIR+key+'.js?v=live')
    .then(m=>registry[key]=m)
    .catch(()=>import(MODES_DIR+'goodjunk.js?v=live').then(m=>registry[key]=m));
}

// ---------- Core ----------
function resetGame(){
  STATE.running=false;STATE.paused=false;
  STATE.score=0;STATE.combo=0;
  const diff=STATE.difficulty;
  STATE.timeLeft=(diff==='Easy'?70:(diff==='Hard'?50:60));
  setText('#score','0'); setText('#combo','x0'); setTimeLeft(STATE.timeLeft);
  $('#hudWrap').style.display='block';
}

function startGame(){
  if(STATE.running) return;
  resetGame();
  getMode(STATE.modeKey).then(api=>{
    STATE.modeAPI=api;
    ensureThree().then(ctx=>{
      if(api.start) api.start({ difficulty:STATE.difficulty, lang:STATE.lang, three:ctx.ready?ctx:null });
      STATE.running=true; STATE.paused=false; STATE.startAt=now();
      loop(); timerTick();
    });
  });
}

function stopGame(){
  STATE.running=false; STATE.paused=false;
  if(STATE.modeAPI?.stop) STATE.modeAPI.stop();
}

let last=0;
function loop(t){
  if(!STATE.running) return;
  requestAnimationFrame(loop);
  if(!t) t=now(); const dt=t-(last||t); last=t;
  if(STATE.paused) return;
  STATE.modeAPI?.update?.(dt);
  if(THREE_CTX.ready) THREE_CTX.renderer.render(THREE_CTX.scene,THREE_CTX.cam);
}
function timerTick(){
  const tick=setInterval(()=>{
    if(!STATE.running){clearInterval(tick);return;}
    if(STATE.paused)return;
    setTimeLeft(STATE.timeLeft-1);
    if(STATE.timeLeft<=0){ stopGame(); clearInterval(tick); }
  },1000);
}

// ---------- UI ----------
on($('#btn_start'),'click',startGame);
on($('#btn_pause'),'click',()=>STATE.paused=!STATE.paused);
on($('#btn_restart'),'click',()=>{stopGame();startGame();});
