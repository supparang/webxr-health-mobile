// === Good vs Junk — SAFE + FEVER + Real Mini-Quests (no optional chaining) ===
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

function feverStart(ms){
  if(FEVER_ACTIVE) return;
  FEVER_ACTIVE = true;
  var t = ms || FEVER_MS;
  emit('hha:fever',{state:'start', ms:t});
  clearTimeout(feverTimer);
  feverTimer = setTimeout(function(){ feverEnd(); }, t);
}
function feverEnd(){
  if(!FEVER_ACTIVE) return;
  FEVER_ACTIVE = false;
  emit('hha:fever',{state:'end'});
  clearTimeout(feverTimer); feverTimer=null;
}

// ==== Mini Quest System (3 quests random from 10) ====
var quests = [];      // ทั้ง 10 แบบ (factory)
var plan = [];        // 3 เควสต์ที่สุ่มมา
var qi = 0;           // index เควสต์ปัจจุบัน
var q = null;         // เควสต์ที่กำลังทำอยู่
var questDoneCount = 0;

function format(txt){ return 'Mini Quest — '+txt; }
function setQuestText(){
  if(!q) return;
  emit('hha:quest',{text: format(q.title())});
}

// เควสต์ template: {title(), onHit(good), onMiss(), onTick(dt), isDone(), reward()}
function buildQuests(){
  return [
    // 1) เก็บของดีติดกัน N ชิ้น
    function(){ var need=6, got=0; return {
      title:function(){ return 'เก็บของดีติดกัน '+got+'/'+need+' ชิ้น'; },
      onHit:function(g){ if(g){ got++; } else { got=0; } },
      onMiss:function(){ got=0; },
      onTick:function(){},
      isDone:function(){ return got>=need; },
      reward:function(){ feverStart(6000); return 'เปิด FEVER 6s!'; }
    };},
    // 2) หลีกเลี่ยงของไม่ดีติดกัน N ครั้ง
    function(){ var need=4, ok=0; return {
      title:function(){ return 'หลีกเลี่ยงของไม่ดีติดกัน '+ok+'/'+need+' ครั้ง'; },
      onHit:function(g){ if(g){ ok++; } else { ok=0; } },
      onMiss:function(){ ok=0; },
      onTick:function(){},
      isDone:function(){ return ok>=need; },
      reward:function(){ score+=100; return '+100 คะแนน'; }
    };},
    // 3) ทำคะแนนเพิ่มอีก X ภายในเควสต์
    function(){ var base=score, target=200; return {
      title:function(){ return 'ทำคะแนนให้เพิ่มอีก '+Math.max(0, target-(score-base))+' ภายในเวลา'; },
      onHit:function(){}, onMiss:function(){}, onTick:function(){},
      isDone:function(){ return (score-base)>=target; },
      reward:function(){ feverStart(5000); return 'FEVER 5s!'; }
    };},
    // 4) สร้างคอมโบถึง N
    function(){ var need=8; return {
      title:function(){ return 'ทำคอมโบถึง x'+need+' (ปัจจุบัน x'+combo+')'; },
      onHit:function(){}, onMiss:function(){},
      onTick:function(){},
      isDone:function(){ return combo>=need; },
      reward:function(){ score+=150; return '+150 คะแนน'; }
    };},
    // 5) เก็บผลไม้ 5 ชิ้น (ไอคอนผลไม้ที่อยู่ใน GOOD)
    function(){ var fruits={'🍎':1,'🍌':1,'🍇':1,'🍊':1,'🍓':1,'🍍':1,'🍐':1,'🥝':1}, got=0, need=5; return {
      title:function(){ return 'เก็บผลไม้ให้ครบ '+got+'/'+need+' ชิ้น'; },
      onHit:function(g,emoji){ if(g && fruits[emoji]) got++; },
      onMiss:function(){},
      onTick:function(){},
      isDone:function(){ return got>=need; },
      reward:function(){ feverStart(5000); return 'FEVER 5s!'; }
    };},
    // 6) หลีกเลี่ยงน้ำอัดลม/ชานม 3 ชิ้น
    function(){ var bad={'🥤':1,'🧋':1}, need=3, skip=0; return {
      title:function(){ return 'อย่าคลิกน้ำหวาน '+skip+'/'+need+' ชิ้น'; },
      onHit:function(g,emoji){ if(!g && bad[emoji]){ skip++; } },
      onMiss:function(){},
      onTick:function(){},
      isDone:function(){ return skip>=need; },
      reward:function(){ score+=120; return '+120 คะแนน'; }
    };},
    // 7) ทำคะแนนแบบ Perfect (ไม่พลาด) ต่อเนื่อง 7 คลิก
    function(){ var streak=0, need=7; return {
      title:function(){ return 'Perfect ต่อเนื่อง '+streak+'/'+need; },
      onHit:function(g){ if(g){ streak++; } else { streak=0; } },
      onMiss:function(){ streak=0; },
      onTick:function(){},
      isDone:function(){ return streak>=need; },
      reward:function(){ feverStart(6000); return 'FEVER 6s!'; }
    };},
    // 8) ทำให้คอมโบรอด 10 วินาที (ไม่ตก)
    function(){ var timer=0, need=10; return {
      title:function(){ return 'รักษาคอมโบให้อยู่ต่อเนื่อง '+Math.max(0,need-Math.floor(timer))+'s'; },
      onHit:function(){}, onMiss:function(){ timer=0; },
      onTick:function(dt){ if(combo>0) timer += dt/1000; },
      isDone:function(){ return timer>=need; },
      reward:function(){ score+=200; return '+200 คะแนน'; }
    };},
    // 9) เก็บนม/ธัญพืช 4 ชิ้น
    function(){ var set={'🥛':1,'🍚':1,'🍞':1,'🥜':1}, got=0, need=4; return {
      title:function(){ return 'เก็บนม/ธัญพืช '+got+'/'+need; },
      onHit:function(g,emoji){ if(g && set[emoji]) got++; },
      onMiss:function(){},
      onTick:function(){},
      isDone:function(){ return got>=need; },
      reward:function(){ feverStart(5000); return 'FEVER 5s!'; }
    };},
    // 10) อย่าคลิกของไม่ดี 8 วินาที
    function(){ var t=0, need=8; return {
      title:function(){ return 'หลีกเลี่ยงของไม่ดี '+Math.max(0,need-Math.floor(t))+'s'; },
      onHit:function(g){ if(!g){ t=0; } },
      onMiss:function(){},
      onTick:function(dt){ t += dt/1000; },
      isDone:function(){ return t>=need; },
      reward:function(){ score+=180; return '+180 คะแนน'; }
    };}
  ];
}

function pickThreeDistinct(n){
  var a=[], used={};
  while(a.length<3 && a.length<n){
    var r = Math.floor(Math.random()*n);
    if(!used[r]){ used[r]=1; a.push(r); }
  }
  return a;
}

function startQuestChain(){
  quests = buildQuests();
  var idx = pickThreeDistinct(quests.length);
  plan = [ quests[idx[0]](), quests[idx[1]](), quests[idx[2]]() ];
  qi = 0; questDoneCount=0;
  q = plan[qi];
  setQuestText();
}

function completeCurrentQuest(){
  var rewardMsg = '';
  try{ rewardMsg = q.reward()||''; }catch(e){}
  questDoneCount++;
  emit('hha:quest',{text: '✅ สำเร็จ ('+questDoneCount+'/3) — '+rewardMsg});
  // ไปเควสต์ต่อไป
  qi++;
  if(qi>=plan.length){
    // จบชุดเควสต์
    emit('hha:quest',{text:'🎉 จบ 3 Mini Quests แล้ว! สู้ต่อให้ได้คะแนนสูงสุด!'});
  }else{
    q = plan[qi];
    setTimeout(setQuestText, 900);
  }
}

// ==== Target ====
function makeTarget(emoji, good, diff){
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

      if(!FEVER_ACTIVE && combo >= FEVER_COMBO_NEED){ feverStart(); }

      popupText('+'+plus, px, py);
    }else{
      combo = 0; misses += 1;
      score = Math.max(0, score - 15);
      popupText('-15', px, py, '#ffb4b4');
    }

    // เควสต์อัปเดต
    if(q){ try{ q.onHit(good, emoji); }catch(e){} }

    emit('hha:score', {score:score, combo:combo});

    // สำเร็จเควสต์?
    if(q && q.isDone && q.isDone()){
      completeCurrentQuest();
    }else{
      setQuestText();
    }
  });

  // เวลาหมด = พลาด
  var ttl = 1600;
  if(diff==='easy') ttl = 1900; else if(diff==='hard') ttl = 1400;
  setTimeout(function(){
    if(!el.parentNode) return;
    destroy(); misses += 1; combo = 0;
    if(q){ try{ q.onMiss(); }catch(e){} }
    emit('hha:miss'); emit('hha:score', {score:score, combo:combo});
    setQuestText();
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
  var goodPick = Math.random() > 0.35;
  var emoji = goodPick ? GOOD[Math.floor(Math.random()*GOOD.length)]
                       : JUNK[Math.floor(Math.random()*JUNK.length)];
  host.appendChild(makeTarget(emoji, goodPick, diff));

  var gap = 520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER_ACTIVE) gap = Math.max(300, Math.round(gap*0.85));

  spawnTimer = setTimeout(function(){ spawnLoop(diff); }, gap);
}

export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  running = true; score=0; combo=0; maxCombo=0; misses=0;
  FEVER_ACTIVE=false; clearTimeout(feverTimer); feverTimer=null;

  emit('hha:score', {score:0, combo:0});
  emit('hha:fever', {state:'end'});
  emit('hha:quest', {text:'Mini Quest — กำลังเริ่ม…'});

  // Mini Quests
  startQuestChain();

  // นับเวลาฝั่งโหมด
  var remain = duration;
  emit('hha:time', {sec:remain});
  clearInterval(endTimer);
  endTimer = setInterval(function(){
    if(!running){ clearInterval(endTimer); return; }
    remain -= 1; if(remain < 0) remain = 0;
    emit('hha:time', {sec:remain});
    if(q && q.onTick){ try{ q.onTick(1000); }catch(e){} }
    if(q && q.isDone && q.isDone()){ completeCurrentQuest(); }
    if(remain <= 0){
      clearInterval(endTimer);
      endGame();
    }
  }, 1000);

  // สแปว์น
  spawnLoop(diff);

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
