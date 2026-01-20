// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Folder-run)
// ✅ Reads query: view/run/diff/time/seed/hub/ts/studyId/phase/conditionGroup/log/style
// ✅ Sets body view class (view-pc/view-mobile/view-vr/view-cvr)
// ✅ Ensures right-eye layer visible only in VR/cVR
// ✅ Boots safe engine: ./goodjunk.safe.js (your real SAFE)
// ✅ NO AI modules here (we keep AI OFF by default in research per HHA Standard)

import { boot as safeBoot } from './goodjunk.safe.js';

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };

  function normView(v){
    v = String(v||'mobile').toLowerCase();
    if(v==='cardboard') return 'vr';
    if(v==='view-cvr') return 'cvr';
    if(v==='cvr') return 'cvr';
    if(v==='vr') return 'vr';
    if(v==='pc') return 'pc';
    return 'mobile';
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add(`view-${view}`);
  }

  function ensureLayerEyes(view){
    const r = DOC.getElementById('gj-layer-r');
    if(!r) return;
    // only show for vr/cvr; css already handles but keep explicit
    if(view === 'vr' || view === 'cvr'){
      r.setAttribute('aria-hidden','false');
    }else{
      r.setAttribute('aria-hidden','true');
    }
  }

  function buildPayload(){
    const view = normView(qs('view','mobile'));
    const run  = String(qs('run','play')||'play').toLowerCase(); // play | research
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const time = Number(qs('time','80')||80) || 80;

    // seed rule: research deterministic; play free
    const seed = (run === 'research')
      ? (qs('seed', qs('ts', 'RESEARCH-SEED')) || 'RESEARCH-SEED')
      : (qs('seed', String(Date.now())) || String(Date.now()));

    const hub = qs('hub', null);

    // passthrough meta (logger)
    const studyId = qs('studyId', qs('study', null));
    const phase = qs('phase', null);
    const conditionGroup = qs('conditionGroup', qs('cond', null));

    return { view, run, diff, time, seed, hub, studyId, phase, conditionGroup };
  }

  function start(){
    const payload = buildPayload();
    setBodyView(payload.view);
    ensureLayerEyes(payload.view);

    // tiny: help css safe area settle before spawn
    setTimeout(()=>{ try{ WIN.dispatchEvent(new Event('resize')); }catch(_){ } }, 80);

    safeBoot(payload);
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', start, { once:true });
  }else{
    start();
  }
})();