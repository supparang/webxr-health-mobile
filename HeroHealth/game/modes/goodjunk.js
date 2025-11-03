// === Hero Health Academy — game/modes/goodjunk.js (tuned for fever) ===
export const name='goodjunk';
const GOOD=['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK=['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD=['⭐'];
let host,items=[],alive=0;let cfg,spawnAcc=0,running=false;

const PRESET={Easy:{spawnEvery:1.3,maxAlive:5,life:3.6,size:66},Normal:{spawnEvery:1.1,maxAlive:7,life:3.3,size:60},Hard:{spawnEvery:0.95,maxAlive:8,life:2.9,size:54}};

function pick(a){return a[(Math.random()*a.length)|0];}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function ensureHost(){host=document.getElementById('spawnHost');if(!host){host=document.createElement('div');host.id='spawnHost';host.style.cssText='position:fixed;inset:0;z-index:5000;pointer-events:auto';document.body.appendChild(host);}}

function spawnOne(BUS){
  if(alive>=cfg.maxAlive)return;
  const r=Math.random();let kind='good';
  if(r>0.88)kind='gold';else if(r>0.6)kind='junk';
  const emoji=kind==='gold'?pick(GOLD):kind==='junk'?pick(JUNK):pick(GOOD);
  const pad=70;const ww=window.innerWidth,hh=window.innerHeight;
  const x=clamp(Math.random()*ww,pad,ww-pad),y=clamp(Math.random()*hh,pad+20,hh-pad-80);
  const s=cfg.size;const glow=kind==='gold'?'0 0 26px rgba(255,205,80,.85)':kind==='good'?'0 0 18px rgba(80,200,255,.35)':'0 0 18px rgba(255,120,120,.25)';
  const el=document.createElement('div');el.textContent=emoji;
  el.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(1);
  width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;font-size:${s-8}px;user-select:none;cursor:pointer;filter:drop-shadow(${glow});transition:transform .1s,opacity .2s;`;
  const life=cfg.life*(0.9+Math.random()*0.3);const obj={el,x,y,t:0,life,kind,dead:false};
  el.addEventListener('pointerdown',ev=>{
    if(obj.dead)return;obj.dead=true;alive=Math.max(0,alive-1);
    el.style.transform='translate(-50%,-50%) scale(0.8)';setTimeout(()=>el.style.opacity='0',40);setTimeout(()=>el.remove(),180);
    const ui={x:ev.clientX,y:ev.clientY};
    if(kind==='junk'){BUS.bad?.({ui});BUS.sfx?.bad?.();}
    else{
      const base=kind==='gold'?50:10;
      BUS.hit?.({points:base,kind:kind==='gold'?'perfect':'good',ui,meta:{golden:kind==='gold'}});
      if(kind==='gold')BUS.sfx?.power?.();else BUS.sfx?.good?.();
    }
  },{passive:true});
  host.appendChild(el);items.push(obj);alive++;
}

function tick(dt,BUS){
  if(!running)return;
  spawnAcc+=dt;const need=Math.floor(spawnAcc/cfg.spawnEvery);
  if(need>0){spawnAcc-=need*cfg.spawnEvery;for(let i=0;i<need;i++)spawnOne(BUS);}
  for(let i=items.length-1;i>=0;i--){const it=items[i];
    if(it.dead){items.splice(i,1);continue;}
    it.t+=dt;if(it.t>=it.life){it.dead=true;alive=Math.max(0,alive-1);
      it.el.style.opacity='0';setTimeout(()=>it.el.remove(),160);
      if(it.kind!=='junk')BUS.miss?.({});items.splice(i,1);}
  }
}

export function start({difficulty='Normal'}={}){
  ensureHost();running=true;items=[];alive=0;spawnAcc=0;cfg=PRESET[difficulty]||PRESET.Normal;
  host.style.pointerEvents='auto';document.querySelectorAll('canvas').forEach(c=>{c.style.pointerEvents='none';c.style.zIndex='1';});
  for(let i=0;i<3;i++)spawnOne({hit:()=>{},bad:()=>{},sfx:{}});
}
export function update(dt,BUS){if(!(dt>0)||dt>1.5)dt=0.016;tick(dt,BUS);}
export function stop(){running=false;}
export function cleanup(){running=false;try{host.innerHTML='';}catch{}items=[];alive=0;}
