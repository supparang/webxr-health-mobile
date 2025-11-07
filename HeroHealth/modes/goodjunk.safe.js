// === modes/goodjunk.safe.js (production) ===
import { boot as buildMode } from '../vr/mode-factory.js';

// ชุดอิโมจิพื้นฐาน
var GOOD = ['🍎','🍓','🍇','🥦','🥕','🍊','🥬','🍌','🍐','🍍','🫐','🍉','🥝','🐟','🍞','🥛','🍚','🥗'];
var BAD  = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];

function inArr(ch, arr){
  for(var i=0;i<arr.length;i++){ if(arr[i]===ch) return true; }
  return false;
}

export async function boot(cfg){
  cfg = cfg || {};
  // เควสหมุนเวียนง่าย ๆ
  var quest = 'เก็บของดีให้ได้ 8 ชิ้น (หลีกเลี่ยงของขยะ)';
  try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:quest}})); }catch(e){}

  var api = await buildMode({
    host: cfg.host,
    difficulty: cfg.difficulty,
    duration: cfg.duration,
    pools: { good: GOOD, bad: BAD },
    goodRate: 0.7,
    goal: 9999,
    judge: function(char, ctx){
      var good = inArr(char, GOOD);
      // ให้คะแนน +10 ถ้าดี / -7 ถ้าขยะ
      return { good: good, scoreDelta: good? 10 : -7 };
    }
  });

  // ปรับข้อความเควสแบบง่ายทุก ๆ 6 วินาที
  var qset = [
    'No-Junk 10 วิ ติดกัน',
    'คอมโบถึง x5',
    'เก็บของดีติดกัน 8 ชิ้น'
  ];
  var qi=0;
  var qtimer=setInterval(function(){
    qi=(qi+1)%qset.length;
    try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:qset[qi]}})); }catch(e){}
  }, 6000);

  return {
    stop: function(){ try{ clearInterval(qtimer); }catch(e){} api && api.stop && api.stop(); },
    pause: function(){ api && api.pause && api.pause(); },
    resume: function(){ api && api.resume && api.resume(); }
  };
}

export default { boot };