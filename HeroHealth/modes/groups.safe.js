// === Food Groups — SAFE (no optional chaining) ===
// โหมด: เลือกอาหารให้ตรง "หมวด" ตามเป้าหมายของรอบ (1–3 รายการ)
// - คลิกของถูกหมวดได้คะแนน + คอมโบ
// - ของผิดหมวดยกเลิกคอมโบและนับพลาด
// - ครบเป้าหมายของรอบ → รับโบนัส และสุ่มเป้าหมายรอบใหม่ทันที

var running=false, host=null;
var score=0, combo=0, maxCombo=0, misses=0;
var spawnTimer=null, endTimer=null;

// ---------- Emoji → sprite (canvas DataURL) ----------
var __emojiCache = {};
function emojiSprite(emo, px){
  var size = px || 160, key = emo+'@'+size;
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

// ---------- หมวดอาหาร & รายการ ----------
var CATS = ['ผัก','โปรตีน','ธัญพืช','นม','ผลไม้'];
var POOL = {
  'ผัก'   : ['🥦','🥬','🥕','🍅','🌽','🧄','🧅','🥒'],
  'โปรตีน': ['🐟','🍗','🥚','🥩','🫘','🧀'],
  'ธัญพืช': ['🍞','🥖','🥨','🍚','🍜','🍝','🥯'],
  'นม'    : ['🥛','🧈','🍦','🍨'],
  'ผลไม้' : ['🍎','🍊','🍌','🍓','🍇','🍍','🥝','🍐','🍑','🍉']
};
// reverse map emoji -> cat
var EMO2CAT = (function(){
  var m={}; 
  for(var k in POOL){ 
    var arr = POOL[k]; 
    for(var i=0;i<arr.length;i++){ m[arr[i]] = k; }
  }
  return m;
})();

// ---------- รอบเป้าหมาย ----------
var roundNeed = {};   // {หมวด: จำนวน}
var roundDone = {};   // {หมวด: เก็บแล้ว}
function rnd(n,a){ return Math.floor(Math.random()* (a-n+1)) + n; }

function newRound(diff){
  roundNeed = {}; roundDone = {};
  // จำนวนหมวดเป้าหมาย 1–3 ตามความยาก
  var k = 1; if(diff==='normal') k = 2; if(diff==='hard') k = 3;
  var cats = CATS.slice().sort(function(){return Math.random()-0.5;}).slice(0,k);
  for(var i=0;i<cats.length;i++){
    var need = 1; 
    if(diff==='normal') need = rnd(1,2); 
    if(diff==='hard')   need = rnd(2,3);
    roundNeed[cats[i]] = need;
    roundDone[cats[i]] = 0;
  }
  updateQuestText();
}

function updateQuestText(){
  var parts=[], k;
  for(k in roundNeed){
    var left = Math.max(0, roundNeed[k] - (roundDone[k]||0));
    parts.push(k+' ×'+left);
  }
  var txt = parts.length? ('Goal: '+parts.join(' , ')) : 'Goal: —';
  emit('hha:quest', { text: 'กลุ่มอาหาร — '+txt });
}

function isRoundCompleted(){
  var k;
  for(k in roundNeed){
    if((roundDone[k]||0) < roundNeed[k]) return false;
  }
  return true;
}

// ---------- UI helpers ----------
function popupText(txt, x, y, color){
  var t = document.createElement('a-entity');
  t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#ffffff')+'; fontSize:0.09;');
  t.setAttribute('position', x+' '+(y+0.05)+' -1.18');
  host.appendChild(t);
  t.setAttribute('animation__rise','property: position; to: '+x+' '+(y+0.32)+' -1.18; dur: 520; easing: ease-out');
  t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 560);
}

// ---------- เป้า ----------
function makeTarget(emoji, diff){
  var cat = EMO2CAT[emoji] || 'อื่นๆ';
  var el  = document.createElement('a-entity');

  var img = document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  var px = (Math.random()*1.6 - 0.8);       // -0.8..0.8
  var py = (Math.random()*0.7 + 0.6);       // 0.6..1.3
  img.setAttribute('position', px+' '+py+' -1.2');
  img.setAttribute('width', 0.42);
  img.setAttribute('height', 0.42);
  img.classList.add('clickable');
  el.appendChild(img);

  var glow = document.createElement('a-plane');
  glow.setAttribute('width',0.48); glow.setAttribute('height',0.48);
  glow.setAttribute('material','color:#60a5fa; opacity:0.18; transparent:true');
  glow.setAttribute('position','0 0 -0.01');
  el.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.addEventListener('click', function(){
    if(!running) return;
    // ถูกหมวดที่ต้องการและยังไม่ครบ
    var need = roundNeed[cat];
    var done = roundDone[cat]||0;

    if(need && done < need){
      roundDone[cat] = done+1;
      var base = 30 + combo*3;
      score += base; combo += 1; if(combo>maxCombo) maxCombo = combo;
      popupText('+'+base+' ('+cat+')', px, py, '#bff7bf');
      updateQuestText();

      if(isRoundCompleted()){
        // โบนัสรอบ
        var bonus = 80 + combo*2;
        score += bonus;
        popupText('BONUS +'+bonus, px, py+0.15, '#ffe08a');
        newRound(diff);
      }
    }else{
      // ผิดหมวด หรือหมวดนั้นครบแล้ว → โทษ
      combo = 0; misses += 1;
      score = Math.max(0, score-20);
      popupText('-20', px, py, '#ffb4b4');
    }

    emit('hha:score', {score:score, combo:combo});
    emit('hha:miss',  {count:misses});
    destroy();
  });

  // หมดเวลาเป้า → พลาด
  var ttl = 1700; if(diff==='easy') ttl = 2000; if(diff==='hard') ttl = 1400;
  setTimeout(function(){
    if(!el.parentNode) return;
    destroy(); misses += 1; combo = 0;
    emit('hha:score', {score:score, combo:combo});
    emit('hha:miss',  {count:misses});
  }, ttl);

  return el;
}

function spawnLoop(diff){
  if(!running) return;
  // เลือกหมวดที่อยู่ใน roundNeed บ่อยขึ้น
  var poolEmo = [];
  var k, i, arr;
  for(k in POOL){
    arr = POOL[k];
    var weight = roundNeed[k]? 2 : 1;   // ถ้าเป็นหมวดเป้าให้โอกาสออกมากขึ้น
    for(i=0;i<arr.length;i++){
      for(var w=0; w<weight; w++) poolEmo.push(arr[i]);
    }
  }
  var emoji = poolEmo[Math.floor(Math.random()*poolEmo.length)];
  host.appendChild(makeTarget(emoji, diff));

  var gap = 520; if(diff==='easy') gap=650; if(diff==='hard') gap=420;
  spawnTimer = setTimeout(function(){ spawnLoop(diff); }, gap);
}

// ---------- Boot ----------
export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  // reset
  running = true; score=0; combo=0; maxCombo=0; misses=0;
  emit('hha:score', {score:0, combo:0});
  emit('hha:miss',  {count:0});

  newRound(diff);

  // ตัวจับเวลาหลัก (ฝั่งโหมด)
  var remain = duration;
  emit('hha:time', {sec:remain});
  clearInterval(endTimer);
  endTimer = setInterval(function(){
    if(!running){ clearInterval(endTimer); return; }
    remain -= 1; if(remain<0) remain=0;
    emit('hha:time', {sec:remain});
    if(remain<=0){
      clearInterval(endTimer);
      endGame();
    }
  }, 1000);

  // เริ่มสแปว์น
  spawnLoop(diff);

  function endGame(){
    running = false;
    try{ clearTimeout(spawnTimer); }catch(e){}
    emit('hha:end', { score:score, combo:maxCombo, misses:misses, title:'Food Groups' });
  }

  return {
    stop:   function(){ if(!running) return; endGame(); },
    pause:  function(){ running=false; },
    resume: function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}
export default { boot };
