// === Hero Health Academy — game/main.js (prod HUD-v2: setTop/setTimer/updateHUD/showFever/Result) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, Leaderboard, HUDClass;

  async function loadCore(){
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class { constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n=0){this.value=(this.value|0)+(n|0);} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class { constructor(){this._on=true;} setEnabled(v){this._on=!!v;} isEnabled(){return !!this._on;} play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { bindToMain(){return{refresh(){}}}, beginRun(){}, endRun(){return null;}, event(){}, tick(){} }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{}} }; }

    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = class {
        constructor(opts){ this.lang=(localStorage.getItem('hha_lang')||opts?.lang||'TH').toUpperCase(); this._ensure(); }
        _ensure(){ this.box=$('#coachBox'); if(!this.box){ this.box=document.createElement('div'); this.box.id='coachBox';
          this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001'; document.body.appendChild(this.box);} }
        say(t){ if(!this.box) return; this.box.textContent=t||''; this.box.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>{this.box.style.display='none';},1400); }
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
    catch { throw new Error('HUD module is required'); } // เราพึ่ง HUD ใหม่นี้แบบเต็ม ๆ
  }

  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return {
      name:mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null,
      start:mod.start||null, cleanup:mod.cleanup||null, setFever:mod.setFever||null
    };
  }

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
    matchTime:45, feverActive:false, feverBreaks:0
  };
  let hud=null;

  function setBadges(){
    hud?.setTop?.({ mode:R.modeKey, diff:R.diff });
    hud?.setTimer?.(R.remain|0);
    hud?.updateHUD?.(R.sys?.score?.get?.()||0, R.sys?.score?.combo|0);
    const mB=$('#modeBadge'); if(mB) mB.textContent=R.modeKey;
    const dB=$('#diffBadge'); if(dB) dB.textContent=R.diff;
    const sV=$('#scoreVal'); if(sV) sV.textContent=R.sys?.score?.get?.()||0;
  }

  function applyFever(on){
    R.feverActive = !!on;
    try{ R.modeAPI?.setFever?.(R.feverActive); }catch{}
    hud?.showFever?.(R.feverActive);
    document.body.toggleAttribute?.('data-fever', R.feverActive);
  }

  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit(e){
        const pts=e?.points|0;
        if(pts){
          R.sys.score.add(pts);
          R.sys.score.combo=(R.sys.score.combo|0)+1;
          R.sys.score.bestCombo=Math.max(R.sys.score.bestCombo|0,R.sys.score.combo|0);
        }
        if(!R.feverActive && (R.sys.score.combo|0)>=10){
          R.feverBreaks=0; applyFever(true);
          try{ Quests.event('fever',{on:true}); }catch{}
        }
        if(e?.ui){ hud?.showFloatingText?.(e.ui.x|0, e.ui.y|0, `+${pts}`); }
        try{ Quests.event('hit',{ result:e?.kind||'good', meta:e?.meta||{}, points:pts, comboNow:R.sys.score.combo|0 }); }catch{}
        hud?.updateHUD?.(R.sys?.score?.get?.()||0, R.sys?.score?.combo|0);
      },
      // junk click = penalty (ไม่ใช่ MISS)
      penalty(info={}){
        R.sys.score.combo=0;
        R.sys.sfx?.bad?.();
        hud?.updateHUD?.(R.sys?.score?.get?.()||0, R.sys?.score?.combo|0);
        try{ Quests.event('penalty', info); }catch{}
        if(R.feverActive){ R.feverBreaks++; if(R.feverBreaks>=3){ applyFever(false); try{Quests.event('fever',{on:false});}catch{} } }
      },
      // MISS = GOOD timeout เท่านั้น (ถูกเรียกจากโหมด)
      miss(info={}){
        R.sys.score.combo=0;
        R.sys.sfx?.bad?.();
        hud?.updateHUD?.(R.sys?.score?.get?.()||0, R.sys?.score?.combo|0);
        try{ Quests.event('miss', info); }catch{}
        if(R.feverActive){ R.feverBreaks++; if(R.feverBreaks>=3){ applyFever(false); try{Quests.event('fever',{on:false});}catch{} } }
      },
      power(k){ try{ Quests.event('power',{kind:k}); }catch{} }
    };
  }

  function gameTick(){
    if(!R.playing) return;
    const tNow=performance.now();

    const secGone=Math.floor((tNow-R._secMark)/1000);
    if(secGone>=1){
      const before = R.remain|0;
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=tNow;
      hud?.setTimer?.(R.remain|0);

      // Big countdown 10..1
      if (before!==R.remain && R.remain>0 && R.remain<=10){
        hud?.showFloatingText?.(innerWidth/2, Math.max(120, innerHeight*0.30), String(R.remain));
        if (R.remain===10) R.coach?.onTimeLow?.();
      }

      try{ Quests.tick({ score:(R.sys.score.get?.()||0), dt:secGone, fever:R.feverActive }); }catch{}
    }

    try{
      const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
      if(typeof R.modeAPI?.update==='function'){ R.modeAPI.update(dt,busFor()); }
      else if(R.modeInst?.update){ R.modeInst.update(dt,busFor()); }
      else if(R.modeAPI?.tick){ R.modeAPI.tick(R.state||{}, R.sys, hud||{}); }
    }catch(e){ console.warn('[mode.update] error',e); }

    if(R.remain<=0) return endGame();
    R.raf=requestAnimationFrame(gameTick);
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    const score=R.sys?.score?.get?.()||0;
    const bestC=R.sys?.score?.bestCombo|0;
    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state,hud); }catch{}
    try{ Quests.endRun({ score }); }catch{}
    try{ R.coach?.onEnd?.(score); }catch{}
    try{ Progress.endRun({ score, bestCombo:bestC }); }catch{}

    document.body.removeAttribute('data-playing');
    const mb = $('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }

    try{
      const res = (typeof Quests.endRun==='function' && Quests.endRun({score})) || null;
      hud?.showResult?.({
        title:'Result',
        desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
        stats:[
          `Score: ${score}`,
          `Best Combo: ${bestC}`,
          `Time: ${R.matchTime|0}s`,
          res && res.totalDone!=null ? `Quests: ${res.totalDone}` : ''
        ].filter(Boolean),
        extra: res?.lines || []
      });
      hud.onHome = ()=>{ hud.hideResult(); const m2=$('#menuBar'); if(m2){ m2.removeAttribute('data-hidden'); m2.style.display='flex'; } };
      hud.onRetry= ()=>{ hud.hideResult(); startGame(); };
    }catch{}

    window.HHA._busy=false;
  }

  async function startGame(){
    if(window.HHA?._busy) return;
    window.HHA = window.HHA || {}; window.HHA._busy=true;

    await loadCore();
    try{ Progress.init?.(); }catch{}

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';
    R.matchTime = getMatchTime(R.modeKey,R.diff);
    R.remain    = R.matchTime|0;

    if(!hud) hud = new HUDClass();
    hud.hideResult?.();
    hud.setTop?.({ mode:R.modeKey, diff:R.diff });
    hud.setTimer?.(R.remain|0);
    hud.updateHUD?.(0,0);
    hud.resetBars?.();
    applyFever(false); R.feverBreaks=0;

    let api;
    try { api = await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy=false; return; }
    R.modeAPI = api;

    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();

    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    R.coach?.onStart?.();

    try { Quests.bindToMain({ hud, coach:R.coach }); }catch{}
    try { Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime); }catch{}

    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };

    if(api.create){ R.modeInst = api.create({ hud, coach:R.coach }); R.modeInst.start?.({ time:R.matchTime, difficulty:R.diff }); }
    else if(api.init){ api.init(R.state, hud, { time:R.matchTime, life:1600 }); }
    else if(api.start){ api.start({ time:R.matchTime, difficulty:R.diff }); }

    R.playing=true;
    R.startedAt=performance.now();
    R._secMark =performance.now();
    R._dtMark  =performance.now();

    const mb = $('#menuBar');
    if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    document.body.setAttribute('data-playing','1');

    setBadges();
    requestAnimationFrame(gameTick);
  }

  (function bindMenu(){
    const mb = $('#menuBar'); if(!mb) return;
    function setActive(sel,el){ $$(sel).forEach(b=>b.classList.remove('active')); el.classList.add('active'); }
    mb.addEventListener('click',(ev)=>{
      const t=ev.target.closest('.btn'); if(!t) return;
      if(t.hasAttribute('data-mode')){ ev.preventDefault(); ev.stopPropagation(); document.body.setAttribute('data-mode', t.getAttribute('data-mode')); setActive('[data-mode]',t); setBadges(); return; }
      if(t.hasAttribute('data-diff')){ ev.preventDefault(); ev.stopPropagation(); document.body.setAttribute('data-diff', t.getAttribute('data-diff')); setActive('[data-diff]',t); setBadges(); return; }
      if(t.dataset.action==='howto'){ ev.preventDefault(); ev.stopPropagation(); toast('แตะของดี • เลี่ยงของไม่ดี (ไม่ถือ MISS) • คอมโบ ≥10 = FEVER • ⭐/🛡️ คือ Power'); return; }
      if(t.dataset.action==='sound'){ ev.preventDefault(); ev.stopPropagation();
        const now = R.sys?.sfx?.isEnabled?.() ?? true; R.sys?.sfx?.setEnabled?.(!now);
        t.textContent = (!now)?'🔊 Sound':'🔇 Sound';
        document.querySelectorAll('audio').forEach(a=>{ try{ a.muted = now; }catch{} });
        toast((!now)?'เสียง: เปิด':'เสียง: ปิด'); return;
      }
      if(t.dataset.action==='start'){ ev.preventDefault(); ev.stopPropagation(); startGame(); return; }
    }, false);

    const b = $('#btn_start');
    if(b){
      const clone=b.cloneNode(true); b.parentNode.replaceChild(clone,b);
      ['click','pointerup','touchend'].forEach(evName=>{
        clone.addEventListener(evName,(e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); },{capture:true,passive:false});
      });
      clone.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); startGame(); } },{capture:true});
    }
  })();

  function toast(text){
    let el=$('#toast');
    if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=String(text); el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'),1200);
  }

  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  setTimeout(()=>{ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);
})();
