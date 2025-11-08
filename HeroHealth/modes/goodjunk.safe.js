// === Good vs Junk — SAFE + FEVER + QUEST + SHARDS (2025-11-06) ===
var running=false, host=null;
var score=0, combo=0, maxCombo=0, misses=0, avoided=0, goodHit=0;
var spawnTimer=null, endTimer=null;

// ---- Emoji → sprite (dataURL) helper + cache ----
var __emojiCache = {};
function emojiSprite(emo, px){
  var size = px || 192, key = emo+'@'+size;
  if(__emojiCache[key]) return __emojiCache[key];
  var c = document.createElement('canvas'); c.width=c.height=size;
  var ctx = c.getContext('2d');
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(size*0.75)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,0.25)'; ctx.shadowBlur=size*0.06;
  ctx.fillText(emo, size/2, size/2);
  __emojiCache[key] = c.toDataURL('image/png');
  return __emojiCache[key];
}
function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail})); }catch(e){} }

// ---- Pools ----
var GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
var JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

// ---- Fever ----
var FEVER_ACTIVE=false;
var FEVER_COMBO_NEED=10;
var FEVER_MS=10000;
var FEVER_LEVEL=0; // 0..100 for gauge
var feverTimer=null;
function feverSet(level, active){
  FEVER_LEVEL = Math.max(0, Math.min(100, Math.round(level)));
  emit('hha:fever',{state:'change', level:FEVER_LEVEL, active:!!FEVER_ACTIVE});
}
function feverStart(){
  if(FEVER_ACTIVE) return;
  FEVER_ACTIVE = true; FEVER_LEVEL = 100;
  emit('hha:fever',{state:'start', ms:FEVER_MS});
  clearTimeout(feverTimer);
  feverTimer = setTimeout(function(){ feverEnd(); }, FEVER_MS);
}
function feverEnd(){
  if(!FEVER_ACTIVE) return;
  FEVER_ACTIVE = false; FEVER_LEVEL = 0;
  emit('hha:fever',{state:'end'});
  clearTimeout(feverTimer); feverTimer=null;
}

// ---- Mini Quest Deck (10 ใบ → สุ่ม 3 ใบต่อเกม) ----
var QUEST_POOL = [
  {id:'good10',  label:'เก็บของดี 10 ชิ้น',        chk:function(s){return s.goodHit>=10;},   prog:function(s){return [s.goodHit,10];}},
  {id:'good20',  label:'เก็บของดี 20 ชิ้น',        chk:function(s){return s.goodHit>=20;},   prog:function(s){return [s.goodHit,20];}},
  {id:'streak10',label:'ทำคอมโบ 10',               chk:function(s){return s.maxCombo>=10;},  prog:function(s){return [s.maxCombo,10];}},
  {id:'streak20',label:'ทำคอมโบ 20',               chk:function(s){return s.maxCombo>=20;},  prog:function(s){return [s.maxCombo,20];}},
  {id:'fever1',  label:'เข้า FEVER 1 ครั้ง',        chk:function(s){return s.fever>=1;},     prog:function(s){return [s.fever,1];}},
  {id:'fever2',  label:'เข้า FEVER 2 ครั้ง',        chk:function(s){return s.fever>=2;},     prog:function(s){return [s.fever,2];}},
  {id:'avoid6',  label:'หลีกขยะ 6 ครั้ง',           chk:function(s){return s.avoided>=6;},   prog:function(s){return [s.avoided,6];}},
  {id:'avoid12', label:'หลีกขยะ 12 ครั้ง',          chk:function(s){return s.avoided>=12;},  prog:function(s){return [s.avoided,12];}},
  {id:'score500',label:'ทำคะแนน 500+',              chk:function(s){return s.score>=500;},   prog:function(s){return [s.score,500];}},
  {id:'score1000',label:'ทำคะแนน 1000+',            chk:function(s){return s.score>=1000;},  prog:function(s){return [s.score,1000];}}
];
var quests=[], qIndex=0;
function pick3(){
  var pool = QUEST_POOL.slice();
  quests = [];
  for(var i=0;i<3;i++){
    var k = Math.floor(Math.random()*pool.length);
    quests.push(pool.splice(k,1)[0]);
  }
  qIndex = 0; showQuest();
}
function stats(){
  return {goodHit:goodHit, maxCombo:maxCombo, fever:FEVER_COUNT, avoided:avoided, score:score};
}
function showQuest(){
  if(!quests[qIndex]) return emit('hha:quest',{text:'Mini Quest — เคลียร์ครบ 3 ใบ!'});
  var p = quests[qIndex].prog(stats()); var txt = 'Mini Quest — '+quests[qIndex].label;
  if(p && p.length===2) txt += ' ('+Math.min(p[0],p[1])+'/'+p[1]+')';
  emit('hha:quest',{text:txt});
}
function checkQuest(){
  if(!quests[qIndex]) return;
  if(quests[qIndex].chk(stats())){
    qIndex++;
    if(qIndex>=3){ emit('hha:quest',{text:'Mini Quest — สำเร็จครบ 3 ใบ!'}); }
    else{ showQuest(); }
  }else{ showQuest(); }
}
var FEVER_COUNT=0;

// ---- Shards FX (แตกกระจาย) ----
function explodeShards(px, py, kind){
  // สี/จำนวน/ความเร็วต่างกันตาม kind + ความยาก
  var col = '#22c55e', n=10, dur=420;
  if(kind==='junk'){ col='#ef4444'; n=12; dur=520; }
  if(kind==='fever'){ col='#ffb703'; n=16; dur=560; }
  var root = document.createElement('a-entity');
  root.setAttribute('position', px+' '+py+' -1.2');
  for(var i=0;i<n;i++){
    var p = document.createElement('a-plane');
    p.setAttribute('width', 0.04); p.setAttribute('height', 0.08);
    p.setAttribute('material','color:'+col+'; opacity:0.92; side:double;');
    var ang = Math.random()*Math.PI*2;
    var r = 0.25+Math.random()*0.45;
    var toX = (Math.cos(ang)*r).toFixed(3);
    var toY = (Math.sin(ang)*r).toFixed(3);
    p.setAttribute('animation__fly','property: position; to: '+toX+' '+toY+' 0; dur:'+dur+'; easing:ease-out');
    p.setAttribute('animation__fade','property: material.opacity; to: 0; dur:'+(dur-80)+'; delay:80');
    root.appendChild(p);
  }
  host.appendChild(root);
  setTimeout(function(){ if(root.parentNode) root.parentNode.removeChild(root); }, 700);
}

// ---- Target ----
function makeTarget(emoji, isGood, diff){
  var el = document.createElement('a-entity');

  var img = document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  var px = (Math.random()*1.6 - 0.8);
  var py = (Math.random()*0.7 + 0.6);
  img.setAttribute('position', px+' '+py+' -1.2');
  img.setAttribute('width', 0.42);
  img.setAttribute('height', 0.42);
  el.appendChild(img);

  var glow = document.createElement('a-plane');
  glow.setAttribute('width',0.48); glow.setAttribute('height',0.48);
  glow.setAttribute('material','color:'+(isGood?'#22c55e':'#ef4444')+'; opacity:0.22; transparent:true');
  glow.setAttribute('position','0 0 -0.01');
  el.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.classList.add('clickable');
  img.addEventListener('click', function(){
    if(!running) return;
    destroy();

    if(isGood){
      // คะแนนพื้นฐาน + คอมโบ + fever x2
      var base = 20 + combo*2;
      var plus = FEVER_ACTIVE ? base*2 : base;
      score += plus;
      combo += 1; if(combo>maxCombo) maxCombo = combo;
      goodHit += 1;
      popupText('+'+plus, px, py, '#d1f0ff');
      explodeShards(px, py, FEVER_ACTIVE?'fever':'good');

      // เปิด Fever เมื่อถึงคอมโบที่กำหนด
      if(!FEVER_ACTIVE && combo >= FEVER_COMBO_NEED){
        feverStart(); FEVER_COUNT += 1; checkQuest();
      }
    }else{
      // ชนของขยะ: คอมโบตก คะแนน -15 (ไม่ปิด FEVER)
      combo = 0; misses += 1;
      score = Math.max(0, score - 15);
      popupText('-15', px, py, '#ffb4b4');
      explodeShards(px, py, 'junk');
    }

    emit('hha:score', {score:score, combo:combo});
    checkQuest();
  });

  // เวลาหมด (พลาด/เลี่ยง)
  var ttl = 1600; if(diff==='easy') ttl = 1900; else if(diff==='hard') ttl = 1400;
  setTimeout(function(){
    if(!el.parentNode || !running) return;
    destroy();

    if(isGood){
      // บทลงโทษของดีหายเอง
      var penalty = (diff==='easy')?10:(diff==='hard')?20:15;
      score = Math.max(0, score - penalty);
      misses += 1; combo = 0;
      popupText('-'+penalty, px, py, '#ff8b8b');
      explodeShards(px, py, 'junk');
      emit('hha:miss', { count: misses });
      emit('hha:score', { score: score, combo: combo });
    }else{
      // เลี่ยงขยะสำเร็จ
      avoided += 1;
      var plus = 5; score += plus;
      popupText('เลี่ยงขยะ +'+plus, px, py, '#8be9fd');
      explodeShards(px, py, 'good');
      emit('hha:score', { score: score, combo: combo });
      checkQuest();
    }
  }, ttl);

  return el;
}

function popupText(txt, x, y, color){
  var t = document.createElement('a-entity');
  t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#ffffff')+'; fontSize:0.09;');
  t.setAttribute('position', x+' '+(y+0.05)+' -1.18');
  host.appendChild(t);
  t.setAttribute('animation__rise','property: position; to: '+x+' '+(y+0.32)+' -1.18; dur: 520; easing: ease-out');
  t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 560);
}

function spawnLoop(diff){
  if(!running) return;
  var isGood = Math.random() > 0.35;
  var emoji = isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
  host.appendChild(makeTarget(emoji, isGood, diff));

  var gap = 520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER_ACTIVE) gap = Math.max(300, Math.round(gap*0.85));
  spawnTimer = setTimeout(function(){ spawnLoop(diff); }, gap);
}

export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  running = true; score=0; combo=0; maxCombo=0; misses=0; avoided=0; goodHit=0; FEVER_COUNT=0;
  FEVER_ACTIVE=false; clearTimeout(feverTimer); feverTimer=null; feverSet(0,false);

  // สุ่ม Mini Quest 3 ใบ
  pick3(); showQuest();

  emit('hha:score', {score:0, combo:0});
  emit('hha:fever', {state:'end'});

  // นับเวลา
  var remain = duration;
  emit('hha:time', {sec:remain});
  clearInterval(endTimer);
  endTimer = setInterval(function(){
    if(!running){ clearInterval(endTimer); return; }
    remain -= 1; if(remain < 0) remain = 0;
    // ค่อยๆ ลดเกจ ถ้าไม่ได้อยู่ใน FEVER
    if(!FEVER_ACTIVE && FEVER_LEVEL>0){ feverSet(FEVER_LEVEL-4,false); }
    emit('hha:time', {sec:remain});
    if(remain <= 0){
      clearInterval(endTimer);
      endGame();
    }
  }, 1000);

  // เริ่ม spawn
  spawnLoop(diff);

  function endGame(){
    running = false;
    clearTimeout(spawnTimer);
    feverEnd();
    checkQuest();
    emit('hha:end', { score:score, combo:maxCombo, misses:misses, title:'Good vs Junk' });
  }

  return {
    stop: function(){ if(!running) return; endGame(); },
    pause: function(){ running=false; },
    resume: function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}
export default { boot };
