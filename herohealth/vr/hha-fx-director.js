// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION
// ✅ Listens to common HHA events and triggers unified FX
// ✅ Rate-limited (no spam)
// ✅ Safe (never throws)
// Events supported:
// - hha:judge {label}  -> GOOD!/OOPS!/MISS!/BLOCK!/STAR!/SHIELD!/DIAMOND!
// - hha:celebrate {kind, grade}
// - quest:update {goal, mini}
// - hha:time {t}  (optional low-time pulse)
// Notes:
// - Requires /vr/particles.js (HHA_FX) loaded BEFORE this file.

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const now = () => performance.now();
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function FX() {
    return root.HHA_FX || (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles || null;
  }

  const RL = {
    judge: 0,
    celebrate: 0,
    lowtime: 0,
  };

  function centerXY(){
    const W = doc.documentElement.clientWidth || 0;
    const H = doc.documentElement.clientHeight || 0;
    return { x: Math.round(W/2), y: Math.round(H/2) };
  }

  function rateOk(key, ms){
    const t = now();
    if (t - (RL[key]||0) < ms) return false;
    RL[key] = t;
    return true;
  }

  function kindFromLabel(label){
    const s = String(label||'').toUpperCase();
    if (s.includes('GOOD')) return 'good';
    if (s.includes('OOPS') || s.includes('MISS') || s.includes('FAIL')) return 'bad';
    if (s.includes('BLOCK')) return 'block';
    if (s.includes('STAR')) return 'star';
    if (s.includes('SHIELD')) return 'shield';
    if (s.includes('DIAMOND')) return 'diamond';
    if (s.includes('GOAL')) return 'star';
    if (s.includes('MINI')) return 'diamond';
    if (s.includes('FAST')) return 'diamond';
    return 'good';
  }

  function onJudge(ev){
    try{
      if(!rateOk('judge', 70)) return;
      const f = FX(); if(!f) return;

      const label = ev?.detail?.label || ev?.label || '';
      const kind = kindFromLabel(label);

      const {x,y} = centerXY();
      f.burstAt(x, y, kind);
      if (label) f.popText(x, y - 26, label);

      // micro flash on big events
      if (String(label).toUpperCase().includes('GOAL') ||
          String(label).toUpperCase().includes('MINI') ||
          String(label).toUpperCase().includes('DIAMOND')) {
        f.flash(kind);
      }
    }catch(_){}
  }

  function onCelebrate(ev){
    try{
      if(!rateOk('celebrate', 120)) return;
      const f = FX(); if(!f) return;

      const kind = String(ev?.detail?.kind || '').toLowerCase();
      const grade = String(ev?.detail?.grade || '');

      const {x,y} = centerXY();

      if(kind === 'end'){
        f.flash('good');
        f.burstAt(x, y, (grade === 'S' || grade === 'A') ? 'diamond' : 'star');
        if(grade) f.popText(x, y - 30, `GRADE ${grade}`);
      } else if(kind === 'mini'){
        f.burstAt(x, y, 'diamond');
      } else {
        f.burstAt(x, y, 'star');
      }
    }catch(_){}
  }

  function onQuestUpdate(ev){
    // Optional: no FX spam here. Just keep a lightweight hook if you want.
    try{
      // no-op by default (intentionally quiet)
      void ev;
    }catch(_){}
  }

  function onTime(ev){
    try{
      const t = Number(ev?.detail?.t ?? ev?.t);
      if(!Number.isFinite(t)) return;
      if(t > 6) return;

      if(!rateOk('lowtime', 220)) return;
      const f = FX(); if(!f) return;

      const {x,y} = centerXY();
      f.ring(x, y, 'star');
    }catch(_){}
  }

  root.addEventListener('hha:judge', onJudge, { passive:true });
  root.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  root.addEventListener('quest:update', onQuestUpdate, { passive:true });
  root.addEventListener('hha:time', onTime, { passive:true });

})(window);