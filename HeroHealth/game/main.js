// === Hero Health Academy — game/main.js (force-hide menu on start, safe coach) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function toast(text){
    let el = $('#toast');
    if(!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 1400);
  }

  // --- hard show/hide for #menuBar ---
  function hideMenuHard(){
    const mb = $('#menuBar');
    if (!mb) return;
    mb.setAttribute('data-hidden','1');
    mb.setAttribute('aria-hidden','true');
    mb.style.display = 'none';
    mb.style.visibility = 'hidden';
    mb.style.pointerEvents = 'none';
    mb.style.zIndex = '-1';
  }
  function showMenuHard(){
    const mb = $('#menuBar');
    if (!mb) return;
    mb.removeAttribute('data-hidden');
    mb.removeAttribute('aria-hidden');
    mb.style.display = '';
    mb.style.visibility = '';
    mb.style.pointerEvents = 'auto';
    mb.style.zIndex = '9999';
  }

  // --------- Safe stubs ----------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass;

  async function loadCore() {
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0;} add(n=0){ this.value+=n;} get(){return this.value|0;} reset(){this.value=0;} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { beginRun(){}, event(){}, tick(){}, endRun(){return[]}, bindToMain(){return{refresh(){}}} }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }

    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} }; }

    // Coach: รองรับหลายรูปแบบ export และ fallback
    try {
      const cmod = await import('./core/coach.js');
      CoachClass = (typeof cmod?.Coach === 'function') ? cmod.Coach
                 : (typeof cmod?.default === 'function') ? cmod.default
                 : cmod?.CoachClass;
    } catch {}
    if (typeof CoachClass !== 'function') {
      CoachClass = class {
        constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase(); }
        _say(m){ let b=document.getElementById('coachHUD'); if(!b){ b=document.createElement('div'); b.id='coachHUD'; b.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;z-index:5000'; document.body.appendChild(b);} b.textContent=m; clearTimeout(this._to); this._to=setTimeout(()=>{ b.remove(); },1400); }
        onStart(){ this._say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this._say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this._say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this._say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this._say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this._say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }
  }

  // --------- Mode loader ----------
  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key) {
    const mod = await import(MODE_PATH(key));
    return {
      name: mod.name || key,
      create: mod.create || null,
      init: mod.init || null,
      tick: mod.tick || null,
      pickMeta: mod.pickMeta || null,
      onHit: mod.onHit || null,
      cleanup: mod.cleanup || null,
      fx: mod.fx || {},
      update: mod.update || null
    };
  }

  // --------- Tiny FX helper ----------
  const FX = {
    popText(txt, { x, y, ms = 700 } = {}) {
      const el = document.createElement('div');
      el.textContent = txt;
      el.style.cssText = `
        position:fixed; left:${x|0}px; top:${y|0}px; transform:translate(-50%,-50%);
        font:900 16px ui-rounded, system-ui; color:#fff; text-shadow:0 2px 10px #000;
        pointer-events:none; z-index:97; opacity:1; transition: all .72s ease-out;`;
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.top = (y - 36) + 'px'; el.style.opacity = '0'; });
      setTimeout(() => el.remove(), ms);
    }
  };

  // --------- Engine state ----------
  const R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, coach:null
  };

  function setScore(v){ const el = $('#scoreVal'); if (el) el.textContent = v|0; }
  function setTime(v){ const el = $('#timeVal'); if (el) el.textContent = v|0; }

  function busFor(){
    return {
      sfx: R.sys.sfx,
      hit(e){
        if (e?.points) R.sys.score.add(e.points);
        setScore(R.sys.score.get?.() || R.sys.score.value || 0);
        if (e?.ui) FX.popText(`+${e.points||0}`, e.ui);
        try{
          if (e?.kind==='perfect') R.coach?.onPerfect(); else if (e?.kind==='good') R.coach?.onGood();
          Quests.event('hit', { result: e?.kind || 'good', meta: e?.meta || {} });
        }catch{}
      },
      miss(){}
    };
  }

  function gameTick(){
    if (!R.playing) return;
    const tNow = performance.now();

    const secGone = Math.floor((tNow - R._secMark)/1000);
    if (secGone >= 1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      R._secMark = tNow;
      setTime(R.remain);
      try{ if (R.remain === 10) R.coach?.onTimeLow?.(); Quests.tick({ score: (R.sys.score.get?.()||0) }); }catch{}
    }

    try {
      if (R.modeInst && typeof R.modeInst.update === 'function') {
        const dt = (tNow - (R._dtMark||tNow)) / 1000; R._dtMark = tNow;
        R.modeInst.update(dt, busFor());
      } else if (R.modeAPI?.update) {
        const dt = (tNow - (R._dtMark||tNow)) / 1000; R._dtMark = tNow;
        R.modeAPI.update(dt, busFor());
      } else if (R.modeAPI?.tick) {
        R.modeAPI.tick(R.state||{}, R.sys, {});
      }
    } catch(e){ console.warn('[mode.update] error', e); }

    if (R.remain <= 0) return endGame();
    R.raf = requestAnimationFrame(gameTick);
  }

  function endGame(){
    if (!R.playing) return;
    R.playing = false;
    cancelAnimationFrame(R.raf);
    try { Quests.endRun({ score: R.sys.score.get?.()||0 }); } catch {}
    try { R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state, {}); } catch {}
    document.body.removeAttribute('data-playing');
    showMenuHard();
    try { R.coach?.onEnd?.(R.sys.score.get?.()||0); Progress.endRun({ score: R.sys.score.get?.()||0 }); } catch {}
    window.HHA._busy = false;
  }

  async function startGame(){
    console.log('[HHA] startGame invoked');
    try{
      if (window.HHA?._busy) return;
      window.HHA._busy = true;

      await loadCore();
      Progress.init?.();

      R.modeKey = (document.body.getAttribute('data-mode') || 'goodjunk');
      const diff = (document.body.getAttribute('data-diff') || 'Normal');

      // load mode
      let api;
      try { api = await loadMode(R.modeKey); }
      catch (e) { console.error('[HHA] Failed to load mode:', R.modeKey, e); toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy = false; return; }

      // systems
      R.sys.score = new (ScoreSystem||function(){})();
      R.sys.score.reset?.();
      R.sys.sfx   = new (SFXClass||function(){})();

      setScore(0);

      R.coach = new CoachClass({ lang: (localStorage.getItem('hha_lang')||'TH') });
      R.coach.onStart?.();

      try { Quests.bindToMain({ hud: {}, coach: R.coach }); } catch {}

      R.state = { difficulty: diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
      R.modeAPI = api;

      if (api.create){
        R.modeInst = api.create({ engine:{ fx:FX }, hud:{}, coach:R.coach });
        R.modeInst.start?.();
      } else if (api.init){
        api.init(R.state, {}, { time: 45, life: 1600 });
      }

      try { Quests.beginRun(R.modeKey, diff, (R.state.lang||'TH'), 45); Progress.beginRun(R.modeKey, diff, (R.state.lang||'TH')); } catch {}

      // start loop
      R.playing = true;
      R.startedAt = performance.now();
      R._secMark = performance.now();
      R._dtMark  = performance.now();
      R.remain   = 45;
      setTime(R.remain);

      // ซ่อนเมนูแบบ hard หลายจังหวะ (กัน CSS/สคริปต์อื่นแทรก)
      document.body.setAttribute('data-playing','1');
      hideMenuHard();
      setTimeout(hideMenuHard, 0);
      setTimeout(hideMenuHard, 120);
      setTimeout(hideMenuHard, 400);

      R.raf = requestAnimationFrame(gameTick);
    }catch(err){
      console.error('[HHA] startGame error', err);
      toast(`เริ่มเกมไม่สำเร็จ: ${err?.message||err}`);
      window.HHA._busy = false;
    }
  }

  // --------- Expose & bindings ----------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  (function bindMenuDelegation(){
    const mb = document.getElementById('menuBar');
    if (!mb) return;
    mb.addEventListener('click', (ev)=>{
      const t = ev.target.closest('.btn'); if(!t) return;
      if (t.dataset.action === 'start'){ ev.preventDefault(); ev.stopPropagation(); startGame(); }
      if (t.hasAttribute('data-mode')){ document.body.setAttribute('data-mode', t.getAttribute('data-mode')); $$('#menuBar [data-mode]').forEach(b=>b.classList.remove('active')); t.classList.add('active'); }
      if (t.hasAttribute('data-diff')){ document.body.setAttribute('data-diff', t.getAttribute('data-diff')); $$('#menuBar [data-diff]').forEach(b=>b.classList.remove('active')); t.classList.add('active'); }
    }, true);
  })();

  // กัน canvas บังคลิก
  setTimeout(()=>{ const c = $('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } }, 0);

  window.addEventListener('keydown', (e)=>{
    if ((e.key === 'Enter' || e.key === ' ') && !R.playing){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if (menuVisible) { e.preventDefault(); startGame(); }
    }
  }, { passive:false });
})();
