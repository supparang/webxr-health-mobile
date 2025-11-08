// === Good vs Junk — SAFE DOM Layer + Fever + MiniQuest (no optional chaining) ===
var running=false, layer=null, score=0, combo=0, maxCombo=0, misses=0;
var spawnTimer=null, timeTimer=null, watchdog=null;

// Pools (20/11)
var GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
var JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭','🍰','🍬'];

// Fever
var FEVER_ACTIVE=false, FEVER_MS=10000, FEVER_NEED_COMBO=10, feverTimer=null;
function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(e){} }
function feverStart(){
  if(FEVER_ACTIVE) return;
  FEVER_ACTIVE = true;
  emit('hha:fever',{state:'start', ms:FEVER_MS});
  clearTimeout(feverTimer);
  feverTimer = setTimeout(function(){ feverEnd(); }, FEVER_MS);
}
function feverEnd(){
  if(!FEVER_ACTIVE) return;
  FEVER_ACTIVE = false;
  emit('hha:fever',{state:'end'});
  clearTimeout(feverTimer); feverTimer=null;
}

// MiniQuest (10 แบบ สุ่ม 3 แบบ/รอบ แสดงทีละอัน)
var MQ_POOL = [
  { id:'G10',  label:'เก็บของดี 10 ชิ้น', type:'countGood', target:10 },
  { id:'G20',  label:'เก็บของดี 20 ชิ้น', type:'countGood', target:20 },
  { id:'C5',   label:'ทำคอมโบ x5',        type:'combo',     target:5 },
  { id:'C10',  label:'ทำคอมโบ x10',       type:'combo',     target:10 },
  { id:'F1',   label:'เปิดโหมด Fever 1 ครั้ง', type:'fever', target:1 },
  { id:'ST8',  label:'ทำสตรีคติดกัน 8 ชิ้น',  type:'streak',target:8 },
  { id:'S300', label:'ทำคะแนนถึง 300',        type:'score',  target:300 },
  { id:'NJ15', label:'ไม่พลาด 15 วินาที',     type:'nojunk', target:15 },
  { id:'B5',   label:'ดี 5 ชิ้นใน 10 วิ',     type:'burst10',target:5 },
  { id:'GOAL', label:'ทำภารกิจหลักรอบนี้',    type:'goal',   target:1 }
];
var mqList=[], mqIndex=0, mqState=null, mqBurstTimes=[];
function mqPick3(){
  var pool = MQ_POOL.slice();
  var picks=[];
  while(picks.length<3 && pool.length){
    var i=(Math.random()*pool.length)|0;
    picks.push(pool.splice(i,1)[0]);
  }
  return picks;
}
function mqReset(){
  mqList = mqPick3();
  mqIndex=0;
  mqState = { good:0, score:0, combo:0, streak:0, fever:0, noMissSec:0 };
  mqBurstTimes.length=0;
  emit('hha:quest',{text:'Mini Quest — '+mqList[mqIndex].label});
}
function mqTickSecond(){
  if(!mqList.length) return;
  var q = mqList[mqIndex];
  if(q.type==='nojunk') { mqState.noMissSec = Math.min(q.target, mqState.noMissSec+1); }
  // อัปเดตข้อความสถานะสั้นๆ
  var prog = '';
  if(q.type==='countGood') prog = ' ('+mqState.good+'/'+q.target+')';
  if(q.type==='combo')     prog = ' (x'+mqState.combo+'/'+q.target+')';
  if(q.type==='score')     prog = ' ('+mqState.score+'/'+q.target+')';
  if(q.type==='nojunk')    prog = ' ('+mqState.noMissSec+'/'+q.target+' วิ)';
  emit('hha:quest',{text:'Mini Quest — '+q.label+prog});
  // เช็คผ่าน
  mqCheckDone();
}
function mqOnGood(tNow){
  mqState.good++;
  mqBurstTimes.push(tNow);
  // เก็บเฉพาะในช่วง 10 วิ
  var cutoff=tNow-10000;
  mqBurstTimes = mqBurstTimes.filter(function(t){ return t>cutoff; });
  mqCheckDone();
}
function mqOnBad(){
  mqState.streak = 0;
  mqState.combo  = 0;
  mqState.noMissSec = 0; // รีเซ็ตนับ no-junk
  mqCheckDone();
}
function mqCheckDone(){
  if(!mqList.length) return;
  var q = mqList[mqIndex];
  var ok=false;
  if(q.type==='countGood') ok = mqState.good>=q.target;
  if(q.type==='combo')     ok = mqState.combo>=q.target;
  if(q.type==='fever')     ok = mqState.fever>=q.target;
  if(q.type==='streak')    ok = mqState.streak>=q.target;
  if(q.type==='score')     ok = mqState.score>=q.target;
  if(q.type==='nojunk')    ok = mqState.noMissSec>=q.target;
  if(q.type==='burst10')   ok = mqBurstTimes.length>=q.target;
  if(q.type==='goal')      ok = false; // โหมดนี้ยังไม่ตั้ง main goal — ไว้เชื่อมต่อภายหลัง

  if(ok){
    mqIndex++;
    if(mqIndex>=mqList.length){
      emit('hha:quest',{text:'Mini Quest — เคลียร์ครบแล้ว! 🎉'});
    }else{
      emit('hha:quest',{text:'Mini Quest — '+mqList[mqIndex].label});
    }
  }
}

// DOM helpers
function vw(){ return Math.max(320, window.innerWidth||320); }
function vh(){ return Math.max(320, window.innerHeight||320); }
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function ensureLayer(){
  // ล้างเลเยอร์ค้าง
  var olds=document.querySelectorAll('.hha-layer');
  for(var i=0;i<olds.length;i++){ try{ olds[i].parentNode.removeChild(olds[i]); }catch(_e){} }
  layer = document.createElement('div');
  layer.className='hha-layer';
  document.body.appendChild(layer);
}

function popupText(txt, x, y, color){
  var t = document.createElement('div');
  t.style.position='fixed';
  t.style.left = x+'px'; t.style.top = (y-8)+'px';
  t.style.transform='translate(-50%,-50%)';
  t.style.font='700 16px system-ui,Segoe UI,Roboto,Thonburi,sans-serif';
  t.style.color = color||'#fff';
  t.style.textShadow='0 2px 8px rgba(0,0,0,.6)';
  t.style.zIndex='700';
  t.textContent = txt;
  document.body.appendChild(t);
  setTimeout(function(){ t.style.transition='all .52s ease'; t.style.opacity='0'; t.style.top=(y-40)+'px'; }, 0);
  setTimeout(function(){ try{ document.body.removeChild(t); }catch(_e){} }, 560);
}

function makeTarget(diff){
  var isGood = Math.random() > 0.35;
  var emoji  = isGood ? pick(GOOD) : pick(JUNK);

  var el = document.createElement('div');
  el.className='hha-tgt';
  el.textContent=emoji;

  // ตำแหน่งล่าง-กลางจอ ช่วงกว้าง
  var x = Math.floor(vw()*0.14 + Math.random()*vw()*0.72);
  var y = Math.floor(vh()*0.58 + Math.random()*vh()*0.28);
  el.style.left=x+'px'; el.style.top=y+'px';

  // ขนาดตามระดับ
  var fs = 64; if(diff==='easy') fs=74; if(diff==='hard') fs=56;
  el.style.fontSize = fs+'px';

  var clicked=false;
  function onHit(ev){
    if(clicked || !running) return;
    clicked=true;
    try{ ev.preventDefault(); }catch(_e){}
    // ตัดสิน
    if(isGood){
      var base = 20 + combo*2;
      var plus = FEVER_ACTIVE ? base*2 : base;
      score += plus;
      combo += 1; if(combo>maxCombo) maxCombo=combo;
      mqState.combo = combo;
      mqState.streak += 1;
      mqState.score = score;
      mqOnGood(performance.now());
      if(!FEVER_ACTIVE && combo>=FEVER_NEED_COMBO) feverStart();
      popupText('+'+plus, x, y, '#b9f6ca');
    }else{
      combo=0; mqOnBad();
      misses += 1;
      score = Math.max(0, score-15);
      popupText('-15', x, y, '#ffb4b4');
    }
    try{ layer.removeChild(el); }catch(_e){}
    emit('hha:score', {score:score, combo:combo});
    planNextSpawn(diff);
  }
  el.addEventListener('click', onHit, {passive:false});
  el.addEventListener('touchstart', onHit, {passive:false});

  // TTL → miss
  var life=1600; if(diff==='easy') life=1900; if(diff==='hard') life=1400;
  if(FEVER_ACTIVE) life = Math.max(900, Math.round(life*0.9));
  var killer=setTimeout(function(){
    if(!running) return;
    if(!el.parentNode) return;
    try{ layer.removeChild(el); }catch(_e){}
    combo=0; mqOnBad();
    misses+=1;
    emit('hha:miss',{count:misses});
    emit('hha:score',{score:score, combo:combo});
    planNextSpawn(diff);
  }, life);

  layer.appendChild(el);
}

function planNextSpawn(diff){
  if(!running) return;
  var gap=520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER_ACTIVE) gap = Math.max(300, Math.round(gap*0.85));
  clearTimeout(spawnTimer);
  spawnTimer = setTimeout(function(){ makeTarget(diff); }, gap);
}

function startWatchdog(diff){
  clearInterval(watchdog);
  watchdog = setInterval(function(){
    if(!running) return;
    var leftOvers = layer.querySelectorAll('.hha-tgt');
    if(leftOvers.length===0){
      makeTarget(diff); // บังคับโผล่แน่ ๆ
    }
  }, 2000);
}

export async function boot(cfg){
  cfg = cfg || {};
  var diff = String(cfg.difficulty||'normal');
  var duration = (cfg.duration|0) || 60;

  running=true; score=0; combo=0; maxCombo=0; misses=0;
  FEVER_ACTIVE=false; clearTimeout(feverTimer); feverTimer=null;

  ensureLayer();
  emit('hha:score',{score:0, combo:0});
  emit('hha:fever',{state:'end'});
  mqReset();

  // เวลา
  var left = duration;
  emit('hha:time',{sec:left});
  clearInterval(timeTimer);
  timeTimer = setInterval(function(){
    if(!running){ clearInterval(timeTimer); return; }
    left = Math.max(0, left-1);
    emit('hha:time',{sec:left});
    // mini quest counter (per second)
    mqTickSecond();
    if(left<=0){ endGame(); }
  }, 1000);

  // spawn & watchdog
  makeTarget(diff);
  planNextSpawn(diff);
  startWatchdog(diff);

  function endGame(){
    running=false;
    clearTimeout(spawnTimer); clearInterval(timeTimer); clearInterval(watchdog);
    feverEnd();
    // ลบเป้าค้าง
    try{
      var nodes = layer.querySelectorAll('.hha-tgt');
      for(var i=0;i<nodes.length;i++){ try{ layer.removeChild(nodes[i]); }catch(_e){} }
    }catch(_e){}
    emit('hha:end',{ score:score, combo:maxCombo, misses:misses, title:'Good vs Junk' });
    try{ document.body.removeChild(layer); }catch(_e){}
  }

  return {
    stop: function(){ if(!running) return; endGame(); },
    pause: function(){ running=false; clearTimeout(spawnTimer); },
    resume:function(){ if(running) return; running=true; planNextSpawn(diff); }
  };
}
export default { boot };
