// === Hero Health Academy — main.js (diagnostic-safe) ===
// - ปักธงบูต
// - แสดงชิป "✅ JS Loaded (smoke)" มุมขวาล่างให้เห็นแน่ๆ
// - โหลดโมดูลแบบ try/catch และรายงานว่าไฟล์ไหนพัง
// - ถ้าโหลดได้ครบ ค่อยสตาร์ตเกม (spawn ของเด้งให้คลิก)

window.__HHA_BOOT_OK = true;

// ---------- DOM helpers ----------
const $ = (s)=>document.querySelector(s);
function showBootError(what, err) {
  let w = document.getElementById('bootWarn');
  if (!w) {
    w = document.createElement('div');
    w.id = 'bootWarn';
    w.style.cssText = "position:fixed;top:0;left:0;right:0;background:#b00020;color:#fff;padding:10px 12px;font-weight:700;z-index:1000;";
    document.body.appendChild(w);
  }
  const msg = err && (err.message || String(err)) || "Unknown error";
  w.textContent = "โหลดสคริปต์ไม่สำเร็จ: " + what + " • รายละเอียด: " + msg;
  w.style.display = 'block';
}
function hideBootError() {
  const w = document.getElementById('bootWarn');
  if (w) w.style.display = 'none';
}
function showLoadedChip(text) {
  const chip = document.createElement('div');
  chip.textContent = text || "✅ JS Loaded (smoke)";
  chip.style.cssText = "position:fixed;right:12px;bottom:12px;background:#0b8043;color:#fff;padding:8px 12px;border-radius:16px;font:14px/1.2 system-ui,sans-serif;z-index:1000;box-shadow:0 2px 8px rgba(0,0,0,.25)";
  chip.id = 'jsLoadedChip';
  document.body.appendChild(chip);
}

// ---------- smoke: แสดงชิปว่าไฟล์นี้ “รันได้จริง” ----------
showLoadedChip("✅ JS Loaded (smoke)");

// ---------- dynamic import wrapper ----------
async function tryImport(label, url) {
  try {
    // กัน cache
    const withBust = url + (url.includes('?') ? '&' : '?') + 'cb=' + Date.now();
    const mod = await import(withBust);
    return { ok:true, mod };
  } catch (e) {
    showBootError(label + " (" + url + ")", e);
    return { ok:false, mod:null, err:e };
  }
}

// ---------- main boot ----------
(async function main() {
  // 1) ลองโหลด THREE ก่อน
  const threeRes = await tryImport("THREE", "https://unpkg.com/three@0.159.0/build/three.module.js");
  if (!threeRes.ok) return;
  const THREE = threeRes.mod;

  // 2) โหลด core ทั้งหมด
  const engRes = await tryImport("core/engine.js", "./core/engine.js");
  const hudRes = await tryImport("core/hud.js", "./core/hud.js");
  const sfxRes = await tryImport("core/sfx.js", "./core/sfx.js");
  const scoreRes = await tryImport("core/score.js", "./core/score.js");
  const powerRes = await tryImport("core/powerup.js", "./core/powerup.js");
  // หมายเหตุ: Coach/FX/อื่นๆ ใส่เพิ่มทีหลังได้ แต่ตอนนี้ขอ minimal ให้เกมเด้งก่อน

  if (!engRes.ok || !hudRes.ok || !sfxRes.ok || !scoreRes.ok || !powerRes.ok) return;

  const { Engine } = engRes.mod;
  const { HUD } = hudRes.mod;
  const { SFX } = sfxRes.mod;
  const { ScoreSystem } = scoreRes.mod;
  const { PowerUpSystem } = powerRes.mod;

  // 3) โหลดโหมด (ถ้าโหมดไหนพัง จะแทนด้วย fallback mode)
  const fallbackMode = {
    init(){},
    tick(){},
    cleanup(){},
    pickMeta(diff){ 
      const list = ["🍎","🥦","🍔","🍩"];
      return { char:list[(Math.random()*list.length)|0], life: diff?.life || 2500, good: Math.random() > 0.4 };
    },
    onHit(meta){ return meta.good ? "good" : "bad"; }
  };

  async function loadMode(label, url) {
    const res = await tryImport(label, url);
    if (!res.ok) return fallbackMode;
    return res.mod && res.mod.default ? res.mod.default : res.mod;
  }

  const goodjunk = await loadMode("modes/goodjunk.js", "./modes/goodjunk.js");
  const groups   = await loadMode("modes/groups.js", "./modes/groups.js");
  const hydration= await loadMode("modes/hydration.js", "./modes/hydration.js");
  const plate    = await loadMode("modes/plate.js", "./modes/plate.js");

  // ถ้าถึงจุดนี้ แสดงว่า module หลักโหลดได้ → ซ่อนแถบแดง (ถ้ามี)
  hideBootError();

  // ---------- systems & state ----------
  const MODES = { goodjunk, groups, hydration, plate };
  const DIFFS = {
    Easy:   { time:70, spawn:900, life:4200 },
    Normal: { time:60, spawn:700, life:3000 },
    Hard:   { time:50, spawn:550, life:1800 }
  };
  const ICON_SIZE_MAP = { Easy:92, Normal:72, Hard:58 };

  const hud   = new HUD();
  const sfx   = new SFX();
  const score = new ScoreSystem();
  const power = new PowerUpSystem();
  const eng   = new Engine(THREE, document.getElementById('c'));

  const state = {
    modeKey: 'goodjunk',
    difficulty: 'Normal',
    running: false,
    paused: false,
    timeLeft: 60,
    combo: 0,
    fever: { active:false, meter:0, drainPerSec:14, chargeGood:10, chargePerfect:20, threshold:100, mul:2, timeLeft:0 },
    ctx: {},
    spawnTimer: 0,
    tickTimer: 0
  };

  function setText(sel, txt){ const el = document.querySelector(sel); if (el) el.textContent = txt; }
  function applyUI(){
    const names = { goodjunk:"ดี vs ขยะ", groups:"จาน 5 หมู่", hydration:"สมดุลน้ำ", plate:"จัดจานสุขภาพ" };
    const diffs = { Easy:"ง่าย", Normal:"ปกติ", Hard:"ยาก" };
    setText('#modeName', names[state.modeKey] || state.modeKey);
    setText('#difficulty', diffs[state.difficulty] || state.difficulty);
  }
  function updateHUD(){
    hud.setScore?.(score.score);
    hud.setTime?.(state.timeLeft);
    hud.setCombo?.("x" + state.combo);
  }
  function setFeverBar(pct){
    const bar = document.getElementById('feverBar');
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct|0)) + '%';
  }
  function showFeverLabel(show){
    const f = document.getElementById('fever');
    if (f){ f.style.display = show ? 'block' : 'none'; if (show){ f.classList.add('pulse'); } else { f.classList.remove('pulse'); } }
  }
  function startFever(){ if(state.fever.active) return; state.fever.active=true; state.fever.timeLeft=7; showFeverLabel(true); try{ document.getElementById('sfx-powerup')?.play(); }catch{} }
  function stopFever(){ state.fever.active=false; state.fever.timeLeft=0; showFeverLabel(false); }

  function addCombo(kind){
    if (kind === 'bad'){ state.combo = 0; hud.setCombo?.('x0'); return; }
    if (kind === 'good' || kind === 'perfect'){
      state.combo++;
      hud.setCombo?.('x' + state.combo);
      if (!state.fever.active){
        state.fever.meter = Math.min(100, state.fever.meter + (kind==='perfect'?state.fever.chargePerfect:state.fever.chargeGood));
        setFeverBar(state.fever.meter);
        if (state.fever.meter >= state.fever.threshold) startFever();
      } else {
        state.fever.timeLeft = Math.min(10, state.fever.timeLeft + 0.6);
      }
    }
  }

  function popupScore(x, y, text, color){
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = "position:fixed;left:"+x+"px;top:"+y+"px;color:"+ (color||'#7fffd4') +";font:700 18px/1.2 system-ui,sans-serif;transform:translate(-50%,-50%);z-index:120;pointer-events:none;transition:.9s;opacity:1";
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.transform += " translateY(-24px)"; el.style.opacity = "0"; });
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 900);
  }

  function scoreWithEffects(base, x, y){
    const comboMul = state.combo >= 20 ? 1.4 : (state.combo >= 10 ? 1.2 : 1.0);
    const feverMul = state.fever.active ? state.fever.mul : 1.0;
    const total = Math.round(base * comboMul * feverMul);
    score.add?.(total);
    const tag = total >= 0 ? "+"+total : ""+total;
    const color = total >= 0 ? (feverMul>1 ? "#ffd54a" : "#7fffd4") : "#ff9b9b";
    popupScore(x, y, tag, color);
  }

  function spawnOnce(diff){
    if (!state.running || state.paused) return;
    const mode = MODES[state.modeKey];
    const meta = mode && mode.pickMeta ? (mode.pickMeta(diff, state) || {}) : {};
    const el = document.createElement('button');
    el.className = 'item';
    el.type = 'button';
    el.textContent = meta.char || '❓';

    const px = ({ Easy:92, Normal:72, Hard:58 })[state.difficulty] || 72;
    el.style.cssText = "position:fixed;border:none;background:transparent;color:#fff;line-height:1;cursor:pointer;z-index:80;transition:transform .15s,filter .15s,opacity .15s;font-size:"+px+"px";
    el.addEventListener('pointerenter', ()=> el.style.transform='scale(1.12)', { passive:true });
    el.addEventListener('pointerleave', ()=> el.style.transform='scale(1)',   { passive:true });

    const headerH = (document.querySelector('header.brand')?.offsetHeight) || 56;
    const menuH   = (document.getElementById('menuBar')?.offsetHeight) || 120;
    const yMin = headerH + 60;
    const yMax = Math.max(yMin + 50, window.innerHeight - menuH - 80);
    const xMin = 20;
    const xMax = Math.max(xMin + 50, window.innerWidth - 80);
    el.style.left = (xMin + Math.random()*(xMax-xMin)) + 'px';
    el.style.top  = (yMin + Math.random()*(yMax-yMin)) + 'px';

    el.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      try{
        const sys = { score, sfx, power };
        const res = mode && mode.onHit ? (mode.onHit(meta, sys, state, hud) || 'ok') : (meta.good ? 'good' : 'ok');
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width/2;
        const cy = r.top  + r.height/2;

        if (res==='good' || res==='perfect') addCombo(res);
        if (res==='bad') addCombo('bad');

        const base = ({ good:7, perfect:14, ok:2, bad:-3, power:5 })[res] || 1;
        scoreWithEffects(base, cx, cy);

        if (res==='good'){ try{ sfx.good(); }catch{} }
        else if (res==='bad'){ try{ sfx.bad(); }catch{} }
      }catch(e){ console.error('[HHA] onHit error:', e); }
      finally { try{ el.remove(); }catch{} }
    }, { passive:true });

    document.body.appendChild(el);
    const ttl = meta.life || diff.life || 3000;
    setTimeout(()=>{ try{ el.remove(); }catch{} }, ttl);
  }

  function spawnLoop(){
    if (!state.running || state.paused) return;
    const diff = DIFFS[state.difficulty] || DIFFS.Normal;
    spawnOnce(diff);
    const next = Math.max(220, (diff.spawn || 700) * (power.timeScale || 1));
    state.spawnTimer = setTimeout(spawnLoop, next);
  }

  function tick(){
    if (!state.running || state.paused) return;
    // fever drain
    if (state.fever.active){
      state.fever.timeLeft = Math.max(0, state.fever.timeLeft - 1);
      state.fever.meter = Math.max(0, state.fever.meter - state.fever.drainPerSec);
      setFeverBar(state.fever.meter);
      if (state.fever.timeLeft<=0 || state.fever.meter<=0) stopFever();
    }
    // per-mode
    try{ MODES[state.modeKey]?.tick?.(state, { score, sfx, power }, hud); }catch(e){ console.warn('[HHA] mode.tick error:', e); }
    state.timeLeft = Math.max(0, state.timeLeft - 1);
    updateHUD();
    if (state.timeLeft <= 0){ end(); return; }
    if (state.timeLeft <= 10){ try{ document.getElementById('sfx-tick')?.play(); }catch{} }
    state.tickTimer = setTimeout(tick, 1000);
  }

  function start(){
    end(true);
    const diff = DIFFS[state.difficulty] || DIFFS.Normal;
    state.running = true; state.paused = false;
    state.timeLeft = diff.time;
    state.combo = 0; state.fever.meter = 0; setFeverBar(0); stopFever();
    score.reset?.(); updateHUD();

    try{ MODES[state.modeKey]?.init?.(state, hud, diff); }catch(e){ console.error('[HHA] mode.init error:', e); }

    tick(); spawnLoop();
  }

  function end(silent){
    if (silent !== true) silent = false;
    state.running = false; state.paused=false;
    clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
    try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}
    if (!silent){ const m = document.getElementById('result'); if (m) m.style.display='flex'; }
  }

  // events
  document.addEventListener('pointerup', (e)=>{
    const btn = e.target.closest?.('[data-action]');
    if (!btn) return;
    const a = btn.getAttribute('data-action');
    const v = btn.getAttribute('data-value');

    if (a==='mode'){ state.modeKey=v; applyUI(); if(state.running) start(); }
    else if (a==='diff'){ state.difficulty=v; applyUI(); if(state.running) start(); }
    else if (a==='start'){ start(); }
    else if (a==='pause'){
      if (!state.running){ start(); return; }
      state.paused = !state.paused;
      if (!state.paused){ tick(); spawnLoop(); }
      else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); }
    }
    else if (a==='restart'){ end(true); start(); }
    else if (a==='help'){ const m=document.getElementById('help'); if(m) m.style.display='flex'; }
    else if (a==='helpClose'){ const m=document.getElementById('help'); if(m) m.style.display='none'; }
  }, { passive:true });

  // boot UI
  applyUI();
  updateHUD();
})();
