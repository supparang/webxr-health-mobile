// === Hero Health Academy — game/main.js (PLAYABLE, safe DOM glue) ===
import { sfx as SFX } from '../core/sfx.js';
import { Engine } from '../core/engine.js';
import { ScoreSystem } from '../core/score.js';
import { PowerUpSystem } from '../core/powerup.js';

// โหมดเกม
import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';

const MODS = { goodjunk, groups, hydration, plate };

// ---------- DOM helpers ----------
function $(sel){ return document.querySelector(sel); }
function ensureHost(){
  var gl = $('#gameLayer'); if(!gl){ gl=document.createElement('div'); gl.id='gameLayer'; gl.style.cssText='position:fixed;inset:0;z-index:2;'; document.body.appendChild(gl); }
  var sp = $('#spawnHost'); if(!sp){ sp=document.createElement('div'); sp.id='spawnHost'; sp.style.cssText='position:fixed;inset:0;z-index:5;pointer-events:auto;'; document.body.appendChild(sp); }
}
function setMenu(show){ var mb=$('#menuBar'); if(mb){ mb.style.display = show?'flex':'none'; } }

// ---------- Engine + SFX ----------
const engine = new Engine();
engine.sfx = SFX;
SFX.loadIds(['sfx-good','sfx-bad','sfx-perfect','sfx-tick','sfx-powerup']);

// ---------- Score & Power ----------
const score = new ScoreSystem();
const power = new PowerUpSystem();
power.onChange(updatePowerBar);
power.attachToScore(score);

// ---------- Power bar UI ----------
function updatePowerBar() {
  var fill = $('#powerFill');
  if(!fill) return;
  // กำหนดเปอร์เซ็นต์แบบง่าย: เวลาพลังรวม (x2/freeze/sweep/shield) สูง = ไฟยาว
  var t = power.getCombinedTimers(); // {x2,freeze,sweep,shield,shieldCount}
  var sum = (t.x2|0) + (t.freeze|0) + (t.sweep|0) + (t.shield|0) + (t.shieldCount|0)*2;
  var pct = Math.max(0, Math.min(100, sum*8)); // ปรับสเกลให้เห็นชัด
  fill.style.width = String(pct) + '%';
}

// ---------- Game state ----------
let cur = { modeKey: 'goodjunk', diff: 'Normal' };
let loopId = 0, lastTs = 0;
let active = null; // { api:{start,update,stop}, bus:{...} }
let frozenMsLeft = 0;

// ---------- Bus (เชื่อมโหมด → ระบบกลาง) ----------
function makeBus(){
  return {
    hit: function(payload){
      // payload: { kind:'good'|'perfect'|'golden', points, ui:{x,y}, meta? }
      var kind = String(payload && payload.kind || 'good');
      // map เป็นคะแนนตาม ScoreSystem (ใช้ addKind เพื่อคอมโบ/fever-compatible)
      score.addKind(kind, { ui:payload.ui, meta:payload.meta });
      // SFX
      try {
        if (kind==='bad') engine.sfx.bad();
        else if (kind==='perfect' || kind==='golden') engine.sfx.perfect();
        else engine.sfx.good();
      } catch {}
    },
    miss: function(){
      score.addKind('bad', {});
      try { engine.sfx.bad(); } catch {}
      // ถ้ามี shield → กันโดนครั้งเดียว
      if (power.hasShield()) power.consumeShield();
    },
    power: function(kind){
      power.apply(kind);
      try { engine.sfx.power(); } catch {}
      // บาง power มีผลพิเศษ
      if (kind==='freeze'){ frozenMsLeft = Math.max(frozenMsLeft, 2500); } // หยุดเวลา spawn ชั่วคราว
      if (kind==='sweep'){
        // เคลียร์ออบเจ็กต์ค้างหน้าจอ (ถ้าปุ่มเป็น emoji ที่ class=spawn-emoji)
        try{
          var nodes = document.querySelectorAll('.spawn-emoji');
          for (var i=0;i<nodes.length;i++){ if(nodes[i] && nodes[i].remove) nodes[i].remove(); }
        }catch{}
      }
      updatePowerBar();
    }
  };
}

// ---------- Start/Stop ----------
function startGame(modeKey, diff){
  ensureHost();
  stopGame();

  var mod = MODS[modeKey];
  if(!mod){ alert('Mode not found: '+modeKey); return; }

  // บันทึกสถานะ
  cur.modeKey = modeKey;
  cur.diff = diff;

  // แจ้งโหมดให้ทราบระดับความยากผ่าน body attr (บางไฟล์โหมดอ่าน attr นี้)
  try { document.body.setAttribute('data-diff', diff); } catch {}

  // เตรียม bus
  var bus = makeBus();

  // เตรียม API โหมด (รองรับทั้งรูปแบบ create(ctx) และ start/update/stop ตรง ๆ)
  var api = null;
  try {
    if (typeof mod.create === 'function') {
      var ctx = { engine: engine, hud: null, coach: null };
      api = mod.create(ctx);
    }
  }catch{}
  if (!api) {
    // ฟอลแบ็กใช้ฟังก์ชันส่งออกโดยตรง
    api = {
      start: function(){ try{ mod.start({ difficulty: diff }); }catch{} },
      update: function(dt,b){ try{ mod.update(dt,b); }catch{} },
      stop: function(){ try{ mod.stop(); }catch{} }
    };
  }

  // รีเซ็ตระบบคะแนนและพาวเวอร์
  score.reset();
  power.dispose();
  power.onChange(updatePowerBar);
  power.attachToScore(score);
  updatePowerBar();

  // ซ่อนเมนูและเริ่มโหมด
  setMenu(false);
  try { api.start(); } catch {}

  // เริ่มลูป
  active = { api: api, bus: bus };
  lastTs = performance.now ? performance.now() : Date.now();
  loopId = requestAnimationFrame(tick);
}

function stopGame(){
  if (loopId) { cancelAnimationFrame(loopId); loopId = 0; }
  if (active && active.api && typeof active.api.stop === 'function') {
    try { active.api.stop(); } catch {}
  }
  active = null;
  // ลบออบเจ็กต์ตกค้าง
  try{
    var nodes = document.querySelectorAll('.spawn-emoji');
    for (var i=0;i<nodes.length;i++){ if(nodes[i] && nodes[i].remove) nodes[i].remove(); }
  }catch{}
}

// ---------- Loop ----------
function tick(ts){
  var now = ts || (performance.now ? performance.now() : Date.now());
  var dt = (now - lastTs) / 1000;
  lastTs = now;

  // จัดการ freeze (หยุดเวลาอัปเดตชั่วคราว)
  if (frozenMsLeft > 0){
    frozenMsLeft -= (dt*1000)|0;
  } else {
    if (active && active.api && typeof active.api.update === 'function'){
      try { active.api.update(dt, active.bus); } catch {}
    }
  }

  loopId = requestAnimationFrame(tick);
}

// ---------- Menu bindings (คลิกให้ติดแน่) ----------
(function bindMenu(){
  var mb = $('#menuBar');
  if (!mb) return;

  function onHit(ev){
    var t = ev.target;
    while(t && t !== mb){
      if (t.hasAttribute && t.hasAttribute('data-mode')) { cur.modeKey = t.getAttribute('data-mode'); return; }
      if (t.hasAttribute && t.hasAttribute('data-diff')) { cur.diff = t.getAttribute('data-diff'); return; }
      if (t.hasAttribute && t.getAttribute('data-action') === 'start') { startGame(cur.modeKey, cur.diff); return; }
      if (t.hasAttribute && t.getAttribute('data-action') === 'howto') {
        alert('วิธีเล่น: แตะของดี หลีกเลี่ยงของไม่ดี • โหมด Hydration รักษา 45–65% • Plate และ Groups เลือกให้ถูกหมวด');
        return;
      }
      t = t.parentNode;
    }
  }
  ['click','touchend','pointerup'].forEach(function(e){
    try { mb.addEventListener(e, onHit, { passive:true }); } catch {}
  });
})();

// ---------- Public (ถ้าต้องการเรียกจาก index เดิม) ----------
try {
  window.hha_start   = function(){ startGame(cur.modeKey, cur.diff); };
  window.hha_setMode = function(m){ cur.modeKey = m; };
  window.hha_setDiff = function(d){ cur.diff = d; };
} catch {}

// ---------- Boot ----------
(function boot(){
  // ปลดล็อกเสียงหลัง gesture แรก (สคริปต์ sfx.js จัดการให้ส่วนใหญ่)
  try {
    window.addEventListener('pointerdown', function once(){ try{ SFX.unlock && SFX.unlock(); }catch{} window.removeEventListener('pointerdown', once); }, { passive:true, once:true });
  } catch {}
  ensureHost();
  setMenu(true);
  updatePowerBar();
})();
