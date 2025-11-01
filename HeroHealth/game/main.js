// === Hero Health Academy — game/main.js (hide menu on start; restore on end) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ---- Safe stubs ----
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
    catch {
      CoachClass = class {
        constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase(); this._box=null; }
        _say(t){ 
          if(!this._box){ this._box=document.createElement('div'); this._box.id='coachHUD';
            this._box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;z-index:60;'; 
            document.body.appendChild(this._box);
          }
          this._box.textContent=t||''; this._box.style.display=t?'block':'none';
          clearTimeout(this._to); this._to=setTimeout(()=>this._box.style.display='none',1500);
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

  // ---- Mode loader ----
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

  // ---- FX helper ----
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

  // ---- State ----
  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, coach:null,
    diff:'Normal'
  };

  function busFor(){
    return {
      sfx: R.sys.sfx,
      hit(e){ const pts=e?.points|0; if(pts){ R.sys.score.add(pts); } if(e?.ui) FX.popText(`+${pts}`, e.ui); },
      miss(){ /* no-op */ }
    };
  }

  function gameTick(){
    if(!R.playing) return;
    const tNow = performance.now();
    const secGone = Math.floor((tNow - R._secMark)/1000);
    if (secGone>=1){
      R.remain = Math.max(0,(R.remain|0)-secGone);
      R._secMark = tNow;
      if (R.remain===10) R.coach?.onTimeLow?.();
    }
    try{
      if (typeof R.modeAPI?.update==='function'){
        const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
        R.modeAPI.update(dt,busFor());
      } else if (R.modeInst?.update){
        const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
        R.modeInst.update(dt,busFor());
      } else if (R.modeAPI?.tick){
        R.modeAPI.tick(R.state||{}, R.sys, {});
      }
    }catch(e){ console.warn('[mode.update] error',e); }

    if (R.remain<=0) return endGame();
    R.raf = requestAnimationFrame(gameTick);
  }

  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    try { R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state, {}); } catch {}
    document.body.removeAttribute('data-playing');
    const mb = document.getElementById('menuBar');
    if (mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; } // ← แสดงเมนูกลับมา
    R.coach?.onEnd?.(R.sys?.score?.get?.()||0);
    window.HHA._busy=false;
  }

  async function startGame(){
    if(window.HHA?._busy) return; window.HHA._busy=true;
    await loadCore();

    // mode/diff จาก data-* บน body
    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';

    // โหลดโหมด
    let api;
    try { api = await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy=false; return; }

    // systems
    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();
    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    R.coach.onStart?.();

    // init mode
    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    R.modeAPI = api;
    if (api.create){ R.modeInst = api.create({engine:{fx:FX}, coach:R.coach}); R.modeInst.start?.(); }
    else if (api.init){ api.init(R.state, {}, { time:45, life:1600 }); }

    // hide menu “จริงๆ”
    document.body.setAttribute('data-playing','1');
    const mb = document.getElementById('menuBar');
    if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

    // start loop
    R.playing = true;
    R.startedAt = performance.now();
    R._secMark = performance.now();
    R._dtMark  = performance.now();
    R.remain = 45;
    requestAnimationFrame(gameTick);
  }

  function toast(text){
    let el = $('#toast');
    if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200);
  }

  // expose
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // กัน canvas บังคลิก
  setTimeout(()=>{ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);

  // เลือกโหมด/ยาก + ปุ่ม Start
  (function bindMenu(){
    const mb = document.getElementById('menuBar'); if(!mb) return;
    function setActive(sel, el){ $$(sel).forEach(b=>b.classList.remove('active')); el.classList.add('active'); }
    mb.addEventListener('click',(ev)=>{
      const t=ev.target.closest('.btn'); if(!t) return;
      if(t.hasAttribute('data-mode')){ setActive('[data-mode]',t); document.body.setAttribute('data-mode',t.getAttribute('data-mode')); return; }
      if(t.hasAttribute('data-diff')){ setActive('[data-diff]',t); document.body.setAttribute('data-diff',t.getAttribute('data-diff')); return; }
      if(t.dataset.action==='howto'){ toast('แตะของดี เลี่ยงของไม่ดี ภายใน 45 วิ'); return; }
      if(t.dataset.action==='sound'){ const muted = !Array.from(document.querySelectorAll('audio')).some(a=>!a.muted);
        document.querySelectorAll('audio').forEach(a=>{ try{ a.muted=!muted; }catch{} });
        t.textContent = muted ? '🔇 Sound' : '🔊 Sound'; toast(muted?'เสียง: ปิด':'เสียง: เปิด'); return; }
      if(t.dataset.action==='start'){ ev.preventDefault(); ev.stopPropagation(); startGame(); return; }
    }, false);

    // ปุ่ม start แบบกันพลาด
    const b = document.getElementById('btn_start');
    if (b){
      const clone = b.cloneNode(true); b.replaceWith(clone);
      ['click','pointerup','touchend'].forEach(ev=>{
        clone.addEventListener(ev,(e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); },{capture:true,passive:false});
      });
      clone.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); startGame(); }},{capture:true});
    }
  })();

})();
