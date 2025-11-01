// === Hero Health Academy — game/main.js (FEVER FX + Start/Time + HUD + Safe Fallbacks) ===
'use strict';
window.__HHA_BOOT_OK = 'main';

(function () {
  // ---------- DOM helpers ----------
  function $(s){ return document.querySelector(s); }
  function $$(s){ return document.querySelectorAll(s); }

  // ---------- Safe stubs (replaced when imports succeed) ----------
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
    catch {
      SFXClass = class {
        constructor(){ this._on=true; }
        setEnabled(v){ this._on=!!v; }
        isEnabled(){ return !!this._on; }
        play(){} tick(){} good(){} bad(){} perfect(){} power(){}
      };
    }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch {
      Quests = {
        bindToMain: function(){ return { refresh:function(){} }; },
        beginRun: function(){}, endRun: function(){ return null; },
        event: function(){}, tick: function(){}
      };
    }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch {
      Progress = {
        init:function(){}, beginRun:function(){}, endRun:function(){},
        emit:function(){}, getStatSnapshot:function(){ return {}; }, profile:function(){ return {}; }
      };
    }

    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch {
      VRInput = { init:function(){}, toggleVR:function(){}, isXRActive:function(){return false;}, isGazeMode:function(){return false;} };
    }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = class {
        constructor(opts){
          const langOpt = (opts && opts.lang) ? opts.lang : 'TH';
          this.lang = (localStorage.getItem('hha_lang') || langOpt).toUpperCase();
          this._ensure();
        }
        _ensure(){
          this.box = $('#coachBox');
          if(!this.box){
            this.box = document.createElement('div');
            this.box.id='coachBox';
            this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001';
            document.body.appendChild(this.box);
          }
        }
        say(t){ if(!this.box) return; this.box.textContent=t||''; this.box.style.display='block'; var self=this; clearTimeout(this._to); this._to=setTimeout(function(){ self.box.style.display='none'; },1400); }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }

    try { ({ Leaderboard } = await import('./core/leaderboard.js')); }
    catch {
      class LeaderboardFallback { submit(){} renderInto(){} getInfo(){ return { text:'-' }; } }
      Leaderboard = LeaderboardFallback;
    }

    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch {
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
          var self=this;
          this.result.querySelector('#resHome').onclick = function(){ if(self.onHome) self.onHome(); };
          this.result.querySelector('#resRetry').onclick= function(){ if(self.onRetry) self.onRetry(); };
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
          var frag=document.createDocumentFragment();
          var arr = Array.isArray(list)?list:[];
          for(var i=0;i<arr.length;i++){
            var m=arr[i];
            var pct=m && m.need>0 ? Math.min(100, Math.round((m.progress/m.need)*100)) : 0;
            var d=document.createElement('div');
            d.style.cssText='pointer-events:auto;display:inline-flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;border:1px solid #16325d;background:#0d1a31;color:#e6f2ff';
            d.innerHTML =
              '<span style="font-size:16px">'+(m.icon||'⭐')+'</span>'+
              '<span style="font:700 12.5px ui-rounded">'+(m.label||m.key||'')+'</span>'+
              '<span style="font:700 12px;color:#a7f3d0;margin-left:6px">'+(m.progress||0)+'/'+(m.need||0)+'</span>'+
              '<i style="height:6px;width:100px;border-radius:999px;background:#0a1931;border:1px solid #12325a;overflow:hidden;display:inline-block;margin-left:6px">'+
                '<b style="display:block;height:100%;width:'+pct+'%;background:'+(m.done?(m.fail?'#ef4444':'#22c55e'):'#22d3ee')+'"></b>'+
              '</i>';
            frag.appendChild(d);
          }
          this.chips.innerHTML=''; this.chips.appendChild(frag);
        }
        say(t){
          var box=$('#coachBox'); if(!box) return;
          box.textContent=t||''; box.style.display='block';
          var self=this; clearTimeout(this._to); this._to=setTimeout(function(){ box.style.display='none'; },1600);
        }
        showResult(o){
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
        }
        hideResult(){ this.result.style.display='none'; }
      };
    }
  }

  // ---------- Mode loader ----------
  function MODE_PATH(k){ return './modes/'+k+'.js'; }
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return {
      name:mod.name||key,
      create:mod.create||null, init:mod.init||null, tick:mod.tick||null, update:mod.update||null,
      start:mod.start||null, cleanup:mod.cleanup||null,
      setFever:mod.setFever||null
    };
  }

  // ---------- FX ----------
  const FX = {
    popText:function(txt,pos){
      var x = (pos && pos.x)|0;
      var y = (pos && pos.y)|0;
      var el=document.createElement('div');
      el.textContent=String(txt);
      el.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;transform:translate(-50%,-50%);font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:97;opacity:1;transition:all .72s ease-out;';
      document.body.appendChild(el);
      requestAnimationFrame(function(){ el.style.top=(y-36)+'px'; el.style.opacity='0'; });
      setTimeout(function(){ try{el.remove();}catch(e){}; },700);
    }
  };

  // ---------- Time UI (time pill + start count + final-10 big number + flash) ----------
  function fmtMMSS(sec){ sec=Math.max(0,sec|0); var m=(sec/60)|0; var s=sec%60; return m+':'+String(s).padStart(2,'0'); }
  var _$timePill=null, _$startCount=null, _$bigWarn=null, _$flash=null, _lastWarnSec=-1;

  function ensureTimePill(){
    if(_$timePill) return _$timePill;
    var d=document.createElement('div');
    d.id='timePill';
    d.style.cssText='position:fixed;left:10px;top:10px;padding:6px 10px;border-radius:12px;background:#06213c;color:#e6f5ff;border:1px solid #123a67;font:700 14px ui-rounded;z-index:10060;pointer-events:none;min-width:62px;text-align:center';
    d.textContent='0:00';
    document.body.appendChild(d);
    _$timePill=d; return d;
  }
  function updateTimePill(sec){ try{ ensureTimePill().textContent = fmtMMSS(sec|0); }catch(e){} }

  function showStartCount(){
    if(!_$startCount){
      var host=document.createElement('div');
      host.id='startCount';
      host.style.cssText='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:10070;pointer-events:none';
      var inner=document.createElement('div');
      inner.style.cssText='font:900 64px ui-rounded;color:#eaf6ff;text-shadow:0 10px 28px rgba(0,0,0,.45);transition:all .25s ease';
      host.appendChild(inner); document.body.appendChild(host); _$startCount=host;
    }
    var el=_$startCount.firstElementChild; var seq=['3','2','1','GO!']; var i=0; _$startCount.style.display='flex';
    function tick(){ el.textContent=seq[i++]; el.style.opacity='1'; el.style.transform='scale(1)';
      setTimeout(function(){ el.style.opacity='0'; el.style.transform='scale(1.25)'; },360);
      if(i<seq.length) setTimeout(tick,460); else setTimeout(function(){ _$startCount.style.display='none'; },680);
    } tick();
  }

  function ensureBigWarn(){
    if(!_$bigWarn){
      var w=document.createElement('div');
      w.id='finalWarn';
      w.style.cssText='position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:10065;pointer-events:none';
      var t=document.createElement('div');
      t.style.cssText='font:900 96px ui-rounded;color:#ffef8a;text-shadow:0 16px 48px rgba(0,0,0,.55);transition:all .24s ease';
      w.appendChild(t); document.body.appendChild(w); _$bigWarn=w;
    }
    if(!_$flash){
      var f=document.createElement('div');
      f.id='screenFlash';
      f.style.cssText='position:fixed;inset:0;background:radial-gradient(800px 500px at 50% -10%, rgba(255,120,0,.25), rgba(255,0,0,0));opacity:0;transition:opacity .22s ease;pointer-events:none;z-index:10064';
      document.body.appendChild(f); _$flash=f;
    }
  }
  function bigFinalWarn(sec){
    ensureBigWarn();
    if(sec>10){ _$bigWarn.style.display='none'; _$flash.style.opacity='0'; _lastWarnSec=-1; return; }
    if(sec<=0){ _$bigWarn.style.display='none'; _$flash.style.opacity='0'; return; }
    if(sec===_lastWarnSec) return; _lastWarnSec=sec;
    _$bigWarn.style.display='flex';
    var t=_$bigWarn.firstElementChild; t.textContent=String(sec);
    t.style.transform='scale(1)'; t.style.opacity='1';
    _$flash.style.opacity='0.55';
    setTimeout(function(){ t.style.opacity='0'; t.style.transform='scale(1.25)'; _$flash.style.opacity='0'; },240);
  }

  // ---------- FEVER FX (overlay + BGM crossfade) ----------
  var _feverOverlay=null, _feverCSSInjected=false, _bgmMain=null, _bgmFever=null;

  function injectFeverCSS(){
    if(_feverCSSInjected) return;
    var st=document.createElement('style');
    st.textContent =
      '@keyframes feverPulse{0%{opacity:.2}50%{opacity:.45}100%{opacity:.2}}';
    document.head.appendChild(st);
    _feverCSSInjected=true;
  }
  function ensureFeverOverlay(){
    if(_feverOverlay) return _feverOverlay;
    injectFeverCSS();
    var d=document.createElement('div');
    d.id='feverFX';
    d.style.cssText='position:fixed;inset:0;pointer-events:none;background:radial-gradient(900px 600px at 50% -10%, rgba(255,80,0,.25), rgba(0,0,0,0));opacity:0;transition:opacity .25s ease;mix-blend-mode:screen;z-index:10063;animation:feverPulse 1.1s ease-in-out infinite';
    document.body.appendChild(d); _feverOverlay=d; return d;
  }
  function ensureBGMs(){
    if(!_bgmMain){ _bgmMain = $('#bgm-main'); }
    if(!_bgmFever){
      _bgmFever = document.getElementById('bgm-fever');
      if(!_bgmFever){
        _bgmFever = document.createElement('audio');
        _bgmFever.id='bgm-fever';
        _bgmFever.loop=true; _bgmFever.preload='auto';
        // วางไฟล์ที่นี่ (มีให้เองได้): assets/bgm/fever.mp3
        _bgmFever.src='assets/bgm/fever.mp3';
        document.body.appendChild(_bgmFever);
      }
    }
  }
  function crossfade(aOut,aIn,ms){
    ms = ms||350;
    try{
      if(aIn){ aIn.volume=0; aIn.play().catch(function(){}); }
      var steps=14, dt=ms/steps;
      var i=0;
      var iv=setInterval(function(){
        i++;
        if(aOut){ aOut.volume=Math.max(0,1 - i/steps); if(i===steps) { try{aOut.pause();}catch(e){} aOut.volume=1; } }
        if(aIn){ aIn.volume=Math.min(1, i/steps); }
        if(i>=steps) clearInterval(iv);
      }, dt);
    }catch(e){}
  }

  // Power bar helper
  function setPowerFill(pct, feverOn){
    var fill = $('#powerFill'); if(!fill) return;
    var p = Math.max(0, Math.min(100, pct|0));
    fill.style.width = p + '%';
    var fire = fill.firstElementChild; if(fire){ fire.style.display = feverOn ? 'block' : 'none'; }
  }

  function setFeverState(on){
    on = !!on;
    if(on === R.feverActive) return;
    R.feverActive = on;
    R.feverBreaks = 0;
    // body attribute
    if(on) document.body.setAttribute('data-fever','1'); else document.body.removeAttribute('data-fever');
    // notify mode + quests
    try{ if(R.modeAPI && R.modeAPI.setFever) R.modeAPI.setFever(on); }catch(e){}
    try{ Quests.event('fever',{on:on}); }catch(e){}
    // overlay + bgm
    try{
      ensureFeverOverlay(); ensureBGMs();
      if(on){
        _feverOverlay.style.opacity='1';
        crossfade(_bgmMain, _bgmFever, 420);
      }else{
        _feverOverlay.style.opacity='0';
        crossfade(_bgmFever, _bgmMain, 420);
      }
    }catch(e){}
    // SFX ping
    try{ if(R.sys && R.sys.sfx && R.sys.sfx.power) R.sys.sfx.power(); }catch(e){}
    // power gauge
    if(on) setPowerFill(100,true); else setPowerFill((Math.min(10,(R.sys && R.sys.score ? (R.sys.score.combo|0):0))/10)*100,false);
  }

  // ---------- Engine state ----------
  var TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode, diff){
    var m = mode || 'goodjunk';
    var d = diff || 'Normal';
    var base = TIME_BY_MODE[m] != null ? TIME_BY_MODE[m] : 45;
    if (d==='Easy') return base + 5;
    if (d==='Hard') return Math.max(20, base - 5);
    return base;
  }

  var R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', diff:'Normal',
    modeAPI:null, modeInst:null, state:null, coach:null,
    matchTime:45,
    feverActive:false, feverBreaks:0
  };
  var hud=null;

  // ---------- UI sync ----------
  function setBadges(){
    if (hud && hud.setTop){
      hud.setTop({
        mode:R.modeKey,
        diff:R.diff,
        time:R.remain,
        score:(R.sys && R.sys.score && R.sys.score.get ? R.sys.score.get() : 0),
        combo:(R.sys && R.sys.score ? (R.sys.score.combo|0) : 0)
      });
    }
  }

  // ---------- Bus ----------
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
        if(!R.feverActive && (R.sys.score.combo|0)>=10){ setFeverState(true); }
        if(!R.feverActive){
          var pct = Math.min(100, ((R.sys.score.combo|0)/10)*100);
          setPowerFill(pct,false);
        }
        if(e && e.ui) FX.popText('+'+pts, e.ui);
        try{ Quests.event('hit',{ result:(e && e.kind)?e.kind:'good', meta:(e && e.meta)?e.meta:{}, points:pts, comboNow:R.sys.score.combo|0 }); }catch(_){}
        setBadges();
      },
      miss:function(info){
        if(R.feverActive){
          R.feverBreaks++;
          if(R.feverBreaks>=3){ setFeverState(false); }
        }
        R.sys.score.combo=0;
        setPowerFill(0,false);
        try{ Quests.event('miss', info || {}); }catch(_){}
        setBadges();
      },
      power:function(k){ try{ Quests.event('power',{kind:k}); }catch(_){ } }
    };
  }

  // ---------- Loop ----------
  function gameTick(){
    if(!R.playing) return;
    var tNow=performance.now();

    var secGone=Math.floor((tNow-R._secMark)/1000);
    if(secGone>=1){
      R.remain=Math.max(0,(R.remain|0)-secGone);
      R._secMark=tNow;
      setBadges();
      updateTimePill(R.remain);
      bigFinalWarn(R.remain);
      if(R.remain===10 && R.coach && R.coach.onTimeLow){ R.coach.onTimeLow(); }
      try{ Quests.tick({ score:(R.sys.score.get ? R.sys.score.get() : 0), dt:secGone, fever:R.feverActive }); if(Quests.refreshNow) Quests.refreshNow(); }catch(_){}
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

  // ---------- End game ----------
  function endGame(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    var score=(R.sys && R.sys.score && R.sys.score.get)?R.sys.score.get():0;
    var bestC=(R.sys && R.sys.score ? (R.sys.score.bestCombo|0) : 0);

    try{ if(R.modeInst && R.modeInst.cleanup) R.modeInst.cleanup(); if(R.modeAPI && R.modeAPI.cleanup) R.modeAPI.cleanup(R.state,hud); }catch(_){}
    try{ Quests.endRun({ score:score }); }catch(_){}
    try{ if(R.coach && R.coach.onEnd) R.coach.onEnd(score); }catch(_){}
    try{ Progress.endRun({ score:score, bestCombo:bestC }); }catch(_){}

    document.body.removeAttribute('data-playing');
    var mb = $('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }
    setFeverState(false);

    try{
      var res = (typeof Quests.endRun==='function' && Quests.endRun({score:score})) || null;
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
        hud.onHome = function(){ hud.hideResult(); var m2=$('#menuBar'); if(m2){ m2.removeAttribute('data-hidden'); m2.style.display='flex'; } };
        hud.onRetry = function(){ hud.hideResult(); startGame(); };
      }
    }catch(_){}

    window.HHA._busy=false;
  }

  // ---------- Start game ----------
  async function startGame(){
    if(window.HHA && window.HHA._busy) return;
    if(!window.HHA) window.HHA = {};
    window.HHA._busy=true;

    await loadCore();
    try{ Progress.init(); }catch(_){}

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';

    R.matchTime = getMatchTime(R.modeKey,R.diff);
    R.remain    = R.matchTime|0;

    if(!hud) hud = new HUDClass();
    if(hud.hideResult) hud.hideResult();
    if(hud.setTop) hud.setTop({ mode:R.modeKey, diff:R.diff, time:R.remain, score:0, combo:0 });

    var api=null;
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

    try { Quests.bindToMain({ hud:hud, coach:R.coach }); }catch(_){}
    try { Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime); }catch(_){}

    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };

    if(api && typeof api.create==='function'){
      R.modeInst = api.create({ engine:{fx:FX}, hud:hud, coach:R.coach });
      if(R.modeInst && typeof R.modeInst.start==='function'){ R.modeInst.start({ time:R.matchTime, difficulty:R.diff }); }
    } else if(api && typeof api.init==='function'){
      api.init(R.state, hud, { time:R.matchTime, life:1600 });
    } else if(api && typeof api.start==='function'){
      api.start({ time:R.matchTime, difficulty:R.diff });
    }

    // prepare UI/FX
    updateTimePill(R.remain);
    setFeverState(false);
    setPowerFill(0,false);
    showStartCount();

    R.playing=true;
    R.startedAt=performance.now();
    R._secMark =performance.now();
    R._dtMark  =performance.now();
    setBadges();

    var mb = $('#menuBar');
    if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

    requestAnimationFrame(gameTick);
  }

  // ---------- Toast ----------
  function toast(text){
    var el=$('#toast');
    if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=String(text); el.classList.add('show');
    setTimeout(function(){ el.classList.remove('show'); },1200);
  }

  // ---------- Expose ----------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  setTimeout(function(){ var c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);

  window.addEventListener('keydown',function(e){
    if((e.key==='Enter'||e.key===' ')&&!R.playing){
      var menuVisible = !($('#menuBar') && $('#menuBar').hasAttribute('data-hidden'));
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  },{passive:false});
})();
