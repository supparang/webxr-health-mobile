/* === /herohealth/vr-groups/fx-router.js ===
PACK 26: FX Router — PRODUCTION
✅ normalize judge kinds
✅ priority + rate-limit + coalesce (anti-spam)
✅ emits: fx:hit (unified) + fx:combo + fx:storm + fx:boss + fx:end
✅ optional: drops low-priority FX when too frequent
Respects: FXPerf level via GroupsVR.FXPerf or body[data-fx-level]
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const NOW = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function fxLevel(){
    try{
      const L = (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||3);
      return Number(L)||3;
    }catch{ return 3; }
  }
  function allow(min){ return fxLevel() >= (min||1); }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, {detail})); }catch(_){}
  }

  // ---------- normalize ----------
  function normKind(k){
    k = String(k||'').toLowerCase().trim();
    if (!k) return 'none';
    if (k==='good' || k==='hit' || k==='ok') return 'good';
    if (k==='bad' || k==='wrong' || k==='junk') return 'bad';
    if (k==='miss' || k==='timeout') return 'miss';
    if (k==='boss' || k==='boss_hit') return 'boss';
    if (k==='block' || k==='guard') return 'block';
    if (k==='perfect' || k==='switch' || k==='perfect_switch') return 'perfect';
    if (k==='storm' || k==='storm_on') return 'storm';
    if (k==='streak' || k==='combo' || k==='streak_up') return 'streak';
    if (k==='end') return 'end';
    return k;
  }

  // Priority map: higher = more important
  const PRI = {
    boss: 90,
    perfect: 80,
    storm: 70,
    good: 60,
    bad: 55,
    block: 52,
    miss: 40,
    streak: 35,
    end: 100,
    none: 0
  };

  // ---------- rate-limit config ----------
  const CFG = {
    // per-kind minimum spacing (ms)
    minGap: {
      good: 80,
      bad: 110,
      miss: 120,
      block: 120,
      perfect: 260,
      boss: 220,
      storm: 500,
      streak: 550,
      end: 0
    },
    // global limiter (coalesce window)
    globalWindowMs: 120,
    // if too many events in window, drop low prio
    maxEventsPerWindow: 3,
    dropBelowPriority: 55
  };

  let winT0 = 0;
  let winCount = 0;

  const lastAt = Object.create(null);

  // Keep last useful payload (e.g. x,y, text)
  function pickXY(d){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;
    const x = (typeof d.x==='number') ? d.x : (typeof d.clientX==='number') ? d.clientX : W*0.5;
    const y = (typeof d.y==='number') ? d.y : (typeof d.clientY==='number') ? d.clientY : H*0.5;
    return {x, y};
  }

  function allowedByRate(kind, prio, t){
    // per-kind gap
    const gap = Number(CFG.minGap[kind] ?? 120);
    const la  = Number(lastAt[kind] ?? 0);
    if (gap > 0 && (t - la) < gap) return false;

    // global window drop logic
    if ((t - winT0) > CFG.globalWindowMs){
      winT0 = t;
      winCount = 0;
    }
    winCount++;
    if (winCount > CFG.maxEventsPerWindow && prio < CFG.dropBelowPriority){
      return false;
    }

    lastAt[kind] = t;
    return true;
  }

  // ---------- Main hook ----------
  root.addEventListener('hha:judge', (ev)=>{
    if (!allow(1)) return;

    const d0 = ev.detail || {};
    const kind = normKind(d0.kind);
    const prio = PRI[kind] || 10;
    const t = NOW();

    if (!allowedByRate(kind, prio, t)) return;

    const xy = pickXY(d0);
    const payload = {
      kind,
      prio,
      t,
      x: xy.x,
      y: xy.y,
      text: String(d0.text || ''),
      raw: d0
    };

    // unified event
    emit('fx:hit', payload);

    // fan-out semantic events (optional consumers)
    if (kind === 'streak') emit('fx:combo', payload);
    if (kind === 'storm')  emit('fx:storm', payload);
    if (kind === 'boss')   emit('fx:boss', payload);

  }, {passive:true});

  root.addEventListener('groups:progress', (ev)=>{
    if (!allow(1)) return;
    const k = String((ev.detail||{}).kind||'').toLowerCase();

    if (k === 'storm_on'){
      emit('fx:storm', { kind:'storm', prio:PRI.storm, t:NOW() });
      return;
    }
    if (k === 'boss_spawn'){
      emit('fx:boss', { kind:'boss', prio:PRI.boss, t:NOW(), stage:'spawn' });
      return;
    }
    if (k === 'perfect_switch'){
      // normalize to perfect
      const t = NOW();
      if (allowedByRate('perfect', PRI.perfect, t)){
        emit('fx:hit', { kind:'perfect', prio:PRI.perfect, t });
      }
    }
  }, {passive:true});

  root.addEventListener('hha:end', (ev)=>{
    if (!allow(1)) return;
    emit('fx:end', { kind:'end', prio:PRI.end, t:NOW(), raw: (ev.detail||{}) });
  }, {passive:true});

  // export for debugging/tuning
  NS.FXRouter = { normKind, CFG, PRI };

})(typeof window!=='undefined' ? window : globalThis);