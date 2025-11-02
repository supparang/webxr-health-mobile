// === Hero Health Academy — game/main.js (production-ready) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function () {
  // ---------- DOM helpers ----------
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  // ---------- Safe stubs (replaced when imports succeed) ----------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, Leaderboard, HUDClass;

  async function loadCore(){
    try { ({ ScoreSystem } = await import('../core/score.js')); }
    catch {
      ScoreSystem = class {
        constructor(){ this.value=0; this.combo=0; this.bestCombo=0; }
        add(n=0){ this.value += (n|0); }
        get(){ return this.value|0; }
        reset(){ this.value=0; this.combo=0; this.bestCombo=0; }
      };
    }

    try { ({ SFX: SFXClass } = await import('../core/sfx.js')); }
    catch {
      SFXClass = class {
        constructor(){ this._on=true; }
        setEnabled(v){ this._on=!!v; }
        isEnabled(){ return !!this._on; }
        play(){} tick(){} good(){} bad(){} perfect(){} power(){}
      };
    }

    try { ({ Quests } = await import('../core/quests.js')); }
    catch {
      Quests = {
        bindToMain(){ return { refresh:function(){} }; },
        beginRun(){}, endRun(){ return { summary:['(no quests)'], totalDone:0 }; },
        event(){}, tick(){}
      };
    }

    try { ({ Progress } = await import('../core/progression.js')); }
    catch {
      Progress = {
        init(){}, beginRun(){}, endRun(){}, emit(){},
        getStatSnapshot(){return {};}, profile(){return {};}
      };
    }

    try { ({ VRInput } = await import('../core/vrinput.js')); }
    catch {
      VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} };
    }

    try { ({ Coach: CoachClass } = await import('../core/coach.js')); }
    catch {
      CoachClass = class {
        constructor({lang='TH'}={}){ this.lang=(lang||'TH').toUpperCase(); }
        say(t){ const api=window.__HHA_HUD_API; if(api?.say) api.say(t); }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onJunk(){ this.say(this.lang==='EN'?'No junk!':'อย่าแตะของขยะ!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onFever(){ this.say(this.lang==='EN'?'FEVER TIME!':'โหมดไฟลุก!'); }
        onPause(){ this.say(this.lang==='EN'?'Paused':'พัก'); }
        onResume(){ this.say(this.lang==='EN'?'Resume':'ลุยต่อ'); }
        onEnd(score){ this.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }

    try { ({ Leaderboard } = await import('../core/leaderboard.js')); }
    catch { Leaderboard = class { submit(){} renderInto(){} getInfo(){return{text:'-'};} }; }

    try { ({ HUD: HUDClass } = await import('../core/hud.js')); }
    catch {
      HUDClass = class {
        constructor(){
          this.root = $('#hud') || Object.assign(document.createElement('div'),{id:'hud'});
          if(!$('#hud')){ this.root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2000'; document.body.appendChild(this.root); }
          const top=document.createElement('div');
          top.style.cssText='position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
          top.innerHTML = '<div><span id="hudMode" style="padding:4px 8px;border-radius:10px;background:#0b2544;color:#cbe7ff;border:1px solid #15406e;pointer-events:auto">—</span> <span id="hudDiff" style="padding:4px 8px;border-radius:10px;background:#102b52;color:#e6f5ff;border:1px solid #1b4b8a;pointer-events:auto">—</span> <span id="hudTime" style="padding:4px 8px;border-radius:10px;background:#0a1f3d;color:#c9e7ff;border:1px solid #123863;min-width:64px;text-align:center;pointer-events:auto">—</span></div><div><span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#bbf7d0;border:1px solid #134064;pointer-events:auto">Score: <b id="hudScore">0</b></span> <span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#fde68a;border:1px solid #134064;pointer-events:auto">Combo: <b id="hudCombo">0</b></span></div>';
          this.root.appendChild(top);
          this.$mode=top.querySelector('#hudMode'); this.$diff=top.querySelector('#hudDiff');
          this.$time=top.querySelector('#hudTime'); this.$score=top.querySelector('#hudScore'); this.$combo=top.querySelector('#hudCombo');
          // fever bar
          this.powerWrap = $('#powerBarWrap');
          if(!this.powerWrap){
            this.powerWrap=document.createElement('div'); this.powerWrap.id='powerBarWrap';
            this.powerWrap.style.cssText='position:fixed;left:12px;bottom:12px;z-index:18;width:min(380px,92vw);pointer-events:none';
            this.powerWrap.innerHTML='<div id="powerBar" style="position:relative;height:14px;border-radius:999px;background:#0a1931;border:1px solid #0f2a54;overflow:hidden"><div id="powerFill" style="position:absolute;inset:0;width:100%"></div></div>';
            document.body.appendChild(this.powerWrap);
          }
          this.$powerFill=this.powerWrap.querySelector('#powerFill');
          // big number
          this.big=document.createElement('div');
          this.big.style.cssText='position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);font:900 80px ui-rounded,system-ui;color:#fef3c7;text-shadow:0 8px 40px rgba(0,0,0,.6);pointer-events:none;opacity:0;transition:opacity .2s, transform .2s;z-index:2100';
          this.root.appendChild(this.big);
          // result
          this.result=document.createElement('div');
          this.result.id='resultModal';
          this.result.style.cssText='position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto;z-index:2002';
          this.result.innerHTML='<div style="width:min(560px,94vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff"><h3 id="resTitle" style="margin:0 0 6px;font:900 20px ui-rounded">Result</h3><p id="resDesc" style="margin:0 0 10px;color:#cfe7ff;white-space:pre-line">—</p><div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div><div id="resExtra" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button id="resHome" style="padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer">🏠 Home</button><button id="resRetry" style="padding:8px 10px;border-radius:10px;background:#123054;color:#dff2ff;border:1px solid #1e4d83;cursor:pointer">↻ Retry</button></div></div>';
          this.root.appendChild(this.result);
          this.$resTitle=this.result.querySelector('#resTitle'); this.$resDesc=this.result.querySelector('#resDesc');
          this.$resStats=this.result.querySelector('#resStats'); this.$resExtra=this.result.querySelector('#resExtra');
          this.result.querySelector('#resHome').onclick = ()=>this.onHome && this.onHome();
          this.result.querySelector('#resRetry').onclick= ()=>this.onRetry && this.onRetry();
          // minimal API
          window.__HHA_HUD_API = { say: (t)=>{ let b=$('#coachBox'); if(!b){ b=document.createElement('div'); b.id='coachBox'; b.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001'; document.body.appendChild(b);} b.textContent=String(t||''); b.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>{b.style.display='none';},1200); } };
        }
        setTop({mode,diff}={}){ if(mode!=null) this.$mode.textContent=String(mode); if(diff!=null) this.$diff.textContent=String(diff); }
        setTimer(sec){ this.$time.textContent = Math.max(0,Math.round(sec))+'s'; }
        updateHUD(score,combo){ this.$score.textContent=String(score|0); this.$combo.textContent=String(combo|0); }
        showFever(on){ this.$powerFill.innerHTML = on
          ? '<div class="fire" style="position:absolute;left:0;top:0;bottom:0;width:100%;background:radial-gradient(30px 24px at 20% 110%,rgba(255,200,0,.9),rgba(255,130,0,.65)55%,rgba(255,80,0,0)70%),radial-gradient(26px 20px at 45% 110%,rgba(255,210,80,.85),rgba(255,120,0,.55)55%,rgba(255,80,0,0)70%),radial-gradient(34px 26px at 70% 110%,rgba(255,190,40,.9),rgba(255,110,0,.55)55%,rgba(255,80,0,0)70%),linear-gradient(0deg,rgba(255,140,0,.65),rgba(255,100,0,.25));mix-blend-mode:screen;animation:fireRise .9s ease-in-out infinite"></div>'
          : ''; }
        showBig(text){ this.big.textContent=String(text||''); this.big.style.opacity='1'; this.big.style.transform='translate(-50%,-50%) scale(1)'; setTimeout(()=>{ this.big.style.opacity='0'; this.big.style.transform='translate(-50%,-50%) scale(.9)'; }, 350); }
        showResult({title='Result',desc='—',stats=[],extra=[]}={}){ const f1=document.createDocumentFragment(), f2=document.createDocumentFragment(); for(const s of stats){ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38'; b.textContent=String(s); f1.appendChild(b);} for(const s of extra){ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #2a3e6a;background:#0c233f;color:#bfe0ff'; b.textContent=String(s); f2.appendChild(b);} this.$resTitle.textContent=String(title); this.$resDesc.textContent=String(desc); this.$resStats.innerHTML=''; this.$resStats.appendChild(f1); this.$resExtra.innerHTML=''; this.$resExtra.appendChild(f2); this.result.style.display='flex'; }
        hideResult(){ this.result.style.display='none'; }
        toast(text){ let t=$('#toast'); if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; t.style.cssText='position:fixed;left:50%;top:68px;transform:translateX(-50%);background:#0e1930;border:1px solid #214064;color:#e8f3ff;padding:8px 12px;border-radius:10px;opacity:0;transition:opacity .3s;z-index:10040'; document.body.appendChild(t);} t.textContent=String(text); t.style.opacity='1'; setTimeout(()=>{ t.style.opacity='0'; },1200); }
      };
    }
  }

  // ---------- Mode loader ----------
  const MODE_PATH = (k)=>`../modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return {
      name:mod.name||key,
      create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null,
      start:mod.start||null, cleanup:mod.cleanup||null
    };
  }

  // ---------- Engine state ----------
  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode, diff){
    const m = mode || 'goodjunk';
    const d = diff || 'Normal';
    const base = TIME_BY_MODE[m] != null ? TIME_BY_MODE[m] : 45;
    if (d==='Easy') return base + 5;
    if (d==='Hard') return Math.max(20, base - 5);
    return base;
  }

  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null,
    matchTime:45,
    feverActive:false, feverBreaks:0
  };
  let hud=null;

  // ---------- UI sync ----------
  function setBadges(){
    const score = (R.sys?.score?.get?.()||0)|0;
    const combo = (R.sys?.score?.combo|0);
    hud?.setTop?.({ mode:R.modeKey, diff:R.diff });
    hud?.setTimer?.(R.remain|0);
    hud?.updateHUD?.(score, combo);
    const mB=$('#modeBadge'); if(mB) mB.textContent=R.modeKey;
    const dB=$('#diffBadge'); if(dB) dB.textContent=R.diff;
    const sV=$('#scoreVal'); if(sV) sV.textContent=score;
  }

  // ---------- Bus ----------
  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit:function(e){
        const pts=(e && e.points)|0;
        if(pts){
          R.sys.score.add(pts);
          R.sys.score.combo=(R.sys.score.combo|0)+1;
          if((R.sys.score.combo|0)>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo|0;
        }
        // FEVER on
        if(!R.feverActive && (R.sys.score.combo|0)>=10){
          R.feverActive=true; R.feverBreaks=0;
          try{ hud?.showFever?.(true); }catch{}
          try{ Quests.event('fever',{on:true}); }catch{}
          try{ R.coach?.onFever?.(); }catch{}
        }
        // quest event
        try{ Quests.event('hit',{ result:(e && e.kind)?e.kind:'good', meta:(e && e.meta)?e.meta:{}, points:pts, comboNow:R.sys.score.combo|0 }); }catch{}
        // float
        if(e && e.ui){ hud?.showFloatingText?.(e.ui.x|0, e.ui.y|0, '+'+pts); }
        setBadges();
      },
      miss:function(info){
        // FEVER off after 3 breaks
        if(R.feverActive){
          R.feverBreaks++;
          if(R.feverBreaks>=3){
            R.feverActive=false; R.feverBreaks=0;
            try{ hud?.showFever?.(false); }catch{}
            try{ Quests.event('fever',{on:false}); }catch{}
          }
        }
        R.sys.score.combo=0;
        try{ Quests.event('miss', info || {}); }catch{}
        setBadges();
      },
      // คลิก JUNK = bad (ไม่ใช่ miss)
      bad:function(info){
        R.sys.score.combo=0;
        try{ Quests.event('junk', info || {}); }catch{}
        try{ R.coach?.onJunk?.(); }catch{}
        setBadges();
      },
      power:function(k){ try{ Quests.event('power',{kind:k}); }catch{} }
    };
  }

  // ---------- Loop ----------
  function gameTick(){
    if(!R.playing) return;
    const tNow=performance.now();

    const secGone=Math.floor((tNow-R._secMark)/1000);
    if(secGone>=1){
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=tNow;
      hud?.setTimer?.(R.remain|0);
      if(R.remain===10){ hud?.showBig?.('10'); try{ R.coach?.onTimeLow?.(); }catch{} }
      if(R.remain>0 && R.remain<=3){ hud?.showBig?.(String(R.remain)); }
      try{ Quests.tick({ score:(R.sys.score.get ? R.sys.score.get() : 0), dt:secGone, fever:R.feverActive }); }catch{}
    }

    try{
      const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
      if(R.modeAPI && typeof R.modeAPI.update==='function'){ R.modeAPI.update(dt,busFor()); }
      else if(R.modeInst && typeof R.modeInst.update==='function'){ R.modeInst.update(dt,busFor()); }
      else if(R.modeAPI && typeof R.modeAPI.tick==='function'){ R.modeAPI.tick(R.state||{}, R.sys, hud||{}); }
    }catch(e){ console.warn('[mode.update] error',e); }

    if(R.remain<=0) { endGame(); return; }
    R.raf=requestAnimationFrame(gameTick);
  }

  // ---------- End game ----------
  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    const score=(R.sys && R.sys.score && R.sys.score.get)?R.sys.score.get():0;
    const bestC=(R.sys && R.sys.score && R.sys.score.bestCombo)|0;

    try{ if(R.modeInst && R.modeInst.cleanup) R.modeInst.cleanup(); if(R.modeAPI && R.modeAPI.cleanup) R.modeAPI.cleanup(R.state,hud); }catch{}
    let questSummary = [];
    try{
      const res = (typeof Quests.endRun==='function' && Quests.endRun({score})) || null;
      if(res && res.summary) questSummary = res.summary;
      else if (res && res.totalDone!=null) questSummary = [`Quests done: ${res.totalDone}`];
    }catch{}

    try{ if(R.coach && R.coach.onEnd) R.coach.onEnd(score); }catch{}
    try{ Progress.endRun({ score:score, bestCombo:bestC }); }catch{}

    document.body.removeAttribute('data-playing');
    const mb = $('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }

    const stars = score>=900?5 : score>=700?4 : score>=500?3 : score>=300?2 : score>=120?1 : 0;
    hud?.showResult?.({
      title:'Result',
      desc:`Mode: ${R.modeKey} • Diff: ${R.diff}\n⭐ Stars: ${'★'.repeat(stars)}${'☆'.repeat(5-stars)}`,
      stats:[
        `Score: ${score}`,
        `Best Combo: ${bestC}`,
        `Time: ${R.matchTime|0}s`
      ],
      extra: questSummary
    });
    hud.onHome = function(){ hud.hideResult(); const m2=$('#menuBar'); if(m2){ m2.removeAttribute('data-hidden'); m2.style.display='flex'; } };
    hud.onRetry = function(){ hud.hideResult(); startGame(); };

    window.HHA._busy=false;
  }

  // ---------- Start game ----------
  async function startGame(){
    if(window.HHA && window.HHA._busy) return;
    if(!window.HHA) window.HHA = {};
    window.HHA._busy=true;

    await loadCore();
    try{ Progress.init(); }catch{}

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';

    R.matchTime = getMatchTime(R.modeKey,R.diff);
    R.remain    = R.matchTime|0;

    if(!hud) hud = new HUDClass();
    hud.hideResult && hud.hideResult();
    hud.setTop && hud.setTop({ mode:R.modeKey, diff:R.diff });
    hud.setTimer && hud.setTimer(R.remain);
    hud.updateHUD && hud.updateHUD(0,0);

    let api=null;
    try { api = await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); toast('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }
    R.modeAPI = api;

    R.sys.score = new (ScoreSystem||function(){})();
    if(R.sys.score.reset) R.sys.score.reset();
    R.sys.sfx   = new (SFXClass||function(){})();
    R.sys.score.combo=0; R.sys.score.bestCombo=0;
    R.feverActive=false; R.feverBreaks=0;

    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });

    try { Quests.bindToMain({ hud:hud, coach:R.coach }); }catch{}
    try { Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime); }catch{}

    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };

    // Support 3 styles: create() / init() / start()
    if(api && typeof api.create==='function'){
      R.modeInst = api.create({ engine:{}, hud:hud, coach:R.coach });
      if(R.modeInst && typeof R.modeInst.start==='function'){ R.modeInst.start({ time:R.matchTime, difficulty:R.diff }); }
    } else if(api && typeof api.init==='function'){
      api.init(R.state, hud, { time:R.matchTime, life:1600 });
    } else if(api && typeof api.start==='function'){
      api.start({ time:R.matchTime, difficulty:R.diff });
    }

    // 3-2-1-GO (ก่อนเริ่มนับเวลา)
    await (async ()=>{
      const seq=['3','2','1','GO!'];
      for (let i=0;i<seq.length;i++){
        hud?.showBig?.(seq[i]);
        await new Promise(r=>setTimeout(r, i<3 ? 520 : 400));
      }
      R.coach?.onStart?.();
    })();

    // เริ่มเกม
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

  // ---------- Menu delegation + Start strong bind ----------
  (function bindMenu(){
    const mb = $('#menuBar'); if(!mb) return;
    function setActive(sel,el){ $$(sel).forEach((b)=>b.classList.remove('active')); el.classList.add('active'); }
    mb.addEventListener('click',function(ev){
      const t=ev.target.closest('.btn'); if(!t) return;

      if(t.hasAttribute('data-mode')){ ev.preventDefault(); ev.stopPropagation();
        document.body.setAttribute('data-mode', t.getAttribute('data-mode')); setActive('[data-mode]',t); setBadges(); return; }

      if(t.hasAttribute('data-diff')){ ev.preventDefault(); ev.stopPropagation();
        document.body.setAttribute('data-diff', t.getAttribute('data-diff')); setActive('[data-diff]',t); setBadges(); return; }

      if(t.dataset.action==='howto'){ ev.preventDefault(); ev.stopPropagation();
        toast('แตะของดี • เลี่ยงของไม่ดี • คอมโบ ≥10 = FEVER • ⭐/🛡️ คือพาวเวอร์'); return; }

      if(t.dataset.action==='sound'){ ev.preventDefault(); ev.stopPropagation();
        const now = (R.sys && R.sys.sfx && typeof R.sys.sfx.isEnabled==='function') ? R.sys.sfx.isEnabled() : true;
        if(R.sys && R.sys.sfx && typeof R.sys.sfx.setEnabled==='function') R.sys.sfx.setEnabled(!now);
        t.textContent = (!now)?'🔊 Sound':'🔇 Sound';
        document.querySelectorAll('audio').forEach((a)=>{ try{ a.muted = now; }catch(e){}; });
        toast((!now)?'เสียง: เปิด':'เสียง: ปิด'); return;
      }

      if(t.dataset.action==='start'){ ev.preventDefault(); ev.stopPropagation(); startGame(); return; }
    }, false);

    const b = $('#btn_start');
    if(b){
      const clone=b.cloneNode(true);
      b.parentNode.replaceChild(clone,b);
      ['click','pointerup','touchend'].forEach(function(evName){
        clone.addEventListener(evName,function(e){ e.preventDefault(); e.stopPropagation(); startGame(); },{capture:true,passive:false});
      });
      clone.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); startGame(); } },{capture:true});
    }
  })();

  // ---------- Pause/Resume ----------
  window.addEventListener('keydown',(e)=>{
    if(e.key.toLowerCase()==='p'){
      if(R.playing){ R.playing=false; try{ R.coach?.onPause?.(); }catch{}; hud?.toast?.('Paused'); }
      else if(!R.playing && R.remain>0){ R.playing=true; try{ R.coach?.onResume?.(); }catch{}; requestAnimationFrame(gameTick); }
    }
  },{passive:true});

  // ---------- Toast ----------
  function toast(text){
    let el=$('#toast');
    if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); el.style.cssText='position:fixed;left:50%;top:68px;transform:translateX(-50%);background:#0e1930;border:1px solid #214064;color:#e8f3ff;padding:8px 12px;border-radius:10px;opacity:0;transition:opacity .3s;z-index:10040'; }
    el.textContent=String(text);
    el.style.opacity='1';
    setTimeout(()=>{ el.style.opacity='0'; },1200);
  }

  // ---------- Expose ----------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // Canvas never blocks UI
  setTimeout(function(){ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);

  // Keyboard quick start (Enter/Space)
  window.addEventListener('keydown',function(e){
    if((e.key==='Enter'||e.key===' ')&&!R.playing){
      const menuVisible = !($('#menuBar') && $('#menuBar').hasAttribute('data-hidden'));
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  },{passive:false});
})();
