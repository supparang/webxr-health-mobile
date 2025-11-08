// === Good vs Junk — SAFE + FEVER (centered spawn y=1.0, no optional chaining) ===
var running=false, host=null, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
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
var FEVER_MS=10000;
var feverTimer=null;
var feverLevel=0;   // 0..100
var feverNeed=100;  // เกณฑ์เริ่ม
function feverEmit(state){
  emit('hha:fever',{state:state, level:feverLevel, active:FEVER_ACTIVE});
}
function feverStart(){
  if(FEVER_ACTIVE) return;
  FEVER_ACTIVE = true;
  feverLevel = 100;
  feverEmit('start');
  clearTimeout(feverTimer);
  feverTimer = setTimeout(function(){ feverEnd(); }, FEVER_MS);
}
function feverEnd(){
  if(!FEVER_ACTIVE) return;
  FEVER_ACTIVE = false;
  feverLevel = 0;
  feverEmit('end');
  clearTimeout(feverTimer); feverTimer=null;
}
function feverGain(v){
  feverLevel = Math.max(0, Math.min(100, feverLevel + v));
  feverEmit('change');
  if(!FEVER_ACTIVE && feverLevel>=feverNeed) feverStart();
}

// ---- Target ----
function makeTarget(emoji, good, diff){
  var wrap = document.createElement('a-entity');

  var img = document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  // สุ่มภายในกรอบรอบ ๆ host (host อยู่ที่ y=1.0 แล้ว)
  var px = (Math.random()*1.6 - 0.8);
  var py = (Math.random()*0.5 - 0.25); // local y จาก host → กลางจอ
  img.setAttribute('position', px+' '+py+' 0');
  img.setAttribute('width', 0.42);
  img.setAttribute('height', 0.42);
  wrap.appendChild(img);

  var glow = document.createElement('a-plane');
  glow.setAttribute('width',0.48); glow.setAttribute('height',0.48);
  glow.setAttribute('material','color:'+(good?'#22c55e':'#ef4444')+'; opacity:0.22; transparent:true');
  glow.setAttribute('position','0 0 -0.01');
  wrap.appendChild(glow);

  function cleanup(){ if(wrap.parentNode) wrap.parentNode.removeChild(wrap); }

  img.classList.add('clickable');
  img.addEventListener('click', function(){
    if(!running) return;
    cleanup(); spawns++; hits++;

    if(good){
      var base = 20 + combo*2;
      var plus = FEVER_ACTIVE ? base*2 : base; // x2 เมื่อ Fever
      score += plus;
      combo += 1; if(combo>maxCombo) maxCombo = combo;
      feverGain(12); // เพิ่มเกจเมื่อเก็บของดี
      popupText('+'+plus, px, py);
    }else{
      // ชนน้ำตาล/จังค์ → บทลงโทษเล็กน้อย และลดเกจ
      combo = 0; misses += 1;
      score = Math.max(0, score - 15);
      feverGain(-18);
      popupText('-15', px, py, '#ffb4b4');
    }

    emit('hha:score', {score:score, combo:combo});
  });

  // เวลาหมด = พลาดเฉพาะ "ของดี" / ของจังค์ปล่อยผ่าน (ไม่นับโทษ)
  var ttl = 1600;
  if(diff==='easy') ttl = 1900; else if(diff==='hard') ttl = 1400;
  setTimeout(function(){
    if(!wrap.parentNode) return;
    cleanup(); spawns++;
    if(good){
      misses += 1; combo = 0; feverGain(-12);
      emit('hha:miss', {count:misses});
      emit('hha:score', {score:score, combo:combo});
    }
  }, ttl);

  return wrap;
}

function popupText(txt, lx, ly, color){
  try{
    // world pos: host (0,1.0,-1.6) + local (lx,ly,0)
    var wx = lx, wy = 1.0 + ly, wz = -1.6 + 0.02;
    var t = document.createElement('a-entity');
    t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#ffffff')+'; fontSize:0.09; anchor:center;');
    t.setAttribute('position', wx+' '+(wy+0.05)+' '+wz);
    host.appendChild(t);
    t.setAttribute('animation__rise','property: position; to: '+wx+' '+(wy+0.32)+' '+wz+'; dur: 520; easing: ease-out');
    t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 560);
  }catch(e){}
}

function spawnLoop(diff){
  if(!running) return;
  var goodPick = Math.random() > 0.35;
  var emoji = goodPick ? GOOD[(Math.random()*GOOD.length)|0]
                       : JUNK[(Math.random()*JUNK.length)|0];
  host.appendChild(makeTarget(emoji, goodPick, diff));

  var gap = 520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER_ACTIVE) gap = Math.max(300, Math.round(gap*0.85));
  spawnTimer = setTimeout(function(){ spawnLoop(diff); }, gap);
}

export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  // จัด host ให้อยู่กึ่งกลางจอจริง ๆ
  try{ host.setAttribute('position','0 1.0 -1.6'); }catch(e){}
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  running = true; score=0; combo=0; maxCombo=0; misses=0; hits=0; spawns=0;
  FEVER_ACTIVE=false; clearTimeout(feverTimer); feverTimer=null; feverLevel=0; feverEmit('change');

  emit('hha:score', {score:0, combo:0});
  emit('hha:quest', {text:'Mini Quest — เก็บของดีติดกันเพื่อเข้า FEVER!'});
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
      endGame();
    }
  }, 1000);

  // เริ่มสแปว์น
  spawnLoop(diff);

  function endGame(){
    running = false;
    clearTimeout(spawnTimer);
    feverEnd();
    emit('hha:end', {
      title:'Good vs Junk',
      difficulty: diff,
      duration: duration,
      score: score,
      combo: maxCombo,
      misses: misses,
      hits: hits,
      spawns: spawns,
      questsCleared: 0,
      questsTotal: 3
    });
  }

  return {
    stop: function(){ if(!running) return; endGame(); },
    pause: function(){ running=false; },
    resume: function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}
export default { boot };
