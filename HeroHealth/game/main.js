<!-- /game/main.js -->
'use strict';
window.__HHA_BOOT_OK = 'main';

(function () {
  // ---------- DOM helpers ----------
  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return document.querySelectorAll(s); };

  // ---------- Safe stubs (แทนที่เมื่อ import สำเร็จ) ----------
  var ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass, HUDClass;

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
        setEnabled(v){ this._on = !!v; }
        isEnabled(){ return !!this._on; }
        play(){} tick(){} good(){} bad(){} perfect(){} power(){}
      };
    }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch {
      Quests = {
        bindToMain: function(){ return { refresh: function(){} }; },
        beginRun: function(){},
        endRun: function(){ return null; },
        event: function(){},
        tick: function(){}
      };
    }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch {
      Progress = {
        init: function(){},
        beginRun: function(){},
        endRun: function(){},
        emit: function(){},
        getStatSnapshot: function(){ return {}; },
        profile: function(){ return {}; }
      };
    }

    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch {
      VRInput = {
        init: function(){},
        toggleVR: function(){},
        isXRActive: function(){ return false; },
        isGazeMode: function(){ return false; }
      };
    }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      // Fallback Coach
      CoachClass = class {
        constructor(opts){
          var lang = (opts && opts.lang) ? opts.lang : localStorage.getItem('hha_lang') || 'TH';
          this.lang = String(lang).toUpperCase();
          this.box = document.getElementById('coachBox');
          if(!this.box){
            this.box = document.createElement('div');
            this.box.id='coachBox';
            this.box.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;pointer-events:auto;display:none;z-index:2001';
            document.body.appendChild(this.box);
          }
          this._to = null;
        }
        say(t){
          if(!this.box) return;
          this.box.textContent = t || '';
          this.box.style.display = 'block';
          var self=this;
          if(this._to) clearTimeout(this._to);
          this._to = setTimeout(function(){ self.box.style.display='none'; }, 1400);
        }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){
          var s = score|0;
          this.say(s>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!'));
        }
      };
    }

    try { ({ HUD: HUDClass } = await import('./core/hud.js')); }
    catch {
      // Minimal HUD
      HUDClass = class {
        constructor(){
          this.root = document.getElementById('hud');
          if(!this.root){
            this.root = document.createElement('div');
            this.root.id='hud';
            this.root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2000';
            document.body.appendChild(this.root);
          }
          this.top = document.createElement('div');
          this.top.style.cssText='position:absolute;left:12px;right:12px;top:10px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none';
          this.top.innerHTML = ''+
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

          this.result = document.createElement('div');
          this.result.id='resultModal';
          this.result.style.cssText='position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);pointer-events:auto;z-index:2002';
          this.result.innerHTML = ''+
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
          this.$resDesc=this.result.querySelector('#resDesc');
          this.$resStats=this.result.querySelector('#resStats');
          var self=this;
          this.onHome=null;
          this.onRetry=null;
          this.result.querySelector('#resHome').onclick=function(){ if(self.onHome) self.onHome(); };
          this.result.querySelector('#resRetry').onclick=function(){ if(self.onRetry) self.onRetry(); };
        }
        setTop(o){
          if(!o) return;
          if(o.mode!=null) this.$mode.textContent=String(o.mode);
          if(o.diff!=null) this.$diff.textContent=String(o.diff);
          if(o.time!=null) this.$time.textContent=String(o.time)+'s';
          if(o.score!=null) this.$score.textContent=String(o.score|0);
          if(o.combo!=null) this.$combo.textContent=String(o.combo|0);
        }
        setQuestChips(){ /* no-op in fallback */ }
        say(txt){ /* coach fallback uses its own box */ }
        showResult(o){
          o = o || {};
          this.$resTitle.textContent = o.title || 'Result';
          this.$resDesc.textContent  = o.desc  || '—';
          var frag=document.createDocumentFragment();
          var arr=o.stats||[];
          for(var i=0;i<arr.length;i++){
            var s=arr[i];
            var b=document.createElement('div');
            b.style.cssText='padding:6px 8px;border-radius:10px;border:1px solid #16325d;background:#0f1e38';
            b.textContent=String(s);
            frag.appendChild(b);
          }
          this.$resStats.innerHTML='';
          this.$resStats.appendChild(frag);
          this.result.style.display='flex';
        }
        hideResult(){ this.result.style.display='none'; }
      };
    }
  }

  // ---------- Mode loader ----------
  const MODE_PATH = function(k){ return './modes/'+k+'.js'; };
  async function loadMode(key){
    const mod = await import(MODE_PATH(key));
    return {
      name: mod.name || key,
      create: mod.create || null,
      init: mod.init || null,
      tick: mod.tick || null,
      update: mod.update || null,
      cleanup: mod.cleanup || null
    };
  }

  // ---------- FX ----------
  var FX = {
    popText: function(txt, pos){
      pos = pos || {};
      var x = pos.x|0; var y = pos.y|0;
      var el=document.createElement('div');
      el.textContent=txt;
      el.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;transform:translate(-50%,-50%);font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:97;opacity:1;transition:all .72s ease-out;';
      document.body.appendChild(el);
      requestAnimationFrame(function(){ el.style.top=(y-36)+'px'; el.style.opacity='0'; });
      setTimeout(function(){ try{ el.remove(); }catch(e){} }, 720);
    }
  };

  // ---------- Time per mode ----------
  var TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
  function getMatchTime(mode, diff){
    mode = mode || 'goodjunk';
    diff = diff || 'Normal';
    var base = TIME_BY_MODE[mode] != null ? TIME_BY_MODE[mode] : 45;
    if (diff === 'Easy') return base + 5;
    if (diff === 'Hard') return Math.max(20, base - 5);
    return base;
  }

  // ---------- Engine state ----------
  var R = {
    playing:false,
    startedAt:0,
    remain:45,
    raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk',
    diff:'Normal',
    modeAPI:null,
    modeInst:null,
    state:null,
    coach:null,
    matchTime:45,
    feverActive:false,
    feverBreaks:0
  };
  var hud = null;

  // ---------- UI sync ----------
  function setBadges(){
    try {
      var sc = R.sys && R.sys.score && (R.sys.score.get ? R.sys.score.get() : R.sys.score.value) || 0;
      var combo = R.sys && R.sys.score ? (R.sys.score.combo|0) : 0;
      if (hud && hud.setTop) hud.setTop({ mode:R.modeKey, diff:R.diff, time:R.remain, score:sc, combo:combo });
    } catch(e){}
    var mB=$('#modeBadge'); if(mB) mB.textContent=R.modeKey;
    var dB=$('#diffBadge'); if(dB) dB.textContent=R.diff;
    var sV=$('#scoreVal'); if(sV) sV.textContent=(R.sys && R.sys.score && (R.sys.score.get ? R.sys.score.get() : R.sys.score.value)) || 0;
  }

  // ---------- Bus ----------
  function busFor(){
    return {
      sfx:R.sys.sfx,
      hit:function(e){
        e = e || {};
        var pts = e.points|0;
        if(pts){
          R.sys.score.add(pts);
          R.sys.score.combo = (R.sys.score.combo|0) + 1;
          if((R.sys.score.combo|0) > (R.sys.score.bestCombo|0)) R.sys.score.bestCombo = R.sys.score.combo|0;
        }
        if(!R.feverActive && (R.sys.score.combo|0) >= 10){
          R.feverActive = true;
          R.feverBreaks = 0;
          try{ Quests.event('fever', { on:true }); }catch(_e){}
        }
        if(e.ui) FX.popText('+'+pts, e.ui);
        try{ Quests.event('hit', { result:e.kind || 'good', meta:e.meta || {}, points:pts, comboNow:R.sys.score.combo|0 }); }catch(_e){}
        setBadges();
      },
      miss:function(info){
        info = info || {};
        if(R.feverActive){
          R.feverBreaks++;
          if(R.feverBreaks >= 3){
            R.feverActive = false;
            R.feverBreaks = 0;
            try{ Quests.event('fever', { on:false }); }catch(_e){}
          }
        }
        R.sys.score.combo = 0;
        try{ Quests.event('miss', info); }catch(_e){}
        setBadges();
      },
      power:function(k){
        try{ Quests.event('power', { kind:k }); }catch(_e){}
      }
    };
  }

  // ---------- Loop ----------
  function gameTick(){
    if(!R.playing) return;
    var tNow = performance.now();

    var secGone = Math.floor((tNow - R._secMark)/1000);
    if(secGone >= 1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      R._secMark = tNow;
      setBadges();
      if(R.remain === 10 && R.coach && R.coach.onTimeLow) R.coach.onTimeLow();
      try{ Quests.tick({ score:(R.sys.score.get ? R.sys.score.get() : 0), dt:secGone, fever:R.feverActive }); }catch(_e){}
    }

    try{
      var dt = (tNow - (R._dtMark||tNow)) / 1000;
      R._dtMark = tNow;
      if(R.modeAPI && typeof R.modeAPI.update === 'function'){ R.modeAPI.update(dt, busFor()); }
      else if(R.modeInst && typeof R.modeInst.update === 'function'){ R.modeInst.update(dt, busFor()); }
      else if(R.modeAPI && typeof R.modeAPI.tick === 'function'){ R.modeAPI.tick(R.state || {}, R.sys, hud || {}); }
    }catch(e){ console.warn('[mode.update] error', e); }

    if(R.remain <= 0){ endGame(); return; }
    R.raf = requestAnimationFrame(gameTick);
  }

  // ---------- End game ----------
  function endGame(){
    if(!R.playing) return;
    R.playing = false;
    cancelAnimationFrame(R.raf);

    var score = R.sys && R.sys.score ? (R.sys.score.get ? R.sys.score.get() : 0) : 0;
    var bestC = R.sys && R.sys.score ? (R.sys.score.bestCombo|0) : 0;

    try{ if(R.modeInst && R.modeInst.cleanup) R.modeInst.cleanup(); if(R.modeAPI && R.modeAPI.cleanup) R.modeAPI.cleanup(R.state, hud); }catch(_e){}
    try{ Quests.endRun({ score:score }); }catch(_e){}
    try{ if(R.coach && R.coach.onEnd) R.coach.onEnd(score); }catch(_e){}
    try{ Progress.endRun({ score:score, bestCombo:bestC }); }catch(_e){}

    document.body.removeAttribute('data-playing');
    var mb = document.getElementById('menuBar');
    if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }

    try{
      if(hud && hud.showResult){
        hud.showResult({
          title:'Result',
          desc:'Mode: '+R.modeKey+' • Diff: '+R.diff,
          stats:[
            'Score: '+score,
            'Best Combo: '+bestC,
            'Time: '+(R.matchTime|0)+'s'
          ]
        });
        hud.onHome = function(){
          hud.hideResult();
          var m2=document.getElementById('menuBar');
          if(m2){ m2.removeAttribute('data-hidden'); m2.style.display='flex'; }
        };
        hud.onRetry = function(){ hud.hideResult(); startGame(); };
      }
    }catch(_e){}

    window.HHA._busy = false;
  }

  // ---------- Start game ----------
  async function startGame(){
    if(window.HHA && window.HHA._busy) return;
    if(!window.HHA) window.HHA = {};
    window.HHA._busy = true;

    await loadCore();
    try{ Progress.init(); }catch(_e){}

    R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
    R.diff    = document.body.getAttribute('data-diff') || 'Normal';

    R.matchTime = getMatchTime(R.modeKey, R.diff);
    R.remain    = R.matchTime|0;

    if(!hud) hud = new HUDClass();
    if(hud && hud.hideResult) hud.hideResult();
    if(hud && hud.setTop) hud.setTop({ mode:R.modeKey, diff:R.diff, time:R.remain, score:0, combo:0 });

    var api = null;
    try { api = await loadMode(R.modeKey); }
    catch(e){
      console.error('[HHA] Failed to load mode:', R.modeKey, e);
      toast('Failed to load mode: '+R.modeKey);
      window.HHA._busy = false;
      return;
    }
    R.modeAPI = api;

    R.sys.score = new ScoreSystem();
    if(R.sys.score.reset) R.sys.score.reset();
    R.sys.sfx   = new SFXClass();
    R.sys.score.combo = 0;
    R.sys.score.bestCombo = 0;
    R.feverActive = false;
    R.feverBreaks = 0;

    R.coach = new CoachClass({ lang:(localStorage.getItem('hha_lang')||'TH') });
    if(R.coach.onStart) R.coach.onStart();

    try { Quests.bindToMain({ hud:hud, coach:R.coach }); }catch(_e){}
    try { Quests.beginRun(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime); }catch(_e){}

    R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    if(api.create){
      R.modeInst = api.create({ engine:{ fx:FX }, hud:hud, coach:R.coach });
      if(R.modeInst.start) R.modeInst.start({ time:R.matchTime });
    } else if(api.init){
      api.init(R.state, hud, { time:R.matchTime, life:1600 });
    }

    R.playing = true;
    R.startedAt = performance.now();
    R._secMark  = performance.now();
    R._dtMark   = performance.now();

    setBadges();

    var mb = document.getElementById('menuBar');
    if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

    requestAnimationFrame(gameTick);
  }

  // ---------- Menu delegation + Start bind ----------
  (function bindMenu(){
    var mb = document.getElementById('menuBar');
    if(!mb) return;

    function setActive(sel,el){
      var nodes = $$(sel);
      for(var i=0;i<nodes.length;i++){ nodes[i].classList.remove('active'); }
      el.classList.add('active');
    }

    mb.addEventListener('click', function(ev){
      var t = ev.target.closest('.btn');
      if(!t) return;

      if(t.hasAttribute('data-mode')){
        ev.preventDefault(); ev.stopPropagation();
        document.body.setAttribute('data-mode', t.getAttribute('data-mode'));
        setActive('[data-mode]', t);
        setBadges();
        return;
      }

      if(t.hasAttribute('data-diff')){
        ev.preventDefault(); ev.stopPropagation();
        document.body.setAttribute('data-diff', t.getAttribute('data-diff'));
        setActive('[data-diff]', t);
        setBadges();
        return;
      }

      if(t.dataset && t.dataset.action === 'howto'){
        ev.preventDefault(); ev.stopPropagation();
        toast('แตะของดี • เลี่ยงของไม่ดี • คอมโบ ≥10 = FEVER • ⭐/🛡️ เป็นพลังพิเศษ');
        return;
      }

      if(t.dataset && t.dataset.action === 'sound'){
        ev.preventDefault(); ev.stopPropagation();
        try{
          var now = R.sys && R.sys.sfx && R.sys.sfx.isEnabled ? R.sys.sfx.isEnabled() : true;
          if(R.sys && R.sys.sfx && R.sys.sfx.setEnabled) R.sys.sfx.setEnabled(!now);
          t.textContent = (!now)?'🔊 Sound':'🔇 Sound';
          var aud = document.querySelectorAll('audio');
          for(var i=0;i<aud.length;i++){ try{ aud[i].muted = now; }catch(_e){} }
          toast((!now)?'เสียง: เปิด':'เสียง: ปิด');
        }catch(_e){}
        return;
      }

      if(t.dataset && t.dataset.action === 'start'){
        ev.preventDefault(); ev.stopPropagation();
        startGame();
        return;
      }
    }, false);

    // bind Start strong
    var b = document.getElementById('btn_start');
    if(b){
      var clone = b.cloneNode(true);
      b.parentNode.replaceChild(clone,b);
      var opts = { capture:true, passive:false };
      var run = function(e){ e.preventDefault(); e.stopPropagation(); startGame(); };
      clone.addEventListener('click', run, opts);
      clone.addEventListener('pointerup', run, opts);
      clone.addEventListener('touchend', run, opts);
      clone.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); startGame(); } }, opts);
    }
  })();

  // ---------- Toast ----------
  function toast(text){
    var el = document.getElementById('toast');
    if(!el){
      el = document.createElement('div');
      el.id='toast';
      el.className='toast';
      document.body.appendChild(el);
    }
    el.textContent = String(text||'');
    el.classList.add('show');
    setTimeout(function(){ el.classList.remove('show'); }, 1200);
  }

  // ---------- Expose ----------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // กัน canvas บังคลิก
  setTimeout(function(){
    var c = document.getElementById('c');
    if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }
  }, 0);

  // Keyboard quick start
  window.addEventListener('keydown', function(e){
    if((e.key==='Enter' || e.key===' ') && !R.playing){
      var menuVisible = true;
      var mb = document.getElementById('menuBar');
      if(mb && mb.hasAttribute('data-hidden')) menuVisible = false;
      if(menuVisible){ e.preventDefault(); startGame(); }
    }
  }, { passive:false });

})(); 
