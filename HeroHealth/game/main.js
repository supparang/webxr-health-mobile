// === Hero Health Academy — game/main.js (DOM-spawn engine, quests/HUD wired, groups-first ready) ===
// This main.js boots the game with a minimal DOM engine that works with the new
// groups.css (DOM-spawn .spawn-emoji buttons) and the factory adapters found in
// each mode (e.g., groups.create). It also falls back to legacy pickMeta/onHit()
// when a mode doesn’t expose create().
//
// Expected HTML ids in page (safe if missing; calls are guarded):
// - #gameLayer (absolute/fixed area for gameplay)
// - #spawnHost (positioned container inside #gameLayer)
// - #hudWrap  (#time, #score, quest chips, etc. if present)
// - #targetWrap / #targetBadge (for “groups” target HUD)
// - #result (modal) with [data-result="replay|home"]
//
// Usage (UI):
//   window.HHA.startGame({ mode:'groups', diff:'Normal', lang:'TH', seconds:45 });
//   window.HHA.endGame();  // to force-stop
//
// Default (if UI doesn’t pass anything): mode='groups', diff='Normal', lang from localStorage.
//
// -----------------------------------------------------------------------------
// Imports (relative to /HeroHealth/game/)
import { ScoreSystem }    from './core/score.js';
import { PowerUpSystem }  from './core/powerup.js';
import { Quests }         from './core/quests.js';
import { Progress }       from './core/progression.js';

// Modes (factory-first; legacy-safe fallback)
import * as groups    from './modes/groups.js';
import * as goodjunk  from './modes/goodjunk.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

// Optional SFX helper (works with either core/sfx.js or <audio> tags)
const SFX = (()=>{
  // Prefer core/sfx if present on window
  const core = window.SFX;
  if (core && typeof core.play === 'function'){
    return {
      good: ()=>core.play('sfx-good'),
      bad: ()=>core.play('sfx-bad'),
      perfect: ()=>core.play('sfx-perfect'),
      tick: ()=>core.play('sfx-tick'),
      power: ()=>core.play('sfx-powerup'),
      play: (id)=>core.play(id)
    };
  }
  // Fallback to DOM <audio>
  const play = (id)=>{ try{ const el=document.getElementById(id); if(el){ el.currentTime=0; el.play(); } }catch{} };
  return { good:()=>play('sfx-good'), bad:()=>play('sfx-bad'), perfect:()=>play('sfx-perfect'), tick:()=>play('sfx-tick'), power:()=>play('sfx-powerup'), play };
})();

// Tiny DOM helpers
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

// -----------------------------------------------------------------------------
// HUD facade (all calls are no-ops if elements are missing)
const HUD = (() => {
  const chipsWrap = $('#missionChips') || $('#questChips') || null;
  const targetBadge = $('#targetBadge') || null;
  const targetWrap  = $('#targetWrap')  || null;
  const hydroWrap   = $('#hydroWrap')   || null;
  const scoreEl = $('#score') || $('#scoreVal') || null;
  const timeEl  = $('#time')  || $('#timeLeft') || null;

  function setQuestChips(list){
    if (!chipsWrap) return;
    // list: [{key,icon,need,progress,remain,done,fail,label}]
    chipsWrap.innerHTML = list.map(c=>`
      <div class="chip ${c.done?'done':''} ${c.fail?'fail':''}" data-q="${c.key}">
        <span class="ico">${c.icon||'⭐'}</span>
        <span class="txt">${c.label||c.key}</span>
        <span class="bar"><i style="width:${Math.round((c.progress|0)/(c.need||1)*100)}%"></i></span>
      </div>
    `).join('');
  }

  function markQuestDone(qid){
    const el = chipsWrap?.querySelector?.(`[data-q="${qid}"]`);
    if (!el) return;
    el.classList.add('done');
    // micro ping
    el.animate?.([{transform:'scale(1)'},{transform:'scale(1.06)'},{transform:'scale(1)'}], {duration:320, easing:'ease-out'});
  }

  function setTarget(groupKey, have=0, need=0){
    if (targetBadge){
      const nameTH = ({veggies:'ผัก', protein:'โปรตีน', grains:'ธัญพืช', fruit:'ผลไม้', dairy:'นม'})[groupKey] || groupKey;
      targetBadge.textContent = `${nameTH} • ${have}/${need}`;
    }
    if (targetWrap){ targetWrap.style.display = 'inline-flex'; }
  }

  function showHydration(){ if (hydroWrap){ hydroWrap.style.display='block'; } }
  function hideHydration(){ if (hydroWrap){ hydroWrap.style.display='none'; } }
  function setScore(n){ if (scoreEl) scoreEl.textContent = n|0; }
  function setTime(n){ if (timeEl)  timeEl.textContent  = n|0; }

  return { setQuestChips, markQuestDone, setTarget, showHydration, hideHydration, setScore, setTime };
})();

// Coach facade (bubble texts; safe-ops)
const Coach = (() => {
  const hud  = $('#coachHUD');
  const text = $('#coachText');
  const say = (t)=>{ if(text) text.textContent=t; if(hud) hud.classList.add('show'); };
  const hush= ()=>{ if(hud) hud.classList.remove('show'); };
  return {
    onStart(){ say('Ready!'); setTimeout(hush, 700); },
    onGood(){ /* subtle pulse */ },
    onPerfect(){ say('Perfect!'); setTimeout(hush, 500); },
    onBad(){ say('Oops!'); setTimeout(hush, 450); },
    onQuestDone(){ say('Mission ✓'); setTimeout(hush, 600); },
    onQuestFail(){ say('Mission ✗'); setTimeout(hush, 600); },
    onQuestProgress(label, p, t){ /* optional live hints */ }
  };
})();

// Simple floating text FX
const FX = {
  popText(txt, {x=innerWidth/2, y=innerHeight/2, ms=700}={}){
    const el = document.createElement('div');
    el.className = 'popText';
    el.textContent = txt;
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
      font-weight:900;text-shadow:0 2px 8px #000a;pointer-events:none;z-index:120;`;
    document.body.appendChild(el);
    el.animate?.(
      [{transform:'translate(-50%,-40%) scale(.9)', opacity:.0},
       {transform:'translate(-50%,-50%) scale(1)', opacity:1, offset:.25},
       {transform:'translate(-50%,-70%) scale(1.08)', opacity:0}],
      {duration:ms, easing:'ease-out'}
    ).finished?.then(()=>el.remove()).catch(()=>{ try{el.remove();}catch{} });
  }
};

// -----------------------------------------------------------------------------
// Engine (scene-agnostic; only DOM + mode adapter)
const Engine = (() => {
  let modeKey = 'groups';
  let diffKey = 'Normal';
  let lang    = (localStorage.getItem('hha_lang')||'TH').toUpperCase();
  let seconds = 45;

  // Expose diff for modes that read window.__HHA_DIFF
  window.__HHA_DIFF = diffKey;

  // Runtime
  let running = false;
  let rafId   = 0;
  let lastT   = 0;
  let remain  = 0;

  // Systems
  const score   = new ScoreSystem();
  const power   = new PowerUpSystem();

  // Bus (modes call back into engine via this)
  const Bus = {
    sfx: SFX,
    hit({kind='good', points=0, ui={}, meta={}}={}){
      // Prefer new addKind if available
      if (typeof score.addKind === 'function'){
        const map = { good:'good', perfect:'perfect', ok:'ok', bad:'bad' };
        score.addKind(map[kind]||'good', meta);
      } else {
        // fallback
        if (kind==='bad') score.addPenalty?.(8);
        else score.add?.(points|| (kind==='perfect'?18:10));
      }
      HUD.setScore(score.get?.()||score.value||0);
      Quests.event('hit', { result:kind, meta, comboNow: (score.combo|0)||0 });
      if (kind==='perfect') SFX.perfect(); else if (kind==='bad') SFX.bad(); else SFX.good();
    },
    miss(){
      if (typeof score.addPenalty === 'function') score.addPenalty(6);
      else score.add?.(-4);
      HUD.setScore(score.get?.()||score.value||0);
      Quests.event('miss', {});
      SFX.bad();
    },
    fx: FX,
  };

  // Hook score changes (if using rich ScoreSystem)
  score.setHandlers?.({ change:(val)=>HUD.setScore(val|0) });
  power.attachToScore?.(score);

  // Mode registry
  const MODES = { goodjunk, groups, hydration, plate };
  let adapter = null;   // active adapter { start, stop, update, cleanup }

  // HUD binding into Quests
  const { refresh:questsHUDRefresh } = Quests.bindToMain({ hud: HUD });

  // Helpers
  function byKeySafe(key){
    const M = MODES[key] || MODES.groups;
    // prefer factory adapter if exists
    if (typeof M.create === 'function') return M.create({ engine:{fx:FX}, hud:HUD, coach:Coach });
    // fallback: wrap legacy {pickMeta,onHit,tick}
    return adapterFromLegacy(M);
  }

  function adapterFromLegacy(M){
    const host  = document.getElementById('spawnHost');
    const layer = document.getElementById('gameLayer');
    const items = [];
    let freezeUntil = 0;
    let spawnCd = 0.22;

    function start(){
      stop();
      // call legacy init(state,hud,diff)
      const state = { ctx:{}, difficulty: diffKey, lang };
      try{ M.init?.(state, HUD, {}); }catch{}
      // store to closure
      adapter._state = state;
    }

    function stop(){
      try{ for (const it of items) it.el.remove(); }catch{}
      items.length = 0;
    }

    function spawnOne(){
      const rect = layer.getBoundingClientRect();
      const meta = M.pickMeta?.({life:1600}, adapter._state)||{ char:'⭐', aria:'Star', life:1500, good:true };
      const pad = 30;
      const x = Math.round(pad + Math.random()*(rect.width  - pad*2));
      const y = Math.round(pad + Math.random()*(rect.height - pad*2));
      const b = document.createElement('button');
      b.className = 'spawn-emoji';
      b.type = 'button';
      b.style.left = x + 'px';
      b.style.top  = y + 'px';
      b.textContent = meta.char || '⭐';
      b.setAttribute('aria-label', meta.aria||'item');
      if (meta.golden) b.dataset.golden = '1';
      if (meta.good)   b.dataset.target = '1';
      try{ M.fx?.onSpawn?.(b, adapter._state); }catch{}
      b.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const res = M.onHit?.(meta, { score, sfx:SFX }, adapter._state, HUD) || 'ok';
        if (res==='good' || res==='perfect'){
          Bus.hit({kind:res, ui:{x:ev.clientX,y:ev.clientY}, meta});
          FX.popText(`+${res==='perfect'?18:10}${res==='perfect'?' ✨':''}`, {x:ev.clientX,y:ev.clientY, ms:700});
        } else if (res==='bad'){
          Bus.miss();
          freezeUntil = Math.max(freezeUntil, performance.now()+280);
          document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 160);
        }
        try{ b.remove(); }catch{}
        const i = items.findIndex(it=>it.el===b); if (i>=0) items.splice(i,1);
      }, {passive:false});
      host?.appendChild?.(b);
      items.push({ el:b, born:performance.now(), life:meta.life||1500, meta });
    }

    function update(dt){
      const now = performance.now();
      spawnCd -= dt;
      if (now >= freezeUntil && spawnCd <= 0){
        spawnOne();
        // slightly dynamic
        const timeLeft = Number($('#time')?.textContent||remain|0)|0;
        const bias = timeLeft<=15 ? 0.16 : 0;
        spawnCd = Math.max(0.26, 0.42 - bias + Math.random()*0.24);
      }
      // life ticking
      for (let i=items.length-1;i>=0;i--){
        const it = items[i];
        if (now - it.born > it.life){
          if (it.meta?.good) Bus.miss();
          try{ it.el.remove(); }catch{}
          items.splice(i,1);
        }
      }
      M.tick?.(adapter._state, { score, sfx:SFX }, HUD);
    }

    function cleanup(){ stop(); try{ M.cleanup?.(adapter._state, HUD); }catch{} }

    return { start, stop, update, cleanup, _state:null };
  }

  // Result modal helper
  function showResult(summary){
    const dlg = $('#result'); if (!dlg) return;
    const scoreEl = dlg.querySelector('[data-field="score"]');
    const starsEl = dlg.querySelector('[data-field="stars"]');
    const gradeEl = dlg.querySelector('[data-field="grade"]');
    if (scoreEl) scoreEl.textContent = summary.score|0;
    if (starsEl) starsEl.textContent = '★'.repeat(summary.stars||0);
    if (gradeEl) gradeEl.textContent = summary.grade || '';
    dlg.style.display = 'flex';
  }

  // Core loop
  function loop(t){
    if (!running){ cancelAnimationFrame(rafId); return; }
    const dt = Math.min(0.050, (t - (lastT||t))/1000); // seconds
    lastT = t;

    // mode update
    try{ adapter.update?.(dt, Bus); }catch(e){ console.warn('[adapter.update]', e); }

    // 1s tick
    if (!Engine._tickAt || t-Engine._tickAt >= 1000){
      Engine._tickAt = t;
      remain = Math.max(0, (remain|0) - 1);
      HUD.setTime(remain);
      Quests.tick({ score: score.get?.()||score.value||0 });

      if (remain <= 5 && remain > 0) SFX.tick();
      if (remain === 0){
        end(false);
        return;
      }
    }
    rafId = requestAnimationFrame(loop);
  }

  function begin({ mode, diff, lang:lg, seconds:sec }){
    // config
    modeKey = (mode||modeKey||'groups');               // default to groups
    diffKey = (diff||diffKey||'Normal');
    lang    = (String(lg||lang||'TH')).toUpperCase();
    seconds = Math.max(10, (sec|0) || 45);
    window.__HHA_DIFF = diffKey;

    // mark on DOM for CSS (groups.css watches this)
    document.body.dataset.mode = modeKey;
    document.documentElement.setAttribute('data-hha-mode', modeKey);

    // clean spawnHost & ensure visible containers
    $('#spawnHost')?.replaceChildren?.();

    // systems
    score.reset?.();
    HUD.setScore(0);
    remain = seconds;
    HUD.setTime(remain);

    // bind powerup HUD hooks if you show durations elsewhere
    power.onChange?.((_t)=>{/* no-op, but available for HUD timer bubbles */});

    // quests begin
    Quests.beginRun?.(modeKey, diffKey, lang, seconds);
    questsHUDRefresh?.();

    // progress profile run context (optional)
    try{ Progress.beginRun?.(modeKey, diffKey, lang); }catch{}

    // build adapter
    adapter = byKeySafe(modeKey);
    adapter.start?.();

    // coach cue
    Coach.onStart?.();

    // run
    running = true;
    lastT = 0;
    rafId = requestAnimationFrame(loop);
  }

  function end(forceReplay=false){
    if (!running && !forceReplay){
      // still summarize if called from timeout or repeated
    }
    running = false;
    cancelAnimationFrame(rafId);

    // collect summary
    const g = (typeof score.getGrade === 'function') ? score.getGrade() : { score: (score.get?.()||score.value||0), stars: Math.min(5, Math.floor((score.get?.()||score.value||0)/120)), grade:'-' };
    const summary = { score: g.score|0, stars: g.stars|0, grade: g.grade||'-', highCount: adapter?._state?.highCount|0, overfill: adapter?._state?.ctx?.overfillCount|0 };

    try{ Progress.endRun?.({ score:summary.score, bestCombo: (score.bestCombo|0)||0, timePlayed: (seconds-remain)|0, acc: 0 }); }catch{}
    try{ const out = Quests.endRun?.(summary) || []; /* could be used to update daily/XP */ }catch{}

    adapter?.cleanup?.();

    // show result (if modal exists)
    showResult(summary);
  }

  // Pause on window blur; resume on focus (soft — user must press Start again)
  window.addEventListener('blur', ()=>{ if (running){ running=false; cancelAnimationFrame(rafId); }});
  // Guard autoplay: ensure a user gesture happened once
  document.addEventListener('click', ()=>{ try{
    // if using core/sfx, unlock; else attempt to play silent tick
    if (window.SFX?.unlock) window.SFX.unlock();
    SFX.tick();
  }catch{} }, { once:true });

  // Public API
  return {
    begin, end,
    setMode:(k)=>{ document.body.dataset.mode = k; document.documentElement.setAttribute('data-hha-mode', k); },
    setDiff:(d)=>{ diffKey = d; window.__HHA_DIFF = d; },
    setLang:(l)=>{ localStorage.setItem('hha_lang', String(l||'TH').toUpperCase()); },
    _tickAt: 0
  };
})();

// -----------------------------------------------------------------------------
// Wire up result buttons if present
(function bindResultButtons(){
  const dlg = $('#result'); if (!dlg) return;
  dlg.addEventListener('click', (e)=>{
    const a = e.target.getAttribute('data-result');
    if (a==='replay'){
      dlg.style.display='none';
      window.HHA.startGame({ demoPassed:true }); // rerun with the last config (UI can inject)
    } else if (a==='home'){
      dlg.style.display='none';
      // do nothing; UI page can show menu
    }
  });
})();

// -----------------------------------------------------------------------------
// Global façade expected by ui.js or external menu
window.HHA = window.HHA || {};
window.HHA.startGame = (opts={})=>{
  // Defaults: prefer UI-provided opts; fallback to stored language/diff; mode defaults to 'groups'
  const cfg = {
    mode: (opts.mode || 'groups'),
    diff: (opts.diff || window.__HHA_DIFF || 'Normal'),
    lang: (opts.lang || localStorage.getItem('hha_lang') || 'TH'),
    seconds: Math.max(10, (opts.seconds|0) || 45)
  };
  try { $('#result') && ($('#result').style.display='none'); } catch {}
  Engine.begin(cfg);
};
window.HHA.endGame = ()=> Engine.end(false);

// Legacy aliases (some older UI call these)
window.start = (opts)=> window.HHA.startGame(opts||{ mode:'groups' });
window.end   = ()=> window.HHA.endGame();

// Mark boot success for boot.js banner suppression
window.__HHA_BOOT_OK = 'main';
