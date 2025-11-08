// === Good vs Junk — SAFE Production (emoji canvas, shards, fever, quests, summary) ===
var running=false, host=null, score=0, combo=0, maxCombo=0, misses=0;
var spawnTimer=null, timeTimer=null;
var totalSpawns=0, goodHits=0;

// ---- emoji sprite cache (canvas → dataURL) ----
var __emojiCache = {};
function emojiSprite(emo, px){
  var size = px || 128, key = emo+'@'+size;
  if(__emojiCache[key]) return __emojiCache[key];
  var c = document.createElement('canvas'); c.width=c.height=size;
  var ctx = c.getContext('2d');
  ctx.clearRect(0,0,size,size);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(size*0.75)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,0.25)'; ctx.shadowBlur=size*0.06;
  ctx.fillText(emo, size/2, size/2);
  __emojiCache[key] = c.toDataURL('image/png');
  return __emojiCache[key];
}
function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail})); }catch(e){} }

// ---- Pools ----
var GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐','🍋','🫐','🥗','🍉'];
var JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬','🍨','🍧','🍿'];

// ---- Fever ----
var FEVER_ACTIVE=false;
var FEVER_COMBO_NEED=8;           // กำหนดผ่านคอมโบ
var FEVER_MS=10000;
var FEVER_LEVEL=0;                // 0..100 (แสดงแถบ)
var feverTimer=null;

function feverGauge(add){         // เติมเกจ 0..100
  FEVER_LEVEL = Math.max(0, Math.min(100, FEVER_LEVEL + (add||0)));
  emit('hha:fever', {state:'change', level:FEVER_LEVEL});
  if(!FEVER_ACTIVE && FEVER_LEVEL>=100){ feverStart(); }
}
function feverStart(){
  if(FEVER_ACTIVE) return;
  FEVER_ACTIVE = true; FEVER_LEVEL=100;
  emit('hha:fever',{state:'start', level:FEVER_LEVEL, ms:FEVER_MS});
  clearTimeout(feverTimer);
  feverTimer = setTimeout(function(){ feverEnd(); }, FEVER_MS);
}
function feverEnd(){
  if(!FEVER_ACTIVE) return;
  FEVER_ACTIVE = false; FEVER_LEVEL=0;
  emit('hha:fever',{state:'end', level:FEVER_LEVEL});
  clearTimeout(feverTimer); feverTimer=null;
}

// ---- Mini Quest (สุ่ม 3 จาก 10) ----
var QUEST_POOL = [
  {id:'G10',  text:'เก็บของดี 10 ชิ้น',            type:'good',  target:10,  p:0},
  {id:'G20',  text:'เก็บของดี 20 ชิ้น',            type:'good',  target:20,  p:0},
  {id:'C5',   text:'ทำคอมโบ x5',                   type:'combo', target:5,   p:0},
  {id:'C10',  text:'ทำคอมโบ x10',                  type:'combo', target:10,  p:0},
  {id:'F1',   text:'เข้า FEVER 1 ครั้ง',            type:'fever', target:1,   p:0},
  {id:'ST8',  text:'ทำสตรีค 8 ชิ้นติด',            type:'streak',target:8,   p:0},
  {id:'S300', text:'ทำคะแนนถึง 300 คะแนน',         type:'score', target:300, p:0},
  {id:'NJ15', text:'เลี่ยงขยะ 15 วินาที',          type:'nojunk',target:15,  p:0},
  {id:'B5',   text:'เก็บของดี 5 ชิ้นใน 10 วิ',     type:'burst', target:5,   p:0},
  {id:'M40',  text:'ผ่านภารกิจหลัก (40 ชิ้น)',     type:'mission',target:40, p:0}
];
var QUESTS=[], QIDX=0, lastJunkAt=0, goodTimestamps=[], feverCount=0, missionGood=0;

function pick3(){
  var pool=QUEST_POOL.slice(); var out=[];
  while(out.length<3 && pool.length){
    var i=(Math.random()*pool.length)|0; out.push(pool.splice(i,1)[0]);
  }
  return out;
}
function showQuest(){
  var q=QUESTS[QIDX];
  if(!q){ emit('hha:quest',{text:'เคลียร์เควสครบแล้ว!'}); return; }
  var prog = (q.type==='mission') ? (q.p>=1?1:0)+'/'+1 : (Math.min(q.p,q.target))+'/'+q.target;
  emit('hha:quest', { text: 'เควส: '+q.text+' ('+prog+')' });
}
function questGood(scoreNow, comboNow, streakNow){
  missionGood++;
  goodTimestamps.push(timeSec);
  goodTimestamps = goodTimestamps.filter(function(t){ return t>timeSec-10; });
  var q=QUESTS[QIDX]; if(!q) return;
  if(q.type==='good')   q.p=Math.min(q.target, missionGood);
  if(q.type==='combo')  q.p=Math.min(q.target, Math.max(q.p, comboNow));
  if(q.type==='streak') q.p=Math.min(q.target, Math.max(q.p, streakNow));
  if(q.type==='score')  q.p=Math.min(q.target, Math.max(q.p, scoreNow));
  if(q.type==='burst')  q.p=Math.min(q.target, Math.max(q.p, goodTimestamps.length));
  if(q.type==='mission') q.p = (missionGood>=q.target)?1:0;
  if(checkQuestDone(q)){ QIDX=Math.min(QIDX+1, QUESTS.length-1); }
  showQuest();
}
function questJunk(){
  lastJunkAt=timeSec;
  var q=QUESTS[QIDX]; if(!q) return;
  // visual only (streak reset handled by caller if any)
  showQuest();
}
function questFever(){
  feverCount++;
  var q=QUESTS[QIDX]; if(!q) return;
  if(q.type==='fever'){ q.p=Math.min(q.target, feverCount); }
  if(checkQuestDone(q)){ QIDX=Math.min(QIDX+1, QUESTS.length-1); }
  showQuest();
}
function checkQuestDone(q){
  return (q.type==='mission') ? (q.p>=1) : (q.p>=q.target);
}

// ---- shards FX ----
function shardsBurst(pos, color, speed){
  try{
    var n = 10, i;
    for(i=0;i<n;i++){
      var p=document.createElement('a-sphere');
      p.setAttribute('radius', 0.02);
      p.setAttribute('color', color||'#69f0ae');
      p.setAttribute('position', pos.x+' '+pos.y+' '+pos.z);
      host.appendChild(p);
      var dx=(Math.random()*2-1)*0.5, dy=Math.random()*0.9+0.2, dz=(Math.random()*2-1)*0.5;
      var x=pos.x+dx, y=pos.y+dy, z=pos.z+dz;
      var dur = Math.max(380, Math.round((speed||1)*520));
      p.setAttribute('animation__move','property: position; to: '+x+' '+y+' '+z+'; dur: '+dur+'; easing: ease-out');
      p.setAttribute('animation__fade','property: material.opacity; to: 0; dur: '+(dur+80)+'; easing: linear');
      (function(pp){ setTimeout(function(){ try{ pp.remove(); }catch(e){} }, dur+100); })(p);
    }
  }catch(e){}
}

// ---- Target ----
function makeTarget(emoji, good, diff){
  var el = document.createElement('a-entity');

  var img = document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  // ล่าง-กลางจอ (กระจายแนวนอนเล็กน้อย)
  var px = (Math.random()*1.6 - 0.8);
  var py = (Math.random()*0.7 + 0.6);
  var pz = 0;
  img.setAttribute('position', px+' '+py+' '+pz);
  img.setAttribute('width', 0.42);
  img.setAttribute('height', 0.42);
  img.classList.add('clickable');
  el.appendChild(img);

  var glow = document.createElement('a-plane');
  glow.setAttribute('width',0.50); glow.setAttribute('height',0.50);
  glow.setAttribute('material','color:'+(good?'#22c55e':'#ef4444')+'; opacity:0.20; transparent:true; side:double');
  glow.setAttribute('position','0 0 -0.01');
  el.appendChild(glow);

  function destroy(){ try{ el.remove(); }catch(e){} }

  img.addEventListener('click', function(){
    if(!running) return;
    destroy();

    if(good){
      var base = 20 + combo*2;
      var plus = FEVER_ACTIVE ? base*2 : base; // x2 ใน Fever
      score += plus;
      combo += 1; if(combo>maxCombo) maxCombo = combo;
      goodHits += 1;
      feverGauge(100/FEVER_COMBO_NEED);            // เพิ่มตามสัดส่วน
      if(combo>=FEVER_COMBO_NEED) feverStart();    // กันเหนียว
      shardsBurst({x:px,y:py,z:pz}, '#69f0ae', .9);// ชิ้นแตกสีเขียว
      popupText('+'+plus, px, py, '#ffffff');
      questGood(score, combo, combo);              // อัปเดตเควส
    }else{
      // คลิกโดนขยะ = โทษ
      combo = 0; misses += 1;
      score = Math.max(0, score - 15);
      shardsBurst({x:px,y:py,z:pz}, '#ff8a8a', 1.0);
      popupText('-15', px, py, '#ffb4b4');
      questJunk();
      emit('hha:miss', {count:misses});
    }

    emit('hha:score', {score:score, combo:combo});
  });

  // เวลาหมด:
  var ttl = 1600; if(diff==='easy') ttl=1900; else if(diff==='hard') ttl=1400;
  setTimeout(function(){
    if(!el.parentNode || !running) return;
    destroy();
    // หมดเวลา → ถือว่า "พลาด" เฉพาะของดี
    if(good){
      combo = 0; misses += 1;
      popupText('MISS', px, py, '#ffcb6b');
      emit('hha:miss', {count:misses});
      questJunk();
    }else{
      // ปล่อยขยะให้หายไปเอง → ได้ +5 และไม่ทุบคอมโบ (ตามที่ขอ)
      var plus = FEVER_ACTIVE ? 10 : 5;
      score += plus;
      popupText('+'+plus, px, py, '#a0e3ff');
    }
    emit('hha:score', {score:score, combo:combo});
  }, ttl);

  return el;
}

function popupText(txt, x, y, color){
  try{
    var t = document.createElement('a-entity');
    t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#ffffff')+'; fontSize:0.09;');
    t.setAttribute('position', x+' '+(y+0.05)+' 0.02');
    host.appendChild(t);
    t.setAttribute('animation__rise','property: position; to: '+x+' '+(y+0.30)+' 0.02; dur: 520; easing: ease-out');
    t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
    setTimeout(function(){ try{ t.remove(); }catch(e){} }, 560);
  }catch(e){}
}

function spawnLoop(diff){
  if(!running) return;
  var goodPick = Math.random() > 0.35;
  var emoji = goodPick ? GOOD[(Math.random()*GOOD.length)|0]
                       : JUNK[(Math.random()*JUNK.length)|0];
  var node = makeTarget(emoji, goodPick, diff);
  totalSpawns++;
  host.appendChild(node);

  var gap = 520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER_ACTIVE) gap = Math.max(300, Math.round(gap*0.85));
  spawnTimer = setTimeout(function(){ spawnLoop(diff); }, gap);
}

// ---- timer / state ----
var timeSec=0, gameDurationSec=60;

export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  // reset
  running=true; score=0; combo=0; maxCombo=0; misses=0; totalSpawns=0; goodHits=0;
  FEVER_ACTIVE=false; FEVER_LEVEL=0; clearTimeout(feverTimer); feverTimer=null;
  emit('hha:fever',{state:'end', level:0});
  emit('hha:score',{score:0, combo:0});

  // quests
  QUESTS = pick3(); QIDX=0; lastJunkAt=0; goodTimestamps=[]; feverCount=0; missionGood=0;
  showQuest();

  // timer
  timeSec = duration; gameDurationSec = duration;
  emit('hha:time', {sec: timeSec});
  clearInterval(timeTimer);
  timeTimer = setInterval(function(){
    if(!running){ clearInterval(timeTimer); return; }
    timeSec -= 1; if(timeSec<0) timeSec=0;
    // นับ no-junk quest
    var q=QUESTS[QIDX]; if(q && q.type==='nojunk'){
      var seconds = Math.max(0, (gameDurationSec - timeSec) - lastJunkAt);
      q.p = Math.min(q.target, Math.max(q.p, seconds));
      if(checkQuestDone(q)){ QIDX=Math.min(QIDX+1, QUESTS.length-1); }
      showQuest();
    }
    emit('hha:time', {sec: timeSec});
    if(timeSec<=0){ endGame('timeout'); }
  }, 1000);

  // start spawn
  spawnLoop(diff);

  function endGame(reason){
    running=false;
    try{ clearTimeout(spawnTimer); }catch(e){}
    feverEnd();
    // เคลียร์เควสที่ผ่านกี่ใบ
    var cleared = 0; for(var i=0;i<QUESTS.length;i++){ if(checkQuestDone(QUESTS[i])) cleared++; }
    emit('hha:end', {
      mode:'goodjunk',
      reason: reason || 'timeout',
      score: score,
      comboMax: maxCombo || combo || 0,
      misses: misses || 0,
      hits: goodHits || 0,
      spawns: totalSpawns || (goodHits + (misses||0)),
      questsCleared: cleared,
      questsTotal: 3,
      duration: gameDurationSec,
      difficulty: diff
    });
  }

  // public API
  return {
    stop: function(){ if(!running) return; endGame('stop'); },
    pause: function(){ running=false; },
    resume: function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}
export default { boot };
