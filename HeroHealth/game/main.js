// === Hero Health Academy — game/main.js (runtime glue; Start/Coach wired, hub-safe) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ---------- Ensure required hosts exist (spawn + layer + HUD bits) ----------
  function ensureHost() {
    if (!$('#gameLayer')) {
      const layer = document.createElement('div');
      layer.id = 'gameLayer';
      layer.style.cssText = 'position:fixed;inset:0;z-index:28;pointer-events:none;';
      document.body.appendChild(layer);
    }
    if (!$('#spawnHost')) {
      const host = document.createElement('div');
      host.id = 'spawnHost';
      host.style.cssText = 'position:fixed;inset:0;z-index:29;pointer-events:none;';
      document.body.appendChild(host);
    }
    if (!$('#toast')) {
      const t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    if (!$('#coachHUD')) {
      const c = document.createElement('div');
      c.id = 'coachHUD';
      c.className = 'coachHUD';
      c.style.cssText = 'position:fixed;left:50%;top:8%;transform:translateX(-50%);display:none;z-index:96';
      const b = document.createElement('div');
      b.id = 'coachText';
      b.style.cssText = 'font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;padding:8px 12px;background:rgba(0,0,0,.45);border-radius:12px;';
      b.textContent = 'Ready?';
      c.appendChild(b);
      document.body.appendChild(c);
    }
    if (!$('#targetWrap')) {
      const t = document.createElement('div');
      t.id = 'targetWrap';
      t.style.cssText = 'position:fixed;left:50%;top:4%;transform:translateX(-50%);z-index:94;display:none;';
      document.body.appendChild(t);
    }
    if (!$('#score')) {
      const s = document.createElement('span'); s.id = 'score'; s.textContent = '0';
      const w = document.createElement('div'); w.id = 'hudWrap';
      w.style.cssText = 'position:fixed;right:10px;top:10px;z-index:95;font:900 14px ui-rounded;color:#fff;text-shadow:0 2px 8px #000;';
      const time = document.createElement('span'); time.id = 'time'; time.textContent = '45';
      w.innerHTML = '⏱ <span id="time">45</span> • ⭐ <span id="score">0</span>';
      document.body.appendChild(w);
    }
  }
  ensureHost();

  // ---------- Safe stubs (จะถูกแทนที่เมื่อ import ได้) ----------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput;
  async function loadCore() {
    try { ({ ScoreSystem } = await import('./core/score.js')); } catch { ScoreSystem = class{ constructor(){this.v=0;} add(n=0){this.v+=n;} get(){return this.v|0;} reset(){this.v=0;} }; }
    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); } catch { SFXClass = class{ play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }
    try { ({ Quests } = await import('./core/quests.js')); } catch { Quests = { beginRun(){}, event(){}, tick(){}, endRun(){return[]}, bindToMain(){return{refresh(){}}} }; }
    try { ({ Progress } = await import('./core/progression.js')); } catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }
    try { ({ VRInput } = await import('./core/vrinput.js')); } catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} }; }
  }

  // ---------- Mode loader ----------
  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key) {
    const mod = await import(MODE_PATH(key));
    return {
      name:     mod.name || key,
      create:   mod.create || null,
      init:     mod.init   || null,
      tick:     mod.tick   || null,
      pickMeta: mod.pickMeta || null,
      onHit:    mod.onHit    || null,
      cleanup:  mod.cleanup  || null,
      fx:       mod.fx || {}
    };
  }

  // ---------- FX helper ----------
  const FX = {
    popText(txt, { x, y, ms = 700 } = {}) {
      const el = document.createElement('div');
      el.textContent = txt;
      el.style.cssText = `
        position:fixed; left:${x|0}px; top:${y|0}px; transform:translate(-50%,-50%);
        font:900 16px ui-rounded,system-ui; color:#fff; text-shadow:0 2px 10px #000;
        pointer-events:none; z-index:97; opacity:1; transition:all .72s ease-out;
      `;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.top = (y-36)+'px'; el.style.opacity='0'; });
      setTimeout(()=>el.remove(), ms);
    }
  };

  // ---------- HUD / Coach ----------
  function setScore(v){ const el = $('#score'); if (el) el.textContent = v|0; }
  function setTime(v){  const el = $('#time');  if (el) el.textContent = v|0; }
  function showCoach(txt){
    const hud=$('#coachHUD'); const t=$('#coachText');
    if (t) t.textContent = txt || 'Ready?';
    if (hud){ hud.style.display='flex'; hud.classList.add('show'); }
  }
  function hideCoach(){ const hud=$('#coachHUD'); if(hud){ hud.classList.remove('show'); hud.style.display='none'; } }
  function toast(text){
    let el = $('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 1200);
  }

  // ---------- Engine loop ----------
  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeAPI:null, modeInst:null,
    modeKey:'goodjunk', diff:'Normal', state:null, hud:null
  };

  function busFor(){
    return {
      sfx: R.sys.sfx,
      hit(e){
        if (e?.points) R.sys.score.add(e.points);
        setScore(R.sys.score.get?.() || R.sys.score.v || 0);
        if (e?.ui) FX.popText(`+${e.points||0}`, e.ui);
        Quests.event('hit', { result: e?.kind || 'good', comboNow: 0, meta: e?.meta || {} });
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
      Quests.tick({ score: (R.sys.score.get?.()||0) });
    }
    try{
      if (R.modeInst && typeof R.modeInst.update === 'function') {
        const dt = (tNow - (R._dtMark||tNow)) / 1000;
        R._dtMark = tNow;
        R.modeInst.update(dt, busFor());
      } else if (R.modeAPI?.tick) {
        R.modeAPI.tick(R.state||{}, R.sys, R.hud||{});
      }
    }catch(e){ console.warn('[mode.update] error', e); }

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
    showCoach('Nice run!'); setTimeout(hideCoach, 1000);

    try { Progress.endRun({ score: R.sys.score.get?.()||0 }); } catch {}
    window.HHA._busy = false;
  }

  async function startGame(){
    if (window.HHA?._busy) return;
    window.HHA._busy = true;

    ensureHost();
    await loadCore();
    Progress.init?.();

    // reflect selected mode/diff from hub
    const modeKey = window.__HHA_MODE || document.body.getAttribute('data-mode') || 'goodjunk';
    const diff    = window.__HHA_DIFF || document.body.getAttribute('data-diff') || 'Normal';
    R.modeKey = modeKey; R.diff = diff;

    // CSS flags (for styles/groups.css etc.)
    document.body.setAttribute('data-mode', modeKey);
    document.documentElement.setAttribute('data-hha-mode', modeKey);

    // load mode
    let api;
    try { api = await loadMode(modeKey); }
    catch(e){ console.error('[HHA] mode load fail', modeKey, e); toast(`Failed to load mode: ${modeKey}`); window.HHA._busy=false; return; }

    // systems
    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.sfx = new (SFXClass||function(){})();
    setScore(0);

    // HUD
    const hud = {
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
    try { Quests.bindToMain({ hud }); } catch {}

    // state
    R.modeAPI = api; R.hud = hud;
    R.state = { difficulty: diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };

    // Coach visible from start
    showCoach('Go!');

    // Start mode: prefer factory adapter
    if (api.create){
      R.modeInst = api.create({ engine:{ fx:FX }, hud, coach:{
        onStart(){}, onGood(){}, onBad(){},
        onPerfect(){ showCoach('Perfect!'); setTimeout(hideCoach, 500); }
      }});
      R.modeInst.start?.();
    } else if (api.init){
      api.init(R.state, hud, { time:45, life:1600 });
    }

    try { Quests.beginRun(modeKey, diff, (R.state.lang||'TH'), 45); } catch {}
    try { Progress.beginRun(modeKey, diff, (R.state.lang||'TH')); } catch {}

    // countdown & loop
    R.playing = true;
    R.startedAt = performance.now();
    R._secMark  = performance.now();
    R._dtMark   = performance.now();
    R.remain    = 45;
    setTime(R.remain);

    // hide menu
    document.body.setAttribute('data-playing','1');
    $('#menuBar')?.setAttribute('data-hidden','1');

    // allow clicks on spawn host
    $('#spawnHost') && ($('#spawnHost').style.pointerEvents = 'auto');

    R.raf = requestAnimationFrame(gameTick);
  }

  // ---------- Hub button bindings (fallback if ui.js not present) ----------
  function bindHub() {
    // Mode buttons
    [['goodjunk','m_goodjunk'],['groups','m_groups'],['hydration','m_hydration'],['plate','m_plate']].forEach(([key,id])=>{
      const el = $('#'+id);
      el && el.addEventListener('click', ()=>{ window.__HHA_MODE = key; document.body.setAttribute('data-mode', key); });
    });
    // Difficulty
    [['Easy','d_easy'],['Normal','d_normal'],['Hard','d_hard']].forEach(([v,id])=>{
      const el = $('#'+id);
      el && el.addEventListener('click', ()=>{ window.__HHA_DIFF = v; document.body.setAttribute('data-diff', v); });
    });
    // Start
    const startBtn = $('#btn_start');
    if (startBtn){
      // unbind old then bind
      const btn = startBtn.cloneNode(true);
      startBtn.parentNode.replaceChild(btn, startBtn);
      btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); }, {capture:true});
    }
    // Restart (optional)
    $('#btn_restart')?.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); endGame(); startGame(); });
    // Keyboard: Esc to end
    window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') endGame(); });
  }
  bindHub();

  // ---------- Export globals ----------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // ---------- Safety: canvas layer must not block UI ----------
  setTimeout(()=>{ const c = $('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } }, 0);

})();
