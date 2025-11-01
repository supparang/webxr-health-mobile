// === game/main.js (Option B, ultra-safe start + sound unlock + on-screen errors) ===
import { sfx as SFX } from './core/sfx.js';
import { Engine, FX } from './core/engine.js';
import { ScoreSystem } from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';

// Modes
import * as goodjunk from './modes/goodjunk.js';
import * as groups from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate from './modes/plate.js';

const MODS = { goodjunk, groups, hydration, plate };

// ---------- Globals ----------
const engine = new Engine();
engine.sfx = SFX;
SFX.loadIds(['sfx-good','sfx-bad','sfx-perfect','sfx-tick','sfx-powerup']);

const score = new ScoreSystem();
const power = new PowerUpSystem();
power.onChange(updatePowerBar);
power.attachToScore(score);

let state = {
  mode: 'goodjunk',
  diff: 'Normal',
  running: false,
  raf: 0,
  lastT: 0,
  ctrl: null,     // for create({}) API
  legacy: null    // for start/update API
};

const $ = (s)=>document.querySelector(s);
const modeBadge = $('#modeBadge');
const diffBadge = $('#diffBadge');
const scoreVal  = $('#scoreVal');
const menuBar   = $('#menuBar');
const spawnHost = $('#spawnHost');

// ---------- HUD helpers ----------
function toast(msg) {
  const el = $('#toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  setTimeout(()=>{ try{ el.classList.remove('show'); }catch{} }, 1100);
}
function updatePowerBar() {
  const timers = power.getCombinedTimers();
  const any = Math.max(timers.x2, timers.freeze, timers.sweep, timers.shield) > 0 ? 1 : 0;
  const pct = Math.min(100, (timers.x2*10 + timers.freeze*15 + timers.sweep*12 + timers.shield*8));
  const fill = $('#powerFill');
  if (fill){ fill.style.width = (any ? Math.max(8, pct) : 0) + '%'; }
}
function setActiveBtn(groupSel, value, attr) {
  document.querySelectorAll(groupSel).forEach(el=>{
    if (el.dataset[attr] === value) el.classList.add('active');
    else el.classList.remove('active');
  });
}

// ---------- Safe mini-fallback (ถ้าโหมดพัง ให้ยังเล่นได้) ----------
const Fallback = {
  start(){
    try{ spawnHost.innerHTML=''; }catch{}
    const b = document.createElement('button');
    b.textContent = '🥗';
    b.className = 'spawn-emoji';
    Object.assign(b.style,{
      position:'fixed', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
      fontSize:'56px', border:'0', background:'transparent', zIndex:8
    });
    b.addEventListener('click',(ev)=>{
      FX.popText('+10', {x:ev.clientX,y:ev.clientY});
      score.addKind('good',{comboNow:score.combo});
      engine.sfx.good();
      scoreVal.textContent = String(score.get());
    }, {passive:true});
    document.body.appendChild(b);
  },
  stop(){ /* no-op */ },
  update(){ /* no-op */ }
};

// ---------- Bus ----------
const Bus = {
  hit(payload={}) {
    const k = payload.kind || 'good';
    const meta = payload.meta || {};
    if (k === 'golden') {
      score.addKind('perfect', { ...meta, golden:true, comboNow: score.combo });
      power.apply('x2', 6);
      engine.sfx.perfect();
      FX.popText('+BONUS ✨', payload.ui);
    } else if (k === 'perfect') {
      score.addKind('perfect', { ...meta, comboNow: score.combo });
      engine.sfx.perfect();
    } else if (k === 'good') {
      score.addKind('good', { ...meta, comboNow: score.combo });
      engine.sfx.good();
    } else {
      score.addKind('ok', { ...meta, comboNow: score.combo });
    }
    scoreVal.textContent = String(score.get());
  },
  miss(payload={}) {
    score.addKind('bad', payload.meta || {});
    engine.sfx.bad();
    scoreVal.textContent = String(score.get());
    try{
      document.body.classList.add('flash-danger');
      setTimeout(()=>document.body.classList.remove('flash-danger'),160);
    }catch{}
  },
  power(kind) {
    power.apply(kind);
    engine.sfx.power();
    toast('Power: ' + kind);
  }
};

// ---------- Runner ----------
function loop(ts) {
  if (!state.running) return;
  const t = ts || performance.now();
  const dt = state.lastT ? Math.min(0.1, (t - state.lastT)/1000) : 0.016;
  state.lastT = t;

  try {
    if (state.ctrl && typeof state.ctrl.update === 'function') {
      state.ctrl.update(dt, Bus);
    } else if (state.legacy && typeof state.legacy.update === 'function') {
      state.legacy.update(dt, Bus);
    }
  } catch(e) {
    showError(e);
  }
  state.raf = requestAnimationFrame(loop);
}

function stopGame() {
  state.running = false;
  cancelAnimationFrame(state.raf);
  power.dispose();
  score.reset();
  try{ state.ctrl && state.ctrl.stop && state.ctrl.stop(); }catch{}
  try{ state.legacy && state.legacy.stop && state.legacy.stop(); }catch{}
  try{ spawnHost.innerHTML=''; }catch{}
}

function startGame() {
  stopGame();

  // ปลดล็อกเสียงบนมือถือ + เด้งเสียงให้รู้ว่าทำงาน
  SFX.unlock();
  if (SFX.isEnabled()) { SFX.tick?.(); }

  modeBadge.textContent = state.mode;
  diffBadge.textContent = state.diff;
  scoreVal.textContent  = '0';

  let mod = MODS[state.mode];
  state.ctrl = null;
  state.legacy = null;

  try {
    if (mod && typeof mod.create === 'function') {
      state.ctrl = mod.create({ engine });
      state.ctrl.start?.({ difficulty: state.diff });
    } else if (mod && typeof mod.start === 'function' && typeof mod.update === 'function') {
      state.legacy = mod;
      state.legacy.start({ difficulty: state.diff });
    } else {
      // ไม่มีโหมด → ใช้ fallback แทน
      toast('Mode not available, using fallback');
      state.ctrl = Fallback;
      state.ctrl.start();
    }
  } catch (e) {
    // ถ้าโหมดพัง → ใช้ fallback
    showError(e);
    toast('Mode error → fallback');
    state.ctrl = Fallback;
    state.ctrl.start();
  }

  // ซ่อนเมนู & เริ่มลูป
  menuBar.style.display = 'none';
  state.running = true;
  state.lastT = 0;
  state.raf = requestAnimationFrame(loop);
}

// ---------- Menu interactions ----------
(function bindMenu(){
  const mb = menuBar;
  const onHit = (ev) => {
    const t = ev.target.closest('.btn');
    if (!t) return;

    // ปลดล็อกเสียงตั้งแต่มี gesture แรก
    SFX.unlock();

    if (t.dataset.mode) {
      state.mode = t.dataset.mode;
      setActiveBtn('.btn[data-mode]', state.mode, 'mode');
      modeBadge.textContent = state.mode;
      return;
    }
    if (t.dataset.diff) {
      state.diff = t.dataset.diff;
      setActiveBtn('.btn[data-diff]', state.diff, 'diff');
      diffBadge.textContent = state.diff;
      return;
    }
    if (t.dataset.action === 'start') {
      startGame();
      return;
    }
    if (t.dataset.action === 'howto') {
      alert('• GoodJunk: แตะอาหารดี หลีกเลี่ยงของไม่ดี\n• Groups: แตะให้ตรงหมวด\n• Hydration: รักษา 45–65%\n• Plate: เติมครบตามโควตา');
      return;
    }
    if (t.dataset.action === 'sound') {
      const next = !SFX.isEnabled();
      SFX.setEnabled(next);
      SFX.unlock();
      if (next) { SFX.good(); } // เล่นเสียงให้รู้ว่าเปิดแล้ว
      toast('Sound: ' + (next ? 'ON' : 'OFF'));
      return;
    }
  };
  // bind หลายอีเวนต์ให้ครอบคลุมทุกอุปกรณ์/เบราว์เซอร์
  ['click','pointerup','touchend','keydown'].forEach(e => mb.addEventListener(e, onHit, { passive:true }));
})();

// ---------- On-screen error box ----------
function showError(e){
  const msg = (e && (e.message || e.toString())) || 'Unknown error';
  const box = document.createElement('div');
  box.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:10000;background:#7f1d1d;color:#fff;padding:8px 12px;font:600 13px ui-rounded';
  box.textContent='⚠️ '+msg;
  document.body.appendChild(box);
  console.error(e);
}
window.addEventListener('error',(e)=>showError(e.error||e));
window.addEventListener('unhandledrejection',(e)=>showError(e.reason||e));

// ---------- Mobile sound unlock on first gesture (เผื่อผู้ใช้กดตรงอื่น) ----------
window.addEventListener('pointerdown', ()=>SFX.unlock(), { once:true, passive:true });

// ---------- Debug helpers ----------
try { window.HHA = { start: startGame, stop: stopGame, setMode:(m)=>state.mode=m, setDiff:(d)=>state.diff=d, score, power }; } catch {}
