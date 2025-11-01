// === Hero Health Academy — game/main.js (force-hide menu + safe Coach + Builtin GoodJunk fallback) ===
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
    const mb = $('#menuBar'); if (!mb) return;
    mb.setAttribute('data-hidden','1'); mb.setAttribute('aria-hidden','true');
    Object.assign(mb.style,{display:'none',visibility:'hidden',pointerEvents:'none',zIndex:'-1'});
  }
  function showMenuHard(){
    const mb = $('#menuBar'); if (!mb) return;
    mb.removeAttribute('data-hidden'); mb.removeAttribute('aria-hidden');
    Object.assign(mb.style,{display:'',visibility:'',pointerEvents:'auto',zIndex:'9999'});
  }

  // --------- Safe stubs ----------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass;

  async function loadCore() {
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n=0){this.value+=n;} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { beginRun(){}, event(){}, tick(){}, endRun(){return[]}, bindToMain(){return{refresh(){}}} }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }

    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} }; }

    // Coach (รับได้หลายรูปแบบ export)
    try {
      const cmod = await import('./core/coach.js');
      CoachClass = (typeof cmod?.Coach === 'function') ? cmod.Coach
                 : (typeof cmod?.default === 'function') ? cmod.default
                 : cmod?.CoachClass;
    } catch {}
    if (typeof CoachClass !== 'function') {
      CoachClass = class {
        constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase(); }
        _say(m){ let b=document.getElementById('coachHUD'); if(!b){ b=document.createElement('div'); b.id='coachHUD';
          b.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;z-index:5000';
          document.body.appendChild(b);} b.textContent=m; clearTimeout(this._to); this._to=setTimeout(()=>{ b.remove(); },1400); }
        onStart(){ this._say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this._say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this._say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this._say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this._say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this._say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }
  }

  // --------- Builtin fallback mode (Good vs Junk) ----------
  function BuiltinGoodJunk(){
    const GOOD = ['🥦','🥕','🍎','🍌','🍇','🍓','🥗','🐟','🥜','🥛'];
    const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧋','🥤','🍰','🌭'];
    let host, timer, alive = new Set();

    function ensureHosts(){
      host = document.getElementById('spawnHost');
      if (!host) { host = document.createElement('div'); host.id='spawnHost'; host.style.cssText='position:fixed;inset:0;z-index:5;pointer-events:none;'; document.body.appendChild(host); }
    }

    function rand(min,max){ return Math.random()*(max-min)+min; }

    function spawn(bus){
      const good = Math.random() < 0.7;
      const emoji = good ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
      const d = document.createElement('div');
      const x = rand(10, 90), y = rand(15, 85);
      d.textContent = emoji;
      d.style.cssText =
        `position:fixed;left:${x}vw;top:${y}vh;transform:translate(-50%,-50%);
         font-size:${rand(28,44)}px;filter:drop-shadow(0 6px 10px #0008);cursor:pointer;
         user-select:none;pointer-events:auto;transition:transform .15s ease, opacity .25s ease;`;
      const kill = ()=>{ d.style.opacity='0'; setTimeout(()=>{ d.remove(); alive.delete(d); },120); };
      d.addEventListener('pointerdown', (e)=>{
        e.preventDefault(); e.stopPropagation();
        if (good){ bus.hit({kind:'good', points:10, ui:{x:e.clientX,y:e.clientY}}); }
        else     { bus.miss(); }
        kill();
      }, {passive:false});
      host.appendChild(d);
      alive.add(d);
      setTimeout(()=>{ if(alive.has(d)){ bus.miss(); kill(); } }, 1200 + (good?400:200));
    }

    return {
      start({time=45}={}, bus){
        ensureHosts();
        timer = setInterval(()=>spawn(bus), 520); // ออกของสม่ำเสมอ
      },
      update(dt, bus){ /* ไม่ต้องทำอะไร เพิ่มได้ภายหลัง */ },
      cleanup(){
        clearInterval(timer); timer=null;
        alive.forEach(el=>{ try{ el.remove(); }catch{} }); alive.clear();
      }
    };
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
        if (e?.points){ R.sys.score.add(e.points); R.sys.score.combo=(R.sys.score.combo|0)+1; R.sys.score.bestCombo=Math.max(R.sys.score.bestCombo|0,R.sys.score.combo|0); }
        setScore(R.sys.score.get?.() || R.sys.score.value || 0);
        if (e?.ui) FX.popText(`+${e.points||0}`, e.ui);
        try{
          if (e?.kind==='perfect') R.coach?.onPerfect(); else if (e?.kind==='good') R.coach?.onGood();
          Quests.event('hit', { result: e?.kind || 'good', meta: e?.meta || {}, comboNow:R.sys.score.combo|0 });
        }catch{}
      },
      miss(){
        R.sys.score.combo = 0;
        try{ Quests.event('miss',{}); R.coach?.onBad?.(); }catch{}
      }
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
    try{
      if (window.HHA?._busy) return; window.HHA._busy = true;

      await loadCore();
      Progress.init?.();

      R.modeKey = (document.body.getAttribute('data-mode') || 'goodjunk');
      const diff = (document.body.getAttribute('data-diff') || 'Normal');

      // load mode (หรือ fallback)
      let api = null, usedFallback = false;
      try { api = await loadMode(R.modeKey); }
      catch (e) { console.warn('[HHA] import mode fail → use builtin fallback', e); usedFallback = true; }

      // systems
      R.sys.score = new (ScoreSystem||function(){})();
      R.sys.score.reset?.(); R.sys.score.combo=0; R.sys.score.bestCombo=0;
      R.sys.sfx   = new (SFXClass||function(){})();
      setScore(0);

      R.coach = new CoachClass({ lang: (localStorage.getItem('hha_lang')||'TH') });
      R.coach.onStart?.();

      try { Quests.bindToMain({ hud: {}, coach: R.coach }); } catch {}

      R.state = { difficulty: diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };

      if (!api || (!api.create && !api.init && !api.update && !api.tick)) {
        usedFallback = true;
      }

      if (usedFallback || R.modeKey==='goodjunk' && !api.update && !api.create) {
        // ใช้ BuiltinGoodJunk ให้แน่ใจว่ามีของให้เล่น
        const builtin = BuiltinGoodJunk();
        R.modeAPI = { update: builtin.update, cleanup: builtin.cleanup };
        R.modeInst = { update: builtin.update, cleanup: builtin.cleanup, start: (cfg)=>builtin.start(cfg, busFor()) };
        R.modeInst.start({ time:45 });
      } else {
        // ใช้โหมดจริง
        R.modeAPI = api;
        if (api.create){
          R.modeInst = api.create({ engine:{ fx:FX }, hud:{}, coach:R.coach });
          R.modeInst.start?.({ time:45 });
        } else if (api.init){
          api.init(R.state, {}, { time: 45, life: 1600 });
        }
      }

      try { Quests.beginRun(R.modeKey, diff, (R.state.lang||'TH'), 45); Progress.beginRun(R.modeKey, diff, (R.state.lang||'TH')); } catch {}

      // start loop
      R.playing = true;
      R.startedAt = performance.now();
      R._secMark = performance.now();
      R._dtMark  = performance.now();
      R.remain   = 45;
      setTime(R.remain);
      document.body.setAttribute('data-playing','1');
      hideMenuHard(); setTimeout(hideMenuHard,0); setTimeout(hideMenuHard,120); setTimeout(hideMenuHard,400);
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
