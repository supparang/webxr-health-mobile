// === Good vs Junk — SAFE + FEVER (fixed parenting/position + scene-ready delay) ===
var running=false, host=null, score=0, combo=0, maxCombo=0, misses=0;
var spawnTimer=null, endTimer=null;

// ---- Emoji → sprite (dataURL) helper + cache ----
var __emojiCache = {};
function emojiSprite(emo, px){
  var size = px || 128, key = emo+'@'+size;
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

// ---- Target ----
function makeTarget(emoji, good, diff){
  var el = document.createElement('a-entity');

  // วางตำแหน่งที่คอนเทนเนอร์ (ล่าง-กลางจอ)
  var px = (Math.random()*1.6 - 0.8);
  var py = (Math.random()*0.7 + 0.6);
  el.setAttribute('position', px+' '+py+' -3'); // Z = -3 ให้เห็นแน่นอน

  // รูป emoji
  var img = document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  img.setAttribute('width', 0.42);
  img.setAttribute('height', 0.42);
  img.setAttribute('position', '0 0 0');
  img.classList.add('clickable');
  el.appendChild(img);

  // glow ซ้อนใต้รูป (ผูกกับ img เพื่อไม่หลุดตำแหน่ง)
  var glow = document.createElement('a-plane');
  glow.setAttribute('width',0.48); glow.setAttribute('height',0.48);
  glow.setAttribute('material','color:'+(good?'#22c55e':'#ef4444')+'; opacity:0.22; transparent:true');
  glow.setAttribute('position','0 0 -0.01');
  img.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.addEventListener('click', function(){
    if(!running) return;
    destroy();

    if(good){
      var base = 20 + combo*2;
      var plus = FEVER_ACTIVE ? base*2 : base; // x2 ใน Fever
      score += plus;
      combo += 1; if(combo>maxCombo) maxCombo = combo;

      // ปักธง Fever เมื่อถึงคอมโบที่กำหนด
      if(!FEVER_ACTIVE && combo >= FEVER_COMBO_NEED){ feverStart(); }

      // คะแนนเด้ง
      popupText('+'+plus, px, py);
    }else{
      combo = 0; misses += 1;
      score = Math.max(0, score - 15);
      popupText('-15', px, py, '#ffb4b4');
    }

    emit('hha:score', {score:score, combo:combo});
  });

  // เวลาหมด = พลาด
  var ttl = 1600;
  if(diff==='easy') ttl = 1900; else if(diff==='hard') ttl = 1400;
  setTimeout(function(){
    if(!el.parentNode) return;
    destroy(); misses += 1; combo = 0;
    emit('hha:miss', {count:misses}); emit('hha:score', {score:score, combo:combo});
  }, ttl);

  return el;
}

function popupText(txt, x, y, color){
  var t = document.createElement('a-entity');
  t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#ffffff')+'; fontSize:0.09;');
  t.setAttribute('position', x+' '+(y+0.05)+' -2.9');
  host.appendChild(t);
  t.setAttribute('animation__rise','property: position; to: '+x+' '+(y+0.32)+' -2.9; dur: 520; easing: ease-out');
  t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 560);
}

function spawnLoop(diff){
  if(!running) return;
  var goodPick = Math.random() > 0.35;
  var emoji = goodPick ? GOOD[(Math.random()*GOOD.length)|0]
                       : JUNK[(Math.random()*JUNK.length)|0];
  host.appendChild(makeTarget(emoji, goodPick, diff));

  var gap = 520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER_ACTIVE) gap = Math.max(300, (gap*0.85)|0);

  spawnTimer = setTimeout(function(){ spawnLoop(diff); }, gap);
}

export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  // รีเซ็ตสถานะ
  running = true; score=0; combo=0; maxCombo=0; misses=0;
  FEVER_ACTIVE=false; clearTimeout(feverTimer); feverTimer=null;

  // อัปเดต HUD เริ่มต้น
  emit('hha:score', {score:0, combo:0});
  emit('hha:quest', {text:'Mini Quest — เก็บของดีติดกัน '+FEVER_COMBO_NEED+' ชิ้น เพื่อเปิด FEVER!'});
  emit('hha:fever', {state:'end'});

  // นับเวลา
  var remain = duration;
  emit('hha:time', {sec:remain});
  clearInterval(endTimer);
  endTimer = setInterval(function(){
    if(!running){ clearInterval(endTimer); return; }
    remain -= 1; if(remain < 0) remain = 0;
    emit('hha:time', {sec:remain});
    if(remain <= 0){
      clearInterval(endTimer);
      endGame();
    }
  }, 1000);

  // รอ scene พร้อม → เริ่ม spawn หลัง 500ms
  var scene = document.querySelector('a-scene');
  function begin(){ setTimeout(function(){ spawnLoop(diff); }, 500); }
  if(scene && !scene.is('loaded')) scene.addEventListener('loaded', begin);
  else begin();

  function endGame(){
    running = false;
    clearTimeout(spawnTimer);
    feverEnd();
    emit('hha:end', { score:score, combo:maxCombo, misses:misses, title:'Good vs Junk' });
  }

  return {
    stop: function(){ if(!running) return; endGame(); },
    pause: function(){ running=false; },
    resume: function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}
export default { boot };
