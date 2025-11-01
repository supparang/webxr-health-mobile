// === Hero Health Academy — game/main.js (runtime glue; Start wired + Coach integrated) ===
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
    catch { SFXClass = class{ constructor(){ this.enabled=true; } setEnabled(v){this.enabled=!!v;} isEnabled(){return !!this.enabled} play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }

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
        _ensureHUD(){ this.hud = $('#coachHUD') || Object.assign(document.createElement('div'),{id:'coachHUD',className:'coach'});
          if(!$('#coachHUD')){ const t=document.createElement('span'); t.id='coachText'; this.hud.appendChild(t); (document.getElementById('hudWrap')||document.body).appendChild(this.hud); }
          this.txt = $('#coachText');
          Object.assign(this.hud.style,{position:'fixed',right:'10px',bottom:'10px',zIndex:55,display:'none',background:'#0f1e38',border:'1px solid #16325d',borderRadius:'10px',padding:'6px 10px'});
        }
        say(m){ if(this.txt){ this.txt.textContent=m||''; this.hud.style.display='flex'; setTimeout(()=>{ this.hud.style.display='none'; },1400);} }
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

  // --------- HUD helpers ----------
  function setScore(v){ const el = $('#scoreVal'); if (el) el.textContent = v|0; }
  function setTime(v){ const el = $('#time');    if (el) el.textContent = v|0; }

  // --------- Engine state ----------
  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, hud:null, coach:null,
    diff:'Normal'
  };

  function busFor(){
    return {
      sfx: R.sys.sfx,
      hit(e){
        if (e?.points) R.sys.score.add(e.points);
        setScore(R.sys.score.get?.() || R.sys.score.value || 0);
        if (e?.ui) FX.popText(`+${e.points||0}`, e.ui);
        if (e?.kind==='perfect') R.coach?.onPerfect(); else if (e?.kind==='good') R.coach?.onGood();
        Quests.event('hit', { result: e?.kind || 'good', meta: e?.meta || {} });
      },
      miss(){ /* soft miss */ }
    };
  }

  // --------- Main loop ----------
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
      if (R.modeInst && typeof R.modeInst.update === 'function') {
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

    const modeKey = R.modeKey;
    const diff    = R.diff;
    let api;
    try { api = await loadMode(modeKey); }
    catch (e) { console.error('[HHA] Failed to load mode:', modeKey, e); toast(`Failed to load mode: ${modeKey}`); window.HHA._busy = false; return; }

    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();
    setScore(0);

    // badges
    const mB = $('#modeBadge'); if (mB) mB.textContent = modeKey;
    const dB = $('#diffBadge'); if (dB) dB.textContent = diff;

    // HUD & Coach
    R.hud = {
      setTarget(g,have,need){
        const wrap = $('#targetWrap'); const badge=$('#targetBadge');
        if(!wrap||!badge) return;
        const mapTH = { veggies:'ผัก', fruits:'ผลไม้', grains:'ธัญพืช', protein:'โปรตีน', dairy:'นม' };
        badge.textContent = `${(mapTH[g]||g)} • ${have|0}/${need|0}`;
        wrap.style.display = 'inline-flex';
      },
      showHydration(){}, hideHydration(){},
      dimPenalty(){ document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 120); },
      setQuestChips(){}, markQuestDone(){},
    };

    R.coach = new CoachClass({ lang: (localStorage.getItem('hha_lang')||'TH') });
    R.coach.onStart();

    try { Quests.bindToMain({ hud: R.hud, coach: R.coach }); } catch {}

    R.state = { difficulty: diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    R.modeAPI = api;

    if (api.create){
      R.modeInst = api.create({
        engine:{ fx:FX },
        hud: R.hud,
        coach: R.coach
      });
      R.modeInst.start?.();
    } else if (api.init){
      api.init(R.state, R.hud, { time: 45, life: 1600 });
    }

    try { Quests.beginRun(modeKey, diff, (R.state.lang||'TH'), 45); } catch {}
    try { Progress.beginRun(modeKey, diff, (R.state.lang||'TH')); } catch {}

    R.playing = true;
    R.startedAt = performance.now();
    R._secMark = performance.now();
    R._dtMark  = performance.now();
    R.remain = 45;
    setTime(R.remain);

    document.body.setAttribute('data-playing','1');
    $('#menuBar')?.setAttribute('data-hidden','1');

    R.raf = requestAnimationFrame(gameTick);
  }

  function toast(text){
    let el = $('#toast');
    if(!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 1200);
  }

  // --------- NEW: Strong event delegation for menu (no need for id="btn_start") ----------
  (function bindMenuDelegation(){
    const mb = document.getElementById('menuBar');
    if (!mb) return;

    function setActive(listSel, el){
      $$(listSel).forEach(b=>b.classList.remove('active'));
      el.classList.add('active');
    }

    mb.addEventListener('click', (ev)=>{
      const t = ev.target.closest('.btn');
      if (!t) return;

      // Mode
      if (t.hasAttribute('data-mode')) {
        ev.preventDefault(); ev.stopPropagation();
        R.modeKey = t.getAttribute('data-mode') || R.modeKey;
        setActive('[data-mode]', t);
        const mB = $('#modeBadge'); if (mB) mB.textContent = R.modeKey;
        return;
      }

      // Difficulty
      if (t.hasAttribute('data-diff')) {
        ev.preventDefault(); ev.stopPropagation();
        R.diff = t.getAttribute('data-diff') || R.diff;
        setActive('[data-diff]', t);
        const dB = $('#diffBadge'); if (dB) dB.textContent = R.diff;
        return;
      }

      // Actions
      if (t.dataset.action === 'howto') {
        ev.preventDefault(); ev.stopPropagation();
        toast('แตะอาหารดี หลีกเลี่ยงของไม่ดี ภายใน 45 วินาที • เปลี่ยนโหมด/ความยากก่อนเริ่ม');
        return;
      }
      if (t.dataset.action === 'sound') {
        ev.preventDefault(); ev.stopPropagation();
        try{
          const now = R.sys?.sfx?.isEnabled?.() ?? true;
          R.sys?.sfx?.setEnabled?.(!now);
          t.textContent = (!now) ? '🔊 Sound' : '🔇 Sound';
          // เผื่อใช้แท็ก <audio> ตรง ๆ
          const tags = document.querySelectorAll('audio');
          tags.forEach(a=>{ try{ a.muted = now; }catch{} });
          toast((!now)?'เสียง: เปิด':'เสียง: ปิด');
        }catch{}
        return;
      }
      if (t.dataset.action === 'start') {
        ev.preventDefault(); ev.stopPropagation();
        startGame();
        return;
      }
    }, false);

    // รองรับแตะบนมือถือ
    mb.addEventListener('pointerup', (e)=>{
      const t = e.target.closest('.btn[data-action="start"]');
      if (t){ e.preventDefault(); startGame(); }
    }, { passive:false });
  })();

  // --------- Expose ----------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // Canvas never blocks UI
  setTimeout(()=>{ const c = $('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } }, 0);

  // Keyboard start (Enter/Space)
  window.addEventListener('keydown', (e)=>{
    if ((e.key === 'Enter' || e.key === ' ') && !R.playing){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if (menuVisible) { e.preventDefault(); startGame(); }
    }
  }, { passive:false });

})();
