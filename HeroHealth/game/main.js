// === Hero Health Academy — game/main.js (runtime glue; startGame wired) ===
window.__HHA_BOOT_OK = 'main';
(function () {
  const $ = (s) => document.querySelector(s);

  // --------- Safe stubs ----------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput;
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
  }

  // --------- Mode loader ----------
  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key) {
    const mod = await import(MODE_PATH(key));
    const api = {
      name: mod.name || key,
      create: mod.create || null,
      init: mod.init || null,
      tick: mod.tick || null,
      pickMeta: mod.pickMeta || null,
      onHit: mod.onHit || null,
      cleanup: mod.cleanup || null,
      fx: mod.fx || {}
    };
    return api;
  }

  // --------- HUD helpers ----------
  function setScore(v){ const el = $('#score'); if (el) el.textContent = v|0; }
  function setTime(v){ const el = $('#time'); if (el) el.textContent = v|0; }
  function showCoach(txt){ const hud=$('#coachHUD'); const t=$('#coachText'); if(t) t.textContent = txt||'Ready?'; if(hud){ hud.style.display='flex'; hud.classList.add('show'); } }
  function hideCoach(){ const hud=$('#coachHUD'); if(hud){ hud.classList.remove('show'); hud.style.display='none'; } }

  // --------- FX pop text ----------
  const FX = {
    popText(txt, { x, y, ms = 700 } = {}) {
      const el = document.createElement('div');
      el.textContent = txt;
      el.style.cssText = `position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);
        font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:97;
        opacity:1;transition: all .72s ease-out;`;
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.top = (y - 36) + 'px'; el.style.opacity = '0'; });
      setTimeout(() => el.remove(), ms);
    }
  };

  // --------- Engine loop ----------
  let R = { playing:false, startedAt:0, remain:45, raf:0, sys:{ score:null, sfx:null }, modeAPI:null, modeInst:null };
  function busFor(){ return {
    sfx: R.sys.sfx,
    hit(e){ if (e?.points) R.sys.score.add(e.points);
      setScore(R.sys.score.get?.() || R.sys.score.value || 0);
      if (e?.ui) FX.popText(`+${e.points||0}`, e.ui);
      try{ Quests.event('hit',{result:e?.kind||'good',comboNow:0,meta:e?.meta||{}}); }catch{}
    },
    miss(){ /* no-op for now */ }
  };}

  function gameTick(){
    if (!R.playing) return;
    const now = performance.now();
    const secGone = Math.floor((now - R._secMark)/1000);
    if (secGone >= 1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      R._secMark = now; setTime(R.remain);
      try{ Quests.tick({ score: (R.sys.score.get?.()||0) }); }catch{}
    }
    try {
      if (R.modeInst && typeof R.modeInst.update === 'function') {
        const dt = (now - (R._dtMark||now)) / 1000; R._dtMark = now;
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
    R.playing = false; cancelAnimationFrame(R.raf);
    try { Quests.endRun({ score: R.sys.score.get?.()||0 }); } catch {}
    try { R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state, R.hud); } catch {}
    document.body.removeAttribute('data-playing');
    const menu = $('#menuBar'); if (menu) menu.removeAttribute('data-hidden');
    showCoach('Nice run!'); setTimeout(hideCoach, 1200);
    try { Progress.endRun({ score: R.sys.score.get?.()||0 }); } catch {}
    window.HHA._busy = false;
  }

  async function startGame(){
    if (window.HHA?._busy) return; window.HHA._busy = true;
    await loadCore(); Progress.init?.();

    // reflect chosen mode/diff
    const modeKey = (window.__HHA_MODE || document.body.getAttribute('data-mode') || 'goodjunk');
    const diff = (window.__HHA_DIFF || document.body.getAttribute('data-diff') || 'Normal');

    // load mode
    let api;
    try { api = await loadMode(modeKey); }
    catch (e) { console.error('[HHA] Failed to load mode:', modeKey, e); toast(`Failed to load mode: ${modeKey}`); window.HHA._busy=false; return; }

    // systems
    R.sys.score = new (ScoreSystem||function(){})(); R.sys.score.reset?.();
    R.sys.sfx = new (SFXClass||function(){})(); setScore(0);

    // HUD
    const hud = {
      setTarget(g,have,need){
        const el = document.getElementById('targetBadge'); const wrap = document.getElementById('targetWrap');
        if (!el || !wrap) return;
        const nameTH = ({veggies:'ผัก', protein:'โปรตีน', grains:'ธัญพืช', fruit:'ผลไม้', dairy:'นม'})[g] || g;
        el.textContent = `${nameTH} • ${have|0}/${need|0}`; wrap.style.display='inline-flex';
      },
      dimPenalty(){ document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 120); }
    };
    try { Quests.bindToMain({ hud }); } catch {}

    // mode init (prefer factory)
    R.modeKey = modeKey; R.modeAPI = api; R.hud = hud;
    R.state = { difficulty: diff, lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    if (api.create){
      R.modeInst = api.create({ engine:{ fx:FX }, hud, coach:{
        onStart(){ showCoach('Go!'); setTimeout(hideCoach,800); },
        onGood(){}, onBad(){}, onPerfect(){ showCoach('Perfect!'); setTimeout(hideCoach,500); }
      }});
      R.modeInst.start?.();
    } else if (api.init){
      api.init(R.state, hud, { time:45, life:1600 });
      showCoach('Go!'); setTimeout(hideCoach,800);
    }

    try { Quests.beginRun(modeKey, diff, (R.state.lang||'TH'), 45); } catch {}
    try { Progress.beginRun(modeKey, diff, (R.state.lang||'TH')); } catch {}

    R.playing = true; R.startedAt = performance.now();
    R._secMark = performance.now(); R._dtMark = performance.now();
    R.remain = 45; setTime(R.remain);

    // hide menu & run
    document.body.setAttribute('data-playing','1');
    const menu = $('#menuBar'); if (menu) menu.setAttribute('data-hidden','1');
    R.raf = requestAnimationFrame(gameTick);
  }

  function toast(text){ let el = $('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200); }

  // expose
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame = endGame;

  // safety
  setTimeout(()=>{ const c = document.getElementById('c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } }, 0);
})();
