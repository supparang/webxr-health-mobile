// === Hero Health Academy — game/main.js (2025-11-01 FINAL: menu-wired + timer + coach + quests win) ===
window.__HHA_BOOT_OK = 'main-vFinal';

(function () {
  const $  = (s) => document.querySelector(s);

  /* ---------- Safe imports with fallbacks ---------- */
  let ScoreSystem, SFXClass, Quests, Progress, CoachClass;

  async function loadCore() {
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0; this.combo=0; this.bestCombo=0;} add(n=0){ this.value+=n; this.combo++; this.bestCombo=Math.max(this.bestCombo,this.combo);} get(){return this.value|0;} reset(){this.value=0; this.combo=0; this.bestCombo=0;} addKind(k){ this.add(10);} getGrade(){return{score:this.get(),stars:0,grade:'C'}}}; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ setEnabled(){} isEnabled(){return true} unlock(){} play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { // lite stub: 3 pseudo-missions, win when score>=320
      Quests = (()=>{ let RUN=null; return {
        bindToMain(){ return { refresh(){} }; },
        beginRun(mode,diff,lang,sec){ RUN={remain:sec|0,list:[{id:'q1',need:1,prog:0,done:false,fail:false,label:'Score ≥ 320'},{id:'q2',need:1,prog:0,done:false,fail:false,label:'Keep combo x10'},{id:'q3',need:1,prog:0,done:false,fail:false,label:'Hit 10 goods'}]}; },
        tick(ctx){ if(!RUN) return RUN?.list; const s=ctx?.score|0; if(s>=320) RUN.list[0].done=true; return RUN.list; },
        event(type,p){ /* noop */ },
        endRun(){ const out=(RUN?.list||[]).map(x=>({...x})); RUN=null; return out; },
        getActive(){ return RUN?{list:RUN.list}:null; }
      };})();
    }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }

    try { ({ Coach } = await import('./core/coach.js')); CoachClass = Coach; }
    catch { // micro-coach with HUD bubble
      CoachClass = class {
        constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase(); this._last=0; this._gap=650; this._ensure(); }
        _ensure(){ let el=$('#coachHUD'); if(!el){ el=document.createElement('div'); el.id='coachHUD'; el.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;z-index:3000;display:none'; document.body.appendChild(el);} this.box=el; }
        say(m){ if(!m) return; const now=performance.now(); if(now-this._last<this._gap) return; this._last=now; this.box.textContent=m; this.box.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>this.box.style.display='none',1400); }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'แม่นยำ!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวังพลาด!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(s){ this.say((s|0)>=300 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }
  }

  /* ---------- Mode loader ---------- */
  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key) {
    const mod = await import(MODE_PATH(key));
    return {
      name: mod.name || key,
      create: mod.create || null,
      start:  mod.start  || null,
      update: mod.update || null,
      stop:   mod.stop   || null,
      cleanup:mod.cleanup|| null
    };
  }

  /* ---------- HUD (auto-create #time / #score if missing) ---------- */
  function ensureHUD(){
    if (!$('#hudTop')) {
      const top=document.createElement('div');
      top.id='hudTop';
      top.style.cssText='position:fixed;left:12px;right:12px;top:10px;display:flex;justify-content:space-between;gap:8px;z-index:2500;pointer-events:none';
      top.innerHTML = `
        <div style="display:flex;gap:8px">
          <span id="hudMode" style="padding:4px 8px;border-radius:10px;background:#0b2544;color:#cbe7ff;border:1px solid #15406e;pointer-events:auto">—</span>
          <span id="hudDiff" style="padding:4px 8px;border-radius:10px;background:#102b52;color:#e6f5ff;border:1px solid #1b4b8a;pointer-events:auto">—</span>
          <span id="time"    style="padding:4px 8px;border-radius:10px;background:#0a1f3d;color:#c9e7ff;border:1px solid #123863;min-width:64px;text-align:center;pointer-events:auto">45</span>
        </div>
        <div style="display:flex;gap:8px">
          <span id="scoreWrap" style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#bbf7d0;border:1px solid #134064;pointer-events:auto">Score: <b id="score">0</b></span>
          <span id="comboWrap" style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#fde68a;border:1px solid #134064;pointer-events:auto">Combo: <b id="combo">0</b></span>
        </div>`;
      document.body.appendChild(top);
    }
  }
  function setTop({mode,diff,time,score,combo}){
    if(mode!=null)  { const el=$('#hudMode'); if(el) el.textContent=String(mode); }
    if(diff!=null)  { const el=$('#hudDiff'); if(el) el.textContent=String(diff); }
    if(time!=null)  { const el=$('#time');    if(el) el.textContent=String(time|0); }
    if(score!=null) { const el=$('#score');   if(el) el.textContent=String(score|0); }
    if(combo!=null) { const el=$('#combo');   if(el) el.textContent=String(combo|0); }
  }

  /* ---------- Engine state ---------- */
  const DIFF_SECONDS = { Easy:60, Normal:75, Hard:90 };
  let R = {
    playing:false, remain:45, raf:0, _secMark:0, _dtMark:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null,
    coach:null
  };

  /* ---------- Event bus for modes ---------- */
  function Bus(){
    return {
      hit(e){ // e: {kind:'good'|'perfect'|'golden', points, ui, meta}
        const pts = e?.points|0; if(pts) R.sys.score.add(pts);
        setTop({ score:R.sys.score.get?.()||0, combo:R.sys.score.combo|0 });
        if(e?.ui){ const el=document.createElement('div'); el.textContent='+'+pts+(e?.kind==='golden'?' ✨':''); Object.assign(el.style,{position:'fixed',left:(e.ui.x|0)+'px',top:(e.ui.y|0)+'px',transform:'translate(-50%,-50%)',font:'900 16px ui-rounded',color:'#fff',textShadow:'0 2px 10px #000',zIndex:3000,opacity:'1',transition:'all .72s'}); document.body.appendChild(el); requestAnimationFrame(()=>{ el.style.top=(e.ui.y-36)+'px'; el.style.opacity='0'; }); setTimeout(()=>el.remove(),720); }
        if(e?.kind==='perfect'||e?.kind==='golden') R.coach?.onPerfect?.(); else R.coach?.onGood?.();
        try{ Quests.event('hit',{ result:e?.kind||'good', score:R.sys.score.get?.()||0, meta:e?.meta }); }catch{}
        R.sys.sfx?.[e?.kind==='bad'?'bad':(e?.kind==='perfect'?'perfect':'good')]?.();
      },
      miss(){ R.sys.score.combo=0; document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'),140); try{ Quests.event('miss',{}); }catch{} R.sys.sfx?.bad?.(); }
    };
  }

  /* ---------- Loop & end ---------- */
  function loop(){
    if(!R.playing) return;
    const now=performance.now();

    // 1s tick
    if (now - R._secMark >= 1000){
      R._secMark = now;
      R.remain = Math.max(0, (R.remain|0) - 1);
      setTop({ time:R.remain });

      if (R.remain===10) R.coach?.onTimeLow?.();

      try {
        const chips = Quests.tick({ score: R.sys.score.get?.()||0 }) || [];
        const allDone = chips.length>0 && chips.every(c=>c.done && !c.fail);
        if (allDone){ return endRun(true,'missions'); }
      } catch {}
      if (R.remain<=0) return endRun(false,'timeup');
      R.sys.sfx?.tick?.();
    }

    // mode update
    try {
      if(R.modeInst?.update){ const dt=(now-(R._dtMark||now))/1000; R._dtMark=now; R.modeInst.update(dt, Bus()); }
      else if(R.modeAPI?.update){ const dt=(now-(R._dtMark||now))/1000; R._dtMark=now; R.modeAPI.update(dt, Bus()); }
    } catch(e){ console.warn('[mode.update]',e); }

    R.raf=requestAnimationFrame(loop);
  }

  function endRun(win=false, reason='timeup'){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);

    let quests=[];
    try { quests = Quests.endRun({ score:R.sys.score.get?.()||0 })||[]; } catch {}

    // simple result toast (ไม่ทำ modal เพื่อความปลอดภัยต่อ DOM)
    const box=document.createElement('div');
    box.style.cssText='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:4000';
    const g = (R.sys.score.getGrade?.()||{score:R.sys.score.get?.()||0,grade:'C',stars:0});
    box.innerHTML = `<div style="width:min(520px,92vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff">
      <h3 style="margin:0 0 6px;font:900 20px ui-rounded">${win?'🎉 You Win!':'⌛ Time Up'}</h3>
      <p style="margin:0 0 10px;color:#cfe7ff">${win?'ภารกิจสำเร็จครบก่อนเวลาหมด':'ภารกิจไม่ครบก่อนหมดเวลา'}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <div style="padding:6px 8px;border-radius:10px;background:#0f1e38;border:1px solid #16325d">คะแนน: ${g.score} (เกรด ${g.grade}${g.stars?`, ★ ${g.stars}`:''})</div>
        <div style="padding:6px 8px;border-radius:10px;background:#0f1e38;border:1px solid #16325d">คอมโบสูงสุด: ${R.sys.score.bestCombo|0}</div>
        <div style="padding:6px 8px;border-radius:10px;background:#0f1e38;border:1px solid #16325d">ภารกิจสำเร็จ: ${(quests.filter(q=>q.done&&!q.fail).length)}/${quests.length||3}</div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="btnHome"  style="padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer">🏠 Home</button>
        <button id="btnRetry" style="padding:8px 10px;border-radius:10px;background:#123054;color:#dff2ff;border:1px solid #1e4d83;cursor:pointer">↻ Retry</button>
      </div>
    </div>`;
    document.body.appendChild(box);
    box.querySelector('#btnHome').onclick = ()=>{ try{box.remove();}catch{} showMenu(true); };
    box.querySelector('#btnRetry').onclick= ()=>{ try{box.remove();}catch{} startGame(); };

    R.coach?.onEnd?.(R.sys.score.get?.()||0);
    try { Progress.endRun({ score:R.sys.score.get?.()||0 }); } catch {}
    showMenu(true);
  }

  /* ---------- Start/Stop ---------- */
  function stopGame(){
    R.playing=false; cancelAnimationFrame(R.raf);
    try{ R.modeInst?.stop?.(); R.modeInst?.cleanup?.(); }catch{}
    try{ R.modeAPI?.stop?.(); R.modeAPI?.cleanup?.(); }catch{}
  }

  async function startGame(){
    await loadCore();
    ensureHUD();

    const body = document.body;
    const mode = body.getAttribute('data-mode') || window.__HHA_MODE || 'goodjunk';
    const diff = body.getAttribute('data-diff') || window.__HHA_DIFF || 'Normal';
    R.modeKey=mode; R.diff=diff;

    let api;
    try { api = await loadMode(mode); }
    catch(e){ return toast('Failed to load mode: '+mode); }

    // systems
    R.sys.score = new ScoreSystem(); R.sys.score.reset?.();
    R.sys.sfx   = new SFXClass();    R.sys.sfx.unlock?.();

    // coach
    R.coach = new CoachClass();

    // time by diff
    R.remain = DIFF_SECONDS[diff] ?? 75;

    // init mode
    R.modeAPI = api; R.modeInst=null;
    try{
      if(api.create){ R.modeInst = api.create({ engine:{}, hud:{}, coach:R.coach }); R.modeInst.start?.({ difficulty:diff }); }
      else if(api.start && api.update){ api.start({ difficulty:diff }); }
    }catch(e){ console.warn('[mode.start]',e); }

    // bind quests & progress
    try { Quests.bindToMain({ hud:{}, coach:R.coach }); Quests.beginRun(mode, diff, (localStorage.getItem('hha_lang')||'TH'), R.remain); } catch {}
    try { Progress.init?.(); Progress.beginRun(mode, diff, (localStorage.getItem('hha_lang')||'TH')); } catch {}

    // HUD top
    setTop({ mode, diff, time:R.remain, score:0, combo:0 });

    // RUN!
    showMenu(false);
    R.playing=true; R._secMark=performance.now(); R._dtMark=performance.now();
    R.coach.onStart?.();
    R.raf=requestAnimationFrame(loop);
  }

  /* ---------- Menu wiring (data-mode / data-diff / data-action) ---------- */
  function showMenu(show){ const mb=$('#menuBar'); if(!mb) return; mb.style.display= show?'flex':'none'; if(show){ document.body.removeAttribute('data-playing'); } else { document.body.setAttribute('data-playing','1'); } }
  function toast(text){ let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.style.cssText='position:fixed;left:50%;bottom:12px;transform:translateX(-50%);background:#0f1e38;border:1px solid #16325d;color:#e6f2ff;border-radius:10px;padding:8px 10px;z-index:5000;'; document.body.appendChild(el); } el.textContent=text; el.style.opacity='1'; clearTimeout(el._to); el._to=setTimeout(()=>{ el.style.opacity='0'; },1200); }

  (function bindMenu(){
    const mb = $('#menuBar'); if(!mb) return;
    const setActive=(sel,val,attr)=>mb.querySelectorAll(sel).forEach(el=>{ if(el.dataset[attr]===val) el.classList.add('active'); else el.classList.remove('active'); });
    const onHit=(ev)=>{
      const t=ev.target.closest('.btn'); if(!t) return;
      if(t.dataset.mode){ document.body.setAttribute('data-mode', t.dataset.mode); setActive('.btn[data-mode]', t.dataset.mode, 'mode'); return; }
      if(t.dataset.diff){ document.body.setAttribute('data-diff', t.dataset.diff); setActive('.btn[data-diff]', t.dataset.diff, 'diff'); return; }
      if(t.dataset.action==='howto'){ alert('ชนะเกม: ทำ “ภารกิจ” ครบ 3 รายการก่อนเวลาหมด\n• เวลาต่อรอบ: Easy 60s / Normal 75s / Hard 90s\n• เคล็ดลับ: เก็บ PERFECT/Golden, รักษาคอมโบ, ระวังพลาด'); return; }
      if(t.dataset.action==='start'){ startGame(); return; }
    };
    ['click','pointerup','touchend'].forEach(e=>mb.addEventListener(e,onHit,{passive:true}));
  })();

  // keyboard start
  window.addEventListener('keydown',(e)=>{ if((e.key==='Enter'||e.key===' ') && $('#menuBar') && getComputedStyle($('#menuBar')).display!=='none'){ e.preventDefault(); startGame(); } },{passive:false});

  // ensure any canvas won't block click
  setTimeout(()=>{ const c=document.getElementById('c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);

  // expose
  window.HHA = window.HHA||{};
  window.HHA.start = startGame;
  window.HHA.stop  = stopGame;
})();
