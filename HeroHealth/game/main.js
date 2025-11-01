// === Hero Health Academy — game/main.js (HUD forced + quests + fever + menu hide) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  let ScoreSystem, SFXClass, Quests, Progress, CoachClass, HUDClass;

  async function loadCore() {
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0;this.combo=0;this.bestCombo=0;this.fever={charge:0,active:false,timeLeft:0};} reset(){this.value=0;this.combo=0;this.bestCombo=0;this.fever={charge:0,active:false,timeLeft:0};} add(n=0,{kind='good'}={}){this.value+=n|0;if(n>0){this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.fever.charge=Math.min(100,this.fever.charge+(kind==='perfect'?15:8));}else{this.combo=0;}} tick(dt){if(this.fever.active){this.fever.timeLeft-=dt;if(this.fever.timeLeft<=0){this.fever.active=false;this.fever.timeLeft=0;}}} tryActivateFever(){if(this.fever.active||this.fever.charge<100)return false;this.fever.active=true;this.fever.timeLeft=7;this.fever.charge=0;return true;} get(){return this.value|0;} }; }

    try { ({ HUD } = await import('./core/hud.js')); HUDClass = HUD; }
    catch { // hard fallback HUD that still renders
      HUDClass = class{
        constructor(){ this.root=document.getElementById('hud')||Object.assign(document.createElement('div'),{id:'hud'}); if(!document.getElementById('hud')){ this.root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:10020;'; document.body.appendChild(this.root);} this.root.innerHTML=''; const t=document.createElement('div'); t.style.cssText='position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none'; t.innerHTML=`<span class="hud-b" id="hudMode">—</span><span class="hud-b" id="hudDiff">—</span><span class="hud-b" id="hudTime">0s</span><span class="hud-b">Score: <b id="hudScore">0</b></span><span class="hud-b">Combo: <b id="hudCombo">0</b></span><span class="hud-b" style="padding:0"><i style="display:block;width:160px;height:12px;border-radius:10px;overflow:hidden;background:#051226;border:1px solid #134064"><b id="feverFill" style="display:block;height:100%;width:0%"></b></i></span>`; this.root.appendChild(t); this.$mode=t.querySelector('#hudMode'); this.$diff=t.querySelector('#hudDiff'); this.$time=t.querySelector('#hudTime'); this.$score=t.querySelector('#hudScore'); this.$combo=t.querySelector('#hudCombo'); this.$fever=t.querySelector('#feverFill'); this.chipsWrap=document.createElement('div'); this.chipsWrap.style.cssText='position:absolute;left:12px;bottom:78px;display:flex;gap:6px;pointer-events:none;z-index:10025'; this.root.appendChild(this.chipsWrap); this.result=document.createElement('div'); this.result.id='resultModal'; this.result.style.cssText='position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);pointer-events:auto;z-index:10030'; this.result.innerHTML=`<div style="background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff"><h3 id="resTitle">Result</h3><p id="resDesc">—</p><div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button id="resHome">🏠 Home</button><button id="resRetry">↻ Retry</button></div></div>`; this.root.appendChild(this.result); this.$resTitle=this.result.querySelector('#resTitle'); this.$resDesc=this.result.querySelector('#resDesc'); this.$resStats=this.result.querySelector('#resStats'); this.onHome=null; this.onRetry=null; this.result.querySelector('#resHome').onclick=()=>this.onHome?.(); this.result.querySelector('#resRetry').onclick=()=>this.onRetry?.(); }
        setTop(o={}){ const{s=String}=Object; if(o.mode!=null)this.$mode.textContent=s(o.mode); if(o.diff!=null)this.$diff.textContent=s(o.diff); if(o.time!=null)this.$time.textContent=s(o.time)+'s'; if(o.score!=null)this.$score.textContent=String(o.score|0); if(o.combo!=null)this.$combo.textContent=String(o.combo|0); if(o.feverPct!=null){ this.$fever.style.width=Math.max(0,Math.min(100,o.feverPct|0))+'%'; this.$fever.style.background=o.feverOn?'#fb923c':'#22d3ee'; } }
        setQuestChips(list=[]){ const frag=document.createDocumentFragment(); for(const m of list){ const d=document.createElement('div'); d.style.cssText='pointer-events:auto;display:inline-flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;border:1px solid #16325d;background:#0d1a31;color:#e6f2ff'; const pct=m.need>0?Math.min(100,Math.round((m.progress/m.need)*100)):(m.done&&!m.fail?100:0); d.innerHTML=`<span style="font-size:16px">${m.icon||'⭐'}</span><span style="font:700 12.5px ui-rounded">${m.label||m.key}</span><span style="font:700 12px;color:#a7f3d0;margin-left:6px">${m.progress||0}/${m.need||0}</span><i style="height:6px;width:100px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;display:inline-block;margin-left:6px"><b style="display:block;height:100%;width:${pct}%;background:${m.done?(m.fail?'#ef4444':'#22c55e'):'#22d3ee'}"></b></i>`; frag.appendChild(d);} this.chipsWrap.innerHTML=''; this.chipsWrap.appendChild(frag); }
        say(txt=''){ if(!txt){ return; } let el=document.getElementById('coachBubble'); if(!el){ el=document.createElement('div'); el.id='coachBubble'; el.style.cssText='position:absolute;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;z-index:10025'; this.root.appendChild(el);} el.textContent=txt; el.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>{ el.style.display='none'; },1500); }
        showResult({title='Result',desc='—',stats=[]}){ this.$resTitle.textContent=title; this.$resDesc.textContent=desc; const frag=document.createDocumentFragment(); for(const s of stats){ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38'; b.textContent=s; frag.appendChild(b);} this.$resStats.innerHTML=''; this.$resStats.appendChild(frag); this.result.style.display='flex'; }
        hideResult(){ this.result.style.display='none'; }
      };
    }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { bindToMain(){return{refresh(){}}}, beginRun(){}, event(){}, tick(){}, endRun(){return[]} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch { CoachClass = class{ constructor(){this.lang='TH'} onStart(){} onEnd(){}}; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ isEnabled(){return true} setEnabled(){} good(){} bad(){} perfect(){} power(){} }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){} }; }
  }

  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key){ return await import(MODE_PATH(key)); }

  // ---------- Engine state ----------
  let R={ playing:false, startedAt:0, remain:45, raf:0, _dtMark:0, _secMark:0,
          sys:{score:null,sfx:null}, hud:null, coach:null,
          modeKey:'goodjunk', diff:'Normal', modeAPI:null, modeInst:null, _matchTime:45 };

  function setHUD(){
    R.hud?.setTop?.({
      mode:R.modeKey, diff:R.diff, time:R.remain|0,
      score:R.sys.score?.get?.()||0, combo:R.sys.score?.combo|0,
      feverPct:R.sys.score?.fever?.charge|0, feverOn:!!R.sys.score?.fever?.active
    });
  }

  function busFor(){
    return {
      hit(e){
        const kind=e?.kind||'good';
        const base=(kind==='bad')?-5:(kind==='perfect'?15:10);
        const feverBonus=R.sys.score?.fever?.active?10:0;
        const pts=(e?.points!=null?e.points:base)+feverBonus;
        R.sys.score.add(pts,{kind});
        Quests.event('hit',{result:kind,meta:e?.meta||{},comboNow:R.sys.score.combo|0});
        if(R.sys.score.tryActivateFever?.()){ document.body.classList.add('fever-on'); R.coach?.onFever?.(); setTimeout(()=>document.body.classList.remove('fever-on'),200); }
        setHUD();
      },
      miss(){ R.sys.score.add(0,{kind:'bad'}); Quests.event('hit',{result:'bad',meta:{},comboNow:R.sys.score.combo|0}); setHUD(); }
    };
  }
  window.__HHA_BUS = null; // ให้โหมดเรียกใช้ได้ (บางโค้ดอ้างถึง)

  function gameTick(){
    if(!R.playing) return;
    const now=performance.now();
    const dt=(now-(R._dtMark||now))/1000; R._dtMark=now;

    // second countdown
    const gone=Math.floor((now-(R._secMark||now))/1000);
    if(gone>=1){
      R.remain=Math.max(0,(R.remain|0)-gone);
      R._secMark=now;
      if(R.remain===10) R.coach?.onTimeLow?.();
      Quests.tick({score:R.sys.score.get?.()||0});
    }

    // fever timer
    R.sys.score.tick?.(dt);

    // mode update
    try{
      if(R.modeInst?.update) R.modeInst.update(dt,busFor());
      else if(R.modeAPI?.update) R.modeAPI.update(dt,busFor());
      else if(R.modeAPI?.tick)   R.modeAPI.tick(R.state||{},R.sys,R.hud||{});
    }catch(e){ console.warn('[mode.update] error', e); }

    setHUD();

    if(R.remain<=0){ endGame(); return; }
    R.raf=requestAnimationFrame(gameTick);
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    const score=R.sys.score?.get?.()||0;
    const bestC=R.sys.score?.bestCombo|0;

    try{ Quests.endRun?.({score}); }catch{}
    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state,R.hud); }catch{}

    document.body.removeAttribute('data-playing');
    const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','0'); mb.style.display=''; }

    R.coach?.onEnd?.(score);
    Progress.endRun?.({score,bestCombo:bestC});

    R.hud?.showResult?.({
      title:'Result',
      desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
      stats:[`Score: ${score}`, `Best Combo: ${bestC}`, `Time: ${R._matchTime|0}s`]
    });
    R.hud.onHome = ()=>{ R.hud.hideResult(); const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','0'); mb.style.display=''; } };
    R.hud.onRetry= ()=>{ R.hud.hideResult(); startGame(); };

    window.HHA._busy=false;
  }

  const TIME_BY_MODE={ goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode='goodjunk', diff='Normal'){
    const base=TIME_BY_MODE[mode]??45;
    if(diff==='Easy') return base+5;
    if(diff==='Hard') return Math.max(20,base-5);
    return base;
  }

  async function startGame(){
    if(window.HHA?._busy) return;
    window.HHA._busy=true;

    await loadCore();

    // HUD (การันตีมีเสมอ)
    if(!R.hud){ R.hud=new HUDClass(); }
    window.__HHA_HUD_API = R.hud; // ให้ coach ใช้ say()

    // อ่านโหมด/ระดับจากเมนู
    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';
    R._matchTime = getMatchTime(R.modeKey, R.diff);
    R.remain = R._matchTime|0;

    // systems
    R.sys.score=new ScoreSystem(); R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();

    // coach
    R.coach = new CoachClass({ lang: (localStorage.getItem('hha_lang')||'TH') });
    R.coach.onStart?.();

    // quests
    Quests.bindToMain({ hud: R.hud, coach: R.coach });
    Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH').toUpperCase(), R._matchTime);

    // load mode
    let api; try{ api=await loadMode(R.modeKey); }catch(e){ console.error('[mode load]',e); toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy=false; return; }
    R.modeAPI = api; R.modeInst=null;
    if(api.create){ R.modeInst=api.create({ hud:R.hud, coach:R.coach }); R.modeInst.start?.({ time:R._matchTime }); }
    else if(api.init){ api.init({ difficulty:R.diff }, R.hud, { time:R._matchTime, life:1500 }); }

    setHUD();

    // ซ่อนเมนูแบบ hard
    const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

    R.playing=true; R.startedAt=performance.now(); R._secMark=performance.now(); R._dtMark=performance.now();
    requestAnimationFrame(gameTick);
  }

  function toast(text){ let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el);} el.textContent=text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200); }

  // menu delegation
  (function bindMenuDelegation(){
    const mb=$('#menuBar'); if(!mb) return;
    function setActive(sel,el){ $$(sel).forEach(b=>b.classList.remove('active')); el.classList.add('active'); }
    mb.addEventListener('click',(ev)=>{
      const t=ev.target.closest('.btn'); if(!t) return;
      if(t.hasAttribute('data-mode')){ setActive('[data-mode]',t); document.body.setAttribute('data-mode', t.getAttribute('data-mode')); return; }
      if(t.hasAttribute('data-diff')){ setActive('[data-diff]',t); document.body.setAttribute('data-diff', t.getAttribute('data-diff')); return; }
      if(t.dataset.action==='howto'){ toast('แตะของดี เลี่ยงของไม่ดี • ทำ Mini-Quest ทีละอัน • เกจเต็ม = FEVER'); return; }
      if(t.dataset.action==='sound'){ const A=[...document.querySelectorAll('audio')]; const anyOn=A.some(a=>!a.muted); A.forEach(a=>{ try{ a.muted=anyOn; }catch{} }); t.textContent=anyOn?'🔇 Sound':'🔊 Sound'; toast(anyOn?'เสียง: ปิด':'เสียง: เปิด'); return; }
      if(t.dataset.action==='start'){ ev.preventDefault(); startGame(); return; }
    }, false);
    mb.addEventListener('pointerup', e=>{ const t=e.target.closest('.btn[data-action="start"]'); if(t){ e.preventDefault(); startGame(); } }, {passive:false});
  })();

  // Expose
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;

  // Keyboard start
  window.addEventListener('keydown',(e)=>{
    if((e.key==='Enter'||e.key===' ') && !R.playing){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  },{passive:false});
})();
