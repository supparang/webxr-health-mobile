// === /herohealth/js/hha-gate-chain.js ===
// HHA Gate Chain Helper (Warmup/Cooldown routing)
// ✅ goAfterGame(gameKey, opts) -> cooldown gate -> next/hub
// ✅ cat=zone mapping (nutrition/hygiene/exercise)
// ✅ play=rand, research=day (unless ?pick= override)
// ✅ preserves run/diff/time/seed/pid/studyId/conditionGroup/view/log/api
'use strict';

function _qs(name, d=''){
  try{
    const u = new URL(window.location.href);
    return u.searchParams.get(name) ?? d;
  }catch(e){ return d; }
}
function _abs(url){
  try{ return new URL(url, window.location.href).toString(); }
  catch(e){ return url || ''; }
}
function _buildUrl(base, params){
  const u = new URL(base, window.location.href);
  Object.entries(params||{}).forEach(([k,v])=>{
    if(v===undefined || v===null || v==='') return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}
function _pickMode(){
  const p = String(_qs('pick','')).toLowerCase().trim();
  if (p === 'rand' || p === 'day') return p;
  const run = String(_qs('run','play')).toLowerCase().trim();
  return (run === 'research') ? 'day' : 'rand';
}
function _normalizeGameKey(g){
  g = String(g||'').toLowerCase().trim();
  if (g === 'germdetective') return 'germ';
  if (g === 'cleanobjects')  return 'clean';
  if (g === 'balancehold')   return 'balance';
  return g;
}
function _gameToCatTheme(gameKey){
  const g = _normalizeGameKey(gameKey);

  // nutrition
  if (g==='goodjunk')   return { cat:'nutrition', theme:'goodjunk' };
  if (g==='groups')     return { cat:'nutrition', theme:'groups' };
  if (g==='hydration')  return { cat:'nutrition', theme:'hydration' };
  if (g==='plate')      return { cat:'nutrition', theme:'plate' };

  // hygiene
  if (g==='handwash')   return { cat:'hygiene', theme:'handwash' };
  if (g==='brush')      return { cat:'hygiene', theme:'brush' };
  if (g==='maskcough')  return { cat:'hygiene', theme:'maskcough' };
  if (g==='germ')       return { cat:'hygiene', theme:'germ' };
  if (g==='bath')       return { cat:'hygiene', theme:'bath' };
  if (g==='clean')      return { cat:'hygiene', theme:'clean' };

  // exercise
  if (g==='shadow')     return { cat:'exercise', theme:'shadow' };
  if (g==='rhythm')     return { cat:'exercise', theme:'rhythm' };
  if (g==='jumpduck')   return { cat:'exercise', theme:'jumpduck' };
  if (g==='balance')    return { cat:'exercise', theme:'balance' };
  if (g==='planner')    return { cat:'exercise', theme:'planner' };

  return { cat:'nutrition', theme:'goodjunk' };
}

/**
 * goAfterGame(gameKey, opts)
 * @param {string} gameKey
 * @param {object} opts
 *  - hub: absolute/relative hub url override
 *  - next: absolute/relative next url after cooldown (default hub)
 *  - gate: warmup-gate url override
 *  - cdur: cooldown duration seconds (default from ?cdur or 12)
 *  - forceNoCooldown: true => skip cooldown
 *  - replace: true => location.replace (default false -> href)
 *  - extraParams: extra qs to pass to gate
 */
export function goAfterGame(gameKey, opts={}){
  const { cat } = _gameToCatTheme(gameKey);

  const hub = _abs(
    opts.hub ||
    _qs('hub','../hub.html')
  );

  const next = _abs(opts.next || hub);

  if (opts.forceNoCooldown || String(_qs('nocooldown','0')) === '1'){
    if (opts.replace) window.location.replace(next);
    else window.location.href = next;
    return next;
  }

  // default gate path by current page location
  // If current page is /herohealth/* => ./warmup-gate.html or ../warmup-gate.html depending depth
  // We use explicit override if provided; otherwise try nearest sibling under /herohealth/
  let gate = opts.gate || '';
  if (!gate){
    const p = location.pathname || '';
    if (p.includes('/fitness/')) gate = '../herohealth/warmup-gate.html';
    else gate = '../warmup-gate.html';
  }
  gate = _abs(gate);

  const params = {
    phase: 'cooldown',
    gatePhase: 'cooldown',

    hub,
    next,

    cat,
    theme: 'calm',
    pick: _pickMode(),
    cdur: (opts.cdur ?? _qs('cdur', '12')),

    run: _qs('run','play'),
    diff: _qs('diff','normal'),
    time: _qs('time','80'),
    seed: _qs('seed', String(Date.now())),

    studyId: _qs('studyId',''),
    pid: _qs('pid','anon'),
    conditionGroup: _qs('conditionGroup',''),
    researchPhase: _qs('researchPhase', _qs('phase','')),

    view: _qs('view',''),
    log: _qs('log',''),
    api: _qs('api',''),
  };

  const variant = _qs('variant','');
  if (variant) params.variant = variant;

  if (opts.extraParams && typeof opts.extraParams === 'object'){
    Object.assign(params, opts.extraParams);
  }

  const target = _buildUrl(gate, params);

  if (opts.replace) window.location.replace(target);
  else window.location.href = target;

  return target;
}

/**
 * Convenience helper for "Back HUB" buttons
 */
export function bindBackToHubThroughCooldown(selectorOrEl, gameKey, opts={}){
  const el = typeof selectorOrEl === 'string'
    ? document.querySelector(selectorOrEl)
    : selectorOrEl;
  if (!el) return null;
  el.addEventListener('click', (e)=>{
    e.preventDefault();
    goAfterGame(gameKey, opts);
  });
  return el;
}