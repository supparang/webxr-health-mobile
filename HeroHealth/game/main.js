// === game/main.js — Result summary + Home/Retry + coach visible + stats ===
window.__HHA_BOOT_OK = 'main';
(function(){
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  let ScoreSystem, SFXClass, CoachClass, HUDClass;

  async function loadCore(){
    try{ ({ScoreSystem}=await import('./core/score.js')); }
    catch{ ScoreSystem=class{constructor(){this.value=0;this.combo=0;this.bestCombo=0;}add(n=0){this.value+=n;}get(){return this.value|0;}reset(){this.value=0;this.combo=0;this.bestCombo=0;}}; }
    try{ ({SFX:SFXClass}=await import('./core/sfx.js')); }
    catch{ SFXClass=class{good(){} bad(){} perfect(){} power(){} tick(){}}; }
    try{ ({HUD:HUDClass}=await import('./core/hud.js')); }
    catch{ HUDClass=class{ constructor(){this.root=document.getElementById('hud')||document.body;} setTop(){} setFever(){} setStars(){} setQuest(){} say(){} showResult(){} hideResult(){}}; }
    try{ ({Coach:CoachClass}=await import('./core/coach.js')); }
    catch{ CoachClass=class{ constructor(){this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase();} onStart(){hud.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!');} onGood(){hud.say(this.lang==='EN'?'+Nice!':'+ดีมาก!');} onPerfect(){hud.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!');} onBad(){hud.say(this.lang==='EN'?'Watch out!':'ระวัง!');} onTimeLow(){hud.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!');} onEnd(s){hud.say((s|0)>=200?(this.lang==='EN'?'Awesome!':'สุดยอด!'):(this.lang==='EN'?'Nice!':'ดีมาก!'));} }; }
  }

  const MODE_PATH=(k)=>`./modes/${k}.js`;
  async function loadMode(key){ const mod=await import(MODE_PATH(key)); return mod; }

  const TIME_BY_MODE={ goodjunk:45, groups:60, hydration:50, plate:55 };
  function matchTime(mode,diff){ const b=TIME_BY_MODE[mode]??45; if(diff==='Easy')return b+5; if(diff==='Hard')return Math.max(20,b-5); return b; }

  // --- quests (แสดงทีละข้อ) ---
  const QUESTS=[
    {key:'good10',icon:'🥦',th:'เก็บของดี 10 ชิ้น',en:'Hit 10 good items',need:10},
    {key:'perfect5',icon:'🌟',th:'Perfect 5 ครั้ง',en:'Get 5 PERFECT',need:5, meta:'perfect'},
    {key:'score800',icon:'💯',th:'ทำคะแนนถึง 800',en:'Reach 800 score',need:800, byScore:true},
    {key:'combo10',icon:'⚡',th:'ต่อคอมโบ 10 ครั้ง',en:'Chain combo ×10',need:10, byCombo:true},
    {key:'gold3',icon:'⭐',th:'ดาวทอง 3',en:'3 golden hits',need:3, meta:'golden'},
    {key:'streak15',icon:'🔥',th:'ต่อเนื่อง 15',en:'15 in a row',need:15, byStreak:true},
    {key:'shield1',icon:'🛡️',th:'ใช้ชิลด์ 1 ครั้ง',en:'Use shield once',need:1, byShield:true},
    {key:'time20',icon:'⏱️',th:'ผ่านเวลา 20 วิ',en:'Survive 20s',need:20, byTime:true},
    {key:'good20',icon:'🍏',th:'เก็บของดี 20 ชิ้น',en:'Hit 20 good',need:20},
    {key:'perfectChain3',icon:'✨',th:'PERFECT ติด 3',en:'3 PERFECT chain',need:3, byPerfectChain:true},
  ];

  let R={ mode:'goodjunk', diff:'Normal', playing:false, remain:45, raf:0,
          sys:{score:null,sfx:null}, coach:null, modeAPI:null,
          missChain:0, fever:false, stars:0,
          // stats summary
          stats:{ good:0, perfect:0, miss:0, shields:0, feverSec:0, questsDone:0 }
        };
  let hud=null;
  let qIndex=0,qProg=0,perfectChain=0,streak=0;

  function shuffleInPlace(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } }

  function syncHUD(){
    hud.setTop({ mode:R.mode, diff:R.diff, time:R.remain, score:R.sys.score.get?.()||0, combo:R.sys.score.combo|0 });
    hud.setFever(R.fever);
    hud.setStars(R.stars);
    const lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase();
    const Q=QUESTS[qIndex];
    if (Q){
      const label= lang==='EN'? Q.en : Q.th;
      const have = Q.byScore? (R.sys.score.get?.()||0) : (Q.byTime? (R._elapsedSec|0) : qProg);
      hud.setQuest({ icon:Q.icon, text:label, have, need:Q.need });
    }
  }
  function nextQuest(){
    qIndex=(qIndex+1)%QUESTS.length; qProg=0; perfectChain=0; streak=0;
    const lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase();
    const Q=QUESTS[qIndex]; hud.setQuest({ icon:Q.icon, text:(lang==='EN'?Q.en:Q.th), have:0, need:Q.need });
    hud.say(lang==='EN'?'New mission!':'ภารกิจใหม่!');
  }
  function completeQuest(){
    R.stars=Math.min(5,R.stars+1);
    R.sys.score.add(200);
    R.stats.questsDone++;
    R.sys.sfx.power?.();
    const lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase();
    hud.say(lang==='EN'?'MISSION COMPLETE! +200':'ภารกิจสำเร็จ! +200');
    setTimeout(nextQuest, 800);
    syncHUD();
  }

  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit(e){
        const pts=e?.points|0;
        if(pts) R.sys.score.add(pts);
        R.sys.score.combo=(R.sys.score.combo|0)+1;
        if(R.sys.score.combo>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo;
        R.missChain=0;
        if (!R.fever && R.sys.score.combo>=10){ R.fever=true; R.sys.sfx.power?.(); try{ R.modeAPI.setFever?.(true);}catch{} }
        if(e?.kind==='perfect'){ R.stats.perfect++; } else { R.stats.good++; }
        // quest
        const Q=QUESTS[qIndex];
        if (Q){
          if (Q.byScore){
            // by score handled in syncHUD
          } else if (Q.byCombo){
            if (R.sys.score.combo>=Q.need) qProg=Q.need;
          } else if (Q.byStreak){
            streak++; if(streak>=Q.need) qProg=Q.need;
          } else if (Q.byPerfectChain){
            if (e?.kind==='perfect'){ perfectChain++; if(perfectChain>=Q.need) qProg=Q.need; } else { perfectChain=0; }
          } else {
            if (e?.kind==='perfect' && Q.meta==='perfect'){ qProg++; }
            else if (Q.meta==='golden' && e?.kind==='perfect'){ qProg++; } // golden mapped as perfect glyph
            else if (!Q.meta && (e?.kind==='good'||e?.kind==='perfect')){ qProg++; }
          }
          if (!Q.byScore && !Q.byTime && qProg>=Q.need) completeQuest();
        }
        if (e?.ui){ hud.popScore(`+${pts}${R.fever?' ⚡':''}`, e.ui.x, e.ui.y); }
        if (e?.kind==='perfect') R.coach?.onPerfect?.(); else R.coach?.onGood?.();
        syncHUD();
      },
      miss(){
        if (R.sys.score.combo>0) R.sys.score.combo=0;
        R.missChain=(R.missChain|0)+1;
        R.stats.miss++;
        streak=0; perfectChain=0;
        hud.flashMiss(); R.coach?.onBad?.();
        if (R.fever && R.missChain>=3){ R.fever=false; try{ R.modeAPI.setFever?.(false);}catch{} }
        syncHUD();
      },
      power(kind){
        if(kind==='shield'){ R.stats.shields++; const Q=QUESTS[qIndex]; if(Q?.byShield){ qProg=Math.min(Q.need,qProg+1); if(qProg>=Q.need) completeQuest(); } }
        syncHUD();
      }
    };
  }

  function tick(){
    if(!R.playing) return;
    const now=performance.now();
    const dsec=Math.floor((now-(R._secMark||now))/1000);
    if(dsec>=1){
      R._secMark=now;
      R._elapsedSec=(R._elapsedSec||0)+dsec;
      R.remain=Math.max(0,R.remain-dsec);
      if(R.fever) R.stats.feverSec += dsec;
      const Q=QUESTS[qIndex];
      if (Q?.byTime){ qProg=Math.min(Q.need,(R._elapsedSec|0)); if(qProg>=Q.need) completeQuest(); }
      if (R.remain===10) R.coach?.onTimeLow?.();
      R.sys.sfx.tick?.();
      syncHUD();
    }
    try{
      if(typeof R.modeAPI?.update==='function'){
        const dt=(now-(R._dtMark||now))/1000; R._dtMark=now;
        R.modeAPI.update(dt, busFor());
      }
    }catch(e){ console.warn('[mode.update]', e); }
    if(R.remain<=0) return endGame();
    R.raf=requestAnimationFrame(tick);
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    const score=R.sys.score.get?.()||0;
    const bestC=R.sys.score.bestCombo|0;

    // ให้ Result modal โผล่ทับเมนู (เมนูยัง hidden) แล้วค่อยกด Home เพื่อกลับเมนู
    const statsList=[
      `Score: ${score}`,
      `Best Combo: ${bestC}`,
      `Stars: ${R.stars}/5`,
      `Good: ${R.stats.good} • Perfect: ${R.stats.perfect}`,
      `Miss: ${R.stats.miss} • Shield: ${R.stats.shields}`,
      `Fever: ${R.stats.feverSec}s`,
      `Quests: ${R.stats.questsDone}/10`
    ];
    try{
      hud.showResult({
        title:'Result',
        desc:`Mode: ${R.mode} • Diff: ${R.diff}`,
        stats: statsList
      });
      hud.onHome = ()=>{ hud.hideResult(); document.body.removeAttribute('data-playing'); $('#menuBar')?.removeAttribute('data-hidden'); };
      hud.onRetry= ()=>{ hud.hideResult(); start(); };
    }catch{}
    R.coach?.onEnd?.(score);
    window.HHA._busy=false;
  }

  async function start(){
    if(window.HHA?._busy) return; window.HHA._busy=true;
    await loadCore();

    R.mode = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff = document.body.getAttribute('data-diff') || 'Normal';
    R.remain = matchTime(R.mode,R.diff);
    R._elapsedSec=0; R.missChain=0; R.fever=false; R.stars=0;
    R.stats = { good:0, perfect:0, miss:0, shields:0, feverSec:0, questsDone:0 };

    if(!hud) hud=new HUDClass();
    hud.hideResult?.();
    R.sys.score=new (ScoreSystem||function(){})(); R.sys.score.reset?.();
    R.sys.sfx  =new (SFXClass||function(){})();
    R.coach    =new (CoachClass||function(){})();
    R.coach.onStart?.(); // โค้ชโชว์ "Ready? Go!"

    let api; try{ api=await loadMode(R.mode); }catch(e){ console.error('[mode]',e); toast(`Failed to load mode: ${R.mode}`); window.HHA._busy=false; return; }
    R.modeAPI=api; api.start?.({difficulty:R.diff}); api.setFever?.(false);

    shuffleInPlace(QUESTS); qIndex=0; qProg=0; perfectChain=0; streak=0;
    const lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase();
    const Q=QUESTS[qIndex]; hud.setQuest({ icon:Q.icon, text:(lang==='EN'?Q.en:Q.th), have:0, need:Q.need });

    hud.setStars(0); hud.setTop({ mode:R.mode, diff:R.diff, time:R.remain, score:0, combo:0 });
    document.body.setAttribute('data-playing','1'); $('#menuBar')?.setAttribute('data-hidden','1');
    R._secMark=performance.now(); R._dtMark=performance.now();
    R.playing=true; R.raf=requestAnimationFrame(tick);
  }

  function toast(t){ let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el);} el.textContent=t; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200); }

  // menu bindings
  (function bindMenu(){
    const mb=$('#menuBar'); if(!mb) return;
    function setActive(sel,el){ $$(sel).forEach(b=>b.classList.remove('active')); el.classList.add('active'); }
    mb.addEventListener('click',(ev)=>{
      const t=ev.target.closest('.btn'); if(!t) return;
      if(t.hasAttribute('data-mode')){ document.body.setAttribute('data-mode',t.getAttribute('data-mode')); setActive('[data-mode]',t); return; }
      if(t.hasAttribute('data-diff')){ document.body.setAttribute('data-diff',t.getAttribute('data-diff')); setActive('[data-diff]',t); return; }
      if(t.dataset.action==='howto'){ toast('แตะของดี เลี่ยงของไม่ดี • Fever คอมโบ ≥ 10'); return; }
      if(t.dataset.action==='sound'){ const toMute=!Array.from(document.querySelectorAll('audio')).some(a=>!a.muted); document.querySelectorAll('audio').forEach(a=>{ try{a.muted=toMute;}catch{} }); t.textContent=toMute?'🔇 Sound':'🔊 Sound'; return; }
      if(t.dataset.action==='start'){ start(); }
    },false);

    const b=document.getElementById('btn_start');
    if(b){ const c=b.cloneNode(true); b.replaceWith(c); ['click','pointerup','touchend'].forEach(evt=>c.addEventListener(evt,(e)=>{ e.preventDefault(); e.stopPropagation(); start(); },{capture:true})); }
  })();

  window.HHA=window.HHA||{}; window.HHA.startGame=()=>start(); window.HHA.endGame=()=>endGame();
  setTimeout(()=>{ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);
})();
