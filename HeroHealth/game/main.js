// === Hero Health Academy — game/main.js (stable; FEVER + big-10s + quests summary) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function(){
  // ---------- helpers ----------
  function $(s){ return document.querySelector(s); }
  function $$(s){ return document.querySelectorAll(s); }

  // ---------- safe fallbacks ----------
  var ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, Leaderboard, HUDClass;

  async function loadCore(){
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch {
      ScoreSystem = function(){ this.value=0; this.combo=0; this.bestCombo=0; };
      ScoreSystem.prototype.add = function(n){ this.value += (n|0); };
      ScoreSystem.prototype.get = function(){ return this.value|0; };
      ScoreSystem.prototype.reset = function(){ this.value=0; this.combo=0; this.bestCombo=0; };
    }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch {
      SFXClass = function(){ this._on=true; };
      SFXClass.prototype.setEnabled = function(v){ this._on=!!v; };
      SFXClass.prototype.isEnabled  = function(){ return !!this._on; };
      SFXClass.prototype.play=SFXClass.prototype.tick=SFXClass.prototype.good=
      SFXClass.prototype.bad=SFXClass.prototype.perfect=SFXClass.prototype.power=function(){};
    }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch {
      Quests = {
        bindToMain:function(){ return { refresh:function(){} }; },
        beginRun:function(){}, endRun:function(){ return { totalDone:0 }; },
        event:function(){}, tick:function(){}, buildSummary:function(){ return []; }
      };
    }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch {
      Progress = { init:function(){}, beginRun:function(){}, endRun:function(){}, emit:function(){},
                   getStatSnapshot:function(){return {};}, profile:function(){return {}; } };
    }

    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch {
      VRInput = { init:function(){}, toggleVR:function(){}, isXRActive:function(){return false;}, isGazeMode:function(){return false;} };
    }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = function(opts){
        var langOpt = (opts && opts.lang) ? opts.lang : 'TH';
        this.lang = (localStorage.getItem('hha_lang') || langOpt).toUpperCase();
        this._ensure();
      };
      CoachClass.prototype._ensure = function(){
        this.box = $('#coachBox');
        if(!this.box){
          this.box = document.createElement('div');
          this.box.id='coachBox';
          this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001';
          document.body.appendChild(this.box);
        }
      };
      CoachClass.prototype.say = function(t){
        if(!this.box) return;
        this.box.textContent = t||'';
        this.box.style.display='block';
        var self=this;
        clearTimeout(this._to);
        this._to=setTimeout(function(){ self.box.style.display='none'; }, 1400);
      };
      CoachClass.prototype.onStart   = function(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); };
      CoachClass.prototype.onGood    = function(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); };
      CoachClass.prototype.onPerfect = function(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); };
      CoachClass.prototype.onBad     = function(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); };
      CoachClass.prototype.onTimeLow = function(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); };
      CoachClass.prototype.onEnd     = function(score){ this.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); };
    }

    try { ({ Leaderboard } = await import('./core/leaderboard.js')); }
    catch {
      var LeaderboardFallback = function(){};
      LeaderboardFallback.prototype.submit=function(){};
      LeaderboardFallback.prototype.renderInto=function(){};
      LeaderboardFallback.prototype.getInfo=function(){ return { text:'-' }; };
      Leaderboard = LeaderboardFallback;
    }

    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch {
      HUDClass = function(){
        this.root = $('#hud') || document.createElement('div');
        if(!$('#hud')){
          this.root.id='hud';
          this.root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2000';
          document.body.appendChild(this.root);
        }
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

        this.chips = document.createElement('div');
        this.chips.id='questChips';
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
        var self=this;
        this.onHome=null; this.onRetry=null;
        this.result.querySelector('#resHome').onclick = function(){ if(self.onHome) self.onHome(); };
        this.result.querySelector('#resRetry').onclick= function(){ if(self.onRetry) self.onRetry(); };
      };
      HUDClass.prototype.setTop = function(o){
        if(!o) return;
        if(o.mode  != null) this.$mode.textContent  = String(o.mode);
        if(o.diff  != null) this.$diff.textContent  = String(o.diff);
        if(o.time  != null) this.$time.textContent  = String(o.time)+'s';
        if(o.score != null) this.$score.textContent = String(o.score|0);
        if(o.combo != null) this.$combo.textContent = String(o.combo|0);
      };
      HUDClass.prototype.setQuestChips = function(list){
        var frag=document.createDocumentFragment();
        var arr = Array.isArray(list)?list:[];
        for(var i=0;i<arr.length;i++){
          var m=arr[i];
          var pct = (m && m.need>0) ? Math.min(100, Math.round((m.progress/m.need)*100)) : 0;
          var d=document.createElement('div');
          d.style.cssText='pointer-events:auto;display:inline-flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;border:1px solid #16325d;background:#0d1a31;color:#e6f2ff';
          if(m.active) d.style.outline='2px solid #22d3ee';
          d.innerHTML =
            '<span style="font-size:16px">'+(m.icon||'⭐')+'</span>'+
            '<span style="font:700 12.5px ui-rounded">'+(m.label||m.key||'')+'</span>'+
            '<span style="font:700 12px;color:#a7f3d0;margin-left:6px">'+((m.progress||0)+'/'+(m.need||0))+'</span>'+
            '<i style="height:6px;width:100px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;display:inline-block;margin-left:6px">'+
              '<b style="display:block;height:100%;width:'+pct+'%;background:'+(m.done?(m.fail?'#ef4444':'#22c55e'):'#22d3ee')+'"></b>'+
            '</i>';
          frag.appendChild(d);
        }
        this.chips.innerHTML=''; this.chips.appendChild(frag);
      };
      HUDClass.prototype.say = function(t){
        var box=$('#coachBox'); if(!box) return;
        box.textContent=t||''; box.style.display='block';
        clearTimeout(this._to);
        var self=this; this._to=setTimeout(function(){ box.style.display='none'; },1600);
      };
      HUDClass.prototype.showResult = function(o){
        var data = o && typeof o==='object' ? o : {};
        this.$resTitle.textContent = String(data.title||'Result');
        this.$resDesc.textContent  = String(data.desc||'—');
        var frag=document.createDocumentFragment();
        var stats = Array.isArray(data.stats)?data.stats:[];
        for(var i=0;i<stats.length;i++){
          var s=stats[i];
          var b=document.createElement('div');
          b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38';
          b.textContent=String(s);
          frag.appendChild(b);
        }
        this.$resStats.innerHTML=''; this.$resStats.appendChild(frag);
        this.result.style.display='flex';
      };
      HUDClass.prototype.hideResult = function(){ this.result.style.display='none'; };
    }
  }

  // ---------- mode loader ----------
  function MODE_PATH(k){ return './modes/'+k+'.js'; }
  async function loadMode(key){
    var mod = await import(MODE_PATH(key));
    return {
      name:mod.name||key,
      create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null,
      start:mod.start||null, cleanup:mod.cleanup||null
    };
  }

  // ---------- FX ----------
  var FX = {
    popText:function(txt,pos){
      var x = (pos && pos.x)|0;
      var y = (pos && pos.y)|0;
      var el=document.createElement('div');
      el.textContent=String(txt);
      el.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;transform:translate(-50%,-50%);font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:2100;opacity:1;transition:all .72s ease-out;';
      document.body.appendChild(el);
      requestAnimationFrame(function(){ el.style.top=(y-36)+'px'; el.style.opacity='0'; });
      setTimeout(function(){ try{el.remove();}catch(e){}; },700);
    }
  };

  // ---------- state/time ----------
  var TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode, diff){
    var m = mode || 'goodjunk';
    var d = diff || 'Normal';
    var base = (TIME_BY_MODE[m] != null) ? TIME_BY_MODE[m] : 45;
    if(d==='Easy') return base+5;
    if(d==='Hard') return Math.max(20, base-5);
    return base;
  }

  var R = {
    playing:false, startedAt:0, remain:45, raf:0, _paused:false,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null,
    matchTime:45,
    feverActive:false, feverBreaks:0,
    _feverRecoverTO:null,
    _secMark:0, _dtMark:0
  };
  var hud=null;

  // ---------- FEVER/UI helpers ----------
  function setPowerFill(pct, feverOn){
    var f = $('#powerFill'); if(!f) return;
    var w = Math.max(0, Math.min(100, pct|0));
    f.style.width = w+'%';
    f.parentElement.style.boxShadow = feverOn ? '0 0 22px rgba(255,140,0,.45)' : 'none';
  }
  function setFeverState(on){
    R.feverActive = !!on;
    try{ Quests.event('fever',{on:R.feverActive}); }catch(e){}
    document.body.classList.toggle('fever', !!on);
    setPowerFill(R.feverActive?100:0, R.feverActive);
    // short BGM/SFX cue
    var pe = $('#sfx-powerup');
    if(on && pe && pe.play) { try{ pe.currentTime=0; pe.play(); }catch(e){} }
  }
  function showBigCountdown(n){
    var el=$('#bigCount');
    if(!el){
      el=document.createElement('div'); el.id='bigCount';
      el.style.cssText='position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);font:900 88px ui-rounded;color:#fff;text-shadow:0 0 18px rgba(255,0,0,.6);z-index:3000;pointer-events:none;opacity:0;transition:opacity .2s';
      document.body.appendChild(el);
    }
    el.textContent=String(n);
    el.style.opacity='1';
    clearTimeout(el._to);
    el._to=setTimeout(function(){ el.style.opacity='0'; }, 700);
  }

  // ---------- UI sync ----------
  function setBadges(){
    if(hud && hud.setTop){
      hud.setTop({
        mode:R.modeKey, diff:R.diff, time:R.remain|0,
        score:(R.sys && R.sys.score && R.sys.score.get ? R.sys.score.get() : 0),
        combo:(R.sys && R.sys.score ? (R.sys.score.combo|0) : 0)
      });
    }
    var mB=$('#modeBadge'); if(mB) mB.textContent=R.modeKey;
    var dB=$('#diffBadge'); if(dB) dB.textContent=R.diff;
    var sV=$('#scoreVal'); if(sV) sV.textContent=(R.sys && R.sys.score && R.sys.score.get ? R.sys.score.get() : 0);
  }

  // ---------- bus for modes ----------
  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit:function(e){
        var pts=(e && e.points)|0;
        if(pts){
          R.sys.score.add(pts);
          R.sys.score.combo=(R.sys.score.combo|0)+1;
          if((R.sys.score.combo|0)>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo|0;
        }
        if(!R.feverActive && (R.sys.score.combo|0)>=10){
          setFeverState(true);
          R.feverBreaks=0;
        }
        if(e && e.ui) FX.popText('+'+pts, e.ui);
        try{
          Quests.event('hit',{
            result: (e && e.kind)?e.kind:'good',
            meta:   (e && e.meta)?e.meta:{},
            points: pts,
            comboNow: R.sys.score.combo|0
          });
        }catch(err){}
        // update FEVER gauge by combo
        var need=10, c=(R.sys.score.combo|0);
        var pct=Math.round(Math.min(100, (Math.min(c,need)/need)*100));
        setPowerFill(pct, R.feverActive);
        setBadges();
      },
      miss:function(info){
        if(R.feverActive){
          R.feverBreaks++;
          clearTimeout(R._feverRecoverTO);
          R._feverRecoverTO = setTimeout(function(){ R.feverBreaks=0; }, 4000);
          if(R.feverBreaks>=3){ setFeverState(false); R.feverBreaks=0; }
        }
        R.sys.score.combo=0;
        try{ Quests.event('miss', info || {}); }catch(err){}
        setPowerFill(0, R.feverActive);
        setBadges();
      },
      power:function(k){ try{ Quests.event('power',{kind:k}); }catch(err){} }
    };
  }

  // ---------- loop ----------
  function gameTick(){
    if(!R.playing) return;
    if(R._paused){ R.raf=requestAnimationFrame(gameTick); return; }

    var tNow=performance.now();

    var secGone=Math.floor((tNow-R._secMark)/1000);
    if(secGone>=1){
      var prev=R.remain|0;
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=tNow;
      setBadges();
      if(R.remain===10 && R.coach && R.coach.onTimeLow){ R.coach.onTimeLow(); }
      if(R.remain<=10 && prev>R.remain){ showBigCountdown(R.remain|0); }
      try{
        var curScore=(R.sys && R.sys.score && R.sys.score.get)?R.sys.score.get():0;
        Quests.tick({ score:curScore, dt:secGone, fever:R.feverActive });
      }catch(e){}
    }

    try{
      var dt=(tNow-(R._dtMark||tNow))/1000; R._dtMark=tNow;
      if(R.modeAPI && typeof R.modeAPI.update==='function'){ R.modeAPI.update(dt,busFor()); }
      else if(R.modeInst && typeof R.modeInst.update==='function'){ R.modeInst.update(dt,busFor()); }
      else if(R.modeAPI && typeof R.modeAPI.tick==='function'){ R.modeAPI.tick(R.state||{}, R.sys, hud||{}); }
    }catch(e){ console.warn('[mode.update] error',e); }

    if(R.remain<=0){ endGame(); return; }
    R.raf=requestAnimationFrame(gameTick);
  }

  // ---------- end ----------
  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    var score=(R.sys && R.sys.score && R.sys.score.get)?R.sys.score.get():0;
    var bestC=(R.sys && R.sys.score ? (R.sys.score.bestCombo|0) : 0);

    try{ if(R.modeInst && R.modeInst.cleanup) R.modeInst.cleanup(); if(R.modeAPI && R.modeAPI.cleanup) R.modeAPI.cleanup(R.state,hud); }catch(e){}
    try{ Quests.endRun({ score:score }); }catch(e){}
    try{ if(R.coach && R.coach.onEnd) R.coach.onEnd(score); }catch(e){}
    try{ Progress.endRun({ score:score, bestCombo:bestC }); }catch(e){}

    document.body.removeAttribute('data-playing');
    var mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }

    try{
      var extra=[];
      if(typeof Quests.buildSummary==='function'){ extra = Quests.buildSummary() || []; }
      if(hud && typeof hud.showResult==='function'){
        hud.showResult({
          title:'Result',
          desc:'Mode: '+R.modeKey+' • Diff: '+R.diff,
          stats:[
            'Score: '+score,
            'Best Combo: '+bestC,
            'Time: '+(R.matchTime|0)+'s'
          ].concat(extra||[])
        });
        hud.onHome=function(){
          hud.hideResult();
          var m2=$('#menuBar'); if(m2){ m2.removeAttribute('data-hidden'); m2.style.display='flex'; }
        };
        hud.onRetry=function(){ hud.hideResult(); startGame(); };
      }
    }catch(e){}

    window.HHA._busy=false;
  }

  // ---------- start ----------
  async function startGame(){
    if(window.HHA && window.HHA._busy) return;
    if(!window.HHA) window.HHA = {};
    window.HHA._busy=true;

    await loadCore();
    try{ Progress.init(); }catch(e){}

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';

    R.matchTime = getMatchTime(R.modeKey,R.diff);
    R.remain    = R.matchTime|0;

    if(!hud) hud = new HUDClass();
    if(hud.hideResult) hud.hideResult();
    if(hud.setTop) hud.setTop({ mode:R.modeKey, diff:R.diff, time:R.remain, score:0, combo:0 });

    var api=null;
    try { api = await loadMode(R.modeKey); }
    catch(e){
      console.error('[HHA] Failed to load mode:',R.modeKey,e);
      var toastEl=$('#toast');
      if(toastEl){ toastEl.textContent='Failed to load mode: '+R.modeKey; toastEl.classList.add('show'); setTimeout(function(){toastEl.classList.remove('show');},1200); }
      window.HHA._busy=false; return;
    }
    R.modeAPI = api;

    R.sys.score = new (ScoreSystem||function(){})();
    if(R.sys.score.reset) R.sys.score.reset();
    R.sys.sfx   = new (SFXClass||function(){})();
    R.sys.score.combo=0; R.sys.score.bestCombo=0;
    R.feverActive=false; R.feverBreaks=0;

    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    if(R.coach && R.coach.onStart) R.coach.onStart();

    try { Quests.bindToMain({ hud:hud, coach:R.coach }); }catch(e){}
    try { Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime); }catch(e){}

    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };

    if(api && typeof api.create==='function'){
      R.modeInst = api.create({ engine:{fx:FX}, hud:hud, coach:R.coach });
      if(R.modeInst && typeof R.modeInst.start==='function'){ R.modeInst.start({ time:R.matchTime, difficulty:R.diff }); }
    } else if(api && typeof api.init==='function'){
      api.init(R.state, hud, { time:R.matchTime, life:1600 });
    } else if(api && typeof api.start==='function'){
      api.start({ time:R.matchTime, difficulty:R.diff });
    }

    R.playing=true;
    var t=performance.now();
    R.startedAt=t; R._secMark=t; R._dtMark=t;
    setBadges();

    var mb=$('#menuBar');
    if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
    document.body.setAttribute('data-playing','1');

    requestAnimationFrame(gameTick);
  }

  // ---------- menu binds ----------
  (function bindMenu(){
    var mb=$('#menuBar'); if(!mb) return;

    function setActive(sel,el){ var list=$$(sel); for(var i=0;i<list.length;i++){ list[i].classList.remove('active'); } el.classList.add('active'); }

    mb.addEventListener('click', function(ev){
      var t = ev.target && ev.target.closest ? ev.target.closest('.btn') : null; if(!t) return;

      if(t.hasAttribute('data-mode')){
        ev.preventDefault(); ev.stopPropagation();
        document.body.setAttribute('data-mode', t.getAttribute('data-mode'));
        setActive('[data-mode]', t);
        setBadges(); if(hud && hud.setTop) hud.setTop({mode:document.body.getAttribute('data-mode')});
        return;
      }
      if(t.hasAttribute('data-diff')){
        ev.preventDefault(); ev.stopPropagation();
        document.body.setAttribute('data-diff', t.getAttribute('data-diff'));
        setActive('[data-diff]', t);
        setBadges(); if(hud && hud.setTop) hud.setTop({diff:document.body.getAttribute('data-diff')});
        return;
      }
      if(t.dataset && t.dataset.action==='howto'){
        ev.preventDefault(); ev.stopPropagation();
        var el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
        el.textContent='แตะของดี • เลี่ยงของไม่ดี • คอมโบ ≥10 = FEVER • ⭐/🛡️ คือ Power';
        el.classList.add('show'); setTimeout(function(){ el.classList.remove('show'); },1200);
        return;
      }
      if(t.dataset && t.dataset.action==='sound'){
        ev.preventDefault(); ev.stopPropagation();
        var now = (R.sys && R.sys.sfx && typeof R.sys.sfx.isEnabled==='function') ? R.sys.sfx.isEnabled() : true;
        if(R.sys && R.sys.sfx && typeof R.sys.sfx.setEnabled==='function') R.sys.sfx.setEnabled(!now);
        t.textContent = (!now)?'🔊 Sound':'🔇 Sound';
        var A=document.querySelectorAll('audio'); for(var i=0;i<A.length;i++){ try{ A[i].muted = now; }catch(e){} }
        var te=$('#toast'); if(!te){ te=document.createElement('div'); te.id='toast'; te.className='toast'; document.body.appendChild(te); }
        te.textContent = (!now)?'เสียง: เปิด':'เสียง: ปิด'; te.classList.add('show'); setTimeout(function(){ te.classList.remove('show'); },1200);
        return;
      }
      if(t.dataset && t.dataset.action==='start'){ ev.preventDefault(); ev.stopPropagation(); startGame(); return; }
    }, false);
  })();

  // pause on blur (skip time while paused)
  window.addEventListener('blur', function(){ if(R.playing){ R._paused=true; } });
  window.addEventListener('focus',function(){ if(R._paused){ var t=performance.now(); R._paused=false; R._secMark=t; R._dtMark=t; } });

  // expose
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // canvas never blocks UI
  setTimeout(function(){ var c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);

  // kb quick start
  window.addEventListener('keydown',function(e){
    if((e.key==='Enter'||e.key===' ') && !R.playing){
      var menuVisible = !($('#menuBar') && $('#menuBar').hasAttribute('data-hidden'));
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  }, {passive:false});
})();
