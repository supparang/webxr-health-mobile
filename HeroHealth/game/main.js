// === Hero Health Academy — game/main.js (Engine + Coach + DOM-spawn ready) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);

  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, EngineClass, THREE;

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

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = class {
        constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase(); this.hud=null; this.txt=null; this._ensureHUD(); }
        _ensureHUD(){ this.hud = $('#coachHUD') || Object.assign(document.createElement('div'),{id:'coachHUD',className:'coach'}); if(!$('#coachHUD')){ const t=document.createElement('span'); t.id='coachText'; this.hud.appendChild(t); (document.getElementById('hudWrap')||document.body).appendChild(this.hud);} this.txt = $('#coachText'); }
        say(m){ if(this.txt){ this.txt.textContent=m||''; this.hud.style.display='flex'; setTimeout(()=>{ this.hud.style.display='none'; },1400);} }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }

    // === NEW: Engine + THREE (optional) ===
    try { ({ Engine: EngineClass } = await import('./core/engine.js')); } catch {}
    try { THREE = await import('https://unpkg.com/three@0.159.0/build/three.module.js'); } catch { THREE = {}; }
  }

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
      fx: mod.fx || {}
    };
  }

  // HUD
  function setScore(v){ const el = $('#score'); if (el) el.textContent = v|0; }
  function setTime(v){ const el = $('#time');  if (el) el.textContent = v|0; }

  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    engine:null,
    modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, hud:null, coach:null
  };

  function busFor(){
    return {
      sfx: R.sys.sfx,
      hit(e){
        if (e?.points) R.sys.score.add(e.points);
        setScore(R.sys.score.get?.() || R.sys.score.value || 0);
        if (e?.ui && R.engine?.fx?.popText) R.engine.fx.popText(`+${e.points||0}`, e.ui);
        if (e?.kind==='perfect') R.coach?.onPerfect(); else if (e?.kind==='good') R.coach?.onGood();
        Quests.event('hit', { result: e?.kind || 'good', meta: e?.meta || {} });
      },
      miss(){ /* soft miss */ }
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
      if (R.remain === 10) R.coach?.onTimeLow?.();
      Quests.tick({ score: (R.sys.score.get?.()||0) });
    }

    try {
      if (R.modeInst?.update) {
        const dt = (tNow - (R._dtMark||tNow)) / 1000; R._dtMark = tNow;
        R.modeInst.update(dt, busFor());
      } else if (R.modeAPI?.tick) {
        R.modeAPI.tick(R.state||{}, R.sys, R.hud||{});
      }
    } catch(e){ console.warn('[mode.update] error', e); }

    if (R.remain <= 0) return endGame(false);
    R.raf = requestAnimationFrame(gameTick);
  }

  function endGame(){
    if (!R.playing) return;
    R.playing = false;
    cancelAnimationFrame(R.raf);
    try { Quests.endRun({ score: R.sys.score.get?.()||0 }); } catch {}
    try { R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state, R.hud); } catch {}
    document.body.removeAttribute('data-playing');
    $('#menuBar')?.removeAttribute('data-hidden');
    R.coach?.onEnd?.(R.sys.score.get?.()||0);
    try { Progress.endRun({ score: R.sys.score.get?.()||0 }); } catch {}
    window.HHA._busy = false;
  }

  async function startGame(){
    if (window.HHA?._busy) return;
    window.HHA._busy = true;

    await loadCore();
    Progress.init?.();

    // Instantiate Engine once
    if (!R.engine && EngineClass){
      R.engine = new EngineClass(THREE, document.getElementById('c'));
      window.HHA = window.HHA || {};
      window.HHA.engine = R.engine; // ให้ fx.js เรียกใช้ได้
      // map HHA_FX (เผื่อโหมดที่ import ผ่าน fx.js ไม่ได้)
      window.HHA_FX = window.HHA_FX || {};
      window.HHA_FX.shatter3D = (...a)=>R.engine?.fx?.shatter3D?.(...a);
      window.HHA_FX.add3DTilt = (el)=>{ try { el && (el.style.transformStyle='preserve-3d'); } catch {}; };
    }

    const modeKey = window.__HHA_MODE || (document.body.getAttribute('data-mode') || 'goodjunk');
    const diff    = window.__HHA_DIFF || (document.body.getAttribute('data-diff') || 'Normal');
    R.modeKey = modeKey;

    let api;
    try { api = await loadMode(modeKey); }
    catch (e) { console.error('[HHA] Failed to load mode:', modeKey, e); toast(`Failed to load mode: ${modeKey}`); window.HHA._busy = false; return; }

    R.sys.score = new (ScoreSystem||function(){})(); R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();

    setScore(0);

    R.hud = {
      setTarget(g,have,need){
        const el = $('#targetWrap'); if(!el) return;
        const mapTH = { veggies:'ผัก', fruits:'ผลไม้', grains:'ธัญพืช', protein:'โปรตีน', dairy:'นม' };
        el.textContent = `${mapTH[g]||g} • ${have|0}/${need|0}`;
        el.style.display = 'inline-flex';
      },
      showHydration(){}, hideHydration(){},
      dimPenalty(){ document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 120); },
      setQuestChips(){}, markQuestDone(){}
    };

    R.coach = new CoachClass({ lang: (localStorage.getItem('hha_lang')||'TH') });
    R.coach.onStart();

    try { Quests.bindToMain({ hud: R.hud, coach: R.coach }); } catch {}

    R.state   = { difficulty: diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    R.modeAPI = api;

    if (api.create){
      R.modeInst = api.create({ engine: R.engine, hud: R.hud, coach: R.coach });
      R.modeInst.start?.();
    } else if (api.init){
      api.init(R.state, R.hud, { time: 45, life: 1600 });
    }

    try { Quests.beginRun(modeKey, diff, (R.state.lang||'TH'), 45); } catch {}
    try { Progress.beginRun(modeKey, diff, (R.state.lang||'TH')); } catch {}

    R.playing  = true;
    R.startedAt = performance.now();
    R._secMark  = performance.now();
    R._dtMark   = performance.now();
    R.remain    = 45;
    setTime(R.remain);

    document.body.setAttribute('data-playing','1');
    $('#menuBar')?.setAttribute('data-hidden','1');

    // กัน canvas บัง UI
    setTimeout(()=>{ const c = document.getElementById('c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } }, 0);
    R.raf = requestAnimationFrame(gameTick);
  }

  function toast(text){
    let el = document.getElementById('toast');
    if(!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 1200);
  }

  // Expose
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // Strong bind Start
  (function bindStartStrong(){
    const b = document.getElementById('btn_start');
    if (!b) return;
    const clone = b.cloneNode(true);
    b.parentNode.replaceChild(clone, b);
    clone.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); }, {capture:true});
  })();

  // Enter / Space to start
  window.addEventListener('keydown', (e)=>{
    if ((e.key === 'Enter' || e.key === ' ') && !R.playing){
      const menuVisible = !document.getElementById('menuBar')?.hasAttribute('data-hidden');
      if (menuVisible) { e.preventDefault(); startGame(); }
    }
  }, { passive:false });
})();
