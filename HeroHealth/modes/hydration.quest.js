// === Hydration (production) — water gauge + quests + safe boot ===
// ไม่มี optional chaining เพื่อลดปัญหาอุปกรณ์เก่า

var _running=false, _host=null, _tim=null, _remain=0;
var water=55; // 0..100
var score=0, combo=0, hits=0, misses=0, spawns=0;
var feverActive=false;

function dispatch(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(e){}
}

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function zoneOfWater(v){ return v<40?'LOW':(v>70?'HIGH':'GREEN'); }

function emitHUD(){
  dispatch('hha:score',{score:score, combo:combo});
}
function emitTime(){ dispatch('hha:time',{sec:_remain}); }
function emitWater(){
  var z = zoneOfWater(water);
  dispatch('hha:water',{ level: Math.round(water), zone: z });
}

function popupText(txt, x, y, color){
  // ใช้ troika ถ้ามี
  var t = document.createElement('a-entity');
  t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#fff')+'; fontSize:0.08;');
  t.setAttribute('position', x+' '+(y+0.08)+' -1.58');
  _host.appendChild(t);
  t.setAttribute('animation__rise','property: position; to: '+x+' '+(y+0.32)+' -1.58; dur: 520; easing: easeOutCubic');
  t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 560);
}

// สุ่มสปอน: น้ำดี/น้ำหวาน/กาแฟ/ชา/โซดา ฯลฯ
var GOOD = ['💧','🥤','🧊','🫗'];   // 💧 = น้ำเปล่า, 🧊/🫗 แทนของเพิ่มน้ำเล็กน้อย
var BAD  = ['🧋','🍹','🍺','☕'];   // ดื่มแล้วน้ำไม่ขึ้น (บางอันลง) + โทษถ้าน้ำต่ำ

function emojiSprite(emo, px){
  var c=document.createElement('canvas'); c.width=c.height=px||160;
  var ctx=c.getContext('2d');
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(c.width*0.7)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,0.25)'; ctx.shadowBlur=c.width*0.06;
  ctx.fillText(emo, c.width/2, c.height/2);
  return c.toDataURL('image/png');
}

function makeTarget(emoji, good, diff){
  var el = document.createElement('a-entity');

  var img = document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  var px = (Math.random()*1.4 - 0.7);
  var py = (Math.random()*0.7  + 0.6); // กึ่งกลางหน้าจอแถวกลางล่าง
  img.setAttribute('position', px+' '+py+' -1.55');
  img.setAttribute('width', 0.42);
  img.setAttribute('height', 0.42);
  img.classList.add('clickable');
  el.appendChild(img);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.addEventListener('click', function(){
    if(!_running) return;
    destroy();
    hits+=1; combo+=1; if(combo<0) combo=0;

    var z = zoneOfWater(water);
    var deltaW=0, deltaS=0;

    if(good){
      // น้ำที่เหมาะ → บวกน้ำตามโซน, ถ้าอยู่ GREEN ได้คะแนนเพิ่ม
      deltaW = (z==='LOW')? +10 : (z==='HIGH'? +4 : +7);
      deltaS = (z==='GREEN')? +25 : +15;
    }else{
      // ของไม่ดี: ถ้าน้ำ "สูง" อนุญาตให้ได้คะแนนบ้าง แต่ถ้าต่ำ → โทษแรง
      if(z==='HIGH'){ deltaS = +10; deltaW = -6; }
      else if(z==='LOW'){ deltaS = -25; deltaW = -10; combo=0; }
      else { deltaS = -5; deltaW = -6; combo=0; }
    }

    water = clamp(water + deltaW, 0, 100);
    score = Math.max(0, score + deltaS);

    popupText((deltaS>=0?'+':'')+deltaS, px, py, deltaS>=0?'#a7f3d0':'#fecaca');
    emitHUD();
    emitWater();
  });

  // อายุเป้า
  var life=1800; if(diff==='easy') life=2200; if(diff==='hard') life=1400;
  setTimeout(function(){
    if(!el.parentNode) return;
    destroy();
    spawns+=1; misses+=1; combo=0;
    // หมดเวลาโดยไม่คลิก: ถ้าเป็นของไม่ดี “ไม่ลงโทษ” (เลี่ยงขยะได้)
    // แต่ถ้าเป็นของดี → โทษเล็กน้อยเพราะพลาด (น้ำลดเล็กน้อย)
    if(good){
      water = clamp(water - 4, 0, 100);
      score = Math.max(0, score - 8);
      emitHUD();
      emitWater();
    }
  }, life);

  return el;
}

var _spawnTimer=null;
function spawnLoop(diff){
  if(!_running) return;
  var goodPick = Math.random() > 0.35; // เน้นดี ~65%
  var emoji = goodPick ? GOOD[(Math.random()*GOOD.length)|0] : BAD[(Math.random()*BAD.length)|0];
  _host.appendChild(makeTarget(emoji, goodPick, diff));
  spawns+=1;

  var gap=560; if(diff==='easy') gap=700; if(diff==='hard') gap=420;
  _spawnTimer = setTimeout(function(){ spawnLoop(diff); }, gap);
}

export async function boot(cfg){
  cfg = cfg || {};
  _host = cfg.host || document.getElementById('spawnHost');
  var diff = cfg.difficulty || 'normal';
  _remain = Number(cfg.duration||60)|0;

  _running=true; score=0; combo=0; hits=0; misses=0; spawns=0; water=55;
  dispatch('hha:quest', {text:'รักษาน้ำให้อยู่ “GREEN” ให้ได้มากที่สุด!'});
  emitHUD();
  emitWater();
  dispatch('hha:fever', {state:'end'}); // รีเซ็ต FEVER bar

  // นับเวลาถอยหลัง
  if(_tim) clearInterval(_tim);
  _tim = setInterval(function(){
    if(!_running){ clearInterval(_tim); return; }
    _remain = Math.max(0, _remain-1);
    emitTime();
    if(_remain<=0){
      endGame(diff);
    }
  }, 1000);

  // เริ่ม spawn
  spawnLoop(diff);

  function endGame(difficulty){
    if(!_running) return;
    _running=false;
    try{ clearInterval(_tim); }catch(e){}
    try{ clearTimeout(_spawnTimer); }catch(e){}
    // เก็บกวาดเป้า
    try{
      var kids = _host.querySelectorAll('a-image, a-entity');
      for(var i=0;i<kids.length;i++){ if(kids[i].parentNode) kids[i].parentNode.removeChild(kids[i]); }
    }catch(e){}

    dispatch('hha:end', {
      title:'Hydration',
      difficulty: difficulty,
      score: score,
      combo: combo,
      hits: hits,
      misses: misses,
      spawns: spawns,
      duration: Number(cfg.duration||60)|0
    });
  }

  return {
    stop: function(){ endGame(diff); },
    pause: function(){ _running=false; },
    resume: function(){ if(!_running){ _running=true; spawnLoop(diff); } }
  };
}
export default { boot };
