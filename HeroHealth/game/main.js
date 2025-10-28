// === Hero Health Academy — game/main.js (2025-10-28, click-safe, quests-ready) ===
// - Single entry for all modes (goodjunk / groups / hydration / plate)
// - Fixes: UI mode pointer-events, mobile taps, passive HUD, start/pause/resume/menu
// - Hooks: Quests, Progression, VRInput reticle/dwell, FX, SFX, Score
// - Safe to drop-in even if some modules are missing (graceful fallback)

window.__HHA_BOOT_OK = true;

// ----------------------------- Imports (soft where possible) -----------------------------
import * as goodjunk   from '/webxr-health-mobile/HeroHealth/game/modes/goodjunk.js'     .catch?.(()=>({})) || {};
import * as groups     from '/webxr-health-mobile/HeroHealth/game/modes/groups.js'       .catch?.(()=>({})) || {};
import * as hydration  from '/webxr-health-mobile/HeroHealth/game/modes/hydration.js'    .catch?.(()=>({})) || {};
import * as plate      from '/webxr-health-mobile/HeroHealth/game/modes/plate.js'        .catch?.(()=>({})) || {};

import { Quests }      from '/webxr-health-mobile/HeroHealth/game/core/quests.js'        .catch?.(()=>({bindToMain:()=>({refresh(){}})})) || {bindToMain:()=>({refresh(){}})};
import { Progress }    from '/webxr-health-mobile/HeroHealth/game/core/progression.js'   .catch?.(()=>({emit:()=>{}, runCtx:{}})) || {emit:()=>{}, runCtx:{}};
import * as VRInputMod from '/webxr-health-mobile/HeroHealth/game/core/vrinput.js'       .catch?.(()=>({configure:()=>{}})) || {configure:()=>{}};
import * as SFXMod     from '/webxr-health-mobile/HeroHealth/game/core/sfx.js'           .catch?.(()=>({play:()=>{}, setMute:()=>{}})) || {play:()=>{}, setMute:()=>{}};
import * as HUDMod     from '/webxr-health-mobile/HeroHealth/game/core/hud.js'           .catch?.(()=>({HUD: class{ setQuestChips(){} setTarget(){} setScore(){} setCombo(){} } })) || {};
const HUD = HUDMod.HUD || class { setQuestChips(){} setTarget(){} setScore(){} setCombo(){} };

// Safe FX bootstrap (avoid duplicate identifiers across modules)
(function ensureFX(){
  if (!window.HHA_FX) {
    window.HHA_FX = { add3DTilt: ()=>{}, shatter3D: ()=>{} };
    import('/webxr-health-mobile/HeroHealth/game/core/fx.js').then(m=>Object.assign(window.HHA_FX, m||{})).catch(()=>{});
  }
})();

// ----------------------------- DOM helpers -----------------------------
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const byAction = (ev)=>ev.target?.closest?.('[data-action]') || null;

function setText(sel, txt){ const el=$(sel); if(el) el.textContent = txt; }
function show(id, on=true){ const el=$(id); if(el) el.style.display = on?'block':'none'; }

// ----------------------------- UI Mode & Clickability Hotfix -----------------------------
const UI = {
  setMode(mode){ // 'menu' | 'playing' | 'paused' | 'result'
    document.body.classList.remove('ui-mode-menu','ui-mode-playing','ui-mode-paused','ui-mode-result');
    document.body.classList.add('ui-mode-'+mode);

    // HUD is passive while playing (won't steal clicks)
    const passive = (mode === 'playing');
    const hudIds = ['hudWrap','platePills','missionLine','toast','targetWrap','coachHUD'];
    hudIds.forEach(id=>{
      const el = document.getElementById(id);
      if (!el) return;
      if (passive) el.classList.add('hud-passive');
      else el.classList.remove('hud-passive');
    });

    const menu   = $('#menuBar');
    const result = $('#resultModal');
    if (menu)   menu.style.pointerEvents   = (mode==='menu'   ? 'auto' : 'none');
    if (result) result.style.pointerEvents = (mode==='result' ? 'auto' : 'none');

    // Toggle visibility
    if (menu)   menu.style.display   = (mode==='menu'?'block':'none');
    if (result) result.style.display = (mode==='result'?'block':'none');
  },
  start(){ this.setMode('playing'); },
  menu(){  this.setMode('menu');    },
  pause(){ this.setMode('paused');  },
  resume(){this.setMode('playing'); },
  result(){this.setMode('result');  },
};
window.HHA_UI = UI;

// Global delegation for all buttons
document.addEventListener('click', (ev)=>{
  const btn = byAction(ev);
  if (!btn) return;
  const act = btn.getAttribute('data-action');
  if (!act) return;

  ev.preventDefault(); ev.stopPropagation();
  switch(act){
    case 'start': case 'play': HHA.startGame(); break;
    case 'menu':               HHA.stopToMenu(); break;
    case 'pause':              HHA.pause(); break;
    case 'resume':             HHA.resume(); break;
    case 'result':             UI.result(); break;
    case 'mute':               HHA.toggleMute(); break;
    case 'lang-th':            HHA.setLang('TH'); break;
    case 'lang-en':            HHA.setLang('EN'); break;
    case 'mode-gj':            HHA.selectMode('goodjunk'); break;
    case 'mode-gr':            HHA.selectMode('groups'); break;
    case 'mode-hy':            HHA.selectMode('hydration'); break;
    case 'mode-pl':            HHA.selectMode('plate'); break;
    default: try{ window.HHA?.do?.(act);}catch{}
  }
},{capture:true});

// touch friendly (some browsers have passive default)
['touchstart','touchend'].forEach(t=>{
  document.addEventListener(t, ()=>{}, {passive:false});
});

// Clean up any old blockers
['screenBlocker','cover'].forEach(id=>{
  const el = $('#'+id); if (el){ el.style.display='none'; el.style.pointerEvents='none'; }
});

// ----------------------------- Game Core -----------------------------
const MODES = { goodjunk, groups, hydration, plate };

const State = {
  lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(),
  difficulty: (localStorage.getItem('hha_diff')||'Normal'),
  seconds: 45,                 // default run length
  modeKey: 'goodjunk',         // default mode
  running: false,
  freezeUntil: 0,              // used by some powers
  ctx: {},                     // mode-owned context
};

const Systems = {
  hud: new HUD(),
  sfx: SFXMod,
  score: (()=>{ // small score system
    let _score = 0;
    let _combo = 0; let _comboMax = 0;
    return {
      reset(){ _score = 0; _combo = 0; _comboMax = 0; Systems.hud?.setScore?.(0); Systems.hud?.setCombo?.(0,0); },
      add(n){ _score = (_score|0) + (n|0); Systems.hud?.setScore?.(_score); },
      get(){ return _score|0; },
      hit(result){
        if (result==='bad'){ _combo = 0; }
        else { _combo++; _comboMax = Math.max(_comboMax, _combo); }
        Systems.hud?.setCombo?.(_combo,_comboMax);
        return _combo;
      },
      summary(){ return { score:_score|0, comboMax:_comboMax|0 }; }
    };
  })(),
  spawner: {
    lifeMs: 1200,
    lastSpawn: 0,
  },
  input: VRInputMod,
};

// bind quests to HUD for live chips
const QBind = Quests.bindToMain({ hud: Systems.hud });

// configurable reticle+dwell (can be overridden via localStorage)
(function configureVRInput(){
  const dwell = Number(localStorage.getItem('hha_dwell_ms')||700);
  const size  = Number(localStorage.getItem('hha_reticle_px')||42);
  try{
    Systems.input.configure?.({
      reticlePx: size,
      dwellMs: dwell,
      // ensure reticle never steals menu clicks
      ignoreSelectors: ['#menuBar','[data-ui="dialog"]']
    });
  }catch{}
})();

// ----------------------------- Mode plumbing -----------------------------
function getMode(){
  return MODES[State.modeKey] || plate; // fallback
}

function spawnMeta(now){
  const mode = getMode();
  const diff = { life: Systems.spawner.lifeMs };
  try{ return mode.pickMeta?.(diff, State) || null; }catch(e){ console.warn('pickMeta error', e); return null; }
}

function applyHit(meta, result){
  // scoring
  const base = (result==='perfect'? 20 : result==='good'? 10 : result==='bad'? -5 : 0);
  if (base) Systems.score.add(base);
  // combo
  const comboNow = Systems.score.hit(result);

  // quests hook
  try{
    Quests.event('hit', { result, meta, comboNow, _ctx: { score: Systems.score.get() } });
  }catch{}

  // sfx (extra safety)
  try{
    if (result==='perfect') Systems.sfx.play?.('sfx-perfect');
    else if (result==='good') Systems.sfx.play?.('sfx-good');
    else if (result==='bad') Systems.sfx.play?.('sfx-bad');
  }catch{}
}

// wire gameplay surface
(function attachGameplaySurface(){
  const surface = $('#gameLayer') || document.body;
  surface.addEventListener('click', (ev)=>{
    const el = ev.target.closest?.('[data-meta]');
    if (!el) return;
    const meta = JSON.parse(el.getAttribute('data-meta')||'{}');
    handleHit(meta, el);
  }, {capture:true});
})();

function handleHit(meta, elNode){
  // let mode decide result
  let result = 'ok';
  try{
    result = getMode().onHit?.(meta, Systems, State, Systems.hud) || 'ok';
  }catch(e){ console.warn('onHit error', e); }

  // fx
  try{ const r = elNode?.getBoundingClientRect?.(); if (r){ window.HHA_FX?.shatter3D?.(r.left+r.width/2, r.top+r.height/2); } }catch{}

  applyHit(meta, result);
}

// ----------------------------- Run Loop -----------------------------
let _raf = 0;
let _lastTs = 0;
let _secTimer = 0;

function loop(ts){
  _raf = requestAnimationFrame(loop);
  const dt = Math.max(0, ts - _lastTs); _lastTs = ts;

  // freeze (power up)
  if (State.freezeUntil && performance.now() < State.freezeUntil) {
    return; // skip spawns / ticks while frozen
  }

  // 1) spawn items by mode (your engine would render DOM/3D from meta)
  if (Systems.spawner.lastSpawn + Systems.spawner.lifeMs*0.9 < ts){
    Systems.spawner.lastSpawn = ts;
    const meta = spawnMeta(ts);
    if (meta) {
      // notify quests about golden window / target flags if needed (optional)
      // render UI item (DOM example)
      renderSpawn(meta);
    }
  }

  // 2) per-mode tick
  try{ getMode().tick?.(State, Systems, Systems.hud); }catch{}

  // 3) quests 1Hz tick (for time/score-linked quests)
  _secTimer += dt;
  if (_secTimer >= 1000){
    _secTimer -= 1000;
    try{
      Quests.tick({ score: Systems.score.get() });
    }catch{}
  }
}

function renderSpawn(meta){
  // Example DOM spawner (for 2D prototype); replace with your 3D engine if present
  const host = $('#spawnHost') || $('#gameLayer') || document.body;
  const el = document.createElement('button');
  el.className = 'spawn-emoji';
  el.type = 'button';
  el.textContent = meta.char || '🍎';
  el.setAttribute('aria-label', meta.aria||meta.label||'item');
  el.setAttribute('data-meta', JSON.stringify(meta));
  el.style.position = 'absolute';
  el.style.left = (Math.random()*72+14)+'%';
  el.style.top = (Math.random()*50+20)+'%';
  el.style.fontSize = '42px';
  el.style.background = 'transparent';
  el.style.border = '0';
  el.style.cursor = 'pointer';
  el.style.transition = 'transform 90ms ease';

  try{ window.HHA_FX?.add3DTilt?.(el); }catch{}

  host.appendChild(el);
  // auto-remove after life
  const life = Math.max(400, Number(meta.life)||1200);
  setTimeout(()=>{ el.remove(); }, life);
}

// ----------------------------- Public API -----------------------------
const HHA = {
  startGame(){
    // ensure mode from menu selection is used
    UI.start();

    // reset context
    State.running = true;
    State.ctx = {};
    Systems.score.reset();

    // quests
    try{ Quests.beginRun(State.modeKey, State.difficulty, State.lang, State.seconds); }catch{}

    // init mode
    try{ getMode().init?.(State, Systems.hud, { diff: State.difficulty }); }catch(e){ console.warn('mode init error', e); }

    // progression event
    try{ Progress.emit?.('run_start', { mode: State.modeKey, difficulty: State.difficulty }); }catch{}

    // start loop
    cancelAnimationFrame(_raf); _lastTs = performance.now(); _secTimer = 0;
    _raf = requestAnimationFrame(loop);
  },

  stopToMenu(){
    try{ getMode().cleanup?.(State, Systems.hud); }catch{}
    try{
      const sum = { ...Systems.score.summary(), overfill: State.ctx?.overfillCount|0, highCount: State.ctx?.highCount|0 };
      Quests.endRun(sum);
      Progress.emit?.('run_end', { ...sum, mode: State.modeKey });
    }catch{}
    cancelAnimationFrame(_raf);
    State.running = false;
    UI.menu();
  },

  pause(){ if (!State.running) return; UI.pause(); cancelAnimationFrame(_raf); },
  resume(){ if (!State.running) return; UI.resume(); _lastTs = performance.now(); _raf = requestAnimationFrame(loop); },

  selectMode(key){
    if (!MODES[key]) return;
    State.modeKey = key;
    setText('#modeName', ({goodjunk:'Good vs Junk', groups:'Groups', hydration:'Hydration', plate:'Balanced Plate'})[key]||key);
  },

  setLang(l){
    State.lang = (l||'TH').toUpperCase();
    localStorage.setItem('hha_lang', State.lang);
    QBind.refresh?.();
  },

  setDifficulty(d){
    State.difficulty = d||'Normal';
    localStorage.setItem('hha_diff', State.difficulty);
  },

  toggleMute(){
    const m = localStorage.getItem('hha_mute')==='1' ? '0':'1';
    localStorage.setItem('hha_mute', m);
    try{ Systems.sfx.setMute?.(m==='1'); }catch{}
  },

  // exposed for other scripts
  do(action){
    if (action==='power-x2')      { try{ getMode().powers?.x2Target?.(); }catch{} }
    else if (action==='power-freeze'){ State.freezeUntil = performance.now()+3000; }
    else if (action==='power-magnet'){ try{ getMode().powers?.magnetNext?.(); }catch{} }
  }
};
window.HHA = HHA;

// ----------------------------- Initial UI state -----------------------------
UI.menu();
HHA.selectMode(State.modeKey);

// Safety: ensure key panels exist; if not, create minimal hosts so clicks work
(function ensureHosts(){
  if (!$('#gameLayer')) { const d=document.createElement('div'); d.id='gameLayer'; document.body.appendChild(d); }
  if (!$('#spawnHost')) { const d=document.createElement('div'); d.id='spawnHost'; d.style.position='relative'; d.style.width='100%'; d.style.height='100%'; $('#gameLayer').appendChild(d); }
})();

// ----------------------------- Keyboard shortcuts (dev) -----------------------------
document.addEventListener('keydown', (e)=>{
  if (e.key==='Enter') HHA.startGame();
  if (e.key==='Escape') HHA.stopToMenu();
  if (e.key===' ') { e.preventDefault(); if (document.body.classList.contains('ui-mode-playing')) HHA.pause(); else HHA.resume(); }
});

// ----------------------------- Minimal Styles (only if missing) -----------------------------
(function injectMinimalStyles(){
  if (document.getElementById('hha-min-style')) return;
  const css = `
  .hud-passive{ pointer-events:none !important; }
  #menuBar, #resultModal, [data-ui="menu"], [data-ui="dialog"]{ pointer-events:auto !important; }
  .spawn-emoji:active{ transform: scale(0.92); }
  body.ui-mode-menu  #menuBar{ display:block; }
  body.ui-mode-result #resultModal{ display:block; }
  `;
  const el = document.createElement('style'); el.id='hha-min-style'; el.textContent = css; document.head.appendChild(el);
})();
