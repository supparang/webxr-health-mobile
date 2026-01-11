// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION
// ✅ Bridges game events -> Particles FX
// ✅ Standard across all HeroHealth games
// Listens:
//  - hha:judge   {label}       -> micro pop + shake (for OOPS/MISS)
//  - hha:celebrate {kind,grade} -> celebrate(kind)
//  - hha:coach   {msg,kind}    -> small pop (rate-limited)
//  - hha:time    {t}           -> optional tick / low-time pulse
// Safe: if Particles missing, no crash.

(function(root){
  'use strict';
  const doc = root.document;
  if(!doc || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const now = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function P(){ return root.Particles || null; }

  function centerXY(){
    const W = doc.documentElement.clientWidth || 360;
    const H = doc.documentElement.clientHeight || 640;
    return { x:(W/2)|0, y:Math.floor(H*0.30) };
  }

  // ------- rate limit (coach spam guard) -------
  let lastCoachAt = 0;
  function coachFx(msg){
    const t = now();
    if(t - lastCoachAt < 900) return;
    lastCoachAt = t;
    const p = P();
    if(!p) return;
    const {x,y} = centerXY();
    try{ p.scorePop(x, y, String(msg||'TIP'), 'small'); }catch(_){}
  }

  // ------- judge labels mapping -------
  function judgeFx(label){
    const p = P();
    if(!p) return;
    const {x,y} = centerXY();
    const L = String(label||'').toUpperCase();

    // classify
    const isBad = /MISS|OOPS|FAIL|HIT JUNK|JUNK|WRONG|DANGER/.test(L);
    const isGood= /GOOD|NICE|GREAT|PERFECT|OK|CLEAR|PASS/.test(L);
    const isBlock=/BLOCK|SHIELD/.test(L);
    const isStar =/STAR/.test(L);
    const isDiamond=/DIAMOND/.test(L);

    try{
      if(isDiamond){
        p.burstAt(x, y, 'diamond');
        p.scorePop(x, y, '💎 +BONUS', 'big');
        return;
      }
      if(isStar){
        p.burstAt(x, y, 'star');
        p.scorePop(x, y, '⭐ MISS -1', 'big');
        return;
      }
      if(isBlock){
        p.burstAt(x, y, 'block');
        p.scorePop(x, y, 'BLOCK!', 'big');
        return;
      }
      if(isBad){
        p.burstAt(x, y, 'bad');
        p.scorePop(x, y, label, 'big');
        try{ p.shake(160); }catch(_){}
        try{ doc.body.classList.add('hha-bad-pulse'); setTimeout(()=>doc.body.classList.remove('hha-bad-pulse'), 220); }catch(_){}
        return;
      }
      if(isGood){
        p.burstAt(x, y, 'good');
        p.scorePop(x, y, label, 'big');
        return;
      }

      // fallback
      p.scorePop(x, y, label, 'big');
    }catch(_){}
  }

  // ------- celebrate -------
  function celebrateFx(kind, grade){
    const p = P();
    if(!p) return;
    const k = String(kind||'end');
    try{ p.celebrate(k); }catch(_){}

    // grade highlight
    if(grade){
      const {x,y} = centerXY();
      try{ p.scorePop(x, y+54, `GRADE ${grade}`, 'big'); }catch(_){}
    }
  }

  // ------- low time tick (optional) -------
  let lastTickAt = 0;
  function timeFx(tLeft){
    // only do something when under 6 sec
    const t = Number(tLeft);
    if(!Number.isFinite(t)) return;
    if(t > 6) return;

    const at = now();
    if(at - lastTickAt < 280) return;
    lastTickAt = at;

    const p = P();
    if(!p) return;

    const {x,y} = centerXY();
    try{
      const n = Math.max(0, Math.ceil(t));
      p.scorePop(x, y-64, String(n), 'big');
    }catch(_){}
  }

  // ------- CSS tiny pulses (optional) -------
  (function injectCss(){
    if(doc.getElementById('hhaFxDirectorCss')) return;
    const st = doc.createElement('style');
    st.id = 'hhaFxDirectorCss';
    st.textContent = `
      .hha-bad-pulse{
        filter: saturate(1.1) contrast(1.05);
      }
    `;
    doc.head.appendChild(st);
  })();

  // ------- event bindings -------
  root.addEventListener('hha:judge', (ev)=>{
    try{ judgeFx(ev?.detail?.label || ev?.detail || ''); }catch(_){}
  }, { passive:true });

  root.addEventListener('hha:celebrate', (ev)=>{
    try{
      const d = ev?.detail || {};
      celebrateFx(d.kind || 'end', d.grade || null);
    }catch(_){}
  }, { passive:true });

  root.addEventListener('hha:coach', (ev)=>{
    try{
      const d = ev?.detail || {};
      coachFx(d.msg || d.text || 'TIP');
    }catch(_){}
  }, { passive:true });

  root.addEventListener('hha:time', (ev)=>{
    try{ timeFx(ev?.detail?.t); }catch(_){}
  }, { passive:true });

})(window);