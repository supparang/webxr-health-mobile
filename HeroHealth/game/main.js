// === Hero Health Academy — game/main.js (HUD+Quests+Result wired) ===
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
      CoachClass = class {
        constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase();
          this.box=document.getElementById('coachBox')||Object.assign(document.createElement('div'),{id:'coachBox'});
          if(!document.getElementById('coachBox')){ this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);z-index:2000;display:none;max-width:48ch'; document.body.appendChild(this.box); }
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
  async function loadMode(key){ const m = await import(MODE_PATH(key)); return { name:m.name||key, create:m.create||null, init:m.init||null, tick:m.tick||null, update:m.update||null, cleanup:m.cleanup||null }; }

  const TIME_BY_MODE={ goodjunk:45, groups:60, hydration:50, plate:55 };
  const getMatchTime=(mode='goodjunk',diff='Normal')=>{
    const base=TIME_BY_MODE[mode]??45;
    if(diff==='Easy') return base+5;
    if(diff==='Hard') return Math.max(20,base-5);
    return base;
  };

  let hud=null;
  let R={ playing:false, raf:0, modeKey:'goodjunk', diff:'Normal',
          remain:45, _secMark:0, _dtMark:0, matchTime:45,
          sys:{score:null,sfx:null}, modeAPI:null, modeInst:null, state:null, coach:null };

  function setBadges(){
    hud?.setTop?.({ mode:R.modeKey, diff:R.diff, time:R.remain, score:R.sys?.score?.get?.()||0, combo:R.sys?.score?.combo|0 });
    const mB=document.getElementById('modeBadge'); if(mB) mB.textContent=R.modeKey;
    const dB=document.getElementById('diffBadge'); if(dB) dB.textContent=R.diff;
    const sV=document.getElementById('scoreVal'); if(sV) sV.textContent=R.sys?.score?.get?.()||0;
  }

  function busFor(){
    return {
      hit(e){ const pts=e?.points|0; if(pts){ R.sys.score.add(pts); R.sys.score.combo=(R.sys.score.combo|0)+1; R.sys.score.bestCombo=Math.max(R.sys.score.bestCombo|0,R.sys.score.combo|0); }
               setBadges();
               if(e?.kind==='perfect')R.coach?.onPerfect(); else if(e?.kind==='good') R.coach?.onGood();
               try{Quests.event('hit',{points:pts,result:e?.kind||'good',comboNow:R.sys.score.combo|0});}catch{} },
      miss(){ R.sys.score.combo=0; setBadges(); try{R.coach?.onBad?.();}catch{} }
    };
  }

  function gameTick(){
    if(!R.playing) return;
    const now = performance.now();
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
    document.getElementById('menuBar')?.removeAttribute('data-hidden');
    R.coach?.onEnd?.(score);

    // ✅ แสดง Result modal ผ่าน HUD
    try{
      hud.showResult({
        title:'Result',
        desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
        stats:[ `Score: ${score}`, `Best Combo: ${bestC}`, `Time: ${R.matchTime|0}s` ]
      });
      hud.onHome = ()=>{ hud.hideResult(); document.getElementById('menuBar')?.removeAttribute('data-hidden'); };
      hud.onRetry= ()=>{ hud.hideResult(); startGame(); };
    }catch{}

    window.HHA._busy=false;
  }

  async function startGame(){
    if (window.HHA?._busy) return;
    window.HHA._busy = true;

    await loadCore();
    Progress.init?.();

    // โหมด/ระดับจากหน้าเมนู
    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';

    // เวลาแข่งขัน
    R.matchTime = getMatchTime(R.modeKey, R.diff);
    R.remain    = R.matchTime|0;

    // HUD + Coach + Quests
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
    let api; try { api = await loadMode(R.modeKey); } catch(e){ toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy=false; return; }
    R.modeAPI = api; R.modeInst = null;
    if (api.create){ R.modeInst = api.create({ hud, coach:R.coach }); R.modeInst?.start?.({ time:R.matchTime }); }
    else if (api.init){ api.init({ difficulty:R.diff }, hud, { time:R.matchTime, life:1600 }); }

    // ซ่อนเมนู, เริ่มลูป
    document.body.setAttribute('data-playing','1');
    document.getElementById('menuBar')?.setAttribute('data-hidden','1');
    R._secMark = performance.now(); R._dtMark = performance.now(); R.playing = true; setBadges();
    requestAnimationFrame(gameTick);
  }

  function toast(t){ let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); } el.textContent=t; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 1200); }

  // Expose & strong binder
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  (function bindStartStrong(){
    const b = document.getElementById('btn_start'); if(!b) return;
    const clone = b.cloneNode(true); b.replaceWith(clone);
    const go = (e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); };
    ['click','pointerup','touchend'].forEach(ev=> clone.addEventListener(ev, go, {capture:true,passive:false}));
    clone.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(e); }}, {capture:true,passive:false});
  })();

  // กัน canvas ขวางคลิก
  setTimeout(()=>{ document.querySelectorAll('canvas').forEach(c=>{ c.style.pointerEvents='none'; c.style.zIndex='1'; }); },0);

  // Keyboard start
  window.addEventListener('keydown',(e)=>{ if((e.key==='Enter'||e.key===' ') && !R.playing && !document.getElementById('menuBar')?.hasAttribute('data-hidden')){ e.preventDefault(); startGame(); } },{passive:false});
})();
