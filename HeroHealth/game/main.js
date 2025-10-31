// === Hero Health Academy — main.js (G13 Full-Bleed Gameplay) ===
// - ขณะเล่น: เต็มจอทั้งหน้าต่าง (full-bleed), ซ่อน header/menu ทั้งหมด
// - เป้า 3D คลิกแล้วแตกกระจาย; เด้งคะแนน "+100/200" ณ จุดตี
// - โหมดปลอดชนกัน (plane-lock): เล่น 3D ใช้ canvas อย่างเดียว

window.__HHA_BOOT_OK = true;

const $  = (s)=>document.querySelector(s);
const on = (el,ev,fn)=>{ if(el) el.addEventListener(ev,fn,false); };
const T  = (sel, v)=>{ const el = (typeof sel==='string')?$(sel):sel; if(el) el.textContent = v; };
const now= ()=>performance?.now?.() ?? Date.now();

// ---------- CSS: Full-Bleed ระหว่างเล่น ----------
(function injectCSS(){
  const css = `
  html,body{height:100%;margin:0;background:#0b1626}
  header.brand{position:sticky;top:0;z-index:2000}
  #gameLayer{position:relative; width:min(980px,96vw); height:calc(100vh - 290px);
    min-height:420px; margin:10px auto; border-radius:16px; border:1px solid #152641;
    background:radial-gradient(1200px 500px at 50% -40%, #152644 12%, #0c1729 55%, #0b1626);
    overflow:hidden; isolation:isolate; clip-path: inset(0 round 16px);
  }
  /* Full-bleed เมื่อเล่น: ใช้ทั้ง viewport */
  body.playing #gameLayer{ position:fixed; inset:0; width:100vw; height:100vh; margin:0; border-radius:0; border:none; clip-path:none; }
  #c{position:absolute; inset:0; width:100%; height:100%; display:block; z-index:6}
  #spawnHost{position:absolute; inset:0; z-index:6}
  #hudWrap{position:fixed; left:16px; top:14px; z-index:1500; pointer-events:none; display:none}
  .hud .cardlike{ background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.12); border-radius:12px; padding:8px 12px; backdrop-filter:blur(6px) }

  /* ซ่อนทุกอย่างตอนเล่น */
  body.playing header.brand, body.playing #menuBar,
  body.playing #help, body.playing #helpScene,
  body.playing #statBoard, body.playing #dailyPanel { display:none !important; }
  body.playing #hudWrap { display:block !important; }

  /* ผลลัพธ์: ปิดคลิกที่พื้นที่เล่น */
  body.result #c, body.result #spawnHost { pointer-events:none; filter:grayscale(.15) brightness(.9); }

  /* plane-lock */
  body.use3d  #c{z-index:12; pointer-events:auto}
  body.use3d  #spawnHost{display:none; pointer-events:none; z-index:0}
  body.no3d   #c{pointer-events:none; z-index:0}
  body.no3d   #spawnHost{display:block; pointer-events:auto; z-index:12}

  /* popup คะแนน */
  .hitPopup{ position:fixed; z-index:2002; font-weight:900; font-size:18px; color:#7CFFB2;
    text-shadow:0 2px 6px rgba(0,0,0,.55); pointer-events:none; transform:translate(-50%,-50%) scale(1); opacity:0;
    animation:popfade .9s ease forwards; }
  .hitPopup.bad{ color:#ff7c7c }
  @keyframes popfade{ 0%{opacity:0; transform:translate(-50%,-50%) scale(.8)}
                      15%{opacity:1; transform:translate(-50%,-64%) scale(1.08)}
                      100%{opacity:0; transform:translate(-50%,-110%) scale(1)} }
  `;
  const tag=document.createElement('style'); tag.textContent=css; document.head.appendChild(tag);
})();

// ---------- Ensure base DOM ----------
(function ensureDOM(){
  if(!$('#gameLayer')){ const gl=document.createElement('section'); gl.id='gameLayer'; document.body.appendChild(gl); }
  if(!$('#c')){ const cvs=document.createElement('canvas'); cvs.id='c'; $('#gameLayer').appendChild(cvs); }
  if(!$('#spawnHost')){ const h=document.createElement('div'); h.id='spawnHost'; $('#gameLayer').appendChild(h); }
})();

// ---------- Global state ----------
const STATE={
  lang:'th',
  difficulty:'Normal',
  modeKey:'goodjunk',
  running:false, paused:false,
  timeLeft:60, score:0, combo:0, bestCombo:0,
  startAt:0, modeAPI:null
};

// glue ให้โหมดเรียก
function addScore(delta/*, perfect*/){
  STATE.score += delta;
  STATE.combo += 1;
  STATE.bestCombo = Math.max(STATE.bestCombo, STATE.combo);
  T('#score', STATE.score); T('#combo','x'+STATE.combo);
}
function badHit(){ STATE.combo=0; T('#combo','x0'); }
window.__HHA_modeHooks = { addScore, badHit };

// ให้โหมดเรียกสร้าง popup ณ จุดที่ตี (ผ่าน NDC)
window.__HHA_showPopup = function(ndcX, ndcY, text, isGood=true){
  const cvs = $('#c'); const r = cvs.getBoundingClientRect();
  const x = (ndcX*0.5+0.5)*r.width  + r.left;
  const y = (-ndcY*0.5+0.5)*r.height + r.top;
  const d = document.createElement('div');
  d.className='hitPopup'+(isGood?'':' bad');
  d.textContent = text;
  d.style.left = x+'px'; d.style.top = y+'px';
  document.body.appendChild(d);
  setTimeout(()=>d.remove(), 1000);
};

function setTime(v){ STATE.timeLeft=Math.max(0,v); T('#time', Math.round(STATE.timeLeft)); }

// ---------- Three.js ----------
let THREE_CTX={ready:false};
function ensureThree(){
  if(THREE_CTX.ready) return Promise.resolve(THREE_CTX);
  return import('https://unpkg.com/three@0.159.0/build/three.module.js').then((THREE)=>{
    const cvs=$('#c');
    const renderer=new THREE.WebGLRenderer({canvas:cvs, antialias:true, alpha:true});
    renderer.setClearColor(0x000000,0);
    const scene=new THREE.Scene();
    const cam=new THREE.PerspectiveCamera(50, 16/9, 0.1, 50);
    cam.position.set(0,0,8);
    scene.add(new THREE.AmbientLight(0xffffff,0.65));
    const dl=new THREE.DirectionalLight(0xffffff,0.9); dl.position.set(4,5,5); scene.add(dl);

    function size(){
      // ถ้าเล่น → เต็มจอ, ถ้าไม่เล่น → ขนาดกรอบเดิม
      const w = document.body.classList.contains('playing') ? window.innerWidth  : ($('#gameLayer').getBoundingClientRect().width||960);
      const h = document.body.classList.contains('playing') ? window.innerHeight : ($('#gameLayer').getBoundingClientRect().height||540);
      cam.aspect=w/h; cam.updateProjectionMatrix(); renderer.setSize(w,h,false);
    }
    size(); new ResizeObserver(size).observe($('#gameLayer'));
    window.addEventListener('resize', size);

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

    function randInView(z=0){
      const zv=Math.min(0.6,Math.max(-0.25,z));
      const dist=(cam.position.z - zv);
      const halfH=Math.tan((cam.fov*Math.PI/180)/2)*dist;
      const halfW=halfH*cam.aspect;
      return {x:(Math.random()*2-1)*(halfW*0.95), y:(Math.random()*2-1)*(halfH*0.95), z:zv};
    }

    THREE_CTX={ready:true, THREE, renderer, scene, camera:cam, cam, ray, pointer, canvas:cvs, utils:{randInView}};
    return THREE_CTX;
  }).catch(()=>({ready:false}));
}

// ---------- plane-lock ----------
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

// ---------- mode loader ----------
const MOD_BASE='/webxr-health-mobile/HeroHealth/game/modes/';
const REG={}; function loadMode(key){ if(REG[key]) return Promise.resolve(REG[key]); const v=`v=g13&cb=${Date.now()}`; return import(`${MOD_BASE}${key}.js?${v}`).then(m=>(REG[key]=m)); }

// ---------- screens ----------
function enterHome(){
  document.body.classList.remove('playing','result');
  $('#result')?.setAttribute('style','display:none');
  $('header.brand')?.setAttribute('style',''); $('#menuBar')?.setAttribute('style','');
  setPlane('dom');
}
function enterPlaying(){
  document.body.classList.add('playing'); document.body.classList.remove('result');
  $('header.brand')?.setAttribute('style','display:none'); $('#menuBar')?.setAttribute('style','display:none');
  // ปรับขนาด renderer เป็นเต็มจอทันที
  if(THREE_CTX.ready){ const r=THREE_CTX.renderer; const c=THREE_CTX.camera; c.aspect=window.innerWidth/window.innerHeight; c.updateProjectionMatrix(); r.setSize(window.innerWidth, window.innerHeight, false); }
}
function enterResult(){
  document.body.classList.add('result'); document.body.classList.remove('playing');
  $('#result')?.setAttribute('style','display:block');
  setPlane('dom');
}

// ---------- lifecycle ----------
function resetState(){
  STATE.score=0; STATE.combo=0; STATE.bestCombo=0;
  setTime(STATE.difficulty==='Easy'?70:(STATE.difficulty==='Hard'?50:60));
  T('#score','0'); T('#combo','x0');
}
function startGame(){
  if(STATE.running) return;
  resetState(); enterPlaying();
  loadMode(STATE.modeKey).then(api=>{
    STATE.modeAPI=api;
    ensureThree().then(ctx=>{
      if(ctx.ready){ setPlane('3d'); api?.start?.({difficulty:STATE.difficulty, lang:STATE.lang, three:ctx}); }
      else{ setPlane('dom'); api?.start?.({difficulty:STATE.difficulty, lang:STATE.lang}); }
      STATE.running=true; STATE.paused=false; STATE.startAt=now();
      loop(); runTimer();
    });
  });
}
function finishGame(){
  STATE.running=false;
  try{ STATE.modeAPI?.stop?.(); }catch(_){}
  const secs=Math.round((now()-STATE.startAt)/1000);
  T('#resultText', `คะแนนรวม: ${STATE.score} • คอมโบสูงสุด: x${STATE.bestCombo} • เวลาเล่น: ${secs}s`);
  enterResult();
}
function backHome(){ enterHome(); }

// ---------- loop/timer ----------
let _last=0,_iv=null;
function loop(t){
  if(!STATE.running) return;
  requestAnimationFrame(loop);
  if(!t) t=now(); const dt=_last?(t-_last):16.6; _last=t;
  if(STATE.paused) return;
  try{ STATE.modeAPI?.update?.(dt); }catch(_){}
  if(THREE_CTX.ready && document.body.classList.contains('use3d')){
    try{ THREE_CTX.renderer.render(THREE_CTX.scene, THREE_CTX.cam||THREE_CTX.camera); }catch(_){}
  }
}
function runTimer(){
  if(_iv) clearInterval(_iv);
  _iv=setInterval(()=>{ if(!STATE.running) return clearInterval(_iv);
    if(!STATE.paused){ setTime(STATE.timeLeft-1); if(STATE.timeLeft<=0){ clearInterval(_iv); finishGame(); } }
  },1000);
}

// ---------- UI wires ----------
on($('#btn_start'),'click', startGame);
on($('#btn_replay'),'click', ()=>{ $('#result')&&( $('#result').style.display='none' ); startGame(); });
on($('#btn_home'),'click', ()=>{ $('#result')&&( $('#result').style.display='none' ); backHome(); });

on($('#d_easy'),  'click', ()=>{ STATE.difficulty='Easy';   T('#difficulty','Easy'); });
on($('#d_normal'),'click', ()=>{ STATE.difficulty='Normal'; T('#difficulty','Normal'); });
on($('#d_hard'),  'click', ()=>{ STATE.difficulty='Hard';   T('#difficulty','Hard'); });

on($('#m_goodjunk'),  'click', ()=>{ STATE.modeKey='goodjunk';   T('#modeName','ดี vs ขยะ'); });
on($('#m_groups'),    'click', ()=>{ STATE.modeKey='groups';     T('#modeName','จาน 5 หมู่'); });
on($('#m_hydration'), 'click', ()=>{ STATE.modeKey='hydration';  T('#modeName','สมดุลน้ำ'); });
on($('#m_plate'),     'click', ()=>{ STATE.modeKey='plate';      T('#modeName','จัดจานสุขภาพ'); });

enterHome();
