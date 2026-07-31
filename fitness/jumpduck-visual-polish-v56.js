(()=>{'use strict';
if(window.__JUMPDUCK_VISUAL_POLISH_V56__)return;
window.__JUMPDUCK_VISUAL_POLISH_V56__=true;

const game=document.getElementById('game');
const world=document.getElementById('world');
if(!game||!world)return;

const fx=document.createElement('canvas');
fx.id='jumpduckFxCanvas';
fx.setAttribute('aria-hidden','true');
Object.assign(fx.style,{
 position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'3',
 pointerEvents:'none',touchAction:'none'
});
world.insertAdjacentElement('afterend',fx);
const ctx=fx.getContext('2d',{alpha:true,desynchronized:true});
if(!ctx)return;

const reducedMotion=matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
const lowPower=(Number(navigator.deviceMemory||8)<=3)||(Number(navigator.hardwareConcurrency||8)<=4);
const FPS=reducedMotion?15:(lowPower?22:30);
const FRAME_MS=1000/FPS;
const MAX_AMBIENT=lowPower?10:18;
let dpr=1,w=1,h=1,lastFrame=0,lastPhase='EASY',pulse=0,pulseKind='good',rushFlash=0;
let running=false,raf=0;

const clouds=[
 {x:.08,y:.16,s:.72,v:.010},{x:.38,y:.11,s:1.0,v:.007},{x:.70,y:.20,s:.82,v:.012},{x:.91,y:.10,s:.58,v:.009}
];
const roadside=Array.from({length:12},(_,i)=>({
 side:i%2?'right':'left',offset:(i/12),kind:i%4===0?'sign':i%3===0?'flower':'tree'
}));
const ambient=[];

function resize(){
 dpr=Math.min(devicePixelRatio||1,lowPower?1:1.25);
 const rect=game.getBoundingClientRect();
 w=Math.max(1,Math.round(rect.width));h=Math.max(1,Math.round(rect.height));
 fx.width=Math.max(1,Math.round(w*dpr));fx.height=Math.max(1,Math.round(h*dpr));
 fx.style.width=w+'px';fx.style.height=h+'px';
 ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize',resize,{passive:true});
resize();

function phase(){
 const t=Number(document.getElementById('time')?.textContent||50);
 return t<=7?'RUSH':t<=20?'NORMAL':'EASY';
}
function combo(){return Number(document.getElementById('combo')?.textContent||0)}
function isActive(){return !game.classList.contains('hidden')}

function roundedCloud(x,y,s){
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=.72;
 ctx.fillStyle='#ffffff';
 ctx.beginPath();ctx.arc(-34,2,18,0,Math.PI*2);ctx.arc(-10,-9,25,0,Math.PI*2);ctx.arc(17,-2,21,0,Math.PI*2);ctx.arc(38,4,15,0,Math.PI*2);ctx.rect(-35,0,74,20);ctx.fill();
 ctx.restore();
}

function drawSky(now,p){
 const speed=p==='RUSH'?1.8:p==='NORMAL'?1.25:1;
 for(const c of clouds){
  const travel=(now*.001*c.v*speed)%1.35;
  let x=(c.x+travel)%1.35-.15;
  roundedCloud(x*w,c.y*h,c.s*Math.max(.68,Math.min(1.15,w/420)));
 }
 const horizon=h*.43;
 ctx.save();
 ctx.globalAlpha=.52;
 ctx.fillStyle=p==='RUSH'?'#4338ca':'#60a5fa';
 ctx.beginPath();ctx.moveTo(0,horizon);ctx.lineTo(0,horizon-h*.095);ctx.quadraticCurveTo(w*.12,horizon-h*.19,w*.26,horizon-h*.055);ctx.lineTo(w*.35,horizon);ctx.closePath();ctx.fill();
 ctx.beginPath();ctx.moveTo(w,horizon);ctx.lineTo(w,horizon-h*.08);ctx.quadraticCurveTo(w*.86,horizon-h*.18,w*.73,horizon-h*.045);ctx.lineTo(w*.64,horizon);ctx.closePath();ctx.fill();
 ctx.restore();
}

function drawTree(x,y,scale){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 ctx.fillStyle='#854d0e';ctx.fillRect(-3,-26,6,28);
 ctx.fillStyle='#16a34a';ctx.beginPath();ctx.arc(0,-32,14,0,Math.PI*2);ctx.arc(-9,-24,10,0,Math.PI*2);ctx.arc(10,-24,10,0,Math.PI*2);ctx.fill();
 ctx.restore();
}
function drawFlower(x,y,scale){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.strokeStyle='#166534';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-16);ctx.stroke();ctx.fillStyle='#fde047';
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.arc(Math.cos(a)*6,-16+Math.sin(a)*6,4,0,Math.PI*2);ctx.fill()}
 ctx.fillStyle='#f97316';ctx.beginPath();ctx.arc(0,-16,4,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawSign(x,y,scale){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle='#78350f';ctx.fillRect(-2,-24,4,25);ctx.fillStyle='#fef3c7';ctx.strokeStyle='#f59e0b';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-18,-45,36,22,6);ctx.fill();ctx.stroke();ctx.font='15px serif';ctx.textAlign='center';ctx.fillText('💚',0,-29);ctx.restore();
}
function drawRoadside(now,p){
 const phaseSpeed=p==='RUSH'?1.8:p==='NORMAL'?1.35:1;
 const cycle=(now*.00016*phaseSpeed)%1;
 for(const item of roadside){
  const z=(item.offset+cycle)%1;
  const perspective=.28+z*.92;
  const y=h*.44+Math.pow(z,1.45)*h*.43;
  const edge=.46+z*.47;
  const x=item.side==='left'?w*(.5-edge):w*(.5+edge);
  const s=perspective*(w<430?.76:1);
  ctx.globalAlpha=.30+z*.65;
  if(item.kind==='tree')drawTree(x,y,s);
  else if(item.kind==='flower')drawFlower(x,y,s);
  else drawSign(x,y,s);
 }
 ctx.globalAlpha=1;
}

function spawnAmbient(now,p){
 if(reducedMotion||ambient.length>=MAX_AMBIENT)return;
 const chance=p==='RUSH'?.16:p==='NORMAL'?.08:.035;
 if(Math.random()>chance)return;
 ambient.push({
  x:Math.random()<.5?Math.random()*w*.22:w*(.78+Math.random()*.22),
  y:h*(.25+Math.random()*.58),vx:(Math.random()-.5)*18,vy:22+Math.random()*32,
  spin:Math.random()*Math.PI*2,life:1,born:now,kind:Math.random()<.7?'leaf':'spark'
 });
}
function drawAmbient(now,dt,p){
 spawnAmbient(now,p);
 for(const a of ambient){
  a.x+=a.vx*dt;a.y+=a.vy*dt;a.spin+=dt*2.8;a.life-=dt*(p==='RUSH'?.7:.48);
  ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.spin);ctx.globalAlpha=Math.max(0,a.life)*.75;
  if(a.kind==='leaf'){ctx.fillStyle='#facc15';ctx.beginPath();ctx.ellipse(0,0,5,2.4,0,0,Math.PI*2);ctx.fill()}
  else{ctx.fillStyle='#fff7ed';ctx.fillRect(-1,-5,2,10);ctx.fillRect(-5,-1,10,2)}
  ctx.restore();
 }
 for(let i=ambient.length-1;i>=0;i--)if(ambient[i].life<=0||ambient[i].y>h+20)ambient.splice(i,1);
 ctx.globalAlpha=1;
}

function drawSpeedLines(now,p){
 if(p==='EASY'||reducedMotion)return;
 const count=p==='RUSH'?(lowPower?10:18):(lowPower?6:10);
 ctx.save();ctx.lineCap='round';
 for(let i=0;i<count;i++){
  const seed=(i*97)%101;
  const side=i%2?-1:1;
  const y=((now*.12+i*83)%Math.max(1,h*.76))+h*.18;
  const x=side<0?w*(.03+(seed%17)/100):w*(.97-(seed%17)/100);
  const len=(p==='RUSH'?42:25)+(seed%24);
  ctx.globalAlpha=p==='RUSH'?.34:.18;ctx.strokeStyle='#ffffff';ctx.lineWidth=p==='RUSH'?3:2;
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-side*len,y-len*.38);ctx.stroke();
 }
 ctx.restore();ctx.globalAlpha=1;
}

function drawComboAura(c,p){
 if(c<4)return;
 const intensity=Math.min(1,(c-3)/9);
 ctx.save();
 const g=ctx.createRadialGradient(w*.5,h*.58,Math.min(w,h)*.18,w*.5,h*.58,Math.max(w,h)*.72);
 g.addColorStop(0,'rgba(255,255,255,0)');
 g.addColorStop(.78,'rgba(250,204,21,0)');
 g.addColorStop(1,`rgba(${p==='RUSH'?'244,114,182':'250,204,21'},${.08+.14*intensity})`);
 ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore();
}

function drawPulse(){
 if(pulse<=0)return;
 ctx.save();
 const alpha=.18*pulse;
 ctx.strokeStyle=pulseKind==='bad'?`rgba(239,68,68,${alpha})`:`rgba(250,204,21,${alpha})`;
 ctx.lineWidth=14+18*(1-pulse);ctx.strokeRect(4,4,w-8,h-8);ctx.restore();
 pulse=Math.max(0,pulse-.06);
}
function drawRushFlash(){
 if(rushFlash<=0)return;
 ctx.save();ctx.globalAlpha=rushFlash*.34;ctx.fillStyle='#f97316';ctx.fillRect(0,0,w,h);ctx.restore();
 rushFlash=Math.max(0,rushFlash-.045);
}

function frame(now){
 raf=requestAnimationFrame(frame);
 if(now-lastFrame<FRAME_MS)return;
 const dt=Math.min(.06,(now-lastFrame)/1000||0);lastFrame=now;
 if(!isActive()){ctx.clearRect(0,0,w,h);running=false;return}
 if(!running){running=true;resize()}
 const p=phase();
 if(p!==lastPhase){if(p==='RUSH')rushFlash=1;lastPhase=p}
 ctx.clearRect(0,0,w,h);
 drawSky(now,p);
 drawRoadside(now,p);
 drawSpeedLines(now,p);
 drawAmbient(now,dt,p);
 drawComboAura(combo(),p);
 drawPulse();
 drawRushFlash();
}

const toast=document.getElementById('toast');
if(toast){
 const obs=new MutationObserver(()=>{
  const text=String(toast.textContent||'');
  if(/MISS/i.test(text)){pulseKind='bad';pulse=1}
  else if(/PERFECT|GREAT|MISSION CLEAR|LEVEL UP/i.test(text)){pulseKind='good';pulse=1}
 });
 obs.observe(toast,{childList:true,characterData:true,subtree:true});
}

try{
 const nativeSetItem=Storage.prototype.setItem;
 if(!nativeSetItem.__jumpduckVisualV56Patched){
  function visualSetItem(key,value){
   if(String(key)==='HHA_JUMPDUCK_LAST_RESULT'){
    try{
     const payload=JSON.parse(String(value||'{}'));
     payload.gameVersion='jumpduck-production-v5.6-visual-polish';
     payload.visualEffectProfile='canvas2d-lightweight-parallax-v56';
     payload.visualEffectFps=FPS;
     value=JSON.stringify(payload);
    }catch(_){ }
   }
   return nativeSetItem.call(this,key,value);
  }
  visualSetItem.__jumpduckVisualV56Patched=true;
  Storage.prototype.setItem=visualSetItem;
 }
}catch(_){ }

raf=requestAnimationFrame(frame);
addEventListener('pagehide',()=>cancelAnimationFrame(raf),{once:true});
})();
