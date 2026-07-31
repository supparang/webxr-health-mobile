(()=>{'use strict';
if(window.__JUMPDUCK_DUCK_POLISH_V60__)return;
window.__JUMPDUCK_DUCK_POLISH_V60__=true;

const world=document.getElementById('world');
if(!world||!window.CanvasRenderingContext2D)return;
const worldCtx=world.getContext('2d');
if(!worldCtx)return;

const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
const nativeFillText=CanvasRenderingContext2D.prototype.fillText;
if(nativeFillText.__jumpduckDuckV60Patched)return;

const state={
 groundF:null,lastX:null,lastNow:performance.now(),lean:0,
 blinkAt:performance.now()+1800+Math.random()*1700,blinkUntil:0,
 emotion:'normal',emotionUntil:0,hitPulse:0,missShake:0,recoveryUntil:0,
 wasJumping:false,landingPulse:0,dust:[],perfectStreak:0
};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function combo(){return Number(document.getElementById('combo')?.textContent||0)}
function timeLeft(){return Number(document.getElementById('time')?.textContent||50)}
function phaseSpeed(){const t=timeLeft();return t<=7?1.55:t<=20?1.25:1}
function ellipse(ctx,x,y,rx,ry,rotation=0){ctx.beginPath();ctx.ellipse(x,y,rx,ry,rotation,0,Math.PI*2);ctx.fill()}
function lineEye(ctx,x,y,tilt=0){ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.beginPath();ctx.moveTo(-4,0);ctx.quadraticCurveTo(0,3,4,0);ctx.stroke();ctx.restore()}

function spawnLandingDust(){
 if(reducedMotion)return;
 for(let i=0;i<7;i++)state.dust.push({
  x:(Math.random()-.5)*20,y:5,vx:(Math.random()-.5)*42,vy:-10-Math.random()*18,
  life:1,size:2.5+Math.random()*3.5
 });
 if(state.dust.length>18)state.dust.splice(0,state.dust.length-18);
}
function updateDust(dt){
 for(const p of state.dust){p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.vy+=42*dt/1000;p.life-=dt/430}
 state.dust=state.dust.filter(p=>p.life>0);
}
function drawDust(ctx){
 if(!state.dust.length)return;
 ctx.save();ctx.fillStyle='#fef3c7';
 for(const p of state.dust){ctx.globalAlpha=Math.max(0,p.life)*.62;ellipse(ctx,p.x,p.y,p.size*(1.25-p.life*.25),p.size*.58)}
 ctx.restore();
}

function drawShadow(ctx,jumpLocal,isDuck){
 const scale=Math.max(.56,1-Math.min(.52,jumpLocal/150));
 const landing=1+state.landingPulse*.24;
 ctx.save();ctx.globalAlpha=.28*Math.max(.35,scale);ctx.fillStyle='#0f172a';
 ellipse(ctx,0,8+jumpLocal,25*scale*(isDuck?1.18:1)*landing,6*scale/landing);
 ctx.restore();
}
function drawJumpTrail(ctx,jumpLocal,lean){
 if(reducedMotion||jumpLocal<10)return;
 ctx.save();ctx.lineCap='round';ctx.strokeStyle='#fff7ed';
 for(let i=0;i<3;i++){
  ctx.globalAlpha=.20-i*.045;ctx.lineWidth=3-i*.55;
  const side=lean>=0?-1:1;
  ctx.beginPath();ctx.moveTo(side*(22+i*7),-10+i*5);ctx.quadraticCurveTo(side*(34+i*9),6+i*4,side*(45+i*11),18+i*7);ctx.stroke();
 }
 ctx.restore();
}
function drawDuckWind(ctx,isDuck,now){
 if(!isDuck||reducedMotion)return;
 ctx.save();ctx.strokeStyle='#ffffff';ctx.lineCap='round';ctx.lineWidth=2;
 for(let i=0;i<3;i++){
  const shift=((now*.08+i*19)%36)-18;
  ctx.globalAlpha=.18+i*.045;
  ctx.beginPath();ctx.moveTo(-34+shift,-68-i*6);ctx.quadraticCurveTo(0+shift,-72-i*6,34+shift,-68-i*6);ctx.stroke();
 }
 ctx.restore();
}
function drawRecovery(ctx,now){
 if(now>=state.recoveryUntil)return;
 const remain=(state.recoveryUntil-now)/850;
 ctx.save();ctx.globalAlpha=.16+.12*remain;ctx.strokeStyle='#38bdf8';ctx.lineWidth=3;ctx.setLineDash([6,8]);ctx.lineDashOffset=-now*.03;
 ctx.beginPath();ctx.ellipse(0,-25,33+8*(1-remain),40+8*(1-remain),0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawAura(ctx,now,c){
 if(c<5)return;
 const strength=Math.min(1,(c-4)/12);
 ctx.save();ctx.globalAlpha=.22+.18*strength;ctx.strokeStyle=c>=12?'#fb7185':'#facc15';ctx.lineWidth=3+2*strength;
 ctx.shadowColor=c>=12?'#fb7185':'#fde047';ctx.shadowBlur=10+13*strength;
 ctx.beginPath();ctx.ellipse(0,-25,36+Math.sin(now*.01)*2,43+Math.cos(now*.012)*2,0,0,Math.PI*2);ctx.stroke();
 if(c>=10&&!reducedMotion){ctx.fillStyle='#fff7ed';for(let i=0;i<4;i++){const a=now*.002+i*Math.PI*.5;ellipse(ctx,Math.cos(a)*39,-25+Math.sin(a)*45,2.2,2.2)}}
 ctx.restore();
}
function drawHeroMode(ctx,now,c){
 if(c<12)return;
 const wave=reducedMotion?0:Math.sin(now*.014)*4;
 ctx.save();
 ctx.fillStyle=c>=18?'#7c3aed':'#ef4444';ctx.globalAlpha=.88;
 ctx.beginPath();ctx.moveTo(-11,-43);ctx.quadraticCurveTo(-30,-25+wave,-25,5);ctx.quadraticCurveTo(0,-5+wave,25,5);ctx.quadraticCurveTo(30,-25-wave,11,-43);ctx.closePath();ctx.fill();
 ctx.globalAlpha=1;ctx.fillStyle='#facc15';ctx.strokeStyle='#fff';ctx.lineWidth=1.2;
 ctx.beginPath();ctx.moveTo(-11,-68);ctx.lineTo(-7,-78);ctx.lineTo(0,-71);ctx.lineTo(7,-78);ctx.lineTo(11,-68);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.restore();
}
function drawStreakStars(ctx,now){
 if(state.perfectStreak<3||reducedMotion)return;
 const count=Math.min(5,2+Math.floor(state.perfectStreak/2));
 ctx.save();ctx.fillStyle='#fff7ed';
 for(let i=0;i<count;i++){
  const a=now*.003+i*Math.PI*2/count,r=42+(i%2)*6;
  ctx.globalAlpha=.45+.35*Math.sin(now*.01+i)*.5+.18;
  ctx.save();ctx.translate(Math.cos(a)*r,-27+Math.sin(a)*r*.85);ctx.rotate(a);ctx.font='13px serif';ctx.textAlign='center';nativeFillText.call(ctx,'✨',0,0);ctx.restore();
 }
 ctx.restore();
}
function drawWing(ctx,side,flap,emotion){
 const sx=side<0?-1:1;
 ctx.save();ctx.translate(sx*18,-22);ctx.rotate(sx*(.12+flap));ctx.fillStyle=emotion==='miss'?'#fbbf24':'#facc15';
 ellipse(ctx,sx*2,0,12,17,sx*.38);ctx.fillStyle='#fde68a';ellipse(ctx,sx,-2,5.5,11,sx*.32);ctx.restore();
}

function drawDuck(ctx,now,isDuck,jumpLocal,laneVelocity){
 const dt=Math.min(50,Math.max(1,now-state.lastNow));state.lastNow=now;
 state.hitPulse=Math.max(0,state.hitPulse-dt/360);state.missShake=Math.max(0,state.missShake-dt/420);state.landingPulse=Math.max(0,state.landingPulse-dt/250);updateDust(dt);
 if(now>=state.blinkAt){state.blinkUntil=now+120;state.blinkAt=now+2500+Math.random()*1900}
 if(now>state.emotionUntil)state.emotion='normal';

 const jumping=jumpLocal>7;
 if(state.wasJumping&&!jumping){state.landingPulse=1;spawnLandingDust()}
 state.wasJumping=jumping;
 const speed=phaseSpeed();
 const leanTarget=reducedMotion?0:clamp(laneVelocity*.18,-.24,.24);
 state.lean+=(leanTarget-state.lean)*.28;
 const bob=(!jumping&&!isDuck&&!reducedMotion)?Math.sin(now*.015*speed)*2.8:0;
 const flapBase=reducedMotion?.05:(.10+Math.sin(now*.028*speed)*.17);
 const happyFlap=(state.emotion==='happy'||state.emotion==='wow'||state.emotion==='celebrate')?.14:0;
 const flap=flapBase+happyFlap;
 const shake=state.missShake>0&&!reducedMotion?Math.sin(now*.075)*3.2*state.missShake:0;
 const pulse=1+state.hitPulse*.10+state.landingPulse*.06;
 const jumpStretch=jumping?1.06:1;
 const squash=isDuck?.92:(1-state.landingPulse*.08);

 drawShadow(ctx,jumpLocal,isDuck);drawDust(ctx);drawJumpTrail(ctx,jumpLocal,state.lean);drawDuckWind(ctx,isDuck,now);
 ctx.save();ctx.translate(shake,bob);ctx.rotate(state.lean);ctx.scale(pulse*(jumping?.96:1),pulse*jumpStretch*squash);
 drawRecovery(ctx,now);drawAura(ctx,now,combo());drawHeroMode(ctx,now,combo());drawStreakStars(ctx,now);

 const step=reducedMotion?0:Math.sin(now*.025*speed)*3.2;
 ctx.strokeStyle='#f97316';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-8,-3);ctx.lineTo(-8+step,5);ctx.moveTo(8,-3);ctx.lineTo(8-step,5);ctx.stroke();
 ctx.fillStyle='#fb923c';ellipse(ctx,-8+step,6,7,2.8,-.12);ellipse(ctx,8-step,6,7,2.8,.12);

 ctx.fillStyle=state.emotion==='miss'?'#fbbf24':'#facc15';ellipse(ctx,0,-20,25,23);ctx.fillStyle='#fde68a';ellipse(ctx,0,-17,15,14);
 drawWing(ctx,-1,flap,state.emotion);drawWing(ctx,1,flap,state.emotion);
 ctx.fillStyle='#facc15';ellipse(ctx,0,-49,17.5,17.5);ctx.fillStyle='#fde047';ellipse(ctx,-4,-52,11,10);

 const blink=now<state.blinkUntil;
 ctx.strokeStyle='#1f2937';ctx.fillStyle='#1f2937';ctx.lineWidth=2.8;ctx.lineCap='round';
 if(state.emotion==='happy'||state.emotion==='wow'||state.emotion==='celebrate'){
  lineEye(ctx,-6,-53,-.10);lineEye(ctx,6,-53,.10);
 }else if(blink){lineEye(ctx,-6,-53,0);lineEye(ctx,6,-53,0)
 }else if(state.emotion==='miss'){
  ctx.beginPath();ctx.moveTo(-10,-56);ctx.lineTo(-3,-52);ctx.moveTo(10,-56);ctx.lineTo(3,-52);ctx.stroke();ellipse(ctx,-6,-52,2.2,2.8);ellipse(ctx,6,-52,2.2,2.8);
 }else{ellipse(ctx,-6,-53,2.4,3.1);ellipse(ctx,6,-53,2.4,3.1);ctx.fillStyle='#fff';ellipse(ctx,-5.3,-54,0.8,1);ellipse(ctx,6.7,-54,0.8,1)}

 ctx.fillStyle=state.emotion==='miss'?'#fb7185':'#fb923c';ctx.beginPath();ctx.moveTo(-10,-46);ctx.quadraticCurveTo(0,-41,10,-46);ctx.quadraticCurveTo(0,-50,-10,-46);ctx.fill();

 const c=combo();
 if(c>=8){ctx.fillStyle='#0ea5e9';ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,-24,7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='900 8px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';nativeFillText.call(ctx,'H',0,-23.5)}
 ctx.restore();
}

function patchedFillText(text,x,y,maxWidth){
 if(this!==worldCtx||String(text)!=='🦆')return arguments.length>=4?nativeFillText.call(this,text,x,y,maxWidth):nativeFillText.call(this,text,x,y);
 try{
  const now=performance.now(),m=this.getTransform(),dt=Math.max(16,now-state.lastNow);
  if(state.groundF==null||m.f>state.groundF)state.groundF=m.f;
  else if(Math.abs((state.groundF||m.f)-m.f)<5)state.groundF=state.groundF*.985+m.f*.015;
  const jumpPx=Math.max(0,(state.groundF||m.f)-m.f),jumpLocal=jumpPx/Math.max(1,Math.abs(m.d));
  const isDuck=Math.abs(m.d/Math.max(.001,m.a))<.72;
  const laneVelocity=state.lastX==null?0:(m.e-state.lastX)/dt;state.lastX=m.e;
  drawDuck(this,now,isDuck,jumpLocal,laneVelocity);return;
 }catch(error){
  console.warn('[JumpDuck Duck Polish V6.0]',error);
  return arguments.length>=4?nativeFillText.call(this,text,x,y,maxWidth):nativeFillText.call(this,text,x,y);
 }
}
patchedFillText.__jumpduckDuckV60Patched=true;
CanvasRenderingContext2D.prototype.fillText=patchedFillText;

const toast=document.getElementById('toast');
if(toast){
 const observer=new MutationObserver(()=>{
  const text=String(toast.textContent||'').toUpperCase(),now=performance.now();
  if(/MISS/.test(text)){
   state.perfectStreak=0;state.emotion='miss';state.emotionUntil=now+650;state.missShake=1;state.recoveryUntil=now+850;
  }else if(/PERFECT/.test(text)){
   state.perfectStreak++;state.emotion=state.perfectStreak>=3?'celebrate':'happy';state.emotionUntil=now+(state.perfectStreak>=3?950:720);state.hitPulse=1;
  }else if(/GREAT|MISSION CLEAR/.test(text)){
   state.emotion='happy';state.emotionUntil=now+720;state.hitPulse=1;
  }else if(/LEVEL UP|FINAL RUSH/.test(text)){
   state.emotion='wow';state.emotionUntil=now+850;state.hitPulse=1;
  }
 });
 observer.observe(toast,{childList:true,characterData:true,subtree:true});
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