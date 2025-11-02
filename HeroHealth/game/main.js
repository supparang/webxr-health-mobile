// === Hero Health Academy — /game/main.js (production, countdown+HUD+FEVER+pause) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function(){
  // ---------- DOM helpers ----------
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  // ---------- Soft fallbacks (overwrite when imports succeed) ----------
  let HUDClass, CoachClass, ScoreSystem, SFXClass, Quests, Progress;

  async function loadCore(){
    // HUD
    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch { HUDClass = class { constructor(){ this.setTop=()=>{}; this.setTimer=()=>{}; this.updateHUD=()=>{}; this.setQuestChips=()=>{}; this.showFever=()=>{}; this.resetBars=()=>{}; this.showBig=()=>{}; this.showFloatingText=()=>{}; this.showResult=()=>{}; this.hideResult=()=>{}; this.toast=()=>{}; } }; }

    // Coach
    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch { CoachClass = class { constructor(){ this.say=()=>{}; } onStart(){} onGood(){} onPerfect(){} onBad(){} onTimeLow(){} onQuestStart(){} onQuestDone(){} onFever(){} onEnd(){} }; }

    // Score
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch {
      ScoreSystem = class {
        constructor(){ this.value=0; this.combo=0; this.bestCombo=0; }
        add(n=0){ this.value+=(n|0); }
        get(){ return this.value|0; }
        reset(){ this.value=0; this.combo=0; this.bestCombo=0; }
      };
    }

    // SFX
    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch {
      SFXClass = class {
        constructor(){ this._on=true; this._a=(id)=>$(id?`#${id}`:null); }
        setEnabled(v){ this._on=!!v; }
        isEnabled(){ return !!this._on; }
        _p(id){ if(!this._on) return; const a=$(`#${id}`); try{ a && a.currentTime!=null && (a.currentTime=0); a && a.play && a.play(); }catch{} }
        good(){ this._p('sfx-good'); } bad(){ this._p('sfx-bad'); } perfect(){ this._p('sfx-perfect'); } tick(){ this._p('sfx-tick'); } power(){ this._p('sfx-powerup'); }
        bgmMain(on){ const a=$('#bgm-main'); try{ if(a){ a.loop=true; on?a.play():a.pause(); } }catch{} }
        bgmFever(on){ const a=$('#bgm-fever'); try{ if(a){ a.loop=true; on?a.play():a.pause(); } }catch{} }
      };
    }

    // Quests (ถ้าไม่มีไฟล์ ให้ fallback เวอร์ชันย่อที่รองรับ 10 เควสต์ + focus ทีละอัน)
    try { ({ Quests } = await import('./core/quests.js')); }
    catch {
      const BASE = [
        { key:'good_20',     label:'แตะของดี 20',       need:20, type:'inc',   icon:'🥗' },
        { key:'perfect_10',  label:'PERFECT 10',        need:10, type:'inc',   icon:'💥' },
        { key:'avoid_5',     label:'หลบ Junk 5',        need:5,  type:'avoid', icon:'🚫' },
        { key:'combo_15',    label:'คอมโบต่อเนื่อง 15', need:15, type:'combo', icon:'🔥' },
        { key:'gold_3',      label:'เก็บทอง 3',         need:3,  type:'gold',  icon:'🌟' },
        { key:'shield_1',    label:'ใช้โล่ 1',          need:1,  type:'shield',icon:'🛡️' },
        { key:'score_1000',  label:'สกอร์ถึง 1000',     need:1000,type:'score',icon:'🏆' },
        { key:'time_20',     label:'อยู่รอด 20 วิ',     need:20, type:'time',  icon:'⏱️' },
        { key:'fever_on',    label:'เข้า FEVER 1',       need:1,  type:'fever', icon:'⚡' },
        { key:'junk_0',      label:'ไม่กด Junk เลย',     need:1,  type:'nojunk',icon:'❎' },
      ];
      let state=null, hud=null, coach=null, currentIdx=0, elapsed=0;
      Quests = {
        bindToMain({hud:hh,coach:cc}){ hud=hh; coach=cc; return this; },
        beginRun(mode,diff,lang,matchTime){
          // สุ่ม 3 เควสต์จาก 10 และโฟกัสทีละอัน
          const pool=[...BASE];
          const picked=[];
          while(picked.length<3 && pool.length){ picked.push(pool.splice((Math.random()*pool.length)|0,1)[0]); }
          state = picked.map((q,i)=>({ ...q, progress:0, done:false, fail:false, active:i===0 }));
          currentIdx = 0; elapsed=0;
          hud && hud.setQuestChips(state);
          coach && coach.onQuestStart && coach.onQuestStart(state[0].label);
        },
        event(kind, payload={}){
          if(!state) return;
          const cur = state[currentIdx] || null;
          const upd = ()=>{ hud && hud.setQuestChips(state); };

          // อัปเดต elapsed สำหรับเควสต์ time
          if(kind==='tick'){ elapsed += (payload.dt||0); }

          // mapping เหตุการณ์
          if(kind==='hit'){
            if(cur){
              if(cur.type==='inc' && payload.points>0 && (payload.meta?.good||payload.meta?.golden)){ cur.progress++; }
              if(cur.type==='gold' && (payload.meta?.gold===1 || payload.meta?.power==='gold')){ cur.progress++; }
              if(cur.type==='score'){ cur.progress = Math.max(cur.progress, payload.pointsAccum|0); }
              if(cur.type==='combo'){ cur.progress = Math.max(cur.progress, payload.comboNow|0); }
            }
          }
          if(kind==='bad'){ if(cur && cur.type==='nojunk'){ cur.fail=true; } }
          if(kind==='miss'){ if(cur && cur.type==='inc'){ /* miss ของดีไม่เป็นไร แค่คอมโบแตก */ } }

          if(kind==='fever'){ if(cur && cur.type==='fever' && payload.on){ cur.progress = 1; } }
          if(kind==='power'){ if(cur && cur.type==='shield' && payload.kind==='shield'){ cur.progress = 1; } }
          if(kind==='tick' && cur && cur.type==='time'){ cur.progress = Math.min(cur.need, Math.floor(elapsed)); }

          // สำเร็จ?
          if(cur && !cur.done && !cur.fail){
            const ok = (cur.type==='score') ? ((payload.pointsAccum|0) >= cur.need) : (cur.progress >= cur.need);
            if(ok){
              cur.done=true; cur.active=false;
              coach && coach.onQuestDone && coach.onQuestDone();
              // ไปเควสต์ถัดไป
              currentIdx++;
              if(state[currentIdx]){ state[currentIdx].active=true; coach && coach.onQuestStart && coach.onQuestStart(state[currentIdx].label); }
            }
          }
          upd();
        },
        tick(meta){ // เรียกทุกวินาทีจาก main
          this.event('tick', { dt:meta.dt||1, pointsAccum:meta.score||0 });
        },
        endRun(meta){
          // summary
          const totalDone = (state||[]).filter(q=>q.done).length;
          return { list:(state||[]), totalDone };
        },
        getChips(){ return state||[]; }
      };
    }

    // Progress (โปรไฟล์/สถิติ)
    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, getStatSnapshot(){return{};} }; }
  }

  // ---------- Mode loader ----------
  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return {
      name:mod.name||key,
      create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null,
      start:mod.start||null, cleanup:mod.cleanup||null, setFever:mod.setFever||null
    };
  }

  // ---------- Engine state ----------
  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode, diff){
    const base = (TIME_BY_MODE[mode] != null) ? TIME_BY_MODE[mode] : 45;
    if (diff==='Easy') return base + 5;
    if (diff==='Hard') return Math.max(20, base - 5);
    return base;
  }

  const R = {
    playing:false, paused:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null,
    matchTime:45,
    fever:false, feverBreaks:0,
    gold:0, goods:0, junkBad:0, misses:0
  };
  let hud=null;

  // ---------- HUD sync ----------
  function setTopHUD(){
    hud && hud.setTop({ mode:R.modeKey, diff:R.diff });
    hud && hud.setTimer(R.remain);
    hud && hud.updateHUD(R.sys.score?.get ? R.sys.score.get() : 0, R.sys.score?.combo|0);
  }

  // ---------- FEVER control ----------
  function feverOn(){
    if(R.fever) return;
    R.fever=true; R.feverBreaks=0;
    hud && hud.showFever(true);
    R.sys.sfx?.bgmMain(false);
    R.sys.sfx?.bgmFever(true);
    R.coach?.onFever && R.coach.onFever();
    try{ R.modeAPI?.setFever?.(true); }catch{}
  }
  function feverOff(){
    if(!R.fever) return;
    R.fever=false; R.feverBreaks=0;
    hud && hud.showFever(false);
    R.sys.sfx?.bgmFever(false);
    R.sys.sfx?.bgmMain(true);
    try{ R.modeAPI?.setFever?.(false); }catch{}
  }

  // ---------- Bus to mode ----------
  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit:(e)=>{
        const pts=(e?.points)|0;
        if(pts){ R.sys.score.add(pts); }
        // combo++
        R.sys.score.combo = (R.sys.score.combo|0) + 1;
        if((R.sys.score.combo|0) > (R.sys.score.bestCombo|0)) R.sys.score.bestCombo = (R.sys.score.combo|0);

        if(e?.meta?.gold===1 || e?.meta?.power==='gold') R.gold++;
        if(e?.meta?.good) R.goods++;

        if(!R.fever && (R.sys.score.combo|0) >= 10) feverOn();

        hud && e?.ui && hud.showFloatingText(e.ui.x, e.ui.y, `+${pts}`);
        Quests?.event?.('hit',{ points:pts, pointsAccum:R.sys.score.get(), comboNow:R.sys.score.combo, meta:e?.meta||{} });
        setTopHUD();
      },
      // MISS = ของดีหมดเวลาเท่านั้น (โหมดส่งมา)
      miss:(_info)=>{
        if(R.fever){
          R.feverBreaks++;
          if(R.feverBreaks>=3) feverOff();
        }
        R.misses++;
        R.sys.score.combo = 0;
        R.coach?.onBad && R.coach.onBad();
        Quests?.event?.('miss', _info||{});
        setTopHUD();
      },
      // BAD = ผู้เล่นคลิก Junk
      bad:(_info)=>{
        if(R.fever){
          R.feverBreaks++;
          if(R.feverBreaks>=3) feverOff();
        }
        R.junkBad++;
        R.sys.score.combo = 0;
        R.sys.sfx?.bad?.();
        Quests?.event?.('bad', _info||{});
        setTopHUD();
      },
      power:(kind)=>{
        R.sys.sfx?.power?.();
        Quests?.event?.('power',{ kind });
        setTopHUD();
      }
    };
  }

  // ---------- Loop ----------
  function tickLoop(){
    if(!R.playing || R.paused){ R.raf=requestAnimationFrame(tickLoop); return; }

    const now = performance.now();
    const secGone = Math.floor((now - (R._secMark||now))/1000);
    const dt      = (now - (R._dtMark||now))/1000;
    R._secMark = now; R._dtMark = now;

    if(secGone>=1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      hud && hud.setTimer(R.remain);
      if(R.remain===10) R.coach?.onTimeLow && R.coach.onTimeLow();
      Quests?.tick?.({ score:R.sys.score.get?.()||0, dt:secGone, fever:R.fever });
    }

    try{
      if(R.modeAPI?.update) R.modeAPI.update(dt, busFor());
      else if(R.modeInst?.update) R.modeInst.update(dt, busFor());
      else if(R.modeAPI?.tick) R.modeAPI.tick(R.state||{}, R.sys, hud||{});
    }catch(e){ console.warn('[mode.update] error', e); }

    if(R.remain<=0){ endGame(); return; }
    R.raf=requestAnimationFrame(tickLoop);
  }

  // ---------- Start / Countdown ----------
  function threeTwoOneGo(cb){
    if(!hud?.showBig){ cb(); return; }
    const seq=['3','2','1','GO!'];
    let i=0;
    const step=()=>{
      hud.showBig(seq[i]);
      if(seq[i]==='GO!'){ setTimeout(cb, 360); }
      else { setTimeout(()=>{ i++; step(); }, 520); }
    };
    step();
  }

  async function startGame(){
    if(window.HHA?._busy) return;
    window.HHA = window.HHA || {};
    window.HHA._busy = true;

    await loadCore();
    Progress?.init?.();

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';
    R.matchTime = getMatchTime(R.modeKey, R.diff);
    R.remain    = R.matchTime|0;

    // reset stats
    R.gold=0; R.goods=0; R.junkBad=0; R.misses=0;

    hud = new HUDClass();
    hud.hideResult?.();
    hud.resetBars?.();
    hud.setTop?.({ mode:R.modeKey, diff:R.diff });
    hud.setTimer?.(R.remain);
    hud.updateHUD?.(0,0);

    R.sys.score = new ScoreSystem(); R.sys.score.reset?.();
    R.sys.sfx   = new SFXClass();

    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    R.coach?.onStart?.();

    Quests?.bindToMain?.({ hud, coach:R.coach });
    Quests?.beginRun?.(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime);

    // load mode
    let api=null;
    try { api = await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:', R.modeKey, e); hud?.toast?.('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }
    R.modeAPI = api;

    // create/init/start variations
    if(api?.create){
      R.modeInst = api.create({ engine:{}, hud, coach:R.coach });
      R.modeInst?.start?.({ time:R.matchTime, difficulty:R.diff });
    } else if(api?.init){
      api.init(R.state={ difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} }, hud, { time:R.matchTime, life:1600 });
    } else if(api?.start){
      api.start({ time:R.matchTime, difficulty:R.diff });
    }

    // show menu off
    const mb = $('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    document.body.setAttribute('data-playing','1');

    // prime music
    R.sys.sfx?.bgmFever(false);
    R.sys.sfx?.bgmMain(true);

    // countdown then run
    threeTwoOneGo(()=>{
      R.playing=true; R.paused=false;
      R._secMark = performance.now(); R._dtMark = performance.now();
      setTopHUD();
      R.raf = requestAnimationFrame(tickLoop);
      window.HHA._busy=false;
    });
  }

  // ---------- End game ----------
  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);

    // cleanup mode
    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state,hud); }catch{}

    // summary
    const score = R.sys.score?.get ? R.sys.score.get() : 0;
    const bestC = R.sys.score?.bestCombo|0;
    const stars = (score>=2000)?5 : (score>=1500)?4 : (score>=1000)?3 : (score>=600)?2 : (score>=200)?1 : 0;

    const qsum = Quests?.endRun?.({ score }) || { list:[], totalDone:0 };

    hud?.showResult?.({
      title:'Result',
      desc:`Mode: ${R.modeKey} • Diff: ${R.diff}\n⭐ Stars: ${'★'.repeat(stars)}${'☆'.repeat(5-stars)}`,
      stats:[
        `Score: ${score}`,
        `Best Combo: ${bestC}`,
        `Time: ${R.matchTime|0}s`,
        `Gold: ${R.gold}`,
        `Goods: ${R.goods}`,
        `Miss: ${R.misses}`,
        `Bad (Junk): ${R.junkBad}`,
        `Quests Done: ${qsum.totalDone}/3`
      ],
      extra: (qsum.list||[]).map(q=>{
        const st = q.done ? '✔' : (q.fail?'✘':'…');
        return `${st} ${q.label} (${q.progress||0}/${q.need||0})`;
      })
    });

    hud.onHome = ()=>{
      hud.hideResult?.();
      document.body.removeAttribute('data-playing');
      feverOff();
      R.sys.sfx?.bgmMain(false);
      const mb = $('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }
    };
    hud.onRetry = ()=>{
      hud.hideResult?.();
      feverOff();
      startGame();
    };

    R.coach?.onEnd?.(score);
    Progress?.endRun?.({ score, bestCombo:bestC });
    R.sys.sfx?.bgmMain(false);
  }

  // ---------- Pause / Resume ----------
  function setPaused(on){
    if(!R.playing) return;
    R.paused = !!on;
    if(R.paused){
      R.sys.sfx?.bgmMain(false);
      R.sys.sfx?.bgmFever(false);
      hud?.toast?.('Paused');
    }else{
      R.sys.sfx?.bgmMain(true);
      if(R.fever) R.sys.sfx?.bgmFever(true);
      R._secMark = performance.now(); R._dtMark = performance.now();
      hud?.toast?.('Resume');
    }
  }
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) setPaused(true); });
  window.addEventListener('keydown', (e)=>{ if(e.key.toLowerCase()==='p'){ setPaused(!R.paused); } }, {passive:true});

  // ---------- Expose ----------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;
  window.HHA.pause     = ()=>setPaused(true);
  window.HHA.resume    = ()=>setPaused(false);

  // canvases never block UI
  setTimeout(()=>{ $$('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} }); }, 0);

  // quick start with Enter/Space whenเมนูเปิด
  window.addEventListener('keydown',function(e){
    if((e.key==='Enter'||e.key===' ') && !R.playing){
      const menuVisible = !($('#menuBar')?.hasAttribute('data-hidden'));
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  }, {passive:false});
})();
