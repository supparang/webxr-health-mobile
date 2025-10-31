// /webxr-health-mobile/HeroHealth/game/main.js
// Hero Health Academy — MAIN
// (2025-10-31) 3D-ready + Timer Fallback + HUD fix + Patch v3

window.__HHA_BOOT_OK = true;

// ---------- Utils ----------
function $(s){ return document.querySelector(s); }
function setText(sel, txt){ var el=$(sel); if(el) el.textContent = txt; }
function on(el,ev,fn){ if(el) el.addEventListener(ev,fn,false); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function now(){ return (window.performance && performance.now)? performance.now() : Date.now(); }

// ---------- DOM ensure / HUD ไม่บังเมนู ----------
(function ensureDOM(){
  var hud = $('#hudWrap'); 
  if(!hud){ 
    hud=document.createElement('section'); 
    hud.id='hudWrap'; 
    hud.className='hud'; 
    hud.style.display='none'; 
    document.body.appendChild(hud); 
  }
  // HUD ไปขวาบนใต้ header
  hud.style.position='fixed';
  hud.style.top='64px';
  hud.style.right='12px';
  hud.style.zIndex='1500';
  hud.style.pointerEvents='none';

  var header = document.querySelector('header.brand');
  if(header){ header.style.position='sticky'; header.style.top='0'; header.style.zIndex='2000'; }

  var gl = $('#gameLayer'); 
  if(!gl){
    gl=document.createElement('section'); gl.id='gameLayer';
    gl.setAttribute('aria-label','playfield');
    gl.style.cssText='position:relative;width:min(980px,96vw);height:60vh;min-height:420px;margin:10px auto;border-radius:16px;border:1px solid #152641;background:radial-gradient(1200px 500px at 50% -40%, #152644 12%, #0c1729 55%, #0b1626);overflow:hidden;';
    document.body.appendChild(gl);
  }
  var host = $('#spawnHost'); 
  if(!host){ host=document.createElement('div'); host.id='spawnHost'; host.style.cssText='position:absolute;inset:0;'; gl.appendChild(host); }

  try{
    var rect = gl.getBoundingClientRect();
    if((rect.height||0) < 300){ gl.style.minHeight = '420px'; }
  }catch(_e){}
})();

// ---------- Paths ----------
var BASE = '/webxr-health-mobile/HeroHealth/game/';
var MODES_DIR = BASE + 'modes/';

// ---------- Global 3D context ----------
var THREE_CTX = { ready:false, THREE:null, renderer:null, scene:null, camera:null, raycaster:null, pointer:null, canvas:null };

function ensureThree(){
  if(THREE_CTX.ready) return Promise.resolve(THREE_CTX);
  return import('https://unpkg.com/three@0.159.0/build/three.module.js').then(function(THREE){
    var gl = $('#gameLayer');
    var canvas = document.getElementById('c'); 
    if(!canvas){ canvas = document.createElement('canvas'); canvas.id='c'; }
    // place canvas over playfield, under HUD
    canvas.style.position='absolute'; canvas.style.inset='0'; canvas.style.zIndex='5'; canvas.style.pointerEvents='auto';
    if(gl && !gl.contains(canvas)) gl.appendChild(canvas);

    var r = new THREE.WebGLRenderer({ canvas:canvas, antialias:true, alpha:true });
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, 16/9, 0.1, 100); camera.position.set(0,0,8);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    var dl = new THREE.DirectionalLight(0xffffff, 1.0); dl.position.set(3,5,4); scene.add(dl);

    function size(){
      var rect = gl ? gl.getBoundingClientRect() : {width:window.innerWidth, height:window.innerHeight};
      var w = Math.max(320, Math.floor(rect.width));
      var h = Math.max(200, Math.floor(rect.height));
      camera.aspect = w/h; camera.updateProjectionMatrix();
      r.setSize(w,h,false);
    }
    size(); window.addEventListener('resize', size);

    var ray = new THREE.Raycaster();
    var pointer = new THREE.Vector2();

    // ส่งคลิกให้โหมด (สำหรับ 3D hit-test)
    canvas.addEventListener('click', function(e){
      if(!State.modeAPI || !State.modeAPI.onPointer) return;
      var rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      THREE_CTX.pointer = pointer; THREE_CTX.raycaster = ray;
      State.modeAPI.onPointer(THREE_CTX);
    }, false);

    THREE_CTX = { ready:true, THREE:THREE, renderer:r, scene:scene, camera:camera, raycaster:ray, pointer:pointer, canvas:canvas };
    return THREE_CTX;
  }).catch(function(){ return { ready:false }; });
}

// ---------- State ----------
var State = {
  lang: 'th', gfx: 'Normal', sound: true, haptic: true,
  difficulty: 'Normal', modeKey: 'goodjunk',
  running: false, paused: false, timeLeft: 60,
  score: 0, combo: 0, bestCombo: 0, fever: 0,
  modeAPI: null, startAt: 0,
  sfx: {
    good: $('#sfx-good'), bad: $('#sfx-bad'),
    perfect: $('#sfx-perfect'), tick: $('#sfx-tick'), powerup: $('#sfx-powerup')
  }
};

// ---------- Texts ----------
var T = {
  th:{score:'คะแนน',combo:'คอมโบ',time:'เวลา',mode:'โหมด',diff:'ความยาก',
      modes:{goodjunk:'ดี vs ขยะ',groups:'จาน 5 หมู่',hydration:'สมดุลน้ำ',plate:'จัดจานสุขภาพ'},
      start:'▶ เริ่มเกม',pause:'⏸ พัก',restart:'↻ เริ่มใหม่',
      tipsGoodJunk:'แตะ/ตี เป้า “อาหารดี” เพื่อเก็บคะแนน หลีกเลี่ยงขยะ! ตีแล้วแตกกระจาย'},
  en:{score:'Score',combo:'Combo',time:'Time',mode:'Mode',diff:'Difficulty',
      modes:{goodjunk:'Good vs Junk',groups:'Food Groups',hydration:'Water Balance',plate:'Healthy Plate'},
      start:'▶ Start',pause:'⏸ Pause',restart:'↻ Restart',
      tipsGoodJunk:'Hit the healthy 3D targets to score. Avoid junk! Shatter on hit.'}
};

// ---------- UI refs ----------
var el = {
  score: $('#score'), combo: $('#combo'), time: $('#time'),
  t_score: $('#t_score'), t_combo: $('#t_combo'), t_time: $('#t_time'),
  t_mode: $('#t_mode'), t_diff: $('#t_diff'), modeName: $('#modeName'), difficulty: $('#difficulty'),
  feverBar: $('#feverBar'), feverText: $('#fever'),
  coach: $('#coachHUD'), coachText: $('#coachText'),
  btnStart: $('#btn_start'), btnPause: $('#btn_pause'), btnRestart: $('#btn_restart'),
  langToggle: $('#langToggle'), gfxToggle: $('#gfxToggle'), soundToggle: $('#soundToggle'), hapticToggle: $('#hapticToggle'),
  dEasy: $('#d_easy'), dNormal: $('#d_normal'), dHard: $('#d_hard'),
  mGood: $('#m_goodjunk'), mGroups: $('#m_groups'), mHyd: $('#m_hydration'), mPlate: $('#m_plate'),
  help: $('#help'), helpBody: $('#helpBody'), helpOpen: $('#btn_help'), helpClose: $('#btn_ok'),
  helpScene: $('#helpScene'), helpAllBody: $('#helpAllBody'),
  helpSceneOpen: $('#btn_helpScene'), helpSceneClose: $('#btn_ok_all'),
  result: $('#result'), resText: $('#resultText'), resCore: $('#resCore'),
  statPanel: $('#statBoard'), statBody: $('#statBoardBody'),
  dailyPanel: $('#dailyPanel'), dailyBody: $('#dailyBody'), dailyReward: $('#dailyReward'),
  statOpen: $('#btn_stats'), dailyOpen: $('#btn_daily')
};

// ---------- Fever / Score / Time ----------
function setFever(v){
  State.fever = clamp(v,0,100);
  if(el.feverBar) el.feverBar.style.width = State.fever + '%';
  if(el.feverText) el.feverText.style.display = (State.fever>=95?'block':'none');
}
function addScore(amount, isPerfect){
  State.score += amount;
  State.combo += 1;
  State.bestCombo = Math.max(State.bestCombo, State.combo);
  setFever(State.fever + (isPerfect?6:3));
  if(el.score) el.score.textContent = String(State.score);
  if(el.combo) el.combo.textContent = 'x' + String(State.combo);
  if(State.sound) playSFX(isPerfect?'perfect':'good');
}
function badHit(){
  if(State.sound) playSFX('bad');
  State.combo = 0;
  if(el.combo) el.combo.textContent = 'x0';
  setFever(Math.max(0, State.fever - 12));
}
function setTimeLeft(sec){
  State.timeLeft = Math.max(0, sec);
  if(el.time) el.time.textContent = String(Math.max(0, Math.round(State.timeLeft)));
}

// ---------- expose hooks for modes ----------
window.__HHA_modeHooks = {
  addScore: function(delta, perfect){ addScore(delta, !!perfect); },
  badHit: function(){ badHit(); }
};

// ---------- Lang ----------
function applyLang(){
  var L = T[State.lang];
  setText('#t_score', L.score); setText('#t_combo', L.combo); setText('#t_time',  L.time);
  setText('#t_mode',  L.mode);  setText('#t_diff',  L.diff);
  setText('#btn_start',  L.start); setText('#btn_pause',  L.pause); setText('#btn_restart', L.restart);
  setText('#modeName',   L.modes[State.modeKey] || State.modeKey);
  setText('#difficulty', State.difficulty);
  var lt = $('#langToggle'); if(lt) lt.textContent = '🇹🇭 TH/EN';
}

// ---------- SFX ----------
function playSFX(name){
  if(!State.sound) return;
  var a = State.sfx[name];
  if(a){ try{ a.currentTime=0; a.play(); }catch(_e){} }
}

// ---------- Mode loader ----------
var registry = { goodjunk:null, groups:null, hydration:null, plate:null };
function tryImport(path){ return new Promise(function(res,rej){ import(path).then(res).catch(rej); }); }
function getMode(key){
  if(registry[key]) return Promise.resolve(registry[key]);
  var url = MODES_DIR + key + '.js?v=live';
  return tryImport(url).then(function(m){ registry[key] = m; return m; }).catch(function(){
    if(key==='goodjunk') { registry[key] = BuiltinGoodJunk(); return registry[key]; }
    registry[key] = StubMode(key); return registry[key];
  });
}

// ----- Builtin GoodJunk fallback (DOM-only; เผื่อโหลดโหมดไม่ขึ้น) -----
function BuiltinGoodJunk(){
  var GOOD=['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
  var JUNK=['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
  var host=null,alive=false,spawnT=0,rate=700,life=1600;
  function rng(a,b){ return Math.floor(a + Math.random()*(b-a+1)); }
  function make(txt,good){ var d=document.createElement('button'); d.className='spawn-emoji'; d.textContent=txt;
    d.style.position='absolute'; d.style.border='0'; d.style.background='transparent'; d.style.fontSize='38px'; d.style.filter='drop-shadow(0 3px 6px rgba(0,0,0,.45))';
    d.dataset.good=good?'1':'0'; var W=host.clientWidth||640,H=host.clientHeight||360,pad=24;
    d.style.left=(rng(pad,Math.max(pad,W-64)))+'px'; d.style.top=(rng(pad,Math.max(pad,H-64)))+'px';
    var lifeMs=rng(life-250,life+250),gone=false; var to=setTimeout(function(){ if(!gone) leave(); },lifeMs);
    function leave(){ gone=true; d.style.transition='transform 160ms ease, opacity 160ms ease'; d.style.transform='scale(.6) translateY(10px)'; d.style.opacity='0'; setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); },170); }
    on(d,'click',function(){ if(!alive) return; clearTimeout(to); d.style.transition='transform 120ms ease, opacity 120ms ease'; d.style.transform='scale(1.25)'; setTimeout(function(){ d.style.opacity='0'; },90); setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); },130);
      if(d.dataset.good==='1'){ var perfect=Math.random()<0.22; addScore(perfect?200:100, perfect); } else { badHit(); } });
    host.appendChild(d);
  }
  return { name:'goodjunk',
    help:function(lang){ return (lang==='en'?T.en.tipsGoodJunk:T.th.tipsGoodJunk); },
    start:function(cfg){ host=$('#spawnHost'); if(!host){ var gl=$('#gameLayer'); host=document.createElement('div'); host.id='spawnHost'; host.style.position='absolute'; host.style.inset='0'; if(gl) gl.appendChild(host); else document.body.appendChild(host); }
      alive=true; spawnT=0; var d=(cfg&&cfg.difficulty)||'Normal'; if(d==='Easy'){rate=820;life=1900;} else if(d==='Hard'){rate=560;life=1400;} else {rate=700;life=1600;}
      $('#hudWrap').style.display='block'; },
    pause:function(){ alive=false; }, resume:function(){ alive=true; },
    stop:function(){ alive=false; if(host){ var nodes=host.querySelectorAll('.spawn-emoji'); for(var i=0;i<nodes.length;i++){ var n=nodes[i]; if(n&&n.parentNode) n.parentNode.removeChild(n); } } },
    update:function(dt){ if(!alive) return; spawnT+=dt; if(spawnT>=rate){ spawnT=Math.max(0,spawnT-rate); var good=Math.random()<0.7; if(Math.random()<0.12) make('🌟',true); else make(good?GOOD[rng(0,GOOD.length-1)]:JUNK[rng(0,JUNK.length-1)], good); } }
  };
}
function StubMode(key){ var alive=false, shown=false; return { name:key, help:function(lang){ return (lang==='en'?'This mode is coming soon.':'โหมดนี้กำลังพัฒนา'); },
  start:function(){ alive=true; shown=false; $('#hudWrap').style.display='block'; }, pause:function(){ alive=false; }, resume:function(){ alive=true; },
  stop:function(){ alive=false; }, update:function(){ if(alive && !shown){ shown=true; var c=$('#coachText'); if(c) c.textContent='(Demo) Mode "'+key+'" is a stub.'; } } }; }

// ---------- Controls state ----------
function setControlsState(state){
  var bStart = $('#btn_start'), bPause = $('#btn_pause'), bRestart = $('#btn_restart');
  if(!bStart || !bPause || !bRestart) return;
  if(state==='running'){ bStart.disabled = true;  bPause.disabled = false; bRestart.disabled = false; }
  else if(state==='paused'){ bStart.disabled = true; bPause.disabled = false; bRestart.disabled = false; }
  else { bStart.disabled = false; bPause.disabled = true;  bRestart.disabled = false; }
}

// ---------- Lifecycle ----------
function resetState(){
  State.running=false; State.paused=false;
  State.score=0; State.combo=0; State.bestCombo=0; setFever(0);
  setTimeLeft( (State.difficulty==='Easy')?70 : (State.difficulty==='Hard'?55:60) );
  if(el.coach) el.coach.style.display='flex';
  if(el.coachText) el.coachText.textContent = (State.lang==='en'?'Ready? Let’s go!':'พร้อมไหม? สู้ๆ!');
  if(el.result) el.result.style.display='none';
  setControlsState('idle');
}

function startGame(){
  if(State.running) return;
  resetState();
  var hud = $('#hudWrap'); if(hud) hud.style.display='block';

  getMode(State.modeKey).then(function(api){
    State.modeAPI = api;
    // ----- init 3D (optional) -----
    ensureThree().then(function(ctx){
      if(api && typeof api.start==='function') api.start({ difficulty: State.difficulty, lang: State.lang, three: ctx.ready ? ctx : null });
      State.running = true; State.paused = false; State.startAt = now();
      if(_raf) cancelAnimationFrame(_raf); _prev = 0;
      setControlsState('running');
      loopHandle(); startFallbackTimer();
    });
  }).catch(function(){
    State.modeAPI = BuiltinGoodJunk();
    ensureThree().then(function(ctx){
      State.modeAPI.start({ difficulty: State.difficulty, lang: State.lang, three: ctx.ready ? ctx : null });
      State.running = true; State.paused = false; State.startAt = now();
      if(_raf) cancelAnimationFrame(_raf); _prev = 0;
      setControlsState('running');
      loopHandle(); startFallbackTimer();
    });
  });
}

function pauseGame(){
  if(!State.running) return;
  State.paused = !State.paused;
  if(State.modeAPI){
    if(State.paused && State.modeAPI.pause) State.modeAPI.pause();
    if(!State.paused && State.modeAPI.resume) State.modeAPI.resume();
  }
  setControlsState(State.paused?'paused':'running');
}

function stopGame(showResult){
  if(State.modeAPI && State.modeAPI.stop) State.modeAPI.stop();
  State.running=false; State.paused=false;
  setControlsState('idle');
  stopFallbackTimer();
  if(showResult) openResult();
}

function openResult(){
  if(el.resText) el.resText.textContent = (State.lang==='en'?'Finished! You scored ':'จบเกม! ทำได้ ') + Math.round(State.score) + ' pts, ' + State.bestCombo + ' combo.';
  try{
    var hs = parseInt(window.localStorage.getItem('HHA_HISCORE')||'0',10);
    var bc = parseInt(window.localStorage.getItem('HHA_BESTCOMBO')||'0',10);
    if(State.score > hs) window.localStorage.setItem('HHA_HISCORE', String(State.score));
    if(State.bestCombo > bc) window.localStorage.setItem('HHA_BESTCOMBO', String(State.bestCombo));
  }catch(_e){}
}

// ---------- Audio unlock ----------
(function audioUnlockOnce(){
  var unlocked = false;
  function unlock(){
    if(unlocked) return; unlocked = true;
    try{
      var ids = ['sfx-good','sfx-bad','sfx-perfect','sfx-tick','sfx-powerup'];
      for(var i=0;i<ids.length;i++){
        var a = document.getElementById(ids[i]);
        if(a){ a.muted=false; a.play().then(function(){ a.pause(); a.currentTime=0; }).catch(function(){}); }
      }
    }catch(_e){}
    document.removeEventListener('click', unlock, true);
    document.removeEventListener('touchstart', unlock, true);
  }
  document.addEventListener('click', unlock, true);
  document.addEventListener('touchstart', unlock, true);
})();

// ---------- Main loop (+ render 3D) + Timer Fallback ----------
var _raf=0,_prev=0,_lastLoopAt=0,_fallbackTimer=null;

function loopHandle(t){
  if(!State.running){ cancelAnimationFrame(_raf); return; }
  _raf = requestAnimationFrame(loopHandle);
  var ts = (typeof t==='number'? t : (performance && performance.now ? performance.now() : Date.now()));
  if(!_prev) _prev = ts;
  var dt = ts - _prev; _prev = ts;

  if(dt > 120) dt = 120;
  _lastLoopAt = Date.now();

  if(State.paused) return;

  var newLeft = State.timeLeft - (dt/1000);
  if(Math.floor(newLeft) !== Math.floor(State.timeLeft) && State.timeLeft>0){ playSFX('tick'); }
  setTimeLeft(newLeft);
  if(State.timeLeft<=0){ setTimeLeft(0); stopGame(true); return; }

  if(State.modeAPI && State.modeAPI.update) State.modeAPI.update(dt);

  // ----- render 3D (ถ้ามี) -----
  if(THREE_CTX.ready){
    THREE_CTX.renderer.render(THREE_CTX.scene, THREE_CTX.camera);
  }
}

// ถ้า RAF ไม่วิ่ง → ใช้ timer สำรอง
function startFallbackTimer(){
  if(_fallbackTimer) return;
  _lastLoopAt = Date.now();
  _fallbackTimer = setInterval(function(){
    if(!State.running || State.paused) return;
    if(Date.now() - _lastLoopAt < 600) return; // RAF ยังวิ่ง
    var dt = 200;
    setTimeLeft(State.timeLeft - (dt/1000));
    if(State.timeLeft<=0){ setTimeLeft(0); stopGame(true); return; }
    if(State.modeAPI && State.modeAPI.update) State.modeAPI.update(dt);
    if(THREE_CTX.ready){ THREE_CTX.renderer.render(THREE_CTX.scene, THREE_CTX.camera); }
  }, 200);
}
function stopFallbackTimer(){
  if(_fallbackTimer){ clearInterval(_fallbackTimer); _fallbackTimer=null; }
}

// ---------- UI wiring ----------
function wireUI(){
  on(el.langToggle,'click',function(){ State.lang = (State.lang==='th'?'en':'th'); applyLang(); });
  on(el.soundToggle,'click',function(){ State.sound = !State.sound; this.textContent = (State.sound?'🔊 เสียง: เปิด':'🔇 เสียง: ปิด'); });
  on(el.gfxToggle,'click',function(){ State.gfx = (State.gfx==='Normal'?'Lite':'Normal'); this.textContent = (State.gfx==='Normal'?'🎛️ กราฟิก: ปกติ':'🎛️ กราฟิก: ประหยัด'); });
  on(el.hapticToggle,'click',function(){ State.haptic = !State.haptic; this.textContent = (State.haptic?'📳 สั่น: เปิด':'📴 สั่น: ปิด'); });

  function setDiff(d){ State.difficulty = d; if(el.difficulty) el.difficulty.textContent = d; }
  on(el.dEasy,'click',function(){ setDiff('Easy'); });
  on(el.dNormal,'click',function(){ setDiff('Normal'); });
  on(el.dHard,'click',function(){ setDiff('Hard'); });

  function setMode(key){ State.modeKey = key; setText('#modeName', T[State.lang].modes[key] || key); }
  on(el.mGood,'click',function(){ setMode('goodjunk'); });
  on(el.mGroups,'click',function(){ setMode('groups'); });
  on(el.mHyd,'click',function(){ setMode('hydration'); });
  on(el.mPlate,'click',function(){ setMode('plate'); });

  on(el.btnStart,'click',function(){ startGame(); });
  on(el.btnPause,'click',function(){ pauseGame(); });
  on(el.btnRestart,'click',function(){ stopGame(false); startGame(); });

  // Help/Stats/Daily (สรุป)
  on(el.helpOpen,'click',function(){
    var tip = (State.modeAPI && State.modeAPI.help)? State.modeAPI.help(State.lang) : (State.lang==='en'?'Have fun!':'ขอให้สนุก!');
    if(el.helpBody) el.helpBody.textContent = tip;
    if(el.help) el.help.style.display='block';
  });
  on(el.helpClose,'click',function(){ if(el.help) el.help.style.display='none'; });

  on(el.helpSceneOpen,'click',function(){
    if(el.helpAllBody){
      el.helpAllBody.innerHTML = ''
        + '<div class="chip">🥗 '+T[State.lang].modes.goodjunk+': '+(State.lang==='en'?T.en.tipsGoodJunk:T.th.tipsGoodJunk)+'</div>'
        + '<div class="chip">🍽️ '+T[State.lang].modes.groups+': (coming soon)</div>'
        + '<div class="chip">💧 '+T[State.lang].modes.hydration+': (coming soon)</div>'
        + '<div class="chip">🍱 '+T[State.lang].modes.plate+': (coming soon)</div>';
    }
    if(el.helpScene) el.helpScene.style.display='block';
  });
  on(el.helpSceneClose,'click',function(){ if(el.helpScene) el.helpScene.style.display='none'; });

  on(el.statOpen,'click',function(){
    if(el.statBody){
      el.statBody.innerHTML = '<div class="chip">Hi-score: <b>'+ (window.localStorage.getItem('HHA_HISCORE')||'0') +'</b></div>'
        + '<div class="chip">Best Combo: <b>'+ (window.localStorage.getItem('HHA_BESTCOMBO')||'0') +'</b></div>';
    }
    if(el.statPanel) el.statPanel.style.display='block';
  });
  on(window,'blur',function(){ if(State.running && !State.paused){ pauseGame(); } });
}

// ---------- Init ----------
(function init(){ applyLang(); wireUI(); resetState(); })();
