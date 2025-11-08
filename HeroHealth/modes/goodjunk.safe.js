// === Good vs Junk — SAFE build (A-Frame + Canvas Emoji) =====================
// คุณสมบัติ
// - เป้าเป็นอีโมจิสีจริง เรนเดอร์ด้วย <canvas> → ใช้เป็น texture ของ <a-image>
// - Mini Quest: "เก็บของดี หรือ เลี่ยงขยะ รวม 10 ชิ้น" → เปิด FEVER
// - เลี่ยงขยะ (ปล่อยให้หายเอง) ได้คะแนน, ไม่หักคอมโบ, นับเควสต์
// - เอฟเฟกต์แตก (shatter) ปรับจำนวน/สี/ความเร็วตาม ?mode=
// - ปลอดภัย: ไม่มี optional chaining, ล้าง timer/node ตอนจบ

var running=false, host=null, score=0, combo=0, maxCombo=0, misses=0;
var spawnTimer=null, endTimer=null;

// ---------- util ----------
function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail})); }catch(e){} }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function getParam(name, def){
  try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
}

// ---------- Emoji → image (cache) ----------
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

// ---------- Pools ----------
var GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
var JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

// ---------- FEVER ----------
var FEVER_ACTIVE=false;
var FEVER_COMBO_NEED=10;   // (ยังเก็บไว้ใช้ในอนาคต ถ้าจะปลดด้วยคอมโบ)
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

// ---------- Per-mode shard theme ----------
var MODE = (getParam('mode','goodjunk')||'goodjunk').toLowerCase();
var SHARD_THEME = {
  goodjunk : { good:{n:12, dur:420, color:'#a7f3d0'}, junk:{n:10, dur:360, color:'#fecaca'} },
  groups   : { good:{n:14, dur:460, color:'#93c5fd'}, junk:{n:10, dur:380, color:'#fde68a'} },
  hydration: { good:{n:16, dur:520, color:'#a5f3fc'}, junk:{n:10, dur:420, color:'#fca5a5'} },
  plate    : { good:{n:12, dur:440, color:'#86efac'}, junk:{n:10, dur:380, color:'#fda4af'} }
}[MODE] || { good:{n:12, dur:420, color:'#a7f3d0'}, junk:{n:10, dur:360, color:'#fecaca'} };

// ---------- Mini Quest (รวมเก็บดี + เลี่ยงขยะ) ----------
var questTarget = 10;
var questProgress = 0;
var questDone = false;
function updateQuestHUD(){
  var txt = questDone
    ? 'Mini Quest — สำเร็จ! FEVER กำลังทำงาน…'
    : 'Mini Quest — เก็บของดีหรือเลี่ยงขยะรวม '+questTarget+' ชิ้น เพื่อเปิด FEVER!';
  emit('hha:quest', {text: txt});
}

// ---------- HUD pop text ----------
function popupText(txt, x, y, color){
  var t = document.createElement('a-entity');
  t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#ffffff')+'; fontSize:0.09;');
  t.setAttribute('position', x+' '+(y+0.05)+' -1.18');
  host.appendChild(t);
  t.setAttribute('animation__rise','property: position; to: '+x+' '+(y+0.32)+' -1.18; dur: 520; easing: ease-out');
  t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 560);
}

// ---------- Shatter (แตกกระจาย) ----------
function shatter(x, y, color, count, dur){
  var root = document.createElement('a-entity');
  root.setAttribute('position', x+' '+y+' -1.2');
  count = count || 10; dur = dur || 420;
  for (var i=0;i<count;i++){
    var p = document.createElement('a-plane');
    p.setAttribute('width', 0.055);
    p.setAttribute('height',0.055);
    p.setAttribute('material','color:'+(color||'#ffffff')+'; opacity:0.95; side:double');
    var dx = (Math.random()*0.9 - 0.45);
    var dy = (Math.random()*0.9 - 0.45);
    p.setAttribute('animation__move','property: position; to: '+(x+dx)+' '+(y+dy)+' -1.28; dur: '+dur+'; easing: ease-out');
    p.setAttribute('animation__fade','property: material.opacity; to: 0; dur: '+dur+'; easing: linear');
    root.appendChild(p);
  }
  host.appendChild(root);
  setTimeout(function(){ if(root.parentNode) root.parentNode.removeChild(root); }, dur+40);
}

// ---------- Target ----------
function makeTarget(emoji, good, diff){
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
  glow.setAttribute('material','color:'+(good?'#22c55e':'#ef4444')+'; opacity:0.22; transparent:true');
  glow.setAttribute('position','0 0 -0.01');
  el.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.classList.add('clickable');
  img.addEventListener('click', function(){
    if(!running) return;
    destroy();

    if(good){
      var base = 20 + combo*2;
      var plus = FEVER_ACTIVE ? base*2 : base;
      score += plus;
      combo += 1; if(combo>maxCombo) maxCombo = combo;

      // เควสต์: เก็บของดี → เดินหน้า
      if (!questDone){
        questProgress += 1;
        if (questProgress >= questTarget){ questDone = true; feverStart(); }
        updateQuestHUD();
      }

      popupText('+'+plus, px, py);
      shatter(px, py, SHARD_THEME.good.color, SHARD_THEME.good.n, SHARD_THEME.good.dur);
    }else{
      combo = 0; misses += 1;
      score = Math.max(0, score - 15);
      // ตีโดนขยะ: ไม่ลด questProgress
      popupText('-15', px, py, '#ffb4b4');
      shatter(px, py, SHARD_THEME.junk.color, SHARD_THEME.junk.n, SHARD_THEME.junk.dur);
    }

    emit('hha:score', {score:score, combo:combo});
  });

  // เวลาหมด = เลี่ยง/พลาด ตามประเภท
  var ttl = 1600;
  if(diff==='easy') ttl = 1900; else if(diff==='hard') ttl = 1400;

  setTimeout(function(){
    if(!el.parentNode || !running) return;
    destroy();

    if(good){
      // พลาดของดีจริง ๆ
      misses += 1; combo = 0;
      popupText('MISS', px, py, '#ffb4b4');
    } else {
      // เลี่ยงขยะสำเร็จ → ได้คะแนน + นับเควสต์
      var avoidPlus = FEVER_ACTIVE ? 12 : 8;
      score += avoidPlus;
      popupText('+'+avoidPlus, px, py, '#b9ffcb');

      if (!questDone){
        questProgress += 1;
        if (questProgress >= questTarget){ questDone = true; feverStart(); }
        updateQuestHUD();
      }
    }
    emit('hha:score', {score:score, combo:combo});
  }, ttl);

  return el;
}

// ---------- Spawn loop ----------
function spawnLoop(diff){
  if(!running) return;

  // ช่วงยังไม่จบเควสต์ → เพิ่มโอกาสของดี
  var preferGood = (!FEVER_ACTIVE && !questDone) ? 0.72 : 0.65;
  var goodPick = Math.random() < preferGood;

  var emoji = goodPick ? GOOD[(Math.random()*GOOD.length)|0]
                       : JUNK[(Math.random()*JUNK.length)|0];
  host.appendChild(makeTarget(emoji, goodPick, diff));

  var gap = 520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER_ACTIVE) gap = Math.max(300, Math.round(gap*0.85));

  spawnTimer = setTimeout(function(){ spawnLoop(diff); }, gap);
}

// ---------- Boot ----------
export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  running = true; score=0; combo=0; maxCombo=0; misses=0;
  FEVER_ACTIVE=false; clearTimeout(feverTimer); feverTimer=null;
  questProgress=0; questDone=false;

  emit('hha:score', {score:0, combo:0});
  updateQuestHUD();
  emit('hha:fever', {state:'end'}); // reset HUD fever

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

  // เริ่มสแปว์น
  // ปักก้อนแรกทันทีกลาง ๆ (ให้ผู้เล่นเห็นแน่)
  spawnLoop(diff);

  function endGame(reason){
    running = false;
    clearTimeout(spawnTimer);
    feverEnd();
    try{
      // ลบลูกเป้า/FX ที่ยังค้าง
      var scene = host || document;
      var imgs = scene.querySelectorAll ? scene.querySelectorAll('a-image') : [];
      for(var i=0;i<imgs.length;i++){ var n=imgs[i].parentNode; if(n && n.parentNode===host) n.parentNode.removeChild(n); }
    }catch(_){}
    emit('hha:end', { score:score, combo:maxCombo, misses:misses, title:'Good vs Junk', reason:reason||'done' });
  }

  return {
    stop: function(){ if(!running) return; endGame('quit'); },
    pause: function(){ running=false; },
    resume: function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}
export default { boot };
