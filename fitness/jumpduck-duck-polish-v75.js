(()=>{'use strict';
if(window.__JUMPDUCK_DUCK_POLISH_V75__)return;
window.__JUMPDUCK_DUCK_POLISH_V75__=true;

const RELEASE='20260805-JUMPDUCK-DUCK-POLISH-V75';
const proto=window.CanvasRenderingContext2D&&CanvasRenderingContext2D.prototype;
if(!proto||typeof proto.fillText!=='function')return;
const nativeFillText=proto.fillText;

const fx={
 tilt:0,
 tiltTarget:0,
 directionAt:0,
 jumpUntil:0,
 duckUntil:0,
 celebrateUntil:0,
 hitUntil:0,
 lastToast:'',
 lastScore:0
};

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function comboValue(){return Math.max(0,Number(document.getElementById('combo')?.textContent||0)||0)}
function scoreValue(){return Math.max(0,Number(document.getElementById('score')?.textContent||0)||0)}

function consumeToast(){
 const toast=document.getElementById('toast');
 const text=String(toast?.textContent||'').trim();
 if(!text||text===fx.lastToast)return;
 fx.lastToast=text;
 const now=performance.now();
 if(text.includes('ซ้าย')||text.includes('⬅️')){fx.tiltTarget=-.16;fx.directionAt=now}
 else if(text.includes('ขวา')||text.includes('➡️')){fx.tiltTarget=.16;fx.directionAt=now}
 else if(text.includes('กลาง')||text.includes('↔️')){fx.tiltTarget=0;fx.directionAt=now}
 if(text.includes('JUMP'))fx.jumpUntil=now+760;
 if(text.includes('DUCK'))fx.duckUntil=now+700;
 if(text.includes('PERFECT')||text.includes('GREAT')||text.includes('MISSION CLEAR'))fx.celebrateUntil=now+720;
 if(text.includes('MISS'))fx.hitUntil=now+720;
}

function installObservers(){
 const toast=document.getElementById('toast');
 if(toast&&!toast.__jdDuckPolishObserved){
  toast.__jdDuckPolishObserved=true;
  new MutationObserver(consumeToast).observe(toast,{childList:true,characterData:true,subtree:true});
 }
 const score=document.getElementById('score');
 if(score&&!score.__jdDuckPolishObserved){
  score.__jdDuckPolishObserved=true;
  fx.lastScore=scoreValue();
  new MutationObserver(()=>{
   const value=scoreValue();
   if(value>fx.lastScore)fx.celebrateUntil=performance.now()+620;
   fx.lastScore=value;
  }).observe(score,{childList:true,characterData:true,subtree:true});
 }
}

function drawShadow(ctx,jump,duck){
 ctx.save();
 ctx.globalAlpha=jump?.14:.24;
 ctx.fillStyle='#0f172a';
 ctx.beginPath();
 ctx.ellipse(0,8,jump?14:duck?25:21,jump?3:5,0,0,Math.PI*2);
 ctx.fill();
 ctx.restore();
}

function drawWing(ctx,side,flap,jump){
 ctx.save();
 ctx.translate(side*25,-27);
 ctx.rotate(side*(.38+flap*(jump?.42:.16)));
 ctx.scale(1.15,.72);
 ctx.fillStyle='#fde68acc';
 ctx.strokeStyle='#d97706aa';
 ctx.lineWidth=1.5;
 ctx.beginPath();
 ctx.ellipse(0,0,13,7,0,0,Math.PI*2);
 ctx.fill();ctx.stroke();
 ctx.restore();
}

function drawAura(ctx,combo,now){
 if(combo<4)return;
 const level=combo>=12?3:combo>=7?2:1;
 const pulse=1+Math.sin(now/130)*.08;
 ctx.save();
 ctx.globalAlpha=.22+level*.08;
 ctx.strokeStyle=level===3?'#fef08a':level===2?'#fde047':'#bfdbfe';
 ctx.lineWidth=2+level;
 ctx.beginPath();
 ctx.ellipse(0,-31,32*pulse,37*pulse,0,0,Math.PI*2);
 ctx.stroke();
 ctx.restore();
}

function drawSpeedLines(ctx,tilt){
 if(Math.abs(tilt)<.055)return;
 const side=tilt>0?-1:1;
 ctx.save();
 ctx.globalAlpha=clamp(Math.abs(tilt)*3.4,0,.55);
 ctx.strokeStyle='#ffffff';
 ctx.lineWidth=2;
 for(let i=0;i<3;i++){
  const y=-47+i*15;
  ctx.beginPath();
  ctx.moveTo(side*31,y);
  ctx.lineTo(side*(43+i*4),y-2);
  ctx.stroke();
 }
 ctx.restore();
}

function drawReaction(ctx,celebrate,hit,now){
 ctx.save();
 ctx.textAlign='center';
 if(celebrate){
  ctx.globalAlpha=.82;
  ctx.font='20px serif';
  const rise=((now%500)/500)*8;
  nativeFillText.call(ctx,'✨',-29,-54-rise);
  nativeFillText.call(ctx,'⭐',29,-50-rise*.7);
 }
 if(hit){
  ctx.globalAlpha=.9;
  ctx.font='23px serif';
  nativeFillText.call(ctx,'💫',31,-52);
 }
 ctx.restore();
}

function polishedDuck(text,x,y,maxWidth){
 const now=performance.now();
 consumeToast();
 if(now-fx.directionAt>720)fx.tiltTarget*=.90;
 fx.tilt+=(fx.tiltTarget-fx.tilt)*.24;
 if(Math.abs(fx.tilt)<.002)fx.tilt=0;

 const jump=now<fx.jumpUntil;
 const duck=now<fx.duckUntil;
 const celebrate=now<fx.celebrateUntil;
 const hit=now<fx.hitUntil;
 const combo=comboValue();
 const idle=Math.sin(now/170)*1.6;
 const flap=(Math.sin(now/58)+1)/2;
 const shake=hit?Math.sin(now/25)*4.2:0;
 const hitRotate=hit?Math.sin(now/31)*.08:0;
 const pulse=celebrate?1+Math.sin(now/48)*.055:1;
 const jumpStretch=jump?1.06:1;
 const duckSquash=duck?.90:1;

 this.save();
 this.translate(shake,idle+(jump?-2.2:0));
 this.rotate(fx.tilt+hitRotate);
 this.scale(pulse*jumpStretch,pulse*duckSquash);
 drawShadow(this,jump,duck);
 drawAura(this,combo,now);
 drawSpeedLines(this,fx.tilt);
 drawWing(this,-1,flap,jump);
 drawWing(this,1,flap,jump);
 nativeFillText.call(this,text,x,y,maxWidth);
 drawReaction(this,celebrate,hit,now);
 this.restore();
}

function wrappedFillText(text,x,y,maxWidth){
 if(this?.canvas?.id==='world'&&String(text)==='🦆')return polishedDuck.call(this,text,x,y,maxWidth);
 return nativeFillText.call(this,text,x,y,maxWidth);
}
wrappedFillText.__jdDuckPolishV75=true;
proto.fillText=wrappedFillText;

try{
 const nativeSetItem=Storage.prototype.setItem;
 if(!nativeSetItem.__jdDuckPolishV75){
  function setItem(key,value){
   if(String(key)==='HHA_JUMPDUCK_LAST_RESULT'){
    try{
     const payload=JSON.parse(String(value||'{}'));
     payload.visualPolish='duck-polish-pack-v2';
     payload.duckAnimationVersion='7.5';
     value=JSON.stringify(payload);
    }catch(_){ }
   }
   return nativeSetItem.call(this,key,value);
  }
  setItem.__jdDuckPolishV75=true;
  Storage.prototype.setItem=setItem;
 }
}catch(_){ }

function boot(){installObservers();console.info('[JumpDuck Duck Polish V75] ready',{release:RELEASE})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();