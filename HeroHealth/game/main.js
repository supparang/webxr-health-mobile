// === Hero Health Academy — game/main.js (2025-10-30, runtime glue++)
// - Score/Combo/HUD wired
// - Mini-Quest chips render via Quests.bindToMain({hud})
// - Start hides menu, shows HUD; Result modal with quest summary
// - Pause on blur, resume on focus
// - Coach integrated; popText FX
// - Safe fallbacks for core modules if imports fail

window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);

  // --------- Safe stubs (จะถูกแทนที่เมื่อ import ได้) ----------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass;

  async function loadCore() {
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{
      constructor(){ this.value=0; }
      add(n=0){ this.value+= (n|0); }
      get(){ return this.value|0; }
      reset(){ this.value=0; }
    }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = {
      beginRun(){}, event(){}, tick(){},
      endRun(){return[]},
      bindToMain(){ return { refresh(){} }; },
      setLang() {}
    }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }

    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = class {
        constructor(opts={}){ this.lang=(opts.lang || localStorage.getItem('hha_lang') || 'TH').toUpperCase(); this._ensureHUD(); }
        _ensureHUD(){
          let hud = $('#coachHUD');
          if (!hud){
            hud = document.createElement('div'); hud.id='coachHUD'; hud.className='coach';
            const t=document.createElement('span'); t.id='coachText'; hud.appendChild(t);
            (document.getElementById('hudWrap')||document.body).appendChild(hud);
          }
          this.txt = $('#coachText');
        }
        say(m){ if(this.txt){ this.txt.textContent=m||''; const h=$('#coachHUD'); h.style.display='flex'; setTimeout(()=>{ h.style.display='none'; },1200); } }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
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
      fx: mod.fx || {}
    };
  }

  // --------- Tiny FX helper ----------
  const FX = {
    popText(txt, { x, y, ms = 720 } = {}) {
      const el = document.createElement('div');
      el.textContent = txt || '';
      el.style.cssText = `
        position:fixed; left:${x|0}px; top:${y|0}px; transform:translate(-50%,-50%);
        font:900 16px ui-rounded, system-ui; color:#eaf6ff; text-shadow:0 2px 10px #000;
        pointer-events:none; z-index:120; opacity:1; transition: all .72s ease-out;`;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.top = (y - 32) + 'px'; el.style.opacity = '0'; });
      setTimeout(()=>{ try{ el.remove(); }catch{} }, ms);
    }
  };

  // --------- HUD helpers ----------
  function setScore(v){ const el = $('#score'); if (el) el.textContent = v|0; }
  function setTime(v){ const el = $('#time');  if (el) el.textContent = v|0; }
  function setCombo(v){ const el=$('#combo'); if(el) el.textContent = 'x'+(v|0); }

  // HUD facade for Quests.bindToMain
  const HudFacade = {
    setQuestChips(chips = []){
      const ul = document.getElementById('questChips'); if(!ul) return;
      ul.innerHTML = chips.map(q=>{
        const need=q.need|0, prog=Math.min(q.progress|0, need), pct=need?Math.round((prog/need)*100):0;
        const done=q.done?'done':''; const icon=q.icon||'⭐'; const label=q.label||q.id;
        return `<li class="${done}">
          <span class="qi">${icon}</span>
          <span class="ql">${label}</span>
          <span class="qp">${prog}/${need}</span>
          <span class="bar"><i style="width:${pct}%"></i></span>
        </li>`;
      }).join('');
    },
    markQuestDone(){},
    setTarget(group,have,need){
      const wrap = document.getElementById('targetWrap');
      const badge= document.getElementById('targetBadge');
      const mapTH = { veggies:'ผัก', fruits:'ผลไม้', grains:'ธัญพืช', protein:'โปรตีน', dairy:'นม' };
      if (wrap) wrap.style.display='inline-flex';
      if (badge) badge.textContent = `${(localStorage.getItem('hha_lang')||'TH').toUpperCase()==='EN'?group:(mapTH[group]||group)} • ${have|0}/${need|0}`;
    },
    showHydration(){}, hideHydration(){},
    dimPenalty(){ document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 120); }
  };

  // --------- Engine state ----------
  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    combo:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, coach:null
  };

  // --------- Bus for modes ----------
  function busFor(){
    return {
      sfx: R.sys.sfx,
      hit(e){ // {kind:'good'|'perfect'|'ok'|'bad', points, ui, meta}
        const kind = e?.kind || 'good';
        const pts  = e?.points|0;

        if (pts) R.sys.score.add(pts);
        setScore(R.sys.score.get?.() || 0);

        if (kind === 'bad'){ R.combo = 0; }
        else { R.combo = (R.combo|0) + 1; }
        setCombo(R.combo);

        if (e?.ui) FX.popText(`${pts>0?'+':''}${pts}${kind==='perfect'?' ✨':''}`, e.ui);
        if (kind==='perfect') R.coach?.onPerfect?.(); else if (kind==='good') R.coach?.onGood?.(); else R.coach?.onBad?.();

        // feed quests
        Quests.event('hit', { result: kind, meta: e?.meta || {}, comboNow: R.combo, score: (R.sys.score.get?.()||0) });
      },
      miss(e){
        R.combo = 0; setCombo(0);
        Quests.event('hit', { result: 'bad', meta: (e?.meta||{}), comboNow: 0, score: (R.sys.score.get?.()||0) });
      }
    };
  }

  // --------- UI helpers ----------
  function showHUD(){ const h=document.getElementById('hudWrap'); if(h) h.style.display='block'; }
  function hideHUD(){ const h=document.getElementById('hudWrap'); if(h) h.style.display='none'; }
  function showMenu(){ const m=document.getElementById('menuBar'); if(m){ m.style.display='block'; m.removeAttribute('data-hidden'); } hideHUD(); }
  function hideMenu(){ const m=document.getElementById('menuBar'); if(m){ m.style.display='none'; m.setAttribute('data-hidden','1'); } showHUD(); }

  function showResult(quests){
    const r = document.getElementById('result');
    const t = document.getElementById('resultText');
    const pb= document.getElementById('pbRow');
    if (t) t.textContent = `คะแนน ${R.sys.score.get?.()||0}`;
    if (pb) pb.innerHTML = (quests||[]).map(q=>{
      const mark = q.done ? '✅' : '❌';
      const lbl  = q.label || q.id;
      return `<li>${mark} ${lbl}</li>`;
    }).join('');
    if (r) r.style.display='flex';
  }
  function hideResult(){ const r=document.getElementById('result'); if(r) r.style.display='none'; }

  // --------- Main loop ----------
  function gameTick(){
    if (!R.playing) return;
    const tNow = performance.now();

    // second tick
    const secGone = Math.floor((tNow - R._secMark)/1000);
    if (secGone >= 1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      R._secMark = tNow;
      setTime(R.remain);

      if (R.remain === 10) R.coach?.onTimeLow?.();
      Quests.tick({ score: (R.sys.score.get?.()||0) });

      if (R.remain <= 0){ endGame(false); return; }
    }

    // mode update
    try {
      if (R.modeInst && typeof R.modeInst.update === 'function') {
        const dt = (tNow - (R._dtMark||tNow)) / 1000; R._dtMark = tNow;
        R.modeInst.update(dt, busFor());
      } else if (R.modeAPI?.tick) {
        R.modeAPI.tick(R.state||{}, R.sys, HudFacade);
      }
    } catch(e){ console.warn('[mode.update] error', e); }

    R.raf = requestAnimationFrame(gameTick);
  }

  function endGame(/*manual*/){
    if (!R.playing) return;
    R.playing = false;
    cancelAnimationFrame(R.raf);

    let quests=[];
    try { quests = Quests.endRun({ score: R.sys.score.get?.()||0 }) || []; } catch {}
    try { R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state, HudFacade); } catch {}

    document.body.removeAttribute('data-playing');
    showResult(quests);
    R.coach?.onEnd?.(R.sys.score.get?.()||0);
    try { Progress.endRun({ score: R.sys.score.get?.()||0 }); } catch {}

    window.HHA._busy = false;
  }

  async function startGame(){
    if (window.HHA?._busy) return;
    window.HHA._busy = true;

    await loadCore();
    Progress.init?.();

    // reflect chosen mode/diff from UI/attrs
    const modeKey = window.__HHA_MODE || (document.body.getAttribute('data-mode') || 'goodjunk');
    const diff    = window.__HHA_DIFF || (document.body.getAttribute('data-diff') || 'Normal');
    R.modeKey = modeKey;

    // load mode
    let api;
    try { api = await loadMode(modeKey); }
    catch (e) { console.error('[HHA] Failed to load mode:', modeKey, e); toast(`Failed to load mode: ${modeKey}`); window.HHA._busy = false; return; }

    // systems
    R.sys.score = new (ScoreSystem)(); R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass)();
    R.combo     = 0;
    setScore(0); setCombo(0);

    // Coach
    R.coach = new CoachClass({ lang: (localStorage.getItem('hha_lang')||'TH') });

    // bind Quests to HUD
    try { Quests.bindToMain({ hud: HudFacade, coach: R.coach }); } catch {}

    // state & API
    R.state = { difficulty: diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    R.modeAPI = api;

    // create or init mode
    if (api.create){
      R.modeInst = api.create({
        engine:{ fx:FX, score:{ add:(n)=>{ R.sys.score.add(n); setScore(R.sys.score.get?.()||0); } }, sfx:R.sys.sfx },
        hud: HudFacade,
        coach: R.coach
      });
      R.modeInst.start?.();
    } else if (api.init){
      api.init(R.state, HudFacade, { time: 45, life: 1600 });
    }

    // quests & progress
    try {
      const lang = (R.state.lang||'TH');
      Quests.setLang?.(lang);
      Quests.beginRun(modeKey, diff, lang, 45);
    } catch {}
    try { Progress.beginRun(modeKey, diff, (R.state.lang||'TH')); } catch {}

    // UI: hide menu, show HUD, clear field
    hideResult();
    hideMenu();
    const host = document.getElementById('spawnHost'); if (host) host.innerHTML='';
    const c = document.getElementById('c'); if (c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }

    // countdown start
    R.playing = true;
    R.startedAt = performance.now();
    R._secMark = performance.now();
    R._dtMark  = performance.now();
    R.remain = 45;
    setTime(R.remain);

    requestAnimationFrame(gameTick);
  }

  function toast(text){
    let el = document.getElementById('toast');
    if(!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 1200);
  }

  // --------- Expose & wire Start ----------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // Strong bind for Start (id="btn_start")
  (function bindStartStrong(){
    const b = document.getElementById('btn_start');
    if (!b) return;
    const clone = b.cloneNode(true);
    b.parentNode.replaceChild(clone, b);
    clone.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); }, {capture:true});
  })();

  // Enter/Space to start when menu visible
  window.addEventListener('keydown', (e)=>{
    if ((e.key === 'Enter' || e.key === ' ') && !R.playing){
      const menuVisible = (document.getElementById('menuBar')?.style.display !== 'none');
      if (menuVisible) { e.preventDefault(); startGame(); }
    }
  }, { passive:false });

  // Pause on blur / Resume on focus
  window.addEventListener('blur', ()=>{ if(R.playing){ R.playing=false; } });
  window.addEventListener('focus', ()=>{
    const menuShown   = (document.getElementById('menuBar')?.style.display !== 'none');
    const resultShown = (document.getElementById('result')?.style.display !== 'none');
    if(!menuShown && !resultShown){
      R.playing = true;
      R._secMark = performance.now();
      R._dtMark  = performance.now();
      requestAnimationFrame(gameTick);
    }
  });

})();
