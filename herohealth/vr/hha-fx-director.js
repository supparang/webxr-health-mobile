// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (Universal)
// ✅ Listens to: hha:judge, hha:storm, hha:boss, hha:celebrate, hha:end, hha:coach
// ✅ Uses: window.GAME_MODULES.Particles OR window.Particles (fallback)
// ✅ Safe: no crash if particles minimal
// ✅ Adds body pulses classes (storm/boss/rage/phase2/lowtime tick etc.)

(function(){
  'use strict';

  const ROOT = window;
  const DOC  = document;
  if(!DOC || ROOT.__HHA_FX_DIRECTOR__) return;
  ROOT.__HHA_FX_DIRECTOR__ = true;

  // ---------------- helpers ----------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();

  function fx(){
    return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles || null;
  }

  function has(fn){
    const P = fx();
    return !!(P && typeof P[fn] === 'function');
  }

  function call(fn, ...args){
    const P = fx();
    try{
      if(P && typeof P[fn] === 'function') return P[fn](...args);
    }catch(_){}
    return null;
  }

  function bodyPulse(cls, ms=220){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>{ try{ DOC.body.classList.remove(cls);}catch(_){ } }, ms);
    }catch(_){}
  }

  function center(){
    const w = DOC.documentElement.clientWidth || innerWidth;
    const h = DOC.documentElement.clientHeight || innerHeight;
    return { x: Math.floor(w/2), y: Math.floor(h*0.28), w, h };
  }

  function safeXY(x,y){
    const w = DOC.documentElement.clientWidth || innerWidth;
    const h = DOC.documentElement.clientHeight || innerHeight;
    const sx = clamp(Number(x)||w/2, 20, w-20);
    const sy = clamp(Number(y)||h/2, 20, h-20);
    return { x:sx, y:sy };
  }

  // ---------------- default mapping ----------------
  // judge types: good / bad / perfect / miss / block
  function onJudge(detail){
    if(!detail) return;
    const type = String(detail.type||'').toLowerCase();
    const label = detail.label || '';
    const xy = safeXY(detail.x, detail.y);

    // baseline: always pop label a bit
    if(label){
      if(has('popText')) call('popText', xy.x, xy.y, label, type, { size: 16 });
      else if(has('scorePop')) call('scorePop', xy.x, xy.y, label);
    }

    // richer FX when available
    if(type === 'good'){
      bodyPulse('hha-hit-good', 140);
      call('burstAt', xy.x, xy.y, 'good', { n: 14 });
      call('ringPulse', xy.x, xy.y, 'good', { size: 120 });
    }else if(type === 'perfect'){
      bodyPulse('hha-hit-perfect', 160);
      call('burstAt', xy.x, xy.y, 'star', { n: 18 });
      call('ringPulse', xy.x, xy.y, 'star', { size: 150 });
    }else if(type === 'block'){
      bodyPulse('hha-hit-block', 160);
      call('burstAt', xy.x, xy.y, 'shield', { n: 16 });
      call('ringPulse', xy.x, xy.y, 'shield', { size: 160 });
    }else if(type === 'bad'){
      bodyPulse('hha-hit-bad', 180);
      call('burstAt', xy.x, xy.y, 'bad', { n: 14 });
      call('ringPulse', xy.x, xy.y, 'bad', { size: 160 });
    }else if(type === 'miss'){
      bodyPulse('hha-hit-miss', 140);
      call('ringPulse', xy.x, xy.y, 'bad', { size: 170 });
    }
  }

  function onStorm(detail){
    const on = !!(detail && detail.on);
    if(on){
      bodyPulse('gj-storm', 520); // GoodJunk uses this class too
      const c = center();
      call('ringPulse', c.x, c.y, 'star', { size: 250 });
      call('popText', c.x, Math.floor(c.y*0.95), 'STORM!', 'warn', { size: 22 });
    }else{
      bodyPulse('hha-storm-clear', 180);
    }
  }

  function onBoss(detail){
    if(!detail) return;
    const on = !!detail.on;
    const phase = Number(detail.phase)||0;
    const rage = !!detail.rage;
    const hp = Number(detail.hp);
    const hpMax = Number(detail.hpMax);

    if(on){
      // boss start / updates
      if(rage) DOC.body.classList.add('gj-rage');
      else DOC.body.classList.remove('gj-rage');

      if(phase === 2) DOC.body.classList.add('gj-phase2');
      else DOC.body.classList.remove('gj-phase2');

      // Only pulse hard when boss just started or phase changed
      if(detail.why === 'start' || detail.justStarted){
        bodyPulse('gj-boss', 620);
        const c = center();
        call('ringPulse', c.x, c.y+20, 'violet', { size: 280 });
        call('popText', c.x, c.y-10, `BOSS!`, 'violet', { size: 22 });
      }

      // hp update pop (small)
      if(Number.isFinite(hp) && Number.isFinite(hpMax) && hpMax>0){
        const c = center();
        call('popText', c.x, c.y+40, `HP ${hp}/${hpMax}`, (hp<=Math.ceil(hpMax*0.4) ? 'bad' : 'warn'), { size: 13 });
      }

      if(phase === 2){
        const c = center();
        call('popText', c.x, c.y-28, 'PHASE 2', 'bad', { size: 18 });
        call('ringPulse', c.x, c.y+14, 'bad', { size: 300 });
      }

      if(rage){
        const c = center();
        call('popText', c.x, c.y-54, 'RAGE!', 'bad', { size: 20 });
      }

    }else{
      // boss off
      DOC.body.classList.remove('gj-boss','gj-phase2');
      // keep rage class decision to game; usually remove at end
      bodyPulse('hha-boss-clear', 240);
      call('celebrate', 'boss', { count: 24 });
    }
  }

  function onCelebrate(detail){
    const kind = (detail && detail.kind) ? String(detail.kind) : 'win';
    if(kind === 'mini'){
      bodyPulse('gj-mini-clear', 220);
      call('celebrate', 'mini', { count: 16 });
    }else if(kind === 'boss'){
      bodyPulse('hha-boss-clear', 240);
      call('celebrate', 'boss', { count: 26 });
    }else if(kind === 'end'){
      bodyPulse('gj-end', 520);
      call('celebrate', 'win', { count: 20 });
    }else{
      call('celebrate', 'win', { count: 16 });
    }
  }

  function onEnd(detail){
    // final flourish — consistent across games
    const grade = detail && detail.grade ? String(detail.grade) : '';
    const c = center();
    bodyPulse('gj-end', 520);

    if(grade){
      call('popText', c.x, c.y, `GRADE ${grade}`, 'perfect', { size: 28 });
      call('ringPulse', c.x, c.y+60, (grade==='S'?'violet':'star'), { size: 320 });
    }else{
      call('ringPulse', c.x, c.y+40, 'star', { size: 300 });
    }
    call('celebrate', 'win', { count: 20 });
  }

  function onCoach(detail){
    // optional: subtle bubble / pop
    if(!detail) return;
    const msg = detail.msg || detail.text || '';
    if(!msg) return;
    const c = center();
    // Keep it subtle; do not spam
    call('popText', c.x, c.y-70, 'TIP!', 'warn', { size: 14 });
  }

  // ---------------- listeners (window + document) ----------------
  function listen(target){
    if(!target || !target.addEventListener) return;

    target.addEventListener('hha:judge', (ev)=> onJudge(ev.detail), { passive:true });
    target.addEventListener('hha:storm', (ev)=> onStorm(ev.detail), { passive:true });
    target.addEventListener('hha:boss', (ev)=> onBoss(ev.detail), { passive:true });
    target.addEventListener('hha:celebrate', (ev)=> onCelebrate(ev.detail), { passive:true });
    target.addEventListener('hha:end', (ev)=> onEnd(ev.detail), { passive:true });
    target.addEventListener('hha:coach', (ev)=> onCoach(ev.detail), { passive:true });
  }

  listen(ROOT);
  listen(DOC);

  // ---------------- fallback CSS keyframes for minimal particles ----------------
  // (in case particles.js is minimal, we still want a tiny visual feel)
  (function ensureTinyStyles(){
    const id = 'hha-fx-director-style';
    if(DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      body.hha-hit-good{ filter:saturate(1.02) contrast(1.01); }
      body.hha-hit-bad{ filter:saturate(1.03) contrast(1.02); }
      body.hha-hit-block{ filter:saturate(1.02); }
      body.hha-hit-perfect{ filter:saturate(1.04) contrast(1.02); }
      body.hha-hit-miss{ filter:saturate(1.02); }
      body.hha-storm-clear{ filter:none; }
      body.hha-boss-clear{ filter:saturate(1.03); }
    `;
    DOC.head.appendChild(st);
  })();

})();