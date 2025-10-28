// === Hero Health Academy — game/main.js (2025-10-28, unified HUD/Coach/Power/Progress) ===
// ESM entry. Works with index.html you provided.
// - Wires menu → modes, countdown, timer, score/combo, power-ups, quests, result, stats/daily.
// - Defensive: optional methods on modes; no crashes if a mode lacks some APIs.

// ----- Imports -----
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine }      from './core/engine.js';
import { HUD }         from './core/hud.js';
import { Coach }       from './core/coach.js';
import { PowerUpSystem } from './core/powerup.js';
import { Progress }    from './core/progression.js';

// (optional/safe) SFX + ScoreSystem (if you have them in your tree)
let SFX = null, ScoreSystem = null;
try { SFX = (await import('./core/sfx.js')).SFX; } catch {}
try { ScoreSystem = (await import('./core/score.js')).ScoreSystem; } catch {}

// Modes (each should export a factory or object; we call create(..) if present)
const modes = Object.create(null);
async function loadModes() {
  const reg = {};
  const safeReg = async (key, path) => {
    try {
      const mod = await import(path);
      // Accept either default export or named create
      const create = mod.create || mod.default || mod[`create${key[0].toUpperCase()+key.slice(1)}`] || mod[key];
      reg[key] = create || mod;
    } catch (e) {
      console.warn('[HHA] mode load fail:', key, e);
      reg[key] = null;
    }
  };
  await Promise.all([
    safeReg('goodjunk', './modes/goodjunk.js'),
    safeReg('plate',    './modes/plate.js'),
    safeReg('hydration','./modes/hydration.js'),
    safeReg('groups',   './modes/groups.js'),
    safeReg('healthy',  './modes/plate.js'), // alias to "plate" tracker style
  ]);
  Object.assign(modes, reg);
}
await loadModes();

// ----- Helpers -----
const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const byAction = (el)=> el?.closest?.('[data-action]') || null;
const raf = window.requestAnimationFrame;

// ----- Core singletons -----
const engine = new Engine(THREE, document.getElementById('c'));
const hud    = new HUD();
const coach  = new Coach({ lang: 'TH' });
const power  = new PowerUpSystem();
Progress.init();

// Attach Power bonus (if ScoreSystem exists we’ll wire the boostFn)
function createScore() {
  if (ScoreSystem) {
    const score = new ScoreSystem();
    power.attachToScore(score);
    return score;
  }
  // Lightweight fallback
  let _n = 0, _combo = 0, _bestCombo = 0;
  let _boostFn = (base)=> (power.isX2() ? base : 0) + (power.scoreBoost|0);
  return {
    add(base=0){
      const add = (base|0) + (_boostFn(base)|0);
      _n += add; _combo++; _bestCombo = Math.max(_bestCombo, _combo);
      return { delta: add, total: _n, combo: _combo, bestCombo: _bestCombo };
    },
    miss(){ _combo = 0; return { combo:_combo }; },
    total(){ return _n|0; },
    combo(){ return _combo|0; },
    bestCombo(){ return _bestCombo|0; },
    reset(){ _n=0; _combo=0; _bestCombo=0; },
    setBoostFn(fn){ _boostFn = typeof fn==='function' ? fn : _boostFn; }
  };
}

// ----- Global App state -----
const App = {
  lang: 'TH',
  modeKey: null,
  mode: null,           // active mode instance
  modeAPI: null,        // raw module (factory or object)
  running: false,
  timeLimit: 60,
  timeLeft: 60,
  fever: 0,             // 0..1 for HUD bar
  lastTS: 0,
  loopId: 0,
  freezeHudTimer: 0,
  score: createScore(),
  acc: 0,               // percent-ish
  shots: 0,
  hits: 0,
  quests: [],           // in-run simple quests
  sfx: SFX ? new SFX() : null,
};

// ----- UI Wiring (menu, power, modal) -----
function wireMenu() {
  // Mode buttons
  $$('#menuBar [data-mode]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.getAttribute('data-mode');
      App.modeKey = key;
      document.getElementById('modeLabel').textContent = key;
      document.documentElement.setAttribute('data-hha-mode', key === 'groups' ? 'groups' : 'hub');
      hud.setTargetBadge('—'); // clear
      hud.hidePills();
    }, { passive:true });
  });

  // Actions
  $('#menuBar').addEventListener('click', (e)=>{
    const actEl = byAction(e.target);
    if (!actEl) return;
    const action = actEl.getAttribute('data-action');
    if (action === 'start') startGame();
    if (action === 'stats') openStats();
    if (action === 'daily') openDaily();
    if (action === 'help')  openHelp();
    if (action === 'power-x2')    usePower('x2', 8);
    if (action === 'power-freeze')usePower('freeze', 3);
    if (action === 'power-sweep') usePower('sweep', 2);
    if (action === 'restart')     restartGame();
    if (action === 'back-to-menu') backToMenu();
  }, { passive:true });

  // Header buttons
  $('header .btn[data-action="toggle-lang"]').addEventListener('click', ()=>{
    App.lang = (App.lang === 'TH' ? 'EN' : 'TH');
    coach.setLang(App.lang);
    hud.toast(App.lang === 'TH' ? 'ภาษาไทย' : 'English', 800);
  }, { passive:true });
  $('header .btn[data-action="open-help"]').addEventListener('click', openHelp, { passive:true });

  // Modal close
  $$('#resultModal [data-modal-close]').forEach(b=> b.addEventListener('click', closeModal, { passive:true }));
}
wireMenu();

function openHelp(){
  const body = $('#resultBody');
  body.innerHTML = `
    <div class="cardlike" style="display:flex;flex-direction:column;gap:8px">
      <div><b>วิธีเล่น</b></div>
      <ul style="margin:0 0 0 16px;padding:0;display:flex;flex-direction:column;gap:6px">
        <li>เลือกโหมดแล้วกด <b>เริ่มเล่น</b></li>
        <li>แตะ/คลิกไอคอน “ดี” หลีกเลี่ยง “ขยะ”</li>
        <li>เก็บคอมโบเพื่อเปิด <b>FEVER</b> และใช้พลังเสริม</li>
      </ul>
    </div>
  `;
  openModal();
}

function openStats(){
  const s = Progress.getStatSnapshot();
  const rows = s.rows.map(r=>`
    <tr><td style="padding:6px 8px">${r.key}</td>
        <td style="padding:6px 8px;text-align:right">${r.bestScore}</td>
        <td style="padding:6px 8px;text-align:right">${r.acc}%</td>
        <td style="padding:6px 8px;text-align:right">${r.runs}</td>
        <td style="padding:6px 8px;text-align:right">${r.missions}</td></tr>`).join('');
  $('#resultBody').innerHTML = `
    <div class="cardlike" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div><b>Level</b> ${s.level}</div>
      <div><b>XP</b> ${s.xp}</div>
      <div><b>Total Runs</b> ${s.totalRuns}</div>
      <div><b>Best Combo</b> ${s.bestCombo}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:8px">
      <thead><tr>
        <th style="text-align:left;padding:6px 8px">Mode</th>
        <th style="text-align:right;padding:6px 8px">Best</th>
        <th style="text-align:right;padding:6px 8px">Acc%</th>
        <th style="text-align:right;padding:6px 8px">Runs</th>
        <th style="text-align:right;padding:6px 8px">Missions</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  openModal();
}

function openDaily(){
  const d = Progress.genDaily();
  const items = d.missions.map(m=>`
    <li style="margin:0 0 4px 0">${m.label}</li>
  `).join('');
  $('#resultBody').innerHTML = `
    <div><b>Daily (${d.date})</b></div>
    <ul style="margin:8px 0 0 18px;padding:0">${items}</ul>
  `;
  openModal();
}

function openModal(){ $('#resultModal').style.display = 'flex'; document.body.classList.add('modal-open'); }
function closeModal(){ $('#resultModal').style.display = 'none'; document.body.classList.remove('modal-open'); }

// ----- Power-ups -----
function usePower(kind, sec){
  power.apply(kind, sec);
  if (kind==='x2' || kind==='freeze') coach.onPower(kind==='x2' ? 'boost' : 'freeze');
  if (kind==='sweep') hud.toast('Sweep!', 700);
  // HUD reflect
  hud.setPowerTimers(power.getTimers());
}

// Keep HUD timers fresh
setInterval(()=> hud.setPowerTimers(power.getTimers()), 1000);

// ----- Countdown -----
async function countdown(n=3){
  const wrap = $('#cdOverlay'), num = $('#cdNum');
  wrap.style.display = 'flex';
  for (let i=n;i>=1;i--){
    num.textContent = i;
    coach.onCountdown(i);
    await wait(700);
  }
  wrap.style.display = 'none';
}
function wait(ms){ return new Promise(r=>setTimeout(r, ms)); }

// ----- Game start/stop -----
async function startGame() {
  if (!App.modeKey) {
    hud.toast('เลือกโหมดก่อน!', 1000);
    return;
  }
  // Build/prepare mode instance
  App.modeAPI = modes[App.modeKey];
  App.mode = await ensureModeInstance(App.modeKey);
  if (!App.mode) {
    hud.toast('โหมดนี้ยังไม่พร้อม', 1000);
    return;
  }

  App.running = false;
  App.timeLimit = 60;
  App.timeLeft  = App.timeLimit;
  App.fever     = 0;
  App.score.reset();
  App.hits = 0; App.shots = 0; App.acc = 0;

  // Quests (simple set per run; mode may override via callbacks)
  App.quests = [
    { key:'combo', name:'คอมโบ', icon:'🔥', need:10, progress:0, done:false },
    { key:'perfect', name:'Perfect', icon:'✨', need:8, progress:0, done:false },
    { key:'golden', name:'Golden', icon:'⭐', need:2, progress:0, done:false },
  ];
  hud.setQuestChips(App.quests);

  // UI state
  document.body.classList.remove('ui-mode-menu');
  document.body.classList.add('ui-mode-playing');
  $('#menuBar').style.pointerEvents = 'none';
  $('#menuBar').style.opacity = '.25';

  await countdown(3);

  // Begin progress run
  Progress.beginRun(App.modeKey, 'normal', App.lang);
  App.running = true;
  App.lastTS = performance.now();

  // Hooks
  try { App.mode.start?.({ lang: App.lang, power, hud, coach, time: App.timeLimit }); } catch(e){ console.warn('[HHA] mode.start', e); }
  coach.onStart();

  // Loop on
  loop();
}

function restartGame(){
  closeModal();
  startGame();
}

function backToMenu(){
  closeModal();
  stopGame();
  document.body.classList.remove('ui-mode-playing');
  document.body.classList.add('ui-mode-menu');
  $('#menuBar').style.pointerEvents = 'auto';
  $('#menuBar').style.opacity = '1';
}

function stopGame(){
  App.running = false;
  if (App.loopId) cancelAnimationFrame(App.loopId);
  try { App.mode?.stop?.(); } catch {}
}

// ----- Mode instance factory (robust to various exports) -----
async function ensureModeInstance(key) {
  const api = modes[key];
  if (!api) return null;

  // If a factory function is exported
  if (typeof api === 'function') {
    try {
      return api({ engine, hud, coach, power, THREE, Progress });
    } catch (e) {
      console.warn('[HHA] mode factory failed', e);
    }
  }

  // If module exported an object with create()
  if (api && typeof api.create === 'function') {
    try {
      return api.create({ engine, hud, coach, power, THREE, Progress });
    } catch (e) {
      console.warn('[HHA] mode.create failed', e);
    }
  }

  // If module itself is a plain “mode” object (already implemented)
  if (api && (api.start || api.update || api.onClick)) {
    return api;
  }

  // Fallback stub (click-to-earn)
  return {
    start(){ /* no-op */ },
    stop(){},
    update(){},
    onClick(x,y,el){
      // quick toy feedback
      onHit({ kind:'good', points:10, ui:{x,y} });
    }
  };
}

// ----- Input → gameplay host (#gameLayer) -----
const gameLayer = $('#gameLayer');
gameLayer.addEventListener('pointerdown', (e)=>{
  if (!App.running) return;
  const rect = gameLayer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Let mode handle first
  try { App.mode?.onClick?.(x, y, e.target); } catch {}

  // If mode didn’t award, we can give light feedback via engine FX, but we
  // will always show a subtle glow at the click spot.
  engine.fx.glowAt(e.clientX, e.clientY, 'rgba(127,255,212,.55)', 380);
}, { passive:true });

// ----- Centralized event handlers (hit/miss/fever etc.) for modes to call -----
function onHit({ kind='good', points=10, ui } = {}){
  const base = points|0;
  const res = App.score.add(base);
  App.hits++; App.shots++;
  App.acc = Math.round((App.hits / Math.max(1, App.shots)) * 100);

  // FEVER build (simple)
  App.fever = Math.min(1, App.fever + 0.04);

  // HUD + COACH
  hud.setScore(res.total);
  hud.setCombo('x'+res.combo);
  hud.setFeverProgress(App.fever);
  if (kind === 'perfect') coach.onPerfect(); else coach.onGood();

  // Quests
  bumpQuest('combo', 1);
  if (kind === 'perfect') bumpQuest('perfect', 1);
  if (kind === 'golden')  bumpQuest('golden', 1);

  // FX
  if (ui?.x!=null && ui?.y!=null) {
    engine.fx.spawnShards(ui.x, ui.y, { count: 30 });
    engine.fx.popText(`+${res.total-(res.total-res.delta) ? res.delta : base}`, { x: ui.x, y: ui.y, ms: 650 });
  }
}

function onMiss(){
  App.shots++;
  App.score.miss?.();
  App.fever = Math.max(0, App.fever - 0.08);
  hud.setCombo('x'+App.score.combo());
  hud.setFeverProgress(App.fever);
  coach.onBad();
  hud.flashDanger();
}

function bumpQuest(key, d=1){
  const q = App.quests.find(i=>i.key===key);
  if (!q || q.done) return;
  q.progress = Math.min(q.need, (q.progress|0) + (d|0));
  if (q.progress >= q.need) q.done = true;
  hud.setQuestChips(App.quests);
  if (q.done) {
    coach.onQuestDone();
    Progress.addMissionDone(App.modeKey);
  }
}

// Expose a minimal bus so modes can call hits/misses easily
const Bus = { hit: onHit, miss: onMiss, hud, coach, power, progress: Progress };
window.__HHA_BUS__ = Bus; // (debug)

// ----- Main loop -----
function loop(ts){
  if (!App.running) return;
  App.loopId = raf(loop);

  const now = ts || performance.now();
  const dt = Math.min(0.05, (now - (App.lastTS||now)) / 1000); // c ~50ms
  App.lastTS = now;

  // Timer (freeze prevents countdown)
  if ((power.getTimers().freeze|0) <= 0) {
    App.timeLeft = Math.max(0, App.timeLeft - dt);
  }

  // Mode update
  const timeScale = power.getTimeScale();
  try { App.mode?.update?.(dt * timeScale, Bus); } catch {}

  // HUD common
  hud.setTime(Math.ceil(App.timeLeft));

  // FEVER decay if not building
  App.fever = Math.max(0, App.fever - dt*0.06);
  hud.setFeverProgress(App.fever);

  // Low time cues
  if (App.timeLeft <= 10 && App.freezeHudTimer !== 10) {
    App.freezeHudTimer = 10;
    coach.onTimeLow();
  }

  // End
  if (App.timeLeft <= 0) {
    endGame();
  }
}

function endGame(){
  App.running = false;

  // Accuracy
  const acc = Math.round((App.hits / Math.max(1, App.shots)) * 100);

  // Finish run
  Progress.endRun({
    score: App.score.total(),
    bestCombo: App.score.bestCombo?.() || 0,
    timePlayed: App.timeLimit,
    acc
  });

  coach.onEnd(App.score.total());

  // Fill result
  const body = $('#resultBody');
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="cardlike"><b>Score</b><div>${App.score.total()}</div></div>
      <div class="cardlike"><b>Accuracy</b><div>${acc}%</div></div>
      <div class="cardlike"><b>Best Combo</b><div>${App.score.bestCombo?.()||0}</div></div>
      <div class="cardlike"><b>Mode</b><div>${App.modeKey}</div></div>
    </div>
    <div style="margin-top:12px"><b>Mini Quests</b></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
      ${App.quests.map(q=>{
        const ok = q.done && !q.fail;
        const tag = ok ? '✅' : (q.progress>0 ? '⏳' : '—');
        return `<div class="questChip${ok?' done':''}"><div class="qRow"><span class="qLabel">${q.icon||'⭐'} ${q.name}</span><span class="qProg">${q.progress}/${q.need}</span></div><div class="qBar"><i style="width:${Math.min(100, Math.round((q.progress*100)/q.need))}%"></i></div><div style="margin-top:4px">${tag}</div></div>`;
      }).join('')}
    </div>
  `;

  // Show modal & restore menu controls
  openModal();
  $('#menuBar').style.pointerEvents = 'auto';
  $('#menuBar').style.opacity = '1';
}

// ----- Public-ish hooks for modes to call (optional) -----
// Modes may import nothing and just call window.__HHA_BUS__.hit/miss
// but we also provide named exports for ESM-aware local modes.
export function HHA_onHit(args){ onHit(args); }
export function HHA_onMiss(){ onMiss(); }

// ----- Misc: click on power pseg shows cooldown fills via hud.setPowerTimers() -----
$('#powerBar')?.addEventListener('click', ()=> hud.setPowerTimers(power.getTimers()), { passive:true });

// ----- Quality-of-life: pause on blur -----
window.addEventListener('blur', ()=>{ if (App.running) App._pausedOnBlur = true; }, { passive:true });
window.addEventListener('focus', ()=>{ if (App._pausedOnBlur) { App._pausedOnBlur=false; coach.say(App.lang==='TH'?'พร้อมต่อ!':'Resume!'); } }, { passive:true });

// ----- (Optional) Example: key binds for quick test -----
window.addEventListener('keydown', (e)=>{
  if (e.key==='1') usePower('x2',8);
  if (e.key==='2') usePower('freeze',3);
  if (e.key==='3') usePower('sweep',2);
  if (e.key==='h') onHit({ kind:'good', points:10, ui:{ x: innerWidth/2, y: innerHeight/2 }});
  if (e.key==='m') onMiss();
}, { passive:true });

// ----- End of file -----
