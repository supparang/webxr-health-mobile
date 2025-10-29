// === Hero Health Academy — game/main.js (runtime glue; Start wired) ===
window.__HHA_BOOT_OK = 'main';

(function(){
  const $ = s=>document.querySelector(s);
  const $$= s=>document.querySelectorAll(s);

  // --------- Safe imports (fallback stubs) ----------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput;

  async function loadCore(){
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0;} add(n=0){this.value+=n;} get(){return this.value|0;} reset(){this.value=0;} }; }
    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }
    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { beginRun(){}, event(){}, tick(){}, endRun(){return[]}, bindToMain(){return{refresh(){}}} }; }
    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }
    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} }; }
  }

  const MODE_PATH = k => `./modes/${k}.js`;
  async function loadMode(key){
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

  // Tiny FX popup
  const FX = {
    popText(txt, {x,y,ms=700}={}){
      const el = document.createElement('div');
      el.textContent = txt;
      el.style.cssText = `
        position:fixed; left:${x|0}px; top:${y|0}px; transform:translate(-50%,-50%);
        font:900 16px ui-rounded,system-ui; color:#fff; text-shadow:0 2px 10px #000;
        pointer-events:none; z-index:97; opacity:1; transition: all .72s ease-out;
      `;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.top = (y-36)+'px'; el.style.opacity='0'; });
      setTimeout(()=>el.remove(), ms);
    }
  };

  function setScore(v){ const el = $('#score'); if (el) el.textContent = v|0; }
  function setTime(v){ const el = $('#time'); if (el) el.textContent = v|0; }
  function showCoach(txt){
    const hud=$('#coachHUD'); const t=$('#coachText');
    if(t) t.textContent = txt || 'Ready?';
    if(hud){ hud.style.display='flex'; hud.classList.add('show'); }
  }
  function hideCoach(){
    const hud=$('#coachHUD');
    if(hud){ hud.classList.remove('show'); hud.style.display='none'; }
  }
  function toast(text){
    let el = $('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 1200);
  }

  // --------- Runtime state ----------
  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', modeAPI:null, modeInst:null,
    state:null, hud:null,
    _secMark:0, _dtMark:0
  };

  function busFor(){
    return {
      sfx: R.sys.sfx,
      hit(e){ // {kind, points, ui, meta}
        if (e?.points) R.sys.score.add(e.points);
        setScore(R.sys.score.get?.() || R.sys.score.value || 0);
        if (e?.ui) FX.popText(`+${e.points||0}`, e.ui);
        Quests.event('hit', { result: e?.kind || 'good', comboNow: 0, meta: e?.meta || {} });
      },
      miss(){ /* soft miss */ }
    };
  }

  function gameTick(){
    if (!R.playing) return;
    const now = performance.now();

    // 1s countdown & quests tick
    const secGone = Math.floor((now - R._secMark)/1000);
    if (secGone >= 1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      R._secMark = now;
      setTime(R.remain);
      try { Quests.tick({ score: (R.sys.score.get?.()||0) }); } catch {}
    }

    // mode update
    try {
      const dt = (now - (R._dtMark||now)) / 1000; R._dtMark = now;
      if (R.modeInst && typeof R.modeInst.update === 'function') {
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
    const menu = $('#menuBar'); menu?.removeAttribute('data-hidden');

    showCoach('Nice run!');
    setTimeout(hideCoach, 1200);

    try { Progress.endRun({ score: R.sys.score.get?.()||0 }); } catch {}
    window.HHA._busy = false;
  }

  async function startGame(){
    if (window.HHA?._busy) return;
    window.HHA._busy = true;

    await loadCore();
    Progress.init?.();

    R.modeKey = window.__HHA_MODE || (document.body.getAttribute('data-mode') || 'goodjunk');
    const diff = window.__HHA_DIFF || 'Normal';

    // Load mode module
    let api;
    try { api = await loadMode(R.modeKey); }
    catch (e){ console.error('[HHA] mode load fail', R.modeKey, e); toast('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }

    // Systems
    R.sys.score = new (ScoreSystem||function(){})(); R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();
    setScore(0);

    // HUD wiring (with Quests chips)
    const hud = {
      setTarget(g,have,need){
        const el = $('#targetWrap'); if(!el) return;
        const show = (R.modeKey === 'groups');
        el.style.display = show ? 'inline-flex' : 'none';
        if (!show) return;
        const mapTH = { veggies:'ผัก', fruits:'ผลไม้', grains:'ธัญพืช', protein:'โปรตีน', dairy:'นม' };
        el.textContent = `${mapTH[g]||g} • ${have|0}/${need|0}`;
      },
      setQuestChips(chips){
        const ul = $('#questChips'); if (!ul) return;
        if (!Array.isArray(chips) || !chips.length){ ul.innerHTML=''; return; }
        ul.innerHTML = chips.map(c=>{
          const pct = c.need ? Math.min(100, Math.round((c.progress|0) / (c.need|0) * 100)) : (c.done?100:0);
          const cls = c.done ? 'done' : (c.fail ? 'fail' : '');
          const lab = c.label || c.key;
          return `<li class="${cls}" data-key="${c.key}">
            <span class="ico">${c.icon||'⭐'}</span>
            <span class="lab">${lab}</span>
            <span class="bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
          </li>`;
        }).join('');
      },
      markQuestDone(qid){
        const li = document.querySelector(`#questChips li[data-key="${qid}"]`);
        if (!li) return;
        li.classList.add('done');
        li.style.transform='scale(1.06)';
        setTimeout(()=>{ li.style.transform=''; }, 160);
      },
      showHydration(){}, hideHydration(){},
      dimPenalty(){
        document.body.classList.add('flash-danger');
        setTimeout(()=>document.body.classList.remove('flash-danger'), 120);
      }
    };
    try { Quests.bindToMain({ hud }); } catch {}

    // Coach: show ready -> go
    showCoach('Ready?');

    // Prepare state & start
    R.modeAPI = api; R.hud = hud;
    R.state = { difficulty: diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };

    // Factory adapter first
    if (api.create){
      R.modeInst = api.create({
        engine:{ fx:FX },
        hud,
        coach:{
          onStart(){ showCoach('Go!'); setTimeout(hideCoach, 650); },
          onGood(){},
          onBad(){},
          onPerfect(){ showCoach('Perfect!'); setTimeout(hideCoach, 500); }
        }
      });
      R.modeInst.start?.();
    } else if (api.init){
      api.init(R.state, hud, { time:45, life:1600 });
      showCoach('Go!'); setTimeout(hideCoach, 650);
    }

    // Quests + profile
    try { Quests.beginRun(R.modeKey, diff, R.state.lang||'TH', 45); } catch {}
    try { Progress.beginRun(R.modeKey, diff, R.state.lang||'TH'); } catch {}

    // Countdown & loop
    R.playing = true;
    R._secMark = performance.now();
    R._dtMark  = performance.now();
    R.remain = 45; setTime(R.remain);

    // Hide menu when playing
    document.body.setAttribute('data-playing','1');
    $('#menuBar')?.setAttribute('data-hidden','1');

    R.raf = requestAnimationFrame(gameTick);

    // safety: scene canvas never blocks UI
    setTimeout(()=>{ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } }, 0);
  }

  // Expose API
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // Dev: log if Start covered
  setTimeout(()=>{
    const b = $('#btn_start'); if(!b) return;
    const r = b.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const top = document.elementsFromPoint(cx,cy)[0];
    if (top && top!==b) console.warn('[Overlay over Start]', top);
  }, 800);
})();
