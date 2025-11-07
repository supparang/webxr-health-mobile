// === Hero Health — modes/goodjunk.safe.js ===
import { Particles } from '../vr/particles.js';
import { createMiniQuest } from '../vr/miniquest.js';

function uvFromEvent(e){
  var x = (e && e.clientX!=null) ? e.clientX / window.innerWidth  : 0.5;
  var y = (e && e.clientY!=null) ? e.clientY / window.innerHeight : 0.6;
  return [x, y];
}

export async function boot(config = {}) {
  var score = 0, combo = 0, timeLeft = Number(config.duration||60), running = true;

  var timer = setInterval(function(){
    if(!running) return;
    timeLeft = Math.max(0, timeLeft-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
    if(timeLeft<=0) end();
  },1000);

  function end(){
    if(!running) return;
    running=false; clearInterval(timer); mq.stop();
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{score:score,combo:combo}}));
  }

  function pushQuest(text){
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:text}}));
  }

  function award(delta, isGood, e){
    combo = isGood ? Math.max(1, combo+1) : 0;
    score += delta;
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score:score,combo:combo}}));
    var uv = uvFromEvent(e);
    Particles.hit(uv[0], uv[1], { score: Math.abs(delta), combo: Math.max(1, combo), isGood: isGood });

    // แจ้งให้ mini-quest ประมวลผล hit
    mq.hit(isGood);
  }

  // ---------- เป้าแบบง่าย ----------
  var GOOD = ['🍎','🍐','🍊','🍓','🍇','🥝','🥦','🥕','🥗','🐟','🥛','🍞'];
  var JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🧋','🥤','🍫','🍰'];

  function spawnOne(){
    if(!running) return;
    var isGood = Math.random()<0.7;
    var emoji  = isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];

    var el = document.createElement('div');
    el.textContent = emoji;
    var left = (10+Math.random()*80)+'vw';
    var top  = (20+Math.random()*60)+'vh';
    var st = el.style;
    st.position='fixed'; st.left=left; st.top=top;
    st.fontSize='min(10vw,64px)'; st.filter='drop-shadow(0 0 10px #fff3)';
    st.cursor='pointer'; st.userSelect='none'; st.transition='transform 120ms ease-out';
    document.body.appendChild(el);

    el.onclick=function(e){
      el.onclick=null; st.transform='scale(0.85)';
      setTimeout(function(){ try{ el.remove(); }catch(e){} }, 120);
      award(isGood? +10 : -5, isGood, e);
    };

    setTimeout(function(){ try{ el.remove(); }catch(e){} }, 1500);
  }
  var spawner = setInterval(spawnOne, 550);

  // ---------- MINI QUEST – ADD ----------
  // เควสสลับหมุน 3 แบบ: No-Junk 10s, เก็บของดี 8 ชิ้น, เลี่ยงขยะ ≤3 ชิ้น
  var mq = createMiniQuest({
    onUpdate: function(text){ pushQuest(text); },
    onFinish: function(){ /* noop */ },
    makeList: function(){
      var noJunk = {
        title: 'No-Junk 10s',
        sec: 10,
        reset: function(){ this.ok = 0; },
        statusText: function(s){ return 'No-Junk — อยู่รอด ' + s + 's'; },
        apply: function(hit){ if(hit.bad){ return true===false; } return false; } // กดขยะ = fail เมื่อหมดเวลาเริ่มเควสใหม่
      };
      var collectGood = {
        title: 'เก็บของดี 8 ชิ้น',
        sec: 20,
        reset: function(){ this.c = 0; },
        statusText: function(s){ return 'เก็บของดี: ' + this.c + '/8 | เหลือ ' + s + 's'; },
        apply: function(hit){ if(hit.good){ this.c++; if(this.c>=8) return true; } return false; }
      };
      var avoid3 = {
        title: 'ขยะ ≤3 ชิ้น',
        sec: 20,
        reset: function(){ this.bad = 0; },
        statusText: function(s){ return 'เลี่ยงขยะ (' + this.bad + '/3) | เหลือ ' + s + 's'; },
        apply: function(hit){ if(hit.bad){ this.bad++; if(this.bad>3) { /* fail */ } } return false; }
      };
      return [noJunk, collectGood, avoid3];
    }
  });
  // เริ่ม mini quest
  mq.run();
  // -------------------------------------

  return {
    stop: function(){ running=false; clearInterval(timer); clearInterval(spawner); mq.stop(); },
    pause: function(){ running=false; },
    resume: function(){ running=true; }
  };
}

export default { boot };