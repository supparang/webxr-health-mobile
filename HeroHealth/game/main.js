// === Hero Health Academy — /game/main.js (countdown + wall-clock second timer) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function(){
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  let HUDClass, CoachClass, ScoreSystem, SFXClass, Quests, Progress;

  async function loadCore(){
    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch { HUDClass = class { constructor(){} setTop(){} setTimer(){} updateHUD(){} setQuestChips(){} showFever(){} resetBars(){} showBig(){} showFloatingText(){} showResult(){} hideResult(){} toast(){} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch { CoachClass = class { constructor(){} onStart(){} onBad(){} onTimeLow(){} onQuestStart(){} onQuestDone(){} onFever(){} onEnd(){} }; }

    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class { constructor(){this.value=0;this.combo=0;this.bestCombo=0;this.fever={active:false,charge:0,timeLeft:0};} add(n=0){this.value+=(n|0); if(n>0){this.combo++; if(this.combo>this.bestCombo)this.bestCombo=this.combo;} else {this.combo=0;}} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch {
      SFXClass = class {
        constructor(){ this._on=true; }
        setEnabled(v){ this._on=!!v; } isEnabled(){ return !!this._on; }
        _p(id){ if(!this._on) return; const a=document.getElementById(id); try{ a&&(a.currentTime=0); a&&a.play&&a.play(); }catch{} }
        good(){this._p('sfx-good')} bad(){this._p('sfx-bad')} perfect(){this._p('sfx-perfect')}
        tick(){this._p('sfx-tick')} power(){this._p('sfx-powerup')}
        bgmMain(on){ const a=$('#bgm-main');  try{ a&&(a.loop=true); on?a.play():a.pause(); }catch{} }
        bgmFever(on){ const a=$('#bgm-fever'); try{ a&&(a.loop=true); on?a.play():a.pause(); }catch{} }
      };
    }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch {
      Quests = {
        bindToMain(){return this;}, beginRun(){}, event(){}, tick(){}, endRun(){return{list:[],totalDone:0}}
      };
    }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, getStatSnapshot(){return{}} }; }
  }

  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return { name:mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null, start:mod.start||null, cleanup:mod.cleanup||null, setFever:mod.setFever||null };
  }

  // --- Emergency builtin (ย่อ) ---
  function BuiltinGoodJunk(){
    let alive=false,t=0,interval=0.6,host=null,fever=false;
    function H(){ host=document.getElementById('spawnHost')||document.body; }
    function spawn(bus){
      H();
      const good=Math.random()<0.72, golden=Math.random()<0.12;
      const G=['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍇'], B=['🍔','🍟','🍕','🍩','🍫','🥤'];
      const glyph=golden?'🌟':(good?G[Math.random()*G.length|0]:B[Math.random()*B.length|0]);
      const d=document.createElement('button'); d.textContent=glyph; d.type='button';
      Object.assign(d.style,{position:'fixed',left:(56+Math.random()*(innerWidth-112))+'px',top:(96+Math.random()*(innerHeight-240))+'px',transform:'translate(-50%,-50%)',font:`900 ${golden?64:54}px ui-rounded`,border:0,background:'transparent',filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',cursor:'pointer',zIndex:5500});
      const kill=setTimeout(()=>{ try{d.remove();}catch{} if(good) bus?.miss?.({source:'good-timeout'}); }, (2.0+(golden?0.28:0))*1000|0);
      d.addEventListener('click',(ev)=>{ clearTimeout(kill); try{d.remove();}catch{}; if(good){ const perfect=golden||Math.random()<0.2; const pts=Math.round((perfect?200:100)*(fever?1.5:1)); bus?.hit?.({kind:perfect?'perfect':'good',points:pts,ui:{x:ev.clientX,y:ev.clientY},meta:{good:1,golden:golden?1:0}}); } else { bus?.bad?.({source:'junk-click'}); } }, {passive:true});
      host.appendChild(d);
    }
    return { start(){ alive=true; t=0; H(); for(let i=0;i<3;i++) spawn(busFor()); }, setFever(on){ fever=!!on; }, update(dt){ if(!alive)return; t+=dt; while(t>=interval){ t-=interval; spawn(busFor()); } }, cleanup(){ alive=false; try{ (document.getElementById('spawnHost')||{}).innerHTML=''; }catch{} } };
  }

  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode,diff){ const base=(TIME_BY_MODE[mode]??45); if(diff==='Easy') return base+5; if(diff==='Hard') return Math.max(20,base-5); return base; }

  const R = {
    playing:false, paused:false, remain:45,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, coach:null,
    matchTime:45, fever:false,
    gold:0, goods:0, junkBad:0, misses:0,
    _dtMark:0, _lastRAF:0, _activity:0,
    _usingBuiltin:false,
    _secTimer:null, _engineTimer:null, _safetyPump:null
  };
  let hud=null;

  function markActivity(){ R._activity = performance.now(); }
  function setTopHUD(){ hud?.setTop({mode:R.modeKey,diff:R.diff}); hud?.setTimer(R.remain); hud?.updateHUD(R.sys.score?.get?.()||0, R.sys.score?.combo|0); }

  // ---- Fever (stub) ----
  function feverOn(){ if(R.fever) return; R.fever=true; hud?.showFever(true); R.sys.sfx?.bgmMain(false); R.sys.sfx?.bgmFever(true); R.modeAPI?.setFever?.(true); }
  function feverOff(){ if(!R.fever) return; R.fever=false; hud?.showFever(false); R.sys.sfx?.bgmFever(false); R.sys.sfx?.bgmMain(true); R.modeAPI?.setFever?.(false); }

  // ---- Bus ----
  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit:(e)=>{ markActivity();
        const pts=(e?.points)|0; if(pts) R.sys.score.add(pts,{kind:e?.kind});
        if(e?.meta?.gold===1 || e?.meta?.power==='gold') R.gold++; if(e?.meta?.good) R.goods++;
        hud && e?.ui && hud.showFloatingText(e.ui.x,e.ui.y,`+${pts}`);
        Quests?.event?.('hit',{...e,pointsAccum:R.sys.score.get?.()||0,comboNow:R.sys.score.combo|0});
        setTopHUD();
      },
      miss:(info)=>{ markActivity(); R.misses++; R.sys.score.add(0,{kind:'miss'}); Quests?.event?.('miss',info||{}); setTopHUD(); },
      bad:(info)=>{ markActivity(); R.junkBad++; R.sys.score.add(0,{kind:'bad'}); R.sys.sfx?.bad?.(); Quests?.event?.('bad',info||{}); setTopHUD(); },
      power:(kind)=>{ markActivity(); R.sys.sfx?.power?.(); Quests?.event?.('power',{kind}); setTopHUD(); }
    };
  }

  // ---- Render step (ไม่ลดเวลาแล้ว) ----
  function step(dt){
    if(!R.playing || R.paused) return;
    try{ R.modeAPI?.update?.(dt, busFor()); }catch(e){ console.warn('[mode.update]', e); }
    try{ R.modeInst?.update?.(dt, busFor()); }catch(e){ console.warn('[inst.update]', e); }
  }
  function tickRAF(){
    const now = performance.now();
    const dt = Math.max(0,(now-(R._dtMark||now))/1000); R._dtMark=now; R._lastRAF=now;
    step(dt);
    requestAnimationFrame(tickRAF);
  }

  // ---- Second ticker (แยกเวลาแน่ๆ) ----
  function startSecondTicker(){
    stopSecondTicker();
    R._secTimer = setInterval(()=>{
      if(!R.playing || R.paused) return;
      R.remain = Math.max(0,(R.remain|0)-1);
      hud?.setTimer(R.remain);
      Quests?.tick?.({score:R.sys.score.get?.()||0,dt:1,fever:R.fever});
      if(R.remain===10) R.coach?.onTimeLow?.();
      if(R.remain<=0) endGame();
    }, 1000);
  }
  function stopSecondTicker(){ if(R._secTimer){ clearInterval(R._secTimer); R._secTimer=null; } }

  // ---- Countdown overlay ----
  function showCountdown(cb){
    const id='countdown';
    let el = document.getElementById(id);
    if(!el){
      el = document.createElement('div');
      el.id=id;
      el.style.cssText='position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);font:900 120px ui-rounded,system-ui;color:#ffe8b0;text-shadow:0 10px 40px rgba(0,0,0,.6);z-index:3000;pointer-events:none;opacity:0;transition:opacity .2s, transform .2s';
      document.body.appendChild(el);
    }
    const seq=['3','2','1','GO!'];
    let i=0;
    const run=()=>{
      el.textContent = seq[i];
      el.style.opacity='1'; el.style.transform='translate(-50%,-50%) scale(1)';
      setTimeout(()=>{
        el.style.opacity='0'; el.style.transform='translate(-50%,-50%) scale(.92)';
        if(seq[i]==='GO!'){ setTimeout(()=>{ try{ el.remove(); }catch{}; cb(); }, 240); }
        else { setTimeout(()=>{ i++; run(); }, 260); }
      }, 420);
    };
    run();
  }

  // ---- Start / End / Pause ----
  async function startGame(){
    if(window.HHA?._busy) return; window.HHA=window.HHA||{}; window.HHA._busy=true;
    await loadCore(); Progress?.init?.();

    R.modeKey=document.body.getAttribute('data-mode')||'goodjunk';
    R.diff   =document.body.getAttribute('data-diff')||'Normal';
    R.matchTime=getMatchTime(R.modeKey,R.diff);
    R.remain=R.matchTime|0;

    R.gold=0; R.goods=0; R.junkBad=0; R.misses=0;
    R._dtMark=performance.now(); markActivity();
    R._usingBuiltin=false;

    hud=new HUDClass(); hud.hideResult?.(); hud.resetBars?.();
    hud.setTop?.({mode:R.modeKey,diff:R.diff}); hud.setTimer?.(R.remain); hud.updateHUD?.(0,0);

    R.sys.score=new ScoreSystem(); R.sys.score.reset?.();
    R.sys.sfx  =new SFXClass();

    R.coach=new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') }); R.coach?.onStart?.();
    Quests?.bindToMain?.({hud,coach:R.coach}); Quests?.beginRun?.(R.modeKey,R.diff,(localStorage.getItem('hha_lang')||'TH'),R.matchTime);

    // load mode
    let api=null;
    try{ api=await loadMode(R.modeKey); }catch(e){ console.error('[HHA] loadMode fail', e); }
    if(!api || (!api.update && !api.create)){ const B=BuiltinGoodJunk(); api={update:B.update.bind(B),start:B.start.bind(B),cleanup:B.cleanup.bind(B),setFever:B.setFever.bind(B)}; R._usingBuiltin=true; }
    R.modeAPI=api;

    if(api?.create){ R.modeInst=api.create({engine:{},hud,coach:R.coach}); try{ R.modeInst?.start?.({time:R.matchTime,difficulty:R.diff}); }catch{} }
    if(api?.start){ try{ api.start({time:R.matchTime,difficulty:R.diff}); }catch{} }

    // Prime one update กันจอดำ
    try{ api?.update?.(0.5, busFor()); R.modeInst?.update?.(0.5, busFor()); }catch{}

    // UI & BGM
    $('#menuBar')?.setAttribute('data-hidden','1'); $('#menuBar')&&( $('#menuBar').style.display='none' );
    document.body.setAttribute('data-playing','1');
    R.sys.sfx?.bgmFever(false); R.sys.sfx?.bgmMain(true);

    // ---- Countdown แล้วค่อยเริ่ม loop + second ticker ----
    showCountdown(()=>{
      R.playing=true; R.paused=false;
      R._dtMark=performance.now(); setTopHUD();

      // Loops
      requestAnimationFrame(tickRAF);
      clearInterval(R._engineTimer); R._engineTimer=setInterval(()=>step(1/30), 1000/30);
      startSecondTicker();

      // Safety pump กัน idle
      clearInterval(R._safetyPump);
      R._safetyPump=setInterval(()=>{
        if(!R.playing || R.paused) return;
        const idleFor = performance.now() - (R._activity||0);
        if(idleFor > 1200){
          try{ R.modeAPI?.update?.(0.9, busFor()); R.modeInst?.update?.(0.9, busFor()); }catch{}
          markActivity();
        }
      }, 600);

      window.HHA._busy=false;
    });
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false;
    clearInterval(R._engineTimer); clearInterval(R._safetyPump); stopSecondTicker();

    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(); }catch{}
    const score=R.sys.score?.get?R.sys.score.get():0, bestC=R.sys.score?.bestCombo|0;
    const stars=(score>=2000)?5:(score>=1500)?4:(score>=1000)?3:(score>=600)?2:(score>=200)?1:0;
    const qsum=Quests?.endRun?.({score})||{list:[],totalDone:0};

    hud?.showResult?.({
      title:'Result',
      desc:`Mode: ${R.modeKey} • Diff: ${R.diff}\n⭐ ${'★'.repeat(stars)}${'☆'.repeat(5-stars)}`,
      stats:[`Score: ${score}`,`Best Combo: ${bestC}`,`Time: ${R.matchTime|0}s`,`Gold: ${R.gold}`,`Goods: ${R.goods}`,`Miss: ${R.misses}`,`Bad: ${R.junkBad}`,`Quests Done: ${qsum.totalDone}/3`],
      extra:(qsum.list||[]).map(q=>`${q.done?'✔':(q.fail?'✘':'…')} ${q.label} (${q.progress||0}/${q.need||0})`)
    });

    hud.onHome=()=>{ hud.hideResult?.(); document.body.removeAttribute('data-playing'); feverOff(); R.sys.sfx?.bgmMain(false); const mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; } };
    hud.onRetry=()=>{ hud.hideResult?.(); feverOff(); startGame(); };

    R.coach?.onEnd?.(score); Progress?.endRun?.({score,bestCombo:bestC}); R.sys.sfx?.bgmMain(false);
  }

  function setPaused(on){
    if(!R.playing) return;
    R.paused=!!on;
    if(R.paused){ R.sys.sfx?.bgmMain(false); R.sys.sfx?.bgmFever(false); hud?.toast?.('Paused'); }
    else { R.sys.sfx?.bgmMain(true); if(R.fever) R.sys.sfx?.bgmFever(true); markActivity(); hud?.toast?.('Resume'); }
  }

  // Expose
  window.HHA=window.HHA||{}; window.HHA.startGame=startGame; window.HHA.endGame=endGame; window.HHA.pause=()=>setPaused(true); window.HHA.resume=()=>setPaused(false);

  // canvases never block UI
  setTimeout(()=>{ $$('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} }); },0);

  // quick start
  window.addEventListener('keydown',(e)=>{ if((e.key==='Enter'||e.key===' ')&&!R.playing){ const menuVisible=!($('#menuBar')?.hasAttribute('data-hidden')); if(menuVisible){ e.preventDefault(); startGame(); } } },{passive:false});
})();
