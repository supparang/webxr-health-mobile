// === Hero Health Academy — game/main.js (2025-10-28, dynamic-import safe) ===
// - แก้ Unexpected token '.' (เลิกใช้ import.then/.catch ต่อท้าย static import)
// - ใช้ dynamic import ภายใน async IIFE พร้อม fallback
// - ซ่อม UI คลิกไม่ติด: บังคับ pointer-events เฉพาะเมนู/ผลลัพธ์ และ HUD passive ระหว่างเล่น
// - รวม Quests tick, Score, FX, VRInput reticle/dwell, สปาวน์ตัวอย่างแบบ DOM (แทน 3D ถ้า engine ไม่พร้อม)

(function () {
  "use strict";
  window.__HHA_BOOT_OK = true;

  // ---------- Tiny helpers ----------
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));
  const byAction = (ev)=>ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
  function setText(sel, txt){ const el=$(sel); if(el) el.textContent = txt; }

  // ---------- No-op globals while booting (กันปุ่มกดก่อนระบบพร้อม) ----------
  const UI_NOOP = { setMode(){}, start(){}, menu(){}, pause(){}, resume(){}, result(){} };
  window.HHA_UI = UI_NOOP;
  window.HHA = {
    startGame(){}, stopToMenu(){}, pause(){}, resume(){},
    selectMode(){}, setLang(){}, setDifficulty(){}, toggleMute(){}, do(){}
  };

  // ---------- Global click delegation (พร้อมใช้งานทันที) ----------
  document.addEventListener('click', function(ev){
    const btn = byAction(ev);
    if (!btn) return;
    const act = btn.getAttribute('data-action');
    if (!act) return;
    ev.preventDefault(); ev.stopPropagation();
    switch(act){
      case 'start': case 'play': window.HHA.startGame(); break;
      case 'menu':               window.HHA.stopToMenu(); break;
      case 'pause':              window.HHA.pause(); break;
      case 'resume':             window.HHA.resume(); break;
      case 'mute':               window.HHA.toggleMute(); break;
      case 'lang-th':            window.HHA.setLang('TH'); break;
      case 'lang-en':            window.HHA.setLang('EN'); break;
      case 'mode-gj':            window.HHA.selectMode('goodjunk'); break;
      case 'mode-gr':            window.HHA.selectMode('groups'); break;
      case 'mode-hy':            window.HHA.selectMode('hydration'); break;
      case 'mode-pl':            window.HHA.selectMode('plate'); break;
      default:
        try{ if (window.HHA && window.HHA.do) window.HHA.do(act); }catch(_){}
    }
  }, {capture:true});
  ['touchstart','touchend'].forEach(function(t){
    document.addEventListener(t, function(){}, {passive:false});
  });

  // ---------- Minimal hosts (กัน null) ----------
  (function ensureHosts(){
    if (!$('#gameLayer')) { const d=document.createElement('div'); d.id='gameLayer'; document.body.appendChild(d); }
    if (!$('#spawnHost')) { const d=document.createElement('div'); d.id='spawnHost'; d.style.position='relative'; d.style.width='100%'; d.style.height='100%'; $('#gameLayer').appendChild(d); }
  })();

  // ---------- Inject minimal styles (กัน HUD บังคลิก) ----------
  (function injectMinimalStyles(){
    if (document.getElementById('hha-min-style')) return;
    var css = ""
      + ".hud-passive{pointer-events:none!important;} "
      + "#menuBar,#resultModal,[data-ui='menu'],[data-ui='dialog']{pointer-events:auto!important;} "
      + "body.ui-mode-menu  #menuBar{display:block;} "
      + "body.ui-mode-result #resultModal{display:block;} "
      + ".spawn-emoji{position:absolute; background:transparent; border:0; cursor:pointer; font-size:42px;} "
      + ".spawn-emoji:active{transform:scale(0.92);} ";
    var el = document.createElement('style'); el.id='hha-min-style'; el.textContent = css; document.head.appendChild(el);
  })();

  // ---------- Async boot (dynamic imports + fallbacks) ----------
  (async function boot(){
    // Safe FX bootstrap
    if (!window.HHA_FX) window.HHA_FX = { add3DTilt:function(){}, shatter3D:function(){} };
    try {
      var fx = await import('/webxr-health-mobile/HeroHealth/game/core/fx.js');
      if (fx) for (var k in fx) window.HHA_FX[k] = fx[k];
    } catch(_){}

    // Load modules (ทุกตัว fallback ได้)
    var goodjunk = {};
    var groups   = {};
    var hydration= {};
    var plate    = {};
    var Quests   = { bindToMain:function(){ return {refresh:function(){}}; }, beginRun:function(){}, event:function(){}, tick:function(){}, endRun:function(){} };
    var Progress = { emit:function(){}, runCtx:{} };
    var VRInput  = { configure:function(){} };
    var SFX      = { play:function(){}, setMute:function(){} };
    var HUDCtor  = null;

    try { goodjunk = await import('/webxr-health-mobile/HeroHealth/game/modes/goodjunk.js'); } catch(_){}
    try { groups   = await import('/webxr-health-mobile/HeroHealth/game/modes/groups.js'); } catch(_){}
    try { hydration= await import('/webxr-health-mobile/HeroHealth/game/modes/hydration.js'); } catch(_){}
    try { plate    = await import('/webxr-health-mobile/HeroHealth/game/modes/plate.js'); } catch(_){}
    try { Quests   = await import('/webxr-health-mobile/HeroHealth/game/core/quests.js'); } catch(_){}
    try { Progress = await import('/webxr-health-mobile/HeroHealth/game/core/progression.js'); } catch(_){}
    try { VRInput  = await import('/webxr-health-mobile/HeroHealth/game/core/vrinput.js'); } catch(_){}
    try { SFX      = await import('/webxr-health-mobile/HeroHealth/game/core/sfx.js'); } catch(_){}
    try { var hudM = await import('/webxr-health-mobile/HeroHealth/game/core/hud.js'); HUDCtor = hudM && hudM.HUD ? hudM.HUD : null; } catch(_){}

    var HUD = HUDCtor ? HUDCtor : (function(){ function X(){} X.prototype.setQuestChips=function(){}; X.prototype.setTarget=function(){}; X.prototype.setScore=function(){}; X.prototype.setCombo=function(){}; return X; })();

    // ---------- UI state machine ----------
    var UI = {
      setMode: function(mode){
        document.body.classList.remove('ui-mode-menu','ui-mode-playing','ui-mode-paused','ui-mode-result');
        document.body.classList.add('ui-mode-'+mode);

        var passive = (mode==='playing');
        ['hudWrap','platePills','missionLine','toast','targetWrap','coachHUD'].forEach(function(id){
          var el = document.getElementById(id);
          if (!el) return;
          if (passive) el.classList.add('hud-passive');
          else el.classList.remove('hud-passive');
        });

        var menu   = document.getElementById('menuBar');
        var result = document.getElementById('resultModal');
        if (menu)   { menu.style.pointerEvents = (mode==='menu'   ? 'auto' : 'none'); menu.style.display = (mode==='menu'?'block':'none'); }
        if (result) { result.style.pointerEvents = (mode==='result' ? 'auto' : 'none'); result.style.display = (mode==='result'?'block':'none'); }
      },
      start: function(){ this.setMode('playing'); },
      menu:  function(){ this.setMode('menu');    },
      pause: function(){ this.setMode('paused');  },
      resume:function(){ this.setMode('playing'); },
      result:function(){ this.setMode('result');  }
    };
    window.HHA_UI = UI;

    // ---------- Systems / State ----------
    var MODES = { goodjunk:goodjunk, groups:groups, hydration:hydration, plate:plate };

    var State = {
      lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(),
      difficulty: (localStorage.getItem('hha_diff')||'Normal'),
      seconds: 45,
      modeKey: 'goodjunk',
      running: false,
      freezeUntil: 0,
      ctx: {}
    };

    var Systems = {
      hud: new HUD(),
      sfx: SFX,
      score: (function(){
        var _score=0, _combo=0, _comboMax=0;
        return {
          reset: function(){ _score=0; _combo=0; _comboMax=0; if (Systems.hud.setScore) Systems.hud.setScore(0); if (Systems.hud.setCombo) Systems.hud.setCombo(0,0); },
          add: function(n){ _score = (_score|0)+(n|0); if (Systems.hud.setScore) Systems.hud.setScore(_score); },
          get: function(){ return _score|0; },
          hit: function(result){ if(result==='bad'){_combo=0;} else {_combo++; _comboMax=Math.max(_comboMax,_combo);} if (Systems.hud.setCombo) Systems.hud.setCombo(_combo,_comboMax); return _combo; },
          summary: function(){ return { score:_score|0, comboMax:_comboMax|0 }; }
        };
      })(),
      spawner: { lifeMs: 1200, lastSpawn: 0 },
      input: VRInput
    };

    // Quests bind
    var QBind = (Quests.bindToMain ? Quests.bindToMain({ hud: Systems.hud }) : { refresh:function(){} });

    // VRInput configure
    try{
      var dwell = Number(localStorage.getItem('hha_dwell_ms')||700);
      var size  = Number(localStorage.getItem('hha_reticle_px')||42);
      if (Systems.input && Systems.input.configure) {
        Systems.input.configure({ reticlePx:size, dwellMs:dwell, ignoreSelectors:['#menuBar','[data-ui="dialog"]'] });
      }
    }catch(_){}

    function getMode(){ return MODES[State.modeKey] && MODES[State.modeKey].init ? MODES[State.modeKey] : plate; }

    function spawnMeta(ts){
      var mode = getMode();
      var diff = { life: Systems.spawner.lifeMs };
      try { return mode.pickMeta ? mode.pickMeta(diff, State) : null; } catch(e){ console.warn('pickMeta error', e); return null; }
    }

    function applyHit(meta, result){
      var base = (result==='perfect'?20 : result==='good'?10 : result==='bad'?-5 : 0);
      if (base) Systems.score.add(base);
      var comboNow = Systems.score.hit(result);
      try { if (Quests.event) Quests.event('hit', { result:result, meta:meta, comboNow:comboNow, _ctx:{ score: Systems.score.get() } }); } catch(_){}
      try {
        if (result==='perfect' && Systems.sfx.play) Systems.sfx.play('sfx-perfect');
        else if (result==='good' && Systems.sfx.play) Systems.sfx.play('sfx-good');
        else if (result==='bad' && Systems.sfx.play) Systems.sfx.play('sfx-bad');
      } catch(_){}
    }

    // Gameplay surface clicks (ตัวสปาวน์ DOM)
    var surface = document.getElementById('gameLayer') || document.body;
    surface.addEventListener('click', function(ev){
      var el = ev.target && ev.target.closest ? ev.target.closest('[data-meta]') : null;
      if (!el) return;
      try {
        var meta = JSON.parse(el.getAttribute('data-meta')||'{}');
        var result = 'ok';
        try { result = getMode().onHit ? (getMode().onHit(meta, Systems, State, Systems.hud) || 'ok') : 'ok'; } catch(e){ console.warn('onHit error', e); }
        try {
          var r = el.getBoundingClientRect(); if (r && window.HHA_FX && window.HHA_FX.shatter3D) window.HHA_FX.shatter3D(r.left+r.width/2, r.top+r.height/2);
        } catch(_){}
        applyHit(meta, result);
      } catch(_){}
    }, {capture:true});

    // Render spawn (DOM proto)
    function renderSpawn(meta){
      var host = document.getElementById('spawnHost') || document.getElementById('gameLayer') || document.body;
      var el = document.createElement('button');
      el.className = 'spawn-emoji';
      el.type='button';
      el.textContent = meta.char || '🍎';
      el.setAttribute('aria-label', meta.aria||meta.label||'item');
      el.setAttribute('data-meta', JSON.stringify(meta));
      el.style.left = (Math.random()*72+14)+'%';
      el.style.top  = (Math.random()*50+20)+'%';
      try{ if (window.HHA_FX && window.HHA_FX.add3DTilt) window.HHA_FX.add3DTilt(el); }catch(_){}
      host.appendChild(el);
      var life = Math.max(400, Number(meta.life)||1200);
      setTimeout(function(){ if (el && el.parentNode) el.parentNode.removeChild(el); }, life);
    }

    // Loop
    var _raf = 0, _lastTs = 0, _secTimer = 0;
    function loop(ts){
      _raf = requestAnimationFrame(loop);
      var dt = Math.max(0, ts - _lastTs); _lastTs = ts;

      if (State.freezeUntil && performance.now() < State.freezeUntil) return;

      if (Systems.spawner.lastSpawn + Systems.spawner.lifeMs*0.9 < ts){
        Systems.spawner.lastSpawn = ts;
        var meta = spawnMeta(ts);
        if (meta) renderSpawn(meta);
      }

      try { if (getMode().tick) getMode().tick(State, Systems, Systems.hud); } catch(_){}

      _secTimer += dt;
      if (_secTimer >= 1000){
        _secTimer -= 1000;
        try { if (Quests.tick) Quests.tick({ score: Systems.score.get() }); } catch(_){}
      }
    }

    // ---------- Public API ----------
    var HHA = {
      startGame: function(){
        UI.start();
        State.running = true; State.ctx = {};
        Systems.score.reset();

        try { if (Quests.beginRun) Quests.beginRun(State.modeKey, State.difficulty, State.lang, State.seconds); } catch(_){}
        try { if (getMode().init) getMode().init(State, Systems.hud, { diff: State.difficulty }); } catch(e){ console.warn('mode init error', e); }
        try { if (Progress.emit) Progress.emit('run_start', { mode: State.modeKey, difficulty: State.difficulty }); } catch(_){}

        cancelAnimationFrame(_raf); _lastTs = performance.now(); _secTimer = 0;
        _raf = requestAnimationFrame(loop);
      },

      stopToMenu: function(){
        try { if (getMode().cleanup) getMode().cleanup(State, Systems.hud); } catch(_){}
        try {
          var sum = Systems.score.summary();
          sum.overfill = State.ctx && State.ctx.overfillCount|0;
          sum.highCount= State.ctx && State.ctx.highCount|0;
          if (Quests.endRun) Quests.endRun(sum);
          if (Progress.emit) Progress.emit('run_end', { mode: State.modeKey, score: sum.score|0, comboMax: sum.comboMax|0 });
        } catch(_){}
        cancelAnimationFrame(_raf);
        State.running = false;
        UI.menu();
      },

      pause: function(){ if (!State.running) return; UI.pause(); cancelAnimationFrame(_raf); },
      resume:function(){ if (!State.running) return; UI.resume(); _lastTs = performance.now(); _raf = requestAnimationFrame(loop); },

      selectMode: function(key){
        if (!MODES[key] || !MODES[key].init) return;
        State.modeKey = key;
        setText('#modeName', ({goodjunk:'Good vs Trash', groups:'Food Groups', hydration:'Water Balance', plate:'Balanced Plate'})[key]||key);
      },

      setLang: function(l){
        State.lang = (l||'TH').toUpperCase();
        localStorage.setItem('hha_lang', State.lang);
        try { if (QBind && QBind.refresh) QBind.refresh(); } catch(_){}
      },

      setDifficulty: function(d){
        State.difficulty = d || 'Normal';
        localStorage.setItem('hha_diff', State.difficulty);
      },

      toggleMute: function(){
        var m = localStorage.getItem('hha_mute')==='1' ? '0':'1';
        localStorage.setItem('hha_mute', m);
        try { if (Systems.sfx.setMute) Systems.sfx.setMute(m==='1'); } catch(_){}
      },

      do: function(action){
        if (action==='power-x2'){ try { if (getMode().powers && getMode().powers.x2Target) getMode().powers.x2Target(); } catch(_){}
        } else if (action==='power-freeze'){ State.freezeUntil = performance.now()+3000;
        } else if (action==='power-magnet'){ try { if (getMode().powers && getMode().powers.magnetNext) getMode().powers.magnetNext(); } catch(_){}
        }
      }
    };
    window.HHA = HHA;

    // ---------- Initial UI ----------
    UI.menu();
    HHA.selectMode(State.modeKey);
  })();
})();
