// === Hero Health Academy — game/main.js (Shield + Progression v2.1)
// - PowerUpSystem v3 (x2/freeze/sweep/shield) + HUD v3.1 (🛡 segment)
// - Progression v2.1: daily missions (local-date), XP/Level, stats, events
// - Missions tick + addMissionDone on success
// - Pause on blur, strong replay, result modal

// ----- Imports -----
import { HUD } from './core/hud.js';
import { PowerUpSystem } from './core/powerup.js';
import { MissionSystem } from './core/mission-system.js';
import { Leaderboard } from './core/leaderboard.js';
import { Progress } from './core/progression.js';   // ⟵ ใหม่

// (Optional) tiny FX helper
const FX = {
  popText(txt, { x, y, ms = 720 } = {}) {
    const el = document.createElement('div');
    el.textContent = txt;
    Object.assign(el.style, {
      position: 'fixed', left: Math.max(0, x - 10) + 'px', top: Math.max(0, y - 10) + 'px',
      font: '900 16px ui-rounded', color: '#eaf6ff', textShadow: '0 2px 10px #000a',
      pointerEvents: 'none', transform: 'translate(-50%,-60%) scale(1)', transition: 'all .72s ease',
      zIndex: 120
    });
    document.body.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.transform = 'translate(-50%,-90%) scale(1.08)';
      el.style.opacity = '0';
    });
    setTimeout(()=>{ try{ el.remove(); }catch{} }, ms);
  }
};

// ----- Modes (factory adapters) -----
import * as goodjunk from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';

// ----- Globals / State -----
const Engine = {
  running: false,
  lastTs: 0,
  fx: FX,
  update(dt) {
    if (this.runner && typeof this.runner.update === 'function') {
      this.runner.update(dt, Bus);
    }
  }
};

const State = {
  seconds: 45,
  score: 0,
  lang: (localStorage.getItem('hha_lang') || 'TH').toUpperCase(),
  mode: 'goodjunk',
  diff: (window.__HHA_DIFF || 'Normal'),
  paused: false,
  // simple combo tracker (optional for XP calc)
  combo: 0,
  bestCombo: 0
};

// ----- Systems -----
const hud     = new HUD();
const power   = new PowerUpSystem();
const mission = new MissionSystem();
const board   = new Leaderboard();

// Progression: init + listeners
Progress.init();
Progress.on((type, payload)=>{
  switch(type){
    case 'daily_rotate':
      hud.toast(State.lang==='TH' ? 'ภารกิจประจำวันอัปเดตแล้ว' : 'Daily refreshed');
      break;
    case 'daily_update':
      // could reflect on HUD later; lightweight toast ok
      hud.toast(State.lang==='TH' ? 'อัปเดต Daily!' : 'Daily updated!');
      break;
    case 'level_up':
      // แจ้งเตือนเวลาขึ้นเลเวล
      hud.say((State.lang==='TH' ? 'เลเวลอัป! ' : 'Level up! ') + `Lv.${payload?.level||'?'}`, 1500);
      break;
    case 'run_start':
      // no-op; reserved for future UI decorations
      break;
    case 'run_end':
      // แสดง XP gain คร่าว ๆ
      if (payload?.xpGain != null) {
        hud.toast((State.lang==='TH' ? 'ได้ XP +' : 'XP +') + payload.xpGain, 1200);
      }
      break;
    case 'mission_done':
      hud.toast(State.lang==='TH' ? 'นับเควสต์สะสม +' : 'Mission tally +', 900);
      break;
  }
});

// Power timers → HUD
power.onChange(timers => hud.setPowerTimers(timers));

/* ---------------- Shield Overlay FX ---------------- */
const ShieldFX = (() => {
  if (!document.getElementById('hha-shield-css')) {
    const css = document.createElement('style');
    css.id = 'hha-shield-css';
    css.textContent = `
      #shieldOverlay{
        position:fixed; inset:0; pointer-events:none; z-index:94; display:none;
        background: radial-gradient(80% 60% at 50% 40%, rgba(160,180,255,.18), rgba(160,140,255,.08) 60%, transparent 70%);
        mix-blend-mode: screen;
      }
      #shieldOverlay.active{ display:block; animation: hhaShieldPulse 1.2s ease-in-out; }
      @keyframes hhaShieldPulse{
        0%{ opacity:.00; filter:saturate(1.0) blur(0px); }
        25%{ opacity:.40; filter:saturate(1.08) blur(0px); }
        60%{ opacity:.22; }
        100%{ opacity:.00; }
      }
    `;
    document.head.appendChild(css);
  }
  let el = document.getElementById('shieldOverlay');
  if (!el) { el = document.createElement('div'); el.id = 'shieldOverlay'; document.body.appendChild(el); }
  function flash() {
    el.classList.remove('active'); void el.offsetWidth; el.classList.add('active');
    setTimeout(()=> el.classList.remove('active'), 1200);
  }
  return { flash };
})();

/* ---------------- SFX proxy ---------------- */
const SFX = {
  play(id){ try{ document.querySelector('#'+id)?.play?.(); }catch{} },
  good(){ this.play('sfx-good'); },
  bad(){ this.play('sfx-bad'); },
  perfect(){ this.play('sfx-perfect'); },
  power(){ this.play('sfx-powerup'); }
};

/* ---------------- Result Modal ---------------- */
function showResult() {
  const root = document.getElementById('result');
  if (!root) return;
  const b = document.getElementById('finalScore'); if (b) b.textContent = String(State.score|0);
  root.style.display = 'flex';
}
function hideResult(){
  const root = document.getElementById('result'); if (root) root.style.display='none';
}

/* ---------------- Event Bus (from modes) ---------------- */
const Bus = {
  sfx: SFX,

  hit({ kind, points = 0, ui, meta }) {
    // combo
    State.combo = (State.combo|0) + 1;
    State.bestCombo = Math.max(State.bestCombo|0, State.combo|0);

    addScore(points|0);
    if (kind === 'perfect') SFX.perfect(); else SFX.good();

    mission.onEvent('good', { count: 1 }, State);
    if (meta?.isTarget) mission.onEvent('target_hit', { count: 1 }, State);
  },

  miss({ meta } = {}) {
    // reset combo
    State.combo = 0;

    // shield absorb?
    const timers = power.getTimers?.() || {};
    const shieldOn = (timers.shield|0) > 0;
    if (shieldOn) {
      ShieldFX.flash();
      SFX.power();
      hud.toast(State.lang==='TH' ? '🛡 กันพลาด!' : '🛡 Shielded!');
      addScore(2); // soft compensation
      return;
    }

    hud.flashDanger();
    SFX.bad();
    mission.onEvent('miss', { count: 1 }, State);
  }
};

/* ---------------- Score helpers ---------------- */
function addScore(base) {
  const boost = (typeof power._boostFn === 'function') ? power._boostFn(base) : 0;
  State.score = Math.max(0, (State.score|0) + base + boost);
  hud.setScore(State.score|0);
}

/* ---------------- Game Loop ---------------- */
function loop(ts) {
  if (!Engine.running || State.paused) return;
  if (!Engine.lastTs) Engine.lastTs = ts;
  const dt = Math.min(0.1, (ts - Engine.lastTs) / 1000);
  Engine.lastTs = ts;

  Engine.update(dt);
  requestAnimationFrame(loop);
}

/* ---------------- Seconds ticker ---------------- */
let _secT = 0;
function startSecondTicker() {
  stopSecondTicker();
  _secT = setInterval(() => {
    if (State.paused) return;

    State.seconds = Math.max(0, (State.seconds|0) - 1);
    hud.setTime(State.seconds|0);

    mission.tick(State, { score: State.score|0 }, (res)=>{
      if (res?.success) {
        hud.toast(State.lang==='TH' ? 'เควสต์สำเร็จ!' : 'Quest done!', 1000);
        Progress.addMissionDone(State.mode); // ⟵ บันทึกความคืบหน้า progression
      } else {
        hud.toast(State.lang==='TH' ? 'พลาดเควสต์' : 'Quest failed', 900);
      }
    }, { hud, lang: State.lang });

    if ((State.seconds|0) <= 0) endGame();
  }, 1000);
}
function stopSecondTicker() {
  if (_secT) { clearInterval(_secT); _secT = 0; }
}

/* ---------------- Runner factory ---------------- */
function makeRunner(modeKey) {
  const mod = (modeKey==='groups') ? groups
            : (modeKey==='goodjunk') ? goodjunk
            : goodjunk;

  if (typeof mod.create === 'function') {
    return mod.create({ engine: Engine, hud, coach: CoachBridge });
  }
  return {
    start(){ mod.init?.(State, hud); },
    update(dt, bus){ mod.tick?.(State); },
    cleanup(){ mod.cleanup?.(State, hud); }
  };
}

/* ---------------- Coach bridge ---------------- */
const CoachBridge = {
  onStart(){ hud.say(State.lang==='TH'?'เริ่มเลย!':'Let’s go!', 900); },
  onGood(){},
  onPerfect(){ hud.toast(State.lang==='TH'?'เยี่ยม!':'Great!', 700); },
  onBad(){ hud.dimPenalty(); },
  onQuestProgress(txt, cur, need){ hud.toast(`${txt}  ${cur}/${need}`, 700); },
  onQuestDone(){ hud.toast(State.lang==='TH'?'ภารกิจครบ!':'Mission complete!', 900); },
  onQuestFail(){ hud.toast(State.lang==='TH'?'ภารกิจล้มเหลว':'Mission failed', 900); }
};

/* ---------------- Start / End flow ---------------- */
function startGame({ demoPassed } = {}) {
  hideResult();

  // reset base state
  State.seconds = 45;
  State.score = 0;
  State.combo = 0;
  State.bestCombo = 0;

  State.lang = (window.HHA_UI?.getLang?.() || State.lang || 'TH').toUpperCase();
  localStorage.setItem('hha_lang', State.lang);

  State.mode = (window.HHA_UI?.getMode?.() || State.mode || 'goodjunk');
  State.diff = (window.HHA_UI?.getDiff?.() || State.diff || 'Normal');

  hud.setScore(0);
  hud.setTime(State.seconds|0);

  // Progression: start run + ensure daily today
  Progress.genDaily(); // สร้าง/ยืนยัน daily ของวันนี้ (ไม่แสดง modal)
  Progress.beginRun(State.mode, State.diff, State.lang);

  // missions (3 chips)
  const run = mission.start(State.mode, { seconds: State.seconds, count: 3, lang: State.lang });
  mission.attachToState(run, State);

  // power reset
  power.dispose();
  hud.setPowerTimers(power.getTimers());

  // runner
  if (Engine.runner && typeof Engine.runner.cleanup === 'function') {
    try { Engine.runner.cleanup(); } catch {}
  }
  Engine.runner = makeRunner(State.mode);
  Engine.runner.start?.();

  // begin
  State.paused = false;
  Engine.running = true;
  Engine.lastTs = 0;
  requestAnimationFrame(loop);
  startSecondTicker();
}

function endGame() {
  Engine.running = false;
  stopSecondTicker();
  State.paused = false;

  // cleanup
  try { Engine.runner?.cleanup?.(); } catch {}

  // save leaderboard
  board.submit(State.mode, State.diff, State.score|0, { meta:{ seconds: 45, bestCombo: State.bestCombo|0 } });

  // Progression: end run with metrics (acc = rough from combo/score if real acc not available)
  const roughAcc = Math.max(0, Math.min(100, Math.round((State.bestCombo||0) * 3))); // placeholder heuristic
  Progress.endRun({
    score: State.score|0,
    bestCombo: State.bestCombo|0,
    timePlayed: 45,
    acc: roughAcc
  });

  showResult();
}

/* ---------------- Public hooks for UI / boot.js ---------------- */
window.HHA = {
  startGame,
  endGame,
  applyPower(kind, sec){ power.apply(kind, sec); },
  powers: {
    x2(s=8){ power.apply('x2', s); },
    freeze(s=3){ power.apply('freeze', s); },
    sweep(s=2){ power.apply('sweep', s); },
    shield(s=6){ power.apply('shield', s); }
  }
};

// Pause on blur/focus
window.onAppBlur  = function(){ State.paused = true; };
window.onAppFocus = function(){ State.paused = false; };

// Language toggle
window.onLangSwitch = function(lang){
  State.lang = (String(lang).toUpperCase()==='EN'?'EN':'TH');
  localStorage.setItem('hha_lang', State.lang);
};

// Optional stubs
window.onSoundToggle = function(){};
window.onGfxToggle   = function(){};

// Strong restart
window.end = function(replay){
  try { endGame(); } catch {}
  if (replay) setTimeout(()=> startGame({ demoPassed:true }), 60);
};
