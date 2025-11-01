// === Hero Health Academy — game/main.js (stable; Start strong + Countdown + HUD/Coach/Fever/Result) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  // ---------------- Safe stubs (replaced when imports succeed) ----------------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, Leaderboard, HUDClass;

  async function loadCore(){
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch {
      ScoreSystem = class {
        constructor(){ this.value=0; this.combo=0; this.bestCombo=0; }
        add(n){ this.value += (n|0); }
        get(){ return this.value|0; }
        reset(){ this.value=0; this.combo=0; this.bestCombo=0; }
      };
    }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class { constructor(){this._on=true;} setEnabled(v){this._on=!!v;} isEnabled(){return !!this._on;} play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { bindToMain:function(){ return { refresh:function(){} }; }, beginRun:function(){}, endRun:function(){ return null; }, event:function(){}, tick:function(){} }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init:function(){}, beginRun:function(){}, endRun:function(){}, emit:function(){}, getStatSnapshot:function(){ return {}; }, profile:function(){ return {}; } }; }

    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init:function(){}, toggleVR:function(){}, isXRActive:function(){return false;}, isGazeMode:function(){return false;} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      // Fallback coach (tiny, always available)
      CoachClass = class {
        constructor(opts){
          const langOpt = opts && opts.lang ? opts.lang : 'TH';
          this.lang = (localStorage.getItem('hha_lang') || langOpt).toUpperCase();
          this._ensure();
        }
        _ensure(){
          this.box = $('#coachBox');
          if(!this.box){
            this.box = document.createElement('div');
            this.box.id = 'coachBox';
            this.box.style.cssText = 'position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001';
            document.body.appendChild(this.box);
          }
        }
        say(t){ if(!this.box) return; this.box.textContent = t||''; this.box.style.display='block'; clearTimeout(this._to); this._to=setTimeout(()=>{this.box.style.display='none';},1400); }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }

    try { ({ Leaderboard } = await import('./core/leaderboard.js')); }
    catch { Leaderboard = class { submit:function(){}, renderInto:function(){}, getInfo:function(){ return { text:'-' }; } }; }

    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch {
      // Minimal HUD fallback
      HUDClass = class {
        constructor(){
          this.root = $('#hud') || Object.assign(document.createElement('div'),{id:'hud'});
          if(!$('#hud')){ this.root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2000;'; document.body.appendChild(this.root); }

          this.top = document.createElement('div');
          this.top.style.cssText='position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
          this.top.innerHTML =
            '<div style="display:flex;gap:8px;align-items:center">'+
              '<span id="hudMode"  style="padding:4px 8px;border-radius:10px;background:#0b2544;color:#cbe7ff;border:1px solid #15406e;pointer-events:auto">—</span>'+
              '<span id="hudDiff"  style="padding:4px 8px;border-radius:10px;background:#102b52;color:#e6f5ff;border:1px solid #1b4b8a;pointer-events:auto">—</span>'+
              '<span id="hudTime"  style="padding:4px 8px;border-radius:10px;background:#0a1f3d;color:#c9e7ff;border:1px solid #123863;min-width:64px;text-align:center;pointer-events:auto">—</span>'+
            '</div>'+
            '<div style="display:flex;gap:8px;align-items:center">'+
              '<span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#bbf7d0;border:1px solid #134064;pointer-events:auto">Score: <b id="hudScore">0</b></span>'+
              '<span style="padding:4px 8px;border-radius:10px;background:#0b1c36;color:#fde68a;border:1px solid #134064;pointer-events:auto">Combo: <b id="hudCombo">0</b></span>'+
            '</div>';
          this.root.appendChild(this.top);
          this.$mode=this.top.querySelector('#hudMode');
          this.$diff=this.top.querySelector('#hudDiff');
          this.$time=this.top.querySelector('#hudTime');
          this.$score=this.top.querySelector('#hudScore');
          this.$combo=this.top.querySelector('#hudCombo');

          this.chips = Object.assign(document.createElement('div'),{id:'questChips'});
          this.chips.style.cssText='position:absolute;left:12px;bottom:78px;display:flex;flex-wrap:wrap;gap:6px;max-width:90vw;pointer-events:none';
          this.root.appendChild(this.chips);

          this.result = document.createElement('div');
          this.result.id='resultModal';
          this.result.style.cssText='position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto;z-index:2002';
          this.result.innerHTML =
            '<div style="width:min(520px,92vw);background:#0e1930;border:1px solid #16325d;border-radius:16px;padding:16px;color:#e6f2ff">'+
              '<h3 id="resTitle" style="margin:0 0 6px;font:900 20px ui-rounded">Result</h3>'+
              '<p  id="resDesc"  style="margin:0 0 10px;color:#cfe7ff">—</p>'+
              '<div id="resStats" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>'+
              '<div style="display:flex;gap:8px;justify-content:flex-end">'+
                '<button id="resHome"  style="padding:8px 10px;border-radius:10px;background:#0f1e38;color:#e6f2ff;border:1px solid #16325d;cursor:pointer">🏠 Home</button>'+
                '<button id="resRetry" style="padding:8px 10px;border-radius:10px;background:#123054;color:#dff2ff;border:1px solid #1e4d83;cursor:pointer">↻ Retry</button>'+
              '</div>'+
            '</div>';
          this.root.appendChild(this.result);
          this.$resTitle=this.result.querySelector('#resTitle');
          this.$resDesc =this.result.querySelector('#resDesc');
          this.$resStats=this.result.querySelector('#resStats');
          this.onHome=null; this.onRetry=null;
          this.result.querySelector('#resHome').onclick = ()=>{ if(this.onHome) this.onHome(); };
          this.result.querySelector('#resRetry').onclick= ()=>{ if(this.onRetry) this.onRetry(); };
        }
        setTop(o){
          if(!o) return;
          if(o.mode  != null) this.$mode.textContent  = String(o.mode);
          if(o.diff  != null) this.$diff.textContent  = String(o.diff);
          if(o.time  != null) this.$time.textContent  = String(o.time)+'s';
          if(o.score != null) this.$score.textContent = String(o.score|0);
          if(o.combo != null) this.$combo.textContent = String(o.combo|0);
        }
        setQuestChips(list){
          const frag=document.createDocumentFragment();
          const arr = Array.isArray(list)?list:[];
          for(let i=0;i<arr.length;i++){
            const m=arr[i];
            const pct=m && m.need>0 ? Math.min(100, Math.round((m.progress/m.need)*100)) : 0;
            const d=document.createElement('div');
            d.style.cssText='pointer-events:auto;display:inline-flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;border:1px solid #16325d;background:#0d1a31;color:#e6f2ff';
            d.innerHTML =
              '<span style="font-size:16px">'+(m.icon||'⭐')+'</span>'+
              '<span style="font:700 12.5px ui-rounded">'+(m.label||m.key||'')+'</span>'+
              '<span style="font:700 12px;color:#a7f3d0;margin-left:6px">'+(m.progress||0)+'/'+(m.need||0)+'</span>'+
              '<i style="height:6px;width:100px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;display:inline-block;margin-left:6px">'+
                '<b style="display:block;height:100%;width:'+pct+'%;background:'+(m && m.done ? (m.fail ? '#ef4444' : '#22c55e') : '#22d3ee')+'"></b>'+
              '</i>';
            frag.appendChild(d);
          }
          this.chips.innerHTML=''; this.chips.appendChild(frag);
        }
        say(t){
          const box=$('#coachBox'); if(!box) return;
          box.textContent=t||''; box.style.display='block';
          clearTimeout(this._to); this._to=setTimeout(()=>{ box.style.display='none'; },1600);
        }
        showResult(o){
          const data = o && typeof o==='object' ? o : {};
          this.$resTitle.textContent = String(data.title||'Result');
          this.$resDesc.textContent  = String(data.desc||'—');
          const frag=document.createDocumentFragment();
          const stats = Array.isArray(data.stats)?data.stats:[];
          for(let i=0;i<stats.length;i++){
            const s=stats[i];
            const b=document.createElement('div');
            b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38';
            b.textContent=String(s);
            frag.appendChild(b);
          }
          this.$resStats.innerHTML=''; this.$resStats.appendChild(frag);
          this.result.style.display='flex';
        }
        hideResult(){ this.result.style.display='none'; }
      };
    }
  }

  // ---------------- Mode loader ----------------
  const MODE_PATH = (k)=>`./modes/${k}.js`;
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return {
      name:mod.name||key,
      create:mod.create||null,
      init:mod.init||null,
      tick:mod.tick||null,
      update:mod.update||null,
      start:mod.start||null,
      cleanup:mod.cleanup||null
    };
  }

  // ---------------- FX ----------------
  const FX = {
    popText:function(txt,pos){
      const x = pos && pos.x ? pos.x|0 : 0;
      const y = pos && pos.y ? pos.y|0 : 0;
      const el=document.createElement('div');
      el.textContent=String(txt);
      el.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;transform:translate(-50%,-50%);font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:97;opacity:1;transition:all .72s ease-out;';
      document.body.appendChild(el);
      requestAnimationFrame(function(){ el.style.top=(y-36)+'px'; el.style.opacity='0'; });
      setTimeout(function(){ try{el.remove();}catch(e){}; },700);
    },
    flashPenalty:function(){
      document.body.classList.add('flash-danger');
      setTimeout(function(){ document.body.classList.remove('flash-danger'); }, 140);
    }
  };

  // ---------------- Engine state ----------------
  const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode, diff){
    const m = mode || 'goodjunk';
    const d = diff || 'Normal';
    const base = TIME_BY_MODE[m] != null ? TIME_BY_MODE[m] : 45;
    if (d==='Easy') return base + 5;
    if (d==='Hard') return Math.max(20, base - 5);
    return base;
  }

  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null,
    matchTime:45,
    feverActive:false, feverBreaks:0
  };
  let hud=null;

  // ---------------- UI sync ----------------
  function setBadges(){
    if (hud && hud.setTop){
      const scoreNow = R.sys && R.sys.score && R.sys.score.get ? R.sys.score.get() : 0;
      const comboNow = R.sys && R.sys.score ? (R.sys.score.combo|0) : 0;
      hud.setTop({ mode:R.modeKey, diff:R.diff, time:R.remain, score:scoreNow, combo:comboNow });
    }
    const mB=$('#modeBadge'); if(mB) mB.textContent=R.modeKey;
    const dB=$('#diffBadge'); if(dB) dB.textContent=R.diff;
    const sV=$('#scoreVal'); if(sV) sV.textContent=(R.sys && R.sys.score && R.sys.score.get ? R.sys.score.get() : 0);
  }

  // ---------------- Event bus ----------------
  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit:function(e){
        const pts=(e && e.points)|0;
        if(pts){
          R.sys.score.add(pts);
          R.sys.score.combo=(R.sys.score.combo|0)+1;
          if((R.sys.score.combo|0)>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo|0;
        }
        if(!R.feverActive && (R.sys.score.combo|0)>=10){
          R.feverActive=true; R.feverBreaks=0;
          try{Quests.event('fever',{on:true});}catch(_e){}
        }
        if(e && e.ui) FX.popText('+'+pts, e.ui);
        try{ Quests.event('hit',{ result:e && e.kind ? e.kind : 'good', meta:e && e.meta ? e.meta : {}, points:pts, comboNow:R.sys.score.combo|0 }); }catch(_e2){}
        setBadges();
      },
      miss:function(info){
        if(R.feverActive){
          R.feverBreaks++;
          if(R.feverBreaks>=3){
            R.feverActive=false; R.feverBreaks=0;
            try{Quests.event('fever',{on:false});}catch(_e3){}
          }
        }
        R.sys.score.combo=0;
        FX.flashPenalty();
        try{ Quests.event('miss', info || {}); }catch(_e4){}
        if(R.coach && R.coach.onBad) R.coach.onBad();
        setBadges();
      },
      power:function(k){ try{ Quests.event('power',{kind:k}); }catch(_e5){} }
    };
  }

  // ---------------- Countdown (3-2-1-GO) ----------------
  function doCountdown(onDone){
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);font:900 64px ui-rounded,system-ui;color:#e6f4ff;text-shadow:0 6px 24px rgba(0,0,0,.5);z-index:2001;pointer-events:none';
    document.body.appendChild(el);
    let seq = ['3','2','1','GO!'];
    function step(){
      if(seq.length===0){ try{el.remove();}catch(_e){}; if(onDone) onDone(); return; }
      el.textContent = seq.shift();
      setTimeout(step, 650);
    }
    step();
  }

  // ---------------- Loop ----------------
  function gameTick(){
    if(!R.playing) return;
    const tNow=performance.now();

    const secGone=Math.floor((tNow-R._secMark)/1000);
    if(secGone>=1){
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=tNow;
      setBadges();
      if(R.remain===10 && R.coach && R.coach.onTimeLow){ R.coach.onTimeLow(); }
      try{ Quests.tick({ score:R.sys.score.get ? R.sys.score.get() : 0, dt:secGone, fever:R.feverActive }); }catch(_e){}
    }

    try{
      const dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
      if(R.modeAPI && typeof R.modeAPI.update==='function'){ R.modeAPI.update(dt,busFor()); }
      else if(R.modeInst && typeof R.modeInst.update==='function'){ R.modeInst.update(dt,busFor()); }
      else if(R.modeAPI && typeof R.modeAPI.tick==='function'){ R.modeAPI.tick(R.state||{}, R.sys, hud||{}); }
    }catch(e){ console.warn('[mode.update] error',e); }

    if(R.remain<=0){ endGame(); return; }
    R.raf=requestAnimationFrame(gameTick);
  }

  // ---------------- End game ----------------
  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    const score=R.sys.score && R.sys.score.get ? R.sys.score.get() : 0;
    const bestC=R.sys.score ? (R.sys.score.bestCombo|0) : 0;

    try{ if(R.modeInst && R.modeInst.cleanup) R.modeInst.cleanup(); if(R.modeAPI && R.modeAPI.cleanup) R.modeAPI.cleanup(R.state,hud); }catch(_e7){}
    try{ Quests.endRun({ score:score }); }catch(_e8){}
    try{ if(R.coach && R.coach.onEnd) R.coach.onEnd(score); }catch(_e9){}
    try{ Progress.endRun({ score:score, bestCombo:bestC }); }catch(_e10){}

    document.body.removeAttribute('data-playing');
    const mb = $('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }

    try{
      const res = (typeof Quests.endRun==='function' && Quests.endRun({score:score})) || null;
      if(hud && typeof hud.showResult==='function'){
        hud.showResult({
          title:'Result',
          desc:'Mode: '+R.modeKey+' • Diff: '+R.diff,
          stats:[
            'Score: '+score,
            'Best Combo: '+bestC,
            'Time: '+(R.matchTime|0)+'s',
            res && res.totalDone!=null ? ('Quests: '+res.totalDone) : ''
          ].filter(function(t){ return !!t; })
        });
        hud.onHome = function(){ hud.hideResult(); const m2=$('#menuBar'); if(m2){ m2.removeAttribute('data-hidden'); m2.style.display='flex'; } };
        hud.onRetry = function(){ hud.hideResult(); startGame(); };
      }
    }catch(_e11){}

    window.HHA._busy=false;
  }

  // ---------------- Start game ----------------
  async function startGame(){
    if(window.HHA && window.HHA._busy) return;
    if(!window.HHA) window.HHA = {};
    window.HHA._busy=true;

    await loadCore();
    try{ Progress.init(); }catch(_e12){}

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';

    // Ensure spawn host exists (for DOM-spawn modes like goodjunk)
    if(!document.getElementById('spawnHost')){
      const h=document.createElement('div');
      h.id='spawnHost';
      h.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;';
      document.body.appendChild(h);
    } else {
      document.getElementById('spawnHost').style.pointerEvents='auto';
      document.getElementById('spawnHost').style.zIndex='5';
    }

    R.matchTime = getMatchTime(R.modeKey,R.diff);
    R.remain    = R.matchTime|0;

    if(!hud) hud = new HUDClass();
    if(hud.hideResult) hud.hideResult();
    if(hud.setTop) hud.setTop({ mode:R.modeKey, diff:R.diff, time:R.remain, score:0, combo:0 });

    let api=null;
    try { api = await loadMode(R.modeKey); }
    catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); toast('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }
    R.modeAPI = api;

    R.sys.score = new (ScoreSystem||function(){})();
    if(R.sys.score.reset) R.sys.score.reset();
    R.sys.sfx   = new (SFXClass||function(){})();
    R.sys.score.combo=0; R.sys.score.bestCombo=0;
    R.feverActive=false; R.feverBreaks=0;

    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    if(R.coach && R.coach.onStart) R.coach.onStart();

    try { Quests.bindToMain({ hud:hud, coach:R.coach }); }catch(_e13){}
    try { Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime); }catch(_e14){}

    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };

    // Hide menu immediately
    const mb = $('#menuBar');
    if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    document.body.setAttribute('data-playing','1');

    // Countdown then start actual mode logic + loop
    doCountdown(function(){
      // Support: create().start(), init(), or start()
      try{
        if(api && typeof api.create==='function'){
          R.modeInst = api.create({ engine:{fx:FX}, hud:hud, coach:R.coach });
          if(R.modeInst && typeof R.modeInst.start==='function'){ R.modeInst.start({ time:R.matchTime, difficulty:R.diff }); }
        } else if(api && typeof api.init==='function'){
          api.init(R.state, hud, { time:R.matchTime, life:1600 });
        } else if(api && typeof api.start==='function'){
          api.start({ time:R.matchTime, difficulty:R.diff });
        }
      }catch(e){
        console.error('[mode.start/init] error', e);
        toast('Mode failed to start');
      }

      R.playing=true;
      R.startedAt=performance.now();
      R._secMark =performance.now();
      R._dtMark  =performance.now();
      setBadges();

      requestAnimationFrame(gameTick);
    });
  }

  // ---------------- Menu delegation + Start strong bind ----------------
  (function bindMenu(){
    const mb = $('#menuBar'); if(!mb) return;

    function setActive(sel,el){ $$(sel).forEach(function(b){ b.classList.remove('active'); }); el.classList.add('active'); }

    mb.addEventListener('click',function(ev){
      const t=ev.target.closest('.btn'); if(!t) return;

      if(t.hasAttribute('data-mode')){ ev.preventDefault(); ev.stopPropagation();
        document.body.setAttribute('data-mode', t.getAttribute('data-mode')); setActive('[data-mode]',t); setBadges(); return; }

      if(t.hasAttribute('data-diff')){ ev.preventDefault(); ev.stopPropagation();
        document.body.setAttribute('data-diff', t.getAttribute('data-diff')); setActive('[data-diff]',t); setBadges(); return; }

      if(t.dataset.action==='howto'){ ev.preventDefault(); ev.stopPropagation();
        toast('แตะของดี • เลี่ยงของไม่ดี • คอมโบ ≥10 = FEVER • ⭐/🛡️ คือ Power'); return; }

      if(t.dataset.action==='sound'){ ev.preventDefault(); ev.stopPropagation();
        const now = (R.sys && R.sys.sfx && typeof R.sys.sfx.isEnabled==='function') ? R.sys.sfx.isEnabled() : true;
        if(R.sys && R.sys.sfx && typeof R.sys.sfx.setEnabled==='function') R.sys.sfx.setEnabled(!now);
        t.textContent = (!now)?'🔊 Sound':'🔇 Sound';
        document.querySelectorAll('audio').forEach(function(a){ try{ a.muted = now; }catch(_e){}; });
        toast((!now)?'เสียง: เปิด':'เสียง: ปิด'); return;
      }

      if(t.dataset.action==='start'){ ev.preventDefault(); ev.stopPropagation(); startGame(); return; }
    }, false);

    const b = $('#btn_start');
    if(b){
      const clone=b.cloneNode(true);
      b.parentNode.replaceChild(clone,b);
      ['click','pointerup','touchend'].forEach(function(evName){
        clone.addEventListener(evName,function(e){ e.preventDefault(); e.stopPropagation(); startGame(); },{capture:true,passive:false});
      });
      clone.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); startGame(); } },{capture:true});
    }
  })();

  // ---------------- Toast ----------------
  function toast(text){
    let el=$('#toast');
    if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=String(text);
    el.classList.add('show');
    setTimeout(function(){ el.classList.remove('show'); },1200);
  }

  // ---------------- Expose ----------------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // Canvas never blocks UI
  setTimeout(function(){ const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);

  // Keyboard quick start
  window.addEventListener('keydown',function(e){
    if((e.key==='Enter'||e.key===' ')&&!(document.body.getAttribute('data-playing')==='1')){
      const menuVisible = !($('#menuBar') && $('#menuBar').hasAttribute('data-hidden'));
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  },{passive:false});
})();
