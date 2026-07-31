(()=>{'use strict';
if(window.__JUMPDUCK_DUCK_POLISH_V60__)return;
window.__JUMPDUCK_DUCK_POLISH_V60__=true;

const world=document.getElementById('world');
if(!world||!window.CanvasRenderingContext2D)return;
const worldCtx=world.getContext('2d');
if(!worldCtx)return;

const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
const previousFillText=CanvasRenderingContext2D.prototype.fillText;
if(previousFillText.__jumpduckDuckV60Patched)return;

const state={
 groundF:null,lastX:null,lastAt:performance.now(),lean:0,wasJumping:false,
 landing:0,dust:[],perfectStreak:0,recoveryUntil:0
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const combo=()=>Number(document.getElementById('combo')?.textContent||0);
function ellipse(ctx,x,y,rx,ry,rotation=0){ctx.beginPath();ctx.ellipse(x,y,rx,ry,rotation,0,Math.PI*2);ctx.fill()}

function spawnDust(){
 if(reducedMotion)return;
 for(let i=0;i<6;i++)state.dust.push({x:(Math.random()-.5)*20,y:6,vx:(Math.random()-.5)*38,vy:-9-Math.random()*16,life:1,size:2.5+Math.random()*3});
 if(state.dust.length>16)state.dust.splice(0,state.dust.length-16);
}
function updateFx(dt){
 state.landing=Math.max(0,state.landing-dt/260);
 for(const p of state.dust){p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.vy+=40*dt/1000;p.life-=dt/430}
 state.dust=state.dust.filter(p=>p.life>0);
}
function drawDust(ctx){
 if(!state.dust.length)return;
 ctx.save();ctx.fillStyle='#fef3c7';
 for(const p of state.dust){ctx.globalAlpha=Math.max(0,p.life)*.62;ellipse(ctx,p.x,p.y,p.size*(1.2-p.life*.2),p.size*.58)}
 ctx.restore();
}
function drawJumpTrail(ctx,jumpLocal,lean){
 if(reducedMotion||jumpLocal<10)return;
 ctx.save();ctx.strokeStyle='#fff7ed';ctx.lineCap='round';
 const side=lean>=0?-1:1;
 for(let i=0;i<3;i++){
  ctx.globalAlpha=.19-i*.045;ctx.lineWidth=3-i*.55;
  ctx.beginPath();ctx.moveTo(side*(24+i*7),-12+i*5);ctx.quadraticCurveTo(side*(36+i*8),3+i*5,side*(48+i*10),18+i*7);ctx.stroke();
 }
 ctx.restore();
}
function drawDuckWind(ctx,isDuck,now){
 if(!isDuck||reducedMotion)return;
 ctx.save();ctx.strokeStyle='#fff';ctx.lineCap='round';ctx.lineWidth=2;
 for(let i=0;i<3;i++){
  const shift=((now*.08+i*19)%36)-18;ctx.globalAlpha=.18+i*.045;
  ctx.beginPath();ctx.moveTo(-34+shift,-68-i*6);ctx.quadraticCurveTo(shift,-72-i*6,34+shift,-68-i*6);ctx.stroke();
 }
 ctx.restore();
}
function drawRecovery(ctx,now){
 if(now>=state.recoveryUntil)return;
 const remain=clamp((state.recoveryUntil-now)/850,0,1);
 ctx.save();ctx.globalAlpha=.16+.12*remain;ctx.strokeStyle='#38bdf8';ctx.lineWidth=3;ctx.setLineDash([6,8]);ctx.lineDashOffset=-now*.03;
 ctx.beginPath();ctx.ellipse(0,-25,34+7*(1-remain),41+7*(1-remain),0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawHeroCape(ctx,now,c){
 if(c<12)return;
 const wave=reducedMotion?0:Math.sin(now*.014)*4;
 ctx.save();ctx.fillStyle=c>=18?'#7c3aed':'#ef4444';ctx.globalAlpha=.88;
 ctx.beginPath();ctx.moveTo(-11,-43);ctx.quadraticCurveTo(-30,-25+wave,-25,5);ctx.quadraticCurveTo(0,-5+wave,25,5);ctx.quadraticCurveTo(30,-25-wave,11,-43);ctx.closePath();ctx.fill();ctx.restore();
}
function drawHeroCrown(ctx,c){
 if(c<12)return;
 ctx.save();ctx.fillStyle='#facc15';ctx.strokeStyle='#fff';ctx.lineWidth=1.2;
 ctx.beginPath();ctx.moveTo(-11,-68);ctx.lineTo(-7,-78);ctx.lineTo(0,-71);ctx.lineTo(7,-78);ctx.lineTo(11,-68);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function drawStreakStars(ctx,now){
 if(state.perfectStreak<3||reducedMotion)return;
 const count=Math.min(5,2+Math.floor(state.perfectStreak/2));
 ctx.save();
 for(let i=0;i<count;i++){
  const a=now*.003+i*Math.PI*2/count,r=42+(i%2)*6;
  ctx.globalAlpha=.55+.25*Math.sin(now*.01+i);
  ctx.save();ctx.translate(Math.cos(a)*r,-27+Math.sin(a)*r*.85);ctx.rotate(a);ctx.font='13px serif';ctx.textAlign='center';previousFillText.call(ctx,'✨',0,0);ctx.restore();
 }
 ctx.restore();
}
function drawLandingRing(ctx){
 if(state.landing<=0)return;
 ctx.save();ctx.globalAlpha=.32*state.landing;ctx.strokeStyle='#fde68a';ctx.lineWidth=3;
 ctx.beginPath();ctx.ellipse(0,7,28+(1-state.landing)*18,6+(1-state.landing)*3,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}

function patchedFillText(text,x,y,maxWidth){
 if(this!==worldCtx||String(text)!=='🦆')return arguments.length>=4?previousFillText.call(this,text,x,y,maxWidth):previousFillText.call(this,text,x,y);
 try{
  const now=performance.now(),m=this.getTransform(),dt=Math.min(50,Math.max(1,now-state.lastAt));state.lastAt=now;updateFx(dt);
  if(state.groundF==null||m.f>state.groundF)state.groundF=m.f;
  else if(Math.abs((state.groundF||m.f)-m.f)<5)state.groundF=state.groundF*.985+m.f*.015;
  const jumpPx=Math.max(0,(state.groundF||m.f)-m.f),jumpLocal=jumpPx/Math.max(1,Math.abs(m.d));
  const isDuck=Math.abs(m.d/Math.max(.001,m.a))<.72,jumping=jumpLocal>7;
  if(state.wasJumping&&!jumping){state.landing=1;spawnDust()}
  state.wasJumping=jumping;
  const velocity=state.lastX==null?0:(m.e-state.lastX)/Math.max(16,dt);state.lastX=m.e;
  const leanTarget=reducedMotion?0:clamp(velocity*.18,-.24,.24);state.lean+=(leanTarget-state.lean)*.28;
  const c=combo();

  drawDust(this);drawLandingRing(this);drawJumpTrail(this,jumpLocal,state.lean);drawDuckWind(this,isDuck,now);drawRecovery(this,now);
  this.save();this.rotate(state.lean);drawHeroCape(this,now,c);
  if(arguments.length>=4)previousFillText.call(this,text,x,y,maxWidth);else previousFillText.call(this,text,x,y);
  drawHeroCrown(this,c);drawStreakStars(this,now);this.restore();
  return;
 }catch(error){
  console.warn('[JumpDuck Duck Polish V6.0]',error);
  return arguments.length>=4?previousFillText.call(this,text,x,y,maxWidth):previousFillText.call(this,text,x,y);
 }
}
patchedFillText.__jumpduckDuckV60Patched=true;
CanvasRenderingContext2D.prototype.fillText=patchedFillText;

const toast=document.getElementById('toast');
if(toast){
 new MutationObserver(()=>{
  const text=String(toast.textContent||'').toUpperCase(),now=performance.now();
  if(/MISS/.test(text)){state.perfectStreak=0;state.recoveryUntil=now+850}
  else if(/PERFECT/.test(text))state.perfectStreak++;
 }).observe(toast,{childList:true,characterData:true,subtree:true});
}

try{
 const nativeSetItem=Storage.prototype.setItem;
 if(!nativeSetItem.__jumpduckDuckV60StoragePatched){
  function duckSetItem(key,value){
   if(String(key)==='HHA_JUMPDUCK_LAST_RESULT'){
    try{
     const payload=JSON.parse(String(value||'{}'));
     payload.gameVersion='jumpduck-production-v6.0-duck-polish-pack-v2';
     payload.duckAnimationProfile='vector-duck-v2-lean-landing-trail-wind-hero-streak-recovery-v60';
     value=JSON.stringify(payload);
    }catch(_){ }
   }
   return nativeSetItem.call(this,key,value);
  }
  duckSetItem.__jumpduckDuckV60StoragePatched=true;Storage.prototype.setItem=duckSetItem;
 }
}catch(_){ }
})();