// === modes/goodjunk.safe.js — Production (A-Frame targets + Fever + Quests + Coach) ===
// ไม่มี optional chaining เพื่อกัน error บนบราวเซอร์เก่า

// ---------- Utilities: event emit ----------
function gj_emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(_e){}
}
function coach(msg){ gj_emit('hha:coach',{text:String(msg||'')}); }
function hudScore(score, combo){ gj_emit('hha:score',{score:score, combo:combo}); }
function hudTime(sec){ gj_emit('hha:time',{sec:sec}); }
function questLine(text){ gj_emit('hha:quest',{text:String(text||'')}); }
function feverEvt(d){ gj_emit('hha:fever', d||{}); }

// ---------- Emoji Sprite (canvas → dataURL) ----------
var GJ_EMO_CACHE = {};
function GJ_emojiSprite(emo, px){
  var size = px||192, key = emo+'@'+size;
  if(GJ_EMO_CACHE[key]) return GJ_EMO_CACHE[key];
  var c = document.createElement('canvas'); c.width = size; c.height = size;
  var ctx = c.getContext('2d');
  ctx.clearRect(0,0,size,size);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  // outer glow
  ctx.save();
  ctx.shadowColor='rgba(255,255,255,0.55)'; ctx.shadowBlur=Math.floor(size*0.18);
  ctx.font=(size*0.78)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.fillText(emo, size/2, size/2);
  ctx.restore();
  // drop shadow
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=Math.floor(size*0.12);
  ctx.shadowOffsetX=Math.floor(size*0.03); ctx.shadowOffsetY=Math.floor(size*0.05);
  ctx.font=(size*0.78)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.fillText(emo, size/2, size/2);
  ctx.restore();
  // fill
  ctx.font=(size*0.78)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.fillText(emo, size/2, size/2);
  GJ_EMO_CACHE[key] = c.toDataURL('image/png');
  return GJ_EMO_CACHE[key];
}

// ---------- Pools ----------
var GJ_GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
var GJ_JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
var GJ_STAR = ['⭐'], GJ_DIAM = ['💎'];

// ---------- Mini-Quest Deck (10 แบบ → สุ่ม 3) ----------
var GJ_QUEST_POOL = [
  {id:'good10',    label:'เก็บของดี 10 ชิ้น',        ok:function(s){return s.good>=10;},     prog:function(s){return Math.min(10,s.good)+'/10';}},
  {id:'avoid5',    label:'เลี่ยงขยะ 5 ครั้ง',        ok:function(s){return s.avoid>=5;},     prog:function(s){return Math.min(5,s.avoid)+'/5';}},
  {id:'combo10',   label:'ทำคอมโบ 10',               ok:function(s){return s.comboMax>=10;}, prog:function(s){return Math.min(10,s.comboMax)+'/10';}},
  {id:'good20',    label:'เก็บของดี 20 ชิ้น',        ok:function(s){return s.good>=20;},     prog:function(s){return Math.min(20,s.good)+'/20';}},
  {id:'nostreak10',label:'ไม่พลาด 10 วินาที',         ok:function(s){return s.noMiss>=10;},   prog:function(s){return Math.min(10,s.noMiss)+'s/10s';}},
  {id:'fever2',    label:'เข้า Fever 2 ครั้ง',        ok:function(s){return s.fever>=2;},     prog:function(s){return Math.min(2,s.fever)+'/2';}},
  {id:'combo20',   label:'คอมโบ 20 ต่อเนื่อง',       ok:function(s){return s.comboMax>=20;}, prog:function(s){return Math.min(20,s.comboMax)+'/20';}},
  {id:'score500',  label:'ทำคะแนน 500+',              ok:function(s){return s.score>=500;},   prog:function(s){return Math.min(500,s.score)+'/500';}},
  {id:'star3',     label:'เก็บดาว ⭐ 3 ดวง',           ok:function(s){return s.star>=3;},      prog:function(s){return Math.min(3,s.star)+'/3';}},
  {id:'diamond1',  label:'เก็บเพชร 💎 1 เม็ด',         ok:function(s){return s.diamond>=1;},   prog:function(s){return Math.min(1,s.diamond)+'/1';}}
];
function GJ_draw3(){
  var pool = GJ_QUEST_POOL.slice();
  function pick(){ return pool.splice(Math.floor(Math.random()*pool.length),1)[0]; }
  return [pick(), pick(), pick()];
}

// ---------- Shard FX (แตกกระจาย) ----------
function gj_explodeShards(host, pos, palette){
  var N = 12; // ชิ้น
  for(var i=0;i<N;i++){
    var p = document.createElement('a-entity');
    var col = palette[i % palette.length];
    // ใช้ plane ชิ้นเล็ก (สี่เหลี่ยม)
    var plane = document.createElement('a-plane');
    plane.setAttribute('width', 0.06);
    plane.setAttribute('height', 0.12);
    plane.setAttribute('material', 'color:'+col+';opacity:0.95;side:double');
    p.appendChild(plane);

    p.setAttribute('position', pos.x+' '+pos.y+' '+pos.z);
    // ทิศสุ่ม
    var theta = Math.random()*Math.PI*2;
    var speed = 0.8 + Math.random()*0.8; // m/s
    var dx = Math.cos(theta)*speed, dz = Math.sin(theta)*speed;
    var dy = 0.8 + Math.random()*0.6;
    // แอนิเมชันวิ่งออก+ตก
    p.setAttribute('animation__move', 'property: position; to: '+(pos.x+dx)+' '+(pos.y+dy)+' '+(pos.z+dz)+'; dur: 360; easing: easeOutQuad');
    p.setAttribute('animation__fade', 'property: components.material.material.opacity; to: 0; dur: 420; easing: linear; delay: 240');
    // หมุนสุ่ม
    var rx=(Math.random()*180-90)|0, ry=(Math.random()*360)|0, rz=(Math.random()*180-90)|0;
    p.setAttribute('rotation', rx+' '+ry+' '+rz);

    host.appendChild(p);
    (function(node){
      setTimeout(function(){ try{ host.removeChild(node); }catch(_e){} }, 640);
    })(p);
  }
}

// ---------- Popup Score (troika-text ถ้ามี) ----------
function gj_popup(host, txt, pos, color){
  var t = document.createElement('a-entity');
  t.setAttribute('position', pos.x+' '+(pos.y+0.06)+' '+pos.z);
  t.setAttribute('troika-text', 'value: '+txt+'; color: '+(color||'#fff')+'; fontSize:0.10;');
  t.setAttribute('animation__rise', 'property: position; to: '+pos.x+' '+(pos.y+0.35)+' '+pos.z+'; dur: 520; easing: easeOutCubic');
  t.setAttribute('animation__fade', 'property: opacity; to: 0; dur: 520; easing: linear');
  host.appendChild(t);
  setTimeout(function(){ try{ host.removeChild(t); }catch(_e){} }, 560);
}

// ---------- Boot ----------
export async function boot(cfg){
  cfg = cfg||{};
  var scene = document.getElementById('scene');
  var host  = (cfg.host) || document.getElementById('spawnHost') || scene;
  var duration = (cfg.duration|0) || 60;
  var diff = String(cfg.difficulty||'normal');

  // State
  var running=true, remain=duration;
  var score=0, combo=0, comboMax=0;
  var hits=0, misses=0, spawns=0;
  var stats={good:0, avoid:0, comboMax:0, noMiss:0, fever:0, score:0, star:0, diamond:0};
  var quests = GJ_draw3(); var qIndex=0;

  // Fever
  var FEVER=false, feverLevel=0, feverEndTimer=null;
  function feverAdd(v){
    feverLevel = Math.max(0, Math.min(100, feverLevel + v));
    feverEvt({state:'change', level:feverLevel, active:FEVER});
    if(!FEVER && feverLevel>=100){ feverStart(); }
  }
  function feverStart(){
    FEVER=true; stats.fever++; feverLevel=100;
    feverEvt({state:'start', level:100, active:true});
    coach('🔥 FEVER มาแล้ว! คูณคะแนนให้สุด!');
    clearTimeout(feverEndTimer);
    feverEndTimer = setTimeout(feverEnd, 10000);
  }
  function feverEnd(){
    if(!FEVER) return;
    FEVER=false; feverLevel=0;
    feverEvt({state:'end', level:0, active:false});
    coach('Fever จบ ลุยต่อ!');
  }

  // Difficulty tuning
  var spawnMin=520, spawnMax=700, lifeMs=1700, goodAdd=12, feverBonus=2.0;
  if(diff==='easy'){  spawnMin=650; spawnMax=880; lifeMs=2000; goodAdd=14; feverBonus=2.0; }
  if(diff==='hard'){  spawnMin=420; spawnMax=560; lifeMs=1400; goodAdd=10; feverBonus=2.2; }

  // Quest HUD
  function updateQuestHUD(){
    var q = quests[qIndex];
    if(!q){ questLine('Mini Quest — เคลียร์ครบแล้ว!'); return; }
    questLine('Quest '+(qIndex+1)+'/3: '+q.label+' ('+q.prog(stats)+')');
  }
  function tryAdvanceQuest(){
    var q = quests[qIndex]; if(!q) return false;
    if(q.ok(stats)){
      coach('เยี่ยม! เควสสำเร็จ ✅');
      qIndex++;
      updateQuestHUD();
      return true;
    } else {
      updateQuestHUD();
      return false;
    }
  }

  // Fever decay ticker (นิ่มๆ)
  var decayTimer = setInterval(function(){
    if(!running) return;
    if(!FEVER && feverLevel>0){
      feverAdd(-4); // วินาทีละ ~4% (จาก interval 1000ms ด้านล่าง + ตัวนี้ 500ms)
    }
  }, 500);

  // Clock
  hudTime(remain); updateQuestHUD(); hudScore(0,0);
  var timeTimer = setInterval(function(){
    if(!running) return;
    remain=Math.max(0, remain-1);
    hudTime(remain);
    // noMiss +1 ต่อวิ ถ้าไม่มี "การคลิกขยะ" ในวินั้น (รีเซ็ตเมื่อ junk ถูกคลิก)
    stats.noMiss = Math.min(9999, stats.noMiss + 1);
    tryAdvanceQuest();
    if(remain<=0){ end('timeout'); }
  }, 1000);

  // Spawner
  var spawnTimer=null;
  function planNext(){
    if(!running) return;
    var base = Math.floor(spawnMin + Math.random()*(spawnMax-spawnMin));
    if(FEVER) base = Math.max(300, Math.round(base*0.85));
    spawnTimer = setTimeout(spawnOne, base);
  }

  // Shard palette (เฉพาะโหมด Good vs Junk)
  var SHARD_COLORS_GOOD = ['#36d399','#22c55e','#4ade80','#86efac'];
  var SHARD_COLORS_BAD  = ['#fb7185','#ef4444','#f97316','#f43f5e'];

  // Create a target
  function spawnOne(){
    if(!running) return;
    spawns++;

    var isGood = Math.random() < 0.65;
    var list = isGood ? GJ_GOOD : GJ_JUNK;
    var ch = list[(Math.random()*list.length)|0];

    var item = document.createElement('a-entity');
    // Sprite
    var img = document.createElement('a-image');
    img.setAttribute('src', GJ_emojiSprite(ch, 192));
    img.setAttribute('width', 0.46);
    img.setAttribute('height',0.46);
    img.classList.add('clickable');

    // Position: กระจายกึ่งกลางจอ (รอบ host)
    var px = (Math.random()*1.6 - 0.8);        // -0.8..0.8
    var py = (Math.random()*0.8 - 0.2);        // -0.2..0.6 (กลางจอ)
    var p = {x:px, y:py, z:0};

    item.setAttribute('position', px+' '+py+' 0');
    item.appendChild(img);

    // Glow plane (hint สี)
    var glow = document.createElement('a-plane');
    glow.setAttribute('width', 0.52);
    glow.setAttribute('height',0.52);
    glow.setAttribute('position','0 0 -0.01');
    glow.setAttribute('material', 'color:'+(isGood?'#22c55e':'#ef4444')+'; opacity:0.18; transparent:true; side:double');
    item.appendChild(glow);

    // TTL (miss/avoid)
    var killed=false;
    var ttl = setTimeout(function(){
      if(killed || !running) return;
      // หายเอง
      if(isGood){
        // พลาดของดี → โทษ: คอมโบตก, คะแนนลบ, นับ miss
        combo = 0; score = Math.max(0, score - 10); misses++;
        stats.comboMax = Math.max(stats.comboMax, combo);
        hudScore(score, combo);
        coach('พลาดของดี! เสีย 10 คะแนน');
        gj_emit('hha:miss',{count:misses});
      }else{
        // เลี่ยงขยะสำเร็จ → ได้คะแนนเล็กน้อย + ไม่ตัดคอมโบ
        var plus = 5;
        score += plus; stats.avoid++;
        hudScore(score, combo);
        coach('เลี่ยงขยะได้ดี! +'+plus);
        tryAdvanceQuest();
      }
      // ลบเป้าและไปต่อ
      try{ host.removeChild(item); }catch(_e){}
      planNext();
    }, lifeMs);

    // Click hit
    img.addEventListener('click', function(){
      if(killed || !running) return; killed=true;
      clearTimeout(ttl);
      try{ host.removeChild(item); }catch(_e){}

      var worldPos = {x: p.x, y: p.y, z: -1.6}; // host อยู่ที่ 0 1.0 -1.6 → local z=0 ตรงหน้า
      if(isGood){
        hits++;
        // คะแนน + คอมโบ + Fever + ชาร์ดสีเขียว
        var base = 20 + combo*2;
        var plus = FEVER ? Math.round(base * feverBonus) : base;
        score += plus; combo += 1; if(combo>comboMax) comboMax=combo;
        stats.good++; stats.score = Math.max(stats.score, score);
        hudScore(score, combo);
        gj_explodeShards(host, worldPos, SHARD_COLORS_GOOD);
        gj_popup(host, '+'+plus, worldPos, '#ffffff');
        feverAdd(goodAdd);
        if(combo%5===0) coach('คอมโบ x'+combo+'! สุดยอด!');
        tryAdvanceQuest();
      }else{
        // คลิกขยะ = ผิด → หักแต้ม + คอมโบ 0 + ชาร์ดสีแดง + รีเซ็ต noMiss
        var minus = 15;
        score = Math.max(0, score - minus);
        combo = 0; misses++;
        stats.noMiss = 0;
        hudScore(score, combo);
        gj_explodeShards(host, worldPos, SHARD_COLORS_BAD);
        gj_popup(host, '-'+minus, worldPos, '#ffb4b4');
        coach('ระวังของขยะ!');
        gj_emit('hha:miss',{count:misses});
        tryAdvanceQuest();
      }
      planNext();
    });

    host.appendChild(item);
    planNext();
  }

  // Kick off
  coach('เริ่ม Good vs Junk! โฟกัสของดี เลี่ยงของขยะ!');
  questLine('Mini Quest — กำลังสุ่ม…');
  setTimeout(updateQuestHUD, 80);
  planNext();

  function end(reason){
    if(!running) return;
    running=false;
    try{ clearInterval(timeTimer); }catch(_e){}
    try{ clearInterval(decayTimer); }catch(_e){}
    try{ clearTimeout(spawnTimer); }catch(_e){}
    try{ clearTimeout(feverEndTimer); }catch(_e){}

    // ล้างเป้าที่ยังค้าง
    try{
      var kids = host.children||[];
      for(var i=kids.length-1;i>=0;i--){
        var n = kids[i];
        if(n && (n.tagName==='A-ENTITY' || n.tagName==='A-IMAGE' || n.tagName==='A-PLANE')){
          // พยายามลบเฉพาะที่เราสร้าง (ปล่อยกล้อง/sky)
          if(n!==host) try{ host.removeChild(n); }catch(_e){}
        }
      }
    }catch(_e){}

    // ส่งสรุป
    gj_emit('hha:end',{
      mode:'Good vs Junk',
      difficulty: diff,
      score: score,
      comboMax: comboMax,
      hits: hits,
      misses: misses,
      spawns: spawns,
      questsCleared: Math.min(3, qIndex),
      questsTotal: 3,
      duration: duration,
      reason: reason||'done'
    });
  }

  // API
  return {
    stop: function(){ end('quit'); },
    pause: function(){ running=false; },
    resume: function(){
      if(running) return;
      running=true;
      planNext();
    }
  };
}

export default { boot };
