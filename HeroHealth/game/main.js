// === Hero Health Academy — game/main.js (PROD: timer/score/combo + Fever + countdown + Result) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function(){
  // ---------- Dom helpers ----------
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  // ---------- Safe fallbacks (replaced if core imports succeed) ----------
  let ScoreSystem, SFXClass, Quests, Progress, CoachClass, HUDClass;

  async function loadCore(){
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch {
      ScoreSystem = class {
        constructor(){ this.value=0; this.combo=0; this.bestCombo=0; }
        add(n=0){ this.value=Math.max(0,(this.value|0)+(n|0)); }
        get(){ return this.value|0; }
        reset(){ this.value=0; this.combo=0; this.bestCombo=0; }
      };
    }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch {
      SFXClass = class {
        constructor(){ this._on=true; }
        isEnabled(){ return !!this._on; }
        setEnabled(v){ this._on=!!v; }
        play(){} good(){} bad(){} perfect(){} power(){} tick(){}
      };
    }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch {
      // Minimal quest bus soเกมยังเล่นได้
      Quests = {
        bindToMain(){ return { refresh(){} }; },
        beginRun(){}, endRun(){ return { totalDone:0, stars:0, hitsGold:0, penalties:0, misses:0, selected:[] }; },
        event(){}, tick(){}
      };
    }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, endRun(){}, beginRun(){}, emit(){}, getStatSnapshot(){return{};} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = class {
        constructor(opts={}){ this.lang=(localStorage.getItem('hha_lang')||opts.lang||'TH').toUpperCase(); this._ensure(); }
        _ensure(){ this.box=$('#coachBox'); if(!this.box){ this.box=document.createElement('div'); this.box.id='coachBox';
          this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001';
          document.body.appendChild(this.box);} }
        say(t){ if(!this.box) return; this.box.textContent=t||''; this.box.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>{this.box.style.display='none';},1400); }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }

    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch {
      HUDClass = class {
        constructor(){
          this.root = $('#hud') || Object.assign(document.createElement('div'),{id:'hud'});
          if(!$('#hud')){ this.root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2000;'; document.body.appendChild(this.root); }
          this.top = document.createElement('div');
          this.top.style.cssText='position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
          this.top.innerHTML =
            '<div style="display:flex;gap:8px;align-items:center">'+
              '<span id="hudMode"  style="padding:4px 8px;border-radius:10px;background:#0b2544;color:#cbe7ff;border:1px solid #15406e;pointer-events:auto">—</span>'+
              '<span id="hudDiff"  style="padding:4px 8px;border-radius:10px;background:#102b52;color:#e6f5ff;border:1px solid #1b4b8a;pointer-events:auto">—</span>'+
              '<span id="hudTime"  style="padding:4px 8px;border-radius:10px;background:#0a1f3d;color:#c9e7ff;border:1px solid #123863;min-width:64px;text-align:center;pointer-events:auto">—</span>'+
            '</div>'+
            '<div style="display:flex;gap:8px;align-items:center">'+
              '<span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#bbf7d0;border:1px solid #134064;pointer-events:auto">Score: <b id="hudScore">0</b></span>'+
              '<span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#fde68a;border:1px solid #134064;pointer-events:auto">Combo: <b id="hudCombo">0</b></span>'+
            '</div>';
          this.root.appendChild(this.top);
          this.$mode=this.top.querySelector('#hudMode');
          this.$diff=this.top.querySelector('#hudDiff');
          this.$time=this.top.querySelector('#hudTime');
          this.$score=this.top.querySelector('#hudScore');
          this.$combo=this.top.querySelector('#hudCombo');

          this.result=document.createElement('div');
          this.result.id='resultModal';
          this.result.style.cssText='position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto;z-index:2002';
          this.result.innerHTML =
            '<div style="width:min(560px,94vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff">'+
              '<h3 id="resTitle" style="margin:0 0 6px;font:900 20px ui-rounded">Result</h3>'+
              '<p  id="resDesc"  style="margin:0 0 10px;color:#cfe7ff;white-space:pre-line">—</p>'+
              '<div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>'+
              '<div id="resExtra" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>'+
              '<div style="display:flex;gap:8px;justify-content:flex-end">'+
                '<button id="resHome" style="padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer">🏠 Home</button>'+
                '<button id="resRetry" style="padding:8px 10px;border-radius:10px;background:#123054;color:#dff2ff;border:1px solid #1e4d83;cursor:pointer">↻ Retry</button>'+
              '</div>'+
            '</div>';
          this.root.appendChild(this.result);
          this.$resTitle=this.result.querySelector('#resTitle');
          this.$resDesc =this.result.querySelector('#resDesc');
          this.$resStats=this.result.querySelector('#resStats');
          this.$resExtra=this.result.querySelector('#resExtra');
          this.onHome=null; this.onRetry=null;
          this.result.querySelector('#resHome').onclick = ()=>this.onHome && this.onHome();
          this.result.querySelector('#resRetry').onclick= ()=>this.onRetry && this.onRetry();

          // power bar (fever)
          this.$power = document.getElementById('powerBarWrap') || (()=>{ const w=document.createElement('div'); w.id='powerBarWrap'; w.style.cssText='position:fixed;left:12px;bottom:12px;z-index:2001;width:min(380px,92vw)'; w.innerHTML='<div id="powerBar" style="position:relative;height:14px;border-radius:999px;background:#0a1931;border:1px solid #0f2a54;overflow:hidden"><div id="powerFill" style="position:absolute;inset:0;width:0%"></div></div>'; document.body.appendChild(w); return w; })();
          this.$powerFill = this.$power.querySelector('#powerFill');
        }
        setTop({mode,diff}={}){ if(mode!=null) this.$mode.textContent=String(mode); if(diff!=null) this.$diff.textContent=String(diff); }
        setTimer(sec){ this.$time.textContent = Math.max(0, Math.round(sec)) + 's'; }
        updateHUD(score,combo){ if(score!=null) this.$score.textContent=String(score|0); if(combo!=null) this.$combo.textContent=String(combo|0); }
        showFever(on){ this.$powerFill.innerHTML = on ? '<div class="fire" style="position:absolute;left:0;top:0;bottom:0;width:100%;background:radial-gradient(30px 24px at 20% 110%,rgba(255,200,0,.9),rgba(255,130,0,.65)55%,rgba(255,80,0,0)70%),radial-gradient(26px 20px at 45% 110%,rgba(255,210,80,.85),rgba(255,120,0,.55)55%,rgba(255,80,0,0)70%),radial-gradient(34px 26px at 70% 110%,rgba(255,190,40,.9),rgba(255,110,0,.55)55%,rgba(255,80,0,0)70%),linear-gradient(0deg,rgba(255,140,0,.65),rgba(255,100,0,.25));mix-blend-mode:screen;animation:fireRise .9s ease-in-out infinite"></div>' : ''; }
        showFloatingText(x,y,text){ const el=document.createElement('div'); el.textContent=String(text); el.style.cssText='position:fixed;left:'+(x|0)+'px;top:'+(y|0)+'px;transform:translate(-50%,-50%);font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:2100;opacity:1;transition:all .72s ease-out;'; document.body.appendChild(el); requestAnimationFrame(()=>{ el.style.top=(y-36)+'px'; el.style.opacity='0'; }); setTimeout(()=>{ try{el.remove();}catch{} },720); }
        showResult({title='Result',desc='—',stats=[],extra=[]}={}){ this.$resTitle.textContent=String(title); this.$resDesc.textContent=String(desc); const f1=document.createDocumentFragment(), f2=document.createDocumentFragment(); (stats.length?stats:['No stats']).forEach(s=>{ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38'; b.textContent=String(s); f1.appendChild(b); }); (extra||[]).forEach(s=>{ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #2a3e6a;background:#0c233f;color:#bfe0ff'; b.textContent=String(s); f2.appendChild(b); }); this.$resStats.innerHTML=''; this.$resStats.appendChild(f1); this.$resExtra.innerHTML=''; this.$resExtra.appendChild(f2); this.result.style.display='flex'; }
        hideResult(){ this.result.style.display='none'; }
      };
    }
  }

  // ---------- Mode loader ----------
  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return {
      name:mod.name||key,
      create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null,
      start:mod.start||null, cleanup:mod.cleanup||null,
      setFever:mod.setFever||null
    };
  }

  // ---------- Engine State ----------
  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode='goodjunk', diff='Normal'){
    const base = TIME_BY_MODE[mode] ?? 45;
    if (diff==='Easy') return base + 5;
    if (diff==='Hard') return Math.max(20, base - 5);
    return base;
  }

  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null,
    matchTime:45,
    feverActive:false, feverBreaks:0
  };
  let hud=null;

  // ---------- Visual helpers ----------
  function bigCenterToast(txt, ms=700){
    const el=document.createElement('div');
    el.textContent=txt;
    el.style.cssText='position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);font:900 88px ui-rounded,system-ui;color:#fff;letter-spacing:.02em;text-shadow:0 8px 40px rgba(0,0,0,.6);z-index:3000;opacity:0;transition:all .28s ease-out';
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translate(-50%,-50%) scale(1.02)'; });
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translate(-50%,-50%) scale(.96)'; }, ms);
    setTimeout(()=>{ try{el.remove();}catch{}; }, ms+220);
  }

  // ---------- UI sync ----------
  function syncTop(){
    hud?.setTop?.({ mode:R.modeKey, diff:R.diff });
    hud?.setTimer?.(R.remain);
    hud?.updateHUD?.(R.sys?.score?.get?.()||0, R.sys?.score?.combo|0);
  }

  // ---------- FEVER control ----------
  function setFever(on){
    on=!!on;
    if(R.feverActive===on) return;
    R.feverActive=on;
    hud?.showFever?.(on);
    try{ R.modeAPI?.setFever?.(on); }catch{}
    document.body.classList.toggle('fever', on);
    // Optional BGM sting
    try{
      let feverEl = $('#bgm-fever');
      if(!feverEl){ feverEl = document.createElement('audio'); feverEl.id='bgm-fever'; feverEl.preload='auto'; feverEl.src='assets/sfx/fever.mp3'; document.body.appendChild(feverEl); }
      if(on){ feverEl.currentTime=0; feverEl.volume=0.9; feverEl.play().catch(()=>{}); }
    }catch{}
  }

  // ---------- Bus to modes ----------
  function busFor(){
    return {
      sfx:R.sys.sfx,
      // hit from mode (good/perfect/gold)
      hit:(e)=>{
        const pts=(e&&e.points)|0;
        if(pts){
          R.sys.score.add(pts);
          R.sys.score.combo=(R.sys.score.combo|0)+1;
          if((R.sys.score.combo|0)>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo|0;
        }
        // Fever enters at combo >=10
        if(!R.feverActive && (R.sys.score.combo|0)>=10){ setFever(true); R.feverBreaks=0; try{Quests.event('fever',{on:true});}catch{} }
        if(e && e.ui){ hud?.showFloatingText?.(e.ui.x, e.ui.y, `+${pts}`); }
        try{ Quests.event('hit',{ result:e?.kind||'good', meta:e?.meta||{}, points:pts, comboNow:R.sys.score.combo|0 }); }catch{}
        syncTop();
      },
      // miss ONLY for good timeout
      miss:(info={})=>{
        if(R.feverActive){
          R.feverBreaks++;
          if(R.feverBreaks>=3){ setFever(false); R.feverBreaks=0; try{Quests.event('fever',{on:false});}catch{} }
        }
        R.sys.score.combo=0;
        try{ Quests.event('miss', { by: info.by||'good-timeout' }); }catch{}
        R.coach?.onBad?.();
        R.sys?.sfx?.bad?.();
        syncTop();
      },
      // penalty for junk click (NOT counted as miss)
      penalty:(info={})=>{
        R.sys.score.add(-50);
        R.sys.score.combo=0;
        try{ Quests.event('penalty', { by: info.by||'junk-click' }); }catch{}
        R.coach?.onBad?.();
        R.sys?.sfx?.bad?.();
        syncTop();
      },
      power:(k)=>{ try{ Quests.event('power',{kind:k}); }catch{} }
    };
  }

  // ---------- Game loop ----------
  function tick(){
    if(!R.playing) return;
    const now=performance.now();

    // second step
    const secGone=Math.floor((now-R._secMark)/1000);
    if(secGone>=1){
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=now;
      hud?.setTimer?.(R.remain);

      if(R.remain===10){ R.coach?.onTimeLow?.(); bigCenterToast('10'); }
      if(R.remain>0 && R.remain<=9){ /* optional per-second cue */ }

      try{ Quests.tick({ score:(R.sys.score.get?.()||0), dt:secGone, fever:R.feverActive }); }catch{}
    }

    // per-frame update to mode
    try{
      const dt=(now-(R._dtMark||now))/1000; R._dtMark=now;
      if(typeof R.modeAPI?.update==='function'){ R.modeAPI.update(dt, busFor()); }
      else if(R.modeInst?.update){ R.modeInst.update(dt, busFor()); }
      else if(R.modeAPI?.tick){ R.modeAPI.tick(R.state||{}, R.sys, hud||{}); }
    }catch(e){ console.warn('[mode.update] error', e); }

    if(R.remain<=0) return endGame();
    R.raf=requestAnimationFrame(tick);
  }

  // ---------- Start / End ----------
  async function startGame(){
    if(window.HHA?._busy) return;
    window.HHA = window.HHA || {};
    window.HHA._busy=true;

    await loadCore();
    Progress.init?.();

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';
    R.matchTime = getMatchTime(R.modeKey, R.diff);
    R.remain    = R.matchTime|0;

    if(!hud) hud = new HUDClass();
    hud.hideResult?.();
    hud.setTop?.({ mode:R.modeKey, diff:R.diff });
    hud.setTimer?.(R.remain);
    hud.updateHUD?.(0,0);
    hud.showFever?.(false);
    document.body.classList.remove('fever');

    // systems
    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.score.combo=0; R.sys.score.bestCombo=0;
    R.sys.sfx   = new (SFXClass||function(){})();
    R.feverActive=false; R.feverBreaks=0;

    // coach + quests
    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    try{ Quests.bindToMain({ hud, coach:R.coach }); }catch{}
    try{ Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime); }catch{}

    // load mode
    let api=null;
    try { api = await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); toast('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }
    R.modeAPI = api;

    // 3-2-1-GO overlay
    await countdown321();

    // start mode (support 3 styles)
    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    if(api && typeof api.create==='function'){
      R.modeInst = api.create({ engine:{}, hud, coach:R.coach });
      R.modeInst.start?.({ time:R.matchTime, difficulty:R.diff });
    } else if(api && typeof api.init==='function'){
      api.init(R.state, hud, { time:R.matchTime, life:1600 });
    } else if(api && typeof api.start==='function'){
      api.start({ time:R.matchTime, difficulty:R.diff });
    }

    // run
    R.playing=true;
    R.startedAt=performance.now();
    R._secMark =performance.now();
    R._dtMark  =performance.now();

    // hide menu
    const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    document.body.setAttribute('data-playing','1');

    R.coach?.onStart?.();
    syncTop();
    requestAnimationFrame(tick);
  }

  async function countdown321(){
    const seq=['3','2','1','GO!'];
    for(const s of seq){
      bigCenterToast(s, (s==='GO!'?520:520));
      await sleep(520);
    }
  }
  const sleep=(ms)=>new Promise(res=>setTimeout(res,ms));

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);

    const score=R.sys?.score?.get?.()||0;
    const bestC=R.sys?.score?.bestCombo|0;

    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state,hud); }catch{}
    let qSum=null; try{ qSum = (typeof Quests?.endRun==='function') ? Quests.endRun({ score }) : null; }catch{}
    try{ R.coach?.onEnd?.(score); }catch{}
    try{ Progress.endRun?.({ score, bestCombo:bestC }); }catch{}

    document.body.removeAttribute('data-playing');

    const stats=[
      `Score: ${score}`,
      `Best Combo: ${bestC}`,
      `Time: ${R.matchTime|0}s`,
      qSum ? `Quests done: ${qSum.totalDone||0}/3` : null
    ].filter(Boolean);

    const extra=[];
    if(qSum){
      extra.push(`Stars: ${qSum.stars|0}`);
      extra.push(`Gold taps: ${qSum.hitsGold|0}`);
      extra.push(`Penalties: ${qSum.penalties|0}`);
      extra.push(`Misses: ${qSum.misses|0}`);
      if(Array.isArray(qSum.selected)){
        qSum.selected.forEach(q=>{
          extra.push(`${q.done?'✅':'❌'} ${q.label} (${q.progress}/${q.need})`);
        });
      }
    }

    try{
      if(!hud) hud=new HUDClass();
      hud.showResult({
        title:'Result',
        desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
        stats, extra
      });
      hud.onHome = ()=>{ hud.hideResult(); const m2=$('#menuBar'); if(m2){ m2.removeAttribute('data-hidden'); m2.style.display='flex'; } };
      hud.onRetry= ()=>{ hud.hideResult(); startGame(); };
    }catch(e){
      alert(`Score ${score}\nCombo ${bestC}`);
    }

    window.HHA._busy=false;
  }

  // ---------- Toast ----------
  function toast(text){
    let el=$('#toast');
    if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=String(text); el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200);
  }

  // ---------- Expose ----------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // canvases never block UI
  setTimeout(()=>{ $$( 'canvas' ).forEach(c=>{ c.style.pointerEvents='none'; c.style.zIndex='1'; }); },0);

  // keyboard quick start
  window.addEventListener('keydown',(e)=>{
    if((e.key==='Enter'||e.key===' ') && !R.playing){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  },{passive:false});
})();
