// === Hero Health Academy — /game/main.js (2025-11-02 FULL — countdown + wall-clock timer) ===
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
    catch { Quests = { bindToMain(){return this;}, beginRun(){}, event(){}, tick(){}, endRun(){return{list:[],totalDone:0}} }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, getStatSnapshot(){return{}} }; }
  }

  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return { name:mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null, start:mod.start||null, cleanup:mod.cleanup||null, setFever:mod.setFever||null };
  }

  // ---------- builtin fallback ----------
  function BuiltinGoodJunk(){
    let alive=false,t=0,interval=0.6,host=null,fever=false;
    function H(){ host=document.getElementById('spawnHost')||document.body; }
    function spawn(bus){
      H();
      const good=Math.random()<0.72, golden=Math.random()<0.12;
      const G=['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍇'], B=['🍔','🍟','🍕','🍩','🍫','🥤'];
      const glyph=golden?'🌟':(good?G[Math.random()*G.length|0]:B[Math.random()*B.length|0]);
      const d=document.createElement('button'); d.textContent=glyph;
      Object.assign(d.style,{position:'fixed',left:(56+Math.random()*(innerWidth-112))+'px',top:(96+Math.random()*(innerHeight-240))+'px',transform:'translate(-50%,-50%)',font:`900 ${golden?64:54}px ui-rounded`,border:0,background:'transparent',filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',cursor:'pointer',zIndex:5500});
      const kill=setTimeout(()=>{ try{d.remove();}catch{} if(good) bus?.miss?.({source:'good-timeout'}); }, (2.0+(golden?0.28:0))*1000|0);
      d.addEventListener('click',(ev)=>{ clearTimeout(kill); try{d.remove();}catch{}; if(good){ const perfect=golden||Math.random()<0.2; const pts=Math.round((perfect?200:100)*(fever?1.5:1)); bus?.hit?.({kind:perfect?'perfect':'good',points:pts,ui:{x:ev.clientX,y:ev.clientY},meta:{good:1,golden:golden?1:0}}); } else { bus?.bad?.({source:'junk-click'}); } }, {passive:true});
      host.appendChild(d);
    }
    return { start(){ alive=true; for(let i=0;i<3;i++) spawn(busFor()); }, setFever(on){fever=!!on;}, update(dt){ if(!alive)return; t+=dt; while(t>=interval){t-=interval;spawn(busFor());}}, cleanup(){alive=false;try{(document.getElementById('spawnHost')||{}).innerHTML='';}catch{}} };
  }

  const TIME_BY_MODE={goodjunk:45,groups:60,hydration:50,plate:55};
  function getMatchTime(mode,diff){ const base=(TIME_BY_MODE[mode]??45); if(diff==='Easy')return base+5; if(diff==='Hard')return Math.max(20,base-5); return base; }

  const R={playing:false,paused:false,remain:45,sys:{score:null,sfx:null},modeKey:'goodjunk',diff:'Normal',modeAPI:null,modeInst:null,coach:null,matchTime:45,fever:false,gold:0,goods:0,junkBad:0,misses:0,_activity:0,_usingBuiltin:false,_secTimer:null,_engineTimer:null,_safetyPump:null};
  let hud=null;

  function markActivity(){R._activity=performance.now();}
  function setTopHUD(){hud?.setTop({mode:R.modeKey,diff:R.diff});hud?.setTimer(R.remain);hud?.updateHUD(R.sys.score?.get?.()||0,R.sys.score?.combo|0);}

  // ---- wall-clock timer ----
  function startSecondTicker(){
    stopSecondTicker();
    R._t0Wall=performance.now();
    R._lastRemain=R.matchTime|0;
    R._secTimer=setInterval(()=>{
      if(!R.playing||R.paused)return;
      const now=performance.now();
      const elapsed=Math.floor((now-(R._t0Wall||now))/1000);
      const newRemain=Math.max(0,(R.matchTime|0)-elapsed);
      if(newRemain!==(R.remain|0)){
        R.remain=newRemain;
        hud?.setTimer(R.remain);
        const dt=Math.max(1,Math.abs(newRemain-(R._lastRemain|0)));
        Quests?.tick?.({score:R.sys.score.get?.()||0,dt,fever:R.fever});
        if(R.remain===10)R.coach?.onTimeLow?.();
        R._lastRemain=R.remain;
        if(R.remain<=0){endGame();return;}
      }
    },250);
  }
  function stopSecondTicker(){if(R._secTimer){clearInterval(R._secTimer);R._secTimer=null;}}

  // ---- countdown overlay ----
  function showCountdown(cb){
    let el=document.getElementById('countdown');
    if(!el){
      el=document.createElement('div');
      el.id='countdown';
      el.style.cssText='position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);font:900 120px ui-rounded,system-ui;color:#ffe8b0;text-shadow:0 10px 40px rgba(0,0,0,.6);z-index:3000;pointer-events:none;opacity:0;transition:opacity .2s,transform .2s';
      document.body.appendChild(el);
    }
    const seq=['3','2','1','GO!'];let i=0;
    const run=()=>{
      el.textContent=seq[i];
      el.style.opacity='1';el.style.transform='translate(-50%,-50%) scale(1)';
      setTimeout(()=>{
        el.style.opacity='0';el.style.transform='translate(-50%,-50%) scale(.9)';
        if(seq[i]==='GO!'){setTimeout(()=>{try{el.remove();}catch{};cb();},240);}
        else setTimeout(()=>{i++;run();},260);
      },420);
    };
    run();
  }

  function busFor(){
    return{
      sfx:R.sys.sfx,
      hit:(e)=>{markActivity();const pts=(e?.points)|0;if(pts)R.sys.score.add(pts,{kind:e?.kind});
        if(e?.meta?.gold===1||e?.meta?.power==='gold')R.gold++;if(e?.meta?.good)R.goods++;
        hud&&e?.ui&&hud.showFloatingText(e.ui.x,e.ui.y,`+${pts}`);Quests?.event?.('hit',{...e,pointsAccum:R.sys.score.get?.()||0,comboNow:R.sys.score.combo|0});setTopHUD();},
      miss:(i)=>{markActivity();R.misses++;R.sys.score.add(0);Quests?.event?.('miss',i||{});setTopHUD();},
      bad:(i)=>{markActivity();R.junkBad++;R.sys.score.add(0);R.sys.sfx?.bad?.();Quests?.event?.('bad',i||{});setTopHUD();},
      power:(k)=>{markActivity();R.sys.sfx?.power?.();Quests?.event?.('power',{k});setTopHUD();}
    };
  }

  function step(dt){if(!R.playing||R.paused)return;try{R.modeAPI?.update?.(dt,busFor());R.modeInst?.update?.(dt,busFor());}catch(e){console.warn('[mode.update]',e);}}
  function tickRAF(){step(1/60);requestAnimationFrame(tickRAF);}

  async function startGame(){
    if(window.HHA?._busy)return;window.HHA=window.HHA||{};window.HHA._busy=true;
    await loadCore();Progress?.init?.();

    R.modeKey=document.body.getAttribute('data-mode')||'goodjunk';
    R.diff=document.body.getAttribute('data-diff')||'Normal';
    R.matchTime=getMatchTime(R.modeKey,R.diff);R.remain=R.matchTime|0;
    R.gold=R.goods=R.junkBad=R.misses=0;R._usingBuiltin=false;

    hud=new HUDClass();hud.hideResult?.();hud.resetBars?.();hud.setTop?.({mode:R.modeKey,diff:R.diff});hud.setTimer?.(R.remain);hud.updateHUD?.(0,0);
    R.sys.score=new ScoreSystem();R.sys.sfx=new SFXClass();
    R.coach=new CoachClass({lang:(localStorage.getItem('hha_lang')||'TH')});R.coach?.onStart?.();
    Quests?.bindToMain?.({hud,coach:R.coach});Quests?.beginRun?.(R.modeKey,R.diff);

    let api=null;
    try{api=await loadMode(R.modeKey);}catch(e){console.error('[loadMode]',e);}
    if(!api||(!api.update&&!api.create)){const B=BuiltinGoodJunk();api={update:B.update.bind(B),start:B.start.bind(B),cleanup:B.cleanup.bind(B)};R._usingBuiltin=true;}
    R.modeAPI=api;if(api?.create){R.modeInst=api.create({hud,coach:R.coach});R.modeInst?.start?.({time:R.matchTime,difficulty:R.diff});}
    api?.start?.({time:R.matchTime,difficulty:R.diff});
    try{api?.update?.(0.5,busFor());}catch{}

    $('#menuBar')?.setAttribute('data-hidden','1');$('#menuBar').style.display='none';document.body.setAttribute('data-playing','1');
    R.sys.sfx?.bgmMain(true);

    showCountdown(()=>{
      R.playing=true;R.paused=false;R._t0Wall=performance.now();setTopHUD();
      requestAnimationFrame(tickRAF);
      clearInterval(R._engineTimer);R._engineTimer=setInterval(()=>step(1/30),1000/30);
      startSecondTicker();
      clearInterval(R._safetyPump);
      R._safetyPump=setInterval(()=>{if(!R.playing||R.paused)return;const idle=performance.now()-(R._activity||0);if(idle>1200){try{R.modeAPI?.update?.(0.9,busFor());}catch{}markActivity();}},600);
      window.HHA._busy=false;
    });
  }

  function endGame(){
    if(!R.playing)return;R.playing=false;
    clearInterval(R._engineTimer);clearInterval(R._safetyPump);stopSecondTicker();
    try{R.modeInst?.cleanup?.();R.modeAPI?.cleanup?.();}catch{}
    const score=R.sys.score?.get?.()||0,bestC=R.sys.score?.bestCombo|0;
    const stars=(score>=2000)?5:(score>=1500)?4:(score>=1000)?3:(score>=600)?2:(score>=200)?1:0;
    const qsum=Quests?.endRun?.({score})||{list:[],totalDone:0};
    hud?.showResult?.({title:'Result',desc:`Mode: ${R.modeKey} • Diff: ${R.diff}\n⭐ ${'★'.repeat(stars)}${'☆'.repeat(5-stars)}`,
      stats:[`Score: ${score}`,`Best Combo: ${bestC}`,`Time: ${R.matchTime}s`,`Gold:${R.gold}`,`Goods:${R.goods}`,`Miss:${R.misses}`,`Bad:${R.junkBad}`,`Quests Done:${qsum.totalDone}/3`],
      extra:(qsum.list||[]).map(q=>`${q.done?'✔':(q.fail?'✘':'…')} ${q.label} (${q.progress||0}/${q.need||0})`)});
    hud.onHome=()=>{hud.hideResult?.();document.body.removeAttribute('data-playing');R.sys.sfx?.bgmMain(false);$('#menuBar').style.display='flex';};
    hud.onRetry=()=>{hud.hideResult?.();startGame();};
    R.coach?.onEnd?.(score);Progress?.endRun?.({score,bestCombo:bestC});
  }

  window.HHA=window.HHA||{};window.HHA.startGame=startGame;window.HHA.endGame=endGame;
  setTimeout(()=>{$$('canvas').forEach(c=>{try{c.style.pointerEvents='none';c.style.zIndex='1';}catch{}});},0);
})();
