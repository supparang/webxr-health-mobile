// === Hero Health Academy — game/main.js (production-ready; FEVER + Pause + Countdown + Result) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function () {
  // ----- tiny DOM helpers -----
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  // ----- safe core fallbacks (auto replaced if modules exist) -----
  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, Leaderboard, HUDClass;

  async function loadCore(){
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch {
      ScoreSystem = class {
        constructor(){ this.value=0; this.combo=0; this.bestCombo=0; }
        add(n=0){ this.value += (n|0); }
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
        play(){} tick(){} good(){} bad(){} perfect(){} power(){} pause(){} resume(){}
      };
    }
    try { ({ Quests } = await import('./core/quests.js')); }
    catch {
      Quests = {
        bindToMain(){ return { refresh(){} }; },
        beginRun(){}, endRun(){ return {done:[],fail:[],lines:[],totalDone:0}; },
        event(){}, tick(){}
      };
    }
    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }
    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} }; }
    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = class {
        constructor(opts){ this.lang=(localStorage.getItem('hha_lang')||(opts?.lang||'TH')).toUpperCase(); this._ensure(); }
        _ensure(){ this.box=$('#coachBox'); if(!this.box){ this.box=document.createElement('div'); this.box.id='coachBox';
          this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001'; document.body.appendChild(this.box);} }
        say(t){ if(!this.box) return; this.box.textContent=t||''; this.box.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>{ this.box.style.display='none'; },1400); }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }
    try { ({ Leaderboard } = await import('./core/leaderboard.js')); }
    catch { Leaderboard = class { submit(){} renderInto(){} getInfo(){return{text:'-'};} }; }
    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch {
      HUDClass = class {
        constructor(){
          this.root = $('#hud') || Object.assign(document.createElement('div'),{id:'hud'});
          if(!$('#hud')){ this.root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2000;'; document.body.appendChild(this.root); }
          const top=document.createElement('div');
          top.style.cssText='position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
          top.innerHTML = `
            <div style="display:flex;gap:8px;align-items:center">
              <span id="hudMode"  style="padding:4px 8px;border-radius:10px;background:#0b2544;color:#cbe7ff;border:1px solid #15406e;pointer-events:auto">—</span>
              <span id="hudDiff"  style="padding:4px 8px;border-radius:10px;background:#102b52;color:#e6f5ff;border:1px solid #1b4b8a;pointer-events:auto">—</span>
              <span id="hudTime"  style="padding:4px 8px;border-radius:10px;background:#0a1f3d;color:#c9e7ff;border:1px solid #123863;min-width:64px;text-align:center;pointer-events:auto">—</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#bbf7d0;border:1px solid #134064;pointer-events:auto">Score: <b id="hudScore">0</b></span>
              <span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#fde68a;border:1px solid #134064;pointer-events:auto">Combo: <b id="hudCombo">0</b></span>
            </div>`;
          this.root.appendChild(top);
          this.$mode=top.querySelector('#hudMode'); this.$diff=top.querySelector('#hudDiff'); this.$time=top.querySelector('#hudTime');
          this.$score=top.querySelector('#hudScore'); this.$combo=top.querySelector('#hudCombo');

          this.chips = Object.assign(document.createElement('div'),{id:'questChips'});
          this.chips.style.cssText='position:fixed;left:12px;bottom:78px;display:flex;flex-wrap:wrap;gap:6px;max-width:92vw;pointer-events:none';
          this.root.appendChild(this.chips);

          this.result=document.createElement('div');
          this.result.id='resultModal';
          this.result.style.cssText='position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto;z-index:2002';
          this.result.innerHTML = `
            <div style="width:min(560px,94vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff">
              <h3 id="resTitle" style="margin:0 0 6px;font:900 20px ui-rounded">Result</h3>
              <p  id="resDesc"  style="margin:0 0 10px;color:#cfe7ff;white-space:pre-line">—</p>
              <div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>
              <div id="resExtra" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>
              <div style="display:flex;gap:8px;justify-content:flex-end">
                <button id="resHome"  style="padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer">🏠 Home</button>
                <button id="resRetry" style="padding:8px 10px;border-radius:10px;background:#123054;color:#dff2ff;border:1px solid #1e4d83;cursor:pointer">↻ Retry</button>
              </div>
            </div>`;
          this.root.appendChild(this.result);
          this.$resTitle=this.result.querySelector('#resTitle'); this.$resDesc=this.result.querySelector('#resDesc');
          this.$resStats=this.result.querySelector('#resStats'); this.$resExtra=this.result.querySelector('#resExtra');
          this.onHome=null; this.onRetry=null;
          this.result.querySelector('#resHome').onclick = ()=>this.onHome?.();
          this.result.querySelector('#resRetry').onclick= ()=>this.onRetry?.();
        }
        setTop({mode,diff}={}){ if(mode!=null) this.$mode.textContent=String(mode); if(diff!=null) this.$diff.textContent=String(diff); }
        setTimer(sec){ this.$time.textContent = Math.max(0,Math.round(sec))+'s'; }
        updateHUD(score,combo){ this.$score.textContent=String(score|0); this.$combo.textContent=String(combo|0); }
        setQuestChips(list=[]){
          const frag=document.createDocumentFragment();
          for(const m of list){
            const pct=m.need>0?Math.min(100,Math.round((m.progress/m.need)*100)):0;
            const d=document.createElement('div');
            d.style.cssText='pointer-events:auto;display:inline-flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;border:2px solid '+(m.active?'#22d3ee':'#16325d')+';background:'+(m.done?'#0f2e1f':m.fail?'#361515':'#0d1a31')+';color:#e6f2ff;';
            d.innerHTML=`<span style="font-size:16px">${m.icon||'⭐'}</span>
              <span style="font:700 12.5px ui-rounded">${m.label||m.key}</span>
              <span style="font:700 12px;color:#a7f3d0;margin-left:6px">${m.progress||0}/${m.need||0}</span>
              <i style="height:6px;width:120px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;display:inline-block;margin-left:6px">
                <b style="display:block;height:100%;width:${pct}%;background:${m.done?(m.fail?'#ef4444':'#22c55e'):'#22d3ee'}"></b>
              </i>`;
            frag.appendChild(d);
          }
          this.chips.innerHTML=''; this.chips.appendChild(frag);
        }
        showFever(on){
          const wrap = $('#powerBarWrap') || (()=>{ const w=document.createElement('div'); w.id='powerBarWrap';
            w.style.cssText='position:fixed;left:12px;bottom:12px;z-index:18;width:min(380px,92vw);pointer-events:none';
            w.innerHTML='<div id="powerBar" style="position:relative;height:14px;border-radius:999px;background:#0a1931;border:1px solid #0f2a54;overflow:hidden"><div id="powerFill" style="position:absolute;inset:0;width:100%"></div></div>';
            document.body.appendChild(w); return w; })();
          const f = wrap.querySelector('#powerFill');
          if(on){ f.innerHTML='<div class="fire" style="position:absolute;left:0;top:0;bottom:0;width:100%;background:radial-gradient(30px 24px at 20% 110%,rgba(255,200,0,.9),rgba(255,130,0,.65)55%,rgba(255,80,0,0)70%),radial-gradient(26px 20px at 45% 110%,rgba(255,210,80,.85),rgba(255,120,0,.55)55%,rgba(255,80,0,0)70%),radial-gradient(34px 26px at 70% 110%,rgba(255,190,40,.9),rgba(255,110,0,.55)55%,rgba(255,80,0,0)70%),linear-gradient(0deg,rgba(255,140,0,.65),rgba(255,100,0,.25));mix-blend-mode:screen;animation:fireRise .9s ease-in-out infinite"></div>'; }
          else { f.innerHTML=''; }
        }
        showFloatingText(x,y,text){
          const el=document.createElement('div');
          el.textContent=String(text);
          el.style.cssText=`position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:2100;opacity:1;transition:all .72s ease-out;`;
          document.body.appendChild(el);
          requestAnimationFrame(()=>{ el.style.top=(y-36)+'px'; el.style.opacity='0'; });
          setTimeout(()=>{ try{el.remove();}catch{}; }, 720);
        }
        showResult({title='Result',desc='—',stats=[],extra=[]}={}){
          this.$resTitle.textContent=String(title); this.$resDesc.textContent=String(desc);
          const f1=document.createDocumentFragment(), f2=document.createDocumentFragment();
          stats.forEach(s=>{ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38'; b.textContent=String(s); f1.appendChild(b); });
          extra.forEach(s=>{ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #2a3e6a;background:#0c233f;color:#bfe0ff'; b.textContent=String(s); f2.appendChild(b); });
          this.$resStats.innerHTML=''; this.$resStats.appendChild(f1);
          this.$resExtra.innerHTML=''; this.$resExtra.appendChild(f2);
          this.result.style.display='flex';
        }
        hideResult(){ this.result.style.display='none'; }
        toast(text){ let t=$('#toast'); if(!t){ t=document.createElement('div'); t.id='toast';
          t.style.cssText='position:fixed;left:50%;top:68px;transform:translateX(-50%);background:#0e1930;border:1px solid #214064;color:#e8f3ff;padding:8px 12px;border-radius:10px;opacity:0;transition:opacity .3s;z-index:10040'; document.body.appendChild(t); }
          t.textContent=String(text); t.style.opacity='1'; setTimeout(()=>{ t.style.opacity='0'; },1200);
        }
      };
    }
  }

  // ----- timing -----
  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode,diff){
    const base = TIME_BY_MODE[mode||'goodjunk'] ?? 45;
    if (diff==='Easy') return base+5;
    if (diff==='Hard') return Math.max(20, base-5);
    return base;
  }

  // ----- state -----
  const R = {
    playing:false, paused:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null, hud:null,
    matchTime:45,
    feverActive:false, feverBreaks:0, feverSinceMs:0, feverTotalMs:0,
    _secMark:0, _dtMark:0, _countdownEl:null, _resumeMark:0
  };

  // ----- HUD sync -----
  function syncHUD(){
    R.hud?.setTop?.({mode:R.modeKey, diff:R.diff});
    R.hud?.setTimer?.(R.remain);
    R.hud?.updateHUD?.(R.sys?.score?.get?.()||0, R.sys?.score?.combo|0);
  }

  // ----- FEVER control -----
  function setFever(on){
    on = !!on;
    if (on && !R.feverActive){
      R.feverActive = true; R.feverBreaks = 0; R.feverSinceMs = performance.now();
      R.hud?.showFever(true);
      try{ R.modeAPI?.setFever?.(true); }catch{}
      try{ Quests.event('fever',{on:true}); }catch{}
      // sfx bgm ping
      try{ R.sys.sfx?.power?.(); }catch{}
      try{ const bgm=$('#bgm-main'); if(bgm){ bgm.currentTime=0; bgm.play?.().catch(()=>{}); setTimeout(()=>{ try{bgm.pause();}catch{}; }, 900);} }catch{}
      document.body.style.transition='background 180ms ease';
      document.body.style.backgroundColor='rgba(255,120,0,0.05)';
    } else if (!on && R.feverActive){
      R.feverActive = false;
      if (R.feverSinceMs) { R.feverTotalMs += Math.max(0, performance.now()-R.feverSinceMs); R.feverSinceMs=0; }
      R.hud?.showFever(false);
      try{ R.modeAPI?.setFever?.(false); }catch{}
      try{ Quests.event('fever',{on:false}); }catch{}
      document.body.style.backgroundColor='';
    }
  }

  // ----- Bus passed to modes -----
  function busFor(){
    return {
      sfx:R.sys.sfx,
      // good/junk tap results
      hit:(e)=>{
        const pts=(e?.points)|0;
        if(pts){ R.sys.score.add(pts); R.sys.score.combo=(R.sys.score.combo|0)+1; if(R.sys.score.combo>R.sys.score.bestCombo) R.sys.score.bestCombo=R.sys.score.combo; }
        // FEVER on at combo>=10
        if(!R.feverActive && (R.sys.score.combo|0)>=10) setFever(true);
        if(e?.ui) R.hud?.showFloatingText?.(e.ui.x, e.ui.y, `+${pts}`);
        try{ Quests.event('hit',{ result:(e?.kind)||'good', meta:e?.meta||{}, points:pts, comboNow:R.sys.score.combo|0 }); }catch{}
        syncHUD();
      },
      // MISS (เฉพาะ good ที่หมดเวลา/กดพลาด)
      miss:(info={})=>{
        if(R.feverActive){ R.feverBreaks++; if(R.feverBreaks>=3) setFever(false); }
        R.sys.score.combo=0;
        try{ Quests.event('miss', info); }catch{}
        R.sys.sfx?.bad?.();
        syncHUD();
      },
      // junk click = ไม่ใช่ MISS แต่ตัดคอมโบทันที
      junk:(info={})=>{
        if(R.feverActive){ R.feverBreaks++; if(R.feverBreaks>=3) setFever(false); }
        R.sys.score.combo=0;
        try{ Quests.event('junk', info); }catch{}
        R.sys.sfx?.bad?.();
        syncHUD();
      },
      // power events (eg. gold/shield)
      power:(k)=>{
        try{ Quests.event('power',{kind:k}); }catch{}
        if(k==='gold' || k==='star'){ R.hud?.toast?.('⭐ +1'); }
      }
    };
  }

  // ----- loop -----
  function gameTick(){
    if(!R.playing || R.paused) return;
    const tNow=performance.now();

    // whole seconds
    const secGone=Math.floor((tNow-R._secMark)/1000);
    if(secGone>=1){
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=tNow;
      syncHUD();
      if(R.remain===10) R.coach?.onTimeLow?.();
      try{ Quests.tick({ score:(R.sys.score.get?.()||0), dt:secGone, fever:R.feverActive }); }catch{}
    }

    // mode update
    try{
      const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
      if(typeof R.modeAPI?.update==='function'){ R.modeAPI.update(dt,busFor()); }
      else if(R.modeInst?.update){ R.modeInst.update(dt,busFor()); }
      else if(typeof R.modeAPI?.tick==='function'){ R.modeAPI.tick(R.state||{}, R.sys, R.hud||{}); }
    }catch(e){ console.warn('[mode.update] error',e); }

    if(R.remain<=0) return endGame();
    R.raf=requestAnimationFrame(gameTick);
  }

  // ----- countdown 3-2-1-Go -----
  async function runCountdown(){
    const el = document.createElement('div');
    R._countdownEl = el;
    el.style.cssText = 'position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);font:900 72px ui-rounded;color:#fff;text-shadow:0 6px 36px rgba(0,0,0,.6);z-index:3000;pointer-events:none';
    document.body.appendChild(el);
    const phase = ['3','2','1','GO!'];
    for(let i=0;i<phase.length;i++){
      el.textContent=phase[i];
      el.style.opacity='1'; el.style.transform='translate(-50%,-50%) scale(1)';
      // flash
      document.body.style.animation='flashWarn .25s';
      setTimeout(()=>{ document.body.style.animation='none'; }, 250);
      await new Promise(r=>setTimeout(r, i===phase.length-1?600:700));
      el.style.opacity='0.0';
    }
    try{ el.remove(); }catch{}
    R._countdownEl=null;
  }

  // ----- end game & result -----
  function starsText(n){ return '★'.repeat(n)+'☆'.repeat(5-n); }
  function computeStars({score,bestCombo,questsDone,feverSeconds}){
    let s=0;
    if(score>=600) s+=2; else if(score>=400) s+=1;
    if(bestCombo>=15) s+=2; else if(bestCombo>=10) s+=1;
    if((questsDone|0)>=2) s+=1;
    if((feverSeconds|0)>=10) s+=1;
    return Math.max(1, Math.min(5,s));
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    if(R.feverActive) setFever(false);

    const score=R.sys?.score?.get?.()||0;
    const bestC=R.sys?.score?.bestCombo|0;
    const feverMs=R.feverTotalMs|0;

    let questRes={done:[],fail:[],lines:[],totalDone:0};
    try{ questRes = Quests.endRun({score}); }catch{}

    const stars = computeStars({score,bestCombo:bestC,questsDone:questRes.totalDone||0,feverSeconds:Math.round(feverMs/1000)});

    R.hud?.showResult?.({
      title:'Result',
      desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
      stats:[
        `Score: ${score}`,
        `Best Combo: ${bestC}`,
        `Time: ${R.matchTime|0}s`,
        `Quests: ${questRes?.totalDone||0}/3`,
      ],
      extra:[
        `Grade: ${starsText(stars)}`,
        `Fever time: ${Math.round(feverMs/1000)}s`,
        ...(questRes?.lines||[])
      ]
    });

    if(R.hud){
      R.hud.onHome = ()=>{
        R.hud.hideResult();
        const m=$('#menuBar'); if(m){ m.removeAttribute('data-hidden'); m.style.display='flex'; }
      };
      R.hud.onRetry = ()=>{
        R.hud.hideResult(); startGame();
      };
    }

    try{ Progress.endRun({score, bestCombo:bestC, stars}); }catch{}
    window.HHA._busy=false;
  }

  // ----- pause/resume -----
  function setPaused(on){
    on=!!on;
    if(on && !R.paused){
      R.paused=true;
      cancelAnimationFrame(R.raf);
      R._pauseRemain = R.remain;
      R.sys.sfx?.pause?.();
      document.body.setAttribute('data-paused','1');
      R.hud?.toast?.('⏸️ Pause');
    }else if(!on && R.paused){
      R.paused=false;
      R._secMark = performance.now();
      R._dtMark  = performance.now();
      R.remain   = R._pauseRemain|0;
      R.sys.sfx?.resume?.();
      document.body.removeAttribute('data-paused');
      R.hud?.toast?.('▶️ Resume');
      requestAnimationFrame(gameTick);
    }
  }

  // ----- start -----
  async function startGame(){
    if(window.HHA?._busy) return;
    window.HHA._busy=true; R.paused=false;

    await loadCore();
    try{ Progress.init(); }catch{}

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';

    R.matchTime = getMatchTime(R.modeKey,R.diff);
    R.remain    = R.matchTime|0;

    if(!R.hud) R.hud = new HUDClass();
    R.hud.hideResult?.();
    R.hud.setTop?.({ mode:R.modeKey, diff:R.diff });
    R.hud.setTimer?.(R.remain);
    R.hud.updateHUD?.(0,0);

    // load mode
    let api=null;
    try{ api = await import(`./modes/${R.modeKey}.js`); }
    catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); R.hud?.toast?.('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }
    R.modeAPI = {
      name:api.name||R.modeKey,
      create:api.create||null, init:api.init||null, tick:api.tick||null, update:api.update||null, start:api.start||null,
      setFever:api.setFever||null, cleanup:api.cleanup||null
    };

    // systems
    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.score.combo=0; R.sys.score.bestCombo=0;
    R.sys.sfx   = new (SFXClass||function(){})();
    R.feverActive=false; R.feverBreaks=0; R.feverSinceMs=0; R.feverTotalMs=0;

    // coach + quests
    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    try { Quests.bindToMain({ hud:R.hud, coach:R.coach }); }catch{}
    try { Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime); }catch{}

    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };

    // prepare mode
    if(R.modeAPI.create){
      R.modeInst = R.modeAPI.create({ engine:{}, hud:R.hud, coach:R.coach });
      R.modeInst?.start?.({ time:R.matchTime, difficulty:R.diff });
    }else if(R.modeAPI.init){
      R.modeAPI.init(R.state, R.hud, { time:R.matchTime, life:1600 });
    }else if(R.modeAPI.start){
      R.modeAPI.start({ time:R.matchTime, difficulty:R.diff });
    }

    // hide menu
    const mb = $('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

    // countdown then start
    await runCountdown();
    R.coach?.onStart?.();

    R.playing=true;
    R._secMark = performance.now();
    R._dtMark  = performance.now();
    syncHUD();
    requestAnimationFrame(gameTick);
  }

  // ----- menu bindings (already handled by index binder for Start) -----
  // Keyboard helpers
  window.addEventListener('keydown',(e)=>{
    if(e.key==='p' || e.key==='P'){ if(R.playing){ setPaused(!R.paused); e.preventDefault(); } }
    if((e.key==='Enter'||e.key===' ') && !R.playing){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  },{passive:false});

  // Auto-pause when tab hidden
  document.addEventListener('visibilitychange',()=>{ if(document.hidden && R.playing && !R.paused) setPaused(true); });

  // ----- toast helper -----
  function toast(text){ R.hud?.toast?.(text); }

  // ----- expose -----
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;
  window.HHA.pause     = ()=>setPaused(true);
  window.HHA.resume    = ()=>setPaused(false);

  // canvases never block clicks
  setTimeout(()=>{ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);
})();
