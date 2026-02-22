// === /herohealth/gate-nav.js ===
// HeroHealth Gate Navigation Helper (Warmup/Cooldown routing)
'use strict';

export function qs(name, fallback=''){
  try{
    const u = new URL(window.location.href);
    return u.searchParams.get(name) ?? fallback;
  }catch(e){
    return fallback;
  }
}

export function absUrl(url){
  if(!url) return '';
  try{ return new URL(url, window.location.href).toString(); }catch(e){ return url; }
}

export function buildUrl(base, params){
  const u = new URL(base, window.location.href);
  Object.entries(params || {}).forEach(([k,v])=>{
    if (v === undefined || v === null || v === '') return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}

// map gameKey -> cat/theme for warmup-gate
export function mapGameToCatTheme(gameKey){
  const g = String(gameKey || '').toLowerCase().trim();

  // nutrition
  if (g === 'goodjunk')   return { cat:'nutrition', theme:'goodjunk' };
  if (g === 'groups')     return { cat:'nutrition', theme:'groups' };
  if (g === 'hydration')  return { cat:'nutrition', theme:'hydration' };
  if (g === 'plate')      return { cat:'nutrition', theme:'plate' };

  // hygiene
  if (g === 'handwash')   return { cat:'hygiene', theme:'handwash' };
  if (g === 'brush')      return { cat:'hygiene', theme:'brush' };
  if (g === 'maskcough')  return { cat:'hygiene', theme:'maskcough' };
  if (g === 'germ' || g === 'germdetective') return { cat:'hygiene', theme:'germ' };
  if (g === 'bath')       return { cat:'hygiene', theme:'bath' };
  if (g === 'clean' || g === 'cleanobjects') return { cat:'hygiene', theme:'clean' };

  // exercise / fitness
  if (g === 'shadow')     return { cat:'exercise', theme:'shadow' };
  if (g === 'rhythm')     return { cat:'exercise', theme:'rhythm' };
  if (g === 'jumpduck')   return { cat:'exercise', theme:'jumpduck' };
  if (g === 'balance' || g === 'balancehold') return { cat:'exercise', theme:'balance' };
  if (g === 'planner')    return { cat:'exercise', theme:'planner' };

  return { cat:'nutrition', theme:'goodjunk' };
}

export function decidePickMode(){
  const pick = String(qs('pick','')).toLowerCase().trim();
  if (pick === 'rand' || pick === 'day') return pick;

  const run = String(qs('run','play')).toLowerCase().trim();
  return (run === 'research') ? 'day' : 'rand';
}

/**
 * Build cooldown gate URL from current game page.
 * @param {Object} cfg
 * @param {string} cfg.gameKey - canonical game key e.g. plate, hydration, handwash, shadow
 * @param {string} [cfg.hub] - override hub URL
 * @param {string} [cfg.next] - where cooldown should go after finish (default hub)
 * @param {Object} [cfg.extra] - extra qs passthrough
 */
export function buildCooldownGateUrl(cfg={}){
  const gameKey = String(cfg.gameKey || '').trim();
  const mapped = mapGameToCatTheme(gameKey);

  const hub = absUrl(cfg.hub || qs('hub', '../herohealth/hub.html') || '../herohealth/hub.html');
  const next = absUrl(cfg.next || hub);

  const gate = absUrl('/herohealth/warmup-gate.html'); // absolute root path (GitHub Pages safe if repo root same)
  // If you prefer relative, use: './warmup-gate.html' from /herohealth pages only

  const params = {
    // gate routing
    phase: 'cooldown',
    gatePhase: 'cooldown',
    cat: mapped.cat,
    theme: 'calm',
    pick: decidePickMode(),

    // destinations
    hub,
    next,

    // runtime/research passthrough
    run: qs('run','play'),
    diff: qs('diff','normal'),
    time: qs('time','80'),
    seed: qs('seed', String(Date.now())),
    pid: qs('pid','anon'),
    studyId: qs('studyId',''),
    conditionGroup: qs('conditionGroup',''),
    researchPhase: qs('researchPhase', qs('phase','')),
    view: qs('view',''),
    log: qs('log',''),
    api: qs('api',''),

    // optional variant/pick overrides continue through
    variant: qs('variant','')
  };

  // caller extras win
  Object.assign(params, cfg.extra || {});

  return buildUrl(gate, params);
}

/**
 * Go cooldown gate immediately
 */
export function goCooldownGate(cfg={}){
  const url = buildCooldownGateUrl(cfg);
  window.location.replace(url);
  return url;
}