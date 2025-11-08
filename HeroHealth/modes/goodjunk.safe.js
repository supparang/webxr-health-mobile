// === Good vs Junk — SAFE DOM Overlay + FEVER + Watchdog (2025-11-08) ===
// จุดเด่น
// - ไม่พึ่ง THREE/A-Frame สำหรับ hit/click -> ใช้ DOM overlay (.hha-layer) คลิกได้ชัวร์
// - สปอว์นเป้าทันที + watchdog ถ้า 1.5s ไม่มีเป้า -> สปอว์นกลางจออัตโนมัติ
// - FEVER: คอมโบถึงเกณฑ์ -> x2 คะแนน, ยิงอีเวนต์ hha:fever start/end
// - แจ้ง HUD: hha:time / hha:score / hha:miss / hha:quest / hha:end
// - ไม่มี optional chaining, ใส่ try/catch ป้องกันล่ม
// - รองรับ config: {host, duration, difficulty}

var __gj_running = false;
var __gj_layer = null;
var __gj_dbg = null;

export async function boot(cfg){
  cfg = cfg || {};
  var duration = +cfg.duration || 60;
  var diff     = String(cfg.difficulty || 'normal');

  // ---- Pools (20 รายการ/ฝั่ง) ----
  var GOOD = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
  var JUNK = ['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

  // ---- State ----
  var running = true;
  __gj_running = true;
  var score=0, combo=0, maxCombo=0, misses=0;
  var remain = Math.max(1, Math.round(duration));

  // FEVER
  var FEVER_COMBO_NEED = 10;
  var FEVER_MS = 10000;
  var FEVER_ACTIVE = false;
  var feverTO = null;

  // diff tuning
  var spawnMin=520, spawnMax=700, life=1600, goodRate=0.70;
  if(diff==='easy'){  spawnMin=650; spawnMax=820; life=1900; goodRate=0.78; }
  if(diff==='hard'){  spawnMin=420; spawnMax=560; life=1400; goodRate=0.62; }

  // ---- Helpers ----
  function $(s){ return document.querySelector(s); }
  function vw(){ return Math.max(320, window.innerWidth||320); }
  function vh(){ return Math.max(320, window.innerHeight||320); }
  function pick(a){ return a[(Math.random()*a.length)|0]; }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(e){} }

  // ---- Styles (one-time) ----
  if(!document.getElementById('hha-style')){
    var st=document.createElement('style'); st.id='hha-style';
    st.textContent =
      '.hha-layer{position:fixed;inset:0;z-index:650;pointer-events:none;}'+
      '.hha-tgt{position:absolute;pointer-events:auto;transform:translate(-50%,-50%);'+
      'font-size:64px;line-height:1;filter:drop-shadow(0 10px 16px rgba(0,0,0,.55));'+
      'transition:transform .12s ease, opacity .24s ease;opacity:1;user-select:none;touch-action:none;}'+
      '.hha-tgt.hit{transform:translate(-50%,-50%) scale(.85);opacity:.15;}'+
      '.hha-pop{position:absolute;pointer-events:none;transform:translate(-50%,-50%);'+
      'font:bold 18px system-ui,Segoe UI,Roboto,Thonburi,sans-serif;color:#fff;'+
      'text-shadow:0 2px 12px rgba(0,0,0,.6);opacity:1;transition:transform .5s ease, opacity .5s linear;}'+
      '.hha-dbg{position:fixed;left:50%;top:56px;transform:translateX(-50%);z-index:660;'+
      'background:#0f172acc;color:#fff;padding:6px 10px;border:1px solid #475569;border-radius:10px;font:700 12px system-ui;}';
    document.head.appendChild(st);
  }

  // ---- Clean old layer ----
  var olds = document.querySelectorAll('.hha-layer');
  for(var i=0;i<olds.length;i++){ try{ olds[i].parentNode.removeChild(olds[i]); }catch(_e){} }

  // ---- Create layer ----
  __gj_layer = document.createElement('div');
  __gj_layer.className = 'hha-layer';
  document.body.appendChild(__gj_layer);

  // ---- HUD init ----
  fire('hha:score',{score:0, combo:0});
  fire('hha:quest',{text:'Mini Quest — เก็บของดีติดกัน '+FEVER_COMBO_NEED+' ชิ้น เพื่อเปิด FEVER!'});
  fire('hha:fever',{state:'end'});
  fire('hha:time',{sec:remain});

  // ---- FEVER ----
  function feverStart(){
    if(FEVER_ACTIVE) return;
    FEVER_ACTIVE = true;
    fire('hha:fever',{state:'start', ms:FEVER_MS});
    if(feverTO) clearTimeout(feverTO);
    feverTO = setTimeout(function(){ feverEnd(); }, FEVER_MS);
  }
  function feverEnd(){
    if(!FEVER_ACTIVE) return;
    FEVER_ACTIVE = false;
    fire('hha:fever',{state:'end'});
    if(feverTO){ clearTimeout(feverTO); feverTO=null; }
  }

  // ---- Popup text ----
  function popupText(txt, x, y, color){
    var t = document.createElement('div');
    t.className='hha-pop';
    t.textContent = txt;
    t.style.left = x+'px';
    t.style.top  = y+'px';
    if(color) t.style.color = color;
    __gj_layer.appendChild(t);
    // animate
    setTimeout(function(){
      try{
        t.style.transform = 'translate(-50%,-50%) translateY(-24px)';
        t.style.opacity = '0';
      }catch(_e){}
    }, 10);
    setTimeout(function(){ try{ __gj_layer.removeChild(t); }catch(_e){} }, 540);
  }

  // ---- Spawn targets ----
  var spawnTO = null;
  var watchdog = null;

  function randPos(){
    var x = Math.floor(vw()*0.12 + Math.random()*vw()*0.76);
    var y = Math.floor(vh()*0.60 + Math.random()*vh()*0.28); // “ล่าง-กลางจอ”
    return {x:x,y:y};
  }

  function ensureInside(el){
    try{
      var r = el.getBoundingClientRect();
      if(r.left<0 || r.top<0 || r.right>vw() || r.bottom>vh()){
        el.style.left = (vw()/2)+'px';
        el.style.top  = (vh()/2)+'px';
      }
    }catch(_e){}
  }

  function planNext(){
    if(!running) return;
    var wait = Math.floor(spawnMin + Math.random()*(spawnMax-spawnMin));
    // Fever -> เร็วขึ้น
    if(FEVER_ACTIVE) wait = Math.max(280, Math.round(wait*0.85));
    spawnTO = setTimeout(spawnOne, wait);
  }

  function onMiss(){
    combo = 0; misses += 1;
    fire('hha:miss',{count:misses});
    fire('hha:score',{score:score, combo:combo});
  }

  function spawnOne(center){
    if(!running) return;

    var isGood = Math.random() < goodRate;
    var ch = isGood ? pick(GOOD) : pick(JUNK);

    var el = document.createElement('div');
    el.className = 'hha-tgt';
    el.textContent = ch;

    var p = center ? {x:vw()/2, y:vh()/2} : randPos();
    el.style.left = p.x+'px';
    el.style.top  = p.y+'px';

    // size by diff
    var fs = 64; if(diff==='easy') fs=74; if(diff==='hard') fs=56;
    el.style.fontSize = fs+'px';

    var clicked=false;

    function hit(ev){
      if(clicked || !running) return;
      clicked = true;
      try{ ev.preventDefault(); }catch(_e){}
      try{ __gj_layer.removeChild(el); }catch(_e){}

      if(isGood){
        var base = 20 + combo*2;
        var plus = FEVER_ACTIVE ? base*2 : base;
        score += plus;
        combo += 1;
        if(combo>maxCombo) maxCombo = combo;
        if(!FEVER_ACTIVE && combo>=FEVER_COMBO_NEED) feverStart();
        popupText('+'+plus, p.x, p.y, '#ffffff');
      }else{
        combo = 0; misses += 1;
        score = Math.max(0, score - 15);
        popupText('-15', p.x, p.y, '#ffb4b4');
        fire('hha:miss',{count:misses});
      }
      fire('hha:score',{score:score, combo:combo});
      planNext();
    }

    el.addEventListener('click', hit, {passive:false});
    el.addEventListener('touchstart', hit, {passive:false});

    // TTL -> miss if not clicked
    var ttl = life;
    if(diff==='easy') ttl = life+200;
    if(diff==='hard') ttl = life-150;
    if(FEVER_ACTIVE) ttl = Math.max(900, Math.round(ttl*0.9));

    setTimeout(function(){
      if(!running) return;
      if(!el.parentNode) return; // already hit
      try{ __gj_layer.removeChild(el); }catch(_e){}
      onMiss();
      planNext();
    }, ttl);

    __gj_layer.appendChild(el);
    ensureInside(el);
  }

  // ---- Watchdog: ถ้า 1.5s ไม่มีเป้า -> spawn กลางจอ ----
  function startWatchdog(){
    if(watchdog) clearInterval(watchdog);
    watchdog = setInterval(function(){
      if(!running) return;
      var leftOvers = __gj_layer.querySelectorAll('.hha-tgt');
      if(leftOvers.length===0){
        spawnOne(true);
      }
    }, 1500);
  }

  // ---- Time loop ----
  var timeIV = setInterval(function(){
    if(!running) return;
    remain = Math.max(0, remain-1);
    fire('hha:time',{sec:remain});
    if(remain<=0){
      end('timeout');
    }
  }, 1000);

  // ---- Start! ----
  spawnOne(true);      // ลูกแรกกลางจอเพื่อ “เห็นแน่”
  planNext();          // แล้วค่อยต่อด้วยรอบ ๆ
  startWatchdog();     // กันไม่มีของ

  // ---- End/pause/resume API ----
  function end(reason){
    if(!running) return;
    running = false;
    __gj_running = false;
    try{ clearTimeout(spawnTO); }catch(_e){}
    try{ clearInterval(timeIV); }catch(_e){}
    try{ clearInterval(watchdog); }catch(_e){}
    try{ feverEnd(); }catch(_e){}

    // ล้างเป้าทั้งหมด
    try{
      var nodes = __gj_layer.querySelectorAll('.hha-tgt,.hha-pop');
      for(var i=0;i<nodes.length;i++){ try{ __gj_layer.removeChild(nodes[i]); }catch(_e){} }
    }catch(_e){}
    // ถอดเลเยอร์
    try{ document.body.removeChild(__gj_layer); }catch(_e){}

    fire('hha:end', { reason:reason||'stop', score:score, combo:maxCombo, misses:misses, duration:duration });
  }

  function pause(){
    if(!running) return;
    running = false;
    try{ clearTimeout(spawnTO); }catch(_e){}
  }
  function resume(){
    if(running) return;
    running = true;
    planNext();
  }

  // คืน API
  return { stop:end, pause:pause, resume:resume };
}

export default { boot };
