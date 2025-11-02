// === Hero Health Academy — /game/main.js (timer-fix + spawn watchdog) ===
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
    catch {
      ScoreSystem = class {
        constructor(){ this.value=0; this.combo=0; this.bestCombo=0; }
        add(n=0){ this.value+=(n|0); }
        get(){ return this.value|0; }
        reset(){ this.value=0; this.combo=0; this.bestCombo=0; }
      };
    }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch {
      SFXClass = class {
        constructor(){ this._on=true; }
        setEnabled(v){ this._on=!!v; } isEnabled(){ return !!this._on; }
        _p(id){ if(!this._on) return; const a=document.getElementById(id); try{ a && (a.currentTime=0) && a.play(); }catch{} }
        good(){ this._p('sfx-good'); } bad(){ this._p('sfx-bad'); } perfect(){ this._p('sfx-perfect'); }
        tick(){ this._p('sfx-tick'); } power(){ this._p('sfx-powerup'); }
        bgmMain(on){ const a=document.getElementById('bgm-main');  try{ a&&(a.loop=true); on?a?.play():a?.pause(); }catch{} }
        bgmFever(on){ const a=document.getElementById('bgm-fever'); try{ a&&(a.loop=true); on?a?.play():a?.pause(); }catch{} }
      };
    }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch {
      const BASE = [
        { key:'avoid_20s',   label:'หลีกเลี่ยง JUNK 20 วิ', need:20, type:'time_nojunk', icon:'🚫' },
        { key:'fever_1',     label:'เข้า FEVER 1 ครั้ง',     need:1,  type:'fever',       icon:'⚡'  },
        { key:'combo_20',    label:'ทำคอมโบ 20',            need:20, type:'combo',       icon:'🔥'  },
        { key:'good_20',     label:'แตะของดี 20',           need:20, type:'inc',         icon:'🥗'  },
        { key:'perfect_8',   label:'PERFECT 8',             need:8,  type:'inc_perfect', icon:'💥'  },
        { key:'gold_3',      label:'เก็บทอง 3',             need:3,  type:'gold',        icon:'🌟'  },
        { key:'score_1200',  label:'สกอร์ถึง 1200',         need:1200,type:'score',      icon:'🏆'  },
        { key:'time_25',     label:'อยู่รอด 25 วิ',         need:25, type:'time',        icon:'⏱️'  },
        { key:'shield_1',    label:'ใช้โล่ 1',              need:1,  type:'shield',      icon:'🛡️'  },
        { key:'nojunk',      label:'ไม่กด Junk เลย',        need:1,  type:'nojunk',      icon:'❎'  },
      ];
      let state=null, hud=null, coach=null, cur=0, el=0, nojunkClock=0, brokeNoJunk=false;
      Quests={
        bindToMain({hud:hh,coach:cc}){ hud=hh; coach=cc; return this; },
        beginRun(){ const pool=[...BASE], picked=[]; while(picked.length<3&&pool.length){ picked.push(pool.splice((Math.random()*pool.length)|0,1)[0]); }
          state=picked.map((q,i)=>({...q,progress:0,done:false,fail:false,active:i===0})); cur=0; el=0; nojunkClock=0; brokeNoJunk=false; hud?.setQuestChips(state); coach?.onQuestStart?.(state[0].label); },
        event(kind,p={}){
          if(!state) return; const q=state[cur]; if(!q) return;
          if(kind==='tick'){ el+=(p.dt||0); if(!brokeNoJunk) nojunkClock+=(p.dt||0); if(q.type==='time') q.progress=Math.min(q.need, Math.floor(el)); if(q.type==='time_nojunk') q.progress=Math.min(q.need, Math.floor(nojunkClock)); }
          if(kind==='hit'){ if(q.type==='inc' && p.meta?.good) q.progress++; if(q.type==='inc_perfect' && (p.kind==='perfect'||p.meta?.golden)) q.progress++; if(q.type==='score') q.progress=Math.max(q.progress, p.pointsAccum|0); if(q.type==='combo') q.progress=Math.max(q.progress, p.comboNow|0); if(q.type==='gold' && (p.meta?.gold===1||p.meta?.power==='gold')) q.progress++; }
          if(kind==='bad'){ if(q.type==='nojunk') q.fail=true; brokeNoJunk=true; }
          if(kind==='fever' && p.on && q.type==='fever'){ q.progress=1; }
          if(kind==='power' && p.kind==='shield' && q.type==='shield'){ q.progress=1; }
          const ok = (!q.fail) && ((q.type==='score') ? (q.progress>=q.need) : (q.progress>=q.need));
          if(ok){ q.done=true; q.active=false; coach?.onQuestDone?.(); cur++; if(state[cur]){ state[cur].active=true; coach?.onQuestStart?.(state[cur].label); } }
          hud?.setQuestChips(state);
        },
        tick(meta){ this.event('tick',{dt:meta.dt||1}); this.event('tick',{dt:0, pointsAccum:meta.score||0}); },
        endRun(){ return { list:state||[], totalDone:(state||[]).filter(x=>x.done).length }; },
        getChips(){ return state||[]; }
      };
    }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, getStatSnapshot(){return{};} }; }
  }

  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return { name:mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null, start:mod.start||null, cleanup:mod.cleanup||null, setFever:mod.setFever||null };
  }

  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode, diff){ const base=(TIME_BY_MODE[mode]!=null)?TIME_BY_MODE[mode]:45; if(diff==='Easy') return base+5; if(diff==='Hard') return Math.max(20,base-5); return base; }

  const R = {
    playing:false, paused:false, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal', modeAPI:null, modeInst:null, state:null, coach:null,
    matchTime:45, fever:false, feverBreaks:0,
    gold:0, goods:0, junkBad:0, misses:0,
    _dtMark:0, _secAccum:0, _spawnWatch:0
  };
  let hud=null;

  function setTopHUD(){
    hud?.setTop({ mode:R.modeKey, diff:R.diff });
    hud?.setTimer(R.remain);
    hud?.updateHUD(R.sys.score?.get?R.sys.score.get():0, R.sys.score?.combo|0);
  }

  function feverOn(){
    if(R.fever) return; R.fever=true; R.feverBreaks=0;
    hud?.showFever(true); R.sys.sfx?.bgmMain(false); R.sys.sfx?.bgmFever(true); R.coach?.onFever?.();
    try{ R.modeAPI?.setFever?.(true); }catch{}
    Quests?.event?.('fever',{on:true});
  }
  function feverOff(){
    if(!R.fever) return; R.fever=false; R.feverBreaks=0;
    hud?.showFever(false); R.sys.sfx?.bgmFever(false); R.sys.sfx?.bgmMain(true);
    try{ R.modeAPI?.setFever?.(false); }catch{}
    Quests?.event?.('fever',{on:false});
  }

  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit:(e)=>{
        const pts=(e?.points)|0; if(pts) R.sys.score.add(pts);
        R.sys.score.combo = (R.sys.score.combo|0)+1;
        if((R.sys.score.combo|0) > (R.sys.score.bestCombo|0)) R.sys.score.bestCombo = (R.sys.score.combo|0);
        if(e?.meta?.gold===1 || e?.meta?.power==='gold') R.gold++; if(e?.meta?.good) R.goods++;
        if(!R.fever && (R.sys.score.combo|0) >= 10) feverOn();
        hud && e?.ui && hud.showFloatingText(e.ui.x, e.ui.y, `+${pts}`);
        Quests?.event?.('hit',{ ...e, pointsAccum:R.sys.score.get(), comboNow:R.sys.score.combo });
        setTopHUD(); R._spawnWatch = 0; // มีแอคชันเกิดขึ้นแล้ว
      },
      miss:(info)=>{ if(R.fever && ++R.feverBreaks>=3) feverOff(); R.misses++; R.sys.score.combo=0; R.coach?.onBad?.(); Quests?.event?.('miss',info||{}); setTopHUD(); },
      bad:(info)=>{ if(R.fever && ++R.feverBreaks>=3) feverOff(); R.junkBad++; R.sys.score.combo=0; R.sys.sfx?.bad?.(); Quests?.event?.('bad',info||{}); setTopHUD(); },
      power:(kind)=>{ R.sys.sfx?.power?.(); Quests?.event?.('power',{kind}); setTopHUD(); }
    };
  }

  function tickLoop(){
    if(!R.playing || R.paused){ R.raf=requestAnimationFrame(tickLoop); return; }

    const now = performance.now();
    const dt  = Math.max(0, (now - (R._dtMark||now))/1000);
    R._dtMark = now;

    // --- Timer: สะสมทีละเฟรมแล้วหักทีละวินาที ---
    R._secAccum += dt;
    while(R._secAccum >= 1){
      R._secAccum -= 1;
      R.remain = Math.max(0, (R.remain|0) - 1);
      hud?.setTimer(R.remain);
      if(R.remain===10) R.coach?.onTimeLow?.();
      Quests?.tick?.({ score:R.sys.score.get?.()||0, dt:1, fever:R.fever });
    }

    // --- โหมดอัปเดต ---
    try{
      if(R.modeAPI?.update) R.modeAPI.update(dt, busFor());
      else if(R.modeInst?.update) R.modeInst.update(dt, busFor());
      else if(R.modeAPI?.tick) R.modeAPI.tick(R.state||{}, R.sys, hud||{});
    }catch(e){ console.warn('[mode.update] error', e); }

    // --- watchdog: ถ้า 2 วิไม่มีฮิต/สแปวน ให้กระตุ้นโหมด ---
    R._spawnWatch += dt;
    if(R._spawnWatch > 2 && R.modeAPI?.update){
      try{
        // กระตุ้นด้วย dt ก้อนใหญ่ 0.8s เพื่อบังคับให้ผ่าน threshold spawn
        R.modeAPI.update(0.8, busFor());
        R._spawnWatch = 0;
      }catch{}
    }

    if(R.remain<=0){ return endGame(); }
    R.raf = requestAnimationFrame(tickLoop);
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

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';
    R.matchTime = getMatchTime(R.modeKey, R.diff);
    R.remain    = R.matchTime|0;

    R.gold=0; R.goods=0; R.junkBad=0; R.misses=0;
    R._dtMark = performance.now(); R._secAccum = 0; R._spawnWatch = 0;

    hud = new HUDClass(); hud.hideResult?.(); hud.resetBars?.(); hud.setTop?.({mode:R.modeKey,diff:R.diff}); hud.setTimer?.(R.remain); hud.updateHUD?.(0,0);

    R.sys.score = new ScoreSystem(); R.sys.score.reset?.();
    R.sys.sfx   = new SFXClass();

    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') }); R.coach?.onStart?.();

    Quests?.bindToMain?.({ hud, coach:R.coach });
    Quests?.beginRun?.(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime);

    let api=null;
    try { api = await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:', R.modeKey, e); hud?.toast?.('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }
    R.modeAPI = api;

    if(api?.create){ R.modeInst = api.create({engine:{},hud,coach:R.coach}); R.modeInst?.start?.({ time:R.matchTime, difficulty:R.diff }); }
    else if(api?.init){ api.init(R.state={ difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} }, hud, { time:R.matchTime, life:1600 }); }
    else if(api?.start){ api.start({ time:R.matchTime, difficulty:R.diff }); }

    const mb = $('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    document.body.setAttribute('data-playing','1');

    R.sys.sfx?.bgmFever(false); R.sys.sfx?.bgmMain(true);

    threeTwoOneGo(()=>{ R.playing=true; R.paused=false; R._dtMark = performance.now(); R._secAccum=0; setTopHUD(); R.raf=requestAnimationFrame(tickLoop); window.HHA._busy=false; });
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state,hud); }catch{}
    const score = R.sys.score?.get?R.sys.score.get():0;
    const bestC = R.sys.score?.bestCombo|0;
    const stars = (score>=2000)?5 : (score>=1500)?4 : (score>=1000)?3 : (score>=600)?2 : (score>=200)?1 : 0;
    const qsum  = Quests?.endRun?.({ score }) || { list:[], totalDone:0 };

    hud?.showResult?.({
      title:'Result',
      desc:`Mode: ${R.modeKey} • Diff: ${R.diff}\n⭐ Stars: ${'★'.repeat(stars)}${'☆'.repeat(5-stars)}`,
      stats:[ `Score: ${score}`, `Best Combo: ${bestC}`, `Time: ${R.matchTime|0}s`, `Gold: ${R.gold}`, `Goods: ${R.goods}`, `Miss (Good timeout): ${R.misses}`, `Bad (Junk click): ${R.junkBad}`, `Quests Done: ${qsum.totalDone}/3` ],
      extra:(qsum.list||[]).map(q=>`${q.done?'✔':(q.fail?'✘':'…')} ${q.label} (${q.progress||0}/${q.need||0})`)
    });

    hud.onHome = ()=>{ hud.hideResult?.(); document.body.removeAttribute('data-playing'); feverOff(); R.sys.sfx?.bgmMain(false); const mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; } };
    hud.onRetry = ()=>{ hud.hideResult?.(); feverOff(); startGame(); };

    R.coach?.onEnd?.(score); Progress?.endRun?.({ score, bestCombo:bestC }); R.sys.sfx?.bgmMain(false);
  }

  function setPaused(on){ if(!R.playing) return; R.paused=!!on; if(R.paused){ R.sys.sfx?.bgmMain(false); R.sys.sfx?.bgmFever(false); hud?.toast?.('Paused'); } else { R.sys.sfx?.bgmMain(true); if(R.fever) R.sys.sfx?.bgmFever(true); R._dtMark=performance.now(); hud?.toast?.('Resume'); } }
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) setPaused(true); });
  window.addEventListener('keydown', (e)=>{ if(e.key.toLowerCase()==='p') setPaused(!R.paused); }, {passive:true});

  window.HHA = window.HHA || {}; window.HHA.startGame = startGame; window.HHA.endGame=endGame; window.HHA.pause=()=>setPaused(true); window.HHA.resume=()=>setPaused(false);

  setTimeout(()=>{ $$('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} }); },0);
  window.addEventListener('keydown', (e)=>{ if((e.key==='Enter'||e.key===' ') && !R.playing){ const menuVisible = !($('#menuBar')?.hasAttribute('data-hidden')); if(menuVisible){ e.preventDefault(); startGame(); } } }, {passive:false});
})();
