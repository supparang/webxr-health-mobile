// === Hero Health Academy — game/main.js (robust Coach import + safe start) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // --------- Safe stubs ----------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass;

  // helper: โหลดโมดูลที่อาจ export มาได้หลายแบบ แล้วดึง "คลาส" ให้ได้แน่ ๆ
  async function importClass(path, preferName) {
    const mod = await import(path);
    let C = (preferName && mod?.[preferName]) ?? mod?.default ?? mod;
    if (typeof C === 'function') return C;
    throw new Error(`${path} does not export a class (${preferName || 'default'})`);
  }

  async function loadCore() {
    // Score
    try { ScoreSystem = await importClass('./core/score.js', 'ScoreSystem'); }
    catch { ScoreSystem = class{ constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n=0){this.value+=n;} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} }; }

    // SFX
    try {
      const mod = await import('./core/sfx.js');
      SFXClass = mod?.SFX ?? mod?.default ?? mod;
      if (typeof SFXClass !== 'function') throw 0;
    } catch { SFXClass = class{ constructor(){this.enabled=true;} setEnabled(v){this.enabled=!!v;} isEnabled(){return!!this.enabled} play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }

    // Quests / Progress / VRInput (ไม่พังเกมถ้าไม่มี)
    try { ({ Quests } = await import('./core/quests.js')); } catch { Quests={beginRun(){},event(){},tick(){},endRun(){return[]},bindToMain(){return{refresh(){}}}}; }
    try { ({ Progress } = await import('./core/progression.js')); } catch { Progress={init(){},beginRun(){},endRun(){},emit(){},getStatSnapshot(){return{}},profile(){return{}}}; }
    try { ({ VRInput } = await import('./core/vrinput.js')); } catch { VRInput={init(){},toggleVR(){},isXRActive(){return false},isGazeMode(){return false}}; }

    // ✅ Coach (robust)
    try { CoachClass = await importClass('./core/coach.js', 'Coach'); }
    catch {
      // very small fallback coach (ปลอดภัย ใช้ได้ทันที)
      CoachClass = class {
        constructor(){
          this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase();
          this._box=null; this._to=null;
        }
        _say(t){
          if(!this._box){
            this._box=document.createElement('div');
            this._box.id='coachHUD';
            this._box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;z-index:60;display:none';
            document.body.appendChild(this._box);
          }
          this._box.textContent=t||''; this._box.style.display=t?'block':'none';
          clearTimeout(this._to); this._to=setTimeout(()=>{ this._box.style.display='none'; },1500);
        }
        onStart(){ this._say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this._say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this._say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this._say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this._say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this._say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
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
      init:   mod.init   || null,
      tick:   mod.tick   || null,
      pickMeta: mod.pickMeta || null,
      onHit:  mod.onHit  || null,
      cleanup:mod.cleanup|| null,
      fx:     mod.fx     || {},
      update: mod.update || null
    };
  }

  // --------- FX: pop score ----------
  const FX = {
    popText(txt, { x, y, ms = 700 } = {}) {
      const el = document.createElement('div');
      el.textContent = txt;
      el.style.cssText = `position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:97;opacity:1;transition:all .72s ease-out;`;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.top=(y-36)+'px'; el.style.opacity='0'; });
      setTimeout(()=>el.remove(), ms);
    }
  };

  // --------- HUD helpers (badgesบนหน้า index) ----------
  function setScore(v){ const el=$('#scoreVal'); if(el) el.textContent=v|0; }
  function setTime(v){ const el=$('#timeVal'); if(el) el.textContent=v|0; }

  // --------- Engine state ----------
  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, coach:null,
    diff:'Normal'
  };

  function busFor(){
    return {
      sfx: R.sys.sfx,
      hit(e){
        const pts=e?.points|0;
        if(pts) R.sys.score.add(pts);
        setScore(R.sys.score.get?.() || R.sys.score.value || 0);
        if(e?.ui) FX.popText(`+${pts}`, e.ui);
        if(e?.kind==='perfect') R.coach?.onPerfect?.();
        else if(e?.kind==='good') R.coach?.onGood?.();
        try{ Quests.event('hit',{result:e?.kind||'good',meta:e?.meta||{}}); }catch{}
      },
      miss(){ /* soft miss */ }
    };
  }

  // --------- Main loop ----------
  function gameTick(){
    if(!R.playing) return;
    const tNow = performance.now();

    const secGone = Math.floor((tNow - R._secMark)/1000);
    if (secGone >= 1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      R._secMark = tNow;
      setTime(R.remain);
      if (R.remain === 10) R.coach?.onTimeLow?.();
      try{ Quests.tick({ score:(R.sys.score.get?.()||0) }); }catch{}
    }

    try{
      if (R.modeInst?.update){
        const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
        R.modeInst.update(dt, busFor());
      } else if (R.modeAPI?.update){
        const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
        R.modeAPI.update(dt, busFor());
      } else if (R.modeAPI?.tick){
        R.modeAPI.tick(R.state||{}, R.sys, {}); // minimal HUD
      }
    }catch(e){ console.warn('[mode.update] error', e); }

    if (R.remain <= 0) return endGame();
    R.raf = requestAnimationFrame(gameTick);
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    try { Quests.endRun({ score:R.sys.score.get?.()||0 }); } catch {}
    try { R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state, {}); } catch {}
    document.body.removeAttribute('data-playing');
    $('#menuBar')?.removeAttribute('data-hidden');
    R.coach?.onEnd?.(R.sys.score.get?.()||0);
    try{ Progress.endRun({ score:R.sys.score.get?.()||0 }); }catch{}
    window.HHA._busy = false;
  }

  async function startGame(){
    if (window.HHA?._busy) return;
    window.HHA._busy = true;

    await loadCore();
    Progress.init?.();

    // อ่าน mode/diff จาก attribute บน body (เมนูตั้งไว้ให้)
    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';

    // โหลดโหมด
    let api;
    try { api = await loadMode(R.modeKey); }
    catch (e) { console.error('[HHA] Failed to load mode:', R.modeKey, e); toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy = false; return; }

    // systems
    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();

    setScore(0);

    // โค้ช (ตอนนี้ CoachClass เป็น constructor แน่นอนแล้ว)
    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    R.coach.onStart?.();

    // สถานะโหมด
    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    R.modeAPI = api;

    if (api.create){
      R.modeInst = api.create({ engine:{ fx:FX }, hud:{}, coach:R.coach });
      R.modeInst.start?.();
    } else if (api.init){
      api.init(R.state, {}, { time:45, life:1600 });
    }

    try { Quests.beginRun(R.modeKey, R.diff, (R.state.lang||'TH'), 45); } catch {}
    try { Progress.beginRun(R.modeKey, R.diff, (R.state.lang||'TH')); } catch {}

    // เริ่มจับเวลา/อัปเดต
    R.playing = true;
    R.startedAt = performance.now();
    R._secMark = performance.now();
    R._dtMark  = performance.now();
    R.remain = 45; setTime(R.remain);

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

  // --------- Expose & hard-bind Start ----------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // กัน canvas บังคลิก
  setTimeout(()=>{ document.querySelectorAll('canvas').forEach(c=>{ c.style.pointerEvents='none'; c.style.zIndex='1'; }); }, 0);

  // Start button (capture + clone เคลียร์ listener เก่า)
  (function bindStartStrong(){
    const b = document.getElementById('btn_start');
    if (!b) return;
    const clone = b.cloneNode(true);
    b.parentNode.replaceChild(clone, b);
    const fire = (e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); };
    ['click','pointerup','touchend'].forEach(ev=> clone.addEventListener(ev, fire, {capture:true, passive:false}));
    clone.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fire(e); }}, {capture:true});
  })();

  // keyboard start จากหน้าเมนู
  window.addEventListener('keydown', (e)=>{
    if ((e.key === 'Enter' || e.key === ' ') && !R.playing){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if (menuVisible) { e.preventDefault(); startGame(); }
    }
  }, { passive:false });

})();
