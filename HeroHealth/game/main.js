// === Hero Health Academy — game/main.js (2025-11-01: solid Start, HUD time, Coach, Power bar) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ---------- Safe stubs (จะถูกแทนที่เมื่อ import ได้) ----------
  let ScoreSystem, SFXClass, Quests, Progress, CoachClass;

  async function loadCore() {
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0;this.combo=0;this.bestCombo=0;this._h={};}
      reset(){this.value=0;this.combo=0;this.bestCombo=0;this._emit();}
      add(n=0){ if(n>0){this.combo++; this.bestCombo=Math.max(this.bestCombo,this.combo);} else this.combo=0;
        this.value=Math.max(0,(this.value|0)+(n|0)); this._emit({delta:n}); }
      addPenalty(n=8){ const before=this.value|0; this.value=Math.max(0,before-(n|0)); this.combo=0; this._emit({delta:this.value-before});}
      get(){return this.value|0;} setHandlers(h){this._h=h||{};} _emit(p){try{this._h.change?.(this.value|0,p||{});}catch{}} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ constructor(){this.enabled=true;} setEnabled(v){this.enabled=!!v;} play(){} good(){} bad(){} perfect(){} tick(){} power(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { beginRun(){}, event(){}, tick(){}, endRun(){return[]}, bindToMain(){return{refresh(){}}} }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = class {
        constructor(opts={}){ this.lang=String((localStorage.getItem('hha_lang')||opts.lang||'TH')).toUpperCase(); this._ensureHUD(); }
        _ensureHUD(){ let hud=$('#coachHUD'); if(!hud){ hud=document.createElement('div'); hud.id='coachHUD';
          hud.style.cssText='position:fixed;left:50%;top:50px;transform:translateX(-50%);z-index:70;display:none;background:#0e1930;border:1px solid #214064;border-radius:12px;color:#e8f3ff;padding:8px 12px;font:700 14px ui-rounded';
          const t=document.createElement('span'); t.id='coachText'; hud.appendChild(t); (document.getElementById('hudTop')||document.body).appendChild(hud); }
          this.hud=hud; this.txt=$('#coachText');
        }
        say(m,ms=1100){ if(!this.txt)return; this.txt.textContent=m||''; this.hud.style.display='block'; clearTimeout(this._t);
          this._t=setTimeout(()=>{ this.hud.style.display='none'; },ms);
        }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!',800); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!',900); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!',900); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!',1000); }
        onEnd(score){ this.say((score|0)>=400 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!'),1200); }
      };
    }
  }

  // ---------- โหลดโหมดแบบโมดูล DOM-first ----------
  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key) {
    const mod = await import(MODE_PATH(key));
    return {
      name: mod.name || key,
      create: mod.create || null,  // ถ้ามี create() จะใช้เสมอ
      start:  mod.start  || null,
      update: mod.update || null,
      stop:   mod.stop   || null,
      cleanup:mod.cleanup|| null
    };
  }

  // ---------- Tiny FX (popText) ----------
  const FX = {
    popText(txt, { x, y, ms = 720 } = {}) {
      try{
        const el = document.createElement('div');
        el.textContent = txt;
        el.style.cssText = `position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);
          font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:97;opacity:1;transition:all .72s ease-out`;
        document.body.appendChild(el);
        requestAnimationFrame(()=>{ el.style.top=(y-36)+'px'; el.style.opacity='0'; });
        setTimeout(()=>el.remove(), ms);
      }catch{}
    }
  };

  // ---------- HUD glue ----------
  function ensureTimeBadge(){
    if ($('#timeBadge')) return;
    const slot = $('#hudTop');
    const b = document.createElement('div');
    b.className='badge'; b.id='timeBadge';
    b.innerHTML = 'Time: <b id="timeVal">45</b>s';
    slot?.appendChild(b);
  }
  function setScore(v){ const el = $('#scoreVal'); if (el) el.textContent = v|0; }
  function setTime(v){ const el = $('#timeVal');  if (el) el.textContent = v|0; }
  function setModeDiffBadges(mode,diff){
    const mb=$('#modeBadge'), db=$('#diffBadge'); if(mb) mb.textContent=mode; if(db) db.textContent=diff;
  }
  function toast(text, ms=1200){
    const el = $('#toast'); if(!el) return;
    el.textContent = text; el.classList.add('show');
    clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'), ms);
  }

  // ---------- Power bar / Fever (ง่าย ๆ แต่ววิ่งจริง) ----------
  const Power = (()=> {
    const fill = $('#powerFill');
    let meter = 0;           // 0..100
    let multi = 1;           // x1 / x2
    let frozen = false;      // freeze spawn (ให้โหมดเคารพเองบางส่วน)
    let shield = false;      // กัน miss ครั้งถัดไป
    let tDecay = null;
    let tPower = null;

    function _paint(){ if(fill) fill.style.width = Math.max(0,Math.min(100,meter))+'%'; }

    function add(n=3){ meter = Math.max(0, Math.min(100, meter + n)); _paint(); }
    function decayLoop(){
      clearInterval(tDecay);
      tDecay = setInterval(()=>{ meter = Math.max(0, meter - 1.2); _paint(); }, 400);
    }
    function clearPower(){
      multi = 1; frozen=false; shield=false;
      $('#powerBar')?.classList.remove('fever','frozen','shield');
    }
    function activate(kind, durMs=6000){
      clearTimeout(tPower);
      switch(kind){
        case 'x2':     multi=2;      $('#powerBar')?.classList.add('fever'); break;
        case 'freeze': frozen=true;  $('#powerBar')?.classList.add('frozen'); break;
        case 'sweep':  /* แตะแล้วเก็บรอบจอ (เอาไว้ให้โหมดเรียก bus.hit เอง)*/ break;
        case 'shield': shield=true;  $('#powerBar')?.classList.add('shield'); break;
      }
      tPower = setTimeout(()=>{ clearPower(); }, durMs|0 || 6000);
      return { kind, dispose(){ clearPower(); } }; // <-- ensure มี dispose เสมอ
    }

    // init
    _paint(); decayLoop();
    return {
      add, getMulti:()=>multi, isFrozen:()=>frozen, hasShield:()=>shield,
      consumeShield(){ const had=shield; shield=false; $('#powerBar')?.classList.remove('shield'); return had; },
      activate, dispose(){ clearInterval(tDecay); clearTimeout(tPower); },
    };
  })();

  // ---------- Game state ----------
  let R = {
    playing:false, remain:45, raf:0, _secMark:0, _dtMark:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, coach:null
  };

  function busFor(){ // event bus ให้โหมดเรียก
    return {
      sfx: R.sys.sfx,
      hit(e){ // {kind:'good'|'perfect'|'golden', points, ui, meta}
        const mul = Power.getMulti ? Power.getMulti() : 1;
        const pts = Math.max(0,(e?.points|0)) * (mul|0);
        if (pts>0) R.sys.score.add(pts);
        setScore(R.sys.score.get?.()||0);
        if (e?.ui) FX.popText('+'+pts, e.ui);
        if (e?.kind==='perfect'||e?.kind==='golden') R.coach?.onPerfect?.(); else if (e?.kind==='good') R.coach?.onGood?.();

        try{ Quests.event('hit', { result: e?.kind||'good', meta: e?.meta||{}, comboNow: (R.sys.score.combo|0) }); }catch{}
        try{ Progress.notify?.('score_tick', { score:R.sys.score.get?.()||0 }); }catch{}
        try{ Progress.notify?.('combo_best', { value:R.sys.score.bestCombo|0 }); }catch{}

        // อัปมิเตอร์
        Power.add(e?.kind==='perfect'||e?.kind==='golden'? 5 : 3);
      },
      miss(payload){
        // กันพลาดด้วย shield 1 ครั้ง
        if (Power.consumeShield && Power.consumeShield()) { R.coach?.onGood?.(); return; }
        R.sys.score.addPenalty?.(6);
        setScore(R.sys.score.get?.()||0);
        document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'),120);
        R.coach?.onBad?.();
        try{ Quests.event('miss', payload||{}); }catch{}
      },
      power(kind){
        const h = Power.activate(kind, 6000);
        R.sys.sfx?.power?.();
        toast('Power: ' + (kind==='x2'?'×2':kind), 900);
        return h; // มี .dispose()
      }
    };
  }

  // ---------- main loop ----------
  function gameTick(){
    if (!R.playing) return;
    const now = performance.now();

    // second tick
    if (!R._secMark) R._secMark = now;
    const secGone = Math.floor((now - R._secMark)/1000);
    if (secGone >= 1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      R._secMark = now;
      setTime(R.remain);

      if (R.remain === 10) R.coach?.onTimeLow?.();
      try{ Quests.tick({ score:R.sys.score.get?.()||0 }); }catch{}
    }

    // mode update
    try {
      if (!R._dtMark) R._dtMark = now;
      const dt = (now - R._dtMark)/1000; R._dtMark = now;
      if (R.modeInst && typeof R.modeInst.update === 'function') {
        R.modeInst.update(dt, busFor());
      } else if (R.modeAPI?.update) {
        R.modeAPI.update(dt, busFor());
      }
    } catch(e){ console.warn('[mode.update] error', e); }

    if (R.remain <= 0) return endGame(false);
    R.raf = requestAnimationFrame(gameTick);
  }

  function durationByDiff(d){ return d==='Easy'?60:(d==='Hard'?40:45); }

  function endGame(manual=true){
    if (!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);

    try { Quests.endRun({ score:R.sys.score.get?.()||0 }); } catch {}
    try { R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(); R.modeAPI?.stop?.(); } catch {}

    $('#menuBar')?.setAttribute('style',''); // โชว์กลับ
    document.body.removeAttribute('data-playing');

    R.coach?.onEnd?.(R.sys.score.get?.()||0);
    try { Progress.endRun({ score:R.sys.score.get?.()||0, bestCombo:R.sys.score.bestCombo|0 }); } catch {}

    // คะแนนรวม + สรุปสั้น
    toast('Score: '+(R.sys.score.get?.()||0), 1800);
    window.HHA._busy = false;
  }

  async function startGame(){
    if (window.HHA?._busy) return;
    window.HHA = window.HHA || {}; window.HHA._busy = true;

    ensureTimeBadge();
    await loadCore();
    try{ Progress.init?.(); }catch{}

    // pick mode/diff จาก UI/ตัวแปร
    const mm = document.body.getAttribute('data-mode') || window.__HHA_MODE || 'goodjunk';
    const dd = document.body.getAttribute('data-diff') || window.__HHA_DIFF || 'Normal';
    R.modeKey = mm; R.diff = dd; setModeDiffBadges(mm,dd);

    // โหลดโหมด
    let api;
    try { api = await loadMode(mm); }
    catch (e){ console.error('[HHA] load mode fail', e); toast('Failed to load mode: '+mm,1500); window.HHA._busy=false; return; }
    R.modeAPI = api;

    // systems
    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.score.setHandlers?.({ change:(v)=>setScore(v) });

    R.sys.sfx = new (SFXClass||function(){})();
    // auto-unlock จะทำในสคริปต์ sfx เองครั้งแรกที่ผู้ใช้แตะ

    // Coach
    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    R.coach.onStart?.();

    // bind HUD API ให้ Quests (ถ้ามี)
    try{ Quests.bindToMain({ hud:{
      setQuestChips(){}, markQuestDone(){},
      setTarget(g,have,need){
        const wrap=$('#targetWrap'), badge=$('#targetBadge');
        if(wrap) wrap.style.display='inline-flex';
        if(badge) badge.textContent = `${g} • ${have|0}/${need|0}`;
      }
    }, coach:R.coach }); }catch{}

    // Begin run
    try{ Quests.beginRun(mm, dd, (localStorage.getItem('hha_lang')||'TH'), durationByDiff(dd)); }catch{}
    try{ Progress.beginRun(mm, dd, (localStorage.getItem('hha_lang')||'TH')); }catch{}

    // init mode instance
    if (api.create){
      R.modeInst = api.create({ engine:{ fx:FX }, hud:{}, coach:R.coach });
      R.modeInst.start?.({ difficulty:dd });
    } else {
      // legacy start/update/stop signatures
      api.start?.({ difficulty:dd });
    }

    // UI states
    R.remain = durationByDiff(dd);
    setTime(R.remain);
    document.body.setAttribute('data-playing','1');
    $('#menuBar')?.setAttribute('style','display:none');

    // go
    R.playing = true;
    R._secMark = performance.now(); R._dtMark = performance.now();
    R.raf = requestAnimationFrame(gameTick);
  }

  // ---------- Menu wiring ----------
  function bindMenu(){
    const mb = $('#menuBar');
    if (!mb) return;

    mb.addEventListener('click', (ev)=>{
      const t = ev.target.closest('.btn');
      if (!t) return;

      if (t.hasAttribute('data-mode')){
        $$('#menuBar .btn[data-mode]').forEach(b=>b.classList.remove('active'));
        t.classList.add('active');
        const mode = t.getAttribute('data-mode');
        document.body.setAttribute('data-mode', mode);
        setModeDiffBadges(mode, document.body.getAttribute('data-diff')||'Normal');
      }
      else if (t.hasAttribute('data-diff')){
        $$('#menuBar .btn[data-diff]').forEach(b=>b.classList.remove('active'));
        t.classList.add('active');
        const diff = t.getAttribute('data-diff');
        document.body.setAttribute('data-diff', diff);
        setModeDiffBadges(document.body.getAttribute('data-mode')||'goodjunk', diff);
      }
      else if (t.getAttribute('data-action')==='start'){
        startGame();
      }
      else if (t.getAttribute('data-action')==='howto'){
        alert('วิธีเล่น:\n• แตะไอคอนที่ “ถูกต้อง” ของแต่ละโหมด\n• สะสมคะแนนภายในเวลาที่กำหนด (Easy 60s / Normal 45s / Hard 40s)\n• Perfect/Golden จะได้คะแนนมากกว่า\n• เกจไฟลุกเต็ม = เปิดพลังชั่วคราว (×2 / Freeze / Shield) จากไอคอนพลัง');
      }
      else if (t.getAttribute('data-action')==='sound'){
        const on = !(R.sys?.sfx?.enabled===false);
        R.sys?.sfx?.setEnabled?.(!on);
        toast((!on)?'🔊 Sound: ON':'🔇 Sound: OFF', 800);
      }
    }, { passive:true });
  }

  // ---------- Expose ----------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // kickoff
  bindMenu();
  // set default mode/diff in badge
  setModeDiffBadges(document.body.getAttribute('data-mode')||'goodjunk', document.body.getAttribute('data-diff')||'Normal');

  // อย่าให้ canvas/ชั้นบน (ถ้ามี) บังคลิก (ป้องกันธีมเก่า)
  setTimeout(()=>{ const c = $('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } }, 0);

})();
