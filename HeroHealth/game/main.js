// === Hero Health Academy — game/main.js (runtime glue; Start wired + Coach integrated + Score v2 + PowerUp) ===
window.__HHA_BOOT_OK = 'main';

import { Engine }           from '../core/engine.js';
import { createHUD }        from '../core/hud.js';
import { ScoreSystem }      from '../core/score.js';
import { PowerUpSystem }    from '../core/powerup.js';
import { Quests }           from '../core/quests.js';
import { Progress }         from '../core/progression.js';
import { Leaderboard }      from '../core/leaderboard.js';

const $ = (s)=>document.querySelector(s);

const MODE_PATH = (k)=> `../modes/${k}.js`;
async function loadMode(key){
  const mod = await import(MODE_PATH(key));
  return { name:mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null, cleanup:mod.cleanup||null };
}

const app = {
  engine: null,
  hud: null,
  lb: null,
  power: null,
  scoreSys: null,

  modeKey: 'goodjunk',
  diff: 'Normal',
  lang: (document.documentElement.getAttribute('data-hha-lang')||'TH').toUpperCase(),

  sys: null,        // mode instance
  modeAPI: null,    // module API
  running:false,
  time:45,
  raf:0,

  bestCombo:0,
  runFlags:{ highCount:0, overfill:0 },
};

function bindMenu(){
  const setMode=(k,label)=>{
    app.modeKey=k; document.body.dataset.mode=k;
    const head=$('#modeName'); if(head) head.textContent=label;
    for(const id of ['m_goodjunk','m_groups','m_hydration','m_plate']){
      const b=$('#'+id); if(b) b.classList.toggle('active', id==='m_'+k);
    }
  };
  $('#m_goodjunk')?.addEventListener('click', ()=>setMode('goodjunk','Good vs Junk'));
  $('#m_groups')?.addEventListener('click',   ()=>setMode('groups','5 Food Groups'));
  $('#m_hydration')?.addEventListener('click',()=>setMode('hydration','Hydration'));
  $('#m_plate')?.addEventListener('click',    ()=>setMode('plate','Healthy Plate'));

  const setDiff=(d)=>{
    app.diff=d; const el=$('#difficulty'); if(el) el.textContent=d;
    for(const id of ['d_easy','d_normal','d_hard']){
      const b=$('#'+id); b?.classList.toggle('active', id==='d_'+d.toLowerCase());
    }
  };
  $('#d_easy')?.addEventListener('click',   ()=>setDiff('Easy'));
  $('#d_normal')?.addEventListener('click', ()=>setDiff('Normal'));
  $('#d_hard')?.addEventListener('click',   ()=>setDiff('Hard'));

  document.getElementById('btn_start')?.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); }, {capture:true});
  window.addEventListener('keydown', (e)=>{ if((e.key==='Enter'||e.key===' ') && !app.running && !$('#menuBar')?.hasAttribute('data-hidden')){ e.preventDefault(); startGame(); } }, {passive:false});
}

function showMenu(){ $('#menuBar')?.removeAttribute('data-hidden'); $('#menuBar').style.display='block'; app.hud && (app.hud.hideCoach(), app.hud.setQuestChips([])); }
function hideMenu(){ $('#menuBar')?.setAttribute('data-hidden','1'); $('#menuBar').style.display='none'; }

const Bus = {
  addScore(n=0, ui){ app.scoreSys.add(n|0, { ui }); if(ui?.x&&ui?.y){ app.engine.fx.popText('+'+(n|0), ui); } },
  hit({ kind='good', points, ui={}, meta={} } = {}){
    if (Number.isFinite(points)) app.scoreSys.add(points|0, { kind, ...meta });
    else app.scoreSys.addKind(kind, meta);
    if (ui?.x && ui?.y) app.engine.fx.shatter3D(ui.x, ui.y);
    if (kind==='perfect') Progress.notify('perfect');
    if (meta?.golden)     Progress.notify('golden');
    Quests.event('hit',{ result:kind, meta, comboNow: app.scoreSys.combo|0, score: app.scoreSys.get()|0 });
    app.bestCombo = Math.max(app.bestCombo|0, app.scoreSys.bestCombo|0);
  },
  miss({ meta={} } = {}){
    if (!app.power?.consumeShield?.()){
      app.scoreSys.addKind('bad', { ...meta, penalty:true });
      app.hud.dimPenalty();
      Quests.event('hit',{ result:'bad', meta, comboNow:0, score: app.scoreSys.get()|0 });
    }
  },
  power(kind, sec){ app.power?.apply?.(kind, sec); },
  hydrationTick(zone){
    Quests.event('hydro_tick', { zone:String(zone||'').toUpperCase() });
    if (String(zone).toUpperCase()==='HIGH'){ app.runFlags.highCount=(app.runFlags.highCount|0)+1; Progress.notify('hydration_high'); }
  },
  hydrationCross(from,to){ Quests.event('hydro_cross',{ from:String(from||'').toUpperCase(), to:String(to||'').toUpperCase() }); },
  hydrationClick(kind, zoneBefore){ Quests.event('hydro_click',{ kind, zoneBefore:String(zoneBefore||'').toUpperCase() }); },
  groupHit(meta={}){ Quests.event('hit',{ result:'good', meta:{...meta, isTarget:true}, comboNow: app.scoreSys.combo|0, score: app.scoreSys.get()|0 }); },
  groupFull(){ Quests.event('group_full',{}); },
  targetCleared(){ Quests.event('target_cleared',{}); },
  targetCycle(){ Quests.event('target_cycle',{}); },
  platePerfect(){ Quests.event('hit',{ result:'perfect', meta:{ isTarget:true }, comboNow: app.scoreSys.combo|0, score: app.scoreSys.get()|0 }); },
  plateOverfill(){ app.runFlags.overfill=(app.runFlags.overfill|0)+1; Progress.notify('plate_overfill'); },
};

async function startGame(){
  if (app.running) return;

  // engine + hud + systems
  if (!app.engine) app.engine = new Engine(null, document.getElementById('c'));
  if (!app.hud)    app.hud = createHUD({
    onHome(){ showMenu(); },
    onReplay(){ startGame(); }
  });
  if (!app.lb)     app.lb = new Leaderboard({ key:'hha_board_v2', maxKeep:500, retentionDays:365 });

  app.power    = new PowerUpSystem();
  app.scoreSys = new ScoreSystem();
  app.scoreSys.setHandlers({
    change: (val)=>{ app.hud.updateScore(val|0, app.scoreSys.combo|0, app.time|0); Quests.event('score_tick', { score: val|0, comboNow: app.scoreSys.combo|0 }); Progress.notify('score_tick',{score:val|0}); }
  });
  app.power.attachToScore(app.scoreSys);

  // reset
  app.time = (window.__HHA_TIME|0) || 45;
  app.bestCombo = 0;
  app.runFlags = { highCount:0, overfill:0 };
  app.scoreSys.reset();
  app.hud.updateScore(0,0,app.time);
  document.getElementById('spawnHost').innerHTML='';

  // reflect selection
  app.modeKey = document.body.getAttribute('data-mode') || app.modeKey;
  app.diff    = document.body.getAttribute('data-diff') || app.diff;

  // bind quests & progress
  Quests.bindToMain({ hud: app.hud });
  Quests.setLang(app.lang);
  Quests.beginRun(app.modeKey, app.diff, app.lang, app.time);
  Progress.init();
  Progress.beginRun(app.modeKey, app.diff, app.lang);

  // coach splash (fallback ใน coach ของโหมด)
  app.hud.setCoach(app.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!');
  setTimeout(()=>app.hud.hideCoach(), 1400);

  // load mode
  try {
    app.modeAPI = await loadMode(app.modeKey);
  } catch(e){
    console.error('[mode] load fail', e); toast(`Failed to load mode: ${app.modeKey}`); return;
  }
  app.sys = app.modeAPI.create
    ? app.modeAPI.create({ engine:app.engine, hud:app.hud, coach:{ say:(t)=>{app.hud.setCoach(t); setTimeout(()=>app.hud.hideCoach(),1200);} } })
    : null;
  app.sys?.start?.();

  hideMenu();
  app.running = true;
  app._secMark = performance.now();
  app.raf = requestAnimationFrame(tick);
}

function tick(now){
  if (!app.running) return;
  const secGone = Math.floor((now - (app._secMark||now))/1000);
  if (secGone >= 1){
    app._secMark = now;
    app.time = Math.max(0, (app.time|0) - secGone);
    app.hud.updateScore(app.scoreSys.get()|0, app.scoreSys.combo|0, app.time|0);
    Quests.tick({ score: app.scoreSys.get()|0 });
    if (app.time<=0){ return endGame(); }
  }
  try { app.sys?.update?.(Math.min(0.05, (now-(app._dt||now))/1000), Bus); app._dt=now; } catch(e){ console.warn('[mode.update]', e); }
  app.raf = requestAnimationFrame(tick);
}

function endGame(){
  if (!app.running) return;
  app.running=false; cancelAnimationFrame(app.raf);
  app.sys?.stop?.();

  const finalScore = app.scoreSys.get()|0;
  const q = Quests.endRun({ score: finalScore, highCount: app.runFlags.highCount|0, overfill: app.runFlags.overfill|0 });
  Progress.endRun({ score: finalScore, bestCombo: app.bestCombo|0, acc: 0 });

  // Leaderboard
  app.lb.submit(app.modeKey, app.diff, finalScore, { name: (document.getElementById('playerName')?.value||'').trim().slice(0,24) });

  // Result
  const t=$('#resultText'); if (t) t.textContent = `คะแนน ${finalScore} • คอมโบสูงสุด x${app.bestCombo|0}`;
  const pb=$('#pbRow'); if (pb){ pb.innerHTML = q.map(m=>`<li>${m.done?'✅':'❌'} ${m.label}</li>`).join(''); }
  $('#result').style.display='flex';
}

function toast(text){
  let el = $('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 1200);
}

(function boot(){
  bindMenu();
  showMenu();
  window.addEventListener('blur', ()=>{ app.running=false; });
  window.addEventListener('focus', ()=>{ if(!$('#menuBar')?.hasAttribute('data-hidden') || $('#result')?.offsetParent) return; app.running=true; app._secMark=performance.now(); app.raf=requestAnimationFrame(tick); });
})();
