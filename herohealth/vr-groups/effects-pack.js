// === /herohealth/vr-groups/effects-pack.js ===
// FX pack: listens hha:judge and toggles body classes, optional particles burst

(function(){
  'use strict';
  const W = window;
  const D = document;
  const NS = W.GroupsVR = W.GroupsVR || {};

  function flash(cls, ms){
    try{
      D.body.classList.add(cls);
      setTimeout(()=>{ try{ D.body.classList.remove(cls); }catch(_){} }, ms||220);
    }catch(_){}
  }

  function burst(x,y,kind){
    // optional hook if particles.js defines window.Particles / emitParticleBurst
    try{
      const P = W.Particles;
      if (P && typeof P.burst === 'function'){
        P.burst({ x, y, kind });
      } else if (typeof W.emitParticleBurst === 'function'){
        W.emitParticleBurst({ x, y, kind });
      }
    }catch(_){}
  }

  W.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail || {};
    const k = String(d.kind||'').toLowerCase();

    const x = Number(d.x ?? (innerWidth*0.5));
    const y = Number(d.y ?? (innerHeight*0.5));

    if (k === 'good' || k === 'perfect'){
      flash('fx-good', 220);
      burst(x,y,'good');
    } else if (k === 'miss'){
      flash('fx-miss', 240);
      burst(x,y,'miss');
    } else if (k === 'bad'){
      flash('fx-bad', 260);
      burst(x,y,'bad');
    } else if (k === 'boss'){
      flash('fx-boss', 220);
      burst(x,y,'boss');
    } else if (k === 'storm'){
      flash('fx-storm', 420);
      burst(x,y,'storm');
    }
  }, {passive:true});

  // expose for manual
  NS.FX = { flash, burst };
})();