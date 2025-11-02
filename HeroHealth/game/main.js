// === Hero Health Academy — game/main.js (PRODUCTION-HARDENED) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

// ===== Version / cache bust =====
const BUILD_ID = '2025-11-02-p1'; // เปลี่ยนเมื่ออัปไฟล์โหมด/แกน

(function(){
  // ---------- DOM helpers ----------
  const $ = (s)=>document.querySelector(s);
  const $$= (s)=>document.querySelectorAll(s);

  // ---------- Core placeholders (replaced when import ok) ----------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, Leaderboard, HUDClass;

  async function loadCore(){
    // score
    try{ ({ ScoreSystem } = await import('./core/score.js?b='+BUILD_ID)); }
    catch{
      ScoreSystem = class{ constructor(){this.value=0;this.combo=0;this.bestCombo=0;}
        add(n){this.value+=(n|0);} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} };
    }
    // sfx
    try{ ({ SFX: SFXClass } = await import('./core/sfx.js?b='+BUILD_ID)); }
    catch{ SFXClass = class{
      constructor(){this._on=true;} setEnabled(v){this._on=!!v;} isEnabled(){return !!this._on;}
      good(){} bad(){} perfect(){} power(){} bgmFeverStart(){} bgmFeverStop(){} tick(){}
    }; }
    // quests
    try{ ({ Quests } = await import('./core/quests.js?b='+BUILD_ID)); }
    catch{ Quests = {
      bindToMain(){return{refresh(){}}}, beginRun(){}, endRun(){return{totalDone:0,list:[]}},
      event(){}, tick(){}
    }; }
    // progress
    try{ ({ Progress } = await import('./core/progression.js?b='+BUILD_ID)); }
    catch{ Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{}}, profile(){return{}} }; }
    // vrinput
    try{ ({ VRInput } = await import('./core/vrinput.js?b='+BUILD_ID)); }
    catch{ VRInput = { init(){}, toggleVR(){}, isXRActive(){return false}, isGazeMode(){return false} }; }
    // coach
    try{ ({ Coach: CoachClass } = await import('./core/coach.js?b='+BUILD_ID)); }
    catch{ CoachClass = class{
      constructor(o){ this.lang=(localStorage.getItem('hha_lang')||o?.lang||'TH').toUpperCase(); this._ensure(); }
      _ensure(){ this.box=$('#coachBox'); if(!this.box){ this.box=document.createElement('div');
        this.box.id='coachBox'; this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001';
        document.body.appendChild(this.box); } }
      say(t){ if(!this.box) return; this.box.textContent=t||''; this.box.style.display='block';
        clearTimeout(this._to); this._to=setTimeout(()=>{this.box.style.display='none'},1400); }
      onStart(){this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!')}
      onGood(){this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!')}
      onPerfect(){this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!')}
      onBad(){this.say(this.lang==='EN'?'Watch out!':'ระวัง!')}
      onTimeLow(){this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!')}
      onEnd(s){this.say((s|0)>=200?(this.lang==='EN'?'Awesome!':'สุดยอด!'):(this.lang==='EN'?'Nice!':'ดีมาก!'))}
    }; }
    // leaderboard
    try{ ({ Leaderboard } = await import('./core/leaderboard.js?b='+BUILD_ID)); }
    catch{ Leaderboard = class{ submit(){} renderInto(){} getInfo(){return{text:'-'}} }; }
    // hud (fallback)
    try{ ({ HUD: HUDClass } = await import('./core/hud.js?b='+BUILD_ID)); }
    catch{
      HUDClass = class{
        constructor(){
          this.root = $('#hud') || Object.assign(document.createElement('div'),{id:'hud'});
          if(!$('#hud')){ this.root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2000'; document.body.appendChild(this.root); }
          this.top=document.createElement('div');
          this.top.style.cssText='position:absolute;left:12px;right:12px;top:8px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
          this.top.innerHTML =
            '<div style="display:flex;gap:8px;align-items:center">'+
              '<span id="hudMode"  class="pill">goodjunk</span>'+
              '<span id="hudDiff"  class="pill">Normal</span>'+
              '<span id="hudTime"  class="pill" style="min-width:64px;text-align:center">--</span>'+
            '</div>'+
            '<div style="display:flex;gap:8px;align-items:center">'+
              '<span class="pill">Score: <b id="hudScore">0</b></span>'+
              '<span class="pill">Combo: <b id="hudCombo">0</b></span>'+
              '<span class="pill">⭐ <b id="hudStars">0</b></span>'+
            '</div>';
          this.root.appendChild(this.top);
          // pill style
          this.root.querySelectorAll('.pill').forEach(el=>{
            el.style.padding='4px 8px'; el.style.borderRadius='10px';
            el.style.background='#0b1c36'; el.style.color='#e6f2ff'; el.style.border='1px solid #134064'; el.style.pointerEvents='auto';
          });
          this.$mode=this.top.querySelector('#hudMode'); this.$diff=this.top.querySelector('#hudDiff');
          this.$time=this.top.querySelector('#hudTime'); this.$score=this.top.querySelector('#hudScore');
          this.$combo=this.top.querySelector('#hudCombo'); this.$stars=this.top.querySelector('#hudStars');

          this.quest=document.createElement('div');
          this.quest.style.cssText='position:absolute;left:50%;bottom:18px;transform:translateX(-50%);pointer-events:none';
          this.quest.innerHTML='<div id="questFocus" style="display:inline-flex;gap:8px;align-items:center;padding:8px 12px;border-radius:12px;border:1px solid #16325d;background:#0d1a31;color:#e6f2ff;pointer-events:auto;min-width:260px;justify-content:center"></div>';
          this.root.appendChild(this.quest); this.$questFocus=this.quest.querySelector('#questFocus');

          this.result=document.createElement('div');
          this.result.id='resultModal';
          this.result.style.cssText='position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto;z-index:2002';
          this.result.innerHTML='<div style="width:min(540px,92vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff"><h3 id="resTitle" style="margin:0 0 6px;font:900 20px ui-rounded">Result</h3><p id="resDesc" style="margin:0 0 10px;color:#cfe7ff">—</p><div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button id="resHome" class="rbtn">🏠 Home</button><button id="resRetry" class="rbtn">↻ Retry</button></div></div>';
          this.root.appendChild(this.result);
          this.result.querySelectorAll('.rbtn').forEach(b=>{ b.style.padding='8px 10px'; b.style.borderRadius='10px'; b.style.background='#0f1e38'; b.style.color='#e6f2ff'; b.style.border='1px solid #16325d'; b.style.cursor='pointer'; });
          this.$resTitle=this.result.querySelector('#resTitle'); this.$resDesc=this.result.querySelector('#resDesc'); this.$resStats=this.result.querySelector('#resStats');
          this.onHome=null; this.onRetry=null; const self=this;
          this.result.querySelector('#resHome').onclick=()=>self.onHome&&self.onHome();
          this.result.querySelector('#resRetry').onclick=()=>self.onRetry&&self.onRetry();

          // big countdown
          this.big=document.createElement('div'); this.big.id='bigCountdown';
          this.big.style.cssText='position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);font:900 84px ui-rounded;color:#fff;opacity:0;text-shadow:0 6px 30px rgba(0,0,0,.6);pointer-events:none';
          this.root.appendChild(this.big);
        }
        setTop(o){ if(o.mode!=null) this.$mode.textContent=String(o.mode);
          if(o.diff!=null) this.$diff.textContent=String(o.diff);
          if(o.time!=null) this.$time.textContent=String(o.time)+'s';
          if(o.score!=null) this.$score.textContent=String(o.score|0);
          if(o.combo!=null) this.$combo.textContent=String(o.combo|0);
          if(o.stars!=null) this.$stars.textContent=String(o.stars|0);
        }
        setQuestFocus(meta){ this.$questFocus.textContent = meta? ((meta.icon?meta.icon+' ':'')+(meta.label||meta.key||'Quest')+' — '+(meta.progress||0)+'/'+(meta.need||0)) : ''; }
        showResult(o){ this.$resTitle.textContent=String(o?.title||'Result'); this.$resDesc.textContent=String(o?.desc||'—');
          const frag=document.createDocumentFragment(); (Array.isArray(o?.stats)?o.stats:[]).forEach(s=>{
            const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38'; b.textContent=String(s); frag.appendChild(b);
          }); this.$resStats.innerHTML=''; this.$resStats.appendChild(frag); this.result.style.display='flex'; }
        hideResult(){ this.result.style.display='none'; }
        pulseBig(n){ this.big.textContent=String(n); this.big.style.opacity='1'; this.big.style.transform='translate(-50%,-50%) scale(1.0)'; const self=this;
          requestAnimationFrame(()=>{ self.big.style.transition='transform .25s ease, opacity .25s ease'; self.big.style.transform='translate(-50%,-50%) scale(.85)'; self.big.style.opacity='0'; }); }
      };
    }
  }

  // ---------- Mode loader ----------
  const MODE_PATH = (k)=>`./modes/${k}.js?b=${BUILD_ID}`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return { name:mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null, start:mod.start||null, cleanup:mod.cleanup||null, setFever:mod.setFever||null };
  }

  // ---------- FX ----------
  const FX = {
    popText(txt,pos){ const x=(pos&&pos.x)|0, y=(pos&&pos.y)|0;
      const el=document.createElement('div'); el.textContent=String(txt);
      el.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;transform:translate(-50%,-50%);font:900 16px ui-rounded;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:2006;opacity:1;transition:all .72s ease-out;';
      document.body.appendChild(el); requestAnimationFrame(()=>{ el.style.top=(y-36)+'px'; el.style.opacity='0'; }); setTimeout(()=>{ try{el.remove()}catch{} },720);
    }
  };
  function flash(color){ let f=$('#screenFlash'); if(!f){ f=document.createElement('div'); f.id='screenFlash';
      f.style.cssText='position:fixed;inset:0;background:'+ (color||'#7f1d1d') +';opacity:0;pointer-events:none;z-index:2005;transition:opacity .18s ease'; document.body.appendChild(f); }
    f.style.background=color||'#7f1d1d'; f.style.opacity='0.35'; setTimeout(()=>{ f.style.opacity='0'; },120);
  }
  function showMissLabel(){ FX.popText('MISS',{x:innerWidth/2,y:innerHeight/2}); }

  // ---------- Game state ----------
  const TIME_BY_MODE={goodjunk:45,groups:60,hydration:50,plate:55};
  function getMatchTime(mode,diff){ const base=(TIME_BY_MODE[mode||'goodjunk']??45); if(diff==='Easy') return base+5; if(diff==='Hard') return Math.max(20,base-5); return base; }

  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null, stars:0 },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null,
    matchTime:45, feverActive:false, feverBreaks:0, _lastSecond:-1,
    _timeouts:new Set()
  };
  let hud=null;

  function setBadges(){
    hud?.setTop?.({ mode:R.modeKey, diff:R.diff, time:R.remain|0, score:R.sys.score?.get?R.sys.score.get():0, combo:R.sys.score?.combo|0, stars:R.sys.stars|0 });
    $('#modeBadge')&&( $('#modeBadge').textContent=R.modeKey );
    $('#diffBadge')&&( $('#diffBadge').textContent=R.diff );
    $('#scoreVal')&&( $('#scoreVal').textContent= R.sys.score?.get?R.sys.score.get():0 );
  }

  function setFever(on){
    on=!!on; if(on===R.feverActive) return;
    R.feverActive=on;
    if(on){ document.body.setAttribute('data-fever','1'); R.sys.sfx?.bgmFeverStart?.(); R.modeAPI?.setFever?.(true); Quests.event?.('fever',{on:true}); }
    else { document.body.removeAttribute('data-fever'); R.sys.sfx?.bgmFeverStop?.(); R.modeAPI?.setFever?.(false); Quests.event?.('fever',{on:false}); }
  }

  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit(e){
        const pts=(e?.points)|0;
        if(pts){ R.sys.score.add(pts); R.sys.score.combo=(R.sys.score.combo|0)+1; if((R.sys.score.combo|0)>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo|0; }
        if(e?.kind==='perfect' && e?.ui){ FX.popText('PERFECT +'+pts,e.ui); R.coach?.onPerfect?.(); }
        else if(pts && e?.ui){ FX.popText('+'+pts,e.ui); R.coach?.onGood?.(); }
        if(e?.kind==='perfect' && e?.meta?.gold){ R.sys.stars=(R.sys.stars|0)+1; }
        if(!R.feverActive && (R.sys.score.combo|0)>=10){ setFever(true); R.feverBreaks=0; }
        Quests.event?.('hit',{ result:e?.kind||'good', meta:e?.meta||{}, points:pts, comboNow:R.sys.score.combo|0 });
        setBadges();
      },
      miss(info){
        flash('#7f1d1d'); showMissLabel();
        if(R.feverActive){ R.feverBreaks++; if(R.feverBreaks>=3){ setFever(false); R.feverBreaks=0; } }
        R.sys.score.combo=0; Quests.event?.('miss',info||{}); R.coach?.onBad?.(); setBadges();
      },
      power(k){ Quests.event?.('power',{kind:k}); }
    };
  }

  function gameTick(){
    if(!R.playing) return;
    const tNow=performance.now();

    const secGone=Math.floor((tNow-R._secMark)/1000);
    if(secGone>=1){
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=tNow;
      if(R.remain<=10 && R.remain>=1 && R.remain!==R._lastSecond){ hud?.pulseBig?.(R.remain|0); if(R.remain===10) R.coach?.onTimeLow?.(); }
      R._lastSecond=R.remain|0;
      Quests.tick?.({ score:R.sys.score?.get?R.sys.score.get():0, dt:secGone, fever:R.feverActive });
      setBadges();
    }

    try{
      const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
      if(typeof R.modeAPI?.update==='function') R.modeAPI.update(dt,busFor());
      else if(R.modeInst?.update) R.modeInst.update(dt,busFor());
      else if(typeof R.modeAPI?.tick==='function') R.modeAPI.tick(R.state||{}, R.sys, hud||{});
    }catch(e){ console.warn('[mode.update] error',e); }

    if(R.remain<=0){ endGame(); return; }
    R.raf = requestAnimationFrame(gameTick);
  }

  function clearTimers(){ R._timeouts.forEach(id=>clearTimeout(id)); R._timeouts.clear(); }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf); clearTimers(); setFever(false);

    const score=R.sys.score?.get?R.sys.score.get():0;
    const bestC=R.sys.score?.bestCombo|0;

    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state,hud); }catch{}
    let res=null; try{ res = Quests.endRun?.({score}) || null; }catch{}
    try{ R.coach?.onEnd?.(score); }catch{}
    try{ Progress.endRun?.({ score, bestCombo:bestC }); }catch{}

    document.body.removeAttribute('data-playing');
    const mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }

    hud?.showResult?.({
      title:'Result',
      desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
      stats:[
        `Score: ${score}`, `Best Combo: ${bestC}`, `Time: ${R.matchTime|0}s`, `⭐ Stars: ${R.sys.stars|0}`,
        res && res.totalDone!=null ? `Quests Done: ${res.totalDone}` : ''
      ].filter(Boolean)
    });
    hud.onHome=()=>{ hud.hideResult?.(); const m2=$('#menuBar'); if(m2){ m2.removeAttribute('data-hidden'); m2.style.display='flex'; } };
    hud.onRetry=()=>{ hud.hideResult?.(); startGame(); };

    window.HHA._busy=false;
  }

  async function startGame(){
    if(window.HHA?._busy) return; window.HHA = window.HHA||{}; window.HHA._busy=true;

    await loadCore(); Progress.init?.();

    R.modeKey=document.body.getAttribute('data-mode')||'goodjunk';
    R.diff   =document.body.getAttribute('data-diff')||'Normal';
    R.matchTime=getMatchTime(R.modeKey,R.diff); R.remain=R.matchTime|0;

    if(!hud) hud=new HUDClass(); hud.hideResult?.(); hud.setTop?.({mode:R.modeKey,diff:R.diff,time:R.remain,score:0,combo:0,stars:0});

    let api=null; try{ api=await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] load mode fail',e); toast('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }
    R.modeAPI=api;

    R.sys.score=new (ScoreSystem||function(){})(); R.sys.score.reset?.();
    R.sys.sfx=new (SFXClass||function(){})(); R.sys.stars=0;
    R.feverActive=false; R.feverBreaks=0;

    R.coach=new CoachClass({lang:(localStorage.getItem('hha_lang')||'TH')}); R.coach?.onStart?.();
    Quests.bindToMain?.({hud,coach:R.coach});
    Quests.beginRun?.(R.modeKey,R.diff,(localStorage.getItem('hha_lang')||'TH'),R.matchTime);

    R.state={difficulty:R.diff,lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(),ctx:{}};

    if(typeof api.create==='function'){ R.modeInst=api.create({engine:{fx:FX},hud,coach:R.coach}); R.modeInst?.start?.({time:R.matchTime,difficulty:R.diff}); }
    else if(typeof api.init==='function'){ api.init(R.state,hud,{time:R.matchTime,life:1600}); }
    else if(typeof api.start==='function'){ api.start({time:R.matchTime,difficulty:R.diff}); }

    R.playing=true; R.startedAt=performance.now(); R._secMark=performance.now(); R._dtMark=performance.now(); R._lastSecond=-1;
    const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    document.body.setAttribute('data-playing','1');

    // Audio unlock (iOS)
    try{
      const a = $('#bgm-main'); a && a.play && a.play().then(()=>a.pause()).catch(()=>{});
      ['sfx-good','sfx-bad','sfx-perfect','sfx-tick','sfx-powerup'].forEach(id=>{
        const s = document.getElementById(id); s && s.play && s.play().then(()=>s.pause()).catch(()=>{});
      });
    }catch{}

    requestAnimationFrame(gameTick);
  }

  // Pause/Resume on visibility
  document.addEventListener('visibilitychange', ()=>{
    if(!R.playing) return;
    if(document.hidden){ cancelAnimationFrame(R.raf); setFever(false); }
    else{ R._secMark=performance.now(); R._dtMark=performance.now(); requestAnimationFrame(gameTick); }
  });

  // Menu & hotkeys remain same
  (function bindMenu(){
    const mb=$('#menuBar'); if(!mb) return;
    function setActive(sel,el){ $$(sel).forEach(b=>b.classList.remove('active')); el.classList.add('active'); }
    mb.addEventListener('click',(ev)=>{
      const t=ev.target.closest('.btn'); if(!t) return;
      if(t.hasAttribute('data-mode')){ ev.preventDefault(); document.body.setAttribute('data-mode',t.getAttribute('data-mode')); setActive('[data-mode]',t); setBadges(); return; }
      if(t.hasAttribute('data-diff')){ ev.preventDefault(); document.body.setAttribute('data-diff',t.getAttribute('data-diff')); setActive('[data-diff]',t); setBadges(); return; }
      if(t.dataset.action==='howto'){ ev.preventDefault(); toast('แตะของดี • เลี่ยงของไม่ดี • คอมโบ ≥10 = FEVER • ⭐/🛡️'); return; }
      if(t.dataset.action==='sound'){ ev.preventDefault();
        const now = R.sys?.sfx?.isEnabled?.() ?? true; R.sys?.sfx?.setEnabled?.(!now);
        t.textContent = (!now)?'🔊 Sound':'🔇 Sound';
        document.querySelectorAll('audio').forEach(a=>{ try{ a.muted = now; }catch{} });
        toast((!now)?'เสียง: เปิด':'เสียง: ปิด'); return;
      }
      if(t.dataset.action==='start'){ ev.preventDefault(); startGame(); }
    }, false);

    const b=$('#btn_start'); if(b){
      const clone=b.cloneNode(true); b.parentNode.replaceChild(clone,b);
      ['click','pointerup','touchend'].forEach(evName=>clone.addEventListener(evName,(e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); },{capture:true,passive:false}));
      clone.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); startGame(); } },{capture:true});
    }
  })();

  function toast(text){ let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=String(text); el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200); }

  // Expose
  window.HHA = window.HHA || {}; window.HHA.startGame=startGame; window.HHA.endGame=endGame;

  // canvases never block
  setTimeout(()=>{ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);

  window.addEventListener('keydown',(e)=>{ if((e.key==='Enter'||e.key===' ')&&!R.playing){ const mv=!$('#menuBar')?.hasAttribute('data-hidden'); if(mv){ e.preventDefault(); startGame(); } } },{passive:false});
})();
