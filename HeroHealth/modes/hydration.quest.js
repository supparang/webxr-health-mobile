// === Hydration — QUEST (centered host y=1.0) ===
var running=false, host=null;
var score=0, misses=0, hits=0, spawns=0, combo=0, maxCombo=0;
var endTimer=null, spawnTimer=null;

// ระดับน้ำ 0..100 (กลาง=พอดี)
var water=50;

function emit(n,d){ try{ window.dispatchEvent(new CustomEvent(n,{detail:d})); }catch(e){} }
function pick(a){ return a[(Math.random()*a.length)|0]; }

var GOOD = ['🥤','💧','🧃'];        // น้ำ/เครื่องดื่มดี
var BAD  = ['🥤','🧋','🍺','🥛'];   // ถ้ามากไปไม่ดี (สมมุติ penalty)
var TIP_GOOD = ['จิบน้ำเล็กน้อย','พักดื่มน้ำ','เว้นน้ำหวาน'];
var TIP_BAD  = ['อย่าดื่มรวดเดียว','งดเครื่องหวาน','ลดปริมาณ'];

function emojiSprite(emo, px){
  var key=emo+'@'+px; emojiSprite.cache=emojiSprite.cache||{};
  if(emojiSprite.cache[key]) return emojiSprite.cache[key];
  var c=document.createElement('canvas'); c.width=c.height=px;
  var x=c.getContext('2d'); x.textAlign='center'; x.textBaseline='middle';
  x.font=(px*0.75)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  x.shadowColor='rgba(0,0,0,.25)'; x.shadowBlur=px*0.06; x.fillText(emo,px/2,px/2);
  var url=c.toDataURL('image/png'); emojiSprite.cache[key]=url; return url;
}

function popupText(txt, lx, ly, color){
  try{
    var wx = lx, wy = 1.0 + ly, wz = -1.6 + 0.02;
    var t = document.createElement('a-entity');
    t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#ffffff')+'; fontSize:0.09; anchor:center;');
    t.setAttribute('position', wx+' '+(wy+0.05)+' '+wz);
    host.appendChild(t);
    t.setAttribute('animation__rise','property: position; to: '+wx+' '+(wy+0.32)+' '+wz+'; dur:520; easing:ease-out');
    t.setAttribute('animation__fade','property: opacity; to: 0; dur:520; easing:linear');
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); },560);
  }catch(e){}
}

function judge(delta){
  water = Math.max(0, Math.min(100, water + delta));
  var inGreen = (water>=40 && water<=60);
  return inGreen;
}

function makeTarget(isGood, diff){
  var wrap=document.createElement('a-entity');
  var emoji = isGood ? pick(GOOD) : pick(BAD);
  var img=document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  var px=(Math.random()*1.6 - 0.8);
  var py=(Math.random()*0.5 - 0.25);
  img.setAttribute('position', px+' '+py+' 0');
  img.setAttribute('width', 0.42); img.setAttribute('height',0.42);
  wrap.appendChild(img);

  function cleanup(){ if(wrap.parentNode) wrap.parentNode.removeChild(wrap); }

  img.classList.add('clickable');
  img.addEventListener('click', function(){
    if(!running) return;
    cleanup(); spawns++; hits++;
    // กติกา: ถ้าคลิกน้ำดี → +10 น้ำ, น้ำหวาน/นม (มากไป) → +20 น้ำ
    var delta = isGood ? +10 : +20;
    var wasGreen = (water>=40 && water<=60);
    var ok = judge(delta);

    if(ok){
      var plus = 25 + combo*3; score += plus; combo+=1; if(combo>maxCombo) maxCombo=combo;
      popupText('+'+plus, px, py, '#bbf7d0');
    }else{
      // ถ้าอยู่ HIGH แล้วไปเลือกของ “ไม่ดี” → โทษแรง
      var pen = (water>60 && !isGood) ? 30 : 15;
      score = Math.max(0, score-pen); combo=0; misses+=1;
      popupText('-'+pen, px, py, '#fecaca');
      emit('hha:miss', {count:misses});
    }

    // แสดง quest สั้น ๆ
    var tip = ok ? pick(TIP_GOOD) : pick(TIP_BAD);
    emit('hha:quest', {text:'ระดับน้ำ: '+Math.round(water)+'% — '+tip});
    emit('hha:score', {score:score, combo:combo});
  });

  var ttl=1700; if(diff==='easy') ttl=2000; else if(diff==='hard') ttl=1400;
  setTimeout(function(){
    if(!wrap.parentNode) return;
    cleanup(); spawns++;
    // ถ้าปล่อยผ่าน และน้ำต่ำ <40 → ถือว่าแย่ลงเล็กน้อย
    if(water<40){ misses+=1; combo=0; emit('hha:miss',{count:misses}); }
  }, ttl);

  return wrap;
}

function spawnLoop(diff){
  if(!running) return;
  var isGood = Math.random()<0.65; // โอกาสออกน้ำดี
  host.appendChild(makeTarget(isGood, diff));
  var gap=560; if(diff==='easy') gap=700; if(diff==='hard') gap=420;
  spawnTimer=setTimeout(function(){ spawnLoop(diff); }, gap);
}

export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  try{ host.setAttribute('position','0 1.0 -1.6'); }catch(e){}
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  running=true; score=0; misses=0; hits=0; spawns=0; combo=0; maxCombo=0; water=50;

  emit('hha:score',{score:0, combo:0});
  emit('hha:quest',{text:'รักษาระดับน้ำให้อยู่โซน GREEN (40–60%)'});
  var remain=duration; emit('hha:time',{sec:remain});
  clearInterval(endTimer);
  endTimer=setInterval(function(){
    if(!running){ clearInterval(endTimer); return; }
    // คายตามเวลาเล็กน้อย
    water = Math.max(0, water - 1);
    remain-=1; if(remain<0) remain=0;
    emit('hha:time',{sec:remain});
    if(remain<=0){ clearInterval(endTimer); endGame(); }
  },1000);

  spawnLoop(diff);

  function endGame(){
    running=false; clearTimeout(spawnTimer);
    emit('hha:end',{
      title:'Hydration',
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
    stop:function(){ if(!running) return; endGame(); },
    pause:function(){ running=false; },
    resume:function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}
export default { boot };
