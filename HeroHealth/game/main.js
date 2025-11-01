// === Hero Health Academy — game/main.js (robust start + watchdog + HUD sync) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  let ScoreSystem, SFXClass, Quests, Progress, CoachClass, HUDClass;

  async function loadCore() {
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n=0){this.value+=n|0;} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ constructor(){this.enabled=true;} setEnabled(v){this.enabled=!!v;} isEnabled(){return!!this.enabled} good(){} bad(){} perfect(){} tick(){} power(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { bindToMain(){return{refresh(){}}}, beginRun(){}, event(){}, tick(){}, endRun(){return[]} }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, getStatSnapshot(){return{};} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      // Fallback coach (ไม่มี DOM ภายนอกก็แสดงเอง)
      CoachClass = class {
        constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase();
          this.box=document.getElementById('coachBox')||Object.assign(document.createElement('div'),{id:'coachBox'});
          if(!document.getElementById('coachBox')){
            this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);z-index:2000;display:none;max-width:48ch';
            document.body.appendChild(this.box);
          }
        }
        say(m,ms=1400){ if(!m){this.box.style.display='none';return;} this.box.textContent=m; this.box.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>this.box.style.display='none',ms); }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this.say((score|0)>=200?(this.lang==='EN'?'Awesome!':'สุดยอด!'):(this.lang==='EN'?'Nice!':'ดีมาก!'),1600); }
      };
    }

    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch { HUDClass = class{ constructor(){this.root=document.getElementById('hud')||Object.assign(document.createElement('div'),{id:'hud'}); if(!document.getElementById('hud')) document.body.appendChild(this.root);} setTop(){} setQuestChips(){} showResult(){} hideResult(){} }; }
  }

  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key){
    const m = await import(MODE_PATH(key));
    return {
      name:m.name||key, create:m.create||null, init:m.init||null, tick:m.tick||null,
      update:m.update||null, cleanup:m.cleanup||null
    };
  }

  const TIME_BY_MODE={ goodjunk:45, groups:60, hydration:50, plate:55 };
  const getMatchTime=(mode='goodjunk',diff='Normal')=>{
    const base=TIME_BY_MODE[mode]??45;
    if(diff==='Easy') return base+5;
    if(diff==='Hard') return Math.max(20,base-5);
    return base;
  };

  let hud=null;
  let R={
    playing:false, raf:0, lastTick:0,
    modeKey:'goodjunk', diff:'Normal',
    remain:45, _secMark:0, _dtMark:0, matchTime:45,
    sys:{score:null,sfx:null}, modeAPI:null, modeInst:null, state:null, coach:null
  };

  // --- Watchdog: ถ้า loop หยุด >1.5s ให้สตาร์ทใหม่ ---
  setInterval(()=>{ if(R.playing){ const now=performance.now(); if(now - (R.lastTick||0) > 1500){ requestAnimationFrame(gameTick); } } }, 800);

  function setBadges(){
    hud?.setTop?.({ mode:R.modeKey, diff:R.diff, time:R.remain, score:R.sys?.score?.get?.()||0, combo:R.sys?.score?.combo|0 });
    const mB=$('#modeBadge'); if(mB) mB.textContent=R.modeKey;
    const dB=$('#diffBadge'); if(dB) dB.textContent=R.diff;
    const sV=$('#scoreVal'); if(sV) sV.textContent=R.sys?.score?.get?.()||0;
  }

  function busFor(){
    return {
      hit(e){
        const pts=e?.points|0;
        if(pts){ R.sys.score.add(pts); R.sys.score.combo=(R.sys.score.combo|0)+1; R.sys.score.bestCombo=Math.max(R.sys.score.bestCombo|0,R.sys.score.combo|0); }
        setBadges();
        try{Quests.event('hit',{points:pts,result:e?.kind||'good',comboNow:R.sys.score.combo|0});}catch{}
      },
      miss(){ R.sys.score.combo=0; setBadges(); try{R.coach?.onBad?.();}catch{} }
    };
  }

  function gameTick(){
    if(!R.playing) return;
    const now = performance.now();
    R.lastTick = now;

    const sec = Math.floor((now - R._secMark)/1000);
    if(sec>=1){
      R.remain = Math.max(0, (R.remain|0) - sec);
      R._secMark = now;
      setBadges();
      if (R.remain===10) R.coach?.onTimeLow?.();
      try{ Quests.tick({score:R.sys.score.get?.()||0}); }catch{}
    }

    try{
      if (typeof R.modeAPI?.update==='function'){
        const dt=(now-(R._dtMark||now))/1000; R._dtMark=now; R.modeAPI.update(dt, busFor());
      } else if (R.modeInst?.update){
        const dt=(now-(R._dtMark||now))/1000; R._dtMark=now; R.modeInst.update(dt, busFor());
      } else if (R.modeAPI?.tick){
        R.modeAPI.tick(R.state||{}, R.sys, hud||{});
      }
    }catch(err){ console.warn('[mode.update]', err); }

    if (R.remain<=0) return endGame();
    R.raf = requestAnimationFrame(gameTick);
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);

    const score = R.sys?.score?.get?.()||0;
    const bestC = R.sys?.score?.bestCombo|0;
    try{ Quests.endRun({score}); }catch{}
    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state,hud); }catch{}

    document.body.removeAttribute('data-playing');
    $('#menuBar')?.removeAttribute('data-hidden');

    R.coach?.onEnd?.(score);
    try{
      hud.showResult?.({
        title:'Result',
        desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
        stats:[ `Score: ${score}`, `Best Combo: ${bestC}`, `Time: ${R.matchTime|0}s` ]
      });
      hud.onHome = ()=>{ hud.hideResult?.(); $('#menuBar')?.removeAttribute('data-hidden'); };
      hud.onRetry= ()=>{ hud.hideResult?.(); startGame(); };
    }catch{}

    window.HHA._busy=false;
  }

  // --- fallback spawner ถ้าโหมดไม่มี update/tick (กันจอดำ) ---
  function ensureFallbackSpawner(){
    if (typeof R.modeAPI?.update === 'function' || R.modeInst?.update || R.modeAPI?.tick) return;
    console.warn('[fallback] mode has no update/tick — enabling fallback spawner');
    const host = document.getElementById('spawnHost') || (()=>{ const h=document.createElement('div'); h.id='spawnHost'; h.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;'; document.body.appendChild(h); return h; })();
    let t = 0;
    R.modeAPI = R.modeAPI || {};
    R.modeAPI.update = function(dt, bus){
      t += dt; if (t >= 0.7){ t -= 0.7;
        const d=document.createElement('button'); d.type='button'; d.textContent='🍎';
        Object.assign(d.style,{position:'absolute',left:(50+Math.random()*(innerWidth-100))+'px',top:(60+Math.random()*(innerHeight-220))+'px',transform:'translate(-50%,-50%)',fontSize:'56px',background:'transparent',border:'0',cursor:'pointer',filter:'drop-shadow(0 3px 6px rgba(0,0,0,.45))'});
        const kill=setTimeout(()=>{ try{d.remove();}catch{} bus?.miss?.(); }, 1500);
        d.addEventListener('click',(ev)=>{ clearTimeout(kill); try{d.remove();}catch{} bus?.hit?.({kind:'good',points:100,ui:{x:ev.clientX,y:ev.clientY}}); }, {passive:true});
        host.appendChild(d);
      }
    };
  }

  async function startGame(){
    if (window.HHA?._busy) return;
    window.HHA._busy = true;

    await loadCore();
    Progress.init?.();

    // โหมด/ระดับจากหน้า
    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';

    // เวลา
    R.matchTime = getMatchTime(R.modeKey, R.diff);
    R.remain    = R.matchTime|0;

    // HUD/Coach/Quests
    if (!hud) hud = new HUDClass();
    hud.hideResult?.();
    hud.setTop?.({ mode:R.modeKey, diff:R.diff, time:R.remain, score:0, combo:0 });

    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    try { Quests.bindToMain({ hud, coach:R.coach, lang:(localStorage.getItem('hha_lang')||'TH') }); } catch {}
    try { Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime); } catch {}

    // Systems
    R.sys.score = new ScoreSystem(); R.sys.score.reset();
    R.sys.sfx   = new SFXClass();

    // Load mode
    let api; 
    try { api = await loadMode(R.modeKey); }
    catch(e){ toast(`Failed to load mode: ${R.modeKey}`); console.error(e); window.HHA._busy=false; return; }

    R.modeAPI = api; R.modeInst = null;
    if (api.create){ R.modeInst = api.create({ hud, coach:R.coach }); R.modeInst?.start?.({ time:R.matchTime, difficulty:R.diff }); }
    else if (api.init){ api.init({ difficulty:R.diff }, hud, { time:R.matchTime, life:1600 }); }

    // ถ้าโหมดไม่มี update/tick ให้เปิด fallback
    ensureFallbackSpawner();

    // ซ่อนเมนู + เริ่ม loop (กำหนด timestamp ให้ครบ)
    document.body.setAttribute('data-playing','1');
    $('#menuBar')?.setAttribute('data-hidden','1');

    R.playing   = true;
    R._secMark  = performance.now();
    R._dtMark   = performance.now();
    R.lastTick  = performance.now();
    setBadges();

    requestAnimationFrame(gameTick);
  }

  function toast(t){ let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); } el.textContent=t; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 1200); }

  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // กัน canvas ขวางคลิก
  setTimeout(()=>{ document.querySelectorAll('canvas').forEach(c=>{ c.style.pointerEvents='none'; c.style.zIndex='1'; }); },0);

  // Binder ปุ่ม Start ให้แน่น
  (function bindStartStrong(){
    const b = document.getElementById('btn_start'); if(!b) return;
    const clone = b.cloneNode(true); b.replaceWith(clone);
    const go = (e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); };
    ['click','pointerup','touchend'].forEach(ev=> clone.addEventListener(ev, go, {capture:true,passive:false}));
    clone.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(e); }}, {capture:true,passive:false});
  })();

  // Keyboard start (จากหน้าเมนู)
  window.addEventListener('keydown',(e)=>{ if((e.key==='Enter'||e.key===' ') && !R.playing && !$('#menuBar')?.hasAttribute('data-hidden')){ e.preventDefault(); window.HHA.startGame(); } },{passive:false});
})();
