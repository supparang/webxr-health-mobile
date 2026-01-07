// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (safe, no deps)
// Listens: hha:score / hha:judge / hha:miss / hha:celebrate / hha:stage
// Requires: Particles.popText at minimum (from ../vr/particles.js)
// Optional: Particles.burst / Particles.confetti / Particles.ping (if you extend later)

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const Particles = root.Particles || root.GAME_MODULES?.Particles || {};
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));

  function has(fn){ return typeof Particles[fn] === 'function'; }
  function pop(x,y,text){
    if(has('popText')) Particles.popText(x,y,text);
  }

  function kick(ms=90){
    try{
      DOC.body.classList.add('fx-kick');
      setTimeout(()=>DOC.body.classList.remove('fx-kick'), ms);
    }catch(_){}
  }

  function vib(pattern){
    try{
      if(!('vibrate' in navigator)) return;
      navigator.vibrate(pattern);
    }catch(_){}
  }

  function scoreHandler(ev){
    const d = ev?.detail || {};
    const delta = Number(d.delta||0);
    if(!delta) return;

    const x = clamp(Number(d.x)|| (innerWidth/2), 12, innerWidth-12);
    const y = clamp(Number(d.y)|| (innerHeight*0.45), 12, innerHeight-12);

    if(delta > 0){
      pop(x,y, `+${delta}`);
      if(delta >= 30) { kick(120); vib([20]); }
      else vib([10]);
    }else{
      pop(x,y, `${delta}`);
      kick(100);
      vib([15,40,15]);
    }
  }

  function judgeHandler(ev){
    const d = ev?.detail || {};
    const type = String(d.type||'').toLowerCase();
    const label = String(d.label||'').trim();
    const x = clamp(Number(d.x)|| (innerWidth/2), 12, innerWidth-12);
    const y = clamp(Number(d.y)|| (innerHeight*0.46), 12, innerHeight-12);

    if(type === 'good'){
      pop(x,y, label || 'GOOD');
      vib([8]);
      return;
    }
    if(type === 'perfect'){
      pop(x,y, label || 'PERFECT');
      kick(120);
      vib([15,35,15]);
      return;
    }
    if(type === 'block'){
      pop(x,y, label || 'BLOCK');
      vib([12]);
      return;
    }
    if(type === 'bad'){
      pop(x,y, label || 'OOPS');
      kick(140);
      vib([25,40,25]);
      return;
    }
    if(type === 'miss'){
      // small subtle
      if(label && label !== '—') pop(x,y, label);
      vib([10]);
    }
  }

  function missHandler(ev){
    const d = ev?.detail || {};
    const x = clamp(Number(d.x)|| (innerWidth/2), 12, innerWidth-12);
    const y = clamp(Number(d.y)|| (innerHeight*0.48), 12, innerHeight-12);
    pop(x,y,'MISS');
    kick(150);
    vib([22,40,22]);
  }

  function celebrateHandler(ev){
    const d = ev?.detail || {};
    const kind = String(d.kind||'').toLowerCase();
    if(kind === 'mini'){
      pop(innerWidth/2, innerHeight*0.30, 'MINI CLEAR!');
      vib([15,30,15]);
    }else if(kind === 'end'){
      pop(innerWidth/2, innerHeight*0.28, 'FINISH!');
      vib([25,40,25]);
    }
  }

  function stageHandler(ev){
    const d = ev?.detail || {};
    const stage = String(d.stage||'').toLowerCase();
    if(stage === 'storm') pop(innerWidth/2, innerHeight*0.20, 'STORM!');
    if(stage === 'boss')  pop(innerWidth/2, innerHeight*0.20, 'BOSS!');
    if(stage === 'rage')  pop(innerWidth/2, innerHeight*0.20, 'RAGE!');
  }

  root.addEventListener('hha:score', scoreHandler, { passive:true });
  root.addEventListener('hha:judge', judgeHandler, { passive:true });
  root.addEventListener('hha:miss',  missHandler,  { passive:true });
  root.addEventListener('hha:celebrate', celebrateHandler, { passive:true });
  root.addEventListener('hha:stage', stageHandler, { passive:true });

})(window);