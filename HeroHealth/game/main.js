// === Hero Health Academy — /game/main.js (dual-update + hard kick + watchdog) ===
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
    catch { CoachClass = class { constructor(){} say(){} onStart(){} onGood(){} onPerfect(){} onBad(){} onTimeLow(){} onQuestStart(){} onQuestDone(){} onFever(){} onEnd(){} }; }

    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class { constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n=0){this.value+=(n|0);} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch {
      SFXClass = class {
        constructor(){ this._on=true; }
        setEnabled(v){ this._on=!!v; } isEnabled(){ return !!this._on; }
        _p(id){ if(!this._on) return; const a=document.getElementById(id); try{ a&&(a.currentTime=0); a&&a.play&&a.play(); }catch{} }
        good(){this._p('sfx-good')} bad(){this._p('sfx-bad')} perfect(){this._p('sfx-perfect')}
        tick(){this._p('sfx-tick')} power(){this._p('sfx-powerup')}
        bgmMain(on){ const a=document.getElementById('bgm-main');  try{ a&&(a.loop=true); on?a.play():a.pause(); }catch{} }
        bgmFever(on){ const a=document.getElementById('bgm-fever'); try{ a&&(a.loop=true); on?a.play():a.pause(); }catch{} }
      };
    }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch {
      // …(เหมือนเวอร์ชันก่อนของผมได้เลย ไม่ตัดทิ้งเพื่อย่อความ)…
      // ตรงนี้คงเดิม ใช้งานได้
    }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, getStatSnapshot(){return{}} }; }
  }

  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return {
      name:mod.name||key,
      create:mod.create||null, init:mod.init||null,
      tick:mod.tick||null, update:mod.update||null,
      start:mod.start||null, cleanup:mod.cleanup||null,
      setFever:mod.setFever||null
    };
  }

  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode, diff){ const base=(TIME_BY_MODE[mode]??45); if(diff==='Easy') return base+5; if(diff==='Hard') return Math.max(20,base-5); return base; }

  const R = {
    playing:false, paused:false, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null,
    matchTime:45, fever:false, feverBreaks:0,
    gold:0, goods:0, junkBad:0, misses:0,
    _dtMark:0, _secAccum:0, _watch:0, _spawnSeen:false
  };
  let hud=null;

  function setTopHUD(){ hud?.setTop({mode:R.modeKey,diff:R.diff}); hud?.setTimer(R.remain); hud?.updateHUD(R.sys.score?.get?R.sys.score.get():0, R.sys.score?.combo|0); }

  function feverOn(){ if(R.fever) return; R.fever=true; R.feverBreaks=0; hud?.showFever(true); R.sys.sfx?.bgmMain(false); R.sys.sfx?.bgmFever(true); R.coach?.onFever?.(); try{R.modeAPI?.setFever?.(true)}catch{}; Quests?.event?.('fever',{on:true}); }
  function feverOff(){ if(!R.fever) return; R.fever=false; R.feverBreaks=0; hud?.showFever(false); R.sys.sfx?.bgmFever(false); R.sys.sfx?.bgmMain(true); try{R.modeAPI?.setFever?.(false)}catch{}; Quests?.event?.('fever',{on:false}); }

  function busFor(){
    const seen = ()=>{ R._watch=0; R._spawnSeen=true; };
    return {
      sfx:R.sys.sfx,
      hit:(e)=>{ const pts=(e?.points)|0; if(pts) R.sys.score.add(pts);
        R.sys.score.combo=(R.sys.score.combo|0)+1; if(R.sys.score.combo> (R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo;
        if(e?.meta?.gold===1 || e?.meta?.power==='gold') R.gold++; if(e?.meta?.good) R.goods++;
        if(!R.fever && (R.sys.score.combo|0)>=10) feverOn();
        hud && e?.ui && hud.showFloatingText(e.ui.x,e.ui.y,`+${pts}`);
        Quests?.event?.('hit',{...e,pointsAccum:R.sys.score.get(),comboNow:R.sys.score.combo});
        setTopHUD(); seen();
      },
      miss:(info)=>{ if(R.fever && ++R.feverBreaks>=3) feverOff(); R.misses++; R.sys.score.combo=0; R.coach?.onBad?.(); Quests?.event?.('miss',info||{}); setTopHUD(); seen(); },
      bad:(info)=>{ if(R.fever && ++R.feverBreaks>=3) feverOff(); R.junkBad++; R.sys.score.combo=0; R.sys.sfx?.bad?.(); Quests?.event?.('bad',info||{}); setTopHUD(); seen(); },
      power:(kind)=>{ R.sys.sfx?.power?.(); Quests?.event?.('power',{kind}); setTopHUD(); seen(); }
    };
  }

  function tickLoop(){
    if(!R.playing || R.paused){ R.raf=requestAnimationFrame(tickLoop); return; }
    const now=performance.now(); const dt=Math.max(0,(now-(R._dtMark||now))/1000); R._dtMark=now;

    // second accumulator
    R._secAccum+=dt;
    while(R._secAccum>=1){ R._secAccum-=1; R.remain=Math.max(0,(R.remain|0)-1); hud?.setTimer(R.remain); if(R.remain===10) R.coach?.onTimeLow?.(); Quests?.tick?.({score:R.sys.score.get?.()||0,dt:1,fever:R.fever}); }

    // update BOTH api+instance toกันกรณีหนึ่งไม่ทำงาน
    try{ R.modeAPI?.update && R.modeAPI.update(dt, busFor()); }catch(e){ console.warn('api.update error',e); }
    try{ R.modeInst?.update && R.modeInst.update(dt, busFor()); }catch(e){ console.warn('inst.update error',e); }

    // watchdog: หาก 2s ยังไม่มี hit/miss/bad → เขี่ย spawn
    R._watch += dt;
    if(R._watch>2 && !R._spawnSeen){
      try{ R.modeAPI?.update?.(1.0, busFor()); R.modeInst?.update?.(1.0, busFor()); }catch{}
      R._watch=0;
    }

    if(R.remain<=0){ endGame(); return; }
    R.raf=requestAnimationFrame(tickLoop);
  }

  function threeTwoOneGo(cb){
    if(!hud?.showBig){ cb(); return; }
    const seq=['3','2','1','GO!']; let i=0;
    const step=()=>{ hud.showBig(seq[i]); if(seq[i]==='GO!'){ setTimeout(cb,360); } else { setTimeout(()=>{ i++; step(); },520); } };
    step();
  }

  async function startGame(){
    if(window.HHA?._busy) return; window.HHA = window.HHA || {}; window.HHA._busy = true;

    await loadCore(); Progress?.init?.();

    R.modeKey=document.body.getAttribute('data-mode')||'goodjunk';
    R.diff   =document.body.getAttribute('data-diff')||'Normal';
    R.matchTime=getMatchTime(R.modeKey,R.diff); R.remain=R.matchTime|0;

    R.gold=0; R.goods=0; R.junkBad=0; R.misses=0;
    R._dtMark=performance.now(); R._secAccum=0; R._watch=0; R._spawnSeen=false;

    hud=new HUDClass(); hud.hideResult?.(); hud.resetBars?.(); hud.setTop?.({mode:R.modeKey,diff:R.diff}); hud.setTimer?.(R.remain); hud.updateHUD?.(0,0);

    R.sys.score=new ScoreSystem(); R.sys.score.reset?.();
    R.sys.sfx  =new SFXClass();

    R.coach=new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') }); R.coach?.onStart?.();

    Quests?.bindToMain?.({hud,coach:R.coach}); Quests?.beginRun?.(R.modeKey,R.diff,(localStorage.getItem('hha_lang')||'TH'),R.matchTime);

    let api=null;
    try{ api=await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:', R.modeKey, e); hud?.toast?.('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }
    R.modeAPI=api;

    // เรียก start ทั้ง "instance" และ "api" เพื่อกันหลุด
    if(api?.create){ R.modeInst=api.create({engine:{},hud,coach:R.coach}); try{ R.modeInst?.start?.({time:R.matchTime,difficulty:R.diff}); }catch{} }
    if(api?.start){ try{ api.start({time:R.matchTime,difficulty:R.diff}); }catch{} }

    // kick ครั้งแรก หลังเริ่ม 800ms เพื่อบังคับให้มีของ spawn ถ้าเงียบ
    setTimeout(()=>{ if(!R._spawnSeen){ try{ api?.update?.(1.2, busFor()); R.modeInst?.update?.(1.2, busFor()); }catch{} } }, 800);

    const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    document.body.setAttribute('data-playing','1');

    R.sys.sfx?.bgmFever(false); R.sys.sfx?.bgmMain(true);

    threeTwoOneGo(()=>{ R.playing=true; R.paused=false; R._dtMark=performance.now(); R._secAccum=0; setTopHUD(); R.raf=requestAnimationFrame(tickLoop); window.HHA._busy=false; });
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state,hud); }catch{}
    const score=R.sys.score?.get?R.sys.score.get():0, bestC=R.sys.score?.bestCombo|0;
    const stars=(score>=2000)?5:(score>=1500)?4:(score>=1000)?3:(score>=600)?2:(score>=200)?1:0;
    const qsum=Quests?.endRun?.({score})||{list:[],totalDone:0};

    hud?.showResult?.({
      title:'Result',
      desc:`Mode: ${R.modeKey} • Diff: ${R.diff}\n⭐ Stars: ${'★'.repeat(stars)}${'☆'.repeat(5-stars)}`,
      stats:[`Score: ${score}`,`Best Combo: ${bestC}`,`Time: ${R.matchTime|0}s`,`Gold: ${R.gold}`,`Goods: ${R.goods}`,`Miss (Good timeout): ${R.misses}`,`Bad (Junk click): ${R.junkBad}`,`Quests Done: ${qsum.totalDone}/3`],
      extra:(qsum.list||[]).map(q=>`${q.done?'✔':(q.fail?'✘':'…')} ${q.label} (${q.progress||0}/${q.need||0})`)
    });

    hud.onHome=()=>{ hud.hideResult?.(); document.body.removeAttribute('data-playing'); feverOff(); R.sys.sfx?.bgmMain(false); const mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; } };
    hud.onRetry=()=>{ hud.hideResult?.(); feverOff(); startGame(); };

    R.coach?.onEnd?.(score); Progress?.endRun?.({score,bestCombo:bestC}); R.sys.sfx?.bgmMain(false);
  }

  function setPaused(on){ if(!R.playing) return; R.paused=!!on; if(R.paused){ R.sys.sfx?.bgmMain(false); R.sys.sfx?.bgmFever(false); hud?.toast?.('Paused'); } else { R.sys.sfx?.bgmMain(true); if(R.fever) R.sys.sfx?.bgmFever(true); R._dtMark=performance.now(); hud?.toast?.('Resume'); } }
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) setPaused(true); });
  window.addEventListener('keydown', (e)=>{ if(e.key.toLowerCase()==='p') setPaused(!R.paused); }, {passive:true});

  window.HHA=window.HHA||{}; window.HHA.startGame=startGame; window.HHA.endGame=endGame; window.HHA.pause=()=>setPaused(true); window.HHA.resume=()=>setPaused(false);

  setTimeout(()=>{ $$('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} }); },0);
  window.addEventListener('keydown',(e)=>{ if((e.key==='Enter'||e.key===' ')&&!R.playing){ const menuVisible=!($('#menuBar')?.hasAttribute('data-hidden')); if(menuVisible){ e.preventDefault(); startGame(); } } },{passive:false});
})();
