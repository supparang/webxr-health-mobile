// === Hero Health Academy — game/main.js (Full: Countdown + HUD + Quests + Fever) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // --------- Safe stubs ----------
  let ScoreSystem, SFXClass, Progress, VRInput, CoachClass, Leaderboard, HUDClass, Quests;

  async function loadCore() {
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n=0){this.value+=n;} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ constructor(){this.enabled=true;} setEnabled(v){this.enabled=!!v;} isEnabled(){return!!this.enabled} play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = class{ constructor(){ } bindToMain(){return{refresh(){}}} beginRun(){} tick(){} event(){} endRun(){return []} getActive(){return null} }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }

    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = class {
        constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase(); }
        onStart(){ hud.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ hud.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ hud.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ hud.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ hud.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onQuestDone(){ hud.say(this.lang==='EN'?'Quest cleared!':'ภารกิจสำเร็จ!'); }
        onEnd(score){ hud.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }

    try { ({ Leaderboard } = await import('./core/leaderboard.js')); }
    catch { Leaderboard = class{ submit(){} renderInto(){} getInfo(){return{text:'Scope:-'}} }; }

    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch {
      HUDClass = class{
        constructor(){
          this.root=document.getElementById('hud')||Object.assign(document.createElement('div'),{id:'hud'});
          if(!document.getElementById('hud')) document.body.appendChild(this.root);
          this.setTop=()=>{}; this.setQuestChips=()=>{}; this.say=()=>{};
          this.setShield=()=>{}; this.setFever=()=>{}; this.setStars=()=>{};
          this.showCountdown=()=>Promise.resolve(); this.showResult=()=>{}; this.hideResult=()=>{};
        }
      };
    }
  }

  // --------- Mode loader ----------
  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return {
      name: mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null,
      pickMeta:mod.pickMeta||null, onHit:mod.onHit||null, cleanup:mod.cleanup||null,
      fx:mod.fx||{}, update:mod.update||null, setFever: mod.setFever||null, grantShield: mod.grantShield||null, start: mod.start||null, stop: mod.stop||null
    };
  }

  // --------- FX helper ----------
  const FX = {
    popText(txt,{x,y,ms=700}={}){
      if(!(Number.isFinite(x)&&Number.isFinite(y))) return;
      const el=document.createElement('div');
      el.textContent=txt;
      el.style.cssText=`position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);
        font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;
        pointer-events:none;z-index:1200;opacity:1;transition:all .72s ease-out;`;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{el.style.top=(y-36)+'px';el.style.opacity='0';});
      setTimeout(()=>el.remove(),ms);
    }
  };

  // --------- Engine state ----------
  let R={
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{score:null,sfx:null},
    modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, coach:null,
    diff:'Normal', lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(),
    board:null, boardScope:'month',
    matchTime:45, missChain:0
  };
  let hud=null;

  // --------- Time config by mode ---------
  const TIME_BY_MODE={ goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode='goodjunk',diff='Normal'){
    const base=TIME_BY_MODE[mode]??45;
    if(diff==='Easy') return base+5;
    if(diff==='Hard') return Math.max(20,base-5);
    return base;
  }

  function starsFromScore(s){ return s>=2400?5:s>=1600?4:s>=1000?3:s>=500?2:1; }

  function setBadges(){
    hud?.setTop?.({mode:R.modeKey,diff:R.diff,time:R.remain,score:R.sys?.score?.get?.()||0,combo:R.sys?.score?.combo|0});
    const mB=$('#modeBadge');if(mB)mB.textContent=R.modeKey;
    const dB=$('#diffBadge');if(dB)dB.textContent=R.diff;
    const sV=$('#scoreVal');if(sV)sV.textContent=R.sys?.score?.get?.()||0;
  }

  function updateFeverState(){
    const on = (R.sys.score.combo|0) >= 10 && R.missChain < 3;
    hud?.setFever?.(on);
    try{ R.modeAPI?.setFever?.(on); }catch{}
  }

  function busFor(){
    return{
      sfx:R.sys.sfx,
      hit(e){ // {kind, points, ui}
        const pts=e?.points|0;
        if(pts){
          R.sys.score.add(pts);
          R.sys.score.combo = (R.sys.score.combo|0)+1;
          if(R.sys.score.combo > (R.sys.score.bestCombo|0)) R.sys.score.bestCombo = R.sys.score.combo;
          R.missChain = 0;
        }
        setBadges();
        hud?.setStars?.(starsFromScore(R.sys.score.get?.()||0));
        updateFeverState();
        if (e?.ui) FX.popText(`${e.kind==='perfect'?'PERFECT ':'+'}${pts}`, e.ui);
        if (e?.kind==='perfect') R.coach?.onPerfect(); else if (e?.kind==='good') R.coach?.onGood();
        try{ R._quests?.event('hit',{ result:e?.kind||'good', pts, comboNow:R.sys.score.combo|0 }); }catch{}
      },
      miss(){
        R.sys.score.combo = 0;
        R.missChain = Math.min(3, R.missChain+1);
        setBadges(); updateFeverState();
        try{ R.coach?.onBad?.(); }catch{}
        try{ R._quests?.event('miss',{}); }catch{}
      },
      power(k){
        if (k==='shield'){
          R.state.shield = (R.state.shield|0)+1;
          hud?.setShield?.(R.state.shield|0);
        }
        try{ R._quests?.event('power',{k}); }catch{}
      }
    };
  }

  // --------- Main loop ----------
  function gameTick(){
    if(!R.playing) return;
    const tNow=performance.now();

    const secGone=Math.floor((tNow-R._secMark)/1000);
    if(secGone>=1){
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=tNow;
      setBadges();
      try{ R.sys.sfx?.tick?.(); }catch{}
      if(R.remain===10) R.coach?.onTimeLow?.();
      try{ R._quests?.tick({score:(R.sys.score.get?.()||0)}); }catch{}
    }

    try{
      if(typeof R.modeAPI?.update==='function'){
        const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
        R.modeAPI.update(dt,busFor());
      }else if(R.modeInst?.update){
        const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
        R.modeInst.update(dt,busFor());
      }else if(R.modeAPI?.tick){
        R.modeAPI.tick(R.state||{},R.sys,hud||{});
      }
    }catch(e){ console.warn('[mode.update] error',e); }

    if(R.remain<=0) return endGame(false);
    R.raf=requestAnimationFrame(gameTick);
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    const score=R.sys?.score?.get?.()||0;
    const bestC=R.sys?.score?.bestCombo|0;

    try { const done = R._quests?.endRun?.({score}) || []; if(done?.length) R.coach?.onQuestDone?.(); } catch {}
    try { R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state,hud); R.modeAPI?.stop?.(); } catch {}

    try{
      const name=(localStorage.getItem('hha_name')||'').trim();
      R.board?.submit(R.modeKey,R.diff,score,{name:name||'Player',meta:{bestCombo:bestC}});
    }catch(e){ console.warn('[board.submit]',e); }

    document.body.removeAttribute('data-playing');
    $('#menuBar')?.removeAttribute('data-hidden');

    R.coach?.onEnd?.(score);
    try{ Progress.endRun({score,bestCombo:bestC}); }catch{}

    hud.showResult({
      title: (R.lang==='EN'?'Result':'สรุปผล'),
      desc: `Mode: ${R.modeKey} • Diff: ${R.diff}`,
      stats: [
        (R.lang==='EN'?`Score: ${score}`:`คะแนน: ${score}`),
        (R.lang==='EN'?`Best Combo: ${bestC}`:`คอมโบสูงสุด: ${bestC}`),
        (R.lang==='EN'?`Time: ${R.matchTime|0}s`:`เวลา: ${R.matchTime|0} วินาที`)
      ],
      quests: R._quests?.getSummary?.() || []
    });

    hud.onHome  = ()=>{ hud.hideResult(); $('#menuBar')?.removeAttribute('data-hidden'); };
    hud.onRetry = ()=>{ hud.hideResult(); startGame(); };

    window.HHA._busy=false;
  }

  async function countdown(){
    await hud.showCountdown?.(3, { lang:R.lang });
  }

  async function startGame(){
    if(window.HHA?._busy) return;
    window.HHA._busy=true;

    await loadCore();
    Progress.init?.();

    // Board
    if(!R.board){
      R.board=new Leaderboard({key:'hha_board',maxKeep:300,retentionDays:180});
      try{const nm=localStorage.getItem('hha_name')||'';const inp=$('#playerName');if(inp)inp.value=nm;}catch{}
    }

    // Reflect menu selections
    R.modeKey = document.body.getAttribute('data-mode') || R.modeKey || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || R.diff || 'Normal';
    R.matchTime=getMatchTime(R.modeKey,R.diff);
    R.remain=R.matchTime|0; R.missChain=0;

    // HUD
    if(!hud) hud=new HUDClass();
    hud.hideResult?.(); hud.setTop?.({mode:R.modeKey,diff:R.diff,time:R.remain,score:0,combo:0});
    hud.setShield?.(R.state?.shield|0); hud.setFever?.(false); hud.setStars?.(0);

    // load mode
    let api;
    try{ api=await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy=false; return; }

    // systems
    R.sys.score=new (ScoreSystem||function(){})();
    R.sys.score.reset?.(); R.sys.score.combo=0; R.sys.score.bestCombo=0;
    R.sys.sfx=new (SFXClass||function(){})();
    R.state={ difficulty:R.diff, lang:R.lang, ctx:{}, shield:(R.state?.shield|0) };

    // Quests: single-at-a-time
    R._quests = new Quests({ lang:R.lang, hud, coach: null, single:true, total:10 });
    try{ R._quests.bindToMain?.({ hud, coach: null }); }catch{}

    // Coach
    R.coach = new CoachClass({ lang: (localStorage.getItem('hha_lang')||'TH') });
    try{ R._quests.setCoach?.(R.coach); }catch{}
    R.coach.onStart();

    // init mode (DOM-spawn)
    R.modeAPI = api;
    try{
      if (api.create){
        R.modeInst=api.create({engine:{fx:FX},hud,coach:R.coach});
        R.modeInst.start?.({time:R.matchTime});
      } else {
        api.start?.({difficulty:R.diff});
      }
    }catch{}

    try{ R._quests.beginRun?.(R.modeKey,R.diff,R.lang,R.matchTime); }catch{}
    try{ Progress.beginRun(R.modeKey,R.diff,R.lang); }catch{}

    // Hide menu and countdown then start loop
    document.body.setAttribute('data-playing','1');
    $('#menuBar')?.setAttribute('data-hidden','1');

    await countdown();

    R.playing=true;
    R.startedAt=performance.now();
    R._secMark=performance.now();
    R._dtMark=performance.now();
    setBadges();

    R.raf=requestAnimationFrame(gameTick);
  }

  // --------- Menu delegation (mode/diff/sound/start/board) ----------
  (function bindMenuDelegation(){
    const mb=document.getElementById('menuBar'); if(!mb) return;
    function setActive(sel,el){ $$(sel).forEach(b=>b.classList.remove('active')); el.classList.add('active'); }

    mb.addEventListener('click',ev=>{
      const t=ev.target.closest('.btn'); if(!t) return;
      if(t.hasAttribute('data-mode')){ ev.preventDefault(); ev.stopPropagation(); document.body.setAttribute('data-mode', t.getAttribute('data-mode')); R.modeKey=t.getAttribute('data-mode')||R.modeKey; setActive('[data-mode]',t); setBadges(); return; }
      if(t.hasAttribute('data-diff')){ ev.preventDefault(); ev.stopPropagation(); document.body.setAttribute('data-diff', t.getAttribute('data-diff')); R.diff=t.getAttribute('data-diff')||R.diff; setActive('[data-diff]',t); setBadges(); return; }
      if(t.dataset.action==='howto'){ ev.preventDefault(); ev.stopPropagation(); toast(R.lang==='EN'?'Tap good foods, avoid junk. Clear quests!':'แตะของดี เลี่ยงของไม่ดี ทำภารกิจให้สำเร็จ!'); return; }
      if(t.dataset.action==='sound'){ ev.preventDefault(); ev.stopPropagation(); try{
        const now=R.sys?.sfx?.isEnabled?.()??true; R.sys?.sfx?.setEnabled?.(!now);
        t.textContent=(!now)?'🔊 Sound':'🔇 Sound';
        document.querySelectorAll('audio').forEach(a=>{ try{ a.muted=now; }catch{} });
        toast((!now)?(R.lang==='EN'?'Sound: ON':'เสียง: เปิด'):(R.lang==='EN'?'Sound: OFF':'เสียง: ปิด'));
      }catch{} return; }
      if(t.dataset.action==='start'){ ev.preventDefault(); ev.stopPropagation(); startGame(); return; }
    }, false);

    // start on pointerup (mobile)
    mb.addEventListener('pointerup', e=>{
      const t=e.target.closest('.btn[data-action="start"]'); if(t){ e.preventDefault(); startGame(); }
    }, {passive:false});
  })();

  // --------- Pause/Resume on tab hide ----------
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden && R.playing) {
      R._wasPaused = true; R.playing = false; cancelAnimationFrame(R.raf);
      R._pausedAt = performance.now();
    } else if (!document.hidden && R._wasPaused) {
      R._wasPaused = false; R.playing = true;
      const now = performance.now();
      const gap = (now - (R._pausedAt||now))|0;
      R._secMark += gap; R._dtMark += gap;
      R.raf = requestAnimationFrame(gameTick);
    }
  });

  // --------- Toast ----------
  function toast(text){
    let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 1300);
  }

  // --------- Expose ----------
  window.HHA=window.HHA||{};
  window.HHA.startGame=startGame;
  window.HHA.endGame=endGame;

  // Canvas never blocks UI
  setTimeout(()=>{ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } }, 0);

  // Keyboard start (Enter/Space)
  window.addEventListener('keydown', (e)=>{
    if((e.key==='Enter'||e.key===' ') && !R.playing){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  }, {passive:false});
})();
