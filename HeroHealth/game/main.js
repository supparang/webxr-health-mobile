// === Hero Health Academy — game/main.js (runtime glue; startGame wired) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

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
    // Load FX once for all modes (auto-hook)
    try { await import('./core/fx.js'); } catch {}
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

  // --------- Tiny FX helper ----------
  const FX = {
    popText(txt, { x, y, ms = 700 } = {}) {
      const el = document.createElement('div');
      el.textContent = txt;
      el.style.cssText = `
        position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);
        font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;
        pointer-events:none;z-index:97;opacity:1;transition:all .72s ease-out;`;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.top = (y - 36) + 'px'; el.style.opacity = '0'; });
      setTimeout(()=>el.remove(), ms);
    }
  };

  // --------- HUD / Coach ----------
  function setScore(v){ const el = $('#score'); if (el) el.textContent = v|0; }
  function setTime(v){ const el = $('#time');  if (el) el.textContent = v|0; }
  function showCoach(txt){ const hud=$('#coachHUD'); const t=$('#coachText'); if(t) t.textContent = txt||'Ready?'; if(hud){ hud.style.display='flex'; hud.classList.add('show'); } }
  function hideCoach(){ const hud=$('#coachHUD'); if(hud){ hud.classList.remove('show'); hud.style.display='none'; } }

  // --------- Engine state ----------
  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, hud:null
  };

  function busFor(){ 
    return {
      sfx: R.sys.sfx,
      hit(e){ // {kind, points, ui}
        if (e?.points) R.sys.score.add(e.points);
        setScore(R.sys.score.get?.() || R.sys.score.value || 0);
        if (e?.ui) FX.popText(`+${e.points||0}`, e.ui);
        Quests.event('hit', { result: e?.kind || 'good', comboNow: 0, meta: e?.meta || {} });
      },
      miss(){ /* soft no-op; quests handles streaks */ }
    };
  }

  // --------- DOM-spawn fallback (for legacy pickMeta/onHit modes) ----------
  function createLegacyDomSpawner(api){
    const host  = $('#spawnHost');
    const layer = $('#gameLayer');
    const Bus   = busFor();

    const S = {
      running:false, items:[], freezeUntil:0, _spawnCd:0.18,
      stats:{ good:0, perfect:0, bad:0, miss:0 }
    };

    function rect(){ return layer.getBoundingClientRect(); }
    function within(v, a, b){ return Math.max(a, Math.min(b, v)); }

    function spawnOne(){
      const meta = api.pickMeta?.({ life: 1600 }, R.state) || { char:'🍎', aria:'Apple', good:true, life:1600 };
      const r = rect();
      const pad = 40; // guard กับ transform:-50%,-50%
      const x = within(pad + Math.random()*(r.width  - pad*2), pad, r.width - pad);
      const y = within(pad + Math.random()*(r.height - pad*2), pad, r.height - pad);

      const b = document.createElement('button');
      b.className = 'spawn-emoji';
      b.type = 'button';
      b.style.left = x + 'px';
      b.style.top  = y + 'px';
      b.textContent = meta.char || '⭐';
      b.setAttribute('aria-label', meta.aria || 'item');
      if (meta.golden) b.setAttribute('data-golden','1');

      // hook click
      b.addEventListener('click', (ev)=>{
        if (!S.running) return;
        ev.stopPropagation();
        const res = api.onHit?.(meta, { score:R.sys.score, sfx:R.sys.sfx }, R.state, R.hud) || (meta.good?'good':'bad');
        const ui  = { x: ev.clientX, y: ev.clientY };
        if (res === 'good' || res === 'perfect'){
          const pts = (res==='perfect') ? 20 : 10;
          Bus.hit({ kind:res, points:pts, ui, meta });
        } else if (res === 'bad'){
          document.body.classList.add('flash-danger');
          setTimeout(()=>document.body.classList.remove('flash-danger'), 150);
          Bus.miss(); S.stats.bad++;
        }
        try { b.remove(); } catch {}
        S.items = S.items.filter(it=>it.el!==b);
      }, {passive:false});

      host.appendChild(b);
      S.items.push({ el:b, born:performance.now(), life: meta.life||1600, meta });
    }

    return {
      start(){
        this.stop();
        S.running = true;
        S.items.length = 0;
        S._spawnCd = 0.18;
        api.init?.(R.state, R.hud, { time:45, life:1600 }); // ให้โหมดตั้ง ctx/HUD
      },
      update(dt){
        if (!S.running) return;
        const now = performance.now();

        // spawn cadence (เร่งตอนท้าย)
        const timeLeft = (R.remain|0);
        const speedBias = timeLeft <= 15 ? 0.18 : 0;
        S._spawnCd -= dt;
        if (now >= S.freezeUntil && S._spawnCd <= 0){
          spawnOne();
          S._spawnCd = Math.max(0.26, 0.42 - speedBias + Math.random()*0.24);
        }

        // lifetime & miss
        const gone=[];
        for (const it of S.items){
          if (now - it.born > it.life){
            if (it.meta?.good) { Bus.miss(); S.stats.miss++; }
            try{ it.el.remove(); }catch{}
            gone.push(it);
          }
        }
        if (gone.length) S.items = S.items.filter(x=>!gone.includes(x));
      },
      cleanup(){
        S.running = false;
        try { S.items.forEach(it=>it.el.remove()); } catch {}
        S.items.length = 0;
        api.cleanup?.(R.state, R.hud);
      }
    };
  }

  // --------- Loop ----------
  function gameTick(){
    if (!R.playing) return;
    const tNow = performance.now();

    // countdown
    const secGone = Math.floor((tNow - R._secMark)/1000);
    if (secGone >= 1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      R._secMark = tNow;
      setTime(R.remain);
      Quests.tick({ score: (R.sys.score.get?.()||0) });
    }

    // update mode
    try {
      if (R.modeInst && typeof R.modeInst.update === 'function') {
        const dt = (tNow - (R._dtMark||tNow)) / 1000;
        R._dtMark = tNow;
        R.modeInst.update(dt);
      } else if (R.modeAPI?.tick) {
        R.modeAPI.tick(R.state||{}, R.sys, R.hud||{});
      }
    } catch(e){ console.warn('[mode.update] error', e); }

    if (R.remain <= 0) return endGame(false);
    R.raf = requestAnimationFrame(gameTick);
  }

  function endGame(/*manual*/){
    if (!R.playing) return;
    R.playing = false;
    cancelAnimationFrame(R.raf);
    try { Quests.endRun({ score: R.sys.score.get?.()||0 }); } catch {}
    try { R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state, R.hud); } catch {}
    document.body.removeAttribute('data-playing');
    $('#menuBar')?.removeAttribute('data-hidden');
    showCoach('Nice run!'); setTimeout(hideCoach, 1200);
    try { Progress.endRun({ score: R.sys.score.get?.()||0 }); } catch {}
    window.HHA._busy = false;
  }

  async function startGame(){
    if (window.HHA?._busy) return; window.HHA._busy = true;

    await loadCore();
    Progress.init?.();

    const modeKey = window.__HHA_MODE || (document.body.getAttribute('data-mode') || 'goodjunk');
    const diff    = window.__HHA_DIFF || 'Normal';
    document.body.setAttribute('data-mode', modeKey);  // <-- สำคัญ ให้ CSS อ้างอิง
    // (legacy attribute เผื่อไฟล์เก่ายังใช้)
    document.documentElement.setAttribute('data-hha-mode', modeKey);

    let api;
    try { api = await loadMode(modeKey); }
    catch (e) { console.error('[HHA] Failed to load mode:', modeKey, e); toast(`Failed to load mode: ${modeKey}`); window.HHA._busy=false; return; }

    // systems
    R.sys.score = new (ScoreSystem||function(){})(); R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();
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
    R.modeKey = modeKey; R.modeAPI = api; R.hud = hud;
    R.state = { difficulty: diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };

    // Coach cue
    showCoach('Go!');

    // prefer factory adapter; else use DOM-spawn fallback; else plain init
    if (api.create){
      R.modeInst = api.create({ engine:{ fx:FX }, hud, coach:{
        onStart(){}, onGood(){}, onBad(){},
        onPerfect(){ showCoach('Perfect!'); setTimeout(hideCoach, 520); }
      }});
      R.modeInst.start?.();
    } else if (api.pickMeta && api.onHit){
      R.modeInst = createLegacyDomSpawner(api);
      R.modeInst.start?.();
    } else if (api.init){
      api.init(R.state, hud, { time:45, life:1600 });
    }

    try { Quests.beginRun(modeKey, diff, (R.state.lang||'TH'), 45); } catch {}
    try { Progress.beginRun(modeKey, diff, (R.state.lang||'TH')); } catch {}

    // countdown & loop
    R.playing = true;
    R._secMark = R._dtMark = performance.now();
    R.remain = 45; setTime(R.remain);
    document.body.setAttribute('data-playing','1');
    $('#menuBar')?.setAttribute('data-hidden','1');
    R.raf = requestAnimationFrame(gameTick);
  }

  function toast(text){
    let el = $('#toast'); if(!el){ el = document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 1200);
  }

  // expose
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // guard: canvas not blocking clicks
  setTimeout(()=>{ const c = $('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } }, 0);
})();
