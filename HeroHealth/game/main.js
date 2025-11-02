// === Hero Health Academy — game/main.js (production; timer/combo/fever/pause/result/stars) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function(){
  // ---------- DOM helpers ----------
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  // ---------- Safe stubs (replaced by dynamic imports if present) ----------
  let HUDClass, CoachClass, Quests, Progress, SFXClass;

  async function loadCore(){
    try { ({ HUD: HUDClass } = await import('../core/hud.js')); } catch{
      // ultra-minimal HUD fallback
      HUDClass = class {
        constructor(){
          this.root = $('#hud') || Object.assign(document.createElement('div'),{id:'hud'});
          if(!$('#hud')){ this.root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2000'; document.body.appendChild(this.root); }
          const top=document.createElement('div');
          top.style.cssText='position:absolute;left:12px;right:12px;top:10px;display:flex;justify-content:space-between;gap:8px;pointer-events:none';
          top.innerHTML =
            '<div><span id="hudMode"></span> <span id="hudDiff"></span> <span id="hudTime"></span></div>'+
            '<div>Score: <b id="hudScore">0</b> • Combo: <b id="hudCombo">0</b></div>';
          this.root.appendChild(top);
          this.$time=$('#hudTime'); this.$score=$('#hudScore'); this.$combo=$('#hudCombo');
          this.$mode=$('#hudMode'); this.$diff=$('#hudDiff');
          this.big=document.createElement('div'); this.big.style.cssText='position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);font:900 80px ui-rounded;color:#fef3c7;text-shadow:0 8px 40px rgba(0,0,0,.6);pointer-events:none;opacity:0;transition:opacity .2s, transform .2s;z-index:2100'; this.root.appendChild(this.big);
          this.result=document.createElement('div'); this.result.style.cssText='display:none;position:fixed;inset:0;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:2002';
          this.result.innerHTML='<div style="width:min(560px,94vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff"><h3 id="resTitle">Result</h3><p id="resDesc"></p><div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap"></div><div id="resExtra" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="resHome">🏠 Home</button><button id="resRetry">↻ Retry</button></div></div>';
          document.body.appendChild(this.result);
          this.$resTitle=this.result.querySelector('#resTitle'); this.$resDesc=this.result.querySelector('#resDesc');
          this.$resStats=this.result.querySelector('#resStats'); this.$resExtra=this.result.querySelector('#resExtra');
          this.onHome=null; this.onRetry=null;
          this.result.querySelector('#resHome').onclick=()=>this.onHome&&this.onHome();
          this.result.querySelector('#resRetry').onclick=()=>this.onRetry&&this.onRetry();
        }
        setTop(o){ if(o.mode!=null) this.$mode.textContent=o.mode; if(o.diff!=null) this.$diff.textContent=o.diff; }
        setTimer(s){ this.$time.textContent=Math.max(0,Math.round(s))+'s'; }
        updateHUD(sc,co){ this.$score.textContent=sc|0; this.$combo.textContent=co|0; }
        showBig(t){ this.big.textContent=String(t||''); this.big.style.opacity='1'; this.big.style.transform='translate(-50%,-50%) scale(1)'; setTimeout(()=>{ this.big.style.opacity='0'; this.big.style.transform='translate(-50%,-50%) scale(.9)'; }, 350); }
        showFever(on){ document.body.style.transition='background .25s ease'; document.body.style.backgroundColor=on?'#1a0f00':''; }
        showResult({title='Result',desc='—',stats=[],extra=[]}={}){
          const mk=(t,alt)=>{ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38'; b.textContent=String(t??alt); return b; };
          this.$resTitle.textContent=title; this.$resDesc.textContent=desc;
          this.$resStats.innerHTML=''; stats.forEach(s=>this.$resStats.appendChild(mk(s,'')));
          this.$resExtra.innerHTML=''; extra.forEach(s=>{ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #2a3e6a;background:#0c233f;color:#bfe0ff'; b.textContent=String(s); this.$resExtra.appendChild(b); });
          this.result.style.display='flex';
        }
        hideResult(){ this.result.style.display='none'; }
        say(m){ /* noop in fallback */ }
        setQuestChips(){/* noop */}
      };
    }

    try { ({ Coach: CoachClass } = await import('../core/coach.js')); } catch{
      CoachClass = class { constructor({lang='TH'}={}){ this.lang=(lang||'TH').toUpperCase(); } onStart(){} onEnd(){} onTimeLow(){} onFever(){} onGood(){} onBad(){} onPerfect(){} onQuestStart(){} onQuestDone(){} };
    }

    try { ({ Quests } = await import('../core/quests.js')); } catch{
      Quests = {
        bindToMain(){ return { refresh(){}}; },
        beginRun(){}, endRun(){ return { list:[], totalDone:0, summary:[] }; },
        tick(){}, event(){}, currentFocus(){ return null; }, setFocus(){}, getDisplayList(){ return []; }
      };
    }

    try { ({ Progress } = await import('../core/progression.js')); } catch{
      Progress = { init(){}, beginRun(){}, endRun(){}, profile(){return{};} };
    }

    try { ({ SFX: SFXClass } = await import('../core/sfx.js')); } catch{
      SFXClass = class { constructor(){ this._on=true; } isEnabled(){return this._on;} setEnabled(v){this._on=!!v;} good(){} perfect(){} bad(){} power(){} tick(){} bgmFever(){} bgmNormal(){} };
    }
  }

  async function loadMode(key){
    // สำคัญ: เส้นทางโหมดอยู่ที่ ../modes/
    const mod = await import(`../modes/${key}.js`);
    return {
      name: mod.name||key,
      create:mod.create||null, init:mod.init||null, tick:mod.tick||null,
      update:mod.update||null, start:mod.start||null, cleanup:mod.cleanup||null
    };
  }

  // ---------- Engine state ----------
  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode, diff){
    const base = TIME_BY_MODE[mode] ?? 45;
    if(diff==='Easy') return base+5;
    if(diff==='Hard') return Math.max(20, base-5);
    return base;
  }

  const R = {
    playing:false, paused:false,
    startedAt:0, remain:45, raf:0,
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null,
    sys:{ score:0, combo:0, bestCombo:0, sfx:null },
    hud:null, coach:null,
    fever:false, feverBreaks:0, // ปิด FEVER เมื่อ miss/bad 3 ครั้ง
    _dtMark:0, _secMark:0
  };

  // ---------- HUD sync ----------
  function syncTop(){ if(R.hud){ R.hud.setTop({mode:R.modeKey, diff:R.diff}); R.hud.setTimer(R.remain); R.hud.updateHUD(R.sys.score|0, R.sys.combo|0);} }

  // ---------- Fever ----------
  function setFever(on){
    if(R.fever===on) return;
    R.fever = !!on;
    if(R.hud && R.hud.showFever) R.hud.showFever(R.fever);
    try{ if(R.coach && R.coach.onFever) R.coach.onFever(); }catch{}
    // สลับ BGM (ถ้ามีใน SFX)
    try{ R.sys.sfx && (R.fever?R.sys.sfx.bgmFever():R.sys.sfx.bgmNormal()); }catch{}
  }

  // ---------- Bus for modes ----------
  function busFor(){
    return {
      sfx:R.sys.sfx,
      // กดของดี / GOLD / เพอร์เฟกต์
      hit:function(e){
        const pts = (e && e.points)|0;
        const kind = (e && e.kind) || 'good';
        R.sys.score += pts;
        R.sys.combo = (R.sys.combo|0) + 1;
        if(R.sys.combo > (R.sys.bestCombo|0)) R.sys.bestCombo = R.sys.combo|0;

        // เข้า FEVER ที่คอมโบ >=10
        if(!R.fever && (R.sys.combo|0) >= 10){ setFever(true); R.feverBreaks = 0; }

        // ส่งให้ Quests (รวม gold/power meta)
        try{ Quests.event('hit', { kind, points:pts, meta:(e&&e.meta)||{} , comboNow:R.sys.combo|0 }); }catch{}

        // ป๊อปตัวเลขคะแนน
        if(R.hud && e && e.ui && R.hud.showFloatingText) R.hud.showFloatingText(e.ui.x, e.ui.y, '+'+pts);

        syncTop();
      },

      // MISS เฉพาะของดีที่หมดเวลา
      miss:function(info){
        R.sys.combo = 0;
        R.feverBreaks++;
        if(R.feverBreaks>=3) setFever(false);
        try{ Quests.event('miss', info||{source:'good-timeout'}); }catch{}
        if(R.coach && R.coach.onBad) try{ R.coach.onBad(); }catch{}
        syncTop();
      },

      // BAD = คลิก Junk
      bad:function(info){
        R.sys.combo = 0;
        R.feverBreaks++;
        if(R.feverBreaks>=3) setFever(false);
        try{ Quests.event('bad', info||{source:'junk-click'}); }catch{}
        if(R.coach && R.coach.onBad) try{ R.coach.onBad(); }catch{}
        syncTop();
      },

      // Power pickups: 'shield' | 'gold'
      power:function(kind){
        try{ Quests.event('power', { kind:String(kind||'') }); }catch{}
      }
    };
  }

  // ---------- Loop ----------
  function tick(){
    if(!R.playing || R.paused){ R.raf = requestAnimationFrame(tick); return; }

    const now = performance.now();
    const dt  = (now - (R._dtMark||now))/1000;
    R._dtMark = now;

    // นับเวลาลดลงทีละวินาที (เสถียร)
    const secGone = Math.floor((now - (R._secMark||now))/1000);
    if(secGone>=1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      R._secMark = now;
      if(R.remain===10 && R.coach && R.coach.onTimeLow) R.coach.onTimeLow();
      syncTop();
      try{ Quests.tick({ score:R.sys.score|0, dt:secGone, fever:R.fever }); }catch{}
    }

    // อัปเดตโหมด
    try{
      if(R.modeAPI && typeof R.modeAPI.update==='function') R.modeAPI.update(dt, busFor());
      else if(R.modeInst && typeof R.modeInst.update==='function') R.modeInst.update(dt, busFor());
      else if(R.modeAPI && typeof R.modeAPI.tick==='function')   R.modeAPI.tick(R.state||{}, R.sys, R.hud||{});
    }catch(e){ console.warn('[mode.update]', e); }

    if(R.remain<=0){ endGame(); return; }
    R.raf = requestAnimationFrame(tick);
  }

  // ---------- Countdown then start ----------
  async function doCountdown(){
    // 3-2-1-GO
    for(let n=3;n>=1;n--){ if(R.hud && R.hud.showBig) R.hud.showBig(n); await wait(420); }
    if(R.hud && R.hud.showBig) R.hud.showBig('GO!');
    await wait(300);
  }

  function wait(ms){ return new Promise(r=>setTimeout(r, ms)); }

  // ---------- Grade to Stars ----------
  function gradeStars(score, bestCombo){
    // เกณฑ์ปรับได้ตามจริง
    const s = score|0, c = bestCombo|0;
    let star = 1;
    if(s>=2000 || c>=40) star = 5;
    else if(s>=1500 || c>=30) star = 4;
    else if(s>=1000 || c>=20) star = 3;
    else if(s>=500  || c>=10) star = 2;
    const txt = '★'.repeat(star)+'☆'.repeat(5-star);
    return { star, txt };
  }

  // ---------- End game ----------
  function endGame(){
    if(!R.playing) return;
    R.playing=false;
    cancelAnimationFrame(R.raf);

    try{ if(R.modeInst && R.modeInst.cleanup) R.modeInst.cleanup(); if(R.modeAPI && R.modeAPI.cleanup) R.modeAPI.cleanup(R.state, R.hud); }catch{}
    try{ const prof = Progress.profile&&Progress.profile(); Quests.endRun({ score:R.sys.score|0, bestCombo:R.sys.bestCombo|0, profile:prof||{} }); }catch{}
    setFever(false);

    const { star, txt } = gradeStars(R.sys.score|0, R.sys.bestCombo|0);
    const desc = `Mode: ${R.modeKey} • Diff: ${R.diff}\nStars: ${txt}`;

    // ดึงสรุปเควสต์ (ถ้ามี)
    let extra = [];
    try{
      const res = Quests.endRun({ score:R.sys.score|0 }) || {};
      if(res.summary && Array.isArray(res.summary)){
        extra = res.summary.map(s=>String(s));
      } else if(res.totalDone!=null){
        extra = [`Quests done: ${res.totalDone}`];
      }
    }catch{}

    if(R.hud && R.hud.showResult){
      R.hud.showResult({
        title:'Result',
        desc,
        stats:[
          'Score: '+(R.sys.score|0),
          'Best Combo: '+(R.sys.bestCombo|0),
          'Time: '+(R._matchTime|0)+'s',
        ],
        extra
      });
      R.hud.onHome = function(){ R.hud.hideResult(); const mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; } };
      R.hud.onRetry = function(){ R.hud.hideResult(); startGame(); };
    }else{
      const mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }
    }

    window.HHA._busy=false;
  }

  // ---------- Start game ----------
  async function startGame(){
    if(window.HHA && window.HHA._busy) return;
    if(!window.HHA) window.HHA = {};
    window.HHA._busy = true;

    await loadCore();
    try{ Progress.init(); }catch{}

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';
    R._matchTime = getMatchTime(R.modeKey, R.diff);
    R.remain     = R._matchTime|0;

    if(!R.hud) R.hud = new HUDClass();
    if(R.hud.hideResult) R.hud.hideResult();
    R.hud.setTop({ mode:R.modeKey, diff:R.diff });
    R.hud.setTimer(R.remain);
    R.hud.updateHUD(0,0);

    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    try{ Quests.bindToMain({ hud:R.hud, coach:R.coach }); }catch{}
    try{ Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R._matchTime); }catch{}

    // โหลดโหมด
    let api=null;
    try{ api = await loadMode(R.modeKey); }
    catch(e){ console.error('[loadMode]', e); toast('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }
    R.modeAPI = api;

    // รีเซ็ตสกอร์/คอมโบ
    R.sys.score=0; R.sys.combo=0; R.sys.bestCombo=0; R.fever=false; R.feverBreaks=0;
    R.sys.sfx = new (SFXClass||function(){})();

    // เริ่มโหมด (รองรับทั้ง create/init/start)
    if(api && typeof api.create==='function'){
      R.modeInst = api.create({ hud:R.hud, coach:R.coach });
      if(R.modeInst && typeof R.modeInst.start==='function') R.modeInst.start({ time:R._matchTime, difficulty:R.diff });
    } else if(api && typeof api.init==='function'){
      api.init((R.state={ difficulty:R.diff, ctx:{} }), R.hud, { time:R._matchTime, life:1600 });
    } else if(api && typeof api.start==='function'){
      api.start({ time:R._matchTime, difficulty:R.diff });
    }

    // Countdown แล้วค่อยเริ่มนับเวลา
    await doCountdown();

    R.playing = true; R.paused=false;
    R.startedAt = performance.now();
    R._secMark  = performance.now();
    R._dtMark   = performance.now();

    const mb = $('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    requestAnimationFrame(tick);
    window.HHA._busy=false;
  }

  // ---------- Pause/Resume ----------
  function pauseGame(){
    if(!R.playing || R.paused) return;
    R.paused = true;
    toast('Paused (P to resume)');
  }
  function resumeGame(){
    if(!R.playing || !R.paused) return;
    R.paused = false;
    // รีเซ็ตมาร์กเวลาเพื่อไม่ให้กระโดด
    R._secMark = performance.now();
    R._dtMark  = performance.now();
    toast('Resume');
  }
  function togglePause(){ R.paused ? resumeGame() : pauseGame(); }

  // ---------- Toast ----------
  function toast(text){
    let el=$('#toast');
    if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; el.style.cssText='position:fixed;left:50%;top:68px;transform:translateX(-50%);background:#0e1930;border:1px solid #214064;color:#e8f3ff;padding:8px 12px;border-radius:10px;opacity:0;transition:opacity .3s;z-index:10040'; document.body.appendChild(el); }
    el.textContent=String(text||'');
    el.style.opacity='1'; setTimeout(()=>{ el.style.opacity='0'; }, 1200);
  }

  // ---------- Expose ----------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;
  window.HHA.pause     = pauseGame;
  window.HHA.resume    = resumeGame;
  window.HHA.togglePause = togglePause;

  // Global key binds
  window.addEventListener('keydown', (e)=>{
    if(e.key==='p' || e.key==='P'){ e.preventDefault(); togglePause(); }
    if((e.key==='Enter'||e.key===' ') && !R.playing){
      const menuVisible = !($('#menuBar') && $('#menuBar').hasAttribute('data-hidden'));
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  }, {passive:false});
})();
