(()=>{'use strict';
if(window.__JUMPDUCK_DUCK_POLISH_V59__)return;
window.__JUMPDUCK_DUCK_POLISH_V59__=true;

const world=document.getElementById('world');
if(!world||!window.CanvasRenderingContext2D)return;
const worldCtx=world.getContext('2d');
if(!worldCtx)return;

const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
const nativeFillText=CanvasRenderingContext2D.prototype.fillText;
if(nativeFillText.__jumpduckDuckV59Patched)return;

const state={
 groundF:null,
 blinkAt:performance.now()+1800+Math.random()*1700,
 blinkUntil:0,
 emotion:'normal',
 emotionUntil:0,
 hitPulse:0,
 missShake:0,
 lastNow:performance.now()
};

function combo(){return Number(document.getElementById('combo')?.textContent||0)}
function timeLeft(){return Number(document.getElementById('time')?.textContent||50)}
function phaseSpeed(){const t=timeLeft();return t<=7?1.55:t<=20?1.25:1}
function ellipse(ctx,x,y,rx,ry,rotation=0){ctx.beginPath();ctx.ellipse(x,y,rx,ry,rotation,0,Math.PI*2);ctx.fill()}
function lineEye(ctx,x,y,tilt=0){ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.beginPath();ctx.moveTo(-4,0);ctx.quadraticCurveTo(0,3,4,0);ctx.stroke();ctx.restore()}

function drawShadow(ctx,jumpLocal,isDuck){
 const scale=Math.max(.56,1-Math.min(.52,jumpLocal/150));
 ctx.save();
 ctx.globalAlpha=.28*Math.max(.35,scale);
 ctx.fillStyle='#0f172a';
 ellipse(ctx,0,8+jumpLocal,25*scale*(isDuck?1.18:1),6*scale);
 ctx.restore();
}

function drawAura(ctx,now,c){
 if(c<5)return;
 const strength=Math.min(1,(c-4)/12);
 ctx.save();
 ctx.globalAlpha=.22+.18*strength;
 ctx.strokeStyle=c>=12?'#fb7185':'#facc15';
 ctx.lineWidth=3+2*strength;
 ctx.shadowColor=c>=12?'#fb7185':'#fde047';
 ctx.shadowBlur=10+13*strength;
 ctx.beginPath();
 ctx.ellipse(0,-25,36+Math.sin(now*.01)*2,43+Math.cos(now*.012)*2,0,0,Math.PI*2);
 ctx.stroke();
 if(c>=10&&!reducedMotion){
  ctx.fillStyle='#fff7ed';
  for(let i=0;i<4;i++){
   const a=now*.002+i*Math.PI*.5;
   const x=Math.cos(a)*39,y=-25+Math.sin(a)*45;
   ellipse(ctx,x,y,2.2,2.2);
  }
 }
 ctx.restore();
}

function drawWing(ctx,side,flap,emotion){
 const sx=side<0?-1:1;
 ctx.save();
 ctx.translate(sx*18,-22);
 ctx.rotate(sx*(.12+flap));
 ctx.fillStyle=emotion==='miss'?'#fbbf24':'#facc15';
 ellipse(ctx,sx*2,0,12,17,sx*.38);
 ctx.fillStyle='#fde68a';
 ellipse(ctx,sx*1,-2,5.5,11,sx*.32);
 ctx.restore();
}

function drawDuck(ctx,now,isDuck,jumpLocal){
 const dt=Math.min(50,now-state.lastNow);state.lastNow=now;
 state.hitPulse=Math.max(0,state.hitPulse-dt/360);
 state.missShake=Math.max(0,state.missShake-dt/420);
 if(now>=state.blinkAt){state.blinkUntil=now+120;state.blinkAt=now+2500+Math.random()*1900}
 if(now>state.emotionUntil)state.emotion='normal';

 const jumping=jumpLocal>7;
 const speed=phaseSpeed();
 const bob=(!jumping&&!isDuck&&!reducedMotion)?Math.sin(now*.015*speed)*2.8:0;
 const flapBase=reducedMotion?.05:(.10+Math.sin(now*.028*speed)*.17);
 const happyFlap=state.emotion==='happy'||state.emotion==='wow'?.12:0;
 const flap=flapBase+happyFlap;
 const shake=state.missShake>0&&!reducedMotion?Math.sin(now*.075)*3.2*state.missShake:0;
 const pulse=1+state.hitPulse*.10;
 const jumpStretch=jumping?1.06:1;
 const squash=isDuck?.92:1;

 drawShadow(ctx,jumpLocal,isDuck);
 ctx.save();
 ctx.translate(shake,bob);
 ctx.scale(pulse*(jumping?.96:1),pulse*jumpStretch*squash);
 drawAura(ctx,now,combo());

 // Feet and running cadence
 const step=reducedMotion?0:Math.sin(now*.025*speed)*3.2;
 ctx.strokeStyle='#f97316';ctx.lineWidth=3;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(-8,-3);ctx.lineTo(-8+step,5);ctx.moveTo(8,-3);ctx.lineTo(8-step,5);ctx.stroke();
 ctx.fillStyle='#fb923c';ellipse(ctx,-8+step,6,7,2.8,-.12);ellipse(ctx,8-step,6,7,2.8,.12);

 // Body
 ctx.fillStyle=state.emotion==='miss'?'#fbbf24':'#facc15';
 ellipse(ctx,0,-20,25,23);
 ctx.fillStyle='#fde68a';ellipse(ctx,0,-17,15,14);
 drawWing(ctx,-1,flap,state.emotion);drawWing(ctx,1,flap,state.emotion);

 // Head
 ctx.fillStyle='#facc15';ellipse(ctx,0,-49,17.5,17.5);
 ctx.fillStyle='#fde047';ellipse(ctx,-4,-52,11,10);

 // Eyes and expression
 const blink=now<state.blinkUntil;
 ctx.strokeStyle='#1f2937';ctx.fillStyle='#1f2937';ctx.lineWidth=2.8;ctx.lineCap='round';
 if(state.emotion==='happy'||state.emotion==='wow'){
  lineEye(ctx,-6,-53,-.10);lineEye(ctx,6,-53,.10);
 }else if(blink){
  lineEye(ctx,-6,-53,0);lineEye(ctx,6,-53,0);
 }else if(state.emotion==='miss'){
  ctx.beginPath();ctx.moveTo(-10,-56);ctx.lineTo(-3,-52);ctx.moveTo(10,-56);ctx.lineTo(3,-52);ctx.stroke();
  ellipse(ctx,-6,-52,2.2,2.8);ellipse(ctx,6,-52,2.2,2.8);
 }else{
  ellipse(ctx,-6,-53,2.4,3.1);ellipse(ctx,6,-53,2.4,3.1);
  ctx.fillStyle='#fff';ellipse(ctx,-5.3,-54,0.8,1);ellipse(ctx,6.7,-54,0.8,1);
 }

 // Beak
 ctx.fillStyle=state.emotion==='miss'?'#fb7185':'#fb923c';
 ctx.beginPath();ctx.moveTo(-10,-46);ctx.quadraticCurveTo(0,-41,10,-46);ctx.quadraticCurveTo(0,-50,-10,-46);ctx.fill();

 // Hero badge for strong combo
 const c=combo();
 if(c>=8){
  ctx.fillStyle='#0ea5e9';ctx.strokeStyle='#fff';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(0,-24,7,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='900 8px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  nativeFillText.call(ctx,'H',0,-23.5);
 }

 ctx.restore();
}

function patchedFillText(text,x,y,maxWidth){
 if(this!==worldCtx||String(text)!=='🦆'){
  return arguments.length>=4?nativeFillText.call(this,text,x,y,maxWidth):nativeFillText.call(this,text,x,y);
 }
 try{
  const now=performance.now();
  const m=this.getTransform();
  if(state.groundF==null||m.f>state.groundF)state.groundF=m.f;
  else if(Math.abs((state.groundF||m.f)-m.f)<5)state.groundF=state.groundF*.985+m.f*.015;
  const jumpPx=Math.max(0,(state.groundF||m.f)-m.f);
  const jumpLocal=jumpPx/Math.max(1,Math.abs(m.d));
  const isDuck=Math.abs(m.d/Math.max(.001,m.a))<.72;
  drawDuck(this,now,isDuck,jumpLocal);
  return;
 }catch(error){
  console.warn('[JumpDuck Duck Polish V5.9]',error);
  return arguments.length>=4?nativeFillText.call(this,text,x,y,maxWidth):nativeFillText.call(this,text,x,y);
 }
}
patchedFillText.__jumpduckDuckV59Patched=true;
CanvasRenderingContext2D.prototype.fillText=patchedFillText;

const toast=document.getElementById('toast');
if(toast){
 const observer=new MutationObserver(()=>{
  const text=String(toast.textContent||'').toUpperCase();
  const now=performance.now();
  if(/MISS/.test(text)){
   state.emotion='miss';state.emotionUntil=now+650;state.missShake=1;
  }else if(/PERFECT|GREAT|MISSION CLEAR/.test(text)){
   state.emotion='happy';state.emotionUntil=now+720;state.hitPulse=1;
  }else if(/LEVEL UP|FINAL RUSH/.test(text)){
   state.emotion='wow';state.emotionUntil=now+850;state.hitPulse=1;
  }
 });
 observer.observe(toast,{childList:true,characterData:true,subtree:true});
}

try{
 const nativeSetItem=Storage.prototype.setItem;
 if(!nativeSetItem.__jumpduckDuckV59StoragePatched){
  function duckSetItem(key,value){
   if(String(key)==='HHA_JUMPDUCK_LAST_RESULT'){
    try{
     const payload=JSON.parse(String(value||'{}'));
     payload.gameVersion='jumpduck-production-v5.9-duck-polish';
     payload.duckAnimationProfile='vector-duck-bob-blink-wing-shadow-emotion-combo-v59';
     value=JSON.stringify(payload);
    }catch(_){ }
   }
   return nativeSetItem.call(this,key,value);
  }
  duckSetItem.__jumpduckDuckV59StoragePatched=true;
  Storage.prototype.setItem=duckSetItem;
 }
}catch(_){ }
})();