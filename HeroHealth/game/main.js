'use strict';
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  // --------- Safe stubs ----------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, Leaderboard, HUDClass;

  async function loadCore(){
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch {
      ScoreSystem = class { constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n=0){this.value+=n|0;} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} };
    }
    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class { constructor(){this._on=true;} setEnabled(v){this._on=!!v;} isEnabled(){return!!this._on;} play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }
    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { bindToMain(){return{refresh(){}}}, beginRun(){}, endRun(){return null;}, event(){}, tick(){} }; }
    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }
    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} }; }
    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = class {
        constructor(opts={}){ this.lang=(localStorage.getItem('hha_lang')||opts.lang||'TH').toUpperCase(); this._ensure(); }
        _ensure(){ this.box=$('#coachBox'); if(!this.box){ this.box=document.createElement('div'); this.box.id='coachBox'; this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001'; document.body.appendChild(this.box);} }
        say(t){ this.box.textContent=t||''; this.box.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>{this.box.style.display='none';},1400); }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
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
          if(!$('#hud')) document.body.appendChild(this.root);
          // top
          const top = document.createElement('div');
          top.style.cssText='position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
          top.innerHTML = `
            <div style="display:flex;gap:8px;align-items:center">
              <span id="hudMode"  style="padding:4px 8px;border-radius:10px;background:#0b2544;color:#cbe7ff;border:1px solid #15406e;pointer-events:auto">—</span>
              <span id="hudDiff"  style="padding:4px 8px;border-radius:10px;background:#102b52;color:#e6f5ff;border:1px solid #1b4b8a;pointer-events:auto">—</span>
              <span id="hudTime"  style="padding:4px 8px;border-radius:10px;background:#0a1f3d;color:#c9e7ff;border:1px solid #123863;min-width:64px;text-align:center;pointer-events:auto">—</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#bbf7d0;border:1px solid #134064;pointer-events:auto">Score: <b id="hudScore">0</b></span>
              <span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#fde68a;border:1px solid #134064;pointer-events:auto">Combo: <b id="hudCombo">0</b></span>
            </div>`;
          this.root.appendChild(top);
          this.$mode=top.querySelector('#hudMode'); this.$diff=top.querySelector('#hudDiff');
          this.$time=top.querySelector('#hudTime'); this.$score=top.querySelector('#hudScore'); this.$combo=top.querySelector('#hudCombo');

          // chips
          const chips = document.createElement('div'); chips.id='questChips';
          chips.style.cssText='position:absolute;left:12px;bottom:78px;display:flex;flex-wrap:wrap;gap:6px;max-width:90vw;pointer-events:none';
          this.root.appendChild(chips); this.chips = chips;

          // result
          const res = document.createElement('div'); res.id='resultModal';
          res.style.cssText='position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto;';
          res.innerHTML = `
            <div style="width:min(520px,92vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff">
              <h3 id="resTitle" style="margin:0 0 6px;font:900 20px ui-rounded">Result</h3>
              <p  id="resDesc"  style="margin:0 0 10px;color:#cfe7ff">—</p>
              <div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>
              <div style="display:flex;gap:8px;justify-content:flex-end">
                <button id="resHome"  style="padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer">🏠 Home</button>
                <button id="resRetry" style="padding:8px 10px;border-radius:10px;background:#123054;color:#dff2ff;border:1px solid #1e4d83;cursor:pointer">↻ Retry</button>
              </div>
            </div>`;
          this.root.appendChild(res);
          this.$resTitle=res.querySelector('#resTitle'); this.$resDesc=res.querySelector('#resDesc'); this.$resStats=res.querySelector('#resStats');
          this.onHome=null; this.onRetry=null; res.querySelector('#resHome').onclick=()=>this.onHome?.(); res.querySelector('#resRetry').onclick=()=>this.onRetry?.();
          this.result = res;
        }
        setTop({mode,diff,time,score,combo}){ if(mode!=null)this.$mode.textContent=mode; if(diff!=null)this.$diff.textContent=diff; if(time!=null)this.$time.textContent=String(time)+'s'; if(score!=null)this.$score.textContent=String(score|0); if(combo!=null)this.$combo.textContent=String(combo|0); }
        setQuestChips(list=[]){ const frag=document.createDocumentFragment(); for(const m of list){ const d=document.createElement('div'); d.style.cssText='pointer-events:auto;display:inline-flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;border:1px solid #16325d;background:#0d1a31;color:#e6f2ff'; const pct=m.need>0?Math.min(100,Math.round((m.progress/m.need)*100)):0; d.innerHTML=`<span style="font-size:16px">${m.icon||'⭐'}</span><span style="font:700 12.5px ui-rounded">${m.label||m.key}</span><span style="font:700 12px;color:#a7f3d0;margin-left:6px">${m.progress||0}/${m.need||0}</span><i style="height:6px;width:100px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;display:inline-block;margin-left:6px"><b style="display:block;height:100%;width:${pct}%;background:${m.done?(m.fail?'#ef4444':'#22c55e'):'#22d3ee'}"></b></i>`; frag.appendChild(d);} this.chips.innerHTML=''; this.chips.appendChild(frag); }
        say(t=''){ let box=$('#coachBox'); if(!box){ box=document.createElement('div'); box.id='coachBox'; box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001'; document.body.appendChild(box);} box.textContent=t; box.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>{box.style.display='none';},1600); }
        showResult({title='Result',desc='—',stats=[]}){ this.$resTitle.textContent=title; this.$resDesc.textContent=desc; const frag=document.createDocumentFragment(); for(const s of stats){ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38'; b.textContent=s; frag.appendChild(b); } this.$resStats.innerHTML=''; this.$resStats.appendChild(frag); this.result.style.display='flex'; }
        hideResult(){ this.result.style.display='none'; }
      };
    }
  }

  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return { name:mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null, cleanup:mod.cleanup||null };
  }

  const FX = {
    popText(txt,{x,y,ms=700}={}){ const el=document.createElement('div'); el.textContent=txt; el.style.cssText=`position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:97;opacity:1;transition:all .72s ease-out;`; document.body.appendChild(el); requestAnimationFrame(()=>{ el.style.top=(y-36)+'px'; el.style.opacity='0';}); setTimeout(()=>el.remove(),ms); }
  };

  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode='goodjunk', diff='Normal'){ const base = TIME_BY_MODE[mode] ?? 45; if (diff==='Easy') return base+5; if (diff==='Hard') return Math.max(20, base-5); return base; }

  let R = { playing:false, startedAt:0, remain:45, raf:0, sys:{score:null,sfx:null}, modeKey:'goodjunk', diff:'Normal', modeAPI:null, modeInst:null, state:null, coach:null, matchTime:45, feverActive:false, feverBreaks:0 };
  let hud=null;

  function setBadges(){ hud?.setTop?.({ mode:R.modeKey, diff:R.diff, time:R.remain, score:R.sys?.score?.get?.()||0, combo:R.sys?.score?.combo|0 }); }

  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit(e){ const pts=e?.points|0; if(pts){ R.sys.score.add(pts); R.sys.score.combo=(R.sys.score.combo|0)+1; if((R.sys.score.combo|0)>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo|0; } if(!R.feverActive && (R.sys.score.combo|0)>=10){ R.feverActive=true; R.feverBreaks=0; try{Quests.event('fever',{on:true});}catch{} } if(e?.ui) FX.popText(`+${pts}`,e.ui); try{ Quests.event('hit',{result:e?.kind||'good',meta:e?.meta||{},points:pts,comboNow:R.sys.score.combo|0}); }catch{} setBadges(); },
      miss(info={}){ if(R.feverActive){ R.feverBreaks++; if(R.feverBreaks>=3){ R.feverActive=false; R.feverBreaks=0; try{Quests.event('fever',{on:false});}catch{} } } R.sys.score.combo=0; try{ Quests.event('miss',info||{}); }catch{} setBadges(); },
      power(k){ try{ Quests.event('power',{kind:k}); }catch{} }
    };
  }

  function gameTick(){
    if(!R.playing) return;
    const tNow=performance.now();
    const secGone=Math.floor((tNow-R._secMark)/1000);
    if(secGone>=1){ R.remain=Math.max(0,(R.remain|0)-secGone); R._secMark=tNow; setBadges(); if(R.remain===10) R.coach?.onTimeLow?.(); try{ Quests.tick({ score:(R.sys.score.get?.()||0), dt:secGone, fever:R.feverActive }); }catch{} }
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
    try{ Quests.endRun({ score }); }catch{}
    try{ R.coach?.onEnd?.(score); }catch{}
    try{ Progress.endRun({ score, bestCombo:bestC }); }catch{}

    document.body.removeAttribute('data-playing');

    const desc = `Mode: ${R.modeKey} • Diff: ${R.diff}`;
    const stats = [`Score: ${score}`, `Best Combo: ${bestC}`, `Time: ${R.matchTime|0}s`];

    if (hud && typeof hud.showResult === 'function'){
      try{
        hud.showResult({ title:'Result', desc, stats });
        hud.onHome = ()=>{
          hud.hideResult();
          const mb = document.getElementById('menuBar');
          if (mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }
        };
        hud.onRetry = ()=>{
          hud.hideResult();
          startGame();
        };
      }catch(e){ console.warn('[hud.showResult]', e); showResultFallback(desc, stats); }
    }else{
      showResultFallback(desc, stats);
    }
    window.HHA._busy=false;
  }

  function showResultFallback(desc, stats){
    let wrap = document.getElementById('hhaFallbackResult');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'hhaFallbackResult';
      wrap.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:20050';
      wrap.innerHTML = `
        <div style="width:min(520px,92vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff">
          <h3 style="margin:0 0 6px;font:900 20px ui-rounded">Result</h3>
          <p id="hhaFRDesc" style="margin:0 0 10px;color:#cfe7ff"></p>
          <div id="hhaFRStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button id="hhaFRHome"  style="padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer">🏠 Home</button>
            <button id="hhaFRRetry" style="padding:8px 10px;border-radius:10px;background:#123054;color:#dff2ff;border:1px solid #1e4d83;cursor:pointer">↻ Retry</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      wrap.querySelector('#hhaFRHome').onclick = ()=>{
        wrap.remove();
        const mb = document.getElementById('menuBar');
        if (mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }
      };
      wrap.querySelector('#hhaFRRetry').onclick = ()=>{
        wrap.remove(); startGame();
      };
    }
    wrap.querySelector('#hhaFRDesc').textContent = desc || '';
    const host = wrap.querySelector('#hhaFRStats'); host.innerHTML='';
    (stats||[]).forEach(s=>{ const b=document.createElement('div'); b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38'; b.textContent=s; host.appendChild(b); });
    wrap.style.display='flex';
  }

  async function startGame(){
    if(window.HHA?._busy) return;
    window.HHA._busy=true;

    await loadCore();
    Progress.init?.();

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';

    R.matchTime = getMatchTime(R.modeKey,R.diff);
    R.remain    = R.matchTime|0;

    if(!hud) hud = new HUDClass();
    hud.hideResult?.();
    hud.setTop?.({ mode:R.modeKey, diff:R.diff, time:R.remain, score:0, combo:0 });

    let api;
    try { api = await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy=false; return; }
    R.modeAPI = api;

    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();
    R.sys.score.combo=0; R.sys.score.bestCombo=0;
    R.feverActive=false; R.feverBreaks=0;

    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    R.coach.onStart();

    try { Quests.bindToMain({ hud, coach:R.coach }); }catch{}
    try { Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime); }catch{}

    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    if(api.create){ R.modeInst = api.create({ engine:{fx:FX}, hud, coach:R.coach }); R.modeInst.start?.({ time:R.matchTime }); }
    else if(api.init){ api.init(R.state, hud, { time:R.matchTime, life:1600 }); }

    R.playing=true;
    R.startedAt=performance.now();
    R._secMark =performance.now();
    R._dtMark  =performance.now();
    setBadges();

    const mb = $('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    document.body.setAttribute('data-playing','1');

    requestAnimationFrame(gameTick);
  }

  function toast(text){ let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); } el.textContent=text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200); }

  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  setTimeout(()=>{ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);
  window.addEventListener('keydown',(e)=>{ if((e.key==='Enter'||e.key===' ')&&!R.playing){ const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden'); if(menuVisible){ e.preventDefault(); startGame(); } } },{passive:false});
})();
