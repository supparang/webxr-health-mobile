// /webxr-health-mobile/HeroHealth/game/main.js
// Hero Health Academy — MAIN (2025-10-31 Patch Pack v3)
// - Safe boot + Dynamic import modes + Builtin fallback
// - Glue hooks (__HHA_modeHooks) ให้โหมดส่งคะแนนเข้า core ได้แน่นอน
// - Start/Pause/Restart คุมสถานะปุ่ม, HUD, timer, result
// - Pause on blur, Audio unlock (autoplay guard), TH/EN toggle ครบ
// - Loop ป้องกัน FPS spike (dt cap) และกันลูปซ้อน
// - Enforce playfield min-height

// ----- Boot flag for HTML loader -----
window.__HHA_BOOT_OK = true;

// ----- Utils -----
function $(s){ return document.querySelector(s); }
function setText(sel, txt){ var el=$(sel); if(el) el.textContent = txt; }
function on(el,ev,fn){ if(el) el.addEventListener(ev,fn,false); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function now(){ return (window.performance && performance.now)? performance.now() : Date.now(); }

// ----- DOM ensure / playfield safety -----
(function ensureDOM(){
  var hud = $('#hudWrap'); if(!hud){ var h=document.createElement('section'); h.id='hudWrap'; h.className='hud'; h.style.display='none'; document.body.appendChild(h); }
  var gl = $('#gameLayer'); if(!gl){
    var g=document.createElement('section'); g.id='gameLayer';
    g.setAttribute('aria-label','playfield');
    g.style.cssText='position:relative;width:min(980px,96vw);height:60vh;min-height:420px;margin:10px auto;border-radius:16px;border:1px solid #152641;background:radial-gradient(1200px 500px at 50% -40%, #152644 12%, #0c1729 55%, #0b1626);overflow:hidden;';
    document.body.appendChild(g);
  }
  var host = $('#spawnHost'); if(!host){ var s=document.createElement('div'); s.id='spawnHost'; s.style.cssText='position:absolute;inset:0;'; $('#gameLayer').appendChild(s); }

  // enforce min height if too short (บางธีม CSS ทำให้เตี้ยเกิน)
  try{
    var rect = $('#gameLayer').getBoundingClientRect();
    if((rect.height||0) < 300){ $('#gameLayer').style.minHeight = '420px'; }
  }catch(_e){}
})();

// ----- Paths -----
var BASE = '/webxr-health-mobile/HeroHealth/game/';
var MODES_DIR = BASE + 'modes/';

// ----- State -----
var State = {
  lang: 'th',           // 'th' | 'en'
  gfx: 'Normal',        // label only
  sound: true,
  haptic: true,
  difficulty: 'Normal', // Easy/Normal/Hard
  modeKey: 'goodjunk',  // goodjunk/groups/hydration/plate
  running: false,
  paused: false,
  timeLeft: 60,
  score: 0,
  combo: 0,
  bestCombo: 0,
  fever: 0,
  modeAPI: null,
  startAt: 0,
  sfx: {
    good: $('#sfx-good'),
    bad: $('#sfx-bad'),
    perfect: $('#sfx-perfect'),
    tick: $('#sfx-tick'),
    powerup: $('#sfx-powerup')
  }
};

// ----- Texts (TH/EN) -----
var T = {
  th: {
    score:'คะแนน', combo:'คอมโบ', time:'เวลา', mode:'โหมด', diff:'ความยาก',
    target:'หมวด', quota:'โควตา', hydro:'สมดุลน้ำ',
    helpTitle:'วิธีเล่น', ok:'โอเค', summary:'สรุปผล',
    daily:'ภารกิจรายวัน', stats:'บอร์ดสถิติรวม',
    modes:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
    start:'▶ เริ่มเกม', pause:'⏸ พัก', restart:'↻ เริ่มใหม่',
    tipsGoodJunk:'แตะอาหาร “ดีต่อสุขภาพ” เพื่อเก็บคะแนน หลีกเลี่ยงอาหารขยะ โดนขยะคอมโบจะรีเซ็ต ระวังเวลาหมด!',
    finished:'จบเกม! ทำได้',
    star:'ดาว', sec:'วินาที'
  },
  en: {
    score:'Score', combo:'Combo', time:'Time', mode:'Mode', diff:'Difficulty',
    target:'Target', quota:'Quota', hydro:'Hydration',
    helpTitle:'How to Play', ok:'OK', summary:'Summary',
    daily:'Daily Challenge', stats:'Global Stats',
    modes:{goodjunk:'Good vs Junk', groups:'Food Groups', hydration:'Water Balance', plate:'Healthy Plate'},
    start:'▶ Start', pause:'⏸ Pause', restart:'↻ Restart',
    tipsGoodJunk:'Tap healthy foods to score. Avoid junk! Bad hits reset combo. Race against the clock!',
    finished:'Finished! You scored',
    star:'star', sec:'s'
  }
};

// ----- UI refs -----
var el = {
  score: $('#score'), combo: $('#combo'), time: $('#time'),
  t_score: $('#t_score'), t_combo: $('#t_combo'), t_time: $('#t_time'),
  t_mode: $('#t_mode'), t_diff: $('#t_diff'), modeName: $('#modeName'), difficulty: $('#difficulty'),
  feverWrap: $('#feverBarWrap'), feverBar: $('#feverBar'), feverText: $('#fever'),
  questChips: $('#questChips'),
  coach: $('#coachHUD'), coachText: $('#coachText'),
  missionLine: $('#missionLine'),
  spawnHost: $('#spawnHost'),
  btnStart: $('#btn_start'), btnPause: $('#btn_pause'), btnRestart: $('#btn_restart'),
  langToggle: $('#langToggle'), gfxToggle: $('#gfxToggle'), soundToggle: $('#soundToggle'), hapticToggle: $('#hapticToggle'),
  dEasy: $('#d_easy'), dNormal: $('#d_normal'), dHard: $('#d_hard'),
  mGood: $('#m_goodjunk'), mGroups: $('#m_groups'), mHyd: $('#m_hydration'), mPlate: $('#m_plate'),
  help: $('#help'), helpBody: $('#helpBody'), helpOpen: $('#btn_help'), helpClose: $('#btn_ok'),
  helpScene: $('#helpScene'), helpAllBody: $('#helpAllBody'),
  helpSceneOpen: $('#btn_helpScene'), helpSceneClose: $('#btn_ok_all'),
  result: $('#result'), resText: $('#resultText'), resCore: $('#resCore'),
  resBreak: $('#resBreakdown'), resBoard: $('#resBoard'), resMissions: $('#resMissions'), resDaily: $('#resDaily'),
  statPanel: $('#statBoard'), statBody: $('#statBoardBody'),
  dailyPanel: $('#dailyPanel'), dailyBody: $('#dailyBody'), dailyReward: $('#dailyReward'),
  statOpen: $('#btn_stats'), dailyOpen: $('#btn_daily')
};

// ----- Fever / Score core -----
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
  var gl = $('#gameLayer');
  if(gl){
    var old = gl.style.background;
    gl.style.transition='background 120ms ease';
    gl.style.background='radial-gradient(1200px 500px at 50% -40%, #411a26 12%, #2a0c16 55%, #200b16)';
    setTimeout(function(){ gl.style.background=old; }, 140);
  }
}
function setTimeLeft(sec){
  State.timeLeft = Math.max(0, Math.round(sec));
  if(el.time) el.time.textContent = String(State.timeLeft);
}

// ----- expose hooks for modes (glue) -----
window.__HHA_modeHooks = {
  addScore: function(delta, perfect){ addScore(delta, !!perfect); },
  badHit: function(){ badHit(); }
};

// ----- Lang apply -----
function applyLang(){
  var L = T[State.lang];
  setText('#t_score', L.score);
  setText('#t_combo', L.combo);
  setText('#t_time',  L.time);
  setText('#t_mode',  L.mode);
  setText('#t_diff',  L.diff);
  setText('#btn_start',  L.start);
  setText('#btn_pause',  L.pause);
  setText('#btn_restart',L.restart);
  setText('#modeName',   L.modes[State.modeKey] || State.modeKey);
  setText('#difficulty', State.difficulty);
  var lt = $('#langToggle'); if(lt) lt.textContent = '🇹🇭 TH/EN';
}

// ----- SFX -----
function playSFX(name){
  if(!State.sound) return;
  var a = State.sfx[name];
  if(a){ try{ a.currentTime=0; a.play(); }catch(_e){} }
}

// ----- Mode loader (with fallback) -----
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

// ----- Builtin GoodJunk fallback (DOM) -----
function BuiltinGoodJunk(){
  var GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
  var JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
  var host=null, alive=false, spawnT=0, rate=700, life=1600;
  function rng(a,b){ return Math.floor(a + Math.random()*(b-a+1)); }
  function make(txt, good){
    var d=document.createElement('button'); d.className='spawn-emoji'; d.textContent=txt;
    d.style.position='absolute'; d.style.border='0'; d.style.background='transparent';
    d.style.fontSize='38px'; d.style.filter='drop-shadow(0 3px 6px rgba(0,0,0,.45))';
    d.dataset.good = good?'1':'0';
    var W=host.clientWidth||640, H=host.clientHeight||360, pad=24;
    d.style.left = rng(pad, Math.max(pad, W-64))+'px';
    d.style.top  = rng(pad, Math.max(pad, H-64))+'px';
    var lifeMs = rng(life-250, life+250), gone=false;
    var to = setTimeout(function(){ if(!gone) leave(); }, lifeMs);
    function leave(){ gone=true; d.style.transition='transform 160ms ease, opacity 160ms ease'; d.style.transform='scale(.6) translateY(10px)'; d.style.opacity='0'; setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); },170); }
    on(d,'click',function(){
      if(!alive) return;
      clearTimeout(to);
      d.style.transition='transform 120ms ease, opacity 120ms ease'; d.style.transform='scale(1.25)'; setTimeout(function(){ d.style.opacity='0'; },90);
      setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); },130);
      if(d.dataset.good==='1'){ var perfect=Math.random()<0.22; addScore(perfect?200:100, perfect); }
      else{ badHit(); }
    });
    host.appendChild(d);
  }
  return {
    name:'goodjunk',
    help:function(lang){ return (lang==='en'? T.en.tipsGoodJunk : T.th.tipsGoodJunk); },
    start:function(cfg){
      host = $('#spawnHost'); if(!host){ var gl=$('#gameLayer'); host=document.createElement('div'); host.id='spawnHost'; host.style.position='absolute'; host.style.inset='0'; if(gl) gl.appendChild(host); else document.body.appendChild(host); }
      alive=true; spawnT=0;
      var d=(cfg&&cfg.difficulty)||'Normal'; if(d==='Easy'){rate=820;life=1900;} else if(d==='Hard'){rate=560;life=1400;} else {rate=700;life=1600;}
      $('#hudWrap').style.display='block';
    },
    pause:function(){ alive=false; }, resume:function(){ alive=true; },
    stop:function(){ alive=false; if(host){ var nodes=host.querySelectorAll('.spawn-emoji'); for(var i=0;i<nodes.length;i++){ var n=nodes[i]; if(n&&n.parentNode) n.parentNode.removeChild(n); } } },
    update:function(dt){ if(!alive) return; spawnT+=dt; if(spawnT>=rate){ spawnT=Math.max(0,spawnT-rate); var good=Math.random()<0.7; if(Math.random()<0.12) make('🌟',true); else make(good?GOOD[rng(0,GOOD.length-1)]:JUNK[rng(0,JUNK.length-1)], good); } }
  };
}
// ----- Stubs for other modes -----
function StubMode(key){
  var alive=false, shown=false;
  return {
    name:key,
    help:function(lang){ return (lang==='en'?'This mode is coming soon.':'โหมดนี้กำลังพัฒนา'); },
    start:function(){ alive=true; shown=false; $('#hudWrap').style.display='block'; },
    pause:function(){ alive=false; }, resume:function(){ alive=true; },
    stop:function(){ alive=false; },
    update:function(){ if(alive && !shown){ shown=true; var c=$('#coachText'); if(c) c.textContent='(Demo) Mode "'+key+'" is a stub.'; } }
  };
}

// ----- Controls state helper -----
function setControlsState(state){ // 'idle' | 'running' | 'paused'
  var bStart = $('#btn_start'), bPause = $('#btn_pause'), bRestart = $('#btn_restart');
  if(!bStart || !bPause || !bRestart) return;
  if(state==='running'){ bStart.disabled = true;  bPause.disabled = false; bRestart.disabled = false; }
  else if(state==='paused'){ bStart.disabled = true; bPause.disabled = false; bRestart.disabled = false; }
  else { bStart.disabled = false; bPause.disabled = true;  bRestart.disabled = false; }
}

// ----- Lifecycle -----
function resetState(){
  State.running=false; State.paused=false;
  State.score=0; State.combo=0; State.bestCombo=0; setFever(0);
  setTimeLeft( (State.difficulty==='Easy')?70 : (State.difficulty==='Hard'?55:60) );
  if(el.score) el.score.textContent='0';
  if(el.combo) el.combo.textContent='x0';
  if(el.coach) el.coach.style.display='flex';
  if(el.coachText) el.coachText.textContent = (State.lang==='en'?'Ready? Let’s go!':'พร้อมไหม? สู้ๆ!');
  if(el.result) el.result.style.display='none';
  setControlsState('idle');
}

function startGame(){
  if(State.running) return;      // กัน Start ซ้ำ
  resetState();
  var hud = $('#hudWrap'); if(hud) hud.style.display='block';

  getMode(State.modeKey).then(function(api){
    State.modeAPI = api;
    if(api && typeof api.start==='function') api.start({ difficulty: State.difficulty, lang: State.lang });
    State.running = true; State.paused = false; State.startAt = now();
    if(_raf) cancelAnimationFrame(_raf); _prev = 0;   // กันลูปซ้อน
    setControlsState('running');
    loopHandle();
  }).catch(function(){
    // fallback สุดท้าย
    State.modeAPI = BuiltinGoodJunk();
    State.modeAPI.start({ difficulty: State.difficulty, lang: State.lang });
    State.running = true; State.paused = false; State.startAt = now();
    if(_raf) cancelAnimationFrame(_raf); _prev = 0;
    setControlsState('running');
    loopHandle();
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
  if(showResult) openResult();
}

function openResult(){
  var L = T[State.lang];
  if(el.resText) el.resText.textContent = L.finished + ' ' + State.score + ' pts, ' + State.bestCombo + ' combo.';
  var stars = (State.score>=6000)?5 : (State.score>=4200)?4 : (State.score>=2600)?3 : (State.score>=1400)?2 : (State.score>0)?1:0;
  if(el.resCore){
    el.resCore.innerHTML = '';
    var s = document.createElement('div');
    s.style.fontSize='22px'; s.style.fontWeight='800'; s.style.margin='4px 0 8px';
    s.textContent = '★'.repeat(stars) + ' ('+stars+')';
    el.resCore.appendChild(s);
  }
  if(el.result) el.result.style.display='block';

  // save hiscore
  try{
    var hs = parseInt(window.localStorage.getItem('HHA_HISCORE')||'0',10);
    var bc = parseInt(window.localStorage.getItem('HHA_BESTCOMBO')||'0',10);
    if(State.score > hs) window.localStorage.setItem('HHA_HISCORE', String(State.score));
    if(State.bestCombo > bc) window.localStorage.setItem('HHA_BESTCOMBO', String(State.bestCombo));
  }catch(_e){}
}

// ----- Audio unlock (autoplay guard) -----
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

// ----- Main loop (dt cap + no double loop) -----
var _raf=0,_prev=0;
function loopHandle(t){
  if(!State.running){ cancelAnimationFrame(_raf); return; }
  _raf = requestAnimationFrame(loopHandle);
  var ts = (typeof t==='number'? t : (performance && performance.now ? performance.now() : Date.now()));
  if(!_prev) _prev = ts;
  var dt = ts - _prev; _prev = ts;

  // cap dt to avoid huge bursts on resume/lag
  if(dt > 120) dt = 120;

  if(State.paused) return;

  // countdown
  var newLeft = State.timeLeft - (dt/1000);
  if(Math.floor(newLeft) !== Math.floor(State.timeLeft) && State.timeLeft>0){ playSFX('tick'); }
  setTimeLeft(newLeft);
  if(State.timeLeft<=0){ setTimeLeft(0); stopGame(true); return; }

  // mode update
  if(State.modeAPI && State.modeAPI.update) State.modeAPI.update(dt);
}

// ----- UI wiring -----
function wireUI(){
  // Lang toggle
  on(el.langToggle,'click',function(){
    State.lang = (State.lang==='th'?'en':'th');
    applyLang();
  });

  // Sound toggle
  on(el.soundToggle,'click',function(){
    State.sound = !State.sound;
    this.textContent = (State.sound?'🔊 เสียง: เปิด':'🔇 เสียง: ปิด');
  });

  // Gfx toggle (label only)
  on(el.gfxToggle,'click',function(){
    State.gfx = (State.gfx==='Normal'?'Lite':'Normal');
    this.textContent = (State.gfx==='Normal'?'🎛️ กราฟิก: ปกติ':'🎛️ กราฟิก: ประหยัด');
  });

  // Haptic toggle (label only)
  on(el.hapticToggle,'click',function(){
    State.haptic = !State.haptic;
    this.textContent = (State.haptic?'📳 สั่น: เปิด':'📴 สั่น: ปิด');
  });

  // Difficulty
  function setDiff(d){ State.difficulty = d; if(el.difficulty) el.difficulty.textContent = d; }
  on(el.dEasy,'click',function(){ setDiff('Easy'); });
  on(el.dNormal,'click',function(){ setDiff('Normal'); });
  on(el.dHard,'click',function(){ setDiff('Hard'); });

  // Mode select
  function setMode(key){ State.modeKey = key; setText('#modeName', T[State.lang].modes[key] || key); }
  on(el.mGood,'click',function(){ setMode('goodjunk'); });
  on(el.mGroups,'click',function(){ setMode('groups'); });
  on(el.mHyd,'click',function(){ setMode('hydration'); });
  on(el.mPlate,'click',function(){ setMode('plate'); });

  // Start/Pause/Restart
  on(el.btnStart,'click',function(){ startGame(); });
  on(el.btnPause,'click',function(){ pauseGame(); });
  on(el.btnRestart,'click',function(){ stopGame(false); startGame(); });

  // Help (mode)
  on(el.helpOpen,'click',function(){
    var tip = (State.modeAPI && State.modeAPI.help)? State.modeAPI.help(State.lang) : (State.lang==='en'?'Have fun!':'ขอให้สนุก!');
    if(el.helpBody) el.helpBody.textContent = tip;
    if(el.help) el.help.style.display='block';
  });
  on(el.helpClose,'click',function(){ if(el.help) el.help.style.display='none'; });

  // Help (all)
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

  // Stats/Daily (placeholder)
  on(el.statOpen,'click',function(){
    if(el.statBody){
      el.statBody.innerHTML = '<div class="chip">Hi-score: <b>'+ (window.localStorage.getItem('HHA_HISCORE')||'0') +'</b></div>'
        + '<div class="chip">Best Combo: <b>'+ (window.localStorage.getItem('HHA_BESTCOMBO')||'0') +'</b></div>';
    }
    if(el.statPanel) el.statPanel.style.display='block';
  });
  if(el.statPanel){
    var cbtn=document.createElement('button'); cbtn.className='btn'; cbtn.textContent=(State.lang==='en'?'Close':'ปิด');
    cbtn.addEventListener('click', function(){ el.statPanel.style.display='none'; });
    var card = el.statPanel.querySelector('.card'); if(card) card.appendChild(cbtn);
  }
  on(el.dailyOpen,'click',function(){
    if(el.dailyBody) el.dailyBody.innerHTML = '<div class="chip">Play 2 rounds</div><div class="chip">Reach 1500 pts</div>';
    if(el.dailyReward) el.dailyReward.textContent = (State.lang==='en'?'Reward: +50 bonus':'รางวัล: โบนัส +50');
    if(el.dailyPanel) el.dailyPanel.style.display='block';
  });
  var dClose = el.dailyPanel ? el.dailyPanel.querySelector('button[data-action="dailyClose"]') : null;
  if(dClose) on(dClose,'click',function(){ el.dailyPanel.style.display='none'; });

  // Pause on blur
  on(window,'blur',function(){ if(State.running && !State.paused){ pauseGame(); } });
}

// ----- Init -----
(function init(){
  applyLang();
  wireUI();
  resetState();
})();
