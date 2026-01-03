/* === /herohealth/vr-groups/effects-map.js ===
PACK 18: FX Event Mapping — PRODUCTION
✅ Map all important events -> FX actions
✅ Works with PACK16 (effects-pack.js) and PACK19 (fx-director.js)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  function fx(action){
    // Prefer PACK19 director if present
    try{
      const D = root.GroupsVR && root.GroupsVR.FX;
      if (D && typeof D.fire === 'function'){
        D.fire(action);
        return;
      }
    }catch(_){}
    // Fallback: translate to hha:judge so PACK16 can react
    const kind = String(action.kind||'');
    emit('hha:judge', {
      kind,
      text: action.text || '',
      x: action.x,
      y: action.y
    });
  }

  // --------- state trackers ---------
  let lastLeft = null;
  let lastGrade = null;

  // helpers: center (safe)
  function centerXY(){
    return { x:(root.innerWidth||0)*0.5, y:(root.innerHeight||0)*0.55 };
  }

  // --------- Map: Judge ---------
  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail || {};
    const k = String(d.kind||'').toLowerCase();
    // Let PACK16 handle it directly; PACK19 will additionally enhance via "director"
    // But we can add richer mapped actions:
    if (k==='good'){
      fx({ kind:'good', text:String(d.text||'+'), x:d.x, y:d.y, intensity:1.0 });
    } else if (k==='bad'){
      fx({ kind:'bad', text:String(d.text||''), x:d.x, y:d.y, intensity:1.0 });
    } else if (k==='boss'){
      fx({ kind:'boss', text:String(d.text||'BOSS'), x:d.x, y:d.y, intensity:1.1 });
    } else if (k==='miss'){
      fx({ kind:'miss', text:'MISS', x:d.x, y:d.y, intensity:0.9 });
    } else if (k==='perfect'){
      fx({ kind:'perfect', text:'PERFECT', x:d.x, y:d.y, intensity:1.2 });
    }
  }, {passive:true});

  // --------- Map: groups progress ---------
  root.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail || {};
    const k = String(d.kind||'').toLowerCase();
    const {x,y} = centerXY();

    if (k==='storm_on'){
      fx({ kind:'storm', text:'STORM!', x, y, intensity:1.2 });
      return;
    }
    if (k==='storm_off'){
      fx({ kind:'good', text:'CLEAR!', x, y, intensity:1.0 });
      return;
    }
    if (k==='boss_spawn'){
      fx({ kind:'boss', text:'BOSS!', x, y, intensity:1.3 });
      return;
    }
    if (k==='boss_down'){
      fx({ kind:'perfect', text:'BOSS DOWN!', x, y, intensity:1.4 });
      return;
    }
    if (k==='perfect_switch'){
      fx({ kind:'perfect', text:'SWITCH!', x, y, intensity:1.1 });
      return;
    }
    if (k==='miss'){
      fx({ kind:'miss', text:String(d.why||'miss'), x, y, intensity:0.85 });
      return;
    }
  }, {passive:true});

  // --------- Map: quest update (goal/mini milestones) ---------
  root.addEventListener('quest:update', (ev)=>{
    const d = ev.detail || {};
    const goalNow = Number(d.goalNow||0);
    const goalTot = Math.max(1, Number(d.goalTotal||1));
    const miniLeft = Number(d.miniTimeLeftSec||0);
    const miniNow = Number(d.miniNow||0);
    const miniTot = Math.max(1, Number(d.miniTotal||1));

    // mini urgent pulse (PACK16 already toggles class; here we can add tick FX)
    if (miniLeft>0 && miniLeft<=3){
      const {x,y} = centerXY();
      fx({ kind:'storm', text:`${miniLeft}s`, x, y, intensity:0.7 });
    }

    // goal near-complete hint (only when 1 hit away)
    if (goalTot-goalNow === 1){
      const {x,y} = centerXY();
      fx({ kind:'block', text:'ONE MORE!', x, y, intensity:0.8 });
    }

    // mini near-complete hint
    if (miniLeft>0 && (miniTot-miniNow)===1){
      const {x,y} = centerXY();
      fx({ kind:'block', text:'LAST HIT!', x, y, intensity:0.8 });
    }
  }, {passive:true});

  // --------- Map: time (10s, 3..1, clutch) ---------
  root.addEventListener('hha:time', (ev)=>{
    const d = ev.detail || {};
    const left = Math.max(0, Math.round(Number(d.left||0)));
    if (left === lastLeft) return;
    lastLeft = left;

    const {x,y} = centerXY();

    if (left === 10){
      fx({ kind:'storm', text:'10s!', x, y, intensity:1.0 });
    }
    if (left > 0 && left <= 3){
      fx({ kind:'boss', text:String(left), x, y, intensity:1.0 });
    }
    if (left === 0){
      fx({ kind:'end', text:'TIME', x, y, intensity:1.0 });
    }
  }, {passive:true});

  // --------- Map: rank (grade jump celebration) ---------
  root.addEventListener('hha:rank', (ev)=>{
    const d = ev.detail || {};
    const g = String(d.grade||'').toUpperCase();
    if (!g || g===lastGrade) return;

    // celebrate only when grade improves
    const order = ['C','B','A','S','SS','SSS'];
    const prevI = order.indexOf(lastGrade);
    const curI  = order.indexOf(g);
    lastGrade = g;

    if (curI > prevI && curI >= 0){
      const {x,y} = centerXY();
      fx({ kind:'combo', text:`RANK ${g}!`, x, y, intensity:1.1 });
    }
  }, {passive:true});

  // --------- Map: end ---------
  root.addEventListener('hha:end', (ev)=>{
    const d = ev.detail || {};
    const {x,y} = centerXY();
    fx({ kind:'end', text:`END ${String(d.grade||'')}`, x, y, intensity:1.2 });
  }, {passive:true});

})(typeof window!=='undefined' ? window : globalThis);