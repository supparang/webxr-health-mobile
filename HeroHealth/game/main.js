// === Hero Health Academy — game/main.js (stable start + HUD + coach-safe) ===
window.__HHA_BOOT_OK = 'main';

(function(){
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  // ---------- Robust imports with fallbacks ----------
  let ScoreSystem, SFXClass, Quests, Progress, CoachClass;

  async function loadCore() {
    try { const m = await import('./core/score.js'); ScoreSystem = m.ScoreSystem || m.default; } catch {
      ScoreSystem = class{ constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n=0){this.value+=n;} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} };
    }
    try { const m = await import('./core/sfx.js'); SFXClass = m.SFX || m.default; } catch {
      SFXClass = class{ constructor(){this.enabled=true;} setEnabled(v){this.enabled=!!v;} isEnabled(){return !!this.enabled;} play(){} good(){} bad(){} perfect(){} tick(){} power(){} };
    }
    try { const m = await import('./core/quests.js'); Quests = m.Quests || m.default || { beginRun(){}, event(){}, tick(){}, endRun(){return[]}, bindToMain(){return{refresh(){}}} }; }
    catch { Quests = { beginRun(){}, event(){}, tick(){}, endRun(){return[]}, bindToMain(){return{refresh(){}}} }; }
    try { const m = await import('./core/progression.js'); Progress = m.Progress || m.default || { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }

    // Coach must be a constructor
    try {
      const m = await import('./core/coach.js');
      const C = (typeof m.Coach==='function') ? m.Coach : (typeof m.default==='function' ? m.default : null);
      if (!C) throw new Error('Coach ctor missing');
      CoachClass = C;
    } catch {
      CoachClass = class {
        constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase(); }
        _say(msg){ let box=$('#coachBox'); if(!box){ box=document.createElement('div'); box.id='coachBox'; box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);z-index:2000'; document.body.appendChild(box); }
          box.textContent=msg; box.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>box.style.display='none',1400);
        }
        onStart(){ this._say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this._say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this._say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this._say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this._say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this._say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }
  }

  // ---------- Mode loader with flexible API ----------
  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return {
      name: mod.name || key,
      // patterns supported:
      start:  mod.start  || null,   // DOM-spawn pattern (this projectใช้)
      update: mod.update || null,   // DOM-spawn tick(dt,bus)
      cleanup:mod.cleanup|| null,
      create: mod.create || null,   // factory pattern (เผื่อโหมดเก่า)
      init:   mod.init   || null,
      tick:   mod.tick   || null
    };
  }

  // ---------- FX ----------
  const FX = {
    popText(txt,{x,y,ms=700}={}){
      if(x==null||y==null){ x=innerWidth/2; y=innerHeight/2; }
      const el=document.createElement('div');
      el.textContent=txt;
      el.style.cssText=`position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);
        font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:97;opacity:1;transition:.72s ease-out;`;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.top=(y-36)+'px'; el.style.opacity='0'; });
      setTimeout(()=>el.remove(),ms);
    }
  };

  // ---------- Runtime ----------
  const TIME_BY_MODE={ goodjunk:45, groups:60, hydration:50, plate:55 };
  function matchTime(mode='goodjunk',diff='Normal'){
    const base=TIME_BY_MODE[mode]??45;
    if(diff==='Easy') return base+5;
    if(diff==='Hard') return Math.max(20, base-5);
    return base;
  }

  let R = {
    playing:false, raf:0,
    modeKey:'goodjunk', diff:'Normal',
    remain:45, _secMark:0, _dtMark:0,
    sys:{ score:null, sfx:null },
    api:null, inst:null, state:null, coach:null
  };

  function setBadges(){
    const mB=$('#modeBadge'); if(mB) mB.textContent = R.modeKey;
    const dB=$('#diffBadge'); if(dB) dB.textContent = R.diff;
    const tV=$('#timeVal');  if(tV) tV.textContent  = R.remain|0;
    const sV=$('#scoreVal'); if(sV) sV.textContent  = R.sys?.score?.get?.()||0;
  }

  function bus(){
    return {
      sfx: R.sys.sfx,
      hit(e){
        const pts = e?.points|0;
        if(pts){ R.sys.score.add(pts); R.sys.score.combo=(R.sys.score.combo|0)+1; R.sys.score.bestCombo=Math.max(R.sys.score.bestCombo|0,R.sys.score.combo|0); }
        setBadges();
        if(e?.ui) FX.popText(`+${pts}`, e.ui);
        if(e?.kind==='perfect') R.coach?.onPerfect(); else if(e?.kind==='good') R.coach?.onGood();
        try{ Quests.event('hit',{result:e?.kind||'good',meta:e?.meta||{},comboNow:R.sys.score.combo|0}); }catch{}
      },
      miss(){ R.sys.score.combo=0; setBadges(); try{R.coach?.onBad?.();}catch{} }
    };
  }

  function loop(){
    if(!R.playing) return;
    const now=performance.now();

    const sg=Math.floor((now-R._secMark)/1000);
    if(sg>=1){
      R.remain=Math.max(0,(R.remain|0)-sg);
      R._secMark=now;
      setBadges();
      if(R.remain===10) R.coach?.onTimeLow?.();
      try{ Quests.tick({score:R.sys.score.get?.()||0}); }catch{}
    }

    try{
      if (typeof R.api?.update==='function') {
        const dt=(now-(R._dtMark||now))/1000; R._dtMark=now;
        R.api.update(dt, bus());
      } else if (R.inst?.update) {
        const dt=(now-(R._dtMark||now))/1000; R._dtMark=now;
        R.inst.update(dt, bus());
      } else if (R.api?.tick) {
        R.api.tick(R.state||{}, R.sys, {});
      }
    }catch(e){ console.warn('[mode.update]',e); }

    if(R.remain<=0){ return endGame(); }
    R.raf = requestAnimationFrame(loop);
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    try{ R.inst?.cleanup?.(); R.api?.cleanup?.(R.state,{}); }catch{}
    document.body.removeAttribute('data-playing');
    const mb = $('#menuBar'); if(mb){ mb.setAttribute('data-hidden','0'); mb.style.display=''; }
    R.coach?.onEnd?.(R.sys?.score?.get?.()||0);
    window.HHA._busy=false;
  }

  async function startGame(){
    if(window.HHA?._busy) return;
    window.HHA._busy=true;

    await loadCore();
    // pick selection from body
    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';
    R.remain  = matchTime(R.modeKey, R.diff);

    // systems
    R.sys.score = new ScoreSystem(); R.sys.score.reset?.();
    R.sys.sfx   = new SFXClass();

    // coach
    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    R.coach.onStart?.();

    // load mode
    let api;
    try { api = await loadMode(R.modeKey); }
    catch(e){ console.error('[loadMode]',e); toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy=false; return; }
    R.api = api; R.inst=null; R.state={difficulty:R.diff, ctx:{}};

    // start mode (support both start() and create()/init())
    try{
      if (typeof api.start==='function'){
        api.start({ difficulty:R.diff });
      } else if (api.create){
        R.inst = api.create({ engine:{fx:FX}, coach:R.coach });
        R.inst.start?.({ difficulty:R.diff });
      } else if (api.init){
        api.init(R.state, {}, { time:R.remain, life:1600 });
      }
    }catch(e){ console.warn('[mode.start/init]',e); }

    // hide menu
    const mb = $('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    document.body.setAttribute('data-playing','1');

    // show HUD top
    setBadges();

    // start loop
    R.playing=true;
    R._secMark = performance.now();
    R._dtMark  = performance.now();
    requestAnimationFrame(loop);
  }

  function toast(text){
    let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200);
  }

  // Menu delegation (เลือก mode/diff + howto/sound)
  (function bindMenu(){
    const mb = $('#menuBar'); if(!mb) return;
    function setActive(sel,el){ $$(sel).forEach(b=>b.classList.remove('active')); el.classList.add('active'); }
    mb.addEventListener('click',(ev)=>{
      const t = ev.target.closest('.btn'); if(!t) return;
      if (t.hasAttribute('data-mode')){ setActive('[data-mode]',t); document.body.setAttribute('data-mode', t.getAttribute('data-mode')); return; }
      if (t.hasAttribute('data-diff')){ setActive('[data-diff]',t); document.body.setAttribute('data-diff', t.getAttribute('data-diff')); return; }
      if (t.dataset.action==='howto'){ toast('แตะอาหารดี เลี่ยงของไม่ดี ภายในเวลาที่กำหนด'); return; }
      if (t.dataset.action==='sound'){
        const nowOn = !Array.from(document.querySelectorAll('audio')).every(a=>a.muted);
        document.querySelectorAll('audio').forEach(a=>a.muted = nowOn);
        t.textContent = nowOn ? '🔇 Sound' : '🔊 Sound';
        toast(nowOn?'เสียง: ปิด':'เสียง: เปิด'); return;
      }
      if (t.dataset.action==='start'){ startGame(); return; }
    }, false);
  })();

  // Expose
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // Safety: canvas never blocks UI
  setTimeout(()=>{ document.querySelectorAll('canvas').forEach(c=>{ c.style.pointerEvents='none'; c.style.zIndex='1'; }); },0);
})();
