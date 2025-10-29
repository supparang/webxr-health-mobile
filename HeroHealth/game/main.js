// === Hero Health Academy — game/main.js (unified play loop; centered spawn; 3D tilt; scoring; FX) ===
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';

import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';
import { PowerUpSystem } from './core/powerup.js';
import { Progress } from './core/progression.js';

// โหมดเกม (อย่างน้อย 2 โหมดตัวอย่างตามที่ส่งมา)
import * as goodjunk from './modes/goodjunk.js';
import * as groups   from './modes/groups.js';

// ---- (ใหม่) ScoreSystem แบบบางเบา (ถ้าคุณมีของเดิมอยู่แล้วให้ลบคลาสนี้ และ import ของเดิมแทน) ----
class ScoreSystem {
  constructor(){
    this.value = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this._boostFn = null;  // function(baseScore)=>extra
  }
  setBoostFn(fn){ this._boostFn = fn; }
  reset(){ this.value = 0; this.combo = 0; this.bestCombo = 0; }
  add(base=10){
    const extra = this._boostFn ? (Number(this._boostFn(base))||0) : 0;
    this.value += (base + extra);
    this.combo += 1;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    return { type:'add', base, extra, combo:this.combo, total:this.value };
  }
  addPenalty(n=8){
    this.value = Math.max(0, this.value - n);
    this.combo = 0;
    return { type:'penalty', n, combo:this.combo, total:this.value };
  }
  get(){ return this.value|0; }
}

// ---- Lazy import FX (พร้อม fallback ปลอดภัย) ----
let FX = { shatter3D:()=>{}, add3DTilt:()=>{} };
(async () => {
  try {
    const m = await import('./core/fx.js');
    FX = { ...FX, ...m };
    // เผื่อโหมด groups เรียกผ่าน window
    window.HHA_FX = { ...(window.HHA_FX||{}), ...FX };
  } catch {}
})();

// ---- Boot systems ----
const engine = new Engine(THREE, document.getElementById('c'));
const hud    = new HUD();
const coach  = new Coach({ lang: (localStorage.getItem('hha_lang')||'TH') });
const power  = new PowerUpSystem();
const score  = new ScoreSystem();
power.attachToScore(score);
Progress.init();

// ---- DOM refs ----
const stageEl   = document.getElementById('stage');
const host      = document.getElementById('spawnHost');
const gameLayer = document.getElementById('gameLayer');
const menuBar   = document.getElementById('menuBar');
const resultModal = document.getElementById('resultModal');
const resultBody  = document.getElementById('resultBody');

const STATE = {
  lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(),
  mode: 'goodjunk',
  difficulty: 'Normal',
  playing: false,
  endAt: 0,
  freezeUntil: 0,
  stats: { perfect:0, good:0, bad:0 },
  _gjStreakMilestone: 0,
};

// โหมดที่ใช้งานได้
const MODES = {
  goodjunk,
  groups,
};

// ---- Utils ----
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function now(){ return performance?.now?.() || Date.now(); }

// พิกัดแบบ "อยู่ในกรอบแน่" ของ host
function randomPointInHost(padRatio=0.12){
  const r = host.getBoundingClientRect();
  const padX = r.width  * padRatio;
  const padY = r.height * padRatio;
  const x = clamp(Math.random()*(r.width  - padX*2) + padX, 0, r.width);
  const y = clamp(Math.random()*(r.height - padY*2) + padY, 0, r.height);
  return { x, y, rect:r };
}
function toDocXY(px, py, rect){ return { x: rect.left + px, y: rect.top + py }; }

// ---- Spawn loop ----
let rafId = 0;
let nextSpawnAt = 0;
let timeLeft = 60;

function startGame(){
  // reset state
  STATE.playing = true;
  STATE.stats = { perfect:0, good:0, bad:0 };
  STATE.endAt = now() + timeLeft*1000;
  STATE.freezeUntil = 0;

  // reset UI/HUD
  score.reset();
  hud.setScore(0);
  hud.setCombo('x0');
  hud.setTime(timeLeft);
  hud.setFeverProgress(0);
  hud.setQuestChips([]);
  coach.onStart();

  // แจ้ง Progress (เริ่มรัน)
  Progress.beginRun(STATE.mode, STATE.difficulty, STATE.lang);

  // init โหมด
  try { MODES[STATE.mode]?.init?.(STATE, hud, { life: 3000 }); } catch {}

  // วนเกม
  cancelAnimationFrame(rafId);
  nextSpawnAt = 0;
  loop();
}

function endGame(){
  STATE.playing = false;

  // โหมด cleanup
  try { MODES[STATE.mode]?.cleanup?.(STATE, hud); } catch {}

  // แจ้ง Progress (สรุป)
  const acc = calcAccuracy(STATE.stats);
  Progress.endRun({
    score: score.get(),
    bestCombo: score.bestCombo|0,
    timePlayed: (timeLeft>=0? (60-timeLeft):60),
    acc
  });

  // coach
  coach.onEnd(score.get());

  // แสดงผล
  showResult({
    score: score.get(),
    bestCombo: score.bestCombo|0,
    stats: { ...STATE.stats },
    acc
  });

  // ล้างที่ spawn ค้าง
  try { host.innerHTML = ''; } catch {}
}

function loop(){
  if (!STATE.playing) return;

  const t = now();

  // นับเวลา
  const remain = clamp(Math.ceil((STATE.endAt - t)/1000), 0, 999);
  if (remain !== (timeLeft|0)){
    timeLeft = remain;
    hud.setTime(timeLeft);
    if (timeLeft === 10) coach.onTimeLow();
    if (timeLeft === 0) { endGame(); return; }
  }

  // tick โหมด + power
  try { MODES[STATE.mode]?.tick?.(STATE, { sfx:window.SFX||{}, fx:engine.fx, power }, hud); } catch {}

  // freeze สำหรับสแปวน์ (จากโหมด/ลงโทษ)
  const frozen = STATE.freezeUntil && t < STATE.freezeUntil;

  // สแปวน์
  if (!frozen && (t > nextSpawnAt)){
    spawnOne();
    const baseMs = 740; // ความถี่พื้นฐาน (ปรับตาม diff/acc ได้)
    nextSpawnAt = t + baseMs;
  }

  rafId = requestAnimationFrame(loop);
}

// ความแม่นง่าย ๆ: perfect/good เทียบทั้งหมด
function calcAccuracy(st){
  const ok = (st.perfect|0)+(st.good|0);
  const all = ok + (st.bad|0);
  return all>0 ? Math.round((ok*100)/all) : 0;
}

// ---- Spawn unit (ใช้ pickMeta ของโหมด) ----
function spawnOne(){
  const mode = MODES[STATE.mode];
  if (!mode) return;

  const meta = (mode.pickMeta?.({ life:3000 }, STATE) || {
    char:'🍎', aria:'Healthy', label:'Apple', good:true, golden:false, life:3000
  });

  const { x, y, rect } = randomPointInHost(0.12);

  const el = document.createElement('button');
  el.className = 'spawn-emoji';
  el.type = 'button';
  el.setAttribute('aria-label', meta.aria || (meta.good?'Healthy':'Junk'));
  el.textContent = meta.label || meta.char || '🍎';
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;

  // ใส่ host (ในกรอบแน่)
  host.appendChild(el);

  // FX hook ตอน spawn
  try { mode.fx?.onSpawn?.(el, STATE); } catch {}

  // เพิ่ม 3D tilt ให้ไอคอน (ต้องมี perspective จาก CSS)
  try { FX.add3DTilt?.(el, { maxTilt: 14 }); } catch {}

  // อายุชิ้น
  const lifeMs = clamp(Number(meta.life)||3000, 600, 4500);
  const dieAt = now() + lifeMs;

  const click = (ev)=>{
    ev.preventDefault();
    ev.stopPropagation();

    // คิดผลตามโหมด
    let result = 'ok';
    try { result = mode.onHit?.(meta, { sfx:window.SFX||{}, fx:engine.fx, power }, STATE, hud) || 'ok'; } catch {}

    // คะแนน
    if (result === 'good'){
      score.add(10);
      STATE.stats.good++;
      coach.onGood();
    } else if (result === 'perfect'){
      score.add(15);
      STATE.stats.perfect++;
      coach.onPerfect();
      hud.setFeverProgress?.( (STATE.stats.perfect % 10) / 10 ); // ตัวอย่างแถบ Fever
    } else if (result === 'bad'){
      score.addPenalty(8);
      STATE.stats.bad++;
      hud.flashDanger();
      coach.onBad();
    } else {
      // ok = ไม่ได้ให้คะแนน/โทษ
    }

    // อัปเดต HUD ทันที
    hud.setScore(score.get());
    hud.setCombo('x' + (score.combo|0));

    // แตกกระจาย + popText
    const p = toDocXY(x, y, rect);
    try { mode.fx?.onHit?.(p.x, p.y, meta, STATE); } catch {}
    try { FX.shatter3D?.(p.x, p.y, { shards: 22, sparks: 10 }); } catch {}
    engine?.fx?.popText?.(
      result==='bad' ? '-8' : (result==='perfect'?'+15':'+10'),
      { x:p.x, y:p.y, color: result==='bad' ? '#ff9b9b' : '#7fffd4' }
    );

    cleanup();
  };

  el.addEventListener('click', click, { passive:false });

  // หมดอายุ
  const ttl = setInterval(()=>{
    if (now() >= dieAt) cleanup();
  }, 80);

  function cleanup(){
    try { clearInterval(ttl); } catch {}
    try { el.removeEventListener('click', click, { passive:false }); } catch {}
    try { el.remove(); } catch {}
  }
}

// ---- UI wiring ----
document.addEventListener('click', (e)=>{
  const b = e.target.closest('[data-action]');
  if (!b) return;

  const act = b.getAttribute('data-action');

  if (act === 'start'){
    e.preventDefault();
    document.body.classList.remove('ui-mode-menu');
    document.body.classList.add('ui-mode-play');
    startGame();
    return;
  }
  if (act === 'back-to-menu'){
    e.preventDefault();
    hideResult();
    document.body.classList.add('ui-mode-menu');
    document.body.classList.remove('ui-mode-play');
    return;
  }
  if (act === 'restart'){
    e.preventDefault();
    hideResult();
    startGame();
    return;
  }
  if (act === 'toggle-lang'){
    e.preventDefault();
    STATE.lang = (STATE.lang==='TH' ? 'EN' : 'TH');
    localStorage.setItem('hha_lang', STATE.lang);
    coach.setLang(STATE.lang);
    hud.toast(STATE.lang==='TH' ? 'ภาษาไทย' : 'English');
    return;
  }
  if (act === 'open-help' || act === 'help'){
    e.preventDefault();
    hud.toast(STATE.lang==='TH' ? 'แตะอาหารดี เก็บคะแนน! ระวังอาหารขยะ' : 'Tap healthy foods for points! Avoid junk');
    return;
  }
  if (act === 'power-x2'){
    power.apply('x2', 8);
    coach.onPower('boost');
    return;
  }
  if (act === 'power-freeze'){
    power.apply('freeze', 3);
    coach.onPower('freeze');
    return;
  }
  if (act === 'power-sweep'){
    power.apply('sweep', 2);
    hud.toast('Sweep ready');
    return;
  }
});

// เปลี่ยนโหมด
document.addEventListener('click', (e)=>{
  const m = e.target.closest('[data-mode]');
  if (!m) return;
  e.preventDefault();
  const key = m.getAttribute('data-mode');
  if (!MODES[key]) return hud.toast('Mode not ready');
  STATE.mode = key;
  document.getElementById('modeLabel')?.replaceChildren(document.createTextNode(key));
  hud.toast('Mode: ' + key);
});

// อัปเดต Power bar ทุก 300 ms
setInterval(()=>{
  const timers = power.getTimers();
  hud.setPowerTimers(timers);
}, 300);

// ---- Result modal ----
function showResult({ score, bestCombo, stats, acc }){
  if (!resultModal || !resultBody) return;
  resultBody.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div><b>Score</b><div style="font:900 26px/1 ui-rounded">${score|0}</div></div>
      <div><b>Best Combo</b><div style="font:900 26px/1 ui-rounded">x${bestCombo|0}</div></div>
      <div><b>Accuracy</b><div style="font:900 22px/1 ui-rounded">${acc|0}%</div></div>
      <div><b>Detail</b>
        <div>Perfect: ${stats.perfect|0}</div>
        <div>Good: ${stats.good|0}</div>
        <div>Bad: ${stats.bad|0}</div>
      </div>
    </div>
  `;
  resultModal.style.display = 'flex';
  resultModal.setAttribute('aria-hidden','false');
}
function hideResult(){
  if (!resultModal) return;
  resultModal.style.display = 'none';
  resultModal.setAttribute('aria-hidden','true');
}
resultModal?.addEventListener('click', (e)=>{
  if (e.target.matches('[data-modal-close]')) hideResult();
});

// ---- Resize safety: คุมเวทีกลางจอเสมอ (ถ้าสตายล์ภายนอกเปลี่ยนขนาด) ----
function recenter(){
  // ปล่อยให้ CSS เป็นตัวกลาง (flex center) — เราเพียงย้ำ pointerEvents ให้ถูก
  try {
    document.getElementById('c').style.pointerEvents = 'none';
    gameLayer.style.pointerEvents = 'auto';
  } catch {}
}
window.addEventListener('resize', recenter, { passive:true });
recenter();

// ให้ปุ่มนอกไฟล์เรียกได้ (ถ้าจำเป็น)
window.__HHA_START = startGame;
