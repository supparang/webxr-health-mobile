// === Hero Health Academy — main.js (G13.1 Click-Shatter Fixed & Full-Bleed) ===

window.__HHA_BOOT_OK = true;

const $  = (s)=>document.querySelector(s);
const on = (el,ev,fn)=>{ if(el) el.addEventListener(ev,fn,false); };
const T  = (sel,v)=>{ const el=(typeof sel==='string')?$(sel):sel; if(el) el.textContent=v; };
const now= ()=>performance?.now?.()??Date.now();

// ---------- CSS ----------
(function(){
  const css = `
  html,body{height:100%;margin:0;background:#0b1626;overflow:hidden;}
  #gameLayer{position:fixed;inset:0;width:100vw;height:100vh;overflow:hidden;background:#0b1626;}
  #c{position:absolute;inset:0;width:100%;height:100%;z-index:6;display:block;}
  #hudWrap{position:fixed;left:16px;top:14px;z-index:1500;pointer-events:none;display:none;}
  .hud .cardlike{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);
                 border-radius:12px;padding:8px 12px;backdrop-filter:blur(6px);}
  body.playing header.brand,body.playing #menuBar{display:none!important;}
  body.playing #hudWrap{display:block!important;}
  body.result #c{pointer-events:none;filter:grayscale(.2) brightness(.85);}
  .hitPopup{position:fixed;z-index:2002;font-weight:900;font-size:20px;color:#7CFFB2;
            text-shadow:0 2px 6px rgba(0,0,0,.55);pointer-events:none;
            transform:translate(-50%,-50%) scale(1);opacity:0;
            animation:popfade .9s ease forwards;}
  .hitPopup.bad{color:#ff7c7c}
  @keyframes popfade{
    0%{opacity:0;transform:translate(-50%,-50%) scale(.8)}
    15%{opacity:1;transform:translate(-50%,-64%) scale(1.08)}
    100%{opacity:0;transform:translate(-50%,-110%) scale(1)}}
  `;
  const tag=document.createElement('style');tag.textContent=css;document.head.appendChild(tag);
})();

// ---------- Base DOM ----------
(function ensureDOM(){
  if(!$('#gameLayer')){const g=document.createElement('section');g.id='gameLayer';document.body.appendChild(g);}
  if(!$('#c')){const c=document.createElement('canvas');c.id='c';$('#gameLayer').appendChild(c);}
})();

// ---------- State ----------
const STATE={lang:'th',difficulty:'Normal',modeKey:'goodjunk',running:false,paused:false,
             timeLeft:60,score:0,combo:0,bestCombo:0,startAt:0,modeAPI:null};

// HUD glue
function addScore(d){STATE.score+=d;STATE.combo+=1;STATE.bestCombo=Math.max(STATE.bestCombo,STATE.combo);
  T('#score',STATE.score);T('#combo','x'+STATE.combo);}
function badHit(){STATE.combo=0;T('#combo','x0');}
window.__HHA_modeHooks={addScore,badHit};
window.__HHA_showPopup=function(ndcX,ndcY,text,good=true){
  const cvs=$('#c');const r=cvs.getBoundingClientRect();
  const x=(ndcX*0.5+0.5)*r.width+r.left;const y=(-ndcY*0.5+0.5)*r.height+r.top;
  const d=document.createElement('div');d.className='hitPopup'+(good?'':' bad');
  d.textContent=text;d.style.left=x+'px';d.style.top=y+'px';
  document.body.appendChild(d);setTimeout(()=>d.remove(),900);
};
function setTime(v){STATE.timeLeft=Math.max(0,v);T('#time',Math.round(STATE.timeLeft));}

// ---------- THREE.js ----------
let THREE_CTX={ready:false};
function ensureThree(){
  if(THREE_CTX.ready) return Promise.resolve(THREE_CTX);
  return import('https://unpkg.com/three@0.159.0/build/three.module.js').then((THREE)=>{
    const cvs=$('#c');
    const renderer=new THREE.WebGLRenderer({canvas:cvs,antialias:true,alpha:true});
    renderer.setClearColor(0x000000,0);
    const scene=new THREE.Scene();
    const cam=new THREE.PerspectiveCamera(50,window.innerWidth/window.innerHeight,0.1,50);
    cam.position.set(0,0,8);
    scene.add(new THREE.AmbientLight(0xffffff,0.7));
    const dl=new THREE.DirectionalLight(0xffffff,0.9);dl.position.set(4,5,5);scene.add(dl);
    function resize(){
      const w=window.innerWidth,h=window.innerHeight;
      cam.aspect=w/h;cam.updateProjectionMatrix();renderer.setSize(w,h,false);
    }
    resize();window.addEventListener('resize',resize);

    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
    ray.params.Sprite=ray.params.Sprite||{};ray.params.Sprite.threshold=0.6;

    function pointerFrom(e){
      const rect=cvs.getBoundingClientRect();
      const cx=(e?.clientX??e?.touches?.[0]?.clientX??rect.left+rect.width/2);
      const cy=(e?.clientY??e?.touches?.[0]?.clientY??rect.top+rect.height/2);
      pointer.x=((cx-rect.left)/rect.width)*2-1;
      pointer.y=-((cy-rect.top)/rect.height)*2+1;
    }
    function fire(){STATE.modeAPI?.onPointer?.({THREE,renderer,scene,camera:cam,cam,ray,pointer,canvas:cvs});}

    ['click','pointerdown','pointerup','touchstart'].forEach(ev=>{
      cvs.addEventListener(ev,e=>{
        if(!document.body.classList.contains('use3d'))return;
        pointerFrom(e);fire();
      },false);
    });

    function randInView(z=0){
      const zv=Math.min(0.6,Math.max(-0.25,z));
      const dist=(cam.position.z - zv);
      const halfH=Math.tan((cam.fov*Math.PI/180)/2)*dist;
      const halfW=halfH*cam.aspect;
      return {x:(Math.random()*2-1)*(halfW*0.9),y:(Math.random()*2-1)*(halfH*0.9),z:zv};
    }

    THREE_CTX={ready:true,THREE,renderer,scene,camera:cam,cam,ray,pointer,canvas:cvs,utils:{randInView}};
    return THREE_CTX;
  });
}

// ---------- Plane Lock ----------
function setPlane(mode){
  const cvs=$('#c');
  if(mode==='3d'){document.body.classList.add('use3d');cvs.style.pointerEvents='auto';}
  else{document.body.classList.remove('use3d');cvs.style.pointerEvents='none';}
}

// ---------- Mode Loader ----------
const MOD_BASE='/webxr-health-mobile/HeroHealth/game/modes/';
const REG={};
function loadMode(k){if(REG[k])return Promise.resolve(REG[k]);
  return import(`${MOD_BASE}${k}.js?v=g13.1&cb=${Date.now()}`).then(m=>(REG[k]=m));
}

// ---------- Screen ----------
function enterHome(){document.body.classList.remove('playing','result');$('#result').style.display='none';}
function enterPlaying(){document.body.classList.add('playing');document.body.classList.remove('result');
  $('#hudWrap').style.display='block';}
function enterResult(){document.body.classList.add('result');document.body.classList.remove('playing');
  $('#result').style.display='block';}

// ---------- Lifecycle ----------
function resetState(){STATE.score=0;STATE.combo=0;STATE.bestCombo=0;
  setTime(STATE.difficulty==='Easy'?70:(STATE.difficulty==='Hard'?50:60));
  T('#score','0');T('#combo','x0');}
function startGame(){
  if(STATE.running)return;resetState();enterPlaying();
  loadMode(STATE.modeKey).then(api=>{
    STATE.modeAPI=api;
    ensureThree().then(ctx=>{
      if(ctx.ready){setPlane('3d');api.start({difficulty:STATE.difficulty,lang:STATE.lang,three:ctx});}
      else{setPlane('dom');api.start({difficulty:STATE.difficulty,lang:STATE.lang});}
      STATE.running=true;STATE.paused=false;STATE.startAt=now();
      loop();timer();
    });
  });
}
function finishGame(){
  STATE.running=false;
  try{STATE.modeAPI?.stop?.();}catch(_){}
  const secs=Math.round((now()-STATE.startAt)/1000);
  T('#resultText',`คะแนนรวม: ${STATE.score} • คอมโบสูงสุด: x${STATE.bestCombo} • เวลาเล่น: ${secs}s`);
  enterResult();
}

// ---------- Loop ----------
let _last=0,_iv=null;
function loop(t){
  if(!STATE.running)return;
  requestAnimationFrame(loop);
  if(!t)t=now();const dt=_last?(t-_last):16.6;_last=t;
  try{STATE.modeAPI?.update?.(dt);}catch(_){}
  if(THREE_CTX.ready&&document.body.classList.contains('use3d')){
    THREE_CTX.renderer.render(THREE_CTX.scene,THREE_CTX.cam||THREE_CTX.camera);
  }
}
function timer(){
  if(_iv)clearInterval(_iv);
  _iv=setInterval(()=>{
    if(!STATE.running)return clearInterval(_iv);
    setTime(STATE.timeLeft-1);
    if(STATE.timeLeft<=0){clearInterval(_iv);finishGame();}
  },1000);
}

// ---------- UI ----------
on($('#btn_start'),'click',startGame);
on($('#btn_replay'),'click',()=>{$('#result').style.display='none';startGame();});
on($('#btn_home'),'click',()=>{$('#result').style.display='none';enterHome();});

on($('#d_easy'),'click',()=>{STATE.difficulty='Easy';});
on($('#d_normal'),'click',()=>{STATE.difficulty='Normal';});
on($('#d_hard'),'click',()=>{STATE.difficulty='Hard';});
on($('#m_goodjunk'),'click',()=>{STATE.modeKey='goodjunk';});

enterHome();
