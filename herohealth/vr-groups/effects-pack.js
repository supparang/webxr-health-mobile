/* === E: /herohealth/vr-groups/effects-pack.js ===
GroupsVR — Effects Pack (SAFE / PRODUCTION)
✅ Adds/removes body FX classes with auto-timeout
✅ Hooks: hha:judge, groups:progress, hha:end
✅ Optional Particles (if ../vr/particles.js loaded)
*/

(function(root){
  'use strict';

  const DOC = root.document;
  if(!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

  const timers = new Map();

  function flash(cls, ms){
    try{
      DOC.body.classList.add(cls);
      clearTimeout(timers.get(cls));
      timers.set(cls, setTimeout(()=>{
        try{ DOC.body.classList.remove(cls); }catch(_){}
      }, ms||180));
    }catch(_){}
  }

  function hold(cls, on){
    try{ DOC.body.classList.toggle(cls, !!on); }catch(_){}
  }

  function pop(text, x, y){
    // optional particles layer
    try{
      const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
      if (!P) return;
      // popText signature from your particles.js: popText(x,y,text,cls)
      if (P.popText) P.popText(x||root.innerWidth*0.5, y||root.innerHeight*0.5, String(text||''), '');
    }catch(_){}
  }

  // ---- Judge events (good/bad/miss/perfect/boss/storm) ----
  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const kind = String(d.kind||'').toLowerCase();

    if (kind === 'good'){
      flash('fx-good', 220);
      flash('fx-hit', 180);
      pop(d.text||'+', d.x, d.y);
      return;
    }
    if (kind === 'perfect'){
      flash('fx-perfect', 260);
      pop(d.text||'PERFECT', d.x, d.y);
      return;
    }
    if (kind === 'bad'){
      flash('fx-bad', 260);
      pop(d.text||'BAD', d.x, d.y);
      return;
    }
    if (kind === 'miss'){
      flash('fx-miss', 260);
      pop(d.text||'MISS', d.x, d.y);
      return;
    }
    if (kind === 'boss'){
      flash('fx-boss', 420);
      pop(d.text||'BOSS', d.x, d.y);
      return;
    }
    if (kind === 'storm'){
      flash('fx-storm', 520);
      pop(d.text||'STORM', d.x, d.y);
      return;
    }
  }, { passive:true });

  // ---- Progress events ----
  root.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail||{};
    const kind = String(d.kind||'').toLowerCase();

    if (kind === 'storm_on'){
      hold('fx-storm', true);
      return;
    }
    if (kind === 'storm_off'){
      hold('fx-storm', false);
      return;
    }
    if (kind === 'boss_spawn'){
      hold('fx-boss', true);
      setTimeout(()=>hold('fx-boss', false), 1400);
      return;
    }
    if (kind === 'boss_down'){
      flash('fx-perfect', 420);
      flash('fx-hit', 220);
      return;
    }
    if (kind === 'perfect_switch'){
      flash('fx-perfect', 320);
      return;
    }
    if (kind === 'miss'){
      flash('fx-miss', 280);
      return;
    }
    if (kind === 'pressure'){
      // pressure 0..3 -> ให้มี “ควัน” เบาๆ (ใช้ class press-* ที่ engine ใส่อยู่แล้ว)
      // ไม่ต้องทำอะไรเพิ่มมาก (CSS จัดได้)
      return;
    }
  }, { passive:true });

  // ---- End ----
  root.addEventListener('hha:end', ()=>{
    flash('fx-end', 650);
    hold('fx-storm', false);
    hold('fx-boss', false);
  }, { passive:true });

  // expose helpers (optional)
  NS.FX = { flash, hold };

})(typeof window !== 'undefined' ? window : globalThis);