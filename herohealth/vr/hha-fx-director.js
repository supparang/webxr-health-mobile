// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (SAFE, SHARED)
// ✅ Normalizes FX across games via events
// ✅ Uses window.Particles (from /vr/particles.js) if present
// ✅ Listens:
//    - hha:judge      {label, kind, x,y, clientX, clientY}
//    - hha:celebrate  {kind:'mini'|'end'|'boss'|'storm'|'rage', grade, x,y}
//    - quest:update   (optional; no heavy FX)
//    - hha:time       {t} (optional low-time tick)
// ✅ Exposes:
//    window.HHA_FX.fire(type, detail)  // manual call if needed
// Notes:
// - Safe: never throws
// - Keeps FX layer above playfield but does not block clicks (pointer-events none)
// - If reduced motion enabled, uses lighter FX.

(function (root) {
  'use strict';
  const doc = root && root.document;
  if (!doc || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  const isReducedMotion = (() => {
    try { return !!root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch { return false; }
  })();

  function ensureCSSOnce(){
    try{
      if (doc.getElementById('hha-fx-director-css')) return;
      const st = doc.createElement('style');
      st.id = 'hha-fx-director-css';
      st.textContent = `
        /* Optional semantic classes for Particles */
        .fx-good { filter: drop-shadow(0 12px 28px rgba(34,197,94,.25)); }
        .fx-bad  { filter: drop-shadow(0 12px 28px rgba(251,113,133,.20)); }
        .fx-warn { filter: drop-shadow(0 12px 28px rgba(245,158,11,.18)); }
        .fx-cyan { filter: drop-shadow(0 12px 28px rgba(34,211,238,.20)); }
        .fx-violet{filter: drop-shadow(0 12px 28px rgba(167,139,250,.20)); }

        /* body pulses (optional, non-blocking) */
        @keyframes hhaPulseGood { 0%{filter:none} 40%{filter:saturate(1.08) brightness(1.08)} 100%{filter:none} }
        @keyframes hhaPulseBad  { 0%{filter:none} 40%{filter:saturate(1.15) brightness(1.02)} 100%{filter:none} }
        @keyframes hhaPulseWarn { 0%{filter:none} 40%{filter:saturate(1.10) brightness(1.05)} 100%{filter:none} }

        body.hha-pulse-good { animation: hhaPulseGood 180ms ease-out; }
        body.hha-pulse-bad  { animation: hhaPulseBad  200ms ease-out; }
        body.hha-pulse-warn { animation: hhaPulseWarn 220ms ease-out; }
      `;
      doc.head.appendChild(st);
    }catch(_){}
  }

  function P(){ return root.Particles || null; }

  function safeXY(detail){
    const W = doc.documentElement.clientWidth || 360;
    const H = doc.documentElement.clientHeight || 640;

    // prefer clientX/Y then x/y
    const x = (detail && (detail.clientX ?? detail.x)) ?? (W * 0.5);
    const y = (detail && (detail.clientY ?? detail.y)) ?? (H * 0.52);

    // clamp to viewport
    return {
      x: clamp(x, 12, W - 12),
      y: clamp(y, 12, H - 12),
      W, H
    };
  }

  function pulseBody(cls){
    try{
      doc.body.classList.remove('hha-pulse-good','hha-pulse-bad','hha-pulse-warn');
      doc.body.classList.add(cls);
      setTimeout(()=>{ try{ doc.body.classList.remove(cls); }catch(_){} }, 260);
    }catch(_){}
  }

  // ----------- FX primitives (composed) -----------
  function fxGood(x,y){
    const p = P(); if(!p) return;
    if(isReducedMotion){
      p.popText(x,y,'+',{ className:'fx-good', dur: 420, size: 18 });
      return;
    }
    p.burst(x,y,{ className:'fx-good', count: 10, spread: 95, dur: 420 });
    p.popEmoji(x,y,'✨',{ className:'fx-good', dur: 520, size: 24 });
  }

  function fxBad(x,y){
    const p = P(); if(!p) return;
    if(isReducedMotion){
      p.popText(x,y,'-',{ className:'fx-bad', dur: 420, size: 18 });
      return;
    }
    p.burst(x,y,{ className:'fx-bad', count: 12, spread: 110, dur: 440, ringColor:'rgba(251,113,133,.18)' });
    p.popEmoji(x,y,'💥',{ className:'fx-bad', dur: 520, size: 26 });
  }

  function fxStar(x,y){
    const p = P(); if(!p) return;
    if(isReducedMotion){
      p.popEmoji(x,y,'⭐',{ className:'fx-warn', dur: 480, size: 24 });
      return;
    }
    p.ring(x,y,{ className:'fx-warn', size: 100, dur: 380, color:'rgba(245,158,11,.35)' });
    p.confetti(x,y,{ className:'fx-warn', count: 12, spread: 120, dur: 780 });
    p.popEmoji(x,y,'⭐',{ className:'fx-warn', dur: 520, size: 28 });
  }

  function fxShield(x,y){
    const p = P(); if(!p) return;
    if(isReducedMotion){
      p.popEmoji(x,y,'🛡️',{ className:'fx-cyan', dur: 520, size: 26 });
      return;
    }
    p.burst(x,y,{ className:'fx-cyan', count: 10, spread: 90, dur: 420, ringColor:'rgba(34,211,238,.18)' });
    p.popEmoji(x,y,'🛡️',{ className:'fx-cyan', dur: 560, size: 28 });
  }

  function fxDiamond(x,y){
    const p = P(); if(!p) return;
    if(isReducedMotion){
      p.popEmoji(x,y,'💎',{ className:'fx-violet', dur: 560, size: 28 });
      return;
    }
    p.flash({ color:'rgba(167,139,250,.14)' });
    p.confetti(x,y,{ className:'fx-violet', count: 18, spread: 180, dur: 900 });
    p.popEmoji(x,y,'💎',{ className:'fx-violet', dur: 620, size: 30 });
  }

  function fxMiniClear(x,y){
    const p = P(); if(!p) return;
    if(isReducedMotion){
      p.popText(x,y,'MINI!',{ className:'fx-good', dur: 520, size: 20 });
      return;
    }
    p.flash({ color:'rgba(34,197,94,.12)' });
    p.confetti(x,y,{ count: 18, spread: 190, dur: 900 });
    p.popText(x,y,'MINI CLEAR!',{ className:'fx-good', dur: 720, size: 18, weight: 1000 });
  }

  function fxEnd(grade, x, y){
    const p = P(); if(!p) return;
    const g = String(grade || '').toUpperCase();
    const label = g ? `GRADE ${g}` : 'FINISH';
    if(isReducedMotion){
      p.popText(x,y,label,{ className:'fx-good', dur: 820, size: 22, weight: 1100 });
      return;
    }
    p.flash({ color:'rgba(255,255,255,.12)' });
    p.confetti(x,y,{ count: 26, spread: 260, dur: 1100 });
    p.popText(x,y,label,{ className:'fx-good', dur: 980, size: 24, weight: 1100 });
  }

  function fxStorm(x,y){
    const p = P(); if(!p) return;
    if(isReducedMotion){
      p.popText(x,y,'STORM',{ className:'fx-warn', dur: 520, size: 18, weight: 1100 });
      return;
    }
    p.ring(x,y,{ className:'fx-warn', size: 140, dur: 520, color:'rgba(245,158,11,.26)' });
    p.burst(x,y,{ className:'fx-warn', count: 16, spread: 160, dur: 520 });
    p.popText(x,y,'STORM!',{ className:'fx-warn', dur: 720, size: 20, weight: 1100 });
  }

  function fxRage(x,y){
    const p = P(); if(!p) return;
    if(isReducedMotion){
      p.popText(x,y,'RAGE',{ className:'fx-bad', dur: 520, size: 18, weight: 1100 });
      return;
    }
    p.flash({ color:'rgba(251,113,133,.16)' });
    p.ring(x,y,{ className:'fx-bad', size: 160, dur: 560, color:'rgba(251,113,133,.26)' });
    p.burst(x,y,{ className:'fx-bad', count: 18, spread: 190, dur: 560 });
    p.popText(x,y,'RAGE!',{ className:'fx-bad', dur: 780, size: 22, weight: 1200 });
  }

  // ----------- Normalization: map judge labels/kinds -> FX -----------
  function normalizeJudge(detail){
    const d = detail || {};
    const label = String(d.label || '').toUpperCase();
    const kind  = String(d.kind  || '').toLowerCase();

    if (kind) return kind;

    // heuristic by label
    if (label.includes('GOOD')) return 'good';
    if (label.includes('BLOCK')) return 'block';
    if (label.includes('OOPS') || label.includes('MISS') || label.includes('BAD')) return 'bad';
    if (label.includes('STAR')) return 'star';
    if (label.includes('SHIELD')) return 'shield';
    if (label.includes('DIAMOND')) return 'diamond';
    if (label.includes('MINI')) return 'mini';
    if (label.includes('STORM')) return 'storm';
    if (label.includes('RAGE')) return 'rage';

    return 'neutral';
  }

  function fire(type, detail){
    try{
      ensureCSSOnce();
      const xy = safeXY(detail);
      const x = xy.x, y = xy.y;

      switch(String(type||'').toLowerCase()){
        case 'good':   pulseBody('hha-pulse-good'); fxGood(x,y); break;
        case 'bad':    pulseBody('hha-pulse-bad');  fxBad(x,y); break;
        case 'block':  pulseBody('hha-pulse-warn'); fxShield(x,y); break;
        case 'star':   pulseBody('hha-pulse-warn'); fxStar(x,y); break;
        case 'shield': pulseBody('hha-pulse-warn'); fxShield(x,y); break;
        case 'diamond':pulseBody('hha-pulse-good'); fxDiamond(x,y); break;
        case 'mini':   pulseBody('hha-pulse-good'); fxMiniClear(x,y); break;
        case 'storm':  pulseBody('hha-pulse-warn'); fxStorm(x,y); break;
        case 'rage':   pulseBody('hha-pulse-bad');  fxRage(x,y); break;
        case 'end': {
          const grade = (detail && detail.grade) || '';
          pulseBody('hha-pulse-good');
          fxEnd(grade, x, y);
          break;
        }
        default:
          // neutral: do tiny pop if asked
          if(detail && detail.text){
            const p = P(); if(p) p.popText(x,y,String(detail.text),{ dur: 520, size: 16 });
          }
          break;
      }
    }catch(_){}
  }

  // ----------- Event listeners -----------
  function onJudge(ev){
    try{
      const d = ev && ev.detail ? ev.detail : {};
      const kind = normalizeJudge(d);
      fire(kind, d);
    }catch(_){}
  }

  function onCelebrate(ev){
    try{
      const d = ev && ev.detail ? ev.detail : {};
      const k = String(d.kind || '').toLowerCase();
      if(k === 'mini') fire('mini', d);
      else if(k === 'end') fire('end', d);
      else if(k === 'storm') fire('storm', d);
      else if(k === 'rage') fire('rage', d);
      else if(k === 'boss') fire('storm', d); // boss intro = heavy
      else fire('neutral', d);
    }catch(_){}
  }

  // optional: time-based tick (for dramatic feel, but light)
  let lastLowTickAt = 0;
  function onTime(ev){
    try{
      const t = Number(ev && ev.detail ? ev.detail.t : NaN);
      if(!Number.isFinite(t)) return;
      if(t > 10) return;
      const ts = now();
      if(ts - lastLowTickAt < 650) return;
      lastLowTickAt = ts;

      const p = P(); if(!p) return;
      const W = doc.documentElement.clientWidth || 360;
      const H = doc.documentElement.clientHeight || 640;
      // tiny ring at center for low time
      if(isReducedMotion){
        p.popText(W*0.5, H*0.22, `⏱ ${Math.ceil(t)}`, { dur: 520, size: 18, weight: 1100 });
      }else{
        p.ring(W*0.5, H*0.22, { size: 120, dur: 380, color:'rgba(255,255,255,.18)' });
      }
    }catch(_){}
  }

  // Ensure CSS and FX layer (best effort)
  ensureCSSOnce();
  try{ if(P() && P().ensureLayer) P().ensureLayer(); }catch(_){}

  root.addEventListener('hha:judge', onJudge, { passive:true });
  root.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  root.addEventListener('hha:time', onTime, { passive:true });

  // Also listen on document (some pages dispatch there)
  doc.addEventListener('hha:judge', onJudge, { passive:true });
  doc.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  doc.addEventListener('hha:time', onTime, { passive:true });

  // Public manual trigger
  root.HHA_FX = root.HHA_FX || {};
  root.HHA_FX.fire = fire;

})(window);