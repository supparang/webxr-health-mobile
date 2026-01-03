/* === /herohealth/vr-groups/fx-director.js ===
PACK 19: FX Director — PRODUCTION
✅ rate-limit + dedupe per kind
✅ intensity scaling (burst count, vibrate pattern, class duration)
✅ outputs to: hha:judge + groups:progress + body classes (via PACK16)
Usage: window.GroupsVR.FX.fire({kind,text,x,y,intensity})
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // Per-kind throttles (ms)
  const THROTTLE = {
    good:    70,
    bad:     120,
    miss:    140,
    block:   160,
    perfect: 260,
    combo:   420,
    boss:    140,
    storm:   520,
    end:     900
  };

  // Dedupe windows (ms) for identical text bursts
  const DEDUPE = {
    good: 80, bad: 140, miss: 160, perfect: 320, combo: 520, boss: 180, storm: 650, end: 1200, block: 220
  };

  const lastAt = Object.create(null);
  const lastKeyAt = Object.create(null);

  function keyOf(a){
    return `${String(a.kind||'')}|${String(a.text||'')}`;
  }

  function safeXY(a){
    const cx = (root.innerWidth||0)*0.5;
    const cy = (root.innerHeight||0)*0.55;
    return {
      x: (typeof a.x==='number') ? a.x : cx,
      y: (typeof a.y==='number') ? a.y : cy
    };
  }

  function fire(action){
    action = action || {};
    const t = now();
    const kind = String(action.kind||'').toLowerCase() || 'good';
    const intensity = clamp(action.intensity ?? 1.0, 0.4, 1.6);
    const {x,y} = safeXY(action);
    const text = String(action.text||'');

    // throttle by kind
    const minGap = Math.round((THROTTLE[kind] ?? 160) / intensity);
    if (lastAt[kind] && (t - lastAt[kind]) < minGap) return;
    lastAt[kind] = t;

    // dedupe identical action+text
    const kkey = keyOf({kind,text});
    const dGap = Math.round((DEDUPE[kind] ?? 240) / intensity);
    if (lastKeyAt[kkey] && (t - lastKeyAt[kkey]) < dGap) return;
    lastKeyAt[kkey] = t;

    // scale text a bit
    let outText = text;
    if (!outText){
      outText =
        (kind==='good') ? '+' :
        (kind==='bad') ? '-' :
        (kind==='perfect') ? 'PERFECT' :
        (kind==='combo') ? 'COMBO' :
        (kind==='boss') ? 'BOSS' :
        (kind==='storm') ? 'STORM' :
        (kind==='end') ? 'END' : '';
    }

    // Emit as hha:judge for PACK16 (shockwave/pop/burst/cls)
    // PACK16 will use x/y and run particles if available
    emit('hha:judge', { kind, text: outText, x, y, intensity });

    // Optional: stronger ambient for storm/boss/end
    if (kind==='storm'){
      emit('groups:progress', { kind:'storm_on', intensity });
    }
    if (kind==='boss'){
      emit('groups:progress', { kind:'boss_spawn', intensity });
    }
  }

  NS.FX = { fire };

})(typeof window!=='undefined' ? window : globalThis);