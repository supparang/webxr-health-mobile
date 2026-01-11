// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (unified feel across games)
// ✅ Adds short-lived body classes for punchy feedback:
//    fx-hit-good, fx-hit-bad, fx-miss, fx-kick, fx-endblink
// ✅ Optional continuous pressure states (used by GoodJunk first):
//    gj-storm, gj-boss, gj-rage   (set via events)
// ✅ Listens to:
//    - hha:judge  {label, kind?}  (GOOD!/OOPS!/MISS!/BLOCK!/GOAL!/MINI CLEAR!/FAST PASS!)
//    - hha:celebrate {kind, grade}
//    - hha:time   {t} (optional low-time pulse)
//    - hha:ai     {storm?, boss?, rage?}  (boolean flags)
//    - hha:fx     {type, on?, ms?} (manual override)
// ✅ Safe: no dependencies, idempotent load guard

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  const BODY = DOC.body || DOC.documentElement;

  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();

  // ----- class helpers -----
  const timers = new Map();
  function pulseClass(cls, ms){
    try{
      BODY.classList.add(cls);
      const prev = timers.get(cls);
      if(prev) clearTimeout(prev);
      const t = setTimeout(()=>{
        try{ BODY.classList.remove(cls); }catch(_){}
        timers.delete(cls);
      }, clamp(ms||0, 60, 2000));
      timers.set(cls, t);
    }catch(_){}
  }
  function setStateClass(cls, on){
    try{
      if(on) BODY.classList.add(cls);
      else BODY.classList.remove(cls);
    }catch(_){}
  }

  // ----- optional micro "kick" transform -----
  // Keep it subtle; CSS can amplify if needed.
  let kickLock = 0;
  function kick(ms=120){
    const t = now();
    if(t < kickLock) return;
    kickLock = t + 80;
    pulseClass('fx-kick', ms);
  }

  // ----- map judge labels -> fx types -----
  function fxFromJudgeLabel(label){
    const s = String(label||'').toUpperCase();
    if(s.includes('GOOD')) return 'good';
    if(s.includes('BLOCK')) return 'block';
    if(s.includes('OOPS') || s.includes('BAD') || s.includes('JUNK')) return 'bad';
    if(s.includes('MISS')) return 'miss';
    if(s.includes('GOAL')) return 'goal';
    if(s.includes('MINI')) return 'mini';
    if(s.includes('FAST')) return 'mini';
    return 'neutral';
  }

  function applyFx(type){
    // unify durations
    if(type === 'good'){
      pulseClass('fx-hit-good', 160);
      kick(110);
      return;
    }
    if(type === 'bad'){
      pulseClass('fx-hit-bad', 180);
      kick(140);
      return;
    }
    if(type === 'miss'){
      pulseClass('fx-miss', 220);
      kick(160);
      return;
    }
    if(type === 'mini' || type === 'goal'){
      // celebratory ping, not too aggressive
      pulseClass('fx-hit-good', 140);
      pulseClass('fx-endblink', 140);
      return;
    }
    if(type === 'block'){
      pulseClass('fx-hit-good', 120);
      return;
    }
    // neutral
    pulseClass('fx-endblink', 120);
  }

  // ----- event handlers -----
  function onJudge(ev){
    const d = ev?.detail || {};
    const label = d.label || d.text || '';
    const kind = d.kind || fxFromJudgeLabel(label);

    // apply body fx
    applyFx(kind);

    // Allow GoodJunk local pulses (optional): if safe.js uses these too.
    // We keep director generic; but can add light mapping for common cues:
    const up = String(label||'').toUpperCase();
    if(up.includes('MINI')){
      pulseClass('gj-mini-clear', 220);
    }else if(up.includes('OOPS') || up.includes('JUNK')){
      pulseClass('gj-junk-hit', 220);
    }else if(up.includes('MISS')){
      pulseClass('gj-good-expire', 180);
    }
  }

  function onCelebrate(ev){
    const d = ev?.detail || {};
    const kind = String(d.kind||'').toLowerCase();
    // end celebration + grade flash
    if(kind === 'end'){
      pulseClass('fx-endblink', 420);
      pulseClass('fx-hit-good', 240);
      return;
    }
    if(kind === 'mini' || kind === 'goal'){
      pulseClass('fx-endblink', 220);
      pulseClass('fx-hit-good', 180);
      return;
    }
    // generic celebrate
    pulseClass('fx-endblink', 200);
  }

  // optional low-time pulse if a game emits hha:time frequently
  let lastLowPulse = 0;
  function onTime(ev){
    const d = ev?.detail || {};
    const t = Number(d.t);
    if(!Number.isFinite(t)) return;
    // Pulse a subtle warning under 10s
    if(t <= 10){
      const n = now();
      if(n - lastLowPulse > 650){
        lastLowPulse = n;
        pulseClass('fx-miss', 120);
      }
    }
  }

  // AI/state channel: drive Storm/Boss/Rage
  function onAI(ev){
    const d = ev?.detail || {};
    // accept multiple key names
    const storm = !!(d.storm ?? d.isStorm ?? d.phaseStorm);
    const boss  = !!(d.boss  ?? d.isBoss  ?? d.phaseBoss);
    const rage  = !!(d.rage  ?? d.isRage  ?? d.phaseRage);

    // For GoodJunk we use gj-* class (already defined in goodjunk-vr.css)
    setStateClass('gj-storm', storm);
    setStateClass('gj-boss',  boss);
    setStateClass('gj-rage',  rage);

    // Also offer generic equivalents for other games (in case you add CSS later)
    setStateClass('hha-storm', storm);
    setStateClass('hha-boss',  boss);
    setStateClass('hha-rage',  rage);
  }

  // manual: hha:fx {type:'good'|'bad'|'miss'|'mini'|'goal'|'block'|'neutral' , on?, ms?}
  function onFx(ev){
    const d = ev?.detail || {};
    const type = String(d.type||'').toLowerCase();
    const on = (d.on === undefined) ? true : !!d.on;
    const ms = Number(d.ms||0);

    // state toggles
    if(type === 'storm' || type === 'boss' || type === 'rage'){
      const cls = (type === 'storm') ? 'gj-storm' : (type === 'boss') ? 'gj-boss' : 'gj-rage';
      setStateClass(cls, on);
      setStateClass(`hha-${type}`, on);
      return;
    }

    if(!on) return;

    if(type === 'good' || type === 'bad' || type === 'miss' || type === 'mini' || type === 'goal' || type === 'block'){
      // override durations if provided
      if(ms > 0){
        if(type==='good') pulseClass('fx-hit-good', ms);
        else if(type==='bad') pulseClass('fx-hit-bad', ms);
        else if(type==='miss') pulseClass('fx-miss', ms);
        else if(type==='block') pulseClass('fx-hit-good', ms);
        else { pulseClass('fx-endblink', ms); pulseClass('fx-hit-good', Math.round(ms*0.7)); }
        kick(Math.min(180, Math.max(90, Math.round(ms*0.7))));
        return;
      }
      applyFx(type);
      return;
    }

    // unknown => blink
    pulseClass('fx-endblink', ms>0?ms:140);
  }

  // ----- bind listeners (window + document) -----
  function bind(target){
    try{
      target.addEventListener('hha:judge', onJudge, { passive:true });
      target.addEventListener('hha:celebrate', onCelebrate, { passive:true });
      target.addEventListener('hha:time', onTime, { passive:true });
      target.addEventListener('hha:ai', onAI, { passive:true });
      target.addEventListener('hha:fx', onFx, { passive:true });
    }catch(_){}
  }
  bind(WIN);
  bind(DOC);

  // Minimal inline style for ultra-safe keyframes (in case some pages don't include CSS hooks)
  // We keep it tiny: only for fx-endblink fallback.
  const st = DOC.createElement('style');
  st.textContent = `
    body.fx-endblink{ animation: hhaEndBlink 240ms ease; }
    @keyframes hhaEndBlink{
      0%{ filter:none; }
      40%{ filter: brightness(1.04) contrast(1.02); }
      100%{ filter:none; }
    }
  `;
  DOC.head.appendChild(st);

})();