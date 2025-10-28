// === Hero Health Academy — main.js (VR + Gaze + Quests + HUD + Daily/Stats) ===
window.__HHA_BOOT_OK = true;

// ----- Imports -----
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine }         from '/webxr-health-mobile/HeroHealth/game/core/engine.js';
import { HUD }            from '/webxr-health-mobile/HeroHealth/game/core/hud.js';
import { Coach }          from '/webxr-health-mobile/HeroHealth/game/core/coach.js';
import { SFX }            from '/webxr-health-mobile/HeroHealth/game/core/sfx.js';
import { ScoreSystem }    from '/webxr-health-mobile/HeroHealth/game/core/score.js';
import { PowerUpSystem }  from '/webxr-health-mobile/HeroHealth/game/core/powerup.js';
import { Progress }       from '/webxr-health-mobile/HeroHealth/game/core/progression.js';
import { Quests }         from '/webxr-health-mobile/HeroHealth/game/core/quests.js';
import { add3DTilt, shatter3D } from '/webxr-health-mobile/HeroHealth/game/core/fx.js';
import { VRInput }        from '/webxr-health-mobile/HeroHealth/game/core/vrinput.js';

import * as goodjunk      from '/webxr-health-mobile/HeroHealth/game/modes/goodjunk.js';
import * as groups        from '/webxr-health-mobile/HeroHealth/game/modes/groups.js';
import * as hydration     from '/webxr-health-mobile/HeroHealth/game/modes/hydration.js';
import * as plate         from '/webxr-health-mobile/HeroHealth/game/modes/plate.js';

// ----- Helpers -----
const $  = (s)=>document.querySelector(s);
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

// ----- Config -----
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time: 70, spawn: 900, life: 4200 },
  Normal: { time: 60, spawn: 700, life: 3000 },
  Hard:   { time: 50, spawn: 550, life: 1800 }
};
const ICON_SIZE_MAP = { Easy:92, Normal:72, Hard:58 };
const MAX_ITEMS = 10;
const LIVE = new Set();

const I18N = {
  TH:{ names:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
       diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'} },
  EN:{ names:{goodjunk:'Good vs Junk', groups:'Food Group Frenzy', hydration:'Hydration', plate:'Healthy Plate'},
       diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'} }
};
const T = (lang)=>I18N[lang]||I18N.TH;

// ----- Systems & State -----
const hud   = new HUD();
const sfx   = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
const eng   = new Engine(THREE, document.getElementById('c'));
const coach = new Coach({ lang: localStorage.getItem('hha_lang') || 'TH' });
VRInput.init({ engine: eng, sfx });

// bind quests HUD/coach (quest chips & timers)
try { (window.HHA_QUESTS_BIND ||= Quests.bindToMain({ hud, coach })).refresh(); } catch {}

const state = {
  modeKey:'goodjunk', difficulty:'Normal',
  running:false, paused:false, timeLeft:60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx:  localStorage.getItem('hha_gfx')  || 'quality',
  haptic: (localStorage.getItem('hha_haptic') ?? '1') === '1',
  combo:0, bestCombo:0,
  fever:{ active:false, meter:0, drainPerSec:14, chargeGood:10, chargePerfect:20, threshold:100, mul:2, timeLeft:0 },
  spawnTimer:0, tickTimer:0, ctx:{}, stats:{good:0,perfect:0,ok:0,bad:0}, _accHist:[], freezeUntil:0, didWarnT10:false
};

// ----- UI text -----
function applyUI(){
  const L = T(state.lang);
  setText('#modeName',   L.names[state.modeKey]||state.modeKey);
  setText('#difficulty', L.diffs[state.difficulty]||state.difficulty);
  document.documentElement.setAttribute('data-hha-mode', state.modeKey);
}
function updateHUD(){
  hud.setScore?.(score.score);
  hud.setTime?.(state.timeLeft|0);
  hud.setCombo?.('x'+state.combo);
}

// Fever
function setFeverBar(pct){ const bar=$('#feverBar'); if(!bar) return; bar.style.width=Math.max(0,Math.min(100,pct|0))+'%'; }
function showFeverLabel(show){ const f=$('#fever'); if(!f) return; f.style.display=show?'block':'none'; f.classList.toggle('pulse',!!show); }
function startFever(){ if(state.fever.active) return; state.fever.active=true; state.fever.timeLeft=7; showFeverLabel(true); coach.onFever?.(); Progress.event('fever',{kind:'start'}); Quests.event('fever',{kind:'start'}); try{$('#sfx-powerup')?.play();}catch{} }
function stopFever(){ if(!state.fever.active) return; state.fever.active=false; state.fever.timeLeft=0; showFeverLabel(false); coach.onFeverEnd?.(); Progress.event('fever',{kind:'end'}); Quests.event('fever',{kind:'end'}); }

// Score FX
function makeScoreBurst(x,y,text,minor,color){
  const el=document.createElement('div');
  el.className='scoreBurst';
  el.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);font:900 20px/1.2 ui-rounded,system-ui;color:${color||'#7fffd4'};text-shadow:0 2px 6px #000c;z-index:120;pointer-events:none;opacity:0;translate:0 6px;transition:opacity .22s, translate .22s;`;
  el.textContent=text;
  if(minor){ const m=document.createElement('div'); m.style.cssText='font:700 12px/1.2 ui-rounded,system-ui;opacity:.9'; m.textContent=minor; el.appendChild(m); }
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.translate='0 0'; });
  setTimeout(()=>{ el.style.opacity='0'; el.style.translate='0 -8px'; setTimeout(()=>{ try{el.remove();}catch{} },220); },720);
}
function scoreWithEffects(base,x,y){
  const comboMul = state.combo>=20?1.4:(state.combo>=10?1.2:1.0);
  const feverMul = state.fever.active?state.fever.mul:1.0;
  const total = Math.round(base * comboMul * feverMul);
  score.add?.(total);
  const tag = total>=0?('+'+total):(''+total);
  const minor = (comboMul>1||feverMul>1) ? ('x'+comboMul.toFixed(1)+(feverMul>1?' & FEVER':'')) : '';
  const color = total>=0? (feverMul>1?'#ffd54a':'#7fffd4') : '#ff9b9b';
  makeScoreBurst(x,y,tag,minor,color);
}

// Bounds & positions
function safeBounds(){
  const headerH = $('header.brand')?.offsetHeight || 56;
  const menuH   = $('#menuBar')?.offsetHeight || 120;
  const yMin = headerH + 60;
  const yMax = Math.max(yMin+50, innerHeight - menuH - 80);
  const xMin = 20;
  const xMax = Math.max(xMin+50, innerWidth - 80);
  return {xMin,xMax,yMin,yMax};
}
function randPos(){ const {xMin,xMax,yMin,yMax} = safeBounds(); return { left: xMin + Math.random()*(xMax-xMin), top: yMin + Math.random()*(yMax-yMin) }; }
function overlapped(x,y){ for (const n of LIVE){ const r=n.getBoundingClientRect(); const dx=(r.left+r.width/2)-x; const dy=(r.top+r.height/2)-y; if(Math.hypot(dx,dy)<64) return true; } return false; }

// Spawn one icon
function spawnOnce(diff){
  if (!state.running || state.paused) return;
  const nowMs = performance?.now?.()||Date.now();
  if (state.freezeUntil && nowMs < state.freezeUntil){ state.spawnTimer=setTimeout(()=>spawnOnce(diff),120); return; }
  if (LIVE.size >= MAX_ITEMS){ state.spawnTimer=setTimeout(()=>spawnOnce(diff),180); return; }

  const mode = MODES[state.modeKey];
  const meta = mode?.pickMeta?.(diff, state) || {};

  const el = document.createElement('button');
  el.className='item'; el.type='button';
  el.textContent = meta.char || '❓';
  el.setAttribute('aria-label', meta.aria || meta.label || meta.id || 'item');
  el.setAttribute('tabindex', '0'); // keyboard/gaze friendly
  el.dataset.role = 'icon';
  const px = ICON_SIZE_MAP[state.difficulty] || 72;
  el.style.cssText = `position:fixed;border:none;background:transparent;color:#fff;cursor:pointer;z-index:80;line-height:1;transition:transform .15s, filter .15s, opacity .15s;padding:8px;border-radius:14px;font-size:${px}px;transform:perspective(600px) rotateX(0) rotateY(0);`;

  // FX + Gaze
  if (mode?.fx?.onSpawn) { try{ mode.fx.onSpawn(el, state); }catch{}; } else { add3DTilt(el); }
  try { VRInput.attachGaze?.(el); VRInput.bind?.(el); } catch {}

  // position
  let pos = randPos(), tries=0;
  while (tries++<12 && overlapped(pos.left,pos.top)) pos = randPos();
  el.style.left = pos.left+'px'; el.style.top = pos.top +'px';

  // click/activate
  const activate = ()=>{
    try{
      const sys = { score, sfx, power, coach, fx: eng?.fx };
      const res = mode?.onHit?.(meta, sys, state, hud) || (meta.good?'good':'ok');

      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;

      state.stats[res] = (state.stats[res]||0)+1;
      if (res==='good' || res==='perfect') addCombo(res);
      if (res==='bad') addCombo('bad');

      const base = ({good:10, perfect:20, ok:2, bad:-8, power:5})[res] || 1;
      scoreWithEffects(base, cx, cy);

      if (mode?.fx?.onHit) { try{ mode.fx.onHit(cx, cy, meta, state); }catch{}; } else { shatter3D(cx, cy); }

      const qMeta = { good: !!meta.good, groupId: meta.groupId, golden: !!meta.golden, isGood: !!meta.isGood, isTarget: !!meta.isTarget };
      const hitPayload = { mode: state.modeKey, result: res, meta: qMeta, comboNow: state.combo, _ctx:{score:score.score} };
      Progress.event('hit', hitPayload);
      Quests.event('hit', hitPayload);

      if (state.haptic && navigator.vibrate){
        if (res==='bad') navigator.vibrate(60);
        else if (res==='perfect') navigator.vibrate([12,30,12]);
        else if (res==='good') navigator.vibrate(12);
      }
    }catch(e){ console.error('[HHA] onHit error:', e);
    }finally{ setTimeout(()=>{ try{ LIVE.delete(el); el.remove(); }catch{} }, 50); }
  };

  el.addEventListener('click', (ev)=>{ ev.stopPropagation(); activate(); }, {passive:true});
  el.addEventListener('keydown', (ev)=>{ if(ev.code==='Enter'||ev.code==='Space'){ ev.preventDefault(); activate(); } });

  document.body.appendChild(el); LIVE.add(el);
  const ttl = (typeof meta.life === 'number') ? meta.life : (typeof diff.life === 'number') ? diff.life : 3000;
  setTimeout(()=>{ try{ LIVE.delete(el); el.remove(); }catch{} }, ttl);
}

function spawnLoop(){
  if (!state.running || state.paused) return;
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  const total = state.stats.good + state.stats.perfect + state.stats.ok + state.stats.bad;
  const accNow = total>0 ? (state.stats.good + state.stats.perfect)/total : 1;
  state._accHist.push(accNow); if (state._accHist.length>8) state._accHist.shift();
  const acc = state._accHist.reduce((s,x)=>s+x,0)/state._accHist.length;
  const speedUp = acc > 0.85 ? 0.90 : acc < 0.60 ? 1.12 : 1.00;
  const dyn = { time: diff.time, spawn: Math.max(260, Math.round((diff.spawn||700) * speedUp)), life: Math.max(800, Math.round((diff.life||3000) / speedUp)) };
  spawnOnce(dyn);
  const next = Math.max(220, dyn.spawn);
  state.spawnTimer = setTimeout(spawnLoop, next);
}

// Combo
function addCombo(kind){
  if (kind==='bad'){ state.combo=0; hud.setCombo?.('x0'); coach.onBad?.(); return; }
  if (kind==='good' || kind==='perfect'){
    state.combo++; state.bestCombo=Math.max(state.bestCombo,state.combo); hud.setCombo?.('x'+state.combo);
    if (kind==='perfect') coach.onPerfect?.(); else coach.onGood?.();
    if (!state.fever.active){
      const gain=(kind==='perfect')?state.fever.chargePerfect:state.fever.chargeGood;
      state.fever.meter = Math.min(100, state.fever.meter + gain); setFeverBar(state.fever.meter);
      if (state.fever.meter >= state.fever.threshold) startFever();
    }else{ state.fever.timeLeft = Math.min(10, state.fever.timeLeft + 0.6); }
    coach.onCombo?.(state.combo);
  }
}

// Tick
function tick(){
  if (!state.running || state.paused) return;
  if (state.fever.active){
    state.fever.timeLeft = Math.max(0, state.fever.timeLeft - 1);
    state.fever.meter = Math.max(0, state.fever.meter - state.fever.drainPerSec);
    setFeverBar(state.fever.meter);
    if (state.fever.timeLeft<=0 || state.fever.meter<=0) stopFever();
  }

  try{ MODES[state.modeKey]?.tick?.(state, {score,sfx,power,coach,fx:eng?.fx}, hud); }catch{}
  Quests.tick({ score: score.score });

  // HUD: power timers
  hud.setPowerTimers?.(power.timers||{});

  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateHUD();

  if (state.timeLeft===10 && !state.didWarnT10){ state.didWarnT10=true; coach.onTimeLow?.(); try{ $('#sfx-tick')?.play(); }catch{} }
  if (state.timeLeft<=0){ end(); return; }

  state.tickTimer = setTimeout(tick, 1000);
}

// Countdown
async function runCountdown(sec=3){
  // guard: one overlay per start
  let ov = document.getElementById('cdOverlay');
  if (!ov){
    ov = document.createElement('div');
    ov.id='cdOverlay';
    ov.style.cssText='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:150;pointer-events:none;';
    const b = document.createElement('div'); b.id='cdNum';
    b.style.cssText='font:900 72px/1 ui-rounded,system-ui;color:#fff;text-shadow:0 2px 14px #000c;';
    ov.appendChild(b); document.body.appendChild(ov);
  }
  const b = $('#cdNum');
  for (let n=sec;n>0;n--){ b.textContent = String(n); coach.onCountdown?.(n); await new Promise(r=>setTimeout(r, 1000)); }
  b.textContent='Go!'; await new Promise(r=>setTimeout(r, 500));
  try{ ov.remove(); }catch{}
}

// Result modal (reusable)
function showResultModal(total, accPct, grade){
  let modal = document.getElementById('result');
  if (!modal){
    modal = document.createElement('div');
    modal.id='result'; modal.className='modal';
    modal.innerHTML = `<div class="card">
      <h3 id="h_summary">สรุปผล</h3>
      <div id="resCore"></div>
      <div id="resBreakdown"></div>
      <div id="resBoard"></div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn" data-result="replay" id="btn_replay">↻ เล่นอีกครั้ง</button>
        <button class="btn" data-result="home"   id="btn_home">🏠 หน้าหลัก</button>
        <button class="btn" data-action="help">❓ วิธีเล่น</button>
        <button class="btn" data-action="helpScene">📚 คู่มือรวม</button>
        <button class="btn" data-action="statOpen">📊 สถิติ</button>
        <button class="btn" data-action="dailyOpen">🗓️ รายวัน</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  const core = `
    <div style="font:900 32px/1.2 ui-rounded;text-shadow:0 2px 6px #000a;color:#7fffd4">${total} คะแนน</div>
    <div style="font:700 16px;opacity:.85;margin-top:6px">แม่นยำ ${accPct.toFixed(1)}% • คอมโบสูงสุด x${state.bestCombo}</div>`;
  const br = `
    <div style="margin-top:12px;text-align:left;font-weight:700">
      ✅ ดี: ${state.stats.good}<br/>
      🌟 เพอร์เฟกต์: ${state.stats.perfect}<br/>
      😐 ปกติ: ${state.stats.ok}<br/>
      ❌ พลาด: ${state.stats.bad}
    </div>`;
  const bd = `<div style="margin-top:8px;font-weight:800">ระดับ: ${grade} (${state.difficulty})</div>`;
  document.getElementById('resCore').innerHTML = core;
  document.getElementById('resBreakdown').innerHTML = br;
  document.getElementById('resBoard').innerHTML = bd;
  openModal('#result');
}

// Start / End
async function start(){
  end(true); // clean slate
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;
  await runCountdown(3);

  state.running=true; state.paused=false; state.timeLeft = diff.time;
  state.combo=0; state.bestCombo=0; state.stats={good:0,perfect:0,ok:0,bad:0};
  state._accHist=[]; state.freezeUntil=0; state.didWarnT10=false;
  state.fever.meter=0; setFeverBar(0); stopFever();
  score.reset?.(); updateHUD();

  try{ MODES[state.modeKey]?.init?.(state, hud, diff); }catch(e){ console.error('[HHA] init:', e); }
  coach.onStart?.(state.modeKey);

  // begin missions & mini-quests (quests.js will pick 3 from its 10-pool)
  try{
    Progress.beginRun(state.modeKey, state.difficulty, state.lang);
    Quests.beginRun(state.modeKey, state.difficulty, state.lang, Math.min(45, state.timeLeft|0));
    renderMissions(Progress.runCtx?.missions||[]);
  }catch(e){ console.warn('[HHA] quests/progress begin:', e); }

  tick(); spawnLoop();
}

function end(silent=false){
  clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  const wasRunning = state.running;
  state.running=false; state.paused=false;

  try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}
  for (const n of Array.from(LIVE)){ try{ n.remove(); }catch{} LIVE.delete(n); }

  const total = score.score|0;
  const cnt = state.stats.good + state.stats.perfect + state.stats.ok + state.stats.bad;
  const accPct = cnt>0 ? ((state.stats.good + state.stats.perfect)/cnt*100) : 0;
  const grade = total>=500?'S': total>=400?'A+': total>=320?'A': total>=240?'B':'C';
  const timePlayed = (DIFFS[state.difficulty]?.time||60) - state.timeLeft;

  try{ Quests.endRun({ score: total, overfill: state.ctx?.overfillCount|0, highCount: state.ctx?.highCount|0 }); }catch{}
  try{ Progress.endRun({ score: total, bestCombo: state.bestCombo|0, timePlayed, acc: +accPct.toFixed(1) }); }catch{}

  if (!silent && wasRunning){ showResultModal(total, accPct, grade); try{ sfx.play('sfx-good'); }catch{} }
}

// ----- Missions HUD -----
function renderMissions(list){
  const host = document.getElementById('questChips'); if (!host) return;
  host.innerHTML = '';
  if (!list || !list.length) return;
  for (const m of list){
    const chip = document.createElement('div');
    chip.className = 'questChip' + ((m.done && (m.progress||0) >= (m.need||1)) ? ' done' : '');
    chip.dataset.qid = m.id || m.key || '';
    const pct = Math.min(100, ((m.progress||0)/(m.need||1))*100);
    chip.innerHTML = `
      <span class="qLabel">${m.label || m.key || '—'}</span>
      <span class="qProg">${Math.min(m.progress||0, m.need||1)}/${m.need||1}</span>
      <div class="qBar"><i style="width:${pct}%"></i></div>`;
    host.appendChild(chip);
  }
  if (!renderMissions._subscribed){
    Progress.on((type)=>{
      if (type==='mission_done' || type==='run_start' || type==='tick'){ 
        renderMissions(Progress.runCtx?.missions||[]); 
      }
    });
    renderMissions._subscribed = true;
  }
}

// ----- Help text -----
const HELP_TEXT = {
  TH:{
    goodjunk: "🥗 ดี vs ขยะ\n- แตะเก็บอาหารดี หลีกเลี่ยงอาหารขยะ\n- ทำคอมโบต่อเนื่องเพื่อเปิด FEVER\n- Power-ups ช่วย: ×2 คะแนน / Freeze / Magnet",
    groups:   "🍽️ จาน 5 หมู่\n- เลือกให้ตรงหมวดเป้าหมายตามโควตา\n- ครบแล้วจะเปลี่ยนหมวดอัตโนมัติ\n- Power-ups: ×2 เฉพาะหมวด, Freeze, Magnet",
    hydration:"💧 สมดุลน้ำ\n- รักษาบาร์ให้อยู่โซนพอดี (สีเขียว)\n- น้ำเปล่าเพิ่ม, น้ำหวานลด (ตามบริบท)\n- มี Mini-quests 10 แบบ สุ่ม 3 ต่อเกม",
    plate:    "🍱 จัดจานสุขภาพ\n- แตะรับชิ้นที่ตรงกับโควตาของแต่ละหมวดได้ทันที (ไม่ต้องไล่ทีละหมวด)\n- เกินโควตามีโทษ คะแนนลบ + เอฟเฟกต์เตือน"
  },
  EN:{
    goodjunk: "🥗 Good vs Junk\n- Tap healthy items, avoid junk\n- Keep combo to trigger FEVER\n- Power-ups: ×2 / Freeze / Magnet",
    groups:   "🍽️ Food Group Frenzy\n- Hit items of the target group until its quota is met\n- Target auto-rotates when complete\n- Power-ups: ×2 target-only, Freeze, Magnet",
    hydration:"💧 Hydration\n- Keep level in the green zone\n- Water raises, sweet lowers (contextual)\n- 10 mini-quests pool, 3 random each run",
    plate:    "🍱 Healthy Plate\n- Accept any item that matches remaining quota of its group\n- Overfill triggers penalty and warning"
  }
};
function openHelpCurrent(){
  const lang = (localStorage.getItem('hha_lang')||'TH');
  const key  = state.modeKey;
  const txt  = (HELP_TEXT[lang] && HELP_TEXT[lang][key]) || '—';
  const b = document.getElementById('helpBody'); if (b){ b.textContent = txt; }
  openModal('#help');
}
function openHelpAll(){
  const lang = (localStorage.getItem('hha_lang')||'TH');
  const data = HELP_TEXT[lang] || HELP_TEXT.TH;
  const host = document.getElementById('helpAllBody');
  if (host){
    host.innerHTML = '';
    for (const k of ['goodjunk','groups','hydration','plate']){
      const wrap = document.createElement('div');
      wrap.style.marginBottom='14px';
      const h = document.createElement('div');
      h.style.cssText='font-weight:900;margin-bottom:4px';
      h.textContent = (T(lang).names[k]||k);
      const p = document.createElement('pre');
      p.textContent = data[k];
      wrap.appendChild(h); wrap.appendChild(p);
      host.appendChild(wrap);
    }
  }
  openModal('#helpScene');
}

// ----- Stats & Daily (fallback ready) -----
function buildStatSnapshotFallback(){
  const p = Progress.profile || {};
  const rows = [];
  const modes = p.modes || {};
  for (const k of Object.keys(modes)){
    const v = modes[k] || {};
    rows.push({
      key:k,
      bestScore: v.bestScore||0,
      acc: +(v.accAvg||0).toFixed(1),
      runs: v.games||0,
      missions: v.missionDone||0
    });
  }
  return {
    level: p.level||1,
    xp: p.xp||0,
    totalRuns: p.meta?.totalRuns||0,
    bestCombo: p.meta?.bestCombo||0,
    rows
  };
}
function openStatBoard(){
  const host = document.getElementById('statBoardBody'); if(!host) return;
  const snap = (typeof Progress.getStatSnapshot==='function')
    ? (Progress.getStatSnapshot() || buildStatSnapshotFallback())
    : buildStatSnapshotFallback();
  const rows = (snap.rows||[]).map(r=>`
    <tr><td>${T(state.lang).names[r.key]||r.key}</td>
        <td>${r.bestScore}</td><td>${r.acc}%</td><td>${r.runs}</td><td>${r.missions}</td></tr>`).join('');
  host.innerHTML = `
    <div style="font-weight:800;margin-bottom:8px">Level ${snap.level} (${snap.xp|0} XP) • เล่นทั้งหมด ${snap.totalRuns} รอบ • คอมโบสูงสุด ${snap.bestCombo}</div>
    <table class="tbl">
      <tr><th>โหมด</th><th>คะแนนสูงสุด</th><th>ความแม่น</th><th>รอบ</th><th>เควสสำเร็จ</th></tr>
      ${rows || `<tr><td colspan="5" style="opacity:.75">ยังไม่มีข้อมูล</td></tr>`}
    </table>`;
  openModal('#statBoard');
}
function openDailyPanel(){
  const d = (typeof Progress.genDaily==='function' ? Progress.genDaily() : {date:new Date().toISOString().slice(0,10), missions:[], done:[]}) || {};
  const host = document.getElementById('dailyBody'); if (!host) return;
  const done = new Set(d.done||[]);
  host.innerHTML = (d.missions||[]).map(m=>{
    const ok = done.has(m.id);
    return `<div style="display:flex;align-items:center;gap:8px;margin:6px 0">
      <span>${ok?'✅':'⬜️'}</span><span>${m.label || m.id}</span>
    </div>`;
  }).join('') + `<div style="margin-top:8px;opacity:.8">วันที่: ${d.date || '-'}</div>`;
  openModal('#dailyPanel');
}

// ----- Modal helpers + Global UI (single delegation) -----
function openModal(sel){ const m = document.querySelector(sel); if (m){ m.style.display='flex'; m.dataset.open='1'; } }
function closeModal(sel){ const m = document.querySelector(sel); if (m){ m.style.display='none'; m.dataset.open=''; } }

document.addEventListener('click', (e)=>{
  const btn = e.target.closest('[data-action],[data-result],[data-modal-open],[data-modal-close]');
  if (!btn) return;

  // generic modals
  if (btn.hasAttribute('data-modal-open')){ openModal(btn.getAttribute('data-modal-open')); return; }
  if (btn.hasAttribute('data-modal-close')){ closeModal(btn.getAttribute('data-modal-close')); return; }

  const a = btn.getAttribute('data-action')||'';
  const v = btn.getAttribute('data-value') || '';

  if (a){
    if (a.startsWith('ui:start:')){ const key = a.split(':')[2]; if (MODES[key]){ state.modeKey = key; applyUI(); } return; }
    if (a === 'mode'){ state.modeKey = v; applyUI(); return; }
    if (a === 'diff'){ state.difficulty = v; applyUI(); return; }
    if (a === 'start'){ start(); return; }
    if (a === 'pause'){
      if (!state.running){ start(); return; }
      state.paused = !state.paused;
      if (!state.paused){ tick(); spawnLoop(); }
      else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); }
      return;
    }
    if (a === 'restart'){ end(true); start(); return; }
    if (a === 'help'){ openHelpCurrent(); return; }
    if (a === 'helpClose'){ closeModal('#help'); return; }
    if (a === 'helpScene'){ openHelpAll(); return; }
    if (a === 'helpSceneClose'){ closeModal('#helpScene'); return; }
    if (a === 'statOpen'){ openStatBoard(); return; }
    if (a === 'statClose'){ closeModal('#statBoard'); return; }
    if (a === 'dailyOpen'){ openDailyPanel(); return; }
    if (a === 'dailyClose'){ closeModal('#dailyPanel'); return; }
  }

  if (btn.hasAttribute('data-result')){
    const act = btn.getAttribute('data-result');
    if (act==='replay'){ closeModal('#result'); start(); return; }
    if (act==='home'){  closeModal('#result'); end(true); return; }
  }
}, {passive:false});

// ----- VR toggle button -----
(function ensureVRToggle(){
  let btn = document.getElementById('vrToggle');
  if (!btn){
    const header = document.querySelector('header.brand .spacer')?.parentElement || document.querySelector('header.brand');
    btn = document.createElement('button'); btn.id='vrToggle'; btn.className='btn'; btn.textContent='🕶️ Enter VR'; btn.style.marginLeft='8px'; header?.appendChild(btn);
  }
  btn.addEventListener('click', async ()=>{
    try{
      await VRInput.toggleVR();
      const inXR = VRInput.isXRActive?.() || VRInput.isGazeMode?.();
      btn.textContent = inXR ? '🕶️ Exit VR' : '🕶️ Enter VR';
    }catch(e){ console.warn('[HHA] VR toggle error:', e); }
  }, { passive:true });
})();

// ----- Toggles -----
$('#langToggle')?.addEventListener('click', ()=>{
  state.lang = state.lang==='TH' ? 'EN' : 'TH';
  localStorage.setItem('hha_lang', state.lang);
  coach.setLang?.(state.lang);
  applyUI();
}, {passive:true});

$('#gfxToggle')?.addEventListener('click', ()=>{
  state.gfx = state.gfx==='low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  try{ eng.renderer.setPixelRatio(state.gfx==='low'?0.75:(window.devicePixelRatio||1)); }catch{}
}, {passive:true});

$('#soundToggle')?.addEventListener('click', ()=>{
  const on = localStorage.getItem('hha_sound') !== '0';
  const nxt = !on;
  localStorage.setItem('hha_sound', nxt?'1':'0');
  sfx.setEnabled?.(nxt);
  const tg = document.getElementById('soundToggle'); if (tg) tg.textContent = nxt ? '🔊 เสียง: เปิด' : '🔇 เสียง: ปิด';
  if (nxt){ try{ sfx.play('sfx-good'); }catch{} }
}, {passive:true});

$('#hapticToggle')?.addEventListener('click', ()=>{
  state.haptic = !state.haptic;
  localStorage.setItem('hha_haptic', state.haptic?'1':'0');
  const tg = document.getElementById('hapticToggle'); if (tg) tg.textContent = state.haptic ? '📳 สั่น: เปิด' : '📴 สั่น: ปิด';
}, {passive:true});

// ----- Auto pause & audio unlock -----
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden && state.running && !state.paused){
    state.paused = true;
    clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  }
});
window.addEventListener('pointerdown', ()=>{ try{ sfx.unlock(); }catch{} }, {once:true, passive:true});

// ----- Boot -----
Progress.init();
applyUI(); updateHUD();

(function levelUI(){
  const lvEl = document.createElement('span');
  lvEl.id = 'playerLevel';
  lvEl.style.cssText='margin-left:8px;font-weight:800';
  const brand = document.querySelector('header.brand #brandTitle')?.parentElement || document.querySelector('header.brand');
  if (brand) brand.insertBefore(lvEl, brand.children[1]||null);
  const render = ()=>{ const p=Progress.profile; if (p && lvEl) lvEl.textContent = `LV ${p.level}`; };
  render();
  Progress.on((type)=>{ if (type==='level_up') render(); });
})();
