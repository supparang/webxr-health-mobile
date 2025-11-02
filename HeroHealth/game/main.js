// === Hero Health Academy — /game/main.js (2025-11-02 SAFE) ===
// dual-loop engine + prime spawn + idle watchdog + host ensure + visibility resume
'use strict';
window.__HHA_BOOT_OK = 'main';

(function(){
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  // ---------- Core (with safe fallbacks) ----------
  let HUDClass, CoachClass, ScoreSystem, SFXClass, Quests, Progress;

  async function loadCore(){
    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch { HUDClass = class { constructor(){} setTop(){} setTimer(){} updateHUD(){} setQuestChips(){} showFever(){} resetBars(){} showBig(){} showFloatingText(){} showResult(){} hideResult(){} toast(){} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch { CoachClass = class { constructor(){} onStart(){} onBad(){} onTimeLow(){} onQuestStart(){} onQuestDone(){} onFever(){} onEnd(){} }; }

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
        bgmMain(on){ const a=$('#bgm-main');  try{ a&&(a.loop=true); on?a.play():a.pause(); }catch{} }
        bgmFever(on){ const a=$('#bgm-fever'); try{ a&&(a.loop=true); on?a.play():a.pause(); }catch{} }
      };
    }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch {
      Quests = {
        _state:null,_cur:0,_elapsed:0,_nojunk:0,_hud:null,_coach:null,
        bindToMain({hud,coach}){ this._hud=hud; this._coach=coach; return this; },
        beginRun(){ const base=[
            {key:'good_20',label:'แตะของดี 20',need:20,type:'inc',icon:'🥗'},
            {key:'perfect_10',label:'PERFECT 10',need:10,type:'inc',icon:'💥'},
            {key:'combo_15',label:'คอมโบ 15',need:15,type:'combo',icon:'🔥'},
            {key:'gold_3',label:'เก็บทอง 3',need:3,type:'gold',icon:'🌟'},
            {key:'nojunk',label:'ไม่กด Junk',need:1,type:'nojunk',icon:'❎'}
          ];
          const pick=[]; const pool=[...base];
          while(pick.length<3 && pool.length) pick.push(pool.splice((Math.random()*pool.length)|0,1)[0]);
          this._state=pick.map((q,i)=>({...q,progress:0,done:false,fail:false,active:i===0}));
          this._cur=0; this._elapsed=0; this._nojunk=0;
          this._hud?.setQuestChips(this._state); this._coach?.onQuestStart?.(this._state[0].label);
        },
        event(kind,p={}){
          const s=this._state, i=this._cur; if(!s||!s[i]) return; const q=s[i];
          if(kind==='tick'){ this._elapsed+=(p.dt||0); if(q.type==='time') q.progress=Math.min(q.need|0, Math.floor(this._elapsed)); this._nojunk += (p.dt||0); }
          if(kind==='hit'){ if(q.type==='inc' && (p.meta?.good||p.meta?.golden)) q.progress++; if(q.type==='gold' && (p.meta?.gold===1||p.meta?.power==='gold')) q.progress++; if(q.type==='combo') q.progress=Math.max(q.progress, p.comboNow|0); this._nojunk=0; }
          if(kind==='bad'){ if(q.type==='nojunk'){ q.fail=true; } this._nojunk=0; }
          if(kind==='fever' && p.on){}
          const ok = (q.type==='combo') ? (q.progress>=q.need) : (q.progress>=q.need);
          if(ok && !q.fail){ q.done=true; q.active=false; this._coach?.onQuestDone?.(); this._cur++; if(s[this._cur]){ s[this._cur].active=true; this._coach?.onQuestStart?.(s[this._cur].label); } }
          this._hud?.setQuestChips(s);
        },
        tick(meta){ this.event('tick', meta); },
        endRun(){ const s=this._state||[]; return { list:s, totalDone:s.filter(x=>x.done).length }; }
      };
    }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, getStatSnapshot(){return{}} }; }
  }

  // ---------- Mode loader ----------
  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return { name:mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null, start:mod.start||null, cleanup:mod.cleanup||null, setFever:mod.setFever||null, restart:mod.restart||null };
  }

  // ---------- Emergency builtin (ใช้ถ้าหยุดนิ่ง) ----------
  function BuiltinGoodJunk(){
    let alive=false, t=0, interval=0.60, life=2.0, host=null, fever=false;
    function H(){ host=document.getElementById('spawnHost')||document.body; }
    function spawn(bus){
      H();
      const good=Math.random()<0.72, golden=Math.random()<0.12;
      const G=['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍇'], B=['🍔','🍟','🍕','🍩','🍫','🥤'];
      const glyph=golden?'🌟':(good?G[Math.random()*G.length|0]:B[Math.random()*B.length|0]);
      const d=document.createElement('button'); d.textContent=glyph; d.type='button';
      Object.assign(d.style,{position:'fixed',left:(56+Math.random()*(innerWidth-112))+'px',top:(96+Math.random()*(innerHeight-240))+'px',transform:'translate(-50%,-50%)',font:`900 ${golden?64:54}px ui-rounded`,border:0,background:'transparent',filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',cursor:'pointer',zIndex:5500});
      const kill=setTimeout(()=>{ try{d.remove();}catch{} if(good) bus?.miss?.({source:'good-timeout'}); }, (life+(golden?0.28:0))*1000|0);
      d.addEventListener('click',(ev)=>{ clearTimeout(kill); try{d.remove();}catch{}; if(good){ const perfect=golden||Math.random()<0.2; const pts=Math.round((perfect?200:100)*(fever?1.5:1)); bus?.hit?.({kind:perfect?'perfect':'good',points:pts,ui:{x:ev.clientX,y:ev.clientY},meta:{good:1,golden:golden?1:0}}); } else { bus?.bad?.({source:'junk-click'}); } window.__notifySpawn?.(); }, {passive:true});
      host.appendChild(d);
    }
    return {
      start(){ alive=true; t=0; H(); for(let i=0;i<3;i++) spawn(busFor()); },
      setFever(on){ fever=!!on; },
      update(dt,bus){ if(!alive) return; t+=dt; while(t>=interval){ t-=interval; spawn(bus); } },
      cleanup(){ alive=false; try{ (document.getElementById('spawnHost')||{}).innerHTML=''; }catch{} }
    };
  }

  // ---------- Engine state ----------
  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode,diff){ const base=(TIME_BY_MODE[mode]??45); if(diff==='Easy') return base+5; if(diff==='Hard') return Math.max(20,base-5); return base; }

  const R = {
    playing:false, paused:false, remain:45,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null,
    matchTime:45, fever:false, feverBreaks:0,
    gold:0, goods:0, junkBad:0, misses:0,
    _dtMark:0, _secAccum:0, _lastRAF:0, _activity:0,
    _usingBuiltin:false
  };
  let hud=null, _engineTimer=null, _safetyPump=null, _watchdog=null, _lastSpawnMark=performance.now();

  function markActivity(){ R._activity = performance.now(); }
  function setTopHUD(){ hud?.setTop({mode:R.modeKey,diff:R.diff}); hud?.setTimer(R.remain); hud?.updateHUD(R.sys.score?.get?R.sys.score.get():0, R.sys.score?.combo|0); }

  // ---------- Fever ----------
  function feverOn(){ if(R.fever) return; R.fever=true; R.feverBreaks=0; hud?.showFever(true); R.sys.sfx?.bgmMain(false); R.sys.sfx?.bgmFever(true); R.coach?.onFever?.(); R.modeAPI?.setFever?.(true); Quests?.event?.('fever',{on:true}); }
  function feverOff(){ if(!R.fever) return; R.fever=false; R.feverBreaks=0; hud?.showFever(false); R.sys.sfx?.bgmFever(false); R.sys.sfx?.bgmMain(true); R.modeAPI?.setFever?.(false); Quests?.event?.('fever',{on:false}); }

  // ---------- Bus ----------
  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit:(e)=>{ _lastSpawnMark=performance.now(); markActivity(); const pts=(e?.points)|0; if(pts) R.sys.score.add(pts);
        R.sys.score.combo=(R.sys.score.combo|0)+1; if(R.sys.score.combo>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo;
        if(e?.meta?.gold===1 || e?.meta?.power==='gold') R.gold++; if(e?.meta?.good) R.goods++;
        if(!R.fever && (R.sys.score.combo|0)>=10) feverOn();
        hud && e?.ui && hud.showFloatingText(e.ui.x,e.ui.y,`+${pts}`); Quests?.event?.('hit',{...e,pointsAccum:R.sys.score.get(),comboNow:R.sys.score.combo});
        setTopHUD();
      },
      miss:(info)=>{ _lastSpawnMark=performance.now(); markActivity(); if(R.fever && ++R.feverBreaks>=3) feverOff(); R.misses++; R.sys.score.combo=0; R.coach?.onBad?.(); Quests?.event?.('miss',info||{}); setTopHUD(); },
      bad:(info)=>{ _lastSpawnMark=performance.now(); markActivity(); if(R.fever && ++R.feverBreaks>=3) feverOff(); R.junkBad++; R.sys.score.combo=0; R.sys.sfx?.bad?.(); Quests?.event?.('bad',info||{}); setTopHUD(); },
      power:(kind)=>{ _lastSpawnMark=performance.now(); markActivity(); R.sys.sfx?.power?.(); Quests?.event?.('power',{kind}); setTopHUD(); }
    };
  }

  // ---------- Dual-loop engine ----------
  function step(dt){
    if(!R.playing || R.paused) return;
    R._secAccum += dt;
    while(R._secAccum>=1){ R._secAccum -= 1; R.remain=Math.max(0,(R.remain|0)-1); hud?.setTimer(R.remain); if(R.remain===10) R.coach?.onTimeLow?.(); Quests?.tick?.({score:R.sys.score.get?.()||0,dt:1,fever:R.fever}); }
    try{ R.modeAPI?.update?.(dt, busFor()); }catch(e){ console.warn('[mode.update]', e); }
    try{ R.modeInst?.update?.(dt, busFor()); }catch(e){ console.warn('[inst.update]', e); }
    if(R.remain<=0){ endGame(); }
  }

  function tickRAF(){
    if(!R.playing){ R._raf = requestAnimationFrame(tickRAF); return; }
    const now = performance.now(); const dt = Math.max(0,(now-(R._dtMark||now))/1000); R._dtMark=now; R._lastRAF=now;
    step(dt);
    R._raf = requestAnimationFrame(tickRAF);
  }

  // ---------- Safety helpers ----------
  function ensureHosts(){
    const wrap = document.querySelector('.game-wrap') || document.body;
    let gameLayer = $('#gameLayer');
    if(!gameLayer){
      gameLayer = document.createElement('div');
      gameLayer.id='gameLayer';
      Object.assign(gameLayer.style,{position:'absolute',inset:'0',overflow:'hidden'});
      wrap.appendChild(gameLayer);
    }
    let spawnHost = $('#spawnHost');
    if(!spawnHost){
      spawnHost = document.createElement('div');
      spawnHost.id='spawnHost';
      Object.assign(spawnHost.style,{position:'absolute',inset:'0',pointerEvents:'auto',zIndex:'5'});
      gameLayer.appendChild(spawnHost);
    }
  }

  function startWatchdog(){
    clearInterval(_watchdog);
    window.__notifySpawn = ()=>{ _lastSpawnMark = performance.now(); };
    _lastSpawnMark = performance.now();
    _watchdog = setInterval(()=>{
      if(!R.playing || R.paused) return;
      const idleSpawnMs = performance.now() - _lastSpawnMark;
      // ถ้านิ่งเกิน 4s: พยายามรีสตาร์ทโหมด หรือเตะ update หนัก ๆ
      if(idleSpawnMs > 4000){
        console.warn('[watchdog] No spawns >4s, nudging…');
        try{ R.modeAPI?.restart?.(); }catch{}
        try{ R.modeAPI?.update?.(0.9, busFor()); R.modeInst?.update?.(0.9, busFor()); }catch{}
        _lastSpawnMark = performance.now();
      }
    }, 1500);

    // resume/pause จาก visibility
    document.addEventListener('visibilitychange', ()=>{
      if(!R.playing) return;
      if(document.visibilityState==='visible'){
        setPaused(false);
      }else{
        setPaused(true);
      }
    });
  }

  // ---------- Start / End / Pause ----------
  function threeTwoOneGo(cb){
    if(!hud?.showBig){ cb(); return; }
    const seq=['3','2','1','GO!']; let i=0;
    const run=()=>{ hud.showBig(seq[i]); if(seq[i]==='GO!'){ setTimeout(cb, 340); } else { setTimeout(()=>{ i++; run(); }, 480); } };
    run();
  }

  async function startGame(){
    if(window.HHA?._busy) return; window.HHA=window.HHA||{}; window.HHA._busy=true;

    ensureHosts();
    await loadCore(); Progress?.init?.();

    R.modeKey=document.body.getAttribute('data-mode')||'goodjunk';
    R.diff   =document.body.getAttribute('data-diff')||'Normal';
    R.matchTime=getMatchTime(R.modeKey,R.diff); R.remain=R.matchTime|0;

    R.gold=0; R.goods=0; R.junkBad=0; R.misses=0;
    R._dtMark=performance.now(); R._secAccum=0; R._lastRAF=performance.now(); markActivity();
    R._usingBuiltin=false;

    hud=new HUDClass(); hud.hideResult?.(); hud.resetBars?.(); hud.setTop?.({mode:R.modeKey,diff:R.diff}); hud.setTimer?.(R.remain); hud.updateHUD?.(0,0);

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

    // PRIME: บังคับให้มีการ spawn/เหตุการณ์ตั้งแต่ต้น
    try{ for(let i=0;i<3;i++) api?.update?.(0.40, busFor()); }catch{}

    // UI & BGM
    $('#menuBar')?.setAttribute('data-hidden','1'); $('#menuBar')&&( $('#menuBar').style.display='none' );
    document.body.setAttribute('data-playing','1');
    R.sys.sfx?.bgmFever(false); R.sys.sfx?.bgmMain(true);

    threeTwoOneGo(()=>{
      R.playing=true; R.paused=false; R._dtMark=performance.now(); R._secAccum=0; setTopHUD();
      startWatchdog();

      // Dual-loop: RAF + 30fps interval (กัน throttle)
      cancelAnimationFrame(R._raf); R._raf=requestAnimationFrame(tickRAF);
      clearInterval(_engineTimer); _engineTimer=setInterval(()=>step(1/30), 1000/30);

      // Safety pump: ถ้าว่างเงียบเกิน 1.2s ให้เตะ update เอง
      clearInterval(_safetyPump);
      _safetyPump=setInterval(()=>{
        if(!R.playing || R.paused) return;
        const idleFor = performance.now() - (R._activity||0);
        if(idleFor > 1200){
          try{ R.modeAPI?.update?.(0.9, busFor()); R.modeInst?.update?.(0.9, busFor()); }catch{}
          markActivity();
        }
      }, 600);

      // ถ้า 2.5s ยังไม่เกิดสกอร์/เหตุการณ์เลย → เปิด fallback
      setTimeout(()=>{
        if(!R._usingBuiltin && (R.sys.score.get?.()||0)===0 && R.misses===0 && R.junkBad===0){
          const B = BuiltinGoodJunk();
          try{ B.start({}); }catch{}
          R.modeAPI = { update:B.update.bind(B), start:B.start.bind(B), cleanup:B.cleanup.bind(B), setFever:B.setFever.bind(B) };
          R.modeInst = null;
          R._usingBuiltin = true;
          hud?.toast?.('Fallback mode active');
        }
      }, 2500);

      window.HHA._busy=false;
    });
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false;
    cancelAnimationFrame(R._raf); clearInterval(_engineTimer); clearInterval(_safetyPump); clearInterval(_watchdog);

    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state,hud); }catch{}
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
    else { R.sys.sfx?.bgmMain(true); if(R.fever) R.sys.sfx?.bgmFever(true); R._dtMark=performance.now(); markActivity(); hud?.toast?.('Resume'); }
  }

  // Expose
  window.HHA=window.HHA||{}; window.HHA.startGame=startGame; window.HHA.endGame=endGame; window.HHA.pause=()=>setPaused(true); window.HHA.resume=()=>setPaused(false);

  // canvases never block UI
  setTimeout(()=>{ $$('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} }); },0);

  // quick start
  window.addEventListener('keydown',(e)=>{ if((e.key==='Enter'||e.key===' ')&&!R.playing){ const menuVisible=!($('#menuBar')?.hasAttribute('data-hidden')); if(menuVisible){ e.preventDefault(); startGame(); } } },{passive:false});
})();
