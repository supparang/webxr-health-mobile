// === Hero Health Academy — /game/main.js (idle-watchdog + safe fallback + prefill) ===
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
    catch { CoachClass = class { constructor(){ this.say=()=>{}; } onStart(){} onGood(){} onPerfect(){} onBad(){} onTimeLow(){} onQuestStart(){} onQuestDone(){} onFever(){} onEnd(){} }; }

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
      const BASE = [
        { key:'good_20',    label:'แตะของดี 20',     need:20,   type:'inc',    icon:'🥗' },
        { key:'perfect_10', label:'PERFECT 10',      need:10,   type:'inc',    icon:'💥' },
        { key:'avoid_20s',  label:'หลบ JUNK 20 วิ',  need:20,   type:'time_nojunk', icon:'🚫' },
        { key:'combo_16',   label:'ทำคอมโบ 16',     need:16,   type:'combo',  icon:'🔥' },
        { key:'gold_3',     label:'เก็บทอง 3',       need:3,    type:'gold',   icon:'🌟' },
        { key:'shield_1',   label:'ใช้โล่ 1',        need:1,    type:'shield', icon:'🛡️' },
        { key:'score_1000', label:'สกอร์ถึง 1000',   need:1000, type:'score',  icon:'🏆' },
        { key:'time_20',    label:'อยู่รอด 20 วิ',   need:20,   type:'time',   icon:'⏱️' },
        { key:'fever_on',   label:'เข้า FEVER 1',    need:1,    type:'fever',  icon:'⚡' },
        { key:'nojunk',     label:'ไม่กด JUNK เลย',  need:1,    type:'nojunk', icon:'❎' },
      ];
      let state=null, cur=0, elapsed=0, nojunkTimer=0, hud=null, coach=null;
      Quests = {
        bindToMain({hud:hh,coach:cc}){ hud=hh; coach=cc; return this; },
        beginRun(){ const pool=[...BASE], pick=[]; while(pick.length<3&&pool.length) pick.push(pool.splice((Math.random()*pool.length)|0,1)[0]);
          state=pick.map((q,i)=>({...q,progress:0,done:false,fail:false,active:i===0})); cur=0; elapsed=0; nojunkTimer=0;
          hud?.setQuestChips(state); coach?.onQuestStart?.(state[0].label);
        },
        event(kind,p={}){ if(!state) return; const q=state[cur]; if(!q) return;
          if(kind==='tick'){ elapsed+=(p.dt||0); if(q.type==='time') q.progress=Math.min(q.need,Math.floor(elapsed)); if(q.type==='time_nojunk') q.progress=Math.min(q.need,Math.floor(nojunkTimer)); }
          if(kind==='hit'){ if(q.type==='inc' && (p.meta?.good||p.meta?.golden)) q.progress++; if(q.type==='gold' && (p.meta?.gold===1||p.meta?.power==='gold')) q.progress++;
            if(q.type==='score') q.progress=Math.max(q.progress,p.pointsAccum|0); if(q.type==='combo') q.progress=Math.max(q.progress,p.comboNow|0); nojunkTimer=0; }
          if(kind==='bad'){ if(q.type==='nojunk'||q.type==='time_nojunk') { q.fail=true; nojunkTimer=0; } }
          if(kind==='miss'){ /* คอมโบแตกเฉย ๆ */ }
          if(kind==='fever' && q.type==='fever' && p.on) q.progress=1;
          if(kind==='power' && q.type==='shield' && p.kind==='shield') q.progress=1;
          if(kind==='tick'){ nojunkTimer+=p.dt||0; }
          const ok=(q.type==='score')?((p.pointsAccum|0)>=q.need):(q.progress>=q.need);
          if(ok && !q.fail){ q.done=true; q.active=false; coach?.onQuestDone?.(); cur++; if(state[cur]){ state[cur].active=true; coach?.onQuestStart?.(state[cur].label); } }
          hud?.setQuestChips(state);
        },
        tick(meta){ this.event('tick', meta); },
        endRun(){ return { list:(state||[]), totalDone:(state||[]).filter(x=>x.done).length }; },
        getChips(){ return state||[]; }
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

  // -------- Builtin emergency spawner (ต่อเนื่องทันที + prefill) --------
  function BuiltinGoodJunk(){
    let alive=false, t=0, interval=0.65, life=2.10, host=null, fever=false;
    function ensureHost(){ host=document.getElementById('spawnHost')||document.body; }
    function spawn(bus){
      ensureHost();
      const isGood=Math.random()<0.72, isGolden=Math.random()<0.12;
      const G=['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍇'], B=['🍔','🍟','🍕','🍩','🍫','🥤'];
      const glyph=isGolden?'🌟':(isGood?G[Math.random()*G.length|0]:B[Math.random()*B.length|0]);
      const d=document.createElement('button'); d.textContent=glyph; d.type='button';
      Object.assign(d.style,{
        position:'fixed',
        left:(56+Math.random()*(innerWidth-112))+'px',
        top:(90+Math.random()*(innerHeight-240))+'px',
        transform:'translate(-50%,-50%)',
        font:`900 ${isGolden?64:54}px ui-rounded`,
        border:0,background:'transparent',
        filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',
        cursor:'pointer',zIndex:5500
      });
      const kill=setTimeout(()=>{ try{d.remove();}catch{} if(isGood) bus?.miss?.({source:'good-timeout'}); }, (life+(isGolden?0.3:0))*1000|0);
      d.addEventListener('click', (ev)=>{ clearTimeout(kill); try{d.remove();}catch{};
        if(isGood){ const perfect=isGolden||Math.random()<0.2; const pts=Math.round((perfect?200:100)*(fever?1.5:1));
          bus?.hit?.({ kind:perfect?'perfect':'good', points:pts, ui:{x:ev.clientX,y:ev.clientY}, meta:{ good:1, golden:(isGolden?1:0) }});
        }else{ bus?.bad?.({source:'junk-click'}); }
      }, {passive:true});
      host.appendChild(d);
    }
    return {
      start(){ alive=true; t=0; ensureHost(); /* prefill */ for(let i=0;i<3;i++) spawn(busFor()); },
      setFever(on){ fever=!!on; },
      update(dt,bus){ if(!alive) return; t+=dt; while(t>=interval){ t-=interval; spawn(bus); } },
      cleanup(){ alive=false; try{ (document.getElementById('spawnHost')||{}).innerHTML=''; }catch{} }
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
    _dtMark:0, _secAccum:0, _lastRAF:0,
    _usingBuiltin:false, _idleKicks:0, _kickCount:0,
    _activityMark:0
  };
  let hud=null;

  function setTopHUD(){ hud?.setTop({mode:R.modeKey,diff:R.diff}); hud?.setTimer(R.remain); hud?.updateHUD(R.sys.score?.get?R.sys.score.get():0, R.sys.score?.combo|0); }
  function markActivity(){ R._activityMark = performance.now(); }

  function feverOn(){ if(R.fever) return; R.fever=true; R.feverBreaks=0; hud?.showFever(true); R.sys.sfx?.bgmMain(false); R.sys.sfx?.bgmFever(true); R.coach?.onFever?.(); Quests?.event?.('fever',{on:true}); try{R.modeAPI?.setFever?.(true)}catch{} }
  function feverOff(){ if(!R.fever) return; R.fever=false; R.feverBreaks=0; hud?.showFever(false); R.sys.sfx?.bgmFever(false); R.sys.sfx?.bgmMain(true); Quests?.event?.('fever',{on:false}); try{R.modeAPI?.setFever?.(false)}catch{} }

  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit:(e)=>{ markActivity(); const pts=(e?.points)|0; if(pts) R.sys.score.add(pts);
        R.sys.score.combo=(R.sys.score.combo|0)+1; if(R.sys.score.combo>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo;
        if(e?.meta?.gold===1 || e?.meta?.power==='gold') R.gold++; if(e?.meta?.good) R.goods++;
        if(!R.fever && (R.sys.score.combo|0)>=10) feverOn();
        hud && e?.ui && hud.showFloatingText(e.ui.x,e.ui.y,`+${pts}`); Quests?.event?.('hit',{...e,pointsAccum:R.sys.score.get(),comboNow:R.sys.score.combo}); setTopHUD();
      },
      miss:(info)=>{ markActivity(); if(R.fever && ++R.feverBreaks>=3) feverOff(); R.misses++; R.sys.score.combo=0; R.coach?.onBad?.(); Quests?.event?.('miss',info||{}); setTopHUD(); },
      bad:(info)=>{ markActivity(); if(R.fever && ++R.feverBreaks>=3) feverOff(); R.junkBad++; R.sys.score.combo=0; R.sys.sfx?.bad?.(); Quests?.event?.('bad',info||{}); setTopHUD(); },
      power:(kind)=>{ markActivity(); R.sys.sfx?.power?.(); Quests?.event?.('power',{kind}); setTopHUD(); }
    };
  }

  function switchToBuiltin(reason='fallback'){
    if(R._usingBuiltin) return;
    const B = BuiltinGoodJunk();
    B.start({});
    R.modeAPI = { update:B.update.bind(B), start:B.start.bind(B), cleanup:B.cleanup.bind(B), setFever:B.setFever.bind(B) };
    R.modeInst = null;
    R._usingBuiltin = true;
    hud?.toast?.(reason==='idle' ? 'Fallback (idle)' : 'Fallback mode active');
  }

  function tickLoop(){
    R._lastRAF = performance.now();
    if(!R.playing || R.paused){ R.raf=requestAnimationFrame(tickLoop); return; }
    const now=performance.now(); const dt=Math.max(0,(now-(R._dtMark||now))/1000); R._dtMark=now;

    R._secAccum+=dt;
    while(R._secAccum>=1){ R._secAccum-=1; R.remain=Math.max(0,(R.remain|0)-1); hud?.setTimer(R.remain); if(R.remain===10) R.coach?.onTimeLow?.(); Quests?.tick?.({score:R.sys.score.get?.()||0,dt:1,fever:R.fever}); }

    try{ R.modeAPI?.update && R.modeAPI.update(dt, busFor()); }catch(e){ console.warn('api.update error',e); }
    try{ R.modeInst?.update && R.modeInst.update(dt, busFor()); }catch(e){ console.warn('inst.update error',e); }

    if(R.remain<=0){ endGame(); return; }
    R.raf=requestAnimationFrame(tickLoop);
  }

  // ---------- idle-watchdog: ถ้าเงียบเกิน 1.5s ให้ kick; เกิน 2 รอบ สลับ fallback ----------
  setInterval(()=>{
    if(!R.playing || R.paused || R._usingBuiltin) return;
    const since = performance.now() - (R._activityMark||0);
    if(since > 1500){
      try{ R.modeAPI?.update?.(1.0, busFor()); R.modeInst?.update?.(1.0, busFor()); }catch{}
      R._idleKicks = (R._idleKicks|0) + 1;
      if(R._idleKicks >= 2){ switchToBuiltin('idle'); }
    }
  }, 900);

  // heartbeat: ถ้า RAF ถูก throttle ให้เรียก tick เอง
  setInterval(()=>{ if(!R.playing || R.paused) return; const since=performance.now()-(R._lastRAF||0); if(since>800){ tickLoop(); } }, 600);

  function threeTwoOneGo(cb){
    if(!hud?.showBig){ cb(); return; }
    const seq=['3','2','1','GO!']; let i=0;
    const step=()=>{ hud.showBig(seq[i]); if(seq[i]==='GO!'){ setTimeout(cb,360); } else { setTimeout(()=>{ i++; step(); },520); } };
    step();
  }

  async function startGame(){
    if(window.HHA?._busy) return; window.HHA=window.HHA||{}; window.HHA._busy=true;

    await loadCore(); Progress?.init?.();

    R.modeKey=document.body.getAttribute('data-mode')||'goodjunk';
    R.diff   =document.body.getAttribute('data-diff')||'Normal';
    R.matchTime=getMatchTime(R.modeKey,R.diff); R.remain=R.matchTime|0;

    R.gold=0; R.goods=0; R.junkBad=0; R.misses=0;
    R._dtMark=performance.now(); R._secAccum=0; R._lastRAF=performance.now();
    R._usingBuiltin=false; R._idleKicks=0; R._kickCount=0; markActivity();

    hud=new HUDClass(); hud.hideResult?.(); hud.resetBars?.(); hud.setTop?.({mode:R.modeKey,diff:R.diff}); hud.setTimer?.(R.remain); hud.updateHUD?.(0,0);

    R.sys.score=new ScoreSystem(); R.sys.score.reset?.();
    R.sys.sfx  =new SFXClass();

    R.coach=new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') }); R.coach?.onStart?.();

    Quests?.bindToMain?.({hud,coach:R.coach}); Quests?.beginRun?.(R.modeKey,R.diff,(localStorage.getItem('hha_lang')||'TH'),R.matchTime);

    // โหลดโหมดจริง
    let api=null;
    try{ api=await loadMode(R.modeKey); }catch(e){ console.error('[HHA] Failed to load mode:', R.modeKey, e); }
    if(!api || (!api.update && !api.create)){ switchToBuiltin('import-fail'); api = R.modeAPI; }
    R.modeAPI=api;

    if(api?.create){ R.modeInst=api.create({engine:{},hud,coach:R.coach}); try{ R.modeInst?.start?.({time:R.matchTime,difficulty:R.diff}); }catch{} }
    if(api?.start){ try{ api.start({time:R.matchTime,difficulty:R.diff}); }catch{} }

    const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    document.body.setAttribute('data-playing','1');

    R.sys.sfx?.bgmFever(false); R.sys.sfx?.bgmMain(true);

    threeTwoOneGo(()=>{
      R.playing=true; R.paused=false; R._dtMark=performance.now(); R._secAccum=0; markActivity(); setTopHUD(); R.raf=requestAnimationFrame(tickLoop);

      // ✅ safe fallback: ถ้า 2.5s หลัง GO ยังไม่มีแต้ม/เหตุการณ์เลย → สลับ fallback
      setTimeout(()=>{
        if(!R._usingBuiltin && (R.sys.score.get?.()||0)===0 && R.misses===0 && R.junkBad===0){
          switchToBuiltin('idle');
        }
      }, 2500);

      window.HHA._busy=false;
    });
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

  function setPaused(on){ if(!R.playing) return; R.paused=!!on; if(R.paused){ R.sys.sfx?.bgmMain(false); R.sys.sfx?.bgmFever(false); hud?.toast?.('Paused'); }
    else { R.sys.sfx?.bgmMain(true); if(R.fever) R.sys.sfx?.bgmFever(true); R._dtMark=performance.now(); markActivity(); hud?.toast?.('Resume'); } }
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) setPaused(true); });
  ['pointerdown','touchstart','keydown'].forEach(ev=>window.addEventListener(ev, ()=>{ if(R.playing && R.paused) setPaused(false); }, {once:false,passive:true}));
  window.addEventListener('keydown', (e)=>{ if(e.key.toLowerCase()==='p') setPaused(!R.paused); }, {passive:true});

  window.HHA=window.HHA||{}; window.HHA.startGame=startGame; window.HHA.endGame=endGame; window.HHA.pause=()=>setPaused(true); window.HHA.resume=()=>setPaused(false);

  setTimeout(()=>{ $$('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} }); },0);
  window.addEventListener('keydown',(e)=>{ if((e.key==='Enter'||e.key===' ')&&!R.playing){ const menuVisible=!($('#menuBar')?.hasAttribute('data-hidden')); if(menuVisible){ e.preventDefault(); startGame(); } } },{passive:false});
})();
