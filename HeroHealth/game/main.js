// === Hero Health Academy — game/main.js (2025-10-30)
// Runtime glue (single source): Progress v2.2 + MissionSystem v2.3 + PowerUpSystem v3
// HUD-safe, Mini-quests (chips), PowerBar, Result + Leaderboard, Pause-on-blur

import { Engine }             from './core/engine.js';
import { createHUD }          from './core/hud.js';
import { PowerUpSystem }      from './core/powerup.js';
import { MissionSystem }      from './core/mission-system.js';
import { Progress }           from './core/progression.js';
import { Leaderboard }        from './core/leaderboard.js';
import { add3DTilt, shatter3D } from './core/fx.js';

// Modes
import * as goodjunk  from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

const MODES = { goodjunk, groups, hydration, plate };
const $ = (s)=>document.querySelector(s);
const on = (el,ev,fn)=>el && el.addEventListener(ev,fn);

// ---------------- Globals ----------------
const state = {
  playing:false, modeKey:'goodjunk', diff:'Normal', lang:(document.documentElement.getAttribute('data-hha-lang')||'TH').toUpperCase(),
  time: 45, score:0, combo:0, bestCombo:0, raf:0, lastTs:0, secMark:0,
  engine:null, hud:null, power:null, missions:null, lb:null,
  modeInst:null, // { start, update(dt,bus), stop, cleanup }
  dailyName:'', // player name cached for leaderboard
};

// ---------------- HUD / UI ----------------
const hud = createHUD({
  onHome(){ showMenu(); },
  onReplay(){ startGame(); }
});
state.hud = hud;

// Powerups → power bar DOM
const powerBar = $('#powerBar');
function renderPowerBar(timers){
  if (!powerBar) return;
  const { x2, freeze, sweep, shield, shieldCount } = (timers||{});
  const chip = (icon,label,val,extra='')=>{
    if (!val) return '';
    return `<li class="pchip"><span>${icon}</span><span>${label}</span><i>${val}s</i>${extra?`<em>${extra}</em>`:''}</li>`;
  };
  powerBar.innerHTML = [
    chip('✖️2','x2', x2|0),
    chip('🧊','Freeze', freeze|0),
    chip('🧹','Sweep', sweep|0),
    chip('🛡️','Shield', shield|0, shieldCount?`x${shieldCount|0}`:'')
  ].join('');
}

// ---------------- Engine / FX ----------------
state.engine = new Engine(window.THREE, $('#c'));

// ---------------- Missions ----------------
state.missions = new MissionSystem();

// ---------------- Progress / Leaderboard ----------------
Progress.init();
state.lb = new Leaderboard({ key:'hha_board_v2', maxKeep:500, retentionDays:365 });

// ---------------- Menu wiring ----------------
function wireMenu(){
  const setMode=(k, label)=>{
    state.modeKey=k; document.body.dataset.mode=k;
    const head=$('#modeName'); if(head) head.textContent=label;
    ['m_goodjunk','m_groups','m_hydration','m_plate'].forEach(id=>{ const b=$('#'+id); if(b) b.classList.toggle('active', id==='m_'+k); });
  };
  on($('#m_goodjunk'),'click', ()=>setMode('goodjunk','Good vs Junk'));
  on($('#m_groups'),'click',   ()=>setMode('groups','5 Food Groups'));
  on($('#m_hydration'),'click',()=>setMode('hydration','Hydration'));
  on($('#m_plate'),'click',    ()=>setMode('plate','Healthy Plate'));

  const setDiff=(d)=>{
    state.diff=d; const el=$('#difficulty'); if(el) el.textContent=d;
    ['d_easy','d_normal','d_hard'].forEach(id=>{ const b=$('#'+id); if(b) b.classList.toggle('active', id==='d_'+d.toLowerCase()); });
  };
  on($('#d_easy'),'click',   ()=>setDiff('Easy'));
  on($('#d_normal'),'click', ()=>setDiff('Normal'));
  on($('#d_hard'),'click',   ()=>setDiff('Hard'));

  // Start
  on($('#btn_start'),'click', startGame);

  // Leaderboard scope buttons in Result
  $('#lbScopes')?.addEventListener('click', (e)=>{
    const b = e.target.closest('.chip'); if(!b) return;
    $('#lbScopes .chip.active')?.classList.remove('active'); b.classList.add('active');
    renderLeaderboard(b.dataset.scope || 'month');
  });
  // Save name
  on($('#saveName'), 'click', ()=>{
    const v = String($('#playerName')?.value||'').trim().slice(0,24);
    state.dailyName = v; try{ localStorage.setItem('hha_player_name', v); }catch{}
    renderLeaderboard($('.chip.active')?.dataset.scope || 'month');
  });

  // preload name
  try{ state.dailyName = localStorage.getItem('hha_player_name') || ''; }catch{}
  if ($('#playerName')) $('#playerName').value = state.dailyName || '';
}
wireMenu();

// ---------------- Show/Hide menu ----------------
function showMenu(){ $('#menuBar')?.setAttribute('style','display:block'); $('#hudWrap')?.setAttribute('style','display:none'); state.playing=false; }
function hideMenu(){ $('#menuBar')?.setAttribute('style','display:none'); $('#hudWrap')?.setAttribute('style','display:block'); }

// ---------------- Bus (from modes) ----------------
const Bus = {
  // generic score add (respect power-up boost handled in ScoreSystem if used; here we add raw & decorate UI/FX)
  addScore(n=0, ui){ state.score = (state.score|0) + (n|0); hud.updateScore(state.score, state.combo, state.time); if (ui?.x && ui?.y){ state.engine.fx.popText('+'+n, { x:ui.x, y:ui.y }); } Progress.notify('score_tick', { score: state.score }); },
  // called on good/ok/perfect
  hit({ kind='good', points=10, ui={}, meta={} }={}){
    state.combo = (kind==='bad') ? 0 : (state.combo+1);
    state.bestCombo = Math.max(state.bestCombo|0, state.combo|0);
    hud.updateScore(state.score, state.combo, state.time);
    if (kind==='perfect'){ Progress.notify('perfect'); }
    if (meta?.golden){ Progress.notify('golden'); }
    this.addScore(points|0, ui);
    if (ui?.x && ui?.y){ shatter3D(ui.x, ui.y); }
    // Missions events
    state.missions.onEvent(kind==='perfect' ? 'perfect':'good', {}, runState);
    state.missions.onEvent('combo', { value: state.combo|0 }, runState);
  },
  // called on bad/miss
  miss({ meta={} }={}){
    if (!state.power?.consumeShield?.()){ state.combo = 0; hud.updateScore(state.score, state.combo, state.time); hud.dimPenalty(); }
    state.missions.onEvent('miss', {}, runState);
  },
  // power-ups from modes
  power(kind, sec){ state.power?.apply?.(kind, sec); },
  // hydration reporting
  hydration(zone){ state.missions.onEvent('hydration_zone', { z: String(zone||'') }, runState); if (zone==='high') Progress.notify('hydration_high'); },
  // plate/group specific
  platePerfect(){ state.missions.onEvent('plate_perfect', {}, runState); },
  plateOverfill(){ state.missions.onEvent('over_quota', {}, runState); Progress.notify('plate_overfill'); },
  groupTarget(){ state.missions.onEvent('target_hit', {}, runState); Progress.notify('group_round_done'); },
};

// ---------------- Run lifecycle ----------------
let runState = { lang: state.lang, ctx:{} };

function startGame(){
  hideMenu();

  // reset counters
  state.time = (window.__HHA_TIME|0) || 45;
  state.score=0; state.combo=0; state.bestCombo=0;
  hud.updateScore(0,0,state.time);

  // clear field
  $('#spawnHost').innerHTML = '';

  // power-ups
  state.power = new PowerUpSystem();
  state.power.onChange(renderPowerBar);
  renderPowerBar(state.power.getCombinedTimers());

  // missions set (3 chips)
  const runPlan = state.missions.start(state.modeKey, { seconds: state.time, count: 3, lang: state.lang });
  runState = state.missions.attachToState(runPlan, { lang: state.lang, ctx:{} });
  hud.setQuestChips(runPlan.list.map(m=>({ icon:m.icon, label:state.missions.describe(m, state.lang), need:m.target, progress:0 })));

  // progress begin
  Progress.beginRun(state.modeKey, state.diff, state.lang);

  // boot mode instance
  const Mode = MODES[state.modeKey] || goodjunk;
  state.modeInst = Mode.create
    ? Mode.create({ engine: state.engine, hud, coach: CoachShim })
    : null;
  state.modeInst?.start?.();

  // loop
  state.playing = true; state.lastTs = performance.now(); state.secMark = state.lastTs;
  cancelAnimationFrame(state.raf);
  state.raf = requestAnimationFrame(loop);
}

const CoachShim = {
  onStart(){ /* bubble already shown via HUD in modes if needed */ },
  onGood(){},
  onPerfect(){},
  onBad(){},
  onQuestProgress(desc, prog, need){ $('#coachText') && hud.setCoach(`${desc} — ${prog}/${need}`); setTimeout(()=>hud.hideCoach(), 900); },
  onQuestDone(){ hud.setCoach('Quest ✓'); setTimeout(()=>hud.hideCoach(), 900); },
  onQuestFail(){ hud.setCoach('Quest ✗'); setTimeout(()=>hud.hideCoach(), 900); },
  onTimeLow(){ hud.setCoach(state.lang==='EN'?'10s left — push!':'เหลือ 10 วิ — สู้!'); setTimeout(()=>hud.hideCoach(), 900); }
};

function loop(ts){
  if (!state.playing) return;
  const dt = Math.min(0.05, (ts - state.lastTs)/1000);
  state.lastTs = ts;

  // per-frame update
  try{ state.modeInst?.update?.(dt, Bus); }catch(e){ console.warn('[mode.update]', e); }

  // second tick
  if ((ts - state.secMark) >= 1000){
    const steps = Math.floor((ts - state.secMark)/1000);
    state.secMark += steps*1000;
    for (let i=0;i<steps;i++){
      state.time = Math.max(0, (state.time|0) - 1);
      hud.updateScore(state.score, state.combo, state.time);

      // mission tick + HUD
      const chips = state.missions.tick(runState, { score: state.score }, ({ success, key, index })=>{
        if (success){ Progress.addMissionDone?.(state.modeKey); }
      }, { hud, coach: CoachShim, lang: state.lang });
      if (chips?.length) hud.setQuestChips(chips);

      if (state.time===10) CoachShim.onTimeLow?.();
      if (state.time<=0) { endGame(); return; }
    }
  }
  state.raf = requestAnimationFrame(loop);
}

function endGame(){
  if (!state.playing) return;
  state.playing=false;
  cancelAnimationFrame(state.raf);
  try{ state.modeInst?.stop?.(); state.modeInst?.cleanup?.(); }catch{}

  // finalize progress & leaderboard
  Progress.endRun({ score: state.score|0, bestCombo: state.bestCombo|0, acc: 0 });
  state.lb.submit(state.modeKey, state.diff, state.score|0, { name: (state.dailyName||$('#playerName')?.value||'').trim().slice(0,24) });

  // build result quests list from mission snapshot
  const chips = (runState?.missions||[]).map(m=>({ done:!!m.done && !!m.success, label: state.missions.describe(m, state.lang) }));
  const ul = $('#pbRow'); if (ul) ul.innerHTML = chips.map(c=>`<li>${c.done?'✅':'❌'} ${c.label}</li>`).join('');

  // result text
  $('#resultText').textContent = `คะแนน ${state.score} • คอมโบสูงสุด x${state.bestCombo}`;
  $('#result').style.display='flex';

  // render leaderboard default scope
  renderLeaderboard('month');
}

function renderLeaderboard(scope='month'){
  const tableHost = $('#lbTable'); const info = $('#lbInfo');
  if (!tableHost) return;
  state.lb.renderInto(tableHost, { scope });
  if (info) info.textContent = state.lb.getInfo(scope).text + (state.dailyName?` • Player: ${state.dailyName}`:'');
}

// ---------------- Pause on blur ----------------
window.addEventListener('blur', ()=>{ if(state.playing){ state.playing=false; }}, { passive:true });
window.addEventListener('focus', ()=>{ if(!$('#menuBar')?.offsetParent && !$('#result')?.offsetParent){ state.playing=true; state.lastTs=performance.now(); state.secMark=state.lastTs; state.raf=requestAnimationFrame(loop);} }, { passive:true });

// ---------------- Boot ----------------
showMenu();

// Accessibility: canvas should never block UI clicks
setTimeout(()=>{ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } }, 0);

// Convenience: Enter/Space to start when menu visible
window.addEventListener('keydown', (e)=>{
  if ((e.key==='Enter'||e.key===' ') && $('#menuBar')?.offsetParent){ e.preventDefault(); startGame(); }
}, { passive:false });

// Optional: tilt on Start button & menu tiles for “3D feel”
[ '#btn_start','#m_goodjunk','#m_groups','#m_hydration','#m_plate' ].forEach(sel=>{
  const el = $(sel); if (el) add3DTilt(el);
});
