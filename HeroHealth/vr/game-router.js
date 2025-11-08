// === vr/game-router.js (2025-11-06, safe/quest modules, scene-ready, single-instance) ===

// ---------- small utils ----------
function qparam(name, def) {
  try { var u=new URL(location.href); var v=u.searchParams.get(name); return (v===null||v===undefined)?def:v; }
  catch(_) { return def; }
}
function log(){ try{ console.log.apply(console, arguments); }catch(_){} }
function err(){ try{ console.error.apply(console, arguments); }catch(_){} }

// ---------- URL params ----------
var mode     = String(qparam('mode','goodjunk')).toLowerCase();
var diff     = String(qparam('difficulty','normal')).toLowerCase();
var duration = parseInt(qparam('duration','60'),10) || 60;
var goal     = parseInt(qparam('goal','40'),10) || 40;
var hostId   = String(qparam('host','spawnHost'));

// ---------- map to SAFE/QUEST modules ----------
var MODULES = {
  goodjunk : '../modes/goodjunk.safe.js',
  groups   : '../modes/groups.safe.js',
  hydration: '../modes/hydration.quest.js',
  plate    : '../modes/plate.quest.js'
};

// ---------- single-instance guard ----------
function stopCurrent(){
  try{
    if (window.__HHA_GAME && typeof window.__HHA_GAME.stop==='function') {
      window.__HHA_GAME.stop();
    }
  }catch(_){}
  window.__HHA_GAME = null;
}

// ---------- boot wrapper ----------
async function bootMode(modUrl){
  var url = modUrl + (modUrl.indexOf('?')>-1?'&':'?') + 'v=' + Date.now();
  var mod = await import(url);
  if (!mod || typeof mod.boot!=='function') throw new Error('Module has no boot()');
  var host = document.getElementById(hostId) || document.querySelector('#spawnHost') || document.body;
  var api = await mod.boot({ host: host, difficulty: diff, duration: duration, goal: goal });
  window.__HHA_GAME = api || { stop:function(){}, pause:function(){}, resume:function(){} };
  window.dispatchEvent(new CustomEvent('hha:mode-loaded', { detail:{ mode:mode, difficulty:diff, duration:duration, goal:goal } }));
  log('[VR] booted', mode, diff, duration, goal);
}

// ---------- main loader with fallback ----------
async function load(){
  stopCurrent();
  var mainUrl = MODULES[mode] || MODULES.goodjunk;
  try{
    await bootMode(mainUrl);
  }catch(e){
    err('[VR] load failed for', mode, e && e.message ? e.message : e);
    // fallback → goodjunk
    if (mainUrl !== MODULES.goodjunk){
      try{
        await bootMode(MODULES.goodjunk);
        log('[VR] fallback to goodjunk ok');
      }catch(e2){
        err('[VR] fallback failed', e2 && e2.message ? e2.message : e2);
        window.dispatchEvent(new CustomEvent('hha:mode-error', { detail:{ mode:mode, error:e2 } }));
      }
    }else{
      window.dispatchEvent(new CustomEvent('hha:mode-error', { detail:{ mode:mode, error:e } }));
    }
  }
}

// ---------- wait for A-Frame scene ready ----------
(function startWhenSceneReady(){
  var scene = document.querySelector('a-scene');
  if (scene){
    if (scene.hasLoaded) { setTimeout(load, 0); }
    else { scene.addEventListener('loaded', function(){ setTimeout(load, 0); }, { once:true }); }
  }else{
    // no a-scene? still try after a short delay
    setTimeout(load, 150);
  }
})();

// ---------- hot re-run via event (optional) ----------
// window.dispatchEvent(new CustomEvent('hha:mode-reload', {detail:{mode:'groups', difficulty:'hard'}}));
window.addEventListener('hha:mode-reload', function(e){
  try{
    var d = e && e.detail ? e.detail : {};
    if (d.mode) mode = String(d.mode).toLowerCase();
    if (d.difficulty) diff = String(d.difficulty).toLowerCase();
    if (d.duration!=null) duration = parseInt(d.duration,10)||duration;
    if (d.goal!=null) goal = parseInt(d.goal,10)||goal;
  }catch(_){}
  load();
});
