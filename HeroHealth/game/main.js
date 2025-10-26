// === Hero Health Academy — main.js (resilient build) ===
// จุดเด่น: โหลดโมดูลแบบไดนามิก + รายงานไฟล์ที่พัง, มี fallback ให้เกมยังรันได้

window.__HHA_BOOT_OK = true;

// ----- utils -----
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const byAction = (el)=>el?.closest?.('[data-action]') || null;
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

// แสดงชื่อไฟล์ที่ import พังบนแถบแดง bootWarn
function showBootError(where, err){
  const w = document.getElementById('bootWarn');
  if (!w) return;
  const msg = (err && (err.message || String(err))) || 'Unknown error';
  w.textContent = `โหลดสคริปต์ไม่สำเร็จ: ${where} • รายละเอียด: ${msg}`;
  w.style.display = 'block';
}

// ----- dynamic loader with labels -----
async function tryImport(label, path, fallback){
  try{
    const mod = await import(path + (path.includes('?')?'&':'?') + 'cb=' + Date.now());
    return { ok:true, mod };
  }catch(e){
    console.warn('[HHA] import fail:', label, path, e);
    showBootError(`${label} (${path})`, e);
    return { ok:false, mod:fallback };
  }
}

(async function boot(){
  // ===== core (จำเป็น) =====
  // THREE เป็น ES module CDN — ใช้ static import จะชัวร์กว่า แต่เพื่อความเสมอกัน ใช้ dynamic เช่นกัน
  const threeRes = await tryImport('THREE', 'https://unpkg.com/three@0.159.0/build/three.module.js', null);
  if(!threeRes.ok){ return; }
  const THREE = threeRes.mod;

  const engRes  = await tryImport('core/engine', './core/engine.js', { Engine: class { constructor(){ this.renderer={ setPixelRatio(){} }; } }});
  const hudRes  = await tryImport('core/hud',    './core/hud.js',    { HUD: class{ setScore(){} setTime(){} setCombo(){} setFeverProgress(){} showHydration(){} hideHydration(){} hideTarget(){} showTarget(){} hidePills(){} showPills(){} setTargetBadge(){} }});
  const sfxRes  = await tryImport('core/sfx',    './core/sfx.js',    { SFX: class{ constructor(){ this.enabled=true; } setEnabled(){} unlock(){} play(){} good(){} bad(){} }});
  const scrRes  = await tryImport('core/score',  './core/score.js',  { ScoreSystem: class{ constructor(){ this.score=0; this.combo=0; } reset(){ this.score=0; this.combo=0; } add(n){ this.score+=n|0; } setBoostFn(){} setHandlers(){} }});
  const pwrRes  = await tryImport('core/powerup','./core/powerup.js',{ PowerUpSystem: class{ constructor(){ this.timeScale=1; this.scoreBoost=0; } apply(kind){ if(kind==='boost'){ this.scoreBoost= Math.round((this.scoreBoost||0)+7); setTimeout(()=>this.scoreBoost=0,7000);} } }});
  const cchRes  = await tryImport('core/coach',  './core/coach.js',  { Coach: class{ constructor(o){ this.lang=o?.lang||'TH'; } onStart(){} onEnd(){} onCombo(){} onFever(){} say(){} setLang(l){this.lang=l;} }});
  const fxRes   = await tryImport('core/fx',     './core/fx.js',     { FloatingFX: class{ popText(){} spawn3D(){} }});

  const { Engine }       = engRes.mod;
  const { HUD }          = hudRes.mod;
  const { SFX }          = sfxRes.mod;
  const { ScoreSystem }  = scrRes.mod;
  const { PowerUpSystem }= pwrRes.mod;
  const { Coach }        = cchRes.mod;
  const { FloatingFX }   = fxRes.mod;

  // ===== modes (ถ้าไฟล์ไหนพัง จะใช้ fallback ที่เรียบง่ายแทน) =====
  const fallbackMode = {
    init(){}, tick(){}, cleanup(){},
    pickMeta(diff){ const chars=['🍎','🍔','🥦','🍩']; return { char: chars[(Math.random()*chars.length)|0], life: diff?.life||2500, good: Math.random()>0.4 }; },
    onHit(meta){ return meta.good ? 'good' : 'bad'; }
  };
  const gjRes = await tryImport('modes/goodjunk', './modes/goodjunk.js', { default: fallbackMode, ...fallbackMode });
  const grRes = await tryImport('modes/groups',   './modes/groups.js',   { default: fallbackMode, ...fallbackMode });
  const hyRes = await tryImport('modes/hydration','./modes/hydration.js',{ default: fallbackMode, ...fallbackMode });
  const plRes = await tryImport('modes/plate',    './modes/plate.js',    { default: fallbackMode, ...fallbackMode });

  // normalize export style (บางไฟล์อาจ export เป็นค่าเริ่มต้น)
  const goodjunk = gjRes.mod.default ? gjRes.mod.default : gjRes.mod;
  const groups   = grRes.mod.default ? grRes.mod.default : grRes.mod;
  const hydration= hyRes.mod.default ? hyRes.mod.default : hyRes.mod;
  const plate    = plRes.mod.default ? plRes.mod.default : plRes.mod;

  // ===== Config =====
  const MODES = { goodjunk, groups, hydration, plate };
  const DIFFS = {
    Easy:   { time:70, spawn:900, life:4200 },
    Normal: { time:60, spawn:700, life:3000 },
    Hard:   { time:50, spawn:550, life:1800 }
  };

  // ===== Systems & State =====
  const hud = new HUD();
  const sfx = new SFX();
  const score = new ScoreSystem();
  const power = new PowerUpSystem();
  const coach = new Coach({ lang: localStorage.getItem('hha_lang') || 'TH' });
  const eng = new Engine(THREE, document.getElementById('c'));
  const fx  = new FloatingFX(eng);

  const state = {
    modeKey:'goodjunk',
    difficulty:'Normal',
    running:false,
    paused:false,
    timeLeft:60,
    lang: localStorage.getItem('hha_lang') || 'TH',
    gfx:  localStorage.getItem('hha_gfx') || 'quality',
    fever:{ active:false, meter:0, drainPerSec:14, chargePerGood:10, chargePerPerfect:20, threshold:100, mul:2, timeLeft:0 },
    combo:0, bestCombo:0,
    ctx:{},
    spawnTimer:0, tickTimer:0
  };

  // ===== UI helpers & i18n (สั้น ๆ) =====
  const i18n = {
    TH:{names:{goodjunk:'ดี vs ขยะ',groups:'จาน 5 หมู่',hydration:'สมดุลน้ำ',plate:'จัดจานสุขภาพ'}, diffs:{Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'}},
    EN:{names:{goodjunk:'Good vs Trash',groups:'Food Groups',hydration:'Hydration',plate:'Healthy Plate'}, diffs:{Easy:'Easy',Normal:'Normal',Hard:'Hard'}}
  };
  const T = (lang)=>i18n[lang]||i18n.TH;

  function applyUI(){
    const t = T(state.lang);
    setText('#modeName', t.names[state.modeKey]||state.modeKey);
    setText('#difficulty', t.diffs[state.difficulty]||state.difficulty);
  }
  function updateHUD(){
    hud.setScore?.(score.score);
    hud.setTime?.(state.timeLeft);
    hud.setCombo?.('x'+state.combo);
  }
  function setFeverBar(pct){ const bar = $('#feverBar'); if(bar) bar.style.width = Math.max(0,Math.min(100,pct))+'%'; }
  function showFeverLabel(show){ const f=$('#fever'); if(f){ f.style.display=show?'block':'none'; f.classList.toggle('pulse',!!show);} }
  function startFever(){ if(state.fever.active) return; state.fever.active=true; state.fever.timeLeft=7; showFeverLabel(true); try{$('#sfx-powerup')?.play();}catch{} }
  function stopFever(){ state.fever.active=false; state.fever.timeLeft=0; showFeverLabel(false); }
  function addCombo(kind){
    if(kind==='bad'){ state.combo=0; hud.setCombo?.('x0'); return; }
    if(kind==='good'||kind==='perfect'){
      state.combo++; state.bestCombo=Math.max(state.bestCombo,state.combo); hud.setCombo?.('x'+state.combo);
      if(!state.fever.active){
        state.fever.meter = Math.min(100, state.fever.meter + (kind==='perfect'?state.fever.chargePerPerfect:state.fever.chargePerGood));
        setFeverBar(state.fever.meter);
        if (state.fever.meter >= state.fever.threshold) startFever();
      }else{
        state.fever.timeLeft = Math.min(10, state.fever.timeLeft + 0.6);
      }
    }
  }
  function scoreWithEffects(base, x, y){
    const comboMul = state.combo>=20?1.4: state.combo>=10?1.2: 1.0;
    const feverMul = state.fever.active?state.fever.mul:1.0;
    const total = Math.round(base * comboMul * feverMul);
    score.add?.(total);
    fx.popText?.((total>=0?`+${total}`:`${total}`), { color: total>=0?'#7fffd4':'#ff9b9b' });
  }

  // ===== gameplay loops =====
  function spawnOnce(diff){
    if(!state.running || state.paused) return;
    const mode = MODES[state.modeKey];
    const meta = mode?.pickMeta?.(diff, state) || {};

    const el = document.createElement('button');
    el.className='item'; el.type='button';
    el.textContent = meta.char || '❓';
    const sizeMap = { Easy:'88px', Normal:'68px', Hard:'54px' };
    el.style.fontSize = sizeMap[state.difficulty] || '68px';
    el.style.position='fixed'; el.style.border='none'; el.style.background='none'; el.style.cursor='pointer';
    el.style.lineHeight=1; el.style.transition='transform .15s, filter .15s'; el.style.zIndex='80';

    el.addEventListener('pointerenter', ()=> el.style.transform='scale(1.18)', {passive:true});
    el.addEventListener('pointerleave', ()=> el.style.transform='scale(1)',   {passive:true});

    const headerH = $('header.brand')?.offsetHeight || 56;
    const menuH   = $('#menuBar')?.offsetHeight || 120;
    const yMin = headerH + 60, yMax = Math.max(yMin+50, innerHeight - menuH - 80);
    const xMin = 20,        xMax = Math.max(xMin+50, innerWidth - 80);
    el.style.left = (xMin + Math.random()*(xMax-xMin)) + 'px';
    el.style.top  = (yMin + Math.random()*(yMax-yMin)) + 'px';

    el.addEventListener('click',(ev)=>{
      ev.stopPropagation();
      try{
        const sys = { score, sfx, power, coach, fx };
        const res = mode?.onHit?.(meta, sys, state, hud) || (meta.good?'good':'ok');

        const r = el.getBoundingClientRect();
        if (res==='good' || res==='perfect') addCombo(res);
        if (res==='bad') addCombo('bad');

        const base = { good:7, perfect:14, ok:2, bad:-3, power:5 }[res] ?? 1;
        scoreWithEffects(base, r.left+r.width/2, r.top+r.height/2);
      }catch(e){ console.error('[HHA] onHit:', e); }
      finally{ el.remove(); }
    }, {passive:true});

    document.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch{} }, meta.life || diff.life || 3000);
  }

  function spawnLoop(){
    if(!state.running || state.paused) return;
    const diff = DIFFS[state.difficulty] || DIFFS.Normal;
    spawnOnce(diff);
    const next = Math.max(220, (diff.spawn || 700) * (power.timeScale || 1));
    state.spawnTimer = setTimeout(spawnLoop, next);
  }

  function tick(){
    if(!state.running || state.paused) return;

    if (state.fever.active){
      state.fever.timeLeft = Math.max(0, state.fever.timeLeft - 1);
      state.fever.meter = Math.max(0, state.fever.meter - state.fever.drainPerSec);
      setFeverBar(state.fever.meter);
      if (state.fever.timeLeft<=0 || state.fever.meter<=0) stopFever();
    }

    try{ MODES[state.modeKey]?.tick?.(state, {score,sfx,power,coach,fx}, hud); }catch(e){ console.warn('[HHA] mode.tick:', e); }

    state.timeLeft = Math.max(0, state.timeLeft - 1);
    updateHUD();

    if (state.timeLeft <= 0){ end(); return; }
    if (state.timeLeft <= 10){ try{ $('#sfx-tick')?.play(); }catch{} }
    state.tickTimer = setTimeout(tick, 1000);
  }

  function start(){
    end(true);
    const diff = DIFFS[state.difficulty] || DIFFS.Normal;
    state.running = true; state.paused=false;
    state.timeLeft = diff.time;
    state.combo=0; state.fever.meter=0; setFeverBar(0); stopFever();
    score.reset?.(); updateHUD();
    try{ MODES[state.modeKey]?.init?.(state, hud, diff); }catch(e){ console.error('[HHA] init:', e); }
    tick(); spawnLoop();
  }

  function end(silent=false){
    state.running=false; state.paused=false;
    clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
    try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}
    if(!silent){ const m=$('#result'); if(m) m.style.display='flex'; }
  }

  // ===== events =====
  document.addEventListener('pointerup', (e)=>{
    const btn = byAction(e.target); if(!btn) return;
    const a = btn.getAttribute('data-action');
    const v = btn.getAttribute('data-value');

    if (a==='mode'){ state.modeKey=v; applyUI(); if(state.running) start(); }
    else if (a==='diff'){ state.difficulty=v; applyUI(); if(state.running) start(); }
    else if (a==='start'){ start(); }
    else if (a==='pause'){
      if(!state.running){ start(); return; }
      state.paused = !state.paused;
      if (!state.paused){ tick(); spawnLoop(); }
      else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); }
    }
    else if (a==='restart'){ end(true); start(); }
    else if (a==='help'){ const m=$('#help'); if(m) m.style.display='flex'; }
    else if (a==='helpClose'){ const m=$('#help'); if(m) m.style.display='none'; }
    else if (a==='helpScene'){ const m=$('#helpScene'); if(m) m.style.display='flex'; }
    else if (a==='helpSceneClose'){ const m=$('#helpScene'); if(m) m.style.display='none'; }
  }, {passive:true});

  $('#langToggle')?.addEventListener('click', ()=>{
    state.lang = state.lang==='TH' ? 'EN' : 'TH';
    localStorage.setItem('hha_lang', state.lang);
    coach.setLang?.(state.lang);
    applyUI();
  }, {passive:true});

  $('#gfxToggle')?.addEventListener('click', ()=>{
    state.gfx = state.gfx==='low' ? 'quality' : 'low';
    localStorage.setItem('hha_gfx', state.gfx);
    try{ eng.renderer?.setPixelRatio?.(state.gfx==='low'?0.75:(window.devicePixelRatio||1)); }catch{}
  }, {passive:true});

  window.addEventListener('pointerdown', ()=>{ try{ (new SFX()).unlock?.(); }catch{} }, { once:true, passive:true });

  // ===== boot =====
  applyUI();
  updateHUD();
})();
