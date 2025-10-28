// === Hero Health Academy — game/main.js (Click-fixed • PC/Mobile/VR) ===
window.__HHA_BOOT_OK = true;

// ----- Imports -----
import { Quests }   from '/webxr-health-mobile/HeroHealth/game/core/quests.js';
import { Progress } from '/webxr-health-mobile/HeroHealth/game/core/progression.js';
import * as goodjunk  from '/webxr-health-mobile/HeroHealth/game/modes/goodjunk.js';
import * as groups    from '/webxr-health-mobile/HeroHealth/game/modes/groups.js';
import * as hydration from '/webxr-health-mobile/HeroHealth/game/modes/hydration.js';
import * as plate     from '/webxr-health-mobile/HeroHealth/game/modes/plate.js';

// ----- Helpers -----
function $(s){ return document.querySelector(s); }
function $all(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function rndInt(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function setText(sel, txt){ var el=$(sel); if(el) el.textContent = txt; }
function show(el){ if(el) el.style.display='block'; }
function hide(el){ if(el) el.style.display='none'; }
function toast(msg, ms){
  var t=$('#toast'); if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t=setTimeout(function(){ t.classList.remove('show'); }, ms||1200);
}

var MODES = { goodjunk:goodjunk, groups:groups, hydration:hydration, plate:plate };

// ----- State -----
var STATE = {
  lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(),
  mode: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  timeSec: 45,
  timerId: null,
  score: 0,
  combo: 0,
  bestCombo: 0,
  freezeUntil: 0,
  ctx: {}
};

// ----- SFX (ผูกกับ <audio id="sfx-..."> ใน index.html) -----
var SFX = {
  play: function(id){
    try{
      var el = document.getElementById(id);
      if (el && typeof el.play==='function'){ el.currentTime=0; el.play(); }
    }catch(_e){}
  }
};

// ====== LAYER & CLICKABILITY FIXES ======
function ensurePlayLayer(){
  var wrap = document.querySelector('.game-wrap');
  if(!wrap){
    wrap = document.createElement('main');
    wrap.className='game-wrap';
    document.body.appendChild(wrap);
  }
  var layer = document.getElementById('gameLayer');
  if(!layer){
    layer = document.createElement('div');
    layer.id='gameLayer';
    layer.setAttribute('tabindex','0');
    layer.style.position='relative';
    layer.style.width='100%';
    layer.style.height='calc(100vh - 180px)';
    layer.style.margin='0 auto';
    layer.style.maxWidth='960px';
    layer.style.overflow='hidden';
    wrap.appendChild(layer);
  }
  var host = document.getElementById('spawnHost');
  if(!host){
    host = document.createElement('div');
    host.id='spawnHost';
    host.style.position='absolute';
    host.style.left='0';
    host.style.top='0';
    host.style.width='100%';
    host.style.height='100%';
    host.style.pointerEvents='auto'; // สำคัญ: ต้องเป็น auto
    layer.appendChild(host);
  }
}
function applyClickabilityFixes(){
  var canv = document.getElementById('c');
  if (canv){ canv.style.pointerEvents='none'; canv.style.zIndex='0'; }

  var hud = document.querySelector('.hud');
  if (hud){ hud.style.pointerEvents='none'; hud.style.zIndex='20'; }

  var menu = document.getElementById('menuBar');
  if (menu){
    menu.style.pointerEvents='auto';
    menu.style.zIndex='30';
    var btns = menu.querySelectorAll('.btn,.tag');
    for (var i=0;i<btns.length;i++){ btns[i].style.pointerEvents='auto'; }
  }

  var layer = document.getElementById('gameLayer');
  if (layer){ layer.style.pointerEvents='auto'; layer.style.zIndex='28'; }

  var host  = document.getElementById('spawnHost');
  if (host){
    host.style.pointerEvents='auto'; // เดิมเป็น none ทำให้ลูกกดไม่ได้
    host.style.zIndex='28';
  }

  var spawns = document.querySelectorAll('.spawn-emoji');
  for (var j=0;j<spawns.length;j++){
    spawns[j].style.pointerEvents='auto';
    spawns[j].style.zIndex='29';
  }
}
ensurePlayLayer();
applyClickabilityFixes();

// ====== HUD ======
var HUD = (function(){
  function setClock(sec){ setText('#time', String(sec|0)); }
  function setScore(n){ setText('#score', String(n|0)); }
  function setCombo(x){ setText('#combo', 'x'+String(x|0)); }
  function setQuestChips(list){
    var host=$('#questChips'); if(!host) return;
    host.innerHTML = (list||[]).map(function(q){
      var prog = q.need>0 ? (clamp((q.progress/q.need)*100, 0, 100)|0) : 0;
      return '<span class="chip" title="'+(q.label||q.key)+'">'+
             '<b>'+(q.icon||'⭐')+' '+(q.progress||0)+'/'+(q.need||0)+'</b>'+
             '<i style="display:block;height:4px;background:'+(q.done?'#66bb6a':'#29b6f6')+';width:'+prog+'%;border-radius:4px"></i>'+
             '</span>';
    }).join('');
  }
  function setTarget(key, have, need){
    var badge=$('#targetBadge'); if(!badge) return;
    var nameTH = {veggies:'ผัก', protein:'โปรตีน', grains:'ธัญพืช', fruit:'ผลไม้', dairy:'นม'}[key] || key || '—';
    badge.textContent = nameTH+' • '+(have|0)+'/'+(need|0);
  }
  function coachSay(text, ms){
    var el=$('#coachText'); var box=$('#coachHUD');
    if (el) el.textContent=text;
    if (box){
      box.style.pointerEvents='none';
      box.style.display='flex';
      clearTimeout(box._t);
      box._t=setTimeout(function(){ box.style.display='none'; }, ms||1500);
    }
  }
  return { setClock:setClock, setScore:setScore, setCombo:setCombo, setQuestChips:setQuestChips, setTarget:setTarget, coachSay:coachSay };
})();
Quests.bindToMain({ hud: { setQuestChips: HUD.setQuestChips }});

// ====== UI EVENTS (ให้ตรง index.html) ======
document.addEventListener('click', function(ev){
  var btn = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
  if(!btn) return;
  var act = btn.getAttribute('data-action') || '';

  switch(act){
    case 'lang': {
      var lang = btn.getAttribute('data-lang')||'TH';
      STATE.lang = lang.toUpperCase();
      localStorage.setItem('hha_lang', STATE.lang);
      toast(STATE.lang==='TH'?'ภาษาไทย':'English', 800);
      break;
    }
    case 'mode': {
      var m = btn.getAttribute('data-mode') || 'goodjunk';
      if (MODES[m]){
        STATE.mode = m;
        setText('#modeName', btn.textContent.replace(/\s+/g,' ').trim());
        HUD.coachSay('Mode: '+STATE.mode, 900);
      }
      break;
    }
    case 'difficulty': {
      var d = btn.getAttribute('data-diff')||'Normal';
      STATE.difficulty = d;
      var all = $all('#menuBar [data-action="difficulty"]');
      for (var i=0;i<all.length;i++) all[i].classList.toggle('active', all[i]===btn);
      setText('#difficulty', ({Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'})[d]||d);
      HUD.coachSay('Difficulty: '+d, 900);
      break;
    }
    case 'howto': {
      toast(STATE.lang==='TH'
        ? 'แตะ/คลิกสิ่งที่ใช่ สะสมคอมโบ หลบสิ่งผิดหมวด!'
        : 'Tap/click correct items, build combo, avoid wrong ones!', 1600);
      break;
    }
    case 'export': doExport(); break;
    case 'import': doImport(); break;
    case 'reset':  localStorage.removeItem('hha_save'); toast('Progress cleared.', 900); break;
    case 'start':  startRun(); break;
    case 'restart': hideResult(); startRun(); break;
    case 'back':   backToMenu(); break;

    case 'help': { show($('#help')); break; }
    case 'helpClose': { hide($('#help')); break; }

    // (ปุ่ม helpScene/stat/daily ปิดไว้ก่อนใน index)
    default: break;
  }
});

// ====== RUN LOOP ======
var _spawnTimer = null;

function startRun(){
  var menu = $('#menuBar'); if (menu) menu.style.display='none';
  var res  = $('#resultModal'); if (res) res.style.display='none';

  // Reset
  STATE.running = true;
  STATE.timeSec = 45;
  STATE.score   = 0;
  STATE.combo   = 0;
  STATE.bestCombo = 0;
  STATE.ctx = {};

  HUD.setClock(STATE.timeSec);
  HUD.setScore(STATE.score);
  HUD.setCombo(STATE.combo);
  HUD.setQuestChips([]);

  // Init mode
  var mode = MODES[STATE.mode] || MODES.goodjunk;
  try { if (mode.init) mode.init(STATE, { setTarget: HUD.setTarget }, diffOf(STATE.difficulty)); } catch(e){ console.error(e); }

  // Quests
  Quests.beginRun(STATE.mode, STATE.difficulty, STATE.lang, STATE.timeSec);

  // Coach
  HUD.coachSay(STATE.lang==='TH'?'เริ่มกันเลย!':'Let’s go!', 1200);

  // Timer
  if (STATE.timerId) clearInterval(STATE.timerId);
  STATE.timerId = setInterval(onTick, 1000);

  // Spawner
  if (_spawnTimer) clearInterval(_spawnTimer);
  _spawnTimer = setInterval(spawnOne, 700);

  applyClickabilityFixes();
  var gl = $('#gameLayer'); if (gl && typeof gl.focus==='function') gl.focus();
}

function onTick(){
  if (!STATE.running) return;

  var now = Date.now();
  if (STATE.freezeUntil && now < STATE.freezeUntil){
    HUD.setClock(STATE.timeSec);
    Quests.tick({ score: (STATE.score|0) });
    return;
  }

  STATE.timeSec = Math.max(0, STATE.timeSec-1);
  HUD.setClock(STATE.timeSec);
  Quests.tick({ score: (STATE.score|0) });

  var m = MODES[STATE.mode];
  try { if (m && typeof m.tick==='function') m.tick(STATE, { sfx:SFX }, { setTarget: HUD.setTarget }); } catch(_e){}

  if (STATE.timeSec<=0) endRun(true);
}

function endRun(showResult){
  STATE.running = false;
  if (STATE.timerId){ clearInterval(STATE.timerId); STATE.timerId=null; }
  if (_spawnTimer){  clearInterval(_spawnTimer);  _spawnTimer=null; }

  var m = MODES[STATE.mode];
  try { if (m && typeof m.cleanup==='function') m.cleanup(STATE, { setTarget: HUD.setTarget }); } catch(_e){}

  var summary = {
    score: (STATE.score|0),
    bestCombo: (STATE.bestCombo|0),
    time: 45,
    mode: STATE.mode,
    difficulty: STATE.difficulty
  };
  var quests = [];
  try{ quests = Quests.endRun(summary)||[]; }catch(_e){}

  if (showResult){
    var core = $('#resultBody');
    if (core){
      var list = quests.map(function(q){
        return '<li>'+(q.label||q.id)+' — '+(q.done?'✅ Completed':'❌')+'</li>';
      }).join('');
      core.innerHTML =
        '<div>Score: <b>'+summary.score+'</b></div>'+
        '<div>Best Combo: <b>'+summary.bestCombo+'</b></div>'+
        '<div>Mode: <b>'+summary.mode+'</b> • Diff: <b>'+summary.difficulty+'</b></div>'+
        '<div style="margin-top:6px"><b>Quests</b></div>'+
        '<ul style="margin:.25rem 0 0 1rem">'+list+'</ul>';
    }
    show($('#resultModal'));
  }

  try { if (Progress && typeof Progress.save==='function') Progress.save(summary); } catch(_e){}
}

function hideResult(){ hide($('#resultModal')); }

// ====== Difficulty ======
function diffOf(key){
  if (key==='Easy') return { life: 3500 };
  if (key==='Hard') return { life: 2300 };
  return { life: 3000 };
}

// ====== Spawner ======
function spawnOne(){
  if (!STATE.running) return;
  var now = Date.now();
  if (STATE.freezeUntil && now < STATE.freezeUntil) return;

  var host = $('#spawnHost');
  var layer= $('#gameLayer');
  if (!host || !layer) return;

  // meta จากโหมด
  var mode = MODES[STATE.mode] || MODES.goodjunk;
  var meta = {};
  try { if (mode.pickMeta) meta = mode.pickMeta(diffOf(STATE.difficulty), STATE) || {}; } catch(_e){ meta = {}; }

  // สร้างปุ่มเป้า
  var el = document.createElement('button');
  el.type = 'button';
  el.className = 'spawn-emoji';
  el.setAttribute('aria-label', meta.aria || meta.label || 'item');
  el.textContent = meta.char || '🍏';

  // ตำแหน่งแบบปลอด HUD
  var pad = 18;
  var box = layer.getBoundingClientRect();
  var x = rndInt(pad, Math.max(pad, box.width  - pad*2));
  var y = rndInt(pad+24, Math.max(pad+24, box.height - pad*2 - 24));
  el.style.position='absolute';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.fontSize = 'clamp(24px, 5.5vmin, 42px)';
  el.style.lineHeight='1';
  el.style.border='none';
  el.style.background='transparent';
  el.style.cursor='pointer';
  el.style.userSelect='none';
  el.style.webkitTapHighlightColor='transparent';
  el.style.pointerEvents='auto';
  el.style.zIndex='29';

  // อายุ
  var life = clamp(Number(meta.life)>0?Number(meta.life):3000, 600, 5000);
  var tdie = setTimeout(function(){ try{ el.remove(); }catch(_e){} }, life);

  // FX on spawn
  try { if (mode.fx && typeof mode.fx.onSpawn==='function') mode.fx.onSpawn(el, STATE); } catch(_e){}

  // คลิกให้ชัวร์ (pointerdown + click)
  var onHit = function(ev){
    ev.stopPropagation();
    clearTimeout(tdie);
    handleHit(meta, el);
  };
  el.addEventListener('pointerdown', onHit, { passive:true });
  el.addEventListener('click', onHit, false);
  el.addEventListener('dragstart', function(ev){ ev.preventDefault(); });

  host.appendChild(el);
  applyClickabilityFixes(); // กันโดน style อื่นทับ
}

// ====== Hit handling ======
function handleHit(meta, el){
  // ให้โหมดตัดสินผล
  var result = 'ok';
  try{
    var m = MODES[STATE.mode];
    if (m && typeof m.onHit==='function'){
      result = m.onHit(meta, { score:{ add: addScore }, sfx:SFX }, STATE, { setTarget: HUD.setTarget }) || 'ok';
    }
  }catch(_e){}

  // FX on hit
  try{
    var mm = MODES[STATE.mode];
    if (mm && mm.fx && typeof mm.fx.onHit==='function'){
      var off = el.getBoundingClientRect();
      mm.fx.onHit(off.left + off.width/2, off.top + off.height/2, meta, STATE);
    }
  }catch(_e){}

  // คอมโบ/คะแนน
  if (result==='good' || result==='perfect'){
    STATE.combo = Math.min(999, STATE.combo+1);
    if (STATE.combo > STATE.bestCombo) STATE.bestCombo = STATE.combo;
    var base = (result==='perfect'? 20 : 10);
    var bonus = Math.floor(STATE.combo/10);
    addScore(base + bonus);
  } else if (result==='bad') {
    STATE.combo = 0;
  }
  HUD.setCombo(STATE.combo);

  // Quests
  try{ Quests.event('hit', { result:result, meta:meta, comboNow: STATE.combo, _ctx:{ score: (STATE.score|0) } }); }catch(_e){}

  // ลบชิ้น
  try{ el.remove(); }catch(_e){}
}

function addScore(n){
  STATE.score = Math.max(0, (STATE.score|0) + (n|0));
  HUD.setScore(STATE.score);
}

// ====== Menu default label ======
(function initLabels(){
  var mbtn = $('#m_goodjunk');
  setText('#modeName', mbtn ? mbtn.textContent.replace(/\s+/g,' ').trim() : 'ดี vs ขยะ');
  setText('#difficulty', 'ปกติ');
})();

// ====== Accessibility & Resume Menu ======
function backToMenu(){
  hide($('#resultModal'));
  var menu = $('#menuBar'); if (menu) menu.style.display='';
  document.body.classList.add('ui-mode-menu');
}

// ====== Expose for debug ======
window.HHA = { STATE:STATE, startRun:startRun, endRun:endRun, backToMenu:backToMenu };
