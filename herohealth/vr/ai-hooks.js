// === /herohealth/vr/ai-hooks.js ===
// HeroHealth AI Hooks — Universal Stub (Production-safe)
// v20260301-AIHOOKS-UNIVERSAL
// Purpose: Provide a stable, shared interface for AI Director/Coach/Pattern (future)
// This file MUST remain deterministic-friendly and research-safe by default.

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function nowIso(){ try{ return new Date().toISOString(); }catch(e){ return ''; } }

function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; }
}

function mulberry32(a){
  return function(){
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function safeDispatch(type, detail){
  try{
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }catch(e){}
}

function setText(id, v){
  try{
    const el = document.getElementById(id);
    if(el) el.textContent = String(v);
  }catch(e){}
}

function defaultEnabled(runMode){
  // research-safe default: OFF in research unless explicitly enabled
  const qAi = qs('ai','');
  const qCoach = qs('coach','');
  const qDirector = qs('director','');
  if(String(runMode||'').toLowerCase() === 'research'){
    return (qAi === '1' || qCoach === '1' || qDirector === '1') ? true : false;
  }
  // play: hooks allowed (still no adaptive logic here)
  return true;
}

function mkNoopApi(base){
  const api = Object.assign({}, base);
  const noop = ()=>{};
  api.emit = noop;
  api.score = noop;
  api.coach = noop;
  api.snapshot = noop;
  api.end = noop;
  api.pattern = noop;
  api.director = noop;
  api.setRisk = noop;
  api.setHint = noop;
  api._rng = ()=>Math.random();
  api._state = { risk:null, hint:'—', ended:false };
  return api;
}

/**
 * createAIHooks(opts)
 * opts: { seed, runMode, game, diff, device, enabled }
 * Returns: a stable object with no-op safe methods.
 */
export function createAIHooks(opts = {}){
  const seedStr = String(opts.seed ?? qs('seed', String(Date.now())));
  let seedNum = 0;
  for(let i=0;i<seedStr.length;i++) seedNum = (seedNum * 31 + seedStr.charCodeAt(i)) >>> 0;

  const runMode = String(opts.runMode ?? qs('run','play')).toLowerCase();
  const game = String(opts.game ?? qs('game','unknown'));
  const diff = String(opts.diff ?? qs('diff','normal')).toLowerCase();
  const device = String(opts.device ?? qs('view','pc')).toLowerCase();

  const enabled = (typeof opts.enabled === 'boolean') ? opts.enabled : defaultEnabled(runMode);

  const base = {
    enabled,
    seed: seedStr,
    runMode,
    game,
    diff,
    device,
    ts0: Date.now(),
    iso0: nowIso()
  };

  // Even if disabled, return a valid API (no crash)
  if(!enabled) return mkNoopApi(base);

  const rng = mulberry32((seedNum ^ 0xA11C0DE) >>> 0);

  // Minimal shared state (for HUD + future AI)
  const st = {
    risk: null,
    hint: '—',
    lastScore: null,
    lastCoach: null,
    lastSnap: null,
    ended: false
  };

  function hud(){
    // Optional HUD ids used across games (if present)
    if(st.risk !== null) setText('aiRisk', (typeof st.risk === 'number') ? st.risk.toFixed(2) : String(st.risk));
    if(st.hint) setText('aiHint', st.hint);
  }

  function emit(kind, data){
    safeDispatch('hha:ai', {
      kind,
      data: data || {},
      meta: { game, runMode, diff, device, seed: seedStr, t: Date.now() }
    });
  }

  function score(data){
    st.lastScore = data || null;
    emit('score', data || {});
    safeDispatch('hha:score', { game, ...(data||{}) });
  }

  function coach(text, data){
    st.lastCoach = { text: String(text||''), data: data||null };
    emit('coach', { text: String(text||''), ...(data||{}) });
    safeDispatch('hha:coach', { game, text: String(text||''), ...(data||{}) });
  }

  function snapshot(data){
    st.lastSnap = data || null;
    emit('snapshot', data || {});
  }

  function end(data){
    st.ended = true;
    emit('end', data || {});
  }

  function setRisk(v){
    st.risk = (v === null || v === undefined) ? null : (typeof v === 'number' ? clamp(v,0,1) : v);
    hud();
  }
  function setHint(t){
    st.hint = String(t || '—');
    hud();
  }

  // Placeholders for future plug-in modules
  function pattern(_){ /* reserved */ }
  function director(_){ /* reserved */ }

  hud();

  return {
    ...base,
    emit,
    score,
    coach,
    snapshot,
    end,
    setRisk,
    setHint,
    pattern,
    director,
    _rng: rng,
    _state: st
  };
}

export default { createAIHooks };