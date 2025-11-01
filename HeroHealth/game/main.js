// === Hero Health Academy — game/main.js (r3: Countdown 3-2-1-Go + Coach + Junk Penalty) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, Leaderboard, HUDClass;

  async function loadCore(){
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch {
      ScoreSystem = class { constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n=0){this.value+=n|0;} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} };
    }
    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class { constructor(){this._on=true;} setEnabled(v){this._on=!!v;} isEnabled(){return !!this._on;} play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }
    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { bindToMain(){return{refresh(){}}}, beginRun(){}, endRun(){return null;}, event(){}, tick(){} }; }
    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }
    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} }; }

    // Coach (fallback ปลอดพัง)
    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = class {
        constructor(opts={}){ this.lang=(localStorage.getItem('hha_lang')||opts.lang||'TH').toUpperCase(); this._ensure(); }
        _ensure(){
          this.box = $('#coachBox');
          if(!this.box){
            this.box = document.createElement('div');
            this.box.id='coachBox';
            this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:none;display:none;z-index:2003';
            document.body.appendChild(this.box);
          }
        }
        say(t){ if(!this.box) return; this.box.textContent=t||''; this.box.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>{this.box.style.display='none';},1400); }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวังของไม่ดี!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }

    try { ({ Leaderboard } = await import('./core/leaderboard.js')); }
    catch { Leaderboard = class { submit(){} renderInto(){} getInfo(){return{text:'-'};} }; }

    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch {
      HUDClass = class {
        constructor(){
          this.root = $('#hud') || Object.assign(document.createElement('div'),{id:'hud'});
          if(!$('#hud')){ this.root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2000;'; document.body.appendChild(this.root); }
          const fb = $('#hudTop'); if(fb) fb.style.display='none';

          // top mini
          this.top = document.createElement('div');
          this.top.style.cssText='position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
          this.top.innerHTML = `
            <div style="display:flex;gap:8px;align-items:center">
              <span id="hudMode"  class="hud-b">—</span>
              <span id="hudDiff"  class="hud-b">—</span>
              <span id="hudTime"  class="hud-b" style="min-width:64px;text-align:center">—</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="hud-b">Score: <b id="hudScore">0</b></span>
              <span class="hud-b">Combo: <b id="hudCombo">0</b></span>
            </div>`;
          this.root.appendChild(this.top);
          this.top.querySelectorAll('.hud-b').forEach(el=>{
            el.style.padding='4px 8px'; el.style.borderRadius='10px'; el.style.background='#0b2544'; el.style.color='#cbe7ff'; el.style.border='1px solid #15406e';
          });

          this.$mode=this.top.querySelector('#hudMode'); this.$diff=this.top.querySelector('#hudDiff');
          this.$time=this.top.querySelector('#hudTime'); this.$score=this.top.querySelector('#hudScore'); this.$combo=this.top.querySelector('#hudCombo');

          // quest chip (เดี่ยว)
          this.chips = Object.assign(document.createElement('div'),{id:'questChips'});
          this.chips.style.cssText='position:absolute;left:12px;bottom:78px;display:flex;flex-wrap:wrap;gap:6px;max-width:90vw;pointer-events:none';
          this.root.appendChild(this.chips);

          // countdown overlay
          this.count = document.createElement('div');
          this.count.id='countOverlay';
          this.count.style.cssText='position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:none;background:transparent;z-index:2004';
          this.count.innerHTML = `<div id="countNum" style="font:900 80px/1 ui-rounded;color:#e6f5ff;text-shadow:0 8px 30px rgba(0,0,0,.6)">3</div>`;
          this.root.appendChild(this.count);

          // result
          this.result = document.createElement('div');
          this.result.id='resultModal';
          this.result.style.cssText='position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto;z-index:2002';
          this.result.innerHTML = `
            <div style="width:min(520px,92vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff">
              <h3 id="resTitle" style="margin:0 0 6px;font:900 20px ui-rounded">Result</h3>
              <p  id="resDesc"  style="margin:0 0 10px;color:#cfe7ff">—</p>
              <div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>
              <div style="display:flex;gap:8px;justify-content:flex-end">
                <button id="resHome"  class="btnx">🏠 Home</button>
                <button id="resRetry" class="btnx">↻ Retry</button>
              </div>
            </div>`;
          this.root.appendChild(this.result);
          this.$resTitle=this.result.querySelector('#resTitle'); this.$resDesc=this.result.querySelector('#resDesc'); this.$resStats=this.result.querySelector('#resStats');
          this.onHome=null; this.onRetry=null;
          this.result.querySelector('#resHome').onclick = ()=>this.onHome?.();
          this.result.querySelector('#resRetry').onclick= ()=>this.onRetry?.();
          this.result.querySelectorAll('.btnx').forEach(b=>{ b.style.padding='8px 10px'; b.style.borderRadius='10px'; b.style.background='#123054'; b.style.color='#dff2ff'; b.style.border='1px solid #1e4d83'; b.style.cursor='pointer'; });
        }
        setTop({mode,diff,time,score,combo}){ if(mode!=null)this.$mode.textContent=String(mode); if(diff!=null)this.$diff.textContent=String(diff); if(time!=null)this.$time.textContent=String(time)+'s'; if(score!=null)this.$score.textContent=String(score|0); if(combo!=null)this.$combo.textContent=String(combo|0); }
        setQuestChips(list=[]){
          const frag=document.createDocumentFragment();
          for(const m of list){
            const pct=m.need>0?Math.min(100,Math.round((m.progress/m.need)*100)):0;
            const d=document.createElement('div');
            d.style.cssText='pointer-events:auto;display:inline-flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;border:1px solid #16325d;background:#0d1a31;color:#e6f2ff';
            d.innerHTML=`<span style="font-size:16px">${m.icon||'⭐'}</span>
              <span style="font:700 12.5px ui-rounded">${m.label||m.key}</span>
              <span style="font:700 12px;color:#a7f3d0;margin-left:6px">${m.progress||0}/${m.need||0}</span>
              <i style="height:6px;width:100px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;display:inline-block;margin-left:6px">
                <b style="display:block;height:100%;width:${pct}%;background:${m.done?(m.fail?'#ef4444':'#22c55e'):'#22d3ee'}"></b>
              </i>`;
            frag.appendChild(d);
          }
          this.chips.innerHTML=''; this.chips.appendChild(frag);
        }
        showResult({title='Result',desc='—',stats=[]}){ this.$resTitle.textContent=title; this.$resDesc.textContent=desc; const frag=document.createDocumentFragment(); for(const s of stats){ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38'; b.textContent=s; frag.appendChild(b);} this.$resStats.innerHTML=''; this.$resStats.appendChild(frag); this.result.style.display='flex'; }
        hideResult(){ this.result.style.display='none'; }
        async countdown(ms=3000, onStep=()=>{}){
          this.count.style.display='flex';
          const el=this.count.querySelector('#countNum');
          const steps=[{t:'3'},{t:'2'},{t:'1'},{t:'GO!'}];
          const dt=Math.floor(ms/steps.length);
          for(let i=0;i<steps.length;i++){
            el.textContent=steps[i].t;
            el.style.transform='scale(1)'; el.style.opacity='1';
            onStep(steps[i].t);
            await new Promise(r=>setTimeout(r, dt-80));
            el.style.transition='transform .08s ease, opacity .08s ease'; el.style.transform='scale(0.86)'; el.style.opacity='0.6';
            await new Promise(r=>setTimeout(r, 80));
          }
          this.count.style.display='none';
        }
      };
    }
  }

  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return { name:mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null, cleanup:mod.cleanup||null };
  }

  const FX = {
    popText(txt,{x,y,ms=700}={}) {
      const el=document.createElement('div');
      el.textContent=txt;
      el.style.cssText=`position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:2100;opacity:1;transition:all .72s ease-out;`;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.top=(y-36)+'px'; el.style.opacity='0'; });
      setTimeout(()=>el.remove(),ms);
    }
  };

  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode='goodjunk', diff='Normal'){
    const base = TIME_BY_MODE[mode] ?? 45;
    if (diff==='Easy') return base + 5;
    if (diff==='Hard') return Math.max(20, base - 5);
    return base;
  }

  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null,
    matchTime:45,
    feverActive:false, feverBreaks:0,
    questSnapshot:null
  };
  let hud=null;

  function setBadges(){
    hud?.setTop?.({ mode:R.modeKey, diff:R.diff, time:R.remain, score:R.sys?.score?.get?.()||0, combo:R.sys?.score?.combo|0 });
  }

  function screenShake(){
    const b=document.body;
    b.style.transition='transform .08s';
    b.style.transform='translate(-6px,0)';
    setTimeout(()=>{ b.style.transform='translate(6px,0)'; setTimeout(()=>{ b.style.transform='translate(0,0)'; },80); },80);
  }

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
        if(!R.feverActive && (R.sys.score.combo|0)>=10){ R.feverActive=true; R.feverBreaks=0; try{Quests.event('fever',{on:true});}catch{}; window.dispatchEvent(new CustomEvent('hha:fever',{detail:{on:true}})); }
        if(e?.ui) FX.popText(`+${pts}`,e.ui);
        try{ Quests.event('hit',{result:e?.kind||'good',meta:e?.meta||{},points:pts,comboNow:R.sys.score.combo|0}); }catch{}
        setBadges();
        R.coach?.onGood?.();
      },
      // ✅ โทษเมื่อกดของ junk เท่านั้น (โหมดจะส่ง miss เฉพาะ junk)
      miss(info={}){
        // -50 คะแนน (ต่ำสุด 0), reset combo, shake, โค้ชเตือน
        const before=R.sys.score.get?.()||0;
        const after=Math.max(0, before-50);
        if(after!==before){
          const ui=info.ui||null;
          if(ui) FX.popText(`-50`, {x:ui.x, y:ui.y});
          R.sys.score.value = after|0;
        }
        R.sys.score.combo=0;
        screenShake();
        try{ R.sys.sfx?.bad?.(); }catch{}
        try{ Quests.event('miss',info||{}); }catch{}
        setBadges();
        R.coach?.onBad?.();
        // Fever breaks
        if(R.feverActive){
          R.feverBreaks++; if(R.feverBreaks>=3){ R.feverActive=false; R.feverBreaks=0; try{Quests.event('fever',{on:false});}catch{}; window.dispatchEvent(new CustomEvent('hha:fever',{detail:{on:false}})); }
        }
      },
      power(k){ try{ Quests.event('power',{kind:k}); }catch{} }
    };
  }

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
      try{ Quests.tick({ score:(R.sys.score.get?.()||0), dt:secGone, fever:R.feverActive }); }catch{}
    }

    try{
      const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
      if(typeof R.modeAPI?.update==='function'){ R.modeAPI.update(dt,busFor()); }
      else if(R.modeInst?.update){ R.modeInst.update(dt,busFor()); }
      else if(R.modeAPI?.tick){ R.modeAPI.tick(R.state||{}, R.sys, hud||{}); }
    }catch(e){ console.warn('[mode.update] error',e); }

    if(R.remain<=0) return endGame(false);
    R.raf=requestAnimationFrame(gameTick);
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    const score=R.sys?.score?.get?.()||0;
    const bestC=R.sys?.score?.bestCombo|0;

    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state,hud); }catch{}
    try{ R.questSnapshot = (typeof Quests.endRun==='function') ? Quests.endRun({ score }) : null; }catch{ R.questSnapshot=null; }
    try{ R.coach?.onEnd?.(score); }catch{}
    try{ Progress.endRun({ score, bestCombo:bestC }); }catch{}

    document.body.removeAttribute('data-playing');
    const mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }

    try{
      hud.showResult({
        title:'Result',
        desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
        stats:[`Score: ${score}`, `Best Combo: ${bestC}`, `Time: ${R.matchTime|0}s`, (R.questSnapshot&&R.questSnapshot.totalDone!=null)?`Quests: ${R.questSnapshot.totalDone}`:''].filter(Boolean)
      });
      hud.onHome = ()=>{ hud.hideResult(); const m=$('#menuBar'); if(m){ m.removeAttribute('data-hidden'); m.style.display='flex'; } };
      hud.onRetry= ()=>{ hud.hideResult(); startGame(); };
    }catch{}

    window.HHA._busy=false;
  }

  async function startGame(){
    if(window.HHA?._busy) return; window.HHA._busy=true;

    await loadCore(); Progress.init?.();

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';
    R.matchTime = getMatchTime(R.modeKey,R.diff);
    R.remain    = R.matchTime|0;

    if(!hud) hud = new HUDClass();
    const fb = $('#hudTop'); if(fb) fb.style.display='none';
    hud.hideResult?.(); hud.setTop?.({ mode:R.modeKey, diff:R.diff, time:R.remain, score:0, combo:0 });

    // wire quest/fever chip
    wireHudRuntime(hud);

    // load mode
    let api;
    try { api = await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy=false; return; }
    R.modeAPI = api;

    // systems
    R.sys.score = new (ScoreSystem||function(){})(); R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})(); R.sys.score.combo=0; R.sys.score.bestCombo=0;
    R.feverActive=false; R.feverBreaks=0; R.questSnapshot=null;

    // coach
    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });

    // quests
    try { Quests.bindToMain({ hud, coach:R.coach }); }catch{}
    try { Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime); }catch{}

    // init mode instance (ยังไม่เริ่มนับเวลา จนกว่าจะ GO)
    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    if(api.create){ R.modeInst = api.create({ engine:{fx:FX}, hud, coach:R.coach }); R.modeInst.start?.({ time:R.matchTime }); }
    else if(api.init){ api.init(R.state, hud, { time:R.matchTime, life:1600 }); }

    // hide menu
    const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

    // ✅ Countdown 3-2-1-Go (โค้ชพูด + ติ๊ก SFX)
    await hud.countdown(2800, (step)=>{
      try{ R.sys.sfx?.tick?.(); }catch{}
      if(step==='GO!'||step==='Go!'){ R.coach?.onStart?.(); }
    });

    // start loopหลัง GO
    R.playing=true;
    R.startedAt=performance.now(); R._secMark=performance.now(); R._dtMark=performance.now();
    setBadges(); requestAnimationFrame(gameTick);
  }

  function wireHudRuntime(h){
    const mission = { key:'', label:'', progress:0, need:0, icon:'⭐' };
    const onMission = (e)=>{ Object.assign(mission, e.detail||{}); h.setQuestChips([mission]); };
    const onFever   = (e)=>{ const on = !!(e.detail&&e.detail.on); mission.icon = on ? '🔥' : '⭐'; h.setQuestChips([mission]); };
    window.removeEventListener('hha:mission', onMission);
    window.removeEventListener('hha:fever',   onFever);
    window.addEventListener('hha:mission', onMission);
    window.addEventListener('hha:fever',   onFever);
  }

  (function bindMenu(){
    const mb=$('#menuBar'); if(!mb) return;
    function setActive(sel,el){ $$(sel).forEach(b=>b.classList.remove('active')); el.classList.add('active'); }

    mb.addEventListener('click',(ev)=>{
      const t=ev.target.closest('.btn'); if(!t) return;
      if(t.hasAttribute('data-mode')){ ev.preventDefault(); ev.stopPropagation(); document.body.setAttribute('data-mode', t.getAttribute('data-mode')); setActive('[data-mode]',t); return; }
      if(t.hasAttribute('data-diff')){ ev.preventDefault(); ev.stopPropagation(); document.body.setAttribute('data-diff', t.getAttribute('data-diff')); setActive('[data-diff]',t); return; }
      if(t.dataset.action==='howto'){ ev.preventDefault(); ev.stopPropagation(); toast('แตะของดี • เลี่ยงของไม่ดี • คอมโบ ≥10 = FEVER • ⭐/🛡️ คือ Power'); return; }
      if(t.dataset.action==='sound'){ ev.preventDefault(); ev.stopPropagation(); const now=(R.sys?.sfx?.isEnabled?.() ?? true); R.sys?.sfx?.setEnabled?.(!now); t.textContent=(!now)?'🔊 Sound':'🔇 Sound'; document.querySelectorAll('audio').forEach(a=>{ try{ a.muted = now; }catch{} }); toast((!now)?'เสียง: เปิด':'เสียง: ปิด'); return; }
      if(t.dataset.action==='start'){ ev.preventDefault(); ev.stopPropagation(); startGame(); return; }
    }, false);

    const b=$('#btn_start');
    if(b){
      const clone=b.cloneNode(true); b.parentNode.replaceChild(clone,b);
      ['click','pointerup','touchend'].forEach(evName=>{ clone.addEventListener(evName,(e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); },{capture:true,passive:false}); });
      clone.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); startGame(); } },{capture:true});
    }
  })();

  function toast(text){ let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); } el.textContent=text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200); }

  window.HHA=window.HHA||{}; window.HHA.startGame=startGame; window.HHA.endGame=endGame;
  setTimeout(()=>{ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);
  window.addEventListener('keydown',(e)=>{ if((e.key==='Enter'||e.key===' ')&&!(document.body.getAttribute('data-playing')==='1')){ const menuVisible=!$('#menuBar')?.hasAttribute('data-hidden'); if(menuVisible){ e.preventDefault(); startGame(); } } },{passive:false});
})();
