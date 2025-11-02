// === Hero Health Academy — game/main.js (PROD all-in: timer/score/combo + Fever + 3-2-1 + penalties + Result) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function(){
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

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
    catch { SFXClass = class { constructor(){this._on=true;} isEnabled(){return !!this._on;} setEnabled(v){this._on=!!v;} good(){} bad(){} perfect(){} power(){} tick(){} }; }
    try { ({ Quests } = await import('./core/quests.js')); }
    catch {
      Quests = { bindToMain(){return{refresh(){}};}, beginRun(){}, endRun(){return {totalDone:0,stars:0,hitsGold:0,penalties:0,misses:0,selected:[]}}, event(){}, tick(){} };
    }
    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};} }; }
    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = class {
        constructor(o={}){ this.lang=(localStorage.getItem('hha_lang')||o.lang||'TH').toUpperCase(); this._ensure(); }
        _ensure(){ this.box=$('#coachBox'); if(!this.box){ this.box=document.createElement('div'); this.box.id='coachBox';
          this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001'; document.body.appendChild(this.box);} }
        say(t){ if(!this.box) return; this.box.textContent=t||''; this.box.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>{this.box.style.display='none';},1400); }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(sc){ this.say((sc|0)>=200?(this.lang==='EN'?'Awesome!':'สุดยอด!'):(this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }
    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch {
      // Very small fallback (แต่ของจริงอยู่ใน core/hud.js ด้านล่าง)
      HUDClass = class {
        constructor(){
          this.root=$('#hud')||Object.assign(document.createElement('div'),{id:'hud'});
          if(!$('#hud')){ this.root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2000;'; document.body.appendChild(this.root); }
          const top=document.createElement('div'); top.style.cssText='position:absolute;left:12px;right:12px;top:10px;display:flex;justify-content:space-between;gap:8px';
          top.innerHTML='<div><span id="hudMode"></span> <span id="hudDiff"></span> <span id="hudTime"></span></div><div>Score: <b id="hudScore">0</b> • Combo: <b id="hudCombo">0</b> • ⭐ <b id="hudStars">0</b></div>';
          this.root.appendChild(top);
          this.$mode=top.querySelector('#hudMode'); this.$diff=top.querySelector('#hudDiff'); this.$time=top.querySelector('#hudTime'); this.$score=top.querySelector('#hudScore'); this.$combo=top.querySelector('#hudCombo'); this.$stars=top.querySelector('#hudStars');
          this.result=document.createElement('div'); this.result.id='resultModal'; this.result.style.cssText='position:absolute;inset:0;display:none;align-items:center;justify-content:center'; this.root.appendChild(this.result);
        }
        setTop({mode,diff}={}){ if(mode!=null) this.$mode.textContent=mode; if(diff!=null) this.$diff.textContent=diff; }
        setTimer(s){ this.$time.textContent=(s|0)+'s'; }
        updateHUD(sc,cb){ this.$score.textContent=sc|0; this.$combo.textContent=cb|0; }
        setStars(n){ this.$stars.textContent=n|0; }
        showFever(on){ document.body.classList.toggle('fever',!!on); }
        showFloatingText(){}
        showResult(){}
        hideResult(){}
        setQuestChips(){}
      };
    }
  }

  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return { name:mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null, start:mod.start||null, cleanup:mod.cleanup||null, setFever:mod.setFever||null };
  }

  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode='goodjunk', diff='Normal'){ const base=TIME_BY_MODE[mode]??45; if(diff==='Easy')return base+5; if(diff==='Hard')return Math.max(20,base-5); return base; }

  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null,
    matchTime:45, feverActive:false, feverBreaks:0,
    stars:0
  };
  let hud=null;

  function bigCenter(txt, ms=520){
    const el=document.createElement('div');
    el.textContent=txt;
    el.style.cssText='position:fixed;left:50%;top:42%;transform:translate(-50%,-50%) scale(.92);font:900 88px ui-rounded,system-ui;color:#fff;text-shadow:0 10px 44px rgba(0,0,0,.6);z-index:3000;opacity:0;transition:all .2s ease';
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translate(-50%,-50%) scale(1)'; });
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translate(-50%,-50%) scale(.96)'; }, ms);
    setTimeout(()=>{ try{el.remove();}catch{}; }, ms+180);
  }
  function syncTop(){ hud?.setTop?.({mode:R.modeKey,diff:R.diff}); hud?.setTimer?.(R.remain); hud?.updateHUD?.(R.sys?.score?.get?.()||0, R.sys?.score?.combo|0); hud?.setStars?.(R.stars|0); }

  function setFever(on){
    on=!!on; if(R.feverActive===on) return;
    R.feverActive=on; hud?.showFever?.(on); R.modeAPI?.setFever?.(on);
    document.body.classList.toggle('fever',on);
    try{ let f=$('#bgm-fever'); if(!f){ f=document.createElement('audio'); f.id='bgm-fever'; f.preload='auto'; f.src='assets/sfx/fever.mp3'; document.body.appendChild(f); }
      if(on){ f.currentTime=0; f.volume=0.9; f.play().catch(()=>{}); } }catch{}
  }

  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit:(e)=>{ // e:{kind, points, ui:{x,y}, meta:{gold:bool}}
        const pts=(e&&e.points)|0;
        if(pts){ R.sys.score.add(pts); R.sys.score.combo=(R.sys.score.combo|0)+1; if((R.sys.score.combo|0)>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo|0; }
        if(e?.meta?.gold || e?.kind==='gold'){ R.stars=(R.stars|0)+1; hud?.setStars?.(R.stars); }
        if(!R.feverActive && (R.sys.score.combo|0)>=10){ setFever(true); R.feverBreaks=0; try{Quests.event('fever',{on:true});}catch{} }
        if(e?.ui){ hud?.showFloatingText?.(e.ui.x, e.ui.y, `+${pts}`); }
        try{ Quests.event('hit',{ result:e?.kind||'good', meta:e?.meta||{}, points:pts, comboNow:R.sys.score.combo|0 }); }catch{}
        syncTop();
      },
      miss:(info={})=>{ // ONLY good-timeout
        if(R.feverActive){ R.feverBreaks++; if(R.feverBreaks>=3){ setFever(false); R.feverBreaks=0; try{Quests.event('fever',{on:false});}catch{} } }
        R.sys.score.combo=0;
        try{ Quests.event('miss',{by:info.by||'good-timeout'}); }catch{}
        R.coach?.onBad?.(); R.sys?.sfx?.bad?.(); syncTop();
      },
      penalty:(info={})=>{ // junk click
        R.sys.score.add(-50); R.sys.score.combo=0;
        try{ Quests.event('penalty',{by:info.by||'junk-click'}); }catch{}
        R.coach?.onBad?.(); R.sys?.sfx?.bad?.(); syncTop();
      },
      power:(k)=>{ try{ Quests.event('power',{kind:k}); }catch{} }
    };
  }

  function tick(){
    if(!R.playing) return;
    const now=performance.now();
    const secGone=Math.floor((now-R._secMark)/1000);
    if(secGone>=1){
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=now; hud?.setTimer?.(R.remain);
      if(R.remain<=10 && R.remain>0 && R._lastWarn!==R.remain){ R._lastWarn=R.remain; if(R.remain===10) R.coach?.onTimeLow?.(); bigCenter(String(R.remain), 520); }
      try{ Quests.tick({ score:(R.sys.score.get?.()||0), dt:secGone, fever:R.feverActive }); }catch{}
    }
    try{
      const dt=(now-(R._dtMark||now))/1000; R._dtMark=now;
      if(typeof R.modeAPI?.update==='function'){ R.modeAPI.update(dt, busFor()); }
      else if(R.modeInst?.update){ R.modeInst.update(dt, busFor()); }
      else if(R.modeAPI?.tick){ R.modeAPI.tick(R.state||{}, R.sys, hud||{}); }
    }catch(e){ console.warn('[mode.update] error',e); }

    if(R.remain<=0) return endGame();
    R.raf=requestAnimationFrame(tick);
  }

  async function countdown321(){ for(const s of ['3','2','1','GO!']){ bigCenter(s, 520); await new Promise(r=>setTimeout(r,520)); } }

  async function startGame(){
    if(window.HHA?._busy) return; window.HHA=window.HHA||{}; window.HHA._busy=true;
    await loadCore(); Progress.init?.();

    R.modeKey=document.body.getAttribute('data-mode')||'goodjunk';
    R.diff   =document.body.getAttribute('data-diff')||'Normal';
    R.matchTime=getMatchTime(R.modeKey,R.diff); R.remain=R.matchTime|0;
    R.stars=0;

    if(!hud) hud=new HUDClass();
    hud.hideResult?.(); hud.setTop?.({mode:R.modeKey,diff:R.diff}); hud.setTimer?.(R.remain); hud.updateHUD?.(0,0); hud.setStars?.(0); hud.showFever?.(false);
    document.body.classList.remove('fever');

    R.sys.score=new ScoreSystem(); R.sys.score.reset?.(); R.sys.score.combo=0; R.sys.score.bestCombo=0;
    R.sys.sfx  =new SFXClass();
    R.feverActive=false; R.feverBreaks=0;

    R.coach=new CoachClass({lang:(localStorage.getItem('hha_lang')||'TH')});
    Quests.bindToMain({ hud, coach:R.coach });
    Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime);

    let api; try{ api=await loadMode(R.modeKey); }catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); toast('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }
    R.modeAPI=api;

    await countdown321();

    R.state={ difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    if(api.create){ R.modeInst=api.create({ hud, coach:R.coach }); R.modeInst.start?.({time:R.matchTime,difficulty:R.diff}); }
    else if(api.init){ api.init(R.state, hud, {time:R.matchTime, life:1600}); }
    else if(api.start){ api.start({time:R.matchTime,difficulty:R.diff}); }

    R.playing=true; R.startedAt=performance.now(); R._secMark=performance.now(); R._dtMark=performance.now();
    const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    document.body.setAttribute('data-playing','1');
    R.coach?.onStart?.(); syncTop(); requestAnimationFrame(tick);
  }

  function endGame(){
    if(!R.playing) return; R.playing=false; cancelAnimationFrame(R.raf);
    const score=R.sys?.score?.get?.()||0, bestC=R.sys?.score?.bestCombo|0;
    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state,hud); }catch{}
    let qSum=null; try{ qSum=Quests.endRun({score}); }catch{}
    try{ R.coach?.onEnd?.(score); }catch{} try{ Progress.endRun?.({score, bestCombo:bestC}); }catch{}
    document.body.removeAttribute('data-playing');

    const stats=[`Score: ${score}`, `Best Combo: ${bestC}`, `Time: ${R.matchTime|0}s`, qSum?`Quests done: ${qSum.totalDone||0}/3`:null].filter(Boolean);
    const extra=[];
    if(qSum){ extra.push(`Stars: ${qSum.stars|0}`); extra.push(`Gold taps: ${qSum.hitsGold|0}`); extra.push(`Penalties: ${qSum.penalties|0}`); extra.push(`Misses: ${qSum.misses|0}`);
      (qSum.selected||[]).forEach(q=>{ extra.push(`${q.done?'✅':'❌'} ${q.label} (${q.progress}/${q.need})`); }); }

    try{
      if(!hud) hud=new HUDClass();
      hud.showResult({ title:'Result', desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`, stats, extra });
      hud.onHome = ()=>{ hud.hideResult(); const m2=$('#menuBar'); if(m2){ m2.removeAttribute('data-hidden'); m2.style.display='flex'; } };
      hud.onRetry= ()=>{ hud.hideResult(); startGame(); };
    }catch{ alert(`Score ${score}\nCombo ${bestC}`); }

    window.HHA._busy=false;
  }

  function toast(text){
    let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=String(text); el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200);
  }

  window.HHA=window.HHA||{}; window.HHA.startGame=startGame; window.HHA.endGame=endGame;
  setTimeout(()=>{ $$('canvas').forEach(c=>{ c.style.pointerEvents='none'; c.style.zIndex='1'; }); },0);
  window.addEventListener('keydown',(e)=>{ if((e.key==='Enter'||e.key===' ')&&!R.playing){ const menuVisible=!$('#menuBar')?.hasAttribute('data-hidden'); if(menuVisible){ e.preventDefault(); startGame(); } } },{passive:false});
})();
