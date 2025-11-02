// === Hero Health Academy — game/main.js (production: HUD/Coach/Timer/Fever/Quests/Stars/Result) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function(){
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  // --------- Safe stubs (replaced if core modules load ok) ----------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, Leaderboard, HUDClass;

  async function loadCore(){
    try { ({ ScoreSystem }  = await import('./core/score.js')); } catch {
      ScoreSystem = class { constructor(){ this.value=0; this.combo=0; this.bestCombo=0; }
        add(n=0){ this.value += n|0; } get(){ return this.value|0; }
        reset(){ this.value=0; this.combo=0; this.bestCombo=0; } };
    }
    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); } catch {
      SFXClass = class { constructor(){this._on=true;}
        setEnabled(v){this._on=!!v;} isEnabled(){return !!this._on;}
        good(){} bad(){} perfect(){} power(){} tick(){} play(){} };
    }
    try { ({ Quests }      = await import('./core/quests.js')); } catch {
      Quests = { bindToMain(){return{refresh(){}}}, beginRun(){}, endRun(){return {done:[],fail:[],lines:[],totalDone:0}}, event(){}, tick(){} };
    }
    try { ({ Progress }    = await import('./core/progression.js')); } catch {
      Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{}} };
    }
    try { ({ VRInput }     = await import('./core/vrinput.js')); } catch {
      VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} };
    }
    try { ({ Coach: CoachClass } = await import('./core/coach.js')); } catch {
      CoachClass = class {
        constructor(opts){ this.lang=(localStorage.getItem('hha_lang')||opts?.lang||'TH').toUpperCase(); this._ensure(); }
        _ensure(){ this.box = $('#coachBox'); if(!this.box){ this.box=document.createElement('div');
          this.box.id='coachBox'; this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001'; document.body.appendChild(this.box);} }
        say(t){ if(!this.box) return; this.box.textContent=t||''; this.box.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>{this.box.style.display='none';},1400); }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }
    try { ({ Leaderboard } = await import('./core/leaderboard.js')); } catch {
      Leaderboard = class{ submit(){} renderInto(){} getInfo(){return{text:'-'}} };
    }
    try { ({ HUD: HUDClass }= await import('./core/hud.js')); } catch {
      // มีไฟล์ hud.js แยกแล้ว (เวอร์ชันใหม่ด้านล่าง) — ถ้าโหลดไม่ได้ fallback แบบเบา ๆ ก็ทำงาน
      HUDClass = class{
        constructor(){
          this.root = $('#hud') || Object.assign(document.createElement('div'),{id:'hud'});
          if(!$('#hud')){ this.root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2000;'; document.body.appendChild(this.root); }
          this.top=document.createElement('div');
          this.top.style.cssText='position:absolute;left:12px;right:12px;top:10px;display:flex;justify-content:space-between;gap:8px;pointer-events:none';
          this.top.innerHTML='<div><span id="hudMode"></span> <span id="hudDiff"></span> <span id="hudTime"></span></div><div><span>Score: <b id="hudScore">0</b></span> <span>Combo: <b id="hudCombo">0</b></span></div>';
          this.root.appendChild(this.top);
          this.$mode=this.top.querySelector('#hudMode'); this.$diff=this.top.querySelector('#hudDiff'); this.$time=this.top.querySelector('#hudTime'); this.$score=this.top.querySelector('#hudScore'); this.$combo=this.top.querySelector('#hudCombo');
          this.$powerFill = document.createElement('div');
        }
        setTop({mode,diff}){ if(mode!=null) this.$mode.textContent=mode; if(diff!=null) this.$diff.textContent=diff; }
        setTimer(s){ this.$time.textContent=(s|0)+'s'; }
        updateHUD(sc,co){ this.$score.textContent=sc|0; this.$combo.textContent=co|0; }
        showFever(on){ /* no-op in fallback */ }
        showBig(text){ /* no-op */ }
        showResult(o){ alert('Score: '+(o?.stats?.[0]||'-')); }
        hideResult(){}
      };
    }
  }

  // --------- Engine state ----------
  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode='goodjunk', diff='Normal'){
    const base = TIME_BY_MODE[mode] ?? 45;
    if(diff==='Easy') return base+5;
    if(diff==='Hard') return Math.max(20, base-5);
    return base;
  }
  function computeStars({score,bestCombo,questsDone,feverSeconds}){
    // สูตรง่ายๆ: คะแนนรวม + โบนัสคอมโบ/เควสต์/ฟีเวอร์ แล้ว map → 1–5 ⭐
    const base = score;
    const bonus = bestCombo*5 + (questsDone||0)*50 + Math.min(100, Math.floor((feverSeconds||0)*2));
    const total = base + bonus;
    if(total >= 1200) return 5;
    if(total >= 900)  return 4;
    if(total >= 650)  return 3;
    if(total >= 400)  return 2;
    return 1;
  }
  function starsText(n){ return '⭐'.repeat(Math.max(1,Math.min(5,n|0))); }

  let R = {
    playing:false, raf:0,
    sys:{score:null,sfx:null},
    modeKey:'goodjunk', diff:'Normal', matchTime:45, remain:45,
    feverActive:false, feverBreaks:0, feverSinceMs:0, feverTotalMs:0,
    modeAPI:null, modeInst:null, state:null, coach:null, hud:null
  };

  // --------- FEVER helpers ----------
  function setFever(on){
    if(on && !R.feverActive){
      R.feverActive=true; R.feverBreaks=0; R.feverSinceMs=performance.now();
      R.hud?.showFever(true);
      // sting สั้น ๆ
      try{ R.sys.sfx?.power?.(); }catch{}
      try{
        const bgm=document.getElementById('bgm-main');
        if(bgm){ bgm.currentTime=0; bgm.play().catch(()=>{}); setTimeout(()=>{ try{bgm.pause();}catch{} }, 900); }
      }catch{}
      try{ Quests.event('fever',{on:true}); }catch{}
    } else if(!on && R.feverActive){
      R.feverActive=false;
      if(R.feverSinceMs){ R.feverTotalMs += Math.max(0, performance.now()-R.feverSinceMs); R.feverSinceMs=0; }
      R.hud?.showFever(false);
      try{ Quests.event('fever',{on:false}); }catch{}
    }
  }

  // --------- HUD sync ----------
  function syncHUD(){
    R.hud?.setTop?.({mode:R.modeKey,diff:R.diff});
    R.hud?.setTimer?.(R.remain);
    R.hud?.updateHUD?.(R.sys?.score?.get?.()||0, R.sys?.score?.combo|0);
    const mB=$('#modeBadge'); if(mB) mB.textContent=R.modeKey;
    const dB=$('#diffBadge'); if(dB) dB.textContent=R.diff;
    const sV=$('#scoreVal'); if(sV) sV.textContent=R.sys?.score?.get?.()||0;
  }

  // --------- Bus to modes ----------
  function busFor(){
    return {
      sfx:R.sys.sfx,
      // hit ของดี/เพอร์เฟกต์/ทอง
      hit:(e)=>{
        const pts=e?.points|0;
        if(pts){
          R.sys.score.add(pts);
          R.sys.score.combo=(R.sys.score.combo|0)+1;
          if(R.sys.score.combo>R.sys.score.bestCombo) R.sys.score.bestCombo=R.sys.score.combo;
        }
        if(!R.feverActive && (R.sys.score.combo|0)>=10) setFever(true);
        if(e?.ui) R.hud?.showFloatingText?.(e.ui.x,e.ui.y,'+'+pts);
        try{ Quests.event('hit',{kind:e?.kind||'good',points:pts}); }catch{}
        syncHUD();
      },
      // miss: เฉพาะ good ที่หมดเวลาเท่านั้น
      miss:(info={})=>{
        if(R.feverActive){
          R.feverBreaks++;
          if(R.feverBreaks>=3) setFever(false);
        }
        R.sys.score.combo=0;
        try{ Quests.event('miss',{kind:info.kind||'timeout_good'}); }catch{}
        R.sys.sfx?.bad?.();
        syncHUD();
      },
      // junk click: ไม่ถือ MISS แต่ตัดคอมโบทันที
      junk:(info={})=>{
        if(R.feverActive){
          R.feverBreaks++;
          if(R.feverBreaks>=3) setFever(false);
        }
        R.sys.score.combo=0;
        try{ Quests.event('junk',{kind:'click_junk'}); }catch{}
        R.sys.sfx?.bad?.();
        syncHUD();
      },
      power:(k)=>{ try{ Quests.event('power',{kind:k}); }catch{} }
    };
  }

  // --------- Game loop ----------
  function gameTick(){
    if(!R.playing) return;
    const now=performance.now();

    const secGone = Math.floor((now - R._secMark)/1000);
    if(secGone>=1){
      R.remain = Math.max(0,(R.remain|0)-secGone);
      R._secMark += secGone*1000;
      if(R.remain<=10 && R.remain>0){
        // เลขใหญ่ตรงกลาง
        R.hud?.showBig?.(String(R.remain));
        R.sys.sfx?.tick?.();
        if(R.remain===10) R.coach?.onTimeLow?.();
      }
      syncHUD();
      try{ Quests.tick({score:R.sys?.score?.get?.()||0, dt:secGone, fever:R.feverActive}); }catch{}
    }

    try{
      const dt=((now - (R._dtMark||now))/1000); R._dtMark=now;
      if(R.modeAPI?.update) R.modeAPI.update(dt, busFor());
      else if(R.modeInst?.update) R.modeInst.update(dt, busFor());
      else if(R.modeAPI?.tick) R.modeAPI.tick(R.state||{}, R.sys, R.hud||{});
    }catch(e){ console.warn('[mode.update] error',e); }

    if(R.remain<=0) return endGame();
    R.raf = requestAnimationFrame(gameTick);
  }

  // --------- End game ----------
  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);

    // ปิด FEVER ถ้ายังค้าง
    if(R.feverActive) setFever(false);

    const score   = R.sys?.score?.get?.()||0;
    const bestC   = R.sys?.score?.bestCombo|0;
    const feverMs = R.feverTotalMs|0;
    let questRes  = {done:[],fail:[],lines:[],totalDone:0};
    try{ questRes = Quests.endRun({score}); }catch{}

    // Stars
    const stars = computeStars({score, bestCombo:bestC, questsDone:questRes?.totalDone||0, feverSeconds:feverMs/1000});

    // กลับเมนู
    document.body.removeAttribute('data-playing');
    const mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }

    // Result เต็ม
    const extra = [
      'Stars: '+starsText(stars),
      'Fever time: '+Math.round(feverMs/1000)+'s',
      ...(questRes?.lines||[])
    ];
    R.hud?.showResult?.({
      title:'Result',
      desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
      stats:[
        `Score: ${score}`,
        `Best Combo: ${bestC}`,
        `Time: ${R.matchTime|0}s`,
        `Quests: ${questRes?.totalDone||0}/3`
      ],
      extra
    });
    R.hud && (R.hud.onHome = ()=>{ R.hud.hideResult(); const m2=$('#menuBar'); if(m2){ m2.removeAttribute('data-hidden'); m2.style.display='flex'; } });
    R.hud && (R.hud.onRetry= ()=>{ R.hud.hideResult(); startGame(); });

    try{ Progress.endRun({score, bestCombo:bestC, stars}); }catch{}
    window.HHA._busy=false;
  }

  // --------- Start game ----------
  async function startGame(){
    if(window.HHA?._busy) return; window.HHA = window.HHA||{}; window.HHA._busy=true;

    await loadCore();
    try{ Progress.init?.(); }catch{}

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';
    R.matchTime = getMatchTime(R.modeKey,R.diff);
    R.remain    = R.matchTime|0;

    if(!R.hud) R.hud = new HUDClass();
    R.hud.hideResult?.();
    R.hud.setTop?.({mode:R.modeKey,diff:R.diff});
    R.hud.setTimer?.(R.remain);
    R.hud.updateHUD?.(0,0);
    R.hud.showFever?.(false);

    // countdown 3-2-1-GO
    await new Promise((res)=>{
      let n=3;
      const t=setInterval(()=>{
        R.hud?.showBig?.(n>0?String(n):'GO!');
        if(n===0){ clearInterval(t); setTimeout(()=>res(), 350); }
        n--;
      }, 600);
    });

    // โหลดโหมด
    try {
      const mod = await import(`./modes/${R.modeKey}.js`);
      R.modeAPI = {
        name:mod.name||R.modeKey,
        create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null,
        start:mod.start||null, cleanup:mod.cleanup||null,
        // fever hooks
        setFever:mod.setFever||null, grantShield:mod.grantShield||null
      };
    } catch(e){
      console.error('[HHA] Failed to load mode:', R.modeKey, e); toast('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return;
    }

    // systems
    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.score.combo=0; R.sys.score.bestCombo=0;
    R.sys.sfx   = new (SFXClass||function(){})();
    R.feverActive=false; R.feverBreaks=0; R.feverSinceMs=0; R.feverTotalMs=0;

    // coach & quests
    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    R.coach.onStart?.();
    try { Quests.bindToMain({ hud:R.hud, coach:R.coach }); }catch{}
    try { Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime); }catch{}

    // state
    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };

    // start mode
    if(R.modeAPI.create){ R.modeInst = R.modeAPI.create({ hud:R.hud, coach:R.coach }); R.modeInst?.start?.({ time:R.matchTime, difficulty:R.diff }); }
    else if(R.modeAPI.init){ R.modeAPI.init(R.state, R.hud, { time:R.matchTime, life:1600 }); }
    else if(R.modeAPI.start){ R.modeAPI.start({ time:R.matchTime, difficulty:R.diff }); }

    // run
    R.playing=true;
    R._secMark=performance.now(); R._dtMark=performance.now();
    document.body.setAttribute('data-playing','1');
    const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    requestAnimationFrame(gameTick);
  }

  // --------- Toast ----------
  function toast(text){
    let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=String(text); el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200);
  }

  // --------- Expose ----------
  window.HHA = window.HHA||{}; window.HHA.startGame = startGame; window.HHA.endGame = endGame;

  // quick keyboard start
  window.addEventListener('keydown', (e)=>{
    if((e.key==='Enter'||e.key===' ') && !R.playing){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  }, {passive:false});

  // never block clicks
  setTimeout(()=>{ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);
})();
