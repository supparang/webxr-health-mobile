// === Hero Health Academy — main.js (G12 FocusPlay)
// - Playing: แสดงเฉพาะกรอบเกม + HUD (ซ่อน Header/เมนูทั้งหมด)
// - End: เปิด Result modal แล้วให้กลับ Home ได้

window.__HHA_BOOT_OK = true;

const $  = (s)=>document.querySelector(s);
const on = (el,ev,fn)=>{ if(el) el.addEventListener(ev,fn,false); };
const txt= (el,v)=>{ if(typeof el==='string') el=$(el); if(el) el.textContent=v; };
const now= ()=>performance?.now?.()??Date.now();

// ---------- CSS: โหมดซ่อนเมนูขณะเล่น ----------
(function injectCSS(){
  const css = `
  body{background:#0b1626;margin:0}
  header.brand{position:sticky;top:0;z-index:2000}
  #gameLayer{
    position:relative;width:min(980px,96vw);
    height:calc(100vh - 290px);min-height:420px;margin:10px auto;
    border-radius:16px;border:1px solid #152641;
    background:radial-gradient(1200px 500px at 50% -40%, #152644 12%, #0c1729 55%, #0b1626);
    overflow:hidden;isolation:isolate;clip-path: inset(0 round 16px);
  }
  #c{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:6}
  #spawnHost{position:absolute;inset:0;z-index:6}
  #hudWrap{position:fixed;left:12px;top:58px;z-index:1500;pointer-events:none;display:none}
  /* โหมดเล่น: ซ่อน header + menuBar ทั้งหมด */
  body.playing header.brand,
  body.playing #menuBar,
  body.playing #help,
  body.playing #helpScene,
  body.playing #statBoard,
  body.playing #dailyPanel { display:none !important; }
  body.playing #hudWrap { display:block !important; }
  /* โหมดผลลัพธ์: ซ่อนพื้นที่เล่นเพื่อป้องกันคลิก */
  body.result #c, body.result #spawnHost { pointer-events:none; filter:grayscale(.2) brightness(.85); }
  /* Plane lock */
  body.use3d  #c{z-index:12;pointer-events:auto}
  body.use3d  #spawnHost{display:none;pointer-events:none;z-index:0}
  body.no3d   #c{pointer-events:none;z-index:0}
  body.no3d   #spawnHost{display:block;pointer-events:auto;z-index:12}
  `;
  const tag=document.createElement('style'); tag.textContent=css; document.head.appendChild(tag);
})();

// ---------- Ensure base DOM ----------
(function ensureDOM(){
  if(!$('#gameLayer')){ const gl=document.createElement('section'); gl.id='gameLayer'; document.body.appendChild(gl); }
  if(!$('#c')){ const cvs=document.createElement('canvas'); cvs.id='c'; $('#gameLayer').appendChild(cvs); }
  if(!$('#spawnHost')){ const h=document.createElement('div'); h.id='spawnHost'; $('#gameLayer').appendChild(h); }
})();

// ---------- Global game state ----------
const STATE={
  lang:'th',
  difficulty:'Normal',
  modeKey:'goodjunk',
  running:false,
  paused:false,
  timeLeft:60,
  score:0, combo:0, bestCombo:0,
  startAt:0,
  modeAPI:null
};

// glue ให้โหมดเรียกเพิ่มคะแนน/โดนพลาด
function addScore(delta, perfect){
  STATE.score += delta;
  STATE.combo += 1;
  STATE.bestCombo = Math.max(STATE.bestCombo, STATE.combo);
  txt('#score', STATE.score);
  txt('#combo', 'x'+STATE.combo);
}
function badHit(){
  STATE.combo = 0;
  txt('#combo','x0');
}
window.__HHA_modeHooks = { addScore, badHit };
function setTime(v){ STATE.timeLeft=Math.max(0,v); txt('#time', Math.round(STATE.timeLeft)); }

// ---------- Three.js minimal ctx ----------
let THREE_CTX={ready:false};
function ensureThree(){
  if(THREE_CTX.ready) return Promise.resolve(THREE_CTX);
  return import('https://unpkg.com/three@0.159.0/build/three.module.js').then((THREE)=>{
    const gl=$('#gameLayer'), cvs=$('#c');
    const renderer=new THREE.WebGLRenderer({canvas:cvs, antialias:true, alpha:true});
    renderer.setClearColor(0x000000,0);
    const scene=new THREE.Scene();
    const cam=new THREE.PerspectiveCamera(50,16/9,0.1,50);
    cam.position.set(0,0,8);
    scene.add(new THREE.AmbientLight(0xffffff,0.65));
    const dl=new THREE.DirectionalLight(0xffffff,0.9); dl.position.set(4,5,5); scene.add(dl);

    function size(){
      const r=gl.getBoundingClientRect();
      const w=Math.max(320,r.width), h=Math.max(260,r.height);
      cam.aspect=w/h; cam.updateProjectionMatrix(); renderer.setSize(w,h,false);
    }
    size(); new ResizeObserver(size).observe(gl); window.addEventListener('resize',size);

    const ray=new THREE.Raycaster(), pointer=new THREE.Vector2();
    function pointerFromEvent(e){
      const rect=cvs.getBoundingClientRect();
      const cx=(e?.clientX ?? e?.touches?.[0]?.clientX ?? rect.left+rect.width/2);
      const cy=(e?.clientY ?? e?.touches?.[0]?.clientY ?? rect.top +rect.height/2);
      pointer.x = ((cx-rect.left)/rect.width)*2-1;
      pointer.y = -((cy-rect.top)/rect.height)*2+1;
    }
    function fire(){ STATE.modeAPI?.onPointer?.({THREE, renderer, scene, camera:cam, cam, ray, pointer, canvas:cvs}); }
    cvs.addEventListener('click',      e=>{ if(!document.body.classList.contains('use3d')) return; pointerFromEvent(e); fire(); }, false);
    cvs.addEventListener('pointerdown',e=>{ if(!document.body.classList.contains('use3d')) return; pointerFromEvent(e); fire(); }, false);
    cvs.addEventListener('touchstart', e=>{ if(!document.body.classList.contains('use3d')) return; pointerFromEvent(e); fire(); }, {passive:true});
    window.addEventListener('keydown', e=>{ if(e.code==='Space'||e.code==='Enter'){ pointerFromEvent(); fire(); }}, false);

    function randInView(z=0){ // helper ให้โหมดสุ่มในเฟรม
      const zv=Math.min(0.6,Math.max(-0.25,z));
      const dist=(cam.position.z - zv);
      const halfH=Math.tan((cam.fov*Math.PI/180)/2)*dist;
      const halfW=halfH*cam.aspect;
      return {x:(Math.random()*2-1)*(halfW*0.9), y:(Math.random()*2-1)*(halfH*0.9), z:zv};
    }

    THREE_CTX={ready:true, THREE, renderer, scene, camera:cam, cam, ray, pointer, canvas:cvs, utils:{randInView}};
    return THREE_CTX;
  }).catch(()=>({ready:false}));
}

// ---------- Plane lock (3D vs DOM) ----------
function setPlane(mode){
  const host=$('#spawnHost'), cvs=$('#c');
  if(mode==='3d'){
    document.body.classList.add('use3d'); document.body.classList.remove('no3d');
    if(host){ host.style.display='none'; host.style.pointerEvents='none'; try{ host.querySelectorAll('.spawn-emoji').forEach(n=>n.remove()); }catch(_){ } }
    if(cvs){ cvs.style.pointerEvents='auto'; }
  }else{
    document.body.classList.add('no3d'); document.body.classList.remove('use3d');
    if(host){ host.style.display='block'; host.style.pointerEvents='auto'; }
    if(cvs){ cvs.style.pointerEvents='none'; }
  }
}

// ---------- Mode loader ----------
const MOD_BASE='/webxr-health-mobile/HeroHealth/game/modes/';
const REG={};
function loadMode(key){
  if(REG[key]) return Promise.resolve(REG[key]);
  const v=`v=g12&cb=${Date.now()}`;
  return import(`${MOD_BASE}${key}.js?${v}`).then(m=> (REG[key]=m));
}

// ---------- Screen states ----------
function enterHome(){
  document.body.classList.remove('playing','result');
  $('#result')?.setAttribute('style','display:none');
  // show header/menu
  $('header.brand')?.setAttribute('style','');
  $('#menuBar')?.setAttribute('style','');
  setPlane('dom');
}
function enterPlaying(){
  document.body.classList.add('playing');
  document.body.classList.remove('result');
  // hide header/menu
  $('header.brand')?.setAttribute('style','display:none');
  $('#menuBar')?.setAttribute('style','display:none');
}
function enterResult(){
  document.body.classList.add('result');
  document.body.classList.remove('playing');
  // show result modal
  const res = $('#result');
  if(res){ res.style.display='block'; }
  setPlane('dom'); // ปิดคลิกบน canvas ระหว่างดูผล
}

// ---------- Lifecycle ----------
function resetState(){
  STATE.score=0; STATE.combo=0; STATE.bestCombo=0;
  setTime(STATE.difficulty==='Easy'?70:(STATE.difficulty==='Hard'?50:60));
  txt('#score','0'); txt('#combo','x0');
}

function startGame(){
  if(STATE.running) return;
  resetState();
  enterPlaying();
  loadMode(STATE.modeKey).then(api=>{
    STATE.modeAPI=api;
    ensureThree().then(ctx=>{
      if(ctx.ready){ setPlane('3d'); api?.start?.({difficulty:STATE.difficulty, lang:STATE.lang, three:ctx}); }
      else{ setPlane('dom'); api?.start?.({difficulty:STATE.difficulty, lang:STATE.lang}); }
      STATE.running=true; STATE.paused=false; STATE.startAt=now();
      gameLoop(); startTimer();
    });
  });
}

function finishGame(){
  STATE.running=false;
  try{ STATE.modeAPI?.stop?.(); }catch(_){}
  // สร้างสรุปผล
  const secs = Math.round((now()-STATE.startAt)/1000);
  txt('#resultText', `คะแนนรวม: ${STATE.score} • คอมโบสูงสุด: x${STATE.bestCombo} • เวลาเล่น: ${secs}s`);
  // เพิ่ม core/breakdown หากต้องการข้อมูลละเอียด
  enterResult();
}

function backToHome(){
  enterHome();
}

// ---------- Loop & Timer ----------
let _last=0, _iv=null;
function gameLoop(t){
  if(!STATE.running) return;
  requestAnimationFrame(gameLoop);
  if(!t) t=now(); const dt=_last?(t-_last):16.6; _last=t;
  if(STATE.paused) return;
  try{ STATE.modeAPI?.update?.(dt); }catch(_){}
  if(THREE_CTX.ready && document.body.classList.contains('use3d')){
    try{ THREE_CTX.renderer.render(THREE_CTX.scene, THREE_CTX.cam||THREE_CTX.camera); }catch(_){}
  }
}
function startTimer(){
  if(_iv) clearInterval(_iv);
  _iv=setInterval(()=>{
    if(!STATE.running) return clearInterval(_iv);
    if(STATE.paused) return;
    setTime(STATE.timeLeft-1);
    if(STATE.timeLeft<=0){ clearInterval(_iv); finishGame(); }
  },1000);
}

// ---------- UI wiring ----------
on($('#btn_start'),'click', startGame);
on($('#btn_restart'),'click', ()=>{ finishGame(); startGame(); }); // เผื่อเรียกจากหน้าหลัก
on($('#btn_replay'),'click', ()=>{ $('#result')&&( $('#result').style.display='none' ); startGame(); });
on($('#btn_home'),'click', ()=>{ $('#result')&&( $('#result').style.display='none' ); backToHome(); });

on($('#d_easy'),  'click', ()=>{ STATE.difficulty='Easy';   txt('#difficulty','Easy'); });
on($('#d_normal'),'click', ()=>{ STATE.difficulty='Normal'; txt('#difficulty','Normal'); });
on($('#d_hard'),  'click', ()=>{ STATE.difficulty='Hard';   txt('#difficulty','Hard'); });

on($('#m_goodjunk'),  'click', ()=>{ STATE.modeKey='goodjunk';   txt('#modeName','ดี vs ขยะ'); });
on($('#m_groups'),    'click', ()=>{ STATE.modeKey='groups';     txt('#modeName','จาน 5 หมู่'); });
on($('#m_hydration'), 'click', ()=>{ STATE.modeKey='hydration';  txt('#modeName','สมดุลน้ำ'); });
on($('#m_plate'),     'click', ()=>{ STATE.modeKey='plate';      txt('#modeName','จัดจานสุขภาพ'); });

// เริ่มต้นที่ Home
enterHome();
