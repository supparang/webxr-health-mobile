// === Hero Health Academy — game/main.js (production-ready) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function(){
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, Leaderboard, HUDClass;

  async function loadCore(){
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0; this.combo=0; this.bestCombo=0;} add(n){this.value=(this.value|0)+(n|0);} get(){return this.value|0;} reset(){this.value=0; this.combo=0; this.bestCombo=0;} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ constructor(){this._on=true;} setEnabled(v){this._on=!!v;} isEnabled(){return !!this._on;} play(){} good(){} bad(){} perfect(){} power(){} tick(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { bindToMain(){return{refresh(){}};}, beginRun(){}, endRun(){return null;}, event(){}, tick(){}}; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{}}, profile(){return{}} }; }

    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false}, isGazeMode(){return false} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = class{
        constructor(o){ const l=(o&&o.lang)||'TH'; this.lang=(localStorage.getItem('hha_lang')||l).toUpperCase(); this.box=null; this._ensure(); }
        _ensure(){ this.box=$('#coachBox'); if(!this.box){ this.box=document.createElement('div'); this.box.id='coachBox'; this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001'; document.body.appendChild(this.box);} }
        say(t){ if(!this.box) return; this.box.textContent=t||''; this.box.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>{this.box.style.display='none';},1400); }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(sc){ this.say((sc|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }

    try { ({ Leaderboard } = await import('./core/leaderboard.js')); }
    catch { Leaderboard = class{ submit(){} renderInto(){} getInfo(){return{text:'-'}} }; }

    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch {
      HUDClass = class{
        constructor(){
          this.root = $('#hud') || Object.assign(document.createElement('div'),{id:'hud'});
          if(!$('#hud')){ this.root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2000;'; document.body.appendChild(this.root); }
          const top=document.createElement('div');
          top.style.cssText='position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
          top.innerHTML='<div style="display:flex;gap:8px;align-items:center"><span id="hudMode" style="padding:4px 8px;border-radius:10px;background:#0b2544;color:#cbe7ff;border:1px solid #15406e;pointer-events:auto">—</span><span id="hudDiff" style="padding:4px 8px;border-radius:10px;background:#102b52;color:#e6f5ff;border:1px solid #1b4b8a;pointer-events:auto">—</span><span id="hudTime" style="padding:4px 8px;border-radius:10px;background:#0a1f3d;color:#c9e7ff;border:1px solid #123863;min-width:64px;text-align:center;pointer-events:auto">—</span></div><div style="display:flex;gap:8px;align-items:center"><span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#bbf7d0;border:1px solid #134064;pointer-events:auto">Score: <b id="hudScore">0</b></span><span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#fde68a;border:1px solid #134064;pointer-events:auto">Combo: <b id="hudCombo">0</b></span><span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#93c5fd;border:1px solid #134064;pointer-events:auto">⭐ <b id="hudStars">0</b></span></div>';
          this.root.appendChild(top);
          this.$mode=top.querySelector('#hudMode'); this.$diff=top.querySelector('#hudDiff'); this.$time=top.querySelector('#hudTime');
          this.$score=top.querySelector('#hudScore'); this.$combo=top.querySelector('#hudCombo'); this.$stars=top.querySelector('#hudStars');
          this.chips = Object.assign(document.createElement('div'),{id:'questChips'}); this.chips.style.cssText='position:fixed;left:12px;bottom:78px;display:flex;flex-wrap:wrap;gap:6px;max-width:92vw;pointer-events:none'; this.root.appendChild(this.chips);
          this.result=document.createElement('div'); this.result.id='resultModal'; this.result.style.cssText='position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto;z-index:2002';
          this.result.innerHTML='<div style="width:min(560px,94vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff"><h3 id="resTitle" style="margin:0 0 6px;font:900 20px ui-rounded">Result</h3><p id="resDesc" style="margin:0 0 10px;color:#cfe7ff;white-space:pre-line">—</p><div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div><div id="resExtra" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button id="resHome" style="padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer">🏠 Home</button><button id="resRetry" style="padding:8px 10px;border-radius:10px;background:#123054;color:#dff2ff;border:1px solid #1e4d83;cursor:pointer">↻ Retry</button></div></div>';
          this.root.appendChild(this.result);
          this.$resTitle=this.result.querySelector('#resTitle'); this.$resDesc=this.result.querySelector('#resDesc'); this.$resStats=this.result.querySelector('#resStats'); this.$resExtra=this.result.querySelector('#resExtra');
          this.onHome=null; this.onRetry=null; this.result.querySelector('#resHome').onclick=()=>this.onHome&&this.onHome(); this.result.querySelector('#resRetry').onclick=()=>this.onRetry&&this.onRetry();
          this.powerWrap=document.getElementById('powerBarWrap'); if(!this.powerWrap){ this.powerWrap=document.createElement('div'); this.powerWrap.id='powerBarWrap'; this.powerWrap.style.cssText='position:fixed;left:12px;bottom:12px;z-index:18;width:min(380px,92vw);pointer-events:none'; this.powerWrap.innerHTML='<div id="powerBar" style="position:relative;height:14px;border-radius:999px;background:#0a1931;border:1px solid #0f2a54;overflow:hidden"><div id="powerFill" style="position:absolute;inset:0;width:0%"></div></div>'; document.body.appendChild(this.powerWrap); }
          this.$powerFill=this.powerWrap.querySelector('#powerFill');
        }
        setTop({mode,diff,time,score,combo}){ if(mode!=null)this.$mode.textContent=String(mode); if(diff!=null)this.$diff.textContent=String(diff); if(time!=null)this.$time.textContent=String(time)+'s'; if(score!=null)this.$score.textContent=String(score|0); if(combo!=null)this.$combo.textContent=String(combo|0); }
        setTimer(sec){ this.$time.textContent=Math.max(0,Math.round(sec))+'s'; }
        updateHUD(score,combo){ this.$score.textContent=String(score|0); this.$combo.textContent=String(combo|0); }
        setStars(n){ this.$stars.textContent=String(n|0); }
        setQuestChips(list){ const frag=document.createDocumentFragment(); (list||[]).forEach(m=>{ const pct=m.need>0?Math.min(100,Math.round((m.progress/m.need)*100)):0; const d=document.createElement('div'); d.style.cssText='pointer-events:auto;display:inline-flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;border:2px solid '+(m.active?'#22d3ee':'#16325d')+';background:'+(m.done?'#0f2e1f':m.fail?'#361515':'#0d1a31')+';color:#e6f2ff;'; d.innerHTML='<span style="font-size:16px">'+(m.icon||'⭐')+'</span><span style="font:700 12.5px ui-rounded">'+(m.label||m.key)+'</span><span style="font:700 12px;color:#a7f3d0;margin-left:6px">'+(m.progress||0)+'/'+(m.need||0)+'</span><i style="height:6px;width:120px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;display:inline-block;margin-left:6px"><b style="display:block;height:100%;width:'+pct+'%;background:'+(m.done?(m.fail?'#ef4444':'#22c55e'):'#22d3ee')+'"></b></i>'; frag.appendChild(d); }); this.chips.innerHTML=''; this.chips.appendChild(frag); }
        showFever(on){ if(on){ this.$powerFill.innerHTML='<div class="fire" style="position:absolute;left:0;top:0;bottom:0;width:100%;background:radial-gradient(30px 24px at 20% 110%,rgba(255,200,0,.9),rgba(255,130,0,.65)55%,rgba(255,80,0,0)70%),radial-gradient(26px 20px at 45% 110%,rgba(255,210,80,.85),rgba(255,120,0,.55)55%,rgba(255,80,0,0)70%),radial-gradient(34px 26px at 70% 110%,rgba(255,190,40,.9),rgba(255,110,0,.55)55%,rgba(255,80,0,0)70%),linear-gradient(0deg,rgba(255,140,0,.65),rgba(255,100,0,.25));mix-blend-mode:screen;animation:fireRise .9s ease-in-out infinite"></div>'; document.body.setAttribute('data-fever','1'); } else { this.$powerFill.innerHTML=''; document.body.removeAttribute('data-fever'); } }
        showFloatingText(x,y,text){ const el=document.createElement('div'); el.textContent=String(text); el.style.cssText='position:fixed;left:'+(x|0)+'px;top:'+(y|0)+'px;transform:translate(-50%,-50%);font:900 18px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:2100;opacity:1;transition:all .72s ease-out;'; document.body.appendChild(el); requestAnimationFrame(()=>{ el.style.top=(y-40)+'px'; el.style.opacity='0'; }); setTimeout(()=>{ try{el.remove();}catch{}; },740); }
        showResult({title='Result',desc='—',stats=[],extra=[]}={}){ this.$resTitle.textContent=String(title); this.$resDesc.textContent=String(desc); const f1=document.createDocumentFragment(), f2=document.createDocumentFragment(); stats.forEach(s=>{ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38'; b.textContent=String(s); f1.appendChild(b); }); extra.forEach(s=>{ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #2a3e6a;background:#0c233f;color:#bfe0ff'; b.textContent=String(s); f2.appendChild(b); }); this.$resStats.innerHTML=''; this.$resStats.appendChild(f1); this.$resExtra.innerHTML=''; this.$resExtra.appendChild(f2); this.result.style.display='flex'; }
        hideResult(){ this.result.style.display='none'; }
        toast(text){ let t=$('#toast'); if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; t.style.cssText='position:fixed;left:50%;top:68px;transform:translateX(-50%);background:#0e1930;border:1px solid #214064;color:#e8f3ff;padding:8px 12px;border-radius:10px;opacity:0;transition:opacity .3s;z-index:10040'; document.body.appendChild(t);} t.textContent=String(text); t.style.opacity='1'; setTimeout(()=>{ t.style.opacity='0'; },1200); }
      };
    }
  }

  const MODE_PATH=(k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return { name:mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null, start:mod.start||null, cleanup:mod.cleanup||null, setFever:mod.setFever||null };
  }

  const TIME_BY_MODE={ goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode,diff){ const base=(TIME_BY_MODE[mode] != null ? TIME_BY_MODE[mode] : 45)|0; if(diff==='Easy') return base+5; if(diff==='Hard') return Math.max(20,base-5); return base; }

  let R={
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{score:null,sfx:null},
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null,
    matchTime:45, feverActive:false, feverBreaks:0, stars:0,
    _secMark:0, _dtMark:0, _countdownEl:null
  };
  let hud=null;

  function ensureBigCountdown(){
    if(R._countdownEl) return R._countdownEl;
    const d=document.createElement('div');
    d.id='bigCountdown';
    d.style.cssText='position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);font:900 72px/1 ui-rounded,system-ui;color:#fff;text-shadow:0 6px 28px rgba(0,0,0,.6);z-index:3000;pointer-events:none;display:none';
    document.body.appendChild(d);
    R._countdownEl=d;
    return d;
  }
  function showBigCounter(t){
    const el=ensureBigCountdown();
    el.textContent=String(t); el.style.display='block';
    setTimeout(()=>{ el.style.display='none'; }, 900);
  }

  function setFever(on){
    const was=R.feverActive;
    R.feverActive=!!on;
    hud?.showFever?.(R.feverActive);
    if(!was && R.feverActive){
      document.body.style.transition='background-color .25s ease';
      document.body.style.backgroundColor='#2a0f0f';
      try{ R.sys.sfx.power?.(); }catch{}
      R.modeAPI?.setFever?.(true);
    }else if(was && !R.feverActive){
      document.body.style.backgroundColor='';
      R.modeAPI?.setFever?.(false);
    }
  }

  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit:(e)=>{
        const pts=(e&&e.points)|0;
        if(pts){
          R.sys.score.add(pts);
          R.sys.score.combo=(R.sys.score.combo|0)+1;
          if((R.sys.score.combo|0)>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo|0;
        }
        if(e?.meta?.gold || e?.kind==='gold'){ R.stars=(R.stars|0)+1; hud?.setStars?.(R.stars); }
        if(!R.feverActive && (R.sys.score.combo|0)>=10){ setFever(true); R.feverBreaks=0; try{Quests.event('fever',{on:true});}catch{} }
        const runScore=(R.sys.score.get?.()||0);
        try{
          Quests.event('hit',{
            result: e?.kind||'good',
            meta:   e?.meta||{},
            points: pts,
            comboNow: R.sys.score.combo|0,
            pointsRun: runScore
          });
        }catch{}
        if(e?.ui) hud?.showFloatingText?.(e.ui.x,e.ui.y,'+'+pts);
        hud?.updateHUD?.(runScore, R.sys.score.combo|0);
      },
      miss:(info={})=>{
        // miss ใช้กับ "good-timeout" เท่านั้น (junk ไม่นับ miss)
        if(R.feverActive){
          R.feverBreaks++;
          if(R.feverBreaks>=3){ setFever(false); R.feverBreaks=0; try{Quests.event('fever',{on:false});}catch{} }
        }
        R.sys.score.combo=0;
        try{ Quests.event('miss',{by:info.by||'good-timeout'}); }catch{}
        R.coach?.onBad?.(); R.sys?.sfx?.bad?.();
        hud?.updateHUD?.(R.sys.score.get?.()||0, R.sys.score.combo|0);
      },
      penalty:(info={})=>{
        // โทษเมื่อกด junk
        R.sys.score.add(-50);
        R.sys.score.combo=0;
        try{ Quests.event('penalty',{by:info.by||'junk-click'}); }catch{}
        R.coach?.onBad?.(); R.sys?.sfx?.bad?.();
        hud?.updateHUD?.(R.sys.score.get?.()||0, R.sys.score.combo|0);
      },
      power:(k)=>{ try{ Quests.event('power',{kind:k}); }catch{} }
    };
  }

  function gameTick(){
    if(!R.playing) return;
    const tNow=performance.now();

    const secGone=Math.floor((tNow-R._secMark)/1000);
    if(secGone>=1){
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=tNow;
      hud?.setTimer?.(R.remain);
      if(R.remain===10){ R.coach?.onTimeLow?.(); }
      if(R.remain<=10 && R.remain>0){ showBigCounter(R.remain); }
      try{ Quests.tick({ dt:secGone, fever:R.feverActive }); }catch{}
    }

    try{
      const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
      if(typeof R.modeAPI?.update==='function'){ R.modeAPI.update(dt, busFor()); }
      else if(R.modeInst?.update){ R.modeInst.update(dt, busFor()); }
      else if(R.modeAPI?.tick){ R.modeAPI.tick(R.state||{}, R.sys, hud||{}); }
    }catch(e){ console.warn('[mode.update] error', e); }

    if(R.remain<=0) return endGame();
    R.raf=requestAnimationFrame(gameTick);
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);

    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state,hud); }catch{}
    try{ Quests.tick({dt:0,fever:false}); }catch{}
    const score=R.sys?.score?.get?.()||0; const bestC=R.sys?.score?.bestCombo|0;
    let qsum=null;
    try{ qsum = Quests.endRun({ score }); }catch{}

    try{ R.coach?.onEnd?.(score); }catch{}
    try{ Progress.endRun({ score, bestCombo:bestC }); }catch{}

    document.body.removeAttribute('data-playing');
    const mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }

    const stats=[
      'Score: '+score,
      'Best Combo: '+bestC,
      'Time: '+(R.matchTime|0)+'s',
      qsum&&Number.isFinite(qsum.stars)?('★ '+qsum.stars+'/5'):''
    ].filter(Boolean);

    const extra=[];
    if(qsum){
      extra.push('Gold: '+(qsum.hitsGold|0));
      extra.push('Penalties: '+(qsum.penalties|0));
      extra.push('Misses: '+(qsum.misses|0));
      extra.push('FEVER time: '+(qsum.feverSec|0)+'s');
      if(qsum.selected&&qsum.selected.length){
        qsum.selected.forEach((q,i)=>{ extra.push((i+1)+') '+q.label+' — '+q.progress+'/'+q.need+(q.done?' ✓':'')); });
      }
    }

    try{
      hud?.showResult?.({
        title:'Result',
        desc:'Mode: '+R.modeKey+' • Diff: '+R.diff,
        stats, extra
      });
      hud.onHome = ()=>{ hud.hideResult(); const mb2=$('#menuBar'); if(mb2){ mb2.removeAttribute('data-hidden'); mb2.style.display='flex'; } };
      hud.onRetry= ()=>{ hud.hideResult(); startGame(); };
    }catch{}

    window.HHA._busy=false;
    setFever(false);
  }

  async function countdown321(){
    const el=ensureBigCountdown();
    const seq=['3','2','1','GO!'];
    for(let i=0;i<seq.length;i++){
      el.textContent=seq[i];
      el.style.display='block';
      try{ R.sys?.sfx?.tick?.(); }catch{}
      await new Promise(r=>setTimeout(r, i===seq.length-1 ? 650 : 800));
      el.style.display='none';
    }
  }

  async function startGame(){
    if(window.HHA?._busy) return;
    if(!window.HHA) window.HHA={};
    window.HHA._busy=true;

    await loadCore();
    try{ Progress.init(); }catch{}

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';

    R.matchTime = getMatchTime(R.modeKey,R.diff);
    R.remain    = R.matchTime|0;

    if(!hud) hud = new HUDClass();
    hud.hideResult?.();
    hud.setTop?.({ mode:R.modeKey, diff:R.diff, time:R.remain, score:0, combo:0 });
    hud.setStars?.(0);

    let api=null;
    try { api = await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); toast('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }
    R.modeAPI = api;

    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();
    R.sys.score.combo=0; R.sys.score.bestCombo=0; R.stars=0;
    setFever(false); R.feverBreaks=0;

    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    R.coach?.onStart?.();

    const Q = Quests.bindToMain({ hud, coach:R.coach });
    Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime);
    Q?.refresh?.();

    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };

    if(api && typeof api.create==='function'){
      R.modeInst = api.create({ engine:{}, hud, coach:R.coach });
      R.modeInst?.start?.({ time:R.matchTime, difficulty:R.diff });
    } else if(api && typeof api.init==='function'){
      api.init(R.state, hud, { time:R.matchTime, life:1600 });
    } else if(api && typeof api.start==='function'){
      api.start({ time:R.matchTime, difficulty:R.diff });
    }

    // 3-2-1-GO
    await countdown321();

    R.playing=true;
    R.startedAt=performance.now();
    R._secMark =performance.now();
    R._dtMark  =performance.now();

    hud?.setTimer?.(R.remain);
    hud?.updateHUD?.(0,0);
    document.body.setAttribute('data-playing','1');
    const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

    requestAnimationFrame(gameTick);
  }

  function toast(text){
    let el=$('#toast');
    if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=String(text); el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'),1200);
  }

  // Expose
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // canvases never block clicks
  setTimeout(()=>{ $$('#c, canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} }); },0);

  window.addEventListener('keydown',(e)=>{
    if((e.key==='Enter'||e.key===' ')&&!R.playing){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  },{passive:false});
})();
