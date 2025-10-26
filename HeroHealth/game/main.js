// === Hero Health Academy — main.js (resilient build) ===
// จุดเด่น: โหลดโมดูลแบบไดนามิก + รายงานไฟล์ที่พัง, Help Modal/Scene ตามโหมด, คอมโบ/FEVER, ไอคอนปรับตามความยาก

window.__HHA_BOOT_OK = true;

/* ---------------- Utils ---------------- */
const $  = (s)=>document.querySelector(s);
const byAction = (el)=>el?.closest?.('[data-action]') || null;
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };
function showBootError(where, err){
  const w = document.getElementById('bootWarn');
  if (!w) return;
  const msg = (err && (err.message || String(err))) || 'Unknown error';
  w.textContent = `โหลดสคริปต์ไม่สำเร็จ: ${where} • รายละเอียด: ${msg}`;
  w.style.display = 'block';
}
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

/* ---------------- Boot ---------------- */
(async function boot(){
  // core libs
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

  const { Engine }        = engRes.mod;
  const { HUD }           = hudRes.mod;
  const { SFX }           = sfxRes.mod;
  const { ScoreSystem }   = scrRes.mod;
  const { PowerUpSystem } = pwrRes.mod;
  const { Coach }         = cchRes.mod;
  const { FloatingFX }    = fxRes.mod;

  // modes (fallback if broken)
  const fallbackMode = {
    init(){}, tick(){}, cleanup(){},
    pickMeta(diff){ const chars=['🍎','🍔','🥦','🍩']; return { char: chars[(Math.random()*chars.length)|0], life: diff?.life||2500, good: Math.random()>0.4 }; },
    onHit(meta){ return meta.good ? 'good' : 'bad'; }
  };
  const gjRes = await tryImport('modes/goodjunk', './modes/goodjunk.js', { default: fallbackMode, ...fallbackMode });
  const grRes = await tryImport('modes/groups',   './modes/groups.js',   { default: fallbackMode, ...fallbackMode });
  const hyRes = await tryImport('modes/hydration','./modes/hydration.js',{ default: fallbackMode, ...fallbackMode });
  const plRes = await tryImport('modes/plate',    './modes/plate.js',    { default: fallbackMode, ...fallbackMode });

  const goodjunk = gjRes.mod.default ? gjRes.mod.default : gjRes.mod;
  const groups   = grRes.mod.default ? grRes.mod.default : grRes.mod;
  const hydration= hyRes.mod.default ? hyRes.mod.default : hyRes.mod;
  const plate    = plRes.mod.default ? plRes.mod.default : plRes.mod;

  /* -------------- Config -------------- */
  const MODES = { goodjunk, groups, hydration, plate };
  const DIFFS = {
    Easy:   { time:70, spawn:900, life:4200 },
    Normal: { time:60, spawn:700, life:3000 },
    Hard:   { time:50, spawn:550, life:1800 }
  };

  /* -------------- Systems & State -------------- */
  const hud   = new HUD();
  const sfx   = new SFX();
  const score = new ScoreSystem();
  const power = new PowerUpSystem();
  const coach = new Coach({ lang: localStorage.getItem('hha_lang') || 'TH' });
  const eng   = new Engine(THREE, document.getElementById('c'));
  const fx    = new FloatingFX(eng);

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

  /* -------------- i18n (สั้น ๆ) -------------- */
  const i18n = {
    TH:{names:{goodjunk:'ดี vs ขยะ',groups:'จาน 5 หมู่',hydration:'สมดุลน้ำ',plate:'จัดจานสุขภาพ'}, diffs:{Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'}},
    EN:{names:{goodjunk:'Good vs Trash',groups:'Food Groups',hydration:'Hydration',plate:'Healthy Plate'}, diffs:{Easy:'Easy',Normal:'Normal',Hard:'Hard'}}
  };
  const T = (lang)=>i18n[lang]||i18n.TH;

  function applyUI(){
    const t = T(state.lang);
    setText('#modeName',   t.names[state.modeKey]||state.modeKey);
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

  /* -------------- HELP TEXTS & SCENE -------------- */
  const HELP_TEXT = {
    TH: {
      goodjunk: [
        '🎯 เป้าหมาย: เก็บอาหารสุขภาพ หลีกเลี่ยงของขยะ',
        '✅ ตัวอย่างที่ถูก: 🥦 🥕 🍎 🍇',
        '❌ หลีกเลี่ยง: 🍔 🍟 🍩 🥤',
        '💡 เคล็ดลับ: ตอกต่อเนื่องเพื่อคอมโบ เปิด FEVER แล้วคะแนนคูณ'
      ],
      groups: [
        '🎯 เป้าหมาย: เก็บให้ “ตรงหมวดตามป้าย HUD”',
        '✅ ตรงเป้า +7 (ถ้ามี x2 ได้มากขึ้นอัตโนมัติ)',
        '↪️ ครบ 3 ชิ้น เป้าจะหมุนไปหมวดใหม่',
        '🧊 พาวเวอร์อัป: ✨ (Dual) • ✖️2 (Score x2) • 🧊 (Freeze) • 🔄 (Rotate)',
        '⏱️ ภารกิจ 45 วิ: ทำครบเพื่อโบนัส'
      ],
      hydration: [
        '🎯 เป้าหมาย: รักษาสมดุลน้ำ 45–65%',
        '💧 น้ำ/นม = เพิ่ม • 🥤 โซดา/น้ำหวาน & ☕ กาแฟ = ลด',
        '📈 อยู่ในช่วงเหมาะสมได้คะแนนดีกว่า',
        '⚠️ สูงหรือต่ำเกิน → โดนหัก/ลดโบนัส'
      ],
      plate: [
        '🎯 เป้าหมาย: เติมโควตา—ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1',
        '✅ เติมถูกหมวด +6 • ครบจาน PERFECT +14 และเริ่มจานใหม่',
        '❌ เกินโควตา: -2 และ -1s เวลา',
        '💡 ป้ายจะบอกหมวดที่ “ยังขาดมากสุด”'
      ]
    },
    EN: {
      goodjunk: [
        '🎯 Goal: Collect healthy foods, avoid junk.',
        '✅ Healthy: 🥦 🥕 🍎 🍇',
        '❌ Avoid: 🍔 🍟 🍩 🥤',
        '💡 Tip: Chain hits to build combo; FEVER multiplies score.'
      ],
      groups: [
        '🎯 Goal: Match the “target food group” shown on HUD.',
        '✅ On-target +7 (more if x2 active)',
        '↪️ Target rotates after every 3 on-target hits.',
        '🧊 Power-ups: ✨ (Dual) • ✖️2 (Score x2) • 🧊 (Freeze) • 🔄 (Rotate)',
        '⏱️ 45s mission: complete for bonus'
      ],
      hydration: [
        '🎯 Goal: Keep hydration between 45–65%.',
        '💧 Water/Milk = up • 🥤 Soda & ☕ Coffee = down',
        '📈 Staying in range gives better scoring.',
        '⚠️ Too high/low → penalties / reduced bonus'
      ],
      plate: [
        '🎯 Goal: Fill quotas—Grain2, Veg2, Protein1, Fruit1, Dairy1.',
        '✅ Correct fill +6 • PERFECT +14 then reset plate',
        '❌ Overfill: -2 and -1s time',
        '💡 Badge shows the most-needed group'
      ]
    }
  };

  const HELP_SCENE = {
    TH: [
      { key:'goodjunk', icon:'🥗', title:'ดี vs ขยะ',
        lines:['เก็บอาหารดี หลีกเลี่ยงของขยะ','คอมโบต่อเนื่อง → FEVER คะแนนคูณ'] },
      { key:'groups', icon:'🍽️', title:'จาน 5 หมู่',
        lines:['เก็บให้ตรงหมวดตาม HUD','พาวเวอร์อัป ✨ ✖️2 🧊 🔄 • ภารกิจ 45 วิ'] },
      { key:'hydration', icon:'💧', title:'สมดุลน้ำ',
        lines:['รักษา 45–65%','น้ำ/นมเพิ่ม • น้ำหวาน/กาแฟลด'] },
      { key:'plate', icon:'🍱', title:'จัดจานสุขภาพ',
        lines:['โควตา: ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1','PERFECT +14 • เกินโควตา -2 & -1s'] }
    ],
    EN: [
      { key:'goodjunk', icon:'🥗', title:'Good vs Junk',
        lines:['Collect healthy, avoid junk','Keep combos → FEVER (score boost)'] },
      { key:'groups', icon:'🍽️', title:'5 Food Groups',
        lines:['Match HUD target group','Power-ups ✨ ✖️2 🧊 🔄 • 45s mission'] },
      { key:'hydration', icon:'💧', title:'Hydration',
        lines:['Keep 45–65%','Water/Milk up • Soda/Coffee down'] },
      { key:'plate', icon:'🍱', title:'Healthy Plate',
        lines:['Quotas: G2 V2 P1 F1 D1','Perfect +14 • Overfill -2 & -1s'] }
    ]
  };

  function openHelpForCurrentMode(){
    const lang = state.lang === 'EN' ? 'EN' : 'TH';
    const arr = HELP_TEXT[lang][state.modeKey] || [];
    const body = document.getElementById('helpBody');
    const modal = document.getElementById('help');
    if (body) body.textContent = arr.join('\n');
    if (modal) modal.style.display = 'flex';
  }
  function openHelpScene(){
    const lang = state.lang === 'EN' ? 'EN' : 'TH';
    const data = HELP_SCENE[lang] || [];
    const host = document.getElementById('hs_body');
    const modal = document.getElementById('helpScene');
    if (!host || !modal) return;

    host.innerHTML = data.map(card=>{
      const lines = card.lines.map(l=>`<li>${l}</li>`).join('');
      return `
        <article class="hs-card" data-key="${card.key}" style="
          display:flex;flex-direction:column;gap:8px;
          padding:14px;border-radius:14px;background:rgba(255,255,255,.06);
          box-shadow:0 4px 16px rgba(0,0,0,.25);backdrop-filter:blur(6px);
        ">
          <div style="font-size:32px">${card.icon}</div>
          <h4 style="margin:0">${card.title}</h4>
          <ul style="margin:0 0 6px 18px;padding:0;line-height:1.5">${lines}</ul>
          <button type="button" class="btn" data-help-more="${card.key}">ℹ ดูวิธีเล่นโหมดนี้</button>
        </article>
      `;
    }).join('');

    host.onclick = (e)=>{
      const btn = e.target.closest('[data-help-more]');
      if (!btn) return;
      state.modeKey = btn.getAttribute('data-help-more');
      applyUI();
      openHelpForCurrentMode();
    };

    modal.style.display = 'flex';
  }
  (function wireHelpClose(){
    const hs = document.getElementById('helpScene');
    if (hs){
      hs.addEventListener('click', (e)=>{
        if (e.target.id==='helpScene' || e.target.matches('[data-action="helpSceneClose"]')){
          hs.style.display='none';
        }
      }, { passive:true });
    }
    const help = document.getElementById('help');
    if (help){
      help.addEventListener('click', (e)=>{
        if (e.target.id==='help' || e.target.matches('[data-action="helpClose"]')){
          help.style.display='none';
        }
      }, { passive:true });
    }
  })();

  /* -------------- Spawning -------------- */
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

    el.addEventListener('pointerenter', ()=>{ el.style.transform='scale(1.18)'; }, {passive:true});
    el.addEventListener('pointerleave', ()=>{ el.style.transform='scale(1)';    }, {passive:true});

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

  /* -------------- Tick / Flow -------------- */
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

  /* -------------- Events -------------- */
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
    else if (a==='help'){ openHelpForCurrentMode(); }
    else if (a==='helpClose'){ const m=$('#help'); if(m) m.style.display='none'; }
    else if (a==='helpScene'){ openHelpScene(); }
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

  // boot
  applyUI();
  updateHUD();
})();
