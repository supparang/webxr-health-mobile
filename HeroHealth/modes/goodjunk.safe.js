// === Good vs Junk — SAFE + FEVER + AVOID-JUNK (2025-11-06) ===
var running=false, host=null, score=0, combo=0, maxCombo=0;
var misses=0, avoided=0;                 // <-- เลี่ยงขยะ
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
var feverTimer=null;

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

// ---- FX: shards ----
function explodeShards(x, y, kind){
  // kind: 'good' | 'junk' | 'fever'
  var n = (kind==='fever')?16:(kind==='good'?12:8);
  var color = (kind==='fever')? '#ffd166' : (kind==='good'? '#37d67a' : '#ef4444');
  for(var i=0;i<n;i++){
    var p = document.createElement('a-plane');
    p.setAttribute('width',0.06); p.setAttribute('height',0.12);
    p.setAttribute('material','color:'+color+'; opacity:0.95; side:double; transparent:true');
    p.setAttribute('position', x+' '+y+' -1.18');
    var dx=(Math.random()*2-1)*0.6, dy=(Math.random()*2-1)*0.6;
    var dur = (kind==='fever'? 520 : (kind==='good'? 620 : 740));
    p.setAttribute('animation__fly','property: position; to: '+(x+dx)+' '+(y+dy+0.6)+' -1.18; dur:'+dur+'; easing: ease-out');
    p.setAttribute('animation__fade','property: material.opacity; to: 0; dur:'+(dur-80)+'; easing: linear');
    host.appendChild(p);
    (function(el){ setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, dur+40); })(p);
  }
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

// ---- Target ----
function makeTarget(emoji, isGood, diff){
  var el = document.createElement('a-entity');

  var img = document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  // ล่าง-กลางจอ (กระจายแนวนอนเล็กน้อย)
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
      var base = 20 + combo*2;
      var plus = FEVER_ACTIVE ? base*2 : base; // x2 ใน Fever
      score += plus;
      combo += 1; if(combo>maxCombo) maxCombo = combo;

      // ปักธง Fever เมื่อถึงคอมโบที่กำหนด
      if(!FEVER_ACTIVE && combo >= FEVER_COMBO_NEED){ feverStart(); }

      popupText('+'+plus, px, py, '#baffc9');
      explodeShards(px, py, FEVER_ACTIVE?'fever':'good');
    }else{
      // ชนของไม่ดี: คอมโบตก, หักคะแนน แต่ถ้าอยู่ใน Fever ก็ไม่ยกเลิก Fever
      combo = 0;
      score = Math.max(0, score - 15);
      popupText('-15', px, py, '#ffb4b4');
      explodeShards(px, py, 'junk');
    }

    emit('hha:score', {score:score, combo:combo});
  });

  // เวลาหมด
  var ttl = 1600;
  if(diff==='easy') ttl = 1900; else if(diff==='hard') ttl = 1400;
  setTimeout(function(){
    if(!el.parentNode || !running) return;
    destroy();

    if(isGood){
      // ของดีหายไป = พลาด
      misses += 1; combo = 0;
      emit('hha:miss', {count:misses});
      emit('hha:score', {score:score, combo:combo});
    }else{
      // ขยะหายไปเอง = เลี่ยงสำเร็จ (ตามที่ขอ)
      avoided += 1;
      var plus = 5; // โบนัสเล็กน้อย
      score += plus;
      popupText('เลี่ยงขยะ +'+plus, px, py, '#8be9fd');
      explodeShards(px, py, 'good'); // ใช้สีฟ้า/เขียวเบา ๆ
      // ไม่แตะคอมโบ, ไม่ยุ่ง Fever
      emit('hha:quest', {text:'Mini Quest — เก็บของดีติดกัน '+FEVER_COMBO_NEED+' ชิ้น เพื่อเปิด FEVER! | เลี่ยงขยะ: '+avoided});
      emit('hha:score', {score:score, combo:combo});
    }
  }, ttl);

  return el;
}

function spawnLoop(diff){
  if(!running) return;
  var pickGood = Math.random() < 0.65; // สัดส่วนของดี
  var emoji = pickGood ? GOOD[(Math.random()*GOOD.length)|0]
                       : JUNK[(Math.random()*JUNK.length)|0];
  host.appendChild(makeTarget(emoji, pickGood, diff));

  var gap = 520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  // ระหว่าง Fever เร็วขึ้นเล็กน้อย
  if(FEVER_ACTIVE) gap = Math.max(300, Math.round(gap*0.85));

  spawnTimer = setTimeout(function(){ spawnLoop(diff); }, gap);
}

// ---- Boot ----
export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  running = true; score=0; combo=0; maxCombo=0; misses=0; avoided=0;
  FEVER_ACTIVE=false; clearTimeout(feverTimer); feverTimer=null;

  emit('hha:score', {score:0, combo:0});
  emit('hha:quest', {text:'Mini Quest — เก็บของดีติดกัน '+FEVER_COMBO_NEED+' ชิ้น เพื่อเปิด FEVER! | เลี่ยงขยะ: 0'});
  emit('hha:fever', {state:'end'}); // reset HUD

  // นับเวลาฝั่งโหมด
  var remain = duration;
  emit('hha:time', {sec:remain});
  clearInterval(endTimer);
  endTimer = setInterval(function(){
    if(!running){ clearInterval(endTimer); return; }
    remain -= 1; if(remain < 0) remain = 0;
    emit('hha:time', {sec:remain});
    if(remain <= 0){
      clearInterval(endTimer);
      endGame('timeout');
    }
  }, 1000);

  // สแปว์นเป้าลูกแรกทันที
  spawnLoop(diff);

  function endGame(reason){
    running = false;
    clearTimeout(spawnTimer);
    feverEnd();
    emit('hha:end', { score:score, combo:maxCombo, misses:misses, avoided:avoided, title:'Good vs Junk', reason:reason||'done' });
  }

  return {
    stop: function(){ if(!running) return; endGame('quit'); },
    pause: function(){ running=false; },
    resume: function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}
export default { boot };
