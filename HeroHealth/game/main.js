// === Hero Health Academy — game/main.js (Mini-Quest + Combo + Fever + Coach + Result) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, HUDClass;

  async function loadCore() {
    ({ ScoreSystem } = await import('./core/score.js').catch(()=>({ScoreSystem:null}))) || (ScoreSystem = (await import('./core/score.js')).ScoreSystem);
    try { ({ HUD } = await import('./core/hud.js')); HUDClass = HUD; } catch { HUDClass = class{ setTop(){} setQuestChips(){} say(){} showResult(){} hideResult(){} }; }
    try { ({ Quests } = await import('./core/quests.js')); } catch { Quests = { bindToMain(){return{refresh(){}}}, beginRun(){}, event(){}, tick(){}, endRun(){return[]} }; }
    try { ({ Coach: CoachClass } = await import('./core/coach.js')); } catch { CoachClass = class{ constructor(){this.lang='TH'} onStart(){} onEnd(){}}; }
    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); } catch { SFXClass = class{ isEnabled(){return true} setEnabled(){} good(){} bad(){} perfect(){} power(){} }; }
    try { ({ Progress } = await import('./core/progression.js')); } catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){} }; }
    try { ({ VRInput } = await import('./core/vrinput.js')); } catch { VRInput = { init(){}, isXRActive(){return false} }; }
  }

  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key){ const m = await import(MODE_PATH(key)); return m; }

  // --------- Engine state ----------
  let R={ playing:false, startedAt:0, remain:45, raf:0,
          sys:{score:null,sfx:null}, hud:null, coach:null,
          modeKey:'goodjunk', diff:'Normal', modeAPI:null, modeInst:null };

  function setHUD(){
    R.hud?.setTop?.({
      mode: R.modeKey, diff: R.diff, time: R.remain|0,
      score: R.sys.score?.get?.()||0, combo: R.sys.score?.combo|0,
      feverPct: R.sys.score?.fever?.charge|0, feverOn: !!R.sys.score?.fever?.active
    });
    // mirror badges on index (เผื่อยังใช้)
    $('#modeBadge') && ( $('#modeBadge').textContent = R.modeKey );
    $('#diffBadge') && ( $('#diffBadge').textContent = R.diff );
    $('#scoreVal')  && ( $('#scoreVal').textContent  = R.sys.score?.get?.()||0 );
  }

  function busFor(){
    return {
      sfx: R.sys.sfx,
      hit(e){ // {kind:'good'|'perfect'|'bad', points, ui, meta:{tag}, comboNow?}
        const kind = e?.kind||'good';
        const base = (kind==='bad') ? -5 : (kind==='perfect'?15:10);
        const feverBonus = R.sys.score?.fever?.active ? 10 : 0;
        const pts = (e?.points!=null ? e.points : base) + feverBonus;

        // add & combo
        R.sys.score.add(pts, { kind });
        // quest event
        Quests.event('hit', { result: kind, meta: e?.meta||{}, comboNow: R.sys.score.combo|0 });

        // coach reactions
        if (kind==='perfect') R.coach?.onPerfect?.();
        else if (kind==='good') R.coach?.onGood?.();
        else R.coach?.onBad?.();

        // auto-activate fever when charged
        if (R.sys.score.tryActivateFever?.()) {
          document.body.classList.add('fever-on');
          R.coach?.onFever?.();
          setTimeout(()=>document.body.classList.remove('fever-on'), 200);
        }

        setHUD();
      },
      miss(){
        R.sys.score.add(0, {kind:'bad'});
        Quests.event('hit', { result:'bad', meta:{} , comboNow: R.sys.score.combo|0 });
        setHUD();
      }
    };
  }

  function gameTick(){
    if (!R.playing) return;
    const tNow = performance.now();
    const dt = (tNow - (R._dtMark||tNow))/1000; R._dtMark = tNow;

    // second countdown
    const gone = Math.floor((tNow - (R._secMark||tNow))/1000);
    if (gone >= 1){
      R.remain = Math.max(0, (R.remain|0) - gone);
      R._secMark = tNow;
      if (R.remain === 10) R.coach?.onTimeLow?.();
      Quests.tick({ score: R.sys.score.get?.()||0 });
    }

    // score tick (fever time)
    R.sys.score.tick?.(dt);

    // mode update
    try{
      if (R.modeInst?.update) R.modeInst.update(dt, busFor());
      else if (R.modeAPI?.update) R.modeAPI.update(dt, busFor());
      else if (R.modeAPI?.tick)   R.modeAPI.tick(R.state||{}, R.sys, R.hud||{});
    }catch(e){ console.warn('[mode.update] error', e); }

    setHUD();

    if (R.remain <= 0) return endGame();
    R.raf = requestAnimationFrame(gameTick);
  }

  function endGame(){
    if (!R.playing) return;
    R.playing = false;
    cancelAnimationFrame(R.raf);

    const score = R.sys.score?.get?.()||0;
    const bestC = R.sys.score?.bestCombo|0;

    try{ Quests.endRun?.({ score }); }catch{}
    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state, R.hud); }catch{}

    document.body.removeAttribute('data-playing');
    $('#menuBar')?.removeAttribute('data-hidden');

    R.coach?.onEnd?.(score);
    Progress.endRun?.({ score, bestCombo:bestC });

    // Result
    R.hud?.showResult?.({
      title:'Result',
      desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
      stats:[`Score: ${score}`, `Best Combo: ${bestC}`, `Time: ${R._matchTime|0}s`]
    });
    R.hud.onHome  = ()=>{ R.hud.hideResult(); $('#menuBar')?.removeAttribute('data-hidden'); };
    R.hud.onRetry = ()=>{ R.hud.hideResult(); startGame(); };

    window.HHA._busy=false;
  }

  const TIME_BY_MODE={ goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode='goodjunk', diff='Normal'){
    const base = TIME_BY_MODE[mode]??45;
    if (diff==='Easy') return base+5;
    if (diff==='Hard') return Math.max(20, base-5);
    return base;
  }

  async function startGame(){
    if (window.HHA?._busy) return;
    window.HHA._busy = true;

    await loadCore();
    Progress.init?.();

    // HUD
    if (!R.hud){ R.hud = new HUDClass(); window.__HHA_HUD_API = R.hud; }

    // read menu choices
    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';
    R._matchTime = getMatchTime(R.modeKey, R.diff);
    R.remain = R._matchTime|0;

    // systems
    R.sys.score = new ScoreSystem();
    R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();

    // coach
    R.coach = new CoachClass({ lang: (localStorage.getItem('hha_lang')||'TH') });
    R.coach.onStart?.();

    // quests
    Quests.bindToMain({ hud: R.hud, coach: R.coach });
    Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH').toUpperCase(), R._matchTime);

    // mode
    let api;
    try{ api = await loadMode(R.modeKey); }catch(e){ console.error('[mode load]', e); toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy=false; return; }
    R.modeAPI = api;
    if (api.create){
      R.modeInst = api.create({ hud: R.hud, coach: R.coach });
      R.modeInst.start?.({ time: R._matchTime });
    } else if (api.init){
      api.init({ difficulty:R.diff }, R.hud, { time:R._matchTime, life:1500 });
    }

    setHUD();

    // show gameplay
    R.playing = true;
    R.startedAt = performance.now();
    R._secMark  = performance.now();
    R._dtMark   = performance.now();

    $('#menuBar')?.setAttribute('data-hidden','1');
    requestAnimationFrame(gameTick);
  }

  function toast(text){
    let el = $('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 1200);
  }

  // Menu delegation + Start guard
  (function bindMenuDelegation(){
    const mb = $('#menuBar'); if (!mb) return;
    function setActive(sel,el){ $$(sel).forEach(b=>b.classList.remove('active')); el.classList.add('active'); }
    mb.addEventListener('click', (ev)=>{
      const t = ev.target.closest('.btn'); if (!t) return;
      if (t.hasAttribute('data-mode')){ setActive('[data-mode]', t); document.body.setAttribute('data-mode', t.getAttribute('data-mode')); return; }
      if (t.hasAttribute('data-diff')){ setActive('[data-diff]', t); document.body.setAttribute('data-diff', t.getAttribute('data-diff')); return; }
      if (t.dataset.action==='howto'){ toast('แตะของดี เลี่ยงของไม่ดี • เคลียร์ภารกิจทีละอัน • เติมเกจให้เต็มเพื่อเข้า FEVER'); return; }
      if (t.dataset.action==='sound'){
        const A = [...document.querySelectorAll('audio')]; const anyOn = A.some(a=>!a.muted);
        A.forEach(a=>{ try{ a.muted = anyOn; }catch{} }); t.textContent = anyOn ? '🔇 Sound' : '🔊 Sound'; toast(anyOn?'เสียง: ปิด':'เสียง: เปิด'); return;
      }
      if (t.dataset.action==='start'){ ev.preventDefault(); startGame(); return; }
    }, false);
    mb.addEventListener('pointerup', e=>{ const t=e.target.closest('.btn[data-action="start"]'); if (t){ e.preventDefault(); startGame(); } }, {passive:false});
  })();

  // Expose
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;

  // Keyboard start
  window.addEventListener('keydown', (e)=>{
    if ((e.key==='Enter'||e.key===' ') && !R.playing){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if (menuVisible){ e.preventDefault(); startGame(); }
    }
  }, {passive:false});

})();
