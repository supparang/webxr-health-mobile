// === Groups Mode — Goal 1→2→3 per difficulty + shards + score popup (no optional chaining) ===
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function rint(n){ return Math.floor(Math.random()*n); }
function choice(arr){ return arr[rint(arr.length)]; }
function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(e){} }

// ---- emoji → texture cache ----
var __emojiCache = {};
function emojiSprite(emo, px){
  var size = px||176, key = emo+'@'+size;
  if(__emojiCache[key]) return __emojiCache[key];
  var c = document.createElement('canvas'); c.width=c.height=size;
  var ctx=c.getContext('2d');
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(size*0.75)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,0.25)'; ctx.shadowBlur=size*0.06;
  ctx.fillText(emo, size/2, size/2);
  __emojiCache[key]=c.toDataURL('image/png'); return __emojiCache[key];
}

// ---- groups ----
var GROUPS={
  fruits:['🍎','🍌','🍇','🍓','🍊','🍍','🍐','🥝','🍉','🍋'],
  veggies:['🥕','🥦','🥬','🍅','🫑','🧅','🌽','🍆'],
  grains:['🍞','🥖','🥐','🥯','🍚','🍙','🍘','🍝','🥨'],
  protein:['🥚','🐟','🍗','🥩','🫘','🥜','🍤','🧆'],
  dairy:['🥛','🧀','🍦','🍨']
};
var GROUP_NAMES={fruits:'ผลไม้', veggies:'ผัก', grains:'ธัญพืช', protein:'โปรตีน', dairy:'นม/ไดอารี่'};
var KEYS=Object.keys(GROUPS);

// ---- quests (สุ่มทีละใบ รวม 3 ใบต่อเกม จาก 10 แบบ) ----
var QUEST_POOL=[
  {id:'hit10',   label:'เก็บให้โดน 10 ชิ้น',      check:function(s){return s.hits>=10;}},
  {id:'combo8',  label:'ทำคอมโบ x8',             check:function(s){return s.maxCombo>=8;}},
  {id:'avoid8',  label:'หลบของนอกกลุ่ม 8',       check:function(s){return s.avoidOut>=8;}},
  {id:'score300',label:'ทำคะแนน 300',             check:function(s){return s.score>=300;}},
  {id:'score500',label:'ทำคะแนน 500',             check:function(s){return s.score>=500;}},
  {id:'chain5',  label:'คอมโบต่อเนื่อง 5',       check:function(s){return s.maxCombo>=5;}},
  {id:'target7', label:'ของตามกลุ่ม 7 ชิ้น',     check:function(s){return s.collected>=7;}},
  {id:'perfect', label:'ยังไม่พลาดเลย',           check:function(s){return s.misses===0 && s.hits>=6;}},
  {id:'mix10',   label:'รวมทุกกลุ่ม 10',          check:function(s){return s.hits>=10;}},
  {id:'avoid5',  label:'หลบของผิด 5',            check:function(s){return s.avoidOut>=5;}}
];

// ---- state ----
var running=false, host=null, duration=60, remain=60, diff='normal';
var score=0, combo=0, maxCombo=0, hits=0, misses=0, spawns=0;
var activeTargets=['fruits'];   // รายการ “กลุ่ม” ที่เป็นเป้าพร้อมกัน (1..3)
var goalN=1;                    // จำนวนกลุ่มเป้าพร้อมกัน (1..3) — ไต่ขึ้นถ้าไม่พลาด
var collectedThisSet=0;         // เก็บโดนภายในชุด current set (ต้องครบ goalN ชิ้น)
var escalateLock=false;         // ล็อกไม่ให้ขึ้น goalN ชั่วคราวหลังพลาด
var lastMissAt=0;

var questDeck=[], questDone=0, currentQuest=null;
var qStats={ avoidOut:0, collected:0, maxCombo:0, score:0, hits:0, misses:0 };

var spawnTimer=null, timeTimer=null;

// ---- difficulty tuning ----
function startGoalByDiff(d){ if(d==='hard') return 2; if(d==='easy') return 1; return 1; }
function maxGoalByDiff(d){ return 3; } // ทุกระดับไปได้ถึง 3
function tuneByDiff(d){
  if(d==='easy')   return {gap:560, life:2100, hitW:0.46, shard: {count:10, speed:0.9, color:'#22c55e'}};
  if(d==='hard')   return {gap:420, life:1500, hitW:0.40, shard: {count:16, speed:1.3, color:'#16a34a'}};
  return            {gap:500, life:1800, hitW:0.42, shard: {count:12, speed:1.1, color:'#1dd3b0'}};
}

// ---- coach ----
var coachCD=0;
function coach(msg){
  fire('hha:quest',{text: '🎙️ โค้ช: '+msg});
  setTimeout(updateQuestBadge, 1100);
}
function coachGood(){
  var now=Date.now(); if(now-coachCD<900) return; coachCD=now;
  if(combo===5) coach('คอมโบเริ่มมาแล้ว ดีมาก!');
  else if(collectedThisSet===Math.max(1,Math.floor(goalN/2))) coach('อีกนิดเดียว ชุดนี้ใกล้ครบแล้ว!');
}
function coachMiss(){
  var now=Date.now(); if(now-coachCD<900) return; coachCD=now;
  coach('โฟกัสกลุ่มที่กำหนดนะ! พลาดแล้วถอยเป้าลงชั่วคราว');
}

// ---- quests ----
function questPick3(){
  var pool=QUEST_POOL.slice(), out=[];
  for(var i=0;i<3;i++){ var idx=rint(pool.length); out.push(pool[idx]); pool.splice(idx,1); }
  questDeck=out; questDone=0; currentQuest=questDeck[0]||null;
  updateQuestBadge();
}
function checkQuest(){
  if(!currentQuest) return;
  var st={ avoidOut:qStats.avoidOut, collected:qStats.collected, maxCombo:qStats.maxCombo,
           score:score, hits:hits, misses:misses };
  var ok=false; try{ ok=!!currentQuest.check(st); }catch(_e){ ok=false; }
  if(ok){
    questDone++;
    if(questDone>=3){ currentQuest=null; }
    else currentQuest=questDeck[questDone];
    updateQuestBadge();
  }
}

// ---- HUD helper ----
function headTargetsText(list){
  var th = list.map(function(k){ return '“'+GROUP_NAMES[k]+'”'; }).join(' + ');
  return th || '—';
}
function updateQuestBadge(){
  var txt='🎯 เป้า '+goalN+' รายการ: '+headTargetsText(activeTargets);
  txt += ' • 🧩 เควสต์: '+(currentQuest? currentQuest.label : 'ครบแล้ว!');
  fire('hha:quest',{text:txt});
}

// ---- shards effect ----
function burstShards(x,y,conf){
  // conf: {count,speed,color}
  var cnt = (conf && conf.count)|0 || 12;
  var spd = (conf && conf.speed) || 1.0;
  var col = (conf && conf.color) || '#22c55e';
  for(var i=0;i<cnt;i++){
    var p=document.createElement('a-entity');
    var s=0.05 + Math.random()*0.06;
    var ang=Math.random()*Math.PI*2;
    var vx=Math.cos(ang)*0.6*spd, vy=0.8*spd + Math.random()*0.4, vz=Math.sin(ang)*0.6*spd;
    var life=420 + Math.random()*260;

    var plane=document.createElement('a-plane');
    plane.setAttribute('width', s); plane.setAttribute('height', s*1.6);
    plane.setAttribute('material','color:'+col+'; opacity:0.95; side:double');
    p.appendChild(plane);

    p.setAttribute('position', x+' '+y+' -1.55');
    host.appendChild(p);

    // ใช้ animation component ให้ “พุ่ง + จาง”
    p.setAttribute('animation__move', 'property: position; to: '+(x+vx)+' '+(y+vy)+' '+(-1.65+vz)+'; dur:'+Math.round(life)+'; easing: ease-out');
    p.setAttribute('animation__fade', 'property: opacity; to: 0; dur:'+Math.round(life)+'; easing: linear');

    (function(node){
      setTimeout(function(){ if(node.parentNode) node.parentNode.removeChild(node); }, life+40);
    })(p);
  }
}

// ---- score popup ----
function popText(txt,x,y,color){
  var t=document.createElement('a-entity');
  t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#fff')+'; fontSize:0.09;');
  t.setAttribute('position', x+' '+(y+0.06)+' -1.52');
  host.appendChild(t);
  t.setAttribute('animation__rise','property: position; to: '+x+' '+(y+0.30)+' -1.52; dur: 520; easing: easeOutCubic');
  t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 560);
}

// ---- target spawn ----
function makeTarget(emoji, isValid, tune){
  var el=document.createElement('a-entity');
  var img=document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  var px=(Math.random()*1.2 - 0.6);
  var py=(Math.random()*0.4 + 0.9); // กลางจอโซนล่างนิด
  img.setAttribute('position', px+' '+py+' -1.55');
  img.setAttribute('width',tune.hitW); img.setAttribute('height',tune.hitW);
  img.classList.add('clickable'); el.appendChild(img);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.addEventListener('click', function(){
    if(!running) return; destroy(); spawns++;
    if(isValid){
      hits++; combo++; if(combo>maxCombo) maxCombo=combo;
      qStats.collected++; qStats.hits=hits; qStats.maxCombo=maxCombo;

      var gain = 20 + Math.floor(combo*2);
      score += gain;
      collectedThisSet += 1;
      popText('+'+gain, px, py, '#c6f6d5');
      burstShards(px, py, tune.shard);
      coachGood();

      // จบ "ชุด" เมื่อเก็บครบตามจำนวน goalN
      if(collectedThisSet>=goalN){
        collectedThisSet=0;
        // ถ้า “ชุด” นี้ไม่พลาดเลย (จากครั้งก่อนจนครบชุด) และไม่ล็อก → ไต่ระดับเป้าสูงสุด 3
        if(!escalateLock){ goalN = clamp(goalN+1, 1, maxGoalByDiff(diff)); }
        updateQuestBadge();
      }
    }else{
      misses++; combo=0; qStats.misses=misses;
      score = Math.max(0, score-25);
      popText('-25', px, py, '#fecaca');
      burstShards(px, py, {count:10, speed:1.0, color:'#ef4444'});
      coachMiss();

      // พลาด → ลด goalN ทันที และล็อกการไต่ขึ้นช่วงสั้น ๆ
      goalN = clamp(goalN-1, 1, 3);
      collectedThisSet = 0;
      escalateLock = true; lastMissAt = Date.now();
      setTimeout(function(){ escalateLock=false; }, 4000);
    }

    fire('hha:score',{score:score, combo:combo});
    checkQuest();
  });

  setTimeout(function(){
    if(!el.parentNode) return; destroy(); spawns++;
    // ของ “ไม่ใช่เป้า” หมดเวลา → นับเป็น avoidOut (รางวัลทางอ้อมให้เควสต์)
    if(!isValid){ qStats.avoidOut++; checkQuest(); return; }

    // ของ “เป็นเป้า” หมดเวลา → โทษเบา ๆ
    combo=0; score=Math.max(0, score-10); qStats.misses=++misses;
    popText('-10', px, py, '#ffd3b6');
    burstShards(px, py, {count:8, speed:0.9, color:'#f59e0b'});
    // ถอย goalN และล็อก
    goalN = clamp(goalN-1, 1, 3);
    collectedThisSet = 0;
    escalateLock = true; lastMissAt = Date.now();
    setTimeout(function(){ escalateLock=false; }, 4000);

    fire('hha:score',{score:score, combo:combo});
    checkQuest();
  }, tune.life);

  return el;
}

function spawnLoop(tune){
  if(!running) return;

  // โอกาสสปอนของเป้าที่ “ถูกกลุ่ม” สูงกว่าปกติเล็กน้อย
  var isValid = Math.random() < 0.62;

  // เลือกกลุ่ม/อีโมจิ
  var pool, targetKey;
  if(isValid){
    targetKey = activeTargets[rint(activeTargets.length)];
    pool = GROUPS[targetKey];
  }else{
    // กลุ่มอื่นที่ไม่อยู่ในเป้าขณะนี้
    var others = KEYS.filter(function(k){ return activeTargets.indexOf(k)===-1; });
    targetKey = choice(others.length? others : KEYS);
    pool = GROUPS[targetKey];
  }
  host.appendChild( makeTarget(choice(pool), isValid, tune) );

  // next gap (สุ่มเล็กน้อย)
  var jitter = Math.floor(tune.gap*0.25*(Math.random()*2-1));
  var nextGap = clamp(tune.gap + jitter, 320, 1100);
  spawnTimer=setTimeout(function(){ spawnLoop(tune); }, nextGap);
}

// สุ่มเซ็ตกลุ่มเป้า “ตาม goalN”
function rollActiveTargets(n){
  var arr = KEYS.slice(); var out = [];
  for(var i=0;i<n;i++){
    if(arr.length===0){ out.push(choice(KEYS)); continue; }
    var idx = rint(arr.length);
    out.push(arr[idx]); arr.splice(idx,1);
  }
  return out;
}

// ---------- life cycle ----------
export async function boot(cfg){
  cfg=cfg||{};
  host = cfg.host || document.getElementById('spawnHost') || document.body;
  duration = (cfg.duration|0)||60; remain=duration;
  diff = String(cfg.difficulty||'normal');

  // init per run
  running=true; score=0; combo=0; maxCombo=0; hits=0; misses=0; spawns=0;
  qStats={ avoidOut:0, collected:0, maxCombo:0, score:0, hits:0, misses:0 };

  goalN = startGoalByDiff(diff);              // เริ่ม 1/1/2 ตามระดับ
  collectedThisSet = 0;
  escalateLock = false; lastMissAt = 0;
  activeTargets = rollActiveTargets(goalN);

  fire('hha:score',{score:0, combo:0});
  fire('hha:fever',{state:'end'}); // โหมดนี้ไม่ใช้ fever — ล้างเกจ
  questPick3(); // สุ่มเควสต์ 3 ใบ

  var tune=tuneByDiff(diff);

  // นาฬิกา
  if(timeTimer) clearInterval(timeTimer);
  timeTimer=setInterval(function(){
    if(!running){ clearInterval(timeTimer); return; }
    remain=Math.max(0, remain-1);
    fire('hha:time',{sec:remain});

    // อัปเดตหัว goal ทุก ๆ 1 วิ (เผื่อ goalN เปลี่ยนจากพลาด/ไต่)
    // และรีเฟรชรายชื่อ activeTargets เมื่อเริ่ม “ชุด” ใหม่
    if(collectedThisSet===0){
      // เป้าหมายใหม่ (สุ่มกลุ่มตามจำนวน goalN ปัจจุบัน)
      activeTargets = rollActiveTargets(goalN);
      updateQuestBadge();
    }

    if(remain<=0) endGame('timeout');
  },1000);

  spawnLoop(tune);

  return {
    stop:function(){ endGame('stop'); },
    pause:function(){ running=false; try{clearTimeout(spawnTimer);}catch(_e){}; },
    resume:function(){ if(running) return; running=true; spawnLoop(tuneByDiff(diff)); }
  };
}

function endGame(reason){
  if(!running) return; running=false;
  try{ clearTimeout(spawnTimer);}catch(_e){}
  try{ clearInterval(timeTimer);}catch(_e){}

  // cleanup
  try{
    var nodes=host.querySelectorAll('a-image, a-entity');
    for(var i=0;i<nodes.length;i++){ var n=nodes[i]; if(n.parentNode) n.parentNode.removeChild(n); }
  }catch(_e){}

  var res={
    title:'Food Groups', difficulty:diff, score:score,
    combo:combo, comboMax:maxCombo, hits:hits, misses:misses, spawns:spawns,
    questsCleared: questDone, questsTotal: questDeck.length||3,
    goalN: goalN, duration: duration, reason:reason
  };
  fire('hha:end', res);
}

export default { boot };
