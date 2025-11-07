// === Healthy Plate — QUEST (SAFE build / no optional chaining) ===
// Path: /webxr-health-mobile/HeroHealth/modes/plate.quest.js

var running=false, host=null;
var score=0, combo=0, maxCombo=0, misses=0;
var spawnTimer=null, timeTimer=null;

// ---------- helpers ----------
function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(e){}
}

var __emojiCache = {};
function emojiSprite(emo, px){
  var size = px || 180, key = emo+'@'+size;
  if(__emojiCache[key]) return __emojiCache[key];
  var c = document.createElement('canvas'); c.width=c.height=size;
  var ctx = c.getContext('2d');
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(size*0.76)+'px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.shadowColor='rgba(0,0,0,.25)'; ctx.shadowBlur=size*0.08;
  ctx.fillText(emo, size/2, size/2);
  __emojiCache[key] = c.toDataURL('image/png');
  return __emojiCache[key];
}

function popupText(txt, x, y, color){
  var t = document.createElement('a-text');
  t.setAttribute('value', txt);
  t.setAttribute('color', color||'#fff');
  t.setAttribute('align','center');
  t.setAttribute('width','1.8');
  t.setAttribute('position', x+' '+(y+0.10)+' -1.18');
  host.appendChild(t);
  t.setAttribute('animation__rise','property: position; to: '+x+' '+(y+0.40)+' -1.18; dur: 520; easing: easeOutCubic');
  t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
  setTimeout(function(){ if(t && t.parentNode) t.parentNode.removeChild(t); }, 560);
}

// ---------- 5 Food Groups ----------
var GROUPS = [
  { id:'grains',  label:'ธัญพืช',  color:'#eab308', pool:['🍚','🍙','🍞','🥖','🥯','🍜','🍝','🫓','🥨'] },
  { id:'veggies', label:'ผัก',     color:'#22c55e', pool:['🥦','🥬','🥕','🍅','🍆','🌽','🧅','🫛','🫑'] },
  { id:'fruits',  label:'ผลไม้',   color:'#f97316', pool:['🍎','🍏','🍌','🍇','🍓','🍍','🍐','🍊','🥝'] },
  { id:'protein', label:'โปรตีน',  color:'#60a5fa', pool:['🐟','🍗','🥩','🥚','🫘','🥜','🧀','🍤','🦐'] },
  { id:'dairy',   label:'นม',      color:'#a78bfa', pool:['🥛','🧀','🍶','🍦'] }
];
// สิ่งลวง (จะถือเป็น "ผิดหมู่")
var BAITS  = ['🍔','🍟','🍕','🍩','🍪','🧁','🧋','🥤','🍫','🌭','🍰','🍬'];

// ---------- Round / Goal ----------
var round=1;
var needPerGroup = { grains:1, veggies:1, fruits:1, protein:1, dairy:1 }; // ต่อรอบต้องการขั้นต่ำ
var progress     = { grains:0, veggies:0, fruits:0, protein:0, dairy:0 };

function resetRound(){
  // เพิ่มความยากแบบนุ่มนวล: รอบ 2–3 เพิ่มบางหมู่เป็น 2 ชิ้น, สูงสุดไม่เกิน 3
  round += 1;
  var target = round<=2 ? 1 : (round<=4 ? 2 : 3);
  needPerGroup = { grains:target, veggies:target, fruits:target, protein:target, dairy:target };
  progress     = { grains:0,      veggies:0,      fruits:0,      protein:0,      dairy:0      };
  updateQuestHUD();
}

function groupFromEmoji(emo){
  for(var i=0;i<GROUPS.length;i++){
    var g = GROUPS[i];
    for(var j=0;j<g.pool.length;j++){
      if(g.pool[j]===emo) return g.id;
    }
  }
  return null; // bait หรือหาไม่เจอ
}

function isRoundCleared(){
  return (progress.grains>=needPerGroup.grains) &&
         (progress.veggies>=needPerGroup.veggies) &&
         (progress.fruits>=needPerGroup.fruits) &&
         (progress.protein>=needPerGroup.protein) &&
         (progress.dairy>=needPerGroup.dairy);
}

function remainText(){
  function one(lbl, got, need){ var left=Math.max(0, need-got); return left>0? (lbl+' '+left):null; }
  var arr=[
    one('ธัญพืช',progress.grains,needPerGroup.grains),
    one('ผัก',   progress.veggies,needPerGroup.veggies),
    one('ผลไม้', progress.fruits, needPerGroup.fruits),
    one('โปรตีน',progress.protein,needPerGroup.protein),
    one('นม',   progress.dairy,  needPerGroup.dairy)
  ];
  var out=[]; for(var i=0;i<arr.length;i++){ if(arr[i]) out.push(arr[i]); }
  return out.length? out.join(' • ') : 'ครบเซ็ตแล้ว!';
}

function updateQuestHUD(){
  emit('hha:quest', { text: 'Plate รอบ '+round+' — เหลือ: '+remainText() });
}

// ---------- Fever ----------
var FEVER=false, FEVER_NEED=10, FEVER_MS=10000, feverTimer=null;
function feverStart(){
  if(FEVER) return;
  FEVER=true; emit('hha:fever',{state:'start', ms:FEVER_MS});
  clearTimeout(feverTimer);
  feverTimer=setTimeout(function(){ feverEnd(); }, FEVER_MS);
}
function feverEnd(){
  if(!FEVER) return;
  FEVER=false; emit('hha:fever',{state:'end'});
  clearTimeout(feverTimer); feverTimer=null;
}

// ---------- target factory ----------
function makeTarget(diff){
  var el  = document.createElement('a-entity');

  // สุ่มว่าจะออกของ "ตามหมู่" หรือ "สิ่งลวง"
  var goodPick = Math.random() > 0.35; // 65% เป็นของดีตามหมู่
  var emo, groupId=null, color='#22c55e';

  if(goodPick){
    // เลือกจากหมู่ที่ "ยังขาด" ให้ถี่ขึ้น
    var weights = [];
    for(var i=0;i<GROUPS.length;i++){
      var g = GROUPS[i];
      var need = needPerGroup[g.id], got = progress[g.id];
      var left = Math.max(0, need - got);
      var w = left>0 ? 3 : 1; // ยังขาด → น้ำหนักมาก
      weights.push({g:g, w:w});
    }
    // weighted pick
    var sum=0; for(var k=0;k<weights.length;k++) sum += weights[k].w;
    var r=Math.random()*sum, acc=0, chosen=weights[0].g;
    for(var t=0;t<weights.length;t++){ acc += weights[t].w; if(r<=acc){ chosen=weights[t].g; break; } }

    groupId = chosen.id;
    emo = chosen.pool[Math.floor(Math.random()*chosen.pool.length)];
    color = chosen.color;
  }else{
    emo = BAITS[Math.floor(Math.random()*BAITS.length)];
    color = '#ef4444';
  }

  var img = document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emo, 200));
  var px = (Math.random()*1.8 - 0.9);   // -0.9..0.9
  var py = (Math.random()*0.9 + 1.1);   // 1.1..2.0
  img.setAttribute('position', px+' '+py+' -1.2');
  img.setAttribute('width',  0.46);
  img.setAttribute('height', 0.46);
  img.classList.add('clickable');
  el.appendChild(img);

  var glow = document.createElement('a-plane');
  glow.setAttribute('width',0.52);
  glow.setAttribute('height',0.52);
  glow.setAttribute('position','0 0 -0.01');
  glow.setAttribute('material','color:'+color+'; opacity:0.22; transparent:true;');
  el.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.addEventListener('click', function(){
    if(!running) return;
    destroy();

    var isGood = (groupId!==null);
    if(isGood){
      // นับความคืบหน้าหมู่
      var before = progress[groupId];
      var need   = needPerGroup[groupId];
      if(before < need) progress[groupId] = before + 1;

      // คะแนน/คอมโบ
      var base = 20 + combo*2;
      var add  = FEVER ? base*2 : base;
      score += add;
      combo += 1; if(combo>maxCombo) maxCombo=combo;
      if(!FEVER && combo>=FEVER_NEED) feverStart();
      popupText('+'+add, px, py, '#c6f6d5');

      updateQuestHUD();
      if(isRoundCleared()){
        // โบนัสจบรอบ
        score += 100; popupText('+100 BONUS', px, py, '#fff3b0');
        updateQuestHUD();
        resetRound();
      }
    }else{
      combo = 0; misses += 1;
      score = Math.max(0, score-15);
      popupText('-15', px, py, '#ffd0d0');
      emit('hha:miss',{count:misses});
    }

    emit('hha:score', {score:score, combo:combo});
  });

  var ttl = 1600; if(diff==='easy') ttl=2000; else if(diff==='hard') ttl=1400;
  setTimeout(function(){
    if(!el.parentNode) return;
    destroy(); misses += 1; combo=0;
    emit('hha:miss',{count:misses});
    emit('hha:score',{score:score, combo:combo});
  }, ttl);

  return el;
}

function spawnLoop(diff){
  if(!running) return;
  host.appendChild(makeTarget(diff));
  var gap = 520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER) gap=Math.max(300, Math.round(gap*0.85));
  spawnTimer=setTimeout(function(){ spawnLoop(diff); }, gap);
}

// ---------- main ----------
export async function boot(cfg){
  host = cfg && cfg.host ? cfg.host : document.getElementById('spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  // reset
  running=true; score=0; combo=0; maxCombo=0; misses=0;
  FEVER=false; clearTimeout(feverTimer); feverTimer=null;
  clearTimeout(spawnTimer); clearInterval(timeTimer);

  // เริ่มรอบแรก
  round=1;
  needPerGroup = { grains:1, veggies:1, fruits:1, protein:1, dairy:1 };
  progress     = { grains:0, veggies:0, fruits:0, protein:0, dairy:0 };

  emit('hha:score',{score:0, combo:0});
  updateQuestHUD();
  emit('hha:fever',{state:'end'});

  // time loop (ฝั่งโหมดยิงเวลา)
  var remain = duration;
  emit('hha:time',{sec:remain});
  timeTimer=setInterval(function(){
    if(!running){ clearInterval(timeTimer); return; }
    remain -= 1; if(remain<0) remain=0;
    emit('hha:time',{sec:remain});
    if(remain<=0){
      clearInterval(timeTimer);
      endGame();
    }
  }, 1000);

  // spawn
  spawnLoop(diff);

  function endGame(){
    running=false;
    clearTimeout(spawnTimer);
    feverEnd();
    // ส่งสรุปผล
    var roundsCleared = round-1; // รอบที่ผ่านสมบูรณ์
    emit('hha:end', {
      title:'Healthy Plate',
      score:score,
      combo:maxCombo,
      misses:misses,
      rounds: roundsCleared
    });
  }

  return {
    stop: function(){ if(!running) return; endGame(); },
    pause: function(){ running=false; },
    resume: function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}
export default { boot };
