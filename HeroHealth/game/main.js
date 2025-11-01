// === Hero Health Academy — game/main.js (Quest+Fever+Result+Sound+Profile) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // --------- Safe stubs ----------
  let ScoreSystem, SFXClass, CoachClass, Leaderboard, HUDClass;

  async function loadCore() {
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n=0){this.value+=n;} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ constructor(){this.enabled=true;} setEnabled(v){this.enabled=!!v;} isEnabled(){return!!this.enabled} play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch { // small fallback coach
      CoachClass = class {
        constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase(); }
        onStart(){ hud?.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ hud?.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ hud?.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ hud?.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ hud?.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ hud?.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }

    try { ({ Leaderboard } = await import('./core/leaderboard.js')); }
    catch { Leaderboard = class{ submit(){} renderInto(){} getInfo(){return{text:'Scope:-'}} }; }

    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch { HUDClass = class{ constructor(){this.root=document.getElementById('hud')||Object.assign(document.createElement('div'),{id:'hud'});if(!document.getElementById('hud'))document.body.appendChild(this.root);} setTop(){} setMission(){} setFever(){} say(){} showResult(){} hideResult(){} }; }
  }

  // --------- Mode loader ----------
  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return {
      name: mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null,
      cleanup:mod.cleanup||null, update:mod.update||null, pickMeta:mod.pickMeta||null
    };
  }

  // --------- Engine state ----------
  let R={playing:false,startedAt:0,remain:45,raf:0,
         sys:{score:null,sfx:null},
         modeKey:'goodjunk',modeAPI:null,modeInst:null,
         diff:'Normal',board:null,boardScope:'month',
         stats:{ perfect:0, miss:0, bestCombo:0, stars:0, fever:0 }};
  let hud=null;

  // ---- Match time by mode ----
  const TIME_BY_MODE={ goodjunk:60, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode='goodjunk',diff='Normal'){
    const base=TIME_BY_MODE[mode]??60;
    if(diff==='Easy') return base+10;
    if(diff==='Hard') return Math.max(25,base-10);
    return base;
  }

  // ---- UI sync ----
  function setBadges(){
    hud?.setTop?.({mode:R.modeKey,diff:R.diff,time:R.remain,score:R.sys?.score?.get?.()||0,combo:R.sys?.score?.combo|0});
    const mB=$('#modeBadge');if(mB)mB.textContent=R.modeKey;
    const dB=$('#diffBadge');if(dB)dB.textContent=R.diff;
    const sV=$('#scoreVal');if(sV)sV.textContent=R.sys?.score?.get?.()||0;
  }

  // ---- BUS for mode ----
  function busFor(){
    return{
      sfx:R.sys.sfx,
      hit(e){
        const pts=e?.points|0;
        if(pts){
          R.sys.score.add(pts);
          R.sys.score.combo=(R.sys.score.combo|0)+1;
          if((R.sys.score.combo|0)>(R.sys.score.bestCombo|0))R.sys.score.bestCombo=R.sys.score.combo|0;
        }
        if(e?.kind==='perfect') R.stats.perfect++;
        setBadges();
        if (e?.ui) popText(`+${pts}`,e.ui);
        window.HHA_SCORE_NOW = R.sys.score.get?.()||0;
      },
      miss(){
        R.stats.miss++;
        R.sys.score.combo=0;
        setBadges();
      },
      power(k){
        if (k==='star') R.stats.stars++;
      },
      fever(f){ // {active,value,time}
        if (f?.active) R.stats.fever++;
        hud?.setFever?.(f);
      },
      quest(q){ // {index,total,chip:{icon,label,progress,need,done}}
        if (q?.chip) hud?.setMission?.({ icon:q.chip.icon, label:`${q.index}/${q.total} • ${q.chip.label}`, progress:q.chip.progress, need:q.chip.need, done:q.chip.done });
      },
      doneAll(info){ // all missions clear → end early with bonus
        endGame(true, { reason:'all_clear', extra:info });
      }
    };
  }

  // ---- Loop ----
  function gameTick(){
    if(!R.playing)return;
    const tNow=performance.now();
    const secGone=Math.floor((tNow-R._secMark)/1000);
    if(secGone>=1){
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=tNow;
      setBadges();
      if(R.remain===10) R.coach?.onTimeLow?.();
    }
    try{
      if (typeof R.modeAPI?.update==='function') {
        const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
        R.modeAPI.update(dt,busFor());
      } else if (R.modeInst?.update) {
        const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
        R.modeInst.update(dt,busFor());
      }
    }catch(e){ console.warn('[mode.update] error', e); }
    if (R.remain<=0) return endGame(false);
    R.raf=requestAnimationFrame(gameTick);
  }

  function endGame(early=false, info={}){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);

    const score=R.sys?.score?.get?.()||0;
    const bestC=R.sys?.score?.bestCombo|0;
    const title = early && info?.reason==='all_clear' ? 'ALL MISSIONS CLEAR 🎉' : 'Time Up';

    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(); }catch{}
    document.body.removeAttribute('data-playing');
    $('#menuBar')?.removeAttribute('data-hidden');

    R.coach?.onEnd?.(score);

    // Leaderboard submit
    try {
      const name=(localStorage.getItem('hha_name')||'').trim() || 'Player';
      R.board?.submit(R.modeKey, R.diff, score, { name, meta:{ bestCombo:bestC, perfect:R.stats.perfect, miss:R.stats.miss } });
    } catch {}

    // HUD result
    const statLines = [
      `Score: ${score}`,
      `Best Combo: ${bestC}`,
      `Perfect: ${R.stats.perfect}`,
      `Miss: ${R.stats.miss}`,
      `Stars: ${R.stats.stars}`,
      `Fever: ${R.stats.fever}`,
      `Time: ${R.matchTime|0}s`
    ];
    hud?.showResult?.({
      title, desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
      stats: statLines
    });
    hud.onHome  = ()=>{ hud.hideResult(); $('#menuBar')?.removeAttribute('data-hidden'); };
    hud.onRetry = ()=>{ hud.hideResult(); startGame(); };
    window.HHA._busy=false;
  }

  async function startGame(){
    if(window.HHA?._busy)return;
    window.HHA._busy=true;
    await loadCore();

    if(!R.board) R.board=new Leaderboard({key:'hha_board',maxKeep:300,retentionDays:180});
    if(!hud) hud=new HUDClass();

    // reflect chosen
    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';

    // time
    R.matchTime=getMatchTime(R.modeKey,R.diff);
    R.remain=R.matchTime;

    // load mode
    let api;
    try{ api = await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:', R.modeKey, e); toast(`Failed to load mode: ${R.modeKey}`); window.HHA._busy=false; return; }
    R.modeAPI = api;
    R.modeInst = api.create ? api.create({ hud, coach:R.coach }) : null;

    // systems
    R.sys.score=new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.sfx  = new (SFXClass||function(){})();
    R.sys.score.combo=0; R.sys.score.bestCombo=0;
    R.stats = { perfect:0, miss:0, bestCombo:0, stars:0, fever:0 };

    // HUD sync
    hud.hideResult?.();
    hud.setTop?.({ mode:R.modeKey, diff:R.diff, time:R.remain, score:0, combo:0 });
    hud.setMission?.({ icon:'⭐', label:'—', progress:0, need:0, done:false });
    hud.setFever?.({ active:false, value:0 });

    // coach
    R.coach = new CoachClass({ lang: (localStorage.getItem('hha_lang')||'TH') });
    R.coach.onStart();

    // start mode
    if (R.modeInst?.start) R.modeInst.start({ time:R.matchTime, difficulty:R.diff });
    else if (api.init)     api.init({}, hud, { time:R.matchTime, life:1600 });

    // loop
    R.playing   = true;
    R.startedAt = performance.now();
    R._secMark  = performance.now();
    R._dtMark   = performance.now();
    setBadges();

    document.body.setAttribute('data-playing','1');
    $('#menuBar')?.setAttribute('data-hidden','1');
    requestAnimationFrame(gameTick);
  }

  // ---- Menu delegation (mode/diff/howto/sound/start) ----
  (function bindMenuDelegation(){
    const mb=document.getElementById('menuBar'); if(!mb) return;
    function setActive(sel,el){ $$(sel).forEach(b=>b.classList.remove('active')); el.classList.add('active'); }

    mb.addEventListener('click', ev=>{
      const t = ev.target.closest('.btn'); if(!t) return;
      if (t.hasAttribute('data-mode')){ ev.preventDefault(); ev.stopPropagation();
        document.body.setAttribute('data-mode', t.getAttribute('data-mode')); setActive('[data-mode]', t); return; }
      if (t.hasAttribute('data-diff')){ ev.preventDefault(); ev.stopPropagation();
        document.body.setAttribute('data-diff', t.getAttribute('data-diff')); setActive('[data-diff]', t); return; }
      if (t.dataset.action==='howto'){ ev.preventDefault(); ev.stopPropagation();
        toast('แตะอาหารดี เลี่ยงของไม่ดี • ทำภารกิจที่แสดงทีละอัน • เกจ Fever เต็มแล้วไฟลุก!'); return; }
      if (t.dataset.action==='sound'){ ev.preventDefault(); ev.stopPropagation();
        try{
          const now = R.sys?.sfx?.isEnabled?.() ?? true;
          R.sys?.sfx?.setEnabled?.(!now);
          t.textContent = (!now)?'🔊 Sound':'🔇 Sound';
          document.querySelectorAll('audio').forEach(a=>{ try{ a.muted = now; }catch{} });
          toast((!now)?'เสียง: เปิด':'เสียง: ปิด');
        }catch{}
        return;
      }
      if (t.dataset.action==='start'){ ev.preventDefault(); ev.stopPropagation(); startGame(); return; }
    }, false);

    // mobile pointerup safety
    mb.addEventListener('pointerup', e=>{
      const t = e.target.closest('.btn[data-action="start"]');
      if (t){ e.preventDefault(); startGame(); }
    }, { passive:false });
  })();

  // ---- Tiny FX / Toast ----
  function popText(txt, {x,y}={}) {
    const el = document.createElement('div');
    el.textContent = txt;
    el.style.cssText = `position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);
      font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;
      pointer-events:none;z-index:97;opacity:1;transition:all .72s ease-out;`;
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.top = (y-36)+'px'; el.style.opacity='0';});
    setTimeout(()=>el.remove(),720);
  }
  function toast(text){
    let el = $('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 1200);
  }

  // ---- Expose & Key start ----
  window.HHA=window.HHA||{};
  window.HHA.startGame=startGame;
  window.HHA.endGame=endGame;

  setTimeout(()=>{ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);
  window.addEventListener('keydown', (e)=>{
    if ((e.key==='Enter'||e.key===' ') && !R.playing){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if (menuVisible){ e.preventDefault(); startGame(); }
    }
  },{ passive:false });
})();
