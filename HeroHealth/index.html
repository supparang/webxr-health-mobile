// /webxr-health-mobile/HeroHealth/game/main.js
// Hero Health Academy — MAIN (2025-10-31 "BOOT-OK + Fallback GoodJunk")
// - Dynamic import real modes; safe fallback BuiltinGoodJunk
// - UI wiring, HUD, timer, score/combo, fever bar, result modal
// - Pause on blur, autoplay guard, TH/EN toggle, SFX toggle
// - No optional chaining for old webviews

// ----- Boot flag for HTML loader -----
window.__HHA_BOOT_OK = true;

// ----- Utils -----
function $(s){ return document.querySelector(s); }
function $all(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
function on(el,ev,fn){ if(el) el.addEventListener(ev,fn,false); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function now(){ return performance && performance.now ? performance.now() : Date.now(); }

// ----- DOM ensure (auto-create if missing) -----
(function ensureDOM(){
  var hud = $('#hudWrap'); if(!hud){ var h=document.createElement('section'); h.id='hudWrap'; h.className='hud'; h.style.display='none'; document.body.appendChild(h); }
  var gl = $('#gameLayer'); if(!gl){
    var g=document.createElement('section'); g.id='gameLayer';
    g.setAttribute('aria-label','playfield');
    g.style.cssText='position:relative;width:min(980px,96vw);height:60vh;min-height:360px;margin:10px auto;border-radius:16px;border:1px solid #152641;background:radial-gradient(1200px 500px at 50% -40%, #152644 12%, #0c1729 55%, #0b1626);overflow:hidden;';
    document.body.appendChild(g);
  }
  var host = $('#spawnHost'); if(!host){ var s=document.createElement('div'); s.id='spawnHost'; s.style.cssText='position:absolute;inset:0;'; $('#gameLayer').appendChild(s); }
})();

// ----- Paths -----
var BASE = '/webxr-health-mobile/HeroHealth/game/';
var MODES_DIR = BASE + 'modes/';

// ----- State -----
var State = {
  lang: 'th', // 'th' | 'en'
  gfx: 'Normal',
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
  fever: 0, // 0..100
  tickHandle: 0,
  modeAPI: null,
  startAt: 0,
  sfx: {
    good: $('#sfx-good'),
    bad: $('#sfx-bad'),
    perfect: $('#sfx-perfect'),
    tick: $('#sfx-tick'),
    powerup: $('#sfx-powerup'),
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

// ----- UI Refs -----
var el = {
  score: $('#score'), combo: $('#combo'), time: $('#time'),
  t_score: $('#t_score'), t_combo: $('#t_combo'), t_time: $('#t_time'),
  t_mode: $('#t_mode'), t_diff: $('#t_diff'), modeName: $('#modeName'), difficulty: $('#difficulty'),
  feverWrap: $('#feverBarWrap'), feverBar: $('#feverBar'), feverText: $('#fever'),
  questChips: $('#questChips'),
  targetWrap: $('#targetWrap'), targetBadge: $('#targetBadge'),
  plateTracker: $('#plateTracker'), platePills: $('#platePills'),
  hydroWrap: $('#hydroWrap'), hydroLabel: $('#hydroLabel'), hydroBar: $('#hydroBar'),
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
  statOpen: $('#btn_stats'), statCloseBtn: null, dailyPanel: $('#dailyPanel'), dailyBody: $('#dailyBody'), dailyReward: $('#dailyReward'),
  dailyOpen: $('#btn_daily')
};

// ----- Lang apply -----
function applyLang(){
  var L = T[State.lang];
  if(el.t_score) el.t_score.textContent = L.score;
  if(el.t_combo) el.t_combo.textContent = L.combo;
  if(el.t_time)  el.t_time.textContent  = L.time;
  if($('#btn_start'))  $('#btn_start').textContent  = L.start;
  if($('#btn_pause'))  $('#btn_pause').textContent  = L.pause;
  if($('#btn_restart'))$('#btn_restart').textContent= L.restart;
  if($('#t_mode'))     $('#t_mode').textContent     = L.mode;
  if($('#t_diff'))     $('#t_diff').textContent     = L.diff;
  if($('#modeName'))   $('#modeName').textContent   = L.modes[State.modeKey] || State.modeKey;
  if($('#difficulty')) $('#difficulty').textContent = State.difficulty;
}

// ----- SFX -----
function playSFX(name){
  if(!State.sound) return;
  var a = State.sfx[name];
  if(a){ try{ a.currentTime=0; a.play(); }catch(_e){} }
}

// ----- Fever -----
function setFever(v){
  State.fever = clamp(v,0,100);
  if(el.feverBar){ el.feverBar.style.width = State.fever + '%'; }
  if(el.feverText){ el.feverText.style.display = (State.fever>=95?'block':'none'); }
}

// ----- Score/Combo -----
function addScore(amount, isPerfect){
  State.score += amount;
  State.combo += 1;
  State.bestCombo = Math.max(State.bestCombo, State.combo);
  if(isPerfect) setFever(State.fever + 6); else setFever(State.fever + 3);
  if(el.score) el.score.textContent = String(State.score);
  if(el.combo) el.combo.textContent = 'x' + String(State.combo);
}

// ----- Penalty -----
function badHit(){
  playSFX('bad');
  State.combo = 0;
  if(el.combo) el.combo.textContent = 'x0';
  setFever(Math.max(0, State.fever - 12));
  // flash
  var gl = $('#gameLayer');
  if(gl){
    gl.style.transition='background 120ms ease';
    var old = gl.style.background;
    gl.style.background='radial-gradient(1200px 500px at 50% -40%, #411a26 12%, #2a0c16 55%, #200b16)';
    setTimeout(function(){ gl.style.background=old; }, 140);
  }
}

// ----- Timer -----
function setTimeLeft(sec){
  State.timeLeft = Math.max(0, Math.round(sec));
  if(el.time) el.time.textContent = String(State.timeLeft);
}

// ----- Mode loader (with fallback) -----
var registry = {
  goodjunk: null,
  groups: null,
  hydration: null,
  plate: null
};

function tryImport(path){
  return new Promise(function(res,rej){
    import(path).then(function(m){ res(m); }).catch(function(e){ rej(e); });
  });
}

function getMode(key){
  if(registry[key]) return Promise.resolve(registry[key]);
  var url = MODES_DIR + key + '.js?v=live';
  return tryImport(url).then(function(m){ registry[key] = m; return m; }).catch(function(_e){
    // Fallbacks: implement GoodJunk only (playable); others return stubs
    if(key==='goodjunk') { registry[key] = BuiltinGoodJunk(); return registry[key]; }
    registry[key] = StubMode(key);
    return registry[key];
  });
}

// ----- Builtin GoodJunk (DOM spawn) -----
function BuiltinGoodJunk(){
  var GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
  var JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
  var host, alive = false, spawnT=0, rate=700, life=1600, minR=560, maxR=820;

  function rng(a,b){ return Math.floor(a + Math.random()*(b-a+1)); }

  function makeItem(txt, good){
    var d = document.createElement('button');
    d.className='spawn-emoji';
    d.setAttribute('aria-label', good?'good item':'junk item');
    d.textContent = txt;
    d.style.position='absolute';
    var W = host.clientWidth, H = host.clientHeight;
    // Avoid edges
    var x = rng(24, Math.max(24, W-64));
    var y = rng(24, Math.max(24, H-64));
    d.style.left = x+'px'; d.style.top = y+'px';
    d.style.fontSize = '38px';
    d.style.border='0'; d.style.background='transparent'; d.style.filter='drop-shadow(0 3px 6px rgba(0,0,0,.45))';
    d.dataset.good = good ? '1' : '0';
    var lifeMs = rng(life-250, life+250);
    var gone = false;
    var to = setTimeout(function(){
      if(gone) return;
      leave();
    }, lifeMs);

    function leave(){
      gone = true;
      d.style.transition='transform 160ms ease, opacity 160ms ease';
      d.style.transform='scale(.6) translateY(10px)';
      d.style.opacity='0';
      setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 170);
    }

    on(d,'click',function(){
      if(!alive) return;
      clearTimeout(to);
      // Pop effect
      d.style.transition='transform 120ms ease, opacity 120ms ease';
      d.style.transform='scale(1.25)';
      setTimeout(function(){ d.style.opacity='0'; }, 90);
      setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 130);

      if(d.dataset.good==='1'){
        playSFX('good');
        var perfect = Math.random()<0.22;
        addScore(perfect? 200:100, perfect);
      }else{
        badHit();
      }
    });

    host.appendChild(d);
  }

  function tick(dt){
    spawnT += dt;
    if(spawnT >= rate){
      spawnT = 0;
      var good = Math.random() < 0.7;
      if(Math.random()<0.12) { // golden streak
        makeItem('🌟', true);
      }else{
        makeItem(good? GOOD[rng(0,GOOD.length-1)] : JUNK[rng(0,JUNK.length-1)], good);
      }
    }
  }

  function start(cfg){
    host = $('#spawnHost');
    if(!host) return;
    alive = true; spawnT = 0;
    // difficulty params
    var d = (cfg && cfg.difficulty)||'Normal';
    if(d==='Easy'){ rate=820; life=1900; }
    else if(d==='Hard'){ rate=560; life=1400; }
    else { rate=700; life=1600; }

    // show HUD
    $('#hudWrap').style.display='block';
  }
  function pause(){ alive=false; }
  function resume(){ alive=true; }
  function stop(){
    alive=false;
    if(host){
      var nodes = host.querySelectorAll('.spawn-emoji');
      for(var i=0;i<nodes.length;i++){ if(nodes[i] && nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]); }
    }
  }
  return {
    name: 'goodjunk',
    help: function(lang){ return (lang==='en'? T.en.tipsGoodJunk : T.th.tipsGoodJunk); },
    start:start, pause:pause, resume:resume, stop:stop,
    update: function(dt){ if(alive) tick(dt); }
  };
}

// ----- Stubs for other modes (playable later) -----
function StubMode(key){
  var alive=false, shown=false;
  return {
    name: key,
    help: function(lang){ return (lang==='en'?'This mode is coming soon.':'โหมดนี้กำลังพัฒนา'); },
    start: function(){ alive=true; shown=false; $('#hudWrap').style.display='block'; },
    pause: function(){ alive=false; },
    resume: function(){ alive=true; },
    stop: function(){ alive=false; },
    update: function(){ if(alive && !shown){ shown=true; var c=$('#coachText'); if(c) c.textContent='(Demo) Mode "'+key+'" is a stub.'; }
    }
  };
}

// ----- Game lifecycle -----
function resetState(){
  State.running=false; State.paused=false;
  State.score=0; State.combo=0; State.bestCombo=0; setFever(0);
  setTimeLeft( (State.difficulty==='Easy')? 70 : (State.difficulty==='Hard'? 55 : 60) );
  if(el.score) el.score.textContent='0';
  if(el.combo) el.combo.textContent='x0';
  if(el.coach) el.coach.style.display='flex';
  if(el.coachText) el.coachText.textContent = (State.lang==='en'?'Ready? Let’s go!':'พร้อมไหม? สู้ๆ!');
  if(el.result) el.result.style.display='none';
}

function startGame(){
  if(State.running) return;
  resetState();
  getMode(State.modeKey).then(function(api){
    State.modeAPI = api;
    if(typeof api.start==='function') api.start({difficulty:State.difficulty});
    State.running=true; State.paused=false; State.startAt = now();
    loopHandle();
  }).catch(function(){
    // last-resort
    State.modeAPI = BuiltinGoodJunk();
    State.modeAPI.start({difficulty:State.difficulty});
    State.running=true; State.paused=false; State.startAt = now();
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
}

function stopGame(showResult){
  if(State.modeAPI && State.modeAPI.stop) State.modeAPI.stop();
  State.running=false; State.paused=false;
  if(showResult) openResult();
}

function openResult(){
  var L = T[State.lang];
  if(el.resText) el.resText.textContent = L.finished + ' ' + State.score + ' pts, ' + State.bestCombo + ' combo.';
  // stars by score
  var stars = (State.score>=6000)?5 : (State.score>=4200)?4 : (State.score>=2600)?3 : (State.score>=1400)?2 : (State.score>0)?1:0;
  if(el.resCore){
    el.resCore.innerHTML = '';
    var s = document.createElement('div');
    s.style.fontSize='22px'; s.style.fontWeight='800'; s.style.margin='4px 0 8px';
    s.textContent = '★'.repeat(stars) + ' ('+stars+')';
    el.resCore.appendChild(s);
  }
  if(el.result) el.result.style.display='block';
}

// ----- Main loop -----
var _raf=0, _prev=0;
function loopHandle(t){
  if(!State.running){ cancelAnimationFrame(_raf); return; }
  _raf = requestAnimationFrame(loopHandle);
  var ts = (typeof t==='number'? t : performance.now());
  if(!_prev) _prev = ts;
  var dt = ts - _prev; _prev = ts;

  if(State.paused) return;

  // countdown
  var newLeft = State.timeLeft - (dt/1000);
  if(Math.floor(newLeft) !== Math.floor(State.timeLeft) && State.timeLeft>0){
    playSFX('tick');
  }
  setTimeLeft(newLeft);
  if(State.timeLeft<=0){
    setTimeLeft(0);
    stopGame(true);
    return;
  }

  // mode update
  if(State.modeAPI && State.modeAPI.update) State.modeAPI.update(dt);
}

// ----- Event bindings -----
function wireUI(){
  // Lang toggle
  on(el.langToggle,'click',function(){
    State.lang = (State.lang==='th'?'en':'th'); applyLang();
    var b = el.langToggle; if(b){ b.textContent = (State.lang==='en'?'🇹🇭 TH/EN':'🇹🇭 TH/EN'); }
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

  // Diff
  function setDiff(d){
    State.difficulty = d;
    if(el.difficulty) el.difficulty.textContent = d;
  }
  on(el.dEasy,'click',function(){ setDiff('Easy'); });
  on(el.dNormal,'click',function(){ setDiff('Normal'); });
  on(el.dHard,'click',function(){ setDiff('Hard'); });

  // Mode selection
  function setMode(key){
    State.modeKey = key;
    if(el.modeName) el.modeName.textContent = T[State.lang].modes[key] || key;
  }
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
    var L = T[State.lang];
    if(el.helpBody){
      var tip = (State.modeAPI && State.modeAPI.help)? State.modeAPI.help(State.lang) : (State.lang==='en'?'Have fun!':'ขอให้สนุก!');
      el.helpBody.textContent = tip;
    }
    if(el.help) el.help.style.display='block';
  });
  on(el.helpClose,'click',function(){ if(el.help) el.help.style.display='none'; });

  // Help (scene)
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

  // Result buttons
  var btnReplay = $('#btn_replay'), btnHome = $('#btn_home');
  on(btnReplay,'click',function(){ if(el.result) el.result.style.display='none'; startGame(); });
  on(btnHome,'click',function(){ if(el.result) el.result.style.display='none'; stopGame(false); resetState(); });

  // Stats/Daily (placeholder)
  on(el.statOpen,'click',function(){
    if(el.statBody){ el.statBody.innerHTML = '<div class="chip">Hi-score: <b>'+ (window.localStorage.getItem('HHA_HISCORE')||'0') +'</b></div>'
      + '<div class="chip">Best Combo: <b>'+ (window.localStorage.getItem('HHA_BESTCOMBO')||'0') +'</b></div>'; }
    if(el.statPanel) el.statPanel.style.display='block';
  });
  // Add a close button dynamically if missing
  if(el.statPanel){
    var cbtn = document.createElement('button'); cbtn.className='btn'; cbtn.textContent=(State.lang==='en'?'Close':'ปิด');
    cbtn.addEventListener('click', function(){ el.statPanel.style.display='none'; });
    el.statPanel.querySelector('.card').appendChild(cbtn);
  }
  on(el.dailyOpen,'click',function(){
    if(el.dailyBody) el.dailyBody.innerHTML = '<div class="chip">Play 2 rounds</div><div class="chip">Reach 1500 pts</div>';
    if(el.dailyReward) el.dailyReward.textContent = (State.lang==='en'?'Reward: +50 bonus':'รางวัล: โบนัส +50');
    if(el.dailyPanel) el.dailyPanel.style.display='block';
  });
  var dClose = el.dailyPanel ? el.dailyPanel.querySelector('button[data-action="dailyClose"]') : null;
  on(dClose,'click',function(){ if(el.dailyPanel) el.dailyPanel.style.display='none'; });

  // Pause on blur
  on(window,'blur',function(){ if(State.running && !State.paused){ pauseGame(); } });

  // Save hi-score on result open
  var mo = new MutationObserver(function(){
    if(el.result && el.result.style.display==='block'){
      var hs = parseInt(window.localStorage.getItem('HHA_HISCORE')||'0',10);
      var bc = parseInt(window.localStorage.getItem('HHA_BESTCOMBO')||'0',10);
      if(State.score > hs) window.localStorage.setItem('HHA_HISCORE', String(State.score));
      if(State.bestCombo > bc) window.localStorage.setItem('HHA_BESTCOMBO', String(State.bestCombo));
    }
  });
  if(el.result) mo.observe(el.result, { attributes:true, attributeFilter:['style']});
}

// ----- Init -----
(function init(){
  applyLang();
  wireUI();
  resetState();
})();
