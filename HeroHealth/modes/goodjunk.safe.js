// === Good vs Junk — SAFE + FEVER + POWER-UPS (no optional chaining) ===
var running=false, host=null, score=0, combo=0, maxCombo=0, misses=0;
var spawnTimer=null, endTimer=null, powerTimer=null;

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

// ---- Power-ups ----
// ⭐ เปิด FEVER, 🛡 shield, ⏱ time+, ✨ x2 score
var PWR_STAR = '⭐', PWR_SHIELD = '🛡️', PWR_TIME = '⏱️', PWR_X2 = '✨';
var SHIELD_COUNT = 0;
var MULTI_ACTIVE = false, MULTI_TIMER = null;

function powerHud(text){ emit('hha:power', {text:text}); }
function powerHudHide(){ emit('hha:power', {state:'hide'}); }

function giveShield(n){
  SHIELD_COUNT += n;
  powerHud('Shield x'+SHIELD_COUNT);
}
function useShieldIfAny(){
  if(SHIELD_COUNT>0){ SHIELD_COUNT--; powerHud(SHIELD_COUNT>0?('Shield x'+SHIELD_COUNT):'Shield OFF'); if(SHIELD_COUNT===0) powerHudHide(); return true; }
  return false;
}
function startX2(ms){
  if(MULTI_ACTIVE){ clearTimeout(MULTI_TIMER); }
  MULTI_ACTIVE = true;
  powerHud('x2 Score ('+Math.round(ms/1000)+'s)');
  MULTI_TIMER = setTimeout(function(){ MULTI_ACTIVE=false; powerHudHide(); }, ms);
}
function addTime(sec){
  // ส่งสัญญาณเพิ่มเวลาผ่าน hha:time ไม่ได้ (ตัวนับอยู่ในโหมดนี้) → เพิ่ม remain ในสโคป boot()
}

// ---- Target ----
function makeTarget(emoji, good, diff){
  var el = document.createElement('a-entity');

  // วางอิง host (host z=-1.2 แล้ว) → ใช้ z=0
  var px = (Math.random()*1.6 - 0.8);   // -0.8..0.8
  var py = (Math.random()*0.7 + 0.6);   // 0.6..1.3
  el.setAttribute('position', px+' '+py+' 0');

  var img = document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  img.setAttribute('position', '0 0 0');
  img.setAttribute('width', 0.42);
  img.setAttribute('height', 0.42);
  img.classList.add('clickable');
  el.appendChild(img);

  var glow = document.createElement('a-plane');
  glow.setAttribute('width',0.48); glow.setAttribute('height',0.48);
  glow.setAttribute('material','color:'+(good?'#22c55e':'#ef4444')+'; opacity:0.22; transparent:true');
  glow.setAttribute('position','0 0 -0.01');
  el.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.addEventListener('click', function(){
    if(!running) return;
    destroy();

    if(good){
      var base = 20 + combo*2;
      var plus = base;
      if(FEVER_ACTIVE) plus *= 2;
      if(MULTI_ACTIVE) plus *= 2;
      score += plus;
      combo += 1; if(combo>maxCombo) maxCombo = combo;

      if(!FEVER_ACTIVE && combo >= FEVER_COMBO_NEED){ feverStart(); }

      popupText('+'+plus, px, py);
    }else{
      // ชนของไม่ดี → ใช้ Shield ก่อน
      if(useShieldIfAny()){
        popupText('Guard!', px, py, '#a3e635');
      }else{
        combo = 0; misses += 1;
        score = Math.max(0, score - 15);
        popupText('-15', px, py, '#ffb4b4');
        emit('hha:miss', {count:misses});
      }
    }
    emit('hha:score', {score:score, combo:combo});
  });

  // เวลาหมด = พลาด (เช็ค Shield ด้วย)
  var ttl = 1600;
  if(diff==='easy') ttl = 1900; else if(diff==='hard') ttl = 1400;
  setTimeout(function(){
    if(!el.parentNode) return;
    destroy();
    if(useShieldIfAny()){
      popupText('Guard!', px, py, '#a3e635');
    }else{
      misses += 1; combo = 0;
      emit('hha:miss', {count:misses});
      emit('hha:score', {score:score, combo:combo});
    }
  }, ttl);

  return el;
}

// ---- Power-up spawner ----
function makePowerUp(emo, applyFn){
  var el = document.createElement('a-entity');

  // กลางจอช่วงล่าง
  var px = (Math.random()*1.4 - 0.7);
  var py = (Math.random()*0.5 + 0.8);
  el.setAttribute('position', px+' '+py+' 0');

  var img = document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emo, 192));
  img.setAttribute('position','0 0 0');
  img.setAttribute('width',0.46);
  img.setAttribute('height',0.46);
  img.classList.add('clickable');
  el.appendChild(img);

  // แสงวิบวับ
  var glow = document.createElement('a-plane');
  glow.setAttribute('width',0.58); glow.setAttribute('height',0.58);
  glow.setAttribute('material','color:#ffd166; opacity:0.22; transparent:true');
  glow.setAttribute('position','0 0 -0.01');
  el.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.addEventListener('click', function(){
    if(!running) return;
    destroy();
    applyFn(px, py);
  });

  // อยู่ไม่นาน
  setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 3000);
  return el;
}

function powerSpawnLoop(remainGetter, remainSetter){
  if(!running) return;

  // โอกาสมีพาวเวอร์ 1 ชิ้นทุก ๆ 7–11s
  var next = Math.floor(Math.random()*4000)+7000;

  powerTimer = setTimeout(function(){
    if(!running) return;

    var roll = Math.random();
    var node = null;

    if(roll < 0.30){
      // ⭐ FEVER
      node = makePowerUp(PWR_STAR, function(x,y){
        feverStart();
        popupText('FEVER!', x, y, '#ffd166');
        powerHud('FEVER (10s)');
        setTimeout(powerHudHide, 1200);
      });
    }else if(roll < 0.55){
      // 🛡️ Shield
      node = makePowerUp(PWR_SHIELD, function(x,y){
        giveShield(1);
        popupText('Shield +1', x, y, '#a3e635');
      });
    }else if(roll < 0.8){
      // ⏱️ +10s
      node = makePowerUp(PWR_TIME, function(x,y){
        var cur = remainGetter();
        cur += 10; remainSetter(cur);
        emit('hha:time', {sec:cur});
        popupText('+10s', x, y, '#60a5fa');
        powerHud('เวลา +10s');
        setTimeout(powerHudHide, 1000);
      });
    }else{
      // ✨ x2 score
      node = makePowerUp(PWR_X2, function(x,y){
        startX2(8000);
        popupText('x2 Score', x, y, '#f472b6');
      });
    }

    if(node) host.appendChild(node);
    powerSpawnLoop(remainGetter, remainSetter); // loop ต่อ
  }, next);
}

// ---- UI helpers ----
function popupText(txt, x, y, color){
  var t = document.createElement('a-entity');
  t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#ffffff')+'; fontSize:0.09;');
  t.setAttribute('position', x+' '+(y+0.05)+' 0');
  host.appendChild(t);
  t.setAttribute('animation__rise','property: position; to: '+x+' '+(y+0.32)+' 0; dur: 520; easing: ease-out');
  t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 560);
}

// ---- Spawn targets loop ----
function spawnLoop(diff){
  if(!running) return;
  var goodPick = Math.random() > 0.35;
  var emoji = goodPick ? GOOD[Math.floor(Math.random()*GOOD.length)]
                       : JUNK[Math.floor(Math.random()*JUNK.length)];
  host.appendChild(makeTarget(emoji, goodPick, diff));

  var gap = 520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER_ACTIVE) gap = Math.max(300, Math.round(gap*0.85));
  spawnTimer = setTimeout(function(){ spawnLoop(diff); }, gap);
}

// ---- Boot ----
export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  running = true; score=0; combo=0; maxCombo=0; misses=0;
  FEVER_ACTIVE=false; clearTimeout(feverTimer); feverTimer=null;
  SHIELD_COUNT=0; MULTI_ACTIVE=false; if(MULTI_TIMER){ clearTimeout(MULTI_TIMER); MULTI_TIMER=null; }
  if(powerTimer){ clearTimeout(powerTimer); powerTimer=null; }
  powerHudHide();

  emit('hha:score', {score:0, combo:0});
  emit('hha:quest', {text:'Mini Quest — เก็บของดีติดกัน '+FEVER_COMBO_NEED+' ชิ้น เพื่อเปิด FEVER!'});
  emit('hha:fever', {state:'end'});

  // ตัวนับเวลาในโหมด
  var remain = duration; emit('hha:time', {sec:remain});
  function getRemain(){ return remain; }
  function setRemain(v){ remain = v; }

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

  // เริ่มสแปว์น
  spawnLoop(diff);
  // สุ่ม spawn power-ups
  powerSpawnLoop(getRemain, setRemain);

  function endGame(){
    running = false;
    clearTimeout(spawnTimer);
    if(powerTimer) clearTimeout(powerTimer);
    feverEnd();
    MULTI_ACTIVE=false; if(MULTI_TIMER){ clearTimeout(MULTI_TIMER); }
    powerHudHide();
    emit('hha:end', { score:score, combo:maxCombo, misses:misses, title:'Good vs Junk' });
  }

  return {
    stop: function(){ if(!running) return; endGame(); },
    pause: function(){ running=false; },
    resume: function(){ if(!running){ running=true; spawnLoop(diff); powerSpawnLoop(getRemain, setRemain); } }
  };
}
export default { boot };
