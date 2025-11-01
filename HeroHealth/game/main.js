// === Hero Health Academy — game/main.js (Coach import hardened + HUD/Board/Time sync) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ---------- Utils: toast / fatal banner ----------
  function toast(text){
    let el = $('#toast');
    if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 1400);
  }
  function fatal(lines){
    let w = $('#bootWarn');
    if(!w){ w = document.createElement('div'); w.id='bootWarn'; document.body.appendChild(w); }
    const arr = Array.isArray(lines) ? lines : [String(lines)];
    w.innerHTML = arr.map(t=>`<div style="white-space:pre-wrap">${t}</div>`).join('');
    w.style.display = 'block';
  }
  // เลือกตัวที่เป็น class/constructor จากโมดูล
  function asCtor(mod, prefKeys=['Coach','default']){
    if (typeof mod === 'function') return mod;
    if (mod && typeof mod === 'object'){
      for (const k of prefKeys){
        const v = mod[k];
        if (typeof v === 'function') return v;
      }
    }
    return null;
  }

  // ---------- Safe stubs ----------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, Leaderboard, HUDClass;

  // Fallback coach ที่ทำงานได้แน่
  class FallbackCoach {
    constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase(); }
    _say(msg){ try{ hud?.say?.(msg); }catch{} }
    onStart(){ this._say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
    onGood(){ this._say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
    onPerfect(){ this._say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
    onBad(){ this._say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
    onTimeLow(){ this._say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
    onEnd(score){ this._say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
  }

  async function loadCore() {
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n=0){this.value+=n;} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ constructor(){this.enabled=true;} setEnabled(v){this.enabled=!!v;} isEnabled(){return!!this.enabled} play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { beginRun(){}, event(){}, tick(){}, endRun(){return[]}, bindToMain(){return{refresh(){}}} }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }

    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} }; }

    // ✅ Coach: รองรับทุกแบบ export (named/default/object) + fallback
    try {
      const coachMod = await import('./core/coach.js');
      CoachClass = asCtor(coachMod) || FallbackCoach;
    } catch {
      CoachClass = FallbackCoach;
    }

    try { ({ Leaderboard } = await import('./core/leaderboard.js')); }
    catch { Leaderboard = class{ submit(){} renderInto(){} getInfo(){return{text:'Scope:-'}} }; }

    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch { HUDClass = class{ constructor(){this.root=document.getElementById('hud')||Object.assign(document.createElement('div'),{id:'hud'});if(!document.getElementById('hud'))document.body.appendChild(this.root);} setTop(){} setQuestChips(){} say(){} showResult(){} hideResult(){} }; }
  }

  // ---------- Mode loader ----------
  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return {
      name: mod.name||key, create:mod.create||null, init:mod.init||null, tick:mod.tick||null,
      pickMeta:mod.pickMeta||null, onHit:mod.onHit||null, cleanup:mod.cleanup||null,
      fx:mod.fx||{}, update:mod.update||null
    };
  }

  // ---------- FX helper ----------
  const FX = {
    popText(txt,{x,y,ms=700}={}){
      const el=document.createElement('div');
      el.textContent=txt;
      el.style.cssText=`position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);
        font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;
        pointer-events:none;z-index:97;opacity:1;transition:all .72s ease-out;`;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{el.style.top=(y-36)+'px';el.style.opacity='0';});
      setTimeout(()=>el.remove(),ms);
    }
  };

  // ---------- Engine state ----------
  let R={playing:false,startedAt:0,remain:45,raf:0,sys:{score:null,sfx:null},
         modeKey:'goodjunk',modeAPI:null,modeInst:null,state:null,coach:null,
         diff:'Normal',board:null,boardScope:'month',matchTime:45};
  let hud=null;

  // ---------- Time config ----------
  const TIME_BY_MODE={ goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode='goodjunk',diff='Normal'){
    const base=TIME_BY_MODE[mode]??45;
    if(diff==='Easy') return base+5;
    if(diff==='Hard') return Math.max(20,base-5);
    return base;
  }

  function setBadges(){
    hud?.setTop?.({mode:R.modeKey,diff:R.diff,time:R.remain,score:R.sys?.score?.get?.()||0,combo:R.sys?.score?.combo|0});
    const mB=$('#modeBadge');if(mB)mB.textContent=R.modeKey;
    const dB=$('#diffBadge');if(dB)dB.textContent=R.diff;
    const sV=$('#scoreVal');if(sV)sV.textContent=R.sys?.score?.get?.()||0;
  }

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
        setBadges();
        if(e?.ui)FX.popText(`+${pts}`,e.ui);
        try{Quests.event('hit',{result:e?.kind||'good',meta:e?.meta||{},comboNow:R.sys.score.combo|0});}catch{}
      },
      miss(){ R.sys.score.combo=0; setBadges(); }
    };
  }

  // ---------- Main loop ----------
  function gameTick(){
    if(!R.playing)return;
    const tNow=performance.now();
    const secGone=Math.floor((tNow-R._secMark)/1000);
    if(secGone>=1){
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=tNow;
      setBadges();
      try{ if(R.remain===10) R.coach?.onTimeLow?.(); Quests.tick({score:(R.sys.score.get?.()||0)});}catch{}
    }
    try{
      if(typeof R.modeAPI?.update==='function'){
        const dt=(tNow-(R._dtMark||tNow))/1000;R._dtMark=tNow;
        R.modeAPI.update(dt,busFor());
      }else if(R.modeInst?.update){
        const dt=(tNow-(R._dtMark||tNow))/1000;R._dtMark=tNow;
        R.modeInst.update(dt,busFor());
      }else if(R.modeAPI?.tick){
        R.modeAPI.tick(R.state||{},R.sys,hud||{});
      }
    }catch(e){console.warn('[mode.update] error',e);}
    if(R.remain<=0)return endGame(false);
    R.raf=requestAnimationFrame(gameTick);
  }

  function endGame(){
    if(!R.playing)return;
    R.playing=false;cancelAnimationFrame(R.raf);
    const score=R.sys?.score?.get?.()||0;
    const bestC=R.sys?.score?.bestCombo|0;
    try{Quests.endRun({score});}catch{}
    try{R.modeInst?.cleanup?.();R.modeAPI?.cleanup?.(R.state,hud);}catch{}
    try{
      const name=(localStorage.getItem('hha_name')||'').trim();
      R.board?.submit(R.modeKey,R.diff,score,{name:name||'Player',meta:{bestCombo:bestC}});
    }catch(e){console.warn('[board.submit]',e);}
    document.body.removeAttribute('data-playing');
    $('#menuBar')?.removeAttribute('data-hidden');
    R.coach?.onEnd?.(score);
    try{Progress.endRun({score,bestCombo:bestC});}catch{}
    try{
      hud.showResult({
        title:'Result',
        desc:`Mode: ${R.modeKey} • Diff: ${R.diff}`,
        stats:[ `Score: ${score}`, `Best Combo: ${bestC}`, `Time: ${R.matchTime|0}s` ]
      });
    }catch{}
    hud.onHome=()=>{hud.hideResult();$('#menuBar')?.removeAttribute('data-hidden');};
    hud.onRetry=()=>{hud.hideResult();startGame();};
    window.HHA._busy=false;
  }

  async function startGame(){
    if(window.HHA?._busy) return;
    window.HHA._busy = true;
    let startBtn = $('#btn_start');
    try{
      const selMode = (window.__HHA_MODE || document.body.getAttribute('data-mode') || 'goodjunk');
      const selDiff = (window.__HHA_DIFF || document.body.getAttribute('data-diff') || 'Normal');
      R.modeKey = selMode; R.diff = selDiff;

      await loadCore();
      Progress.init?.();

      if(!R.board){
        R.board=new Leaderboard({key:'hha_board',maxKeep:300,retentionDays:180});
        try{const nm=localStorage.getItem('hha_name')||'';const inp=$('#playerName');if(inp)inp.value=nm;}catch{}
      }

      R.matchTime=getMatchTime(R.modeKey,R.diff);
      R.remain=R.matchTime|0;

      if(!hud)hud=new HUDClass();
      hud.hideResult?.();
      hud.setTop?.({mode:R.modeKey,diff:R.diff,time:R.remain,score:0,combo:0});

      let api;
      try{ api = await loadMode(R.modeKey); }
      catch(e){ throw new Error(`Failed to load mode "${R.modeKey}": ${e?.message||e}`); }

      R.sys.score=new (ScoreSystem||function(){})();
      R.sys.score.reset?.();
      R.sys.sfx=new (SFXClass||function(){})();
      R.sys.score.combo=0;R.sys.score.bestCombo=0;

      // ✅ สร้าง Coach แบบกันพัง: ถ้า CoachClass ไม่ใช่ constructor ให้ใช้ FallbackCoach
      const CoachCtor = (typeof CoachClass==='function') ? CoachClass : FallbackCoach;
      R.coach=new CoachCtor({lang:(localStorage.getItem('hha_lang')||'TH')});
      R.coach.onStart?.();

      try{Quests.bindToMain({hud,coach:R.coach});hud.setQuestChips?.([]);}catch{}

      R.state={difficulty:R.diff,lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(),ctx:{}};
      R.modeAPI=api;

      if(api.create){
        R.modeInst=api.create({engine:{fx:FX},hud,coach:R.coach});
        R.modeInst.start?.({time:R.matchTime});
      }else if(api.init){
        api.init(R.state,hud,{time:R.matchTime,life:1600});
      }

      try{Quests.beginRun(R.modeKey,R.diff,(R.state.lang||'TH'),R.matchTime);}catch{}
      try{Progress.beginRun(R.modeKey,R.diff,(R.state.lang||'TH'));}catch{}

      R.playing=true;
      R.startedAt=performance.now();
      R._secMark=performance.now();
      R._dtMark=performance.now();
      setBadges();
      document.body.setAttribute('data-playing','1');
      $('#menuBar')?.setAttribute('data-hidden','1');
      requestAnimationFrame(gameTick);
    }catch(err){
      console.error('[HHA.startGame] fatal', err);
      fatal([
        '⚠️ เริ่มเกมไม่สำเร็จ',
        String(err?.message||err),
        '• ตรวจ path โหมดใน /game/modes/*.js',
        '• ตรวจ error บน Console เพื่อดูบรรทัดที่พัง'
      ]);
      toast('เริ่มเกมล้มเหลว');
      window.HHA._busy = false;
      startBtn?.removeAttribute('disabled');
      return;
    }
    startBtn?.removeAttribute('disabled');
  }

  // ---------- Leaderboard UI ----------
  function openBoard(scope){const w=$('#boardWrap');if(!w)return;if(scope)R.boardScope=scope;
    try{const inp=$('#playerName');if(inp){const nm=localStorage.getItem('hha_name')||'';inp.value=nm;}}catch{}
    try{const host=$('#boardHost');R.board.renderInto(host,{scope:R.boardScope});
      const info=R.board.getInfo(R.boardScope);const inf=$('#boardInfo');if(inf)inf.textContent=info.text;
    }catch(e){console.warn('[board.render]',e);}
    w.style.display='flex';
  }
  function closeBoard(){const w=$('#boardWrap');if(w)w.style.display='none';}

  // ---------- Menu delegation (รวม Start) ----------
  (function bindMenuDelegation(){
    const mb=document.getElementById('menuBar');if(!mb)return;
    function setActive(sel,el){$$(sel).forEach(b=>b.classList.remove('active'));el.classList.add('active');}
    mb.addEventListener('click',ev=>{
      const t=ev.target.closest('.btn');if(!t)return;
      if(t.hasAttribute('data-mode')){ev.preventDefault();ev.stopPropagation();R.modeKey=t.getAttribute('data-mode')||R.modeKey;setActive('[data-mode]',t);setBadges();return;}
      if(t.hasAttribute('data-diff')){ev.preventDefault();ev.stopPropagation();R.diff=t.getAttribute('data-diff')||R.diff;setActive('[data-diff]',t);setBadges();return;}
      if(t.dataset.action==='howto'){ev.preventDefault();ev.stopPropagation();toast('แตะอาหารดี หลีกเลี่ยงของไม่ดี ภายในเวลาที่กำหนด');return;}
      if(t.dataset.action==='sound'){ev.preventDefault();ev.stopPropagation();try{
        const now=R.sys?.sfx?.isEnabled?.()??true;R.sys?.sfx?.setEnabled?.(!now);
        t.textContent=(!now)?'🔊 Sound':'🔇 Sound';
        document.querySelectorAll('audio').forEach(a=>{try{a.muted=now;}catch{}});
        toast((!now)?'เสียง: เปิด':'เสียง: ปิด');}catch{}return;}
      if(t.dataset.action==='board'){ev.preventDefault();ev.stopPropagation();openBoard(R.boardScope);return;}
      if(t.dataset.action==='start'){ev.preventDefault();ev.stopPropagation(); const b=$('#btn_start'); b?.setAttribute('disabled',''); toast('Starting…'); startGame(); return;}
    }, true);
    mb.addEventListener('pointerup',e=>{
      const t=e.target.closest('.btn[data-action="start"]');
      if(t){e.preventDefault(); const b=$('#btn_start'); b?.setAttribute('disabled',''); toast('Starting…'); startGame(); }
    },{passive:false,capture:true});
  })();

  // ---------- Expose & misc ----------
  window.HHA=window.HHA||{};
  window.HHA.startGame=startGame;
  window.HHA.endGame=endGame;
  window.HHA.openBoard=openBoard;
  window.HHA.closeBoard=closeBoard;

  setTimeout(()=>{const c=$('#c');if(c){c.style.pointerEvents='none';c.style.zIndex='1';}},0);
  window.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&!R.playing){
      const menuVisible=!$('#menuBar')?.hasAttribute('data-hidden');
      if(menuVisible){e.preventDefault(); toast('Starting…'); startGame(); }
    }
  },{passive:false});
  window.addEventListener('error', e=> fatal(['⚠️ Runtime error:', String(e?.message||e)]) );
})();
