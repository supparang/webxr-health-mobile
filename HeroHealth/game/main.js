// === Hero Health Academy — game/main.js (Start-guard + Menu-hide + HUD/canvas click-safe) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

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

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch { // fallback coach
      CoachClass = class {
        constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase(); this._hudEl=null; this._txt=null; this._ensure(); }
        _ensure(){ this._hudEl = $('#coachHUD') || Object.assign(document.createElement('div'),{id:'coachHUD',className:'coach'}); if(!$('#coachHUD')){ const t=document.createElement('span'); t.id='coachText'; this._hudEl.appendChild(t); (document.getElementById('hudWrap')||document.body).appendChild(this._hudEl);} this._txt = $('#coachText'); }
        say(m){ if(this._txt){ this._txt.textContent=m||''; this._hudEl.style.display='flex'; setTimeout(()=>{ this._hudEl.style.display='none'; },1300);} }
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
      fx: mod.fx || {},
      update: mod.update || null
    };
  }

  // --------- HUD helpers ----------
  function setScore(v){ const el = $('#scoreVal'); if (el) el.textContent = v|0; }
  function setBadges(mode,diff){ $('#modeBadge')&&( $('#modeBadge').textContent=mode ); $('#diffBadge')&&( $('#diffBadge').textContent=diff ); }

  // --------- Engine state ----------
  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, hud:null, coach:null,
    diff:'Normal'
  };

  function busFor(){ // event bus for modes
    return {
      sfx: R.sys.sfx,
      hit(e){ // {kind, points, ui:{x,y}}
        if (e?.points) R.sys.score.add(e.points);
        setScore(R.sys.score.get?.() || R.sys.score.value || 0);
        Quests.event?.('hit', { result: e?.kind || 'good', meta: e?.meta || {} });
        if (e?.kind==='perfect') R.coach?.onPerfect?.(); else if (e?.kind==='good') R.coach?.onGood?.();
      },
      miss(){ /* soft miss */ }
    };
  }

  // --------- Loop ----------
  function gameTick(){
    if (!R.playing) return;
    const tNow = performance.now();

    // second tick
    const secGone = Math.floor((tNow - (R._secMark||tNow))/1000);
    if (secGone >= 1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      R._secMark = tNow;
      const tBadge = $('#missionLine'); if (tBadge) tBadge.textContent = `⏱ ${R.remain|0}s`;
      if (R.remain === 10) R.coach?.onTimeLow?.();
      Quests.tick?.({ score: (R.sys.score.get?.()||0) });
    }

    // mode update
    try {
      const dt = (tNow - (R._dtMark||tNow))/1000; R._dtMark = tNow;
      if (R.modeInst?.update) R.modeInst.update(dt, busFor());
      else if (R.modeAPI?.update) R.modeAPI.update(dt, busFor());
      else if (R.modeAPI?.tick) R.modeAPI.tick(R.state||{}, R.sys, R.hud||{});
    } catch(e){ console.warn('[mode.update] error', e); }

    if (R.remain <= 0) return endGame(false);
    R.raf = requestAnimationFrame(gameTick);
  }

  function endGame(){
    if (!R.playing) return;
    R.playing = false;
    cancelAnimationFrame(R.raf);

    try { Quests.endRun?.({ score: R.sys.score.get?.()||0 }); } catch {}
    try { R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state, R.hud); } catch {}

    document.body.removeAttribute('data-playing');
    $('#menuBar')?.removeAttribute('data-hidden');

    R.coach?.onEnd?.(R.sys.score.get?.()||0);
    try { Progress.endRun?.({ score: R.sys.score.get?.()||0 }); } catch {}

    window.HHA._busy = false;
  }

  async function startGame(){
    if (window.HHA?._busy) return;
    window.HHA._busy = true;

    await loadCore();
    Progress.init?.();

    // read selected mode/diff from body (ถูกตั้งจากเมนู)
    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';
    setBadges(R.modeKey,R.diff);

    // load mode
    let api;
    try { api = await loadMode(R.modeKey); }
    catch (e) { console.error('[HHA] Failed to load mode:', R.modeKey, e); toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy = false; return; }

    // systems
    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();

    // coach
    try{ R.coach = new CoachClass({ lang: (localStorage.getItem('hha_lang')||'TH') }); R.coach.onStart?.(); }
    catch(e){ console.warn('Coach init failed', e); R.coach = {onStart(){},onEnd(){}}; }

    // basic HUD proxy to top badges already in index
    R.hud = {
      setTarget(g,have,need){
        const el = $('#targetWrap'); if(!el) return;
        const mapTH = { veggies:'ผัก', fruits:'ผลไม้', grains:'ธัญพืช', protein:'โปรตีน', dairy:'นม' };
        el.textContent = `${mapTH[g]||g} • ${have|0}/${need|0}`;
        el.style.display = 'inline-flex';
      },
      showHydration(){}, hideHydration(){},
      setQuestChips(){}, markQuestDone(){},
    };

    // state
    R.state = { difficulty: R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    R.modeAPI = api;

    // start mode
    if (api.create){
      R.modeInst = api.create({ engine:{}, hud:R.hud, coach:R.coach });
      R.modeInst.start?.({ time:45 });
    } else if (api.init){
      api.init(R.state, R.hud, { time: 45, life: 1600 });
    }

    Quests.beginRun?.(R.modeKey, R.diff, (R.state.lang||'TH'), 45);
    Progress.beginRun?.(R.modeKey, R.diff, (R.state.lang||'TH'));

    // show game
    R.playing = true;
    R.startedAt = performance.now();
    R._secMark = performance.now();
    R._dtMark  = performance.now();
    R.remain = 45;

    // ซ่อนเมนู + กัน HUD/canvas บังคลิก
    const menu = $('#menuBar'); if (menu) menu.setAttribute('data-hidden','1');
    const hudEl = $('#hud'); if (hudEl) { hudEl.style.pointerEvents='none'; hudEl.style.zIndex='2000'; }
    document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} });

    R.raf = requestAnimationFrame(gameTick);
  }

  // --------- Toast ----------
  function toast(text){
    let el = $('#toast');
    if(!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 1200);
  }

  // --------- Menu delegation + Start guards ----------
  function bindMenuDelegation(){
    const mb = $('#menuBar'); if (!mb) return;
    function setActive(sel, el){ $$(sel).forEach(b=>b.classList.remove('active')); el.classList.add('active'); }
    mb.addEventListener('click', (ev)=>{
      const t = ev.target.closest('.btn'); if (!t) return;
      if (t.hasAttribute('data-mode')){ setActive('[data-mode]', t); document.body.setAttribute('data-mode', t.getAttribute('data-mode')); return; }
      if (t.hasAttribute('data-diff')){ setActive('[data-diff]', t); document.body.setAttribute('data-diff', t.getAttribute('data-diff')); return; }
      if (t.dataset.action === 'howto'){ toast('แตะของดี เลี่ยงของไม่ดี ภายใน 45 วิ'); return; }
      if (t.dataset.action === 'sound'){
        const audios = Array.from(document.querySelectorAll('audio'));
        const anyUnmuted = audios.some(a=>!a.muted);
        audios.forEach(a=>{ try{ a.muted = anyUnmuted; }catch{} });
        t.textContent = anyUnmuted ? '🔇 Sound' : '🔊 Sound';
        toast(anyUnmuted?'เสียง: ปิด':'เสียง: เปิด');
        return;
      }
      if (t.dataset.action === 'start'){
        ev.preventDefault(); ev.stopPropagation();
        startGame();
        return;
      }
    }, false);

    // เสริม pointerup สำหรับมือถือ
    mb.addEventListener('pointerup', (e)=>{
      const t = e.target.closest('.btn[data-action="start"]');
      if (t){ e.preventDefault(); startGame(); }
    }, {passive:false});
  }

  // Binder ชั้นสุดท้ายแบบกันพลาด (กดได้แม้ main ยังไม่ bind)
  function bindStartStrong(){
    const btn = $('#btn_start'); if (!btn) return;
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
    const startNow = ()=>{
      try{
        if (window.HHA && typeof window.HHA.startGame === 'function'){ window.HHA.startGame(); return; }
      }catch{}
      // ถ้า HHA ยังไม่พร้อม ให้ import main.js ซ้ำหนึ่งครั้ง
      import(`./main.js?ts=${Date.now()}`).then(()=>{
        if (window.HHA && typeof window.HHA.startGame === 'function'){ window.HHA.startGame(); }
        else console.warn('⚠️ startGame() not ready after re-import');
      }).catch(e=>console.error('re-import main.js failed', e));
    };
    const opts = {capture:true, passive:false};
    ['click','pointerup','touchend'].forEach(ev=>{
      clone.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); startNow(); }, opts);
    });
    clone.addEventListener('keydown', (e)=>{ if (e.key==='Enter'||e.key===' '){ e.preventDefault(); startNow(); } }, opts);
  }

  // --------- Expose globals ----------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // กัน canvas/hud บัง
  setTimeout(()=>{ document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} }); $('#hud') && ($('#hud').style.pointerEvents='none'); }, 0);

  // ผูกเมนูและปุ่ม Start หลัง DOM พร้อม
  window.addEventListener('DOMContentLoaded', ()=>{
    bindMenuDelegation();
    bindStartStrong();
  });

  // Keyboard start (Enter/Space) เมื่อเมนูเปิดอยู่
  window.addEventListener('keydown', (e)=>{
    if ((e.key === 'Enter' || e.key === ' ') && !R.playing){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if (menuVisible) { e.preventDefault(); startGame(); }
    }
  }, { passive:false });

})();
