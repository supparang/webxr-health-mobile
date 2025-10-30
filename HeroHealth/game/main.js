// === Hero Health Academy — game/main.js (2025-10-30)
// Glue with Quests v2 + Progress v2.2 + PowerUp v3 + Leaderboard + Engine/FX

import { Engine }               from './core/engine.js';
import { createHUD }            from './core/hud.js';
import { PowerUpSystem }        from './core/powerup.js';
import { Progress }             from './core/progression.js';
import { Leaderboard }          from './core/leaderboard.js';
import { Quests }               from './core/quests.js';
import { add3DTilt, shatter3D } from './core/fx.js';

// Modes
import * as goodjunk  from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

const MODES = { goodjunk, groups, hydration, plate };
const $ = (s)=>document.querySelector(s);
const on = (el,ev,fn)=>el && el.addEventListener(ev,fn);

const app = {
  playing:false,
  modeKey:'goodjunk',
  diff:'Normal',
  lang:(document.documentElement.getAttribute('data-hha-lang')||'TH').toUpperCase(),
  time:45, score:0, combo:0, bestCombo:0,
  raf:0, lastTs:0, secMark:0,
  engine:null, hud:null, power:null, lb:null, modeInst:null,
  // flags for Quests.endRun payload
  runFlags:{ highCount:0, overfill:0 },
  playerName:''
};

// ---------------- HUD / UI ----------------
app.hud = createHUD({
  onHome(){ showMenu(); },
  onReplay(){ startGame(); }
});

// Power bar render
const powerBar = $('#powerBar');
function renderPowerBar(timers){
  if (!powerBar) return;
  const { x2=0, freeze=0, sweep=0, shield=0, shieldCount=0 } = timers||{};
  const chip = (icon,lbl,val,extra='')=> val?`<li class="pchip"><span>${icon}</span><span>${lbl}</span><i>${val}s</i>${extra?`<em>${extra}</em>`:''}</li>`:'';
  powerBar.innerHTML = [
    chip('✖️2','x2',x2),
    chip('🧊','Freeze',freeze),
    chip('🧹','Sweep',sweep),
    chip('🛡️','Shield',shield, shieldCount?`x${shieldCount}`:'')
  ].join('');
}

// ---------------- Engine ----------------
app.engine = new Engine(window.THREE, $('#c'));

// ---------------- Progress / Leaderboard ----------------
Progress.init();
app.lb = new Leaderboard({ key:'hha_board_v2', maxKeep:500, retentionDays:365 });

// ---------------- Menu wiring ----------------
function wireMenu(){
  const setMode=(k, label)=>{
    app.modeKey=k; document.body.dataset.mode=k;
    const head=$('#modeName'); if(head) head.textContent=label;
    ['m_goodjunk','m_groups','m_hydration','m_plate'].forEach(id=>{
      const b=$('#'+id); if(b) b.classList.toggle('active', id==='m_'+k);
    });
  };
  on($('#m_goodjunk'),'click', ()=>setMode('goodjunk','Good vs Junk'));
  on($('#m_groups'),'click',   ()=>setMode('groups','5 Food Groups'));
  on($('#m_hydration'),'click',()=>setMode('hydration','Hydration'));
  on($('#m_plate'),'click',    ()=>setMode('plate','Healthy Plate'));

  const setDiff=(d)=>{
    app.diff=d; const el=$('#difficulty'); if(el) el.textContent=d;
    ['d_easy','d_normal','d_hard'].forEach(id=>{
      const b=$('#'+id); if(b) b.classList.toggle('active', id==='d_'+d.toLowerCase());
    });
  };
  on($('#d_easy'),'click',   ()=>setDiff('Easy'));
  on($('#d_normal'),'click', ()=>setDiff('Normal'));
  on($('#d_hard'),'click',   ()=>setDiff('Hard'));

  // Start
  on($('#btn_start'),'click', startGame);

  // Leaderboard scope
  $('#lbScopes')?.addEventListener('click',(e)=>{
    const b=e.target.closest('.chip'); if(!b) return;
    $('#lbScopes .chip.active')?.classList.remove('active'); b.classList.add('active');
    renderLeaderboard(b.dataset.scope||'month');
  });

  // Save name
  on($('#saveName'),'click',()=>{
    const v=String($('#playerName')?.value||'').trim().slice(0,24);
    app.playerName=v; try{ localStorage.setItem('hha_player_name', v); }catch{}
    renderLeaderboard($('.chip.active')?.dataset.scope||'month');
  });

  try{ app.playerName = localStorage.getItem('hha_player_name') || ''; }catch{}
  if ($('#playerName')) $('#playerName').value = app.playerName || '';
}
wireMenu();

function showMenu(){ $('#menuBar')?.setAttribute('style','display:block'); $('#hudWrap')?.setAttribute('style','display:none'); app.playing=false; }
function hideMenu(){ $('#menuBar')?.setAttribute('style','display:none'); $('#hudWrap')?.setAttribute('style','display:block'); }

// ---------------- Quests bind ----------------
Quests.bindToMain({ hud: app.hud });
Quests.setLang(app.lang);

// ---------------- Event Bus (modes → main) ----------------
const Bus = {
  addScore(n=0, ui){
    app.score = (app.score|0) + (n|0);
    app.hud.updateScore(app.score, app.combo, app.time);
    if (ui?.x && ui?.y){ app.engine.fx.popText('+'+n, { x:ui.x, y:ui.y }); }
    Progress.notify('score_tick', { score: app.score });
    Quests.event('score_tick', { score: app.score });
  },
  hit({ kind='good', points=10, ui={}, meta={} }={}){
    app.combo = (kind==='bad') ? 0 : (app.combo+1);
    app.bestCombo = Math.max(app.bestCombo|0, app.combo|0);
    app.hud.updateScore(app.score, app.combo, app.time);

    if (kind==='perfect'){ Progress.notify('perfect'); }
    if (meta?.golden){ Progress.notify('golden'); }

    this.addScore(points|0, ui);
    if (ui?.x && ui?.y){ shatter3D(ui.x, ui.y); }

    // feed Quests v2
    Quests.event('hit', { result: kind, meta, comboNow: app.combo|0, score: app.score|0 });
  },
  miss({ meta={} }={}){
    if (!app.power?.consumeShield?.()){ app.combo=0; app.hud.updateScore(app.score, app.combo, app.time); app.hud.dimPenalty(); }
    Quests.event('hit', { result:'bad', meta, comboNow:0, score: app.score|0 });
  },
  power(kind, sec){ app.power?.apply?.(kind, sec); },
  // Hydration hooks (zones: 'OK'|'LOW'|'HIGH')
  hydrationTick(zone){
    Quests.event('hydro_tick', { zone:String(zone||'').toUpperCase() });
    if (String(zone).toUpperCase()==='HIGH'){ app.runFlags.highCount = (app.runFlags.highCount|0)+1; Progress.notify('hydration_high'); }
  },
  hydrationCross(from,to){ Quests.event('hydro_cross', { from:String(from||'').toUpperCase(), to:String(to||'').toUpperCase() }); },
  hydrationClick(kind, zoneBefore){ Quests.event('hydro_click', { kind, zoneBefore:String(zoneBefore||'').toUpperCase() }); },

  // Plate / Groups specifics
  groupHit(meta={}){ Quests.event('hit', { result:'good', meta:{ ...meta, isTarget:true } }); },
  groupFull(){ Quests.event('group_full', {}); },
  targetCleared(){ Quests.event('target_cleared', {}); },
  targetCycle(){ Quests.event('target_cycle', {}); },

  platePerfect(){ Quests.event('hit', { result:'perfect', meta:{ isTarget:true } }); },
  plateOverfill(){ app.runFlags.overfill = (app.runFlags.overfill|0)+1; Progress.notify('plate_overfill'); },
};

// ---------------- Run lifecycle ----------------
function startGame(){
  hideMenu();

  // reset
  app.time = (window.__HHA_TIME|0) || 45;
  app.score=0; app.combo=0; app.bestCombo=0;
  app.runFlags = { highCount:0, overfill:0 };
  app.hud.updateScore(0,0,app.time);
  $('#spawnHost').innerHTML='';

  // systems
  app.power = new PowerUpSystem();
  app.power.onChange(renderPowerBar);
  renderPowerBar(app.power.getCombinedTimers());

  // progress
  Progress.beginRun(app.modeKey, app.diff, app.lang);

  // quests (v2)
  Quests.setLang(app.lang);
  Quests.beginRun(app.modeKey, app.diff, app.lang, app.time);

  // boot mode
  const Mode = MODES[app.modeKey] || goodjunk;
  app.modeInst = Mode.create ? Mode.create({ engine: app.engine, hud: app.hud, coach: CoachShim }) : null;
  app.modeInst?.start?.();

  // loop
  app.playing=true; app.lastTs=performance.now(); app.secMark=app.lastTs;
  cancelAnimationFrame(app.raf);
  app.raf = requestAnimationFrame(loop);
}

const CoachShim = {
  onStart(){},
  onGood(){},
  onPerfect(){},
  onBad(){},
  onQuestProgress(desc, prog, need){ /* optional voice */ },
  onQuestDone(){},
  onQuestFail(){},
  onTimeLow(){ app.hud.setCoach(app.lang==='EN'?'10s left — push!':'เหลือ 10 วิ — สู้!'); setTimeout(()=>app.hud.hideCoach(), 900); }
};

function loop(ts){
  if (!app.playing) return;
  const dt = Math.min(0.05, (ts - app.lastTs)/1000);
  app.lastTs = ts;

  try{ app.modeInst?.update?.(dt, Bus); }catch(e){ console.warn('[mode.update]', e); }

  if ((ts - app.secMark) >= 1000){
    const steps = Math.floor((ts - app.secMark)/1000);
    app.secMark += steps*1000;
    for (let i=0;i<steps;i++){
      app.time = Math.max(0, (app.time|0) - 1);
      app.hud.updateScore(app.score, app.combo, app.time);

      // Quests per-second tick
      Quests.tick({ score: app.score|0 });

      if (app.time===10) CoachShim.onTimeLow?.();
      if (app.time<=0){ endGame(); return; }
    }
  }
  app.raf = requestAnimationFrame(loop);
}

function endGame(){
  if (!app.playing) return;
  app.playing=false;
  cancelAnimationFrame(app.raf);
  try{ app.modeInst?.stop?.(); app.modeInst?.cleanup?.(); }catch{}

  // finalize progress
  Progress.endRun({ score: app.score|0, bestCombo: app.bestCombo|0, acc: 0 });

  // Quests summary (feed flags to close out “no_over/high” type)
  const qSummary = Quests.endRun({ score: app.score|0, highCount: app.runFlags.highCount|0, overfill: app.runFlags.overfill|0 });

  // leaderboard
  app.lb.submit(app.modeKey, app.diff, app.score|0, { name: (app.playerName||$('#playerName')?.value||'').trim().slice(0,24) });

  // Result panel
  $('#resultText').textContent = `คะแนน ${app.score} • คอมโบสูงสุด x${app.bestCombo}`;
  const ul = $('#pbRow');
  if (ul){
    ul.innerHTML = (qSummary||[]).map(q => `<li>${q.done && !q.fail ? '✅' : '❌'} ${q.label}</li>`).join('');
  }
  $('#result').style.display='flex';

  renderLeaderboard('month');
}

function renderLeaderboard(scope='month'){
  const host = $('#lbTable'); const info=$('#lbInfo');
  if (!host) return;
  app.lb.renderInto(host, { scope });
  if (info) info.textContent = app.lb.getInfo(scope).text + (app.playerName?` • Player: ${app.playerName}`:'');
}

// ---------------- Pause on blur/focus ----------------
window.addEventListener('blur', ()=>{ if(app.playing){ app.playing=false; }}, { passive:true });
window.addEventListener('focus', ()=>{
  const menuShown = !!$('#menuBar')?.offsetParent;
  const resultShown = !!$('#result')?.offsetParent;
  if (!menuShown && !resultShown){
    app.playing=true; app.lastTs=performance.now(); app.secMark=app.lastTs;
    app.raf=requestAnimationFrame(loop);
  }
}, { passive:true });

// ---------------- Boot ----------------
showMenu();
setTimeout(()=>{ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } }, 0);

// Keyboard quick start
window.addEventListener('keydown',(e)=>{
  if ((e.key==='Enter'||e.key===' ') && $('#menuBar')?.offsetParent){ e.preventDefault(); startGame(); }
},{ passive:false });

// Small 3D tilt on key UI
['#btn_start','#m_goodjunk','#m_groups','#m_hydration','#m_plate'].forEach(sel=>{
  const el=$(sel); if (el) add3DTilt(el);
});
