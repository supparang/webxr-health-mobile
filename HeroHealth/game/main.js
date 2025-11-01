// === Hero Health Academy — game/main.js (stable; Start strong + Coach 3-2-1 + Fever + Missions + Result) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  // Safe stubs
  let ScoreSystem, SFXClass, Quests, Progress, CoachClass, HUDClass;

  async function loadCore(){
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n=0){this.value+=n|0;} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ constructor(){this._on=true;} setEnabled(v){this._on=!!v;} isEnabled(){return!!this._on;} good(){} bad(){} perfect(){} power(){} tick(){} fever(){} quest(){} }; }

    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch { HUDClass = class{ constructor(){ this.root=document.getElementById('hud')||Object.assign(document.createElement('div'),{id:'hud'}); if(!document.getElementById('hud')) document.body.appendChild(this.root);} setTop(){} setQuestChips(){} fever(){} say(){} setStageProgress(){} showMission(){} updateMissionProgress(){} hideMission(){} showResult(){} hideResult(){} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch { CoachClass = class{ constructor(opts={}){ this.lang=(localStorage.getItem('hha_lang')||opts.lang||'TH').toUpperCase(); } say(){} onStart(){}, onGood(){}, onPerfect(){}, onBad(){}, onTimeLow(){}, onEnd(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { beginRun(){}, event(){}, tick(){}, endRun(){return null;}, bindToMain(){return{refresh(){}}} }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};} }; }
  }

  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode='goodjunk', diff='Normal'){
    const base = TIME_BY_MODE[mode] ?? 45;
    if (diff==='Easy') return base + 5;
    if (diff==='Hard') return Math.max(20, base - 5);
    return base;
  }

  // Missions per difficulty
  const QUEST_DEF = {
    Easy:   [{key:'good', need:10, icon:'🥦'}, {key:'combo', need:5, icon:'✨'}, {key:'star', need:1, icon:'⭐'}],
    Normal: [{key:'good', need:16, icon:'🥦'}, {key:'combo', need:10, icon:'✨'}, {key:'star', need:2, icon:'⭐'}],
    Hard:   [{key:'good', need:22, icon:'🥦'}, {key:'combo', need:15, icon:'✨'}, {key:'star', need:3, icon:'⭐'}],
  };

  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null, hud:null,
    matchTime:45,
    feverActive:false, feverBreaks:0,
    quests:[], qIndex:0, qProg:{good:0, combo:0, star:0}, stars:0
  };

  function setBadges(){
    R.hud?.setTop?.({ mode:R.modeKey, diff:R.diff, time:R.remain, score:R.sys?.score?.get?.()||0, combo:R.sys?.score?.combo|0, stars:R.stars });
    const mB=$('#modeBadge'); if(mB) mB.textContent=R.modeKey;
    const dB=$('#diffBadge'); if(dB) dB.textContent=R.diff;
    const sV=$('#scoreVal'); if(sV) sV.textContent=R.sys?.score?.get?.()||0;
  }

  // ----- Mode loader -----
  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){ const mod = await import(MODE_PATH(key)); return { start:mod.start||mod.init||null, update:mod.update||mod.tick||null, setFever:mod.setFever||(()=>{}), grantShield:mod.grantShield||(()=>{}) }; }

  // ----- FEVER helpers -----
  function setFever(on){
    if (R.feverActive===on) return;
    R.feverActive = !!on;
    R.hud?.fever?.(R.feverActive);
    R.modeAPI?.setFever?.(R.feverActive);
    R.sys.sfx?.fever?.(R.feverActive);
  }

  // ----- Missions -----
  function loadMissions(){
    R.quests = QUEST_DEF[R.diff] ? JSON.parse(JSON.stringify(QUEST_DEF[R.diff])) : [];
    R.qIndex = 0;
    R.qProg  = { good:0, combo:0, star:0 };
    showCurrentMission();
  }
  function curQ(){ return R.quests[R.qIndex] || null; }
  function showCurrentMission(){
    const q = curQ(); if(!q){ R.hud?.hideMission?.(); return; }
    const label = q.key==='good' ? (R.state.lang==='EN'?'Tap healthy foods':'แตะอาหารดี')
                : q.key==='combo'? (R.state.lang==='EN'?'Hit combo':'ทำคอมโบ')
                : (R.state.lang==='EN'?'Collect stars':'เก็บดาว');
    R.hud?.showMission?.({ icon:q.icon, text:`${label} ${R.qProg[q.key]||0}/${q.need}`, progress:R.qProg[q.key]||0, need:q.need });
  }
  function addStar(n=1){
    R.stars = Math.max(0, Math.min(5, R.stars + n));
    setBadges();
  }

  // ----- Bus to mode -----
  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit(e){
        const pts=e?.points|0;
        if(pts){
          R.sys.score.add(pts);
          R.sys.score.combo=(R.sys.score.combo|0)+1;
          if((R.sys.score.combo|0)>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo|0;
        }
        // Fever ON rule
        if(!R.feverActive && (R.sys.score.combo|0)>=10){ setFever(true); R.feverBreaks=0; }
        if(e?.kind==='good' || e?.kind==='perfect'){ R.qProg.good=(R.qProg.good|0)+1; }
        if(e?.kind==='perfect'){ addStar(1); R.qProg.star=(R.qProg.star|0)+1; }

        // Mission progress
        const q = curQ();
        if(q){
          const v = R.qProg[q.key]|0;
          R.hud?.updateMissionProgress?.(v, q.need);
          R.hud?.showMission?.({ icon:q.icon, text:`${v}/${q.need}`, progress:v, need:q.need });
          if(v>=q.need){
            R.sys.sfx?.quest?.(true);
            R.qIndex++; showCurrentMission();
          }
        }

        R.hud?.setTop?.({ score:R.sys.score.get?.()||0, combo:R.sys.score.combo|0, stars:R.stars });
      },
      miss(){
        // Fever OFF rule: combo breaks count to 3
        if(R.feverActive){
          R.feverBreaks++;
          if(R.feverBreaks>=3){ setFever(false); R.feverBreaks=0; }
        }
        R.sys.score.combo=0;
        R.hud?.setTop?.({ combo:0 });
        R.sys.sfx?.bad?.();
      },
      power(k){
        if(k==='shield'){ /* no-op; game.js grants from mode */ }
      }
    };
  }

  // ----- Loop -----
  function gameTick(){
    if(!R.playing) return;
    const now=performance.now();

    const secGone=Math.floor((now-R._secMark)/1000);
    if(secGone>=1){
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=now;
      R.hud?.setTop?.({ time:R.remain });
      R.sys.sfx?.tick?.();
      if(R.remain===10) R.coach?.onTimeLow?.();
      const elapsed = (R.matchTime - R.remain);
      R.hud?.setStageProgress?.((elapsed / Math.max(1,R.matchTime))*100);
    }

    try {
      const dt=(now-(R._dtMark||now))/1000; R._dtMark=now;
      R.modeAPI?.update?.(dt, busFor());
    } catch(e){ console.warn('[mode.update] error', e); }

    if(R.remain<=0) return endGame(false);
    R.raf=requestAnimationFrame(gameTick);
  }

  // ----- Countdown 3-2-1-Go -----
  async function countdown321(){
    const show = (t)=> R.hud?.say?.(t);
    show('3'); await wait(500);
    show('2'); await wait(500);
    show('1'); await wait(500);
    show('GO!'); await wait(300);
    show('');
  }
  function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

  // ----- End -----
  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    const score = R.sys?.score?.get?.()||0;
    const bestC = R.sys?.score?.bestCombo|0;
    const stars = R.stars|0;

    R.hud?.hideMission?.();
    setFever(false);

    try{ R.coach?.onEnd?.(score); }catch{}
    try{ Progress.endRun({ score, bestCombo:bestC }); }catch{}

    // show menu back
    document.body.removeAttribute('data-playing');
    const mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }

    // result
    try{
      R.hud?.showResult({
        title:'Result',
        desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
        stats:[`Score: ${score}`, `Best Combo: ${bestC}`, `Time: ${R.matchTime|0}s`],
        stars: stars
      });
      R.hud.onHome = ()=>{ R.hud.hideResult(); const m=$('#menuBar'); if(m){ m.style.display='flex'; m.removeAttribute('data-hidden'); } };
      R.hud.onRetry= ()=>{ R.hud.hideResult(); startGame(); };
    }catch{}

    window.HHA._busy=false;
  }

  // ----- Start -----
  async function startGame(){
    if(window.HHA?._busy) return;
    window.HHA._busy=true;

    await loadCore();
    Progress.init?.();

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';
    R.matchTime = getMatchTime(R.modeKey,R.diff);
    R.remain    = R.matchTime|0;

    if(!R.hud) R.hud = new HUDClass();
    R.hud.hideResult?.();
    R.hud.setTop?.({ mode:R.modeKey, diff:R.diff, time:R.remain, score:0, combo:0, stars:R.stars });

    let api;
    try { api = await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy=false; return; }
    R.modeAPI = api;

    // systems
    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();
    R.sys.score.combo=0; R.sys.score.bestCombo=0;
    R.feverActive=false; R.feverBreaks=0; R.stars=0;

    // coach + countdown
    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    await countdown321();
    R.coach.onStart?.();

    // missions
    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    loadMissions();

    // start mode
    R.modeAPI?.start?.({ difficulty:R.diff, time:R.matchTime });
    R.modeAPI?.setFever?.(false);

    // run
    R.playing=true;
    R.startedAt=performance.now();
    R._secMark =performance.now();
    R._dtMark  =performance.now();

    // hide menu
    const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

    requestAnimationFrame(gameTick);
  }

  // ----- Menu & strong start -----
  (function bindMenu(){
    const mb = $('#menuBar'); if(!mb) return;
    function setActive(sel,el){ $$(sel).forEach(b=>b.classList.remove('active')); el.classList.add('active'); }

    mb.addEventListener('click',(ev)=>{
      const t=ev.target.closest('.btn'); if(!t) return;
      if(t.hasAttribute('data-mode')){ ev.preventDefault(); ev.stopPropagation(); document.body.setAttribute('data-mode', t.getAttribute('data-mode')); setActive('[data-mode]',t); setBadges(); return; }
      if(t.hasAttribute('data-diff')){ ev.preventDefault(); ev.stopPropagation(); document.body.setAttribute('data-diff', t.getAttribute('data-diff')); setActive('[data-diff]',t); setBadges(); return; }
      if(t.dataset.action==='howto'){ ev.preventDefault(); ev.stopPropagation(); toast('แตะของดี • เลี่ยงของไม่ดี • คอมโบ ≥10 = FEVER • ⭐/🛡️ คือ Power'); return; }
      if(t.dataset.action==='sound'){ ev.preventDefault(); ev.stopPropagation();
        const now = R.sys?.sfx?.isEnabled?.() ?? true;
        R.sys?.sfx?.setEnabled?.(!now);
        t.textContent = (!now)?'🔊 Sound':'🔇 Sound';
        document.querySelectorAll('audio').forEach(a=>{ try{ a.muted = now; }catch{} });
        toast((!now)?'เสียง: เปิด':'เสียง: ปิด'); return; }
      if(t.dataset.action==='start'){ ev.preventDefault(); ev.stopPropagation(); startGame(); return; }
    }, false);

    const b=$('#btn_start');
    if(b){
      const clone=b.cloneNode(true); b.parentNode.replaceChild(clone,b);
      ['click','pointerup','touchend'].forEach(evName=>{
        clone.addEventListener(evName,(e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); },{capture:true,passive:false});
      });
      clone.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); startGame(); } },{capture:true});
    }
  })();

  function toast(text){
    let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200);
  }

  // Expose
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // keep canvases non-blocking
  setTimeout(()=>{ document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} }); },0);

  // keyboard quick-start
  window.addEventListener('keydown',(e)=>{
    if((e.key==='Enter'||e.key===' ')&&!R.playing){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  },{passive:false});
})();
